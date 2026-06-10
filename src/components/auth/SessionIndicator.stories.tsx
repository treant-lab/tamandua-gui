import type { Meta, StoryObj } from '@storybook/react';
import { SessionIndicator } from './SessionIndicator';
import { AuthProvider } from '../../context/AuthContext';

// Wrapper to provide auth context for stories
const AuthWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    {children}
  </AuthProvider>
);

const meta: Meta<typeof SessionIndicator> = {
  title: 'Auth/SessionIndicator',
  component: SessionIndicator,
  decorators: [
    (Story) => (
      <AuthWrapper>
        <div className="min-h-screen bg-gray-900 p-8">
          <Story />
        </div>
      </AuthWrapper>
    ),
  ],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Session status indicator showing lock icon with countdown timer, click to lock, and visual warning when session is expiring.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SessionIndicator>;

export const Default: Story = {
  args: {
    showTimer: true,
    compact: false,
  },
};

export const Compact: Story = {
  args: {
    showTimer: true,
    compact: true,
  },
};

export const WithoutTimer: Story = {
  args: {
    showTimer: false,
    compact: false,
  },
};

// All variants showcase
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-white text-lg font-medium mb-4">Full Size</h3>
        <SessionIndicator showTimer compact={false} />
      </div>
      <div>
        <h3 className="text-white text-lg font-medium mb-4">Compact</h3>
        <SessionIndicator showTimer compact />
      </div>
      <div>
        <h3 className="text-white text-lg font-medium mb-4">Without Timer</h3>
        <SessionIndicator showTimer={false} compact={false} />
      </div>
      <div>
        <h3 className="text-white text-lg font-medium mb-4">In Sidebar Context</h3>
        <div className="w-64 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm mb-4">Sidebar navigation would be here...</p>
          <div className="border-t border-gray-700 pt-4">
            <SessionIndicator compact />
          </div>
        </div>
      </div>
    </div>
  ),
};
