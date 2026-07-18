import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// العميل الرئيسي للتطبيق: يحتفظ بجلسة تسجيل الدخول الحالية (المدير/المحفظ/ولي الأمر).
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
