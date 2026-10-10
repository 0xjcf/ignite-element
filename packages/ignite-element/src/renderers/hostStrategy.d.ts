import type {
	IgniteJsxChild,
	RenderStrategyFactory,
} from "@ignite-element/renderer";

export const createIgniteJsxRenderStrategy: RenderStrategyFactory<unknown>;

export function mountIgniteJsxOnce(
	host: (Node & ParentNode) | ShadowRoot,
	view: IgniteJsxChild,
): void;

export function reacquireMountedView(root: ParentNode): void;

export function releaseMountedView(root: ParentNode): void;
