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
    enableForceAvc1: true, // Thêm tùy chọn Force Codec AVC1 mặc định là true
  };

  let localConfig;

  try {
    localConfig = JSON.parse(window.localStorage[CONFIG_KEY]);
  } catch (err) {
    //console.warn('Config read failed:', err);
    localConfig = { ...defaultConfig };
    try {
      window.localStorage[CONFIG_KEY] = JSON.stringify(localConfig);
    } catch (storageErr) {
      // Storage unavailable; keep the in-memory defaults.
    }
  }

  window.localConfig = localConfig;

  window.configRead = function (key) {
    if (window.localConfig[key] === undefined) {
      window.localConfig[key] = defaultConfig[key];
    }
    return window.localConfig[key];
  };

  window.configWrite = function (key, value) {
    window.localConfig[key] = value;
    window.localStorage[CONFIG_KEY] = JSON.stringify(window.localConfig);
    // Shorts visibility must follow the toggle immediately (the "storage" event
    // never fires inside the window that did the write).
    if (key === "enableShorts") {
      try {
        applyShortsHidingCSS();
      } catch (err) {}
    }
  };

  function showToast(title, subtitle, thumbnails) {
    const toastCmd = {
      openPopupAction: {
        popupType: "TOAST",
        popup: {
          overlayToastRenderer: {
            title: {
              simpleText: title,
            },
            subtitle: {
              simpleText: subtitle,
            },
          },
        },
      },
    };
    resolveCommand(toastCmd);
  }

  function showModal(title, content, selectIndex, id, update) {
    if (!update) {
      const closeCmd = {
        signalAction: {
          signal: "POPUP_BACK",
        },
      };
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
                        title: {
                          simpleText: title,
                        },
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
                      accessibilityData: {
                        label: "Back",
                      },
                    },
                    command: {
                      signalAction: {
                        signal: "POPUP_BACK",
                      },
                    },
                  },
                },
              },
            },
            dismissalCommand: {
              signalAction: {
                signal: "POPUP_BACK",
              },
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
        serviceEndpoint: {
          commandExecutorCommand: {
            commands,
          },
        },
      },
    };

    if (title) {
      button.compactLinkRenderer.title = {
        simpleText: title.title,
      };
    }

    if (title.subtitle) {
      button.compactLinkRenderer.subtitle = {
        simpleText: title.subtitle,
      };
    }

    if (icon) {
      button.compactLinkRenderer.icon = {
        iconType: icon.icon,
      };
    }

    if (icon && icon.secondaryIcon) {
      button.compactLinkRenderer.secondaryIcon = {
        iconType: icon.secondaryIcon,
      };
    }

    return button;
  }

  window.modernUI = function modernUI(update, parameters) {
    const settings = [
      {
        name: "Ad block",
        icon: "DOLLAR_SIGN",
        value: "enableAdBlock",
      },
      {
        name: "SponsorBlock",
        icon: "MONEY_HAND",
        value: "enableSponsorBlock",
      },
      {
        name: "Skip Sponsor Segments",
        icon: "MONEY_HEART",
        value: "enableSponsorBlockSponsor",
      },
      {
        name: "Skip Intro Segments",
        icon: "PLAY_CIRCLE",
        value: "enableSponsorBlockIntro",
      },
      {
        name: "Skip Outro Segments",
        value: "enableSponsorBlockOutro",
      },
      {
        name: "Skip Interaction Reminder Segments",
        value: "enableSponsorBlockInteraction",
      },
      {
        name: "Skip Self-Promotion Segments",
        value: "enableSponsorBlockSelfPromo",
      },
      {
        name: "Skip Off-Topic Music Segments",
        value: "enableSponsorBlockMusicOfftopic",
      },
      {
        name: "Shorts",
        icon: "YOUTUBE_SHORTS_FILL_24",
        value: "enableShorts",
      },
      {
        name: "Force Codec AVC1",
        icon: "SETTINGS",
        value: "enableForceAvc1",
      },
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
            secondaryIcon:
              currentVal === null
                ? "CHEVRON_RIGHT"
                : currentVal
                  ? "CHECK_BOX"
                  : "CHECK_BOX_OUTLINE_BLANK",
          },
          currentVal !== null
            ? [
                {
                  setClientSettingEndpoint: {
                    settingDatas: [
                      {
                        clientSettingEnum: {
                          item: setting.value,
                        },
                        boolValue: !configRead(setting.value),
                      },
                    ],
                  },
                },
                {
                  customAction: {
                    action: "SETTINGS_UPDATE",
                    parameters: [index],
                  },
                },
              ]
            : [
                {
                  customAction: {
                    action: "OPTIONS_SHOW",
                    parameters: {
                      options: setting.options,
                      selectedIndex: 0,
                      update: false,
                    },
                  },
                },
              ]
        )
      );
      index++;
    }

    showModal(
      "NoTubeTV Settings",
      buttons,
      parameters && parameters.length > 0 ? parameters[0] : 0,
      "tt-settings",
      update
    );
  };

  function resolveCommand(cmd, _) {
    for (const key in window._yttv) {
      if (
        window._yttv[key] &&
        window._yttv[key].instance &&
        window._yttv[key].instance.resolveCommand
      ) {
        return window._yttv[key].instance.resolveCommand(cmd, _);
      }
    }
  }

  // A command belongs to NoTubeTV only if it changes one of NoTubeTV's own config keys
  // (camelCase, listed in defaultConfig) or runs one of NoTubeTV's own custom actions.
  const NOTUBETV_ACTIONS = ["SETTINGS_UPDATE", "SKIP"];
  function isNoTubeTVCommand(c) {
    if (!c) return false;
    if (c.setClientSettingEndpoint) {
      const datas = c.setClientSettingEndpoint.settingDatas;
      return (
        Array.isArray(datas) &&
        datas.length > 0 &&
        datas.every(
          (d) =>
            d &&
            d.clientSettingEnum &&
            typeof d.clientSettingEnum.item === "string" &&
            Object.prototype.hasOwnProperty.call(defaultConfig, d.clientSettingEnum.item)
        )
      );
    }
    if (c.customAction) return NOTUBETV_ACTIONS.includes(c.customAction.action);
    return false;
  }

  // Patch resolveCommand để xử lý chuẩn xác commandExecutorCommand và cập nhật setting
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

              if (cmd && cmd.commandExecutorCommand && Array.isArray(cmd.commandExecutorCommand.commands)) {
                commandsToExec = cmd.commandExecutorCommand.commands;
              } else if (cmd && cmd.setClientSettingEndpoint) {
                commandsToExec = [cmd];
              } else if (cmd && cmd.customAction) {
                commandsToExec = [cmd];
              }

              // Only take over commands that were built by NoTubeTV's own settings
              // modal. Everything else (YouTube's own settings such as the video
              // quality menu, YouTube's own custom actions, ...) must reach the app.
              if (commandsToExec.length > 0 && commandsToExec.every(isNoTubeTVCommand)) {
                for (const subCmd of commandsToExec) {
                  if (subCmd.setClientSettingEndpoint) {
                    for (const settingData of subCmd.setClientSettingEndpoint.settingDatas) {
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
                          if (itemName === "enableShorts") {
                            try {
                              showToast(
                                "Shorts",
                                value ? "Enabled - reload Home to see them" : "Hidden"
                              );
                            } catch (toastErr) {}
                          }
                        }
                      }
                    }
                  } else if (subCmd.customAction) {
                    customAction(subCmd.customAction.action, subCmd.customAction.parameters);
                  }
                }
                return true;
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
        resolveCommand({
          signalAction: {
            signal: "POPUP_BACK",
          },
        });
        break;
    }
  }

  // Codec / quality policy
  //  - enableForceAvc1 ON : keep AVC1 only (when the video has AVC1).
  //  - enableForceAvc1 OFF: prefer AV01, otherwise VP9 (a codec the device cannot
  //    decode, or that the video does not offer, is skipped) and cap the video at 720p.
  const CODEC_MATCH = {
    av01: (mime) => mime.includes("av01"),
    vp9: (mime) => mime.includes("vp9") || mime.includes("vp09"),
  };
  const CODEC_PROBE = {
    av01: 'video/mp4; codecs="av01.0.05M.08"',
    vp9: 'video/webm; codecs="vp9"',
  };

  function isCodecSupported(codec) {
    try {
      if (typeof MediaSource === "undefined" || typeof MediaSource.isTypeSupported !== "function") {
        return true;
      }
      return MediaSource.isTypeSupported(CODEC_PROBE[codec]);
    } catch (err) {
      return true;
    }
  }

  function formatHeight(f) {
    if (typeof f.height === "number" && f.height > 0) return f.height;
    const m = /^(\d+)p/.exec(f.qualityLabel || "");
    return m ? Number(m[1]) : 0;
  }

  function filterFormatsKeepAvc1(formats) {
    const hasAvc1 = formats.some((f) => f.mimeType && f.mimeType.includes("avc1"));
    if (!hasAvc1) return formats;
    return formats.filter((f) => {
      const mime = f.mimeType || "";
      if (mime.startsWith("video/")) return mime.includes("avc1");
      return true;
    });
  }

  function filterFormatsAv01Vp9At720(formats) {
    const videos = formats.filter((f) => (f.mimeType || "").startsWith("video/"));
    if (!videos.length) return formats;

    // codec: AV01 -> VP9 -> (neither offered/supported) leave the codec alone
    const supported = { av01: isCodecSupported("av01"), vp9: isCodecSupported("vp9") };
    let target = null;
    for (const codec of ["av01", "vp9"]) {
      if (supported[codec] && videos.some((f) => CODEC_MATCH[codec](f.mimeType))) {
        target = codec;
        break;
      }
    }
    let pool;
    if (target) {
      pool = videos.filter((f) => CODEC_MATCH[target](f.mimeType));
    } else {
      // no AV01/VP9 to switch to: keep what the device can decode
      const decodable = videos.filter(
        (f) =>
          !(CODEC_MATCH.av01(f.mimeType) && !supported.av01) &&
          !(CODEC_MATCH.vp9(f.mimeType) && !supported.vp9)
      );
      pool = decodable.length ? decodable : videos;
    }

    // quality: exactly 720p when available, otherwise the closest lower one,
    // otherwise the lowest higher one (never leave the video without a stream)
    const heights = [...new Set(pool.map(formatHeight))].filter((h) => h > 0).sort((a, b) => a - b);
    if (!heights.length) return formats;
    let wanted;
    if (heights.includes(720)) {
      wanted = 720;
    } else {
      const lower = heights.filter((h) => h < 720);
      wanted = lower.length ? lower[lower.length - 1] : heights[0];
    }

    return formats.filter((f) => {
      if (!(f.mimeType || "").startsWith("video/")) return true; // keep audio & others
      return pool.includes(f) && formatHeight(f) === wanted;
    });
  }

  function filterStreamingDataCodec(streamingData) {
    if (!streamingData) return;
    const filterFormats = configRead("enableForceAvc1")
      ? filterFormatsKeepAvc1
      : filterFormatsAv01Vp9At720;

    for (const key of ["formats", "adaptiveFormats"]) {
      if (Array.isArray(streamingData[key])) {
        streamingData[key] = filterFormats(streamingData[key]);
      }
    }
  }

  function scrubPlayerAds(r) {
    if (Array.isArray(r?.adPlacements)) r.adPlacements = [];
    if (r?.playerAds) r.playerAds = false;
    if (Array.isArray(r?.adSlots)) r.adSlots = [];
  }

  function filterAdsFromSectionList(sectionList) {
    if (!sectionList || !Array.isArray(sectionList.contents)) return;

    sectionList.contents = sectionList.contents.filter(
      (elm) =>
        !elm?.adSlotRenderer &&
        !elm?.tvMastheadRenderer &&
        !elm?.mastheadAd &&
        !elm?.promotedSparklesTextSearchRenderer
    );

    for (const shelf of sectionList.contents) {
      const items = shelf?.shelfRenderer?.content?.horizontalListRenderer?.items;
      if (Array.isArray(items)) {
        shelf.shelfRenderer.content.horizontalListRenderer.items = items.filter(
          (item) => !item?.adSlotRenderer
        );
      }
    }
  }

  function stripAdsFromResponse(r) {
    scrubPlayerAds(r);
    forEachSectionList(r, filterAdsFromSectionList);

    if (Array.isArray(r?.entries)) {
      r.entries = r.entries.filter(
        (entry) => !entry?.command?.reelWatchEndpoint?.adClientParams?.isAd
      );
    }
  }

  const adSkipState = { videoId: null, ranges: [] };
  window.__vidroxAdSkipState = adSkipState;

  function collectDeclaredAdRanges(value, ranges, seen) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const entry of value) collectDeclaredAdRanges(entry, ranges, seen);
      return;
    }

    const offset = value.adTimeOffset;
    if (
      offset &&
      offset.offsetStartMilliseconds !== undefined &&
      offset.offsetEndMilliseconds !== undefined
    ) {
      const start = Number(offset.offsetStartMilliseconds) / 1000;
      const end = Number(offset.offsetEndMilliseconds) / 1000;
      if (isFinite(start) && isFinite(end) && end - start > 0.5) {
        ranges.push({ start, end });
      }
    }

    for (const key of Object.keys(value)) {
      collectDeclaredAdRanges(value[key], ranges, seen);
    }
  }

  function captureAdRangesFromPlayerResponse(r) {
    const videoId = r?.videoDetails?.videoId;
    if (!videoId) return;

    const ranges = [];
    collectDeclaredAdRanges(r, ranges, new WeakSet());
    adSkipState.videoId = videoId;
    adSkipState.ranges = ranges;
    if (ranges.length) {
      console.info(
        `[NoTubeTV] captured ${ranges.length} declared ad range(s) for ${videoId}`
      );
    }
  }

  const processedPayloads = typeof WeakSet !== "undefined" ? new WeakSet() : null;

  function processApiResponse(r) {
    if (!r || typeof r !== "object") return r;
    if (processedPayloads) {
      if (processedPayloads.has(r)) return r;
      processedPayloads.add(r);
    }

    try {
      if (configRead("enableAdBlock")) {
        captureAdRangesFromPlayerResponse(r);
        stripAdsFromResponse(r);
      }

      if (!configRead("enableShorts")) {
        stripShortsFromResponse(r);
      }

      // Codec / quality policy (ON: keep AVC1, OFF: AV01 or VP9 capped at 720p)
      filterStreamingDataCodec(r?.streamingData);
    } catch (err) {
      console.error("[NoTubeTV] response filtering failed:", err);
    }

    return r;
  }

  const origParse = JSON.parse;
  JSON.parse = function () {
    return processApiResponse(origParse.apply(this, arguments));
  };

  const origStringify = JSON.stringify;
  JSON.stringify = function (value, replacer, space) {
    try {
      const playbackCtx = value?.playbackContext?.contentPlaybackContext;
      if (
        playbackCtx &&
        !playbackCtx.isInlinePlaybackNoAd &&
        configRead("enableAdBlock")
      ) {
        const clone = origParse(origStringify.call(this, value));
        clone.playbackContext.contentPlaybackContext.isInlinePlaybackNoAd = true;
        return origStringify.call(this, clone, replacer, space);
      }
    } catch (err) {
      // Leave the request untouched.
    }
    return origStringify.call(this, value, replacer, space);
  };

  if (
    typeof Response !== "undefined" &&
    Response.prototype &&
    typeof Response.prototype.json === "function"
  ) {
    const origResponseJson = Response.prototype.json;
    Response.prototype.json = function () {
      return origResponseJson.apply(this, arguments).then(processApiResponse);
    };
  }

  if (typeof XMLHttpRequest !== "undefined") {
    const xhrResponse = Object.getOwnPropertyDescriptor(
      XMLHttpRequest.prototype,
      "response"
    );
    if (xhrResponse && xhrResponse.get) {
      Object.defineProperty(XMLHttpRequest.prototype, "response", {
        configurable: true,
        enumerable: xhrResponse.enumerable,
        get: function () {
          const value = xhrResponse.get.call(this);
          if (this.responseType === "json") processApiResponse(value);
          return value;
        },
      });
    }
  }

  function patchBundledJsonReferences() {
    if (!window._yttv) return;
    for (const key in window._yttv) {
      const mod = window._yttv[key];
      if (
        mod &&
        mod.JSON &&
        typeof mod.JSON.parse === "function" &&
        mod.JSON.parse !== JSON.parse
      ) {
        mod.JSON.parse = JSON.parse;
        mod.JSON.stringify = JSON.stringify;
        console.info("[NoTubeTV] patched bundled JSON reference:", key);
      }
    }
  }

  const AD_SKIP_TICK_MS = 500;
  const AD_SKIP_BUTTON_SELECTORS = [
    '[class*="skip-ad" i]',
    '[class*="SkipAd"]',
    '[idomkey*="skip-ad" i]',
    '[idomkey*="skipAd"]',
    '[aria-label*="skip ad" i]',
  ].join(", ");

  const AD_CONTEXT_SKIP_BUTTON_SELECTORS = [
    AD_SKIP_BUTTON_SELECTORS,
    "ytlr-skip-button",
    '[class*="ytlr-skip-button"]',
    '[class*="skip-button" i]',
  ].join(", ");

  const AD_OVERLAY_SELECTORS = [
    "ytlr-ad-attribution",
    "ytlr-ad-notify",
    '[class*="ytlr-ad-" i]',
    "[class*='ad-showing']",
    "[class*='ad-interrupting']",
  ].join(", ");

  function isAdUiVisible() {
    const overlay = document.querySelector(AD_OVERLAY_SELECTORS);
    if (!overlay) return false;
    const rect = overlay.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  }

  function clickSkipButton(adUiVisible) {
    const candidates = document.querySelectorAll(
      adUiVisible ? AD_CONTEXT_SKIP_BUTTON_SELECTORS : AD_SKIP_BUTTON_SELECTORS
    );
    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (!rect.width && !rect.height) continue;

      for (const type of ["mousedown", "mouseup", "click"]) {
        el.dispatchEvent(
          new MouseEvent(type, { bubbles: true, cancelable: true })
        );
      }
      const enterKey = {
        key: "Enter",
        keyCode: 13,
        bubbles: true,
        cancelable: true,
      };
      el.dispatchEvent(new KeyboardEvent("keydown", enterKey));
      el.dispatchEvent(new KeyboardEvent("keyup", enterKey));
      console.info(
        "[NoTubeTV] auto-clicked ad skip button:",
        el.className || el.tagName
      );
      return true;
    }
    return false;
  }

  function skipDeclaredAdRange(video) {
    if (!adSkipState.ranges.length) return false;

    const match = location.hash.match(/[?&]v=([^&]+)/);
    if (match && adSkipState.videoId && match[1] !== adSkipState.videoId) {
      return false;
    }

    const current = video.currentTime;
    for (const range of adSkipState.ranges) {
      if (current >= range.start - 0.3 && current < range.end - 0.25) {
        let target = range.end + 0.05;
        if (isFinite(video.duration) && video.duration > 1) {
          target = Math.min(target, video.duration - 0.1);
        }
        video.currentTime = target;
        console.info(
          `[NoTubeTV] skipped stitched ad segment ${range.start}s-${range.end}s`
        );
        try {
          showToast("Ad block", "Skipping ad");
        } catch (toastErr) {}
        return true;
      }
    }
    return false;
  }

  let adSkipTickCount = 0;
  let adUiWasVisible = false;
  setInterval(() => {
    try {
      adSkipTickCount++;
      if (adSkipTickCount % 4 === 0) patchBundledJsonReferences();

      if (!configRead("enableAdBlock")) return;
      const video = document.querySelector("video");
      if (!video || video.paused || !isFinite(video.currentTime)) return;

      const adUiVisible = isAdUiVisible();
      if (adUiVisible !== adUiWasVisible) {
        adUiWasVisible = adUiVisible;
        console.info(`[NoTubeTV] ad ui ${adUiVisible ? "appeared" : "gone"}`);
      }

      if (clickSkipButton(adUiVisible)) return;
      if (adUiVisible) skipDeclaredAdRange(video);
    } catch (err) {}
  }, AD_SKIP_TICK_MS);

  function getShelfTitleText(shelf) {
    return (
      shelf?.shelfRenderer?.headerRenderer?.shelfHeaderRenderer?.avatarLockup?.avatarLockupRenderer?.title?.runs?.map((run) => run.text).join("") ||
      shelf?.shelfRenderer?.headerRenderer?.shelfHeaderRenderer?.title?.runs?.map((run) => run.text).join("") ||
      shelf?.shelfRenderer?.headerRenderer?.shelfHeaderRenderer?.title?.simpleText ||
      ""
    );
  }

  function isShortsEndpoint(endpoint) {
    return Boolean(
      endpoint?.reelWatchEndpoint ||
      endpoint?.watchEndpoint?.playerParams?.includes?.("shorts") ||
      endpoint?.commandMetadata?.webCommandMetadata?.url?.includes?.("/shorts/") ||
      endpoint?.browseEndpoint?.browseId?.includes?.("FEshorts")
    );
  }

  function isShortsItem(item) {
    const gridVideo = item?.gridVideoRenderer;
    const tile = item?.tileRenderer;
    const reel = item?.reelItemRenderer;
    const shortsLockup = item?.shortsLockupViewModel;
    const navigationEndpoint =
      gridVideo?.navigationEndpoint ||
      tile?.onSelectCommand ||
      tile?.onLongPressCommand ||
      reel?.navigationEndpoint;

    return Boolean(
      reel ||
      shortsLockup ||
      item?.lockupViewModel?.contentType === "LOCKUP_CONTENT_TYPE_SHORT" ||
      tile?.tvhtml5ShelfRendererType === "TVHTML5_TILE_RENDERER_TYPE_SHORTS" ||
      isShortsEndpoint(navigationEndpoint)
    );
  }

  function isShortsShelf(shelf) {
    const items = shelf?.shelfRenderer?.content?.horizontalListRenderer?.items || [];

    if (shelf?.reelShelfRenderer) {
      return true;
    }

    if (
      shelf?.shelfRenderer?.tvhtml5ShelfRendererType ===
      "TVHTML5_SHELF_RENDERER_TYPE_SHORTS"
    ) {
      return true;
    }

    return items.length > 0 && items.every(isShortsItem);
  }

  function removeShortsFromShelf(shelf) {
    const items = shelf?.shelfRenderer?.content?.horizontalListRenderer?.items;
    if (!items) {
      return shelf;
    }

    shelf.shelfRenderer.content.horizontalListRenderer.items = items.filter(
      (item) => !isShortsItem(item)
    );

    if (!shelf.shelfRenderer.content.horizontalListRenderer.items.length) {
      return null;
    }

    return shelf;
  }

  function filterShortsFromSectionList(sectionList) {
    if (!sectionList || !Array.isArray(sectionList.contents)) return;
    sectionList.contents = sectionList.contents
      .filter((shelf) => !isShortsShelf(shelf))
      .map((shelf) => removeShortsFromShelf(shelf))
      .filter((shelf) => shelf != null);
  }

  function forEachSectionList(r, cb) {
    cb(
      r?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer
        ?.content?.sectionListRenderer
    );

    cb(r?.contents?.sectionListRenderer);

    cb(r?.continuationContents?.sectionListContinuation);

    cb(r?.contents?.singleColumnWatchNextResults?.pivot?.sectionListRenderer);

    const navSections =
      r?.contents?.tvBrowseRenderer?.content?.tvSecondaryNavRenderer?.sections;
    if (Array.isArray(navSections)) {
      for (const section of navSections) {
        const tabs = section?.tvSecondaryNavSectionRenderer?.tabs;
        if (!Array.isArray(tabs)) continue;
        for (const tab of tabs) {
          cb(
            tab?.tabRenderer?.content?.tvSurfaceContentRenderer?.content
              ?.sectionListRenderer
          );
        }
      }
    }
  }

  function stripShortsFromResponse(r) {
    forEachSectionList(r, filterShortsFromSectionList);

    const horizontalItems = r?.continuationContents?.horizontalListContinuation?.items;
    if (Array.isArray(horizontalItems)) {
      r.continuationContents.horizontalListContinuation.items =
        horizontalItems.filter((item) => !isShortsItem(item));
    }

    if (Array.isArray(r?.entries)) {
      r.entries = r.entries.filter(
        (entry) => !entry?.command?.reelWatchEndpoint
      );
    }

    if (Array.isArray(r?.items)) {
      for (const section of r.items) {
        const sectionItems = section?.guideSectionRenderer?.items;
        if (Array.isArray(sectionItems)) {
          section.guideSectionRenderer.items = sectionItems.filter(
            (item) => !isShortsGuideEntry(item)
          );
        }
      }
    }

    if (Array.isArray(r?.startupBehaviours)) {
      r.startupBehaviours = r.startupBehaviours.filter(
        (behaviour) => !behaviour?.launchToShorts
      );
    }
  }

  function isShortsGuideEntry(item) {
    const entry = item?.guideEntryRenderer;
    return Boolean(
      entry &&
      (isShortsEndpoint(entry.navigationEndpoint) ||
        /^YOUTUBE_SHORTS/.test(entry.icon?.iconType || ""))
    );
  }

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

    var hash = (sha256.h = sha256.h || []);
    var k = (sha256.k = sha256.k || []);
    var primeCounter = k[lengthProperty];

    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = candidate;
        }
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
        var w15 = w[i - 15],
          w2 = w[i - 2];

        var a = hash[0],
          e = hash[4];
        var temp1 =
          hash[7] +
          (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
          ((e & hash[5]) ^ (~e & hash[6])) +
          k[i] +
          (w[i] =
            i < 16
              ? w[i]
              : (w[i - 16] +
                  (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                  w[i - 7] +
                  (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                0);
        var temp2 =
          (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }

      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
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

  const sponsorblockAPI = "https://api.sponsor.ajay.app/";

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
      const categories = [
        "sponsor", "intro", "outro", "interaction", "selfpromo", "music_offtopic",
      ];

      const url = `${sponsorblockAPI}/skipSegments/${videoHash}?categories=${encodeURIComponent(
        JSON.stringify(categories)
      )}`;

      // The hash endpoint answers with a list: one entry per video sharing the hash prefix.
      let result = null;
      try {
        const res = await fetch(url);
        if (res.ok) {
          const list = await res.json();
          result = Array.isArray(list)
            ? list.find((entry) => entry && entry.videoID === this.videoID)
            : list;
        }
      } catch (err) {
        console.warn("[NoTubeTV] SponsorBlock fetch failed:", err);
      }

      // Optional native bridge (only used when the app provides one).
      if (!result && typeof NetworkBridge !== "undefined") {
        const resp = await new Promise((resolve) => {
          window.onNetworkBridgeResponse = (jsonString) => resolve(jsonString);
          NetworkBridge.fetch(url, this.videoID);
        });
        try {
          result = resp ? JSON.parse(resp) : null;
        } catch (err) {
          result = null;
        }
      }

      if (!this.active) return; // destroyed while the request was running
      if (!result || !result.segments || !result.segments.length) {
        return;
      }

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
      this.video.addEventListener("seeked", this.scheduleSkipHandler);
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

      if (!this.active || !this.video || !this.segments || this.video.paused) return;

      const current = this.video.currentTime;

      // Only segments that will really be skipped are scheduled. A disabled or
      // manual-skip segment must not stop the chain towards the next one.
      const nextSegments = this.segments
        .filter(
          (seg) =>
            this.skippableCategories.includes(seg.category) &&
            !this.manualSkippableCategories.includes(seg.category) &&
            seg.segment[0] >= current - 0.2
        )
        .sort((a, b) => a.segment[0] - b.segment[0]);

      if (!nextSegments.length) return;

      const [segment] = nextSegments;
      const [start, end] = segment.segment;

      if (current >= end) return;

      const delay = Math.max(0, (start - current) * 1000);

      this.nextSkipTimeout = setTimeout(() => {
        if (!this.active || !this.video || this.video.paused) return;

        // The user may have seeked, or playback may have stalled, while we waited.
        const now = this.video.currentTime;
        if (now < start - 0.5 || now >= end) {
          this.scheduleSkip();
          return;
        }

        const skipName = barTypes[segment.category]?.name || segment.category;
        showToast("SponsorBlock", `Skipping ${skipName}`);
        this.video.currentTime = end;
        this.scheduleSkip();
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
        this.video.removeEventListener("seeked", this.scheduleSkipHandler);
        this.video.removeEventListener("durationchange", this.durationChangeHandler);
      }
    }
  }

  window.sponsorblock = null;

  window.addEventListener(
    "hashchange",
    () => {
      if (!configRead("enableSponsorBlock")) {
        if (window.sponsorblock) {
          window.sponsorblock.destroy();
          window.sponsorblock = null;
        }
        return;
      }
      const match = location.hash.match(/[?&]v=([^&]+)/);
      const videoID = match ? match[1] : null;
      if (!videoID) return;
      const needsReload =
        !window.sponsorblock || window.sponsorblock.videoID != videoID;

      if (needsReload) {
        if (window.sponsorblock) {
          window.sponsorblock.destroy();
          window.sponsorblock = null;
        }
        window.sponsorblock = new SponsorBlockHandler(videoID);
        window.sponsorblock.init();
      }
    },
    false
  );

  const interval$1 = setInterval(() => {
    patchBundledJsonReferences();
    const videoElement = document.querySelector("video");
    if (videoElement) {
      execute_once_dom_loaded();
      patchResolveCommand();
      clearInterval(interval$1);
    }
  }, 250);

  function execute_once_dom_loaded() {
    var css_248z =
      ".ytaf-ui-container {\n  position: absolute;\n  top: 10%;\n  left: 10%;\n  right: 10%;\n  bottom: 10%;\n\n  background: rgba(0, 0, 0, 0.8);\n  color: white;\n  border-radius: 20px;\n  padding: 20px;\n  font-size: 1.5rem;\n  z-index: 1000;\n}\n\n.ytaf-ui-container :focus {\n  outline: 4px red solid;\n}\n\n.ytaf-ui-container h1 {\n  margin: 0;\n  margin-bottom: 0.5em;\n  text-align: center;\n}\n\n.ytaf-ui-container input[type='checkbox'] {\n  width: 1.4rem;\n  height: 1.4rem;\n}\n\n.ytaf-ui-container input[type='radio'] {\n  width: 1.4rem;\n  height: 1.4rem;\n}\n\n.ytaf-ui-container label {\n  display: block;\n  font-size: 1.4rem;\n}\n\n.ytaf-notification-container {\n  position: absolute;\n  right: 10px;\n  bottom: 10px;\n  font-size: 16pt;\n  z-index: 1200;\n}\n\n.ytaf-notification-container .message {\n  background: rgba(0, 0, 0, 0.7);\n  color: white;\n  padding: 1em;\n  margin: 0.5em;\n  transition: all 0.3s ease-in-out;\n  opacity: 1;\n  line-height: 1;\n  border-right: 10px solid rgba(50, 255, 50, 0.3);\n  display: inline-block;\n  float: right;\n}\n\n.ytaf-notification-container .message-hidden {\n  opacity: 0;\n  margin: 0 0.5em;\n  padding: 0 1em;\n  line-height: 0;\n}\n\n/* Fixes transparency effect for the video player */\n\n.ytLrWatchDefaultShadow {\n  background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0.8) 90%) !important;\n  background-color: rgba(0, 0, 0, 0.3) !important;\n  display: block !important;\n  height: 100% !important;\n  pointer-events: none !important;\n  position: absolute !important;\n  width: 100% !important;\n}";

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

    uiContainer.addEventListener(
      "keydown",
      (evt) => {
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
      },
      true
    );

    applyShortsHidingCSS();
    installShortsHidingObserver();
  }

  function applyShortsHidingCSS() {
    const shortsStyleId = 'notubetv-hide-shorts';
    let existingStyle = document.getElementById(shortsStyleId);

    if (!configRead("enableShorts")) {
      if (!existingStyle) {
        const style = document.createElement("style");
        style.id = shortsStyleId;
        style.textContent = `
          [tvhtml5-shelf-renderer-type='TVHTML5_SHELF_RENDERER_TYPE_SHORTS'] {
            display: none !important;
          }
          .ytLrTileHeaderRendererShorts {
            display: none !important;
          }
          ytlr-guide-item-renderer[title='Shorts'],
          ytlr-guide-item-renderer[href*='shorts'],
          a[href*='/shorts/'],
          a[href*='reel_watch_sequence'],
          a[href*='reelWatchSequence'],
          [href*='/shorts/'],
          [href*='reel_watch_sequence'],
          [href*='reelWatchSequence'],
          [aria-label='Shorts'],
          [title='Shorts'] {
            display: none !important;
          }
        `;
        document.head.appendChild(style);
      }

      removeShortsElements();
    } else {
      if (existingStyle) existingStyle.remove();
    }
  }

  function removeShortsElements() {
    const selectors = [
      "[tvhtml5-shelf-renderer-type='TVHTML5_SHELF_RENDERER_TYPE_SHORTS']",
      ".ytLrTileHeaderRendererShorts",
      "ytlr-guide-item-renderer[title='Shorts']",
      "ytlr-guide-item-renderer[href*='shorts']",
      "a[href*='/shorts/']",
      "a[href*='reel_watch_sequence']",
      "a[href*='reelWatchSequence']",
      "[href*='/shorts/']",
      "[href*='reel_watch_sequence']",
      "[href*='reelWatchSequence']",
      "[aria-label='Shorts']",
      "[title='Shorts']"
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        const shelf = element.closest("[tvhtml5-shelf-renderer-type='TVHTML5_SHELF_RENDERER_TYPE_SHORTS']");
        if (shelf) {
          shelf.remove();
          return;
        }

        const reelContainer = element.closest("ytlr-shelf-renderer, ytlr-grid-renderer, ytlr-guide-item-renderer, a");
        if (reelContainer) {
          reelContainer.remove();
        } else {
          element.remove();
        }
      });
    });
  }

  function installShortsHidingObserver() {
    if (window.__notubetvShortsObserverInstalled) return;
    window.__notubetvShortsObserverInstalled = true;

    const observer = new MutationObserver(() => {
      if (!configRead("enableShorts")) {
        applyShortsHidingCSS();
      }
    });

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "title", "aria-label", "tvhtml5-shelf-renderer-type"]
    });
  }

  window.addEventListener('storage', function (e) {
    if (e.key === 'ytaf-configuration') {
      applyShortsHidingCSS();
    }
  });
})();