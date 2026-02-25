import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Animated,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import { useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';

import { ScreenContainer } from '@/components/screen-container';
import { HiddenTorch } from '@/components/hidden-torch';
import { useFlashlight } from '@/hooks/use-flashlight';
import { useNotificationListener } from '@/hooks/use-notification-listener';
import { useSettings } from '@/hooks/use-settings';
import { useColors } from '@/hooks/use-colors';
import notificationListener from '@/modules/notification-listener/src';

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    settings,
    loaded,
    toggleEnabled,
    setFlashCount,
    setFlashInterval,
    toggleInfiniteFlash,
    toggleStopOnDismiss,
  } = useSettings();
  const { torchEnabled, flash, stopFlash, isFlashing } = useFlashlight();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [notificationPermEnabled, setNotificationPermEnabled] = useState(false);
  const [lastNotification, setLastNotification] = useState<{
    appName: string;
    title: string;
    time: string;
  } | null>(null);

  // Track the key of the notification that triggered the current flash,
  // so we can stop when exactly that notification is dismissed.
  const activeNotificationKeyRef = useRef<string | null>(null);

  // Animation for the main toggle
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Check notification listener permission
  useEffect(() => {
    checkNotificationPerm();
  }, []);

  const checkNotificationPerm = async () => {
    const enabled = await notificationListener.isEnabled();
    setNotificationPermEnabled(enabled);
  };

  // Pulse animation when active
  useEffect(() => {
    if (settings.enabled && notificationPermEnabled) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [settings.enabled, notificationPermEnabled]);

  // Handle incoming notification
  const handleNotification = useCallback(
    async (event: { appName: string; title: string; packageName: string; text: string; key?: string }) => {
      if (!settings.enabled) return;

      setLastNotification({
        appName: event.appName,
        title: event.title || '新消息',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      });

      // Remember which notification triggered this flash (for stopOnDismiss)
      activeNotificationKeyRef.current = event.key ?? null;

      // Wake screen
      await activateKeepAwake('flash-notify');

      // Flash the torch: -1 means infinite, otherwise use the configured count
      const count = settings.infiniteFlash ? -1 : settings.flashCount;
      await flash(count, settings.flashInterval);

      // For finite flash: deactivate keep-awake after the sequence ends
      if (!settings.infiniteFlash) {
        setTimeout(() => {
          deactivateKeepAwake('flash-notify');
          activeNotificationKeyRef.current = null;
        }, settings.flashCount * settings.flashInterval + 500);
      }
    },
    [settings, flash]
  );

  // Handle notification removed (dismissed by user or system)
  const handleNotificationRemoved = useCallback(
    (event: { packageName: string; key?: string }) => {
      if (!settings.stopOnDismiss) return;
      if (!isFlashing) return;

      // Stop if the removed notification is the one that triggered the current flash,
      // or if we don't have a key to compare (stop on any removal).
      const activeKey = activeNotificationKeyRef.current;
      if (activeKey === null || activeKey === event.key) {
        stopFlash();
        deactivateKeepAwake('flash-notify');
        activeNotificationKeyRef.current = null;
      }
    },
    [settings.stopOnDismiss, isFlashing, stopFlash]
  );

  // Listen for notifications
  useNotificationListener(
    handleNotification,
    handleNotificationRemoved,
    new Set(settings.monitoredPackages),
    settings.enabled
  );

  const handleToggle = async () => {
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
      return;
    }
    if (!notificationPermEnabled) {
      await notificationListener.openSettings();
      setTimeout(checkNotificationPerm, 1000);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleEnabled();
  };

  const handleTestFlash = async () => {
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await activateKeepAwake('flash-notify-test');
    const count = settings.infiniteFlash ? -1 : settings.flashCount;
    await flash(count, settings.flashInterval);
    if (!settings.infiniteFlash) {
      setTimeout(() => deactivateKeepAwake('flash-notify-test'), 2000);
    }
  };

  const isFullyReady = cameraPermission?.granted && notificationPermEnabled;
  const isActive = settings.enabled && isFullyReady;

  return (
    <ScreenContainer containerClassName="bg-background">
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Hidden torch controller */}
      <HiddenTorch enabled={torchEnabled} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Text style={styles.logoEmoji}>⚡</Text>
            <Text style={[styles.appTitle, { color: colors.foreground }]}>FlashNotify</Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            通知闪光灯助手
          </Text>
        </View>

        {/* Main Toggle Card */}
        <Animated.View
          style={[
            styles.mainCard,
            {
              backgroundColor: isActive ? '#1E3A5F' : colors.surface,
              borderColor: isActive ? '#3B82F6' : colors.border,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View style={styles.mainCardContent}>
            <View style={styles.mainCardLeft}>
              <Text style={[styles.mainCardTitle, { color: colors.foreground }]}>
                {isActive ? '监听中' : '已停止'}
              </Text>
              <Text style={[styles.mainCardDesc, { color: colors.muted }]}>
                {isActive
                  ? settings.monitoredPackages.length === 0
                    ? '监听所有应用通知'
                    : `监听 ${settings.monitoredPackages.length} 个应用`
                  : '点击开关启动'}
              </Text>
            </View>
            <View style={styles.statusDot}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: isActive ? '#22C55E' : colors.muted },
                ]}
              />
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={handleToggle}
              trackColor={{ false: colors.border, true: '#3B82F680' }}
              thumbColor={settings.enabled ? '#3B82F6' : colors.muted}
              style={styles.mainSwitch}
            />
          </View>
        </Animated.View>

        {/* Permission Status */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>权限状态</Text>

          <PermissionRow
            label="相机权限"
            desc="用于控制闪光灯"
            granted={!!cameraPermission?.granted}
            onPress={requestCameraPermission}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <PermissionRow
            label="通知访问权限"
            desc="用于监听其他应用通知"
            granted={notificationPermEnabled}
            onPress={async () => {
              await notificationListener.openSettings();
              setTimeout(checkNotificationPerm, 2000);
            }}
            colors={colors}
          />
        </View>

        {/* Flash Settings */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>闪光灯设置</Text>

          {/* Flash Count Row */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>闪烁次数</Text>
              <Text style={[styles.settingValue, { color: colors.primary }]}>
                {settings.infiniteFlash ? '无限次' : `${settings.flashCount} 次`}
              </Text>
            </View>
            <View style={styles.stepperRow}>
              {/* Infinite toggle button */}
              <TouchableOpacity
                style={[
                  styles.infiniteBtn,
                  {
                    backgroundColor: settings.infiniteFlash ? colors.primary : colors.border,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleInfiniteFlash();
                }}
              >
                <Text
                  style={[
                    styles.infiniteBtnText,
                    { color: settings.infiniteFlash ? '#fff' : colors.muted },
                  ]}
                >
                  ∞
                </Text>
              </TouchableOpacity>

              {/* Stepper (disabled when infinite) */}
              <TouchableOpacity
                style={[
                  styles.stepBtn,
                  {
                    borderColor: colors.border,
                    opacity: settings.infiniteFlash ? 0.35 : 1,
                  },
                ]}
                onPress={() => {
                  if (!settings.infiniteFlash) {
                    setFlashCount(Math.max(1, settings.flashCount - 1));
                  }
                }}
                disabled={settings.infiniteFlash}
              >
                <Text style={[styles.stepBtnText, { color: colors.foreground }]}>−</Text>
              </TouchableOpacity>
              <Text
                style={[
                  styles.stepValue,
                  {
                    color: settings.infiniteFlash ? colors.muted : colors.foreground,
                  },
                ]}
              >
                {settings.infiniteFlash ? '∞' : settings.flashCount}
              </Text>
              <TouchableOpacity
                style={[
                  styles.stepBtn,
                  {
                    borderColor: colors.border,
                    opacity: settings.infiniteFlash ? 0.35 : 1,
                  },
                ]}
                onPress={() => {
                  if (!settings.infiniteFlash) {
                    setFlashCount(settings.flashCount + 1);
                  }
                }}
                disabled={settings.infiniteFlash}
              >
                <Text style={[styles.stepBtnText, { color: colors.foreground }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Flash Speed Row */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>闪烁速度</Text>
              <Text style={[styles.settingValue, { color: colors.primary }]}>
                {settings.flashInterval <= 150 ? '极快' :
                 settings.flashInterval <= 250 ? '快速' :
                 settings.flashInterval <= 400 ? '中速' : '慢速'}
              </Text>
            </View>
            <View style={styles.speedBtns}>
              {[
                { label: '极快', value: 100 },
                { label: '快', value: 200 },
                { label: '中', value: 350 },
                { label: '慢', value: 600 },
              ].map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[
                    styles.speedBtn,
                    {
                      backgroundColor:
                        settings.flashInterval === s.value
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                  onPress={() => setFlashInterval(s.value)}
                >
                  <Text
                    style={[
                      styles.speedBtnText,
                      {
                        color:
                          settings.flashInterval === s.value
                            ? '#fff'
                            : colors.muted,
                      },
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Stop on Dismiss Row */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>消息消失后停止</Text>
              <Text style={[styles.settingValue, { color: colors.muted }]}>
                通知被清除时自动停止闪烁
              </Text>
            </View>
            <Switch
              value={settings.stopOnDismiss}
              onValueChange={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleStopOnDismiss();
              }}
              trackColor={{ false: colors.border, true: '#3B82F680' }}
              thumbColor={settings.stopOnDismiss ? '#3B82F6' : colors.muted}
            />
          </View>
        </View>

        {/* Monitored Apps */}
        <TouchableOpacity
          style={[styles.card, styles.appsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/app-selector')}
          activeOpacity={0.7}
        >
          <View style={styles.appsCardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>监听的应用</Text>
            <Text style={[styles.appsManage, { color: colors.primary }]}>管理 →</Text>
          </View>
          <Text style={[styles.appsDesc, { color: colors.muted }]}>
            {settings.monitoredPackages.length === 0
              ? '当前监听所有应用的通知'
              : `已选择 ${settings.monitoredPackages.length} 个应用`}
          </Text>
        </TouchableOpacity>

        {/* Last Notification */}
        {lastNotification && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>最近触发</Text>
            <View style={styles.lastNotifRow}>
              <View style={[styles.notifIcon, { backgroundColor: '#3B82F620' }]}>
                <Text style={styles.notifIconText}>🔔</Text>
              </View>
              <View style={styles.notifInfo}>
                <Text style={[styles.notifApp, { color: colors.foreground }]}>
                  {lastNotification.appName}
                </Text>
                <Text style={[styles.notifTitle, { color: colors.muted }]} numberOfLines={1}>
                  {lastNotification.title}
                </Text>
              </View>
              <Text style={[styles.notifTime, { color: colors.muted }]}>
                {lastNotification.time}
              </Text>
            </View>
          </View>
        )}

        {/* Test Button */}
        <TouchableOpacity
          style={[
            styles.testBtn,
            {
              backgroundColor: isFlashing ? colors.warning : colors.primary,
              opacity: isFlashing ? 0.8 : 1,
            },
          ]}
          onPress={isFlashing ? stopFlash : handleTestFlash}
          activeOpacity={0.8}
        >
          <Text style={styles.testBtnText}>
            {isFlashing ? '⏹ 停止闪烁' : '⚡ 测试闪光灯'}
          </Text>
        </TouchableOpacity>

        {/* Info Note */}
        <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.infoText, { color: colors.muted }]}>
            💡 使用说明：开启权限后打开主开关，收到通知时闪光灯将自动闪烁并唤醒屏幕。开启"无限次"后闪烁将持续到通知消失或手动停止。应用需保持后台运行。
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

interface PermissionRowProps {
  label: string;
  desc: string;
  granted: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}

function PermissionRow({ label, desc, granted, onPress, colors }: PermissionRowProps) {
  return (
    <View style={styles.permRow}>
      <View style={styles.permInfo}>
        <Text style={[styles.permLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.permDesc, { color: colors.muted }]}>{desc}</Text>
      </View>
      {granted ? (
        <View style={[styles.permBadge, { backgroundColor: '#22C55E20' }]}>
          <Text style={[styles.permBadgeText, { color: '#22C55E' }]}>✓ 已授权</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.permBadge, { backgroundColor: '#F59E0B20' }]}
          onPress={onPress}
        >
          <Text style={[styles.permBadgeText, { color: '#F59E0B' }]}>去授权</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  logoEmoji: {
    fontSize: 32,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    letterSpacing: 0.5,
  },
  mainCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 16,
  },
  mainCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainCardLeft: {
    flex: 1,
  },
  mainCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  mainCardDesc: {
    fontSize: 13,
  },
  statusDot: {
    marginRight: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  mainSwitch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
  },
  divider: {
    height: 0.5,
    marginVertical: 12,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permInfo: {
    flex: 1,
  },
  permLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  permDesc: {
    fontSize: 12,
  },
  permBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  permBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingValue: {
    fontSize: 12,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infiniteBtn: {
    width: 36,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infiniteBtnText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  stepValue: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
  speedBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  speedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  speedBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  appsCard: {
    // inherits card styles
  },
  appsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  appsManage: {
    fontSize: 14,
    fontWeight: '600',
  },
  appsDesc: {
    fontSize: 13,
  },
  lastNotifRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifIconText: {
    fontSize: 20,
  },
  notifInfo: {
    flex: 1,
  },
  notifApp: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: 12,
  },
  notifTime: {
    fontSize: 12,
  },
  testBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  testBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
