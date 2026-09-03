import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CAMPAIGN_VIDEO_ERROR,
  CAMPAIGN_VIDEO_MAX_BYTES,
  parseCampaignMediaKind,
  sniffCampaignMediaMime,
  validateCampaignIntakeMedia,
} from "./waba-campaign-intake-media";

describe("mídia da campanha do assinante", () => {
  it("trata vídeo só quando o assinante escolhe vídeo", () => {
    assert.equal(parseCampaignMediaKind("video"), "video");
    assert.equal(parseCampaignMediaKind("VIDEO"), "video");
    assert.equal(parseCampaignMediaKind("image"), "image");
    assert.equal(parseCampaignMediaKind(""), "image");
  });

  it("reconhece MP4 pelos bytes ftyp e recusa 3GP/QuickTime", () => {
    const mp4 = Buffer.alloc(12, 0);
    mp4.write("ftyp", 4, "ascii");
    mp4.write("isom", 8, "ascii");
    assert.equal(sniffCampaignMediaMime(mp4), "video/mp4");

    const threeGp = Buffer.alloc(12, 0);
    threeGp.write("ftyp", 4, "ascii");
    threeGp.write("3gp4", 8, "ascii");
    assert.equal(sniffCampaignMediaMime(threeGp), null);

    const quickTime = Buffer.alloc(12, 0);
    quickTime.write("ftyp", 4, "ascii");
    quickTime.write("qt  ", 8, "ascii");
    assert.equal(sniffCampaignMediaMime(quickTime), null);
  });

  it("aceita MP4 até 16 MB e recusa outro formato ou arquivo maior", () => {
    const mp4 = Buffer.alloc(32, 0);
    mp4.write("ftyp", 4, "ascii");
    mp4.write("isom", 8, "ascii");
    const ok = validateCampaignIntakeMedia({
      kind: "video",
      buffer: mp4,
      mime: "video/mp4",
      fileName: "campanha.mp4",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.extension, ".mp4");

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    const asVideo = validateCampaignIntakeMedia({ kind: "video", buffer: jpeg, fileName: "foto.jpg" });
    assert.equal(asVideo.ok, false);
    if (!asVideo.ok) assert.equal(asVideo.error, CAMPAIGN_VIDEO_ERROR);

    const huge = Buffer.alloc(CAMPAIGN_VIDEO_MAX_BYTES + 1, 0);
    huge.write("ftyp", 4, "ascii");
    huge.write("isom", 8, "ascii");
    const tooBig = validateCampaignIntakeMedia({ kind: "video", buffer: huge, fileName: "grande.mp4" });
    assert.equal(tooBig.ok, false);
  });
});
