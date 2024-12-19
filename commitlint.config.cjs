module.exports = {
  extends: ["@commitlint/config-conventional"],
  ignores: [
    (message) =>
      message.includes("bump version") ||
      message.includes("release") ||
      message === "Version Packages",
  ],
};
