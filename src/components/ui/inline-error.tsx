import { AlertTriangle } from "lucide-react";

interface InlineErrorProps {
  message: string | null | undefined;
  className?: string;
}

export function InlineError({ message, className = "" }: InlineErrorProps) {
  if (!message) return null;
  return (
    <div className={`flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3 animate-fade-in ${className}`}>
      <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}
