import { assign, setup } from "xstate";

export default setup({
  types: {
    events: {} as { type: "INC" } | { type: "DEC" },
    context: {} as {
      count: number;
    },
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
