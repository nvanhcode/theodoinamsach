type MonthRecord = { month?: string; closed?: boolean };

const validMonth = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

function monthIndex(month: string) {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1;
}

function monthFromIndex(index: number) {
  const year = Math.floor(index / 12);
  const month = String((index % 12) + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Months with records, the current selection, and one upcoming month. */
export function trackingMonthOptions(
  data: {
    tasks?: MonthRecord[];
    reports?: MonthRecord[];
    documents?: MonthRecord[];
    periods?: MonthRecord[];
  },
  selectedMonth: string,
  currentMonth: string,
) {
  const tasks = data.tasks || [];
  const reports = data.reports || [];
  const documents = data.documents || [];
  const periods = data.periods || [];
  const knownMonths = [
    ...tasks.map((item) => item.month),
    ...reports.map((item) => item.month),
    ...documents.map((item) => item.month),
    ...periods.map((item) => item.month),
    selectedMonth,
    currentMonth,
  ].filter(validMonth);
  if (!knownMonths.length) return [];

  const start = Math.min(...knownMonths.map(monthIndex));
  const end = Math.max(...knownMonths.map(monthIndex)) + 1;
  const closedMonths = new Set(
    periods.filter((period) => period.closed).map((period) => period.month),
  );

  return Array.from({ length: end - start + 1 }, (_, offset) =>
    monthFromIndex(end - offset),
  ).map((month) => {
    const taskCount = tasks.filter((task) => task.month === month).length;
    const documentCount = documents.filter(
      (document) => document.month === month,
    ).length;
    const details = [
      taskCount ? `${taskCount} việc` : "",
      documentCount ? `${documentCount} văn bản` : "",
    ].filter(Boolean);
    const state = closedMonths.has(month)
      ? "Đã khóa sổ"
      : details.length
        ? details.join(" · ")
        : "Chưa có dữ liệu";
    return [month, `${Number(month.slice(5))}/${month.slice(0, 4)} · ${state}`];
  });
}
