import { autorun } from "mobx";
export default function createMobXAdapter(storeFactory) {
    return () => {
        const store = storeFactory();
        let stopAutorun = null;
        function cleanupAutorun() {
            stopAutorun?.();
            stopAutorun = null;
        }
        return {
            /**
             * Subscribe to state changes
             */
            subscribe(listener) {
                stopAutorun = autorun(() => listener(store));
                return {
                    unsubscribe: cleanupAutorun,
                };
            },
            /**
             * Dispatch an action (send an event)
             */
            send(event) {
                const action = store[event.type];
                if (typeof action === "function") {
                    action.call(store, event);
                }
                else {
                    console.warn(`[MobXAdapter] Unknown event type: ${String(event.type)}`);
                }
            },
            /**
             * Get the current state snapshot
             */
            getState() {
                return store;
            },
            /**
             * Stop the adapter
             */
            stop() {
                cleanupAutorun();
            },
        };
    };
}
