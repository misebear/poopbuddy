package com.poopbuddy.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ── 뒤로가기 버튼: 외부 페이지(카카오 로그인 등)에서 앱 메인으로 복귀 ──
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    WebView webView = getBridge().getWebView();
                    String url = webView.getUrl();

                    // 외부 페이지에서 뒤로가기 → 앱 메인으로 복귀
                    if (url != null && !url.contains("localhost")) {
                        webView.loadUrl("https://localhost");
                        return;
                    }

                    // 앱 내부에서 뒤로가기 → WebView 히스토리 뒤로
                    if (webView.canGoBack()) {
                        webView.goBack();
                        return;
                    }
                }
                // 더 이상 뒤로갈 곳이 없으면 앱 종료
                finish();
            }
        });
    }

    @Override
    public void onStart() {
        super.onStart();

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();

            // ── User-Agent에서 "wv" 제거 ──
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

                    return super.shouldOverrideUrlLoading(view, request);
                }
            });
        }
    }
}
