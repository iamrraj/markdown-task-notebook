#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = 9090;
const APP_URL = `http://${HOST}:${PORT}`;
const SERVER_PATH = path.resolve(__dirname, "..", "server.js");

function printHelp() {
  console.log(`
markdown-notebook

Usage:
  markdown-notebook
  markdown-notebook start
  markdown-notebook open
  markdown-notebook url
  markdown-notebook help

Commands:
  start   Start the local notebook server on ${APP_URL}
  open    Open the notebook URL in your default browser
  url     Print the notebook URL
  help    Show this help message
`.trim());
}

function openBrowser(url) {
  const platform = process.platform;

  if (platform === "darwin") {
    return spawn("open", [url], { stdio: "ignore", detached: true }).unref();
  }

  if (platform === "win32") {
    return spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
  }

  return spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
}

function startServer() {
  const child = spawn(process.execPath, [SERVER_PATH], {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST
    }
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

const command = (process.argv[2] || "start").toLowerCase();

if (command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (command === "url") {
  console.log(APP_URL);
  process.exit(0);
}

if (command === "open") {
  openBrowser(APP_URL);
  console.log(`Opened ${APP_URL}`);
  process.exit(0);
}

if (command === "start") {
  startServer();
} else {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}
