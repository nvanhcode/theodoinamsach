"use client";

import React from "react";
import { Bell } from "lucide-react";
import { useApp } from "@/components/app-context";
import { ReminderPriority } from "@/components/progress/reminder-priority";
import { Btn, None, fmt, fulltime, office, api } from "@/components/common-ui";
import { assignmentNoticeTitle } from "@/lib/report-access";

export function NoticesView() {
  const {
    data,
    user,
    busy,
    cfg,
    w,
    base,
    tasks,
    reminderItems,
    reminderFilter,
    setReminderFilter,
    unitName,
    setSelected,
    setDetailTab,
    run,
    navigate,
  } = useApp();

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="panel p-5">
          <span className="muted text-sm">Lịch báo cáo chung</span>
          <h2 className="mt-2">
            {cfg.hour} · {fmt(w.deadline)}
          </h2>
          <small className="muted">Giờ Việt Nam (UTC+7)</small>
        </div>
        <div className="panel p-5">
          <span className="muted text-sm">Quá hạn nhiệm vụ</span>
          <h2 className="mt-2 text-rose-700">
            {reminderItems.filter((r: any) => r.overdue).length} nhiệm vụ
          </h2>
          <button
            className="text-sm underline mt-1"
            onClick={() => {
              navigate("progress", { status: "overdue" });
            }}
          >
            Xem danh sách
          </button>
        </div>
        <div className="panel p-5">
          <span className="muted text-sm">Chậm báo cáo định kỳ</span>
          <h2 className="mt-2 text-amber-700">
            {reminderItems.filter((r: any) => r.missing || r.sentLate).length}{" "}
            nhiệm vụ
          </h2>
          <button
            className="text-sm underline mt-1"
            onClick={() => {
              navigate("progress", { status: "lateReport" });
            }}
          >
            Xem danh sách
          </button>
        </div>
      </div>
      <ReminderPriority
        items={reminderItems}
        filter={reminderFilter}
        onFilter={setReminderFilter}
        unitName={unitName}
        onTask={(t: any) => {
          setSelected(t);
          setDetailTab("info");
        }}
      />
      <section className="panel">
        <div className="panel-head">
          <h2>Lịch sử thông báo nội bộ</h2>
          {office(user) && (
            <Btn
              primary
              onClick={() =>
                run(
                  () => api("remind", {}),
                  "Đã rà soát và lưu nhắc việc.",
                  false,
                )
              }
              disabled={busy}
            >
              <Bell />
              Rà soát và nhắc việc
            </Btn>
          )}
        </div>
        {data.notices
          .filter((n: any) => base.some((t: any) => t.id === n.taskId))
          .sort((a: any, b: any) => b.updated.localeCompare(a.updated))
          .map((n: any) => (
            <div className="notice" key={n.id}>
              <div className="notice-icon">
                <Bell size={18} />
              </div>
              <div>
                <h3>{assignmentNoticeTitle(n.title)}</h3>
                <p>
                  {fulltime(n.updated)} ·{" "}
                  {n.readBy?.includes(user.id) ? "Đã đọc" : "Chưa đọc"}
                </p>
              </div>
              <div className="notice-actions">
                <Btn
                  small
                  onClick={() => {
                    setSelected(tasks.find((t: any) => t.id === n.taskId));
                    setDetailTab("info");
                  }}
                >
                  Xem nhiệm vụ
                </Btn>
                {!n.readBy?.includes(user.id) && (
                  <Btn
                    small
                    onClick={() =>
                      run(
                        () => api("notice", { id: n.id }),
                        "Đã đánh dấu đã đọc.",
                        false,
                      )
                    }
                  >
                    Đã đọc
                  </Btn>
                )}
              </div>
            </div>
          ))}
        {!data.notices.filter((n: any) =>
          base.some((t: any) => t.id === n.taskId),
        ).length && (
          <None
            title="Chưa có thông báo"
            text="Thông báo giao việc, thay đổi nhiệm vụ và phản hồi báo cáo sẽ hiển thị tại đây."
          />
        )}
      </section>
    </>
  );
}
