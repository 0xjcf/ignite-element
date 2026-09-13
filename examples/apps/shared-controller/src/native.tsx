import { useIgnite } from "ignite-element/react";
import { Pressable, Text, View } from "react-native";
import type { Core } from "./owner.js";
export function NativeDensityView({ core }: { core: Core }) {
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
		<View>
			<Text testID="density-status" accessibilityLiveRegion="polite">
				{message}
			</Text>
			{(["comfortable", "compact"] as const).map((density) => (
				<Pressable
					key={density}
					testID={density}
					accessibilityRole="button"
					disabled={!canChoose}
					accessibilityState={{
						disabled: !canChoose,
						selected: confirmed === density,
					}}
					onPress={() => {
						void choose(density);
					}}
				>
					<Text>{density}</Text>
				</Pressable>
			))}
			<Pressable
				testID="load"
				accessibilityRole="button"
				disabled={!canCheck}
				accessibilityState={{ disabled: !canCheck }}
				onPress={() => {
					void check();
				}}
			>
				<Text>Load</Text>
			</Pressable>
			<Pressable
				testID="retry"
				accessibilityRole="button"
				disabled={!canRetry}
				accessibilityState={{ disabled: !canRetry }}
				onPress={() => {
					void retry();
				}}
			>
				<Text>Retry</Text>
			</Pressable>
		</View>
	);
}
