import { React } from '../utils/reactGlobals.js';
import type { StatusState } from '../appState.js';

type StatusMessageProps = {
  status: StatusState | null;
};

export function StatusMessage({ status }: StatusMessageProps) {
  if (!status?.message) return null;

  return (
    <section id="status" className={status.type} aria-live="polite">
      {status.message}
    </section>
  );
}
