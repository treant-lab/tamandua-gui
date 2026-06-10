import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PasswordDialog } from './PasswordDialog';
import { AuthProvider } from '../../context/AuthContext';

// Wrapper to provide auth context for stories
const AuthWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    {children}
  </AuthProvider>
);

const meta: Meta<typeof PasswordDialog> = {
  title: 'Auth/PasswordDialog',
  component: PasswordDialog,
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
        component: 'Modal dialog for password authentication with blur backdrop, show/hide toggle, remember option, biometric fallback, and error animations.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PasswordDialog>;

// Interactive story with controls
export const Default: Story = {
  args: {
    isOpen: true,
    title: 'Authentication Required',
    subtitle: 'Enter your password to continue',
    showBiometricOption: true,
  },
};

export const CustomTitle: Story = {
  args: {
    isOpen: true,
    title: 'Confirm Action',
    subtitle: 'This action requires authentication',
    showBiometricOption: true,
  },
};

export const WithoutBiometrics: Story = {
  args: {
    isOpen: true,
    title: 'Authentication Required',
    subtitle: 'Enter your password to continue',
    showBiometricOption: false,
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
            Open Password Dialog
          </button>
        </div>
        <PasswordDialog
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSuccess={() => {
            alert('Authentication successful!');
            setIsOpen(false);
          }}
        />
      </>
    );
  },
};
