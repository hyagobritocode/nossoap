import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import { ago, createAgent } from "../src/agent.js";
import { messageText } from "../src/whatsapp.js";

const config = { model: "claude-opus-5", effort: "medium", fallbacks: true, timeZone: "America/Sao_Paulo", conversationTtlHours: 3 };

// Cliente falso: devolve respostas prontas e guarda o que recebeu.
function fakeClient(replies) {
  const calls = [];
  return {
    calls,
    beta: { messages: { create: async params => { calls.push(structuredClone(params)); return replies.shift(); } } }
  };
}

test("roda a busca pedida pelo modelo e devolve a resposta final", async () => {
  const db = openDb(":memory:");
  db.addOffer({ chatJid: "g@g.us", msgId: "1", groupName: "Achadinhos", ts: Date.now() / 1000 - 3600, text: "TV LG 50\" R$ 2.199 https://amzn.to/x" });
  const client = fakeClient([
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "buscar_ofertas", input: { termos: [["tv"], ["lg"]] } }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Achei 1 TV." }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "É da Amazon." }] }
  ]);
  const agent = createAgent({ db, config, client });

  assert.equal(await agent.ask("me", "tv 50 lg"), "Achei 1 TV.");
  const [first, second] = client.calls;
  assert.equal(first.fallbacks, "default");
  assert.deepEqual(first.betas, ["server-side-fallback-2026-07-01"]);
  assert.deepEqual(first.thinking, { type: "adaptive" });
  const result = JSON.parse(second.messages.at(-1).content[0].content);
  assert.equal(result.encontradas, 1);
  assert.equal(result.ofertas[0].loja, "Amazon");
  assert.equal(result.ofertas[0].grupo, "Achadinhos");

  // a conversa continua com o histórico
  assert.equal(await agent.ask("me", "de qual loja?"), "É da Amazon.");
  assert.equal(client.calls[2].messages.length, 5);

  agent.reset("me");
});

test("erro de ferramenta volta para o modelo como is_error; falha da API não suja o histórico", async () => {
  const db = openDb(":memory:");
  const client = fakeClient([
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "inexistente", input: {} }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] }
  ]);
  const agent = createAgent({ db, config, client, log: { warn() {} } });
  assert.equal(await agent.ask("me", "oi"), "ok");
  assert.equal(client.calls[1].messages.at(-1).content[0].is_error, true);

  client.beta.messages.create = async () => { throw new Error("caiu"); };
  await assert.rejects(agent.ask("me", "de novo"));
  client.beta.messages.create = async params => { client.calls.push(structuredClone(params)); return { stop_reason: "end_turn", content: [{ type: "text", text: "voltei" }] }; };
  assert.equal(await agent.ask("me", "e agora?"), "voltei");
  assert.equal(client.calls.at(-1).messages.length, 5); // oi, tool_use, result, ok, "e agora?"
});

test("recusa vira mensagem amigável", async () => {
  const client = fakeClient([{ stop_reason: "refusal", content: [] }]);
  const agent = createAgent({ db: openDb(":memory:"), config, client });
  assert.match(await agent.ask("me", "x"), /Não consegui/);
});

test("ago e texto de mensagens do WhatsApp", () => {
  const now = 1_000_000;
  assert.equal(ago(now - 120, now), "há 2 min");
  assert.equal(ago(now - 5 * 3600, now), "há 5 h");
  assert.equal(ago(now - 3 * 86400, now), "há 3 dias");

  assert.equal(messageText({ conversation: "oi" }).text, "oi");
  assert.deepEqual(messageText({ extendedTextMessage: { text: "TV https://a.co/1", title: "Smart TV LG", description: "Amazon.com.br" } }),
    { text: "TV https://a.co/1", linkTitle: "Smart TV LG — Amazon.com.br" });
  assert.equal(messageText({ ephemeralMessage: { message: { imageMessage: { caption: "foto https://x.y" } } } }).text, "foto https://x.y");
});
