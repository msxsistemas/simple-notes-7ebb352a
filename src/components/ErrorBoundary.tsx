import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="bg-card border border-border/30 m-4">
          <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
            <AlertTriangle className="h-10 w-10 text-yellow-500" />
            <h2 className="text-lg font-semibold text-foreground">
              {this.props.fallbackMessage || "Algo deu errado ao renderizar esta página."}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Isso pode ser causado por uma extensão do navegador interferindo na página.
              Tente desabilitar extensões ou recarregar.
            </p>
            <div className="flex gap-3">
              <Button onClick={this.handleRetry} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
              <Button onClick={() => window.location.reload()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Recarregar página
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
