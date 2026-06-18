# DashJS Video Player

A vanilla-JS, no-build MPEG-DASH video player for experimenting with **Adaptive Bitrate (ABR)** algorithms. It lets you swap between custom and built-in dash.js ABR rules at runtime and emulate constrained network conditions, so you can watch how each rule reacts to real (throttled) bandwidth.

## Features

- **Plays any DASH manifest** — paste an `.mpd` URL and hit Load (defaults to the Big Buck Bunny test stream).
- **Switchable ABR rules** — toggle between custom rules and dash.js built-ins live; switching tears down and rebuilds the player with the selected rule.
- **Real network emulation** — a service worker meters segment download bytes to a capped rate, so dash.js's throughput estimate actually reflects the cap and the ABR rules respond for real.

## Getting started

```bash
npm install   # installs http-server (and dashjs, though the player loads dash.js from CDN)
npm start     # serves on http://localhost:8080 with caching disabled (-c-1)
```

Then open <http://localhost:8080> and open the browser console to watch ABR rule activity (the rules `console.log` their switch decisions).

> **Note:** On the very first load the throttling service worker isn't controlling the page yet. Reload once to enable network emulation.

## How it works

This is a no-bundler project. dash.js is loaded from CDN (`dash.all.min.js`, pinned to `latest` = **v5**), and the app scripts are loaded in dependency order in `index.html`:

| Script | Responsibility |
|--------|----------------|
| `src/customAbr.js` | `CustomBitrateRule` — a BBA-0 + throughput hybrid |
| `src/lowestBitrateRule.js` | `LowestBitrateRule` — always picks the lowest quality |
| `src/highestBitrateRule.js` | `HighestBitrateRule` — always picks the highest quality |
| `src/ruleButtons.js` | `ABR_RULES` registry + rule-selection UI |
| `src/networkThrottle.js` | bandwidth-emulation UI; registers the service worker |
| `src/player.js` | creates the dash.js `MediaPlayer` and wires everything together |
| `sw.js` (repo root) | service worker that throttles media-segment responses |

`sw.js` must stay at the repo root so it gets `/` scope. dash.js v5 fetches segments via **XHR** (not `fetch`), so a service worker — which sits below both — is the only reliable in-page throttle point.

## ABR rules

`src/ruleButtons.js` is the single source of truth for which rules exist. There are two kinds:

### Custom rules (`isCustom: true`)
Registered via `player.addABRCustomRule(...)`. When a custom rule is active, all built-in dash.js rules are disabled.

- **Custom Bitrate** — a BBA-0 / throughput hybrid:
  - buffer below the critical reservoir (2s) → lowest quality
  - buffer between critical reservoir and reservoir (5s) → pick the highest representation under ~90% of measured throughput
  - buffer above reservoir + cushion (15s) → highest quality
  - buffer in between → BBA-0: map buffer level linearly onto the bitrate range
- **Lowest Bitrate** — pins to the lowest representation.
- **Highest Bitrate** — pins to the highest representation.

### Default rules (`isCustom: false`)
The named dash.js built-in is enabled in `player.updateSettings` and all others disabled. Available: **Throughput**, **BOLA**, **Insufficient Buffer**, **Switch History**, **Dropped Frames**, **Abandon Requests**, **L2A**, and **LoLP**.

## Network emulation

`src/networkThrottle.js` renders preset bandwidth buttons. Selecting one posts a byte/sec cap to the service worker, which meters segment downloads to that rate:

| Preset | Cap |
|--------|-----|
| Unlimited | no throttling (default) |
| 5 Mbps | 5000 kbps |
| 2 Mbps | 2000 kbps |
| 800 kbps | 800 kbps |
| 300 kbps | 300 kbps |

## Adding a new ABR rule

1. Create `src/myRule.js` following the factory pattern in `src/customAbr.js` (define the function, set `.__dashjs_factory_name`, wrap with `dashjs.FactoryMaker.getClassFactory`).
2. Add a `<script>` tag for it in `index.html` **before** `ruleButtons.js`.
3. Add an entry to `ABR_RULES` in `src/ruleButtons.js` with `isCustom: true`, a `factoryName`, and `factory` pointing to the constructor.

## Project notes

- No tests, no lint, no build step.
- dash.js v5 changed event payloads: `qualityChangeRendered` now carries `newRepresentation`/`oldRepresentation` objects (with `.bandwidth`), not the v4 `newQuality`/`oldQuality` integers.

## License

MIT
