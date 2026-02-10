import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('todoApi', {});
