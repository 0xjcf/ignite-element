export interface RenderStrategy<View> {
	attach(host: ShadowRoot): void;
	render(view: View): void;
	detach?(): void;
}

export type RenderStrategyFactory<View> = () => RenderStrategy<View>;
