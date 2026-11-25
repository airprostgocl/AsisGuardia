import { History } from "lucide-react";
import { trpc } from "@/lib/trpc";

/** Historial de una casilla (solo administrador): quién cambió la marcación, cuándo y de qué a qué. */
export function MarkHistory({ guardId, date }: { guardId: number; date: string }) {
  const history = trpc.supervisors.markHistory.useQuery({ guardId, recordDate: date });
  return (
    <div className="mark-history" onClick={e => e.stopPropagation()}>
      <p className="mark-history-title"><History size={13} /> Historial (solo administrador)</p>
      {history.isLoading && <small>Cargando…</small>}
      {history.data && !history.data.length && <small>Sin cambios registrados. Las marcaciones anteriores a esta función no tienen autor.</small>}
      {history.data?.map(h => (
        <div className="mark-history-row" key={h.id}>
          <b>{h.changedByName}</b>
          <span>{h.from} → {h.to}</span>
          <small>{new Date(h.changedAt).toLocaleString("es-CL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</small>
        </div>
      ))}
    </div>
  );
}
