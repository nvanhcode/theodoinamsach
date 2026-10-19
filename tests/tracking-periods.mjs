import assert from "node:assert/strict";
import { build } from "vite";
import { pathToFileURL } from "node:url";

await build({
  configFile: false,
  build: {
    ssr: "lib/tracking-periods.ts",
    outDir: ".sites-runtime/tracking-periods-test",
    rollupOptions: { output: { entryFileNames: "periods.mjs" } },
  },
});

const { trackingMonthOptions } = await import(
  pathToFileURL(
    process.cwd() + "/.sites-runtime/tracking-periods-test/periods.mjs",
  )
);
const options = trackingMonthOptions(
  {
    tasks: [{ month: "2026-10" }, { month: "2026-10" }],
    reports: [{ month: "2026-10" }],
    documents: [{ month: "2026-09" }],
    periods: [{ month: "2026-09", closed: true }],
  },
  "2026-10",
  "2026-10",
);
assert.deepEqual(
  options.map(([month]) => month),
  ["2026-11", "2026-10", "2026-09"],
  "shows the next month, periods with data and historical periods",
);
assert.match(options[0][1], /Chưa có dữ liệu/);
assert.match(options[1][1], /2 việc/);
assert.match(options[2][1], /Đã khóa sổ/);
assert.ok(
  trackingMonthOptions({}, "2025-12", "2026-10").some(
    ([month]) => month === "2025-12",
  ),
  "keeps the selected month while data refreshes",
);
console.log("PASS tracking period selector follows available monthly data");
