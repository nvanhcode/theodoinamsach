"use client";

import React from "react";
import { Eye, Download, LockKeyhole, History } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-context";
import { TableTasks } from "@/components/table-tasks";
import { Btn, Pick, office, approver, has, api } from "@/components/common-ui";
import { uniqueYear } from "@/lib/domain";

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
    period,
    setSnapshots,
    filtered,
    tasks,
  } = useApp();

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
            ...data.documents.map((d: any) => [d.id, d.number]),
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
              } catch (e: any) {
                toast.error(e.message);
              }
            }}
          >
            <History />
            Hồ sơ đã chốt
          </Btn>
        )}
      </div>
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
            {uniqueYear(filtered.filter((t: any) => t.status === "done"))}
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
              (t: any) => t.month === month.slice(0, 4) + "-" + m,
            ).length;
            const max = Math.max(
              1,
              ...Array.from(
                { length: 12 },
                (_, j) =>
                  tasks.filter(
                    (t: any) =>
                      t.month ===
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
