import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../src/modules/layout/AppShell';

vi.mock('../src/shared/api/auth', () => ({
  getCurrentSession: async () => ({
    authenticated: true,
    user: {
      id: 'user-1',
      name: '\u5f20\u6668',
      loginName: 'zhang.chen',
      activeRole: 'employee',
      roles: ['employee']
    }
  }),
  logout: vi.fn(),
  switchActiveRole: vi.fn()
}));

vi.mock('../src/modules/layout/routing', () => ({
  canAccessRoute: () => true,
  menuItemsForUser: () => [{ key: '/employee/okr', label: '\u6211\u7684 OKR' }],
  resolveTargetRoleForPath: () => 'employee',
  selectedMenuKeyForPath: () => '/employee/okr'
}));

describe('AppShell layout', () => {
  window.matchMedia ??= vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a dedicated identity wrapper for centered user information', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <AppShell />,
          children: [
            {
              path: 'employee/okr',
              element: <div>{'\u6211\u7684 OKR \u9875\u9762'}</div>
            }
          ]
        }
      ],
      {
        initialEntries: ['/employee/okr']
      }
    );

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AntApp>
          <RouterProvider router={router} />
        </AntApp>
      </QueryClientProvider>
    );

    expect(await screen.findByText('\u5f20\u6668')).not.toBeNull();
    expect(document.querySelector('.app-shell__identity')).not.toBeNull();
  });
});
