import { enumerateFields, type Adapter, type RawField } from "../enumerator";

export const greenhouseAdapter: Adapter = {
  detect: ({ url, bodyText }) => {
    if (/(boards\.greenhouse\.io|job-boards\.greenhouse\.io)/.test(url)) return true;
    if (bodyText && /powered by greenhouse/i.test(bodyText)) return true;
    return false;
  },
  enumerate: (raw: RawField[]) => {
    // Greenhouse uses stable field name conventions like "first_name",
    // "last_name", "email", "resume", plus a "job_application[answers_attributes]"
    // pattern for custom questions. The label is usually present and clean,
    // so the generic enumerator handles it well; we only flag UI quirks.
    const fields = enumerateFields(raw);
    const notes: string[] = [];
    if (raw.some((r) => /resume/i.test(r.name ?? "") || /resume/i.test(r.fieldId))) {
      notes.push("greenhouse: resume upload field detected — confirm CV path before submit");
    }
    return { ats: "greenhouse", fields, notes };
  },
};
