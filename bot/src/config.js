import { existsSync } from "node:fs";
import { resolve } from "node:path";

if (existsSync(".env")) process.loadEnvFile(".env");

const env = (k, d) => (process.env[k] ?? "").trim() || d;
const list = k => env(k, "").split(",").map(s => s.trim()).filter(Boolean);
const digits = s => s.replace(/\D/g, "");

const model = env("CLAUDE_MODELO", "claude-opus-5");

export const config = {
  dataDir: resolve(env("PASTA_DADOS", "dados")),
  timeZone: env("FUSO", "America/Sao_Paulo"),
  model,
  effort: env("CLAUDE_ESFORCO", "medium"),
  // fallback automático no servidor só existe para os modelos maiores
  fallbacks: env("CLAUDE_FALLBACK", /^claude-(opus-5|fable-5)/.test(model) ? "sim" : "nao") === "sim",
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
