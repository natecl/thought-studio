export class BoardDomainError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "permission_denied" | "version_conflict" | "validation_failed" | "proposal_conflict",
  ) {
    super(message);
    this.name = "BoardDomainError";
  }
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new BoardDomainError(message, "validation_failed");
}
