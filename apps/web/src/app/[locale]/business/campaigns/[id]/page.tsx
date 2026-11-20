'use client';
import { use } from 'react';
import { CampaignDetail } from '@/components/portal/campaigns';
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <CampaignDetail id={use(params).id} />;
}
