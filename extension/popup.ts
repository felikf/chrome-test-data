import {
  CluidRecord,
  deleteRecord,
  getRecord,
  getRecords,
  nowIso,
  setLastActiveCluid,
  upsertRecord,
} from './utils/storage.js';

type StatusState = { message: string; type: 'info' | 'error' };
type AppState = {
  records: CluidRecord[];
  status: StatusState | null;
  editingNotes: Record<string, string>;
  importInput: string;
};

declare const React: {
  createElement: (type: any, props?: Record<string, unknown> | null, ...children: any[]) => any;
  Fragment: symbol;
};

declare const ReactDOM: {
  createRoot: (container: Element | DocumentFragment) => { render: (element: any) => void };
};

const h = React.createElement;

const state: AppState = {
  records: [],
  status: null,
  editingNotes: {},
  importInput: '',
};

function setStatus(message: string, type: StatusState['type'] = 'info') {
  state.status = { message, type };
  renderApp();
}

function getProductValue(record: CluidRecord): string {
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

  const channelProduct =
    record.formData?.['channelProduct'] || record.formData?.['ChannelProduct'];

  if (productValue && channelProduct && channelProduct !== productValue) {
    return `${productValue} / ${channelProduct}`;
  }

  if (productValue) return productValue;
  if (channelProduct) return channelProduct;
  return '—';
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab found');
  }
  return tab;
}

async function collectCurrentForm(): Promise<{ formData: Record<string, string>; cluid?: string }> {
  const tab = await getActiveTab();
  const response = await chrome.tabs.sendMessage(tab.id!, { type: 'collect-form-data' });
  return response || { formData: {} };
}

async function fillForm(formData: Record<string, string>, cluid: string) {
  const tab = await getActiveTab();
  await chrome.tabs.sendMessage(tab.id!, { type: 'fill-form-data', payload: { formData } });
  await setLastActiveCluid(cluid);
}

function updateEditingNote(cluid: string, value: string) {
  state.editingNotes = { ...state.editingNotes, [cluid]: value };
  renderApp();
}

function removeEditingNote(cluid: string) {
  const { [cluid]: _removed, ...rest } = state.editingNotes;
  state.editingNotes = rest;
  renderApp();
}

async function refreshRecords() {
  const records = await getRecords();
  state.records = records.sort((a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime());
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
    const record: CluidRecord = {
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
  } catch (error) {
    console.error(error);
    setStatus('Failed to save current form.', 'error');
  }
}

async function handleTriggerRedirect() {
  try {
    const tab = await getActiveTab();
    const response = await chrome.tabs.sendMessage(tab.id!, { type: 'trigger-redirect' });
    if (response?.clicked) {
      setStatus('Clicked Redirect on the page.');
    } else {
      setStatus('Redirect button was not found on the page.', 'error');
    }
  } catch (error) {
    console.error(error);
    setStatus('Failed to trigger redirect on the page.', 'error');
  }
}

async function handleFill(record: CluidRecord) {
  try {
    await fillForm(record.formData, record.cluid);
    await setLastActiveCluid(record.cluid);
    setStatus(`Loaded full form data for ${record.cluid} to the page.`);
  } catch (error) {
    console.error(error);
    setStatus('Could not load data into the page.', 'error');
  }
}

async function handleDelete(record: CluidRecord) {
  const confirmation = confirm(`Delete stored data for ${record.cluid}?`);
  if (!confirmation) return;
  await deleteRecord(record.cluid);
  removeEditingNote(record.cluid);
  await refreshRecords();
  setStatus(`Deleted ${record.cluid}.`);
}

async function handleSaveNote(record: CluidRecord) {
  const note = state.editingNotes[record.cluid] ?? '';
  const updated: CluidRecord = { ...record, note: note.trim(), lastEdited: nowIso() };
  await upsertRecord(updated);
  removeEditingNote(record.cluid);
  await refreshRecords();
  setStatus(`Updated note for ${record.cluid}.`);
}

function startEditing(record: CluidRecord) {
  state.editingNotes = { ...state.editingNotes, [record.cluid]: record.note || '' };
  renderApp();
}

function updateImportInput(value: string) {
  state.importInput = value;
  renderApp();
}

async function handleImportCluids() {
  const raw = state.importInput.trim();
  if (!raw) {
    setStatus('Provide at least one cluid to import.', 'error');
    return;
  }

  const uniqueCluids = Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  if (uniqueCluids.length === 0) {
    setStatus('No valid cluids found in the input.', 'error');
    return;
  }

  try {
    for (const cluid of uniqueCluids) {
      const existing = await getRecord(cluid);
      const existingFormData = existing?.formData || {};
      const formDataWithCluid = { cluid, ...existingFormData };
      const record: CluidRecord = existing
        ? {
            ...existing,
            formData: formDataWithCluid,
            lastEdited: existing.lastEdited || nowIso(),
          }
        : { cluid, formData: formDataWithCluid, note: '', lastEdited: nowIso() };

      await upsertRecord(record);
    }

    state.importInput = '';
    await refreshRecords();
    setStatus(`Imported ${uniqueCluids.length} cluid(s).`);
  } catch (error) {
    console.error(error);
    setStatus('Failed to import cluids.', 'error');
  }
}

function StatusMessage({ status }: { status: StatusState | null }) {
  if (!status?.message) return null;
  return h('section', { id: 'status', className: status.type, 'aria-live': 'polite' }, status.message);
}

function RecordRow({ record, noteDraft }: { record: CluidRecord; noteDraft?: string }) {
  const isEditing = typeof noteDraft === 'string';
  const actions = isEditing
    ? [
        h(
          'button',
          {
            className: 'btn btn-success',
            onClick: () => void handleFill(record),
            title: 'Fill the page with this record',
          },
          'Load'
        ),
        h(
          'button',
          { className: 'btn btn-primary', onClick: () => void handleSaveNote(record) },
          'Save'
        ),
        h(
          'button',
          { className: 'btn btn-secondary', onClick: () => removeEditingNote(record.cluid) },
          'Cancel'
        ),
        h(
          'button',
          { className: 'btn btn-danger', onClick: () => void handleDelete(record) },
          'Delete'
        ),
      ]
    : [
        h(
          'button',
          {
            className: 'btn btn-success',
            onClick: () => void handleFill(record),
            title: 'Fill the page with this record',
          },
          'Load'
        ),
        h(
          'button',
          { className: 'btn btn-secondary', onClick: () => startEditing(record) },
          'Edit note'
        ),
        h(
          'button',
          { className: 'btn btn-danger', onClick: () => void handleDelete(record) },
          'Delete'
        ),
      ];

  const noteCellContent = isEditing
    ? h('input', {
        type: 'text',
        value: noteDraft || '',
        placeholder: 'First name Last name',
        size: 24,
        onInput: (event: Event) => updateEditingNote(record.cluid, (event.target as HTMLInputElement).value),
      })
    : record.note || '—';

  return h(
    'tr',
    null,
    h('td', { className: 'cluid' }, record.cluid),
    h('td', { className: 'note' }, noteCellContent),
    h('td', { className: 'product' }, getProductValue(record)),
    h('td', { className: 'edited' }, new Date(record.lastEdited).toLocaleString()),
    h('td', { className: 'actions' }, actions)
  );
}

function RecordsTable({ state }: { state: AppState }) {
  const rows = state.records.map((record) =>
    h(RecordRow, { record, noteDraft: state.editingNotes[record.cluid] })
  );

  const bodyContent = rows.length
    ? rows
    : [h('tr', null, h('td', { colSpan: 5 }, 'No saved records yet.'))];

  return h(
    'section',
    null,
    h(
      'table',
      null,
      h(
        'thead',
        null,
        h(
          'tr',
          null,
          h('th', null, 'Cluid'),
          h('th', null, 'Note'),
          h('th', null, 'Product'),
          h('th', null, 'Last Edited'),
          h('th', null, 'Actions')
        )
      ),
      h('tbody', null, bodyContent)
    )
  );
}

function App({ appState }: { appState: AppState }) {
  return h(
    React.Fragment,
    null,
    h(
      'header',
      null,
      h('h1', null, 'Loan Debug Helper'),
      h('div', { className: 'header-actions' }, [
        h(
          'button',
          { className: 'btn btn-primary', onClick: () => void handleSaveCurrent() },
          '💾 Save current form'
        ),
        h(
          'button',
          { className: 'btn btn-accent', onClick: () => void handleTriggerRedirect() },
          'Redirect'
        ),
      ])
    ),
    h(
      'section',
      { className: 'importer' },
      h('h2', null, 'Import cluids'),
      h('p', null, 'Paste cluids separated by comma, semicolon, or whitespace.'),
      h(
        'div',
        { className: 'importer-controls' },
        h('textarea', {
          value: appState.importInput,
          rows: 3,
          placeholder: 'cluid-one, cluid-two; cluid-three',
          onInput: (event: Event) => updateImportInput((event.target as HTMLTextAreaElement).value),
        }),
        h(
          'button',
          { className: 'btn btn-primary', onClick: () => void handleImportCluids() },
          'Import'
        )
      )
    ),
    h(StatusMessage, { status: appState.status }),
    h(RecordsTable, { state: appState })
  );
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
