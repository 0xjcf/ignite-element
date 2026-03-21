import "./internal/setupDomPolyfill";

export { igniteCoreMobx as igniteCore } from "./igniteCore/mobxEntry";
export type {
	IgniteCoreReturn,
	MobxConfig,
	MobxEvent,
} from "./igniteCore/types";
