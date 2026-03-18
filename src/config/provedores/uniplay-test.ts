import { TestStrategy } from "./test-types";

/**
 * Estratégia de teste do UNIPLAY E FRANQUIAS
 *
 * O Uniplay usa autenticação via JSON POST com JWT (Bearer token).
 * API base em gesapioffice.com, endpoint /api/login.
 */
export const UNIPLAY_TEST_STRATEGY: TestStrategy = {
  steps: [
    {
      type: 'json-post',
      endpoints: ['/api/login'],
      label: 'Uniplay JWT API',
    },
  ],
};
