/**
 * Deterministic natural-language → structured-filter parser (English + Arabic).
 * Used directly when no LLM provider is configured, and as validation / fallback for LLM output.
 * It only produces FILTERS; all influencer data comes from the database.
 */
import { CATEGORY_SEEDS, EMIRATE_LABELS, LANGUAGES, SERVICE_CATALOG_SEEDS, type Emirate, type Platform } from './constants';

export interface ParsedQuery {
  categories: string[]; // category slugs (parents or children)
  specialities: string[]; // child slugs (subset of categories)
  emirates: Emirate[];
  platforms: Platform[];
  languages: string[];
  gender?: 'FEMALE' | 'MALE';
  minFollowers?: number;
  maxFollowers?: number;
  minViews?: number;
  maxBudget?: number;
  budgetTier?: 'affordable' | 'premium';
  serviceTypes: string[];
  minGrade?: 'S' | 'A' | 'B' | 'C';
  limit?: number;
  verifiedOnly?: boolean;
  keywords: string[];
  detectedLocale: 'en' | 'ar';
  /** Human-readable tokens explaining what was understood. */
  understood: string[];
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (c) => String(ARABIC_DIGITS.indexOf(c))).replace(/٬/g, ',');
}

/** Normalise Arabic letter variants for matching (alef forms, taa marbuta, yaa). */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, '') // diacritics + tatweel
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

export function normalizeText(s: string): string {
  return normalizeArabic(normalizeDigits(s.toLowerCase())).replace(/\s+/g, ' ').trim();
}

function parseNumber(raw: string, suffix?: string): number {
  let n = parseFloat(raw.replace(/,/g, ''));
  const s = (suffix ?? '').toLowerCase();
  if (s === 'k' || s === 'ألف' || s === 'الف' || s === 'thousand') n *= 1_000;
  if (s === 'm' || s === 'million' || s === 'مليون') n *= 1_000_000;
  return Math.round(n);
}

function containsTerm(text: string, term: string): boolean {
  const t = normalizeText(term);
  if (!t) return false;
  if (/[؀-ۿ]/.test(t)) return text.includes(t); // Arabic: substring (handles prefixes like ال/ب)
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(text);
}

const NUM = '(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k|m|thousand|million|ألف|الف|مليون)?';

export function parseQuery(query: string): ParsedQuery {
  const text = normalizeText(query);
  const detectedLocale: 'en' | 'ar' = /[؀-ۿ]/.test(query) ? 'ar' : 'en';
  const out: ParsedQuery = { categories: [], specialities: [], emirates: [], platforms: [], languages: [], serviceTypes: [], keywords: [], detectedLocale, understood: [] };

  // Categories & specialities (children first so "dermatologists" maps to dermatology)
  for (const cat of CATEGORY_SEEDS) {
    for (const child of cat.children ?? []) {
      if ([child.en, child.ar, ...child.keywords].some((k) => containsTerm(text, k))) {
        out.specialities.push(child.slug);
        out.categories.push(child.slug);
        out.understood.push(`speciality:${child.slug}`);
      }
    }
  }
  for (const cat of CATEGORY_SEEDS) {
    const childHit = (cat.children ?? []).some((c) => out.specialities.includes(c.slug));
    if (!childHit && [cat.en, cat.ar, ...cat.keywords].some((k) => containsTerm(text, k))) {
      out.categories.push(cat.slug);
      out.understood.push(`category:${cat.slug}`);
    }
  }

  // Emirates
  for (const [key, label] of Object.entries(EMIRATE_LABELS)) {
    const terms = [label.en, label.ar, ...label.cities];
    if (key === 'ABU_DHABI') terms.push('abudhabi', 'ad', 'al ain');
    if (key === 'RAS_AL_KHAIMAH') terms.push('rak');
    if (key === 'UMM_AL_QUWAIN') terms.push('uaq');
    if (terms.some((t) => containsTerm(text, t))) {
      out.emirates.push(key as Emirate);
      out.understood.push(`emirate:${key}`);
    }
  }

  // Platforms
  if (/instagram|insta\b|\big\b|انستقرام|انستغرام|إنستغرام|انستا/.test(text)) out.platforms.push('INSTAGRAM');
  if (/tik ?tok|تيك ?توك/.test(text)) out.platforms.push('TIKTOK');
  if (/\breels?\b|ريل/.test(text) && !out.platforms.includes('INSTAGRAM')) out.platforms.push('INSTAGRAM');
  out.platforms.forEach((p) => out.understood.push(`platform:${p}`));

  // Languages ("Malayalam-speaking", "Arabic speaking", "يتحدث العربية")
  for (const [code, lang] of Object.entries(LANGUAGES)) {
    if (lang.aliases.some((a) => containsTerm(text, a) && new RegExp(`${normalizeText(a)}[\\s-]*(speaking|speaker|creators?|influencers?|content|language)|(speaks?|speaking|in)\\s+${normalizeText(a)}|يتحدث|يتكلم|ناطق|بالل?غه|${normalizeText(a)}`).test(text))) {
      // Avoid treating "english" as a language when part of a category word — acceptable heuristically
      if (!out.languages.includes(code)) {
        out.languages.push(code);
        out.understood.push(`language:${code}`);
      }
    }
  }

  // Gender — only when explicitly requested
  if (/\b(female|women|woman|ladies|girls?)\b|نساء|سيدات|انثي|إناث|اناث|مؤثرات/.test(text)) out.gender = 'FEMALE';
  else if (/\b(male|men|man|guys)\b|رجال|ذكور/.test(text)) out.gender = 'MALE';
  if (out.gender) out.understood.push(`gender:${out.gender}`);

  // Followers
  const fRe = new RegExp(`(?:at least|min(?:imum)?|over|more than|above|\\+|اكثر من|على الاقل|فوق)?\\s*${NUM}\\s*\\+?\\s*(?:followers|follower|متابع)`);
  const fm = text.match(fRe);
  if (fm) {
    const qualifier = text.slice(Math.max(0, (fm.index ?? 0) - 15), (fm.index ?? 0) + 3);
    const value = parseNumber(fm[1], fm[2]);
    if (/under|less than|below|max|اقل من/.test(qualifier)) out.maxFollowers = value;
    else out.minFollowers = value;
    out.understood.push(out.maxFollowers ? `maxFollowers:${value}` : `minFollowers:${value}`);
  }
  const fUnder = text.match(new RegExp(`(?:under|less than|below|fewer than|اقل من)\\s*${NUM}\\s*(?:followers|متابع)`));
  if (fUnder) {
    out.maxFollowers = parseNumber(fUnder[1], fUnder[2]);
    out.minFollowers = undefined;
  }

  // Views
  const vm = text.match(new RegExp(`${NUM}\\s*\\+?\\s*(?:views|view|مشاهده|مشاهدات)`));
  if (vm) {
    out.minViews = parseNumber(vm[1], vm[2]);
    out.understood.push(`minViews:${out.minViews}`);
  }

  // Budget
  const bm =
    text.match(new RegExp(`(?:under|below|less than|max(?:imum)?|budget(?: of)?|up to|within|اقل من|بحدود|ميزانيه|حتى)\\s*(?:aed|dhs?|درهم)?\\s*${NUM}\\s*(?:aed|dhs?|dirhams?|درهم)?`)) ||
    text.match(new RegExp(`${NUM}\\s*(?:aed|dhs?|dirhams?|درهم)`));
  if (bm) {
    out.maxBudget = parseNumber(bm[1], bm[2]);
    out.understood.push(`maxBudget:${out.maxBudget}`);
  }
  if (/affordable|cheap|budget[- ]friendly|low[- ]cost|economical|اسعار مناسبه|رخيص|اقتصادي|مناسب/.test(text)) {
    out.budgetTier = 'affordable';
    out.understood.push('budget:affordable');
  } else if (/premium|luxury creators|top[- ]tier|celebrity|مشاهير/.test(text)) out.budgetTier = 'premium';

  // Service types
  for (const s of SERVICE_CATALOG_SEEDS) {
    if (s.keywords.some((k) => containsTerm(text, k))) out.serviceTypes.push(s.key);
  }
  if (out.serviceTypes.includes('ig_reel')) out.serviceTypes = out.serviceTypes.filter((k) => k !== 'ig_single_story' || /story/.test(text));
  out.serviceTypes = Array.from(new Set(out.serviceTypes));

  // Grade
  const gm = text.match(/\b(?:grade\s*([sabc])|([sabc])[- ]grade)\b/);
  if (gm) out.minGrade = (gm[1] || gm[2]).toUpperCase() as ParsedQuery['minGrade'];
  if (/\bverified\b|موثق|موثقين/.test(text)) out.verifiedOnly = true;

  // Result count: "find 10 ..." / "top 5"
  const lm = text.match(/(?:find|show|top|get|list|recommend|ابحث عن|اعطني|اقترح)\s+(\d{1,2})\b/);
  if (lm) out.limit = Math.min(50, parseInt(lm[1], 10));

  // Remaining keywords for text relevance
  const stop = new Set(['find', 'for', 'a', 'an', 'the', 'with', 'in', 'based', 'who', 'can', 'and', 'of', 'to', 'at', 'least', 'creators', 'creator', 'influencers', 'influencer', 'promote', 'promotion', 'store', 'opening', 'specializing', 'specialising', 'show', 'me', 'top', 'get']);
  out.keywords = text.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !stop.has(w) && !/^\d+$/.test(w)).slice(0, 12);
  return out;
}
