interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

export function Field({ label, value, onChange, placeholder }: FieldProps) {
  return (
    <div className="mb-3.5">
      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-text-dim mb-1.5">{label}</div>
      <input
        type="text"
        className="search-input pl-3.5"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
