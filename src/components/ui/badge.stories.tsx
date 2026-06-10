import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";
import { AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "success", "warning", "destructive", "secondary", "outline"],
    },
  },
  parameters: {
    docs: {
      description: {
        component: "Small label component for displaying status, categories, or counts.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: "Badge",
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};

export const SeverityLevels: Story = {
  name: "Severity Levels",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="destructive">Critical</Badge>
      <Badge variant="warning">High</Badge>
      <Badge variant="default">Medium</Badge>
      <Badge variant="secondary">Low</Badge>
      <Badge variant="outline">Info</Badge>
    </div>
  ),
};

export const WithIcons: Story = {
  name: "With Icons",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="destructive">
        <AlertCircle className="mr-1 h-3 w-3" />
        Error
      </Badge>
      <Badge variant="success">
        <CheckCircle className="mr-1 h-3 w-3" />
        Online
      </Badge>
      <Badge variant="warning">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Warning
      </Badge>
      <Badge variant="default">
        <Info className="mr-1 h-3 w-3" />
        Info
      </Badge>
    </div>
  ),
};

export const Statuses: Story = {
  name: "Status Examples",
  render: () => (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">Alert Status</p>
        <div className="flex gap-2">
          <Badge variant="destructive">Open</Badge>
          <Badge variant="warning">Investigating</Badge>
          <Badge variant="success">Resolved</Badge>
          <Badge variant="secondary">Closed</Badge>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Agent Status</p>
        <div className="flex gap-2">
          <Badge variant="success">Online</Badge>
          <Badge variant="warning">Degraded</Badge>
          <Badge variant="destructive">Offline</Badge>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Detection Type</p>
        <div className="flex gap-2">
          <Badge variant="default">YARA</Badge>
          <Badge variant="default">Sigma</Badge>
          <Badge variant="default">ML</Badge>
        </div>
      </div>
    </div>
  ),
};

export const Counts: Story = {
  name: "With Counts",
  render: () => (
    <div className="flex gap-2">
      <Badge variant="destructive">12</Badge>
      <Badge variant="warning">45</Badge>
      <Badge variant="default">123</Badge>
    </div>
  ),
};
