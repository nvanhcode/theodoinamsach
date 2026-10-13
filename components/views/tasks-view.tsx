"use client";

import React from "react";
import { Download, Plus, Info } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useApp } from "@/components/app-context";
import { TableTasks } from "@/components/table-tasks";
import { Btn, Pick, office, api } from "@/components/common-ui";
import { exportAssignmentExcel } from "@/lib/exports";

export function TasksView() {
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
    </Tabs>
  );
}
