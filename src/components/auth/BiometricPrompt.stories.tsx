import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { BiometricPrompt } from './BiometricPrompt';
import { AuthProvider } from '../../context/AuthContext';

// Wrapper to provide auth context for stories
const AuthWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    {children}
  </AuthProvider>
);

const meta: Meta<typeof BiometricPrompt> = {
  title: 'Auth/BiometricPrompt',
  component: BiometricPrompt,
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
        component: 'Biometric authentication prompt with animated fingerprint/face icon, platform-specific messaging, and fallback to password option.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BiometricPrompt>;

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
            Open Biometric Prompt
          </button>
        </div>
        <BiometricPrompt
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSuccess={() => {
            alert('Biometric authentication successful!');
            setIsOpen(false);
          }}
          onFallbackToPassword={() => {
            alert('Falling back to password...');
            setIsOpen(false);
          }}
        />
      </>
    );
  },
};
