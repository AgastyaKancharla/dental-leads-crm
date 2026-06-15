/* eslint-disable */
// ─── SINGLE SOURCE OF TRUTH FOR LEAD STATUSES ───────────────────────────────
// Add a new status here and it auto-propagates everywhere in the app.
//
// Fields per entry:
//   key       – DB value (snake_case)
//   label     – human-readable display name
//   emoji     – used in badges, timelines, dropdowns
//   badge     – CSS class (must exist in index.css)
//   bucket    – 'active' | 'hot' | 'parked' | 'closed'
//               active  → shows in Active section
//               hot     → shows in Hot section (highest priority)
//               parked  → shows in Parked section
//               closed  → shows in Closed & Dead section
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS_CONFIG = [
  // ── Active / in-progress ──────────────────────────────────────────────────
  { key: 'new',               label: 'New',               emoji: '🆕', badge: 'badge-new',         bucket: 'active'  },
  { key: 'called',            label: 'Called',            emoji: '📞', badge: 'badge-called',      bucket: 'active'  },
  { key: 'missed',            label: 'Missed',            emoji: '📵', badge: 'badge-missed',      bucket: 'active'  },
  { key: 'not_reachable',     label: 'Not Reachable',     emoji: '📵', badge: 'badge-missed',      bucket: 'active'  },

  // ── Hot / progressing ─────────────────────────────────────────────────────
  { key: 'interested',        label: 'Interested',        emoji: '😊', badge: 'badge-interested',  bucket: 'hot'     },
  { key: 'demo_sent',         label: 'Demo Sent',         emoji: '🖥️', badge: 'badge-demo_sent',   bucket: 'hot'     },
  { key: 'quote_sent',        label: 'Quote Sent',        emoji: '💰', badge: 'badge-quote',       bucket: 'hot'     },
  { key: 'negotiating',       label: 'Negotiating',       emoji: '🤝', badge: 'badge-negotiating', bucket: 'hot'     },

  // ── Parked / waiting ─────────────────────────────────────────────────────
  { key: 'future_interested', label: 'Future Interest',   emoji: '🔮', badge: 'badge-future',      bucket: 'parked'  },
  { key: 'renovation',        label: 'Renovating',        emoji: '🏗️', badge: 'badge-renovation',  bucket: 'parked'  },
  { key: 'gatekeeper',        label: 'Gatekeeper',        emoji: '🚧', badge: 'badge-gatekeeper',  bucket: 'parked'  },
  { key: 'out_of_city',       label: 'Out of City',       emoji: '✈️', badge: 'badge-future',      bucket: 'parked'  },
  { key: 'partner_approval',  label: 'Partner Approval',  emoji: '🤝', badge: 'badge-called',      bucket: 'parked'  },
  { key: 'no_budget',         label: 'No Budget Now',     emoji: '💸', badge: 'badge-renovation',  bucket: 'parked'  },
  { key: 'wrong_number',      label: 'Wrong Number',      emoji: '❓', badge: 'badge-missed',      bucket: 'parked'  },

  // ── Closed / terminal ────────────────────────────────────────────────────
  { key: 'closed',            label: 'Closed',            emoji: '✅', badge: 'badge-closed',      bucket: 'closed'  },
  { key: 'dead',              label: 'Not Interested',    emoji: '❌', badge: 'badge-dead',        bucket: 'closed'  },
]

// ── Derived maps (auto-generated — don't edit these) ─────────────────────────

export const STATUS_KEYS    = STATUS_CONFIG.map(s => s.key)
export const STATUS_LABELS  = Object.fromEntries(STATUS_CONFIG.map(s => [s.key, s.label]))
export const STATUS_EMOJI   = Object.fromEntries(STATUS_CONFIG.map(s => [s.key, s.emoji]))
export const STATUS_BADGE   = Object.fromEntries(STATUS_CONFIG.map(s => [s.key, s.badge]))

// All status keys including blank for filter dropdowns
export const STATUSES = ['', ...STATUS_KEYS]

// Bucket membership helpers
export const BUCKET_HOT     = STATUS_CONFIG.filter(s => s.bucket === 'hot').map(s => s.key)
export const BUCKET_PARKED  = STATUS_CONFIG.filter(s => s.bucket === 'parked').map(s => s.key)
export const BUCKET_CLOSED  = STATUS_CONFIG.filter(s => s.bucket === 'closed').map(s => s.key)
export const BUCKET_ACTIVE  = STATUS_CONFIG.filter(s => s.bucket === 'active').map(s => s.key)

// Outcome → status mapping (used after logging a call)
export const STATUS_MAP = {
  interested:       'interested',
  future_interested:'future_interested',
  callback:         'called',
  not_interested:   'dead',
  no_answer:        'called',
  missed:           'missed',
  demo_requested:   'demo_sent',
  quote_sent:       'quote_sent',
  closed:           'closed',
}
