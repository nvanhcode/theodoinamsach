"use client";

import React from "react";
import { AppLayout } from "@/components/app-layout";
import { TasksView } from "@/components/views/tasks-view";

export default function TasksPage() {
  return (
    <AppLayout activePage="tasks">
      <TasksView />
    </AppLayout>
  );
}
