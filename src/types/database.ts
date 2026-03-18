export interface Cliente {
  id?: string;
  nome: string;
  whatsapp: string;
  email: string;
  data_vencimento: string;
  fixo: boolean;
  usuario: string;
  senha: string;
  produto: string;
  plano: string;
  app: string;
  data_venc_app: string;
  telas: number;
  mac: string;
  dispositivo: string;
  fatura: string;
  key: string;
  mensagem: string;
  lembretes: boolean;
  indicador: string;
  desconto: string;
  desconto_recorrente: boolean;
  aniversario: string;
  observacao: string;
  user_id?: string;
  created_at?: string;
}

export interface Aplicativo {
  id?: string;
  nome: string;
  descricao: string;
  user_id?: string;
  created_at?: string;
}

export interface Plano {
  id?: string;
  nome: string;
  valor: string;
  tipo: string;
  quantidade: string;
  descricao: string;
  user_id?: string;
  created_at?: string;
}

export interface Produto {
  id?: string;
  nome: string;
  valor: string;
  creditos: string;
  descricao: string;
  configuracoes_iptv: boolean;
  provedor_iptv: string;
  renovacao_automatica: boolean;
  user_id?: string;
  created_at?: string;
}

export interface TemplateCobranca {
  id?: string;
  nome: string;
  mensagem: string;
  incluir_cartao: boolean;
  incluir_chave_pix: boolean;
  chave_pix: string;
  midia_path?: string;
  user_id?: string;
  created_at?: string;
}

export interface MensagensPadroes {
  id?: string;
  confirmacao_cliente: string;
  expiracao_app: string;
  aniversario_cliente: string;
  user_id?: string;
  updated_at?: string;
}

export interface Configuracoes {
  id?: number;
  cobrancas_ativas: boolean;
  user_id?: string;
  updated_at?: string;
}

export interface CheckoutConfig {
  id?: string;
  user_id?: string;
  pix_enabled: boolean;
  credit_card_enabled: boolean;
  pix_manual_enabled: boolean;
  pix_manual_key?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Transacao {
  id?: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  descricao: string;
  data_transacao?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}
