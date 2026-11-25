import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { demoDb, personalDb, loadLedger, prepareDemo } from './db'
import { localDate } from './domain/dates'
import { startupProblem, type StartupProblem, type StartupStage } from './startup'

type Snapshot = Awaited<ReturnType<typeof loadLedger>>
type Result = { snapshot: Snapshot } | { problem: StartupProblem }

export function useWorkspace(isDemo: boolean) {
  const db = isDemo ? demoDb : personalDb
  const [attempt, setAttempt] = useState(0)
  const [response, setResponse] = useState<{ db: typeof db; attempt: number; result: Result }>()

  useEffect(() => {
    let active = true
    let subscription: { unsubscribe: () => void } | undefined
    let stage: StartupStage = 'database'
    const publish = (result: Result) => {
      if (active) setResponse({ db, attempt, result })
    }
    const fail = (cause: unknown) => publish({ problem: startupProblem(stage, cause) })
    const blocked = () => fail({ name: 'BlockedError' })

    async function openWorkspace() {
      try {
        await db.open()
        if (!active) return
        if (isDemo) {
          stage = 'demo'
          await prepareDemo(db, localDate())
        }
        if (!active) return
        stage = 'ledger'
        // Dexie live queries must stay read-only. Initialization can write.
        subscription = liveQuery(() => loadLedger(db)).subscribe({
          next: snapshot => publish({ snapshot }),
          error: fail,
        })
      } catch (cause) {
        fail(cause)
      }
    }

    db.on.blocked.subscribe(blocked)
    void openWorkspace()
    return () => {
      active = false
      db.on.blocked.unsubscribe(blocked)
      subscription?.unsubscribe()
    }
  }, [attempt, db, isDemo])

  const result = response?.db === db && response.attempt === attempt ? response.result : undefined
  return {
    db,
    snapshot: result && 'snapshot' in result ? result.snapshot : undefined,
    problem: result && 'problem' in result ? result.problem : undefined,
    retry: () => setAttempt(value => value + 1),
  }
}
