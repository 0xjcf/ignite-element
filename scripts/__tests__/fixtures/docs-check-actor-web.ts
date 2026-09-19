// Retained checker coverage from the retired Actor-Web guide.
import {
	actor,
	defineActorWebTopology,
	defineBehavior,
	node,
	startRuntime,
} from "@actor-web/runtime";
import { igniteCore } from "ignite-element/actor-web";

type HomeRequest = { type: "home.refresh" };
const homeTopology = defineActorWebTopology({
	nodes: { local: node("home-example-runtime") },
	actors: {
		home: actor({
			id: "home",
			node: "local",
			behavior: () =>
				defineBehavior<HomeRequest>()
					.withContext({ refreshCount: 0 })
					.onMessage(({ context }) => ({
						context: { refreshCount: context.refreshCount + 1 },
					}))
					.build(),
		}),
	},
});
const runtime = await startRuntime(homeTopology);

try {
	const commandSource = runtime.topology.source("home", {
		host: new EventTarget(),
	});

	const home = igniteCore({
		source: commandSource,
		states: (snapshot) => ({ refreshCount: snapshot.context.refreshCount }),
		commands: ({ source: actor }) => ({
			refresh: () => actor.send({ type: "home.refresh" }),
		}),
	});

	// Application-owned async execution; keep the runtime alive for all consumers.
	await home.execute({ command: "refresh" });
	const localNode = runtime.nodes.local;
	if (!localNode)
		throw new Error("Home runtime did not provide its local node");
	await localNode.system.flush();
	console.log(home.get("states").refreshCount);
	home.dispose(); // releases Ignite observations, not the Actor-Web runtime
} finally {
	// The application owns the runtime and its sources. Stopping the runtime
	// closes sources it created before shutting down its nodes.
	await runtime.stop();
}
