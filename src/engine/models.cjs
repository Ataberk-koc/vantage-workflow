const CONFIDENCE = Object.freeze({
  CONFIRMED_DOC: 'CONFIRMED_DOC',
  CONFIRMED_XML: 'CONFIRMED_XML',
  CONFIRMED_TEST: 'CONFIRMED_TEST',
  STRONGLY_INFERRED: 'STRONGLY_INFERRED',
  UNKNOWN: 'UNKNOWN'
});

function evidence(source, location, confidence = CONFIDENCE.CONFIRMED_XML) {
  return { sourceType: 'workflow_xml', source, location, confidence };
}

function createWorkflowSpec({ source, rawXml, rootName }) {
  return {
    schemaVersion: '0.1',
    source: { file: source, root: rootName },
    metadata: { name: null, version: null },
    actions: [],
    connections: [],
    variables: [],
    graph: null,
    unknownStructures: [],
    evidence: [],
    rawXml,
    validation: { structurallyValid: true, errors: [], warnings: [] }
  };
}

module.exports = { CONFIDENCE, evidence, createWorkflowSpec };
