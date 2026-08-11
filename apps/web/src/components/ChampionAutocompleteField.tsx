import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_VISIBLE_MATCHES = 8;

function findMatches(query: string, suggestions: string[]): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return suggestions.slice(0, MAX_VISIBLE_MATCHES);
  const startsWith = suggestions.filter((s) => s.toLowerCase().startsWith(q));
  const contains = suggestions.filter((s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q));
  return [...startsWith, ...contains].slice(0, MAX_VISIBLE_MATCHES);
}

interface ChampionAutocompleteFieldProps {
  label: string;
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  /** Called whenever the "typed name doesn't match a known champion" state changes, so the parent can gate its submit button. */
  onUnknownChange: (unknown: boolean) => void;
  /** Extra class applied to the input's border/focus ring, for visually tying a field to an active event (e.g. the Extra Legendary fire accent). */
  accentClass?: string;
}

export function ChampionAutocompleteField({
  label,
  suggestions,
  value,
  onChange,
  disabled,
  onUnknownChange,
  accentClass,
}: ChampionAutocompleteFieldProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedName = value.trim();
  const isKnownChampion = useMemo(
    () => suggestions.some((s) => s.toLowerCase() === trimmedName.toLowerCase()),
    [suggestions, trimmedName],
  );
  const matches = useMemo(() => findMatches(value, suggestions), [value, suggestions]);
  const showUnknownWarning = trimmedName !== '' && !isKnownChampion;

  useEffect(() => {
    onUnknownChange(showUnknownWarning);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUnknownWarning]);

  const selectSuggestion = (name: string) => {
    onChange(name);
    setDropdownOpen(false);
    inputRef.current?.blur();
  };

  return (
    <label className="mb-1.5 block text-left">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setDropdownOpen(false)}
          disabled={disabled}
          placeholder="Začni psát jméno…"
          maxLength={80}
          autoComplete="off"
          className={`h-9 w-full rounded-lg border bg-slate-800 px-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none ${
            accentClass ?? 'border-slate-700 focus:border-slate-500'
          }`}
        />
        {dropdownOpen && (
          <ul className="absolute top-full right-0 left-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg">
            {matches.length > 0 ? (
              matches.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(name);
                    }}
                    className="block w-full px-2.5 py-1.5 text-left text-sm text-slate-100 hover:bg-slate-700"
                  >
                    {name}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-2.5 py-1.5 text-left text-xs text-slate-500">Takové lego v seznamu není</li>
            )}
          </ul>
        )}
      </div>
      <p className={`mt-1.5 h-3.5 text-left text-[11px] ${showUnknownWarning ? 'text-amber-400' : 'invisible'}`}>
        Takové lego v seznamu není
      </p>
    </label>
  );
}
