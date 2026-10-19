import { defaults } from "./domain";
export const taskImportHeaders = [
  "Nội dung nhiệm vụ",
  "Đơn vị chủ trì",
  "Đơn vị phối hợp",
  "Ngày giao",
  "Thời hạn hoàn thành",
  "Số, ký hiệu văn bản",
  "Ghi chú",
  "Mã nhập",
];
const norm = (v: any) =>
  String(v ?? "")
    .trim()
    .normalize("NFC")
    .toLocaleLowerCase("vi");
const newImportCode = (month: string, row: number) => {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replaceAll("-", "").slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return `NV${month.replace("-", "")}_${row}_${random}`;
};
export async function buildTaskTemplate(
  data: any,
  month: string,
  options: { defaultUnitId?: string } = {},
) {
  const module = await import("xlsx");
  const X = module.default || module;
  const wb = X.utils.book_new();
  const headers = taskImportHeaders;
  const rows = [
    headers,
    ...Array.from({ length: 200 }, (_, index) => {
      const row = Array(headers.length).fill("");
      row[headers.length - 1] = newImportCode(month, index + 2);
      return row;
    }),
  ];
  const ws = X.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 62 },
    { wch: 34 },
    { wch: 44 },
    { wch: 16 },
    { wch: 20 },
    { wch: 24 },
    { wch: 42 },
    { wch: 24, hidden: true },
  ];
  ws["!autofilter"] = { ref: `A1:G201` };
  ws["!freeze"] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen",
  };
  X.utils.book_append_sheet(wb, ws, "Nhap nhiem vu");
  const units = X.utils.aoa_to_sheet([
    ["Tên đơn vị", "Mã đơn vị", "Khối"],
    ...data.units
      .filter((u: any) => u.active)
      .map((u: any) => [u.name, u.id, u.group]),
  ]);
  units["!cols"] = [{ wch: 58 }, { wch: 22 }, { wch: 28 }];
  X.utils.book_append_sheet(wb, units, "Danh muc don vi");
  const guide = X.utils.aoa_to_sheet([
    ["HƯỚNG DẪN NHẬP NHANH"],
    ["Kỳ theo dõi", month],
    ["Cần nhập", "Nội dung nhiệm vụ và thời hạn hoàn thành."],
    [
      "Đơn vị chủ trì",
      options.defaultUnitId
        ? "Để trống để dùng đơn vị của tài khoản đang đăng nhập; có thể chọn đơn vị khác trong phạm vi được giao."
        : "Chọn tên đơn vị trong Danh muc don vi.",
    ],
    [
      "Đơn vị phối hợp",
      "Không bắt buộc. Nếu có, ghi tên các đơn vị và ngăn cách bằng dấu chấm phẩy (;).",
    ],
    ["Ngày giao", "Không bắt buộc; để trống sẽ lấy ngày đầu kỳ đang chọn."],
    ["Số, ký hiệu và ghi chú", "Không bắt buộc."],
    [
      "Mã nhập",
      "Cột ẩn do hệ thống tạo; không sửa hoặc xóa. Giữ nguyên để nhập lại không tạo trùng.",
    ],
    [
      "Sau khi tải lên",
      "Kiểm tra từng dòng trước khi lưu. Đơn vị gửi đề xuất sẽ chuyển đến trang admin để phê duyệt; chưa được tính là nhiệm vụ giao.",
    ],
    [
      "Cập nhật nhiệm vụ cũ",
      "Tải bảng giao nhiệm vụ Excel từ trang admin để cập nhật; mẫu nhập nhanh này dùng để thêm nhiệm vụ mới.",
    ],
  ]);
  guide["!cols"] = [{ wch: 28 }, { wch: 110 }];
  X.utils.book_append_sheet(wb, guide, "Huong dan");
  return new Uint8Array(X.write(wb, { bookType: "xlsx", type: "array" }));
}

export async function parseTaskExcel(
  bytes: ArrayBuffer,
  data: any,
  month: string,
  options: { defaultUnitId?: string; unitProposal?: boolean } = {},
) {
  const module = await import("xlsx");
  const X = module.default || module;
  const book = X.read(bytes, { type: "array", cellDates: false });
  const sheet =
    book.Sheets["Nhap nhiem vu"] ||
    book.Sheets["Giao nhiem vu"] ||
    book.Sheets[book.SheetNames[0]];
  const rows: any[][] = X.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });
  if (rows.length > 10000)
    throw new Error(
      "Bảng vượt giới hạn dòng đọc. Mỗi lần nhập tối đa 200 nhiệm vụ.",
    );
  const hi = rows.findIndex((row) =>
    row.some((c) => norm(c) === "nội dung nhiệm vụ"),
  );
  if (hi < 0)
    throw new Error(
      "Không tìm thấy cột Nội dung nhiệm vụ. Hãy dùng mẫu của website.",
    );
  const headers = rows[hi].map(norm);
  const col = (row: any[], name: string) =>
    row[headers.indexOf(norm(name))] ?? "";
  const text = (v: any) => String(v ?? "").trim();
  const cfg = { ...defaults, ...data.settings };
  const seen = new Set<string>();
  const result: any[] = [];
  const date = (v: any) => {
    if (typeof v === "number") {
      const d = X.SSF.parse_date_code(v, {
        date1904: !!book.Workbook?.WBProps?.date1904,
      });
      return d
        ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`
        : "";
    }
    const s = text(v);
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s;
  };
  const time = (v: any) => {
    if (typeof v === "number") {
      const n = Math.round((v % 1) * 1440);
      return `${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
    }
    return text(v);
  };
  for (let i = hi + 1; i < rows.length; i++) {
    const row = rows[i];
    const hasUserInput = headers.some(
      (header, index) =>
        !["mã nhập", "id hệ thống", "phiên bản", "tháng theo dõi"].includes(
          header,
        ) && text(row[index]) !== "",
    );
    if (!hasUserInput) continue;
    const errors: string[] = [];
    const get = (n: string) => col(row, n);
    const title = text(get("Nội dung nhiệm vụ"));
    const rid = text(get("ID hệ thống"));
    const period = text(get("Tháng theo dõi")) || month;
    const code = text(get("Mã nhập")) || newImportCode(period, i + 1);
    let old: any = null;
    if (rid) {
      old = data.tasks.find((t: any) => t.id === rid);
      if (!old)
        errors.push("ID hệ thống không tồn tại hoặc ngoài quyền truy cập");
    } else if (code) {
      const matches = data.tasks.filter(
        (t: any) => t.importCode === code && t.month === period,
      );
      if (matches.length > 1)
        errors.push("Mã nhập trùng nhiều nhiệm vụ; dùng ID hệ thống");
      else old = matches[0] || null;
    }
    if (!old && !/^[A-Za-z0-9_-]{1,60}$/.test(code))
      errors.push(
        "Mã nhập mới phải có 1–60 ký tự chữ, số, gạch ngang/gạch dưới",
      );
    if (options.unitProposal && old)
      errors.push(
        "Đề xuất đã gửi trước đó; theo dõi trạng thái ở mục Đề xuất chờ duyệt.",
      );
    const key = old?.id || period + "|" + code;
    if (seen.has(key)) errors.push("Mã nhiệm vụ bị lặp trong file");
    seen.add(key);
    if (!title) errors.push("Thiếu nội dung nhiệm vụ");
    if (
      !/^\d{4}-\d{2}$/.test(period) ||
      Number(period.slice(5)) < 1 ||
      Number(period.slice(5)) > 12
    )
      errors.push("Tháng theo dõi không hợp lệ");
    if (period !== month)
      errors.push("Tháng theo dõi phải trùng tháng đang chọn");
    if (data.periods.some((p: any) => p.month === period && p.closed))
      errors.push("Kỳ đã khóa sổ");
    if (old && old.month !== period)
      errors.push("Không được đổi kỳ của nhiệm vụ đã có");
    if (old && ["done", "cancelled"].includes(old.status))
      errors.push("Nhiệm vụ đã kết thúc");
    const resolveUnit = (v: any) => {
      const name = norm(v);
      const matches = data.units.filter(
        (u: any) => u.active && (norm(u.id) === name || norm(u.name) === name),
      );
      if (matches.length !== 1) {
        errors.push("Đơn vị không hợp lệ hoặc trùng tên: " + text(v));
        return "";
      }
      return matches[0].id;
    };
    const unitValue =
      text(get("Đơn vị chủ trì")) || options.defaultUnitId || "";
    const unit = unitValue ? resolveUnit(unitValue) : "";
    if (!unit) errors.push("Thiếu đơn vị chủ trì");
    const partners = text(get("Đơn vị phối hợp"))
      .split(";")
      .map((v) => v.trim())
      .filter(Boolean)
      .map(resolveUnit);
    if (partners.includes(unit))
      errors.push("Chủ trì không đồng thời là đơn vị phối hợp");
    const partnerUpdateValue = norm(get("Yêu cầu thông tin phối hợp"));
    const yesValues = ["có", "co", "yes", "true", "1", "x"];
    const noValues = ["không", "khong", "no", "false", "0"];
    if (
      partnerUpdateValue &&
      !yesValues.includes(partnerUpdateValue) &&
      !noValues.includes(partnerUpdateValue)
    )
      errors.push("Yêu cầu thông tin phối hợp chỉ nhận Có hoặc Không");
    const partnerUpdateRequired = partnerUpdateValue
      ? yesValues.includes(partnerUpdateValue)
      : (old?.partnerUpdateRequired ?? partners.length > 0);
    if (partnerUpdateRequired && !partners.length)
      errors.push("Chỉ yêu cầu thông tin phối hợp khi đã chọn đơn vị phối hợp");
    const owner = text(get("Người phụ trách"));
    const assignedDate = date(get("Ngày giao")) || `${period}-01`,
      due = date(get("Thời hạn hoàn thành"));
    for (const [label, v] of [
      ["Ngày giao", assignedDate],
      ["Thời hạn", due],
    ]) {
      const d = new Date(v + "T00:00:00Z");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
        Number.isNaN(+d) ||
        d.toISOString().slice(0, 10) !== v
      )
        errors.push(label + " không hợp lệ");
    }
    if (due < assignedDate) errors.push("Thời hạn phải từ ngày giao trở đi");
    const assignedTime = time(get("Giờ giao"));
    if (assignedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(assignedTime))
      errors.push("Giờ giao không hợp lệ");
    const freqMap: any = {
      "theo lịch chung": "default",
      "theo lịch chung của hệ thống": "default",
      default: "default",
      "hằng ngày": "daily",
      daily: "daily",
      "hằng tuần": "weekly",
      weekly: "weekly",
    };
    const fv = norm(get("Chế độ báo cáo"));
    const reportFrequency = fv
      ? freqMap[fv]
      : old?.reportFrequency || "default";
    if (!reportFrequency) errors.push("Chế độ báo cáo không hợp lệ");
    const reportHour =
      time(get("Giờ báo cáo")) ||
      old?.reportHour ||
      (reportFrequency === "default" ? cfg.hour : "");
    const reportDay = Number(
      get("Ngày báo cáo tuần") || old?.reportDay || cfg.day,
    );
    if (
      reportFrequency !== "default" &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(reportHour)
    )
      errors.push("Thiếu giờ báo cáo hợp lệ");
    if (
      reportFrequency === "weekly" &&
      (!Number.isInteger(reportDay) || reportDay < 1 || reportDay > 7)
    )
      errors.push("Ngày báo cáo tuần phải từ 1–7");
    const docNum = text(get("Số, ký hiệu văn bản"));
    const docs = data.documents.filter(
      (d: any) => norm(d.number) === norm(docNum),
    );
    if (docNum && docs.length !== 1)
      errors.push("Văn bản nguồn không có hoặc trùng số");
    const reason = text(get("Lý do điều chỉnh"));
    if (old && (old.unit !== unit || old.due !== due) && !reason)
      errors.push("Đổi chủ trì hoặc thời hạn cần lý do điều chỉnh");
    const version = get("Phiên bản");
    if (rid && version === "")
      errors.push("Cập nhật bằng ID cần giữ cột Phiên bản từ bảng xuất");
    if (old && version !== "" && Number(version) !== old.version)
      errors.push("Phiên bản đã thay đổi; tải bảng mới nhất");
    const target = Number(get("Chỉ tiêu") || 0);
    if (!Number.isFinite(target) || target < 0)
      errors.push("Chỉ tiêu phải là số không âm");
    const payload = {
      ...old,
      ...(old ? { id: old.id, version: old.version } : {}),
      importCode: old?.importCode || code,
      title,
      month: period,
      documentId: docNum ? docs[0]?.id : "",
      unit,
      partners: Array.from(new Set(partners)),
      partnerUpdateRequired,
      owner,
      leader: text(get("Lãnh đạo theo dõi")),
      assignedDate,
      assignedTime,
      due,
      reportFrequency,
      reportHour: reportHour || cfg.hour,
      reportDay,
      target,
      measure: text(get("Đơn vị tính")),
      output: text(get("Sản phẩm đầu ra")),
      note: text(get("Ghi chú")),
      reason,
    };
    result.push({
      row: i + 1,
      mode: old ? "update" : "create",
      payload,
      errors,
      saved: false,
    });
  }
  if (!result.length) throw new Error("File chưa có dòng nhiệm vụ.");
  if (result.length > 200) throw new Error("Mỗi lần nhập tối đa 200 nhiệm vụ.");
  return result;
}
