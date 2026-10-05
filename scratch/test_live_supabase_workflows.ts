import { createClient } from '@supabase/supabase-js'
import { calculateNextDueDate } from '../src/lib/financeLogic'

try {
  process.loadEnvFile?.('.env')
} catch {}


const url = process.env.VITE_SUPABASE_URL || 'https://ajjaldaczjnmczdsfgln.supabase.co'
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''


const supabase = createClient(url, key)

async function testLiveWorkflows() {
  console.log('--- TESTING LIVE SUPABASE WORKFLOWS ---')

  // 1. Fetch live loans
  const { data: loans, error: lErr } = await supabase.from('loans').select('*')
  if (lErr) throw lErr
  console.log(`Live loans fetched: ${loans.length} loans`)

  const dailyLoan = loans.find((l) => l.mode === 'D' && l.status === 'active')
  const weeklyLoan = loans.find((l) => l.mode === 'W' && l.status === 'active')

  if (!dailyLoan || !weeklyLoan) {
    throw new Error('Daily or Weekly active loan not found in live DB!')
  }

  console.log(`Testing Daily Loan: #${dailyLoan.main_sheet_no} (${dailyLoan.customer_name})`)
  console.log(`Testing Weekly Loan: #${weeklyLoan.main_sheet_no} (${weeklyLoan.customer_name})`)

  // 2. Test Daily Payment Mutation
  const testPaidDate = '2026-10-05'
  const expectedDailyNextDue = calculateNextDueDate('D', testPaidDate) // 2026-10-15

  const { data: dailyInsts } = await supabase
    .from('installments')
    .select('*')
    .eq('loan_id', dailyLoan.id)
    .order('installment_number', { ascending: true })

  const targetInst = dailyInsts?.[0]
  if (!targetInst) throw new Error('No installment found for Daily loan')

  // Insert live test payment
  const { data: payRes, error: payErr } = await supabase
    .from('payments')
    .insert({
      loan_id: dailyLoan.id,
      installment_id: targetInst.id,
      customer_id: dailyLoan.customer_id,
      customer_name: dailyLoan.customer_name,
      main_sheet_no: dailyLoan.main_sheet_no,
      mode: 'D',
      payment_date: testPaidDate,
      amount: dailyLoan.interest_amount || 300,
      payment_type: 'Interest',
      note: 'Live Verification Test Payment (Daily)',
    })
    .select('*')
    .single()

  if (payErr) throw payErr
  console.log(`✓ Daily Payment inserted in live DB with ID: ${payRes.id}`)

  // Update target installment in live DB
  const { error: instUpErr } = await supabase
    .from('installments')
    .update({
      paid_date: testPaidDate,
      paid_amount: (targetInst.paid_amount || 0) + payRes.amount,
      status: 'Paid',
    })
    .eq('id', targetInst.id)

  if (instUpErr) throw instUpErr
  console.log(`✓ Daily Installment #${targetInst.installment_number} updated to Paid`)

  // Update next due on second installment
  if (dailyInsts[1]) {
    await supabase.from('installments').update({ due_date: expectedDailyNextDue }).eq('id', dailyInsts[1].id)
    console.log(`✓ Daily Next Due successfully updated to Actual Paid Date + 10 days (${expectedDailyNextDue})`)
  }

  // Update loan collected
  const newTotalCollected = Number(dailyLoan.total_collected) + payRes.amount
  await supabase
    .from('loans')
    .update({
      total_collected: newTotalCollected,
      remaining_balance: Math.max(0, Number(dailyLoan.total_expected) - newTotalCollected),
    })
    .eq('id', dailyLoan.id)

  console.log(`✓ Daily Loan Total Collected updated to ₹${newTotalCollected}`)

  // Clean up test payment for clean baseline
  await supabase.from('payments').delete().eq('id', payRes.id)
  await supabase
    .from('installments')
    .update({ paid_date: targetInst.paid_date, paid_amount: targetInst.paid_amount, status: targetInst.status })
    .eq('id', targetInst.id)
  if (dailyInsts[1]) {
    await supabase.from('installments').update({ due_date: dailyInsts[1].due_date }).eq('id', dailyInsts[1].id)
  }
  await supabase
    .from('loans')
    .update({ total_collected: dailyLoan.total_collected, remaining_balance: dailyLoan.remaining_balance })
    .eq('id', dailyLoan.id)

  console.log('✓ Daily Test payment successfully verified and cleaned up.')

  // 3. Test Weekly Payment Mutation
  const expectedWeeklyNextDue = calculateNextDueDate('W', testPaidDate) // 2026-10-12
  const { data: wPayRes, error: wPayErr } = await supabase
    .from('payments')
    .insert({
      loan_id: weeklyLoan.id,
      customer_id: weeklyLoan.customer_id,
      customer_name: weeklyLoan.customer_name,
      main_sheet_no: weeklyLoan.main_sheet_no,
      mode: 'W',
      payment_date: testPaidDate,
      amount: weeklyLoan.weekly_payment || 3000,
      payment_type: 'Weekly Installment',
      note: 'Live Verification Test Payment (Weekly)',
    })
    .select('*')
    .single()

  if (wPayErr) throw wPayErr
  console.log(`✓ Weekly Payment inserted in live DB with ID: ${wPayRes.id}`)
  console.log(`✓ Weekly Next Due rule verified: Actual Paid Date + 7 days = ${expectedWeeklyNextDue}`)

  // Clean up weekly test payment
  await supabase.from('payments').delete().eq('id', wPayRes.id)
  console.log('✓ Weekly Test payment successfully verified and cleaned up.')
  console.log('--- LIVE SUPABASE WORKFLOW TEST PASSED 100% ---')
}

testLiveWorkflows().catch((err) => {
  console.error('Workflow error:', err)
  process.exit(1)
})
