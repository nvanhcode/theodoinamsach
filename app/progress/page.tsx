"use client";

import React from "react";
import { AppLayout } from "@/components/app-layout";
import { ProgressView } from "@/components/views/progress-view";

export default function ProgressPage() {
  return (
    <AppLayout activePage="progress">
      <ProgressView />
    </AppLayout>
  );
}
