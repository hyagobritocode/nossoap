import { test } from "node:test";
import assert from "node:assert/strict";
import { bestPrice, extractLinks, extractPrices, guessTitle, parseOffer, storeOf } from "../src/parse.js";

const POST = `🔥 *Smart TV LG 50" 4K UHD ThinQ AI 50UT8050*

De R$ 2.999,00
Por *R$ 2.199,00* à vista
ou 10x de R$ 229,90 sem juros
🎟️ Cupom: TV50 (R$ 100 OFF)

🛒 https://amzn.to/3AbCdEf
https://mercadolivre.com/sec/1xYz.`;

test("pega o preço final e ignora parcela e cupom", () => {
  assert.deepEqual(extractPrices(POST), [2999, 2199]);
  assert.equal(bestPrice(POST), 2199);
  assert.equal(bestPrice("Frete R$ 9,90 — Fone por R$59"), 59);
  assert.equal(bestPrice("sem preço"), null);
});

test("links limpos e loja pelo domínio", () => {
  assert.deepEqual(extractLinks(POST), ["https://amzn.to/3AbCdEf", "https://mercadolivre.com/sec/1xYz"]);
  assert.equal(storeOf("https://amzn.to/x"), "Amazon");
  assert.equal(storeOf("https://produto.mercadolivre.com.br/MLB-1"), "Mercado Livre");
  assert.equal(storeOf("https://s.shopee.com.br/abc"), "Shopee");
  assert.equal(storeOf("https://www.magazineluiza.com.br/x"), "Magalu");
  assert.equal(storeOf("https://bit.ly/x"), null);
});

test("título e texto de busca", () => {
  assert.equal(guessTitle(POST), '🔥 Smart TV LG 50" 4K UHD ThinQ AI 50UT8050');
  const o = parseOffer(POST);
  assert.equal(o.store, "Amazon");
  assert.match(o.searchable, /50 polegadas/);
  assert.doesNotMatch(o.searchable, /amzn/);
});
