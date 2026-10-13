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
const { reportingOnly, reportingUnits, assignmentNoticeTitle } =
  await import("../.sites-runtime/report-access-test/access.mjs");
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
  "Báo cáo đã gửi",
  "Thông báo – Nhắc việc",
  "Tài khoản",
  "Tổng quan",
  "Tiến độ tổng thể",
  "Tổng nhiệm vụ",
  "Tiến độ theo đơn vị được phân quyền",
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

assert.ok(html.includes("<progress"));
assert.ok(html.includes("Tiến độ bình quân đã xác nhận"));
assert.ok(html.includes("Bấm để xem các phần việc"));

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
assert.ok(empty.includes("Chưa có nhiệm vụ trong kỳ này"));
assert.ok(!empty.includes("NaN"));
console.log(
  "PASS reporting dashboard, independent task/report indicators, empty month",
);
