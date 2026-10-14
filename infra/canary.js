// ==============================================================================
// RailSync - AWS CloudWatch Synthetic Canary Script (Node.js)
// Executes every 15 seconds against the public ALB /healthz endpoint.
// Triggers SNS incident alarm if 3 consecutive failures occur (45s detection).
// ==============================================================================

const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');

const pageLoadBlueprint = async function () {
  const url = process.env.ALB_ENDPOINT || "https://railsync.internal.railways.gov.in/healthz";
  
  let stepConfig = {
    includeRequestHeaders: true,
    includeResponseHeaders: true,
    restrictedHeaders: []
  };

  log.info(`Executing synthetic canary check against: ${url}`);
  
  let response = await synthetics.executeHttpStep('Check /healthz Status', url, stepConfig);
  
  if (response.statusCode !== 200) {
    throw new Error(`Canary health probe failed with status code ${response.statusCode}`);
  }
  
  log.info('Synthetic Canary probe succeeded with HTTP 200 OK');
};

exports.handler = async (event, context) => {
  return await pageLoadBlueprint();
};
