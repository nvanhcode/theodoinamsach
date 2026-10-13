import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { build } from "vite";
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
const { parseTaskExcel, taskImportHeaders } = await import(
  pathToFileURL(process.cwd() + "/.sites-runtime/import-test/import.mjs")
);
const dir = mkdtempSync(path.join(tmpdir(), "ns-import-"));
const port = 3191;
const token = randomBytes(24).toString("hex"),
  pass = "Import-test-" + randomBytes(16).toString("hex");
const server = spawn(process.execPath, ["selfhost-dist/server/server.mjs"], {
  env: {
    ...process.env,
    PORT: String(port),
    DATA_DIR: dir,
    SETUP_TOKEN: token,
    APP_ORIGIN: "http://localhost:" + port,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
async function call(route, body, cookie = "", status = 200) {
  const r = await fetch("http://localhost:" + port + "/api/" + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      cookie,
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-NS-Request": "1" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  assert.equal(r.status, status, route + ": " + JSON.stringify(data));
  return { data, cookie: r.headers.get("set-cookie")?.split(";")[0] || cookie };
}
const workbook = (row) => {
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(
    wb,
    X.utils.aoa_to_sheet([taskImportHeaders, row]),
    "Nhap nhiem vu",
  );
  return X.write(wb, { type: "array", bookType: "xlsx" });
};
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (d) => {
      if (d.toString().includes("ready")) resolve();
    });
    server.on("error", reject);
    server.on("exit", (c) => reject(new Error("Server exit " + c)));
  });
  await call("bootstrap", {
    token,
    username: "admin",
    name: "Admin kiểm thử",
    password: pass,
  });
  const admin = (await call("login", { username: "admin", password: pass }))
    .cookie;
  async function account(name, role, units) {
    await call(
      "users",
      {
        username: name,
        name,
        roles: [role],
        units,
        groups: [],
        password: pass,
        active: true,
      },
      admin,
    );
    let c = (await call("login", { username: name, password: pass })).cookie;
    await call("password", { old: pass, password: pass + "-changed" }, c);
    return (
      await call("login", { username: name, password: pass + "-changed" })
    ).cookie;
  }
  const unit = await account("chutri", "editor", ["unit-8"]);
  const partner = await account("phoihop", "partner", ["unit-1"]);
  const outsider = await account("ngoaiquyen", "editor", ["unit-2"]);
  const clerk = await account("nhaplieu", "clerk", []);
  let data = (await call("data", undefined, admin)).data;
  const row = [
    "IMPORT-001",
    "",
    "",
    "2026-10",
    "",
    "Nhiệm vụ Excel kiểm thử",
    "Phòng Kinh tế",
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
  let parsed = await parseTaskExcel(workbook(row), data, "2026-10");
  assert.deepEqual(parsed[0].errors, []);
  let task = (
    await call("task", { ...parsed[0].payload, importAction: "assign" }, admin)
  ).data;
  assert.equal(task.status, "assigned");
  for (const c of [admin, unit, partner]) {
    const d = (await call("data", undefined, c)).data;
    assert.equal(d.tasks.find((t) => t.id === task.id).title, row[5]);
    assert.ok(d.notices.some((n) => n.taskId === task.id));
  }
  assert.equal((await call("data", undefined, outsider)).data.tasks.length, 0);
  console.log(
    "PASS XLSX → database → assigned task, lead/partner visibility, notices and access limits",
  );
  let report = (
    await call(
      "report",
      {
        taskId: task.id,
        result: "Kết quả đã xác nhận",
        progress: 60,
        quantity: 60,
        difficulty: "Vướng mắc cần giữ",
        proposal: "Đề xuất cần giữ",
        submit: true,
      },
      unit,
    )
  ).data;
  await call(
    "report-action",
    { id: report.id, version: report.version, action: "confirm" },
    admin,
  );
  data = (await call("data", undefined, admin)).data;
  task = data.tasks.find((t) => t.id === task.id);
  row[5] = "Cập nhật từ Excel";
  row[1] = task.id;
  row[2] = task.version;
  parsed = await parseTaskExcel(workbook(row), data, "2026-10");
  assert.deepEqual(parsed[0].errors, []);
  task = (
    await call("task", { ...parsed[0].payload, importAction: "assign" }, admin)
  ).data;
  assert.equal(task.status, "working");
  assert.equal(task.progress, 60);
  assert.equal(task.result, "Kết quả đã xác nhận");
  assert.equal(task.difficulty, "Vướng mắc cần giữ");
  assert.equal(task.proposal, "Đề xuất cần giữ");
  assert.ok(task.lastReport);
  data = (await call("data", undefined, unit)).data;
  assert.equal(data.tasks[0].title, "Cập nhật từ Excel");
  assert.equal(data.tasks[0].progress, 60);
  assert.equal(data.reports.length, 1);
  assert.ok(
    (await call("history?id=" + task.id, undefined, admin)).data.some((h) =>
      h.action.startsWith("Excel:"),
    ),
  );
  console.log(
    "PASS Excel edit preserves confirmed progress/result/report and synchronizes shared data + audit",
  );
  const beforeNotices = data.notices.length;
  await call(
    "task",
    { ...parsed[0].payload, importAction: "assign" },
    admin,
    409,
  );
  assert.equal(
    (await call("data", undefined, unit)).data.notices.length,
    beforeNotices,
  );
  console.log("PASS stale version rejected without a spurious notice");
  const r2 = [...row];
  r2[0] = "IMPORT-002";
  r2[1] = "";
  r2[2] = "";
  r2[5] = "Nhiệm vụ trình duyệt";
  parsed = await parseTaskExcel(
    workbook(r2),
    (await call("data", undefined, admin)).data,
    "2026-10",
  );
  await call(
    "task",
    { ...parsed[0].payload, importAction: "assign" },
    clerk,
    403,
  );
  let pending = (
    await call("task", { ...parsed[0].payload, importAction: "submit" }, clerk)
  ).data;
  assert.equal(pending.status, "pending");
  assert.ok(
    !(await call("data", undefined, unit)).data.tasks.some(
      (t) => t.id === pending.id,
    ),
  );
  pending = (await call("task", { ...pending, importAction: "assign" }, admin))
    .data;
  assert.equal(pending.status, "assigned");
  assert.ok(
    (await call("data", undefined, unit)).data.tasks.some(
      (t) => t.id === pending.id,
    ),
  );
  console.log(
    "PASS clerk submits, cannot self-assign; Admin assigns existing pending import",
  );
  await call(
    "task",
    { ...parsed[0].payload, importAction: "assign" },
    admin,
    409,
  );
  assert.equal((await call("data", undefined, admin)).data.tasks.length, 2);
  assert.equal(
    (await call("data", undefined, admin)).data.tasks.filter(
      (t) => t.month === "2026-11",
    ).length,
    0,
  );
  await call("period", { month: "2026-10", action: "close" }, admin);
  await call("task", { ...task, importAction: "assign" }, admin, 409);
  console.log(
    "PASS duplicate import, month isolation and closed-period protection",
  );
} finally {
  server.kill();
  await new Promise((r) => server.once("exit", r));
  rmSync(dir, { recursive: true, force: true });
}
