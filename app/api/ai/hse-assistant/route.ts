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
      system: 'Analisis baris-baris Job Safety Analysis (JSA) berikut. Cari baris di mana risiko bahaya tinggi (misal: ruang terbatas, api, listrik) tetapi mitigasinya sangat lemah atau pasif. Untuk setiap baris anomali yang ditemukan, kembalikan ID baris tersebut beserta draf komentar instruksi revisi yang spesifik agar HSE dapat langsung mengirimkannya ke vendor.',
      prompt: `Berikut adalah data JSA: ${JSON.stringify(jsaData)}`,
      schema: z.object({
        anomalies: z.array(z.object({
          id: z.number().describe('ID dari baris JSA yang memiliki anomali/kelemahan.'),
          auto_comment: z.string().describe('Draf komentar atau instruksi revisi spesifik untuk baris tersebut.'),
        })).describe('Daftar anomali yang ditemukan. Jika tidak ada anomali, kembalikan array kosong.'),
      }),
    });

    return NextResponse.json(object);
  } catch (error: any) {
    console.error('AI HSE Assistant Error:', error);
    return NextResponse.json({ error: 'Failed to analyze anomalies' }, { status: 500 });
  }
}
