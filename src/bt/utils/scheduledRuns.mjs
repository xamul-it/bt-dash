// Identity comes from the schedule, never from a mutable display title.
export function scheduleForRun(run, schedules = []) {
  const id = run?.request_snapshot?.schedule_id
  if (id) return schedules.find(row => row.id === id) || null
  return schedules.find(row => row.source_job_id === run.id || row.last_job_id === run.id) || null
}
export function scheduleKey(run, schedules = []) {
  return run?.request_snapshot?.schedule_id || scheduleForRun(run, schedules)?.id || null
}
export function newestRuns(runs) {
  return [...runs].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || String(b.id).localeCompare(String(a.id)))
}
export function latestScheduledRuns(runs, schedules = []) {
  const latest = new Map()
  newestRuns(runs).forEach(run => {
    const key = scheduleKey(run, schedules)
    if (key && !latest.has(key)) latest.set(key, run.id)
  })
  return runs.filter(run => {
    const key = scheduleKey(run, schedules)
    return !key || latest.get(key) === run.id
  })
}
