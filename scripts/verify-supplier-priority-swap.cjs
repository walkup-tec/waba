"use strict";

function supplierRoutingGroupKey(supplier) {
  const apiKind = supplier?.apiKind === "alternativa" ? "alternativa" : "oficial";
  const segment = supplier?.segment === "bets" ? "bets" : "outros";
  return `${apiKind}:${segment}`;
}

function clampSupplierPriority(value) {
  return Math.max(1, Math.min(5, Math.round(Number(value ?? 1))));
}

function findActiveSupplierIndexByGroupPriority(suppliers, groupKey, priority, excludeIndex) {
  return (suppliers || []).findIndex(
    (item, index) =>
      index !== excludeIndex &&
      item?.active !== false &&
      supplierRoutingGroupKey(item) === groupKey &&
      clampSupplierPriority(item.priority) === priority
  );
}

function applySupplierPrioritySwap(suppliers, changedIndex, newPriorityRaw) {
  if (!Array.isArray(suppliers) || !Number.isFinite(changedIndex)) return false;
  const changed = suppliers[changedIndex];
  if (!changed || changed.active === false) return false;
  const newPriority = clampSupplierPriority(newPriorityRaw);
  const oldPriority = clampSupplierPriority(changed.priority);
  if (newPriority === oldPriority) return false;
  const groupKey = supplierRoutingGroupKey(changed);
  const conflictIndex = findActiveSupplierIndexByGroupPriority(
    suppliers,
    groupKey,
    newPriority,
    changedIndex
  );
  changed.priority = newPriority;
  if (conflictIndex >= 0) {
    suppliers[conflictIndex].priority = oldPriority;
  }
  return true;
}

function hasDuplicateSupplierPriorities(suppliers) {
  const seen = new Set();
  for (const supplier of suppliers || []) {
    if (supplier?.active === false) continue;
    const key = `${supplierRoutingGroupKey(supplier)}:${clampSupplierPriority(supplier.priority)}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const suppliers = [
  { id: "a", name: "Gabriel", apiKind: "oficial", segment: "outros", priority: 1, active: true },
  { id: "b", name: "Jose", apiKind: "oficial", segment: "bets", priority: 1, active: true },
  { id: "c", name: "Jose", apiKind: "oficial", segment: "outros", priority: 2, active: true },
  { id: "d", name: "Douglas", apiKind: "oficial", segment: "outros", priority: 3, active: true },
];

assert(!hasDuplicateSupplierPriorities(suppliers), "baseline should have unique priorities per group");

applySupplierPrioritySwap(suppliers, 3, 1);
assert(suppliers[3].priority === 1, "Douglas should become priority 1 in outros");
assert(suppliers[0].priority === 3, "Gabriel should swap to priority 3 in outros");
assert(!hasDuplicateSupplierPriorities(suppliers), "after swap outros group must stay unique");

applySupplierPrioritySwap(suppliers, 2, 1);
assert(suppliers[2].priority === 1, "Jose outros should become priority 1");
assert(suppliers[3].priority === 2, "Douglas should swap to priority 2");
assert(!hasDuplicateSupplierPriorities(suppliers), "second swap must stay unique");

console.log("verify-supplier-priority-swap: OK");
