package com.higino.lyceum.mobile;

import android.os.Bundle;
import android.content.Intent;

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
