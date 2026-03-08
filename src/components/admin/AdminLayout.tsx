import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const CONTENT_NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/students', label: 'Students', end: false },
  { to: '/admin/levels', label: 'Levels', end: false },
  { to: '/admin/lessons', label: 'Lessons', end: false },
];

const TOOLS_NAV = [
  { to: '/admin/palettes', label: 'Palettes', end: true },
  { to: '/admin/email', label: 'Email', end: true },
  { to: '/admin/theme', label: 'Theme Editor', end: false },
  { to: '/admin/validate', label: 'Validator', end: false },
  { to: '/admin/analytics', label: 'Analytics', end: false },
  { to: '/admin/onboarding', label: 'AI Onboarding', end: true },
  { to: '/admin/notifications', label: 'Notifications', end: true },
  { to: '/admin/triage', label: 'Triage Agent', end: true },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) => `
  px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
  ${isActive ? 'bg-purple-soft text-purple' : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'}
`;

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="h-full w-full overflow-hidden flex flex-col md:flex-row bg-bg-primary">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-bg-card border-b border-border flex-shrink-0">
        <div className="relative group">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="pointer-events-none absolute top-full left-0 mt-1.5 px-2 py-1 rounded-md bg-bg-card border border-border text-[10px] font-mono text-text-primary whitespace-nowrap opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
            Open menu
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-soft flex items-center justify-center">
            <span className="text-purple text-xs font-bold font-mono">&gt;_</span>
          </div>
          <span className="text-sm font-mono font-semibold text-text-primary">Admin</span>
        </div>
      </div>

      {/* Mobile drawer backdrop */}
      {mobileDrawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`
          md:hidden fixed inset-y-0 left-0 z-50 w-64
          bg-bg-card border-r border-border
          transition-transform duration-300 ease-in-out
          ${mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-soft flex items-center justify-center">
                <span className="text-purple text-xs font-bold font-mono">&gt;_</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary font-mono">Admin</p>
                <p className="text-[10px] text-text-muted">{user?.displayName}</p>
              </div>
            </div>
            <div className="relative group">
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span className="pointer-events-none absolute top-full right-0 mt-1.5 px-2 py-1 rounded-md bg-bg-card border border-border text-[10px] font-mono text-text-primary whitespace-nowrap opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                Close menu
              </span>
            </div>
          </div>

          <nav className="flex flex-col gap-1 flex-1">
            {CONTENT_NAV.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
            <div className="my-2 border-t border-border" />
            <p className="px-3 pt-1 pb-1 text-[10px] font-mono text-text-muted uppercase tracking-wider">Tools</p>
            {TOOLS_NAV.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="pt-4 border-t border-border">
            <NavLink to="/" className="block px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors">
              Back to app
            </NavLink>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 lg:w-64 bg-bg-card border-r border-border flex-shrink-0 flex-col p-6 pl-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-purple-soft flex items-center justify-center">
            <span className="text-purple text-xs font-bold font-mono">&gt;_</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary font-mono">Admin</p>
            <p className="text-[10px] text-text-muted">{user?.displayName}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {CONTENT_NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
          <div className="my-2 border-t border-border" />
          <p className="px-3 pt-1 pb-1 text-[10px] font-mono text-text-muted uppercase tracking-wider">Tools</p>
          {TOOLS_NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-8 pt-4 border-t border-border">
          <NavLink to="/" className="block px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors">
            Back to app
          </NavLink>
          <button
            onClick={handleLogout}
            className="block w-full text-left px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-5 md:p-8 lg:p-10">
        <div className="max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
