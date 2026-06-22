// Clears ingested data from Supabase.
//
// Usage (Node 20+, reads .env):
//   npm run cleanup                 # clear BOTH tables
//   npm run cleanup blockify        # clear only ideablocks
//   npm run cleanup naive           # clear only naive_chunks
//   npm run cleanup -- --source=my-file.pdf   # only rows from that source
//
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. " +
      "Run via `npm run cleanup` (loads .env) or pass --env-file=.env."
  );
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const sourceArg = args.find((a) => a.startsWith("--source="));
const source = sourceArg ? sourceArg.split("=")[1] : null;
const which = args.find((a) => !a.startsWith("--")) ?? "both";

const tables =
  which === "blockify"
    ? ["ideablocks"]
    : which === "naive"
      ? ["naive_chunks"]
      : ["ideablocks", "naive_chunks"];

for (const table of tables) {
  let query = supabase.from(table).delete();
  query = source ? query.eq("source", source) : query.not("id", "is", null);
  const { data, error } = await query.select("id");

  if (error) {
    console.error(`✗ ${table}: ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log(
      `✓ ${table}${source ? ` (source=${source})` : ""}: deleted ${
        data?.length ?? 0
      } rows`
    );
  }
}
