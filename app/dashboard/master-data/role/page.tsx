"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield, Plus, Edit2, Trash2, Check, Settings2, Users, XCircle, ArrowRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useEffect } from 'react';
import { allPermissionModules } from './constants';
import AddRoleModal from './AddRoleModal';
import { deleteRole } from './actions';

export default function RolePermissionPage() {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const supabase = createClient();

  const fetchData = async () => {
    setLoading(true);
    // Fetch roles
    const { data: rolesData } = await supabase.from('roles').select('*').order('created_at');
    
    // Fetch profile counts
    const { data: profilesData } = await supabase.from('profiles').select('role');
    
    if (rolesData) {
      setRoles(rolesData);
      if (rolesData.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rolesData[0].id);
      }
    }

    if (profilesData) {
      const counts: Record<string, number> = {};
      profilesData.forEach((p: any) => {
        counts[p.role] = (counts[p.role] || 0) + 1;
      });
      setRoleCounts(counts);
    }
    
    setLoading(false);
  };

  const handleDelete = async (e: React.MouseEvent, roleId: string, roleName: string) => {
    e.stopPropagation();
    if (confirm(`Apakah Anda yakin ingin menghapus role "${roleName}"? Aksi ini tidak dapat dibatalkan.`)) {
      setIsDeleting(roleId);
      const res = await deleteRole(roleId);
      setIsDeleting(null);
      if (res.error) {
        alert(res.error);
      } else {
        if (selectedRoleId === roleId) {
          setSelectedRoleId(null); // Deselect if deleted
        }
        fetchData(); // Refresh list
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

  const liveRoles = roles.map(r => ({
    ...r,
    usersCount: roleCounts[r.name] || 0
  }));

  const selectedRole = liveRoles.find(r => r.id === selectedRoleId) || liveRoles[0];

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Role & Permission</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola peran pengguna dan hak akses modul di dalam sistem.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30"
        >
          <Plus className="w-4 h-4" />
          Tambah Role Baru
        </button>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Roles List */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Daftar Peran (Roles)
            </h2>
            <span className="bg-slate-200 text-slate-700 py-1 px-2.5 rounded-lg text-xs font-bold">
              {liveRoles.length} Total Role
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-white">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Role</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Pengguna</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {liveRoles.map((role) => (
                  <tr 
                    key={role.id} 
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`cursor-pointer transition-colors group ${selectedRoleId === role.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-slate-50 border-l-2 border-l-transparent'}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div>
                        <div className="text-sm font-bold text-slate-800 flex items-center gap-2 capitalize">
                          {role.name}
                          {role.is_system && (
                            <span className="bg-slate-100 text-slate-500 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">System</span>
                          )}
                          {role.type === 'external' ? (
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">External</span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">Internal</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 line-clamp-1">{role.description}</div>
                      </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-slate-600 font-medium bg-slate-100 px-2.5 py-1 rounded-lg w-fit">
                        <Users className="w-4 h-4 mr-1.5 text-slate-400" />
                        {role.usersCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className={`flex justify-end gap-2 transition-opacity ${selectedRoleId === role.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <Link href={`/dashboard/master-data/role/${role.id}`} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Kelola Role & Permission" onClick={(e) => e.stopPropagation()}>
                          <Settings2 className="w-4 h-4" />
                        </Link>
                        {!role.is_system && (
                          <button 
                            disabled={isDeleting === role.id}
                            onClick={(e) => handleDelete(e, role.id, role.name)}
                            className={`p-2 transition-colors rounded-lg ${isDeleting === role.id ? 'text-slate-300' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`} 
                            title="Hapus" 
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Permission Preview Card */}
        {selectedRole && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-fit sticky top-24">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Preview Hak Akses</h3>
                <p className="text-xs text-slate-500 mt-1">Role: <span className="font-bold text-primary">{selectedRole.name}</span></p>
              </div>
            </div>

            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
              {allPermissionModules.map((moduleData) => {
                const roleModulePerms = (selectedRole.permissions?.[moduleData.id]) || [];
                
                // Only show module if there are items to show
                if (moduleData.items.length === 0) return null;

                return (
                  <div key={moduleData.id}>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-3">{moduleData.title}</p>
                    <ul className="space-y-2">
                      {moduleData.items.map((item) => {
                        const hasAccess = roleModulePerms.includes(item.key);
                        return (
                          <li key={item.key} className={`flex items-center text-sm px-3 py-2 rounded-lg border ${hasAccess ? 'bg-emerald-50 text-slate-700 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                            {hasAccess ? (
                              <Check className="w-4 h-4 text-emerald-600 mr-2 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-slate-300 mr-2 flex-shrink-0" />
                            )}
                            <span className={hasAccess ? 'font-medium' : 'line-through'}>{item.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
            
            <Link href={`/dashboard/master-data/role/${selectedRole.id}`} className="mt-6 flex items-center justify-center gap-2 w-full bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-700 font-bold py-3 rounded-xl text-sm transition-colors border border-slate-200 hover:border-primary/30">
              Kelola Akses {selectedRole.name}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

      </div>
      )}

      {/* Action Modals */}
      <AddRoleModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchData();
        }}
      />

    </div>
  );
}
