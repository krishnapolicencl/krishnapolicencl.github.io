/* Report logic — a port of the VBA macros in
   GENERATE_REPORT_60_AND_90_DAYS_CASES.xlsm. No page code in this file. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NCL = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DAY = 864e5;
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isIso(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function isoFromUTC(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }
  function dayNum(iso) {
    return Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
  }
  function dmy(iso) { return isIso(iso) ? iso.slice(8) + "-" + iso.slice(5, 7) + "-" + iso.slice(0, 4) : (iso || ""); }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function addDays(iso, n) { return isoFromUTC(dayNum(iso) * DAY + n * DAY); }
  function norm(s) { return String(s == null ? "" : s).replace(/ /g, " ").replace(/\s+/g, " ").trim(); }
  function key(s) { return norm(s).toUpperCase(); }

  /* Day-first date text (dd/mm/yyyy, dd-mm-yyyy, dd.mm.yy) -> yyyy-mm-dd, or "" */
  function parseDayFirst(text) {
    var t = norm(text).replace(/,/g, "");
    if (!t) return "";
    t = t.replace(/[ T]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?( ?[AP]M)?$/i, "");   // drop a time part
    var p = t.replace(/[\/.\\ ]/g, "-").split("-");
    if (p.length !== 3 || !p.every(function (x) { return /^\d+$/.test(x); })) return "";
    var d = +p[0], m = +p[1], y = +p[2];
    if (p[0].length === 4) { y = +p[0]; d = +p[2]; }                         // yyyy-mm-dd
    else if (y < 100) y += (y < 50 ? 2000 : 1900);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900) return "";
    return isoFromUTC(Date.UTC(y, m - 1, d));
  }
  function serialToIso(n) { return isoFromUTC(Date.UTC(1899, 11, 30) + Math.floor(n) * DAY); }

  /* A cell that should hold a date -> yyyy-mm-dd, "" when blank, or the raw text when not a date */
  function cellDate(v) {
    if (v == null || v === "") return "";
    if (v instanceof Date) return isoFromUTC(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
    if (typeof v === "number") return v > 0 ? serialToIso(v) : "";
    var s = norm(v);
    return parseDayFirst(s) || s;
  }
  /* FIR numbers such as 1/2026 that Excel turned into a date -> back to month/year text */
  function cellFir(v) {
    if (v == null) return "";
    if (v instanceof Date) return (v.getMonth() + 1) + "/" + v.getFullYear();
    if (typeof v === "number" && v > 20000) {
      var iso = serialToIso(v);
      return (+iso.slice(5, 7)) + "/" + iso.slice(0, 4);
    }
    return norm(v);
  }

  var HEADERS = {
    ps: ["POLICE STATION", "PS", "POLICESTATION", "POLICE"],
    fir: ["FIR NO", "CRIME NO", "CRIME NUMBER", "FIR NUMBER", "CRIMENO"],
    fd: ["FIR DT", "FIR DATE", "DATE OF REGISTRATION", "REGISTRATION DATE"],
    acts: ["ACTS & SEC", "ACTS AND SEC", "ACT & SEC", "ACTS & SECTIONS", "SECTION OF LAW"],
    stage: ["STAGE OF THE CASE", "STAGE OF CASE", "STAGE"],
    cd: ["CHARGESHEET DATE", "CHARGE SHEET DATE", "DATE OF DISPOSAL", "DISPOSAL DATE"]
  };
  var FALLBACK = { ps: 2, fir: 3, fd: 4, acts: 5, stage: 6, cd: 7 };   // columns C..H

  /* Sheet rows (array of arrays, header first) -> compact case rows
     [station, firNo, firDate, actsSec, stage, chargesheetDate]            */
  function importRows(aoa, cfg) {
    if (!aoa || !aoa.length) throw new Error("The sheet is empty.");
    var head = aoa[0].map(key), col = {}, missing = [];
    Object.keys(HEADERS).forEach(function (k) {
      var i = -1;
      HEADERS[k].some(function (h) { i = head.indexOf(h); return i >= 0; });
      if (i < 0) { i = FALLBACK[k]; missing.push(HEADERS[k][0]); }
      col[k] = i;
    });
    if (missing.length > 3) {
      throw new Error("This does not look like a 60/90 DAYS file. Expected headers: S.NO, DISTRICT, " +
        "POLICE STATION, FIR NO, FIR DT, ACTS & SEC, Stage Of The Case, CHARGESHEET DATE.");
    }
    var ex = {}; (cfg.excludeStations || []).forEach(function (s) { ex[key(s)] = 1; });
    var rows = [], removed = 0, badFirDate = 0;
    for (var r = 1; r < aoa.length; r++) {
      var a = aoa[r] || [];
      var ps = norm(a[col.ps]), fir = cellFir(a[col.fir]);
      if (!ps && !fir) continue;
      if (ex[key(ps)]) { removed++; continue; }
      var fd = cellDate(a[col.fd]);
      if (!isIso(fd)) { fd = ""; badFirDate++; }
      rows.push([ps, fir, fd, norm(a[col.acts]), norm(a[col.stage]), cellDate(a[col.cd])]);
    }
    return { rows: rows, read: aoa.length - 1, removed: removed, badFirDate: badFirDate, headerGuess: missing };
  }

  /* "FR/CS_WITHIN_60_DAYS" -> ["FR/CS_WITHIN_", "60_DAYS"]; short labels stay on one line */
  function wrapLabel(text) {
    text = String(text);
    if (text.length <= 12 || text.indexOf("_") < 0) return [text];
    var best = -1, bestDiff = 1e9;
    for (var i = 0; i < text.length; i++) {
      if (text[i] !== "_") continue;
      var d = Math.abs((i + 1) - (text.length - i - 1));
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    return best < 0 ? [text] : [text.slice(0, best + 1), text.slice(best + 1)];
  }

  function labels(limit) {
    var warn = limit - 15;
    return {
      limit: limit, warn: warn,
      within: "FR/CS_WITHIN_" + limit + "_DAYS",
      after: "FR/CS_AFTER_" + limit + "_DAYS",
      lad: "LAD_AT_UI_STAGE",
      lt: "UI<" + warn + "_DAYS",
      bet: "UI_BET_" + warn + "-" + limit + "_DAYS",
      gt: "UI>" + limit + "_DAYS",
      totalCharged: "TOTAL_CHARGED",
      totalUi: "TOTAL_UI_CASES"
    };
  }
  function categoryList(L) { return [L.within, L.after, L.lad, L.lt, L.bet, L.gt]; }
  /* Abstract / Remarks criteria: the six categories plus the two totals */
  function criteriaList(L) { return [L.totalCharged, L.within, L.after, L.lad, L.totalUi, L.lt, L.bet, L.gt]; }
  function criteriaGroups(L) {
    var g = {};
    g[L.totalCharged] = [L.within, L.after, L.lad];
    g[L.totalUi] = [L.lt, L.bet, L.gt];
    return g;
  }
  /* [within, after, lad, lt, bet, gt] -> [TOTAL_CHARGED, within, after, lad, TOTAL_UI, lt, bet, gt] */
  function expand(c) { return [c[0] + c[1] + c[2], c[0], c[1], c[2], c[3] + c[4] + c[5], c[3], c[4], c[5]]; }

  function sdLookup(cfg) {
    var m = {};
    cfg.subDivisions.forEach(function (g) { g.stations.forEach(function (s) { m[key(s)] = g.code; }); });
    return m;
  }

  /* Process_NCLxx_InPlace: Case Stage, Days Duration, Remarks, SUB_DIV, sort, serial numbers */
  function compute(rows, limit, asOn, cfg) {
    var L = labels(limit), look = sdLookup(cfg), today = dayNum(asOn), out = [];
    rows.forEach(function (r, i) {
      var o = { ps: r[0], fir: r[1], fd: r[2], acts: r[3], stage: r[4], cd: r[5],
                caseStage: "", days: null, remark: "", sd: look[key(r[0])] || "", _i: i };
      if (key(o.stage) === "COURT DISPOSAL" && o.cd === "") {
        o.caseStage = "DISPOSED"; o.remark = L.lad;
      } else if (o.cd === "") {
        o.caseStage = "UI";
        if (o.fd) {
          o.days = today - dayNum(o.fd);
          o.remark = o.days < L.warn ? L.lt : (o.days <= limit ? L.bet : L.gt);
        }
      } else {
        o.caseStage = "DISPOSED";
        if (o.fd && isIso(o.cd)) {
          o.days = dayNum(o.cd) - dayNum(o.fd);
          o.remark = o.days <= limit ? L.within : L.after;
        }
      }
      out.push(o);
    });
    function txt(a, b) {                      // Excel order: A→Z ignoring case, blanks last
      if (a === b) return 0;
      if (a === "") return 1;
      if (b === "") return -1;
      var x = a.toUpperCase(), y = b.toUpperCase();
      return x < y ? -1 : x > y ? 1 : 0;
    }
    out.sort(function (a, b) {
      var c = txt(a.sd, b.sd) || txt(a.ps, b.ps) || txt(a.caseStage, b.caseStage);
      if (c) return c;
      if (a.days !== b.days) {
        if (a.days === null) return 1;
        if (b.days === null) return -1;
        return b.days - a.days;
      }
      return a._i - b._i;
    });
    out.forEach(function (o, i) { o.sno = i + 1; delete o._i; });
    return out;
  }

  /* Fill_AbstractXX_From_NCLxx */
  function abstract(records, limit, cfg) {
    var L = labels(limit), cats = categoryList(L), idx = {}, zero = function () { return [0, 0, 0, 0, 0, 0]; };
    cats.forEach(function (c, i) { idx[c] = i; });
    var byPs = {}, unmatched = {}, unclassified = 0;
    records.forEach(function (o) {
      if (!o.remark) { unclassified++; return; }
      if (!o.sd) { unmatched[o.ps] = (unmatched[o.ps] || 0) + 1; return; }
      var k = key(o.ps);
      (byPs[k] = byPs[k] || zero())[idx[o.remark]]++;
    });
    var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
    var grand = zero();
    var groups = cfg.subDivisions.map(function (g) {
      var tot = zero();
      var rows = g.stations.map(function (s, i) {
        var c = byPs[key(s)] || zero();
        c.forEach(function (v, j) { tot[j] += v; grand[j] += v; });
        return { sno: i + 1, ps: s, counts: expand(c), total: sum(c) };
      });
      return { code: g.code, title: g.title, totalLabel: g.totalLabel, rows: rows, counts: expand(tot), total: sum(tot) };
    });
    return {
      title: "NCL REPORTS STATUS - SD WISE & PS WISE ABSTRACT OF - " + limit + " DAYS CASES - FROM " +
             cfg.fromDate + " TO " + dmy(addDays(records.asOn || todayIso(), -1)),
      columns: criteriaList(L), groups: groups, grand: expand(grand), grandTotal: sum(grand),
      unmatched: unmatched, unclassified: unclassified
    };
  }

  /* The eight reports of the workbook, keyed by limit */
  function reportDefs(limit) {
    var L = labels(limit);
    return {
      abstract: { sheet: "ABSTRACT_" + limit, label: "Abstract" },
      lt: { sheet: "UI<" + L.warn + "_DAYS", label: "UI < " + L.warn + " days", remark: L.lt,
            title: "NEW CRIMINAL LAWS - " + limit + " DAYS INVESTIGATION CASES - UI CASES <" + L.warn + " DAYS AS ON " },
      bet: { sheet: "UI_BET_" + L.warn + "_TO_" + limit + "_DAYS", label: "UI " + L.warn + "–" + limit + " days", remark: L.bet,
             title: "NEW CRIMINAL LAWS - " + limit + " DAYS INVESTIGATION CASES - UI CASES BETWEEN " + L.warn + "-" + limit + " DAYS AS ON " },
      gt: { sheet: "UI_MORETHAN_" + limit + "_DAYS", label: "UI > " + limit + " days", remark: L.gt,
            title: "NEW CRIMINAL LAWS - " + limit + " DAYS INVESTIGATION CASES - UI CASES >" + limit + " DAYS AS ON " },
      all: { sheet: "NCL_" + limit, label: "All cases" },
      charged: { sheet: "TOTAL_CHARGED_" + limit, label: "Total charged",
                 title: "NEW CRIMINAL LAWS - " + limit + " DAYS CASES - TOTAL CHARGED (FR/CS WITHIN + AFTER " + limit + " DAYS + LAD AT UI STAGE) AS ON " },
      totalui: { sheet: "TOTAL_UI_" + limit, label: "Total UI",
                 title: "NEW CRIMINAL LAWS - " + limit + " DAYS CASES - TOTAL UI CASES (UI<" + L.warn + " + UI " + L.warn + "-" + limit + " + UI>" + limit + " DAYS) AS ON " }
    };
  }

  function build(rows, limit, asOn, cfg) {
    var recs = compute(rows, limit, asOn, cfg);
    recs.asOn = asOn;
    var defs = reportDefs(limit), lists = {};
    ["lt", "bet", "gt"].forEach(function (k) {
      lists[k] = recs.filter(function (o) { return o.remark === defs[k].remark; });
    });
    var L = labels(limit), grp = criteriaGroups(L);
    lists.charged = recs.filter(function (o) { return grp[L.totalCharged].indexOf(o.remark) >= 0; });
    lists.totalui = recs.filter(function (o) { return grp[L.totalUi].indexOf(o.remark) >= 0; });
    return { limit: limit, asOn: asOn, labels: labels(limit), defs: defs,
             records: recs, abstract: abstract(recs, limit, cfg), lists: lists };
  }

  /* ---------- Excel export (ExcelJS is passed in) ----------
     Every sheet: Legal paper, landscape, fitted to the page width. */
  var LINE = { style: "thin", color: { argb: "FF7F7F7F" } };
  var BORDER = { top: LINE, left: LINE, bottom: LINE, right: LINE };
  var C = { title: "FF1F3864", head: "FF2F5597", section: "FFBDD7EE", total: "FFE2EFDA", grand: "FFFFD966",
            sum: "FFF2F2F2", zebra: "FFF5F8FC", red: "FFC00000", green: "FF00803C", greenHead: "FF00803C", white: "FFFFFFFF", ink: "FF000000" };
  function fill(argb) { return { type: "pattern", pattern: "solid", fgColor: { argb: argb } }; }
  function xlDate(iso) { return isIso(iso) ? new Date(iso + "T00:00:00Z") : (iso || null); }

  /* opt: bold, size, fill, color, align[] (per column), red[] / shade[] (column numbers) */
  function styleRow(row, n, opt) {
    for (var c = 1; c <= n; c++) {
      var cell = row.getCell(c), red = opt.red && opt.red.indexOf(c) >= 0, shade = opt.shade && opt.shade.indexOf(c) >= 0;
      var green = opt.green && opt.green.indexOf(c) >= 0;
      cell.border = BORDER;
      cell.alignment = { vertical: "middle", wrapText: true, horizontal: (opt.align && opt.align[c - 1]) || "center" };
      cell.font = { name: "Calibri", size: opt.size || 11, bold: !!(opt.bold || red || shade || green),
                    color: { argb: red ? C.red : green ? C.green : (opt.color || C.ink) } };
      if (opt.fill || shade) cell.fill = fill(opt.fill || C.sum);
    }
  }
  function sheet(wb, name, widths, fitHeight, credit) {
    var setup = fitHeight === "fixed"
      ? { fitToPage: false, scale: 100 }
      : { fitToPage: true, fitToWidth: 1, fitToHeight: fitHeight };
    var ws = wb.addWorksheet(name, {
      pageSetup: Object.assign({ paperSize: 5, orientation: "landscape", horizontalCentered: true,
                   margins: { left: 0.4, right: 0.4, top: 0.45, bottom: 0.55, header: 0.2, footer: 0.25 } }, setup),
      headerFooter: { oddFooter: "&L&8" + String(credit || "").replace(/&/g, "&&") + "&R&8Page &P of &N" }
    });
    ws.columns = widths.map(function (w) { return { width: w }; });
    return ws;
  }
  function titleRow(ws, text, n) {
    ws.addRow([text]); ws.mergeCells(1, 1, 1, n);
    styleRow(ws.getRow(1), n, { bold: true, size: 14, fill: C.title, color: C.white }); ws.getRow(1).height = 32;
  }
  function headRow(ws, cells, height, red, green) {
    var r = ws.addRow(cells);
    styleRow(r, cells.length, { bold: true, fill: C.head, color: C.white });
    (red || []).forEach(function (c) { r.getCell(c).fill = fill(C.red); });
    (green || []).forEach(function (c) { r.getCell(c).fill = fill(C.greenHead); });
    r.height = height;
  }

  function addListSheet(wb, name, title, recs, credit) {
    var ws = sheet(wb, name, [7, 30, 13, 13, 88, 12, 12], 0, credit);
    titleRow(ws, title, 7);
    headRow(ws, ["S.NO", "POLICE STATION", "FIR NO", "FIR DT", "ACTS & SEC", "Days Duration", "SUB_DIV"], 34);
    var al = ["center", "left", "center", "center", "left", "center", "center"];
    recs.forEach(function (o, i) {
      var row = ws.addRow([i + 1, o.ps, o.fir, xlDate(o.fd), o.acts, o.days, o.sd]);
      row.getCell(4).numFmt = "dd-mm-yyyy"; row.getCell(3).numFmt = "@";
      styleRow(row, 7, { align: al, fill: i % 2 ? C.zebra : null });
      row.getCell(6).font = { name: "Calibri", size: 11, bold: true };
    });
    ws.pageSetup.printTitlesRow = "1:2";
    ws.views = [{ state: "frozen", ySplit: 2 }];
    return ws;
  }

  function addAllSheet(wb, name, title, recs, L, credit) {
    var ws = sheet(wb, name, [6, 25, 10, 12, 46, 14, 13, 11, 9, 25, 9], 0, credit);
    titleRow(ws, title, 11);
    headRow(ws, ["S.NO", "POLICE STATION", "FIR NO", "FIR DT", "ACTS & SEC", "Stage Of The Case",
                 "CHARGESHEET DATE", "Case Stage", "Days Duration", "Remarks", "SUB_DIV"], 34);
    var al = ["center", "left", "center", "center", "left", "left", "center", "center", "center", "left", "center"];
    recs.forEach(function (o, i) {
      var row = ws.addRow([i + 1, o.ps, o.fir, xlDate(o.fd), o.acts, o.stage, xlDate(o.cd), o.caseStage, o.days, o.remark, o.sd]);
      row.getCell(4).numFmt = "dd-mm-yyyy"; row.getCell(7).numFmt = "dd-mm-yyyy"; row.getCell(3).numFmt = "@";
      styleRow(row, 11, { align: al, fill: i % 2 ? C.zebra : null, red: o.remark === L.gt ? [9, 10] : null });
    });
    ws.pageSetup.printTitlesRow = "1:2";
    ws.views = [{ state: "frozen", ySplit: 2 }];
    return ws;
  }

  /* Total charged: disposed cases with charge-sheet date, days taken and remark */
  function addChargedSheet(wb, name, title, recs, credit) {
    var n = 10, ws = sheet(wb, name, [6, 26, 11, 12, 54, 16, 13, 10, 25, 9], 0, credit);
    titleRow(ws, title, n);
    headRow(ws, ["S.NO", "POLICE STATION", "FIR NO", "FIR DT", "ACTS & SEC", "Stage Of The Case",
                 "CHARGESHEET DATE", "Days Taken", "Remarks", "SUB_DIV"], 34);
    var al = ["center", "left", "center", "center", "left", "left", "center", "center", "left", "center"];
    recs.forEach(function (o, i) {
      var row = ws.addRow([i + 1, o.ps, o.fir, xlDate(o.fd), o.acts, o.stage, xlDate(o.cd), o.days, o.remark, o.sd]);
      row.getCell(4).numFmt = "dd-mm-yyyy"; row.getCell(7).numFmt = "dd-mm-yyyy"; row.getCell(3).numFmt = "@";
      styleRow(row, n, { align: al, fill: i % 2 ? C.zebra : null });
    });
    ws.pageSetup.printTitlesRow = "1:2";
    ws.views = [{ state: "frozen", ySplit: 2 }];
    return ws;
  }

  /* Total UI: all pending cases with days pending and the UI band; UI>limit in red */
  function addTotalUiSheet(wb, name, title, recs, L, credit) {
    var n = 8, ws = sheet(wb, name, [7, 30, 13, 13, 80, 12, 22, 11], 0, credit);
    titleRow(ws, title, n);
    headRow(ws, ["S.NO", "POLICE STATION", "FIR NO", "FIR DT", "ACTS & SEC", "Days Duration", "Remarks", "SUB_DIV"], 34);
    var al = ["center", "left", "center", "center", "left", "center", "left", "center"];
    recs.forEach(function (o, i) {
      var row = ws.addRow([i + 1, o.ps, o.fir, xlDate(o.fd), o.acts, o.days, o.remark, o.sd]);
      row.getCell(4).numFmt = "dd-mm-yyyy"; row.getCell(3).numFmt = "@";
      styleRow(row, n, { align: al, fill: i % 2 ? C.zebra : null, red: o.remark === L.gt ? [6, 7] : null });
    });
    ws.pageSetup.printTitlesRow = "1:2";
    ws.views = [{ state: "frozen", ySplit: 2 }];
    return ws;
  }

  /* Abstract: two Legal landscape pages, page 1 ends after the "page break" sub-division's total row */
  function addAbstractSheet(wb, name, ab, credit, breakAfter) {
    var n = 11, SUM = [3, 7], RED = [10], GREEN = [9], al = ["center", "left"], ROW = 19;
    var ws = sheet(wb, name, [6, 31, 14, 14, 14, 13, 14, 12, 14, 12, 12], "fixed", credit);
    titleRow(ws, ab.title, n);
    var head = ["S.NO", "POLICE STATION"].concat(ab.columns.map(function (c) { return wrapLabel(c).join("\n"); }), ["Grand\nTotal"]);
    headRow(ws, head, 36, RED, GREEN);
    ab.groups.forEach(function (g) {
      var r = ws.addRow([g.title]); ws.mergeCells(r.number, 1, r.number, n);
      styleRow(r, n, { bold: true, size: 12, fill: C.section }); r.height = ROW;
      g.rows.forEach(function (x) {
        var row = ws.addRow([x.sno, x.ps].concat(x.counts, [x.total]));
        styleRow(row, n, { align: al, red: RED, green: GREEN, shade: SUM, size: 12 }); row.height = ROW;
      });
      r = ws.addRow([g.totalLabel, null].concat(g.counts, [g.total])); ws.mergeCells(r.number, 1, r.number, 2);
      styleRow(r, n, { bold: true, size: 12, fill: C.total, red: RED, green: GREEN }); r.height = ROW;
      if (g.code === breakAfter) r.addPageBreak();
    });
    var gr = ws.addRow([null, "Grand Total"].concat(ab.grand, [ab.grandTotal]));
    styleRow(gr, n, { bold: true, size: 12, fill: C.grand, red: RED, green: GREEN, align: al }); gr.height = ROW + 2;
    ws.pageSetup.printTitlesRow = "1:2";
    ws.views = [{ state: "frozen", ySplit: 2 }];
    return ws;
  }

  function allTitle(R) { return "NEW CRIMINAL LAWS - " + R.limit + " DAYS CASES - ALL CASES AS ON " + dmy(R.asOn); }

  /* which: array of {limit, key}. rep: {60: build(...), 90: build(...)} */
  function buildWorkbook(ExcelJS, rep, which, credit, breakAfter) {
    var wb = new ExcelJS.Workbook();
    which.forEach(function (w) {
      var R = rep[w.limit]; if (!R) return;
      var d = R.defs[w.key];
      if (w.key === "abstract") addAbstractSheet(wb, d.sheet, R.abstract, credit, breakAfter || "KPM");
      else if (w.key === "charged") addChargedSheet(wb, d.sheet, d.title + dmy(R.asOn), w.records || R.lists.charged, credit);
      else if (w.key === "totalui") addTotalUiSheet(wb, d.sheet, d.title + dmy(R.asOn), w.records || R.lists.totalui, R.labels, credit);
      else if (w.key === "all") addAllSheet(wb, d.sheet, allTitle(R), w.records || R.records, R.labels, credit);
      else addListSheet(wb, d.sheet, d.title + dmy(R.asOn), w.records || R.lists[w.key], credit);
    });
    return wb;
  }

  return { importRows: importRows, compute: compute, abstract: abstract, build: build, labels: labels,
           categoryList: categoryList, criteriaList: criteriaList, wrapLabel: wrapLabel, criteriaGroups: criteriaGroups, allTitle: allTitle, reportDefs: reportDefs, buildWorkbook: buildWorkbook,
           parseDayFirst: parseDayFirst, dmy: dmy, todayIso: todayIso, isIso: isIso, key: key };
});
