// @ts-check
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: true,
  reporter: [["list"]],
  webServer: {
    command: "python3 -m http.server 8811",
    url: "http://localhost:8811/index.html",
    reuseExistingServer: true,
    timeout: 10000
  },
  use: {
    baseURL: "http://localhost:8811",
    trace: "retain-on-failure"
  }
});
