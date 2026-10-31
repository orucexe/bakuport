import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, MapPin, X } from "lucide-react";
import type { Stop } from "../types";

export interface Place {
  lat: number;
  lng: number;
  name: string;
  id?: number;
}

export default function PlacePicker({
  label,
  value,
  onChange,
  stops,
  loading = false,
}: {
  label: string;
  value: Place | null;
  onChange: (value: Place | null) => void;
  stops: Stop[];
  loading?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const matches = useMemo(
    () =>
      stops
        .filter(
          (stop) =>
            !query.trim() ||
            stop.name
              .toLocaleLowerCase("az")
              .includes(query.trim().toLocaleLowerCase("az")),
        )
        .slice(0, 8),
    [query, stops],
  );
  function choose(stop: Stop) {
    onChange(stop);
    setQuery("");
    setOpen(false);
    setActive(-1);
    input.current?.focus();
  }
  useEffect(() => {
    if (open && active >= 0)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);
  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, matches.length - 1));
    }
    if (event.key === "ArrowUp" && matches.length) {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
    if (event.key === "Enter" && open && active >= 0 && matches[active]) {
      event.preventDefault();
      choose(matches[active]);
    }
  }
  return (
    <div
      className="j-place"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="j-place-input">
        <MapPin size={20} aria-hidden="true" />
        <input
          id={id}
          ref={input}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={`${id}-options`}
          aria-expanded={open}
          aria-activedescendant={
            open && active >= 0 ? `${id}-${active}` : undefined
          }
          placeholder={
            label === "Haradan"
              ? "Başlanğıc dayanacağı"
              : "Gedəcəyiniz dayanacaq"
          }
          value={value?.name ?? query}
          onFocus={() => setOpen(true)}
          onKeyDown={keys}
          onChange={(event) => {
            onChange(null);
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
        />
        {(value || query) && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
              setOpen(true);
              input.current?.focus();
            }}
            aria-label={`${label} seçimini təmizlə`}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {open && (
        <div
          className="j-suggestions"
          role="listbox"
          id={`${id}-options`}
          aria-label={`${label} dayanacaq seçimləri`}
        >
          {matches.length ? (
            matches.map((stop, index) => (
              <div
                role="option"
                id={`${id}-${index}`}
                key={stop.id}
                aria-selected={index === active}
                className={index === active ? "active" : ""}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(stop)}
              >
                <span className="j-suggestion-icon">
                  <MapPin size={18} />
                </span>
                <span>
                  <strong>{stop.name}</strong>
                  <small>Bakı · dayanacaq {stop.source_id || stop.id}</small>
                </span>
                {stop.id === value?.id && <Check size={16} />}
              </div>
            ))
          ) : (
            <p>
              {loading
                ? "Dayanacaqlar yüklənir…"
                : "Uyğun dayanacaq tapılmadı. Başqa adla axtarın."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
