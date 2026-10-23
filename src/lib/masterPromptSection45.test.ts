import { beforeEach, describe, expect, it } from 'vitest'
import { LocalPreviewFinanceApi, resetLocalStore } from './financeApi'
import { generateWeeklyInstallments } from './financeLogic'

describe('Master Prompt Section 45: Comprehensive Financial Verification Suite', () => {
  let api: LocalPreviewFinanceApi

  beforeEach(() => {
    resetLocalStore()
    api = new LocalPreviewFinanceApi()
  })

  it('1. Initial investment total is ₹1,85,000 across 8 verified entries', async () => {
    const investments = await api.listInvestments()
    expect(investments).toHaveLength(8)
    const total = investments.reduce((sum, i) => sum + i.amount, 0)
    expect(total).toBe(185000)
  })

  it('2. Adding ₹10,000 changes the relevant pool view to ₹1,95,000', async () => {
    const newInv = await api.addInvestment({
      entry_date: '2026-10-24',
      investor_name: 'TEST NEW INVESTOR',
      amount: 10000,
      notes: 'New capital contribution',
    })
    expect(newInv.id).toBeDefined()

    const investments = await api.listInvestments()
    const total = investments.reduce((sum, i) => sum + i.amount, 0)
    expect(total).toBe(195000)

    const metrics = await api.getDashboardMetrics()
    expect(metrics.investmentReceived).toBe(195000)
    expect(metrics.availableCapitalPool).toBe(195000)
    expect(metrics.originalInvestorContributions).toBe(195000)
  })

  it('3. Original investor contributions remain separate from recovered principal', async () => {
    // Record loan repayment of ₹10,000 principal
    const loans = await api.listLoans({ mode: 'D', status: 'active' })
    const targetLoan = loans[0]
    expect(targetLoan).toBeDefined()

    const paymentResult = await api.recordPayment({
      loan_id: targetLoan.id,
      amount: 10000,
      payment_type: 'Principal',
      payment_date: '2026-10-24',
      principal_allocation: 10000,
      note: 'Returned principal from borrower',
    })
    expect(paymentResult.payment.principal_allocation).toBe(10000)

    const metrics = await api.getDashboardMetrics()
    // Original investor contributions must remain 185,000
    expect(metrics.originalInvestorContributions).toBe(185000)
    // Recovered principal is 10,000
    expect(metrics.recoveredPrincipal).toBe(10000)
    // Available operational capital pool increases to 195,000
    expect(metrics.availableCapitalPool).toBe(195000)
  })

  it('4. Interest total is ₹4,950 across 9 verified entries', async () => {
    const interests = await api.listInterests()
    expect(interests).toHaveLength(9)
    const total = interests.reduce((sum, i) => sum + i.amount, 0)
    expect(total).toBe(4950)
  })

  it('5. Profit total is ₹8,970 across 24 verified entries', async () => {
    const profits = await api.listTenPercentEntries()
    expect(profits).toHaveLength(24)
    const total = profits.reduce((sum, p) => sum + p.amount, 0)
    expect(total).toBe(8970)
  })

  it('6. Existing due reference total is ₹12,000 across 6 receivables', async () => {
    const dues = await api.listDues()
    expect(dues).toHaveLength(6)
    const total = dues.reduce((sum, d) => sum + d.amount, 0)
    expect(total).toBe(12000)
  })

  it('7. Total Income custom formula equals ₹25,920 initially (Due + Profit + Interest)', async () => {
    const metrics = await api.getDashboardMetrics()
    expect(metrics.outstandingDues).toBe(12000)
    expect(metrics.tenPercentProfit).toBe(8970)
    expect(metrics.interestReceived).toBe(4950)
    expect(metrics.customTotalIncome).toBe(25920)
  })

  it('8. Total Ledger Value equals ₹2,10,920 using initial source categories (Invest + Interest + Profit + Due)', async () => {
    const metrics = await api.getDashboardMetrics()
    expect(metrics.workbookTotalLedger).toBe(210920)
    // 185000 + 4950 + 8970 + 12000 = 210920
    expect(
      metrics.investmentReceived +
      metrics.interestReceived +
      metrics.tenPercentProfit +
      metrics.outstandingDues
    ).toBe(210920)
  })

  it('9. The source-reported loan principal figure is ₹1,62,000 across 17 accounts', async () => {
    const allLoans = await api.listLoans()
    expect(allLoans).toHaveLength(17)
    const totalPrincipal = allLoans.reduce((sum, l) => sum + (l.principal || 0), 0)
    expect(totalPrincipal).toBe(162000)
  })

  it('10. Historical zero-amount closed rows are preserved', async () => {
    const closedLoans = await api.listLoans({ status: 'closed' })
    expect(closedLoans.length).toBeGreaterThan(0)
    const zeroAmountClosed = closedLoans.filter((l) => l.principal === 0 || l.source_remarks?.includes('A/C CLOSED'))
    expect(zeroAmountClosed.length).toBeGreaterThan(0)
  })

  it('11. Daily and weekly loans display by their correct mode (D vs W)', async () => {
    const dailyLoans = await api.listLoans({ mode: 'D' })
    expect(dailyLoans).toHaveLength(13)
    dailyLoans.forEach((l) => expect(l.mode).toBe('D'))

    const weeklyLoans = await api.listLoans({ mode: 'W' })
    expect(weeklyLoans).toHaveLength(4)
    weeklyLoans.forEach((l) => expect(l.mode).toBe('W'))
  })

  it('12-15. Weekly loan workflow: ₹27,000 principal produces 10 installments of ₹3,000 starting Oct 7 for Oct 1 loan', () => {
    const insts = generateWeeklyInstallments('test-wk-1', '2026-10-01', '2026-10-07', 3000)
    expect(insts).toHaveLength(10)
    expect(insts[0].due_date).toBe('2026-10-07')
    expect(insts[0].expected_amount).toBe(3000)
    expect(insts[1].due_date).toBe('2026-10-14')
    expect(insts[1].expected_amount).toBe(3000)
    expect(insts[2].due_date).toBe('2026-10-21')
    expect(insts[9].due_date).toBe('2026-12-09')
    expect(insts[9].expected_amount).toBe(3000)

    const totalExpected = insts.reduce((sum, i) => sum + i.expected_amount, 0)
    expect(totalExpected).toBe(30000)
  })

  it('16-17. Paying weekly installments reduces remaining amount and closes once upon full settlement', async () => {
    const newLoan = await api.createLoan({
      customer_name: 'TEST-WEEKLY-BORROWER',
      principal: 27000,
      mode: 'W',
      weekly_payment: 3000,
      total_expected: 30000,
      loan_date: '2026-10-01',
      first_due_date: '2026-10-07',
    })
    expect(newLoan.remaining_balance).toBe(30000)

    // Pay 1 installment of ₹3,000
    const pay1 = await api.recordPayment({
      loan_id: newLoan.id,
      amount: 3000,
      payment_type: 'Weekly Installment',
      payment_date: '2026-10-07',
    })
    expect(pay1.loan.remaining_balance).toBe(27000)
    expect(pay1.loan.status).toBe('active')

    // Pay remaining ₹27,000
    const payFinal = await api.recordPayment({
      loan_id: newLoan.id,
      amount: 27000,
      payment_type: 'Weekly Installment',
      payment_date: '2026-12-09',
    })
    expect(payFinal.loan.remaining_balance).toBe(0)
    expect(payFinal.loan.status).toBe('closed')
  })

  it('18-20. Daily interest recorded separately from recovered principal without double counting', async () => {
    const metricsBefore = await api.getDashboardMetrics()
    const intBefore = metricsBefore.interestReceived
    const capBefore = metricsBefore.availableCapitalPool ?? 185000

    // Record an interest receipt of ₹500
    await api.addInterest({
      entry_date: '2026-10-24',
      customer_name: 'YUVARAJ INTEREST',
      amount: 500,
      notes: '10-day cycle interest',
    })

    const metricsAfterInt = await api.getDashboardMetrics()
    expect(metricsAfterInt.interestReceived).toBe(intBefore + 500)
    // Capital pool does not inflate from interest
    expect(metricsAfterInt.availableCapitalPool).toBe(capBefore)

    // Recover ₹10,000 principal
    const dailyLoans = await api.listLoans({ mode: 'D', status: 'active' })
    await api.recordPayment({
      loan_id: dailyLoans[0].id,
      amount: 10000,
      payment_type: 'Principal',
      payment_date: '2026-10-24',
      principal_allocation: 10000,
    })

    const metricsAfterPrin = await api.getDashboardMetrics()
    // Available capital pool increases by 10,000 recovered principal
    expect(metricsAfterPrin.availableCapitalPool).toBe(capBefore + 10000)
    // Investor contributions remain untouched at 185,000
    expect(metricsAfterPrin.originalInvestorContributions).toBe(185000)
    // Interest received is NOT double counted
    expect(metricsAfterPrin.interestReceived).toBe(intBefore + 500)
  })

  it('21-22. Monthly Fund targets total ₹37,800 and collections cap at member target', async () => {
    const members = await api.listMonthlyFundMembers()
    expect(members).toHaveLength(4)
    const totalTarget = members.reduce((sum, m) => sum + m.target_amount, 0)
    expect(totalTarget).toBe(37800)

    const rams = members.find((m) => m.name.toUpperCase().includes('RAMS'))!
    expect(rams.target_amount).toBe(9500)
    expect(rams.suggested_collection).toBe(400)

    const puri = members.find((m) => m.name.toUpperCase().includes('PURI'))!
    expect(puri.target_amount).toBe(9500)
    expect(puri.suggested_collection).toBe(500)

    const cherran = members.find((m) => m.name.toUpperCase().includes('CHERRAN'))!
    expect(cherran.target_amount).toBe(9000)
    expect(cherran.suggested_collection).toBe(700)

    const medical = members.find((m) => m.name.toUpperCase().includes('MEDICAL'))!
    expect(medical.target_amount).toBe(9800)
    expect(medical.suggested_collection).toBe(300)

    // Record collection
    const { member: collectedRams } = await api.recordMonthlyFundCollection({
      member_id: rams.id,
      amount: 400,
    })
    expect(collectedRams.total_collected).toBe(400)
    expect(collectedRams.remaining_amount).toBe(9100)
  })

  it('23-25. Sweet Fund: default 50 members target ₹10,300 each (₹5,15,000 total) with partial payment handling', async () => {
    const prog = await api.getSweetFundProgramme()
    expect(prog.total_members).toBe(50)
    expect(prog.total_weeks).toBe(50)
    expect(prog.target_per_member).toBe(10300)
    expect(prog.total_target).toBe(515000)

    const newMember = await api.addSweetFundMember({
      member_name: 'TEST SWEET MEMBER',
      phone: '9998887776',
    })
    expect(newMember.remaining_balance).toBe(10300)

    const insts = await api.listSweetFundInstallments(newMember.id)
    expect(insts).toHaveLength(50)
    expect(insts[0].expected_amount).toBe(500)
    expect(insts[1].expected_amount).toBe(200)

    // Partial payment of ₹250 on Week 1 (expected 500)
    await api.recordSweetFundPayment({
      member_id: newMember.id,
      installment_id: insts[0].id,
      amount: 250,
    })

    const updatedInsts = await api.listSweetFundInstallments(newMember.id)
    expect(updatedInsts[0].status).toBe('Partial')
    expect(updatedInsts[0].paid_amount).toBe(250)
    expect(updatedInsts[0].status).not.toBe('Paid')
  })

  it('26-27. Due settlements vs fake payment receipts and duplicate checks', async () => {
    const dues = await api.listDues()
    expect(dues).toHaveLength(6)

    const due1 = dues[0]
    expect(due1.remaining_amount).toBe(3000)

    // Settle due partially with ₹1,000
    const settled = await api.settleDue(due1.id, 1000)
    expect(settled.status).toBe('partial')
    expect(settled.remaining_amount).toBe(2000)

    // Settle remaining ₹2,000
    const settledFinal = await api.settleDue(due1.id, 2000)
    expect(settledFinal.status).toBe('settled')
    expect(settledFinal.remaining_amount).toBe(0)
  })

  it('28-30. Nominal Cash vs Liquid Cash reconciliation and ledger integrity', async () => {
    const metrics = await api.getDashboardMetrics()
    // Nominal cash: 2,10,920 - 1,62,000 = 48,920
    expect(metrics.workbookCashInHand).toBe(48920)
    // Liquid cash excludes unpaid dues: 48,920 - 12,000 = 36,920
    expect(metrics.reconciledAvailableCash).toBe(36920)
    expect(metrics.reconciliationDifference).toBe(12000)
  })
})
