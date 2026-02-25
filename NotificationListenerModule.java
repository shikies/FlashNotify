package com.flashnotify.notificationlistener;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class NotificationListenerModule extends ReactContextBaseJavaModule {
    private static final String TAG = "NotificationListenerModule";
    private static final String MODULE_NAME = "NotificationListenerModule";
    private static final String EVENT_NOTIFICATION         = "onNotificationReceived";
    private static final String EVENT_NOTIFICATION_REMOVED = "onNotificationRemoved";

    private final ReactApplicationContext reactContext;
    private BroadcastReceiver notificationReceiver;
    private int listenerCount = 0;

    public NotificationListenerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void addListener(String eventName) {
        if (listenerCount == 0) {
            startListening();
        }
        listenerCount++;
    }

    @ReactMethod
    public void removeListeners(int count) {
        listenerCount -= count;
        if (listenerCount <= 0) {
            listenerCount = 0;
            stopListening();
        }
    }

    @ReactMethod
    public void isNotificationListenerEnabled(com.facebook.react.bridge.Promise promise) {
        try {
            promise.resolve(isNotificationServiceEnabled());
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void openNotificationListenerSettings(com.facebook.react.bridge.Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    private boolean isNotificationServiceEnabled() {
        String pkgName = reactContext.getPackageName();
        String flat = Settings.Secure.getString(
            reactContext.getContentResolver(),
            "enabled_notification_listeners"
        );
        if (!TextUtils.isEmpty(flat)) {
            String[] names = flat.split(":");
            for (String name : names) {
                ComponentName cn = ComponentName.unflattenFromString(name);
                if (cn != null && pkgName.equals(cn.getPackageName())) {
                    return true;
                }
            }
        }
        return false;
    }

    private void startListening() {
        if (notificationReceiver != null) return;

        notificationReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();

                if (FlashNotifyListenerService.ACTION_NOTIFICATION_RECEIVED.equals(action)) {
                    WritableMap params = Arguments.createMap();
                    params.putString("packageName", intent.getStringExtra(FlashNotifyListenerService.EXTRA_PACKAGE_NAME));
                    params.putString("appName",     intent.getStringExtra(FlashNotifyListenerService.EXTRA_APP_NAME));
                    params.putString("title",       intent.getStringExtra(FlashNotifyListenerService.EXTRA_TITLE));
                    params.putString("text",        intent.getStringExtra(FlashNotifyListenerService.EXTRA_TEXT));
                    params.putString("key",         intent.getStringExtra(FlashNotifyListenerService.EXTRA_KEY));
                    sendEvent(EVENT_NOTIFICATION, params);

                } else if (FlashNotifyListenerService.ACTION_NOTIFICATION_REMOVED.equals(action)) {
                    WritableMap params = Arguments.createMap();
                    params.putString("packageName", intent.getStringExtra(FlashNotifyListenerService.EXTRA_PACKAGE_NAME));
                    params.putString("key",         intent.getStringExtra(FlashNotifyListenerService.EXTRA_KEY));
                    sendEvent(EVENT_NOTIFICATION_REMOVED, params);
                }
            }
        };

        // Register for both posted and removed broadcasts
        IntentFilter filter = new IntentFilter();
        filter.addAction(FlashNotifyListenerService.ACTION_NOTIFICATION_RECEIVED);
        filter.addAction(FlashNotifyListenerService.ACTION_NOTIFICATION_REMOVED);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(notificationReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            reactContext.registerReceiver(notificationReceiver, filter);
        }
        Log.d(TAG, "Started listening for notifications");
    }

    private void stopListening() {
        if (notificationReceiver != null) {
            try {
                reactContext.unregisterReceiver(notificationReceiver);
            } catch (Exception e) {
                Log.w(TAG, "Error unregistering receiver", e);
            }
            notificationReceiver = null;
        }
    }

    private void sendEvent(String eventName, WritableMap params) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        } catch (Exception e) {
            Log.e(TAG, "Error sending event", e);
        }
    }

    @Override
    public void onCatalystInstanceDestroy() {
        stopListening();
    }
}
