#!/usr/bin/env node
/** Executa runEvoIntegrationProbe (build obrigatório: npm run build). */
require("dotenv").config();
const { runEvoIntegrationProbe } = require("../dist/services/evo-integration-probe.service.js");

runEvoIntegrationProbe()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(99);
  });
