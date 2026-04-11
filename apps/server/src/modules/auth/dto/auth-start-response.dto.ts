export type AuthStartAction = 'session' | 'manual-login' | 'wecom';

export type AuthStartResponseDto = {
  action: AuthStartAction;
  redirectTo: string;
};
