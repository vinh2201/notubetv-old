package com.ycngmn.notubetv.utils

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import com.multiplatform.webview.web.WebViewNavigator
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Lets userscript.js reach the SponsorBlock server through the app instead of the page
 * (used only when a request made from the page itself could not reach the server).
 * The answer is handed back to the script through window.onNetworkBridgeResponse(text).
 */
class NetworkBridge(private val navigator: WebViewNavigator) {

    private val main = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun fetch(url: String, videoId: String) {
        Thread {
            val body = if (isAllowed(url)) download(url) else ""
            main.post {
                navigator.evaluateJavaScript(
                    "window.onNetworkBridgeResponse && window.onNetworkBridgeResponse(" +
                        JSONObject.quote(body) + ")"
                )
            }
        }.start()
    }

    // The page can call this interface, so only the SponsorBlock API may be requested.
    private fun isAllowed(url: String) =
        url.startsWith("https://api.sponsor.ajay.app/api") || url.startsWith("https://sponsor.ajay.app/api")

    private fun download(url: String): String = try {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            conn.setRequestProperty("Accept", "application/json")
            if (conn.responseCode in 200..299) conn.inputStream.bufferedReader().use { it.readText() } else ""
        } finally {
            conn.disconnect()
        }
    } catch (e: Exception) {
        ""
    }
}