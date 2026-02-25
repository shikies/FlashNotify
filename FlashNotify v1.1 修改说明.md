# FlashNotify v1.1 修改说明

## 新增功能

### 1. 无限次闪光（∞ 模式）

**功能描述**：在"闪烁次数"设置中新增 **∞ 按钮**，点击后切换为无限循环闪烁模式。闪烁将持续进行，直到通知被清除（若同时开启"消息消失后停止"）或用户手动点击"停止闪烁"按钮。

**涉及修改的文件**：

| 文件 | 修改内容 |
|------|----------|
| `use-settings.ts` | `AppSettings` 接口新增 `infiniteFlash: boolean` 字段，默认 `false` |
| `use-flashlight.ts` | `flash(count, interval)` 支持 `count = -1` 表示无限循环；新增 `stopRequestedRef` 用于安全中断 |
| `index.tsx` | 闪烁次数区域新增 `∞` 切换按钮（激活时高亮显示）；`+/−` 步进器在无限模式下禁用变灰；次数显示改为"无限次" |
| `activity_main.xml` | 闪烁次数行新增 `btn_flash_count_infinite`（∞）按钮 |
| `MainActivity.java` | 读写 `KEY_INFINITE_FLASH` 偏好设置；`∞` 按钮点击切换状态并更新 UI；`+` 按钮上限取消（无限模式时禁用） |
| `FlashNotifyListenerService.java` | 新增 `KEY_INFINITE_FLASH` 常量；`startFlash()` 支持 `count = -1` 无限循环 |

---

### 2. 消息消失后停止闪光

**功能描述**：新增"**消息消失后停止**"开关（默认开启）。当通知被用户下拉清除或系统自动移除时，正在进行的闪烁序列将立即停止。精确匹配触发本次闪烁的通知 key，避免误停。

**涉及修改的文件**：

| 文件 | 修改内容 |
|------|----------|
| `FlashNotifyListenerService.java` | `onNotificationRemoved()` 从空实现改为：广播 `ACTION_NOTIFICATION_REMOVED`；读取 `KEY_STOP_ON_DISMISS` 偏好，若开启则调用 `stopFlash()` |
| `NotificationListenerModule.java` | 同时注册 `ACTION_NOTIFICATION_RECEIVED` 和 `ACTION_NOTIFICATION_REMOVED` 广播；收到移除事件时向 JS 层发送 `onNotificationRemoved` 事件 |
| `index.ts`（模块导出） | 新增 `NotificationRemovedEvent` 接口；新增 `addRemovedListener()` 方法 |
| `use-settings.ts` | 新增 `stopOnDismiss: boolean` 字段，默认 `true` |
| `use-notification-listener.ts` | 新增 `onRemoved` 回调参数；注册 `addRemovedListener` 订阅 |
| `index.tsx` | 新增 `activeNotificationKeyRef` 记录触发闪烁的通知 key；`handleNotificationRemoved` 回调在 key 匹配时调用 `stopFlash()`；UI 新增"消息消失后停止"Switch 控件 |
| `activity_main.xml` | 闪烁设置卡片底部新增"消息消失后停止"行（含说明文字和 Switch） |
| `MainActivity.java` | 读写 `KEY_STOP_ON_DISMISS` 偏好；注册/注销 `ACTION_NOTIFICATION_REMOVED` 广播接收器；收到移除广播时调用 `FlashNotifyListenerService.stopFlashExternal()` |

---

## 架构说明

```
通知到达
  └─ FlashNotifyListenerService.onNotificationPosted()
       ├─ 广播 ACTION_NOTIFICATION_RECEIVED（→ React Native JS 层）
       └─ 直接调用 startFlash(count, interval)  ← count=-1 表示无限

通知消失
  └─ FlashNotifyListenerService.onNotificationRemoved()
       ├─ 广播 ACTION_NOTIFICATION_REMOVED（→ React Native JS 层）
       └─ 若 stopOnDismiss=true 且 key 匹配 → stopFlash()
```

## 向后兼容

- 新字段均有默认值：`infiniteFlash = false`、`stopOnDismiss = true`，旧版用户升级后行为不变。
- 原有的 1–20 次闪烁上限已移除，现在 `+` 按钮无上限（有限模式下可无限增加）。
