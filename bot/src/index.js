import { join } from "node:path";
import { config } from "./config.js";
import { openDb } from "./db.js";
import { createAgent } from "./agent.js";
import { startWhatsApp } from "./whatsapp.js";

if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error("Falta a ANTHROPIC_API_KEY no .env (veja o .env.example).");
  process.exit(1);
}

const db = openDb(join(config.dataDir, "ofertas.db"));
const agent = createAgent({ db, config });
console.log(`Banco: ${db.stats().total} ofertas guardadas. Modelo: ${config.model}.`);
await startWhatsApp({ db, agent, config });
