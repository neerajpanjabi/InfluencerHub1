'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, MessageSquare, Paperclip, Send, ShieldOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { usePathname, useRouter } from '@/i18n/routing';
import { fmtDate, fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Avatar, EmptyState, PageHeader } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';

export function MessagesView() {
  const t = useTranslations();
  const locale = useLocale();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const toast = useToast();
  const err = useErrorMessage();
  const selected = sp.get('c');
  const convs = useQuery({ queryKey: ['conversations'], queryFn: () => api<any[]>('/conversations'), refetchInterval: 20_000 });
  const thread = useQuery({ queryKey: ['messages', selected], queryFn: () => api<any>(`/conversations/${selected}/messages`), enabled: !!selected, refetchInterval: 8_000 });
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<Array<{ id: string; fileName: string }>>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [thread.data?.messages?.length]);
  useEffect(() => {
    if (!selected && convs.data?.length && window.innerWidth >= 1024) router.replace(`${pathname}?c=${convs.data[0].id}`);
  }, [selected, convs.data, router, pathname]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !selected) return;
    setBusy(true);
    try {
      await api(`/conversations/${selected}/messages`, { body: { body, attachmentIds: files.map((f) => f.id) } });
      setBody('');
      setFiles([]);
      qc.invalidateQueries({ queryKey: ['messages', selected] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e2) {
      toast(err(e2), 'error');
    } finally {
      setBusy(false);
    }
  };
  const upload = async (file: File) => {
    const fd = new FormData();
    fd.append('purpose', 'MESSAGE');
    fd.append('file', file);
    try {
      const a = await api('/uploads', { form: fd });
      setFiles((f) => [...f, a]);
    } catch (e2) {
      toast(err(e2), 'error');
    }
  };
  const current = convs.data?.find((c) => c.id === selected);

  return (
    <div>
      <PageHeader title={t('messages.title')} />
      {convs.data && convs.data.length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-8 w-8" />} title={t('messages.empty')} />
      ) : (
        <div className="grid h-[70vh] overflow-hidden rounded-lg border border-stone-200 bg-white lg:grid-cols-[300px_1fr]">
          <ul className={cn('overflow-y-auto border-e border-stone-100', selected && 'hidden lg:block')}>
            {convs.data?.map((c) => (
              <li key={c.id}>
                <button onClick={() => router.replace(`${pathname}?c=${c.id}`)} className={cn('flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-stone-50', c.id === selected && 'bg-ivory-100')}>
                  <Avatar name={c.other.name ?? '?'} src={c.other.image} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{c.other.name}</p>
                      {c.lastMessageAt && <span className="shrink-0 text-[11px] text-stone-400">{fmtRelative(c.lastMessageAt, locale)}</span>}
                    </div>
                    <p className="truncate text-xs text-stone-500">{c.lastMessage?.body ?? '—'}</p>
                  </div>
                  {c.unread > 0 && <span className="rounded-full bg-gold-500 px-1.5 text-[10px] font-bold text-navy-950">{c.unread}</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className={cn('flex min-h-0 flex-col', !selected && 'hidden lg:flex')}>
            {!selected ? (
              <div className="flex flex-1 items-center justify-center text-sm text-stone-500">{t('messages.selectConversation')}</div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                  <button className="text-sm lg:hidden" onClick={() => router.replace(pathname)}>
                    ←
                  </button>
                  <p className="font-medium">{current?.other.name}</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={async () => { await api(`/conversations/${selected}/block`, { method: 'POST' }); toast(t('messages.block')); }} title={t('messages.block')}>
                      <ShieldOff className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50/50 p-4">
                  {thread.data?.messages.map((m: any) => (
                    <div key={m.id} className={cn('group flex', m.mine ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[78%] rounded-lg px-3.5 py-2 text-sm shadow-sm', m.mine ? 'bg-navy-900 text-ivory' : 'bg-white text-navy-900')}>
                        <p className="whitespace-pre-wrap break-words">{m.status === 'REMOVED' ? '—' : m.body}</p>
                        {m.attachments?.map((a: any) => (
                          <a key={a.id} href={`/api/v1/uploads/${a.id}`} target="_blank" rel="noreferrer" className="mt-1 block text-xs underline">
                            📎 {a.fileName}
                          </a>
                        ))}
                        <p className={cn('mt-1 text-[10px]', m.mine ? 'text-ivory/60' : 'text-stone-400')}>
                          {fmtDate(m.createdAt, locale, true)}
                          {m.mine && thread.data.otherLastReadAt && new Date(thread.data.otherLastReadAt) >= new Date(m.createdAt) && ` · ${t('messages.seen')}`}
                        </p>
                      </div>
                      {!m.mine && (
                        <button
                          className="ms-1 self-center opacity-0 group-hover:opacity-100"
                          title={t('messages.report')}
                          onClick={async () => {
                            const reason = prompt(t('messages.reportReason'));
                            if (reason) await api('/conversations/reports', { body: { targetType: 'MESSAGE', targetId: m.id, reason } }).then(() => toast(t('messages.report')), (e2) => toast(err(e2), 'error'));
                          }}
                        >
                          <Flag className="h-3.5 w-3.5 text-stone-400" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
                <form onSubmit={send} className="border-t border-stone-100 p-3">
                  {files.length > 0 && <p className="mb-2 text-xs text-stone-500">📎 {files.map((f) => f.fileName).join(', ')}</p>}
                  <div className="flex items-end gap-2">
                    <label className="cursor-pointer rounded p-2 text-stone-500 hover:bg-stone-100" title={t('messages.attach')}>
                      <Paperclip className="h-5 w-5" />
                      <input type="file" className="hidden" accept="image/*,application/pdf,video/mp4" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                    </label>
                    <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('messages.placeholder')} rows={2} className="min-h-0 flex-1" maxLength={4000} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(e); } }} />
                    <Button type="submit" loading={busy} aria-label={t('messages.send')}>
                      <Send className="flip-rtl h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-stone-400">{t('messages.contactDetailsBlocked')}</p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
