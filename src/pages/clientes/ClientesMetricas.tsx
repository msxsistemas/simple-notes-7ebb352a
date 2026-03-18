import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Cliente, Produto, Plano } from "@/types/database";

interface MetricasProduto {
  nome: string;
  clientesAtivos: number;
  receitaAtiva: number;
  clientesVencidos: number;
  receitaVencida: number;
  percentual: number;
}

export default function ClientesMetricas() {
  const [produto, setProduto] = useState("todos");
  const [dataInicial, setDataInicial] = useState("2025-08-01");
  const [dataFinal, setDataFinal] = useState(new Date().toISOString().split('T')[0]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [metricasProdutos, setMetricasProdutos] = useState<MetricasProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState({
    ativosInicio: 0,
    ativosFinal: 0,
    novos: 0,
    perdidos: 0,
    faturamentoInicio: 0,
    faturamentoNovos: 0,
    faturamentoPerdidos: 0,
    receitaPeriodo: 0,
    percentualGanho: 0,
    percentualPerda: 0
  });

  useEffect(() => {
    document.title = "Clientes - Métricas | Gestor Tech Play";
    carregarDados();
  }, [dataInicial, dataFinal]);

  const carregarDados = async () => {
    try {
      setLoading(true);

      const [clientesRes, produtosRes, planosRes] = await Promise.all([
        supabase.from('clientes').select('*'),
        supabase.from('produtos').select('*'),
        supabase.from('planos').select('*')
      ]);

      if (clientesRes.error) throw clientesRes.error;
      if (produtosRes.error) throw produtosRes.error;
      if (planosRes.error) throw planosRes.error;

      const clientes = clientesRes.data as Cliente[];
      const produtosList = produtosRes.data as Produto[];
      const planos = planosRes.data as Plano[];

      setProdutos(produtosList);

      // Criar mapa de planos para facilitar lookup
      const planosMap = new Map(planos.map(p => [p.id!, p]));

      // Calcular métricas por produto
      const metricas: MetricasProduto[] = produtosList.map(produto => {
        const clientesDoProduto = clientes.filter(c => c.produto === produto.id);
        
        let clientesAtivos = 0;
        let clientesVencidos = 0;
        let receitaAtiva = 0;
        let receitaVencida = 0;

        const agora = new Date();

        clientesDoProduto.forEach(cliente => {
          const dataVencimento = cliente.data_vencimento ? new Date(cliente.data_vencimento) : null;
          const isVencido = dataVencimento ? dataVencimento < agora : false;

          if (isVencido) {
            clientesVencidos++;
            // Calcular receita vencida baseada no plano
            if (cliente.plano && planosMap.has(cliente.plano)) {
              const plano = planosMap.get(cliente.plano)!;
              const valorStr = plano.valor.replace(/[R$\s]/g, '').replace(',', '.');
              const valor = parseFloat(valorStr);
              if (!isNaN(valor)) {
                receitaVencida += valor;
              }
            }
          } else {
            clientesAtivos++;
            // Calcular receita ativa baseada no plano
            if (cliente.plano && planosMap.has(cliente.plano)) {
              const plano = planosMap.get(cliente.plano)!;
              const valorStr = plano.valor.replace(/[R$\s]/g, '').replace(',', '.');
              const valor = parseFloat(valorStr);
              if (!isNaN(valor)) {
                receitaAtiva += valor;
              }
            }
          }
        });

        const totalClientes = clientesAtivos + clientesVencidos;
        const percentual = totalClientes > 0 ? ((clientesVencidos / totalClientes) * 100) : 0;

        return {
          nome: produto.nome,
          clientesAtivos,
          receitaAtiva,
          clientesVencidos,
          receitaVencida,
          percentual: percentual > 0 ? -percentual : 0 // Negativo para indicar perda
        };
      });

      setMetricasProdutos(metricas);

      // Calcular resumo geral
      const dataInicialDate = dataInicial ? new Date(dataInicial) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dataFinalDate = dataFinal ? new Date(dataFinal) : new Date();
      
      // Clientes ativos no início e final do período
      const clientesAtivosTodos = clientes.filter(c => {
        const dataVencimento = c.data_vencimento ? new Date(c.data_vencimento) : null;
        return !dataVencimento || dataVencimento >= new Date();
      });

      const clientesNovos = clientes.filter(c => {
        const dataCriacao = new Date(c.created_at || '');
        return dataCriacao >= dataInicialDate && dataCriacao <= dataFinalDate;
      });

      const clientesVencidosTodos = clientes.filter(c => {
        const dataVencimento = c.data_vencimento ? new Date(c.data_vencimento) : null;
        return dataVencimento && dataVencimento < new Date();
      });

      // Calcular faturamento
      let faturamentoNovos = 0;
      let faturamentoPerdidos = 0;
      let receitaPeriodo = 0;

      clientesNovos.forEach(cliente => {
        if (cliente.plano && planosMap.has(cliente.plano)) {
          const plano = planosMap.get(cliente.plano)!;
          const valorStr = plano.valor.replace(/[R$\s]/g, '').replace(',', '.');
          const valor = parseFloat(valorStr);
          if (!isNaN(valor)) {
            faturamentoNovos += valor;
            receitaPeriodo += valor;
          }
        }
      });

      clientesVencidosTodos.forEach(cliente => {
        if (cliente.plano && planosMap.has(cliente.plano)) {
          const plano = planosMap.get(cliente.plano)!;
          const valorStr = plano.valor.replace(/[R$\s]/g, '').replace(',', '.');
          const valor = parseFloat(valorStr);
          if (!isNaN(valor)) {
            faturamentoPerdidos += valor;
          }
        }
      });

      const totalClientes = clientes.length;
      const percentualGanho = totalClientes > 0 ? (clientesNovos.length / totalClientes) * 100 : 0;
      const percentualPerda = totalClientes > 0 ? (clientesVencidosTodos.length / totalClientes) * 100 : 0;

      setResumo({
        ativosInicio: clientesAtivosTodos.length - clientesNovos.length,
        ativosFinal: clientesAtivosTodos.length,
        novos: clientesNovos.length,
        perdidos: clientesVencidosTodos.length,
        faturamentoInicio: metricas.reduce((acc, m) => acc + m.receitaAtiva, 0) - faturamentoNovos,
        faturamentoNovos,
        faturamentoPerdidos,
        receitaPeriodo,
        percentualGanho,
        percentualPerda
      });

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLimpar = () => {
    setProduto("todos");
    setDataInicial("");
    setDataFinal("");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando métricas...</p>
      </div>
    );
  }

  return (
    <main className="space-y-6">
      {/* Filtros */}
      <div className="flex items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="produto" className="text-foreground">Produto</Label>
          <Select value={produto} onValueChange={setProduto}>
            <SelectTrigger className="w-[200px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {produtos.map(produto => (
                <SelectItem key={produto.id} value={produto.id!}>
                  {produto.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="data-inicial" className="text-foreground">Data Inicial</Label>
          <Input
            id="data-inicial"
            type="date"
            value={dataInicial}
            onChange={(e) => setDataInicial(e.target.value)}
            className="bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="data-final" className="text-foreground">Data Final</Label>
          <Input
            id="data-final"
            type="date"
            value={dataFinal}
            onChange={(e) => setDataFinal(e.target.value)}
            className="bg-background"
          />
        </div>

        <Button 
          onClick={handleLimpar}
          className="bg-primary hover:bg-primary/90"
        >
          Limpar
        </Button>
      </div>

      {/* Resumo de Clientes e Faturamento */}
      <div className="rounded-lg overflow-hidden border bg-card">
        {/* Título com fundo azul */}
        <div className="bg-primary p-4">
          <h2 className="text-lg font-semibold text-primary-foreground">Resumo de Clientes e Faturamento</h2>
        </div>
        
        {/* Conteúdo com fundo normal */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Clientes */}
            <div>
              <h3 className="text-base font-medium mb-4 text-foreground">Clientes</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-foreground">Ativos no Início da Contagem:</span>
                  <span className="bg-muted px-2 py-1 rounded text-sm text-foreground">{resumo.ativosInicio}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground">Ativos no Final da Contagem:</span>
                  <span className="bg-muted px-2 py-1 rounded text-sm text-foreground">{resumo.ativosFinal}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground">Novos:</span>
                  <span className="bg-success px-2 py-1 rounded text-sm text-success-foreground">{resumo.novos}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground">Perdidos:</span>
                  <span className="bg-destructive px-2 py-1 rounded text-sm text-destructive-foreground">{resumo.perdidos}</span>
                </div>
              </div>
            </div>

            {/* Faturamento */}
            <div>
              <h3 className="text-base font-medium mb-4 text-foreground">Faturamento</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-foreground">Início da Contagem:</span>
                  <span className="bg-muted px-2 py-1 rounded text-sm text-foreground">{formatCurrency(resumo.faturamentoInicio)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground">Novos Clientes:</span>
                  <span className="bg-success px-2 py-1 rounded text-sm text-success-foreground">{formatCurrency(resumo.faturamentoNovos)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground">Clientes Não Renovados:</span>
                  <span className="bg-destructive px-2 py-1 rounded text-sm text-destructive-foreground">{formatCurrency(resumo.faturamentoPerdidos)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground">Receita no Período:</span>
                  <span className="bg-muted px-2 py-1 rounded text-sm text-foreground">{formatCurrency(resumo.receitaPeriodo)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Percentagens */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Percentagens</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex justify-between items-center py-2">
            <span className="text-foreground">% Ganho de Clientes:</span>
            <span className="bg-success text-success-foreground px-3 py-1 rounded">{resumo.percentualGanho.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-foreground">% Perda de Clientes:</span>
            <span className="bg-destructive text-destructive-foreground px-3 py-1 rounded">{resumo.percentualPerda.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Período filtrado */}
      {(dataInicial || dataFinal) && (
        <div className="text-sm text-muted-foreground">
          Filtrado de {formatDate(dataInicial) || "---"} até {formatDate(dataFinal) || "---"}
        </div>
      )}

      {/* Todos Os Produtos */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Todos Os Produtos</h3>
        
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-muted/50">
                <TableHead className="text-muted-foreground font-medium">Produto</TableHead>
                <TableHead className="text-muted-foreground font-medium">Clientes Ativos</TableHead>
                <TableHead className="text-muted-foreground font-medium">Receita Ativa</TableHead>
                <TableHead className="text-muted-foreground font-medium">Clientes Vencidos</TableHead>
                <TableHead className="text-muted-foreground font-medium">Receita Vencida</TableHead>
                <TableHead className="text-muted-foreground font-medium">Percentual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : metricasProdutos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado
                  </TableCell>
                </TableRow>
              ) : (
                metricasProdutos.map((metrica, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{metrica.nome}</TableCell>
                    <TableCell>{metrica.clientesAtivos}</TableCell>
                    <TableCell>{formatCurrency(metrica.receitaAtiva)}</TableCell>
                    <TableCell>{metrica.clientesVencidos}</TableCell>
                    <TableCell>{formatCurrency(metrica.receitaVencida)}</TableCell>
                    <TableCell className={metrica.percentual < 0 ? "text-destructive" : "text-success"}>
                      {metrica.percentual.toFixed(0)}%
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
