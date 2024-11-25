import { assign, setup } from "xstate";
const counterMachine = setup({
    types: {
        events: {},
        context: {},
    },
}).createMachine({
    id: "counter",
    initial: "idle",
    context: {
        count: 0,
    },
    states: {
        idle: {
            on: {
                INC: {
                    actions: [
                        assign({
                            count: ({ context }) => context.count + 1,
                        }),
                        () => console.log("inc in machine"),
                    ],
                },
                DEC: {
                    actions: [
                        assign({
                            count: ({ context }) => context.count - 1,
                        }),
                        () => console.log("dec in machine"),
                    ],
                },
            },
        },
    },
});
export default counterMachine;
