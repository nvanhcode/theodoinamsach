import { has, office } from "./domain";

type UserRecord = { roles?: string[]; units?: string[] };
type TaskRecord = { unit?: string; partners?: string[] };
type TaskComment = { type?: string; unit?: string; recipientUnit?: string };

/** Keep partner-to-lead conversations scoped to the participating units and leadership. */
export function canReadTaskComment(
  user: UserRecord,
  task: TaskRecord,
  comment: TaskComment,
) {
  if (comment.type !== "coordination") return true;
  if (
    office(user) ||
    has(user, "secretary", "standing", "chair", "council", "inspector")
  )
    return true;
  if (user.units?.includes(task.unit || "")) return true;

  const userUnits = user.units || [];
  return userUnits.some(
    (unit: string) => comment.unit === unit || comment.recipientUnit === unit,
  );
}
