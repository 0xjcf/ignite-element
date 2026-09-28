import { defineToolSchema } from "ignite-element/tools";
import {
	ROOMS,
	SCENES,
} from "../../../../../../examples/agents/smart-home/src/home";

/** On-stage tools for the explainer. The home core still has more commands. */
export const explainerToolSchema = defineToolSchema({
	toggleLight: {
		description: "Turn a room's light on or off.",
		input: {
			type: "object",
			properties: {
				room: { type: "string", enum: [...ROOMS] },
				on: { type: "boolean" },
			},
		},
	},
	setThermostat: {
		description: "Set a room's target temperature in °F.",
		input: {
			type: "object",
			properties: {
				room: { type: "string", enum: [...ROOMS] },
				temp: { type: "number", minimum: 50, maximum: 90 },
			},
		},
	},
	runScene: {
		description: "Activate a scene that sets several devices at once.",
		input: {
			type: "string",
			enum: [...SCENES],
			description: "Scene name to activate: morning, away, movie, or night.",
		},
	},
});
