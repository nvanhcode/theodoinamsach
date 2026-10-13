"use client";

import React from "react";
import { AppLayout } from "@/components/app-layout";
import { NoticesView } from "@/components/views/notices-view";

export default function NoticesPage() {
  return (
    <AppLayout activePage="notices">
      <NoticesView />
    </AppLayout>
  );
}
