/* eslint-disable */
import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Phone, MessageCircle, ChevronDown, ChevronUp, RefreshCw, CheckCircle, Copy, ExternalLink } from 'lucide-react'
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns'

const OUTCOMES = [
  { key:'interested',     label:'😊 Interested',    followUpDays:1,  nextStatus:'interested',       color:'var(--green)',  bg:'var(--green-bg)' },
  { key:'callback',       label:'📞 Callback',       followUpDays:2,  nextStatus:'called',           color:'var(--yellow)', bg:'var(--yellow-bg)' },
  { key:'demo_requested', label:'🖥️ Send Demo',      followUpDays:1,  nextStatus:'demo_sent',        color:'var(--purple)', bg:'var(--purple-bg)' },
  { key:'no_answer',      label:'📵 No Answer',      followUpDays:1,  nextStatus:null,               color:'var(--text3)',  bg:'var(--bg3)' },
  { key:'not_interested', label:'❌ Not Interested', followUpDays:null,nextStatus:'dead',             color:'var(--red)',    bg:'var(--red-bg)' },
  { key:'future',         label:'🔮 Future',         followUpDays:30, nextStatus:'future_interested',color:'var(--blue)',   bg:'var(--blue-bg)' },
]

function buildWA(outcome, lead) {
  const name = lead.doctor_name ? `Dr. ${lead.doctor_name.split(' ').pop()}` : 'Doctor'
  const demo = lead.demo_link || 'https://yousmiledental.netlify.app'
  const msgs = {
    demo_requested: `Hi ${name} 🙏\n\nAs discussed, here's the demo website we built for a clinic in Bengaluru:\n${demo}\n\nThis is the kind of site we'll build for *${lead.clinic_name}* — customised with your branding, services & booking.\n\nLet me know your thoughts!\n\n— Agastya | AgastyaOne`,
    interested:     `Hi ${name} 🙏\n\nGreat speaking with you! Here's our demo:\n${demo}\n\nI'll follow up tomorrow. Any questions — just reply here! 😊\n\n— Agastya | AgastyaOne`,
    callback:       `Hi ${name} 🙏\n\nThanks for your time! I'll call you as discussed.\n\nMeanwhile check our demo:\n${demo}\n\n— Agastya | AgastyaOne`,
    no_answer:      `Hi ${name} 🙏\n\nI tried calling — must have been a busy time!\n\nI'm Agastya from AgastyaOne. We help dental clinics get more patients through websites, SEO & WhatsApp automation.\n\nWhen's a good time to chat?\n\n— Agastya | AgastyaOne`,
    future:         `Hi ${name} 🙏\n\nThanks for the conversation! Completely understand the timing.\n\nWhen you're ready, we'd love to help *${lead.clinic_name}* grow digitally. I'll check back as discussed 🙏\n\n— Agastya | AgastyaOne`,
  }
  return msgs[outcome] || null
}

function WAModal({ message, phone, onClose }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💬 WhatsApp Message</h2>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ background:'#f0fdf4', border:'1px solid rgba(22,163,74,0.2)', borderRadius:'var(--radius-sm)', padding:14, fontSize:13, lineHeight:1.8, whiteSpace:'pre-wrap', marginBottom:14 }}>
            {message}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => { navigator.clipboard.writeText(message); setCopied(true); setTimeout(()=>setCopied(false),2000) }}
              className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }}>
              <Copy size={13}/> {copied ? 'Copied!' : 'Copy'}
            </button>
            <a href={`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 16px', background:'#22c55e', color:'white', borderRadius:'var(--radius-sm)', fontSize:13, fontWeight:600, textDecoration:'none' }}>
              <MessageCircle size={14}/> Open WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function LeadItem({ lead, onLogged, onWA }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [logging, setLogging] = useState(false)
  const [done, setDone] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const daysSince = lead.last_called_at ? differenceInDays(new Date(), new Date(lead.last_called_at)) : null
  const isOverdue = lead.next_follow_up_date && isPast(parseISO(lead.next_follow_up_date)) && !isToday(parseISO(lead.next_follow_up_date))
  const isDueToday = lead.next_follow_up_date && isToday(parseISO(lead.next_follow_up_date))

  async function logOutcome(outcomeKey) {
    setLogging(true)
    const config = OUTCOMES.find(o => o.key === outcomeKey)

    let followUpDate = followUp
    if (!followUpDate && config?.followUpDays > 0) {
      const d = new Date()
      d.setDate(d.getDate() + config.followUpDays)
      followUpDate = d.toISOString().split('T')[0]
    }

    await supabase.from('call_logs').insert({
      lead_id: lead.id,
      outcome: outcomeKey,
      notes: note || null,
      next_follow_up_date: followUpDate || null,
      called_at: new Date().toISOString(),
    })

    const updates = {
      last_called_at: new Date().toISOString(),
      last_call_notes: note || null,
      call_count: (lead.call_count || 0) + 1,
      next_follow_up_date: config?.followUpDays === null ? null : (followUpDate || null),
    }
    if (config?.nextStatus) updates.status = config.nextStatus
    await supabase.from('leads').update(updates).eq('id', lead.id)

    setDone(true)
    setLogging(false)

    // Auto-open WA for relevant outcomes
    const waMsg = buildWA(outcomeKey, lead)
    if (waMsg && ['demo_requested','interested','callback','no_answer','future'].includes(outcomeKey)) {
      onWA(waMsg, lead.phone)
    }

    setTimeout(() => onLogged(lead.id), 400)
  }

  if (done) return (
    <div style={{ padding:'12px 14px', background:'var(--green-bg)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:'var(--radius-sm)', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
      <CheckCircle size={14} color="var(--green)"/>
      <span style={{ fontSize:13, color:'var(--green)', fontWeight:600 }}>{lead.clinic_name} — logged ✓</span>
    </div>
  )

  return (
    <div style={{ background:'var(--bg2)', border:`1.5px solid ${isOverdue?'rgba(220,38,38,0.3)':isDueToday?'rgba(217,119,6,0.3)':'var(--border)'}`, borderRadius:'var(--radius-sm)', marginBottom:8, overflow:'hidden', transition:'border-color 0.15s' }}>

      {/* ── ROW (always visible) ── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
            <span style={{ fontWeight:700, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.clinic_name}</span>
            {isOverdue && <span style={{ fontSize:10, fontWeight:700, background:'var(--red-bg)', color:'var(--red)', padding:'1px 6px', borderRadius:99, flexShrink:0 }}>
              {differenceInDays(new Date(), parseISO(lead.next_follow_up_date))}d overdue
            </span>}
            {isDueToday && !isOverdue && <span style={{ fontSize:10, fontWeight:700, background:'var(--yellow-bg)', color:'var(--yellow)', padding:'1px 6px', borderRadius:99, flexShrink:0 }}>today</span>}
          </div>
          <div style={{ fontSize:11, color:'var(--text3)', display:'flex', gap:8 }}>
            {lead.area && <span>📍 {lead.area}</span>}
            {daysSince !== null && <span style={{ color: daysSince > 7 ? 'var(--red)' : 'var(--text3)' }}>📞 {daysSince === 0 ? 'called today' : `${daysSince}d ago`}</span>}
            {lead.last_call_notes && <span style={{ color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>· {lead.last_call_notes}</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:6, flexShrink:0 }} onClick={e => e.stopPropagation()}>
          <a href={`tel:${lead.phone}`} style={{ padding:'8px 10px', background:'var(--accent)', color:'white', borderRadius:'var(--radius-sm)', display:'flex', alignItems:'center' }}><Phone size={13}/></a>
          <a href={`https://wa.me/91${lead.phone}`} target="_blank" rel="noreferrer" style={{ padding:'8px 10px', background:'#22c55e', color:'white', borderRadius:'var(--radius-sm)', display:'flex', alignItems:'center' }}><MessageCircle size={13}/></a>
        </div>
        <div style={{ color:'var(--text3)', flexShrink:0, marginLeft:2 }}>
          {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </div>
      </div>

      {/* ── EXPANDED ── */}
      {expanded && (
        <div style={{ padding:'0 14px 14px', borderTop:'1px solid var(--border)' }}>

          {/* Last call context */}
          {lead.last_call_notes && (
            <div style={{ background:'var(--yellow-bg)', border:'1px solid rgba(217,119,6,0.2)', borderRadius:'var(--radius-sm)', padding:'9px 11px', margin:'12px 0 10px', fontSize:12, color:'var(--text)', lineHeight:1.6 }}>
              <span style={{ fontSize:10, fontWeight:700, color:'var(--yellow)', textTransform:'uppercase', letterSpacing:0.4 }}>Last call · </span>
              {lead.last_call_notes}
            </div>
          )}

          {/* Note input */}
          <textarea
            placeholder="What happened in this call? (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="form-input"
            style={{ minHeight:55, marginBottom:8, fontSize:13 }}
          />

          {/* Follow-up date override */}
          <div style={{ marginBottom:12 }}>
            <input type="date" className="form-input" min={today} value={followUp} onChange={e => setFollowUp(e.target.value)}
              style={{ fontSize:12 }} placeholder="Override follow-up date"/>
          </div>

          {/* Outcome buttons */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
            {OUTCOMES.map(o => (
              <button key={o.key} onClick={() => logOutcome(o.key)} disabled={logging}
                style={{ padding:'11px 8px', background:o.bg, border:`1.5px solid ${o.color}50`, borderRadius:'var(--radius-sm)', color:o.color, fontWeight:700, fontSize:12, cursor:'pointer', opacity:logging?0.5:1, transition:'opacity 0.15s' }}>
                {o.label}
              </button>
            ))}
          </div>

          {/* View full lead */}
          <button onClick={() => navigate(`/leads/${lead.id}`)} className="btn btn-ghost btn-sm" style={{ width:'100%', justifyContent:'center', marginTop:10 }}>
            <ExternalLink size={11}/> View Full Lead
          </button>
        </div>
      )}
    </div>
  )
}

export default function CallQueue() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [doneToday, setDoneToday] = useState(0)
  const [waModal, setWAModal] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { fetchQueue() }, [])

  async function fetchQueue(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    // IST midnight — Supabase stores UTC, phone is IST (+5:30)
    const istMidnight = new Date()
    istMidnight.setHours(0, 0, 0, 0)
    const todayIST = new Date(istMidnight.getTime() - 5.5 * 3600000).toISOString()
    const todayDate = new Date().toISOString().split('T')[0]

    // Get lead IDs called today
    const { data: todayCalls } = await supabase
      .from('call_logs').select('lead_id').gte('called_at', todayIST)

    const calledIds = [...new Set((todayCalls || []).map(c => c.lead_id))]
    setDoneToday(calledIds.length)

    // Fetch active leads excluding already-called-today
    let query = supabase.from('leads').select('*')
      .not('status', 'in', '("closed","dead")')
      .order('next_follow_up_date', { ascending: true, nullsFirst: false })

    if (calledIds.length > 0) {
      query = query.not('id', 'in', `(${calledIds.join(',')})`)
    }

    const { data } = await query

    // Sort: overdue → today → hot → rest
    const sorted = (data || []).sort((a, b) => {
      const rank = l => {
        if (l.next_follow_up_date && isPast(parseISO(l.next_follow_up_date)) && !isToday(parseISO(l.next_follow_up_date))) return 0
        if (l.next_follow_up_date && isToday(parseISO(l.next_follow_up_date))) return 1
        if (['negotiating', 'interested'].includes(l.status)) return 2
        if (l.status === 'demo_sent') return 3
        if (l.status === 'new') return 4
        return 5
      }
      return rank(a) - rank(b)
    })

    setLeads(sorted)
    setLoading(false)
    setRefreshing(false)
  }

  function handleLogged(leadId) {
    setLeads(prev => prev.filter(l => l.id !== leadId))
    setDoneToday(d => d + 1)
  }

  if (loading) return <div className="loading"><div className="spinner"/>Loading queue...</div>

  const overdue = leads.filter(l => l.next_follow_up_date && isPast(parseISO(l.next_follow_up_date)) && !isToday(parseISO(l.next_follow_up_date)))
  const todayLeads = leads.filter(l => l.next_follow_up_date && isToday(parseISO(l.next_follow_up_date)))
  const rest = leads.filter(l => !l.next_follow_up_date || (!isPast(parseISO(l.next_follow_up_date)) && !isToday(parseISO(l.next_follow_up_date))))

  return (
    <div style={{ maxWidth:600, margin:'0 auto' }}>

      {/* HEADER */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800 }}>Call Queue</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
            <span style={{ color:'var(--green)', fontWeight:700 }}>{doneToday} done today</span>
            {leads.length > 0 && <span> · {leads.length} remaining</span>}
          </div>
        </div>
        <button onClick={() => fetchQueue(true)} style={{ padding:'7px 9px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', cursor:'pointer', display:'flex', alignItems:'center', color:'var(--text3)' }}>
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.6s linear infinite' : 'none' }}/>
        </button>
      </div>

      {/* PROGRESS BAR */}
      {(doneToday > 0 || leads.length > 0) && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 14px', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:600, marginBottom:6 }}>
            <span>{doneToday} called</span>
            <span style={{ color:'var(--text3)' }}>{leads.length} left</span>
          </div>
          <div style={{ height:6, background:'var(--bg3)', borderRadius:99 }}>
            <div style={{ height:'100%', width:`${(doneToday/(doneToday+leads.length))*100}%`, background:'var(--accent)', borderRadius:99, transition:'width 0.4s' }}/>
          </div>
        </div>
      )}

      {/* OVERDUE */}
      {overdue.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--red)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
            🔴 Overdue <span style={{ background:'var(--red)', color:'white', borderRadius:99, padding:'1px 7px', fontSize:11 }}>{overdue.length}</span>
          </div>
          {overdue.map(lead => <LeadItem key={lead.id} lead={lead} onLogged={handleLogged} onWA={(msg,phone) => setWAModal({message:msg,phone})}/>)}
        </div>
      )}

      {/* TODAY */}
      {todayLeads.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--yellow)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
            📅 Today <span style={{ background:'var(--yellow)', color:'white', borderRadius:99, padding:'1px 7px', fontSize:11 }}>{todayLeads.length}</span>
          </div>
          {todayLeads.map(lead => <LeadItem key={lead.id} lead={lead} onLogged={handleLogged} onWA={(msg,phone) => setWAModal({message:msg,phone})}/>)}
        </div>
      )}

      {/* REST */}
      {rest.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>
            📋 All Leads ({rest.length})
          </div>
          {rest.map(lead => <LeadItem key={lead.id} lead={lead} onLogged={handleLogged} onWA={(msg,phone) => setWAModal({message:msg,phone})}/>)}
        </div>
      )}

      {/* EMPTY */}
      {leads.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px 20px' }}>
          <CheckCircle size={48} color="var(--green)" style={{ margin:'0 auto 16px' }}/>
          <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800, marginBottom:8 }}>All done! 🎉</div>
          <div style={{ color:'var(--text3)', fontSize:13, marginBottom:20 }}>Called {doneToday} leads today.</div>
          <button className="btn btn-primary" onClick={() => fetchQueue(true)}>Refresh</button>
        </div>
      )}

      {waModal && <WAModal message={waModal.message} phone={waModal.phone} onClose={() => setWAModal(null)}/>}
    </div>
  )
}
