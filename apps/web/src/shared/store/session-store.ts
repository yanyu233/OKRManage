import { create } from 'zustand';
import type { SessionUser } from '../types/session';

type SessionStore = {
  user: SessionUser | null;
  siderCollapsed: boolean;
  setUser: (user: SessionUser | null) => void;
  updateUser: (user: Partial<SessionUser>) => void;
  toggleSider: () => void;
  setSiderCollapsed: (collapsed: boolean) => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  user: null,
  siderCollapsed: false,
  setUser: (user) => set({ user }),
  updateUser: (user) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...user } : null
    })),
  toggleSider: () => set((state) => ({ siderCollapsed: !state.siderCollapsed })),
  setSiderCollapsed: (collapsed) => set({ siderCollapsed: collapsed })
}));
