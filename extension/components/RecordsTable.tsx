import { React } from '../utils/reactGlobals.js';
import type { AppState } from '../appState.js';
import type { CluidRecord } from '../utils/storage.js';
import { ActionLegend } from './ActionLegend.js';
import { RecordRow } from './RecordRow.js';

type RecordsTableProps = {
  state: AppState;
  resolveProductLabel(record: CluidRecord): string;
  onFill(record: CluidRecord): void;
  onStartEditing(record: CluidRecord): void;
  onSaveNote(record: CluidRecord): void;
  onCancelEditing(cluid: string): void;
  onFillAndRedirect(record: CluidRecord): void;
  onDelete(record: CluidRecord): void;
  onNoteChange(cluid: string, value: string): void;
  onStartDrag(cluid: string): void;
  onDropOn(targetCluid: string): void;
  onDragEnd(): void;
};

export function RecordsTable({
  state,
  resolveProductLabel,
  onFill,
  onStartEditing,
  onSaveNote,
  onCancelEditing,
  onFillAndRedirect,
  onDelete,
  onNoteChange,
  onStartDrag,
  onDropOn,
  onDragEnd,
}: RecordsTableProps) {
  const rows = state.records.map((record) => (
    <RecordRow
      key={record.cluid}
      record={record}
      noteDraft={state.editingNotes[record.cluid]}
      productLabel={resolveProductLabel(record)}
      onFill={onFill}
      onStartEditing={onStartEditing}
      onSaveNote={onSaveNote}
      onCancelEditing={onCancelEditing}
      onFillAndRedirect={onFillAndRedirect}
      onDelete={onDelete}
      onNoteChange={onNoteChange}
      onDragStart={onStartDrag}
      onDragDrop={onDropOn}
      onDragEnd={onDragEnd}
    />
  ));

  const bodyContent = rows.length ? (
    rows
  ) : (
    <tr>
      <td colSpan={5}>No saved records yet.</td>
    </tr>
  );

  return (
    <section>
      <ActionLegend />
      <table>
        <thead>
          <tr>
            <th className="reorder-header" title="Reorder">
              ↕️
            </th>
            <th>Cluid / Product</th>
            <th>Note</th>
            <th>Last Edited</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>{bodyContent}</tbody>
      </table>
    </section>
  );
}
