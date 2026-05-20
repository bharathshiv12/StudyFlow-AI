import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway";
import { generateText, Output } from "ai";

const MODEL = "google/gemini-3-flash-preview";

function getModel() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI gateway is not configured. Please add credits to continue.");
  return createLovableAiGatewayProvider(key)(MODEL);
}

/* ---------- Chat (planner / homework) ---------- */
export const aiChat = createServerFn({ method: "POST" })
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

    const messages = [
      { role: "system" as const, content: system },
      ...((history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))),
      { role: "user" as const, content: data.message },
    ];

    await supabase.from("chat_messages").insert({
      user_id: userId, tab: data.tab, role: "user", content: data.message,
    });

    const { text } = await generateText({ model: getModel(), messages });

    await supabase.from("chat_messages").insert({
      user_id: userId, tab: data.tab, role: "assistant", content: text,
    });

    return { reply: text };
  });

/* ---------- Quiz generation ---------- */
export const generateQuiz = createServerFn({ method: "POST" })
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

    const { text } = await generateText({
      model: getModel(),
      output: Output.object({
        schema: z.object({
          questions: z.array(z.object({
            question: z.string(),
            options: z.array(z.string()).length(4),
            answerIndex: z.number().min(0).max(3),
            explanation: z.string(),
          })).min(3),
        }),
      }),
      prompt: `Generate exactly ${n} multiple-choice quiz questions from the following study material. Each question must have 4 options with exactly one correct answer. Provide a brief explanation for the correct answer.\n\nMATERIAL:\n${data.source}`,
    });

    const parsed = JSON.parse(text) as { questions: Array<{ question: string; options: string[]; answerIndex: number; explanation: string }> };

    const { data: row, error } = await supabase.from("quizzes").insert({
      user_id: userId,
      title: data.title,
      questions: parsed.questions,
      total: parsed.questions.length,
    }).select("id").single();
    if (error) throw new Error(error.message);

    return { quizId: row.id, questions: parsed.questions };
  });

/* ---------- Daily motivation quote ---------- */
export const getDailyQuote = createServerFn({ method: "POST" })
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

    const { text } = await generateText({
      model: getModel(),
      output: Output.object({
        schema: z.object({
          quote: z.string(),
          author: z.string(),
        }),
      }),
      prompt: `Generate one short, powerful motivational quote for a student studying today. Pick something fresh and not overly cliché. Keep it under 30 words. Provide the author if it's a real quote, or "Unknown" otherwise.`,
    });
    const parsed = JSON.parse(text) as { quote: string; author: string };

    const { data: row, error } = await supabase.from("daily_quotes").insert({
      user_id: userId,
      quote_date: today,
      quote_text: parsed.quote,
      author: parsed.author,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

/* ---------- Plan generator (one-shot) ---------- */
export const generatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { goal: string; daysAhead?: number }) =>
    z.object({ goal: z.string().min(5).max(2000), daysAhead: z.number().min(1).max(14).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const days = data.daysAhead ?? 7;
    const startDate = new Date();

    const { text } = await generateText({
      model: getModel(),
      output: Output.object({
        schema: z.object({
          tasks: z.array(z.object({
            day_offset: z.number().min(0).max(days - 1),
            time: z.string().regex(/^\d{2}:\d{2}$/),
            subject: z.string(),
            title: z.string(),
            duration_minutes: z.number().min(15).max(180),
          })).min(1).max(40),
        }),
      }),
      prompt: `Build a realistic study timetable for the next ${days} days based on this goal: "${data.goal}". Spread tasks across the days. Use 24-hour time. Day 0 = today.`,
    });
    const parsed = JSON.parse(text) as { tasks: Array<{ day_offset: number; time: string; subject: string; title: string; duration_minutes: number }> };

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
