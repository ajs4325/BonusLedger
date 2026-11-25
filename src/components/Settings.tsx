import { useRef, useState } from 'react'
import { ArrowDownToLine, Check, FlaskConical, Monitor, Moon, ShieldCheck, Sun, Upload } from 'lucide-react'
import { backupSchema, issueText, themes, type Backup, type Theme } from '../domain/model'
import { Confirm } from './ui'

export function Settings({ theme, isDemo, changeTheme, switchMode, exportData, importData }: {
  theme: Theme; isDemo: boolean; changeTheme: (theme: Theme) => void; switchMode: () => void;
  exportData: () => Promise<void>; importData: (backup: Backup) => Promise<void>
}) {
  const [backup, setBackup] = useState<Backup>()
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function readFile(file: File) {
    setReading(true)
    setError('')
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('Choose a backup smaller than 25 MB.')
      let content: unknown
      try { content = JSON.parse(await file.text()) }
      catch { throw new Error('This file is not valid JSON.') }
      const result = backupSchema.safeParse(content)
      if (!result.success) throw new Error(issueText(result.error))
      setBackup(result.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read this backup.')
    } finally {
      setReading(false)
    }
  }

  return <>
    <section className="page-heading"><div><h1>Settings</h1><p>Choose your appearance and manage local data.</p></div></section>
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-heading"><h2>Appearance</h2></div>
        <div className="panel-body"><div className="theme-options" role="group" aria-label="Theme">
          {themes.map(option => {
            const Icon = option === 'system' ? Monitor : option === 'light' ? Sun : Moon
            return <button key={option} type="button" aria-pressed={theme === option} onClick={() => changeTheme(option)}>
              <Icon size={19} /><span>{option}</span>{theme === option && <Check size={15} />}
            </button>
          })}
        </div></div>
      </section>
      <section className="panel">
        <div className="panel-heading"><h2><FlaskConical size={19} /> Demo workspace</h2></div>
        <div className="panel-body settings-body">
          <p>The demo has sample promotions and ledger entries. Changes stay in the demo workspace.</p>
          <button type="button" className="button secondary" onClick={switchMode}>{isDemo ? 'Use my ledger' : 'Open demo workspace'}</button>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>Backup and restore</h2></div>
        <div className="panel-body settings-body">
          <p>Save a JSON copy of this workspace, or replace its records with a validated backup.</p>
          <div className="button-row">
            <button type="button" className="button secondary" onClick={() => { void exportData() }}><ArrowDownToLine size={18} /> Export JSON</button>
            <button type="button" className="button secondary" disabled={reading} onClick={() => input.current?.click()}><Upload size={17} /> Import JSON</button>
          </div>
          <input type="file" accept=".json,application/json" ref={input} hidden onChange={event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void readFile(file)
          }} />
          {error && <p role="alert" className="form-error">{error}</p>}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading"><h2><ShieldCheck size={19} /> Privacy and installation</h2></div>
        <div className="panel-body settings-body">
          <p>Your records stay in this browser’s storage. BonusLedger has no sign-in, analytics, or bank connection. Keep credentials and account numbers out of notes and links.</p>
          <p>Clearing site data can erase your records. Backup files and calendar exports are readable by anyone you share them with.</p>
          <p>On iPhone, open BonusLedger in Safari and choose <strong>Share → Add to Home Screen</strong>. Open it online once before using it offline.</p>
          <small>BonusLedger v0.1.0</small>
        </div>
      </section>
    </div>
    {backup && <Confirm title="Replace workspace data?" onClose={() => setBackup(undefined)} confirmLabel="Replace data"
      onConfirm={() => importData(backup)}>
      <p>This replaces all promotions, ledger entries, and the theme in the {isDemo ? 'demo' : 'personal'} workspace.</p>
      <p>The backup contains <strong>{backup.promotions.length} promotions</strong> and <strong>{backup.transactions.length} ledger entries</strong>.</p>
    </Confirm>}
  </>
}
