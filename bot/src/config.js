import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PROVIDERS } from "./llm.js";

if (existsSync(".env")) process.loadEnvFile(".env");

const env = (k, d) => (process.env[k] ?? "").trim() || d;
const list = k => env(k, "").split(",").map(s => s.trim()).filter(Boolean);
const digits = s => s.replace(/\D/g, "");

const providerName = env("IA", "gemini").toLowerCase();
const preset = PROVIDERS[providerName];
if (!preset && !process.env.IA_URL) {
  throw new Error(`IA="${providerName}" não existe. Use ${Object.keys(PROVIDERS).join(", ")}, ou defina IA_URL.`);
}
const reserve = env("IA_MODELO_RESERVA", preset?.reserve || "nenhum");

export const config = {
  dataDir: resolve(env("PASTA_DADOS", "dados")),
  timeZone: env("FUSO", "America/Sao_Paulo"),
  ai: {
    provider: preset ? providerName : "outro",
    url: env("IA_URL", preset?.url),
    apiKey: env("IA_CHAVE", preset?.keyEnv ? env(preset.keyEnv, "") : ""),
    needsKey: !!preset?.keyEnv,
    keyEnv: preset?.keyEnv || "IA_CHAVE",
    model: env("IA_MODELO", preset?.model),
    // Se o principal não existir ou a cota do dia acabar, usa este. "nenhum" desliga.
    reserveModel: reserve === "nenhum" ? null : reserve,
    // low, medium ou high: quanto a IA "pensa" antes de responder (se o modelo aceitar).
    reasoning: env("IA_RACIOCINIO", "") || null
  },
  conversationTtlHours: Number(env("CONVERSA_EXPIRA_HORAS", "3")),
  // Se vazio, guarda ofertas de todos os grupos. Senão, só dos grupos cujo nome
  // contém um desses pedaços (sem diferença de maiúscula/acento).
  groupFilter: list("GRUPOS"),
  groupIgnore: list("GRUPOS_IGNORAR"),
  // Números (com DDI) que podem conversar com o bot em conversa privada, além
  // do "Mensagem para você mesmo". Útil quando o bot roda num segundo número.
  owners: list("DONOS").map(digits).filter(Boolean),
  // Para conectar por código em vez de QR: seu número com DDI, só dígitos.
  pairingNumber: digits(env("PAREAR_NUMERO", "")),
  // Se definido, no "Mensagem para você mesmo" o bot só responde ao que começar
  // com isso (ex.: "?"), e o resto continua sendo suas anotações.
  prefix: env("PREFIXO", ""),
  logLevel: env("LOG", "warn")
};
