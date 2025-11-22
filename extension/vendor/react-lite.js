(function (global) {
  const Fragment = Symbol('Fragment');

  function createElement(type, props, ...rawChildren) {
    const children = rawChildren.flat();
    return { type, props: props || {}, children };
  }

  function toTextNode(value) {
    return document.createTextNode(value == null ? '' : String(value));
  }

  function applyProps(element, props) {
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'children' || value === undefined || value === null) return;
      if (key === 'className') {
        element.setAttribute('class', value);
        return;
      }
      if (key === 'htmlFor') {
        element.setAttribute('for', value);
        return;
      }
      if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
        return;
      }
      if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value);
        return;
      }
      const target = element;
      if (key in target) {
        try {
          target[key] = value;
          return;
        } catch (error) {
          // fall through to attribute
        }
      }
      element.setAttribute(key, value);
    });
  }

  function createDomNode(node) {
    if (node === null || node === undefined || typeof node === 'boolean') {
      return toTextNode('');
    }
    if (typeof node === 'string' || typeof node === 'number') {
      return toTextNode(node);
    }
    if (Array.isArray(node)) {
      const fragment = document.createDocumentFragment();
      node.forEach((child) => fragment.appendChild(createDomNode(child)));
      return fragment;
    }
    const { type, props, children } = node;
    if (type === Fragment) {
      const fragment = document.createDocumentFragment();
      (children || []).forEach((child) => fragment.appendChild(createDomNode(child)));
      return fragment;
    }
    if (typeof type === 'function') {
      return createDomNode(type({ ...(props || {}), children }));
    }

    const element = document.createElement(type);
    applyProps(element, props || {});
    (children || []).forEach((child) => element.appendChild(createDomNode(child)));
    return element;
  }

  function createRoot(container) {
    return {
      render(element) {
        container.replaceChildren(createDomNode(element));
      },
    };
  }

  global.React = { createElement, Fragment };
  global.ReactDOM = { createRoot };
})(globalThis);
