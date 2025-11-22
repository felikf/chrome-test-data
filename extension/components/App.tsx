import { React } from '../utils/reactGlobals.js';
import type { AppState } from '../appState.js';
import type { CluidRecord } from '../utils/storage.js';
import { RecordsTable } from './RecordsTable.js';
import { StatusMessage } from './StatusMessage.js';

type AppProps = {
  state: AppState;
  onSaveCurrent(): void;
  onRedirectToDebug(): void;
  onFill(record: CluidRecord): void;
  onStartEditing(record: CluidRecord): void;
  onSaveNote(record: CluidRecord): void;
  onCancelEditing(cluid: string): void;
  onFillAndRedirect(record: CluidRecord): void;
  onDelete(record: CluidRecord): void;
  onNoteChange(cluid: string, value: string): void;
  onImportCluids(): void;
  onUpdateImportInput(value: string): void;
  onResolveProductLabel(record: CluidRecord): string;
  onStartDrag(cluid: string): void;
  onDropOn(targetCluid: string): void;
  onDragEnd(): void;
};

export function App({
  state,
  onSaveCurrent,
  onRedirectToDebug,
  onFill,
  onStartEditing,
  onSaveNote,
  onCancelEditing,
  onFillAndRedirect,
  onDelete,
  onNoteChange,
  onImportCluids,
  onUpdateImportInput,
  onResolveProductLabel,
  onStartDrag,
  onDropOn,
  onDragEnd,
}: AppProps) {
  return (
    <React.Fragment>
      <header>
        <h1>Krásný debug extension</h1>
        <div className="header-actions">
          <button
            className="btn btn-primary"
            onClick={() => void onSaveCurrent()}
            title="Save current form"
            aria-label="Save current form"
          >
            Uložit formulář
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => void onRedirectToDebug()}
            title="Redirect to debug page"
            aria-label="Redirect to debug page"
          >
            Debug redirect
          </button>
        </div>
      </header>

      <StatusMessage status={state.status} />

      <RecordsTable
        state={state}
        resolveProductLabel={onResolveProductLabel}
        onFill={onFill}
        onStartEditing={onStartEditing}
        onSaveNote={onSaveNote}
        onCancelEditing={onCancelEditing}
        onFillAndRedirect={onFillAndRedirect}
        onDelete={onDelete}
        onNoteChange={onNoteChange}
        onStartDrag={onStartDrag}
        onDropOn={onDropOn}
        onDragEnd={onDragEnd}
      />

      <section className="importer">
        <h2>Import cluids</h2>
        <p>
          Paste cluids separated by comma, semicolon, whitespace, or provide pairs like
          "cluid Firstname Lastname".
        </p>
        <div className="importer-controls">
          <textarea
            value={state.importInput}
            rows={4}
            placeholder={'8016-... John Doe\n9015-... Jane Doe'}
            onInput={(event) => onUpdateImportInput((event.target as HTMLTextAreaElement).value)}
          />
          <button className="btn btn-primary" onClick={() => void onImportCluids()}>
            Import
          </button>
        </div>
      </section>
    </React.Fragment>
  );
}
