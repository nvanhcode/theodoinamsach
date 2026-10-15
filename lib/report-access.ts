import { has, office, canSee, canReport } from "./domain";
export const reportingOnly = (u: any) =>
  has(u, "editor", "partner", "head") &&
  !has(
    u,
    "admin",
    "deputy",
    "clerk",
    "secretary",
    "standing",
    "chair",
    "council",
    "inspector",
    "tech",
  );
export const reportingUnits = (u: any, t: any) =>
  canReport(u, t)
    ? [t.unit].filter((x: string) => office(u) || u.units?.includes(x))
    : [];
export const coordinationUnits = (u: any, t: any) =>
  has(u, "editor", "head", "partner")
    ? (t.partners || []).filter((unit: string) => u.units?.includes(unit))
    : [];
export const splitAssignedTasks = (u: any, tasks: any[] = []) => {
  const uniqueTasks = Array.from(
    new Map(tasks.filter(Boolean).map((task) => [task.id, task])).values(),
  );
  return uniqueTasks.reduce(
    (result, task) => {
      if (u.units?.includes(task.unit)) result.lead.push(task);
      else if (coordinationUnits(u, task).length) result.partner.push(task);
      return result;
    },
    { lead: [] as any[], partner: [] as any[] },
  );
};
export const partnerUpdateRequired = (t: any) =>
  t.partnerUpdateRequired ?? !!t.partners?.length;
export const canReadNotice = (u: any, n: any, t: any) => {
  if (Array.isArray(n.audienceUnits) && n.audienceUnits.length)
    return (
      office(u) ||
      has(u, "secretary", "standing", "chair", "council", "inspector") ||
      n.audienceUnits.some((unit: string) => u.units?.includes(unit))
    );
  if (n.category === "admin-directive") return false;
  if (
    /^(chưa gửi báo cáo|nhắc báo cáo|báo cáo đơn vị cần phê duyệt|báo cáo cần bổ sung|báo cáo đã xác nhận)/i.test(
      n.title || "",
    )
  )
    return (
      office(u) ||
      has(u, "secretary", "standing", "chair", "council", "inspector") ||
      u.units?.includes(t.unit)
    );
  return true;
};
export const canReadReport = (u: any, t: any, r: any) =>
  canSee(u, t) &&
  (r.state !== "draft" ||
    office(u) ||
    r.author === u.id ||
    u.units.includes(r.unit));
export const evidenceLabels: Record<string, string> = {
  none: "Không bắt buộc minh chứng",
  any: "Cần có tệp minh chứng",
  image: "Cần có ảnh minh chứng",
  document: "Cần có văn bản minh chứng",
};

export const assignmentNoticeTitle = (title: string) =>
  title.replace(/^Giao nhiệm vụ từ (?:excel|exel)\s*:/i, "Nhiệm vụ được giao:");

export const isAdminRequestNotice = (notice: any) =>
  ["admin-request", "report-supplement", "admin-directive"].includes(
    notice?.category,
  ) ||
  /^(báo cáo cần bổ sung|yêu cầu bổ sung|yêu cầu (?:gửi|nộp).*báo cáo|yêu cầu báo cáo|đề nghị.*báo cáo)/i.test(
    notice?.title || "",
  );
