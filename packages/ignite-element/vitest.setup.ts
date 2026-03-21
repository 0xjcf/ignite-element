import { vi } from "vitest";

// Suppress warnings
vi.spyOn(console, "warn").mockImplementation(() => {});

// Suppress errors
vi.spyOn(console, "error").mockImplementation(() => {});
