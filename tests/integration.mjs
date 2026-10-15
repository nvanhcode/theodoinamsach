import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
let dir = mkdtempSync(path.join(os.tmpdir(), "ns-test-"));
const token = randomBytes(24).toString("hex");
const pass = "Test-only-" + randomBytes(12).toString("hex");
const port = 3187;
let server;
let passed = 0;
const results = [];
function start() {
  server = spawn(process.execPath, ["selfhost-dist/server/server.mjs"], {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dir,
      SETUP_TOKEN: token,
      TEST_MODE: "1",
      APP_ORIGIN: "http://localhost:" + port,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Promise((resolve, reject) => {
    server.stdout.on("data", (c) => {
      if (c.toString().includes("ready")) resolve();
    });
    server.on("error", reject);
    server.stderr.on("data", () => {});
    server.on("exit", (c) => {
      if (c) reject(new Error("Server exit " + c));
    });
  });
}
async function call(route, body, cookie = "", expected = 200) {
  const r = await fetch("http://localhost:" + port + "/api/" + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-NS-Request": "1" }),
      cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  assert.equal(r.status, expected, route + ": " + JSON.stringify(data));
  return { data, cookie: r.headers.get("set-cookie")?.split(";")[0] || cookie };
}
async function test(name, fn) {
  await fn();
  passed++;
  results.push("PASS " + name);
  console.log("PASS " + name);
}
let admin,
  unitUser,
  partnerUser,
  head,
  outsider,
  task,
  doc,
  report,
  backup,
  bulkDeleteUnitSession;
try {
  await start();
  await test("01 API từ chối người chưa đăng nhập", () =>
    call("data", undefined, "", 401));
  await test("02 Chặn khởi tạo không có mã thiết lập", () =>
    call(
      "bootstrap",
      { token: "wrong", username: "admin", name: "Admin", password: pass },
      "",
      403,
    ));
  await test("03 Khởi tạo Admin bằng mật khẩu riêng", async () => {
    await call("bootstrap", {
      token,
      username: "admin",
      name: "Admin kiểm thử",
      password: pass,
    });
  });
  await test("04 Không cho khởi tạo Admin lần hai", () =>
    call("bootstrap", { token, username: "admin2", password: pass }, "", 409));
  await test("05 Từ chối mật khẩu sai", () =>
    call("login", { username: "admin", password: "wrong" }, "", 401));
  await test("06 Đăng nhập thành công", async () => {
    admin = (await call("login", { username: "admin", password: pass })).cookie;
  });
  await test("07 Khởi tạo cơ cấu và tháng 11 trống", async () => {
    const d = (await call("data", undefined, admin)).data;
    assert.equal(d.units.length, 23);
    assert.equal(d.tasks.length, 0);
  });
  await test("08 Cấp 6 tài khoản đơn vị", async () => {
    for (const [name, unit] of [
      ["kinhte", "unit-8"],
      ["xaydung", "unit-1"],
      ["testubkt", "unit-2"],
      ["testhdnd", "unit-3"],
      ["testmttq", "unit-12"],
      ["school", "unit-19"],
    ])
      await call(
        "users",
        {
          username: name,
          name,
          roles: ["editor"],
          units: [unit],
          groups: [],
          password: pass,
          active: true,
        },
        admin,
      );
  });
  await test("09 Buộc đổi mật khẩu lần đầu", async () => {
    unitUser = (await call("login", { username: "kinhte", password: pass }))
      .cookie;
    await call("data", undefined, unitUser, 403);
    await call(
      "password",
      { old: pass, password: pass + "-changed" },
      unitUser,
    );
    await call("data", undefined, unitUser, 401);
    unitUser = (
      await call("login", { username: "kinhte", password: pass + "-changed" })
    ).cookie;
  });
  await test("10 Không cho cán bộ tự nâng quyền", () =>
    call(
      "users",
      { username: "kinhte", name: "attack", roles: ["admin"] },
      unitUser,
      403,
    ));
  await test("11 Thêm / sửa đơn vị mới", async () => {
    let r = (
      await call(
        "unit",
        { name: "Trường kiểm thử", group: "Khối Đảng", active: true },
        admin,
      )
    ).data;
    r = (await call("unit", { ...r, contact: "Đầu mối kiểm thử" }, admin)).data;
    assert.equal(r.version, 2);
  });
  await test("12 Tạo văn bản nguồn", async () => {
    doc = (
      await call(
        "document",
        {
          number: "TEST/2026",
          title: "Văn bản kiểm thử, không phải dữ liệu chính thức",
          issued: "2026-10-01",
          month: "2026-10",
          issuer: "TEST",
          type: "TEST",
        },
        admin,
      )
    ).data;
  });
  await test("13 Nhập nhiệm vụ liên kết văn bản", async () => {
    task = (
      await call(
        "task",
        {
          title: "Dữ liệu thử nghiệm – kiểm tra liên thông",
          documentId: doc.id,
          month: "2026-10",
          unit: "unit-8",
          partners: ["unit-1"],
          assignedDate: "2026-10-01",
          due: "2026-10-31",
          owner: "Kiểm thử",
          type: "new",
          importCode: "TEST-001",
          reportFrequency: "daily",
          reportHour: "15:30",
          assignedTime: "09:45",
        },
        admin,
      )
    ).data;
  });
  await test("13b Lưu lịch báo cáo ngày và từ chối giờ sai", async () => {
    assert.equal(task.reportFrequency, "daily");
    assert.equal(task.reportHour, "15:30");
    assert.equal(task.assignedTime, "09:45");
    task = (
      await call(
        "task",
        { ...task, assignedDate: "2026-10-02", assignedTime: "14:20" },
        admin,
      )
    ).data;
    assert.equal(
      (await call("data", undefined, admin)).data.tasks[0].assignedTime,
      "14:20",
    );
    await call("task", { ...task, assignedTime: "25:00" }, admin, 400);
    await call("task", { ...task, reportHour: "25:30" }, admin, 400);
  });
  await test("13d Mã nhập Excel không tạo trùng nhiệm vụ", async () => {
    assert.equal(task.importCode, "TEST-001");
    await call(
      "task",
      {
        title: "Không được tạo trùng",
        month: "2026-10",
        unit: "unit-8",
        assignedDate: "2026-10-01",
        due: "2026-10-31",
        importCode: "TEST-001",
      },
      admin,
      409,
    );
    assert.equal((await call("data", undefined, admin)).data.tasks.length, 1);
  });
  await test("14 Đơn vị chưa thấy nhiệm vụ nháp", async () => {
    assert.equal(
      (await call("data", undefined, unitUser)).data.tasks.length,
      0,
    );
  });
  await test("15 Văn thư trình nhiệm vụ, Phó Văn phòng duyệt giao việc", async () => {
    const sessions = {};
    for (const [name, role] of [
      ["vanthu", "clerk"],
      ["phovp", "deputy"],
    ]) {
      await call(
        "users",
        {
          username: name,
          name,
          roles: [role],
          units: [],
          groups: [],
          password: pass,
          active: true,
        },
        admin,
      );
      let c = (await call("login", { username: name, password: pass })).cookie;
      await call("password", { old: pass, password: pass + "-changed" }, c);
      sessions[name] = (
        await call("login", { username: name, password: pass + "-changed" })
      ).cookie;
      await call(
        "users",
        { username: "forbidden", roles: ["admin"] },
        sessions[name],
        403,
      );
    }
    task = (
      await call(
        "task",
        { ...task, note: "Văn thư hỗ trợ nhập" },
        sessions.vanthu,
      )
    ).data;
    task = (
      await call(
        "task-action",
        { id: task.id, version: task.version, action: "submit" },
        sessions.vanthu,
      )
    ).data;
    await call(
      "task-action",
      { id: task.id, version: task.version, action: "assign" },
      sessions.vanthu,
      403,
    );
    task = (
      await call(
        "task-action",
        { id: task.id, version: task.version, action: "assign" },
        sessions.phovp,
      )
    ).data;
  });
  await test("16 Định tuyến đến đúng đơn vị, liên kết nguồn", async () => {
    const d = (await call("data", undefined, unitUser)).data;
    assert.equal(d.tasks[0].id, task.id);
    assert.equal(d.documents[0].id, doc.id);
    partnerUser = (await call("login", { username: "xaydung", password: pass }))
      .cookie;
    await call(
      "password",
      { old: pass, password: pass + "-changed" },
      partnerUser,
    );
    partnerUser = (
      await call("login", {
        username: "xaydung",
        password: pass + "-changed",
      })
    ).cookie;
    const partnerData = (await call("data", undefined, partnerUser)).data;
    assert.equal(partnerData.tasks[0].id, task.id);
    assert.equal(partnerData.tasks[0].progress, task.progress);
    await call(
      "report",
      {
        taskId: task.id,
        result: "Đơn vị phối hợp không gửi báo cáo",
        progress: 30,
        submit: true,
      },
      partnerUser,
      403,
    );
    const coordination = (
      await call(
        "comment",
        {
          taskId: task.id,
          type: "coordination",
          text: "Đã gửi thông tin phối hợp đến đơn vị chủ trì.",
        },
        partnerUser,
      )
    ).data;
    assert.equal(coordination.unit, "unit-1");
    const coordinationUpload = new FormData();
    coordinationUpload.set("parentId", coordination.id);
    coordinationUpload.set(
      "file",
      new Blob(["%PDF-1.4\n coordination attachment"], {
        type: "application/pdf",
      }),
      "thong-tin-phoi-hop.pdf",
    );
    const coordinationUploadResponse = await fetch(
      "http://localhost:" + port + "/api/upload",
      {
        method: "POST",
        headers: { cookie: partnerUser, "X-NS-Request": "1" },
        body: coordinationUpload,
      },
    );
    assert.equal(
      coordinationUploadResponse.status,
      200,
      await coordinationUploadResponse.clone().text(),
    );
    const coordinationFile = await coordinationUploadResponse.json();
    assert.ok(
      (await call("data", undefined, admin)).data.notices.some(
        (notice) =>
          notice.title.startsWith("Thông tin phối hợp mới") &&
          notice.audienceUnits?.includes(task.unit),
      ),
    );
    assert.ok(
      (await call("data", undefined, unitUser)).data.notices.some(
        (notice) =>
          notice.title.startsWith("Thông tin phối hợp mới") &&
          notice.audienceUnits?.includes(task.unit),
      ),
    );
    assert.ok(
      !(await call("data", undefined, partnerUser)).data.notices.some(
        (notice) => notice.title.startsWith("Thông tin phối hợp mới"),
      ),
    );
    const leadComments = (
      await call("comments?id=" + task.id, undefined, unitUser)
    ).data;
    assert.ok(
      leadComments.some(
        (item) =>
          item.id === coordination.id &&
          item.unitName === "Ban Xây dựng Đảng" &&
          item.recipientUnit === task.unit &&
          item.files?.some((file) => file.id === coordinationFile.id),
      ),
    );
    const leadDownload = await fetch(
      "http://localhost:" +
        port +
        "/api/file?id=" +
        encodeURIComponent(coordinationFile.id),
      { headers: { cookie: unitUser } },
    );
    assert.equal(leadDownload.status, 200);
    assert.equal(
      await leadDownload.text(),
      "%PDF-1.4\n coordination attachment",
    );
    const adminComments = (
      await call("comments?id=" + task.id, undefined, admin)
    ).data;
    assert.ok(
      adminComments.some((item) =>
        item.files?.some((file) => file.id === coordinationFile.id),
      ),
    );
    const unauthorizedDownload = await fetch(
      "http://localhost:" +
        port +
        "/api/file?id=" +
        encodeURIComponent(coordinationFile.id),
      { headers: {} },
    );
    assert.notEqual(unauthorizedDownload.status, 200);
    await call(
      "comment",
      {
        taskId: task.id,
        type: "coordination",
        unit: "unit-2",
        text: "Không được gửi nhầm đơn vị.",
      },
      partnerUser,
      403,
    );
    await call(
      "remind",
      { id: task.id, message: "Chưa gửi báo cáo hằng tuần" },
      admin,
    );
    const unitReminder = (
      await call("data", undefined, unitUser)
    ).data.notices.find(
      (notice) =>
        notice.title.startsWith("Chưa gửi báo cáo") &&
        notice.category === "admin-request",
    );
    assert.ok(unitReminder);
    assert.deepEqual(unitReminder.audienceUnits, [task.unit]);
    assert.ok(
      !(await call("data", undefined, partnerUser)).data.notices.some(
        (notice) => notice.title.startsWith("Chưa gửi báo cáo"),
      ),
    );
    const directive = await call(
      "directive",
      {
        message: "Chuẩn bị nội dung phục vụ giao ban tuần này.",
        audienceUnits: [task.unit],
      },
      admin,
    );
    const unitDirective = (
      await call("data", undefined, unitUser)
    ).data.notices.find((notice) => notice.id === directive.data.id);
    assert.equal(
      unitDirective.message,
      "Chuẩn bị nội dung phục vụ giao ban tuần này.",
    );
    assert.deepEqual(unitDirective.audienceUnits, [task.unit]);
    assert.ok(
      !(await call("data", undefined, partnerUser)).data.notices.some(
        (notice) => notice.id === directive.data.id,
      ),
    );
    await call("notice", { id: directive.data.id }, unitUser);
    const unitAfterRead = (await call("data", undefined, unitUser)).data;
    assert.ok(
      unitAfterRead.notices
        .find((notice) => notice.id === directive.data.id)
        .readBy.includes(unitAfterRead.user.id),
    );
    await call(
      "directive",
      { message: "Không được gửi chỉ đạo.", audienceUnits: [task.unit] },
      unitUser,
      403,
    );
  });
  await test("17 Đơn vị ngoài phạm vi không thấy dữ liệu", async () => {
    outsider = (await call("login", { username: "testubkt", password: pass }))
      .cookie;
    await call(
      "password",
      { old: pass, password: pass + "-changed" },
      outsider,
    );
    outsider = (
      await call("login", { username: "testubkt", password: pass + "-changed" })
    ).cookie;
    assert.equal(
      (await call("data", undefined, outsider)).data.tasks.length,
      0,
    );
    await call("history?id=" + task.id, undefined, outsider, 404);
  });
  await test("18 Chặn chỉnh sửa nhiệm vụ gốc từ đơn vị", () =>
    call("task", { ...task, title: "Không được sửa" }, unitUser, 403));
  await test("19 Sửa và lưu đồng bộ", async () => {
    task = (await call("task", { ...task, title: "Nhiệm vụ đã sửa" }, admin))
      .data;
    assert.equal(
      (await call("data", undefined, unitUser)).data.tasks[0].title,
      "Nhiệm vụ đã sửa",
    );
  });
  await test("20 Phát hiện xung đột phiên bản", () =>
    call("task", { ...task, version: task.version - 1 }, admin, 409));
  await test("20b Hai người sửa đồng thời: một thành công, một xung đột", async () => {
    const rs = await Promise.all(
      ["A", "B"].map((title) =>
        fetch("http://localhost:" + port + "/api/task", {
          method: "POST",
          headers: {
            cookie: admin,
            "Content-Type": "application/json",
            "X-NS-Request": "1",
          },
          body: JSON.stringify({ ...task, title: "Sửa đồng thời " + title }),
        }),
      ),
    );
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
    task = (await call("data", undefined, admin)).data.tasks.find(
      (t) => t.id === task.id,
    );
  });
  await test("20c Đầu việc con tạo và sửa độc lập", async () => {
    let m = (
      await call(
        "milestone",
        {
          taskId: task.id,
          title: "Mốc kiểm thử",
          due: "2026-10-20",
          state: "todo",
        },
        unitUser,
      )
    ).data;
    m = (
      await call(
        "milestone",
        { ...m, state: "done", result: "Đã thực hiện" },
        unitUser,
      )
    ).data;
    assert.equal(m.version, 2);
    assert.equal(
      (await call("data", undefined, admin)).data.milestones[0].state,
      "done",
    );
  });
  await test("21 Gia hạn phải có lý do", () =>
    call("task", { ...task, due: "2026-11-01", reason: "" }, admin, 400));
  await test("22 Lưu nháp báo cáo", async () => {
    report = (
      await call(
        "report",
        {
          taskId: task.id,
          result: "Đã thực hiện",
          progress: 60,
          quantity: 60,
          submit: false,
        },
        unitUser,
      )
    ).data;
    assert.equal(report.state, "draft");
    assert.equal(report.frequency, "daily");
    assert.equal(
      report.periodKey,
      new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(
        new Date(),
      ),
    );
    assert.equal(
      report.deadline,
      new Date(report.periodKey + "T15:30:00+07:00").toISOString(),
    );
  });
  await test("23 Gửi báo cáo lưu thời gian máy chủ", async () => {
    report = (
      await call(
        "report",
        { ...report, submit: true, submitted: "2000-01-01" },
        unitUser,
      )
    ).data;
    assert.equal(report.state, "submitted");
    assert.ok(report.submitted.startsWith("2026"));
    const notices = (await call("data", undefined, admin)).data.notices;
    assert.ok(
      notices.some(
        (notice) =>
          notice.title.includes("Báo cáo đơn vị cần phê duyệt") &&
          notice.title.includes(task.title),
      ),
    );
  });
  await test("24 Không tự xác nhận báo cáo", () =>
    call(
      "report-action",
      { id: report.id, version: report.version, action: "confirm" },
      unitUser,
      403,
    ));
  await test("25 Trả lại, chỉnh sửa và gửi lại", async () => {
    report = (
      await call(
        "report-action",
        {
          id: report.id,
          version: report.version,
          action: "return",
          reason: "Bổ sung sản phẩm",
        },
        admin,
      )
    ).data;
    const unitNotices = (await call("data", undefined, unitUser)).data.notices;
    const partnerNotices = (await call("data", undefined, partnerUser)).data
      .notices;
    const supplement = unitNotices.find(
      (notice) =>
        notice.title.startsWith("Báo cáo cần bổ sung") &&
        notice.taskId === task.id,
    );
    assert.ok(supplement);
    assert.deepEqual(supplement.audienceUnits, [report.unit]);
    assert.ok(
      !partnerNotices.some(
        (notice) =>
          notice.title.startsWith("Báo cáo cần bổ sung") &&
          notice.taskId === task.id,
      ),
    );
    report = (
      await call(
        "report",
        {
          ...report,
          result: "Đã hoàn thành, có sản phẩm",
          progress: 125,
          submit: true,
        },
        unitUser,
      )
    ).data;
  });
  let secondPendingReport;
  await test("26 Duyệt báo cáo còn báo cáo mới thì chưa hoàn thành", async () => {
    secondPendingReport = (
      await call(
        "report",
        {
          taskId: task.id,
          result: "Báo cáo cùng kỳ còn chờ thẩm định",
          progress: 80,
          submit: true,
        },
        unitUser,
      )
    ).data;
    await call(
      "report-action",
      { id: report.id, version: report.version, action: "confirm" },
      admin,
    );
    task = (await call("data", undefined, admin)).data.tasks[0];
    assert.equal(task.progress, 125);
    assert.equal(task.status, "review");
    await call(
      "task-action",
      { id: task.id, version: task.version, action: "complete" },
      admin,
      400,
    );
  });
  await test("26b Duyệt tiến độ dưới 100% vẫn chưa hoàn thành", async () => {
    await call(
      "report-action",
      {
        id: secondPendingReport.id,
        version: secondPendingReport.version,
        action: "confirm",
      },
      admin,
    );
    task = (await call("data", undefined, admin)).data.tasks.find(
      (item) => item.id === task.id,
    );
    assert.equal(task.progress, 80);
    assert.equal(task.status, "working");
  });
  await test("26c Duyệt tiến độ từ 100% tự hoàn thành và cập nhật bộ đếm", async () => {
    report = (
      await call(
        "report",
        {
          taskId: task.id,
          result: "Báo cáo mới hoàn thành",
          progress: 125,
          submit: true,
        },
        unitUser,
      )
    ).data;
    await call(
      "report-action",
      { id: report.id, version: report.version, action: "confirm" },
      admin,
    );
    task = (await call("data", undefined, admin)).data.tasks.find(
      (item) => item.id === task.id,
    );
    assert.equal(task.progress, 125);
    assert.equal(task.status, "done");
    assert.ok(task.completed);
    assert.equal(
      (await call("data", undefined, admin)).data.tasks.filter(
        (item) => item.month === task.month && item.status === "done",
      ).length,
      1,
    );
  });
  await test("27 Không sửa âm thầm báo cáo đã xác nhận", () =>
    call("report", { ...report, progress: 40 }, unitUser, 400));
  await test("28 Upload minh chứng thật", async () => {
    const fd = new FormData();
    fd.set("parentId", task.id);
    fd.set(
      "file",
      new Blob(["%PDF-1.4\n TEST"], { type: "application/pdf" }),
      "Tài liệu báo cáo.pdf",
    );
    const r = await fetch("http://localhost:" + port + "/api/upload", {
      method: "POST",
      headers: { cookie: unitUser, "X-NS-Request": "1" },
      body: fd,
    });
    assert.equal(r.status, 200);
    const f = await r.json();
    const deny = await fetch(
      "http://localhost:" + port + "/api/file?id=" + f.id,
      { headers: { cookie: outsider } },
    );
    assert.equal(deny.status, 403);
    const download = await fetch(
      "http://localhost:" + port + "/api/file?id=" + f.id,
      { headers: { cookie: admin } },
    );
    assert.match(
      download.headers.get("content-disposition"),
      /attachment; filename="T_i li_u b_o c_o\.pdf"; filename\*=UTF-8''T%C3%A0i%20li%E1%BB%87u%20b%C3%A1o%20c%C3%A1o\.pdf/,
    );
    assert.equal(await download.text(), "%PDF-1.4\n TEST");
  });
  await test("29 Từ chối tệp giả định dạng", async () => {
    const fd = new FormData();
    fd.set("parentId", task.id);
    fd.set("file", new Blob(["<script>bad</script>"]), "fake.pdf");
    const r = await fetch("http://localhost:" + port + "/api/upload", {
      method: "POST",
      headers: { cookie: admin, "X-NS-Request": "1" },
      body: fd,
    });
    assert.equal(r.status, 400);
  });
  await test("30 Bộ đếm hoàn thành lấy trạng thái nhiệm vụ đã duyệt", async () => {
    assert.equal(task.status, "done");
    const refreshed = (await call("data", undefined, admin)).data.tasks;
    assert.equal(
      refreshed.filter(
        (item) => item.month === task.month && item.status === "done",
      ).length,
      1,
      "dashboard completion count reflects the confirmed task exactly once",
    );
  });
  await test("31 Không chuyển tiếp nhiệm vụ đã hoàn thành", () =>
    call(
      "task-action",
      {
        id: task.id,
        version: task.version,
        action: "carry",
        month: "2026-11",
        due: "2026-11-30",
        reason: "TEST",
      },
      admin,
      403,
    ));
  let t2;
  await test("32 Tạo nhiệm vụ tiếp nối và bảo toàn kỳ cũ", async () => {
    t2 = (
      await call(
        "task",
        {
          title: "Nhiệm vụ chưa hoàn thành",
          month: "2026-10",
          unit: "unit-8",
          partners: [],
          assignedDate: "2026-10-01",
          due: "2026-10-31",
        },
        admin,
      )
    ).data;
    t2 = (
      await call(
        "task-action",
        { id: t2.id, version: t2.version, action: "submit" },
        admin,
      )
    ).data;
    t2 = (
      await call(
        "task-action",
        { id: t2.id, version: t2.version, action: "assign" },
        admin,
      )
    ).data;
    const c = (
      await call(
        "task-action",
        {
          id: t2.id,
          version: t2.version,
          action: "carry",
          month: "2026-11",
          due: "2026-11-30",
          reason: "Xác nhận tiếp tục",
        },
        admin,
      )
    ).data;
    assert.equal(c.rootId, t2.id);
    const ds = (await call("data", undefined, admin)).data.tasks;
    assert.equal(ds.filter((x) => x.month === "2026-10").length, 2);
    assert.equal(ds.filter((x) => x.month === "2026-11").length, 1);
    assert.equal(ds.filter((x) => x.month === "2026-12").length, 0);
  });
  await test("33 Chặn chuyển tiếp trùng kỳ", () =>
    call(
      "task-action",
      {
        id: t2.id,
        version: t2.version,
        action: "carry",
        month: "2026-11",
        due: "2026-11-30",
        reason: "TEST",
      },
      admin,
      409,
    ));
  await test("34 Khóa sổ tạo snapshot bất biến", async () => {
    await call("period", { month: "2026-10", action: "close" }, admin);
    const snapshots = (await call("snapshots", undefined, admin)).data;
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].tasks.length, 2);
  });
  await test("35 Chặn sửa trong kỳ khóa", () =>
    call("task", { ...t2, title: "Không được sửa" }, admin, 409));
  await test("36 Mở điều chỉnh có lý do, lưu phiên bản mới", async () => {
    let p = (await call("data", undefined, admin)).data.periods[0];
    await call(
      "period",
      {
        month: "2026-10",
        version: p.version,
        action: "reopen",
        reason: "Kiểm thử điều chỉnh",
      },
      admin,
    );
    t2 = (await call("task", { ...t2, title: "Điều chỉnh sau khóa" }, admin))
      .data;
    p = (await call("data", undefined, admin)).data.periods[0];
    await call(
      "period",
      { month: "2026-10", version: p.version, action: "close" },
      admin,
    );
    const sn = (await call("snapshots", undefined, admin)).data;
    assert.equal(sn.length, 2);
    assert.ok(
      sn.some((s) =>
        s.tasks.some((t) => t.title === "Nhiệm vụ chưa hoàn thành"),
      ),
    );
  });
  await test("37 Nhật ký chứa trước/sau và tác giả", async () => {
    const h = (await call("history?id=" + t2.id, undefined, admin)).data;
    assert.ok(h.some((x) => x.before && x.after));
    assert.ok(h.every((x) => x.actor && x.time));
  });
  await test("38 Khóa người dùng thu hồi phiên cũ", async () => {
    const us = (await call("data", undefined, admin)).data.users.find(
      (x) => x.username === "kinhte",
    );
    await call("users", { ...us, active: false }, admin);
    await call("data", undefined, unitUser, 401);
  });
  await test("39 Nhắc nội bộ tạo thông báo và đánh dấu đã đọc", async () => {
    await call("remind", { id: t2.id, message: "Nhắc kiểm thử" }, admin);
    const n = (await call("data", undefined, admin)).data.notices[0];
    await call("notice", { id: n.id }, admin);
    assert.ok(
      (await call("data", undefined, admin)).data.notices
        .find((x) => x.id === n.id)
        .readBy.includes("initial-admin"),
    );
  });
  await test("40 Sao lưu không chứa mật khẩu", async () => {
    backup = (await call("backup", undefined, admin)).data;
    assert.ok(!JSON.stringify(backup).includes(pass));
    assert.ok(backup.records.length > 20);
  });
  await test("41 Chặn phục hồi đè dữ liệu hiện có", () =>
    call("restore", { confirm: "PHUC HOI", backup }, admin, 409));
  await test("42 CSRF yêu cầu khác nguồn bị chặn", async () => {
    const r = await fetch("http://localhost:" + port + "/api/unit", {
      method: "POST",
      headers: {
        cookie: admin,
        "Content-Type": "application/json",
        "X-NS-Request": "1",
        Origin: "https://evil.test",
      },
      body: JSON.stringify({ name: "Bad", group: "Bad" }),
    });
    assert.equal(r.status, 403);
  });
  await test("43 Khởi động lại vẫn giữ hồ sơ và phiên", async () => {
    server.kill();
    await new Promise((r) => server.once("exit", r));
    await start();
    const d = (await call("data", undefined, admin)).data;
    assert.equal(d.tasks.length, 3);
    assert.equal(d.documents.length, 1);
  });
  await test("44 Hạn chế thử mật khẩu sai", async () => {
    for (let i = 0; i < 5; i++)
      await call("login", { username: "unknown", password: "wrong" }, "", 401);
    await call("login", { username: "unknown", password: "wrong" }, "", 429);
  });
  await test("45 Phục hồi nghiệp vụ vào hệ thống mới", async () => {
    server.kill();
    await new Promise((r) => server.once("exit", r));
    rmSync(dir, { recursive: true, force: true });
    dir = mkdtempSync(path.join(os.tmpdir(), "ns-restore-"));
    await start();
    await call("bootstrap", {
      token,
      username: "admin",
      name: "Admin phục hồi",
      password: pass,
    });
    admin = (await call("login", { username: "admin", password: pass })).cookie;
    await call("restore", { confirm: "PHUC HOI", backup }, admin);
    const d = (await call("data", undefined, admin)).data;
    assert.equal(d.tasks.length, 3);
    assert.equal(d.documents.length, 1);
    assert.equal(d.milestones.length, 1);
  });
  await test("46 Đơn vị cấp dưới chủ trì báo cáo, đơn vị phối hợp chỉ theo dõi", async () => {
    const childUnit = (
      await call(
        "unit",
        {
          name: "Đơn vị con kiểm thử",
          group: "UBND",
          parentUnitId: "unit-8",
          active: true,
        },
        admin,
      )
    ).data;
    await call(
      "users",
      {
        username: "childreport",
        name: "Đầu mối đơn vị con",
        roles: ["editor"],
        units: [childUnit.id],
        groups: [],
        password: pass,
        active: true,
      },
      admin,
    );
    let childUser = (
      await call("login", { username: "childreport", password: pass })
    ).cookie;
    await call(
      "password",
      { old: pass, password: pass + "-changed" },
      childUser,
    );
    childUser = (
      await call("login", {
        username: "childreport",
        password: pass + "-changed",
      })
    ).cookie;
    const childTask = (
      await call(
        "task",
        {
          title: "Nhiệm vụ đơn vị con chủ trì",
          month: "2026-11",
          unit: childUnit.id,
          partners: ["unit-1"],
          assignedDate: "2026-11-01",
          due: "2026-11-30",
          importAction: "assign",
        },
        admin,
      )
    ).data;
    await call(
      "users",
      {
        username: "coordtest",
        name: "Đầu mối phối hợp",
        roles: ["editor"],
        units: ["unit-1"],
        groups: [],
        password: pass,
        active: true,
      },
      admin,
    );
    let coordinator = (
      await call("login", { username: "coordtest", password: pass })
    ).cookie;
    await call(
      "password",
      { old: pass, password: pass + "-changed" },
      coordinator,
    );
    coordinator = (
      await call("login", {
        username: "coordtest",
        password: pass + "-changed",
      })
    ).cookie;
    const partnerData = (await call("data", undefined, coordinator)).data;
    assert.equal(
      partnerData.tasks.find((t) => t.id === childTask.id).status,
      "assigned",
    );
    await call(
      "report",
      {
        taskId: childTask.id,
        result: "Đơn vị phối hợp không gửi báo cáo",
        progress: 100,
        submit: true,
      },
      coordinator,
      403,
    );
    const report = (
      await call(
        "report",
        {
          taskId: childTask.id,
          result: "Đơn vị con cập nhật kết quả",
          progress: 60,
          submit: true,
        },
        childUser,
      )
    ).data;
    await call(
      "report-action",
      { id: report.id, version: report.version, action: "confirm" },
      admin,
    );
    const visibleProgress = (await call("data", undefined, coordinator)).data;
    assert.equal(
      visibleProgress.tasks.find((t) => t.id === childTask.id).progress,
      60,
    );
    assert.ok(
      visibleProgress.reports.some(
        (r) => r.taskId === childTask.id && r.state === "confirmed",
      ),
    );
  });
  await test("47 Chỉ Admin được xóa nhiệm vụ hàng loạt", async () => {
    await call(
      "users",
      {
        username: "bulkdeltest",
        name: "Kiểm thử quyền xóa",
        roles: ["editor"],
        units: ["unit-8"],
        groups: [],
        password: pass,
        active: true,
      },
      admin,
    );
    const activeUnitSession = (
      await call("login", { username: "bulkdeltest", password: pass })
    ).cookie;
    await call(
      "password",
      { old: pass, password: pass + "-changed" },
      activeUnitSession,
    );
    const changedUnitSession = (
      await call("login", {
        username: "bulkdeltest",
        password: pass + "-changed",
      })
    ).cookie;
    bulkDeleteUnitSession = changedUnitSession;
    await call(
      "task-bulk-delete",
      { month: "2026-10", confirmation: "XÓA NHIỆM VỤ THÁNG" },
      changedUnitSession,
      403,
    );
  });
  await test("48 Xóa theo tháng dọn báo cáo, tệp và giữ nguyên tháng khác", async () => {
    const fixtureTask = (
      await call(
        "task",
        {
          title: "Nhiệm vụ kiểm thử xóa hàng loạt",
          month: "2026-11",
          unit: "unit-8",
          assignedDate: "2026-11-01",
          due: "2026-11-30",
          importAction: "assign",
        },
        admin,
      )
    ).data;
    assert.equal(fixtureTask.month, "2026-11");
    const draft = (
      await call(
        "report",
        {
          taskId: fixtureTask.id,
          result: "Báo cáo kiểm thử xóa hàng loạt",
          progress: 10,
          submit: false,
        },
        bulkDeleteUnitSession,
      )
    ).data;
    const fd = new FormData();
    fd.set("parentId", draft.id);
    fd.set(
      "file",
      new Blob(["%PDF-1.4\n BULK DELETE TEST"], {
        type: "application/pdf",
      }),
      "minh-chung-xoa.pdf",
    );
    const upload = await fetch("http://localhost:" + port + "/api/upload", {
      method: "POST",
      headers: { cookie: bulkDeleteUnitSession, "X-NS-Request": "1" },
      body: fd,
    });
    assert.equal(upload.status, 200, await upload.clone().text());
    const file = await upload.json();
    const result = (
      await call(
        "task-bulk-delete",
        {
          month: "2026-11",
          confirmation: "XÓA NHIỆM VỤ THÁNG",
        },
        admin,
      )
    ).data;
    assert.ok(result.deleted.deletedTasks >= 1, JSON.stringify(result));
    assert.ok(result.deleted.deletedReports >= 1);
    assert.ok(result.deleted.deletedFiles >= 1);
    const afterMonth = (await call("data", undefined, admin)).data;
    const afterUnit = (await call("data", undefined, bulkDeleteUnitSession))
      .data;
    assert.equal(
      afterMonth.tasks.some((t) => t.month === "2026-11"),
      false,
    );
    assert.equal(
      afterUnit.tasks.some((t) => t.id === fixtureTask.id),
      false,
      "Đơn vị chủ trì không còn thấy nhiệm vụ đã xóa",
    );
    assert.equal(
      afterUnit.reports.some((r) => r.taskId === fixtureTask.id),
      false,
      "Báo cáo nhiệm vụ đã xóa không còn trong trang đơn vị",
    );
    assert.ok(afterMonth.tasks.some((t) => t.month === "2026-10"));
    assert.equal(
      afterMonth.reports.some((r) => r.taskId === fixtureTask.id),
      false,
    );
    assert.equal(
      (
        await fetch("http://localhost:" + port + "/api/file?id=" + file.id, {
          headers: { cookie: admin },
        })
      ).status,
      404,
    );
  });
  await test("49 Từ chối yêu cầu xóa tất cả tháng và giữ dữ liệu", async () => {
    await call(
      "task-bulk-delete",
      { scope: "all", confirmation: "XÓA TẤT CẢ" },
      admin,
      400,
    );
    const after = (await call("data", undefined, admin)).data;
    assert.ok(after.tasks.length > 0);
    assert.ok(after.tasks.every((task) => task.month !== "2026-11"));
    assert.ok(after.tasks.some((task) => task.month === "2026-10"));
  });
  console.log("TOTAL " + passed + " passed");
  writeFileSync(
    "tests/RESULTS.txt",
    results.join("\n") +
      "\nTOTAL " +
      passed +
      " passed\nRuntime: Node self-host, SQLite and real HTTP requests; no browser UI automation.\n",
  );
} finally {
  server?.kill();
  rmSync(dir, { recursive: true, force: true });
}
