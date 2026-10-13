import { unitAccountSeeds } from "./unit-account-seeds";
import { db, stmt, record, records, one, id, now, check } from "./server";
import { reconcileUnitDirectory } from "./unit-directory";

const marker = "unit-reporting-accounts-2026-10-11-v1";
// Idempotent, transactional provisioning. Existing accounts and later admin edits are preserved.
export async function provisionUnitAccounts() {
  if ((await record(marker)) || !(await one("SELECT id FROM users LIMIT 1")))
    return;
  await reconcileUnitDirectory();
  const units = await records("unit");
  const time = now();
  const statements = [];
  for (const seed of unitAccountSeeds) {
    const primary = units.find((u: any) => u.name === seed.name);
    check(primary, "Thiếu đơn vị để cấp tài khoản " + seed.username, 409);
    const scope = seed.group
      ? units.filter((u: any) => u.group === seed.group)
      : [primary];
    const uid = "reporting-" + seed.username;
    const existing = await one(
      "SELECT id FROM users WHERE username=?",
      seed.username,
    );
    check(
      !existing || existing.id === uid,
      "Tên đăng nhập " +
        seed.username +
        " đã được sử dụng; cần quản trị viên đối chiếu.",
      409,
    );
    statements.push(
      stmt(
        "INSERT OR IGNORE INTO users(id,username,name,password,roles,units,groups,active,must_change,temp_until,version) VALUES(?,?,?,?,?,?,?,1,1,NULL,1)",
        uid,
        seed.username,
        seed.name,
        seed.passwordHash,
        '["editor"]',
        JSON.stringify([
          primary.id,
          ...scope
            .filter((u: any) => u.id !== primary.id)
            .map((u: any) => u.id),
        ]),
        "[]",
      ),
    );
    statements.push(
      stmt(
        "INSERT INTO audit(id,actor,action,target,after,time) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM records WHERE id=?)",
        id(),
        "Hệ thống",
        "Cấp tài khoản đầu mối báo cáo",
        uid,
        JSON.stringify({
          username: seed.username,
          name: seed.name,
          units: scope.map((u: any) => u.id),
          roles: ["editor"],
          mustChange: true,
        }),
        time,
        marker,
      ),
    );
  }
  statements.push(
    stmt(
      "INSERT OR IGNORE INTO records(id,kind,data,version,updated) VALUES(?,?,?,1,?)",
      marker,
      "migration",
      JSON.stringify({ accounts: unitAccountSeeds.map((s) => s.username) }),
      time,
    ),
  );
  await db().batch(statements);
}
