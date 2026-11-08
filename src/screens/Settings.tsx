import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getState, replaceState, setState, useStore } from '../lib/store'
import { onSyncStatus, supabase, syncNow, syncStatus } from '../lib/sync'
import { ProfileForm } from './Onboarding'
import { Card, Seg } from '../components/ui'

export default function Settings({ session }: { session: Session | null }) {
  const profile = useStore((s) => s.profile)
  const [saved, setSaved] = useState(false)
  if (!profile) return null

  const exportData = () => {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `wrkt-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }
  const importData = (f: File) => {
    f.text().then((t) => {
      try {
        if (confirm('Replace all data on this device with this backup?')) replaceState(JSON.parse(t))
      } catch {
        alert('Not a valid backup file.')
      }
    })
  }

  return (
    <div className="screen">
      <h1>Settings</h1>
      <Account session={session} />
      <Card>
        <h2>Rest between sets</h2>
        <Seg
          options={[{ value: 0.75, label: 'Short' }, { value: 1, label: 'Normal' }, { value: 1.5, label: 'Long' }]}
          value={profile.restScale}
          onChange={(v) => setState((s) => ({ ...s, profile: { ...s.profile!, restScale: v } }))}
        />
      </Card>
      <Card>
        <h2>USDA food search key</h2>
        <p className="muted small">
          Optional. Search works without it but is rate-limited. Get a free key at{' '}
          <a href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" rel="noreferrer">fdc.nal.usda.gov</a>.
        </p>
        <input value={profile.usdaKey} placeholder="API key" onChange={(e) => setState((s) => ({ ...s, profile: { ...s.profile!, usdaKey: e.target.value.trim() } }))} />
      </Card>
      <h2>Profile & targets</h2>
      <ProfileForm
        initial={profile}
        cta={saved ? 'Saved ✓' : 'Save profile'}
        onSave={(p) => {
          setState((s) => ({ ...s, profile: { ...p, usdaKey: s.profile!.usdaKey, restScale: s.profile!.restScale } }))
          setSaved(true)
          setTimeout(() => setSaved(false), 1500)
        }}
      />
      <Card>
        <h2>Backup</h2>
        <div className="row">
          <button onClick={exportData}>Export</button>
          <label className="button">
            Import
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </label>
        </div>
      </Card>
    </div>
  )
}

export function Account({ session }: { session: Session | null }) {
  const [, force] = useState(0)
  useEffect(() => onSyncStatus(() => force((n) => n + 1)), [])
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const st = syncStatus()

  if (session) {
    return (
      <Card>
        <h2>Sync</h2>
        <div className="muted small">Signed in as {session.user.email}</div>
        <div className={st.status === 'error' ? 'warn' : 'muted small'}>
          {st.status === 'ok' ? '✓ Synced' : st.status === 'syncing' ? 'Syncing…' : st.status === 'error' ? `Sync error: ${st.lastError}` : ''}
        </div>
        <div className="row">
          <button onClick={() => void syncNow()}>Sync now</button>
          <button className="ghost" onClick={() => void supabase.auth.signOut()}>Sign out</button>
        </div>
      </Card>
    )
  }

  const go = async (signup: boolean) => {
    setMsg('')
    const res = signup
      ? await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin + location.pathname } })
      : await supabase.auth.signInWithPassword({ email, password: pw })
    if (res.error) setMsg(res.error.message)
    else if (signup && !res.data.session) setMsg('Check your email to confirm, then sign in here.')
  }

  return (
    <Card className="highlight">
      <h2>Sync phone + laptop</h2>
      <p className="muted small">Sign in on each device. Your data merges automatically.</p>
      <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" autoComplete="current-password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <div className="row">
        <button className="primary" onClick={() => void go(false)}>Sign in</button>
        <button onClick={() => void go(true)}>Create account</button>
      </div>
      {msg && <div className="muted small">{msg}</div>}
    </Card>
  )
}
