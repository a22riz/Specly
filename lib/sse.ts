export type SSEEvent = { event: string; data: string };

/**
 * Parse complete SSE records from a streaming buffer.
 * Records are delimited by `\n\n`. Each record has `event:` and `data:` lines.
 * Returns parsed events plus the incomplete remainder (to prepend to the next chunk).
 */
export function parseSSERecords(buffer: string): { events: SSEEvent[]; remainder: string } {
  const events: SSEEvent[] = [];
  const records = buffer.split("\n\n");
  // Last element is either incomplete (no trailing \n\n) or empty (trailing \n\n).
  const remainder = records.pop() ?? "";
  for (const record of records) {
    if (!record.trim()) continue;
    let event = "";
    let data = "";
    for (const line of record.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (event) events.push({ event, data });
  }
  return { events, remainder };
}
