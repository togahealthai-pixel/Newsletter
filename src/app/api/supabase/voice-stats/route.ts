import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Supabase credentials not configured." }, { status: 500 });
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: "count=exact",
  };

  // Fetch all rows (paginate up to 10k)
  const allRows: Record<string, unknown>[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const res = await fetch(
      `${url}/rest/v1/phonenumber?select=id,status,user_sentiment,Name,number,summary,recording_url&limit=${limit}&offset=${offset}&order=id.desc`,
      { headers }
    );
    const batch: Record<string, unknown>[] = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    allRows.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  // Count statuses
  const statusCounts: Record<string, number> = {
    lifted: 0,
    not_lifted: 0,
    inactivity: 0,
    pending: 0,
  };
  const sentimentCounts: Record<string, number> = {};

  for (const row of allRows) {
    const s = String(row.status || "").toLowerCase();
    if (s === "lifted") statusCounts.lifted++;
    else if (s === "not_lifted") statusCounts.not_lifted++;
    else if (s === "inactivity") statusCounts.inactivity++;
    else statusCounts.pending++;

    const sen = String(row.user_sentiment || "Not Called");
    sentimentCounts[sen] = (sentimentCounts[sen] || 0) + 1;
  }

  // Recent calls (lifted or has summary)
  const recentCalls = allRows
    .filter((r) => r.status && r.status !== null)
    .slice(0, 20);

  return NextResponse.json({
    total: allRows.length,
    statusCounts,
    sentimentCounts,
    recentCalls,
  });
}
