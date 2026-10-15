"use client";

import React from "react";
import { Bell } from "lucide-react";
import { useApp } from "@/components/app-context";
import { ReminderPriority } from "@/components/progress/reminder-priority";
import {
  Btn,
  None,
  fmt,
  fulltime,
  office,
  approver,
  has,
  api,
} from "@/components/common-ui";
import { assignmentNoticeTitle } from "@/lib/report-access";
import { pendingReportApprovals } from "@/lib/notice-queue";
import { noticePriority } from "@/lib/notice-priority";

export function NoticesView() {
  const [directiveText, setDirectiveText] = React.useState("");
  const [directiveUnits, setDirectiveUnits] = React.useState<string[] | null>(
    null,
  );
  const {
    data,
    user,
    month,
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
    markNoticeRead,
    navigate,
  } = useApp();

  const pendingApprovals = pendingReportApprovals(
    data.reports,
    tasks,
    user,
    month,
  );
  const unitOptions = data.units || [];
  const selectedDirectiveUnits =
    directiveUnits ?? unitOptions.map((unit: any) => unit.id);
  const notices = data.notices
    .filter(
      (n: any) =>
        n.category === "admin-directive" ||
        base.some((t: any) => t.id === n.taskId),
    )
    .sort((a: any, b: any) => {
      const priority =
        noticePriority(a.title).rank - noticePriority(b.title).rank;
      return priority || b.updated.localeCompare(a.updated);
    });

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
              navigate("dashboard", { status: "overdue" });
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
              navigate("dashboard", { status: "lateReport" });
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
      {(approver(user) || has(user, "head")) && (
        <section className="panel mt-5">
          <div className="panel-head">
            <h2>Báo cáo đơn vị cần phê duyệt</h2>
            <span className="badge amber">
              {pendingApprovals.length} báo cáo chờ duyệt
            </span>
          </div>
          <div className="panel-body">
            {pendingApprovals.map((report: any) => (
              <article className="notice" key={report.id}>
                <div className="notice-icon">
                  <Bell size={18} />
                </div>
                <div className="min-w-0">
                  <h3>{report.task.title}</h3>
                  <p>
                    {unitName(report.unit)} · {report.authorName} · Gửi lúc{" "}
                    {fulltime(report.submitted)}
                  </p>
                  <p className="text-amber-800 font-medium">
                    Nội dung báo cáo đang chờ phê duyệt
                  </p>
                </div>
                <div className="notice-actions">
                  <Btn
                    small
                    primary
                    onClick={() => {
                      setSelected(report.task);
                      setDetailTab("reports");
                    }}
                  >
                    Mở báo cáo để duyệt
                  </Btn>
                </div>
              </article>
            ))}
            {!pendingApprovals.length && (
              <p className="muted py-3">
                Không có báo cáo đơn vị nào đang chờ phê duyệt trong tháng này.
              </p>
            )}
          </div>
        </section>
      )}
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
              <Bell /> Rà soát hạn
            </Btn>
          )}
        </div>
        {office(user) && (
          <form
            className="panel-body border-b"
            onSubmit={(event) => {
              event.preventDefault();
              run(
                () =>
                  api("directive", {
                    message: directiveText,
                    audienceUnits: selectedDirectiveUnits,
                  }),
                "Đã gửi chỉ đạo đến các đơn vị được chọn.",
              ).then((result: any) => {
                if (result) setDirectiveText("");
              });
            }}
          >
            <h3 className="font-semibold">Chỉ đạo nhắc việc</h3>
            <p className="muted text-sm mt-1">
              Nội dung sẽ hiển thị trong mục Thông báo – Nhắc việc của các đơn
              vị được chọn.
            </p>
            <textarea
              className="w-full mt-3 min-h-24"
              maxLength={4000}
              required
              value={directiveText}
              onChange={(event) => setDirectiveText(event.target.value)}
              placeholder="Nhập nội dung chỉ đạo, yêu cầu hoặc thời hạn cần lưu ý…"
              aria-label="Nội dung chỉ đạo nhắc việc"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
              <strong className="text-sm">Đơn vị nhận</strong>
              <div className="flex gap-2">
                <Btn
                  small
                  onClick={() =>
                    setDirectiveUnits(unitOptions.map((unit: any) => unit.id))
                  }
                >
                  Chọn tất cả
                </Btn>
                <Btn small onClick={() => setDirectiveUnits([])}>
                  Bỏ chọn
                </Btn>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mt-2">
              {unitOptions.map((unit: any) => (
                <label
                  key={unit.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedDirectiveUnits.includes(unit.id)}
                    onChange={(event) =>
                      setDirectiveUnits((current) => {
                        const selected =
                          current ?? unitOptions.map((item: any) => item.id);
                        return event.target.checked
                          ? [...new Set([...selected, unit.id])]
                          : selected.filter((id) => id !== unit.id);
                      })
                    }
                  />
                  {unit.name}
                </label>
              ))}
            </div>
            <div className="mt-4">
              <Btn
                primary
                type="submit"
                disabled={
                  busy ||
                  !selectedDirectiveUnits.length ||
                  !directiveText.trim()
                }
              >
                <Bell /> Gửi chỉ đạo nhắc việc
              </Btn>
            </div>
          </form>
        )}
        {notices.map((n: any) => (
          <div className="notice" key={n.id}>
            <div className="notice-icon">
              <Bell size={18} />
            </div>
            <div>
              <span
                className={
                  "notice-priority-tag notice-priority-" +
                  noticePriority(n.title).tone
                }
              >
                {noticePriority(n.title).label}
              </span>
              <h3
                className={
                  "notice-priority-text notice-priority-text-" +
                  noticePriority(n.title).tone
                }
              >
                {assignmentNoticeTitle(n.title)}
              </h3>
              {n.category === "admin-directive" && (
                <>
                  <p className="whitespace-pre-wrap">{n.message}</p>
                  <p className="muted text-sm">
                    Gửi đến: {(n.audienceUnits || []).map(unitName).join(", ")}
                  </p>
                </>
              )}
              <p>
                {fulltime(n.updated)} ·{" "}
                {n.readBy?.includes(user.id) ? "Đã đọc" : "Chưa đọc"}
              </p>
            </div>
            <div className="notice-actions">
              <Btn
                small
                onClick={() => {
                  if (n.category === "admin-directive") {
                    if (!n.readBy?.includes(user.id))
                      run(
                        () => markNoticeRead(n.id),
                        "Đã đánh dấu đã đọc.",
                        false,
                        false,
                      );
                    return;
                  }
                  setSelected(tasks.find((t: any) => t.id === n.taskId));
                  setDetailTab(
                    n.title.startsWith("Báo cáo đơn vị cần phê duyệt")
                      ? "reports"
                      : n.title.startsWith("Thông tin phối hợp mới")
                        ? "comments"
                        : "info",
                  );
                }}
              >
                {n.category === "admin-directive"
                  ? "Đọc chỉ đạo"
                  : n.title.startsWith("Báo cáo đơn vị cần phê duyệt")
                    ? "Mở báo cáo"
                    : n.title.startsWith("Thông tin phối hợp mới")
                      ? "Mở thông tin phối hợp"
                      : "Xem nhiệm vụ"}
              </Btn>
              {!n.readBy?.includes(user.id) && (
                <Btn
                  small
                  onClick={() =>
                    run(
                      () => markNoticeRead(n.id),
                      "Đã đánh dấu đã đọc.",
                      false,
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
        {!notices.length && (
          <None
            title="Chưa có thông báo"
            text="Thông báo giao việc, thay đổi nhiệm vụ và phản hồi báo cáo sẽ hiển thị tại đây."
          />
        )}
      </section>
    </>
  );
}
