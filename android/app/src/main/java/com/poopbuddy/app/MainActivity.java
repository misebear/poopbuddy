package com.poopbuddy.app;

import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    @Override
    public void onStart() {
        super.onStart();

        if (getBridge() == null || getBridge().getWebView() == null)
            return;
        WebView webView = getBridge().getWebView();

        // ── User-Agent에서 "wv" 제거 (카카오톡 로그인 버튼 표시) ──
        WebSettings settings = webView.getSettings();
        String ua = settings.getUserAgentString();
        if (ua != null && ua.contains(" wv)")) {
            ua = ua.replace(" wv)", ")");
            settings.setUserAgentString(ua);
        }

        // ── 뒤로가기 핸들러 (Bridge 초기화 후 등록 → 최고 우선순위) ──
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = getBridge().getWebView();
                if (wv == null) {
                    moveTaskToBack(true);
                    return;
                }

                String url = wv.getUrl();

                // 1) 외부 페이지(카카오 로그인 등) → 앱 메인으로 복귀
                if (url != null && !url.startsWith("https://localhost")) {
                    wv.loadUrl("https://localhost");
                    return;
                }

                // 2) 앱 내부 히스토리가 있으면 뒤로가기
                if (wv.canGoBack()) {
                    wv.goBack();
                    return;
                }

                // 3) 더 이상 뒤로갈 곳 없음 → 앱 백그라운드로 (종료X)
                moveTaskToBack(true);
            }
        });

        // ── BridgeWebViewClient 확장: intent:// / kakaotalk:// 처리 ──
        webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();

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

                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }
}
