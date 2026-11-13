# Elephant / Goldfish in the UI — design

## Intent

The PRD review pass was built on an "Elephant / Goldfish" split (borrowed as a pattern from
`google/elephant-goldfish-model`): the drafting step is the Elephant — it holds the context (plan +
chat) and writes; the review pass is the Goldfish — it looks at the finished document with fresh
eyes and never sees the chat. Those names live only in the design doc today, so a user (or an agent
reading the UI) cannot tell which process is which, or what to do after a review.

This change surfaces the two names in the UI and gives the review result a clear next step: what to
do when the AI's recommendation needs a decision from the user.

Small change — UI only, no dependency, no schema.

## Goals

- Name the two processes where they appear: a short caption under **Buat PRD/Buat ulang** (Elephant)
  and under **Tinjau PRD** (Goldfish), plus one line explaining the split in the **Cara pakai
  hasilnya** dialog.
- After a review, tell the user what to do with the escalations: a line + a **Lihat Keputusan**
  button that scrolls to the **Keputusan yang dipakai** panel, wording the "then press **Buat ulang**"
  step.

## Non-goals

- No behavior change to the review, the plan, or the sections.
- No renaming of buttons or routes; the names stay as captions, not labels.
- No change to the decision panel's own logic.

## Anti-goals

- Adding jargon a non-IT user can't act on (a bare "Elephant/Goldfish" with no verb).
- Making the review card noisier for the common case (nothing to decide).
- Forcing the decision panel open when the user isn't ready.

## Constraints

- UI copy Indonesian (the names are proper nouns, kept verbatim); document content stays English.
- Follow `design-system/specly/MASTER.md`: caption = `text-xs text-muted-foreground`; no emojis as
  icons; visible focus; `cursor-pointer`; respect `prefers-reduced-motion` for the scroll.
- Reuse existing primitives (`components/ui/…`, `lucide-react`); no new dependency.

## Approaches

**A. Where the names go.**
1. Caption under each button.
2. One line in the existing **Cara pakai hasilnya** dialog.
3. Both. ← **chosen** (agreed): the caption names the button in the moment; the dialog explains the
   split once.

**B. The next step after a review.**
- Add, in the review result card, a line + a **Lihat Keputusan** button. ← **chosen** (agreed).
- Alternative (rejected): leave it to the panel's own helper text — the gap is that the review card
  gives the count but no action.

## Decisions (mine)

- **The button scrolls; it does not force Review mode.** The panel already lists every decision with
  its `Rekomendasi:` in the collapsed view, so forcing the radio editor adds disruption without new
  information.
- **Escalations are already set to the AI's recommendation and already persisted** by the review
  route, so "following the recommendation" needs no save — only **Buat ulang** to write it into the
  document. The copy will say so.
- **Zero-escalation case:** the card shows a plain "Tidak ada yang perlu kamu putuskan." line and no
  button.
- Target for the scroll: an `id` on the decision panel's card (`#keputusan`).

## Left to the builder

- Exact caption wording under each button (keep it to a few words + a verb).
- Whether the two captioned buttons sit in a `flex flex-col` each, or the caption spans both.
- Exact `Lihat Keputusan` handler (scroll target and behavior).
