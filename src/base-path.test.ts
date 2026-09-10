import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { patchMetaTplHeaderUploadOnce } from "./base-path";

describe("patch do upload único de cabeçalho", () => {
  it("troca o loop por conexão pelo upload único", () => {
    const html = `const headerHandles = {};
          let headerHandle = "";
          for (let i = 0; i < connectionIds.length; i += 1) {
            const uploaded = await metaTplAiUploadHeaderIfNeeded(connectionIds[i], shell.mediaFormat);
            if (uploaded) headerHandles[connectionIds[i]] = uploaded;
            if (uploaded && !headerHandle) headerHandle = uploaded;
          }
          if (needsMedia) await markStepDone("media");`;
    const patched = patchMetaTplHeaderUploadOnce(html);
    assert.match(patched, /metaTplAiUploadHeaderIfNeeded\(connectionId,/);
    assert.doesNotMatch(patched, /metaTplAiUploadHeaderIfNeeded\(connectionIds\[i\]/);
  });

  it("não altera HTML já corrigido", () => {
    const html =
      'const uploaded = await metaTplAiUploadHeaderIfNeeded(connectionId, shell.mediaFormat);';
    assert.equal(patchMetaTplHeaderUploadOnce(html), html);
  });
});
