package com.example.breastfeed;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.webkit.JavascriptInterface;
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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);   // 启用 localStorage（用于保存记录）
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        // 暴露给网页的 JS 桥：用于把备份导出为真实文件
        webView.addJavascriptInterface(new JSBridge(), "AndroidBridge");

        // 留在应用内，不跳转到系统浏览器
        webView.setWebViewClient(new WebViewClient());

        setContentView(webView);

        // 加载打包进 APK 的本地页面（完全离线）
        webView.loadUrl("file:///android_asset/index.html");
    }

    /** 网页调用 window.AndroidBridge.exportData(json) 时，把 JSON 写到下载目录 */
    private class JSBridge {
        @JavascriptInterface
        public void exportData(String json) {
            try {
                String name = "母乳亲喂记录_"
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
