export type Clock = {
	now: () => number;
	seq: () => number;
};

export function createClock(now: () => number = Date.now): Clock {
	let sequence = 0;
	return {
		now,
		seq: () => {
			sequence += 1;
			return sequence;
		},
	};
}

export function createFakeClock(
	start = 0,
): Clock & { advance: (ms: number) => void } {
	let current = start;
	const clock = createClock(() => current);
	return {
		now: clock.now,
		seq: clock.seq,
		advance: (ms: number) => {
			current += ms;
		},
	};
}
