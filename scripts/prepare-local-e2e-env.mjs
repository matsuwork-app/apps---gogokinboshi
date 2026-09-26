import { appendFile, readFile } from "node:fs/promises";
import process from "node:process";

const [statusPath, credentialsPath, outputPath] = process.argv.slice(2);
if (!statusPath || !credentialsPath || !outputPath) {
  throw new Error("Usage: prepare-local-e2e-env.mjs <supabase.env> <credentials.json> <output.env>");
}

const statusText = await readFile(statusPath, "utf8");
const status = Object.fromEntries(
  statusText
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1).replace(/^"|"$/g, "")];
    }),
);
const credentials = JSON.parse(await readFile(credentialsPath, "utf8"));

for (const key of ["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]) {
  if (!status[key]) throw new Error(`Supabase status is missing ${key}`);
}
for (const key of ["password", "passwordHash", "sessionSecret"]) {
  if (!credentials[key]) throw new Error(`Manager credentials are missing ${key}`);
}

const values = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  MANAGER_PASSWORD_HASH: credentials.passwordHash,
  MANAGER_SESSION_SECRET: credentials.sessionSecret,
  E2E_MANAGER_PASSWORD: credentials.password,
  E2E_ALLOW_DB_MUTATIONS: "true",
  PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3000",
};

for (const value of Object.values(values)) {
  process.stdout.write(`::add-mask::${value}\n`);
}
await appendFile(
  outputPath,
  Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(""),
  { mode: 0o600 },
);
