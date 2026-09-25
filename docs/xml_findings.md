# XML Findings

## Confirmed Structural Findings

Source: external corpus at `C:\Ata\Workflow Tasarim Mimarisi\Vantage\Vantage`.
Confidence: `CONFIRMED_XML`.

- 101 XML files were read with a streaming XML reader.
- All 101 files completed parsing without an uncontrolled parser failure.
- The corpus has at least four root families: `ExportableProcedure`, `SubmitConfiguration`, `Composition`, and `Transformation`.
- `Action`, `Method`, `Template`, `Sequence`, `Condition`, and `Parameter` are recurring element names.
- `identifier`, `name`, `kind`, `facility`, `disposition`, and `behavior` are recurring attributes.
- Root and action-like structures cannot safely be treated as one universal schema yet.

## Engineering Implications

The parser must classify the root family before normalization. It must preserve raw XML and unknown descendants because recurring `Template`, `Method`, and configuration structures may contain active configuration or embedded metadata. Element order must not be used as the workflow execution graph until identifiers and references are mapped.

## Not Yet Proven

- Which `Action` attributes identify executable action instances versus definitions or metadata.
- The exact connection/reference element and branch representation.
- The semantic relationship between `Method`, `Template`, `Sequence`, and `Action`.
- Whether all `Condition` elements represent runtime branches.
- Version-specific behavior of observed attributes.
- A safe importable XML schema for generated workflows.

These remain `UNKNOWN` until correlated with official documentation and known-good samples.

## Safety Constraints

The future parser must disable unsafe XML features, avoid external entity resolution, retain unknown fragments, and never execute embedded CML during ingestion.
