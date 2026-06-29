import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { jsaData } = await req.json();

    if (!jsaData || !Array.isArray(jsaData)) {
      return NextResponse.json({ error: 'Valid jsaData array is required' }, { status: 400 });
    }

    const { object } = await generateObject({
      model: google('gemini-1.5-flash'),
      system: 'Evaluasi dokumen Job Safety Analysis (JSA) berikut. Berikan skor kepatuhan K3 (0-100) berdasarkan kelengkapan identifikasi bahaya dan ketegasan mitigasi. Jika ada mitigasi yang bersifat pasif (misal: "berhati-hati", "waspada"), kurangi skor secara drastis. Kembalikan JSON berisi "score" dan "summary" singkat.',
      prompt: `Berikut adalah baris JSA yang diinput vendor: ${JSON.stringify(jsaData)}`,
      schema: z.object({
        score: z.number().min(0).max(100).describe('Skor kepatuhan K3 dari 0 hingga 100.'),
        summary: z.string().describe('Ringkasan evaluasi singkat maksimal 3 kalimat mengenai kekurangan atau kelebihan JSA ini.'),
      }),
    });

    return NextResponse.json(object);
  } catch (error: any) {
    console.error('AI Gatekeeper Error:', error);
    return NextResponse.json({ error: 'Failed to evaluate JSA' }, { status: 500 });
  }
}
