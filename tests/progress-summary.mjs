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
const {
  completionPercentage,
  progressCounts,
  progressUnits,
  matchesProgressStatus,
  bucketCounts,
  matchesTaskFilter,
} = await import(
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
assert.equal(completionPercentage(1, 4), 25);
assert.equal(completionPercentage(3, 3), 100);
assert.equal(completionPercentage(4, 3), 100, "display rate is capped");
assert.equal(completionPercentage(0, 0), null, "no assigned tasks has no rate");
console.log(
  "PASS confirmed completion, status counts, percentage, scope and historical tasks",
);

// Dashboard cards, progress table and filters reconcile on the same tasks.
{
  const now = new Date("2026-11-10T03:00:00Z");
  const sample = [
    ["draft", "2026-11-05"],
    ["pending", "2026-11-30"],
    ["assigned", "2026-11-05"],
    ["assigned", "2026-11-30"],
    ["working", "2026-11-30"],
    ["review", "2026-11-01"],
    ["returned", "2026-11-30"],
    ["done", "2026-11-01"],
    ["paused", "2026-11-01"],
    ["cancelled", "2026-11-30"],
  ].map(([status, due], i) => ({ id: "s" + i, unit: "a", status, due }));
  const b = bucketCounts(sample, now);
  assert.deepEqual(b, {
    total: 10,
    notAssigned: 2,
    done: 1,
    activeWork: 3,
    overdue: 2,
    paused: 1,
    cancelled: 1,
  });
  assert.equal(
    b.notAssigned + b.done + b.activeWork + b.overdue + b.paused + b.cancelled,
    b.total,
  );
  const p = progressCounts(sample);
  assert.equal(p.givenWork, b.done + b.activeWork + b.overdue + b.paused);
  assert.equal(p.unfinished, p.givenWork - p.done);
  for (const key of ["notAssigned", "done", "activeWork", "overdue"])
    assert.equal(
      sample.filter((t) => matchesTaskFilter(t, key, now)).length,
      b[key],
      "filter " + key + " matches its card",
    );
  assert.equal(
    sample.filter((t) => matchesTaskFilter(t, "notStarted", now)).length,
    b.notAssigned,
    "old notStarted links still work",
  );
  console.log("PASS dashboard buckets add up to total and match list filters");
}
