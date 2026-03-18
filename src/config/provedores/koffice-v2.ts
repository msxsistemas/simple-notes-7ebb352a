import { ProviderConfig } from "./types";

export const KOFFICE_V2_CONFIG: ProviderConfig = {
  id: 'koffice-v2',
  nome: 'KOFFICE V2',
  descricao: 'Painel kOffice versão 2 (usuário/senha)',
  integrado: true,
  senhaLabel: 'Senha do Painel',
  senhaPlaceholder: 'sua_senha',
  nomePlaceholder: 'Ex: KOffice V2 Principal',
  urlPlaceholder: 'https://seupainel.koffice.com',
  usuarioPlaceholder: 'seu_usuario_koffice',
  loginEndpoint: '/api/login',
  loginMethod: 'POST',
  buildLoginPayload: (usuario: string, senha: string) => ({
    username: usuario,
    password: senha,
  }),
};
