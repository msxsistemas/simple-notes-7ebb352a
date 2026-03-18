import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/layout/AppLayout";
import Perfil from "./pages/Perfil";
import ClientesListCreate from "./pages/clientes/ClientesListCreate";
import ClientesCadastro from "./pages/clientes/ClientesCadastro";
import ClientesEditar from "./pages/clientes/ClientesEditar";
import ClientesPlanos from "./pages/clientes/ClientesPlanos";
import PlanosCadastro from "./pages/clientes/PlanosCadastro";
import PlanosEditar from "./pages/clientes/PlanosEditar";
import ClientesProdutos from "./pages/clientes/ClientesProdutos";
import ProdutosCadastro from "./pages/clientes/ProdutosCadastro";
import ClientesAplicativos from "./pages/clientes/ClientesAplicativos";
import AplicativosCadastro from "./pages/clientes/AplicativosCadastro";
import AplicativosEditar from "./pages/clientes/AplicativosEditar";
import ProdutosEditar from "./pages/clientes/ProdutosEditar";
import ClientesMetricas from "./pages/clientes/ClientesMetricas";
import ClientesIntegracoes from "./pages/clientes/ClientesIntegracoes";
import ServidoresIndex from "./pages/servidores/ServidoresIndex";
import ServidorKofficeApi from "./pages/servidores/ServidorKofficeApi";
import ServidorKofficeV2 from "./pages/servidores/ServidorKofficeV2";
import ServidorMundogf from "./pages/servidores/ServidorMundogf";
import ServidorUniplay from "./pages/servidores/ServidorUniplay";
import ServidorPlayfast from "./pages/servidores/ServidorPlayfast";
import ServidorUnitv from "./pages/servidores/ServidorUnitv";
import ServidorSigma from "./pages/servidores/ServidorSigma";

import Financeiro from "./pages/Financeiro";
import FinanceiroNovaTransacao from "./pages/financeiro/FinanceiroNovaTransacao";
import FinanceiroEditarTransacao from "./pages/financeiro/FinanceiroEditarTransacao";
import Configuracoes from "./pages/configuracoes/Configuracoes";
import MensagensCobranca from "./pages/configuracoes/MensagensCobranca";
import MensagensPadroes from "./pages/configuracoes/MensagensPadroes";
import TemplatesCobranca from "./pages/configuracoes/TemplatesCobranca";
import AtivarCobrancas from "./pages/configuracoes/AtivarCobrancas";
import Marketing from "./pages/Marketing";
import MensagensEnviadas from "./pages/MensagensEnviadas";
import Tutoriais from "./pages/Tutoriais";
import ParearWhatsapp from "./pages/whatsapp/ParearWhatsappNew";
import Checkout from "./pages/financeiro-extra/Checkout";
import PixManual from "./pages/financeiro-extra/PixManual";
import Assas from "./pages/financeiro-extra/Assas";
import MercadoPago from "./pages/financeiro-extra/MercadoPago";

import Ciabra from "./pages/financeiro-extra/Ciabra";
import V3Pay from "./pages/financeiro-extra/V3Pay";
import V3PayPJ from "./pages/financeiro-extra/V3PayPJ";
import Woovi from "./pages/financeiro-extra/Woovi";
import RotacaoGateway from "./pages/configuracoes/RotacaoGateway";
// WhatsApp pages
import GerenciarMensagens from "./pages/whatsapp/GerenciarMensagens";
import FilaMensagens from "./pages/whatsapp/FilaMensagens";
import EnviosEmMassa from "./pages/whatsapp/EnviosEmMassa";
import GerenciarCampanhas from "./pages/whatsapp/GerenciarCampanhas";

import Templates from "./pages/whatsapp/Templates";
import TemplateCadastro from "./pages/whatsapp/TemplateCadastro";
import TemplateEditar from "./pages/whatsapp/TemplateEditar";
import ConfiguracaoEnvio from "./pages/whatsapp/ConfiguracaoEnvio";
import ConfiguracoesNotificacoes from "./pages/configuracoes/ConfiguracoesNotificacoes";
import Relatorios from "./pages/Relatorios";
import Logs from "./pages/Logs";
import IndicacoesClientes from "./pages/indicacoes/IndicacoesClientes";
import IndicacoesSistema from "./pages/indicacoes/IndicacoesSistema";
import Cupom from "./pages/outros/Cupom";
import PainelAfiliados from "./pages/indicacoes/PainelAfiliados";
import AdminProtectedRoute from "./components/admin/AdminProtectedRoute";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsuarios from "./pages/admin/AdminUsuarios";
import AdminPlanos from "./pages/admin/AdminPlanos";
import AdminPlanoNovo from "./pages/admin/AdminPlanoNovo";
import AdminPlanoEditar from "./pages/admin/AdminPlanoEditar";
import AdminGateways from "./pages/admin/AdminGateways";
import AdminGatewayConfig from "./pages/admin/AdminGatewayConfig";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminConfiguracoes from "./pages/admin/AdminConfiguracoes";
import AdminTemplates from "./pages/admin/AdminTemplates";
import AdminTemplateNovo from "./pages/admin/AdminTemplateNovo";
import AdminTemplateEditar from "./pages/admin/AdminTemplateEditar";
import AdminAssinaturas from "./pages/admin/AdminAssinaturas";
import AdminServidores from "./pages/admin/AdminServidores";
import AdminIndicacoes from "./pages/admin/AdminIndicacoes";
import AdminIndicacoesConfig from "./pages/admin/AdminIndicacoesConfig";
import AdminIndicacoesRegistros from "./pages/admin/AdminIndicacoesRegistros";
import AdminIndicacoesSaques from "./pages/admin/AdminIndicacoesSaques";
import AdminIndicacoesRanking from "./pages/admin/AdminIndicacoesRanking";
import AdminIndicacoesUsuarios from "./pages/admin/AdminIndicacoesUsuarios";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminAfiliadosConfig from "./pages/admin/AdminAfiliadosConfig";


const queryClient = new QueryClient();
import Auth from "./pages/auth/Auth";
import Register from "./pages/auth/Register";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import FaturaPublica from "./pages/FaturaPublica";
import AtivarPlano from "./pages/AtivarPlano";
import PlanosDisponiveis from "./pages/PlanosDisponiveis";
import RenovarAcesso from "./pages/RenovarAcesso";
import TermosDeServico from "./pages/TermosDeServico";
import PoliticaDePrivacidade from "./pages/PoliticaDePrivacidade";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/site" element={<Auth />} />
          <Route path="/register" element={<Register />} />
          <Route path="/fatura/:id" element={<FaturaPublica />} />
          <Route path="/fatura/:id" element={<FaturaPublica />} />
          
          
          <Route path="/termos-de-servico" element={<TermosDeServico />} />
          <Route path="/politica-de-privacidade" element={<PoliticaDePrivacidade />} />
          <Route path="/planos-disponiveis" element={<PlanosDisponiveis />} />
          <Route path="/ativar-plano" element={<AtivarPlano />} />
          <Route path="/renovar-acesso" element={<RenovarAcesso />} />

          {/* Protected layout wrapper for main routes */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Index />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/financeiro/nova-transacao" element={<FinanceiroNovaTransacao />} />
            <Route path="/financeiro/editar/:id" element={<FinanceiroEditarTransacao />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/mensagens" element={<MensagensEnviadas />} />
            <Route path="/loja" element={<ParearWhatsapp />} />
            <Route path="/parear-whatsapp" element={<ParearWhatsapp />} />
            <Route path="/tutoriais" element={<Tutoriais />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/configuracoes/mensagens-cobranca" element={<MensagensCobranca />} />
            <Route path="/configuracoes/mensagens-padroes" element={<MensagensPadroes />} />
            <Route path="/configuracoes/templates-cobranca" element={<TemplatesCobranca />} />
            <Route path="/configuracoes/ativar-cobrancas" element={<AtivarCobrancas />} />
            <Route path="/clientes" element={<ClientesListCreate />} />
            <Route path="/clientes/cadastro" element={<ClientesCadastro />} />
            <Route path="/clientes/editar/:id" element={<ClientesEditar />} />
            <Route path="/planos" element={<ClientesPlanos />} />
            <Route path="/planos/cadastro" element={<PlanosCadastro />} />
            <Route path="/planos/editar/:id" element={<PlanosEditar />} />
            <Route path="/produtos" element={<ClientesProdutos />} />
            <Route path="/produtos/cadastro" element={<ProdutosCadastro />} />
            <Route path="/produtos/editar/:id" element={<ProdutosEditar />} />
            <Route path="/aplicativos" element={<ClientesAplicativos />} />
            <Route path="/aplicativos/cadastro" element={<AplicativosCadastro />} />
            <Route path="/aplicativos/editar/:id" element={<AplicativosEditar />} />
            <Route path="/metricas" element={<ClientesMetricas />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/servidores" element={<ServidoresIndex />} />
            
            <Route path="/servidores/koffice-api" element={<ServidorKofficeApi />} />
            <Route path="/servidores/koffice-v2" element={<ServidorKofficeV2 />} />
            <Route path="/servidores/mundogf" element={<ServidorMundogf />} />
            <Route path="/servidores/uniplay" element={<ServidorUniplay />} />
            <Route path="/servidores/playfast" element={<ServidorPlayfast />} />
            <Route path="/servidores/unitv" element={<ServidorUnitv />} />
            <Route path="/servidores/sigma" element={<ServidorSigma />} />

            <Route path="/gateways/checkout" element={<Checkout />} />
            <Route path="/financeiro-extra/assas" element={<Assas />} />
            <Route path="/configuracoes/asaas" element={<Assas />} />
            <Route path="/configuracoes/mercado-pago" element={<MercadoPago />} />
            
            <Route path="/configuracoes/ciabra" element={<Ciabra />} />
            <Route path="/configuracoes/v3pay" element={<V3Pay />} />
            <Route path="/configuracoes/v3pay-pj" element={<V3PayPJ />} />
            <Route path="/configuracoes/woovi" element={<Woovi />} />
            <Route path="/configuracoes/pix-manual" element={<PixManual />} />
            <Route path="/configuracoes/rotacao-gateway" element={<RotacaoGateway />} />
            {/* WhatsApp routes */}
            <Route path="/whatsapp/gerenciar-mensagens" element={<GerenciarMensagens />} />
            <Route path="/whatsapp/fila-mensagens" element={<FilaMensagens />} />
            <Route path="/whatsapp/envios-em-massa" element={<EnviosEmMassa />} />
            <Route path="/whatsapp/templates" element={<Templates />} />
            <Route path="/whatsapp/templates/cadastro" element={<TemplateCadastro />} />
            <Route path="/whatsapp/templates/editar/:id" element={<TemplateEditar />} />
            <Route path="/whatsapp/configuracao-envio" element={<ConfiguracaoEnvio />} />
            <Route path="/configurar/configuracao-envio" element={<ConfiguracaoEnvio />} />
            <Route path="/configurar/notificacoes" element={<ConfiguracoesNotificacoes />} />
            <Route path="/whatsapp/parear" element={<ParearWhatsapp />} />
            {/* Logs */}
            <Route path="/logs" element={<Logs />} />
            {/* Indicações routes */}
            <Route path="/indicacoes/clientes" element={<IndicacoesClientes />} />
            <Route path="/indicacoes/sistema" element={<IndicacoesSistema />} />
            <Route path="/indicacoes/afiliados" element={<PainelAfiliados />} />
            <Route path="/afiliados" element={<PainelAfiliados />} />
            {/* Outros routes */}
            <Route path="/outros/cupom" element={<Cupom />} />
          </Route>

          {/* Admin routes */}
          <Route path="/role/admin/login" element={<AdminLogin />} />
          <Route element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}>
            <Route path="/role/admin" element={<Navigate to="/role/admin/dashboard" replace />} />
            <Route path="/role/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/role/admin/usuarios" element={<AdminUsuarios />} />
            <Route path="/role/admin/planos" element={<AdminPlanos />} />
            <Route path="/role/admin/planos/novo" element={<AdminPlanoNovo />} />
            <Route path="/role/admin/planos/editar/:id" element={<AdminPlanoEditar />} />
            <Route path="/role/admin/assinaturas" element={<AdminAssinaturas />} />
            <Route path="/role/admin/gateways" element={<AdminGateways />} />
            
            <Route path="/role/admin/gateways/:provider" element={<AdminGatewayConfig />} />
            <Route path="/role/admin/templates" element={<AdminTemplates />} />
            <Route path="/role/admin/templates/novo" element={<AdminTemplateNovo />} />
            <Route path="/role/admin/templates/editar/:id" element={<AdminTemplateEditar />} />
            <Route path="/role/admin/servidores" element={<AdminServidores />} />
            <Route path="/role/admin/indicacoes" element={<AdminIndicacoesConfig />} />
            <Route path="/role/admin/indicacoes/usuarios" element={<AdminIndicacoesUsuarios />} />
            <Route path="/role/admin/indicacoes/registros" element={<AdminIndicacoesRegistros />} />
            <Route path="/role/admin/indicacoes/saques" element={<AdminIndicacoesSaques />} />
            <Route path="/role/admin/indicacoes/ranking" element={<AdminIndicacoesRanking />} />
            <Route path="/role/admin/configuracoes" element={<AdminConfiguracoes />} />
            <Route path="/role/admin/afiliados" element={<AdminAfiliadosConfig />} />
            <Route path="/role/admin/logs" element={<AdminLogs />} />
          </Route>

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);


export default App;
