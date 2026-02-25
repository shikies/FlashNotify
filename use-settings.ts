import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  enabled: boolean;
  flashCount: number;
  flashInterval: number; // ms
  monitoredPackages: string[]; // empty = all apps
  /** 无限循环闪烁，直到屏幕点亮或手动停止 */
  infiniteFlash: boolean;
  /** 消息被用户清除后自动停止闪烁 */
  stopOnDismiss: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  enabled: false,
  flashCount: 5,
  flashInterval: 300,
  monitoredPackages: [],
  infiniteFlash: false,
  stopOnDismiss: true,
};

const STORAGE_KEY = '@flash_notify_settings';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (e) {
      console.warn('Failed to load settings', e);
    } finally {
      setLoaded(true);
    }
  };

  const saveSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(console.warn);
      return updated;
    });
  }, []);

  const toggleEnabled = useCallback(() => {
    saveSettings({ enabled: !settings.enabled });
  }, [settings.enabled, saveSettings]);

  const setFlashCount = useCallback(
    (count: number) => saveSettings({ flashCount: count }),
    [saveSettings]
  );

  const setFlashInterval = useCallback(
    (interval: number) => saveSettings({ flashInterval: interval }),
    [saveSettings]
  );

  const toggleInfiniteFlash = useCallback(() => {
    saveSettings({ infiniteFlash: !settings.infiniteFlash });
  }, [settings.infiniteFlash, saveSettings]);

  const toggleStopOnDismiss = useCallback(() => {
    saveSettings({ stopOnDismiss: !settings.stopOnDismiss });
  }, [settings.stopOnDismiss, saveSettings]);

  const addMonitoredPackage = useCallback(
    (pkg: string) => {
      if (!settings.monitoredPackages.includes(pkg)) {
        saveSettings({ monitoredPackages: [...settings.monitoredPackages, pkg] });
      }
    },
    [settings.monitoredPackages, saveSettings]
  );

  const removeMonitoredPackage = useCallback(
    (pkg: string) => {
      saveSettings({
        monitoredPackages: settings.monitoredPackages.filter((p) => p !== pkg),
      });
    },
    [settings.monitoredPackages, saveSettings]
  );

  const toggleMonitoredPackage = useCallback(
    (pkg: string) => {
      if (settings.monitoredPackages.includes(pkg)) {
        removeMonitoredPackage(pkg);
      } else {
        addMonitoredPackage(pkg);
      }
    },
    [settings.monitoredPackages, addMonitoredPackage, removeMonitoredPackage]
  );

  const setMonitoredPackages = useCallback(
    (packages: string[]) => saveSettings({ monitoredPackages: packages }),
    [saveSettings]
  );

  return {
    settings,
    loaded,
    toggleEnabled,
    setFlashCount,
    setFlashInterval,
    toggleInfiniteFlash,
    toggleStopOnDismiss,
    toggleMonitoredPackage,
    setMonitoredPackages,
    saveSettings,
  };
}
