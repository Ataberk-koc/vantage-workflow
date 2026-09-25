# Unknowns and Evidence Gaps

## Corpus

- The supplied corpus is external to this repository. It is available read-only at `C:\Ata` but is not yet versioned or copied into this project.
- `C:\Ata\Lisans Manager` contains only IDE metadata. The inspectable License Manager application is `C:\license-manager`.
- The License Manager ProductId, LicenseId contract, activation flow, online authority, offline grace behavior, revocation behavior, and signing mechanism have not been verified. No Vantage AI licensing code will be added until this is understood.

## Vantage XML

- Root families have been observed, but their semantic boundaries are not yet fully classified.
- Action names and kinds have not yet been enumerated from the corpus.
- Connection, disposition, condition, and branch semantics are not yet proven.
- Vantage version metadata and version-specific differences are not yet correlated.
- Exact Vantage import requirements for generated XML are unknown.
- `Template` and `Method` structures may represent active configuration, definitions, or embedded metadata; they must not be flattened prematurely.

## CML

- CML function signatures, contexts, return types, and version limits have not yet been extracted.
- No CML is executed during discovery.

## Policy

When evidence is insufficient, preserve the source fragment and mark the interpretation `UNKNOWN`. Do not convert these unknowns into generated Vantage configuration.
