/**
 * Names counted as destructive when they appear as a move in the canonical
 * bytes. This list is the counter's legend. It is not part of the signed
 * document and it does not say what a move will do.
 */
export const DESTRUCTIVE_MOVE_NAMES = [
	"drop",
	"close",
	"remove",
	"remove_dependency",
	"delete",
] as const;

const DESTRUCTIVE = new Set<string>(DESTRUCTIVE_MOVE_NAMES);

export type ConfirmMove = {
	readonly move: string;
	readonly projectIds: readonly string[];
	readonly lines: readonly string[];
	readonly destructive: boolean;
};

/**
 * A reading of canonical bytes. There is no summary string. `moves` is the
 * marked document, in the order the bytes carry. `destructiveCount` is how
 * many of those moves use a name in `DESTRUCTIVE_MOVE_NAMES`.
 */
export type ConfirmView = {
	readonly canonicalBytes: string;
	readonly moves: readonly ConfirmMove[];
	readonly destructiveCount: number;
	readonly countedNames: readonly string[];
	readonly unreadable: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringItems(
	value: unknown,
	marker: "set" | "sequence",
): readonly string[] | null {
	if (
		!isRecord(value) ||
		value.$list !== marker ||
		!Array.isArray(value.items)
	) {
		return null;
	}
	const items: string[] = [];
	for (const item of value.items) {
		if (typeof item !== "string") return null;
		items.push(item);
	}
	return items;
}

function readMoves(value: unknown): readonly ConfirmMove[] | null {
	if (!isRecord(value) || !isRecord(value.moves)) return null;
	if (value.moves.$list !== "sequence" || !Array.isArray(value.moves.items)) {
		return null;
	}
	const moves: ConfirmMove[] = [];
	for (const item of value.moves.items) {
		if (!isRecord(item) || typeof item.move !== "string") return null;
		const projectIds = readStringItems(item.projectIds, "set");
		const lines = readStringItems(item.lines, "sequence");
		if (!projectIds || !lines) return null;
		moves.push({
			move: item.move,
			projectIds,
			lines,
			destructive: DESTRUCTIVE.has(item.move),
		});
	}
	return moves;
}

/** Parse a confirm model from canonical bytes. Does not sort or rewrite them. */
export function confirmViewFromBytes(canonicalBytes: string): ConfirmView {
	const countedNames = DESTRUCTIVE_MOVE_NAMES;
	if (canonicalBytes === "") {
		return {
			canonicalBytes,
			moves: [],
			destructiveCount: 0,
			countedNames,
			unreadable: false,
		};
	}
	try {
		const moves = readMoves(JSON.parse(canonicalBytes) as unknown);
		if (!moves) {
			return {
				canonicalBytes,
				moves: [],
				destructiveCount: 0,
				countedNames,
				unreadable: true,
			};
		}
		return {
			canonicalBytes,
			moves,
			destructiveCount: moves.filter((move) => move.destructive).length,
			countedNames,
			unreadable: false,
		};
	} catch {
		return {
			canonicalBytes,
			moves: [],
			destructiveCount: 0,
			countedNames,
			unreadable: true,
		};
	}
}
