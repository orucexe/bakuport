import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Building2,
  GraduationCap,
  Hospital,
  Landmark,
  MapPin,
  Search,
  TrainFront,
  Trees,
  X,
} from "lucide-react";
import type { Stop } from "../types";
import { BAKU_POPULAR_PLACES, type BakuPlace } from "../data/bakuPlaces";

export interface Place {
  lat: number;
  lng: number;
  name: string;
  id?: number;
  subtitle?: string;
  category?: string;
}

export default function PlacePicker({
  label,
  value,
  onChange,
  stops,
  loading = false,
  placeholder = "Ünvan, məkan, metro və ya dayanacaq adı...",
}: {
  label: string;
  value: Place | null;
  onChange: (value: Place | null) => void;
  stops: Stop[];
  loading?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [googleSuggestions, setGoogleSuggestions] = useState<Place[]>([]);
  const input = useRef<HTMLInputElement>(null);

  // Google Places Autocomplete or Geocoder query
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 3 || typeof google === "undefined" || !google.maps) {
      setGoogleSuggestions([]);
      return;
    }

    let isSubscribed = true;
    setGoogleSuggestions([]);

    // Try Google Geocoder or Places Autocomplete if available
    const timer=setTimeout(()=>{try {
      if (google.maps.Geocoder) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode(
          {
            address: q.includes("Bakı") || q.includes("Baku") ? q : `${q}, Bakı, Azərbaycan`,
            region: "AZ",
            componentRestrictions: { country: "AZ" },
          },
          (results, status) => {
            if (!isSubscribed) return;
            if (status === "OK" && results && results.length > 0) {
              const items: Place[] = results.slice(0, 3).map((res) => ({
                lat: res.geometry.location.lat(),
                lng: res.geometry.location.lng(),
                name: res.formatted_address.split(",")[0] || q,
                subtitle: `Google · ${res.formatted_address}`,
                category: "google",
              }));
              setGoogleSuggestions(items);
            }
          }
        );
      }
    } catch {
      // Fallback silently to internal Baku places catalog
    }},350);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [query]);

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("az");
    if (!q) {
      // Default initial popular suggestions when focused
      return BAKU_POPULAR_PLACES.slice(0, 6).map((place) => ({
        lat: place.lat,
        lng: place.lng,
        name: place.name,
        subtitle: `Təxmini məkan · ${place.subtitle}`,
        category: place.category,
      }));
    }

    // 1. Search in famous Baku landmarks, malls, metro, universities
    const placeMatches: Place[] = BAKU_POPULAR_PLACES.filter(
      (p) =>
        p.name.toLocaleLowerCase("az").includes(q) ||
        p.subtitle.toLocaleLowerCase("az").includes(q) ||
        p.categoryLabel.toLocaleLowerCase("az").includes(q)
    ).map((p) => ({
      lat: p.lat,
      lng: p.lng,
      name: p.name,
      subtitle: `Təxmini məkan · ${p.subtitle}`,
      category: p.category,
    }));

    // 2. Search in official stops catalog (3,600 BakuBus stops)
    const stopMatches: Place[] = stops
      .filter((s) => s.name.toLocaleLowerCase("az").includes(q))
      .slice(0, 6)
      .map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        name: s.name,
        subtitle: `OpenData.az · dayanacaq ${s.source_id || s.id}`,
        category: "stop",
      }));

    // Combine: Places first, then Google suggestions, then Stops
    const combined = [...googleSuggestions, ...stopMatches, ...placeMatches.slice(0, 5)];
    return combined.slice(0, 8);
  }, [query, stops, googleSuggestions]);

  function choose(place: Place) {
    onChange(place);
    setQuery("");
    setOpen(false);
    setActive(-1);
    input.current?.blur();
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setOpen(false);
    setActive(-1);
    input.current?.focus();
  }

  useEffect(() => {
    if (open && active >= 0) {
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
    }
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
    } else if (event.key === "Enter" && matches.length > 0) {
      event.preventDefault();
      choose(matches[0]);
    }
  }

  function renderCategoryIcon(category?: string) {
    switch (category) {
      case "mall":
        return <Building2 size={17} className="place-cat-icon mall" />;
      case "metro":
        return <TrainFront size={17} className="place-cat-icon metro" />;
      case "university":
        return <GraduationCap size={17} className="place-cat-icon uni" />;
      case "hospital":
        return <Hospital size={17} className="place-cat-icon hosp" />;
      case "park":
        return <Trees size={17} className="place-cat-icon park" />;
      case "landmark":
      case "transport":
        return <Landmark size={17} className="place-cat-icon land" />;
      default:
        return <MapPin size={17} className="place-cat-icon stop" />;
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
        <MapPin size={20} aria-hidden="true" className="j-pin-icon" />
        <input
          id={id}
          ref={input}
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${id}-popup`}
          aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
          placeholder={value ? value.name : placeholder}
          value={open ? query : value ? value.name : query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => {
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={keys}
        />
        {value ? (
          <button
            type="button"
            className="j-place-clear"
            onClick={handleClear}
            aria-label={`${label} seçimini təmizlə`}
          >
            <X size={16} />
          </button>
        ) : loading ? (
          <span className="j-place-spin" aria-hidden="true" />
        ) : null}
      </div>

      {open && (
        <ul
          id={`${id}-popup`}
          role="listbox"
          className="j-place-dropdown"
          tabIndex={-1}
        >
          {matches.length === 0 ? (
            <li className="j-place-empty" role="option" aria-selected="false">
              Məkan və ya ünvan tapılmadı
            </li>
          ) : (
            matches.map((item, index) => (
              <li
                key={`${item.name}-${item.lat}-${item.lng}-${index}`}
                id={`${id}-${index}`}
                role="option"
                aria-selected={index === active}
                className={`j-place-option ${index === active ? "active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(item);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <div className="j-place-icon-wrap">
                  {renderCategoryIcon(item.category)}
                </div>
                <div className="j-place-text">
                  <div className="j-place-name">{item.name}</div>
                  {item.subtitle && (
                    <div className="j-place-sub">{item.subtitle}</div>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
