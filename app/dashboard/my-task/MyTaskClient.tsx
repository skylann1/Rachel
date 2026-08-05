'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  CheckCircle, 
  FileSignature, 
  ShieldAlert, 
  AlertTriangle,
  Clock,
  ArrowRight,
  ClipboardList,
  FolderOpen,
  Search,
  Filter,
  BarChart3,
  Timer,
  UserPlus,
  X,
  Loader2,
  Eye
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TaskItem, delegateMonitoringTask } from './actions';

interface MyTaskClientProps {
  tasks: TaskItem[];
  userRole: string;
  internalUsers?: any[];
}

const COLORS = {
  Prosedur: '#4f46e5', // indigo
  JSA: '#d97706',      // amber
  PTW: '#059669',      // emerald
  Insiden: '#e11d48',  // rose
  Pengawasan: '#0ea5e9' // sky blue
};

export default function MyTaskClient({ tasks: initialTasks, userRole, internalUsers = [] }: MyTaskClientProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('All');
  
  // Disposisi Modal State
  const [isDisposisiModalOpen, setIsDisposisiModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter tasks based on search and category filter
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.projectName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            task.vendorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = activeFilter === 'All' || task.type === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [tasks, searchQuery, activeFilter]);

  // Group filtered tasks by project name
  const projectsWithTasks = useMemo(() => {
    const grouped: Record<string, TaskItem[]> = {};
    filteredTasks.forEach(task => {
      if (!grouped[task.projectName]) {
        grouped[task.projectName] = [];
      }
      grouped[task.projectName].push(task);
    });
    return grouped;
  }, [filteredTasks]);

  const projectNames = Object.keys(projectsWithTasks);
  const [selectedProject, setSelectedProject] = useState<string | null>(
    projectNames.length > 0 ? projectNames[0] : null
  );

  // Auto-select first project if current selection disappears due to filtering
  React.useEffect(() => {
    if (selectedProject && !projectNames.includes(selectedProject) && projectNames.length > 0) {
      setSelectedProject(projectNames[0]);
    } else if (projectNames.length === 0) {
      setSelectedProject(null);
    }
  }, [projectNames, selectedProject]);

  // Chart Data preparation
  const chartData = useMemo(() => {
    const counts = { Prosedur: 0, JSA: 0, PTW: 0, Insiden: 0, Pengawasan: 0 };
    tasks.forEach(t => counts[t.type as keyof typeof counts]++);
    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [tasks]);

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'Prosedur': return <FileSignature className="w-5 h-5 text-indigo-600" />;
      case 'JSA': return <ClipboardList className="w-5 h-5 text-amber-600" />;
      case 'PTW': return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'Insiden': return <AlertTriangle className="w-5 h-5 text-rose-600" />;
      case 'Pengawasan': return <Eye className="w-5 h-5 text-sky-600" />;
      default: return <Clock className="w-5 h-5 text-slate-600" />;
    }
  };

  const getTaskColor = (type: string) => {
    switch (type) {
      case 'Prosedur': return 'bg-indigo-50 border-indigo-100';
      case 'JSA': return 'bg-amber-50 border-amber-100';
      case 'PTW': return 'bg-emerald-50 border-emerald-100';
      case 'Insiden': return 'bg-rose-50 border-rose-100';
      case 'Pengawasan': return 'bg-sky-50 border-sky-100';
      default: return 'bg-slate-50 border-slate-100';
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    if (urgency === 'High') return <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border border-rose-200">Urgent</span>;
    if (urgency === 'Medium') return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border border-amber-200">Perhatian</span>;
    return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border border-slate-200">Normal</span>;
  };

  const handleDisposisi = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTask) return;
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const assigneeId = formData.get('assignee') as string;
    const notes = formData.get('notes') as string;

    try {
      if (selectedTask.id.includes('dummy')) {
         alert('Ini adalah dummy data. Disposisi berhasil di-simulasikan!');
      } else {
         await delegateMonitoringTask(selectedTask.id, assigneeId, notes);
         alert('Berhasil mendisposisikan pengawasan lapangan!');
      }
      
      // Remove the task from the list since it's no longer ours
      setTasks(prev => prev.filter(t => t.id !== selectedTask.id));
      setIsDisposisiModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Gagal mendisposisikan tugas pengawasan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header & Main Stats Row */}
      <div className="flex flex-col lg:flex-row gap-6 justify-between items-start">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-primary" /> My Task Overview
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Sistem merangkum seluruh dokumen K3 dan pelaporan yang membutuhkan otorisasi atau tinjauan lanjutan dari Anda.
          </p>
          <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            Role Aktif: <span className="uppercase">{userRole}</span>
          </div>
        </div>

        {/* Chart Summary */}
        {tasks.length > 0 && (
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-center gap-6 shrink-0 w-full lg:w-auto">
            <div className="h-24 w-24 shrink-0 relative">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={chartData}
                     cx="50%"
                     cy="50%"
                     innerRadius={25}
                     outerRadius={40}
                     paddingAngle={5}
                     dataKey="value"
                     stroke="none"
                   >
                     {chartData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                     ))}
                   </Pie>
                   <Tooltip formatter={(value) => [`${value} Tugas`, 'Jumlah']} />
                 </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <span className="text-lg font-black text-slate-700">{tasks.length}</span>
               </div>
            </div>
            <div className="flex flex-col gap-2">
               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Komposisi Tugas</h3>
               <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                 {chartData.map(d => (
                   <div key={d.name} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                     <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[d.name as keyof typeof COLORS] }}></span>
                     {d.name} ({d.value})
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between z-10 sticky top-20">
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
          <Filter className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          {['All', 'PTW', 'JSA', 'Prosedur', 'Pengawasan', 'Insiden'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeFilter === filter 
                  ? 'bg-slate-800 text-white shadow-md' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter === 'All' ? 'Semua Tugas' : filter}
            </button>
          ))}
        </div>
        
        <div className="relative w-full md:w-64 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Cari proyek atau vendor..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
          />
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white border-2 border-dashed border-slate-200 rounded-3xl animate-in fade-in duration-700">
          <CheckCircle className="w-16 h-16 text-emerald-400 mb-4" />
          <h3 className="text-xl font-bold text-slate-700">Tidak Ada Tugas Ditemukan</h3>
          <p className="text-slate-500 text-sm mt-2 text-center max-w-md">
            Mungkin sudah diselesaikan semua, atau gunakan filter pencarian yang berbeda untuk menemukan apa yang Anda cari.
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start animate-in slide-in-from-bottom-8 duration-700">
          
          {/* Left Column: Project List */}
          <div className="w-full lg:w-[35%] flex flex-col gap-3 sticky top-40">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Antrean Proyek ({projectNames.length})</h2>
            <div className="flex flex-col gap-3">
              {projectNames.map((projectName) => {
                const projectTasks = projectsWithTasks[projectName];
                const isSelected = selectedProject === projectName;
                
                return (
                  <button
                    key={projectName}
                    onClick={() => setSelectedProject(projectName)}
                    className={`w-full text-left p-4 rounded-2xl flex flex-col gap-2 transition-all border-2 ${
                      isSelected 
                        ? 'bg-white border-primary shadow-md shadow-primary/10 ring-4 ring-primary/5' 
                        : 'bg-white/60 border-slate-200 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-center gap-2 text-slate-800 font-bold">
                        <FolderOpen className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-slate-400'}`} />
                        <span className="line-clamp-2 leading-tight">{projectName}</span>
                      </div>
                      <span className="bg-rose-100 text-rose-600 text-xs font-black px-2 py-0.5 rounded-full shrink-0">
                        {projectTasks.length}
                      </span>
                    </div>
                    
                    {/* Tiny preview of what tasks are inside */}
                    <div className="flex items-center gap-1 mt-2">
                       {projectTasks.slice(0,4).map((t, i) => (
                         <div key={i} className="w-5 h-5 rounded-full border border-white flex items-center justify-center bg-slate-100 shrink-0" title={t.type}>
                           <span className="scale-[0.6]">{getTaskIcon(t.type)}</span>
                         </div>
                       ))}
                       {projectTasks.length > 4 && <span className="text-[10px] text-slate-400 font-bold ml-1">+{projectTasks.length - 4}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Task Details */}
          <div className="w-full lg:w-[65%]">
             <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Rincian Dokumen & Tindakan</h2>
             
             {selectedProject && projectsWithTasks[selectedProject] && (
               <div className="space-y-4 relative">
                 {/* Timeline Line indicator */}
                 <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-200 -z-10 rounded-full hidden md:block"></div>
                 
                 {projectsWithTasks[selectedProject].map((task) => (
                   <div 
                     key={`${task.id}-${task.type}`} 
                     className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row gap-5 hover:shadow-lg hover:shadow-slate-200/50 transition-all relative overflow-hidden group"
                   >
                     {/* Left Icon Area */}
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border ${getTaskColor(task.type)} relative bg-white`}>
                       {getTaskIcon(task.type)}
                     </div>
                     
                     {/* Main Content Area */}
                     <div className="flex-1 flex flex-col">
                       {/* Top Metadata */}
                       <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                         <div className="flex items-center gap-2">
                           <span className="text-xs font-black px-2 py-1 bg-slate-100 text-slate-600 rounded-md uppercase tracking-wider">
                             {task.type}
                           </span>
                           {getUrgencyBadge(task.urgency)}
                         </div>
                         <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                           <Timer className="w-3.5 h-3.5" />
                           Antrean: {task.timeInQueue}
                         </div>
                       </div>
                       
                       {/* Title & Desc */}
                       <h3 className="font-extrabold text-slate-800 text-lg md:text-xl mb-1">{task.title}</h3>
                       <p className="text-sm font-medium text-slate-500 mb-4">
                         Dikirim oleh vendor <span className="font-bold text-primary">{task.vendorName}</span> pada {new Date(task.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                       </p>
                       
                       {/* Action Footer */}
                       <div className="mt-auto pt-4 flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 gap-4">
                         <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Status Saat Ini</span>
                            <span className={`text-sm font-bold flex items-center gap-1.5 ${task.type === 'Pengawasan' ? 'text-sky-600' : 'text-amber-600'}`}>
                              <span className={`w-2 h-2 rounded-full animate-pulse ${task.type === 'Pengawasan' ? 'bg-sky-500' : 'bg-amber-500'}`}></span>
                              {task.status}
                            </span>
                         </div>
                         
                         <div className="flex gap-2 w-full sm:w-auto">
                            {task.type === 'Pengawasan' && (
                               <button 
                                 onClick={() => {
                                    setSelectedTask(task);
                                    setIsDisposisiModalOpen(true);
                                 }}
                                 className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2.5 rounded-xl transition-all"
                               >
                                 <UserPlus className="w-4 h-4" /> Disposisi
                               </button>
                            )}
                            <Link 
                              href={task.url}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm font-bold text-white bg-slate-900 hover:bg-primary px-6 py-2.5 rounded-xl transition-all shadow-md hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
                            >
                              {task.type === 'Pengawasan' ? 'Buka Proyek' : 'Eksekusi Tugas'} <ArrowRight className="w-4 h-4" />
                            </Link>
                         </div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      )}

      {/* Modal Disposisi Pengawasan */}
      {isDisposisiModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <form onSubmit={handleDisposisi} className="bg-white rounded-2xl w-full max-w-md flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><UserPlus className="w-5 h-5 text-sky-600" /> Disposisi Pengawasan</h2>
              <button type="button" onClick={() => setIsDisposisiModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="bg-sky-50 p-3 rounded-lg border border-sky-100">
                <span className="text-xs font-bold text-sky-700 block mb-1">Proyek: {selectedTask.projectName}</span>
                <p className="text-sm font-medium text-slate-700 line-clamp-2">"Anda melepaskan tugas pengawasan lapangan untuk proyek ini kepada rekan lain."</p>
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
