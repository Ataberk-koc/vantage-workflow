const fs = require('fs/promises');
const path = require('path');
const { Parser } = require('xml2js');
const { CONFIDENCE, createWorkflowSpec, evidence } = require('./models.cjs');
const { createGraph } = require('./workflow-graph.cjs');

const REFERENCE_ATTRIBUTES = new Set(['next', 'previous', 'source', 'target', 'from', 'to']);
const VARIABLE_PATTERN = /\{[^{}]+\}|\$\([^()]+\)/g;
const ACTION_METADATA_NAMES = new Set(['Template', 'Method', 'Documentation', 'Help']);

function getAttributes(value) {
  return value && typeof value === 'object' && value.$ && typeof value.$ === 'object'
    ? value.$
    : {};
}

function localNameOf(name) {
  const separator = name.lastIndexOf(':');
  return separator >= 0 ? name.slice(separator + 1) : name;
}

function getScalar(value) {
  if (Array.isArray(value)) return getScalar(value[0]);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function splitReferences(value) {
  return String(value)
    .split(/[\s,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectVariables(value, location, variables) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(VARIABLE_PATTERN)) {
      if (!variables.has(match[0])) {
        variables.set(match[0], { name: match[0], location, evidence: evidence(location, location) });
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectVariables(item, `${location}[${index}]`, variables));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === '$') {
      for (const [attribute, attributeValue] of Object.entries(child)) {
        collectVariables(attributeValue, `${location}/@${attribute}`, variables);
      }
    } else {
      collectVariables(child, `${location}/${key}`, variables);
    }
  }
}

function collectExecutionRelations(value, location, methodActions, sequences) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectExecutionRelations(item, `${location}[${index}]`, methodActions, sequences));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    if (key === '$') continue;
    const localName = localNameOf(key);
    if (localName === 'Method' && Array.isArray(child)) {
      for (const methodWrapper of child) {
        const directMethodId = getAttributes(methodWrapper).identifier;
        const wrapperAction = getScalar(methodWrapper['soa:Action'] || methodWrapper.Action);
        if (directMethodId && wrapperAction) methodActions.set(directMethodId, wrapperAction);

        const nestedMethods = methodWrapper['soa:Method'] || methodWrapper.Method || [];
        for (const nestedMethod of nestedMethods) {
          const methodId = getAttributes(nestedMethod).identifier;
          if (methodId && wrapperAction) methodActions.set(methodId, wrapperAction);
        }
      }
    }
    if (localName === 'Sequence' && Array.isArray(child)) {
      for (const sequence of child) {
        const attributes = getAttributes(sequence);
        if (attributes.previous || attributes.next) {
          sequences.push({
            previous: attributes.previous,
            next: attributes.next,
            source: `${location}/${key}`
          });
        }
      }
    }
    collectExecutionRelations(child, `${location}/${key}`, methodActions, sequences);
  }
}

function collectNodes(value, location, context, spec) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectNodes(item, `${location}[${index}]`, context, spec));
    return;
  }
  if (!value || typeof value !== 'object') return;

  const attributes = getAttributes(value);
  const identifier = attributes.identifier || attributes.id || attributes.guid || attributes.uuid;
  const localName = localNameOf(context.name);
  const isAction = localName === 'Action';

  if (isAction) {
    const action = {
      id: identifier || null,
      guid: attributes.guid || null,
      type: attributes.name || attributes.kind || attributes.type || attributes.action || null,
      kind: attributes.kind || null,
      name: attributes.name || null,
      description: attributes.description || null,
      version: attributes.version || null,
      behavior: attributes.behavior || null,
      disposition: attributes.disposition || null,
      parameters: {},
      variables: [],
      conditions: [],
      executionRequirements: [],
      specializedConfiguration: {},
      unknownConfiguration: [],
      sourceEvidence: [evidence(spec.source.file, location)]
    };
    spec.actions.push(action);

    for (const attribute of ['next', 'previous']) {
      if (attributes[attribute]) {
        for (const reference of splitReferences(attributes[attribute])) {
          spec.connections.push({
            from: attribute === 'previous' ? reference : action.id,
            to: attribute === 'previous' ? action.id : reference,
            relation: attribute,
            source: `${location}/@${attribute}`,
            evidence: evidence(spec.source.file, `${location}/@${attribute}`)
          });
        }
      }
    }
  }

  if (ACTION_METADATA_NAMES.has(localName)) {
    spec.unknownStructures.push({
      kind: 'possible_action_metadata',
      name: localName,
      location,
      raw: value,
      evidence: evidence(spec.source.file, location, CONFIDENCE.UNKNOWN)
    });
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === '$') {
      for (const [attribute, attributeValue] of Object.entries(child)) {
        if (REFERENCE_ATTRIBUTES.has(attribute) && identifier) {
          const owner = identifier || null;
          for (const reference of splitReferences(attributeValue)) {
            if (attribute !== 'next' && attribute !== 'previous') {
              spec.connections.push({
                from: attribute === 'from' || attribute === 'source' ? owner : reference,
                to: attribute === 'to' || attribute === 'target' ? owner : reference,
                relation: attribute,
                source: `${location}/@${attribute}`,
                evidence: evidence(spec.source.file, `${location}/@${attribute}`, CONFIDENCE.UNKNOWN)
              });
            }
          }
        }
      }
    } else {
      collectNodes(child, `${location}/${key}`, { name: key }, spec);
    }
  }
}

async function parseVantageXml(filePath) {
  const absolutePath = path.resolve(filePath);
  const rawXml = await fs.readFile(absolutePath, 'utf8');
  if (/<!DOCTYPE|<!ENTITY/i.test(rawXml)) {
    throw new Error('XML DTD and ENTITY declarations are not allowed during ingestion.');
  }

  const parser = new Parser({
    explicitArray: true,
    explicitRoot: true,
    normalize: false,
    trim: false,
    xmlns: false
  });
  const parsed = await parser.parseStringPromise(rawXml);
  const rootName = Object.keys(parsed)[0] || 'Unknown';
  const spec = createWorkflowSpec({ source: absolutePath, rawXml, rootName });
  const root = parsed[rootName];
  const rootAttributes = getAttributes(root);
  spec.metadata.name = rootAttributes.name || getScalar(root.Name) || null;
  spec.metadata.version = rootAttributes.version || rootAttributes.workflowversion || null;
  spec.evidence.push(evidence(absolutePath, `/${rootName}`));

  const variables = new Map();
  collectVariables(parsed, `/${rootName}`, variables);
  spec.variables = [...variables.values()];
  collectNodes(root, `/${rootName}`, { name: rootName }, spec);
  const methodActions = new Map();
  const sequences = [];
  collectExecutionRelations(root, `/${rootName}`, methodActions, sequences);
  for (const sequence of sequences) {
    const from = methodActions.get(sequence.previous) || sequence.previous || null;
    const to = methodActions.get(sequence.next) || sequence.next || null;
    spec.connections.push({
      from,
      to,
      relation: 'sequence',
      source: sequence.source,
      evidence: evidence(spec.source.file, sequence.source)
    });
  }
  spec.graph = createGraph(spec.actions, spec.connections);
  spec.validation.warnings.push(...spec.unknownStructures.map((item) => `Uninterpreted ${item.name} at ${item.location}`));
  return spec;
}

module.exports = { parseVantageXml };
