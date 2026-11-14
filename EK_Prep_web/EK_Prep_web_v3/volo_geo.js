(function() {
  const V = window.VOLO;
  if (!V) return;
  const E = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const hm = (m) => {
    if (m == null || isNaN(m)) return "\u2013";
    m = Math.round(m);
    return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
  };
  let GEO = null;
  V.geo = () => GEO ? Promise.resolve(GEO) : fetch("libs/geo.json").then((r) => r.json()).then((j) => GEO = j);
  function routePts() {
    const O = V.O, pts = [];
    const ap = (c) => GEO && GEO.apts[c];
    if (ap(O.dep)) pts.push({ n: O.dep, lat: ap(O.dep)[0], lon: ap(O.dep)[1], apt: 1 });
    for (const k in O.coords || {}) {
      const c = O.coords[k];
      if (c && isFinite(c[0])) pts.push({ n: k, lat: c[0], lon: c[1] });
    }
    if (ap(O.dest)) pts.push({ n: O.dest, lat: ap(O.dest)[0], lon: ap(O.dest)[1], apt: 1 });
    return pts;
  }
  const routeFirs = () => (V.O.fir_eet || []).map((f) => f.fir);
  V.globe = function(host) {
    host.innerHTML = `<div class="gwrap"><canvas id="g-cv"></canvas>
      <div class="gctl"><button data-g="in">+</button><button data-g="out">\u2212</button><button data-g="fit">Rotta</button><button data-g="all" class="${V.gAll ? "on" : ""}">Tutti i FIR</button></div>
      <div class="gleg"><span class="lr"></span> rotta \xB7 <span class="lf"></span> FIR sorvolati \xB7 <span class="la"></span> alternati</div></div>
      <div id="g-firs" class="gfirs"></div>
      <p class="note">Confini FIR da dati pubblici (VATSpy, CC BY-SA): sono indicativi, non ufficiali. Trascina per ruotare il globo, pizzica o usa +/\u2212 per lo zoom.</p>`;
    V.geo().then(() => draw(host)).catch((e) => {
      host.querySelector(".gwrap").innerHTML = `<p class="err">Mappa non disponibile: ${E(e.message || e)}</p>`;
    });
  };
  function draw(host) {
    const cv = host.querySelector("#g-cv"), wrap = host.querySelector(".gwrap");
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(320, wrap.clientWidth), H = Math.round(Math.min(W * 0.75, window.innerHeight * 0.72));
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement), col = (v) => css.getPropertyValue(v).trim() || "#888";
    const C = { sea: col("--chip"), land: col("--line"), ink: col("--ink"), muted: col("--muted"), acc: col("--accent"), navy: col("--navy"), sheet: col("--sheet") };
    const pts = routePts(), rf = routeFirs();
    const land = window.Datamaps && Datamaps.prototype.worldTopo && window.topojson ? topojson.feature(Datamaps.prototype.worldTopo, Datamaps.prototype.worldTopo.objects.world) : null;
    const firFeat = (id) => {
      const f = GEO.firs[id];
      return f ? { type: "Feature", id, properties: f, geometry: { type: "MultiPolygon", coordinates: f.p.map((r) => [r]) } } : null;
    };
    const allF = Object.keys(GEO.firs).map(firFeat);
    const onF = rf.map(firFeat).filter(Boolean);
    const line = { type: "LineString", coordinates: pts.map((p) => [p.lon, p.lat]) };
    const alts = (V.O.alts || []).map((a) => GEO.apts[a.icao] ? { n: a.icao, lat: GEO.apts[a.icao][0], lon: GEO.apts[a.icao][1] } : null).filter(Boolean);
    const b = d3.geo.bounds(line.coordinates.length ? line : { type: "Point", coordinates: [55, 25] });
    const cen = d3.geo.centroid(line.coordinates.length > 1 ? line : { type: "Point", coordinates: [55, 25] });
    const span = Math.max(8, d3.geo.distance(b[0], b[1]) * 180 / Math.PI);
    const fitScale = Math.min(W, H) * 0.5 * Math.min(6, 160 / span);
    const proj = d3.geo.orthographic().translate([W / 2, H / 2]).clipAngle(90).precision(0.5);
    const st = V.gState || (V.gState = { rot: [-cen[0], -cen[1], 0], k: fitScale });
    proj.rotate(st.rot).scale(st.k);
    const path = d3.geo.path().projection(proj).context(ctx);
    const grat = d3.geo.graticule().step([15, 15])();
    const vis = (lon, lat) => d3.geo.distance([lon, lat], [-proj.rotate()[0], -proj.rotate()[1]]) < Math.PI / 2 - 0.02;
    function render() {
      ctx.clearRect(0, 0, W, H);
      const r = proj.scale();
      const g = ctx.createRadialGradient(W / 2 - r * 0.3, H / 2 - r * 0.35, r * 0.1, W / 2, H / 2, r);
      g.addColorStop(0, C.sheet);
      g.addColorStop(1, C.sea);
      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.fillStyle = g;
      ctx.fill();
      ctx.beginPath();
      path(grat);
      ctx.strokeStyle = C.land;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (land) {
        ctx.beginPath();
        path(land);
        ctx.fillStyle = C.land;
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (V.gAll) {
        ctx.beginPath();
        allF.forEach((f) => path(f));
        ctx.strokeStyle = C.muted;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      onF.forEach((f, i) => {
        ctx.beginPath();
        path(f);
        ctx.fillStyle = C.navy;
        ctx.globalAlpha = i % 2 ? 0.1 : 0.18;
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = C.navy;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
      ctx.beginPath();
      path(line);
      ctx.strokeStyle = C.acc;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.font = "600 11px " + (css.getPropertyValue("--f-mono") || "monospace");
      for (const f of onF) {
        const l = f.properties.l;
        if (!vis(l[0], l[1])) continue;
        const p = proj(l);
        ctx.fillStyle = C.navy;
        ctx.fillText(f.id, p[0] - 14, p[1]);
      }
      const dot = (p, c, rr) => {
        if (!vis(p.lon, p.lat)) return null;
        const q = proj([p.lon, p.lat]);
        ctx.beginPath();
        ctx.arc(q[0], q[1], rr, 0, 7);
        ctx.fillStyle = c;
        ctx.fill();
        return q;
      };
      const big = proj.scale() > fitScale * 1.6;
      pts.forEach((p, i) => {
        const q = dot(p, p.apt ? C.navy : C.acc, p.apt ? 5 : 2.2);
        if (q && (p.apt || big && i % 1 === 0)) {
          ctx.fillStyle = C.ink;
          ctx.fillText(p.n, q[0] + 5, q[1] - 4);
        }
      });
      alts.forEach((a) => {
        if (!vis(a.lon, a.lat)) return;
        const q = proj([a.lon, a.lat]);
        ctx.beginPath();
        ctx.arc(q[0], q[1], 4.5, 0, 7);
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = C.muted;
        ctx.fillText(a.n, q[0] + 6, q[1] + 10);
      });
      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    render();
    const ptr = /* @__PURE__ */ new Map();
    let last = null, pinch = null;
    cv.style.touchAction = "none";
    cv.onpointerdown = (e) => {
      cv.setPointerCapture(e.pointerId);
      ptr.set(e.pointerId, [e.clientX, e.clientY]);
      last = [e.clientX, e.clientY];
      if (ptr.size === 2) {
        const [a, b2] = [...ptr.values()];
        pinch = { d: Math.hypot(a[0] - b2[0], a[1] - b2[1]), k: proj.scale() };
      }
    };
    cv.onpointermove = (e) => {
      if (!ptr.has(e.pointerId)) return;
      ptr.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptr.size === 2 && pinch) {
        const [a, b2] = [...ptr.values()];
        const d = Math.hypot(a[0] - b2[0], a[1] - b2[1]);
        proj.scale(Math.max(H * 0.3, Math.min(fitScale * 12, pinch.k * d / pinch.d)));
      } else if (last) {
        const k = 70 / proj.scale() * 1.4, r = proj.rotate();
        proj.rotate([r[0] + (e.clientX - last[0]) * k, Math.max(-85, Math.min(85, r[1] - (e.clientY - last[1]) * k)), 0]);
        last = [e.clientX, e.clientY];
      }
      st.rot = proj.rotate();
      st.k = proj.scale();
      render();
    };
    cv.onpointerup = cv.onpointercancel = (e) => {
      ptr.delete(e.pointerId);
      if (ptr.size < 2) pinch = null;
      last = ptr.size ? [...ptr.values()][0] : null;
    };
    cv.onwheel = (e) => {
      e.preventDefault();
      proj.scale(Math.max(H * 0.3, Math.min(fitScale * 12, proj.scale() * (e.deltaY < 0 ? 1.12 : 0.89))));
      st.k = proj.scale();
      render();
    };
    host.querySelectorAll("[data-g]").forEach((btn2) => btn2.onclick = () => {
      const a = btn2.dataset.g;
      if (a === "in") proj.scale(Math.min(fitScale * 12, proj.scale() * 1.35));
      if (a === "out") proj.scale(Math.max(H * 0.3, proj.scale() / 1.35));
      if (a === "fit") {
        proj.rotate([-cen[0], -cen[1], 0]).scale(fitScale);
      }
      if (a === "all") {
        V.gAll = !V.gAll;
        btn2.classList.toggle("on", V.gAll);
      }
      st.rot = proj.rotate();
      st.k = proj.scale();
      render();
    });
    host.querySelector("#g-firs").innerHTML = (V.O.fir_eet || []).map((f) => `<span><b>${E(f.fir)}</b> ${E(GEO.firs[f.fir] && GEO.firs[f.fir].n || f.name || "")} \xB7 ${hm(f.min)}</span>`).join("");
  }
  const KEYW = /\b(shall|must|required|mandatory|not (?:be )?(?:permitted|allowed|available|authori[sz]ed)|prohibited|forbidden|only|minimum|maximum|FL ?\d{2,3}|MHz|kHz|SLOP|offset|CPDLC|log ?on|ADS-[BC]|squawk|SSR|Mode S|7600|7700|contingency|RVSM|intercept\w*|permission|PPR|knots?|KT|IAS|Mach|frequenc\w+|contact|report|UTC|NM)\b/gi;
  function sentences(t) {
    t = t.replace(/^#+.*$/gm, "").replace(/^\|\s*-[-| ]*\|?\s*$/gm, "").replace(/^\|(.*)\|\s*$/gm, (m, r) => {
      const c = r.split("|").map((s) => s.trim()).filter(Boolean);
      return c.length ? c.join(" \u2013 ") + "." : "";
    }).replace(/^[-•]\s*/gm, "").replace(/\n{2,}/g, "\n").replace(/[ \t]+/g, " ");
    const out = [];
    t.split("\n").forEach((line) => {
      line = line.trim();
      if (line.length < 4) return;
      line.split(/(?<=[.;])\s+(?=[A-Z(])/).forEach((s) => {
        s = s.trim();
        if (s.length > 3) out.push(s);
      });
    });
    return out;
  }
  V.summ = function(t, max) {
    const ss = sentences(t || "");
    if (!ss.length) return "";
    const sc = ss.map((s, i) => {
      const k = (s.match(KEYW) || []).length, n = (s.match(/\d/g) || []).length > 2 ? 1 : 0;
      return { s, i, v: k * 2 + n - (s.length > 300 ? 1 : 0) - (/^(Note|Remark)s?:?$/i.test(s) ? 3 : 0) };
    });
    const pick = sc.filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    const keep = [];
    let used = 0;
    for (const x of pick.length ? pick : sc.slice(0, 1)) {
      const s = x.s.length > 280 ? x.s.slice(0, 277) + "\u2026" : x.s;
      if (used + s.length > max && keep.length) continue;
      keep.push({ i: x.i, s });
      used += s.length;
      if (used > max) break;
    }
    return keep.sort((a, b) => a.i - b.i).map((x) => x.s).join(" ");
  };
  const TOPIC = [
    [/contingenc/i, "Contingency"],
    [/communication failure|radio failure|COM failure/i, "COM failure"],
    [/strategic lateral|SLOP|offset/i, "SLOP"],
    [/data ?link|CPDLC|ADS-C|PBCS/i, "Datalink"],
    [/transponder|SSR|mode s|ACAS/i, "Transponder"],
    [/RVSM|level|flight level|cruising/i, "Livelli"],
    [/intercept/i, "Intercettazione"],
    [/restrict|prohibit|danger|closed|security|conflict/i, "Restrizioni"],
    [/speed|mach/i, "Velocit\xE0"],
    [/free route|FRA/i, "Free Route"],
    [/separation/i, "Separazione"],
    [/position report|reporting/i, "Riporti"],
    [/GNSS|PBN|RNAV|RNP/i, "Navigazione"],
    [/communication|contact|frequenc/i, "Comunicazioni"],
    [/special procedure|miscellaneous|SERA|other/i, "Varie"],
    [/flight permission|overflight/i, "Permessi"]
  ];
  const SKIPT = /alerting|search and rescue|visual flight|VFR|start-?up|holding|aerodrome operating minima|item 8|flight rules and type/i;
  function secsUnder(root) {
    const p = root + ".";
    return KB.index.sections.filter((s) => s.i.startsWith(p));
  }
  async function countryCard(c, firs, cache) {
    const names = [c.name, ...firs.map((f) => f.name).filter(Boolean)].map((x) => x.toLowerCase()).filter((x) => x.length > 3);
    const codes = firs.map((f) => f.fir);
    const mentions = (s) => {
      const L = s.toLowerCase();
      return names.some((n) => L.includes(n)) || codes.some((k) => s.includes(k));
    };
    const strictNames = names.filter((n) => !/emirates/.test(n));
    const mentionsStrict = (s) => {
      const L = s.toLowerCase();
      return strictNames.some((n) => L.includes(n)) || codes.some((k) => s.includes(k));
    };
    const out = { company: [], crar: [], other: [], rsi: [] };
    for (const s of KB.index.sections) {
      if (s.d !== "omc" || !/^12\.3\./.test(s.t) || !mentionsStrict(s.t)) continue;
      out.company.push({ s, x: V.summ((await text(s.i)).split("\n").filter((l) => !l.includes(s.t.replace(/^[\d.]+\s*/, ""))).join("\n"), 420) });
      if (out.company.length >= 4) break;
    }
    const nr = KB.index.sections.find((s) => s.d === "nr");
    if (nr) {
      const items = [];
      let cur = null;
      for (const raw of (await text(nr.i)).split("\n")) {
        const l = raw.trim();
        if (!l || /^(Network Report|AIRAC|Page \d|##)/.test(l)) continue;
        if (/^[•o▪]\s/.test(l)) {
          cur = l.replace(/^[•o▪]\s*/, "");
          items.push(cur);
        } else if (cur !== null && items.length) {
          items[items.length - 1] += " " + l;
        }
      }
      [...new Set(items)].filter((x) => mentionsStrict(x.split(/[–-]/)[0])).slice(0, 3).forEach((x) => out.company.push({ s: nr, x: x.replace(/\s*\|\s*\d+$/, "") }));
    }
    const subs = secsUnder(c.root).filter((s) => s.n > 60);
    for (const s of subs) {
      const title = s.t.replace(/^[\d.]+\s*/, "");
      const top = TOPIC.find((t) => t[0].test(title));
      const isSkip = SKIPT.test(title);
      const KEEP = ["Restrizioni", "Contingency", "COM failure", "SLOP", "Datalink", "Transponder", "Livelli", "Comunicazioni", "Riporti", "Navigazione", "Velocit\xE0", "Intercettazione", "Free Route", "Varie"];
      let x = "";
      if (top && !isSkip && KEEP.includes(top[1])) {
        const raw = (await text(s.i)).split("\n").filter((l) => !l.includes(title) && !/^#/.test(l) && !(/^\s*\d+(\.\d+)+\.?(\s|$)/.test(l) && l.length < 90)).join("\n");
        x = V.summ(raw, 330);
        if (x.replace(/[\d.\s]+/g, " ").replace(/⇒.*$/, "").trim().length < 25 && !/⇒/.test(x)) x = "";
      }
      if (x) out.crar.push({ s, topic: top[1], title, x, rank: KEEP.indexOf(top[1]) });
      else out.other.push({ s, title });
    }
    out.crar.sort((a, b) => a.rank - b.rank);
    if (out.crar.length > 7) {
      out.crar.slice(7).forEach((x) => out.other.push({ s: x.s, title: x.title }));
      out.crar = out.crar.slice(0, 7);
    }
    for (const s of KB.index.sections) {
      if (!s.i.startsWith("lido:2.") || s.n < 120 || !mentions(s.t)) continue;
      out.rsi.push({ s, x: V.summ(await text(s.i), 300) });
      if (out.rsi.length >= 4) break;
    }
    return out;
  }
  async function genBox() {
    const want = [/strategic lateral offset/i, /contingency/i, /communication failure|radio communication failure/i, /interception/i, /RVSM/i, /GNSS (interference|outage)|jamming|spoofing/i];
    const out = [];
    for (const re of want) {
      const s = KB.index.sections.find((s2) => s2.i.startsWith("lido:1.") && re.test(s2.t) && s2.n > 150);
      if (s) out.push({ s, x: V.summ(await text(s.i), 260) });
    }
    return out;
  }
  const btn = (s, label) => {
    var _a;
    return `<button class="idlink" data-open="${E(s.i)}">${E(label || (s.d === "nr" ? "Network Report" : (((_a = KB.docs.get(s.d)) == null ? void 0 : _a.short) || s.d) + " " + s.t.replace(/^([\d.]+)\s.*$/, "$1")))}</button>`;
  };
  V.countries = async function(host) {
    var _a;
    const P = V.P;
    if (typeof KB === "undefined" || !KB.index) {
      host.innerHTML = '<p class="note">Biblioteca non caricata: carica EK_biblioteca.ekb da Studio manuali.</p>';
      return;
    }
    host.innerHTML = '<p class="thinking">Leggo CRAR, RSI, GEN e documenti di compagnia\u2026</p>';
    const O = V.O, groups = /* @__PURE__ */ new Map();
    const add = (code, f) => {
      const c = countryOf(code);
      if (!c) return;
      if (!groups.has(c.name)) groups.set(c.name, { c, firs: [] });
      if (f) groups.get(c.name).firs.push(f);
    };
    add(O.dep);
    (O.fir_eet || []).forEach((f) => add(f.fir, { fir: f.fir, min: f.min, name: f.name || ((O.nav || []).find((n) => n.t === "FIR" && n.fir === f.fir) || {}).name }));
    add(O.dest);
    const key = (O.flt || "") + O.date;
    V.cc = V.cc && V.cc.key === key ? V.cc : { key, cards: {} };
    let h = `<h2 class="vp">Paesi sorvolati \u2013 regole che contano</h2><p class="vsub">Ordine di precedenza: <b>compagnia</b> (OM-C, Network Report) \u2192 <b>CRAR</b> (differenze del paese) \u2192 <b>RSI</b> (regione) \u2192 <b>GEN</b> (regole generali Lido). Testo estratto e accorciato dalla biblioteca: tocca un riferimento per il testo completo.</p>`;
    if (P && P.countries) h += `<div class="vok">Con il file di preparazione: le sintesi scritte da Claude sono in cima a ogni paese.</div>`;
    host.innerHTML = h + '<div id="vc-list"></div><div id="vc-gen"></div>';
    const list = host.querySelector("#vc-list");
    for (const [name, g] of groups) {
      const card = document.createElement("details");
      card.className = "vcard";
      card.open = groups.size <= 6 || !!(P && P.countries && P.countries[name]);
      const firTxt = g.firs.map((f) => `${f.fir} ${hm(f.min)}`).join(" \xB7 ");
      card.innerHTML = `<summary><b>${E(name)}</b> <span class="vsub">${E(firTxt || (name === ((_a = countryOf(O.dep)) == null ? void 0 : _a.name) ? "partenza" : "arrivo"))}</span></summary><div class="vcb"><p class="thinking">\u2026</p></div>`;
      list.appendChild(card);
      const d = V.cc.cards[name] || (V.cc.cards[name] = await countryCard(g.c, g.firs));
      const mine = P && P.countries && P.countries[name];
      let b = "";
      if (mine) b += `<div class="vmine"><h4>Sintesi</h4><ul>${mine.map((x) => `<li>${String(x).replace(/</g, "&lt;").replace(/&lt;(\/?)(b|i|small)>/g, "<$1$2>")}</li>`).join("")}</ul></div>`;
      if (d.company.length) b += `<h4>Compagnia \u2013 prevale</h4><ul class="vrul">${d.company.map((x) => `<li>${E(x.x)} ${btn(x.s)}</li>`).join("")}</ul>`;
      if (d.crar.length) b += `<h4>CRAR \u2013 differenze del paese</h4><ul class="vrul">${d.crar.map((x) => `<li><span class="vtop">${E(x.topic)}</span> <b>${E(x.title)}</b> \u2013 ${E(x.x)} ${btn(x.s, "\u2192")}</li>`).join("")}</ul>`;
      else b += `<p class="note">Il CRAR non pubblica differenze operative per questo paese oltre alle voci sotto.</p>`;
      if (d.rsi.length) b += `<h4>RSI \u2013 regione</h4><ul class="vrul">${d.rsi.map((x) => `<li><b>${E(x.s.t.replace(/^[\d.]+\s*/, ""))}</b> \u2013 ${E(x.x)} ${btn(x.s, "\u2192")}</li>`).join("")}</ul>`;
      if (d.other.length) b += `<details class="vd"><summary>Altre voci CRAR (${d.other.length})</summary><p>${d.other.map((x) => btn(x.s, x.title)).join(" \xB7 ")}</p></details>`;
      b += `<p>${btn(g.c.root ? { i: g.c.root, d: "lido", t: "" } : null, "Apri il CRAR completo di " + name)}</p>`;
      card.querySelector(".vcb").innerHTML = b;
    }
    const gen = await genBox();
    host.querySelector("#vc-gen").innerHTML = gen.length ? `<details class="vcard"><summary><b>GEN \u2013 regole generali Lido da ricordare</b></summary><div class="vcb"><ul class="vrul">${gen.map((x) => `<li><b>${E(x.s.t.replace(/^[\d.]+\s*/, ""))}</b> \u2013 ${E(x.x)} ${btn(x.s, "\u2192")}</li>`).join("")}</ul></div></details>` : "";
  };
})();
