import { action, observable } from "mobx";

type CounterStore = {
  count: number;
};

const counterStore = () =>
  observable({
    count: 0,

    increment: action(function (this: CounterStore) {
      this.count += 1;
    }),

    decrement: action(function (this: CounterStore) {
      this.count -= 1;
    }),
  });

export default counterStore;