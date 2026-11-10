// Loading this bridge installs the retained DOM host runtime. Keep the source
// module in sideEffects even when its only imported value is a constant.
export { HOST_RUNTIME_FIELD } from "../../../ignite-renderer/src/renderers/jsx/hosts.ts";
