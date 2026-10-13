import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { GET, POST } from "../app/api/[...path]/route";
import { checkReminders } from "../lib/reminders";
const port = Number(process.env.PORT || 3080);
const root = path.resolve("selfhost-dist/client");
const origin = process.env.APP_ORIGIN || "http://localhost:" + port;
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", origin);
      if (url.pathname.startsWith("/api/")) {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const c of req) {
          size += c.length;
          if (size > 27 * 1024 * 1024) {
            res.writeHead(413);
            res.end("Tệp quá lớn");
            return;
          }
          chunks.push(c);
        }
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers))
          if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
        headers.set("cf-connecting-ip", req.socket.remoteAddress || "local");
        const request = new Request(url, {
          method: req.method,
          headers,
          ...(req.method === "POST" ? { body: Buffer.concat(chunks) } : {}),
        });
        const response = await (req.method === "POST" ? POST : GET)(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      let p = path.resolve(root, "." + decodeURIComponent(url.pathname));
      if (
        !p.startsWith(root + path.sep) ||
        !existsSync(p) ||
        !statSync(p).isFile()
      )
        p = path.join(root, "index.html");
      const mime: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".ttf": "font/ttf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
      };
      res.writeHead(200, {
        "Content-Type": mime[path.extname(p)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(readFileSync(p));
    } catch (e) {
      console.error(e);
      res.writeHead(500);
      res.end("Lỗi máy chủ");
    }
  })
  .listen(port, "0.0.0.0", () =>
    console.log("Nam Sach self-host ready on port " + port),
  );
setInterval(() => checkReminders().catch(console.error), 60000).unref();
checkReminders().catch(console.error);
