export function noticePriority(title = "") {
  const value = title.toLocaleLowerCase("vi");
  if (
    /quá hạn|chậm báo cáo|chưa gửi báo cáo|cần bổ sung|yêu cầu bổ sung|yêu cầu báo cáo|đề nghị cập nhật/.test(
      value,
    )
  )
    return { rank: 0, label: "Ưu tiên cao", tone: "high" };
  if (/cần phê duyệt|chờ duyệt|chờ xác nhận/.test(value))
    return { rank: 1, label: "Chờ xử lý", tone: "review" };
  if (/sắp đến hạn|nhắc báo cáo/.test(value))
    return { rank: 2, label: "Sắp đến hạn", tone: "review" };
  if (
    /thông tin phối hợp|ý kiến phối hợp|phản hồi của đơn vị chủ trì/.test(value)
  )
    return { rank: 3, label: "Phối hợp", tone: "coordination" };
  if (/ý kiến mới|chỉ đạo nhắc việc/.test(value))
    return { rank: 3, label: "Ý kiến / Chỉ đạo", tone: "review" };
  return { rank: 4, label: "Thông tin", tone: "normal" };
}

/**
 * A notice is history once what it asked for is settled: the report it asked
 * to approve was handled, the proposal was decided, the task was finished…
 * Without this, handled items kept "Ưu tiên cao"/"Chờ xử lý" forever.
 */
export function noticeResolved(notice: any, data?: any) {
  if (!data || !notice?.taskId) return false;
  const task = data.tasks?.find((t: any) => t.id === notice.taskId);
  if (!task) return false;
  const title = String(notice.title || "").toLocaleLowerCase("vi");
  const finished = ["done", "cancelled"].includes(task.status);
  const reportId = String(notice.id || "").match(
    /^notice-report-(.+)-v\d+$/,
  )?.[1];
  if (notice.category === "report-submitted" || reportId) {
    const report = data.reports?.find((r: any) => r.id === reportId);
    return (
      finished || (!!reportId && (!report || report.state !== "submitted"))
    );
  }
  if (/^nhiệm vụ (?:excel )?chờ duyệt/.test(title))
    return task.status !== "pending";
  if (/^báo cáo cần bổ sung/.test(title))
    return finished || task.status !== "returned";
  if (
    /^(nhiệm vụ quá hạn|nhiệm vụ sắp đến hạn|chưa gửi báo cáo|nhắc báo cáo)/.test(
      title,
    )
  )
    return finished || task.status === "paused";
  return false;
}
const resolvedPriority = { rank: 5, label: "Đã xử lý", tone: "normal" };
export const noticePriorityFor = (notice: any, data?: any) =>
  noticeResolved(notice, data)
    ? resolvedPriority
    : noticePriority(
        notice?.category === "admin-directive"
          ? notice.message || notice.title
          : noticeKind(notice?.title || ""),
      );
/**
 * Task notices read "<kind>: <task title>". Classify by the kind only, so a
 * task named e.g. "Tổng hợp việc quá hạn" does not make every notice urgent.
 */
export function noticeKind(title: string) {
  const at = title.indexOf(":");
  return at > 0 ? title.slice(0, at) : title;
}
