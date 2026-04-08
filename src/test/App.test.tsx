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

vi.mock('../utils/getUser', () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({ id: '1', name: 'Test User' })),
}));

describe('App', () => {
  it('renders the app without crashing', () => {
    renderWithProviders(<App />);
    expect(screen.getByText(/Lyceum/i)).toBeInTheDocument();
  });

  it('shows TitleBar when isElectron is true', () => {
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
    expect(screen.getByText(/Lyceum/i)).toBeInTheDocument();
  });
});