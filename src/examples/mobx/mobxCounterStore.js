import { action, observable } from "mobx";
const counterStore = () => observable({
    count: 0,
    increment: action(function () {
        this.count += 1;
    }),
    decrement: action(function () {
        this.count -= 1;
    }),
});
export default counterStore;
