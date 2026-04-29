import type { FieldType } from "./types";

/**
 * The shape we expect from a page snapshot reader (Browser MCP / Playwright
 * accessibility tree). The reader is responsible for producing this; the
 * enumerator only normalizes it into PendingField-compatible shape.
 */
export interface RawField {
  fieldId: string; // stable selector or DOM id
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  name?: string; // input name attr — last-resort label source
  inputType?: string; // html input type
  tagName?: string; // input | textarea | select | button | etc.
  options?: string[];
  required?: boolean;
  multiple?: boolean;
}

export interface EnumeratedField {
  fieldId: string;
  label: string;
  fieldType: FieldType;
  options?: string[];
  required?: boolean;
  /** True when the label was inferred from a non-label source — pause-worthy on its own. */
  labelSource: "label" | "aria" | "placeholder" | "name" | "none";
}

function chooseLabel(raw: RawField): { label: string; source: EnumeratedField["labelSource"] } {
  if (raw.label?.trim()) return { label: raw.label.trim(), source: "label" };
  if (raw.ariaLabel?.trim()) return { label: raw.ariaLabel.trim(), source: "aria" };
  if (raw.placeholder?.trim()) return { label: raw.placeholder.trim(), source: "placeholder" };
  if (raw.name?.trim()) return { label: raw.name.trim(), source: "name" };
  return { label: "", source: "none" };
}

function chooseFieldType(raw: RawField): FieldType {
  const tag = (raw.tagName ?? "").toLowerCase();
  const it = (raw.inputType ?? "").toLowerCase();
  if (tag === "textarea") return "textarea";
  if (tag === "select") return raw.multiple ? "multiselect" : "select";
  if (it === "email") return "email";
  if (it === "tel") return "tel";
  if (it === "url") return "url";
  if (it === "number") return "number";
  if (it === "file") return "file";
  if (it === "date") return "date";
  if (it === "checkbox") return "checkbox";
  if (it === "radio") return "radio";
  return "text";
}

export function enumerateFields(raw: RawField[]): EnumeratedField[] {
  return raw.map((r) => {
    const { label, source } = chooseLabel(r);
    return {
      fieldId: r.fieldId,
      label,
      fieldType: chooseFieldType(r),
      options: r.options,
      required: r.required,
      labelSource: source,
    };
  });
}

export interface AdapterResult {
  ats: string;
  fields: EnumeratedField[];
  notes?: string[];
}

export interface Adapter {
  detect: (input: { url: string; bodyText?: string }) => boolean;
  enumerate: (raw: RawField[]) => AdapterResult;
}
