export const EMIRATES = ['DUBAI', 'ABU_DHABI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH'] as const;
export type Emirate = (typeof EMIRATES)[number];

export const EMIRATE_LABELS: Record<Emirate, { en: string; ar: string; cities: string[] }> = {
  DUBAI: { en: 'Dubai', ar: 'دبي', cities: ['Dubai', 'Hatta', 'Jebel Ali'] },
  ABU_DHABI: { en: 'Abu Dhabi', ar: 'أبوظبي', cities: ['Abu Dhabi', 'Al Ain', 'Ruwais', 'Madinat Zayed'] },
  SHARJAH: { en: 'Sharjah', ar: 'الشارقة', cities: ['Sharjah', 'Khor Fakkan', 'Kalba', 'Dibba Al-Hisn'] },
  AJMAN: { en: 'Ajman', ar: 'عجمان', cities: ['Ajman', 'Masfout', 'Manama'] },
  UMM_AL_QUWAIN: { en: 'Umm Al Quwain', ar: 'أم القيوين', cities: ['Umm Al Quwain', 'Falaj Al Mualla'] },
  RAS_AL_KHAIMAH: { en: 'Ras Al Khaimah', ar: 'رأس الخيمة', cities: ['Ras Al Khaimah', 'Al Jazirah Al Hamra'] },
  FUJAIRAH: { en: 'Fujairah', ar: 'الفجيرة', cities: ['Fujairah', 'Dibba Al-Fujairah', 'Masafi'] },
};

/** Countries for architectural extensibility. Only AE is enabled at launch. */
export const COUNTRIES = { AE: { enabled: true, currency: 'AED', dialCode: '+971' } } as const;

export const LANGUAGES: Record<string, { en: string; ar: string; aliases: string[] }> = {
  ar: { en: 'Arabic', ar: 'العربية', aliases: ['arabic', 'عربي', 'العربية', 'عربية'] },
  en: { en: 'English', ar: 'الإنجليزية', aliases: ['english', 'انجليزي', 'الإنجليزية', 'إنجليزي'] },
  hi: { en: 'Hindi', ar: 'الهندية', aliases: ['hindi', 'هندي', 'الهندية'] },
  ur: { en: 'Urdu', ar: 'الأردية', aliases: ['urdu', 'أردو', 'الأردية'] },
  ml: { en: 'Malayalam', ar: 'المالايالامية', aliases: ['malayalam', 'malayali', 'مالايالام', 'المالايالامية'] },
  ta: { en: 'Tamil', ar: 'التاميلية', aliases: ['tamil', 'تاميل', 'التاميلية'] },
  tl: { en: 'Tagalog / Filipino', ar: 'الفلبينية', aliases: ['tagalog', 'filipino', 'فلبيني', 'الفلبينية'] },
  ru: { en: 'Russian', ar: 'الروسية', aliases: ['russian', 'روسي', 'الروسية'] },
  fr: { en: 'French', ar: 'الفرنسية', aliases: ['french', 'فرنسي', 'الفرنسية'] },
  fa: { en: 'Persian', ar: 'الفارسية', aliases: ['persian', 'farsi', 'فارسي', 'الفارسية'] },
  bn: { en: 'Bengali', ar: 'البنغالية', aliases: ['bengali', 'bangla', 'بنغالي'] },
  zh: { en: 'Chinese', ar: 'الصينية', aliases: ['chinese', 'mandarin', 'صيني', 'الصينية'] },
};

export const PLATFORMS = ['INSTAGRAM', 'TIKTOK', 'CROSS_PLATFORM', 'OFFLINE'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const GRADES = ['S', 'A', 'B', 'C', 'D', 'NOT_RATED'] as const;

export interface CategorySeed {
  slug: string;
  en: string;
  ar: string;
  icon: string;
  medical?: boolean;
  keywords: string[]; // EN + AR keywords used by search & AI parsing
  children?: Array<{ slug: string; en: string; ar: string; keywords: string[] }>;
}

export const CATEGORY_SEEDS: CategorySeed[] = [
  {
    slug: 'medical-healthcare', en: 'Medical and Healthcare', ar: 'الطب والرعاية الصحية', icon: 'Stethoscope', medical: true,
    keywords: ['medical', 'healthcare', 'health', 'clinic', 'hospital', 'doctor', 'doctors', 'طبي', 'صحة', 'عيادة', 'مستشفى', 'طبيب', 'أطباء'],
    children: [
      { slug: 'dermatology', en: 'Dermatology', ar: 'الأمراض الجلدية', keywords: ['dermatology', 'dermatologist', 'dermatologists', 'skin', 'جلدية', 'جلد', 'طبيب جلدية'] },
      { slug: 'dentistry', en: 'Dentistry', ar: 'طب الأسنان', keywords: ['dentistry', 'dentist', 'dentists', 'dental', 'أسنان', 'طبيب أسنان'] },
      { slug: 'orthodontics', en: 'Orthodontics', ar: 'تقويم الأسنان', keywords: ['orthodontics', 'orthodontist', 'braces', 'تقويم'] },
      { slug: 'plastic-surgery', en: 'Plastic Surgery', ar: 'الجراحة التجميلية', keywords: ['plastic surgery', 'plastic surgeon', 'جراحة تجميلية'] },
      { slug: 'cosmetic-dermatology', en: 'Cosmetic Dermatology', ar: 'الجلدية التجميلية', keywords: ['cosmetic dermatology', 'botox', 'fillers'] },
      { slug: 'general-medicine', en: 'General Medicine', ar: 'الطب العام', keywords: ['general medicine', 'gp', 'general practitioner', 'طب عام'] },
      { slug: 'paediatrics', en: 'Paediatrics', ar: 'طب الأطفال', keywords: ['paediatrics', 'pediatrics', 'paediatrician', 'pediatrician', 'طب الأطفال'] },
      { slug: 'gynaecology', en: 'Gynaecology', ar: 'أمراض النساء', keywords: ['gynaecology', 'gynecology', 'gynaecologist', 'gynecologist', 'نسائية'] },
      { slug: 'cardiology', en: 'Cardiology', ar: 'أمراض القلب', keywords: ['cardiology', 'cardiologist', 'heart', 'قلب'] },
      { slug: 'neurology', en: 'Neurology', ar: 'الأعصاب', keywords: ['neurology', 'neurologist', 'أعصاب'] },
      { slug: 'orthopaedics', en: 'Orthopaedics', ar: 'العظام', keywords: ['orthopaedics', 'orthopedics', 'orthopaedic', 'عظام'] },
      { slug: 'physiotherapy', en: 'Physiotherapy', ar: 'العلاج الطبيعي', keywords: ['physiotherapy', 'physio', 'physiotherapist', 'علاج طبيعي'] },
      { slug: 'nutrition', en: 'Nutrition', ar: 'التغذية', keywords: ['nutrition', 'nutritionist', 'تغذية'] },
      { slug: 'dietetics', en: 'Dietetics', ar: 'علم الحميات', keywords: ['dietetics', 'dietitian', 'dietician', 'diet', 'حمية', 'أخصائي تغذية'] },
      { slug: 'psychology', en: 'Psychology', ar: 'علم النفس', keywords: ['psychology', 'psychologist', 'therapist', 'نفسي', 'علم النفس'] },
      { slug: 'mental-wellness', en: 'Mental Wellness', ar: 'الصحة النفسية', keywords: ['mental wellness', 'mental health', 'wellbeing', 'الصحة النفسية'] },
      { slug: 'ophthalmology', en: 'Ophthalmology', ar: 'طب العيون', keywords: ['ophthalmology', 'ophthalmologist', 'eye', 'عيون'] },
      { slug: 'ent', en: 'ENT', ar: 'الأنف والأذن والحنجرة', keywords: ['ent', 'ear nose throat', 'أنف وأذن'] },
      { slug: 'aesthetic-medicine', en: 'Aesthetic Medicine', ar: 'الطب التجميلي', keywords: ['aesthetic', 'aesthetics', 'aesthetic medicine', 'تجميل'] },
      { slug: 'pharmacy', en: 'Pharmacy', ar: 'الصيدلة', keywords: ['pharmacy', 'pharmacist', 'صيدلية', 'صيدلي'] },
      { slug: 'healthcare-technology', en: 'Healthcare Technology', ar: 'تكنولوجيا الرعاية الصحية', keywords: ['healthtech', 'healthcare technology', 'medtech'] },
    ],
  },
  { slug: 'real-estate', en: 'Real Estate', ar: 'العقارات', icon: 'Building2', keywords: ['real estate', 'property', 'properties', 'villa', 'villas', 'apartment', 'luxury villas', 'عقارات', 'عقار', 'فلل', 'فيلا', 'شقق'] },
  { slug: 'restaurants-food', en: 'Restaurants and Food', ar: 'المطاعم والطعام', icon: 'UtensilsCrossed', keywords: ['food', 'foodie', 'restaurant', 'restaurants', 'cafe', 'dining', 'chef', 'طعام', 'مطعم', 'مطاعم', 'أكل', 'مقهى'] },
  { slug: 'beauty-salons', en: 'Beauty and Salons', ar: 'التجميل والصالونات', icon: 'Sparkles', keywords: ['beauty', 'salon', 'salons', 'makeup', 'skincare', 'hair', 'nails', 'جمال', 'صالون', 'مكياج', 'عناية بالبشرة'] },
  { slug: 'jewellery-luxury', en: 'Jewellery and Luxury', ar: 'المجوهرات والفخامة', icon: 'Gem', keywords: ['jewellery', 'jewelry', 'jewellery store', 'gold', 'diamond', 'luxury', 'watches', 'مجوهرات', 'ذهب', 'فخامة', 'ساعات'] },
  { slug: 'retail-hypermarkets', en: 'Retail and Hypermarkets', ar: 'التجزئة والهايبرماركت', icon: 'ShoppingCart', keywords: ['retail', 'supermarket', 'hypermarket', 'grocery', 'shopping', 'store opening', 'سوبرماركت', 'هايبرماركت', 'تسوق', 'بقالة'] },
  { slug: 'education-schools', en: 'Education and Schools', ar: 'التعليم والمدارس', icon: 'GraduationCap', keywords: ['education', 'school', 'schools', 'university', 'tutoring', 'nursery', 'تعليم', 'مدرسة', 'مدارس', 'جامعة'] },
  { slug: 'hospitality-tourism', en: 'Hospitality and Tourism', ar: 'الضيافة والسياحة', icon: 'Hotel', keywords: ['hotel', 'hotels', 'hospitality', 'tourism', 'resort', 'staycation', 'فندق', 'فنادق', 'سياحة', 'ضيافة'] },
  { slug: 'automotive', en: 'Automotive', ar: 'السيارات', icon: 'Car', keywords: ['automotive', 'car', 'cars', 'auto', 'dealership', 'سيارات', 'سيارة'] },
  { slug: 'fitness-sports', en: 'Fitness and Sports', ar: 'اللياقة والرياضة', icon: 'Dumbbell', keywords: ['fitness', 'gym', 'sports', 'sport', 'workout', 'yoga', 'لياقة', 'رياضة', 'نادي رياضي'] },
  { slug: 'finance-professional-services', en: 'Finance and Professional Services', ar: 'المالية والخدمات المهنية', icon: 'Landmark', keywords: ['finance', 'bank', 'banking', 'investment', 'legal', 'accounting', 'insurance', 'مالية', 'بنك', 'استثمار', 'تأمين'] },
  { slug: 'technology-electronics', en: 'Technology and Electronics', ar: 'التكنولوجيا والإلكترونيات', icon: 'Cpu', keywords: ['technology', 'tech', 'electronics', 'gadgets', 'apps', 'gaming', 'تكنولوجيا', 'إلكترونيات', 'تقنية'] },
  { slug: 'fashion-lifestyle', en: 'Fashion and Lifestyle', ar: 'الموضة وأسلوب الحياة', icon: 'Shirt', keywords: ['fashion', 'lifestyle', 'style', 'clothing', 'abaya', 'modest fashion', 'موضة', 'أزياء', 'عباية', 'أسلوب حياة'] },
  { slug: 'home-living', en: 'Home and Living', ar: 'المنزل والمعيشة', icon: 'Sofa', keywords: ['home', 'interior', 'furniture', 'decor', 'living', 'منزل', 'ديكور', 'أثاث'] },
  { slug: 'events-entertainment', en: 'Events and Entertainment', ar: 'الفعاليات والترفيه', icon: 'PartyPopper', keywords: ['events', 'event', 'entertainment', 'concert', 'nightlife', 'فعاليات', 'ترفيه', 'حفلة'] },
  { slug: 'travel', en: 'Travel', ar: 'السفر', icon: 'Plane', keywords: ['travel', 'traveller', 'airline', 'trip', 'سفر', 'رحلات'] },
  { slug: 'parenting-family', en: 'Parenting and Family', ar: 'الأبوة والأسرة', icon: 'Baby', keywords: ['parenting', 'family', 'mom', 'mum', 'mother', 'kids', 'أمومة', 'عائلة', 'أطفال', 'أم'] },
  { slug: 'pets-animals', en: 'Pets and Animals', ar: 'الحيوانات الأليفة', icon: 'PawPrint', keywords: ['pets', 'pet', 'dog', 'cat', 'animals', 'حيوانات', 'قطط', 'كلاب'] },
  { slug: 'business-entrepreneurship', en: 'Business and Entrepreneurship', ar: 'الأعمال وريادة الأعمال', icon: 'Briefcase', keywords: ['business', 'entrepreneur', 'entrepreneurship', 'startup', 'أعمال', 'ريادة', 'شركات ناشئة'] },
  { slug: 'other-commercial', en: 'Other Commercial Categories', ar: 'فئات تجارية أخرى', icon: 'LayoutGrid', keywords: ['other'] },
];

export interface ServiceCatalogSeed {
  key: string;
  platform: Platform;
  en: string;
  ar: string;
  deliverables: Array<{ type: string; platform: Platform; quantity: number }>;
  complexity: number;
  keywords: string[];
}

const d = (type: string, platform: Platform, quantity = 1) => ({ type, platform, quantity });

export const SERVICE_CATALOG_SEEDS: ServiceCatalogSeed[] = [
  { key: 'ig_single_story', platform: 'INSTAGRAM', en: 'Single Story', ar: 'ستوري واحدة', deliverables: [d('STORY', 'INSTAGRAM')], complexity: 1, keywords: ['story', 'ستوري'] },
  { key: 'ig_story_3', platform: 'INSTAGRAM', en: 'Three Story Package', ar: 'باقة ثلاث ستوريات', deliverables: [d('STORY', 'INSTAGRAM', 3)], complexity: 1, keywords: ['3 stories', 'three stories'] },
  { key: 'ig_story_5', platform: 'INSTAGRAM', en: 'Five Story Package', ar: 'باقة خمس ستوريات', deliverables: [d('STORY', 'INSTAGRAM', 5)], complexity: 1, keywords: ['5 stories', 'five stories'] },
  { key: 'ig_reel', platform: 'INSTAGRAM', en: 'Reel', ar: 'ريل', deliverables: [d('REEL', 'INSTAGRAM')], complexity: 1.1, keywords: ['reel', 'reels', 'ريل', 'ريلز'] },
  { key: 'ig_reel_story', platform: 'INSTAGRAM', en: 'Reel + Story', ar: 'ريل + ستوري', deliverables: [d('REEL', 'INSTAGRAM'), d('STORY', 'INSTAGRAM')], complexity: 1.1, keywords: ['reel and story'] },
  { key: 'ig_reel_story_3', platform: 'INSTAGRAM', en: 'Reel + Three Stories', ar: 'ريل + ثلاث ستوريات', deliverables: [d('REEL', 'INSTAGRAM'), d('STORY', 'INSTAGRAM', 3)], complexity: 1.1, keywords: [] },
  { key: 'ig_reel_story_5', platform: 'INSTAGRAM', en: 'Reel + Five Stories', ar: 'ريل + خمس ستوريات', deliverables: [d('REEL', 'INSTAGRAM'), d('STORY', 'INSTAGRAM', 5)], complexity: 1.1, keywords: [] },
  { key: 'ig_carousel', platform: 'INSTAGRAM', en: 'Carousel', ar: 'منشور دوّار', deliverables: [d('CAROUSEL', 'INSTAGRAM')], complexity: 1, keywords: ['carousel'] },
  { key: 'ig_feed_post', platform: 'INSTAGRAM', en: 'Feed Post', ar: 'منشور', deliverables: [d('POST', 'INSTAGRAM')], complexity: 1, keywords: ['post', 'feed post', 'منشور'] },
  { key: 'ig_live', platform: 'INSTAGRAM', en: 'Live Session', ar: 'بث مباشر', deliverables: [d('LIVE', 'INSTAGRAM')], complexity: 1, keywords: ['live', 'بث مباشر'] },
  { key: 'ig_event_coverage', platform: 'INSTAGRAM', en: 'Event Coverage', ar: 'تغطية فعالية', deliverables: [d('EVENT_COVERAGE', 'INSTAGRAM')], complexity: 1.3, keywords: ['event coverage', 'تغطية'] },
  { key: 'ig_monthly_promotion', platform: 'INSTAGRAM', en: 'Monthly Promotion', ar: 'ترويج شهري', deliverables: [d('REEL', 'INSTAGRAM', 2), d('STORY', 'INSTAGRAM', 8)], complexity: 1.2, keywords: ['monthly'] },
  { key: 'tt_video', platform: 'TIKTOK', en: 'TikTok Video', ar: 'فيديو تيك توك', deliverables: [d('TIKTOK_VIDEO', 'TIKTOK')], complexity: 1.1, keywords: ['tiktok video', 'tiktok', 'تيك توك'] },
  { key: 'tt_product_review', platform: 'TIKTOK', en: 'TikTok Product Review', ar: 'مراجعة منتج على تيك توك', deliverables: [d('TIKTOK_VIDEO', 'TIKTOK')], complexity: 1.15, keywords: ['tiktok review'] },
  { key: 'tt_live', platform: 'TIKTOK', en: 'TikTok Live Promotion', ar: 'ترويج بث مباشر تيك توك', deliverables: [d('LIVE', 'TIKTOK')], complexity: 1, keywords: ['tiktok live'] },
  { key: 'tt_campaign_package', platform: 'TIKTOK', en: 'TikTok Campaign Package', ar: 'باقة حملة تيك توك', deliverables: [d('TIKTOK_VIDEO', 'TIKTOK', 3)], complexity: 1.2, keywords: [] },
  { key: 'x_ig_tt_video', platform: 'CROSS_PLATFORM', en: 'Instagram + TikTok Video', ar: 'فيديو إنستغرام + تيك توك', deliverables: [d('REEL', 'INSTAGRAM'), d('TIKTOK_VIDEO', 'TIKTOK')], complexity: 1.15, keywords: [] },
  { key: 'x_reel_tt_video', platform: 'CROSS_PLATFORM', en: 'Instagram Reel + TikTok Video', ar: 'ريل إنستغرام + فيديو تيك توك', deliverables: [d('REEL', 'INSTAGRAM'), d('TIKTOK_VIDEO', 'TIKTOK')], complexity: 1.15, keywords: [] },
  { key: 'x_story_tt_video', platform: 'CROSS_PLATFORM', en: 'Story + TikTok Video', ar: 'ستوري + فيديو تيك توك', deliverables: [d('STORY', 'INSTAGRAM'), d('TIKTOK_VIDEO', 'TIKTOK')], complexity: 1.1, keywords: [] },
  { key: 'x_multi_platform', platform: 'CROSS_PLATFORM', en: 'Multi-platform Promotion', ar: 'ترويج متعدد المنصات', deliverables: [d('REEL', 'INSTAGRAM'), d('STORY', 'INSTAGRAM', 3), d('TIKTOK_VIDEO', 'TIKTOK')], complexity: 1.25, keywords: [] },
  { key: 'ugc_video', platform: 'OFFLINE', en: 'UGC Video', ar: 'فيديو محتوى المستخدم', deliverables: [d('UGC_VIDEO', 'OFFLINE')], complexity: 1.1, keywords: ['ugc'] },
  { key: 'product_photography', platform: 'OFFLINE', en: 'Product Photography', ar: 'تصوير المنتجات', deliverables: [d('PHOTO_SET', 'OFFLINE')], complexity: 1.1, keywords: ['photography', 'تصوير'] },
  { key: 'product_review', platform: 'CROSS_PLATFORM', en: 'Product Review', ar: 'مراجعة منتج', deliverables: [d('REVIEW_VIDEO', 'CROSS_PLATFORM')], complexity: 1.1, keywords: ['product review', 'review', 'مراجعة'] },
  { key: 'store_visit', platform: 'CROSS_PLATFORM', en: 'Store Visit', ar: 'زيارة متجر', deliverables: [d('VISIT', 'CROSS_PLATFORM')], complexity: 1.2, keywords: ['store visit', 'opening', 'زيارة'] },
  { key: 'restaurant_visit', platform: 'CROSS_PLATFORM', en: 'Restaurant Visit', ar: 'زيارة مطعم', deliverables: [d('VISIT', 'CROSS_PLATFORM')], complexity: 1.2, keywords: ['restaurant visit'] },
  { key: 'event_attendance', platform: 'OFFLINE', en: 'Event Attendance', ar: 'حضور فعالية', deliverables: [d('ATTENDANCE', 'OFFLINE')], complexity: 1.2, keywords: ['event attendance', 'attend'] },
  { key: 'product_demo', platform: 'CROSS_PLATFORM', en: 'Product Demonstration', ar: 'عرض منتج', deliverables: [d('DEMO_VIDEO', 'CROSS_PLATFORM')], complexity: 1.15, keywords: ['demo', 'demonstration'] },
  { key: 'monthly_retainer', platform: 'CROSS_PLATFORM', en: 'Monthly Retainer', ar: 'اتفاق شهري', deliverables: [d('RETAINER', 'CROSS_PLATFORM')], complexity: 1, keywords: ['retainer'] },
  { key: 'brand_ambassador', platform: 'CROSS_PLATFORM', en: 'Brand Ambassador', ar: 'سفير علامة تجارية', deliverables: [d('AMBASSADOR', 'CROSS_PLATFORM')], complexity: 1, keywords: ['ambassador', 'سفير'] },
  { key: 'content_production', platform: 'OFFLINE', en: 'Content Production', ar: 'إنتاج محتوى', deliverables: [d('CONTENT', 'OFFLINE')], complexity: 1.3, keywords: ['content production', 'إنتاج'] },
];

/**
 * Legal documents and their current versions. Bump a version when the text changes materially;
 * acceptance is stored per user as a consent record `<key>@<version>` (see auth registration).
 */
export const LEGAL_DOCUMENTS = {
  'platform-terms': { version: '2026-11', path: '/terms' },
  'business-terms': { version: '2026-11', path: '/terms/business' },
  'creator-terms': { version: '2026-11', path: '/terms/creators' },
  privacy: { version: '2026-11', path: '/privacy' },
} as const;
export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENTS;
export const legalConsentVersion = (key: LegalDocumentKey) => `${key}@${LEGAL_DOCUMENTS[key].version}`;

/** Documents a user of each type must accept. */
export const REQUIRED_LEGAL_DOCUMENTS: Record<'BUSINESS' | 'INFLUENCER', LegalDocumentKey[]> = {
  BUSINESS: ['platform-terms', 'business-terms', 'privacy'],
  INFLUENCER: ['platform-terms', 'creator-terms', 'privacy'],
};
