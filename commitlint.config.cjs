module.exports = {
  extends: ["@commitlint/config-conventional"],
  ignores: [(message) => message === "Version Packages"],
  rules: {
    "subject-empty": [2, "never"],
    "type-empty": [2, "never"],
  },
};
