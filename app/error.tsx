"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/operations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "clientError",
        source: "react-error-boundary",
        message: error.message,
        route: window.location.pathname,
      }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="brand-mark auth-mark"><i /><i /><i /></span>
        <span className="eyebrow">TROVE</span>
        <h1>Algo não correu bem.</h1>
        <p>O incidente foi registado de forma segura. Pode tentar abrir novamente o seu espaço.</p>
        <button className="button-primary auth-button" onClick={reset}>
          Tentar novamente <span>→</span>
        </button>
      </section>
    </main>
  );
}
