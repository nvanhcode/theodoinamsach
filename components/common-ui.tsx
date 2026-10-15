"use client";

import React from "react";
import {
  FileText,
  Building2,
  Users,
  LayoutDashboard,
  ClipboardList,
  Bell,
  Settings,
  FolderOpen,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import {
  roleNames,
  stateNames,
  groups,
  orderedGroups,
  defaults,
  has,
  office,
  approver,
  canReport,
  deadlineState,
  reportState,
  weekWindow,
  reportWindow,
  reportScheduleLabel,
  uniqueYear,
  localDate,
} from "@/lib/domain";

export {
  roleNames,
  stateNames,
  groups,
  orderedGroups,
  defaults,
  has,
  office,
  approver,
  canReport,
  deadlineState,
  reportState,
  weekWindow,
  reportWindow,
  reportScheduleLabel,
  uniqueYear,
  localDate,
};

export const menu = [
  ["documents", "Văn bản kết luận", FileText],
  ["units", "Cơ quan, đơn vị", Building2],
  ["accounts", "Đơn vị – Tài khoản", Users],
  ["dashboard", "Tổng quan", LayoutDashboard],
  ["tasks", "Nhiệm vụ & văn bản", ClipboardList],
  ["notices", "Nhắc việc – Thông báo", Bell],
  ["reports", "Phê duyệt Báo cáo các đơn vị", FileText],
  ["admin", "Quản trị", Settings],
] as const;

export async function api(path: string, body?: any) {
  const r = await fetch("/api/" + path, {
    credentials: "include",
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-NS-Request": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: any;
  try {
    data = await r.json();
  } catch {
    throw Object.assign(
      new Error(
        "Máy chủ trả về dữ liệu không hợp lệ. Hãy tải lại trang và đăng nhập lại nếu phiên đã hết.",
      ),
      { status: r.status },
    );
  }
  if (!r.ok)
    throw Object.assign(new Error(data.error || "Không thể kết nối máy chủ."), {
      status: r.status,
    });
  return data;
}

export function Pick({ value, onChange, options, label = "Chọn" }: any) {
  return (
    <Select
      value={String(value || "_")}
      onValueChange={(v) => onChange(v === "_ " ? "" : v === "_" ? "" : v)}
    >
      <SelectTrigger className="pick" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o: any) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return (
            <SelectItem key={v || "_"} value={String(v || "_")}>
              {l}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function Btn({
  children,
  onClick,
  primary = false,
  danger = false,
  small = false,
  disabled = false,
  type = "button",
  className = "",
  title,
}: any) {
  return (
    <button
      type={type}
      disabled={disabled}
      title={title}
      className={
        "btn " +
        (primary ? "primary " : "") +
        (danger ? "danger " : "") +
        (small ? "small " : "") +
        className
      }
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, wide = false }: any) {
  return (
    <label className={"form-field " + (wide ? "wide" : "")}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Check({ label, checked, onChange }: any) {
  return (
    <label className="check-row">
      <Checkbox checked={!!checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}

export function None({
  title = "Chưa có nhiệm vụ",
  text = "Nhiệm vụ sẽ xuất hiện sau khi được nhập và giao trong kỳ này.",
  action,
}: any) {
  return (
    <Empty className="empty-message">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderOpen />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
      {action}
    </Empty>
  );
}

export const fmt = (s: string) =>
  s
    ? new Date(s.length === 10 ? s + "T00:00:00+07:00" : s).toLocaleDateString(
        "vi-VN",
        { timeZone: "Asia/Ho_Chi_Minh" },
      )
    : "—";

export const fulltime = (s: string) =>
  s
    ? new Date(s).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    : "—";

export function Badge({ status }: any) {
  return (
    <span
      className={
        "badge " +
        (status === "done"
          ? "green"
          : ["returned", "cancelled"].includes(status)
            ? "red"
            : ["pending", "review", "working"].includes(status)
              ? "amber"
              : "gray")
      }
    >
      {stateNames[status] || status}
    </span>
  );
}

export const deadlineLabels: any = {
  overdue: "Quá hạn",
  soon: "Sắp đến hạn",
  onTime: "Trong hạn",
  done: "Hoàn thành đúng hạn",
  doneLate: "Hoàn thành sau hạn",
  inactive: "Tạm ngừng theo dõi",
};

export const reportLabels: any = {
  notRequired: "Không yêu cầu báo cáo kỳ này",
  notDue: "Chưa đến hạn báo cáo",
  onTime: "Đã gửi đúng hạn",
  late: "Đã gửi chậm",
  missing: "Chưa gửi, đã quá hạn",
  returned: "Cần bổ sung báo cáo",
};

export const blankData = {
  tasks: [],
  documents: [],
  reports: [],
  units: [],
  notices: [],
  users: [],
  files: [],
  periods: [],
  milestones: [],
  settings: defaults,
};
