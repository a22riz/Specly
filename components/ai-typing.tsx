"use client";

import { useEffect, useState } from "react";

const CHAT_PHASES = [
  "Menganalisis jawabanmu…",
  "Menyusun pemahaman…",
  "Menyiapkan pertanyaan berikutnya…",
];

/**
 * "AI is working" indicator — bouncing dots plus a slowly rotating phase
 * label, so waiting feels alive instead of frozen. Phases and pace are
 * configurable (logo generation runs minutes, chat runs seconds).
 * Respects prefers-reduced-motion (dots stop, label still changes).
 */
export function AiTyping({
  phases = CHAT_PHASES,
  interval = 2400,
}: {
  phases?: string[];
  interval?: number;
}) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % phases.length), interval);
    return () => clearInterval(t);
  }, [phases.length, interval]);

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
        {phases[phase]}
      </span>
    </div>
  );
}
