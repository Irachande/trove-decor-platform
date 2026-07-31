import Link from "next/link";
import "../legal.css";

export const metadata = {
  title: "Termos de utilização · Trove",
  description: "Termos de utilização da plataforma Trove.",
};

export default function TermsPage() {
  return <div className="legal-page">
    <nav><Link href="/">Trove</Link><div><Link href="/legal/privacy">Privacidade</Link><Link href="/signin-with-chatgpt?return_to=%2F">Área da empresa</Link></div></nav>
    <main>
      <span className="legal-kicker">TERMOS DE UTILIZAÇÃO · 30 JULHO 2026</span>
      <h1>Uma base clara para organizar e colaborar.</h1>
      <p className="legal-notice"><strong>Versão beta.</strong> Este texto operacional ainda requer revisão jurídica antes do lançamento comercial geral em Moçambique.</p>
      <p>Ao utilizar a Trove, a empresa e os seus membros concordam em usar a plataforma de forma lícita, manter os dados de acesso protegidos e fornecer informação verdadeira sobre o negócio, o inventário e as reservas.</p>

      <h2>1. O serviço</h2>
      <p>A Trove disponibiliza ferramentas para inventário, equipa, calendário, reservas, perfil público e colaboração entre decoradores. Algumas capacidades dependem do plano activo e de integrações externas.</p>

      <h2>2. Conta, equipa e subscrição</h2>
      <p>O proprietário é responsável pela conta da empresa, pelos membros convidados e pelo pagamento da subscrição. Pode cancelar a renovação; o acesso pago mantém-se até ao fim do período já liquidado, sujeito ao estado do pagamento.</p>

      <h2>3. Inventário e reservas</h2>
      <p>A empresa mantém a responsabilidade pela exactidão das quantidades, preços, condições dos artigos, datas e dados dos clientes. A Trove ajuda a detectar conflitos, mas não substitui a verificação física do material.</p>

      <h2>4. Trove Network</h2>
      <p>Os acordos entre empresas, incluindo entrega, caução e pagamento, são celebrados directamente entre as partes. A Trove regista condições e estados, mas não movimenta dinheiro nem garante a execução do aluguer durante o beta.</p>

      <h2>5. Utilização aceitável</h2>
      <p>Não é permitido usar o serviço para fraude, conteúdo ilícito, assédio, tentativa de acesso a outra empresa, abuso automatizado ou violação de direitos de terceiros. Podemos limitar ou suspender acesso para proteger utilizadores e a plataforma.</p>

      <h2>6. Disponibilidade e beta</h2>
      <p>O produto está em validação controlada. Podem ocorrer alterações, manutenção ou indisponibilidade. Funcionalidades beta são fornecidas sem garantia de continuidade e serão melhoradas com base no uso real.</p>

      <h2>7. Conteúdo e término</h2>
      <p>A empresa conserva os direitos sobre os dados que introduz e pode exportar uma cópia integral enquanto tiver acesso. Após término, a política definitiva de retenção e eliminação será aplicada conforme a versão comercial destes termos.</p>

      <h2>8. Contacto e alterações</h2>
      <p>Questões sobre estes termos podem ser enviadas para <a href="mailto:legal@trove.co.mz">legal@trove.co.mz</a>. Alterações materiais serão comunicadas na aplicação antes de produzirem efeito.</p>
    </main>
    <footer><span>© 2026 Trove · Maputo, Moçambique</span><div><Link href="/">Produto</Link><Link href="/legal/privacy">Privacidade</Link></div></footer>
  </div>;
}
