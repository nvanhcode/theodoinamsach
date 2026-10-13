"use client";

import React from "react";
import { AppProvider } from "@/components/app-context";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
