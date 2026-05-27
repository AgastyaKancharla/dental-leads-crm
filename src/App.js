import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, FileText, Bell, Download, Plus } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'
import Scripts from './pages/Scripts'
import Reminders from './pages/Reminders'
import ImportLeads from './pages/ImportLeads'
import Toast from './components/Toast'

const NAV = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/leads', label: 'All Leads', icon: Users },
  { path: '/reminders', label: 'Today\'s Plan', icon: Bell },
  { path: '/scripts', label: 'Call Scripts', icon: FileText },
  { path: '/import', label: 'Import Leads', icon: Download },
]

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toasts, setToasts] = useState([])

  const addToast = (msg, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }

  window.__toast = addToast

  const currentNav = NAV.find(n => n.path === location.pathname) || NAV[0]

  return (
    <div className="app-layout">
      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9, display: 'none' }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>We<span>Value</span></h1>
          <p>Leads CRM</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              className={`nav-item ${location.pathname === path ? 'active' : ''}`}
              onClick={() => navigate(path)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
            WeValue CRM v1.0
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">{currentNav.label}</span>
          <div className="topbar-actions">
            {location.pathname === '/leads' && (
              <button className="btn btn-primary btn-sm" onClick={() => window.__openAddLead && window.__openAddLead()}>
                <Plus size={14} /> Add Lead
              </button>
            )}
          </div>
        </header>
        <div className="page-body">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/scripts" element={<Scripts />} />
            <Route path="/import" element={<ImportLeads />} />
          </Routes>
        </div>
      </div>

      {/* TOASTS */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 999 }}>
        {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} />)}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}
