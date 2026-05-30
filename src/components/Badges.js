/* eslint-disable */
import React from 'react'

const STATUS_LABELS = {
  new: 'New',
  called: 'Called',
  interested: 'Interested',
  future_interested: 'Future Interested',
  demo_sent: 'Demo Sent',
  quote_sent: 'Quote Sent',
  negotiating: 'Negotiating',
  closed: 'Closed',
  dead: 'Not Interested',
  missed: 'Missed Call',
}

const OUTCOME_LABELS = {
  interested: 'Interested',
  callback: 'Callback',
  not_interested: 'Not Interested',
  no_answer: 'No Answer',
  demo_requested: 'Demo Requested',
  closed: 'Closed',
  missed: 'Missed Call',
  future_interested: 'Future Interested',
  quote_sent: 'Quote Sent',
  other: 'Other',
}

export function StatusBadge({ status }) {
  const colors = {
    new: 'badge-new',
    called: 'badge-called',
    interested: 'badge-interested',
    future_interested: 'badge-future',
    demo_sent: 'badge-demo_sent',
    quote_sent: 'badge-quote',
    negotiating: 'badge-negotiating',
    closed: 'badge-closed',
    dead: 'badge-dead',
    missed: 'badge-missed',
  }
  return <span className={`badge ${colors[status] || 'badge-new'}`}>{STATUS_LABELS[status] || status}</span>
}

export function PriorityBadge({ priority }) {
  return <span className={`badge badge-${priority}`}>{priority?.charAt(0).toUpperCase() + priority?.slice(1)}</span>
}

export function OutcomeBadge({ outcome }) {
  const colors = {
    interested: 'badge-interested',
    callback: 'badge-called',
    not_interested: 'badge-dead',
    no_answer: 'badge-called',
    demo_requested: 'badge-demo_sent',
    closed: 'badge-closed',
    missed: 'badge-missed',
    future_interested: 'badge-future',
    quote_sent: 'badge-quote',
    other: 'badge-new',
  }
  return <span className={`badge ${colors[outcome] || 'badge-new'}`}>{OUTCOME_LABELS[outcome] || outcome}</span>
}
