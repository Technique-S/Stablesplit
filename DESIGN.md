---
name: StableSplit
description: Split expenses effortlessly with on-chain settlement
colors:
  primary: "#0052FF"
  primary-hover: "#4D7CFF"
  primary-light: "#EFF6FF"
  primary-mid: "#BFDBFE"
  secure-green: "#059669"
  secure-green-light: "#ECFDF5"
  alert-red: "#DC2626"
  alert-red-light: "#FEF2F2"
  caution-amber: "#F59E0B"
  caution-amber-light: "#FFFBEB"
  cool-breeze: "#F8F9FC"
  pure-white: "#FFFFFF"
  soft-cloud: "#F1F4F9"
  subtle-stone: "#E8ECF3"
  deep-ink: "#0F172A"
  soft-slate: "#64748B"
  muted-silver: "#94A3B8"
  fine-line: "#E2E8F0"
  fine-line-hover: "#CBD5E1"
  overlay: "rgba(15,23,42,0.62)"
  midnight: "#0F0F0F"
  dark-glass: "#1A1A1A"
  shadow: "#242424"
  deep-slate: "#2E2E2E"
  bright-paper: "#F8F8F8"
  soft-pewter: "#A0A0A0"
  matte-grey: "#666666"
  dark-border: "rgba(255,255,255,0.06)"
  dark-border-hover: "rgba(255,255,255,0.12)"
  emerald: "#34D399"
  coral-red: "#F87171"
  warm-gold: "#FBBF24"
typography:
  display:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "Space Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  sm: "8px"
  md: "14px"
  lg: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    size: "36px"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "{colors.pure-white}"
    textColor: "{colors.deep-ink}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.soft-slate}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-danger:
    backgroundColor: "{colors.alert-red}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  card:
    backgroundColor: "{colors.pure-white}"
    textColor: "{colors.deep-ink}"
    rounded: "{rounded.md}"
    padding: "24px"
  input:
    backgroundColor: "{colors.pure-white}"
    textColor: "{colors.deep-ink}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  badge:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary}"
    rounded: "999px"
    padding: "4px 10px"
---

# Design System: StableSplit

## 1. Overview

**Creative North Star: "The Friendly Vault"**

StableSplit treats money like a trusted companion — warm, clear, and never intimidating. Every surface is organized but not sterile, precise but not cold. The interface breathes with purpose: enough personality to feel human, enough restraint to inspire confidence where it matters most — on the numbers.

Density is moderate but airy. Cards have gentle rounded corners (14px) and lift on interaction with a spring-backed hover. The blue primary is confident without being aggressive — it leads the eye to actions without shouting. The palette stays tightly focused: one primary blue, three semantic colors, and a neutral family that leans slightly cool in light mode and decisively dark in dark mode.

**Key Characteristics:**

- Warm approachability through typography (DM Sans) and spring easings, not through warm-tinted backgrounds
- Confidence through the blue primary — used sparingly, mostly on interactive elements
- Structural elevation — flat by default, shadows appear on interaction
- Tactile feedback — press scale, hover lift, spring easing on every interactive element
- Dark mode with its own distinct character (cool deep grays, not inverted light mode)

## 2. Colors

A restrained palette anchored by a single confident blue, three semantic signals, and a cool-leaning neutral family.

### Primary

- **Confidence Blue** (#0052FF): The single brand accent. Used for primary buttons, links, and focus rings. Applied to ≤10% of any given screen — rarity is the point. Keeps its intensity in both themes.
- **Blue Whitelight** (#EFF6FF / rgba(0,82,255,0.15) in dark): The primary's ambient presence — used for badge backgrounds, stat card icon wells, and light tint fills.
- **Blue Midtone** (#BFDBFE / rgba(0,82,255,0.30) in dark): Used for card-hover borders and elevated shadow tint.

### Semantic

- **Secure Green** (#059669 / #34D399 in dark): Positive balances, settlement confirmations, success states.
- **Alert Red** (#DC2626 / #F87171 in dark): Negative balances, destructive actions, error states.
- **Caution Amber** (#F59E0B / #FBBF24 in dark): Warnings, pending states.

### Neutral — Light Mode

- **Pure White** (#FFFFFF): Primary surface — cards, modals, input backgrounds.
- **Cool Breeze** (#F8F9FC): Page background. A whisper-cool near-white (chroma barely above zero toward blue). Warmth lives in typography and accent, not the canvas.
- **Soft Cloud** (#F1F4F9): Secondary surface — hover rows, skeleton shimmer base, ghost button hover.
- **Subtle Stone** (#E8ECF3): Tertiary surface — skeleton shimmer peak, pressed states.
- **Deep Ink** (#0F172A): Body text. A near-black with a hint of navy, reaching ≥12:1 contrast against Pure White.
- **Soft Slate** (#64748B): Secondary text, placeholder text. ≥4.5:1 against Pure White.
- **Muted Silver** (#94A3B8): Tertiary text, timestamps, metadata.
- **Fine Line** (#E2E8F0): Borders, dividers, card strokes.

### Neutral — Dark Mode

- **Midnight** (#0F0F0F): Page background. A true near-black at L ~0.06, chroma 0.
- **Dark Glass** (#1A1A1A): Primary surface — cards, modals, inputs.
- **Shadow** (#242424): Secondary surface — hover states.
- **Deep Slate** (#2E2E2E): Tertiary surface — pressed states.
- **Bright Paper** (#F8F8F8): Body text — a warm off-white at full brightness.
- **Soft Pewter** (#A0A0A0): Secondary text.
- **Matte Grey** (#666666): Tertiary text.

### Named Rules

**The One Voice Rule.** Confidence Blue is the only accent. It appears on primary CTAs, links, and focus indicators — never as decorative fill or background gradient. Its presence means "interact here."

**The Cold Canvas Rule.** The page background in light mode (Cool Breeze, #F8F9FC) is not warm. It leans perceptibly cool. Warmth — the "friendly" in the North Star — is carried by the DM Sans typeface, the 14px corner radius, the spring easing, and the emoji category badges. Not by beige or cream.

## 3. Typography

**Display Font:** DM Sans (Google Fonts, variable weight 300–700)
**Body Font:** DM Sans (same family, single-family system)
**Label / Mono Font:** Space Mono (Google Fonts, weights 400, 700)

**Character:** A single-family system (DM Sans) keeps the interface calm and coherent. Its humanist warmth — slightly open apertures, gentle curves — carries the "friendly" brand personality without decorative fonts. Space Mono provides a crisp counterpoint for numbers, currency, and mono-spaced data — the "vault" precision.

### Hierarchy

- **Display** (700, clamp(1.5rem, 4vw, 2rem), 1.1): Page-level headings (Dashboard title). `text-wrap: balance`.
- **Headline** (700, 1.125rem, 1.2): Section headings ("Your Groups", "Recent Activity").
- **Title** (700, 1rem, 1.3): Card titles, modal headers, group names.
- **Body** (400, 0.9375rem, 1.5): Standard reading text. Cap line length at 65–75ch.
- **Label** (500, 0.875rem, 1.4): Buttons, form labels, table cells.
- **Caption** (500, 0.75rem, 1.3): Badges, timestamps, metadata.
- **Mono** (Space Mono, 400, 0.875rem): Monetary amounts, wallet addresses, settlement values.

### Named Rules

**The Numbers Rule.** All currency amounts, balances, and token values use Space Mono. Numbers are the source of truth; mono weight and spacing make them fast to scan and impossible to misread.

## 4. Elevation

Structural elevation. Surfaces are flat at rest — no ambient shadows. Depth appears only as a response to interaction: hover states, focus, active press. This reinforces the tactile philosophy: every shadow is earned by user action.

### Shadow Vocabulary

- **sm** (`box-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)` / dark: `0 1px 3px rgba(0,0,0,0.30), 0 1px 2px rgba(0,0,0,0.24)`): Default card state. Barely perceptible — enough to lift the card off the page background without suggesting depth.
- **elevated** (`box-shadow: 0 8px 25px rgba(0,82,255,0.08), 0 2px 8px rgba(0,0,0,0.06)` / dark: `0 8px 25px rgba(0,82,255,0.12), 0 2px 8px rgba(0,0,0,0.20)`): Card hover state. Tinted blue to signal actionability. The primary hue in the shadow reinforces the brand connection.
- **md** (`box-shadow: 0 4px 16px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)`): Modal, dropdown, floating elements.
- **lg** (`box-shadow: 0 12px 32px rgba(15,23,42,0.1), 0 4px 12px rgba(15,23,42,0.06)`): Toast notifications, elevated modals.

### Named Rules

**The Earned Shadow Rule.** No shadows at rest. Cards, buttons, and surfaces are flat until the user interacts. Hover earns a lifted shadow; active press earns a scale-down. Every shadow is a response, not decoration.

## 5. Components

### Buttons

- **Shape:** Gently rounded (8px radius). Modest internal padding (10px 20px default). Spring easing on all transitions.
- **Primary:** Confidence Blue (#0052FF) fill, white text, weight 600. Hover: elevated blue-tinted shadow (`var(--blue-shadow)`), no lift. Active: scale(0.97). Disabled: 50% opacity, no hover.
- **Tactile behavior:** On hover, shadow appears. On press, button scales down (0.97) with instant transition (0.05s). The combination of spring-up hover and quick press-down gives physical feedback without bounciness.
- **Secondary:** White fill, 1.5px Fine Line border, Deep Ink text (weight 500). Hover: border shifts to Confidence Blue, text shifts to blue. Active: scale(0.97). Signals "important but not primary."
- **Ghost:** Transparent, Soft Slate text (weight 500). Hover: Soft Cloud background. For toolbar and tertiary actions.
- **Danger:** Alert Red fill, white text (weight 600). Hover: brightness(1.15) with red-tinted shadow. For destructive confirmations.

### Cards

- **Corner Style:** Generous rounded corners (14px radius).
- **Background:** Pure White (light) / Dark Glass (dark).
- **Shadow Strategy:** Flat at rest (sm shadow). On hover: elevates with blue-tinted shadow (elevated) and 3px translateY lift.
- **Border:** 1px solid Fine Line. On hover: border shifts to blue-mid.
- **Internal Padding:** 24px default (spacious but not wasteful).
- **Transition:** 0.25s spring ease on shadow, transform, and border. Active press: instant return to flat.

### Inputs / Fields

- **Style:** Fine Line border (1.5px), Pure White fill, 8px radius. Internal padding: 10px 14px.
- **Focus:** Border shifts to Confidence Blue, 3px blue-tinted focus ring (`var(--focus-ring)`).
- **Placeholder:** Soft Slate (#64748B) — must achieve ≥4.5:1 contrast.
- **Error (`:user-invalid`):** Border shifts to Alert Red, with red-tinted focus ring.
- **Disabled:** Muted fill, reduced opacity.

### Badges / Chips

- **Style:** Pill shape (999px radius), 4px 10px padding. Filled background with matching text.
- **Currency badges:** Confidence Blue light background + Confidence Blue text.
- **Demo badges:** Same pattern, distinct via star icon prefix.
- **Category badges:** Emoji + text in colored chip (per-category background/text tint).

### Navigation (Navbar)

- **Style:** Fixed top, translucent background (30% opacity white in light, 45% opacity midnight in dark) with backdrop blur. 1px bottom border.
- **Contains:** App name, theme toggle (light/dark), wallet connect button (with address truncation), notification bell (with unread badge), profile link.
- **Mobile:** Same elements, stacked or icon-only treatment at ≤640px.

### Modal Backdrop

- **Style:** Semi-transparent overlay (deep-ink at 62% in light, pure black at 76% in dark). Click-to-dismiss.
- **Content:** Scale-in entrance (0.96 → 1) with spring easing (0.35s).
- **Close:** 32×32 icon button on Soft Cloud background, positioned top-right.

### Skeleton / Loading

- **Style:** Shimmer animation — linear gradient sweeping from Soft Cloud through Subtle Stone and back, at 1.5s cycle. 6px border radius.

## 6. Do's and Don'ts

### Do:

- **Do** use Confidence Blue (#0052FF) sparingly — on primary actions, links, and focus indicators only. Its rarity makes it meaningful.
- **Do** use Space Mono for all monetary amounts, wallet addresses, and numeric data — numbers are the source of truth.
- **Do** keep the page background cool (Cool Breeze #F8F9FC in light, Midnight #0F0F0F in dark) — warmth comes from typography and interactions, not the canvas.
- **Do** spring easing (`var(--ease-spring)`) on interactive transitions — hover, focus, press feedback.
- **Do** use `scale(0.97)` on active press with instant duration (0.05s) — tactile feedback without bounciness.
- **Do** test body text contrast at ≥4.5:1. Deep Ink (#0F172A) on Pure White (#FFFFFF) exceeds 12:1.
- **Do** respect reduced motion — all animations collapse to instant (0.01ms) via `prefers-reduced-motion`.

### Don't:

- **Don't** use gradient text (`background-clip: text` with gradient) — decorative emphasis is never worth the readability cost.
- **Don't** use side-stripe borders (border-left > 1px colored) on cards, list items, or callouts — use full borders or background tints instead.
- **Don't** add ambient shadows at rest. Cards are flat until hover — every shadow is earned by interaction.
- **Don't** pair two geometric sans-serifs or two humanist sans-serifs. DM Sans is the only face; Space Mono is the contrast.
- **Don't** use glassmorphism (blurred backgrounds, frosted glass effects) as default styling.
- **Don't** use tiny uppercase tracked eyebrows ("OVERVIEW", "FEATURES") above sections — this is a product app, not a landing page.
- **Don't** hard-code colors that exist as design tokens — use `var(--blue)`, `var(--surface)`, etc. Existing CSS custom properties cover the full palette.
- **Don't** animate layout properties (width, height, top, left, margin, padding). Stick to transform and opacity for smooth 60fps motion.
