// Lightweight mock of n8n-workflow used by Jest tests.
// NodeOperationError is the only runtime export needed by messageBuilder.ts.
class NodeOperationError extends Error {
  node;
  constructor(node, message) {
    super(message);
    this.name = 'NodeOperationError';
    this.node = node;
  }
}

module.exports = { NodeOperationError };
