import type ReactType from 'react';
import type ReactDOMClient from 'react-dom/client';

interface ReactLiteGlobals {
  React: ReactType;
  ReactDOM: ReactDOMClient;
}

const globalScope = globalThis as typeof globalThis & Partial<ReactLiteGlobals>;

if (!globalScope.React || !globalScope.ReactDOM) {
  throw new Error('React globals are not available. Ensure vendor/react-lite.js is loaded first.');
}

export const React = globalScope.React;
export const ReactDOM = globalScope.ReactDOM;
