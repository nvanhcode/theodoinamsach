"use client";

import React from "react";
import { AppLayout } from "@/components/app-layout";
import { DashboardView } from "@/components/views/dashboard-view";

export default function DashboardPage() {
  return (
    <AppLayout activePage="dashboard">
      <DashboardView />
    </AppLayout>
  );
}
