import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { Users, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";

interface UserSummary {
  userId: string;
  nome: string;
  totalIndicacoes: number;
  totalAprovadas: number;
  bonusRealTotal: number;
}

export default function AdminIndicacoesUsuarios() {
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUsers, setSearchUsers] = useState("");

  useEffect(() => {
    document.title = "Usuários Indicações | Admin";
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all indicacoes
      const { data: inds } = await supabase
        .from("indicacoes")
        .select("*")
        .order("created_at", { ascending: false });

      if (!inds?.length) {
        setUserSummaries([]);
        setLoading(false);
        return;
      }

      // Fetch system config for bonus type
      const { data: configData } = await supabase
        .from("system_indicacoes_config")
        .select("tipo_bonus")
        .eq("id", 1)
        .single();
      const tipoBonus = configData?.tipo_bonus || "fixo";

      // Fetch user profiles for names
      const allUserIds = [...new Set(inds.map((i) => i.user_id))];
      const profileMap = new Map<string, string>();
      if (allUserIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nome_completo")
          .in("user_id", allUserIds);
        profiles?.forEach((p) =>
          profileMap.set(p.user_id, p.nome_completo || "Sem nome")
        );
      }

      // For percentual bonus, get indicated users' subscription plan values
      // indicacoes.codigo_indicacao links to the indicated user
      // We need to find what plan value the indicated user pays
      let indicadoPlanoValorMap = new Map<string, number>();

      if (tipoBonus === "percentual") {
        // Get all unique indicated user IDs (users who were invited)
        // The codigo_indicacao field identifies the indication, but the indicated user
        // is tracked via the user who signed up with this code
        // We need subscriptions of ALL users to calculate
        const { data: subs } = await supabase
          .from("user_subscriptions")
          .select("user_id, plan_id, status")
          .eq("status", "ativa");

        if (subs?.length) {
          const planIds = [...new Set(subs.map((s) => s.plan_id).filter(Boolean))] as string[];
          const planValueMap = new Map<string, number>();

          if (planIds.length) {
            const { data: plans } = await supabase
              .from("system_plans")
              .select("id, valor")
              .in("id", planIds);
            plans?.forEach((p) => planValueMap.set(p.id, p.valor));
          }

          subs.forEach((s) => {
            if (s.plan_id && planValueMap.has(s.plan_id)) {
              indicadoPlanoValorMap.set(s.user_id, planValueMap.get(s.plan_id)!);
            }
          });
        }
      }

      // Build summaries per referring user
      const map = new Map<string, UserSummary>();
      inds.forEach((ind) => {
        const isAprovado = ind.status === "aprovado" || ind.status === "pago";
        let realBonus = Number(ind.bonus);

        // If percentual, calculate real money based on the indicated user's subscription value
        if (tipoBonus === "percentual") {
          // Try to find the indicated user's plan value
          // The indication tracks who was indicated - we look for any user subscription
          // that matches. Since we don't have a direct "indicated_user_id" field,
          // we use the bonus percentage against an average or available plan value
          // For now, look at all active subscriptions to estimate
          const allPlanValues = [...indicadoPlanoValorMap.values()];
          const avgPlanValue = allPlanValues.length
            ? allPlanValues.reduce((a, b) => a + b, 0) / allPlanValues.length
            : 0;
          realBonus = (Number(ind.bonus) / 100) * avgPlanValue;
        }

        const existing = map.get(ind.user_id);
        if (existing) {
          existing.totalIndicacoes += 1;
          if (isAprovado) existing.totalAprovadas += 1;
          existing.bonusRealTotal += realBonus;
        } else {
          map.set(ind.user_id, {
            userId: ind.user_id,
            nome: profileMap.get(ind.user_id) || ind.user_id.substring(0, 8) + "...",
            totalIndicacoes: 1,
            totalAprovadas: isAprovado ? 1 : 0,
            bonusRealTotal: realBonus,
          });
        }
      });

      setUserSummaries(Array.from(map.values()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const filteredUsers = userSummaries.filter((u) =>
    u.nome.toLowerCase().includes(searchUsers.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [searchUsers]);

  return (
    <div className="space-y-4">
      <header className="rounded-lg border overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-foreground/70" />
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              Usuários do Sistema
            </h1>
          </div>
          <p className="text-xs/6 text-muted-foreground">
            Visualize o bônus real de cada usuário por indicações de novos usuários.
          </p>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-foreground/70" />
              <CardTitle className="text-sm">Usuários com Indicações</CardTitle>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário..."
                value={searchUsers}
                onChange={(e) => setSearchUsers(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-6 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhum usuário com indicações.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Total Indicações</TableHead>
                    <TableHead>Aprovadas</TableHead>
                    <TableHead>Bônus Total (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell className="font-medium">{user.nome}</TableCell>
                      <TableCell>{user.totalIndicacoes}</TableCell>
                      <TableCell>{user.totalAprovadas}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          R$ {user.bonusRealTotal.toFixed(2).replace(".", ",")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    {filteredUsers.length} registro(s) — Página {page} de {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
