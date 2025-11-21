import { deleteRecord, getRecord, getRecords, nowIso, setLastActiveCluid, upsertRecord, } from './utils/storage';
const recordsTbody = document.getElementById('records');
const statusEl = document.getElementById('status');
const saveCurrentButton = document.getElementById('save-current');
function setStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = type;
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
function buildActionButton(label, onClick, title) {
    const btn = document.createElement('button');
    btn.textContent = label;
    if (title)
        btn.title = title;
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
        await renderRecords();
        setStatus(`Saved data for ${targetCluid}.`);
    }
    catch (error) {
        console.error(error);
        setStatus('Failed to save current form.', 'error');
    }
}
async function handleFill(record) {
    try {
        await fillForm(record.formData, record.cluid);
        await setLastActiveCluid(record.cluid);
        setStatus(`Loaded data for ${record.cluid} to the page.`);
    }
    catch (error) {
        console.error(error);
        setStatus('Could not load data into the page.', 'error');
    }
}
async function handleDelete(record) {
    const confirmation = confirm(`Delete stored data for ${record.cluid}?`);
    if (!confirmation)
        return;
    await deleteRecord(record.cluid);
    await renderRecords();
    setStatus(`Deleted ${record.cluid}.`);
}
async function handleEditNote(record) {
    const updatedNote = prompt('Edit note (firstname lastname):', record.note || '');
    if (updatedNote === null)
        return;
    const updated = { ...record, note: updatedNote, lastEdited: nowIso() };
    await upsertRecord(updated);
    await renderRecords();
    setStatus(`Updated note for ${record.cluid}.`);
}
function renderRecordRow(record) {
    const template = document.getElementById('record-row-template');
    const clone = template.content.firstElementChild.cloneNode(true);
    clone.querySelector('.cluid').textContent = record.cluid;
    clone.querySelector('.note').textContent = record.note || '—';
    clone.querySelector('.application').textContent = record.applicationState || '—';
    clone.querySelector('.step').textContent = record.stepCode || '—';
    clone.querySelector('.edited').textContent = new Date(record.lastEdited).toLocaleString();
    const actionsCell = clone.querySelector('.actions');
    actionsCell.append(buildActionButton('Load', () => handleFill(record), 'Fill the page with this record'), buildActionButton('Edit note', () => handleEditNote(record)), buildActionButton('Delete', () => handleDelete(record)));
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
