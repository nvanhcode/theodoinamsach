import { build } from "vite";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as X from "xlsx";
await build({
  configFile: false,
  build: {
    ssr: "lib/task-excel.ts",
    outDir: ".sites-runtime/ready-template-test",
    rollupOptions: { output: { entryFileNames: "parser.mjs" } },
  },
});
const { parseTaskExcel, taskImportHeaders } = await import(
  pathToFileURL(
    process.cwd() + "/.sites-runtime/ready-template-test/parser.mjs",
  )
);
const wb = X.read(
  readFileSync("public/templates/Mau-nhap-nhiem-vu-Nam-Sach.xlsx"),
  { type: "buffer" },
);
assert.deepEqual(wb.SheetNames, [
  "Nhap nhiem vu",
  "Danh muc don vi",
  "Huong dan",
]);
assert.deepEqual(
  X.utils.sheet_to_json(wb.Sheets["Nhap nhiem vu"], { header: 1 })[0],
  taskImportHeaders,
);
assert.equal(X.utils.sheet_to_json(wb.Sheets["Danh muc don vi"]).length, 23);
const data = {
  tasks: [],
  units: [{ id: "real-id", name: "Văn phòng Đảng ủy", active: true }],
  periods: [],
  documents: [],
  settings: {},
};
const values = {
  "Mã nhập": "TEST_01",
  "Nội dung nhiệm vụ": "Kiểm tra mẫu có sẵn",
  "Đơn vị chủ trì": "Văn phòng Đảng ủy",
  "Người phụ trách": "Cán bộ kiểm thử",
  "Ngày giao": "01/11/2026",
  "Thời hạn hoàn thành": "30/11/2026",
};
X.utils.sheet_add_aoa(
  wb.Sheets["Nhap nhiem vu"],
  [taskImportHeaders.map((h) => values[h] || "")],
  { origin: "A2" },
);
const rows = await parseTaskExcel(
  X.write(wb, { type: "array", bookType: "xlsx" }),
  data,
  "2026-11",
);
assert.equal(rows.length, 1);
assert.deepEqual(rows[0].errors, []);
assert.equal(rows[0].payload.unit, "real-id");
assert.equal(rows[0].payload.month, "2026-11");
assert.equal(rows[0].payload.due, "2026-11-30");
console.log(
  "PASS ready XLSX headers, blank input rows, 23 reference units and import for selected month",
);
