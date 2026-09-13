import { createFakePorts } from "./fake-ports.js";
import { createOwner } from "./owner.js";
export function at<T>(values: T[], index: number): T {
	const value = values[index];
	if (value === undefined) throw new Error(`Missing fixture item ${index}`);
	return value;
}
export function fixture(account = "demo", epoch = "login-1") {
	const fake = createFakePorts();
	const owner = createOwner({ account, epoch }, fake.ports);
	const load = async () => {
		const pending = owner.core.execute({ command: "check" });
		at(fake.reads, fake.reads.length - 1).resolve({
			kind: "value",
			account,
			density: "comfortable",
		});
		await pending;
	};
	return { fake, owner, load, state: () => owner.core.get("states") };
}
