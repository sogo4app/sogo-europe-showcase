(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) if (c != null) n.append(c);
    return n;
  };
  const ICON_DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14"/></svg>';
  const ICON_APPLE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9s-1.9-.9-3.2-.8c-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.2.8 2.1-1.2 2.9-2.4c.9-1.3 1.3-2.6 1.3-2.7 0 0-2.4-1-2.4-3.9zM14 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3l10.5 9L4 21z" fill="#2EE88A"/><path d="M4 3l13.5 7.7-3 2.3z" fill="#F7CF2E"/><path d="M4 21l13.5-7.7-3-2.3z" fill="#ff6b6b"/><path d="M17.5 10.7L21 12.7l-3.5 2-3-2.7z" fill="#4c8dff"/></svg>';

  const SHOT_LABELS = { discover: "Discover", chat: "Chat", call: "Call", reels: "Reels", gifts: "Gifts", search: "Search", end: "End card" };
  // Where a language has no preview video / voice-over, show the one the store falls back to.
  const VIDEO_FALLBACK = { "en-US": "en-GB", "en-AU": "en-GB", "es-MX": "es-ES", "pt-BR": "pt-PT", "fr-CA": "fr-FR" };
  const LIMITS = { name: 30, subtitle: 30, promotionalText: 170, title: 30, short: 80, description: 4000, full: 4000 };

  let M, byCode, lang;
  const listeners = [];
  const onLang = fn => listeners.push(fn);

  const store = {
    get() { try { return localStorage.getItem("sogoShowcaseLang"); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem("sogoShowcaseLang", v); } catch (e) {} }
  };

  function setLang(code, opts = {}) {
    if (!byCode[code] || code === lang) return;
    lang = code;
    store.set(code);
    $("#langSelect").value = code;
    if (!opts.noHash) history.replaceState(null, "", "#lang=" + code);
    listeners.forEach(fn => fn(code));
  }

  const fmtMB = b => (b / 1048576 >= 1000 ? (b / 1073741824).toFixed(2) + " GB" : Math.round(b / 1048576) + " MB");

  // *highlight* markup -> <mark>
  function headline(text, color) {
    const frag = document.createDocumentFragment();
    if (!text) return frag;
    text.replace(/\n/g, " ").split(/(\*[^*]+\*)/).forEach(part => {
      if (part.startsWith("*") && part.endsWith("*")) frag.append(el("mark", { class: color === "#2EE88A" ? "g" : null, text: part.slice(1, -1) }));
      else frag.append(part);
    });
    return frag;
  }

  function videoLocale(code) {
    if (byCode[code].video) return code;
    return VIDEO_FALLBACK[code] || "en-GB";
  }

  // ---------- language rails ----------
  function buildRail(rail, filter) {
    rail.textContent = "";
    let lastEurope = null;
    M.locales.filter(filter).forEach(l => {
      if (lastEurope === true && !l.europe) rail.append(el("span", { class: "chip-sep", text: "Other markets" }));
      lastEurope = l.europe;
      rail.append(el("button", { class: "chip", role: "tab", "data-code": l.code, "aria-selected": "false", onclick: () => setLang(l.code) },
        l.native, el("small", { text: l.code })));
    });
    onLang(code => {
      rail.querySelectorAll(".chip").forEach(c => {
        const on = c.dataset.code === code;
        c.setAttribute("aria-selected", on ? "true" : "false");
        if (on) {
          const r = rail.getBoundingClientRect(), cr = c.getBoundingClientRect();
          if (cr.left < r.left || cr.right > r.right) rail.scrollBy({ left: cr.left - r.left - r.width / 2 + cr.width / 2, behavior: "smooth" });
        }
      });
    });
  }

  // ---------- hero ----------
  function renderStats() {
    const nVid = M.locales.filter(l => l.video).length;
    const nText = M.locales.filter(l => l.appStoreText).length;
    const items = [
      [M.locales.length, "languages of screenshots"],
      [6, "frames each, App Store + Google Play"],
      [nVid, "preview videos"],
      [nVid, "female voice-overs"],
      [nText, "store listings"]
    ];
    $("#stats").append(...items.map(([b, s]) => el("li", {}, el("b", { text: String(b) }), el("span", { text: s }))));
  }

  // ---------- videos ----------
  function renderVideos() {
    const vids = M.locales.filter(l => l.video);
    const rail = $("#videoRail");
    vids.forEach(l => rail.append(el("button", { class: "chip", role: "tab", "data-code": l.code, "aria-selected": "false", onclick: () => setLang(l.code) }, l.native, el("small", { text: l.code }))));
    const grid = $("#videoGrid");
    vids.forEach(l => grid.append(el("button", { class: "vcard", "data-code": l.code, onclick: () => { setLang(l.code); playMain(); } },
      el("img", { src: l.video.poster, alt: `${l.name} preview video`, loading: "lazy", decoding: "async", width: 360, height: 780 }),
      el("span", {}, l.native, " ", el("small", { text: l.code })))));
    const v = $("#mainVideo");
    let shown = null;
    function playMain() {
      $("#videos").scrollIntoView({ behavior: "smooth", block: "start" });
      v.play().catch(() => {});
    }
    onLang(code => {
      const vc = videoLocale(code), l = byCode[vc], cur = byCode[code];
      if (shown !== vc) {
        const wasPlaying = !v.paused;
        v.pause(); v.poster = l.video.poster; v.src = l.video.web; v.setAttribute("aria-label", `${l.name} app preview`);
        if (wasPlaying) v.play().catch(() => {});
        shown = vc;
      }
      $("#videoLang").replaceChildren(document.createTextNode(l.native), el("small", { text: `${l.name} · ${l.code}` }));
      const note = $("#videoNote");
      if (vc !== code) { note.hidden = false; note.textContent = `There is no separate preview for ${cur.name}; the store shows the ${l.name} one.`; }
      else note.hidden = true;
      const ol = $("#videoScript"); ol.textContent = "";
      const lines = (l.voiceover && l.voiceover.script) || [];
      lines.forEach((t, i) => ol.append(el("li", {}, el("span", { text: SHOT_LABELS[M.voOrder[i]] || "" }), el("div", { text: t, lang: l.code, dir: l.rtl ? "rtl" : null }))));
      $("#videoLinks").replaceChildren(
        dlBtn(l.video.full, "Full-quality MP4", true),
        dlBtn(l.video.uploaded, "As uploaded to Apple"));
      rail.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-selected", c.dataset.code === vc ? "true" : "false"));
      grid.querySelectorAll(".vcard").forEach(c => c.setAttribute("aria-current", c.dataset.code === vc ? "true" : "false"));
    });
  }
  function dlBtn(href, text, primary) {
    const a = el("a", { class: "btn" + (primary ? " primary" : ""), href, download: "", rel: "noopener" });
    a.innerHTML = ICON_DL; a.append(text); return a;
  }

  // ---------- screenshots ----------
  let lbList = [], lbIdx = 0, lbOpener = null;
  function renderStrip(kind, stripSel) {
    buildRail(document.querySelector(`[data-rail="${kind}"]`), l => l[kind] && l[kind].length);
    const strip = $(stripSel);
    onLang(code => {
      const l = byCode[code]; strip.textContent = "";
      const shots = l[kind] || [];
      shots.forEach((s, i) => {
        const f = M.frames[i];
        strip.append(el("button", { class: "shot", "aria-label": `Open frame ${i + 1}, ${f.word}`, onclick: e => openLb(shots.map((x, j) => ({ ...x, cap: `${l.name} · ${kind === "play" ? "Google Play" : "App Store"} · ${j + 1}/6 ${M.frames[j].word}` })), i, e.currentTarget) },
          el("img", { src: s.sm, alt: `${l.name} ${kind === "play" ? "Google Play" : "App Store"} screenshot ${i + 1}: ${f.word}`, loading: i < 3 ? "eager" : "lazy", decoding: "async", width: kind === "play" ? 315 : 258, height: 560 }),
          el("span", {}, el("b", { text: String(i + 1).padStart(2, "0") }), " ", f.word)));
      });
      strip.scrollLeft = 0;
    });
  }
  function openLb(list, i, opener) {
    lbList = list; lbIdx = i; lbOpener = opener;
    $("#lightbox").hidden = false; document.body.style.overflow = "hidden";
    showLb(); $("#lbClose").focus();
  }
  function showLb() {
    const s = lbList[lbIdx];
    $("#lbImg").src = s.lg; $("#lbImg").alt = s.cap;
    const cap = $("#lbCap"); cap.textContent = "";
    cap.append(el("span", { text: s.cap }), dlBtn(s.orig, "Original PNG", true));
    // warm the neighbours
    [lbIdx - 1, lbIdx + 1].forEach(j => { if (lbList[j]) new Image().src = lbList[j].lg; });
  }
  function closeLb() { $("#lightbox").hidden = true; document.body.style.overflow = ""; $("#lbImg").removeAttribute("src"); if (lbOpener) lbOpener.focus(); }
  function stepLb(d) { lbIdx = (lbIdx + d + lbList.length) % lbList.length; showLb(); }
  function wireLb() {
    $("#lbClose").onclick = closeLb; $("#lbPrev").onclick = () => stepLb(-1); $("#lbNext").onclick = () => stepLb(1);
    $("#lightbox").addEventListener("click", e => { if (e.target.id === "lightbox") closeLb(); });
    document.addEventListener("keydown", e => {
      if ($("#lightbox").hidden) return;
      if (e.key === "Escape") closeLb(); else if (e.key === "ArrowLeft") stepLb(-1); else if (e.key === "ArrowRight") stepLb(1);
    });
    let x0 = null;
    $("#lightbox").addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    $("#lightbox").addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) stepLb(dx < 0 ? 1 : -1); x0 = null; });
  }

  // ---------- story ----------
  function renderStory() {
    const arc = $("#arc");
    M.frames.forEach((f, i) => { if (i) arc.append(el("i", { text: "→" })); arc.append(el("span", { class: i === 0 ? "hl-g" : (i === 2 ? "hl-y" : null), text: f.word })); });
    const grid = $("#storyGrid");
    const cards = M.frames.map((f, i) => {
      const img = el("img", { alt: "", loading: "lazy", decoding: "async", width: 330, height: 275 });
      const h = el("p", { class: "h" });
      grid.append(el("article", { class: "scard" }, img, el("div", { class: "n", text: `FRAME ${i + 1} · ${(f.feeling || "").toUpperCase()}` }),
        el("div", { class: "w", text: f.word }), el("p", { class: "p", text: f.purpose }), h));
      return { img, h, f };
    });
    // table of every headline
    const t = $("#headTable");
    t.append(el("thead", {}, el("tr", {}, el("th", { text: "Language" }), M.frames.map((f, i) => el("th", { text: `${i + 1} ${f.word}` })))));
    const tb = el("tbody");
    M.locales.filter(l => l.headlines).forEach(l => tb.append(el("tr", { "data-code": l.code }, el("td", { text: l.native, title: l.name }),
      l.headlines.map((h, i) => el("td", { lang: l.code, dir: l.rtl ? "rtl" : null }, headline(h, M.frames[i].highlight))))));
    t.append(tb);
    onLang(code => {
      const l = byCode[code];
      cards.forEach(({ img, h, f }, i) => {
        img.src = (l.appstore[i] || {}).sm || "";
        h.replaceChildren(headline((l.headlines || [])[i], f.highlight));
        h.lang = code; h.dir = l.rtl ? "rtl" : "ltr";
      });
      tb.querySelectorAll("tr").forEach(r => r.classList.toggle("cur", r.dataset.code === code));
    });
  }

  // ---------- audio ----------
  function renderAudio() {
    $("#music").append(el("div", {}, el("h3", { text: M.music.name }), el("p", { text: M.music.note })),
      el("audio", { controls: true, preload: "none", src: M.music.m4a, "aria-label": "Sunset Deck music bed" }),
      dlBtn(M.music.wav, "WAV"));
    const grid = $("#voGrid");
    const cards = {};
    M.locales.filter(l => l.voiceover).forEach(l => {
      const c = el("article", { class: "card vo", "data-code": l.code },
        el("h4", {}, l.native, el("small", { text: `${l.name} · ${l.code}` })),
        el("audio", { controls: true, preload: "none", src: l.voiceover.v2, "aria-label": `${l.name} voice-over` }),
        el("p", { lang: l.code, dir: l.rtl ? "rtl" : null, text: (l.voiceover.script || []).join(" ") }),
        el("a", { class: "alt", href: l.voiceover.v1, target: "_blank", rel: "noopener", text: "Earlier take (v1)" }));
      cards[l.code] = c; grid.append(c);
    });
    // only one audio plays at a time, page-wide
    document.addEventListener("play", e => { document.querySelectorAll("audio,video").forEach(m => { if (m !== e.target) m.pause(); }); }, true);
    onLang(code => { const vc = videoLocale(code); Object.entries(cards).forEach(([k, c]) => c.classList.toggle("cur", k === vc)); });
  }

  // ---------- store text ----------
  function field(lab, text, key, opts = {}) {
    if (!text) return null;
    const lim = LIMITS[key], n = [...text].length;
    const copy = el("button", { class: "copy", type: "button", onclick: e => { navigator.clipboard && navigator.clipboard.writeText(text).then(() => { e.target.textContent = "Copied"; setTimeout(() => e.target.textContent = "Copy", 1200); }); }, text: "Copy" });
    const head = el("label", {}, el("span", { text: lab }), el("span", {}, lim ? el("span", { class: "cnt" + (n > lim ? " over" : ""), text: `${n}/${lim} ` }) : null, copy));
    const body = opts.collapse
      ? el("details", {}, el("summary", { text: opts.collapse }), el("div", { text }))
      : el("div", { class: opts.big ? "big" : null, text });
    return el("div", { class: "field" }, head, body);
  }
  function renderText() {
    buildRail(document.querySelector('[data-rail="text"]'), l => l.appStoreText || l.playText);
    const g = $("#textGrid");
    onLang(code => {
      let l = byCode[code], note = null;
      if (!l.appStoreText && !l.playText) {
        note = el("p", { class: "note", text: `${l.name} is not part of the Europe store text set. Showing English (UK).` });
        l = byCode["en-GB"];
      }
      const dir = l.rtl ? "rtl" : null, a = l.appStoreText, p = l.playText;
      const asCard = a ? el("article", { class: "card store", lang: l.code, dir },
        el("h3"), field("App name", a.name, "name", { big: true }), field("Subtitle", a.subtitle, "subtitle"),
        field("Promotional text", a.promotionalText, "promotionalText"), field("What's new", a.whatsNew, null, { collapse: "Show what's new" }),
        field("Description", a.description, "description", { collapse: "Show full description" })) : null;
      if (asCard) asCard.querySelector("h3").innerHTML = ICON_APPLE + "App Store";
      const plCard = p ? el("article", { class: "card store", lang: l.code, dir },
        el("h3"), field("App title", p.title, "title", { big: true }), field("Short description", p.short, "short"),
        field("Full description", p.full, "full", { collapse: "Show full description" })) : el("article", { class: "card store" }, el("h3"), el("p", { class: "note", text: "No Google Play text for this language." }));
      plCard.querySelector("h3").innerHTML = ICON_PLAY + "Google Play";
      g.replaceChildren(...[note, asCard, plCard].filter(Boolean));
      if (note) note.style.gridColumn = "1 / -1";
    });
  }

  // ---------- downloads ----------
  function renderDownloads() {
    const desc = {
      "SogoApp-Europe-AppStore-Screenshots.zip": ["App Store screenshots", "All 31 languages, 6 PNGs each, 1320×2868"],
      "SogoApp-Europe-GooglePlay-Screenshots.zip": ["Google Play screenshots", "All 31 languages, 6 PNGs each, 1080×1920"],
      "SogoApp-Europe-Preview-Videos.zip": ["Preview videos", "13 languages, full quality + the versions uploaded to Apple"],
      "SogoApp-Europe-Audio.zip": ["Voice-overs & music", "13 voice-overs (current + earlier take) and the Sunset Deck WAV"]
    };
    $("#zipGrid").append(...M.zips.map(z => {
      const [t, s] = desc[z.name] || [z.name, ""];
      return el("a", { class: "card dl", href: z.url, download: "", rel: "noopener" }, el("b", { text: t }), el("span", { text: s }), el("em", { text: `Download ZIP · ${fmtMB(z.bytes)}` }));
    }));
    $("#sheetList").append(...M.sheets.map(s => el("li", {}, el("a", { href: s.url, target: "_blank", rel: "noopener", text: s.name.replace(/-/g, " ") }))));
    $("#credits").append(...M.photoCredits.map(c => el("li", {}, el("a", { href: c.url, target: "_blank", rel: "noopener", text: c.by }))));
  }

  // ---------- boot ----------
  function boot() {
    byCode = Object.fromEntries(M.locales.map(l => [l.code, l]));
    const sel = $("#langSelect");
    let og = null;
    M.locales.forEach(l => {
      const grp = l.europe ? "Europe" : "Other markets";
      if (!og || og.label !== grp) { og = el("optgroup", { label: grp }); sel.append(og); }
      og.append(el("option", { value: l.code, text: `${l.native} (${l.code})` }));
    });
    sel.addEventListener("change", () => setLang(sel.value));
    renderStats(); renderVideos(); renderStrip("appstore", "#appstoreStrip"); renderStrip("play", "#playStrip");
    renderStory(); renderAudio(); renderText(); renderDownloads(); wireLb();
    const fromHash = (location.hash.match(/lang=([\w-]+)/) || [])[1];
    const start = [fromHash, store.get(), "en-GB"].find(c => c && byCode[c]);
    setLang(start, { noHash: !fromHash });
  }

  fetch("manifest.json", { cache: "no-cache" }).then(r => r.json()).then(m => { M = m; boot(); })
    .catch(() => { document.querySelector("main").prepend(el("p", { class: "wrap note", text: "Could not load the content list. Please reload the page." })); });
})();
