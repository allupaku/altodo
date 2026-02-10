export interface AppSettings {
  alwaysOnTop: boolean;
  dockRight: boolean;
  widthMode: 'px' | 'percent';
  widthValue: number;
  displayId: number | null;
  todosDir: string | null;
  reminderTime: string;
  gitEnabled: boolean;
}

export interface DisplayInfo {
  id: number;
  label: string;
}

export interface GitStatus {
  enabled: boolean;
  available: boolean;
  message: string;
}
