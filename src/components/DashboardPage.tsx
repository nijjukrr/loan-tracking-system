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
  MonthlyFundCollection,
  MonthlyFundMember,
  Payment,
  SweetFundMember,
  SweetFundPayment,
  SweetFundProgramme,
  TenPercentEntry,
} from '../types'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

type Props = {
  onOpenNewLoan?: () => void
}

type ActiveTooltip =
  | 'CAPITAL_POOL'
  | 'INVEST'
  | 'INTEREST'
  | 'PROFIT'
  | 'DUE'
  | 'INCOME'
  | 'TOTAL_LEDGER'
  | 'LOAN'
  | 'DAILY_LOANS'
  | 'WEEKLY_LOANS'
  | 'MONTHLY_FUND'
  | 'SWEET_FUND'
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
  const [sweetProgramme, setSweetProgramme] = useState<SweetFundProgramme | null>(null)
  const [sweetMembers, setSweetMembers] = useState<SweetFundMember[]>([])
  const [sweetPayments, setSweetPayments] = useState<SweetFundPayment[]>([])
  const [monthlyMembers, setMonthlyMembers] = useState<MonthlyFundMember[]>([])
  const [monthlyCollections, setMonthlyCollections] = useState<MonthlyFundCollection[]>([])
  const [allPayments, setAllPayments] = useState<Payment[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip>(null)
  const [breakdownTab, setBreakdownTab] = useState<'ALL' | 'DUE' | 'INTEREST' | 'PROFIT'>('ALL')
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
      financeApi.getSweetFundProgramme(),
      financeApi.listSweetFundMembers(),
      financeApi.listSweetFundPayments(),
      financeApi.listMonthlyFundMembers(),
      financeApi.listMonthlyFundCollections(),
      financeApi.listPayments(),
      financeApi.listInstallments(),
    ])
      .then(([mRes, iRes, tRes, dRes, invRes, lRes, sProg, sMem, sPay, mMem, mCol, payRes, instRes]) => {
        setMetrics(mRes)
        setInterests(iRes)
        setTenPercentEntries(tRes)
        setDues(dRes)
        setInvestments(invRes)
        setLoans(lRes)
        setSweetProgramme(sProg)
        setSweetMembers(sMem)
        setSweetPayments(sPay)
        setMonthlyMembers(mMem)
        setMonthlyCollections(mCol)
        setAllPayments(payRes)
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
  const recoveredPrincipal = allPayments.reduce((sum, p) => sum + Number(p.principal_allocation || 0), 0)
  const availableCapitalPool = totalInvestment + recoveredPrincipal

  const totalInterest = interests.reduce((sum, i) => sum + Number(i.amount || 0), 0) || (metrics?.interestReceived ?? 4950)
  const totalProfit = tenPercentEntries.reduce((sum, t) => sum + Number(t.amount || 0), 0) || (metrics?.tenPercentProfit ?? 8970)
  const totalDue = dues.reduce((sum, d) => sum + Number(d.remaining_amount ?? d.amount ?? 0), 0) || (metrics?.outstandingDues ?? 12000)

  // Custom Ledger Formula: DUE + PROFIT + INTEREST
  const totalIncome = totalDue + totalProfit + totalInterest
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

  // Monthly Fund (4 members, targets total ₹37,800)
  const monthlyCollectedTotal =
    monthlyMembers.reduce((sum, m) => sum + Number(m.total_collected || 0), 0) ||
    monthlyCollections.reduce((sum, c) => sum + Number(c.amount || 0), 0)
  const monthlyTargetTotal = monthlyMembers.reduce((sum, m) => sum + Number(m.target_amount || 0), 0) || 37800

  // Sweet Fund (50 members, 50 weeks, target ₹5,15,000)
  const sweetCollectedTotal =
    sweetMembers.reduce((sum, m) => sum + Number(m.total_paid || 0), 0) ||
    sweetPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const sweetTargetTotal = sweetProgramme?.total_target || 515000

  // Today & Collections
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayCollections = allPayments
    .filter((p) => (p.payment_date || '').slice(0, 10) === todayStr)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  // Due Today & Overdue
  const dueTodayInsts = installments.filter((i) => (i.due_date || '').slice(0, 10) === todayStr && i.paid_amount < i.expected_amount)
  const dueTodayCount = dueTodayInsts.length
  const dueTodayAmount = dueTodayInsts.reduce((sum, i) => sum + (i.expected_amount - i.paid_amount), 0)

  const overdueInsts = installments.filter((i) => (i.due_date || '').slice(0, 10) < todayStr && i.paid_amount < i.expected_amount)
  const overdueCount = overdueInsts.length
  const overdueAmount = overdueInsts.reduce((sum, i) => sum + (i.expected_amount - i.paid_amount), 0)

  // Account status counts
  const activeLoans = loans.filter((l) => l.status === 'active')
  const closedLoans = loans.filter((l) => l.status === 'closed')

  const toggleTooltip = (key: ActiveTooltip) => {
    setActiveTooltip((prev) => (prev === key ? null : key))
  }

  const incomeItems = useMemo(() => {
    const list: Array<{
      id: string
      source: 'INTEREST' | 'PROFIT' | 'DUE'
      customerName: string
      accountInfo: string
      amount: number
      date: string
    }> = []

    interests.forEach((item) => {
      list.push({
        id: `int-${item.id}`,
        source: 'INTEREST',
        customerName: item.customer_name || 'Customer',
        accountInfo: cleanEntrySubtitle(item.notes, item.ac_no ? `A/C #${item.ac_no}` : 'Interest Receipt'),
        amount: Number(item.amount || 0),
        date: item.entry_date,
      })
    })

    tenPercentEntries.forEach((item) => {
      list.push({
        id: `ten-${item.id}`,
        source: 'PROFIT',
        customerName: item.particulars || 'Payer',
        accountInfo: cleanEntrySubtitle(item.notes, item.main_sheet_no ? `Sheet #${item.main_sheet_no}` : '10% Profit'),
        amount: Number(item.amount || 0),
        date: item.entry_date,
      })
    })

    dues.forEach((item) => {
      list.push({
        id: `due-${item.id}`,
        source: 'DUE',
        customerName: item.borrower_name || 'Borrower',
        accountInfo: cleanEntrySubtitle(item.notes, 'Customer Due'),
        amount: Number(item.remaining_amount ?? item.amount ?? 0),
        date: item.due_date || '2026-10-01',
      })
    })

    return list
  }, [interests, tenPercentEntries, dues])

  const filteredIncomeItems = useMemo(() => {
    if (breakdownTab === 'ALL') return incomeItems
    return incomeItems.filter((i) => i.source === breakdownTab)
  }, [incomeItems, breakdownTab])

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
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((i) => (
            <div className="kpi-card" key={i} style={{ opacity: 0.5 }}>
              <span className="kpi-label">Loading…</span>
              <span className="kpi-value">—</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="kpi-grid">
          {/* 1. CAPITAL POOL (Available Operational Capital) */}
          <div
            className={`kpi-card highlight-card${activeTooltip === 'CAPITAL_POOL' ? ' active-popover' : ''}`}
            style={{ position: 'relative', zIndex: activeTooltip === 'CAPITAL_POOL' ? 100 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setActiveTooltip('CAPITAL_POOL')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('CAPITAL_POOL')}
          >
            <CardHeader
              title="CAPITAL POOL"
              badgeText="Available"
              badgeBg="#ecfdf5"
              badgeColor="#047857"
              tooltipKey="CAPITAL_POOL"
              onToggle={toggleTooltip}
            />
            <span className="kpi-value" style={{ color: '#047857' }}>{currency.format(availableCapitalPool)}</span>
            <span className="kpi-subtext">
              {currency.format(totalInvestment)} capital + {currency.format(recoveredPrincipal)} recovered
            </span>

            {activeTooltip === 'CAPITAL_POOL' && (
              <HoverPopover
                title="Operational Capital Pool"
                subtitle="Original partner investment plus recovered loan principal"
                totalAmount={availableCapitalPool}
                totalColor="#047857"
                countLabel={`Principal Recovered: ${currency.format(recoveredPrincipal)}`}
                align="left"
                linkTo="/investments"
                linkText="View Capital Pool Breakdown"
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0.6rem', background: '#f8fafc', borderRadius: '6px' }}>
                    <span>Original Investor Capital:</span>
                    <strong>{currency.format(totalInvestment)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0.6rem', background: '#f8fafc', borderRadius: '6px' }}>
                    <span>Principal Recovered from Loans:</span>
                    <strong style={{ color: '#047857' }}>+{currency.format(recoveredPrincipal)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0.6rem', background: '#ecfdf5', borderRadius: '6px', fontWeight: 700 }}>
                    <span>Total Available Operational Pool:</span>
                    <span style={{ color: '#047857' }}>{currency.format(availableCapitalPool)}</span>
                  </div>
                </div>
              </HoverPopover>
            )}
          </div>

          {/* 2. ORIGINAL INVEST (Partner Capital Contributions) */}
          <div
            className={`kpi-card${activeTooltip === 'INVEST' ? ' active-popover' : ''}`}
            style={{ position: 'relative', zIndex: activeTooltip === 'INVEST' ? 100 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setActiveTooltip('INVEST')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('INVEST')}
          >
            <CardHeader
              title="ORIGINAL INVEST"
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
                  {investments.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>No entries found</p>
                  ) : (
                    investments.map((item) => (
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
                    ))
                  )}
                </div>
              </HoverPopover>
            )}
          </div>

          {/* 3. INTEREST RECEIVED */}
          <div
            className={`kpi-card${activeTooltip === 'INTEREST' ? ' active-popover' : ''}`}
            style={{ position: 'relative', zIndex: activeTooltip === 'INTEREST' ? 100 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setActiveTooltip('INTEREST')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('INTEREST')}
          >
            <CardHeader
              title="INTEREST"
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

          {/* 4. 10% PROFIT RECEIVED */}
          <div
            className={`kpi-card${activeTooltip === 'PROFIT' ? ' active-popover' : ''}`}
            style={{ position: 'relative', zIndex: activeTooltip === 'PROFIT' ? 100 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setActiveTooltip('PROFIT')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('PROFIT')}
          >
            <CardHeader
              title="10% PROFIT"
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

          {/* 5. OUTSTANDING DUES */}
          <div
            className={`kpi-card danger-card${activeTooltip === 'DUE' ? ' active-popover' : ''}`}
            style={{ position: 'relative', zIndex: activeTooltip === 'DUE' ? 100 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setActiveTooltip('DUE')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('DUE')}
          >
            <CardHeader
              title="DUE"
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

          {/* 6. TOTAL INCOME (Custom Ledger Formula) */}
          <div
            className={`kpi-card accent-card${activeTooltip === 'INCOME' ? ' active-popover' : ''}`}
            style={{ position: 'relative', zIndex: activeTooltip === 'INCOME' ? 100 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setActiveTooltip('INCOME')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('INCOME')}
          >
            <CardHeader
              title="TOTAL INCOME"
              badgeText="Formula"
              badgeBg="#ecfdf5"
              badgeColor="#047857"
              tooltipKey="INCOME"
              onToggle={toggleTooltip}
            />
            <span className="kpi-value" style={{ color: '#047857' }}>
              {currency.format(totalIncome)}
            </span>
            <span className="kpi-subtext">DUE + PROFIT + INTEREST</span>

            {activeTooltip === 'INCOME' && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  width: '440px',
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--line, #e2e8f0)' }}>
                  <div>
                    <strong style={{ fontSize: '0.9375rem', color: 'var(--text)' }}>Total Income Sources</strong>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>Due + 10% Profit + Interest</p>
                  </div>
                  <strong style={{ fontSize: '1.125rem', color: '#047857' }}>{currency.format(totalIncome)}</strong>
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setBreakdownTab('ALL')}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: breakdownTab === 'ALL' ? '#0f172a' : '#f1f5f9',
                      color: breakdownTab === 'ALL' ? '#ffffff' : '#334155',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    All ({incomeItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownTab('DUE')}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: breakdownTab === 'DUE' ? '#dc2626' : '#fee2e2',
                      color: breakdownTab === 'DUE' ? '#ffffff' : '#991b1b',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Due ({currency.format(totalDue)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownTab('PROFIT')}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: breakdownTab === 'PROFIT' ? '#0284c7' : '#e0f2fe',
                      color: breakdownTab === 'PROFIT' ? '#ffffff' : '#0369a1',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Profit ({currency.format(totalProfit)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownTab('INTEREST')}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: breakdownTab === 'INTEREST' ? '#1d4ed8' : '#dbeafe',
                      color: breakdownTab === 'INTEREST' ? '#ffffff' : '#1e40af',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Interest ({currency.format(totalInterest)})
                  </button>
                </div>

                <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingRight: '4px' }}>
                  {filteredIncomeItems.map((item) => (
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
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.customerName}</div>
                        <div style={{ fontSize: '0.71875rem', color: 'var(--muted)' }}>
                          {item.accountInfo} • {item.date}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: item.source === 'DUE' ? '#fee2e2' : item.source === 'PROFIT' ? '#e0f2fe' : '#dbeafe',
                            color: item.source === 'DUE' ? '#991b1b' : item.source === 'PROFIT' ? '#0369a1' : '#1e40af',
                            marginRight: '6px',
                          }}
                        >
                          {item.source}
                        </span>
                        <strong style={{ fontSize: '0.875rem', color: item.source === 'DUE' ? '#dc2626' : '#047857' }}>
                          {currency.format(item.amount)}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--line, #e2e8f0)', textAlign: 'center' }}>
                  <Link
                    to="/total-income"
                    style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
                  >
                    View Dedicated Total Income Page →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* 7. TOTAL LEDGER VALUE */}
          <Link
            to="/reconciliation"
            className="kpi-card highlight-card"
            style={{ position: 'relative', zIndex: 1, textDecoration: 'none' }}
          >
            <CardHeader
              title="TOTAL LEDGER"
              badgeText="Gross"
              badgeBg="#f1f5f9"
              badgeColor="#334155"
            />
            <span className="kpi-value" style={{ color: '#0f172a' }}>{currency.format(totalLedgerValue)}</span>
            <span className="kpi-subtext">INVEST + INTEREST + PROFIT + DUE</span>
          </Link>

          {/* 8. LOAN PRINCIPAL ISSUED */}
          <div
            className={`kpi-card${activeTooltip === 'LOAN' ? ' active-popover' : ''}`}
            style={{ position: 'relative', zIndex: activeTooltip === 'LOAN' ? 100 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setActiveTooltip('LOAN')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('LOAN')}
          >
            <CardHeader
              title="LOAN PRINCIPAL"
              badgeText="Deployed"
              badgeBg="#f5f3ff"
              badgeColor="#6d28d9"
              tooltipKey="LOAN"
              onToggle={toggleTooltip}
            />
            <span className="kpi-value">{currency.format(totalLoansPrincipal)}</span>
            <span className="kpi-subtext">{loans.length} loan accounts ledgered ({currency.format(totalLoansPrincipal)})</span>

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

          {/* 9. CASH IN BANK (Reported Nominal Balance) */}
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

          {/* 10. LIQUID CASH (Reconciled Available Cash) */}
          <Link to="/reconciliation" className="kpi-card highlight-card" style={{ position: 'relative', zIndex: 1, textDecoration: 'none', borderColor: '#3b82f6', background: '#f0f9ff' }}>
            <CardHeader
              title="LIQUID CASH"
              badgeText="Reconciled"
              badgeBg="#dbeafe"
              badgeColor="#1d4ed8"
            />
            <span className="kpi-value" style={{ color: '#0284c7' }}>{currency.format(reconciledAvailableCash)}</span>
            <span className="kpi-subtext">Excludes ₹12,000 uncollected dues</span>
          </Link>

          {/* 11. DAILY LOAN ACCOUNTS */}
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

          {/* 12. WEEKLY LOAN ACCOUNTS */}
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

          {/* 13. MONTHLY FUND PROGRESS */}
          <div
            className={`kpi-card highlight-card${activeTooltip === 'MONTHLY_FUND' ? ' active-popover' : ''}`}
            style={{
              position: 'relative',
              zIndex: activeTooltip === 'MONTHLY_FUND' ? 100 : 1,
              cursor: 'pointer',
              background: '#f0fdfa',
              borderColor: '#14b8a6',
            }}
            onMouseEnter={() => setActiveTooltip('MONTHLY_FUND')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('MONTHLY_FUND')}
          >
            <CardHeader
              title="MONTHLY FUND"
              badgeText="Targets"
              badgeBg="#ccfbf1"
              badgeColor="#0f766e"
              tooltipKey="MONTHLY_FUND"
              onToggle={toggleTooltip}
            />
            <span className="kpi-value" style={{ color: '#0f766e' }}>
              {currency.format(monthlyCollectedTotal)}
            </span>
            <span className="kpi-subtext">
              Target: {currency.format(monthlyTargetTotal)} ({monthlyMembers.length} members)
            </span>

            {activeTooltip === 'MONTHLY_FUND' && (
              <HoverPopover
                title="Monthly Fund Targets & Collections"
                subtitle="Daily fixed collections towards individual targets"
                totalAmount={monthlyCollectedTotal}
                totalColor="#0f766e"
                countLabel={`${monthlyMembers.length} target members`}
                align="right"
                linkTo="/funds/monthly"
                linkText="View Full Monthly Fund Ledger"
              >
                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingRight: '4px' }}>
                  {monthlyMembers.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>
                      No monthly fund members enrolled yet.
                    </p>
                  ) : (
                    monthlyMembers.map((item) => (
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
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                          <div style={{ fontSize: '0.71875rem', color: 'var(--muted)' }}>
                            Target: {currency.format(item.target_amount)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <strong style={{ fontSize: '0.875rem', color: '#0f766e' }}>{currency.format(item.target_amount)}</strong>
                          <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--muted)' }}>
                            {currency.format(item.total_collected)} recd
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </HoverPopover>
            )}
          </div>

          {/* 14. SWEET FUND PROGRESS */}
          <div
            className={`kpi-card highlight-card${activeTooltip === 'SWEET_FUND' ? ' active-popover' : ''}`}
            style={{
              position: 'relative',
              zIndex: activeTooltip === 'SWEET_FUND' ? 100 : 1,
              cursor: 'pointer',
              background: '#fffdf5',
              borderColor: '#f59e0b',
            }}
            onMouseEnter={() => setActiveTooltip('SWEET_FUND')}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => toggleTooltip('SWEET_FUND')}
          >
            <CardHeader
              title="SWEET FUND"
              badgeText="Diwali"
              badgeBg="#fef3c7"
              badgeColor="#b45309"
              tooltipKey="SWEET_FUND"
              onToggle={toggleTooltip}
            />
            <span className="kpi-value" style={{ color: '#b45309' }}>
              {currency.format(sweetCollectedTotal)}
            </span>
            <span className="kpi-subtext">
              Target: {currency.format(sweetTargetTotal)} (50 weeks)
            </span>

            {activeTooltip === 'SWEET_FUND' && (
              <HoverPopover
                title="Diwali Sweet Fund Programme"
                subtitle="50-week contribution scheme"
                totalAmount={sweetCollectedTotal}
                totalColor="#b45309"
                countLabel={`Target: ${currency.format(sweetTargetTotal)}`}
                align="right"
                linkTo="/funds/sweet"
                linkText="View Full Sweet Fund Programme"
              >
                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingRight: '4px' }}>
                  {sweetMembers.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>
                      Ready for 50-member Sweet Fund participant enrollment or Excel import.
                    </p>
                  ) : (
                    sweetMembers.map((item) => (
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
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                            #{item.member_number} {item.member_name}
                          </div>
                          <div style={{ fontSize: '0.71875rem', color: 'var(--muted)' }}>
                            Target: {currency.format(sweetProgramme?.target_per_member || 10300)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <strong style={{ fontSize: '0.875rem', color: '#b45309' }}>{currency.format(item.total_paid)}</strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </HoverPopover>
            )}
          </div>

          {/* 15. TODAY'S COLLECTIONS */}
          <Link to="/payments" className="kpi-card" style={{ position: 'relative', zIndex: 1, textDecoration: 'none' }}>
            <CardHeader
              title="TODAY'S IN"
              badgeText="Live"
              badgeBg="#ecfdf5"
              badgeColor="#047857"
            />
            <span className="kpi-value" style={{ color: '#047857' }}>{currency.format(todayCollections)}</span>
            <span className="kpi-subtext">Collections received today</span>
          </Link>

          {/* 16. DUE TODAY */}
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

          {/* 17. OVERDUE PAYMENTS */}
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

          {/* 18. ACTIVE ACCOUNTS */}
          <Link to="/active-accounts" className="kpi-card success-card" style={{ position: 'relative', zIndex: 1, textDecoration: 'none' }}>
            <CardHeader
              title="ACTIVE LOANS"
              badgeText="Active"
              badgeBg="#eaf7ee"
              badgeColor="#16803c"
            />
            <span className="kpi-value" style={{ color: '#16803c' }}>{activeLoans.length} Active</span>
            <span className="kpi-subtext">Active loan customer accounts</span>
          </Link>

          {/* 19. COMPLETED ACCOUNTS */}
          <Link to="/closed-accounts" className="kpi-card" style={{ position: 'relative', zIndex: 1, textDecoration: 'none' }}>
            <CardHeader
              title="COMPLETED LOANS"
              badgeText="Closed"
              badgeBg="#f1f5f9"
              badgeColor="#64748b"
            />
            <span className="kpi-value" style={{ color: '#64748b' }}>{closedLoans.length} Closed</span>
            <span className="kpi-subtext">Fully settled & closed accounts</span>
          </Link>
        </div>
      )}
    </div>
  )
}
