const STORAGE_KEY = 'cluidRecords';
const LAST_ACTIVE_KEY = 'lastActiveCluid';
async function readAll() {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return result[STORAGE_KEY] || {};
}
async function writeAll(records) {
    await chrome.storage.local.set({ [STORAGE_KEY]: records });
}
export async function getRecords() {
    const records = await readAll();
    return Object.values(records).sort((a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime());
}
export async function upsertRecord(record) {
    const records = await readAll();
    records[record.cluid] = record;
    await writeAll(records);
    await setLastActiveCluid(record.cluid);
}
export async function deleteRecord(cluid) {
    const records = await readAll();
    delete records[cluid];
    await writeAll(records);
}
export async function getRecord(cluid) {
    const records = await readAll();
    return records[cluid];
}
export async function setLastActiveCluid(cluid) {
    await chrome.storage.local.set({ [LAST_ACTIVE_KEY]: cluid });
}
export async function getLastActiveCluid() {
    const result = await chrome.storage.local.get([LAST_ACTIVE_KEY]);
    return result[LAST_ACTIVE_KEY];
}
export function nowIso() {
    return new Date().toISOString();
}
