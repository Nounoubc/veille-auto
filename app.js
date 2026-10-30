/* Benchmark CG Cars — application (HTML/CSS/JS sans dépendance) */
(function () {
  "use strict";
  const CFG = window.BENCH_CONFIG || {};
  const S = { bench: null, cg: null, cgSha: null, obs: [] };
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k === "style") e.style.cssText = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) e.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  };
  const fmt = (n, d = 0) => (n === null || n === undefined || isNaN(n)) ? "—" : Number(n).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: 1 });
  const fmtDelta = (n) => (n === null || n === undefined) ? "—" : (n > 0 ? "+" : "") + fmt(n);
  const fdate = (iso) => { if (!iso) return "—"; const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
  const isTF = (base) => /tous frais|ttc|-3 ans|neuf/i.test(base || "") && !/hors douane|port d|carte grise|non pr/i.test(base || "");
  const color = (a) => (S.bench.acteurs.find((x) => x.nom === a) || {}).couleur || "#64748b";
  const CG = "CG Cars";
  const competitors = () => S.bench.acteurs.filter((a) => a.nom !== CG).map((a) => a.nom);
  const label = (cle) => (S.bench.modeles.find((m) => m.cle === cle) || {}).libelle || cle;

  // ---------- Chargement ----------
  async function getJSON(name) {
    const url = (CFG.DATA_URL || "./data/") + name + "?t=" + Date.now();
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(name + " : " + r.status);
    return r.json();
  }
  async function load() {
    try {
      const [b, c] = await Promise.all([getJSON("benchmark.json"), getJSON("cg_prices.json")]);
      S.bench = b; S.cg = c;
    } catch (e) {
      $("#maj").textContent = "Impossible de charger les données (" + e.message + "). Vérifie DATA_URL dans config.js.";
      return;
    }
    buildObs();
    $("#maj").textContent = "Dernière mise à jour : " + new Date(S.bench.maj).toLocaleString("fr-FR") + " · " + S.bench.unite;
    renderAll();
  }
  function buildObs() {
    const cgObs = (S.cg.historique || []).map((h) => ({ ...h, acteur: CG, source: "Grille CG Cars" }));
    S.obs = [...S.bench.observations, ...cgObs].map((o) => ({ ...o, prix: Number(o.prix) }));
  }
  function latest(cle, acteur, onlyTF) {
    if (acteur === CG) {
      const cur = (S.cg.prix || []).filter((p) => p.cle === cle && (!onlyTF || isTF(p.base)));
      if (!cur.length) return null;
      const h = (S.cg.historique || []).filter((x) => x.cle === cle).sort((a, b) => b.date.localeCompare(a.date))[0];
      return { ...cur[0], acteur: CG, date: h ? h.date : S.cg.maj };
    }
    let best = null;
    for (const o of S.obs) {
      if (o.cle !== cle || o.acteur !== acteur) continue;
      if (onlyTF && !isTF(o.base)) continue;
      if (!best || o.date > best.date) best = o;
    }
    return best;
  }

  // ---------- Rendu ----------
  function renderAll() {
    renderDashboard(); renderComparatif(); fillSelects(); renderCharts(); renderHistorique(); renderAds(); renderAdmin();
  }

  function compRows(onlyTF) {
    return S.bench.modeles.map((m) => {
      const cells = {};
      for (const a of S.bench.acteurs) cells[a.nom] = latest(m.cle, a.nom, onlyTF);
      const vals = Object.values(cells).filter(Boolean).map((c) => c.prix);
      return { m, cells, min: vals.length ? Math.min(...vals) : null, n: vals.length };
    }).filter((r) => r.n >= 1);
  }
  function position(r) {
    const cg = r.cells[CG]; if (!cg) return null;
    const others = competitors().map((a) => r.cells[a]).filter(Boolean).map((c) => c.prix);
    if (!others.length) return null;
    if (cg.prix < Math.min(...others)) return ["Le moins cher", "cheap"];
    if (cg.prix > Math.max(...others)) return ["Le plus cher", "exp"];
    return ["Entre les deux", "mid"];
  }

  function renderDashboard() {
    const rows = compRows(true);
    const withCg = rows.filter((r) => r.cells[CG] && competitors().some((a) => r.cells[a]));
    const cheap = withCg.filter((r) => (position(r) || [])[1] === "cheap").length;
    const exp = withCg.filter((r) => (position(r) || [])[1] === "exp").length;
    const k = $("#kpis"); k.replaceChildren();
    k.append(kpi("Modèles comparés", withCg.length, "avec un prix CG et au moins un concurrent", "#0f3d2e"));
    k.append(kpi("CG le moins cher", cheap, "modèles", "#16a34a"));
    k.append(kpi("CG le plus cher", exp, "modèles", "#dc2626"));
    for (const a of competitors()) {
      const d = withCg.filter((r) => r.cells[a]).map((r) => r.cells[CG].prix - r.cells[a].prix);
      const avg = d.length ? d.reduce((s, x) => s + x, 0) / d.length : null;
      k.append(kpi("Écart moyen vs " + a, avg === null ? "—" : fmtDelta(Math.round(avg * 10) / 10) + " M", d.length ? d.length + " modèles communs" : "aucun modèle commun", color(a)));
    }
    // alertes
    const al = $("#alerts"); al.replaceChildren();
    const list = withCg.map((r) => {
      const others = competitors().map((a) => r.cells[a]).filter(Boolean).sort((x, y) => x.prix - y.prix);
      return { r, cheapest: others[0], gap: r.cells[CG].prix - others[0].prix };
    }).filter((x) => x.gap > 0).sort((a, b) => b.gap - a.gap);
    if (!list.length) al.append(el("p", { class: "empty" }, "CG Cars n'est le plus cher sur aucun modèle comparé."));
    const lw = el("div", { class: "list" });
    for (const x of list) lw.append(el("div", { class: "row" },
      el("span", {}, el("strong", {}, label(x.r.m.cle)), el("br"), el("span", { class: "muted" }, `CG ${fmt(x.r.cells[CG].prix)} M · ${x.cheapest.acteur} ${fmt(x.cheapest.prix)} M (${fdate(x.cheapest.date)})`)),
      el("span", { class: "pos" }, "+" + fmt(x.gap) + " M")));
    al.append(lw);
    // mouvements
    const mv = $("#moves"); mv.replaceChildren();
    const maxD = S.obs.reduce((m, o) => (o.date > m ? o.date : m), "");
    const lim = new Date(maxD); lim.setDate(lim.getDate() - 7); const limS = lim.toISOString().slice(0, 10);
    const recent = S.obs.filter((o) => o.acteur !== CG && o.date >= limS && isTF(o.base)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
    const mw = el("div", { class: "list" });
    for (const o of recent) mw.append(el("div", { class: "row" },
      el("span", {}, el("span", { class: "dot", style: "background:" + color(o.acteur) }), el("strong", {}, o.modele + " " + (o.version || "")), el("br"), el("span", { class: "muted" }, `${o.acteur} · ${fdate(o.date)} · ${o.base}`)),
      el("strong", {}, fmt(o.prix) + " M")));
    if (!recent.length) mw.append(el("p", { class: "empty" }, "Aucun nouveau prix sur 7 jours."));
    mv.append(mw);
    // pubs
    const as = $("#adsSummary"); as.replaceChildren();
    for (const a of competitors()) {
      const L = (S.bench.publicites || {})[a] || [];
      const act = L.filter((x) => x.status === "Active");
      const models = [...new Set(act.map((x) => x.modele))].slice(0, 4).join(", ");
      as.append(el("div", { class: "a", style: "border-top:4px solid " + color(a) },
        el("strong", {}, a), el("div", { class: "kpi-v", style: "font-size:24px;font-weight:700;margin:4px 0" }, act.length + (act.length > 1 ? " actives" : " active")),
        el("div", { class: "muted" }, L.length ? (models || "—") : "Aucune publicité trouvée")));
    }
  }
  function kpi(l, v, s, c) { return el("div", { class: "kpi", style: "--c:" + c }, el("div", { class: "l" }, l), el("div", { class: "v" }, v), el("div", { class: "s" }, s)); }

  function renderComparatif() {
    const onlyTF = $("#onlyTF").checked;
    const t = $("#compTable"); t.replaceChildren();
    const acts = S.bench.acteurs.map((a) => a.nom);
    t.append(el("thead", {}, el("tr", {}, el("th", {}, "Modèle"), acts.map((a) => el("th", { class: "num" }, el("span", { class: "dot", style: "background:" + color(a) }), a)),
      competitors().map((a) => el("th", { class: "num" }, "Écart vs " + a)), el("th", {}, "Position CG"))));
    const tb = el("tbody");
    for (const r of compRows(onlyTF)) {
      const tr = el("tr", {}, el("td", {}, el("strong", {}, label(r.m.cle))));
      for (const a of acts) {
        const c = r.cells[a];
        if (!c) { tr.append(el("td", { class: "num muted" }, "—")); continue; }
        const sp = el("span", { class: "price" + (c.prix === r.min && r.n > 1 ? " best" : "") }, fmt(c.prix));
        sp.dataset.tip = `${a}\n${c.modele} ${c.version || ""}\n${c.base}\n${fdate(c.date)}`;
        tr.append(el("td", { class: "num" }, sp));
      }
      for (const a of competitors()) {
        const cg = r.cells[CG], c = r.cells[a];
        const d = cg && c ? cg.prix - c.prix : null;
        tr.append(el("td", { class: "num " + (d > 0 ? "pos" : d < 0 ? "neg" : "") }, d === null ? "—" : fmtDelta(d)));
      }
      const p = position(r);
      tr.append(el("td", {}, p ? el("span", { class: "pill " + p[1] }, p[0]) : el("span", { class: "muted" }, "—")));
      tb.append(tr);
    }
    t.append(tb);
  }

  // ---------- Graphiques (SVG) ----------
  function series(cle, onlyTF) {
    const out = {};
    for (const a of S.bench.acteurs.map((x) => x.nom)) {
      const pts = S.obs.filter((o) => o.cle === cle && o.acteur === a && (!onlyTF || isTF(o.base)))
        .sort((x, y) => x.date.localeCompare(y.date));
      const byDate = new Map(); for (const p of pts) byDate.set(p.date, p); // dernier relevé du jour
      if (byDate.size) out[a] = [...byDate.values()];
    }
    return out;
  }
  function drawChart(container, cle, onlyTF, small) {
    container.replaceChildren();
    const data = series(cle, onlyTF);
    const all = Object.values(data).flat();
    if (!all.length) { container.append(el("p", { class: "empty" }, "Pas de prix comparable pour ce modèle.")); return; }
    const W = container.clientWidth || 600, H = container.clientHeight || (small ? 220 : 380);
    const m = { l: 48, r: 14, t: 12, b: small ? 26 : 34 };
    const t0 = new Date(Math.min(...all.map((p) => +new Date(p.date)))), t1 = new Date(Math.max(...all.map((p) => +new Date(p.date)), Date.now()));
    if (+t1 - +t0 < 86400000 * 7) t0.setDate(t0.getDate() - 7);
    let y0 = Math.min(...all.map((p) => p.prix)), y1 = Math.max(...all.map((p) => p.prix));
    const pad = Math.max(5, (y1 - y0) * 0.12); y0 -= pad; y1 += pad;
    const X = (d) => m.l + (+new Date(d) - +t0) / (+t1 - +t0) * (W - m.l - m.r);
    const Y = (v) => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", "100%"); svg.setAttribute("height", H);
    const add = (tag, at) => { const e = document.createElementNS(ns, tag); for (const k in at) e.setAttribute(k, at[k]); svg.append(e); return e; };
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const v = y0 + (y1 - y0) * i / ticks, y = Y(v);
      add("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: "#eef0f3" });
      const tx = add("text", { x: m.l - 6, y: y + 4, "text-anchor": "end", "font-size": 11, fill: "#6b7280" }); tx.textContent = Math.round(v);
    }
    const nx = small ? 4 : 7;
    for (let i = 0; i <= nx; i++) {
      const d = new Date(+t0 + (+t1 - +t0) * i / nx), x = X(d);
      const tx = add("text", { x, y: H - m.b + 16, "text-anchor": "middle", "font-size": 11, fill: "#6b7280" });
      tx.textContent = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    }
    const today = new Date(t1).toISOString().slice(0, 10);
    for (const [a, pts] of Object.entries(data)) {
      // ligne en escalier : un prix reste valable jusqu'au relevé suivant
      let dpath = "";
      pts.forEach((p, i) => {
        const x = X(p.date), y = Y(p.prix);
        dpath += i === 0 ? `M${x},${y}` : `H${x}V${y}`;
      });
      dpath += `H${X(today)}`;
      add("path", { d: dpath, fill: "none", stroke: color(a), "stroke-width": a === CG ? 3 : 2, "stroke-dasharray": a === CG ? "" : "" });
      for (const p of pts) {
        const c = add("circle", { cx: X(p.date), cy: Y(p.prix), r: small ? 3.5 : 5, fill: color(a), stroke: "#fff", "stroke-width": 1.5 });
        c.dataset.tip = `${a} — ${fmt(p.prix)} M\n${p.modele} ${p.version || ""}\n${p.base}\n${fdate(p.date)}`;
        c.style.cursor = "pointer";
      }
    }
    container.append(svg);
    const lg = el("div", { class: "legend" });
    for (const a of Object.keys(data)) lg.append(el("span", {}, el("span", { class: "dot", style: "background:" + color(a) }), a));
    container.append(lg);
  }
  function fillSelects() {
    const s = $("#chartModel"); s.replaceChildren();
    for (const m of S.bench.modeles) if (S.obs.some((o) => o.cle === m.cle)) s.append(el("option", { value: m.cle }, m.libelle));
    const fa = $("#fActeur"), fm = $("#fModele"), fad = $("#fAdActeur");
    [fa, fm, fad].forEach((x) => { while (x.options.length > 1) x.remove(1); });
    for (const a of S.bench.acteurs) fa.append(el("option", { value: a.nom }, a.nom));
    for (const m of [...new Set(S.obs.map((o) => o.modele))].sort()) fm.append(el("option", { value: m }, m));
    for (const a of competitors()) fad.append(el("option", { value: a }, a));
  }
  function renderCharts() {
    const onlyTF = $("#chartTF").checked;
    drawChart($("#bigChart"), $("#chartModel").value, onlyTF, false);
    const sc = $("#smallCharts"); sc.replaceChildren();
    for (const m of S.bench.modeles) {
      const d = series(m.cle, onlyTF); if (Object.keys(d).length < 2) continue;
      const box = el("div", { class: "chart" });
      sc.append(el("div", { class: "card" }, el("h2", {}, m.libelle), box));
      requestAnimationFrame(() => drawChart(box, m.cle, onlyTF, true));
    }
  }

  // ---------- Historique ----------
  function histFiltered() {
    const a = $("#fActeur").value, m = $("#fModele").value, q = $("#fSearch").value.trim().toLowerCase();
    return S.obs.filter((o) => (!a || o.acteur === a) && (!m || o.modele === m) &&
      (!q || [o.modele, o.version, o.base, o.notes, o.acteur].join(" ").toLowerCase().includes(q)))
      .sort((x, y) => y.date.localeCompare(x.date) || x.acteur.localeCompare(y.acteur));
  }
  function renderHistorique() {
    const rows = histFiltered();
    $("#histCount").textContent = rows.length + " prix relevés";
    const t = $("#histTable"); t.replaceChildren();
    t.append(el("thead", {}, el("tr", {}, ["Date", "Acteur", "Modèle", "Version / état", "Prix (M)", "Prix (DA)", "Base", "Notes"].map((h, i) => el("th", { class: i === 4 || i === 5 ? "num" : "" }, h)))));
    const tb = el("tbody");
    for (const o of rows.slice(0, 1500)) tb.append(el("tr", {},
      el("td", {}, fdate(o.date)), el("td", {}, el("span", { class: "dot", style: "background:" + color(o.acteur) }), o.acteur),
      el("td", {}, o.modele), el("td", {}, o.version || ""), el("td", { class: "num" }, el("strong", {}, fmt(o.prix))),
      el("td", { class: "num muted" }, fmt(o.prix * 10000)), el("td", {}, o.base || ""), el("td", { class: "muted" }, o.notes || "")));
    t.append(tb);
  }
  function exportCSV() {
    const rows = histFiltered();
    const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const csv = ["Date;Acteur;Modèle;Version;Prix (M);Prix (DA);Base;Notes"]
      .concat(rows.map((o) => [o.date, o.acteur, o.modele, o.version, o.prix, o.prix * 10000, o.base, o.notes].map(esc).join(";"))).join("\n");
    download("historique_benchmark.csv", "﻿" + csv, "text/csv");
  }
  function download(name, text, type) {
    const a = el("a", { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); a.remove();
  }

  // ---------- Publicités ----------
  function renderAds() {
    const fa = $("#fAdActeur").value, fs = $("#fAdStatus").value;
    const g = $("#adsGrid"); g.replaceChildren();
    let n = 0;
    for (const a of competitors()) {
      if (fa && a !== fa) continue;
      const L = ((S.bench.publicites || {})[a] || []).filter((x) => !fs || x.status === fs)
        .sort((x, y) => (y.start || "").localeCompare(x.start || ""));
      for (const ad of L) {
        n++;
        g.append(el("div", { class: "ad", style: "border-top:4px solid " + color(a) },
          el("div", { class: "head" }, el("strong", {}, a), el("span", { class: "pill status-" + ad.status }, ad.status === "Active" ? "Active" : "Inactive")),
          el("div", { class: "accroche", dir: "auto" }, ad.accroche || ""),
          el("div", {}, ad.resume || ""),
          el("div", { class: "meta" },
            el("span", { class: "tag" }, "Début : " + fdate(ad.start)),
            ad.end ? el("span", { class: "tag" }, "Fin : " + fdate(ad.end)) : null,
            el("span", { class: "tag" }, ad.format || ""),
            ad.cta ? el("span", { class: "tag" }, "Bouton : " + ad.cta) : null,
            ad.modele ? el("span", { class: "tag" }, ad.modele) : null,
            ad.prix ? el("span", { class: "tag" }, fmt(ad.prix) + " M · " + (ad.base || "")) : null),
          el("a", { href: ad.url, target: "_blank", rel: "noopener" }, "Voir dans l'Ad Library ↗")));
      }
      if (!fs && !((S.bench.publicites || {})[a] || []).length && (!fa || fa === a))
        g.append(el("div", { class: "ad", style: "border-top:4px solid " + color(a) }, el("strong", {}, a), el("p", { class: "empty" }, "Aucune publicité trouvée dans l'Ad Library (Algérie).")));
    }
    if (!n && !g.children.length) g.append(el("p", { class: "empty" }, "Aucune publicité pour ce filtre."));
  }

  // ---------- Admin : prix CG Cars ----------
  let draft = [];
  function renderAdmin() {
    draft = (S.cg.prix || []).map((p) => ({ ...p }));
    $("#repoInfo").textContent = `Dépôt : ${CFG.GITHUB_OWNER}/${CFG.GITHUB_REPO} (${CFG.GITHUB_BRANCH}) · fichier ${CFG.CG_PRICES_PATH}`;
    try { const t = localStorage.getItem("bench_token"); if (t) { $("#token").value = t; $("#rememberToken").checked = true; } } catch (e) {}
    drawAdmin();
  }
  function drawAdmin() {
    const t = $("#adminTable"); t.replaceChildren();
    t.append(el("thead", {}, el("tr", {}, ["Modèle", "Version / état", "Base", "Prix (M)", "Modèle comparé", ""].map((h) => el("th", {}, h)))));
    const tb = el("tbody");
    const opts = [["", "— non comparé —"], ...S.bench.modeles.map((m) => [m.cle, m.libelle])];
    draft.forEach((p, i) => {
      const inp = (k, type = "text") => el("input", { type, value: p[k] ?? "", step: "0.1", oninput: (e) => { p[k] = type === "number" ? parseFloat(e.target.value) : e.target.value; } });
      const sel = el("select", { onchange: (e) => { p.cle = e.target.value; } }, opts.map(([v, l]) => { const o = el("option", { value: v }, l); if (v === (p.cle || "")) o.selected = true; return o; }));
      tb.append(el("tr", {}, el("td", {}, inp("modele")), el("td", {}, inp("version")), el("td", {}, inp("base")), el("td", {}, inp("prix", "number")), el("td", {}, sel),
        el("td", {}, el("button", { class: "del", title: "Supprimer", onclick: () => { draft.splice(i, 1); drawAdmin(); } }, "✕"))));
    });
    t.append(tb);
  }
  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
  async function saveCg() {
    const msg = $("#saveMsg"); msg.className = "msg"; msg.textContent = "Enregistrement…";
    const token = $("#token").value.trim();
    if (!token) { msg.className = "msg err"; msg.textContent = "Colle ton jeton GitHub pour enregistrer."; return; }
    try { if ($("#rememberToken").checked) localStorage.setItem("bench_token", token); else localStorage.removeItem("bench_token"); } catch (e) {}
    const clean = draft.filter((p) => p.modele && !isNaN(p.prix)).map((p) => ({ cle: p.cle || "", modele: p.modele, version: p.version || "", base: p.base || "", prix: Number(p.prix) }));
    const today = new Date().toISOString().slice(0, 10);
    const old = new Map((S.cg.prix || []).map((p) => [p.modele + "|" + p.version + "|" + p.base, p.prix]));
    const hist = [...(S.cg.historique || [])];
    let changed = 0;
    for (const p of clean) {
      const k = p.modele + "|" + p.version + "|" + p.base;
      if (!old.has(k) || old.get(k) !== p.prix) { hist.push({ ...p, date: today }); changed++; }
    }
    const body = { maj: today, par: "Saisie plateforme", prix: clean, historique: hist };
    const api = `https://api.github.com/repos/${CFG.GITHUB_OWNER}/${CFG.GITHUB_REPO}/contents/${CFG.CG_PRICES_PATH}`;
    const H = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" };
    try {
      const cur = await fetch(api + "?ref=" + CFG.GITHUB_BRANCH, { headers: H });
      const sha = cur.ok ? (await cur.json()).sha : undefined;
      const r = await fetch(api, { method: "PUT", headers: H, body: JSON.stringify({
        message: `Prix CG Cars mis à jour (${changed} modification${changed > 1 ? "s" : ""})`, branch: CFG.GITHUB_BRANCH,
        content: b64(JSON.stringify(body, null, 1)), sha }) });
      if (!r.ok) throw new Error((await r.json()).message || r.status);
      S.cg = body; buildObs(); renderAll();
      msg.className = "msg ok"; msg.textContent = `Enregistré : ${clean.length} prix, ${changed} modification(s) ajoutée(s) à l'historique.`;
    } catch (e) {
      msg.className = "msg err"; msg.textContent = "Échec de l'enregistrement : " + e.message + ". Vérifie le jeton (droit « Contents : Read and write » sur le dépôt).";
    }
  }

  // ---------- Événements ----------
  document.addEventListener("DOMContentLoaded", () => {
    $("#tabs").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-view]"); if (!b) return;
      document.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + b.dataset.view));
      if (b.dataset.view === "graphiques" && S.bench) renderCharts();
    });
    $("#onlyTF").addEventListener("change", renderComparatif);
    $("#chartModel").addEventListener("change", renderCharts);
    $("#chartTF").addEventListener("change", renderCharts);
    ["#fActeur", "#fModele"].forEach((s) => $(s).addEventListener("change", renderHistorique));
    $("#fSearch").addEventListener("input", renderHistorique);
    $("#csvBtn").addEventListener("click", exportCSV);
    ["#fAdActeur", "#fAdStatus"].forEach((s) => $(s).addEventListener("change", renderAds));
    $("#addRow").addEventListener("click", () => { draft.push({ modele: "", version: "", base: "TTC -3 ans", prix: NaN, cle: "" }); drawAdmin(); });
    $("#exportCg").addEventListener("click", () => download("cg_prices.json", JSON.stringify({ ...S.cg, prix: draft }, null, 1), "application/json"));
    $("#saveCg").addEventListener("click", saveCg);
    window.addEventListener("resize", () => { if (S.bench && $("#view-graphiques").classList.contains("active")) renderCharts(); });
    const tip = $("#tooltip");
    document.addEventListener("mouseover", (e) => { const t = e.target.closest("[data-tip]"); if (!t) return; tip.textContent = t.dataset.tip; tip.style.whiteSpace = "pre-line"; tip.hidden = false; });
    document.addEventListener("mousemove", (e) => { if (!tip.hidden) { tip.style.left = Math.min(e.clientX + 12, innerWidth - 290) + "px"; tip.style.top = e.clientY + 12 + "px"; } });
    document.addEventListener("mouseout", (e) => { if (e.target.closest("[data-tip]")) tip.hidden = true; });
    load();
  });
})();
