import { record, stmt, db, now } from "./server";
export async function reconcileBrand() {
  const marker = "brand-bua-liem-2026-10-08-v1";
  if ((await record(marker)) || !(await record("settings"))) return;
  await db().batch([
    stmt(
      "INSERT OR IGNORE INTO records(id,kind,data,version,updated) VALUES(?,?,?,1,?)",
      marker,
      "migration",
      JSON.stringify({ logo: "/bua-liem-nam-sach.png" }),
      now(),
    ),
    stmt(
      "UPDATE records SET data=json_set(data,'$.logo',?),version=version+1,updated=? WHERE id='settings'",
      "/bua-liem-nam-sach.png",
      now(),
    ),
  ]);
}
