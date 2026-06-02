import { NextResponse } from "next/server";

const TABLE = "Newsletter_campaigns";

function getHeaders(forDelete = false) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(forDelete ? {} : { Prefer: "return=representation" }),
  };
}

const BASE = () => `${process.env.SUPABASE_URL}/rest/v1/${TABLE}`;

// GET — fetch all campaigns newest first
export async function GET() {
  const res = await fetch(`${BASE()}?select=*&order=created_at.desc`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data }, { status: 500 });
  return NextResponse.json(data);
}

// POST — insert a new campaign
export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(BASE(), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      campaign_id:     body.campaignId     || null,
      campaign_name:   body.campaignName   || null,
      template_id:     body.templateId     || null,
      subscribers:     body.subscribers    || null,
      daily_limit:     body.dailyLimit     || null,
      created_at:      body.createdAt      || null,
      subject_line:    body.subjectLine    || null,
      preheader:       body.preheader      || null,
      header_title:    body.headerTitle    || null,
      intro:           body.intro          || null,
      main_story:      body.mainStory      || null,
      key_insights:    body.keyInsights    || null,
      industry_update: body.industryUpdate || null,
      pro_tip:         body.proTip         || null,
      call_to_action:  body.callToAction   || null,
      footer_note:     body.footerNote     || null,
    }),
  });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — delete by id if provided, otherwise clear all
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const url = id ? `${BASE()}?id=eq.${id}` : `${BASE()}?id=gte.0`;
  const res = await fetch(url, { method: "DELETE", headers: getHeaders(true) });
  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
