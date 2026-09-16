package org.neocities.guildcraft.marketlab;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(FileSavePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
