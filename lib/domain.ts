export const roleNames: Record<string, string> = {
  admin: "Chánh Văn phòng",
  deputy: "Phó Chánh Văn phòng",
  clerk: "Văn thư / Chuyên viên Văn phòng",
  secretary: "Bí thư Đảng ủy",
  standing: "Phó Bí thư Thường trực",
  chair: "Phó Bí thư – Chủ tịch UBND",
  council: "Thường trực / Ban HĐND",
  head: "Thủ trưởng đơn vị",
  editor: "Cán bộ đầu mối · Cập nhật báo cáo",
  partner: "Đơn vị phối hợp",
  inspector: "Kiểm tra, giám sát",
  tech: "Quản trị kỹ thuật",
};
export const stateNames: Record<string, string> = {
  draft: "Dự thảo",
  pending: "Chờ duyệt giao việc",
  assigned: "Đã giao",
  working: "Đang thực hiện",
  review: "Chờ xác nhận kết quả",
  returned: "Cần bổ sung",
  done: "Hoàn thành đã xác nhận",
  paused: "Tạm dừng",
  cancelled: "Kết thúc / Hủy",
};
export const groups = [
  "Khối Đảng",
  "HĐND",
  "UBND",
  "MTTQ và đoàn thể",
  "Lực lượng vũ trang",
  "Thôn, chi bộ",
];
export function orderedGroups(values: string[]) {
  const available = new Set(values);
  return [
    ...groups.filter((group) => available.has(group)),
    ...Array.from(available).filter((group) => !groups.includes(group)),
  ];
}
export const initialUnits = [
  ["Văn phòng Đảng ủy", 0],
  ["Ban Xây dựng Đảng", 0],
  ["Cơ quan Ủy ban Kiểm tra Đảng ủy", 0],
  ["Thường trực HĐND xã", 1],
  ["Ban Kinh tế – Ngân sách HĐND", 1],
  ["Ban Văn hóa – Xã hội HĐND", 1],
  ["UBND xã", 2],
  ["Văn phòng HĐND và UBND", 2],
  ["Phòng Kinh tế", 2],
  ["Phòng Văn hóa – Xã hội", 2],
  ["Trung tâm Phục vụ hành chính công", 2],
  ["Trung tâm Dịch vụ sự nghiệp công", 2],
  ["Cơ quan Ủy ban MTTQ Việt Nam xã", 3],
  ["Hội Liên hiệp Phụ nữ", 3],
  ["Hội Nông dân", 3],
  ["Đoàn Thanh niên", 3],
  ["Hội Cựu chiến binh", 3],
  ["Công an xã", 4],
  ["Ban Chỉ huy Quân sự xã", 4],
  ["Trạm Y tế xã", 2],
  ["Công đoàn", 3],
  ["Phòng Xây dựng, Nông nghiệp và Môi trường", 2],
  ["Ban Quản lý dự án đầu tư xây dựng xã", 2],
];
export const defaults = {
  title: "Theo dõi kết luận, chỉ đạo",
  organization: "ĐẢNG ỦY XÃ NAM SÁCH",
  city: "THÀNH PHỐ HẢI PHÒNG",
  color: "#a6192e",
  day: 5,
  hour: "16:00",
  warningDays: 3,
  pageSize: 10,
  logo: "/bua-liem-nam-sach.png",
  sessionMinutes: 30,
};
export const has = (u: any, ...r: string[]) =>
  r.some((x) => u?.roles?.includes(x));
export const office = (u: any) => has(u, "admin", "deputy", "clerk");
export const approver = (u: any) => has(u, "admin", "deputy");
export function canSee(u: any, t: any) {
  if (t.restricted && !t.allowedUsers?.includes(u.id)) return false;
  if (office(u) || has(u, "secretary")) return true;
  if (["draft", "pending"].includes(t.status)) return false;
  if (has(u, "standing") && ["Khối Đảng", "MTTQ và đoàn thể"].includes(t.group))
    return true;
  if (has(u, "chair") && ["UBND", "Giáo dục, y tế"].includes(t.group))
    return true;
  if (has(u, "council") && t.group === "HĐND") return true;
  return (
    u.units?.includes(t.unit) ||
    t.partners?.some((x: string) => u.units?.includes(x)) ||
    u.groups?.includes(t.group)
  );
}
export function canReport(u: any, t: any) {
  return (
    canSee(u, t) &&
    (office(u) ||
      (has(u, "editor", "head", "partner") && u.units?.includes(t.unit)))
  );
}
export const localDate = (date = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    date,
  );
export function weekWindow(now = new Date(), cfg: any = defaults) {
  const local = new Date(now.getTime() + 7 * 3600000);
  const day = local.getUTCDay() || 7;
  const monday = new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() - day + 1,
    ),
  );
  const [h, m] = cfg.hour.split(":").map(Number);
  const deadline = new Date(
    monday.getTime() + ((cfg.day - 1) * 24 + h - 7) * 3600000 + m * 60000,
  );
  return {
    key: monday.toISOString().slice(0, 10),
    deadline: deadline.toISOString(),
  };
}
export function reportWindow(t: any, now = new Date(), cfg: any = defaults) {
  cfg = { ...defaults, ...cfg };
  const frequency = t.reportFrequency || "default";
  const hour = t.reportHour || cfg.hour;
  if (frequency === "daily") {
    const date = localDate(now);
    return {
      key: date,
      deadline: new Date(date + "T" + hour + ":00+07:00").toISOString(),
      frequency: "daily",
    };
  }
  return {
    ...weekWindow(
      now,
      frequency === "weekly"
        ? { ...cfg, hour, day: t.reportDay || cfg.day }
        : cfg,
    ),
    frequency: "weekly",
  };
}
export function reportScheduleLabel(t: any, cfg: any = defaults) {
  cfg = { ...defaults, ...cfg };
  const w = reportWindow(t, new Date(), cfg);
  const hour =
    t.reportFrequency && t.reportFrequency !== "default"
      ? t.reportHour || cfg.hour
      : cfg.hour;
  const day = t.reportDay || cfg.day;
  return w.frequency === "daily"
    ? "Hằng ngày, trước " + hour
    : "Hằng tuần, trước " +
        hour +
        " " +
        (Number(day) === 7 ? "Chủ nhật" : "thứ " + (Number(day) + 1));
}
export function deadlineState(t: any, now = new Date(), warning = 3) {
  if (t.status === "cancelled" || t.status === "paused") return "inactive";
  const end = new Date(t.due + "T23:59:59+07:00");
  if (t.status === "done")
    return t.completed && new Date(t.completed) > end ? "doneLate" : "done";
  const d = (+end - +now) / 86400000;
  return d < 0 ? "overdue" : d <= warning ? "soon" : "onTime";
}
export function reportState(
  t: any,
  reports: any[],
  now = new Date(),
  cfg: any = defaults,
) {
  if (["draft", "pending", "done", "paused", "cancelled"].includes(t.status))
    return "notRequired";
  const w = reportWindow(t, now, cfg);
  if (
    t.assignedDate &&
    new Date(
      t.assignedDate + "T" + (t.assignedTime || "00:00") + ":00+07:00",
    ).getTime() > new Date(w.deadline).getTime()
  )
    return "notDue";
  const r = reports
    .filter(
      (x) =>
        x.taskId === t.id &&
        (x.periodKey || x.week) === w.key &&
        (!x.unit || x.unit === t.unit) &&
        x.submitted,
    )
    .sort((a, b) => b.submitted.localeCompare(a.submitted))[0];
  if (r)
    return r.state === "returned"
      ? "returned"
      : r.submitted < w.deadline
        ? "onTime"
        : "late";
  return now.toISOString() >= w.deadline ? "missing" : "notDue";
}
export function uniqueYear(tasks: any[]) {
  return new Set(tasks.map((t) => t.rootId || t.id)).size;
}
