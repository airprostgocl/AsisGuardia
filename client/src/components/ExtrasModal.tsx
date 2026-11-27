import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { Building2, ChevronLeft, ChevronRight, Moon, Sun, Sunset, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type Shift = "dia" | "tarde" | "noche";
export const SHIFT_INFO: Record<Shift, { label: string; short: string; start: string; hours: number; Icon: typeof Sun }> = {
  dia: { label: "Día", short: "D", start: "08:00", hours: 12, Icon: Sun },
  tarde: { label: "Tarde", short: "T", start: "14:00", hours: 8, Icon: Sunset },
  noche: { label: "Noche", short: "N", start: "20:00", hours: 12, Icon: Moon },
};
export const endTime = (start: string, hours: number) => { const [h, m] = start.split(":").map(Number); const t = (h * 60 + m + hours * 60) % 1440; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEK = ["L", "M", "X", "J", "V", "S", "D"];
const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** El texto empieza por lo escrito (sin distinguir mayúsculas ni tildes). */
const startsWith = (text: string, q: string) => !q.trim() || norm(text).startsWith(norm(q.trim()));
/** Escribir una letra con la caja seleccionada la lleva al buscador de esa caja. */
function typeAhead(e: ReactKeyboardEvent, set: (v: string) => void, ref: RefObject<HTMLInputElement | null>) {
  const t = e.target as HTMLInputElement;
  if (t === ref.current || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || !/\S/.test(e.key)) return;
  e.preventDefault(); set(e.key); ref.current?.focus();
}

type Props = {
  guard: { id: number; name: string; baseShift?: string | null };
  companies: { id: number; name: string; active?: boolean }[];
  guards: { id: number; name: string; baseShift?: string | null; shiftStart?: string | null; shiftEnd?: string | null }[];
  companyOfGuard?: (guardId: number) => string;
  companyIdOfGuard?: (guardId: number) => number | null;
  /** Guardias que se pueden elegir para asignar extras (por defecto, todos). */
  selectableGuards?: { id: number; name: string; baseShift?: string | null }[];
  colorFor: (companyId: number) => string;
  initialMonth: Date;
  onClose: () => void;
};

/** Ventana para asignar días extra (reemplazos) de un guardia a una o varias empresas, por turno. */
export function ExtrasModal({ guard: initialGuard, companies, guards, colorFor, initialMonth, onClose, companyOfGuard, companyIdOfGuard, selectableGuards }: Props) {
  const [guard, setGuard] = useState(initialGuard);
  const [guardQuery, setGuardQuery] = useState<string | null>(null); // null = mostrando el nombre actual
  const pickable = (selectableGuards ?? guards).filter(g => startsWith(g.name, guardQuery ?? ""));
  const utils = trpc.useUtils();
  const [month, setMonth] = useState(() => new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shift, setShift] = useState<Shift>("dia");
  const [startTime, setStartTime] = useState(SHIFT_INFO.dia.start);
  const [hours, setHours] = useState(SHIFT_INFO.dia.hours);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [replacedId, setReplacedId] = useState<number | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [personSearch, setPersonSearch] = useState("");
  const companySearchRef = useRef<HTMLInputElement>(null);
  const personSearchRef = useRef<HTMLInputElement>(null);

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

  const switchGuard = (g: { id: number; name: string; baseShift?: string | null }) => {
    setGuard(g); setGuardQuery(null); setSelected(new Set()); setReplacedId(null); setPersonSearch("");
    (document.activeElement as HTMLElement | null)?.blur();
  };
  const pickShift = (s: Shift) => { setShift(s); setStartTime(SHIFT_INFO[s].start); setHours(SHIFT_INFO[s].hours); };
  const refresh = async () => { await Promise.all([utils.extras.forGuard.invalidate(), utils.extras.list.invalidate()]); };

  const assign = trpc.extras.assign.useMutation();
  const remove = trpc.extras.remove.useMutation({ onSuccess: async r => { toast.success(`${r.removed} extra${r.removed === 1 ? "" : "s"} eliminado${r.removed === 1 ? "" : "s"}`); await refresh(); }, onError: e => toast.error(e.message) });

  const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });

  const doAssign = async (confirm = false) => {
    const targetCompany = (replacedId ? companyIdOfGuard?.(replacedId) : null) ?? companyId;
    if (!targetCompany || !selected.size || !replacedId) return;
    try {
      const r = await assign.mutateAsync({ guardId: guard.id, dates: Array.from(selected), shift, startTime, hours, companyId: targetCompany, replacedGuardId: replacedId, confirm });
      if (r.needsConfirmation) {
        const text = r.warnings.map(w => `• ${fmtDay(w.date)}: ${w.reason}`).join("\n");
        if (window.confirm(`Atención antes de asignar:\n\n${text}\n\n¿Asignar de todos modos?`)) return doAssign(true);
        return;
      }
      if (r.saved.length && r.substituted) toast.info("Reemplazante cambiado", { description: `Se quitó el extra anterior (${r.substituted}) y quedó ${guard.name} como reemplazo.` });
      if (r.saved.length) toast.success(`${r.saved.length} día${r.saved.length === 1 ? "" : "s"} extra asignado${r.saved.length === 1 ? "" : "s"} a ${companyName(targetCompany)}`, { description: `${SHIFT_INFO[shift].label} ${startTime}–${endTime(startTime, hours)}` });
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

  const selDates = useMemo(() => Array.from(selected).sort(), [selected]);
  const absentQ = trpc.extras.absentOn.useQuery({ dates: selDates }, { enabled: selDates.length > 0 });
  const candidates = useMemo(() => (absentQ.data ?? [])
    .filter(a => a.guardId !== guard.id && selDates.every(d => a.absences.some(x => x.date === d)))
    .map(a => ({ ...a, name: guards.find(g => g.id === a.guardId)?.name ?? "Guardia", baseShift: guards.find(g => g.id === a.guardId)?.baseShift ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, "es")), [absentQ.data, selDates, guards, guard.id]);
  // Si el reemplazado elegido deja de estar ausente en los días elegidos, se limpia.
  useEffect(() => { if (replacedId && absentQ.data && !candidates.some(c => c.guardId === replacedId)) setReplacedId(null); }, [candidates, replacedId, absentQ.data]);
  const visibleCandidates = candidates.filter(c => (!companyId || companyIdOfGuard?.(c.guardId) === companyId) && startsWith(c.name, personSearch));
  const pickCompany = (id: number | null) => {
    setCompanyId(id);
    if (replacedId && id && companyIdOfGuard?.(replacedId) !== id) setReplacedId(null);
  };
  const replacedShift = (candidates.find(c => c.guardId === replacedId)?.baseShift ?? null) as Shift | null;
  const lockedShift = replacedShift && SHIFT_INFO[replacedShift] ? replacedShift : null;
  const lockedCompanyId = replacedId ? (companyIdOfGuard?.(replacedId) ?? null) : null;
  useEffect(() => { if (lockedCompanyId) setCompanyId(lockedCompanyId); }, [lockedCompanyId]);
  // Al elegir al ausente se cargan su turno y su horario exacto (definidos en su ficha).
  useEffect(() => {
    if (!replacedId) return;
    const r = guards.find(g => g.id === replacedId);
    if (lockedShift) setShift(lockedShift);
    if (r?.shiftStart && r?.shiftEnd) {
      const [sh, sm] = r.shiftStart.split(":").map(Number), [eh, em] = r.shiftEnd.split(":").map(Number);
      const diff = ((eh * 60 + em) - (sh * 60 + sm) + 1440) % 1440 || 1440;
      setStartTime(r.shiftStart); setHours(Math.round(diff / 60));
    } else if (lockedShift) { setStartTime(SHIFT_INFO[lockedShift].start); setHours(SHIFT_INFO[lockedShift].hours); }
  }, [replacedId, lockedShift]); // eslint-disable-line react-hooks/exhaustive-deps
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
          <div className="extras-guard-pick">
            <p className="eyebrow teal">DÍAS EXTRA · REEMPLAZOS</p>
            <div className="guard-combo">
              <input className="guard-combo-input" value={guardQuery ?? guard.name} placeholder="Buscar guardia…" aria-label="Guardia al que se asignan extras"
                onFocus={e => { setGuardQuery(""); e.currentTarget.select(); }}
                onChange={e => setGuardQuery(e.target.value)}
                onBlur={() => setTimeout(() => setGuardQuery(null), 150)}
                onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); setGuardQuery(null); (e.target as HTMLInputElement).blur(); } if (e.key === "Enter" && pickable[0]) switchGuard(pickable[0]); }} />
              {guardQuery !== null && (
                <div className="guard-combo-list" role="listbox">
                  {pickable.slice(0, 60).map(g => (
                    <button key={g.id} type="button" role="option" aria-selected={g.id === guard.id} className={g.id === guard.id ? "sel" : ""} onMouseDown={e => { e.preventDefault(); switchGuard(g); }}>
                      <i style={{ background: colorFor(companyIdOfGuard?.(g.id) ?? 0) }} /> <b>{g.name}</b> <small>{companyOfGuard?.(g.id) ?? ""}</small>
                    </button>
                  ))}
                  {!pickable.length && <p className="extras-hint">Ningún guardia empieza por «{guardQuery}».</p>}
                </div>
              )}
            </div>
            <small className="guard-combo-hint">Haz clic en el nombre para cambiar de guardia.</small>
          </div>
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
            <div className="extras-pick-grid">
              <div className="extras-block">
                <h4><span className="step">1</span> Empresa <small>filtro</small></h4>
                <div className="pick-box" onKeyDown={e => typeAhead(e, setCompanySearch, companySearchRef)}>
                  <input ref={companySearchRef} type="search" className="pick-search" placeholder="Buscar empresa…" value={companySearch} onChange={e => setCompanySearch(e.target.value)} />
                  <div className="extras-companies">
                    <label className={!companyId ? "sel" : ""} style={{ ["--company-color" as any]: "#9fb3ab" }}>
                      <input type="radio" name="extras-company" checked={!companyId} onChange={() => pickCompany(null)} />
                      <Building2 size={14} /> <span>Todas las empresas</span>{selDates.length > 0 && <em>{candidates.length}</em>}
                    </label>
                    {activeCompanies
                      .filter(c => startsWith(c.name, companySearch))
                      .map(c => ({ c, n: candidates.filter(x => companyIdOfGuard?.(x.guardId) === c.id).length }))
                      // Primero las empresas con ausentes en los días elegidos (más ausentes arriba); luego el resto.
                      .sort((a, b) => Number(b.n > 0) - Number(a.n > 0) || b.n - a.n || a.c.name.localeCompare(b.c.name, "es"))
                      .map(({ c, n }) => (
                        <label key={c.id} className={`${companyId === c.id ? "sel" : ""} ${n > 0 ? "has-absent" : ""}`} style={{ ["--company-color" as any]: colorFor(c.id) }}>
                          <input type="radio" name="extras-company" checked={companyId === c.id} onChange={() => pickCompany(c.id)} />
                          <Building2 size={14} /> <span>{c.name}</span>{selDates.length > 0 && n > 0 && <em title="Ausentes en los días elegidos">{n}</em>}
                        </label>
                      ))}
                  </div>
                </div>
              </div>

              <div className="extras-block">
                <h4><span className="step">2</span> Reemplaza a <small>obligatorio · ausentes</small></h4>
                <div className="pick-box" onKeyDown={e => typeAhead(e, setPersonSearch, personSearchRef)}>
                  <input ref={personSearchRef} type="search" className="pick-search" placeholder="Buscar persona…" value={personSearch} onChange={e => setPersonSearch(e.target.value)} disabled={!selDates.length} />
                  {!selDates.length ? <p className="extras-hint pick-empty">Primero elige los días en el calendario.</p>
                    : absentQ.isLoading ? <p className="extras-hint pick-empty">Buscando ausentes…</p>
                    : !candidates.length ? <p className="extras-warn">Nadie tiene ausencia registrada en {selDates.length === 1 ? "ese día" : "todos los días elegidos"}. Registra primero la ausencia en Control semanal, o elige días de una misma ausencia.</p>
                    : !visibleCandidates.length ? <p className="extras-hint pick-empty">Sin ausentes {companyId ? `en ${companyName(companyId)}` : ""}{personSearch ? ` que empiecen por «${personSearch}»` : ""}.</p>
                    : <div className="extras-replaced">{visibleCandidates.map(c => (
                        <label key={c.guardId} className={replacedId === c.guardId ? "sel" : ""} style={{ ["--company-color" as any]: colorFor(companyIdOfGuard?.(c.guardId) ?? 0) }}>
                          <input type="radio" name="extras-replaced" checked={replacedId === c.guardId} onChange={() => setReplacedId(c.guardId)} />
                          <span><b>{c.name}</b><small>{companyOfGuard?.(c.guardId) ?? ""}{c.baseShift && SHIFT_INFO[c.baseShift as Shift] ? ` · ${SHIFT_INFO[c.baseShift as Shift].label.toLowerCase()}` : ""} · {Array.from(new Set(c.absences.filter(x => selDates.includes(x.date)).map(x => x.label))).join(", ")}</small></span>
                        </label>
                      ))}</div>}
                </div>
              </div>
            </div>
            {lockedCompanyId && <p className="extras-lock">El extra se hace en el puesto del ausente: <b>{companyName(lockedCompanyId)}</b>.</p>}

            <div className="extras-block">
              <h4><span className="step">3</span> Turno y horario <small>del ausente</small></h4>
              <div className="extras-shifts">
                {(Object.keys(SHIFT_INFO) as Shift[]).map(s => { const I = SHIFT_INFO[s].Icon; return <button key={s} type="button" className={shift === s ? "sel" : ""} disabled={!!lockedShift && lockedShift !== s} title={lockedShift && lockedShift !== s ? "El extra debe ser del turno del guardia ausente" : undefined} onClick={() => pickShift(s)}><I size={15} /> {SHIFT_INFO[s].label}</button>; })}
              </div>
              <div className="extras-time">
                <label>Inicio<input type="time" value={startTime} onChange={e => setStartTime(e.target.value || "08:00")} /></label>
                <label>Duración<select value={hours} onChange={e => setHours(Number(e.target.value))}>{Array.from({ length: 24 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h} h</option>)}</select></label>
                <span>Termina {endTime(startTime, hours)}</span>
              </div>
            </div>

            <div className="extras-actions">
              <button className="primary" disabled={!(lockedCompanyId ?? companyId) || !selected.size || !replacedId || assign.isPending} onClick={() => doAssign()}>
                {assign.isPending ? "Asignando…" : (lockedCompanyId ?? companyId) && selected.size && replacedId ? `Asignar ${selected.size} día${selected.size === 1 ? "" : "s"} a ${companyName((lockedCompanyId ?? companyId)!)}` : "Asignar"}
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
                <span key={e.id} className="extras-chip">
                  {fmtDay(e.date)} · {SHIFT_INFO[e.shift].label} {e.startTime}–{endTime(e.startTime, e.hours)}{e.replacedGuardId ? <em className="extras-chip-rep">↔ {guards.find(g => g.id === e.replacedGuardId)?.name ?? "—"}</em> : <em className="extras-chip-rep missing">sin reemplazado</em>}
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
