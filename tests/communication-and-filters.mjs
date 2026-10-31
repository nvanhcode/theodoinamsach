import assert from "node:assert/strict";
import { build } from "vite";
import { pathToFileURL } from "node:url";

await build({
  configFile: false,
  build: {
    ssr: "lib/comment-access.ts",
    outDir: ".sites-runtime/comm-test-comment",
    rollupOptions: { output: { entryFileNames: "comment-access.mjs" } },
  },
});

await build({
  configFile: false,
  build: {
    ssr: "lib/domain.ts",
    outDir: ".sites-runtime/comm-test-domain",
    rollupOptions: { output: { entryFileNames: "domain.mjs" } },
  },
});

await build({
  configFile: false,
  build: {
    ssr: "lib/report-access.ts",
    outDir: ".sites-runtime/comm-test-report",
    rollupOptions: { output: { entryFileNames: "report-access.mjs" } },
  },
});

await build({
  configFile: false,
  build: {
    ssr: "lib/notice-priority.ts",
    outDir: ".sites-runtime/comm-test-priority",
    rollupOptions: { output: { entryFileNames: "notice-priority.mjs" } },
  },
});

const { canReadTaskComment } = await import(
  pathToFileURL(process.cwd() + "/.sites-runtime/comm-test-comment/comment-access.mjs")
);
const { canSee } = await import(
  pathToFileURL(process.cwd() + "/.sites-runtime/comm-test-domain/domain.mjs")
);
const { canReadReport } = await import(
  pathToFileURL(process.cwd() + "/.sites-runtime/comm-test-report/report-access.mjs")
);
const { noticePriority } = await import(
  pathToFileURL(process.cwd() + "/.sites-runtime/comm-test-priority/notice-priority.mjs")
);

console.log("--- Bắt đầu kiểm tra logic trao đổi thông tin và phân quyền vai trò ---");

const task = {
  id: "t1",
  title: "Xây dựng nhà văn hóa",
  unit: "ubnd",
  partners: ["congan", "quansu"],
  group: "UBND",
  status: "working",
};

// 1. Phân quyền bình luận phối hợp (canReadTaskComment)
const adminUser = { id: "u-admin", roles: ["admin"], units: [] };
const deputyUser = { id: "u-deputy", roles: ["deputy"], units: [] };
const secretaryUser = { id: "u-sec", roles: ["secretary"], units: [] };
const standingUser = { id: "u-standing", roles: ["standing"], units: [] };
const chairUser = { id: "u-chair", roles: ["chair"], units: ["ubnd"] };
const inspectorUser = { id: "u-ins", roles: ["inspector"], units: ["ubkt"] };
const leadUser = { id: "u-lead", roles: ["head"], units: ["ubnd"] };
const partnerAUser = { id: "u-congan", roles: ["partner"], units: ["congan"] };
const partnerBUser = { id: "u-quansu", roles: ["partner"], units: ["quansu"] };
const unrelatedUser = { id: "u-nongdan", roles: ["editor"], units: ["nongdan"] };

const coordCommentFromA = {
  id: "c1",
  taskId: "t1",
  type: "coordination",
  unit: "congan",
  recipientUnit: "ubnd",
  text: "Công an xã báo cáo phương án đảm bảo an ninh.",
};

const directionComment = {
  id: "c2",
  taskId: "t1",
  type: "direction",
  text: "Ý kiến chỉ đạo của lãnh đạo.",
};

// Ý kiến chỉ đạo: tất cả người xem được nhiệm vụ đều đọc được
assert.equal(canReadTaskComment(adminUser, task, directionComment), true);
assert.equal(canReadTaskComment(partnerAUser, task, directionComment), true);
assert.equal(canReadTaskComment(partnerBUser, task, directionComment), true);
assert.equal(canReadTaskComment(unrelatedUser, task, directionComment), true);

// Trao đổi phối hợp giữa Công an và UBND:
// - Lãnh đạo & Văn phòng được theo dõi giám sát
assert.equal(canReadTaskComment(adminUser, task, coordCommentFromA), true, "Admin đọc được phối hợp");
assert.equal(canReadTaskComment(deputyUser, task, coordCommentFromA), true, "Phó Chánh VP đọc được phối hợp");
assert.equal(canReadTaskComment(secretaryUser, task, coordCommentFromA), true, "Bí thư đọc được phối hợp");
assert.equal(canReadTaskComment(standingUser, task, coordCommentFromA), true, "Phó Bí thư TT đọc được phối hợp");
assert.equal(canReadTaskComment(chairUser, task, coordCommentFromA), true, "Chủ tịch UBND đọc được phối hợp");
assert.equal(canReadTaskComment(inspectorUser, task, coordCommentFromA), true, "Ủy ban Kiểm tra đọc được phối hợp");

// - Đơn vị chủ trì (UBND) đọc được
assert.equal(canReadTaskComment(leadUser, task, coordCommentFromA), true, "Chủ trì đọc được phối hợp gửi đến");

// - Đơn vị gửi (Công an) đọc được
assert.equal(canReadTaskComment(partnerAUser, task, coordCommentFromA), true, "Đơn vị phối hợp gửi đọc được ý kiến của mình");

// - Đơn vị phối hợp khác (Quân sự) KHÔNG đọc được luồng riêng của Công an
assert.equal(canReadTaskComment(partnerBUser, task, coordCommentFromA), false, "Đơn vị phối hợp khác không đọc được luồng riêng");

// - Đơn vị ngoài (Nông dân) KHÔNG đọc được luồng phối hợp
assert.equal(canReadTaskComment(unrelatedUser, task, coordCommentFromA), false, "Đơn vị ngoài không đọc được luồng phối hợp");

// 2. Phân quyền xem của vai trò Kiểm tra, giám sát (inspector)
assert.equal(canSee(inspectorUser, task), true, "Ủy ban Kiểm tra có quyền giám sát các nhiệm vụ");

// 3. Phân quyền đọc báo cáo nháp / bổ sung trong cùng đơn vị
const draftReport = {
  id: "r1",
  taskId: "t1",
  unit: "ubnd",
  author: "u-lead-old",
  state: "returned",
};
assert.equal(canReadReport(leadUser, task, draftReport), true, "Cán bộ cùng đơn vị đọc được báo cáo cần bổ sung");

// 4. Nhận diện mức độ ưu tiên thông báo
const p1 = noticePriority("Phản hồi của đơn vị chủ trì · UBND xã: Xây dựng nhà văn hóa");
assert.equal(p1.tone, "coordination", "Phản hồi đơn vị chủ trì có tone coordination");

const p2 = noticePriority("Có ý kiến mới: Xây dựng nhà văn hóa");
assert.equal(p2.tone, "review", "Ý kiến mới có tone review");

console.log("PASS Toàn bộ kiểm tra trao đổi thông tin, phân quyền vai trò và ưu tiên thông báo thành công!");
