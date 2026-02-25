package com.flashnotify.notificationlistener;

import android.app.Notification;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import java.util.HashSet;
import java.util.Set;

public class FlashNotifyListenerService extends NotificationListenerService {
    private static final String TAG = "FlashNotifyListener";

    // ── Broadcast actions ──────────────────────────────────────────────────
    public static final String ACTION_NOTIFICATION_RECEIVED = "com.flashnotify.NOTIFICATION_RECEIVED";
    public static final String ACTION_NOTIFICATION_REMOVED  = "com.flashnotify.NOTIFICATION_REMOVED";
    public static final String ACTION_TRIGGER_FLASH         = "com.flashnotify.TRIGGER_FLASH";
    public static final String ACTION_STOP_FLASH            = "com.flashnotify.STOP_FLASH";

    // ── Broadcast extras ───────────────────────────────────────────────────
    public static final String EXTRA_PACKAGE_NAME  = "packageName";
    public static final String EXTRA_APP_NAME      = "appName";
    public static final String EXTRA_TITLE         = "title";
    public static final String EXTRA_TEXT          = "text";
    public static final String EXTRA_KEY           = "notificationKey";
    public static final String EXTRA_FLASH_COUNT   = "flashCount";
    public static final String EXTRA_FLASH_INTERVAL= "flashInterval";

    // ── SharedPreferences keys ─────────────────────────────────────────────
    public static final String PREFS_NAME              = "FlashNotifyPrefs";
    public static final String KEY_ENABLED             = "enabled";
    public static final String KEY_FLASH_COUNT         = "flashCount";
    public static final String KEY_FLASH_INTERVAL      = "flashInterval";
    public static final String KEY_MONITORED_PACKAGES  = "monitoredPackages";
    public static final String KEY_INFINITE_FLASH      = "infiniteFlash";
    public static final String KEY_STOP_ON_DISMISS     = "stopOnDismiss";

    // ── Flash state ────────────────────────────────────────────────────────
    private static final Handler flashHandler = new Handler(Looper.getMainLooper());
    private static Runnable flashRunnable = null;
    private static boolean isFlashing = false;
    // Key of the notification that triggered the current flash sequence
    private static String activeNotificationKey = null;

    // ──────────────────────────────────────────────────────────────────────
    // Notification lifecycle callbacks
    // ──────────────────────────────────────────────────────────────────────

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            boolean enabled = prefs.getBoolean(KEY_ENABLED, false);
            if (!enabled) return;

            String packageName = sbn.getPackageName();

            // Package filter
            Set<String> monitored = prefs.getStringSet(KEY_MONITORED_PACKAGES, new HashSet<>());
            if (!monitored.isEmpty() && !monitored.contains(packageName)) return;

            Notification notification = sbn.getNotification();
            Bundle extras = notification.extras;
            String title = extras.getString(Notification.EXTRA_TITLE, "");
            String text  = extras.getString(Notification.EXTRA_TEXT, "");

            String appName = packageName;
            try {
                appName = getPackageManager()
                    .getApplicationLabel(
                        getPackageManager().getApplicationInfo(packageName, 0)
                    ).toString();
            } catch (Exception e) {
                Log.w(TAG, "Could not get app name for " + packageName);
            }

            Log.d(TAG, "Notification from: " + packageName + " title: " + title);

            // Broadcast to UI layer (React Native / MainActivity)
            Intent intent = new Intent(ACTION_NOTIFICATION_RECEIVED);
            intent.setPackage(getPackageName());
            intent.putExtra(EXTRA_PACKAGE_NAME, packageName);
            intent.putExtra(EXTRA_APP_NAME, appName);
            intent.putExtra(EXTRA_TITLE, title);
            intent.putExtra(EXTRA_TEXT, text);
            intent.putExtra(EXTRA_KEY, sbn.getKey());
            sendBroadcast(intent);

            // Trigger flash directly from the service
            int flashCount    = prefs.getInt(KEY_FLASH_COUNT, 5);
            int flashInterval = prefs.getInt(KEY_FLASH_INTERVAL, 300);
            boolean infinite  = prefs.getBoolean(KEY_INFINITE_FLASH, false);

            activeNotificationKey = sbn.getKey();
            startFlash(this, infinite ? -1 : flashCount, flashInterval);

        } catch (Exception e) {
            Log.e(TAG, "Error processing notification", e);
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        try {
            String packageName = sbn.getPackageName();
            Log.d(TAG, "Notification removed from: " + packageName);

            // Broadcast removal to UI layer
            Intent intent = new Intent(ACTION_NOTIFICATION_REMOVED);
            intent.setPackage(getPackageName());
            intent.putExtra(EXTRA_PACKAGE_NAME, packageName);
            intent.putExtra(EXTRA_KEY, sbn.getKey());
            sendBroadcast(intent);

            // Stop flash if stopOnDismiss is enabled and this is the active notification
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            boolean stopOnDismiss = prefs.getBoolean(KEY_STOP_ON_DISMISS, true);
            if (stopOnDismiss && isFlashing) {
                String removedKey = sbn.getKey();
                if (activeNotificationKey == null || activeNotificationKey.equals(removedKey)) {
                    stopFlash(this);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing notification removal", e);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Flash control – static helpers so they can be called from MainActivity
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Start a flash sequence.
     * @param count Number of flashes; -1 = infinite
     * @param intervalMs On+off cycle duration in ms
     */
    public static void startFlash(Context context, int count, int intervalMs) {
        stopFlash(context); // cancel any in-progress sequence first
        isFlashing = true;

        final boolean infinite = (count < 0);
        final CameraManager cm = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
        if (cm == null) return;

        String cameraId;
        try {
            cameraId = cm.getCameraIdList()[0];
        } catch (CameraAccessException e) {
            Log.e(TAG, "Cannot get camera id", e);
            return;
        }
        final String id = cameraId;
        final int half = Math.max(50, intervalMs / 2);

        final int[] remaining = {infinite ? Integer.MAX_VALUE : count};

        flashRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isFlashing || remaining[0] <= 0) {
                    torchOff(cm, id);
                    isFlashing = false;
                    return;
                }
                // ON
                torchOn(cm, id);
                flashHandler.postDelayed(() -> {
                    if (!isFlashing) { torchOff(cm, id); return; }
                    // OFF
                    torchOff(cm, id);
                    remaining[0]--;
                    flashHandler.postDelayed(flashRunnable, half);
                }, half);
            }
        };
        flashHandler.post(flashRunnable);
    }

    /** Stop any ongoing flash sequence and turn off the torch. */
    public static void stopFlash(Context context) {
        isFlashing = false;
        activeNotificationKey = null;
        if (flashRunnable != null) {
            flashHandler.removeCallbacks(flashRunnable);
            flashRunnable = null;
        }
        try {
            CameraManager cm = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
            if (cm != null) {
                String id = cm.getCameraIdList()[0];
                cm.setTorchMode(id, false);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not turn off torch", e);
        }
    }

    // ── Convenience wrappers called from MainActivity ──────────────────────

    /** Called by MainActivity test button */
    public static void triggerFlashExternal(Context context, int count, int intervalMs) {
        startFlash(context, count, intervalMs);
    }

    /** Called by MainActivity when stopOnDismiss is triggered from UI */
    public static void stopFlashExternal(Context context) {
        stopFlash(context);
    }

    // ── Low-level torch helpers ────────────────────────────────────────────

    private static void torchOn(CameraManager cm, String id) {
        try { cm.setTorchMode(id, true); } catch (Exception e) { Log.w(TAG, "torchOn failed", e); }
    }

    private static void torchOff(CameraManager cm, String id) {
        try { cm.setTorchMode(id, false); } catch (Exception e) { Log.w(TAG, "torchOff failed", e); }
    }
}
