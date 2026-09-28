// Banco local (SQLite embutido no Node) com índice de busca de texto (FTS5).
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseOffer } from "./parse.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS groups (
  jid        TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS offers (
  id          INTEGER PRIMARY KEY,
  chat_jid    TEXT NOT NULL,
  msg_id      TEXT NOT NULL,
  group_name  TEXT,
  sender      TEXT,
  ts          INTEGER NOT NULL,           -- segundos desde 1970 (UTC)
  text        TEXT NOT NULL,
  link_title  TEXT,                       -- título da prévia do link, quando o WhatsApp manda
  links       TEXT NOT NULL,              -- JSON
  store       TEXT,
  price       REAL,
  fingerprint TEXT NOT NULL,              -- mesma oferta repostada em outro grupo
  source      TEXT NOT NULL DEFAULT 'whatsapp',
  UNIQUE (chat_jid, msg_id)
);
CREATE INDEX IF NOT EXISTS offers_ts ON offers (ts);
CREATE VIRTUAL TABLE IF NOT EXISTS offers_fts USING fts5 (
  body, tokenize = "unicode61 remove_diacritics 2"
);
CREATE TABLE IF NOT EXISTS alerts (
  id          INTEGER PRIMARY KEY,
  notify_jid  TEXT NOT NULL,
  description TEXT NOT NULL,
  terms       TEXT NOT NULL,              -- JSON: grupos de termos (E entre grupos, OU dentro)
  max_price   REAL,
  created_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS alert_hits (
  alert_id INTEGER NOT NULL,
  offer_id INTEGER NOT NULL,
  PRIMARY KEY (alert_id, offer_id)
);
`;

const now = () => Math.floor(Date.now() / 1000);

export function fingerprintOf(searchable) {
  const norm = searchable.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 300);
  return createHash("sha1").update(norm).digest("hex").slice(0, 16);
}

/**
 * Monta a consulta FTS5 a partir de grupos de termos:
 * [["tv","televisao"],["lg"],["50"]] → ("tv" OR "televisao") AND ("lg") AND ("50").
 * Termo terminado em * vira prefixo ("televis*"). Aspas são removidas: nada do
 * que vem de fora vira sintaxe FTS.
 */
export function buildMatch(termGroups) {
  const groups = [];
  for (const group of termGroups || []) {
    const terms = [];
    for (const raw of [].concat(group)) {
      const prefix = /\*\s*$/.test(String(raw));
      const clean = String(raw).replace(/["*]/g, " ").replace(/\s+/g, " ").trim();
      if (!clean) continue;
      terms.push(`"${clean}"${prefix ? "*" : ""}`);
    }
    if (terms.length) groups.push(`(${terms.join(" OR ")})`);
  }
  return groups.join(" AND ");
}

export function openDb(file) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);

  const q = {
    upsertGroup: db.prepare(`INSERT INTO groups (jid, name, updated_at) VALUES (?, ?, ?)
      ON CONFLICT (jid) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`),
    groupName: db.prepare("SELECT name FROM groups WHERE jid = ?"),
    insertOffer: db.prepare(`INSERT OR IGNORE INTO offers
      (chat_jid, msg_id, group_name, sender, ts, text, link_title, links, store, price, fingerprint, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    insertFts: db.prepare("INSERT INTO offers_fts (rowid, body) VALUES (?, ?)"),
    offerById: db.prepare("SELECT * FROM offers WHERE id = ?"),
    sameFingerprint: db.prepare(`SELECT id, group_name, ts, price FROM offers
      WHERE fingerprint = ? AND id != ? ORDER BY ts DESC LIMIT 20`),
    stats: db.prepare(`SELECT group_name, COUNT(*) AS ofertas, MIN(ts) AS primeira, MAX(ts) AS ultima
      FROM offers GROUP BY chat_jid ORDER BY ultima DESC`),
    total: db.prepare("SELECT COUNT(*) AS n FROM offers"),
    insertAlert: db.prepare(`INSERT INTO alerts (notify_jid, description, terms, max_price, created_at)
      VALUES (?, ?, ?, ?, ?)`),
    listAlerts: db.prepare("SELECT * FROM alerts WHERE notify_jid = ? ORDER BY id"),
    allAlerts: db.prepare("SELECT * FROM alerts"),
    deleteAlert: db.prepare("DELETE FROM alerts WHERE id = ? AND notify_jid = ?"),
    deleteAlertHits: db.prepare("DELETE FROM alert_hits WHERE alert_id = ?"),
    matchOne: db.prepare("SELECT 1 FROM offers_fts WHERE rowid = ? AND offers_fts MATCH ?"),
    insertHit: db.prepare("INSERT OR IGNORE INTO alert_hits (alert_id, offer_id) VALUES (?, ?)")
  };

  return {
    raw: db,

    close() { db.close(); },

    saveGroup(jid, name) { q.upsertGroup.run(jid, name, now()); },
    groupName(jid) { return q.groupName.get(jid)?.name ?? null; },

    /**
     * Guarda a mensagem se ela tiver link (é o que separa oferta de conversa).
     * Devolve o id novo, ou null se não era oferta ou já estava salva.
     */
    addOffer({ chatJid, msgId, groupName = null, sender = null, ts, text, linkTitle = null, source = "whatsapp" }) {
      const offer = parseOffer(text, linkTitle);
      if (!offer.links.length) return null;
      const res = q.insertOffer.run(
        chatJid, msgId, groupName, sender, Math.floor(ts), text, linkTitle,
        JSON.stringify(offer.links), offer.store, offer.price, fingerprintOf(offer.searchable), source
      );
      if (!res.changes) return null;
      const id = Number(res.lastInsertRowid);
      q.insertFts.run(id, [offer.searchable, groupName, offer.store].filter(Boolean).join("\n"));
      return id;
    },

    getOffer(id) {
      const o = q.offerById.get(id);
      if (!o) return null;
      return { ...o, links: JSON.parse(o.links), reposts: q.sameFingerprint.all(o.fingerprint, o.id) };
    },

    /**
     * Busca ofertas. Resultados repetidos (mesmo texto em vários grupos) viram um
     * só, com a lista de onde mais apareceu.
     */
    search({ terms, maxPrice = null, minPrice = null, sinceDays = null, store = null,
             group = null, includeNoPrice = true, sort = "recentes", limit = 15 }) {
      const match = buildMatch(terms);
      if (!match) return { consulta: null, total: 0, ofertas: [] };

      const where = ["offers_fts MATCH ?"];
      const params = [match];
      if (maxPrice != null) { where.push(includeNoPrice ? "(o.price IS NULL OR o.price <= ?)" : "o.price <= ?"); params.push(maxPrice); }
      if (minPrice != null) { where.push(includeNoPrice ? "(o.price IS NULL OR o.price >= ?)" : "o.price >= ?"); params.push(minPrice); }
      if (sinceDays != null) { where.push("o.ts >= ?"); params.push(now() - Math.round(sinceDays * 86400)); }
      if (store) { where.push("o.store LIKE ?"); params.push(`%${store}%`); }
      if (group) { where.push("o.group_name LIKE ?"); params.push(`%${group}%`); }

      const order = sort === "preco" ? "o.price IS NULL, o.price ASC, o.ts DESC"
        : sort === "relevancia" ? "bm25(offers_fts), o.ts DESC"
        : "o.ts DESC";

      const rows = db.prepare(`SELECT o.* FROM offers_fts JOIN offers o ON o.id = offers_fts.rowid
        WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 400`).all(...params);

      const seen = new Map();
      for (const r of rows) {
        const prev = seen.get(r.fingerprint);
        if (prev) {
          prev.tambem_em.push({ grupo: r.group_name, ts: r.ts });
          continue;
        }
        seen.set(r.fingerprint, { ...r, links: JSON.parse(r.links), tambem_em: [] });
      }
      const all = [...seen.values()];
      return { consulta: match, total: all.length, ofertas: all.slice(0, limit) };
    },

    stats() { return { total: q.total.get().n, grupos: q.stats.all() }; },

    addAlert({ notifyJid, description, terms, maxPrice = null }) {
      const match = buildMatch(terms);
      if (!match) throw new Error("alerta sem termos");
      const res = q.insertAlert.run(notifyJid, description, JSON.stringify(terms), maxPrice, now());
      return Number(res.lastInsertRowid);
    },
    listAlerts(notifyJid) {
      return q.listAlerts.all(notifyJid).map(a => ({ ...a, terms: JSON.parse(a.terms) }));
    },
    removeAlert(id, notifyJid) {
      const ok = q.deleteAlert.run(id, notifyJid).changes > 0;
      if (ok) q.deleteAlertHits.run(id);
      return ok;
    },

    /** Alertas que a oferta recém-salva satisfaz (cada alerta avisa uma vez por oferta). */
    alertsFor(offerId) {
      const offer = q.offerById.get(offerId);
      if (!offer) return [];
      const hits = [];
      for (const a of q.allAlerts.all()) {
        if (a.max_price != null && offer.price != null && offer.price > a.max_price) continue;
        if (!q.matchOne.get(offerId, buildMatch(JSON.parse(a.terms)))) continue;
        if (q.insertHit.run(a.id, offerId).changes) hits.push(a);
      }
      return hits;
    }
  };
}
