export const VISUAL_SCENARIO_IDS = ['dashboard-offline', 'dashboard-error'] as const;

export type VisualScenarioId = (typeof VISUAL_SCENARIO_IDS)[number];
export type ScenarioTone = 'offline' | 'error';

export interface MutationDenial {
  readonly action: string;
  readonly code: 'fixture_denied';
  readonly decision: 'no_operation';
  readonly reason: 'visual_fixture_boundary';
}

export interface DashboardScenario {
  readonly id: VisualScenarioId;
  readonly route: '/dashboard';
  readonly tone: ScenarioTone;
  readonly heading: string;
  readonly summary: string;
  readonly agentLabel: string;
  readonly backendLabel: string;
  readonly statusCode: string;
  readonly detail: string;
  readonly metrics: {
    readonly alerts: 0;
    readonly collectors: 0;
    readonly uptime: '0m';
    readonly cpu: 0;
    readonly memory: 0;
  };
}

const frozenMetrics = Object.freeze({
  alerts: 0 as const,
  collectors: 0 as const,
  uptime: '0m' as const,
  cpu: 0 as const,
  memory: 0 as const,
});

export const MUTATION_DENIALS: readonly MutationDenial[] = Object.freeze([
  Object.freeze({
    action: 'start_scan',
    code: 'fixture_denied' as const,
    decision: 'no_operation' as const,
    reason: 'visual_fixture_boundary' as const,
  }),
  Object.freeze({
    action: 'isolate_network',
    code: 'fixture_denied' as const,
    decision: 'no_operation' as const,
    reason: 'visual_fixture_boundary' as const,
  }),
  Object.freeze({
    action: 'change_performance_profile',
    code: 'fixture_denied' as const,
    decision: 'no_operation' as const,
    reason: 'visual_fixture_boundary' as const,
  }),
]);

export const VISUAL_SCENARIOS: Readonly<Record<VisualScenarioId, DashboardScenario>> =
  Object.freeze({
    'dashboard-offline': Object.freeze({
      id: 'dashboard-offline',
      route: '/dashboard',
      tone: 'offline',
      heading: 'Endpoint unavailable',
      summary: 'This deterministic fixture does not contact an endpoint.',
      agentLabel: 'Agent service offline',
      backendLabel: 'Backend not queried',
      statusCode: 'FIXTURE_AGENT_OFFLINE',
      detail: 'No endpoint state is loaded. All displayed values are immutable local fixture data.',
      metrics: frozenMetrics,
    }),
    'dashboard-error': Object.freeze({
      id: 'dashboard-error',
      route: '/dashboard',
      tone: 'error',
      heading: 'Dashboard data unavailable',
      summary: 'A deterministic fixture error is active for visual validation.',
      agentLabel: 'Status unavailable',
      backendLabel: 'Backend not queried',
      statusCode: 'FIXTURE_SCENARIO_ERROR',
      detail: 'The synthetic error is local to this fixture and is not product runtime evidence.',
      metrics: frozenMetrics,
    }),
  });

export function resolveVisualScenario(value: string | null | undefined): DashboardScenario {
  const id = value ?? 'dashboard-offline';
  if (!VISUAL_SCENARIO_IDS.includes(id as VisualScenarioId)) {
    throw new Error(`fixture_denied: unknown visual scenario "${id}"`);
  }
  return VISUAL_SCENARIOS[id as VisualScenarioId];
}
