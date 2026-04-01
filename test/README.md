# Test Data

The `data/05-versions-space.pdf` file is required by `pdf-parse` v1.1.1.
This is a known bug — the library tries to load this file on import.
See: https://gitlab.com/nicepdf/pdf-parse/-/issues/23

Do not delete this file or PDF parsing will fail.
