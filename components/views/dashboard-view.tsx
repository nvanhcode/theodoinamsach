"use client";

import React from "react";
import {
  ClipboardList,
  FileEdit,
  Clock,
  UserCheck,
  PlayCircle,
  FileCheck2,
  RotateCcw,
  CheckCircle2,
  PauseCircle,
  XCircle,
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
    statusCounts,
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

  const kpis: [number, string, React.ComponentType<any>, string, string, string][] = [
    [
      total,
      "Tổng nhiệm vụ",
      ClipboardList,
      "#3b82f6",
      "",
      "Toàn bộ nhiệm vụ trong kỳ",
    ],
    [
      statusCounts?.draft ?? 0,
      "Dự thảo",
      FileEdit,
      "#64748b",
      "draft",
      "Đang soạn thảo, chưa trình",
    ],
    [
      statusCounts?.pending ?? 0,
      "Chờ duyệt giao việc",
      Clock,
      "#0284c7",
      "pending",
      "Đã trình, chờ duyệt giao việc",
    ],
    [
      statusCounts?.assigned ?? 0,
      "Đã giao",
      UserCheck,
      "#0d9488",
      "assigned",
      "Đã giao việc cho đơn vị",
    ],
    [
      statusCounts?.working ?? 0,
      "Đang thực hiện",
      PlayCircle,
      "#d97706",
      "working",
      "Đơn vị đang triển khai thực hiện",
    ],
    [
      statusCounts?.review ?? 0,
      "Chờ xác nhận kết quả",
      FileCheck2,
      "#7c3aed",
      "review",
      "Đã gửi báo cáo, chờ xác nhận",
    ],
    [
      statusCounts?.returned ?? 0,
      "Cần bổ sung",
      RotateCcw,
      "#ea580c",
      "returned",
      "Báo cáo chưa đạt, cần bổ sung",
    ],
    [
      statusCounts?.done ?? 0,
      "Hoàn thành đã xác nhận",
      CheckCircle2,
      "#16a34a",
      "done",
      "Đã được xác nhận hoàn thành",
    ],
    [
      statusCounts?.paused ?? 0,
      "Tạm dừng",
      PauseCircle,
      "#94a3b8",
      "paused",
      "Tạm dừng thực hiện theo chỉ đạo",
    ],
    [
      statusCounts?.cancelled ?? 0,
      "Kết thúc / Hủy",
      XCircle,
      "#dc2626",
      "cancelled",
      "Đã hủy hoặc kết thúc nhiệm vụ",
    ],
  ];

  return (
    <>
      {(overdue > 0 || late > 0) && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {overdue > 0 && (
            <button
              onClick={() => navigate("progress", { status: "overdue" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-colors shadow-sm"
              title="Xem danh sách nhiệm vụ quá hạn"
            >
              <TriangleAlert size={14} className="text-rose-600 shrink-0" />
              <span>
                <strong>{overdue}</strong> nhiệm vụ quá hạn
              </span>
              <ChevronRight size={13} className="opacity-60" />
            </button>
          )}
          {late > 0 && (
            <button
              onClick={() => navigate("progress", { status: "lateReport" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold hover:bg-purple-100 transition-colors shadow-sm"
              title="Xem danh sách nhiệm vụ chậm báo cáo"
            >
              <FileText size={14} className="text-purple-600 shrink-0" />
              <span>
                <strong>{late}</strong> nhiệm vụ chậm báo cáo
              </span>
              <ChevronRight size={13} className="opacity-60" />
            </button>
          )}
        </div>
      )}

      <div className="kpi-grid">
        {kpis.map(([n, title, Icon, color, filter, note]) => (
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
