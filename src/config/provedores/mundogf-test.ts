import { TestStrategy } from "./test-types";

/**
 * Estratégia de teste do MUNDOGF E FRANQUIAS
 *
 * Painel Laravel com autenticação via formulário HTML (CSRF + session cookie).
 * POST /login com _token, username, password (form-urlencoded).
 * Verificação via /bonus/stats após login.
 */
export const MUNDOGF_TEST_STRATEGY: TestStrategy = {
  steps: [
    {
      type: 'form',
      endpoints: ['/login'],
      label: 'MundoGF Form Login (Laravel)',
    },
  ],
};
