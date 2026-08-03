import { type CSSProperties, type ReactNode } from 'react';
import { NavLink } from 'react-router';

/** One authenticated workbench destination rendered by the shared responsive navigation frame. */
export interface WorkbenchRoute {
  path: string;
  label: ReactNode;
  icon?: ReactNode;
  end?: boolean;
  ariaLabel?: string;
}

/**
 * Slots owned by a product around the shared workbench layout.
 *
 * The shell deliberately does not own authentication, preferences, account state, chat, or modal
 * content. Products supply those controls as slots while this package owns the frame, navigation
 * semantics, responsive layout classes, and main-content landmark.
 */
export interface WorkbenchShellProps {
  brand: ReactNode;
  routes: WorkbenchRoute[];
  navigationLabel: string;
  children: ReactNode;
  sidebarFooter?: ReactNode;
  headerLead?: ReactNode;
  headerActions?: ReactNode;
  overlays?: ReactNode;
  mainId?: string;
  className?: string;
}

/** Shared CAOS frame for authenticated consoles with desktop sidebar and mobile bottom navigation. */
export function WorkbenchShell({
  brand,
  routes,
  navigationLabel,
  children,
  sidebarFooter,
  headerLead,
  headerActions,
  overlays,
  mainId = 'main-content',
  className,
}: WorkbenchShellProps) {
  const rootClassName = ['caos-workbench-shell', 'app-shell', className].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      <aside
        className="caos-workbench-sidebar sidebar"
        style={{ '--caos-workbench-route-count': routes.length } as CSSProperties}
      >
        {brand}
        <nav aria-label={navigationLabel}>
          {routes.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              end={route.end ?? route.path === '/'}
              aria-label={route.ariaLabel}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {route.icon}
              <span>{route.label}</span>
            </NavLink>
          ))}
        </nav>
        {sidebarFooter}
      </aside>

      <div className="caos-workbench-main shell-main">
        <header className="caos-workbench-header topbar">
          {headerLead}
          {headerActions}
        </header>
        <main id={mainId} className="caos-workbench-content content">
          {children}
        </main>
      </div>

      {overlays}
    </div>
  );
}
