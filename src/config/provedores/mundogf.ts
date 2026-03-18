import { ProviderConfig } from "./types";

export const MUNDOGF_CONFIG: ProviderConfig = {
  id: 'mundogf',
  nome: 'MUNDOGF E FRANQUIAS',
  descricao: 'Painel MundoGF e Franquias',
  integrado: true,
  senhaLabel: 'Senha do Painel',
  senhaPlaceholder: 'sua_senha',
  nomePlaceholder: 'Ex: Meu Painel MundoGF',
  urlPlaceholder: 'https://cms.rboys02.click',
  usuarioPlaceholder: 'seu_usuario',
  loginEndpoint: '/login',
  loginMethod: 'POST',
  buildLoginPayload: (usuario: string, senha: string) => ({
    username: usuario,
    password: senha,
  }),
};
