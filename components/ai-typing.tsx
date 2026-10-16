"use client";

import { useEffect, useState } from "react";

/**
 * "AI is thinking" indicator — bouncing dots plus a slowly rotating phase
 * label, so waiting for the model feels alive instead of frozen.
 * Respects prefers-reduced-motion (dots stop, label still changes).
 */
const PHASES = [
  "Menganalisis jawabanmu…",
  "Menyusun pemahaman…",
  "Menyiapkan pertanyaan berikutnya…",
];

export function AiTyping() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 2400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-2.5 py-0.5 text-sm text-muted-foreground" role="status">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((d) => (
          <span
            key={d}
            className="size-1.5 rounded-full bg-primary/70 motion-safe:animate-bounce"
            style={{ animationDelay: `${d * 160}ms` }}
          />
        ))}
      </span>
      <span key={phase} className="animate-pop-in">
        {PHASES[phase]}
      </span>
    </div>
  );
}
