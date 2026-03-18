import LegalPageLayout from "@/components/legal/LegalPageLayout";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-foreground border-l-4 border-primary pl-4">{title}</h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

export default function TermosDeServico() {
  return (
    <LegalPageLayout title="Termos de Serviço" date="17/02/2026">
      <Section title="1. Aceitação dos Termos">
        <p>
          Ao acessar ou utilizar a plataforma <strong className="text-foreground">Gestor MSX</strong>, você concorda em cumprir estes Termos de Serviço. Caso não concorde, você não deverá utilizar a Plataforma. O uso continuado após alterações constitui aceitação dos termos modificados.
        </p>
      </Section>

      <Section title="2. Descrição do Serviço">
        <p>
          O Gestor MSX é uma plataforma de gestão empresarial que oferece gerenciamento de clientes, planos, produtos, cobranças automatizadas, envio de mensagens via WhatsApp, integração com gateways de pagamento (Asaas, Mercado Pago, Ciabra, V3Pay, PIX Manual), integração com painéis de servidores (Sigma, Koffice, MundoGF, Uniplay, Playfast), geração de faturas, relatórios financeiros e sistema de indicações.
        </p>
      </Section>

      <Section title="3. Cadastro e Conta">
        <p>
          Para utilizar a Plataforma, é necessário criar uma conta com informações verdadeiras e atualizadas. Você é responsável pela confidencialidade de suas credenciais e por todas as atividades realizadas em sua conta.
        </p>
        <p>
          Cada conta é pessoal e intransferível. A Plataforma reserva-se o direito de suspender contas que violem esta disposição.
        </p>
      </Section>

      <Section title="4. Planos e Assinaturas">
        <p>
          A Plataforma oferece diferentes planos de assinatura, podendo incluir períodos de teste gratuito. Os planos possuem limites específicos de clientes, mensagens, sessões de WhatsApp e painéis integrados.
        </p>
        <p>
          O acesso depende da manutenção de uma assinatura ativa. O não pagamento poderá resultar na suspensão do acesso.
        </p>
      </Section>

      <Section title="5. Pagamentos e Reembolsos">
        <p>
          Os pagamentos são processados através dos gateways integrados à Plataforma. Todos os valores são cobrados em Reais (BRL).
        </p>
        <p>
          Reembolsos podem ser solicitados em até 7 dias corridos após a contratação, desde que o serviço não tenha sido utilizado substancialmente.
        </p>
      </Section>

      <Section title="6. Uso Aceitável">
        <p>Ao utilizar a Plataforma, você se compromete a:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Não utilizar o serviço para atividades ilegais ou fraudulentas;</li>
          <li>Não enviar spam ou conteúdo ofensivo via WhatsApp;</li>
          <li>Respeitar os termos das plataformas integradas;</li>
          <li>Não tentar acessar dados de outros usuários;</li>
          <li>Não realizar engenharia reversa da Plataforma;</li>
          <li>Não utilizar bots ou scrapers sem autorização;</li>
          <li>Manter seus dados cadastrais atualizados.</li>
        </ul>
      </Section>

      <Section title="7. Integrações com Terceiros">
        <p>
          A Plataforma integra com serviços de terceiros, incluindo gateways de pagamento, API do WhatsApp (EVO API) e painéis de servidores. Essas integrações estão sujeitas aos termos dos respectivos provedores. O Gestor MSX não se responsabiliza por falhas em serviços de terceiros.
        </p>
        <p>
          As credenciais de acesso para integrações são armazenadas de forma criptografada.
        </p>
      </Section>

      <Section title="8. Envio de Mensagens via WhatsApp">
        <p>
          O usuário é o único responsável pelo conteúdo das mensagens enviadas e deve cumprir as políticas do WhatsApp. O Gestor MSX não garante a entrega de mensagens e não se responsabiliza por bloqueios do número pelo WhatsApp.
        </p>
      </Section>

      <Section title="9. Propriedade Intelectual">
        <p>
          Todo o conteúdo da Plataforma, incluindo marca, logotipos, design, código-fonte e documentação, é de propriedade exclusiva do Gestor MSX e está protegido pelas leis de propriedade intelectual.
        </p>
      </Section>

      <Section title="10. Limitação de Responsabilidade">
        <p>
          A Plataforma é fornecida "como está". Não garantimos que o serviço será ininterrupto ou livre de erros. A responsabilidade total do Gestor MSX não excederá o valor pago nos últimos 3 meses.
        </p>
      </Section>

      <Section title="11. Suspensão e Encerramento">
        <p>
          Reservamo-nos o direito de suspender ou encerrar sua conta em caso de violação destes Termos. Seus dados serão mantidos por até 30 dias para possível exportação.
        </p>
      </Section>

      <Section title="12. Alterações nos Termos">
        <p>
          O Gestor MSX reserva-se o direito de modificar estes Termos a qualquer momento. As alterações serão comunicadas através da Plataforma ou por e-mail.
        </p>
      </Section>

      <Section title="13. Legislação Aplicável e Foro">
        <p>
          Estes Termos são regidos pelas leis do Brasil. Qualquer disputa será submetida ao foro da comarca do domicílio do usuário, conforme o Código de Defesa do Consumidor.
        </p>
      </Section>

      <Section title="14. Contato">
        <p>
          Para dúvidas ou reclamações, entre em contato através dos canais de suporte disponíveis na Plataforma.
        </p>
      </Section>
    </LegalPageLayout>
  );
}
