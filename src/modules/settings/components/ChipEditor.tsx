interface ChipEditorProps {
  items: string[];
  onRemove: (v: string) => void;
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
}

export function ChipEditor({ items, onRemove, inputValue, onInputChange, onAdd, placeholder }: ChipEditorProps) {
  return (
    <>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {items.map((item) => (
            <button
              key={item}
              onClick={() => onRemove(item)}
              className="filter-btn active text-[0.78rem] px-2.5 py-1"
              title="Click to remove"
            >
              {item} ×
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          className="search-input pl-3.5 flex-1"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onAdd(); }
          }}
        />
        <button className="filter-btn shrink-0" onClick={onAdd} disabled={!inputValue.trim()}>
          Add
        </button>
      </div>
    </>
  );
}
