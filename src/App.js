/* eslint-disable */
import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, Bell, FileText, Download, Plus, Menu, X, Phone, MessageCircle, BarChart2, Zap } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'
import Scripts from './pages/Scripts'
import Reminders from './pages/Reminders'
import ImportLeads from './pages/ImportLeads'
import CallQueue from './pages/CallQueue'
import WhatsAppTemplates from './pages/WhatsAppTemplates'
import Analytics from './pages/Analytics'
import Toast from './components/Toast'
import GlobalSearch from './components/GlobalSearch'

const NAV = [
  { path: '/',          label: 'Dashboard',    icon: LayoutDashboard },
  { path: '/queue',     label: 'Call Queue',   icon: Phone },
  { path: '/leads',     label: 'All Leads',    icon: Users },
  { path: '/reminders', label: "Today's Plan", icon: Bell },
  { path: '/whatsapp',  label: 'WA Templates', icon: MessageCircle },
  { path: '/scripts',   label: 'Call Scripts', icon: FileText },
  { path: '/analytics', label: 'Analytics',    icon: BarChart2 },
  { path: '/import',    label: 'Import Leads', icon: Download },
]

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toasts, setToasts] = useState([])

  const addToast = (msg, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }
  window.__toast = addToast

  const currentNav = NAV.find(n => n.path === location.pathname) || { label: 'AgastyaOne CRM' }
  const closeSidebar = () => setSidebarOpen(false)
  const navTo = (path) => { navigate(path); closeSidebar() }

  return (
    <div className="app-layout">
      {/* OVERLAY */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={closeSidebar} />

      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h1>Agastya<span>One</span></h1>
          <p>Sales CRM</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ path, label, icon: Icon }) => (
            <button key={path} className={`nav-item ${location.pathname === path ? 'active' : ''}`} onClick={() => navTo(path)}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>AgastyaOne CRM v2.0</div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <span className="topbar-title">{currentNav.label}</span>
          </div>
          <div className="topbar-actions">
            {/* GLOBAL SEARCH — always visible in topbar */}
            <GlobalSearch />
            {location.pathname === '/leads' && (
              <button className="btn btn-primary btn-sm" onClick={() => window.__openAddLead && window.__openAddLead()}>
                <Plus size={14} /> Add
              </button>
            )}
          </div>
        </header>

        <div className="page-body">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/queue"     element={<CallQueue />} />
            <Route path="/leads"     element={<Leads />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/whatsapp"  element={<WhatsAppTemplates />} />
            <Route path="/scripts"   element={<Scripts />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/import"    element={<ImportLeads />} />
          </Routes>
        </div>
      </div>

      {/* TOASTS */}
      <div style={{ position: 'fixed', bottom: 16, left: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 999, pointerEvents: 'none' }}>
        {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} />)}
      </div>
    </div>
  )
}

export default function App() {
  return <BrowserRouter><Layout /></BrowserRouter>
}
