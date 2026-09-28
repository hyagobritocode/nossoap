// Importa conversas exportadas pelo próprio WhatsApp (Mais opções > Exportar conversa > Sem mídia).
// Serve para trazer o histórico antigo dos grupos, que a conexão não baixa inteiro.
//   npm run importar -- "Conversa do WhatsApp com Achadinhos.txt" [outro.txt ...] [--grupo "Nome"]
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// Android: "28/09/2026 14:03 - Nome: texto"   iOS: "[28/09/2026, 14:03:22] Nome: texto"
const STAMP_RE = /^\u200e?\[?\d{1,2}\/\d{1,2}\/\d{2,4},? \d{1,2}:\d{2}/;
const LINE_RE = /^\u200e?\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?\]?(?: -)? ([^:]+?): ([\s\S]*)$/;

/** Converte data/hora "de parede" num fuso para segundos UTC. */
export function zonedToEpoch(y, mo, d, h, mi, s, timeZone) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).formatToParts(new Date(guess)).map(p => [p.type, p.value]));
  const asZone = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.floor((guess - (asZone - guess)) / 1000);
}

export function parseExport(content, timeZone) {
  const out = [];
  let cur = null;
  for (const line of content.replace(/\r/g, "").split("\n")) {
    const m = line.match(LINE_RE);
    if (m) {
      if (cur) out.push(cur);
      const [, d, mo, y, h, mi, s = "0", sender, text] = m;
      const year = y.length === 2 ? 2000 + Number(y) : Number(y);
      cur = { ts: zonedToEpoch(year, +mo, +d, +h, +mi, +s, timeZone), sender: sender.replace(/^\u200e/, "").trim(), text };
    } else if (STAMP_RE.test(line)) {
      // aviso do sistema ("Fulano entrou usando o link"): encerra a mensagem anterior
      if (cur) out.push(cur);
      cur = null;
    } else if (cur) {
      cur.text += "\n" + line;
    }
  }
  if (cur) out.push(cur);
  return out.map(m => ({ ...m, text: m.text.replace(/\u200e/g, "").trim() }));
}

export function groupNameFromFile(file) {
  const name = basename(file).replace(/\.txt$/i, "");
  return name.match(/(?:Conversa do WhatsApp com|WhatsApp Chat with|WhatsApp Chat -)\s*(.+)$/i)?.[1].trim() || name;
}

export function importFile(db, file, { groupName, timeZone }) {
  const name = groupName || groupNameFromFile(file);
  const known = db.raw.prepare("SELECT jid FROM groups WHERE name = ?").get(name);
  const chatJid = known?.jid || `importado:${name}`;
  let saved = 0;
  const messages = parseExport(readFileSync(file, "utf8"), timeZone);
  db.raw.exec("BEGIN");
  try {
    for (const m of messages) {
      const msgId = createHash("sha1").update(`${m.ts}|${m.sender}|${m.text}`).digest("hex").slice(0, 20);
      if (db.addOffer({ chatJid, msgId, groupName: name, sender: m.sender, ts: m.ts, text: m.text, source: "importado" })) saved++;
    }
    db.raw.exec("COMMIT");
  } catch (err) {
    db.raw.exec("ROLLBACK");
    throw err;
  }
  return { group: name, messages: messages.length, saved };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { config } = await import("./config.js");
  const { openDb } = await import("./db.js");
  const args = process.argv.slice(2);
  const gi = args.indexOf("--grupo");
  const groupName = gi >= 0 ? args.splice(gi, 2)[1] : null;
  if (!args.length) {
    console.log('Uso: npm run importar -- "Conversa do WhatsApp com Grupo.txt" [mais.txt ...] [--grupo "Nome do grupo"]');
    process.exit(1);
  }
  const db = openDb(join(config.dataDir, "ofertas.db"));
  for (const file of args) {
    const r = importFile(db, file, { groupName, timeZone: config.timeZone });
    console.log(`${r.group}: ${r.messages} mensagens lidas, ${r.saved} ofertas novas.`);
  }
  console.log(`Total no banco: ${db.stats().total} ofertas.`);
  db.close();
}
