import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Trophy, Loader2, Medal } from "lucide-react";

interface RankingUser {
  userId: string;
  nome: string;
  totalIndicacoes: number;
  totalAprovadas: number;
  bonusTotal: number;
}

export default function AdminIndicacoesRanking() {
  const [ranking, setRanking] = useState<RankingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoBonus, setTipoBonus] = useState("fixo");

  useEffect(() => {
    document.title = "Top 5 Indicadores | Admin";
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: configData }, { data: inds }] = await Promise.all([
        supabase.from("system_indicacoes_config").select("tipo_bonus").eq("id", 1).single(),
        supabase.from("indicacoes").select("*").order("created_at", { ascending: false }),
      ]);

      if (configData?.tipo_bonus) setTipoBonus(configData.tipo_bonus);
      if (!inds?.length) { setRanking([]); setLoading(false); return; }

      const userIds = [...new Set(inds.map(i => i.user_id))];
      const profileMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, nome_completo").in("user_id", userIds);
        profiles?.forEach(p => profileMap.set(p.user_id, p.nome_completo || "Sem nome"));
      }

      const map = new Map<string, RankingUser>();
      inds.forEach(ind => {
        const existing = map.get(ind.user_id);
        if (existing) {
          existing.totalIndicacoes += 1;
          if (ind.status === "aprovado" || ind.status === "pago") existing.totalAprovadas += 1;
          existing.bonusTotal += Number(ind.bonus);
        } else {
          map.set(ind.user_id, {
            userId: ind.user_id,
            nome: profileMap.get(ind.user_id) || ind.user_id.substring(0, 8) + "...",
            totalIndicacoes: 1,
            totalAprovadas: (ind.status === "aprovado" || ind.status === "pago") ? 1 : 0,
            bonusTotal: Number(ind.bonus),
          });
        }
      });

      const sorted = Array.from(map.values()).sort((a, b) => b.totalAprovadas - a.totalAprovadas).slice(0, 5);
      setRanking(sorted);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getMedalColor = (pos: number) => {
    if (pos === 0) return "text-yellow-500";
    if (pos === 1) return "text-gray-400";
    if (pos === 2) return "text-amber-600";
    return "text-muted-foreground";
  };

  const formatBonus = (val: number) => {
    return tipoBonus === "percentual"
      ? `${val.toFixed(2).replace(".", ",")}%`
      : `R$ ${val.toFixed(2).replace(".", ",")}`;
  };

  return (
    <div className="space-y-4">
      <header className="rounded-lg border overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <h1 className="text-base font-semibold tracking-tight text-foreground">Top 5 Indicadores</h1>
          </div>
          <p className="text-xs/6 text-muted-foreground">Os usuários que mais indicaram e tiveram indicações aprovadas (indicado assinou plano).</p>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : ranking.length === 0 ? (
            <div className="p-6 text-center"><Trophy className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" /><p className="text-sm text-muted-foreground">Nenhuma indicação encontrada.</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Total Indicações</TableHead>
                  <TableHead>Aprovadas</TableHead>
                   <TableHead>Valor Ganho</TableHead>
                   <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((user, idx) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div className="flex items-center">
                        {idx < 3 ? <Medal className={cn("h-5 w-5", getMedalColor(idx))} /> : <span className="text-sm font-medium text-muted-foreground ml-1">{idx + 1}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{user.nome}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-bold">{user.totalIndicacoes}</Badge>
                    </TableCell>
                    <TableCell>{user.totalAprovadas}</TableCell>
                    <TableCell>{formatBonus(user.bonusTotal)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {tipoBonus === "percentual" ? "%" : "R$"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
