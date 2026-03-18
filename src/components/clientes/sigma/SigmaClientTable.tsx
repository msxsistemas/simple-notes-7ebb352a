import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SigmaCustomer } from "./types";

interface Props {
  customers: SigmaCustomer[];
  selectedIds: Set<string>;
  existingUsernames: Set<string>;
  allPageSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

export default function SigmaClientTable({ customers, selectedIds, existingUsernames, allPageSelected, onToggle, onToggleAll }: Props) {
  return (
    <ScrollArea className="h-[400px] border border-border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={allPageSelected} onCheckedChange={onToggleAll} />
            </TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Senha</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Telas</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map(c => {
            const isDuplicate = existingUsernames.has(c.username);
            return (
              <TableRow
                key={c.id}
                className={`cursor-pointer ${isDuplicate ? 'opacity-50' : ''}`}
                onClick={() => onToggle(c.id)}
              >
                <TableCell>
                  <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => onToggle(c.id)} />
                </TableCell>
                <TableCell className="font-medium">{c.name || '-'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.username}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.password ? '••••••' : '-'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {c.expires_at ? new Date(c.expires_at).toLocaleDateString('pt-BR') : '-'}
                </TableCell>
                <TableCell>{c.connections || 1}</TableCell>
                <TableCell>
                  {isDuplicate ? (
                    <Badge variant="secondary" className="text-xs">Já existe</Badge>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
