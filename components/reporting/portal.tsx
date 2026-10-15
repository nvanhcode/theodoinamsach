"use client";
import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { ReportingDashboard, matchesSummary } from "./dashboard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  canReport,
  deadlineState,
  reportState,
  reportWindow,
  stateNames,
  reportScheduleLabel,
} from "@/lib/domain";
import {
  reportingUnits,
  coordinationUnits,
  partnerUpdateRequired as requiresPartnerUpdate,
  splitAssignedTasks,
  evidenceLabels,
  assignmentNoticeTitle,
  isAdminRequestNotice,
} from "@/lib/report-access";
import { noticePriority } from "@/lib/notice-priority";
import {
  isPercentageProgressTask,
  normalizePercentageReport,
} from "@/lib/progress-mode";
const dates = (s: string) =>
  s
    ? new Date(s.length === 10 ? s + "T00:00:00+07:00" : s).toLocaleString(
        "vi-VN",
        {
          timeZone: "Asia/Ho_Chi_Minh",
          ...(s.length === 10
            ? { year: "numeric", month: "2-digit", day: "2-digit" }
            : {}),
        },
      )
    : "—";
const reportNames: any = {
  draft: "Bản nháp",
  submitted: "Đã gửi, chờ xác nhận",
  confirmed: "Đã xác nhận",
  returned: "Cần bổ sung",
};
const reportingNames: any = {
  notRequired: "Không yêu cầu báo cáo kỳ này",
  notDue: "Chưa đến hạn báo cáo",
  onTime: "Đã gửi đúng hạn",
  late: "Đã gửi chậm",
  missing: "Chưa gửi, quá hạn báo cáo",
  returned: "Cần bổ sung",
};
export function ReportingPortal({
  data,
  user,
  load,
  markNoticeRead,
  api,
  onLogout,
}: any) {
  const [tab, setTab] = useState("dashboard"),
    [taskFilter, setTaskFilter] = useState("all"),
    [unitFilter, setUnitFilter] = useState(""),
    [month, setMonth] = useState("2026-10"),
    [search, setSearch] = useState(""),
    [task, setTask] = useState<any>(null),
    [form, setForm] = useState<any>({}),
    [readOnly, setReadOnly] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [history, setHistory] = useState<any[]>([]),
    [coordinationComments, setCoordinationComments] = useState<any[]>([]),
    [coordinationText, setCoordinationText] = useState(""),
    [coordinationFiles, setCoordinationFiles] = useState<File[]>([]),
    [coordinationPendingId, setCoordinationPendingId] = useState(""),
    [coordinationUnit, setCoordinationUnit] = useState(""),
    [showHistory, setShowHistory] = useState(false),
    [password, setPassword] = useState({ old: "", password: "" });
  const [dialogViewport, setDialogViewport] = useState<React.CSSProperties>({});
  const seenDirectiveIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!task) return;
    const viewport = window.visualViewport;
    const update = () =>
      setDialogViewport({
        "--report-viewport-top": (viewport?.offsetTop || 0) + "px",
        "--report-viewport-left": (viewport?.offsetLeft || 0) + "px",
        "--report-viewport-height":
          (viewport?.height || window.innerHeight) + "px",
        "--report-viewport-width":
          (viewport?.width || window.innerWidth) + "px",
      } as React.CSSProperties);
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [task]);
  const unitName = (id: string) =>
    data.units.find((u: any) => u.id === id)?.name || "—";
  const periodTasks = data.tasks.filter((t: any) => t.month === month);
  const { lead: leadTasks, partner: partnerTasks } = splitAssignedTasks(
    user,
    periodTasks,
  );
  const tasks = data.tasks
    .filter(
      (t: any) =>
        t.month === month &&
        (!search || t.title.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a: any, b: any) => a.due.localeCompare(b.due));
  const reports = data.reports
    .filter(
      (r: any) =>
        r.month === month &&
        (r.author === user.id ||
          user.units.includes(r.unit) ||
          (r.state !== "draft" &&
            periodTasks.some((t: any) => t.id === r.taskId))),
    )
    .sort((a: any, b: any) => b.updated.localeCompare(a.updated));
  const editable = (r: any) =>
    r.author === user.id &&
    ["draft", "returned"].includes(r.state) &&
    canReport(
      user,
      data.tasks.find((t: any) => t.id === r.taskId),
    );
  const active = (t: any) =>
    canReport(user, t) &&
    ["assigned", "working", "review", "returned"].includes(t.status);
  const reportingUnit = (t: any) => reportingUnits(user, t)[0] || t.unit;
  const reportingStatus = (t: any) =>
    reportState(
      { ...t, unit: reportingUnit(t) },
      data.reports,
      new Date(),
      data.settings,
    );
  const visibleTasks = tasks.filter((t: any) => {
    const isLead = user.units.includes(t.unit);
    const isPartner = !isLead && coordinationUnits(user, t).length > 0;
    const matchesRole =
      taskFilter === "all" ||
      (taskFilter === "lead" && isLead) ||
      (taskFilter === "partner" && isPartner) ||
      (isLead && matchesSummary(t, taskFilter, reportingStatus));
    return (
      matchesRole &&
      (!unitFilter ||
        t.unit === unitFilter ||
        (t.partners || []).includes(unitFilter))
    );
  });
  const { lead: visibleLeadTasks, partner: visiblePartnerTasks } =
    splitAssignedTasks(user, visibleTasks);
  const showTasks = (key: string, unit = "") => {
    setTaskFilter(key);
    setUnitFilter(unit);
    setSearch("");
    setTab("tasks");
  };
  const change = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const openTask = (t: any, r?: any, view = false) => {
    const report =
      r || reports.find((r: any) => r.taskId === t.id && editable(r));
    const draft = normalizePercentageReport(t, report);
    setTask(t);
    setForm(
      draft || {
        taskId: t.id,
        unit: reportingUnit(t),
        progress: t.progress || 0,
        quantity: 0,
        result: "",
        difficulty: "",
        proposal: "",
      },
    );
    setReadOnly(view || !active(t) || (!!draft && !editable(draft)));
    setError("");
    setMessage("");
    setHistory([]);
    setShowHistory(false);
    setCoordinationText("");
    setCoordinationFiles([]);
    setCoordinationPendingId("");
    const partnerScopes = coordinationUnits(user, t);
    setCoordinationUnit(partnerScopes[0] || "");
    setCoordinationComments([]);
    if (
      requiresPartnerUpdate(t) &&
      t.partners?.length &&
      (user.units.includes(t.unit) || partnerScopes.length)
    ) {
      api("comments?id=" + encodeURIComponent(t.id))
        .then((items: any[]) => setCoordinationComments(items))
        .catch((e: any) => setError(e.message));
    }
  };
  const renderTaskCard = (t: any) => {
    const isLead = user.units.includes(t.unit);
    const partnerScopes = coordinationUnits(user, t);
    const canSendCoordination =
      !isLead && partnerScopes.length > 0 && requiresPartnerUpdate(t);
    const visibleReport = reports.find(
      (r: any) => r.taskId === t.id && r.state !== "draft",
    );
    return (
      <article className="panel unit-task-card" key={t.id}>
        <h2>{t.title}</h2>
        <p className="muted">
          Chủ trì: {unitName(t.unit)}
          {!isLead ? " · Đơn vị bạn phối hợp thực hiện" : ""}
        </p>
        <div className="unit-task-meta">
          <span>
            <b>Hạn hoàn thành:</b> {dates(t.due)}{" "}
            {deadlineState(t) === "overdue" && (
              <em className="badge red">Quá hạn nhiệm vụ</em>
            )}
          </span>
          {Number(t.target) > 0 && (
            <span>
              <b>Chỉ tiêu:</b> {t.target} {t.measure}
            </span>
          )}
          <span>
            <b>Thực hiện:</b> {stateNames[t.status]} · {t.progress || 0}%
            {" đã xác nhận"}
          </span>
          {isLead ? (
            <span>
              <b>Báo cáo:</b> {reportingNames[reportingStatus(t)]}
            </span>
          ) : (
            <span>
              <b>Vai trò:</b> Nhiệm vụ phối hợp · Theo dõi tiến độ của đơn vị
              chủ trì
            </span>
          )}
        </div>
        <button
          className="btn primary"
          onClick={() =>
            openTask(
              t,
              isLead ? undefined : visibleReport,
              !isLead || !active(t),
            )
          }
        >
          {!isLead
            ? "Xem tiến độ chủ trì"
            : active(t)
              ? "Cập nhật báo cáo"
              : "Xem báo cáo"}
        </button>
        {canSendCoordination && (
          <button
            className="btn mt-2"
            onClick={() => openTask(t, visibleReport, true)}
          >
            Gửi thông tin phối hợp
          </button>
        )}
      </article>
    );
  };
  async function persist(submit: boolean) {
    const progress =
      Number(task.target) > 0 && !isPercentageProgressTask(task)
        ? Math.max(0, (Number(form.quantity || 0) / Number(task.target)) * 100)
        : form.progress;
    const r = await api("report", {
      ...form,
      progress,
      taskId: task.id,
      submit,
    });
    setForm(r);
    const fresh = await load();
    if (fresh?.tasks && task) {
      const updated = fresh.tasks.find((item: any) => item.id === task.id);
      if (updated) setTask(updated);
    }
    return r;
  }
  async function save(submit: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await persist(submit);
      setMessage(
        submit
          ? "Đã gửi báo cáo. Nhiệm vụ hoàn thành khi báo cáo đạt từ 100% được xác nhận."
          : "Đã lưu bản nháp. Chưa tính là gửi báo cáo.",
      );
      if (submit) setReadOnly(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function sendCoordination() {
    if (
      !task ||
      (!coordinationPendingId &&
        !coordinationText.trim() &&
        !coordinationFiles.length)
    ) {
      setError("Nhập nội dung hoặc chọn tệp cần gửi đơn vị chủ trì.");
      return;
    }
    if (!coordinationPendingId && coordinationFiles.length > 3) {
      setError("Mỗi lần gửi tối đa 3 tệp.");
      return;
    }
    if (coordinationFiles.some((file) => file.size > 25 * 1024 * 1024)) {
      setError("Mỗi tệp phối hợp tối đa 25 MB.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    let sentCommentId = coordinationPendingId;
    let uploaded = 0;
    try {
      if (!sentCommentId) {
        const comment = await api("comment", {
          taskId: task.id,
          text: coordinationText.trim() || "Đã gửi tệp phối hợp.",
          type: "coordination",
          unit: coordinationUnit,
        });
        sentCommentId = comment.id;
        setCoordinationPendingId(sentCommentId);
      }
      for (const file of coordinationFiles) {
        const fd = new FormData();
        fd.set("parentId", sentCommentId);
        fd.set("file", file);
        const response = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          headers: { "X-NS-Request": "1" },
          body: fd,
        });
        const result: any = await response.json();
        if (!response.ok) throw new Error(file.name + ": " + result.error);
        uploaded++;
      }
      const freshComments = await api(
        "comments?id=" + encodeURIComponent(task.id),
      );
      setCoordinationComments(freshComments);
      setCoordinationText("");
      setCoordinationFiles([]);
      setCoordinationPendingId("");
      setMessage(
        coordinationFiles.length
          ? `Đã gửi thông tin và ${uploaded} tệp phối hợp đến đơn vị chủ trì.`
          : "Đã gửi thông tin phối hợp đến đơn vị chủ trì.",
      );
      await load();
    } catch (e: any) {
      if (sentCommentId) {
        setCoordinationPendingId(sentCommentId);
        setCoordinationFiles((files) => files.slice(uploaded));
        const freshComments = await api(
          "comments?id=" + encodeURIComponent(task.id),
        ).catch(() => null);
        if (freshComments) setCoordinationComments(freshComments);
      }
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function includeCoordinationText(comment: any) {
    const section = `[Thông tin phối hợp từ ${comment.unitName || comment.author}]\n${comment.text}`;
    setForm((current: any) => ({
      ...current,
      result: [current.result?.trim(), section].filter(Boolean).join("\n\n"),
    }));
    setMessage("Đã chèn nội dung phối hợp vào kết quả báo cáo.");
  }
  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    if (evidence.length + files.length > 3) {
      setError(
        "Mỗi báo cáo tối đa 3 tệp minh chứng. Hiện có " +
          evidence.length +
          " tệp.",
      );
      return;
    }
    if (files.some((f) => f.size > 25 * 1024 * 1024)) {
      setError("Mỗi tệp minh chứng tối đa 25 MB.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    let saved: any;
    let count = 0;
    try {
      saved = await persist(false);
      const results = await Promise.allSettled(
        files.map(async (file) => {
          const fd = new FormData();
          fd.set("parentId", saved.id);
          fd.set("file", file);
          const response = await fetch("/api/upload", {
            method: "POST",
            credentials: "include",
            headers: { "X-NS-Request": "1" },
            body: fd,
          });
          const result: any = await response.json();
          if (!response.ok) throw new Error(file.name + ": " + result.error);
          count++;
          setMessage(`Đang tải tệp ${count}/${files.length}…`);
          return file;
        }),
      );
      const failed = results.flatMap((result, index) =>
        result.status === "rejected"
          ? [files[index].name + ": " + result.reason.message]
          : [],
      );
      if (failed.length)
        throw new Error(
          `Đã gắn ${count}/${files.length} tệp. Chưa tải được: ${failed.join("; ")}. Chọn lại các tệp này để thử lại.`,
        );
      setMessage(
        `Đã gắn ${count} tệp vào báo cáo nháp. Bấm “Gửi báo cáo” để chuyển cả nội dung và tệp sang hàng chờ phê duyệt.`,
      );
    } catch (e: any) {
      setError((count ? "Đã tải " + count + " tệp. " : "") + e.message);
    } finally {
      if (saved) {
        try {
          const fresh = await load();
          setForm(fresh.reports.find((r: any) => r.id === saved.id) || saved);
          if (fresh?.tasks && task) {
            const updated = fresh.tasks.find(
              (item: any) => item.id === task.id,
            );
            if (updated) setTask(updated);
          }
        } catch (e: any) {
          setError(e.message);
        }
      }
      setBusy(false);
    }
  }
  async function removeFile(id: string) {
    setBusy(true);
    setError("");
    try {
      await api("report-file-delete", { id });
      const fresh = await load();
      setForm(fresh.reports.find((r: any) => r.id === form.id) || form);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const evidence = form.id
    ? data.files.filter((f: any) => f.parent_id === form.id)
    : [];
  const legacy = task
    ? data.files.filter((f: any) => f.parent_id === task.id)
    : [];
  const nav = [
    ["dashboard", "Tổng quan"],
    ["tasks", "Nhiệm vụ được giao"],
    ["reports", "Lịch sử báo cáo"],
    ["notices", "Thông báo – Nhắc việc"],
    ["account", "Tài khoản"],
  ];
  const portalNotices = data.notices
    .filter(
      (n: any) =>
        n.category === "admin-directive" ||
        periodTasks.some((t: any) => t.id === n.taskId),
    )
    .sort((a: any, b: any) => {
      const priority =
        noticePriority(a.title).rank - noticePriority(b.title).rank;
      return priority || b.updated.localeCompare(a.updated);
    });
  const adminRequests = portalNotices.filter(isAdminRequestNotice);
  const directiveNotices = adminRequests.filter(
    (notice: any) =>
      notice.category === "admin-directive" &&
      !notice.readBy?.includes(user.id),
  );
  useEffect(() => {
    const current = new Set(
      data.notices
        .filter((notice: any) => notice.category === "admin-directive")
        .map((notice: any) => notice.id),
    );
    if (seenDirectiveIds.current === null) {
      seenDirectiveIds.current = current;
      return;
    }
    const seen = seenDirectiveIds.current;
    const newNotices = data.notices.filter(
      (notice: any) =>
        notice.category === "admin-directive" &&
        !seen?.has(notice.id) &&
        !notice.readBy?.includes(user.id),
    );
    for (const notice of newNotices) {
      toast("Có chỉ đạo nhắc việc mới", {
        description: notice.message,
        duration: 8000,
      });
      seen?.add(notice.id);
    }
    seenDirectiveIds.current = current;
  }, [data.notices, user.id]);
  const requestTaskIds = new Set(
    adminRequests
      .filter(
        (notice: any) =>
          notice.category === "report-supplement" ||
          /^báo cáo cần bổ sung/i.test(notice.title || ""),
      )
      .map((notice: any) => notice.taskId),
  );
  const reminders = tasks
    .filter((t: any) => {
      if (!user.units.includes(t.unit)) return false;
      const reportStatus = reportingStatus(t);
      const returnedReportAlreadyShown =
        reportStatus === "returned" && requestTaskIds.has(t.id);
      return (
        ["soon", "overdue"].includes(deadlineState(t)) ||
        ["missing", "late"].includes(reportStatus) ||
        (reportStatus === "returned" && !returnedReportAlreadyShown) ||
        (reports.some(
          (r: any) => r.taskId === t.id && r.state === "returned",
        ) &&
          !returnedReportAlreadyShown)
      );
    })
    .sort((a: any, b: any) => {
      const rank = (t: any) => {
        const state = reportingStatus(t);
        if (deadlineState(t) === "overdue") return 0;
        if (state === "missing") return 1;
        if (state === "returned") return 2;
        if (state === "late") return 3;
        return 4;
      };
      return rank(a) - rank(b) || a.due.localeCompare(b.due);
    });
  const leadRequests = adminRequests.filter((notice: any) => {
    const noticeTask = periodTasks.find((t: any) => t.id === notice.taskId);
    return noticeTask && user.units.includes(noticeTask.unit);
  });
  const partnerRequests = adminRequests.filter((notice: any) => {
    const noticeTask = periodTasks.find((t: any) => t.id === notice.taskId);
    return (
      noticeTask &&
      !user.units.includes(noticeTask.unit) &&
      coordinationUnits(user, noticeTask).length > 0
    );
  });
  const leadNotices = portalNotices.filter((notice: any) => {
    const noticeTask = periodTasks.find((t: any) => t.id === notice.taskId);
    return (
      noticeTask &&
      user.units.includes(noticeTask.unit) &&
      !isAdminRequestNotice(notice)
    );
  });
  const partnerNotices = portalNotices.filter((notice: any) => {
    const noticeTask = periodTasks.find((t: any) => t.id === notice.taskId);
    return (
      noticeTask &&
      !user.units.includes(noticeTask.unit) &&
      coordinationUnits(user, noticeTask).length > 0 &&
      !isAdminRequestNotice(notice)
    );
  });
  const unreadNoticeCount = portalNotices.filter(
    (notice: any) => !notice.readBy?.includes(user.id),
  ).length;
  const renderNotice = (n: any) => {
    const priority = noticePriority(n.title);
    const noticeTask = periodTasks.find((t: any) => t.id === n.taskId);
    return (
      <article className="panel unit-task-card" key={n.id}>
        <span
          className={"notice-priority-tag notice-priority-" + priority.tone}
        >
          {priority.label}
        </span>
        <h2
          className={
            "notice-priority-text notice-priority-text-" + priority.tone
          }
        >
          {assignmentNoticeTitle(n.title)}
        </h2>
        <small className="muted">
          {dates(n.updated)} ·{" "}
          {n.readBy?.includes(user.id) ? "Đã đọc" : "Chưa đọc"}
        </small>
        <div className="actions mt-3">
          {noticeTask && (
            <button
              className="btn small"
              onClick={() => {
                const report = reports.find(
                  (item: any) =>
                    item.taskId === noticeTask.id && item.state !== "draft",
                );
                openTask(noticeTask, report, !active(noticeTask));
              }}
            >
              {priority.tone === "coordination"
                ? "Mở ý kiến phối hợp"
                : n.category === "report-supplement"
                  ? "Mở báo cáo bổ sung"
                  : isAdminRequestNotice(n)
                    ? "Mở yêu cầu"
                    : "Mở nhiệm vụ"}
            </button>
          )}
          {!n.readBy?.includes(user.id) && (
            <button
              className="btn small"
              onClick={async () => {
                try {
                  await markNoticeRead(n.id);
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              Đã đọc
            </button>
          )}
        </div>
      </article>
    );
  };
  return (
    <div
      className="unit-portal"
      style={{ "--brand": data.settings.color } as React.CSSProperties}
    >
      <a className="unit-skip-link" href="#unit-main">
        Đến nội dung chính
      </a>
      <header className="unit-portal-header">
        <button
          className="unit-portal-brand"
          onClick={() => setTab("dashboard")}
        >
          <img
            src={data.settings.logo || "/bua-liem-nam-sach.png"}
            alt="Biểu trưng Đảng"
          />
          <span>
            <b>{data.settings.organization}</b>
            <small>BÁO CÁO KẾT QUẢ THỰC HIỆN</small>
          </span>
        </button>
        <div>
          <b>{user.name}</b>
          <button className="btn small" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </header>
      <nav className="unit-portal-nav" aria-label="Chức năng báo cáo đơn vị">
        {nav.map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            className={tab === key ? "active" : ""}
            onClick={() => {
              setTab(key);
              setTaskFilter("all");
              setUnitFilter("");
              setError("");
              setMessage("");
            }}
          >
            {label}
            {key === "notices" && unreadNoticeCount > 0 && (
              <b className="unit-notice-count">{unreadNoticeCount}</b>
            )}
          </button>
        ))}
      </nav>
      <main id="unit-main" className="unit-portal-main" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <h1>{nav.find((n) => n[0] === tab)?.[1]}</h1>
            <p>
              {tab === "dashboard"
                ? "Theo dõi tổng thể nhiệm vụ, tiến độ và báo cáo của đơn vị."
                : tab === "tasks"
                  ? "Chọn nhiệm vụ để nhập kết quả và gửi báo cáo."
                  : tab === "reports"
                    ? "Bản nháp, báo cáo đã gửi và các yêu cầu bổ sung."
                    : tab === "notices"
                      ? "Yêu cầu báo cáo và yêu cầu bổ sung từ trang chính được ưu tiên hiển thị tại đây."
                      : "Thông tin đăng nhập và mật khẩu của bạn."}
            </p>
          </div>
          {tab !== "account" && (
            <label className="form-field">
              <span>Kỳ theo dõi</span>
              <input
                type="month"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setTaskFilter("all");
                  setUnitFilter("");
                }}
              />
            </label>
          )}
        </div>
        {!task && error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        {!task && message && (
          <p className="hint" role="status">
            {message}
          </p>
        )}
        {tab === "dashboard" && (
          <ReportingDashboard
            tasks={leadTasks}
            partnerTasks={partnerTasks}
            reportingStatus={reportingStatus}
            onFilter={showTasks}
            onTask={(t: any) => openTask(t, undefined, !active(t))}
          />
        )}
        {tab === "tasks" && (
          <>
            {(taskFilter !== "all" || unitFilter) && (
              <div className="hint">
                Đang xem:{" "}
                {unitFilter
                  ? unitName(unitFilter)
                  : (
                      {
                        done: "Đã hoàn thành",
                        lead: "Nhiệm vụ chủ trì",
                        partner: "Nhiệm vụ phối hợp",
                        active: "Đang thực hiện",
                        overdue: "Quá hạn nhiệm vụ",
                        soon: "Sắp đến hạn",
                        missing: "Chậm báo cáo",
                        returned: "Cần bổ sung",
                      } as any
                    )[taskFilter]}{" "}
                <button className="btn small" onClick={() => showTasks("all")}>
                  Xem tất cả
                </button>
              </div>
            )}
            <input
              className="unit-task-search"
              aria-label="Tìm nhiệm vụ"
              placeholder="Tìm nội dung nhiệm vụ…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="unit-role-task-columns">
              {(taskFilter !== "partner" && (
                <section className="unit-role-task-card unit-role-lead">
                  <header>
                    <div>
                      <h2>Nhiệm vụ chủ trì</h2>
                      <p>Đơn vị cập nhật tiến độ và gửi báo cáo.</p>
                    </div>
                    <span
                      aria-label={`${visibleLeadTasks.length} nhiệm vụ chủ trì`}
                    >
                      {visibleLeadTasks.length}
                    </span>
                  </header>
                  <div className="unit-task-list unit-task-grid">
                    {visibleLeadTasks.map(renderTaskCard)}
                    {!visibleLeadTasks.length && (
                      <p className="panel unit-empty">
                        Không có nhiệm vụ chủ trì phù hợp trong kỳ này.
                      </p>
                    )}
                  </div>
                </section>
              )) ||
                null}
              {(taskFilter === "all" || taskFilter === "partner") && (
                <section className="unit-role-task-card unit-role-partner">
                  <header>
                    <div>
                      <h2>Nhiệm vụ phối hợp</h2>
                      <p>
                        Theo dõi tiến độ của chủ trì; gửi thông tin khi được yêu
                        cầu.
                      </p>
                    </div>
                    <span
                      aria-label={`${visiblePartnerTasks.length} nhiệm vụ phối hợp`}
                    >
                      {visiblePartnerTasks.length}
                    </span>
                  </header>
                  <div className="unit-task-list unit-task-grid">
                    {visiblePartnerTasks.map(renderTaskCard)}
                    {!visiblePartnerTasks.length && (
                      <p className="panel unit-empty">
                        Không có nhiệm vụ phối hợp phù hợp trong kỳ này.
                      </p>
                    )}
                  </div>
                </section>
              )}
            </div>
          </>
        )}
        {tab === "reports" && (
          <div className="unit-task-list">
            {reports.map((r: any) => {
              const t = data.tasks.find((t: any) => t.id === r.taskId);
              return (
                <article className="panel unit-task-card" key={r.id}>
                  <span
                    className={
                      "badge " +
                      (r.state === "returned"
                        ? "red"
                        : r.state === "confirmed"
                          ? "green"
                          : "amber")
                    }
                  >
                    {reportNames[r.state]}
                  </span>
                  <h2>{t?.title}</h2>
                  <p className="muted">
                    {unitName(r.unit)} · {r.authorName} ·{" "}
                    {dates(r.submitted || r.updated)}
                  </p>
                  <p className="unit-result-snippet">
                    {r.result || "Chưa nhập kết quả"}
                  </p>
                  {r.reason && (
                    <p className="hint amber">Yêu cầu bổ sung: {r.reason}</p>
                  )}
                  <div className="actions">
                    <button
                      className="btn"
                      onClick={() => openTask(t, r, true)}
                    >
                      Xem báo cáo
                    </button>
                    {editable(r) && active(t) && (
                      <button
                        className="btn primary"
                        onClick={() => openTask(t, r)}
                      >
                        Sửa báo cáo
                      </button>
                    )}
                    {r.state === "confirmed" && active(t) && (
                      <button
                        className="btn"
                        onClick={() => {
                          openTask(t);
                          setForm({
                            taskId: t.id,
                            unit: r.unit,
                            previousId: r.id,
                            progress: r.progress,
                            quantity: r.quantity,
                            result: "",
                            difficulty: "",
                            proposal: "",
                          });
                          setReadOnly(false);
                        }}
                      >
                        Lập báo cáo bổ sung
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
            {!reports.length && (
              <p className="panel unit-empty">Chưa có báo cáo trong kỳ này.</p>
            )}
          </div>
        )}
        {tab === "notices" && (
          <>
            {directiveNotices.length > 0 && (
              <section className="panel mb-4">
                <div className="panel-head">
                  <div>
                    <h2>Chỉ đạo từ trang chính</h2>
                    <p className="muted">
                      Nội dung áp dụng cho đơn vị của bạn.
                    </p>
                  </div>
                  <span className="badge amber">
                    {
                      directiveNotices.filter(
                        (notice: any) => !notice.readBy?.includes(user.id),
                      ).length
                    }{" "}
                    chưa đọc
                  </span>
                </div>
                <div className="panel-body">
                  {directiveNotices.map((notice: any) => (
                    <article
                      className={
                        "panel unit-task-card unit-directive-card" +
                        (notice.readBy?.includes(user.id)
                          ? ""
                          : " unit-directive-unread")
                      }
                      key={notice.id}
                    >
                      <span className="notice-priority-tag notice-priority-review">
                        {notice.readBy?.includes(user.id)
                          ? "Đã đọc"
                          : "Chỉ đạo mới"}
                      </span>
                      <h3 className="mt-2">Chỉ đạo nhắc việc</h3>
                      <p className="whitespace-pre-wrap">{notice.message}</p>
                      <small className="muted">{dates(notice.updated)}</small>
                      {!notice.readBy?.includes(user.id) && (
                        <div className="actions mt-3">
                          <button
                            className="btn small"
                            onClick={async () => {
                              try {
                                await markNoticeRead(notice.id);
                              } catch (e: any) {
                                setError(e.message);
                              }
                            }}
                          >
                            Đã đọc
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}
            <div className="unit-reminder-columns">
              <section className="unit-role-reminder-card unit-role-lead">
                <header>
                  <div>
                    <h2>Nhiệm vụ chủ trì</h2>
                    <p>
                      Đơn vị chịu trách nhiệm cập nhật tiến độ và gửi báo cáo.
                    </p>
                  </div>
                  <span aria-label={`${leadTasks.length} nhiệm vụ chủ trì`}>
                    {leadTasks.length}
                  </span>
                </header>
                <small className="unit-role-reminder-note">
                  {reminders.length} nhiệm vụ cần chú ý về thời hạn hoặc báo cáo
                </small>
                <div className="unit-task-list">
                  {leadRequests.length > 0 ? (
                    <div className="unit-role-notice-group unit-role-request-group">
                      <h3>Yêu cầu từ trang chính ({leadRequests.length})</h3>
                      {leadRequests.map(renderNotice)}
                    </div>
                  ) : (
                    <p className="unit-role-reminder-note">
                      Chưa có yêu cầu báo cáo hoặc bổ sung mới từ trang chính.
                    </p>
                  )}
                  {reminders.map((t: any) => {
                    const reportStatus = reportingStatus(t);
                    const overdue = deadlineState(t) === "overdue";
                    const tone =
                      overdue ||
                      reportStatus === "missing" ||
                      reportStatus === "returned"
                        ? "high"
                        : "review";
                    const label = overdue
                      ? "Quá hạn nhiệm vụ"
                      : reportStatus === "missing"
                        ? "Chậm báo cáo"
                        : reportStatus === "returned"
                          ? "Cần bổ sung"
                          : reportStatus === "late"
                            ? "Đã gửi chậm"
                            : "Sắp đến hạn";
                    return (
                      <article className="panel unit-task-card" key={t.id}>
                        <span
                          className={
                            "notice-priority-tag notice-priority-" + tone
                          }
                        >
                          {label}
                        </span>
                        <h2
                          className={
                            "notice-priority-text notice-priority-text-" + tone
                          }
                        >
                          {t.title}
                        </h2>
                        {["soon", "overdue"].includes(deadlineState(t)) && (
                          <p>
                            <span
                              className={
                                "badge " +
                                (deadlineState(t) === "overdue"
                                  ? "red"
                                  : "amber")
                              }
                            >
                              {deadlineState(t) === "overdue"
                                ? "Quá hạn nhiệm vụ"
                                : "Sắp đến hạn nhiệm vụ"}
                            </span>{" "}
                            Hạn: {dates(t.due)}
                          </p>
                        )}
                        <p>
                          <b>Báo cáo:</b> {reportingNames[reportingStatus(t)]} ·
                          Hạn kỳ này:{" "}
                          {dates(
                            reportWindow(t, new Date(), data.settings).deadline,
                          )}
                        </p>
                        {reports
                          .filter(
                            (r: any) =>
                              r.taskId === t.id && r.state === "returned",
                          )
                          .map((r: any) => (
                            <p className="hint amber" key={r.id}>
                              {r.reason || "Cần bổ sung báo cáo"}
                            </p>
                          ))}
                        <button
                          className="btn primary"
                          onClick={() => openTask(t, undefined, !active(t))}
                        >
                          Xem / cập nhật báo cáo
                        </button>
                      </article>
                    );
                  })}
                  {leadNotices.length > 0 && (
                    <div className="unit-role-notice-group">
                      <h3>Thông báo liên quan ({leadNotices.length})</h3>
                      {leadNotices.map(renderNotice)}
                    </div>
                  )}
                  {!reminders.length &&
                    !leadNotices.length &&
                    !leadRequests.length && (
                      <p className="panel unit-empty">
                        Chưa có nhiệm vụ chủ trì cần nhắc việc trong kỳ này.
                      </p>
                    )}
                </div>
              </section>
              <section className="unit-role-reminder-card unit-role-partner">
                <header>
                  <div>
                    <h2>Nhiệm vụ phối hợp</h2>
                    <p>
                      Theo dõi tiến độ; chỉ gửi thông tin khi nhiệm vụ yêu cầu.
                    </p>
                  </div>
                  <span aria-label={`${partnerTasks.length} nhiệm vụ phối hợp`}>
                    {partnerTasks.length}
                  </span>
                </header>
                <small className="unit-role-reminder-note">
                  Không tính là báo cáo chủ trì của đơn vị
                </small>
                <div className="unit-task-list">
                  {partnerRequests.length > 0 && (
                    <div className="unit-role-notice-group unit-role-request-group">
                      <h3>Yêu cầu từ trang chính ({partnerRequests.length})</h3>
                      {partnerRequests.map(renderNotice)}
                    </div>
                  )}
                  {partnerTasks.map((t: any) => (
                    <article
                      className="panel unit-task-card"
                      key={"partner-" + t.id}
                    >
                      <span className="notice-priority-tag notice-priority-coordination">
                        Phối hợp
                      </span>
                      <h2>{t.title}</h2>
                      <p>
                        Đơn vị chủ trì: <b>{unitName(t.unit)}</b>
                      </p>
                      <p>
                        Tiến độ chủ trì cập nhật: <b>{t.progress || 0}%</b> ·
                        Trạng thái: <b>{stateNames[t.status] || t.status}</b>
                      </p>
                      <p>Thời hạn: {dates(t.due)}</p>
                      <button
                        className="btn"
                        onClick={() => openTask(t, undefined, !active(t))}
                      >
                        {requiresPartnerUpdate(t)
                          ? "Xem tiến độ / gửi thông tin"
                          : "Xem tiến độ"}
                      </button>
                    </article>
                  ))}
                  {partnerNotices.length > 0 && (
                    <div className="unit-role-notice-group">
                      <h3>Thông báo liên quan ({partnerNotices.length})</h3>
                      {partnerNotices.map(renderNotice)}
                    </div>
                  )}
                  {!partnerTasks.length &&
                    !partnerNotices.length &&
                    !partnerRequests.length && (
                      <p className="panel unit-empty">
                        Không có nhiệm vụ phối hợp trong kỳ này.
                      </p>
                    )}
                </div>
              </section>
            </div>
          </>
        )}
        {tab === "account" && (
          <section className="panel unit-task-card">
            <h2>{user.name}</h2>
            <p>
              Tên đăng nhập: <b>{user.username}</b>
            </p>
            <p>Đơn vị được cấp quyền: {user.units.map(unitName).join("; ")}</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api("password", password);
                  await onLogout();
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>Đổi mật khẩu</h2>
              <label className="form-field">
                <span>Mật khẩu hiện tại</span>
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={password.old}
                  onChange={(e) =>
                    setPassword({ ...password, old: e.target.value })
                  }
                />
              </label>
              <label className="form-field">
                <span>Mật khẩu mới (tối thiểu 12 ký tự)</span>
                <input
                  required
                  minLength={12}
                  type="password"
                  autoComplete="new-password"
                  value={password.password}
                  onChange={(e) =>
                    setPassword({ ...password, password: e.target.value })
                  }
                />
              </label>
              <button className="btn primary" disabled={busy}>
                Lưu mật khẩu mới
              </button>
            </form>
          </section>
        )}
      </main>
      <Dialog
        open={!!task}
        onOpenChange={(v) => {
          if (!v && !busy) setTask(null);
        }}
      >
        <DialogContent
          className="unit-report-dialog"
          customPosition
          style={dialogViewport}
          showCloseButton={false}
          onOpenAutoFocus={(e) => {
            if (window.matchMedia("(max-width: 640px)").matches)
              e.preventDefault();
          }}
        >
          <button
            className="unit-dialog-close"
            aria-label="Đóng báo cáo"
            disabled={busy}
            onClick={() => setTask(null)}
          >
            ×
          </button>
          <DialogHeader>
            <DialogTitle>
              {readOnly ? "Xem báo cáo" : "Cập nhật báo cáo"}
            </DialogTitle>
            <DialogDescription>
              Nhập kết quả, bổ sung minh chứng phù hợp và gửi đến người xác
              nhận.
            </DialogDescription>
          </DialogHeader>
          {task && (
            <div className="unit-report-form">
              <section className="unit-task-info">
                <h2>{task.title}</h2>
                <p>
                  Trạng thái nhiệm vụ:{" "}
                  <b>{stateNames[task.status] || task.status}</b>
                </p>
                <p>
                  Hạn hoàn thành: <b>{dates(task.due)}</b>
                </p>
                {Number(task.target) > 0 && (
                  <p>
                    Chỉ tiêu được giao:{" "}
                    <b>
                      {task.target} {task.measure}
                    </b>
                  </p>
                )}
                <p>{reportScheduleLabel(task, data.settings)}</p>
              </section>
              {error && (
                <div className="error-box" role="alert">
                  {error}
                </div>
              )}
              {message && (
                <p className="hint" role="status">
                  {message}
                </p>
              )}
              {form.reason && (
                <p className="hint amber">Yêu cầu bổ sung: {form.reason}</p>
              )}
              {!user.units.includes(task.unit) && (
                <section className="unit-coordination-panel">
                  <h2>Thông tin phối hợp</h2>
                  <p>
                    Đơn vị nhận thông tin: <b>{unitName(task.unit)}</b>
                  </p>
                  <p>
                    Tiến độ do đơn vị chủ trì cập nhật:{" "}
                    <b>{task.progress || 0}%</b>
                    {form.result && (
                      <span className="block mt-1 whitespace-pre-wrap">
                        {form.result}
                      </span>
                    )}
                  </p>
                  <div className="unit-coordination-history">
                    {coordinationComments
                      .filter((comment: any) => comment.type !== "direction")
                      .sort((a: any, b: any) =>
                        b.updated.localeCompare(a.updated),
                      )
                      .map((comment: any) => (
                        <article key={comment.id}>
                          <b>{comment.unitName || comment.author}</b>
                          <small>{dates(comment.updated)}</small>
                          <p className="whitespace-pre-wrap">{comment.text}</p>
                          {!!comment.files?.length && (
                            <div className="unit-coordination-files">
                              {comment.files.map((file: any) => (
                                <a
                                  className="btn small"
                                  key={file.id}
                                  href={`/api/file?id=${encodeURIComponent(file.id)}`}
                                  download={file.name}
                                  title={`Tải ${file.name}`}
                                >
                                  <Download size={14} /> Tải về
                                  <span className="max-w-[240px] truncate">
                                    {file.name}
                                  </span>
                                </a>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    {!coordinationComments.some(
                      (comment: any) => comment.type !== "direction",
                    ) && <p className="muted">Chưa có thông tin phối hợp.</p>}
                  </div>
                  {requiresPartnerUpdate(task) &&
                    coordinationUnits(user, task).length > 0 && (
                      <div className="unit-coordination-compose">
                        {coordinationUnits(user, task).length > 1 && (
                          <label className="form-field">
                            <span>Đơn vị phối hợp gửi thông tin</span>
                            <select
                              value={coordinationUnit}
                              onChange={(e) =>
                                setCoordinationUnit(e.target.value)
                              }
                            >
                              {coordinationUnits(user, task).map(
                                (unitId: string) => (
                                  <option value={unitId} key={unitId}>
                                    {unitName(unitId)}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                        )}
                        <label className="form-field">
                          <span>Thông tin gửi đơn vị chủ trì</span>
                          <textarea
                            rows={4}
                            value={coordinationText}
                            onChange={(e) =>
                              setCoordinationText(e.target.value)
                            }
                            placeholder="Nêu kết quả phối hợp, nội dung đã thực hiện hoặc khó khăn cần đơn vị chủ trì tổng hợp…"
                          />
                        </label>
                        <label className="form-field">
                          <span>Tệp gửi kèm (tối đa 3 tệp, 25 MB/tệp)</span>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.mp4,.webm,.zip,.rar,.7z"
                            onChange={(event) =>
                              setCoordinationFiles(
                                Array.from(event.target.files || []),
                              )
                            }
                          />
                          <small className="muted">
                            Có thể gửi nội dung đánh trực tiếp, tệp đính kèm
                            hoặc cả hai.
                          </small>
                          {!!coordinationFiles.length && (
                            <small>
                              {coordinationFiles
                                .map((file) => file.name)
                                .join(" · ")}
                            </small>
                          )}
                        </label>
                        <button
                          className="btn primary"
                          disabled={
                            busy ||
                            (!coordinationPendingId &&
                              !coordinationText.trim() &&
                              !coordinationFiles.length)
                          }
                          onClick={sendCoordination}
                        >
                          {coordinationPendingId
                            ? "Gửi tiếp tệp còn lại"
                            : `Gửi cho ${unitName(task.unit)}`}
                        </button>
                      </div>
                    )}
                  {!requiresPartnerUpdate(task) && (
                    <p className="muted text-sm">
                      Nhiệm vụ này chưa yêu cầu đơn vị phối hợp gửi thông tin.
                    </p>
                  )}
                </section>
              )}
              {user.units.includes(task.unit) &&
                requiresPartnerUpdate(task) &&
                !!task.partners?.length && (
                  <section className="unit-coordination-panel">
                    <h2>Thông tin từ đơn vị phối hợp</h2>
                    <p>
                      Các ý kiến dưới đây được gửi trực tiếp về{" "}
                      <b>{unitName(task.unit)}</b> để tổng hợp.
                    </p>
                    <div className="unit-coordination-history">
                      {coordinationComments
                        .filter((comment: any) => comment.type !== "direction")
                        .sort((a: any, b: any) =>
                          b.updated.localeCompare(a.updated),
                        )
                        .map((comment: any) => (
                          <article key={comment.id}>
                            <b>{comment.unitName || comment.author}</b>
                            <small>{dates(comment.updated)}</small>
                            <p className="whitespace-pre-wrap">
                              {comment.text}
                            </p>
                            {!!comment.files?.length && (
                              <div className="unit-coordination-files">
                                {comment.files.map((file: any) => (
                                  <a
                                    className="btn small"
                                    key={file.id}
                                    href={`/api/file?id=${encodeURIComponent(file.id)}`}
                                    download={file.name}
                                    title={`Tải ${file.name}`}
                                  >
                                    <Download size={14} /> Tải về
                                    <span className="max-w-[240px] truncate">
                                      {file.name}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            )}
                            {comment.text?.trim() &&
                              canReport(user, task) &&
                              !readOnly && (
                                <button
                                  className="btn mt-2"
                                  type="button"
                                  onClick={() =>
                                    includeCoordinationText(comment)
                                  }
                                >
                                  Chèn nội dung vào báo cáo
                                </button>
                              )}
                          </article>
                        ))}
                      {!coordinationComments.some(
                        (comment: any) => comment.type !== "direction",
                      ) && (
                        <p className="muted">
                          Chưa có thông tin từ các đơn vị phối hợp.
                        </p>
                      )}
                    </div>
                  </section>
                )}
              {canReport(user, task) && (
                <fieldset disabled={readOnly || busy}>
                  {reportingUnits(user, task).length > 1 && !form.id && (
                    <label className="form-field">
                      <span>Đơn vị báo cáo</span>
                      <select
                        value={form.unit}
                        onChange={(e) => change("unit", e.target.value)}
                      >
                        {reportingUnits(user, task).map((id: string) => (
                          <option value={id} key={id}>
                            {unitName(id)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <p className="muted">Báo cáo của: {unitName(form.unit)}</p>
                  <label className="form-field">
                    <span>KẾT QUẢ THỰC HIỆN *</span>
                    <textarea
                      rows={8}
                      maxLength={100000}
                      placeholder="Trình bày việc đã làm, kết quả đạt được, công việc đang triển khai và nội dung chưa hoàn thành…"
                      value={form.result || ""}
                      onChange={(e) => change("result", e.target.value)}
                    />
                  </label>
                  {Number(task.target) > 0 &&
                    !isPercentageProgressTask(task) && (
                      <section className="unit-target">
                        <label className="form-field">
                          <span>
                            Số lượng đã thực hiện ({task.measure || "đơn vị"})
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={form.quantity ?? 0}
                            onChange={(e) => change("quantity", e.target.value)}
                          />
                        </label>
                        <p>
                          <b>
                            {Number(form.quantity || 0).toLocaleString("vi-VN")}
                            /{Number(task.target).toLocaleString("vi-VN")}{" "}
                            {task.measure}
                          </b>{" "}
                          · Đạt{" "}
                          <b>
                            {(
                              (Number(form.quantity || 0) / task.target) *
                              100
                            ).toLocaleString("vi-VN", {
                              maximumFractionDigits: 1,
                            })}
                            %
                          </b>
                        </p>
                      </section>
                    )}
                  {(Number(task.target) <= 0 ||
                    isPercentageProgressTask(task)) && (
                    <label className="form-field">
                      <span>Tiến độ nội dung đã thực hiện (%)</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={form.progress ?? 0}
                        onChange={(e) => change("progress", e.target.value)}
                      />
                      <small className="muted">
                        Nhập tỷ lệ phần trăm nội dung đã thực hiện; có thể vượt
                        100% nếu kết quả cao hơn kế hoạch.
                      </small>
                    </label>
                  )}
                  <label className="form-field">
                    <span>KHÓ KHĂN, VƯỚNG MẮC (NẾU CÓ)</span>
                    <textarea
                      rows={3}
                      value={form.difficulty || ""}
                      onChange={(e) => change("difficulty", e.target.value)}
                    />
                  </label>
                  <label className="form-field">
                    <span>ĐỀ XUẤT, KIẾN NGHỊ (NẾU CÓ)</span>
                    <textarea
                      rows={3}
                      value={form.proposal || ""}
                      onChange={(e) => change("proposal", e.target.value)}
                    />
                  </label>
                </fieldset>
              )}
              <section>
                <h2>Minh chứng</h2>
                <p className="muted">
                  {evidenceLabels[task.evidenceRequirement || "none"]}. Ảnh JPG,
                  PNG, WEBP; văn bản PDF, Word, Excel; file nén ZIP, RAR, 7Z.
                  Tối đa 3 tệp/báo cáo, 25 MB/tệp.
                </p>
                {!readOnly && (
                  <label className="unit-file-picker">
                    <span>
                      Minh chứng đã tải: {evidence.length}/3 tệp — chọn tệp để
                      bổ sung
                    </span>
                    <input
                      aria-label="Tải minh chứng báo cáo"
                      type="file"
                      multiple
                      disabled={busy || evidence.length >= 3}
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        e.target.value = "";
                        uploadFiles(files);
                      }}
                    />
                  </label>
                )}
                <div className="unit-evidence-list">
                  {evidence.map((f: any) => (
                    <article key={f.id}>
                      {f.mime.startsWith("image/") && (
                        <img
                          src={"/api/file?id=" + f.id + "&preview=1"}
                          alt={f.name}
                        />
                      )}
                      <div>
                        <b>{f.name}</b>
                        <small>{(f.size / 1024).toFixed(0)} KB</small>
                        <div className="actions">
                          <a
                            className="btn small"
                            target="_blank"
                            rel="noopener noreferrer"
                            href={"/api/file?id=" + f.id + "&preview=1"}
                          >
                            {f.mime.startsWith("image/") ||
                            f.mime === "application/pdf"
                              ? "Xem trước"
                              : "Tải để xem"}
                          </a>
                          <a
                            className="btn small"
                            href={`/api/file?id=${encodeURIComponent(f.id)}`}
                            download={f.name}
                            title={`Tải ${f.name} về máy`}
                          >
                            <Download size={14} /> Tải về
                          </a>
                          {!readOnly &&
                            form.state === "draft" &&
                            !form.everSubmitted &&
                            !form.submitted && (
                              <button
                                className="btn small"
                                disabled={busy}
                                onClick={() => removeFile(f.id)}
                              >
                                Xóa tệp chưa gửi
                              </button>
                            )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {!evidence.length && (
                  <p className="muted">Chưa có tệp đính kèm báo cáo này.</p>
                )}
                {legacy.length > 0 && (
                  <details>
                    <summary>
                      Minh chứng nhiệm vụ đã lưu trước đây ({legacy.length})
                    </summary>
                    {legacy.map((f: any) => (
                      <a
                        className="btn small mt-2"
                        key={f.id}
                        href={`/api/file?id=${encodeURIComponent(f.id)}`}
                        download={f.name}
                        title={`Tải ${f.name} về máy`}
                      >
                        <Download size={14} /> Tải về
                        <span className="max-w-[280px] truncate">{f.name}</span>
                      </a>
                    ))}
                  </details>
                )}
              </section>
              {form.id && (
                <div>
                  <button
                    className="btn small"
                    disabled={busy}
                    onClick={async () => {
                      setError("");
                      try {
                        setHistory(await api("history?id=" + form.id));
                        setShowHistory(!showHistory);
                      } catch (e: any) {
                        setError(e.message);
                      }
                    }}
                  >
                    Lịch sử cập nhật
                  </button>
                  {showHistory && (
                    <div className="timeline">
                      {history.map((h: any) => (
                        <article key={h.id}>
                          <b>{h.action}</b>
                          <p>
                            {h.actor} · {dates(h.time)}
                          </p>
                          {h.before && (
                            <details>
                              <summary>Xem nội dung trước khi sửa</summary>
                              <p className="whitespace-pre-wrap">
                                {JSON.parse(h.before).result ||
                                  "Chưa nhập kết quả"}
                              </p>
                              <p>{JSON.parse(h.before).difficulty}</p>
                              <p>{JSON.parse(h.before).proposal}</p>
                            </details>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!readOnly && (
                <div className="form-footer">
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => save(false)}
                  >
                    {busy ? "Đang lưu…" : "Lưu nháp"}
                  </button>
                  <button
                    className="btn primary"
                    disabled={busy || !form.result?.trim()}
                    onClick={() => save(true)}
                  >
                    Gửi báo cáo
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
