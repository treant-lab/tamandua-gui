import type { Meta, StoryObj } from "@storybook/react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { Badge } from "./badge";

const meta: Meta<typeof Table> = {
  title: "UI/Table",
  component: Table,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Presentational table component for displaying structured data.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Table>;

const alerts = [
  { id: "ALT-001", severity: "critical", title: "Ransomware Detected", agent: "WS-001", time: "2 min ago" },
  { id: "ALT-002", severity: "high", title: "Suspicious PowerShell", agent: "WS-002", time: "5 min ago" },
  { id: "ALT-003", severity: "medium", title: "Unusual Network Activity", agent: "SRV-001", time: "15 min ago" },
  { id: "ALT-004", severity: "low", title: "Failed Login Attempt", agent: "WS-003", time: "1 hour ago" },
];

const getSeverityVariant = (severity: string) => {
  switch (severity) {
    case "critical": return "destructive";
    case "high": return "warning";
    case "medium": return "default";
    default: return "secondary";
  }
};

export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>A list of recent alerts.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">ID</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead className="text-right">Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {alerts.map((alert) => (
          <TableRow key={alert.id}>
            <TableCell className="font-medium">{alert.id}</TableCell>
            <TableCell>
              <Badge variant={getSeverityVariant(alert.severity) as any}>
                {alert.severity}
              </Badge>
            </TableCell>
            <TableCell>{alert.title}</TableCell>
            <TableCell>{alert.agent}</TableCell>
            <TableCell className="text-right">{alert.time}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const WithFooter: Story = {
  name: "With Footer",
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Agent</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Alerts (24h)</TableHead>
          <TableHead className="text-right">Last Seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">WS-001</TableCell>
          <TableCell><Badge variant="success">Online</Badge></TableCell>
          <TableCell>12</TableCell>
          <TableCell className="text-right">Just now</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">WS-002</TableCell>
          <TableCell><Badge variant="success">Online</Badge></TableCell>
          <TableCell>5</TableCell>
          <TableCell className="text-right">2 min ago</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">SRV-001</TableCell>
          <TableCell><Badge variant="warning">Degraded</Badge></TableCell>
          <TableCell>28</TableCell>
          <TableCell className="text-right">5 min ago</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Total Agents: 3</TableCell>
          <TableCell>45</TableCell>
          <TableCell className="text-right">Total Alerts</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};

export const EmptyState: Story = {
  name: "Empty State",
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={3} className="h-24 text-center">
            No results found.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
