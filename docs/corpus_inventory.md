# Corpus Inventory

## Scope

This inventory was generated from the external, read-only corpus. No source files were copied or modified.

- Primary corpus: `C:\Ata\Workflow Tasarim Mimarisi\Vantage\Vantage`
- Additional workflow samples: `C:\Ata\General-Workflows`
- License Manager candidate: `C:\license-manager`

## Counts

| Resource | Count | Status |
|---|---:|---|
| Workflow XML | 101 | Parsed with streaming XML reader: 101/101 |
| CML | 58 | Located; semantic analysis pending |
| PDF | 34 | Located; text extraction pending |
| DOCX | 7 | Located; text extraction pending |
| XML total size | 1,378,672,887 bytes | External read-only corpus |
| CML total size | 191,571 bytes | External read-only corpus |

`C:\Ata\General-Workflows` contains 39 additional XML files and should be treated as a secondary sample set until duplicates and provenance are classified.

Phase 1 parser regression now covers the 101 primary XML files: 101 parsed, 0 parser failures, 1009 resolved sequence edges, 0 dangling references, 89 files with variable references, and 3577 preserved/unknown structures. One disconnected action warning remains in `Workflow\test.xml`.

## XML Root Types

| Root | Files |
|---|---:|
| `ExportableProcedure` | 86 |
| `SubmitConfiguration` | 6 |
| `Composition` | 6 |
| `Transformation` | 3 |

## Frequently Observed Structures

| Element or attribute | Occurrences |
|---|---:|
| `Action` | 2,000 |
| `Method` | 2,000 |
| `Template` | 1,577 |
| `Sequence` | 1,015 |
| `Condition` | 439 |
| `Parameter` | 172 |
| `identifier` attribute | 5,530 |
| `name` attribute | 4,508 |
| `kind` attribute | 2,593 |
| `facility` attribute | 2,577 |
| `disposition` attribute | 1,000 |
| `behavior` attribute | 1,000 |

## Provenance

These numbers are confirmed by a read-only streaming scan performed on 2026-09-25. They do not yet establish the semantic meaning of every element. Each future normalized fact must retain source file, XML location, source type, and confidence.

## Next Discovery Tasks

1. Classify `ExportableProcedure`, `SubmitConfiguration`, `Composition`, and `Transformation` separately.
2. Expand variable producer/consumer and binding analysis.
3. Analyze all 58 CML files without executing them.
4. Add deterministic duplicate/missing-reference validation.
5. Implement semantic XML diff and complete the CLI contract.
6. Extract documentation text from PDF/DOCX sources and link findings to source locations.
