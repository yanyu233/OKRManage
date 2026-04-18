import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthEntryPage } from '../src/modules/auth/AuthEntryPage';
import { LoginPage } from '../src/modules/auth/LoginPage';
import { useSessionStore } from '../src/shared/store/session-store';

const mockNavigate = vi.fn();
const mockAuthStart = vi.fn();
const mockRedirectToWecom = vi.fn();
const mockGetCurrentSession = vi.fn();
const mockManualLogin = vi.fn();

let mockSearch = '';

vi.mock('../src/shared/api/auth', () => ({
  authStart: (...args: unknown[]) => mockAuthStart(...args),
  redirectToWecom: (...args: unknown[]) => mockRedirectToWecom(...args),
  getCurrentSession: (...args: unknown[]) => mockGetCurrentSession(...args),
  manualLogin: (...args: unknown[]) => mockManualLogin(...args),
  logout: vi.fn(),
  switchActiveRole: vi.fn()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      pathname: '/auth/entry',
      search: mockSearch,
      hash: '',
      state: null,
      key: 'test'
    })
  };
});

describe('auth entry and login fallback', () => {
  beforeEach(() => {
    mockSearch = '';
    mockNavigate.mockReset();
    mockAuthStart.mockReset();
    mockRedirectToWecom.mockReset();
    mockGetCurrentSession.mockReset();
    mockManualLogin.mockReset();
    useSessionStore.setState({
      user: null,
      siderCollapsed: false
    });
    mockGetCurrentSession.mockResolvedValue({
      authenticated: false,
      user: null
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('routes auth entry to the manual login page when backend returns manual-login', async () => {
    mockSearch = '?returnTo=%2Femployee%2Fokr';
    mockAuthStart.mockResolvedValue({
      action: 'manual-login',
      redirectTo: '/login?returnTo=%2Femployee%2Fokr'
    });

    renderWithProviders(<AuthEntryPage />);

    await waitFor(() => {
      expect(mockAuthStart).toHaveBeenCalledWith('/employee/okr');
      expect(mockNavigate).toHaveBeenCalledWith('/login?returnTo=%2Femployee%2Fokr', { replace: true });
    });
  });

  it('routes auth entry back into the app when backend returns session', async () => {
    mockSearch = '?returnTo=%2Fadmin%2Forg';
    mockAuthStart.mockResolvedValue({
      action: 'session',
      redirectTo: '/admin/org'
    });

    renderWithProviders(<AuthEntryPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin/org', { replace: true });
    });
  });

  it('hands browser navigation to the WeCom start route when backend returns wecom', async () => {
    mockSearch = '?returnTo=%2Fleader%2Fworkbench';
    mockAuthStart.mockResolvedValue({
      action: 'wecom',
      redirectTo: '/api/auth/wecom/start?returnTo=%2Fleader%2Fworkbench'
    });

    renderWithProviders(<AuthEntryPage />);

    await waitFor(() => {
      expect(mockRedirectToWecom).toHaveBeenCalledWith('/api/auth/wecom/start?returnTo=%2Fleader%2Fworkbench');
    });
  });

  it('shows the unmapped WeCom fallback explanation on the login page', async () => {
    mockSearch = '?reason=unmapped&returnTo=%2Fleader%2Fworkbench';

    renderWithProviders(<LoginPage />);

    expect(await screen.findByText('企业微信账号未识别')).toBeInTheDocument();
    expect(screen.getByText(/请使用系统管理员分配的账号密码登录/)).toBeInTheDocument();
  });

  it('shows password-login guidance while keeping WeCom as the preferred option', async () => {
    mockSearch = '';

    renderWithProviders(<LoginPage />);

    expect(await screen.findByText('账号密码登录')).toBeInTheDocument();
    expect(screen.getByText(/系统会优先尝试企业微信认证/)).toBeInTheDocument();
  });
});

function renderWithProviders(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <AntApp>
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </AntApp>
  );
}
