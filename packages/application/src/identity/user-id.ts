import { Data, Effect } from "effect";

export class InvalidUserIdError extends Data.TaggedError("InvalidUserIdError")<{
  message: string;
}> {}

export function requireUserId(userId: unknown): string {
  return Effect.runSync(
    Effect.succeed(userId).pipe(
      Effect.filterOrFail(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
        () =>
          new InvalidUserIdError({
            message: "userId is required for backend processes.",
          })
      ),
      Effect.map((value) => value.trim())
    )
  );
}
