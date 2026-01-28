/**
 * PHI minimization helpers.
 *
 * For demo safety: only send FirstName + LastInitial to any LLM prompt or outbound message.
 * Keep internal UUIDs in metadata/audit logs, but not in LLM prompt bodies unless required.
 */

export function clientLabel(input: { firstName: string; lastInitial: string }): string {
  const first = (input.firstName ?? "").trim() || "Client";
  const li = (input.lastInitial ?? "").trim().slice(0, 1) || "X";
  return `${first} ${li}.`;
}

