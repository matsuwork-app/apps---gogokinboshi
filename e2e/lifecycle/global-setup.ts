import { createClient } from "@supabase/supabase-js";

const EXPECTED_GUARD = "gogokinboshi-lifecycle-e2e";
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";

export default async function globalSetup() {
  if (process.env.E2E_ALLOW_DB_MUTATIONS !== "true") {
    throw new Error("Lifecycle E2E requires E2E_ALLOW_DB_MUTATIONS=true");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

  if (supabaseUrl !== LOCAL_SUPABASE_URL) {
    throw new Error(`Lifecycle E2E only accepts ${LOCAL_SUPABASE_URL}`);
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for lifecycle E2E");
  }
  if (!/^http:\/\/(127\.0\.0\.1|localhost):3000$/.test(baseUrl)) {
    throw new Error("Lifecycle E2E only accepts a loopback application URL");
  }
  if (!process.env.E2E_MANAGER_PASSWORD) {
    throw new Error("E2E_MANAGER_PASSWORD is required for lifecycle E2E");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("e2e_environment_guard")
    .select("marker")
    .eq("marker", EXPECTED_GUARD)
    .single();

  if (error || data?.marker !== EXPECTED_GUARD) {
    throw new Error("Lifecycle E2E guard is missing; refusing database mutations");
  }
}
