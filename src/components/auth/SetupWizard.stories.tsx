import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SetupWizard } from './SetupWizard';
import { AuthProvider } from '../../context/AuthContext';

// Wrapper to provide auth context for stories
const AuthWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    {children}
  </AuthProvider>
);

const meta: Meta<typeof SetupWizard> = {
  title: 'Auth/SetupWizard',
  component: SetupWizard,
  decorators: [
    (Story) => (
      <AuthWrapper>
        <div className="min-h-screen bg-gray-900">
          <Story />
        </div>
      </AuthWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'First-run setup wizard with welcome screen, password creation with strength meter, optional biometric enrollment, and success animation.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SetupWizard>;

export const Default: Story = {
  args: {
    isOpen: true,
  },
};

// Interactive playground
export const Interactive: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <>
        <div className="p-8">
          <button
            onClick={() => setIsOpen(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
          >
            Open Setup Wizard
          </button>
          <p className="text-gray-400 mt-4">
            Click to simulate the first-run setup experience.
          </p>
        </div>
        <SetupWizard
          isOpen={isOpen}
          onComplete={() => {
            alert('Setup complete!');
            setIsOpen(false);
          }}
        />
      </>
    );
  },
};
