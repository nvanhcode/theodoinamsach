import { deadlineState } from "./domain";

export const progressFilters = [
  ["", "Tất cả"],
  ["givenWork", "Đã giao việc"],
  ["done", "Hoàn thành"],
  ["unfinished", "Chưa hoàn thành"],
] as const;

/**
 * One mutually exclusive bucket per task. Every count on the dashboard,
 * progress table, unit portal and exports is derived from these buckets, so
 * the numbers always reconcile:
 *   total      = notAssigned + done + activeWork + overdue + paused + cancelled
 *   givenWork  = done + activeWork + overdue + paused
 *   unfinished = activeWork + overdue + paused
 */
export type TaskBucket =
  "notAssigned" | "done" | "activeWork" | "overdue" | "paused" | "cancelled";
const activeStates = new Set(["assigned", "working", "review", "returned"]);
export function taskBucket(
  task: any,
  now = new Date(),
  warningDays = 3,
): TaskBucket {
  if (task.status === "done") return "done";
  if (task.status === "paused") return "paused";
  if (task.status === "cancelled") return "cancelled";
  if (activeStates.has(task.status))
    return deadlineState(task, now, warningDays) === "overdue"
      ? "overdue"
      : "activeWork";
  return "notAssigned";
}
export function isGivenWork(task: any) {
  return (
    ["done", "paused"].includes(task.status) || activeStates.has(task.status)
  );
}
/** Status keys used by list filters and KPI links (URL ?status=...). */
export function matchesTaskFilter(
  task: any,
  status: string,
  now = new Date(),
  warningDays = 3,
) {
  if (!status) return true;
  if (status === "givenWork") return isGivenWork(task);
  if (status === "unfinished")
    return isGivenWork(task) && task.status !== "done";
  if (["activeWork", "overdue"].includes(status))
    return taskBucket(task, now, warningDays) === status;
  // "notStarted" kept for old links: tasks not yet handed to a unit.
  if (["notAssigned", "notStarted"].includes(status))
    return taskBucket(task, now, warningDays) === "notAssigned";
  return task.status === status;
}
export function matchesProgressStatus(task: any, status: string) {
  return matchesTaskFilter(task, status);
}
export function bucketCounts(tasks: any[], now = new Date(), warningDays = 3) {
  const counts: Record<TaskBucket, number> = {
    notAssigned: 0,
    done: 0,
    activeWork: 0,
    overdue: 0,
    paused: 0,
    cancelled: 0,
  };
  for (const t of tasks) counts[taskBucket(t, now, warningDays)]++;
  return { total: tasks.length, ...counts };
}
export function progressCounts(tasks: any[]) {
  const c = bucketCounts(tasks);
  return {
    total: c.total,
    givenWork: c.done + c.activeWork + c.overdue + c.paused,
    done: c.done,
    unfinished: c.activeWork + c.overdue + c.paused,
  };
}
export function completionPercentage(done: number, givenWork: number) {
  if (givenWork <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((done / givenWork) * 100)));
}
export function progressUnits(units: any[], tasks: any[], scope: any = {}) {
  return units
    .filter(
      (u) =>
        (u.active || tasks.some((t) => t.unit === u.id)) &&
        (!scope.group || u.group === scope.group) &&
        (!scope.unit || u.id === scope.unit),
    )
    .sort(
      (a, b) =>
        (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, "vi"),
    )
    .map((u) => ({
      ...u,
      ...progressCounts(tasks.filter((t) => t.unit === u.id)),
    }));
}
