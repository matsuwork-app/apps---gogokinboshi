import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const TABLES = [
  "members",
  "events",
  "event_participants",
  "matches",
  "match_lineups",
  "goals",
  "playing_intervals",
];
const PAGE_SIZE = 1_000;

function parseEnv(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        const rawValue = line.slice(separator + 1).trim();
        const value = rawValue.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
        return [key, value];
      })
  );
}

async function readConfiguration() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const fileEnv = parseEnv(await readFile(envPath, "utf8"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }
  if (!url.startsWith("https://") || !url.endsWith(".supabase.co")) {
    throw new Error("Refusing to export from an unexpected Supabase URL");
  }

  return { url, anonKey };
}

async function fetchTable(supabase, table) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

const { url, anonKey } = await readConfiguration();
const supabase = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const exportedAt = new Date().toISOString();
const data = Object.fromEntries(
  await Promise.all(TABLES.map(async (table) => [table, await fetchTable(supabase, table)]))
);
const payload = {
  format: "gogokinboshi-supabase-json-v1",
  exported_at: exportedAt,
  row_counts: Object.fromEntries(TABLES.map((table) => [table, data[table].length])),
  data,
};
const serialized = `${JSON.stringify(payload, null, 2)}\n`;
const checksum = createHash("sha256").update(serialized).digest("hex");
const safeTimestamp = exportedAt.replaceAll(":", "-");
const outputDirectory = path.resolve(process.cwd(), "backups");
const outputPath = path.join(outputDirectory, `supabase-data-${safeTimestamp}.json`);

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, serialized, { mode: 0o600 });

process.stdout.write(
  `${JSON.stringify({ outputPath, checksum, rowCounts: payload.row_counts })}\n`
);
