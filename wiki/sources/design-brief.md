# Design Brief

## Status

- Last reviewed: 2026-11-19
- Evidence basis: implementation (`app/globals.css`, `app/layout.tsx`, `components/`) +
  `design-system/specly/MASTER.md` + shipped UI specs in `docs/superpowers/specs/`
- Confidence: medium
- Known gaps: `MASTER.md` contradicts the shipped visual system (see Contradiction); no reference
  screenshots.

## Product Surface

A document-first editor for non-IT users: project list, auth pages (`/masuk`, `/daftar`), admin user
management, settings dialog, and the project editor (discovery card → draft progress → 12 sections +
`DecisionPanel` → review result → export).

## Interface Principles

- Plain Indonesian copy a non-IT user can act on; no jargon without a verb. Proper nouns
  ("Elephant", "Goldfish") appear only as captions, never as button labels.
- Every AI wait shows progress: rotating phase labels (`AiTyping`), spinners on busy buttons, a
  remaining-time estimate during drafting. Loading must never look stuck.
- Recommendation-first: every discovery question and decision shows a suggested option.
- Every AI change is reviewable and reversible (review fixes are undoable; edits are direct).
- Keep the common case quiet (e.g. no extra noise when a review finds nothing to decide).

## Visual System (as shipped)

- Tokens in `app/globals.css` (Tailwind 4 `@theme`): background `#f8fafc`, foreground `#1e293b`,
  primary `#2563eb`, accent `#dbeafe`/`#1e40af`, radius `0.5rem`; full dark theme via `.dark` +
  `next-themes`.
- Font: Plus Jakarta Sans (sans + heading), Geist Mono for code (`next/font/google`).
- Primitives: `@base-ui/react` + shadcn-style `components/ui/`; icons `lucide-react`; toasts `sonner`.
- Captions: `text-xs text-muted-foreground`.

## Contradiction

`design-system/specly/MASTER.md` (generated 2026-10-15, category "Subscription Box Service") specifies
fuchsia `#D946EF` / orange `#EA580C`, Rubik + Nunito Sans, "Vibrant & Block-based" style, and a funnel
page pattern. None of that is in the shipped UI. Until resolved, follow the shipped tokens above for
colors and fonts, and keep using MASTER.md's **forbidden patterns and pre-delivery checklist**, which
the shipped specs still cite and which fit the product.

## Interaction Patterns

- Discovery: one question per turn with option chips + free text.
- Draft: SSE-streamed per-section progress, sections saved as each finishes.
- Decisions: collapsed list with `Rekomendasi:`, editable inline or rewritten by one AI instruction.
- Review: result card with fix count, undo per fix, **Lihat Keputusan** scroll to the decisions panel.
- Destructive or costly actions (re-draft, review over dirty sections) ask for confirmation.

## Responsive And Accessibility Expectations

From MASTER.md's checklist: no emoji icons, `cursor-pointer` on clickables, 150–300 ms transitions,
4.5:1 text contrast, visible focus states, `prefers-reduced-motion` respected (including scroll
jumps), no horizontal scroll, check 375 / 768 / 1024 / 1440 px.

## Validation

Run the app (`npm run dev`) and exercise the changed flow in a browser, in light and dark mode, at
mobile and desktop widths, then walk the checklist above.

## Unknowns

- Which design source wins (MASTER.md vs shipped tokens) — a user decision.
- Whether per-page overrides (`design-system/pages/*.md`, referenced by MASTER.md) are intended; none exist.
