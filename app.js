(() => {
  "use strict";

  // ---------- ambientes (fotos reais do apê) ----------
  const ROOMS = [
    // pos: enquadramento no palco (retrato); band: enquadramento na faixa da ficha (paisagem)
    { id: "estar",      name: "Sala de estar",   photo: "sala",         pos: "50% 55%", band: "50% 36%" },
    { id: "jantar",     name: "Sala de jantar",  photo: "sala",         pos: "50% 72%", band: "50% 52%" },
    { id: "casal",      name: "Quarto do casal", photo: "quarto-casal", pos: "50% 50%", band: "50% 38%" },
    { id: "quarto2",    name: "Quarto 2",        photo: "quarto-2",     pos: "55% 50%", band: "50% 44%" },
    { id: "cozinha",    name: "Cozinha",         photo: "cozinha",      pos: "50% 50%", band: "50% 48%" },
    { id: "lavanderia", name: "Lavanderia",      photo: "lavanderia",   pos: "50% 45%", band: "50% 46%" },
    { id: "varanda",    name: "Varanda",         photo: "varanda",      pos: "40% 45%", band: "50% 42%" },
    { id: "corredor",   name: "Corredor",        photo: "corredor",     pos: "50% 60%", band: "50% 45%" },
    { id: "hall",       name: "Entrada",         photo: "hall",         pos: "50% 55%", band: "50% 42%" }
  ];
  const roomOf = id => ROOMS.find(r => r.id === id) || ROOMS[0];
  const photoOf = (room, small) => `assets/rooms/${room.photo}${small ? "-sm" : ""}.webp`;

  // ---------- ícones (Tabler Icons, MIT) ----------
  const ICONS = {
    wardrobe: '<path d="M14 6a2 2 0 1 0 -4 0c0 1.667 .67 3 2 4h-.008l7.971 4.428a2 2 0 0 1 1.029 1.749v.823a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-.823a2 2 0 0 1 1.029 -1.749l7.971 -4.428"/>',
    panel: '<path d="M3 4a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v16a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-16"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    washer: '<path d="M5 5a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -14"/><path d="M8 14a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M8 6h.01"/><path d="M11 6h.01"/><path d="M14 6h2"/><path d="M8 14c1.333 -.667 2.667 -.667 4 0c1.333 .667 2.667 .667 4 0"/>',
    ac: '<path d="M8 16a3 3 0 0 1 -3 3"/><path d="M16 16a3 3 0 0 0 3 3"/><path d="M12 16v4"/><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -4"/><path d="M7 13v-3a1 1 0 0 1 1 -1h8a1 1 0 0 1 1 1v3"/>',
    tv: '<path d="M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9"/><path d="M16 3l-4 4l-4 -4"/>',
    dining: '<path d="M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12m0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3"/>',
    box: '<path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5"/><path d="M12 12l8 -4.5"/><path d="M12 12l0 9"/><path d="M12 12l-8 -4.5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    x: '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
    check: '<path d="M5 12l5 5l10 -10"/>',
    link: '<path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6"/><path d="M11 13l9 -9"/><path d="M15 4h5v5"/>',
    trash: '<path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
    down: '<path d="M6 9l6 6l6 -6"/>'
  };
  const icon = (k, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ICONS.box}</svg>`;
  const TONES = ["sand", "clay", "sage", "mist", "oat", "taupe"];
  const toneVars = t => `--tone:var(--t-${t});--tone-ink:var(--t-${t}-ink)`;

  // ---------- ponto de partida ----------
  const SEED = [
    { id: "guarda-roupa", name: "Guarda-roupa", room: "casal", icon: "wardrobe", tone: "clay",
      notes: "4 a 6 portas. Medir a parede, a circulação e a abertura das portas.", options: [] },
    { id: "painel", name: "Painel de TV", room: "estar", icon: "panel", tone: "oat",
      notes: "Ripado, amadeirado. Conferir se comporta a TV escolhida.",
      options: [{ id: "o1", title: "Rack + painel Madri 160 cm, ripado", store: "Magalu", price: 1312.92,
        link: "https://www.magazineluiza.com.br/rack-com-painel-para-tv-65-polegadas-ripado-mdf-160x195cm-madri-mavaular/p/abg30jh2h1/mo/racm/", image: "" }] },
    { id: "lavadora", name: "Lavadora", room: "lavanderia", icon: "washer", tone: "mist",
      notes: "Conferir o espaço do nicho, a abertura da tampa e a tensão da tomada.", options: [] },
    { id: "ar", name: "Ar-condicionado", room: "casal", icon: "ac", tone: "sage",
      notes: "Split. Potência (BTUs) conforme o tamanho do cômodo; conferir ponto elétrico e dreno.", options: [] },
    { id: "tv", name: "Televisão", room: "estar", icon: "tv", tone: "taupe",
      notes: "Polegadas compatíveis com o painel e com a distância do sofá.", options: [] },
    { id: "mesa", name: "Mesa de jantar", room: "jantar", icon: "dining", tone: "sand",
      notes: "6 lugares, 180 × 90 cm. O conjunto já vem com as seis cadeiras.",
      options: [{ id: "o1", title: "Conjunto Turquesa, vidro grafite + 6 cadeiras Luanda", store: "Mobly", price: 2294.96,
        link: "https://www.mobly.com.br/conjunto-de-mesa-de-jantar-retangular-com-tampo-de-vidro-grafite-e-6-cadeiras-turquesa-linho-bege-e-imbuia-1171688.html",
        image: "https://static.mobly.com.br/p/Modern-Conjunto-de-Mesa-de-Jantar-Retangular-com-Tampo-de-Vidro-Grafire-Turquesa-e-6-Cadeiras-Luanda-Linho-Bege-e-Imbuia-6052-5861711-2.jpg" }] }
  ].map(i => ({ status: "pesquisando", chosen: null, paid: null, ...i }));

  const STATUSES = [["pesquisando", "Pesquisando"], ["escolhido", "Escolhido"], ["comprado", "Comprado"]];
  const STORES = { mobly: "Mobly", magazineluiza: "Magalu", magalu: "Magalu", madeiramadeira: "MadeiraMadeira", amazon: "Amazon",
    shopee: "Shopee", mercadolivre: "Mercado Livre", casasbahia: "Casas Bahia", pontofrio: "Ponto", tokstok: "Tok&Stok",
    leroymerlin: "Leroy Merlin", americanas: "Americanas", camicado: "Camicado", westwing: "Westwing", etna: "Etna",
    havan: "Havan", fastshop: "Fast Shop", carrefour: "Carrefour", kabum: "KaBuM!", samsung: "Samsung", lg: "LG",
    brastemp: "Brastemp", electrolux: "Electrolux", consul: "Consul", ikea: "IKEA" };

  // ---------- estado ----------
  const KEY = "nosso-ape-v7";
  let state = load();
  let openId = null, addingOpt = false, lastFocus = null, editingCap = false;

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && Array.isArray(s.items)) return { cap: null, ...s };
    } catch (e) { /* armazenamento indisponível: segue com o padrão */ }
    return { items: structuredClone(SEED), cap: null };
  }
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { toast("Não deu para salvar neste navegador."); }
    }, 120);
  }

  // ---------- utilidades ----------
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const money = v => BRL.format(v || 0);
  const fmtInput = v => v == null ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function parseMoney(s) {
    s = String(s ?? "").trim().replace(/r\$\s?/i, "").replace(/\s/g, "");
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
    const n = Number(s.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  }
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  function storeFrom(url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      const key = Object.keys(STORES).find(k => host.includes(k));
      if (key) return STORES[key];
      const base = host.split(".")[0];
      return base.charAt(0).toUpperCase() + base.slice(1);
    } catch (e) { return ""; }
  }
  const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : "";
  const byId = id => state.items.find(i => i.id === id);
  const chosenOpt = it => it.options.find(o => o.id === it.chosen) || null;
  function estimate(it) {
    if (it.status === "comprado" && it.paid) return it.paid;
    const c = chosenOpt(it);
    if (c && c.price) return c.price;
    const prices = it.options.map(o => o.price).filter(Boolean);
    return prices.length ? Math.min(...prices) : null;
  }
  function visualOf(it) {
    const c = chosenOpt(it);
    const withImg = c && c.image ? c : it.options.find(o => o.image);
    return withImg ? safeUrl(withImg.image) : "";
  }

  // ---------- palco ----------
  const imgs = document.querySelectorAll(".stage-img");
  let stageRoom = "estar", front = 0;
  imgs[0].classList.add("intro");
  function showRoom(id) {
    if (id === stageRoom) return;
    stageRoom = id;
    const r = roomOf(id), next = imgs[1 - front], cur = imgs[front];
    const src = photoOf(r);
    next.style.objectPosition = r.pos;
    const swap = () => { cur.classList.remove("is-on", "intro"); next.classList.add("is-on"); front = 1 - front; };
    if (next.getAttribute("src") === src && next.complete) swap();
    else { next.onload = swap; next.src = src; }
    $("#stage-room").textContent = r.name;
  }
  imgs[0].style.objectPosition = roomOf("estar").pos;

  // ---------- render da página ----------
  function render() {
    renderTally();
    renderGrid();
  }

  function renderTally() {
    const items = state.items;
    const priced = items.filter(i => estimate(i) != null);
    const total = priced.reduce((s, i) => s + estimate(i), 0);
    const spent = items.filter(i => i.status === "comprado").reduce((s, i) => s + (estimate(i) || 0), 0);
    const count = s => items.filter(i => i.status === s).length;
    const missing = items.length - priced.length;

    let capHtml;
    if (editingCap) {
      capHtml = `<label class="cap" for="cap-in">Teto de gastos <input id="cap-in" class="num" inputmode="decimal" placeholder="R$ 0,00" value="${fmtInput(state.cap)}"></label>`;
    } else if (state.cap) {
      const left = state.cap - total;
      capHtml = `<p class="cap">${left >= 0
        ? `Sobram <b class="num">${money(left)}</b> do teto de`
        : `<span class="over">Passou <b class="num">${money(-left)}</b> do teto de</span>`}
        <button type="button" id="cap-edit" class="num">${money(state.cap)}</button></p>`;
    } else {
      capHtml = `<p class="cap"><button type="button" id="cap-edit">Definir um teto de gastos</button></p>`;
    }

    $("#tally").innerHTML = `
      <p class="tally-total num">${money(total)}<small>estimado</small></p>
      ${capHtml}
      <p class="tally-sub">${
        missing === 0 ? `Todos os ${items.length} itens já têm preço.`
        : priced.length === 0 ? `Nenhum item com preço ainda.`
        : `${priced.length} de ${items.length} itens com preço. ${missing === 1 ? "Falta 1." : `Faltam ${missing}.`}`
      }${spent ? ` Já gastamos <span class="num">${money(spent)}</span>.` : ""}</p>
      <div class="segs" aria-hidden="true">${items.map(i => `<span class="seg" data-s="${i.status}" title="${esc(i.name)}"></span>`).join("")}</div>
      <p class="legend">
        <span class="l-p"><i></i>${count("pesquisando")} pesquisando</span>
        <span class="l-e"><i></i>${count("escolhido")} escolhido${count("escolhido") === 1 ? "" : "s"}</span>
        <span class="l-c"><i></i>${count("comprado")} comprado${count("comprado") === 1 ? "" : "s"}</span>
      </p>`;

    const edit = $("#cap-edit");
    if (edit) edit.onclick = () => { editingCap = true; renderTally(); const i = $("#cap-in"); i.focus(); i.select(); };
    const inp = $("#cap-in");
    if (inp) {
      const commit = () => { state.cap = parseMoney(inp.value); editingCap = false; save(); renderTally(); };
      inp.onkeydown = e => { if (e.key === "Enter") inp.blur(); if (e.key === "Escape") { inp.onblur = null; editingCap = false; renderTally(); } };
      inp.onblur = commit;
    }
  }

  function priceLine(it) {
    const est = estimate(it);
    if (it.status === "comprado" && it.paid) return `<p class="tile-price num">Pago ${money(it.paid)}</p>`;
    if (chosenOpt(it) && chosenOpt(it).price) return `<p class="tile-price num">${money(est)}</p>`;
    if (est != null) {
      const n = it.options.filter(o => o.price).length;
      return `<p class="tile-price num">${n > 1 ? `<span class="from">a partir de</span>` : ""}${money(est)}</p>`;
    }
    return `<p class="tile-price none">Sem preço ainda</p>`;
  }

  function visualHtml(it, cls = "product") {
    const img = visualOf(it);
    const glyph = `<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">${ICONS[it.icon] || ICONS.box}</svg>`;
    return img
      ? `${glyph}<img class="${cls}" src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
      : glyph;
  }

  function badge(it) {
    if (it.status === "comprado") return `<span class="badge" data-s="comprado">${icon("check")}Comprado</span>`;
    if (it.status === "escolhido") return `<span class="badge" data-s="escolhido">Escolhido</span>`;
    return "";
  }

  function renderGrid() {
    $("#grid").innerHTML = state.items.map(it => `
      <li>
        <button class="tile" type="button" data-id="${esc(it.id)}" style="${toneVars(it.tone)}">
          <div class="tile-visual">${visualHtml(it)}${badge(it)}</div>
          <div class="tile-meta">
            <h3>${esc(it.name)}</h3>
            <p class="tile-room">${esc(roomOf(it.room).name)}</p>
            ${priceLine(it)}
          </div>
        </button>
      </li>`).join("");
  }

  const grid = $("#grid");
  grid.addEventListener("click", e => { const t = e.target.closest(".tile"); if (t) openSheet(t.dataset.id); });
  grid.addEventListener("pointerover", e => {
    const t = e.target.closest(".tile");
    if (t && e.pointerType === "mouse") { const it = byId(t.dataset.id); if (it) showRoom(it.room); }
  });
  grid.addEventListener("focusin", e => { const t = e.target.closest(".tile"); if (t) { const it = byId(t.dataset.id); if (it) showRoom(it.room); } });

  $("#add-item").onclick = () => {
    const used = state.items.map(i => i.tone);
    const tone = TONES.find(t => !used.includes(t)) || TONES[state.items.length % TONES.length];
    const it = { id: uid("i"), name: "", room: "estar", icon: "box", tone, notes: "", options: [], status: "pesquisando", chosen: null, paid: null };
    state.items.push(it);
    save(); render();
    openSheet(it.id, { focusName: true });
  };

  // ---------- ficha do item ----------
  const wrap = $("#sheet-wrap"), sheet = $("#sheet");

  function openSheet(id, opts = {}) {
    const it = byId(id);
    if (!it) return;
    lastFocus = document.activeElement;
    openId = id; addingOpt = false;
    showRoom(it.room);
    renderSheet();
    wrap.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add("open")));
    setTimeout(() => (opts.focusName ? $("#f-name") : sheet).focus({ preventScroll: true }), 60);
  }

  function closeSheet() {
    if (!openId) return;
    const it = byId(openId);
    if (it && !it.name.trim()) it.name = "Novo item";
    openId = null; addingOpt = false;
    wrap.classList.remove("open");
    document.body.style.overflow = "";
    save(); render();
    setTimeout(() => { if (!openId) wrap.hidden = true; }, 420);
    const target = lastFocus && document.contains(lastFocus) ? lastFocus : null;
    if (target) target.focus({ preventScroll: true });
  }

  function heroHtml(it) {
    const room = roomOf(it.room);
    const img = visualOf(it);
    const glyph = `<span class="chip">${icon(it.icon)}</span>`;
    const media = img
      ? `<img class="product" src="${esc(img)}" alt="" referrerpolicy="no-referrer" onerror="this.src='${photoOf(room)}';this.className='';this.style.objectPosition='${room.band}'">`
      : `<img src="${photoOf(room)}" alt="" style="object-position:${room.band}">`;
    return `<div class="sheet-hero" style="${toneVars(it.tone)}">${media}${glyph}<span class="grab"></span>
      <button class="x" type="button" data-close aria-label="Fechar">${icon("x")}</button></div>`;
  }

  function optionsHtml(it) {
    if (!it.options.length) {
      return `<p class="empty-opts">Nenhuma opção ainda. Cole o link de um produto que vocês gostaram para comparar preços aqui.</p>`;
    }
    return `<ul class="opts" role="list">${it.options.map(o => {
      const on = it.chosen === o.id;
      const img = safeUrl(o.image);
      const initial = esc((o.store || o.title || "?").trim().charAt(0).toUpperCase());
      const link = safeUrl(o.link);
      return `<li class="opt">
        <div class="opt-thumb" data-i="${initial}">${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.textContent=this.parentNode.dataset.i">` : initial}</div>
        <div class="opt-main">
          <p class="opt-title">${esc(o.title || "Sem nome")}</p>
          <p class="opt-sub">${o.price ? `<b class="num">${money(o.price)}</b>` : "Sem preço"}${o.store ? `<span aria-hidden="true">·</span>${esc(o.store)}` : ""}</p>
        </div>
        <div class="opt-actions">
          <button type="button" class="pick" data-pick="${esc(o.id)}" aria-pressed="${on}">${on ? icon("check") + "Escolhida" : "Escolher"}</button>
          ${link ? `<a class="icon-btn" href="${esc(link)}" target="_blank" rel="noopener noreferrer" aria-label="Ver na loja">${icon("link")}</a>` : ""}
          <button type="button" class="icon-btn del" data-del-opt="${esc(o.id)}" aria-label="Remover opção ${esc(o.title)}">${icon("trash")}</button>
        </div>
      </li>`;
    }).join("")}</ul>`;
  }

  function optFormHtml() {
    if (!addingOpt) return `<button type="button" class="add-opt-btn" id="add-opt">${icon("plus")}Adicionar opção</button>`;
    return `<form class="opt-form" id="opt-form" novalidate>
      <label class="f"><span>Link do produto</span><input class="input" id="o-link" type="url" inputmode="url" placeholder="https://" autocomplete="off"></label>
      <label class="f"><span>Nome ou modelo</span><input class="input" id="o-title" placeholder="Ex.: Lavadora 12 kg" autocomplete="off"></label>
      <div class="row2">
        <label class="f"><span>Preço</span><input class="input num" id="o-price" inputmode="decimal" placeholder="R$ 0,00" autocomplete="off"></label>
        <label class="f"><span>Loja</span><input class="input" id="o-store" placeholder="Detectada pelo link" autocomplete="off"></label>
      </div>
      <label class="f"><span>Foto (link da imagem, opcional)</span><input class="input" id="o-image" type="url" inputmode="url" placeholder="https://" autocomplete="off"></label>
      <p class="err" id="o-err" hidden></p>
      <div class="form-actions">
        <button type="button" class="btn ghost" id="o-cancel">Cancelar</button>
        <button type="submit" class="btn primary">Salvar opção</button>
      </div>
    </form>`;
  }

  function renderSheet() {
    const it = byId(openId);
    if (!it) return;
    const scroll = sheet.scrollTop;
    sheet.style.cssText = toneVars(it.tone);
    sheet.innerHTML = `
      ${heroHtml(it)}
      <div class="sheet-body">
        <label class="sr" for="f-name">Nome do item</label>
        <input class="name-input" id="f-name" value="${esc(it.name)}" placeholder="Nome do item" autocomplete="off">
        <h2 class="sr" id="sheet-title">${esc(it.name || "Novo item")}</h2>
        <div class="room-pick">
          <label class="sr" for="f-room">Cômodo</label>
          <select id="f-room">${ROOMS.map(r => `<option value="${r.id}" ${r.id === it.room ? "selected" : ""}>${r.name}</option>`).join("")}</select>
          ${icon("down")}
        </div>

        <div class="status" role="group" aria-label="Situação">
          ${STATUSES.map(([k, l]) => `<button type="button" data-s="${k}" aria-pressed="${it.status === k}">${l}</button>`).join("")}
        </div>
        ${it.status === "comprado" ? `
          <div class="paid">
            <label for="f-paid">Quanto pagamos</label>
            <input class="input num" id="f-paid" inputmode="decimal" placeholder="${estimate(it) ? fmtInput(estimate(it)) : "R$ 0,00"}" value="${fmtInput(it.paid)}">
          </div>` : ""}

        <section class="block" aria-labelledby="opts-h">
          <div class="block-head"><h3 id="opts-h">Opções</h3>${it.options.length ? `<span>${it.options.length} ${it.options.length === 1 ? "opção" : "opções"}</span>` : ""}</div>
          ${optionsHtml(it)}
          ${optFormHtml()}
        </section>

        <section class="block">
          <div class="block-head"><h3><label for="f-notes">Medidas e observações</label></h3></div>
          <textarea class="textarea" id="f-notes" rows="3" placeholder="Medidas do espaço, cor, voltagem…">${esc(it.notes)}</textarea>
        </section>

        <div class="sheet-foot">
          <button type="button" class="remove" id="remove">${icon("trash")}Remover item</button>
          <span class="saved">Salvo automaticamente</span>
        </div>
      </div>`;
    sheet.scrollTop = scroll;
    bindSheet(it);
  }

  function bindSheet(it) {
    const name = $("#f-name");
    name.oninput = () => { it.name = name.value; save(); };
    name.onkeydown = e => { if (e.key === "Enter") name.blur(); };

    $("#f-room").onchange = e => { it.room = e.target.value; save(); showRoom(it.room); renderSheet(); };

    sheet.querySelectorAll(".status button").forEach(b => b.onclick = () => {
      it.status = b.dataset.s;
      if (it.status === "escolhido" && !it.chosen && it.options.length === 1) it.chosen = it.options[0].id;
      save(); renderSheet(); render();
      if (it.status === "comprado") setTimeout(() => $("#f-paid")?.focus(), 30);
    });

    const paid = $("#f-paid");
    if (paid) {
      paid.onchange = () => { it.paid = parseMoney(paid.value); paid.value = fmtInput(it.paid); save(); render(); };
      paid.onkeydown = e => { if (e.key === "Enter") paid.blur(); };
    }

    sheet.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => {
      const was = it.chosen === b.dataset.pick;
      it.chosen = was ? null : b.dataset.pick;
      if (!was && it.status === "pesquisando") it.status = "escolhido";
      if (was && it.status === "escolhido") it.status = "pesquisando";
      save(); renderSheet(); render();
    });

    sheet.querySelectorAll("[data-del-opt]").forEach(b => b.onclick = () => {
      const idx = it.options.findIndex(o => o.id === b.dataset.delOpt);
      if (idx < 0) return;
      const [gone] = it.options.splice(idx, 1);
      const wasChosen = it.chosen === gone.id;
      if (wasChosen) { it.chosen = null; if (it.status === "escolhido") it.status = "pesquisando"; }
      save(); renderSheet(); render();
      toast("Opção removida.", () => {
        it.options.splice(idx, 0, gone);
        if (wasChosen) { it.chosen = gone.id; if (it.status === "pesquisando") it.status = "escolhido"; }
        save(); if (openId === it.id) renderSheet(); render();
      });
    });

    const add = $("#add-opt");
    if (add) add.onclick = () => { addingOpt = true; renderSheet(); $("#o-link").focus(); };

    const form = $("#opt-form");
    if (form) {
      const link = $("#o-link"), store = $("#o-store");
      link.oninput = () => { if (!store.dataset.touched) store.value = storeFrom(link.value.trim()); };
      store.oninput = () => { store.dataset.touched = "1"; };
      $("#o-cancel").onclick = () => { addingOpt = false; renderSheet(); $("#add-opt")?.focus(); };
      form.onsubmit = e => {
        e.preventDefault();
        const o = {
          id: uid("o"),
          link: link.value.trim(),
          title: $("#o-title").value.trim(),
          price: parseMoney($("#o-price").value),
          store: store.value.trim(),
          image: $("#o-image").value.trim()
        };
        const err = $("#o-err");
        const bad = (o.link && !safeUrl(o.link)) ? "O link precisa começar com https://"
          : (o.image && !safeUrl(o.image)) ? "O link da foto precisa começar com https://"
          : (!o.link && !o.title) ? "Informe pelo menos o link ou o nome do produto."
          : ($("#o-price").value.trim() && !o.price) ? "Não entendi o preço. Use algo como 1.299,90."
          : "";
        if (bad) { err.textContent = bad; err.hidden = false; return; }
        if (!o.title) o.title = o.store ? `Opção da ${o.store}` : "Opção";
        it.options.push(o);
        addingOpt = false;
        save(); renderSheet(); render();
        $("#add-opt")?.focus();
      };
    }

    const notes = $("#f-notes");
    notes.oninput = () => { it.notes = notes.value; save(); };

    $("#remove").onclick = () => {
      const idx = state.items.findIndex(x => x.id === it.id);
      const [gone] = state.items.splice(idx, 1);
      lastFocus = $("#add-item");
      closeSheet();
      toast(`${gone.name || "Item"} removido.`, () => { state.items.splice(idx, 0, gone); save(); render(); });
    };
  }

  wrap.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeSheet(); });
  document.addEventListener("keydown", e => {
    if (!openId) return;
    if (e.key === "Escape") { e.preventDefault(); closeSheet(); }
    if (e.key === "Tab") {
      const f = [...sheet.querySelectorAll("button, input, select, textarea, a[href]")].filter(el => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // arrastar a ficha para baixo fecha (celular)
  let dragY = null;
  sheet.addEventListener("touchstart", e => { if (sheet.scrollTop <= 0 && e.target.closest(".sheet-hero")) dragY = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener("touchmove", e => {
    if (dragY == null) return;
    const d = Math.max(0, e.touches[0].clientY - dragY);
    sheet.style.transition = "none"; sheet.style.transform = `translateY(${d}px)`;
  }, { passive: true });
  sheet.addEventListener("touchend", e => {
    if (dragY == null) return;
    const d = e.changedTouches[0].clientY - dragY; dragY = null;
    sheet.style.transition = ""; sheet.style.transform = "";
    if (d > 110) closeSheet();
  });

  // ---------- aviso ----------
  let toastTimer;
  function toast(msg, onUndo) {
    const t = $("#toast");
    t.innerHTML = `<span>${esc(msg)}</span>${onUndo ? `<button type="button">Desfazer</button>` : ""}`;
    if (onUndo) t.querySelector("button").onclick = () => { onUndo(); t.classList.remove("show"); };
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), onUndo ? 5000 : 2600);
  }

  render();
})();
