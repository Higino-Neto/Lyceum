package com.higino.lyceum.mobile;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
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

@CapacitorPlugin(name = "SourceFolders")
public class SourceFoldersPlugin extends Plugin {
    private static final int MAX_FILES = 5000;
    private static final long MAX_FILE_BYTES = 250L * 1024L * 1024L;

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("Selecao de pasta cancelada");
            return;
        }

        Uri uri = result.getData().getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            JSObject response = new JSObject();
            response.put("uri", uri.toString());
            response.put("name", queryDisplayName(uri, DocumentsContract.getTreeDocumentId(uri)));
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Nao foi possivel manter acesso a pasta", error);
        }
    }

    @PluginMethod
    public void scanFolder(PluginCall call) {
        String uriValue = call.getString("uri");
        if (uriValue == null || uriValue.isEmpty()) {
            call.reject("URI da pasta ausente");
            return;
        }

        execute(() -> {
            try {
                Uri treeUri = Uri.parse(uriValue);
                JSArray files = new JSArray();
                String rootId = DocumentsContract.getTreeDocumentId(treeUri);
                scanChildren(treeUri, rootId, "", files);
                JSObject response = new JSObject();
                response.put("files", files);
                response.put("name", queryDisplayName(treeUri, rootId));
                call.resolve(response);
            } catch (SecurityException error) {
                call.reject("O acesso a pasta expirou. Conecte a pasta novamente.", error);
            } catch (Exception error) {
                call.reject("Falha ao ler a pasta-fonte", error);
            }
        });
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        String uriValue = call.getString("uri");
        if (uriValue == null || uriValue.isEmpty()) {
            call.reject("URI do arquivo ausente");
            return;
        }

        execute(() -> {
            try (InputStream input = getContext().getContentResolver().openInputStream(Uri.parse(uriValue));
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                if (input == null) throw new IllegalStateException("Arquivo indisponivel");
                byte[] buffer = new byte[64 * 1024];
                long total = 0;
                int read;
                while ((read = input.read(buffer)) >= 0) {
                    total += read;
                    if (total > MAX_FILE_BYTES) throw new IllegalStateException("Arquivo excede 250 MB");
                    output.write(buffer, 0, read);
                }
                JSObject response = new JSObject();
                response.put("base64", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
                call.resolve(response);
            } catch (Exception error) {
                call.reject("Falha ao ler arquivo da pasta-fonte", error);
            }
        });
    }

    @PluginMethod
    public void releaseFolder(PluginCall call) {
        String uriValue = call.getString("uri");
        if (uriValue == null || uriValue.isEmpty()) {
            call.resolve();
            return;
        }
        try {
            getContext().getContentResolver().releasePersistableUriPermission(
                Uri.parse(uriValue),
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
        } catch (SecurityException ignored) {
            // The permission may already have expired or been revoked by Android.
        }
        call.resolve();
    }

    private void scanChildren(Uri treeUri, String parentDocumentId, String relativePath, JSArray files) throws Exception {
        if (files.length() >= MAX_FILES) return;
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentDocumentId);
        String[] projection = {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE
        };

        try (Cursor cursor = getContext().getContentResolver().query(childrenUri, projection, null, null, null)) {
            if (cursor == null) return;
            while (cursor.moveToNext() && files.length() < MAX_FILES) {
                String documentId = cursor.getString(0);
                String name = cursor.getString(1);
                String mimeType = cursor.getString(2);
                long size = cursor.isNull(3) ? 0 : cursor.getLong(3);
                String childPath = relativePath.isEmpty() ? name : relativePath + "/" + name;
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mimeType)) {
                    scanChildren(treeUri, documentId, childPath, files);
                } else if (isSupported(name, mimeType)) {
                    JSObject file = new JSObject();
                    file.put("uri", DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId).toString());
                    file.put("name", name);
                    file.put("relativePath", childPath);
                    file.put("mimeType", mimeType == null ? "application/octet-stream" : mimeType);
                    file.put("size", size);
                    files.put(file);
                }
            }
        }
    }

    private String queryDisplayName(Uri treeUri, String documentId) {
        Uri documentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId);
        String[] projection = { DocumentsContract.Document.COLUMN_DISPLAY_NAME };
        try (Cursor cursor = getContext().getContentResolver().query(documentUri, projection, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) return cursor.getString(0);
        } catch (Exception ignored) {
            // Fall back to the document id below.
        }
        int separator = documentId.lastIndexOf(':');
        return separator >= 0 ? documentId.substring(separator + 1) : documentId;
    }

    private boolean isSupported(String name, String mimeType) {
        String lowerName = name == null ? "" : name.toLowerCase();
        return lowerName.endsWith(".pdf")
            || lowerName.endsWith(".epub")
            || lowerName.endsWith(".txt")
            || "application/pdf".equals(mimeType)
            || "application/epub+zip".equals(mimeType)
            || "text/plain".equals(mimeType);
    }
}
