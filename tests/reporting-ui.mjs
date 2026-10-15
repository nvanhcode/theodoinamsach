import { build } from "vite";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import path from "node:path";
await build({
  configFile: false,
  resolve: { alias: { "@": process.cwd() } },
  build: {
    ssr: "components/reporting/portal.tsx",
    outDir: ".sites-runtime/portal-test",
    rollupOptions: { output: { entryFileNames: "portal.mjs" } },
  },
});
await build({
  configFile: false,
  build: {
    ssr: "lib/report-access.ts",
    outDir: ".sites-runtime/report-access-test",
    rollupOptions: { output: { entryFileNames: "access.mjs" } },
  },
});
const { ReportingPortal } =
  await import("../.sites-runtime/portal-test/portal.mjs");
const {
  reportingOnly,
  reportingUnits,
  coordinationUnits,
  partnerUpdateRequired,
  splitAssignedTasks,
  isAdminRequestNotice,
  canReadNotice,
  assignmentNoticeTitle,
} = await import("../.sites-runtime/report-access-test/access.mjs");
const user = {
  id: "future-account",
  name: "Đơn vị mới",
  roles: ["editor"],
  units: ["new-unit"],
};
assert.equal(reportingOnly(user), true);
assert.equal(reportingOnly({ ...user, roles: ["admin", "editor"] }), false);
assert.equal(reportingOnly({ ...user, roles: ["inspector"] }), false);
const task = {
  id: "t",
  title: "Nhiệm vụ mới được giao",
  unit: "new-unit",
  partners: [],
  month: "2026-10",
  status: "assigned",
  due: "2026-10-31",
  assignedDate: "2026-10-01",
  target: 1000,
  measure: "hồ sơ",
  progress: 0,
};
assert.deepEqual(reportingUnits(user, task), ["new-unit"]);
const partnerUser = { ...user, units: ["partner-unit"] };
const partnerTask = {
  ...task,
  id: "partner-task",
  unit: "lead-unit",
  partners: ["partner-unit"],
  partnerUpdateRequired: true,
};
assert.deepEqual(coordinationUnits(partnerUser, partnerTask), ["partner-unit"]);
assert.equal(partnerUpdateRequired(partnerTask), true);
assert.equal(
  partnerUpdateRequired({ ...partnerTask, partnerUpdateRequired: false }),
  false,
);
assert.equal(
  canReadNotice(
    partnerUser,
    { title: "Chưa gửi báo cáo hằng tuần" },
    partnerTask,
  ),
  false,
);
assert.equal(
  canReadNotice(
    partnerUser,
    { title: "Thông tin phối hợp mới · Đơn vị phối hợp" },
    partnerTask,
  ),
  true,
);
const supplementNotice = {
  title: "Báo cáo cần bổ sung: Bổ sung sản phẩm",
  taskId: partnerTask.id,
};
assert.equal(canReadNotice(partnerUser, supplementNotice, partnerTask), false);
assert.equal(
  canReadNotice(
    { ...user, units: ["lead-unit"] },
    supplementNotice,
    partnerTask,
  ),
  true,
);
assert.equal(
  isAdminRequestNotice({ category: "admin-request", title: "Gửi báo cáo" }),
  true,
);
assert.equal(isAdminRequestNotice(supplementNotice), true);
const split = splitAssignedTasks(
  { ...partnerUser, units: ["partner-unit", "lead-unit"] },
  [
    partnerTask,
    { ...partnerTask },
    { ...task, id: "lead-task", unit: "lead-unit" },
  ],
);
assert.deepEqual(
  split.lead.map((item) => item.id),
  ["partner-task", "lead-task"],
);
assert.deepEqual(split.partner, []);
const partnerOnlySplit = splitAssignedTasks(partnerUser, [
  partnerTask,
  { ...partnerTask },
]);
assert.deepEqual(
  partnerOnlySplit.partner.map((item) => item.id),
  ["partner-task"],
);
const data = {
  settings: { organization: "ĐẢNG ỦY XÃ NAM SÁCH", day: 5, hour: "16:00" },
  units: [{ id: "new-unit", name: "Đơn vị mới" }],
  tasks: [task],
  reports: [],
  files: [],
  notices: [],
};
const html = renderToStaticMarkup(
  React.createElement(ReportingPortal, {
    user,
    data,
    api: async () => {},
    load: async () => data,
    onLogout: () => {},
  }),
);
for (const text of [
  "Nhiệm vụ được giao",
  "Lịch sử báo cáo",
  "Thông báo – Nhắc việc",
  "Tài khoản",
  "Tổng quan",
  "Tổng nhiệm vụ",
  "Nhiệm vụ chủ trì",
  "Nhiệm vụ phối hợp",
  "Cần xử lý báo cáo",
  "Nhiệm vụ chủ trì cần ưu tiên",
])
  assert.ok(html.includes(text), text);
for (const text of [
  "Nhập dữ liệu công việc",
  "Tải mẫu nhập Excel",
  "Xuất bảng giao",
  "Quản trị hệ thống",
])
  assert.ok(!html.includes(text), text);
console.log(
  "PASS role-driven portal, new accounts, admin exclusion, minimal navigation and assigned tasks",
);

assert.ok(!html.includes("<progress"));
assert.ok(!html.includes("Tiến độ theo đơn vị được phân quyền"));

assert.equal(
  assignmentNoticeTitle("Giao nhiệm vụ từ Excel: Kiểm tra"),
  "Nhiệm vụ được giao: Kiểm tra",
);
assert.equal(assignmentNoticeTitle("Thông báo khác"), "Thông báo khác");

await build({
  configFile: false,
  resolve: { alias: { "@": process.cwd() } },
  build: {
    ssr: "components/reporting/dashboard.tsx",
    outDir: ".sites-runtime/dashboard-test",
    rollupOptions: { output: { entryFileNames: "dashboard.mjs" } },
  },
});
const { matchesSummary, ReportingDashboard } =
  await import("../.sites-runtime/dashboard-test/dashboard.mjs");
assert.equal(
  matchesSummary({ ...task, status: "done" }, "done", () => "missing"),
  true,
);
assert.equal(
  matchesSummary({ ...task, status: "working" }, "done", () => "onTime"),
  false,
);
assert.equal(
  matchesSummary(task, "missing", () => "missing"),
  true,
);
assert.equal(
  matchesSummary(task, "overdue", () => "missing"),
  false,
);
assert.equal(
  matchesSummary(task, "actionRequired", () => "missing"),
  true,
);
assert.equal(
  matchesSummary({ ...task, status: "review" }, "review", () => "onTime"),
  true,
);
const empty = renderToStaticMarkup(
  React.createElement(ReportingDashboard, {
    tasks: [],
    reports: [],
    units: [],
    reportingStatus: () => "notDue",
    onFilter: () => {},
    onTask: () => {},
  }),
);
assert.ok(empty.includes("Không có nhiệm vụ chủ trì cần ưu tiên trong kỳ này"));
assert.ok(!empty.includes("NaN"));
const splitCounts = renderToStaticMarkup(
  React.createElement(ReportingDashboard, {
    tasks: [task],
    partnerTasks: [partnerTask],
    reportingStatus: () => "missing",
    onFilter: () => {},
    onTask: () => {},
  }),
);
assert.ok(splitCounts.includes("Tổng nhiệm vụ"));
assert.ok(splitCounts.includes("Nhiệm vụ chủ trì"));
assert.ok(splitCounts.includes("Nhiệm vụ phối hợp"));
assert.ok(splitCounts.includes("Cần xử lý báo cáo"));
const partnerPortal = renderToStaticMarkup(
  React.createElement(ReportingPortal, {
    user: partnerUser,
    data: {
      ...data,
      units: [
        { id: "lead-unit", name: "Đơn vị chủ trì" },
        { id: "partner-unit", name: "Đơn vị phối hợp" },
      ],
      tasks: [partnerTask],
    },
    api: async () => [],
    load: async () => data,
    onLogout: () => {},
  }),
);
assert.ok(partnerPortal.includes("Nhiệm vụ phối hợp"));
assert.ok(partnerPortal.includes("Không có nhiệm vụ chủ trì cần ưu tiên"));
console.log(
  "PASS reporting dashboard, independent task/report indicators, empty month",
);
