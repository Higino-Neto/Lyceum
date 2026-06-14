package com.higino.lyceum.mobile;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "IncomingBooks")
public class IncomingBooksPlugin extends Plugin {
    private static final long MAX_FILE_BYTES = 512L * 1024L * 1024L;
    private static final Map<String, Uri> PENDING = new LinkedHashMap<>();
    private static final Map<String, AtomicBoolean> CANCELLATIONS = new ConcurrentHashMap<>();
    private static IncomingBooksPlugin instance;

    @Override
    public void load() {
        instance = this;
        queueIntent(getActivity().getIntent());
    }

    public static synchronized void queueIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_VIEW.equals(action)) {
            addPending(intent.getData());
        } else if (Intent.ACTION_SEND.equals(action)) {
            addPending(intent.getParcelableExtra(Intent.EXTRA_STREAM));
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Uri> uris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (uris != null) for (Uri uri : uris) addPending(uri);
        }
        if (instance != null && !PENDING.isEmpty()) {
            JSObject event = new JSObject();
            event.put("count", PENDING.size());
            instance.notifyListeners("incomingFiles", event, true);
        }
    }

    private static void addPending(Uri uri) {
        if (uri != null) PENDING.put(uri.toString(), uri);
    }

    @PluginMethod
    public void pickFiles(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
            "application/pdf", "application/epub+zip", "text/plain", "application/octet-stream"
        });
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "filesPicked");
    }

    @ActivityCallback
    private void filesPicked(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Selecao de arquivos cancelada");
            return;
        }
        Intent data = result.getData();
        if (data.getData() != null) persistAndAdd(data.getData());
        ClipData clipData = data.getClipData();
        if (clipData != null) {
            for (int index = 0; index < clipData.getItemCount(); index++) persistAndAdd(clipData.getItemAt(index).getUri());
        }
        JSObject response = new JSObject();
        response.put("files", pendingFiles());
        call.resolve(response);
    }

    private void persistAndAdd(Uri uri) {
        if (uri == null) return;
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {
            // Some providers only grant access for the lifetime of this activity.
        }
        addPending(uri);
    }

    @PluginMethod
    public void getPendingFiles(PluginCall call) {
        JSObject response = new JSObject();
        response.put("files", pendingFiles());
        call.resolve(response);
    }

    private synchronized JSArray pendingFiles() {
        JSArray files = new JSArray();
        for (Uri uri : PENDING.values()) files.put(describe(uri));
        return files;
    }

    private JSObject describe(Uri uri) {
        JSObject file = new JSObject();
        String name = uri.getLastPathSegment() == null ? "livro" : uri.getLastPathSegment();
        long size = 0;
        String mimeType = getContext().getContentResolver().getType(uri);
        try (Cursor cursor = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (nameIndex >= 0 && !cursor.isNull(nameIndex)) name = cursor.getString(nameIndex);
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex);
            }
        } catch (Exception ignored) {
            // URI metadata varies across document providers.
        }
        file.put("uri", uri.toString());
        file.put("name", name);
        file.put("size", size);
        file.put("mimeType", mimeType == null ? "application/octet-stream" : mimeType);
        return file;
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        String uriValue = call.getString("uri");
        String requestId = call.getString("requestId", uriValue);
        if (uriValue == null || uriValue.isEmpty()) {
            call.reject("URI do arquivo ausente");
            return;
        }
        AtomicBoolean cancelled = new AtomicBoolean(false);
        CANCELLATIONS.put(requestId, cancelled);
        execute(() -> {
            Uri uri = Uri.parse(uriValue);
            long expected = describe(uri).optLong("size", 0L);
            try (InputStream input = getContext().getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                if (input == null) throw new IllegalStateException("Arquivo indisponivel");
                byte[] buffer = new byte[128 * 1024];
                long loaded = 0;
                int read;
                while ((read = input.read(buffer)) >= 0) {
                    if (cancelled.get()) throw new InterruptedException("Importacao cancelada");
                    loaded += read;
                    if (loaded > MAX_FILE_BYTES) throw new IllegalStateException("Arquivo excede 512 MB");
                    output.write(buffer, 0, read);
                    JSObject progress = new JSObject();
                    progress.put("requestId", requestId);
                    progress.put("loaded", loaded);
                    progress.put("total", expected);
                    notifyListeners("importProgress", progress);
                }
                JSObject response = new JSObject();
                response.put("base64", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
                call.resolve(response);
            } catch (InterruptedException error) {
                call.reject("Importacao cancelada", "IMPORT_CANCELLED", error);
            } catch (Exception error) {
                call.reject("Falha ao ler arquivo compartilhado", error);
            } finally {
                CANCELLATIONS.remove(requestId);
            }
        });
    }

    @PluginMethod
    public void cancelRead(PluginCall call) {
        String requestId = call.getString("requestId");
        AtomicBoolean cancellation = requestId == null ? null : CANCELLATIONS.get(requestId);
        if (cancellation != null) cancellation.set(true);
        call.resolve();
    }

    @PluginMethod
    public synchronized void acknowledge(PluginCall call) {
        String uri = call.getString("uri");
        if (uri != null) PENDING.remove(uri);
        call.resolve();
    }
}
