import { join } from "node:path";
import { config } from "./config.js";
import { openDb } from "./db.js";
import { createAgent } from "./agent.js";
import { createLlm } from "./llm.js";
import { startWhatsApp } from "./whatsapp.js";

const { ai } = config;
if (ai.needsKey && !ai.apiKey) {
  console.error(`Falta a chave da IA: preencha ${ai.keyEnv} no .env (veja o README).`);
  process.exit(1);
}
if (!ai.model) {
  console.error("Falta o modelo da IA: preencha IA_MODELO no .env.");
  process.exit(1);
}

const db = openDb(join(config.dataDir, "ofertas.db"));
const llm = createLlm(ai);
const agent = createAgent({ db, llm, config });
console.log(`Banco: ${db.stats().total} ofertas guardadas. IA: ${ai.provider} (${ai.model}${ai.reserveModel ? `, reserva ${ai.reserveModel}` : ""}).`);
await startWhatsApp({ db, agent, config });
