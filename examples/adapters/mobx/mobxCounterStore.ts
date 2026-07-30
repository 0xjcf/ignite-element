import { action, makeObservable, observable, runInAction } from "mobx";

export interface CounterPersistence {
	load(): number;
	save(count: number): void;
	observe(listener: (count: number) => void): () => void;
}

export interface CounterStoreOptions {
	persistence?: CounterPersistence;
}

class Counter {
	@observable count = 0;
	#disposePersistence: (() => void) | null = null;
	#savePersistence: ((count: number) => void) | null = null;

	constructor(options: CounterStoreOptions = {}) {
		const persistence = options.persistence;

		if (persistence) {
			this.count = persistence.load();
			this.#savePersistence = persistence.save.bind(persistence);
		}

		makeObservable(this);

		if (!persistence) {
			return;
		}

		this.#disposePersistence = persistence.observe((count) => {
			runInAction(() => {
				this.count = count;
			});
		});
	}

	@action increment() {
		this.count += 1;
		this.#savePersistence?.(this.count);
	}

	@action decrement() {
		this.count -= 1;
		this.#savePersistence?.(this.count);
	}

	dispose() {
		this.#disposePersistence?.();
		this.#disposePersistence = null;
	}
}

// Exporting a factory function that returns an instance
const counterStore = (options: CounterStoreOptions = {}) =>
	new Counter(options);

export default counterStore;
