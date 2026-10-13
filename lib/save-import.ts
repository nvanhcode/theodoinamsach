// Bound simultaneous writes so each record keeps the existing permission, audit and transaction checks.
export async function saveImportRows(
  rows: any[],
  save: (payload: any) => Promise<any>,
  onProgress: (rows: any[], finished: number, total: number) => void,
  concurrency = 4,
) {
  const next = rows.map((r) => ({ ...r }));
  const pending = next
    .map((r, i) => (!r.saved && !r.errors.length ? i : -1))
    .filter((i) => i >= 0);
  let cursor = 0,
    finished = 0;
  async function worker() {
    while (cursor < pending.length) {
      const index = pending[cursor++];
      try {
        const result = await save(next[index].payload);
        next[index] = {
          ...next[index],
          saved: true,
          payload: result,
          message:
            result.status === "assigned"
              ? "Đã lưu và giao đến đơn vị"
              : result.status === "pending"
                ? "Đã lưu và trình duyệt"
                : "Đã lưu vào dữ liệu dùng chung",
        };
      } catch (e: any) {
        next[index] = {
          ...next[index],
          message:
            e.message || "Chưa lưu được dòng này. Bấm Lưu hệ thống để thử lại.",
        };
      }
      finished++;
      onProgress([...next], finished, pending.length);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), pending.length) },
      worker,
    ),
  );
  return next;
}
