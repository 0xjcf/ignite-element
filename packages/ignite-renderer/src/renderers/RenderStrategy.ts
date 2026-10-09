export interface RenderStrategy<View> {
	attach(host: ShadowRoot): void;
	render(view: View): void;
	detach?(): void;
	/** @internal Release mounted view callbacks on a true disconnect. DOM stays. */
	releaseView?(): void;
}

export type RenderStrategyFactory<View> = () => RenderStrategy<View>;
