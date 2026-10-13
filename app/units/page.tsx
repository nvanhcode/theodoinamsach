"use client";

import React from "react";
import { AppLayout } from "@/components/app-layout";
import { AdminView } from "@/components/views/admin-view";

export default function UnitsPage() {
  return (
    <AppLayout
      activePage="admin"
      customTitle="Cơ quan, đơn vị"
      customDescription="Quản lý danh mục cơ quan, đơn vị trực thuộc và phối hợp."
    >
      <AdminView initialTab="units" />
    </AppLayout>
  );
}
