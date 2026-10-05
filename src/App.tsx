import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthPanel } from './components/AuthPanel'
import { AppLayout } from './components/AppLayout'
import { TenPercentPage } from './components/TenPercentPage'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(isSupabaseConfigured)

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
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout onSignOut={session ? () => void supabase!.auth.signOut() : undefined} />}>
          <Route index element={<Navigate to="/profit/ten-percent" replace />} />
          <Route path="/profit/ten-percent" element={<TenPercentPage />} />
          <Route path="*" element={<Navigate to="/profit/ten-percent" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
