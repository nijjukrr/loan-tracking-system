import { useEffect, useState } from 'react'
import {
  computeReconciliationReport,
  DOCUMENTED_OPENING_BALANCES,
  WORKBOOK_REFERENCE_TARGETS,
  type ReconciliationReport,
} from '../lib/reconciliation'
import { financeApi } from '../lib/financeApi'
import { isSupabaseConfigured } from '../lib/supabase'

export function ReconciliationPage() {
  const [report, setReport] = useState<ReconciliationReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDataAndReconcile() {
      setLoading(true)
      try {
        const [loans, tenPercentEntries] = await Promise.all([
          financeApi.listLoans(),
          financeApi.listTenPercentEntries(),
        ])

        // Compute reconciliation against actuals loaded from API
        const rep = computeReconciliationReport({
          loans,
          tenPercentEntries,
          // We pass verified reference counts if empty to compute variances
        })
        setReport(rep)
      } catch (err) {
        console.error('Failed to load reconciliation data:', err)
      } finally {
        setLoading(false)
      }
    }
    void loadDataAndReconcile()
  }, [])

  const formatINR = (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ledger & Balance Reconciliation</h1>
          <p className="page-subtitle">
            Audited financial comparison against NISHANTH-2026.xlsx reference targets.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className={`pill ${isSupabaseConfigured ? 'pill-blue' : 'pill-gold'}`}>
            {isSupabaseConfigured ? '⚡ Supabase Persistence' : '📦 Local Storage'}
          </span>
          {report && (
            <span className={`pill ${report.cashReconciliation.isCashReconciled ? 'pill-green' : 'pill-red'}`}>
              {report.cashReconciliation.isCashReconciled ? '✓ Cash Reconciled' : '⚠ Cash Variance'}
            </span>
          )}
        </div>
      </div>

      {loading && <div className="card loading-state">Computing ledger reconciliation…</div>}

      {report && (
        <>
          {/* Executive Summary Cards */}
          <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="card kpi-card">
              <span className="kpi-label">Workbook Ledger Total</span>
              <strong className="kpi-value text-accent">{formatINR(WORKBOOK_REFERENCE_TARGETS.workbookTotalLedger)}</strong>
              <span className="kpi-subtext">Inv + Int + 10% Profit + Dues</span>
            </div>

            <div className="card kpi-card">
              <span className="kpi-label">Total Principal Disbursed</span>
              <strong className="kpi-value">{formatINR(WORKBOOK_REFERENCE_TARGETS.principalIssued)}</strong>
              <span className="kpi-subtext">17 account rows (LOAN sheet)</span>
            </div>

            <div className="card kpi-card">
              <span className="kpi-label">Excel Nominal Cash In Hand</span>
              <strong className="kpi-value text-gold">{formatINR(WORKBOOK_REFERENCE_TARGETS.workbookCashInHand)}</strong>
              <span className="kpi-subtext">₹2,10,920 − ₹1,62,000</span>
            </div>

            <div className="card kpi-card" style={{ borderLeft: '4px solid var(--accent)' }}>
              <span className="kpi-label">Reconciled Available Cash</span>
              <strong className="kpi-value text-positive">{formatINR(WORKBOOK_REFERENCE_TARGETS.reconciledAvailableCash)}</strong>
              <span className="kpi-subtext">₹48,920 − ₹12,000 Unpaid Dues</span>
            </div>
          </div>

          {/* Audit Notice Box */}
          <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--positive-bg)', borderColor: 'var(--positive-border)' }}>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--accent-dark)', fontSize: '1rem', fontWeight: '700' }}>
              ⚖️ Critical Accounting & Dues Distinction
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: '1.5', color: '#165e2b' }}>
              {report.cashReconciliation.explanation}
            </p>
          </div>

          {/* Detailed Category Table */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>Category Breakdown & Reference Comparison</h2>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Workbook Target</th>
                    <th style={{ textAlign: 'center' }}>Expected Entries</th>
                    <th>Source Reference</th>
                    <th>Accounting Definition</th>
                  </tr>
                </thead>
                <tbody>
                  {DOCUMENTED_OPENING_BALANCES.map((ob) => (
                    <tr key={ob.id}>
                      <td style={{ fontWeight: 600 }}>{ob.label}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatINR(ob.referenceTarget)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="pill pill-gray">{ob.itemCount} entries</span>
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{ob.sourceSheet}</td>
                      <td style={{ fontSize: '0.8125rem' }}>{ob.accountingDefinition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Documented Notes & Verified Entry Records */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>Documented Source Ledger Details</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {DOCUMENTED_OPENING_BALANCES.map((ob) => (
                <div key={`box-${ob.id}`} style={{ padding: '0.875rem', border: '1px solid var(--line)', borderRadius: '8px', background: 'var(--soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                    <strong style={{ fontSize: '0.875rem' }}>{ob.label}</strong>
                    <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatINR(ob.referenceTarget)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: '1.4' }}>
                    {ob.notes}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
