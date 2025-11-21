function collectFormData() {
  const fields = {};
  const elements = document.querySelectorAll('input, select, textarea');

  elements.forEach((el) => {
    const name = el.name || el.id;
    if (!name) return;
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      fields[name] = el.checked ? 'true' : 'false';
    } else {
      fields[name] = el.value;
    }
  });
  return fields;
}

function fillFormData(formData) {
  Object.entries(formData).forEach(([key, value]) => {
    const selector = `[name="${CSS.escape(key)}"], #${CSS.escape(key)}`;
    const element = document.querySelector(selector);
    if (!element) return;
    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
      element.checked = value === 'true';
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function getCluidValue(formData) {
  return formData['cluid'] || formData['Cluid'] || undefined;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'collect-form-data') {
    const formData = collectFormData();
    const cluid = getCluidValue(formData);
    sendResponse({ formData, cluid });
    return true;
  }

  if (message.type === 'fill-form-data') {
    fillFormData(message.payload.formData || {});
    sendResponse({ status: 'filled' });
    return true;
  }

  return false;
});
