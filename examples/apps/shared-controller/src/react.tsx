import { useIgnite } from "ignite-element/react";
import type { Core } from "./owner.js";
export function DensityView({ core }: { core: Core }) {
	const {
		message,
		confirmed,
		canChoose,
		canCheck,
		canRetry,
		choose,
		check,
		retry,
	} = useIgnite(core);
	return (
		<section aria-label="Display density">
			<output>{message}</output>
			{(["comfortable", "compact"] as const).map((density) => (
				<button
					key={density}
					type="button"
					disabled={!canChoose}
					aria-pressed={confirmed === density}
					onClick={() => {
						void choose(density);
					}}
				>
					{density}
				</button>
			))}
			<button
				type="button"
				disabled={!canCheck}
				onClick={() => {
					void check();
				}}
			>
				Load
			</button>
			<button
				type="button"
				disabled={!canRetry}
				onClick={() => {
					void retry();
				}}
			>
				Retry
			</button>
		</section>
	);
}
