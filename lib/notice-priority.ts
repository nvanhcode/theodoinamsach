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
  if (/thông tin phối hợp|ý kiến phối hợp/.test(value))
    return { rank: 3, label: "Phối hợp", tone: "coordination" };
  return { rank: 4, label: "Thông tin", tone: "normal" };
}
