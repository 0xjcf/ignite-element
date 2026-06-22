/**
 * Minimal errors-as-values `Result` for the tools seam. A failed command is
 * data the agent reacts to (mapped to a provider `tool_result`), never an
 * exception thrown across the port. Kept local to `ignite-element/tools`; if a
 * second consumer needs it, promote it to a shared util.
 */

export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> =>
	!result.ok;
