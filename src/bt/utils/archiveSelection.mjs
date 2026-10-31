// Windows are also split at session boundaries. Join those only when recording
// remains continuous, using the same 30-minute interruption threshold as indexing.
export function latestContinuousWindows (windows) {
  const ordered = [...windows].sort((a, b) => a.start_ns - b.start_ns)
  if (!ordered.length) return []
  let first = ordered.length - 1
  while (first > 0 && ordered[first].start_ns - ordered[first - 1].end_ns <= 1800e9) first--
  return ordered.slice(first).map(window => window.id)
}
export function recordingGaps (windows) {
  const ordered = [...windows].sort((a, b) => a.start_ns - b.start_ns)
  return ordered.slice(1).flatMap((window, i) => window.start_ns - ordered[i].end_ns > 1800e9
    ? [{ from: ordered[i].end_ns / 1e6, to: window.start_ns / 1e6 }] : [])
}
