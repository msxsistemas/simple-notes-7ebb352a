import { ProviderConfig } from "./types";

// Base URL fixa da API Playfast
export const PLAYFAST_API_BASE = 'https://api.painelcliente.com';

export const PLAYFAST_CONFIG: ProviderConfig = {
  id: 'playfast',
  nome: 'PLAYFAST',
  descricao: 'Painel IPTV Playfast',
  integrado: true,
  senhaLabel: 'Secret (Chave Secreta)',
  senhaPlaceholder: 'Sua chave secreta de autenticação',
  nomePlaceholder: 'Ex: Meu Painel Playfast',
  urlPlaceholder: 'https://api.painelcliente.com',
  usuarioPlaceholder: 'TOKEN fornecido pelo painel',
  loginEndpoint: '/profile',
  loginMethod: 'POST',
  buildLoginPayload: (_usuario: string, senha: string) => ({
    secret: senha,
  }),
};
