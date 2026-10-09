/** @jsxImportSource ignite-element/jsx */

const canvas = (
	<canvas
		ref={(node) => {
			type IncludesNull = null extends typeof node ? true : false;
			const includesNull: IncludesNull = true;
			void includesNull;
			if (!node) return;
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
			if (!node) return;
			// @ts-expect-error a div ref is the div, not a canvas
			node.getContext("2d");
		}}
	/>
);

export const refs = { canvas, div };
