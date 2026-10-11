package com.ycngmn.notubetv.ui.screens

import android.app.Activity
import android.graphics.Color as AndroidColor
import android.view.View
import android.webkit.CookieManager
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import com.multiplatform.webview.web.LoadingState
import com.multiplatform.webview.web.WebView
import com.multiplatform.webview.web.rememberWebViewNavigator
import com.multiplatform.webview.web.rememberWebViewState
import com.ycngmn.notubetv.R
import com.ycngmn.notubetv.utils.ExitBridge

private const val YOUTUBE_URL = "https://www.youtube.com/tv"

// Màu nền tối đồng bộ tránh chớp trắng hoặc lộ khung nền player
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

    // Lấy kích thước chuẩn theo cách của bản gốc cũ
    val configuration = LocalConfiguration.current
    val density = LocalDensity.current

    val screenWidthPx = with(density) { configuration.screenWidthDp.dp.toPx() }
    val screenHeightPx = with(density) { configuration.screenHeightDp.dp.toPx() }

    Box(modifier = Modifier.fillMaxSize().background(NOTUBETV_BG)) {
        WebView(
            captureBackPresses = false,
            // Giữ nguyên modifier tính toán size chính xác như bản gốc cũ để không bị phình to
            modifier = Modifier
                .size(
                    with(density) { screenWidthPx.toDp() },
                    with(density) { screenHeightPx.toDp() }
                ),
            state = state,
            navigator = navigator,
            onCreated = { webView ->
                // Thiết lập Cookie
                val cookieManager = CookieManager.getInstance()
                cookieManager.setAcceptCookie(true)
                cookieManager.setAcceptThirdPartyCookies(webView, true)
                cookieManager.flush()

                state.webSettings.apply {
                    // Dùng UA chuẩn TV/Cobalt
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
                    
                    // TUYỆT ĐỐI KHÔNG CÓ setInitialScale(25) ở đây nữa!

                    // Ẩn thanh cuộn
                    isVerticalScrollBarEnabled = false
                    isHorizontalScrollBarEnabled = false

                    // Set màu nền trùng với theme để player khít rịt, hết khung đen
                    setBackgroundColor(AndroidColor.parseColor("#09090B"))

                    settings.apply {
                        loadWithOverviewMode = true
                        textZoom = 100
                        setSupportZoom(false)
                        builtInZoomControls = false
                        displayZoomControls = false
                    }
                }
            }
        )
    }
}