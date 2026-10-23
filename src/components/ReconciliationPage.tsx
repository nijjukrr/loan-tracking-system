import { useEffect, useState } from 'react'
import {
  computeReconciliationReport,
  DOCUMENTED_OPENING_BALANCES,
  WORKBOOK_REFERENCE_TARGETS,
  type ReconciliationReport,
} from '../lib/reconciliation'
import { financeApi } from '../lib/financeApi'
import { isSupabaseConfigured } from '../lib/supabase'
import type { DueReceivableEntry, InterestEntry, InvestmentEntry, Loan, TenPercentEntry } from '../types'

export function ReconciliationPage() {
  const [report, setReport] = useState<ReconciliationReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Datasets for detailed drilldown
  const [investments, setInvestments] = useState<InvestmentEntry[]>([])
  const [interests, setInterests] = useState<InterestEntry[]>([])
  const [tenPercentEntries, setTenPercentEntries] = useState<TenPercentEntry[]>([])
  const [dues, setDues] = useState<DueReceivableEntry[]>([])
  const [loans, setLoans] = useState<Loan[]>([])

  useEffect(() => {
    async function loadDataAndReconcile() {
      setLoading(true)
      try {
        const [loadedLoans, loadedTenPercent, loadedInv, loadedInt, loadedDues] = await Promise.all([
          financeApi.listLoans(),
          financeApi.listTenPercentEntries(),
          financeApi.listInvestments(),
          financeApi.listInterests(),
          financeApi.listDues(),
        ])

        setLoans(loadedLoans)
        setTenPercentEntries(loadedTenPercent)
        setInvestments(loadedInv)
        setInterests(loadedInt)
        setDues(loadedDues)

        // Compute reconciliation against actuals loaded from API
        const rep = computeReconciliationReport({
          loans: loadedLoans,
          tenPercentEntries: loadedTenPercent,
          investments: loadedInv,
          interests: loadedInt,
          dues: loadedDues,
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

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    if (!report) return
    const rows = [
      ['Category', 'Workbook Target (INR)', 'Actual Stored Total (INR)', 'Variance (INR)', 'Item Count', 'Reconciled Status'],
      ['Partner Capital Investments', String(report.categories.investments.referenceTarget), String(report.categories.investments.actualTotal), String(report.categories.investments.variance), String(report.categories.investments.count), report.categories.investments.isReconciled ? 'Reconciled' : 'Variance'],
      ['Interest Inflow Received', String(report.categories.interests.referenceTarget), String(report.categories.interests.actualTotal), String(report.categories.interests.variance), String(report.categories.interests.count), report.categories.interests.isReconciled ? 'Reconciled' : 'Variance'],
      ['10% Profit Entries', String(report.categories.tenPercentProfit.referenceTarget), String(report.categories.tenPercentProfit.actualTotal), String(report.categories.tenPercentProfit.variance), String(report.categories.tenPercentProfit.count), report.categories.tenPercentProfit.isReconciled ? 'Reconciled' : 'Variance'],
      ['Outstanding Customer Dues', String(report.categories.outstandingDues.referenceTarget), String(report.categories.outstandingDues.actualTotal), String(report.categories.outstandingDues.variance), String(report.categories.outstandingDues.count), report.categories.outstandingDues.isReconciled ? 'Reconciled' : 'Variance'],
      ['Loan Principal Issued', String(report.categories.principalIssued.referenceTarget), String(report.categories.principalIssued.actualTotal), String(report.categories.principalIssued.variance), String(report.categories.principalIssued.count), report.categories.principalIssued.isReconciled ? 'Reconciled' : 'Variance'],
      ['Excel Nominal Cash in Hand', String(WORKBOOK_REFERENCE_TARGETS.workbookCashInHand), String(WORKBOOK_REFERENCE_TARGETS.workbookCashInHand), '0', '-', 'Nominal Reference'],
      ['Reconciled Liquid Available Cash', String(WORKBOOK_REFERENCE_TARGETS.reconciledAvailableCash), String(WORKBOOK_REFERENCE_TARGETS.reconciledAvailableCash), '0', '-', 'Excludes ₹12,000 Unpaid Dues'],
    ]
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((c) => `"${c}"`).join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `finance_reconciliation_statement_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
          <button className="secondary-button compact-button print-keep" onClick={handleExportCSV}>
            📥 Export CSV
          </button>
          <button className="primary-button compact-button print-keep" onClick={handlePrint}>
            🖨️ Print Statement
          </button>
          <span className={`pill ${isSupabaseConfigured ? 'pill-blue' : 'pill-gold'}`}>
            {isSupabaseConfigured ? '⚡ Supabase Persistence' : '📦 Local Preview Store'}
          </span>
          {report && (
            <span className={`pill ${report.cashReconciliation.isCashReconciled ? 'pill-green' : 'pill-red'}`}>
              {report.cashReconciliation.isCashReconciled ? '✓ All Reconciled' : '⚠ Variance Found'}
            </span>
          )}
        </div>
      </div>

      {loading && <div className="card loading-state">Computing ledger reconciliation…</div>}

      {report && (
        <>
          {/* Executive Summary Cards */}
          <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="kpi-card" onClick={() => setSelectedCategory(null)} style={{ cursor: 'pointer' }}>
              <span className="kpi-label">Workbook Ledger Total</span>
              <strong className="kpi-value text-accent">{formatINR(WORKBOOK_REFERENCE_TARGETS.workbookTotalLedger)}</strong>
              <span className="kpi-subtext">Inv + Int + 10% Profit + Dues</span>
            </div>

            <div className="kpi-card highlight-card" onClick={() => setSelectedCategory('LOAN_PRINCIPAL')} style={{ cursor: 'pointer' }}>
              <span className="kpi-label">Principal Disbursed</span>
              <strong className="kpi-value">{formatINR(report.categories.principalIssued.actualTotal)}</strong>
              <span className="kpi-subtext">{report.categories.principalIssued.count} accounts ledgered</span>
            </div>

            <div className="kpi-card" onClick={() => setSelectedCategory(null)} style={{ cursor: 'pointer' }}>
              <span className="kpi-label">Excel Nominal Cash In Hand</span>
              <strong className="kpi-value text-gold">{formatINR(WORKBOOK_REFERENCE_TARGETS.workbookCashInHand)}</strong>
              <span className="kpi-subtext">₹2,10,920 − ₹1,62,000</span>
            </div>

            <div className="kpi-card success-card" onClick={() => setSelectedCategory('DUE')} style={{ cursor: 'pointer' }}>
              <span className="kpi-label">Reconciled Liquid Cash</span>
              <strong className="kpi-value text-positive">{formatINR(WORKBOOK_REFERENCE_TARGETS.reconciledAvailableCash)}</strong>
              <span className="kpi-subtext">₹48,920 − ₹12,000 Unpaid Dues</span>
            </div>
          </div>

          {/* Audit Notice Box */}
          <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--positive-bg)', borderColor: 'var(--positive-border)' }}>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--accent-dark)', fontSize: '1rem', fontWeight: '700' }}>
              ⚖️ Critical Accounting & Liquid Cash Distinction
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: '1.5', color: '#165e2b' }}>
              {report.cashReconciliation.explanation}
            </p>
          </div>

          {/* Detailed Category Table */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>Category Breakdown & Live Variance</h2>
              <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>Click any row to inspect underlying records</span>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Workbook Target</th>
                    <th style={{ textAlign: 'right' }}>Actual Stored</th>
                    <th style={{ textAlign: 'right' }}>Variance</th>
                    <th style={{ textAlign: 'center' }}>Entries</th>
                    <th>Source Reference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'INVESTMENT', cat: report.categories.investments, sheet: 'SEP&OCT (Cols P-S)' },
                    { key: 'INTEREST', cat: report.categories.interests, sheet: 'SEP&OCT (Cols K-N)' },
                    { key: 'TEN_PERCENT', cat: report.categories.tenPercentProfit, sheet: 'SEP&OCT (Cols F-I)' },
                    { key: 'DUE', cat: report.categories.outstandingDues, sheet: 'SEP&OCT (Cols A-D)' },
                    { key: 'LOAN_PRINCIPAL', cat: report.categories.principalIssued, sheet: 'LOAN (Cols A-G)' },
                  ].map(({ key, cat, sheet }) => (
                    <tr
                      key={key}
                      onClick={() => setSelectedCategory(selectedCategory === key ? null : key)}
                      style={{ cursor: 'pointer', background: selectedCategory === key ? 'rgba(16, 185, 129, 0.08)' : undefined }}
                    >
                      <td style={{ fontWeight: 600 }}>
                        {selectedCategory === key ? '👉 ' : ''}
                        {cat.label}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatINR(cat.referenceTarget)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: cat.isReconciled ? 'var(--text)' : '#ef4444' }}>
                        {formatINR(cat.actualTotal)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: cat.variance === 0 ? 'var(--positive)' : '#ef4444' }}>
                        {cat.variance === 0 ? '₹0' : formatINR(cat.variance)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="pill pill-gray">{cat.count} / {cat.expectedCount} rows</span>
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{sheet}</td>
                      <td>
                        <span className={`pill ${cat.isReconciled ? 'pill-green' : 'pill-red'}`}>
                          {cat.isReconciled ? '✓ Matched' : '⚠ Discrepancy'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drilldown Section when a category is clicked */}
          {selectedCategory && (
            <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>
                  🔍 Inspecting Records: {selectedCategory.replace(/_/g, ' ')}
                </h2>
                <button className="secondary-button compact-button" onClick={() => setSelectedCategory(null)}>
                  Close Drilldown
                </button>
              </div>

              {selectedCategory === 'INVESTMENT' && (
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>Date</th><th>Investor Name</th><th style={{ textAlign: 'right' }}>Amount</th><th>Source Ref</th></tr>
                  </thead>
                  <tbody>
                    {investments.map((inv, idx) => (
                      <tr key={inv.id}>
                        <td>{idx + 1}</td>
                        <td>{inv.entry_date}</td>
                        <td style={{ fontWeight: 600 }}>{inv.investor_name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatINR(inv.amount)}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{inv.source_reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedCategory === 'INTEREST' && (
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>Date</th><th>Customer Name</th><th>A/C #</th><th style={{ textAlign: 'right' }}>Amount</th><th>Source Ref</th></tr>
                  </thead>
                  <tbody>
                    {interests.map((int, idx) => (
                      <tr key={int.id}>
                        <td>{idx + 1}</td>
                        <td>{int.entry_date}</td>
                        <td style={{ fontWeight: 600 }}>{int.customer_name}</td>
                        <td>{int.ac_no ?? '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatINR(int.amount)}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{int.source_reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedCategory === 'TEN_PERCENT' && (
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>Date</th><th>Particulars</th><th style={{ textAlign: 'right' }}>Amount</th><th>Type</th></tr>
                  </thead>
                  <tbody>
                    {tenPercentEntries.map((tp, idx) => (
                      <tr key={tp.id}>
                        <td>{idx + 1}</td>
                        <td>{tp.entry_date}</td>
                        <td style={{ fontWeight: 600 }}>{tp.particulars}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatINR(tp.amount)}</td>
                        <td><span className="pill pill-green">{tp.source_kind}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedCategory === 'DUE' && (
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>Due Date</th><th>Borrower Name</th><th style={{ textAlign: 'right' }}>Amount</th><th>Remaining</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {dues.map((d, idx) => (
                      <tr key={d.id}>
                        <td>{idx + 1}</td>
                        <td>{d.due_date}</td>
                        <td style={{ fontWeight: 600 }}>{d.borrower_name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatINR(d.amount)}</td>
                        <td style={{ textAlign: 'right' }}>{formatINR(d.remaining_amount)}</td>
                        <td><span className="pill pill-gold">{d.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedCategory === 'LOAN_PRINCIPAL' && (
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>A/C #</th><th>Borrower Name</th><th>Mode</th><th style={{ textAlign: 'right' }}>Principal</th><th>Status</th><th>Remarks</th></tr>
                  </thead>
                  <tbody>
                    {loans.map((l, idx) => (
                      <tr key={l.id}>
                        <td>{idx + 1}</td>
                        <td>{l.main_sheet_no}</td>
                        <td style={{ fontWeight: 600 }}>{l.customer_name}</td>
                        <td><span className={`pill ${l.mode === 'D' ? 'pill-blue' : 'pill-gold'}`}>{l.mode === 'D' ? 'Daily' : 'Weekly'}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatINR(l.principal)}</td>
                        <td><span className={`pill ${l.status === 'active' ? 'pill-green' : 'pill-gray'}`}>{l.status}</span></td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{l.source_remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

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
