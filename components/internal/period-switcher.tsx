"use client";

import React, { useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { CalendarRange, Loader2 } from 'lucide-react';

export interface PeriodOption {
  value: string;   // 'all' | 'YYYY-MM'
  label: string;
}

/**
 * Drives the dashboard period via the `periode` query param so the server
 * component re-renders with a freshly scoped dataset. Keeping the state in the
 * URL (rather than component state) makes a given view shareable and
 * survives a refresh.
 */
export function PeriodSwitcher({ options, value }: { options: PeriodOption[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const onChange = (next: string) => {
    // Always push an explicit param — pushing the bare pathname does not clear
    // an existing `?periode=`, so returning to "Semua Periode" would no-op.
    startTransition(() => router.push(`${pathname}?periode=${encodeURIComponent(next)}`));
  };

  return (
    <label
      className={`relative flex items-center border rounded-xl pl-4 pr-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
        isPending ? 'border-primary/40 bg-primary/5 text-primary' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
      }`}
    >
      {isPending
        ? <Loader2 className="w-4 h-4 mr-2 text-primary animate-spin shrink-0" />
        : <CalendarRange className="w-4 h-4 mr-2 text-primary shrink-0" />}
      <span className="sr-only">Pilih periode data</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={isPending}
        className="bg-transparent outline-none font-medium cursor-pointer pr-1 disabled:cursor-wait"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
