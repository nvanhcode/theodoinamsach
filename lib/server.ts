import { env } from "cloudflare:workers";
export const db = () => (env as any).DB;
export const bucket = () => (env as any).BUCKET;
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export const stmt = (sql: string, ...args: any[]) =>
  db()
    .prepare(sql)
    .bind(...args);
export const all = async (sql: string, ...args: any[]) =>
  (await stmt(sql, ...args).all()).results;
export const one = async (sql: string, ...args: any[]) =>
  stmt(sql, ...args).first();
export const decode = (r: any) =>
  r
    ? {
        ...JSON.parse(r.data),
        id: r.id,
        kind: r.kind,
        version: r.version,
        updated: r.updated,
      }
    : null;
export const record = async (rid: string) =>
  decode(await one("SELECT * FROM records WHERE id=?", rid));
export const records = async (kind: string) =>
  (await all("SELECT * FROM records WHERE kind=?", kind)).map(decode);
export function fail(msg: string, status = 400): never {
  throw Object.assign(new Error(msg), { status });
}
export const check = (
  ok: any,
  msg = "Không có quyền thực hiện thao tác này.",
  status = 403,
) => {
  if (!ok) fail(msg, status);
};
export const json = (x: any, status = 200, headers: any = {}) =>
  Response.json(x, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64 = (a: Uint8Array) => btoa(String.fromCharCode(...a));
export async function hash(
  p: string,
  salt = b64(crypto.getRandomValues(new Uint8Array(16))),
) {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(p),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return (
    salt +
    ":" +
    b64(
      new Uint8Array(
        await crypto.subtle.deriveBits(
          {
            name: "PBKDF2",
            salt: bytes(salt),
            iterations: 100000,
            hash: "SHA-256",
          },
          k,
          256,
        ),
      ),
    )
  );
}
export async function digest(s: string) {
  return b64(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  );
}
export const passwordCheck = (p: string) =>
  check(
    typeof p === "string" && p.length >= 12 && p.length <= 128,
    "Mật khẩu cần từ 12 đến 128 ký tự.",
    400,
  );
export function publicUser(u: any) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    roles: JSON.parse(u.roles),
    units: JSON.parse(u.units),
    groups: JSON.parse(u.groups),
    active: u.active,
    mustChange: u.must_change,
    version: u.version,
  };
}
export async function user(req: Request) {
  const token = req.headers
    .get("cookie")
    ?.match(/(?:^|; )ns_session=([^;]+)/)?.[1];
  if (!token) return null;
  const u = await one(
    "SELECT u.*,s.id AS sid FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires>? AND u.active=1",
    await digest(token),
    now(),
  );
  if (!u) return null;
  const cfg = await record("settings");
  if (req.method === "POST")
    await stmt(
      "UPDATE sessions SET expires=? WHERE id=?",
      new Date(Date.now() + (cfg?.sessionMinutes || 30) * 60000).toISOString(),
      u.sid,
    ).run();
  return publicUser(u);
}
export function csrf(req: Request) {
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    check(
      !origin || origin === new URL(req.url).origin,
      "Yêu cầu khác nguồn bị từ chối.",
      403,
    );
    check(
      req.headers.get("x-ns-request") === "1",
      "Thiếu mã xác nhận yêu cầu.",
      403,
    );
  }
}
export const log = (
  u: any,
  action: string,
  target: string,
  before: any = null,
  after: any = null,
) =>
  stmt(
    "INSERT INTO audit(id,actor,action,target,before,after,time) VALUES(?,?,?,?,?,?,?)",
    id(),
    u.name || u.username || "Hệ thống",
    action,
    target,
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null,
    now(),
  );
export async function insert(
  kind: string,
  data: any,
  u: any,
  rid = id(),
  parent: string | null = null,
  extra: any[] = [],
  action?: string,
) {
  const time = now();
  await db().batch([
    stmt(
      "INSERT INTO records(id,kind,parent_id,data,version,updated) VALUES(?,?,?,?,1,?)",
      rid,
      kind,
      parent,
      JSON.stringify(data),
      time,
    ),
    log(u, action || ("Tạo " + kind), rid, null, data),
    ...extra,
  ]);
  return { id: rid, kind, ...data, version: 1, updated: time };
}
export async function update(
  old: any,
  data: any,
  u: any,
  action = "Sửa",
  extra: any[] | ((op: string) => any[]) = [],
) {
  const time = now();
  const op = id();
  const clean = { ...data, _operation: op };
  delete clean.id;
  delete clean.version;
  delete clean.kind;
  delete clean.updated;
  const result = await db().batch([
    stmt(
      "UPDATE records SET data=?,version=version+1,updated=? WHERE id=? AND version=?",
      JSON.stringify(clean),
      time,
      old.id,
      old.version,
    ),
    stmt(
      "INSERT INTO audit(id,actor,action,target,before,after,time) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND json_extract(data,'$._operation')=?)",
      id(),
      u.name,
      action,
      old.id,
      JSON.stringify(old),
      JSON.stringify(clean),
      time,
      old.id,
      op,
    ),
    ...(typeof extra === "function" ? extra(op) : extra),
  ]);
  check(
    result[0].meta.changes === 1,
    "Dữ liệu đã được người khác cập nhật. Hãy tải lại trước khi sửa.",
    409,
  );
  return {
    ...clean,
    id: old.id,
    kind: old.kind,
    version: old.version + 1,
    updated: time,
  };
}
export async function assertOpen(month: string) {
  check(
    !(await record("period-" + month))?.closed,
    "Kỳ này đã khóa sổ. Quản trị viên cần mở điều chỉnh có lý do.",
    409,
  );
}
export async function updatePair(
  a: any,
  adata: any,
  b: any,
  bdata: any,
  u: any,
  action: string,
  actionB?: string,
) {
  const op = id(),
    time = now();
  const clean = (d: any) => {
    const n = { ...d, _operation: op };
    for (const k of ["id", "kind", "version", "updated"]) delete n[k];
    return JSON.stringify(n);
  };
  const result = await db().batch([
    stmt(
      "UPDATE records SET data=?,version=version+1,updated=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM records WHERE id=? AND version=?)",
      clean(adata),
      time,
      a.id,
      a.version,
      b.id,
      b.version,
    ),
    stmt(
      "UPDATE records SET data=?,version=version+1,updated=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM records WHERE id=? AND json_extract(data,'$._operation')=?)",
      clean(bdata),
      time,
      b.id,
      b.version,
      a.id,
      op,
    ),
    ...[
      [a, adata, action],
      [b, bdata, actionB || action],
    ].map(([old, next, act]) =>
      stmt(
        "INSERT INTO audit(id,actor,action,target,before,after,time) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND json_extract(data,'$._operation')=?)",
        id(),
        u.name,
        act,
        old.id,
        JSON.stringify(old),
        clean(next),
        time,
        old.id,
        op,
      ),
    ),
  ]);
  check(
    result[0].meta.changes === 1 && result[1].meta.changes === 1,
    "Hồ sơ đã thay đổi đồng thời. Hãy tải lại.",
    409,
  );
  return {
    ...adata,
    id: a.id,
    kind: a.kind,
    version: a.version + 1,
    updated: time,
  };
}
