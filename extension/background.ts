import { CluidRecord, getLastActiveCluid, getRecord, setLastActiveCluid, upsertRecord, nowIso } from './utils/storage.js';

function parseJsonBody(details: chrome.webRequest.WebRequestBodyDetails): any | undefined {
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

async function fetchJson(url: string): Promise<any | undefined> {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return undefined;
    return await response.json();
  } catch (error) {
    console.warn('Failed to fetch request payload', error);
    return undefined;
  }
}

async function updateRecord(partial: Partial<CluidRecord>): Promise<void> {
  const cluid = await getLastActiveCluid();
  if (!cluid) return;
  const existing = (await getRecord(cluid)) || {
    cluid,
    formData: {},
    note: '',
    lastEdited: nowIso(),
  };
  const updated: CluidRecord = {
    ...existing,
    ...partial,
    lastEdited: nowIso(),
  };
  await upsertRecord(updated);
}

const requestFilter = { urls: ['https://localhost:7994/*', 'https://www.csast.csas.cz/*'] };

function isExtensionInitiated(details: chrome.webRequest.WebRequestBodyDetails | chrome.webRequest.WebResponseDetails) {
  return details.initiator?.startsWith('chrome-extension://');
}

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (isExtensionInitiated(details)) return;
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
  requestFilter,
  ['requestBody'],
);

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    if (isExtensionInitiated(details) || details.statusCode < 200 || details.statusCode >= 300) {
      return;
    }

    const url = new URL(details.url);
    if (!url.pathname.includes('/loans/my/applications')) return;

    if (url.pathname.endsWith('/basicdata')) {
      const payload = await fetchJson(details.url);
      if (payload?.firstname && payload?.lastname) {
        const note = `${payload.firstname} ${payload.lastname}`.trim();
        await updateRecord({ note });
      }
      return;
    }

    if (url.pathname.endsWith('/step')) {
      const payload = await fetchJson(details.url);
      if (payload?.step?.code) {
        await updateRecord({
          applicationState: payload.applicationState,
          stepCode: payload.step.code,
        });
      }
    }
  },
  requestFilter,
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'set-last-active' && typeof message.cluid === 'string') {
    setLastActiveCluid(message.cluid).then(() => sendResponse({ status: 'ok' }));
    return true;
  }
  return false;
});
