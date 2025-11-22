import { React } from '../utils/reactGlobals.js';
import type { CluidRecord } from '../utils/storage.js';

type DragHandlers = {
  onDragStart(cluid: string): void;
  onDragDrop(targetCluid: string): void;
  onDragEnd(): void;
};

export type RecordRowProps = {
  record: CluidRecord;
  noteDraft?: string;
  productLabel: string;
  onFill(record: CluidRecord): void;
  onStartEditing(record: CluidRecord): void;
  onSaveNote(record: CluidRecord): void;
  onCancelEditing(cluid: string): void;
  onFillAndRedirect(record: CluidRecord): void;
  onDelete(record: CluidRecord): void;
  onNoteChange(cluid: string, value: string): void;
} & DragHandlers;

export function RecordRow({
  record,
  noteDraft,
  productLabel,
  onFill,
  onStartEditing,
  onSaveNote,
  onCancelEditing,
  onFillAndRedirect,
  onDelete,
  onNoteChange,
  onDragStart,
  onDragDrop,
  onDragEnd,
}: RecordRowProps) {
  const isEditing = typeof noteDraft === 'string';

  const actions = isEditing
    ? [
        <button
          key="fill"
          className="btn btn-success"
          onClick={() => void onFill(record)}
          title="Fill the page with this record"
          aria-label="Load record into page"
        >
          ⬇️
        </button>,
        <button
          key="save"
          className="btn btn-primary"
          onClick={() => void onSaveNote(record)}
          title="Save the note"
          aria-label="Save note"
        >
          💾
        </button>,
        <button
          key="cancel"
          className="btn btn-secondary"
          onClick={() => onCancelEditing(record.cluid)}
          title="Cancel note editing"
          aria-label="Cancel note editing"
        >
          ↩️
        </button>,
        <button
          key="fill-redirect"
          className="btn btn-accent"
          onClick={() => void onFillAndRedirect(record)}
          title="Load and redirect"
          aria-label="Load and redirect"
        >
          🚀
        </button>,
        <button
          key="delete"
          className="btn btn-danger"
          onClick={() => void onDelete(record)}
          title="Delete record"
          aria-label="Delete record"
        >
          🗑️
        </button>,
      ]
    : [
        <button
          key="fill"
          className="btn btn-success"
          onClick={() => void onFill(record)}
          title="Fill the page with this record"
          aria-label="Load record into page"
        >
          ⬇️
        </button>,
        <button
          key="edit"
          className="btn btn-secondary"
          onClick={() => onStartEditing(record)}
          title="Edit note"
          aria-label="Edit note"
        >
          📝
        </button>,
        <button
          key="fill-redirect"
          className="btn btn-accent"
          onClick={() => void onFillAndRedirect(record)}
          title="Load and redirect"
          aria-label="Load and redirect"
        >
          🚀
        </button>,
        <button
          key="delete"
          className="btn btn-danger"
          onClick={() => void onDelete(record)}
          title="Delete record"
          aria-label="Delete record"
        >
          🗑️
        </button>,
      ];

  const noteCellContent = isEditing ? (
    <input
      type="text"
      value={noteDraft || ''}
      placeholder="First name Last name"
      size={24}
      onInput={(event) => onNoteChange(record.cluid, (event.target as HTMLInputElement).value)}
    />
  ) : (
    record.note || '—'
  );

  return (
    <tr
      draggable
      onDragStart={() => onDragStart(record.cluid)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDragDrop(record.cluid);
      }}
      onDragEnd={onDragEnd}
    >
      <td className="reorder-handle" title="Drag to reorder">
        ☰
      </td>
      <td className="cluid">
        <div className="cluid-value">{record.cluid}</div>
        <div className="product-line">{productLabel}</div>
      </td>
      <td className="note">{noteCellContent}</td>
      <td className="edited">{new Date(record.lastEdited).toLocaleString()}</td>
      <td className="actions">{actions}</td>
    </tr>
  );
}
