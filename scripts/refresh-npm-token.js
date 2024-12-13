import { execSync } from "child_process";

export default async function refreshNpmToken() {
  try {
    console.log("🚀 Starting refreshNpmToken...");
    console.log(
      "🌍 Environment Variables:",

      JSON.stringify({
        GITHUB_TOKEN: process.env.GITHUB_TOKEN ? "********" : "undefined",
        REPO_NAME: process.env.REPO_NAME || "undefined",
      })
    );

    // Generate a new NPM token
    console.log("🔑 Generating a new NPM token...");
    const newToken = execSync("npm token create --read-only --publish", {
      encoding: "utf8",
    }).trim();
    console.log("✅ New token generated successfully:", newToken);

    // Validate environment variables
    const githubToken = process.env.GITHUB_TOKEN;
    const repo = process.env.REPO_NAME;

    if (!githubToken || !repo) {
      console.error(
        "❌ Missing GITHUB_TOKEN or REPO_NAME environment variables."
      );
      throw new Error(
        "Missing GITHUB_TOKEN or REPO_NAME environment variables."
      );
    }

    // Update the token in GitHub Secrets
    console.log("🔄 Updating token in GitHub Secrets...");
    const response = await fetch(
      `https://api.github.com/repos/${repo}/actions/secrets/NPM_TOKEN`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          encrypted_value: newToken,
        }),
      }
    );

    if (!response.ok) {
      console.error("❌ Failed to update secret:", response.statusText);
      throw new Error(`Failed to update secret: ${response.statusText}`);
    }

    console.log("✅ Token updated in GitHub Secrets successfully.");
  } catch (error) {
    if (error instanceof Error)
      console.error("❌ Failed to refresh NPM token:", error.message);
    throw error;
  }
}
