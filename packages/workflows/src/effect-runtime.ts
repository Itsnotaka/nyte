import { Cause, Effect, Exit, Option } from "effect";

export async function runWorkflowEffect<A, E>(
  program: Effect.Effect<A, E>
): Promise<A> {
  const exit = await Effect.runPromiseExit(program);

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  const failure = Cause.failureOption(exit.cause);
  if (Option.isSome(failure)) {
    throw failure.value;
  }

  throw Cause.squash(exit.cause);
}
