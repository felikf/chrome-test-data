import { deleteRecord, getRecord, getRecords, nowIso, setLastActiveCluid, upsertRecord, } from './utils/storage.js';
const h = React.createElement;
const state = {
    records: [],
    status: null,
    editingNotes: {},
    importInput: '',
    recordsOrder: [],
};
function setStatus(message, type = 'info') {
    state.status = { message, type };
    renderApp();
}
function getProductValue(record) {
    const candidates = [
        'product',
        'Product',
        'productName',
        'ProductName',
        'productId',
        'productID',
    ];
    const productValue = candidates
        .map((key) => record.formData?.[key])
        .find((value) => typeof value === 'string' && value.trim().length > 0);
    const channelProduct = record.formData?.['channelProduct'] || record.formData?.['ChannelProduct'];
    if (productValue && channelProduct && channelProduct !== productValue) {
        return `${productValue} / ${channelProduct}`;
    }
    if (productValue)
        return productValue;
    if (channelProduct)
        return channelProduct;
    return '—';
}
async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        throw new Error('No active tab found');
    }
    return tab;
}
async function collectCurrentForm() {
    const tab = await getActiveTab();
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'collect-form-data' });
    return response || { formData: {} };
}
async function fillForm(formData, cluid) {
    const tab = await getActiveTab();
    await chrome.tabs.sendMessage(tab.id, { type: 'fill-form-data', payload: { formData } });
    await setLastActiveCluid(cluid);
}
function updateEditingNote(cluid, value) {
    state.editingNotes = { ...state.editingNotes, [cluid]: value };
    renderApp();
}
function removeEditingNote(cluid) {
    const { [cluid]: _removed, ...rest } = state.editingNotes;
    state.editingNotes = rest;
    renderApp();
}
async function refreshRecords() {
    const records = await getRecords();
    const preferredOrder = state.recordsOrder;
    const recordMap = new Map(records.map((record) => [record.cluid, record]));
    const orderedRecords = [];
    preferredOrder.forEach((cluid) => {
        const record = recordMap.get(cluid);
        if (record) {
            orderedRecords.push(record);
            recordMap.delete(cluid);
        }
    });
    const remaining = Array.from(recordMap.values()).sort((a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime());
    state.records = [...orderedRecords, ...remaining];
    state.recordsOrder = state.records.map((record) => record.cluid);
    renderApp();
}
async function handleSaveCurrent() {
    try {
        setStatus('Reading form data...');
        const { formData, cluid } = await collectCurrentForm();
        const targetCluid = cluid || prompt('Enter cluid for this record:');
        if (!targetCluid) {
            setStatus('Cluid is required to store a record.', 'error');
            return;
        }
        const existing = await getRecord(targetCluid);
        const record = {
            cluid: targetCluid,
            formData,
            note: existing?.note || '',
            applicationState: existing?.applicationState,
            stepCode: existing?.stepCode,
            lastEdited: nowIso(),
        };
        await upsertRecord(record);
        await setLastActiveCluid(targetCluid);
        await refreshRecords();
        setStatus(`Saved data for ${targetCluid}.`);
    }
    catch (error) {
        console.error(error);
        setStatus('Failed to save current form.', 'error');
    }
}
async function handleTriggerRedirect() {
    try {
        const tab = await getActiveTab();
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'trigger-redirect' });
        if (response?.clicked) {
            setStatus('Clicked Redirect on the page.');
        }
        else {
            setStatus('Redirect button was not found on the page.', 'error');
        }
    }
    catch (error) {
        console.error(error);
        setStatus('Failed to trigger redirect on the page.', 'error');
    }
}
async function handleRedirectToDebug() {
    try {
        const tab = await getActiveTab();
        if (!tab.url) {
            setStatus('Active tab has no URL.', 'error');
            return;
        }
        const origin = new URL(tab.url).origin;
        const targetUrl = `${origin}/loan/debug/?cluid=123&idpOrigin=TOKEN_EXTRACTION_local&environment=INT#access_token=saf`;
        await chrome.tabs.update(tab.id, { url: targetUrl });
        setStatus('Redirecting to debug page...');
    }
    catch (error) {
        console.error(error);
        setStatus('Failed to redirect to debug page.', 'error');
    }
}
async function handleFill(record) {
    try {
        await fillForm(record.formData, record.cluid);
        await setLastActiveCluid(record.cluid);
        setStatus(`Loaded full form data for ${record.cluid} to the page.`);
    }
    catch (error) {
        console.error(error);
        setStatus('Could not load data into the page.', 'error');
    }
}
async function handleDelete(record) {
    state.recordsOrder = state.recordsOrder.filter((cluid) => cluid !== record.cluid);
    await deleteRecord(record.cluid);
    removeEditingNote(record.cluid);
    await refreshRecords();
    setStatus(`Deleted ${record.cluid}.`);
}
async function handleSaveNote(record) {
    const note = state.editingNotes[record.cluid] ?? '';
    const updated = { ...record, note: note.trim(), lastEdited: nowIso() };
    await upsertRecord(updated);
    removeEditingNote(record.cluid);
    await refreshRecords();
    setStatus(`Updated note for ${record.cluid}.`);
}
function startEditing(record) {
    state.editingNotes = { ...state.editingNotes, [record.cluid]: record.note || '' };
    renderApp();
}
function updateImportInput(value) {
    state.importInput = value;
    renderApp();
}
const cluidPattern = /^\d{4}-\d{2}-\d{2}-\d{2}\.\d{2}\.\d{2}\.\d+$/;
function isLikelyCluid(value) {
    return cluidPattern.test(value.trim());
}
function parseImportEntries(raw) {
    const entries = new Map();
    const lines = raw.split(/\n+/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        const tokens = trimmed
            .split(/[\s,;]+/)
            .map((value) => value.trim())
            .filter(Boolean);
        const firstToken = tokens[0];
        const hasNamePortion = tokens.length >= 2 &&
            isLikelyCluid(firstToken) &&
            tokens.slice(1).some((token) => !isLikelyCluid(token));
        if (hasNamePortion && firstToken) {
            const noteStart = trimmed.indexOf(tokens[1]);
            const note = noteStart >= 0 ? trimmed.slice(noteStart).trim() : undefined;
            if (!entries.has(firstToken) || note) {
                entries.set(firstToken, note || undefined);
            }
            continue;
        }
        tokens.forEach((token) => {
            if (!entries.has(token)) {
                entries.set(token, undefined);
            }
        });
    }
    return Array.from(entries, ([cluid, note]) => ({ cluid, note }));
}
async function handleImportCluids() {
    const raw = state.importInput.trim();
    if (!raw) {
        setStatus('Provide at least one cluid to import.', 'error');
        return;
    }
    const importEntries = parseImportEntries(raw);
    if (importEntries.length === 0) {
        setStatus('No valid cluids found in the input.', 'error');
        return;
    }
    try {
        for (const { cluid, note } of importEntries) {
            const existing = await getRecord(cluid);
            const existingFormData = existing?.formData || {};
            const formDataWithCluid = { cluid, ...existingFormData };
            const resolvedNote = note ?? existing?.note ?? '';
            const record = existing
                ? {
                    ...existing,
                    formData: formDataWithCluid,
                    note: resolvedNote,
                    lastEdited: existing.lastEdited || nowIso(),
                }
                : { cluid, formData: formDataWithCluid, note: resolvedNote, lastEdited: nowIso() };
            await upsertRecord(record);
        }
        state.importInput = '';
        state.recordsOrder = importEntries.map((entry) => entry.cluid);
        await refreshRecords();
        setStatus(`Imported ${importEntries.length} cluid(s).`);
    }
    catch (error) {
        console.error(error);
        setStatus('Failed to import cluids.', 'error');
    }
}
function StatusMessage({ status }) {
    if (!status?.message)
        return null;
    return h('section', { id: 'status', className: status.type, 'aria-live': 'polite' }, status.message);
}
let draggingCluid = null;
function reorderRecords(sourceCluid, targetCluid) {
    const current = [...state.records];
    const fromIndex = current.findIndex((item) => item.cluid === sourceCluid);
    const toIndex = current.findIndex((item) => item.cluid === targetCluid);
    if (fromIndex < 0 || toIndex < 0)
        return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    state.records = current;
    state.recordsOrder = current.map((item) => item.cluid);
    renderApp();
}
async function handleFillAndRedirect(record) {
    try {
        await handleFill(record);
        await handleTriggerRedirect();
    }
    catch (error) {
        console.error(error);
        setStatus('Could not load data and redirect.', 'error');
    }
}
function RecordRow({ record, noteDraft }) {
    const isEditing = typeof noteDraft === 'string';
    const actions = isEditing
        ? [
            h('button', {
                className: 'btn btn-success',
                onClick: () => void handleFill(record),
                title: 'Fill the page with this record',
                'aria-label': 'Load record into page',
            }, '⬇️'),
            h('button', {
                className: 'btn btn-primary',
                onClick: () => void handleSaveNote(record),
                title: 'Save the note',
                'aria-label': 'Save note',
            }, '💾'),
            h('button', {
                className: 'btn btn-secondary',
                onClick: () => removeEditingNote(record.cluid),
                title: 'Cancel note editing',
                'aria-label': 'Cancel note editing',
            }, '↩️'),
            h('button', {
                className: 'btn btn-accent',
                onClick: () => void handleFillAndRedirect(record),
                title: 'Load and redirect',
                'aria-label': 'Load and redirect',
            }, '🚀'),
            h('button', {
                className: 'btn btn-danger',
                onClick: () => void handleDelete(record),
                title: 'Delete record',
                'aria-label': 'Delete record',
            }, '🗑️'),
        ]
        : [
            h('button', {
                className: 'btn btn-success',
                onClick: () => void handleFill(record),
                title: 'Fill the page with this record',
                'aria-label': 'Load record into page',
            }, '⬇️'),
            h('button', {
                className: 'btn btn-secondary',
                onClick: () => startEditing(record),
                title: 'Edit note',
                'aria-label': 'Edit note',
            }, '📝'),
            h('button', {
                className: 'btn btn-accent',
                onClick: () => void handleFillAndRedirect(record),
                title: 'Load and redirect',
                'aria-label': 'Load and redirect',
            }, '🚀'),
            h('button', {
                className: 'btn btn-danger',
                onClick: () => void handleDelete(record),
                title: 'Delete record',
                'aria-label': 'Delete record',
            }, '🗑️'),
        ];
    const noteCellContent = isEditing
        ? h('input', {
            type: 'text',
            value: noteDraft || '',
            placeholder: 'First name Last name',
            size: 24,
            onInput: (event) => updateEditingNote(record.cluid, event.target.value),
        })
        : record.note || '—';
    const productValue = getProductValue(record);
    return h('tr', {
        draggable: true,
        onDragStart: () => {
            draggingCluid = record.cluid;
        },
        onDragOver: (event) => {
            event.preventDefault();
        },
        onDrop: (event) => {
            event.preventDefault();
            if (!draggingCluid || draggingCluid === record.cluid)
                return;
            reorderRecords(draggingCluid, record.cluid);
            draggingCluid = null;
        },
        onDragEnd: () => {
            draggingCluid = null;
        },
    }, h('td', { className: 'reorder-handle', title: 'Drag to reorder' }, '☰'), h('td', { className: 'cluid' }, h('div', { className: 'cluid-value' }, record.cluid), h('div', { className: 'product-line' }, productValue)), h('td', { className: 'note' }, noteCellContent), h('td', { className: 'edited' }, new Date(record.lastEdited).toLocaleString()), h('td', { className: 'actions' }, actions));
}
function RecordsTable({ state }) {
    const rows = state.records.map((record) => h(RecordRow, { record, noteDraft: state.editingNotes[record.cluid] }));
    const bodyContent = rows.length
        ? rows
        : [h('tr', null, h('td', { colSpan: 5 }, 'No saved records yet.'))];
    return h('section', null, h(ActionLegend, null), h('table', null, h('thead', null, h('tr', null, h('th', { className: 'reorder-header', title: 'Reorder' }, '↕️'), h('th', null, 'Cluid / Product'), h('th', null, 'Note'), h('th', null, 'Last Edited'), h('th', null, 'Actions'))), h('tbody', null, bodyContent)));
}
function ActionLegend() {
    const items = [
        ['⬇️', 'Load record'],
        ['📝', 'Edit note'],
        ['💾', 'Save note'],
        ['↩️', 'Cancel editing'],
        ['🚀', 'Load and redirect'],
        ['🗑️', 'Delete record'],
    ];
    const legendItems = items.map(([emoji, label]) => h('span', { className: 'legend-item' }, h('span', { className: 'legend-emoji', 'aria-hidden': 'true' }, emoji), h('span', { className: 'legend-label' }, label)));
    return h('div', { className: 'action-legend', 'aria-label': 'Action legend' }, legendItems);
}
function App({ appState }) {
    return h(React.Fragment, null, h('header', null, h('h1', null, 'Krásný debug extension'), h('div', { className: 'header-actions' }, h('button', {
        className: 'btn btn-primary',
        onClick: () => void handleSaveCurrent(),
        title: 'Save current form',
        'aria-label': 'Save current form',
    }, 'Uložit formulář'), h('button', {
        className: 'btn btn-secondary',
        onClick: () => void handleRedirectToDebug(),
        title: 'Redirect to debug page',
        'aria-label': 'Redirect to debug page',
    }, 'Debug redirect'))), h(StatusMessage, { status: appState.status }), h(RecordsTable, { state: appState }), h('section', { className: 'importer' }, h('h2', null, 'Import cluids'), h('p', null, 'Paste cluids separated by comma, semicolon, whitespace, or provide pairs like "cluid Firstname Lastname".'), h('div', { className: 'importer-controls' }, h('textarea', {
        value: appState.importInput,
        rows: 4,
        placeholder: '8016-... John Doe\n9015-... Jane Doe',
        onInput: (event) => updateImportInput(event.target.value),
    }), h('button', { className: 'btn btn-primary', onClick: () => void handleImportCluids() }, 'Import'))));
}
const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Root container for popup not found.');
}
const root = ReactDOM.createRoot(rootElement);
function renderApp() {
    root.render(h(App, { appState: state }));
}
renderApp();
void refreshRecords();
