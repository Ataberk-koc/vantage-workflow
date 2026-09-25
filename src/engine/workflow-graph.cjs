function createGraph(actions, connections) {
  const nodes = actions.map((action) => ({
    id: action.id,
    type: action.type,
    name: action.name,
    evidence: action.sourceEvidence
  }));
  const nodeIds = new Set(nodes.map((node) => node.id).filter(Boolean));
  const edges = connections.map((connection) => ({
    ...connection,
    resolved: nodeIds.has(connection.from) && nodeIds.has(connection.to)
  }));

  return {
    nodes,
    edges,
    disconnectedNodes: nodes
      .filter((node) => node.id && !edges.some((edge) => edge.from === node.id || edge.to === node.id))
      .map((node) => node.id),
    danglingReferences: edges
      .filter((edge) => !edge.resolved)
      .map((edge) => ({ from: edge.from, to: edge.to, source: edge.source }))
  };
}

module.exports = { createGraph };
