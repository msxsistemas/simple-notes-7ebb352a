import { TestStrategy } from "./test-types";

/**
 * Estratégia de teste do KOFFICE API
 * 
 * O KOffice API usa autenticação Xtream (GET com parâmetros username/password)
 * nos endpoints player_api.php, panel_api.php, api.php.
 * Como fallback, tenta login via formulário HTML e JSON POST.
 */
export const KOFFICE_API_TEST_STRATEGY: TestStrategy = {
  steps: [
    {
      type: 'xtream',
      endpoints: ['/player_api.php', '/panel_api.php', '/api.php'],
      label: 'KOffice Xtream API',
    },
    {
      type: 'form',
      endpoints: ['/login'],
      label: 'KOffice Form Login',
    },
    {
      type: 'json-post',
      endpoints: ['/api/login', '/api/v1/login'],
      label: 'KOffice JSON API',
    },
  ],
};
