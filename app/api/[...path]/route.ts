import { reportingUnits, canReadReport } from "@/lib/report-access";
import { provisionUnitAccounts } from "@/lib/unit-accounts";
import {
  readyTemplateBytes,
  readyTemplateName,
  excelMime,
} from "@/lib/ready-task-template";
import { buildTaskTemplate, parseTaskExcel } from "@/lib/task-excel";
import { reconcileBrand } from "@/lib/brand";
import { reconcileUnitDirectory } from "@/lib/unit-directory";
import { env } from "cloudflare:workers";
import {
  db,
  bucket,
  now,
  id,
  stmt,
  all,
  one,
  record,
  records,
  check,
  fail,
  json,
  hash,
  digest,
  passwordCheck,
  publicUser,
  user,
  csrf,
  log,
  insert,
  update,
  updatePair,
  assertOpen,
} from "@/lib/server";
import {
  defaults,
  groups,
  initialUnits,
  roleNames,
  has,
  office,
  approver,
  canSee,
  canReport,
  weekWindow,
  reportWindow,
  deadlineState,
  reportState,
} from "@/lib/domain";
const safe = (s: any, max = 20000) =>
  typeof s === "string" ? s.trim().slice(0, max) : "";
async function notify(t: any, message: string, key = id()) {
  await stmt(
    "INSERT OR IGNORE INTO records(id,kind,parent_id,data,version,updated) VALUES(?,?,?,?,1,?)",
    "notice-" + key,
    "notice",
    t.id,
    JSON.stringify({ taskId: t.id, title: message, readBy: [] }),
    now(),
  ).run();
}
async function taskFor(u: any, rid: string) {
  const t = await record(rid);
  check(
    t && t.kind === "task" && canSee(u, t),
    "Không tìm thấy nhiệm vụ hoặc không có quyền.",
    404,
  );
  return t;
}
async function handle(req: Request, initialDefault = false) {
  try {
    csrf(req);
    const path = new URL(req.url).pathname.replace("/api/", "");
    const method = req.method;
    const b: any =
      method === "POST" &&
      !(req.headers.get("content-type") || "").includes("multipart")
        ? await req.json()
        : {};
    if (path === "task-template-ready" && method === "GET")
      return new Response(readyTemplateBytes() as BodyInit, {
        headers: {
          "Content-Type": excelMime,
          "Content-Disposition":
            'attachment; filename="' + readyTemplateName + '"',
          "Cache-Control": "public, max-age=300",
          "X-Content-Type-Options": "nosniff",
        },
      });
    if (path === "bootstrap" && method === "GET") {
      await provisionUnitAccounts();
      return json({
        initialized: !!(await one("SELECT id FROM users LIMIT 1")),
      });
    }
    if (path === "bootstrap" && method === "POST") {
      check(
        !(await one("SELECT id FROM users LIMIT 1")),
        "Hệ thống đã được khởi tạo.",
        409,
      );
      if (!initialDefault) {
        check(
          (env as any).SETUP_TOKEN && b.token === (env as any).SETUP_TOKEN,
          "Mã thiết lập không đúng.",
          403,
        );
        passwordCheck(b.password);
      }
      check(
        /^[a-zA-Z0-9._-]{3,40}$/.test(b.username),
        "Tên đăng nhập không hợp lệ.",
        400,
      );
      const uid = "initial-admin";
      const unitId = "unit-0";
      const us = { name: safe(b.name) || "Chánh Văn phòng Đảng ủy" };
      const statements = [
        stmt(
          "INSERT INTO users(id,username,name,password,roles,units,groups,active,must_change,version) VALUES(?,?,?,?,?,?,?,1,0,1)",
          uid,
          b.username.toLowerCase(),
          us.name,
          await hash(b.password),
          '["admin"]',
          JSON.stringify([unitId]),
          "[]",
        ),
        stmt(
          "INSERT INTO records(id,kind,data,version,updated) VALUES(?,?,?,1,?)",
          "settings",
          "settings",
          JSON.stringify(defaults),
          now(),
        ),
      ];
      initialUnits.forEach((a, i) =>
        statements.push(
          stmt(
            "INSERT INTO records(id,kind,data,version,updated) VALUES(?,?,?,1,?)",
            "unit-" + i,
            "unit",
            JSON.stringify({
              name: a[0],
              group: groups[Number(a[1])],
              active: true,
              order: i,
              ...(a[0] === "Công đoàn"
                ? { parentUnitId: "unit-12" }
                : a[0] === "Trạm Y tế xã"
                  ? { parentUnitId: "unit-9" }
                  : {}),
            }),
            now(),
          ),
        ),
      );
      statements.push(log(us, "Khởi tạo hệ thống", uid));
      await db().batch(statements);
      return json({ ok: true });
    }
    if (path === "login" && method === "POST") {
      if (!(await one("SELECT id FROM users LIMIT 1"))) {
        check(
          b.username === "admin" && b.password === "admin",
          "Tên đăng nhập hoặc mật khẩu không đúng.",
          401,
        );
        const setupRequest = new Request(new URL("/api/bootstrap", req.url), {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-NS-Request": "1" },
          body: JSON.stringify({
            username: "admin",
            password: "admin",
            name: "Chánh Văn phòng Đảng ủy",
          }),
        });
        const setup = await handle(setupRequest, true);
        check(
          setup.ok || setup.status === 409,
          "Không thể khởi tạo tài khoản quản trị.",
          500,
        );
      }
      await provisionUnitAccounts();
      const username = safe(b.username, 40).toLowerCase();
      const rate = "login:" + username;
      const ip = "ip:" + (req.headers.get("cf-connecting-ip") || "local");
      for (const key of [rate, ip]) {
        const a = await one("SELECT * FROM attempts WHERE id=?", key);
        check(
          !a || a.until < now() || a.count < (key === ip ? 30 : 5),
          "Đăng nhập sai nhiều lần. Vui lòng thử lại sau 15 phút.",
          429,
        );
      }
      const u = await one("SELECT * FROM users WHERE username=?", username);
      const good =
        u &&
        u.active &&
        typeof b.password === "string" &&
        (await hash(b.password, u.password.split(":")[0])) === u.password &&
        (!u.must_change || !u.temp_until || u.temp_until > now());
      if (!good) {
        for (const key of [rate, ip])
          await stmt(
            "INSERT INTO attempts(id,count,until) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN until<? THEN 1 ELSE count+1 END,until=excluded.until",
            key,
            new Date(Date.now() + 900000).toISOString(),
            now(),
          ).run();
        await log({ name: username }, "Đăng nhập thất bại", "auth").run();
        fail("Tên đăng nhập hoặc mật khẩu không đúng / đã hết hạn.", 401);
      }
      const token = id() + id();
      await db().batch([
        stmt("DELETE FROM attempts WHERE id=?", rate),
        stmt(
          "INSERT INTO sessions(id,user_id,expires) VALUES(?,?,?)",
          await digest(token),
          u.id,
          new Date(Date.now() + 1800000).toISOString(),
        ),
        log(u, "Đăng nhập", u.id),
      ]);
      return json({ user: publicUser(u) }, 200, {
        "Set-Cookie": `ns_session=${token}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=28800`,
      });
    }
    if (path === "task-template-file" && method === "GET") {
      const token = new URL(req.url).searchParams.get("token") || "";
      check(/^[a-f0-9-]{72}$/.test(token), "Đường tải không hợp lệ.", 400);
      const grant = await record("download-" + (await digest(token)));
      check(
        grant?.kind === "template_download" && grant.expires > now(),
        "Đường tải mẫu đã hết hạn. Bấm Tải mẫu nhập Excel để tạo lại.",
        410,
      );
      const bytes = await buildTaskTemplate(
        { units: grant.units },
        grant.month,
      );
      return new Response(bytes as BodyInit, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            'attachment; filename="Mau-nhap-nhiem-vu-' + grant.month + '.xlsx"',
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const u: any = await user(req);
    check(u, "Vui lòng đăng nhập.", 401);
    if (path === "me") return json({ user: u });
    if (path === "logout") {
      const token = req.headers
        .get("cookie")
        ?.match(/(?:^|; )ns_session=([^;]+)/)?.[1];
      if (token)
        await stmt(
          "DELETE FROM sessions WHERE id=?",
          await digest(token),
        ).run();
      await log(u, "Đăng xuất", u.id).run();
      return json({ ok: true }, 200, {
        "Set-Cookie":
          "ns_session=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0",
      });
    }
    if (path === "password" && method === "POST") {
      const old = await one("SELECT * FROM users WHERE id=?", u.id);
      check(
        typeof b.old === "string" &&
          (await hash(b.old, old.password.split(":")[0])) === old.password,
        "Mật khẩu hiện tại không đúng.",
        400,
      );
      passwordCheck(b.password);
      check(b.password !== b.old, "Hãy sử dụng mật khẩu mới.", 400);
      await db().batch([
        stmt(
          "UPDATE users SET password=?,must_change=0,temp_until=NULL,version=version+1 WHERE id=?",
          await hash(b.password),
          u.id,
        ),
        stmt("DELETE FROM sessions WHERE user_id=?", u.id),
        log(u, "Đổi mật khẩu", u.id),
      ]);
      return json({ ok: true });
    }
    if (path === "password-skip" && method === "POST") {
      if (u.mustChange)
        await db().batch([
          stmt(
            "UPDATE users SET must_change=0,temp_until=NULL,version=version+1 WHERE id=? AND version=?",
            u.id,
            u.version,
          ),
          log(u, "Chọn đổi mật khẩu sau", u.id),
        ]);
      return json({ ok: true });
    }
    check(
      !u.mustChange,
      "Hãy đổi mật khẩu hoặc chọn Bỏ qua, đổi sau để tiếp tục.",
      403,
    );
    if (path === "task-import-preview" && method === "POST") {
      check(office(u));
      const form = await req.formData();
      const file = form.get("file"),
        month = String(form.get("month") || "");
      check(
        file instanceof File &&
          file.name.toLowerCase().endsWith(".xlsx") &&
          file.size <= 5 * 1024 * 1024,
        "Chọn file XLSX tối đa 5 MB.",
        400,
      );
      check(/^\d{4}-(0[1-9]|1[0-2])$/.test(month), "Chọn tháng hợp lệ.", 400);
      await assertOpen(month);
      await reconcileUnitDirectory();
      const data = {
        units: await records("unit"),
        tasks: (await records("task")).filter((t: any) => canSee(u, t)),
        documents: (await records("document")).filter(
          (d: any) => !d.restricted || d.allowedUsers?.includes(u.id),
        ),
        periods: await records("period"),
        settings: await record("settings"),
      };
      try {
        return json({
          rows: await parseTaskExcel(
            await (file as File).arrayBuffer(),
            data,
            month,
          ),
        });
      } catch (e: any) {
        fail(
          e.message ||
            "Không đọc được bảng Excel. Hãy dùng mẫu XLSX của website.",
          400,
        );
      }
    }
    if (path === "task-template-download" && method === "POST") {
      check(office(u));
      const month = b.month || "";
      check(
        /^\d{4}-(0[1-9]|1[0-2])$/.test(month),
        "Chọn tháng theo dõi hợp lệ.",
        400,
      );
      await reconcileUnitDirectory();
      const token = id() + id(),
        expires = new Date(Date.now() + 300000).toISOString();
      await stmt(
        "DELETE FROM records WHERE kind='template_download' AND json_extract(data,'$.expires')<?",
        now(),
      ).run();
      const units = (await records("unit"))
        .filter((unit: any) => unit.active)
        .map((unit: any) => ({
          id: unit.id,
          name: unit.name,
          group: unit.group,
          active: true,
        }));
      await stmt(
        "INSERT INTO records(id,kind,data,version,updated) VALUES(?,?,?,1,?)",
        "download-" + (await digest(token)),
        "template_download",
        JSON.stringify({ month, units, expires }),
        now(),
      ).run();
      return json({
        url: "/api/task-template-file?token=" + encodeURIComponent(token),
        filename: "Mau-nhap-nhiem-vu-" + month + ".xlsx",
        expires,
      });
    }
    if (path === "task-template" && method === "GET") {
      check(office(u));
      const month = new URL(req.url).searchParams.get("month") || "";
      check(
        /^\d{4}-(0[1-9]|1[0-2])$/.test(month),
        "Chọn tháng theo dõi hợp lệ.",
        400,
      );
      await reconcileUnitDirectory();
      const bytes = await buildTaskTemplate(
        { units: await records("unit") },
        month,
      );
      return new Response(bytes as BodyInit, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            'attachment; filename="Mau-nhap-nhiem-vu-' + month + '.xlsx"',
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (path === "data" && method === "GET") {
      await provisionUnitAccounts();
      await reconcileUnitDirectory();
      await reconcileBrand();
      const tasks = (await records("task")).filter((t: any) => canSee(u, t));
      const ids = new Set(tasks.map((t: any) => t.id));
      const docs = (await records("document")).filter(
        (d: any) =>
          (!d.restricted || d.allowedUsers?.includes(u.id)) &&
          (office(u) ||
            has(u, "secretary") ||
            tasks.some((t: any) => t.documentId === d.id)),
      );
      const reports = (await records("report")).filter(
        (r: any) =>
          ids.has(r.taskId) &&
          (r.state !== "draft" ||
            office(u) ||
            r.author === u.id ||
            u.units.includes(r.unit)),
      );
      const notices = (await records("notice")).filter((n: any) =>
        ids.has(n.taskId),
      );
      const fs = await all("SELECT * FROM files");
      return json({
        user: u,
        tasks,
        documents: docs,
        reports,
        units: await records("unit"),
        settings: await record("settings"),
        periods:
          office(u) || has(u, "secretary") ? await records("period") : [],
        notices,
        milestones: (await records("milestone")).filter((m: any) =>
          ids.has(m.taskId),
        ),
        files: fs
          .filter(
            (f: any) =>
              ids.has(f.parent_id) ||
              docs.some((d: any) => d.id === f.parent_id) ||
              reports.some((r: any) => r.id === f.parent_id) ||
              tasks.some(
                (t: any) =>
                  Array.isArray(t.evidenceIds) && t.evidenceIds.includes(f.id),
              ),
          )
          .map((f: any) => ({
            ...f,
            taskId:
              reports.find((r: any) => r.id === f.parent_id)?.taskId ||
              tasks.find(
                (t: any) =>
                  Array.isArray(t.evidenceIds) && t.evidenceIds.includes(f.id),
              )?.id,
          })),
        users: has(u, "admin", "tech")
          ? (await all("SELECT * FROM users")).map(publicUser)
          : [],
      });
    }
    if (path === "history" && method === "GET") {
      const rid = new URL(req.url).searchParams.get("id");
      if (rid) {
        const r = await record(rid);
        check(r, "Không tìm thấy.", 404);
        if (r.kind === "task") {
          check(
            canSee(u, r),
            "Không tìm thấy nhiệm vụ hoặc không có quyền.",
            404,
          );
          return json(
            await all(
              "SELECT * FROM audit WHERE target=? OR target IN (SELECT id FROM records WHERE kind='report' AND parent_id=?) ORDER BY time DESC LIMIT 200",
              rid,
              rid,
            ),
          );
        } else if (r.kind === "report") {
          check(canReadReport(u, await record(r.taskId), r));
          return json(
            await all(
              "SELECT * FROM audit WHERE target=? OR target=? ORDER BY time DESC LIMIT 200",
              r.id,
              r.previousId || r.id,
            ),
          );
        } else {
          check(office(u) && (!r.restricted || r.allowedUsers?.includes(u.id)));
          return json(
            await all(
              "SELECT * FROM audit WHERE target=? ORDER BY time DESC LIMIT 200",
              rid,
            ),
          );
        }
      }
      check(has(u, "admin", "tech"));
      return json(
        await all(
          "SELECT id,actor,action,target,time FROM audit ORDER BY time DESC LIMIT 500",
        ),
      );
    }
    if (path === "users" && method === "POST") {
      check(has(u, "admin"));
      check(
        safe(b.name) && /^[a-zA-Z0-9._-]{3,40}$/.test(b.username),
        "Nhập họ tên và tên đăng nhập hợp lệ.",
        400,
      );
      check(
        Array.isArray(b.roles) &&
          b.roles.length &&
          b.roles.every((r: string) => roleNames[r]),
        "Vai trò không hợp lệ.",
        400,
      );
      check(
        Array.isArray(b.units) && Array.isArray(b.groups),
        "Phạm vi không hợp lệ.",
        400,
      );
      for (const unit of b.units)
        check(
          (await record(unit))?.kind === "unit",
          "Đơn vị không tồn tại.",
          400,
        );
      check(
        b.id !== u.id || (b.roles.includes("admin") && b.active !== false),
        "Không thể tự thu hồi quyền quản trị của mình.",
        400,
      );
      const old = b.id
        ? await one("SELECT * FROM users WHERE id=?", b.id)
        : null;
      let p = old?.password;
      if (!old || b.password) {
        passwordCheck(b.password);
        p = await hash(b.password);
      }
      const uid = old?.id || id();
      const reset = !!b.password || !old;
      const expiry = reset
        ? new Date(Date.now() + 86400000).toISOString()
        : old.temp_until;
      if (old) {
        check(
          old.version === b.version,
          "Tài khoản đã thay đổi. Hãy tải lại.",
          409,
        );
        await db().batch([
          stmt(
            "UPDATE users SET username=?,name=?,password=?,roles=?,units=?,groups=?,active=?,must_change=?,temp_until=?,version=version+1 WHERE id=? AND version=?",
            b.username.toLowerCase(),
            safe(b.name),
            p,
            JSON.stringify(b.roles),
            JSON.stringify(b.units),
            JSON.stringify(b.groups),
            b.active === false ? 0 : 1,
            reset || b.requirePasswordChange ? 1 : old.must_change,
            b.requirePasswordChange && !reset ? null : expiry,
            uid,
            b.version,
          ),
          stmt("DELETE FROM sessions WHERE user_id=?", uid),
          log(u, "Sửa tài khoản / thu hồi phiên", uid, publicUser(old), {
            name: b.name,
            roles: b.roles,
            units: b.units,
            active: b.active,
          }),
        ]);
      } else
        await db().batch([
          stmt(
            "INSERT INTO users(id,username,name,password,roles,units,groups,active,must_change,temp_until,version) VALUES(?,?,?,?,?,?,?,1,1,?,1)",
            uid,
            b.username.toLowerCase(),
            safe(b.name),
            p,
            JSON.stringify(b.roles),
            JSON.stringify(b.units),
            JSON.stringify(b.groups),
            expiry,
          ),
          log(u, "Cấp tài khoản", uid, null, { name: b.name, roles: b.roles }),
        ]);
      return json({ ok: true });
    }
    if (
      (path === "unit-delete" && method === "POST") ||
      (path === "unit" && (method === "DELETE" || b?.action === "delete"))
    ) {
      check(has(u, "admin"));
      const unitId = safe(b.id, 100);
      check(unitId, "Thiếu mã cơ quan, đơn vị cần xóa.", 400);
      const old = await record(unitId);
      check(old && old.kind === "unit", "Không tìm thấy cơ quan, đơn vị.", 404);

      const cascade = !!b.cascade;

      // 1. Tìm tất cả đơn vị trực thuộc (đệ quy)
      const allUnits = await records("unit");
      const affectedUnitIds = new Set<string>([old.id]);
      let added = true;
      while (added) {
        added = false;
        for (const item of allUnits) {
          if (
            item.parentUnitId &&
            affectedUnitIds.has(item.parentUnitId) &&
            !affectedUnitIds.has(item.id)
          ) {
            affectedUnitIds.add(item.id);
            added = true;
          }
        }
      }
      const affectedUnitIdList = Array.from(affectedUnitIds);
      const directChildUnits = allUnits.filter(
        (item: any) => item.parentUnitId === old.id,
      );

      // 2. Tìm tất cả tài khoản người dùng gắn với các đơn vị bị xóa
      const allUsers = await all("SELECT * FROM users");
      const assignedUsers = allUsers.filter((usr: any) => {
        try {
          const uUnits = JSON.parse(usr.units || "[]");
          return (
            Array.isArray(uUnits) &&
            uUnits.some((id: string) => affectedUnitIds.has(id))
          );
        } catch {
          return false;
        }
      });

      // 3. Tìm tất cả nhiệm vụ liên kết (chủ trì hoặc phối hợp)
      const allTasks = await records("task");
      const leadTasks = allTasks.filter((t: any) =>
        affectedUnitIds.has(t.unit),
      );
      const leadTaskIds = new Set(leadTasks.map((t: any) => t.id));
      const partneredTasks = allTasks.filter(
        (t: any) =>
          !leadTaskIds.has(t.id) &&
          Array.isArray(t.partners) &&
          t.partners.some((p: any) => affectedUnitIds.has(p)),
      );

      // 4. Tìm tất cả báo cáo tiến độ liên kết
      const allReports = await records("report");
      const deletedReports = allReports.filter(
        (r: any) =>
          leadTaskIds.has(r.taskId) || affectedUnitIds.has(r.unit),
      );
      const deletedReportIds = new Set(deletedReports.map((r: any) => r.id));

      const hasDependencies =
        directChildUnits.length > 0 ||
        assignedUsers.length > 0 ||
        leadTasks.length > 0 ||
        partneredTasks.length > 0 ||
        deletedReports.length > 0;

      if (!cascade && hasDependencies) {
        fail(
          `Đơn vị đang có tài nguyên liên kết (${directChildUnits.length} đơn vị trực thuộc, ${assignedUsers.length} tài khoản, ${leadTasks.length + partneredTasks.length} nhiệm vụ, ${deletedReports.length} báo cáo). Vui lòng chọn xóa kèm tài nguyên hoặc chuyển sang "Ngừng sử dụng".`,
          400,
        );
      }

      // Thu thập các bản ghi phụ thuộc khác của nhiệm vụ bị xóa: milestones, notices, comments
      const deletedMilestones = (await records("milestone")).filter((m: any) =>
        leadTaskIds.has(m.taskId),
      );
      const deletedNotices = (await records("notice")).filter((n: any) =>
        leadTaskIds.has(n.taskId),
      );
      const deletedComments = (await records("comment")).filter((c: any) =>
        leadTaskIds.has(c.taskId),
      );

      // Thu thập và xóa tệp đính kèm trong R2 và bảng files
      const parentIdsForFiles = [...leadTaskIds, ...deletedReportIds];
      let filesToDelete: any[] = [];
      if (parentIdsForFiles.length > 0) {
        const placeholders = parentIdsForFiles.map(() => "?").join(",");
        filesToDelete = await all(
          `SELECT id FROM files WHERE parent_id IN (${placeholders})`,
          ...parentIdsForFiles,
        );
      }
      for (const f of filesToDelete) {
        try {
          await bucket().delete(f.id);
        } catch {}
      }

      // Xử lý tài khoản người dùng
      const usersToDelete: any[] = [];
      const usersToUpdate: { id: string; units: string[]; version: number }[] = [];

      for (const usr of assignedUsers) {
        let uUnits: string[] = [];
        try {
          uUnits = JSON.parse(usr.units || "[]");
        } catch {
          uUnits = [];
        }
        const remaining = uUnits.filter((id: string) => !affectedUnitIds.has(id));
        const isAdminOrSelf =
          usr.id === u.id ||
          usr.username === "admin" ||
          JSON.parse(usr.roles || "[]").includes("admin");

        if (remaining.length === 0 && !isAdminOrSelf) {
          usersToDelete.push(usr);
        } else {
          usersToUpdate.push({
            id: usr.id,
            units: remaining,
            version: usr.version,
          });
        }
      }

      // Chuẩn bị batch SQL statements
      const statements: any[] = [];

      // Xóa tệp khỏi bảng files
      if (parentIdsForFiles.length > 0) {
        const placeholders = parentIdsForFiles.map(() => "?").join(",");
        statements.push(
          stmt(
            `DELETE FROM files WHERE parent_id IN (${placeholders})`,
            ...parentIdsForFiles,
          ),
        );
      }

      // Xóa phiên và người dùng bị xóa
      for (const usr of usersToDelete) {
        statements.push(stmt("DELETE FROM sessions WHERE user_id=?", usr.id));
        statements.push(stmt("DELETE FROM users WHERE id=?", usr.id));
      }

      // Cập nhật người dùng còn lại
      for (const item of usersToUpdate) {
        statements.push(
          stmt(
            "UPDATE users SET units=?, version=version+1 WHERE id=? AND version=?",
            JSON.stringify(item.units),
            item.id,
            item.version,
          ),
        );
      }

      // Cập nhật các nhiệm vụ phối hợp (bỏ đơn vị bị xóa khỏi partners)
      for (const pt of partneredTasks) {
        const newPartners = (pt.partners || []).filter(
          (p: any) => !affectedUnitIds.has(p),
        );
        const nextData = { ...pt, partners: newPartners };
        delete nextData.id;
        delete nextData.kind;
        delete nextData.version;
        delete nextData.updated;
        statements.push(
          stmt(
            "UPDATE records SET data=?, version=version+1, updated=? WHERE id=? AND version=?",
            JSON.stringify(nextData),
            now(),
            pt.id,
            pt.version,
          ),
        );
      }

      // Xóa tất cả các bản ghi trong records
      const allRecordIdsToDelete = [
        ...affectedUnitIdList,
        ...leadTasks.map((t: any) => t.id),
        ...deletedReports.map((r: any) => r.id),
        ...deletedMilestones.map((m: any) => m.id),
        ...deletedNotices.map((n: any) => n.id),
        ...deletedComments.map((c: any) => c.id),
      ];

      const chunkSize = 200;
      for (let i = 0; i < allRecordIdsToDelete.length; i += chunkSize) {
        const chunk = allRecordIdsToDelete.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => "?").join(",");
        statements.push(
          stmt(`DELETE FROM records WHERE id IN (${placeholders})`, ...chunk),
        );
      }

      // Ghi nhật ký kiểm toán (audit)
      const summaryInfo = {
        unitId: old.id,
        unitName: old.name,
        cascade,
        deletedUnits: affectedUnitIdList.length,
        deletedTasks: leadTasks.length,
        updatedTasks: partneredTasks.length,
        deletedReports: deletedReports.length,
        deletedUsers: usersToDelete.length,
        deletedFiles: filesToDelete.length,
      };
      statements.push(
        log(
          u,
          cascade ? "Xóa cơ quan, đơn vị (kèm tài nguyên)" : "Xóa cơ quan, đơn vị",
          old.id,
          old,
          summaryInfo,
        ),
      );

      await db().batch(statements);

      return json({
        ok: true,
        id: old.id,
        summary: summaryInfo,
      });
    }
    if (path === "unit" && method === "POST") {
      check(has(u, "admin"));
      check(safe(b.name) && safe(b.group), "Nhập tên đơn vị và khối.", 400);
      const parentUnitId = safe(b.parentUnitId, 100);
      let parent: any = null;
      if (parentUnitId) {
        parent = await record(parentUnitId);
        check(
          parent?.kind === "unit" && parent.active,
          "Đơn vị cấp trên không hợp lệ.",
          400,
        );
        let cursor = parent;
        const seen = new Set();
        while (cursor) {
          check(
            cursor.id !== b.id && !seen.has(cursor.id),
            "Không thể tạo vòng lặp đơn vị cấp trên.",
            400,
          );
          seen.add(cursor.id);
          cursor = cursor.parentUnitId
            ? await record(cursor.parentUnitId)
            : null;
        }
      }
      const d = {
        name: safe(b.name, 200),
        group: parent?.group || safe(b.group, 100),
        parentUnitId,
        active: b.active !== false,
        contact: safe(b.contact),
        order: Number(b.order) || 0,
      };
      const old = b.id ? await record(b.id) : null;
      if (old) {
        check(old.kind === "unit");
        check(old.version === b.version, "Đơn vị đã thay đổi.", 409);
        return json(await update(old, d, u));
      }
      return json(await insert("unit", d, u));
    }
    if (path === "settings" && method === "POST") {
      check(has(u, "admin"));
      check(
        /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(b.hour) &&
          Number(b.day) >= 1 &&
          Number(b.day) <= 7,
        "Lịch báo cáo không hợp lệ.",
        400,
      );
      check(/^#[0-9a-f]{6}$/i.test(b.color), "Màu không hợp lệ.", 400);
      check(
        !b.logo ||
          /^https:\/\//.test(b.logo) ||
          /^\/api\/logo\?id=/.test(b.logo),
        "Đường dẫn logo không hợp lệ.",
        400,
      );
      const old = await record("settings");
      check(b.version === old.version, "Cấu hình đã thay đổi.", 409);
      return json(
        await update(
          old,
          {
            ...defaults,
            title: safe(b.title, 150),
            organization: safe(b.organization, 150),
            city: safe(b.city, 100),
            color: b.color,
            day: Number(b.day),
            hour: b.hour,
            warningDays: Math.min(30, Math.max(1, Number(b.warningDays) || 3)),
            pageSize: Math.min(100, Math.max(5, Number(b.pageSize) || 10)),
            sessionMinutes: Math.min(
              120,
              Math.max(5, Number(b.sessionMinutes) || 30),
            ),
            logo: safe(b.logo, 500),
          },
          u,
          "Đổi cấu hình (không sửa kỳ lịch sử)",
        ),
      );
    }
    if (path === "document" && method === "POST") {
      check(office(u));
      check(
        safe(b.title) &&
          safe(b.number) &&
          /^\d{4}-\d{2}$/.test(b.month) &&
          /^\d{4}-\d{2}-\d{2}$/.test(b.issued),
        "Nhập đủ số văn bản, ngày ban hành, trích yếu và kỳ.",
        400,
      );
      await assertOpen(b.month);
      const old = b.id ? await record(b.id) : null;
      const d = {
        number: safe(b.number, 100),
        title: safe(b.title),
        issued: b.issued,
        issuer: safe(b.issuer, 200),
        type: safe(b.type, 100),
        content: safe(b.content, 50000),
        month: b.month,
        restricted: !!b.restricted,
        allowedUsers: b.restricted ? [u.id] : [],
        author: u.id,
      };
      if (old) {
        check(
          old.kind === "document" &&
            (!old.restricted || old.allowedUsers.includes(u.id)),
        );
        await assertOpen(old.month);
        check(old.version === b.version, "Văn bản đã thay đổi.", 409);
        return json(await update(old, d, u));
      }
      return json(await insert("document", d, u));
    }
    if (path === "task" && method === "POST") {
      check(office(u));
      check(
        safe(b.title) &&
          b.unit &&
          /^\d{4}-\d{2}$/.test(b.month) &&
          /^\d{4}-\d{2}-\d{2}$/.test(b.due) &&
          b.assignedDate,
        "Nhập nội dung, chủ trì, kỳ, ngày giao và thời hạn.",
        400,
      );
      check(
        b.due >= b.assignedDate,
        "Hạn hoàn thành phải từ ngày giao trở đi.",
        400,
      );
      await assertOpen(b.month);
      const unit = await record(b.unit);
      check(
        unit?.kind === "unit" && unit.active,
        "Đơn vị không hoạt động.",
        400,
      );
      const old = b.id ? await taskFor(u, b.id) : null;
      if (old) {
        check(
          old.version === b.version,
          "Nhiệm vụ đã thay đổi. Hãy tải lại.",
          409,
        );
        await assertOpen(old.month);
        check(
          !["done", "cancelled"].includes(old.status),
          "Hồ sơ đã kết thúc không thể sửa nội dung.",
          409,
        );
        check(
          old.month === b.month,
          "Dùng chức năng chuyển tiếp để theo dõi tháng mới.",
          400,
        );
        if (old.due !== b.due || old.unit !== b.unit) {
          check(
            approver(u),
            "Chỉ Chánh/Phó Văn phòng được điều chỉnh thời hạn hoặc đơn vị.",
          );
          check(safe(b.reason), "Nhập lý do điều chỉnh.", 400);
        }
      }
      if (b.documentId) {
        const d = await record(b.documentId);
        check(
          d?.kind === "document" &&
            (!d.restricted || d.allowedUsers?.includes(u.id)),
          "Văn bản nguồn không hợp lệ.",
          400,
        );
        check(
          !d.restricted || b.restricted,
          "Nhiệm vụ từ văn bản hạn chế phải cùng phạm vi hạn chế.",
          400,
        );
      }
      const partners = Array.isArray(b.partners)
        ? b.partners.filter((x: string) => x !== b.unit)
        : [];
      for (const p of partners)
        check(
          (await record(p))?.active,
          "Đơn vị phối hợp không hoạt động.",
          400,
        );
      const importCode = old?.importCode || safe(b.importCode, 60);
      check(
        !importCode || /^[A-Za-z0-9_-]{1,60}$/.test(importCode),
        "Mã nhập Excel không hợp lệ.",
        400,
      );
      if (importCode && old)
        check(
          !(await one(
            "SELECT id FROM records WHERE kind='task' AND id<>? AND json_extract(data,'$.month')=? AND json_extract(data,'$.importCode')=? LIMIT 1",
            old.id,
            b.month,
            importCode,
          )),
          "Mã nhập đã được dùng cho nhiệm vụ khác.",
          409,
        );
      const importId = importCode ? "excel-" + b.month + "-" + importCode : "";
      if (!old && importId)
        check(
          !(await record(importId)),
          "Mã nhập đã tồn tại. Tải lại dữ liệu để cập nhật, không tạo trùng.",
          409,
        );
      const assignedTime = b.assignedTime ?? old?.assignedTime ?? "";
      check(
        !assignedTime || /^([01]\d|2[0-3]):[0-5]\d$/.test(assignedTime),
        "Giờ giao nhiệm vụ không hợp lệ.",
        400,
      );
      check(
        /^\d{4}-\d{2}-\d{2}$/.test(b.assignedDate) &&
          !Number.isNaN(Date.parse(b.assignedDate + "T00:00:00+07:00")),
        "Ngày giao nhiệm vụ không hợp lệ.",
        400,
      );
      const reportFrequency =
        b.reportFrequency ?? old?.reportFrequency ?? "default";
      const reportHour = b.reportHour ?? old?.reportHour ?? "15:30";
      const reportDay = Number(b.reportDay ?? old?.reportDay ?? 5);
      check(
        ["default", "daily", "weekly"].includes(reportFrequency),
        "Chọn lịch báo cáo hợp lệ.",
        400,
      );
      check(
        /^([01]\d|2[0-3]):[0-5]\d$/.test(reportHour),
        "Giờ báo cáo không hợp lệ.",
        400,
      );
      check(
        Number.isInteger(reportDay) && reportDay >= 1 && reportDay <= 7,
        "Ngày báo cáo không hợp lệ.",
        400,
      );
      const evidenceRequirement =
        b.evidenceRequirement ?? old?.evidenceRequirement ?? "none";
      if (evidenceRequirement !== (old?.evidenceRequirement || "none"))
        check(approver(u));
      check(
        ["none", "any", "image", "document"].includes(evidenceRequirement),
        "Yêu cầu minh chứng không hợp lệ.",
        400,
      );
      const importAction = b.importAction || "";
      check(
        !importAction || ["draft", "submit", "assign"].includes(importAction),
        "Chọn cách xử lý Excel hợp lệ.",
        400,
      );
      if (importAction === "assign")
        check(
          approver(u),
          "Chỉ Chánh/Phó Văn phòng được giao nhiệm vụ từ Excel.",
        );
      const importedStatus =
        importAction && (!old || ["draft", "pending"].includes(old.status))
          ? importAction === "assign"
            ? "assigned"
            : importAction === "submit"
              ? "pending"
              : old?.status || "draft"
          : old?.status || "draft";
      const d = {
        ...old,
        evidenceRequirement,
        importCode,
        reportFrequency,
        reportHour,
        reportDay,
        title: safe(b.title),
        documentId: b.documentId || "",
        month: b.month,
        group: unit.group,
        unit: b.unit,
        partners,
        owner: safe(b.owner, 200),
        leader: safe(b.leader, 200),
        field: safe(b.field, 150),
        assignedDate: b.assignedDate,
        assignedTime,
        due: b.due,
        originalDue: old?.originalDue || b.due,
        priority: b.priority || "normal",
        target: Math.max(0, Number(b.target) || 0),
        measure: safe(b.measure, 100),
        output: safe(b.output),
        milestones: safe(b.milestones),
        note: safe(b.note),
        type: b.type || "new",
        status: importedStatus,
        progress: old?.progress || 0,
        rootId: old?.rootId || null,
        restricted: !!b.restricted,
        allowedUsers: b.restricted
          ? Array.from(new Set([u.id, ...(b.allowedUsers || [])]))
          : [],
        reason: safe(b.reason),
        author: old?.author || u.id,
      };
      const rid = old?.id || importId || id();
      const importMessage = importAction
        ? (importedStatus === "assigned"
            ? "Nhiệm vụ được giao: "
            : importedStatus === "pending"
              ? "Nhiệm vụ Excel chờ duyệt: "
              : "Nhiệm vụ đã cập nhật từ Excel: ") + d.title
        : "";
      const notice = (op?: string) =>
        importAction && importedStatus !== "draft"
          ? [
              stmt(
                "INSERT INTO records(id,kind,parent_id,data,version,updated) SELECT ?,?,?,?,?,?" +
                  (op
                    ? " WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND json_extract(data,'$._operation')=?)"
                    : ""),
                "notice-" + id(),
                "notice",
                rid,
                JSON.stringify({
                  taskId: rid,
                  title: importMessage,
                  readBy: [],
                }),
                1,
                now(),
                ...(op ? [rid, op] : []),
              ),
            ]
          : [];
      let t: any;
      try {
        t = old
          ? await update(
              old,
              d,
              u,
              importAction
                ? "Excel: lưu và " +
                    (importAction === "assign"
                      ? "giao nhiệm vụ"
                      : importAction === "submit"
                        ? "trình duyệt"
                        : "cập nhật")
                : "Sửa nhiệm vụ",
              (op) => notice(op),
            )
          : await insert("task", d, u, rid, null, notice());
      } catch (e) {
        if (!old && importId && (await record(importId)))
          fail(
            "Mã nhập vừa được lưu bởi người khác. Tải lại bảng để cập nhật.",
            409,
          );
        throw e;
      }
      if (old && !importAction)
        await notify(t, "Nhiệm vụ đã được điều chỉnh: " + t.title);
      return json(t);
    }
    if (path === "task-action" && method === "POST") {
      const t = await taskFor(u, b.id);
      check(t.version === b.version, "Nhiệm vụ đã được cập nhật.", 409);
      await assertOpen(t.month);
      const a = b.action;
      let d = { ...t };
      if (a === "submit") {
        check(office(u) && ["draft", "returned"].includes(t.status));
        d.status = "pending";
      } else if (a === "assign") {
        check(approver(u) && t.status === "pending");
        d.status = "assigned";
      } else if (a === "complete") {
        check(approver(u) && t.status === "review");
        const rr = (await records("report")).filter(
          (r: any) =>
            r.taskId === t.id && r.state === "confirmed" && r.progress === 100,
        );
        check(rr.length, "Cần báo cáo 100% đã được đơn vị xác nhận.", 400);
        d.status = "done";
        d.completed = now();
      } else if (a === "pause" || a === "cancel") {
        check(approver(u) && !["done", "cancelled"].includes(t.status));
        check(safe(b.reason), "Nhập lý do.", 400);
        d.status = a === "pause" ? "paused" : "cancelled";
        d.reason = safe(b.reason);
      } else if (a === "resume") {
        check(approver(u) && t.status === "paused");
        d.status = "assigned";
      } else if (a === "carry") {
        check(
          approver(u) &&
            !["draft", "pending", "done", "cancelled"].includes(t.status),
        );
        check(
          /^\d{4}-\d{2}$/.test(b.month) && b.month > t.month && safe(b.reason),
          "Chọn tháng sau và ghi căn cứ xác nhận chuyển tiếp.",
          400,
        );
        await assertOpen(b.month);
        check(
          /^\d{4}-\d{2}-\d{2}$/.test(b.due) && b.due >= b.month + "-01",
          "Nhập thời hạn kỳ mới.",
          400,
        );
        const root = t.rootId || t.id;
        const rid = "carry-" + root + "-" + b.month;
        check(!(await record(rid)), "Nhiệm vụ đã được chuyển vào kỳ này.", 409);
        delete d.id;
        delete d.kind;
        delete d.version;
        delete d.updated;
        d = {
          ...d,
          month: b.month,
          due: b.due,
          rootId: root,
          type: "carry",
          status: "assigned",
          reason: safe(b.reason),
          previousId: t.id,
        };
        const nt = await insert("task", d, u, rid, t.id);
        await notify(nt, "Nhiệm vụ chuyển tiếp: " + nt.title);
        return json(nt);
      } else fail("Hành động không hợp lệ.");
      const result = await update(t, d, u, "Quy trình: " + a);
      await notify(result, "Cập nhật xử lý nhiệm vụ: " + t.title);
      return json(result);
    }
    if (path === "report" && method === "POST") {
      const t = await taskFor(u, b.taskId);
      check(canReport(u, t));
      await assertOpen(t.month);
      check(
        ["assigned", "working", "review", "returned"].includes(t.status),
        "Nhiệm vụ chưa giao hoặc đã kết thúc.",
        400,
      );
      check(
        (!b.submit || safe(b.result, 100000)) &&
          Number(b.progress) >= 0 &&
          Number(b.progress) <= 100,
        "Nhập kết quả và tiến độ 0–100%.",
        400,
      );
      check(
        Number.isFinite(Number(b.quantity || 0)) &&
          Number(b.quantity || 0) >= 0,
        "Số lượng thực hiện không hợp lệ.",
        400,
      );
      const cfg = await record("settings");
      const w = reportWindow(t, new Date(), cfg);
      const old = b.id ? await record(b.id) : null;
      if (old) {
        check(
          old.kind === "report" &&
            old.taskId === t.id &&
            old.author === u.id &&
            ["draft", "returned"].includes(old.state),
        );
        check(old.version === b.version, "Báo cáo đã thay đổi.", 409);
      }
      const allowedUnits = reportingUnits(u, t);
      const unit = old?.unit || b.unit || allowedUnits[0];
      check(
        allowedUnits.includes(unit),
        "Không có quyền báo cáo cho đơn vị này.",
        403,
      );
      if (b.previousId) {
        const previous = await record(b.previousId);
        check(
          previous?.kind === "report" &&
            previous.taskId === t.id &&
            previous.unit === unit &&
            canReadReport(u, t, previous),
          "Báo cáo gốc không hợp lệ.",
          400,
        );
      }
      const evidence = old
        ? await all("SELECT id,mime FROM files WHERE parent_id=?", old.id)
        : [];
      if (b.submit) {
        const requirement = t.evidenceRequirement || "none";
        check(
          requirement === "none" ||
            (requirement === "any" && evidence.length) ||
            (requirement === "image" &&
              evidence.some((f: any) => f.mime.startsWith("image/"))) ||
            (requirement === "document" &&
              evidence.some((f: any) =>
                [
                  "application/pdf",
                  "application/msword",
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  "application/vnd.ms-excel",
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ].includes(f.mime),
              )),
          "Chưa có minh chứng theo yêu cầu của nhiệm vụ.",
          400,
        );
      }
      const d = {
        taskId: t.id,
        unit,
        evidenceIds: evidence.map((f: any) => f.id),
        everSubmitted: !!(old?.everSubmitted || old?.submitted || b.submit),
        author: u.id,
        authorName: u.name,
        month: t.month,
        frequency: old?.frequency || w.frequency,
        periodKey: old?.periodKey || old?.week || w.key,
        week: old?.week || w.key,
        deadline: old?.deadline || w.deadline,
        result: safe(b.result, 100000),
        progress: Number(b.progress),
        quantity: Math.max(0, Number(b.quantity) || 0),
        product: safe(b.product),
        difficulty: safe(b.difficulty),
        proposal: safe(b.proposal),
        state: b.submit ? "submitted" : "draft",
        submitted: b.submit ? now() : null,
        previousId: old?.previousId || b.previousId || null,
      };
      const isSupplementary = !!(
        b.previousId ||
        old?.previousId ||
        old?.state === "returned"
      );
      const reportAction = b.submit
        ? isSupplementary
          ? "Gửi báo cáo bổ sung"
          : "Gửi báo cáo"
        : isSupplementary
          ? "Lưu nháp báo cáo bổ sung"
          : "Lưu nháp báo cáo";
      let r: any;
      if (b.submit) {
        const nextTask = {
          ...t,
          status: "review",
          lastReport: now(),
        };
        const taskAction = isSupplementary
          ? "Gửi báo cáo bổ sung: Chờ xác nhận kết quả"
          : "Gửi báo cáo: Chờ xác nhận kết quả";
        if (old) {
          r = await updatePair(
            old,
            d,
            t,
            nextTask,
            u,
            reportAction,
            taskAction,
          );
        } else {
          r = await insert("report", d, u, id(), t.id, [], reportAction);
          await update(t, nextTask, u, taskAction);
        }
        await notify(t, "Báo cáo tiến độ cần xác nhận: " + t.title);
      } else {
        r = old
          ? await update(old, d, u, reportAction)
          : await insert("report", d, u, id(), t.id, [], reportAction);
      }
      return json(r);
    }
    if (path === "report-action" && method === "POST") {
      const r = await record(b.id);
      check(r?.kind === "report", "Không tìm thấy báo cáo.", 404);
      const t = await taskFor(u, r.taskId);
      await assertOpen(t.month);
      check(r.version === b.version, "Báo cáo đã thay đổi.", 409);
      check(approver(u) || (has(u, "head") && u.units.includes(r.unit)));
      check(r.state === "submitted", "Chỉ xử lý báo cáo đã gửi.", 400);
      check(["confirm", "return"].includes(b.action));
      if (b.action === "return")
        check(safe(b.reason), "Nhập yêu cầu bổ sung.", 400);
      if (b.action === "confirm") {
        if (b.progress !== undefined) {
          check(
            Number(b.progress) >= 0 && Number(b.progress) <= 100,
            "Tiến độ hoàn thành phải từ 0 đến 100%.",
            400,
          );
        }
        if (b.quantity !== undefined) {
          check(
            Number.isFinite(Number(b.quantity)) && Number(b.quantity) >= 0,
            "Khối lượng thực hiện không hợp lệ.",
            400,
          );
        }
      }

      const progress =
        b.progress !== undefined && b.progress !== null && !isNaN(Number(b.progress))
          ? Math.min(100, Math.max(0, Number(b.progress)))
          : r.progress;
      const quantity =
        b.quantity !== undefined && b.quantity !== null && !isNaN(Number(b.quantity))
          ? Math.max(0, Number(b.quantity))
          : (r.quantity || 0);
      const result = b.result !== undefined ? safe(b.result, 100000) : r.result;
      const difficulty = b.difficulty !== undefined ? safe(b.difficulty) : r.difficulty;
      const proposal = b.proposal !== undefined ? safe(b.proposal) : r.proposal;

      // Thu thập danh sách minh chứng từ báo cáo để đồng bộ vào hồ sơ nhiệm vụ
      const reportFiles = await all("SELECT id FROM files WHERE parent_id=?", r.id);
      const reportFileIds = reportFiles.map((f: any) => f.id);
      const mergedEvidenceIds = Array.from(
        new Set([...(t.evidenceIds || []), ...reportFileIds, ...(r.evidenceIds || [])]),
      );

      const rd = {
        ...r,
        progress,
        quantity,
        result,
        difficulty,
        proposal,
        state: b.action === "confirm" ? "confirmed" : "returned",
        reviewer: u.name,
        reviewed: now(),
        reason: safe(b.reason),
        reviewNote: safe(b.reviewNote),
      };
      const otherSubmittedReports = (await records("report")).some(
        (other: any) =>
          other.taskId === t.id &&
          other.id !== r.id &&
          other.state === "submitted",
      );
      const nextTask = {
        ...t,
        progress,
        quantity,
        status: otherSubmittedReports
          ? "review"
          : progress === 100
            ? t.status === "done"
              ? "done"
              : "review"
            : ["draft", "assigned", "pending", "review"].includes(t.status)
              ? "working"
              : t.status,
        result: result || t.result,
        difficulty: difficulty || t.difficulty,
        proposal: proposal || t.proposal,
        lastReport: r.submitted || now(),
        evidenceIds: mergedEvidenceIds,
      };
      const nr =
        b.action === "confirm"
          ? await updatePair(
              r,
              rd,
              t,
              nextTask,
              u,
              "Xác nhận và đồng bộ báo cáo",
              "Duyệt và cập nhật tiến độ",
            )
          : await update(
              r,
              rd,
              u,
              "Yêu cầu bổ sung báo cáo",
            );
      await notify(
        t,
        b.action === "confirm"
          ? "Báo cáo đã xác nhận"
          : "Báo cáo cần bổ sung: " + safe(b.reason),
      );
      return json(nr);
    }
    if (path === "milestone" && method === "POST") {
      const t = await taskFor(u, b.taskId);
      check(canReport(u, t));
      await assertOpen(t.month);
      check(
        safe(b.title) && /^\d{4}-\d{2}-\d{2}$/.test(b.due),
        "Nhập đầu việc và thời hạn.",
        400,
      );
      const old = b.id ? await record(b.id) : null;
      if (old) {
        check(old.kind === "milestone" && old.taskId === t.id);
        check(old.version === b.version, "Đầu việc đã thay đổi.", 409);
      }
      check(
        ["todo", "working", "done"].includes(b.state),
        "Trạng thái không hợp lệ.",
        400,
      );
      const d = {
        taskId: t.id,
        title: safe(b.title),
        due: b.due,
        owner: safe(b.owner),
        state: b.state,
        result: safe(b.result),
        author: u.name,
      };
      return json(
        old
          ? await update(old, d, u, "Sửa mốc tiến độ")
          : await insert("milestone", d, u, id(), t.id),
      );
    }
    if (path === "comment" && method === "POST") {
      const t = await taskFor(u, b.taskId);
      check(safe(b.text), "Nhập nội dung.", 400);
      await assertOpen(t.month);
      check(
        canReport(u, t) ||
          has(u, "secretary", "standing", "chair", "council", "inspector"),
      );
      const comment = await insert(
        "comment",
        {
          taskId: t.id,
          text: safe(b.text),
          type: b.type === "direction" ? "direction" : "coordination",
          author: u.name,
          authorId: u.id,
        },
        u,
        id(),
        t.id,
      );
      await notify(t, "Có ý kiến mới: " + t.title);
      return json(comment);
    }
    if (path === "comments" && method === "GET") {
      const tid = new URL(req.url).searchParams.get("id") || "";
      await taskFor(u, tid);
      return json(
        (await records("comment")).filter((c: any) => c.taskId === tid),
      );
    }
    if (path === "remind" && method === "POST") {
      check(office(u));
      const ts = b.id
        ? [await taskFor(u, b.id)]
        : (await records("task")).filter(
            (t: any) =>
              canSee(u, t) &&
              !["draft", "pending", "done", "cancelled", "paused"].includes(
                t.status,
              ),
          );
      const cfg = await record("settings"),
        reports = await records("report");
      let count = 0;
      for (const t of ts) {
        const w = reportWindow(t, new Date(), cfg);
        const ds = deadlineState(t, new Date(), cfg.warningDays),
          rs = reportState(t, reports, new Date(), cfg);
        const msg = b.id
          ? safe(b.message) || "Đề nghị cập nhật tiến độ"
          : ds === "overdue"
            ? "Nhiệm vụ quá hạn"
            : rs === "missing"
              ? "Chưa gửi báo cáo " +
                (w.frequency === "daily" ? "hằng ngày" : "tuần")
              : ds === "soon"
                ? "Nhiệm vụ sắp đến hạn"
                : "";
        if (msg) {
          await notify(
            t,
            msg + ": " + t.title,
            b.id ? id() : t.id + "-" + msg + "-" + w.key,
          );
          count++;
        }
      }
      await log(u, "Đôn đốc nội bộ", "notifications", null, { count }).run();
      return json({ count });
    }
    if (path === "notice" && method === "POST") {
      const n = await record(b.id);
      check(n?.kind === "notice");
      await taskFor(u, n.taskId);
      return json(
        await update(
          n,
          { ...n, readBy: Array.from(new Set([...(n.readBy || []), u.id])) },
          u,
          "Đọc thông báo",
        ),
      );
    }
    if (path === "period" && method === "POST") {
      check(approver(u));
      check(/^\d{4}-\d{2}$/.test(b.month));
      const rid = "period-" + b.month;
      const old = await record(rid);
      check(!old || old.version === b.version, "Kỳ đã thay đổi.", 409);
      if (b.action === "reopen") {
        check(old?.closed && safe(b.reason), "Nhập lý do mở điều chỉnh.", 400);
        return json(
          await update(
            old,
            { ...old, closed: false, reason: safe(b.reason) },
            u,
            "Mở kỳ điều chỉnh",
          ),
        );
      }
      check(!old?.closed, "Kỳ đã khóa.", 409);
      const tasks = (await records("task")).filter(
        (t: any) => t.month === b.month && canSee(u, t),
      );
      const reports = (await records("report")).filter((r: any) =>
        tasks.some((t: any) => t.id === r.taskId),
      );
      const cfg = await record("settings");
      const snapshot = {
        month: b.month,
        tasks,
        reports,
        settings: cfg,
        units: await records("unit"),
        documents: (await records("document")).filter(
          (d: any) =>
            tasks.some((t: any) => t.documentId === d.id) &&
            (!d.restricted || d.allowedUsers?.includes(u.id)),
        ),
        files: (await all("SELECT * FROM files"))
          .filter(
            (f: any) =>
              tasks.some((t: any) => t.id === f.parent_id) ||
              reports.some((r: any) => r.id === f.parent_id),
          )
          .map((f: any) => ({
            ...f,
            taskId: reports.find((r: any) => r.id === f.parent_id)?.taskId,
          })),
        closedAt: now(),
        author: u.name,
      };
      await insert("snapshot", snapshot, u);
      const data = {
        month: b.month,
        closed: true,
        closedAt: now(),
        revision: (old?.revision || 0) + 1,
      };
      return json(
        old
          ? await update(old, data, u, "Khóa sổ")
          : await insert("period", data, u, rid),
      );
    }
    if (path === "snapshots" && method === "GET") {
      check(office(u) || has(u, "secretary"));
      return json(
        (await records("snapshot")).map((s: any) => ({
          ...s,
          tasks: s.tasks.filter((t: any) => canSee(u, t)),
          reports: s.reports.filter((r: any) =>
            s.tasks.some((t: any) => t.id === r.taskId && canSee(u, t)),
          ),
        })),
      );
    }
    if (path === "upload" && method === "POST") {
      const form = await req.formData();
      const pid = String(form.get("parentId"));
      const r = await record(pid);
      check(r, "Không tìm thấy hồ sơ.", 404);
      if (r.kind === "report") {
        const task = await taskFor(u, r.taskId);
        check(
          canReport(u, task) &&
            reportingUnits(u, task).includes(r.unit) &&
            r.author === u.id &&
            ["draft", "returned"].includes(r.state),
          "Chỉ được tải minh chứng cho báo cáo đang sửa.",
        );
      } else if (r.kind === "task") check(canReport(u, r));
      else
        check(
          (r.kind === "settings" && has(u, "admin")) ||
            (r.kind === "document" &&
              office(u) &&
              (!r.restricted || r.allowedUsers.includes(u.id))),
        );
      if (r.month) await assertOpen(r.month);
      if (r.kind === "report")
        check(
          (await all("SELECT id FROM files WHERE parent_id=?", pid)).length < 3,
          "Mỗi báo cáo được đính kèm tối đa 3 tệp minh chứng.",
          400,
        );
      const f = form.get("file");
      check(f instanceof File, "Chọn tệp.", 400);
      const file = f as File;
      const ext = file.name.split(".").pop()?.toLowerCase();
      check(
        [
          "pdf",
          "doc",
          "docx",
          "xls",
          "xlsx",
          "png",
          "jpg",
          "jpeg",
          "webp",
          "mp4",
          "webm",
          "zip",
          "rar",
          "7z",
        ].includes(ext || ""),
        "Chỉ nhận PDF, Word, Excel, JPG, PNG, WEBP, MP4, WEBM, ZIP, RAR, 7Z.",
        400,
      );
      check(
        file.size > 0 && file.size <= 25 * 1024 * 1024,
        "Tệp tối đa 25 MB.",
        400,
      );
      const buf = new Uint8Array(await file.arrayBuffer());
      const valid =
        ext === "zip"
          ? [
              [80, 75, 3, 4],
              [80, 75, 5, 6],
              [80, 75, 7, 8],
            ].some((sig) => sig.every((n, i) => buf[i] === n))
          : ext === "rar"
            ? [
                [82, 97, 114, 33, 26, 7, 0],
                [82, 97, 114, 33, 26, 7, 1, 0],
              ].some((sig) => sig.every((n, i) => buf[i] === n))
            : ext === "7z"
              ? [55, 122, 188, 175, 39, 28].every((n, i) => buf[i] === n)
              : ["doc", "xls"].includes(ext || "")
                ? [208, 207, 17, 224, 161, 177, 26, 225].every(
                    (n, i) => buf[i] === n,
                  )
                : ext === "webp"
                  ? String.fromCharCode(...buf.slice(0, 4)) === "RIFF" &&
                    String.fromCharCode(...buf.slice(8, 12)) === "WEBP"
                  : ext === "pdf"
                    ? String.fromCharCode(...buf.slice(0, 4)) === "%PDF"
                    : ["docx", "xlsx"].includes(ext || "")
                      ? buf[0] === 80 && buf[1] === 75
                      : ["jpg", "jpeg"].includes(ext || "")
                        ? buf[0] === 255 && buf[1] === 216
                        : ext === "png"
                          ? buf[0] === 137 && buf[1] === 80
                          : ext === "mp4"
                            ? String.fromCharCode(...buf.slice(4, 8)) === "ftyp"
                            : buf[0] === 26 && buf[1] === 69;
      check(valid, "Nội dung tệp không khớp định dạng.", 400);
      if (r.kind === "settings")
        check(
          ["png", "jpg", "jpeg"].includes(ext || ""),
          "Logo phải là ảnh PNG hoặc JPG.",
          400,
        );
      const fid = id();
      await bucket().put(fid, buf);
      try {
        if (r.kind === "report") {
          await update(
            r,
            { ...r, evidenceIds: [...(r.evidenceIds || []), fid] },
            u,
            "Thêm minh chứng báo cáo",
            (op) => [
              stmt(
                "INSERT INTO files(id,parent_id,name,mime,size,owner,created) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND json_extract(data,'$._operation')=?)",
                fid,
                pid,
                file.name.slice(0, 200),
                (
                  {
                    pdf: "application/pdf",
                    doc: "application/msword",
                    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    xls: "application/vnd.ms-excel",
                    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    png: "image/png",
                    jpg: "image/jpeg",
                    jpeg: "image/jpeg",
                    webp: "image/webp",
                    mp4: "video/mp4",
                    webm: "video/webm",
                    zip: "application/zip",
                    rar: "application/vnd.rar",
                    "7z": "application/x-7z-compressed",
                  } as any
                )[ext || ""],
                file.size,
                u.id,
                now(),
                r.id,
                op,
              ),
            ],
          );
        } else
          await db().batch([
            stmt(
              "INSERT INTO files(id,parent_id,name,mime,size,owner,created) VALUES(?,?,?,?,?,?,?)",
              fid,
              pid,
              file.name.slice(0, 200),
              (
                {
                  doc: "application/msword",
                  xls: "application/vnd.ms-excel",
                  webp: "image/webp",
                  pdf: "application/pdf",
                  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  png: "image/png",
                  jpg: "image/jpeg",
                  jpeg: "image/jpeg",
                  mp4: "video/mp4",
                  webm: "video/webm",
                  zip: "application/zip",
                  rar: "application/vnd.rar",
                  "7z": "application/x-7z-compressed",
                } as any
              )[ext || ""] || "application/octet-stream",
              file.size,
              u.id,
              now(),
            ),
            log(u, "Tải minh chứng", pid, null, { file: file.name, id: fid }),
          ]);
      } catch (e) {
        await bucket().delete(fid);
        throw e;
      }
      return json({ ok: true, id: fid });
    }
    if (path === "report-file-delete" && method === "POST") {
      const f = await one("SELECT * FROM files WHERE id=?", b.id);
      check(f, "Không tìm thấy tệp.", 404);
      const r = await record(f.parent_id);
      check(
        r?.kind === "report" &&
          r.state === "draft" &&
          !r.submitted &&
          !r.everSubmitted &&
          r.author === u.id &&
          f.owner === u.id,
        "Chỉ được xóa tệp của bản nháp chưa gửi.",
      );
      const t = await taskFor(u, r.taskId);
      check(canReport(u, t) && reportingUnits(u, t).includes(r.unit));
      await assertOpen(t.month);
      await update(
        r,
        {
          ...r,
          evidenceIds: (r.evidenceIds || []).filter((x: string) => x !== f.id),
        },
        u,
        "Xóa minh chứng chưa gửi",
        (op) => [
          stmt(
            "DELETE FROM files WHERE id=? AND EXISTS(SELECT 1 FROM records WHERE id=? AND json_extract(data,'$._operation')=?)",
            f.id,
            r.id,
            op,
          ),
        ],
      );
      await bucket().delete(f.id);
      return json({ ok: true });
    }
    if (path === "logo" && method === "GET") {
      const f = await one(
        "SELECT * FROM files WHERE id=? AND parent_id=?",
        new URL(req.url).searchParams.get("id"),
        "settings",
      );
      check(f, "Không tìm thấy logo.", 404);
      const obj = await bucket().get(f.id);
      check(obj, "Không tìm thấy tệp.", 404);
      return new Response(obj.body, {
        headers: {
          "Content-Type": f.mime,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, max-age=300",
        },
      });
    }
    if (path === "file" && method === "GET") {
      const f = await one(
        "SELECT * FROM files WHERE id=?",
        new URL(req.url).searchParams.get("id"),
      );
      check(f, "Không tìm thấy tệp.", 404);
      const r = await record(f.parent_id);
      if (r.kind === "report") {
        const task = await record(r.taskId);
        check(
          canReadReport(u, task, r) ||
            (task &&
              canSee(u, task) &&
              Array.isArray(task.evidenceIds) &&
              task.evidenceIds.includes(f.id)),
        );
      } else if (r.kind === "task") check(canSee(u, r));
      else
        check(
          (!r.restricted || r.allowedUsers.includes(u.id)) &&
            (office(u) ||
              has(u, "secretary") ||
              (await records("task")).some(
                (t: any) => t.documentId === r.id && canSee(u, t),
              )),
        );
      const obj = await bucket().get(f.id);
      check(obj, "Tệp không còn tồn tại.", 404);
      return new Response(obj.body, {
        headers: {
          "Content-Type": f.mime,
          "Content-Disposition":
            (new URL(req.url).searchParams.get("preview") === "1" &&
            (f.mime.startsWith("image/") || f.mime === "application/pdf")
              ? "inline"
              : "attachment") +
            "; filename*=UTF-8''" +
            encodeURIComponent(f.name),
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store",
        },
      });
    }
    if (path === "export-log" && method === "POST") {
      await log(u, "Xuất báo cáo", "export", null, {
        format: safe(b.format, 30),
        month: safe(b.month, 10),
      }).run();
      return json({ ok: true });
    }
    if (path === "backup" && method === "GET") {
      check(has(u, "admin"));
      const raw = await all("SELECT * FROM records");
      const allowed = new Set(
        raw
          .filter((r: any) => {
            const d = JSON.parse(r.data);
            return (
              (r.kind === "task" && canSee(u, { ...d, id: r.id })) ||
              (r.kind === "document" &&
                (!d.restricted || d.allowedUsers?.includes(u.id)))
            );
          })
          .map((r: any) => r.id),
      );
      const rec = raw.filter((r: any) => {
        const d = JSON.parse(r.data);
        if (["task", "document"].includes(r.kind)) return allowed.has(r.id);
        if (["report", "comment", "notice", "milestone"].includes(r.kind))
          return allowed.has(d.taskId);
        return r.kind !== "snapshot";
      });
      await log(u, "Sao lưu dữ liệu nghiệp vụ", "backup").run();
      return json({
        format: "namsach-business-v1",
        created: now(),
        records: rec,
        files: (await all("SELECT * FROM files")).filter(
          (f: any) =>
            allowed.has(f.parent_id) ||
            rec.some((r: any) => r.kind === "report" && r.id === f.parent_id),
        ),
        note: "Không chứa mật khẩu, phiên đăng nhập hoặc nội dung tệp. Kho minh chứng cần sao lưu riêng.",
      });
    }
    if (path === "restore" && method === "POST") {
      check(has(u, "admin"));
      check(
        b.confirm === "PHUC HOI" &&
          b.backup?.format === "namsach-business-v1" &&
          Array.isArray(b.backup.records),
        "Bản sao lưu không hợp lệ.",
        400,
      );
      const existing = await one(
        "SELECT id FROM records WHERE kind IN ('task','document','report') LIMIT 1",
      );
      check(
        !existing,
        "Chỉ phục hồi vào hệ thống chưa có dữ liệu nghiệp vụ để tránh ghi đè.",
        409,
      );
      const rows = b.backup.records.filter((r: any) =>
        [
          "unit",
          "task",
          "document",
          "report",
          "period",
          "snapshot",
          "comment",
          "notice",
          "milestone",
        ].includes(r.kind),
      );
      check(rows.length <= 5000, "Bản sao lưu quá lớn.", 400);
      const statements = [];
      for (const r of rows) {
        check(typeof r.id === "string" && typeof r.data === "string");
        JSON.parse(r.data);
        statements.push(
          stmt(
            "INSERT OR IGNORE INTO records(id,kind,parent_id,data,version,updated) VALUES(?,?,?,?,?,?)",
            r.id,
            r.kind,
            r.parent_id || null,
            r.data,
            r.version || 1,
            r.updated || now(),
          ),
        );
      }
      statements.push(
        log(u, "Phục hồi dữ liệu nghiệp vụ", "restore", null, {
          count: rows.length,
        }),
      );
      await db().batch(statements);
      return json({ ok: true, count: rows.length });
    }
    fail("Không tìm thấy chức năng.", 404);
  } catch (e: any) {
    console.error("API error", e.message);
    return json(
      {
        error: e.status
          ? e.message
          : "Không thể lưu hoặc tải dữ liệu. Nội dung đang nhập được giữ lại. Vui lòng thử lại.",
      },
      e.status || 500,
    );
  }
}
export const GET = (req: Request) => handle(req);
export const POST = (req: Request) => handle(req);
