import type { Meta, StoryObj } from '@storybook/react';
import { Security } from './Security';
import { AuthProvider } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// Wrapper to provide auth context and router for stories
const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <BrowserRouter>
      <div className="min-h-screen bg-gray-900">
        {children}
      </div>
    </BrowserRouter>
  </AuthProvider>
);

const meta: Meta<typeof Security> = {
  title: 'Pages/Security',
  component: Security,
  decorators: [
    (Story) => (
      <PageWrapper>
        <Story />
      </PageWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Security settings page with password change, biometric settings, session timeout configuration, and authentication audit log.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Security>;

export const Default: Story = {};
