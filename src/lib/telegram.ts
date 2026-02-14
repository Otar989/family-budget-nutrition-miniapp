declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        colorScheme?: string;
        initData?: string;
        themeParams?: Record<string, string>;
        initDataUnsafe?: { user?: { id?: number; first_name?: string } };
      };
    };
  }
}

export function initTelegramWebApp() {
  if (typeof window === "undefined") {
    return null;
  }

  const webApp = window.Telegram?.WebApp;
  if (!webApp) {
    return null;
  }

  webApp.ready();
  webApp.expand();

  return webApp;
}
