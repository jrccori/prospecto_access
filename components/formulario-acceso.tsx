'use client'

import { useState } from 'react'
import { ShieldCheck, LoaderCircle, TriangleAlert, FileLock2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  VALIDAR_ENDPOINT,
  type ModalidadValue,
  type ValidarResponse,
} from '@/lib/pdf'

interface FormularioAccesoProps {
  onValidado: (signedUrl: string) => void
}

const MODALIDADES: ModalidadValue[] = ['EXTRAORDINARIO', 'ORDINARIA']

export function FormularioAcceso({ onValidado }: FormularioAccesoProps) {
  const [codigo, setCodigo] = useState('')
  const [modalidad, setModalidad] = useState<ModalidadValue | ''>('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const codigoLimpio = codigo.trim()
    if (!codigoLimpio || !modalidad) {
      setError('Ingresa tu código de postulante y selecciona la modalidad.')
      return
    }

    if (!VALIDAR_ENDPOINT) {
      setError(
        'El sistema aún no está configurado. Falta definir NEXT_PUBLIC_VALIDAR_ENDPOINT con la URL de la Edge Function.',
      )
      return
    }

    setCargando(true)
    try {
      const res = await fetch(VALIDAR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_postulante: codigoLimpio,
          modalidad,
        }),
      })

      if (!res.ok) {
        // Intentamos extraer el mensaje de error si hay uno
        const errorData = await res.json().catch(() => ({}))
        // Mensaje genérico para no revelar si falló el código o la modalidad
        setError(errorData.error || 'Código o modalidad incorrectos.')
        return
      }

      // La respuesta ahora es el archivo PDF en sí
      const blob = await res.blob()

      // Creamos una URL local temporal (blob:) que el inspector de red no mostrará como petición externa
      const localUrl = URL.createObjectURL(blob)
      onValidado(localUrl)
    } catch {
      setError('No se pudo conectar con el servidor. Inténtalo nuevamente.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <img
          src="/logo_unajma.png"
          alt="Logo UNAJMA"
          className="mb-4 h-20 w-auto object-contain drop-shadow-sm"
        />
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
          Prospecto de admisión UNAJMA
        </h1>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
          Ingresa tu código de postulante y tu modalidad para consultar tu
          ficha en modo de solo lectura.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        noValidate
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="codigo"
                className="text-sm font-medium text-foreground"
              >
                Código de postulante
              </label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    aria-label="Más información sobre el código de postulante"
                    className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <Info className="size-4" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Es el código que se encuentra en tu ficha de inscripción, entregada al momento de tu inscripción.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <input
              id="codigo"
              name="codigo"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              disabled={cargando}
              className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="modalidad"
              className="text-sm font-medium text-foreground"
            >
              Modalidad
            </label>
            <select
              id="modalidad"
              name="modalidad"
              value={modalidad}
              onChange={(e) =>
                setModalidad(e.target.value as ModalidadValue | '')
              }
              disabled={cargando}
              className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-60"
            >
              <option value="" disabled>
                Selecciona una modalidad
              </option>
              {MODALIDADES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={cargando}
            className="h-11 w-full text-sm"
          >
            {cargando ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Validando…
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" aria-hidden="true" />
                Acceder
              </>
            )}
          </Button>
        </div>
      </form>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        Acceso protegido.
      </p>

      <div className="mt-8 flex flex-col items-center gap-1 text-center text-sm font-medium text-muted-foreground/80">
        <a
          href="https://admision.unajma.edu.pe"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary transition-colors"
        >
          admision.unajma.edu.pe
        </a>
        <a
          href="mailto:admision@unajma.edu.pe"
          className="hover:text-primary transition-colors"
        >
          admision@unajma.edu.pe
        </a>
      </div>
    </div>
  )
}
