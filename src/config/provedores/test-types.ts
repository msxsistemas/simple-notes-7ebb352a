// Estratégia de teste para cada provedor
// Define quais métodos de autenticação tentar e em qual ordem

export interface TestStrategy {
  /** Métodos a tentar, em ordem */
  steps: TestStep[];
}

export interface TestStep {
  type: 'xtream' | 'form' | 'json-post';
  /** Endpoints a tentar neste passo */
  endpoints?: string[];
  /** Descrição para logs */
  label: string;
}
