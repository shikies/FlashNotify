
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.CompoundButton;
import android.widget.ImageButton;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;

import com.flashnotify.notificationlistener.FlashNotifyListenerService;

import java.util.HashSet;
import java.util.Set;

public class MainActivity extends AppCompatActivity {

    private Switch switchMain;
    private TextView tvStatus;
    private TextView tvPermCamera;
    private TextView tvPermNotification;
    private Button btnGrantCamera;
    private Button btnGrantNotification;
    private Button btnTestFlash;
    private Button btnSelectApps;
    private TextView tvSelectedApps;
    private TextView tvFlashCount;
    private TextView tvFlashSpeed;
    private ImageButton btnFlashCountMinus;
    private ImageButton btnFlashCountPlus;
    private Button btnFlashCountInfinite;
    private Button btnSpeedFast;
    private Button btnSpeedMedium;
    private Button btnSpeedSlow;
    private Button btnSpeedVeryFast;
    private Switch switchStopOnDismiss;

    private SharedPreferences prefs;