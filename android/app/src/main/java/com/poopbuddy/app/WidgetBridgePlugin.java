package com.poopbuddy.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    @PluginMethod
    public void syncWidgetState(PluginCall call) {
        JSObject data = call.getData();
        WidgetStateStore.saveMirror(getContext(), data);
        PoopBuddyWidgetUpdater.updateAll(getContext());
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void consumePendingEvents(PluginCall call) {
        JSONArray events = WidgetStateStore.consumePendingEvents(getContext());
        PoopBuddyWidgetUpdater.updateAll(getContext());
        JSObject result = new JSObject();
        result.put("events", events);
        call.resolve(result);
    }

    @PluginMethod
    public void refreshWidgets(PluginCall call) {
        PoopBuddyWidgetUpdater.updateAll(getContext());
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }
}
