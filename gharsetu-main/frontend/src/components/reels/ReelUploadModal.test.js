import React from 'react';
import { render, screen } from '@testing-library/react';
import ReelUploadModal from './ReelUploadModal';
import { useAuth } from '../../context/AuthContext';

jest.mock('../ui/input', () => ({
  Input: ({ children, ...props }) => <input {...props}>{children}</input>,
}));

jest.mock('../ui/textarea', () => ({
  Textarea: ({ children, ...props }) => <textarea {...props}>{children}</textarea>,
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('ReelUploadModal role category visibility', () => {
  beforeAll(() => {
    global.URL.createObjectURL = jest.fn(() => 'blob:test-video');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows only Property Sale and Property Rent for property_owner', () => {
    useAuth.mockReturnValue({
      token: 'test-token',
      user: { id: 'u-1', role: 'property_owner' },
    });

    render(<ReelUploadModal onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Property Sale' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Property Rent' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Stay' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Services' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Event' })).toBeNull();
  });

  test('shows only Stay for stay_owner', () => {
    useAuth.mockReturnValue({
      token: 'test-token',
      user: { id: 'u-2', role: 'stay_owner' },
    });

    render(<ReelUploadModal onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Stay' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Property Sale' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Property Rent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Services' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Event' })).toBeNull();
  });

  test('shows only Services for service_provider', () => {
    useAuth.mockReturnValue({
      token: 'test-token',
      user: { id: 'u-3', role: 'service_provider' },
    });

    render(<ReelUploadModal onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Services' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Property Sale' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Property Rent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stay' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Event' })).toBeNull();
  });

  test('shows all categories for admin', () => {
    useAuth.mockReturnValue({
      token: 'test-token',
      user: { id: 'u-4', role: 'admin' },
    });

    render(<ReelUploadModal onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Property Sale' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Property Rent' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Stay' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Services' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Event' })).not.toBeNull();
  });

  test('shows only Event for event_owner', () => {
    useAuth.mockReturnValue({
      token: 'test-token',
      user: { id: 'u-5', role: 'event_owner' },
    });

    render(<ReelUploadModal onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Event' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Property Sale' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Property Rent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stay' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Services' })).toBeNull();
  });

  test('shows only Stay for hotel_owner', () => {
    useAuth.mockReturnValue({
      token: 'test-token',
      user: { id: 'u-6', role: 'hotel_owner' },
    });

    render(<ReelUploadModal onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Stay' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Property Sale' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Property Rent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Services' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Event' })).toBeNull();
  });
});
