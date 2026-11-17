/** Campaign lifecycle state machine. Every transition is validated server-side. */
export const CAMPAIGN_STATUSES = [
  'DRAFT',
  'ENQUIRY',
  'QUOTATION_REQUESTED',
  'QUOTATION_SUBMITTED',
  'AWAITING_ACCEPTANCE',
  'PAYMENT_PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'CONTENT_SUBMITTED',
  'AWAITING_APPROVAL',
  'REVISION_REQUESTED',
  'APPROVED',
  'PUBLISHED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export type CampaignActor = 'BUSINESS' | 'INFLUENCER' | 'ADMIN' | 'SYSTEM';

type Rule = { to: CampaignStatus; actors: CampaignActor[] };

const T: Record<CampaignStatus, Rule[]> = {
  DRAFT: [
    { to: 'ENQUIRY', actors: ['BUSINESS'] },
    { to: 'QUOTATION_REQUESTED', actors: ['BUSINESS'] },
    { to: 'PAYMENT_PENDING', actors: ['BUSINESS', 'SYSTEM'] },
    { to: 'CANCELLED', actors: ['BUSINESS'] },
  ],
  ENQUIRY: [
    { to: 'QUOTATION_REQUESTED', actors: ['BUSINESS'] },
    { to: 'CANCELLED', actors: ['BUSINESS', 'INFLUENCER'] },
  ],
  QUOTATION_REQUESTED: [
    { to: 'QUOTATION_SUBMITTED', actors: ['INFLUENCER', 'SYSTEM'] },
    { to: 'CANCELLED', actors: ['BUSINESS', 'INFLUENCER'] },
  ],
  QUOTATION_SUBMITTED: [
    { to: 'AWAITING_ACCEPTANCE', actors: ['SYSTEM'] },
    { to: 'PAYMENT_PENDING', actors: ['BUSINESS', 'SYSTEM'] },
    { to: 'QUOTATION_REQUESTED', actors: ['BUSINESS'] },
    { to: 'CANCELLED', actors: ['BUSINESS', 'INFLUENCER'] },
  ],
  AWAITING_ACCEPTANCE: [
    { to: 'PAYMENT_PENDING', actors: ['BUSINESS', 'SYSTEM'] },
    { to: 'CANCELLED', actors: ['BUSINESS', 'INFLUENCER'] },
  ],
  PAYMENT_PENDING: [
    { to: 'CONFIRMED', actors: ['SYSTEM'] },
    { to: 'CANCELLED', actors: ['BUSINESS', 'SYSTEM'] },
  ],
  CONFIRMED: [
    { to: 'IN_PROGRESS', actors: ['INFLUENCER'] },
    { to: 'CANCELLED', actors: ['ADMIN', 'INFLUENCER'] },
    { to: 'DISPUTED', actors: ['BUSINESS', 'INFLUENCER'] },
  ],
  IN_PROGRESS: [
    { to: 'CONTENT_SUBMITTED', actors: ['INFLUENCER'] },
    { to: 'DISPUTED', actors: ['BUSINESS', 'INFLUENCER'] },
    { to: 'CANCELLED', actors: ['ADMIN'] },
  ],
  CONTENT_SUBMITTED: [
    { to: 'AWAITING_APPROVAL', actors: ['SYSTEM'] },
    { to: 'APPROVED', actors: ['BUSINESS'] },
    { to: 'REVISION_REQUESTED', actors: ['BUSINESS'] },
    { to: 'PUBLISHED', actors: ['INFLUENCER'] },
    { to: 'DISPUTED', actors: ['BUSINESS', 'INFLUENCER'] },
  ],
  AWAITING_APPROVAL: [
    { to: 'APPROVED', actors: ['BUSINESS'] },
    { to: 'REVISION_REQUESTED', actors: ['BUSINESS'] },
    { to: 'DISPUTED', actors: ['BUSINESS', 'INFLUENCER'] },
  ],
  REVISION_REQUESTED: [
    { to: 'CONTENT_SUBMITTED', actors: ['INFLUENCER'] },
    { to: 'DISPUTED', actors: ['BUSINESS', 'INFLUENCER'] },
  ],
  APPROVED: [
    { to: 'PUBLISHED', actors: ['INFLUENCER'] },
    { to: 'DISPUTED', actors: ['BUSINESS', 'INFLUENCER'] },
  ],
  PUBLISHED: [
    { to: 'COMPLETED', actors: ['BUSINESS', 'SYSTEM', 'ADMIN'] },
    { to: 'DISPUTED', actors: ['BUSINESS', 'INFLUENCER'] },
  ],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: [
    { to: 'IN_PROGRESS', actors: ['ADMIN'] },
    { to: 'COMPLETED', actors: ['ADMIN'] },
    { to: 'CANCELLED', actors: ['ADMIN'] },
  ],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus, actor: CampaignActor): boolean {
  if (actor === 'ADMIN' && to === 'DISPUTED') return false;
  return T[from].some((r) => r.to === to && (r.actors.includes(actor) || (actor === 'ADMIN' && r.actors.includes('SYSTEM'))));
}

export function allowedTransitions(from: CampaignStatus, actor: CampaignActor): CampaignStatus[] {
  return T[from].filter((r) => r.actors.includes(actor)).map((r) => r.to);
}

export const TERMINAL_CAMPAIGN_STATUSES: CampaignStatus[] = ['COMPLETED', 'CANCELLED'];
export const ACTIVE_CAMPAIGN_STATUSES: CampaignStatus[] = [
  'CONFIRMED',
  'IN_PROGRESS',
  'CONTENT_SUBMITTED',
  'AWAITING_APPROVAL',
  'REVISION_REQUESTED',
  'APPROVED',
  'PUBLISHED',
];
