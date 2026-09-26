import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const checkedInPath = path.resolve("src/types/database.ts");

const { stdout: generated } = await execFileAsync(
  "npx",
  ["supabase", "gen", "types", "typescript", "--local", "--schema", "public"],
  { maxBuffer: 10 * 1024 * 1024 },
);

const checkedIn = await readFile(checkedInPath, "utf8");
const normalize = (value) =>
  value
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();

if (normalize(checkedIn) === normalize(generated)) {
  process.stdout.write("Supabase database types are up to date.\n");
  process.exit(0);
}

const generatedPath = path.join(os.tmpdir(), "gogokinboshi-database.generated.ts");
await writeFile(generatedPath, generated, { mode: 0o600 });

try {
  const { stdout, stderr } = await execFileAsync(
    "diff",
    ["-u", checkedInPath, generatedPath],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  process.stderr.write(stdout || stderr);
} catch (error) {
  process.stderr.write(error.stdout || error.stderr || String(error));
}

throw new Error(
  "Supabase database types are stale. Regenerate src/types/database.ts from the local stack.",
);
