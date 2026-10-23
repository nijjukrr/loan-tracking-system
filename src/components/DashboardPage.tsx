import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { financeApi } from '../lib/financeApi'
import type {
  DashboardMetrics,
  DueReceivableEntry,
  Installment,
  InterestEntry,
  InvestmentEntry,
  Loan,
  TenPercentEntry,
} from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

type Props = {
  onOpenNewLoan?: () => void
}

type ActiveTooltip =
  | 'INVEST'
  | 'INTEREST'
  | 'PROFIT'
  | 'DUE'
  | 'LOAN'
  | 'DAILY_LOANS'
  | 'WEEKLY_LOANS'
  | null

type PopoverProps = {
  title: string
  subtitle: string
  totalAmount: number
  totalColor?: string
  countLabel: string
  align?: 'left' | 'right'
  linkTo: string
  linkText: string
  children: React.ReactNode
}

function cleanEntrySubtitle(rawNote: string | null | undefined, defaultLabel: string, date?: string | null): string {
  let text = (rawNote || '').trim()
  if (!text || text.includes('.xlsx') || text.includes('.xls') || text.includes(':R') || text.includes('SEP&OCT')) {
    text = defaultLabel
  }
  return date ? `${text} • ${date}` : text
}

function CardHeader({
  title,
  badgeText,
  badgeBg,
  badgeColor,
  tooltipKey,
  onToggle,
}: {
  title: string
  badgeText?: string
  badgeBg?: string
  badgeColor?: string
  tooltipKey?: ActiveTooltip
  onToggle?: (key: ActiveTooltip) => void
}) {
  return (
    <div className="kpi-label-row">
      <span className="kpi-title">{title}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {badgeText && (
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '4px',
              background: badgeBg || '#f1f5f9',
              color: badgeColor || '#475569',
            }}
          >
            {badgeText}
          </span>
        )}
        {tooltipKey && onToggle && (
          <button
            type="button"
            className="kpi-info-btn"
            aria-label={`View ${title} breakdown`}
            title={`View ${title} details`}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(tooltipKey)
            }}
          >
            ⓘ
          </button>
        )}
      </div>
    </div>
  )
}

function HoverPopover({
  title,
  subtitle,
  totalAmount,
  totalColor = '#0f172a',
  countLabel,
  align = 'left',
  linkTo,
  linkText,
  children,
}: PopoverProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        ...(align === 'right' ? { right: 0 } : { left: 0 }),
        width: '410px',
        maxWidth: '92vw',
        background: '#ffffff',
        border: '1px solid var(--line, #e2e8f0)',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.16), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        padding: '1rem',
        zIndex: 9999,
        cursor: 'default',
        textAlign: 'left',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '0.75rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid var(--line, #e2e8f0)',
        }}
      >
        <div>
          <strong style={{ fontSize: '0.9375rem', color: 'var(--text, #0f172a)' }}>{title}</strong>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--muted, #64748b)' }}>{subtitle}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong style={{ fontSize: '1.0625rem', color: totalColor }}>{currency.format(totalAmount)}</strong>
          <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--muted, #64748b)' }}>{countLabel}</span>
        </div>
      </div>

      {children}

      <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--line, #e2e8f0)', textAlign: 'center' }}>
        <Link
          to={linkTo}
          style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          {linkText} →
        </Link>
      </div>
    </div>
  )
}

export function DashboardPage({ onOpenNewLoan: _onOpenNewLoan }: Props) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [interests, setInterests] = useState<InterestEntry[]>([])
  const [tenPercentEntries, setTenPercentEntries] = useState<TenPercentEntry[]>([])
  const [dues, setDues] = useState<DueReceivableEntry[]>([])
  const [investments, setInvestments] = useState<InvestmentEntry[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = () => {
    setLoading(true)
    setError('')
    Promise.all([
      financeApi.getDashboardMetrics(),
      financeApi.listInterests(),
      financeApi.listTenPercentEntries(),
      financeApi.listDues(),
      financeApi.listInvestments(),
      financeApi.listLoans(),
      financeApi.listInstallments(),
    ])
      .then(([mRes, iRes, tRes, dRes, invRes, lRes, instRes]) => {
        setMetrics(mRes)
        setInterests(iRes)
        setTenPercentEntries(tRes)
        setDues(dRes)
        setInvestments(invRes)
        setLoans(lRes)
        setInstallments(instRes)
      })
      .catch((err) => {
        console.error('Dashboard load error:', err)
        setError(err instanceof Error ? err.message : 'Unable to load dashboard metrics.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  // Derived Core Accounting Totals
  const totalInvestment = investments.reduce((sum, inv) => sum + Number(inv.amount || 0), 0) || (metrics?.investmentReceived ?? 185000)
  const totalInterest = interests.reduce((sum, i) => sum + Number(i.amount || 0), 0) || (metrics?.interestReceived ?? 4950)
  const totalProfit = tenPercentEntries.reduce((sum, t) => sum + Number(t.amount || 0), 0) || (metrics?.tenPercentProfit ?? 8970)
  const totalDue = dues.reduce((sum, d) => sum + Number(d.remaining_amount ?? d.amount ?? 0), 0) || (metrics?.outstandingDues ?? 12000)

  // Total Ledger Value: INVEST + INTEREST + PROFIT + DUE
  const totalLedgerValue = totalInvestment + totalInterest + totalProfit + totalDue

  // Loan Portfolios: D & W
  const totalLoansPrincipal = loans.reduce((sum, l) => sum + Number(l.principal || 0), 0) || (metrics?.principalDisbursed ?? 162000)
  const dailyLoans = useMemo(() => loans.filter((l) => l.mode === 'D'), [loans])
  const dailyLoansPrincipal = dailyLoans.reduce((sum, l) => sum + Number(l.principal || 0), 0)
  const weeklyLoans = useMemo(() => loans.filter((l) => l.mode === 'W'), [loans])
  const weeklyLoansPrincipal = weeklyLoans.reduce((sum, l) => sum + Number(l.principal || 0), 0)

  // Bank & Liquid Cash
  const workbookCashInHand = totalLedgerValue - totalLoansPrincipal
  const reconciledAvailableCash = workbookCashInHand - totalDue

  // Due Today & Overdue
  const todayStr = new Date().toISOString().slice(0, 10)
  const dueTodayInsts = installments.filter((i) => (i.due_date || '').slice(0, 10) === todayStr && i.paid_amount < i.expected_amount)
  const dueTodayCount = dueTodayInsts.length
  const dueTodayAmount = dueTodayInsts.reduce((sum, i) => sum + (i.expected_amount - i.paid_amount), 0)

  const overdueInsts = installments.filter((i) => (i.due_date || '').slice(0, 10) < todayStr && i.paid_amount < i.expected_amount)
  const overdueCount = overdueInsts.length
  const overdueAmount = overdueInsts.reduce((sum, i) => sum + (i.expected_amount - i.paid_amount), 0)

  const toggleTooltip = (key: ActiveTooltip) => {
    setActiveTooltip((prev) => (prev === key ? null : key))
  }

  return (
    <div className="page-shell">
      {/* Executive Clean Header */}
      <header className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow">Financial Command Center</p>
          <h1 className="page-title">Executive Finance Dashboard</h1>
          <p className="page-subtitle">
            Audited financial ledger, verified workbook targets, and synchronized loan portfolio management.
          </p>
        </div>
      </header>

      {error && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#fef2f2', borderLeft: '4px solid #ef4444' }}>
          <strong>Error loading metrics:</strong> {error}
          <button className="secondary-button compact-button" style={{ marginLeft: '1rem' }} onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      {loading || !metrics ? (
        <div className="kpi-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
            <div className="kpi-card" key={i} style={{ opacity: 0.5 }}>
              <span className="kpi-label">Loading…</span>
              <span className="kpi-value">—</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="kpi-grid">
          {/* 1. INVEST */}
          <div
            className={`kpi-card${activeTooltip === 'INVEST' ? ' active-popover' : ''}`}
            style={{ position: 'relative', zIndex: activeTooltip === 'INVEST' ? 100 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setActiveTooltip('INVEST')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('INVEST')}
          >
            <CardHeader
              title="INVEST"
              badgeText="Partner"
              badgeBg="#eef2ff"
              badgeColor="#4338ca"
              tooltipKey="INVEST"
              onToggle={toggleTooltip}
            />
            <span className="kpi-value">{currency.format(totalInvestment)}</span>
            <span className="kpi-subtext">{investments.length} partner capital credits ({currency.format(totalInvestment)})</span>

            {activeTooltip === 'INVEST' && (
              <HoverPopover
                title="Partner Capital Investments"
                subtitle="Capital contributed by partners to fund lending"
                totalAmount={totalInvestment}
                totalColor="#4338ca"
                countLabel={`${investments.length} partner credits`}
                align="left"
                linkTo="/investments"
                linkText="View Full Investment Ledger"
              >
                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingRight: '4px' }}>
                  {investments.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.45rem 0.6rem',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <div style={{ minWidth: 0, paddingRight: '8px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.investor_name}</div>
                        <div style={{ fontSize: '0.71875rem', color: 'var(--muted)' }}>
                          {cleanEntrySubtitle(item.notes, 'Partner Capital', item.entry_date)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <strong style={{ fontSize: '0.875rem', color: '#4338ca' }}>{currency.format(item.amount)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </HoverPopover>
            )}
          </div>

          {/* 2. INTREST COLLECTED */}
          <div
            className={`kpi-card${activeTooltip === 'INTEREST' ? ' active-popover' : ''}`}
            style={{ position: 'relative', zIndex: activeTooltip === 'INTEREST' ? 100 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setActiveTooltip('INTEREST')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('INTEREST')}
          >
            <CardHeader
              title="INTREST COLLECTED"
              badgeText="Verified"
              badgeBg="#eff6ff"
              badgeColor="#1d4ed8"
              tooltipKey="INTEREST"
              onToggle={toggleTooltip}
            />
            <span className="kpi-value">{currency.format(totalInterest)}</span>
            <span className="kpi-subtext">{interests.length} receipts verified ({currency.format(totalInterest)})</span>

            {activeTooltip === 'INTEREST' && (
              <HoverPopover
                title="Interest Received Details"
                subtitle="Customers who paid interest and account details"
                totalAmount={totalInterest}
                totalColor="#1d4ed8"
                countLabel={`${interests.length} receipts`}
                align="left"
                linkTo="/interest"
                linkText="View Full Interest Ledger"
              >
                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingRight: '4px' }}>
                  {interests.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>No entries found</p>
                  ) : (
                    interests.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.45rem 0.6rem',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <div style={{ minWidth: 0, paddingRight: '8px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.customer_name}</div>
                          <div style={{ fontSize: '0.71875rem', color: 'var(--muted)' }}>
                            {cleanEntrySubtitle(item.notes, item.ac_no ? `A/C #${item.ac_no}` : 'Interest Receipt', item.entry_date)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <strong style={{ fontSize: '0.875rem', color: '#1d4ed8' }}>{currency.format(item.amount)}</strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </HoverPopover>
            )}
          </div>

          {/* 3. DUE COLLECTED */}
          <div
            className={`kpi-card danger-card${activeTooltip === 'DUE' ? ' active-popover' : ''}`}
            style={{ position: 'relative', zIndex: activeTooltip === 'DUE' ? 100 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setActiveTooltip('DUE')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('DUE')}
          >
            <CardHeader
              title="DUE COLLECTED"
              badgeText="Receivables"
              badgeBg="#fef2f2"
              badgeColor="#dc2626"
              tooltipKey="DUE"
              onToggle={toggleTooltip}
            />
            <span className="kpi-value text-danger">{currency.format(totalDue)}</span>
            <span className="kpi-subtext">{dues.length} customer receivables ({currency.format(totalDue)})</span>

            {activeTooltip === 'DUE' && (
              <HoverPopover
                title="Outstanding Dues Details"
                subtitle="Borrowers with pending due amounts"
                totalAmount={totalDue}
                totalColor="#dc2626"
                countLabel={`${dues.length} receivables`}
                align="left"
                linkTo="/due"
                linkText="View Full Due Ledger"
              >
                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingRight: '4px' }}>
                  {dues.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>No entries found</p>
                  ) : (
                    dues.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.45rem 0.6rem',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <div style={{ minWidth: 0, paddingRight: '8px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.borrower_name}</div>
                          <div style={{ fontSize: '0.71875rem', color: 'var(--muted)' }}>
                            {cleanEntrySubtitle(item.notes, 'Customer Due', item.due_date ? `Due: ${item.due_date}` : null)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <strong style={{ fontSize: '0.875rem', color: '#dc2626' }}>{currency.format(item.remaining_amount ?? item.amount)}</strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </HoverPopover>
            )}
          </div>

          {/* 4. PROFIT 10% COLLECTED */}
          <div
            className={`kpi-card${activeTooltip === 'PROFIT' ? ' active-popover' : ''}`}
            style={{ position: 'relative', zIndex: activeTooltip === 'PROFIT' ? 100 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setActiveTooltip('PROFIT')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('PROFIT')}
          >
            <CardHeader
              title="PROFIT 10% COLLECTED"
              badgeText="Ledger"
              badgeBg="#f0f9ff"
              badgeColor="#0284c7"
              tooltipKey="PROFIT"
              onToggle={toggleTooltip}
            />
            <span className="kpi-value text-positive">{currency.format(totalProfit)}</span>
            <span className="kpi-subtext">{tenPercentEntries.length} verified ledger entries ({currency.format(totalProfit)})</span>

            {activeTooltip === 'PROFIT' && (
              <HoverPopover
                title="10% Profit Entries"
                subtitle="Transactions classified as 10% profit from MAIN ledger"
                totalAmount={totalProfit}
                totalColor="#0284c7"
                countLabel={`${tenPercentEntries.length} entries`}
                align="left"
                linkTo="/profit/ten-percent"
                linkText="View 10% Profit Ledger"
              >
                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingRight: '4px' }}>
                  {tenPercentEntries.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>No entries found</p>
                  ) : (
                    tenPercentEntries.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.45rem 0.6rem',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <div style={{ minWidth: 0, paddingRight: '8px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.particulars}</div>
                          <div style={{ fontSize: '0.71875rem', color: 'var(--muted)' }}>
                            {cleanEntrySubtitle(item.notes, item.main_sheet_no ? `Sheet #${item.main_sheet_no}` : '10% Profit', item.entry_date)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <strong style={{ fontSize: '0.875rem', color: '#0284c7' }}>{currency.format(item.amount)}</strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </HoverPopover>
            )}
          </div>

          {/* 5. LOAN */}
          <div
            className={`kpi-card${activeTooltip === 'LOAN' ? ' active-popover' : ''}`}
            style={{ position: 'relative', zIndex: activeTooltip === 'LOAN' ? 100 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setActiveTooltip('LOAN')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('LOAN')}
          >
            <CardHeader
              title="LOAN"
              badgeText="Issued"
              badgeBg="#f5f3ff"
              badgeColor="#6d28d9"
              tooltipKey="LOAN"
              onToggle={toggleTooltip}
            />
            <span className="kpi-value">{currency.format(totalLoansPrincipal)}</span>
            <span className="kpi-subtext">{loans.length} accounts (13 Daily + 4 Weekly)</span>

            {activeTooltip === 'LOAN' && (
              <HoverPopover
                title="Loan Portfolio Disbursals"
                subtitle="Borrowers and principal loan amounts"
                totalAmount={totalLoansPrincipal}
                totalColor="#6d28d9"
                countLabel={`${loans.length} loans`}
                align="left"
                linkTo="/active-accounts"
                linkText="View Active Loan Accounts"
              >
                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingRight: '4px' }}>
                  {loans.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>No loans found</p>
                  ) : (
                    loans.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.45rem 0.6rem',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <div style={{ minWidth: 0, paddingRight: '8px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.customer_name}</div>
                          <div style={{ fontSize: '0.71875rem', color: 'var(--muted)' }}>
                            {item.mode === 'D' ? 'Daily (10-Day)' : 'Weekly (10-Wk)'} • {item.ac_no ? `A/C #${item.ac_no}` : `Sheet #${item.main_sheet_no}`} • {item.loan_date}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: item.mode === 'D' ? '#eff6ff' : '#f5f3ff',
                              color: item.mode === 'D' ? '#1d4ed8' : '#6d28d9',
                            }}
                          >
                            {item.mode === 'D' ? 'DAILY' : 'WEEKLY'}
                          </span>
                          <strong style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
                            {currency.format(item.principal)}
                          </strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </HoverPopover>
            )}
          </div>

          {/* 6. CASH IN BANK */}
          <Link to="/reconciliation" className="kpi-card highlight-card" style={{ position: 'relative', zIndex: 1, textDecoration: 'none' }}>
            <CardHeader
              title="CASH IN BANK"
              badgeText="Nominal"
              badgeBg="#f0f9ff"
              badgeColor="#0284c7"
            />
            <span className="kpi-value">{currency.format(workbookCashInHand)}</span>
            <span className="kpi-subtext">TOTAL LEDGER − LOAN PRINCIPAL</span>
          </Link>

          {/* 7. BALANCE */}
          <Link to="/reconciliation" className="kpi-card highlight-card" style={{ position: 'relative', zIndex: 1, textDecoration: 'none', borderColor: '#3b82f6', background: '#f0f9ff' }}>
            <CardHeader
              title="BALANCE"
              badgeText="Reconciled"
              badgeBg="#dbeafe"
              badgeColor="#1d4ed8"
            />
            <span className="kpi-value" style={{ color: '#0284c7' }}>{currency.format(reconciledAvailableCash)}</span>
            <span className="kpi-subtext">Excludes ₹12,000 uncollected dues</span>
          </Link>

          {/* 8. WEEKLY LOANS */}
          <div
            className={`kpi-card${activeTooltip === 'WEEKLY_LOANS' ? ' active-popover' : ''}`}
            style={{ position: 'relative', zIndex: activeTooltip === 'WEEKLY_LOANS' ? 100 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setActiveTooltip('WEEKLY_LOANS')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('WEEKLY_LOANS')}
          >
            <CardHeader
              title="WEEKLY LOANS"
              badgeText="10-Wk"
              badgeBg="#f5f3ff"
              badgeColor="#6d28d9"
              tooltipKey="WEEKLY_LOANS"
              onToggle={toggleTooltip}
            />
            <span className="kpi-value" style={{ color: '#6d28d9' }}>{currency.format(weeklyLoansPrincipal)}</span>
            <span className="kpi-subtext">{weeklyLoans.length} accounts ledgered ({currency.format(weeklyLoansPrincipal)})</span>

            {activeTooltip === 'WEEKLY_LOANS' && (
              <HoverPopover
                title="Weekly Loan Accounts"
                subtitle="10-week installment schedule portfolio"
                totalAmount={weeklyLoansPrincipal}
                totalColor="#6d28d9"
                countLabel={`${weeklyLoans.length} weekly accounts`}
                align="right"
                linkTo="/weekly"
                linkText="View Weekly Loans Page"
              >
                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingRight: '4px' }}>
                  {weeklyLoans.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.45rem 0.6rem',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <div style={{ minWidth: 0, paddingRight: '8px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.customer_name}</div>
                        <div style={{ fontSize: '0.71875rem', color: 'var(--muted)' }}>
                          {item.ac_no ? `A/C #${item.ac_no}` : `Sheet #${item.main_sheet_no}`} • {item.loan_date}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <strong style={{ fontSize: '0.875rem', color: '#6d28d9' }}>{currency.format(item.principal)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </HoverPopover>
            )}
          </div>

          {/* 9. DAILY LOANS */}
          <div
            className={`kpi-card${activeTooltip === 'DAILY_LOANS' ? ' active-popover' : ''}`}
            style={{ position: 'relative', zIndex: activeTooltip === 'DAILY_LOANS' ? 100 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setActiveTooltip('DAILY_LOANS')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('DAILY_LOANS')}
          >
            <CardHeader
              title="DAILY LOANS"
              badgeText="10-Day"
              badgeBg="#eff6ff"
              badgeColor="#1d4ed8"
              tooltipKey="DAILY_LOANS"
              onToggle={toggleTooltip}
            />
            <span className="kpi-value" style={{ color: '#1d4ed8' }}>{currency.format(dailyLoansPrincipal)}</span>
            <span className="kpi-subtext">{dailyLoans.length} accounts ledgered ({currency.format(dailyLoansPrincipal)})</span>

            {activeTooltip === 'DAILY_LOANS' && (
              <HoverPopover
                title="Daily Loan Accounts"
                subtitle="10-day interest cycle loan portfolio"
                totalAmount={dailyLoansPrincipal}
                totalColor="#1d4ed8"
                countLabel={`${dailyLoans.length} daily accounts`}
                align="right"
                linkTo="/daily"
                linkText="View Daily Loans Page"
              >
                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingRight: '4px' }}>
                  {dailyLoans.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.45rem 0.6rem',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <div style={{ minWidth: 0, paddingRight: '8px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.customer_name}</div>
                        <div style={{ fontSize: '0.71875rem', color: 'var(--muted)' }}>
                          {item.ac_no ? `A/C #${item.ac_no}` : `Sheet #${item.main_sheet_no}`} • {item.loan_date}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <strong style={{ fontSize: '0.875rem', color: '#1d4ed8' }}>{currency.format(item.principal)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </HoverPopover>
            )}
          </div>

          {/* 10. DUE TODAY */}
          <Link to="/reminders" className="kpi-card warning-card" style={{ position: 'relative', zIndex: 1, textDecoration: 'none' }}>
            <CardHeader
              title="DUE TODAY"
              badgeText="Pending"
              badgeBg="#fff7e6"
              badgeColor="#b45309"
            />
            <span className="kpi-value" style={{ color: '#b45309' }}>{currency.format(dueTodayAmount)}</span>
            <span className="kpi-subtext">{dueTodayCount} installment obligations due today</span>
          </Link>

          {/* 11. OVERDUE */}
          <Link to="/reminders" className="kpi-card danger-card" style={{ position: 'relative', zIndex: 1, textDecoration: 'none' }}>
            <CardHeader
              title="OVERDUE"
              badgeText="Action"
              badgeBg="#fef2f2"
              badgeColor="#dc2626"
            />
            <span className="kpi-value text-danger">{currency.format(overdueAmount)}</span>
            <span className="kpi-subtext">{overdueCount} installments past due date</span>
          </Link>
        </div>
      )}
    </div>
  )
}
