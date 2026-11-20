/**
 * Bilingual notification + email templates. Keys mirror /packages/localization notification keys.
 * Params are interpolated with {name}. Values are HTML-escaped before insertion into email HTML.
 */
type T = { title: string; body: string };
export const TEMPLATES: Record<string, { en: T; ar: T }> = {
  WELCOME: { en: { title: 'Welcome to InfluenceHub', body: 'Your account is ready. Where brands meet influence.' }, ar: { title: 'مرحباً بك في InfluenceHub', body: 'حسابك جاهز. حيث تلتقي العلامات التجارية بالتأثير.' } },
  EMAIL_VERIFY: { en: { title: 'Verify your email', body: 'Use this link to verify your email address: {link}' }, ar: { title: 'تأكيد البريد الإلكتروني', body: 'استخدم هذا الرابط لتأكيد بريدك الإلكتروني: {link}' } },
  PASSWORD_RESET: { en: { title: 'Reset your password', body: 'Use this link to reset your password. It expires in 30 minutes: {link}' }, ar: { title: 'إعادة تعيين كلمة المرور', body: 'استخدم هذا الرابط لإعادة تعيين كلمة المرور. تنتهي صلاحيته خلال 30 دقيقة: {link}' } },
  SOCIAL_CONNECTED: { en: { title: '{platform} account connected', body: '@{username} is now linked to your InfluenceHub profile.' }, ar: { title: 'تم ربط حساب {platform}', body: 'تم ربط ‎@{username} بملفك على InfluenceHub.' } },
  SOCIAL_DISCONNECTED: { en: { title: '{platform} account disconnected', body: '@{username} was disconnected and its access token revoked.' }, ar: { title: 'تم فصل حساب {platform}', body: 'تم فصل ‎@{username} وإلغاء رمز الوصول.' } },
  SOCIAL_TOKEN_EXPIRED: { en: { title: 'Reconnect {platform}', body: 'Access to @{username} expired. Reconnect to keep your statistics up to date.' }, ar: { title: 'أعد ربط {platform}', body: 'انتهت صلاحية الوصول إلى ‎@{username}. أعد الربط لتحديث إحصاءاتك.' } },
  VERIFICATION_APPROVED: { en: { title: 'Verification approved', body: 'Your {type} verification was approved.' }, ar: { title: 'تمت الموافقة على التحقق', body: 'تمت الموافقة على التحقق من {type}.' } },
  VERIFICATION_REJECTED: { en: { title: 'Verification needs attention', body: 'Your {type} verification was not approved: {notes}' }, ar: { title: 'التحقق يحتاج إلى مراجعة', body: 'لم تتم الموافقة على التحقق من {type}: {notes}' } },
  CONTACT_PURCHASED: { en: { title: 'Contact unlocked', body: 'You can now message {name}.' }, ar: { title: 'تم فتح التواصل', body: 'يمكنك الآن مراسلة {name}.' } },
  NEW_ENQUIRY: { en: { title: 'New enquiry from {business}', body: '{business} unlocked contact and may message you soon.' }, ar: { title: 'استفسار جديد من {business}', body: 'قامت {business} بفتح التواصل وقد تراسلك قريباً.' } },
  NEW_MESSAGE: { en: { title: 'New message from {name}', body: '{preview}' }, ar: { title: 'رسالة جديدة من {name}', body: '{preview}' } },
  QUOTATION_REQUESTED: { en: { title: 'Quotation requested', body: '{business} requested a quotation.' }, ar: { title: 'طلب عرض سعر', body: 'طلبت {business} عرض سعر.' } },
  QUOTATION_SUBMITTED: { en: { title: 'Quotation received', body: '{name} sent quotation {number} for AED {amount}.' }, ar: { title: 'تم استلام عرض السعر', body: 'أرسل {name} عرض السعر {number} بقيمة {amount} درهم.' } },
  QUOTATION_ACCEPTED: { en: { title: 'Quotation accepted', body: 'Quotation {number} was accepted and added to the cart.' }, ar: { title: 'تم قبول عرض السعر', body: 'تم قبول عرض السعر {number} وإضافته إلى السلة.' } },
  BOOKING_CONFIRMED: { en: { title: 'New booking confirmed', body: 'Order {number}: {service}. Campaign {campaign} is ready to start.' }, ar: { title: 'تم تأكيد حجز جديد', body: 'الطلب {number}: {service}. الحملة {campaign} جاهزة للبدء.' } },
  PAYMENT_SUCCEEDED: { en: { title: 'Payment received', body: 'Payment of AED {amount} for {reference} was successful.' }, ar: { title: 'تم استلام الدفعة', body: 'تمت دفعة بقيمة {amount} درهم لـ {reference} بنجاح.' } },
  PAYMENT_FAILED: { en: { title: 'Payment failed', body: 'Payment for {reference} did not go through. Please try again.' }, ar: { title: 'فشل الدفع', body: 'لم تتم عملية الدفع لـ {reference}. يرجى المحاولة مرة أخرى.' } },
  CAMPAIGN_UPDATED: { en: { title: 'Campaign {campaign} updated', body: 'Status changed to {status}.' }, ar: { title: 'تم تحديث الحملة {campaign}', body: 'تغيرت الحالة إلى {status}.' } },
  DELIVERABLE_SUBMITTED: { en: { title: 'Content submitted for approval', body: 'New content was submitted for campaign {campaign}.' }, ar: { title: 'تم تقديم المحتوى للموافقة', body: 'تم تقديم محتوى جديد للحملة {campaign}.' } },
  DELIVERABLE_APPROVED: { en: { title: 'Content approved', body: 'Your content for campaign {campaign} was approved.' }, ar: { title: 'تمت الموافقة على المحتوى', body: 'تمت الموافقة على محتواك للحملة {campaign}.' } },
  REVISION_REQUESTED: { en: { title: 'Revision requested', body: 'A revision was requested for campaign {campaign}: {comment}' }, ar: { title: 'طلب تعديل', body: 'تم طلب تعديل للحملة {campaign}: {comment}' } },
  CAMPAIGN_COMPLETED: { en: { title: 'Campaign completed', body: 'Campaign {campaign} is complete.' }, ar: { title: 'اكتملت الحملة', body: 'اكتملت الحملة {campaign}.' } },
  REVIEW_RECEIVED: { en: { title: 'New review', body: 'You received a {rating}-star review.' }, ar: { title: 'تقييم جديد', body: 'حصلت على تقييم {rating} نجوم.' } },
  REFUND_UPDATED: { en: { title: 'Refund {status}', body: 'Refund of AED {amount} is {status}.' }, ar: { title: 'الاسترداد {status}', body: 'استرداد مبلغ {amount} درهم: {status}.' } },
  PAYOUT_UPDATED: { en: { title: 'Payout {status}', body: 'Payout of AED {amount} is {status}.' }, ar: { title: 'الدفعة {status}', body: 'دفعة بقيمة {amount} درهم: {status}.' } },
  DISPUTE_UPDATED: { en: { title: 'Dispute update', body: 'Dispute on campaign {campaign} is now {status}.' }, ar: { title: 'تحديث النزاع', body: 'النزاع على الحملة {campaign} أصبح {status}.' } },
  AGREEMENT_SENT: { en: { title: 'Agreement {number} to review', body: '{name} sent you an agreement to review and sign.' }, ar: { title: 'اتفاقية {number} للمراجعة', body: 'أرسل إليك {name} اتفاقية لمراجعتها وتوقيعها.' } },
  AGREEMENT_REVISED: { en: { title: 'Agreement {number} changed', body: '{name} edited the agreement. Earlier signatures no longer apply — please review the new version.' }, ar: { title: 'تم تعديل الاتفاقية {number}', body: 'عدّل {name} الاتفاقية، ولم تعد التوقيعات السابقة سارية — يرجى مراجعة الإصدار الجديد.' } },
  AGREEMENT_SIGNED: { en: { title: 'Agreement {number} signed by {name}', body: 'Your signature is needed to complete the agreement.' }, ar: { title: 'وقّع {name} الاتفاقية {number}', body: 'يلزم توقيعك لإتمام الاتفاقية.' } },
  AGREEMENT_EXECUTED: { en: { title: 'Agreement {number} fully signed', body: 'Both parties have signed. A signed copy is available in Agreements.' }, ar: { title: 'تم توقيع الاتفاقية {number} من الطرفين', body: 'وقّع الطرفان، ونسخة موقعة متاحة في قسم الاتفاقيات.' } },
  AGREEMENT_DECLINED: { en: { title: 'Agreement {number} declined', body: '{name} declined the agreement.' }, ar: { title: 'تم رفض الاتفاقية {number}', body: 'رفض {name} الاتفاقية.' } },
  AGREEMENT_CANCELLED: { en: { title: 'Agreement {number} cancelled', body: '{name} cancelled the agreement.' }, ar: { title: 'تم إلغاء الاتفاقية {number}', body: 'ألغى {name} الاتفاقية.' } },
  PHONE_OTP: { en: { title: 'Your InfluenceHub code', body: 'Your verification code is {code}. It expires in 10 minutes.' }, ar: { title: 'رمز InfluenceHub', body: 'رمز التحقق الخاص بك هو {code}. تنتهي صلاحيته خلال 10 دقائق.' } },
};

export function render(type: string, locale: 'en' | 'ar', params: Record<string, unknown> = {}): T {
  const t = TEMPLATES[type]?.[locale] ?? TEMPLATES[type]?.en ?? { title: type, body: '' };
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => (params[k] == null ? '' : String(params[k])));
  return { title: fill(t.title), body: fill(t.body) };
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
