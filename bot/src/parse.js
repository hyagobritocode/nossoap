// Extrai o que interessa de uma mensagem de grupo de achadinhos:
// links, preço, loja e um título curto.

const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi;

// "R$ 2.199,90", "R$2199", "R$ 1.299"
const PRICE_RE = /R\$\s?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/gi;

const STORES = [
  ["Amazon", /(^|\.)(amazon\.com(\.br)?|amzn\.to|a\.co)$/],
  ["Mercado Livre", /(^|\.)(mercadolivre\.com(\.br)?|mercadolibre\.com|meli\.la|mlb\.ai)$/],
  ["Shopee", /(^|\.)(shopee\.com\.br|shp\.ee|shope\.ee)$/],
  ["Magalu", /(^|\.)(magazineluiza\.com\.br|magalu\.com(\.br)?|maga\.lu|magazinevoce\.com\.br)$/],
  ["Casas Bahia", /(^|\.)casasbahia\.com\.br$/],
  ["Ponto", /(^|\.)pontofrio\.com\.br$/],
  ["Americanas", /(^|\.)americanas\.com(\.br)?$/],
  ["Submarino", /(^|\.)submarino\.com\.br$/],
  ["AliExpress", /(^|\.)(aliexpress\.com|aliexpress\.us)$/],
  ["KaBuM!", /(^|\.)kabum\.com\.br$/],
  ["Shein", /(^|\.)(shein\.com(\.br)?|onelink\.shein\.com)$/],
  ["Carrefour", /(^|\.)carrefour\.com\.br$/],
  ["Netshoes", /(^|\.)netshoes\.com\.br$/],
  ["Centauro", /(^|\.)centauro\.com\.br$/],
  ["Temu", /(^|\.)temu\.com$/],
  ["Leroy Merlin", /(^|\.)leroymerlin\.com\.br$/],
  ["Fast Shop", /(^|\.)fastshop\.com\.br$/],
  ["Mobly", /(^|\.)mobly\.com\.br$/],
  ["MadeiraMadeira", /(^|\.)madeiramadeira\.com\.br$/],
  ["Natura", /(^|\.)natura\.com\.br$/],
  ["Boticário", /(^|\.)boticario\.com\.br$/],
  ["Drogasil", /(^|\.)drogasil\.com\.br$/]
];

export function extractLinks(text) {
  const found = (text || "").match(URL_RE) || [];
  // tira pontuação que costuma grudar no fim do link
  const links = found.map(u => u.replace(/[)\].,;:!?*_~]+$/, ""));
  return [...new Set(links)];
}

export function storeOf(url) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  for (const [name, re] of STORES) if (re.test(host)) return name;
  return null;
}

export function detectStore(links) {
  for (const l of links) {
    const s = storeOf(l);
    if (s) return s;
  }
  return null;
}

/**
 * Todos os preços "de verdade" da mensagem. Ignora parcela ("10x de R$ 219,90"),
 * cupom/desconto ("R$ 50 OFF") e frete ("frete R$ 9,90").
 */
export function extractPrices(text) {
  const t = text || "";
  const prices = [];
  for (const m of t.matchAll(PRICE_RE)) {
    const before = t.slice(Math.max(0, m.index - 16), m.index).toLowerCase();
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 16).toLowerCase();
    if (/\d+\s*x\s*(de\s*)?$/.test(before)) continue;
    if (/(frete|cupom|desconto|cashback|economi[az]e?)\s*(de\s*)?:?\s*$/.test(before)) continue;
    if (/^\s*(off|de desconto|desconto|a menos|de cashback)/.test(after)) continue;
    const value = Number(m[1].replace(/\./g, "") + "." + (m[2] || "0").padEnd(2, "0"));
    if (value > 0) prices.push(value);
  }
  return prices;
}

/** Preço final anunciado: o menor preço cheio da mensagem ("de R$ 3.000 por R$ 2.199" → 2199). */
export function bestPrice(text) {
  const p = extractPrices(text);
  return p.length ? Math.min(...p) : null;
}

/** Primeira linha com cara de título (sem link, sem só emoji). */
export function guessTitle(text) {
  for (const raw of (text || "").split("\n")) {
    const line = raw.replace(URL_RE, "").replace(/[*_~]/g, "").trim();
    if (line.replace(/[^\p{L}\p{N}]/gu, "").length >= 6) return line.slice(0, 140);
  }
  return null;
}

/** Tira a formatação e acentos para o índice de busca não depender de como foi escrito. */
export function searchableText(text, extra = "") {
  return `${text || ""}\n${extra || ""}`
    .replace(URL_RE, " ")
    .replace(/[*_~]/g, " ")
    // "50”", "50''" e "50pol" viram "50 pol" para achar "tv 50"
    .replace(/(\d)\s*(["”″]|''|pol\b|polegadas\b)/gi, "$1 polegadas ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseOffer(text, extra = "") {
  const links = extractLinks(`${text || ""}\n${extra || ""}`);
  return {
    links,
    store: detectStore(links),
    price: bestPrice(text),
    title: guessTitle(text),
    searchable: searchableText(text, extra)
  };
}
