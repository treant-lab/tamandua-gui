import { AgentLogsViewer } from '../components/logs/AgentLogsViewer';

export function Logs() {
  return (
    <div className="sentinel-page">
      <div className="sentinel-page-head">
        <div>
          <div className="sentinel-kicker">Telemetry · Logs</div>
          <h1>Agent Logs</h1>
          <p>Logs returned by the agent IPC log buffer.</p>
        </div>
      </div>
      <AgentLogsViewer height={560} className="tamandua-log-viewer" />
    </div>
  );
}
