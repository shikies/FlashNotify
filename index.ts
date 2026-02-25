import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { NotificationListenerModule } = NativeModules;

export interface NotificationEvent {
  packageName: string;
  appName: string;
  title: string;
  text: string;
  key?: string;
}

export interface NotificationRemovedEvent {
  packageName: string;
  key?: string;
}

class NotificationListenerService {
  private emitter: NativeEventEmitter | null = null;

  constructor() {
    if (Platform.OS === 'android' && NotificationListenerModule) {
      this.emitter = new NativeEventEmitter(NotificationListenerModule);
    }
  }

  isAvailable(): boolean {
    return Platform.OS === 'android' && !!NotificationListenerModule;
  }

  async isEnabled(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return await NotificationListenerModule.isNotificationListenerEnabled();
    } catch {
      return false;
    }
  }

  async openSettings(): Promise<void> {
    if (!this.isAvailable()) return;
    await NotificationListenerModule.openNotificationListenerSettings();
  }

  addListener(callback: (event: NotificationEvent) => void) {
    if (!this.emitter) return { remove: () => {} };
    return this.emitter.addListener('onNotificationReceived', callback);
  }

  /** 监听通知被移除（消息消失）事件 */
  addRemovedListener(callback: (event: NotificationRemovedEvent) => void) {
    if (!this.emitter) return { remove: () => {} };
    return this.emitter.addListener('onNotificationRemoved', callback);
  }
}

export const notificationListener = new NotificationListenerService();
export default notificationListener;
