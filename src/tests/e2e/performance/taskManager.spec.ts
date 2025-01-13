import { test, expect } from "@playwright/test";

test.describe("TaskManager Performance Benchmarks", () => {
  test("should measure initialization time", async ({ page }) => {
    const startTime = performance.now();
    await page.goto("/");
    const endTime = performance.now();
    console.log(
      `${test.info().project.name} Initialization Time: ${
        endTime - startTime
      }ms`
    );
  });

  test("should measure task addition time", async ({ page }) => {
    await page.goto("/");

    const taskInput = page.locator("#taskInput");
    const addButton = page.locator("#addTaskButton");
    const taskList = page.locator(".task-list");

    const startTime = performance.now();
    await taskInput.fill("Performance Task");
    await addButton.click();
    const endTime = performance.now();

    console.log(
      `${test.info().project.name} Task Addition Time: ${endTime - startTime}ms`
    );

    await expect(taskList).toContainText("Performance Task");
  });

  test("should measure task read performance", async ({ page }) => {
    await page.goto("/");

    const taskInput = page.locator("#taskInput");
    const addButton = page.locator("#addTaskButton");

    // Add multiple tasks
    for (let i = 1; i <= 5; i++) {
      await taskInput.fill(`Task ${i}`);
      await addButton.click();
    }

    const taskList = page.locator(".task-list");

    const startTime = performance.now();
    const tasks = await taskList.locator("li").allTextContents();
    const endTime = performance.now();

    console.log(
      `${test.info().project.name} Task Read Time: ${endTime - startTime}ms`
    );

    expect(tasks.length).toBeGreaterThanOrEqual(5);
  });

  test("should measure task update performance", async ({ page }) => {
    await page.goto("/");

    const taskInput = page.locator("#taskInput");
    const addButton = page.locator("#addTaskButton");
    const taskList = page.locator(".task-list");

    // Add a task
    await taskInput.fill("Task to Update");
    await addButton.click();

    // Toggle completion
    const toggleButton = taskList.locator("button", { hasText: "Complete" });

    const startTime = performance.now();
    await toggleButton.click();
    const endTime = performance.now();

    console.log(
      `${test.info().project.name} Task Update Time: ${endTime - startTime}ms`
    );

    // Verify the task is marked as completed
    const completedTask = taskList.locator("li.completed");
    await expect(completedTask).toContainText("Task to Update");
  });

  test("should measure task deletion performance", async ({ page }) => {
    await page.goto("/");

    const taskInput = page.locator("#taskInput");
    const addButton = page.locator("#addTaskButton");
    const taskList = page.locator(".task-list");

    // Add a task
    await taskInput.fill("Task to Delete");
    await addButton.click();

    // Delete the task
    const deleteButton = taskList.locator("button", { hasText: "Delete" });

    const startTime = performance.now();
    await deleteButton.click();
    const endTime = performance.now();

    console.log(
      `${test.info().project.name} Task Deletion Time: ${endTime - startTime}ms`
    );

    // Verify the task is removed from the list
    await expect(taskList).not.toContainText("Task to Delete");
  });
});
