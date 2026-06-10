import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Label } from "./label";
import { Button } from "./button";
import { User, Shield, Bell } from "lucide-react";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Tab navigation component built on Radix UI. Supports keyboard navigation and controlled state.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="text-sm text-muted-foreground">
          Overview tab content goes here.
        </p>
      </TabsContent>
      <TabsContent value="analytics">
        <p className="text-sm text-muted-foreground">
          Analytics tab content goes here.
        </p>
      </TabsContent>
      <TabsContent value="reports">
        <p className="text-sm text-muted-foreground">
          Reports tab content goes here.
        </p>
      </TabsContent>
    </Tabs>
  ),
};

export const WithCards: Story = {
  name: "With Cards",
  render: () => (
    <Tabs defaultValue="account" className="w-[500px]">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Make changes to your account here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue="John Doe" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input id="username" defaultValue="@johndoe" />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="password">
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              Change your password here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="current">Current password</Label>
              <Input id="current" type="password" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new">New password</Label>
              <Input id="new" type="password" />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  ),
};

export const WithIcons: Story = {
  name: "With Icons",
  render: () => (
    <Tabs defaultValue="profile" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="profile" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="security" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Security
        </TabsTrigger>
        <TabsTrigger value="notifications" className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Notifications
        </TabsTrigger>
      </TabsList>
      <TabsContent value="profile" className="mt-4">
        <p className="text-sm text-muted-foreground">Profile settings</p>
      </TabsContent>
      <TabsContent value="security" className="mt-4">
        <p className="text-sm text-muted-foreground">Security settings</p>
      </TabsContent>
      <TabsContent value="notifications" className="mt-4">
        <p className="text-sm text-muted-foreground">Notification preferences</p>
      </TabsContent>
    </Tabs>
  ),
};

export const Disabled: Story = {
  name: "With Disabled Tab",
  render: () => (
    <Tabs defaultValue="active" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="pending">Pending</TabsTrigger>
        <TabsTrigger value="archived" disabled>Archived</TabsTrigger>
      </TabsList>
      <TabsContent value="active">
        <p className="text-sm text-muted-foreground">Active items</p>
      </TabsContent>
      <TabsContent value="pending">
        <p className="text-sm text-muted-foreground">Pending items</p>
      </TabsContent>
    </Tabs>
  ),
};
