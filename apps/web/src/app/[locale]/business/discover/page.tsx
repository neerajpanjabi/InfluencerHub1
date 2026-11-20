'use client';
import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Browse } from '@/components/marketplace/browse';

export default function Discover() {
  const { data } = useQuery({ queryKey: ['categories'], queryFn: () => api<any[]>('/categories') });
  return (
    <div className="-mx-4 -my-6 md:-mx-8 md:-my-8">
      <Suspense>
        <Browse categories={data ?? []} />
      </Suspense>
    </div>
  );
}
