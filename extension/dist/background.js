import { getLastActiveCluid, getRecord, setLastActiveCluid, upsertRecord, nowIso } from './utils/storage.js';
async function updateRecord(partial) {
    const cluid = await getLastActiveCluid();
    if (!cluid)
        return;
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
const requestFilter = { urls: ['https://localhost:7994/*', 'https://www.csast.csas.cz/*'] };
function isExtensionInitiated(details) {
    return details.initiator?.startsWith('chrome-extension://');
}
chrome.webRequest.onBeforeRequest.addListener((details) => {
    if (isExtensionInitiated(details))
        return;
    const url = new URL(details.url);
    if (!url.pathname.includes('/loans/my/applications'))
        return;
    const filter = chrome.webRequest.filterResponseData(details.requestId);
    const decoder = new TextDecoder('utf-8');
    let responseBody = '';
    filter.ondata = (event) => {
        responseBody += decoder.decode(event.data, { stream: true });
        filter.write(event.data);
    };
    filter.onstop = async () => {
        responseBody += decoder.decode();
        try {
            const payload = JSON.parse(responseBody);
            if (url.pathname.endsWith('/basicdata') && payload.firstname && payload.lastname) {
                const note = `${payload.firstname} ${payload.lastname}`.trim();
                await updateRecord({ note });
            }
            if (url.pathname.endsWith('/step') && payload.step?.code) {
                await updateRecord({
                    applicationState: payload.applicationState,
                    stepCode: payload.step.code,
                });
            }
        }
        catch (error) {
            console.warn('Failed to parse response payload', error);
        }
        filter.disconnect();
    };
}, requestFilter, ['blocking']);
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'set-last-active' && typeof message.cluid === 'string') {
        setLastActiveCluid(message.cluid).then(() => sendResponse({ status: 'ok' }));
        return true;
    }
    return false;
});
