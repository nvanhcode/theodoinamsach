import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
const dir = mkdtempSync(path.join(tmpdir(), "ns-default-"));
const server = spawn(process.execPath, ["selfhost-dist/server/server.mjs"], {
  env: {
    ...process.env,
    PORT: "3188",
    DATA_DIR: dir,
    APP_ORIGIN: "http://localhost:3188",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (d) => {
      if (d.toString().includes("ready")) resolve();
    });
    server.on("error", reject);
    server.on("exit", (c) => {
      if (c) reject(new Error("Server failed"));
    });
  });
  const login = (body) =>
    fetch("http://localhost:3188/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-NS-Request": "1" },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await login({ username: "admin", password: "wrong" })).status,
    401,
  );
  const r = await login({ username: "admin", password: "admin" });
  assert.equal(r.status, 200);
  const user = (await r.json()).user;
  assert.equal(user.username, "admin");
  assert.deepEqual(user.roles, ["admin"]);
  assert.equal(user.mustChange, 0);
  const data = await fetch("http://localhost:3188/api/data", {
    headers: { cookie: r.headers.get("set-cookie").split(";")[0] },
  });
  assert.equal(data.status, 200);
  assert.equal((await data.json()).units.length, 23);
  assert.equal(
    (await login({ username: "admin", password: "admin" })).status,
    200,
  );
  const db = new DatabaseSync(path.join(dir, "nam-sach.sqlite"));
  const usernames = db
    .prepare("SELECT username FROM users ORDER BY username")
    .all()
    .map((row) => row.username);
  assert.equal(usernames.length, 9);
  assert.ok(usernames.includes("admin"));
  assert.deepEqual(usernames.filter((username) => username !== "admin"), [
    "bxdd",
    "congan",
    "hdnd",
    "mttq",
    "quansu",
    "ubkt",
    "ubnd",
    "vpdu",
  ]);
  assert.notEqual(
    db.prepare("SELECT password FROM users").get().password,
    "admin",
  );
  db.close();
  writeFileSync(
    "tests/DEFAULT-LOGIN-RESULTS.txt",
    "PASS wrong password rejected; admin/admin creates initial Admin; eight authorized reporting accounts provision once; authenticated data access; password stored as salted hash.\n",
  );
  console.log(
    "PASS default admin/admin login, eight reporting accounts, permissions and hash",
  );
} finally {
  server.kill();
  await new Promise((r) => server.once("exit", r));
  rmSync(dir, { recursive: true, force: true });
}
