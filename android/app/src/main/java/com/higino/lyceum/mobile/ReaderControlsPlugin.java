package com.higino.lyceum.mobile;

import android.content.pm.ActivityInfo;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.view.KeyEvent;
import android.view.WindowManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
import java.util.Locale;

@CapacitorPlugin(name = "ReaderControls")
public class ReaderControlsPlugin extends Plugin {
    private static WeakReference<ReaderControlsPlugin> current = new WeakReference<>(null);
    private boolean volumeKeys;
    private TextToSpeech tts;
    private boolean speechReady;
    private PluginCall speechCall;

    @Override public void load() {
        current = new WeakReference<>(this);
        tts = new TextToSpeech(getContext(), status -> {
            speechReady = status == TextToSpeech.SUCCESS;
            if (!speechReady) return;
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) {}
                @Override public void onDone(String id) { finishSpeech(id, false); }
                @Override public void onError(String id) { finishSpeech(id, true); }
            });
        });
    }
    private synchronized void finishSpeech(String id, boolean error) {
        if (speechCall == null || !speechCall.getCallbackId().equals(id)) return;
        PluginCall call = speechCall; speechCall = null;
        if (error) call.reject("A voz não pôde ler o trecho."); else call.resolve();
    }
    public static boolean handleVolume(KeyEvent event) {
        ReaderControlsPlugin plugin = current.get();
        if (plugin == null || !plugin.volumeKeys || (event.getKeyCode() != KeyEvent.KEYCODE_VOLUME_UP && event.getKeyCode() != KeyEvent.KEYCODE_VOLUME_DOWN)) return false;
        if (event.getAction() == KeyEvent.ACTION_UP) {
            JSObject result = new JSObject(); result.put("direction", event.getKeyCode() == KeyEvent.KEYCODE_VOLUME_DOWN ? 1 : -1);
            plugin.notifyListeners("pageTurn", result);
        }
        return true;
    }
    @PluginMethod public void configure(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            volumeKeys = call.getBoolean("volumeKeys", false);
            if (call.getBoolean("keepAwake", false)) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            String orientation = call.getString("orientation", "auto");
            getActivity().setRequestedOrientation("portrait".equals(orientation) ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT : "landscape".equals(orientation) ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
            WindowManager.LayoutParams params = getActivity().getWindow().getAttributes();
            double brightness = call.getDouble("brightness", -1.0);
            params.screenBrightness = brightness < 0 ? -1f : (float) Math.max(0.1, Math.min(1.0, brightness));
            getActivity().getWindow().setAttributes(params);
            call.resolve();
        });
    }
    @PluginMethod public void shareBook(PluginCall call) {
        try {
            java.io.File root = new java.io.File(getContext().getFilesDir(), "lyceum-books").getCanonicalFile();
            java.io.File source = new java.io.File(getContext().getFilesDir(), call.getString("path", "")).getCanonicalFile();
            if (!source.getPath().startsWith(root.getPath() + java.io.File.separator) || !source.isFile()) { call.reject("Arquivo não encontrado na biblioteca gerenciada."); return; }
            java.io.File directory = new java.io.File(getContext().getCacheDir(), "reader-share");
            directory.mkdirs();
            // Keep previous exports for a day so another app can finish reading its URI.
            java.io.File[] previous = directory.listFiles();
            if (previous != null) for (java.io.File old : previous) if (old.isFile() && old.lastModified() < System.currentTimeMillis() - 86400000L) old.delete();
            String name = call.getString("name", "book").replaceAll("[^a-zA-Z0-9._-]", "_");
            java.io.File target = new java.io.File(directory, System.currentTimeMillis() + "-" + name);
            try (java.io.InputStream in = new java.io.FileInputStream(source); java.io.OutputStream out = new java.io.FileOutputStream(target)) {
                byte[] buffer = new byte[65536]; int count; while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
            }
            android.net.Uri uri = androidx.core.content.FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", target);
            android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_SEND);
            intent.setType(call.getString("mimeType", "application/octet-stream"));
            intent.putExtra(android.content.Intent.EXTRA_STREAM, uri);
            intent.setClipData(android.content.ClipData.newRawUri("book", uri));
            intent.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(android.content.Intent.createChooser(intent, "Enviar livro"));
            call.resolve();
        } catch (Exception error) { call.reject("Não foi possível compartilhar o livro.", error); }
    }
    @PluginMethod public void voices(PluginCall call) {
        if (!speechReady) { call.reject("A voz Android ainda não está pronta."); return; }
        JSArray voices = new JSArray();
        if (tts.getVoices() != null) for (Voice voice : tts.getVoices()) {
            JSObject value = new JSObject(); value.put("voiceURI", voice.getName()); value.put("name", voice.getName()); value.put("lang", voice.getLocale().toLanguageTag()); voices.put(value);
        }
        JSObject result = new JSObject(); result.put("voices", voices); call.resolve(result);
    }
    @PluginMethod public synchronized void speak(PluginCall call) {
        if (!speechReady) { call.reject("Voz Android indisponível."); return; }
        stopSpeech();
        String voiceName = call.getString("voice", "");
        if (!voiceName.isEmpty() && tts.getVoices() != null) {
            for (Voice voice : tts.getVoices()) if (voice.getName().equals(voiceName)) tts.setVoice(voice);
        } else { tts.setLanguage(Locale.getDefault()); }
        tts.setSpeechRate((float) Math.max(0.5, Math.min(2.0, call.getDouble("rate", 1.0))));
        speechCall = call;
        if (tts.speak(call.getString("text", ""), TextToSpeech.QUEUE_FLUSH, null, call.getCallbackId()) == TextToSpeech.ERROR) finishSpeech(call.getCallbackId(), true);
    }
    private synchronized void stopSpeech() {
        if (tts != null) tts.stop();
        if (speechCall != null) { JSObject cancelled = new JSObject(); cancelled.put("cancelled", true); speechCall.resolve(cancelled); speechCall = null; }
    }
    @PluginMethod public void stop(PluginCall call) { stopSpeech(); call.resolve(); }
    @Override protected void handleOnPause() { volumeKeys = false; stopSpeech(); }
    @Override protected void handleOnDestroy() { stopSpeech(); if (tts != null) tts.shutdown(); current.clear(); }
}
