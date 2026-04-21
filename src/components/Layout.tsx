import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

interface LayoutProps {
  title?: string;
  children: ReactNode;
  right?: ReactNode;
  showBack?: boolean;
}

export function Layout({ title = 'Pilot Logbook', children, right, showBack }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="app-shell">
      <header className="top-bar">
        {showBack ? (
          <button
            className="icon-btn"
            aria-label="Back"
            onClick={() => navigate(-1)}
          >
            <BackIcon />
          </button>
        ) : (
          <button
            className="icon-btn"
            aria-label="Menu"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>
        )}
        <h1 className="top-bar__title">{title}</h1>
        <div style={{ width: 40, display: 'flex', justifyContent: 'flex-end' }}>
          {right}
        </div>
      </header>

      {menuOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />
          <nav className="drawer" aria-label="Main menu">
            <h3>Menu</h3>
            <div className="stack-sm">
              <NavLink to="/" end onClick={() => setMenuOpen(false)}>
                Home
              </NavLink>
              <NavLink to="/logs" onClick={() => setMenuOpen(false)}>
                Saved Logs
              </NavLink>
              <NavLink to="/profile" onClick={() => setMenuOpen(false)}>
                Profile
              </NavLink>
              <NavLink to="/settings" onClick={() => setMenuOpen(false)}>
                Settings
              </NavLink>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              <p className="note">
                Local-first app. Data stays on this device. Use{' '}
                <Link to="/settings" onClick={() => setMenuOpen(false)}>
                  Settings
                </Link>{' '}
                to manage theme and backups.
              </p>
              <small style={{ color: 'var(--text-muted)' }}>
                {location.pathname}
              </small>
            </div>
          </nav>
        </>
      )}

      <main>{children}</main>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
