import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const html = readFileSync(path.join(__dirname, "../../../index.html"), "utf8");

describe("Laboratório Conexão: só altera a imagem do número", () => {
  it("o botão Imagem abre o seletor de arquivo e envia a foto, sem modal de perfil", () => {
    assert.match(html, /">Imagem<\/button>"/);
    assert.match(html, /function metaTpPickNumberPhoto/);
    assert.match(html, /function metaTpUploadNumberPhoto/);
    assert.match(html, /id="meta-tp-edit-photo"/);
    assert.match(html, /phone-numbers\/profile/);
    assert.doesNotMatch(html, />Editar perfil</);
    assert.doesNotMatch(html, /id="meta-tp-edit-modal"/);
    assert.doesNotMatch(html, /id="meta-tp-edit-name"/);
    assert.doesNotMatch(html, /wabaSaveMetaWhatsappNumberProfile/);
  });
});

describe("Laboratório Conexão: sem trilha de etapas", () => {
  it("não mostra Conectar, Empresa, WABA, Número, Templates e Inbox", () => {
    assert.match(html, /Conectar Portfólio/);
    assert.doesNotMatch(html, /id="meta-onboard-steps"/);
    assert.doesNotMatch(html, /Etapas de integração/);
    assert.doesNotMatch(html, /Escolha o chip oficial/);
  });
});

describe("Laboratório: menu Automação fora da tela", () => {
  it("não mostra o botão Automação no menu do Laboratório", () => {
    assert.doesNotMatch(html, /id="tab-btn-whatsapp-automation"/);
    assert.doesNotMatch(html, /<span class="tab-label">Automação<\/span>/);
    assert.match(html, /\.tab-button\[data-menu-key="whatsapp-automation"\][\s\S]{0,80}display:\s*none\s*!important/);
  });
});
