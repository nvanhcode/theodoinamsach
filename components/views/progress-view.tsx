"use client";

import React from "react";
import { Info } from "lucide-react";
import { useApp } from "@/components/app-context";
import { TableTasks } from "@/components/table-tasks";
import { UnitProgress } from "@/components/progress/unit-progress";
import { Btn } from "@/components/common-ui";

export function ProgressView() {
  const {
    data,
    unit,
    setUnit,
    group,
    status,
    setStatus,
    setPageNumber,
    progressScope,
    filtered,
    unitName,
  } = useApp();

  return (
    <>
      <div className="hint mb-5">
        <Info />
        Đơn vị chủ trì gửi báo cáo; thủ trưởng xác nhận. Báo cáo được xác nhận
        từ 100% sẽ tự chuyển nhiệm vụ sang hoàn thành và cập nhật tổng quan. Đơn
        vị phối hợp theo dõi tiến độ, không gửi báo cáo riêng.
      </div>
      <UnitProgress
        units={data.units}
        tasks={progressScope}
        scope={{ unit, group }}
        status={status}
        onStatus={setStatus}
        onUnit={(id: string, state: string) => {
          setUnit(id);
          setStatus(state);
          setPageNumber(1);
        }}
      />
      {unit && (
        <div className="actions mb-4">
          <span className="badge">{unitName(unit)}</span>
          <Btn
            small
            onClick={() => {
              setUnit("");
              setStatus("");
            }}
          >
            Xem tất cả đơn vị
          </Btn>
        </div>
      )}
      <section className="panel">
        <div className="panel-head">
          <h2>Danh sách nhiệm vụ{unit ? " · " + unitName(unit) : ""}</h2>
          <span className="badge">{filtered.length} nhiệm vụ</span>
        </div>
        <TableTasks />
      </section>
    </>
  );
}
