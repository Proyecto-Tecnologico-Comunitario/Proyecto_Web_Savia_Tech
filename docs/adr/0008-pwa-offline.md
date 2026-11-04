# ADR-0008: PWA and offline behaviour

- Status: accepted
- Date: 2026-11-02
- Owners: Technical Director
- Task: TR-001 T7

## Context

T7 makes the vertical slice installable and usable without network after the first load. The app
handles sensitive data, so the offline layer must not add a second place where case data can leak,
must not call third parties, and must not surprise the professional with an automatic reload while a
screening is in progress.

The service worker is generated at build time. Writing one by hand would mean maintaining cache
versioning, precache manifests and update logic that Workbox already provides and tests.

## Decision

1. **`generateSW` with an inlined runtime.** `vite-plugin-pwa` generates one `dist/sw.js` with
   `inlineWorkboxRuntime: true`, so the worker is a single file and the build audit can read its
   precache manifest. There is no hand-written worker and no second runtime file.
2. **Precache the whole build, no runtime caching.** `globPatterns` covers JS, CSS, HTML, PNG and SVG;
   the manifest is added once by the plugin. `runtimeCaching` stays empty, `navigateFallback` serves
   `index.html`, and source maps are off. The worker only serves files that were part of the build.
3. **Updates are prompted, never silent.** `registerType: 'prompt'` with `skipWaiting: false` and
   `clientsClaim: false`. The UI announces a waiting version on the lock screen and in Settings.
   Applying it is an explicit action; with the vault unlocked it is blocked, so a screening in
   progress is never discarded by a reload.
4. **The manifest is neutral and configurable at build time.** The default name is `SaviaTech`, the
   short name is the same, the base path comes from `VITE_BASE_PATH` (default `/`) and the icons are
   geometric. A deployment that needs a different name sets `VITE_APP_NAME`/`VITE_APP_SHORT_NAME`;
   the manifest cannot change after installation.
5. **The build has a budget.** `apps/web/bundle-budget.json` sets limits for initial JS/CSS, HTML,
   `sw.js` and the precache. `npm run budget` also audits the HTML, the CSP, the precache, the
   manifest and the icons. CI runs it after `npm run build`.
6. **The audit is strict about origins.** `sw.js` may contain no `importScripts` and no absolute URL
   except the documented Workbox warning string `https://bit.ly/wb-precache`. The precache must not
   include `sw.js`, must only reference files in `dist` and must stay on the same origin.
7. **The installed surface is minimal.** There is no custom install button and no manifest
   `description`, `categories`, `shortcuts` or screenshots. The name and icon are visible on the home
   screen and in the app switcher; that is a documented limit, not a feature.
8. **No runtime third-party calls.** The worker has no analytics, no remote fonts and no CDN. The
   e2e fixture fails on any request outside the local origin.
9. **Tests cover what a browser can prove.** Unit tests cover the manifest, the status store and the
   blocked update path. Playwright covers installation, cold start, the full flow offline, first use
   offline, cache contents, installability and CSP. The update with two real builds was verified in
   Chromium and recorded in the README. A low-end Android measurement remains pending.
10. **`caniuse-lite` is a nominal licence exception.** It is a build-time data package for the
    Workbox chain (CC-BY-4.0) and does not enter the bundle. The exception in
    `scripts/check-licenses.mjs` matches the exact package name; CC-BY-4.0 is not added to the general
    allow-list.

## Measured build

Measured on 2026-11-02 with Node 24.19.0, `vite 7.3.7` and `vite-plugin-pwa 2.0.0`:

| Metric               | Actual    | Budget      |
| -------------------- | --------- | ----------- |
| Initial JS (gzip 9)  | 126,449 B | 256,000 B   |
| Initial CSS (gzip 9) | 1,545 B   | 30,720 B    |
| `index.html`         | 969 B     | 4,096 B     |
| `sw.js`              | 15,762 B  | 40,960 B    |
| Precache (12 files)  | 436,541 B | 1,048,576 B |

## Consequences

- The first load must be online and over HTTPS (or `localhost`/`127.0.0.1`). After that the shell,
  assets and clinical content are served from the precache.
- A new version is downloaded in the background and waits. The professional sees the notice after
  the next load; applying it requires the vault to be locked.
- The precache is visible in the browser's site data. It contains only build files, never case data.
  O5 checks that the case code, the PIN and the justification are absent.
- IndexedDB and the cache can be evicted by the system. The app requests persistent storage, but
  eviction remains possible.
- Old versions may remain on phones that never load the app online again.
- The update was verified with two builds on Chromium. A real low-end Android phone (T7-20) is still
  pending and is not claimed as done.

## Alternatives considered

- **Hand-written service worker**: rejected; more security-sensitive code to review and no benefit
  over the generated worker.
- **Network-first or stale-while-revalidate runtime caching**: rejected; v1 has no API, and runtime
  caching would add another place for data to persist.
- **Automatic update (`autoUpdate`)**: rejected; it reloads without consent and can discard work.
- **A custom install button**: rejected; browser UI is enough for v1 and adds less surface.
- **A descriptive manifest name or icon**: rejected; the installed name is visible to anyone who
  inspects the phone.
