import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, UserCheck, TrendingUp, DollarSign,
  Receipt, CreditCard, Eye, EyeOff, Crown, Clock, UserPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";

interface AdminStats {
  totalUsers: number;
  totalClientes: number;
  clientesAtivos: number;
  clientesVencidos: number;
  totalEntradas: number;
  totalSaidas: number;
  lucro: number;
  totalCobrancas: number;
  cobrancasPagas: number;
  subsAtivas: number;
  subsPendentes: number;
  subsExpiradas: number;
  receitaMensal: number;
  receitaAnual: number;
  receitaRecorrente: number;
  novosUsersHoje: number;
  novosUsersSemana: number;
  novosUsersMes: number;
  novosClientesHoje: number;
  novosClientesSemana: number;
  novosClientesMes: number;
  clientesVencendoHoje: number;
  clientesVencendo3Dias: number;
  usersGrowth: Array<{ day: string; total: number }>;
  clientesGrowth: Array<{ day: string; total: number }>;
  recentUsers: Array<{ id: string; email: string; created_at: string; full_name: string }>;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLucro, setShowLucro] = useState(false);

  useEffect(() => {
    document.title = "Dashboard Admin | Gestor Msx";
    const fetchStats = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch(
          `https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/admin-api`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ action: "global_stats" }),
          }
        );
        const result = await resp.json();
        if (result.success) setStats(result.stats);
      } catch (err) {
        console.error("Failed to fetch admin stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-64" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return <p className="text-muted-foreground">Erro ao carregar dados.</p>;

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom Dia" : hora < 18 ? "Boa Tarde" : "Boa Noite";
  const currentMonth = new Date().toLocaleString("pt-BR", { month: "long" });

  const tooltipStyle = {
    backgroundColor: "hsl(220, 18%, 18%)",
    border: "1px solid hsl(220, 15%, 25%)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(210, 40%, 98%)",
  };

  const growthData = stats.usersGrowth.map((u, i) => ({
    day: u.day,
    "Novos Usuários": u.total,
    "Novos Clientes": stats.clientesGrowth[i]?.total ?? 0,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
        {saudacao}, Admin!
      </h1>

      {/* 1ª linha — Cards principais */}
      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-card border-border">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Usuários do Sistema</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalUsers}</p>
            </div>
            <Users className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Clientes Total</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalClientes}</p>
            </div>
            <Users className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Clientes Ativos</p>
              <p className="text-2xl font-bold text-foreground">{stats.clientesAtivos}</p>
            </div>
            <TrendingUp className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
      </section>

      {/* 2ª linha — Receita & Cobranças */}
      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-card border-border">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Receita Total</p>
              <p className="text-2xl font-bold text-foreground">{fmt(stats.totalEntradas)}</p>
            </div>
            <DollarSign className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Cobranças Geradas</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalCobrancas}</p>
            </div>
            <Receipt className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Cobranças Pagas</p>
              <p className="text-2xl font-bold text-foreground">{stats.cobrancasPagas}</p>
            </div>
            <CreditCard className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
      </section>

      {/* 3ª linha — Lucro Assinaturas (mensal/anual) */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="bg-card border-border">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-muted-foreground">Receita Mensal (Assinaturas)</p>
                <Badge className="bg-primary/20 text-primary text-xs px-2 py-0.5">
                  {currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-foreground">
                  {showLucro ? fmt(stats.receitaMensal) : "R$ •••••"}
                </p>
                <button
                  onClick={() => setShowLucro(!showLucro)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showLucro ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <Crown className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Receita Anual (Assinaturas)</p>
              <p className="text-2xl font-bold text-foreground">
                {showLucro ? fmt(stats.receitaAnual) : "R$ •••••"}
              </p>
            </div>
            <DollarSign className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">MRR (Recorrente)</p>
              <p className="text-2xl font-bold text-foreground">
                {showLucro ? fmt(stats.receitaRecorrente) : "R$ •••••"}
              </p>
            </div>
            <TrendingUp className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
      </section>

      {/* 4ª linha — Assinaturas + Crescimento */}
      <section className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-xl bg-card border border-border p-5 flex items-center gap-4">
          <div className="rounded-full bg-[hsl(142,70%,45%)]/20 p-2">
            <UserPlus className="h-6 w-6 text-[hsl(142,70%,45%)]" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Novos Usuários Hoje</span>
              <span className="text-foreground font-semibold">{stats.novosUsersHoje}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Esta Semana</span>
              <span className="text-foreground font-semibold">{stats.novosUsersSemana}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Este Mês</span>
              <span className="text-foreground font-semibold">{stats.novosUsersMes}</span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-card border border-border p-5 flex items-center gap-4">
          <div className="rounded-full bg-primary/20 p-2">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Novos Clientes Hoje</span>
              <span className="text-foreground font-semibold">{stats.novosClientesHoje}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Esta Semana</span>
              <span className="text-foreground font-semibold">{stats.novosClientesSemana}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Este Mês</span>
              <span className="text-foreground font-semibold">{stats.novosClientesMes}</span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-card border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full bg-primary/20 p-1">
              <Crown className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Assinaturas</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ativas</span>
              <span className="text-foreground font-semibold">{stats.subsAtivas}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Pendentes</span>
              <span className="text-foreground font-semibold">{stats.subsPendentes}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Expiradas</span>
              <span className="text-foreground font-semibold">{stats.subsExpiradas}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5ª linha — Gráfico */}
      <section>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              Crescimento da Plataforma (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData}>
                  <defs>
                    <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="gClients" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 25%)" opacity={0.3} />
                  <XAxis dataKey="day" stroke="hsl(215, 20%, 65%)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(215, 20%, 65%)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(215, 20%, 65%)" }} iconType="circle" />
                  <Area type="monotone" dataKey="Novos Usuários" stroke="hsl(142, 70%, 45%)" fill="url(#gUsers)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Novos Clientes" stroke="hsl(199, 89%, 48%)" fill="url(#gClients)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 6ª linha — Últimos Usuários */}
      <section>
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-card p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Últimos Usuários Cadastrados</h3>
            <p className="text-sm text-muted-foreground">Os 10 usuários mais recentes da plataforma</p>
          </div>
          <div className="bg-card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Nome</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Email</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Data Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentUsers.map((user) => (
                  <tr key={user.id} className="border-b border-border hover:bg-muted/50">
                    <td className="p-3">
                      <span className="text-primary font-medium">{user.full_name || "—"}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-foreground">{user.email}</span>
                    </td>
                    <td className="p-3">
                      <span className="inline-block px-3 py-1 rounded-full border border-border text-sm">
                        {new Date(user.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
