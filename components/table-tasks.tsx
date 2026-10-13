"use client";

import React from "react";
import { Eye, Pencil, History, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/components/app-context";
import {
  Badge,
  None,
  fmt,
  deadlineLabels,
  deadlineState,
  office,
} from "@/components/common-ui";

export function TableTasks({ rows, full = false }: any) {
  const {
    paginated,
    pageNumber,
    setPageNumber,
    pageSize,
    filtered,
    sort,
    setSort,
    setSelected,
    setDetailTab,
    open,
    user,
    page,
    unitName,
  } = useApp();

  const taskRows = rows || paginated;

  const taskActions = (t: any) => (
    <div className="actions">
      <button
        className="icon-button"
        aria-label="Xem nhiệm vụ"
        onClick={() => {
          setSelected(t);
          setDetailTab("info");
        }}
      >
        <Eye />
      </button>
      {page !== "dashboard" &&
        office(user) &&
        !["done", "cancelled"].includes(t.status) && (
          <button
            className="icon-button"
            aria-label="Sửa nhiệm vụ"
            onClick={() => open("task", { ...t })}
          >
            <Pencil />
            <span>Sửa</span>
          </button>
        )}
      <button
        className="icon-button"
        aria-label="Lịch sử nhiệm vụ"
        onClick={() => {
          setSelected(t);
          setDetailTab("history");
        }}
      >
        <History />
      </button>
    </div>
  );

  return (
    <>
      <div className="table-wrap">
        <Table className="tasks-table">
          <TableHeader>
            <TableRow>
              <TableHead>TT</TableHead>
              <TableHead>NỘI DUNG NHIỆM VỤ</TableHead>
              <TableHead>ĐƠN VỊ CHỦ TRÌ</TableHead>
              <TableHead>
                <button
                  onClick={() => setSort(sort === "due" ? "title" : "due")}
                >
                  HẠN HOÀN THÀNH ↕
                </button>
              </TableHead>
              <TableHead>TIẾN ĐỘ</TableHead>
              <TableHead>TRẠNG THÁI</TableHead>
              <TableHead>THAO TÁC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taskRows.map((t: any, i: number) => (
              <TableRow key={t.id}>
                <TableCell>
                  {(full ? 0 : (pageNumber - 1) * pageSize) + i + 1}
                </TableCell>
                <TableCell className="task-content-cell">
                  <button
                    className="task-title text-left"
                    onClick={() => {
                      setSelected(t);
                      setDetailTab("info");
                    }}
                  >
                    <small>
                      NV-{t.month.replace("-", "")}-
                      {t.id.slice(0, 5).toUpperCase()}
                      {t.type === "carry" ? " · CHUYỂN TIẾP" : ""}
                    </small>
                    {t.title}
                    <span className="block text-xs muted mt-1 font-normal">
                      Giao ngày {fmt(t.assignedDate)}
                      {t.sourceNumber ? ` · VB số ${t.sourceNumber}` : ""}
                    </span>
                  </button>
                </TableCell>
                <TableCell className="unit-cell">
                  {unitName(t.unit)}
                  {t.partners?.length > 0 && (
                    <small className="muted block">
                      Phối hợp: {t.partners.map(unitName).join(", ")}
                    </small>
                  )}
                </TableCell>
                <TableCell>
                  <div
                    style={{
                      fontSize: 13,
                      color: deadlineState(t) === "overdue" ? "#c2394e" : "",
                    }}
                  >
                    {fmt(t.due)}
                  </div>
                  <small className="muted" style={{ fontSize: 11 }}>
                    {deadlineLabels[deadlineState(t)]}
                  </small>
                </TableCell>
                <TableCell className="progress-cell">
                  <div className="progress-text">
                    <span>Hoàn thành</span>
                    <b>{t.progress || 0}%</b>
                  </div>
                  <Progress
                    value={t.progress || 0}
                    className="h-1.5 bg-slate-100"
                  />
                </TableCell>
                <TableCell>
                  <Badge status={t.status} />
                </TableCell>
                <TableCell>{taskActions(t)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!taskRows.length && <None />}
      {!full && (
        <div className="pagination-line">
          <span>
            {filtered.length
              ? `${(pageNumber - 1) * pageSize + 1}–${Math.min(pageNumber * pageSize, filtered.length)} / ${filtered.length} nhiệm vụ`
              : "0 nhiệm vụ trong kỳ"}
          </span>
          <div className="actions">
            <button
              className="icon-button"
              aria-label="Trang trước"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((p: number) => p - 1)}
            >
              <ChevronLeft />
            </button>
            <span>Trang {pageNumber}</span>
            <button
              className="icon-button"
              aria-label="Trang sau"
              disabled={pageNumber * pageSize >= filtered.length}
              onClick={() => setPageNumber((p: number) => p + 1)}
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
