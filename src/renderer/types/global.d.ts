import type { WindowWithApi } from '../../shared/ipc/bridge';

declare global {
  interface Window extends WindowWithApi {}
}

export {};
