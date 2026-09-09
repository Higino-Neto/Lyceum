import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { renderWithProviders } from './helpers/renderWithProviders';

// Mock window.api for electron
const mockWindowApi = {
  windowMinimize: vi.fn(),
  windowMaximize: vi.fn(),
  windowIsMaximized: vi.fn().mockResolvedValue(false),
  windowClose: vi.fn(),
  backupInit: vi.fn().mockResolvedValue({ success: true }),
  backupSetSession: vi.fn().mockResolvedValue({ success: true }),
  backupClearSession: vi.fn().mockResolvedValue({ success: true }),
  backupAllDocuments: vi.fn().mockResolvedValue({ success: 1, failed: 0, errors: [] }),
  backupAllHabits: vi.fn().mockResolvedValue({ success: 1, failed: 0, errors: [] }),
  backupAllCategories: vi.fn().mockResolvedValue({ success: 1, failed: 0, errors: [] }),
};

const originalWindowApi = window.api;

const { mockGetSession, mockOnAuthStateChange, mockSignOut, mockGetSupabaseConfig } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSignOut: vi.fn(),
  mockGetSupabaseConfig: vi.fn(),
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
    getSupabaseConfig: mockGetSupabaseConfig,
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
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
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
    mockGetSupabaseConfig.mockReturnValue(null);
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

  it('asks for confirmation before signing out', async () => {
    renderWithProviders(<App />);
    await flushBootstrap();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByText('Deseja realmente encerrar sua sessão no Lyceum?')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sair' }));
    await act(async () => {});
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('allows leaving the account settings tab after opening it from the sidebar', async () => {
    renderWithProviders(<App />);
    await flushBootstrap();
    fireEvent.click(screen.getByRole('button', { name: 'Conta' }));
    expect(screen.getByRole('heading', { name: 'Conta', level: 1 })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Geral' }));
    expect(screen.getByRole('heading', { name: 'Geral', level: 1 })).toBeInTheDocument();
  });

  it('runs selected periodic backups only after the weekly gate and startup delay', async () => {
    vi.useFakeTimers();
    mockGetSupabaseConfig.mockReturnValue({ url: 'https://example.supabase.co', anonKey: 'test-key' });
    renderWithProviders(<App />);
    await flushBootstrap();
    expect(mockWindowApi.backupAllDocuments).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(5_000); });
    expect(mockWindowApi.backupAllDocuments).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(25_000); });
    expect(mockWindowApi.backupAllDocuments).toHaveBeenCalledTimes(1);
    expect(mockWindowApi.backupAllHabits).toHaveBeenCalledTimes(1);
    expect(mockWindowApi.backupAllCategories).toHaveBeenCalledTimes(1);
  });
});
