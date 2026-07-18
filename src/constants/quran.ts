export interface Surah {
  id: number
  name: string
  ayahCount: number
}

// أسماء السور الـ114 بترتيب المصحف وعدد آيات كل سورة (رواية حفص عن عاصم،
// ترقيم مجمع الملك فهد — نفس الترقيم المعتمد في quran.com وTanzil).
// تم التحقق من هذه الأرقام مقابل quran.com (api.quran.com/api/v4/chapters)
// ومن مجموعها الكلي (6236 آية)، وليست من الذاكرة.
export const SURAHS: Surah[] = [
  { id: 1, name: 'الفاتحة', ayahCount: 7 },
  { id: 2, name: 'البقرة', ayahCount: 286 },
  { id: 3, name: 'آل عمران', ayahCount: 200 },
  { id: 4, name: 'النساء', ayahCount: 176 },
  { id: 5, name: 'المائدة', ayahCount: 120 },
  { id: 6, name: 'الأنعام', ayahCount: 165 },
  { id: 7, name: 'الأعراف', ayahCount: 206 },
  { id: 8, name: 'الأنفال', ayahCount: 75 },
  { id: 9, name: 'التوبة', ayahCount: 129 },
  { id: 10, name: 'يونس', ayahCount: 109 },
  { id: 11, name: 'هود', ayahCount: 123 },
  { id: 12, name: 'يوسف', ayahCount: 111 },
  { id: 13, name: 'الرعد', ayahCount: 43 },
  { id: 14, name: 'إبراهيم', ayahCount: 52 },
  { id: 15, name: 'الحجر', ayahCount: 99 },
  { id: 16, name: 'النحل', ayahCount: 128 },
  { id: 17, name: 'الإسراء', ayahCount: 111 },
  { id: 18, name: 'الكهف', ayahCount: 110 },
  { id: 19, name: 'مريم', ayahCount: 98 },
  { id: 20, name: 'طه', ayahCount: 135 },
  { id: 21, name: 'الأنبياء', ayahCount: 112 },
  { id: 22, name: 'الحج', ayahCount: 78 },
  { id: 23, name: 'المؤمنون', ayahCount: 118 },
  { id: 24, name: 'النور', ayahCount: 64 },
  { id: 25, name: 'الفرقان', ayahCount: 77 },
  { id: 26, name: 'الشعراء', ayahCount: 227 },
  { id: 27, name: 'النمل', ayahCount: 93 },
  { id: 28, name: 'القصص', ayahCount: 88 },
  { id: 29, name: 'العنكبوت', ayahCount: 69 },
  { id: 30, name: 'الروم', ayahCount: 60 },
  { id: 31, name: 'لقمان', ayahCount: 34 },
  { id: 32, name: 'السجدة', ayahCount: 30 },
  { id: 33, name: 'الأحزاب', ayahCount: 73 },
  { id: 34, name: 'سبأ', ayahCount: 54 },
  { id: 35, name: 'فاطر', ayahCount: 45 },
  { id: 36, name: 'يس', ayahCount: 83 },
  { id: 37, name: 'الصافات', ayahCount: 182 },
  { id: 38, name: 'ص', ayahCount: 88 },
  { id: 39, name: 'الزمر', ayahCount: 75 },
  { id: 40, name: 'غافر', ayahCount: 85 },
  { id: 41, name: 'فصلت', ayahCount: 54 },
  { id: 42, name: 'الشورى', ayahCount: 53 },
  { id: 43, name: 'الزخرف', ayahCount: 89 },
  { id: 44, name: 'الدخان', ayahCount: 59 },
  { id: 45, name: 'الجاثية', ayahCount: 37 },
  { id: 46, name: 'الأحقاف', ayahCount: 35 },
  { id: 47, name: 'محمد', ayahCount: 38 },
  { id: 48, name: 'الفتح', ayahCount: 29 },
  { id: 49, name: 'الحجرات', ayahCount: 18 },
  { id: 50, name: 'ق', ayahCount: 45 },
  { id: 51, name: 'الذاريات', ayahCount: 60 },
  { id: 52, name: 'الطور', ayahCount: 49 },
  { id: 53, name: 'النجم', ayahCount: 62 },
  { id: 54, name: 'القمر', ayahCount: 55 },
  { id: 55, name: 'الرحمن', ayahCount: 78 },
  { id: 56, name: 'الواقعة', ayahCount: 96 },
  { id: 57, name: 'الحديد', ayahCount: 29 },
  { id: 58, name: 'المجادلة', ayahCount: 22 },
  { id: 59, name: 'الحشر', ayahCount: 24 },
  { id: 60, name: 'الممتحنة', ayahCount: 13 },
  { id: 61, name: 'الصف', ayahCount: 14 },
  { id: 62, name: 'الجمعة', ayahCount: 11 },
  { id: 63, name: 'المنافقون', ayahCount: 11 },
  { id: 64, name: 'التغابن', ayahCount: 18 },
  { id: 65, name: 'الطلاق', ayahCount: 12 },
  { id: 66, name: 'التحريم', ayahCount: 12 },
  { id: 67, name: 'الملك', ayahCount: 30 },
  { id: 68, name: 'القلم', ayahCount: 52 },
  { id: 69, name: 'الحاقة', ayahCount: 52 },
  { id: 70, name: 'المعارج', ayahCount: 44 },
  { id: 71, name: 'نوح', ayahCount: 28 },
  { id: 72, name: 'الجن', ayahCount: 28 },
  { id: 73, name: 'المزمل', ayahCount: 20 },
  { id: 74, name: 'المدثر', ayahCount: 56 },
  { id: 75, name: 'القيامة', ayahCount: 40 },
  { id: 76, name: 'الإنسان', ayahCount: 31 },
  { id: 77, name: 'المرسلات', ayahCount: 50 },
  { id: 78, name: 'النبأ', ayahCount: 40 },
  { id: 79, name: 'النازعات', ayahCount: 46 },
  { id: 80, name: 'عبس', ayahCount: 42 },
  { id: 81, name: 'التكوير', ayahCount: 29 },
  { id: 82, name: 'الانفطار', ayahCount: 19 },
  { id: 83, name: 'المطففين', ayahCount: 36 },
  { id: 84, name: 'الانشقاق', ayahCount: 25 },
  { id: 85, name: 'البروج', ayahCount: 22 },
  { id: 86, name: 'الطارق', ayahCount: 17 },
  { id: 87, name: 'الأعلى', ayahCount: 19 },
  { id: 88, name: 'الغاشية', ayahCount: 26 },
  { id: 89, name: 'الفجر', ayahCount: 30 },
  { id: 90, name: 'البلد', ayahCount: 20 },
  { id: 91, name: 'الشمس', ayahCount: 15 },
  { id: 92, name: 'الليل', ayahCount: 21 },
  { id: 93, name: 'الضحى', ayahCount: 11 },
  { id: 94, name: 'الشرح', ayahCount: 8 },
  { id: 95, name: 'التين', ayahCount: 8 },
  { id: 96, name: 'العلق', ayahCount: 19 },
  { id: 97, name: 'القدر', ayahCount: 5 },
  { id: 98, name: 'البينة', ayahCount: 8 },
  { id: 99, name: 'الزلزلة', ayahCount: 8 },
  { id: 100, name: 'العاديات', ayahCount: 11 },
  { id: 101, name: 'القارعة', ayahCount: 11 },
  { id: 102, name: 'التكاثر', ayahCount: 8 },
  { id: 103, name: 'العصر', ayahCount: 3 },
  { id: 104, name: 'الهمزة', ayahCount: 9 },
  { id: 105, name: 'الفيل', ayahCount: 5 },
  { id: 106, name: 'قريش', ayahCount: 4 },
  { id: 107, name: 'الماعون', ayahCount: 7 },
  { id: 108, name: 'الكوثر', ayahCount: 3 },
  { id: 109, name: 'الكافرون', ayahCount: 6 },
  { id: 110, name: 'النصر', ayahCount: 3 },
  { id: 111, name: 'المسد', ayahCount: 5 },
  { id: 112, name: 'الإخلاص', ayahCount: 4 },
  { id: 113, name: 'الفلق', ayahCount: 5 },
  { id: 114, name: 'الناس', ayahCount: 6 },
]

export function getAyahCount(surahName: string): number | null {
  return SURAHS.find((s) => s.name === surahName)?.ayahCount ?? null
}

// توحيد صيغ الكتابة الشائعة قبل المقارنة: إزالة التشكيل والتطويل
// (ً-ٟ, ٰ, ـ)، وتوحيد أشكال الهمزة على الألف (أ إ آ -> ا)،
// والتاء المربوطة مقابل الهاء (ة -> ه)، والألف المقصورة مقابل الياء (ى -> ي).
// هذا يسمح بمطابقة سجلات قديمة مكتوبة بتهجئة مختلفة عن القائمة الرسمية
// (مثل "البقره" بدون همزة) بالاسم الصحيح تلقائيًا عند فتحها للتعديل.
function normalizeArabic(value: string): string {
  return value
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim()
}

export function findSurahByName(surahName: string): Surah | null {
  const normalized = normalizeArabic(surahName)
  return SURAHS.find((s) => normalizeArabic(s.name) === normalized) ?? null
}
