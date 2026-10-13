"use client";

import React from "react";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  TriangleAlert,
  FileText,
  ChevronRight,
} from "lucide-react";
import { useApp } from "@/components/app-context";
import { TableTasks } from "@/components/table-tasks";
import { UnitOverview } from "@/components/dashboard/unit-overview";
import { deadlineState, fmt } from "@/components/common-ui";

export function DashboardView() {
  const {
    data,
    month,
    group,
    unit,
    total,
    done,
    working,
    overdue,
    notStarted,
    late,
    other,
    base,
    cfg,
    w,
    navigate,
  } = useApp();

  return (
    <>
      <div className="kpi-grid">
        {[
          [
            total,
            "Tổng nhiệm vụ",
            ClipboardList,
            "#5777a8",
            "",
            "Theo kỳ giao trong tháng",
          ],
          [
            done,
            "Đã hoàn thành",
            CheckCircle2,
            "#3a9972",
            "done",
            "Đã được xác nhận kết quả",
          ],
          [
            working,
            "Đang thực hiện",
            Clock,
            "#e9a11f",
            "activeWork",
            "Đã giao, còn trong hạn",
          ],
          [
            overdue,
            "Quá hạn nhiệm vụ",
            TriangleAlert,
            "#c74b5c",
            "overdue",
            "Theo hạn hoàn thành",
          ],
          [
            notStarted,
            "Chưa triển khai",
            ClipboardList,
            "#788a9d",
            "notStarted",
            "Dự thảo hoặc chờ giao",
          ],
          [
            late,
            "Chậm báo cáo",
            FileText,
            "#9872b2",
            "lateReport",
            "Theo kỳ báo cáo tuần",
          ],
        ].map(([n, title, Icon, color, filter, note]: any) => (
          <button
            key={title}
            className="kpi"
            style={{ "--kpi-color": color } as any}
            onClick={() => {
              navigate("progress", { status: filter });
            }}
          >
            <div className="kpi-top">
              <span>{title}</span>
              <Icon />
            </div>
            <strong>{n}</strong>
            <small>{note}</small>
          </button>
        ))}
      </div>
      <div className="dashboard-charts">
        <section className="panel">
          <div className="panel-head">
            <h2>Tình hình thực hiện nhiệm vụ</h2>
            <span className="muted text-xs">
              Tháng {Number(month.slice(5))}
            </span>
          </div>
          <div className="panel-body donut-row">
            <div
              className="donut"
              style={{
                background: total
                  ? `conic-gradient(#4e9b7c 0 ${(done / total) * 100}%,#d8ac56 ${(done / total) * 100}% ${((done + working) / total) * 100}%,#c74b5c ${((done + working) / total) * 100}% ${((done + working + overdue) / total) * 100}%,#dbe1ea ${((done + working + overdue) / total) * 100}% 100%)`
                  : "#e9edf3",
              }}
            >
              <div className="donut-inner">
                <strong>{total}</strong>
                <span>NHIỆM VỤ</span>
              </div>
            </div>
            <div className="legend">
              {[
                ["Hoàn thành", done, "#4e9b7c", "done"],
                ["Đang thực hiện", working, "#d8ac56", "activeWork"],
                ["Quá hạn", overdue, "#c74b5c", "overdue"],
                ["Chưa triển khai", notStarted, "#dbe1ea", "notStarted"],
                ...(other
                  ? [["Tạm dừng / kết thúc", other, "#8b9aaf", ""]]
                  : []),
              ].map(([title, n, color, filter]: any) => (
                <button
                  key={title}
                  onClick={() => {
                    navigate("progress", { status: filter });
                  }}
                >
                  <i style={{ background: color }} />
                  {title}
                  <b>{n}</b>
                </button>
              ))}
              <div className="border-t pt-3 text-xs text-slate-400">
                Chỉ tính hoàn thành đã xác nhận
              </div>
            </div>
          </div>
        </section>
        <UnitOverview
          units={data.units}
          tasks={base}
          scope={{ group, unit }}
          organization={cfg.organization}
        />
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Nhiệm vụ cần theo dõi</h2>
          <button
            className="text-sm text-rose-800 flex items-center gap-1"
            onClick={() => navigate("progress")}
          >
            Xem tất cả
            <ChevronRight size={16} />
          </button>
        </div>
        <TableTasks
          rows={[...base]
            .sort(
              (a, b) =>
                (deadlineState(b) === "overdue" ? 1 : 0) -
                  (deadlineState(a) === "overdue" ? 1 : 0) ||
                a.due.localeCompare(b.due),
            )
            .slice(0, 5)}
          full
        />
      </section>
      <div className="hint mt-5">
        <Clock />
        Lịch báo cáo chung: trước {cfg.hour}{" "}
        {Number(cfg.day) === 7 ? "Chủ nhật" : "thứ " + (Number(cfg.day) + 1)} ·{" "}
        {fmt(w.deadline)}. Nhiệm vụ có lịch riêng được xét theo lịch đã chọn.
        Chậm báo cáo được theo dõi độc lập với quá hạn nhiệm vụ.
      </div>
    </>
  );
}
