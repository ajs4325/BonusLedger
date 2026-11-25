const stages = {
  database: 'Opening local database',
  demo: 'Preparing demo workspace',
  ledger: 'Reading ledger records',
  render: 'Displaying BonusLedger',
}

const messages = {
  AbortError: 'The operation was interrupted. Try opening the workspace again.',
  BlockedError: 'Another BonusLedger tab is holding the database open. Close other BonusLedger tabs to continue.',
  DatabaseClosedError: 'The local database connection closed unexpectedly.',
  InvalidStateError: 'The browser could not use the local database in its current state.',
  MissingAPIError: 'This browser context does not provide the local database API.',
  NotReadableError: 'The browser could not read local storage.',
  OpenFailedError: 'The local database connection could not be opened.',
  PrematureCommitError: 'The database finished a transaction before BonusLedger could complete the operation.',
  QuotaExceededError: 'The browser reported that local storage is full.',
  ReadOnlyError: 'A read-only database operation attempted to write records.',
  SecurityError: 'The browser blocked the operation in this context.',
  TransactionInactiveError: 'The browser ended the database transaction before the operation finished.',
  TypeError: 'BonusLedger encountered an unexpected value or browser API error.',
  VersionError: 'The local database version is newer than this copy of BonusLedger supports.',
  UnknownError: 'The browser reported a failure without a specific reason.',
  Error: 'BonusLedger encountered an unexpected error.',
}

export type StartupStage = keyof typeof stages
export interface StartupProblem {
  stage: StartupStage
  name: keyof typeof messages
}

export function startupProblem(stage: StartupStage, cause: unknown): StartupProblem {
  const name = typeof cause === 'object' && cause !== null && 'name' in cause ? cause.name : undefined
  return {
    stage,
    // Error messages and stacks can include record data and are kept out of diagnostics.
    name: typeof name === 'string' && Object.prototype.hasOwnProperty.call(messages, name)
      ? name as StartupProblem['name'] : 'Error',
  }
}

export function describeStartupProblem(problem: StartupProblem) {
  return { stage: stages[problem.stage], message: messages[problem.name] }
}
