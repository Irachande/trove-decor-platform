"use client";

import { FormEvent, useState } from "react";

export default function EnquiryForm({
  handle,
  color,
  acceptsEnquiries,
  language,
}: {
  handle: string;
  color: string;
  acceptsEnquiries: boolean;
  language: "pt" | "en";
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const t = (pt: string, en: string) => language === "pt" ? pt : en;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/public-profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        handle,
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        eventDate: form.get("eventDate"),
        message: form.get("message"),
        company: form.get("company"),
      }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(result.error || t("Não foi possível enviar. Tente novamente.", "Unable to send. Please try again."));
      setState("error");
      return;
    }
    event.currentTarget.reset();
    setState("sent");
  }

  if (!acceptsEnquiries) {
    return <p className="public-profile-note">{t("Esta empresa não está a receber novos pedidos neste momento.", "This business is not accepting new enquiries right now.")}</p>;
  }
  if (state === "sent") {
    return <div className="enquiry-success"><span>✓</span><h2>{t("Pedido enviado", "Enquiry sent")}</h2><p>{t("A empresa recebeu a sua mensagem e poderá responder directamente ao seu email.", "The business received your message and may reply directly by email.")}</p><button onClick={() => setState("idle")}>{t("Enviar outro pedido", "Send another enquiry")}</button></div>;
  }
  return <form className="public-enquiry-form" onSubmit={submit}>
    <div><label>{t("Nome", "Name")}<input name="name" minLength={2} maxLength={120} required /></label><label>Email<input name="email" type="email" maxLength={254} required /></label></div>
    <div><label>{t("Telefone", "Phone")}<input name="phone" maxLength={80} /></label><label>{t("Data do evento", "Event date")}<input name="eventDate" type="date" /></label></div>
    <label>{t("Como podemos ajudar?", "How can we help?")}<textarea name="message" rows={5} minLength={10} maxLength={1500} required /></label>
    <label className="public-honeypot" aria-hidden="true">Empresa<input name="company" tabIndex={-1} autoComplete="off" /></label>
    {state === "error" && <p className="public-form-error">{error}</p>}
    <button style={{ background: color }} disabled={state === "sending"}>{state === "sending" ? t("A enviar…", "Sending…") : t("Enviar pedido", "Send enquiry")}</button>
    <small>{t("Ao enviar, autoriza esta empresa a usar os seus contactos apenas para responder a este pedido.", "By sending, you allow this business to use your contact details only to respond to this enquiry.")}</small>
  </form>;
}
