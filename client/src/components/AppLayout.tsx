import { useState, type ReactNode } from "react";
import { Building2, CalendarDays, ChevronDown, ClipboardList, FileText, ShieldCheck, Trash2, UserRound, UsersRound } from "lucide-react";
import { MyAccountCard, SupervisorAdminCard } from "@/components/SupervisorAccounts";

export type View = "week" | "mobile" | "guards" | "reports" | "sites" | "account" | "supervisors";

/** Título y descripción de cada sección (encabezado superior). */
export const VIEW_META: Record<View, { title: string; group: string }> = {
  week: { title: "Control semanal", group: "OPERACIÓN" },
  mobile: { title: "Marcación rápida", group: "OPERACIÓN" },
  guards: { title: "Guardias", group: "GESTIÓN" },
  reports: { title: "Reportes", group: "GESTIÓN" },
  sites: { title: "Empresas y puntos", group: "CONFIGURACIÓN" },
  account: { title: "Mi cuenta", group: "CONFIGURACIÓN" },
  supervisors: { title: "Supervisores", group: "CONFIGURACIÓN" },
};

const NAV: { group: string; items: { view: View; label: string; icon: typeof CalendarDays; adminOnly?: boolean }[] }[] = [
  { group: "OPERACIÓN", items: [
    { view: "week", label: "Control semanal", icon: CalendarDays },
    { view: "mobile", label: "Marcación rápida", icon: ClipboardList },
  ] },
  { group: "GESTIÓN", items: [
    { view: "guards", label: "Guardias", icon: UsersRound },
    { view: "reports", label: "Reportes", icon: FileText },
  ] },
  { group: "CONFIGURACIÓN", items: [
    { view: "sites", label: "Empresas y puntos", icon: Building2 },
    { view: "account", label: "Mi cuenta", icon: UserRound },
    { view: "supervisors", label: "Supervisores", icon: ShieldCheck, adminOnly: true },
  ] },
];

/** Menú lateral agrupado. «Supervisores» solo aparece para el administrador. */
export function NavMenu({ view, isAdmin, onGo }: { view: View; isAdmin: boolean; onGo: (v: View) => void }) {
  return (
    <nav className="nav-groups" aria-label="Menú principal">
      {NAV.map(section => (
        <div className="nav-group" key={section.group}>
          <div className="side-label">{section.group}</div>
          {section.items.filter(item => !item.adminOnly || isAdmin).map(item => {
            const Icon = item.icon;
            return (
              <button key={item.view} className={`nav-item ${view === item.view ? "active" : ""}`} aria-current={view === item.view ? "page" : undefined} onClick={() => onGo(item.view)}>
                <Icon size={18} /> <span>{item.label}</span>{item.adminOnly && <em className="nav-badge">Admin</em>}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Tarjeta con encabezado que se puede plegar o desplegar. */
export function CollapsibleCard({ title, summary, defaultOpen = false, className = "", children }: { title: string; summary?: ReactNode; defaultOpen?: boolean; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`admin-card collapsible-card ${open ? "open" : ""} ${className}`}>
      <button type="button" className="collapsible-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span><h3>{title}</h3>{summary && <small>{summary}</small>}</span>
        <span className="collapsible-toggle">{open ? "Ocultar" : "Ver"} <ChevronDown size={15} /></span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

function PageIntro({ eyebrow, text, action }: { eyebrow: string; title?: string; text: string; action?: ReactNode }) {
  return (
    <div className="page-intro">
      <div><p className="eyebrow teal">{eyebrow}</p><p className="page-intro-text">{text}</p></div>
      {action}
    </div>
  );
}

export function AccountPanel({ supervisor }: { supervisor: any }) {
  return (
    <section className="admin-page">
      <PageIntro eyebrow="CONFIGURACIÓN" title="Mi cuenta" text="Tus datos de acceso y tu contraseña. Registra tu correo para poder recuperarla si la olvidas." />
      <div className="account-layout"><MyAccountCard supervisor={supervisor} /></div>
    </section>
  );
}

export function SupervisorsPanel({ currentId }: { currentId: number }) {
  return (
    <section className="admin-page">
      <PageIntro eyebrow="ADMINISTRACIÓN" title="Supervisores" text="Crea cuentas, asigna contraseñas temporales, desactiva o restablece el acceso de cada supervisor." />
      <div className="admin-grid"><SupervisorAdminCard currentId={currentId} /></div>
    </section>
  );
}

type SitesProps = {
  sites: any[]; companies: any[]; assignedSiteIds: number[]; savingSite: boolean;
  onCreateSite: (x: any) => void; onAssignSite: (siteId: number, assigned: boolean) => void;
  onArchive: (id: number, active: boolean) => void; onDelete: (id: number) => void; onDeleteCompany: (ids: number[], name: string) => void; onClearDemo: () => void;
};

type CompanyGroup = { key: string; companyId: number | null; name: string; companyRow: any | null; points: any[]; allRows: any[] };

/** Agrupa los sitios por empresa: la fila sin punto representa a la empresa; las demás son sus puntos (opcionales). */
function groupByCompany(rows: any[]): CompanyGroup[] {
  const groups: CompanyGroup[] = [];
  for (const x of rows) {
    let g = groups.find(g => (g.companyId && g.companyId === x.companyId) || (!g.companyId && !x.companyId && g.name === x.companyName));
    if (!g) { g = { key: String(x.companyId ?? x.companyName), companyId: x.companyId ?? null, name: x.companyName, companyRow: null, points: [], allRows: [] }; groups.push(g); }
    g.allRows.push(x);
    if (x.siteName) g.points.push(x); else if (!g.companyRow) g.companyRow = x;
  }
  return groups.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function SitesPanel({ sites, companies, assignedSiteIds, savingSite, onCreateSite, onAssignSite, onArchive, onDelete, onDeleteCompany, onClearDemo }: SitesProps) {
  const [company, setCompany] = useState("");
  const [site, setSite] = useState("");
  const activeSites = sites.filter(x => x.active);
  const groups = groupByCompany(activeSites);
  const registry = groupByCompany(sites);
  const isAssigned = (x: any) => assignedSiteIds.includes(x.id);
  // Una empresa cuenta como «mía» si tengo la empresa completa o alguno de sus puntos.
  const companyChecked = (g: CompanyGroup) => g.companyRow ? isAssigned(g.companyRow) : g.points.length > 0 && g.points.every(isAssigned);
  const companyPartial = (g: CompanyGroup) => !companyChecked(g) && g.allRows.some(isAssigned);
  const toggleCompany = (g: CompanyGroup, checked: boolean) => {
    if (g.companyRow) onAssignSite(g.companyRow.id, checked);
    else g.points.filter(p => isAssigned(p) !== checked).forEach(p => onAssignSite(p.id, checked));
  };
  const myCompanies = groups.filter(g => g.allRows.some(isAssigned)).length;
  const archivedCompanies = registry.filter(g => g.allRows.every(x => !x.active)).length;

  return (
    <section className="admin-page">
      <PageIntro eyebrow="CONFIGURACIÓN OPERATIVA" title="Empresas y puntos" text="Las empresas son la base para ubicar a tus guardias. Los puntos de vigilancia son opcionales: solo para empresas que quieran registrar lugares dentro de sus instalaciones." />
      <div className="admin-grid">
        <div className="admin-card sites-add-card">
          <h3>Agregar empresa</h3>
          <p className="admin-help">Escribe el nombre de la empresa. Si además quieres registrar puntos de vigilancia dentro de ella, agrégalos en el segundo campo; también puedes añadirlos más tarde escribiendo el nombre de una empresa existente.</p>
          <div className="form-grid">
            <label>Empresa (nueva o existente)
              <input list="company-options" placeholder="Ej. Empresa Los Andes" value={company} onChange={e => setCompany(e.target.value)} />
              <datalist id="company-options">{companies.map((x: any) => <option key={x.id} value={x.name} />)}</datalist>
            </label>
            <label>Puntos de vigilancia dentro de la empresa <span className="optional-label">(opcional · uno por línea o separados por coma)</span>
              <textarea rows={3} placeholder={"Torre Norte\nBodega Central"} value={site} onChange={e => setSite(e.target.value)} />
            </label>
          </div>
          <button type="button" className="primary site-save-button" disabled={savingSite || !company.trim()} onClick={() => { onCreateSite({ companyName: company.trim(), siteName: site.trim() || null }); setCompany(""); setSite(""); }}>
            {savingSite ? "Guardando…" : site.trim() ? "Agregar empresa y puntos" : "Agregar empresa"}
          </button>
        </div>

        <CollapsibleCard className="my-sites-card" title="Mis empresas" summary={`${myCompanies} de ${groups.length} empresas seleccionadas para ti`} defaultOpen={groups.length <= 8}>
          <p className="admin-help">Marca las empresas que visitas o cubres. Si una empresa tiene puntos de vigilancia, puedes marcar también los puntos específicos.</p>
          <div className="company-list">
            {groups.map(g => (
              <div className={`company-item ${g.allRows.some(isAssigned) ? "is-mine" : ""}`} key={g.key}>
                <label className="company-check">
                  <input type="checkbox" checked={companyChecked(g)} ref={el => { if (el) el.indeterminate = companyPartial(g); }} onChange={e => toggleCompany(g, e.target.checked)} />
                  <span><b>{g.name}</b><small>{g.points.length ? `${g.points.length} punto${g.points.length === 1 ? "" : "s"} de vigilancia` : "Sin puntos de vigilancia"}</small></span>
                </label>
                {g.points.length > 0 && (
                  <div className="point-list">
                    <span className="point-list-label">Puntos (opcional)</span>
                    {g.points.map(p => (
                      <label className="point-check" key={p.id}>
                        <input type="checkbox" checked={isAssigned(p)} onChange={e => onAssignSite(p.id, e.target.checked)} />
                        <span>{p.siteName}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {!groups.length && <small>No hay empresas activas todavía. Crea la primera arriba.</small>}
        </CollapsibleCard>

        <CollapsibleCard className="registry-card" title="Registro de empresas" summary={`${registry.length - archivedCompanies} activas${archivedCompanies ? ` · ${archivedCompanies} archivadas` : ""} · archivar o eliminar`}>
          <div className="registry-list">
            {registry.map(g => {
              const companyActive = g.allRows.some(x => x.active);
              return (
                <div className={`registry-company ${!companyActive ? "archived" : ""}`} key={g.key}>
                  <div className="registry-company-head">
                    <div><b>{g.name}</b><span>{companyActive ? "Activa" : "Archivada"} · {g.points.length ? `${g.points.length} punto${g.points.length === 1 ? "" : "s"}` : "sin puntos"}</span></div>
                    <div className="registry-actions">
                      <button className="outline" onClick={() => g.allRows.filter(x => x.active === companyActive).forEach(x => onArchive(x.id, !companyActive))}>{companyActive ? "Archivar empresa" : "Reactivar empresa"}</button>
                      <button className="danger-button" onClick={() => onDeleteCompany(g.allRows.map(x => x.id), g.name)}>Eliminar empresa</button>
                    </div>
                  </div>
                  {g.points.map(p => (
                    <div className={`registry-point ${!p.active ? "archived" : ""}`} key={p.id}>
                      <span>↳ {p.siteName}<small>{p.active ? "Activo" : "Archivado"}</small></span>
                      <div className="registry-actions">
                        <button className="outline small" onClick={() => onArchive(p.id, !p.active)}>{p.active ? "Archivar" : "Reactivar"}</button>
                        <button className="danger-button small" onClick={() => onDelete(p.id)}>Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {!registry.length && <small>No hay empresas registradas.</small>}
          </div>
        </CollapsibleCard>

        <div className="admin-card maintenance-card">
          <div><h3><Trash2 size={16} /> Datos de prueba</h3><p className="admin-help">Elimina los guardias, empresas, puntos y marcaciones de demostración. Tus datos reales no se tocan.</p></div>
          <button className="danger-button" onClick={onClearDemo}>Limpiar datos de prueba</button>
        </div>
      </div>
    </section>
  );
}
