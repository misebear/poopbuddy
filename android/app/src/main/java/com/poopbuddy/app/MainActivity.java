package com.poopbuddy.app;

import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    @Override
    public void onStart() {
        super.onStart();

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();

            // ── User-Agent에서 "wv" 제거 ──
            // WebView UA: "...Chrome/xxx Mobile Safari/537.36 wv)"
            // 일반 Chrome: "...Chrome/xxx Mobile Safari/537.36)"
            // 카카오 로그인 페이지가 WebView를 감지하면 "카카오톡으로 로그인" 버튼을 숨김
            // "wv"를 제거하면 일반 브라우저로 인식 → 카카오톡 앱 로그인 버튼 표시
            WebSettings settings = webView.getSettings();
            String ua = settings.getUserAgentString();
            if (ua != null && ua.contains(" wv)")) {
                ua = ua.replace(" wv)", ")");
                settings.setUserAgentString(ua);
            }

            // ── BridgeWebViewClient 확장: intent:// / kakaotalk:// 처리 ──
            webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    String url = request.getUrl().toString();

                    // intent:// 스킴 처리 (카카오톡 앱 호출용)
                    if (url.startsWith("intent://")) {
                        try {
                            Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                            if (intent != null) {
                                if (intent.resolveActivity(getPackageManager()) != null) {
                                    startActivity(intent);
                                    return true;
                                }
                                String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                                if (fallbackUrl != null) {
                                    view.loadUrl(fallbackUrl);
                                    return true;
                                }
                                String packageName = intent.getPackage();
                                if (packageName != null) {
                                    startActivity(new Intent(Intent.ACTION_VIEW,
                                            Uri.parse("market://details?id=" + packageName)));
                                    return true;
                                }
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                        return true;
                    }

                    // kakaotalk:// 스킴 처리
                    if (url.startsWith("kakaotalk://")) {
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                            if (intent.resolveActivity(getPackageManager()) != null) {
                                startActivity(intent);
                                return true;
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                        return true;
                    }

                    // 나머지는 Capacitor 기본 처리에 위임
                    return super.shouldOverrideUrlLoading(view, request);
                }
            });
        }
    }
}
