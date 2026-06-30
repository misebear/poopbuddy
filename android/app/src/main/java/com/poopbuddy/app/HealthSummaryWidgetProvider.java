package com.poopbuddy.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;

public class HealthSummaryWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        PoopBuddyWidgetUpdater.updateHealth(context, appWidgetManager, appWidgetIds);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent != null ? intent.getAction() : "";
        if (WidgetStateStore.ACTION_LOG_PEE.equals(action)) {
            WidgetStateStore.addPendingEvent(context, "pee");
        } else if (WidgetStateStore.ACTION_LOG_POO.equals(action)) {
            WidgetStateStore.addPendingEvent(context, "poo");
        } else if (WidgetStateStore.ACTION_LOG_ACCIDENT.equals(action)) {
            WidgetStateStore.addPendingEvent(context, "accident");
        }
        PoopBuddyWidgetUpdater.updateAll(context);
    }
}
