"use client";

import React from "react";
import { AppLayout } from "@/components/app-layout";
import { AdminView } from "@/components/views/admin-view";

export default function AccountsPage() {
  return (
    <AppLayout
      activePage="admin"
      customTitle="Đơn vị – Tài khoản"
      customDescription="Quản lý tài khoản cán bộ, lãnh đạo và phân quyền hệ thống."
    >
      <AdminView initialTab="users" />
    </AppLayout>
  );
}
