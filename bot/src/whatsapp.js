// Conexão com o WhatsApp como "aparelho conectado" (igual ao WhatsApp Web).
// Lê os grupos, guarda as ofertas e conversa com você no "Mensagem para você mesmo".
import makeWASocket, {
  Browsers, DisconnectReason, fetchLatestBaileysVersion, isJidGroup,
  jidNormalizedUser, normalizeMessageContent, useMultiFileAuthState
} from "baileys";
import { rmSync } from "node:fs";
import { join } from "node:path";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { ago, makeDateFmt } from "./agent.js";

const BOT_MARK = "🤖";
const HELP = `${BOT_MARK} *Como usar*
Me diga o que você procura, do seu jeito:
• _tv 50 lg_
• _air fryer até 400 reais, só das últimas 48h_
• _qual foi a geladeira frost free mais barata essa semana?_
• _me avisa quando aparecer lava e seca abaixo de 2500_
Depois é só continuar a conversa sobre o que eu mandar ("abre o segundo link", "tem mais barato na Amazon?").

Comandos: */nova* começa outra conversa · */status* mostra o que já guardei · */ajuda* esta mensagem`;

const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const toSeconds = t => (t == null ? Date.now() / 1000 : typeof t === "object" ? (t.toNumber?.() ?? Number(t.low)) : Number(t));
const userPart = jid => (jid ? jidNormalizedUser(jid).split("@")[0] : "");

/** Texto da mensagem (legenda de foto/vídeo também) e o título da prévia do link. */
export function messageText(message) {
  const c = normalizeMessageContent(message);
  if (!c) return { text: "", linkTitle: null };
  const ext = c.extendedTextMessage;
  const text = c.conversation || ext?.text || c.imageMessage?.caption || c.videoMessage?.caption ||
    c.documentMessage?.caption || c.documentWithCaptionMessage?.message?.documentMessage?.caption || "";
  const linkTitle = [ext?.title, ext?.description].filter(Boolean).join(" — ") || null;
  return { text, linkTitle };
}

export async function startWhatsApp({ db, agent, config }) {
  const logger = pino({ level: config.logLevel });
  const fmtDate = makeDateFmt(config.timeZone);
  const authDir = join(config.dataDir, "sessao");

  const groupAllowed = name => {
    const n = norm(name);
    if (config.groupIgnore.some(g => n.includes(norm(g)))) return false;
    return !config.groupFilter.length || config.groupFilter.some(g => n.includes(norm(g)));
  };

  const sent = new Map();          // id → mensagem que o bot mandou (evita responder a si mesmo)
  const queues = new Map();        // jid → promessa: uma pergunta por vez em cada conversa
  const metaLookups = new Map();   // jid do grupo → busca de nome em andamento
  let sock;
  let reconnectDelay = 2000;

  function isSelfChat(jid) {
    const me = sock.user;
    return !!me && [me.id, me.lid].filter(Boolean).some(m => userPart(m) === userPart(jid));
  }

  function isOwnerChat(msg) {
    if (!config.owners.length || msg.key.fromMe || isJidGroup(msg.key.remoteJid)) return false;
    return [msg.key.remoteJid, msg.key.remoteJidAlt, msg.key.senderPn]
      .some(j => j && j.endsWith("@s.whatsapp.net") && config.owners.includes(userPart(j)));
  }

  async function send(jid, text, quoted) {
    const m = await sock.sendMessage(jid, { text }, quoted ? { quoted } : undefined);
    if (m?.key?.id) {
      sent.set(m.key.id, m.message);
      if (sent.size > 500) sent.delete(sent.keys().next().value);
    }
    return m;
  }

  async function groupName(jid) {
    const known = db.groupName(jid);
    if (known) return known;
    if (!metaLookups.has(jid)) {
      metaLookups.set(jid, sock.groupMetadata(jid)
        .then(meta => { db.saveGroup(jid, meta.subject); return meta.subject; })
        .catch(() => null)
        .finally(() => setTimeout(() => metaLookups.delete(jid), 60_000)));
    }
    return metaLookups.get(jid);
  }

  /** Guarda a mensagem de grupo se for oferta. Devolve o id salvo ou null. */
  async function ingest(msg) {
    const jid = msg.key?.remoteJid;
    if (!msg.message || !isJidGroup(jid)) return null;
    const { text, linkTitle } = messageText(msg.message);
    if (!text) return null;
    const name = await groupName(jid);
    if (!name || !groupAllowed(name)) return null;
    return db.addOffer({
      chatJid: jid,
      msgId: msg.key.id,
      groupName: name,
      sender: msg.pushName || null,
      ts: toSeconds(msg.messageTimestamp),
      text,
      linkTitle
    });
  }

  async function notifyAlerts(offerId) {
    for (const alert of db.alertsFor(offerId)) {
      const o = db.getOffer(offerId);
      const body = o.text.length > 900 ? o.text.slice(0, 900) + "…" : o.text;
      await send(alert.notify_jid,
        `${BOT_MARK} 🔔 *Alerta: ${alert.description}*\n_${o.group_name} · ${fmtDate(o.ts)} (${ago(o.ts)})_\n\n${body}`
      ).catch(err => logger.warn({ err }, "falha ao avisar alerta"));
    }
  }

  async function handleCommand(jid, text, msg) {
    const [cmd] = text.trim().toLowerCase().split(/\s+/);
    if (cmd === "/nova") {
      agent.reset(jid);
      await send(jid, `${BOT_MARK} Pronto, conversa nova. O que você procura?`);
      return true;
    }
    if (cmd === "/ajuda") { await send(jid, HELP); return true; }
    if (cmd === "/status") {
      const s = db.stats();
      const lines = s.grupos.slice(0, 40).map(g => `• ${g.group_name}: ${g.ofertas} (última ${ago(g.ultima)})`);
      await send(jid, `${BOT_MARK} *${s.total} ofertas guardadas* de ${s.grupos.length} grupos\n${lines.join("\n") || "Nenhuma ainda — as novas entram conforme chegam nos grupos."}`, msg);
      return true;
    }
    return false;
  }

  async function answer(jid, text, msg) {
    if (text.startsWith("/") && await handleCommand(jid, text, msg)) return;
    await sock.sendMessage(jid, { react: { text: "🔎", key: msg.key } }).catch(() => {});
    try {
      const reply = await agent.ask(jid, text);
      await send(jid, `${BOT_MARK} ${reply}`);
    } catch (err) {
      logger.error({ err }, "falha ao responder");
      await send(jid, `${BOT_MARK} Deu erro ao buscar agora (${err.status || err.code || "sem detalhe"}). Tenta de novo em instantes.`);
    } finally {
      await sock.sendMessage(jid, { react: { text: "", key: msg.key } }).catch(() => {});
    }
  }

  function enqueue(jid, job) {
    const next = (queues.get(jid) || Promise.resolve()).then(job, job);
    queues.set(jid, next.catch(() => {}));
  }

  function onUpsert({ messages, type }) {
    for (const msg of messages) {
      const jid = msg.key?.remoteJid;
      if (!jid || !msg.message) continue;

      if (isJidGroup(jid)) {
        ingest(msg)
          .then(id => { if (id && type === "notify") return notifyAlerts(id); })
          .catch(err => logger.warn({ err }, "falha ao guardar mensagem"));
        continue;
      }

      // Pergunta para o bot: só mensagem nova de verdade (não sincronização de histórico).
      if (type !== "notify" || sent.has(msg.key.id)) continue;
      if (Date.now() / 1000 - toSeconds(msg.messageTimestamp) > 120) continue;
      const fromSelf = msg.key.fromMe && isSelfChat(jid);
      if (!fromSelf && !isOwnerChat(msg)) continue;

      let { text } = messageText(msg.message);
      text = text.trim();
      if (!text || text.startsWith(BOT_MARK)) continue;
      if (fromSelf && config.prefix) {
        if (!norm(text).startsWith(norm(config.prefix))) continue;
        text = text.slice(config.prefix.length).trim();
        if (!text) continue;
      }
      enqueue(jid, () => answer(jid, text, msg));
    }
  }

  async function onHistory({ chats, messages }) {
    for (const c of chats || []) if (isJidGroup(c.id) && c.name) db.saveGroup(c.id, c.name);
    let saved = 0;
    for (const msg of messages || []) if (await ingest(msg).catch(() => null)) saved++;
    if (saved) console.log(`Histórico: +${saved} ofertas guardadas (total ${db.stats().total}).`);
  }

  async function refreshGroups() {
    const all = await sock.groupFetchAllParticipating();
    const names = Object.values(all).map(g => { db.saveGroup(g.id, g.subject); return g.subject; });
    const used = names.filter(groupAllowed);
    console.log(`Grupos: ${names.length} no total, ${used.length} sendo lidos.`);
    if (config.groupFilter.length && !used.length) {
      console.log("Nenhum grupo bateu com GRUPOS no .env — confira os nomes.");
    }
  }

  async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion({ signal: AbortSignal.timeout(10_000) }).catch(() => ({ version: undefined }));
    let pairingRequested = false;
    console.log("Conectando ao WhatsApp…");

    sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      logger,
      // "Desktop" faz o WhatsApp mandar mais histórico ao conectar
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: true,
      // não aparecer "online" o tempo todo: assim as notificações continuam chegando no celular
      markOnlineOnConnect: false,
      getMessage: async key => sent.get(key.id)
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messages.upsert", onUpsert);
    sock.ev.on("messaging-history.set", ev => onHistory(ev).catch(err => logger.warn({ err }, "histórico")));
    sock.ev.on("groups.upsert", groups => groups.forEach(g => g.subject && db.saveGroup(g.id, g.subject)));
    sock.ev.on("groups.update", groups => groups.forEach(g => g.subject && db.saveGroup(g.id, g.subject)));

    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        if (config.pairingNumber) {
          if (!pairingRequested) {
            pairingRequested = true;
            const code = await sock.requestPairingCode(config.pairingNumber);
            console.log(`\nNo celular: WhatsApp > Aparelhos conectados > Conectar aparelho > Conectar com número de telefone.\nCódigo: ${code}\n`);
          }
        } else {
          console.log("\nNo celular: WhatsApp > Aparelhos conectados > Conectar aparelho, e leia o QR:\n");
          qrcode.generate(qr, { small: true });
        }
      }
      if (connection === "open") {
        reconnectDelay = 2000;
        console.log(`Conectado como ${sock.user?.name || userPart(sock.user?.id)}. Mande mensagem em "Mensagem para você mesmo" (Você).`);
        refreshGroups().catch(err => logger.warn({ err }, "falha ao listar grupos"));
      }
      if (connection === "close") {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          console.log("O WhatsApp desconectou este aparelho. Apagando a sessão; rode de novo para ler outro QR.");
          rmSync(authDir, { recursive: true, force: true });
          process.exit(1);
        }
        const wait = code === DisconnectReason.restartRequired ? 0 : reconnectDelay;
        reconnectDelay = Math.min(reconnectDelay * 2, 60_000);
        logger.warn({ code }, "conexão caiu, reconectando");
        setTimeout(() => connect().catch(err => { console.error(err); process.exit(1); }), wait);
      }
    });
  }

  await connect();
}
