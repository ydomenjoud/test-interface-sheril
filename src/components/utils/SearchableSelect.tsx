import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function SearchableSelect(props: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const { options, value, onChange, placeholder, style } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const selected = useMemo(() => options.find(o => o.value === value) || null, [options, value]);

  useEffect(() => {
    if (!open && selected) setQuery(selected.label);
    if (!open && !selected) setQuery('');
  }, [open, selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function commit(val: string) {
    onChange(val);
    setOpen(false);
    const sel = options.find(o => o.value === val);
    setQuery(sel?.label ?? '');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      setHighlight(h => Math.min(filtered.length - 1, h + 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setHighlight(h => Math.max(0, h - 1));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const opt = filtered[highlight];
      if (opt) commit(opt.value);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setOpen(false);
      e.preventDefault();
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', minWidth: 320, ...style }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', border: '1px solid #555', borderRadius: 4, padding: '4px 8px',
          background: '#111', color: '#ddd', gap: 6
        }}
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder || 'Choisir…'}
          value={open ? query : (selected?.label ?? '')}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onKeyDown={onKeyDown}
          style={{
            flex: 1, background: 'transparent', color: 'inherit', border: 'none', outline: 'none', minWidth: 0
          }}
        />
        <span style={{ opacity: 0.7 }}>▾</span>
      </div>
      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, maxHeight: 260, overflow: 'auto',
            background: '#0f0f10', border: '1px solid #444', borderRadius: 4, zIndex: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.35)'
          }}
          role="listbox"
        >
          {filtered.length === 0 ? (
            <div style={{ padding: 8, color: '#aaa' }}>Aucun résultat</div>
          ) : filtered.map((o, i) => (
            <div
              key={o.value}
              role="option"
              aria-selected={value === o.value}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => { e.preventDefault(); commit(o.value); }}
              style={{
                padding: '6px 8px',
                background: i === highlight ? '#1e2a44' : 'transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden'
              }}
              title={o.label}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
