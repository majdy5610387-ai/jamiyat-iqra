import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// العميل الافتراضي (supabase/client.ts) يرسل تلقائيًا فقط جلسة Supabase Auth
// (خاصة بالمدير) عبر supabase.auth. جلسة المحفظ/ولي الأمر مخصّصة (JWT موقّع
// من custom-login) ولا تمر عبر supabase.auth إطلاقًا، فلا تُرفق تلقائيًا لأي
// طلب. هذا العميل يُرفق التوكن المخصص يدويًا كـ Authorization Bearer، حتى
// تعمل سياسات RLS المعتمدة على auth.uid() بشكل صحيح لجلساتهم أيضًا.
// كاش بسيط حسب قيمة التوكن — يمنع إنشاء عميل (وGoTrueClient داخلي) جديد
// عند كل استدعاء متكرر بنفس الجلسة (كان يُنشئ نسخة جديدة في كل مزامنة/سحب،
// مسببًا تحذير "Multiple GoTrueClient instances" المتكرر بالـ Console).
// النوع مُعمَّم بالكامل (any) عمدًا: استدعاء createClient() هنا بخيارات
// (auth/global.headers) يُنتج توقيعًا فعليًا مختلفًا عن ما يُخمّنه
// ReturnType<typeof createClient> بلا معلومات استدعاء — تعارض توقيعات
// (overload) خاص بمكتبة supabase-js لا علاقة له بسلامة الأنواع الفعلية هنا
// (لا يوجد Database schema مُولَّد بالمشروع أصلًا، الاستخدام كله عبر أسماء
// جداول نصية عبر .from()/.rpc()).
const clientCache = new Map<string, SupabaseClient<any, any, any, any, any>>()

export function createCustomAuthClient(accessToken: string) {
  const cached = clientCache.get(accessToken)
  if (cached) return cached

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

  clientCache.set(accessToken, client)
  return client
}
