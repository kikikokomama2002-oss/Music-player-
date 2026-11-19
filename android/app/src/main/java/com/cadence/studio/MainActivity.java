package com.cadence.studio;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CadenceAudioPlugin.class);
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (CadenceAudioPlugin.shouldInterceptBack() && getBridge() != null) {
                    getBridge().triggerWindowJSEvent("cadenceHardwareBack");
                } else {
                    moveTaskToBack(true);
                }
            }
        });
    }
}
