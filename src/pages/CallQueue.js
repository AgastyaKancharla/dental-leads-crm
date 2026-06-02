/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge } from '../components/Badges'
import { Phone, MessageCircle, ChevronRight, RefreshCw, CheckCircle, Target, Clock, Zap, Copy } from 'lucide-react'
import LeadIntelligence from '../components/LeadIntelligence'
import { format, parseISO, isToday, isPast, differenceInDays } from 'date-fns'

// ── OUTCOME CONFIG ──
const OUTCOMES = [
  { key:'interested',      label:'😊 Interested',     color:'var(--green)',  bg:'var(--green-bg)',  followUpDays:1,  nextAction:'send_demo',  nextStatus:'interested' },
  { key:'callback',        label:'📞 Callback',        color:'var(--yellow)', bg:'var(--yellow-bg)', followUpDays:2,  nextAction:'call',       nextStatus:'called' },
  { key:'demo_requested',  label:'🖥️ Wants Demo',      color:'var(--purple)', bg:'var(--purple-bg)', followUpDays:0,  nextAction:'send_demo',  nextStatus:'demo_sent' },
  { key:'no_answer',       label:'📵 No Answer',       color:'var(--text3)',  bg:'var(--bg3)',        followUpDays:1,  nextAction:'call',       nextStatus:null },
  { key:'not_interested',  label:'❌ Not Interested',  color:'var(--red)',    bg:'var(--red-bg)',    followUpDays:null,nextAction:null,         nextStatus:'dead' },
  { key:'future_interest', label:'🔮 Future Interest', color:'var(--blue)',   bg:'var(--blue-bg)',   followUpDays:30, nextAction:'call',       nextStatus:'future_interested' },
]

// ── WA MESSAGE GENERATOR ──
function buildWAMessage(outcome, lead) {
  const name = lead.doctor_name ? `Dr. ${lead.doctor_name.split(' ').pop()}` : 'Doctor'
  const demoLink = lead.demo_link || 'https://yousmiledental.netlify.app'
  const templates = {
    demo_requested: `Hi ${name} 🙏\n\nAs discussed, here's the demo website we built for a dental clinic in Bengaluru:\n${demoLink}\n\nThis is the kind of website we'll build for *${lead.clinic_name}* — fully customized with your branding, services, and booking system.\n\nLet me know your thoughts! Happy to get on a quick call. 😊\n\n— Agastya | AgastyaOne`,
    interested: `Hi ${name} 🙏\n\nGreat speaking with you today! Really excited about what we can do for *${lead.clinic_name}*.\n\nHere's our demo so you can see the quality:\n${demoLink}\n\nI'll follow up tomorrow to discuss next steps. Any questions in the meantime — just reply here!\n\n— Agastya | AgastyaOne`,
    callback: `Hi ${name} 🙏\n\nThank you for your time earlier! As discussed, I'll give you a call on the scheduled date.\n\nMeanwhile, feel free to check out our demo:\n${demoLink}\n\nSee you soon! 😊\n\n— Agastya | AgastyaOne`,
    future_interest: `Hi ${name} 🙏\n\nThank you for the conversation today! Completely understand the timing.\n\nWhen you're ready, we'd love to help *${lead.clinic_name}* get more patients through a strong digital presence.\n\nI'll check back in as discussed. Have a great day! 🙏\n\n— Agastya | AgastyaOne`,
    no_answer: `Hi ${name} 🙏\n\nI tried reaching you a short while ago — must have called at a busy time!\n\nI'm Agastya from AgastyaOne. We help dental clinics in Bengaluru get more patients through websites, SEO, and WhatsApp automation.\n\nWould love 5 minutes of your time. When's a good time to call?\n\n— Agastya | AgastyaOne`,
  }
  return templates[outcome] || null
}

// ── URGENCY TAG ──
function UrgencyTag({ lead }) {
  if (!lead?.next_follow_up_date) return null
  if (isPast(parseISO(lead.next_follow_up_date)) && !isToday(parseISO(lead.next_follow_up_date)))
    return <span style={{ background:'var(--red-bg)', color:'var(--red)', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99 }}>⚠️ OVERDUE</span>
  if (isToday(parseISO(lead.next_follow_up_date)))
    return <span style={{ background:'var(--yellow-bg)', color:'var(--yellow)', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99 }}>📅 TODAY</span>
  return null
}

// ── FOLLOW-UP SUGGESTER ──
function FollowUpSuggester({ outcome, onAccept }) {
  const config = OUTCOMES.find(o => o.key === outcome)
  if (!config || config.followUpDays === null) return null
  const suggestedDate = new Date()
  if (config.followUpDays > 0) suggestedDate.setDate(suggestedDate.getDate() + config.followUpDays)
  const dateStr = suggestedDate.toISOString().split('T')[0]
  const label = config.followUpDays === 0 ? 'Today' : config.followUpDays === 1 ? 'Tomorrow' : `In ${config.followUpDays} days (${format(suggestedDate, 'dd MMM')})`

  return (
    <div style={{ background:'var(--accent-glow)', border:'1px solid rgba(91,82,245,0.2)', borderRadius:'var(--radius-sm)', padding:'10px 12px', marginTop:10 }}>
      <div style={{ fontSize:11, color:'var(--accent)', fontWeight:700, marginBottom:6 }}>⚡ SUGGESTED FOLLOW-UP</div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600 }}>{label}</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Next action: {config.nextAction?.replace(/_/g,' ')}</div>
        </div>
        <button onClick={()=>onAccept(dateStr, config.nextAction)} style={{ padding:'7px 13px', background:'var(--accent)', color:'white', border:'none', borderRadius:'var(--radius-sm)', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          ✓ Set
        </button>
      </div>
    </div>
  )
}

// ── WA PREVIEW MODAL ──
function WAModal({ message, phone, onClose }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(()=>setCopied(false), 2000)
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h2>💬 WhatsApp Message</h2>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ background:'#f0fdf4', border:'1px solid rgba(22,163,74,0.2)', borderRadius:'var(--radius-sm)', padding:'14px', fontSize:13, lineHeight:1.7, whiteSpace:'pre-wrap', marginBottom:14, color:'var(--text)' }}>
            {message}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={copy} className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }}>
              <Copy size={13}/> {copied?'Copied!':'Copy Message'}
            </button>
            <a href={`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px 16px', background:'#22c55e', color:'white', borderRadius:'var(--radius-sm)', fontSize:13, fontWeight:600, textDecoration:'none' }}>
              <MessageCircle size={14}/> Open WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CallQueue() {
  const navigate = useNavigate()
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(0)
  const [logging, setLogging] = useState(false)
  const [callNote, setCallNote] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [lastOutcome, setLastOutcome] = useState(null)
  const [doneToday, setDoneToday] = useState(0)
  const [filter, setFilter] = useState('all')
  const [waModal, setWAModal] = useState(null)
  const today = new Date().toISOString().split('T')[0]

  useEffect(()=>{ fetchQueue() },[filter])

  async function fetchQueue() {
    setLoading(true)
    const todayStart = new Date().toISOString().split('T')[0]
    // IST midnight fix — Supabase stores UTC, phone is IST (UTC+5:30)
    const istMidnight = new Date()
    istMidnight.setHours(0,0,0,0)
    const todayIST = new Date(istMidnight.getTime() - (5.5*60*60*1000)).toISOString()

    // Get lead IDs already called today (using IST midnight)
    const { data: todayCallData } = await supabase
      .from('call_logs')
      .select('lead_id, id')
      .gte('called_at', todayIST)

    const calledTodayIds = [...new Set((todayCallData||[]).map(c => c.lead_id))]
    setDoneToday(calledTodayIds.length)

    let query = supabase.from('leads').select('*').neq('status','closed').neq('status','dead')

    // Exclude already-called-today leads from ALL filters — no exceptions
    if (calledTodayIds.length > 0) {
      query = query.not('id', 'in', `(${calledTodayIds.join(',')})`
      )
    }

    if (filter==='overdue') query = query.lt('next_follow_up_date', todayStart).not('next_follow_up_date','is',null)
    else if (filter==='today') query = query.eq('next_follow_up_date', todayStart)
    else if (filter==='new') query = query.eq('status','new')
    else if (filter==='hot') query = query.in('status',['interested','negotiating'])

    const { data } = await query.order('next_follow_up_date',{ascending:true, nullsFirst:false})
    const sorted = (data||[]).sort((a,b)=>{
      const score = l => {
        if (l.next_follow_up_date && isPast(parseISO(l.next_follow_up_date)) && !isToday(parseISO(l.next_follow_up_date))) return 100
        if (l.next_follow_up_date && isToday(parseISO(l.next_follow_up_date))) return 90
        if (l.status==='negotiating') return 80
        if (l.status==='interested') return 70
        if (l.priority==='high') return 60
        if (l.status==='demo_sent') return 50
        if (l.status==='new') return 40
        return 20
      }
      return score(b)-score(a)
    })
    setQueue(sorted)
    setCurrent(0)
    setLastOutcome(null)
    setCallNote('')
    setFollowUpDate('')
    setNextAction('')
    setLoading(false)
  }

  async function logOutcome(outcomeKey) {
    if (!queue[current]) return
    setLogging(true)
    const lead = queue[current]
    const config = OUTCOMES.find(o=>o.key===outcomeKey)

    // Suggested follow-up date
    let suggestedDate = followUpDate
    if (!suggestedDate && config?.followUpDays > 0) {
      const d = new Date(); d.setDate(d.getDate()+config.followUpDays)
      suggestedDate = d.toISOString().split('T')[0]
    }

    await supabase.from('call_logs').insert({
      lead_id: lead.id, outcome: outcomeKey,
      notes: callNote||null, next_follow_up_date: suggestedDate||null,
      next_action: nextAction||config?.nextAction||null,
      called_at: new Date().toISOString(),
    })

    const updates = {
      last_called_at: new Date().toISOString(),
      last_call_notes: callNote||null,
      call_count: (lead.call_count||0)+1,
      // Always overwrite follow-up date — never keep stale old date
      next_follow_up_date: config?.followUpDays === null ? null : (suggestedDate || null),
      next_action: nextAction||config?.nextAction||null,
    }
    if (config?.nextStatus) updates.status = config.nextStatus

    await supabase.from('leads').update(updates).eq('id', lead.id)

    setLastOutcome(outcomeKey)
    setDoneToday(d=>d+1)
    // Remove this lead from the local queue immediately so it can't reappear
    setQueue(prev => prev.filter(l => l.id !== lead.id))
    setLogging(false)
    window.__toast && window.__toast(`✓ Logged: ${outcomeKey.replace(/_/g,' ')}`, 'success')

    // Auto-show WA modal for relevant outcomes
    const waMsg = buildWAMessage(outcomeKey, lead)
    if (waMsg && ['demo_requested','interested','callback','no_answer'].includes(outcomeKey)) {
      setWAModal({ message: waMsg, phone: lead.phone })
    }
  }

  function acceptSuggestedFollowUp(date, action) {
    setFollowUpDate(date)
    setNextAction(action||'')
    window.__toast && window.__toast('Follow-up date set!','success')
  }

  function nextLead() {
    setLastOutcome(null); setCallNote(''); setFollowUpDate(''); setNextAction('')
    setCurrent(c=>c+1)
  }

  function skip() {
    setLastOutcome(null); setCallNote(''); setFollowUpDate(''); setNextAction('')
    setCurrent(c=>c+1)
  }

  if (loading) return <div className="loading"><div className="spinner"/>Loading queue...</div>

  const lead = queue[current]
  const remaining = queue.length - current
  const daysSinceCall = lead?.last_called_at ? differenceInDays(new Date(), new Date(lead.last_called_at)) : null

  return (
    <div style={{ maxWidth:600, margin:'0 auto' }}>

      {/* FILTERS */}
      <div style={{ display:'flex', gap:7, marginBottom:14, overflowX:'auto', paddingBottom:4 }}>
        {[
          { key:'all', label:'All' },
          { key:'overdue', label:'🔴 Overdue' },
          { key:'today', label:'📅 Today' },
          { key:'hot', label:'🔥 Hot' },
          { key:'new', label:'🆕 New' },
        ].map(f=>(
          <button key={f.key} onClick={()=>setFilter(f.key)} className={`btn btn-sm ${filter===f.key?'btn-primary':'btn-ghost'}`} style={{ whiteSpace:'nowrap' }}>{f.label}</button>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={fetchQueue} style={{ marginLeft:'auto', flexShrink:0 }}><RefreshCw size={13}/></button>
      </div>

      {/* PROGRESS */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span style={{ fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}><Target size={14} color="var(--accent)"/> Queue Progress</span>
          <span style={{ fontSize:13, fontWeight:700 }}><span style={{ color:'var(--green)' }}>{doneToday}</span> done · <span style={{ color:'var(--text3)' }}>{remaining} left</span></span>
        </div>
        <div style={{ height:8, background:'var(--bg3)', borderRadius:99, overflow:'hidden', border:'1px solid var(--border)' }}>
          <div style={{ height:'100%', width:`${queue.length>0?(current/queue.length)*100:0}%`, background:'var(--accent)', borderRadius:99, transition:'width 0.3s' }}/>
        </div>
        <div style={{ fontSize:11, color:'var(--text3)', marginTop:5 }}>{current} of {queue.length} in this session</div>
      </div>

      {!lead ? (
        <div className="card" style={{ textAlign:'center', padding:'48px 20px' }}>
          <CheckCircle size={48} color="var(--green)" style={{ margin:'0 auto 16px' }}/>
          <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800, marginBottom:8 }}>Queue Complete! 🎉</div>
          <div style={{ color:'var(--text3)', fontSize:14, marginBottom:20 }}>Called {doneToday} leads today. Great work!</div>
          <button className="btn btn-primary" onClick={fetchQueue}>Refresh Queue</button>
        </div>
      ) : (
        <>
          {/* ── LEAD CARD ── */}
          <div className="card" style={{ marginBottom:12 }}>

            {/* Tags row */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
              <UrgencyTag lead={lead}/>
              <StatusBadge status={lead.status}/>
              {lead.priority==='high' && <span style={{ background:'var(--red-bg)', color:'var(--red)', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99 }}>🔥 High Priority</span>}
              {daysSinceCall!==null && <span style={{ fontSize:11, color:daysSinceCall>7?'var(--red)':'var(--text3)', marginLeft:'auto' }}>{daysSinceCall===0?'called today':`last call ${daysSinceCall}d ago`}</span>}
            </div>

            {/* Clinic name + actions */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800, wordBreak:'break-word', marginBottom:2 }}>{lead.clinic_name}</div>
                {lead.doctor_name && <div style={{ fontSize:13, color:'var(--text2)', marginBottom:1 }}>{lead.doctor_name}</div>}
                {lead.area && <div style={{ fontSize:12, color:'var(--text3)' }}>📍 {lead.area}{lead.rating?` · ⭐ ${lead.rating}`:''}</div>}
              </div>
              <button className="btn-icon" onClick={()=>navigate(`/leads/${lead.id}`)} title="Full lead detail"><ChevronRight size={16}/></button>
            </div>

            {/* LAST CALL CONTEXT — most important thing */}
            {lead.last_call_notes && (
              <div style={{ background:'var(--yellow-bg)', border:'1px solid rgba(217,119,6,0.25)', borderRadius:'var(--radius-sm)', padding:'10px 12px', marginBottom:12 }}>
                <div style={{ fontSize:10, color:'var(--yellow)', fontWeight:700, marginBottom:4, textTransform:'uppercase', letterSpacing:0.5 }}>📋 Last Call Context</div>
                <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.6 }}>{lead.last_call_notes}</div>
                {lead.last_called_at && <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
                  {format(new Date(lead.last_called_at),'dd MMM, h:mm a')} · {lead.call_count||1} call{lead.call_count!==1?'s':''} total
                </div>}
              </div>
            )}

            {/* NOTES */}
            {lead.notes && !lead.last_call_notes && (
              <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', marginBottom:12, fontSize:13, color:'var(--text2)', lineHeight:1.5 }}>
                📝 {lead.notes}
              </div>
            )}

            {/* AI INTELLIGENCE */}
            <LeadIntelligence lead={lead} compact={true}/>

            {/* CALL + WA BUTTONS */}
            <div style={{ display:'flex', gap:10, marginTop:12 }}>
              <a href={`tel:${lead.phone}`} className="btn btn-primary" style={{ flex:1, justifyContent:'center', fontSize:15, padding:'12px' }}>
                <Phone size={16}/> {lead.phone}
              </a>
              <button onClick={()=>{ const msg=buildWAMessage('no_answer',lead); if(msg) setWAModal({message:msg,phone:lead.phone}) }}
                className="wa-btn" style={{ padding:'12px 14px' }}>
                <MessageCircle size={16}/>
              </button>
            </div>
          </div>

          {/* ── OUTCOME BUTTONS ── */}
          {!lastOutcome ? (
            <div className="card" style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12 }}>What happened? (tap to log)</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {OUTCOMES.map(o=>(
                  <button key={o.key} onClick={()=>logOutcome(o.key)} disabled={logging}
                    style={{ padding:'13px 10px', background:o.bg, border:`1.5px solid ${o.color}40`, borderRadius:'var(--radius-sm)', color:o.color, fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.15s', textAlign:'center', opacity:logging?0.6:1 }}>
                    {o.label}
                  </button>
                ))}
              </div>

              {/* Optional note + date */}
              <div style={{ marginTop:14, borderTop:'1px solid var(--border)', paddingTop:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>Add note (optional)</div>
                <textarea className="form-input" placeholder="Key points from this call... what did they say?" value={callNote} onChange={e=>setCallNote(e.target.value)} style={{ minHeight:65, marginBottom:10 }}/>
                <div style={{ display:'flex', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <label className="form-label">📅 Override Follow-up Date</label>
                    <input type="date" className="form-input" min={today} value={followUpDate} onChange={e=>setFollowUpDate(e.target.value)}/>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── POST-OUTCOME: FOLLOW-UP SUGGESTER ── */
            <div className="card" style={{ marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <CheckCircle size={16} color="var(--green)"/>
                <span style={{ fontWeight:700, color:'var(--green)', fontSize:14 }}>Outcome logged!</span>
                <span style={{ fontSize:13, color:'var(--text3)' }}>· {lastOutcome.replace(/_/g,' ')}</span>
              </div>

              <FollowUpSuggester outcome={lastOutcome} onAccept={acceptSuggestedFollowUp}/>

              {followUpDate && (
                <div style={{ marginTop:10, padding:'10px 12px', background:'var(--green-bg)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:'var(--radius-sm)', fontSize:13, fontWeight:600, color:'var(--green)' }}>
                  ✅ Follow-up set: {format(new Date(followUpDate),'dd MMM yyyy')}
                </div>
              )}

              <div style={{ marginTop:14 }}>
                <button onClick={nextLead} className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'13px' }}>
                  Next Lead →
                </button>
              </div>
            </div>
          )}

          {/* SKIP */}
          {!lastOutcome && (
            <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', marginBottom:16 }} onClick={skip}>
              Skip this lead →
            </button>
          )}

          {/* UP NEXT */}
          {queue.slice(current+1, current+4).length>0 && (
            <div className="card">
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>Up Next</div>
              {queue.slice(current+1,current+4).map((l,i)=>(
                <div key={l.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:i<2?'1px solid var(--border)':'none' }}>
                  <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--bg3)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'var(--text3)', flexShrink:0 }}>{i+2}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.clinic_name}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{l.area} · {l.status}</div>
                  </div>
                  <UrgencyTag lead={l}/>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* WA MODAL */}
      {waModal && <WAModal message={waModal.message} phone={waModal.phone} onClose={()=>setWAModal(null)}/>}
    </div>
  )
}
