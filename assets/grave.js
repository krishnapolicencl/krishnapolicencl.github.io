/* UI - Grave / Non Grave abstract — a port of 60_90_grave_ng.xlsm
   (RUN_ALL_60_90 + FILL_ABS_60_90). Uses the 60 / 90 days reports built by core.js
   and the GRAVE TYPE column of the CCDASHBOARD file. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NCLG = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* UI bands used by the grave macro: 60 days -> <50, 50-60, >60 ; 90 days -> <80, 80-90, >90 */
  var DEFAULT_WARN = { 60: 50, 90: 80 };

  function norm(s) { return String(s == null ? "" : s).replace(/ /g, " ").replace(/\s+/g, " ").trim(); }
  /* CleanTxt + MatchKey of the macro: quotes removed, spaces removed, upper case */
  function clean(v) { return norm(String(v == null ? "" : v).replace(/['"‘’]/g, "")); }
  function matchKey(ps, fir) { return clean(ps).replace(/ /g, "").toUpperCase() + "|" + clean(fir).replace(/ /g, "").toUpperCase(); }
  function key(s) { return norm(s).toUpperCase(); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function firText(v) {
    if (v instanceof Date) return (v.getMonth() + 1) + "/" + v.getFullYear();
    return clean(v);
  }

  /* CCDASHBOARD sheet (array of arrays) -> rows [policeStation, firNo, graveType] */
  function importDashboard(aoa) {
    if (!aoa || !aoa.length) throw new Error("The CCDASHBOARD sheet is empty.");
    var hr = -1, col = {};
    for (var r = 0; r < Math.min(aoa.length, 10) && hr < 0; r++) {
      var h = (aoa[r] || []).map(function (x) { return key(x).replace(/_/g, " "); });
      var ps = h.indexOf("POLICE STATION"), fir = h.indexOf("FIR NO"), gt = h.indexOf("GRAVE TYPE");
      if (ps >= 0 && fir >= 0 && gt >= 0) { hr = r; col = { ps: ps, fir: fir, gt: gt }; }
    }
    if (hr < 0) throw new Error("This does not look like a CCDASHBOARD file. It needs the columns POLICE STATION, FIR NO and GRAVE TYPE.");
    var rows = [], counts = {};
    for (var i = hr + 1; i < aoa.length; i++) {
      var a = aoa[i] || [], p = clean(a[col.ps]), f = firText(a[col.fir]);
      if (!p && !f) continue;
      var g = norm(a[col.gt]);
      rows.push([p, f, g]);
      counts[g || "(blank)"] = (counts[g || "(blank)"] || 0) + 1;
    }
    return { rows: rows, read: aoa.length - hr - 1, counts: counts };
  }

  function isGrave(t) { var k = key(t).replace(/[\s_-]/g, ""); return k === "GRAVE" || k === "SPECIALGRAVE"; }

  function labels(limit, warn) {
    return { limit: limit, warn: warn, lt: "UI<" + warn + "_DAYS", bet: "UI_BET_" + warn + "-" + limit + "_DAYS", gt: "UI>" + limit + "_DAYS" };
  }

  function addDays(iso, n) {
    var d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 864e5);
    return pad(d.getUTCDate()) + "-" + pad(d.getUTCMonth() + 1) + "-" + d.getUTCFullYear();
  }

  /* R = report from NCL.build(...) ; dash = importDashboard(...).rows */
  function build(R, dash, cfg) {
    var limit = R.limit, warn = (cfg.graveWarn && cfg.graveWarn[limit]) || DEFAULT_WARN[limit];
    var L = labels(limit, warn), map = {};
    (dash || []).forEach(function (d) { var k = matchKey(d[0], d[1]); if (!(k in map)) map[k] = d[2]; });

    var cases = [], notFound = 0;
    R.records.forEach(function (o) {
      if (o.caseStage !== "UI" || o.days === null) return;
      var k = matchKey(o.ps, o.fir), found = k in map, type = found ? map[k] : "";
      if (!found) notFound++;
      var grave = isGrave(type);
      cases.push({ ps: o.ps, fir: o.fir, fd: o.fd, acts: o.acts, days: o.days, sd: o.sd,
                   band: o.days < warn ? L.lt : (o.days <= limit ? L.bet : L.gt),
                   grave: grave ? "GRAVE" : "NON GRAVE",
                   type: found ? (type || "Non Grave") : "Not in CCDASHBOARD" });
    });

    /* counts: [totalUI, gLt, gBet, gGt, gTotal, nLt, nBet, nGt, nTotal] */
    var zero = function () { return [0, 0, 0, 0, 0, 0, 0, 0, 0]; };
    var byPs = {}, unmatched = {};
    var pos = {}; pos[L.lt] = 0; pos[L.bet] = 1; pos[L.gt] = 2;
    cases.forEach(function (c) {
      if (!c.sd) { unmatched[c.ps] = (unmatched[c.ps] || 0) + 1; return; }
      var a = byPs[key(c.ps)] = byPs[key(c.ps)] || zero(), base = c.grave === "GRAVE" ? 1 : 5;
      a[base + pos[c.band]]++; a[base + 3]++; a[0]++;
    });
    var add = function (t, c) { c.forEach(function (v, j) { t[j] += v; }); };
    var grand = zero();
    var groups = cfg.subDivisions.map(function (g) {
      var tot = zero();
      var rows = g.stations.map(function (s, i) {
        var c = byPs[key(s)] || zero(); add(tot, c);
        return { sno: i + 1, ps: s, counts: c };
      });
      add(grand, tot);
      return { code: g.code, title: g.title, totalLabel: g.totalLabel, rows: rows, counts: tot };
    });
    return {
      limit: limit, labels: L, cases: cases, notFound: notFound, unmatched: unmatched,
      title: limit + " DAYS - NCL UI CASES - SD WISE & PS WISE ABSTRACT FROM " + cfg.fromDate + " TO " + addDays(R.asOn, -1),
      listTitle: limit + " DAYS CASES - UI >" + limit + " DAYS - GRAVE / NON GRAVE AS ON " + addDays(R.asOn, 0),
      asOnText: addDays(R.asOn, 0),
      groups: groups, grand: grand,
      /* column meta: label, filter it opens */
      columns: [
        { label: "TOTAL UI CASES", f: {} },
        { label: L.lt, f: { grave: "GRAVE", band: L.lt } },
        { label: L.bet, f: { grave: "GRAVE", band: L.bet } },
        { label: L.gt, f: { grave: "GRAVE", band: L.gt }, red: true },
        { label: "TOTAL GRAVE UI CASES", f: { grave: "GRAVE" }, sum: true },
        { label: L.lt, f: { grave: "NON GRAVE", band: L.lt } },
        { label: L.bet, f: { grave: "NON GRAVE", band: L.bet } },
        { label: L.gt, f: { grave: "NON GRAVE", band: L.gt }, red: true },
        { label: "TOTAL NON GRAVE UI CASES", f: { grave: "NON GRAVE" }, sum: true }
      ]
    };
  }

  /* ---------------- Excel ---------------- */
  var LINE = { style: "thin", color: { argb: "FF7F7F7F" } };
  var BORDER = { top: LINE, left: LINE, bottom: LINE, right: LINE };
  var C = { title: "FF1F3864", head: "FF2F5597", grave: "FF833C0B", nongrave: "FF375623", section: "FFBDD7EE",
            total: "FFE2EFDA", grand: "FFFFD966", sum: "FFF2F2F2", zebra: "FFF5F8FC", red: "FFC00000", white: "FFFFFFFF", ink: "FF000000" };
  function fill(a) { return { type: "pattern", pattern: "solid", fgColor: { argb: a } }; }
  function cellStyle(cell, o) {
    cell.border = BORDER;
    cell.alignment = { vertical: "middle", horizontal: o.align || "center", wrapText: true };
    cell.font = { name: "Calibri", size: o.size || 12, bold: !!o.bold, color: { argb: o.color || C.ink } };
    if (o.fill) cell.fill = fill(o.fill);
  }
  function sheet(wb, name, widths, fixed, credit) {
    var ws = wb.addWorksheet(name, {
      pageSetup: Object.assign({ paperSize: 5, orientation: "landscape", horizontalCentered: true,
        margins: { left: 0.4, right: 0.4, top: 0.45, bottom: 0.55, header: 0.2, footer: 0.25 } },
        fixed ? { fitToPage: false, scale: 100 } : { fitToPage: true, fitToWidth: 1, fitToHeight: 0 }),
      headerFooter: { oddFooter: "&L&8" + String(credit || "").replace(/&/g, "&&") + "&R&8Page &P of &N" }
    });
    ws.columns = widths.map(function (w) { return { width: w }; });
    return ws;
  }

  function addAbstractSheet(wb, name, G, credit, breakAfter) {
    var n = 11, ROW = 19, ws = sheet(wb, name, [6, 31, 12, 13, 14, 13, 13, 13, 14, 13, 14], true, credit);
    var L = G.labels;
    ws.addRow([G.title]); ws.mergeCells(1, 1, 1, n);
    for (var c = 1; c <= n; c++) cellStyle(ws.getRow(1).getCell(c), { bold: true, size: 14, fill: C.title, color: C.white });
    ws.getRow(1).height = 32;
    var h1 = ws.addRow(["S.NO", "POLICE STATION", "TOTAL UI\nCASES", G.limit + " DAYS - GRAVE PENDING UI CASES", null, null, null,
                        G.limit + " DAYS - NON GRAVE PENDING UI CASES", null, null, null]);
    var h2 = ws.addRow([null, null, null, L.lt, "UI_BET_\n" + L.warn + "-" + G.limit + "_DAYS", L.gt, "TOTAL GRAVE\nUI CASES",
                        L.lt, "UI_BET_\n" + L.warn + "-" + G.limit + "_DAYS", L.gt, "TOTAL NON\nGRAVE UI CASES"]);
    ws.mergeCells(2, 1, 3, 1); ws.mergeCells(2, 2, 3, 2); ws.mergeCells(2, 3, 3, 3); ws.mergeCells(2, 4, 2, 7); ws.mergeCells(2, 8, 2, 11);
    for (c = 1; c <= n; c++) {
      var band = c >= 4 && c <= 7 ? C.grave : c >= 8 ? C.nongrave : C.head;
      cellStyle(h1.getCell(c), { bold: true, fill: band, color: C.white, size: 12 });
      cellStyle(h2.getCell(c), { bold: true, fill: (c === 6 || c === 10) ? C.red : band, color: C.white, size: 11 });
    }
    h1.height = 24; h2.height = 34;
    var body = function (row, o) {
      for (var c = 1; c <= n; c++) {
        var red = c === 6 || c === 10, sum = c === 3 || c === 7 || c === 11;
        cellStyle(row.getCell(c), { align: c === 2 && !o.label ? "left" : "center", bold: o.bold || red || sum,
          color: red ? C.red : C.ink, fill: o.fill || (sum ? C.sum : null), size: o.size });
      }
      row.height = ROW;
    };
    G.groups.forEach(function (g) {
      var r = ws.addRow([g.title]); ws.mergeCells(r.number, 1, r.number, n);
      cellStyle(r.getCell(1), { bold: true, fill: C.section }); r.height = ROW;
      g.rows.forEach(function (x) { body(ws.addRow([x.sno, x.ps].concat(x.counts)), {}); });
      r = ws.addRow([g.totalLabel, null].concat(g.counts)); ws.mergeCells(r.number, 1, r.number, 2);
      body(r, { bold: true, fill: C.total, label: true });
      if (g.code === breakAfter) r.addPageBreak();
    });
    var gr = ws.addRow(["Grand Total", null].concat(G.grand)); ws.mergeCells(gr.number, 1, gr.number, 2);
    body(gr, { bold: true, fill: C.grand, label: true });
    ws.pageSetup.printTitlesRow = "1:3";
    ws.views = [{ state: "frozen", ySplit: 3 }];
    return ws;
  }

  function addListSheet(wb, name, title, cases, G, credit) {
    var n = 10, ws = sheet(wb, name, [6, 26, 11, 12, 60, 10, 22, 16, 13, 9], false, credit);
    ws.addRow([title]); ws.mergeCells(1, 1, 1, n);
    for (var c = 1; c <= n; c++) cellStyle(ws.getRow(1).getCell(c), { bold: true, size: 14, fill: C.title, color: C.white });
    ws.getRow(1).height = 32;
    var h = ws.addRow(["S.NO", "POLICE STATION", "FIR NO", "FIR DT", "ACTS & SEC", "Days Duration", "Remarks",
                       "GRAVE TYPE", "GRAVE /\nNON GRAVE", "SUB_DIV"]);
    for (c = 1; c <= n; c++) cellStyle(h.getCell(c), { bold: true, fill: C.head, color: C.white, size: 11 });
    h.height = 34;
    var al = ["center", "left", "center", "center", "left", "center", "left", "left", "center", "center"];
    cases.forEach(function (o, i) {
      var row = ws.addRow([i + 1, o.ps, o.fir, o.fd ? new Date(o.fd + "T00:00:00Z") : null, o.acts, o.days, o.band, o.type, o.grave, o.sd]);
      row.getCell(4).numFmt = "dd-mm-yyyy"; row.getCell(3).numFmt = "@";
      var red = o.band === G.labels.gt, gr = o.grave === "GRAVE";
      for (var c = 1; c <= n; c++) {
        cellStyle(row.getCell(c), { align: al[c - 1], size: 11, fill: i % 2 ? C.zebra : null,
          bold: (red && (c === 6 || c === 7)) || (gr && (c === 8 || c === 9)),
          color: red && (c === 6 || c === 7) ? C.red : (gr && (c === 8 || c === 9) ? C.grave : C.ink) });
      }
    });
    ws.pageSetup.printTitlesRow = "1:2";
    ws.views = [{ state: "frozen", ySplit: 2 }];
    return ws;
  }

  return { build: build, importDashboard: importDashboard, matchKey: matchKey, isGrave: isGrave,
           addAbstractSheet: addAbstractSheet, addListSheet: addListSheet, DEFAULT_WARN: DEFAULT_WARN };
});
