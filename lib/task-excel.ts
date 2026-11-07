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
/**
 * Loose key for unit names typed by hand: unify dash variants (– — ‐ -),
 * collapse spaces (incl. non-breaking) and ignore spacing around dashes.
 */
export const unitKey = (v: any) =>
  norm(v)
    .replace(/[\u00a0\s]+/g, " ")
    .replace(/\s*[-‐‑‒–—―]\s*/g, " - ")
    .replace(/[.。]+$/, "")
    .trim();
/** Excel date serial, d/m/yyyy, d-m-yyyy, d.m.yyyy, d/m/yy, yyyy-mm-dd. */
export function excelDate(v: any, date1904 = false, X?: any) {
  if (v instanceof Date && !Number.isNaN(+v))
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(v);
  if (typeof v === "number" && X) {
    const d = X.SSF.parse_date_code(v, { date1904 });
    return d
      ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`
      : "";
  }
  const s = String(v ?? "").trim();
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
  if (iso)
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const m = s.match(
    /^(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{2}|\d{4})(?:\s.*)?$/,
  );
  if (m) {
    const year = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return s;
}
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
  // Date columns are text cells: "02/11/2026" stays day/month whatever the
  // regional settings of the Excel that fills the file.
  for (let r = 2; r <= 201; r++)
    for (const c of ["D", "E"]) ws[c + r] = { t: "s", v: "", z: "@" };
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
    [
      "Cần nhập",
      "Nội dung nhiệm vụ, đơn vị chủ trì và thời hạn hoàn thành. Ghi ngày theo ngày/tháng/năm, ví dụ 02/11/2026.",
    ],
    [
      "Đơn vị chủ trì",
      options.defaultUnitId
        ? "Để trống để dùng đơn vị của tài khoản đang đăng nhập; có thể chọn đơn vị khác trong phạm vi được giao."
        : "Chọn tên đơn vị trong Danh muc don vi.",
    ],
    [
      "Đơn vị phối hợp",
      "Không bắt buộc. Nếu có, ghi tên các đơn vị và ngăn cách bằng dấu chấm phẩy (;) hoặc xuống dòng.",
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
  const unitCount = data.units.filter((u: any) => u.active).length;
  return addUnitDropdown(
    X,
    new Uint8Array(X.write(wb, { bookType: "xlsx", type: "array" })),
    unitCount,
  );
}

/**
 * SheetJS cannot write data validation, so add the "Đơn vị chủ trì" dropdown
 * (list from sheet "Danh muc don vi") straight into the sheet XML.
 */
function addUnitDropdown(X: any, bytes: Uint8Array, unitCount: number) {
  if (!unitCount) return bytes;
  try {
    const zip = X.CFB.read(bytes, { type: "array" });
    const index = zip.FullPaths.findIndex((p: string) =>
      p.endsWith("/xl/worksheets/sheet1.xml"),
    );
    if (index < 0) return bytes;
    const entry = zip.FileIndex[index];
    const xml = new TextDecoder().decode(entry.content);
    const validation =
      '<dataValidations count="1"><dataValidation type="list" errorStyle="warning" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Đơn vị chưa có trong danh mục" error="Chọn tên đơn vị trong danh sách để hệ thống nhận đúng." promptTitle="Đơn vị chủ trì" prompt="Chọn trong danh sách đơn vị." sqref="B2:B201"><formula1>\'Danh muc don vi\'!$A$2:$A$' +
      (unitCount + 1) +
      "</formula1></dataValidation></dataValidations>";
    const at = ["<ignoredErrors", "<pageMargins", "</worksheet>"]
      .map((tag) => xml.indexOf(tag))
      .find((i) => i >= 0);
    if (at === undefined || xml.includes("<dataValidations")) return bytes;
    entry.content = new TextEncoder().encode(
      xml.slice(0, at) + validation + xml.slice(at),
    );
    entry.size = entry.content.length;
    return new Uint8Array(X.CFB.write(zip, { fileType: "zip", type: "array" }));
  } catch {
    return bytes;
  }
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
  const present = (name: string) => headers.includes(norm(name));
  const text = (v: any) => String(v ?? "").trim();
  const cfg = { ...defaults, ...data.settings };
  const seen = new Set<string>();
  const result: any[] = [];
  const date = (v: any) => excelDate(v, !!book.Workbook?.WBProps?.date1904, X);
  const time = (v: any) => {
    if (typeof v === "number") {
      const n = Math.round((v % 1) * 1440);
      return `${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
    }
    return text(v);
  };
  const activeUnits = data.units.filter((u: any) => u.active);
  const findUnit = (v: any): string => {
    const exact = norm(v);
    const byExact = activeUnits.filter(
      (u: any) => norm(u.id) === exact || norm(u.name) === exact,
    );
    if (byExact.length === 1) return byExact[0].id;
    if (byExact.length > 1) return "";
    const key = unitKey(v);
    const byKey = activeUnits.filter((u: any) => unitKey(u.name) === key);
    if (byKey.length === 1) return byKey[0].id;
    if (byKey.length > 1) return "";
    // "UBND" ↔ "UBND xã", "Công an" ↔ "Công an xã"…
    const bare = (s: string) => s.replace(/ xã$/, "");
    const byBare = activeUnits.filter(
      (u: any) => bare(unitKey(u.name)) === bare(key),
    );
    return byBare.length === 1 ? byBare[0].id : "";
  };
  // Partners are separated by ";" or line breaks. Commas are accepted too, but
  // only where they do not belong to a unit name such as
  // "Phòng Xây dựng, Nông nghiệp và Môi trường".
  const splitUnits = (value: string) =>
    value
      .split(/[;\n\r]+/)
      .map((v) => v.trim())
      .filter(Boolean)
      .flatMap((part) => {
        if (findUnit(part) || !part.includes(",")) return [part];
        const pieces = part.split(",").map((v) => v.trim());
        const out: string[] = [];
        let i = 0;
        while (i < pieces.length) {
          let j = pieces.length;
          while (j > i + 1 && !findUnit(pieces.slice(i, j).join(", "))) j--;
          out.push(pieces.slice(i, j).join(", "));
          i = j;
        }
        return out.filter(Boolean);
      });
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
    // Columns missing from the file (the quick template has only a few) keep
    // the existing task's value instead of wiping it.
    const keep = (name: string, field: string) =>
      old && !present(name) ? old[field] || "" : text(get(name));
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
      const id = findUnit(v);
      if (!id) {
        errors.push("Đơn vị không hợp lệ hoặc trùng tên: " + text(v));
        return "";
      }
      return id;
    };
    const unitValue =
      text(get("Đơn vị chủ trì")) || options.defaultUnitId || "";
    const unit = unitValue ? resolveUnit(unitValue) : "";
    if (!unit) errors.push("Thiếu đơn vị chủ trì");
    const partners =
      old && !present("Đơn vị phối hợp")
        ? [...(old.partners || [])]
        : splitUnits(text(get("Đơn vị phối hợp"))).map(resolveUnit);
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
    const owner = keep("Người phụ trách", "owner");
    const assignedDate =
        date(get("Ngày giao")) || old?.assignedDate || `${period}-01`,
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
    const assignedTime =
      old && !present("Giờ giao")
        ? old.assignedTime || ""
        : time(get("Giờ giao"));
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
    const target =
      old && !present("Chỉ tiêu")
        ? Number(old.target) || 0
        : Number(get("Chỉ tiêu") || 0);
    if (!Number.isFinite(target) || target < 0)
      errors.push("Chỉ tiêu phải là số không âm");
    const payload = {
      ...old,
      ...(old ? { id: old.id, version: old.version } : {}),
      importCode: old?.importCode || code,
      title,
      month: period,
      documentId:
        old && !present("Số, ký hiệu văn bản")
          ? old.documentId || ""
          : docNum
            ? docs[0]?.id
            : "",
      unit,
      partners: Array.from(new Set(partners)),
      partnerUpdateRequired,
      owner,
      leader: keep("Lãnh đạo theo dõi", "leader"),
      assignedDate,
      assignedTime,
      due,
      reportFrequency,
      reportHour: reportHour || cfg.hour,
      reportDay,
      target,
      measure: keep("Đơn vị tính", "measure"),
      output: keep("Sản phẩm đầu ra", "output"),
      note: keep("Ghi chú", "note"),
      reason,
    };
    // Re-importing the same file (e.g. after fixing error rows) must not
    // re-save, re-notify or bump versions of rows already in the system.
    const unchanged =
      !!old &&
      !errors.length &&
      [
        "title",
        "documentId",
        "unit",
        "owner",
        "leader",
        "assignedDate",
        "assignedTime",
        "due",
        "measure",
        "output",
        "note",
        "reportFrequency",
      ].every(
        (k) => String(old[k] ?? "") === String((payload as any)[k] ?? ""),
      ) &&
      Number(old.target || 0) === Number(payload.target || 0) &&
      [...(old.partners || [])].sort().join("|") ===
        [...payload.partners].sort().join("|");
    const warnings: string[] = [];
    const typedAssigned = date(get("Ngày giao"));
    if (typedAssigned && typedAssigned.slice(0, 7) !== period)
      warnings.push(
        `Ngày giao thuộc tháng ${Number(typedAssigned.slice(5, 7))}/${typedAssigned.slice(0, 4)}, nhiệm vụ sẽ vào kỳ ${Number(period.slice(5))}/${period.slice(0, 4)}`,
      );
    result.push({
      row: i + 1,
      warnings,
      mode: old ? "update" : "create",
      payload,
      errors,
      saved: unchanged,
      ...(unchanged ? { message: "Đã có trong hệ thống, không thay đổi" } : {}),
    });
  }
  if (!result.length) throw new Error("File chưa có dòng nhiệm vụ.");
  if (result.length > 200) throw new Error("Mỗi lần nhập tối đa 200 nhiệm vụ.");
  return result;
}
