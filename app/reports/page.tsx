"use client";

import React from "react";
import { AppLayout } from "@/components/app-layout";
import { ReportsView } from "@/components/views/reports-view";

export default function ReportsPage() {
  return (
    <AppLayout activePage="reports">
      <ReportsView />
    </AppLayout>
  );
}
