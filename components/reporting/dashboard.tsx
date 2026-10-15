import React from "react";
import { deadlineState, stateNames } from "@/lib/domain";

export function matchesSummary(
  t: any,
  key: string,
  reportingStatus: (t: any) => string,
) {
  if (key === "done") return t.status === "done";
  if (key === "review") return t.status === "review";
  if (key === "active")
    return ["assigned", "working", "review", "returned"].includes(t.status);
  if (key === "overdue" || key === "soon") return deadlineState(t) === key;
  if (key === "missing" || key === "returned")
    return reportingStatus(t) === key;
  if (key === "actionRequired")
    return (
      ["soon", "overdue"].includes(deadlineState(t)) ||
      ["missing", "returned"].includes(reportingStatus(t))
    );
  return true;
}

export function ReportingDashboard({
  tasks,
  partnerTasks = [],
  reportingStatus,
  onFilter,
  onTask,
}: any) {
  const metrics = [
    ["all", "Tổng nhiệm vụ", "#355f96"],
    ["lead", "Nhiệm vụ chủ trì", "#28724f"],
    ["partner", "Nhiệm vụ phối hợp", "#386b9b"],
    ["actionRequired", "Cần xử lý báo cáo", "#bb3048"],
    ["review", "Báo cáo chờ duyệt", "#a77718"],
  ];
  const priority = [...tasks]
    .filter((t: any) => matchesSummary(t, "actionRequired", reportingStatus))
    .sort((a: any, b: any) => a.due.localeCompare(b.due))
    .slice(0, 5);

  return (
    <div className="unit-dashboard">
      <p className="muted">
        Việc được giao trong kỳ, theo đúng phạm vi tài khoản của bạn.
      </p>
      <div className="unit-dashboard-metrics">
        {metrics.map(([key, label, color]) => (
          <button
            key={key}
            className="panel unit-dashboard-metric"
            onClick={() => onFilter(key)}
            style={{ borderTopColor: color }}
          >
            <span>{label}</span>
            <strong style={{ color }}>
              {key === "all"
                ? tasks.length + partnerTasks.length
                : key === "lead"
                  ? tasks.length
                  : key === "partner"
                    ? partnerTasks.length
                    : tasks.filter((t: any) =>
                        matchesSummary(t, key, reportingStatus),
                      ).length}
            </strong>
            <small>Xem danh sách →</small>
          </button>
        ))}
      </div>
      <section className="panel unit-task-card">
        <h2>Nhiệm vụ chủ trì cần ưu tiên</h2>
        {priority.map((t: any) => (
          <button
            className="unit-dashboard-task"
            key={t.id}
            onClick={() => onTask(t)}
          >
            <b>{t.title}</b>
            <span>
              Hạn: {t.due.split("-").reverse().join("/")} ·{" "}
              {stateNames[t.status]}
            </span>
            {deadlineState(t) === "overdue" && (
              <span className="unit-dashboard-warning">Quá hạn nhiệm vụ</span>
            )}
            {deadlineState(t) === "soon" && (
              <span className="unit-dashboard-warning">
                Sắp đến hạn nhiệm vụ
              </span>
            )}
            {["missing", "returned"].includes(reportingStatus(t)) && (
              <span className="unit-dashboard-warning">
                {reportingStatus(t) === "missing"
                  ? "Chưa gửi, chậm báo cáo"
                  : "Báo cáo cần bổ sung"}
              </span>
            )}
          </button>
        ))}
        {!priority.length && (
          <p className="muted">
            Không có nhiệm vụ chủ trì cần ưu tiên trong kỳ này.
          </p>
        )}
        <button className="btn" onClick={() => onFilter("actionRequired")}>
          Xem tất cả việc cần xử lý
        </button>
      </section>
    </div>
  );
}
