import { useState } from 'react'
import { financeApi } from '../lib/financeApi'
import {
  generateDuesCsv,
  generateInterestCsv,
  generateInvestmentCsv,
  generateLoansCsv,
  generatePaymentsCsv,
  generateReconciliationCsv,
  generateTenPercentCsv,
  triggerCsvDownload,
} from '../lib/exportUtils'
import { computeReconciliationReport } from '../lib/reconciliation'
import { formatDateISO } from '../lib/financeLogic'

export function ReportsPage() {
  const [exporting, setExporting] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const handleExport = async (category: string) => {
    setExporting(category)
    setNotice('')
    const today = formatDateISO(new Date())

    try {
      if (category === 'investments') {
        const data = await financeApi.listInvestments()
        const csv = generateInvestmentCsv(data)
        triggerCsvDownload(`investments-ledger-${today}.csv`, csv)
        setNotice(`Investments ledger exported successfully (${data.length} records).`)
      } else if (category === 'interest') {
        const data = await financeApi.listInterests()
        const csv = generateInterestCsv(data)
        triggerCsvDownload(`interest-receipts-${today}.csv`, csv)
        setNotice(`Interest ledger exported successfully (${data.length} records).`)
      } else if (category === 'ten-percent') {
        const data = await financeApi.listTenPercentEntries()
        const csv = generateTenPercentCsv(data)
        triggerCsvDownload(`ten-percent-profit-${today}.csv`, csv)
        setNotice(`10% Profit ledger exported successfully (${data.length} records).`)
      } else if (category === 'loans') {
        const data = await financeApi.listLoans()
        const csv = generateLoansCsv(data)
        triggerCsvDownload(`loan-portfolio-master-${today}.csv`, csv)
        setNotice(`Loan portfolio exported successfully (${data.length} accounts).`)
      } else if (category === 'payments') {
        const data = await financeApi.listPayments()
        const csv = generatePaymentsCsv(data)
        triggerCsvDownload(`payment-collection-history-${today}.csv`, csv)
        setNotice(`Payment collection history exported successfully (${data.length} receipts).`)
      } else if (category === 'dues') {
        const data = await financeApi.listDues()
        const csv = generateDuesCsv(data)
        triggerCsvDownload(`outstanding-dues-receivables-${today}.csv`, csv)
        setNotice(`Outstanding dues exported successfully (${data.length} receivables).`)
      } else if (category === 'reconciliation') {
        const [loans, tp, inv, int, dues] = await Promise.all([
          financeApi.listLoans(),
          financeApi.listTenPercentEntries(),
          financeApi.listInvestments(),
          financeApi.listInterests(),
          financeApi.listDues(),
        ])
        const rec = computeReconciliationReport({
          loans,
          tenPercentEntries: tp,
          investments: inv,
          interests: int,
          dues,
        })
        const csv = generateReconciliationCsv(rec)
        triggerCsvDownload(`audit-reconciliation-report-${today}.csv`, csv)
        setNotice('Financial audit & reconciliation report exported successfully.')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Data Export & Reports</p>
          <h1 className="page-title">Financial Reports & Exports</h1>
          <p className="page-subtitle">
            Export verified financial ledgers, audit statements, and reconciliation tables in standard CSV format.
          </p>
        </div>
      </header>

      {notice && (
        <div className="card" style={{ marginBottom: '1.25rem', background: '#ecfdf5', borderLeft: '4px solid #10b981', color: '#065f46' }}>
          ✓ {notice}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Card 1: Investment Entries */}
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem', fontWeight: 700 }}>
            💼 Investments Ledger
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: '0 0 1rem', lineHeight: '1.5' }}>
            8 capital entries totaling ₹185,000 from investment partners (Ponniyan, Sathish, Rathika, Gurusamy, etc.).
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={exporting !== null}
            onClick={() => handleExport('investments')}
          >
            {exporting === 'investments' ? 'Exporting…' : 'Export Investments (CSV)'}
          </button>
        </div>

        {/* Card 2: Interest Receipts */}
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem', fontWeight: 700 }}>
            📈 Interest Collections
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: '0 0 1rem', lineHeight: '1.5' }}>
            9 individual receipts totaling ₹4,950 from SEP&OCT columns D-E.
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={exporting !== null}
            onClick={() => handleExport('interest')}
          >
            {exporting === 'interest' ? 'Exporting…' : 'Export Interest (CSV)'}
          </button>
        </div>

        {/* Card 3: 10% Profit Entries */}
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem', fontWeight: 700 }}>
            🎯 10% Profit Ledger
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: '0 0 1rem', lineHeight: '1.5' }}>
            24 genuine profit entries totaling ₹8,970, cleanly separated from investment credits.
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={exporting !== null}
            onClick={() => handleExport('ten-percent')}
          >
            {exporting === 'ten-percent' ? 'Exporting…' : 'Export 10% Profit (CSV)'}
          </button>
        </div>

        {/* Card 4: Loan Accounts Master */}
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem', fontWeight: 700 }}>
            📋 Loan Portfolio Master
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: '0 0 1rem', lineHeight: '1.5' }}>
            All 17 daily and weekly loans (₹162,000 principal) including zero-amount historical rows.
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={exporting !== null}
            onClick={() => handleExport('loans')}
          >
            {exporting === 'loans' ? 'Exporting…' : 'Export Loans Master (CSV)'}
          </button>
        </div>

        {/* Card 5: Payment History */}
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem', fontWeight: 700 }}>
            💳 Payment Collection History
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: '0 0 1rem', lineHeight: '1.5' }}>
            Full receipt history with exact principal and interest allocation splits.
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={exporting !== null}
            onClick={() => handleExport('payments')}
          >
            {exporting === 'payments' ? 'Exporting…' : 'Export Payments (CSV)'}
          </button>
        </div>

        {/* Card 6: Outstanding Dues */}
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem', fontWeight: 700 }}>
            ⏳ Outstanding Dues & Receivables
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: '0 0 1rem', lineHeight: '1.5' }}>
            6 customer receivables totaling ₹12,000 (Ajith, Shanthi, Divya) from SEP&OCT columns J-K.
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={exporting !== null}
            onClick={() => handleExport('dues')}
          >
            {exporting === 'dues' ? 'Exporting…' : 'Export Dues (CSV)'}
          </button>
        </div>

        {/* Card 7: Audit Reconciliation Report */}
        <div className="card highlight-card" style={{ gridColumn: '1 / -1' }}>
          <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem', fontWeight: 700 }}>
            🛡️ Master Financial Audit & Reconciliation Statement
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: '0 0 1rem', lineHeight: '1.5' }}>
            Complete audit reconciliation statement comparing workbook reported reference totals against transaction-derived figures,
            variance analysis, nominal cash (₹48,920), and liquid cash (₹36,920).
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="primary-button"
              disabled={exporting !== null}
              onClick={() => handleExport('reconciliation')}
            >
              {exporting === 'reconciliation' ? 'Exporting…' : 'Export Full Reconciliation Audit (CSV)'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => window.print()}
            >
              Print Audit Statement
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
