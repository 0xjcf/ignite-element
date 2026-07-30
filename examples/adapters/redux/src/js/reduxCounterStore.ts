import type { PayloadAction } from "@reduxjs/toolkit";
import { configureStore, createSlice } from "@reduxjs/toolkit";

export interface CounterState {
	count: number;
}

export interface CounterPersistence {
	load(): number;
	save(count: number): void;
	observe(listener: (count: number) => void): () => void;
}

export interface CounterStoreOptions {
	persistence?: CounterPersistence;
}

const initialState: CounterState = {
	count: 0,
};

export const counterSlice = createSlice({
	name: "counter",
	initialState,
	reducers: {
		increment: (state) => {
			state.count++;
		},
		decrement: (state) => {
			state.count--;
		},
		addByAmount: (state, action: PayloadAction<number>) => {
			state.count += action.payload;
		},
	},
});

export const counterStore = (options: CounterStoreOptions = {}) => {
	const store = configureStore({
		reducer: {
			counter: counterSlice.reducer,
		},
	});
	const persistence = options.persistence;

	if (!persistence) {
		return Object.assign(store, {
			dispose() {},
		});
	}

	store.dispatch(addByAmount(persistence.load()));
	let isApplyingPersistence = false;
	let didDispose = false;
	const originalDispatch = store.dispatch;

	store.dispatch = ((action: Parameters<typeof originalDispatch>[0]) => {
		const result = originalDispatch(action);
		if (!isApplyingPersistence) {
			persistence.save(store.getState().counter.count);
		}
		return result;
	}) as typeof store.dispatch;

	const unsubscribe = persistence.observe((count) => {
		const current = store.getState().counter.count;
		if (count === current) {
			return;
		}
		isApplyingPersistence = true;
		try {
			originalDispatch(addByAmount(count - current));
		} finally {
			isApplyingPersistence = false;
		}
	});

	return Object.assign(store, {
		dispose() {
			if (didDispose) {
				return;
			}
			didDispose = true;
			unsubscribe();
		},
	});
};

export default counterStore;

export const { increment, decrement, addByAmount } = counterSlice.actions;
