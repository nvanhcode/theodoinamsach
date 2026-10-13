import {
  mkdirSync,
  existsSync,
  copyFileSync,
  readdirSync,
  constants,
} from "node:fs";
import path from "node:path";
const root = path.resolve(process.env.DATA_DIR || "data");
mkdirSync(root, { recursive: true });
const database = path.join(root, "nam-sach.sqlite");
if (!existsSync(database)) {
  if (readdirSync(root).length)
    throw new Error(
      "DATA_DIR không trống nhưng thiếu SQLite; dừng để tránh ghi đè dữ liệu.",
    );
  copyFileSync(
    path.resolve("initial-data/nam-sach.sqlite"),
    database,
    constants.COPYFILE_EXCL,
  );
  console.log("Đã nạp bản dữ liệu bàn giao vào thư mục dữ liệu trống.");
}
await import("../selfhost-dist/server/server.mjs");
