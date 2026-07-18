import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// عميل معزول ومؤقت (بدون حفظ جلسة) يُستخدم فقط لإنشاء حساب Auth جديد
// (ولي أمر عند إضافة طالب، أو محفظ عند إضافته من المدير) دون التأثير على
// جلسة تسجيل الدخول الحالية للمستخدم الذي يقوم بإنشاء الحساب.
export function createIsolatedSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
