package com.poopbuddy.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

final class WidgetStateStore {
    static final String ACTION_LOG_PEE = "com.poopbuddy.app.widget.LOG_PEE";
    static final String ACTION_LOG_POO = "com.poopbuddy.app.widget.LOG_POO";
    static final String ACTION_LOG_ACCIDENT = "com.poopbuddy.app.widget.LOG_ACCIDENT";
    static final String ACTION_REFRESH = "com.poopbuddy.app.widget.REFRESH";
    static final String EXTRA_PAGE = "pb_page";

    private static final String PREFS = "poopbuddy_widget_state";
    private static final String KEY_PENDING_EVENTS = "pending_events";

    private WidgetStateStore() {
    }

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void saveMirror(Context context, JSObject data) {
        SharedPreferences.Editor editor = prefs(context).edit();
        String today = todayKey();
        editor.putString("today", today);
        editor.putString("lang", data.optString("lang", Locale.getDefault().getLanguage()));
        editor.putString("activePetName", data.optString("activePetName", ""));
        editor.putString("mode", data.optString("mode", "dog"));
        editor.putInt("peeCount", data.optInt("peeCount", 0));
        editor.putInt("pooCount", data.optInt("pooCount", 0));
        editor.putInt("accidentCount", data.optInt("accidentCount", 0));
        editor.putString("lastPooAt", data.optString("lastPooAt", ""));
        editor.putInt("lastScore", data.optInt("lastScore", -1));
        editor.putInt("lastBristol", data.optInt("lastBristol", -1));
        editor.apply();
    }

    static void addPendingEvent(Context context, String type) {
        SharedPreferences preferences = prefs(context);
        ensureToday(preferences);
        JSONArray events = pendingEvents(preferences);
        long now = System.currentTimeMillis();
        JSONObject event = new JSONObject();
        try {
            event.put("id", "widget-" + now + "-" + type);
            event.put("type", type);
            event.put("time", isoTime(now));
            event.put("pet", preferences.getString("mode", "dog"));
        } catch (JSONException ignored) {
            return;
        }

        events.put(event);
        SharedPreferences.Editor editor = preferences.edit();
        editor.putString(KEY_PENDING_EVENTS, events.toString());
        if ("pee".equals(type)) {
            editor.putInt("peeCount", preferences.getInt("peeCount", 0) + 1);
        } else if ("poo".equals(type)) {
            editor.putInt("pooCount", preferences.getInt("pooCount", 0) + 1);
            editor.putString("lastPooAt", event.optString("time", ""));
        } else if ("accident".equals(type)) {
            editor.putInt("accidentCount", preferences.getInt("accidentCount", 0) + 1);
        }
        editor.apply();
    }

    static JSONArray consumePendingEvents(Context context) {
        SharedPreferences preferences = prefs(context);
        JSONArray events = pendingEvents(preferences);
        preferences.edit().putString(KEY_PENDING_EVENTS, "[]").apply();
        return events;
    }

    static void ensureToday(SharedPreferences preferences) {
        String today = todayKey();
        if (today.equals(preferences.getString("today", ""))) {
            return;
        }
        preferences.edit()
            .putString("today", today)
            .putInt("peeCount", 0)
            .putInt("pooCount", 0)
            .putInt("accidentCount", 0)
            .apply();
    }

    static String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private static String isoTime(long millis) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date(millis));
    }

    private static JSONArray pendingEvents(SharedPreferences preferences) {
        try {
            return new JSONArray(preferences.getString(KEY_PENDING_EVENTS, "[]"));
        } catch (JSONException ignored) {
            return new JSONArray();
        }
    }
}
