type HeadlessSubscription = {
	unsubscribe: () => void;
};

/**
 * Start a headless igniteCore so its actor is running, and return the
 * subscription.
 *
 * igniteCore's XState binding creates the actor but only starts it on the
 * first subscribeSnapshots ("Deferred actions, invoked actors and timers
 * wait for committed subscription"). A headless test has no view, so it must
 * subscribe. watch requires a handler and calls it immediately because
 * emitCurrent defaults to true, which is why this passes a no-op.
 *
 * TODO: replace this once igniteCore exposes an explicit start (for example
 * `core.start()`, or have `get("states")` start the actor). That is an open
 * API design decision for Jose.
 */
export function startHeadless(core: {
	watch(handler: () => void): HeadlessSubscription;
}): HeadlessSubscription {
	return core.watch(() => {});
}
