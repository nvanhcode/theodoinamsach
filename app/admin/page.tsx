"use client";

import React from "react";
import { AppLayout } from "@/components/app-layout";
import { AdminView } from "@/components/views/admin-view";

export default function AdminPage() {
  return (
    <AppLayout activePage="admin">
      <AdminView />
    </AppLayout>
  );
}
