import type { GalleryFixture } from "../contract";

export type FieldFixtureInput = {
	label: string;
	value: string;
	hint: string | null;
	error: string | null;
	required: boolean;
	multiline: boolean;
	touched: boolean;
};

export const fieldGallery: readonly GalleryFixture<FieldFixtureInput>[] = [
	{
		id: "thought-empty",
		state: "clean",
		title: "Empty thought",
		app: "Twilight",
		input: {
			label: "Thought",
			value: "",
			hint: "One sentence.",
			error: null,
			required: false,
			multiline: true,
			touched: false,
		},
	},
	{
		id: "thought-draft",
		state: "clean",
		title: "Exact draft",
		app: "Twilight",
		input: {
			label: "Thought",
			value: "  Call Mom  ",
			hint: "Spaces in the draft stay.",
			error: null,
			required: false,
			multiline: true,
			touched: true,
		},
	},
	{
		id: "task-title",
		state: "invalid",
		title: "Title error",
		app: "Twilight",
		input: {
			label: "Title",
			value: "",
			hint: "Short name.",
			error: "Title is required.",
			required: true,
			multiline: false,
			touched: true,
		},
	},
	{
		id: "finished-when",
		state: "invalid",
		title: "Finished when",
		app: "Twilight",
		input: {
			label: "Finished when",
			value: "done",
			hint: null,
			error: "Say what done means.",
			required: true,
			multiline: false,
			touched: true,
		},
	},
	{
		id: "amount",
		state: "clean",
		title: "Amount",
		app: "Booster Budget",
		input: {
			label: "Amount",
			value: "12.50",
			hint: "Dollars and cents.",
			error: null,
			required: true,
			multiline: false,
			touched: true,
		},
	},
	{
		id: "payee",
		state: "invalid",
		title: "Payee error",
		app: "Booster Budget",
		input: {
			label: "Payee",
			value: "",
			hint: "Who was paid.",
			error: "Payee is required.",
			required: true,
			multiline: false,
			touched: true,
		},
	},
];
