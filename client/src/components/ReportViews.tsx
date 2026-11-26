import { useEffect, useRef, useState } from "react";
import { Building2 } from "lucide-react";

/** Una celda (día) del informe. `present` = sin causa registrada. */
export type ReportCell = { date: string; code: string; name: string; factor: number; present: boolean; color: string };
/** Un guardia del informe, ya con empresa, color y saldos. */
export type ReportGuard = {
  id: number; name: string; rut: string; post: string; company: string; point: string | null; color: string;
  cells: ReportCell[]; weighted: number; absent: number; presentDays: number; vacLeft: number; adminUsed: number | null;
  extras: ReportExtra[];
};
/** Día extra (reemplazo) que hizo el guardia en el período. */
export type ReportExtra = { date: string; shift: "dia" | "tarde" | "noche"; startTime: string; hours: number; company: string; color: string; replaced: string | null };
export const SHIFT_SHORT: Record<string, string> = { dia: "D", tarde: "T", noche: "N" };
export const SHIFT_LABEL: Record<string, string> = { dia: "Día", tarde: "Tarde", noche: "Noche" };

/** Resumen de extras por turno, por ejemplo «D×1 N×2». */
export function extrasSummary(list: ReportExtra[]) {
  return (["dia", "tarde", "noche"] as const).map(s => ({ s, n: list.filter(e => e.shift === s).length })).filter(x => x.n);
}
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

  if (view === "combined") return <CompactReport rows={rows} days={days} types={types} />;

  if (view === "detail") return <DetailView rows={rows} grouped={grouped} />;

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

/* ---------- Vista «Resumen y calendario» compacta ---------- */

/** Divide los días en filas de 10 (1–10, 11–20, 21–31); si sobra un solo día, se suma a la última fila. */
function chunkDays<T>(items: T[], size = 10): T[][] {
  if (items.length <= size + 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  if (out.length > 1 && out[out.length - 1].length === 1) out[out.length - 2].push(...out.pop()!);
  return out;
}

/**
 * Alto de pantalla completa para el área del informe: la página se puede desplazar hasta que el borde
 * superior de la tabla toca el borde superior de la ventana; desde ahí la tabla ocupa toda la altura
 * y se recorre con su propia barra. En el celular no se limita (desplazamiento normal de la página).
 */
export function useFullScreenHeight(min = 280) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>();
  useEffect(() => {
    const calc = () => {
      const el = ref.current; if (!el) return;
      if (window.innerWidth <= 720) { setHeight(undefined); return; }
      const rect = el.getBoundingClientRect();
      const below = document.documentElement.scrollHeight - (rect.bottom + window.scrollY); // espacio bajo la tabla
      setHeight(Math.max(min, window.innerHeight - below - 6));
    };
    calc();
    const t = setTimeout(calc, 60);
    window.addEventListener("resize", calc);
    return () => { clearTimeout(t); window.removeEventListener("resize", calc); };
  }, [min]);
  return { ref, height };
}

function causeCounts(g: ReportGuard) {
  const m = new Map<string, { code: string; name: string; color: string; n: number }>();
  for (const c of g.cells) if (!c.present) { const x = m.get(c.code); if (x) x.n++; else m.set(c.code, { code: c.code, name: c.name, color: c.color, n: 1 }); }
  return Array.from(m.values());
}

function CauseChips({ g }: { g: ReportGuard }) {
  const list = causeCounts(g);
  if (!list.length) return <span className="cr-none">Sin ausencias</span>;
  return <div className="cr-chips">{list.map(x => <span key={x.code} className="cr-chip" style={{ background: x.color }} title={x.name}>{x.code} ×{x.n}</span>)}</div>;
}

function ExtrasChips({ g }: { g: ReportGuard }) {
  if (!g.extras.length) return <span className="cr-none-muted">—</span>;
  return (
    <div className="cr-chips">
      {g.extras.map(e => <span key={`${e.date}-${e.shift}`} className="cr-extra" style={{ borderColor: e.color }} title={`${e.date} · ${SHIFT_LABEL[e.shift]} ${e.startTime} (${e.hours} h) · ${e.company}${e.replaced ? ` · reemplaza a ${e.replaced}` : ""}`}><i style={{ background: e.color }}>{SHIFT_SHORT[e.shift]}</i>{e.date.slice(8)}</span>)}
    </div>
  );
}

function MiniMap({ g }: { g: ReportGuard }) {
  return (
    <div className="cr-map">
      {chunkDays(g.cells).map((row, i) => (
        <div className="cr-map-row" key={i}>
          {row.map(c => <i key={c.date} className={c.present ? "p" : "e"} style={c.present ? undefined : { background: c.color }} title={`${new Date(`${c.date}T12:00:00`).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })} · ${c.present ? "Presente" : `${c.code} · ${c.name}`}`} />)}
        </div>
      ))}
    </div>
  );
}

function CompactReport({ rows, days, types }: { rows: ReportGuard[]; days: string[]; types: any[] }) {
  const { ref, height } = useFullScreenHeight();
  const groups = groupByCompany(rows);
  const total = rows.reduce((a, r) => ({ absent: a.absent + r.absent, weighted: a.weighted + r.weighted }), { absent: 0, weighted: 0 });
  const totalExtras = rows.reduce((n, r) => n + r.extras.length, 0);
  const legend = usedCodes(rows, types).map(t => ({ code: t.code, name: t.name, color: rows.flatMap(r => r.cells).find(c => !c.present && c.code === t.code)?.color || "#999" }));
  const first = days[0], last = days[days.length - 1];
  const rangeHint = days.length > 11 ? chunkDays(days).map(r => `${r[0].slice(8)}–${r[r.length - 1].slice(8)}`).join(" · ") : `${first?.slice(8)}–${last?.slice(8)}`;

  return (
    <div className="cr">
      <div className="cr-legend">
        <span><i className="p" /> Presente</span>
        {legend.map(l => <span key={l.code}><i style={{ background: l.color }} /> {l.code} · {l.name}</span>)}
        <small>Mapa del período por filas: {rangeHint}</small>
      </div>
      <div className="cr-scroll report-fullscreen" ref={ref} style={height ? { height } : undefined}>
        {/* Escritorio: tabla */}
        <table className="cr-table">
          <thead><tr><th className="cr-guard">Guardia</th><th>Causas</th><th className="num">Aus.</th><th className="num">Pond.</th><th className="num">Vac. rest.</th><th className="num">Adm.</th><th>Extras</th><th>Mapa del período</th></tr></thead>
          <tbody>
            {groups.flatMap(g => [
              <tr className="cr-group" key={`g-${g.company}`} style={{ ["--company-color" as any]: g.color }}>
                <td colSpan={8}><Building2 size={13} /> <b>{g.company}</b><span>{g.rows.length} guardia{g.rows.length === 1 ? "" : "s"} · {g.absent} ausencias · {fmt(g.weighted)} días pond.</span></td>
              </tr>,
              ...g.rows.map(r => (
                <tr key={r.id}>
                  <td className="cr-guard company-bar" style={{ ["--company-color" as any]: r.color }}><b>{r.name}</b><small>{r.point || r.company}</small></td>
                  <td><CauseChips g={r} /></td>
                  <td className="num"><b>{r.absent}</b></td>
                  <td className="num">{fmt(r.weighted)}</td>
                  <td className="num">{fmt(r.vacLeft)}</td>
                  <td className="num">{r.adminUsed ?? "—"}/6</td>
                  <td><ExtrasChips g={r} /></td>
                  <td><MiniMap g={r} /></td>
                </tr>
              )),
            ])}
          </tbody>
          <tfoot><tr><td className="cr-guard">Total · {rows.length} guardias</td><td /><td className="num">{total.absent}</td><td className="num">{fmt(total.weighted)}</td><td /><td /><td>{totalExtras ? `${totalExtras} extras` : ""}</td><td /></tr></tfoot>
        </table>
        {/* Celular: tarjetas */}
        <div className="cr-cards">
          {groups.map(g => (
            <section key={g.company} className="cr-card-group" style={{ ["--company-color" as any]: g.color }}>
              <h5><Building2 size={13} /> {g.company}<span>{g.absent} aus. · {fmt(g.weighted)} pond.</span></h5>
              {g.rows.map(r => (
                <article key={r.id} className="cr-card company-bar" style={{ ["--company-color" as any]: r.color }}>
                  <div className="cr-card-head"><b>{r.name}</b><small>{r.point || r.company}</small></div>
                  <CauseChips g={r} />
                  <ExtrasChips g={r} /><div className="cr-card-stats"><span><b>{r.absent}</b> aus.</span><span><b>{fmt(r.weighted)}</b> pond.</span><span><b>{fmt(r.vacLeft)}</b> vac.</span><span><b>{r.adminUsed ?? "—"}/6</b> adm.</span></div>
                  <MiniMap g={r} />
                </article>
              ))}
            </section>
          ))}
          <div className="cr-card-total">Total · {rows.length} guardias · {total.absent} ausencias · {fmt(total.weighted)} días pond.</div>
        </div>
      </div>
    </div>
  );
}

/** «Detalle por fecha» con la tabla a pantalla completa y desplazamiento propio. */
function DetailView({ rows, grouped }: { rows: ReportGuard[]; grouped: boolean }) {
  const { ref, height } = useFullScreenHeight();
  return (
    <div className="report-table-wrap report-fullscreen" ref={ref} style={height ? { height } : undefined}>
      <table className="report-table report-detail"><thead><tr><th>Guardia</th><th>Detalle por fecha</th><th>Pond.</th></tr></thead><tbody>
        {withGroups(rows, grouped, 3, g => (
          <tr key={g.id}>
            <td className="company-bar" style={{ ["--company-color" as any]: g.color }}><GuardLabel g={g} /></td>
            <td>{g.cells.map(c => <span className={`report-day ${c.present ? "present" : "event"}`} style={c.present ? undefined : { background: c.color, color: "#fff" }} key={c.date}><b>{dayNum(c.date)}</b> {c.code} · {c.name}{c.present ? "" : ` ×${fmt(c.factor)}`}</span>)}</td>
            <td><b>{g.weighted.toFixed(2)}</b><small>{g.presentDays} presentes · {g.absent} ausencias</small>{g.extras.length > 0 && <small className="rep-extras" title={g.extras.map(e => `${e.date} · ${SHIFT_LABEL[e.shift]} · ${e.company}`).join("\n")}>+ {g.extras.length} extra{g.extras.length === 1 ? "" : "s"} ({extrasSummary(g.extras).map(x => `${SHIFT_SHORT[x.s]}×${x.n}`).join(" ")})</small>}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}
