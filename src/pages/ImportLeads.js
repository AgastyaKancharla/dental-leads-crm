/* eslint-disable */
import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Download, CheckCircle, ArrowRight, Upload, Info, Zap, FileText } from 'lucide-react'

// ─── OUTSCRAPER FIELD MAP ────────────────────────────────────────────────────
// Maps Outscraper column names → our lead fields
const OUTSCRAPER_MAP = {
  name:         'clinic_name',
  phone:        'phone',
  city:         'area',
  rating:       'rating',
  reviews:      'review_count',
  website:      'website_url',
  business_status: 'business_status',
  address:      'address',
  state:        'state',
  description:  'description',
}

// Auto-priority from rating + review count
function calcPriority(rating, reviews) {
  const r = parseFloat(rating) || 0
  const rv = parseInt(reviews) || 0
  if (r >= 4.5 && rv >= 100) return 'high'
  if (r >= 4.0 && rv >= 30)  return 'medium'
  if (r < 3.5 || rv < 5)    return 'low'
  return 'medium'
}

// Extract Bengaluru area from address
function extractArea(city, address) {
  if (!address && !city) return null
  const AREAS = ['Koramangala','Indiranagar','Whitefield','HSR Layout','JP Nagar','Jayanagar','BTM Layout','Electronic City','Marathahalli','Bannerghatta Road','Yelahanka','Hebbal','Rajajinagar','Malleshwaram','RT Nagar','Kumaraswamy Layout','Banashankari','Basavanagudi','Vijayanagar','Nagarbhavi','Kengeri','Sarjapur','Bellandur','Kasturi Nagar','Banaswadi','Rammurthy Nagar','Kalyan Nagar','HBR Layout','CV Raman Nagar','Domlur','Ejipura','Vivek Nagar','Shivaji Nagar','MG Road','Brigade Road']
  const combined = (address || '') + ' ' + (city || '')
  for (const area of AREAS) {
    if (combined.toLowerCase().includes(area.toLowerCase())) return area
  }
  return city || null
}

// Clean phone
function cleanPhone(val) {
  if (!val) return ''
  return val.toString().replace(/[\s\-\(\)]/g, '').replace(/^\+91/, '').replace(/^91/, '').trim()
}

// Parse CSV (handles comma + tab separated)
function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const isTab = lines[0].split('\t').length > lines[0].split(',').length
  if (isTab) {
    return {
      headers: lines[0].split('\t').map(h => h.trim().replace(/^"|"$/g, '')),
      rows: lines.slice(1).map(l => l.split('\t').map(c => c.trim().replace(/^"|"$/g, '')))
    }
  }
  const parseRow = line => {
    const result = []; let cur = '', inQ = false
    for (let ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    result.push(cur.trim())
    return result
  }
  return {
    headers: parseRow(lines[0]).map(h => h.replace(/^"|"$/g, '')),
    rows: lines.slice(1).map(parseRow).map(r => r.map(c => c.replace(/^"|"$/g, '')))
  }
}

function extractSheetId(url) {
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}
function extractGid(url) {
  const match = url.match(/gid=(\d+)/)
  return match ? match[1] : '0'
}

// ─── CUSTOM SHEET IMPORT (existing logic) ────────────────────────────────────
const COLUMN_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'clinic_name', label: 'Clinic Name' },
  { value: 'doctor_name', label: 'Doctor Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'area', label: 'Area / Location' },
  { value: 'rating', label: 'Rating / Stars' },
  { value: 'priority', label: 'Priority' },
  { value: 'call_status', label: 'Call Status' },
  { value: 'called_date', label: 'Called Date' },
  { value: 'follow_up_date', label: 'Follow Up Date' },
  { value: 'response', label: 'Response / Outcome' },
  { value: 'whatsapp_sent', label: 'WhatsApp Sent' },
  { value: 'meeting_fixed', label: 'Meeting Fixed' },
  { value: 'closed', label: 'Closed' },
  { value: 'amount', label: 'Amount (₹)' },
  { value: 'notes', label: 'Call Notes' },
  { value: 'website_url', label: 'Website URL' },
  { value: 'skip', label: '⏭ Skip this column' },
]
function mapResponse(val) {
  if (!val) return 'other'
  const v = val.toLowerCase().trim()
  if (v.includes('interest') && !v.includes('not') && !v.includes('future')) return 'interested'
  if (v.includes('future') || v.includes('later') || v.includes('not now')) return 'callback'
  if (v.includes('not interest') || v.includes('no interest') || v.includes('decline')) return 'not_interested'
  if (v.includes('no answer') || v.includes('not pick') || v.includes('not reachable') || v.includes('busy')) return 'no_answer'
  if (v.includes('demo')) return 'demo_requested'
  if (v.includes('close') || v.includes('convert') || v.includes('paid')) return 'closed'
  if (v.includes('callback') || v.includes('call back')) return 'callback'
  return 'other'
}
function mapLeadStatus(callStatus, response, closed) {
  if (closed && (closed.toLowerCase() === 'yes' || closed === '1')) return 'closed'
  const r = (response || '').toLowerCase()
  const c = (callStatus || '').toLowerCase()
  if (r.includes('future') || r.includes('later')) return 'interested'
  if (r.includes('not interest') || r.includes('decline')) return 'dead'
  if (r.includes('demo') || r.includes('convert') || r.includes('send')) return 'demo_sent'
  if (r.includes('interest') && !r.includes('not')) return 'interested'
  if (c.includes('not call') || c.includes('not connected') || !c) return 'new'
  if (c.includes('call')) return 'called'
  return 'new'
}
function mapNextAction(response) {
  if (!response) return 'call'
  const v = response.toLowerCase()
  if (v.includes('whatsapp') || v.includes('wa ')) return 'whatsapp'
  if (v.includes('demo')) return 'send_demo'
  if (v.includes('meeting')) return 'meeting'
  return 'call'
}
function parseDate(val) {
  if (!val) return null
  val = val.toString().trim()
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 }
  const m1 = val.match(/^([a-zA-Z]+)\s+(\d+)/i)
  if (m1) { const mon = months[m1[1].toLowerCase().slice(0,3)]; if (mon) return `${new Date().getFullYear()}-${String(mon).padStart(2,'0')}-${String(m1[2]).padStart(2,'0')}` }
  const m2 = val.match(/^(\d+)[- /]([a-zA-Z]+)/i)
  if (m2) { const mon = months[m2[2].toLowerCase().slice(0,3)]; if (mon) return `${new Date().getFullYear()}-${String(mon).padStart(2,'0')}-${String(m2[1]).padStart(2,'0')}` }
  const m3 = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m3) { const year = m3[3].length === 2 ? '20' + m3[3] : m3[3]; return `${year}-${String(m3[2]).padStart(2,'0')}-${String(m3[1]).padStart(2,'0')}` }
  if (val.match(/^(\d{4})-(\d{2})-(\d{2})$/)) return val
  return null
}
function cleanPhoneCustom(val) {
  if (!val) return ''
  return val.toString().replace(/[\s\-\(\)]/g, '').replace(/^\+91/, '').replace(/^91/, '').trim()
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ImportLeads() {
  const [tab, setTab] = useState('outscraper') // 'outscraper' | 'custom'

  // Outscraper state
  const [osUrl, setOsUrl] = useState('')
  const [osCsvText, setOsCsvText] = useState('')
  const [osFetching, setOsFetching] = useState('')
  const [osError, setOsError] = useState('')
  const [osPreview, setOsPreview] = useState(null) // { leads, skipped }
  const [osImporting, setOsImporting] = useState(false)
  const [osResult, setOsResult] = useState(null)
  const [osStep, setOsStep] = useState(1)

  // Custom state (existing)
  const [sheetUrl, setSheetUrl] = useState('')
  const [csvText, setCsvText] = useState('')
  const [step, setStep] = useState(1)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  // ── OUTSCRAPER: Parse raw data into lead objects ──
  function parseOutscraperData(text) {
    const { headers, rows } = parseCSV(text)
    if (!headers.length) throw new Error('Could not parse — check the file has headers in row 1')

    // Check it looks like Outscraper
    const hasName = headers.some(h => h.toLowerCase() === 'name')
    const hasPhone = headers.some(h => h.toLowerCase() === 'phone')
    if (!hasName && !hasPhone) throw new Error('This doesn\'t look like an Outscraper export. Expected columns: name, phone, city, rating...')

    const hIdx = {} // column name → index
    headers.forEach((h, i) => { hIdx[h.toLowerCase()] = i })

    const get = (row, col) => row[hIdx[col]] || ''

    const leads = []
    const skippedRows = []

    rows.forEach((row, ri) => {
      const phone = cleanPhone(get(row, 'phone'))
      const name = get(row, 'name')
      const businessStatus = get(row, 'business_status').toLowerCase()

      // Skip permanently closed
      if (businessStatus === 'closed_permanently' || businessStatus === 'closed_temporarily') {
        skippedRows.push({ row: ri + 2, reason: `${name || 'Row '+(ri+2)} — business closed` })
        return
      }

      if (!name && !phone) {
        skippedRows.push({ row: ri + 2, reason: `Row ${ri + 2} — no name or phone` })
        return
      }

      const rating = parseFloat(get(row, 'rating')) || null
      const reviewCount = parseInt(get(row, 'reviews')) || 0
      const website = get(row, 'website') || null
      const city = get(row, 'city')
      const address = get(row, 'address')
      const area = extractArea(city, address)

      leads.push({
        clinic_name: name || 'Unknown Clinic',
        phone,
        area,
        rating,
        review_count: reviewCount,
        website_url: website || null,
        has_website: !!website,
        priority: calcPriority(rating, reviewCount),
        status: 'new',
        source: 'outscraper',
        notes: [
          website ? `Website: ${website}` : 'No website found',
          reviewCount ? `${reviewCount} Google reviews` : null,
          address ? `Address: ${address}` : null,
        ].filter(Boolean).join(' | '),
        next_action: 'call',
      })
    })

    return { leads, skippedRows }
  }

  // ── OUTSCRAPER: Fetch + parse ──
  async function fetchOutscraper() {
    if (!osUrl && !osCsvText) { setOsError('Enter a Google Sheet URL or upload a CSV file'); return }
    setOsFetching(true)
    setOsError('')
    try {
      let text = osCsvText
      if (osUrl && !osCsvText) {
        const sheetId = extractSheetId(osUrl)
        if (!sheetId) throw new Error('Invalid Google Sheet URL')
        const gid = extractGid(osUrl)
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(csvUrl)}`
        let resp = await fetch(proxyUrl)
        if (!resp.ok) resp = await fetch(csvUrl)
        if (!resp.ok) throw new Error('Could not fetch. Make sure sheet is shared as "Anyone with link can view"')
        text = await resp.text()
        if (text.includes('<!DOCTYPE') || text.includes('<html')) throw new Error('Sheet is not publicly shared')
      }
      const { leads, skippedRows } = parseOutscraperData(text)
      if (!leads.length) throw new Error('No valid leads found in the data')
      setOsPreview({ leads, skippedRows })
      setOsStep(2)
    } catch (e) {
      setOsError(e.message)
    }
    setOsFetching(false)
  }

  function handleOsFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setOsCsvText(ev.target.result); setOsUrl('') }
    reader.readAsText(file)
  }

  // ── OUTSCRAPER: Import to Supabase ──
  async function importOutscraper() {
    if (!osPreview?.leads?.length) return
    setOsImporting(true)

    // Fetch existing phones to skip duplicates
    const { data: existing } = await supabase.from('leads').select('phone')
    const existingPhones = new Set((existing || []).map(l => l.phone))

    let imported = 0, dupes = 0, errors = 0

    for (const lead of osPreview.leads) {
      if (existingPhones.has(lead.phone) && lead.phone) {
        dupes++
        continue
      }
      const { error: err } = await supabase.from('leads').insert({
        clinic_name: lead.clinic_name,
        phone: lead.phone,
        area: lead.area,
        rating: lead.rating,
        priority: lead.priority,
        status: lead.status,
        source: lead.source,
        notes: lead.notes,
        next_action: lead.next_action,
      })
      if (err) { errors++; continue }
      imported++
    }

    setOsResult({ imported, dupes, errors, total: osPreview.leads.length })
    setOsImporting(false)
    setOsStep(3)
    window.__toast && window.__toast(`${imported} leads imported!`, 'success')
  }

  function resetOs() { setOsStep(1); setOsUrl(''); setOsCsvText(''); setOsPreview(null); setOsResult(null); setOsError('') }

  // ── CUSTOM: existing logic ──
  async function fetchSheet() {
    if (!sheetUrl && !csvText) { setError('Enter a Google Sheet URL or paste CSV data'); return }
    setFetching(true); setError('')
    try {
      let text = csvText
      if (sheetUrl && !csvText) {
        const sheetId = extractSheetId(sheetUrl)
        if (!sheetId) throw new Error('Invalid Google Sheet URL.')
        const gid = extractGid(sheetUrl)
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(csvUrl)}`
        let resp = await fetch(proxyUrl)
        if (!resp.ok) resp = await fetch(csvUrl)
        if (!resp.ok) throw new Error('Could not fetch. Make sure sheet is set to "Anyone with link can view"')
        text = await resp.text()
        if (text.includes('<!DOCTYPE') || text.includes('<html')) throw new Error('Sheet is not publicly shared.')
      }
      const { headers: hdrs, rows: rws } = parseCSV(text)
      if (!hdrs.length) throw new Error('Could not parse. Check your sheet has headers in row 1.')
      setHeaders(hdrs); setRows(rws)
      const autoMap = {}
      hdrs.forEach((h, i) => {
        const lower = h.toLowerCase().replace(/[\s_\-\(\)]/g, '')
        if (lower.includes('clinic') || lower.includes('hospital') || lower.includes('name')) autoMap[i] = 'clinic_name'
        else if (lower.includes('doctor') || lower.includes('dr')) autoMap[i] = 'doctor_name'
        else if (lower.includes('phone') || lower.includes('mobile') || lower.includes('contact') || lower === 'no') autoMap[i] = 'phone'
        else if (lower.includes('area') || lower.includes('location') || lower.includes('city')) autoMap[i] = 'area'
        else if (lower.includes('rating') || lower.includes('star') || lower.includes('score')) autoMap[i] = 'rating'
        else if (lower.includes('priority')) autoMap[i] = 'priority'
        else if (lower.includes('callstatus') || lower.includes('status')) autoMap[i] = 'call_status'
        else if (lower.includes('followup') || lower.includes('follow')) autoMap[i] = 'follow_up_date'
        else if (lower.includes('response') || lower.includes('outcome') || lower.includes('result')) autoMap[i] = 'response'
        else if (lower.includes('whatsapp') || lower.includes('wa')) autoMap[i] = 'whatsapp_sent'
        else if (lower.includes('meeting')) autoMap[i] = 'meeting_fixed'
        else if (lower.includes('closed') || lower.includes('converted')) autoMap[i] = 'closed'
        else if (lower.includes('amount') || lower.includes('value') || lower.includes('₹')) autoMap[i] = 'amount'
        else if (lower.includes('note') || lower.includes('remark') || lower.includes('comment')) autoMap[i] = 'notes'
        else if (lower.includes('website') || lower.includes('url') || lower.includes('link')) autoMap[i] = 'website_url'
        else autoMap[i] = 'skip'
      })
      setMapping(autoMap); setStep(2)
    } catch (e) { setError(e.message) }
    setFetching(false)
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setCsvText(ev.target.result); setSheetUrl('') }
    reader.readAsText(file)
  }

  async function importLeads() {
    setImporting(true)
    const leadsToInsert = []; const errors = []
    rows.forEach((row, ri) => {
      const raw = {}
      Object.entries(mapping).forEach(([colIdx, field]) => {
        if (!field || field === 'skip') return
        const val = row[parseInt(colIdx)]?.toString().trim()
        if (val) raw[field] = val
      })
      if (!raw.phone && !raw.clinic_name) { errors.push(`Row ${ri + 2}: No phone or clinic name — skipped`); return }
      const leadStatus = mapLeadStatus(raw.call_status, raw.response, raw.closed)
      const lead = {
        clinic_name: raw.clinic_name || `Clinic Row ${ri + 2}`,
        doctor_name: raw.doctor_name || null,
        phone: cleanPhoneCustom(raw.phone || ''),
        area: raw.area || null,
        rating: raw.rating ? parseFloat(raw.rating) : null,
        priority: raw.priority ? raw.priority.toLowerCase() : 'medium',
        status: leadStatus, source: 'google_sheets',
        notes: raw.notes || null,
        next_follow_up_date: parseDate(raw.follow_up_date),
        next_action: mapNextAction(raw.response),
        estimated_value: raw.amount ? parseFloat(raw.amount.replace(/[^0-9.]/g, '')) : null,
      }
      leadsToInsert.push({ lead, raw, rowIndex: ri + 2 })
    })
    let imported = 0, callLogsCreated = 0, skipped = 0
    for (const { lead, raw, rowIndex } of leadsToInsert) {
      try {
        const { data, error: err } = await supabase.from('leads').insert(lead).select().single()
        if (err || !data) { skipped++; errors.push(`Row ${rowIndex}: DB error — ${err?.message}`); continue }
        imported++
        const hasCallInfo = raw.response || raw.notes || raw.called_date || raw.call_status
        const wasCalled = raw.call_status && !raw.call_status.toLowerCase().includes('not call')
        if (hasCallInfo && wasCalled) {
          const callLog = {
            lead_id: data.id,
            called_at: parseDate(raw.called_date) ? new Date(parseDate(raw.called_date)).toISOString() : new Date().toISOString(),
            outcome: mapResponse(raw.response),
            notes: [raw.notes, raw.response && raw.response !== raw.notes ? `Response: ${raw.response}` : null, raw.whatsapp_sent?.toLowerCase() === 'yes' ? 'WhatsApp sent ✓' : null, raw.meeting_fixed?.toLowerCase() === 'yes' ? 'Meeting fixed ✓' : null, raw.website_url ? `Existing website: ${raw.website_url}` : null].filter(Boolean).join('\n'),
            next_follow_up_date: parseDate(raw.follow_up_date),
            next_action: mapNextAction(raw.response),
          }
          const { error: clErr } = await supabase.from('call_logs').insert(callLog)
          if (!clErr) callLogsCreated++
        }
      } catch (e) { skipped++; errors.push(`Row ${rowIndex}: ${e.message}`) }
    }
    setImportResult({ imported, callLogsCreated, skipped, errors })
    setImporting(false); setStep(4)
    window.__toast && window.__toast(`${imported} leads imported with ${callLogsCreated} call logs!`, 'success')
  }

  const reset = () => { setStep(1); setSheetUrl(''); setCsvText(''); setHeaders([]); setRows([]); setMapping({}); setImportResult(null); setError('') }

  // ── PRIORITY BADGE ──
  const PRI = { high: { bg: 'rgba(248,113,113,0.12)', color: '#f87171', label: 'High' }, medium: { bg: 'rgba(251,146,60,0.1)', color: '#fb923c', label: 'Medium' }, low: { bg: 'rgba(52,211,153,0.08)', color: '#34d399', label: 'Low' } }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* TAB SWITCHER */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <button onClick={() => setTab('outscraper')} style={{ flex: 1, padding: '13px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: tab === 'outscraper' ? 'var(--accent-glow)' : 'transparent', color: tab === 'outscraper' ? 'var(--accent2)' : 'var(--text3)', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <Zap size={14} /> Outscraper Import
        </button>
        <button onClick={() => setTab('custom')} style={{ flex: 1, padding: '13px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: tab === 'custom' ? 'var(--accent-glow)' : 'transparent', color: tab === 'custom' ? 'var(--accent2)' : 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <FileText size={14} /> Custom Sheet
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* OUTSCRAPER TAB                                         */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === 'outscraper' && (
        <div>
          {/* STEP 1 — Upload */}
          {osStep === 1 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Zap size={18} color="var(--accent2)" />
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>Import from Outscraper</h3>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>No column mapping needed — we auto-detect everything from your Outscraper export.</p>

              {/* What gets auto-done */}
              <div style={{ background: 'var(--green-bg)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 20, fontSize: 13, color: 'var(--green)', lineHeight: 1.9 }}>
                <strong>✅ Auto-detected from Outscraper data:</strong><br />
                • Clinic name, phone, area (extracted from address + city)<br />
                • Google rating + review count → <strong>auto-sets priority</strong> (High / Medium / Low)<br />
                • Website presence → saved in notes<br />
                • Permanently closed businesses → <strong>auto-skipped</strong><br />
                • Duplicate phone numbers → <strong>auto-skipped</strong>
              </div>

              <div style={{ background: 'var(--blue-bg)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--blue)', lineHeight: 1.7 }}>
                <strong>📋 To use Google Sheet URL:</strong> Open Outscraper sheet → File → Share → "Anyone with the link" → Viewer → Copy link
              </div>

              <div className="form-group">
                <label className="form-label">Google Sheet URL</label>
                <input className="form-input" placeholder="https://docs.google.com/spreadsheets/d/..." value={osUrl} onChange={e => { setOsUrl(e.target.value); setOsCsvText('') }} />
              </div>

              <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, margin: '14px 0' }}>— or upload CSV —</div>

              <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: '24px', textAlign: 'center', cursor: 'pointer', marginBottom: 14 }}
                onClick={() => document.getElementById('os-upload').click()}>
                <input id="os-upload" type="file" accept=".csv,.txt,.tsv" style={{ display: 'none' }} onChange={handleOsFile} />
                <Upload size={22} style={{ margin: '0 auto 8px', color: 'var(--text3)' }} />
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>Upload Outscraper CSV export</div>
                {osCsvText && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>✅ File loaded — {osCsvText.split('\n').filter(Boolean).length - 1} rows detected</div>}
              </div>

              {osError && <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 14 }}>⚠️ {osError}</div>}

              <button className="btn btn-primary" onClick={fetchOutscraper} disabled={!!osFetching} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                {osFetching ? <><div className="spinner" style={{ borderTopColor: 'white' }} /> Parsing...</> : <><Zap size={15} /> Parse Outscraper Data</>}
              </button>
            </div>
          )}

          {/* STEP 2 — Preview */}
          {osStep === 2 && osPreview && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Preview — {osPreview.leads.length} Leads Ready</h3>
              <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Showing first 8 rows. Duplicates will be skipped at import time.</p>

              {/* Priority breakdown */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                {['high','medium','low'].map(p => {
                  const count = osPreview.leads.filter(l => l.priority === p).length
                  return (
                    <div key={p} style={{ background: PRI[p].bg, color: PRI[p].color, border: `1px solid ${PRI[p].color}33`, borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 700 }}>
                      {PRI[p].label} Priority: {count}
                    </div>
                  )
                })}
                {osPreview.skippedRows.length > 0 && (
                  <div style={{ background: 'var(--bg3)', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 700 }}>
                    Auto-skipped: {osPreview.skippedRows.length}
                  </div>
                )}
              </div>

              <div className="table-wrap" style={{ marginBottom: 20 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Clinic</th>
                      <th>Phone</th>
                      <th>Area</th>
                      <th>Rating</th>
                      <th>Reviews</th>
                      <th>Website</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {osPreview.leads.slice(0, 8).map((l, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, fontSize: 13 }}>{l.clinic_name}</td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{l.phone || '—'}</td>
                        <td style={{ fontSize: 12 }}>{l.area || '—'}</td>
                        <td style={{ fontSize: 12 }}>{l.rating ? `⭐ ${l.rating}` : '—'}</td>
                        <td style={{ fontSize: 12 }}>{l.review_count || '—'}</td>
                        <td style={{ fontSize: 12 }}>{l.has_website ? <span style={{ color: 'var(--green)' }}>✅ Yes</span> : <span style={{ color: 'var(--text3)' }}>❌ No</span>}</td>
                        <td>
                          <span style={{ background: PRI[l.priority]?.bg, color: PRI[l.priority]?.color, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                            {PRI[l.priority]?.label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {osPreview.skippedRows.length > 0 && (
                <div style={{ background: 'var(--yellow-bg)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 12, color: 'var(--yellow)', marginBottom: 16 }}>
                  <strong>⚠️ Auto-skipped {osPreview.skippedRows.length} rows:</strong><br />
                  {osPreview.skippedRows.slice(0, 3).map((s, i) => <div key={i}>• {s.reason}</div>)}
                  {osPreview.skippedRows.length > 3 && <div>+ {osPreview.skippedRows.length - 3} more</div>}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={resetOs}>Start Over</button>
                <button className="btn btn-primary" onClick={importOutscraper} disabled={osImporting} style={{ minWidth: 200, justifyContent: 'center' }}>
                  {osImporting ? <><div className="spinner" style={{ borderTopColor: 'white' }} /> Importing...</> : `Import ${osPreview.leads.length} Leads →`}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Done */}
          {osStep === 3 && osResult && (
            <div className="card" style={{ textAlign: 'center' }}>
              <CheckCircle size={56} color="var(--green)" style={{ margin: '0 auto 20px' }} />
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Import Complete!</h2>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', margin: '24px 0', flexWrap: 'wrap' }}>
                <div className="stat-card" style={{ minWidth: 120 }}>
                  <div className="stat-label">Leads Imported</div>
                  <div className="stat-value" style={{ color: 'var(--green)' }}>{osResult.imported}</div>
                </div>
                <div className="stat-card" style={{ minWidth: 120 }}>
                  <div className="stat-label">Duplicates Skipped</div>
                  <div className="stat-value" style={{ color: 'var(--yellow)' }}>{osResult.dupes}</div>
                </div>
                <div className="stat-card" style={{ minWidth: 120 }}>
                  <div className="stat-label">Errors</div>
                  <div className="stat-value" style={{ color: 'var(--red)' }}>{osResult.errors}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={resetOs}>Import More</button>
                <button className="btn btn-primary" onClick={() => window.location.href = '/leads'}>View All Leads →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CUSTOM SHEET TAB (existing)                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === 'custom' && (
        <div>
          {/* PROGRESS */}
          <div style={{ display: 'flex', marginBottom: 28, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {['Connect Sheet', 'Map Columns', 'Preview', 'Done'].map((label, i) => (
              <div key={i} style={{ flex: 1, padding: '12px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, background: step === i + 1 ? 'var(--accent-glow)' : 'transparent', color: step === i + 1 ? 'var(--accent2)' : step > i + 1 ? 'var(--green)' : 'var(--text3)', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
                {step > i + 1 ? '✓ ' : `${i + 1}. `}{label}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Connect Your Google Sheet</h3>
              <div style={{ background: 'var(--green-bg)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 20, fontSize: 13, color: 'var(--green)', lineHeight: 1.8 }}>
                <strong>✅ What gets imported from your sheet:</strong><br />
                • Lead info — Clinic, Doctor, Phone, Area, Rating, Priority<br />
                • Call history — Called date, Response, Notes → saved as a <strong>Call Log</strong><br />
                • Follow up date, WhatsApp sent, Meeting fixed → saved on the lead
              </div>
              <div style={{ background: 'var(--blue-bg)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--blue)', lineHeight: 1.7 }}>
                <strong>📋 To use Google Sheet URL:</strong> Open sheet → File → Share → "Anyone with the link" → Viewer → Copy link
              </div>
              <div className="form-group">
                <label className="form-label">Google Sheet URL</label>
                <input className="form-input" placeholder="https://docs.google.com/spreadsheets/d/..." value={sheetUrl} onChange={e => { setSheetUrl(e.target.value); setCsvText('') }} />
              </div>
              <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, margin: '14px 0' }}>— or upload CSV / paste data —</div>
              <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: 14 }}
                onClick={() => document.getElementById('csv-upload').click()}>
                <input id="csv-upload" type="file" accept=".csv,.txt,.tsv" style={{ display: 'none' }} onChange={handleFileUpload} />
                <Upload size={22} style={{ margin: '0 auto 8px', color: 'var(--text3)' }} />
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>Upload CSV file</div>
              </div>
              <div className="form-group">
                <label className="form-label">Or Paste CSV / Tab-separated Data</label>
                <textarea className="form-input" placeholder={"Clinic Name\tPhone\tArea\nApollo Dental\t9876543210\tKoramangala"} value={csvText} onChange={e => { setCsvText(e.target.value); setSheetUrl('') }} style={{ minHeight: 100, fontFamily: 'monospace', fontSize: 12 }} />
              </div>
              {csvText && <div style={{ background: 'var(--green-bg)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--green)', marginBottom: 14 }}>✅ {csvText.split('\n').filter(Boolean).length - 1} data rows detected</div>}
              {error && <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 14 }}>⚠️ {error}</div>}
              <button className="btn btn-primary" onClick={fetchSheet} disabled={fetching} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                {fetching ? <><div className="spinner" style={{ borderTopColor: 'white' }} /> Fetching...</> : <><Download size={15} /> Fetch & Parse Data</>}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Map Your Columns</h3>
              <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 6 }}>We auto-detected the mapping. Review and adjust. <strong>{rows.length} rows</strong> found.</p>
              <div style={{ background: 'var(--yellow-bg)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 12, color: 'var(--yellow)', marginBottom: 18 }}>
                💡 Map <strong>Response/Outcome</strong> and <strong>Call Notes</strong> columns — these will be saved as call history on each lead
              </div>
              <div className="table-wrap" style={{ marginBottom: 20 }}>
                <table>
                  <thead><tr><th>Your Column Header</th><th>Maps To</th><th>Sample Value</th></tr></thead>
                  <tbody>
                    {headers.map((h, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{h || `Column ${i + 1}`}</td>
                        <td>
                          <select className="form-input" style={{ padding: '6px 10px', width: 'auto', minWidth: 180 }} value={mapping[i] || ''} onChange={e => setMapping(m => ({ ...m, [i]: e.target.value }))}>
                            {COLUMN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td style={{ color: 'var(--text3)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rows[0]?.[i] || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={reset}>Start Over</button>
                <button className="btn btn-primary" onClick={() => setStep(3)}>Preview <ArrowRight size={14} /></button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Preview Import</h3>
              <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>First 5 rows shown. <strong>{rows.length} total leads</strong> will be imported.</p>
              <div className="table-wrap" style={{ marginBottom: 20, overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>{Object.entries(mapping).filter(([, v]) => v && v !== 'skip').map(([i, field]) => <th key={i}>{COLUMN_OPTIONS.find(o => o.value === field)?.label || field}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, ri) => (
                      <tr key={ri}>{Object.entries(mapping).filter(([, v]) => v && v !== 'skip').map(([colIdx]) => <td key={colIdx} style={{ fontSize: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[parseInt(colIdx)] || '—'}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
                <button className="btn btn-primary" onClick={importLeads} disabled={importing} style={{ minWidth: 180, justifyContent: 'center' }}>
                  {importing ? <><div className="spinner" style={{ borderTopColor: 'white' }} /> Importing...</> : `Import ${rows.length} Leads →`}
                </button>
              </div>
            </div>
          )}

          {step === 4 && importResult && (
            <div className="card" style={{ textAlign: 'center' }}>
              <CheckCircle size={56} color="var(--green)" style={{ margin: '0 auto 20px' }} />
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Import Complete!</h2>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', margin: '24px 0', flexWrap: 'wrap' }}>
                <div className="stat-card" style={{ minWidth: 120 }}><div className="stat-label">Leads Imported</div><div className="stat-value" style={{ color: 'var(--green)' }}>{importResult.imported}</div></div>
                <div className="stat-card" style={{ minWidth: 120 }}><div className="stat-label">Call Logs Created</div><div className="stat-value" style={{ color: 'var(--accent2)' }}>{importResult.callLogsCreated}</div></div>
                <div className="stat-card" style={{ minWidth: 120 }}><div className="stat-label">Skipped</div><div className="stat-value" style={{ color: 'var(--yellow)' }}>{importResult.skipped}</div></div>
              </div>
              {importResult.errors.length > 0 && (
                <div style={{ background: 'var(--yellow-bg)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: 20, textAlign: 'left' }}>
                  {importResult.errors.slice(0, 5).map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--yellow)', marginBottom: 3 }}>⚠ {e}</div>)}
                  {importResult.errors.length > 5 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>+{importResult.errors.length - 5} more</div>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={reset}>Import More</button>
                <button className="btn btn-primary" onClick={() => window.location.href = '/leads'}>View All Leads →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
