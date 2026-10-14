"use client";

import React from "react";
import {
  FileText,
  Bell,
  Plus,
  Download,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Eye,
  Pencil,
  Paperclip,
  Save,
  Send,
  Info,
  Trash2,
  Sparkles,
  RotateCcw,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useApp } from "@/components/app-context";
import {
  api,
  Btn,
  Field,
  Pick,
  Check,
  None,
  Badge,
  fmt,
  fulltime,
  deadlineLabels,
  reportLabels,
} from "@/components/common-ui";
import {
  roleNames,
  stateNames,
  groups,
  defaults,
  has,
  office,
  approver,
  canReport,
  deadlineState,
  reportState,
  reportWindow,
  reportScheduleLabel,
  uniqueYear,
  localDate,
} from "@/lib/domain";
import {
  exportReport,
  exportColumns,
  reportRows,
  exportAssignmentExcel,
} from "@/lib/exports";

export function AppModals() {
  const {
    data,
    user,
    setUser,
    busy,
    setBusy,
    error,
    setError,
    month,
    unit,
    group,
    status,
    sort,
    modal,
    setModal,
    form,
    setForm,
    setSelected,
    selectedTask,
    detailTab,
    setDetailTab,
    history,
    comments,
    snapshots,
    columns,
    setColumns,
    range,
    fromDate,
    toDate,
    importRows,
    importFileName,
    importPhase,
    importSaveProgress,
    importAction,
    setImportAction,
    templateDownload,
    cfg,
    tasks,
    filtered,
    done,
    working,
    overdue,
    total,
    pageSize,
    period,
    w,
    run,
    change,
    open,
    unitName,
    downloadReadyTemplate,
    downloadTemplate,
    readTaskFile,
    saveTaskImport,
    upload,
  } = useApp();

  return (
    <>
      <Sheet
        open={!!selectedTask}
        onOpenChange={(v) => !v && setSelected(null)}
      >
        <SheetContent className="detail-sheet">
          <SheetHeader className="detail-top">
            <div className="eyebrow text-rose-800 mb-2">
              CHI TIẾT NHIỆM VỤ · THÁNG{" "}
              {selectedTask
                ? Number(selectedTask.month.slice(5)) +
                "/" +
                selectedTask.month.slice(0, 4)
                : ""}
            </div>
            <SheetTitle className="text-xl leading-relaxed pr-5">
              {selectedTask?.title}
            </SheetTitle>
            <SheetDescription>
              {selectedTask ? unitName(selectedTask.unit) : ""} · Cập nhật{" "}
              {fmt(selectedTask?.updated)}
            </SheetDescription>
            <div className="actions mt-3">
              <Badge status={selectedTask?.status} />
              <span
                className={
                  "badge " +
                  (deadlineState(selectedTask || {}) === "overdue"
                    ? "red"
                    : "gray")
                }
              >
                {deadlineLabels[deadlineState(selectedTask || {})]}
              </span>
            </div>
          </SheetHeader>
          {selectedTask && (
            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList className="detail-tabs">
                <TabsTrigger value="info">Thông tin chung</TabsTrigger>
                <TabsTrigger value="milestones">Mốc tiến độ</TabsTrigger>
                <TabsTrigger value="reports">Tiến độ thực hiện</TabsTrigger>
                <TabsTrigger value="files">Minh chứng</TabsTrigger>
                <TabsTrigger value="comments">Phối hợp · Chỉ đạo</TabsTrigger>
                <TabsTrigger value="history">Lịch sử</TabsTrigger>
              </TabsList>
              <div className="detail-body">
                <TabsContent value="info">
                  <div className="info-grid">
                    {[
                      [
                        "Văn bản nguồn",
                        data.documents.find(
                          (d: any) => d.id === selectedTask.documentId,
                        )?.number || "Nhiệm vụ nhập thủ công",
                      ],
                      ["Đơn vị chủ trì", unitName(selectedTask.unit)],
                      [
                        "Đơn vị phối hợp",
                        selectedTask.partners?.map(unitName).join(", ") || "—",
                      ],
                      [
                        "Người phụ trách",
                        selectedTask.owner || "Chưa xác định",
                      ],
                      [
                        "Lãnh đạo theo dõi",
                        selectedTask.leader || "Chưa xác định",
                      ],
                      ["Lĩnh vực", selectedTask.field || "—"],
                      [
                        "Thời gian giao nhiệm vụ",
                        fmt(selectedTask.assignedDate) +
                        (selectedTask.assignedTime
                          ? " · " + selectedTask.assignedTime
                          : ""),
                      ],
                      ["Thời hạn gốc", fmt(selectedTask.originalDue)],
                      ["Thời hạn hiện hành", fmt(selectedTask.due)],
                      [
                        "Chỉ tiêu định lượng",
                        selectedTask.target
                          ? selectedTask.target + " " + selectedTask.measure
                          : "Không áp dụng",
                      ],
                      ["Sản phẩm đầu ra", selectedTask.output || "—"],
                      ["Các mốc thực hiện", selectedTask.milestones || "—"],
                      ["Ghi chú", selectedTask.note || "—"],
                      ["Lịch báo cáo", reportScheduleLabel(selectedTask, cfg)],
                      [
                        "Tình trạng báo cáo định kỳ",
                        reportLabels[
                        reportState(
                          selectedTask,
                          data.reports,
                          new Date(),
                          cfg,
                        )
                        ],
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <small>{label}</small>
                        <div className="text-sm whitespace-pre-wrap">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6">
                    <div className="progress-text">
                      <span>Kết quả đã xác nhận</span>
                      <b>{selectedTask.progress || 0}%</b>
                    </div>
                    <Progress value={selectedTask.progress || 0} />
                  </div>
                  <div className="actions mt-7">
                    {office(user) &&
                      !["done", "cancelled"].includes(selectedTask.status) && (
                        <Btn onClick={() => open("task", { ...selectedTask })}>
                          <Pencil />
                          Sửa nhiệm vụ
                        </Btn>
                      )}
                    {office(user) &&
                      ["draft", "returned"].includes(selectedTask.status) && (
                        <Btn
                          primary
                          disabled={busy}
                          onClick={() =>
                            run(
                              () =>
                                api("task-action", {
                                  ...selectedTask,
                                  action: "submit",
                                }),
                              "Đã trình duyệt giao việc.",
                              false,
                            )
                          }
                        >
                          <Send />
                          Trình duyệt giao việc
                        </Btn>
                      )}
                    {approver(user) && selectedTask.status === "pending" && (
                      <Btn
                        primary
                        disabled={busy}
                        onClick={() =>
                          run(
                            () =>
                              api("task-action", {
                                ...selectedTask,
                                action: "assign",
                              }),
                            "Đã giao nhiệm vụ đến đơn vị.",
                            false,
                          )
                        }
                      >
                        <CheckCircle2 />
                        Phê duyệt giao việc
                      </Btn>
                    )}
                    {approver(user) && selectedTask.status === "review" && (
                      <Btn
                        primary
                        disabled={busy}
                        onClick={() =>
                          run(
                            () =>
                              api("task-action", {
                                ...selectedTask,
                                action: "complete",
                              }),
                            "Đã xác nhận hoàn thành.",
                            false,
                          )
                        }
                      >
                        <CheckCircle2 />
                        Xác nhận hoàn thành
                      </Btn>
                    )}
                    {approver(user) &&
                      !["draft", "pending", "done", "cancelled"].includes(
                        selectedTask.status,
                      ) && (
                        <>
                          <Btn
                            onClick={() =>
                              open("action", {
                                ...selectedTask,
                                action: "carry",
                                month: "",
                                due: "",
                                reason: "",
                              })
                            }
                          >
                            Chuyển tiếp kỳ sau
                          </Btn>
                          <Btn
                            onClick={() =>
                              open("action", {
                                ...selectedTask,
                                action:
                                  selectedTask.status === "paused"
                                    ? "resume"
                                    : "pause",
                                reason: "",
                              })
                            }
                          >
                            {selectedTask.status === "paused"
                              ? "Tiếp tục thực hiện"
                              : "Tạm dừng"}
                          </Btn>
                          <Btn
                            onClick={() =>
                              open("action", {
                                ...selectedTask,
                                action: "cancel",
                                reason: "",
                              })
                            }
                          >
                            Kết thúc / hủy
                          </Btn>
                        </>
                      )}
                    {office(user) && (
                      <Btn
                        onClick={() =>
                          open("remind", { id: selectedTask.id, message: "" })
                        }
                      >
                        <Bell />
                        Gửi nhắc
                      </Btn>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="milestones">
                  <div className="flex justify-between items-center mb-5">
                    <h2>Đầu việc và mốc thực hiện</h2>
                    {canReport(user, selectedTask) && (
                      <Btn
                        primary
                        small
                        onClick={() =>
                          open("milestone", {
                            taskId: selectedTask.id,
                            due: selectedTask.due,
                            state: "todo",
                          })
                        }
                      >
                        <Plus />
                        Thêm đầu việc
                      </Btn>
                    )}
                  </div>
                  {(data.milestones || [])
                    .filter((m: any) => m.taskId === selectedTask.id)
                    .map((m: any) => (
                      <article className="report-card" key={m.id}>
                        <div className="flex justify-between gap-3">
                          <b>{m.title}</b>
                          <span
                            className={
                              "badge " +
                              (m.state === "done" ? "green" : "amber")
                            }
                          >
                            {
                              {
                                todo: "Chưa thực hiện",
                                working: "Đang thực hiện",
                                done: "Đã thực hiện",
                              }[m.state as string]
                            }
                          </span>
                        </div>
                        <p>{m.result || "Chưa cập nhật kết quả"}</p>
                        <div className="muted text-sm">
                          {m.owner || "Chưa chỉ định"} · Hạn {fmt(m.due)}
                        </div>
                        {canReport(user, selectedTask) && (
                          <Btn
                            small
                            className="mt-3"
                            onClick={() => open("milestone", { ...m })}
                          >
                            <Pencil />
                            Sửa – cập nhật
                          </Btn>
                        )}
                      </article>
                    ))}
                  {!(data.milestones || []).some(
                    (m: any) => m.taskId === selectedTask.id,
                  ) && (
                      <None
                        title="Chưa có đầu việc con"
                        text="Phân rã nhiệm vụ thành các mốc, người phụ trách và kết quả riêng."
                      />
                    )}
                </TabsContent>
                <TabsContent value="reports">
                  <div className="flex justify-between items-center mb-5">
                    <h2>Báo cáo của đơn vị</h2>

                    {canReport(user, selectedTask) &&
                      ["assigned", "working", "review", "returned"].includes(
                        selectedTask.status,
                      ) && (

                        <Btn
                          primary
                          small
                          onClick={() =>
                            open("report", {
                              taskId: selectedTask.id,
                              unit: selectedTask.unit,
                              progress: selectedTask.progress || 0,
                              quantity: 0,
                              result: "",
                              difficulty: "",
                              proposal: "",
                            })
                          }
                        >
                          <Plus />
                          Cập nhật tiến độ
                        </Btn>
                      )}
                  </div>
                  {data.reports
                    .filter((r: any) => r.taskId === selectedTask.id)
                    .sort((a: any, b: any) =>
                      b.updated.localeCompare(a.updated),
                    )
                    .map((r: any) => (
                      <article className="report-card" key={r.id}>
                        <div className="flex justify-between gap-3">
                          <div>
                            <b className="text-sm">{unitName(r.unit)}</b>
                            <div className="text-xs muted mt-1">
                              {r.authorName} ·{" "}
                              {r.frequency === "daily" ? "Ngày" : "Tuần từ"}{" "}
                              {fmt(r.periodKey || r.week)}
                            </div>
                          </div>
                          <span
                            className={
                              "badge " +
                              (r.state === "confirmed"
                                ? "green"
                                : r.state === "returned"
                                  ? "red"
                                  : "amber")
                            }
                          >
                            {
                              {
                                draft: "Bản nháp",
                                submitted: "Chờ xác nhận",
                                confirmed: "Đã xác nhận",
                                returned: "Cần bổ sung",
                              }[r.state as string]
                            }
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{r.result}</p>
                        {data.files
                          .filter((f: any) => f.parent_id === r.id)
                          .map((f: any) => (
                            <a
                              className="block text-sm underline mb-2"
                              key={f.id}
                              href={"/api/file?id=" + f.id}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Minh chứng: {f.name}
                            </a>
                          ))}
                        <div className="text-sm mb-2">
                          Tiến độ <b>{r.progress}%</b> · Khối lượng{" "}
                          <b>{r.quantity || 0}</b>
                        </div>
                        {r.difficulty && (
                          <p>
                            <b>Vướng mắc:</b> {r.difficulty}
                          </p>
                        )}
                        {r.proposal && (
                          <p>
                            <b>Kiến nghị:</b> {r.proposal}
                          </p>
                        )}
                        {r.reason && (
                          <div className="hint amber">
                            Yêu cầu bổ sung: {r.reason}
                          </div>
                        )}
                        <div className="text-xs muted mt-2">
                          Gửi: {fulltime(r.submitted)} · Hạn:{" "}
                          {fulltime(r.deadline)}
                          {r.reviewer && " · Xác nhận: " + r.reviewer}
                        </div>
                        <div className="actions mt-3">
                          {r.author === user.id &&
                            ["draft", "returned"].includes(r.state) && (
                              <Btn
                                small
                                onClick={() => open("report", { ...r })}
                              >
                                <Pencil />
                                Sửa và gửi
                              </Btn>
                            )}
                          {r.state === "submitted" &&
                            (approver(user) ||
                              (has(user, "head") &&
                                user.units.includes(r.unit))) && (
                              <>
                                <Btn
                                  small
                                  primary
                                  disabled={busy}
                                  onClick={() =>
                                    open("confirmReport", {
                                      ...r,
                                      action: "confirm",
                                      originalProgress: r.progress,
                                      progress: r.progress,
                                      quantity: r.quantity ?? 0,
                                      result: r.result || "",
                                      difficulty: r.difficulty || "",
                                      proposal: r.proposal || "",
                                      reviewNote: "",
                                    })
                                  }
                                >
                                  Xác nhận
                                </Btn>
                                <Btn
                                  small
                                  onClick={() =>
                                    open("returnReport", {
                                      id: r.id,
                                      version: r.version,
                                      action: "return",
                                    })
                                  }
                                >
                                  Yêu cầu bổ sung
                                </Btn>
                              </>
                            )}
                          {r.state === "confirmed" &&
                            canReport(user, selectedTask) && (
                              <Btn
                                small
                                onClick={() =>
                                  open("report", {
                                    taskId: selectedTask.id,
                                    previousId: r.id,
                                    progress: r.progress,
                                    result: "",
                                    quantity: r.quantity,
                                  })
                                }
                              >
                                Lập bản bổ sung
                              </Btn>
                            )}
                        </div>
                      </article>
                    ))}
                  {!data.reports.some(
                    (r: any) => r.taskId === selectedTask.id,
                  ) && (
                      <None
                        title="Chưa có báo cáo tiến độ"
                        text="Lưu nháp để tiếp tục nhập, hoặc gửi báo cáo đến người xác nhận."
                      />
                    )}
                </TabsContent>
                <TabsContent value="files">
                  <h2 className="mb-4">Hồ sơ minh chứng</h2>
                  {canReport(user, selectedTask) && (
                    <label className="block border border-dashed rounded-lg p-6 mb-5 text-center cursor-pointer">
                      <Paperclip className="mx-auto mb-2 text-rose-800" />
                      <b className="text-sm">Chọn tệp để tải lên</b>
                      <div className="text-xs muted mt-1">
                        PDF, Word, Excel, ảnh, video · Tối đa 25 MB
                      </div>
                      <input
                        className="mt-3"
                        type="file"
                        disabled={busy}
                        accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.mp4,.webm"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f)
                            run(
                              () => upload(selectedTask.id, f),
                              "Đã lưu minh chứng.",
                              false,
                            );
                        }}
                      />
                    </label>
                  )}
                  {data.files
                    .filter(
                      (f: any) =>
                        f.parent_id === selectedTask.id ||
                        f.taskId === selectedTask.id ||
                        (Array.isArray(selectedTask.evidenceIds) &&
                          selectedTask.evidenceIds.includes(f.id)),
                    )
                    .map((f: any) => {
                      const isFromReport = f.parent_id !== selectedTask.id;
                      const rep = isFromReport
                        ? data.reports.find((r: any) => r.id === f.parent_id)
                        : null;
                      const canPreview =
                        f.mime?.startsWith("image/") ||
                        f.mime === "application/pdf";
                      return (
                        <div
                          className="report-card flex items-center justify-between p-3.5 mb-2.5 rounded-lg border bg-white hover:border-slate-300 transition"
                          key={f.id}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-600">
                              <Paperclip size={18} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <b
                                  className="text-sm truncate max-w-[280px] sm:max-w-[360px]"
                                  title={f.name}
                                >
                                  {f.name}
                                </b>
                                {isFromReport ? (
                                  <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                    Từ báo cáo {rep ? `· ${unitName(rep.unit)}` : ""}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                    Đính kèm trực tiếp
                                  </span>
                                )}
                              </div>
                              <div className="muted text-xs mt-0.5">
                                {(f.size / 1024).toFixed(0)} KB · Tải lên:{" "}
                                {fmt(f.created)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {canPreview && (
                              <a
                                className="btn small text-slate-700 bg-slate-100 hover:bg-slate-200 border-none"
                                href={"/api/file?id=" + f.id + "&preview=1"}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Xem trước tài liệu"
                              >
                                <Eye size={14} />
                                Xem
                              </a>
                            )}
                            <a
                              className="btn small"
                              href={"/api/file?id=" + f.id}
                              download={f.name}
                              title="Tải về máy"
                            >
                              <Download size={14} />
                              Tải về
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  {!data.files.some(
                    (f: any) =>
                      f.parent_id === selectedTask.id ||
                      f.taskId === selectedTask.id ||
                      (Array.isArray(selectedTask.evidenceIds) &&
                        selectedTask.evidenceIds.includes(f.id)),
                  ) && (
                      <None
                        title="Chưa có minh chứng"
                        text="Tệp được lưu theo nhiệm vụ hoặc tự động tích hợp từ báo cáo tiến độ khi được xác nhận."
                      />
                    )}
                </TabsContent>
                <TabsContent value="comments">
                  <h2 className="mb-4">Phối hợp và ý kiến chỉ đạo</h2>
                  {comments.map((c: any) => (
                    <div className="report-card" key={c.id}>
                      <b className="text-sm">{c.author}</b>
                      <small className="muted ml-3">
                        {fulltime(c.updated)}
                      </small>
                      <p>{c.text}</p>
                    </div>
                  ))}
                  <Btn
                    primary
                    onClick={() =>
                      open("comment", {
                        taskId: selectedTask.id,
                        text: "",
                        type: "coordination",
                      })
                    }
                  >
                    <Plus />
                    Thêm ý kiến
                  </Btn>
                </TabsContent>
                <TabsContent value="history">
                  <h2 className="mb-5">Lịch sử thay đổi</h2>
                  <div className="timeline">
                    {history.map((h: any) => {
                      const fieldLabels: Record<string, string> = {
                        title: "Nội dung",
                        unit: "Đơn vị chủ trì",
                        partners: "Đơn vị phối hợp",
                        due: "Thời hạn",
                        progress: "Tiến độ",
                        status: "Trạng thái nhiệm vụ",
                        state: "Trạng thái báo cáo",
                        assignedDate: "Ngày giao",
                        assignedTime: "Giờ giao",
                        reason: "Lý do / Yêu cầu bổ sung",
                        result: "Kết quả thực hiện",
                        difficulty: "Khó khăn, vướng mắc",
                        proposal: "Kiến nghị, đề xuất",
                        quantity: "Khối lượng",
                        output: "Sản phẩm đầu ra",
                        owner: "Người phụ trách",
                        leader: "Lãnh đạo theo dõi",
                        field: "Lĩnh vực",
                        target: "Chỉ tiêu",
                        measure: "Đơn vị tính",
                        note: "Ghi chú",
                        lastReport: "Thời điểm báo cáo gần nhất",
                        reviewer: "Người duyệt",
                        reviewed: "Thời điểm duyệt",
                        product: "Sản phẩm hoàn thành",
                      };
                      const formatVal = (k: string, v: any) => {
                        if (v === null || v === undefined) return "—";
                        if (k === "state") {
                          return (
                            {
                              draft: "Bản nháp",
                              submitted: "Chờ xác nhận",
                              confirmed: "Đã xác nhận",
                              returned: "Cần bổ sung",
                            }[v as string] || v
                          );
                        }
                        if (k === "status") {
                          return stateNames[v as string] || v;
                        }
                        if (k === "progress") {
                          return `${v}%`;
                        }
                        if (k === "unit" || k === "partners") {
                          if (Array.isArray(v)) return v.map(unitName).join(", ");
                          return unitName(v);
                        }
                        if (typeof v === "object") return JSON.stringify(v);
                        return String(v);
                      };
                      const ignoredKeys = [
                        "_operation",
                        "id",
                        "kind",
                        "version",
                        "updated",
                        "author",
                        "taskId",
                        "parent_id",
                      ];

                      return (
                        <article key={h.id}>
                          <p>
                            <b>{h.action}</b>
                          </p>
                          <small>
                            {h.actor} · {fulltime(h.time)}
                          </small>
                          {h.before && h.after && (
                            <details className="mt-2 text-xs">
                              <summary className="cursor-pointer text-rose-800">
                                Xem nội dung thay đổi
                              </summary>
                              <div className="mt-2 p-3 bg-slate-50 rounded overflow-auto">
                                {Object.keys(JSON.parse(h.after))
                                  .filter(
                                    (k) =>
                                      !ignoredKeys.includes(k) &&
                                      JSON.stringify(JSON.parse(h.before)[k]) !==
                                      JSON.stringify(JSON.parse(h.after)[k]),
                                  )
                                  .map((k) => (
                                    <div key={k} className="py-1">
                                      <b>{fieldLabels[k] || k}</b>:{" "}
                                      <span className="text-slate-500">
                                        {formatVal(k, JSON.parse(h.before)[k])}
                                      </span>{" "}
                                      →{" "}
                                      <span className="font-medium text-slate-900">
                                        {formatVal(k, JSON.parse(h.after)[k])}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </details>
                          )}
                          {!h.before && h.after && (
                            <details className="mt-2 text-xs">
                              <summary className="cursor-pointer text-rose-800">
                                Xem chi tiết ban đầu
                              </summary>
                              <div className="mt-2 p-3 bg-slate-50 rounded overflow-auto">
                                {Object.keys(JSON.parse(h.after))
                                  .filter(
                                    (k) =>
                                      !ignoredKeys.includes(k) &&
                                      JSON.parse(h.after)[k] !== "" &&
                                      JSON.parse(h.after)[k] !== null &&
                                      JSON.parse(h.after)[k] !== undefined,
                                  )
                                  .map((k) => (
                                    <div key={k} className="py-1">
                                      <b>{fieldLabels[k] || k}</b>:{" "}
                                      <span className="font-medium text-slate-900">
                                        {formatVal(k, JSON.parse(h.after)[k])}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </details>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={!!modal}
        onOpenChange={(v) => {
          if (!v && !busy) {
            setModal("");
            setError("");
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[820px]">
          <DialogHeader>
            <DialogTitle>
              {
                (
                  {
                    task: form.id
                      ? "Sửa nhiệm vụ"
                      : "Thêm nhiệm vụ thủ công (bổ sung)",
                    document: form.id
                      ? "Văn bản kết luận"
                      : "Thêm văn bản kết luận",
                    unit: form.id
                      ? "Sửa cơ quan, đơn vị"
                      : "Thêm cơ quan, đơn vị",
                    user: form.id
                      ? "Sửa tài khoản / cấp lại mật khẩu"
                      : "Cấp tài khoản mới",
                    settings: "Cấu hình hệ thống",
                    report: form.id
                      ? "Sửa báo cáo tiến độ"
                      : "Cập nhật tiến độ thực hiện",
                    returnReport: "Yêu cầu bổ sung báo cáo",
                    confirmReport: "Xác nhận duyệt báo cáo tiến độ",
                    action: "Điều chỉnh quy trình nhiệm vụ",
                    period:
                      form.action === "reopen"
                        ? "Mở kỳ điều chỉnh"
                        : "Xác nhận khóa sổ tháng",
                    comment: "Thêm ý kiến phối hợp / chỉ đạo",
                    remind: "Gửi nhắc việc nội bộ",
                    password: "Đổi mật khẩu",
                    export: "Xuất báo cáo",
                    taskImport: "Nhập và cập nhật nhiệm vụ từ Excel",
                    preview: "Xem trước báo cáo",
                    snapshots: "Hồ sơ báo cáo đã chốt",
                    documentFiles: "Tài liệu văn bản nguồn",
                    restore: "Phục hồi dữ liệu nghiệp vụ",
                    milestone: form.id ? "Sửa mốc tiến độ" : "Thêm mốc tiến độ",
                  } as any
                )[modal]
              }
            </DialogTitle>
            <DialogDescription>
              {modal === "confirmReport"
                ? "Kiểm tra thông tin báo cáo trước khi xác nhận và cập nhật tiến độ công việc."
                : ["task", "document", "report"].includes(modal)
                  ? "Dữ liệu được lưu dùng chung và có lịch sử thay đổi."
                  : "Kiểm tra thông tin trước khi xác nhận."}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          {modal === "taskImport" && (
            <div>
              <div className="hint mb-4">
                <Info />
                Mã nhập dùng để thêm mới; ID hệ thống dùng để cập nhật. Phân
                công theo đơn vị chủ trì và phối hợp. Chánh/Phó Văn phòng có thể
                lưu và giao ngay đến đơn vị. Cán bộ nhập liệu trình duyệt; đơn
                vị nhận nhiệm vụ sau khi phê duyệt. Các module dùng chung dữ
                liệu đã lưu.
              </div>
              <div className="actions mb-4">
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
                <Btn disabled={busy} onClick={downloadTemplate}>
                  <Download />
                  Tải mẫu theo danh mục hiện tại
                </Btn>
                <label className="excel-file-picker">
                  <strong>Chọn file Excel đã điền</strong>
                  <span>
                    Tháng nhập: {month.slice(5)}/{month.slice(0, 4)} · XLSX/XLS
                    · Tối đa 5 MB
                  </span>
                  <input
                    aria-label="Chọn bảng nhiệm vụ Excel"
                    type="file"
                    accept=".xlsx,.xls"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) readTaskFile(f);
                    }}
                  />
                </label>
              </div>
              <div className="text-sm mb-4">
                <a
                  className="underline"
                  href="/api/task-template-ready"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Tải trực tiếp mẫu Excel
                </a>
                <p className="muted mt-2">
                  Điền từ dòng 2 trong trang Nhap nhiem vu, giữ nguyên tên cột.
                  Sau khi chọn file, kiểm tra từng dòng rồi bấm Lưu hệ thống.
                  Cách xử lý bên dưới quyết định giao ngay, trình duyệt hoặc lưu
                  nháp.
                </p>
              </div>
              {importFileName && (
                <div className="hint mb-4" role="status">
                  <div>
                    <strong>{importFileName}</strong>
                    <p>{importPhase}</p>
                  </div>
                </div>
              )}
              {templateDownload && (
                <div className="hint mb-4">
                  <a
                    href={templateDownload.url}
                    download={templateDownload.filename}
                  >
                    Tải file {templateDownload.filename} về máy
                  </a>
                </div>
              )}
              {importSaveProgress.total > 0 && (
                <div className="import-save-progress" role="status">
                  <span>
                    Đã xử lý {importSaveProgress.finished}/
                    {importSaveProgress.total} dòng · Đã lưu thành công{" "}
                    {importRows.filter((r: any) => r.saved).length}/
                    {importRows.length}
                  </span>
                  <Progress
                    value={
                      (importSaveProgress.finished / importSaveProgress.total) *
                      100
                    }
                  />
                </div>
              )}
              {importRows.length > 0 && (
                <>
                  <p className="text-sm mb-3">
                    {importRows.length} dòng ·{" "}
                    {importRows.filter((r: any) => r.mode === "create").length} thêm
                    mới · {importRows.filter((r: any) => r.mode === "update").length}{" "}
                    cập nhật ·{" "}
                    {importRows.filter((r: any) => r.errors.length).length} dòng lỗi
                  </p>
                  <div className="table-wrap" style={{ maxHeight: "45vh" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Dòng</th>
                          <th>Xử lý</th>
                          <th>Nội dung / Phân công</th>
                          <th>Kiểm tra</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((r: any) => (
                          <tr key={r.row}>
                            <td>{r.row}</td>
                            <td>
                              {r.mode === "create" ? "Thêm mới" : "Cập nhật"}
                            </td>
                            <td>
                              {r.payload.title}
                              <div className="text-sm muted">
                                Chủ trì: {unitName(r.payload.unit)} · Phụ trách:{" "}
                                {r.payload.owner}
                              </div>
                              <div className="text-sm muted">
                                Phối hợp:{" "}
                                {r.payload.partners.map(unitName).join("; ") ||
                                  "Không có"}
                              </div>
                              <div className="text-sm muted">
                                Giao: {fmt(r.payload.assignedDate)}{" "}
                                {r.payload.assignedTime} · Hạn:{" "}
                                {fmt(r.payload.due)}
                              </div>
                            </td>
                            <td
                              className={
                                r.errors.length || (r.message && !r.saved)
                                  ? "text-red-700"
                                  : "text-green-700"
                              }
                            >
                              {r.errors.join("; ") || r.message || "Hợp lệ"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="form-footer">
                    <Pick
                      label="Cách xử lý nhiệm vụ Excel"
                      value={
                        approver(user)
                          ? importAction
                          : importAction === "draft"
                            ? "draft"
                            : "submit"
                      }
                      onChange={setImportAction}
                      options={[
                        ...(approver(user)
                          ? [["assign", "Lưu và giao nhiệm vụ"]]
                          : []),
                        ["submit", "Lưu và trình duyệt"],
                        ["draft", "Chỉ lưu nháp"],
                      ]}
                    />
                    <Btn disabled={busy} onClick={() => setModal("")}>
                      Đóng
                    </Btn>
                    <Btn
                      primary
                      disabled={
                        busy ||
                        importRows.some((r: any) => r.errors.length) ||
                        importRows.every((r: any) => r.saved)
                      }
                      onClick={saveTaskImport}
                    >
                      <Save />
                      {busy && importSaveProgress.total
                        ? "Đang lưu " +
                        importSaveProgress.finished +
                        "/" +
                        importSaveProgress.total
                        : importRows.every((r: any) => r.saved)
                          ? "Đã lưu hệ thống"
                          : "Lưu hệ thống"}
                    </Btn>
                  </div>
                </>
              )}
            </div>
          )}
          {modal === "task" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => api("task", form));
              }}
            >
              <div className="form-grid">
                {approver(user) && (
                  <Field label="Yêu cầu minh chứng">
                    <Pick
                      value={form.evidenceRequirement || "none"}
                      onChange={(v: string) => change("evidenceRequirement", v)}
                      options={[
                        ["none", "Không bắt buộc"],
                        ["any", "Cần có tệp minh chứng"],
                        ["image", "Cần có ảnh minh chứng"],
                        ["document", "Cần có văn bản minh chứng"],
                      ]}
                    />
                  </Field>
                )}
                <Field label="Nội dung nhiệm vụ *" wide>
                  <textarea
                    required
                    rows={3}
                    value={form.title || ""}
                    onChange={(e) => change("title", e.target.value)}
                  />
                </Field>
                <Field label="Văn bản nguồn">
                  <Pick
                    value={form.documentId}
                    onChange={(v: string) => change("documentId", v)}
                    options={[
                      ["", "Nhiệm vụ thủ công"],
                      ...data.documents.map((d: any) => [
                        d.id,
                        d.number + " · " + d.title.slice(0, 60),
                      ]),
                    ]}
                  />
                </Field>
                <Field label="Kỳ theo dõi *">
                  <input
                    type="month"
                    required
                    value={form.month || month}
                    disabled={!!form.id}
                    onChange={(e) => change("month", e.target.value)}
                  />
                </Field>
                <Field label="Đơn vị chủ trì *">
                  <Pick
                    value={form.unit}
                    onChange={(v: string) => change("unit", v)}
                    options={[
                      ["", "Chọn đơn vị chủ trì"],
                      ...data.units
                        .filter((u: any) => u.active)
                        .map((u: any) => [u.id, u.name]),
                    ]}
                  />
                </Field>
                <Field label="Người phụ trách chính">
                  <input
                    value={form.owner || ""}
                    onChange={(e) => change("owner", e.target.value)}
                    placeholder="Nhập theo phân công thực tế"
                  />
                </Field>
                <Field label="Đơn vị phối hợp" wide>
                  <div className="check-list">
                    {data.units
                      .filter((u: any) => u.active && u.id !== form.unit)
                      .map((u: any) => (
                        <Check
                          key={u.id}
                          label={u.name}
                          checked={form.partners?.includes(u.id)}
                          onChange={(v: boolean) =>
                            change(
                              "partners",
                              v
                                ? [...(form.partners || []), u.id]
                                : (form.partners || []).filter(
                                  (x: string) => x !== u.id,
                                ),
                            )
                          }
                        />
                      ))}
                  </div>
                </Field>
                <Field label="Ngày giao nhiệm vụ *">
                  <input
                    type="date"
                    required
                    value={form.assignedDate || ""}
                    onChange={(e) => change("assignedDate", e.target.value)}
                  />
                </Field>
                <Field label="Giờ giao nhiệm vụ (tùy chọn)">
                  <input
                    type="time"
                    value={form.assignedTime || ""}
                    onChange={(e) => change("assignedTime", e.target.value)}
                  />
                </Field>
                <Field label="Thời hạn hoàn thành *">
                  <input
                    type="date"
                    required
                    value={form.due || ""}
                    onChange={(e) => change("due", e.target.value)}
                  />
                </Field>
                <Field label="Chế độ báo cáo của nhiệm vụ">
                  <Pick
                    value={form.reportFrequency || "default"}
                    onChange={(v: string) => change("reportFrequency", v)}
                    options={[
                      ["default", "Theo lịch chung của hệ thống"],
                      ["daily", "Hằng ngày"],
                      ["weekly", "Hằng tuần (lịch riêng)"],
                    ]}
                  />
                </Field>
                {form.reportFrequency && form.reportFrequency !== "default" && (
                  <Field label="Báo cáo trước giờ *">
                    <input
                      type="time"
                      required
                      value={form.reportHour || "15:30"}
                      onChange={(e) => change("reportHour", e.target.value)}
                    />
                  </Field>
                )}
                {form.reportFrequency === "weekly" && (
                  <Field label="Ngày báo cáo trong tuần">
                    <Pick
                      value={form.reportDay || 5}
                      onChange={(v: string) => change("reportDay", Number(v))}
                      options={Array.from({ length: 7 }, (_, i) => [
                        i + 1,
                        i === 6 ? "Chủ nhật" : "Thứ " + (i + 2),
                      ])}
                    />
                  </Field>
                )}
                <div className="form-field wide hint">
                  {reportScheduleLabel(
                    { ...form, reportHour: form.reportHour || "15:30" },
                    cfg,
                  )}
                  . Hạn báo cáo được theo dõi riêng với thời hạn hoàn thành
                  nhiệm vụ.
                </div>
                <Field label="Lãnh đạo theo dõi">
                  <input
                    value={form.leader || ""}
                    onChange={(e) => change("leader", e.target.value)}
                  />
                </Field>
                <Field label="Lĩnh vực">
                  <input
                    value={form.field || ""}
                    onChange={(e) => change("field", e.target.value)}
                  />
                </Field>
                <Field label="Chỉ tiêu định lượng">
                  <input
                    type="number"
                    min="0"
                    value={form.target || 0}
                    onChange={(e) => change("target", e.target.value)}
                  />
                </Field>
                <Field label="Đơn vị tính">
                  <input
                    value={form.measure || ""}
                    onChange={(e) => change("measure", e.target.value)}
                    placeholder="Hồ sơ, lượt người, %…"
                  />
                </Field>
                <Field label="Mức độ ưu tiên">
                  <Pick
                    value={form.priority}
                    onChange={(v: string) => change("priority", v)}
                    options={[
                      ["normal", "Bình thường"],
                      ["high", "Trọng tâm"],
                      ["urgent", "Khẩn"],
                    ]}
                  />
                </Field>
                <Field label="Loại nhiệm vụ">
                  <Pick
                    value={form.type}
                    onChange={(v: string) => change("type", v)}
                    options={[
                      ["new", "Mới"],
                      ["regular", "Thường xuyên"],
                      ["urgent", "Đột xuất"],
                      ...(form.type === "carry"
                        ? [["carry", "Chuyển tiếp"]]
                        : []),
                    ]}
                  />
                </Field>
                <Field label="Sản phẩm đầu ra">
                  <textarea
                    value={form.output || ""}
                    onChange={(e) => change("output", e.target.value)}
                  />
                </Field>
                <Field label="Các đầu việc / mốc tiến độ">
                  <textarea
                    value={form.milestones || ""}
                    onChange={(e) => change("milestones", e.target.value)}
                    placeholder="Mỗi dòng một mốc, thời gian và kết quả cần đạt"
                  />
                </Field>
                <Field label="Ghi chú" wide>
                  <textarea
                    value={form.note || ""}
                    onChange={(e) => change("note", e.target.value)}
                  />
                </Field>
                {form.id && (
                  <Field
                    label="Lý do điều chỉnh (bắt buộc khi đổi hạn hoặc chủ trì)"
                    wide
                  >
                    <input
                      value={form.reason || ""}
                      onChange={(e) => change("reason", e.target.value)}
                    />
                  </Field>
                )}
                <div className="form-field wide">
                  <Check
                    label="Giới hạn hồ sơ theo người được cấp quyền"
                    checked={form.restricted}
                    onChange={(v: boolean) => change("restricted", v)}
                  />
                  {form.restricted && (
                    <div className="check-list">
                      {data.users.map((u: any) => (
                        <Check
                          key={u.id}
                          label={u.name}
                          checked={
                            form.allowedUsers?.includes(u.id) ||
                            u.id === user.id
                          }
                          onChange={(v: boolean) =>
                            change(
                              "allowedUsers",
                              v
                                ? [...(form.allowedUsers || []), u.id]
                                : (form.allowedUsers || []).filter(
                                  (x: string) => x !== u.id,
                                ),
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-footer">
                <Btn onClick={() => setModal("")}>Hủy</Btn>
                <Btn primary type="submit" disabled={busy}>
                  <Save />
                  {form.id ? "Lưu thay đổi" : "Lưu nháp nhiệm vụ"}
                </Btn>
              </div>
            </form>
          )}
          {modal === "document" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => api("document", form));
              }}
            >
              <fieldset disabled={form.view}>
                <div className="form-grid">
                  <Field label="Số, ký hiệu văn bản *">
                    <input
                      required
                      value={form.number || ""}
                      onChange={(e) => change("number", e.target.value)}
                    />
                  </Field>
                  <Field label="Ngày ban hành *">
                    <input
                      required
                      type="date"
                      value={form.issued || ""}
                      onChange={(e) => change("issued", e.target.value)}
                    />
                  </Field>
                  <Field label="Cơ quan ban hành">
                    <input
                      value={form.issuer || ""}
                      onChange={(e) => change("issuer", e.target.value)}
                    />
                  </Field>
                  <Field label="Loại văn bản">
                    <input
                      value={form.type || ""}
                      onChange={(e) => change("type", e.target.value)}
                    />
                  </Field>
                  <Field label="Trích yếu *" wide>
                    <textarea
                      required
                      value={form.title || ""}
                      onChange={(e) => change("title", e.target.value)}
                    />
                  </Field>
                  <Field label="Nội dung" wide>
                    <textarea
                      rows={5}
                      value={form.content || ""}
                      onChange={(e) => change("content", e.target.value)}
                    />
                  </Field>
                  <Field label="Kỳ theo dõi">
                    <input
                      type="month"
                      required
                      value={form.month}
                      onChange={(e) => change("month", e.target.value)}
                    />
                  </Field>
                </div>
              </fieldset>
              {!form.view && (
                <div className="form-footer">
                  <Btn onClick={() => setModal("")}>Hủy</Btn>
                  <Btn primary type="submit" disabled={busy}>
                    <Save />
                    Lưu văn bản
                  </Btn>
                </div>
              )}
            </form>
          )}
          {modal === "unit" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => api("unit", form));
              }}
            >
              <div className="form-grid">
                <Field label="Tên cơ quan, đơn vị *" wide>
                  <input
                    required
                    value={form.name || ""}
                    onChange={(e) => change("name", e.target.value)}
                  />
                </Field>
                <Field label="Khối / nhóm đơn vị">
                  <input
                    list="group-options"
                    required
                    value={form.group || ""}
                    onChange={(e) => change("group", e.target.value)}
                  />
                  <datalist id="group-options">
                    {groups.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </datalist>
                </Field>
                <Field label="Đơn vị cấp trên">
                  <Pick
                    value={form.parentUnitId}
                    onChange={(v: string) => {
                      change("parentUnitId", v);
                      const parent = data.units.find((u: any) => u.id === v);
                      if (parent) change("group", parent.group);
                    }}
                    options={[
                      ["", "Không có đơn vị cấp trên"],
                      ...data.units
                        .filter((u: any) => u.active && u.id !== form.id)
                        .map((u: any) => [u.id, u.name]),
                    ]}
                  />
                </Field>
                <Field label="Thứ tự hiển thị">
                  <input
                    type="number"
                    value={form.order || 0}
                    onChange={(e) => change("order", e.target.value)}
                  />
                </Field>
                <Field label="Đầu mối liên hệ" wide>
                  <input
                    value={form.contact || ""}
                    onChange={(e) => change("contact", e.target.value)}
                  />
                </Field>
                <Check
                  label="Đang hoạt động"
                  checked={form.active}
                  onChange={(v: boolean) => change("active", v)}
                />
              </div>
              <div className="form-footer flex justify-between items-center">
                {form.id && has(user, "admin") && (
                  <Btn
                    danger
                    type="button"
                    className="mr-auto"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Bạn có chắc chắn muốn xóa cơ quan, đơn vị "${form.name}"? Toàn bộ tài nguyên liên kết đi cùng (nhiệm vụ, báo cáo, tài khoản trực thuộc) cũng sẽ bị xóa vĩnh viễn.`,
                        )
                      ) {
                        run(
                          () =>
                            api("unit-delete", { id: form.id, cascade: true }),
                          "Đã xóa đơn vị và toàn bộ tài nguyên đi cùng thành công.",
                        );
                      }
                    }}
                  >
                    <Trash2 />
                    Xóa đơn vị
                  </Btn>
                )}
                <Btn primary type="submit" disabled={busy}>
                  <Save />
                  Lưu đơn vị
                </Btn>
              </div>
            </form>
          )}
          {modal === "user" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () => api("users", form),
                  "Đã lưu tài khoản và phân quyền.",
                );
              }}
            >
              <div className="form-grid">
                <div className="form-field wide">
                  <span>Chọn nhanh vai trò</span>
                  <div className="actions">
                    <Btn small onClick={() => change("roles", ["deputy"])}>
                      Phó Chánh Văn phòng
                    </Btn>
                    <Btn small onClick={() => change("roles", ["clerk"])}>
                      Văn thư hỗ trợ nhập
                    </Btn>
                    <Btn small onClick={() => change("roles", ["editor"])}>
                      Cán bộ đơn vị
                    </Btn>
                  </div>
                </div>
                <Field label="Họ và tên *">
                  <input
                    required
                    value={form.name || ""}
                    onChange={(e) => change("name", e.target.value)}
                  />
                </Field>
                <Field label="Tên đăng nhập *">
                  <input
                    required
                    value={form.username || ""}
                    onChange={(e) => change("username", e.target.value)}
                  />
                </Field>
                <Field
                  label={
                    form.id
                      ? "Mật khẩu tạm mới (để trống nếu giữ nguyên)"
                      : "Mật khẩu tạm (tối thiểu 12 ký tự) *"
                  }
                  wide
                >
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    required={!form.id}
                    value={form.password || ""}
                    onChange={(e) => change("password", e.target.value)}
                  />
                </Field>
                <Field label="Vai trò (có thể chọn nhiều)" wide>
                  <div className="check-list">
                    {Object.entries(roleNames).map(([k, v]) => (
                      <Check
                        key={k}
                        label={v}
                        checked={form.roles?.includes(k)}
                        onChange={(yes: boolean) =>
                          change(
                            "roles",
                            yes
                              ? [...form.roles, k]
                              : form.roles.filter((x: string) => x !== k),
                          )
                        }
                      />
                    ))}
                  </div>
                </Field>
                <Field label="Đơn vị được cấp quyền" wide>
                  <div className="check-list">
                    {data.units.map((u: any) => (
                      <Check
                        key={u.id}
                        label={u.name}
                        checked={form.units?.includes(u.id)}
                        onChange={(yes: boolean) =>
                          change(
                            "units",
                            yes
                              ? [...form.units, u.id]
                              : form.units.filter((x: string) => x !== u.id),
                          )
                        }
                      />
                    ))}
                  </div>
                </Field>
                <Field label="Phạm vi xem bổ sung theo khối" wide>
                  <div className="check-list">
                    {groups.map((g) => (
                      <Check
                        key={g}
                        label={g}
                        checked={form.groups?.includes(g)}
                        onChange={(yes: boolean) =>
                          change(
                            "groups",
                            yes
                              ? [...form.groups, g]
                              : form.groups.filter((x: string) => x !== g),
                          )
                        }
                      />
                    ))}
                  </div>
                </Field>
                {form.id && (
                  <Check
                    label="Yêu cầu đổi mật khẩu ở lần đăng nhập tiếp theo"
                    checked={!!form.requirePasswordChange}
                    onChange={(v: boolean) =>
                      change("requirePasswordChange", v)
                    }
                  />
                )}
                <Check
                  label="Tài khoản hoạt động"
                  checked={form.active}
                  onChange={(v: boolean) => change("active", v)}
                />
              </div>
              <div className="hint mt-4">
                <ShieldCheck />
                Bàn giao mật khẩu tạm qua kênh riêng. Người dùng có thể đổi mật
                khẩu khi đăng nhập hoặc đổi sau tại Tài khoản cá nhân.
              </div>
              <div className="form-footer">
                <Btn primary type="submit" disabled={busy}>
                  <Save />
                  Lưu tài khoản
                </Btn>
              </div>
            </form>
          )}
          {modal === "settings" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => api("settings", form));
              }}
            >
              <div className="form-grid">
                <Field label="Tên hệ thống" wide>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => change("title", e.target.value)}
                  />
                </Field>
                <Field label="Tên đơn vị">
                  <input
                    required
                    value={form.organization}
                    onChange={(e) => change("organization", e.target.value)}
                  />
                </Field>
                <Field label="Tỉnh / thành phố">
                  <input
                    value={form.city}
                    onChange={(e) => change("city", e.target.value)}
                  />
                </Field>
                <Field label="Ngày báo cáo tuần">
                  <Pick
                    value={form.day}
                    onChange={(v: string) => change("day", Number(v))}
                    options={Array.from({ length: 7 }, (_, i) => [
                      i + 1,
                      i === 6 ? "Chủ nhật" : "Thứ " + (i + 2),
                    ])}
                  />
                </Field>
                <Field label="Giờ hạn báo cáo">
                  <input
                    type="time"
                    required
                    value={form.hour}
                    onChange={(e) => change("hour", e.target.value)}
                  />
                </Field>
                <Field label="Nhắc trước thời hạn (ngày)">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={form.warningDays}
                    onChange={(e) => change("warningDays", e.target.value)}
                  />
                </Field>
                <Field label="Số dòng mỗi trang">
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={form.pageSize}
                    onChange={(e) => change("pageSize", e.target.value)}
                  />
                </Field>
                <Field label="Hết phiên sau (phút)">
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={form.sessionMinutes}
                    onChange={(e) => change("sessionMinutes", e.target.value)}
                  />
                </Field>
                <Field label="Màu chủ đạo">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => change("color", e.target.value)}
                  />
                </Field>
                <Field label="Logo (PNG hoặc JPG)" wide>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    disabled={busy}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setBusy(true);
                      try {
                        const r = await upload("settings", f);
                        change("logo", "/api/logo?id=" + r.id);
                        toast.success(
                          "Đã tải logo. Bấm Lưu cấu hình để áp dụng.",
                        );
                      } catch (e: any) {
                        setError(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                  {form.logo && (
                    <div className="flex items-center gap-3">
                      <img
                        alt="Logo mới"
                        src={form.logo}
                        style={{ width: 45, height: 45, objectFit: "contain" }}
                      />
                      <Btn small onClick={() => change("logo", "")}>
                        Gỡ logo
                      </Btn>
                    </div>
                  )}
                </Field>
              </div>
              <div className="form-footer">
                <Btn primary type="submit" disabled={busy}>
                  <Save />
                  Lưu cấu hình
                </Btn>
              </div>
            </form>
          )}
          {modal === "milestone" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => api("milestone", form));
              }}
            >
              <div className="form-grid">
                <Field label="Nội dung đầu việc *" wide>
                  <textarea
                    required
                    value={form.title || ""}
                    onChange={(e) => change("title", e.target.value)}
                  />
                </Field>
                <Field label="Thời hạn">
                  <input
                    type="date"
                    required
                    value={form.due || ""}
                    onChange={(e) => change("due", e.target.value)}
                  />
                </Field>
                <Field label="Người phụ trách">
                  <input
                    value={form.owner || ""}
                    onChange={(e) => change("owner", e.target.value)}
                  />
                </Field>
                <Field label="Trạng thái">
                  <Pick
                    value={form.state}
                    onChange={(v: string) => change("state", v)}
                    options={[
                      ["todo", "Chưa thực hiện"],
                      ["working", "Đang thực hiện"],
                      ["done", "Đã thực hiện"],
                    ]}
                  />
                </Field>
                <Field label="Kết quả thực hiện" wide>
                  <textarea
                    value={form.result || ""}
                    onChange={(e) => change("result", e.target.value)}
                  />
                </Field>
              </div>
              <div className="form-footer">
                <Btn primary type="submit" disabled={busy}>
                  <Save />
                  Lưu đầu việc
                </Btn>
              </div>
            </form>
          )}
          {modal === "report" && (
            <div>
              <div className="form-grid">
                <Field label="Kết quả thực hiện *" wide>
                  <textarea
                    rows={4}
                    value={form.result || ""}
                    onChange={(e) => change("result", e.target.value)}
                  />
                </Field>
                <Field label="Tiến độ (%)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.progress}
                    onChange={(e) => change("progress", e.target.value)}
                  />
                </Field>
                <Field label="Khối lượng đã hoàn thành">
                  <input
                    type="number"
                    min="0"
                    value={form.quantity || 0}
                    onChange={(e) => change("quantity", e.target.value)}
                  />
                </Field>
                <Field label="Sản phẩm hoàn thành" wide>
                  <input
                    value={form.product || ""}
                    onChange={(e) => change("product", e.target.value)}
                  />
                </Field>
                <Field label="Khó khăn, vướng mắc">
                  <textarea
                    value={form.difficulty || ""}
                    onChange={(e) => change("difficulty", e.target.value)}
                  />
                </Field>
                <Field label="Kiến nghị, đề xuất">
                  <textarea
                    value={form.proposal || ""}
                    onChange={(e) => change("proposal", e.target.value)}
                  />
                </Field>
              </div>
              <div className="hint mt-4">
                <Info />
                Gửi báo cáo để thủ trưởng xác nhận. Trạng thái nhiệm vụ sẽ chuyển thành "Chờ xác nhận kết quả". Có thể tải minh chứng ngay
                bên dưới hoặc trong hồ sơ nhiệm vụ.
              </div>
              <div className="hint mt-4">
                <Clock />
                {reportScheduleLabel(
                  tasks.find((t: any) => t.id === form.taskId) || {},
                  cfg,
                )}{" "}
                · Hạn kỳ này:{" "}
                {fulltime(
                  form.deadline ||
                  reportWindow(
                    tasks.find((t: any) => t.id === form.taskId) || {},
                    new Date(),
                    cfg,
                  ).deadline,
                )}
              </div>
              <div className="evidence-upload mt-4">
                <Field label="Tải minh chứng (ảnh, video, hồ sơ)">
                  <input
                    type="file"
                    accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.mp4,.webm"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        run(
                          () => upload(form.taskId, f),
                          "Đã lưu minh chứng.",
                          false,
                        );
                    }}
                  />
                </Field>
                {data.files
                  .filter((f: any) => f.parent_id === form.taskId)
                  .map((f: any) => (
                    <a
                      key={f.id}
                      className="block text-sm underline mt-2"
                      href={"/api/file?id=" + f.id}
                    >
                      {f.name}
                    </a>
                  ))}
              </div>
              <div className="form-footer">
                <Btn
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api("report", { ...form, submit: false }),
                      "Đã lưu bản nháp.",
                    )
                  }
                >
                  <Save />
                  Lưu nháp
                </Btn>
                <Btn
                  primary
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api("report", { ...form, submit: true }),
                      "Đã gửi báo cáo đến người xác nhận.",
                    )
                  }
                >
                  <Send />
                  Gửi báo cáo
                </Btn>
              </div>
            </div>
          )}
          {modal === "confirmReport" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    api("report-action", {
                      id: form.id,
                      version: form.version,
                      action: "confirm",
                      progress: Number(form.progress ?? 0),
                      quantity: Number(form.quantity ?? 0),
                      result: form.result || "",
                      difficulty: form.difficulty || "",
                      proposal: form.proposal || "",
                      reviewNote: form.reviewNote || "",
                    }),
                  "Đã xác nhận báo cáo và cập nhật tiến độ công việc.",
                  true,
                  true,
                );
              }}
              className="space-y-5"
            >
              {/* 1. Header Banner & Nhắc nhở đồng bộ */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-slate-50 border border-blue-200/80 shadow-xs flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck size={22} />
                </div>
                <div className="text-sm">
                  <b className="text-blue-950 text-base font-semibold block">
                    Thẩm định & Xác nhận duyệt báo cáo tiến độ
                  </b>
                  <p className="mt-1 text-slate-600 leading-relaxed">
                    Bạn có thể kiểm tra và <b>trực tiếp hiệu chỉnh</b> tỉ lệ hoàn
                    thành, khối lượng thực tế, kết quả hoặc ghi chú chỉ đạo trước
                    khi duyệt. Sau khi xác nhận, tiến độ của nhiệm vụ sẽ được cập
                    nhật đồng bộ và toàn bộ minh chứng kèm theo sẽ được lưu vào
                    hồ sơ nhiệm vụ.
                  </p>
                </div>
              </div>

              {/* 2. Thẻ tóm tắt thông tin nguồn */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3 text-sm">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block mb-1">
                    Nhiệm vụ liên quan
                  </span>
                  <div className="font-semibold text-slate-900 text-base leading-snug">
                    {selectedTask?.title || "Nhiệm vụ"}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2.5 border-t border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 block">Đơn vị báo cáo:</span>
                    <b className="text-slate-800 text-sm">
                      {unitName(form.unit)}
                    </b>
                    {form.authorName && (
                      <div className="text-slate-500 mt-0.5">
                        Người gửi: {form.authorName}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 block">Kỳ báo cáo:</span>
                    <b className="text-slate-800 text-sm">
                      {fmt(form.periodKey || form.week)}
                    </b>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Tiến độ nhiệm vụ hiện tại:</span>
                    <b className="text-slate-800 text-sm">
                      {selectedTask?.progress || 0}%
                    </b>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Thời gian nộp:</span>
                    <span className="text-slate-800">
                      {fulltime(form.submitted)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Khối Hiệu chỉnh Số liệu thẩm định */}
              <div className="border border-indigo-100 rounded-xl p-4 bg-white shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-indigo-600" />
                    <span className="font-semibold text-slate-800 text-sm">
                      Số liệu thẩm định tiến độ
                    </span>
                  </div>
                  <span className="text-xs text-indigo-700 bg-indigo-50 font-medium px-2.5 py-0.5 rounded-full border border-indigo-200">
                    Cho phép hiệu chỉnh trước khi duyệt
                  </span>
                </div>

                {/* Thanh tiến độ & Input % */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-slate-700">
                      Tỉ lệ hoàn thành công việc (%):
                    </label>
                    <div className="flex items-center gap-3">
                      {form.originalProgress !== undefined &&
                        Number(form.originalProgress) !== Number(form.progress) && (
                          <button
                            type="button"
                            onClick={() =>
                              change("progress", form.originalProgress)
                            }
                            className="text-xs text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
                            title="Khôi phục mức đơn vị báo cáo"
                          >
                            <RotateCcw size={12} />
                            Đề xuất: {form.originalProgress}%
                          </button>
                        )}
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="w-20 text-center font-bold text-base border rounded-md px-2 py-1 text-emerald-800 bg-emerald-50 border-emerald-300 focus:outline-emerald-600"
                          value={form.progress ?? 0}
                          onChange={(e) => {
                            const val = Math.min(
                              100,
                              Math.max(0, Number(e.target.value) || 0),
                            );
                            change("progress", val);
                          }}
                        />
                        <span className="font-semibold text-slate-600">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Thanh trượt Range và Visual Progress bar */}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={form.progress ?? 0}
                    onChange={(e) => change("progress", Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
                  />

                  {/* Visual Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                    <div
                      className={
                        "h-full transition-all duration-300 rounded-full " +
                        (Number(form.progress) >= 100
                          ? "bg-emerald-600"
                          : Number(form.progress) >= 50
                            ? "bg-blue-600"
                            : "bg-amber-500")
                      }
                      style={{
                        width: `${Math.min(100, Math.max(0, Number(form.progress || 0)))}%`,
                      }}
                    />
                  </div>

                  {/* Nút chọn nhanh */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs text-slate-500 mr-1">
                      Mức nhanh:
                    </span>
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => change("progress", pct)}
                        className={
                          "text-xs px-2.5 py-1 rounded-md font-medium border transition " +
                          (Number(form.progress) === pct
                            ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100")
                        }
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Khối lượng hoàn thành */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Khối lượng hoàn thành thực tế:
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="w-full sm:w-60 border rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder="Nhập số khối lượng đạt được..."
                    value={form.quantity ?? 0}
                    onChange={(e) => change("quantity", e.target.value)}
                  />
                </div>
              </div>

              {/* 4. Khối Nội dung kết quả & Biên tập */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Pencil size={16} className="text-slate-600" />
                  <span className="font-semibold text-slate-800 text-sm">
                    Nội dung kết quả thực hiện & Vướng mắc
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Kết quả thực hiện (Nội dung báo cáo):
                  </label>
                  <textarea
                    rows={3}
                    className="w-full border rounded-lg p-3 text-sm text-slate-800 bg-slate-50/50 focus:bg-white focus:border-blue-500 transition"
                    placeholder="Mô tả chi tiết kết quả công việc đã thực hiện..."
                    value={form.result || ""}
                    onChange={(e) => change("result", e.target.value)}
                  />
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Người duyệt có thể biên tập lại nội dung kết quả để chuẩn
                    hóa vào hồ sơ công việc chung.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Khó khăn, vướng mắc (nếu có):
                    </label>
                    <textarea
                      rows={2}
                      className="w-full border rounded-lg p-2.5 text-sm text-amber-950 bg-amber-50/40 focus:bg-white focus:border-amber-500"
                      placeholder="Nêu vướng mắc cần tháo gỡ..."
                      value={form.difficulty || ""}
                      onChange={(e) => change("difficulty", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Kiến nghị, đề xuất (nếu có):
                    </label>
                    <textarea
                      rows={2}
                      className="w-full border rounded-lg p-2.5 text-sm text-slate-800 bg-slate-50/50 focus:bg-white focus:border-blue-500"
                      placeholder="Nêu kiến nghị phối hợp..."
                      value={form.proposal || ""}
                      onChange={(e) => change("proposal", e.target.value)}
                    />
                  </div>
                </div>

                {/* Ý kiến thẩm định / Ghi chú của người duyệt */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Ý kiến / Ghi chú thẩm định của người duyệt:
                  </label>
                  <input
                    type="text"
                    className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm bg-blue-50/30 focus:bg-white focus:border-blue-600"
                    placeholder="Nhập ghi chú hoặc ý kiến chỉ đạo (ví dụ: Đồng ý tiến độ; Yêu cầu dứt điểm trong tuần tới...)"
                    value={form.reviewNote || ""}
                    onChange={(e) => change("reviewNote", e.target.value)}
                  />
                </div>
              </div>

              {/* 5. Khối Hồ sơ minh chứng đính kèm */}
              {(() => {
                const reportFiles = data.files.filter(
                  (f: any) =>
                    f.parent_id === form.id ||
                    (Array.isArray(form.evidenceIds) &&
                      form.evidenceIds.includes(f.id)),
                );
                return (
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Paperclip size={16} className="text-slate-600" />
                        <span className="font-semibold text-slate-800 text-sm">
                          Hồ sơ minh chứng báo cáo ({reportFiles.length} tệp)
                        </span>
                      </div>
                      <span className="text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        Sẽ tự động tích hợp vào nhiệm vụ
                      </span>
                    </div>

                    {reportFiles.length > 0 ? (
                      <div className="space-y-2">
                        {reportFiles.map((f: any) => {
                          const canPreview =
                            f.mime?.startsWith("image/") ||
                            f.mime === "application/pdf";
                          return (
                            <div
                              key={f.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-white hover:border-slate-300 transition text-sm"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                                  <Paperclip size={16} />
                                </div>
                                <div className="min-w-0">
                                  <b
                                    className="block truncate max-w-[280px] sm:max-w-[380px]"
                                    title={f.name}
                                  >
                                    {f.name}
                                  </b>
                                  <div className="text-xs text-slate-500">
                                    {(f.size / 1024).toFixed(0)} KB ·{" "}
                                    {fmt(f.created)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {canPreview && (
                                  <a
                                    className="btn small text-slate-700 bg-slate-100 hover:bg-slate-200 border-none"
                                    href={"/api/file?id=" + f.id + "&preview=1"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Eye size={13} />
                                    Xem
                                  </a>
                                )}
                                <a
                                  className="btn small"
                                  href={"/api/file?id=" + f.id}
                                  download={f.name}
                                >
                                  <Download size={13} />
                                  Tải về
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3 border border-dashed rounded-lg text-center text-xs text-slate-500 bg-white">
                        Báo cáo này chưa có tệp minh chứng đính kèm.
                      </div>
                    )}

                    {/* Cho phép người duyệt đính kèm thêm biên bản thẩm định nếu muốn */}
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <label className="inline-flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-medium cursor-pointer">
                        <Plus size={14} />
                        Đính kèm thêm biên bản/tài liệu thẩm định
                        <input
                          type="file"
                          className="hidden"
                          disabled={busy}
                          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.mp4,.webm"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f)
                              run(
                                () => upload(form.id, f),
                                "Đã lưu tệp thẩm định.",
                                false,
                              );
                          }}
                        />
                      </label>
                      <span className="text-[11px] text-slate-400">
                        PDF, Word, Excel, Ảnh · Tối đa 25MB
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* 6. Nút hành động ở chân modal */}
              <div className="form-footer mt-6 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                <Btn onClick={() => setModal("")}>Hủy</Btn>
                <div className="flex items-center gap-2">
                  <Btn
                    small
                    onClick={() =>
                      open("returnReport", {
                        id: form.id,
                        version: form.version,
                        action: "return",
                      })
                    }
                  >
                    Yêu cầu bổ sung
                  </Btn>
                  <Btn primary type="submit" disabled={busy}>
                    <CheckCircle2 size={16} />
                    Xác nhận duyệt & Cập nhật tiến độ
                  </Btn>
                </div>
              </div>
            </form>
          )}
          {[
            "action",
            "returnReport",
            "period",
            "remind",
            "comment",
            "password",
          ].includes(modal) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const endpoint = (
                    {
                      action: "task-action",
                      returnReport: "report-action",
                      period: "period",
                      remind: "remind",
                      comment: "comment",
                      password: "password",
                    } as any
                  )[modal];
                  run(
                    () => api(endpoint, form),
                    "Đã ghi nhận thao tác.",
                    true,
                    modal !== "password",
                  ).then((r: any) => {
                    if (r && modal === "password") {
                      setUser(null);
                      setForm({});
                    }
                  });
                }}
              >
                <div className="form-grid">
                  {modal === "action" && form.action === "carry" && (
                    <>
                      <Field label="Kỳ mới">
                        <input
                          type="month"
                          required
                          value={form.month || ""}
                          onChange={(e) => change("month", e.target.value)}
                        />
                      </Field>
                      <Field label="Thời hạn kỳ mới">
                        <input
                          type="date"
                          required
                          value={form.due || ""}
                          onChange={(e) => change("due", e.target.value)}
                        />
                      </Field>
                    </>
                  )}
                  {modal === "period" && (
                    <div className="hint wide">
                      {form.action === "reopen"
                        ? "Mở điều chỉnh không xóa báo cáo đã chốt. Lần khóa tiếp theo tạo một phiên bản mới."
                        : "Khóa sổ sẽ tạo bản chụp dữ liệu kỳ " +
                        month +
                        ". Các hồ sơ trong kỳ không được sửa cho đến khi mở điều chỉnh."}
                    </div>
                  )}
                  {modal === "password" ? (
                    <>
                      <Field label="Mật khẩu hiện tại" wide>
                        <input
                          required
                          type="password"
                          value={form.old || ""}
                          onChange={(e) => change("old", e.target.value)}
                        />
                      </Field>
                      <Field label="Mật khẩu mới (tối thiểu 12 ký tự)" wide>
                        <input
                          required
                          type="password"
                          minLength={12}
                          value={form.password || ""}
                          onChange={(e) => change("password", e.target.value)}
                        />
                      </Field>
                    </>
                  ) : modal === "comment" ? (
                    <Field label="Nội dung ý kiến" wide>
                      <textarea
                        required
                        value={form.text || ""}
                        onChange={(e) => change("text", e.target.value)}
                      />
                    </Field>
                  ) : modal === "remind" ? (
                    <Field label="Nội dung nhắc việc" wide>
                      <textarea
                        required
                        value={form.message || ""}
                        onChange={(e) => change("message", e.target.value)}
                      />
                    </Field>
                  ) : (
                    <Field label="Lý do / căn cứ / yêu cầu bổ sung" wide>
                      <textarea
                        required={
                          !(modal === "period" && form.action === "close")
                        }
                        value={form.reason || ""}
                        onChange={(e) => change("reason", e.target.value)}
                      />
                    </Field>
                  )}
                </div>
                <div className="form-footer">
                  <Btn onClick={() => setModal("")}>Hủy</Btn>
                  <Btn primary type="submit" disabled={busy}>
                    Xác nhận và lưu
                  </Btn>
                </div>
              </form>
            )}
          {modal === "preview" && (
            <div>
              <div className="report-preview">
                <div className="report-letterhead">
                  <b>
                    {cfg.organization}
                    <br />
                    VĂN PHÒNG ĐẢNG ỦY
                  </b>
                  <b>ĐẢNG CỘNG SẢN VIỆT NAM</b>
                </div>
                <h2>BÁO CÁO</h2>
                <h3>Kết quả thực hiện kết luận, chỉ đạo</h3>
                <p>
                  {range === "year"
                    ? "Năm " + month.slice(0, 4)
                    : range === "quarter"
                      ? "Quý " +
                      Math.ceil(Number(month.slice(5)) / 3) +
                      "/" +
                      month.slice(0, 4)
                      : range === "week"
                        ? "Tuần hiện tại"
                        : range === "custom"
                          ? fmt(fromDate) + " – " + fmt(toDate)
                          : "Tháng " +
                          Number(month.slice(5)) +
                          "/" +
                          month.slice(0, 4)}
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>TT</th>
                        {columns.map((c: any) => (
                          <th key={c}>{exportColumns[c]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows(filtered, columns, data).map(
                        (row: any, i: number) => (
                          <tr key={i}>
                            {row.map((v: any, j: number) => (
                              <td key={j}>{v || "—"}</td>
                            ))}
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
                {!filtered.length && (
                  <p className="muted">
                    Chưa có nhiệm vụ trong phạm vi tổng hợp.
                  </p>
                )}
              </div>
              <div className="form-footer">
                <Btn onClick={() => open("export")}>Chọn cột và xuất file</Btn>
              </div>
            </div>
          )}
          {modal === "export" && (
            <div>
              <div className="hint mb-5">
                <FileText />
                {filtered.length} nhiệm vụ theo bộ lọc hiện tại. Xuất toàn bộ
                các trang, không chỉ trang đang xem.
              </div>
              <div className="export-columns">
                {Object.entries(exportColumns).map(([k, v]) => (
                  <Check
                    key={k}
                    label={v}
                    checked={columns.includes(k)}
                    onChange={(yes: boolean) =>
                      setColumns(
                        yes ? [...columns, k] : columns.filter((x: any) => x !== k),
                      )
                    }
                  />
                ))}
              </div>
              <div className="form-footer">
                <Btn onClick={() => open("preview")}>
                  <Eye />
                  Xem trước
                </Btn>
                {["xls", "docx"].map((format) => (
                  <Btn
                    key={format}
                    disabled={busy || !columns.length}
                    primary={format === "xls"}
                    onClick={() =>
                      run(
                        async () => {
                          await api("export-log", { format, month });
                          await exportReport(
                            format,
                            filtered,
                            columns,
                            data,
                            month,
                            range,
                          );
                        },
                        "Đã xuất báo cáo.",
                        false,
                      )
                    }
                  >
                    <Download />
                    {format === "xls" ? "Excel 97–2003 (.xls)" : "Word (.docx)"}
                  </Btn>
                ))}
              </div>
            </div>
          )}
          {modal === "snapshots" && (
            <div>
              {snapshots.length ? (
                snapshots
                  .sort((a: any, b: any) => b.updated.localeCompare(a.updated))
                  .map((s: any) => (
                    <div className="report-card" key={s.id}>
                      <b>
                        Tháng {s.month} · {s.tasks.length} nhiệm vụ
                      </b>
                      <p className="muted">
                        Chốt bởi {s.author} lúc {fulltime(s.closedAt)}
                      </p>
                      <div className="actions">
                        {["xls", "docx"].map((f) => (
                          <Btn
                            small
                            key={f}
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  exportReport(
                                    f,
                                    s.tasks,
                                    columns,
                                    {
                                      ...data,
                                      reports: s.reports,
                                      settings: s.settings,
                                      units: s.units || data.units,
                                      documents: s.documents || [],
                                      files: s.files || [],
                                    },
                                    s.month,
                                    "month",
                                  ),
                                "Đã xuất bản chốt.",
                                false,
                              )
                            }
                          >
                            <Download />
                            {f === "xls"
                              ? "Excel 97–2003 (.xls)"
                              : "Word (.docx)"}
                          </Btn>
                        ))}
                      </div>
                    </div>
                  ))
              ) : (
                <None
                  title="Chưa có hồ sơ đã chốt"
                  text="Khóa sổ tháng để lưu báo cáo theo phiên bản."
                />
              )}
            </div>
          )}
          {modal === "documentFiles" && (
            <div>
              {office(user) && (
                <input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.mp4,.webm"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      run(
                        () => upload(form.id, f),
                        "Đã lưu tài liệu văn bản.",
                        false,
                      );
                  }}
                />
              )}
              {data.files
                .filter((f: any) => f.parent_id === form.id)
                .map((f: any) => (
                  <div className="report-card mt-3" key={f.id}>
                    <a
                      href={"/api/file?id=" + f.id}
                      className="text-sm underline"
                    >
                      {f.name}
                    </a>
                  </div>
                ))}
            </div>
          )}
          {modal === "restore" && (
            <div>
              <div className="hint amber mb-4">
                Phục hồi bản sao lưu nghiệp vụ vào hệ thống trống. Tệp minh
                chứng phải được phục hồi riêng trên máy chủ.
              </div>
              <input
                type="file"
                accept=".json"
                onChange={async (e) => {
                  try {
                    const f = e.target.files?.[0];
                    if (f) change("backup", JSON.parse(await f.text()));
                  } catch {
                    setError("Không đọc được bản sao lưu JSON.");
                  }
                }}
              />
              <Field label="Gõ PHUC HOI để xác nhận">
                <input
                  value={form.confirm || ""}
                  onChange={(e) => change("confirm", e.target.value)}
                />
              </Field>
              <div className="form-footer">
                <Btn
                  primary
                  disabled={busy || !form.backup}
                  onClick={() =>
                    run(
                      () => api("restore", form),
                      "Đã phục hồi dữ liệu nghiệp vụ.",
                    )
                  }
                >
                  Phục hồi
                </Btn>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
