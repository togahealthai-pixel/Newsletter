import { NextResponse } from "next/server";

const MAX_PAGES = 50;
const LIMIT = 100;
const FETCH_DAYS = 30; // always fetch max 30 days; client filters for shorter ranges

function parseResendDate(dateStr: string): Date {
  return new Date(dateStr.replace(" ", "T").replace("+00", "Z"));
}

function formatLabel(dateStr: string): string {
  const d = parseResendDate(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function fetchPage(
  apiKey: string,
  cursor?: string,
  attempt = 0
): Promise<Record<string, unknown>> {
  const url = new URL("https://api.resend.com/emails");
  url.searchParams.set("limit", String(LIMIT));
  if (cursor) url.searchParams.set("after", cursor);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  });

  if (res.status === 429 && attempt < 4) {
    const retryAfter = parseInt(res.headers.get("retry-after") || "3", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return fetchPage(apiKey, cursor, attempt + 1);
  }

  if (!res.ok) throw new Error(`Resend API error: ${res.status}`);
  return res.json();
}

export async function GET(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured in environment variables." },
      { status: 500 }
    );
  }

  // Always fetch last 30 days — client filters for shorter ranges
  // Use days-1 to match Resend's definition: "Last 30 days" = today back to (today - 29), inclusive
  const since = new Date();
  since.setDate(since.getDate() - (FETCH_DAYS - 1));
  since.setHours(0, 0, 0, 0);

  // Suppress unused warning
  void request;

  try {
    let allRaw: Record<string, unknown>[] = [];
    let cursor: string | undefined = undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await fetchPage(apiKey, cursor);
      const emails: Record<string, unknown>[] = (result.data as Record<string, unknown>[]) || [];

      allRaw = allRaw.concat(emails);

      if (!result.has_more || emails.length === 0) break;

      const oldest = emails[emails.length - 1];
      if (oldest) {
        const oldestDate = parseResendDate(String(oldest.created_at || ""));
        if (oldestDate < since) break;
      }

      cursor = String(emails[emails.length - 1].id);
    }

    // Filter to the 30-day window
    const allEmails = allRaw.filter((email) => {
      const emailDate = parseResendDate(String(email.created_at || ""));
      return emailDate >= since;
    });

    // Build per-day event counts — include ts so client can filter by date range
    const byDate: Record<string, Record<string, number>> = {};
    const dateSet = new Map<string, number>(); // label -> midnight timestamp

    for (const email of allEmails) {
      const raw = String(email.created_at || "");
      const label = formatLabel(raw);
      const ts = parseResendDate(raw).setHours(0, 0, 0, 0);
      const event = String(email.last_event || "sent")
        .toLowerCase()
        .replace(/\s+/g, "_");

      if (!byDate[label]) byDate[label] = {};
      byDate[label][event] = (byDate[label][event] || 0) + 1;
      if (!dateSet.has(label)) dateSet.set(label, ts);
    }

    // chartData includes ts so the client can filter without re-fetching
    const chartData = Array.from(dateSet.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([label, ts]) => ({ date: label, ts, ...byDate[label] }));

    return NextResponse.json({ chartData });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
