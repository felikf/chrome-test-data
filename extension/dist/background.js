import { getLastActiveCluid, getRecord, setLastActiveCluid, upsertRecord, nowIso } from './utils/storage.js';

function parseJsonBody(details) {
  const raw = details.requestBody?.raw?.[0]?.bytes;
  if (!raw) return undefined;
  try {
    const decoded = new TextDecoder('utf-8').decode(raw);
    return JSON.parse(decoded);
  } catch (error) {
    console.warn('Failed to parse request body', error);
    return undefined;
  }
}

async function updateRecord(partial) {
  const cluid = await getLastActiveCluid();
  if (!cluid) return;
  const existing = (await getRecord(cluid)) || {
    cluid,
    formData: {},
    note: '',
    lastEdited: nowIso(),
  };
  const updated = {
    ...existing,
    ...partial,
    lastEdited: nowIso(),
  };
  await upsertRecord(updated);
}

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    const url = new URL(details.url);
    if (!url.pathname.includes('/loans/my/applications')) return;
    const body = parseJsonBody(details);
    if (!body) return;

    if (url.pathname.endsWith('/basicdata') && body.firstname && body.lastname) {
      const note = `${body.firstname} ${body.lastname}`.trim();
      await updateRecord({ note });
    }

    if (url.pathname.endsWith('/step') && body.step?.code) {
      await updateRecord({
        applicationState: body.applicationState,
        stepCode: body.step.code,
      });
    }
  },
  { urls: ['https://localhost:7994/*'] },
  ['requestBody']
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'set-last-active' && typeof message.cluid === 'string') {
    setLastActiveCluid(message.cluid).then(() => sendResponse({ status: 'ok' }));
    return true;
  }
  return false;
});
