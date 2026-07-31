import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPublicProfile, publicAvatarUrl } from "../../public-profile";
import EnquiryForm from "./EnquiryForm";
import "./public-profile.css";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ lang?: string }>;
};

function safeWebsite(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const profile = await loadPublicProfile(handle);
  if (!profile) return { title: "Perfil não encontrado · Trove" };
  return {
    title: `${profile.businessName} · Trove`,
    description: profile.bio || `Conheça ${profile.businessName} e envie um pedido.`,
  };
}

export default async function PublicDecoratorProfile({ params, searchParams }: PageProps) {
  const { handle } = await params;
  const language = (await searchParams).lang === "en" ? "en" : "pt";
  const t = (pt: string, en: string) => language === "pt" ? pt : en;
  const profile = await loadPublicProfile(handle);
  if (!profile) notFound();
  const avatar = publicAvatarUrl(profile);
  const services = profile.services.split(",").map((value) => value.trim()).filter(Boolean);
  const website = safeWebsite(profile.website);

  return <main className="public-profile-page" style={{ "--profile-brand": profile.color } as React.CSSProperties}>
    <nav><Link href="/" className="public-brand"><span>T</span>Trove</Link><div><Link href={`/p/${profile.handle}?lang=${language === "pt" ? "en" : "pt"}`}>{language === "pt" ? "EN" : "PT"}</Link><Link href="/legal/privacy">{t("Privacidade", "Privacy")}</Link><Link href="/signin-with-chatgpt?return_to=%2F">{t("Área da empresa", "Business area")}</Link></div></nav>
    <header className="public-hero">
      <div className="public-hero-pattern"><i /><i /></div>
      <div className="public-identity">
        <div className="public-photo" style={{ background: profile.color }}>{avatar ? <img src={avatar} alt={`Fotografia de ${profile.businessName}`} /> : profile.businessName.split(" ").map((word) => word[0]).join("").slice(0, 2)}</div>
        <div><span>{t("EMPRESA DE DECORAÇÃO", "DECORATION BUSINESS")} · {profile.plan.toUpperCase()}</span><h1>{profile.businessName}</h1><p>{profile.bio || t("Decoração e aluguer de material para momentos especiais.", "Styling and décor rentals for special moments.")}</p><small>⌖ {profile.location || t("Moçambique", "Mozambique")}</small></div>
      </div>
    </header>
    <section className="public-profile-body">
      <div className="public-profile-main">
        <section><span className="public-kicker">{t("SOBRE", "ABOUT")}</span><h2>{t("Uma colecção preparada para o seu evento.", "A collection prepared for your event.")}</h2><p>{profile.bio || t(`${profile.businessName} organiza material de decoração e reservas através da Trove.`, `${profile.businessName} organises décor inventory and bookings with Trove.`)}</p></section>
        {services.length > 0 && <section><span className="public-kicker">{t("SERVIÇOS", "SERVICES")}</span><div className="public-services">{services.map((service) => <span key={service}>{service}</span>)}</div></section>}
        <section className="public-contact-card"><span className="public-kicker">{t("CONTACTOS", "CONTACT")}</span><div>{profile.phone && <a href={`tel:${profile.phone}`}>{profile.phone}</a>}{profile.email && <a href={`mailto:${profile.email}`}>{profile.email}</a>}{website && <a href={website} target="_blank" rel="noreferrer">{website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>}{profile.instagram && <a href={`https://instagram.com/${profile.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer">@{profile.instagram.replace(/^@/, "")}</a>}</div></section>
        <div className="public-profile-stats"><span><strong>{profile.itemCount}</strong><small>{t("peças em inventário", "inventory pieces")}</small></span><span><strong>{profile.ratingCount ? profile.rating : "—"}</strong><small>{t("avaliação Network", "Network rating")}</small></span><span><strong>{profile.ratingCount}</strong><small>{t("avaliações verificadas", "verified reviews")}</small></span></div>
      </div>
      <aside><span className="public-kicker">{t("PEDIR ORÇAMENTO", "REQUEST A QUOTE")}</span><h2>{t("Conte-nos sobre o seu evento.", "Tell us about your event.")}</h2><p>{t("Envie os detalhes principais. A empresa responderá directamente para combinar disponibilidade, materiais e valores.", "Send the key details. The business will reply directly to discuss availability, materials, and pricing.")}</p><EnquiryForm handle={profile.handle} color={profile.color} acceptsEnquiries={Boolean(profile.acceptsEnquiries)} language={language} /></aside>
    </section>
    <footer><span>{t("Trove · Inventário e reservas para decoradores", "Trove · Inventory and bookings for decorators")}</span><div><Link href="/legal/terms">{t("Termos", "Terms")}</Link><Link href="/legal/privacy">{t("Privacidade", "Privacy")}</Link></div></footer>
  </main>;
}
