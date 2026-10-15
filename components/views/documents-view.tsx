"use client";

import React from "react";
import { Plus, Pencil, Eye, Paperclip } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useApp } from "@/components/app-context";
import { Btn, None, office } from "@/components/common-ui";

export function DocumentsView() {
  const {
    data,
    user,
    month,
    tasks,
    monthTasks,
    sub,
    setSub,
    open,
    newTask,
    navigate,
  } = useApp();

  const documents = data.documents.filter((d: any) => d.month === month);

  return (
    <Tabs
      value={sub || "documents"}
      onValueChange={(v) => {
        setSub(v);
        if (v === "tasks") navigate("tasks");
        else navigate("documents");
      }}
    >
      <TabsList className="admin-tabs">
        <TabsTrigger value="tasks">
          Nhiệm vụ công việc ({monthTasks.length})
        </TabsTrigger>
        <TabsTrigger value="documents">
          Văn bản kết luận ({documents.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="documents">
        <section className="panel">
          <div className="panel-head">
            <h2>Văn bản nguồn giao việc</h2>
            {office(user) && (
              <Btn
                primary
                small
                onClick={() =>
                  open("document", {
                    month,
                    type: "Thông báo kết luận",
                    issuer: "Ban Thường vụ Đảng ủy",
                    issued: "",
                    number: "",
                    title: "",
                  })
                }
              >
                <Plus />
                Thêm văn bản
              </Btn>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SỐ, KÝ HIỆU</TableHead>
                <TableHead>TỆP ĐÍNH KÈM</TableHead>
                <TableHead>NHIỆM VỤ</TableHead>
                <TableHead>THAO TÁC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="task-title">{d.number}</TableCell>
                  <TableCell>
                    {data.files.filter((f: any) => f.parent_id === d.id).length}{" "}
                    tệp
                  </TableCell>
                  <TableCell>
                    {tasks.filter((t: any) => t.documentId === d.id).length}
                  </TableCell>
                  <TableCell>
                    <div className="actions">
                      <Btn
                        small
                        onClick={() =>
                          open("document", {
                            ...d,
                            view: !office(user),
                          })
                        }
                      >
                        {office(user) ? <Pencil /> : <Eye />}
                        {office(user) ? "Sửa" : "Xem"}
                      </Btn>
                      {office(user) && (
                        <Btn small onClick={() => newTask(d.id)}>
                          <Plus />
                          Tạo nhiệm vụ
                        </Btn>
                      )}
                      <Btn small onClick={() => open("documentFiles", d)}>
                        <Paperclip />
                      </Btn>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!documents.length && (
            <None
              title="Chưa có văn bản trong kỳ"
              text="Nhập văn bản kết luận để liên kết với các nhiệm vụ được giao."
            />
          )}
        </section>
      </TabsContent>
    </Tabs>
  );
}
