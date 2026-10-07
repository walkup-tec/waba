import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "os";
import path from "path";
import { after, before, describe, it } from "node:test";
import { EDUARDO_QUANTUMIVST_EMAIL } from "./waba-remove-eduardo-quantumivst-oneshot";
import { WALKUP_MASTER_EMAIL } from "./waba-subscriber-master-visibility";

const originalCwd = process.cwd();
const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-remove-eduardo-"));
const now = "2026-10-07T20:00:00.000Z";

function writeJson(fileName: string, payload: unknown) {
  writeFileSync(path.join(process.cwd(), "data", fileName), JSON.stringify(payload, null, 2));
}

describe("oneshot remove Eduardo quantumivst", () => {
  before(() => {
    process.chdir(dataRoot);
    mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
    writeJson("waba-system-users.json", {
      version: 1,
      users: [
        {
          id: "u-eduardo",
          fullName: "Eduardo",
          email: EDUARDO_QUANTUMIVST_EMAIL,
          passwordHash: "x",
          role: "master",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "u-walkup",
          fullName: "Walkup",
          email: WALKUP_MASTER_EMAIL,
          passwordHash: "x",
          role: "master",
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    writeJson("waba-financeiro-split-config.json", {
      version: 2,
      updatedAt: now,
      suppliers: [],
      participants: [
        {
          id: "part-eduardo",
          label: "Eduardo",
          email: EDUARDO_QUANTUMIVST_EMAIL,
          pixKey: "eduardo@pix",
          sharePercent: 50,
          active: true,
        },
        {
          id: "part-walkup",
          label: "Walkup",
          email: WALKUP_MASTER_EMAIL,
          pixKey: "walkup@pix",
          sharePercent: 50,
          active: true,
        },
      ],
    });
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("apaga o usuário e transfere o percentual do split para o Walkup", async () => {
    const { runRemoveEduardoQuantumivstOneshot } = await import(
      "./waba-remove-eduardo-quantumivst-oneshot"
    );
    const { WabaSystemUserRepository } = await import("./waba-system-user.repository");
    const { WabaFinanceiroSplitRepository } = await import(
      "../billing/waba-financeiro-split.repository"
    );

    const first = runRemoveEduardoQuantumivstOneshot();
    assert.equal(first.ok, true);
    assert.equal(first.applied, true);
    assert.equal(first.userRemoved, true);
    assert.equal(first.splitRemoved, true);
    assert.equal(new WabaSystemUserRepository().getByEmail(EDUARDO_QUANTUMIVST_EMAIL), null);
    const participants = new WabaFinanceiroSplitRepository().get().participants;
    assert.equal(participants.length, 1);
    assert.equal(participants[0].email, WALKUP_MASTER_EMAIL);
    assert.equal(participants[0].sharePercent, 100);

    const second = runRemoveEduardoQuantumivstOneshot();
    assert.equal(second.skipped, true);
    assert.equal(second.userRemoved, false);
  });
});
