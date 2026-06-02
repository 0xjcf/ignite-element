import type { IgniteAdapter } from "@ignite-element/core";
import { StateScope } from "@ignite-element/core";
import type { RenderStrategy } from "./renderers/RenderStrategy";
import type {
	IgniteStoryLifecycleScope,
	IgniteStoryLifecycleStage,
} from "./types/agent";

export type IgniteElementLifecycleHooks = {
	elementName: string;
	instanceId: number;
	scope: IgniteStoryLifecycleScope;
	record: (
		stage: IgniteStoryLifecycleStage,
		elementName: string,
		scope: IgniteStoryLifecycleScope,
		instanceId?: number,
	) => void;
};

export default abstract class IgniteElement<
	State,
	Event,
	View = unknown,
> extends HTMLElement {
	private _adapter: IgniteAdapter<State, Event> | undefined;
	private _shadowRoot: ShadowRoot;
	private _currentState!: State;
	private _hasCurrentState = false;
	private _initialized = false;
	private _isActive = false;
	private _unsubscribe: (() => void) | undefined;
	private _sendListener: ((event: globalThis.Event) => void) | undefined;
	private readonly strategy: RenderStrategy<View>;
	private readonly lifecycle?: IgniteElementLifecycleHooks;

	constructor(
		adapter: IgniteAdapter<State, Event> | undefined,
		strategy: RenderStrategy<View>,
		lifecycle?: IgniteElementLifecycleHooks,
	) {
		super();
		this._shadowRoot = this.attachShadow({ mode: "open" });

		this.strategy = strategy;
		this.lifecycle = lifecycle;
		this.strategy.attach(this._shadowRoot);

		if (adapter) {
			this.initializeAdapter(adapter);
		}
	}

	protected initializeAdapter(adapter: IgniteAdapter<State, Event>): void {
		this._adapter = adapter;
		this.updateCurrentState(this._adapter.getState());
		this._initialized = true;

		if (this._isActive && !this._unsubscribe) {
			this.subscribeToAdapter();
			this.renderTemplate();
		}
	}

	connectedCallback(): void {
		if (!this._unsubscribe && this._adapter) {
			this.subscribeToAdapter();
			this.updateCurrentState(this._adapter.getState());
		}

		this._isActive = true;
		if (!this._sendListener) {
			this._sendListener = (event: globalThis.Event) => this.send(event);
		}
		this.addEventListener("send", this._sendListener as EventListener);
		this.recordLifecycle("connected");
		this.renderTemplate();
	}

	disconnectedCallback(): void {
		this._isActive = false;
		if (this._sendListener) {
			this.removeEventListener("send", this._sendListener as EventListener);
		}

		this._unsubscribe?.();
		this._unsubscribe = undefined;

		if (this._adapter && this._adapter.scope !== StateScope.Shared) {
			this._adapter.stop();
			this._adapter = undefined;
		}

		this.recordLifecycle("disconnected");
	}

	protected send<AdapterEvent>(event: AdapterEvent): void {
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
		this.recordLifecycle("rendered");
	}

	protected abstract renderView(props: {
		state: State;
		send: (event: Event) => void;
	}): View;

	// TODO: REMOVE in v2.0
	public forceRender(): void {
		if (!this._initialized) {
			console.warn(
				"[IgniteElement] Attempted to force render before initialization.",
			);
			return;
		}

		if (!this._isActive) {
			console.warn("[IgniteElement] Attempted to force render while inactive.");
			return;
		}

		this.renderTemplate();
	}

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

		const subscription = this._adapter.subscribe((state: State) => {
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

	private recordLifecycle(stage: IgniteStoryLifecycleStage): void {
		if (!this.lifecycle) {
			return;
		}

		this.lifecycle.record(
			stage,
			this.lifecycle.elementName,
			this.lifecycle.scope,
			this.lifecycle.instanceId,
		);
	}
}
