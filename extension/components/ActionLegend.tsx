import { React } from '../utils/reactGlobals.js';

const legendItems: Array<[string, string, string]> = [
  ['⬇️', 'Load record', 'legend-success'],
  ['📝', 'Edit note', 'legend-secondary'],
  ['💾', 'Save note', 'legend-primary'],
  ['↩️', 'Cancel editing', 'legend-secondary'],
  ['🚀', 'Load and redirect', 'legend-accent'],
  ['🗑️', 'Delete record', 'legend-danger'],
];

export function ActionLegend() {
  return (
    <div className="action-legend" aria-label="Action legend">
      {legendItems.map(([emoji, label, legendClass]) => (
        <span key={label} className={`legend-item ${legendClass}`}>
          <span className="legend-emoji" aria-hidden="true">
            {emoji}
          </span>
          <span className="legend-label">{label}</span>
        </span>
      ))}
    </div>
  );
}
