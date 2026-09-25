// Runs the site from the repo folder with Python's built-in web server, then tests it in Chromium.
const {defineConfig} = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.js$/,
  timeout: 60000,
  expect: {timeout: 10000},
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", {open: "never"}]] : "list",
  use: {baseURL: "http://localhost:8765", viewport: {width: 1366, height: 900}, trace: "retain-on-failure"},
  webServer: {command: "python3 -m http.server 8765 --directory ..", url: "http://localhost:8765/index.html", reuseExistingServer: !process.env.CI, timeout: 30000},
});
