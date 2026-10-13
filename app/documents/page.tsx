"use client";

import React from "react";
import { AppLayout } from "@/components/app-layout";
import { DocumentsView } from "@/components/views/documents-view";

export default function DocumentsPage() {
  return (
    <AppLayout
      activePage="documents"
      customTitle="Văn bản kết luận"
      customDescription="Quản lý văn bản kết luận, liên kết nguồn nhiệm vụ."
    >
      <DocumentsView />
    </AppLayout>
  );
}
