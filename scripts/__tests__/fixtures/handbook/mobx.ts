import { makeAutoObservable } from "mobx";
import { igniteCore } from "ignite-element/mobx";

class Counter {
	count = 0;
	constructor() {
		makeAutoObservable(this);
	}
	increment() {
		this.count += 1;
	}
}
export const source = new Counter();
export const core = igniteCore({
	source,
	states: (snapshot) => ({ count: snapshot.count }),
	commands: ({ actor }) => ({ increment: () => actor.increment() }),
});
