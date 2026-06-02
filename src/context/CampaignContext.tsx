"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Campaign {
  id?: number;
  campaignId: string;
  campaignName: string;
  templateId: string;
  subscribers: string;
  dailyLimit: number;
  createdAt: string;
  subjectLine?: string;
  preheader?: string;
  headerTitle?: string;
  intro?: string;
  mainStory?: string;
  keyInsights?: string;
  industryUpdate?: string;
  proTip?: string;
  callToAction?: string;
  footerNote?: string;
}

interface CampaignContextValue {
  history: Campaign[];
  loading: boolean;
  addCampaign: (c: Campaign) => Promise<void>;
  deleteCampaign: (id: number) => Promise<void>;
  clearHistory: () => Promise<void>;
}

const CampaignContext = createContext<CampaignContextValue | null>(null);

function mapRow(row: Record<string, unknown>): Campaign {
  return {
    id:            row.id ? Number(row.id) : undefined,
    campaignId:    String(row.campaign_id   || ""),
    campaignName:  String(row.campaign_name || ""),
    templateId:    String(row.template_id   || ""),
    subscribers:   String(row.subscribers   || ""),
    dailyLimit:    Number(row.daily_limit   || 0),
    createdAt:     String(row.created_at    || ""),
    subjectLine:    row.subject_line    ? String(row.subject_line)    : undefined,
    preheader:      row.preheader       ? String(row.preheader)       : undefined,
    headerTitle:    row.header_title    ? String(row.header_title)    : undefined,
    intro:          row.intro           ? String(row.intro)           : undefined,
    mainStory:      row.main_story      ? String(row.main_story)      : undefined,
    keyInsights:    row.key_insights    ? String(row.key_insights)    : undefined,
    industryUpdate: row.industry_update ? String(row.industry_update) : undefined,
    proTip:         row.pro_tip         ? String(row.pro_tip)         : undefined,
    callToAction:   row.call_to_action  ? String(row.call_to_action)  : undefined,
    footerNote:     row.footer_note     ? String(row.footer_note)     : undefined,
  };
}

export function CampaignProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/supabase/newsletter-campaigns")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setHistory(data.map(mapRow));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addCampaign = async (c: Campaign) => {
    setHistory((prev) => [c, ...prev]);
    try {
      await fetch("/api/supabase/newsletter-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
    } catch {}
  };

  const deleteCampaign = async (id: number) => {
    setHistory((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch(`/api/supabase/newsletter-campaigns?id=${id}`, { method: "DELETE" });
    } catch {}
  };

  const clearHistory = async () => {
    setHistory([]);
    try {
      await fetch("/api/supabase/newsletter-campaigns", { method: "DELETE" });
    } catch {}
  };

  return (
    <CampaignContext.Provider value={{ history, loading, addCampaign, deleteCampaign, clearHistory }}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaigns() {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error("useCampaigns must be used within CampaignProvider");
  return ctx;
}
