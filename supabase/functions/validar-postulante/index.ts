// =============================================================================
//  Edge Function: validar-postulante  (Supabase / Deno)
// =============================================================================
//  Flujo:
//   1. Recibe POST { codigo_postulante, modalidad }.
//   2. Valida (con service_role, NUNCA expuesto al cliente) que exista esa
//      combinación código+modalidad y esté activa en la tabla `postulantes`.
//   3. Si es válida, genera una signed URL de corta duración (30 s) del archivo
//      fijo `prospecto.pdf` en el bucket privado `prospecto`.
//   4. Aplica rate limiting básico por IP usando la tabla `intentos_login`.
//   5. Respuestas genéricas para no filtrar si falló el código o la modalidad
//      (evita enumeración de códigos de postulante).
//
//  Despliegue:
//   supabase functions deploy validar-postulante
//   supabase secrets set FRONTEND_ORIGIN=https://tu-dominio.com
//   (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY se inyectan automáticamente)
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'prospecto'
const ARCHIVO_PATH = 'prospecto.pdf' // Mismo archivo para todos los postulantes
const SIGNED_URL_TTL = 30 // segundos

// --- Configuración de rate limiting ---
const MAX_INTENTOS = 5 // intentos fallidos permitidos...
const VENTANA_MIN = 10 // ...dentro de esta ventana (minutos)

// --- CORS: limpieza de URL y permitir localhost en desarrollo ---
let FRONTEND_ORIGIN = Deno.env.get('FRONTEND_ORIGIN') ?? 'https://prospectounajma.netlify.app'
if (FRONTEND_ORIGIN.endsWith('/')) {
  FRONTEND_ORIGIN = FRONTEND_ORIGIN.slice(0, -1)
}

function corsHeaders(origin: string | null) {
  // Permitir la solicitud si viene del origen configurado o si es localhost
  const isAllowed = origin === FRONTEND_ORIGIN || origin?.startsWith('http://localhost')
  const permitido = isAllowed && origin ? origin : FRONTEND_ORIGIN

  return {
    'Access-Control-Allow-Origin': permitido,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (req.method !== 'POST') {
    return json({ ok: false }, 405, origin)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Identificamos la IP para el rate limiting (best-effort).
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    'desconocida'

  // --- 1. Rate limiting: contar intentos fallidos recientes de esta IP ---
  const desde = new Date(Date.now() - VENTANA_MIN * 60 * 1000).toISOString()
  const { count: fallidosRecientes } = await supabase
    .from('intentos_login')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('exito', false)
    .gte('creado_en', desde)

  if ((fallidosRecientes ?? 0) >= MAX_INTENTOS) {
    return json(
      { ok: false, error: 'Demasiados intentos. Intenta más tarde.' },
      429,
      origin,
    )
  }

  // --- 2. Parseo del cuerpo ---
  let codigo_postulante = ''
  let modalidad = ''
  try {
    const body = await req.json()
    codigo_postulante = String(body.codigo_postulante ?? '').trim()
    modalidad = String(body.modalidad ?? '').trim()
  } catch {
    return json({ ok: false }, 400, origin)
  }

  if (!codigo_postulante || !modalidad) {
    return json({ ok: false }, 400, origin)
  }

  // --- 3. Validación contra la tabla postulantes ---
  let query = supabase
    .from('postulantes')
    .select('codigo_postulante')
    .eq('codigo_postulante', codigo_postulante)

  if (modalidad === 'EXTRAORDINARIO') {
    query = query.ilike('modalidad', 'EXTRAORDINARIO%')
  } else {
    query = query.eq('modalidad', modalidad)
  }

  const { data, error } = await query.maybeSingle()

  if (error || !data) {
    // Registramos el intento fallido para el rate limiting.
    await supabase
      .from('intentos_login')
      .insert({ ip, codigo_postulante, exito: false })
    // Respuesta genérica (sin distinguir código vs. modalidad).
    return json({ ok: false, error: 'No encontrado' }, 404, origin)
  }

  // --- 4. Descargar y devolver el PDF directamente ---
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(ARCHIVO_PATH)

  if (downloadError || !fileData) {
    return json({ ok: false, error: 'Error interno al cargar archivo' }, 500, origin)
  }

  // Registramos el acceso exitoso
  await supabase
    .from('intentos_login')
    .insert({ ip, codigo_postulante, exito: true })

  // Devolvemos el archivo binario directamente (Blob) en lugar de JSON
  return new Response(fileData, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      ...corsHeaders(origin),
    },
  })
})
