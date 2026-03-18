// Configuração específica por provedor
export interface ProviderConfig {
  id: string;
  nome: string;
  descricao: string;
  integrado: boolean;
  emManutencao?: boolean;
  // Campos do formulário
  senhaLabel?: string;
  senhaPlaceholder?: string;
  nomePlaceholder?: string;
  urlPlaceholder?: string;
  usuarioPlaceholder?: string;
  // Endpoint de login
  loginEndpoint?: string;
  loginMethod?: string;
  buildLoginPayload?: (usuario: string, senha: string) => Record<string, unknown>;
}

export interface Panel {
  id: string;
  nome: string;
  url: string;
  usuario: string;
  senha: string;
  status: 'Ativo' | 'Inativo';
  autoRenovacao: boolean;
  provedor?: string;
  dispositivo?: string | null;
  verificacaoStatus?: 'pendente' | 'verificado' | 'vinculado';
  dispositivoId?: string | null;
}
