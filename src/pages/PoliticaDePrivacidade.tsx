import LegalPageLayout from "@/components/legal/LegalPageLayout";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-foreground border-l-4 border-primary pl-4">{title}</h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

export default function PoliticaDePrivacidade() {
  return (
    <LegalPageLayout title="Política de Privacidade" date="17/02/2026">
      <Section title="1. Introdução">
        <p>
          A <strong className="text-foreground">Gestor MSX</strong> respeita sua privacidade e está comprometida em proteger seus dados pessoais. Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos suas informações quando você utiliza nossa plataforma.
        </p>
        <p>
          Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) e outras legislações aplicáveis.
        </p>
      </Section>

      <Section title="2. Dados que Coletamos">
        <p>Coletamos os seguintes tipos de dados pessoais:</p>
        <h3 className="text-base font-medium text-foreground mt-2">2.1 Dados fornecidos pelo usuário</h3>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-foreground">Dados cadastrais:</strong> nome completo, e-mail, telefone, nome da empresa;</li>
          <li><strong className="text-foreground">Dados de autenticação:</strong> e-mail e senha (armazenada de forma criptografada);</li>
          <li><strong className="text-foreground">Dados de perfil:</strong> foto de avatar, chave PIX para indicações;</li>
          <li><strong className="text-foreground">Dados financeiros:</strong> chaves de API de gateways de pagamento (armazenadas de forma criptografada), informações de transações;</li>
          <li><strong className="text-foreground">Dados de clientes:</strong> informações cadastradas pelo usuário sobre seus próprios clientes.</li>
        </ul>
        <h3 className="text-base font-medium text-foreground mt-2">2.2 Dados coletados automaticamente</h3>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-foreground">Dados de uso:</strong> páginas acessadas, funcionalidades utilizadas, horários de acesso;</li>
          <li><strong className="text-foreground">Dados do dispositivo:</strong> tipo de navegador, sistema operacional, endereço IP;</li>
          <li><strong className="text-foreground">Logs do sistema:</strong> registros de ações realizadas na Plataforma para fins de auditoria e segurança.</li>
        </ul>
      </Section>

      <Section title="3. Finalidade do Tratamento">
        <p>Utilizamos seus dados pessoais para as seguintes finalidades:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Criação e gerenciamento da sua conta na Plataforma;</li>
          <li>Prestação dos serviços contratados, incluindo gestão de clientes, cobranças e envio de mensagens;</li>
          <li>Processamento de pagamentos e gestão de assinaturas;</li>
          <li>Envio de notificações relacionadas ao serviço;</li>
          <li>Integração com serviços de terceiros (gateways de pagamento, WhatsApp, painéis de servidores);</li>
          <li>Geração de relatórios e métricas para o usuário;</li>
          <li>Melhoria contínua da Plataforma;</li>
          <li>Cumprimento de obrigações legais e regulatórias;</li>
          <li>Prevenção de fraudes e atividades ilícitas;</li>
          <li>Suporte ao cliente.</li>
        </ul>
      </Section>

      <Section title="4. Base Legal para o Tratamento">
        <p>O tratamento dos dados pessoais é realizado com base nas seguintes hipóteses legais da LGPD:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-foreground">Execução de contrato:</strong> para prestação dos serviços contratados;</li>
          <li><strong className="text-foreground">Consentimento:</strong> para finalidades opcionais, como comunicações de marketing;</li>
          <li><strong className="text-foreground">Legítimo interesse:</strong> para melhoria da Plataforma e prevenção de fraudes;</li>
          <li><strong className="text-foreground">Cumprimento de obrigação legal:</strong> para atender exigências legais e regulatórias.</li>
        </ul>
      </Section>

      <Section title="5. Compartilhamento de Dados">
        <p>Seus dados pessoais poderão ser compartilhados com:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-foreground">Gateways de pagamento:</strong> Asaas, Mercado Pago, Ciabra e V3Pay;</li>
          <li><strong className="text-foreground">Serviços de comunicação:</strong> APIs de WhatsApp (EVO API);</li>
          <li><strong className="text-foreground">Painéis de servidores:</strong> Sigma, Koffice, MundoGF, Uniplay e Playfast;</li>
          <li><strong className="text-foreground">Supabase:</strong> nosso provedor de infraestrutura e banco de dados;</li>
          <li><strong className="text-foreground">Autoridades competentes:</strong> quando exigido por lei ou ordem judicial.</li>
        </ul>
        <p>Não vendemos, alugamos ou comercializamos seus dados pessoais com terceiros para fins de marketing.</p>
      </Section>

      <Section title="6. Armazenamento e Segurança">
        <p>
          Seus dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL) e em repouso. Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Criptografia de senhas e chaves de API;</li>
          <li>Controle de acesso baseado em funções (RLS);</li>
          <li>Isolamento de dados por usuário;</li>
          <li>Monitoramento e logs de atividades;</li>
          <li>Backups regulares.</li>
        </ul>
        <p>
          Em caso de incidente de segurança, notificaremos os titulares afetados e a ANPD conforme exigido pela LGPD.
        </p>
      </Section>

      <Section title="7. Retenção de Dados">
        <p>Após o encerramento da conta:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Dados da conta e clientes são mantidos por 30 dias para possível recuperação;</li>
          <li>Dados financeiros e fiscais são mantidos pelo prazo legal de 5 anos;</li>
          <li>Logs de sistema são mantidos por 6 meses;</li>
          <li>Após os prazos aplicáveis, os dados são permanentemente excluídos ou anonimizados.</li>
        </ul>
      </Section>

      <Section title="8. Direitos do Titular">
        <p>Em conformidade com a LGPD, você tem direito a:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-foreground">Confirmação e acesso:</strong> saber se tratamos seus dados e acessar as informações;</li>
          <li><strong className="text-foreground">Correção:</strong> solicitar a atualização de dados incompletos ou desatualizados;</li>
          <li><strong className="text-foreground">Anonimização ou eliminação:</strong> solicitar a exclusão de dados desnecessários;</li>
          <li><strong className="text-foreground">Portabilidade:</strong> solicitar a transferência dos seus dados;</li>
          <li><strong className="text-foreground">Revogação do consentimento:</strong> retirar o consentimento a qualquer momento;</li>
          <li><strong className="text-foreground">Oposição:</strong> opor-se ao tratamento baseado em legítimo interesse.</li>
        </ul>
        <p>Para exercer seus direitos, entre em contato através dos canais de suporte. Responderemos em até 15 dias úteis.</p>
      </Section>

      <Section title="9. Dados de Clientes do Usuário">
        <p>
          O usuário da Plataforma é o controlador dos dados pessoais de seus próprios clientes. O Gestor MSX atua como operador desses dados. É responsabilidade do usuário:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Obter o consentimento necessário de seus clientes;</li>
          <li>Garantir a legalidade do envio de mensagens via WhatsApp;</li>
          <li>Manter os dados de seus clientes atualizados;</li>
          <li>Atender às solicitações de direitos dos titulares.</li>
        </ul>
      </Section>

      <Section title="10. Cookies e Tecnologias">
        <p>
          A Plataforma utiliza cookies para manter sua sessão ativa e lembrar preferências. Não utilizamos cookies de rastreamento para fins publicitários de terceiros.
        </p>
      </Section>

      <Section title="11. Transferência Internacional de Dados">
        <p>
          Seus dados podem ser armazenados em servidores fora do Brasil, em países com nível adequado de proteção ou mediante salvaguardas apropriadas conforme a LGPD.
        </p>
      </Section>

      <Section title="12. Menores de Idade">
        <p>
          A Plataforma não é destinada a menores de 18 anos. Não coletamos intencionalmente dados de menores.
        </p>
      </Section>

      <Section title="13. Alterações nesta Política">
        <p>
          Esta Política poderá ser atualizada periodicamente. As alterações serão comunicadas através da Plataforma e/ou por e-mail.
        </p>
      </Section>

      <Section title="14. Contato e DPO">
        <p>
          Para dúvidas ou solicitações relacionadas a esta Política, entre em contato através dos canais de suporte disponíveis na Plataforma. Você também pode apresentar reclamações à ANPD.
        </p>
      </Section>
    </LegalPageLayout>
  );
}
