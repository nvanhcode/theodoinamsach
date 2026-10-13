import { build } from "vite";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
await build({
  configFile: false,
  build: {
    ssr: "lib/progress-summary.ts",
    outDir: ".sites-runtime/progress-test",
    rollupOptions: { output: { entryFileNames: "summary.mjs" } },
  },
});
const { progressCounts, progressUnits, matchesProgressStatus } = await import(
  pathToFileURL(process.cwd() + "/.sites-runtime/progress-test/summary.mjs")
);
const tasks = [
  "draft",
  "pending",
  "assigned",
  "working",
  "review",
  "returned",
  "done",
  "paused",
  "cancelled",
].map((status, i) => ({
  id: String(i),
  unit: "a",
  status,
  progress: status === "review" ? 100 : 0,
}));
assert.deepEqual(progressCounts(tasks), {
  total: 9,
  givenWork: 6,
  done: 1,
  unfinished: 5,
});
assert.equal(
  matchesProgressStatus(
    tasks.find((t) => t.status === "review"),
    "unfinished",
  ),
  true,
  "100% report must await confirmation",
);
for (const key of ["givenWork", "done", "unfinished"])
  assert.equal(
    tasks.filter((t) => matchesProgressStatus(t, key)).length,
    progressCounts(tasks)[key],
  );
let units = [
  { id: "a", name: "Văn phòng Đảng ủy", group: "Khối Đảng", active: true },
  { id: "b", name: "Công an xã", group: "Công an", active: true },
  { id: "old", name: "Đơn vị cũ", active: false },
];
let rows = progressUnits(units, tasks);
assert.equal(rows.length, 2);
assert.equal(rows.find((r) => r.id === "b").givenWork, 0);
units = units
  .map((u) => (u.id === "a" ? { ...u, name: "Văn phòng Đảng ủy cập nhật" } : u))
  .concat({ id: "new", name: "Quân sự xã", group: "Quân sự", active: true });
rows = progressUnits(units, tasks);
assert.equal(rows.find((r) => r.id === "a").name, "Văn phòng Đảng ủy cập nhật");
assert.equal(rows.find((r) => r.id === "a").done, 1);
assert.equal(rows.find((r) => r.id === "new").total, 0);
assert.deepEqual(
  progressUnits(units, tasks, { group: "Công an" }).map((r) => r.id),
  ["b"],
);
assert.deepEqual(
  progressUnits(units, tasks, { unit: "a" }).map((r) => r.id),
  ["a"],
);
assert.equal(
  progressUnits(units, [...tasks, { unit: "old", status: "done" }]).find(
    (r) => r.id === "old",
  ).done,
  1,
  "retired unit must retain historical tasks",
);
assert.deepEqual(progressCounts([]), {
  total: 0,
  givenWork: 0,
  done: 0,
  unfinished: 0,
});
console.log(
  "PASS unit directory synchronization, confirmed completion, status counts, scope and historical tasks",
);
