import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
const root = process.env.DATA_DIR || path.resolve("data");
mkdirSync(root, { recursive: true });
mkdirSync(path.join(root, "files"), { recursive: true });
const sql = new DatabaseSync(path.join(root, "nam-sach.sqlite"));
sql.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
sql.exec("CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY)");
for (const file of readdirSync("drizzle")
  .filter((x) => x.endsWith(".sql"))
  .filter(
    (x) =>
      !(process.env.TEST_MODE === "1" && x === "0001_nam_sach_snapshot.sql"),
  )
  .sort()) {
  if (!sql.prepare("SELECT name FROM migrations WHERE name=?").get(file)) {
    sql.exec("BEGIN");
    try {
      sql.exec(readFileSync(path.join("drizzle", file), "utf8"));
      sql.prepare("INSERT INTO migrations(name) VALUES(?)").run(file);
      sql.exec("COMMIT");
    } catch (e) {
      sql.exec("ROLLBACK");
      throw e;
    }
  }
}
class Statement {
  args: any[] = [];
  constructor(public query: string) {}
  bind(...args: any[]) {
    this.args = args;
    return this;
  }
  raw() {
    return sql.prepare(this.query);
  }
  async first() {
    return this.raw().get(...this.args) || null;
  }
  async all() {
    return { results: this.raw().all(...this.args), success: true };
  }
  runSync() {
    const r = this.raw().run(...this.args);
    return { success: true, meta: { changes: Number(r.changes) } };
  }
  async run() {
    return this.runSync();
  }
}
export const env = {
  SETUP_TOKEN: process.env.SETUP_TOKEN,
  DB: {
    prepare: (q: string) => new Statement(q),
    async batch(statements: Statement[]) {
      sql.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((s) => s.runSync());
        sql.exec("COMMIT");
        return results;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  },
  BUCKET: {
    async put(id: string, bytes: any) {
      const content =
        bytes && typeof bytes.getReader === "function"
          ? Buffer.from(await new Response(bytes).arrayBuffer())
          : Buffer.from(bytes);
      writeFileSync(path.join(root, "files", id), content);
    },
    async get(id: string) {
      const p = path.join(root, "files", id);
      return existsSync(p) ? { body: readFileSync(p) } : null;
    },
    async delete(id: string) {
      const p = path.join(root, "files", id);
      if (existsSync(p)) unlinkSync(p);
    },
  },
};
