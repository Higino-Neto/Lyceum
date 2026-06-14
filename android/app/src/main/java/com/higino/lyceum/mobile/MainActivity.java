package com.higino.lyceum.mobile;

import android.os.Bundle;
import android.content.Intent;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SourceFoldersPlugin.class);
        registerPlugin(IncomingBooksPlugin.class);
        super.onCreate(savedInstanceState);
        IncomingBooksPlugin.queueIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        IncomingBooksPlugin.queueIntent(intent);
    }
}
