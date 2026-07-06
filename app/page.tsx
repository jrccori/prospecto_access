'use client'

import { useState } from 'react'
import { FormularioAcceso } from '@/components/formulario-acceso'
import { VisorPDFSeguro } from '@/components/visor-pdf-seguro'

export default function Page() {
  // La URL firmada vive SOLO en memoria (estado del componente).
  // Nunca se guarda en localStorage/sessionStorage y se descarta al salir.
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      {signedUrl ? (
        <VisorPDFSeguro
          signedUrl={signedUrl}
          onCerrar={() => {
            if (signedUrl.startsWith('blob:')) {
              URL.revokeObjectURL(signedUrl)
            }
            setSignedUrl(null)
          }}
        />
      ) : (
        <FormularioAcceso onValidado={(url) => setSignedUrl(url)} />
      )}
    </main>
  )
}
