(function () {
  'use strict';

  const CONFIG_KEY = 'ytaf-configuration';
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
    enableShorts: true
  };

  let localConfig;
  try {
    localConfig = JSON.parse(window.localStorage[CONFIG_KEY]);
  } catch (err) {
    localConfig = defaultConfig;
  }

  function configRead(key) {
    if (localConfig[key] === undefined) {
      localConfig[key] = defaultConfig[key];
    }
    return localConfig[key];
  }

  function configWrite(key, value) {
    localConfig[key] = value;
    window.localStorage[CONFIG_KEY] = JSON.stringify(localConfig);
  }

  function showModal(title, content, selectIndex, id, update) {
    if (!update) {
      const closeCmd = {
        signalAction: {
          signal: 'POPUP_BACK'
        }
      };
      resolveCommand(closeCmd);
    }

    const modalCmd = {
      openPopupAction: {
        popupType: 'MODAL',
        popup: {
          overlaySectionRenderer: {
            overlay: {
              overlayTwoPanelRenderer: {
                actionPanel: {
                  overlayPanelRenderer: {
                    header: {
                      overlayPanelHeaderRenderer: {
                        title: {
                          simpleText: title
                        }
                      }
                    },
                    content: {
                      overlayPanelItemListRenderer: {
                        items: content,
                        selectedIndex: selectIndex
                      }
                    }
                  }
                },
                backButton: {
                  buttonRenderer: {
                    accessibilityData: {
                      accessibilityData: {
                        label: 'Back'
                      }
                    },
                    command: {
                      signalAction: {
                        signal: 'POPUP_BACK'
                      }
                    }
                  }
                }
              }
            },
            dismissalCommand: {
              signalAction: {
                signal: 'POPUP_BACK'
              }
            }
          }
        },
        uniqueId: id
      }
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
            commands
          }
        }
      }
    };

    if (title) {
      button.compactLinkRenderer.title = {
        simpleText: title.title
      };
    }

    if (title.subtitle) {
      button.compactLinkRenderer.subtitle = {
        simpleText: title.subtitle
      };
    }

    if (icon) {
      button.compactLinkRenderer.icon = {
        iconType: icon.icon
      };
    }

    if (icon && icon.secondaryIcon) {
      button.compactLinkRenderer.secondaryIcon = {
        iconType: icon.secondaryIcon
      };
    }

    return button;
  }

  window.modernUI = function modernUI(update, parameters) {
    document.querySelectorAll('[id^=tt-settings]').forEach(el => el.remove());
    const settings = [
      { name: 'Ad block', icon: 'DOLLAR_SIGN', value: 'enableAdBlock' },
      { name: 'SponsorBlock', icon: 'MONEY_HAND', value: 'enableSponsorBlock' },
      { name: 'Skip Sponsor Segments', icon: 'MONEY_HEART', value: 'enableSponsorBlockSponsor' },
      { name: 'Skip Intro Segments', icon: 'PLAY_CIRCLE', value: 'enableSponsorBlockIntro' },
      { name: 'Skip Outro Segments', value: 'enableSponsorBlockOutro' },
      { name: 'Skip Interaction Reminder Segments', value: 'enableSponsorBlockInteraction' },
      { name: 'Skip Self-Promotion Segments', value: 'enableSponsorBlockSelfPromo' },
      { name: 'Skip Off-Topic Music Segments', value: 'enableSponsorBlockMusicOfftopic' },
      { name: 'Shorts', icon: 'YOUTUBE_SHORTS_FILL_24', value: 'enableShorts' }
    ];

    const buttons = [];
    let index = 0;
    for (const setting of settings) {
      const currentVal = setting.value ? configRead(setting.value) : null;
      buttons.push(
        buttonItem(
          { title: setting.name, subtitle: setting.subtitle },
          { 
            icon: setting.icon ? setting.icon : 'CHEVRON_DOWN', 
            secondaryIcon: currentVal === null ? 'CHEVRON_RIGHT' : currentVal ? 'CHECK_BOX' : 'CHECK_BOX_OUTLINE_BLANK' 
          },
          [
            {
              setClientSettingEndpoint: {
                settingDatas: [
                  {
                    clientSettingEnum: { item: setting.value },
                    boolValue: !configRead(setting.value)
                  }
                ]
              }
            },
            {
              customAction: {
                action: 'SETTINGS_UPDATE',
                parameters: [index]
              }
            }
          ]
        )
      );
      index++;
    }

    showModal('NotubeTv Settings', buttons, parameters && parameters.length > 0 ? parameters[0] : 0, 'tt-settings', update);
  };

  function resolveCommand(cmd, _) {
    for (const key in window._yttv) {
      if (window._yttv[key] && window._yttv[key].instance && window._yttv[key].instance.resolveCommand) {
        return window._yttv[key].instance.resolveCommand(cmd, _);
      }
    }
  }

  function patchResolveCommand() {
    for (const key in window._yttv) {
      if (window._yttv[key] && window._yttv[key].instance && window._yttv[key].instance.resolveCommand) {
        const ogResolve = window._yttv[key].instance.resolveCommand;
        window._yttv[key].instance.resolveCommand = function (cmd, _) {
          if (cmd.setClientSettingEndpoint) {
            for (const setting of cmd.setClientSettingEndpoint.settingDatas) {
              const valName = Object.keys(setting).find(key => key.includes('Value'));
              const value = valName === 'intValue' ? Number(setting[valName]) : setting[valName];
              configWrite(setting.clientSettingEnum.item, value);
            }
          } else if (cmd.customAction) {
            customAction(cmd.customAction.action, cmd.customAction.parameters);
            return true;
          }
          return ogResolve.call(this, cmd, _);
        };
      }
    }
  }

  function customAction(action, parameters) {
    if (action === 'SETTINGS_UPDATE') {
      modernUI(true, parameters);
    }
  }

  const origParse = JSON.parse;
  JSON.parse = function () {
    const r = origParse.apply(this, arguments);
    if (r.adPlacements && configRead('enableAdBlock')) {
      r.adPlacements = [];
    }
    if (r.playerAds && configRead('enableAdBlock')) {
      r.playerAds = false;
    }
    if (r.adSlots && configRead('enableAdBlock')) {
      r.adSlots = [];
    }
    if (!configRead('enableShorts') && r?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content) {
      r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents = 
        r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents.filter(
          shelve => shelve.shelfRenderer?.tvhtml5ShelfRendererType !== 'TVHTML5_SHELF_RENDERER_TYPE_SHORTS'
        );
    }
    return r;
  };

  const interval$1 = setInterval(() => {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      patchResolveCommand();
      clearInterval(interval$1);
    }
  }, 250);
})();