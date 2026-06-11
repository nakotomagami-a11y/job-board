"use client";

import { useRef, useState, useMemo, type CSSProperties } from "react";
import Select, { type MenuListProps } from "react-select";
import worldCountries from "world-countries";

const ROW_HEIGHT = 36;
const VIEWPORT_HEIGHT = 200;
const OVERSCAN = 4;

function VirtualMenuList<Option, IsMulti extends boolean = false>(
  props: MenuListProps<Option, IsMulti>
) {
  const { children, maxHeight } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const items = Array.isArray(children) ? children : children ? [children] : [];
  const total = items.length;
  const viewport = Math.min(maxHeight ?? VIEWPORT_HEIGHT, VIEWPORT_HEIGHT);
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewport / ROW_HEIGHT) + OVERSCAN * 2;
  const endIndex = Math.min(total, startIndex + visibleCount);
  const visible = items.slice(startIndex, endIndex);
  const offset = startIndex * ROW_HEIGHT;

  const containerStyle: CSSProperties = { maxHeight: viewport, overflowY: "auto", padding: 4 };
  const spacerStyle: CSSProperties = { height: total * ROW_HEIGHT, position: "relative" };
  const layerStyle: CSSProperties = { position: "absolute", top: offset, left: 0, right: 0 };

  return (
    <div
      ref={scrollRef}
      style={containerStyle}
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
    >
      <div style={spacerStyle}>
        <div style={layerStyle}>{visible}</div>
      </div>
    </div>
  );
}

interface CountryOption {
  value: string;
  label: string;
  name: string;
  flag: string;
}

interface CountrySearchProps {
  onSearch: (countries: CountryOption[]) => void;
  isSearching: boolean;
}

const countryOptions: CountryOption[] = worldCountries
  .map((c) => ({
    value: c.cca2,
    label: `${c.flag} ${c.name.common}`,
    name: c.name.common,
    flag: c.flag,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function CountrySearch({ onSearch, isSearching }: CountrySearchProps) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<CountryOption[]>([]);

  const removeCountry = (idx: number) => {
    setSelected(selected.filter((_, i) => i !== idx));
  };

  const availableOptions = useMemo(
    () => countryOptions.filter((o) => !selected.some((s) => s.value === o.value)),
    [selected]
  );

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="filter-btn flex items-center gap-1.5 text-[0.82rem]"
      >
        🌍 {expanded ? "Hide" : "Local Job Boards"}
        {selected.length > 0 && (
          <span className="bg-primary text-[#0a0a0f] rounded-full px-[7px] py-[1px] text-[0.72rem] font-bold">
            {selected.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-4 max-w-[620px] mx-auto flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-text-dim">
                Selected countries
              </div>
              {selected.length > 0 && (
                <span className="text-[0.68rem] text-text-dim">{selected.length} selected</span>
              )}
            </div>

            {selected.length > 0 ? (
              <div className="flex flex-col gap-1">
                {selected.map((country, i) => (
                  <div
                    key={country.value}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-surface"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[rgba(56,189,248,0.1)] border border-[rgba(56,189,248,0.15)] flex items-center justify-center shrink-0 text-[1rem] leading-none">
                      {country.flag}
                    </div>
                    <span className="flex-1 text-[0.82rem] font-medium text-text-base truncate">
                      {country.name}
                    </span>
                    <button
                      onClick={() => removeCountry(i)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-dim hover:text-danger hover:bg-[rgba(248,113,113,0.08)] transition-all cursor-pointer border-none bg-transparent shrink-0"
                      title="Remove"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 3H10M4.5 3V2H7.5V3M5 5.5V8.5M7 5.5V8.5M3 3L3.5 10H8.5L9 3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-text-dim text-[0.8rem] border border-dashed border-border rounded-xl">
                No countries selected — pick ones below to search local boards
              </div>
            )}
          </div>

          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-text-dim mb-3">
              Add country
            </div>
            <Select
              options={availableOptions}
              value={null}
              onChange={(val) => { if (val) setSelected((prev) => [...prev, val as CountryOption]); }}
              placeholder="Search for a country..."
              isDisabled={isSearching}
              components={{ MenuList: VirtualMenuList }}
              filterOption={(option, input) => {
                if (!input) return true;
                const data = option.data as CountryOption;
                return data.name.toLowerCase().includes(input.toLowerCase());
              }}
              styles={{
                control: (base) => ({
                  ...base,
                  background: "rgba(255,255,255,0.04)",
                  borderColor: "rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  minHeight: 42,
                  boxShadow: "none",
                  "&:hover": { borderColor: "rgba(255,255,255,0.18)" },
                }),
                menu: (base) => ({
                  ...base,
                  background: "#1a1a2e",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  zIndex: 50,
                }),
                menuList: (base) => ({ ...base, maxHeight: 200, padding: 0 }),
                option: (base, state) => ({
                  ...base,
                  background: state.isFocused ? "rgba(255,255,255,0.08)" : "transparent",
                  color: "#e4e4e7",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  height: 36,
                  lineHeight: "20px",
                  padding: "8px 12px",
                  boxSizing: "border-box",
                  "&:active": { background: "rgba(56,189,248,0.15)" },
                }),
                input: (base) => ({ ...base, color: "#e4e4e7" }),
                placeholder: (base) => ({ ...base, color: "#71717a", fontSize: "0.85rem" }),
                indicatorSeparator: () => ({ display: "none" }),
                dropdownIndicator: (base) => ({
                  ...base,
                  color: "#71717a",
                  "&:hover": { color: "#a1a1aa" },
                }),
                clearIndicator: (base) => ({
                  ...base,
                  color: "#71717a",
                  "&:hover": { color: "#f87171" },
                }),
                singleValue: (base) => ({ ...base, color: "#e4e4e7" }),
              }}
            />
          </div>

          {selected.length > 0 && (
            <button
              className={`apply-btn w-full justify-center px-5 py-2.5 text-[0.85rem] ${isSearching ? "opacity-60" : ""}`}
              onClick={() => onSearch(selected)}
              disabled={isSearching}
            >
              {isSearching
                ? `⏳ Searching ${selected.length} ${selected.length === 1 ? "country" : "countries"}...`
                : `🔍 Find jobs in ${selected.length} ${selected.length === 1 ? "country" : "countries"}`
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}
