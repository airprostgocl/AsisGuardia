import { Building2 } from "lucide-react";

/** Una celda (día) del informe. `present` = sin causa registrada. */
export type ReportCell = { date: string; code: string; name: string; factor: number; present: boolean; color: string };
/** Un guardia del informe, ya con empresa, color y saldos. */
export type ReportGuard = {
  id: number; name: string; rut: string; post: string; company: string; point: string | null; color: string;
  cells: ReportCell[]; weighted: number; absent: number; presentDays: number; vacLeft: number; adminUsed: number | null;
};
export type ReportView = "detail" | "combined" | "calendar" | "summary" | "absences";
/** Dos formas de ver el informe: el detalle por fecha y el resumen por empresa + calendario de colores. */
export const REPORT_VIEWS: { id: ReportView; label: string }[] = [
  { id: "detail", label: "Detalle por fecha" },
  { id: "combined", label: "Resumen y calendario" },
];

export type ReportGroup = { company: string; color: string; rows: ReportGuard[]; absent: number; weighted: number; presentDays: number };

/** Agrupa por empresa (las filas ya vienen ordenadas por empresa). */
export function groupByCompany(rows: ReportGuard[]): ReportGroup[] {
  const groups: ReportGroup[] = [];
  for (const r of rows) {
    let g = groups[groups.length - 1];
    if (!g || g.company !== r.company) { g = { company: r.company, color: r.color, rows: [], absent: 0, weighted: 0, presentDays: 0 }; groups.push(g); }
    g.rows.push(r); g.absent += r.absent; g.weighted += r.weighted; g.presentDays += r.presentDays;
  }
  return groups;
}

/** Códigos con al menos una ausencia en el período, en el orden del catálogo. */
export function usedCodes(rows: ReportGuard[], types: any[]) {
  const used = new Set(rows.flatMap(r => r.cells.filter(c => !c.present).map(c => c.code)));
  return types.filter(t => used.has(t.code));
}

const fmt = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });
const dayNum = (d: string) => d.slice(8);
const weekdayLetter = (d: string) => ["D", "L", "M", "X", "J", "V", "S"][new Date(`${d}T12:00:00`).getDay()];

function GroupHeader({ g, colSpan }: { g: ReportGroup; colSpan: number }) {
  return (
    <tr className="report-group-row" style={{ ["--company-color" as any]: g.color }}>
      <td colSpan={colSpan}><Building2 size={14} /> <b>{g.company}</b> <span>{g.rows.length} guardia{g.rows.length === 1 ? "" : "s"} · {g.absent} ausencias · {fmt(g.weighted)} días ponderados</span></td>
    </tr>
  );
}

function GuardLabel({ g }: { g: ReportGuard }) {
  return <><b>{g.name}</b><small>{g.rut} · <strong>{g.company}</strong>{g.point ? ` · ${g.point}` : ""}</small></>;
}

/** Renderiza filas con o sin encabezados de empresa. */
function withGroups(rows: ReportGuard[], grouped: boolean, colSpan: number, renderRow: (g: ReportGuard) => React.ReactNode) {
  if (!grouped) return rows.map(renderRow);
  return groupByCompany(rows).flatMap(g => [<GroupHeader key={`h-${g.company}`} g={g} colSpan={colSpan} />, ...g.rows.map(renderRow)]);
}

export function ReportViewSwitch({ view, rows, days, types, grouped }: { view: ReportView; rows: ReportGuard[]; days: string[]; types: any[]; grouped: boolean }) {
  if (!rows.length) return <p className="report-empty">No hay guardias para el filtro seleccionado.</p>;

  if (view === "combined") {
    return (
      <div className="report-combined">
        <h4 className="report-section-title">Resumen por guardia · agrupado por empresa</h4>
        <ReportViewSwitch view="summary" rows={rows} days={days} types={types} grouped />
        <h4 className="report-section-title">Calendario del período</h4>
        <ReportViewSwitch view="calendar" rows={rows} days={days} types={types} grouped />
      </div>
    );
  }

  if (view === "detail") {
    return (
      <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Guardia</th><th>Detalle por fecha</th><th>Pond.</th></tr></thead><tbody>
        {withGroups(rows, grouped, 3, g => (
          <tr key={g.id}>
            <td className="company-bar" style={{ ["--company-color" as any]: g.color }}><GuardLabel g={g} /></td>
            <td>{g.cells.map(c => <span className={`report-day ${c.present ? "present" : "event"}`} style={c.present ? undefined : { background: c.color, color: "#fff" }} key={c.date}><b>{dayNum(c.date)}</b> {c.code} · {c.name}{c.present ? "" : ` ×${fmt(c.factor)}`}</span>)}</td>
            <td><b>{g.weighted.toFixed(2)}</b><small>{g.presentDays} presentes · {g.absent} ausencias</small></td>
          </tr>
        ))}
      </tbody></table></div>
    );
  }

  if (view === "calendar") {
    return (
      <div className="report-table-wrap"><table className="report-table report-calendar"><thead><tr><th className="cal-guard">Guardia</th>
        {days.map(d => <th key={d}><b>{dayNum(d)}</b><small>{weekdayLetter(d)}</small></th>)}
        <th>Aus.</th><th>Pond.</th></tr></thead><tbody>
        {withGroups(rows, grouped, days.length + 3, g => (
          <tr key={g.id}>
            <td className="cal-guard company-bar" style={{ ["--company-color" as any]: g.color }}><GuardLabel g={g} /></td>
            {g.cells.map(c => <td key={c.date} className="cal-cell"><span className={c.present ? "cal-present" : "cal-event"} style={c.present ? undefined : { background: c.color }} title={`${c.date} · ${c.name}`}>{c.code}</span></td>)}
            <td className="cal-num">{g.absent}</td><td className="cal-num">{fmt(g.weighted)}</td>
          </tr>
        ))}
      </tbody></table></div>
    );
  }

  if (view === "summary") {
    const codes = usedCodes(rows, types);
    return (
      <div className="report-table-wrap"><table className="report-table report-summary"><thead><tr><th>Guardia</th>
        {codes.map(t => <th key={t.code} title={t.name}>{t.code}<small>{t.name}</small></th>)}
        <th>Ausencias</th><th>Días pond.</th><th>Vacaciones restantes</th><th>Días adm. usados</th></tr></thead><tbody>
        {withGroups(rows, grouped, codes.length + 5, g => (
          <tr key={g.id}>
            <td className="company-bar" style={{ ["--company-color" as any]: g.color }}><GuardLabel g={g} /></td>
            {codes.map(t => { const n = g.cells.filter(c => !c.present && c.code === t.code).length; return <td key={t.code} className="cal-num">{n || "·"}</td>; })}
            <td className="cal-num"><b>{g.absent}</b></td><td className="cal-num"><b>{fmt(g.weighted)}</b></td>
            <td className="cal-num">{fmt(g.vacLeft)}</td><td className="cal-num">{g.adminUsed ?? "—"} de 6</td>
          </tr>
        ))}
      </tbody></table>
      {!codes.length && <p className="report-empty">Sin ausencias en el período: todos los días fueron presentes.</p>}</div>
    );
  }

  const list = rows.flatMap(g => g.cells.filter(c => !c.present).map(c => ({ g, c })));
  if (!list.length) return <p className="report-empty">Sin ausencias en el período: todos los días fueron presentes.</p>;
  const byGroup = grouped ? groupByCompany(rows) : [{ company: "", color: "", rows } as ReportGroup];
  return (
    <div className="report-table-wrap"><table className="report-table report-absences"><thead><tr><th>Fecha</th><th>Guardia</th><th>Empresa · punto</th><th>Causa</th><th>Factor</th></tr></thead><tbody>
      {byGroup.flatMap(grp => {
        const items = list.filter(x => grp.rows.includes(x.g)).sort((a, b) => a.c.date.localeCompare(b.c.date) || a.g.name.localeCompare(b.g.name, "es"));
        if (!items.length) return [];
        return [
          ...(grouped ? [<GroupHeader key={`h-${grp.company}`} g={grp} colSpan={5} />] : []),
          ...items.map(({ g, c }) => (
            <tr key={`${g.id}-${c.date}`}>
              <td className="company-bar" style={{ ["--company-color" as any]: g.color }}>{new Date(`${c.date}T12:00:00`).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}</td>
              <td><b>{g.name}</b><small>{g.rut}</small></td>
              <td>{g.company}{g.point ? ` · ${g.point}` : ""}</td>
              <td><span className="report-day event" style={{ background: c.color, color: "#fff" }}>{c.code} · {c.name}</span></td>
              <td className="cal-num">{fmt(c.factor)}</td>
            </tr>
          )),
        ];
      })}
    </tbody></table></div>
  );
}
