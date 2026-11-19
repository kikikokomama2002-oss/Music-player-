package com.cadence.studio;

import android.Manifest;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Size;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.EOFException;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "CadenceAudio",
    permissions = {
        @Permission(
            strings = { Manifest.permission.READ_MEDIA_AUDIO },
            alias = "audio"
        ),
        @Permission(
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE },
            alias = "storage"
        ),
        @Permission(
            strings = { Manifest.permission.POST_NOTIFICATIONS },
            alias = "notifications"
        )
    }
)
public class CadenceAudioPlugin extends Plugin {

    private static final String ARTWORK_CACHE_DIR = "cadence_artwork";
    private static final int MAX_CACHED_ARTWORK_FILES = 300;
    private static volatile boolean interceptBack = false;

    private static volatile int artworkCacheGen = 0;

    public static boolean shouldInterceptBack() {
        return interceptBack;
    }

    private final ExecutorService scanExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Nullable
    private MediaController mediaController;
    @Nullable
    private ListenableFuture<MediaController> controllerFuture;

    private final Runnable progressTicker = new Runnable() {
        @Override
        public void run() {
            if (mediaController != null && mediaController.isPlaying()) {
                emitPlaybackState();
                mainHandler.postDelayed(this, 250);
            }
        }
    };

    private final Player.Listener playerListener = new Player.Listener() {
        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            emitPlaybackState();
            mainHandler.removeCallbacks(progressTicker);
            if (isPlaying) {
                mainHandler.postDelayed(progressTicker, 250);
            }
        }

        @Override
        public void onPlaybackStateChanged(int playbackState) {
            emitPlaybackState();
        }

        @Override
        public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {
            emitPlaybackState();
        }

        @Override
        public void onShuffleModeEnabledChanged(boolean shuffleModeEnabled) {
            emitPlaybackState();
        }

        @Override
        public void onRepeatModeChanged(int repeatMode) {
            emitPlaybackState();
        }

        @Override
        public void onPlayerError(PlaybackException error) {
            JSObject errObj = new JSObject();
            errObj.put("message", error.getMessage() != null ? error.getMessage() : "Playback error");
            notifyListeners("playbackError", errObj);
            emitPlaybackState();
        }
    };

    @Override
    public void load() {
        super.load();
        ensureMediaController(null);
    }

    @Override
    protected void handleOnDestroy() {
        mainHandler.removeCallbacks(progressTicker);
        scanExecutor.shutdownNow();
        if (mediaController != null) {
            mediaController.removeListener(playerListener);
        }
        if (controllerFuture != null) {
            MediaController.releaseFuture(controllerFuture);
            controllerFuture = null;
        }
        mediaController = null;
        super.handleOnDestroy();
    }

    private String getMediaPermissionAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "audio" : "storage";
    }

    private boolean isMediaPermissionGranted() {
        return getPermissionState(getMediaPermissionAlias()) == PermissionState.GRANTED;
    }

    private boolean isNotificationPermissionGranted() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return true;
        }
        return getPermissionState("notifications") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void getAudioPermissionStatus(PluginCall call) {
        JSObject res = new JSObject();
        PermissionState mediaState = getPermissionState(getMediaPermissionAlias());
        res.put("media", mediaState.toString());
        res.put("notifications", isNotificationPermissionGranted() ? "granted" : getPermissionState("notifications").toString());
        res.put("granted", mediaState == PermissionState.GRANTED);
        call.resolve(res);
    }

    @PluginMethod
    public void requestAudioPermissions(PluginCall call) {
        String alias = getMediaPermissionAlias();
        if (getPermissionState(alias) == PermissionState.GRANTED) {
            if (!isNotificationPermissionGranted()) {
                requestPermissionForAlias("notifications", call, "handleNotificationPermissionCallback");
            } else {
                getAudioPermissionStatus(call);
            }
            return;
        }
        requestPermissionForAlias(alias, call, "handleMediaPermissionCallback");
    }

    @PermissionCallback
    private void handleMediaPermissionCallback(PluginCall call) {
        if (isMediaPermissionGranted() && !isNotificationPermissionGranted()) {
            requestPermissionForAlias("notifications", call, "handleNotificationPermissionCallback");
        } else {
            getAudioPermissionStatus(call);
        }
    }

    @PermissionCallback
    private void handleNotificationPermissionCallback(PluginCall call) {
        getAudioPermissionStatus(call);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
        intent.setData(uri);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void setBackInterceptorActive(PluginCall call) {
        interceptBack = Boolean.TRUE.equals(call.getBoolean("active", false));
        call.resolve();
    }

    @PluginMethod
    public void clearArtworkCache(PluginCall call) {
        scanExecutor.execute(() -> {
            long freed = 0L;
            File dir = new File(getContext().getCacheDir(), ARTWORK_CACHE_DIR);
            if (dir.exists() && dir.isDirectory()) {
                File[] files = dir.listFiles();
                if (files != null) {
                    for (File f : files) {
                        freed += f.length();
                        f.delete();
                    }
                }
            }
            artworkCacheGen += 1;
            JSObject res = new JSObject();
            res.put("freedBytes", freed);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void setPlaybackPreferences(PluginCall call) {
        boolean pauseOnNoisy = call.hasOption("pauseOnNoisy")
            ? Boolean.TRUE.equals(call.getBoolean("pauseOnNoisy", true))
            : Boolean.TRUE.equals(call.getBoolean("pauseOnHeadphoneDisconnect", true));
        String audioFocusMode = call.getString("audioFocusMode", "pause");
        CadencePlaybackService svc = CadencePlaybackService.getInstance();
        if (svc != null) {
            svc.setPauseOnNoisy(pauseOnNoisy);
            svc.setAudioFocusEnabled(!"duck".equals(audioFocusMode));
        }
        call.resolve();
    }

    @PluginMethod
    public void scanLibrary(PluginCall call) {
        if (!isMediaPermissionGranted()) {
            call.reject("Audio storage permission is not granted.", "PERMISSION_DENIED");
            return;
        }
        boolean forceRefresh = Boolean.TRUE.equals(call.getBoolean("forceRefresh", false));

        scanExecutor.execute(() -> {
            try {
                if (forceRefresh) {
                    artworkCacheGen += 1;
                    File dir = new File(getContext().getCacheDir(), ARTWORK_CACHE_DIR);
                    File[] files = dir.listFiles();
                    if (files != null) {
                        for (File f : files) f.delete();
                    }
                }
                JSArray tracks = performMediaStoreScan();
                JSObject result = new JSObject();
                result.put("tracks", tracks);
                result.put("scannedAt", System.currentTimeMillis());
                call.resolve(result);
            } catch (Exception ex) {
                call.reject("Failed to scan local audio library: " + ex.getMessage(), ex);
            }
        });
    }

    private JSArray performMediaStoreScan() {
        Context context = getContext();
        ContentResolver resolver = context.getContentResolver();
        File artCacheDir = prepareArtworkCacheDir(context);

        List<String> projectionList = new ArrayList<>();
        projectionList.add(MediaStore.Audio.Media._ID);
        projectionList.add(MediaStore.Audio.Media.TITLE);
        projectionList.add(MediaStore.Audio.Media.ARTIST);
        projectionList.add(MediaStore.Audio.Media.ALBUM);
        projectionList.add(MediaStore.Audio.Media.ALBUM_ID);
        projectionList.add(MediaStore.Audio.Media.DURATION);
        projectionList.add(MediaStore.Audio.Media.TRACK);
        projectionList.add(MediaStore.Audio.Media.DATA);
        projectionList.add(MediaStore.Audio.Media.MIME_TYPE);
        projectionList.add(MediaStore.Audio.Media.SIZE);
        projectionList.add(MediaStore.Audio.Media.DATE_ADDED);
        projectionList.add(MediaStore.Audio.Media.DATE_MODIFIED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            projectionList.add(MediaStore.Audio.Media.RELATIVE_PATH);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            projectionList.add(MediaStore.Audio.Media.BITRATE);
        }

        String selection = "(" + MediaStore.Audio.Media.IS_MUSIC + " != 0 OR " +
            MediaStore.Audio.Media.MIME_TYPE + " LIKE 'audio/%') AND " +
            MediaStore.Audio.Media.DURATION + " >= 2000";

        String sortOrder = MediaStore.Audio.Media.TITLE + " ASC";
        JSArray tracks = new JSArray();
        Set<String> seenUris = new HashSet<>();
        Set<String> seenPaths = new HashSet<>();

        try (Cursor cursor = resolver.query(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
            projectionList.toArray(new String[0]),
            selection,
            null,
            sortOrder
        )) {
            if (cursor == null) {
                return tracks;
            }

            int idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
            int titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
            int artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
            int albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
            int albumIdCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID);
            int durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
            int trackCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK);
            int dataCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATA);
            int mimeCol = cursor.getColumnIndex(MediaStore.Audio.Media.MIME_TYPE);
            int sizeCol = cursor.getColumnIndex(MediaStore.Audio.Media.SIZE);
            int dateAddedCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATE_ADDED);
            int relPathCol = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? cursor.getColumnIndex(MediaStore.Audio.Media.RELATIVE_PATH)
                : -1;
            int bitrateCol = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? cursor.getColumnIndex(MediaStore.Audio.Media.BITRATE)
                : -1;

            while (cursor.moveToNext()) {
                long id = cursor.getLong(idCol);
                Uri contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
                String uriStr = contentUri.toString();
                if (!seenUris.add(uriStr)) {
                    continue;
                }

                String filePath = dataCol >= 0 ? safeStr(cursor.getString(dataCol)) : "";
                if (!filePath.isEmpty()) {
                    File f = new File(filePath);
                    if (!f.exists() || f.length() == 0) {
                        continue;
                    }
                    if (!seenPaths.add(filePath)) {
                        continue;
                    }
                }

                String rawTitle = safeStr(cursor.getString(titleCol));
                String title = !rawTitle.isEmpty() ? rawTitle : deriveTitleFromPath(filePath);
                String rawArtist = safeStr(cursor.getString(artistCol));
                String artist = (rawArtist.isEmpty() || "<unknown>".equalsIgnoreCase(rawArtist))
                    ? "Unknown Artist"
                    : rawArtist;
                String rawAlbum = safeStr(cursor.getString(albumCol));
                String album = (rawAlbum.isEmpty() || "<unknown>".equalsIgnoreCase(rawAlbum))
                    ? "Unknown Album"
                    : rawAlbum;

                long albumId = cursor.getLong(albumIdCol);
                long durationMs = Math.max(0L, cursor.getLong(durationCol));
                int rawTrackNum = cursor.getInt(trackCol);
                int trackNumber = rawTrackNum > 1000 ? rawTrackNum % 1000 : Math.max(1, rawTrackNum);
                String mimeType = mimeCol >= 0 ? safeStr(cursor.getString(mimeCol)) : "audio/*";
                long sizeBytes = sizeCol >= 0 ? cursor.getLong(sizeCol) : 0L;
                long dateAddedSec = dateAddedCol >= 0 ? cursor.getLong(dateAddedCol) : 0L;

                String folderPath = relPathCol >= 0 ? safeStr(cursor.getString(relPathCol)) : "";
                if (folderPath.isEmpty() && !filePath.isEmpty()) {
                    File parent = new File(filePath).getParentFile();
                    folderPath = parent != null ? parent.getAbsolutePath() : "/";
                }
                String folderName = extractFolderName(folderPath);

                long rawBitrateBps = bitrateCol >= 0 ? cursor.getLong(bitrateCol) : 0L;
                int durationSec = (int) Math.round(durationMs / 1000.0);
                int bitrateKbps = rawBitrateBps > 0
                    ? (int) Math.round(rawBitrateBps / 1000.0)
                    : (durationSec > 0 && sizeBytes > 0 ? (int) Math.round((sizeBytes * 8.0) / durationSec / 1000.0) : 0);

                String artworkPath = resolveAlbumArtworkPath(resolver, artCacheDir, id, albumId, contentUri, filePath);

                JSObject item = new JSObject();
                item.put("id", "ms-" + id);
                item.put("mediaStoreId", id);
                item.put("uri", uriStr);
                item.put("filePath", filePath);
                item.put("title", title);
                item.put("artist", artist);
                item.put("album", album);
                item.put("albumId", "alb-" + albumId);
                item.put("durationSec", durationSec);
                item.put("durationMs", durationMs);
                item.put("trackNumber", trackNumber);
                item.put("bitrateKbps", bitrateKbps);
                item.put("mimeType", mimeType);
                item.put("formatLabel", deriveFormatLabel(mimeType, filePath));
                item.put("sizeBytes", sizeBytes);
                item.put("dateAdded", dateAddedSec);
                item.put("folderPath", folderPath);
                item.put("folderName", folderName);
                item.put("artworkPath", artworkPath != null ? artworkPath : "");
                tracks.put(item);
            }
        }

        return tracks;
    }

    private File prepareArtworkCacheDir(Context context) {
        File dir = new File(context.getCacheDir(), ARTWORK_CACHE_DIR);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        File[] files = dir.listFiles();
        if (files != null && files.length > MAX_CACHED_ARTWORK_FILES) {
            int toDelete = files.length - MAX_CACHED_ARTWORK_FILES;
            for (int i = 0; i < toDelete; i++) {
                files[i].delete();
            }
        }
        return dir;
    }

    @Nullable
    private String resolveAlbumArtworkPath(
        ContentResolver resolver,
        File cacheDir,
        long trackId,
        long albumId,
        Uri trackUri,
        String filePath
    ) {
        String keyPrefix = albumId > 0
            ? ("alb_" + albumId + "_g" + artworkCacheGen)
            : ("trk_" + trackId + "_g" + artworkCacheGen);
        File existingJpg = new File(cacheDir, keyPrefix + ".jpg");
        if (existingJpg.exists() && existingJpg.length() > 0) {
            return existingJpg.getAbsolutePath();
        }
        File existingPng = new File(cacheDir, keyPrefix + ".png");
        if (existingPng.exists() && existingPng.length() > 0) {
            return existingPng.getAbsolutePath();
        }

        Bitmap bitmap = null;

        // 1. Prefer high-resolution embedded cover directly from the audio file or Content URI
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            boolean sourceSet = false;
            if (filePath != null && !filePath.isEmpty()) {
                try {
                    retriever.setDataSource(filePath);
                    sourceSet = true;
                } catch (Throwable ignored) {}
            }
            if (!sourceSet) {
                retriever.setDataSource(getContext(), trackUri);
            }
            byte[] embedded = retriever.getEmbeddedPicture();
            if (embedded != null && embedded.length > 0) {
                BitmapFactory.Options opts = new BitmapFactory.Options();
                opts.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(embedded, 0, embedded.length, opts);
                int sample = 1;
                while (opts.outWidth / sample > 640 || opts.outHeight / sample > 640) {
                    sample *= 2;
                }
                BitmapFactory.Options decodeOpts = new BitmapFactory.Options();
                decodeOpts.inSampleSize = sample;
                bitmap = BitmapFactory.decodeByteArray(embedded, 0, embedded.length, decodeOpts);
            }
        } catch (Throwable ignored) {
        } finally {
            try {
                retriever.release();
            } catch (Throwable ignored) {}
        }

        // 2. Fall back to MediaStore Album thumbnail on Android 10+
        if (bitmap == null && albumId > 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                Uri albumUri = ContentUris.withAppendedId(MediaStore.Audio.Albums.EXTERNAL_CONTENT_URI, albumId);
                bitmap = resolver.loadThumbnail(albumUri, new Size(512, 512), null);
            } catch (Throwable ignored) {}
        }

        // 3. Fall back to sidecar cover art in the track's folder (cover.jpg, folder.png, etc.)
        if (bitmap == null && filePath != null && !filePath.isEmpty()) {
            File parent = new File(filePath).getParentFile();
            if (parent != null && parent.isDirectory()) {
                String[] coverCandidates = new String[] {
                    "cover.jpg", "cover.jpeg", "cover.png", "cover.webp",
                    "folder.jpg", "folder.jpeg", "folder.png",
                    "front.jpg", "front.png", "album.jpg", "album.png"
                };
                for (String cand : coverCandidates) {
                    File img = new File(parent, cand);
                    if (img.exists() && img.isFile() && img.length() > 0 && img.length() < 12 * 1024 * 1024) {
                        BitmapFactory.Options opts = new BitmapFactory.Options();
                        opts.inJustDecodeBounds = true;
                        BitmapFactory.decodeFile(img.getAbsolutePath(), opts);
                        if (opts.outWidth > 0 && opts.outHeight > 0) {
                            int sample = 1;
                            while (opts.outWidth / sample > 640 || opts.outHeight / sample > 640) {
                                sample *= 2;
                            }
                            BitmapFactory.Options decodeOpts = new BitmapFactory.Options();
                            decodeOpts.inSampleSize = sample;
                            bitmap = BitmapFactory.decodeFile(img.getAbsolutePath(), decodeOpts);
                            if (bitmap != null) break;
                        }
                    }
                }
            }
        }

        if (bitmap == null) {
            return null;
        }

        boolean preservePng = bitmap.hasAlpha();
        File outFile = preservePng ? existingPng : existingJpg;
        Bitmap.CompressFormat fmt = preservePng ? Bitmap.CompressFormat.PNG : Bitmap.CompressFormat.JPEG;
        int quality = preservePng ? 100 : 90;

        try (FileOutputStream fos = new FileOutputStream(outFile)) {
            bitmap.compress(fmt, quality, fos);
            fos.flush();
            return outFile.getAbsolutePath();
        } catch (Throwable ignored) {
            return null;
        } finally {
            bitmap.recycle();
        }
    }

    @PluginMethod
    public void getTrackLyrics(PluginCall call) {
        String filePath = safeStr(call.getString("filePath", ""));
        String uriStr = safeStr(call.getString("uri", ""));
        String title = safeStr(call.getString("title", ""));
        String artist = safeStr(call.getString("artist", ""));

        if (filePath.isEmpty() && uriStr.isEmpty()) {
            JSObject res = new JSObject();
            res.put("lyrics", "");
            res.put("source", "none");
            call.resolve(res);
            return;
        }

        scanExecutor.execute(() -> {
            if (!filePath.isEmpty()) {
                List<File> lrcCandidates = new ArrayList<>();
                lrcCandidates.add(new File(replaceExtension(filePath, ".lrc")));
                lrcCandidates.add(new File(replaceExtension(filePath, ".LRC")));
                File parentDir = new File(filePath).getParentFile();
                if (parentDir != null && parentDir.isDirectory()) {
                    if (!artist.isEmpty() && !"Unknown Artist".equalsIgnoreCase(artist) && !title.isEmpty()) {
                        lrcCandidates.add(new File(parentDir, artist + " - " + title + ".lrc"));
                    }
                    if (!title.isEmpty()) {
                        lrcCandidates.add(new File(parentDir, title + ".lrc"));
                    }
                }

                for (File lrcFile : lrcCandidates) {
                    String content = readLyricsTextFile(lrcFile);
                    if (content != null && !content.isEmpty()) {
                        JSObject res = new JSObject();
                        res.put("lyrics", content);
                        res.put("source", "lrc");
                        call.resolve(res);
                        return;
                    }
                }
            }

            String embedded = null;
            if (!filePath.isEmpty()) {
                File audioFile = new File(filePath);
                if (audioFile.exists() && audioFile.isFile()) {
                    try (FileInputStream fis = new FileInputStream(audioFile)) {
                        embedded = readEmbeddedAudioLyricsFromStream(fis);
                    } catch (Throwable ignored) {}
                }
            }
            if ((embedded == null || embedded.isEmpty()) && !uriStr.isEmpty()) {
                try (InputStream is = getContext().getContentResolver().openInputStream(Uri.parse(uriStr))) {
                    if (is != null) {
                        embedded = readEmbeddedAudioLyricsFromStream(is);
                    }
                } catch (Throwable ignored) {}
            }

            if (embedded != null && !embedded.isEmpty()) {
                JSObject res = new JSObject();
                res.put("lyrics", embedded);
                res.put("source", "embedded");
                call.resolve(res);
                return;
            }

            JSObject res = new JSObject();
            res.put("lyrics", "");
            res.put("source", "none");
            call.resolve(res);
        });
    }

    @Nullable
    private String readLyricsTextFile(File lrcFile) {
        if (!lrcFile.exists() || !lrcFile.isFile() || lrcFile.length() == 0 || lrcFile.length() >= 512 * 1024) {
            return null;
        }
        try (FileInputStream fis = new FileInputStream(lrcFile)) {
            byte[] raw = new byte[(int) lrcFile.length()];
            int offset = 0;
            while (offset < raw.length) {
                int r = fis.read(raw, offset, raw.length - offset);
                if (r <= 0) break;
                offset += r;
            }
            if (offset == 0) return null;
            Charset cs = StandardCharsets.UTF_8;
            int start = 0;
            if (offset >= 2 && (raw[0] & 0xFF) == 0xFF && (raw[1] & 0xFF) == 0xFE) {
                cs = StandardCharsets.UTF_16LE;
                start = 2;
            } else if (offset >= 2 && (raw[0] & 0xFF) == 0xFE && (raw[1] & 0xFF) == 0xFF) {
                cs = StandardCharsets.UTF_16BE;
                start = 2;
            } else if (offset >= 3 && (raw[0] & 0xFF) == 0xEF && (raw[1] & 0xFF) == 0xBB && (raw[2] & 0xFF) == 0xBF) {
                start = 3;
            }
            return new String(raw, start, offset - start, cs).trim();
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static byte[] readExactBytes(InputStream in, int len) throws java.io.IOException {
        byte[] buf = new byte[len];
        int pos = 0;
        while (pos < len) {
            int r = in.read(buf, pos, len - pos);
            if (r < 0) throw new EOFException();
            pos += r;
        }
        return buf;
    }

    private static void skipFullyBytes(InputStream in, long count) throws java.io.IOException {
        long rem = count;
        byte[] scratch = new byte[4096];
        while (rem > 0) {
            int chunk = (int) Math.min(scratch.length, rem);
            int r = in.read(scratch, 0, chunk);
            if (r < 0) break;
            rem -= r;
        }
    }

    @Nullable
    private String readEmbeddedAudioLyricsFromStream(InputStream in) {
        try {
            byte[] head = readExactBytes(in, 10);
            if (head[0] == 'I' && head[1] == 'D' && head[2] == '3') {
                int version = head[3] & 0xFF;
                int flags = head[5] & 0xFF;
                long tagSize = ((head[6] & 0x7FL) << 21) | ((head[7] & 0x7FL) << 14)
                    | ((head[8] & 0x7FL) << 7) | (head[9] & 0x7FL);
                long consumed = 0;
                if (version >= 3 && (flags & 0x40) != 0 && tagSize >= 4) {
                    byte[] ext = readExactBytes(in, 4);
                    consumed += 4;
                    int extSize = version == 4
                        ? (((ext[0] & 0x7F) << 21) | ((ext[1] & 0x7F) << 14) | ((ext[2] & 0x7F) << 7) | (ext[3] & 0x7F))
                        : (((ext[0] & 0xFF) << 24) | ((ext[1] & 0xFF) << 16) | ((ext[2] & 0xFF) << 8) | (ext[3] & 0xFF));
                    int toSkip = version == 4 ? Math.max(0, extSize - 4) : Math.max(0, extSize);
                    skipFullyBytes(in, toSkip);
                    consumed += toSkip;
                }

                String unsynced = null;
                while (consumed + (version == 2 ? 6 : 10) <= tagSize) {
                    if (version == 2) {
                        byte[] fh = readExactBytes(in, 6);
                        consumed += 6;
                        if (fh[0] == 0) break;
                        String frameId = new String(fh, 0, 3, StandardCharsets.ISO_8859_1);
                        int frameSize = ((fh[3] & 0xFF) << 16) | ((fh[4] & 0xFF) << 8) | (fh[5] & 0xFF);
                        if (frameSize <= 0 || consumed + frameSize > tagSize) break;
                        if ("ULT".equals(frameId) && frameSize <= 512 * 1024) {
                            byte[] payload = readExactBytes(in, frameSize);
                            consumed += frameSize;
                            String parsed = parseId3UnsyncedLyricsPayload(payload);
                            if (parsed != null && !parsed.isEmpty()) unsynced = parsed;
                        } else {
                            skipFullyBytes(in, frameSize);
                            consumed += frameSize;
                        }
                        continue;
                    }

                    byte[] fh = readExactBytes(in, 10);
                    consumed += 10;
                    if (fh[0] == 0) break;
                    String frameId = new String(fh, 0, 4, StandardCharsets.ISO_8859_1);
                    int frameSize = version == 4
                        ? (((fh[4] & 0x7F) << 21) | ((fh[5] & 0x7F) << 14) | ((fh[6] & 0x7F) << 7) | (fh[7] & 0x7F))
                        : (((fh[4] & 0xFF) << 24) | ((fh[5] & 0xFF) << 16) | ((fh[6] & 0xFF) << 8) | (fh[7] & 0xFF));
                    int flag2 = fh[9] & 0xFF;
                    if (frameSize <= 0 || consumed + frameSize > tagSize) break;

                    if (("SYLT".equals(frameId) || "USLT".equals(frameId)) && frameSize <= 512 * 1024) {
                        byte[] payload = readExactBytes(in, frameSize);
                        consumed += frameSize;
                        if (version == 4 && (flag2 & 0x01) != 0 && payload.length > 4) {
                            byte[] trimmed = new byte[payload.length - 4];
                            System.arraycopy(payload, 4, trimmed, 0, trimmed.length);
                            payload = trimmed;
                        }
                        if ("SYLT".equals(frameId)) {
                            String sylt = parseId3SyltPayload(payload);
                            if (sylt != null && !sylt.isEmpty()) return sylt;
                        } else if (unsynced == null) {
                            String uslt = parseId3UnsyncedLyricsPayload(payload);
                            if (uslt != null && !uslt.isEmpty()) unsynced = uslt;
                        }
                    } else {
                        skipFullyBytes(in, frameSize);
                        consumed += frameSize;
                    }
                }
                return unsynced;
            }

            if (head[0] == 'f' && head[1] == 'L' && head[2] == 'a' && head[3] == 'C') {
                InputStream flacStream = new java.io.SequenceInputStream(
                    new ByteArrayInputStream(head, 4, 6),
                    in
                );
                boolean isLast = false;
                while (!isLast) {
                    byte[] bh = readExactBytes(flacStream, 4);
                    isLast = (bh[0] & 0x80) != 0;
                    int blockType = bh[0] & 0x7F;
                    int blockLen = ((bh[1] & 0xFF) << 16) | ((bh[2] & 0xFF) << 8) | (bh[3] & 0xFF);
                    if (blockLen <= 0) continue;
                    if (blockType == 4 && blockLen <= 512 * 1024) {
                        byte[] block = readExactBytes(flacStream, blockLen);
                        int vp = 4 + (int) (((block[0] & 0xFFL)) | ((block[1] & 0xFFL) << 8) | ((block[2] & 0xFFL) << 16) | ((block[3] & 0xFFL) << 24));
                        if (vp + 4 <= block.length) {
                            int count = (block[vp] & 0xFF) | ((block[vp + 1] & 0xFF) << 8) | ((block[vp + 2] & 0xFF) << 16) | ((block[vp + 3] & 0xFF) << 24);
                            vp += 4;
                            for (int i = 0; i < count && vp + 4 <= block.length; i++) {
                                int cLen = (block[vp] & 0xFF) | ((block[vp + 1] & 0xFF) << 8) | ((block[vp + 2] & 0xFF) << 16) | ((block[vp + 3] & 0xFF) << 24);
                                vp += 4;
                                if (cLen <= 0 || vp + cLen > block.length) break;
                                String entry = new String(block, vp, cLen, StandardCharsets.UTF_8);
                                vp += cLen;
                                int eq = entry.indexOf('=');
                                if (eq > 0) {
                                    String k = entry.substring(0, eq).trim().toUpperCase(Locale.US);
                                    if ("LYRICS".equals(k) || "UNSYNCEDLYRICS".equals(k) || "SYNCEDLYRICS".equals(k)) {
                                        String v = entry.substring(eq + 1).trim();
                                        if (!v.isEmpty()) return v;
                                    }
                                }
                            }
                        }
                    } else {
                        skipFullyBytes(flacStream, blockLen);
                    }
                }
            }
        } catch (Throwable ignored) {}
        return null;
    }

    @Nullable
    private String parseId3UnsyncedLyricsPayload(byte[] payload) {
        if (payload.length <= 5) return null;
        int enc = payload[0] & 0xFF;
        boolean utf16 = enc == 1 || enc == 2;
        int p = 4;
        if (utf16) {
            while (p + 1 < payload.length && !(payload[p] == 0 && payload[p + 1] == 0)) p += 2;
            p += 2;
        } else {
            while (p < payload.length && payload[p] != 0) p++;
            p += 1;
        }
        if (p >= payload.length) return null;
        Charset cs = enc == 0 ? StandardCharsets.ISO_8859_1
            : enc == 1 ? StandardCharsets.UTF_16
            : enc == 2 ? StandardCharsets.UTF_16BE
            : StandardCharsets.UTF_8;
        return new String(payload, p, payload.length - p, cs).replace("\0", "").trim();
    }

    @Nullable
    private String parseId3SyltPayload(byte[] payload) {
        if (payload.length <= 7 || (payload[4] & 0xFF) != 2) return null;
        int enc = payload[0] & 0xFF;
        boolean utf16 = enc == 1 || enc == 2;
        Charset cs = enc == 0 ? StandardCharsets.ISO_8859_1
            : enc == 1 ? StandardCharsets.UTF_16
            : enc == 2 ? StandardCharsets.UTF_16BE
            : StandardCharsets.UTF_8;
        int p = 6;
        if (utf16) {
            while (p + 1 < payload.length && !(payload[p] == 0 && payload[p + 1] == 0)) p += 2;
            p += 2;
        } else {
            while (p < payload.length && payload[p] != 0) p++;
            p += 1;
        }
        StringBuilder out = new StringBuilder();
        while (p < payload.length) {
            int start = p;
            if (utf16) {
                while (p + 1 < payload.length && !(payload[p] == 0 && payload[p + 1] == 0)) p += 2;
                String txt = new String(payload, start, Math.max(0, p - start), cs).replace("\0", "").trim();
                p += 2;
                if (p + 4 > payload.length) break;
                long ms = ((payload[p] & 0xFFL) << 24) | ((payload[p + 1] & 0xFFL) << 16)
                    | ((payload[p + 2] & 0xFFL) << 8) | (payload[p + 3] & 0xFFL);
                p += 4;
                appendLrcLine(out, ms, txt);
            } else {
                while (p < payload.length && payload[p] != 0) p++;
                String txt = new String(payload, start, Math.max(0, p - start), cs).replace("\0", "").trim();
                p += 1;
                if (p + 4 > payload.length) break;
                long ms = ((payload[p] & 0xFFL) << 24) | ((payload[p + 1] & 0xFFL) << 16)
                    | ((payload[p + 2] & 0xFFL) << 8) | (payload[p + 3] & 0xFFL);
                p += 4;
                appendLrcLine(out, ms, txt);
            }
        }
        String res = out.toString().trim();
        return res.isEmpty() ? null : res;
    }

    private static void appendLrcLine(StringBuilder sb, long ms, String text) {
        long mins = ms / 60000L;
        double secs = (ms % 60000L) / 1000.0;
        if (sb.length() > 0) sb.append('\n');
        sb.append(String.format(Locale.US, "[%02d:%05.2f]%s", mins, secs, text));
    }

    private void ensureMediaController(@Nullable Runnable onReady) {
        mainHandler.post(() -> {
            if (mediaController != null && mediaController.isConnected()) {
                if (onReady != null) onReady.run();
                return;
            }
            if (controllerFuture == null) {
                SessionToken sessionToken = new SessionToken(
                    getContext(),
                    new ComponentName(getContext(), CadencePlaybackService.class)
                );
                controllerFuture = new MediaController.Builder(getContext(), sessionToken).buildAsync();
                controllerFuture.addListener(() -> {
                    try {
                        mediaController = controllerFuture.get();
                        mediaController.addListener(playerListener);
                        emitPlaybackState();
                        if (onReady != null) onReady.run();
                    } catch (Throwable ignored) {
                        controllerFuture = null;
                    }
                }, ContextCompat.getMainExecutor(getContext()));
            } else if (onReady != null) {
                controllerFuture.addListener(onReady, ContextCompat.getMainExecutor(getContext()));
            }
        });
    }

    @PluginMethod
    public void setQueueAndPlay(PluginCall call) {
        JSArray tracksArray = call.getArray("tracks");
        int startIndex = call.getInt("startIndex", 0);
        long startPositionMs = call.getInt("startPositionMs", 0);
        boolean autoPlay = call.getBoolean("autoPlay", true);

        if (tracksArray == null || tracksArray.length() == 0) {
            call.reject("Tracks array is empty.");
            return;
        }

        List<MediaItem> mediaItems = buildMediaItems(tracksArray);
        if (mediaItems.isEmpty()) {
            call.reject("No playable tracks found in queue.");
            return;
        }

        int safeIndex = Math.max(0, Math.min(startIndex, mediaItems.size() - 1));
        ensureMediaController(() -> {
            if (mediaController == null) {
                call.reject("Playback service unavailable.");
                return;
            }
            mediaController.setMediaItems(mediaItems, safeIndex, Math.max(0L, startPositionMs));
            mediaController.prepare();
            if (autoPlay) {
                mediaController.play();
            } else {
                mediaController.pause();
            }
            emitPlaybackState();
            call.resolve();
        });
    }

    @PluginMethod
    public void updateQueue(PluginCall call) {
        JSArray tracksArray = call.getArray("tracks");
        if (tracksArray == null) {
            call.resolve();
            return;
        }
        int currentIndex = call.getInt("currentIndex", 0);
        List<MediaItem> mediaItems = buildMediaItems(tracksArray);

        ensureMediaController(() -> {
            if (mediaController == null) {
                call.resolve();
                return;
            }
            if (mediaItems.isEmpty()) {
                mediaController.clearMediaItems();
                emitPlaybackState();
                call.resolve();
                return;
            }
            long currentPos = mediaController.getCurrentPosition();
            boolean wasPlaying = mediaController.isPlaying();
            int safeIndex = Math.max(0, Math.min(currentIndex, mediaItems.size() - 1));
            mediaController.setMediaItems(mediaItems, safeIndex, Math.max(0L, currentPos));
            mediaController.prepare();
            if (wasPlaying) {
                mediaController.play();
            }
            emitPlaybackState();
            call.resolve();
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        ensureMediaController(() -> {
            if (mediaController != null) {
                mediaController.play();
                emitPlaybackState();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        ensureMediaController(() -> {
            if (mediaController != null) {
                mediaController.pause();
                emitPlaybackState();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        long positionMs = Math.max(0L, call.getInt("positionMs", 0));
        ensureMediaController(() -> {
            if (mediaController != null) {
                mediaController.seekTo(positionMs);
                emitPlaybackState();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void skipToNext(PluginCall call) {
        ensureMediaController(() -> {
            if (mediaController != null) {
                if (mediaController.hasNextMediaItem()) {
                    mediaController.seekToNextMediaItem();
                } else if (mediaController.getRepeatMode() == Player.REPEAT_MODE_ALL && mediaController.getMediaItemCount() > 0) {
                    mediaController.seekTo(0, 0L);
                }
                mediaController.play();
                emitPlaybackState();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void skipToPrevious(PluginCall call) {
        ensureMediaController(() -> {
            if (mediaController != null) {
                mediaController.seekToPrevious();
                mediaController.play();
                emitPlaybackState();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void setShuffleMode(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        ensureMediaController(() -> {
            if (mediaController != null) {
                mediaController.setShuffleModeEnabled(enabled);
                emitPlaybackState();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void setRepeatMode(PluginCall call) {
        String mode = call.getString("mode", "off");
        int repeatMode = "one".equals(mode)
            ? Player.REPEAT_MODE_ONE
            : "all".equals(mode) ? Player.REPEAT_MODE_ALL : Player.REPEAT_MODE_OFF;
        ensureMediaController(() -> {
            if (mediaController != null) {
                mediaController.setRepeatMode(repeatMode);
                emitPlaybackState();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void setPlaybackSpeed(PluginCall call) {
        float speed = Math.max(0.5f, Math.min(2.0f, call.getFloat("speed", 1.0f)));
        ensureMediaController(() -> {
            if (mediaController != null) {
                mediaController.setPlaybackSpeed(speed);
                emitPlaybackState();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void getPlaybackState(PluginCall call) {
        ensureMediaController(() -> {
            call.resolve(buildPlaybackStateObject());
        });
    }

    @PluginMethod
    public void getAudioEffectsState(PluginCall call) {
        CadencePlaybackService svc = CadencePlaybackService.getInstance();
        if (svc == null) {
            JSObject fallback = new JSObject();
            fallback.put("enabled", true);
            fallback.put("equalizerSupported", false);
            fallback.put("bassBoostSupported", false);
            fallback.put("virtualizerSupported", false);
            fallback.put("minLevelMb", -1200);
            fallback.put("maxLevelMb", 1200);
            fallback.put("bands", new JSArray());
            fallback.put("bassBoostStrength", 0);
            fallback.put("virtualizerStrength", 0);
            call.resolve(fallback);
            return;
        }
        call.resolve(svc.getAudioEffectsSnapshot());
    }

    @PluginMethod
    public void setEqEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        CadencePlaybackService svc = CadencePlaybackService.getInstance();
        if (svc != null) {
            svc.setEqEnabled(enabled);
        }
        call.resolve();
    }

    @PluginMethod
    public void setEqBandLevel(PluginCall call) {
        int bandIndex = call.getInt("bandIndex", 0);
        int levelMb = call.getInt("levelMb", 0);
        CadencePlaybackService svc = CadencePlaybackService.getInstance();
        if (svc != null) {
            svc.setEqBandLevel(bandIndex, (short) levelMb);
        }
        call.resolve();
    }

    @PluginMethod
    public void setBassBoost(PluginCall call) {
        int strength = call.getInt("strength", 0);
        CadencePlaybackService svc = CadencePlaybackService.getInstance();
        if (svc != null) {
            svc.setBassBoostStrength((short) strength);
        }
        call.resolve();
    }

    @PluginMethod
    public void setVirtualizer(PluginCall call) {
        int strength = call.getInt("strength", 0);
        CadencePlaybackService svc = CadencePlaybackService.getInstance();
        if (svc != null) {
            svc.setVirtualizerStrength((short) strength);
        }
        call.resolve();
    }

    @PluginMethod
    public void setSleepTimer(PluginCall call) {
        int minutes = call.getInt("minutes", 0);
        CadencePlaybackService svc = CadencePlaybackService.getInstance();
        if (svc != null) {
            if (minutes <= 0) {
                svc.cancelSleepTimer();
            } else {
                svc.scheduleSleepTimer(minutes * 60_000L);
            }
        }
        JSObject res = new JSObject();
        res.put("endAtMs", svc != null ? svc.getSleepTimerEndAtMs() : 0L);
        call.resolve(res);
    }

    @PluginMethod
    public void shareTrack(PluginCall call) {
        String filePath = call.getString("filePath", "");
        String contentUriStr = call.getString("uri", "");
        String title = call.getString("title", "Audio Track");

        try {
            Uri shareUri = null;
            if (filePath != null && !filePath.isEmpty()) {
                File file = new File(filePath);
                if (file.exists()) {
                    shareUri = FileProvider.getUriForFile(
                        getContext(),
                        getContext().getPackageName() + ".fileprovider",
                        file
                    );
                }
            }
            if (shareUri == null && contentUriStr != null && !contentUriStr.isEmpty()) {
                shareUri = Uri.parse(contentUriStr);
            }
            if (shareUri == null) {
                call.reject("Audio file URI unavailable for sharing.");
                return;
            }

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("audio/*");
            shareIntent.putExtra(Intent.EXTRA_STREAM, shareUri);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(shareIntent, "Share " + title);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);
            call.resolve();
        } catch (Exception ex) {
            call.reject("Unable to share audio file: " + ex.getMessage(), ex);
        }
    }

    private List<MediaItem> buildMediaItems(JSArray tracksArray) {
        List<MediaItem> list = new ArrayList<>();
        for (int i = 0; i < tracksArray.length(); i++) {
            try {
                JSONObject obj = tracksArray.getJSONObject(i);
                String id = obj.optString("id", "");
                String uriStr = obj.optString("uri", "");
                String title = obj.optString("title", "Unknown Track");
                String artist = obj.optString("artist", "Unknown Artist");
                String album = obj.optString("album", "Unknown Album");
                String artworkPath = obj.optString("artworkPath", "");

                if (uriStr.isEmpty()) continue;

                MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
                    .setTitle(title)
                    .setArtist(artist)
                    .setAlbumTitle(album);

                if (!artworkPath.isEmpty()) {
                    File artFile = new File(artworkPath);
                    if (artFile.exists()) {
                        metaBuilder.setArtworkUri(Uri.fromFile(artFile));
                    }
                }

                MediaItem item = new MediaItem.Builder()
                    .setMediaId(id)
                    .setUri(Uri.parse(uriStr))
                    .setMediaMetadata(metaBuilder.build())
                    .build();
                list.add(item);
            } catch (JSONException ignored) {}
        }
        return list;
    }

    private JSObject buildPlaybackStateObject() {
        JSObject obj = new JSObject();
        if (mediaController == null) {
            obj.put("isPlaying", false);
            obj.put("currentTrackId", "");
            obj.put("positionMs", 0);
            obj.put("durationMs", 0);
            obj.put("shuffle", false);
            obj.put("repeatMode", "off");
            obj.put("playbackSpeed", 1.0);
            obj.put("currentIndex", 0);
            return obj;
        }

        MediaItem currentItem = mediaController.getCurrentMediaItem();
        String currentId = currentItem != null ? currentItem.mediaId : "";
        int rMode = mediaController.getRepeatMode();
        String repeatStr = rMode == Player.REPEAT_MODE_ONE
            ? "one"
            : rMode == Player.REPEAT_MODE_ALL ? "all" : "off";

        CadencePlaybackService svc = CadencePlaybackService.getInstance();

        obj.put("isPlaying", mediaController.isPlaying());
        obj.put("currentTrackId", currentId);
        obj.put("currentIndex", mediaController.getCurrentMediaItemIndex());
        obj.put("positionMs", Math.max(0L, mediaController.getCurrentPosition()));
        obj.put("durationMs", Math.max(0L, mediaController.getDuration()));
        obj.put("shuffle", mediaController.getShuffleModeEnabled());
        obj.put("repeatMode", repeatStr);
        obj.put("playbackSpeed", mediaController.getPlaybackParameters().speed);
        obj.put("sleepTimerEndAtMs", svc != null ? svc.getSleepTimerEndAtMs() : 0L);
        return obj;
    }

    private void emitPlaybackState() {
        notifyListeners("playbackStateChanged", buildPlaybackStateObject());
    }

    private static String safeStr(@Nullable String s) {
        return s == null ? "" : s.trim();
    }

    private static String deriveTitleFromPath(String filePath) {
        if (filePath.isEmpty()) return "Untitled Track";
        String name = new File(filePath).getName();
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    private static String extractFolderName(String folderPath) {
        if (folderPath.isEmpty() || "/".equals(folderPath)) return "Internal Storage";
        String trimmed = folderPath.endsWith("/")
            ? folderPath.substring(0, folderPath.length() - 1)
            : folderPath;
        int slash = trimmed.lastIndexOf('/');
        return slash >= 0 && slash < trimmed.length() - 1
            ? trimmed.substring(slash + 1)
            : trimmed;
    }

    private static String deriveFormatLabel(String mimeType, String filePath) {
        String lowerPath = filePath.toLowerCase();
        if (lowerPath.endsWith(".flac") || mimeType.contains("flac")) return "FLAC";
        if (lowerPath.endsWith(".wav") || mimeType.contains("wav")) return "WAV";
        if (lowerPath.endsWith(".m4a") || mimeType.contains("mp4")) return "M4A / AAC";
        if (lowerPath.endsWith(".aac") || mimeType.contains("aac")) return "AAC";
        if (lowerPath.endsWith(".ogg") || mimeType.contains("ogg")) return "OGG";
        if (lowerPath.endsWith(".opus") || mimeType.contains("opus")) return "OPUS";
        if (lowerPath.endsWith(".mp3") || mimeType.contains("mpeg")) return "MP3";
        return "AUDIO";
    }

    private static String replaceExtension(String path, String newExt) {
        int dot = path.lastIndexOf('.');
        int slash = path.lastIndexOf('/');
        if (dot > slash && dot > 0) {
            return path.substring(0, dot) + newExt;
        }
        return path + newExt;
    }
}
