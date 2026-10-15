import assert from "node:assert/strict";
import { build } from "vite";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
await build({
  configFile: false,
  build: {
    ssr: "lib/task-excel.ts",
    outDir: ".sites-runtime/account-parser",
    rollupOptions: { output: { entryFileNames: "parser.mjs" } },
  },
});
const { parseTaskExcel } =
  await import("../.sites-runtime/account-parser/parser.mjs");
const dir = mkdtempSync(path.join(tmpdir(), "ns-accounts-")),
  port = 3194,
  origin = "http://localhost:" + port;
const server = spawn(process.execPath, ["selfhost-dist/server/server.mjs"], {
  env: {
    ...process.env,
    PORT: String(port),
    DATA_DIR: dir,
    APP_ORIGIN: origin,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
async function call(route, body, cookie = "", status = 200) {
  const r = await fetch(origin + "/api/" + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      cookie,
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-NS-Request": "1" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(r.status, status, route + ": " + (await r.clone().text()));
  return {
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0] || cookie,
  };
}
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (d) => {
      if (d.toString().includes("ready")) resolve();
    });
    server.on("error", reject);
    server.on("exit", (c) => reject(new Error("Exit " + c)));
  });
  await call("password-skip", {}, "", 401);
  const admin = (await call("login", { username: "admin", password: "admin" }))
    .cookie;
  let data = (await call("data", undefined, admin)).data;
  assert.equal(data.users.length, 9);
  await Promise.all([call("bootstrap"), call("bootstrap")]);
  assert.equal((await call("data", undefined, admin)).data.users.length, 9);
  const names = [
      "bxdd",
      "vpdu",
      "ubkt",
      "hdnd",
      "ubnd",
      "mttq",
      "congan",
      "quansu",
    ],
    sessions = {};
  for (const name of names) {
    const first = await call("login", {
      username: name,
      password: name + "@6868",
    });
    assert.equal(first.data.user.mustChange, 1);
    assert.deepEqual(first.data.user.roles, ["editor"]);
    await call("data", undefined, first.cookie, 403);
    const retry = await call("login", {
      username: name,
      password: name + "@6868",
    });
    if (name === "hdnd") {
      await call("password-skip", { id: "initial-admin" }, retry.cookie);
      assert.equal(
        (await call("data", undefined, retry.cookie)).data.user.mustChange,
        0,
      );
      const again = await call("login", {
        username: name,
        password: name + "@6868",
      });
      assert.equal(again.data.user.mustChange, 0);
      await call("password-skip", {}, again.cookie);
      console.log(
        "PASS authenticated self-only skip, reload and fresh login, password unchanged",
      );
    }
    await call(
      "password",
      { old: name + "@6868", password: "Account-test-" + name + "-2026" },
      retry.cookie,
    );
    await call("data", undefined, first.cookie, 401);
    sessions[name] = (
      await call("login", {
        username: name,
        password: "Account-test-" + name + "-2026",
      })
    ).cookie;
  }
  console.log(
    "PASS 8 real logins, mandatory password change, interrupted first-login retry, old sessions revoked, no admin grants",
  );
  data = (await call("data", undefined, admin)).data;
  const bytes = readFileSync(
    process.argv[2] || "../qa-input/Nam_Sach_Nhiem_vu_thang_10_2026_TEST.xlsx",
  );
  const rows = await parseTaskExcel(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    data,
    "2026-10",
  );
  assert.equal(rows.length, 44);
  assert.deepEqual(
    rows.flatMap((r) => r.errors),
    [],
  );
  for (const row of rows)
    await call("task", { ...row.payload, importAction: "assign" }, admin);
  data = (await call("data", undefined, admin)).data;
  assert.equal(data.tasks.length, 44);
  assert.equal(data.tasks.filter((t) => t.month === "2026-11").length, 0);
  for (const name of names) {
    const d = (await call("data", undefined, sessions[name])).data;
    const u = d.user;
    const allowed = data.tasks.filter(
      (t) =>
        u.units.includes(t.unit) || t.partners.some((p) => u.units.includes(p)),
    );
    assert.deepEqual(
      d.tasks.map((t) => t.id).sort(),
      allowed.map((t) => t.id).sort(),
    );
    assert.equal(d.users.length, 0);
    assert.ok(!JSON.stringify(d).includes("password"));
    await call(
      "users",
      { username: "escalation", roles: ["admin"] },
      sessions[name],
      403,
    );
    await call("task", { title: "Unauthorized" }, sessions[name], 403);
    const outside = data.tasks.find((t) => !allowed.some((a) => a.id === t.id));
    if (outside) {
      await call(
        "report",
        { taskId: outside.id, result: "blocked", progress: 20 },
        sessions[name],
        404,
      );
      await call("history?id=" + outside.id, undefined, sessions[name], 404);
    }
    let own = d.tasks.find((t) => u.units.includes(t.unit));
    if (!own) {
      own = (
        await call(
          "task",
          {
            title: "Kiểm thử bổ sung quyền chủ trì " + name,
            month: "2026-10",
            unit: u.units[0],
            partners: [],
            assignedDate: "2026-10-01",
            due: "2026-10-31",
            importAction: "assign",
          },
          admin,
        )
      ).data;
      data.tasks.push(own);
      console.log("Additional isolated lead fixture: " + name);
    }
    let report = (
      await call(
        "report",
        {
          taskId: own.id,
          result: "Kết quả kiểm thử " + name,
          quantity: 2,
          progress: 50,
          difficulty: "Vướng mắc",
          proposal: "Kiến nghị",
        },
        sessions[name],
      )
    ).data;
    report = (
      await call(
        "report",
        { ...report, result: "Đã sửa và gửi " + name, submit: true },
        sessions[name],
      )
    ).data;
    assert.equal(report.state, "submitted");
    await call(
      "report-action",
      { id: report.id, version: report.version, action: "confirm" },
      sessions[name],
      403,
    );
    await call(
      "report-action",
      { id: report.id, version: report.version, action: "confirm" },
      admin,
    );
    const fresh = (await call("data", undefined, admin)).data;
    assert.equal(fresh.tasks.find((t) => t.id === own.id).progress, 50);
    assert.equal(
      (await call("data", undefined, sessions[name])).data.tasks.find(
        (t) => t.id === own.id,
      ).progress,
      50,
    );
    const fd = new FormData();
    fd.set("parentId", own.id);
    fd.set("file", new Blob(["%PDF-1.4\nTest evidence"]), name + ".pdf");
    const upload = await fetch(origin + "/api/upload", {
      method: "POST",
      headers: { cookie: sessions[name], "X-NS-Request": "1" },
      body: fd,
    });
    assert.equal(upload.status, 200, await upload.text());
    console.log(
      "PASS " +
        name +
        ": " +
        d.tasks.length +
        " scoped tasks, edit/save/send/confirm sync, evidence, denied outside/admin",
    );
  }
  data = (await call("data", undefined, admin)).data;
  for (const [name, group] of [
    ["hdnd", "HĐND"],
    ["ubnd", "UBND"],
    ["mttq", "MTTQ và đoàn thể"],
  ]) {
    const u = data.users.find((u) => u.username === name);
    assert.deepEqual(
      new Set(u.units),
      new Set(data.units.filter((u) => u.group === group).map((u) => u.id)),
    );
  }
  const ubnd = data.users.find((u) => u.username === "ubnd");
  for (const n of ["Công an xã", "Ban Chỉ huy Quân sự xã"])
    assert.ok(!ubnd.units.includes(data.units.find((u) => u.name === n).id));
  const vp = data.users.find((u) => u.username === "vpdu");
  assert.deepEqual(vp.roles, ["editor"]);

  // Isolated report-specific attachments and future account permissions.
  const lead = data.tasks.find((t) => t.unit === "unit-1");
  const partner = data.users.find((u) => u.username === "mttq");
  let leadTask = (
    await call("task", { ...lead, evidenceRequirement: "image" }, admin)
  ).data;
  let draft = (
    await call(
      "report",
      { taskId: lead.id, result: "", progress: 75, quantity: 750 },
      sessions.bxdd,
    )
  ).data;
  await call("report", { ...draft, submit: true }, sessions.bxdd, 400);
  async function uploadReport(parentId, name, bytes, cookie, status = 200) {
    const fd = new FormData();
    fd.set("parentId", parentId);
    fd.set("file", new Blob([bytes]), name);
    const r = await fetch(origin + "/api/upload", {
      method: "POST",
      headers: { cookie, "X-NS-Request": "1" },
      body: fd,
    });
    assert.equal(r.status, status, await r.clone().text());
    return r.json();
  }
  const webp = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
  const [image, imageCopy] = await Promise.all([
    uploadReport(draft.id, "hien-trang.webp", webp, sessions.bxdd),
    uploadReport(draft.id, "hien-trang-2.webp", webp, sessions.bxdd),
  ]);
  draft = (await call("data", undefined, sessions.bxdd)).data.reports.find(
    (r) => r.id === draft.id,
  );
  assert.equal(
    draft.version,
    1,
    "parallel attachments do not race to update the report version",
  );
  assert.ok(
    (await call("data", undefined, sessions.bxdd)).data.files.some(
      (f) => f.id === image.id && f.parent_id === draft.id,
    ),
  );
  let file = await fetch(origin + "/api/file?id=" + image.id + "&preview=1", {
    headers: { cookie: sessions.bxdd },
  });
  assert.equal(file.status, 200);
  assert.match(file.headers.get("content-disposition"), /^inline/);
  const outsider = data.users.find((u) => u.username === "quansu");
  const canOutsiderSee = data.tasks.some(
    (t) =>
      t.id === lead.id &&
      (outsider.units.includes(t.unit) ||
        t.partners.some((p) => outsider.units.includes(p))),
  );
  if (!canOutsiderSee)
    assert.equal(
      (
        await fetch(origin + "/api/file?id=" + image.id, {
          headers: { cookie: sessions.quansu },
        })
      ).status,
      403,
    );
  await call("report-file-delete", { id: image.id }, sessions.vpdu, 403);
  await call("report-file-delete", { id: image.id }, sessions.bxdd);
  await call("report-file-delete", { id: imageCopy.id }, sessions.bxdd);
  assert.equal(
    (
      await fetch(origin + "/api/file?id=" + image.id, {
        headers: { cookie: sessions.bxdd },
      })
    ).status,
    404,
  );
  draft = (await call("data", undefined, sessions.bxdd)).data.reports.find(
    (r) => r.id === draft.id,
  );
  await uploadReport(
    draft.id,
    "bao-cao.pdf",
    "%PDF-1.4\n report",
    sessions.bxdd,
  );
  draft = (await call("data", undefined, sessions.bxdd)).data.reports.find(
    (r) => r.id === draft.id,
  );
  await call(
    "report",
    { ...draft, result: "Kết quả đã thực hiện", submit: true },
    sessions.bxdd,
    400,
  );
  const image2 = await uploadReport(
    draft.id,
    "hien-trang.webp",
    webp,
    sessions.bxdd,
  );
  draft = (await call("data", undefined, sessions.bxdd)).data.reports.find(
    (r) => r.id === draft.id,
  );
  draft = (
    await call(
      "report",
      {
        ...draft,
        result: "Kết quả đã thực hiện",
        difficulty: "Cần bổ sung hồ sơ",
        proposal: "Đề nghị hỗ trợ",
        submit: true,
      },
      sessions.bxdd,
    )
  ).data;
  assert.equal(draft.evidenceIds.length, 2);
  await call("report-file-delete", { id: image2.id }, sessions.bxdd, 403);
  await uploadReport(
    draft.id,
    "khong-duoc-them.pdf",
    "%PDF-1.4",
    sessions.bxdd,
    403,
  );
  assert.equal(
    (await call("data", undefined, admin)).data.tasks.find(
      (t) => t.id === lead.id,
    ).progress,
    50,
  );
  await call(
    "report-action",
    {
      id: draft.id,
      version: draft.version,
      action: "return",
      reason: "Bổ sung kết quả",
    },
    admin,
  );
  draft = (await call("data", undefined, sessions.bxdd)).data.reports.find(
    (r) => r.id === draft.id,
  );
  draft = (
    await call(
      "report",
      { ...draft, result: "Nội dung bổ sung", submit: false },
      sessions.bxdd,
    )
  ).data;
  await call("report-file-delete", { id: image2.id }, sessions.bxdd, 403);
  draft = (await call("report", { ...draft, submit: true }, sessions.bxdd))
    .data;
  await call(
    "report-action",
    { id: draft.id, version: draft.version, action: "confirm" },
    admin,
  );
  assert.equal(
    (await call("data", undefined, admin)).data.tasks.find(
      (t) => t.id === lead.id,
    ).progress,
    75,
  );
  assert.ok(
    (await call("history?id=" + draft.id, undefined, sessions.bxdd)).data
      .length >= 6,
  );
  const createdUnit = (
    await call(
      "unit",
      {
        name: "Đơn vị mới kiểm thử phân quyền",
        group: "Khối Đảng",
        parentUnitId: "unit-0",
        active: true,
      },
      admin,
    )
  ).data;
  await call(
    "users",
    {
      name: "Đầu mối mới",
      username: "newreporter",
      password: "New-reporter-test-2026",
      roles: ["editor"],
      units: [createdUnit.id],
      groups: [],
      active: true,
    },
    admin,
  );
  let newCookie = (
    await call("login", {
      username: "newreporter",
      password: "New-reporter-test-2026",
    })
  ).cookie;
  await call("password-skip", {}, newCookie);
  let current = (await call("data", undefined, admin)).data.tasks.find(
    (t) => t.id === lead.id,
  );
  current = (
    await call(
      "task",
      {
        ...current,
        partners: [...current.partners, createdUnit.id],
        evidenceRequirement: "none",
      },
      admin,
    )
  ).data;
  let partnerData = (await call("data", undefined, newCookie)).data;
  const visiblePartnerTask = partnerData.tasks.find((t) => t.id === lead.id);
  assert.ok(visiblePartnerTask);
  assert.equal(visiblePartnerTask.progress, 75);
  await call(
    "report",
    {
      taskId: lead.id,
      unit: createdUnit.id,
      result: "Đơn vị phối hợp không được gửi báo cáo",
      progress: 100,
      submit: true,
    },
    newCookie,
    403,
  );
  const childTask = (
    await call(
      "task",
      {
        title: "Đơn vị cấp dưới được giao chủ trì",
        month: "2026-10",
        unit: createdUnit.id,
        partners: [],
        assignedDate: "2026-10-01",
        due: "2026-10-31",
        importAction: "assign",
      },
      admin,
    )
  ).data;
  let pr = (
    await call(
      "report",
      {
        taskId: childTask.id,
        unit: createdUnit.id,
        result: "Báo cáo của đơn vị cấp dưới được giao chủ trì",
        progress: 75,
        submit: true,
      },
      newCookie,
    )
  ).data;
  await call(
    "report-action",
    { id: pr.id, version: pr.version, action: "confirm" },
    admin,
  );
  assert.equal(
    (await call("data", undefined, admin)).data.tasks.find(
      (t) => t.id === childTask.id,
    ).progress,
    75,
  );
  assert.equal(
    (await call("data", undefined, newCookie)).data.tasks.find(
      (t) => t.id === lead.id,
    ).progress,
    75,
  );
  await call(
    "report",
    {
      taskId: lead.id,
      unit: lead.unit,
      result: "Giả mạo chủ trì",
      progress: 100,
      submit: true,
    },
    newCookie,
    403,
  );

  let archiveDraft = (
    await call(
      "report",
      {
        taskId: childTask.id,
        unit: createdUnit.id,
        result: "Minh chứng nén",
        progress: 50,
      },
      newCookie,
    )
  ).data;
  await uploadReport(
    archiveDraft.id,
    "gia.zip",
    "not an archive",
    newCookie,
    400,
  );
  const archiveFiles = [];
  for (const [name, bytes] of [
    ["tai-lieu.zip", [80, 75, 5, 6, ...Array(18).fill(0)]],
    ["tai-lieu.rar", [82, 97, 114, 33, 26, 7, 1, 0]],
    ["tai-lieu.7z", [55, 122, 188, 175, 39, 28]],
  ])
    archiveFiles.push(
      await uploadReport(
        archiveDraft.id,
        name,
        new Uint8Array(bytes),
        newCookie,
      ),
    );
  await uploadReport(archiveDraft.id, "thu-tu.pdf", "%PDF-1.4", newCookie, 400);
  let archiveDownload = await fetch(
    origin + "/api/file?id=" + archiveFiles[0].id + "&preview=1",
    { headers: { cookie: newCookie } },
  );
  assert.equal(archiveDownload.status, 200);
  assert.equal(archiveDownload.headers.get("content-type"), "application/zip");
  assert.match(
    archiveDownload.headers.get("content-disposition"),
    /^attachment/,
  );
  current = (await call("data", undefined, admin)).data.tasks.find(
    (t) => t.id === childTask.id,
  );
  await call("task", { ...current, evidenceRequirement: "document" }, admin);
  archiveDraft = (await call("data", undefined, newCookie)).data.reports.find(
    (r) => r.id === archiveDraft.id,
  );
  await call("report", { ...archiveDraft, submit: true }, newCookie, 400);
  await call("report-file-delete", { id: archiveFiles[0].id }, newCookie);
  await uploadReport(archiveDraft.id, "van-ban.pdf", "%PDF-1.4", newCookie);
  archiveDraft = (await call("data", undefined, newCookie)).data.reports.find(
    (r) => r.id === archiveDraft.id,
  );
  assert.equal(
    (await call("data", undefined, newCookie)).data.files.filter(
      (file) => file.parent_id === archiveDraft.id,
    ).length,
    3,
  );
  archiveDraft = (
    await call("report", { ...archiveDraft, submit: true }, newCookie)
  ).data;
  assert.equal(archiveDraft.evidenceIds.length, 3);
  console.log(
    "PASS ZIP/RAR/7Z, invalid signature, max 3 server limit, download-only archives, document requirement and freed upload slot",
  );
  const newUser = (await call("data", undefined, admin)).data.users.find(
    (u) => u.username === "newreporter",
  );
  await call("users", { ...newUser, roles: ["inspector"] }, admin);
  await call(
    "report",
    { taskId: childTask.id, result: "Revoked", progress: 100 },
    newCookie,
    401,
  );
  newCookie = (
    await call("login", {
      username: "newreporter",
      password: "New-reporter-test-2026",
    })
  ).cookie;
  await call(
    "report",
    { taskId: childTask.id, result: "Revoked", progress: 100 },
    newCookie,
    403,
  );
  await uploadReport(childTask.id, "denied.pdf", "%PDF-1.4", newCookie, 403);
  console.log(
    "PASS report files, WEBP/PDF previews, draft deletion, required image, stale version, return/history, partner isolation, new account and revoked API permission",
  );
  let u = data.users.find((u) => u.username === "bxdd");
  await call("users", { ...u, active: false }, admin);
  await call("data", undefined, sessions.bxdd, 401);
  await call(
    "login",
    { username: "bxdd", password: "Account-test-bxdd-2026" },
    "",
    401,
  );
  u = (await call("data", undefined, admin)).data.users.find(
    (u) => u.username === "bxdd",
  );
  await call(
    "users",
    { ...u, active: true, password: "Reset-account-2026" },
    admin,
  );
  assert.equal(
    (await call("login", { username: "bxdd", password: "Reset-account-2026" }))
      .data.user.mustChange,
    1,
  );
  await call("bootstrap");
  data = (await call("data", undefined, admin)).data;
  assert.equal(data.users.length, 10);
  assert.ok(data.tasks.length >= 44);
  assert.equal(data.tasks.filter((t) => t.month === "2026-11").length, 0);
  const force = data.users.find((u) => u.username === "vpdu");
  await call("users", { ...force, requirePasswordChange: true }, admin);
  await call("data", undefined, sessions.vpdu, 401);
  assert.equal(
    (
      await call("login", {
        username: "vpdu",
        password: "Account-test-vpdu-2026",
      })
    ).data.user.mustChange,
    1,
  );
  const sql = new DatabaseSync(path.join(dir, "nam-sach.sqlite"));
  const stored = sql.prepare("SELECT password FROM users").all();
  assert.ok(
    stored.every((u) => /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(u.password)),
  );
  const auditText = JSON.stringify(sql.prepare("SELECT * FROM audit").all());
  assert.ok(!auditText.includes("password"));
  assert.ok(!auditText.includes("@6868"));
  sql.close();
  const audit = (await call("history", undefined, admin)).data;
  assert.ok(audit.some((a) => a.action === "Đăng nhập"));
  assert.ok(audit.some((a) => a.action === "Gửi báo cáo"));
  assert.ok(audit.some((a) => a.action === "Xác nhận và đồng bộ báo cáo"));
  console.log(
    "PASS aggregate HĐND/UBND/MTTQ scope, Công đoàn, police/army separation, lock/unlock/reset, audit, idempotence, November empty",
  );
} finally {
  server.kill();
  await new Promise((r) => server.once("exit", r));
  rmSync(dir, { recursive: true, force: true });
}
