// Abre um link de oferta e tira dele o que der: endereço final (desencurtado),
// título, descrição e preço publicado na página.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const MAX_BYTES = 1_500_000;

function isPrivateIp(ip) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

// Os links vêm de mensagens de terceiros: só segue http(s) para endereços públicos.
async function assertPublic(url) {
  if (!/^https?:$/.test(url.protocol)) throw new Error("só abro links http/https");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.some(a => isPrivateIp(a.address))) throw new Error("endereço interno bloqueado");
}

const decode = s => s
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/\s+/g, " ").trim();

function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decode(content) : null;
}

function jsonLdPrice(html) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(m[1]); } catch { continue; }
    const stack = [data];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== "object") continue;
      if (Array.isArray(node)) { stack.push(...node); continue; }
      const offers = node.offers;
      if (offers) {
        const o = Array.isArray(offers) ? offers[0] : offers;
        const price = o?.price ?? o?.lowPrice;
        if (price != null) return { preco: Number(price), moeda: o.priceCurrency || null, disponibilidade: o.availability || null };
      }
      stack.push(...Object.values(node));
    }
  }
  return null;
}

export async function inspectLink(rawUrl, { timeoutMs = 12000 } = {}) {
  let url = new URL(rawUrl);
  const hops = [];
  let res;
  for (let i = 0; i < 8; i++) {
    await assertPublic(url);
    res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": UA, "accept-language": "pt-BR,pt;q=0.9" }
    });
    const next = res.status >= 300 && res.status < 400 && res.headers.get("location");
    if (!next) break;
    hops.push(url.href);
    url = new URL(next, url);
  }

  const out = { url_final: url.href, redirecionamentos: hops.length, status: res.status };
  const type = res.headers.get("content-type") || "";
  if (!type.includes("html")) return out;

  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => {});
  const html = Buffer.concat(chunks).toString("utf8");

  out.titulo = meta(html, "og:title") || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") || null;
  out.descricao = meta(html, "og:description") || meta(html, "description");
  const price = meta(html, "product:price:amount") || meta(html, "og:price:amount") || meta(html, "price");
  out.preco_na_pagina = price ? { preco: Number(price.replace(",", ".")) } : jsonLdPrice(html);
  if (res.status >= 400) out.aviso = "a loja recusou ou não achou a página (pode ser bloqueio a robôs ou oferta encerrada)";
  return out;
}
