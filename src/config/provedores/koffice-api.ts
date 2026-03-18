import { ProviderConfig } from "./types";

export const KOFFICE_API_CONFIG: ProviderConfig = {
  id: 'koffice-api',
  nome: 'KOFFICE API',
  descricao: 'Integração kOfficePanel API',
  integrado: true,
  senhaLabel: 'Chave da API',
  senhaPlaceholder: 'chave_api_koffice',
  nomePlaceholder: 'Ex: KOffice Principal, KOffice Backup, etc.',
  urlPlaceholder: 'https://seupainel.koffice.com',
  usuarioPlaceholder: 'seu_usuario_koffice',
  loginEndpoint: '/api/login',
  loginMethod: 'POST',
  buildLoginPayload: (usuario: string, senha: string) => ({
    username: usuario,
    api_key: senha,
  }),
};
