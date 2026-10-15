"use client";

import React from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  UserRound,
  LogOut,
  CalendarDays,
  RefreshCw,
  Download,
  Search,
  LockKeyhole,
} from "lucide-react";
import { Toaster } from "sonner";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useApp } from "@/components/app-context";
import {
  menu,
  roleNames,
  stateNames,
  has,
  Btn,
  Pick,
  api,
  blankData,
  orderedGroups,
} from "@/components/common-ui";
import { reportingOnly } from "@/lib/report-access";
import { ReportingPortal } from "@/components/reporting/portal";
import { LoginView } from "@/components/login-view";
import { AppModals } from "@/components/app-modals";

export function AppLayout({
  activePage,
  customTitle,
  customDescription,
  children,
}: {
  activePage?: string;
  customTitle?: string;
  customDescription?: string;
  children?: React.ReactNode;
}) {
  const {
    data,
    setData,
    user,
    setUser,
    ready,
    busy,
    error,
    modal,
    page: contextPage,
    sub,
    month,
    setMonth,
    group,
    setGroup,
    unit,
    setUnit,
    status,
    setStatus,
    search,
    setSearch,
    templateDownload,
    cfg,
    brandLogo,
    period,
    load,
    markNoticeRead,
    run,
    navigate,
    setForm,
  } = useApp();

  let pathname = "";
  try {
    pathname = usePathname() || "";
  } catch {}

  const currentPath = pathname.replace(/^\/+|\/+$/g, "");
  const detectedPage =
    currentPath === "documents"
      ? "documents"
      : currentPath === "units" || currentPath === "accounts"
        ? "admin"
        : [
              "dashboard",
              "tasks",
              "progress",
              "notices",
              "reports",
              "admin",
            ].includes(currentPath)
          ? currentPath
          : "";

  const currentPage = activePage || detectedPage || contextPage;

  if (!ready) {
    return (
      <div className="loading">
        <div>
          <RefreshCw className="animate-spin mx-auto mb-3" />
          Đang kết nối hệ thống…
        </div>
      </div>
    );
  }

  if (!user || user.mustChange) {
    return <LoginView />;
  }

  if (reportingOnly(user)) {
    return (
      <ReportingPortal
        data={data}
        user={user}
        load={load}
        markNoticeRead={markNoticeRead}
        api={api}
        onLogout={async () => {
          try {
            await api("logout", {});
          } finally {
            setUser(null);
            setData(blankData);
            setForm({});
            navigate("login");
          }
        }}
      />
    );
  }

  const defaultTitle =
    currentPage === "tasks" && sub === "documents"
      ? "Văn bản kết luận"
      : currentPage === "documents"
        ? "Văn bản kết luận"
        : currentPage === "tasks"
          ? "Nhập dữ liệu công việc"
          : currentPage === "admin"
            ? "Cài đặt hệ thống"
            : menu.find((m) => m[0] === currentPage)?.[1];

  const defaultDescription =
    currentPage === "dashboard"
      ? "Nắm bắt tiến độ thực hiện kết luận, chỉ đạo trong kỳ."
      : currentPage === "documents" ||
          (currentPage === "tasks" && sub === "documents")
        ? "Quản lý văn bản kết luận, liên kết nguồn nhiệm vụ."
        : currentPage === "tasks"
          ? "Quản lý văn bản, phân công và điều chỉnh nhiệm vụ."
          : currentPage === "progress"
            ? "Cập nhật kết quả, gửi báo cáo và xác nhận thực hiện."
            : currentPage === "notices"
              ? "Theo dõi thời hạn và đôn đốc báo cáo của các đơn vị."
              : currentPage === "reports"
                ? "Tổng hợp dữ liệu theo kỳ, phục vụ giao ban và lưu trữ."
                : "Quản lý cơ cấu tổ chức, tài khoản và cấu hình nghiệp vụ.";

  const title = customTitle || defaultTitle;
  const description = customDescription || defaultDescription;

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "250px",
          "--brand": cfg.color,
          "--primary": cfg.color,
        } as React.CSSProperties
      }
    >
      <Toaster richColors position="top-right" />
      <Sidebar>
        <SidebarContent>
          <button
            type="button"
            className="sidebar-brand"
            aria-label="Về trang chính · Tổng quan"
            title="Về trang chính"
            onClick={() => {
              navigate("dashboard");
              window.scrollTo({ top: 0 });
            }}
          >
            <span className="brand-mark">
              <img src={brandLogo} alt="Biểu trưng búa liềm" />
            </span>
            <span>
              <b>{cfg.organization}</b>
              <small>ĐIỀU HÀNH · THEO DÕI</small>
            </span>
          </button>
          <div className="sidebar-section">KHÔNG GIAN LÀM VIỆC</div>
          <nav className="side-menu">
            {menu
              .filter(([p]) =>
                ["dashboard", "tasks", "notices", "reports", "admin"].includes(
                  p,
                ),
              )
              .map(([p, label, Icon]) => (
                <button
                  key={p}
                  className={
                    (
                      p === "tasks"
                        ? currentPage === "tasks" || currentPage === "documents"
                        : p === "admin"
                          ? currentPage === "admin"
                          : currentPage === p
                    )
                      ? "active"
                      : ""
                  }
                  onClick={() => navigate(p)}
                >
                  <Icon />
                  {p === "admin" && !has(user, "admin", "tech")
                    ? "Tài khoản"
                    : label}
                </button>
              ))}
          </nav>
          <div className="sidebar-section mt-8">KỲ THEO DÕI</div>
          <div className="mx-5 rounded-lg border border-white/20 px-4 py-3 text-sm text-rose-100">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} />
              Tháng {Number(month.slice(5))}/{month.slice(0, 4)}
            </div>
            <div className="mt-2 text-xs text-rose-200">
              {period?.closed ? "Đã khóa sổ dữ liệu" : "Đang mở cập nhật"}
            </div>
          </div>
        </SidebarContent>
        <SidebarFooter className="p-0">
          <div className="side-bottom">
            <strong>{user.name}</strong>
            <span>
              {user.roles.map((r: string) => roleNames[r]).join(", ")}
            </span>
            <div className="mt-3 flex justify-between">
              <button
                aria-label="Đăng xuất"
                onClick={async () => {
                  try {
                    await api("logout", {});
                  } finally {
                    setUser(null);
                    setData(blankData);
                    navigate("login");
                  }
                }}
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="workspace">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <img
              className="topbar-logo"
              src={brandLogo}
              alt="Biểu trưng búa liềm"
            />
            <div>
              <div className="eyebrow">
                {cfg.organization} · {cfg.city}
              </div>
              <h2>Hệ thống {cfg.title.toLowerCase()}</h2>
            </div>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              aria-label="Thông báo"
              onClick={() => navigate("notices")}
            >
              <Bell />
              {data.notices.filter((n: any) => !n.readBy?.includes(user.id))
                .length > 0 && (
                <span className="count-badge">
                  {
                    data.notices.filter(
                      (n: any) => !n.readBy?.includes(user.id),
                    ).length
                  }
                </span>
              )}
            </button>
            <div className="h-7 w-px bg-slate-200" />
            <button
              className="avatar"
              type="button"
              aria-label="Tài khoản cá nhân"
              title="Mở tài khoản cá nhân"
              onClick={() => navigate("admin", { tab: "profile" })}
            >
              <UserRound size={22} />
            </button>
            <div className="user-meta">
              <b>{user.name}</b>
              <small>{roleNames[user.roles[0]]}</small>
            </div>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {currentPage !== "dashboard" && (
              <div className="actions">
                <Btn
                  onClick={() =>
                    run(() => load(), "Đã cập nhật dữ liệu.", false)
                  }
                  disabled={busy}
                >
                  <RefreshCw />
                  Làm mới
                </Btn>
              </div>
            )}
          </div>

          {templateDownload && currentPage === "tasks" && (
            <div className="hint mb-4">
              <Download />
              <div>
                Mẫu Excel đã sẵn sàng.{" "}
                <a
                  className="underline font-semibold"
                  href={templateDownload.url}
                  download={templateDownload.filename}
                >
                  Bấm tại đây nếu trình duyệt chưa tải file
                </a>{" "}
                ·{" "}
                <a
                  className="underline"
                  href="/api/task-template-ready"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Tải trực tiếp mẫu có sẵn
                </a>
                .
              </div>
            </div>
          )}

          {error && !modal && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}

          {currentPage !== "admin" && (
            <div className="filters">
              <Pick
                label="Tháng"
                value={month.slice(5)}
                onChange={(v: string) => setMonth(month.slice(0, 4) + "-" + v)}
                options={Array.from({ length: 12 }, (_, i) => [
                  String(i + 1).padStart(2, "0"),
                  "Tháng " + (i + 1),
                ])}
              />
              <Pick
                label="Năm"
                value={month.slice(0, 4)}
                onChange={(v: string) => setMonth(v + month.slice(4))}
                options={Array.from({ length: 10 }, (_, i) => String(2026 + i))}
              />
              {currentPage !== "documents" && (
                <Pick
                  label="Khối cơ quan"
                  value={group}
                  onChange={(v: string) => {
                    setGroup(v);
                    setUnit("");
                  }}
                  options={[
                    ["", "Tất cả khối"],
                    ...orderedGroups(data.units.map((u: any) => u.group)).map(
                      (g) => [g, g],
                    ),
                  ]}
                />
              )}
              {currentPage !== "documents" && (
                <Pick
                  label="Đơn vị chủ trì"
                  value={unit}
                  onChange={setUnit}
                  options={[
                    ["", "Tất cả đơn vị"],
                    ...data.units
                      .filter((u: any) => !group || u.group === group)
                      .map((u: any) => [u.id, u.name]),
                  ]}
                />
              )}
              {["tasks", "progress", "reports", "dashboard"].includes(
                currentPage,
              ) && (
                <Pick
                  label="Trạng thái"
                  value={status}
                  onChange={setStatus}
                  options={[
                    ["", "Tất cả trạng thái"],
                    ...Object.entries(stateNames),
                    ...(currentPage === "progress" ||
                    currentPage === "dashboard"
                      ? [
                          ["givenWork", "Đã giao việc"],
                          ["unfinished", "Chưa hoàn thành"],
                        ]
                      : []),
                    ["activeWork", "Đang thực hiện, trong hạn"],
                    ["notStarted", "Chưa triển khai, trong hạn"],
                    ["overdue", "Quá hạn nhiệm vụ"],
                    ["lateReport", "Chậm báo cáo"],
                    ["carry", "Nhiệm vụ chuyển tiếp"],
                  ]}
                />
              )}
              {["tasks", "progress", "reports", "dashboard"].includes(
                currentPage,
              ) && (
                <div className="search">
                  <Search />
                  <input
                    aria-label="Tìm nhiệm vụ"
                    placeholder="Tìm nội dung nhiệm vụ…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {period?.closed && currentPage !== "admin" && (
            <div className="hint amber mb-5">
              <LockKeyhole />
              Kỳ này đã khóa sổ. Dữ liệu được bảo toàn; điều chỉnh cần có lý do
              và mở lại kỳ.
            </div>
          )}

          {children}

          <footer className="bottom-note footer-bar">
            <span>
              {cfg.organization} · Hệ thống theo dõi thực hiện kết luận, chỉ đạo
            </span>
            <span>
              Múi giờ Việt Nam ·{" "}
              {period?.closed ? "Kỳ đã khóa sổ" : "Đang mở cập nhật"}
            </span>
          </footer>
        </main>
      </div>
      <AppModals />
    </SidebarProvider>
  );
}
