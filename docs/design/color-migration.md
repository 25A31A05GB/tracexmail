# Color Token Migration & Consolidation Specification

Governed by **Design Prompt D** and **Prompt 1: Tokens, fonts and token enforcement**.

## Executive Summary
Prior to this migration, the codebase contained **6,361** occurrences of arbitrary hex values with over 200 distinct near-identical color variations (notably 14 variations of warm charcoal/black, 8 variations of navy, and diverse ad-hoc tints). 

This specification establishes the strict token hierarchy for TraceXMail's international enterprise security redesign and provides the authoritative mapping table from legacy hex codes to design tokens.

---

## 1. Design Token System

All components must strictly utilize these tokens (exposed as CSS custom properties and Tailwind utilities) instead of arbitrary hex literals:

### Surfaces
| Token | CSS Variable | Hex Value | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `surface.page` | `--color-surface-page` | `#100e0c` | Viewport canvas background, root body, full-height views |
| `surface.section` | `--color-surface-section` | `#14110d` | Major content sections, toolbars, drawers, dialog panels |
| `surface.card` | `--color-surface-card` | `#171410` | Cards, metric tiles, table rows, input fields, popovers |

### Borders & Elevation
| Token | CSS Variable | Value | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `border.default` | `--color-border` | `#3a352c` | Standard 1px divider, container boundaries, table row borders |
| `border.subtle` | `--color-border-subtle` | `rgba(58, 53, 44, 0.5)` | Internal cell dividers, secondary group separators |
| `border.focus` | `--color-border-focus` | `#c9a227` | Keyboard focus-visible rings (AA contrast compliant) |
| `elevation.level1` | `--elevation-1` | `0 4px 12px rgba(0,0,0,0.4)` | Floating menus, dropdowns, tooltips |
| `elevation.level2` | `--elevation-2` | `0 12px 32px rgba(0,0,0,0.6)` | Modals, sheets, drawers |
| `elevation.anomalyGlow` | `--elevation-anomaly-glow` | `0 0 16px rgba(201,162,39,0.2)` | Single allowed screen highlight for anomalies |

### Typography
| Token | CSS Variable | Hex Value | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `text.primary` | `--color-text-primary` | `#ede6d8` | Headings, primary labels, table data, active values |
| `text.muted` | `--color-text-muted` | `#8a8070` | Captions, timestamps, metadata labels, placeholders |
| `text.secondary` | `--color-text-secondary` | `#94a3b8` | Supporting body paragraphs, helper text, explanations |
| `text.inverse` | `--color-text-inverse` | `#100e0c` | Text placed directly on solid accent gold elements |

### Accent Gold (Strict Discipline: Primary Button, Active Nav, Max 1 Highlight / Screen)
| Token | CSS Variable | Value | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `accent.gold` | `--color-accent-gold` | `#c9a227` | Primary action button, active sidebar item, key anomaly tag |
| `accent.goldHover` | `--color-accent-gold-hover` | `#dec052` | Primary button interactive hover state |
| `accent.goldMuted` | `--color-accent-gold-muted` | `rgba(201,162,39,0.12)` | Subtle active navigation indicator, warning badge background |
| `accent.goldBorder` | `--color-accent-gold-border` | `#5e4710` | Accent badge border, warning card border |

### Semantic Forensics Colors
| Semantic Domain | Solid Accent | Subtle Background | Border Color | Forensic Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **Verified** | `#48a975` | `rgba(72, 169, 117, 0.12)` | `#275c3f` | Authentic SPF/DKIM/DMARC pass, legitimate sender, clean email |
| **Anomaly** | `#c9a227` | `rgba(201, 162, 39, 0.12)` | `#5e4710` | Header mismatch, delay spike, suspicious lookalike domain |
| **Alert** | `#b23a2e` | `rgba(178, 58, 46, 0.12)` | `#5a1e17` | Phishing verdict, malware attachment, credential harvesting |
| **Destination** | `#8c58b0` | `rgba(140, 88, 176, 0.12)` | `#432a54` | Final mailbox delivery, relay transition, MTA recipient |
| **Intelligence** | `#2dd4bf` | `rgba(45, 212, 191, 0.12)` | `#134e4a` | Threat intel provenance, IOC match, VirusTotal/Shodan enrichment |

---

## 2. Legacy Hex Mapping Table

### Consolidated Warm Blacks & Dark Surfaces
The 5 legacy near-identical warm blacks and navy surfaces are consolidated into the 3 canonical surfaces:

| Legacy Hex Value | Occurrence Count in Codebase | Canonical Replacement Token | Replacement Variable / Class |
| :--- | :--- | :--- | :--- |
| `#100e0c` | 44 | `surface.page` | `var(--color-surface-page)` / `bg-[#100e0c]` |
| `#14120f` | 338 | `surface.page` / `surface.section` | `var(--color-surface-page)` (if root) / `var(--color-surface-section)` |
| `#14110d` | 50 | `surface.section` | `var(--color-surface-section)` |
| `#181511` | 28 | `surface.section` | `var(--color-surface-section)` |
| `#171410` | 16 | `surface.card` | `var(--color-surface-card)` |
| `#16130f` | 47 | `surface.card` | `var(--color-surface-card)` |
| `#1a1712` | 26 | `surface.card` | `var(--color-surface-card)` |
| `#1d1a15` | 33 | `surface.card` | `var(--color-surface-card)` |
| `#1f1a14` | 25 | `surface.card` | `var(--color-surface-card)` |
| `#221e17` | 67 | `surface.card` | `var(--color-surface-card)` |
| `#26221b` | 24 | `surface.card` | `var(--color-surface-card)` |
| `#28241c` | 5 | `surface.card` | `var(--color-surface-card)` |
| `#050B14` (navy) | 4 | `surface.section` | `var(--color-surface-section)` (`#14110d`) |
| `#1b2b46` (navy) | 1 | `border.default` | `var(--color-border)` (`#3a352c`) |
| `#1b2b44` (navy) | 28 | `border.default` | `var(--color-border)` (`#3a352c`) |

### Borders & Outlines
| Legacy Hex Value | Occurrence Count | Canonical Replacement Token |
| :--- | :--- | :--- |
| `#3a352c` | 312 | `border.default` (`var(--color-border)`) |
| `#332c23` | 14 | `border.default` (`var(--color-border)`) |
| `#2e2922` | 7 | `border.default` (`var(--color-border)`) |
| `#2d271f` | 41 | `border.default` (`var(--color-border)`) |
| `#262118` | 26 | `border.default` (`var(--color-border)`) |
| `#383025` | 15 | `border.default` (`var(--color-border)`) |
| `#4a4438` | 5 | `border.default` (`var(--color-border)`) |
| `#574f42` | 15 | `border.default` (`var(--color-border)`) |

### Light & Neutral Typography
| Legacy Hex Value | Occurrence Count | Canonical Replacement Token |
| :--- | :--- | :--- |
| `#ede6d8` | 610 | `text.primary` (`var(--color-text-primary)`) |
| `#ffffff` | 17 | `text.primary` (`var(--color-text-primary)`) |
| `#faf7f2` | 1 | `text.primary` (`var(--color-text-primary)`) |
| `#f5f0e6` | 2 | `text.primary` (`var(--color-text-primary)`) |
| `#f4efe6` | 24 | `text.primary` (`var(--color-text-primary)`) |
| `#d6cebf` | 2 | `text.primary` (`var(--color-text-primary)`) |
| `#94a3b8` | 54 | `text.secondary` (`var(--color-text-secondary)`) |
| `#8a8070` | 89 | `text.muted` (`var(--color-text-muted)`) |
| `#b9af9c` | 215 | `text.secondary` (`var(--color-text-secondary)`) |
| `#8e8574` | 35 | `text.muted` (`var(--color-text-muted)`) |
| `#9c9186` | 12 | `text.muted` (`var(--color-text-muted)`) |

### Accents & Semantic Status Colors
| Legacy Hex Value | Occurrence Count | Canonical Replacement Token |
| :--- | :--- | :--- |
| `#c9a227` | 340 | `accent.gold` (`var(--color-accent-gold)`) |
| `#dec052` | 1 | `accent.goldHover` (`var(--color-accent-gold-hover)`) |
| `#eed885` | 1 | `accent.gold` (`var(--color-accent-gold)`) |
| `#b23a2e` | 210 | `semantic.alert.solid` (`var(--color-semantic-alert)`) |
| `#c94a3d` | 16 | `semantic.alert.solid` (`var(--color-semantic-alert)`) |
| `#ef4444` | 35 | `semantic.alert.solid` (`var(--color-semantic-alert)`) |
| `#f87171` | 12 | `semantic.alert.text` (`#f1a39b`) |
| `#f1a39b` | 1 | `semantic.alert.text` (`#f1a39b`) |
| `#48a975` | 180 | `semantic.verified.solid` (`var(--color-semantic-verified)`) |
| `#4ade80` | 49 | `semantic.verified.solid` (`var(--color-semantic-verified)`) |
| `#10b981` | 32 | `semantic.verified.solid` (`var(--color-semantic-verified)`) |
| `#8c58b0` | 45 | `semantic.destination.solid` (`var(--color-semantic-destination)`) |
| `#a855f7` | 3 | `semantic.destination.solid` (`var(--color-semantic-destination)`) |
| `#2dd4bf` | 18 | `semantic.intelligence.solid` (`var(--color-semantic-intelligence)`) |
| `#38bdf8` | 22 | `semantic.intelligence.solid` (`var(--color-semantic-intelligence)`) |
| `#7fa3ba` | 26 | `semantic.intelligence.border` / `text.secondary` |

---

## 3. Deliberate Exceptions
The following cases are marked as deliberate exceptions and are cataloged in `scripts/design-token-allowlist.json`:
1. **Third-Party Identity & SSO Brand Colors**:
   - Google Identity Button (`#4285F4`, `#34A853`, `#FBBC05`, `#EA4335`) — Mandated by Google Identity Branding Guidelines.
   - Microsoft 365 (`#00A4EF`, `#0078D4`) — Provider integration card icons.
2. **Deterministic Hash Visualization & Color Coding**:
   - Bit-exact sha256 byte color-coding in RFC 822 forensic raw header byte streams.
3. **Forensic PDF Dossier Export Engine**:
   - Pure black (`#000000`) and pure white (`#FFFFFF`) required for CMYK printing parity in `pdfDossierGenerator.ts`.
