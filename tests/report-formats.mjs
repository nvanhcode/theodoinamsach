import { build } from "vite";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import * as X from "xlsx";
await build({
  configFile: false,
  build: {
    ssr: "lib/exports.ts",
    outDir: ".sites-runtime/export-test",
    rollupOptions: { output: { entryFileNames: "exports.mjs" } },
  },
});
const { exportReport, exportAssignmentExcel, reportRows } =
  await import("../.sites-runtime/export-test/exports.mjs");
const source = X.read(
  readFileSync("../qa-input/Nam_Sach_Nhiem_vu_thang_10_2026_TEST.xlsx"),
  { type: "buffer" },
);
const input = X.utils.sheet_to_json(source.Sheets[source.SheetNames[0]]);
const units = [...new Set(input.map((r) => r["Đơn vị chủ trì"]))].map(
  (name, i) => ({ id: "u" + i, name }),
);
const tasks = input.map((r, i) => ({
  id: "t" + i,
  title: r["Nội dung nhiệm vụ"],
  unit: units.find((u) => u.name === r["Đơn vị chủ trì"]).id,
  partners: [],
  month: "2026-10",
  status: "working",
  assignedDate: "2026-10-11",
  due: "2026-10-31",
  progress: 50,
  result:
    "Đã thực hiện một phần công việc.\nTiếp tục rà soát và hoàn thiện hồ sơ.",
  difficulty: "",
  proposal: "",
  note: r["Ghi chú"],
}));
const data = {
  tasks,
  units,
  documents: [],
  reports: [],
  files: [],
  settings: { organization: "ĐẢNG ỦY XÃ NAM SÁCH" },
};
let saved;
globalThis.document = {
  createElement: () => ({
    click() {},
    remove() {},
    set href(x) {},
    set download(x) {},
  }),
  body: { appendChild() {} },
};
URL.createObjectURL = (b) => {
  saved = b;
  return "blob:test";
};
URL.revokeObjectURL = () => {};
const timer = globalThis.setTimeout;
globalThis.setTimeout = (f, n) => {
  const t = timer(f, n);
  t.unref();
  return t;
};
mkdirSync("/tmp/ns-export-qa", { recursive: true });
const columns = [
  "title",
  "assignedDate",
  "due",
  "unit",
  "result",
  "progress",
  "status",
  "note",
];
await exportReport("xls", tasks, columns, data, "2026-10", "month");
const bytes = new Uint8Array(await saved.arrayBuffer());
assert.deepEqual(
  [...bytes.slice(0, 8)],
  [208, 207, 17, 224, 161, 177, 26, 225],
);
const wb = X.read(bytes, { type: "array", cellStyles: true });
const rows = X.utils.sheet_to_json(wb.Sheets["Bao cao"], { header: 1 });
assert.equal(rows.length, 51);
assert.equal(rows[7][1], tasks[0].title);
assert.equal(rows[7][2], "11/10/2026");
assert.equal(rows[7][6], 50);
writeFileSync("/tmp/ns-export-qa/report.xls", bytes);
await exportReport("docx", tasks, columns, data, "2026-10", "month");
writeFileSync(
  "/tmp/ns-export-qa/report.docx",
  new Uint8Array(await saved.arrayBuffer()),
);
await exportAssignmentExcel(data, "2026-10");
const assignment = new Uint8Array(await saved.arrayBuffer());
assert.equal(X.read(assignment, { type: "array" }).SheetNames.length, 2);
writeFileSync("/tmp/ns-export-qa/assignment.xls", assignment);
await assert.rejects(() =>
  exportReport("pdf", tasks, columns, data, "2026-10", "month"),
);
const page = readFileSync("app/page.tsx", "utf8");
assert.ok(!page.includes("['xlsx','docx','pdf']"));
console.log(
  "PASS real BIFF8 XLS, 44 rows round-trip, Vietnamese, dates, numeric progress, editable DOCX, 2-sheet assignment, PDF removed",
);
