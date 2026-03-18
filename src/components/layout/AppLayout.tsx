import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Outlet, useNavigate } from "react-router-dom";
import { ChevronsLeft, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfile } from "@/hooks/useProfile";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { useMessageQueueProcessor } from "@/hooks/useMessageQueueProcessor";
import { usePendingRenewals } from "@/hooks/usePendingRenewals";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LogOut, User, Bell, Check, Trash2, Star, Headset, Mail } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

import { ptBR } from "date-fns/locale";
import { InstallBanner } from "@/components/pwa/InstallBanner";

function SidebarToggleButton() {
  const { toggleSidebar, state } = useSidebar();
  const isExpanded = state === "expanded";

  return (
    <button
      onClick={toggleSidebar}
      className="hidden md:flex fixed top-[2.35rem] z-50 h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:shadow-primary/40 hover:scale-110 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{ left: isExpanded ? 'calc(var(--sidebar-width) - 12px)' : 'calc(var(--sidebar-width-icon, 4.5rem) - 12px)' }}
      aria-label="Toggle Sidebar"
    >
      <ChevronsLeft
        className={`h-4 w-4 transition-transform duration-300 ${!isExpanded ? 'rotate-180' : ''}`}
      />
    </button>
  );
}

function MobileMenuButton() {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      onClick={toggleSidebar}
      className="md:hidden flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-300 mr-2"
      aria-label="Menu"
    >
      <Menu className="h-6 w-6" />
    </button>
  );
}

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { userId } = useCurrentUser();
  const { subscription, daysLeft, isTrial, isActive } = useSubscription(userId);
  const { profile } = useProfile(userId);
  const { notificacoes, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotificacoes(userId);
  const navigate = useNavigate();

  // Global background processor for WhatsApp message queue
  useMessageQueueProcessor();
  usePendingRenewals();

  const getUserInitials = (name?: string | null, email?: string) => {
    const n = name || profile?.nome_completo;
    if (n) {
      const parts = n.trim().split(' ');
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return n.substring(0, 2).toUpperCase();
    }
    if (email) {
      const parts = email.split('@')[0].split('.');
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getDisplayName = () => {
    if (profile?.nome_completo) return profile.nome_completo;
    const fullName = user?.user_metadata?.full_name;
    if (fullName) return fullName;
    if (user?.email) {
      return user.email.split('@')[0].split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    return 'Usuário';
  };

  const getCompanyName = () => {
    return profile?.nome_empresa || user?.user_metadata?.company_name || 'Minha Empresa';
  };

  const getExpirationDate = () => {
    if (!subscription?.expira_em) return null;
    const d = new Date(subscription.expira_em);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getNotifIcon = (tipo: string) => {
    switch (tipo) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  const expirationDate = getExpirationDate();
  const isExpiredOrClose = daysLeft !== null && daysLeft <= 3;

   return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-[radial-gradient(1200px_600px_at_-20%_-10%,hsl(var(--brand)/.15)_0%,transparent_60%)] overflow-hidden relative">
        <AppSidebar />
        <SidebarToggleButton />
        <div className="flex-1 flex flex-col h-full min-w-0">
          {/* Header */}
          <header className="h-16 sm:h-20 border-b border-border flex items-center px-4 sm:px-6 bg-sidebar-background z-[60] flex-shrink-0 relative">
           <MobileMenuButton />
            {/* Mobile logo */}
            <div className="md:hidden flex items-center gap-2">
              <svg viewBox="0 0 100 110" className="w-7 h-7 flex-shrink-0">
                <defs>
                  <linearGradient id="headerShieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" />
                  </linearGradient>
                </defs>
                <path d="M10 5 H90 V70 Q90 95 50 108 Q10 95 10 70 Z" fill="url(#headerShieldGrad)" rx="8" />
                <text x="50" y="72" textAnchor="middle" fill="white" fontSize="52" fontWeight="bold" fontFamily="sans-serif">M</text>
              </svg>
              <span className="text-sm font-bold tracking-wide text-foreground">GESTOR <span className="text-primary">MSX</span></span>
            </div>
            {/* Spacer */}
            <div className="flex-1" />

            {/* Center/Right: Action icons + Expiration + Notifications + Profile */}
            <div className="flex items-center gap-2 sm:gap-3">

              {/* Support */}
              <a
                href="https://wa.me/5583920002677?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20o%20Gestor%20MSX."
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary hover:from-primary/30 hover:to-primary/10 hover:scale-110 hover:shadow-[0_0_16px_hsl(var(--primary)/.25)] transition-all duration-300 border border-primary/15 flex items-center justify-center"
              >
                <Headset className="h-5 w-5" />
              </a>


              {/* WhatsApp shortcut */}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-full bg-gradient-to-br from-success/20 to-success/5 text-success hover:from-success/30 hover:to-success/10 hover:scale-110 hover:shadow-[0_0_16px_hsl(var(--success)/.25)] transition-all duration-300 border border-success/15"
                      onClick={() => navigate('/whatsapp/parear')}
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">WhatsApp</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Notifications */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full bg-gradient-to-br from-warning/20 to-warning/5 text-warning hover:from-warning/30 hover:to-warning/10 hover:scale-110 hover:shadow-[0_0_16px_hsl(var(--warning)/.25)] transition-all duration-300 border border-warning/15 relative"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1 ring-2 ring-sidebar-background shadow-lg">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h4 className="font-semibold text-sm">Notificações</h4>
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={markAllAsRead}>
                        <Check className="h-3 w-3 mr-1" />
                        Marcar todas
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="max-h-72">
                    {notificacoes.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground text-sm">
                        Nenhuma notificação
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {notificacoes.map((n) => (
                          <div
                            key={n.id}
                            className={`px-4 py-3 flex gap-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                              !n.lida ? 'bg-primary/5' : ''
                            }`}
                            onClick={() => {
                              if (!n.lida) markAsRead(n.id);
                              if (n.link) navigate(n.link);
                            }}
                          >
                            <span className="text-lg flex-shrink-0 mt-0.5">{getNotifIcon(n.tipo)}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${!n.lida ? 'font-semibold' : 'font-medium'}`}>{n.titulo}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{n.mensagem}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {/* Expiration date badge */}
              {expirationDate && (
                <div
                  className={`hidden lg:flex items-center gap-3 px-4 py-2 rounded-xl text-sm cursor-pointer hover:scale-[1.03] transition-all duration-300 backdrop-blur-sm group ${
                    isExpiredOrClose
                      ? 'bg-gradient-to-r from-destructive/15 to-destructive/5 border border-destructive/20 hover:shadow-[0_0_20px_hsl(var(--destructive)/.15)]'
                      : 'bg-gradient-to-r from-success/15 to-success/5 border border-success/20 hover:shadow-[0_0_20px_hsl(var(--success)/.15)]'
                  }`}
                  onClick={() => navigate('/renovar-acesso')}
                >
                  <span className="text-muted-foreground text-xs font-medium">Vencimento do Acesso</span>
                  <span className={`font-bold tracking-wide ${isExpiredOrClose ? 'text-destructive' : 'text-success'}`}>
                    {expirationDate}
                  </span>
                </div>
              )}

              {/* Separator */}
              <div className="hidden sm:block w-px h-6 bg-border/50 mx-1" />

              {/* Profile section */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2.5 h-auto p-1.5 rounded-xl hover:bg-accent/50 hover:scale-[1.02] transition-all duration-200 border border-transparent hover:border-border/50">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <span className="text-primary text-sm font-bold">
                        {getUserInitials(user?.user_metadata?.full_name, user?.email)}
                      </span>
                    </div>
                    <span className="hidden sm:block text-sm font-semibold text-foreground truncate max-w-[160px]">
                      {getDisplayName()}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover/95 backdrop-blur-md border border-border/50 shadow-xl rounded-xl z-50">
                  <DropdownMenuItem disabled className="py-2.5">
                    <User className="mr-2 h-4 w-4" />
                    <span className="text-sm font-medium truncate">{getCompanyName()}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem onClick={() => navigate('/perfil')} className="py-2.5 rounded-lg mx-1 cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/renovar-acesso')} className="py-2.5 rounded-lg mx-1 cursor-pointer">
                    <Star className="mr-2 h-4 w-4" />
                    Renovar Acesso
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive py-2.5 rounded-lg mx-1 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Trial banner */}
          {isTrial && daysLeft !== null && daysLeft > 0 && (
            <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-center text-sm flex items-center justify-center gap-2 flex-shrink-0">
              <span className="text-foreground">
                Período de teste: <strong>{daysLeft} dia{daysLeft !== 1 ? 's' : ''}</strong> restante{daysLeft !== 1 ? 's' : ''}
              </span>
              <button
                className="ml-2 text-xs border border-primary/30 text-primary px-2 py-0.5 rounded hover:bg-primary/10 transition-colors"
                onClick={() => navigate('/planos-disponiveis')}
              >
                Ativar plano
              </button>
            </div>
          )}

          <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 animate-enter min-w-0">
            <Outlet />
            <footer className="mt-8 border-t border-border py-3 text-center space-y-1">
              <p className="text-[11px] text-muted-foreground/50">
                2026© Todos os direitos reservados Gestor MSX
              </p>
              <p className="text-[11px] text-muted-foreground/50">
                <Mail className="inline h-3 w-3 mr-1 -mt-0.5" />
                <a href="mailto:suporte@gestormsx.pro" className="hover:text-primary transition-colors">suporte@gestormsx.pro</a>
              </p>
            </footer>
          </main>
          <InstallBanner />
          
        </div>
      </div>
    </SidebarProvider>
  );
}
