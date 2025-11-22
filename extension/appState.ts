import type { CluidRecord } from './utils/storage.js';

export type StatusState = { message: string; type: 'info' | 'error' };

export type AppState = {
  records: CluidRecord[];
  status: StatusState | null;
  editingNotes: Record<string, string>;
  importInput: string;
  recordsOrder: string[];
};

export type ImportEntry = { cluid: string; note?: string };
