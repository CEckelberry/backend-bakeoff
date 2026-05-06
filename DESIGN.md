# Design

The visual and interaction language for the Bake-off frontend. Inherits the cotton-candy palette and typography from the portfolio's design system, but with adjustments specific to a data-dense, real-time interface.

---

## Design tension: data + delight

The portfolio site is mostly content. This site is mostly *numbers updating*. The same cotton-candy vocabulary needs to work for a live latency chart that's refreshing every 2 seconds, sortable tables, sliders, and live-fire stress testing.

The principles that follow are how we keep the playful aesthetic without the data feeling like a toy.

**1. Numbers always read first.** Charts before chrome. A latency value should be readable in 200ms of glance time. Chart axes, tick labels, and grid lines step back; the actual data lines are in saturated accent colors.

**2. Animation has to mean something here.** On the portfolio site, drift is decoration. On this site, every visual change should map to a real event — a request completed, a metric updated, a runtime got faster. Drift for its own sake is forbidden.

**3. Density without clutter.** Senior engineers will read everything. Show them everything that matters in one viewport, then let them drill in. Don't hide useful data behind tabs unless there's a real reason.

**4. The site should feel like an instrument.** It's a panel of running numbers, controls, and a very real workload firing through it. Treat it like a small console, not a marketing page.

---

## Inherited tokens

The full token system from the portfolio's `DESIGN.md` is inherited verbatim:

- **Palette**: cotton-candy, both modes, all six accent colors
- **Typography**: Inter / Instrument Serif / JetBrains Mono
- **Spacing scale**: 4px → 72px in eight steps
- **Radii**: 4 / 8 / 12 / 16 / pill
- **Easing curves and durations**: same library

What changes for this project is the *intensity* of how those tokens get used. Mono microcopy gets used much more — every metric label, every runtime tag, every queue depth indicator is mono. Glass surfaces are darker and more opaque (because they sit behind charts that need contrast). Italics show up less (this is a data interface; serif italic editorial accents are reserved for the page hero only).

### Runtime accent assignments

Each runtime has a permanent color identity that holds everywhere — chart lines, tab indicators, badges, in-page mentions:

| Runtime | Token | Hex |
|---|---|---|
| Go | `--rt-go` | `#5DCAA5` (teal) |
| Rust | `--rt-rust` | `#FAC775` (amber) |
| Bun | `--rt-bun` | `#F4C0D1` (pink-soft) |
| Node | `--rt-node` | `#AFA9EC` (purple-soft) |
| Python | `--rt-python` | `#ED93B1` (pink) |
| PHP | `--rt-php` | `#7F77DD` (purple) |

These are deliberately not the language's "official" colors (Rust is orange, Go is cyan, etc.) because we want the chart to be readable, not nostalgic. Rust gets amber because it sits at the brightness level that lets it stand out against the others.

---

## Page structure

A single-page application with five primary surfaces (plus a wake-up splash that overlays everything when the cluster is sleeping):

```
┌──────────────────────────────────────────────────────────────┐
│ [WARMUP SPLASH — shown when cluster is asleep or waking]    │
│ ────────────────────────────────────────────────────────    │
│ NAV (back to portfolio · github · case study)                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   HERO + LIVE METRICS PANEL                                  │
│   Title, methodology badge, the 6-line live latency chart    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│   RUNTIME SELECTOR + INTERACTIVE CHECKOUT                    │
│   The "place an order" panel; flip the tab, fire requests   │
├──────────────────────────────────────────────────────────────┤
│   COMPARISON MODE (collapsible)                              │
│   Pick two runtimes, fire the same request to both          │
├──────────────────────────────────────────────────────────────┤
│   STRESS MODE (collapsible)                                  │
│   The slider, the live ramp, the queue indicator            │
├──────────────────────────────────────────────────────────────┤
│   METHODOLOGY + LINKS                                        │
│   Plain-language summary, link to /methodology, link to repo│
└──────────────────────────────────────────────────────────────┘
```

The page never scrolls more than 3 viewport-heights total. Everything important fits above the fold; what's below is reference material and links.

---

## Components

### Warmup splash

When the cluster is asleep or waking up, the entire interactive surface is replaced with the warmup splash. This is the first impression for any visitor who arrives after a quiet period — it has to be honest, informative, and not feel like a defect.

**Anatomy:**
- Full-viewport overlay over the normal page (the page is still there underneath, just hidden)
- A large display-type heading that updates with the current state:
  - "Cluster sleeping — waking up..."
  - "Provisioning nodes..."
  - "Starting backends..."
  - "Priming — final 30 seconds..."
- A horizontal progress bar (0-100%) that maps to the wake-up sequence's phases
- Below the bar: a 6-row mini-status panel showing each backend's individual state (Pending → Scheduled → Running → Ready → Primed). Each row in its runtime accent color.
- Below that: a small explainer paragraph: "We pause the comparison cluster after 15 minutes of inactivity to keep costs honest. Six backends + database are warming back up. This takes roughly 60 seconds. The methodology document explains why we do this."
- A subtle ambient mesh background, drifting slowly, in the cotton-candy palette

**States:**
- **Asleep** (visitor just arrived): heading is "Cluster sleeping — waking up...", progress bar at 0%, all backend rows show "Pending"
- **Waking** (nodes provisioning): heading is "Provisioning nodes...", bar progresses based on Cloud Function status reports
- **Starting** (pods scheduling): each runtime row independently transitions through Scheduled → Running → Ready as it comes up
- **Priming** (60s warmup): heading is "Priming — N seconds...", bar in the final 60% segment
- **Ready** (transition out): brief "Online" flash, then the splash fades and the live UI appears

**Failure state:**
- If wake-up controller reports failure, splash shows "Wake-up failed — please try again" with a retry button
- A "view status" link goes to a small status page with diagnostic info

**Visual treatment:**
- Treat this as part of the product, not a fallback. It's the first impression.
- Use the same cotton-candy palette and typography as the main site
- Mesh background drifts slowly (this is one of the few places where decorative motion is fine — there's nothing else competing)
- Small stats counter at the bottom: "Cluster has been asleep for 47 minutes. Last awakened by 3 visitors today."

The splash is a feature, not a workaround. Engineers will read every word. It's a chance to demonstrate that you understand cost optimization isn't free, and you've made the trade-offs visible.

### Live metrics panel

The hero region's most important component. A real-time chart with one line per runtime, showing p95 latency over the last 60 seconds.

**Anatomy:**
- 480px wide, 200px tall on desktop; full-width on mobile, 240px tall
- Y-axis: latency in milliseconds, log-scaled (linear hides PHP's spread; log makes everyone visible)
- X-axis: time, "60s ago" → "now"
- Six lines, each in its runtime accent color, 1.5px stroke
- Each line ends in a labeled dot showing the current value
- A toggle above the chart lets you switch between p50 / p95 / p99 / RPS / error rate
- A "warming up" badge appears over any runtime whose data is < 30s old

**States:**
- **Default**: 6 lines plotting smoothly
- **Stale data**: chart greys out, "stale data — Prometheus unreachable" overlay
- **Warming up (single runtime)**: that runtime's line is dashed and labeled
- **Elevated errors (single runtime)**: that runtime's label gets a small triangle warning glyph

**Implementation:** Chart.js with custom plugin for the trailing-dot labels. Update tick: 2 seconds. Animation: smooth between updates with an `--ease-out` over 300ms. No bounce, no overshoot — the data is real, not playful.

### Runtime tabs

The control that flips which backend serves your requests. Six tabs in a row, each with:
- A small color square (the runtime's accent)
- The runtime name in mono
- A tiny live indicator (pulsing dot in teal if the runtime is healthy, pink if elevated errors)

**States:**
- Inactive: glass surface, hover lifts and adds the runtime accent border
- Active: filled with a soft tint of the runtime accent, full accent border, accent text color
- Disabled (runtime crashed, can't proxy): grayed out, "unavailable" tooltip

When you click a tab, the page does NOT reload. The tab state updates a writable store; subsequent requests carry the new `X-Runtime` header. The active tab persists in the URL (`?rt=rust`).

### Place-an-order panel

A glass card that mimics a real e-commerce checkout flow.

**Anatomy:**
- Left half: a small "cart" with 3-5 items, randomized on each load (sneakers, hoodie, sticker, etc.)
- Right half: the result panel — empty by default, populated after a successful order
- Bottom: a primary button "place order — POST /checkout"

When you click "place order":
- Button enters a loading state (spinner, "placing...")
- A request fires through the router with the active runtime
- On response (typically 60-300ms), the result panel fills with:
  - Order ID
  - Total + tax breakdown
  - **Server-side timing breakdown**: validation, DB read, tax, fraud, DB write, total
  - The runtime that served the request (mono, in that runtime's color)
  - The trace ID, with a "view trace" link that opens Cloud Trace

**The timing breakdown is the centerpiece.** Six horizontal bars, each colored by step, summing to the total response time. You see at a glance where the time went. Switching runtimes and re-firing makes the differences visible.

### Comparison mode

A collapsible section. When expanded:
- Two runtime selectors side by side
- A single "fire request" button
- Two result panels appear simultaneously after the request completes
- A diff line at the bottom: "Rust beat Go by 8ms (44ms vs 52ms total)"

The same payload goes to both runtimes (deterministic seed). The two responses come back independently; the diff updates when both have completed.

### Stress mode

A collapsible section, prominently labeled with a small caution icon ("real load, real cost — limited to 1 run per 60 seconds").

**Anatomy:**
- A runtime selector (one runtime per stress run, not parallel — that's a v2)
- An RPS slider, 1 to 200
- A duration toggle: 10s / 30s (max)
- A "start" button

**During a run:**
- The button changes to "running... 24s remaining"
- The hero metrics panel snaps to "live, last 30s" and zooms in on the active runtime
- A small "current load: 87 RPS" indicator updates every second
- An error counter shows total errors / total requests in real time

**After:**
- A summary card: total requests, errors, p50/p95/p99, peak in-flight
- The live metrics panel returns to the default 60-second window

**If the slot is taken:**
- The button shows "queue depth: 2 — wait ~25s"
- Disabled until the slot frees

### Methodology badge

A small pill near the hero title: `methodology v1 · 6 runtimes · last verified 2h ago`. Clicking opens a modal with:
- A 200-word plain-English summary of what's controlled and what varies
- Links to `/methodology` (the full doc as a page) and the `METHODOLOGY.md` on GitHub

The "last verified" timestamp comes from the most recent CI run that ran the methodology audit. Recruiters won't click it. Engineers will, and they'll be looking for it. It needs to exist and it needs to be honest.

---

## Motion

Two motion vocabularies on this site, used for different things.

### Data motion (the chart, the metrics, the gauges)

- Smooth, continuous, never bouncy
- 300ms `--ease-out` between data updates
- No scale, no rotation — only opacity and translate
- The "trailing dot" on each chart line slides smoothly to its new position; doesn't snap
- A new data point doesn't cause earlier points to shift — the X-axis scrolls left to make room

### Interface motion (button presses, panel expands, state changes)

- The portfolio's full motion library applies here
- Glass cards lift on hover with `--ease-out` 240ms
- Panels expand with a height transition + fade-in for content
- The runtime tab indicator slides between active states with `--ease-spring`

The two vocabularies should not blend. The chart's lines never bounce; a button never updates linearly.

### Reduced motion

- Chart still updates (it has to — that's the data) but transitions become instant
- Glass cards do not lift on hover
- All decorative drift halts

---

## Live UI honesty

A real-time interface can lie subtly without trying. Three patterns to enforce honesty:

**1. Show staleness.** If Prometheus' last successful scrape was > 30s ago, the chart greys out and shows the staleness clearly. Don't let the user think they're seeing live data when they're not.

**2. Show warming-up state.** A backend that just restarted has < 60s of post-warmup data, and that data is unreliable. Mark it visually until enough time has passed.

**3. Don't smooth.** It's tempting to smooth the chart (rolling average, exponential decay) so the lines look prettier. Don't. Real latency is spiky. Smoothing makes the slow runtimes look better than they are; that's a lie.

The methodology's credibility depends on the UI never overstating what the system knows.

---

## Copy

The site's voice continues from the portfolio: confident, plain, occasional dry humor, no marketing speak. Specific patterns:

**Numbers in microcopy.** "P95 latency · last 60 seconds" not "Performance metrics". "Currently serving via Rust" not "Backend selection: rust". Numbers and runtime names are first-class.

**Honest framing of limits.** "Stress mode runs are capped at 200 RPS for cost reasons. The live demo is a demo, not a production benchmark — for that, run your own." This goes near the stress mode UI, not buried in a footer.

**Methodology surfaced as opinion.** "We run six pods 24/7 because cold starts would lie. We chose `chi` over `gin` because most teams ship `chi`." First person, owned, not "industry best practice."

**No emoji in interface text.** Only in the celebratory completion banner ("done · 1,847 requests · 0.2% errors") if at all, and even there, prefer typographic glyphs (✓, ↗) over emoji.

**Mode/state labels.** Casual, Comparison, Stress. Sentence case. No "Mode 1" / "Mode 2".

---

## Mobile

The desktop is the primary experience, but mobile should still work — recruiters scroll on their phones.

**Adaptations for < 768px:**
- The 6-line chart shows only 3 runtimes by default; toggle button to switch which 3
- The runtime tabs become a select dropdown
- The order panel stacks vertically (cart on top, result below)
- Comparison mode is hidden on mobile (the side-by-side layout doesn't work)
- Stress mode is hidden on mobile (the slider's precision is too clumsy on touch)
- The methodology summary collapses to a single button

The mobile experience is intentionally limited. Phones aren't the right tool for examining a benchmark. The site says so explicitly with a small banner: "this site is best on desktop — comparison and stress modes require more room."

---

## Empty and degraded states

**Cluster fully down.** The chart shows the last known data with a "all backends unreachable" banner. The order panel is disabled with "system degraded — check status page".

**One backend down.** Its line on the chart goes flat-grey. Its tab is disabled. Other backends still work. A small notice: "Python backend unavailable — investigating."

**Stress mode quota exhausted.** "Daily stress run quota reached (200/200) — resets at midnight UTC." Disabled until reset.

**Database down.** All backends fail equally; banner says so.

**Frontend can't reach router.** Banner: "Can't reach the API. Check your connection or try again." This is the only error that's the visitor's potential fault; phrase it accordingly.

---

## Acceptance: what makes this site feel finished

Three tests:

**The 5-second test.** A new visitor lands on the page. In 5 seconds, can they see (1) what the site is, (2) which runtime is currently selected, (3) the current p95 latency? If all three aren't legible in that time, the layout has failed.

**The interaction test.** A new visitor clicks "place order" without reading anything. The result is interesting enough that they click "place order" a second time. If they don't, the demo isn't doing its job.

**The engineer test.** A senior engineer skims for 30 seconds. They find: the methodology badge, the timing breakdown on a real order, the link to the GitHub repo, and a clear answer to "is this fair?" If any of those four are missing, the case for the project's credibility is weak.
