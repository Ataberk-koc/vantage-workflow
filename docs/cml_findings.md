# CML Findings

## Inventory

- CML files located: 58
- Source: `C:\Ata\Workflow Tasarim Mimarisi\Vantage\Vantage\CML`
- Ingestion status: not started
- Execution during ingestion: prohibited

## Planned Representation

Each discovered CML item should eventually record:

- name and source file
- syntax and parameters
- return type, where documented
- context and variable references
- examples
- limitations and version
- source location
- confidence and provenance

## Current Boundary

No CML semantics are being inferred from filenames. CML is treated as untrusted data. The next pass should parse and inventory declarations/examples separately from CML observed inside workflow XML. Arbitrary CML must never be executed as part of corpus scanning.
