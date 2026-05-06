import { useEffect, useMemo, useRef, useState } from 'react';

interface AutocompleteProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  /** Fired when the field is committed (blur / select). Use to add new values to the preset store. */
  onCommit?: (value: string) => void;
  /** Fired when the user taps the X next to a remembered suggestion. */
  onRemove?: (value: string) => void;
  placeholder?: string;
  id?: string;
  inputMode?: 'text' | 'search';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

/**
 * Outlook-style remembered-entry field. Forgiving fuzzy match: matches when
 * the query appears as a substring (case-insensitive) and ranks startsWith
 * matches first. Each suggestion has an X button that removes the value
 * from the preset store (handled by the parent via onRemove).
 */
export function Autocomplete({
  value,
  options,
  onChange,
  onCommit,
  onRemove,
  placeholder,
  id,
  inputMode = 'text',
  autoCapitalize = 'sentences'
}: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // Suppress the next blur-commit when the user mousedowns the X / a row,
  // since those interactions handle their own commit / remove.
  const skipBlurRef = useRef(false);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, 12);
    const startsWith: string[] = [];
    const contains: string[] = [];
    for (const o of options) {
      const lo = o.toLowerCase();
      if (lo === q) continue; // already typed
      if (lo.startsWith(q)) startsWith.push(o);
      else if (lo.includes(q)) contains.push(o);
    }
    return [...startsWith, ...contains].slice(0, 12);
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
          setTimeout(() => {
            if (skipBlurRef.current) {
              skipBlurRef.current = false;
              return;
            }
            // Auto-remember anything the pilot typed.
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
                skipBlurRef.current = true;
                commit(s);
              }}
            >
              <span className="autocomplete__label">{s}</span>
              {onRemove && (
                <button
                  type="button"
                  className="autocomplete__remove"
                  aria-label={`Remove ${s}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    skipBlurRef.current = true;
                    onRemove(s);
                  }}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
