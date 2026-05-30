import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { geminiGenerateText, geminiGenerateJSON } from "./ai-gateway";
import type { GeminiMessage } from "./ai-gateway";
import { supabase } from "@/integrations/supabase/client";

// Helper to check if offline/local DB is enabled in browser
function isOffline() {
  return typeof window !== "undefined" && (window as any).__SUPABASE_OFFLINE__;
}

// Helper to get client-side userId
async function getClientUserId() {
  const { data } = await supabase.auth.getSession();
  if (!data?.session?.user?.id) {
    throw new Error("Unauthorized: Please sign in.");
  }
  return data.session.user.id;
}

/* ---------- Chat (planner / homework) ---------- */
const _aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tab: "planner" | "homework"; message: string }) => {
    return z.object({
      tab: z.enum(["planner", "homework"]),
      message: z.string().min(1).max(4000),
    }).parse(input);
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load last 20 messages for context
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role,content")
      .eq("tab", data.tab)
      .order("created_at", { ascending: true })
      .limit(20);

    const system = data.tab === "planner"
      ? `You are a friendly study planner assistant. Help the student build a realistic study timetable, suggest time blocks per subject, balance breaks, and remind them of homework. Be concise, use bullet lists or tables when helpful. If they share a subject/test date, propose a plan with specific time slots.`
      : `You are a patient AI tutor (Homework Assistant). Solve doubts step by step, explain concepts clearly, and produce neat study notes when asked. Use markdown headings, bullet points and short paragraphs. Show working for math/science problems.`;

    const messages: GeminiMessage[] = [
      { role: "system", content: system },
      ...((history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))),
      { role: "user", content: data.message },
    ];

    await supabase.from("chat_messages").insert({
      user_id: userId, tab: data.tab, role: "user", content: data.message,
    });

    const text = await geminiGenerateText(messages);

    await supabase.from("chat_messages").insert({
      user_id: userId, tab: data.tab, role: "assistant", content: text,
    });

    return { reply: text };
  });

export const aiChat = Object.assign(
  async (args: { data: { tab: "planner" | "homework"; message: string } }) => {
    if (isOffline()) {
      const userId = await getClientUserId();
      const { tab, message } = args.data;

      // Load last 20 messages for context
      const { data: history } = await supabase
        .from("chat_messages")
        .select("role,content")
        .eq("tab", tab)
        .order("created_at", { ascending: true })
        .limit(20);

      const system = tab === "planner"
        ? `You are a friendly study planner assistant. Help the student build a realistic study timetable, suggest time blocks per subject, balance breaks, and remind them of homework. Be concise, use bullet lists or tables when helpful. If they share a subject/test date, propose a plan with specific time slots.`
        : `You are a patient AI tutor (Homework Assistant). Solve doubts step by step, explain concepts clearly, and produce neat study notes when asked. Use markdown headings, bullet points and short paragraphs. Show working for math/science problems.`;

      const messages: GeminiMessage[] = [
        { role: "system", content: system },
        ...((history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))),
        { role: "user", content: message },
      ];

      await supabase.from("chat_messages").insert({
        user_id: userId, tab, role: "user", content: message,
      });

      const text = await geminiGenerateText(messages);

      await supabase.from("chat_messages").insert({
        user_id: userId, tab, role: "assistant", content: text,
      });

      return { reply: text };
    }
    return _aiChat(args);
  },
  _aiChat
);

/* ---------- Quiz generation ---------- */
const _generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; source: string; numQuestions?: number }) =>
    z.object({
      title: z.string().min(1).max(200),
      source: z.string().min(20).max(20000),
      numQuestions: z.number().min(3).max(15).optional(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const n = data.numQuestions ?? 8;

    const parsed = await geminiGenerateJSON<{
      questions: Array<{ question: string; options: string[]; answerIndex: number; explanation: string }>;
    }>(
      `Generate exactly ${n} multiple-choice quiz questions from the following study material. Each question must have 4 options with exactly one correct answer. Provide a brief explanation for the correct answer.\n\nRespond with a JSON object in this exact format:\n{"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "answerIndex": 0, "explanation": "..."}]}\n\nMATERIAL:\n${data.source}`,
      "You are an expert quiz generator for educational content. Always return valid JSON."
    );

    const { data: row, error } = await supabase.from("quizzes").insert({
      user_id: userId,
      title: data.title,
      questions: parsed.questions,
      total: parsed.questions.length,
    }).select("id").single();
    if (error) throw new Error(error.message);

    return { quizId: row.id, questions: parsed.questions };
  });

export const generateQuiz = Object.assign(
  async (args: { data: { title: string; source: string; numQuestions?: number } }) => {
    if (isOffline()) {
      const userId = await getClientUserId();
      const { title, source, numQuestions } = args.data;
      const n = numQuestions ?? 8;

      const parsed = await geminiGenerateJSON<{
        questions: Array<{ question: string; options: string[]; answerIndex: number; explanation: string }>;
      }>(
        `Generate exactly ${n} multiple-choice quiz questions from the following study material. Each question must have 4 options with exactly one correct answer. Provide a brief explanation for the correct answer.\n\nRespond with a JSON object in this exact format:\n{"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "answerIndex": 0, "explanation": "..."}]}\n\nMATERIAL:\n${source}`,
        "You are an expert quiz generator for educational content. Always return valid JSON."
      );

      const { data: row, error } = await supabase.from("quizzes").insert({
        user_id: userId,
        title,
        questions: parsed.questions,
        total: parsed.questions.length,
      }).select("id").single();
      if (error) throw new Error(error.message);

      return { quizId: row.id, questions: parsed.questions };
    }
    return _generateQuiz(args);
  },
  _generateQuiz
);

/* ---------- Daily motivation quote ---------- */
const _getDailyQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);

    const { data: existing } = await supabase
      .from("daily_quotes")
      .select("*")
      .eq("user_id", userId)
      .eq("quote_date", today)
      .maybeSingle();

    if (existing) return existing;

    const parsed = await geminiGenerateJSON<{ quote: string; author: string }>(
      `Generate one short, powerful motivational quote for a student studying today. Pick something fresh and not overly cliché. Keep it under 30 words. Provide the author if it's a real quote, or "Unknown" otherwise.\n\nRespond with a JSON object in this exact format:\n{"quote": "...", "author": "..."}`,
      "You are a motivational coach for students. Always return valid JSON."
    );

    const { data: row, error } = await supabase.from("daily_quotes").insert({
      user_id: userId,
      quote_date: today,
      quote_text: parsed.quote,
      author: parsed.author,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getDailyQuote = Object.assign(
  async (args: any) => {
    if (isOffline()) {
      const userId = await getClientUserId();
      const today = new Date().toISOString().slice(0, 10);

      const { data: existing } = await supabase
        .from("daily_quotes")
        .select("*")
        .eq("user_id", userId)
        .eq("quote_date", today)
        .maybeSingle();

      if (existing) return existing;

      const parsed = await geminiGenerateJSON<{ quote: string; author: string }>(
        `Generate one short, powerful motivational quote for a student studying today. Pick something fresh and not overly cliché. Keep it under 30 words. Provide the author if it's a real quote, or "Unknown" otherwise.\n\nRespond with a JSON object in this exact format:\n{"quote": "...", "author": "..."}`,
        "You are a motivational coach for students. Always return valid JSON."
      );

      const { data: row, error } = await supabase.from("daily_quotes").insert({
        user_id: userId,
        quote_date: today,
        quote_text: parsed.quote,
        author: parsed.author,
      }).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    return _getDailyQuote(args);
  },
  _getDailyQuote
);

/* ---------- Plan generator (one-shot) ---------- */
const _generatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { goal: string; daysAhead?: number }) =>
    z.object({ goal: z.string().min(5).max(2000), daysAhead: z.number().min(1).max(14).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const days = data.daysAhead ?? 7;
    const startDate = new Date();

    const parsed = await geminiGenerateJSON<{
      tasks: Array<{ day_offset: number; time: string; subject: string; title: string; duration_minutes: number }>;
    }>(
      `Build a realistic study timetable for the next ${days} days based on this goal: "${data.goal}". Spread tasks across the days. Use 24-hour time format (HH:MM). Day 0 = today.\n\nRespond with a JSON object in this exact format:\n{"tasks": [{"day_offset": 0, "time": "09:00", "subject": "...", "title": "...", "duration_minutes": 60}]}`,
      "You are an expert study planner. Create realistic, balanced study schedules. Always return valid JSON."
    );

    const rows = parsed.tasks.map((t) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + t.day_offset);
      return {
        user_id: userId,
        subject: t.subject,
        title: t.title,
        scheduled_date: d.toISOString().slice(0, 10),
        scheduled_time: t.time + ":00",
        duration_minutes: t.duration_minutes,
        task_type: "study",
      };
    });
    const { error } = await supabase.from("study_tasks").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const generatePlan = Object.assign(
  async (args: { data: { goal: string; daysAhead?: number } }) => {
    if (isOffline()) {
      const userId = await getClientUserId();
      const { goal, daysAhead } = args.data;
      const days = daysAhead ?? 7;
      const startDate = new Date();

      const parsed = await geminiGenerateJSON<{
        tasks: Array<{ day_offset: number; time: string; subject: string; title: string; duration_minutes: number }>;
      }>(
        `Build a realistic study timetable for the next ${days} days based on this goal: "${goal}". Spread tasks across the days. Use 24-hour time format (HH:MM). Day 0 = today.\n\nRespond with a JSON object in this exact format:\n{"tasks": [{"day_offset": 0, "time": "09:00", "subject": "...", "title": "...", "duration_minutes": 60}]}`,
        "You are an expert study planner. Create realistic, balanced study schedules. Always return valid JSON."
      );

      const rows = parsed.tasks.map((t) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + t.day_offset);
        return {
          user_id: userId,
          subject: t.subject,
          title: t.title,
          scheduled_date: d.toISOString().slice(0, 10),
          scheduled_time: t.time + ":00",
          duration_minutes: t.duration_minutes,
          task_type: "study",
        };
      });
      const { error } = await supabase.from("study_tasks").insert(rows);
      if (error) throw new Error(error.message);
      return { inserted: rows.length };
    }
    return _generatePlan(args);
  },
  _generatePlan
);
