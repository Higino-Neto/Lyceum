package com.higino.lyceum.mobile;

import android.os.Bundle;
import android.content.Intent;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SourceFoldersPlugin.class);
        registerPlugin(IncomingBooksPlugin.class);
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(ReaderControlsPlugin.class);
        super.onCreate(savedInstanceState);
        IncomingBooksPlugin.queueIntent(getIntent());
        registerBackNavigation();
    }

    /**
     * The web app keeps one history entry per open layer (reader, sheet, tab),
     * so the system back gesture closes the top layer instead of leaving the
     * app. With no web history left, back behaves as usual (app goes to the background).
     */
    private void registerBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    @Override
    public boolean dispatchKeyEvent(android.view.KeyEvent event) {
        return ReaderControlsPlugin.handleVolume(event) || super.dispatchKeyEvent(event);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        IncomingBooksPlugin.queueIntent(intent);
    }
}
