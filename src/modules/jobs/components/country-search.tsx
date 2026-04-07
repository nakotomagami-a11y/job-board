"use client";

import { useRef, useState, useMemo, type CSSProperties } from "react";
import Select, { type MenuListProps } from "react-select";
import worldCountries from "world-countries";

// Custom virtualized MenuList: renders only the rows in view + a small
// overscan, so opening the dropdown with ~250 countries doesn't mount 250
// DOM nodes. No react-window dependency needed.
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

  const containerStyle: CSSProperties = {
    maxHeight: viewport,
    overflowY: "auto",
    padding: 4,
  };
  const spacerStyle: CSSProperties = {
    height: total * ROW_HEIGHT,
    position: "relative",
  };
  const layerStyle: CSSProperties = {
    position: "absolute",
    top: offset,
    left: 0,
    right: 0,
  };

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
}

interface CountrySearchProps {
  onSearch: (countries: CountryOption[]) => void;
  isSearching: boolean;
}

// Build sorted options from world-countries package
const countryOptions: CountryOption[] = worldCountries
  .map((c) => ({
    value: c.cca2,
    label: `${c.flag} ${c.name.common}`,
    name: c.name.common,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function CountrySearch({ onSearch, isSearching }: CountrySearchProps) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<CountryOption[]>([]);

  // Memoize to avoid re-renders
  const selectedNames = useMemo(
    () => selected.map((s) => s.label).join(", "),
    [selected]
  );

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="filter-btn"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          margin: "0 auto", fontSize: "0.82rem",
        }}
      >
        🌍 {expanded ? "Hide" : "Local Job Boards"}
        {selected.length > 0 && (
          <span style={{
            background: "var(--c-primary)", color: "#0a0a0f",
            borderRadius: 99, padding: "1px 7px", fontSize: "0.72rem", fontWeight: 700,
          }}>
            {selected.length}
          </span>
        )}
      </button>

      {expanded && (
        <div style={{ marginTop: 12, maxWidth: 560, margin: "12px auto 0" }}>
          <div style={{
            fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.06em", color: "var(--text-dim)", marginBottom: 8,
          }}>
            Select countries — Claude will find local job boards and search them
          </div>

          <Select
            isMulti
            options={countryOptions}
            value={selected}
            onChange={(val) => setSelected([...(val || [])])}
            placeholder="Search for a country..."
            isDisabled={isSearching}
            components={{ MenuList: VirtualMenuList }}
            filterOption={(option, input) => {
              if (!input) return true;
              return option.data.name.toLowerCase().includes(input.toLowerCase());
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
              menuList: (base) => ({
                ...base,
                maxHeight: 200,
                padding: 0,
              }),
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
              multiValue: (base) => ({
                ...base,
                background: "rgba(56,189,248,0.15)",
                borderRadius: 6,
              }),
              multiValueLabel: (base) => ({
                ...base,
                color: "#38bdf8",
                fontSize: "0.8rem",
              }),
              multiValueRemove: (base) => ({
                ...base,
                color: "#38bdf8",
                "&:hover": { background: "rgba(56,189,248,0.3)", color: "#fff" },
              }),
              input: (base) => ({
                ...base,
                color: "#e4e4e7",
              }),
              placeholder: (base) => ({
                ...base,
                color: "#71717a",
                fontSize: "0.85rem",
              }),
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
            }}
          />

          {/* Selected preview + search button */}
          {selected.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 10,
              }}>
                Claude will discover and search local job boards in: {selectedNames}
              </div>

              <button
                className="apply-btn"
                onClick={() => onSearch(selected)}
                disabled={isSearching}
                style={{
                  width: "100%", justifyContent: "center",
                  padding: "10px 20px", fontSize: "0.85rem",
                  opacity: isSearching ? 0.6 : 1,
                }}
              >
                {isSearching
                  ? `⏳ Searching ${selected.length} countries...`
                  : `🔍 Find jobs in ${selected.length} ${selected.length === 1 ? "country" : "countries"}`
                }
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
