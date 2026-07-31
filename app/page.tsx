import type { Metadata } from "next";
import DecorApp from "./DecorApp";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";

export const metadata: Metadata = {
  title: "Trove — Inventory for decorators",
  description:
    "Manage décor inventory, reservations, teams, and trusted local rentals in one beautiful workspace.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <span className="brand-mark auth-mark"><i /><i /><i /></span>
          <span className="eyebrow">TROVE WORKSPACE</span>
          <h1>O seu inventário, protegido.</h1>
          <p>
            Entre para gerir a sua empresa, reservas e equipa num espaço
            separado e seguro.
          </p>
          <a className="button-primary auth-button" href={chatGPTSignInPath("/")}>
            Entrar com ChatGPT <span>→</span>
          </a>
          <small>
            A Trove usa a identidade da sua conta apenas para controlar o
            acesso ao espaço da empresa.
          </small>
        </section>
      </main>
    );
  }

  return <DecorApp initialUser={user} />;
}
