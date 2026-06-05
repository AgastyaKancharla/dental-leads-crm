/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge, PriorityBadge } from '../components/Badges'
import { Search, MessageCircle, X, Users, Plus, Phone, CheckSquare, Square, Bell, Calendar } from 'lucide-react'
import { format, parseISO, differenceInDays, isToday, isPast } from 'date-fns'
import { generateLeadIntelligence } from '../lib/intelligence'

const STATUSES = ['', 'new', 'called', 'interested', 'future_interested', 'demo_sent', 'quote_sent', 'negotiating', 'closed', 'dead', 'missed', 'not_reachable']
const PRIORITIES = ['', 'high', 'medium', 'low']
const AREAS = ['', 'Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout', 'JP Nagar', 'Jayanagar', 'BTM Layout', 'Electronic City', 'Marathahalli', 'Bannerghatta Road', 'Yelahanka', 'Hebbal', 'Rajajinagar', 'Malleshwaram', 'RT Nagar', 'Other']
const EMPTY_LEAD = { clinic_name:'', doctor_name:'', phone:'', area:'', rating:'', status:'new', priority:'medium', notes:'', next_follow_up_date:'', next_action:'', email:'', best_time_to_call:'', tags:'' }
const today = new Date().toISOString().split('T')[0]

// Priority border glow colors
const PRIORITY_SHADOW = {
  high:   '0 0 0 1.5px rgba(248,113,113,0.5), 0 4px 20px rgba(248,113,113,0.15)',
  medium: '0 0 0 1.5px rgba(251,146,60,0.45), 0 4px 20px rgba(251,146,60,0.12)',
  low:    '0 0 0 1.5px rgba(52,211,153,0.4),  0 4px 20px rgba(52,211,153,0.10)',
}
const PRIORITY_BORDER = {
  high:   'rgba(248,113,113,0.5)',
  medium: 'rgba(251,146,60,0.45)',
  low:    'rgba(52,211,153,0.4)',
}

// Callback modal
function CallbackModal({ lead, onSave, onClose }) {
  const [date, setDate] = useState(lead.callback_scheduled_at ? lead.callback_scheduled_at.split('T')[0] : '')
  const [time, setTime] = useState(lead.callback_scheduled_at ? lead.callback_scheduled_at.split('T')[1]?.slice(0,5) : '10:00')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!date) { window.__toast && window.__toast('Pick a date', 'error'); return }
    setSaving(true)
    const scheduledAt = `${date}T${time || '10:00'}`
    await supabase.from('leads').update({
      callback_scheduled_at: scheduledAt,
      next_follow_up_date: date,
      next_action: 'call',
    }).eq('id', lead.id)
    if (note) {
      await supabase.from('lead_notes').insert({ lead_id: lead.id, note: `📞 Callback scheduled for ${format(new Date(scheduledAt), 'dd MMM, h:mm a')}${note ? ' — ' + note : ''}`, type: 'callback', scheduled_at: scheduledAt })
    }
    setSaving(false)
    window.__toast && window.__toast(`Callback set for ${format(new Date(scheduledAt), 'dd MMM, h:mm a')}`, 'success')
    onSave()
    onClose()
  }

  async function remove() {
    await supabase.from('leads').update({ callback_scheduled_at: null, next_action: null, next_follow_up_date: null }).eq('id', lead.id)
    window.__toast && window.__toast('Callback removed', 'success')
    onSave()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:420 }} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h2>📞 Schedule Callback — {lead.clinic_name}</h2>
          <button className="btn-icon" onClick={onClose} style={{ fontSize:18, lineHeight:1 }}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row" style={{ marginBottom:14 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" min={today} value={date} onChange={e=>setDate(e.target.value)}/>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Time</label>
              <input type="time" className="form-input" value={time} onChange={e=>setTime(e.target.value)}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Note (optional)</label>
            <input type="text" className="form-input" placeholder="e.g. Doctor back from audit" value={note} onChange={e=>setNote(e.target.value)}/>
          </div>
          {/* Quick pick */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
            {[{l:'Tomorrow',d:1},{l:'In 3 days',d:3},{l:'1 week',d:7},{l:'2 weeks',d:14}].map(o=>{
              const d = new Date(); d.setDate(d.getDate()+o.d)
              const val = d.toISOString().split('T')[0]
              return <button key={o.l} onClick={()=>setDate(val)} style={{ padding:'5px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:date===val?'var(--accent-glow2)':'var(--bg3)', color:date===val?'var(--accent2)':'var(--text3)', border:`1px solid ${date===val?'var(--accent)':'var(--border)'}`, cursor:'pointer' }}>{o.l}</button>
            })}
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent:'space-between' }}>
          {lead.callback_scheduled_at && (
            <button className="btn btn-danger btn-sm" onClick={remove}>🗑 Remove Callback</button>
          )}
          <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving?'Saving...':'Save Callback'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Leads() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [hasWebsiteFilter, setHasWebsiteFilter] = useState('')
  const [partnerFilter, setPartnerFilter] = useState('')
  const [viewMode, setViewMode] = useState('cards')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_LEAD)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [showBulkBar, setShowBulkBar] = useState(false)
  const [bulkAction, setBulkAction] = useState('')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [dupWarning, setDupWarning] = useState(null)
  const [callbackTarget, setCallbackTarget] = useState(null)

  // Count active filters
  const activeFilters = [statusFilter, priorityFilter, areaFilter, hasWebsiteFilter, partnerFilter].filter(Boolean).length

  useEffect(() => {
    fetchLeads()
    window.__openAddLead = () => { setForm(EMPTY_LEAD); setEditId(null); setShowModal(true) }
    return () => { delete window.__openAddLead }
  }, [])

  useEffect(() => { setShowBulkBar(selected.size > 0) }, [selected])

  async function fetchLeads() {
    setLoading(true)
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.clinic_name?.toLowerCase().includes(q) || l.doctor_name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.area?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || (l.tags || []).some(t => t.toLowerCase().includes(q))
    const matchWebsite = !hasWebsiteFilter || (hasWebsiteFilter==='yes' ? l.website_url : !l.website_url)
    const matchPartner = !partnerFilter || (partnerFilter==='yes' ? l.partner_approval_needed : !l.partner_approval_needed)
    return matchSearch && (!statusFilter || l.status === statusFilter) && (!priorityFilter || l.priority === priorityFilter) && (!areaFilter || l.area === areaFilter) && matchWebsite && matchPartner
  })

  async function checkDuplicate(phone) {
    if (!phone || phone.length < 8) return
    const clean = phone.replace(/[^0-9]/g, '').replace(/^91/, '').slice(-10)
    const { data } = await supabase.from('leads').select('id, clinic_name, status').filter('phone', 'ilike', `%${clean}%`)
    const dups = data?.filter(d => !editId || d.id !== editId) || []
    setDupWarning(dups.length > 0 ? dups : null)
  }

  async function saveLead() {
    if (!form.clinic_name || !form.phone) { window.__toast && window.__toast('Clinic name and phone required', 'error'); return }
    setSaving(true)
    const payload = {
      ...form,
      rating: form.rating ? parseFloat(form.rating) : null,
      next_follow_up_date: form.next_follow_up_date || null,
      next_action: form.next_action || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    }
    if (editId) {
      await supabase.from('leads').update(payload).eq('id', editId)
      window.__toast && window.__toast('Lead updated', 'success')
    } else {
      const { data: newLead } = await supabase.from('leads').insert(payload).select().single()
      window.__toast && window.__toast('Lead added — AI researching...', 'success')
      if (newLead) setTimeout(() => generateLeadIntelligence(newLead), 500)
    }
    setSaving(false); setShowModal(false); setDupWarning(null); fetchLeads()
  }

  async function deleteLead(id, e) {
    e.stopPropagation()
    if (!window.confirm('Delete this lead and all call history?')) return
    await supabase.from('leads').delete().eq('id', id)
    setLeads(prev => prev.filter(l => l.id !== id))
    window.__toast && window.__toast('Lead deleted', 'success')
  }

  function openEdit(lead, e) {
    e.stopPropagation()
    setForm({ ...lead, rating: lead.rating || '', next_follow_up_date: lead.next_follow_up_date || '', next_action: lead.next_action || '', tags: (lead.tags || []).join(', '), email: lead.email || '', best_time_to_call: lead.best_time_to_call || '' })
    setEditId(lead.id); setShowModal(true)
  }

  function toggleSelect(id, e) {
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(l => l.id)))
  }

  function clearFilters() {
    setStatusFilter(''); setPriorityFilter(''); setAreaFilter(''); setHasWebsiteFilter(''); setPartnerFilter(''); setSearch('')
  }

  async function applyBulkAction() {
    if (!bulkAction) { window.__toast && window.__toast('Select an action', 'error'); return }
    if (!bulkValue && bulkAction !== 'delete') { window.__toast && window.__toast('Select a value', 'error'); return }
    if (bulkAction === 'delete' && !window.confirm(`Delete ${selected.size} leads? This cannot be undone.`)) return
    setBulkSaving(true)
    const ids = Array.from(selected)
    if (bulkAction === 'delete') {
      for (const id of ids) await supabase.from('leads').delete().eq('id', id)
      window.__toast && window.__toast(`${ids.length} leads deleted`, 'success')
    } else if (bulkAction === 'status') {
      await supabase.from('leads').update({ status: bulkValue }).in('id', ids)
    } else if (bulkAction === 'priority') {
      await supabase.from('leads').update({ priority: bulkValue }).in('id', ids)
    } else if (bulkAction === 'follow_up') {
      await supabase.from('leads').update({ next_follow_up_date: bulkValue }).in('id', ids)
    } else if (bulkAction === 'next_action') {
      await supabase.from('leads').update({ next_action: bulkValue }).in('id', ids)
    }
    window.__toast && window.__toast(`Done`, 'success')
    setBulkSaving(false); setSelected(new Set()); setBulkAction(''); setBulkValue('')
    fetchLeads()
  }

  return (
    <div>
      {/* ── FILTER BAR ── */}
      <div className="filter-bar">
        <div className="search-wrap" style={{ flex:2, minWidth:200 }}>
          <Search />
          <input className="search-input" placeholder="Search clinic, phone, tag..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }} onClick={() => setSearch('')}><X size={14} /></button>}
        </div>
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
        </select>
        <select className="filter-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priority</option>
          {PRIORITIES.filter(Boolean).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
        </select>
        <select className="filter-select" value={areaFilter} onChange={e => setAreaFilter(e.target.value)}>
          <option value="">All Areas</option>
          {AREAS.filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="filter-select" value={hasWebsiteFilter} onChange={e => setHasWebsiteFilter(e.target.value)} style={{ minWidth:130 }}>
          <option value="">All Leads</option>
          <option value="yes">🌐 Has Website</option>
          <option value="no">❌ No Website</option>
        </select>
        <select className="filter-select" value={partnerFilter} onChange={e => setPartnerFilter(e.target.value)} style={{ minWidth:140 }}>
          <option value="">All Leads</option>
          <option value="yes">🤝 Needs Partner</option>
        </select>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:12, color:'var(--text3)', whiteSpace:'nowrap' }}>{filtered.length} leads</span>
          {activeFilters > 0 && (
            <button onClick={clearFilters} style={{ padding:'5px 10px', borderRadius:99, fontSize:11, fontWeight:700, background:'var(--red-bg)', color:'var(--red)', border:'1px solid rgba(248,113,113,0.2)', cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4 }}>
              <X size={11}/> {activeFilters} filter{activeFilters>1?'s':''}
            </button>
          )}
          <button onClick={()=>setViewMode(v=>v==='cards'?'table':'cards')} className="btn btn-ghost btn-sm" style={{ flexShrink:0 }}>
            {viewMode==='cards'?'⊞ Table':'☰ Cards'}
          </button>
        </div>
      </div>

      {/* ── ACTIVE FILTER CHIPS ── */}
      {activeFilters > 0 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
          {statusFilter && <span style={{ padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:'var(--accent-glow2)', color:'var(--accent2)', border:'1px solid rgba(124,106,247,0.25)', display:'flex', alignItems:'center', gap:5 }}>Status: {statusFilter.replace(/_/g,' ')} <button onClick={()=>setStatusFilter('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent2)', lineHeight:1 }}>×</button></span>}
          {priorityFilter && <span style={{ padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:'var(--accent-glow2)', color:'var(--accent2)', border:'1px solid rgba(124,106,247,0.25)', display:'flex', alignItems:'center', gap:5 }}>Priority: {priorityFilter} <button onClick={()=>setPriorityFilter('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent2)', lineHeight:1 }}>×</button></span>}
          {areaFilter && <span style={{ padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:'var(--accent-glow2)', color:'var(--accent2)', border:'1px solid rgba(124,106,247,0.25)', display:'flex', alignItems:'center', gap:5 }}>Area: {areaFilter} <button onClick={()=>setAreaFilter('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent2)', lineHeight:1 }}>×</button></span>}
          {hasWebsiteFilter && <span style={{ padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:'var(--accent-glow2)', color:'var(--accent2)', border:'1px solid rgba(124,106,247,0.25)', display:'flex', alignItems:'center', gap:5 }}>{hasWebsiteFilter==='yes'?'🌐 Has Website':'❌ No Website'} <button onClick={()=>setHasWebsiteFilter('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent2)', lineHeight:1 }}>×</button></span>}
          {partnerFilter && <span style={{ padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:'var(--accent-glow2)', color:'var(--accent2)', border:'1px solid rgba(124,106,247,0.25)', display:'flex', alignItems:'center', gap:5 }}>🤝 Needs Partner <button onClick={()=>setPartnerFilter('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent2)', lineHeight:1 }}>×</button></span>}
        </div>
      )}

      {/* ── BULK ACTION BAR ── */}
      {showBulkBar && (
        <div style={{ background:'var(--accent)', borderRadius:'var(--radius-sm)', padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <span style={{ color:'white', fontWeight:700, fontSize:13 }}>{selected.size} selected</span>
          <select style={{ padding:'6px 10px', borderRadius:6, border:'none', fontSize:12, fontWeight:600 }} value={bulkAction} onChange={e => { setBulkAction(e.target.value); setBulkValue('') }}>
            <option value="">Choose action...</option>
            <option value="status">Change Status</option>
            <option value="priority">Change Priority</option>
            <option value="follow_up">Set Follow Up Date</option>
            <option value="next_action">Set Next Action</option>
            <option value="delete">🗑️ Delete All</option>
          </select>
          {bulkAction === 'status' && <select style={{ padding:'6px 10px', borderRadius:6, border:'none', fontSize:12 }} value={bulkValue} onChange={e => setBulkValue(e.target.value)}><option value="">Select...</option>{STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select>}
          {bulkAction === 'priority' && <select style={{ padding:'6px 10px', borderRadius:6, border:'none', fontSize:12 }} value={bulkValue} onChange={e => setBulkValue(e.target.value)}><option value="">Select...</option>{PRIORITIES.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}</select>}
          {bulkAction === 'follow_up' && <input type="date" style={{ padding:'6px 10px', borderRadius:6, border:'none', fontSize:12 }} min={today} value={bulkValue} onChange={e => setBulkValue(e.target.value)} />}
          {bulkAction === 'next_action' && <select style={{ padding:'6px 10px', borderRadius:6, border:'none', fontSize:12 }} value={bulkValue} onChange={e => setBulkValue(e.target.value)}><option value="">Select...</option>{['call','whatsapp','send_demo','send_quote','meeting','close'].map(a => <option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}</select>}
          <button className="btn btn-sm" style={{ background:'white', color:'var(--accent)', fontWeight:700 }} onClick={applyBulkAction} disabled={bulkSaving}>{bulkSaving ? 'Applying...' : 'Apply'}</button>
          <button className="btn btn-sm" style={{ background:'rgba(255,255,255,0.2)', color:'white' }} onClick={() => { setSelected(new Set()); setBulkAction(''); setBulkValue('') }}>Cancel</button>
        </div>
      )}

      {/* ── LEAD LIST ── */}
      {loading ? (
        <div className="loading"><div className="spinner" /> Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><Users size={40} style={{ margin:'0 auto 12px', opacity:0.2 }} /><p>No leads found</p><span>{activeFilters>0?'Try clearing filters':'Add a lead to get started'}</span></div>
      ) : viewMode === 'cards' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(lead => {
            const daysSinceCall = lead.last_called_at ? differenceInDays(new Date(), new Date(lead.last_called_at)) : null
            const isOverdue = lead.next_follow_up_date && isPast(parseISO(lead.next_follow_up_date)) && !isToday(parseISO(lead.next_follow_up_date))
            const isSelected = selected.has(lead.id)
            const priority = lead.priority || 'medium'
            const hasCallback = !!lead.callback_scheduled_at
            const callbackPast = hasCallback && isPast(new Date(lead.callback_scheduled_at))

            // Border — selected wins, then overdue, then priority
            const borderColor = isSelected ? 'var(--accent)' : isOverdue ? 'rgba(248,113,113,0.5)' : PRIORITY_BORDER[priority] || 'var(--border)'
            const cardShadow = isSelected ? 'var(--shadow-glow)' : PRIORITY_SHADOW[priority] || 'var(--shadow)'

            const contextNote = lead.last_call_notes || lead.notes || null
            const nextActionLabel = lead.next_action ? lead.next_action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null

            return (
              <div key={lead.id} onClick={()=>navigate(`/leads/${lead.id}`)}
                style={{ background:'var(--bg2)', border:`1.5px solid ${borderColor}`, borderRadius:'var(--radius)', padding:'14px 16px', cursor:'pointer', boxShadow:cardShadow, transition:'all 0.18s ease' }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.boxShadow='var(--shadow-glow)' }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor=borderColor; e.currentTarget.style.boxShadow=cardShadow }}
              >
                <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                  {/* Checkbox */}
                  <button style={{ background:'none', border:'none', cursor:'pointer', paddingTop:2, flexShrink:0 }} onClick={e=>toggleSelect(lead.id,e)}>
                    {isSelected ? <CheckSquare size={15} color="var(--accent)"/> : <Square size={15} color="var(--text3)"/>}
                  </button>

                  {/* Main content */}
                  <div style={{ flex:1, minWidth:0 }}>
                    {/* Row 1 — name + badges */}
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:700, fontSize:14 }}>{lead.clinic_name}</span>
                      <StatusBadge status={lead.status}/>
                      {lead.priority && (
                        <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:99,
                          background: priority==='high'?'var(--red-bg)':priority==='medium'?'var(--orange-bg)':'var(--green-bg)',
                          color: priority==='high'?'var(--red)':priority==='medium'?'var(--orange)':'var(--green)',
                          border: `1px solid ${priority==='high'?'rgba(248,113,113,0.2)':priority==='medium'?'rgba(251,146,60,0.2)':'rgba(52,211,153,0.2)'}`,
                        }}>
                          {priority==='high'?'🔴':priority==='medium'?'🟠':'🟢'} {priority}
                        </span>
                      )}
                      {lead.website_url && <span style={{ fontSize:10, fontWeight:700, background:'var(--blue-bg)', color:'var(--blue)', padding:'1px 6px', borderRadius:99 }}>🌐</span>}
                      {lead.opportunity_score>0 && <span style={{ fontSize:10, fontWeight:700, background:lead.opportunity_score>=70?'var(--green-bg)':lead.opportunity_score>=40?'var(--yellow-bg)':'var(--bg3)', color:lead.opportunity_score>=70?'var(--green)':lead.opportunity_score>=40?'var(--yellow)':'var(--text3)', padding:'1px 6px', borderRadius:99, marginLeft:'auto' }}>⚡ {lead.opportunity_score}</span>}
                    </div>

                    {/* Row 2 — meta */}
                    <div style={{ display:'flex', gap:10, fontSize:12, color:'var(--text3)', flexWrap:'wrap', marginBottom:4 }}>
                      {lead.doctor_name && <span>{lead.doctor_name}</span>}
                      {lead.area && <span>📍 {lead.area}</span>}
                      {lead.rating && <span>⭐ {lead.rating}</span>}
                    </div>

                    {/* Row 3 — dates */}
                    <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text3)', flexWrap:'wrap', marginBottom: (contextNote||nextActionLabel||hasCallback) ? 8 : 0 }}>
                      {lead.next_follow_up_date && (
                        <span style={{ color:isOverdue?'var(--red)':isToday(parseISO(lead.next_follow_up_date))?'var(--yellow)':'var(--text3)', fontWeight:isOverdue||isToday(parseISO(lead.next_follow_up_date))?700:400 }}>
                          📅 {isOverdue?'OVERDUE: ':isToday(parseISO(lead.next_follow_up_date))?'Today: ':''}{format(parseISO(lead.next_follow_up_date),'dd MMM')}
                        </span>
                      )}
                      {daysSinceCall!==null && <span style={{ color:daysSinceCall>14?'var(--red)':daysSinceCall>7?'var(--yellow)':'var(--text3)' }}>📞 {daysSinceCall===0?'Today':`${daysSinceCall}d ago`} ({lead.call_count||0} calls)</span>}
                      {hasCallback && (
                        <span style={{ color:callbackPast?'var(--red)':'var(--yellow)', fontWeight:700 }}>
                          🔔 Callback: {format(new Date(lead.callback_scheduled_at), 'dd MMM, h:mm a')}
                        </span>
                      )}
                    </div>

                    {/* Row 4 — context preview */}
                    {(contextNote || nextActionLabel) && (
                      <div style={{ paddingTop:8, borderTop:'1px solid var(--border)' }}>
                        {contextNote && (
                          <p style={{ fontSize:11, color:'var(--text3)', margin:0, marginBottom:nextActionLabel?3:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            💬 {contextNote}
                          </p>
                        )}
                        {nextActionLabel && (
                          <p style={{ fontSize:11, fontWeight:700, color:'var(--accent2)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            👉 {nextActionLabel}{lead.next_follow_up_date ? ` · ${format(parseISO(lead.next_follow_up_date), 'dd MMM')}` : ''}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div style={{ display:'flex', flexDirection:'column', gap:5, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                    <a href={`https://wa.me/91${lead.phone}`} target="_blank" rel="noreferrer" className="wa-btn" style={{ padding:'6px 8px' }}><MessageCircle size={12}/></a>
                    <a href={`tel:${lead.phone}`} style={{ padding:'6px 8px', background:'var(--accent)', color:'white', borderRadius:'var(--radius-sm)', display:'flex', alignItems:'center', justifyContent:'center' }}><Phone size={12}/></a>
                    <button onClick={e=>{ e.stopPropagation(); setCallbackTarget(lead) }} style={{ padding:'6px 8px', background:hasCallback?'var(--yellow-bg)':'var(--bg3)', color:hasCallback?'var(--yellow)':'var(--text3)', border:`1px solid ${hasCallback?'rgba(251,191,36,0.3)':'var(--border)'}`, borderRadius:'var(--radius-sm)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }} title="Schedule callback">
                      <Bell size={12}/>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width:36 }}>
                  <button style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center' }} onClick={selectAll}>
                    {selected.size===filtered.length&&filtered.length>0?<CheckSquare size={15} color="var(--accent)"/>:<Square size={15} color="var(--text3)"/>}
                  </button>
                </th>
                <th>Clinic</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Follow Up</th>
                <th>Last Note</th>
                <th>Next Action</th>
                <th>Callback</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => {
                const isOverdue = lead.next_follow_up_date && isPast(parseISO(lead.next_follow_up_date)) && !isToday(parseISO(lead.next_follow_up_date))
                const isSelected = selected.has(lead.id)
                const priority = lead.priority || 'medium'
                return (
                  <tr key={lead.id} onClick={()=>navigate(`/leads/${lead.id}`)} style={{ cursor:'pointer', background:isSelected?'var(--accent-glow)':'transparent', borderLeft:`3px solid ${PRIORITY_BORDER[priority]||'transparent'}` }}>
                    <td onClick={e=>e.stopPropagation()}>
                      <button style={{ background:'none', border:'none', cursor:'pointer' }} onClick={e=>toggleSelect(lead.id,e)}>
                        {isSelected?<CheckSquare size={14} color="var(--accent)"/>:<Square size={14} color="var(--text3)"/>}
                      </button>
                    </td>
                    <td><span style={{ fontWeight:600, fontSize:13 }}>{lead.clinic_name}</span>{lead.doctor_name&&<div style={{ fontSize:11, color:'var(--text3)' }}>{lead.doctor_name}</div>}</td>
                    <td><span style={{ fontSize:11, fontWeight:700, color:priority==='high'?'var(--red)':priority==='medium'?'var(--orange)':'var(--green)' }}>{priority==='high'?'🔴':priority==='medium'?'🟠':'🟢'} {priority}</span></td>
                    <td><StatusBadge status={lead.status}/></td>
                    <td style={{ fontSize:12, color:isOverdue?'var(--red)':'var(--text3)', fontWeight:isOverdue?700:400 }}>
                      {lead.next_follow_up_date ? format(parseISO(lead.next_follow_up_date),'dd MMM') : '—'}
                    </td>
                    <td style={{ fontSize:11, color:'var(--text3)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {lead.last_call_notes || lead.notes || '—'}
                    </td>
                    <td style={{ fontSize:11, fontWeight:600, color:'var(--accent2)' }}>
                      {lead.next_action ? lead.next_action.replace(/_/g,' ') : '—'}
                    </td>
                    <td style={{ fontSize:11, color:lead.callback_scheduled_at?'var(--yellow)':'var(--text3)' }}>
                      {lead.callback_scheduled_at ? format(new Date(lead.callback_scheduled_at),'dd MMM, h:mm a') : '—'}
                    </td>
                    <td onClick={e=>e.stopPropagation()} style={{ display:'flex', gap:4 }}>
                      <a href={`https://wa.me/91${lead.phone}`} target="_blank" rel="noreferrer" className="wa-btn" style={{ padding:'4px 6px' }}><MessageCircle size={11}/></a>
                      <a href={`tel:${lead.phone}`} style={{ padding:'4px 6px', background:'var(--accent)', color:'white', borderRadius:'var(--radius-sm)', display:'flex', alignItems:'center', justifyContent:'center' }}><Phone size={11}/></a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CALLBACK MODAL ── */}
      {callbackTarget && (
        <CallbackModal
          lead={callbackTarget}
          onSave={fetchLeads}
          onClose={()=>setCallbackTarget(null)}
        />
      )}

      {/* ── ADD/EDIT MODAL ── */}
      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? 'Edit Lead' : '+ New Lead'}</h2>
              <button className="btn-icon" onClick={()=>setShowModal(false)} style={{ fontSize:18 }}>×</button>
            </div>
            <div className="modal-body">
              {dupWarning && (
                <div style={{ background:'var(--yellow-bg)', border:'1px solid rgba(251,191,36,0.3)', borderRadius:'var(--radius-sm)', padding:'10px 14px', marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--yellow)', marginBottom:4 }}>⚠️ Possible duplicate</div>
                  {dupWarning.map(d=><div key={d.id} style={{ fontSize:11, color:'var(--text2)' }}>{d.clinic_name} — {d.status}</div>)}
                </div>
              )}
              <div className="form-row">
                <div className="form-group"><label className="form-label">Clinic Name *</label><input className="form-input" value={form.clinic_name} onChange={e=>setForm(f=>({...f,clinic_name:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Doctor Name</label><input className="form-input" value={form.doctor_name} onChange={e=>setForm(f=>({...f,doctor_name:e.target.value}))}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Phone *</label><input className="form-input" value={form.phone} onChange={e=>{ setForm(f=>({...f,phone:e.target.value})); checkDuplicate(e.target.value) }}/></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Area</label><select className="form-input" value={form.area} onChange={e=>setForm(f=>({...f,area:e.target.value}))}>{AREAS.map(a=><option key={a} value={a}>{a||'Select area'}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Rating</label><input className="form-input" type="number" step="0.1" min="1" max="5" value={form.rating} onChange={e=>setForm(f=>({...f,rating:e.target.value}))}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Status</label><select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{STATUSES.filter(Boolean).map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Priority</label><select className="form-input" value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>{PRIORITIES.filter(Boolean).map(p=><option key={p} value={p}>{p}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Follow Up Date</label><input className="form-input" type="date" value={form.next_follow_up_date} onChange={e=>setForm(f=>({...f,next_follow_up_date:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Next Action</label><select className="form-input" value={form.next_action} onChange={e=>setForm(f=>({...f,next_action:e.target.value}))}><option value="">None</option>{['call','whatsapp','send_demo','send_quote','meeting','close'].map(a=><option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}</select></div>
              </div>
              <div className="form-group"><label className="form-label">Best Time to Call</label><input className="form-input" placeholder="e.g. 10am–12pm" value={form.best_time_to_call} onChange={e=>setForm(f=>({...f,best_time_to_call:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">Tags (comma separated)</label><input className="form-input" placeholder="e.g. chain, high-value" value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))}/></div>
            </div>
            <div className="modal-footer">
              {editId && <button className="btn btn-danger btn-sm" onClick={e=>deleteLead(editId,e)}>Delete</button>}
              <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveLead} disabled={saving}>{saving?'Saving...':editId?'Update':'Add Lead'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
