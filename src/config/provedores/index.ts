// Re-export types
export type { ProviderConfig, Panel } from "./types";
export type { TestStrategy, TestStep } from "./test-types";

// Re-export configs individuais
export { KOFFICE_API_CONFIG } from "./koffice-api";
export { KOFFICE_V2_CONFIG } from "./koffice-v2";
export { MUNDOGF_CONFIG } from "./mundogf";
export { UNIPLAY_CONFIG } from "./uniplay";
export { PLAYFAST_CONFIG } from "./playfast";
export { UNITV_CONFIG } from "./unitv";
export { SIGMA_CONFIG } from "./sigma";

export { PROVEDORES_NAO_INTEGRADOS } from "./outros";

// Re-export estratégias de teste individuais
export { KOFFICE_API_TEST_STRATEGY } from "./koffice-api-test";
export { KOFFICE_V2_TEST_STRATEGY } from "./koffice-v2-test";
export { MUNDOGF_TEST_STRATEGY } from "./mundogf-test";

export { PLAYFAST_TEST_STRATEGY } from "./playfast-test";
export { SIGMA_TEST_STRATEGY } from "./sigma-test";

export { DEFAULT_TEST_STRATEGY } from "./default-test";

// Importações para montar a lista unificada
import { KOFFICE_API_CONFIG } from "./koffice-api";
import { KOFFICE_V2_CONFIG } from "./koffice-v2";
import { MUNDOGF_CONFIG } from "./mundogf";
import { UNIPLAY_CONFIG } from "./uniplay";
import { PLAYFAST_CONFIG } from "./playfast";
import { UNITV_CONFIG } from "./unitv";
import { SIGMA_CONFIG } from "./sigma";

import { PROVEDORES_NAO_INTEGRADOS } from "./outros";
import { ProviderConfig } from "./types";
import { TestStrategy } from "./test-types";
import { KOFFICE_API_TEST_STRATEGY } from "./koffice-api-test";
import { KOFFICE_V2_TEST_STRATEGY } from "./koffice-v2-test";
import { MUNDOGF_TEST_STRATEGY } from "./mundogf-test";

import { PLAYFAST_TEST_STRATEGY } from "./playfast-test";
import { SIGMA_TEST_STRATEGY } from "./sigma-test";

import { DEFAULT_TEST_STRATEGY } from "./default-test";

// Lista unificada de todos os provedores
export const PROVEDORES: ProviderConfig[] = [
  KOFFICE_API_CONFIG,
  KOFFICE_V2_CONFIG,
  MUNDOGF_CONFIG,
  UNIPLAY_CONFIG,
  PLAYFAST_CONFIG,
  UNITV_CONFIG,
  SIGMA_CONFIG,
  ...PROVEDORES_NAO_INTEGRADOS,
];

// Mapa de estratégias de teste por provedor
export const TEST_STRATEGIES: Record<string, TestStrategy> = {
  'koffice-api': KOFFICE_API_TEST_STRATEGY,
  'koffice-v2': KOFFICE_V2_TEST_STRATEGY,
  'mundogf': MUNDOGF_TEST_STRATEGY,
  'playfast': PLAYFAST_TEST_STRATEGY,
  'sigma': SIGMA_TEST_STRATEGY,
};

/** Retorna a estratégia de teste para um provedor (ou a default) */
export function getTestStrategy(providerId: string): TestStrategy {
  return TEST_STRATEGIES[providerId] || DEFAULT_TEST_STRATEGY;
}
