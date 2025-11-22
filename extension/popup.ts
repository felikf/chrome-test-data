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

function getProductValue(record: CluidRecord): string {
  const candidates = ['product', 'Product', 'productName', 'ProductName'];
  for (const key of candidates) {
    const value = record.formData?.[key];
    if (value) return value;
  }
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
  await renderRecords();
  setStatus(`Deleted ${record.cluid}.`);
}

function renderRecordRow(record: CluidRecord): HTMLTableRowElement {
  const template = document.getElementById('record-row-template') as HTMLTemplateElement;
  const clone = template.content.firstElementChild!.cloneNode(true) as HTMLTableRowElement;
  (clone.querySelector('.cluid') as HTMLElement).textContent = record.cluid;
  (clone.querySelector('.note') as HTMLElement).textContent = record.note || '—';
  (clone.querySelector('.product') as HTMLElement).textContent = getProductValue(record);
  (clone.querySelector('.edited') as HTMLElement).textContent = new Date(record.lastEdited).toLocaleString();

  const actionsCell = clone.querySelector('.actions') as HTMLElement;
  const startInlineEdit = () => {
    const noteCell = clone.querySelector('.note') as HTMLElement;
    const currentValue = record.note || '';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.placeholder = 'First name Last name';
    input.size = 24;

    noteCell.textContent = '';
    noteCell.appendChild(input);

    const saveButton = buildActionButton('Save', async () => {
      const updated: CluidRecord = { ...record, note: input.value.trim(), lastEdited: nowIso() };
      await upsertRecord(updated);
      await renderRecords();
      setStatus(`Updated note for ${record.cluid}.`);
    });

    const cancelButton = buildActionButton('Cancel', () => renderRecords());

    actionsCell.replaceChildren(
      buildActionButton('Load', () => handleFill(record), 'Fill the page with this record'),
      saveButton,
      cancelButton,
      buildActionButton('Delete', () => handleDelete(record))
    );

    input.focus();
  };

  actionsCell.append(
    buildActionButton('Load', () => handleFill(record), 'Fill the page with this record'),
    buildActionButton('Edit note', startInlineEdit),
    buildActionButton('Delete', () => handleDelete(record))
  );

  return clone;
}

async function renderRecords() {
  const records = await getRecords();
  recordsTbody.innerHTML = '';
  records
    .sort((a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime())
    .forEach((record) => recordsTbody.appendChild(renderRecordRow(record)));
  if (records.length === 0) {
    const emptyRow = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
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
