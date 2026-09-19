import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface PaletteAction { id: string; label: string; hint?: string; icon: LucideIcon; run: () => void; }
interface Props { open: boolean; onClose: () => void; actions: PaletteAction[]; }

export default function CommandPalette({ open, onClose, actions }: Props) {
  const [query, setQuery] = useState(''); const [index, setIndex] = useState(0); const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQuery(''); setIndex(0); window.setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);
  const filtered = useMemo(() => { const queryText = query.trim().toLowerCase(); return queryText ? actions.filter((action) => action.label.toLowerCase().includes(queryText)) : actions; }, [query, actions]);
  useEffect(() => setIndex(0), [query]);
  if (!open) return null;
  const execute = (action: PaletteAction) => { action.run(); onClose(); };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0))); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setIndex((current) => Math.max(current - 1, 0)); }
    else if (event.key === 'Enter' && filtered[index]) { event.preventDefault(); execute(filtered[index]); }
    else if (event.key === 'Escape') onClose();
  };
  return <div className="palette-overlay" onClick={onClose}><div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(event) => event.stopPropagation()}><div className="palette-input-row"><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} placeholder="Type a command..." aria-label="Command input" /><kbd>esc</kbd></div><div className="palette-list">{filtered.length === 0 && <div className="palette-empty">No matching commands</div>}{filtered.map((action, itemIndex) => <button key={action.id} className={`palette-item ${itemIndex === index ? 'selected' : ''}`} onMouseEnter={() => setIndex(itemIndex)} onClick={() => execute(action)}><action.icon size={15} aria-hidden="true" /><span className="palette-label">{action.label}</span>{action.hint && <kbd className="palette-kbd">{action.hint}</kbd>}</button>)}</div><div className="palette-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> run</span><span className="palette-brand">Access AI Console</span></div></div></div>;
}
