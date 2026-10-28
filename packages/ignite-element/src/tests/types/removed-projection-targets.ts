import { createMachine } from "xstate";
// @ts-expect-error document target construction is no longer public
import { createProjectionDocumentTarget } from "../../index";
// @ts-expect-error speech target construction is no longer public
import { createProjectionSpeechTarget, igniteCore } from "../../xstate";

const core = igniteCore({ source: createMachine({}) });
// @ts-expect-error a source-backed core only accepts two-argument DOM registration
core(createProjectionDocumentTarget({ commitDocument() {} }));
// @ts-expect-error a source-backed core does not bind speech targets
core(
	createProjectionSpeechTarget({
		commitSpeech() {},
		acknowledgeCommandName: "ack",
	}),
);

void core.get("states");
void core.get("schema");
core.watch(() => {}).unsubscribe();
core.dispose();
