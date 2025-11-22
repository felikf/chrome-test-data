interface MessagePayload {
  type: string;
  payload?: any;
}

function collectFormData(): { [key: string]: string } {
  const fields: { [key: string]: string } = {};
  const elements = document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');

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

function fillFormData(formData: { [key: string]: string }): void {
  Object.entries(formData).forEach(([key, value]) => {
    const selector = `[name="${CSS.escape(key)}"], #${CSS.escape(key)}`;
    const element = document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector);
    if (!element) return;
    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
      element.checked = value === 'true';
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    if (element instanceof HTMLInputElement && element.type === 'hidden') {
      const parentButton = element.closest('button');
      const labelSpan = parentButton?.querySelector('span');
      if (labelSpan) {
        labelSpan.textContent = value;
      }
    }
  });
}

function getCluidValue(formData: { [key: string]: string }): string | undefined {
  return formData['cluid'] || formData['Cluid'] || undefined;
}

function clickRedirectButton(): boolean {
  const redirectByDataCy = document.querySelector<HTMLButtonElement>('button[data-cy="submit"]');
  if (redirectByDataCy) {
    redirectByDataCy.click();
    return true;
  }

  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button')); // includes g-button component root
  const redirectByText = buttons.find((btn) => /redirect/i.test(btn.textContent || ''));
  if (redirectByText) {
    redirectByText.click();
    return true;
  }

  return false;
}

chrome.runtime.onMessage.addListener((message: MessagePayload, _sender, sendResponse) => {
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

  if (message.type === 'trigger-redirect') {
    const clicked = clickRedirectButton();
    sendResponse({ clicked });
    return true;
  }

  return false;
});
