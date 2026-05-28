import { NextResponse } from "next/server";

const TABLES = ["table1", "table2", "table3", "table4", "table5", "table6"];

async function getLeadCount(url: string, key: string, table: string): Promise<number> {
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=count`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
    });
    const range = res.headers.get("content-range");
    return range ? parseInt(range.split("/")[1], 10) : 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Supabase credentials not configured." }, { status: 500 });
  }

  // Fetch campaigns and all lead counts in parallel
  const [campaignsRes, ...leadCountResults] = await Promise.all([
    fetch(`${url}/rest/v1/template_id?select=*&order=id.desc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }),
    ...TABLES.map((t) => getLeadCount(url, key, t)),
  ]);

  const campaigns = await campaignsRes.json();

  const leadCounts: Record<string, number> = {};
  TABLES.forEach((t, i) => { leadCounts[t] = leadCountResults[i] as number; });

  return NextResponse.json({ campaigns, leadCounts });
}
