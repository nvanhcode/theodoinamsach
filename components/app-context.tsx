"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { toast } from "sonner";
import {
  api,
  blankData,
  defaults,
  has,
  office,
  approver,
  canReport,
  deadlineState,
  reportState,
  weekWindow,
  localDate,
  deadlineLabels,
  fmt,
} from "@/components/common-ui";
import { reminderPriority } from "@/lib/reminder-priority";
import { matchesProgressStatus } from "@/lib/progress-summary";
import { saveImportRows } from "@/lib/save-import";
import { useRouter } from "next/navigation";
import { buildTaskTemplate, parseTaskExcel } from "@/lib/task-excel";
import {
  readyTemplateBytes,
  readyTemplateName,
  excelMime,
} from "@/lib/ready-task-template";

export const AppContext = createContext<any>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

export function AppProvider({
  children,
  initialPage,
}: {
  children: React.ReactNode;
  initialPage?: string;
}) {
  let router: any = null;
  try {
    router = useRouter();
  } catch {}

  const getInitialRoute = () => {
    if (initialPage) {
      if (initialPage === "documents")
        return { page: "tasks", sub: "documents", adminTab: "profile" };
      if (initialPage === "units")
        return { page: "admin", adminTab: "units", sub: "tasks" };
      if (initialPage === "accounts")
        return { page: "admin", adminTab: "users", sub: "tasks" };
      return { page: initialPage, sub: "tasks", adminTab: "profile" };
    }
    if (typeof window !== "undefined") {
      const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get("tab") || "units";
      if (path === "documents")
        return { page: "tasks", sub: "documents", adminTab: "profile" };
      if (path === "units")
        return { page: "admin", adminTab: "units", sub: "tasks" };
      if (path === "accounts")
        return { page: "admin", adminTab: "users", sub: "tasks" };
      if (
        [
          "dashboard",
          "tasks",
          "progress",
          "notices",
          "reports",
          "admin",
          "login",
        ].includes(path)
      ) {
        return { page: path, sub: "tasks", adminTab: tabParam };
      }
    }
    return { page: "dashboard", sub: "tasks", adminTab: "profile" };
  };

  const initialRoute = getInitialRoute();
  const [data, setData] = useState<any>(blankData);
  const [user, setUser] = useState<any>(null);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [initialized, setInitialized] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(initialRoute.page);
  const [month, setMonth] = useState("2026-10");
  const [unit, setUnit] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("unit") || "";
    }
    return "";
  });
  const [group, setGroup] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("group") || "";
    }
    return "";
  });
  const [status, setStatus] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("status") || "";
    }
    return "";
  });
  const [search, setSearch] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("search") || "";
    }
    return "";
  });
  const [documentFilter, setDocumentFilter] = useState("");
  const [sort, setSort] = useState("due");
  const [pageNumber, setPageNumber] = useState(1);
  const [sub, setSub] = useState(initialRoute.sub);
  const [adminTab, setAdminTab] = useState(initialRoute.adminTab || "profile");
  const [unitGroup, setUnitGroup] = useState("");

  const [modal, setModal] = useState("");
  const [form, setForm] = useState<any>({ username: "admin" });
  const [selected, setSelected] = useState<any>(null);
  const [detailTab, setDetailTab] = useState("info");
  const [history, setHistory] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [columns, setColumns] = useState([
    "number",
    "document",
    "title",
    "assignedDate",
    "due",
    "unit",
    "lastReport",
    "result",
    "progress",
    "status",
    "difficulty",
    "proposal",
    "note",
  ]);
  const [range, setRange] = useState("month");
  const [fromDate, setFromDate] = useState("2026-10-01");
  const [toDate, setToDate] = useState("2026-10-31");

  const [templateDownload, setTemplateDownload] = useState<any>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importPhase, setImportPhase] = useState("");
  const importSaving = useRef(false);
  const [importSaveProgress, setImportSaveProgress] = useState({
    finished: 0,
    total: 0,
  });
  const downloadUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      downloadUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const [reminderFilter, setReminderFilter] = useState("");
  const [importAction, setImportAction] = useState("assign");
  const loadSequence = useRef(0);

  const cfg = data.settings || defaults;
  const brandLogo = cfg.logo || "/bua-liem-nam-sach.png";
  const tasks = data.tasks as any[];
  const selectedTask = selected
    ? tasks.find((t) => t.id === selected.id) || selected
    : null;

  async function load() {
    const sequence = ++loadSequence.current;
    let d;
    try {
      d = await api("data");
    } catch (e: any) {
      if (e.status === 401 && sequence === loadSequence.current) {
        setUser(null);
        setData(blankData);
        setModal("");
        setSelected(null);
        setError(
          "Phiên đăng nhập đã hết hoặc chưa được trình duyệt lưu. Vui lòng đăng nhập lại.",
        );
      }
      throw e;
    }
    if (sequence === loadSequence.current) {
      setData(d);
      setUser(d.user);
    }
    return d;
  }

  async function markNoticeRead(noticeId: string) {
    if (!user?.id) return;
    const alreadyRead = data.notices.some(
      (notice: any) =>
        notice.id === noticeId && notice.readBy?.includes(user.id),
    );
    if (alreadyRead) return;

    // Update shared state immediately so every badge/count drops together.
    setData((current: any) => ({
      ...current,
      notices: current.notices.map((notice: any) =>
        notice.id === noticeId
          ? {
              ...notice,
              readBy: Array.from(new Set([...(notice.readBy || []), user.id])),
            }
          : notice,
      ),
    }));
    try {
      const saved = await api("notice", { id: noticeId });
      setData((current: any) => ({
        ...current,
        notices: current.notices.map((notice: any) =>
          notice.id === noticeId ? saved : notice,
        ),
      }));
    } catch (error) {
      // Keep any other notice updates while reverting only this optimistic read.
      setData((current: any) => ({
        ...current,
        notices: current.notices.map((notice: any) =>
          notice.id === noticeId
            ? {
                ...notice,
                readBy: (notice.readBy || []).filter(
                  (reader: string) => reader !== user.id,
                ),
              }
            : notice,
        ),
      }));
      throw error;
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const b = await api("bootstrap");
        setInitialized(true);
        if (b.initialized) {
          try {
            const m = await api("me");
            setUser(m.user);
            if (!m.user.mustChange) await load();
          } catch (e: any) {
            if (e.status !== 401) throw e;
          }
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user || user.mustChange) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load().catch(() => {});
    }, 15000);
    const refresh = () => {
      if (document.visibilityState === "visible") load().catch(() => {});
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
      const searchParams = new URLSearchParams(window.location.search);

      if (path === "documents") {
        setPage("tasks");
        setSub("documents");
      } else if (path === "units") {
        setPage("admin");
        setAdminTab("units");
      } else if (path === "accounts") {
        setPage("admin");
        setAdminTab("users");
      } else if (
        [
          "dashboard",
          "tasks",
          "progress",
          "notices",
          "reports",
          "admin",
          "login",
        ].includes(path)
      ) {
        setPage(path);
        if (path === "tasks") setSub("tasks");
        if (path === "admin") {
          setAdminTab(searchParams.get("tab") || "units");
        }
      } else {
        setPage("dashboard");
      }

      setStatus(searchParams.get("status") || "");
      setUnit(searchParams.get("unit") || "");
      setGroup(searchParams.get("group") || "");
      setSearch(searchParams.get("search") || "");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    setPageNumber(1);
  }, [month, unit, status, search, group, page, range]);

  useEffect(() => {
    if (!selectedTask) return;
    if (detailTab === "history")
      api("history?id=" + selectedTask.id)
        .then(setHistory)
        .catch((e) => toast.error(e.message));
    if (detailTab === "comments")
      api("comments?id=" + selectedTask.id)
        .then(setComments)
        .catch((e) => toast.error(e.message));
  }, [detailTab, selectedTask?.id, data]);

  async function run(
    fn: () => Promise<any>,
    message = "Đã lưu vào hệ thống.",
    close = true,
    reload = true,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      if (reload && user && !user.mustChange) await load();
      toast.success(message);
      if (close) {
        setModal("");
        setForm({});
      }
      return result;
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  const change = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const open = (m: string, f: any = {}) => {
    setForm(f);
    setModal(m);
    setError("");
  };
  const unitName = (id: string) =>
    data.units.find((u: any) => u.id === id)?.name || "—";
  const taskGroup = (t: any) =>
    data.units.find((u: any) => u.id === t.unit)?.group || t.group;

  const navigate = (
    p: string,
    params?: {
      status?: string;
      search?: string;
      unit?: string;
      group?: string;
      tab?: string;
    },
  ) => {
    let targetPath = p;

    if (p === "documents") {
      setPage("tasks");
      setSub("documents");
      targetPath = "documents";
    } else if (p === "units" || p === "accounts") {
      setPage("admin");
      const tab = p === "units" ? "units" : "users";
      setAdminTab(tab);
      targetPath = "admin";
    } else {
      setPage(p);
      if (p === "tasks") setSub("tasks");
      if (p === "admin") {
        setAdminTab(
          params?.tab || (has(user, "admin", "tech") ? "units" : "profile"),
        );
      }
    }

    const nextStatus = params?.status !== undefined ? params.status : "";
    const nextSearch = params?.search !== undefined ? params.search : "";
    const nextUnit = params?.unit !== undefined ? params.unit : "";
    const nextGroup = params?.group !== undefined ? params.group : "";

    setStatus(nextStatus);
    setSearch(nextSearch);
    if (params?.unit !== undefined) setUnit(nextUnit);
    if (params?.group !== undefined) setGroup(nextGroup);
    setPageNumber(1);
    setError("");

    if (typeof window !== "undefined") {
      const url = new URL(
        window.location.origin +
          "/" +
          (targetPath === "dashboard" ? "dashboard" : targetPath),
      );
      if (nextStatus) url.searchParams.set("status", nextStatus);
      if (nextUnit) url.searchParams.set("unit", nextUnit);
      if (nextGroup) url.searchParams.set("group", nextGroup);
      if (nextSearch) url.searchParams.set("search", nextSearch);
      if (params?.tab) url.searchParams.set("tab", params.tab);
      const targetUrl = url.pathname + url.search;
      if (router && typeof router.push === "function") {
        router.push(targetUrl);
      } else {
        window.history.pushState({}, "", targetUrl);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
  };

  const monthTasks = tasks.filter((t) => t.month === month);
  const progressScope = monthTasks.filter(
    (t) =>
      (!unit || t.unit === unit) &&
      (!group || taskGroup(t) === group) &&
      (!documentFilter || t.documentId === documentFilter) &&
      (!search ||
        (t.title + " " + unitName(t.unit) + " " + (t.owner || ""))
          .toLowerCase()
          .includes(search.toLowerCase())),
  );

  const showUnitProgress = (id: string, state = "") => {
    navigate("dashboard", { unit: id, status: state });
    setDocumentFilter("");
  };

  const filtered = tasks
    .filter((t) => {
      const periodFilter =
        range === "custom" && page === "reports"
          ? t.assignedDate >= fromDate && t.assignedDate <= toDate
          : range === "week" && page === "reports"
            ? data.reports.some(
                (r: any) =>
                  r.taskId === t.id &&
                  (r.frequency === "daily"
                    ? (r.periodKey || r.week) >=
                        weekWindow(new Date(), cfg).key &&
                      new Date(
                        (r.periodKey || r.week) + "T00:00:00+07:00",
                      ).getTime() <
                        new Date(
                          weekWindow(new Date(), cfg).key + "T00:00:00+07:00",
                        ).getTime() +
                          7 * 86400000
                    : (r.periodKey || r.week) ===
                      weekWindow(new Date(), cfg).key),
              )
            : range === "year" && page === "reports"
              ? t.month.startsWith(month.slice(0, 4))
              : range === "quarter" && page === "reports"
                ? t.month.startsWith(month.slice(0, 4)) &&
                  Math.floor((Number(t.month.slice(5)) - 1) / 3) ===
                    Math.floor((Number(month.slice(5)) - 1) / 3)
                : t.month === month;
      return (
        periodFilter &&
        (!unit || t.unit === unit) &&
        (!group || taskGroup(t) === group) &&
        (!documentFilter || t.documentId === documentFilter) &&
        (!search ||
          (t.title + " " + unitName(t.unit) + " " + (t.owner || ""))
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (!status ||
          (["givenWork", "unfinished"].includes(status) &&
            matchesProgressStatus(t, status)) ||
          (status === "overdue" && deadlineState(t) === "overdue") ||
          (status === "lateReport" &&
            ["missing", "late"].includes(
              reportState(t, data.reports, new Date(), cfg),
            )) ||
          (status === "carry" && t.type === "carry") ||
          (status === "activeWork" &&
            ["assigned", "working", "review", "returned"].includes(t.status) &&
            deadlineState(t) !== "overdue") ||
          (status === "notStarted" &&
            ["draft", "pending"].includes(t.status) &&
            deadlineState(t) !== "overdue") ||
          t.status === status)
      );
    })
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "vi")
        : sort === "progress"
          ? b.progress - a.progress
          : a.due.localeCompare(b.due),
    );

  const base = monthTasks.filter(
    (t) => (!unit || t.unit === unit) && (!group || taskGroup(t) === group),
  );
  const done = base.filter((t) => t.status === "done").length;
  const working = base.filter(
    (t) =>
      ["working", "assigned", "review", "returned"].includes(t.status) &&
      deadlineState(t) !== "overdue",
  ).length;
  const overdue = base.filter((t) => deadlineState(t) === "overdue").length;
  const late = base.filter((t) =>
    ["missing", "late"].includes(reportState(t, data.reports, new Date(), cfg)),
  ).length;
  const reminderItems = reminderPriority(base, data.reports, new Date(), cfg);
  const notStarted = base.filter(
    (t) =>
      ["draft", "pending"].includes(t.status) && deadlineState(t) !== "overdue",
  ).length;
  const other = base.filter((t) =>
    ["paused", "cancelled"].includes(t.status),
  ).length;
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      draft: 0,
      pending: 0,
      assigned: 0,
      working: 0,
      review: 0,
      returned: 0,
      done: 0,
      paused: 0,
      cancelled: 0,
    };
    for (const t of base) {
      if (counts[t.status] !== undefined) {
        counts[t.status]++;
      }
    }
    return counts;
  }, [base]);
  const total = base.length;
  const pageSize = cfg.pageSize || 10;
  const paginated = filtered.slice(
    (pageNumber - 1) * pageSize,
    pageNumber * pageSize,
  );
  const period = data.periods.find((p: any) => p.month === month);
  const w = weekWindow(new Date(), cfg);

  function newTask(documentId = "") {
    open("task", {
      month,
      unit: "",
      partners: [],
      documentId,
      title: "",
      assignedDate: localDate(),
      due: month + "-28",
      priority: "normal",
      type: "new",
      target: 0,
      status: "draft",
      assignedTime: "",
    });
  }

  function offerDownload(bytes: Uint8Array, filename: string) {
    const url = URL.createObjectURL(
      new Blob([bytes as BlobPart], { type: excelMime }),
    );
    downloadUrls.current.push(url);
    setTemplateDownload({ url, filename });
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(
      "Đã tạo file mẫu. Nếu trình duyệt chưa tải, bấm đường tải hiện bên dưới.",
    );
  }

  function downloadReadyTemplate() {
    setError("");
    try {
      offerDownload(readyTemplateBytes(), readyTemplateName);
    } catch (e: any) {
      setError(
        "Chưa tải được file trong cửa sổ này. Dùng đường Tải trực tiếp ở bên dưới.",
      );
    }
  }

  async function downloadTemplate() {
    setBusy(true);
    setError("");
    try {
      const fresh = await load();
      offerDownload(
        await buildTaskTemplate(fresh, month),
        "Mau-nhap-nhiem-vu-" + month + ".xlsx",
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function readTaskFile(file: File) {
    setBusy(true);
    setError("");
    setImportRows([]);
    setImportFileName(file.name);
    setImportSaveProgress({ finished: 0, total: 0 });
    setImportPhase("Đang đọc và kiểm tra file…");
    try {
      if (!/\.xlsx?$/i.test(file.name) || file.size > 5 * 1024 * 1024)
        throw new Error("Chọn file Excel XLSX hoặc XLS, tối đa 5 MB.");
      const bytes = await file.arrayBuffer();
      const fresh = await load();
      const rows = await parseTaskExcel(bytes, fresh, month);
      setImportRows(rows);
      const invalid = rows.filter((r: any) => r.errors.length).length;
      setImportPhase(
        "Đã đọc " +
          rows.length +
          " dòng: " +
          (rows.length - invalid) +
          " hợp lệ, " +
          invalid +
          " dòng cần sửa.",
      );
    } catch (e: any) {
      setImportPhase("Chưa nhập được file.");
      setError(
        e.message || "Không đọc được Excel. Vui lòng chọn file mẫu đã điền.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveTaskImport() {
    if (importSaving.current) return;
    importSaving.current = true;
    setBusy(true);
    setError("");
    const action = approver(user)
      ? importAction
      : importAction === "draft"
        ? "draft"
        : "submit";
    const totalCount = importRows.filter(
      (r) => !r.saved && !r.errors.length,
    ).length;
    setImportSaveProgress({ finished: 0, total: totalCount });
    setImportPhase("Đang lưu nhiệm vụ vào hệ thống…");
    try {
      const next = await saveImportRows(
        importRows,
        (payload) => api("task", { ...payload, importAction: action }),
        (rows, finished, total) => {
          setImportRows(rows);
          setImportSaveProgress({ finished, total });
        },
      );
      const savedCount = next.filter((r) => r.saved).length;
      const failed = next.filter((r) => !r.saved);
      setImportPhase(
        "Đã lưu hệ thống " +
          savedCount +
          "/" +
          next.length +
          " nhiệm vụ" +
          (failed.length ? " · " + failed.length + " dòng chưa lưu." : "."),
      );
      try {
        await load();
        setUnit("");
        setGroup("");
        setStatus("");
        setSearch("");
        setDocumentFilter("");
        setSub("tasks");
        setPageNumber(1);
      } catch (e: any) {
        setError(
          "Đã nhận kết quả lưu từng dòng; chưa tải lại được danh sách: " +
            e.message,
        );
        return;
      }
      if (failed.length)
        setError(
          failed.length +
            " dòng chưa lưu. Bấm Lưu hệ thống để thử lại các dòng này.",
        );
      else
        toast.success(
          "Đã lưu hệ thống và đồng bộ " + savedCount + " nhiệm vụ.",
        );
    } catch (e: any) {
      setError(e.message);
    } finally {
      importSaving.current = false;
      setBusy(false);
    }
  }

  async function upload(parentId: string, file: File) {
    const fd = new FormData();
    fd.set("parentId", parentId);
    fd.set("file", file);
    const r = await fetch("/api/upload", {
      credentials: "include",
      method: "POST",
      headers: { "X-NS-Request": "1" },
      body: fd,
    });
    const x: any = await r.json();
    if (!r.ok) throw new Error(x.error);
    return x;
  }

  const value = {
    data,
    setData,
    user,
    setUser,
    ready,
    setReady,
    initialized,
    setInitialized,
    busy,
    setBusy,
    error,
    setError,
    page,
    setPage,
    month,
    setMonth,
    unit,
    setUnit,
    group,
    setGroup,
    status,
    setStatus,
    search,
    setSearch,
    documentFilter,
    setDocumentFilter,
    sort,
    setSort,
    pageNumber,
    setPageNumber,
    sub,
    setSub,
    adminTab,
    setAdminTab,
    unitGroup,
    setUnitGroup,
    modal,
    setModal,
    form,
    setForm,
    selected,
    setSelected,
    selectedTask,
    detailTab,
    setDetailTab,
    history,
    setHistory,
    comments,
    setComments,
    audit,
    setAudit,
    snapshots,
    setSnapshots,
    columns,
    setColumns,
    range,
    setRange,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    importRows,
    setImportRows,
    importFileName,
    setImportFileName,
    importPhase,
    setImportPhase,
    importSaveProgress,
    setImportSaveProgress,
    importAction,
    setImportAction,
    reminderFilter,
    setReminderFilter,
    templateDownload,
    setTemplateDownload,
    cfg,
    brandLogo,
    tasks,
    monthTasks,
    progressScope,
    filtered,
    base,
    done,
    working,
    overdue,
    late,
    reminderItems,
    notStarted,
    other,
    statusCounts,
    total,
    pageSize,
    paginated,
    period,
    w,
    load,
    markNoticeRead,
    run,
    change,
    open,
    unitName,
    taskGroup,
    navigate,
    showUnitProgress,
    newTask,
    offerDownload,
    downloadReadyTemplate,
    downloadTemplate,
    readTaskFile,
    saveTaskImport,
    upload,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
