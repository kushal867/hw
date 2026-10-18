# EduSathi design system

Principle: calm, student-friendly, one clear primary action per screen. Built from tokens → primitives → patterns.

## Tokens (`src/app/globals.css`, `tailwind.config.ts`)
| Token | Value | Use |
|---|---|---|
| Brand | indigo `#4f46e5` → violet `#7c3aed` | primary actions, active states, gradients |
| Ink / muted | slate-900 / `#526075` (≥ 6:1 on canvas) | text; never use lighter greys for text |
| Canvas / surface | `#f6f7fb` / white | page / cards |
| Radius | card 16px, control 12px, pill 999px | consistent rounding |
| Content tones | files = indigo, discussions = sky, questions = amber, members = emerald | `IconTile`, always the same colour per content type |
| Group identity | 8 deterministic gradients from the group id | `GroupAvatar`, cover banners |

Type: Inter (+ Noto Sans Devanagari for Nepali). Headings are extrabold with slight negative tracking; body 15px / 1.6.

## Primitives
`.btn-primary | -secondary | -ghost | -danger | .btn-lg`, `.input` (44px min height), `.badge[-muted|-success|-warn|-danger]`, `.card[.card-hover]`, `.eyebrow`, `.bg-hero`.
Components: `GroupAvatar`, `Avatar`, `IconTile`, `EmptyState`, `PageHeader`, `SectionTitle`, `Pagination`, `ActionForm` (toasts, pending state, confirmation).

## Patterns
- **App shell:** sidebar with *Your groups* (desktop), top bar with search / notifications / account menu, bottom bar with a centre **Create** button (phone).
- **Group workspace:** cover + identity header, tabs with live counts, Overview = activity feed + About + Members.
- **Lists:** feed cards with avatar, author, time, colour-coded category; row actions in a `<details>` overflow menu (keyboard accessible, no JS).
- **Forms:** one primary action; optional panels collapse (`Upload a PDF`, `Start a discussion`); drop zone for files.
- **States:** every list has a loading skeleton (`loading.tsx`), a friendly empty state with a next step, and an error state.

## Accessibility (verified)
`npm run audit:a11y` runs axe-core (WCAG 2.1 A/AA) over the main screens at desktop and phone width: **0 violations** at the time of the redesign.
Rules we follow: text contrast ≥ 4.5:1 (never `slate-400` for text), links inside text are underlined, interactive controls ≥ 40px, visible focus ring,
accessible names contain their visible text, no `<dl>` unless `dt`/`dd` are direct children, reduced-motion respected.
