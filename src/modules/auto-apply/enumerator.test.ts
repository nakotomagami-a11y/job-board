import { describe, it, expect } from "vitest";
import { enumerateFields } from "./enumerator";

describe("enumerateFields", () => {
  it("uses the explicit label when present", () => {
    const r = enumerateFields([
      { fieldId: "f1", label: "First name", tagName: "input", inputType: "text" },
    ]);
    expect(r[0]).toMatchObject({ label: "First name", fieldType: "text", labelSource: "label" });
  });

  it("falls back to ariaLabel, then placeholder, then name", () => {
    const r = enumerateFields([
      { fieldId: "f1", ariaLabel: "Email", tagName: "input", inputType: "email" },
      { fieldId: "f2", placeholder: "Your phone", tagName: "input", inputType: "tel" },
      { fieldId: "f3", name: "country_code", tagName: "select" },
    ]);
    expect(r[0].labelSource).toBe("aria");
    expect(r[0].fieldType).toBe("email");
    expect(r[1].labelSource).toBe("placeholder");
    expect(r[1].fieldType).toBe("tel");
    expect(r[2].labelSource).toBe("name");
    expect(r[2].fieldType).toBe("select");
  });

  it("flags fields with no label source", () => {
    const r = enumerateFields([{ fieldId: "f1", tagName: "input", inputType: "text" }]);
    expect(r[0].labelSource).toBe("none");
    expect(r[0].label).toBe("");
  });

  it("maps tagName/inputType combos to field types", () => {
    const r = enumerateFields([
      { fieldId: "a", tagName: "textarea", label: "About" },
      { fieldId: "b", tagName: "input", inputType: "file", label: "CV" },
      { fieldId: "c", tagName: "select", multiple: true, label: "Skills" },
      { fieldId: "d", tagName: "input", inputType: "checkbox", label: "Agree" },
    ]);
    expect(r.map((f) => f.fieldType)).toEqual(["textarea", "file", "multiselect", "checkbox"]);
  });
});
