import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AuthPanel } from './components/AuthPanel'
import { DashboardPage } from './components/DashboardPage'
import { DailyPage } from './components/DailyPage'
import { WeeklyPage } from './components/WeeklyPage'
import { RemindersPage } from './components/RemindersPage'
import { PaymentsPage } from './components/PaymentsPage'
import { ActiveAccountsPage } from './components/ActiveAccountsPage'
import { ClosedAccountsPage } from './components/ClosedAccountsPage'
import { BorrowerDetailPage } from './components/BorrowerDetailPage'
import { TenPercentPage } from './components/TenPercentPage'
import { NewLoanModal } from './components/NewLoanModal'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(isSupabaseConfigured)
  const [showNewLoanModal, setShowNewLoanModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCheckingSession(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setCheckingSession(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (checkingSession) return <div className="loading-screen">Loading finance tracker…</div>
  if (isSupabaseConfigured && !session) return <AuthPanel />

  const triggerRefresh = () => setRefreshKey((k) => k + 1)

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <AppLayout
              onSignOut={session ? () => void supabase!.auth.signOut() : undefined}
              onOpenNewLoan={() => setShowNewLoanModal(true)}
            />
          }
        >
          <Route index element={<DashboardPage key={`dash-${refreshKey}`} onOpenNewLoan={() => setShowNewLoanModal(true)} />} />
          <Route path="/daily" element={<DailyPage key={`daily-${refreshKey}`} onOpenNewLoan={() => setShowNewLoanModal(true)} />} />
          <Route path="/weekly" element={<WeeklyPage key={`weekly-${refreshKey}`} onOpenNewLoan={() => setShowNewLoanModal(true)} />} />
          <Route path="/reminders" element={<RemindersPage key={`rem-${refreshKey}`} />} />
          <Route path="/payments" element={<PaymentsPage key={`pay-${refreshKey}`} />} />
          <Route path="/active-accounts" element={<ActiveAccountsPage key={`act-${refreshKey}`} onOpenNewLoan={() => setShowNewLoanModal(true)} />} />
          <Route path="/closed-accounts" element={<ClosedAccountsPage key={`closed-${refreshKey}`} />} />
          <Route path="/borrower/:id" element={<BorrowerDetailPage key={`bdet-${refreshKey}`} />} />
          <Route path="/profit/ten-percent" element={<TenPercentPage key={`ten-${refreshKey}`} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      {showNewLoanModal && (
        <NewLoanModal
          isOpen={showNewLoanModal}
          onClose={() => setShowNewLoanModal(false)}
          onSuccess={triggerRefresh}
        />
      )}
    </BrowserRouter>
  )
}

export default App
