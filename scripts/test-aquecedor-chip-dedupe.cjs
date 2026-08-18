const {
  buildAquecedorChipIndex,
  dedupeAquecedorConnectedByNumber,
  scoreAquecedorDuplicateInstance,
} = require("../dist/aquecedor/aquecedor-chip-identity.js");
const {
  aquecedorLiveStateAllowsConnected,
} = require("../dist/instances/evo-connection-state.service.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(aquecedorLiveStateAllowsConnected(""), "empty state must keep");
assert(aquecedorLiveStateAllowsConnected("open"), "open must keep");
assert(!aquecedorLiveStateAllowsConnected("close"), "close must drop");
assert(!aquecedorLiveStateAllowsConnected("connecting"), "connecting must drop");

assert(
  scoreAquecedorDuplicateInstance("6635", "555181076635") >
    scoreAquecedorDuplicateInstance("6035", "555181076635"),
  "6635 must beat 6035",
);
assert(
  scoreAquecedorDuplicateInstance("9224", "555199229224") >
    scoreAquecedorDuplicateInstance("soma-9224", "555199229224"),
  "9224 must beat soma-9224",
);

const deduped = dedupeAquecedorConnectedByNumber([
  { instancia: "6035", numero: "555181076635" },
  { instancia: "6635", numero: "555181076635" },
  { instancia: "1261", numero: "555181076261" },
]);
assert(deduped.length === 2, "two chips remain");
assert(deduped.some((r) => r.instancia === "6635"), "keep 6635");
assert(!deduped.some((r) => r.instancia === "6035"), "drop 6035");

const index = buildAquecedorChipIndex([
  { instancia: "6035", numero: "555181076635" },
  { instancia: "6635", numero: "555181076635" },
]);
assert(index.chipToInstance.get("555181076635") === "6635", "chip maps to 6635");

console.log("ok");
