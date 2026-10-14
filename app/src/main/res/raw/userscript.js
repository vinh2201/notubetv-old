(function () {
    "use strict";

    const CONFIG_KEY = "ytaf-configuration";
    const defaultConfig = {
        enableAdBlock: true,
        enableSponsorBlock: true,
        sponsorBlockManualSkips: [],
        enableSponsorBlockSponsor: true,
        enableSponsorBlockIntro: true,
        enableSponsorBlockOutro: true,
        enableSponsorBlockInteraction: true,
        enableSponsorBlockSelfPromo: true,
        enableSponsorBlockMusicOfftopic: false,
        enableShorts: true,
    };

    let localConfig;
    try {
        localConfig = JSON.parse(window.localStorage[CONFIG_KEY]);
    } catch (err) {
        localConfig = defaultConfig;
    }

    window.localConfig = window.localStorage[CONFIG_KEY]
        ? JSON.parse(window.localStorage[CONFIG_KEY])
        : defaultConfig;

    window.configRead = function (key) {
        if (window.localConfig[key] === undefined) {
            window.localConfig[key] = defaultConfig[key];
        }
        return window.localConfig[key];
    };

    window.configWrite = function (key, value) {
        window.localConfig[key] = value;
        window.localStorage[CONFIG_KEY] = JSON.stringify(window.localConfig);
    };

    function showToast(title, subtitle) {
        const toastCmd = {
            openPopupAction: {
                popupType: "TOAST",
                popup: {
                    overlayToastRenderer: {
                        title: { simpleText: title },
                        subtitle: { simpleText: subtitle },
                    },
                },
            },
        };
        resolveCommand(toastCmd);
    }

    function showModal(title, content, selectIndex, id, update) {
        if (!update) {
            const closeCmd = { signalAction: { signal: "POPUP_BACK" } };
            resolveCommand(closeCmd);
        }

        const modalCmd = {
            openPopupAction: {
                popupType: "MODAL",
                popup: {
                    overlaySectionRenderer: {
                        overlay: {
                            overlayTwoPanelRenderer: {
                                actionPanel: {
                                    overlayPanelRenderer: {
                                        header: {
                                            overlayPanelHeaderRenderer: {
                                                title: { simpleText: title },
                                            },
                                        },
                                        content: {
                                            overlayPanelItemListRenderer: {
                                                items: content,
                                                selectedIndex: selectIndex,
                                            },
                                        },
                                    },
                                },
                                backButton: {
                                    buttonRenderer: {
                                        accessibilityData: {
                                            accessibilityData: { label: "Back" },
                                        },
                                        command: {
                                            signalAction: { signal: "POPUP_BACK" },
                                        },
                                    },
                                },
                            },
                        },
                        dismissalCommand: {
                            signalAction: { signal: "POPUP_BACK" },
                        },
                    },
                },
                uniqueId: id,
            },
        };

        if (update) {
            modalCmd.openPopupAction.shouldMatchUniqueId = true;
            modalCmd.openPopupAction.updateAction = true;
        }

        resolveCommand(modalCmd);
    }

    function buttonItem(title, icon, commands) {
        const button = {
            compactLinkRenderer: {
                serviceEndpoint: { commandExecutorCommand: { commands } },
            },
        };
        if (title) button.compactLinkRenderer.title = { simpleText: title.title };
        if (title.subtitle) button.compactLinkRenderer.subtitle = { simpleText: title.subtitle };
        if (icon) button.compactLinkRenderer.icon = { iconType: icon.icon };
        if (icon && icon.secondaryIcon) button.compactLinkRenderer.secondaryIcon = { iconType: icon.secondaryIcon };
        return button;
    }

    window.modernUI = function modernUI(update, parameters) {
        const settings = [
            { name: "Ad block", icon: "DOLLAR_SIGN", value: "enableAdBlock" },
            { name: "SponsorBlock", icon: "MONEY_HAND", value: "enableSponsorBlock" },
            { name: "Skip Sponsor Segments", icon: "MONEY_HEART", value: "enableSponsorBlockSponsor" },
            { name: "Skip Intro Segments", icon: "PLAY_CIRCLE", value: "enableSponsorBlockIntro" },
            { name: "Skip Outro Segments", value: "enableSponsorBlockOutro" },
            { name: "Skip Interaction Reminder", value: "enableSponsorBlockInteraction" },
            { name: "Skip Self-Promotion", value: "enableSponsorBlockSelfPromo" },
            { name: "Skip Off-Topic Music", value: "enableSponsorBlockMusicOfftopic" },
            { name: "Shorts", icon: "YOUTUBE_SHORTS_FILL_24", value: "enableShorts" },
        ];

        const buttons = [];
        let index = 0;
        for (const setting of settings) {
            const currentVal = setting.value ? configRead(setting.value) : null;
            buttons.push(
                buttonItem(
                    { title: setting.name, subtitle: setting.subtitle },
                    {
                        icon: setting.icon ? setting.icon : "CHEVRON_DOWN",
                        secondaryIcon: currentVal === null ? "CHEVRON_RIGHT" : currentVal ? "CHECK_BOX" : "CHECK_BOX_OUTLINE_BLANK",
                    },
                    currentVal !== null
                        ? [
                            {
                                setClientSettingEndpoint: {
                                    settingDatas: [
                                        {
                                            clientSettingEnum: { item: setting.value },
                                            boolValue: !configRead(setting.value),
                                        },
                                    ],
                                },
                            },
                            { customAction: { action: "SETTINGS_UPDATE", parameters: [index] } },
                        ]
                        : [{ customAction: { action: "OPTIONS_SHOW", parameters: { options: setting.options, selectedIndex: 0, update: false } } }]
                )
            );
            index++;
        }

        showModal("NoTubeTV Settings", buttons, parameters && parameters.length > 0 ? parameters[0] : 0, "tt-settings", update);
    };

    function resolveCommand(cmd, _) {
        for (const key in window._yttv) {
            if (window._yttv[key] && window._yttv[key].instance && window._yttv[key].instance.resolveCommand) {
                return window._yttv[key].instance.resolveCommand(cmd, _);
            }
        }
    }

  // Patch resolveCommand to be able to change NotubeTv settings

  // Patch resolveCommand xử lý chuẩn xác commandExecutorCommand và cập nhật setting
  function patchResolveCommand() {
    let retries = 0;
    const maxRetries = 50;
    
    const interval = setInterval(() => {
      let patched = false;
      for (const key in window._yttv) {
        if (
          window._yttv[key] &&
          window._yttv[key].instance &&
          typeof window._yttv[key].instance.resolveCommand === "function"
        ) {
          const instance = window._yttv[key].instance;
          
          if (!instance._notubetvPatched) {
            const ogResolve = instance.resolveCommand;
            instance.resolveCommand = function (cmd, _) {
              let commandsToExec = [];
              
              // Bóc tách mảng lệnh từ commandExecutorCommand của YouTube TV
              if (cmd && cmd.commandExecutorCommand && Array.isArray(cmd.commandExecutorCommand.commands)) {
                commandsToExec = cmd.commandExecutorCommand.commands;
              } else if (cmd && cmd.setClientSettingEndpoint) {
                commandsToExec = [cmd];
              } else if (cmd && cmd.customAction) {
                commandsToExec = [cmd];
              }

              if (commandsToExec.length > 0) {
                let handledCustomAction = false;
                let targetParameters = null;

                for (const subCmd of commandsToExec) {
                  if (subCmd.setClientSettingEndpoint) {
                    for (const settingData of subCmd.setClientSettingEndpoint.settingDatas) {
                      if (settingData.clientSettingEnum && settingData.clientSettingEnum.item) {
                        const itemName = settingData.clientSettingEnum.item;
                        const valName = Object.keys(settingData).find((k) => k.includes("Value"));
                        if (valName) {
                          const value = valName === "intValue" ? Number(settingData[valName]) : settingData[valName];
                          if (valName === "arrayValue") {
                            const arr = configRead(itemName);
                            if (arr.includes(value)) {
                              arr.splice(arr.indexOf(value), 1);
                            } else {
                              arr.push(value);
                            }
                            configWrite(itemName, arr);
                          } else {
                            configWrite(itemName, value);
                          }
                        }
                      }
                    }
                  } else if (subCmd.customAction) {
                    handledCustomAction = true;
                    targetParameters = subCmd.customAction.parameters;
                    customAction(subCmd.customAction.action, subCmd.customAction.parameters);
                  }
                }

                // Chặn không cho YouTube TV xử lý tiếp các setting tùy chỉnh gây lỗi
                if (handledCustomAction || commandsToExec.some(c => c.setClientSettingEndpoint)) {
                  return true;
                }
              }

              return ogResolve.call(this, cmd, _);
            };
            
            instance._notubetvPatched = true;
            patched = true;
          }
        }
      }
      
      if (patched || retries >= maxRetries) {
        clearInterval(interval);
      }
      retries++;
    }, 200);
  }

    function customAction(action, parameters) {
        switch (action) {
            case "SETTINGS_UPDATE":
                modernUI(true, parameters);
                break;
            case "SKIP":
                const video = document.querySelector("video");
                if (video) {
                    video.currentTime = parameters.time;
                }
                resolveCommand({ signalAction: { signal: "POPUP_BACK" } });
                break;
        }
    }

    /* ============================================================
       ENHANCED ADBLOCK - 2025 YouTube TV Selectors
       ============================================================ */
    const origParse = JSON.parse;
    JSON.parse = function () {
        const r = origParse.apply(this, arguments);

        if (!configRead("enableAdBlock")) return r;

        // Classic ad fields
        if (r.adPlacements) r.adPlacements = [];
        if (r.playerAds) r.playerAds = false;
        if (r.adSlots) r.adSlots = [];
        if (r.playerConfig?.playerAds) r.playerConfig.playerAds = false;

        // New 2024/2025 ad fields
        if (r.adBreakHeartbeatParams) r.adBreakHeartbeatParams = {};
        if (r.adBreakServiceRenderer) r.adBreakServiceRenderer = {};
        if (r.adPlacementConfig) r.adPlacementConfig = {};
        if (r.adServingDataEntry) r.adServingDataEntry = {};
        if (r.adSignalsInfo) r.adSignalsInfo = {};

        // Drop masthead ad from home
        try {
            const browseContent = r?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer?.contents;
            if (browseContent) {
                const firstShelf = browseContent[0];
                if (firstShelf?.shelfRenderer?.content?.horizontalListRenderer?.items) {
                    firstShelf.shelfRenderer.content.horizontalListRenderer.items =
                        firstShelf.shelfRenderer.content.horizontalListRenderer.items.filter(i => !i?.adSlotRenderer && !i?.promotedSparklesWebRenderer);
                }
            }
        } catch (e) {}

        // Drop ads from search results
        try {
            const searchContents = r?.contents?.tvSearchRenderer?.content?.sectionListRenderer?.contents;
            if (searchContents) {
                r.contents.tvSearchRenderer.content.sectionListRenderer.contents =
                    searchContents.filter(item => !item?.promotedVideoRenderer && !item?.adSlotRenderer);
            }
        } catch (e) {}

        // Drop ads from watch next
        try {
            const watchNext = r?.contents?.twoColumnWatchNextResults?.results?.results?.contents;
            if (watchNext) {
                r.contents.twoColumnWatchNextResults.results.results.contents =
                    watchNext.filter(item => !item?.promotedVideoRenderer && !item?.adSlotRenderer);
            }
        } catch (e) {}

        // Disable Shorts
        if (!configRead("enableShorts")) {
            try {
                const browse = r?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer?.contents;
                if (browse) {
                    r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents =
                        browse.filter((shelve) => shelve.shelfRenderer?.tvhtml5ShelfRendererType !== "TVHTML5_SHELF_RENDERER_TYPE_SHORTS");
                }
            } catch (e) {}
        }

        return r;
    };

    /* ============================================================
       DOM-BASED ADBLOCK - Catches ads that slip through JSON hook
       ============================================================ */
    function injectAdBlockCSS() {
        const css = `
            .video-ads, .ytp-ad-module, ytm-promoted-video-renderer,
            [class*="ad-"], [id*="ad-"], .ytp-skip-ad-button,
            .ytp-ad-progress-list, .ytp-ad-persistent-progress-bar,
            .ytp-ad-text, .ytp-ad-overlay-container, .ytp-ad-image,
            ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer,
            ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer,
            .ytd-player-legacy-desktop-watch-ads-render,
            #player-ads, .ytp-ad-action-interstitial,
            .ytp-ad-feedback-dialog, .ytp-ad-duration-remaining,
            .ytp-ad-preview-container, .ytp-ad-skip-button,
            .ytp-ad-skip-button-modern, .ytp-ad-overlay-slot,
            .ytp-ad-player-overlay, .ytp-ad-player-overlay-flyout-cta,
            .ytp-ad-visit-advertiser-link, .ytp-ad-badge,
            ytd-rich-item-renderer:has(ytd-display-ad-renderer),
            ytd-rich-item-renderer:has(ytd-ad-slot-renderer) { display: none !important; }
        `;

        const style = document.createElement("style");
        style.id = "notubetv-adblock-css";
        style.textContent = css;
        document.head.appendChild(style);
    }

    function autoSkipAds() {
        setInterval(() => {
            const skipBtn = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern');
            if (skipBtn) skipBtn.click();

            const closeBtns = document.querySelectorAll('.ytp-ad-overlay-close-button, .ytp-ad-close-button');
            closeBtns.forEach(btn => btn.click());

            const video = document.querySelector('video');
            const adModule = document.querySelector('.video-ads, .ytp-ad-module');
            if (video && adModule && adModule.children.length > 0) {
                const adDuration = video.duration || 9999;
                if (video.currentTime < adDuration - 1) {
                    video.currentTime = adDuration;
                }
            }

            document.querySelectorAll('iframe[src*="googleads"], iframe[src*="doubleclick"]').forEach(iframe => iframe.remove());
        }, 500);
    }

    /* ============================================================
       SPONSORBLOCK - Unchanged (works well)
       ============================================================ */
    var sha256 = function sha256(ascii) {
        function rightRotate(value, amount) {
            return (value >>> amount) | (value << (32 - amount));
        }
        var mathPow = Math.pow;
        var maxWord = mathPow(2, 32);
        var lengthProperty = "length";
        var i, j;
        var result = "";
        var words = [];
        var asciiBitLength = ascii[lengthProperty] * 8;
        var hash = [], k = [];
        var primeCounter = 0;
        var isComposite = {};
        for (var candidate = 2; primeCounter < 64; candidate++) {
            if (!isComposite[candidate]) {
                for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
                hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
                k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
            }
        }
        ascii += "\x80";
        while ((ascii[lengthProperty] % 64) - 56) ascii += "\x00";
        for (i = 0; i < ascii[lengthProperty]; i++) {
            j = ascii.charCodeAt(i);
            if (j >> 8) return;
            words[i >> 2] |= j << (((3 - i) % 4) * 8);
        }
        words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
        words[words[lengthProperty]] = asciiBitLength;
        for (j = 0; j < words[lengthProperty];) {
            var w = words.slice(j, (j += 16));
            var oldHash = hash;
            hash = hash.slice(0, 8);
            for (i = 0; i < 64; i++) {
                var w15 = w[i - 15], w2 = w[i - 2];
                var a = hash[0], e = hash[4];
                var temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] + (w[i] = i < 16 ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
                var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
                hash = [(temp1 + temp2) | 0].concat(hash);
                hash[4] = (hash[4] + temp1) | 0;
            }
            for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
        }
        for (i = 0; i < 8; i++) {
            for (j = 3; j + 1; j--) {
                var b = (hash[i] >> (j * 8)) & 255;
                result += (b < 16 ? 0 : "") + b.toString(16);
            }
        }
        return result;
    };

    const barTypes = {
        sponsor: { color: "#00d400", opacity: "0.7", name: "sponsored segment" },
        intro: { color: "#00ffff", opacity: "0.7", name: "intro" },
        outro: { color: "#0202ed", opacity: "0.7", name: "outro" },
        interaction: { color: "#cc00ff", opacity: "0.7", name: "interaction reminder" },
        selfpromo: { color: "#ffff00", opacity: "0.7", name: "self-promotion" },
        music_offtopic: { color: "#ff9900", opacity: "0.7", name: "non-music part" },
    };

    const sponsorblockAPI = "https://sponsor.ajay.app/api";

    class SponsorBlockHandler {
        video = null;
        active = true;
        attachVideoTimeout = null;
        nextSkipTimeout = null;
        sliderInterval = null;
        observer = null;
        scheduleSkipHandler = null;
        durationChangeHandler = null;
        segments = null;
        skippableCategories = [];
        manualSkippableCategories = [];

        constructor(videoID) {
            this.videoID = videoID;
        }

        async init() {
            if (!configRead("enableSponsorBlock")) return;
            const videoHash = sha256(this.videoID).substring(0, 4);
            const categories = ["sponsor", "intro", "outro", "interaction", "selfpromo", "music_offtopic"];

            const resp = await new Promise((resolve) => {
                window.onNetworkBridgeResponse = (jsonString) => resolve(jsonString);
                NetworkBridge.fetch(
                    `${sponsorblockAPI}/skipSegments/${videoHash}?categories=${encodeURIComponent(JSON.stringify(categories))}`,
                    this.videoID
                );
            });

            const result = JSON.parse(resp);
            if (!result || !result.segments || !result.segments.length) return;

            this.segments = result.segments;
            this.manualSkippableCategories = configRead("sponsorBlockManualSkips");
            this.skippableCategories = this.getSkippableCategories();
            this.scheduleSkipHandler = () => this.scheduleSkip();
            this.durationChangeHandler = () => this.buildOverlay();
            this.attachVideo();
            this.buildOverlay();
        }

        getSkippableCategories() {
            const skippableCategories = [];
            if (configRead("enableSponsorBlockSponsor")) skippableCategories.push("sponsor");
            if (configRead("enableSponsorBlockIntro")) skippableCategories.push("intro");
            if (configRead("enableSponsorBlockOutro")) skippableCategories.push("outro");
            if (configRead("enableSponsorBlockInteraction")) skippableCategories.push("interaction");
            if (configRead("enableSponsorBlockSelfPromo")) skippableCategories.push("selfpromo");
            if (configRead("enableSponsorBlockMusicOfftopic")) skippableCategories.push("music_offtopic");
            return skippableCategories;
        }

        attachVideo() {
            clearTimeout(this.attachVideoTimeout);
            this.attachVideoTimeout = null;
            this.video = document.querySelector("video");
            if (!this.video) {
                this.attachVideoTimeout = setTimeout(() => this.attachVideo(), 100);
                return;
            }
            this.video.addEventListener("play", this.scheduleSkipHandler);
            this.video.addEventListener("durationchange", this.durationChangeHandler);
        }

        buildOverlay() {
            if (this.segmentsoverlay) return;
            if (!this.video || !this.video.duration) return;

            const videoDuration = this.video.duration;
            this.segmentsoverlay = document.createElement("div");
            this.segments.forEach((segment) => {
                const [start, end] = segment.segment;
                const barType = barTypes[segment.category] || { color: "blue", opacity: 0.7 };
                const transform = `translateX(${(start / videoDuration) * 100.0}%) scaleX(${(end - start) / videoDuration})`;
                const elm = document.createElement("div");
                elm.classList.add("ytLrProgressBarPlayed");
                elm.style["background"] = barType.color;
                elm.style["opacity"] = barType.opacity;
                elm.style["-webkit-transform"] = transform;
                this.segmentsoverlay.appendChild(elm);
            });

            this.observer = new MutationObserver((mutations) => {
                mutations.forEach((m) => {
                    if (m.removedNodes) {
                        for (const node of m.removedNodes) {
                            if (node === this.segmentsoverlay) {
                                this.slider.appendChild(this.segmentsoverlay);
                            }
                        }
                    }
                });
            });

            this.sliderInterval = setInterval(() => {
                this.slider = document.querySelector('[idomkey="slider"]');
                if (this.slider) {
                    clearInterval(this.sliderInterval);
                    this.sliderInterval = null;
                    this.observer.observe(this.slider, { childList: true });
                    this.slider.appendChild(this.segmentsoverlay);
                }
            }, 500);
        }

        scheduleSkip() {
            clearTimeout(this.nextSkipTimeout);
            this.nextSkipTimeout = null;
            if (!this.active || this.video.paused) return;
            const current = this.video.currentTime;
            const nextSegments = this.segments.filter((seg) => seg.segment[0] >= current - 0.2).sort((a, b) => a.segment[0] - b.segment[0]);
            if (!nextSegments.length) return;
            const [segment] = nextSegments;
            const [start, end] = segment.segment;
            if (current >= end) return;
            const delay = Math.max(0, (start - current) * 1000);
            this.nextSkipTimeout = setTimeout(() => {
                if (this.video.paused) return;
                if (!this.skippableCategories.includes(segment.category)) return;
                const skipName = barTypes[segment.category]?.name || segment.category;
                if (!this.manualSkippableCategories.includes(segment.category)) {
                    showToast("SponsorBlock", `Skipping ${skipName}`);
                    this.video.currentTime = end;
                    this.scheduleSkip();
                }
            }, delay);
        }

        destroy() {
            this.active = false;
            this.segments = null;
            if (this.nextSkipTimeout) { clearTimeout(this.nextSkipTimeout); this.nextSkipTimeout = null; }
            if (this.attachVideoTimeout) { clearTimeout(this.attachVideoTimeout); this.attachVideoTimeout = null; }
            if (this.sliderInterval) { clearInterval(this.sliderInterval); this.sliderInterval = null; }
            if (this.observer) { this.observer.disconnect(); this.observer = null; }
            if (this.segmentsoverlay) { this.segmentsoverlay.remove(); this.segmentsoverlay = null; }
            if (this.video) {
                this.video.removeEventListener("play", this.scheduleSkipHandler);
                this.video.removeEventListener("durationchange", this.durationChangeHandler);
            }
        }
    }

    window.sponsorblock = null;

    window.addEventListener("hashchange", () => {
        if (!configRead("enableSponsorBlock")) {
            if (window.sponsorblock) window.sponsorblock.destroy();
            return;
        }
        const match = location.hash.match(/[?&]v=([^&]+)/);
        const videoID = match ? match[1] : null;
        if (!videoID) return;
        const needsReload = !window.sponsorblock || window.sponsorblock.videoID != videoID;
        if (needsReload) {
            if (window.sponsorblock) { window.sponsorblock.destroy(); window.sponsorblock = null; }
            window.sponsorblock = new SponsorBlockHandler(videoID);
            window.sponsorblock.init();
        }
    }, false);

    /* ============================================================
       INITIALIZATION
       ============================================================ */
    const interval$1 = setInterval(() => {
        const videoElement = document.querySelector("video");
        if (videoElement) {
            execute_once_dom_loaded();
            patchResolveCommand();
            injectAdBlockCSS();
            autoSkipAds();
            clearInterval(interval$1);
        }
    }, 250);

    function execute_once_dom_loaded() {
        var css_248z = ".ytaf-ui-container {\n position: absolute;\n top: 10%;\n left: 10%;\n right: 10%;\n bottom: 10%;\n\n background: rgba(0, 0, 0, 0.8);\n color: white;\n border-radius: 20px;\n padding: 20px;\n font-size: 1.5rem;\n z-index: 1000;\n}\n\n.ytaf-ui-container :focus {\n outline: 4px red solid;\n}\n\n.ytaf-ui-container h1 {\n margin: 0;\n margin-bottom: 0.5em;\n text-align: center;\n}\n\n.ytaf-ui-container input[type='checkbox'] {\n width: 1.4rem;\n height: 1.4rem;\n}\n\n.ytaf-ui-container input[type='radio'] {\n width: 1.4rem;\n height: 1.4rem;\n}\n\n.ytaf-ui-container label {\n display: block;\n font-size: 1.4rem;\n}\n\n.ytaf-notification-container {\n position: absolute;\n right: 10px;\n bottom: 10px;\n font-size: 16pt;\n z-index: 1200;\n}\n\n.ytaf-notification-container .message {\n background: rgba(0, 0, 0, 0.7);\n color: white;\n padding: 1em;\n margin: 0.5em;\n transition: all 0.3s ease-in-out;\n opacity: 1;\n line-height: 1;\n border-right: 10px solid rgba(50, 255, 50, 0.3);\n display: inline-block;\n float: right;\n}\n\n.ytaf-notification-container .message-hidden {\n opacity: 0;\n margin: 0 0.5em;\n padding: 0 1em;\n line-height: 0;\n}\n\n/* Fixes transparency effect for the video player */\n\n.ytLrWatchDefaultShadow {\n background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0.8) 90%) !important;\n background-color: rgba(0, 0, 0, 0.3) !important;\n display: block !important;\n height: 100% !important;\n pointer-events: none !important;\n position: absolute !important;\n width: 100% !important;\n}\n\n/* Fixes shorts having a black background */\n\n.ytLrTileHeaderRendererShorts {\n background-image: none !important;\n}";

        const existingStyle = document.querySelector("style[nonce]");
        if (existingStyle) {
            existingStyle.textContent += css_248z;
        } else {
            const style = document.createElement("style");
            style.textContent = css_248z;
            document.head.appendChild(style);
        }

        var uiContainer = document.createElement("div");
        uiContainer.classList.add("ytaf-ui-container");
        uiContainer.style["display"] = "none";
        uiContainer.setAttribute("tabindex", 0);
        uiContainer.addEventListener("keydown", (evt) => {
            if (evt.keyCode === 13 || evt.keyCode === 32) {
                const focusedElement = document.querySelector(":focus");
                if (focusedElement.type === "checkbox") {
                    focusedElement.checked = !focusedElement.checked;
                    focusedElement.dispatchEvent(new Event("change"));
                }
                evt.preventDefault();
                evt.stopPropagation();
                return;
            }
        }, true);
    }
})();