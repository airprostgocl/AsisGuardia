import { groupByCompany, usedCodes, SHIFT_LABEL, type CoverageData, type ReportGuard, type ReportView, REPORT_VIEWS } from "@/components/ReportViews";

export type ReportMeta = {
  supervisor: string; periodLabel: string; start: string; end: string; days: string[]; types: any[];
  totals: { guards: number; absent: number; presentDays: number; weighted: number }; grouped: boolean; coverage?: CoverageData;
};

const fileBase = (m: ReportMeta) => `guardiaflow-reporte-${m.start}-${m.end}`;
const generatedAt = () => new Date().toLocaleString("es-CL");
const hex = (c: string) => c.replace("#", "").slice(0, 6).toUpperCase();
const PRESENT_FILL = "DFF5EC";
const HEADER_FILL = "0E6B5B";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Excel con cuatro hojas: Resumen, Calendario, Ausencias y Códigos. */
export async function exportExcel(rows: ReportGuard[], meta: ReportMeta) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "GuardiaFlow"; wb.created = new Date();
  const codes = usedCodes(rows, meta.types);

  const titleBlock = (ws: any, title: string, width: number) => {
    ws.addRow([`GuardiaFlow — ${title}`]).font = { bold: true, size: 14, color: { argb: "FF" + HEADER_FILL } };
    ws.addRow([`Supervisor: ${meta.supervisor}`]);
    ws.addRow([`Período: ${meta.periodLabel} · ${meta.start} al ${meta.end}`]);
    ws.addRow([`Generado: ${generatedAt()}`]);
    ws.addRow([]);
    for (let r = 1; r <= 4; r++) ws.mergeCells(r, 1, r, Math.max(width, 4));
  };
  const header = (ws: any, values: any[]) => {
    const row = ws.addRow(values);
    row.eachCell((cell: any) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + HEADER_FILL } }; cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; });
    row.height = 30;
    return row;
  };
  const groupRow = (ws: any, text: string, color: string, width: number) => {
    const row = ws.addRow([text]);
    ws.mergeCells(row.number, 1, row.number, width);
    row.getCell(1).font = { bold: true, color: { argb: "FF" + hex(color) } };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F3" } };
  };
  const groups = meta.grouped ? groupByCompany(rows) : [{ company: "", color: "#000000", rows, absent: 0, weighted: 0, presentDays: 0 }];

  // Resumen
  const summary = wb.addWorksheet("Resumen", { views: [{ state: "frozen", ySplit: 6, xSplit: 2 }] });
  const sumCols = ["Empresa", "Guardia", "RUT", "Punto", ...codes.map(t => `${t.code}\n${t.name}`), "Ausencias", "Días ponderados", "Vacaciones restantes", "Días adm. usados (de 6)", "Extras día", "Extras tarde", "Extras noche", "Extras total"];
  titleBlock(summary, "Resumen por causa", sumCols.length);
  header(summary, sumCols);
  for (const g of groups) {
    if (meta.grouped) groupRow(summary, `${g.company} · ${g.rows.length} guardias · ${g.absent} ausencias · ${g.weighted.toFixed(2)} días ponderados`, g.color, sumCols.length);
    for (const r of g.rows) {
      summary.addRow([r.company, r.name, r.rut, r.point ?? "", ...codes.map(t => r.cells.filter(c => !c.present && c.code === t.code).length || null), r.absent, Number(r.weighted.toFixed(2)), Number(r.vacLeft.toFixed(2)), r.adminUsed ?? null, ...(["dia", "tarde", "noche"] as const).map(s => r.extras.filter(e => e.shift === s).length || null), r.extras.length || null]);
    }
  }
  const tot = summary.addRow(["TOTAL", `${meta.totals.guards} guardias`, "", "", ...codes.map(t => rows.reduce((n, r) => n + r.cells.filter(c => !c.present && c.code === t.code).length, 0)), meta.totals.absent, Number(meta.totals.weighted.toFixed(2)), null, null, ...(["dia", "tarde", "noche"] as const).map(sh => rows.reduce((n, r) => n + r.extras.filter(e => e.shift === sh).length, 0)), rows.reduce((n, r) => n + r.extras.length, 0)]);
  tot.font = { bold: true };
  summary.columns.forEach((col: any, i: number) => { col.width = i === 0 ? 26 : i === 1 ? 26 : i === 3 ? 18 : i === 2 ? 14 : 12; });

  // Calendario
  const cal = wb.addWorksheet("Calendario", { views: [{ state: "frozen", ySplit: 6, xSplit: 2 }] });
  const calCols = ["Empresa", "Guardia", ...meta.days.map(d => `${d.slice(8)}\n${["D", "L", "M", "X", "J", "V", "S"][new Date(`${d}T12:00:00`).getDay()]}`), "Ausencias", "Días pond."];
  titleBlock(cal, "Calendario", calCols.length);
  header(cal, calCols);
  for (const g of groups) {
    if (meta.grouped) groupRow(cal, g.company, g.color, calCols.length);
    for (const r of g.rows) {
      const row = cal.addRow([r.company, r.name, ...r.cells.map(c => (c.present ? "✓" : c.code)), r.absent, Number(r.weighted.toFixed(2))]);
      r.cells.forEach((c, i) => {
        const cell = row.getCell(i + 3);
        cell.alignment = { horizontal: "center" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + (c.present ? PRESENT_FILL : hex(c.color)) } };
        cell.font = { bold: !c.present, color: { argb: c.present ? "FF16745F" : "FFFFFFFF" } };
        if (!c.present) cell.note = `${c.name} · factor ${c.factor}`;
      });
    }
  }
  cal.columns.forEach((col: any, i: number) => { col.width = i < 2 ? 26 : i < 2 + meta.days.length ? 5 : 11; });

  // Ausencias
  const abs = wb.addWorksheet("Ausencias", { views: [{ state: "frozen", ySplit: 6 }] });
  const absCols = ["Fecha", "Guardia", "RUT", "Empresa", "Punto", "Código", "Causa", "Factor"];
  titleBlock(abs, "Ausencias del período", absCols.length);
  header(abs, absCols);
  const items = rows.flatMap(r => r.cells.filter(c => !c.present).map(c => ({ r, c }))).sort((a, b) => (meta.grouped ? a.r.company.localeCompare(b.r.company, "es") : 0) || a.c.date.localeCompare(b.c.date) || a.r.name.localeCompare(b.r.name, "es"));
  for (const { r, c } of items) {
    const row = abs.addRow([c.date, r.name, r.rut, r.company, r.point ?? "", c.code, c.name, c.factor]);
    row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + hex(c.color) } };
    row.getCell(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.getCell(6).alignment = { horizontal: "center" };
  }
  if (!items.length) abs.addRow(["Sin ausencias en el período."]);
  [12, 26, 14, 26, 18, 9, 30, 8].forEach((w, i) => { abs.getColumn(i + 1).width = w; });

  // Códigos
  // Extras (reemplazos)
  const ext = wb.addWorksheet("Extras", { views: [{ state: "frozen", ySplit: 6 }] });
  const extCols = ["Fecha", "Guardia", "RUT", "Empresa del guardia", "Turno", "Inicio", "Horas", "Empresa donde hizo el extra", "Reemplaza a"];
  titleBlock(ext, "Días extra (reemplazos)", extCols.length);
  header(ext, extCols);
  const extItems = rows.flatMap(r => r.extras.map(e => ({ r, e }))).sort((a, b) => a.e.date.localeCompare(b.e.date) || a.r.name.localeCompare(b.r.name, "es"));
  for (const { r, e } of extItems) {
    const row = ext.addRow([e.date, r.name, r.rut, r.company, SHIFT_LABEL[e.shift], e.startTime, e.hours, e.company, e.replaced ?? ""]);
    row.getCell(8).font = { bold: true, color: { argb: "FF" + hex(e.color) } };
  }
  if (!extItems.length) ext.addRow(["Sin días extra en el período."]);
  [12, 26, 14, 26, 9, 8, 7, 30, 26].forEach((w, i) => { ext.getColumn(i + 1).width = w; });

  // Ausencias y reemplazos
  if (meta.coverage) {
    const cov = wb.addWorksheet("Ausencias y reemplazos", { views: [{ state: "frozen", ySplit: 6 }] });
    const covCols = ["Fecha", "Guardia ausente", "RUT", "Empresa", "Punto", "Causa", "Estado", "Reemplazado por", "Turno", "Horario", "Empresa del reemplazo"];
    titleBlock(cov, `Ausencias y reemplazos · ${meta.coverage.covered} de ${meta.coverage.total} cubiertas`, covCols.length);
    header(cov, covCols);
    for (const i of meta.coverage.items) {
      const reps = i.replacements.length ? i.replacements : [null];
      reps.forEach((r, k) => {
        const row = cov.addRow([k ? "" : i.date, k ? "" : i.guard.name, k ? "" : i.guard.rut, k ? "" : i.guard.company, k ? "" : (i.guard.point ?? ""), k ? "" : `${i.code} · ${i.cause}`, r ? "Cubierta" : "Sin reemplazo", r?.name ?? "", r ? SHIFT_LABEL[r.shift] : "", r ? `${r.startTime} · ${r.hours} h` : "", r?.company ?? ""]);
        if (!k) { row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + hex(i.causeColor) } }; row.getCell(6).font = { bold: true, color: { argb: "FFFFFFFF" } }; }
        row.getCell(7).font = { bold: true, color: { argb: r ? "FF147A5F" : "FFC0392B" } };
      });
    }
    if (!meta.coverage.items.length) cov.addRow(["Sin ausencias en el período."]);
    [12, 26, 14, 26, 18, 28, 14, 26, 9, 14, 28].forEach((w, i) => { cov.getColumn(i + 1).width = w; });
  }

  const leg = wb.addWorksheet("Códigos");
  header(leg, ["Código", "Causa", "Factor de deducción"]);
  leg.addRow(["✓", "Presente", 0]);
  for (const t of meta.types) leg.addRow([t.code, t.name, Number(t.deductionFactor)]);
  [10, 34, 20].forEach((w, i) => { leg.getColumn(i + 1).width = w; });

  const buffer = await wb.xlsx.writeBuffer();
  download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileBase(meta)}.xlsx`);
}

const rgb = (c: string): [number, number, number] => { const h = c.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };

/** PDF horizontal con la vista elegida (el detalle por fecha se imprime como calendario). */
export async function exportPdf(rows: ReportGuard[], meta: ReportMeta, view: ReportView) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const viewLabel = REPORT_VIEWS.find(v => v.id === view)?.label ?? "";
  doc.setFontSize(15); doc.setTextColor(14, 107, 91); doc.text("GuardiaFlow — Reporte de asistencia", 32, 36);
  doc.setFontSize(9); doc.setTextColor(60, 70, 66);
  doc.text(`Supervisor: ${meta.supervisor}   ·   Período: ${meta.periodLabel} (${meta.start} al ${meta.end})   ·   Vista: ${view === "detail" ? "Detalle (calendario)" : viewLabel}`, 32, 52);
  doc.text(`${meta.totals.guards} guardias · ${meta.totals.absent} ausencias · ${meta.totals.presentDays} días presentes · ${meta.totals.weighted.toFixed(2)} días ponderados · Generado: ${generatedAt()}`, 32, 64);

  const groupHead = (company: string, n: number, absent: number, weighted: number, span: number, color: string) =>
    [{ content: `${company} · ${n} guardias · ${absent} ausencias · ${weighted.toFixed(2)} días ponderados`, colSpan: span, styles: { fillColor: [241, 245, 243] as [number, number, number], textColor: rgb(color), fontStyle: "bold" as const } }];
  const common = { startY: 76, theme: "grid" as const, headStyles: { fillColor: [14, 107, 91] as [number, number, number], textColor: 255, fontSize: 7, halign: "center" as const }, styles: { fontSize: 7, cellPadding: 2 }, margin: { left: 24, right: 24 } };

  if (view === "coverage") {
    const c = meta.coverage;
    const items = c?.items ?? [];
    doc.setFontSize(9); doc.setTextColor(14, 107, 91);
    doc.text(`Ausencias: ${c?.total ?? 0} · Cubiertas: ${c?.covered ?? 0} · Sin reemplazo: ${(c?.total ?? 0) - (c?.covered ?? 0)}`, 32, 76);
    const flat = items.flatMap(i => (i.replacements.length ? i.replacements : [null]).map((r, k) => ({ i, r, first: k === 0 })));
    autoTable(doc, {
      ...common, startY: 84,
      head: [["Fecha", "Guardia ausente", "Empresa", "Causa", "Estado", "Reemplazado por", "Turno y horario", "Empresa del reemplazo"]],
      body: flat.length ? flat.map(({ i, r, first }) => [first ? i.date : "", first ? i.guard.name : "", first ? i.guard.company + (i.guard.point ? ` · ${i.guard.point}` : "") : "", first ? `${i.code} · ${i.cause}` : "", r ? "Cubierta" : "Sin reemplazo", r?.name ?? "—", r ? `${SHIFT_LABEL[r.shift]} ${r.startTime} · ${r.hours} h` : "", r?.company ?? ""]) : [["Sin ausencias en el período.", "", "", "", "", "", "", ""]],
      didParseCell: (data: any) => {
        if (data.section !== "body" || !flat[data.row.index]) return;
        const { i, r, first } = flat[data.row.index];
        if (data.column.index === 3 && first) { data.cell.styles.fillColor = rgb(i.causeColor); data.cell.styles.textColor = 255; data.cell.styles.fontStyle = "bold"; }
        if (data.column.index === 4) { data.cell.styles.textColor = r ? [20, 122, 95] : [192, 57, 43]; data.cell.styles.fontStyle = "bold"; }
      },
    });
    doc.save(`${fileBase(meta)}.pdf`);
    return;
  }
  if (view === "combined") {
    // Resumen agrupado por empresa y, en una página nueva, el calendario de colores.
    await renderPdfTables(doc, autoTable, rows, { ...meta, grouped: true }, "summary", common, groupHead);
    doc.addPage();
    doc.setFontSize(11); doc.setTextColor(14, 107, 91); doc.text("Calendario del período", 32, 36);
    await renderPdfTables(doc, autoTable, rows, { ...meta, grouped: true }, "calendar", { ...common, startY: 48 }, groupHead);
    renderPdfExtras(doc, autoTable, rows, common);
    doc.save(`${fileBase(meta)}.pdf`);
    return;
  }
  await renderPdfTables(doc, autoTable, rows, meta, view, common, groupHead);
  renderPdfExtras(doc, autoTable, rows, common);
  doc.save(`${fileBase(meta)}.pdf`);
}

async function renderPdfTables(doc: any, autoTable: any, rows: ReportGuard[], meta: ReportMeta, view: ReportView, common: any, groupHead: any) {
  const groups = meta.grouped ? groupByCompany(rows) : null;
  if (view === "summary") {
    const codes = usedCodes(rows, meta.types);
    const head = [["Guardia", "Empresa", ...codes.map(t => t.code), "Aus.", "Pond.", "Vac. rest.", "Adm.", "Extras"]];
    const line = (r: ReportGuard) => [r.name, r.company + (r.point ? ` · ${r.point}` : ""), ...codes.map(t => String(r.cells.filter(c => !c.present && c.code === t.code).length || "")), String(r.absent), r.weighted.toFixed(2), r.vacLeft.toFixed(1), `${r.adminUsed ?? "—"}/6`, r.extras.length ? `${r.extras.length} (${(["dia", "tarde", "noche"] as const).map(sh => [sh, r.extras.filter(e => e.shift === sh).length] as const).filter(x => x[1]).map(x => `${x[0][0].toUpperCase()}${x[1]}`).join(" ")})` : ""];
    const body: any[] = groups ? groups.flatMap(g => [groupHead(g.company, g.rows.length, g.absent, g.weighted, head[0].length, g.color), ...g.rows.map(line)]) : rows.map(line);
    autoTable(doc, { ...common, head, body });
  } else if (view === "absences") {
    const items = rows.flatMap(r => r.cells.filter(c => !c.present).map(c => ({ r, c }))).sort((a, b) => (meta.grouped ? a.r.company.localeCompare(b.r.company, "es") : 0) || a.c.date.localeCompare(b.c.date));
    const head = [["Fecha", "Guardia", "RUT", "Empresa · punto", "Código", "Causa", "Factor"]];
    const body = items.length ? items.map(({ r, c }) => [c.date, r.name, r.rut, r.company + (r.point ? ` · ${r.point}` : ""), c.code, c.name, String(c.factor)]) : [["Sin ausencias en el período.", "", "", "", "", "", ""]];
    autoTable(doc, { ...common, head, body, didParseCell: (data: any) => { if (data.section === "body" && data.column.index === 4 && items[data.row.index]) { data.cell.styles.fillColor = rgb(items[data.row.index].c.color); data.cell.styles.textColor = 255; data.cell.styles.fontStyle = "bold"; data.cell.styles.halign = "center"; } } });
  } else {
    // Calendario (también para «Detalle por fecha»): presente en verde claro, ausencias con el color de su causa.
    const head = [["Guardia", ...meta.days.map(d => d.slice(8)), "Aus.", "Pond."]];
    const flat: (ReportGuard | null)[] = [];
    const body: any[] = [];
    const push = (r: ReportGuard) => { flat.push(r); body.push([`${r.name}\n${r.company}`, ...r.cells.map(c => (c.present ? "" : c.code)), String(r.absent), r.weighted.toFixed(2)]); };
    if (groups) groups.forEach(g => { flat.push(null); body.push(groupHead(g.company, g.rows.length, g.absent, g.weighted, head[0].length, g.color)); g.rows.forEach(push); }); else rows.forEach(push);
    autoTable(doc, {
      ...common, head, body, styles: { fontSize: 6, cellPadding: 1.5, halign: "center" }, columnStyles: { 0: { halign: "left", cellWidth: 110 } },
      didParseCell: (data: any) => {
        if (data.section !== "body") return;
        const r = flat[data.row.index]; const i = data.column.index - 1;
        if (!r || i < 0 || i >= r.cells.length) return;
        const c = r.cells[i];
        data.cell.styles.fillColor = c.present ? [223, 245, 236] : rgb(c.color);
        if (!c.present) { data.cell.styles.textColor = 255; data.cell.styles.fontStyle = "bold"; }
      },
    });
    drawPdfLegend(doc, rows, meta, (doc as any).lastAutoTable.finalY + 14);
  }
}

/** Leyenda con cuadritos del color de cada causa usada (más «Presente» en verde claro). */
function drawPdfLegend(doc: any, rows: ReportGuard[], meta: ReportMeta, startY: number) {
  const colorByCode = new Map<string, string>();
  for (const r of rows) for (const c of r.cells) if (!c.present && !colorByCode.has(c.code)) colorByCode.set(c.code, c.color);
  const items: { label: string; fill: [number, number, number] }[] = [{ label: "Presente", fill: [223, 245, 236] }];
  for (const t of meta.types) if (colorByCode.has(t.code)) items.push({ label: `${t.code} · ${t.name}`, fill: rgb(colorByCode.get(t.code)!) });
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 24, right = pageWidth - 24, box = 8, gap = 14;
  let x = left, y = startY;
  doc.setFontSize(7);
  for (const it of items) {
    const w = box + 4 + doc.getTextWidth(it.label);
    if (x + w > right) { x = left; y += 13; }
    doc.setFillColor(...it.fill); doc.setDrawColor(180, 192, 187); doc.setLineWidth(0.4);
    doc.rect(x, y - box + 1.5, box, box, "FD");
    doc.setTextColor(60, 70, 66); doc.text(it.label, x + box + 4, y);
    x += w + gap;
  }
}

/** Página con los días extra (reemplazos) del período, si los hay. */
function renderPdfExtras(doc: any, autoTable: any, rows: ReportGuard[], common: any) {
  const items = rows.flatMap(r => r.extras.map(e => ({ r, e }))).sort((a, b) => a.e.date.localeCompare(b.e.date) || a.r.name.localeCompare(b.r.name, "es"));
  if (!items.length) return;
  doc.addPage();
  doc.setFontSize(11); doc.setTextColor(14, 107, 91); doc.text(`Días extra (reemplazos) · ${items.length}`, 32, 36);
  autoTable(doc, {
    ...common, startY: 48,
    head: [["Fecha", "Guardia", "Turno", "Horario", "Empresa donde hizo el extra", "Reemplaza a"]],
    body: items.map(({ r, e }) => [e.date, r.name, SHIFT_LABEL[e.shift], `${e.startTime} · ${e.hours} h`, e.company, e.replaced ?? ""]),
    didParseCell: (data: any) => { if (data.section === "body" && data.column.index === 4) { data.cell.styles.textColor = rgb(items[data.row.index].e.color); data.cell.styles.fontStyle = "bold"; } },
  });
}
