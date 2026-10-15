import { records, record, log } from "./server";
import { deadlineState, reportState, reportWindow } from "./domain";
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
    else if (
      rs === "notDue" &&
      Date.now() >
        new Date(w.deadline).getTime() -
          (w.frequency === "daily" ? 3600000 : 86400000)
    )
      messages.push(
        "Nhắc báo cáo " + (w.frequency === "daily" ? "hằng ngày" : "tuần"),
      );
    for (const message of messages) {
      const key = "notice-auto-" + t.id + "-" + w.key + "-" + message;
      count += await notify(
        t,
        message + ": " + t.title,
        key.slice("notice-".length),
        [t.unit],
      );
    }
  }
  const taskById = new Map(ts.map((task: any) => [task.id, task]));
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
