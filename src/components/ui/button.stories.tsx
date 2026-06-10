import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Mail, Loader2, ChevronRight } from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    disabled: { control: "boolean" },
    asChild: { control: "boolean" },
  },
  parameters: {
    docs: {
      description: {
        component: "Primary interactive element for user actions. Supports multiple variants and sizes.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: "Button",
    variant: "default",
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const Sizes: Story = {
  name: "All Sizes",
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">
        <Mail className="h-4 w-4" />
      </Button>
    </div>
  ),
};

export const WithIcon: Story = {
  name: "With Icon",
  render: () => (
    <div className="flex gap-4">
      <Button>
        <Mail className="mr-2 h-4 w-4" />
        Login with Email
      </Button>
      <Button variant="outline">
        Continue
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  name: "Loading State",
  render: () => (
    <Button disabled>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Please wait
    </Button>
  ),
};

export const Disabled: Story = {
  args: {
    children: "Disabled Button",
    disabled: true,
  },
};

export const DestructiveActions: Story = {
  name: "Destructive Actions",
  render: () => (
    <div className="flex gap-4">
      <Button variant="destructive">Delete</Button>
      <Button variant="destructive" size="sm">Remove</Button>
      <Button variant="destructive" disabled>Cannot Delete</Button>
    </div>
  ),
};
