/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Phone, MessageCircle, ChevronRight, RefreshCw } from 'lucide-react'
import { isToday, isPast, parseISO, differenceInDays, isThisWeek } from 'date-fns'

const STATUS_EMOJI = { new:'🆕', called:'📞', interested:'😊', future_interested:'🔮', demo_sent:'🖥️', quote_sent:'💰', negotiating:'🤝', closed:'✅', dead:'❌', missed:'📵' }

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return { text: 'Good morning', emoji: '☀️' }
  if (h < 17) return { text: 'Good afternoon', emoji: '⚡' }
  return { text: 'Good evening', emoji: '🌙' }
}

function SectionHeader({ emoji, title, count, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 15 }}>{emoji}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700 }}>{title}</span>
      {count > 0 && <span style={{ marginLeft: 'auto', background: color || 'var(--accent)', color: 'white', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 99 }}>{count}</span>}
    </div>
  )
}

function LeadRow({ lead, tag, tagColor, tagBg, note, onClick }) {
  const daysSince = lead.last_called_at ? differenceInDays(new Date(), new Date(lead.last_called_at)) : null
  return (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:10, padding:'12px 14px',
      background:'var(--bg2)', borderRadius:'var(--radius-sm)',
      border:'1px solid var(--border)', marginBottom:8, cursor:'pointer',
      transition:'border-color 0.15s', boxShadow:'var(--shadow)'
    }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
    >
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
          <span style={{ fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.clinic_name}</span>
          {tag && <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:99, background:tagBg||'var(--red-bg)', color:tagColor||'var(--red)', flexShrink:0 }}>{tag}</span>}
        </div>
        <div style={{ fontSize:11, color:'var(--text3)' }}>
          {lead.area && <span>📍 {lead.area}</span>}
          {note && <span style={{ color:'var(--text2)' }}> · {note}</span>}
          {daysSince !== null && <span style={{ color:daysSince>3?'var(--red)':'var(--text3)' }}> · {daysSince===0?'called today':`${daysSince}d ago`}</span>}
        </div>
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
        <a href={`tel:${lead.phone}`} style={{ padding:'7px 9px', background:'var(--accent)', color:'white', borderRadius:'var(--radius-sm)', display:'flex', alignItems:'center' }}><Phone size={13}/></a>
        <a href={`https://wa.me/91${lead.phone}`} target="_blank" rel="noreferrer" style={{ padding:'7px 9px', background:'#22c55e', color:'white', borderRadius:'var(--radius-sm)', display:'flex', alignItems:'center' }}><MessageCircle size={13}/></a>
      </div>
    </div>
  )
}

function SnoozeModal({ lead, onSnooze, onClose }) {
  const options = [
    { label: '2 days', days: 2 },
    { label: '1 week', days: 7 },
    { label: '2 weeks', days: 14 },
    { label: '1 month', days: 30 },
    { label: '2 months', days: 60 },
  ]
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h2>⏰ Snooze {lead.clinic_name}</h2>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize:13, color:'var(--text2)', marginBottom:16 }}>Remind me to follow up in:</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {options.map(o => (
              <button key={o.days} onClick={()=>onSnooze(o.days)}
                style={{ padding:'13px 16px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', fontSize:14, fontWeight:600, cursor:'pointer', textAlign:'left' }}
                onMouseEnter={e=>{ e.currentTarget.style.background='var(--accent-glow)'; e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--accent)' }}
                onMouseLeave={e=>{ e.currentTarget.style.background='var(--bg3)'; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text)' }}
              >{o.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [callLogs, setCallLogs] = useState([])
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState(20)
  const [snoozeTarget, setSnoozeTarget] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const greeting = getGreeting()

  useEffect(()=>{ fetchAll() },[])

  async function fetchAll(isRefresh=false) {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    // IST is UTC+5:30 — use start of today in IST to avoid timezone mismatch
    const istMidnight = new Date()
    istMidnight.setHours(0,0,0,0)
    const todayIST = new Date(istMidnight.getTime() - (5.5*60*60*1000)).toISOString()
    const [l, c, r, t] = await Promise.all([
      supabase.from('leads').select('*').not('status','in','("closed","dead")').order('created_at',{ascending:false}),
      supabase.from('call_logs').select('id,lead_id,called_at,outcome').gte('called_at', todayIST),
      supabase.from('reminders').select('*, leads(clinic_name,phone)').eq('status','pending').lte('remind_at', new Date(Date.now()+86400000).toISOString()),
      supabase.from('daily_targets').select('*').eq('date', today).single(),
    ])
    setLeads(l.data||[])
    setCallLogs(c.data||[])
    setReminders(r.data||[])
    if (t.data) setTarget(t.data.target_calls)
    setLoading(false)
    setRefreshing(false)
  }

  async function snooze(lead, days) {
    const d = new Date(); d.setDate(d.getDate()+days)
    await supabase.from('leads').update({ next_follow_up_date: d.toISOString().split('T')[0] }).eq('id', lead.id)
    setSnoozeTarget(null)
    window.__toast && window.__toast(`Snoozed ${lead.clinic_name} · ${days}d`, 'success')
    fetchAll(true)
  }

  async function markReminderDone(id) {
    await supabase.from('reminders').update({ status:'done' }).eq('id', id)
    setReminders(prev=>prev.filter(r=>r.id!==id))
    window.__toast && window.__toast('Done!','success')
  }

  if (loading) return <div className="loading"><div className="spinner"/>Loading your battle plan...</div>

  const today = new Date().toISOString().split('T')[0]
  const callsToday = callLogs.length
  const calledTodayIds = new Set(callLogs.map(c => c.lead_id))
  const pct = Math.min((callsToday/target)*100, 100)
  const remaining = Math.max(target-callsToday, 0)

  // Exclude leads already called today from urgent action sections
  const uncalledLeads = leads.filter(l => !calledTodayIds.has(l.id))

  const overdueLeads = uncalledLeads.filter(l=>l.next_follow_up_date && isPast(parseISO(l.next_follow_up_date)) && !isToday(parseISO(l.next_follow_up_date))).sort((a,b)=>new Date(a.next_follow_up_date)-new Date(b.next_follow_up_date))
  const todayLeads = uncalledLeads.filter(l=>l.next_follow_up_date && isToday(parseISO(l.next_follow_up_date)))
  const hotLeads = uncalledLeads.filter(l=>['interested','negotiating','quote_sent'].includes(l.status) && !l.next_follow_up_date)
  const demoGhosts = uncalledLeads.filter(l=>{
    if(l.status!=='demo_sent') return false
    if(!l.demo_sent_date) return true
    return differenceInDays(new Date(), parseISO(l.demo_sent_date))>=3
  }).sort((a,b)=>{
    const da=a.demo_sent_date?differenceInDays(new Date(),parseISO(a.demo_sent_date)):99
    const db=b.demo_sent_date?differenceInDays(new Date(),parseISO(b.demo_sent_date)):99
    return db-da
  })
  const parkedLeads = uncalledLeads.filter(l=>{
    if(!['future_interested','called'].includes(l.status)) return false
    if(!l.next_follow_up_date) return false
    return isThisWeek(parseISO(l.next_follow_up_date)) || isPast(parseISO(l.next_follow_up_date))
  })
  const newLeads = uncalledLeads.filter(l=>l.status==='new')
  const totalUrgent = overdueLeads.length+todayLeads.length+hotLeads.length

  return (
    <div style={{ maxWidth:600, margin:'0 auto' }}>

      {/* GREETING + REFRESH */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>{greeting.emoji} {greeting.text}</div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800, marginTop:2 }}>
            {totalUrgent>0 ? `${totalUrgent} leads need attention` : "You're all caught up! 🎉"}
          </div>
        </div>
        <button onClick={()=>fetchAll(true)} style={{ padding:'7px 9px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text3)', cursor:'pointer', display:'flex', alignItems:'center' }}>
          <RefreshCw size={14} style={{ animation:refreshing?'spin 0.6s linear infinite':'none' }}/>
        </button>
      </div>

      {/* CALL TARGET STRIP */}
      <div style={{ background:'var(--accent)', borderRadius:'var(--radius)', padding:'16px 18px', marginBottom:14, color:'white' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:11, opacity:0.8, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Today's Target</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:800, lineHeight:1.1, marginTop:2 }}>
              {callsToday}<span style={{ fontSize:16, opacity:0.7 }}>/{target} calls</span>
            </div>
            <div style={{ fontSize:12, opacity:0.8, marginTop:2 }}>{remaining>0?`${remaining} more to go`:'Target hit! 🎉'}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:28, fontWeight:800, fontFamily:'var(--font-display)' }}>{Math.round(pct)}%</div>
            <div style={{ fontSize:11, opacity:0.7 }}>complete</div>
          </div>
        </div>
        <div style={{ height:6, background:'rgba(255,255,255,0.25)', borderRadius:99 }}>
          <div style={{ height:'100%', width:`${pct}%`, background:'white', borderRadius:99, transition:'width 0.6s ease' }}/>
        </div>
      </div>

      {/* REMINDERS */}
      {reminders.length>0 && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14, boxShadow:'var(--shadow)' }}>
          <SectionHeader emoji="🔔" title="Reminders Due" count={reminders.length} color="var(--yellow)"/>
          {reminders.slice(0,3).map(r=>(
            <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:'#fffdf5', border:'1px solid rgba(217,119,6,0.2)', borderRadius:'var(--radius-sm)', marginBottom:6 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{r.leads?.clinic_name}</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>{r.message||r.type}</div>
              </div>
              <div style={{ display:'flex', gap:6 }} onClick={e=>e.stopPropagation()}>
                <a href={`tel:${r.leads?.phone}`} style={{ padding:'6px 8px', background:'var(--accent)', color:'white', borderRadius:'var(--radius-sm)', display:'flex', alignItems:'center' }}><Phone size={12}/></a>
                <button onClick={()=>markReminderDone(r.id)} style={{ padding:'6px 10px', background:'var(--green-bg)', color:'var(--green)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:'var(--radius-sm)', fontSize:11, fontWeight:700, cursor:'pointer' }}>✓ Done</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* OVERDUE */}
      {overdueLeads.length>0 && (
        <div style={{ background:'var(--bg2)', border:'1.5px solid rgba(220,38,38,0.3)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14, boxShadow:'var(--shadow)' }}>
          <SectionHeader emoji="🔴" title="Overdue — Call Now" count={overdueLeads.length} color="var(--red)"/>
          {overdueLeads.map(lead=>{
            const daysOver = differenceInDays(new Date(), parseISO(lead.next_follow_up_date))
            return <LeadRow key={lead.id} lead={lead} tag={`${daysOver}d overdue`} tagColor="var(--red)" tagBg="var(--red-bg)" note={lead.notes?.slice(0,50)} onClick={()=>navigate(`/leads/${lead.id}`)}/>
          })}
        </div>
      )}

      {/* TODAY */}
      {todayLeads.length>0 && (
        <div style={{ background:'var(--bg2)', border:'1.5px solid rgba(217,119,6,0.25)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14, boxShadow:'var(--shadow)' }}>
          <SectionHeader emoji="📅" title="Follow Up Today" count={todayLeads.length} color="var(--yellow)"/>
          {todayLeads.map(lead=>(
            <LeadRow key={lead.id} lead={lead} tag={STATUS_EMOJI[lead.status]+' '+lead.status.replace(/_/g,' ')} tagColor="var(--yellow)" tagBg="var(--yellow-bg)" note={lead.notes?.slice(0,50)} onClick={()=>navigate(`/leads/${lead.id}`)}/>
          ))}
        </div>
      )}

      {/* HOT */}
      {hotLeads.length>0 && (
        <div style={{ background:'var(--bg2)', border:'1.5px solid rgba(22,163,74,0.2)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14, boxShadow:'var(--shadow)' }}>
          <SectionHeader emoji="🔥" title="Hot — Push to Close" count={hotLeads.length} color="var(--green)"/>
          {hotLeads.map(lead=>(
            <LeadRow key={lead.id} lead={lead} tag={STATUS_EMOJI[lead.status]+' '+lead.status.replace(/_/g,' ')} tagColor="var(--green)" tagBg="var(--green-bg)" note={lead.notes?.slice(0,50)} onClick={()=>navigate(`/leads/${lead.id}`)}/>
          ))}
        </div>
      )}

      {/* DEMO GRAVEYARD */}
      {demoGhosts.length>0 && (
        <div style={{ background:'var(--bg2)', border:'1.5px solid rgba(124,58,237,0.2)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14, boxShadow:'var(--shadow)' }}>
          <SectionHeader emoji="👻" title="Demo Graveyard — Chase Them" count={demoGhosts.length} color="var(--purple)"/>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, background:'var(--purple-bg)', padding:'8px 10px', borderRadius:'var(--radius-sm)', fontStyle:'italic' }}>
            Demo sent but ghosting. Call and say: "Did you get a chance to check the website we built?"
          </div>
          {demoGhosts.map(lead=>{
            const daysSent = lead.demo_sent_date?differenceInDays(new Date(),parseISO(lead.demo_sent_date)):null
            return <LeadRow key={lead.id} lead={lead} tag={daysSent?`${daysSent}d silent`:'ghosting'} tagColor="var(--purple)" tagBg="var(--purple-bg)" note={lead.demo_link?`Demo: ${lead.demo_link.slice(0,30)}...`:undefined} onClick={()=>navigate(`/leads/${lead.id}`)}/>
          })}
        </div>
      )}

      {/* PARKED DUE */}
      {parkedLeads.length>0 && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14, boxShadow:'var(--shadow)' }}>
          <SectionHeader emoji="🔮" title="Parked — Time to Check In" count={parkedLeads.length} color="var(--blue)"/>
          {parkedLeads.map(lead=>(
            <div key={lead.id} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'stretch' }}>
              <div style={{ flex:1, marginBottom:0 }}>
                <LeadRow lead={lead} tag="parked" tagColor="var(--blue)" tagBg="var(--blue-bg)" note={lead.notes?.slice(0,50)} onClick={()=>navigate(`/leads/${lead.id}`)}/>
              </div>
              <button onClick={()=>setSnoozeTarget(lead)} style={{ padding:'0 10px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text3)', cursor:'pointer', fontSize:10, fontWeight:700, flexShrink:0 }}>
                ⏰<br/>Snooze
              </button>
            </div>
          ))}
        </div>
      )}

      {/* NEW LEADS */}
      {newLeads.length>0 && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14, boxShadow:'var(--shadow)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <span style={{ fontSize:15 }}>🆕</span>
            <span style={{ fontFamily:'var(--font-display)', fontSize:13, fontWeight:700 }}>New Leads — First Call</span>
            <span style={{ marginLeft:'auto' }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/leads')}>View All <ChevronRight size={12}/></button>
            </span>
          </div>
          {newLeads.slice(0,5).map(lead=>(
            <LeadRow key={lead.id} lead={lead} tag="never called" tagColor="var(--blue)" tagBg="var(--blue-bg)" onClick={()=>navigate(`/leads/${lead.id}`)}/>
          ))}
          {newLeads.length>5 && (
            <button onClick={()=>navigate('/leads')} style={{ width:'100%', padding:'10px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', fontSize:12, color:'var(--text3)', cursor:'pointer', fontWeight:600 }}>
              +{newLeads.length-5} more new leads →
            </button>
          )}
        </div>
      )}

      {/* ALL CLEAR */}
      {totalUrgent===0 && demoGhosts.length===0 && parkedLeads.length===0 && newLeads.length===0 && (
        <div style={{ textAlign:'center', padding:'48px 20px' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800, marginBottom:6 }}>All clear!</div>
          <div style={{ color:'var(--text3)', fontSize:13 }}>No pending actions. Import new leads or check your pipeline.</div>
          <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:20 }}>
            <button onClick={()=>navigate('/import')} className="btn btn-primary">Import Leads</button>
            <button onClick={()=>navigate('/leads')} className="btn btn-ghost">View All</button>
          </div>
        </div>
      )}

      {/* QUICK STATS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'Active', value:leads.length, emoji:'👥' },
          { label:'Hot', value:leads.filter(l=>['interested','negotiating'].includes(l.status)).length, emoji:'🔥' },
          { label:'Demos Out', value:leads.filter(l=>l.status==='demo_sent').length, emoji:'🖥️' },
        ].map(s=>(
          <div key={s.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'12px 14px', textAlign:'center', boxShadow:'var(--shadow)' }}>
            <div style={{ fontSize:18 }}>{s.emoji}</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800 }}>{s.value}</div>
            <div style={{ fontSize:10, color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* SNOOZE MODAL */}
      {snoozeTarget && <SnoozeModal lead={snoozeTarget} onSnooze={days=>snooze(snoozeTarget,days)} onClose={()=>setSnoozeTarget(null)}/>}
    </div>
  )
}
