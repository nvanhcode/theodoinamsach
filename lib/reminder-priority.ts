import { deadlineState, reportState, reportWindow } from "./domain";
export function reminderPriority(
  tasks: any[],
  reports: any[],
  now = new Date(),
  cfg: any = {},
) {
  return tasks
    .filter(
      (t) =>
        !["draft", "pending", "done", "cancelled", "paused"].includes(t.status),
    )
    .map((task) => {
      const overdue = deadlineState(task, now, cfg.warningDays) === "overdue";
      const state = reportState(task, reports, now, cfg),
        window = reportWindow(task, now, cfg);
      const missing = state === "missing",
        sentLate = state === "late";
      const submitted = sentLate
        ? reports
            .filter(
              (r) =>
                r.taskId === task.id &&
                (!r.unit || r.unit === task.unit) &&
                (r.periodKey || r.week) === window.key &&
                r.submitted,
            )
            .sort((a, b) => b.submitted.localeCompare(a.submitted))[0]
            ?.submitted
        : "";
      const due = new Date(task.due + "T23:59:59+07:00").toISOString();
      const deadlines = [
        ...(overdue ? [due] : []),
        ...(missing || sentLate ? [window.deadline] : []),
      ].sort();
      return {
        task,
        overdue,
        missing,
        sentLate,
        submitted,
        reportDeadline: window.deadline,
        due,
        priorityDate: deadlines[0],
        resolved: !overdue && !missing,
      };
    })
    .filter((r) => r.overdue || r.missing || r.sentLate)
    .sort(
      (a, b) =>
        Number(a.resolved) - Number(b.resolved) ||
        a.priorityDate.localeCompare(b.priorityDate) ||
        a.task.title.localeCompare(b.task.title, "vi"),
    );
}
export function delayLabel(deadline: string, at = new Date().toISOString()) {
  const hours = Math.max(
    0,
    Math.floor((Date.parse(at) - Date.parse(deadline)) / 3600000),
  );
  return hours >= 24
    ? Math.floor(hours / 24) +
        " ngày" +
        (hours % 24 ? " " + (hours % 24) + " giờ" : "")
    : hours
      ? hours + " giờ"
      : "dưới 1 giờ";
}
