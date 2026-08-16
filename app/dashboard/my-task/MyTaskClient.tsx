'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  FileSignature,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Search,
  Timer,
  UserPlus,
  X,
  Loader2,
  Eye,
  ArrowUpDown,
  Square,
  CheckSquare,
  ExternalLink,
  Users,
  Inbox,
  Flame
} from 'lucide-react';
import { TaskItem, TaskType, delegateMonitoringTask } from './actions';

interface MyTaskClientProps {
  tasks: TaskItem[];
  userRole: string;
  internalUsers?: any[];
}

type SortMode = 'urgency' | 'oldest' | 'name';

const TASK_TYPES: TaskType[] = ['Prosedur', 'JSA', 'PTW', 'Insiden', 'Pengawasan'];

const TYPE_META: Record<TaskType, { color: string; icon: React.ElementType; soft: string; ink: string }> = {
  Prosedur:   { color: '#4f46e5', icon: FileSignature,  soft: 'bg-indigo-50',  ink: 'text-indigo-600' },
  JSA:        { color: '#d97706', icon: ClipboardList,  soft: 'bg-amber-50',   ink: 'text-amber-600' },
  PTW:        { color: '#059669', icon: CheckCircle,    soft: 'bg-emerald-50', ink: 'text-emerald-600' },
  Insiden:    { color: '#e11d48', icon: AlertTriangle,  soft: 'bg-rose-50',    ink: 'text-rose-600' },
  Pengawasan: { color: '#0ea5e9', icon: Eye,            soft: 'bg-sky-50',     ink: 'text-sky-600' },
};

const URGENCY_META = {
  High:   { rank: 0, label: 'Urgent',    bar: '#e11d48', chip: 'bg-rose-100 text-rose-700 border-rose-200',     dot: 'bg-rose-500' },
  Medium: { rank: 1, label: 'Perhatian', bar: '#d97706', chip: 'bg-amber-100 text-amber-700 border-amber-200',  dot: 'bg-amber-500' },
  Low:    { rank: 2, label: 'Normal',    bar: '#94a3b8', chip: 'bg-slate-100 text-slate-600 border-slate-200',  dot: 'bg-slate-400' },
} as const;

const urgencyOf = (u: string) => URGENCY_META[u as keyof typeof URGENCY_META] ?? URGENCY_META.Low;
const taskKey = (t: TaskItem) => `${t.type}-${t.id}`;

export default function MyTaskClient({ tasks: initialTasks, userRole, internalUsers = [] }: MyTaskClientProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [sortMode, setSortMode] = useState<SortMode>('urgency');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Disposisi Modal State — handles both single-task and bulk disposisi
  const [isDisposisiModalOpen, setIsDisposisiModalOpen] = useState(false);
  const [disposisiTargets, setDisposisiTargets] = useState<TaskItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return tasks.filter(task => {
      const matchesSearch =
        task.projectName.toLowerCase().includes(q) ||
        task.title.toLowerCase().includes(q) ||
        task.vendorName.toLowerCase().includes(q);
      const matchesFilter = activeFilter === 'All' || task.type === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [tasks, searchQuery, activeFilter]);

  const sortTasks = (list: TaskItem[]) => {
    const copy = [...list];
    if (sortMode === 'urgency') {
      copy.sort((a, b) => urgencyOf(a.urgency).rank - urgencyOf(b.urgency).rank || new Date(a.date).getTime() - new Date(b.date).getTime());
    } else if (sortMode === 'oldest') {
      copy.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      copy.sort((a, b) => a.type.localeCompare(b.type));
    }
    return copy;
  };

  const projectsWithTasks = useMemo(() => {
    const grouped: Record<string, TaskItem[]> = {};
    filteredTasks.forEach(task => {
      if (!grouped[task.projectName]) grouped[task.projectName] = [];
      grouped[task.projectName].push(task);
    });
    Object.keys(grouped).forEach(name => { grouped[name] = sortTasks(grouped[name]); });
    return grouped;
  }, [filteredTasks, sortMode]);

  const projectNames = useMemo(() => {
    const names = Object.keys(projectsWithTasks);
    if (sortMode === 'name') return names.sort((a, b) => a.localeCompare(b));
    return names.sort((a, b) => {
      const at = projectsWithTasks[a], bt = projectsWithTasks[b];
      if (sortMode === 'oldest') return new Date(at[0].date).getTime() - new Date(bt[0].date).getTime();
      const aRank = Math.min(...at.map(t => urgencyOf(t.urgency).rank));
      const bRank = Math.min(...bt.map(t => urgencyOf(t.urgency).rank));
      return aRank - bRank || new Date(at[0].date).getTime() - new Date(bt[0].date).getTime();
    });
  }, [projectsWithTasks, sortMode]);

  const [selectedProject, setSelectedProject] = useState<string | null>(
    projectNames.length > 0 ? projectNames[0] : null
  );

  React.useEffect(() => {
    if (selectedProject && !projectNames.includes(selectedProject) && projectNames.length > 0) {
      setSelectedProject(projectNames[0]);
    } else if (projectNames.length === 0) {
      setSelectedProject(null);
    }
  }, [projectNames, selectedProject]);

  const typeCounts = useMemo(() => {
    const counts: Record<TaskType, number> = { Prosedur: 0, JSA: 0, PTW: 0, Insiden: 0, Pengawasan: 0 };
    tasks.forEach(t => counts[t.type]++);
    return counts;
  }, [tasks]);

  const urgencyCounts = useMemo(() => {
    const counts = { High: 0, Medium: 0, Low: 0 };
    tasks.forEach(t => { counts[t.urgency as keyof typeof counts]++; });
    return counts;
  }, [tasks]);

  const selectedTasks = useMemo(
    () => filteredTasks.filter(t => selectedKeys.has(taskKey(t))),
    [filteredTasks, selectedKeys]
  );
  const allSelectedArePengawasan = selectedTasks.length > 0 && selectedTasks.every(t => t.type === 'Pengawasan');

  const toggleSelect = (task: TaskItem) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      const key = taskKey(task);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const clearSelection = () => setSelectedKeys(new Set());

  const openDisposisiFor = (targets: TaskItem[]) => {
    setDisposisiTargets(targets);
    setIsDisposisiModalOpen(true);
  };

  const handleOpenSelectedInTabs = () => {
    selectedTasks.forEach(t => window.open(t.url, '_blank'));
    clearSelection();
  };

  const handleDisposisi = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (disposisiTargets.length === 0) return;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const assigneeId = formData.get('assignee') as string;
    const notes = formData.get('notes') as string;

    try {
      await Promise.all(disposisiTargets.map(t => delegateMonitoringTask(t.id, assigneeId, notes)));

      alert(disposisiTargets.length > 1 ? `Berhasil mendisposisikan ${disposisiTargets.length} tugas pengawasan!` : 'Berhasil mendisposisikan pengawasan lapangan!');

      const targetKeys = new Set(disposisiTargets.map(taskKey));
      setTasks(prev => prev.filter(t => !targetKeys.has(taskKey(t))));
      setSelectedKeys(prev => {
        const next = new Set(prev);
        targetKeys.forEach(k => next.delete(k));
        return next;
      });
      setIsDisposisiModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Gagal mendisposisikan tugas pengawasan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalTasks = tasks.length;
  const urgentPct = totalTasks > 0 ? Math.round((urgencyCounts.High / totalTasks) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto pb-28 space-y-5">

      {/* ── Command Header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-6 md:p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute right-40 -bottom-24 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white/10 backdrop-blur text-white/80 text-[10px] font-bold rounded-full border border-white/15 uppercase tracking-widest">
              <ShieldAlert className="w-3 h-3" /> {userRole}
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mt-3">Antrean Tugas Saya</h1>
            <p className="text-sm text-slate-400 mt-2 max-w-lg leading-relaxed">
              Seluruh dokumen K3 dan pelaporan yang membutuhkan otorisasi atau tinjauan lanjutan dari Anda.
            </p>
          </div>

          {/* Workload summary */}
          <div className="shrink-0 w-full lg:w-auto">
            <div className="flex items-end gap-3 mb-3">
              <span className="text-6xl font-black leading-none tabular-nums">{totalTasks}</span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2">Tugas<br />Menunggu</span>
            </div>

            {totalTasks > 0 && (
              <>
                <div className="flex h-1.5 w-full lg:w-72 rounded-full overflow-hidden gap-[2px] mb-3">
                  {(['High', 'Medium', 'Low'] as const).map(u =>
                    urgencyCounts[u] > 0 && (
                      <div
                        key={u}
                        style={{ backgroundColor: URGENCY_META[u].bar, flexGrow: urgencyCounts[u] }}
                        title={`${URGENCY_META[u].label}: ${urgencyCounts[u]}`}
                      />
                    )
                  )}
                </div>
                <div className="flex items-center gap-4 text-[11px] font-bold">
                  {(['High', 'Medium', 'Low'] as const).map(u => (
                    <span key={u} className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: URGENCY_META[u].bar }} />
                      {URGENCY_META[u].label} <span className="text-white tabular-nums">{urgencyCounts[u]}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {urgencyCounts.High > 0 && (
          <div className="relative mt-6 pt-5 border-t border-white/10 flex items-center gap-2.5 text-sm">
            <Flame className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="text-slate-300">
              <span className="font-bold text-white">{urgencyCounts.High} tugas</span> sudah lebih dari 2 hari dalam antrean
              <span className="text-slate-500"> — {urgentPct}% dari beban kerja Anda.</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Type filter strip ──────────────────────────────────────── */}
      <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '60ms' }}>
        <button
          onClick={() => setActiveFilter('All')}
          className={`shrink-0 px-4 py-3 rounded-2xl border-2 transition-all text-left min-w-[104px] ${
            activeFilter === 'All' ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
          }`}
        >
          <p className={`text-[10px] font-bold uppercase tracking-wider ${activeFilter === 'All' ? 'text-slate-400' : 'text-slate-500'}`}>Semua</p>
          <p className="text-2xl font-black tabular-nums leading-tight">{totalTasks}</p>
        </button>

        {TASK_TYPES.map(type => {
          const meta = TYPE_META[type];
          const Icon = meta.icon;
          const active = activeFilter === type;
          return (
            <button
              key={type}
              onClick={() => setActiveFilter(active ? 'All' : type)}
              className={`group shrink-0 px-4 py-3 rounded-2xl border-2 transition-all text-left min-w-[124px] ${
                active ? 'bg-white shadow-lg' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
              style={active ? { borderColor: meta.color } : undefined}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} />
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{type}</p>
              </div>
              <p className="text-2xl font-black text-slate-800 tabular-nums leading-tight">{typeCounts[type]}</p>
            </button>
          );
        })}
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <div className="sticky top-20 z-20 bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari proyek, dokumen, atau vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
          />
        </div>
        <div className="relative flex items-center shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 pointer-events-none" />
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="w-full sm:w-auto pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
          >
            <option value="urgency">Urgensi Tertinggi</option>
            <option value="oldest">Antrean Terlama</option>
            <option value="name">Nama Proyek</option>
          </select>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white border-2 border-dashed border-slate-200 rounded-3xl animate-in fade-in duration-700">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-700">Antrean Anda Bersih</h3>
          <p className="text-slate-500 text-sm mt-2 text-center max-w-sm">
            Tidak ada tugas yang cocok. Semua mungkin sudah diselesaikan, atau coba ubah filter pencarian Anda.
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 items-start">

          {/* ── Project rail ─────────────────────────────────────── */}
          <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 lg:sticky lg:top-40 flex flex-col gap-2">
            <div className="flex items-center justify-between px-1 mb-1">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proyek</h2>
              <span className="text-[10px] font-black text-slate-400 tabular-nums">{projectNames.length}</span>
            </div>

            <div className="flex flex-col gap-2 lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto lg:pr-1 hide-scrollbar">
              {projectNames.map((projectName) => {
                const projectTasks = projectsWithTasks[projectName];
                const isSelected = selectedProject === projectName;
                const topUrgency = projectTasks.reduce(
                  (acc, t) => (urgencyOf(t.urgency).rank < urgencyOf(acc).rank ? t.urgency : acc),
                  'Low' as string
                );
                const dist = TASK_TYPES
                  .map(t => ({ type: t, n: projectTasks.filter(x => x.type === t).length }))
                  .filter(d => d.n > 0);

                return (
                  <button
                    key={projectName}
                    onClick={() => setSelectedProject(projectName)}
                    className={`group relative w-full text-left rounded-2xl overflow-hidden transition-all border ${
                      isSelected
                        ? 'bg-white border-slate-300 shadow-md'
                        : 'bg-white/60 border-slate-200 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <span
                      className="absolute left-0 top-0 bottom-0 w-1 transition-all"
                      style={{ backgroundColor: urgencyOf(topUrgency).bar, opacity: isSelected ? 1 : 0.35 }}
                    />
                    <div className="pl-4 pr-3 py-3">
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <span className={`text-sm font-bold leading-snug line-clamp-2 ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                          {projectName}
                        </span>
                        <span className={`shrink-0 text-[11px] font-black tabular-nums px-1.5 py-0.5 rounded-md ${
                          isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {projectTasks.length}
                        </span>
                      </div>

                      {/* type distribution */}
                      <div className="flex h-1 rounded-full overflow-hidden gap-[2px]">
                        {dist.map(d => (
                          <div key={d.type} style={{ backgroundColor: TYPE_META[d.type].color, flexGrow: d.n }} title={`${d.type}: ${d.n}`} />
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Task detail column ───────────────────────────────── */}
          <div className="w-full min-w-0 flex flex-col gap-2">
            <div className="flex items-center justify-between px-1 mb-1">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                {selectedProject ?? 'Rincian Tugas'}
              </h2>
              {selectedProject && (
                <span className="text-[10px] font-black text-slate-400 tabular-nums shrink-0">
                  {projectsWithTasks[selectedProject]?.length ?? 0} dokumen
                </span>
              )}
            </div>

            {selectedProject && projectsWithTasks[selectedProject] && (
              <div className="flex flex-col gap-2.5">
                {projectsWithTasks[selectedProject].map((task) => {
                  const key = taskKey(task);
                  const isChecked = selectedKeys.has(key);
                  const meta = TYPE_META[task.type];
                  const Icon = meta.icon;
                  const urg = urgencyOf(task.urgency);

                  return (
                    <div
                      key={key}
                      className={`group relative bg-white rounded-2xl overflow-hidden border transition-all hover:shadow-lg hover:shadow-slate-200/60 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                        isChecked ? 'border-primary ring-2 ring-primary/10' : 'border-slate-200'
                      }`}
                    >
                      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: urg.bar }} />

                      <div className="pl-5 pr-4 py-4 flex gap-3.5">
                        <button
                          type="button"
                          onClick={() => toggleSelect(task)}
                          className="shrink-0 h-fit mt-0.5 text-slate-300 hover:text-primary transition-colors"
                          aria-label="Pilih tugas"
                        >
                          {isChecked ? <CheckSquare className="w-[18px] h-[18px] text-primary" /> : <Square className="w-[18px] h-[18px]" />}
                        </button>

                        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${meta.soft}`}>
                          <Icon className="w-[18px] h-[18px]" style={{ color: meta.color }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{task.type}</span>
                            <span className="text-slate-300">·</span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${urg.chip}`}>
                              {urg.label}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 ml-auto shrink-0">
                              <Timer className="w-3 h-3" /> {task.timeInQueue}
                            </span>
                          </div>

                          <h3 className="font-bold text-slate-900 text-base leading-snug mb-1">{task.title}</h3>

                          <p className="text-xs text-slate-500 mb-3">
                            <span className="font-semibold text-slate-600">{task.vendorName}</span>
                            {' · '}
                            {new Date(task.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${urg.dot} animate-pulse`} />
                              <span className="truncate">{task.status}</span>
                            </span>

                            <div className="flex gap-2 shrink-0">
                              {task.type === 'Pengawasan' && (
                                <button
                                  onClick={() => openDisposisiFor([task])}
                                  className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 px-3 py-2 rounded-lg transition-all"
                                >
                                  <UserPlus className="w-3.5 h-3.5" /> Disposisi
                                </button>
                              )}
                              <Link
                                href={task.url}
                                className="flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-primary px-4 py-2 rounded-lg transition-all shadow-sm hover:shadow-md hover:shadow-primary/25"
                              >
                                {task.type === 'Pengawasan' ? 'Buka Proyek' : 'Eksekusi'}
                                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Floating bulk action bar ───────────────────────────────── */}
      {selectedTasks.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl shadow-slate-900/30 px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <span className="flex items-center gap-2 text-sm font-bold whitespace-nowrap">
            <Inbox className="w-4 h-4 text-slate-400" />
            {selectedTasks.length} dipilih
          </span>
          <div className="h-5 w-px bg-white/15" />
          {allSelectedArePengawasan ? (
            <button
              onClick={() => openDisposisiFor(selectedTasks)}
              className="flex items-center gap-1.5 text-sm font-bold bg-sky-600 hover:bg-sky-500 px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              <Users className="w-4 h-4" /> Disposisi Massal
            </button>
          ) : (
            <button
              onClick={handleOpenSelectedInTabs}
              className="flex items-center gap-1.5 text-sm font-bold bg-primary hover:bg-primary/90 px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-4 h-4" /> Buka Semua
            </button>
          )}
          <button onClick={clearSelection} className="text-slate-400 hover:text-white transition-colors" aria-label="Batal pilih">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Disposisi modal ────────────────────────────────────────── */}
      {isDisposisiModalOpen && disposisiTargets.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <form onSubmit={handleDisposisi} className="bg-white rounded-2xl w-full max-w-md flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-600" />
                {disposisiTargets.length > 1 ? `Disposisi Massal (${disposisiTargets.length} Proyek)` : 'Disposisi Pengawasan'}
              </h2>
              <button type="button" onClick={() => setIsDisposisiModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-sky-50 p-3 rounded-lg border border-sky-100 max-h-32 overflow-y-auto">
                {disposisiTargets.length > 1 ? (
                  <ul className="text-sm font-medium text-slate-700 space-y-1">
                    {disposisiTargets.map(t => <li key={taskKey(t)}>• {t.projectName}</li>)}
                  </ul>
                ) : (
                  <>
                    <span className="text-xs font-bold text-sky-700 block mb-1">Proyek: {disposisiTargets[0].projectName}</span>
                    <p className="text-sm font-medium text-slate-700 line-clamp-2">"Anda melepaskan tugas pengawasan lapangan untuk proyek ini kepada rekan lain."</p>
                  </>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Tugaskan Kepada (Inspektur Pengganti) <span className="text-rose-500">*</span></label>
                <select name="assignee" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm">
                  <option value="">Pilih Petugas Internal</option>
                  {internalUsers.map(user => (
                    <option key={user.id} value={user.id}>{user.profiles.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Catatan Disposisi</label>
                <textarea
                   name="notes"
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm resize-none"
                   rows={3}
                   placeholder="Misal: Tolong lanjutkan pemantauan karena saya sedang dinas luar..."
                ></textarea>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button type="button" onClick={() => setIsDisposisiModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors">Batal</button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-2 shadow-md shadow-sky-600/20"
              >
                 {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                 {isSubmitting ? 'Memproses...' : 'Simpan Disposisi'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
