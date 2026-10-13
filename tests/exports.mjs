import { build } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
await build({
  configFile: false,
  build: {
    ssr: "lib/exports.ts",
    outDir: ".sites-runtime/export-test",
    rollupOptions: { output: { entryFileNames: "exports.mjs" } },
  },
});
const { exportReport, exportAssignmentExcel, assignmentTasks } = await import(
  pathToFileURL(process.cwd() + "/.sites-runtime/export-test/exports.mjs")
);
let blobs = [];
const real = URL.createObjectURL;
URL.createObjectURL = (b) => {
  blobs.push(b);
  return real(b);
};
globalThis.document = { createElement: () => ({ click() {} }) };
const fetchOrig = globalThis.fetch;
globalThis.fetch = async (u) =>
  u === "/fonts/DejaVuSans.ttf"
    ? new Response(readFileSync("public/fonts/DejaVuSans.ttf"))
    : fetchOrig(u);
const data = {
  units: [{ id: "u", name: "Ban Xây dựng Đảng" }],
  documents: [],
  files: [],
  settings: { organization: "ĐẢNG ỦY XÃ NAM SÁCH" },
};
const rows = Array.from({ length: 45 }, (_, i) => ({
  id: "t" + i,
  title: "Nhiệm vụ kiểm thử tiếng Việt số " + i,
  unit: "u",
  due: "2026-10-31",
  status: "working",
  progress: 65,
}));
for (const format of ["xlsx", "docx"]) {
  await exportReport(
    format,
    rows,
    ["title", "unit", "due", "progress", "status"],
    data,
    "2026-10",
    "month",
  );
  const bytes = Buffer.from(await blobs.pop().arrayBuffer());
  assert.equal(bytes[0], 80);
  assert.equal(bytes[1], 75);
  writeFileSync(".sites-runtime/export-test/report." + format, bytes);
  if (format === "xlsx") {
    const X = await import("xlsx");
    const book = X.read(bytes);
    assert.equal(
      X.utils.sheet_to_json(book.Sheets["Bao cao"], { header: 1 }).length,
      50,
    );
  }
  console.log("PASS " + format + " real ZIP container, 45 rows");
}
const assignmentData = {
  ...data,
  reports: [],
  tasks: [
    {
      id: "real-task",
      month: "2026-10",
      title: "Nhiệm vụ đã cập nhật",
      group: "Khối Đảng",
      unit: "u",
      partners: [],
      assignedDate: "2026-10-02",
      assignedTime: "14:20",
      due: "2026-10-31",
      reportFrequency: "daily",
      reportHour: "15:30",
      status: "working",
      progress: 75,
      target: 100,
    },
    {
      id: "next",
      month: "2026-11",
      title: "Kỳ khác",
      due: "2026-11-30",
      unit: "u",
    },
  ],
};
assert.equal(assignmentTasks(assignmentData, "2026-10").length, 1);
assert.equal(
  assignmentTasks(assignmentData, "2026-10", { unit: "outside" }).length,
  0,
);
await exportAssignmentExcel(assignmentData, "2026-10");
const assignmentBytes = Buffer.from(await blobs.pop().arrayBuffer());
const X = await import("xlsx");
const ab = X.read(assignmentBytes);
assert.deepEqual(ab.SheetNames, ["Giao nhiem vu", "Tong hop don vi"]);
const as = ab.Sheets["Giao nhiem vu"];
assert.equal(as.E6.v, "Nhiệm vụ đã cập nhật");
assert.equal(as.K6.t, "n");
assert.equal(as.L6.t, "n");
assert.ok(Math.abs(as.L6.v - (14 * 60 + 20) / 1440) < 1e-8);
assert.equal(as.R6.v, 0.75);
assert.equal(as.N6.v, "Hằng ngày, trước 15:30");
assert.equal(ab.Sheets["Tong hop don vi"].C5.v, 1);
assert.equal(ab.Sheets["Tong hop don vi"].G5.v, 0.75);
writeFileSync(".sites-runtime/export-test/assignment.xlsx", assignmentBytes);
assignmentData.tasks[0].title = "Tên nhiệm vụ sửa lần hai";
await exportAssignmentExcel(assignmentData, "2026-10");
const newer = X.read(Buffer.from(await blobs.pop().arrayBuffer()));
assert.equal(newer.Sheets["Giao nhiem vu"].E6.v, "Tên nhiệm vụ sửa lần hai");
console.log(
  "PASS assignment Excel: month/unit filters, updated data, typed dates/time/progress, per-unit totals",
);
// jsPDF saves through a separate browser bridge; verify its output with the same Unicode font and table configuration.
const { jsPDF } = await import("jspdf");
const { autoTable } = await import("jspdf-autotable");
const pdf = new jsPDF({ orientation: "landscape" });
pdf.addFileToVFS(
  "DejaVuSans.ttf",
  readFileSync("public/fonts/DejaVuSans.ttf").toString("base64"),
);
pdf.addFont("DejaVuSans.ttf", "DejaVu", "normal");
pdf.setFont("DejaVu");
pdf.text(data.settings.organization, 10, 15);
autoTable(pdf, {
  startY: 20,
  head: [["Nhiệm vụ", "Đơn vị"]],
  body: rows.map((r) => [r.title, "Ban Xây dựng Đảng"]),
  styles: { font: "DejaVu", fontStyle: "normal" },
  headStyles: { fontStyle: "normal" },
});
const bytes = Buffer.from(pdf.output("arraybuffer"));
assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
assert.ok(pdf.getNumberOfPages() > 1);
writeFileSync(".sites-runtime/export-test/report.pdf", bytes);
console.log("PASS PDF Unicode font, multiple pages");
writeFileSync(
  "tests/EXPORT-RESULTS.txt",
  "XLSX: real workbook, 45 task rows; DOCX: real ZIP container; PDF: embedded Vietnamese font, multiple pages. Download button/browser rendering not automated.\n",
);
