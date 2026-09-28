import { test } from "node:test";
import assert from "node:assert/strict";
import { createLlm, friendlyError, LlmError } from "../src/llm.js";

const ok = body => new Response(JSON.stringify(body), { status: 200 });
const fail = (status, message) => new Response(JSON.stringify([{ error: { code: status, message } }]), { status });

function fakeFetch(responses) {
  const seen = [];
  return {
    seen,
    fetchImpl: async (url, init) => { seen.push({ url, ...JSON.parse(init.body), auth: init.headers.authorization }); return responses.shift(); }
  };
}

const opts = { url: "https://x.test/v1/", apiKey: "k", model: "principal", reserveModel: "reserva" };
const noWait = { wait: async () => {} };

test("manda para /chat/completions com a chave e o modelo", async () => {
  const f = fakeFetch([ok({ choices: [] })]);
  await createLlm({ ...opts, reasoning: "low" }, { ...noWait, fetchImpl: f.fetchImpl }).chat({ messages: [] });
  assert.equal(f.seen[0].url, "https://x.test/v1/chat/completions");
  assert.equal(f.seen[0].auth, "Bearer k");
  assert.equal(f.seen[0].model, "principal");
  assert.equal(f.seen[0].reasoning_effort, "low");
});

test("limite por minuto: espera e repete no mesmo modelo", async () => {
  const f = fakeFetch([fail(429, "Resource exhausted, try again"), ok({ choices: [1] })]);
  const r = await createLlm(opts, { ...noWait, fetchImpl: f.fetchImpl }).chat({});
  assert.deepEqual(r.choices, [1]);
  assert.deepEqual(f.seen.map(s => s.model), ["principal", "principal"]);
});

test("cota do dia ou modelo inexistente: passa para o reserva", async () => {
  const daily = fakeFetch([fail(429, "Quota exceeded for GenerateRequestsPerDayPerProjectPerModel"), ok({ choices: [2] })]);
  await createLlm(opts, { ...noWait, fetchImpl: daily.fetchImpl }).chat({});
  assert.deepEqual(daily.seen.map(s => s.model), ["principal", "reserva"]);

  const gone = fakeFetch([fail(404, "model not found"), ok({ choices: [3] })]);
  await createLlm(opts, { ...noWait, fetchImpl: gone.fetchImpl }).chat({});
  assert.deepEqual(gone.seen.map(s => s.model), ["principal", "reserva"]);
});

test("chave inválida não repete e vira mensagem clara", async () => {
  const f = fakeFetch([fail(400, "Please pass a valid API key")]);
  const err = await createLlm(opts, { ...noWait, fetchImpl: f.fetchImpl }).chat({}).catch(e => e);
  assert.ok(err instanceof LlmError);
  assert.equal(f.seen.length, 1);
  assert.match(friendlyError(err), /chave/);
  assert.match(friendlyError(new LlmError(429, "x", { daily: true })), /cota gratuita de hoje/);
});
