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
  onArchive: (id: number, active: boolean) => void; onDelete: (id: number) => void; onClearDemo: () => void;
};

export function SitesPanel({ sites, companies, assignedSiteIds, savingSite, onCreateSite, onAssignSite, onArchive, onDelete, onClearDemo }: SitesProps) {
  const [company, setCompany] = useState("");
  const [site, setSite] = useState("");
  const activeSites = sites.filter(x => x.active);
  const siteGroups = activeSites.reduce((groups: any[], x: any) => {
    let group = groups.find(g => g.companyId === x.companyId || (!g.companyId && !x.companyId && g.companyName === x.companyName));
    if (!group) { group = { companyId: x.companyId, companyName: x.companyName, sites: [] }; groups.push(group); }
    group.sites.push(x);
    return groups;
  }, []);
  const selectedCount = activeSites.filter(x => assignedSiteIds.includes(x.id)).length;
  const archivedCount = sites.length - activeSites.length;

  return (
    <section className="admin-page">
      <PageIntro eyebrow="CONFIGURACIÓN OPERATIVA" title="Empresas y puntos" text="Agrega empresas y puntos de vigilancia, y marca los que tú visitas o cubres." />
      <div className="admin-grid">
        <div className="admin-card sites-add-card">
          <h3>Agregar empresa o punto</h3>
          <p className="admin-help">Si te asignan una empresa nueva, escríbela aquí. El punto es opcional: puedes guardar solo la empresa o agregar empresa y punto.</p>
          <div className="form-grid">
            <label>Empresa nueva o existente
              <input list="company-options" placeholder="Ej. Empresa Los Andes" value={company} onChange={e => setCompany(e.target.value)} />
              <datalist id="company-options">{companies.map((x: any) => <option key={x.id} value={x.name} />)}</datalist>
            </label>
            <label>Puntos de vigilancia <span className="optional-label">(opcional · uno por línea o separados por coma)</span>
              <textarea rows={3} placeholder={"Torre Norte\nBodega Central\nParque Industrial"} value={site} onChange={e => setSite(e.target.value)} />
            </label>
          </div>
          <button type="button" className="primary site-save-button" disabled={savingSite || !company.trim()} onClick={() => { onCreateSite({ companyName: company.trim(), siteName: site.trim() || null }); setCompany(""); setSite(""); }}>
            {savingSite ? "Guardando…" : site.trim() ? "Agregar empresa y punto" : "Agregar empresa"}
          </button>
        </div>

        <CollapsibleCard className="my-sites-card" title="Mis empresas y puntos" summary={`${selectedCount} de ${activeSites.length} puntos seleccionados para ti`} defaultOpen={activeSites.length <= 6}>
          <p className="admin-help">Marca una o varias empresas y sus puntos. Las empresas nuevas que agregues quedan seleccionadas automáticamente para ti.</p>
          <div className="my-sites-list grouped-sites">
            {siteGroups.map((group: any) => (
              <div className="company-group" key={`${group.companyId || group.companyName}`}>
                <strong className="company-group-title">{group.companyName}</strong>
                {group.sites.map((x: any) => (
                  <label className="my-site-option" key={x.id}>
                    <input type="checkbox" checked={assignedSiteIds.includes(x.id)} onChange={e => onAssignSite(x.id, e.target.checked)} />
                    <span><b>{x.siteName || "Empresa sin punto específico"}</b><small>{x.siteName ? "Punto de vigilancia" : "La empresa completa"}</small></span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          {!siteGroups.length && <small>No hay empresas o puntos activos todavía. Crea el primero arriba.</small>}
        </CollapsibleCard>

        <CollapsibleCard className="registry-card" title="Registro de sitios" summary={`${activeSites.length} activos${archivedCount ? ` · ${archivedCount} archivados` : ""} · archivar o eliminar`}>
          <div className="site-list">
            {sites.map(x => (
              <div className={`site-row ${!x.active ? "archived" : ""}`} key={x.id}>
                <div><b>{x.companyName} · {x.siteName || "Sede principal"}</b><span>{x.active ? "Activo" : "Archivado"} · {assignedSiteIds.includes(x.id) ? "Seleccionado para mí" : "No seleccionado"}</span></div>
                <div>
                  <button className="outline" onClick={() => onArchive(x.id, !x.active)}>{x.active ? "Archivar" : "Reactivar"}</button>
                  <button className="danger-button" onClick={() => onDelete(x.id)}>Eliminar definitivamente</button>
                </div>
              </div>
            ))}
            {!sites.length && <small>No hay sitios registrados.</small>}
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
