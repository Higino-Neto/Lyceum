import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { renderWithProviders } from './helpers/renderWithProviders';

// Mock window.api for electron
const mockWindowApi = {
  windowMinimize: vi.fn(),
  windowMaximize: vi.fn(),
  windowIsMaximized: vi.fn().mockResolvedValue(false),
  windowClose: vi.fn(),
};

const originalWindowApi = window.api;

vi.mock('../utils/getUser', () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({ id: '1', name: 'Test User' })),
}));

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    Object.defineProperty(window, 'api', {
      value: mockWindowApi,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    Object.defineProperty(window, 'api', {
      value: originalWindowApi,
      writable: true,
      configurable: true,
    });
  });

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
      configurable: true,
    });

    renderWithProviders(<App />);
    expect(screen.getByText(/Lyceum/i)).toBeInTheDocument();
  });

  it('hides panels only after the auto-hide delay and keeps reveal hitboxes out of the way while visible', () => {
    vi.useFakeTimers();
    localStorage.setItem(
      'lyceum:app-settings',
      JSON.stringify({
        theme: 'dark',
        accentColor: 'green',
        copyYesterdayReadings: false,
        autoHideEnabled: true,
        autoHideOverlay: false,
      }),
    );

    const { container } = renderWithProviders(<App />);
    const sidebar = container.querySelector('aside');

    expect(sidebar).toHaveClass('w-13');
    expect(screen.queryByTestId('auto-hide-top-hitbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('auto-hide-left-hitbox')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(sidebar).toHaveClass('w-0');
    expect(screen.getByTestId('auto-hide-top-hitbox')).toBeInTheDocument();
    expect(screen.getByTestId('auto-hide-left-hitbox')).toBeInTheDocument();
  });

  it('reveals auto-hidden panels from the app edge hitbox after intent delay', () => {
    vi.useFakeTimers();
    localStorage.setItem(
      'lyceum:app-settings',
      JSON.stringify({
        theme: 'dark',
        accentColor: 'green',
        copyYesterdayReadings: false,
        autoHideEnabled: true,
        autoHideOverlay: false,
      }),
    );

    const { container } = renderWithProviders(<App />);
    const sidebar = container.querySelector('aside');

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(sidebar).toHaveClass('w-0');

    fireEvent.mouseEnter(screen.getByTestId('auto-hide-left-hitbox'));
    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(sidebar).toHaveClass('w-13');
    expect(screen.queryByTestId('auto-hide-top-hitbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('auto-hide-left-hitbox')).not.toBeInTheDocument();
  });
});
