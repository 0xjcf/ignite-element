/** @jsxImportSource ignite-element/jsx */
import { radio, type radioHosts } from "../host-use-hosts";

declare global {
	interface IgniteHostNames extends Record<keyof typeof radioHosts, true> {}
}

radio("radio", () => <canvas use="speaker" />);

// @ts-expect-error use must name a host on this core
radio("radio", () => <canvas use="missing" />);

// @ts-expect-error use must name a host on this core
radio("radio", () => <canvas use="scene" />);

export const hostedRadio = radio;
