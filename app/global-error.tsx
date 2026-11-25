'use client'

// Último recurso: erro no próprio layout raiz. Precisa ter <html> e <body> próprios
// e não pode depender do CSS do site, por isso o estilo é inline.
export default function ErroGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#EEF5FB', color: '#1f2937' }}>
        <main
          role="alert"
          style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div style={{ maxWidth: 360, textAlign: 'center' }}>
            <h1 style={{ fontSize: 20, color: '#1A4A7C' }}>Casa de Vó Sebastiana</h1>
            <p style={{ fontSize: 15, lineHeight: 1.5 }}>
              O site está com uma instabilidade. Tente de novo em alguns instantes.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 12,
                padding: '12px 20px',
                borderRadius: 12,
                border: 0,
                background: '#1A4A7C',
                color: '#fff',
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              Tentar de novo
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
