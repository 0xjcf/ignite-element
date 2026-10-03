/** @jsxImportSource ignite-element/jsx */
import {
	ROOMS,
	type Room,
	SCENES,
	type Scene,
} from "../../../../../../examples/agents/smart-home/src/home";
import { resetHome } from "./shared-inspect";
import { home } from "./shared-session";

const styles = new URL("./home-explainer.css", import.meta.url).href;

type HomeCtx = {
	lights: Record<Room, boolean>;
	thermostat: Record<Room, number>;
	activeScene: Scene | null;
	pendingScene: Scene | null;
	toggleLight(input: { room: Room; on: boolean }): void;
	setThermostat(input: { room: Room; temp: number }): void;
	runScene(scene: Scene): void;
};

function title(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function clampTemp(temp: number): number {
	return Math.min(90, Math.max(50, temp));
}

home("ignite-shared-home", (ctx: HomeCtx) => (
	<section class="home-panel" data-scene={ctx.activeScene ?? "manual"}>
		<link rel="stylesheet" href={styles} />
		<header class="home-header">
			<div>
				<h2>Smart home</h2>
				<p class="scene-pill">
					Scene: {ctx.activeScene ? title(ctx.activeScene) : "Manual"}
					{ctx.pendingScene ? ` · settling ${title(ctx.pendingScene)}` : ""}
				</p>
			</div>
			<button type="button" class="reset" onClick={() => void resetHome()}>
				Reset
			</button>
		</header>
		<div class="rooms">{ROOMS.map((room) => roomCard(room, ctx))}</div>
		<section class="scenes">
			<h3>Scenes</h3>
			<p class="hint">Each click sends a command to the shared source.</p>
			<div class="scene-grid">
				{SCENES.map((scene) => (
					<button
						key={scene}
						type="button"
						class={scene === ctx.activeScene ? "primary" : ""}
						aria-pressed={String(scene === ctx.activeScene)}
						onClick={() => ctx.runScene(scene)}
					>
						{title(scene)}
					</button>
				))}
			</div>
		</section>
	</section>
));

function roomCard(
	room: Room,
	ctx: {
		lights: Record<Room, boolean>;
		thermostat: Record<Room, number>;
		toggleLight(input: { room: Room; on: boolean }): void;
		setThermostat(input: { room: Room; temp: number }): void;
	},
) {
	const on = ctx.lights[room];
	const temp = ctx.thermostat[room];
	return (
		<section key={room} class="room" data-light={on ? "on" : "off"}>
			<h3>{title(room)}</h3>
			<div class="metrics">
				<span>Light</span>
				<strong>{on ? "On" : "Off"}</strong>
				<span>Thermostat</span>
				<strong>{temp}°F</strong>
			</div>
			<div class="actions">
				<button
					type="button"
					aria-pressed={String(on)}
					aria-label={`${title(room)} light`}
					onClick={() => ctx.toggleLight({ room, on: !on })}
				>
					{on ? "Turn off" : "Turn on"}
				</button>
				<button
					type="button"
					aria-label={`Cooler ${room}`}
					onClick={() => ctx.setThermostat({ room, temp: clampTemp(temp - 1) })}
				>
					Cooler
				</button>
				<button
					type="button"
					aria-label={`Warmer ${room}`}
					onClick={() => ctx.setThermostat({ room, temp: clampTemp(temp + 1) })}
				>
					Warmer
				</button>
			</div>
		</section>
	);
}

export { resetHome, runMovie, watchSource } from "./shared-inspect";
