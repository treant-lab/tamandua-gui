import type { Meta, StoryObj } from "@storybook/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Button } from "./button";
import { Badge } from "./badge";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Container component for grouping related content. Supports header, content, and footer slots.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card Description</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content goes here. This is a basic card example.</p>
      </CardContent>
    </Card>
  ),
};

export const WithHeader: Story = {
  name: "With Header",
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Alert Summary</CardTitle>
        <CardDescription>Last 24 hours activity</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Critical</span>
            <span className="font-semibold text-error-500">3</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">High</span>
            <span className="font-semibold text-warning-500">12</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Medium</span>
            <span className="font-semibold text-primary-500">45</span>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
};

export const WithFooter: Story = {
  name: "With Footer",
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Agent Status</CardTitle>
        <CardDescription>WS-001 workstation</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success-500" />
          <span>Online</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Last heartbeat: 2 seconds ago
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">View Details</Button>
      </CardFooter>
    </Card>
  ),
};

export const Complete: Story = {
  name: "Complete Example",
  render: () => (
    <Card className="w-[400px]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Threat Detected</CardTitle>
          <Badge variant="destructive">Critical</Badge>
        </div>
        <CardDescription>ALT-2024-001234</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Threat Type</dt>
            <dd>Ransomware</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Agent</dt>
            <dd>WS-FINANCE-001</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Detection Time</dt>
            <dd>2 minutes ago</dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="destructive" size="sm">Quarantine</Button>
        <Button variant="outline" size="sm">Investigate</Button>
      </CardFooter>
    </Card>
  ),
};

export const Clickable: Story = {
  name: "Clickable Card",
  render: () => (
    <Card className="w-[350px] cursor-pointer transition-colors hover:bg-muted/50">
      <CardHeader>
        <CardTitle>Click Me</CardTitle>
        <CardDescription>This card is interactive</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Hover over this card to see the interactive state.
        </p>
      </CardContent>
    </Card>
  ),
};
