import { has, office } from "./domain";

type UserRecord = { roles?: string[]; units?: string[] };
type TaskRecord = { unit?: string; partners?: string[] };
type TaskComment = { type?: string; unit?: string; recipientUnit?: string };

/** Keep partner-to-lead conversations scoped to the participating units. */
export function canReadTaskComment(
  user: UserRecord,
  task: TaskRecord,
  comment: TaskComment,
) {
  if (comment.type !== "coordination") return true;
  if (office(user) || has(user, "secretary")) return true;
  if (user.units?.includes(task.unit)) return true;

  const participantUnits = (task.partners || []).filter((unit: string) =>
    user.units?.includes(unit),
  );
  if (!participantUnits.length) return true;

  return participantUnits.some(
    (unit: string) => comment.unit === unit || comment.recipientUnit === unit,
  );
}
