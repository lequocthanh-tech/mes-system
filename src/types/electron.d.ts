/* Hallmark · component: ElectronGlobalTypes · genre: modern-minimal · register: industrial-workbench
 * states: default
 * contrast: WCAG AA Pass
 */

export interface ElectronAPI {
  setZoomFactor?: (factor: number) => void;
  getZoomFactor?: () => number;
  sendAppMounted?: () => void;
  sendSplashComplete?: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
