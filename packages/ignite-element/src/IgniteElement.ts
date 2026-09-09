import type { IgniteAdapter } from "@ignite-element/core";
import { StateScope } from "@ignite-element/core";
import type { RenderStrategy } from "./renderers/RenderStrategy";

export interface IgniteMoveSafeLifecycle extends HTMLElement {
	readonly hasPendingDisconnectTeardown: boolean;
	cancelDisconnectTeardown(): boolean;
	scheduleDisconnectTeardown(teardown: () => void): void;
}
export default interface IgniteElement<State, Event, View = unknown>
	extends IgniteMoveSafeLifecycle {
	renderView(props: { state: State; send: (event: Event) => void }): View;
	currentState: State;
	initialized: boolean;
	isActive: boolean;
	readonly adapter: IgniteAdapter<State, Event> | undefined;
	initializeAdapter(adapter: IgniteAdapter<State, Event>): void;
	connectedCallback(): void;
	disconnectedCallback(): void;
	onTrueDisconnect(): void;
	send<AdapterEvent>(event: AdapterEvent): void;
}
interface ElementClasses {
	Lifecycle: abstract new () => IgniteMoveSafeLifecycle;
	Element: abstract new <State, Event, View = unknown>(
		adapter: IgniteAdapter<State, Event> | undefined,
		strategy: RenderStrategy<View>,
	) => IgniteElement<State, Event, View>;
}
const classesByConstructor = new WeakMap<typeof HTMLElement, ElementClasses>();
/** Only called after the registration boundary has authenticated a real DOM. */
export function getIgniteElementClasses(
	ElementBase: typeof HTMLElement,
): ElementClasses {
	const cached = classesByConstructor.get(ElementBase);
	if (cached) return cached;
	abstract class IgniteMoveSafeLifecycleElement extends ElementBase {
		private disconnectTeardownScheduled = false;
		private disconnectTeardownToken = 0;

		public get hasPendingDisconnectTeardown(): boolean {
			return this.disconnectTeardownScheduled;
		}

		public cancelDisconnectTeardown(): boolean {
			const wasScheduled = this.disconnectTeardownScheduled;
			this.disconnectTeardownScheduled = false;
			return wasScheduled;
		}

		public scheduleDisconnectTeardown(teardown: () => void): void {
			this.disconnectTeardownScheduled = true;
			const token = ++this.disconnectTeardownToken;

			queueMicrotask(() => {
				if (
					this.isConnected ||
					!this.disconnectTeardownScheduled ||
					token !== this.disconnectTeardownToken
				) {
					return;
				}

				this.disconnectTeardownScheduled = false;
				try {
					teardown();
				} catch (error) {
					console.error(
						"[IgniteElement] Deferred disconnect cleanup failed.",
						error,
					);
				}
			});
		}
	}

	abstract class IgniteElement<
		State,
		Event,
		View = unknown,
	> extends IgniteMoveSafeLifecycleElement {
		private _adapter: IgniteAdapter<State, Event> | undefined;
		private _shadowRoot: ShadowRoot;
		private _currentState!: State;
		private _hasCurrentState = false;
		private _initialized = false;
		private _isActive = false;
		private _unsubscribe: (() => void) | undefined;
		private _sendListener: ((event: globalThis.Event) => void) | undefined;
		private readonly strategy: RenderStrategy<View>;

		constructor(
			adapter: IgniteAdapter<State, Event> | undefined,
			strategy: RenderStrategy<View>,
		) {
			super();
			this._shadowRoot = this.attachShadow({ mode: "open" });

			this.strategy = strategy;
			this.strategy.attach(this._shadowRoot);

			if (adapter) {
				this.initializeAdapter(adapter);
			}
		}

		public initializeAdapter(adapter: IgniteAdapter<State, Event>): void {
			this._adapter = adapter;
			this.updateCurrentState(this._adapter.getSnapshot());
			this._initialized = true;

			if (this._isActive && !this._unsubscribe) {
				this.subscribeToAdapter();
				this.renderTemplate();
			}
		}

		connectedCallback(): void {
			this.cancelDisconnectTeardown();

			if (!this._unsubscribe && this._adapter) {
				this.subscribeToAdapter();
				this.updateCurrentState(this._adapter.getSnapshot());
			}

			this._isActive = true;
			if (!this._sendListener) {
				this._sendListener = (event: globalThis.Event) => this.send(event);
			}
			this.addEventListener("send", this._sendListener as EventListener);
			this.renderTemplate();
		}

		disconnectedCallback(): void {
			this._isActive = false;
			if (this._sendListener) {
				this.removeEventListener("send", this._sendListener as EventListener);
			}

			this._unsubscribe?.();
			this._unsubscribe = undefined;

			this.scheduleDisconnectTeardown(() => {
				let disconnectError: unknown;
				try {
					this.onTrueDisconnect();
				} catch (error) {
					disconnectError = error;
				}

				if (this._adapter && this._adapter.scope !== StateScope.Shared) {
					try {
						this._adapter.stop();
					} catch (error) {
						console.error(
							"[IgniteElement] Adapter stop failed during disconnect teardown.",
							error,
						);
					} finally {
						this._adapter = undefined;
					}
				}

				if (disconnectError !== undefined) {
					throw disconnectError;
				}
			});
		}

		public onTrueDisconnect(): void {}

		public send<AdapterEvent>(event: AdapterEvent): void {
			if (!this._isActive || !this._adapter) {
				console.warn("[IgniteElement] Cannot send events while inactive.");
				return;
			}

			const action =
				event instanceof CustomEvent && event.detail ? event.detail : event;
			this._adapter?.send(action);
		}

		private renderTemplate(): void {
			if (!this._isActive || !this._initialized || !this._hasCurrentState) {
				console.warn(`[IgniteElement] State is not initialized`);
				return;
			}

			this.strategy.render(
				this.renderView({
					state: this._currentState,
					send: (event: Event) => this.send(event),
				}),
			);
		}

		public abstract renderView(props: {
			state: State;
			send: (event: Event) => void;
		}): View;

		get currentState(): State {
			return this._currentState;
		}

		get initialized(): boolean {
			return this._initialized;
		}

		get adapter(): IgniteAdapter<State, Event> | undefined {
			return this._adapter;
		}

		get isActive(): boolean {
			return this._isActive;
		}

		set initialized(value: boolean) {
			this._initialized = value;
		}

		set isActive(value: boolean) {
			this._isActive = value;
		}

		set currentState(state: State) {
			this.updateCurrentState(state);
		}

		private subscribeToAdapter(): void {
			if (!this._adapter) {
				return;
			}

			const subscription = this._adapter.subscribeSnapshots((state: State) => {
				this.updateCurrentState(state);
				if (this._isActive) {
					this.renderTemplate();
				}
			});

			this._unsubscribe = () => {
				subscription.unsubscribe();
				this._unsubscribe = undefined;
			};
		}

		private updateCurrentState(state: State): void {
			this._currentState = state;
			this._hasCurrentState = state !== undefined;
		}
	}

	const classes: ElementClasses = {
		Lifecycle: IgniteMoveSafeLifecycleElement,
		Element: IgniteElement,
	};
	classesByConstructor.set(ElementBase, classes);
	return classes;
}
