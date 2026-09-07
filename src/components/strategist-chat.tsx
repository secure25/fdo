"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Msg = {
  role: "user" | "assistant";
  text: string;
  actions?: { label: string; href: string }[];
};

const SUGGESTIONS = [
  "What should I work on today?",
  "Find me 20 customers.",
  "Why isn't LinkedIn working?",
  "Find people unhappy with my competitor.",
  "Which channel should I stop using?",
  "What should I post this week?",
  "How do I get my first 10 customers?",
  "Find partnership opportunities.",
];

export function StrategistChat({ greeting }: { greeting: string }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: greeting,
      actions: [{ label: "Open today's priorities", href: "/app" }],
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || streaming) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", text: "" }]);

    try {
      const res = await fetch("/api/strategist?stream=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", text: data?.error?.message ?? "The strategist is unavailable — try again." };
          return copy;
        });
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let actions: { label: string; href: string }[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const sep = full.indexOf("\n---ACTIONS---\n");
        const visible = sep >= 0 ? full.slice(0, sep) : full;
        if (sep >= 0) {
          try {
            actions = JSON.parse(full.slice(sep + 15)) as { label: string; href: string }[];
          } catch { /* actions parse later */ }
        }
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", text: visible, actions };
          return copy;
        });
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", text: "Network hiccup — ask me again." };
        return copy;
      });
    }
    setStreaming(false);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-3xl mx-auto w-full">
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-md bg-ink inline-flex items-center justify-center"><Sparkles size={15} className="text-white" /></span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight leading-none">AI Strategist</h1>
            <p className="text-2xs text-ink-faint mt-1">Grounded in your live product data — opportunities, funnels, prospects, experiments.</p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 space-y-4 pb-6">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-line animate-fade-up",
              m.role === "user" ? "bg-ink text-white rounded-br-sm" : "bg-paper-raise shadow-card text-ink-soft rounded-bl-sm"
            )}>
              {m.text || <span className="inline-block w-2 h-3.5 bg-ink-faint animate-pulse-soft" />}
              {m.actions && m.actions.length > 0 && m.text ? (
                <div className="mt-3 pt-3 border-t border-paper-line/60 flex flex-wrap gap-1.5">
                  {m.actions.map((a) => (
                    <Link key={a.href + a.label} href={a.href}>
                      <Badge tone="accent" className="cursor-pointer hover:opacity-80">
                        {a.label} <ArrowRight size={9} className="inline" />
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 sm:px-6 pb-6 pt-2 space-y-2.5">
        <div className="flex gap-1.5 flex-wrap">
          {SUGGESTIONS.slice(0, 6).map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={streaming}
              className="text-2xs text-ink-mute border border-paper-line rounded-full px-3 py-1.5 hover:border-ink/30 hover:text-ink transition disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
        <Card className="flex items-end gap-2 p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask your strategist…"
            className="flex-1 resize-none bg-transparent px-2.5 py-2 text-sm focus:outline-none max-h-32"
          />
          <Button size="sm" onClick={() => send(input)} disabled={streaming || !input.trim()}>
            <Sparkles size={13} /> Ask
          </Button>
        </Card>
      </div>
    </div>
  );
}
