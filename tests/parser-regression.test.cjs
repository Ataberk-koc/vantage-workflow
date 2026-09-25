const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { scanCorpus } = require('../bin/vantage-ai.cjs');

const corpusRoot = process.env.VANTAGE_CORPUS_ROOT || 'C:\\Ata\\Workflow Tasarım Mimarisi\\Vantage\\Vantage';

test('primary Vantage corpus parses without uncontrolled failures', { skip: !fs.existsSync(corpusRoot) }, async () => {
  const report = await scanCorpus(corpusRoot);
  assert.equal(report.files, 101);
  assert.equal(report.parsed, 101);
  assert.equal(report.parserFailures, 0);
  assert.equal(report.graph.danglingEdges, 0);
  assert.ok(report.graph.resolvedEdges > 0);
  assert.ok(report.variables.references > 0);
  assert.ok(report.unknownStructures > 0);
});

test('parser fails closed for DTD and ENTITY input', async () => {
  const temporaryPath = path.join(__dirname, 'unsafe-fixture.xml');
  fs.writeFileSync(temporaryPath, '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///secret">]><root>&xxe;</root>', 'utf8');
  try {
    const { parseVantageXml } = require('../src/engine/vantage-parser.cjs');
    await assert.rejects(() => parseVantageXml(temporaryPath), /DTD and ENTITY/);
  } finally {
    fs.unlinkSync(temporaryPath);
  }
});
