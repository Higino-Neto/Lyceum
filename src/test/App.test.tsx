import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../App';
import { renderWithProviders } from './helpers/renderWithProviders';

// Mock window.api for electron
const mockWindowApi = {
  windowMinimize: vi.fn(),
  windowMaximize: vi.fn(),
  windowIsMaximized: vi.fn().mockResolvedValue(false),
  windowClose: vi.fn(),
};

Object.defineProperty(window, 'api', {
  value: mockWindowApi,
  writable: true,
});

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getUser utility
    vi.mock('../utils/getUser');
  });

  afterEach(() => {
    vi.unmock('../utils/getUser');
  });

  it('renders the app without crashing', async () => {
    const getUserMock = await import('../utils/getUser');
    // Access the mocked function correctly
    (getUserMock.default as any).mockResolvedValueOnce({ id: '1', name: 'Test User' });

    renderWithProviders(<App />);
    // Wait for the effect to run
    await vi.waitFor(() => {
      expect(getUserMock.default).toHaveBeenCalled();
    });
    expect(screen.getByText(/Lyceum/i)).toBeInTheDocument();
  });

  it('shows TitleBar when isElectron is true', () => {
    // Mock window to simulate electron environment
    Object.defineProperty(window, 'api', {
      value: {
        windowMinimize: vi.fn(),
        windowMaximize: vi.fn(),
        windowIsMaximized: vi.fn().mockResolvedValue(false),
        windowClose: vi.fn(),
      },
      writable: true,
    });

    renderWithProviders(<App />);
    // TitleBar should be rendered (we can check for the Lyceum text which is in TitleBar)
    expect(screen.getByText(/Lyceum/i)).toBeInTheDocument();
  });

  it('handles user login state', async () => {
    const getUserMock = await import('../utils/getUser');
    // Access the mocked function correctly
    (getUserMock.default as any).mockResolvedValueOnce({ id: '1', name: 'Test User' });

    renderWithProviders(<App />);
    // Wait for the effect to run
    await vi.waitFor(() => {
      expect(getUserMock.default).toHaveBeenCalled();
    });
  });

  it('handles user login failure', async () => {
    const getUserMock = await import('../utils/getUser');
    // Access the mocked function correctly
    (getUserMock.default as any).mockRejectedValueOnce(new Error('Failed to get user'));

    renderWithProviders(<App />);
    // Wait for the effect to run
    await vi.waitFor(() => {
      expect(getUserMock.default).toHaveBeenCalled();
    });
  });
});