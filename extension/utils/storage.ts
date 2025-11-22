export interface CluidRecord {
  cluid: string;
  formData: { [key: string]: string };
  note: string;
  applicationState?: string;
  stepCode?: string;
  lastEdited: string;
}

const STORAGE_KEY = 'cluidRecords';
const LAST_ACTIVE_KEY = 'lastActiveCluid';

async function readAll(): Promise<Record<string, CluidRecord>> {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  return (result[STORAGE_KEY] as Record<string, CluidRecord>) || {};
}

async function writeAll(records: Record<string, CluidRecord>): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: records });
}

export async function getRecords(): Promise<CluidRecord[]> {
  const records = await readAll();
  return Object.values(records).sort(
    (a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime(),
  );
}

export async function upsertRecord(record: CluidRecord): Promise<void> {
  const records = await readAll();
  records[record.cluid] = record;
  await writeAll(records);
  await setLastActiveCluid(record.cluid);
}

export async function deleteRecord(cluid: string): Promise<void> {
  const records = await readAll();
  delete records[cluid];
  await writeAll(records);
}

export async function getRecord(cluid: string): Promise<CluidRecord | undefined> {
  const records = await readAll();
  return records[cluid];
}

export async function setLastActiveCluid(cluid: string): Promise<void> {
  await chrome.storage.local.set({ [LAST_ACTIVE_KEY]: cluid });
}

export async function getLastActiveCluid(): Promise<string | undefined> {
  const result = await chrome.storage.local.get([LAST_ACTIVE_KEY]);
  return result[LAST_ACTIVE_KEY] as string | undefined;
}

export function nowIso(): string {
  return new Date().toISOString();
}
