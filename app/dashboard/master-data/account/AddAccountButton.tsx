'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import AddAccountModal from './AddAccountModal';

export default function AddAccountButton({ roles }: { roles: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30"
      >
        <Plus className="w-4 h-4" />
        Tambah Akun
      </button>
      <AddAccountModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        roles={roles}
      />
    </>
  );
}
