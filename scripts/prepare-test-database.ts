import { closeSync, existsSync, openSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const databasePath = join(process.cwd(), "prisma", "test.db");
if (existsSync(databasePath)) rmSync(databasePath);
closeSync(openSync(databasePath, "a"));

const environment = { ...process.env, DATABASE_URL: "file:./test.db" };
const prismaCli = join(
  process.cwd(),
  "node_modules",
  "prisma",
  "build",
  "index.js",
);
execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  cwd: process.cwd(),
  env: environment,
  stdio: "inherit",
});
execFileSync(process.execPath, [prismaCli, "db", "seed"], {
  cwd: process.cwd(),
  env: environment,
  stdio: "inherit",
});
