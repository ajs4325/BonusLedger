import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ChevronRight, FlaskConical, LayoutDashboard, LockKeyhole, ReceiptText, Settings as SettingsIcon, Tags, Trash2 } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Dashboard } from './components/Dashboard'
import { Promotions, PromotionDetail } from './components/Promotions'
import { Ledger } from './components/Ledger'
import { Calendar } from './components/Calendar'
import { Settings } from './components/Settings'
import { PromotionForm, TransactionForm } from './components/forms'
import { Confirm, Notice } from './components/ui'
import { demoDb, personalDb, prepareDemo, loadLedger, exportBackup, restoreBackup, savePromotion, saveTransaction, deletePromotion } from './db'
import { deadlines as deriveDeadlines } from './domain/dashboard'
import { formatDate, localDate } from './domain/dates'
import { type Promotion, type Transaction } from './domain/model'
import { downloadFile } from './download'

const tabs = [
  { id: 'dashboard', name: 'Dashboard', Icon: LayoutDashboard },
  { id: 'promotions', name: 'Promotions', Icon: Tags },
  { id: 'ledger', name: 'Ledger', Icon: ReceiptText },
  { id: 'calendar', name: 'Calendar', Icon: CalendarDays },
  { id: 'settings', name: 'Settings', Icon: SettingsIcon },
] as const
type Tab = typeof tabs[number]['id']
type Route = { tab: Tab; promotionId?: string }
type Editor = { type: 'promotion'; item?: Promotion } | { type: 'transaction'; item?: Transaction; promotionId?: string }
type Removal = { type: 'promotion'; item: Promotion } | { type: 'transaction'; item: Transaction }

function readRoute(): Route {
  const [name, promotionId] = location.hash.replace(/^#\/?/, '').split('/')
  const tab = tabs.find(item => item.id === name)?.id ?? 'dashboard'
  return { tab, promotionId: tab === 'promotions' ? promotionId : undefined }
}

function navigate(tab: Tab, promotionId?: string) {
  location.hash = promotionId ? `/${tab}/${promotionId}` : `/${tab}`
}

function readWorkspace() {
  try { return localStorage.getItem('bonusledger-workspace') !== 'personal' }
  catch { return true }
}

function Brand() {
  return <a href="#/dashboard" className="brand" aria-label="BonusLedger dashboard">
    <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
    <span>Bonus<span className="brand-accent">Ledger</span></span>
  </a>
}

function App() {
  const [route, setRoute] = useState(readRoute)
  const [isDemo, setIsDemo] = useState(readWorkspace)
  const [today, setToday] = useState(localDate)
  const [editor, setEditor] = useState<Editor>()
  const [removal, setRemoval] = useState<Removal>()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  const db = isDemo ? demoDb : personalDb
  const snapshot = useLiveQuery(async () => {
    if (isDemo) await prepareDemo(db, localDate())
    return { db, ...await loadLedger(db) }
  }, [db, isDemo])
  const current = snapshot?.db === db ? snapshot : undefined
  const upcoming = useMemo(() => current ? deriveDeadlines(current.promotions, current.transactions, today) : [], [current, today])

  useEffect(() => {
    const updateRoute = () => {
      setRoute(readRoute())
      setEditor(undefined)
      setRemoval(undefined)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', updateRoute)
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])

  useEffect(() => {
    const refresh = () => setToday(localDate())
    const timer = window.setInterval(refresh, 30_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = current?.theme ?? 'system'
  }, [current?.theme])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  function switchWorkspace() {
    const next = !isDemo
    setIsDemo(next)
    setEditor(undefined)
    setRemoval(undefined)
    setError('')
    setNotice(next ? 'Demo workspace opened' : 'Personal ledger opened')
    try { localStorage.setItem('bonusledger-workspace', next ? 'demo' : 'personal') }
    catch { setError('The workspace preference could not be saved.') }
  }

  async function perform(action: () => Promise<void>) {
    setError('')
    try { await action() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not complete this action.') }
  }

  const open = (id: string) => navigate('promotions', id)
  const addPromotion = () => setEditor({ type: 'promotion' })
  const editEntry = (item: Transaction) => setEditor({ type: 'transaction', item })
  const promotion = current?.promotions.find(item => item.id === route.promotionId)

  return <div className="shell">
    <a href="#main-content" className="skip-link" onClick={event => {
      event.preventDefault()
      document.getElementById('main-content')?.focus()
    }}>Skip to content</a>
    <aside className="sidebar">
      <Brand />
      <nav className="navigation" aria-label="Main">
        {tabs.map(({ id, name, Icon }) => <a href={`#/${id}`} key={id} aria-current={route.tab === id ? 'page' : undefined}>
          <Icon size={21} strokeWidth={1.9} /><span>{name}</span>
        </a>)}
      </nav>
      <div className="sidebar-footer"><span className="privacy-icon"><LockKeyhole size={17} /></span>
        <span><strong>Private by design</strong><small>Data stays on this device</small></span></div>
    </aside>

    <div className="workspace">
      <header className="topbar"><div className="topbar-content">
        <div className="mobile-brand"><Brand /></div>
        <div className="breadcrumb"><span>Workspace</span><ChevronRight size={15} /><strong>{tabs.find(tab => tab.id === route.tab)?.name}</strong></div>
        <div className="topbar-tools">
          {isDemo && <div className="demo-control"><span><FlaskConical size={15} /> Demo workspace</span>
            <button className="text-button" type="button" onClick={switchWorkspace}>Use my ledger</button></div>}
          <span className="today-date"><CalendarDays size={17} /> {formatDate(today, true)}</span>
        </div>
      </div></header>
      <main id="main-content" className="main" tabIndex={-1}>
        {needRefresh && <div className="update-banner" role="status">A BonusLedger update is ready.
          <button type="button" className="text-button" onClick={() => { void updateServiceWorker(true) }}>Reload to update</button></div>}
        {error && <p className="form-error global-error" role="alert">{error}</p>}
        {!current && <p role="status" className="loading">Opening workspace…</p>}
        {current && route.tab === 'dashboard' && <Dashboard {...current} deadlines={upcoming} today={today}
          open={open} add={addPromotion} showPromotions={() => navigate('promotions')}
          showCalendar={() => navigate('calendar')} isDemo={isDemo} tryDemo={switchWorkspace} />}
        {current && route.tab === 'promotions' && (promotion
          ? <PromotionDetail item={promotion} transactions={current.transactions} today={today} back={() => navigate('promotions')}
            edit={() => setEditor({ type: 'promotion', item: promotion })} remove={() => setRemoval({ type: 'promotion', item: promotion })}
            addEntry={() => setEditor({ type: 'transaction', promotionId: promotion.id })} editEntry={editEntry}
            completeChecklist={ruleId => { void perform(async () => {
              await db.transaction('rw', db.promotions, async () => {
                const latest = await db.promotions.get(promotion.id)
                if (!latest) throw new Error('This promotion no longer exists.')
                const requirements = latest.requirements.map(rule => rule.id === ruleId && rule.type === 'checklist' && !rule.completedDate
                  ? { ...rule, completedDate: localDate() } : rule)
                await savePromotion(db, { ...latest, requirements }, true)
              })
              setNotice('Completion recorded')
            }) }} />
          : <Promotions {...current} today={today} open={open} add={addPromotion} />)}
        {current && route.tab === 'ledger' && <Ledger {...current} add={() => setEditor({ type: 'transaction' })} edit={editEntry} addPromotion={addPromotion} />}
        {current && route.tab === 'calendar' && <Calendar items={upcoming} today={today} open={open} />}
        {current && route.tab === 'settings' && <Settings theme={current.theme} isDemo={isDemo} switchMode={switchWorkspace}
          changeTheme={theme => { void perform(async () => { await db.settings.put({ key: 'theme', value: theme }) }) }}
          exportData={() => perform(async () => {
            const backup = await exportBackup(db)
            downloadFile(`bonusledger-${isDemo ? 'demo-' : ''}${today}.json`, JSON.stringify(backup, null, 2), 'application/json')
            setNotice('Backup downloaded')
          })}
          importData={async backup => { await restoreBackup(db, backup); setNotice('Backup restored') }} />}
      </main>
    </div>
    {notice && <Notice>{notice}</Notice>}
    {current && editor?.type === 'promotion' && <PromotionForm item={editor.item} onClose={() => setEditor(undefined)}
      onSave={async item => {
        await savePromotion(db, item, Boolean(editor.item))
        setEditor(undefined)
        setNotice(editor.item ? 'Promotion updated' : 'Promotion added')
        open(item.id)
      }} />}
    {current && editor?.type === 'transaction' && <TransactionForm item={editor.item} promotionId={editor.promotionId}
      promotions={current.promotions} today={today} onClose={() => setEditor(undefined)}
      onDelete={editor.item ? () => { if (editor.item) setRemoval({ type: 'transaction', item: editor.item }); setEditor(undefined) } : undefined}
      onSave={async item => {
        await saveTransaction(db, item, Boolean(editor.item))
        setEditor(undefined)
        setNotice(editor.item ? 'Ledger entry updated' : 'Ledger entry added')
      }} />}
    {removal && <Confirm title={removal.type === 'promotion' ? 'Delete promotion?' : 'Delete ledger entry?'}
      confirmLabel="Delete" onClose={() => setRemoval(undefined)} onConfirm={async () => {
        if (removal.type === 'promotion') {
          await deletePromotion(db, removal.item.id)
          navigate('promotions')
          setNotice('Promotion deleted')
        } else {
          await db.transactions.delete(removal.item.id)
          setNotice('Ledger entry deleted')
        }
      }}>
      <p><Trash2 size={16} /> {removal.type === 'promotion'
        ? `This permanently removes ${removal.item.bank} and its linked ledger entries from this workspace.`
        : 'This permanently removes the entry and recalculates requirement progress.'}</p>
    </Confirm>}
  </div>
}

export class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  render() {
    return this.state.failed
      ? <main className="main storage-error"><h1>Couldn’t open BonusLedger</h1>
        <p>Check that this browser allows local site storage, then reload the app.</p>
        <button className="button primary" type="button" onClick={() => location.reload()}>Reload</button></main>
      : this.props.children
  }
}

export default App
