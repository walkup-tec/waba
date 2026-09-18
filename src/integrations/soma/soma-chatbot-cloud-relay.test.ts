import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import express from "express";
import {
  registerSomaChatbotCloudRelayRoutes,
  relaySomaChatbotCloudWebhook,
} from "./soma-chatbot-cloud-relay";

const originalKey = process.env.SOMA_WABA_INTEGRATION_KEY;
const originalUrl = process.env.SOMA_CHAT_CLOUD_WEBHOOK_URL;
const registryFile = path.join(process.cwd(), "data", "soma-chatbot-cloud-numbers.json");

const cloudPayload = (phoneNumberId: string) => ({
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: phoneNumberId },
            messages: [{ id: "wamid.1", type: "text" }],
          },
        },
      ],
    },
  ],
});

const writeRegistry = (payload: unknown) => {
  mkdirSync(path.dirname(registryFile), { recursive: true });
  writeFileSync(registryFile, JSON.stringify(payload, null, 2));
};

describe("Soma ChatBot Cloud relay", () => {
  before(() => {
    process.env.SOMA_WABA_INTEGRATION_KEY = "soma-test-key";
    delete process.env.SOMA_CHAT_CLOUD_WEBHOOK_URL;
    writeRegistry({ webhookUrl: null, numbers: {} });
  });

  after(() => {
    if (originalKey === undefined) delete process.env.SOMA_WABA_INTEGRATION_KEY;
    else process.env.SOMA_WABA_INTEGRATION_KEY = originalKey;
    if (originalUrl === undefined) delete process.env.SOMA_CHAT_CLOUD_WEBHOOK_URL;
    else process.env.SOMA_CHAT_CLOUD_WEBHOOK_URL = originalUrl;
    if (existsSync(registryFile)) rmSync(registryFile, { force: true });
  });

  it("recusa sem chave e registra/unregister o phone_number_id", async () => {
    writeRegistry({ webhookUrl: null, numbers: {} });
    const app = express();
    app.use(express.json());
    registerSomaChatbotCloudRelayRoutes(app);
    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    try {
      const denied = await fetch(`http://127.0.0.1:${port}/integrations/soma/chatbot-cloud-numbers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", phoneNumberId: "1099" }),
      });
      assert.equal(denied.status, 401);
      const deniedBody = (await denied.json()) as { error?: string };
      assert.equal(deniedBody.error, "Não autorizado.");

      const registered = await fetch(`http://127.0.0.1:${port}/integrations/soma/chatbot-cloud-numbers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Soma-Waba-Key": "soma-test-key",
        },
        body: JSON.stringify({
          action: "register",
          phoneNumberId: "1099",
          webhookUrl: "https://app.somaconecta.com.br/api/chat/whatsapp-cloud-webhook",
        }),
      });
      assert.equal(registered.status, 200);
      const registeredBody = (await registered.json()) as { ok?: boolean; total?: number };
      assert.equal(registeredBody.ok, true);
      assert.equal(registeredBody.total, 1);

      const removed = await fetch(`http://127.0.0.1:${port}/integrations/soma/chatbot-cloud-numbers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Soma-Waba-Key": "soma-test-key",
        },
        body: JSON.stringify({ action: "unregister", phoneNumberId: "1099" }),
      });
      assert.equal(removed.status, 200);
      const removedBody = (await removed.json()) as { total?: number };
      assert.equal(removedBody.total, 0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("só encaminha webhook de número registrado e não falha sem match", async () => {
    const received: unknown[] = [];
    const sink = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => {
        received.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => sink.listen(0, "127.0.0.1", resolve));
    const port = (sink.address() as { port: number }).port;
    process.env.SOMA_CHAT_CLOUD_WEBHOOK_URL = `http://127.0.0.1:${port}/hook`;
    writeRegistry({
      webhookUrl: `http://127.0.0.1:${port}/hook`,
      numbers: {
        "555": {
          phoneNumberId: "555",
          updatedAt: new Date().toISOString(),
        },
      },
    });

    try {
      await relaySomaChatbotCloudWebhook(cloudPayload("999"));
      await relaySomaChatbotCloudWebhook(cloudPayload("555"));
      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.equal(received.length, 1);
      assert.equal(
        (received[0] as { entry: Array<{ changes: Array<{ value: { metadata: { phone_number_id: string } } }> }> })
          .entry[0]?.changes[0]?.value.metadata.phone_number_id,
        "555",
      );
    } finally {
      delete process.env.SOMA_CHAT_CLOUD_WEBHOOK_URL;
      await new Promise<void>((resolve) => sink.close(() => resolve()));
    }
  });
});
