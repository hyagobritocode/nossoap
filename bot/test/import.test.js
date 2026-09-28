import { test } from "node:test";
import assert from "node:assert/strict";
import { groupNameFromFile, parseExport, zonedToEpoch } from "../src/import-export.js";

test("converte horário de Brasília para UTC", () => {
  assert.equal(zonedToEpoch(2026, 9, 28, 14, 3, 0, "America/Sao_Paulo"), Date.UTC(2026, 8, 28, 17, 3) / 1000);
});

test("lê export do Android e do iPhone, com mensagens de várias linhas", () => {
  const android = [
    "28/09/2026 14:03 - As mensagens são protegidas com a criptografia de ponta a ponta.",
    "28/09/2026 14:05 - Ofertas Bot: 🔥 TV LG 50\"",
    "Por R$ 2.199",
    "https://amzn.to/x",
    "28/09/2026 14:06 - Maria entrou usando o link de convite deste grupo",
    "28/09/2026 14:07 - Maria: obrigada!"
  ].join("\n");
  const a = parseExport(android, "America/Sao_Paulo");
  assert.equal(a.length, 2);
  assert.equal(a[0].sender, "Ofertas Bot");
  assert.equal(a[0].text, "🔥 TV LG 50\"\nPor R$ 2.199\nhttps://amzn.to/x");
  assert.equal(a[1].text, "obrigada!");

  const ios = "‎[28/09/26, 14:05:09] Ofertas: Air fryer R$ 299\r\nhttps://a.co/1\r\n";
  const i = parseExport(ios, "America/Sao_Paulo");
  assert.equal(i.length, 1);
  assert.equal(i[0].text, "Air fryer R$ 299\nhttps://a.co/1");
  assert.equal(i[0].ts, Date.UTC(2026, 8, 28, 17, 5, 9) / 1000);
});

test("nome do grupo pelo nome do arquivo", () => {
  assert.equal(groupNameFromFile("/x/Conversa do WhatsApp com Achadinhos 🔥.txt"), "Achadinhos 🔥");
  assert.equal(groupNameFromFile("WhatsApp Chat with Promo.txt"), "Promo");
});
