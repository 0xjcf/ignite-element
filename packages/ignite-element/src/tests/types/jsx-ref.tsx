/** @jsxImportSource ignite-element/jsx */

const canvas = (
	<canvas
		ref={(node) => {
			const context: CanvasRenderingContext2D | null = node.getContext("2d");
			void context;
			return () => {
				void node;
			};
		}}
	/>
);

const div = (
	<div
		ref={(node) => {
			// @ts-expect-error a div ref is the div, not a canvas
			node.getContext("2d");
		}}
	/>
);

export const refs = { canvas, div };
