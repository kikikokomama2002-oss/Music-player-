package com.cadence.studio;

import android.app.PendingIntent;
import android.content.Intent;
import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;
import android.media.audiofx.Virtualizer;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.Nullable;
import androidx.annotation.OptIn;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.analytics.AnalyticsListener;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

public class CadencePlaybackService extends MediaSessionService {

    private static volatile CadencePlaybackService activeInstance;

    private ExoPlayer player;
    private MediaSession mediaSession;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private Equalizer equalizer;
    private BassBoost bassBoost;
    private Virtualizer virtualizer;
    private int currentAudioSessionId = C.AUDIO_SESSION_ID_UNSET;

    private boolean eqEnabled = true;
    private short[] savedBandLevelsMb = null;
    private short savedBassBoostStrength = 0;
    private short savedVirtualizerStrength = 0;

    private long sleepTimerEndAtMs = 0L;
    private final Runnable sleepTimerRunnable = new Runnable() {
        @Override
        public void run() {
            sleepTimerEndAtMs = 0L;
            if (player != null && player.isPlaying()) {
                player.pause();
            }
        }
    };

    @OptIn(markerClass = UnstableApi.class)
    @Override
    public void onCreate() {
        super.onCreate();
        activeInstance = this;

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build();

        player = new ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_LOCAL)
            .build();

        player.addAnalyticsListener(new AnalyticsListener() {
            @Override
            public void onAudioSessionIdChanged(EventTime eventTime, int audioSessionId) {
                attachAudioEffects(audioSessionId);
            }
        });

        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setAction(Intent.ACTION_MAIN);
        launchIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent sessionActivityPendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        mediaSession = new MediaSession.Builder(this, player)
            .setSessionActivity(sessionActivityPendingIntent)
            .build();
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        Player sessionPlayer = mediaSession != null ? mediaSession.getPlayer() : null;
        if (sessionPlayer == null || !sessionPlayer.getPlayWhenReady() || sessionPlayer.getMediaItemCount() == 0) {
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        mainHandler.removeCallbacks(sleepTimerRunnable);
        releaseAudioEffects();
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        if (activeInstance == this) {
            activeInstance = null;
        }
        super.onDestroy();
    }

    private synchronized void attachAudioEffects(int audioSessionId) {
        if (audioSessionId == C.AUDIO_SESSION_ID_UNSET || audioSessionId == 0) {
            return;
        }
        if (audioSessionId == currentAudioSessionId && equalizer != null) {
            return;
        }
        releaseAudioEffects();
        currentAudioSessionId = audioSessionId;

        try {
            equalizer = new Equalizer(0, audioSessionId);
            equalizer.setEnabled(eqEnabled);
            short numBands = equalizer.getNumberOfBands();
            if (savedBandLevelsMb != null && savedBandLevelsMb.length == numBands) {
                for (short i = 0; i < numBands; i++) {
                    equalizer.setBandLevel(i, savedBandLevelsMb[i]);
                }
            }
        } catch (Throwable ignored) {
            equalizer = null;
        }

        try {
            bassBoost = new BassBoost(0, audioSessionId);
            if (bassBoost.getStrengthSupported()) {
                bassBoost.setEnabled(eqEnabled && savedBassBoostStrength > 0);
                bassBoost.setStrength(savedBassBoostStrength);
            }
        } catch (Throwable ignored) {
            bassBoost = null;
        }

        try {
            virtualizer = new Virtualizer(0, audioSessionId);
            if (virtualizer.getStrengthSupported()) {
                virtualizer.setEnabled(eqEnabled && savedVirtualizerStrength > 0);
                virtualizer.setStrength(savedVirtualizerStrength);
            }
        } catch (Throwable ignored) {
            virtualizer = null;
        }
    }

    private synchronized void releaseAudioEffects() {
        if (equalizer != null) {
            try {
                equalizer.release();
            } catch (Throwable ignored) {}
            equalizer = null;
        }
        if (bassBoost != null) {
            try {
                bassBoost.release();
            } catch (Throwable ignored) {}
            bassBoost = null;
        }
        if (virtualizer != null) {
            try {
                virtualizer.release();
            } catch (Throwable ignored) {}
            virtualizer = null;
        }
        currentAudioSessionId = C.AUDIO_SESSION_ID_UNSET;
    }

    @Nullable
    public static CadencePlaybackService getInstance() {
        return activeInstance;
    }

    public synchronized JSObject getAudioEffectsSnapshot() {
        JSObject result = new JSObject();
        result.put("enabled", eqEnabled);

        boolean eqSupported = equalizer != null;
        result.put("equalizerSupported", eqSupported);

        JSArray bandsArray = new JSArray();
        if (equalizer != null) {
            try {
                short[] range = equalizer.getBandLevelRange();
                short numBands = equalizer.getNumberOfBands();
                result.put("minLevelMb", (int) range[0]);
                result.put("maxLevelMb", (int) range[1]);

                for (short i = 0; i < numBands; i++) {
                    JSObject bandObj = new JSObject();
                    bandObj.put("index", (int) i);
                    bandObj.put("centerFreqHz", equalizer.getCenterFreq(i) / 1000);
                    bandObj.put("levelMb", (int) equalizer.getBandLevel(i));
                    bandsArray.put(bandObj);
                }
            } catch (Throwable ignored) {
                result.put("equalizerSupported", false);
            }
        } else {
            result.put("minLevelMb", -1200);
            result.put("maxLevelMb", 1200);
        }
        result.put("bands", bandsArray);

        boolean bassSupported = bassBoost != null && safeBassSupported();
        result.put("bassBoostSupported", bassSupported);
        result.put("bassBoostStrength", (int) savedBassBoostStrength);

        boolean virtSupported = virtualizer != null && safeVirtSupported();
        result.put("virtualizerSupported", virtSupported);
        result.put("virtualizerStrength", (int) savedVirtualizerStrength);

        return result;
    }

    private boolean safeBassSupported() {
        try {
            return bassBoost != null && bassBoost.getStrengthSupported();
        } catch (Throwable t) {
            return false;
        }
    }

    private boolean safeVirtSupported() {
        try {
            return virtualizer != null && virtualizer.getStrengthSupported();
        } catch (Throwable t) {
            return false;
        }
    }

    public synchronized void setEqEnabled(boolean enabled) {
        this.eqEnabled = enabled;
        if (equalizer != null) {
            try {
                equalizer.setEnabled(enabled);
            } catch (Throwable ignored) {}
        }
        if (bassBoost != null) {
            try {
                bassBoost.setEnabled(enabled && savedBassBoostStrength > 0);
            } catch (Throwable ignored) {}
        }
        if (virtualizer != null) {
            try {
                virtualizer.setEnabled(enabled && savedVirtualizerStrength > 0);
            } catch (Throwable ignored) {}
        }
    }

    public synchronized void setEqBandLevel(int bandIndex, short levelMb) {
        if (equalizer == null) return;
        try {
            short numBands = equalizer.getNumberOfBands();
            if (bandIndex < 0 || bandIndex >= numBands) return;
            short[] range = equalizer.getBandLevelRange();
            short clamped = (short) Math.max(range[0], Math.min(range[1], levelMb));
            equalizer.setBandLevel((short) bandIndex, clamped);
            if (savedBandLevelsMb == null || savedBandLevelsMb.length != numBands) {
                savedBandLevelsMb = new short[numBands];
                for (short i = 0; i < numBands; i++) {
                    savedBandLevelsMb[i] = equalizer.getBandLevel(i);
                }
            }
            savedBandLevelsMb[bandIndex] = clamped;
        } catch (Throwable ignored) {}
    }

    public synchronized void setBassBoostStrength(short strength) {
        short clamped = (short) Math.max(0, Math.min(1000, strength));
        savedBassBoostStrength = clamped;
        if (bassBoost != null && safeBassSupported()) {
            try {
                bassBoost.setEnabled(eqEnabled && clamped > 0);
                bassBoost.setStrength(clamped);
            } catch (Throwable ignored) {}
        }
    }

    public synchronized void setVirtualizerStrength(short strength) {
        short clamped = (short) Math.max(0, Math.min(1000, strength));
        savedVirtualizerStrength = clamped;
        if (virtualizer != null && safeVirtSupported()) {
            try {
                virtualizer.setEnabled(eqEnabled && clamped > 0);
                virtualizer.setStrength(clamped);
            } catch (Throwable ignored) {}
        }
    }

    public void scheduleSleepTimer(long delayMs) {
        mainHandler.removeCallbacks(sleepTimerRunnable);
        if (delayMs <= 0) {
            sleepTimerEndAtMs = 0L;
            return;
        }
        sleepTimerEndAtMs = System.currentTimeMillis() + delayMs;
        mainHandler.postDelayed(sleepTimerRunnable, delayMs);
    }

    public void cancelSleepTimer() {
        mainHandler.removeCallbacks(sleepTimerRunnable);
        sleepTimerEndAtMs = 0L;
    }

    public long getSleepTimerEndAtMs() {
        if (sleepTimerEndAtMs > 0 && sleepTimerEndAtMs <= System.currentTimeMillis()) {
            sleepTimerEndAtMs = 0L;
        }
        return sleepTimerEndAtMs;
    }

    public void setPauseOnNoisy(boolean enabled) {
        mainHandler.post(() -> {
            if (player != null) {
                player.setHandleAudioBecomingNoisy(enabled);
            }
        });
    }

    public void setAudioFocusEnabled(boolean handleAudioFocus) {
        mainHandler.post(() -> {
            if (player != null) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build();
                player.setAudioAttributes(attrs, handleAudioFocus);
            }
        });
    }
}
