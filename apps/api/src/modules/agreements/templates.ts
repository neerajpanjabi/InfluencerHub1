/** Starting clauses offered when drafting an agreement. Parties edit them freely. */
export const AGREEMENT_TEMPLATES: Record<'en' | 'ar', Array<{ heading: string; body: string }>> = {
  en: [
    { heading: 'Parties and purpose', body: 'This agreement is between the Business and the Creator named above, who met through InfluenceHub. It sets out the services the Creator will provide and the terms both parties agree to.' },
    { heading: 'Scope of work and deliverables', body: 'The Creator will produce and publish the following content: [describe deliverables, platforms, number of posts/stories/videos and key messages].' },
    { heading: 'Timeline', body: 'Drafts will be shared by [date]. Content will be published between [date] and [date]. Each party will respond to the other within 5 business days.' },
    { heading: 'Approvals and revisions', body: 'The Business may request up to [number] rounds of revisions per deliverable before publication. Content will not be published without the Business\'s approval where approval is required.' },
    { heading: 'Disclosure and compliance', body: 'All sponsored content will be clearly labelled as advertising. Both parties will comply with UAE advertising, media content and consumer protection laws, and any sector approvals required (for example healthcare advertising approvals).' },
    { heading: 'Content ownership and usage rights', body: 'The Creator keeps ownership of the content. The Business may use it as follows: [organic reposting / paid advertising / website], for the period set out in the financial terms.' },
    { heading: 'Confidentiality', body: 'Each party will keep confidential any non-public information received from the other, including unreleased products, prices and campaign plans, during this agreement and for 12 months after it ends.' },
    { heading: 'Termination', body: 'Either party may end this agreement by written notice if the other materially breaches it and does not fix the breach within 7 days. Payment for work properly delivered before termination remains due.' },
    { heading: 'Platform terms and governing law', body: 'This agreement is in addition to the InfluenceHub Platform, Business and Creator Terms. Payments are made through InfluenceHub. This agreement is governed by the laws of the United Arab Emirates as applied in the Emirate of Dubai.' },
  ],
  ar: [
    { heading: 'الأطراف والغرض', body: 'هذه الاتفاقية مبرمة بين الشركة وصانع المحتوى المذكورين أعلاه، اللذين تعارفا عبر InfluenceHub. وتحدد الخدمات التي سيقدمها صانع المحتوى والشروط التي يتفق عليها الطرفان.' },
    { heading: 'نطاق العمل والمخرجات', body: 'سيقوم صانع المحتوى بإنتاج ونشر المحتوى التالي: [صف المخرجات والمنصات وعدد المنشورات/الستوري/مقاطع الفيديو والرسائل الرئيسية].' },
    { heading: 'الجدول الزمني', body: 'تُشارك المسودات بحلول [التاريخ]. ويُنشر المحتوى في الفترة من [التاريخ] إلى [التاريخ]. ويرد كل طرف على الآخر خلال 5 أيام عمل.' },
    { heading: 'الموافقات والتعديلات', body: 'يحق للشركة طلب ما يصل إلى [العدد] جولات من التعديلات لكل مخرج قبل النشر. ولا يُنشر المحتوى دون موافقة الشركة حيثما تكون الموافقة مطلوبة.' },
    { heading: 'الإفصاح والامتثال', body: 'يُوسم كل محتوى مموّل بوضوح على أنه إعلان. ويلتزم الطرفان بقوانين دولة الإمارات المتعلقة بالإعلان والمحتوى الإعلامي وحماية المستهلك، وبأي موافقات قطاعية مطلوبة (مثل موافقات الإعلان الصحي).' },
    { heading: 'ملكية المحتوى وحقوق الاستخدام', body: 'يحتفظ صانع المحتوى بملكية المحتوى. ويجوز للشركة استخدامه على النحو التالي: [إعادة النشر العضوي / الإعلانات المدفوعة / الموقع الإلكتروني]، للمدة المحددة في الشروط المالية.' },
    { heading: 'السرية', body: 'يحافظ كل طرف على سرية أي معلومات غير معلنة يتلقاها من الطرف الآخر، بما في ذلك المنتجات والأسعار وخطط الحملات غير المعلنة، طوال مدة هذه الاتفاقية ولمدة 12 شهراً بعد انتهائها.' },
    { heading: 'الإنهاء', body: 'يجوز لأي طرف إنهاء هذه الاتفاقية بإشعار كتابي إذا أخل الطرف الآخر بها إخلالاً جوهرياً ولم يعالج الإخلال خلال 7 أيام. ويظل مستحقاً دفع مقابل العمل المُسلّم على الوجه الصحيح قبل الإنهاء.' },
    { heading: 'شروط المنصة والقانون الواجب التطبيق', body: 'تُضاف هذه الاتفاقية إلى شروط المنصة وشروط الشركات وشروط صناع المحتوى في InfluenceHub. وتتم المدفوعات عبر InfluenceHub. وتخضع هذه الاتفاقية لقوانين دولة الإمارات العربية المتحدة كما تُطبَّق في إمارة دبي.' },
  ],
};

export const SIGNATURE_CONSENT: Record<'en' | 'ar', string> = {
  en: 'I have read this agreement and agree to it. I confirm that I am authorised to sign on behalf of the party I represent, and that my electronic signature is intended to have the same effect as my handwritten signature.',
  ar: 'لقد قرأت هذه الاتفاقية وأوافق عليها. وأؤكد أنني مخوّل بالتوقيع نيابة عن الطرف الذي أمثله، وأن توقيعي الإلكتروني يُقصد به أن يكون له أثر توقيعي الخطي ذاته.',
};
