export function noticeRecipientStatus(notice: any, users: any[] = []) {
  const unitIds = Array.isArray(notice.audienceUnits)
    ? notice.audienceUnits
    : [];
  const readBy = new Set<string>(notice.readBy || []);
  return unitIds.map((unitId: string) => {
    const recipients = users.filter(
      (user) => user.active && user.units?.includes(unitId),
    );
    return {
      unitId,
      recipients,
      read: recipients.filter((user) => readBy.has(user.id)),
      unread: recipients.filter((user) => !readBy.has(user.id)),
    };
  });
}

export function unreadNoticeRecipientCount(notices: any[], users: any[] = []) {
  return notices.reduce((total, notice) => {
    if (!Array.isArray(notice.audienceUnits)) return total;
    const rows = noticeRecipientStatus(notice, users);
    return (
      total +
      rows.reduce(
        (count: number, row: any) =>
          count + (row.recipients.length ? row.unread.length : 1),
        0,
      )
    );
  }, 0);
}
