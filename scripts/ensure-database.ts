import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
if (!databaseUrl.startsWith("file:")) process.exit(0);

const configuredPath = databaseUrl.slice("file:".length).split("?")[0];
const databasePath = isAbsolute(configuredPath)
  ? configuredPath
  : join(process.cwd(), "prisma", configuredPath);

mkdirSync(dirname(databasePath), { recursive: true });
if (!existsSync(databasePath)) closeSync(openSync(databasePath, "a"));
