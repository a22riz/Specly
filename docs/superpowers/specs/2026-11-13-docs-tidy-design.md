# Docs tidy — design

## Intent

Several features have landed since the docs were last settled (most recently the PRD review
pass). Two things drifted: a handful of doc statements are now stale or contradict the code, and
`docs/superpowers/` has grown to six spec + six plan files with no entry point. This change makes
the repo's documentation tell one consistent story again and gives the process archive a
navigable index — without discarding any raw history.

This is a documentation-only change. No product code, no schema, no dependency.

## Goals

- **Fix stale / contradictory content** (see the list below), so the docs agree with each other
  and with the code.
- **Add `docs/superpowers/README.md`** — one table of features (date, name, links to spec + plan,
  status), newest first.
- **Link the archive** from `docs/index.md` and the `AGENTS.md` documentation map.

## Non-goals

- No localization — `docs/` stays English (only `README.md` and in-app copy are Indonesian).
- No moving or renaming existing spec/plan files.
- No editing of docs that are already accurate.
- No product/UX rewrite of `README.md` beyond the content fixes below.

## Anti-goals

- Breaking an existing link, or a link target that no longer resolves.
- Turning `docs/` into a changelog of code trivia.
- Deleting any raw spec or plan.

## Constraints

- `docs/` is English; user-facing copy (`README.md`, in-app) is Indonesian. This split is
  deliberate — coding agents parse English best.
- `docs/architecture.md` is the canonical map; other docs defer to it.
- Match the existing doc voice and formatting (tables, short imperative prose).
- Docs only — the whole change must be reviewable as prose.

## Approaches

Three ways to handle the archive:

| # | Shape | Trade-off |
|---|---|---|
| **1 (chosen)** | Index page `docs/superpowers/README.md`; files stay put. | Navigation + entry point, raw material kept, smallest diff. |
| 2 | One folder per feature (`<feature>/spec.md` + `plan.md`). | Tidy grouping, but 12 file moves → churn and broken links. |
| 3 | Collapse to one `docs/history.md`, delete raw specs/plans. | Most compact, but loses full rationale — bad for an agent that wants the detail. |

**Chosen: 1.** It adds the missing entry point and keeps every raw file readable, for the least
churn. 2 buys grouping we do not need at this size; 3 throws away material agents still use.

### Content fixes

| # | Where | Fix |
|---|---|---|
| 1 | `docs/development.md` "Add an API route" recipe | Replace `getProject(id)` + `project.user_id === user.id` with `getOwnedProject(userId, id)` (404 when null) — matches `architecture.md` and `AGENTS.md`. The recipe currently teaches the pattern the docs forbid. |
| 2 | Flow one-liner in `docs/index.md`, `docs/architecture.md`, `AGENTS.md` | Add the review-pass step so all three one-liners match `architecture.md`'s numbered flow. |
| 3 | `docs/architecture.md` prompt-builder list | Add `buildReviewPrompt`. |
| 4 | `docs/development.md` "Add a test" recipe | Fix the anchor `[Verify](#tests)` → point at `AGENTS.md#verify`. |
| 5 | `docs/architecture.md` module map | Fill small gaps (`lib/utils.ts`; `app/error.tsx`) where the map claims to be complete. |
| 6 | All docs | Short consistency sweep: suite counts, module / component / page lists vs the tree. |

## Decisions (mine)

- The index lives at `docs/superpowers/README.md` — the natural name for a folder entry point.
- Index is a table: date · feature · spec · plan · status; newest first; status "Done" for the
  features already merged to `main`.
- The index is English, like the rest of `docs/`.

## Left to the builder

- Exact index columns and copy.
- Whether `docs/index.md` links the folder only, or also lists the features.
- Any further inconsistency the sweep turns up (apply the same fix style).
