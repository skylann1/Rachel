'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageSquare, Loader2 } from 'lucide-react';
import { getProjectDiscussions, postDiscussionMessage } from '@/app/vendor/dashboard/projects/[id]/actions';

interface DiscussionMessage {
  id: string;
  project_id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  message: string;
  created_at: string;
}

export function ProjectDiscussion({ projectId, currentUserId }: { projectId: string, currentUserId: string }) {
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const fetchMessages = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await getProjectDiscussions(projectId);
      setMessages(data || []);
      if (showLoading) scrollToBottom();
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [projectId, scrollToBottom]);

  useEffect(() => {
    fetchMessages();
    // In a real production app, we would use Supabase Realtime here
    // to listen for new messages automatically.
    const interval = setInterval(() => {
      fetchMessages(false);
    }, 10000); // Polling every 10 seconds for simplicity

    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setIsSending(true);
    try {
      const result = await postDiscussionMessage(projectId, newMessage);
      if (result.error) {
        alert('Gagal mengirim pesan: ' + result.error);
      } else {
        setNewMessage('');
        await fetchMessages(false);
        scrollToBottom();
      }
    } catch {
      alert('Gagal mengirim pesan.');
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + 
           date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
        <div className="p-2 bg-primary/10 text-primary rounded-lg">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800">Ruang Diskusi</h3>
          <p className="text-xs text-slate-500">Tanya jawab terkait persyaratan dokumen proyek</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-400 gap-2">
            <MessageSquare className="w-8 h-8 opacity-20" />
            <p className="text-sm">Belum ada diskusi. Mulai percakapan pertama!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[80%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${isMe ? 'bg-primary' : 'bg-slate-400'}`}>
                    {msg.user_email.charAt(0).toUpperCase()}
                  </div>

                  {/* Bubble */}
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-700">{msg.user_role}</span>
                      <span className="text-[10px] text-slate-400">{formatDate(msg.created_at)}</span>
                    </div>
                    <div className={`p-3 rounded-2xl text-sm shadow-sm ${
                      isMe 
                        ? 'bg-primary text-white rounded-tr-none' 
                        : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0 rounded-b-2xl">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ketik pesan Anda di sini..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="bg-primary hover:bg-primary/90 text-white p-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm shadow-primary/30 flex items-center justify-center w-11 h-11"
          >
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
