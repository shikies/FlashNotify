package com.flashnotify;

import android.content.SharedPreferences;
import com.flashnotify.notificationlistener.FlashNotifyListenerService;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class AppSelectorActivity extends AppCompatActivity {

    private RecyclerView recyclerView;
    private AppAdapter adapter;
    private SharedPreferences prefs;
    private Set<String> selectedPackages;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_app_selector);

        if (getSupportActionBar() != null) {
            getSupportActionBar().setTitle("选择监听的应用");
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        }

        prefs = getSharedPreferences(FlashNotifyListenerService.PREFS_NAME, MODE_PRIVATE);
        selectedPackages = new HashSet<>(prefs.getStringSet(
                FlashNotifyListenerService.KEY_MONITORED_PACKAGES, new HashSet<>()));

        recyclerView = findViewById(R.id.recycler_apps);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));

        loadApps();
    }

    private void loadApps() {
        PackageManager pm = getPackageManager();
        List<ApplicationInfo> installedApps = pm.getInstalledApplications(PackageManager.GET_META_DATA);

        List<AppInfo> userApps = new ArrayList<>();
        for (ApplicationInfo app : installedApps) {
            // 只显示用户安装的应用和常见系统应用
            if ((app.flags & ApplicationInfo.FLAG_SYSTEM) == 0
                    || isCommonSystemApp(app.packageName)) {
                AppInfo info = new AppInfo();
                info.packageName = app.packageName;
                info.appName = pm.getApplicationLabel(app).toString();
                info.icon = pm.getApplicationIcon(app);
                userApps.add(info);
            }
        }

        Collections.sort(userApps, (a, b) -> a.appName.compareToIgnoreCase(b.appName));

        adapter = new AppAdapter(userApps);
        recyclerView.setAdapter(adapter);
    }

    private boolean isCommonSystemApp(String pkg) {
        String[] common = {
            "com.tencent.mm", "com.tencent.mobileqq", "com.alibaba.android.rimet",
            "org.telegram.messenger", "com.whatsapp", "com.facebook.katana",
            "com.android.mms", "com.google.android.apps.messaging",
            "com.android.dialer", "com.google.android.dialer"
        };
        for (String c : common) {
            if (c.equals(pkg)) return true;
        }
        return false;
    }

    @Override
    public boolean onSupportNavigateUp() {
        finish();
        return true;
    }

    @Override
    protected void onPause() {
        super.onPause();
        // 保存选择
        prefs.edit().putStringSet(
                FlashNotifyListenerService.KEY_MONITORED_PACKAGES, selectedPackages).apply();
    }

    static class AppInfo {
        String packageName;
        String appName;
        android.graphics.drawable.Drawable icon;
    }

    class AppAdapter extends RecyclerView.Adapter<AppAdapter.ViewHolder> {
        private List<AppInfo> apps;

        AppAdapter(List<AppInfo> apps) {
            this.apps = apps;
        }

        @NonNull
        @Override
        public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View v = LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.item_app, parent, false);
            return new ViewHolder(v);
        }

        @Override
        public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
            AppInfo app = apps.get(position);
            holder.tvAppName.setText(app.appName);
            holder.tvPackageName.setText(app.packageName);
            holder.ivAppIcon.setImageDrawable(app.icon);
            holder.checkBox.setChecked(selectedPackages.contains(app.packageName));

            holder.itemView.setOnClickListener(v -> {
                boolean checked = !holder.checkBox.isChecked();
                holder.checkBox.setChecked(checked);
                if (checked) {
                    selectedPackages.add(app.packageName);
                } else {
                    selectedPackages.remove(app.packageName);
                }
            });
        }

        @Override
        public int getItemCount() {
            return apps.size();
        }

        class ViewHolder extends RecyclerView.ViewHolder {
            ImageView ivAppIcon;
            TextView tvAppName;
            TextView tvPackageName;
            CheckBox checkBox;

            ViewHolder(View itemView) {
                super(itemView);
                ivAppIcon = itemView.findViewById(R.id.iv_app_icon);
                tvAppName = itemView.findViewById(R.id.tv_app_name);
                tvPackageName = itemView.findViewById(R.id.tv_package_name);
                checkBox = itemView.findViewById(R.id.checkbox_app);
            }
        }
    }
}
