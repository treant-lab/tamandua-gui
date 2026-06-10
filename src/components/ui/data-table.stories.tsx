import type { Meta, StoryObj } from "@storybook/react";
import { DataTable } from "./data-table";
import { Badge } from "./badge";
import type { ColumnDef } from "@tanstack/react-table";

interface Alert {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  agent: string;
  timestamp: string;
  status: "open" | "investigating" | "resolved";
}

const alerts: Alert[] = [
  { id: "ALT-001", title: "Ransomware Detected", severity: "critical", agent: "WS-001", timestamp: "2024-01-15 10:30:00", status: "open" },
  { id: "ALT-002", title: "Suspicious PowerShell", severity: "high", agent: "WS-002", timestamp: "2024-01-15 10:25:00", status: "investigating" },
  { id: "ALT-003", title: "Unusual Network Activity", severity: "medium", agent: "SRV-001", timestamp: "2024-01-15 10:20:00", status: "open" },
  { id: "ALT-004", title: "Failed Login Attempt", severity: "low", agent: "WS-003", timestamp: "2024-01-15 10:15:00", status: "resolved" },
  { id: "ALT-005", title: "Malware Signature Match", severity: "critical", agent: "WS-004", timestamp: "2024-01-15 10:10:00", status: "open" },
  { id: "ALT-006", title: "Process Injection", severity: "high", agent: "SRV-002", timestamp: "2024-01-15 10:05:00", status: "investigating" },
  { id: "ALT-007", title: "Registry Modification", severity: "medium", agent: "WS-005", timestamp: "2024-01-15 10:00:00", status: "open" },
  { id: "ALT-008", title: "Unauthorized Access", severity: "high", agent: "WS-006", timestamp: "2024-01-15 09:55:00", status: "open" },
  { id: "ALT-009", title: "Data Exfiltration", severity: "critical", agent: "SRV-003", timestamp: "2024-01-15 09:50:00", status: "investigating" },
  { id: "ALT-010", title: "Privilege Escalation", severity: "high", agent: "WS-007", timestamp: "2024-01-15 09:45:00", status: "open" },
  { id: "ALT-011", title: "Suspicious DLL Load", severity: "medium", agent: "WS-008", timestamp: "2024-01-15 09:40:00", status: "resolved" },
  { id: "ALT-012", title: "Crypto Mining Activity", severity: "medium", agent: "SRV-004", timestamp: "2024-01-15 09:35:00", status: "open" },
];

const getSeverityVariant = (severity: string) => {
  switch (severity) {
    case "critical": return "destructive";
    case "high": return "warning";
    case "medium": return "default";
    default: return "secondary";
  }
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case "open": return "destructive";
    case "investigating": return "warning";
    case "resolved": return "success";
    default: return "secondary";
  }
};

const columns: ColumnDef<Alert>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("id")}</span>,
  },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => (
      <Badge variant={getSeverityVariant(row.getValue("severity")) as any}>
        {row.getValue("severity")}
      </Badge>
    ),
  },
  {
    accessorKey: "title",
    header: "Title",
  },
  {
    accessorKey: "agent",
    header: "Agent",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={getStatusVariant(row.getValue("status")) as any}>
        {row.getValue("status")}
      </Badge>
    ),
  },
  {
    accessorKey: "timestamp",
    header: "Time",
    cell: ({ row }) => <span className="text-muted-foreground">{row.getValue("timestamp")}</span>,
  },
];

const meta: Meta<typeof DataTable> = {
  title: "UI/DataTable",
  component: DataTable,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Data table component with sorting and pagination built on TanStack Table.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DataTable>;

export const Default: Story = {
  render: () => <DataTable columns={columns} data={alerts} />,
};

export const WithPagination: Story = {
  name: "With Pagination",
  render: () => <DataTable columns={columns} data={alerts} pageSize={5} />,
};

export const SmallPageSize: Story = {
  name: "Small Page Size",
  render: () => <DataTable columns={columns} data={alerts} pageSize={3} />,
};

export const EmptyState: Story = {
  name: "Empty State",
  render: () => <DataTable columns={columns} data={[]} />,
};

export const SingleItem: Story = {
  name: "Single Item",
  render: () => <DataTable columns={columns} data={[alerts[0]]} />,
};
