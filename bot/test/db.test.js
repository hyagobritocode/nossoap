import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMatch, openDb } from "../src/db.js";

const day = 86400;
const now = Math.floor(Date.now() / 1000);

function seed() {
  const db = openDb(":memory:");
  const add = (chatJid, msgId, groupName, ts, text) => db.addOffer({ chatJid, msgId, groupName, sender: "x", ts, text });
  const tv = `Smart TV LG 50" 4K por R$ 2.199 https://amzn.to/tv1`;
  return {
    db,
    ids: {
      tvA: add("g1@g.us", "1", "Achadinhos da Ana", now - 2 * day, tv),
      tvB: add("g2@g.us", "9", "Promo Brasil", now - 1 * day, tv),           // mesma oferta, outro grupo
      tvSamsung: add("g1@g.us", "2", "Achadinhos da Ana", now - 3 * day, "Televisão Samsung 50 polegadas R$ 1.999 https://s.shopee.com.br/t"),
      suporte: add("g2@g.us", "3", "Promo Brasil", now - 1 * day, "Suporte para TV LG 32 a 50\" R$ 49,90 https://amzn.to/sup"),
      velha: add("g3@g.us", "4", "Ofertas Tech", now - 40 * day, "TV LG 50 polegadas R$ 2.500 https://magazineluiza.com.br/tv"),
      semLink: add("g1@g.us", "5", "Achadinhos da Ana", now, "alguém sabe se a TV LG 50 é boa?")
    }
  };
}

test("buildMatch monta E entre grupos e OU dentro, sem deixar sintaxe passar", () => {
  assert.equal(buildMatch([["tv", "televisao"], ["lg"]]), '("tv" OR "televisao") AND ("lg")');
  assert.equal(buildMatch([['te"le*']]), '("te le"*)');
  assert.equal(buildMatch([[""], []]), "");
});

test("só guarda mensagem com link e não duplica", () => {
  const { db, ids } = seed();
  assert.equal(ids.semLink, null);
  assert.equal(db.addOffer({ chatJid: "g1@g.us", msgId: "1", groupName: "x", ts: now, text: "https://a.co/x" }), null);
  assert.equal(db.stats().total, 5);
});

test("busca com sinônimos, sem acento, junta repostagens e filtra preço/data", () => {
  const { db, ids } = seed();
  const r = db.search({ terms: [["tv", "televisão"], ["50"]] });
  const got = r.ofertas.map(o => o.id);
  assert.deepEqual(got, [ids.tvB, ids.suporte, ids.tvSamsung, ids.velha]); // tvA some: é a mesma do tvB
  assert.deepEqual(r.ofertas[0].tambem_em.map(t => t.grupo), ["Achadinhos da Ana"]);

  const lg = db.search({ terms: [["televis*", "tv"], ["lg"], ["50"]], minPrice: 500, sinceDays: 7 });
  assert.deepEqual(lg.ofertas.map(o => o.id), [ids.tvB]);

  const barato = db.search({ terms: [["tv", "televisao"]], sort: "preco", limit: 2 });
  assert.deepEqual(barato.ofertas.map(o => o.price), [49.9, 1999]);

  assert.equal(db.search({ terms: [["tv", "televisao"]], store: "shopee" }).total, 1);
  assert.equal(db.search({ terms: [["tv"]], group: "tech" }).total, 1);
});

test("alerta dispara uma vez por oferta nova que bate", () => {
  const { db } = seed();
  const id = db.addAlert({ notifyJid: "me", description: "lava e seca", terms: [["lava e seca", "lava-seca"]], maxPrice: 2500 });
  const cara = db.addOffer({ chatJid: "g1@g.us", msgId: "10", groupName: "A", ts: now, text: "Lava e Seca Samsung R$ 3.199 https://a.co/1" });
  const boa = db.addOffer({ chatJid: "g1@g.us", msgId: "11", groupName: "A", ts: now, text: "Lava e Seca LG 11kg R$ 2.299 https://a.co/2" });
  assert.deepEqual(db.alertsFor(cara), []);
  assert.deepEqual(db.alertsFor(boa).map(a => a.id), [id]);
  assert.deepEqual(db.alertsFor(boa), []);
  assert.equal(db.listAlerts("me").length, 1);
  assert.equal(db.removeAlert(id, "outro"), false);
  assert.equal(db.removeAlert(id, "me"), true);
});
