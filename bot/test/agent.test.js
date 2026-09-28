import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import { ago, createAgent, toWhatsApp } from "../src/agent.js";
import { messageText } from "../src/whatsapp.js";

const config = { timeZone: "America/Sao_Paulo", conversationTtlHours: 3 };

// IA falsa: devolve respostas prontas e guarda o que recebeu.
function fakeLlm(replies) {
  const calls = [];
  return {
    calls,
    chat: async body => { calls.push(structuredClone(body)); return replies.shift(); }
  };
}
const say = (content, finish_reason = "stop") => ({ choices: [{ finish_reason, message: { role: "assistant", content } }] });
const callTool = (id, name, args, extra) => ({
  choices: [{ finish_reason: "tool_calls", message: { role: "assistant", content: null,
    tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) }, ...(extra ? { extra_content: extra } : {}) }] } }]
});

test("roda a busca pedida pela IA e devolve a resposta final", async () => {
  const db = openDb(":memory:");
  db.addOffer({ chatJid: "g@g.us", msgId: "1", groupName: "Achadinhos", ts: Date.now() / 1000 - 3600, text: "TV LG 50\" R$ 2.199 https://amzn.to/x" });
  const signature = { google: { thought_signature: "abc" } };
  const llm = fakeLlm([
    callTool("t1", "buscar_ofertas", { termos: [["tv"], ["lg"]] }, signature),
    say("Achei **1 TV**."),
    say("É da Amazon.")
  ]);
  const agent = createAgent({ db, llm, config });

  assert.equal(await agent.ask("me", "tv 50 lg"), "Achei *1 TV*.");
  const [first, second] = llm.calls;
  assert.equal(first.messages[0].role, "system");
  assert.equal(first.tools.find(t => t.function.name === "buscar_ofertas").type, "function");
  assert.equal(first.tools.find(t => t.function.name === "visao_geral").function.parameters, undefined);

  const [, , assistant, toolMsg] = second.messages;
  assert.deepEqual(assistant.tool_calls[0].extra_content, signature); // assinatura do Gemini volta intacta
  assert.equal(toolMsg.role, "tool");
  assert.equal(toolMsg.tool_call_id, "t1");
  const result = JSON.parse(toolMsg.content);
  assert.equal(result.encontradas, 1);
  assert.equal(result.ofertas[0].loja, "Amazon");
  assert.equal(result.ofertas[0].grupo, "Achadinhos");

  // a conversa continua com o histórico (sem repetir o system)
  assert.equal(await agent.ask("me", "de qual loja?"), "É da Amazon.");
  const third = llm.calls[2].messages;
  assert.equal(third.length, 6); // system, pergunta, chamada, resultado, resposta, pergunta nova
  assert.equal(third.filter(m => m.role === "system").length, 1);
});

test("argumento inválido e ferramenta desconhecida voltam como erro para a IA; falha não suja o histórico", async () => {
  const db = openDb(":memory:");
  const bad = { choices: [{ finish_reason: "tool_calls", message: { role: "assistant", content: "",
    tool_calls: [{ type: "function", function: { name: "buscar_ofertas", arguments: "{quebrado" } },
                 { id: "b", type: "function", function: { name: "inexistente", arguments: "{}" } }] } }] };
  const llm = fakeLlm([bad, say("ok")]);
  const agent = createAgent({ db, llm, config, log: { warn() {} } });
  assert.equal(await agent.ask("me", "oi"), "ok");
  const results = llm.calls[1].messages.filter(m => m.role === "tool");
  assert.equal(results.length, 2);
  assert.ok(results[0].tool_call_id); // id gerado quando o provedor não manda
  assert.equal(llm.calls[1].messages.find(m => m.tool_calls).tool_calls[0].id, results[0].tool_call_id);
  assert.ok(results.every(r => JSON.parse(r.content).erro));

  llm.chat = async () => { throw new Error("caiu"); };
  await assert.rejects(agent.ask("me", "de novo"));
  llm.chat = async body => { llm.calls.push(structuredClone(body)); return say("voltei"); };
  assert.equal(await agent.ask("me", "e agora?"), "voltei");
  assert.equal(llm.calls.at(-1).messages.length, 7); // system, oi, chamadas, 2 resultados, ok, "e agora?"
});

test("markdown vira formatação do WhatsApp", () => {
  const md = "## Melhores ofertas\n\n\n- **TV LG** por R$ 2.199\n* [Amazon](https://amzn.to/x)\n<think>pensando</think>~~R$ 3.000~~";
  assert.equal(toWhatsApp(md), "*Melhores ofertas*\n\n• *TV LG* por R$ 2.199\n• Amazon: https://amzn.to/x\n~R$ 3.000~");
  assert.equal(toWhatsApp("*já no formato* _ok_"), "*já no formato* _ok_");
  assert.equal(toWhatsApp("antes\n\n---\n\ndepois"), "antes\n\ndepois");
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
