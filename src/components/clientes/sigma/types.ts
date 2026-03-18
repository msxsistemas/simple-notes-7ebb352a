export interface SigmaCustomer {
  id: string;
  username: string;
  password?: string;
  name?: string;
  expires_at?: string;
  status?: string;
  connections?: number;
  package_id?: string;
  package?: string;
  whatsapp?: string;
  email?: string;
  mac_address?: string;
  server?: string;
}

export interface PainelIntegracao {
  id: string;
  nome: string;
  url: string;
  usuario: string;
  senha: string;
  provedor: string;
}
