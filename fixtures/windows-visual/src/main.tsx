import React from 'react';
import ReactDOM from 'react-dom/client';
import { FixtureBoundary } from './FixtureBoundary';
import { resolveVisualScenario } from './scenarios';
import './fixture.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('fixture_denied: missing visual fixture root');
}

const scenarioId = new URLSearchParams(window.location.search).get('scenario');

try {
  const scenario = resolveVisualScenario(scenarioId);
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <FixtureBoundary scenario={scenario} />
    </React.StrictMode>,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : 'fixture_denied: invalid scenario';
  root.innerHTML = '';
  const boundary = document.createElement('main');
  boundary.className = 'fixture-invalid';
  boundary.dataset.fixtureBoundary = 'denied';
  const banner = document.createElement('strong');
  banner.textContent = 'VISUAL FIXTURE · NO ENDPOINT ACTIONS';
  const detail = document.createElement('code');
  detail.textContent = message;
  boundary.append(banner, detail);
  root.append(boundary);
}
