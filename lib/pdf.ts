import * as pdfjsLib from 'pdfjs-dist'

// El worker se sirve desde un CDN con la MISMA version que el paquete
// instalado para evitar el error "API version does not match Worker version".
const PDFJS_VERSION = '4.10.38'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`
}

export { pdfjsLib }

/**
 * Endpoint de la Edge Function `validar-postulante`.
 * Se configura con la variable de entorno NEXT_PUBLIC_VALIDAR_ENDPOINT, p. ej.:
 *   https://<PROJECT_REF>.supabase.co/functions/v1/validar-postulante
 * NUNCA se exponen aqui claves de servicio: la validacion y la firma de la
 * URL ocurren dentro de la Edge Function con el service_role key.
 */
export const VALIDAR_ENDPOINT = process.env.NEXT_PUBLIC_VALIDAR_ENDPOINT ?? ''

export type ModalidadValue = 'OPRDINARIO' | 'EXTRAORDINARIO' | 'EXAMEN DE ADMISIÓN PRIMERA SELECCIÓN'

export interface ValidarResponse {
  ok: boolean
  signedUrl?: string
  expiresIn?: number
  error?: string
}
