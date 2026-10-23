# Color Token Migration & Consolidation Specification

Governed by **Design Prompt D2** and **Prompt 1c: Palette migration to homepage-only colors**.

## Executive Summary
This specification defines the strict, unified D2 color palette for TraceXMail's international enterprise security redesign. The application uses **strictly and exclusively** the homepage palette (warm charcoal surfaces, cream text, gold accent, brick red alert, orange anomaly, green verified, and stone neutral information).

All instances of teal, cyan, violet, purple, blue, emerald, and slate have been removed or re-mapped.

---

## 1. Authoritative D2 Token Hierarchy

### Surfaces
| Token | CSS Variable | Hex Value | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `surface.page` | `--color-surface-page` | `#100e0c` | Viewport canvas background, root body, full-height views |
| `surface.section` | `--color-surface-section` | `#14110d` | Major content sections, toolbars, drawers, dialog panels |
| `surface.card` | `--color-surface-card` | `#171410` | Cards, metric tiles, table rows, input fields, popovers |
| `surface.raised` | `--color-surface-raised` | `#1d1a15` | Hover states, raised popovers, elevated menus only |

### Borders & Elevation
| Token | CSS Variable | Value | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `border.default` | `--color-border` | `#3a352c` | Standard 1px divider, container boundaries, table row borders |
| `border.subtle` | `--color-border-subtle` | `rgba(58, 53, 44, 0.5)` | Internal cell dividers, secondary group separators |
| `border.focus` | `--color-border-focus` | `#c9a227` | Keyboard focus-visible rings (AA contrast compliant) |
| `elevation.level1` | `--elevation-1` | `0 4px 12px rgba(0,0,0,0.4)` | Floating menus, dropdowns, tooltips (no glow effects) |
| `elevation.level2` | `--elevation-2` | `0 12px 32px rgba(0,0,0,0.6)` | Modals, sheets, drawers |

### Typography
| Token | CSS Variable | Hex Value | Contrast on Dark | Purpose / Usage |
| :--- | :--- | :--- | :--- | :--- |
| `text.primary` | `--color-text-primary` | `#ede6d8` | > 14:1 (AAA) | Headings, primary labels, table data, active values |
| `text.secondary` | `--color-text-secondary` | `#b9af9c` | > 8:1 (AA) | Supporting body paragraphs, stone labels, explanations |
| `text.muted` | `--color-text-muted` | `#8e8574` | > 4.5:1 (AA) | Captions, timestamps, metadata labels, placeholders |
| `text.inverse` | `--color-text-inverse` | `#100e0c` | > 8:1 (AA) | Text placed directly on solid accent gold elements |

### Brand & Primary Action (Gold: strictly primary button, active nav, focus rings, max 1 highlight/screen)
| Token | CSS Variable | Value | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `accent.gold` | `--color-accent-gold` | `#c9a227` | Primary action button, active nav item, key anomaly tag |
| `accent.goldHover` | `--color-accent-gold-hover` | `#d8b035` | Primary button interactive hover state |
| `accent.goldMuted` | `--color-accent-gold-muted` | `rgba(201, 162, 39, 0.12)` | Subtle active navigation indicator |
| `accent.goldBorder` | `--color-accent-gold-border` | `#5e4710` | Accent badge border, warning card border |

### Semantic Forensics Status Colors (D2 Palette)
| Semantic Domain | Solid Accent | Subtle Background | Border Color | Text Color | Forensic Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Verified** | `#22c55e` | `rgba(34, 197, 94, 0.12)` | `#2e7a4a` | `#4ade80` | Authentic SPF/DKIM/DMARC pass, legitimate sender, clean |
| **Anomaly** | `#f97316` | `rgba(249, 115, 22, 0.12)` | `#9a3412` | `#fb923c` | Header mismatch, delay spike, suspicious lookalike domain (orange, distinct from gold) |
| **Alert** | `#b23a2e` | `rgba(178, 58, 46, 0.12)` | `#b23a2e` | `#ff8d7d` | Phishing verdict, malware, credential theft (**#ff8d7d for 4.5:1 AA text contrast**) |
| **Information** | `#b9af9c` | `rgba(185, 175, 156, 0.12)` | `#3a352c` | `#b9af9c` | Neutral info, relay MTA hops, threat intel provenance (**stone outline + icon**) |

---

## 2. Comprehensive Legacy Hex Mapping Table

### Warm Blacks & Dark Surfaces
| Legacy Hex Value | Canonical Replacement Token | Replacement Variable / Class |
| :--- | :--- | :--- |
| `#100e0c`, `#0e0c0a` | `surface.page` | `var(--color-surface-page)` / `bg-[#100e0c]` |
| `#14110d`, `#14120f`, `#13110e`, `#16130f`, `#181511` | `surface.section` | `var(--color-surface-section)` / `bg-[#14110d]` |
| `#171410`, `#1a1712`, `#1b1814`, `#1f1a14`, `#221e17` | `surface.card` | `var(--color-surface-card)` / `bg-[#171410]` |
| `#242019`, `#24201a`, `#26221b`, `#28241c`, `#2d261e` | `surface.card` | `var(--color-surface-card)` / `bg-[#171410]` |
| `#1d1a15`, `#2b251d`, `#2f2a21`, `#1c1813` | `surface.raised` | `var(--color-surface-raised)` / `bg-[#1d1a15]` |
| Navies (`#050b14`, `#0b0d12`, `#121820`, `#182330`, `#22364a`) | `surface.section` / `surface.card` | `var(--color-surface-section)` / `var(--color-surface-card)` |

### Borders & Outlines
| Legacy Hex Value | Canonical Replacement Token |
| :--- | :--- |
| `#3a352c`, `#332c23`, `#2e2922`, `#2d271f`, `#262118`, `#383025`, `#4a4438`, `#574f42`, `#1b2b44`, `#1b2b46` | `border.default` (`#3a352c` / `var(--color-border)`) |
| `#275c3f` | `semantic.verified.border` (`#2e7a4a`) |
| `#5a1e17` | `semantic.alert.border` (`#b23a2e`) |
| `#5e4710` | `accent.goldBorder` (`#5e4710`) |
| `#432a54` (violet), `#134e4a` (teal) | `border.default` (`#3a352c`) |

### Typography
| Legacy Hex Value | Canonical Replacement Token |
| :--- | :--- |
| `#ede6d8`, `#ffffff`, `#faf7f2`, `#f5f0e6`, `#f4efe6`, `#d6cebf` | `text.primary` (`#ede6d8` / `var(--color-text-primary)`) |
| `#b9af9c`, `#94a3b8`, `#7fa3ba`, `#64748b` | `text.secondary` (`#b9af9c` / `var(--color-text-secondary)`) |
| `#8e8574`, `#8a8070`, `#9d9282`, `#9c9186`, `#6b6254` | `text.muted` (`#8e8574` / `var(--color-text-muted)`) |
| `#100e0c` (on gold) | `text.inverse` (`#100e0c` / `var(--color-text-inverse)`) |

### Accents & Semantic Status Colors
| Legacy Hex Value | Context | Canonical Replacement Token |
| :--- | :--- | :--- |
| `#c9a227`, `#dec052`, `#d8b035`, `#eed885` | Gold Accent | `accent.gold` (`#c9a227`) |
| `#b23a2e`, `#c94a3d`, `#ef4444`, `#dc2626` | Alert Fill/Border | `semantic.alert.solid` (`#b23a2e`) |
| `#b23a2e`, `#ef4444`, `#f87171`, `#fca5a5`, `#f1a39b` | Alert Text | `semantic.alert.text` (`#ff8d7d` - 4.5:1 AA contrast) |
| `#fb923c`, `#f97316`, `#ea580c`, `#f59e0b` | Anomaly/Warning | `semantic.anomaly.solid` (`#f97316`), `text` (`#fb923c`) |
| `#22c55e`, `#48a975`, `#4ade80`, `#10b981`, `#34a853` | Verified/Clean | `semantic.verified.solid` (`#22c55e`), `text` (`#4ade80`) |
| `#8c58b0`, `#a855f7`, `#c499e3` (violet) | Destination | Stone outline (`#3a352c`) + stone text (`#b9af9c`) + icon |
| `#2dd4bf`, `#319795`, `#38bdf8` (teal/blue) | Intelligence | Stone outline (`#3a352c`) + stone text (`#b9af9c`) + icon |

---

## 3. Deliberate Exceptions Allowlist
Cataloged in `scripts/design-token-allowlist.json`:
1. **Third-Party Identity & SSO Brand Colors**:
   - Google Identity Button (`#4285F4`, `#34A853`, `#FBBC05`, `#EA4335`) — Mandated by Google Identity Branding Guidelines.
   - Microsoft 365 (`#00A4EF`, `#0078D4`) — Provider integration card icon branding.
2. **Deterministic Hash Stream Visualization**:
   - Bit-exact sha256 byte color-coding in RFC 822 forensic raw header byte streams.
3. **Forensic PDF Dossier Export Engine**:
   - Pure black (`#000000`) and pure white (`#FFFFFF`) required for physical document printing in `pdfDossierGenerator.ts`.
