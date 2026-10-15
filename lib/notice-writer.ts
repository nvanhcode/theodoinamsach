import { id, now, records, stmt } from "./server";

type TaskReference = { id: string; title: string };
type ReportReference = { id: string; version: number; unit: string };
type UnitReference = { id: string; name: string };

export async function notify(
  task: TaskReference,
  message: string,
  key = id(),
  audienceUnits?: string[],
  category?: string,
) {
  const result = await stmt(
    "INSERT OR IGNORE INTO records(id,kind,parent_id,data,version,updated) VALUES(?,?,?,?,1,?)",
    "notice-" + key,
    "notice",
    task.id,
    JSON.stringify({
      taskId: task.id,
      title: message,
      readBy: [],
      ...(audienceUnits ? { audienceUnits } : {}),
      ...(category ? { category } : {}),
    }),
    now(),
  ).run();
  return result.meta?.changes || 0;
}

export async function createDirective(
  message: string,
  audienceUnits: string[],
) {
  const noticeId = id();
  const updated = now();
  await stmt(
    "INSERT INTO records(id,kind,parent_id,data,version,updated) VALUES(?,?,?,?,1,?)",
    noticeId,
    "notice",
    "",
    JSON.stringify({
      taskId: null,
      title: "Chỉ đạo nhắc việc",
      message,
      readBy: [],
      audienceUnits,
      category: "admin-directive",
    }),
    updated,
  ).run();
  return { id: noticeId, updated };
}

export async function notifyReportApproval(
  report: ReportReference,
  task: TaskReference,
  unitDirectory?: UnitReference[],
) {
  const units = unitDirectory || (await records("unit"));
  const unitName =
    units.find((unit) => unit.id === report.unit)?.name || report.unit;
  return notify(
    task,
    `Báo cáo đơn vị cần phê duyệt · ${unitName}: ${task.title}`,
    `report-${report.id}-v${report.version}`,
    [report.unit],
    "report-submitted",
  );
}
