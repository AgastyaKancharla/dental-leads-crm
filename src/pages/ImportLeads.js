import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Download, CheckCircle, ArrowRight } from 'lucide-react'

const COLUMN_OPTIONS = ['', 'clinic_name', 'doctor_name', 'phone', 'area', 'rating', 'notes', 'status', 'skip']

export default function ImportLeads() {
  const [sheetUrl, setSheetUrl] = useState('')
  const [csvText, setCsvText] = useState('')
  const [step, setStep] = useState(1) // 1: input, 2: map, 3: preview, 4: done
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  function parseCSV(text) {
    const lines = text.trim().split('\n').filter(Boolean)
    if (lines.length < 2) return { headers: [], rows: [] }
    const parseRow = line => {
      const result = []
      let cur = '', inQ = false
      for (let ch of line) {
        if (ch === '"') { inQ = !inQ } else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' } else { cur += ch }
      }
      result.push(cur.trim())
      return result
    }
    const headers = parseRow(lines[0])
    const rows = lines.slice(1).map(parseRow)
    return { headers, rows }
  }

  async function fetchSheet() {
    if (!sheetUrl && !csvText) { setError('Enter a Google Sheet URL or paste CSV data'); return }
    setFetching(true)
    setError('')

    try {
      let text = csvText
      if (sheetUrl && !csvText) {
        // Convert Google Sheets URL to CSV export URL
        let csvUrl = sheetUrl
        if (sheetUrl.includes('/edit')) {
          csvUrl = sheetUrl.replace('/edit', '/export?format=csv&')
        } else if (sheetUrl.includes('spreadsheets/d/')) {
          const match = sheetUrl.match(/spreadsheets\/d\/([^/]+)/)
          if (match) csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`
        }
        const resp = await fetch(csvUrl)
        if (!resp.ok) throw new Error('Could not fetch sheet. Make sure it is publicly shared.')
        text = await resp.text()
      }

      const { headers, rows } = parseCSV(text)
      if (!headers.length) throw new Error('Could not parse data. Check your sheet has headers in row 1.')

      setHeaders(headers)
      setRows(rows)

      // Auto-map common column names
      const autoMap = {}
      headers.forEach((h, i) => {
        const lower = h.toLowerCase().replace(/\s/g, '_')
        if (lower.includes('clinic') || lower.includes('hospital')) autoMap[i] = 'clinic_name'
        else if (lower.includes('doctor') || lower.includes('dr') || lower.includes('name')) autoMap[i] = 'doctor_name'
        else if (lower.includes('phone') || lower.includes('mobile') || lower.includes('contact')) autoMap[i] = 'phone'
        else if (lower.includes('area') || lower.includes('location') || lower.includes('city')) autoMap[i] = 'area'
        else if (lower.includes('rating') || lower.includes('stars')) autoMap[i] = 'rating'
        else if (lower.includes('note')) autoMap[i] = 'notes'
        else autoMap[i] = 'skip'
      })
      setMapping(autoMap)
      setStep(2)
    } catch (e) {
      setError(e.message)
    }
    setFetching(false)
  }

  async function importLeads() {
    setImporting(true)
    const leads = []
    const errors = []

    rows.forEach((row, ri) => {
      const lead = { status: 'new', priority: 'medium', source: 'google_sheets' }
      let hasPhone = false
      let hasName = false

      Object.entries(mapping).forEach(([colIdx, field]) => {
        if (field === 'skip' || !field) return
        const val = row[parseInt(colIdx)]?.trim()
        if (!val) return
        if (field === 'rating') lead.rating = parseFloat(val) || null
        else lead[field] = val
        if (field === 'phone') hasPhone = true
        if (field === 'clinic_name') hasName = true
      })

      if (!hasPhone) errors.push(`Row ${ri + 2}: Missing phone number — skipped`)
      else if (!hasName) errors.push(`Row ${ri + 2}: Missing clinic name — skipped`)
      else leads.push(lead)
    })

    let imported = 0
    let skipped = 0
    if (leads.length > 0) {
      // Insert in batches of 50
      for (let i = 0; i < leads.length; i += 50) {
        const batch = leads.slice(i, i + 50)
        const { data, error: insertErr } = await supabase.from('leads').insert(batch).select()
        if (!insertErr) imported += (data?.length || 0)
        else skipped += batch.length
      }
    }

    setImportResult({ imported, skipped: skipped + errors.length, errors })
    setImporting(false)
    setStep(4)
    window.__toast && window.__toast(`${imported} leads imported!`, 'success')
  }

  const reset = () => { setStep(1); setSheetUrl(''); setCsvText(''); setHeaders([]); setRows([]); setMapping({}); setImportResult(null); setError('') }

  const previewRows = rows.slice(0, 5)

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* PROGRESS */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 32, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {['Connect Sheet', 'Map Columns', 'Preview', 'Done'].map((label, i) => (
          <div key={i} style={{ flex: 1, padding: '12px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, background: step === i + 1 ? 'var(--accent-glow)' : 'transparent', color: step === i + 1 ? 'var(--accent2)' : step > i + 1 ? 'var(--green)' : 'var(--text3)', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
            {step > i + 1 ? '✓ ' : `${i + 1}. `}{label}
          </div>
        ))}
      </div>

      {/* STEP 1: INPUT */}
      {step === 1 && (
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Connect Your Google Sheet</h3>

          <div style={{ background: 'var(--blue-bg)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 24, fontSize: 13, color: 'var(--blue)' }}>
            <strong>How to share your Google Sheet:</strong><br />
            Open your sheet → File → Share → Change to "Anyone with the link can view" → Copy link
          </div>

          <div className="form-group">
            <label className="form-label">Google Sheet URL</label>
            <input className="form-input" placeholder="https://docs.google.com/spreadsheets/d/..." value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} />
          </div>

          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, margin: '16px 0' }}>— or —</div>

          <div className="form-group">
            <label className="form-label">Paste CSV Data</label>
            <textarea className="form-input" placeholder="Clinic Name,Doctor Name,Phone,Area&#10;Apollo Dental,Dr. Sharma,9876543210,Koramangala" value={csvText} onChange={e => setCsvText(e.target.value)} style={{ minHeight: 130, fontFamily: 'monospace', fontSize: 12 }} />
          </div>

          {error && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>
              ⚠️ {error}
            </div>
          )}

          <button className="btn btn-primary" onClick={fetchSheet} disabled={fetching} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
            {fetching ? <><div className="spinner" style={{ borderTopColor: 'white' }} /> Fetching...</> : <><Download size={15} /> Fetch & Parse Sheet</>}
          </button>
        </div>
      )}

      {/* STEP 2: MAP COLUMNS */}
      {step === 2 && (
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Map Your Columns</h3>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>We auto-detected the mapping. Review and adjust if needed. {rows.length} rows found.</p>

          <div className="table-wrap" style={{ marginBottom: 24 }}>
            <table>
              <thead>
                <tr><th>Your Column Header</th><th>Maps To</th><th>Sample Value</th></tr>
              </thead>
              <tbody>
                {headers.map((h, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{h}</td>
                    <td>
                      <select className="form-input" style={{ padding: '6px 10px', width: 'auto' }} value={mapping[i] || ''} onChange={e => setMapping(m => ({ ...m, [i]: e.target.value }))}>
                        {COLUMN_OPTIONS.map(o => <option key={o} value={o}>{o === '' ? '— Select —' : o === 'skip' ? '⏭ Skip' : o.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                      </select>
                    </td>
                    <td style={{ color: 'var(--text3)', fontSize: 12 }}>{rows[0]?.[i] || '—'}</td>
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

      {/* STEP 3: PREVIEW */}
      {step === 3 && (
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Preview Import</h3>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>First 5 rows shown. {rows.length} total rows will be imported.</p>

          <div className="table-wrap" style={{ marginBottom: 24, overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  {Object.entries(mapping).filter(([, v]) => v && v !== 'skip').map(([i, field]) => (
                    <th key={i}>{field.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, ri) => (
                  <tr key={ri}>
                    {Object.entries(mapping).filter(([, v]) => v && v !== 'skip').map(([colIdx]) => (
                      <td key={colIdx} style={{ fontSize: 12 }}>{row[parseInt(colIdx)] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: 'var(--yellow-bg)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', fontSize: 13, color: 'var(--yellow)', marginBottom: 20 }}>
            ⚠️ Rows without a phone number or clinic name will be skipped automatically.
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-primary" onClick={importLeads} disabled={importing} style={{ minWidth: 140, justifyContent: 'center' }}>
              {importing ? <><div className="spinner" style={{ borderTopColor: 'white' }} /> Importing...</> : `Import ${rows.length} Leads`}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: DONE */}
      {step === 4 && importResult && (
        <div className="card" style={{ textAlign: 'center' }}>
          <CheckCircle size={56} color="var(--green)" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Import Complete!</h2>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', margin: '24px 0' }}>
            <div className="stat-card" style={{ minWidth: 130 }}>
              <div className="stat-label">Imported</div>
              <div className="stat-value" style={{ color: 'var(--green)' }}>{importResult.imported}</div>
            </div>
            <div className="stat-card" style={{ minWidth: 130 }}>
              <div className="stat-label">Skipped</div>
              <div className="stat-value" style={{ color: 'var(--yellow)' }}>{importResult.skipped}</div>
            </div>
          </div>
          {importResult.errors.length > 0 && (
            <div style={{ background: 'var(--yellow-bg)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: 20, textAlign: 'left' }}>
              {importResult.errors.slice(0, 5).map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--yellow)', marginBottom: 3 }}>⚠ {e}</div>)}
              {importResult.errors.length > 5 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>+{importResult.errors.length - 5} more</div>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-ghost" onClick={reset}>Import More</button>
            <button className="btn btn-primary" onClick={() => window.location.href = '/leads'}>View All Leads</button>
          </div>
        </div>
      )}
    </div>
  )
}
