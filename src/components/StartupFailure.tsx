import { describeStartupProblem, type StartupProblem } from '../startup'

export function StartupFailure({ problem, isDemo, retry, switchWorkspace }: {
  problem: StartupProblem
  isDemo?: boolean
  retry: () => void
  switchWorkspace?: () => void
}) {
  const details = describeStartupProblem(problem)
  return <section className="panel startup-panel" aria-labelledby="startup-heading">
    <div className="panel-body">
      <h1 id="startup-heading">{isDemo === undefined ? 'Couldn’t open BonusLedger'
        : isDemo ? 'Couldn’t open the demo workspace' : 'Couldn’t open your ledger'}</h1>
      <p role="alert">{details.message}</p>
      <details>
        <summary>Technical details</summary>
        <dl className="data-list">
          <div><dt>Startup step</dt><dd>{details.stage}</dd></div>
          <div><dt>Error type</dt><dd>{problem.name}</dd></div>
          {isDemo !== undefined && <div><dt>Workspace</dt><dd>{isDemo ? 'Demo' : 'Personal'}</dd></div>}
        </dl>
      </details>
      <div className="button-row">
        <button type="button" className="button primary" onClick={retry}>{switchWorkspace ? 'Try again' : 'Reload'}</button>
        {switchWorkspace && <button type="button" className="button secondary" onClick={switchWorkspace}>
          {isDemo ? 'Use my ledger' : 'Open demo workspace'}
        </button>}
      </div>
    </div>
  </section>
}
