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

const { mockGetSession, mockOnAuthStateChange, mockSignOut } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock('../lib/supabase', () => {
  const createBuilder = () => {
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: vi.fn((resolve) => Promise.resolve({ data: [], error: null }).then(resolve)),
    };
    return builder;
  };

  return {
    getSupabaseConfig: vi.fn(() => null),
    supabase: {
      auth: {
        getUser: vi.fn(() => Promise.resolve({
          data: { user: { id: '1', email: 'test@example.com' } },
          error: null,
        })),
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        signOut: mockSignOut,
      },
      from: vi.fn(() => createBuilder()),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
        })),
      },
    },
  };
});

async function flushBootstrap() {
  await act(async () => {});
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          user: { id: '1', email: 'test@example.com' },
        },
      },
      error: null,
    });
    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
    mockSignOut.mockResolvedValue({ error: null });
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

  it('renders the app without crashing', async () => {
    renderWithProviders(<App />);
    await flushBootstrap();
    expect(screen.getByText(/Lyceum/i)).toBeInTheDocument();
  });

  it('shows TitleBar when isElectron is true', async () => {
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
    await flushBootstrap();
    expect(screen.getByText(/Lyceum/i)).toBeInTheDocument();
  });

  it('hides panels only after the auto-hide delay and keeps reveal hitboxes out of the way while visible', async () => {
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
    await flushBootstrap();
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

  it('reveals auto-hidden panels from the app edge hitbox after intent delay', async () => {
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
    await flushBootstrap();
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
