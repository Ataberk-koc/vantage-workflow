#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { parseVantageXml } = require('../src/engine/vantage-parser.cjs');

async function collectXmlFiles(rootPath) {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) files.push(...await collectXmlFiles(entryPath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) files.push(entryPath);
  }
  return files.sort();
}

async function parseFile(filePath) {
  return parseVantageXml(filePath);
}

async function scanCorpus(rootPath) {
  const files = await collectXmlFiles(rootPath);
  const results = [];
  const actionTypes = new Map();
  let parserFailures = 0;
  let resolvedEdges = 0;
  let danglingEdges = 0;
  let disconnectedNodes = 0;
  let variableReferences = 0;
  let unknownStructures = 0;

  for (const filePath of files) {
    try {
      const spec = await parseFile(filePath);
      for (const action of spec.actions) actionTypes.set(action.type || 'UNKNOWN', (actionTypes.get(action.type || 'UNKNOWN') || 0) + 1);
      resolvedEdges += spec.graph.edges.filter((edge) => edge.resolved).length;
      danglingEdges += spec.graph.danglingReferences.length;
      disconnectedNodes += spec.graph.disconnectedNodes.length;
      variableReferences += spec.variables.length;
      unknownStructures += spec.unknownStructures.length;
      results.push({
        file: filePath,
        root: spec.source.root,
        actions: spec.actions.length,
        connections: spec.graph.edges.length,
        resolvedConnections: spec.graph.edges.filter((edge) => edge.resolved).length,
        danglingReferences: spec.graph.danglingReferences.length,
        disconnectedNodes: spec.graph.disconnectedNodes.length,
        variables: spec.variables.length,
        unknownStructures: spec.unknownStructures.length,
        status: 'parsed'
      });
    } catch (error) {
      parserFailures += 1;
      results.push({ file: filePath, status: 'failed', error: error.message });
    }
  }

  return {
    schemaVersion: '0.1',
    corpusRoot: path.resolve(rootPath),
    files: files.length,
    parsed: files.length - parserFailures,
    parserFailures,
    graph: { resolvedEdges, danglingEdges, disconnectedNodes },
    variables: { filesWithReferences: results.filter((result) => result.variables > 0).length, references: variableReferences },
    unknownStructures,
    actionTypes: Object.fromEntries([...actionTypes.entries()].sort((left, right) => right[1] - left[1])),
    results
  };
}

function printUsage() {
  console.error('Usage: node bin/vantage-ai.cjs corpus scan <directory> [--json]');
  console.error('       node bin/vantage-ai.cjs inspect <workflow.xml>');
  console.error('       node bin/vantage-ai.cjs graph <workflow.xml>');
  console.error('       node bin/vantage-ai.cjs validate <workflow.xml>');
}

async function main() {
  const [, , command, subcommand, inputPath, outputFlag] = process.argv;
  if (command === 'corpus' && subcommand === 'scan' && inputPath) {
    const report = await scanCorpus(inputPath);
    if (outputFlag === '--json') console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`XML files: ${report.files}`);
      console.log(`Parsed: ${report.parsed}`);
      console.log(`Parser failures: ${report.parserFailures}`);
      console.log(`Resolved graph edges: ${report.graph.resolvedEdges}`);
      console.log(`Dangling references: ${report.graph.danglingEdges}`);
      console.log(`Disconnected nodes: ${report.graph.disconnectedNodes}`);
      console.log(`Variable references: ${report.variables.references}`);
      console.log(`Unknown structures: ${report.unknownStructures}`);
      console.log('Action types:');
      for (const [type, count] of Object.entries(report.actionTypes)) console.log(`  ${type}: ${count}`);
    }
    return;
  }

  if (['inspect', 'graph', 'validate'].includes(command) && subcommand) {
    const spec = await parseFile(subcommand);
    if (command === 'graph') console.log(JSON.stringify(spec.graph, null, 2));
    else if (command === 'validate') console.log(JSON.stringify(spec.validation, null, 2));
    else console.log(JSON.stringify({ source: spec.source, metadata: spec.metadata, actions: spec.actions, connections: spec.connections, variables: spec.variables, unknownStructures: spec.unknownStructures }, null, 2));
    return;
  }

  printUsage();
  process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { collectXmlFiles, scanCorpus };
