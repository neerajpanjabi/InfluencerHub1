'use client';
import { Suspense } from 'react';
import { MessagesView } from '@/components/portal/messages-view';
export default function Page() {
  return (
    <Suspense>
      <MessagesView />
    </Suspense>
  );
}
