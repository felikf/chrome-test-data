import { React, ReactDOM } from './utils/reactGlobals.js';
import {
  CluidRecord,
  deleteRecord,
  getRecord,
  getRecords,
  nowIso,
  setLastActiveCluid,
  upsertRecord,
} from './utils/storage.js';
import { AppState, ImportEntry, StatusState } from './appState.js';
import { App } from './components/App.js';

const state: AppState = {
  records: [],
  status: null,
  editingNotes: {},
  importInput: '',
  recordsOrder: [],
};

let draggingCluid: string | null = null;

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

  const channelProduct = record.formData?.['channelProduct'] || record.formData?.['ChannelProduct'];

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
  const preferredOrder = state.recordsOrder;
  const recordMap = new Map(records.map((record) => [record.cluid, record]));
  const orderedRecords: CluidRecord[] = [];

  preferredOrder.forEach((cluid) => {
    const record = recordMap.get(cluid);
    if (record) {
      orderedRecords.push(record);
      recordMap.delete(cluid);
    }
  });

  const remaining = Array.from(recordMap.values()).sort(
    (a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime(),
  );

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

async function handleRedirectToDebug() {
  try {
    const tab = await getActiveTab();
    if (!tab.url) {
      setStatus('Active tab has no URL.', 'error');
      return;
    }

    const origin = new URL(tab.url).origin;
    const targetUrl = `${origin}/loan/debug/?cluid=123&idpOrigin=TOKEN_EXTRACTION_local&environment=INT#access_token=saf`;

    await chrome.tabs.update(tab.id!, { url: targetUrl });
    setStatus('Redirecting to debug page...');
  } catch (error) {
    console.error(error);
    setStatus('Failed to redirect to debug page.', 'error');
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
  state.recordsOrder = state.recordsOrder.filter((cluid) => cluid !== record.cluid);
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

const cluidPattern = /^\d{4}-\d{2}-\d{2}-\d{2}\.\d{2}\.\d{2}\.\d+$/;

function isLikelyCluid(value: string): boolean {
  return cluidPattern.test(value.trim());
}

function parseImportEntries(raw: string): ImportEntry[] {
  const entries = new Map<string, string | undefined>();
  const lines = raw.split(/\n+/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const tokens = trimmed
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    const firstToken = tokens[0];
    const hasNamePortion =
      tokens.length >= 2 &&
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
      const record: CluidRecord = existing
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
  } catch (error) {
    console.error(error);
    setStatus('Failed to import cluids.', 'error');
  }
}

function reorderRecords(sourceCluid: string, targetCluid: string) {
  const current = [...state.records];
  const fromIndex = current.findIndex((item) => item.cluid === sourceCluid);
  const toIndex = current.findIndex((item) => item.cluid === targetCluid);
  if (fromIndex < 0 || toIndex < 0) return;

  const [moved] = current.splice(fromIndex, 1);
  current.splice(toIndex, 0, moved);

  state.records = current;
  state.recordsOrder = current.map((item) => item.cluid);
  renderApp();
}

async function handleFillAndRedirect(record: CluidRecord) {
  try {
    await handleFill(record);
    await handleTriggerRedirect();
  } catch (error) {
    console.error(error);
    setStatus('Could not load data and redirect.', 'error');
  }
}

function handleStartDrag(cluid: string) {
  draggingCluid = cluid;
}

function handleDropOn(targetCluid: string) {
  if (!draggingCluid || draggingCluid === targetCluid) return;
  reorderRecords(draggingCluid, targetCluid);
  draggingCluid = null;
}

function handleDragEnd() {
  draggingCluid = null;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root container for popup not found.');
}

const root = ReactDOM.createRoot(rootElement);

function renderApp() {
  root.render(
    <App
      state={state}
      onSaveCurrent={handleSaveCurrent}
      onRedirectToDebug={handleRedirectToDebug}
      onFill={handleFill}
      onStartEditing={startEditing}
      onSaveNote={handleSaveNote}
      onCancelEditing={removeEditingNote}
      onFillAndRedirect={handleFillAndRedirect}
      onDelete={handleDelete}
      onNoteChange={updateEditingNote}
      onImportCluids={handleImportCluids}
      onUpdateImportInput={updateImportInput}
      onResolveProductLabel={getProductValue}
      onStartDrag={handleStartDrag}
      onDropOn={handleDropOn}
      onDragEnd={handleDragEnd}
    />
  );
}

renderApp();
void refreshRecords();
