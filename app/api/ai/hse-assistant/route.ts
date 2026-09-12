import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

const responseSchema = z.object({
  score: z.number().min(0).max(100).describe('Skor kepatuhan K3 keseluruhan dari 0 hingga 100. Kurangi drastis jika mitigasi bersifat pasif (misal: "berhati-hati", "waspada").'),
  summary: z.string().describe('Ringkasan evaluasi keseluruhan maksimal 3 kalimat, menyebutkan kelebihan dan kekurangan utama JSA ini.'),
  anomalies: z.array(z.object({
    id: z.number().describe('step_number / nomor urut baris JSA yang memiliki anomali.'),
    severity: z.enum(['critical', 'warning', 'info']).describe(
      'Tingkat keparahan: "critical" jika risiko tinggi (ruang terbatas, api, listrik, ketinggian) dengan mitigasi lemah/tidak ada; "warning" jika mitigasi ada tapi pasif atau kurang spesifik; "info" jika hanya saran peningkatan kecil.'
    ),
    category: z.string().describe('Kategori singkat masalah, misal: "Mitigasi Pasif", "Bahaya Tidak Teridentifikasi", "APD Tidak Disebutkan", "Risiko Jatuh Terabaikan".'),
    auto_comment: z.string().describe('Draf komentar atau instruksi revisi spesifik untuk baris tersebut agar HSE dapat langsung mengirimkannya ke vendor.'),
    suggested_hazard: z.string().optional().describe('Saran perbaikan deskripsi potensi bahaya yang lebih akurat untuk baris ini. Kosongkan jika deskripsi bahaya sudah memadai.'),
    suggested_mitigation: z.string().optional().describe('Saran tindakan mitigasi konkret yang sesuai standar HSE industri Migas untuk baris ini. Kosongkan jika mitigasi sudah memadai.'),
  })).describe('Daftar anomali yang ditemukan. Jika tidak ada anomali, kembalikan array kosong.'),
});

const SYSTEM_PROMPT = `Anda adalah Ahli K3 Senior di industri Migas dengan pengalaman 20+ tahun. Anda menerima data Job Safety Analysis (JSA) yang diinput vendor. Tugas Anda tiga bagian:

1. SCORING — Evaluasi keseluruhan dokumen JSA. Berikan skor kepatuhan K3 (0-100) berdasarkan:
   - Kelengkapan identifikasi bahaya di setiap langkah
   - Ketegasan dan spesifisitas mitigasi (kurangi skor DRASTIS jika mitigasi pasif seperti "berhati-hati", "waspada", "jaga jarak")
   - Konsistensi hierarki pengendalian (eliminasi → substitusi → rekayasa → administrasi → APD)
   Sertakan ringkasan evaluasi maksimal 3 kalimat.

2. DETEKSI ANOMALI — Pindai baris demi baris, cari:
   - Risiko bahaya tinggi (ruang terbatas, hot work, listrik, ketinggian, bahan kimia) dengan mitigasi sangat lemah, pasif, atau tidak ada → severity "critical"
   - Mitigasi yang ada tapi bersifat pasif atau terlalu umum → severity "warning"
   - Peluang peningkatan kecil atau catatan minor → severity "info"
   Untuk setiap anomali, berikan kategori masalah dan draf komentar instruksi revisi yang spesifik.

3. SARAN PERBAIKAN — Untuk setiap anomali yang ditemukan:
   - Jika deskripsi bahaya tidak akurat/tidak lengkap, berikan suggested_hazard
   - Jika mitigasi lemah/pasif, berikan suggested_mitigation yang konkret dan sesuai standar HSE
   - Gunakan bahasa Indonesia yang teknis dan padat

Jawab menggunakan bahasa Indonesia yang teknis. Prioritaskan keselamatan pekerja di atas segalanya.`;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jsaData } = await req.json();

    if (!jsaData || !Array.isArray(jsaData)) {
      return NextResponse.json({ error: 'Valid jsaData array is required' }, { status: 400 });
    }

    const { object } = await generateObject({
      model: google('gemini-flash-latest'),
      system: SYSTEM_PROMPT,
      prompt: `Berikut adalah baris-baris JSA yang diinput vendor:\n${JSON.stringify(jsaData, null, 2)}`,
      schema: responseSchema,
    });

    return NextResponse.json(object);
  } catch (error: any) {
    console.error('AI HSE Assistant Error:', error);
    return NextResponse.json({ error: 'Failed to analyze JSA' }, { status: 500 });
  }
}
