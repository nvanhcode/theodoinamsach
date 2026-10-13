import {
  progressCounts,
  progressFilters,
  progressUnits,
} from "@/lib/progress-summary";
export function UnitProgress({
  units,
  tasks,
  scope,
  status,
  onStatus,
  onUnit,
}: any) {
  const counts = progressCounts(tasks),
    rows = progressUnits(units, tasks, scope);
  return (
    <section className="panel progress-directory">
      <div className="panel-head">
        <h2>Giao việc và kết quả theo cơ quan, đơn vị</h2>
        <span className="muted">{rows.length} đơn vị</span>
      </div>
      <div className="panel-body">
        <div
          className="progress-toolbar"
          role="group"
          aria-label="Lọc kết quả nhiệm vụ"
        >
          {progressFilters.map(([key, label]) => (
            <button
              key={key}
              aria-pressed={status === key}
              className={
                "progress-filter " +
                (status === key ? "active " : "") +
                (key === "done"
                  ? "complete"
                  : key === "unfinished"
                    ? "incomplete"
                    : "")
              }
              onClick={() => onStatus(key)}
            >
              <span>{label}</span>
              <b>{counts[key || "total"]}</b>
            </button>
          ))}
        </div>
        <p className="muted text-sm mb-4">
          Số liệu nhiệm vụ chủ trì theo tháng và bộ lọc đang chọn. Hoàn thành là
          kết quả đã được xác nhận; chờ xác nhận, cần bổ sung và tạm dừng vẫn
          tính chưa hoàn thành. Dự thảo, chờ duyệt giao việc và nhiệm vụ hủy chỉ
          nằm trong Tất cả.
        </p>
        <div className="table-wrap">
          <table className="unit-progress-table">
            <thead>
              <tr>
                <th>CƠ QUAN, ĐƠN VỊ</th>
                <th>ĐÃ GIAO VIỆC</th>
                <th>HOÀN THÀNH</th>
                <th>CHƯA HOÀN THÀNH</th>
                <th>TỶ LỆ HOÀN THÀNH</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u: any) => (
                <tr key={u.id}>
                  <td>
                    <button
                      className="unit-progress-name"
                      onClick={() => onUnit(u.id, "")}
                    >
                      {u.name}
                    </button>
                    <small className="muted block">
                      {u.group}
                      {!u.active ? " · Ngừng sử dụng" : ""}
                    </small>
                  </td>
                  {["givenWork", "done", "unfinished"].map((key) => (
                    <td key={key}>
                      <button
                        className={"unit-progress-count " + key}
                        aria-label={`${key === "givenWork" ? "Đã giao việc" : key === "done" ? "Hoàn thành" : "Chưa hoàn thành"} · ${u.name}: ${u[key]}`}
                        onClick={() => onUnit(u.id, key)}
                      >
                        {u[key]}
                      </button>
                    </td>
                  ))}
                  <td>
                    <div className="progress-rate">
                      <div className="bar-track">
                        <span
                          style={{
                            width:
                              (u.givenWork ? (u.done / u.givenWork) * 100 : 0) +
                              "%",
                          }}
                        />
                      </div>
                      <b>
                        {u.givenWork
                          ? Math.round((u.done / u.givenWork) * 100) + "%"
                          : "—"}
                      </b>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="muted py-4">
              Không có cơ quan, đơn vị phù hợp với bộ lọc.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
