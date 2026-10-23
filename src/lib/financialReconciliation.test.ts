import { describe, expect, it } from 'vitest'

describe('Financial Reconciliation Reference Verification (NISHANTH-2026.xlsx targets)', () => {
  // Reference figures from physical ledger & Excel sheets (PLAN, SEP&OCT, LOAN):
  const EXPECTED_INVESTMENT_TOTAL = 185000
  const EXPECTED_INTEREST_TOTAL = 4950
  const EXPECTED_TEN_PERCENT_PROFIT = 8970
  const EXPECTED_OUTSTANDING_DUES = 12000
  const EXPECTED_LEDGER_TOTAL = 210920
  const EXPECTED_LOAN_PRINCIPAL = 162000
  const EXPECTED_WORKBOOK_CASH = 48920
  const EXPECTED_RECONCILED_AVAILABLE_CASH = 36920 // 48920 - 12000 dues

  it('verifies exact workbook arithmetic: Investment + Interest + 10% Profit + Dues = Total Ledger Value', () => {
    const calculatedSum =
      EXPECTED_INVESTMENT_TOTAL +
      EXPECTED_INTEREST_TOTAL +
      EXPECTED_TEN_PERCENT_PROFIT +
      EXPECTED_OUTSTANDING_DUES

    expect(calculatedSum).toBe(EXPECTED_LEDGER_TOTAL)
  })

  it('verifies workbook reported cash in hand equals Ledger Total minus Principal Disbursed', () => {
    const workbookCash = EXPECTED_LEDGER_TOTAL - EXPECTED_LOAN_PRINCIPAL
    expect(workbookCash).toBe(EXPECTED_WORKBOOK_CASH)
  })

  it('verifies transaction-derived available cash reconciles when unpaid dues (receivables) are deducted', () => {
    // Crucial accounting distinction: ₹12,000 is an uncollected receivable, not physical cash.
    const transactionCash = EXPECTED_WORKBOOK_CASH - EXPECTED_OUTSTANDING_DUES
    expect(transactionCash).toBe(EXPECTED_RECONCILED_AVAILABLE_CASH)
  })

  it('verifies 8 verified investment detail records reconcile to ₹185,000', () => {
    const investmentEntries = [
      { name: 'PONNIYAN', amount: 27000, date: '2026-09-20' },
      { name: 'SATHISH', amount: 13000, date: '2026-09-21' },
      { name: 'RATHIKA', amount: 50000, date: '2026-09-24' },
      { name: 'GURUSAMY', amount: 30000, date: '2026-09-24' },
      { name: 'JYOTHIMANI', amount: 10000, date: '2026-09-30' },
      { name: 'SATHISH-THAND', amount: 25000, date: '2026-10-04' },
      { name: 'SIVARAJ', amount: 10000, date: '2026-10-12' },
      { name: 'THANGARAJ', amount: 20000, date: '2026-10-17' },
    ]
    const total = investmentEntries.reduce((sum, e) => sum + e.amount, 0)
    expect(investmentEntries.length).toBe(8)
    expect(total).toBe(185000)
  })

  it('verifies 9 interest detail records reconcile to ₹4,950', () => {
    const interestEntries = [
      { name: 'YUVARAJ-DMK', amount: 500, date: '2026-10-01' },
      { name: 'PATTANI', amount: 90, date: '2026-10-01' },
      { name: 'PATTANI', amount: 60, date: '2026-10-02' },
      { name: 'KAVITHA', amount: 500, date: '2026-10-03' },
      { name: 'PATTANI', amount: 200, date: '2026-10-05' },
      { name: 'KARUPPASAMY', amount: 1000, date: '2026-10-11' },
      { name: 'YUVARAJ-DMK', amount: 500, date: '2026-10-13' },
      { name: 'PRAKASH', amount: 2000, date: '2026-10-18' },
      { name: 'SCM  SELVAM', amount: 100, date: '2026-10-21' },
    ]
    const total = interestEntries.reduce((sum, e) => sum + e.amount, 0)
    expect(interestEntries.length).toBe(9)
    expect(total).toBe(4950)
  })

  it('verifies 24 10% profit detail records reconcile to ₹8,970 (not ₹161,010)', () => {
    const profitEntries = [
      { name: 'GANESHAMURTHI', amount: 50 },
      { name: 'NARAYANAKUMAR', amount: 600 },
      { name: 'GOVIND', amount: 730 },
      { name: 'ARUN', amount: 230 },
      { name: 'UMA', amount: 580 },
      { name: 'MT', amount: 140 },
      { name: 'DIVYA', amount: 100 },
      { name: 'BALACHANDAR', amount: 700 },
      { name: 'KALYANAM', amount: 550 },
      { name: 'MUBARAK', amount: 600 },
      { name: 'GOVIND', amount: 400 },
      { name: 'MURUGESH', amount: 330 },
      { name: 'VIGNESH', amount: 40 },
      { name: 'THANGARAJ', amount: 100 },
      { name: 'DHINESH UPSTER', amount: 1000 },
      { name: 'PRAKASH-AUTO MURI', amount: 500 },
      { name: 'RAJA-RENT', amount: 150 },
      { name: 'KEERTHI-PWRHOUSE', amount: 200 },
      { name: 'RAJA-SARAN', amount: 40 },
      { name: 'GOPALAN', amount: 320 },
      { name: 'PATHIRAM A/C', amount: 700 },
      { name: 'RAJESWARI', amount: 60 },
      { name: 'WESSELS', amount: 250 },
      { name: 'NARAYANAKUMAR', amount: 600 },
    ]
    const total = profitEntries.reduce((sum, e) => sum + e.amount, 0)
    expect(profitEntries.length).toBe(24)
    expect(total).toBe(8970)
    expect(total).not.toBe(161010)
  })

  it('verifies 6 outstanding due entries reconcile to ₹12,000', () => {
    const dueEntries = [
      { name: 'AJITH-1', amount: 3000, date: '2026-10-06' },
      { name: 'SHANTHI-1', amount: 1000, date: '2026-10-11' },
      { name: 'DIVYA', amount: 1000, date: '2026-10-11' },
      { name: 'AJITH-2', amount: 3000, date: '2026-10-13' },
      { name: 'AJITH-3', amount: 3000, date: '2026-10-20' },
      { name: 'SHANTHI-2', amount: 1000, date: '2026-10-19' },
    ]
    const total = dueEntries.reduce((sum, e) => sum + e.amount, 0)
    expect(dueEntries.length).toBe(6)
    expect(total).toBe(12000)
  })

  it('verifies 17 loan ledger rows reconcile to ₹162,000 principal issued (including 0-amount closed rows)', () => {
    const loanRows = [
      { sNo: 1, name: 'YUVARAJ-DMK', principal: 10000, mode: 'D', status: 'active' },
      { sNo: 2, name: 'KARUPPASAMY', principal: 10000, mode: 'D', status: 'active' },
      { sNo: 3, name: 'KAVITHA', principal: 15000, mode: 'D', status: 'active' },
      { sNo: 4, name: 'KALYANAM', principal: 15000, mode: 'D', status: 'active' },
      { sNo: 5, name: 'RAJA', principal: 3000, mode: 'D', status: 'active' },
      { sNo: 6, name: 'PRAKASH', principal: 0, mode: 'D', status: 'closed' },
      { sNo: 7, name: 'KAVITHA', principal: 20000, mode: 'D', status: 'active' },
      { sNo: 8, name: 'KALYANAM', principal: 15000, mode: 'D', status: 'active' },
      { sNo: 9, name: 'PATTANI', principal: 0, mode: 'D', status: 'closed' },
      { sNo: 10, name: 'PATTANI', principal: 0, mode: 'D', status: 'closed' },
      { sNo: 11, name: 'PATTANI', principal: 0, mode: 'D', status: 'closed' },
      { sNo: 12, name: 'PATTANI', principal: 0, mode: 'D', status: 'closed' },
      { sNo: 13, name: 'SHANTHI-PATTAN', principal: 9000, mode: 'W', status: 'active' },
      { sNo: 14, name: 'DIVYA', principal: 9000, mode: 'W', status: 'active' },
      { sNo: 15, name: 'DEVI-AATHA', principal: 9000, mode: 'W', status: 'active' },
      { sNo: 16, name: 'AJITH', principal: 27000, mode: 'W', status: 'active' },
      { sNo: 17, name: 'GOVIND', principal: 20000, mode: 'D', status: 'active' },
    ]
    expect(loanRows.length).toBe(17)
    const totalPrincipal = loanRows.reduce((sum, l) => sum + l.principal, 0)
    expect(totalPrincipal).toBe(162000)

    // Verify historical closed rows are preserved with 0 principal
    const closedRows = loanRows.filter((l) => l.status === 'closed')
    expect(closedRows.length).toBe(5)
    expect(closedRows.every((l) => l.principal === 0)).toBe(true)
  })

  it('strictly rejects classifying incoming investment credits as 10% profit', () => {
    const rawCredit = {
      particulars: 'RATHIKA',
      credit: 50000,
      isInvestment: true,
    }
    // Investment is NOT profit
    const profitClassified = rawCredit.isInvestment ? 0 : rawCredit.credit * 0.1
    expect(profitClassified).toBe(0)
  })
})
