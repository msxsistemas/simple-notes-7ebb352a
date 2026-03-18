import { TestStrategy } from "./test-types";

/**
 * Estratégia de teste universal (fallback para provedores sem estratégia definida)
 * Tenta todos os métodos em sequência.
 */
export const DEFAULT_TEST_STRATEGY: TestStrategy = {
  steps: [
    {
      type: 'xtream',
      endpoints: ['/player_api.php', '/panel_api.php', '/api.php'],
      label: 'Xtream API Discovery',
    },
    {
      type: 'form',
      endpoints: ['/login'],
      label: 'HTML Form Login',
    },
    {
      type: 'json-post',
      endpoints: ['/api/auth/login', '/api/login', '/api/v1/login', '/api/v1/auth/login', '/auth/login', '/login', '/admin/login'],
      label: 'JSON POST Login',
    },
  ],
};
