import { build } from "vite";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import * as X from "xlsx";
await build({
  configFile: false,
  build: {
    ssr: "lib/task-excel.ts",
    outDir: ".sites-runtime/import-test",
    rollupOptions: { output: { entryFileNames: "import.mjs" } },
  },
});
await build({
  configFile: false,
  build: {
    ssr: "lib/exports.ts",
    outDir: ".sites-runtime/export-test",
    rollupOptions: { output: { entryFileNames: "exports.mjs" } },
  },
});
const { parseTaskExcel, taskImportHeaders } = await import(
  pathToFileURL(process.cwd() + "/.sites-runtime/import-test/import.mjs")
);
const data = {
  tasks: [],
  units: [
    { id: "a", name: "Văn phòng Đảng ủy", active: true },
    { id: "b", name: "Ban Xây dựng Đảng", active: true },
  ],
  documents: [],
  periods: [],
  settings: {},
};
const legacyHeaders = [
  "Mã nhập",
  "ID hệ thống",
  "Phiên bản",
  "Tháng theo dõi",
  "Số, ký hiệu văn bản",
  "Nội dung nhiệm vụ",
  "Đơn vị chủ trì",
  "Đơn vị phối hợp",
  "Người phụ trách",
  "Lãnh đạo theo dõi",
  "Ngày giao",
  "Giờ giao",
  "Thời hạn hoàn thành",
  "Chế độ báo cáo",
  "Giờ báo cáo",
  "Ngày báo cáo tuần",
  "Chỉ tiêu",
  "Đơn vị tính",
  "Sản phẩm đầu ra",
  "Ghi chú",
  "Lý do điều chỉnh",
  "Yêu cầu thông tin phối hợp",
];
const valid = [
  "NV001",
  "",
  "",
  "2026-10",
  "",
  "Công việc kiểm thử",
  "Văn phòng Đảng ủy",
  "Ban Xây dựng Đảng",
  "Cán bộ kiểm thử",
  "",
  "02/10/2026",
  "14:20",
  "31/10/2026",
  "Hằng ngày",
  "15:30",
  "",
  100,
  "hồ sơ",
  "Báo cáo",
  "",
  "",
];
const bytes = (rr, heads = legacyHeaders) => {
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(
    wb,
    X.utils.aoa_to_sheet([heads, ...rr]),
    "Nhap nhiem vu",
  );
  return X.write(wb, { type: "array", bookType: "xlsx" });
};
let rows = await parseTaskExcel(bytes([valid]), data, "2026-10");
assert.deepEqual(rows[0].errors, []);
assert.equal(rows[0].payload.unit, "a");
assert.deepEqual(rows[0].payload.partners, ["b"]);
assert.equal(rows[0].payload.partnerUpdateRequired, true);
assert.equal(rows[0].payload.assignedDate, "2026-10-02");
assert.equal(rows[0].payload.reportHour, "15:30");
assert.equal(rows[0].mode, "create");
const simpleRow = [
  "Đề xuất từ mẫu gọn",
  "",
  "Ban Xây dựng Đảng",
  "",
  "31/10/2026",
  "",
  "",
  "NV202610_2_EXCEL001",
];
rows = await parseTaskExcel(
  bytes([simpleRow], taskImportHeaders),
  data,
  "2026-10",
  { defaultUnitId: "a", unitProposal: true },
);
assert.deepEqual(rows[0].errors, []);
assert.equal(rows[0].payload.unit, "a");
assert.equal(rows[0].payload.assignedDate, "2026-10-01");
assert.equal(rows[0].payload.title, "Đề xuất từ mẫu gọn");
const noPartnerUpdate = [...valid, "Không"];
rows = await parseTaskExcel(bytes([noPartnerUpdate]), data, "2026-10");
assert.equal(rows[0].payload.partnerUpdateRequired, false);
const invalidPartnerUpdate = [...valid, "Có thể"];
rows = await parseTaskExcel(bytes([invalidPartnerUpdate]), data, "2026-10");
assert.ok(rows[0].errors.some((e) => e.includes("Có hoặc Không")));
rows = await parseTaskExcel(bytes([valid, valid]), data, "2026-10");
assert.ok(rows[1].errors.some((e) => e.includes("lặp")));
const wrong = [...valid];
wrong[6] = "Sai tên đơn vị";
wrong[12] = "01/10/2026";
wrong[14] = "25:00";
rows = await parseTaskExcel(bytes([wrong]), data, "2026-10");
assert.ok(rows[0].errors.length >= 3);
const old = {
  ...(await parseTaskExcel(bytes([valid]), data, "2026-10"))[0].payload,
  id: "real-id",
  version: 3,
  status: "working",
  progress: 60,
  restricted: true,
  allowedUsers: ["admin"],
};
data.tasks = [old];
rows = await parseTaskExcel(bytes([valid]), data, "2026-10");
assert.equal(rows[0].mode, "update");
assert.equal(rows[0].payload.id, "real-id");
assert.equal(rows[0].payload.restricted, true);
const stale = [...valid];
stale[1] = "real-id";
stale[2] = 2;
rows = await parseTaskExcel(bytes([stale]), data, "2026-10");
assert.ok(rows[0].errors.some((e) => e.includes("Phiên bản")));
const numeric = [...valid];
numeric[10] = 46297;
numeric[11] = (14 * 60 + 20) / 1440;
rows = await parseTaskExcel(
  bytes([numeric]),
  { ...data, tasks: [] },
  "2026-10",
);
assert.equal(rows[0].payload.assignedTime, "14:20");
assert.match(rows[0].payload.assignedDate, /^\d{4}-\d{2}-\d{2}$/);
console.log(
  "PASS Excel import: mapping, dates/time, unit resolution, duplicate codes, update IDs, stale versions and protected scope",
);

const { exportAssignmentExcel } = await import(
  pathToFileURL(process.cwd() + "/.sites-runtime/export-test/exports.mjs")
);
let blob;
const orig = URL.createObjectURL;
URL.createObjectURL = (b) => {
  blob = b;
  return orig(b);
};
globalThis.document = {
  body: { appendChild() {} },
  createElement: () => ({ click() {}, remove() {} }),
};
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback) => {
  callback();
  return 0;
};
await exportAssignmentExcel(
  { ...data, tasks: [old], files: [], reports: [] },
  "2026-10",
);
const roundtrip = await parseTaskExcel(
  await blob.arrayBuffer(),
  { ...data, files: [], reports: [] },
  "2026-10",
);
assert.deepEqual(roundtrip[0].errors, []);
assert.equal(roundtrip[0].mode, "update");
assert.equal(roundtrip[0].payload.id, old.id);
assert.equal(roundtrip[0].payload.version, 3);
assert.equal(roundtrip[0].payload.due, "2026-10-31");
assert.equal(roundtrip[0].payload.assignedDate, "2026-10-02");
assert.equal(roundtrip[0].payload.assignedTime, "14:20");
assert.equal(roundtrip[0].payload.progress, 60);
assert.equal(roundtrip[0].payload.partnerUpdateRequired, true);
globalThis.setTimeout = originalSetTimeout;
console.log(
  "PASS exported assignment workbook imports as update with dates, times and scope preserved",
);

// Hand-typed unit names, partner lists and date formats.
{
  const units = [
    { id: "kt", name: "Ban Kinh tế – Ngân sách HĐND", active: true },
    {
      id: "xd",
      name: "Phòng Xây dựng, Nông nghiệp và Môi trường",
      active: true,
    },
    { id: "pk", name: "Phòng Kinh tế", active: true },
    { id: "ca", name: "Công an xã", active: true },
    { id: "dt", name: "Đoàn Thanh niên", active: true },
  ];
  const d2 = { tasks: [], units, documents: [], periods: [], settings: {} };
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(
    wb,
    X.utils.aoa_to_sheet([
      taskImportHeaders,
      [
        "A",
        "Ban Kinh tế - Ngân sách HĐND",
        "Phòng Kinh tế, Phòng Xây dựng, Nông nghiệp và Môi trường",
        "2.11.2026",
        "30/11/26",
        "",
        "",
        "C1",
      ],
      [
        "B",
        "Công an",
        "Đoàn Thanh niên\nPhòng Kinh tế",
        "",
        "15-11-2026",
        "",
        "",
        "C2",
      ],
      ["C", "Phòng Kinh tế", "", "28/10/2026", "2026-11-20", "", "", "C3"],
    ]),
    "Nhap nhiem vu",
  );
  const bytes = X.write(wb, { type: "array", bookType: "xlsx" });
  const r = await parseTaskExcel(bytes, d2, "2026-11");
  assert.deepEqual(
    r.map((x) => x.errors),
    [[], [], []],
  );
  assert.equal(r[0].payload.unit, "kt");
  assert.deepEqual(r[0].payload.partners, ["pk", "xd"]);
  assert.equal(r[0].payload.assignedDate, "2026-11-02");
  assert.equal(r[0].payload.due, "2026-11-30");
  assert.equal(r[1].payload.unit, "ca");
  assert.deepEqual(r[1].payload.partners, ["dt", "pk"]);
  assert.equal(r[1].payload.assignedDate, "2026-11-01");
  assert.equal(r[2].warnings.length, 1, "assigned date outside period warns");
  // Re-import of saved rows: nothing re-saved, missing columns kept.
  const saved = r.map((x, i) => ({
    ...x.payload,
    id: "t" + i,
    version: 2,
    status: "assigned",
    owner: "Giữ nguyên",
    target: 5,
  }));
  const again = await parseTaskExcel(bytes, { ...d2, tasks: saved }, "2026-11");
  assert.ok(again.every((x) => x.mode === "update" && x.saved));
  assert.ok(
    again.every(
      (x) => x.payload.owner === "Giữ nguyên" && x.payload.target === 5,
    ),
  );
  console.log(
    "PASS hand-typed unit names, comma partners, date formats and idempotent re-import",
  );
}
