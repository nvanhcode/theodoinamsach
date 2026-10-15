"use client";

import React from "react";
import { Eye, Download, LockKeyhole, History, FileText } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-context";
import { TableTasks } from "@/components/table-tasks";
import {
  Btn,
  Pick,
  office,
  approver,
  has,
  api,
  fulltime,
} from "@/components/common-ui";
import { uniqueYear } from "@/lib/domain";
import {
  isPercentageProgressTask,
  normalizePercentageReport,
} from "@/lib/progress-mode";

type ReportRecord = {
  id: string;
  state: string;
  taskId: string;
  unit: string;
  submitted?: string;
  deadline?: string;
  progress: number;
  quantity?: number | null;
  result?: string;
  difficulty?: string;
  proposal?: string;
  reason?: string;
  version: number;
  authorName?: string;
  author?: string;
  [key: string]: unknown;
};

type PendingReport = ReportRecord & {
  task?: { title?: string };
  sentEarly: boolean;
  submittedAt: number;
};

type ReportTask = {
  id: string;
  month: string;
  status: string;
};

export function ReportsView() {
  const {
    data,
    user,
    month,
    setMonth,
    range,
    setRange,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    documentFilter,
    setDocumentFilter,
    open,
    setSelected,
    setDetailTab,
    period,
    setSnapshots,
    filtered,
    tasks,
    unitName,
  } = useApp();

  const pendingReports: PendingReport[] = data.reports
    .filter((report: ReportRecord) => {
      if (report.state !== "submitted") return false;
      return (
        approver(user) ||
        (has(user, "head") && user.units?.includes(report.unit))
      );
    })
    .map((report: ReportRecord): PendingReport => {
      const task = data.tasks.find(
        (item: { id: string; title?: string }) => item.id === report.taskId,
      );
      const normalized = normalizePercentageReport(task, report);
      const submittedAt = Date.parse(report.submitted || "");
      const deadlineAt = Date.parse(report.deadline || "");
      const sentEarly =
        Number.isFinite(submittedAt) &&
        Number.isFinite(deadlineAt) &&
        submittedAt < deadlineAt;
      return { ...report, ...normalized, task, sentEarly, submittedAt };
    })
    .sort((a: PendingReport, b: PendingReport) => {
      if (a.sentEarly !== b.sentEarly) return a.sentEarly ? -1 : 1;
      return (a.submittedAt || Infinity) - (b.submittedAt || Infinity);
    });

  return (
    <>
      <div className="actions mb-5">
        <Pick
          label="Kỳ tổng hợp"
          value={range}
          onChange={setRange}
          options={[
            ["week", "Báo cáo tuần hiện tại"],
            ["month", "Báo cáo tháng"],
            ["quarter", "Báo cáo quý"],
            ["year", "Lũy kế năm"],
            ["custom", "Khoảng ngày giao"],
          ]}
        />
        {range === "custom" && (
          <>
            <input
              aria-label="Từ ngày giao"
              style={{ width: 165 }}
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <input
              aria-label="Đến ngày giao"
              style={{ width: 165 }}
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </>
        )}
        <Pick
          label="Văn bản nguồn"
          value={documentFilter}
          onChange={setDocumentFilter}
          options={[
            ["", "Tất cả văn bản"],
            ...data.documents.map(
              (document: { id: string; number: string }) => [
                document.id,
                document.number,
              ],
            ),
          ]}
        />
        <Btn onClick={() => open("preview")}>
          <Eye />
          Xem trước báo cáo
        </Btn>
        <Btn onClick={() => open("export")}>
          <Download />
          Xuất Excel / Word
        </Btn>
        {approver(user) && (
          <Btn
            onClick={() =>
              open("period", {
                action: period?.closed ? "reopen" : "close",
                month,
                version: period?.version,
              })
            }
          >
            <LockKeyhole />
            {period?.closed ? "Mở điều chỉnh" : "Khóa sổ tháng"}
          </Btn>
        )}
        {(office(user) || has(user, "secretary")) && (
          <Btn
            onClick={async () => {
              try {
                setSnapshots(await api("snapshots"));
                open("snapshots");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Không thể tải hồ sơ.",
                );
              }
            }}
          >
            <History />
            Hồ sơ đã chốt
          </Btn>
        )}
      </div>
      {(approver(user) || has(user, "head")) && (
        <section className="panel mb-5">
          <div className="panel-head">
            <div>
              <h2>Báo cáo chờ phê duyệt</h2>
              <p className="text-xs muted mt-1">
                Báo cáo gửi trước hạn được ưu tiên. Mở từng báo cáo để xem đầy
                đủ nội dung và minh chứng trước khi xử lý.
              </p>
            </div>
            <span className="badge amber">
              {pendingReports.length} chờ duyệt
            </span>
          </div>
          {pendingReports.length === 0 ? (
            <div className="p-6 text-center muted text-sm">
              Hiện không có báo cáo nào cần phê duyệt.
            </div>
          ) : (
            <div className="divide-y">
              {pendingReports.map((report: PendingReport) => (
                <article
                  className="pending-report-row p-4 sm:p-5"
                  key={report.id}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">
                          {unitName(report.unit)}
                        </h3>
                        <span
                          className={
                            "badge " + (report.sentEarly ? "green" : "amber")
                          }
                        >
                          {report.sentEarly ? "Gửi trước hạn" : "Chờ duyệt"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">
                        {report.task?.title || "Nhiệm vụ đã được giao"}
                      </p>
                      <p className="mt-1 text-xs muted">
                        Người gửi: {report.authorName || "—"} · Gửi:{" "}
                        {fulltime(report.submitted || "")}
                        {report.deadline &&
                          ` · Hạn: ${fulltime(report.deadline)}`}
                      </p>
                      {report.result && (
                        <p className="mt-3 text-sm whitespace-pre-wrap">
                          {report.result}
                        </p>
                      )}
                      <p className="mt-2 text-sm">
                        Tiến độ <b>{report.progress}%</b>
                        {report.quantity != null &&
                          !isPercentageProgressTask(report.task) && (
                            <>
                              {" "}
                              · Khối lượng <b>{report.quantity}</b>
                            </>
                          )}
                      </p>
                      {report.difficulty && (
                        <p className="mt-2 text-sm">
                          <b>Vướng mắc:</b> {report.difficulty}
                        </p>
                      )}
                      {report.proposal && (
                        <p className="mt-1 text-sm">
                          <b>Kiến nghị:</b> {report.proposal}
                        </p>
                      )}
                      {data.files
                        .filter(
                          (file: { parent_id: string }) =>
                            file.parent_id === report.id,
                        )
                        .map((file: { id: string; name: string }) => (
                          <a
                            className="mt-2 inline-flex items-center gap-1 text-sm underline"
                            key={file.id}
                            href={"/api/file?id=" + encodeURIComponent(file.id)}
                            download={file.name}
                            title="Tải tài liệu do đơn vị gửi"
                          >
                            <FileText size={14} />
                            Tải về: {file.name}
                          </a>
                        ))}
                    </div>
                    <div className="actions shrink-0">
                      <Btn
                        small
                        primary
                        onClick={() => {
                          const task = data.tasks.find(
                            (item: any) => item.id === report.taskId,
                          );
                          if (!task) return;
                          setSelected(task);
                          setDetailTab("reports");
                        }}
                      >
                        <Eye />
                        Xem đầy đủ để duyệt
                      </Btn>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      <div className="grid gap-4 md:grid-cols-3 mb-5">
        <div className="panel p-5">
          <small className="muted">ĐẦU VIỆC / KỲ GIAO</small>
          <h1 className="mt-1">{filtered.length}</h1>
        </div>
        <div className="panel p-5">
          <small className="muted">NHIỆM VỤ GỐC DUY NHẤT</small>
          <h1 className="mt-1">{uniqueYear(filtered)}</h1>
        </div>
        <div className="panel p-5">
          <small className="muted">HOÀN THÀNH ĐÃ XÁC NHẬN</small>
          <h1 className="mt-1">
            {uniqueYear(
              filtered.filter((task: ReportTask) => task.status === "done"),
            )}
          </h1>
        </div>
      </div>
      <section className="panel mb-5">
        <div className="panel-head">
          <h2>Nhiệm vụ theo tháng · {month.slice(0, 4)}</h2>
          <span className="text-xs muted">Số đầu việc theo kỳ giao</span>
        </div>
        <div className="panel-body annual-grid">
          {Array.from({ length: 12 }, (_, i) => {
            const m = String(i + 1).padStart(2, "0");
            const n = tasks.filter(
              (task: ReportTask) => task.month === month.slice(0, 4) + "-" + m,
            ).length;
            const max = Math.max(
              1,
              ...Array.from(
                { length: 12 },
                (_, j) =>
                  tasks.filter(
                    (task: ReportTask) =>
                      task.month ===
                      month.slice(0, 4) + "-" + String(j + 1).padStart(2, "0"),
                  ).length,
              ),
            );
            return (
              <button
                className="annual-item"
                key={m}
                onClick={() => {
                  setMonth(month.slice(0, 4) + "-" + m);
                  setRange("month");
                }}
              >
                <span>{n}</span>
                <div
                  className="annual-bar"
                  style={{ height: Math.max(3, (n / max) * 65) }}
                />
                T{i + 1}
              </button>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Bảng tổng hợp phục vụ giao ban</h2>
          <span className="text-xs muted">Theo bộ lọc hiện tại</span>
        </div>
        <TableTasks />
      </section>
    </>
  );
}
