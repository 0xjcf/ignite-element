import { igniteCore } from "ignite-element/mobx";
import { makeAutoObservable } from "mobx";

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
	commands: ({ source: store }) => ({ increment: () => store.increment() }),
});
