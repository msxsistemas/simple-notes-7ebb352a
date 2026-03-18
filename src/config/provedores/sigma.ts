import { ProviderConfig } from "./types";

export const SIGMA_CONFIG: ProviderConfig = {
  id: 'sigma',
  nome: 'Sigma',
  descricao: 'Integração via API direta com painéis Sigma',
  integrado: true,
  senhaLabel: 'Senha',
  senhaPlaceholder: 'Sua senha do painel',
  nomePlaceholder: 'Ex: Slim Principal, Slim Backup, etc.',
  urlPlaceholder: 'https://seupainel.site',
  usuarioPlaceholder: 'seu_email@exemplo.com',
  loginEndpoint: '/api/auth/login',
  loginMethod: 'POST',
  buildLoginPayload: (usuario: string, senha: string) => ({
    username: usuario,
    password: senha,
    captcha: 'not-a-robot',
    captchaChecked: true,
    twofactor_code: '',
    twofactor_recovery_code: '',
    twofactor_trusted_device_id: '',
  }),
};
