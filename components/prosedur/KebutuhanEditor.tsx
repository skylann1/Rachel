'use client';

import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { APD_ITEMS, APD_CATEGORY_LABELS, HAZARD_SOURCES, hazardLabel } from '@/lib/ptw-types';
import { emptyKebutuhan, type StepKebutuhan } from '@/lib/procedure-kebutuhan';

export interface ProjectRoster {
  workers: { id: string; full_name: string; position: string; certification: string | null }[];
  equipment: { id: string; name: string; category: string; certificate_number: string | null }[];
  materials: { id: string; name: string }[];
}

const HAZARD_LIST = Array.from(new Set(HAZARD_SOURCES));

export function Chip({ on, onClick, children, tone = 'primary' }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: 'primary' | 'rose' }) {
  const onCls = tone === 'rose' ? 'bg-rose-500 text-white border-rose-500' : 'bg-primary text-white border-primary';
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${on ? onCls : 'bg-white text-slate-600 border-slate-200 hover:border-primary'}`}>
      {on && <Check className="w-3 h-3" />}{children}
    </button>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <p className="text-xs font-bold text-slate-700 mb-2">{title} {count > 0 && <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-1">{count} dipilih</span>}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * Editor kebutuhan satu langkah (pekerja, peralatan, material, APD, bahaya)
 * untuk reviewer. Daftar pekerja/alat/material berasal dari master data
 * vendor proyek (getProjectRoster); item yang sudah tersimpan tapi tidak ada
 * di roster tetap tampil supaya bisa dilepas.
 */
export function KebutuhanEditor({ value, onChange, roster, defaultOpen = false }: {
  value: StepKebutuhan | undefined; onChange: (k: StepKebutuhan) => void; roster: ProjectRoster | null; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const k = { ...emptyKebutuhan(), ...value };
  const total = k.workers.length + k.equipment.length + k.materials.length + Object.values(k.apd).flat().length + k.hazards.length;

  const toggleRes = (key: 'workers' | 'equipment' | 'materials', id: string, label: string) => {
    const has = k[key].some((r) => r.id === id);
    onChange({ ...k, [key]: has ? k[key].filter((r) => r.id !== id) : [...k[key], { id, label }] });
  };
  const merged = <T extends { id: string }>(rosterList: T[], stored: { id: string; label: string }[], toLabel: (r: T) => string) => {
    const ids = new Set(rosterList.map((r) => r.id));
    return [
      ...rosterList.map((r) => ({ id: r.id, label: toLabel(r) })),
      ...stored.filter((s) => !ids.has(s.id)),
    ];
  };

  return (
    <div className="ml-6">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-primary">
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Kebutuhan {total > 0 && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{total}</span>}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {!roster && <p className="text-[11px] text-amber-600">Master data vendor belum termuat — hanya item tersimpan yang tampil.</p>}
          <Group title="Pekerja" count={k.workers.length}>
            {merged(roster?.workers ?? [], k.workers, (w) => w.full_name).map((w) => (
              <Chip key={w.id} on={k.workers.some((x) => x.id === w.id)} onClick={() => toggleRes('workers', w.id, w.label)}>{w.label}</Chip>
            ))}
          </Group>
          <Group title="Peralatan" count={k.equipment.length}>
            {merged(roster?.equipment ?? [], k.equipment, (e) => e.name).map((e) => (
              <Chip key={e.id} on={k.equipment.some((x) => x.id === e.id)} onClick={() => toggleRes('equipment', e.id, e.label)}>{e.label}</Chip>
            ))}
          </Group>
          <Group title="Material" count={k.materials.length}>
            {merged(roster?.materials ?? [], k.materials, (m) => m.name).map((m) => (
              <Chip key={m.id} on={k.materials.some((x) => x.id === m.id)} onClick={() => toggleRes('materials', m.id, m.label)}>{m.label}</Chip>
            ))}
          </Group>
          {Object.entries(APD_ITEMS).map(([cat, items]) => (
            <Group key={cat} title={`APD · ${APD_CATEGORY_LABELS[cat] || cat}`} count={(k.apd[cat] || []).length}>
              {items.map((it) => {
                const list = k.apd[cat] || [];
                const on = list.includes(it);
                return <Chip key={it} on={on} onClick={() => onChange({ ...k, apd: { ...k.apd, [cat]: on ? list.filter((x) => x !== it) : [...list, it] } })}>{it}</Chip>;
              })}
            </Group>
          ))}
          <Group title="Sumber bahaya" count={k.hazards.length}>
            {HAZARD_LIST.map((h) => {
              const on = k.hazards.includes(h);
              return <Chip key={h} tone="rose" on={on} onClick={() => onChange({ ...k, hazards: on ? k.hazards.filter((x) => x !== h) : [...k.hazards, h] })}>{hazardLabel(h)}</Chip>;
            })}
          </Group>
        </div>
      )}
    </div>
  );
}
