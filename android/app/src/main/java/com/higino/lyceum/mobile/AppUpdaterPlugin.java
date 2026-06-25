package com.higino.lyceum.mobile;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final long MAX_APK_BYTES = 512L * 1024L * 1024L;
    private static final int BUFFER_SIZE = 128 * 1024;

    @PluginMethod
    public void getInstalledVersion(PluginCall call) {
        try {
            PackageInfo info = getContext()
                .getPackageManager()
                .getPackageInfo(getContext().getPackageName(), 0);
            JSObject response = new JSObject();
            response.put("packageName", getContext().getPackageName());
            response.put("versionName", info.versionName == null ? "" : info.versionName);
            response.put("versionCode", getVersionCode(info));
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Falha ao ler versao instalada", error);
        }
    }

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        JSObject response = new JSObject();
        response.put("value", canInstallPackages());
        call.resolve(response);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName())
                );
            } else {
                intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Falha ao abrir permissoes de instalacao", error);
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String urlValue = call.getString("url");
        String expectedSha256 = call.getString("sha256", "");
        String fileName = sanitizeFileName(call.getString("fileName", "lyceum-update.apk"));
        long expectedBytes = call.getLong("sizeBytes", 0L);

        if (urlValue == null || urlValue.trim().isEmpty()) {
            call.reject("URL do APK ausente");
            return;
        }

        Uri sourceUri = Uri.parse(urlValue);
        if (!"https".equalsIgnoreCase(sourceUri.getScheme())) {
            call.reject("A URL do APK precisa usar HTTPS");
            return;
        }

        if (!fileName.endsWith(".apk")) {
            fileName = fileName + ".apk";
        }

        String finalFileName = fileName;
        execute(() -> {
            File apkFile = null;
            try {
                if (!canInstallPackages()) {
                    throw new SecurityException("Permissao para instalar APKs nao concedida");
                }

                File updatesDir = new File(getContext().getCacheDir(), "updates");
                if (!updatesDir.exists() && !updatesDir.mkdirs()) {
                    throw new IllegalStateException("Nao foi possivel criar cache de atualizacao");
                }
                cleanupOldApks(updatesDir);

                apkFile = new File(updatesDir, finalFileName);
                downloadApk(urlValue, apkFile, expectedSha256, expectedBytes);
                validateArchive(apkFile);
                openInstaller(apkFile);

                JSObject response = new JSObject();
                response.put("path", apkFile.getAbsolutePath());
                response.put("bytes", apkFile.length());
                call.resolve(response);
            } catch (Exception error) {
                if (apkFile != null && apkFile.exists()) {
                    apkFile.delete();
                }
                call.reject(error.getMessage() == null ? "Falha ao instalar atualizacao" : error.getMessage(), error);
            }
        });
    }

    private boolean canInstallPackages() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls();
    }

    private void downloadApk(
        String urlValue,
        File target,
        String expectedSha256,
        long expectedBytes
    ) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(urlValue).openConnection();
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(60000);
        connection.setInstanceFollowRedirects(true);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("Servidor retornou HTTP " + status);
        }

        long total = connection.getContentLengthLong();
        if (total <= 0 && expectedBytes > 0) {
            total = expectedBytes;
        }
        if (total > MAX_APK_BYTES) {
            throw new IllegalStateException("APK excede o limite de 512 MB");
        }

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] buffer = new byte[BUFFER_SIZE];
        long loaded = 0;

        try (InputStream input = connection.getInputStream();
             FileOutputStream output = new FileOutputStream(target)) {
            int read;
            while ((read = input.read(buffer)) >= 0) {
                loaded += read;
                if (loaded > MAX_APK_BYTES) {
                    throw new IllegalStateException("APK excede o limite de 512 MB");
                }
                digest.update(buffer, 0, read);
                output.write(buffer, 0, read);
                notifyDownloadProgress(loaded, total);
            }
        } finally {
            connection.disconnect();
        }

        if (expectedBytes > 0 && loaded != expectedBytes) {
            throw new IllegalStateException("Tamanho do APK baixado nao confere");
        }

        if (expectedSha256 != null && !expectedSha256.trim().isEmpty()) {
            String actual = bytesToHex(digest.digest());
            if (!actual.equalsIgnoreCase(expectedSha256.trim())) {
                throw new IllegalStateException("Hash SHA-256 do APK nao confere");
            }
        }
    }

    private void validateArchive(File apkFile) throws Exception {
        PackageManager packageManager = getContext().getPackageManager();
        PackageInfo archiveInfo = packageManager.getPackageArchiveInfo(apkFile.getAbsolutePath(), 0);
        if (archiveInfo == null) {
            throw new IllegalStateException("APK invalido");
        }

        String currentPackage = getContext().getPackageName();
        if (!currentPackage.equals(archiveInfo.packageName)) {
            throw new IllegalStateException("APK usa package name diferente: " + archiveInfo.packageName);
        }

        PackageInfo installedInfo = packageManager.getPackageInfo(currentPackage, 0);
        long archiveVersion = getVersionCode(archiveInfo);
        long installedVersion = getVersionCode(installedInfo);
        if (archiveVersion <= installedVersion) {
            throw new IllegalStateException("APK nao e mais novo que a versao instalada");
        }
    }

    private void openInstaller(File apkFile) {
        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apkFile
        );

        Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
        intent.setData(apkUri);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra(Intent.EXTRA_RETURN_RESULT, false);

        try {
            getContext().startActivity(intent);
        } catch (ActivityNotFoundException error) {
            Intent fallback = new Intent(Intent.ACTION_VIEW);
            fallback.setDataAndType(apkUri, "application/vnd.android.package-archive");
            fallback.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(fallback);
        }
    }

    private void notifyDownloadProgress(long loaded, long total) {
        JSObject event = new JSObject();
        event.put("loaded", loaded);
        event.put("total", total);
        event.put("percent", total > 0 ? Math.min(100.0, (loaded * 100.0) / total) : 0);
        notifyListeners("downloadProgress", event);
    }

    private void cleanupOldApks(File updatesDir) {
        File[] files = updatesDir.listFiles();
        if (files == null) return;
        for (File file : files) {
            if (file.isFile() && file.getName().toLowerCase(Locale.ROOT).endsWith(".apk")) {
                file.delete();
            }
        }
    }

    private String sanitizeFileName(String value) {
        if (value == null || value.trim().isEmpty()) return "lyceum-update.apk";
        return value.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    private long getVersionCode(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return info.getLongVersionCode();
        }
        return info.versionCode;
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format(Locale.ROOT, "%02x", value));
        }
        return builder.toString();
    }
}
