export default function createReduxAdapter(configureStore) {
    return () => {
        const store = configureStore();
        let unsubscribe = null;
        function cleanupSubscribe() {
            unsubscribe?.();
            unsubscribe = null;
        }
        return {
            /**
             * Subscribe to state changes
             */
            subscribe(listener) {
                unsubscribe = store.subscribe(() => listener(store.getState()));
                return {
                    unsubscribe: cleanupSubscribe,
                };
            },
            /**
             * Dispatch an action (send an event)
             */
            send(event) {
                store.dispatch(event);
            },
            /**
             * Get the current state snapshot
             */
            getState() {
                return store.getState();
            },
            /**
             * Stop the adapter
             */
            stop() {
                cleanupSubscribe();
            },
        };
    };
}
