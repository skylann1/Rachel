import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { jobStep } = await req.json();

    if (!jobStep || jobStep.trim() === '') {
      return NextResponse.json({ error: 'jobStep is required' }, { status: 400 });
    }

    const { object } = await generateObject({
      model: google('gemini-1.5-flash'),
      system: 'Anda adalah Ahli K3 Senior di industri Migas. Pengguna akan memberikan deskripsi langkah kerja (job step). Tugas Anda adalah mendeteksi 1 potensi bahaya utama (potential hazard) dan 1 tindakan pengendalian (mitigation) yang sesuai standar HSE. Jawab menggunakan bahasa Indonesia yang teknis dan padat.',
      prompt: `Langkah kerja: "${jobStep}"`,
      schema: z.object({
        hazard: z.string().describe('Potensi bahaya utama dari langkah kerja tersebut.'),
        mitigation: z.string().describe('Tindakan pengendalian atau mitigasi yang direkomendasikan.'),
      }),
    });

    return NextResponse.json(object);
  } catch (error: any) {
    console.error('AI Copilot Error:', error);
    return NextResponse.json({ error: 'Failed to generate AI response' }, { status: 500 });
  }
}
