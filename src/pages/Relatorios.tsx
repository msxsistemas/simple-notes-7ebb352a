import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const mesesNomes = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

interface DadosMensais {
  mes: string;
  vendas: number;
  entradas: number;
  saidas: number;
  custosServidor: number;
  saldoLiquido: number;
}

export default function Relatorios() {
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear().toString());
  const { transacoes, loading } = useFinanceiro();
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 5 }, (_, i) => (anoAtual - i).toString());

  useEffect(() => {
    document.title = "Relatórios | Gestor Tech Play";
  }, []);

  // Calcular dados mensais baseado nas transações
  const dadosMensais = useMemo(() => {
    const resultado: DadosMensais[] = mesesNomes.map((mes) => ({
      mes: mes.substring(0, 3),
      vendas: 0,
      entradas: 0,
      saidas: 0,
      custosServidor: 0,
      saldoLiquido: 0,
    }));

    transacoes.forEach((transacao) => {
      // Extrair mês e ano da data formatada (ex: "01/02/2026, 10:30")
      const dataStr = transacao.data.split(',')[0].trim();
      const [dia, mes, ano] = dataStr.split('/');
      
      if (ano === anoSelecionado) {
        const mesIndex = parseInt(mes, 10) - 1;
        if (mesIndex >= 0 && mesIndex < 12) {
          if (transacao.tipo === 'entrada') {
            resultado[mesIndex].entradas += transacao.valor;
            resultado[mesIndex].vendas += transacao.valor;
          } else {
            resultado[mesIndex].saidas += transacao.valor;
            // Considerar custos servidor: transações de produtos (custo de créditos/painéis) ou que mencionam "servidor"
            if (transacao.detalheTitulo === 'Produto' || 
                transacao.detalheTitulo?.toLowerCase().includes('servidor') || 
                transacao.descricao?.toLowerCase().includes('servidor')) {
              resultado[mesIndex].custosServidor += transacao.valor;
            }
          }
        }
      }
    });

    // Calcular saldo líquido
    resultado.forEach((mes) => {
      mes.saldoLiquido = mes.entradas - mes.saidas;
    });

    return resultado;
  }, [transacoes, anoSelecionado]);

  // Dados detalhados por mês
  const dadosDetalhados = useMemo(() => {
    return mesesNomes.map((mes, index) => {
      const dados = dadosMensais[index];
      return {
        nome: mes,
        vendas: dados?.vendas || 0,
        entradas: dados?.entradas || 0,
        saidas: dados?.saidas || 0,
        custosServidor: dados?.custosServidor || 0,
        saldoLiquido: dados?.saldoLiquido || 0,
      };
    });
  }, [dadosMensais]);

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando relatórios...</p>
      </div>
    );
  }

  return (
    <main className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Relatórios Financeiros</h1>
          <p className="text-sm text-muted-foreground">Gráficos e detalhes das suas vendas e custos</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ano:</span>
          <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anos.map((ano) => (
                <SelectItem key={ano} value={ano}>
                  {ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Gráfico Financeiro */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Gráfico Financeiro</h2>
            <p className="text-sm text-muted-foreground">Abaixo está o total das suas Vendas e Custos por Servidor.</p>
          </div>

          <div className="h-[400px] w-full">
            {loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Carregando...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosMensais} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="mes" 
                    stroke="#eab308"
                    axisLine={{ stroke: '#eab308', strokeWidth: 2 }}
                    tickLine={{ stroke: '#eab308' }}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f8fafc'
                    }}
                    labelStyle={{ color: '#f8fafc' }}
                    formatter={(value: number, name: string) => {
                      const color = name === 'Vendas' ? '#22c55e' : '#d946ef';
                      return [<span style={{ color }}>{formatarValor(value)}</span>, <span style={{ color }}>{name}</span>];
                    }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Legend />
                  <Bar dataKey="vendas" name="Vendas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="custosServidor" name="Custos Servidores" fill="#d946ef" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Total Financeiro Detalhado */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Total Financeiro Detalhado</h2>
            <p className="text-sm text-muted-foreground">Detalhamento mensal das suas Vendas e Custos por Servidor.</p>
          </div>

          {/* Grid de meses */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {dadosDetalhados.map((mes, index) => (
              <Card key={index} className="bg-background border-border">
                <CardContent className="p-4">
                  <h3 className="text-center font-semibold text-foreground mb-4 pb-2 border-b border-border">
                    {mes.nome}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-success">Vendas:</span>
                      <span className="text-success">{formatarValor(mes.vendas)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Custos Servidor:</span>
                      <span className="text-muted-foreground">{formatarValor(mes.custosServidor)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border mt-2">
                      <span className="text-primary font-medium">Saldo Líquido:</span>
                      <span className="text-primary font-medium">{formatarValor(mes.saldoLiquido)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
