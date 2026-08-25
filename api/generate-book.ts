import { generateText, Output } from 'ai';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { fallbackBook, type BookGenerationInput, type BookPage } from '../lib/book';

export const config = { maxDuration: 60 };

const inputSchema = z.object({
  projectId: z.string().optional(), locale: z.enum(['fr', 'en']), title: z.string().min(1).max(100), subtitle: z.string().max(80), address: z.string().max(180), collection: z.string().max(30), coverColor: z.string().max(20),
  answers: z.record(z.string(), z.string().max(5000)),
  media: z.array(z.object({ id: z.string(), name: z.string().max(180), kind: z.enum(['photo', 'video', 'audio']), previewUrl: z.string().optional() })).max(40),
});
const pageSchema = z.object({
  kind: z.enum(['story', 'gallery', 'quote', 'timeline', 'interactive', 'closing']),
  eyebrow: z.string().max(50).optional(), title: z.string().max(90), body: z.string().max(1200), quote: z.string().max(350).optional(),
  mediaIds: z.array(z.string()).max(6), layout: z.enum(['editorial', 'full-photo', 'split', 'collage', 'minimal']),
});
const outputSchema = z.object({ pages: z.array(pageSchema).min(6).max(10) });

type ApiRequest = IncomingMessage & { body?: unknown };
const send = (response: ServerResponse, status: number, value: unknown) => { response.statusCode = status; response.setHeader('content-type', 'application/json; charset=utf-8'); response.end(JSON.stringify(value)); };

export default async function handler(request: ApiRequest, response: ServerResponse) {
  if (request.method !== 'POST') return send(response, 405, { error: 'Method not allowed' });
  let body = request.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return send(response, 400, { error: 'Informations incomplètes' });
  const input = parsed.data as BookGenerationInput;
  const generationId = crypto.randomUUID();
  const mediaList = input.media.map((item) => `${item.id}: ${item.kind} — ${item.name}`).join('\n') || 'Aucun média';
  const answers = Object.entries(input.answers).filter(([, value]) => value.trim()).map(([key, value]) => `${key}: ${value}`).join('\n');
  try {
    const result = await generateText({
      model: 'openai/gpt-5.6-luna',
      output: Output.object({ name: 'BookComposition', description: 'A refined page-by-page family memory book composition', schema: outputSchema }),
      system: `You are an expert editorial director for premium family memory books. Compose a warm, restrained, factual narrative using only the supplied memories. Never invent names, dates, addresses or events. Write in ${input.locale === 'en' ? 'English' : 'French'}. Produce 6 to 10 interior pages. Vary layouts. Assign only supplied media IDs. Photos can appear in print. Video and audio belong on an interactive page and are represented in print by a private QR link. Keep prose elegant, natural and concise. Never mention artificial intelligence, automation, a model, or generation.`,
      prompt: `TITLE: ${input.title}\nSUBTITLE: ${input.subtitle}\nADDRESS: ${input.address}\nCOLLECTION: ${input.collection}\n\nFAMILY ANSWERS:\n${answers || 'No detailed answer yet; keep copy minimal and invite later editing.'}\n\nAVAILABLE MEDIA:\n${mediaList}`,
    });
    const base = fallbackBook(input, generationId);
    const pages: BookPage[] = [base.pages[0], ...result.output.pages.map((page) => ({ ...page, id: crypto.randomUUID() }))];
    const generated = { ...base, pages };
    return send(response, 200, { book: generated, generation: { id: generationId, model: 'openai/gpt-5.6-luna', usage: result.totalUsage, finishReason: result.finishReason } });
  } catch (error) {
    console.error('Book composition failed; returning resilient composition.', error);
    return send(response, 200, { book: fallbackBook(input, generationId), generation: { id: generationId, model: 'resilient-editorial', fallback: true } });
  }
}
