# Roadmap

## Current Goal

Keep the shipped PRD flow (discovery → plan → draft → decisions → refine → review pass → export)
reliable for the internal team, and choose the next improvement track.

## Next Decision

Which track comes next? Candidates come from deferred items in shipped specs and recorded `shortcut:`
debt; none is committed to.

## Candidate Tracks

1. **Targeted escalation apply** — today the user answers review escalations and presses *Buat ulang*
   to re-draft everything; a per-section apply was deferred
   (`docs/superpowers/specs/2026-11-13-prd-review-pass-design.md`).
2. **Review pass hardening** — validate Tier 2 rule citations against the plan's Non-Goals/decisions
   instead of trusting them (`lib/review.ts:127`).
3. **Keep unsaved decision edits when a review lands** (`components/decision-panel.tsx:48`).
4. **Richer review** — multi-lens reviewers or a review→fix→re-review loop (approaches B/C, deferred).
5. **Design-source cleanup** — reconcile `design-system/specly/MASTER.md` with the shipped UI
   (see [sources/design-brief.md](sources/design-brief.md)).

## Next Steps

1. Decide whether `MASTER.md` or the shipped `app/globals.css` is the design source of truth, and
   update the loser.
2. Add the missing Elephant/Goldfish row to `docs/superpowers/README.md` (docs fast path).
3. Pick one candidate track and create `wiki/plans/features/<name>.md` (or `maintenance/`).

## Deferred

- Streaming the review pass (currently one non-streamed JSON call; `app/api/prd/review/route.ts:12`).
- Multi-replica deploy: blocked by design — SQLite is single-writer; K8s runs one replica.
- Non-PRD document packs: the product pivoted to PRD-only on 2026-11-05.
