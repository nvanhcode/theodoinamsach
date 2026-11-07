import { records, record, log } from "./server";
import {
  activeReportWindow,
  deadlineState,
  reportState,
  reportWindow,
} from "./domain";
import { notify, notifyReportApproval } from "./notice-writer";
export async function checkReminders() {
  const cfg = await record("settings");
  if (!cfg) return { count: 0 };
  const ts = await records("task"),
    reports = await records("report"),
    units = await records("unit");
  const unitNames = new Map(units.map((unit: any) => [unit.id, unit.name]));
  let count = 0;
  for (const t of ts) {
    if (["draft", "pending", "done", "cancelled", "paused"].includes(t.status))
      continue;
    const w = reportWindow(t, new Date(), cfg);
    const ds = deadlineState(t, new Date(), cfg.warningDays),
      rs = reportState(t, reports, new Date(), cfg);
    const messages = [];
    if (ds === "overdue") {
      const due = new Date(t.due + "T00:00:00+07:00").toLocaleDateString(
        "vi-VN",
        { timeZone: "Asia/Ho_Chi_Minh" },
      );
      messages.push(
        `Nhiệm vụ quá hạn · ${unitNames.get(t.unit) || t.unit} · hạn ${due}`,
      );
    } else if (ds === "soon") messages.push("Nhiệm vụ sắp đến hạn");
    if (rs === "missing")
      messages.push(
        "Chưa gửi báo cáo " + (w.frequency === "daily" ? "hằng ngày" : "tuần"),
      );
    // Remind shortly before the deadline the next report actually counts for
    // (a task handed over after this window's deadline reports next window).
    const next = activeReportWindow(t, new Date(), cfg);
    const remindKey = next.key;
    if (
      rs === "notDue" &&
      Date.now() <= new Date(next.deadline).getTime() &&
      Date.now() >
        new Date(next.deadline).getTime() -
          (next.frequency === "daily" ? 3600000 : 86400000) &&
      !reports.some(
        (r: any) =>
          r.taskId === t.id &&
          r.submitted &&
          (r.periodKey || r.week) === next.key,
      )
    )
      messages.push(
        "Nhắc báo cáo " + (next.frequency === "daily" ? "hằng ngày" : "tuần"),
      );
    for (const message of messages) {
      const key =
        "notice-auto-" +
        t.id +
        "-" +
        (message.startsWith("Nhắc báo cáo") ? remindKey : w.key) +
        "-" +
        message;
      count += await notify(
        t,
        message + ": " + t.title,
        key.slice("notice-".length),
        [t.unit],
      );
    }
  }
  const taskById = new Map<string, any>(ts.map((task: any) => [task.id, task]));
  for (const report of reports.filter(
    (item: any) => item.state === "submitted",
  )) {
    const task = taskById.get(report.taskId);
    if (task) count += await notifyReportApproval(report, task, units);
  }
  if (count)
    await log(
      { name: "Hệ thống nhắc việc" },
      "Nhắc việc tự động",
      "scheduler",
      null,
      { count },
    ).run();
  return { count };
}
