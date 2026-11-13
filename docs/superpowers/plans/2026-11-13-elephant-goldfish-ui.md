# Elephant / Goldfish UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the Elephant/Goldfish names in the UI and give the PRD-review result a clear next step (what to do when a decision is waiting on the user).

**Architecture:** Two small UI edits in the project editor plus one `id` on the decision panel card. No route, no state, no schema, no dependency change.

**Tech Stack:** Next.js 16 + React 19, Tailwind 4, `components/ui/`, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-11-13-elephant-goldfish-ui-design.md`

## Global Constraints

- UI copy Indonesian; the names `Elephant` / `Goldfish` are proper nouns, kept verbatim. Document content stays English.
- Follow `design-system/specly/MASTER.md`: caption `text-xs text-muted-foreground`; icons from `lucide-react` (no emoji icons); visible focus states; `cursor-pointer` on clickable elements; respect `prefers-reduced-motion`.
- No new dependency; reuse existing `components/ui/` primitives.
- No behavior change to the review, the plan, or section content.
- Verify each task: `npx tsc --noEmit` and `npx eslint "app/projects/[id]/editor.tsx" components/decision-panel.tsx` clean, and `npm run build` succeeds.

## Review Focus

UI-only, no component test harness — checks are tsc/eslint/build plus the manual points below.

1. Captions wrapping or overflowing at 375px width (no horizontal scroll on mobile).
2. The new **Lihat Keputusan** button keyboard-operable with a visible focus ring.
3. The scroll target `#keputusan` exists and lands on the decision panel card.
4. The zero-escalation case shows a plain line and no dead button.
5. Indonesian copy throughout; names verbatim; no English leaking into visible copy.

---

### Task 1: Name the two processes (Elephant / Goldfish)

**Files:**
- Modify: `app/projects/[id]/editor.tsx` (the PRD card button row ~`725-745`; the **Cara pakai hasilnya** dialog ~`527-566`)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing another task depends on (the naming is self-contained).

- [ ] **Step 1: Add a caption under the draft and review buttons**

In the PRD card's `flex flex-wrap items-center gap-2` row (the one holding *Buat PRD/Buat ulang*, the generating *Batal*, and *Tinjau PRD*), wrap the **Buat PRD/Buat ulang** button and the **Tinjau PRD** button each in a vertical stack so a caption sits directly beneath, e.g.:

```tsx
<div className="flex flex-col items-start gap-1">
  <Button …>…{generating ? "Membuat PRD..." : hasContent ? "Buat ulang" : "Buat PRD"}</Button>
  <span className="text-xs text-muted-foreground">Elephant · menyusun dari ceritamu</span>
</div>
```

```tsx
{hasContent && !generating && (
  <div className="flex flex-col items-start gap-1">
    <Button … >…Tinjau PRD…</Button>
    <span className="text-xs text-muted-foreground">Goldfish · meninjau dengan mata segar</span>
  </div>
)}
```

Change the row's `items-center` to `items-start` so the captions hang cleanly below the buttons. Leave the generating **Batal** button as-is (no caption). Keep both captions to one short line; they must not force a horizontal scroll at 375px.

- [ ] **Step 2: Explain the split once, in the "Cara pakai hasilnya" dialog**

Inside that dialog's `DialogContent` (after the `<ol>` list, before `<DialogFooter>`), add one short Indonesian paragraph:

```tsx
<p className="text-xs text-muted-foreground">
  Di balik layar: <span className="font-medium text-foreground">Elephant</span> menyusun 12 bagian
  dari diskusimu; <span className="font-medium text-foreground">Goldfish</span> meninjau dokumen
  jadi dengan mata segar untuk menyelaraskan istilah dan memunculkan keputusan yang tersisa.
</p>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint "app/projects/[id]/editor.tsx" && npm run build`
Expected: all clean.

- [ ] **Step 4: Commit**

```bash
git add "app/projects/[id]/editor.tsx"
git commit -m "feat(ui): name the Elephant and Goldfish steps"
```

---

### Task 2: Give the review result a next step

**Files:**
- Modify: `components/decision-panel.tsx` (give the outer `Card` an `id`)
- Modify: `app/projects/[id]/editor.tsx` (review result card ~`747-823`; add a `scrollToDecisions` helper near `reviewPrd`)

**Interfaces:**
- Consumes: `review.escalated` (a number) from the existing `ReviewSummary`.
- Produces: `id="keputusan"` on the decision panel card, used by `scrollToDecisions()`.

- [ ] **Step 1: Give the decision panel a scroll target**

In `components/decision-panel.tsx`, add a stable id to the outer card so the editor can scroll to it:

Set `id="keputusan"` on the top-level `<Card>` in the returned JSX (the one whose `CardTitle` is "Keputusan yang dipakai").

- [ ] **Step 2: Add the scroll helper in `editor.tsx`**

Near `reviewPrd`/`undoReview`, add:

```tsx
function scrollToDecisions() {
  const el = document.getElementById("keputusan");
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
```

- [ ] **Step 3: Show the next step in the review result card**

In the review result `<div className="space-y-3 rounded-lg border border-border p-3">`, directly after the counts/`usage` row, render:

```tsx
{review.escalated > 0 ? (
  <div className="flex flex-wrap items-center gap-2">
    <p className="text-xs text-muted-foreground">
      {review.escalated} keputusan menunggu rekomendasi AI — buka panel Keputusan, lalu tekan
      Buat ulang untuk menerapkannya.
    </p>
    <Button variant="outline" size="sm" onClick={scrollToDecisions}>
      Lihat Keputusan
    </Button>
  </div>
) : (
  <p className="text-xs text-muted-foreground">Tidak ada yang perlu kamu putuskan.</p>
)}
```

No icon needed on the button; the focus ring from `components/ui/button` must remain visible.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx eslint "app/projects/[id]/editor.tsx" components/decision-panel.tsx && npm run build`
Expected: all clean.

- [ ] **Step 5: Commit**

```bash
git add "app/projects/[id]/editor.tsx" components/decision-panel.tsx
git commit -m "feat(ui): guide the user from the review result to the decisions"
```

---

## Final Verification

```sh
npx tsc --noEmit
npx eslint "app/projects/[id]/editor.tsx" components/decision-panel.tsx
npm run build
```

Expected: all clean. Manual (needs a drafted PRD): the two captions read under their buttons at 375px without horizontal scroll; the dialog shows the one-line split; after **Tinjau PRD** with ≥1 escalation the card shows the line + **Lihat Keputusan**, and the button scrolls to the decision panel with a keyboard-visible focus ring.
