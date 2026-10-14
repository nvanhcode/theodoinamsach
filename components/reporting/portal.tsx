"use client";
import React, { useState, useEffect } from "react";
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
  evidenceLabels,
  assignmentNoticeTitle,
} from "@/lib/report-access";
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
export function ReportingPortal({ data, user, load, api, onLogout }: any) {
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
    [showHistory, setShowHistory] = useState(false),
    [password, setPassword] = useState({ old: "", password: "" });
  const [dialogViewport, setDialogViewport] = useState<React.CSSProperties>({});
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
        (r.author === user.id || user.units.includes(r.unit)),
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
  const visibleTasks = tasks.filter(
    (t: any) =>
      matchesSummary(t, taskFilter, reportingStatus) &&
      (!unitFilter ||
        t.unit === unitFilter ||
        (t.partners || []).includes(unitFilter)),
  );
  const showTasks = (key: string, unit = "") => {
    setTaskFilter(key);
    setUnitFilter(unit);
    setSearch("");
    setTab("tasks");
  };
  const change = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const openTask = (t: any, r?: any, view = false) => {
    const draft =
      r || reports.find((r: any) => r.taskId === t.id && editable(r));
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
  };
  async function persist(submit: boolean) {
    const r = await api("report", { ...form, taskId: task.id, submit });
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
          ? "Đã gửi báo cáo. Nhiệm vụ chỉ hoàn thành sau khi được xác nhận."
          : "Đã lưu bản nháp. Chưa tính là gửi báo cáo.",
      );
      if (submit) setReadOnly(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
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
      for (const file of files) {
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
      }
      setMessage(
        "Đã tải " + count + " tệp vào bản nháp. Bấm Gửi báo cáo để gửi.",
      );
    } catch (e: any) {
      setError((count ? "Đã tải " + count + " tệp. " : "") + e.message);
    } finally {
      if (saved) {
        try {
          const fresh = await load();
          setForm(fresh.reports.find((r: any) => r.id === saved.id) || saved);
          if (fresh?.tasks && task) {
            const updated = fresh.tasks.find((item: any) => item.id === task.id);
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
    ["reports", "Báo cáo đã gửi"],
    ["notices", "Thông báo – Nhắc việc"],
    ["account", "Tài khoản"],
  ];
  const reminders = tasks.filter(
    (t: any) =>
      ["soon", "overdue"].includes(deadlineState(t)) ||
      ["missing", "returned"].includes(reportingStatus(t)) ||
      reports.some((r: any) => r.taskId === t.id && r.state === "returned"),
  );
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
                      ? "Theo dõi riêng thời hạn nhiệm vụ và thời hạn báo cáo."
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
            tasks={periodTasks}
            reports={reports}
            units={data.units.filter((u: any) => user.units.includes(u.id))}
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
            <div className="unit-task-list unit-task-grid">
              {visibleTasks.map((t: any) => (
                <article className="panel unit-task-card" key={t.id}>
                  <h2>{t.title}</h2>
                  <p className="muted">
                    Chủ trì: {unitName(t.unit)}
                    {!user.units.includes(t.unit)
                      ? " · Đơn vị bạn phối hợp thực hiện"
                      : ""}
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
                      <b>Thực hiện:</b> {stateNames[t.status]} ·{" "}
                      {t.progress || 0}% đã xác nhận
                    </span>
                    <span>
                      <b>Báo cáo:</b> {reportingNames[reportingStatus(t)]}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={
                      "unit-progress-link " +
                      (deadlineState(t) === "overdue" ? "overdue" : "")
                    }
                    aria-label={"Xem phần việc và báo cáo: " + t.title}
                    onClick={() => openTask(t, undefined, !active(t))}
                  >
                    <span className="unit-progress-caption">
                      <b>Tiến độ đã xác nhận</b>
                      <strong>
                        {Math.min(100, Math.max(0, Number(t.progress) || 0))}%
                      </strong>
                    </span>
                    <progress
                      max={100}
                      value={Math.min(
                        100,
                        Math.max(0, Number(t.progress) || 0),
                      )}
                      aria-label="Tiến độ nhiệm vụ đã xác nhận"
                    />
                    <span className="unit-progress-hint">
                      Bấm để xem phần việc và cập nhật báo cáo →
                    </span>
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => openTask(t, undefined, !active(t))}
                  >
                    {active(t) ? "Cập nhật báo cáo" : "Xem báo cáo"}
                  </button>
                </article>
              ))}
            </div>
            {!visibleTasks.length && (
              <p className="panel unit-empty">
                Không có nhiệm vụ phù hợp trong kỳ này.
              </p>
            )}
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
          <div className="unit-task-list">
            {reminders.map((t: any) => (
              <article className="panel unit-task-card" key={t.id}>
                <h2>{t.title}</h2>
                {["soon", "overdue"].includes(deadlineState(t)) && (
                  <p>
                    <span
                      className={
                        "badge " +
                        (deadlineState(t) === "overdue" ? "red" : "amber")
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
                  <b>Báo cáo:</b> {reportingNames[reportingStatus(t)]} · Hạn kỳ
                  này:{" "}
                  {dates(reportWindow(t, new Date(), data.settings).deadline)}
                </p>
                {reports
                  .filter(
                    (r: any) => r.taskId === t.id && r.state === "returned",
                  )
                  .map((r: any) => (
                    <p className="hint amber" key={r.id}>
                      {r.reason || "Cần bổ sung báo cáo"}
                    </p>
                  ))}
                <button className="btn primary" onClick={() => openTask(t)}>
                  Xem / cập nhật báo cáo
                </button>
              </article>
            ))}
            {data.notices
              .filter((n: any) => tasks.some((t: any) => t.id === n.taskId))
              .sort((a: any, b: any) => b.updated.localeCompare(a.updated))
              .map((n: any) => (
                <article className="panel unit-task-card" key={n.id}>
                  <p>{assignmentNoticeTitle(n.title)}</p>
                  <small className="muted">{dates(n.updated)}</small>
                </article>
              ))}
            {!reminders.length && (
              <p className="panel unit-empty">
                Không có nhiệm vụ sắp đến hạn, quá hạn hoặc cần bổ sung trong kỳ
                này.
              </p>
            )}
          </div>
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
                {Number(task.target) > 0 && (
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
                        {Number(form.quantity || 0).toLocaleString("vi-VN")}/
                        {Number(task.target).toLocaleString("vi-VN")}{" "}
                        {task.measure}
                      </b>{" "}
                      · Đạt{" "}
                      <b>
                        {(
                          (Number(form.quantity || 0) / task.target) *
                          100
                        ).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
                        %
                      </b>
                    </p>
                  </section>
                )}
                <label className="form-field">
                  <span>Tiến độ thực hiện (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.progress ?? 0}
                    onChange={(e) => change("progress", e.target.value)}
                  />
                </label>
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
                        className="block underline"
                        key={f.id}
                        target="_blank"
                        rel="noopener noreferrer"
                        href={"/api/file?id=" + f.id}
                      >
                        {f.name}
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
