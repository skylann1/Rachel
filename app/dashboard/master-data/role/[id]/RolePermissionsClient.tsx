'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Shield, Loader2 } from 'lucide-react';
import { updateRolePermissions } from './actions';
import { useRouter } from 'next/navigation';

export default function RolePermissionsClient({ role, allModules }: { role: any, allModules: any[] }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description || '');
  const [type, setType] = useState(role.type || 'internal');
  const [permissions, setPermissions] = useState<Record<string, string[]>>(role.permissions || {});
  const router = useRouter();

  const handleCheckboxChange = (moduleId: string, itemKey: string, checked: boolean) => {
    setPermissions(prev => {
      const modulePerms = prev[moduleId] || [];
      if (checked) {
        return { ...prev, [moduleId]: [...modulePerms, itemKey] };
      } else {
        return { ...prev, [moduleId]: modulePerms.filter(k => k !== itemKey) };
      }
    });
  };

  const handleSelectAll = (moduleId: string, checked: boolean) => {
    const moduleData = allModules.find(m => m.id === moduleId);
    if (!moduleData) return;
    
    setPermissions(prev => {
      if (checked) {
        return { ...prev, [moduleId]: moduleData.items.map((i: any) => i.key) };
      } else {
        return { ...prev, [moduleId]: [] };
      }
    });
  };

  const handleSave = async () => {
    setLoading(true);
    const result = await updateRolePermissions(role.id, name, description, type, permissions);
    setLoading(false);
    if (!result.error) {
      alert('Berhasil menyimpan konfigurasi Role & Permission!');
      router.refresh();
    } else {
      alert('Gagal menyimpan: ' + result.error);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/master-data/role"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Kelola Hak Akses Role</h1>
            <p className="text-sm text-slate-500 mt-1">Role: <span className="font-bold text-primary">{role.name}</span></p>
          </div>
        </div>
        <button 
          type="button" 
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-sm shadow-primary/30 w-full sm:w-auto justify-center"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Simpan Konfigurasi
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Role Identity Details */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            Informasi Role
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nama Role</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={role.is_system}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Tipe Role</label>
              <select 
                value={type}
                onChange={e => setType(e.target.value)}
                disabled={role.is_system}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none disabled:bg-slate-100"
              >
                <option value="internal">Internal (PGN)</option>
                <option value="external">External (Vendor)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Deskripsi</label>
              <input 
                type="text" 
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              />
            </div>
          </div>
        </div>

        {/* Permissions Configuration List */}
        <div className="p-6">
          <h2 className="text-base font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2">
            Konfigurasi Hak Akses (Permissions)
          </h2>

          <div className="space-y-8">
            {allModules.map((module) => {
              const roleModulePerms = permissions[module.id] || [];
              const isAllChecked = roleModulePerms.length === module.items.length && module.items.length > 0;

              return (
                <div key={module.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{module.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{module.description}</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-200/50 px-2.5 py-1.5 rounded-lg transition-colors">
                      <input 
                        type="checkbox" 
                        checked={isAllChecked}
                        onChange={(e) => handleSelectAll(module.id, e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary/30 border-slate-300" 
                      />
                      Pilih Semua
                    </label>
                  </div>
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {module.items.map((item: any) => {
                      const isChecked = roleModulePerms.includes(item.key);
                      return (
                        <label 
                          key={item.key} 
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isChecked ? 'bg-primary/5 border-primary/20' : 'hover:bg-slate-50 border-slate-100'}`}
                        >
                          <div className="flex h-5 items-center">
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={(e) => handleCheckboxChange(module.id, item.key, e.target.checked)}
                              className="w-4 h-4 rounded text-primary focus:ring-primary/30 border-slate-300" 
                            />
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${isChecked ? 'text-primary' : 'text-slate-700'}`}>{item.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Izinkan aksi '{item.key}' pada {module.title}.</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
