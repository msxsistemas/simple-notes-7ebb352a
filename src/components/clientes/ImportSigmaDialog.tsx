import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Server, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useSigmaImport } from "./sigma/useSigmaImport";
import SigmaClientTable from "./sigma/SigmaClientTable";

interface ImportSigmaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export default function ImportSigmaDialog({ open, onOpenChange, onImportComplete }: ImportSigmaDialogProps) {
  const {
    step, setStep,
    paineis, selectedPainelId, setSelectedPainelId,
    customers, selectedIds, page, total, totalPages,
    loadingPaineis, importingCount,
    existingUsernames, allPageSelected,
    statusFilter, setStatusFilter,
    handleLoadClients, toggleSelect, toggleAll, handleImport,
  } = useSigmaImport(open, onImportComplete, () => onOpenChange(false));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Importar do Sigma
          </DialogTitle>
          <DialogDescription>Selecione um painel e escolha os clientes para importar.</DialogDescription>
        </DialogHeader>

        {step === 'select-panel' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selecione o painel Sigma</Label>
              {loadingPaineis ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando painéis...
                </div>
              ) : paineis.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 border border-border rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  Nenhum painel Sigma configurado. Configure um painel em Servidores → Sigma.
                </div>
              ) : (
                <Select value={selectedPainelId} onValueChange={setSelectedPainelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um painel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {paineis.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome} — {p.url}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button disabled={!selectedPainelId} onClick={() => handleLoadClients(1)}>
                Buscar Clientes
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Conectando ao painel e buscando clientes...</p>
          </div>
        )}

        {step === 'select-clients' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">{total} clientes encontrados</p>
                <Select value={statusFilter} onValueChange={(v) => handleLoadClients(1, v)}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Apenas Ativos</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="outline">{selectedIds.size} selecionados</Badge>
            </div>

            <SigmaClientTable
              customers={customers}
              selectedIds={selectedIds}
              existingUsernames={existingUsernames}
              allPageSelected={allPageSelected}
              onToggle={toggleSelect}
              onToggleAll={toggleAll}
            />

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => handleLoadClients(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => handleLoadClients(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('select-panel')}>Voltar</Button>
              <Button disabled={selectedIds.size === 0} onClick={handleImport}>
                Importar {selectedIds.size} cliente{selectedIds.size !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Importando {importingCount} de {selectedIds.size} clientes...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
