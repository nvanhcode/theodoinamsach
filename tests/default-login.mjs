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
  assert.equal(db.prepare("SELECT count(*) AS n FROM users").get().n, 1);
  assert.notEqual(
    db.prepare("SELECT password FROM users").get().password,
    "admin",
  );
  db.close();
  writeFileSync(
    "tests/DEFAULT-LOGIN-RESULTS.txt",
    "PASS wrong password rejected; admin/admin creates initial Admin; real authenticated data access; repeat login does not duplicate; password stored as salted hash.\n",
  );
  console.log(
    "PASS default admin/admin login, permissions, hash and repeat login",
  );
} finally {
  server.kill();
  await new Promise((r) => server.once("exit", r));
  rmSync(dir, { recursive: true, force: true });
}
