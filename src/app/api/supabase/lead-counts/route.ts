import { NextResponse } from "next/server";

const TABLES = ["table1", "table2", "table3", "table4", "table5", "table6"];

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Supabase credentials not configured." }, { status: 500 });
  }

  const counts: Record<string, number> = {};

  await Promise.all(
    TABLES.map(async (table) => {
      try {
        const res = await fetch(`${url}/rest/v1/${table}?select=count`, {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Prefer: "count=exact",
          },
        });
        const range = res.headers.get("content-range"); // e.g. "0-0/1022"
        counts[table] = range ? parseInt(range.split("/")[1], 10) : 0;
      } catch {
        counts[table] = 0;
      }
    })
  );

  return NextResponse.json(counts);
}
