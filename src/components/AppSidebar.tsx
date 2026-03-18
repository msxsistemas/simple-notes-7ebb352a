import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Home,
  Users,
  Server,
  List,
  Package,
  DollarSign,
  ArrowLeftRight,
  Filter,
  Globe,
  MessageSquare,
  Share2,
  MoreHorizontal,
  ScrollText,
  ChevronRight,
  ChevronDown,
  Phone,
  Ticket,
  Crown,
  Settings,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { LucideProps } from "lucide-react";
import { useSystemLogo } from "@/hooks/useSystemLogo";
import iconMsx from "@/assets/icon-msx.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

// Custom WhatsApp icon
const WhatsAppIcon = (props: LucideProps) => (
  <svg
    viewBox="0 0 24 24"
    width={props.size ?? 24}
    height={props.size ?? 24}
    stroke="none"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <path d="M20.52 3.48A11.8 11.8 0 0012 0C5.37 0 0 5.37 0 12c0 2.11.55 4.17 1.6 5.98L0 24l6.2-1.62A11.94 11.94 0 0012 24c6.63 0 12-5.37 12-12 0-3.19-1.24-6.18-3.48-8.52zM12 22a9.94 9.94 0 01-5.45-1.5l-.39-.23-3.67.96.98-3.58-.25-.41A9.9 9.9 0 012 12C2 6.48 6.48 2 12 2c2.67 0 5.18 1.04 7.07 2.93A9.96 9.96 0 0122 12c0 5.52-4.48 10-10 10zm5.38-7.62c-.29-.14-1.71-.84-1.97-.93-.26-.1-.45-.14-.64.14-.19.29-.74.93-.9 1.12-.17.19-.33.2-.62.07-.29-.14-1.21-.45-2.3-1.43-.85-.76-1.43-1.7-1.6-1.98-.17-.29-.02-.45.12-.59.12-.12.29-.33.43-.5.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.14-.64-1.56-.88-2.14-.23-.55-.47-.48-.64-.48h-.55c-.17 0-.45.07-.69.36-.24.29-.9.88-.9 2.14s.93 2.48 1.06 2.65c.14.19 1.83 2.8 4.43 3.92.62.27 1.1.43 1.48.55.62.2 1.19.17 1.64.1.5-.07 1.71-.7 1.95-1.37.24-.67.24-1.24.17-1.37-.07-.12-.26-.2-.55-.33z" />
  </svg>
);

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";
  const logoUrl = useSystemLogo();
  const isMobile = useIsMobile();
  const { userId } = useCurrentUser();
  const { subscription, daysLeft } = useSubscription(userId);
  const navigate = useNavigate();
  const clientesActive = currentPath === "/clientes" || currentPath.startsWith("/clientes/");
  const planosActive = currentPath === "/planos" || currentPath.startsWith("/planos/");
  const aplicativosActive = currentPath === "/aplicativos" || currentPath.startsWith("/aplicativos/");
  const produtosActive = currentPath === "/produtos" || currentPath.startsWith("/produtos/");
  const financeiroActive = currentPath.startsWith("/financeiro");
  const whatsappActive = currentPath.startsWith("/whatsapp") || currentPath === "/parear-whatsapp";
  const configurarActive = currentPath.startsWith("/configurar");
  const logsActive = currentPath.startsWith("/logs");
  const indicacoesActive = currentPath.startsWith("/indicacoes") || currentPath.startsWith("/afiliados");
  
  // Check if affiliates panel is enabled for this user
  const [afiliadosLiberado, setAfiliadosLiberado] = useState(false);
  const [servidoresAtivos, setServidoresAtivos] = useState<{id: string; nome: string}[]>([]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("afiliados_usuarios_config")
      .select("afiliados_liberado")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setAfiliadosLiberado(!!(data as any)?.afiliados_liberado);
      });
    
    // Fetch active servers for sidebar
    supabase
      .from("system_servidores")
      .select("id, nome")
      .in("status", ["ativo", "manutencao"])
      .order("nome")
      .then(({ data }) => {
        if (data) setServidoresAtivos(data);
      });
  }, [userId]);
  const outrosActive = currentPath.startsWith("/outros") || currentPath === "/configuracoes/mensagens-padroes";
  const gatewaysActive = currentPath === "/configuracoes" || currentPath.startsWith("/configuracoes/asaas") || currentPath.startsWith("/configuracoes/mercado-pago") || currentPath.startsWith("/configuracoes/ciabra") || currentPath.startsWith("/configuracoes/pix-manual") || currentPath.startsWith("/configuracoes/v3pay") || currentPath.startsWith("/configuracoes/v3pay-pj") || currentPath.startsWith("/configuracoes/woovi") || currentPath.startsWith("/configuracoes/rotacao-gateway") || currentPath.startsWith("/gateways/");
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(
    clientesActive ? "clientes" : planosActive ? "planos" : aplicativosActive ? "aplicativos" : produtosActive ? "produtos" : currentPath.startsWith("/servidores") ? "servidores" : financeiroActive ? "financeiro" : configurarActive ? "configurar" : whatsappActive ? "whatsapp" : logsActive ? "logs" : indicacoesActive ? "indicacoes" : outrosActive ? "outros" : gatewaysActive ? "gateways" : null
  );

  const toggleSubmenu = (menu: string) => {
    setOpenSubmenu(prev => prev === menu ? null : menu);
  };

  const isActive = (path: string) => currentPath === path;

  // Estilo base dos itens - com destaque de cor quando ativo
  const menuItemClass = (active: boolean) =>
    `flex items-center justify-between w-full px-5 py-3 transition-all border-0 rounded-none ${
      active 
        ? "bg-primary/15 text-primary border-l-[3px] border-l-primary font-medium" 
        : "text-muted-foreground hover:text-muted-foreground/80"
    }`;

  // Estilo para subitens ativos
  const subItemClass = (active: boolean) =>
    `flex items-center gap-2 py-1 text-[13px] transition-colors ${
      active ? "text-primary font-medium" : "text-muted-foreground hover:text-primary"
    }`;

  const subItemDotClass = (active: boolean) =>
    `w-2 h-2 rounded-full border ${
      active 
        ? "border-primary bg-primary" 
        : "border-muted-foreground bg-transparent"
    }`;

  // Menu items
  const menuItems = [
    { to: "/dashboard", icon: Home, label: "Dashboard" },
    { to: "/clientes", icon: Users, label: "Clientes", hasSubmenu: true },
    { to: "/planos", icon: List, label: "Planos", hasPlanosSubmenu: true },
    { to: "/aplicativos", icon: Package, label: "Aplicativos", hasAplicativosSubmenu: true },
    { to: "/produtos", icon: Package, label: "Produtos", hasProdutosSubmenu: true },
    { to: "/servidores", icon: Server, label: "Servidores", hasServidoresSubmenu: true },
    { to: "/whatsapp", icon: WhatsAppIcon, label: "WhatsApp", hasWhatsappSubmenu: true },
    { to: "/financeiro", icon: DollarSign, label: "Financeiro", hasFinanceiroSubmenu: true },
    { to: "/relatorios", icon: Filter, label: "Relatórios" },
    { to: "/configuracoes", icon: Globe, label: "Gateways", hasGatewaysSubmenu: true },
    { to: "/configurar", icon: Settings, label: "Configurações", hasConfigurarSubmenu: true },
    { to: "/indicacoes", icon: Share2, label: "Indicações", hasIndicacoesSubmenu: true },
    { to: "/outros", icon: MoreHorizontal, label: "Outros", hasOutrosSubmenu: true },
    { to: "/logs", icon: ScrollText, label: "Logs" },
  ];

  const clientesSubItems = [
    { to: "/clientes/cadastro", label: "Adicionar" },
    { to: "/clientes", label: "Gerenciar" },
  ];
  const planosSubItems = [
    { to: "/planos/cadastro", label: "Adicionar" },
    { to: "/planos", label: "Gerenciar" },
  ];
  const aplicativosSubItems = [
    { to: "/aplicativos/cadastro", label: "Adicionar" },
    { to: "/aplicativos", label: "Gerenciar" },
  ];
  const produtosSubItems = [
    { to: "/produtos/cadastro", label: "Adicionar" },
    { to: "/produtos", label: "Gerenciar" },
  ];
  const financeiroSubItems = [
    { to: "/financeiro", label: "Geral" },
    { to: "/financeiro/nova-transacao", label: "Nova Transação" },
  ];
  const whatsappSubItems = [
    { to: "/whatsapp/parear", label: "Parear Whatsapp" },
    { to: "/whatsapp/gerenciar-mensagens", label: "Gerenciar Mensagens" },
    { to: "/whatsapp/fila-mensagens", label: "Fila de Mensagens" },
    { to: "/whatsapp/envios-em-massa", label: "Envios em Massa" },
    { to: "/whatsapp/templates", label: "Templates" },
  ];
  const configurarSubItems = [
    { to: "/configurar/configuracao-envio", label: "Configuração de Envio" },
    { to: "/configurar/notificacoes", label: "Configurações de Notificações" },
  ];
  const indicacoesSubItems = [
    { to: "/indicacoes/clientes", label: "Indicação de Clientes" },
    { to: "/indicacoes/sistema", label: "Indicação do Sistema" },
    ...(afiliadosLiberado ? [{ to: "/afiliados", label: "Painel Afiliados" }] : []),
  ];
  const outrosSubItems = [
    { to: "/outros/cupom", label: "Cupom" },
  ];
  const gatewaysSubItems = [
    { to: "/gateways/checkout", label: "Checkout" },
    { to: "/configuracoes/rotacao-gateway", label: "Rotação de Gateways" },
    { to: "/configuracoes/asaas", label: "Asaas" },
    { to: "/configuracoes/mercado-pago", label: "Mercado Pago" },
    { to: "/configuracoes/ciabra", label: "Ciabra" },
    { to: "/configuracoes/v3pay", label: "V3Pay PF" },
    { to: "/configuracoes/v3pay-pj", label: "V3Pay PJ" },
    { to: "/configuracoes/woovi", label: "Woovi" },
    { to: "/configuracoes/pix-manual", label: "PIX Manual" },
  ];
  const PROVIDER_ROUTES: Record<string, string> = {
    'koffice-api': '/servidores/koffice-api',
    'koffice-v2': '/servidores/koffice-v2',
    'mundogf': '/servidores/mundogf',
    'uniplay': '/servidores/uniplay',
    'playfast': '/servidores/playfast',
    'unitv': '/servidores/unitv',
    'sigma': '/servidores/sigma',
  };
  const servidoresSubItems = [
    { to: "/servidores", label: "Todos os Servidores" },
    ...servidoresAtivos
      .filter(s => PROVIDER_ROUTES[s.id])
      .map(s => ({ to: PROVIDER_ROUTES[s.id], label: s.nome })),
  ];
  const servidoresActive = currentPath.startsWith("/servidores");

  // Helper to render submenu items
  const renderSubItems = (items: { to: string; label: string }[]) => (
    <SidebarMenuSub className="ml-8 mt-2 space-y-1 animate-fade-in">
      {items.map((subItem) => (
        <SidebarMenuSubItem key={subItem.to}>
          <SidebarMenuSubButton asChild className="h-auto p-0 hover:bg-transparent">
            <NavLink to={subItem.to} end className={subItemClass(isActive(subItem.to))} onClick={() => setOpenMobile(false)}>
              <span className={subItemDotClass(isActive(subItem.to))} />
              {subItem.label}
            </NavLink>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  );

  // Determina se o item deve ficar azul: apenas se é o submenu aberto, 
  // ou se a rota está ativa E nenhum outro submenu está aberto
  const isMenuHighlighted = (menuKey: string, sectionActive: boolean) =>
    openSubmenu === menuKey || (sectionActive && openSubmenu === null);

  // Helper to render a submenu parent (same style as WhatsApp)
  const renderSubmenuParent = (
    item: typeof menuItems[0],
    menuKey: string,
    sectionActive: boolean,
    subItems: { to: string; label: string }[]
  ) => (
    <SidebarMenuItem key={item.to}>
      <SidebarMenuButton
        onClick={() => toggleSubmenu(menuKey)}
        className="h-auto p-0 hover:bg-transparent active:bg-transparent active:text-inherit focus-visible:ring-0 rounded-none"
      >
        <div className={`flex items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-5 py-3'} w-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isMenuHighlighted(menuKey, sectionActive)
            ? `bg-primary/15 text-primary ${!isCollapsed ? 'border-l-[3px] border-l-primary' : ''} font-medium` 
            : "text-muted-foreground hover:text-muted-foreground/80"
        }`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <item.icon className="h-5 w-5 flex-shrink-0 transition-transform duration-300" />
            {!isCollapsed && <span className="text-[14px] font-medium whitespace-nowrap transition-opacity duration-300">{item.label}</span>}
          </div>
          {!isCollapsed && (
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${openSubmenu === menuKey ? "rotate-180" : ""}`}
            />
          )}
        </div>
      </SidebarMenuButton>
      {openSubmenu === menuKey && !isCollapsed && renderSubItems(subItems)}
    </SidebarMenuItem>
  );

  return (
    <Sidebar className="border-r border-border" collapsible="icon">
      <SidebarHeader className="bg-background p-0">
        {isMobile ? (
          /* Mobile: show expiration + renew link */
          <div className="py-3 px-4 space-y-2">
            {subscription?.expira_em && (
              <div
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium border cursor-pointer hover:opacity-80 transition-opacity ${
                  daysLeft !== null && daysLeft <= 3
                    ? 'border-destructive/50 bg-destructive/10 text-destructive'
                    : 'border-success/50 bg-success/10 text-success'
                }`}
                onClick={() => { navigate('/renovar-acesso'); setOpenMobile(false); }}
              >
                <span className="text-muted-foreground text-xs">Vencimento</span>
                <span className="font-bold text-xs">
                  {new Date(subscription.expira_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  {' '}
                  {new Date(subscription.expira_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
            <div className="flex items-center justify-center gap-1">
              <Crown size={14} className="text-success" />
              <NavLink to="/renovar-acesso" onClick={() => setOpenMobile(false)} className="text-xs text-success hover:text-success/80 font-medium transition-colors">
                Renovar Acesso
              </NavLink>
            </div>
          </div>
        ) : (
          /* Desktop: show logo */
          <>
            <NavLink to="/dashboard" className={`flex items-center justify-center gap-2 transition-all duration-300 ${isCollapsed ? 'py-5' : 'py-6 px-4'} hover:opacity-80`}>
              <svg viewBox="0 0 100 110" className={`flex-shrink-0 ${isCollapsed ? 'w-9 h-9' : 'w-9 h-9'}`}>
                <defs>
                  <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" />
                  </linearGradient>
                </defs>
                <path d="M10 5 H90 V70 Q90 95 50 108 Q10 95 10 70 Z" fill="url(#shieldGrad)" rx="8" />
                <text x="50" y="72" textAnchor="middle" fill="white" fontSize="52" fontWeight="bold" fontFamily="sans-serif">M</text>
              </svg>
              {!isCollapsed && (
                <span className="text-xl font-bold tracking-wide text-foreground">GESTOR <span className="text-primary">MSX</span></span>
              )}
            </NavLink>
            {!isCollapsed && (
              <div className="flex justify-center -mt-4 mb-1 gap-1">
                <Crown size={14} className="text-success" />
                <NavLink to="/renovar-acesso" className="text-xs text-success hover:text-success/80 font-medium transition-colors">
                  Renovar Acesso
                </NavLink>
              </div>
            )}
          </>
        )}
        <div className="mx-4 border-t border-border/50" />
      </SidebarHeader>

      <SidebarContent className="bg-background">

        <SidebarGroup className="px-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0">
              {menuItems.map((item) => {
                if (item.hasSubmenu) return renderSubmenuParent(item, "clientes", clientesActive, clientesSubItems);
                if (item.hasPlanosSubmenu) return renderSubmenuParent(item, "planos", planosActive, planosSubItems);
                if (item.hasAplicativosSubmenu) return renderSubmenuParent(item, "aplicativos", aplicativosActive, aplicativosSubItems);
                if (item.hasProdutosSubmenu) return renderSubmenuParent(item, "produtos", produtosActive, produtosSubItems);
                if (item.hasServidoresSubmenu) return renderSubmenuParent(item, "servidores", servidoresActive, servidoresSubItems);
                if (item.hasFinanceiroSubmenu) return renderSubmenuParent(item, "financeiro", financeiroActive, financeiroSubItems);
                
                if (item.hasIndicacoesSubmenu) return renderSubmenuParent(item, "indicacoes", indicacoesActive, indicacoesSubItems);
                if (item.hasOutrosSubmenu) return renderSubmenuParent(item, "outros", outrosActive, outrosSubItems);
                if (item.hasGatewaysSubmenu) return renderSubmenuParent(item, "gateways", gatewaysActive, gatewaysSubItems);
                if (item.hasConfigurarSubmenu) return renderSubmenuParent(item, "configurar", configurarActive, configurarSubItems);

                // WhatsApp - special styling
                if (item.hasWhatsappSubmenu) {
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        onClick={() => toggleSubmenu("whatsapp")}
                        className="h-auto p-0 hover:bg-transparent active:bg-transparent active:text-inherit focus-visible:ring-0 rounded-none"
                      >
                        <div className={`flex items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-5 py-3'} w-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                          isMenuHighlighted("whatsapp", whatsappActive)
                            ? `bg-primary/15 text-primary ${!isCollapsed ? 'border-l-[3px] border-l-primary' : ''} font-medium` 
                            : "text-muted-foreground hover:text-muted-foreground/80"
                        }`}>
                          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                            <Phone className="h-5 w-5 flex-shrink-0 transition-transform duration-300" />
                            {!isCollapsed && <span className="text-[14px] font-medium whitespace-nowrap transition-opacity duration-300">{item.label}</span>}
                          </div>
                          {!isCollapsed && (
                            <ChevronDown
                              className={`h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${openSubmenu === "whatsapp" ? "rotate-180" : ""}`}
                            />
                          )}
                        </div>
                      </SidebarMenuButton>
                      {openSubmenu === "whatsapp" && !isCollapsed && renderSubItems(whatsappSubItems)}
                    </SidebarMenuItem>
                  );
                }

                // Items normais
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild className="h-auto p-0 hover:bg-transparent active:bg-transparent active:text-inherit focus-visible:ring-0 rounded-none">
                      <NavLink to={item.to} end onClick={() => { setOpenSubmenu(null); setOpenMobile(false); }}>
                        <div className={`flex items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-5 py-3'} w-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                          isActive(item.to) && openSubmenu === null
                            ? `bg-primary/15 text-primary ${!isCollapsed ? 'border-l-[3px] border-l-primary' : ''} font-medium`
                            : "text-muted-foreground hover:text-muted-foreground/80"
                        }`}>
                          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                            <item.icon className="h-5 w-5 flex-shrink-0 transition-transform duration-300" />
                            {!isCollapsed && <span className="text-[14px] font-medium whitespace-nowrap transition-opacity duration-300">{item.label}</span>}
                          </div>
                          
                        </div>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
