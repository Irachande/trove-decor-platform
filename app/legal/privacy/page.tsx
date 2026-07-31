import Link from "next/link";
import "../legal.css";

export const metadata = {
  title: "Privacidade · Trove",
  description: "Informação sobre privacidade e tratamento de dados na Trove.",
};

export default function PrivacyPage() {
  return <div className="legal-page">
    <nav><Link href="/">Trove</Link><div><Link href="/legal/terms">Termos</Link><Link href="/signin-with-chatgpt?return_to=%2F">Área da empresa</Link></div></nav>
    <main>
      <span className="legal-kicker">PRIVACIDADE · 30 JULHO 2026</span>
      <h1>Os seus dados servem o seu negócio.</h1>
      <p className="legal-notice"><strong>Versão beta.</strong> Esta informação descreve a implementação actual, mas requer revisão jurídica e definição formal de retenção antes do lançamento comercial geral.</p>

      <h2>1. Dados tratados</h2>
      <p>Tratamos dados da conta e equipa, perfil da empresa, inventário e fotografias, clientes, eventos, reservas, actividade, pedidos recebidos no perfil público, pagamentos e feedback beta. Registos técnicos de segurança podem incluir identificadores derivados, dispositivo e erros.</p>

      <h2>2. Finalidades</h2>
      <p>Usamos os dados para autenticar utilizadores, prestar o serviço contratado, sincronizar equipas, prevenir conflitos e abuso, enviar alertas solicitados, suportar pagamentos, responder a incidentes e melhorar o produto.</p>

      <h2>3. Armazenamento e fornecedores</h2>
      <p>Os dados operacionais usam base de dados D1 e as imagens usam armazenamento R2. O alojamento é prestado por OpenAI Sites sobre infraestrutura Cloudflare. A autenticação usa Sign in with ChatGPT. Quando configurados, Resend processa emails transaccionais e PaySuite processa o fluxo de pagamento.</p>

      <h2>4. Perfis e pedidos públicos</h2>
      <p>Se a empresa activar o perfil público, os contactos seleccionados ficam visíveis e visitantes podem enviar pedidos. Limitamos abuso com um identificador criptográfico da origem; não guardamos o endereço IP em claro nesse registo.</p>

      <h2>5. Partilha e acesso</h2>
      <p>Cada empresa controla o acesso dos seus membros. Não vendemos dados pessoais. Partilhamos apenas o necessário com fornecedores que suportam o serviço, por obrigação legal ou para proteger a segurança da plataforma.</p>

      <h2>6. Retenção e segurança</h2>
      <p>Durante o beta, os dados permanecem enquanto a conta estiver activa e pelo período operacional necessário após encerramento. Aplicamos separação por empresa, permissões por função, registos de auditoria e protecção de credenciais. Nenhum sistema elimina totalmente o risco.</p>

      <h2>7. Dispositivo e cookies</h2>
      <p>A aplicação guarda preferências, a última cópia de consulta offline e dados essenciais de sessão. Não existe publicidade comportamental nem rastreamento de marketing na implementação actual.</p>

      <h2>8. Escolhas e direitos</h2>
      <p>A empresa pode editar o perfil, desligar a recepção de pedidos, revogar convites, desactivar notificações e exportar os seus dados. Pedidos de acesso, correcção ou eliminação podem ser enviados para <a href="mailto:privacy@trove.co.mz">privacy@trove.co.mz</a>.</p>
    </main>
    <footer><span>© 2026 Trove · Maputo, Moçambique</span><div><Link href="/">Produto</Link><Link href="/legal/terms">Termos</Link></div></footer>
  </div>;
}
