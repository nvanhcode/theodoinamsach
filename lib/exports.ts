import { legacyExcel } from "./legacy-excel";
import {
  stateNames,
  reportScheduleLabel,
  deadlineState,
  reportState,
  defaults,
} from "./domain";
export const exportColumns: Record<string, string> = {
  number: "Số văn bản",
  document: "Trích yếu văn bản",
  title: "Nội dung nhiệm vụ",
  assignedDate: "Ngày giao",
  assignedTime: "Giờ giao",
  originalDue: "Thời hạn gốc",
  due: "Thời hạn hiện hành",
  unit: "Đơn vị chủ trì",
  partners: "Đơn vị phối hợp",
  owner: "Người phụ trách",
  leader: "Lãnh đạo theo dõi",
  reportSchedule: "Lịch báo cáo",
  lastReport: "Thời gian báo cáo",
  result: "Kết quả thực hiện",
  progress: "Tiến độ (%)",
  status: "Trạng thái",
  difficulty: "Khó khăn, vướng mắc",
  proposal: "Kiến nghị, đề xuất",
  updated: "Cập nhật",
  evidence: "Minh chứng",
  note: "Ghi chú",
};
function save(bytes: any, name: string, mime: string) {
  const blob = new Blob([bytes], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
export function reportRows(tasks: any[], columns: string[], data: any) {
  const un = (id: string) =>
    data.units.find((u: any) => u.id === id)?.name || "";
  return tasks.map((t: any, i: number) => {
    const doc = data.documents.find((d: any) => d.id === t.documentId) || {};
    const r = {
      ...t,
      reportSchedule: reportScheduleLabel(t, data.settings),
      number: doc.number || "",
      document: doc.title || "",
      unit: un(t.unit),
      partners: t.partners?.map(un).join("; "),
      status: stateNames[t.status],
      evidence: data.files
        .filter((f: any) => f.parent_id === t.id || f.taskId === t.id)
        .map((f: any) => f.name)
        .join("; "),
    };
    return [
      String(i + 1),
      ...columns.map((c) => {
        const value = String(r[c] ?? "");
        if (
          ["assignedDate", "due", "originalDue"].includes(c) &&
          /^\d{4}-\d{2}-\d{2}$/.test(value)
        )
          return value.split("-").reverse().join("/");
        if (
          ["updated", "lastReport"].includes(c) &&
          value &&
          !Number.isNaN(Date.parse(value))
        )
          return new Date(value).toLocaleString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
          });
        return value;
      }),
    ];
  });
}
export async function exportReport(
  format: string,
  tasks: any[],
  columns: string[],
  data: any,
  month: string,
  range: string,
) {
  const names = columns.map((c) => exportColumns[c]);
  const un = (id: string) =>
    data.units.find((u: any) => u.id === id)?.name || "";
  const rows = reportRows(tasks, columns, data);
  const headers = ["TT", ...names];
  const title = "BÁO CÁO KẾT QUẢ THỰC HIỆN KẾT LUẬN, CHỈ ĐẠO";
  const period =
    range === "week"
      ? "Báo cáo tuần hiện tại"
      : range === "custom"
        ? "Báo cáo theo khoảng ngày giao đã chọn"
        : range === "year"
          ? "Năm " + month.slice(0, 4)
          : range === "quarter"
            ? "Quý " +
              Math.ceil(Number(month.slice(5)) / 3) +
              "/" +
              month.slice(0, 4)
            : "Tháng " + Number(month.slice(5)) + "/" + month.slice(0, 4);
  const org = data.settings.organization;
  const filename = "Bao-cao-Nam-Sach-" + range + "-" + month + "." + format;
  if (!["xls", "docx"].includes(format))
    throw new Error("Chọn Excel 97–2003 (.xls) hoặc Word (.docx).");
  const widths = headers.map((h, i) =>
    i === 0
      ? 5
      : [
            "title",
            "document",
            "result",
            "difficulty",
            "proposal",
            "note",
          ].includes(columns[i - 1])
        ? 48
        : [
              "unit",
              "partners",
              "owner",
              "leader",
              "reportSchedule",
              "evidence",
            ].includes(columns[i - 1])
          ? 28
          : 18,
  );
  if (format === "xls") {
    const X = await import("xlsx");
    const aoa: any[][] = [
      [org],
      ["VĂN PHÒNG ĐẢNG ỦY"],
      ["ĐẢNG CỘNG SẢN VIỆT NAM"],
      [title],
      [period],
      ["Tổng số: " + tasks.length + " nhiệm vụ"],
      headers,
      ...rows.map((row) =>
        row.map((v, i) =>
          i === 0 || columns[i - 1] === "progress" ? Number(v) : v,
        ),
      ),
    ];
    const ws = X.utils.aoa_to_sheet(aoa);
    ws["!cols"] = widths.map((wch) => ({ wch }));
    ws["!merges"] = [0, 1, 2, 3, 4, 5].map((r) => ({
      s: { r, c: 0 },
      e: { r, c: headers.length - 1 },
    }));
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, "Bao cao");
    save(await legacyExcel(wb, [6]), filename, "application/vnd.ms-excel");
  }
  if (format === "docx") {
    const D = await import("docx");
    const wide = columns.length > 10;
    const pageWidth = wide ? 23811 : 16838,
      pageHeight = wide ? 16838 : 11906,
      usable = pageWidth - 1700;
    const total = widths.reduce((a, b) => a + b, 0);
    const colWidths = widths.map((w) => Math.floor((w / total) * usable));
    const p = (text: string, bold = false, center = false, size = 22) =>
      new D.Paragraph({
        alignment: center ? D.AlignmentType.CENTER : D.AlignmentType.LEFT,
        spacing: { after: 80, line: 260 },
        children: [
          new D.TextRun({ text, bold, size, font: "Times New Roman" }),
        ],
      });
    const cell = (text: string, bold = false, i = 0, center = false) =>
      new D.TableCell({
        width: { size: colWidths[i], type: D.WidthType.DXA },
        verticalAlign: D.VerticalAlign.TOP,
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        shading: bold ? { fill: "E7E6E6" } : undefined,
        children: text.split("\n").map((line) => p(line, bold, center)),
      });
    const line = { style: D.BorderStyle.SINGLE, size: 4, color: "666666" };
    const doc = new D.Document({
      sections: [
        {
          properties: {
            page: {
              size: { width: pageWidth, height: pageHeight },
              margin: { top: 850, bottom: 850, left: 850, right: 850 },
            },
          },
          footers: {
            default: new D.Footer({
              children: [
                new D.Paragraph({
                  alignment: D.AlignmentType.CENTER,
                  children: [
                    new D.TextRun({
                      text: "Trang ",
                      font: "Times New Roman",
                      size: 20,
                    }),
                    new D.TextRun({
                      children: [D.PageNumber.CURRENT],
                      font: "Times New Roman",
                      size: 20,
                    }),
                  ],
                }),
              ],
            }),
          },
          children: [
            new D.Table({
              width: { size: usable, type: D.WidthType.DXA },
              columnWidths: [usable / 2, usable / 2],
              borders: {
                top: { style: D.BorderStyle.NONE },
                bottom: { style: D.BorderStyle.NONE },
                left: { style: D.BorderStyle.NONE },
                right: { style: D.BorderStyle.NONE },
                insideHorizontal: { style: D.BorderStyle.NONE },
                insideVertical: { style: D.BorderStyle.NONE },
              },
              rows: [
                new D.TableRow({
                  children: [
                    new D.TableCell({
                      children: [
                        p(org, true, true),
                        p("VĂN PHÒNG ĐẢNG ỦY", true, true),
                      ],
                    }),
                    new D.TableCell({
                      children: [
                        p("ĐẢNG CỘNG SẢN VIỆT NAM", true, true),
                        p("Nam Sách, ngày … tháng … năm …", false, true),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            p("BÁO CÁO", true, true, 28),
            p("Kết quả thực hiện kết luận, chỉ đạo", true, true, 24),
            p(period, false, true),
            p("Tổng số: " + tasks.length + " nhiệm vụ"),
            new D.Table({
              width: { size: usable, type: D.WidthType.DXA },
              layout: D.TableLayoutType.FIXED,
              columnWidths: colWidths,
              borders: {
                top: line,
                bottom: line,
                left: line,
                right: line,
                insideHorizontal: line,
                insideVertical: line,
              },
              rows: [
                new D.TableRow({
                  tableHeader: true,
                  children: headers.map((h, i) => cell(h, true, i, true)),
                }),
                ...rows.map(
                  (row) =>
                    new D.TableRow({
                      children: row.map((v, i) =>
                        cell(
                          v || "—",
                          false,
                          i,
                          i === 0 || columns[i - 1] === "progress",
                        ),
                      ),
                    }),
                ),
              ],
            }),
            p(""),
            p(
              "NGƯỜI LẬP BÁO CÁO                                      NGƯỜI DUYỆT",
              true,
              true,
            ),
            p(
              "(Ký, ghi rõ họ tên)                                      (Ký, ghi rõ họ tên)",
              false,
              true,
            ),
          ],
        },
      ],
    });
    save(
      await D.Packer.toBlob(doc),
      filename,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  }
}

export function assignmentTasks(data: any, month: string, scope: any = {}) {
  return data.tasks
    .filter(
      (t: any) =>
        t.month === month &&
        (!scope.unit || t.unit === scope.unit) &&
        (!scope.group || t.group === scope.group),
    )
    .sort(
      (a: any, b: any) =>
        a.due.localeCompare(b.due) || a.title.localeCompare(b.title, "vi"),
    );
}
export async function exportAssignmentExcel(
  data: any,
  month: string,
  scope: any = {},
) {
  const X = await import("xlsx");
  const cfg = { ...defaults, ...data.settings };
  const ts = assignmentTasks(data, month, scope);
  const un = (id: string) =>
    data.units.find((u: any) => u.id === id)?.name || "";
  const date = (s: string) =>
    s
      ? (Date.parse(s + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000
      : null;
  const heads = [
    "TT",
    "Mã nhiệm vụ",
    "Số, ký hiệu văn bản",
    "Trích yếu văn bản",
    "Nội dung nhiệm vụ",
    "Khối cơ quan",
    "Đơn vị chủ trì",
    "Đơn vị phối hợp",
    "Người phụ trách",
    "Lãnh đạo theo dõi",
    "Ngày giao",
    "Giờ giao",
    "Thời hạn hoàn thành",
    "Lịch báo cáo",
    "Chỉ tiêu",
    "Đơn vị tính",
    "Sản phẩm đầu ra",
    "Tiến độ",
    "Trạng thái",
    "Tình trạng thời hạn",
    "Tình trạng báo cáo",
    "Kết quả thực hiện",
    "Khó khăn, vướng mắc",
    "Kiến nghị, đề xuất",
    "Minh chứng",
    "Ghi chú",
    "Mã nhập",
    "ID hệ thống",
    "Phiên bản",
    "Tháng theo dõi",
    "Chế độ báo cáo",
    "Giờ báo cáo",
    "Ngày báo cáo tuần",
    "Lý do điều chỉnh",
  ];
  const deadlines: any = {
    overdue: "Quá hạn",
    soon: "Sắp đến hạn",
    onTime: "Trong hạn",
    done: "Hoàn thành đúng hạn",
    doneLate: "Hoàn thành sau hạn",
    inactive: "Tạm ngừng theo dõi",
  };
  const reports: any = {
    notRequired: "Không yêu cầu kỳ này",
    notDue: "Chưa đến hạn",
    onTime: "Đã gửi đúng hạn",
    late: "Đã gửi chậm",
    missing: "Chưa gửi, đã quá hạn",
    returned: "Cần bổ sung",
  };
  const rows = ts.map((t: any, i: number) => {
    const doc = data.documents.find((d: any) => d.id === t.documentId) || {};
    const time = t.assignedTime ? t.assignedTime.split(":").map(Number) : null;
    return [
      i + 1,
      "NV-" + t.month.replace("-", "") + "-" + t.id.slice(0, 5).toUpperCase(),
      doc.number || "",
      doc.title || "",
      t.title,
      t.group || "",
      un(t.unit),
      (t.partners || []).map(un).join("; "),
      t.owner || "",
      t.leader || "",
      date(t.assignedDate),
      time ? (time[0] * 60 + time[1]) / 1440 : null,
      date(t.due),
      reportScheduleLabel(t, cfg),
      Number(t.target) || 0,
      t.measure || "",
      t.output || "",
      (Number(t.progress) || 0) / 100,
      stateNames[t.status] || t.status,
      deadlines[deadlineState(t, new Date(), cfg.warningDays)],
      reports[reportState(t, data.reports, new Date(), cfg)],
      t.result || "",
      t.difficulty || "",
      t.proposal || "",
      data.files
        .filter((f: any) => f.parent_id === t.id || f.taskId === t.id)
        .map((f: any) => f.name)
        .join("; "),
      t.note || "",
      t.importCode || "",
      t.id,
      t.version,
      t.month,
      (
        {
          default: "Theo lịch chung",
          daily: "Hằng ngày",
          weekly: "Hằng tuần",
        } as any
      )[t.reportFrequency || "default"],
      t.reportHour || cfg.hour,
      t.reportDay || cfg.day,
      "",
    ];
  });
  const stamp = new Date().toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const ws = X.utils.aoa_to_sheet(
    [
      [cfg.organization],
      ["BẢNG GIAO NHIỆM VỤ VÀ THEO DÕI THỰC HIỆN"],
      ["Tháng " + Number(month.slice(5)) + "/" + month.slice(0, 4)],
      ["Cập nhật từ website lúc " + stamp + " · " + ts.length + " nhiệm vụ"],
      heads,
      ...rows,
    ],
    { cellDates: false },
  );
  ws["!cols"] = heads.map((h, i) => ({
    wch:
      i === 0
        ? 5
        : [4, 3, 21, 22, 23].includes(i)
          ? 48
          : [6, 7, 13].includes(i)
            ? 30
            : Math.max(16, h.length + 2),
  }));
  ws["!merges"] = [0, 1, 2, 3].map((r) => ({
    s: { r, c: 0 },
    e: { r, c: heads.length - 1 },
  }));
  ws["!autofilter"] = {
    ref:
      "A5:" + X.utils.encode_cell({ r: rows.length + 4, c: heads.length - 1 }),
  };
  for (let r = 5; r < rows.length + 5; r++) {
    for (const c of [10, 12]) {
      const cell = ws[X.utils.encode_cell({ r, c })];
      if (cell) cell.z = "dd/mm/yyyy";
    }
    const tm = ws[X.utils.encode_cell({ r, c: 11 })];
    if (tm) tm.z = "hh:mm";
    const pr = ws[X.utils.encode_cell({ r, c: 17 })];
    if (pr) pr.z = "0%";
  }
  const book = X.utils.book_new();
  X.utils.book_append_sheet(book, ws, "Giao nhiem vu");
  const unitIds = Array.from(new Set(ts.map((t: any) => t.unit))) as string[];
  const summary = X.utils.aoa_to_sheet([
    [cfg.organization],
    [
      "TỔNG HỢP THEO ĐƠN VỊ · " +
        Number(month.slice(5)) +
        "/" +
        month.slice(0, 4),
    ],
    [],
    [
      "TT",
      "Đơn vị chủ trì",
      "Tổng nhiệm vụ",
      "Đã hoàn thành",
      "Quá hạn nhiệm vụ",
      "Chậm báo cáo",
      "Tiến độ bình quân",
    ],
    ...unitIds.map((id: string, i: number) => {
      const tt = ts.filter((t: any) => t.unit === id);
      return [
        i + 1,
        un(id),
        tt.length,
        tt.filter((t: any) => t.status === "done").length,
        tt.filter((t: any) => deadlineState(t) === "overdue").length,
        tt.filter((t: any) =>
          ["missing", "late"].includes(
            reportState(t, data.reports, new Date(), cfg),
          ),
        ).length,
        tt.reduce((n: number, t: any) => n + (Number(t.progress) || 0), 0) /
          tt.length /
          100,
      ];
    }),
  ]);
  summary["!cols"] = [
    { wch: 5 },
    { wch: 45 },
    ...Array.from({ length: 5 }, () => ({ wch: 22 })),
  ];
  summary["!autofilter"] = { ref: "A4:G" + (unitIds.length + 4) };
  for (let r = 4; r < unitIds.length + 4; r++)
    summary[X.utils.encode_cell({ r, c: 6 })].z = "0%";
  X.utils.book_append_sheet(book, summary, "Tong hop don vi");
  save(
    await legacyExcel(book, [4, 3]),
    "Bang-giao-nhiem-vu-" + month + ".xls",
    "application/vnd.ms-excel",
  );
}
