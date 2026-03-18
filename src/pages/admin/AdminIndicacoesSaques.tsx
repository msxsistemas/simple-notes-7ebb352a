import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Loader2, CheckCircle, DollarSign, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface SaqueRow {
  id: string;
  user_id: string;
  valor: number;
  chave_pix: string;
  status: string;
  motivo_rejeicao: string | null;
  created_at: string;
  user_nome?: string;
}

const PAGE_SIZE = 10;

export default function AdminIndicacoesSaques() {
  const [saques, setSaques] = useState<SaqueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSaqueId, setRejectSaqueId] = useState<string | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Saques | Admin";
    fetchSaques();
  }, []);

  const fetchSaques = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("saques_indicacao").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      if (!data?.length) { setSaques([]); setLoading(false); return; }
      const userIds = [...new Set(data.map(s => s.user_id))];
      const profileMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, nome_completo").in("user_id", userIds);
        profiles?.forEach(p => profileMap.set(p.user_id, p.nome_completo || "Sem nome"));
      }
      setSaques(data.map(s => ({ ...s, user_nome: profileMap.get(s.user_id) || s.user_id.substring(0, 8) + "..." })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleApproveSaque = async (id: string) => {
    const { error } = await supabase.from("saques_indicacao").update({ status: "aprovado" }).eq("id", id);
    if (error) { toast({ title: "Erro ao aprovar", variant: "destructive" }); } else { toast({ title: "Saque aprovado!" }); fetchSaques(); }
  };

  const handlePaySaque = async (id: string) => {
    const { error } = await supabase.from("saques_indicacao").update({ status: "pago" }).eq("id", id);
    if (error) { toast({ title: "Erro ao marcar como pago", variant: "destructive" }); } else { toast({ title: "Saque marcado como pago!" }); fetchSaques(); }
  };

  const handleRejectSaque = async () => {
    if (!rejectSaqueId) return;
    const { error } = await supabase.from("saques_indicacao").update({ status: "rejeitado", motivo_rejeicao: rejectMotivo || null }).eq("id", rejectSaqueId);
    if (error) { toast({ title: "Erro ao rejeitar", variant: "destructive" }); } else { toast({ title: "Saque rejeitado." }); setRejectDialogOpen(false); fetchSaques(); }
  };

  return (
    <div className="space-y-4">
      <header className="rounded-lg border overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-foreground/70" />
            <h1 className="text-base font-semibold tracking-tight text-foreground">Solicitações de Saque</h1>
          </div>
          <p className="text-xs/6 text-muted-foreground">Gerencie as solicitações de resgate dos usuários.</p>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : saques.length === 0 ? (
            <div className="p-6 text-center"><Wallet className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" /><p className="text-sm text-muted-foreground">Nenhuma solicitação de saque.</p></div>
          ) : (() => {
            const totalPages = Math.max(1, Math.ceil(saques.length / PAGE_SIZE));
            const paginated = saques.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
            return (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Chave PIX</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.user_nome}</TableCell>
                        <TableCell>R$ {Number(s.valor).toFixed(2).replace(".", ",")}</TableCell>
                        <TableCell className="font-mono text-xs">{s.chave_pix}</TableCell>
                        <TableCell>
                          {s.status === "pago" && <Badge className="bg-green-500/10 text-green-500">Pago</Badge>}
                          {s.status === "aprovado" && <Badge className="bg-yellow-500/10 text-yellow-500">Aprovado</Badge>}
                          {s.status === "rejeitado" && <Badge variant="destructive">Rejeitado</Badge>}
                          {s.status === "pendente" && <Badge variant="secondary">Pendente</Badge>}
                        </TableCell>
                        <TableCell>{new Date(s.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-right">
                          {(s.status === "pendente" || s.status === "aprovado") && (
                            <div className="flex items-center justify-end gap-1">
                              {s.status === "pendente" && (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleApproveSaque(s.id)}>
                                  <CheckCircle className="h-3.5 w-3.5" /> Aprovar
                                </Button>
                              )}
                              {s.status === "aprovado" && (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handlePaySaque(s.id)}>
                                  <DollarSign className="h-3.5 w-3.5" /> Marcar Pago
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" onClick={() => { setRejectSaqueId(s.id); setRejectMotivo(""); setRejectDialogOpen(true); }}>
                                <XCircle className="h-3.5 w-3.5" /> Rejeitar
                              </Button>
                            </div>
                          )}
                          {s.status === "rejeitado" && s.motivo_rejeicao && (
                            <span className="text-xs text-muted-foreground">{s.motivo_rejeicao}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-xs text-muted-foreground">{saques.length} registro(s) — Página {page} de {totalPages}</span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Saque</DialogTitle>
            <DialogDescription>Informe o motivo da rejeição (opcional).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da Rejeição</Label>
            <Textarea placeholder="Ex: Saldo insuficiente..." value={rejectMotivo} onChange={e => setRejectMotivo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRejectSaque}>Rejeitar Saque</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
