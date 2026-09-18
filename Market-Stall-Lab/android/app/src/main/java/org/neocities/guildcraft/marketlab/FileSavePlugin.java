package org.neocities.guildcraft.marketlab.vpng1;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "FileSave")
public class FileSavePlugin extends Plugin {
    @PluginMethod
    public void saveFile(PluginCall call) {
        String name = call.getString("name");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String text = call.getString("text");
        if (name == null || name.isBlank() || text == null) {
            call.reject("name and text are required");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "saveFileResult");
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("File save cancelled");
            return;
        }

        Uri uri = data.getData();
        String text = call.getString("text", "");
        try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (output == null) throw new IllegalStateException("Android did not provide a writable file stream");
            output.write(text.getBytes(StandardCharsets.UTF_8));
            output.flush();
            JSObject resultData = new JSObject();
            resultData.put("uri", uri.toString());
            call.resolve(resultData);
        } catch (Exception error) {
            call.reject("Unable to save selected file", error);
        }
    }
}
