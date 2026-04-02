const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 9090;
const HOST = "127.0.0.1";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, ".data");
const STATE_FILE = path.join(DATA_DIR, "app-state.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

const DEFAULT_STATE = {
  documents: [],
  settings: {
    theme: "light",
    themeSource: "system",
    sidebarCollapsed: false
  }
};

async function ensureStateFile() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.promises.access(STATE_FILE, fs.constants.F_OK);
  } catch {
    await fs.promises.writeFile(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2), "utf8");
  }
}

async function readState() {
  await ensureStateFile();
  const raw = await fs.promises.readFile(STATE_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return {
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      settings: {
        ...DEFAULT_STATE.settings,
        ...(parsed.settings || {})
      }
    };
  } catch {
    return DEFAULT_STATE;
  }
}

async function writeState(nextState) {
  await ensureStateFile();
  const safeState = {
    documents: Array.isArray(nextState.documents) ? nextState.documents : [],
    settings: {
      ...DEFAULT_STATE.settings,
      ...(nextState.settings || {})
    }
  };
  await fs.promises.writeFile(STATE_FILE, JSON.stringify(safeState, null, 2), "utf8");
  return safeState;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      res.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

http
  .createServer(async (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

    if (requestUrl.pathname === "/api/state") {
      try {
        if (req.method === "GET") {
          const state = await readState();
          sendJson(res, 200, state);
          return;
        }

        if (req.method === "PUT") {
          const rawBody = await readRequestBody(req);
          const nextState = rawBody ? JSON.parse(rawBody) : DEFAULT_STATE;
          const savedState = await writeState(nextState);
          sendJson(res, 200, savedState);
          return;
        }

        sendJson(res, 405, { error: "Method not allowed" });
        return;
      } catch (error) {
        sendJson(res, 500, { error: "Failed to process state request" });
        return;
      }
    }

    const urlPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(PUBLIC_DIR, safePath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    sendFile(res, filePath);
  })
  .listen(PORT, HOST, () => {
    console.log(`Markdown Task Notebook running at http://${HOST}:${PORT}`);
  });
