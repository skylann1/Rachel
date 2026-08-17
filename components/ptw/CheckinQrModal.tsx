'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check } from 'lucide-react';

export default function CheckinQrModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-center relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
        <h3 className="font-bold text-slate-800 mb-1">QR Check-in Lapangan</h3>
        <p className="text-xs text-slate-500 mb-4">Pindai untuk toolbox meeting, check-in pekerja, dan Stop Work Authority — tanpa perlu login.</p>
        <div className="bg-white border border-slate-200 rounded-xl p-4 inline-block">
          <QRCodeSVG value={url} size={200} />
        </div>
        <button
          onClick={handleCopy}
          className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 py-2.5 rounded-xl transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Tautan Disalin' : 'Salin Tautan'}
        </button>
      </div>
    </div>
  );
}
