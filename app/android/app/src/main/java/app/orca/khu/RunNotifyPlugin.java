package app.orca.khu;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// 달리는 중 알림(잠금화면에도 보임)을 '2.31km · 14:20 · 페이스' 같은 실시간 기록으로 바꾼다
@CapacitorPlugin(name = "RunNotify")
public class RunNotifyPlugin extends Plugin {
    // 기록 플러그인(background-geolocation)의 포그라운드 서비스 알림과 같은 번호 → 알림이 두 개 생기지 않고 그 알림 내용이 바뀐다
    static final int ID = 28351;
    static final String CH = "orca_run";

    @PluginMethod
    public void update(PluginCall call) {
        Context c = getContext();
        NotificationManager m = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && m.getNotificationChannel(CH) == null) {
            NotificationChannel ch = new NotificationChannel(CH, "달리기 기록", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setSound(null, null);
            ch.enableVibration(false);
            ch.setShowBadge(false);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            m.createNotificationChannel(ch);
        }
        String text = call.getString("text", "");
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
        b.setContentTitle(call.getString("title", "RUNKHU"))
            .setContentText(text)
            .setStyle(new Notification.BigTextStyle().bigText(text))
            .setSmallIcon(R.drawable.ic_stat_orca)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setVisibility(Notification.VISIBILITY_PUBLIC);
        if (open != null) {
            open.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            b.setContentIntent(PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        try { m.notify(ID, b.build()); } catch (SecurityException e) { /* 알림 권한 거절: 기록은 계속된다 */ }
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        ((NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE)).cancel(ID);
        call.resolve();
    }
}
