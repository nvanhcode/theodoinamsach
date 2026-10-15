"use client";

import React from "react";
import {
  LockKeyhole,
  Plus,
  ChartNoAxesCombined,
  Pencil,
  ShieldCheck,
  Download,
  Info,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
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
import { useApp } from "@/components/app-context";
import {
  Btn,
  roleNames,
  groups,
  orderedGroups,
  has,
  fulltime,
  api,
} from "@/components/common-ui";
import { localDate } from "@/lib/domain";

export function AdminView({ initialTab }: { initialTab?: string }) {
  const {
    data,
    user,
    cfg,
    adminTab,
    setAdminTab,
    unitGroup,
    setUnitGroup,
    audit,
    setAudit,
    open,
    run,
    unitName,
    showUnitProgress,
  } = useApp();

  const [unitToDelete, setUnitToDelete] = React.useState<any>(null);

  const deleteDependencies = React.useMemo(() => {
    if (!unitToDelete) return null;
    const childUnits = (data.units || []).filter(
      (u: any) => u.parentUnitId === unitToDelete.id,
    );
    const assignedUsers = (data.users || []).filter(
      (usr: any) =>
        Array.isArray(usr.units) && usr.units.includes(unitToDelete.id),
    );
    const linkedTasks = (data.tasks || []).filter(
      (t: any) =>
        t.unit === unitToDelete.id ||
        (Array.isArray(t.partners) && t.partners.includes(unitToDelete.id)),
    );
    const linkedReports = (data.reports || []).filter(
      (r: any) => r.unit === unitToDelete.id,
    );
    const total =
      childUnits.length +
      assignedUsers.length +
      linkedTasks.length +
      linkedReports.length;
    return {
      childUnits,
      assignedUsers,
      linkedTasks,
      linkedReports,
      total,
      hasDependencies: total > 0,
    };
  }, [unitToDelete, data]);

  const activeTab = has(user, "admin", "tech")
    ? initialTab || adminTab || "units"
    : "profile";

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => {
        if (v !== "profile" && !has(user, "admin", "tech")) return;
        setAdminTab(v);
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.pathname = "/admin";
          url.searchParams.set("tab", v);
          window.history.pushState({}, "", url.pathname + url.search);
        }
        if (v === "audit") {
          api("history")
            .then(setAudit)
            .catch((e: any) => toast.error(e.message));
        }
      }}
    >
      <TabsList className="admin-tabs">
        {has(user, "admin", "tech") && (
          <>
            <TabsTrigger value="units">Cơ quan, đơn vị</TabsTrigger>
            <TabsTrigger value="users">Người dùng & phân quyền</TabsTrigger>
            <TabsTrigger value="settings">Cấu hình</TabsTrigger>
            <TabsTrigger value="audit">Lịch sử hoạt động</TabsTrigger>
            <TabsTrigger value="backup">Sao lưu</TabsTrigger>
          </>
        )}
        <TabsTrigger value="profile">Tài khoản cá nhân</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">
        <section className="panel settings-card">
          <h2>Tài khoản cá nhân</h2>
          <p className="muted text-sm mt-3">
            Quản lý thông tin đăng nhập và đổi mật khẩu của bạn bất cứ lúc nào.
          </p>
          <div className="info-grid mt-6">
            <div>
              <small>Họ và tên</small>
              {user.name}
            </div>
            <div>
              <small>Tên đăng nhập</small>
              {user.username}
            </div>
            <div>
              <small>Vai trò</small>
              {user.roles.map((r: string) => roleNames[r]).join(", ")}
            </div>
          </div>
          <Btn primary className="mt-6" onClick={() => open("password")}>
            <LockKeyhole />
            Đổi mật khẩu
          </Btn>
        </section>
      </TabsContent>
      {has(user, "admin", "tech") && (
        <>
          <TabsContent value="units">
            <section className="panel">
              <div className="panel-head">
                <h2>Danh mục cơ quan, đơn vị</h2>
                {has(user, "admin") && (
                  <Btn
                    primary
                    small
                    onClick={() =>
                      open("unit", {
                        name: "",
                        group: groups[0],
                        active: true,
                      })
                    }
                  >
                    <Plus />
                    Thêm đơn vị
                  </Btn>
                )}
              </div>
              <div className="unit-group-tabs">
                <button
                  className={!unitGroup ? "active" : ""}
                  onClick={() => setUnitGroup("")}
                >
                  Tất cả
                </button>
                {orderedGroups(data.units.map((u: any) => u.group)).map(
                  (g: any) => (
                    <button
                      key={g}
                      className={unitGroup === g ? "active" : ""}
                      onClick={() => setUnitGroup(g)}
                    >
                      {g}
                    </button>
                  ),
                )}
              </div>
              <div className="table-wrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>TÊN ĐƠN VỊ</TableHead>
                      <TableHead>KHỐI CƠ QUAN</TableHead>
                      <TableHead>ĐƠN VỊ CẤP TRÊN</TableHead>
                      <TableHead>TRẠNG THÁI</TableHead>
                      <TableHead>THAO TÁC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.units
                      .filter((u: any) => !unitGroup || u.group === unitGroup)
                      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                      .map((u: any) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <b>{u.name}</b>
                            <div className="text-xs muted">{u.contact}</div>
                          </TableCell>
                          <TableCell>{u.group}</TableCell>
                          <TableCell className="unit-cell">
                            {u.parentUnitId ? unitName(u.parentUnitId) : "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                "badge " + (u.active ? "green" : "gray")
                              }
                            >
                              {u.active ? "Hoạt động" : "Ngừng sử dụng"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="actions">
                              <Btn small onClick={() => showUnitProgress(u.id)}>
                                <ChartNoAxesCombined />
                                Theo dõi tiến độ
                              </Btn>
                              {has(user, "admin") && (
                                <>
                                  <Btn
                                    small
                                    onClick={() => open("unit", { ...u })}
                                    title="Sửa thông tin đơn vị"
                                  >
                                    <Pencil />
                                    Sửa
                                  </Btn>
                                  <Btn
                                    small
                                    danger
                                    onClick={() => setUnitToDelete(u)}
                                    title="Xóa đơn vị"
                                  >
                                    <Trash2 />
                                    Xóa
                                  </Btn>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </TabsContent>
          <TabsContent value="users">
            <section className="panel">
              <div className="panel-head">
                <h2>Tài khoản và phạm vi dữ liệu</h2>
                {has(user, "admin") && (
                  <Btn
                    primary
                    small
                    onClick={() =>
                      open("user", {
                        roles: ["editor"],
                        units: [],
                        groups: [],
                        active: true,
                      })
                    }
                  >
                    <Plus />
                    Thêm tài khoản
                  </Btn>
                )}
              </div>
              <div className="hint m-4">
                <ShieldCheck />
                Cán bộ đầu mối chỉ xem nhiệm vụ được giao cho đơn vị chủ
                trì/phối hợp và nhập báo cáo, minh chứng. Phó Chánh Văn phòng
                được nhập, duyệt giao việc và xác nhận kết quả. Văn thư được
                nhập, sửa và trình nhiệm vụ; không duyệt giao việc hay cấp tài
                khoản.
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NGƯỜI DÙNG</TableHead>
                    <TableHead>VAI TRÒ</TableHead>
                    <TableHead>ĐƠN VỊ / PHẠM VI</TableHead>
                    <TableHead>TRẠNG THÁI</TableHead>
                    <TableHead>THAO TÁC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <b>{u.name}</b>
                        <div className="text-xs muted">{u.username}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.roles.map((r: string) => roleNames[r]).join(", ")}
                      </TableCell>
                      <TableCell className="unit-cell">
                        {u.units.map(unitName).join(", ") || "Theo vai trò"}
                        {u.groups.join(", ")}
                      </TableCell>
                      <TableCell>
                        <span
                          className={"badge " + (u.active ? "green" : "red")}
                        >
                          {u.active ? "Hoạt động" : "Đã khóa"}
                        </span>
                        {!!u.mustChange && (
                          <div className="text-xs muted mt-1">
                            Cần đổi mật khẩu
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {has(user, "admin") && (
                          <Btn
                            small
                            onClick={() =>
                              open("user", { ...u, active: !!u.active })
                            }
                          >
                            <Pencil />
                            Sửa / cấp lại
                          </Btn>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
            <div className="hint mt-4">
              <ShieldCheck />
              Thay đổi quyền hoặc khóa tài khoản sẽ thu hồi các phiên đăng nhập
              hiện có. Quản trị kỹ thuật không được tự động xem nội dung hồ sơ
              nghiệp vụ.
            </div>
          </TabsContent>
          <TabsContent value="settings">
            <section className="panel settings-card">
              <h2>Cấu hình nghiệp vụ và giao diện</h2>
              <div className="info-grid mt-6">
                <div>
                  <small>Tên hệ thống</small>
                  {cfg.title}
                </div>
                <div>
                  <small>Đơn vị sử dụng</small>
                  {cfg.organization}
                </div>
                <div>
                  <small>Hạn báo cáo tuần</small>
                  {cfg.hour} ·{" "}
                  {Number(cfg.day) === 7
                    ? "Chủ nhật"
                    : "Thứ " + (Number(cfg.day) + 1)}
                </div>
                <div>
                  <small>Ngưỡng nhắc trước hạn</small>
                  {cfg.warningDays} ngày
                </div>
                <div>
                  <small>Số dòng mỗi trang</small>
                  {cfg.pageSize}
                </div>
                <div>
                  <small>Hết phiên khi không hoạt động</small>
                  {cfg.sessionMinutes} phút
                </div>
              </div>
              {has(user, "admin") && (
                <Btn
                  primary
                  className="mt-6"
                  onClick={() => open("settings", { ...cfg })}
                >
                  <Pencil />
                  Sửa cấu hình
                </Btn>
              )}
            </section>
          </TabsContent>
          <TabsContent value="audit">
            <section className="panel">
              <div className="panel-head">
                <h2>Nhật ký hoạt động</h2>
                <span className="text-xs muted">500 thao tác gần nhất</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>THỜI GIAN</TableHead>
                    <TableHead>NGƯỜI THỰC HIỆN</TableHead>
                    <TableHead>THAO TÁC</TableHead>
                    <TableHead>ĐỐI TƯỢNG</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{fulltime(a.time)}</TableCell>
                      <TableCell>{a.actor}</TableCell>
                      <TableCell>{a.action}</TableCell>
                      <TableCell className="text-xs muted">
                        {a.target}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          </TabsContent>
          <TabsContent value="backup">
            <section className="panel settings-card">
              <h2>Sao lưu dữ liệu nghiệp vụ</h2>
              <p className="muted text-sm mt-3 mb-5">
                Tệp JSON chứa hồ sơ nghiệp vụ được phép truy cập. Không chứa mật
                khẩu, phiên đăng nhập và nội dung tệp minh chứng. Chỉ phục hồi
                vào hệ thống chưa có nhiệm vụ, văn bản, báo cáo.
              </p>
              <div className="actions">
                {has(user, "admin") && (
                  <>
                    <Btn
                      primary
                      onClick={() =>
                        run(
                          async () => {
                            const b = await api("backup");
                            const blob = new Blob(
                              [JSON.stringify(b, null, 2)],
                              { type: "application/json" },
                            );
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download =
                              "nam-sach-sao-luu-" + localDate() + ".json";
                            a.click();
                            URL.revokeObjectURL(a.href);
                          },
                          "Đã tải bản sao lưu nghiệp vụ.",
                          false,
                        )
                      }
                    >
                      <Download />
                      Tải bản sao lưu
                    </Btn>
                    <Btn onClick={() => open("restore")}>Phục hồi dữ liệu</Btn>
                  </>
                )}
              </div>
              <div className="hint amber mt-5">
                <Info />
                Minh chứng cần sao lưu riêng cùng kho tệp của máy chủ. Bản JSON
                này không thay thế bản sao lưu toàn hệ thống.
              </div>
            </section>
          </TabsContent>
        </>
      )}

      <Dialog
        open={!!unitToDelete}
        onOpenChange={(v) => {
          if (!v) setUnitToDelete(null);
        }}
      >
        <DialogContent className="max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600 shrink-0" />
              <span className="text-red-600">Xác nhận xóa cơ quan, đơn vị</span>
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-left text-sm pt-2 space-y-3">
                {deleteDependencies?.hasDependencies ? (
                  <>
                    <p className="text-foreground">
                      Đơn vị <b>{unitToDelete?.name}</b> đang có{" "}
                      <b>{deleteDependencies.total}</b> tài nguyên ràng buộc.
                      Nếu bạn tiếp tục xóa, hệ thống sẽ{" "}
                      <b>
                        xóa vĩnh viễn cả đơn vị và toàn bộ tài nguyên đi cùng
                      </b>
                      :
                    </p>
                    <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-amber-900 text-xs dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-200 space-y-1">
                      {deleteDependencies.childUnits.length > 0 && (
                        <div>
                          • <b>{deleteDependencies.childUnits.length}</b> đơn vị
                          cấp dưới trực thuộc:{" "}
                          {deleteDependencies.childUnits
                            .map((c: any) => c.name)
                            .join(", ")}
                        </div>
                      )}
                      {deleteDependencies.assignedUsers.length > 0 && (
                        <div>
                          • <b>{deleteDependencies.assignedUsers.length}</b> tài
                          khoản người dùng trực thuộc (tài khoản chỉ thuộc đơn
                          vị này sẽ bị xóa)
                        </div>
                      )}
                      {deleteDependencies.linkedTasks.length > 0 && (
                        <div>
                          • <b>{deleteDependencies.linkedTasks.length}</b> nhiệm
                          vụ được giao chủ trì / phối hợp (kèm minh chứng, nhắc
                          việc)
                        </div>
                      )}
                      {deleteDependencies.linkedReports.length > 0 && (
                        <div>
                          • <b>{deleteDependencies.linkedReports.length}</b> báo
                          cáo tiến độ và tệp đính kèm liên quan
                        </div>
                      )}
                    </div>
                    <div className="rounded-md border border-red-200 bg-red-50/70 p-2.5 text-xs text-red-800 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-200">
                      ⚠️ <b>Lưu ý quan trọng:</b> Thao tác này sẽ xóa vĩnh viễn
                      đơn vị và tất cả tài nguyên nêu trên khỏi hệ thống và
                      không thể khôi phục.
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Nếu bạn chỉ muốn ẩn đơn vị khỏi danh sách giao việc mới mà
                      vẫn bảo toàn các số liệu và lịch sử báo cáo, hãy chọn{" "}
                      <b>"Chuyển sang Ngừng sử dụng"</b> thay vì xóa tất cả.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-foreground">
                      Bạn có chắc chắn muốn xóa cơ quan, đơn vị{" "}
                      <b>{unitToDelete?.name}</b>{" "}
                      {unitToDelete?.group
                        ? `(thuộc khối ${unitToDelete.group})`
                        : ""}
                      ?
                    </p>
                    <p className="text-xs text-red-600">
                      Đơn vị này hiện không có tài nguyên liên kết. Hành động
                      xóa sẽ xóa hoàn toàn đơn vị khỏi danh mục và không thể
                      hoàn tác.
                    </p>
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="form-footer flex justify-end gap-2 mt-4 pt-3 border-t">
            <Btn onClick={() => setUnitToDelete(null)}>Hủy</Btn>
            {deleteDependencies?.hasDependencies && unitToDelete?.active && (
              <Btn
                onClick={() => {
                  run(
                    () => api("unit", { ...unitToDelete, active: false }),
                    "Đã chuyển đơn vị sang trạng thái Ngừng sử dụng.",
                  ).then(() => setUnitToDelete(null));
                }}
              >
                Chuyển sang Ngừng sử dụng
              </Btn>
            )}
            <Btn
              danger
              onClick={() => {
                run(
                  () =>
                    api("unit-delete", { id: unitToDelete.id, cascade: true }),
                  deleteDependencies?.hasDependencies
                    ? "Đã xóa đơn vị và toàn bộ tài nguyên đi cùng thành công."
                    : "Đã xóa đơn vị thành công.",
                ).then(() => setUnitToDelete(null));
              }}
            >
              <Trash2 />
              {deleteDependencies?.hasDependencies
                ? "Xóa đơn vị và tất cả tài nguyên"
                : "Xác nhận xóa"}
            </Btn>
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
