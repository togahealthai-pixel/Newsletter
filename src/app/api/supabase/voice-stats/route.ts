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
      `${url}/rest/v1/phonenumber?select=*&limit=${limit}&offset=${offset}&order=id.desc`,
      { headers }
    );
    const batch = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: typeof batch === "object" ? JSON.stringify(batch) : String(batch) }, { status: 500 });
    }
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
    max_duration_reached: 0,
    pending: 0,
  };
  const sentimentCounts: Record<string, number> = {};

  for (const row of allRows) {
    const s = String(row.status || "").toLowerCase();
    if (s === "lifted") statusCounts.lifted++;
    else if (s === "not_lifted") statusCounts.not_lifted++;
    else if (s === "inactivity") statusCounts.inactivity++;
    else if (s === "max_duration_reached") statusCounts.max_duration_reached++;
    else statusCounts.pending++;

    const sen = String(row.user_sentiment || "Not Called");
    sentimentCounts[sen] = (sentimentCounts[sen] || 0) + 1;
  }

  // Latest 5 rows sorted by created_at desc (falls back to id desc)
  const sorted = [...allRows].sort((a, b) => {
    const ta = a.created_at ? new Date(String(a.created_at)).getTime() : (Number(a.id) || 0);
    const tb = b.created_at ? new Date(String(b.created_at)).getTime() : (Number(b.id) || 0);
    return tb - ta;
  });
  const recentCalls = sorted.slice(0, 5);

  return NextResponse.json({
    total: allRows.length,
    statusCounts,
    sentimentCounts,
    recentCalls,
  });
}
