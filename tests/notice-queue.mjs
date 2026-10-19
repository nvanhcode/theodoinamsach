import assert from "node:assert/strict";
import { build } from "vite";
import { pathToFileURL } from "node:url";

await build({
  configFile: false,
  build: {
    ssr: "lib/notice-queue.ts",
    outDir: ".sites-runtime/notice-queue-test",
    rollupOptions: { output: { entryFileNames: "notice-queue.mjs" } },
  },
});

const { pendingReportApprovals } = await import(
  pathToFileURL(
    process.cwd() + "/.sites-runtime/notice-queue-test/notice-queue.mjs",
  )
);
const tasks = [
  { id: "this-month", title: "Nhiệm vụ tháng này", month: "2026-10" },
  { id: "other-month", title: "Nhiệm vụ tháng khác", month: "2026-09" },
];
const reports = [
  {
    id: "mine",
    taskId: "this-month",
    unit: "a",
    state: "submitted",
    submitted: "2026-10-10T10:00:00Z",
  },
  {
    id: "other-unit",
    taskId: "this-month",
    unit: "b",
    state: "submitted",
    submitted: "2026-10-11T10:00:00Z",
  },
  {
    id: "draft",
    taskId: "this-month",
    unit: "a",
    state: "draft",
    submitted: "2026-10-12T10:00:00Z",
  },
  {
    id: "older",
    taskId: "other-month",
    unit: "a",
    state: "submitted",
    submitted: "2026-10-09T10:00:00Z",
  },
];

assert.deepEqual(
  pendingReportApprovals(
    reports,
    tasks,
    { roles: ["admin"], units: [] },
    "2026-10",
  ).map((report) => report.id),
  ["other-unit", "mine"],
);
assert.deepEqual(
  pendingReportApprovals(
    reports,
    tasks,
    { roles: ["head"], units: ["a"] },
    "2026-10",
  ).map((report) => report.id),
  ["mine"],
);
assert.deepEqual(
  pendingReportApprovals(
    reports,
    tasks,
    { roles: ["editor"], units: ["a"] },
    "2026-10",
  ),
  [],
);
console.log(
  "PASS pending approval queue respects month and review permissions",
);

await build({
  configFile: false,
  build: {
    ssr: "lib/notice-priority.ts",
    outDir: ".sites-runtime/notice-priority-test",
    rollupOptions: { output: { entryFileNames: "notice-priority.mjs" } },
  },
});
const { noticePriority } = await import(
  pathToFileURL(
    process.cwd() + "/.sites-runtime/notice-priority-test/notice-priority.mjs",
  )
);
assert.ok(
  noticePriority("Nhiệm vụ quá hạn").rank <
    noticePriority("Báo cáo đơn vị cần phê duyệt").rank,
);
assert.ok(
  noticePriority("Báo cáo đơn vị cần phê duyệt").rank <
    noticePriority("Thông tin phối hợp mới").rank,
);
assert.equal(noticePriority("Yêu cầu báo cáo tháng").rank, 0);
assert.equal(noticePriority("Đề nghị cập nhật tiến độ").rank, 0);
assert.equal(noticePriority("Thông tin phối hợp mới").tone, "coordination");
console.log("PASS shared notice priority order and color categories");

await build({
  configFile: false,
  build: {
    ssr: "lib/notice-receipts.ts",
    outDir: ".sites-runtime/notice-receipts-test",
    rollupOptions: { output: { entryFileNames: "notice-receipts.mjs" } },
  },
});
const { noticeRecipientStatus, unreadNoticeRecipientCount } = await import(
  pathToFileURL(
    process.cwd() +
      "/.sites-runtime/notice-receipts-test/notice-receipts.mjs",
  )
);
const receiptUsers = [
  { id: "a1", name: "Đơn vị A", units: ["a"], active: true },
  { id: "a2", name: "Đầu mối A 2", units: ["a"], active: true },
  { id: "b1", name: "Đơn vị B", units: ["b"], active: true },
  { id: "inactive", units: ["b"], active: false },
];
const receiptNotice = {
  audienceUnits: ["a", "b"],
  readBy: ["a1"],
};
assert.equal(unreadNoticeRecipientCount([receiptNotice], receiptUsers), 2);
assert.deepEqual(
  noticeRecipientStatus(receiptNotice, receiptUsers).map((row) => [
    row.read.length,
    row.unread.length,
  ]),
  [
    [1, 1],
    [0, 1],
  ],
);
assert.equal(
  unreadNoticeRecipientCount(
    [{ ...receiptNotice, readBy: ["a1", "a2", "b1"] }],
    receiptUsers,
  ),
  0,
);
console.log("PASS notification receipt counts decrease per active recipient");
