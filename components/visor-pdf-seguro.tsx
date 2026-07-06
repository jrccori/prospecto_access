'use client'

/*
 * =============================================================================
 *  VisorPDFSeguro
 * =============================================================================
 *  AVISO DE SEGURIDAD (leer con atención):
 *
 *  Ninguna solución 100% del lado del cliente puede impedir capturas de
 *  pantalla ni la grabación de pantalla: eso es una limitación del sistema
 *  operativo, NO del navegador. Las medidas aquí implementadas —renderizado a
 *  <canvas> (sin texto en el DOM), bloqueo de atajos de teclado, clic derecho,
 *  selección de texto, y una URL firmada de corta duración generada del lado
 *  del servidor— son las prácticas estándar de la industria (similares a las de
 *  plataformas de e-learning y exámenes en línea).
 *
 *  Deben comunicarse como "DISUASIÓN + TRAZABILIDAD", nunca como
 *  "imposible de vulnerar". El bloqueo de F12 / Ctrl+U / Ctrl+P disuade pero no
 *  garantiza nada: un usuario técnico puede sortearlo. La defensa REAL es que
 *  la URL firmada expira en segundos y que el archivo nunca queda expuesto en
 *  un atributo src del DOM ni en localStorage/sessionStorage.
 * =============================================================================
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LoaderCircle,
  Lock,
  LogOut,
  TriangleAlert,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pdfjsLib } from '@/lib/pdf'

interface VisorPDFSeguroProps {
  signedUrl: string
  onCerrar: () => void
}

// Minutos de inactividad antes de cerrar el visor automáticamente.
const TIMEOUT_INACTIVIDAD_MIN = 5

export function VisorPDFSeguro({ signedUrl, onCerrar }: VisorPDFSeguroProps) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const paginasRef = useRef<HTMLDivElement>(null)
  const inactividadRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renderIdRef = useRef(0)

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [numPaginas, setNumPaginas] = useState(0)
  const [escala, setEscala] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 0.8 : 1.2
  })

  // --- Bloqueo de clic derecho / atajos de teclado (DISUASIÓN, no infalible) ---
  useEffect(() => {
    const bloquearContextMenu = (e: MouseEvent) => e.preventDefault()

    const bloquearAtajos = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const ctrlOrMeta = e.ctrlKey || e.metaKey

      // Ctrl+P (imprimir), Ctrl+S (guardar), Ctrl+U (ver fuente),
      // Ctrl+Shift+I / Ctrl+Shift+C / Ctrl+Shift+J (devtools), F12 (devtools)
      if (
        (ctrlOrMeta && ['p', 's', 'u'].includes(k)) ||
        (ctrlOrMeta && e.shiftKey && ['i', 'c', 'j'].includes(k)) ||
        e.key === 'F12'
      ) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('contextmenu', bloquearContextMenu)
    document.addEventListener('keydown', bloquearAtajos, { capture: true })

    return () => {
      document.removeEventListener('contextmenu', bloquearContextMenu)
      document.removeEventListener('keydown', bloquearAtajos, {
        capture: true,
      })
    }
  }, [])

  // --- Cierre automático por inactividad (limita el tiempo de exposición) ---
  useEffect(() => {
    const reiniciar = () => {
      if (inactividadRef.current) clearTimeout(inactividadRef.current)
      inactividadRef.current = setTimeout(
        () => onCerrar(),
        TIMEOUT_INACTIVIDAD_MIN * 60 * 1000,
      )
    }

    const eventos = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    eventos.forEach((ev) =>
      window.addEventListener(ev, reiniciar, { passive: true }),
    )
    reiniciar()

    return () => {
      if (inactividadRef.current) clearTimeout(inactividadRef.current)
      eventos.forEach((ev) => window.removeEventListener(ev, reiniciar))
    }
  }, [onCerrar])

  // --- Carga y renderizado del PDF a <canvas> ---
  const renderizar = useCallback(async () => {
    if (!signedUrl || !paginasRef.current) return

    const currentRenderId = ++renderIdRef.current

    setCargando(true)
    setError(null)

    let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> | null =
      null

    try {
      // Descargamos el PDF con fetch usando la URL firmada y lo pasamos a
      // pdf.js como ArrayBuffer. Tras esto NO volvemos a exponer la URL en
      // ningún atributo src del DOM: la URL sólo vive en memoria (props).
      const resp = await fetch(signedUrl)
      if (currentRenderId !== renderIdRef.current) return
      if (!resp.ok) throw new Error('No se pudo descargar el documento.')
      const buffer = await resp.arrayBuffer()

      pdf = await pdfjsLib.getDocument({ data: buffer }).promise
      if (currentRenderId !== renderIdRef.current) return
      setNumPaginas(pdf.numPages)

      const contenedor = paginasRef.current
      contenedor.innerHTML = ''

      for (let n = 1; n <= pdf.numPages; n++) {
        if (currentRenderId !== renderIdRef.current) break
        const page = await pdf.getPage(n)
        const viewport = page.getViewport({ scale: escala })

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)

        // Asignar el ancho máximo del PDF, pero permitir que baje si la pantalla es más pequeña
        canvas.style.maxWidth = `${Math.floor(viewport.width)}px`
        canvas.style.width = '100%'
        canvas.style.height = 'auto' // Esto evita la distorsión

        canvas.className =
          'mx-auto mb-4 block rounded-md bg-white shadow-md'
        ctx.scale(dpr, dpr)

        contenedor.appendChild(canvas)

        await page.render({ canvasContext: ctx, viewport }).promise
      }
    } catch {
      if (currentRenderId === renderIdRef.current) {
        setError(
          'No se pudo cargar el documento. Es posible que el enlace seguro haya expirado. Vuelve a ingresar tus datos.',
        )
      }
    } finally {
      if (pdf) pdf.destroy()
      if (currentRenderId === renderIdRef.current) {
        setCargando(false)
      }
    }
  }, [signedUrl, escala])

  useEffect(() => {
    renderizar()
  }, [renderizar])

  return (
    <div
      ref={contenedorRef}
      className="fixed inset-0 z-50 flex select-none flex-col bg-foreground/95"
      // Bloqueo redundante de clic derecho a nivel de contenedor.
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Barra superior */}
      <header className="flex items-center justify-between gap-3 border-b border-border/20 bg-card px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Lock className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              Tu prospecto de admision UNAJMA 2026
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Modo solo lectura · Documento protegido
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setEscala((s) => Math.max(0.6, +(s - 0.2).toFixed(2)))}
            disabled={cargando || escala <= 0.6}
            aria-label="Reducir zoom"
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(escala * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setEscala((s) => Math.min(3, +(s + 0.2).toFixed(2)))}
            disabled={cargando || escala >= 3}
            aria-label="Aumentar zoom"
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            variant="destructive"
            size="lg"
            onClick={onCerrar}
            className="ml-2 h-8"
          >
            <LogOut className="size-4" />
            Salir
          </Button>
        </div>
      </header>

      {/* Área del documento */}
      <div className="relative flex-1 overflow-auto p-4">
        {cargando && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-primary-foreground">
            <LoaderCircle className="size-8 animate-spin" aria-hidden="true" />
            <p className="text-sm text-background/80">Cargando documento…</p>
          </div>
        )}

        {error && (
          <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
            <TriangleAlert className="size-8 text-destructive" aria-hidden="true" />
            <p className="text-sm text-foreground">{error}</p>
            <Button variant="default" size="lg" onClick={onCerrar} className="h-10">
              Volver al inicio
            </Button>
          </div>
        )}

        <div
          ref={paginasRef}
          aria-label="Páginas del documento"
          className="mx-auto w-fit"
        />

        {!cargando && !error && numPaginas > 0 && (
          <p className="pb-4 pt-2 text-center text-xs text-background/70">
            {numPaginas} página{numPaginas > 1 ? 's' : ''} · Prospecto de admisión UNAJMA 2026
          </p>
        )}
      </div>
    </div>
  )
}
