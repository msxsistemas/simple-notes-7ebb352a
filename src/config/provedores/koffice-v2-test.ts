import { TestStrategy } from "./test-types";

/**
 * Estratégia de teste do KOFFICE V2
 * 
 * O KOffice V2 usa autenticação via formulário HTML (POST com CSRF token)
 * no endpoint /login. Como fallback, tenta Xtream GET e JSON POST.
 */
export const KOFFICE_V2_TEST_STRATEGY: TestStrategy = {
  steps: [
    {
      type: 'form',
      endpoints: ['/login'],
      label: 'KOffice V2 Form Login',
    },
    {
      type: 'xtream',
      endpoints: ['/player_api.php', '/panel_api.php', '/api.php'],
      label: 'KOffice V2 Xtream Fallback',
    },
    {
      type: 'json-post',
      endpoints: ['/api/login'],
      label: 'KOffice V2 JSON API',
    },
  ],
};
