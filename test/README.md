# Test Data

PDF parsing now uses [`unpdf`](https://github.com/unjs/unpdf), which is a pure-JS, dependency-free port of pdf.js — no test fixtures required. The `data/05-versions-space.pdf` file (kept here for legacy reasons from the previous `pdf-parse` v1.1.1 dependency) can safely be ignored.

If `pdf-parse` is reintroduced for any reason, that file is mandatory because of [a known import-time bug](https://gitlab.com/nicepdf/pdf-parse/-/issues/23).
