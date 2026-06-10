import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, buttonVariants } from './button';

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('bg-primary-600');
  });

  it('renders destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole('button', { name: /delete/i });
    expect(button.className).toContain('bg-error-600');
  });

  it('renders outline variant', () => {
    render(<Button variant="outline">Outline</Button>);
    const button = screen.getByRole('button', { name: /outline/i });
    expect(button.className).toContain('border');
  });

  it('renders secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button', { name: /secondary/i });
    expect(button.className).toContain('bg-secondary-200');
  });

  it('renders ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole('button', { name: /ghost/i });
    expect(button.className).toContain('hover:bg-secondary-100');
  });

  it('renders link variant', () => {
    render(<Button variant="link">Link</Button>);
    const button = screen.getByRole('button', { name: /link/i });
    expect(button.className).toContain('text-primary-600');
  });

  it('renders small size', () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole('button', { name: /small/i });
    expect(button.className).toContain('h-9');
  });

  it('renders default size', () => {
    render(<Button size="default">Default</Button>);
    const button = screen.getByRole('button', { name: /default/i });
    expect(button.className).toContain('h-10');
  });

  it('renders large size', () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole('button', { name: /large/i });
    expect(button.className).toContain('h-11');
  });

  it('renders icon size', () => {
    render(<Button size="icon">+</Button>);
    const button = screen.getByRole('button', { name: /\+/i });
    expect(button.className).toContain('h-10');
    expect(button.className).toContain('w-10');
  });

  it('supports disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button', { name: /disabled/i });
    expect(button).toBeDisabled();
    expect(button.className).toContain('disabled:opacity-50');
  });

  it('exports buttonVariants for reuse', () => {
    expect(buttonVariants).toBeDefined();
    expect(typeof buttonVariants).toBe('function');
  });
});
