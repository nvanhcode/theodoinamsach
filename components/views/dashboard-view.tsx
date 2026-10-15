"use client";

import React from "react";
import {
  ClipboardList,
  CheckCircle2,
  PlayCircle,
  Clock3,
  FileText,
  TriangleAlert,
  ChevronRight,
} from "lucide-react";
import { useApp } from "@/components/app-context";
import { ProgressView } from "@/components/views/progress-view";
import { fmt } from "@/components/common-ui";

export function DashboardView() {
  const { total, done, working, overdue, notStarted, late, cfg, w, navigate } =
    useApp();

  const kpis = [
    {
      count: total,
      title: "Tổng nhiệm vụ",
      Icon: ClipboardList,
      filter: "",
      note: "Tất cả nhiệm vụ trong kỳ",
      color: "#2f6fb2",
    },
    {
      count: done,
      title: "Hoàn thành",
      Icon: CheckCircle2,
      filter: "done",
      note: "Đã được xác nhận hoàn thành",
      color: "#21845c",
    },
    {
      count: working,
      title: "Đang thực hiện",
      Icon: PlayCircle,
      filter: "activeWork",
      note: "Bao gồm đã giao, đang làm và chờ xác nhận",
      color: "#a45f00",
    },
    {
      count: notStarted,
      title: "Chưa bắt đầu",
      Icon: Clock3,
      filter: "notStarted",
      note: "Còn trong hạn, chưa triển khai",
      color: "#64758b",
    },
  ] as const;

  return (
    <>
      {(overdue > 0 || late > 0) && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {overdue > 0 && (
            <button
              onClick={() => navigate("dashboard", { status: "overdue" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-colors shadow-sm"
            >
              <FileText size={14} />
              <span>{overdue} nhiệm vụ quá hạn</span>
              <ChevronRight size={13} />
            </button>
          )}
          {late > 0 && (
            <button
              onClick={() => navigate("dashboard", { status: "lateReport" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold hover:bg-purple-100 transition-colors shadow-sm"
            >
              <TriangleAlert size={14} />
              <span>{late} nhiệm vụ chậm báo cáo</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      )}

      <section aria-label="Tóm tắt nhiệm vụ" className="kpi-grid">
        {kpis.map(({ count, title, Icon, filter, note, color }) => (
          <button
            key={title}
            className="kpi"
            style={{ "--kpi-color": color } as React.CSSProperties}
            onClick={() => navigate("dashboard", { status: filter })}
          >
            <div className="kpi-top">
              <span>{title}</span>
              <Icon />
            </div>
            <strong>{count}</strong>
            <small>{note}</small>
          </button>
        ))}
      </section>

      <div className="mt-5">
        <ProgressView />
      </div>

      <p className="muted text-xs mt-4">
        Báo cáo chung trước {cfg.hour} ngày{" "}
        {Number(cfg.day) === 7 ? "Chủ nhật" : "thứ " + (Number(cfg.day) + 1)} ·{" "}
        {fmt(w.deadline)}. Hạn báo cáo và hạn hoàn thành được theo dõi riêng.
      </p>
    </>
  );
}
