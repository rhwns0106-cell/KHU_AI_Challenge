package app.orca.khu;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RunNotifyPlugin.class);
        super.onCreate(savedInstanceState);
        // 안드로이드 13+: 알림 권한이 없으면 '기록 중' 알림이 잠금화면·알림창에 안 보인다(기록 플러그인은 이걸 묻지 않음)
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
    }
}
