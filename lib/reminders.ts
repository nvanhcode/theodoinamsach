import { records, record, stmt, now, log } from "./server";
import { defaults, deadlineState, reportState, reportWindow } from "./domain";
export async function checkReminders() {
  const cfg = await record("settings");
  if (!cfg) return { count: 0 };
  const ts = await records("task"),
    reports = await records("report");
  let count = 0;
  for (const t of ts) {
    if (["draft", "pending", "done", "cancelled", "paused"].includes(t.status))
      continue;
    const w = reportWindow(t, new Date(), cfg);
    const ds = deadlineState(t, new Date(), cfg.warningDays),
      rs = reportState(t, reports, new Date(), cfg);
    const messages = [];
    if (ds === "overdue") messages.push("Nhiệm vụ quá hạn");
    else if (ds === "soon") messages.push("Nhiệm vụ sắp đến hạn");
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
      const r = await stmt(
        "INSERT OR IGNORE INTO records(id,kind,parent_id,data,version,updated) VALUES(?,?,?,?,1,?)",
        key,
        "notice",
        t.id,
        JSON.stringify({
          taskId: t.id,
          title: message + ": " + t.title,
          readBy: [],
        }),
        now(),
      ).run();
      count += r.meta.changes;
    }
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
