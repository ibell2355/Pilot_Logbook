import { useEffect, useMemo, useRef, useState } from 'react';

interface AutocompleteProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  placeholder?: string;
  id?: string;
  inputMode?: 'text' | 'search';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function Autocomplete({
  value,
  options,
  onChange,
  onCommit,
  placeholder,
  id,
  inputMode = 'text',
  autoCapitalize = 'sentences'
}: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options
      .filter((o) => o.toLowerCase().includes(q))
      .slice(0, 8);
  }, [options, value]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const commit = (next: string) => {
    onChange(next);
    onCommit?.(next);
    setOpen(false);
  };

  return (
    <div className="autocomplete" ref={wrapperRef}>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        autoCapitalize={autoCapitalize}
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onBlur={() => {
          // Commit with a small delay so clicks on the list still register
          setTimeout(() => {
            onCommit?.(value);
            setOpen(false);
          }, 120);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            if (open && activeIndex >= 0 && suggestions[activeIndex]) {
              e.preventDefault();
              commit(suggestions[activeIndex]);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <ul className="autocomplete__list" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === activeIndex}
              className={`autocomplete__item${i === activeIndex ? ' active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s);
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
