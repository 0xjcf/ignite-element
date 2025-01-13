import { action, observable, makeObservable } from "mobx";

class Counter {
  @observable count = 0;

  constructor() {
    makeObservable(this);
  }

  @action increment() {
    this.count += 1;
  }

  @action decrement() {
    this.count -= 1;
  }
}

// Exporting a factory function that returns an instance
const counterStore = () => new Counter();

export default counterStore;
