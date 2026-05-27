import React from 'react'

const STATUS_LABELS = {
  new: 'New',
  called: 'Called',
  interested: 'Interested',
  demo_sent: 'Demo Sent',
  negotiating: 'Negotiating',
  closed: 'Closed',
  dead: 'Dead',
}

const OUTCOME_LABELS = {
  interested: 'Interested',
  callback: 'Callback',
  not_interested: 'Not Interested',
  no_answer: 'No Answer',
  demo_requested: 'Demo Requested',
  closed: 'Closed',
  other: 'Other',
}

export function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  return (
    <span className={`badge badge-${priority}`}>
      {priority?.charAt(0).toUpperCase() + priority?.slice(1)}
    </span>
  )
}

export function OutcomeBadge({ outcome }) {
  const colors = {
    interested: 'badge-interested',
    callback: 'badge-called',
    not_interested: 'badge-dead',
    no_answer: 'badge-called',
    demo_requested: 'badge-demo_sent',
    closed: 'badge-closed',
    other: 'badge-new',
  }
  return (
    <span className={`badge ${colors[outcome] || 'badge-new'}`}>
      {OUTCOME_LABELS[outcome] || outcome}
    </span>
  )
}
