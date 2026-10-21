# TraceXMail Enterprise Design System

The TraceXMail Design System establishes an international, high-fidelity design architecture for the TraceXMail email forensics and investigative intelligence platform.

It is strictly governed by **Prompt 0** (Engineering Rules) and **Design Prompt D** (Design Rules).

---

## Architecture: The 5 Layers

TraceXMail follows a strict 5-layer component architecture. Dependencies flow strictly downward: higher layers consume lower layers, never the reverse.

```
┌──────────────────────────────────────────────┐
│ Layer 5: Pages & Domain Views                │  (src/components/*)
│ Forensics Workspace, Auth, Intel, Audit      │
├──────────────────────────────────────────────┤
│ Layer 4: Templates & Layout Shells           │  (src/design-system/templates/*)
│ AppShell, ForensicsLayout, AuthLayout        │
├──────────────────────────────────────────────┤
│ Layer 3: Forensic UI Patterns                │  (src/design-system/patterns/*)
│ MetricCard, AnomalyHighlight, HopTimeline    │
├──────────────────────────────────────────────┤
│ Layer 2: Headless Primitives & Atoms         │  (src/design-system/primitives/*)
│ Button, Input, Modal, Badge, Tooltip, Select │
├──────────────────────────────────────────────┤
│ Layer 1: Design Tokens                       │  (src/design-system/tokens/*)
│ Colors, Typography, Spacing, Radii, Motion   │
└──────────────────────────────────────────────┘
```

### Layer 1: Design Tokens (`src/design-system/tokens/`)
The foundational constants representing atomic visual decisions.
- **Colors** (`colors.ts`, `tokens.css`):
  - **Surfaces**: Canvas/Page (`#100e0c`), Section/Drawer (`#14110d`), Card/Row (`#171410`).
  - **Borders**: 1px dividers (`#3a352c`), Subtle (`rgba(58, 53, 44, 0.5)`), Focus (`#c9a227`).
  - **Text**: Primary (`#ede6d8`), Muted (`#8a8070`), Secondary (`#94a3b8`), Inverse (`#100e0c`).
  - **Accent Gold** (`#c9a227`): Reserved strictly for primary action buttons, active navigation items, and at most one highlighted anomaly per screen.
  - **Semantic Forensics Colors**:
    - **Verified** (`#48a975`): SPF/DKIM/DMARC pass, legitimate sender, authentic header.
    - **Anomaly** (`#c9a227`): Suspicious routing, timestamp drift, header inconsistency.
    - **Alert** (`#b23a2e`): Phishing verdict, malicious payload, quarantined message.
    - **Destination** (`#8c58b0`): Relay hops, mailbox handover, MX recipient.
    - **Intelligence** (`#2dd4bf`): Threat intel enrichment, VirusTotal/Shodan/AbuseIPDB IOC matches.
- **Typography** (`typography.ts`):
  - Headings: `Source Serif 4` (self-hosted via `@fontsource/source-serif-4`, serif).
  - Body & UI: `IBM Plex Sans` (self-hosted, sans-serif).
  - Technical / Forensics Data: `JetBrains Mono` (IP addresses, hashes, RFC 822 headers).
  - Scale: `12px` (caption), `14px` (body-sm), `16px` (body-base), `20px` (subheading), `28px` (h2), `40px` (h1). Tabular numerals (`tnum`) applied across all metrics.
- **Spacing** (`spacing.ts`): 4px base with an 8px rhythm (4, 8, 12, 16, 24, 32, 48, 64px).
- **Radii** (`radii.ts`): 6px (inputs, badges), 10px (cards, popovers), 14px (modals, drawers).
- **Motion** (`motion.ts`): 150ms (micro-interactions), 250ms (menus/dropdowns), 400ms (drawers/modals); single cubic-bezier easing `cubic-bezier(0.16, 1, 0.3, 1)`; strict adherence to `prefers-reduced-motion`.

### Layer 2: Headless Primitives (`src/design-system/primitives/`)
Built with Radix UI headless components, Tailwind utility classes, `class-variance-authority`, and `clsx`.
- Completely keyboard operable (WAI-ARIA compliant).
- Handles focus rings (`ring-[#c9a227]`), disabled states, and responsive touch targets (minimum 44x44px).
- Zero arbitrary Tailwind bracket values.

### Layer 3: Forensic Patterns (`src/design-system/patterns/`)
Domain-specific composite components composed from Layer 2 primitives:
- `MetricCard`: Single stat tile with label, value, trend, and tooltip ("what this means").
- `AnomalyHighlight`: Single anomaly focal point per screen with subtle glow.
- `HopTimeline`: Interactive hop-by-hop email MTA traversal sequence.
- `StatusIndicator`: Verified, anomaly, alert, destination, intelligence badges.
- `StateViews`: Standardized Skeleton loading, Empty state, Error state, and Partial-data fallback.

### Layer 4: Layout Templates (`src/design-system/templates/`)
Responsive layout shells managing viewport composition across breakpoints (360px, 768px, 1280px, 1920px):
- Top navigation with active gold indicator.
- Collapsible inspection drawer with accessible focus trap.
- Content grid with fixed 8px rhythmic gutters.

### Layer 5: Pages (`src/components/`)
Concrete product screens connected to forensic analysis APIs and application state.

---

## Design Enforcement Rules

1. **No Arbitrary Hex Literals**: No `#[0-9a-fA-F]{3,8}` in components. Use tokens or CSS variables.
2. **No Arbitrary Tailwind Brackets**: Disallowed: `w-[13px]`, `text-[#...]`, `p-[17px]`. Allowed: standard Tailwind spacing scales or token variables like `bg-[var(--color-surface-card)]`.
3. **Gold Accent Budget**: Maximum **one** gold anomaly highlight per screen; gold buttons are reserved for the single primary call-to-action.
4. **Information Architecture Order**: Answer first → Evidence → Detail → Raw RFC 822 data.
5. **Mandatory States**: Every forensic view must provide Loading (Skeleton), Empty, Error, and Partial-Data states.
6. **Token Verification CI**:
   Run `npm run test:tokens` to verify adherence against `scripts/design-token-allowlist.json`. Any new arbitrary values fail the build immediately.
