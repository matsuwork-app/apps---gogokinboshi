import { randomBytes, randomInt, scrypt } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const outputPath = path.resolve(
  process.argv[2] ?? "/private/tmp/gogokinboshi-manager-credentials.json"
);
const password = String(randomInt(10_000_000, 100_000_000));
const salt = randomBytes(16);
const key = await scryptAsync(password, salt, 32, {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});
const passwordHash = [
  "scrypt",
  16_384,
  8,
  1,
  salt.toString("base64url"),
  key.toString("base64url"),
].join("$");
const sessionSecret = randomBytes(48).toString("base64url");

await writeFile(
  outputPath,
  `${JSON.stringify({ password, passwordHash, sessionSecret })}\n`,
  { mode: 0o600 }
);

process.stdout.write(`${JSON.stringify({ outputPath })}\n`);
