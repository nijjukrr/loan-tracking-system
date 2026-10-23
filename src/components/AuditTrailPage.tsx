import { useCallback, useEffect, useState } from 'react'
import { financeApi } from '../lib/financeApi'
import type { AuditLogEntry } from '../types'

export function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'WORKBOOK' | 'loan' | 'payment' | 'due_receivable' | 'MONTHLY_FUND' | 'main_transaction'>('ALL')

  const loadLogs = useCallback(() => {
    setLoading(true)
    const entity_type = typeFilter === 'ALL' ? undefined : typeFilter
    financeApi
      .listAuditLogs({ entity_type })
      .then((data) => setLogs(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [typeFilter])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const filteredLogs = logs.filter((log) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const matchesAction = log.action.toLowerCase().includes(q)
    const matchesId = log.entity_id.toLowerCase().includes(q)
    const matchesDetails = log.details ? JSON.stringify(log.details).toLowerCase().includes(q) : false
    return matchesAction || matchesId || matchesDetails
  })

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Security & Compliance</p>
          <h1 className="page-title">Financial Audit & Correction Trail</h1>
          <p className="page-subtitle">
            Immutable log of all financial operations, transaction reversals, loan creations, and settlements.
          </p>
        </div>
      </header>

      {/* Safety Notice */}
      <div className="card" style={{ marginBottom: '1.25rem', background: '#f8fafc', borderLeft: '4px solid #64748b' }}>
        <h3 style={{ margin: '0 0 0.375rem', fontSize: '0.9375rem', fontWeight: 700, color: '#1e293b' }}>
          🛡️ Zero Silent Mutations Policy
        </h3>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#475569', lineHeight: '1.5' }}>
          Every financial disbursement, payment allocation, status change, and manual tagging is recorded with an immutable timestamp.
          Historical values are preserved permanently, preventing unrecorded edits or deletion of audit evidence.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <section className="search-bar-card card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="search"
            placeholder="Search audit trail by action, ID, or details…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid var(--line)', borderRadius: '6px' }}
          />

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--line)', borderRadius: '6px' }}
          >
            <option value="ALL">All Entity Types</option>
            <option value="WORKBOOK">Workbook Imports</option>
            <option value="loan">Loans</option>
            <option value="payment">Payments</option>
            <option value="due_receivable">Customer Dues</option>
            <option value="MONTHLY_FUND">Monthly Fund</option>
            <option value="main_transaction">Main Transactions</option>
          </select>
        </div>
      </section>

      {/* Audit Log Table */}
      <section className="table-card card">
        <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>Recorded Audit Events ({filteredLogs.length})</h2>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Ordered chronologically by timestamp (newest first).
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading audit history…</div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state">
            <strong>No audit events found</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Events will be recorded automatically as you create loans, mark payments, and settle customer dues.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity Type</th>
                  <th>Entity ID</th>
                  <th>Operation Details</th>
                  <th>Operator</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td>
                      <span className="source-badge" style={{ fontWeight: 600, background: '#f1f5f9' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{log.entity_type.replace('_', ' ')}</td>
                    <td>
                      <code className="code-id" style={{ fontSize: '0.75rem' }}>{log.entity_id}</code>
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      {log.details ? (
                        <pre style={{ margin: 0, padding: '4px', background: '#f8fafc', borderRadius: '4px', fontSize: '0.75rem', maxWidth: '350px', overflowX: 'auto' }}>
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                      {log.performed_by || 'system_operator'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
