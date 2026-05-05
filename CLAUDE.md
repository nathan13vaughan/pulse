# Pulse — Project Context for Claude Code

Personal web app for tracking blood pressure and connecting it to weekly meal planning. Single user (the app owner), local-only, no backend, no auth, no sharing. **Australian-focused** — assumes `en_AU` locale, AUSNUT nutrient data, kJ-leading energy display, and (eventually) Australian Heart Foundation BP bands.

## Why a web app

Originally built as a SwiftUI iOS app, but the owner is on Windows with no Mac. Rebuilt as a **client-side PWA** that runs in any modern browser, installs to iPhone home screen via Safari, and stores everything in IndexedDB on the device. No server, no compile step that requires Apple tooling.

## Project goal

Close the feedback loop between diet and blood pressure: log BP readings, plan meals from a personal recipe library, get an auto-generated grocery list, and over time see whether eating patterns correlate with BP trends.

## Hard constraints (do not relax without asking)

- **Pure client-side** — no backend, no server, no auth, no proprietary APIs.
- **Two narrow API exceptions**:
  1. A **single-product lookup against Open Food Facts** (`https://world.openfoodfacts.org/api/v2/product/{barcode}.json`) when the user scans a barcode that isn't in their local library. Result cached into IndexedDB. No bulk fetches, no other endpoints, no auth.
  2. **Optional Groq API call** (`https://api.groq.com/openai/v1/chat/completions`) for AI nutrition feedback — **only when the user has pasted their own Groq API key into Settings**. Bearer token lives only in IndexedDB on the user's device, never in source, env vars, CI, or the deployed bundle. Manual-trigger only (no auto on page load). Single-user / personal-use assumption. Excluded from JSON exports so a shared backup can't leak the key.
- **Local-only data** — IndexedDB on the user's device. JSON export/import for manual backup.
- **Single user** — no accounts, no auth, no profiles, no sharing.
- **Free data sources only** — **AUSNUT 2011–13** (Food Standards Australia New Zealand) for whole-food nutrients, **Open Food Facts** (Coles/Woolworths-tagged subset) for branded products. Bundled as static JSON; OFF additionally queryable per-barcode at runtime per the exception above.
- **No third-party analytics, crash reporting, or telemetry.**
- **Hosted as static files** — designed to deploy to GitHub Pages. No build environment beyond `npm run build`.

## Tech stack (locked)

- **React 18 + TypeScript** — UI
- **Vite** — build tool, dev server
- **React Router (HashRouter)** — works on GitHub Pages without server config
- **Dexie** — IndexedDB wrapper for persistence
- **Recharts** — charts (BP trends, insights scatter)
- **@zxing/browser** — barcode scanner (camera-based EAN/UPC lookup, used by ingredient picker)
- **vite-plugin-pwa** — manifest + service worker for installability
- **CSS variables for theming** — no Tailwind, no styled-components; plain CSS Modules or scoped CSS

Rationale: smallest viable stack for a personal PWA. Dexie because raw IndexedDB is verbose. Recharts because it's React-native (Chart.js works but feels imperative). HashRouter because GitHub Pages doesn't support history-mode rewrites.

## Data model

TypeScript types under `src/models/`. Stored in IndexedDB tables matching the model names. **Do NOT redesign without asking.**

- `BPReading` — `id`, `timestamp`, `systolic`, `diastolic`, `pulse?`, `contextTags[]`, `notes?`. Computed `category` uses the Australian Heart Foundation bands — see "BP categories" below.
- `Ingredient` — `id`, `name`, `brand?`, `barcode?`, `publicFoodKey?`, `aisle`, all nutrients per **100g** for normalisation. Energy stored as both kJ (primary) and kcal (secondary).
- `Meal` — `id`, `name`, `tags[]`, `servings`, `defaultSlot`. `nutrientsPerServing` rolls up from ingredients.
- `MealIngredient` — `id`, `mealId`, `ingredientId`, `quantity`, `unit`. `gramsEquivalent` handles unit conversion.
- `MealPlanEntry` — `id`, `date` (start-of-day epoch ms), `slot`, `mealId`, `servings`, `wasEaten`.
- `NotificationSchedule` — `id`, `type`, `hour`, `minute`, `weekdays[]` (0=Sun…6=Sat — JS convention, NOT Calendar's 1-based one), `mealSlot?`, `isEnabled`, `customMessage?`.
- `GroceryCheck` — compound key `[weekStart+ingredientId]`. One row per ticked item per week; persists across reloads.

Helpers:

- `NutrientTotals` type with `add()`, `divide()`, `scaled()` pure functions.
- `groceryAggregator.aggregate()` rolls a week of `MealPlanEntry` into deduplicated, aisle-grouped lines.
- `insightsAnalyzer` computes Pearson correlation + linear regression for BP vs nutrient intake.

## Notifications

Web Push API + service worker. Major platform constraints:

- **iOS Safari:** web push only works after the user "Add to Home Screen" — Safari refuses push registration from regular tabs. Document this clearly in the Settings UI.
- Schedule storage in IndexedDB; service worker schedules `setTimeout` fallbacks for the next 24h on each app open (push API doesn't have native cron).
- Smart suppression: when a notification fires, check IndexedDB before showing — skip BP reminder if there's a reading in last 60 min, skip meal reminder if today's slot is already eaten.

## AUSNUT and Open Food Facts data

- **AUSNUT 2011–13** — `src/data/ausnut_foods.json` — whole foods, AUSNUT Public Food Key as identifier.
- **Open Food Facts (Coles/Woolworths AU subset)** — `src/data/branded_foods.json` — branded products, EAN barcode as identifier, brand string.
- Bundled with the build. Imported into IndexedDB on first launch (`ingredientImporter.importIfNeeded`). Subsequent launches skip if the table is non-empty.
- Two Python converter scripts in `scripts/` produce these JSON files from the source spreadsheets/dumps.
- Do NOT call any nutrient API at runtime.

## BP categories

Australian Heart Foundation bands (Guideline for the diagnosis and management of hypertension in adults — 2016, reaffirmed 2023). `BPCategory` values are camelCase TypeScript literals.

| Tier | Systolic | Diastolic |
|---|---|---|
| `normal` | <120 | <80 |
| `normalHigh` | 120–139 | 80–89 |
| `grade1` | 140–159 | 90–99 |
| `grade2` | 160–179 | 100–109 |
| `grade3` | ≥180 | ≥110 |

Whichever value (sys or dia) lands in the higher tier wins. Colour mapping: `normal` = accent green, `normalHigh` = amber, `grade1`/`2`/`3` = warning terracotta. Healthy-zone band on the trend chart is 60–120 (matches AU "normal" upper bound).

## Aesthetic direction

Warm-minimal, NOT clinical-blue health-app style.

- Background: warm off-white (`#f4f1ec`)
- Single accent: deep green (`#2d5a3d`) for healthy/in-range states
- Warning: muted terracotta (`#b8543a`) for elevated readings
- Generous whitespace, large display numerals for BP and key nutrients
- System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`) — SF on iOS Safari, native font elsewhere
- Card-based layout with subtle borders, not heavy shadows
- BP category colour-coding: `normal`=green, `normalHigh`=amber, `grade1`/`grade2`/`grade3`=red

## Build order

1. Models + Dexie schema + ModelContext-equivalent wrapper
2. Pure-logic services (NutrientTotals, GroceryAggregator, InsightsAnalyzer)
3. Theme CSS + shared components (Card, Badge, Chip)
4. Routing + tab bar layout
5. BP feature (log, list, trend chart)
6. AUSNUT/Open Food Facts importer
7. Meal library + editor + ingredient picker
8. Week planner + slot picker
9. Grocery list
10. Notifications + Reminders settings (with iOS-PWA caveat banner)
11. Dashboard
12. Insights — BP vs sodium/potassium correlation
13. JSON export/import for manual backup
14. PWA polish: manifest, icons, service worker, offline fallback

## File layout

```
/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   ├── manifest.webmanifest
│   └── icons/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── theme.css
│   ├── db/
│   │   └── index.ts                     # Dexie setup + table definitions
│   ├── models/                          # type definitions only, no logic
│   ├── services/                        # pure functions: aggregator, analyzer, importer, notifications
│   ├── components/                      # Card, CategoryBadge, FilterChip, etc.
│   ├── views/
│   │   ├── Dashboard/
│   │   ├── BP/
│   │   ├── Meals/
│   │   ├── Plan/
│   │   ├── Grocery/
│   │   ├── Insights/
│   │   └── Settings/
│   └── data/
│       ├── ausnut_foods.json
│       └── branded_foods.json
└── scripts/
    ├── convert_ausnut.py
    └── convert_off.py
```

## Conventions

- One type per file under `models/`. No business logic in models — just shape.
- Pure functions in `services/`. They take plain inputs and return plain outputs; they never touch the DB.
- DB access goes through `src/db/index.ts` only. Views call DB functions; services don't.
- React components use function syntax with hooks. No class components.
- Dates stored as epoch ms (number) in IndexedDB to avoid timezone serialisation surprises. Convert to `Date` at the boundary.
- Phrasing should read naturally to an Australian user (use "kilojoules", AU date conventions, "fibre" not "fiber").
- Default to `en_AU` locale and Monday-first weeks for any locale-sensitive UI.
- Units: nutrients stored in **mg** for sodium/potassium/calcium/magnesium, **g** for protein/carbs/fat/fibre, energy in both **kJ** (primary, shown first) and **kcal** (secondary).
- Keep CSS lean — variables for tokens, no utility-class soup. Co-located CSS Modules where it helps.

## Things NOT to do

- Don't add user accounts, login, or auth flows.
- Don't add cloud sync, server-side storage, Firebase, Supabase, or any backend.
- Don't add social/sharing features.
- Don't introduce paid SDKs or APIs.
- Don't replace Dexie with a heavier stack like Realm, RxDB, etc.
- Don't add ads, analytics, or telemetry.
- Don't add medication-dose calculations or anything that could be construed as medical advice. The app surfaces data; it does not prescribe.
- Don't auto-categorise BP readings beyond the AU Heart Foundation bands already in `BPCategory`. If you ever need to support multiple national guidelines, model that as separate enums and a chooser, not by overloading these values.
- Don't add unit tests speculatively — only when asked, and only for non-UI logic (aggregators, unit conversions, suppression rules).
- Don't pull in Tailwind, MUI, Chakra, or any heavy UI library. The visual language is custom and small.

## Build & run

- `npm install` to install deps
- `npm run dev` for the local dev server (Vite, hot reload)
- `npm run build` produces `dist/` — static files ready for GitHub Pages or any static host
- `npm run preview` serves the built bundle locally for sanity checks

To install on iPhone:
1. Deploy `dist/` to GitHub Pages (or any HTTPS static host)
2. Open the URL in Safari on the iPhone
3. Share → Add to Home Screen
4. Icon now launches the PWA in fullscreen mode

## Icons

Currently the PWA uses a single SVG (`public/icons/icon.svg`) for both icon purposes (`any` and `maskable`). iOS Safari 17+ honours SVG home-screen icons; earlier versions fall back to a screenshot. If you want crisp PNG fallbacks for older iOS or Android launchers, generate them once with any of:

- An online tool like https://realfavicongenerator.net (drop in `public/icons/icon.svg`, download the package, place `icon-192.png` / `icon-512.png` / `icon-512-maskable.png` into `public/icons/`).
- A local one-liner: `npx pwa-asset-generator public/icons/icon.svg public/icons --type png --background "#f4f1ec"`.

Then update `vite.config.ts` to add the PNG entries alongside the SVG.

## When in doubt

- Prefer the simplest thing that works. This is a personal app, not a startup.
- If a request would significantly expand scope (server, multi-user, sharing, medical features), pause and confirm before implementing.
