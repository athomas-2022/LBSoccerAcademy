# Design

The visual system for **The LB Soccer Academy**. One identity, two surfaces: the public
"Every Kid Plays" site (**brand**, drenched-blue, phone-first) and the coach's dashboard
(**product**). Colors and type are the official **Liberty-Benton Local Schools** brand and are
authoritative — this is an identity-preservation system, not a greenfield palette. Delivered
logo assets are the ground truth; the brand PDF's color table misprints the blue hex.

---

## Theme

**Drenched blue varsity.** The surface *is* the color — deep royal Liberty-Benton blue carries
the public site, with crisp white and a cool off-white doing the breathing room. Not a
white page with blue accents: a blue page. The mood is a packed Eagle game night under the lights —
confident, athletic, warm at the edges. Dark-on-blue and light-on-blue both, section to
section, for varsity contrast. The dashboard inverts to a light working ground (blue as
structure, not flood) because it serves a task, not an impression.

Physical scene that forces the choice: a parent standing on the sideline in early-evening
light, phone in hand, deciding in ten seconds whether "their kid" belongs here. The answer has
to be *obviously yes* — big, bright, and open, never clinical, never pleading.

---

## Color

Official brand values. Hex is authoritative (from delivered logo files); OKLCH values are the
working equivalents for deriving tints, shades, and states. **LB Blue = `#003DA5`.**

### Core brand

| Token            | Hex       | OKLCH                     | Use |
|------------------|-----------|---------------------------|-----|
| `--lb-blue`      | `#003DA5` | `oklch(0.402 0.177 261)`  | Primary brand. The blue everything floods to. |
| `--lb-blue-deep` | `#003C9C` | `oklch(0.392 0.166 261)`  | Logo-matched alt / pressed states. |
| `--lb-navy`      | `#0A2540` | `oklch(0.260 0.060 251)`  | Deep ground, footers, ink on light. |
| `--lb-red`       | `#C8102E` | `oklch(0.530 0.207 22)`   | Accent — **use sparingly**. See semantics. |
| `--lb-gray`      | `#C1CBDA` | `oklch(0.839 0.024 258)`  | Cool blue-gray support / hairlines. |
| `--white`        | `#FFFFFF` | `oklch(1 0 0)`            | Primary on-blue text; card ground. |
| `--paper`        | `#F4F7FC` | `oklch(0.975 0.007 261)`  | Off-white app/section ground (blue-tinted, chroma toward brand — not warm). |

### Blue ramp (derived, hue ≈ 261)

```
--blue-50:  oklch(0.975 0.012 261)   --blue-500: oklch(0.500 0.175 261)
--blue-100: oklch(0.940 0.030 261)   --blue-600: oklch(0.402 0.177 261)  /* #003DA5 BRAND */
--blue-200: oklch(0.880 0.055 261)   --blue-700: oklch(0.340 0.150 260)
--blue-300: oklch(0.780 0.090 261)   --blue-800: oklch(0.290 0.110 257)
--blue-400: oklch(0.620 0.150 261)   --blue-900: oklch(0.240 0.075 254)
                                       --blue-950: oklch(0.200 0.050 252)
```

### Color strategy

**Drenched** (public site) — blue is the surface, 40–70% of the fold. White and `--paper`
are the relief. Red is a spark, never a field. **Restrained** (dashboard) — `--paper` ground,
blue as structure/primary actions ≤ 20%, red reserved for the one meaning below.

### Semantics

- **Red = a kid at risk of being lost (attrition).** In the dashboard this is the loudest
  signal in the system — an at-risk athlete, a dropping retention number — *never* generic
  error chrome. Always paired with an icon/label, never hue alone (color-blind safe).
- **Boys & girls** are distinguished by **more than color** (label + mark), never boys-first,
  never one as the "alt." If tinted, keep both within the brand blue family at equal weight.

### Contrast rules (verify, don't eyeball)

- White on `--lb-blue`: passes AA for all sizes. This is the workhorse pairing.
- `--lb-blue` / `--lb-navy` on white or `--paper`: passes. Body ink on light = `--lb-navy`.
- **Never** muted gray body text on `--paper` or on blue — it fails and reads washed out. On
  blue, "muted" text = white at 78–85% opacity; on light, step toward navy, not gray.

---

## Typography

Two brand-sanctioned families on a true contrast axis (athletic display vs. geometric
workhorse) — not two similar sans. Identity-preservation: these are the district's fonts.

- **Octin Sports** (`OctinSportsRg`) — the athletic display face. **Wordmark, jersey numbers,
  big hero display, and the tier/number labels ONLY.** Never body, never long lines, never
  lowercase paragraphs. This is the "varsity" in the voice; a little goes a long way.
- **Montserrat** — the sanctioned digital/UI workhorse, all weights. Every heading below the
  hero, all body, all UI, all dashboard text. Geometric-humanist, clean, legible on a phone.

Load Octin locally from `assets/` (self-hosted TTF); Montserrat self-hosted or via the
district's licensed webfont. `font-display: swap`. Always ship a system fallback stack.

### Scale

Fluid modular scale, ratio ≥ 1.25, `clamp()` on display/headings. Hero display ceiling
≤ 6rem. Display letter-spacing ≥ -0.03em (Octin is already tight/squared — don't crush it).
`text-wrap: balance` on h1–h3; `text-wrap: pretty` on prose. Body line length 60–70ch.
Light-on-blue text: add 0.05–0.08 to line-height (light type reads lighter).

```
--font-display: "OctinSportsRg", "Arial Narrow", system-ui, sans-serif;  /* display only */
--font-sans:    "Montserrat", ui-sans-serif, system-ui, "Segoe UI", sans-serif;

--step--1: clamp(0.83rem, 0.80rem + 0.15vw, 0.90rem);
--step-0:  clamp(1.00rem, 0.95rem + 0.25vw, 1.13rem);   /* body */
--step-1:  clamp(1.25rem, 1.15rem + 0.5vw, 1.50rem);
--step-2:  clamp(1.56rem, 1.40rem + 0.8vw, 2.00rem);
--step-3:  clamp(1.95rem, 1.70rem + 1.3vw, 2.75rem);
--step-4:  clamp(2.44rem, 2.00rem + 2.2vw, 3.75rem);
--step-5:  clamp(3.05rem, 2.30rem + 3.6vw, 5.50rem);   /* Octin hero, ≤ 6rem ceiling */
```

---

## Space, radius, shadow

Phone-first, generous on the public site, tighter and denser on the dashboard.

```
--space-scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128   (px, 4px base)
--radius-sm: 6px;  --radius-md: 10px;  --radius-lg: 16px;  --radius-pill: 999px;
```

- **Radius:** moderate, athletic — not pill-soft everywhere, not sharp brutalist. Pills for
  tier tags / CTAs; `--radius-lg` for large media/panels.
- **Shadow:** used sparingly and tinted toward navy, never neutral gray-black. On drenched-blue
  sections prefer contrast and layering over shadows. `--shadow-md: 0 6px 24px -8px oklch(0.26
  0.06 251 / 0.35)`. No glassmorphism as default.
- **Borders:** hairlines in `--lb-gray` on light; white at 12–18% opacity on blue. **No
  side-stripe accent borders** (banned).

---

## Motion

Intentional, athletic, quick. Ease-out (quart/expo), no bounce, no elastic.

- **Public site:** one well-orchestrated hero entrance (the blue floods / the wordmark and
  pathway settle in) earns its place; below the fold, motion fits what it reveals (the 4-rung
  pathway can build rung by rung; sponsor tiers can stagger). Reveals **enhance an
  already-visible default** — never gate content on a scroll class.
- **Dashboard:** motion is feedback, not spectacle — number transitions on the Four Numbers,
  smooth map/list state changes, ~150–200ms.
- **Reduced motion is required** everywhere: `prefers-reduced-motion: reduce` → crossfade or
  instant. Consider a heavier motion library (Motion/GSAP) only if the hero needs it.

---

## Components (shared language)

- **Buttons:** primary = solid `--lb-blue` / white text (on light) or white / blue text (on
  blue); pill or `--radius-md`. Clear hover (lighten/darken one ramp step) + pressed
  (`--lb-blue-deep`) + focus-visible ring. Tap target ≥ 44px.
- **Tier tag** (Grassroot Eagles · Eagles Academy · Next XI Eagles): pill, Octin or Montserrat-
  SemiBold label, blue family. The pathway is a recurring motif — treat the four rungs
  (→ Varsity) as a first-class component, not a card grid.
- **Sponsor tier** (Friend $100 → Champion $1,000+): a real value ladder, ascending weight —
  **not four identical cards.** Amount + concrete outcome ("outfits a kid head-to-toe").
- **Cards:** only when truly the best affordance; never nested. The pathway and sponsor ladder
  are *ladders*, not card grids — resist the identical-card reflex.
- **Dashboard:** capture/retention **map** (athletes K–8 by grad year, boys+girls), the
  **Four Numbers** as live figures (capture rate · retention rate · active players · sponsor
  dollars) — resist the hero-metric SaaS template; make them read as a scoreboard, not KPI
  chrome. 12-phase launch tracker, sponsor list. localStorage-backed, opens by double-click.

---

## Per-surface direction

**Public site** — `public/`, brand register, phone-first. Drenched blue. Narrative fold order
(from the prior build, still the frame): hero → why it's free → the 4-rung pathway →
the coaching **Standard** (Touches · Brave · Play · Youngest · System — the *coaching* standard,
not character values) → sponsor tiers → gear closet → FAQ → register. Boys **and** girls
present throughout. Form is backend-ready via a `FORM_ENDPOINT` (empty = mailto fallback to
athomas@Liberty-Benton.org). Ship real imagery (Eagle soccer / youth action) — colored
blocks where a hero photo belongs is a bug.

**Dashboard** — `index.html` + `src/`, product register, localStorage. Light `--paper` ground,
blue structure, red = attrition risk. Design serves the operator's task: see every kid, watch
the numbers, work the plan.

---

## Do-not

- No Opportunity Fund, no Five Strategic Pillars, no five Core Values — these do **not** exist
  in this program. The public "Standard" is the **coaching** standard.
- No cream/sand/beige "warm neutral" ground — the off-white is blue-tinted (`--paper`), toward
  the brand hue, not warmth.
- No gradient text, no glassmorphism-by-default, no side-stripe borders, no tiny tracked-
  uppercase eyebrow above every section, no identical card grids, no purple-SaaS hero.
- Octin never in body or long copy. Muted-gray text never on tinted grounds.
