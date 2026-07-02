'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { useCallback, useState } from 'react';

export default function AccountFilters({ initialSearch, initialRole, initialStatus, roles }: { initialSearch: string, initialRole: string, initialStatus: string, roles: any[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialSearch || '');

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      params.set('page', '1'); // reset page
      return params.toString();
    },
    [searchParams]
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      router.push('?' + createQueryString('search', search));
    }
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
      <div className="relative w-full sm:w-96">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          onKeyDown={handleSearchSubmit}
          className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm transition-all"
          placeholder="Cari nama atau email... (Tekan Enter)"
        />
      </div>
      <div className="flex gap-2 w-full sm:w-auto">
        <select 
          value={initialRole || ''} 
          onChange={(e) => router.push('?' + createQueryString('role', e.target.value))}
          className="block w-full sm:w-40 pl-3 pr-10 py-2 text-base border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm rounded-xl bg-slate-50 cursor-pointer"
        >
          <option value="">Semua Role</option>
          {roles.map(r => (
            <option key={r.name} value={r.name}>{r.name}</option>
          ))}
        </select>
        <select 
          value={initialStatus || ''} 
          onChange={(e) => router.push('?' + createQueryString('status', e.target.value))}
          className="block w-full sm:w-40 pl-3 pr-10 py-2 text-base border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm rounded-xl bg-slate-50 cursor-pointer"
        >
          <option value="">Semua Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </div>
  );
}
