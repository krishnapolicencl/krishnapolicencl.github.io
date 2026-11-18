/* Page code: loading data, showing reports, export, admin upload. */
(function () {
  "use strict";
  var cfg = window.NCL_CONFIG, NCL = window.NCL, NCLG = window.NCLG;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var VIEWS = ["abstract", "lt", "bet", "gt", "all"];
  var GVIEWS = ["a60", "a90", "l60", "l90"];                 // UI - Grave / Non Grave section
  var GLABEL = { a60: "UI Abstract 60 Days Cases", a90: "UI Abstract 90 Days Cases",
                 l60: "60 Days Cases UI >60 Days", l90: "90 Days Cases UI >90 Days" };
  var KINDS = ["60", "90", "cc"];                             // uploaded files: 60 DAYS, 90 DAYS, CCDASHBOARD
  var kindLabel = function (k) { return k === "cc" ? "CCDASHBOARD" : k + " DAYS"; };
  var OLD_SERVER_MSG = "<b>The Google Apps Script is an old version — it cannot store the CCDASHBOARD file.</b> " +
    "Open the Apps Script project, replace the code with the latest Code.gs, save, then Deploy → Manage deployments → Edit → " +
    "Version: New version → Deploy.";
  var BLANK = function () { return { sd: "", ps: "", cat: "", q: "", grave: "", band: "" }; };

  var state = {
    data: { 60: null, 90: null, cc: null },   // published (or previewed) data files
    rep: {},                           // computed reports
    grave: {},                         // grave / non grave reports (need CCDASHBOARD)
    asOn: NCL.todayIso(),
    tab: "60", view: "abstract",
    f: BLANK(),
    back: [],                          // where the Back button returns to
    preview: false, problem: ""
  };
  var published = { 60: null, 90: null, cc: null };   // what is saved on the server now
  var savedData = { 60: null, 90: null, cc: null };   // its data, to undo a preview
  var pending = { 60: null, 90: null, cc: null };     // files chosen but not published yet

  /* ---------------- start ---------------- */
  $("unitName").textContent = cfg.unitName;
  $("appTitle").textContent = cfg.appTitle;
  $("credit").textContent = cfg.credit;
  $("asOn").value = state.asOn;
  $("asOn").addEventListener("change", function () {
    state.asOn = this.value || NCL.todayIso(); this.value = state.asOn; recompute(); render();
  });
  document.querySelectorAll(".seg button").forEach(function (b) {
    b.addEventListener("click", function () { go(b.dataset.tab, state.view); });
  });
  $("printBtn").addEventListener("click", function () { window.print(); });
  $("xlBtn").addEventListener("click", function () { exportCurrent(); });
  $("xlAllBtn").addEventListener("click", function () { exportAll(); });
  $("adminBtn").addEventListener("click", openAdmin);
  window.addEventListener("hashchange", readHash);

  readHash(true);
  loadData();

  function loadData() {
    if (!cfg.apiUrl) { state.problem = "The site is not connected yet: paste the Apps Script web app URL into <b>apiUrl</b> in assets/config.js."; render(); return; }
    $("view").innerHTML = '<div class="sheet"><div class="empty">Loading…</div></div>';
    fetch(cfg.apiUrl + (cfg.apiUrl.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || "error");
        state.oldServer = !("dcc" in j);       // Apps Script from before CCDASHBOARD support
        KINDS.forEach(function (k) {
          var d = j["d" + k];
          state.data[k] = d && Array.isArray(d.rows) ? d : null;
          published[k] = state.data[k] ? { file: d.meta && d.meta.file, n: d.rows.length } : null;
          savedData[k] = state.data[k];
        });
        state.problem = "";
      })
      .catch(function () { state.problem = "Could not load the data. Check the internet connection, and the apiUrl in assets/config.js."; })
      .then(function () { recompute(); render(); });
  }

  function readHash(silent) {
    var m = /^#(60|90|g)\/(\w+)$/.exec(location.hash);
    if (m && (m[1] === "g" ? GVIEWS : VIEWS).indexOf(m[2]) >= 0 && (m[1] !== state.tab || m[2] !== state.view)) {
      state.tab = m[1]; state.view = m[2]; state.f = BLANK();
    }
    if (silent !== true) render();
  }
  function go(tab, view, filters, isBack) {
    if (tab === "g" && GVIEWS.indexOf(view) < 0) view = "a60";
    if (tab !== "g" && VIEWS.indexOf(view) < 0) view = "abstract";
    if (!isBack && (tab !== state.tab || view !== state.view)) {
      state.back.push({ tab: state.tab, view: state.view, f: Object.assign({}, state.f) });
      if (state.back.length > 30) state.back.shift();
    }
    state.tab = tab; state.view = view;
    state.f = Object.assign(BLANK(), filters || {});
    history.replaceState(null, "", "#" + tab + "/" + view);
    render();
    window.scrollTo(0, 0);
  }
  function goBack() {
    var p = state.back.pop() || { tab: state.tab, view: state.tab === "g" ? "a60" : "abstract", f: {} };
    go(p.tab, p.view, p.f, true);
  }
  function resetFilters() { state.f = BLANK(); render(); }
  function recompute() {
    state.rep = {};
    [60, 90].forEach(function (L) {
      if (state.data[L]) state.rep[L] = NCL.build(state.data[L].rows, L, state.asOn, cfg);
    });
    state.grave = {};
    if (state.data.cc) [60, 90].forEach(function (L) {
      if (state.rep[L]) state.grave[L] = NCLG.build(state.rep[L], state.data.cc.rows, cfg);
    });
  }

  /* ---------------- rendering ---------------- */
  function render() {
    var isG = state.tab === "g";
    var R = isG ? null : state.rep[state.tab], has = !!(state.rep[60] || state.rep[90]);
    $("nav").hidden = !has; $("bar").hidden = isG ? !graveOf(state.view) : !R;
    document.querySelectorAll(".seg button").forEach(function (b) {
      b.setAttribute("aria-selected", b.dataset.tab === state.tab ? "true" : "false");
    });
    renderNotice(R);
    renderMeta();
    if (has && isG) { renderGrave(); return; }
    if (!has) {
      $("view").innerHTML = '<div class="sheet"><div class="empty"><b>No records are available.</b><br>' +
        'Use <b>Admin</b> (top right) to sign in and upload the 60 DAYS and 90 DAYS Excel files.</div></div>';
      return;
    }
    if (!R) {
      $("subtabs").innerHTML = "";
      $("view").innerHTML = '<div class="sheet"><div class="empty">The ' + state.tab +
        ' DAYS file has not been uploaded yet.</div></div>';
      return;
    }
    var d = R.defs;
    $("subtabs").innerHTML = VIEWS.map(function (v) {
      var n = v === "abstract" ? "" : '<span class="n">' + (v === "all" ? R.records.length : R.lists[v].length) + "</span>";
      return '<button type="button" data-view="' + v + '" aria-selected="' + (v === state.view) + '">' + esc(d[v].label) + n + "</button>";
    }).join("");
    $("subtabs").querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () { go(state.tab, b.dataset.view); });
    });
    setPrintPage("landscape");
    renderFilters(R);
    if (state.view === "abstract") renderAbstract(R); else renderList(R);
  }

  function renderNotice(R) {
    var parts = [];
    if (state.problem) parts.push(state.problem);
    if (state.oldServer) parts.push(OLD_SERVER_MSG);
    if (state.preview) parts.push("<b>Preview only.</b> These files are loaded on this device and are not saved yet. Open Admin and press Upload.");
    if (state.asOn !== NCL.todayIso()) parts.push("Days are calculated as on <b>" + NCL.dmy(state.asOn) + "</b>, not today.");
    if (R) {
      var u = Object.keys(R.abstract.unmatched);
      if (u.length) parts.push("<b>Not in the abstract:</b> " + u.map(function (s) {
        return esc(s) + " (" + R.abstract.unmatched[s] + ")";
      }).join(", ") + " — these stations are not in the sub-division list (assets/config.js).");
      if (R.abstract.unclassified) parts.push(R.abstract.unclassified + " case(s) have a missing or unreadable date and are not counted.");
    }
    var G = state.tab === "g" && graveOf(state.view);
    if (G && G.notFound) parts.push(G.notFound + " UI case(s) of " + G.limit + " DAYS were not found in the CCDASHBOARD file; they are counted as Non Grave " +
      "(shown as “Not in CCDASHBOARD” in the UI cases list).");
    if (G && Object.keys(G.unmatched).length) parts.push("<b>Not in the abstract:</b> " + Object.keys(G.unmatched).map(esc).join(", "));
    $("notice").hidden = !parts.length;
    $("notice").innerHTML = parts.join("<br>");
  }

  function renderMeta() {
    var bits = KINDS.map(function (L) {
      var m = state.data[L] && state.data[L].meta;
      if (!m) return null;
      var t = m.uploadedAt ? new Date(m.uploadedAt) : null;
      return kindLabel(L) + ": " + esc(m.file || "file") + ", " + state.data[L].rows.length + (L === "cc" ? " rows" : " cases") +
        (t && !isNaN(t) ? ", uploaded " + t.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "");
    }).filter(Boolean);
    $("meta").innerHTML = bits.join(" &nbsp;•&nbsp; ");
  }

  function setPrintPage(orient) {
    var s = $("printPage") || document.head.appendChild(Object.assign(document.createElement("style"), { id: "printPage" }));
    s.textContent = "@page{size:legal " + orient + ";margin:1.4cm}";
  }

  function renderFilters(R) {
    var box = $("filters");
    if (state.view === "abstract") { box.innerHTML = ""; return; }
    var f = state.f, h = '<button class="btn back" id="backBtn" type="button">← Back</button>';
    h += '<label>Sub-division<select id="fSd"><option value="">All</option>' + cfg.subDivisions.map(function (g) {
      return '<option value="' + g.code + '"' + (f.sd === g.code ? " selected" : "") + ">" + g.code + "</option>";
    }).join("") + "</select></label>";
    var stations = [];
    cfg.subDivisions.forEach(function (g) { if (!f.sd || f.sd === g.code) stations = stations.concat(g.stations); });
    h += '<label>Police station<select id="fPs"><option value="">All</option>' + stations.map(function (s) {
      return '<option' + (f.ps === s ? " selected" : "") + ">" + esc(s) + "</option>";
    }).join("") + "</select></label>";
    if (state.view === "all") {
      h += '<label>Remarks<select id="fCat"><option value="">All</option>' + NCL.criteriaList(R.labels).map(function (c) {
        return '<option' + (f.cat === c ? " selected" : "") + ">" + esc(c) + "</option>";
      }).join("") + "</select></label>";
    }
    h += '<label>Search<input id="fQ" type="search" placeholder="FIR no / section" value="' + esc(f.q) + '"></label>';
    h += '<button class="btn" id="resetBtn" type="button">Reset</button>';
    box.innerHTML = h;
    $("backBtn").onclick = goBack;
    $("resetBtn").onclick = resetFilters;
    $("fSd").onchange = function () { f.sd = this.value; f.ps = ""; render(); };
    $("fPs").onchange = function () { f.ps = this.value; render(); };
    if ($("fCat")) $("fCat").onchange = function () { f.cat = this.value; render(); };
    var timer;
    $("fQ").oninput = function () {
      var v = this.value; clearTimeout(timer);
      timer = setTimeout(function () { f.q = v; renderList(state.rep[state.tab]); }, 200);
    };
  }

  function currentRows(R) {
    var f = state.f, src = state.view === "all" ? R.records : R.lists[state.view];
    var q = f.q.trim().toUpperCase(), ps = NCL.key(f.ps);
    var cats = f.cat ? (NCL.criteriaGroups(R.labels)[f.cat] || [f.cat]) : null;
    return src.filter(function (o) {
      if (f.sd && o.sd !== f.sd) return false;
      if (ps && NCL.key(o.ps) !== ps) return false;
      if (cats && cats.indexOf(o.remark) < 0) return false;
      if (q && (o.fir + " " + o.acts + " " + o.ps).toUpperCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function filtered() { var f = state.f; return !!(f.sd || f.ps || f.cat || f.q.trim()); }

  function tagClass(R, remark) {
    var L = R.labels;
    return remark === L.gt ? "gt" : remark === L.bet ? "bet" : remark === L.lt ? "lt" : "";
  }

  function renderList(R) {
    var rows = currentRows(R), d = R.defs[state.view], all = state.view === "all", h = [];
    var title = all ? NCL.allTitle(R) : d.title + NCL.dmy(R.asOn);
    h.push('<div class="sheet"><h2>' + esc(title) + "</h2>");
    h.push('<p class="count-line no-print">' + rows.length + " case(s)" + (filtered() ? " match the filters" : "") + "</p>");
    if (!rows.length) { h.push('<div class="empty">No cases.</div></div>'); $("view").innerHTML = h.join(""); return; }
    h.push("<table><thead><tr><th>S.NO</th><th>POLICE STATION</th><th>FIR NO</th><th>FIR DT</th><th>ACTS &amp; SEC</th>");
    h.push(all ? "<th>Stage Of The Case</th><th>CHARGESHEET DATE</th><th>Case Stage</th><th>Days Duration</th><th>Remarks</th><th>SUB_DIV</th>"
               : "<th>Days Duration</th><th>SUB_DIV</th>");
    h.push("</tr></thead><tbody>");
    rows.forEach(function (o, i) {
      h.push('<tr><td class="num">' + (i + 1) + "</td><td>" + esc(o.ps) + '</td><td class="nw">' + esc(o.fir) +
        '</td><td class="c nw">' + NCL.dmy(o.fd) + '</td><td class="acts">' + esc(o.acts) + "</td>");
      if (all) {
        h.push("<td>" + esc(o.stage) + '</td><td class="c">' + esc(NCL.dmy(o.cd)) + '</td><td class="c">' + o.caseStage +
          '</td><td class="num">' + (o.days === null ? "" : o.days) + '</td><td><span class="tag ' + tagClass(R, o.remark) + '">' +
          esc(o.remark) + '</span></td><td class="c">' + esc(o.sd) + "</td>");
      } else {
        h.push('<td class="num">' + o.days + '</td><td class="c">' + esc(o.sd) + "</td>");
      }
      h.push("</tr>");
    });
    h.push("</tbody></table></div>");
    $("view").innerHTML = h.join("");
  }

  function renderAbstract(R) {
    var ab = R.abstract, h = [];
    var kinds = ["sum", "", "", "", "sum", "lt", "bet", "gt"];           // one per abstract column
    var cls = function (j) { return "num" + (kinds[j] === "sum" ? " sumc" : kinds[j] === "gt" ? " gtc" : kinds[j] === "bet" ? " betc" : ""); };
    var cnt = function (v, f) {
      return v ? '<button type="button" class="cnt" data-f="' + esc(JSON.stringify(f)) + '">' + v + "</button>" : "0";
    };
    h.push('<div class="tiles">');
    ab.columns.forEach(function (c, j) {
      h.push('<button type="button" class="tile ' + kinds[j] + '" data-f="' + esc(JSON.stringify({ cat: c })) +
        '"><div class="k">' + NCL.wrapLabel(c).map(esc).join("<br>") + '</div><div class="v">' + ab.grand[j] + "</div></button>");
    });
    h.push("</div>");
    h.push('<div class="sheet"><h2>' + esc(ab.title) + '</h2><table class="abs"><thead><tr><th>S.NO</th><th>POLICE STATION</th>');
    ab.columns.forEach(function (c, j) {
      h.push('<th class="' + (kinds[j] === "gt" ? "gth" : kinds[j] === "bet" ? "beth" : kinds[j] === "sum" ? "sumh" : "") + '">' + NCL.wrapLabel(c).map(esc).join("<br>") + "</th>");
    });
    h.push("<th>Grand<br>Total</th></tr></thead><tbody>");
    var breakAfter = cfg.abstractPageBreakAfter || "KPM";
    ab.groups.forEach(function (g) {
      h.push('<tr class="section"><td colspan="11">' + esc(g.title) + "</td></tr>");
      g.rows.forEach(function (x) {
        h.push('<tr><td class="num">' + x.sno + "</td><td>" + esc(x.ps) + "</td>");
        x.counts.forEach(function (v, j) { h.push('<td class="' + cls(j) + '">' + cnt(v, { ps: x.ps, cat: ab.columns[j] }) + "</td>"); });
        h.push('<td class="num">' + cnt(x.total, { ps: x.ps }) + "</td></tr>");
      });
      h.push('<tr class="total' + (g.code === breakAfter ? " pagebreak" : "") + '"><td colspan="2" class="c">' + esc(g.totalLabel) + "</td>");
      g.counts.forEach(function (v, j) { h.push('<td class="' + cls(j) + '">' + cnt(v, { sd: g.code, cat: ab.columns[j] }) + "</td>"); });
      h.push('<td class="num">' + cnt(g.total, { sd: g.code }) + "</td></tr>");
    });
    h.push('<tr class="grand"><td></td><td>Grand Total</td>');
    ab.grand.forEach(function (v, j) { h.push('<td class="' + cls(j) + '">' + cnt(v, { cat: ab.columns[j] }) + "</td>"); });
    h.push('<td class="num">' + ab.grandTotal + "</td></tr></tbody></table></div>");
    $("view").innerHTML = h.join("");
    $("view").querySelectorAll("[data-f]").forEach(function (b) {
      b.addEventListener("click", function () { go(state.tab, "all", JSON.parse(b.dataset.f)); });
    });
  }

  /* ---------------- UI - Grave / Non Grave ---------------- */
  function graveOf(view) { return state.grave[view.slice(1)] || null; }

  function renderGrave() {
    var view = state.view, G = graveOf(view);
    $("subtabs").innerHTML = GVIEWS.map(function (v) {
      var g = graveOf(v), n = v.charAt(0) === "l" && g ? '<span class="n">' + g.cases.filter(function (c) { return c.band === g.labels.gt; }).length + "</span>" : "";
      return '<button type="button" class="gtab" data-view="' + v + '" aria-selected="' + (v === view) + '">' + GLABEL[v] + n + "</button>";
    }).join("");
    $("subtabs").querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () { go("g", b.dataset.view); });
    });
    setPrintPage("landscape");
    if (!G) {
      $("filters").innerHTML = "";
      var need = !state.data.cc ? "the <b>CCDASHBOARD</b> file" : "the <b>" + view.slice(1) + " DAYS</b> file";
      $("view").innerHTML = '<div class="sheet"><div class="empty">This report needs ' + need +
        '. Use <b>Admin</b> (top right) to log in and upload it.</div></div>';
      return;
    }
    if (view.charAt(0) === "a") { $("filters").innerHTML = ""; renderGraveAbstract(G); }
    else { renderGraveFilters(G); renderGraveList(G); }
  }

  function renderGraveAbstract(G) {
    var L = G.labels, h = [], lv = "l" + G.limit, cols = G.columns;
    var cls = function (j) { return "num" + (cols[j].sum || j === 0 ? " sumc" : "") + (cols[j].red ? " gtc" : ""); };
    var cnt = function (v, f) {
      return v ? '<button type="button" class="cnt" data-f="' + esc(JSON.stringify(f)) + '">' + v + "</button>" : "0";
    };
    var tiles = [[0, "TOTAL UI CASES", "sum"], [4, "TOTAL GRAVE UI", "grave"], [3, "GRAVE " + L.gt, "gt"],
                 [8, "TOTAL NON GRAVE UI", "sum"], [7, "NON GRAVE " + L.gt, "gt"]];
    h.push('<div class="tiles g5">');
    tiles.forEach(function (t) {
      h.push('<button type="button" class="tile ' + t[2] + '" data-f="' + esc(JSON.stringify(cols[t[0]].f)) + '"><div class="k">' +
        esc(t[1]) + '</div><div class="v">' + G.grand[t[0]] + "</div></button>");
    });
    h.push("</div>");
    h.push('<div class="sheet"><h2>' + esc(G.title) + '</h2><table class="abs gabs"><thead>' +
      '<tr><th rowspan="2">S.NO</th><th rowspan="2">POLICE STATION</th><th rowspan="2" class="sumh">TOTAL UI<br>CASES</th>' +
      '<th colspan="4" class="gh">' + G.limit + ' DAYS - GRAVE PENDING UI CASES</th>' +
      '<th colspan="4" class="nh">' + G.limit + " DAYS - NON GRAVE PENDING UI CASES</th></tr><tr>");
    [L.lt, L.bet, L.gt, "TOTAL GRAVE UI CASES", L.lt, L.bet, L.gt, "TOTAL NON GRAVE UI CASES"].forEach(function (c, i) {
      var j = i + 1;
      h.push('<th class="' + (cols[j].red ? "gth" : cols[j].sum ? "sumh" : j <= 4 ? "gh2" : "nh2") + '">' + NCL.wrapLabel(c).map(esc).join("<br>") + "</th>");
    });
    h.push("</tr></thead><tbody>");
    var breakAfter = cfg.abstractPageBreakAfter || "KPM";
    G.groups.forEach(function (g) {
      h.push('<tr class="section"><td colspan="11">' + esc(g.title) + "</td></tr>");
      g.rows.forEach(function (x) {
        h.push('<tr><td class="num">' + x.sno + "</td><td>" + esc(x.ps) + "</td>");
        x.counts.forEach(function (v, j) { h.push('<td class="' + cls(j) + '">' + cnt(v, Object.assign({ ps: x.ps }, cols[j].f)) + "</td>"); });
        h.push("</tr>");
      });
      h.push('<tr class="total' + (g.code === breakAfter ? " pagebreak" : "") + '"><td colspan="2" class="c">' + esc(g.totalLabel) + "</td>");
      g.counts.forEach(function (v, j) { h.push('<td class="' + cls(j) + '">' + cnt(v, Object.assign({ sd: g.code }, cols[j].f)) + "</td>"); });
      h.push("</tr>");
    });
    h.push('<tr class="grand"><td colspan="2" class="c">Grand Total</td>');
    G.grand.forEach(function (v, j) { h.push('<td class="' + cls(j) + '">' + cnt(v, cols[j].f) + "</td>"); });
    h.push("</tr></tbody></table></div>");
    $("view").innerHTML = h.join("");
    $("view").querySelectorAll("[data-f]").forEach(function (b) {
      b.addEventListener("click", function () {
        var f = JSON.parse(b.dataset.f); if (!f.band) f.band = "ALL";
        go("g", lv, f);
      });
    });
  }

  function renderGraveFilters(G) {
    var f = state.f, L = G.labels, h = '<button class="btn back" id="backBtn" type="button">← Back</button>';
    h += '<label>Sub-division<select id="fSd"><option value="">All</option>' + cfg.subDivisions.map(function (g) {
      return '<option value="' + g.code + '"' + (f.sd === g.code ? " selected" : "") + ">" + g.code + "</option>";
    }).join("") + "</select></label>";
    var stations = [];
    cfg.subDivisions.forEach(function (g) { if (!f.sd || f.sd === g.code) stations = stations.concat(g.stations); });
    h += '<label>Police station<select id="fPs"><option value="">All</option>' + stations.map(function (s) {
      return "<option" + (f.ps === s ? " selected" : "") + ">" + esc(s) + "</option>";
    }).join("") + "</select></label>";
    h += '<label>Grave / Non Grave<select id="fGr"><option value="">All</option>' + ["GRAVE", "NON GRAVE"].map(function (s) {
      return "<option" + (f.grave === s ? " selected" : "") + ">" + s + "</option>";
    }).join("") + "</select></label>";
    var cur = gBand(G);
    h += '<label>Remarks<select id="fBand">' + [[L.gt, L.gt], ["ALL", "All UI cases"], [L.lt, L.lt], [L.bet, L.bet]].map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (cur === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("") + "</select></label>";
    h += '<label>Search<input id="fQ" type="search" placeholder="FIR no / section" value="' + esc(f.q) + '"></label>';
    h += '<button class="btn" id="resetBtn" type="button">Reset</button>';
    $("filters").innerHTML = h;
    $("backBtn").onclick = goBack;
    $("resetBtn").onclick = resetFilters;
    $("fSd").onchange = function () { f.sd = this.value; f.ps = ""; render(); };
    $("fPs").onchange = function () { f.ps = this.value; render(); };
    $("fGr").onchange = function () { f.grave = this.value; render(); };
    $("fBand").onchange = function () { f.band = this.value; render(); };
    var timer;
    $("fQ").oninput = function () {
      var v = this.value; clearTimeout(timer);
      timer = setTimeout(function () { f.q = v; renderGraveList(G); }, 200);
    };
  }

  /* lists open on UI > 60 / 90 days; "ALL" shows every UI case */
  function gBand(G) { return state.f.band || G.labels.gt; }
  function graveRows(G) {
    var f = state.f, q = f.q.trim().toUpperCase(), ps = NCL.key(f.ps), band = gBand(G);
    return G.cases.filter(function (o) {
      if (f.sd && o.sd !== f.sd) return false;
      if (ps && NCL.key(o.ps) !== ps) return false;
      if (f.grave && o.grave !== f.grave) return false;
      if (band !== "ALL" && o.band !== band) return false;
      if (q && (o.fir + " " + o.acts + " " + o.ps).toUpperCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function gFiltered() { var f = state.f; return !!(f.sd || f.ps || f.grave || (f.band && f.band !== "") || f.q.trim()); }
  function gListTitle(G) {
    var b = gBand(G);
    if (b === G.labels.gt) return G.listTitle;
    return G.limit + " DAYS CASES - " + (b === "ALL" ? "ALL UI CASES" : b.replace(/_/g, " ")) + " - GRAVE / NON GRAVE AS ON " + G.asOnText;
  }

  function renderGraveList(G) {
    var rows = graveRows(G), L = G.labels, h = [];
    h.push('<div class="sheet"><h2>' + esc(gListTitle(G)) + "</h2>");
    h.push('<p class="count-line no-print">' + rows.length + " case(s)" + (gFiltered() ? " match the filters" : "") + "</p>");
    if (!rows.length) { h.push('<div class="empty">No cases.</div></div>'); $("view").innerHTML = h.join(""); return; }
    h.push("<table><thead><tr><th>S.NO</th><th>POLICE STATION</th><th>FIR NO</th><th>FIR DT</th><th>ACTS &amp; SEC</th>" +
      "<th>Days Duration</th><th>Remarks</th><th>GRAVE TYPE</th><th>SUB_DIV</th></tr></thead><tbody>");
    rows.forEach(function (o, i) {
      var band = o.band === L.gt ? "gt" : o.band === L.bet ? "bet" : "lt";
      h.push('<tr><td class="num">' + (i + 1) + "</td><td>" + esc(o.ps) + '</td><td class="nw">' + esc(o.fir) +
        '</td><td class="c nw">' + NCL.dmy(o.fd) + '</td><td class="acts">' + esc(o.acts) + '</td><td class="num">' + o.days +
        '</td><td><span class="tag ' + band + '">' + esc(o.band) + '</span></td><td><span class="gtag' +
        (o.grave === "GRAVE" ? " grave" : "") + '">' + esc(o.type) + '</span></td><td class="c">' + esc(o.sd) + "</td></tr>");
    });
    h.push("</tbody></table></div>");
    $("view").innerHTML = h.join("");
  }

  /* ---------------- Excel export ---------------- */
  var excelLoading;
  function loadExcelJS() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (!excelLoading) excelLoading = new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = "vendor/exceljs.min.js";
      s.onload = function () { ok(window.ExcelJS); };
      s.onerror = function () { excelLoading = null; fail(new Error("Could not load the Excel export library.")); };
      document.head.appendChild(s);
    });
    return excelLoading;
  }
  /* ---------------- Core Team Reports: 10 numbered files in one ZIP ---------------- */
  var scripts = {};
  function loadScript(src) {
    if (!scripts[src]) scripts[src] = new Promise(function (ok, fail) {
      var el = document.createElement("script"); el.src = src;
      el.onload = ok; el.onerror = function () { scripts[src] = null; fail(new Error("Could not load " + src)); };
      document.head.appendChild(el);
    });
    return scripts[src];
  }
  function coreTeamReports() {
    if (!auth) return;
    var btn = $("coreBtn");
    var need = [];
    if (!state.rep[60]) need.push("60 DAYS"); if (!state.rep[90]) need.push("90 DAYS");
    if (!state.grave[60] || !state.grave[90]) need.push("CCDASHBOARD");
    if (need.length) { alert("Core Team Reports need the " + need.join(", ") + " data. Please upload it first."); return; }
    var day = NCL.dmy(state.asOn), brk = cfg.abstractPageBreakAfter || "KPM", label = btn.textContent;
    var step = function (t) { btn.textContent = t; };
    btn.disabled = true; step("Preparing…");
    loadExcelJS()
      .then(function () { return loadScript("vendor/jspdf.umd.min.js"); })
      .then(function () { return Promise.all([loadScript("vendor/jspdf.plugin.autotable.min.js"), loadScript("vendor/jszip.min.js"), loadScript("assets/pdf.js")]); })
      .then(function () {
        var X = window.ExcelJS, jsPDF = window.jspdf.jsPDF, P = window.NCLPDF;
        var xl = function (L, key) {
          return function () { return NCL.buildWorkbook(X, state.rep, [{ limit: L, key: key }], "", brk).xlsx.writeBuffer(); };
        };
        var pdf = function (make) { return function () { return Promise.resolve(make().output("arraybuffer")); }; };
        var R60 = state.rep[60], R90 = state.rep[90];
        var jobs = [
          ["ABSTRACT_60", "pdf", pdf(function () { return P.abstractPdf(jsPDF, R60.abstract, NCL.wrapLabel, brk); })],
          ["UI_LESSTHAN_45_DAYS", "xlsx", xl(60, "lt")],
          ["UI_BET_45_TO_60_DAYS", "xlsx", xl(60, "bet")],
          ["UI_MORETHAN_60_DAYS", "xlsx", xl(60, "gt")],
          ["ABSTRACT_90", "pdf", pdf(function () { return P.abstractPdf(jsPDF, R90.abstract, NCL.wrapLabel, brk); })],
          ["UI_LESSTHAN_75_DAYS", "xlsx", xl(90, "lt")],
          ["UI_BET_75_TO_90_DAYS", "xlsx", xl(90, "bet")],
          ["UI_MORETHAN_90_DAYS", "xlsx", xl(90, "gt")],
          ["UI_GNG_60_DAYS", "pdf", pdf(function () { return P.graveAbstractPdf(jsPDF, state.grave[60], NCL.wrapLabel, brk); })],
          ["UI_GNG_90_DAYS", "pdf", pdf(function () { return P.graveAbstractPdf(jsPDF, state.grave[90], NCL.wrapLabel, brk); })]
        ];
        var zip = new window.JSZip(), i = 0;
        var next = function () {
          if (i >= jobs.length) return Promise.resolve();
          var j = jobs[i], name = (i + 1) + "_" + j[0] + "_" + day + "." + j[1];
          step("Preparing " + (i + 1) + "/" + jobs.length + "…");
          return j[2]().then(function (buf) { zip.file(name, buf); i++; return next(); });
        };
        return next().then(function () { step("Saving…"); return zip.generateAsync({ type: "blob", compression: "DEFLATE" }); });
      })
      .then(function (blob) {
        var name = "NCL_REPORTS_" + day + ".zip", a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
        toast("Saved <b>" + name + "</b> in Downloads. Right-click it → <b>Extract All</b> to get the folder " +
          "<b>NCL_REPORTS_" + day + "</b> with the 10 reports.");
      })
      .catch(function (e) { alert("Core Team Reports could not be prepared: " + (e.message || e)); })
      .then(function () { btn.disabled = false; btn.textContent = label; });
  }

  function safeName(s) { return s.replace(/[<>:"\/\\|?*]/g, "_").trim(); }
  function save(wb, name) {
    return wb.xlsx.writeBuffer().then(function (buf) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    });
  }
  function busy(btn, fn) {
    var t = btn.textContent; btn.disabled = true; btn.textContent = "Preparing…";
    return fn().catch(function (e) { alert(e.message || e); }).then(function () { btn.disabled = false; btn.textContent = t; });
  }
  function exportCurrent() {
    if (state.tab === "g") { exportGraveCurrent(); return; }
    var R = state.rep[state.tab]; if (!R) return;
    busy($("xlBtn"), function () {
      return loadExcelJS().then(function (X) {
        var w = { limit: state.tab, key: state.view };
        if (state.view !== "abstract" && filtered()) w.records = currentRows(R);
        return save(NCL.buildWorkbook(X, state.rep, [w], "", cfg.abstractPageBreakAfter), safeName(R.defs[state.view].sheet) + "_" + NCL.dmy(R.asOn) + ".xlsx");
      });
    });
  }
  function addGraveSheets(wb, L, kind, cases) {
    var G = state.grave[L]; if (!G) return;
    if (kind !== "list") NCLG.addAbstractSheet(wb, "UI_ABSTRACT_" + L + "_DAYS", G, "", cfg.abstractPageBreakAfter || "KPM");
    if (kind !== "abstract") NCLG.addListSheet(wb, "GRAVE_UI_MORETHAN_" + L, cases ? gListTitle(G) : G.listTitle,
      cases || G.cases.filter(function (c) { return c.band === G.labels.gt; }), G, "");
  }
  function exportGraveCurrent() {
    var G = graveOf(state.view); if (!G) return;
    busy($("xlBtn"), function () {
      return loadExcelJS().then(function (X) {
        var wb = new X.Workbook(), isA = state.view.charAt(0) === "a";
        addGraveSheets(wb, G.limit, isA ? "abstract" : "list", isA ? null : graveRows(G));
        return save(wb, (isA ? "UI_ABSTRACT_" + G.limit + "_DAYS_CASES_" : G.limit + "_DAYS_CASES_UI_MORETHAN_" + G.limit + "_") + NCL.dmy(state.asOn) + ".xlsx");
      });
    });
  }
  function exportAll() {
    busy($("xlAllBtn"), function () {
      return loadExcelJS().then(function (X) {
        var which = [];
        var order = ["abstract", "charged", "totalui", "lt", "bet", "gt", "all"];
        [60, 90].forEach(function (L) { order.forEach(function (v) { which.push({ limit: L, key: v }); }); });
        var wb = NCL.buildWorkbook(X, state.rep, which, "", cfg.abstractPageBreakAfter);
        [60, 90].forEach(function (L) { addGraveSheets(wb, L); });
        return save(wb, "NCL_60_AND_90_DAYS_REPORTS_" + NCL.dmy(state.asOn) + ".xlsx");
      });
    });
  }

  /* ---------------- admin: sign-in, upload, delete ---------------- */
  var auth = null;                            // { user, pass } — kept only while this page is open

  function api(body) {
    return fetch(cfg.apiUrl, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ user: auth.user, pass: auth.pass }, body))
    }).then(function (r) { return r.json(); }, function () {
      throw new Error("Could not reach the server. Check the internet connection.");
    }).then(function (j) {
      if (!j || !j.ok) { var e = new Error((j && j.error) || "The request failed."); e.auth = !!(j && j.auth); throw e; }
      return j;
    });
  }

  function openAdmin() { drawAdmin(); $("adminDlg").showModal(); }
  /* closing the window without logging in: forget the chosen files and the preview */
  $("adminDlg").addEventListener("close", function () { if (!auth) discardPending(); });
  function discardPending() {
    var had = false;
    KINDS.forEach(function (L) {
      if (pending[L]) { had = true; pending[L] = null; state.data[L] = published[L] ? savedData[L] : null; }
    });
    if (had) { state.preview = false; recompute(); render(); }
  }

  /* user name + Logout at the top right of the page */
  var userBox = document.createElement("div");
  userBox.className = "userbox"; userBox.hidden = true;
  userBox.innerHTML = '<button class="btn core small" id="coreBtn" type="button">Core Team Reports</button>' +
    '<span class="uname" id="uName"></span><button class="btn ghost small" id="uOut" type="button">Logout</button>';
  document.querySelector(".top-actions").appendChild(userBox);
  $("uOut").onclick = function () { logout(); };
  $("coreBtn").onclick = function () { coreTeamReports(); };
  function updateUserBox() {
    userBox.hidden = !auth;
    $("uName").textContent = auth ? auth.user : "";
    $("adminBtn").textContent = auth ? "Upload / Delete" : "Admin";
  }
  function logout() {
    auth = null; updateUserBox();
    discardPending();
    if ($("adminDlg").open) drawAdmin('<div class="msg ok">You have logged out.</div>');
  }
  function note(kind, text) { $("aMsg").innerHTML = text ? '<div class="msg ' + kind + '">' + text + "</div>" : ""; }

  function drawAdmin(msg) {
    var body = $("adminBody");
    var head = document.querySelector("#adminDlg h2"); if (head) head.textContent = auth ? "Upload / Delete" : "Login";
    if (!cfg.apiUrl) {
      body.innerHTML = '<div class="msg err">Admin is not set up yet. Deploy the Google Apps Script and paste its web app URL into ' +
        "<b>apiUrl</b> in assets/config.js (see README).</div>";
      return;
    }
    if (!auth) {
      body.innerHTML =
        '<label for="aUser">User name</label><input type="text" id="aUser" autocomplete="username" value="' + esc(draft.user) + '">' +
        '<label for="aPass">Password</label><input type="password" id="aPass" autocomplete="current-password">' +
        '<div id="aFiles">' +
        '<p class="help"><b>Users must upload all three Excel files to log in</b> — 60 DAYS, 90 DAYS and CCDASHBOARD. ' +
        "Login is not accepted without them.</p>" +
        KINDS.map(function (L) {
          return '<div class="file"><b>' + kindLabel(L) + ' Excel file</b><input type="file" id="aF' + L + '" accept=".xlsx,.xls,.xlsm,.csv">' +
            '<div class="sum" id="aS' + L + '">' + loginSummary(L) + "</div></div>";
        }).join("") + "</div>" +
        '<div id="aMsg">' + (msg || "") + '</div><div class="actions"><button class="btn primary" id="aIn" type="button">Login</button></div>';
      var sync = function () {
        draft.user = $("aUser").value;
        var adm = isAdminName(draft.user);
        $("aFiles").hidden = adm;
        $("aIn").textContent = adm ? "Login" : "Upload & Login";
      };
      $("aUser").oninput = sync; sync();
      KINDS.forEach(function (L) { $("aF" + L).onchange = function () { pick(L, this.files[0]); }; });
      $("aIn").onclick = signIn;
      $("aPass").onkeydown = function (e) { if (e.key === "Enter") signIn(); };
      return;
    }
    var any = published[60] || published[90] || published.cc;
    if (state.oldServer && !msg) msg = '<div class="msg err">' + OLD_SERVER_MSG + "</div>";
    body.innerHTML =
      '<p class="help" style="margin-top:0">Logged in as <b>' + esc(auth.user) + "</b>. " +
      '<button class="btn" id="aOut" type="button" style="padding:2px 8px;margin-left:6px">Logout</button></p>' +
      "<h3>Upload Excel files</h3>" +
      KINDS.map(function (L) {
        return '<div class="file"><b>' + kindLabel(L) + ' Excel file</b><input type="file" id="aF' + L + '" accept=".xlsx,.xls,.xlsm,.csv">' +
          '<div class="sum" id="aS' + L + '">' + summary(L) + "</div></div>";
      }).join("") +
      '<p class="help">Choose any of the files. 60 / 90 DAYS: columns A:H. CCDASHBOARD: needs POLICE STATION, FIR NO and GRAVE TYPE ' +
      "(used for the UI - Grave / Non Grave reports). <b>60 DAYS and 90 DAYS must be chosen together.</b> " +
      "CCDASHBOARD is kept until a new one is uploaded — choose it only to replace it. " +
      "The reports behind this window show a preview; nothing is saved until you press Upload.</p>" +
      '<div class="actions"><button class="btn primary" id="aPub" type="button"' +
      ">Upload</button></div>" +
      "<h3>Delete existing records</h3>" +
      '<div class="actions del">' +
      KINDS.map(function (L) {
        return '<button class="btn danger" type="button" data-del="' + L + '"' + (published[L] ? "" : " disabled") + ">Delete " + kindLabel(L) +
          (published[L] ? " (" + published[L].n + ")" : "") + "</button>";
      }).join("") +
      '<button class="btn danger" type="button" data-del="60,90,cc"' + (any ? "" : " disabled") + ">Delete all</button></div>" +
      '<div id="aMsg">' + (msg || "") + "</div>";
    $("aOut").onclick = function () { logout(); };
    KINDS.forEach(function (L) { $("aF" + L).onchange = function () { pick(L, this.files[0]); }; });
    $("aPub").onclick = publish;
    body.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = function () { removeRecords(b.dataset.del.split(",")); };
    });
  }

  var draft = { user: "" };                    // keeps the typed user name while files are read
  function isAdminName(u) { return String(u || "").trim().toLowerCase() === "admin"; }
  function loginSummary(L) {
    var p = pending[L];
    return p ? summary(L) : "Not chosen yet.";
  }
  function refreshSummaries() {
    KINDS.forEach(function (L) { if ($("aS" + L)) $("aS" + L).innerHTML = auth ? summary(L) : loginSummary(L); });
  }
  function toast(text) {
    var t = $("toast") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "toast", className: "toast" }));
    t.innerHTML = text; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 5000);
  }

  function summary(L) {
    var p = pending[L];
    var unit = L === "cc" ? " rows" : " cases";
    if (!p) {
      if (!published[L]) return L === "cc" ? "No CCDASHBOARD stored yet — required for the first upload." : "No records at present.";
      var m = state.data[L] && state.data[L].meta, t = m && m.uploadedAt ? new Date(m.uploadedAt) : null;
      return (L === "cc" ? "Stored: " : "Existing records: ") + esc(published[L].file || "") + " (" + published[L].n + unit + ")" +
        (t && !isNaN(t) ? ", uploaded " + t.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "") +
        (L === "cc" ? ". No need to upload again unless it has changed." : "");
    }
    if (L === "cc") return "Ready: " + esc(p.meta.file) + " — " + p.rows.length + " rows (" + Object.keys(p.meta.counts).map(function (k) {
      return esc(k) + " " + p.meta.counts[k];
    }).join(", ") + ").";
    var t = "Ready: " + esc(p.meta.file) + " — " + p.meta.read + " rows read, " + p.rows.length + " cases kept";
    if (p.meta.removed) t += ", " + p.meta.removed + " removed (excluded stations)";
    if (p.meta.badFirDate) t += ", " + p.meta.badFirDate + " with unreadable FIR date";
    return t + ".";
  }

  function signIn() {
    var u = $("aUser").value.trim(), p = $("aPass").value;
    if (!u || !p) { note("err", "Enter the user name and password."); return; }
    var btn = $("aIn");
    var fail = function (e) {
      auth = null; updateUserBox(); note("err", "Login not accepted. " + esc(e.message));
      if ($("aIn")) $("aIn").disabled = false;
    };

    if (isAdminName(u)) {                       // admin: name + password only
      auth = { user: u, pass: p };
      note("wait", "Checking…"); btn.disabled = true;
      api({ action: "login" }).then(function () {
        updateUserBox(); drawAdmin('<div class="msg ok">Login succeeded.</div>');
        toast("Login succeeded — welcome, <b>" + esc(u) + "</b>.");
      }, fail);
      return;
    }

    /* users: all three files are uploaded as part of the login */
    var missing = KINDS.filter(function (L) { return !pending[L]; });
    if (missing.length) {
      note("err", "Login not accepted. Please choose all three Excel files. Missing: <b>" + missing.map(kindLabel).join(", ") + "</b>.");
      return;
    }
    auth = { user: u, pass: p };
    note("wait", "Checking and uploading the three files…"); btn.disabled = true;
    var files = {}; KINDS.forEach(function (L) { files[L] = pending[L]; });
    api({ action: "save", login: true, files: files }).then(function (j) {
      var saved = (j.saved || []).map(String);
      var lost = KINDS.filter(function (L) { return saved.indexOf(L) < 0; });
      if (lost.length) {
        state.oldServer = true; render();
        throw new Error(lost.map(kindLabel).join(", ") + " was NOT saved. " + OLD_SERVER_MSG);
      }
      KINDS.forEach(function (L) { published[L] = { file: pending[L].meta.file, n: pending[L].rows.length }; savedData[L] = pending[L]; pending[L] = null; });
      state.preview = false; draft.user = "";
      updateUserBox(); render();
      $("adminDlg").close();
      toast("Login succeeded — <b>" + esc(u) + "</b>. The three files were uploaded and the reports are updated.");
    }).catch(fail);
  }

  function failed(e, what) {
    if (e.auth) { auth = null; updateUserBox(); drawAdmin('<div class="msg err">' + esc(e.message) + "</div>"); return; }
    note("err", what + " " + esc(e.message));
  }

  function pick(L, file) {
    if (!file) return;
    note("wait", "Reading " + esc(file.name) + "…");
    file.arrayBuffer().then(function (buf) {
      var wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      var aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
      if (L === "cc") {
        var d = NCLG.importDashboard(aoa);
        if (!d.rows.length) throw new Error("No rows were found in this CCDASHBOARD file.");
        pending.cc = { meta: { file: file.name, uploadedAt: new Date().toISOString(), read: d.read, counts: d.counts }, rows: d.rows };
        state.data.cc = pending.cc; state.preview = true;
        recompute(); go("g", state.tab === "g" ? state.view : "a60"); refreshSummaries(); note("", "");
        return;
      }
      var imp = NCL.importRows(aoa, cfg);
      if (!imp.rows.length) throw new Error("No case rows were found in this file.");
      pending[L] = { meta: { file: file.name, uploadedAt: new Date().toISOString(), read: imp.read,
                             removed: imp.removed, badFirDate: imp.badFirDate }, rows: imp.rows };
      state.data[L] = pending[L]; state.preview = true; state.tab = String(L);
      if (VIEWS.indexOf(state.view) < 0) state.view = "abstract";
      recompute(); render(); refreshSummaries(); note("", "");
      var u = Object.keys(state.rep[L].abstract.unmatched);
      if (u.length) note("err", "Stations not in the sub-division list (left out of the abstract): " + esc(u.join(", ")));
    }).catch(function (e) { $("aF" + L).value = ""; note("err", esc(e.message || String(e))); });
  }

  function publish() {
    var items = KINDS.filter(function (L) { return pending[L]; }), files = {};
    if (!auth) return;
    /* 60 DAYS and 90 DAYS go together every time; CCDASHBOARD stays stored until it is replaced */
    var missing = ["60", "90"].filter(function (L) { return !pending[L]; });
    if (!pending.cc && !published.cc) missing.push("cc");
    if (missing.length) {
      note("err", "Upload not done. Please choose the " + missing.map(kindLabel).join(" and ") + " file" +
        (missing.length > 1 ? "s" : "") + ".");
      return;
    }
    items.forEach(function (L) { files[L] = pending[L]; });
    $("aPub").disabled = true; note("wait", "Uploading…");
    api({ action: "save", files: files }).then(function (j) {
      var saved = (j.saved || []).map(String);
      var lost = items.filter(function (L) { return saved.indexOf(String(L)) < 0; });
      items.forEach(function (L) {
        if (saved.indexOf(String(L)) < 0) return;
        published[L] = { file: pending[L].meta.file, n: pending[L].rows.length }; savedData[L] = pending[L]; pending[L] = null;
      });
      if (lost.length) {
        state.oldServer = true; render();
        drawAdmin('<div class="msg err">' + lost.map(kindLabel).join(", ") + " was NOT saved. " + OLD_SERVER_MSG + "</div>");
        return;
      }
      state.preview = false; render();
      drawAdmin('<div class="msg ok">Uploaded. The new reports are now visible to everyone.</div>');
    }, function (e) { failed(e, "Not uploaded."); if ($("aPub")) $("aPub").disabled = false; });
  }

  function removeRecords(which) {
    which = which.filter(function (L) { return published[L]; });
    if (!auth || !which.length) return;
    var label = which.map(kindLabel).join(" and ");
    if (!window.confirm("Delete the existing " + label + " records?\nThe reports will be empty until a new file is uploaded.")) return;
    note("wait", "Deleting…");
    api({ action: "delete", which: which }).then(function () {
      which.forEach(function (L) { published[L] = null; savedData[L] = null; if (!pending[L]) state.data[L] = null; });
      recompute(); render();
      drawAdmin('<div class="msg ok">' + label + " records deleted.</div>");
    }, function (e) { failed(e, "Not deleted."); });
  }
})();
