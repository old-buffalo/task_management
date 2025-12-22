import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function run(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }).trim();
}

function getStatusJson() {
  const attempts = [
    "npx --yes supabase status --output json",
    "npx --yes supabase status -o json",
    "supabase status --output json",
    "supabase status -o json",
  ];
  let lastErr;
  for (const cmd of attempts) {
    try {
      return JSON.parse(run(cmd));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Unable to read supabase status");
}

function pick(status, keys) {
  for (const k of keys) {
    if (status && typeof status === "object" && k in status) return status[k];
  }
  return undefined;
}

const status = getStatusJson();

// Support multiple CLI versions/shapes.
const apiUrl =
  pick(status, ["api_url", "apiUrl", "API_URL"]) ??
  pick(status?.api, ["url", "api_url"]);
const anonKey =
  pick(status, ["anon_key", "anonKey", "ANON_KEY"]) ??
  pick(status?.api, ["anon_key", "anonKey"]);
const serviceRoleKey =
  pick(status, ["service_role_key", "serviceRoleKey", "SERVICE_ROLE_KEY"]) ??
  pick(status?.api, ["service_role_key", "serviceRoleKey"]);

if (!apiUrl || !anonKey || !serviceRoleKey) {
  console.error("Could not find api_url/anon_key/service_role_key in supabase status output.");
  console.error("Got keys:", Object.keys(status ?? {}));
  process.exit(1);
}

const env = `# Auto-generated from: supabase status --output json
NEXT_PUBLIC_SUPABASE_URL=${apiUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}
SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}
`;

writeFileSync(new URL("../.env.local", import.meta.url), env, "utf8");
console.log("Wrote .env.local for local Supabase.");

