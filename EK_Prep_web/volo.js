(function() {
  const V = window.VOLO = { O: null, P: null, tab: "sum", ato: null, done: {} };
  const LS = (k) => {
    try {
      return JSON.parse(localStorage.getItem(k) || "null");
    } catch (e) {
      return null;
    }
  };
  const SS = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
    }
  };
  const E = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const R = (s) => E(s).replace(/&lt;(\/?)(b|i|small)&gt;/g, "<$1$2>");
  const z = (m) => {
    if (m == null || isNaN(m)) return "\u2013";
    m = (Math.round(m) % 1440 + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, "0") + String(m % 60).padStart(2, "0") + "Z";
  };
  const hm = (m) => {
    if (m == null || isNaN(m)) return "\u2013";
    const s = m < 0 ? "\u2212" : "";
    m = Math.abs(Math.round(m));
    return s + Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
  };
  const t1 = (kg) => kg == null ? "\u2013" : (kg / 1e3).toFixed(1) + " t";
  const key = (O) => O ? (O.flt || "") + "_" + (O.date || "") : "";
  V.toMin = () => V.ato != null ? V.ato : V.O && V.O.to;
  V.elapsed = () => {
    if (V.ato == null) return null;
    const d = /* @__PURE__ */ new Date();
    let n = d.getUTCHours() * 60 + d.getUTCMinutes() - V.ato;
    if (n < -720) n += 1440;
    return n;
  };
  V.fromItems = function(itemsByPage) {
    if (!window.FPOfp) throw new Error("Lettore OFP non caricato");
    const O = FPOfp.parse(FPOfp.layout(itemsByPage));
    if (!O || !O.flt) throw new Error("Non riesco a leggere l\u2019intestazione dell\u2019OFP");
    V.O = O;
    V.P = LS("ekprep:prep:" + key(O));
    const st = LS("ekprep:state:" + key(O)) || {};
    V.ato = st.ato == null ? null : st.ato;
    V.done = st.done || {};
    SS("ekprep:flight", O);
    return O;
  };
  V.restore = function() {
    const O = LS("ekprep:flight");
    if (!O) return false;
    V.O = O;
    V.P = LS("ekprep:prep:" + key(O));
    const st = LS("ekprep:state:" + key(O)) || {};
    V.ato = st.ato == null ? null : st.ato;
    V.done = st.done || {};
    return true;
  };
  V.save = () => SS("ekprep:state:" + key(V.O), { ato: V.ato, done: V.done });
  V.loadPrep = function(file) {
    return file.text().then((t) => {
      const P = JSON.parse(t);
      if (!P || P.schema !== "ekprep.v1") throw new Error("Non \xE8 un file di preparazione EK Prep");
      if (V.O && (P.flight !== V.O.flt || P.date !== V.O.date)) throw new Error(`Il file \xE8 per ${P.flight} del ${P.date}, l\u2019OFP aperto \xE8 ${V.O.flt} del ${V.O.date}`);
      V.P = P;
      if (V.O) SS("ekprep:prep:" + key(V.O), P);
      return P;
    });
  };
  function role(r) {
    return (V.O.wx || []).filter((w) => w.role === r);
  }
  function notamsAt(icao, t) {
    return (V.O.notams || []).filter((n) => n.icao === icao && (n.a == null || n.a <= t + 60) && (n.b == null || n.b >= t - 60));
  }
  const KEYN = /CLSD|CLOSED|U\/S|UNSERVICEABLE|NOT AVBL|NOT AVAILABLE|RESTRICTED|WINGSPAN|CODE [A-F]|ILS|LOC|GP |GLIDE|RVR|LVP|CRANE|OBST|WIP|BIRD|LASER|FREQ|CHANGE/;
  function pickNotams(list) {
    const company = list.filter((n) => /COMPANY/.test(n.cat));
    const ops = list.filter((n) => !/COMPANY|CHART/.test(n.cat) && KEYN.test(n.x));
    return { company, ops, rest: list.length - company.length - ops.length };
  }
  function wxFlags(w) {
    const s = (w.taf || "") + " " + (w.metar || "");
    const f = [];
    if (/\bTS|CB\b/.test(s)) f.push("TS/CB");
    if (/\bFG\b|BCFG|PRFG/.test(s)) f.push("nebbia");
    if (/\bSN\b|FZ/.test(s)) f.push("neve/ghiaccio");
    if (/G[3-9]\dKT|\b\d{3}[3-9]\dKT/.test(s)) f.push("vento forte");
    if (/\bDU|SA\b|BLDU|SS\b|DS\b/.test(s)) f.push("polvere");
    return f;
  }
  function autoThreats() {
    const O = V.O, out = [];
    const g = [...new Set((O.rnotams || []).filter((n) => n.kind === "gnss").map((n) => n.fir))];
    if (g.length) out.push({ t: "Interferenza GNSS", m: "NOTAM in " + g.join(", ") + ". Segui la procedura FCOM GNSS INTERFERENCE.", s: "OFP NOTAM" });
    const c = [...new Set((O.rnotams || []).filter((n) => n.kind === "conflict").map((n) => n.fir))];
    if (c.length) out.push({ t: "Spazi aerei con avvisi di sicurezza", m: c.join(", ") + " \u2013 leggi i NOTAM nella pagina NOTAM.", s: "OFP NOTAM" });
    const mx = (O.nav || []).filter((n) => n.mora).sort((a, b) => b.mora - a.mora)[0];
    if (mx && mx.mora >= 1e4) out.push({ t: `MORA ${mx.mora} ft a ${mx.wpt} (${hm(mx.eet)})`, m: "Terreno alto: rivedi depressurizzazione e drift-down dell\u2019OFP.", s: "OFP navlog" });
    for (const w of role("DEST").concat(role("ALTN"))) {
      const f = wxFlags(w);
      if (f.length) out.push({ t: `${w.icao} (${w.role === "DEST" ? "destinazione" : "alternato"}): ${f.join(", ")}`, m: "Controlla l\u2019orario nel TAF.", s: "OFP meteo" });
    }
    const ow = O.wts && O.wts.ETOW - O.wts.MLWT;
    if (ow > 0) out.push({ t: `Rientro: ${t1(ow)} sopra MLW al decollo`, m: "Brief overweight landing.", s: "OFP pesi" });
    if (O.etops_min) out.push({ t: `ETOPS ${O.etops_min} min`, m: "Verifica ETP e aeroporti meteo-permissibili.", s: "OFP" });
    return out.slice(0, 6);
  }
  function head() {
    const O = V.O, P = V.P, f = O.fuel || {}, w = O.wts || {};
    const old = O.date && O.date < (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const pre = P && P.prelim || old;
    const mx = (O.nav || []).filter((n) => n.mora).sort((a, b) => b.mora - a.mora)[0];
    const mind = (f.altn && f.altn.kg || 0) + (f.frsv && f.frsv.kg || 0);
    const k = (l, v, s) => `<div class="vk"><span>${l}</span><b>${v}</b>${s ? `<small>${s}</small>` : ""}</div>`;
    return (pre ? `<div class="vban">PRELIMINARY \u2013 OFP ${E(O.ofpno)} del ${E(O.date)}: carburante, pesi, orari, NOTAM, registrazione e SELCAL sono di quel giorno.</div>` : "") + `<div class="vhead"><div><h2>${E(O.flt)} ${E(O.dep_iata)}\u2013${E(O.dest_iata)}</h2><p>${E(O.date)} \xB7 ${E(O.reg_d || O.reg)} ${E(O.type)} \xB7 SELCAL <b>${E(O.sel)}</b> \xB7 OFP ${E(O.ofpno)}${P ? ' \xB7 <span class="vok">file di preparazione</span>' : ""}</p></div><div class="vtimes">${k("STD", z(O.std))}${k("T/O", z(V.toMin()), V.ato != null ? "effettivo" : "piano +" + (O.taxi_min || 0))}${k("ETA", z(V.toMin() + (O.trip_min || 0)))}${k("TRIP", hm(O.trip_min), E(O.crz_fl || ""))}</div></div><div class="vkeys">${k("T/O fuel", t1(f.tof && f.tof.kg))}${k("Trip", t1(f.trip && f.trip.kg))}${k("Min diversione", t1(mind), E(f.altn && f.altn.tag || ""))}${k("Extra", t1(f.extra && f.extra.kg), f.extra ? hm(f.extra.min) + " " + E(f.extra.tag || "") : "")}${k("ETOW / MTOW", (w.ETOW / 1e3).toFixed(1) + " / " + (w.MTOW / 1e3).toFixed(1))}${k("ELW / MLW", (w.ELWT / 1e3).toFixed(1) + " / " + (w.MLWT / 1e3).toFixed(1))}${k("MORA max", mx ? mx.mora + " ft" : "\u2013", mx ? E(mx.wpt) + " " + hm(mx.eet) : "")}${k("Cont / FRSV", t1(f.cont && f.cont.kg) + " / " + t1(f.frsv && f.frsv.kg))}</div>`;
  }
  const tbl = (h, rows) => `<div class="vtw"><table class="vt"><thead><tr>${h.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const src = (s) => s ? ` <small class="vsrc">${R(s)}</small>` : "";
  function pSum() {
    const P = V.P, th = P && P.threats ? P.threats : autoThreats();
    let h = head() + `<h3>Minacce principali</h3><ol class="vthreats">${th.map((x) => `<li><b>${R(x.t)}</b> \u2013 ${R(x.m)}${src(x.s)}</li>`).join("") || "<li>Nessuna minaccia particolare dall\u2019OFP.</li>"}</ol>`;
    if (!P) h += `<p class="note">Solo OFP. Con il file di preparazione di Claude qui compaiono le minacce A350 con le fonti, le procedure dei FIR e i briefing.</p>`;
    h += "<h3>Alternati</h3>" + tbl(["Aeroporto", "RWY", "NM", "Tempo", "Fuel", "Meteo"], (V.O.alts || []).map((a) => {
      const w = (V.O.wx || []).find((x) => x.icao === a.icao);
      const f = w ? wxFlags(w) : [];
      const cls = P && P.classes && P.classes[a.icao] ? " <small>" + E(P.classes[a.icao]) + "</small>" : "";
      return [`<b>${E(a.icao)}</b>${cls}`, E(a.rwy), a.nm, hm(a.min), t1(a.kg), f.length ? `<b>${f.join(", ")}</b>` : "ok"];
    }));
    if (P && P.tem) h += `<details class="vd"><summary>Tutte le minacce per fase (${P.tem.length})</summary>${tbl(["Fase", "Minaccia", "Mitigazione", "Rif."], P.tem.map((r) => r.map(R)))}</details>`;
    if (P && P.values) h += `<details class="vd"><summary>Valori A350 usati</summary>${tbl(["Voce", "Valore", "Fonte"], P.values.map((r) => r.map(R)))}</details>`;
    if (P && P.missing) h += `<p class="note">Non incluso: <i>${R(P.missing)}</i></p>`;
    return h;
  }
  function wxRow(w) {
    return w ? `<p class="vwx"><b>METAR</b> ${E(w.metar || "\u2013")}<br><b>TAF</b> ${E(w.taf || "\u2013")}</p>` : "";
  }
  function notamBlock(icao, t, label) {
    const s = pickNotams(notamsAt(icao, t));
    const li = (n) => `<li><b>${E(n.id)}</b> ${E(n.x.length > 260 ? n.x.slice(0, 260) + "\u2026" : n.x)}</li>`;
    return `<h3>${label}</h3>` + (s.ops.length ? `<ul class="vn">${s.ops.slice(0, 10).map(li).join("")}</ul>` : '<p class="note">Nessun NOTAM operativo attivo all\u2019orario.</p>') + (s.ops.length > 10 ? `<details class="vd"><summary>Altri ${s.ops.length - 10}</summary><ul class="vn">${s.ops.slice(10).map(li).join("")}</ul></details>` : "") + (s.company.length ? `<details class="vd"><summary>NOTAM di compagnia (${s.company.length})</summary><ul class="vn">${s.company.map(li).join("")}</ul></details>` : "");
  }
  function pDep() {
    var _a;
    const O = V.O, P = V.P, w = role("DEP")[0];
    let h = `<h2 class="vp">Partenza ${E(O.dep)} ${E(O.dep_iata)}</h2><p class="vsub">RWY ${E(((_a = (O.route || "").match(/^\w{4}\/(\w+)/)) == null ? void 0 : _a[1]) || "\u2013")} \xB7 ${E((O.route || "").split(" ")[1] || "")} \xB7 STD ${z(O.std)} \xB7 taxi ${O.taxi_min} min</p>`;
    if (P && P.dep) h += tbl(["", "Brief", "Fonte"], P.dep.map((r) => [`<b>${R(r[0])}</b>`, R(r[1]), R(r[2] || "")]));
    h += "<h3>Meteo</h3>" + wxRow(w) + notamBlock(O.dep, O.std, "NOTAM che contano (\xB11 h)");
    return h;
  }
  function pArr() {
    var _a;
    const O = V.O, P = V.P, w = role("DEST")[0], eta = V.toMin() + (O.trip_min || 0);
    let h = `<h2 class="vp">Arrivo ${E(O.dest)} ${E(O.dest_iata)}</h2><p class="vsub">RWY ${E(((_a = (O.route || "").match(/\/(\w+)\s*$/)) == null ? void 0 : _a[1]) || "\u2013")} \xB7 ETA ${z(eta)} \xB7 fuel all\u2019arrivo ${t1((O.fuel.tof && O.fuel.tof.kg) - (O.fuel.trip && O.fuel.trip.kg))}</p>`;
    if (P && P.arr) h += tbl(["", "Brief", "Fonte"], P.arr.map((r) => [`<b>${R(r[0])}</b>`, R(r[1]), R(r[2] || "")]));
    h += "<h3>Meteo</h3>" + wxRow(w) + notamBlock(O.dest, eta, "NOTAM che contano (\xB11 h)");
    if (P && P.div) h += `<h3>${R(P.div.title)}</h3>` + tbl(["", "Valore", "Fonte"], P.div.rows.map((r) => [`<b>${R(r[0])}</b>`, R(r[1]), R(r[2] || "")]));
    return h;
  }
  function pWpt() {
    var _a;
    const O = V.O, P = V.P, to = V.toMin(), el = V.elapsed();
    const rows = [], fe = {};
    (O.fir_eet || []).forEach((f) => fe[f.fir] = f.min);
    let fir = null;
    for (const n of O.nav || []) {
      if (n.t === "FIR") {
        fir = n;
        rows.push({ fir: n.fir, name: n.name, eet: fe[n.fir] });
        continue;
      }
      rows.push({ wpt: n.wpt, eet: n.eet, mora: n.mora, f: n.fplan, firc: fir && fir.fir });
    }
    (P && P.calls || []).forEach((c) => rows.push({ call: c, eet: c.eet }));
    rows.sort((a, b) => {
      var _a2, _b;
      return ((_a2 = a.eet) != null ? _a2 : 0) - ((_b = b.eet) != null ? _b : 0) || (a.call ? -1 : 0) - (b.call ? -1 : 0);
    });
    const next = el == null ? null : rows.find((r) => r.wpt && r.eet > el);
    let h = `<div class="vato"><label>Decollo effettivo (UTC) <input id="v-ato" inputmode="numeric" maxlength="4" placeholder="${z(O.to).slice(0, 4)}" value="${V.ato != null ? z(V.ato).slice(0, 4) : ""}"></label><button class="btn" id="v-now">Airborne adesso</button>${V.ato != null ? `<button class="btn" id="v-clr">Annulla</button>` : ""}<span class="note">${V.ato != null ? "Orari dal decollo effettivo" + (el != null ? " \xB7 in volo da " + hm(el) : "") : "Orari dal decollo pianificato " + z(O.to)}</span></div>`;
    h += `<div class="vtw"><table class="vt vw"><thead><tr><th>EET</th><th>UTC</th><th>Punto</th><th>MORA</th><th>Fuel min</th><th></th></tr></thead><tbody>`;
    for (const r of rows) {
      if (r.call) {
        h += `<tr class="vcall"><td>${hm(r.eet)}</td><td>${z(to + r.eet)}</td><td colspan="4"><b>\u{1F4DE} ${E(r.call.fir)}</b> ${R(r.call.text)}</td></tr>`;
        continue;
      }
      if (r.fir) {
        const x = P && P.fir && P.fir[r.fir];
        h += `<tr class="vfir"><td>${hm(r.eet)}</td><td>${z(to + r.eet)}</td><td colspan="4"><b>\u25B6 ${E(r.fir)} ${E(r.name || "")}</b>` + (x ? `<div class="vfx">${x.call ? `<div><span>Comms</span> ${R(x.call)}</div>` : ""}${x.special ? `<div><span>Regole</span> ${R(x.special)}</div>` : ""}${x.threat ? `<div><span>Minaccia</span> ${R(x.threat)}</div>` : ""}</div>` : "") + "</td></tr>";
        continue;
      }
      const id = r.wpt + "@" + r.eet, dn = V.done[id];
      h += `<tr class="${dn ? "vdone" : ""}${next === r ? " vnext" : ""}" data-w="${E(id)}"><td>${hm(r.eet)}</td><td>${z(to + r.eet)}</td><td><b>${E(r.wpt)}</b>${next === r ? ' <span class="vtag">NEXT</span>' : ""}</td><td class="${r.mora >= 1e4 ? "vbad" : r.mora >= 5e3 ? "vwarn" : ""}">${(_a = r.mora) != null ? _a : "\u2013"}</td><td>${r.f != null ? r.f.toFixed(1) : "\u2013"}</td><td>${dn ? "\u2713" : ""}</td></tr>`;
    }
    return h + '</tbody></table></div><p class="note">Tocca un punto per segnarlo come passato. MORA in ambra sopra 5000 ft, in rosso sopra 10000 ft.</p>';
  }
  function pNotam() {
    const O = V.O;
    const by = {};
    (O.notams || []).forEach((n) => (by[n.icao + " \xB7 " + n.role] = by[n.icao + " \xB7 " + n.role] || []).push(n));
    (O.rnotams || []).forEach((n) => (by[n.fir + " \xB7 FIR"] = by[n.fir + " \xB7 FIR"] || []).push(n));
    const nc = O.ntcheck ? `<p class="note">${O.ntcheck.read} NOTAM letti su ${O.ntcheck.hdr} dichiarati nel bollettino.</p>` : "";
    return `<h2 class="vp">NOTAM e avvisi</h2>${nc}<input class="inp" id="v-nq" placeholder="Cerca (es. RWY, ILS, GNSS, CLSD)"><div id="v-nl">${Object.keys(by).map((k) => `<details class="vd"><summary><b>${E(k)}</b> \u2013 ${by[k].length}</summary><ul class="vn">${by[k].map((n) => `<li data-x="${E(n.x.toLowerCase())}"><b>${E(n.id)}</b>${n.kind === "gnss" || n.kind === "conflict" ? ' <b class="vbad">' + n.kind + "</b>" : ""} ${E(n.x)}</li>`).join("")}</ul></details>`).join("")}</div>` + ((O.crew_alert || []).length ? `<h3>Crew alert (${O.crew_alert.length})</h3><ul class="vn">${O.crew_alert.map((c) => `<li><b>${E(c.id)}</b> ${E(c.title || "")} \u2013 ${E(c.x)}</li>`).join("")}</ul>` : "");
  }
  const TABS = [["sum", "Sintesi"], ["dep", "Partenza"], ["arr", "Arrivo"], ["wpt", "Waypoint"], ["map", "Mappa"], ["ntm", "NOTAM"]];
  V.render = function(host) {
    host = host || document.getElementById("out");
    if (!host || !V.O) return;
    const mapcard = document.getElementById("mapcard");
    const body = { sum: pSum, dep: pDep, arr: pArr, wpt: pWpt, ntm: pNotam, map: () => '<div id="v-mapslot"></div>' }[V.tab]();
    host.innerHTML = `<nav class="vtabs">${TABS.map((t) => `<button data-v="${t[0]}" class="${V.tab === t[0] ? "on" : ""}">${t[1]}</button>`).join("")}</nav><div class="vbody">${body}</div><p class="vfoot">${E(V.O.flt)} ${E(V.O.date)} ${E(V.O.dep_iata)}-${E(V.O.dest_iata)} \xB7 OFP ${E(V.O.ofpno)} \xB7 ${E(V.O.reg_d || V.O.reg)} | Strumento di preparazione: OFP, documentazione Emirates e ATC prevalgono.</p>`;
    if (mapcard) {
      if (V.tab === "map") {
        document.getElementById("v-mapslot").appendChild(mapcard);
        mapcard.hidden = false;
      } else {
        mapcard.hidden = true;
      }
    }
    host.querySelectorAll(".vtabs button").forEach((b) => b.onclick = () => {
      V.tab = b.dataset.v;
      V.render(host);
      window.scrollTo(0, host.offsetTop - 8);
    });
    const a = host.querySelector("#v-ato");
    if (a) a.onchange = () => {
      const m = /^(\d{2})(\d{2})$/.exec(a.value.trim());
      if (m) {
        V.ato = +m[1] * 60 + +m[2];
        V.save();
        V.render(host);
      }
    };
    const nw = host.querySelector("#v-now");
    if (nw) nw.onclick = () => {
      const d = /* @__PURE__ */ new Date();
      V.ato = d.getUTCHours() * 60 + d.getUTCMinutes();
      V.save();
      V.render(host);
    };
    const cl = host.querySelector("#v-clr");
    if (cl) cl.onclick = () => {
      V.ato = null;
      V.done = {};
      V.save();
      V.render(host);
    };
    host.querySelectorAll("tr[data-w]").forEach((tr) => tr.onclick = () => {
      const k = tr.dataset.w;
      if (V.done[k]) delete V.done[k];
      else V.done[k] = 1;
      V.save();
      V.render(host);
    });
    const q = host.querySelector("#v-nq");
    if (q) q.oninput = () => {
      const s = q.value.trim().toLowerCase();
      host.querySelectorAll("#v-nl li").forEach((li) => li.hidden = !!s && !li.dataset.x.includes(s));
      host.querySelectorAll("#v-nl details").forEach((d) => {
        d.open = !!s && !!d.querySelector("li:not([hidden])");
        d.hidden = !!s && !d.querySelector("li:not([hidden])");
      });
    };
  };
  if (V.tick) clearInterval(V.tick);
  V.tick = setInterval(() => {
    if (V.O && V.ato != null && V.tab === "wpt") V.render();
  }, 6e4);
})();
