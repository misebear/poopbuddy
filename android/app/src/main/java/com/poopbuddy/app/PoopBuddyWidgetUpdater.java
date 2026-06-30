package com.poopbuddy.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

final class PoopBuddyWidgetUpdater {
    private PoopBuddyWidgetUpdater() {
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        updateQuick(context, manager, manager.getAppWidgetIds(new ComponentName(context, QuickLogWidgetProvider.class)));
        updateHealth(context, manager, manager.getAppWidgetIds(new ComponentName(context, HealthSummaryWidgetProvider.class)));
    }

    static void updateQuick(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        SharedPreferences prefs = WidgetStateStore.prefs(context);
        WidgetStateStore.ensureToday(prefs);
        for (int widgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_log);
            views.setTextViewText(R.id.widgetQuickTitle, title(context, prefs, R.string.widget_quick_title));
            views.setTextViewText(R.id.widgetQuickSummary, todaySummary(context, prefs));
            views.setOnClickPendingIntent(R.id.widgetQuickRoot, openApp(context, "calendar", 10 + widgetId));
            views.setOnClickPendingIntent(R.id.widgetQuickPee, widgetAction(context, QuickLogWidgetProvider.class, WidgetStateStore.ACTION_LOG_PEE, 20 + widgetId));
            views.setOnClickPendingIntent(R.id.widgetQuickPoo, widgetAction(context, QuickLogWidgetProvider.class, WidgetStateStore.ACTION_LOG_POO, 30 + widgetId));
            views.setOnClickPendingIntent(R.id.widgetQuickAccident, widgetAction(context, QuickLogWidgetProvider.class, WidgetStateStore.ACTION_LOG_ACCIDENT, 40 + widgetId));
            manager.updateAppWidget(widgetId, views);
        }
    }

    static void updateHealth(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        SharedPreferences prefs = WidgetStateStore.prefs(context);
        WidgetStateStore.ensureToday(prefs);
        for (int widgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_health_summary);
            views.setTextViewText(R.id.widgetHealthTitle, title(context, prefs, R.string.widget_health_title));
            views.setTextViewText(R.id.widgetHealthScore, scoreText(context, prefs));
            views.setTextViewText(R.id.widgetHealthSummary, healthSummary(context, prefs));
            views.setOnClickPendingIntent(R.id.widgetHealthRoot, openApp(context, "calendar", 50 + widgetId));
            views.setOnClickPendingIntent(R.id.widgetHealthOpen, openApp(context, "calendar", 60 + widgetId));
            views.setOnClickPendingIntent(R.id.widgetHealthPoo, widgetAction(context, HealthSummaryWidgetProvider.class, WidgetStateStore.ACTION_LOG_POO, 70 + widgetId));
            manager.updateAppWidget(widgetId, views);
        }
    }

    private static PendingIntent widgetAction(Context context, Class<?> receiver, String action, int requestCode) {
        Intent intent = new Intent(context, receiver);
        intent.setAction(action);
        return PendingIntent.getBroadcast(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent openApp(Context context, String page, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("https://localhost/?page=" + page));
        intent.putExtra(WidgetStateStore.EXTRA_PAGE, page);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String title(Context context, SharedPreferences prefs, int fallbackRes) {
        String pet = prefs.getString("activePetName", "");
        if (pet == null || pet.trim().isEmpty()) {
            return context.getString(fallbackRes);
        }
        return pet.trim();
    }

    private static String todaySummary(Context context, SharedPreferences prefs) {
        int pee = prefs.getInt("peeCount", 0);
        int poo = prefs.getInt("pooCount", 0);
        int accident = prefs.getInt("accidentCount", 0);
        if (pee + poo + accident == 0) {
            return context.getString(R.string.widget_empty_today);
        }
        String lang = prefs.getString("lang", "en");
        if ("ko".equals(lang)) {
            return "소변 " + pee + " · 대변 " + poo + " · 실수 " + accident;
        }
        if ("ja".equals(lang)) {
            return "尿 " + pee + " · 便 " + poo + " · 失敗 " + accident;
        }
        return "Pee " + pee + " · Poop " + poo + " · Oops " + accident;
    }

    private static String scoreText(Context context, SharedPreferences prefs) {
        int score = prefs.getInt("lastScore", -1);
        int bristol = prefs.getInt("lastBristol", -1);
        if (score < 0) {
            return context.getString(R.string.widget_no_score);
        }
        String suffix = bristol > 0 ? " · T" + bristol : "";
        return score + "/100" + suffix;
    }

    private static String healthSummary(Context context, SharedPreferences prefs) {
        String summary = todaySummary(context, prefs);
        String lastPooAt = prefs.getString("lastPooAt", "");
        if (lastPooAt == null || lastPooAt.isEmpty()) {
            return summary;
        }
        String lang = prefs.getString("lang", "en");
        if ("ko".equals(lang)) {
            return summary + "\n최근 대변 기록 있음";
        }
        if ("ja".equals(lang)) {
            return summary + "\n最近の便記録あり";
        }
        return summary + "\nRecent poop logged";
    }
}
