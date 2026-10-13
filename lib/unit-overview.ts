export function unitSections(units: any[], tasks: any[], scope: any = {}) {
  const sections = [
    { key: "party", title: "Các cơ quan tham mưu, giúp việc Đảng ủy" },
    { key: "council", title: "HĐND xã" },
    { key: "government", title: "UBND và đơn vị trực thuộc" },
    { key: "front", title: "Ủy ban MTTQ và các đoàn thể xã" },
    { key: "military", title: "Lực lượng vũ trang" },
  ];
  const classify = (u: any) =>
    u.group === "Lực lượng vũ trang" || /công an|quân sự/i.test(u.name)
      ? "military"
      : u.group === "Khối Đảng"
        ? "party"
        : u.group === "HĐND"
          ? "council"
          : u.group === "UBND"
            ? "government"
            : u.group === "MTTQ và đoàn thể"
              ? "front"
              : "other:" + u.group;
  const visible = units.filter(
    (u) =>
      u.active &&
      (!scope.group || u.group === scope.group) &&
      (!scope.unit || u.id === scope.unit),
  );
  const isCommon = (u: any) =>
    u.group === "UBND" && /^UBND xã(?: Nam Sách)?$/i.test(u.name);
  const rows = visible.filter((u) => !isCommon(u));
  const extra = [
    ...new Set(visible.map(classify).filter((k) => k.startsWith("other:"))),
  ].map((key) => ({ key, title: key.slice(6) || "Cơ quan, đơn vị khác" }));
  return [...sections, ...extra]
    .map((s) => ({
      ...s,
      units: rows
        .filter((u) => classify(u) === s.key)
        .sort(
          (a, b) =>
            (a.order || 0) - (b.order || 0) ||
            a.name.localeCompare(b.name, "vi"),
        )
        .map((u) => ({
          ...u,
          lead: tasks.filter((t) => t.unit === u.id).length,
          partner: tasks.filter((t) => (t.partners || []).includes(u.id))
            .length,
        })),
      shared: tasks.filter((t) =>
        visible.some(
          (u) => u.id === t.unit && isCommon(u) && classify(u) === s.key,
        ),
      ).length,
      total: tasks.filter((t) =>
        visible.some((u) => u.id === t.unit && classify(u) === s.key),
      ).length,
    }))
    .filter((s) => s.units.length || s.shared);
}
