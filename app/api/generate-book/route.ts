import { generateText, Output } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  fallbackBook,
  type BookGenerationInput,
  type BookPage,
} from '../../../lib/book';

export const dynamic = 'force-dynamic';

const inputSchema = z.object({
  projectId: z.string().optional(),
  locale: z.enum(['fr', 'en']),
  title: z.string().min(1).max(100),
  subtitle: z.string().max(80),
  address: z.string().max(180),
  collection: z.string().max(30),
  coverColor: z.string().max(20),
  answers: z.record(z.string(), z.string().max(5000)),
  media: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().max(180),
        kind: z.enum(['photo', 'video', 'audio']),
        previewUrl: z.string().optional(),
        storageKey: z.string().optional(),
      }),
    )
    .max(40),
});

const pageSchema = z.object({
  kind: z.enum([
    'story',
    'gallery',
    'quote',
    'timeline',
    'interactive',
    'closing',
  ]),
  eyebrow: z.string().max(50).nullable(),
  title: z.string().max(90),
  body: z.string().max(1200),
  quote: z.string().max(350).nullable(),
  mediaIds: z.array(z.string()).max(6),
  layout: z.enum(['editorial', 'full-photo', 'split', 'collage', 'minimal']),
});

const outputSchema = z.object({ pages: z.array(pageSchema).min(6).max(12) });
const defaultModel = process.env.BOOK_MODEL || 'openai/gpt-4.1-nano';

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Informations incomplètes' },
      { status: 400 },
    );
  }

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Informations incomplètes' },
      { status: 400 },
    );
  }

  const input = parsed.data as BookGenerationInput;
  const generationId = crypto.randomUUID();
  const suppliedMediaIds = new Set(input.media.map((item) => item.id));
  const mediaList =
    input.media
      .map((item) => `${item.id}: ${item.kind} — ${item.name}`)
      .join('\n') || 'Aucun média';
  const answers =
    Object.entries(input.answers)
      .filter(([, value]) => value.trim())
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n') ||
    (input.locale === 'en'
      ? 'No detailed answer yet.'
      : 'Aucune réponse détaillée pour le moment.');

  try {
    const result = await generateText({
      model: defaultModel,
      output: Output.object({
        name: 'BookComposition',
        description: 'A refined page-by-page family memory book composition',
        schema: outputSchema,
      }),
      system: `You are an expert editorial director for premium family memory books. Compose a warm, restrained, factual narrative using only the supplied memories. Never invent names, dates, addresses, people, relationships, places, events or attributed emotions. Write in ${input.locale === 'en' ? 'English' : 'French'}. Produce 6 to 10 interior pages. Vary layouts. Assign only supplied media IDs. Photos can appear in print. Video and audio belong on an interactive page and are represented in print by a private QR link. Keep prose elegant, natural and very short: each page body is 1 to 3 short sentences, 40 words maximum; titles are 6 words maximum; eyebrows 3 words maximum; quotes 15 words maximum and only when a family answer supports them. Photos should dominate the page. Never mention artificial intelligence, automation, a model, or generation.`,
      prompt: `TITLE: ${input.title}\nSUBTITLE: ${input.subtitle}\nADDRESS: ${input.address}\nCOLLECTION: ${input.collection}\n\nFAMILY ANSWERS:\n${answers}\n\nAVAILABLE MEDIA:\n${mediaList}`,
    });

    const base = fallbackBook(input, generationId);
    const composedPages: BookPage[] = result.output.pages.map((page) => ({
        ...page,
        eyebrow: page.eyebrow ?? undefined,
        quote: page.quote ?? undefined,
        mediaIds: page.mediaIds.filter((id) => suppliedMediaIds.has(id)),
        id: crypto.randomUUID(),
      }));
    const pages: BookPage[] = [base.pages[0], ...composedPages, ...base.pages.slice(1 + composedPages.length)].slice(0, 25);

    return NextResponse.json({
      book: { ...base, pages },
      generation: {
        id: generationId,
        model: defaultModel,
        usage: result.totalUsage,
        finishReason: result.finishReason,
      },
    });
  } catch (error) {
    console.error('Book composition failed; using resilient composition.', error);
    return NextResponse.json({
      book: fallbackBook(input, generationId),
      generation: {
        id: generationId,
        model: 'resilient-editorial',
        fallback: true,
      },
    });
  }
}
