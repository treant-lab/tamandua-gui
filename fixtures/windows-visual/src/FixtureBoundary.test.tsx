import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FixtureBoundary } from './FixtureBoundary';
import {
  MUTATION_DENIALS,
  VISUAL_SCENARIO_IDS,
  resolveVisualScenario,
} from './scenarios';

afterEach(cleanup);

describe('GUI-FIXTURE-14 boundary', () => {
  it.each(VISUAL_SCENARIO_IDS)('renders an unmistakable boundary for %s', (scenarioId) => {
    const { container } = render(<FixtureBoundary scenario={resolveVisualScenario(scenarioId)} />);

    expect(screen.getByText('VISUAL FIXTURE · NO ENDPOINT ACTIONS')).toBeVisible();
    expect(
      screen.getByText('browser fixture — not native Tauri/WebView2 runtime'),
    ).toBeVisible();
    expect(container.firstElementChild).toHaveAttribute('data-fixture-boundary', 'isolated');
    expect(container.firstElementChild).toHaveAttribute('data-mutation-boundary', 'fixture_denied');
    expect(container.firstElementChild).toHaveAttribute('data-scenario-id', scenarioId);
    expect(screen.getByText('not runtime evidence')).toBeVisible();
    expect(screen.getByText('Backend not queried')).toBeVisible();
  });

  it('rejects every scenario outside the exact allowlist', () => {
    expect(() => resolveVisualScenario('dashboard-success')).toThrow(/fixture_denied/);
    expect(() => resolveVisualScenario('../dashboard-offline')).toThrow(/fixture_denied/);
  });

  it('represents every canary mutation as a disabled no-operation', () => {
    render(<FixtureBoundary scenario={resolveVisualScenario('dashboard-offline')} />);

    expect(MUTATION_DENIALS).toHaveLength(3);
    for (const denial of MUTATION_DENIALS) {
      expect(denial).toEqual({
        action: denial.action,
        code: 'fixture_denied',
        decision: 'no_operation',
        reason: 'visual_fixture_boundary',
      });
      expect(screen.getByRole('button', { name: `${denial.action} denied` })).toBeDisabled();
    }
  });
});
