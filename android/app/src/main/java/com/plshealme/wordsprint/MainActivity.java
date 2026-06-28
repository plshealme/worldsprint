package com.plshealme.wordsprint;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.ServiceWorkerController;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String TRUSTED_HOST = "43.128.23.159.sslip.io";
    private static final String USER_AGENT_SUFFIX = " WordSprintAndroid/1.2.0";

    private WebView webView;
    private View loadingView;
    private LinearLayout errorView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#071633"));
        getWindow().setNavigationBarColor(Color.parseColor("#071633"));

        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        loadingView = createLoadingView();
        root.addView(loadingView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        errorView = createErrorView();
        root.addView(errorView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);

        configureWebView();
        loadHome();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setLoadsImagesAutomatically(true);
        settings.setBlockNetworkImage(false);
        settings.setBlockNetworkLoads(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        String defaultUserAgent = settings.getUserAgentString();
        if (defaultUserAgent == null || !defaultUserAgent.contains("WordSprintAndroid")) {
            settings.setUserAgentString((defaultUserAgent == null ? "" : defaultUserAgent) + USER_AGENT_SUFFIX);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }
        CookieManager.getInstance().setAcceptCookie(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            ServiceWorkerController.getInstance().getServiceWorkerWebSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
            ServiceWorkerController.getInstance().getServiceWorkerWebSettings().setBlockNetworkLoads(false);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse localWordAsset = loadLocalWordAsset(request.getUrl());
                if (localWordAsset != null) {
                    return localWordAsset;
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                WebResourceResponse localWordAsset = loadLocalWordAsset(Uri.parse(url));
                if (localWordAsset != null) {
                    return localWordAsset;
                }
                return super.shouldInterceptRequest(view, url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                showLoading();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                hideLoading();
                CookieManager.getInstance().flush();
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                hideLoading();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && request.isForMainFrame()) {
                    showError();
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (failingUrl != null && failingUrl.equals(view.getUrl())) {
                    showError();
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                showError();
            }
        });
    }

    private WebResourceResponse loadLocalWordAsset(Uri uri) {
        if (!isWordDataRequest(uri)) {
            return null;
        }

        String fileName = uri.getLastPathSegment();
        if (fileName == null || !fileName.endsWith(".json")) {
            return null;
        }

        try {
            InputStream stream = getAssets().open("words/" + fileName);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "public, max-age=31536000, immutable");
            headers.put("Access-Control-Allow-Origin", "*");
            return new WebResourceResponse("application/json", "utf-8", 200, "OK", headers, stream);
        } catch (IOException ignored) {
            Log.w("WordSprint", "word asset fallback network: " + fileName);
            return null;
        }
    }

    private boolean isWordDataRequest(Uri uri) {
        if (uri == null) {
            return false;
        }

        String scheme = uri.getScheme();
        String host = uri.getHost();
        String path = uri.getPath();
        if (!("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme))) {
            return false;
        }
        return TRUSTED_HOST.equalsIgnoreCase(host) && path != null && path.startsWith("/data/words/") && path.endsWith(".json");
    }

    private boolean handleUrl(Uri uri) {
        String scheme = uri.getScheme();
        if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
            if (TRUSTED_HOST.equalsIgnoreCase(uri.getHost())) {
                return false;
            }
            openExternal(uri);
            return true;
        }

        openExternal(uri);
        return true;
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            // Ignore unsupported schemes instead of crashing the test build.
        }
    }

    private void loadHome() {
        errorView.setVisibility(View.GONE);
        showLoading();
        webView.loadUrl(getString(R.string.launch_url));
    }

    private View createLoadingView() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.parseColor("#071633"));

        ImageView icon = new ImageView(this);
        icon.setImageResource(R.mipmap.ic_launcher);
        icon.setContentDescription(getString(R.string.app_name));
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(dp(96), dp(96));
        layout.addView(icon, iconParams);

        ProgressBar progressBar = new ProgressBar(this);
        LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        progressParams.topMargin = dp(22);
        layout.addView(progressBar, progressParams);

        TextView text = new TextView(this);
        text.setText(R.string.loading);
        text.setTextColor(Color.WHITE);
        text.setTextSize(15);
        LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        textParams.topMargin = dp(16);
        layout.addView(text, textParams);
        return layout;
    }

    private LinearLayout createErrorView() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(dp(28), dp(28), dp(28), dp(28));
        layout.setBackgroundColor(Color.WHITE);
        layout.setVisibility(View.GONE);

        TextView message = new TextView(this);
        message.setText(R.string.network_error);
        message.setTextColor(Color.parseColor("#0F172A"));
        message.setTextSize(17);
        message.setGravity(Gravity.CENTER);
        layout.addView(message);

        Button retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setAllCaps(false);
        retry.setOnClickListener(v -> loadHome());
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        buttonParams.topMargin = dp(18);
        layout.addView(retry, buttonParams);
        return layout;
    }

    private void showLoading() {
        loadingView.setVisibility(View.VISIBLE);
        errorView.setVisibility(View.GONE);
    }

    private void hideLoading() {
        loadingView.setVisibility(View.GONE);
    }

    private void showError() {
        loadingView.setVisibility(View.GONE);
        errorView.setVisibility(View.VISIBLE);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        super.onPause();
    }
}
