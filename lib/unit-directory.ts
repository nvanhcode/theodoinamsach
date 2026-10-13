import { db, stmt, record, records, id, now } from "./server";

// One-time, transactional data reconciliation. Stable unit IDs preserve task and account links.
// This is application data, not a schema migration; later administrator edits remain authoritative.
async function reconcileInitialDirectory() {
  const marker = "directory-2026-10-08-units-v1";
  if (await record(marker)) return;
  const units = await records("unit");
  const mttq =
    units.find((u: any) =>
      [
        "Cơ quan Ủy ban MTTQ Việt Nam xã",
        "Ủy ban MTTQ Việt Nam xã",
        "Ủy ban Mặt trận Tổ quốc Việt Nam xã",
      ].includes(u.name),
    ) || units.find((u: any) => u.id === "unit-12");
  if (!mttq)
    throw new Error(
      "Không tìm thấy đơn vị Ủy ban MTTQ Việt Nam xã để liên kết Công đoàn.",
    );
  const operation = id(),
    time = now(),
    actor = "Cập nhật danh mục theo yêu cầu quản trị";
  const gate =
    "EXISTS(SELECT 1 FROM records WHERE id=? AND json_extract(data,'$.operation')=?)";
  const statements = [
    stmt(
      "INSERT OR IGNORE INTO records(id,kind,data,version,updated) VALUES(?,?,?,1,?)",
      marker,
      "system_update",
      JSON.stringify({ operation }),
      time,
    ),
  ];
  const edits = [
    {
      names: ["Công đoàn", "Công đoàn xã"],
      field: "parentUnitId",
      value: mttq.id,
      action: "Đặt Công đoàn trực thuộc Ủy ban MTTQ Việt Nam xã",
    },
    {
      names: ["Công đoàn", "Công đoàn xã"],
      field: "group",
      value: "MTTQ và đoàn thể",
      action: "Xếp Công đoàn trong khối MTTQ và đoàn thể",
    },
    {
      names: ["Trung tâm Dịch vụ tổng hợp", "Trung tâm tổng hợp"],
      field: "name",
      value: "Trung tâm Dịch vụ sự nghiệp công",
      action: "Đổi tên Trung tâm Dịch vụ sự nghiệp công",
    },
  ];
  for (const edit of edits) {
    const match = `kind='unit' AND json_extract(data,'$.name') IN (${edit.names.map(() => "?").join(",")}) AND COALESCE(json_extract(data,'$.${edit.field}'),'')<>? AND ${gate}`;
    const args = [...edit.names, edit.value, marker, operation];
    statements.push(
      stmt(
        `INSERT INTO audit(id,actor,action,target,before,after,time) SELECT ? || ':' || id,?,?,id,data,json_set(data,'$.${edit.field}',?),? FROM records WHERE ${match}`,
        operation,
        actor,
        edit.action,
        edit.value,
        time,
        ...args,
      ),
    );
    statements.push(
      stmt(
        `UPDATE records SET data=json_set(data,'$.${edit.field}',?),version=version+1,updated=? WHERE ${match}`,
        edit.value,
        time,
        ...args,
      ),
    );
  }
  for (const item of [
    {
      id: "unit-20",
      name: "Công đoàn",
      group: "MTTQ và đoàn thể",
      order: 16.5,
      aliases: ["Công đoàn", "Công đoàn xã"],
    },
    {
      id: "unit-21",
      name: "Phòng Xây dựng, Nông nghiệp và Môi trường",
      group: "UBND",
      order: 8.1,
      aliases: ["Phòng Xây dựng, Nông nghiệp và Môi trường"],
    },
    {
      id: "unit-22",
      name: "Ban Quản lý dự án đầu tư xây dựng xã",
      group: "UBND",
      order: 8.2,
      aliases: ["Ban Quản lý dự án đầu tư xây dựng xã"],
    },
  ]) {
    const payload = JSON.stringify({
      name: item.name,
      group: item.group,
      active: true,
      order: item.order,
      ...(item.id === "unit-20" ? { parentUnitId: mttq.id } : {}),
    });
    const absent = `NOT EXISTS(SELECT 1 FROM records WHERE kind='unit' AND json_extract(data,'$.name') IN (${item.aliases.map(() => "?").join(",")}))`;
    // Avoid overwriting a manually created record even if its identifier happens to match.
    const rid = "directory-" + item.id;
    statements.push(
      stmt(
        `INSERT INTO audit(id,actor,action,target,before,after,time) SELECT ?,?,?,?,NULL,?,? WHERE ${absent} AND ${gate}`,
        operation + ":" + rid,
        actor,
        "Bổ sung cơ quan, đơn vị",
        rid,
        payload,
        time,
        ...item.aliases,
        marker,
        operation,
      ),
    );
    statements.push(
      stmt(
        `INSERT INTO records(id,kind,data,version,updated) SELECT ?,'unit',?,1,? WHERE ${absent} AND ${gate}`,
        rid,
        payload,
        time,
        ...item.aliases,
        marker,
        operation,
      ),
    );
  }
  await db().batch(statements);
}

async function reconcileArmedForcesDirectory() {
  await reconcileInitialDirectory();
  const marker = "directory-2026-10-11-armed-forces-v2";
  if (await record(marker)) return;
  const operation = id(),
    time = now(),
    actor = "Cập nhật danh mục theo yêu cầu quản trị";
  const gate =
    "EXISTS(SELECT 1 FROM records WHERE id=? AND json_extract(data,'$.operation')=?)";
  const names = ["Công an xã", "Công an xã Nam Sách"];
  const namesClause = names.map(() => "?").join(",");
  const unitIds = `SELECT id FROM records WHERE kind='unit' AND json_extract(data,'$.name') IN (${namesClause})`;
  const statements = [
    stmt(
      "INSERT OR IGNORE INTO records(id,kind,data,version,updated) VALUES(?,?,?,1,?)",
      marker,
      "system_update",
      JSON.stringify({ operation }),
      time,
    ),
  ];
  for (const kind of ["unit", "task"]) {
    const match =
      kind === "unit"
        ? `kind='unit' AND json_extract(data,'$.name') IN (${namesClause})`
        : `kind='task' AND json_extract(data,'$.unit') IN (${unitIds})`;
    const where = `${match} AND COALESCE(json_extract(data,'$.group'),'')<>? AND ${gate}`;
    const args = [...names, "Lực lượng vũ trang", marker, operation];
    statements.push(
      stmt(
        `INSERT INTO audit(id,actor,action,target,before,after,time) SELECT ? || ':' || id,?,?,id,data,json_set(data,'$.group',?),? FROM records WHERE ${where}`,
        operation,
        actor,
        "Chuyển Công an xã vào nhóm Lực lượng vũ trang",
        "Lực lượng vũ trang",
        time,
        ...args,
      ),
    );
    statements.push(
      stmt(
        `UPDATE records SET data=json_set(data,'$.group',?),version=version+1,updated=? WHERE ${where}`,
        "Lực lượng vũ trang",
        time,
        ...args,
      ),
    );
  }
  await db().batch(statements);
}

async function reconcileEducationHealthDirectory() {
  const marker = "directory-2026-10-11-education-health-v3";
  if (await record(marker)) return;
  const department = (await records("unit")).find(
    (u: any) =>
      u.name === "Phòng Văn hóa – Xã hội" ||
      u.name === "Phòng Văn hóa - Xã hội",
  );
  const operation = id(),
    time = now(),
    actor = "Cập nhật danh mục theo yêu cầu quản trị";
  const gate =
    "EXISTS(SELECT 1 FROM records WHERE id=? AND json_extract(data,'$.operation')=?)";
  const affectedUnits =
    "SELECT id FROM records WHERE kind='unit' AND json_extract(data,'$.group')='Giáo dục, y tế'";
  const statements = [
    stmt(
      "INSERT OR IGNORE INTO records(id,kind,data,version,updated) VALUES(?,?,?,1,?)",
      marker,
      "system_update",
      JSON.stringify({ operation }),
      time,
    ),
  ];
  // Replace the retired group grant with the exact unit IDs it covered, preserving access scope.
  const userMatch = `EXISTS(SELECT 1 FROM json_each(users.groups) WHERE value='Giáo dục, y tế') AND ${gate}`;
  const nextUnits = `(SELECT json_group_array(value) FROM (SELECT value FROM json_each(users.units) UNION SELECT id AS value FROM records WHERE kind='unit' AND json_extract(data,'$.group')='Giáo dục, y tế'))`;
  const nextGroups =
    "(SELECT json_group_array(value) FROM json_each(users.groups) WHERE value<>'Giáo dục, y tế')";
  statements.push(
    stmt(
      `INSERT INTO audit(id,actor,action,target,before,after,time) SELECT ? || ':user:' || id,?,?,id,json_object('units',json(units),'groups',json(groups)),json_object('units',json(${nextUnits}),'groups',json(${nextGroups})),? FROM users WHERE ${userMatch}`,
      operation,
      actor,
      "Chuyển phạm vi Giáo dục, y tế sang các đơn vị tương ứng",
      time,
      marker,
      operation,
    ),
  );
  statements.push(
    stmt(
      `UPDATE users SET units=${nextUnits},groups=${nextGroups},version=version+1 WHERE ${userMatch}`,
      marker,
      operation,
    ),
  );
  const taskMatch = `kind='task' AND (json_extract(data,'$.unit') IN (${affectedUnits}) OR json_extract(data,'$.group')='Giáo dục, y tế') AND COALESCE(json_extract(data,'$.group'),'')<>'UBND' AND ${gate}`;
  statements.push(
    stmt(
      `INSERT INTO audit(id,actor,action,target,before,after,time) SELECT ? || ':task:' || id,?,?,id,data,json_set(data,'$.group','UBND'),? FROM records WHERE ${taskMatch}`,
      operation,
      actor,
      "Chuyển nhiệm vụ Giáo dục, y tế vào khối UBND",
      time,
      marker,
      operation,
    ),
  );
  statements.push(
    stmt(
      `UPDATE records SET data=json_set(data,'$.group','UBND'),version=version+1,updated=? WHERE ${taskMatch}`,
      time,
      marker,
      operation,
    ),
  );
  const unitMatch = `kind='unit' AND json_extract(data,'$.group')='Giáo dục, y tế' AND ${gate}`;
  const value = department
    ? "json_set(data,'$.group','UBND','$.parentUnitId',COALESCE(NULLIF(json_extract(data,'$.parentUnitId'),''),?))"
    : "json_set(data,'$.group','UBND')";
  const valueArgs = department ? [department.id] : [];
  statements.push(
    stmt(
      `INSERT INTO audit(id,actor,action,target,before,after,time) SELECT ? || ':unit:' || id,?,?,id,data,${value},? FROM records WHERE ${unitMatch}`,
      operation,
      actor,
      "Đưa Giáo dục, y tế về Phòng Văn hóa – Xã hội",
      ...valueArgs,
      time,
      marker,
      operation,
    ),
  );
  statements.push(
    stmt(
      `UPDATE records SET data=${value},version=version+1,updated=? WHERE ${unitMatch}`,
      ...valueArgs,
      time,
      marker,
      operation,
    ),
  );
  await db().batch(statements);
}
export async function reconcileUnitDirectory() {
  await reconcileArmedForcesDirectory();
  await reconcileEducationHealthDirectory();
}
