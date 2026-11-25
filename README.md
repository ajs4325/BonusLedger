# BonusLedger v0.1.0

BonusLedger is a local-first progressive web app for tracking personal bank account promotions, qualification activity, payouts, and deadlines. It uses USD and stores money as integer cents.

## Getting started

Use Node.js 22.13+ on the Node 22 release line, or Node 24 LTS. From the project root:

```sh
npm ci
npm run dev
```

Open the Vite URL under `/BonusLedger/`. On the first visit you’ll see a demo workspace with fictional sample terms. Choose **Use my ledger** to start with a blank personal workspace. Settings lets you switch back at any time. The two workspaces have separate IndexedDB databases and separate backups.

## Tracking promotions

- Create a promotion and record its offer, fees, qualification deadline, payout window, and closure restrictions. Update lifecycle status as the bank confirms each milestone.
- Mark a ledger entry **Qualifying** when it satisfies the offer’s terms. Direct-deposit rules sum qualifying direct deposits. Deposit-count rules count direct deposits and other deposits that meet the per-entry minimum. Debit rules count qualifying purchases that meet their minimum.
- Each ledger entry counts once in any given rule, and only for its linked promotion. The same deposit can satisfy both a dollar threshold and a deposit-count rule. Review entry dates and notes before entering the same real-world transaction twice.
- A minimum-balance rule uses the latest qualifying snapshot in the allowed window. If several snapshots share a date, it uses the lowest value from that date. A holding-period rule counts elapsed calendar days from a start date you confirm. Review the bank’s terms when balances must stay above a threshold throughout a holding period.
- Each rule may have its own deadline. Activity is evaluated through the earlier of that deadline and the promotion’s qualification deadline, including both the opening date and cutoff date. Checklist tasks use their recorded completion date.
- Potential bonuses include unpaid considering, active, qualified, and awaiting-payout offers. Bonuses received reflect the amounts you record, including payouts on offers you later close. Fees stay visible on the offer and totals show gross bonuses.
- Export upcoming or individual calendar events as ICS files. They are all-day events with a one-day reminder. The receiving calendar controls whether it honors the alarm. Re-export after changing dates.

## Architecture and verification

- `src/domain/` contains typed schemas, local date arithmetic, amount parsing, requirement calculations, dashboard totals, and ICS generation.
- `src/db.ts` owns Dexie schemas and migrations, transactionally deletes linked ledger entries, and restores backups atomically. The IndexedDB schema version is independent of the versioned JSON backup format.
- `src/components/` contains the React views and editors. Hash navigation lets GitHub Pages serve a single entry point while preserving links and browser history.
- Vite PWA generates an installable manifest and a Workbox service worker scoped to `/BonusLedger/`. The worker precaches the shell, bundled code, styles, and install assets. Installed updates are offered in the app so an open session can choose when to reload.

```sh
npm run lint
npm test
npm run build
npm run test:offline
npm run preview
```

The offline test executes the production service worker and Workbox bundle with simulated browser cache, lifecycle, and network APIs. It installs the worker and verifies navigation, JavaScript, CSS, manifest, and icon responses after the test network is disabled.

For a device check, open the production preview at `/BonusLedger/` in a service-worker-capable browser on localhost or HTTPS. Wait for the worker to activate, reload to ensure it controls the page, then go offline and reload again. Switch views, create a record, and reload to check that it persists. On iPhone, open the deployed HTTPS site in Safari and use **Share → Add to Home Screen**. Open the installed app online once so the app shell can cache.

## Deploy to GitHub Pages

1. Create or use a GitHub repository named **BonusLedger** and push the project to its `main` branch.
2. In the repository, open **Settings → Pages** and select **GitHub Actions** as the source.
3. Run **Deploy BonusLedger** from the Actions tab or push to `main` again. The workflow lints, tests, builds, verifies offline assets, and deploys `dist/`.
4. Open `https://<owner>.github.io/BonusLedger/`. For a different deployment path, update the Vite base, PWA scope and start URL, Workbox allowlist, and offline test URLs together.

## Backups and privacy

BonusLedger stores promotions and ledger entries in the current browser profile and origin. It has no backend, account sign-in, analytics, banking connection, or synchronization. The static host receives ordinary app asset requests. Opening an offer link or importing an exported reminder into another service shares data with the destination you choose.

IndexedDB and exports are readable by anyone with access to the browser profile or exported files. Other scripts served on the same origin may be able to access local storage. Keep bank credentials and account numbers out of all fields, including notes and offer URLs. A private window, a cleared site, storage eviction, or changing the site origin can make records unavailable.

In **Settings → Backup and restore**, export a JSON copy regularly. An import validates the file, previews record counts, and requires confirmation before replacing the selected workspace. Imports accept version 1 BonusLedger JSON files up to 25 MiB. Keep backups somewhere private and separate from the browser.
