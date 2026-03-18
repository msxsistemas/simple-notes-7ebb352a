import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileSpreadsheet, Check, Users, Server } from "lucide-react";

interface ImportClientesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportPlanilha: () => void;
  onImportComplete: () => void;
  onImportSigma?: () => void;
}

export default function ImportClientesDialog({ open, onOpenChange, onImportPlanilha, onImportSigma }: ImportClientesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Importar Clientes
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 grid grid-cols-2 gap-3">
          {/* Importar via Planilha */}
          <button
            onClick={() => { onOpenChange(false); onImportPlanilha(); }}
            className="relative flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-border bg-card hover:border-primary/50 hover:bg-accent/30 transition-all text-left group w-full"
          >
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-semibold text-foreground">Importar via Planilha</h3>
              <p className="text-xs text-muted-foreground">Faça upload de um arquivo CSV com os dados dos seus clientes</p>
            </div>
            <ul className="space-y-1.5 w-full text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500" />Importação em massa</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500" />Até 1.000 clientes</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500" />Validação automática</li>
            </ul>
          </button>

          {/* Importar do Sigma */}
          {onImportSigma && (
            <button
              onClick={() => { onOpenChange(false); onImportSigma(); }}
              className="relative flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-border bg-card hover:border-primary/50 hover:bg-accent/30 transition-all text-left group w-full h-full"
            >
              <div className="h-14 w-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Server className="h-7 w-7 text-blue-500" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-semibold text-foreground">Importar do Sigma</h3>
                <p className="text-xs text-muted-foreground">Importe clientes diretamente do seu painel Sigma</p>
              </div>
              <ul className="space-y-1.5 w-full text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500" />Sincronização direta</li>
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500" />Dados atualizados do painel</li>
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500" />Importação automática</li>
              </ul>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
