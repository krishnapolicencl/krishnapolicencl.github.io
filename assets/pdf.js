/* PDF versions of the abstracts (Core Team Reports). Needs jsPDF + jspdf-autotable.
   Legal landscape, two pages: page 1 ends after the "break after" sub-division total. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NCLPDF = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var COL = {
    title: [31, 56, 100], head: [47, 85, 151], section: [189, 215, 238], total: [226, 239, 218],
    grand: [255, 217, 102], sum: [242, 242, 242], red: [192, 0, 0], green: [0, 128, 60],
    grave: [131, 60, 11], nongrave: [55, 86, 35], white: 255, ink: 20, line: [127, 127, 127]
  };
  var M = 28;                                            // page margin (pt)

  function newDoc(jsPDF) {
    return new jsPDF({ orientation: "landscape", unit: "pt", format: "legal", compress: true });
  }

  function pageNumbers(doc) {
    var n = doc.internal.getNumberOfPages(), w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90);
      doc.text("Page " + i + " of " + n, w - M, h - 12, { align: "right" });
    }
  }

  var base = {
    theme: "grid",
    margin: { top: M, left: M, right: M, bottom: M },
    showHead: "everyPage",
    styles: { font: "helvetica", fontSize: 10.5, cellPadding: 3.6, lineColor: COL.line, lineWidth: 0.6,
              textColor: COL.ink, halign: "center", valign: "middle", overflow: "linebreak" },
    headStyles: { fillColor: COL.head, textColor: COL.white, fontStyle: "bold", fontSize: 9.5, halign: "center", valign: "middle" }
  };

  function titleRow(text, span) {
    return [{ content: text, colSpan: span, styles: { fillColor: COL.title, textColor: COL.white, fontSize: 13, fontStyle: "bold", cellPadding: 6 } }];
  }

  /* split groups into page 1 (up to breakAfter) and page 2 */
  function split(groups, breakAfter) {
    var i = groups.map(function (g) { return g.code; }).indexOf(breakAfter);
    return i < 0 ? [groups, []] : [groups.slice(0, i + 1), groups.slice(i + 1)];
  }

  function run(doc, opts, parts, makeBody) {
    parts.forEach(function (part, p) {
      if (!part.rows.length) return;
      if (p > 0) doc.addPage();
      doc.autoTable(Object.assign({}, base, opts, { startY: M, body: makeBody(part) }));
    });
  }

  /* ---------- 60 / 90 days abstract (ABSTRACT_60 / ABSTRACT_90) ---------- */
  function abstractPdf(jsPDF, ab, wrapLabel, breakAfter) {
    var doc = newDoc(jsPDF), n = 11;
    var SUM = [2, 6], BET = 8, GT = 9;                    // 0-based columns
    var head = [titleRow(ab.title, n),
      ["S.NO", "POLICE STATION"].concat(ab.columns.map(function (c) { return wrapLabel(c).join("\n"); }), ["Grand\nTotal"])
        .map(function (t, j) {
          return { content: t, styles: j === GT ? { fillColor: COL.red } : j === BET ? { fillColor: COL.green } : {} };
        })];
    var s = split(ab.groups, breakAfter);
    var parts = [{ rows: s[0], grand: false }, { rows: s[1], grand: true }];
    if (!s[1].length) parts[0].grand = true;

    var body = function (part) {
      var b = [];
      part.rows.forEach(function (g) {
        b.push([{ content: g.title, colSpan: n, _k: "section" }]);
        g.rows.forEach(function (x) { b.push([x.sno, x.ps].concat(x.counts, [x.total])); });
        b.push([{ content: g.totalLabel, colSpan: 2, _k: "total" }].concat(g.counts, [g.total]).map(mark("total")));
      });
      if (part.grand) b.push([{ content: "Grand Total", colSpan: 2 }].concat(ab.grand, [ab.grandTotal]).map(mark("grand")));
      return b;
    };
    run(doc, {
      head: head,
      columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 178, halign: "left" } },
      didParseCell: function (d) { styleBodyCell(d, { sum: SUM, red: [GT], green: [BET] }); }
    }, parts, body);
    pageNumbers(doc);
    return doc;
  }

  /* ---------- UI - Grave / Non Grave abstract ---------- */
  function graveAbstractPdf(jsPDF, G, wrapLabel, breakAfter) {
    var doc = newDoc(jsPDF), n = 11, L = G.labels;
    var SUM = [2, 6, 10], RED = [5, 9];
    var two = function (t) { return wrapLabel(t).join("\n"); };
    var head = [titleRow(G.title, n),
      [{ content: "S.NO", rowSpan: 2 }, { content: "POLICE STATION", rowSpan: 2 }, { content: "TOTAL UI\nCASES", rowSpan: 2 },
       { content: G.limit + " DAYS - GRAVE PENDING UI CASES", colSpan: 4, styles: { fillColor: COL.grave } },
       { content: G.limit + " DAYS - NON GRAVE PENDING UI CASES", colSpan: 4, styles: { fillColor: COL.nongrave } }],
      [L.lt, two(L.bet), L.gt, "TOTAL GRAVE\nUI CASES", L.lt, two(L.bet), L.gt, "TOTAL NON\nGRAVE UI CASES"].map(function (t, i) {
        var j = i + 3;
        return { content: t, styles: { fillColor: RED.indexOf(j) >= 0 ? COL.red : (j <= 6 ? COL.grave : COL.nongrave), fontSize: 9 } };
      })];
    var s = split(G.groups, breakAfter);
    var parts = [{ rows: s[0], grand: !s[1].length }, { rows: s[1], grand: true }];
    var body = function (part) {
      var b = [];
      part.rows.forEach(function (g) {
        b.push([{ content: g.title, colSpan: n, _k: "section" }]);
        g.rows.forEach(function (x) { b.push([x.sno, x.ps].concat(x.counts)); });
        b.push([{ content: g.totalLabel, colSpan: 2 }].concat(g.counts).map(mark("total")));
      });
      if (part.grand) b.push([{ content: "Grand Total", colSpan: 2 }].concat(G.grand).map(mark("grand")));
      return b;
    };
    run(doc, {
      head: head,
      columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 178, halign: "left" } },
      didParseCell: function (d) { styleBodyCell(d, { sum: SUM, red: RED, green: [] }); }
    }, parts, body);
    pageNumbers(doc);
    return doc;
  }

  /* tag every cell of a total / grand row so it can be coloured */
  function mark(kind) {
    return function (c) { return (c && typeof c === "object") ? Object.assign({ _k: kind }, c) : { content: String(c), _k: kind }; };
  }

  function styleBodyCell(d, cols) {
    if (d.section !== "body") return;
    var raw = d.cell.raw, kind = raw && typeof raw === "object" ? raw._k : null, j = d.column.index, st = d.cell.styles;
    if (kind === "section") { st.fillColor = COL.section; st.fontStyle = "bold"; st.halign = "center"; return; }
    if (kind === "total" || kind === "grand") {
      st.fillColor = kind === "total" ? COL.total : COL.grand; st.fontStyle = "bold";
      if (j === 0) st.halign = "center";
    } else if (cols.sum.indexOf(j) >= 0) { st.fillColor = COL.sum; st.fontStyle = "bold"; }
    if (cols.red.indexOf(j) >= 0) { st.textColor = COL.red; st.fontStyle = "bold"; }
    if (cols.green.indexOf(j) >= 0) { st.textColor = COL.green; st.fontStyle = "bold"; }
  }

  return { abstractPdf: abstractPdf, graveAbstractPdf: graveAbstractPdf };
});
