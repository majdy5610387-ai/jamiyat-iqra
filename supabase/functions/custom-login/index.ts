import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

// SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY تُحقن تلقائيًا من Supabase لكل
// Edge Function، لا حاجة لضبطهما يدويًا.
//
// JWT_SIGNING_KEY يجب ضبطه يدويًا عبر `supabase secrets set JWT_SIGNING_KEY=...`
// وقيمته هي JSON الكامل الناتج من `supabase gen signing-key --algorithm ES256`
// (مفتاح ES256 مخصص مُسجَّل كـ standby key في Settings -> API -> JWT Signing Keys،
// منفصل تمامًا عن المفتاح الذي يستخدمه GoTrue لجلسة المدير).
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWT_SIGNING_KEY_JSON = Deno.env.get('JWT_SIGNING_KEY')!

const ROLE_EXPIRY_SECONDS: Record<string, number> = {
  teacher: 60 * 60 * 24 * 30, // 30 يومًا (متطلب العمل أوفلاين لفترات طويلة)
  parent: 60 * 60 * 24 * 7, // 7 أيام
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface JwtSigningJwk {
  kid: string
  kty: string
  crv: string
  d: string
  x: string
  y: string
  alg?: string
}

function parseSigningKeyJwk(json: string): JwtSigningJwk {
  const jwk = JSON.parse(json) as JwtSigningJwk
  if (!jwk.kid || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d) {
    throw new Error('invalid signing key format')
  }
  return jwk
}

async function importEcPrivateKey(jwk: JwtSigningJwk) {
  return crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, crv: jwk.crv, d: jwk.d, x: jwk.x, y: jwk.y },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }

  try {
    const { national_id, password, role } = await req.json()
    console.log('[custom-login] body parsed ok, role=', role, 'national_id length=', national_id?.length)

    if (
      typeof national_id !== 'string' ||
      !national_id.trim() ||
      typeof password !== 'string' ||
      !password ||
      (role !== 'teacher' && role !== 'parent')
    ) {
      return jsonResponse({ error: 'بيانات ناقصة' }, 400)
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !JWT_SIGNING_KEY_JSON) {
      console.error('[custom-login] missing required env vars', {
        hasUrl: !!SUPABASE_URL,
        hasServiceRole: !!SERVICE_ROLE_KEY,
        hasSigningKey: !!JWT_SIGNING_KEY_JSON,
      })
      return jsonResponse({ error: 'حدث خطأ غير متوقع' }, 500)
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data, error } = await supabaseAdmin
      .rpc('verify_credentials', {
        p_national_id: national_id.trim(),
        p_password: password,
        p_role: role,
      })
      .single()

    console.log('[custom-login] rpc result:', { error, is_valid: data?.is_valid })

    if (error || !data || !data.is_valid) {
      return jsonResponse({ error: data?.message ?? 'بيانات الدخول غير صحيحة' }, 401)
    }

    const expirySeconds = ROLE_EXPIRY_SECONDS[role]

    let jwk: JwtSigningJwk
    try {
      jwk = parseSigningKeyJwk(JWT_SIGNING_KEY_JSON)
      console.log('[custom-login] jwk parsed ok, kid=', jwk.kid, 'kty=', jwk.kty, 'crv=', jwk.crv)
    } catch (parseErr) {
      console.error('[custom-login] failed to parse JWT_SIGNING_KEY:', String(parseErr))
      return jsonResponse({ error: 'حدث خطأ غير متوقع' }, 500)
    }

    let privateKey: CryptoKey
    try {
      privateKey = await importEcPrivateKey(jwk)
      console.log('[custom-login] private key imported ok')
    } catch (importErr) {
      console.error('[custom-login] failed to import EC private key:', String(importErr))
      return jsonResponse({ error: 'حدث خطأ غير متوقع' }, 500)
    }

    const jwt = await create(
      { alg: 'ES256', typ: 'JWT', kid: jwk.kid },
      {
        sub: data.user_id,
        role: 'authenticated',
        app_role: role,
        exp: getNumericDate(expirySeconds),
      },
      privateKey,
    )
    console.log('[custom-login] jwt created ok, length=', jwt.length)

    return jsonResponse(
      {
        access_token: jwt,
        app_role: role,
        expires_at: Math.floor(Date.now() / 1000) + expirySeconds,
      },
      200,
    )
  } catch (err) {
    // نسجّل تفاصيل الخطأ الفعلي للتشخيص (لا تحتوي كلمة المرور أو المفتاح الخاص)
    // بدون إرجاعها للعميل — الاستجابة للمستخدم تبقى رسالة عامة دائمًا.
    console.error('[custom-login] unexpected error:', err instanceof Error ? err.stack ?? err.message : String(err))
    return jsonResponse({ error: 'حدث خطأ غير متوقع' }, 500)
  }
})
