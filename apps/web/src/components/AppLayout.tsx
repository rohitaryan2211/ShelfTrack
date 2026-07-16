import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import {
  Home, Compass, BookOpen, Library, User, Settings,
  Search, Menu, X, BookMarked, LogIn, LogOut, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

// ─── Nav item types ───────────────────────────────────────
interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  authRequired?: boolean
  curatorOnly?: boolean
}

const PUBLIC_NAV: NavItem[] = [
  { to: '/',          icon: <Home size={18} />,    label: 'Home' },
  { to: '/discover',  icon: <Compass size={18} />, label: 'Discover' },
  { to: '/publishers',icon: <BookOpen size={18} />,label: 'Publishers' },
  { to: '/search',    icon: <Search size={18} />,  label: 'Search' },
]

const AUTH_NAV: NavItem[] = [
  { to: '/library',   icon: <Library size={18} />,    label: 'My Library',  authRequired: true },
  { to: '/profile',   icon: <User size={18} />,        label: 'Profile',     authRequired: true },
  { to: '/settings',  icon: <Settings size={18} />,    label: 'Settings',    authRequired: true },
]

const CURATOR_NAV: NavItem[] = [
  { to: '/admin/ingest', icon: <ShieldCheck size={18} />, label: 'Ingest Data', curatorOnly: true },
]

// ─── Sidebar ──────────────────────────────────────────────
function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="sidebar-overlay"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 49, backdropFilter: 'blur(4px)',
          }}
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <Link to="/" className="sidebar-logo-mark" onClick={onClose} title="ShelfTrack home">
            ST
          </Link>
          <span className="sidebar-logo-text">ShelfTrack</span>
          <button className="btn btn-ghost btn-icon" style={{ marginLeft: 'auto', display: 'none' }} onClick={onClose} id="close-sidebar-btn" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          <span className="sidebar-section-label">Browse</span>
          {PUBLIC_NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
              id={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}

          {user && (
            <>
              <span className="sidebar-section-label" style={{ marginTop: 8 }}>My Space</span>
              {AUTH_NAV.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                  id={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </>
          )}

          {user && (
            <>
              <span className="sidebar-section-label" style={{ marginTop: 8 }}>Curator</span>
              {CURATOR_NAV.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                  id={`nav-ingest-data`}
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Bottom user area */}
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="avatar avatar-sm" style={{ flexShrink: 0 }}>
                {user.email?.[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={handleSignOut}
                title="Sign out"
                id="sign-out-btn"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={onClose}
              id="sidebar-login-btn"
            >
              <LogIn size={16} />
              Sign In
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}

// ─── Topbar ───────────────────────────────────────────────
function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { user, signOut } = useAuth()
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  const handleSignOut = async () => {
    setDropdownOpen(false)
    await signOut()
    navigate('/')
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    const handleClose = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.topbar-avatar-container')) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClose)
    return () => document.removeEventListener('click', handleClose)
  }, [dropdownOpen])

  return (
    <header className="topbar">
      <button
        className="btn btn-ghost btn-icon"
        style={{ display: 'none' }}
        onClick={onMenuClick}
        id="open-sidebar-btn"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 480 }}>
        <div className="input-group" style={{ position: 'relative' }}>
          <Search size={16} className="input-icon" />
          <input
            ref={searchInputRef}
            id="topbar-search"
            type="search"
            className="input"
            placeholder="Search series, volumes, authors… (Press '/' to focus)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search"
            style={{ paddingRight: '40px' }}
          />
          <span className="search-shortcut">/</span>
        </div>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link to="/discover" className="btn btn-secondary btn-sm" id="topbar-discover-btn">
          <Compass size={14} />
          Discover
        </Link>

        {user ? (
          <div className="topbar-avatar-container" style={{ position: 'relative' }}>
            <button
              className="avatar avatar-sm"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
              id="topbar-user-menu-btn"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {user.email?.[0].toUpperCase()}
            </button>
            {dropdownOpen && (
              <div className="topbar-dropdown" id="topbar-dropdown-menu">
                <div className="dropdown-user-info">
                  <div className="dropdown-user-email" title={user.email}>{user.email}</div>
                </div>
                <hr className="dropdown-divider" />
                <Link to="/library" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                  <Library size={14} /> My Library
                </Link>
                <Link to="/settings" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                  <Settings size={14} /> Settings
                </Link>
                <Link to="/admin/ingest" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                  <ShieldCheck size={14} /> Curator Ingest
                </Link>
                <hr className="dropdown-divider" />
                <button className="dropdown-item text-danger" onClick={handleSignOut} style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/login"
            className="btn btn-primary btn-sm"
            id="topbar-login-btn"
          >
            <LogIn size={14} />
            Sign In
          </Link>
        )}
      </div>
    </header>
  )
}

// ─── Bottom tab bar (mobile) ──────────────────────────────
function BottomTabBar() {
  const { user } = useAuth()

  return (
    <nav className="bottom-tabbar" aria-label="Mobile navigation">
      <NavLink to="/" end className={({ isActive }) => `btn btn-ghost flex-col ${isActive ? 'active' : ''}`} style={{ fontSize: '0.625rem', gap: 2 }}>
        <Home size={20} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/discover" className={({ isActive }) => `btn btn-ghost flex-col ${isActive ? 'active' : ''}`} style={{ fontSize: '0.625rem', gap: 2 }}>
        <Compass size={20} />
        <span>Discover</span>
      </NavLink>
      <NavLink to="/search" className={({ isActive }) => `btn btn-ghost flex-col ${isActive ? 'active' : ''}`} style={{ fontSize: '0.625rem', gap: 2 }}>
        <Search size={20} />
        <span>Search</span>
      </NavLink>
      {user ? (
        <NavLink to="/library" className={({ isActive }) => `btn btn-ghost flex-col ${isActive ? 'active' : ''}`} style={{ fontSize: '0.625rem', gap: 2 }}>
          <BookMarked size={20} />
          <span>Library</span>
        </NavLink>
      ) : (
        <NavLink to="/login" className={({ isActive }) => `btn btn-ghost flex-col ${isActive ? 'active' : ''}`} style={{ fontSize: '0.625rem', gap: 2 }}>
          <LogIn size={20} />
          <span>Sign In</span>
        </NavLink>
      )}
    </nav>
  )
}

// ─── App Layout ───────────────────────────────────────────
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // inject mobile toggle visibility via media query
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @media (max-width: 1024px) {
        #open-sidebar-btn { display: flex !important; }
        #close-sidebar-btn { display: flex !important; }
      }
    `
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-content">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="page-content">
          {children}
        </main>
      </div>

      <BottomTabBar />
    </div>
  )
}
