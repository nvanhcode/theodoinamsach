import { approver, has } from "./domain";

type ReviewUser = { roles?: string[]; units?: string[] } | null | undefined;
type Report = {
  id: string;
  taskId: string;
  unit: string;
  state: string;
  submitted?: string;
  [key: string]: unknown;
};
type Task = { id: string; month: string; [key: string]: unknown };

export function canReviewReport(user: ReviewUser, report: Report) {
  return (
    approver(user) || (has(user, "head") && user.units?.includes(report.unit))
  );
}

export function pendingReportApprovals(
  reports: Report[],
  tasks: Task[],
  user: ReviewUser,
  month = "",
) {
  const taskById = new Map(
    tasks
      .filter((task) => !month || task.month === month)
      .map((task) => [task.id, task]),
  );

  return reports
    .filter(
      (report) =>
        report.state === "submitted" &&
        canReviewReport(user, report) &&
        taskById.has(report.taskId),
    )
    .map((report) => ({ ...report, task: taskById.get(report.taskId) }))
    .sort((a, b) => (b.submitted || "").localeCompare(a.submitted || ""));
}
