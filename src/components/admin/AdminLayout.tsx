import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  ArrowLeft,
  Shield,
  MessageSquare,
  Wallet,
  ScrollText,
  Settings,
  UserCheck,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Server,
  Share2,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface SubItem {
  to: string;
  label: string;
}

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  submenuKey?: string;
  subItems?: SubItem[];
}

const adminNavItems: NavItem[] = [
  { title: "Dashboard", url: "/role/admin/dashboard", icon: LayoutDashboard },
  { title: "Usuários", url: "/role/admin/usuarios", icon: Users },
  {
    title: "Planos SaaS",
    url: "/role/admin/planos",
    icon: CreditCard,
    submenuKey: "planos",
    subItems: [
      { to: "/role/admin/planos/novo", label: "Criar Novo" },
      { to: "/role/admin/planos", label: "Gerenciar" },
    ],
  },
  {
    title: "Assinaturas",
    url: "/role/admin/assinaturas",
    icon: UserCheck,
  },
  {
    title: "Gateways",
    url: "/role/admin/gateways",
    icon: Wallet,
    submenuKey: "gateways",
    subItems: [
      { to: "/role/admin/gateways", label: "Checkout" },
      { to: "/role/admin/gateways/asaas", label: "Asaas" },
      { to: "/role/admin/gateways/mercadopago", label: "Mercado Pago" },
      { to: "/role/admin/gateways/ciabra", label: "Ciabra" },
      
      { to: "/role/admin/gateways/v3pay", label: "V3Pay" },
    ],
  },
  {
    title: "Templates",
    url: "/role/admin/templates",
    icon: MessageSquare,
    submenuKey: "templates",
    subItems: [
      { to: "/role/admin/templates/novo", label: "Criar Novo" },
      { to: "/role/admin/templates", label: "Gerenciar" },
    ],
  },
  { title: "Servidores", url: "/role/admin/servidores", icon: Server },
  {
    title: "Indicações",
    url: "/role/admin/indicacoes",
    icon: Share2,
    submenuKey: "indicacoes",
    subItems: [
      { to: "/role/admin/indicacoes", label: "Configurações" },
      { to: "/role/admin/indicacoes/usuarios", label: "Usuários" },
      { to: "/role/admin/indicacoes/registros", label: "Indicações" },
      { to: "/role/admin/indicacoes/saques", label: "Saques" },
      { to: "/role/admin/indicacoes/ranking", label: "Top 5" },
    ],
  },
  { title: "Afiliados", url: "/role/admin/afiliados", icon: Network },
  { title: "Configurações", url: "/role/admin/configuracoes", icon: Settings },
  { title: "Logs", url: "/role/admin/logs", icon: ScrollText },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { signOut } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  const getInitialSubmenu = () => {
    for (const item of adminNavItems) {
      if (item.submenuKey && item.subItems?.some(s => currentPath === s.to || currentPath.startsWith(s.to + "/"))) {
        return item.submenuKey;
      }
    }
    return null;
  };

  const [openSubmenu, setOpenSubmenu] = useState<string | null>(getInitialSubmenu);

  const toggleSubmenu = (key: string) => setOpenSubmenu(prev => prev === key ? null : key);
  const fullPath = currentPath + location.search;
  const isActive = (path: string) => {
    if (path.includes("?")) return fullPath === path;
    return currentPath === path;
  };
  const isSectionActive = (item: NavItem) => {
    if (item.subItems) return item.subItems.some(s => {
      if (s.to.includes("?")) return fullPath === s.to;
      return currentPath === s.to || currentPath.startsWith(s.to + "/");
    });
    return currentPath === item.url;
  };
  const isMenuHighlighted = (menuKey: string, sectionActive: boolean) =>
    openSubmenu === menuKey || (sectionActive && openSubmenu === null);

  const menuItemClass = (active: boolean) =>
    `flex items-center justify-between w-full px-5 py-3 transition-all ${
      active
        ? "bg-primary/15 text-primary border-l-[3px] border-l-primary font-medium"
        : "text-sidebar-foreground/70 hover:text-sidebar-foreground/80"
    }`;

  const subItemClass = (active: boolean) =>
    `flex items-center gap-2 py-1 text-[13px] transition-colors ${
      active ? "text-primary font-medium" : "text-muted-foreground hover:text-primary"
    }`;

  const subItemDotClass = (active: boolean) =>
    `w-2 h-2 rounded-full border ${
      active ? "border-primary bg-primary" : "border-muted-foreground bg-transparent"
    }`;

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 p-4 border-b border-sidebar-border">
        <Shield className="h-6 w-6 text-primary" />
        <span className="font-bold text-lg text-sidebar-foreground">Painel Admin</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {adminNavItems.map((item) => {
          if (item.submenuKey && item.subItems) {
            const sectionActive = isSectionActive(item);
            return (
              <div key={item.url}>
                <button
                  onClick={() => toggleSubmenu(item.submenuKey!)}
                  className={cn("w-full", menuItemClass(isMenuHighlighted(item.submenuKey, sectionActive)))}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5" />
                    <span className="text-[14px] font-medium">{item.title}</span>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", openSubmenu === item.submenuKey && "rotate-180")} />
                </button>
                {openSubmenu === item.submenuKey && (
                  <div className="ml-8 mt-2 mb-2 space-y-1">
                    {item.subItems.map((sub) => (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        end
                        className={subItemClass(isActive(sub.to))}
                        onClick={onNavigate}
                      >
                        <span className={subItemDotClass(isActive(sub.to))} />
                        {sub.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/role/admin/dashboard"}
              onClick={() => { setOpenSubmenu(null); onNavigate?.(); }}
              className={() => menuItemClass(isActive(item.url) && openSubmenu === null)}
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                <span className="text-[14px] font-medium">{item.title}</span>
              </div>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <NavLink to="/" onClick={onNavigate}>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground/70">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Sistema
          </Button>
        </NavLink>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();

  // Close sheet on route change
  useEffect(() => {
    setSheetOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className="w-64 border-r bg-sidebar flex flex-col flex-shrink-0 h-screen sticky top-0">
          <SidebarNav />
        </aside>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        {isMobile && (
          <header className="h-12 border-b flex items-center px-3 gap-3 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 flex-shrink-0 sticky top-0">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <SidebarNav onNavigate={() => setSheetOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Painel Admin</span>
            </div>
          </header>
        )}

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
