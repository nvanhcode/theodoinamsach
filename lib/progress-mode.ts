export function isPercentageProgressTask(task: any) {
  const measure = String(task?.measure || "")
    .trim()
    .toLocaleLowerCase("vi");
  return ["%", "phần trăm", "tiến độ", "nội dung", "báo cáo"].some(
    (label) => measure === label || measure.startsWith(label + " "),
  );
}

export function normalizePercentageReport(task: any, report: any) {
  if (
    !isPercentageProgressTask(task) ||
    !report ||
    !(Number(task?.target) > 0) ||
    !(Number(report.quantity) > 0)
  )
    return report;

  const quantityAsPercent = Number(report.quantity);
  const quantityAsRatio = (Number(report.quantity) / Number(task.target)) * 100;
  if (
    Number(report.progress) > 100 &&
    Math.abs(Number(report.progress) - quantityAsRatio) < 0.01
  ) {
    return { ...report, progress: quantityAsPercent, quantity: 0 };
  }
  return report;
}
