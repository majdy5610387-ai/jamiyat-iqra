-- إصلاح محتمل: توسيع search_path للدالة ليشمل مخطط extensions أيضًا، حيث
-- تُثبَّت crypt()/gen_salt() عادة في مشاريع Supabase (بدل public فقط).
-- لا يغيّر منطق الدالة إطلاقًا، فقط الأماكن التي تبحث فيها عن الدوال المُستدعاة.

alter function verify_credentials(text, text, text)
  set search_path = public, extensions;
