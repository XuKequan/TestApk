package com.example.breastfeed;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {

    private WebView webView;
    // 文件选择（头像上传等 <input type="file">）回调
    private ValueCallback<Uri[]> uploadMessage;
    private static final int REQUEST_SELECT_FILE = 100;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);   // 启用 localStorage（用于保存记录）
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        // 放行 file:// 页面访问局域网 WebDAV（免 CORS，便于多端同步）
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        // 暴露给网页的 JS 桥：用于把备份导出为真实文件 / 同步状态栏颜色
        webView.addJavascriptInterface(new JSBridge(), "AndroidBridge");

        // 留在应用内，不跳转到系统浏览器
        webView.setWebViewClient(new WebViewClient());

        // 关键：实现文件选择器，否则网页里的 <input type="file"> 点击无反应
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> filePathCallback,
                                             WebChromeClient.FileChooserParams fileChooserParams) {
                // 防止上一次回调未释放导致无法再次选择
                if (uploadMessage != null) {
                    uploadMessage.onReceiveValue(null);
                    uploadMessage = null;
                }
                uploadMessage = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivityForResult(intent, REQUEST_SELECT_FILE);
                } catch (ActivityNotFoundException e) {
                    uploadMessage = null;
                    Toast.makeText(MainActivity.this, "未找到可用的文件选择应用", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });

        setContentView(webView);

        // 加载打包进 APK 的本地页面（完全离线）
        webView.loadUrl("file:///android_asset/index.html");
    }

    /** 文件选择结果回传，必须交给网页的 input 元素 */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_SELECT_FILE) {
            if (uploadMessage == null) {
                super.onActivityResult(requestCode, resultCode, data);
                return;
            }
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String dataString = data.getDataString();
                ClipData clipData = data.getClipData();
                if (clipData != null) {
                    results = new Uri[clipData.getItemCount()];
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        results[i] = clipData.getItemAt(i).getUri();
                    }
                } else if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                }
            }
            uploadMessage.onReceiveValue(results);
            uploadMessage = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    /** 网页调用 window.AndroidBridge.exportData(json) 时，把 JSON 写到下载目录 */
    private class JSBridge {
        @JavascriptInterface
        public void exportData(String json) {
            try {
                String name = "母乳喂养记录_"
                        + new SimpleDateFormat("yyyy-MM-dd", Locale.CHINA).format(new Date())
                        + ".json";
                File dir;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // Android 10+：用 MediaStore 写入公共下载目录（无需存储权限）
                    android.content.ContentValues cv = new android.content.ContentValues();
                    cv.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, name);
                    cv.put(android.provider.MediaStore.Downloads.MIME_TYPE, "application/json");
                    cv.put(android.provider.MediaStore.Downloads.RELATIVE_PATH,
                            Environment.DIRECTORY_DOWNLOADS);
                    android.net.Uri uri = getContentResolver()
                            .insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                        os.write(json.getBytes("UTF-8"));
                    }
                    String finalPath = Environment.DIRECTORY_DOWNLOADS + "/" + name;
                    runOnUiThread(() -> Toast.makeText(MainActivity.this,
                            "已导出到：下载/" + name, Toast.LENGTH_LONG).show());
                } else {
                    // Android 9 及以下：写入应用私有下载目录（无需权限）
                    dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir != null) {
                        dir.mkdirs();
                        File f = new File(dir, name);
                        try (FileOutputStream fos = new FileOutputStream(f)) {
                            fos.write(json.getBytes("UTF-8"));
                        }
                        String path = f.getAbsolutePath();
                        runOnUiThread(() -> Toast.makeText(MainActivity.this,
                                "已导出到：" + path, Toast.LENGTH_LONG).show());
                    }
                }
            } catch (Exception e) {
                String msg = e.getMessage();
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "导出失败：" + (msg == null ? "未知错误" : msg), Toast.LENGTH_LONG).show());
            }
        }

        /** 网页调用 window.AndroidBridge.setBarColors(status, nav, lightIcons) 同步状态栏/导航栏颜色 */
        @JavascriptInterface
        public void setBarColors(String statusColor, String navColor, boolean lightIcons) {
            try {
                final int sc = Color.parseColor(statusColor);
                final int nc = Color.parseColor(navColor);
                final boolean li = lightIcons;
                final android.view.Window w = MainActivity.this.getWindow();
                MainActivity.this.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        w.setStatusBarColor(sc);
                        w.setNavigationBarColor(nc);
                        int vis = w.getDecorView().getSystemUiVisibility();
                        if (li) {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                                vis |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                                vis |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        } else {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                                vis &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                                vis &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        }
                        w.getDecorView().setSystemUiVisibility(vis);
                    }
                });
            } catch (Exception e) { }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
