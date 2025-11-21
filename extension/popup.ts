import {
  CluidRecord,
  deleteRecord,
  getRecord,
  getRecords,
  nowIso,
  setLastActiveCluid,
  upsertRecord,
} from './utils/storage';

const recordsTbody = document.getElementById('records') as HTMLTableSectionElement;
const statusEl = document.getElementById('status') as HTMLElement;
const saveCurrentButton = document.getElementById('save-current') as HTMLButtonElement;

function setStatus(message: string, type: 'info' | 'error' = 'info') {
  statusEl.textContent = message;
  statusEl.className = type;
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

function buildActionButton(label: string, onClick: () => void, title?: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  if (title) btn.title = title;
  btn.addEventListener('click', onClick);
  return btn;
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
    await renderRecords();
    setStatus(`Saved data for ${targetCluid}.`);
  } catch (error) {
    console.error(error);
    setStatus('Failed to save current form.', 'error');
  }
}

async function handleFill(record: CluidRecord) {
  try {
    await fillForm(record.formData, record.cluid);
    await setLastActiveCluid(record.cluid);
    setStatus(`Loaded data for ${record.cluid} to the page.`);
  } catch (error) {
    console.error(error);
    setStatus('Could not load data into the page.', 'error');
  }
}

async function handleDelete(record: CluidRecord) {
  const confirmation = confirm(`Delete stored data for ${record.cluid}?`);
  if (!confirmation) return;
  await deleteRecord(record.cluid);
  await renderRecords();
  setStatus(`Deleted ${record.cluid}.`);
}

async function handleEditNote(record: CluidRecord) {
  const updatedNote = prompt('Edit note (firstname lastname):', record.note || '');
  if (updatedNote === null) return;
  const updated: CluidRecord = { ...record, note: updatedNote, lastEdited: nowIso() };
  await upsertRecord(updated);
  await renderRecords();
  setStatus(`Updated note for ${record.cluid}.`);
}

function renderRecordRow(record: CluidRecord): HTMLTableRowElement {
  const template = document.getElementById('record-row-template') as HTMLTemplateElement;
  const clone = template.content.firstElementChild!.cloneNode(true) as HTMLTableRowElement;
  (clone.querySelector('.cluid') as HTMLElement).textContent = record.cluid;
  (clone.querySelector('.note') as HTMLElement).textContent = record.note || '—';
  (clone.querySelector('.application') as HTMLElement).textContent = record.applicationState || '—';
  (clone.querySelector('.step') as HTMLElement).textContent = record.stepCode || '—';
  (clone.querySelector('.edited') as HTMLElement).textContent = new Date(record.lastEdited).toLocaleString();

  const actionsCell = clone.querySelector('.actions') as HTMLElement;
  actionsCell.append(
    buildActionButton('Load', () => handleFill(record), 'Fill the page with this record'),
    buildActionButton('Edit note', () => handleEditNote(record)),
    buildActionButton('Delete', () => handleDelete(record))
  );

  return clone;
}

async function renderRecords() {
  const records = await getRecords();
  recordsTbody.innerHTML = '';
  records.forEach((record) => recordsTbody.appendChild(renderRecordRow(record)));
  if (records.length === 0) {
    const emptyRow = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = 'No saved records yet.';
    emptyRow.appendChild(cell);
    recordsTbody.appendChild(emptyRow);
  }
}

function init() {
  renderRecords();
  saveCurrentButton.addEventListener('click', handleSaveCurrent);
}

document.addEventListener('DOMContentLoaded', init);
