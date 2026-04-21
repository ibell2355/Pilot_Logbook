# Pilot Logbook

A mobile-first, local-first PWA for helicopter pilots to record flight hours.
No accounts, no servers, no cloud sync. Everything lives on the device in
IndexedDB, and the app works offline once loaded.

This is a proof of concept. The design is intentionally simple and practical:
a calm aviation-style light theme, dark mode, and a narrow mobile-style
layout that works equally well on desktop.

## Tech stack

- React + TypeScript + Vite
- `idb` for IndexedDB
- `jspdf` + `jspdf-autotable` for printable logs
- `vite-plugin-pwa` is wired in but currently configured in **self-destroying
  mode** (see "Service worker note" under Deploying)
- `react-router-dom` using hash routing (works under any base path)

## Scripts

```bash
npm install
npm run dev          # local dev server
npm run build        # type-check + production build into /dist
npm run preview      # preview the built app
npm run typecheck    # tsc --noEmit
```

## How local storage works

All working data is stored in a single IndexedDB database named
`pilot-logbook`, with object stores for:

- `profile` — pilot name, licence, employee number, home base, default company
- `presets` — reusable lists for companies, aircraft types, registrations,
  locations, and co-pilots
- `settings` — theme, current working log id
- `logs` — one record per log (open or closed)
- `legs` — one record per leg, indexed by log id

Edits are auto-saved while the pilot types (debounced ~400 ms). There is no
manual "save" button — pressing **Next Leg**, **Return Leg**, or
**Duplicate Leg** commits whatever is currently on screen and opens a new
leg prefilled per the rules below.

Because data lives in the browser, **clearing this browser's site data,
using a private window, or reinstalling the PWA can remove your logs.**
Export a backup before you clear data or switch devices. The Settings
screen shows a warning about this.

### Carry-forward rules for Next / Return / Duplicate Leg

- **Next Leg** — keeps `date, company, aircraft type, aircraft registration,
  co-pilot, pilot role, day/night, VFR/IFR`. Sets the new departure to the
  previous arrival. Clears arrival, times, total flight time, remarks, and
  instrument times.
- **Return Leg** — same carry-forward, plus sets the new arrival to the
  previous departure (quick round-trip).
- **Duplicate Leg** — exact copy; edit only what changed.

## What "Create Backup" does

Produces a small JSON file (`<log-title>-backup.json`) containing the pilot
profile, the log metadata, and every leg in that log. This file is for
restore inside the app — it is **not** the shareable report artifact.

From **Saved Logs → Import Backup…** you can re-import a backup on a new
device or after clearing browser data. If a log with the same id already
exists, the imported copy is saved under a new id so nothing is overwritten.

Backup format:

```json
{
  "format": "pilot-logbook-backup",
  "version": 1,
  "exportedAt": 1713600000000,
  "profile": { ... },
  "log": { ... },
  "legs": [ ... ]
}
```

## What "Export PDF" does

Generates a clean one-log-per-file PDF sized for letter paper (landscape):

- Pilot profile header (name, licence, employee number, home base, company,
  period covered)
- Aggregate totals (total flight time, actual and simulated instrument)
- Every leg rendered as a tabular log sheet
- A signature / date line

The PDF has no generated timestamp, no internal ids, and no developer-looking
jargon. The pilot can share or save it using their phone's normal share
sheet.

The PDF layout lives in `src/utils/pdf.ts` so it can later be replaced by a
company-specific template without touching the rest of the app.

## Project structure

```
src/
  App.tsx                    routes
  main.tsx                   entry + HashRouter
  types.ts                   data models
  db/database.ts             idb schema + CRUD helpers
  hooks/useTheme.ts          theme selection + persistence
  components/
    Layout.tsx               top bar + drawer menu
    LegForm.tsx              leg data entry
    Autocomplete.tsx         suggestions from preset lists
    Segmented.tsx            small segmented control
  pages/
    Home.tsx                 start / resume / saved logs / work hours (disabled)
    LogEditor.tsx            open log: leg list, form, action bar
    SavedLogs.tsx            list + import backup
    ProfilePage.tsx          pilot details + preset management
    SettingsPage.tsx         theme, storage status, backup notes
  utils/
    time.ts                  24h time math, duration, today helpers
    legFactory.ts            empty / next / return / duplicate leg builders
    pdf.ts                   jsPDF template (swappable per company)
    backup.ts                JSON backup export + import
    download.ts              blob download helper
    ids.ts                   id generation (date + random suffix)
```

## Deploying to GitHub Pages

The app ships with a single GitHub Actions workflow
(`.github/workflows/deploy.yml`) that runs `npm ci && npm run build` and
publishes `dist/` via the official `actions/deploy-pages` action on every
push to `main`.

### First-time setup

1. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Push to `main`. The workflow builds and deploys.
3. Visit `https://<your-user>.github.io/Pilot_Logbook/`.

If GitHub previously auto-added a second "Deploy static content to Pages"
workflow (`static.yml`), delete it — only `deploy.yml` should exist, or the
two will race and a raw-source deploy can overwrite the built site.

### Base path

`vite.config.ts` sets `base` to `/Pilot_Logbook/` to match the repo name.
If you fork under a different repo name or deploy at the root (custom
domain), override it at build time with `VITE_BASE=/your-repo/` or
`VITE_BASE=/`.

### Routing and refresh 404s

The app uses `HashRouter` (`src/main.tsx`), so all routes live under `#/…`
and every page is served by the same `index.html`. This sidesteps the
classic GitHub Pages SPA refresh-404 problem without a redirect shim. The
workflow also copies `index.html` to `404.html` as a harmless fallback.

### Service worker note

`vite-plugin-pwa` is set to `selfDestroying: true` in `vite.config.ts`.
That emits a `sw.js` whose only job is to unregister itself and delete
its caches on activation. This is here to rescue any browser that visited
an earlier broken Pages deploy and ended up with a stuck precache (which
will silently serve a blank app once the cached asset hashes no longer
exist). New visitors never register a service worker.

To re-enable a real PWA later, remove `selfDestroying: true` and restore
the `manifest`/`workbox` config — but only after you're confident no users
are still on a stale registration.

## Known limitations (proof of concept)

- Clearing browser / site data removes locally stored logs if no backup
  exists.
- There is no multi-device sync. Move a log between devices by exporting a
  backup and importing it on the other device.
- PDF is generated client-side; large logs produce larger PDFs.
- "Log Work Hours" on the home screen is intentionally disabled — it's a
  placeholder for future scope.
