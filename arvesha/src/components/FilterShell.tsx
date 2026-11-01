'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from './icons';

/** On small screens the filters sit behind a button. On wide screens the CSS always shows them. */
export function FilterShell({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="btn btn--sm filters-toggle" aria-expanded={open} aria-controls="filters-panel" onClick={() => setOpen((o) => !o)}>
        <Icon name="filter" size={18} />
        {open ? 'Hide filters' : `Filters${activeCount ? ` (${activeCount})` : ''}`}
      </button>
      <div id="filters-panel" className="filters glass" data-open={open ? 'true' : 'false'} style={{ marginTop: open ? '0.75rem' : 0 }}>
        {children}
      </div>
    </div>
  );
}
