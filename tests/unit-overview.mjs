import { build } from "vite";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
await build({
  configFile: false,
  build: {
    ssr: "lib/unit-overview.ts",
    outDir: ".sites-runtime/overview-test",
    rollupOptions: { output: { entryFileNames: "overview.mjs" } },
  },
});
const { unitSections } = await import(
  pathToFileURL(process.cwd() + "/.sites-runtime/overview-test/overview.mjs")
);
const units = [
  {
    id: "police",
    name: "Công an xã",
    group: "Lực lượng vũ trang",
    active: true,
  },
  {
    id: "military",
    name: "Ban Chỉ huy Quân sự xã",
    group: "Lực lượng vũ trang",
    active: true,
  },
  { id: "ubnd", name: "UBND xã", group: "UBND", active: true },
  {
    id: "culture",
    name: "Phòng Văn hóa – Xã hội",
    group: "UBND",
    active: true,
  },
];
const sections = unitSections(units, [
  { unit: "police" },
  { unit: "ubnd" },
  { unit: "culture" },
]);
assert.equal(sections.length, 2);
const armed = sections.find((s) => s.key === "military");
assert.equal(armed.title, "Lực lượng vũ trang");
assert.equal(armed.units.length, 2);
assert.equal(armed.total, 1);
const gov = sections.find((s) => s.key === "government");
assert.deepEqual(
  gov.units.map((u) => u.id),
  ["culture"],
);
assert.equal(gov.total, 2);
assert.equal(gov.shared, 1);
assert.deepEqual(
  unitSections(units, [], { group: "Lực lượng vũ trang" }).map((s) => s.key),
  ["military"],
);
console.log(
  "PASS police and military together; common UBND card omitted without losing shared task totals",
);
