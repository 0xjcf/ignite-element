import { igniteCore } from "ignite-element/xstate";
import { html } from "lit-html";
import type { StateFrom } from "xstate";
import { taskManagerMachine } from "./taskManagerMachine";

// Advanced compatibility example: this file keeps the older lit-html rendering
// path available for comparison, but it is not part of the config-free Ignite
// JSX happy path documented for v3.

const resolveTaskManagerView = ({
	snapshot,
}: {
	snapshot: StateFrom<typeof taskManagerMachine>;
}) => {
	const tasks = snapshot.context.tasks;
	const completedCount = tasks.filter((task) => task.completed).length;
	const totalTasks = tasks.length;
	const completionPercentage = totalTasks
		? (completedCount / totalTasks) * 100
		: 0;

	return {
		tasks,
		completedCount,
		totalTasks,
		completionPercentage,
		isCompleted: snapshot.matches("completed"),
		currentState: snapshot.value,
	};
};

const TaskManagerComponent = igniteCore({
	source: taskManagerMachine,
	view: resolveTaskManagerView,
	commands: ({ actor }) => ({
		addTask: (name: string, priority: string) =>
			actor.send({ type: "ADD", name, priority }),
		toggleTask: (index: number) => actor.send({ type: "TOGGLE", index }),
		resetTasks: () => actor.send({ type: "RESET" }),
	}),
});

TaskManagerComponent(
	"task-list",
	({ tasks, toggleTask }) => html`
      <div class="p-6 bg-green-50 border border-green-300 rounded-lg shadow-lg">
        <h3 class="text-xl font-semibold text-green-800 mb-4">Task List</h3>
        <ul class="space-y-4">
          ${tasks.map((task, index) => {
						// Determine background color based on priority
						const priorityColor =
							task.priority === "High"
								? "bg-red-400"
								: task.priority === "Medium"
									? "bg-yellow-400"
									: "bg-green-400";

						return html` <li
              class="grid p-4 border rounded-lg shadow-sm hover:shadow-md transition ${priorityColor}"
              style="grid-template-columns: 1fr auto; align-items: center"
            >
              <span
                class="text-md ${
									task.completed
										? "line-through text-gray-500"
										: "text-gray-900"
								}"
              >
                ${task.name}
              </span>
              <button
                @click=${() => toggleTask(index)}
                class="text-sm bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
              >
                ${task.completed ? "Undo" : "Complete"}
              </button>
            </li>`;
					})}
        </ul>
      </div>
    `,
);

TaskManagerComponent(
	"progress-bar",
	({ completedCount, totalTasks, completionPercentage }) => {
		const percentage = completionPercentage;
		const completed = completedCount;
		const total = totalTasks;

		const backgroundStyle =
			percentage === 100
				? "background: #22c55e;"
				: `background: linear-gradient(
            90deg,
            rgba(34, 197, 94, 1) 0%,
            rgba(251, 191, 36, 1) 50%,
            rgba(209, 213, 219, 0.1) 100%
          );`;

		return html`
      <div class="p-4 bg-blue-100 border rounded-md mt-2 mb-2">
        <h3 class="text-lg font-bold">Progress</h3>
        <div class="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div
            class="h-4 rounded-full transition-all duration-700 ease-out"
            style="width: ${percentage}%; ${backgroundStyle}"
          ></div>
        </div>
        <p class="mt-2">${completed}/${total} tasks completed</p>
      </div>
    `;
	},
);

TaskManagerComponent(
	"task-form",
	({ addTask }) => html`
      <div class="p-4 bg-yellow-100 border rounded-md mb-2">
        <h3 class="text-lg font-bold">Add Task</h3>
        <form
          @submit=${(event: SubmitEvent) => {
						event.preventDefault();
						const formElement = event.currentTarget;
						if (!(formElement instanceof HTMLFormElement)) {
							return;
						}
						const formData = new FormData(formElement);
						const nameEntry = formData.get("name");
						const priorityEntry = formData.get("priority");
						if (
							typeof nameEntry !== "string" ||
							typeof priorityEntry !== "string"
						) {
							return;
						}
						const trimmedName = nameEntry.trim();
						if (trimmedName) {
							addTask(trimmedName, priorityEntry);
							formElement.reset();
						}
					}}
          class="space-y-4"
        >
          <input
            type="text"
            name="name"
            class="border p-2 w-full"
            placeholder="Task Name"
            required
          />
          <select
            name="priority"
            class="border p-2 w-full rounded shadow-sm bg-white pr-8 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <button
            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Add Task
          </button>
        </form>
      </div>
    `,
);

TaskManagerComponent("confetti-effect", ({ totalTasks, resetTasks }) => {
	const total = totalTasks;

	return html`
      <div class="relative h-64 overflow-hidden">
        <!-- Celebration Message -->
        <div class="text-center mt-16">
          <h3 class="text-2xl font-bold text-green-700">
            🎉 Congratulations! 🎉
          </h3>
          <p class="text-md text-gray-600">You completed all ${total} tasks!</p>
          <button
            @click=${() => resetTasks()}
            class="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Reset Tasks
          </button>
        </div>
      </div>
    `;
});

TaskManagerComponent(
	"task-manager",
	({ isCompleted }) => html`
      <div class="p-4 space-y-4 max-w-fit mx-auto">
        ${
					isCompleted
						? html`<confetti-effect></confetti-effect>`
						: html`
              <task-list></task-list>
              <progress-bar></progress-bar>
              <task-form></task-form>
            `
				}
      </div>
    `,
);
