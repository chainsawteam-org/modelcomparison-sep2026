import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
await mkdir(".test-artifacts", { recursive: true });
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5188",
    "--strictPort",
  ],
  { stdio: "pipe" },
);
let serverError = "";
server.stderr.on("data", (d) => (serverError += d));
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null)
      throw Error(serverError || "Test server failed");
    try {
      if ((await fetch("http://127.0.0.1:5188")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready) throw Error("Test server did not start");
  for (const file of ["test-game.mjs", "test-combat.mjs"])
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [file], { stdio: "inherit" });
      child.on("exit", (code) =>
        code === 0 ? resolve() : reject(Error(file + " failed")),
      );
      child.on("error", reject);
    });
} finally {
  server.kill();
}
