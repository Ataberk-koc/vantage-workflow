# Phase 1 Architecture Proposal

## Boundary

The current Electron/Vue application remains the operator shell. Vantage intelligence must be implemented as a separate, deterministic engine that does not depend on the UI, an LLM, a vector database, or License Manager transport details.

```text
Corpus files
  -> safe raw XML/CML ingestion
  -> root-family classifier
  -> normalized evidence model
  -> WorkflowGraph / variable registry
  -> structural validator and semantic diff
  -> CLI and Electron IPC adapters
```

## Proposed Modules

- `src/engine/corpus`: inventory and provenance
- `src/engine/xml`: safe XML reader, root classifiers, unknown-fragment preservation
- `src/engine/models`: versioned normalized JSON contracts
- `src/engine/graph`: identifiers, references, connections, branches
- `src/engine/variables`: definitions, references, producers, consumers
- `src/engine/cml`: non-executing CML inventory
- `src/engine/validation`: deterministic structural validation
- `src/engine/diff`: semantic, structural, metadata, and unknown changes
- `src/cli`: inspect, parse, graph, validate, diff, corpus scan
- `src/licensing`: an application-level adapter only after the existing License Manager is inspected

## Technology Decision

For the current Windows desktop product, Node.js/Electron/Vue is retained for the shell and IPC. The engine should use a streaming XML parser or secure DOM parser with external entity resolution disabled, explicit typed model validation, and automated regression tests. The existing `xml2js` dependency is suitable for controlled small documents but should not be assumed safe or memory-efficient for the 1.37 GB corpus without a streaming boundary.

## Evidence Model

Every normalized fact should include:

```json
{
  "source_type": "workflow_xml",
  "source": "relative-or-external-source-file",
  "location": "xml-path-or-line",
  "confidence": "CONFIRMED_XML"
}
```

Allowed confidence values: `CONFIRMED_DOC`, `CONFIRMED_XML`, `CONFIRMED_TEST`, `STRONGLY_INFERRED`, `UNKNOWN`.

## Phase 1 Exit Criteria

- All 101 primary workflows parse without uncontrolled crashes.
- Parsed, partially understood, unknown structures, and validation warnings are reported separately.
- Unknown XML is preserved for no-op round trips.
- Graph and variable relationships are evidence-backed.
- CLI commands exist for inspect, parse, graph, validate, and semantic diff.
- No LLM-generated Vantage configuration is introduced before evidence supports it.
