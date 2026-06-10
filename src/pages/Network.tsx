import { NetworkMonitor } from '../components/network';

export function Network() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Network Connections</h1>
        <p className="mt-1 text-gray-400">
          Live host sockets, TLS signals, reputation enrichment, and containment actions.
        </p>
      </div>
      <NetworkMonitor />
    </div>
  );
}
