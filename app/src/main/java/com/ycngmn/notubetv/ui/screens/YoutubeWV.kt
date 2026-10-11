package com.ycngmn.notubetv.ui.screens

import android.app.Activity
import android.graphics.Color as AndroidColor
import android.view.View
import android.webkit.CookieManager
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import com.multiplatform.webview.web.LoadingState
import com.multiplatform.webview.web.WebView
import com.multiplatform.webview.web.rememberWebViewNavigator
import com.multiplatform.webview.web.rememberWebViewState
import com.ycngmn.notubetv.R
import com.ycngmn.notubetv.utils.ExitBridge

private const val YOUTUBE_URL = "https://www.youtube.com/tv"

// Màu nền tối đồng bộ cho WebView và container để tránh hiện tượng chớp trắng hoặc lỗi nền player
private val NOTUBETV_BG = Color(0xFF09090B)

@Composable
fun YoutubeWV() {
    val context = LocalContext.current
    val activity = context as? Activity ?: return
    
    val state = rememberWebViewState(YOUTUBE_URL)
    val navigator = rememberWebViewNavigator()

    val exitTrigger = remember { mutableStateOf(false) }

    BackHandler {
        val backScript = runCatching {
            context.resources.openRawResource(R.raw.back_bridge)
                .bufferedReader().use { it.readText() }
        }.getOrDefault("")
        
        if (backScript.isNotBlank()) {
            navigator.evaluateJavaScript(backScript)
        }
    }

    if (exitTrigger.value) {
        activity.finish()
    }

    val rawResources = remember { listOf(
        R.raw.userscript,
        R.raw.spoof_viewport,
        R.raw.menu_trigger
    ) }

    LaunchedEffect(state.loadingState) {
        if (state.loadingState is LoadingState.Finished) {
            for (script in rawResources) {
                val js = runCatching {
                    context.resources.openRawResource(script)
                        .bufferedReader().use { it.readText() }
                }.getOrDefault("")
                
                if (js.isNotBlank()) {
                    navigator.evaluateJavaScript(js)
                }
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(NOTUBETV_BG)) {
        WebView(
            captureBackPresses = false,
            modifier = Modifier.fillMaxSize(), // Dùng fillMaxSize thay cho tính toán dp thủ công để tránh lệch khung nhìn
            state = state,
            navigator = navigator,
            onCreated = { webView ->
                // Thiết lập Cookie
                val cookieManager = CookieManager.getInstance()
                cookieManager.setAcceptCookie(true)
                cookieManager.setAcceptThirdPartyCookies(webView, true)
                cookieManager.flush()

                state.webSettings.apply {
                    // Sử dụng User Agent chuẩn Cobalt/TV để YouTube nhận diện đúng giao diện Leanback
                    customUserAgentString = "Mozilla/5.0 (DirectFB; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Cobalt/24.lts.3-gold (gzip) FireTV/AFTMM (Amazon, AFTMM)"
                    isJavaScriptEnabled = true

                    androidWebSettings.apply {
                        useWideViewPort = true
                        domStorageEnabled = true
                        hideDefaultVideoPoster = true
                        mediaPlaybackRequiresUserGesture = false
                    }
                }

                webView.apply {
                    addJavascriptInterface(ExitBridge(exitTrigger), "ExitBridge")
                    setLayerType(View.LAYER_TYPE_HARDWARE, null)
                    
                    // ĐÃ XÓA BỎ setInitialScale(25) - Nguyên nhân chính làm gãy UI, mất chữ và thumbnail!

                    // Ẩn thanh cuộn
                    isVerticalScrollBarEnabled = false
                    isHorizontalScrollBarEnabled = false

                    // Thiết lập màu nền WebView trùng với theme để player không bị lỗi nền trong suốt
                    setBackgroundColor(AndroidColor.parseColor("#09090B"))

                    settings.apply {
                        loadWithOverviewMode = true
                        textZoom = 100
                        setSupportZoom(false)          // Tắt zoom vì Android TV dùng remote, không dùng cảm ứng
                        builtInZoomControls = false    // Không bật điều khiển zoom built-in
                        displayZoomControls = false    // Ẩn nút điều khiển zoom thừa thãi
                    }
                }
            }
        )
    }
}