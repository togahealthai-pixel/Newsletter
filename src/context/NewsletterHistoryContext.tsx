"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { NewsletterData } from "./NewsletterContext";

export interface NewsletterHistoryItem {
  id: string;
  service: string;
  topic: string;
  newsletter: NewsletterData | null;
  rawFallback: string;
  templateId: string;
  status: "generated" | "proceeded";
  createdAt: string;
}

interface HistoryContextValue {
  history: NewsletterHistoryItem[];
  loading: boolean;
  addEntry: (entry: Omit<NewsletterHistoryItem, "createdAt">) => void;
  updateEntry: (id: string, patch: Partial<NewsletterHistoryItem>) => void;
  removeEntry: (id: string) => void;
  clearHistory: () => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

function mapRow(row: Record<string, unknown>): NewsletterHistoryItem {
  const hasContent = row.subject_line || row.header_title || row.intro;
  return {
    id: String(row.id || ""),
    service: "",
    topic: String(row.subject_line || row.header_title || ""),
    newsletter: hasContent ? {
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
    } : null,
    rawFallback: "",
    templateId: String(row.template_id || ""),
    status: row.template_id ? "proceeded" : "generated",
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

export function NewsletterHistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<NewsletterHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from Supabase on mount
  useEffect(() => {
    fetch("/api/supabase/newsletter-campaigns")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setHistory(data.map(mapRow));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addEntry = (entry: Omit<NewsletterHistoryItem, "createdAt">) => {
    const newItem: NewsletterHistoryItem = { ...entry, createdAt: new Date().toISOString() };
    setHistory((prev) => [newItem, ...prev]);
  };

  const updateEntry = (id: string, patch: Partial<NewsletterHistoryItem>) => {
    setHistory((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const removeEntry = async (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    try {
      const res = await fetch(`/api/supabase/newsletter-campaigns?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.text();
        console.error("Delete failed:", err);
      }
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  const clearHistory = async () => {
    setHistory([]);
    try {
      await fetch("/api/supabase/newsletter-campaigns", { method: "DELETE" });
    } catch {}
  };

  return (
    <HistoryContext.Provider value={{ history, loading, addEntry, updateEntry, removeEntry, clearHistory }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useNewsletterHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useNewsletterHistory must be used within NewsletterHistoryProvider");
  return ctx;
}
