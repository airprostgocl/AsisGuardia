import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Moon, Sun, Sunset, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type Shift = "dia" | "tarde" | "noche";
export const SHIFT_INFO: Record<Shift, { label: string; short: string; start: string; hours: number; Icon: typeof Sun }> = {
  dia: { label: "Día", short: "D", start: "08:00", hours: 12, Icon: Sun },
  tarde: { label: "Tarde", short: "T", start: "15:00", hours: 8, Icon: Sunset },
  noche: { label: "Noche", short: "N", start: "20:00", hours: 12, Icon: Moon },
};
export const endTime = (start: string, hours: number) => { const [h, m] = start.split(":").map(Number); const t = (h * 60 + m + hours * 60) % 1440; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEK = ["L", "M", "X", "J", "V", "S", "D"];

type Props = {
  guard: { id: number; name: string; baseShift?: string | null };
  companies: { id: number; name: string; active?: boolean }[];
  guards: { id: number; name: string }[];
  colorFor: (companyId: number) => string;
  initialMonth: Date;
  onClose: () => void;
};

/** Ventana para asignar días extra (reemplazos) de un guardia a una o varias empresas, por turno. */
export function ExtrasModal({ guard, companies, guards, colorFor, initialMonth, onClose }: Props) {
  const utils = trpc.useUtils();
  const [month, setMonth] = useState(() => new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shift, setShift] = useState<Shift>("dia");
  const [startTime, setStartTime] = useState(SHIFT_INFO.dia.start);
  const [hours, setHours] = useState(SHIFT_INFO.dia.hours);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [replacedId, setReplacedId] = useState<number | null>(null);

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const ctx = trpc.extras.forGuard.useQuery({ guardId: guard.id, start: key(first), end: key(last) });
  const extras = ctx.data?.extras ?? [];
  const absences = useMemo(() => new Map((ctx.data?.absences ?? []).map(a => [a.date, a.label])), [ctx.data]);
  const byDate = useMemo(() => { const m = new Map<string, typeof extras>(); extras.forEach(e => m.set(e.date, [...(m.get(e.date) ?? []), e])); return m; }, [extras]);
  const activeCompanies = companies.filter(c => c.active !== false);
  const companyName = (id: number) => companies.find(c => c.id === id)?.name ?? "Empresa";
  const countFor = (id: number) => extras.filter(e => e.companyId === id).length;

  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }, [onClose]);

  const pickShift = (s: Shift) => { setShift(s); setStartTime(SHIFT_INFO[s].start); setHours(SHIFT_INFO[s].hours); };
  const refresh = async () => { await Promise.all([utils.extras.forGuard.invalidate(), utils.extras.list.invalidate()]); };

  const assign = trpc.extras.assign.useMutation();
  const remove = trpc.extras.remove.useMutation({ onSuccess: async r => { toast.success(`${r.removed} extra${r.removed === 1 ? "" : "s"} eliminado${r.removed === 1 ? "" : "s"}`); await refresh(); }, onError: e => toast.error(e.message) });

  const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });

  const doAssign = async (confirm = false) => {
    if (!companyId || !selected.size) return;
    try {
      const r = await assign.mutateAsync({ guardId: guard.id, dates: Array.from(selected), shift, startTime, hours, companyId, replacedGuardId: replacedId, confirm });
      if (r.needsConfirmation) {
        const text = r.warnings.map(w => `• ${fmtDay(w.date)}: ${w.reason}`).join("\n");
        if (window.confirm(`Atención antes de asignar:\n\n${text}\n\n¿Asignar de todos modos?`)) return doAssign(true);
        return;
      }
      if (r.saved.length) toast.success(`${r.saved.length} día${r.saved.length === 1 ? "" : "s"} extra asignado${r.saved.length === 1 ? "" : "s"} a ${companyName(companyId)}`, { description: `${SHIFT_INFO[shift].label} ${startTime}–${endTime(startTime, hours)}` });
      if (r.blocked.length) toast.error(`${r.blocked.length} día${r.blocked.length === 1 ? "" : "s"} no asignado${r.blocked.length === 1 ? "" : "s"}`, { description: r.blocked.map(b => `${fmtDay(b.date)}: ${b.reason}`).join(" · ") });
      setSelected(new Set());
      setReplacedId(null);
      await refresh();
    } catch (e: any) { toast.error("No se pudo asignar", { description: e.message }); }
  };

  const toggleDay = (d: string) => {
    if (absences.has(d)) { toast.error("No disponible", { description: `${fmtDay(d)}: ${absences.get(d)}` }); return; }
    const next = new Set(selected);
    if (next.has(d)) next.delete(d); else next.add(d);
    // Al tocar un día que ya tiene extra (y es el único elegido), se cargan su turno y empresa para reasignarlo.
    const own = byDate.get(d);
    if (!selected.size && own?.length) { const e = own[0]; setShift(e.shift); setStartTime(e.startTime); setHours(e.hours); setCompanyId(e.companyId); setReplacedId(e.replacedGuardId ?? null); }
    setSelected(next);
  };

  const selectedExtras = extras.filter(e => selected.has(e.date) && e.shift === shift);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < ((first.getDay() + 6) % 7); i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  const grouped = activeCompanies.map(c => ({ c, items: extras.filter(e => e.companyId === c.id) })).filter(g => g.items.length);
  const today = key(new Date());

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal extras-modal" role="dialog" aria-label={`Días extra de ${guard.name}`}>
        <div className="modal-head">
          <div><p className="eyebrow teal">DÍAS EXTRA · REEMPLAZOS</p><h3>{guard.name}</h3></div>
          <button onClick={onClose} aria-label="Cerrar"><X size={19} /></button>
        </div>
        <div className="extras-layout">
          <section className="extras-calendar">
            <div className="extras-month">
              <button onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); setSelected(new Set()); }} aria-label="Mes anterior"><ChevronLeft size={18} /></button>
              <b>{(() => { const t = month.toLocaleDateString("es-CL", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); })()}</b>
              <button onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); setSelected(new Set()); }} aria-label="Mes siguiente"><ChevronRight size={18} /></button>
            </div>
            <div className="extras-grid">
              {WEEK.map(w => <span key={w} className="extras-wd">{w}</span>)}
              {cells.map((d, i) => {
                if (!d) return <span key={`e${i}`} />;
                const k = key(d), own = byDate.get(k) ?? [], abs = absences.get(k);
                const ofCompany = companyId ? own.some(e => e.companyId === companyId) : false;
                return (
                  <button key={k} type="button" disabled={!!abs} title={abs ? `No disponible: ${abs}` : own.map(e => `${SHIFT_INFO[e.shift].label} ${e.startTime}–${endTime(e.startTime, e.hours)} · ${companyName(e.companyId)}`).join("\n") || "Sin extras"}
                    className={`extras-day ${selected.has(k) ? "sel" : ""} ${abs ? "abs" : ""} ${ofCompany ? "of-company" : ""} ${k === today ? "today" : ""}`}
                    style={ofCompany ? { ["--company-color" as any]: colorFor(companyId!) } : undefined} onClick={() => toggleDay(k)}>
                    <b>{d.getDate()}</b>
                    <span className="extras-day-marks">{own.map(e => <i key={e.id} style={{ background: colorFor(e.companyId) }}>{SHIFT_INFO[e.shift].short}</i>)}</span>
                    {abs && <small>{abs.split(" · ")[0]}</small>}
                  </button>
                );
              })}
            </div>
            <p className="extras-hint">Toca uno o varios días. Los días con borde de color ya están asignados a la empresa elegida. Los días con ausencia del guardia no se pueden usar.</p>
          </section>

          <section className="extras-side">
            <div className="extras-block">
              <h4>Turno</h4>
              <div className="extras-shifts">
                {(Object.keys(SHIFT_INFO) as Shift[]).map(s => { const I = SHIFT_INFO[s].Icon; return <button key={s} type="button" className={shift === s ? "sel" : ""} onClick={() => pickShift(s)}><I size={15} /> {SHIFT_INFO[s].label}</button>; })}
              </div>
              <div className="extras-time">
                <label>Inicio<input type="time" value={startTime} onChange={e => setStartTime(e.target.value || "08:00")} /></label>
                <label>Duración<select value={hours} onChange={e => setHours(Number(e.target.value))}>{[6, 8, 10, 12, 24].map(h => <option key={h} value={h}>{h} h</option>)}</select></label>
                <span>Termina {endTime(startTime, hours)}</span>
              </div>
            </div>

            <div className="extras-block">
              <h4>Empresa <small>{selected.size ? `${selected.size} día${selected.size === 1 ? "" : "s"} elegido${selected.size === 1 ? "" : "s"}` : "elige días en el calendario"}</small></h4>
              <div className="extras-companies">
                {activeCompanies.map(c => (
                  <label key={c.id} className={companyId === c.id ? "sel" : ""} style={{ ["--company-color" as any]: colorFor(c.id) }}>
                    <input type="radio" name="extras-company" checked={companyId === c.id} onChange={() => setCompanyId(c.id)} />
                    <Building2 size={14} /> <span>{c.name}</span>{countFor(c.id) > 0 && <em>{countFor(c.id)}</em>}
                  </label>
                ))}
              </div>
            </div>

            <div className="extras-block">
              <h4>Reemplaza a <small>(opcional)</small></h4>
              <select className="extras-select" value={replacedId ?? ""} onChange={e => setReplacedId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">— Sin indicar —</option>
                {guards.filter(g => g.id !== guard.id).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div className="extras-actions">
              <button className="primary" disabled={!companyId || !selected.size || assign.isPending} onClick={() => doAssign()}>
                {assign.isPending ? "Asignando…" : companyId && selected.size ? `Asignar ${selected.size} día${selected.size === 1 ? "" : "s"} a ${companyName(companyId)}` : "Asignar"}
              </button>
              {selectedExtras.length > 0 && <button className="danger-button" disabled={remove.isPending} onClick={() => { if (window.confirm(`¿Quitar ${selectedExtras.length} extra(s) de ${SHIFT_INFO[shift].label.toLowerCase()} en los días elegidos?`)) { remove.mutate({ ids: selectedExtras.map(e => e.id) }); setSelected(new Set()); } }}><Trash2 size={14} /> Quitar extra de {SHIFT_INFO[shift].label.toLowerCase()}</button>}
            </div>
          </section>
        </div>

        <section className="extras-summary">
          <h4>Asignados en {month.toLocaleDateString("es-CL", { month: "long" })} <small>{extras.length} extra{extras.length === 1 ? "" : "s"}</small></h4>
          {!grouped.length && <p className="extras-hint">Aún no hay días extra este mes.</p>}
          {grouped.map(({ c, items }) => (
            <div key={c.id} className="extras-summary-row" style={{ ["--company-color" as any]: colorFor(c.id) }}>
              <b><Building2 size={13} /> {c.name} <em>{items.length}</em></b>
              <div>{items.map(e => (
                <span key={e.id} className="extras-chip" title={e.replacedGuardId ? `Reemplaza a ${guards.find(g => g.id === e.replacedGuardId)?.name ?? ""}` : undefined}>
                  {fmtDay(e.date)} · {SHIFT_INFO[e.shift].label} {e.startTime}–{endTime(e.startTime, e.hours)}
                  <button aria-label="Quitar" onClick={() => remove.mutate({ ids: [e.id] })}><X size={11} /></button>
                </span>
              ))}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
