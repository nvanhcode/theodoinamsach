"use client";

import React from "react";
import { Download, Plus, Info, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useApp } from "@/components/app-context";
import { TableTasks } from "@/components/table-tasks";
import { Btn, Pick, office, has, api } from "@/components/common-ui";
import { exportAssignmentExcel } from "@/lib/exports";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function TasksView() {
  const [deleteTarget, setDeleteTarget] = React.useState<{
    month: string;
    count: number;
  } | null>(null);
  const [deletePhrase, setDeletePhrase] = React.useState("");
  const [deleteError, setDeleteError] = React.useState("");
  const {
    data,
    user,
    busy,
    month,
    unit,
    group,
    sub,
    setSub,
    monthTasks,
    downloadReadyTemplate,
    downloadTemplate,
    setImportRows,
    setImportFileName,
    setImportPhase,
    setImportSaveProgress,
    open,
    run,
    load,
    sort,
    setSort,
    newTask,
    navigate,
  } = useApp();

  function openDeleteMonthDialog() {
    const count = monthTasks.length;
    if (!count) return;
    setDeleteTarget({ month, count });
    setDeletePhrase("");
    setDeleteError("");
  }

  async function clearMonthTasks() {
    if (!deleteTarget) return;
    const period = `${Number(deleteTarget.month.slice(5))}/${deleteTarget.month.slice(0, 4)}`;
    if (deletePhrase.trim() !== `XÓA THÁNG ${period}`) {
      setDeleteError(`Nhập đúng “XÓA THÁNG ${period}” để tiếp tục.`);
      return;
    }

    const result = await run(
      () =>
        api("task-bulk-delete", {
          month: deleteTarget.month,
          confirmation: "XÓA NHIỆM VỤ THÁNG",
        }),
      `Đã xóa nhiệm vụ tháng ${period} trên toàn hệ thống; các trang đơn vị đã đồng bộ.`,
      false,
    );
    if (result) {
      setDeleteTarget(null);
      setDeletePhrase("");
      setDeleteError("");
    }
  }

  return (
    <Tabs
      value={sub || "tasks"}
      onValueChange={(v) => {
        setSub(v);
        if (v === "documents") navigate("documents");
        else navigate("tasks");
      }}
    >
      <TabsList className="admin-tabs">
        <TabsTrigger value="tasks">
          Nhiệm vụ công việc ({monthTasks.length})
        </TabsTrigger>
        <TabsTrigger value="documents">
          Văn bản kết luận (
          {data.documents.filter((d: any) => d.month === month).length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tasks">
        <div className="hint mb-4">
          <Info />
          Bảng Excel lấy dữ liệu mới nhất theo tháng, khối và đơn vị đã chọn;
          gồm toàn bộ nhiệm vụ trong phạm vi này, kèm bảng tổng hợp theo đơn vị.
        </div>
        <section className="panel">
          <div className="panel-head">
            <h2>
              Danh sách nhiệm vụ thực hiện · {Number(month.slice(5))}/
              {month.slice(0, 4)}
            </h2>
            <div className="actions">
              <a
                className="btn small"
                href="/api/task-template-ready"
                download="Mau-nhap-nhiem-vu-Nam-Sach.xlsx"
                onClick={(e) => {
                  e.preventDefault();
                  downloadReadyTemplate();
                }}
              >
                <Download />
                Tải mẫu nhập Excel
              </a>
              {office(user) && (
                <>
                  <Btn small disabled={busy} onClick={downloadTemplate}>
                    <Download />
                    Tải mẫu theo danh mục hiện tại
                  </Btn>
                  <Btn
                    small
                    onClick={() => {
                      setImportRows([]);
                      setImportFileName("");
                      setImportPhase("");
                      setImportSaveProgress({ finished: 0, total: 0 });
                      open("taskImport");
                    }}
                  >
                    <Plus />
                    Nhập nhiệm vụ từ Excel
                  </Btn>
                </>
              )}
              <Btn
                small
                primary
                disabled={busy}
                onClick={() =>
                  run(
                    async () => {
                      const fresh = await load();
                      await api("export-log", {
                        format: "xlsx",
                        month,
                      });
                      await exportAssignmentExcel(fresh, month, {
                        unit,
                        group,
                      });
                    },
                    "Đã tải bảng giao nhiệm vụ từ dữ liệu mới nhất.",
                    false,
                  )
                }
              >
                <Download />
                Xuất bảng giao nhiệm vụ Excel
              </Btn>
              <Btn small onClick={() => open("export")}>
                <Download />
                Xuất báo cáo
              </Btn>
              {has(user, "admin") && (
                <Btn
                  small
                  danger
                  disabled={busy || monthTasks.length === 0}
                  title={`Xóa tất cả nhiệm vụ của tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`}
                  onClick={openDeleteMonthDialog}
                >
                  <Trash2 />
                  Xóa tất cả nhiệm vụ tháng này ({monthTasks.length})
                </Btn>
              )}
              <Pick
                label="Sắp xếp"
                value={sort}
                onChange={setSort}
                options={[
                  ["due", "Theo thời hạn"],
                  ["title", "Theo nội dung"],
                  ["progress", "Theo tiến độ"],
                ]}
              />
            </div>
          </div>
          {office(user) && (
            <div className="manual-task-entry">
              <Btn onClick={() => newTask()}>
                <Plus />
                Thêm nhiệm vụ thủ công (bổ sung)
              </Btn>
            </div>
          )}
          <TableTasks />
        </section>
      </TabsContent>
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setDeleteTarget(null);
            setDeletePhrase("");
            setDeleteError("");
          }
        }}
      >
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-red-700">
              Xóa nhiệm vụ của tháng đã chọn
            </DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  Sẽ xóa {deleteTarget.count} nhiệm vụ tháng{" "}
                  {Number(deleteTarget.month.slice(5))}/
                  {deleteTarget.month.slice(0, 4)}, cùng báo cáo, thông tin phối
                  hợp, nhắc việc và tệp đính kèm liên quan. Các tháng khác được
                  giữ nguyên. Thao tác này không thể hoàn tác.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <label className="form-field wide">
            <span>
              Để xác nhận, nhập:{" "}
              <b>
                {deleteTarget &&
                  `XÓA THÁNG ${Number(deleteTarget.month.slice(5))}/${deleteTarget.month.slice(0, 4)}`}
              </b>
            </span>
            <input
              value={deletePhrase}
              onChange={(event) => {
                setDeletePhrase(event.target.value);
                setDeleteError("");
              }}
              autoComplete="off"
              autoFocus
              placeholder="Nhập cụm xác nhận"
              disabled={busy}
            />
            {deleteError && (
              <span className="text-sm text-red-600">{deleteError}</span>
            )}
          </label>
          <div className="form-footer">
            <Btn disabled={busy} onClick={() => setDeleteTarget(null)}>
              Hủy
            </Btn>
            <Btn
              danger
              disabled={busy || !deletePhrase.trim()}
              onClick={() => void clearMonthTasks()}
            >
              <Trash2 />
              Xác nhận xóa {deleteTarget?.count ?? 0} nhiệm vụ
            </Btn>
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
