import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";
import { Label } from "./label";
import { Search, Mail, Lock } from "lucide-react";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "search", "number", "tel", "url"],
    },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    error: { control: "boolean" },
  },
  parameters: {
    docs: {
      description: {
        component: "Text input field for user data entry. Supports error states and various input types.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "Enter text...",
  },
};

export const WithLabel: Story = {
  name: "With Label",
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input type="email" id="email" placeholder="you@example.com" />
    </div>
  ),
};

export const WithError: Story = {
  name: "Error State",
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="email-error">Email</Label>
      <Input type="email" id="email-error" placeholder="you@example.com" error />
      <p className="text-sm text-error-500">Please enter a valid email address.</p>
    </div>
  ),
};

export const WithIcon: Story = {
  name: "With Icon",
  render: () => (
    <div className="space-y-4 max-w-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-10" placeholder="Search..." />
      </div>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="email" className="pl-10" placeholder="Email address" />
      </div>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="password" className="pl-10" placeholder="Password" />
      </div>
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    placeholder: "Disabled input",
    disabled: true,
  },
};

export const AllStates: Story = {
  name: "All States",
  render: () => (
    <div className="space-y-4 max-w-sm">
      <div>
        <Label>Default</Label>
        <Input placeholder="Default state" />
      </div>
      <div>
        <Label>With Value</Label>
        <Input defaultValue="Filled input" />
      </div>
      <div>
        <Label>Error</Label>
        <Input placeholder="Error state" error />
      </div>
      <div>
        <Label>Disabled</Label>
        <Input placeholder="Disabled state" disabled />
      </div>
    </div>
  ),
};
