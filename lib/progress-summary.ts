export const progressFilters = [
  ["", "Tất cả"],
  ["givenWork", "Đã giao việc"],
  ["done", "Hoàn thành"],
  ["unfinished", "Chưa hoàn thành"],
] as const;
const givenStates = new Set([
  "assigned",
  "working",
  "review",
  "returned",
  "done",
  "paused",
]);
export function matchesProgressStatus(task: any, status: string) {
  if (status === "givenWork") return givenStates.has(task.status);
  if (status === "unfinished")
    return givenStates.has(task.status) && task.status !== "done";
  return status === "done" ? task.status === "done" : !status;
}
export function progressCounts(tasks: any[]) {
  return {
    total: tasks.length,
    givenWork: tasks.filter((t) => matchesProgressStatus(t, "givenWork"))
      .length,
    done: tasks.filter((t) => t.status === "done").length,
    unfinished: tasks.filter((t) => matchesProgressStatus(t, "unfinished"))
      .length,
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
