(function () {
  'use strict';

  /* eslint-disable no-prototype-builtins */
  var g =
    (typeof globalThis !== 'undefined' && globalThis) ||
    (typeof self !== 'undefined' && self) ||
    // eslint-disable-next-line no-undef
    (typeof global !== 'undefined' && global) ||
    {};

  var support = {
    searchParams: 'URLSearchParams' in g,
    iterable: 'Symbol' in g && 'iterator' in Symbol,
    blob:
      'FileReader' in g &&
      'Blob' in g &&
      (function() {
        try {
          new Blob();
          return true
        } catch (e) {
          return false
        }
      })(),
    formData: 'FormData' in g,
    arrayBuffer: 'ArrayBuffer' in g
  };

  function isDataView(obj) {
    return obj && DataView.prototype.isPrototypeOf(obj)
  }

  if (support.arrayBuffer) {
    var viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]'
    ];

    var isArrayBufferView =
      ArrayBuffer.isView ||
      function(obj) {
        return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
      };
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name);
    }
    if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === '') {
      throw new TypeError('Invalid character in header field name: "' + name + '"')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value);
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift();
        return {done: value === undefined, value: value}
      }
    };

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      };
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {};

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value);
      }, this);
    } else if (Array.isArray(headers)) {
      headers.forEach(function(header) {
        if (header.length != 2) {
          throw new TypeError('Headers constructor: expected name/value pair to be length 2, found' + header.length)
        }
        this.append(header[0], header[1]);
      }, this);
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name]);
      }, this);
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name);
    value = normalizeValue(value);
    var oldValue = this.map[name];
    this.map[name] = oldValue ? oldValue + ', ' + value : value;
  };

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)];
  };

  Headers.prototype.get = function(name) {
    name = normalizeName(name);
    return this.has(name) ? this.map[name] : null
  };

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  };

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = normalizeValue(value);
  };

  Headers.prototype.forEach = function(callback, thisArg) {
    for (var name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this);
      }
    }
  };

  Headers.prototype.keys = function() {
    var items = [];
    this.forEach(function(value, name) {
      items.push(name);
    });
    return iteratorFor(items)
  };

  Headers.prototype.values = function() {
    var items = [];
    this.forEach(function(value) {
      items.push(value);
    });
    return iteratorFor(items)
  };

  Headers.prototype.entries = function() {
    var items = [];
    this.forEach(function(value, name) {
      items.push([name, value]);
    });
    return iteratorFor(items)
  };

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries;
  }

  function consumed(body) {
    if (body._noBody) return
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true;
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result);
      };
      reader.onerror = function() {
        reject(reader.error);
      };
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    reader.readAsArrayBuffer(blob);
    return promise
  }

  function readBlobAsText(blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    var match = /charset=([A-Za-z0-9_-]+)/.exec(blob.type);
    var encoding = match ? match[1] : 'utf-8';
    reader.readAsText(blob, encoding);
    return promise
  }

  function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf);
    var chars = new Array(view.length);

    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i]);
    }
    return chars.join('')
  }

  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0)
    } else {
      var view = new Uint8Array(buf.byteLength);
      view.set(new Uint8Array(buf));
      return view.buffer
    }
  }

  function Body() {
    this.bodyUsed = false;

    this._initBody = function(body) {
      /*
        fetch-mock wraps the Response object in an ES6 Proxy to
        provide useful test harness features such as flush. However, on
        ES5 browsers without fetch or Proxy support pollyfills must be used;
        the proxy-pollyfill is unable to proxy an attribute unless it exists
        on the object before the Proxy is created. This change ensures
        Response.bodyUsed exists on the instance, while maintaining the
        semantic of setting Request.bodyUsed in the constructor before
        _initBody is called.
      */
      // eslint-disable-next-line no-self-assign
      this.bodyUsed = this.bodyUsed;
      this._bodyInit = body;
      if (!body) {
        this._noBody = true;
        this._bodyText = '';
      } else if (typeof body === 'string') {
        this._bodyText = body;
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body;
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body;
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString();
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer);
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer]);
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body);
      } else {
        this._bodyText = body = Object.prototype.toString.call(body);
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8');
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type);
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
        }
      }
    };

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this);
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      };
    }

    this.arrayBuffer = function() {
      if (this._bodyArrayBuffer) {
        var isConsumed = consumed(this);
        if (isConsumed) {
          return isConsumed
        } else if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
          return Promise.resolve(
            this._bodyArrayBuffer.buffer.slice(
              this._bodyArrayBuffer.byteOffset,
              this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
            )
          )
        } else {
          return Promise.resolve(this._bodyArrayBuffer)
        }
      } else if (support.blob) {
        return this.blob().then(readBlobAsArrayBuffer)
      } else {
        throw new Error('could not read as ArrayBuffer')
      }
    };

    this.text = function() {
      var rejected = consumed(this);
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    };

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      };
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    };

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['CONNECT', 'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE'];

  function normalizeMethod(method) {
    var upcased = method.toUpperCase();
    return methods.indexOf(upcased) > -1 ? upcased : method
  }

  function Request(input, options) {
    if (!(this instanceof Request)) {
      throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
    }

    options = options || {};
    var body = options.body;

    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url;
      this.credentials = input.credentials;
      if (!options.headers) {
        this.headers = new Headers(input.headers);
      }
      this.method = input.method;
      this.mode = input.mode;
      this.signal = input.signal;
      if (!body && input._bodyInit != null) {
        body = input._bodyInit;
        input.bodyUsed = true;
      }
    } else {
      this.url = String(input);
    }

    this.credentials = options.credentials || this.credentials || 'same-origin';
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers);
    }
    this.method = normalizeMethod(options.method || this.method || 'GET');
    this.mode = options.mode || this.mode || null;
    this.signal = options.signal || this.signal || (function () {
      if ('AbortController' in g) {
        var ctrl = new AbortController();
        return ctrl.signal;
      }
    }());
    this.referrer = null;

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body);

    if (this.method === 'GET' || this.method === 'HEAD') {
      if (options.cache === 'no-store' || options.cache === 'no-cache') {
        // Search for a '_' parameter in the query string
        var reParamSearch = /([?&])_=[^&]*/;
        if (reParamSearch.test(this.url)) {
          // If it already exists then set the value with the current time
          this.url = this.url.replace(reParamSearch, '$1_=' + new Date().getTime());
        } else {
          // Otherwise add a new '_' parameter to the end with the current time
          var reQueryString = /\?/;
          this.url += (reQueryString.test(this.url) ? '&' : '?') + '_=' + new Date().getTime();
        }
      }
    }
  }

  Request.prototype.clone = function() {
    return new Request(this, {body: this._bodyInit})
  };

  function decode(body) {
    var form = new FormData();
    body
      .trim()
      .split('&')
      .forEach(function(bytes) {
        if (bytes) {
          var split = bytes.split('=');
          var name = split.shift().replace(/\+/g, ' ');
          var value = split.join('=').replace(/\+/g, ' ');
          form.append(decodeURIComponent(name), decodeURIComponent(value));
        }
      });
    return form
  }

  function parseHeaders(rawHeaders) {
    var headers = new Headers();
    // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
    // https://tools.ietf.org/html/rfc7230#section-3.2
    var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
    // Avoiding split via regex to work around a common IE11 bug with the core-js 3.6.0 regex polyfill
    // https://github.com/github/fetch/issues/748
    // https://github.com/zloirock/core-js/issues/751
    preProcessedHeaders
      .split('\r')
      .map(function(header) {
        return header.indexOf('\n') === 0 ? header.substr(1, header.length) : header
      })
      .forEach(function(line) {
        var parts = line.split(':');
        var key = parts.shift().trim();
        if (key) {
          var value = parts.join(':').trim();
          try {
            headers.append(key, value);
          } catch (error) {
          }
        }
      });
    return headers
  }

  Body.call(Request.prototype);

  function Response(bodyInit, options) {
    if (!(this instanceof Response)) {
      throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
    }
    if (!options) {
      options = {};
    }

    this.type = 'default';
    this.status = options.status === undefined ? 200 : options.status;
    if (this.status < 200 || this.status > 599) {
      throw new RangeError("Failed to construct 'Response': The status provided (0) is outside the range [200, 599].")
    }
    this.ok = this.status >= 200 && this.status < 300;
    this.statusText = options.statusText === undefined ? '' : '' + options.statusText;
    this.headers = new Headers(options.headers);
    this.url = options.url || '';
    this._initBody(bodyInit);
  }

  Body.call(Response.prototype);

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  };

  Response.error = function() {
    var response = new Response(null, {status: 200, statusText: ''});
    response.ok = false;
    response.status = 0;
    response.type = 'error';
    return response
  };

  var redirectStatuses = [301, 302, 303, 307, 308];

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  };

  var DOMException = g.DOMException;
  try {
    new DOMException();
  } catch (err) {
    DOMException = function(message, name) {
      this.message = message;
      this.name = name;
      var error = Error(message);
      this.stack = error.stack;
    };
    DOMException.prototype = Object.create(Error.prototype);
    DOMException.prototype.constructor = DOMException;
  }

  function fetch$1(input, init) {
    return new Promise(function(resolve, reject) {
      var request = new Request(input, init);

      if (request.signal && request.signal.aborted) {
        return reject(new DOMException('Aborted', 'AbortError'))
      }

      var xhr = new XMLHttpRequest();

      function abortXhr() {
        xhr.abort();
      }

      xhr.onload = function() {
        var options = {
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders() || '')
        };
        // This check if specifically for when a user fetches a file locally from the file system
        // Only if the status is out of a normal range
        if (request.url.indexOf('file://') === 0 && (xhr.status < 200 || xhr.status > 599)) {
          options.status = 200;
        } else {
          options.status = xhr.status;
        }
        options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
        var body = 'response' in xhr ? xhr.response : xhr.responseText;
        setTimeout(function() {
          resolve(new Response(body, options));
        }, 0);
      };

      xhr.onerror = function() {
        setTimeout(function() {
          reject(new TypeError('Network request failed'));
        }, 0);
      };

      xhr.ontimeout = function() {
        setTimeout(function() {
          reject(new TypeError('Network request timed out'));
        }, 0);
      };

      xhr.onabort = function() {
        setTimeout(function() {
          reject(new DOMException('Aborted', 'AbortError'));
        }, 0);
      };

      function fixUrl(url) {
        try {
          return url === '' && g.location.href ? g.location.href : url
        } catch (e) {
          return url
        }
      }

      xhr.open(request.method, fixUrl(request.url), true);

      if (request.credentials === 'include') {
        xhr.withCredentials = true;
      } else if (request.credentials === 'omit') {
        xhr.withCredentials = false;
      }

      if ('responseType' in xhr) {
        if (support.blob) {
          xhr.responseType = 'blob';
        } else if (
          support.arrayBuffer
        ) {
          xhr.responseType = 'arraybuffer';
        }
      }

      if (init && typeof init.headers === 'object' && !(init.headers instanceof Headers || (g.Headers && init.headers instanceof g.Headers))) {
        var names = [];
        Object.getOwnPropertyNames(init.headers).forEach(function(name) {
          names.push(normalizeName(name));
          xhr.setRequestHeader(name, normalizeValue(init.headers[name]));
        });
        request.headers.forEach(function(value, name) {
          if (names.indexOf(name) === -1) {
            xhr.setRequestHeader(name, value);
          }
        });
      } else {
        request.headers.forEach(function(value, name) {
          xhr.setRequestHeader(name, value);
        });
      }

      if (request.signal) {
        request.signal.addEventListener('abort', abortXhr);

        xhr.onreadystatechange = function() {
          // DONE (success or failure)
          if (xhr.readyState === 4) {
            request.signal.removeEventListener('abort', abortXhr);
          }
        };
      }

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
    })
  }

  fetch$1.polyfill = true;

  if (!g.fetch) {
    g.fetch = fetch$1;
    g.Headers = Headers;
    g.Request = Request;
    g.Response = Response;
  }

  //
  // https://raw.githubusercontent.com/Financial-Times/polyfill-library/c25c30e4463bef60fba1213ecb697f3e3f253d7b/polyfills/DOMRect/polyfill.js
  // License: MIT
  //

  (function (global) {
  	function number(v) {
  		return v === undefined ? 0 : Number(v);
  	}

  	function different(u, v) {
  		return u !== v && !(isNaN(u) && isNaN(v));
  	}

  	function DOMRect(xArg, yArg, wArg, hArg) {
  		var x, y, width, height, left, right, top, bottom;

  		x = number(xArg);
  		y = number(yArg);
  		width = number(wArg);
  		height = number(hArg);

  		Object.defineProperties(this, {
  			x: {
  				get: function () { return x; },
  				set: function (newX) {
  					if (different(x, newX)) {
  						x = newX;
  						left = right = undefined;
  					}
  				},
  				enumerable: true
  			},
  			y: {
  				get: function () { return y; },
  				set: function (newY) {
  					if (different(y, newY)) {
  						y = newY;
  						top = bottom = undefined;
  					}
  				},
  				enumerable: true
  			},
  			width: {
  				get: function () { return width; },
  				set: function (newWidth) {
  					if (different(width, newWidth)) {
  						width = newWidth;
  						left = right = undefined;
  					}
  				},
  				enumerable: true
  			},
  			height: {
  				get: function () { return height; },
  				set: function (newHeight) {
  					if (different(height, newHeight)) {
  						height = newHeight;
  						top = bottom = undefined;
  					}
  				},
  				enumerable: true
  			},
  			left: {
  				get: function () {
  					if (left === undefined) {
  						left = x + Math.min(0, width);
  					}
  					return left;
  				},
  				enumerable: true
  			},
  			right: {
  				get: function () {
  					if (right === undefined) {
  						right = x + Math.max(0, width);
  					}
  					return right;
  				},
  				enumerable: true
  			},
  			top: {
  				get: function () {
  					if (top === undefined) {
  						top = y + Math.min(0, height);
  					}
  					return top;
  				},
  				enumerable: true
  			},
  			bottom: {
  				get: function () {
  					if (bottom === undefined) {
  						bottom = y + Math.max(0, height);
  					}
  					return bottom;
  				},
  				enumerable: true
  			}
  		});
  	}

  	global.DOMRect = DOMRect;
  }(self));

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
    enableSponsorBlockMusicOfftopic: true,
    videoSpeed: 1,
    enableDeArrow: true,
    enableDeArrowThumbnails: false,
    focusContainerColor: '#0f0f0f',
    routeColor: '#0f0f0f',
    enableFixedUI: true,
    enableHqThumbnails: true,
    enableChapters: true,
    enableLongPress: true,
    enableShorts: true
  };

  let localConfig;

  try {
    localConfig = JSON.parse(window.localStorage[CONFIG_KEY]);
  } catch (err) {
    //console.warn('Config read failed:', err);
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

  function parseTimestamps(input) {
      var lines = input.trim().split('\n');
      var result = [];
      var timestampRegex = /^\d+:\d{2}/;

      for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          var match = line.match(timestampRegex);
          if (match) {
              var timePart = match[0];
              var parts = line.split(' ');
              parts.shift();
              var timeParts = timePart.split(':');
              var minutes = parseInt(timeParts[0], 10);
              var seconds = parseInt(timeParts[1], 10);
              var milliseconds = (minutes * 60 + seconds) * 1000;
              var name = parts.join(' ');
              result.push({ time: milliseconds, name: name });
          }
      }
      return result;
  }

  function marker(title, start, duration, videoID, i) {
      return {
          title: {
              simpleText: title
          },
          startMillis: start,
          durationMillis: duration,
          thumbnailDetails: {
              thumbnails: [
                  {
                      url: `https://i.ytimg.com/vi/${videoID}/hqdefault.jpg`,
                      width: 320,
                      height: 180
                  }
              ]
          },
          onActive: {
              innertubeCommand: {
                  clickTrackingParams: null,
                  entityUpdateCommand: {
                      entityBatchUpdate: {
                          mutations: [
                              {
                                  entityKey: `${videoID}${start}${duration}`,
                                  type: 'ENTITY_MUTATION_TYPE_REPLACE',
                                  payload: {
                                      markersEngagementPanelSyncEntity: {
                                          key: `${videoID}${start}${duration}`,
                                          panelId: 'engagement-panel-macro-markers-description-chapters',
                                          activeItemIndex: i,
                                          syncEnabled: true
                                      }
                                  }
                              }
                          ]
                      }
                  }
              }
          }
      }
  }

  function markerEntity(videoID, markers) {
      return {
          entityKey: `${videoID}-key`,
          type: 'ENTITY_MUTATION_TYPE_REPLACE',
          payload: {
              macroMarkersListEntity: {
                  key: `${videoID}-key`,
                  externalVideoId: videoID,
                  markersList: {
                      markerType: 'MARKER_TYPE_CHAPTERS',
                      markers: markers,
                      headerTitle: {
                          runs: [
                              {
                                  text: 'Chapters'
                              }
                          ]
                      },
                      onTap: {
                          innertubeCommand: {
                              clickTrackingParams: null,
                              changeEngagementPanelVisibilityAction: {
                                  targetId: 'engagement-panel-macro-markers-description-chapters',
                                  visibility: 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED'
                              }
                          }
                      },
                      markersEdu: {
                          enterNudgeText: {
                              runs: [
                                  {
                                      text: 'To view chapters, press the up arrow button'
                                  }
                              ]
                          },
                          enterNudgeA11yText: 'To view chapters, press the up arrow button',
                          navNudgeText: {
                              runs: [
                                  {
                                      text: 'Navigate between chapters'
                                  }
                              ]
                          },
                          navNudgeA11yText: 'Press the left or right arrow button to navigate between chapters'
                      },
                      loggingDirectives: {
                          trackingParams: null,
                          enableDisplayloggerExperiment: true
                      }
                  }
              }
          }
      }
  }

  function Chapters(video) {
      const videoID = video.contents.singleColumnWatchNextResults.results.results.contents[0].itemSectionRenderer.contents[0].videoMetadataRenderer.videoId;
      const videoDescription = video.contents.singleColumnWatchNextResults.results.results.contents[0].itemSectionRenderer.contents[0].videoMetadataRenderer.description.runs[0].text;
      const chapters = parseTimestamps(videoDescription);
      const videoDuration = document.getElementsByTagName('video')[0].duration * 1000;
      let markers = [];

      for (let i = 0; i < chapters.length; i++) {
          const chapter = chapters[i];
          const nextChapter = chapters[i + 1];
          const duration = nextChapter ? nextChapter.time - chapter.time : videoDuration - chapter.time;
          markers.push(marker(chapter.name, String(chapter.time), String(duration), videoID, i));
      }

      const markerEntityData = markerEntity(videoID, markers);
      return markerEntityData;
  }

  function showToast(title, subtitle, thumbnails) {
      const toastCmd = {
          openPopupAction: {
              popupType: 'TOAST',
              popup: {
                  overlayToastRenderer: {
                      title: {
                          simpleText: title
                      },
                      subtitle: {
                          simpleText: subtitle
                      }
                  }
              }
          }
      };
      resolveCommand(toastCmd);
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


  function timelyAction(text, icon, command, triggerTimeMs, timeoutMs) {
      return {
          timelyActionRenderer: {
              actionButtons: [
                  {
                      buttonRenderer: {
                          isDisabled: false,
                          text: {
                              runs: [
                                  {
                                      text: text
                                  }
                              ]
                          },
                          icon: {
                              iconType: icon
                          },
                          trackingParams: null,
                          command
                      }
                  }
              ],
              triggerTimeMs,
              timeoutMs,
              type: ''
          }
      }

  }

  function longPressData(data) {
      return {
          clickTrackingParams: null,
          showMenuCommand: {
              contentId: data.videoId,
              thumbnail: {
                  thumbnails: data.thumbnails
              },
              title: {
                  simpleText: data.title
              },
              subtitle: {
                  simpleText: data.subtitle
              },
              menu: {
                  menuRenderer: {
                      items: [
                          {
                              menuNavigationItemRenderer: {
                                  text: {
                                      runs: [
                                          {
                                              text: 'Play'
                                          }
                                      ]
                                  },
                                  navigationEndpoint: {
                                      clickTrackingParams: null,
                                      watchEndpoint: data.watchEndpointData
                                  },
                                  trackingParams: null
                              }
                          },
                          {
                              menuServiceItemRenderer: {
                                  text: {
                                      runs: [
                                          {
                                              text: 'Save to Watch Later'
                                          }
                                      ]
                                  },
                                  serviceEndpoint: {
                                      clickTrackingParams: null,
                                      playlistEditEndpoint: {
                                          playlistId: 'WL',
                                          actions: [
                                              {
                                                  addedVideoId: data.videoId,
                                                  action: 'ACTION_ADD_VIDEO'
                                              }
                                          ]
                                      }
                                  },
                                  trackingParams: null
                              }
                          },
                          {
                              menuNavigationItemRenderer: {
                                  text: {
                                      runs: [
                                          {
                                              text: 'Save to playlist'
                                          }
                                      ]
                                  },
                                  navigationEndpoint: {
                                      clickTrackingParams: null,
                                      addToPlaylistEndpoint: {
                                          videoId: data.videoId
                                      }
                                  },
                                  trackingParams: null
                              }
                          }
                      ],
                      trackingParams: null,
                      accessibility: {
                          accessibilityData: {
                              label: 'Video options'
                          }
                      }
                  }
              }
          }
      }
  }

  window.modernUI = function modernUI(update, parameters) {
  document.querySelectorAll('[id^=tt-settings]').forEach(el => el.remove());
      const settings = [
          {
              name: 'Ad block',
              icon: 'DOLLAR_SIGN',
              value: 'enableAdBlock'
          },
          {
              name: 'SponsorBlock',
              icon: 'MONEY_HAND',
              value: 'enableSponsorBlock'
          },
          {
              name: 'Skip Sponsor Segments',
              icon: 'MONEY_HEART',
              value: 'enableSponsorBlockSponsor'
          },
          {
              name: 'Skip Intro Segments',
              icon: 'PLAY_CIRCLE',
              value: 'enableSponsorBlockIntro'
          },
          {
              name: 'Skip Outro Segments',
              value: 'enableSponsorBlockOutro'
          },
          {
              name: 'Skip Interaction Reminder Segments',
              value: 'enableSponsorBlockInteraction'
          },
          {
              name: 'Skip Self-Promotion Segments',
              value: 'enableSponsorBlockSelfPromo'
          },
          {
              name: 'Skip Off-Topic Music Segments',
              value: 'enableSponsorBlockMusicOfftopic'
          },
          {
              name: 'DeArrow',
              icon: 'VISIBILITY_OFF',
              value: 'enableDeArrow'
          },
          {
              name: 'DeArrow Thumbnails',
              icon: 'TV',
              value: 'enableDeArrowThumbnails'
          },
          {
              name: 'Fix UI',
              icon: 'STAR',
              value: 'enableFixedUI'
          },
          {
              name: 'High Quality Thumbnails',
              icon: 'VIDEO_QUALITY',
              value: 'enableHqThumbnails'
          },
          {
              name: 'Chapters',
              icon: 'BOOKMARK_BORDER',
              value: 'enableChapters'
          },
          {
              name: 'Long Press',
              value: 'enableLongPress'
          },
          {
              name: 'Shorts',
              icon: 'YOUTUBE_SHORTS_FILL_24',
              value: 'enableShorts'
          }
      ];

      const buttons = [];

      let index = 0;
      for (const setting of settings) {
          const currentVal = setting.value ? configRead(setting.value) : null;
          buttons.push(
              buttonItem(
                  { title: setting.name, subtitle: setting.subtitle },
                  { icon: setting.icon ? setting.icon : 'CHEVRON_DOWN', secondaryIcon: currentVal === null ? 'CHEVRON_RIGHT' : currentVal ? 'CHECK_BOX' : 'CHECK_BOX_OUTLINE_BLANK' },
                  currentVal !== null ? [
                      {
                          setClientSettingEndpoint: {
                              settingDatas: [
                                  {
                                      clientSettingEnum: {
                                          item: setting.value
                                      },
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
                  ] : [
                      {
                          customAction: {
                              action: 'OPTIONS_SHOW',
                              parameters: {
                                  options: setting.options,
                                  selectedIndex: 0,
                                  update: false
                              }
                          }
                      }
                  ]
              )
          );
          index++;
      }

      showModal('NotubeTv Settings', buttons, parameters && parameters.length > 0 ? parameters[0] : 0, 'tt-settings', update);
  }

  function optionShow(parameters, update) {
      const buttons = [];
      const manualSkipValue = configRead('sponsorBlockManualSkips');
      for (const option of parameters.options) {
          buttons.push(
              buttonItem(
                  { title: option.name },
                  { icon: option.icon ? option.icon : 'CHEVRON_DOWN', secondaryIcon: manualSkipValue.includes(option.value) ? 'CHECK_BOX' : 'CHECK_BOX_OUTLINE_BLANK' },
                  [
                      {
                          setClientSettingEndpoint: {
                              settingDatas: [
                                  {
                                      clientSettingEnum: {
                                          item: 'sponsorBlockManualSkips'
                                      },
                                      arrayValue: option.value
                                  }
                              ]
                          }
                      },
                      {
                          customAction: {
                              action: 'OPTIONS_SHOW',
                              parameters: {
                                  options: parameters.options,
                                  selectedIndex: parameters.options.indexOf(option),
                                  update: true
                              }
                          }
                      }
                  ]
              )
          );
      }

      showModal('NotubeTv Settings', buttons, parameters.selectedIndex, 'tt-settings-options', update);
  }

  function resolveCommand(cmd, _) {
      // resolveCommand function is pretty OP, it can do from opening modals, changing client settings and way more.
      // Because the client might change, we should find it first.

      for (const key in window._yttv) {
          if (window._yttv[key] && window._yttv[key].instance && window._yttv[key].instance.resolveCommand) {
              return window._yttv[key].instance.resolveCommand(cmd, _);
          }
      }
  }

  // Patch resolveCommand to be able to change NotubeTv settings

  function patchResolveCommand() {
      for (const key in window._yttv) {
          if (window._yttv[key] && window._yttv[key].instance && window._yttv[key].instance.resolveCommand) {

              const ogResolve = window._yttv[key].instance.resolveCommand;
              window._yttv[key].instance.resolveCommand = function (cmd, _) {
                  if (cmd.setClientSettingEndpoint) {
                      // Command to change client settings. Use NotubeTv configuration to change settings.
                      for (const settings of cmd.setClientSettingEndpoint.settingDatas) {
                          if (!settings.clientSettingEnum.item.includes('_')) {
                              for (const setting of cmd.setClientSettingEndpoint.settingDatas) {
                                  const valName = Object.keys(setting).find(key => key.includes('Value'));
                                  const value = valName === 'intValue' ? Number(setting[valName]) : setting[valName];
                                  if (valName === 'arrayValue') {
                                      const arr = configRead(setting.clientSettingEnum.item);
                                      if (arr.includes(value)) {
                                          arr.splice(arr.indexOf(value), 1);
                                      } else {
                                          arr.push(value);
                                      }
                                      configWrite(setting.clientSettingEnum.item, arr);
                                  } else configWrite(setting.clientSettingEnum.item, value);
                              }
                          }
                      }
                  } else if (cmd.customAction) {
                      customAction(cmd.customAction.action, cmd.customAction.parameters);
                      return true;
                  } else if (cmd?.showEngagementPanelEndpoint?.customAction) {
                      customAction(cmd.showEngagementPanelEndpoint.customAction.action, cmd.showEngagementPanelEndpoint.customAction.parameters);
                      return true;
                  }

                  return ogResolve.call(this, cmd, _);
              };
          }
      }
  }

  function customAction(action, parameters) {
      switch (action) {
          case 'SETTINGS_UPDATE':
              modernUI(true, parameters);
              break;
          case 'OPTIONS_SHOW':
              optionShow(parameters, parameters.update);
              break;
          case 'SKIP':
              const video = document.querySelector('video');
                if (video) {
                  video.currentTime = parameters.time;
                }
                resolveCommand({
                  signalAction: {
                    signal: 'POPUP_BACK'
                  }
                });
                break;
      }
  }

  /**
   * This is a minimal reimplementation of the following uBlock Origin rule:
   * https://github.com/uBlockOrigin/uAssets/blob/3497eebd440f4871830b9b45af0afc406c6eb593/filters/filters.txt#L116
   *
   * This in turn calls the following snippet:
   * https://github.com/gorhill/uBlock/blob/bfdc81e9e400f7b78b2abc97576c3d7bf3a11a0b/assets/resources/scriptlets.js#L365-L470
   *
   * Seems like for now dropping just the adPlacements is enough for YouTube TV
   */
  const origParse = JSON.parse;
  JSON.parse = function () {
    const r = origParse.apply(this, arguments);
    if (r.adPlacements && configRead('enableAdBlock')) {
      r.adPlacements = [];
    }

    // Also set playerAds to false, just incase.
    if (r.playerAds && configRead('enableAdBlock')) {
      r.playerAds = false;
    }

    // Also set adSlots to an empty array, emptying only the adPlacements won't work.
    if (r.adSlots && configRead('enableAdBlock')) {
      r.adSlots = [];
    }

    // Drop "masthead" ad from home screen
    if (
      r?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content
        ?.sectionListRenderer?.contents &&
      configRead('enableAdBlock')
    ) {
      r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents =
        r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents.filter(
          (elm) => !elm.adSlotRenderer
        );
    }

    // DeArrow Implementation. I think this is the best way to do it. (DOM manipulation would be a pain)

    if (
      r?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content
        ?.sectionListRenderer?.contents
    ) {
      processShelves(r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents);
    }

    if (r?.contents?.sectionListRenderer?.contents) {
      processShelves(r.contents.sectionListRenderer.contents);
    }

    if (r?.continuationContents?.sectionListContinuation?.contents) {
      processShelves(r.continuationContents.sectionListContinuation.contents);
    }

    if (r?.continuationContents?.horizontalListContinuation?.items) {
      deArrowify(r.continuationContents.horizontalListContinuation.items);
      hqify(r.continuationContents.horizontalListContinuation.items);
      addLongPress(r.continuationContents.horizontalListContinuation.items);
    }

    if (!configRead('enableShorts') && r?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content) {
      r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents = r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents.filter(shelve => shelve.shelfRenderer?.tvhtml5ShelfRendererType !== 'TVHTML5_SHELF_RENDERER_TYPE_SHORTS');
    }

    if (r?.contents?.singleColumnWatchNextResults?.results?.results?.contents && configRead('enableChapters')) {
      const chapterData = Chapters(r);
      r.frameworkUpdates.entityBatchUpdate.mutations.push(chapterData);
      resolveCommand({
        "clickTrackingParams": "null",
        "loadMarkersCommand": {
          "visibleOnLoadKeys": [
            chapterData.entityKey
          ],
          "entityKeys": [
            chapterData.entityKey
          ]
        }
      });
    }

    if (configRead('sponsorBlockManualSkips').length > 0 && r?.playerOverlays?.playerOverlayRenderer) {
      const manualSkippedSegments = configRead('sponsorBlockManualSkips');
      let timelyActions = [];
      if (window?.sponsorblock?.segments) {
        for (const segment of window.sponsorblock.segments) {
          if (manualSkippedSegments.includes(segment.category)) {
            const timelyActionData = timelyAction(
              `Skip ${segment.category}`,
              'SKIP_NEXT',
              {
                clickTrackingParams: null,
                showEngagementPanelEndpoint: {
                  customAction: {
                    action: 'SKIP',
                    parameters: {
                      time: segment.segment[1]
                    }
                  }
                }
              },
              segment.segment[0] * 1000,
              segment.segment[1] * 1000 - segment.segment[0] * 1000
            );
            timelyActions.push(timelyActionData);
          }
        }
        r.playerOverlays.playerOverlayRenderer.timelyActionRenderers = timelyActions;
      }
    }

    return r;
  };


  function processShelves(shelves) {
    for (const shelve of shelves) {
      if (shelve.shelfRenderer) {
        deArrowify(shelve.shelfRenderer.content.horizontalListRenderer.items);
        hqify(shelve.shelfRenderer.content.horizontalListRenderer.items);
        addLongPress(shelve.shelfRenderer.content.horizontalListRenderer.items);
      }
    }
  }

  function deArrowify(items) {
    for (const item of items) {
      if (item.adSlotRenderer) {
        const index = items.indexOf(item);
        items.splice(index, 1);
        continue;
      }
      if (configRead('enableDeArrow')) {
        const videoID = item.tileRenderer.contentId;
        fetch(`https://sponsor.ajay.app/api/branding?videoID=${videoID}`).then(res => res.json()).then(data => {
          if (data.titles.length > 0) {
            const mostVoted = data.titles.reduce((max, title) => max.votes > title.votes ? max : title);
            item.tileRenderer.metadata.tileMetadataRenderer.title.simpleText = mostVoted.title;
          }

          if (data.thumbnails.length > 0 && configRead('enableDeArrowThumbnails')) {
            const mostVotedThumbnail = data.thumbnails.reduce((max, thumbnail) => max.votes > thumbnail.votes ? max : thumbnail);
            if (mostVotedThumbnail.timestamp) {
              item.tileRenderer.header.tileHeaderRenderer.thumbnail.thumbnails = [
                {
                  url: `https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=${videoID}&time=${mostVotedThumbnail.timestamp}`,
                  width: 1280,
                  height: 640
                }
              ];
            }
          }
        });
      }
    }
  }


  function hqify(items) {
    for (const item of items) {
      if (item.tileRenderer.style !== 'TILE_STYLE_YTLR_DEFAULT') continue;
      if (configRead('enableHqThumbnails')) {
        const videoID = item.tileRenderer.contentId;
        const queryArgs = item.tileRenderer.header.tileHeaderRenderer.thumbnail.thumbnails[0].url.split('?')[1];
        item.tileRenderer.header.tileHeaderRenderer.thumbnail.thumbnails = [
          {
            url: `https://i.ytimg.com/vi/${videoID}/maxresdefault.jpg${queryArgs ? `?${queryArgs}` : ''}`,
            width: 1280,
            height: 720
          }
        ];
      }
    }
  }

  function addLongPress(items) {
    if (!configRead('enableLongPress')) return;
    for (const item of items) {
      if (item.tileRenderer.style !== 'TILE_STYLE_YTLR_DEFAULT') continue;
      if (item.tileRenderer.onLongPressCommand) continue;
      const subtitle = item.tileRenderer.metadata.tileMetadataRenderer.lines[0].lineRenderer.items[0].lineItemRenderer.text;
      const data = longPressData({
        videoId: item.tileRenderer.contentId,
        thumbnails: item.tileRenderer.header.tileHeaderRenderer.thumbnail.thumbnails,
        title: item.tileRenderer.metadata.tileMetadataRenderer.title.simpleText,
        subtitle: subtitle.runs ? subtitle.runs[0].text : subtitle.simpleText,
        watchEndpointData: item.tileRenderer.onSelectCommand.watchEndpoint
      });
      item.tileRenderer.onLongPressCommand = data;
    }
  }

  // The tiny-sha256 module, edited to export itself.
  var sha256 = function sha256(ascii) {
  	function rightRotate(value, amount) {
  		return (value >>> amount) | (value << (32 - amount));
  	}
  	var mathPow = Math.pow;
  	var maxWord = mathPow(2, 32);
  	var lengthProperty = 'length';
  	var i, j; // Used as a counter across the whole file
  	var result = '';

  	var words = [];
  	var asciiBitLength = ascii[lengthProperty] * 8;

  	//* caching results is optional - remove/add slash from front of this line to toggle
  	// Initial hash value: first 32 bits of the fractional parts of the square roots of the first 8 primes
  	// (we actually calculate the first 64, but extra values are just ignored)
  	var hash = sha256.h = sha256.h || [];
  	// Round constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes
  	var k = sha256.k = sha256.k || [];
  	var primeCounter = k[lengthProperty];
  	/*/
  	var hash = [], k = [];
  	var primeCounter = 0;
  	//*/

  	var isComposite = {};
  	for (var candidate = 2; primeCounter < 64; candidate++) {
  		if (!isComposite[candidate]) {
  			for (i = 0; i < 313; i += candidate) {
  				isComposite[i] = candidate;
  			}
  			hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
  			k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
  		}
  	}

  	ascii += '\x80'; // Append '1' bit (plus zero padding)
  	while (ascii[lengthProperty] % 64 - 56) ascii += '\x00'; // More zero padding
  	for (i = 0; i < ascii[lengthProperty]; i++) {
  		j = ascii.charCodeAt(i);
  		if (j >> 8) return; // ASCII check: only accept characters in range 0-255
  		words[i >> 2] |= j << ((3 - i) % 4) * 8;
  	}
  	words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
  	words[words[lengthProperty]] = (asciiBitLength);

  	// process each chunk
  	for (j = 0; j < words[lengthProperty];) {
  		var w = words.slice(j, j += 16); // The message is expanded into 64 words as part of the iteration
  		var oldHash = hash;
  		// This is now the "working hash", often labelled as variables a...g
  		// (we have to truncate as well, otherwise extra entries at the end accumulate
  		hash = hash.slice(0, 8);

  		for (i = 0; i < 64; i++) {
  			// Expand the message into 64 words
  			// Used below if
  			var w15 = w[i - 15], w2 = w[i - 2];

  			// Iterate
  			var a = hash[0], e = hash[4];
  			var temp1 = hash[7]
  				+ (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) // S1
  				+ ((e & hash[5]) ^ ((~e) & hash[6])) // ch
  				+ k[i]
  				// Expand the message schedule if needed
  				+ (w[i] = (i < 16) ? w[i] : (
  					w[i - 16]
  					+ (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) // s0
  					+ w[i - 7]
  					+ (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)) // s1
  				) | 0
  				);
  			// This is only used once, so *could* be moved below, but it only saves 4 bytes and makes things unreadble
  			var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) // S0
  				+ ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2])); // maj

  			hash = [(temp1 + temp2) | 0].concat(hash); // We don't bother trimming off the extra ones, they're harmless as long as we're truncating when we do the slice()
  			hash[4] = (hash[4] + temp1) | 0;
  		}

  		for (i = 0; i < 8; i++) {
  			hash[i] = (hash[i] + oldHash[i]) | 0;
  		}
  	}

  	for (i = 0; i < 8; i++) {
  		for (j = 3; j + 1; j--) {
  			var b = (hash[i] >> (j * 8)) & 255;
  			result += ((b < 16) ? 0 : '') + b.toString(16);
  		}
  	}
  	return result;
  };

  // Copied from https://github.com/ajayyy/SponsorBlock/blob/9392d16617d2d48abb6125c00e2ff6042cb7bebe/src/config.ts#L179-L233
  const barTypes = {
    sponsor: {
      color: '#00d400',
      opacity: '0.7',
      name: 'sponsored segment'
    },
    intro: {
      color: '#00ffff',
      opacity: '0.7',
      name: 'intro'
    },
    outro: {
      color: '#0202ed',
      opacity: '0.7',
      name: 'outro'
    },
    interaction: {
      color: '#cc00ff',
      opacity: '0.7',
      name: 'interaction reminder'
    },
    selfpromo: {
      color: '#ffff00',
      opacity: '0.7',
      name: 'self-promotion'
    },
    music_offtopic: {
      color: '#ff9900',
      opacity: '0.7',
      name: 'non-music part'
    }
  };

  const sponsorblockAPI = 'https://api.sponsor.ajay.app/api';

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
      const videoHash = sha256(this.videoID).substring(0, 4);
      const categories = [
        'sponsor',
        'intro',
        'outro',
        'interaction',
        'selfpromo',
        'music_offtopic'
      ];
      const resp = await fetch(
        `${sponsorblockAPI}/skipSegments/${videoHash}?categories=${encodeURIComponent(
        JSON.stringify(categories)
      )}`
      );
      const results = await resp.json();

      const result = results.find((v) => v.videoID === this.videoID);

      if (!result || !result.segments || !result.segments.length) {
        return;
      }

      this.segments = result.segments;
      this.manualSkippableCategories = configRead('sponsorBlockManualSkips');
      this.skippableCategories = this.getSkippableCategories();

      this.scheduleSkipHandler = () => this.scheduleSkip();
      this.durationChangeHandler = () => this.buildOverlay();

      this.attachVideo();
      this.buildOverlay();
    }

    getSkippableCategories() {
      const skippableCategories = [];
      if (configRead('enableSponsorBlockSponsor')) {
        skippableCategories.push('sponsor');
      }
      if (configRead('enableSponsorBlockIntro')) {
        skippableCategories.push('intro');
      }
      if (configRead('enableSponsorBlockOutro')) {
        skippableCategories.push('outro');
      }
      if (configRead('enableSponsorBlockInteraction')) {
        skippableCategories.push('interaction');
      }
      if (configRead('enableSponsorBlockSelfPromo')) {
        skippableCategories.push('selfpromo');
      }
      if (configRead('enableSponsorBlockMusicOfftopic')) {
        skippableCategories.push('music_offtopic');
      }
      return skippableCategories;
    }

    attachVideo() {
      clearTimeout(this.attachVideoTimeout);
      this.attachVideoTimeout = null;

      this.video = document.querySelector('video');
      if (!this.video) {
        this.attachVideoTimeout = setTimeout(() => this.attachVideo(), 100);
        return;
      }


      this.video.addEventListener('play', this.scheduleSkipHandler);
      this.video.addEventListener('pause', this.scheduleSkipHandler);
      this.video.addEventListener('timeupdate', this.scheduleSkipHandler);
      this.video.addEventListener('durationchange', this.durationChangeHandler);
    }

    buildOverlay() {
      if (this.segmentsoverlay) {
        return;
      }

      if (!this.video || !this.video.duration) {
        return;
      }

      const videoDuration = this.video.duration;

      this.segmentsoverlay = document.createElement('div');
      this.segments.forEach((segment) => {
        const [start, end] = segment.segment;
        const barType = barTypes[segment.category] || {
          color: 'blue',
          opacity: 0.7
        };
        const transform = `translateX(${(start / videoDuration) * 100.0
        }%) scaleX(${(end - start) / videoDuration})`;
        const elm = document.createElement('div');
        elm.classList.add('ytLrProgressBarPlayed');
        elm.style['background'] = barType.color;
        elm.style['opacity'] = barType.opacity;
        elm.style['-webkit-transform'] = transform;
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
          this.observer.observe(this.slider, {
            childList: true
          });
          this.slider.appendChild(this.segmentsoverlay);
        }
      }, 500);
    }

    scheduleSkip() {
      clearTimeout(this.nextSkipTimeout);
      this.nextSkipTimeout = null;

      if (!this.active) {
        return;
      }

      if (this.video.paused) {
        return;
      }

      // Sometimes timeupdate event (that calls scheduleSkip) gets fired right before
      // already scheduled skip routine below. Let's just look back a little bit
      // and, in worst case, perform a skip at negative interval (immediately)...
      const nextSegments = this.segments.filter(
        (seg) =>
          seg.segment[0] > this.video.currentTime - 0.3 &&
          seg.segment[1] > this.video.currentTime - 0.3
      );
      nextSegments.sort((s1, s2) => s1.segment[0] - s2.segment[0]);

      if (!nextSegments.length) {
        return;
      }

      const [segment] = nextSegments;
      const [start, end] = segment.segment;


      this.nextSkipTimeout = setTimeout(() => {
        if (this.video.paused) {
          return;
        }
        if (!this.skippableCategories.includes(segment.category)) {

          return;
        }

        const skipName = barTypes[segment.category]?.name || segment.category;
        if (!this.manualSkippableCategories.includes(segment.category)) {
          showToast('SponsorBlock', `Skipping ${skipName}`);
          this.video.currentTime = end;
          this.scheduleSkip();
        }
      }, (start - this.video.currentTime) * 1000);
    }

    destroy() {

      this.active = false;

      if (this.nextSkipTimeout) {
        clearTimeout(this.nextSkipTimeout);
        this.nextSkipTimeout = null;
      }

      if (this.attachVideoTimeout) {
        clearTimeout(this.attachVideoTimeout);
        this.attachVideoTimeout = null;
      }

      if (this.sliderInterval) {
        clearInterval(this.sliderInterval);
        this.sliderInterval = null;
      }

      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      if (this.segmentsoverlay) {
        this.segmentsoverlay.remove();
        this.segmentsoverlay = null;
      }

      if (this.video) {
        this.video.removeEventListener('play', this.scheduleSkipHandler);
        this.video.removeEventListener('pause', this.scheduleSkipHandler);
        this.video.removeEventListener('timeupdate', this.scheduleSkipHandler);
        this.video.removeEventListener(
          'durationchange',
          this.durationChangeHandler
        );
      }
    }
  }

  // When this global variable was declared using let and two consecutive hashchange
  // events were fired (due to bubbling? not sure...) the second call handled below
  // would not see the value change from first call, and that would cause multiple
  // SponsorBlockHandler initializations... This has been noticed on Chromium 38.
  // This either reveals some bug in chromium/webpack/babel scope handling, or
  // shows my lack of understanding of javascript. (or both)
  window.sponsorblock = null;

  window.addEventListener(
    'hashchange',
    () => {
      const newURL = new URL(location.hash.substring(1), location.href);
      // A hack, but it works, so...
      const videoID = newURL.search.replace('?v=', '').split('&')[0];
      const needsReload =
        videoID &&
        (!window.sponsorblock || window.sponsorblock.videoID != videoID);


      if (needsReload) {
        if (window.sponsorblock) {
          try {
            window.sponsorblock.destroy();
          } catch (err) {
          }
          window.sponsorblock = null;
        }

        if (configRead('enableSponsorBlock')) {
          window.sponsorblock = new SponsorBlockHandler(videoID);
          window.sponsorblock.init();
        }
      }
    },
    false
  );

  //
  // https://raw.githubusercontent.com/WICG/spatial-navigation/183f0146b6741007e46fa64ab0950447defdf8af/polyfill/spatial-navigation-polyfill.js
  // License: MIT
  //

  /* Spatial Navigation Polyfill
   *
   * It follows W3C official specification
   * https://drafts.csswg.org/css-nav-1/
   *
   * Copyright (c) 2018-2019 LG Electronics Inc.
   * https://github.com/WICG/spatial-navigation/polyfill
   *
   * Licensed under the MIT license (MIT)
   */

  (function () {

    // The polyfill must not be executed, if it's already enabled via browser engine or browser extensions.
    if ('navigate' in window) {
      return;
    }

    const ARROW_KEY_CODE = {37: 'left', 38: 'up', 39: 'right', 40: 'down'};
    const TAB_KEY_CODE = 9;
    let mapOfBoundRect = null;
    let startingPoint = null; // Saves spatial navigation starting point
    let savedSearchOrigin = {element: null, rect: null};  // Saves previous search origin
    let searchOriginRect = null;  // Rect of current search origin

    /**
     * Initiate the spatial navigation features of the polyfill.
     * @function initiateSpatialNavigation
     */
    function initiateSpatialNavigation() {
      /*
       * Bind the standards APIs to be exposed to the window object for authors
       */
      window.navigate = navigate;
      window.Element.prototype.spatialNavigationSearch = spatialNavigationSearch;
      window.Element.prototype.focusableAreas = focusableAreas;
      window.Element.prototype.getSpatialNavigationContainer = getSpatialNavigationContainer;

      /*
       * CSS.registerProperty() from the Properties and Values API
       * Reference: https://drafts.css-houdini.org/css-properties-values-api/#the-registerproperty-function
       */
      if (window.CSS && CSS.registerProperty) {
        if (window.getComputedStyle(document.documentElement).getPropertyValue('--spatial-navigation-contain') === '') {
          CSS.registerProperty({
            name: '--spatial-navigation-contain',
            syntax: 'auto | contain',
            inherits: false,
            initialValue: 'auto'
          });
        }

        if (window.getComputedStyle(document.documentElement).getPropertyValue('--spatial-navigation-action') === '') {
          CSS.registerProperty({
            name: '--spatial-navigation-action',
            syntax: 'auto | focus | scroll',
            inherits: false,
            initialValue: 'auto'
          });
        }

        if (window.getComputedStyle(document.documentElement).getPropertyValue('--spatial-navigation-function') === '') {
          CSS.registerProperty({
            name: '--spatial-navigation-function',
            syntax: 'normal | grid',
            inherits: false,
            initialValue: 'normal'
          });
        }
      }
    }

    /**
     * Add event handlers for the spatial navigation behavior.
     * This function defines which input methods trigger the spatial navigation behavior.
     * @function spatialNavigationHandler
     */
    function spatialNavigationHandler() {
      /*
       * keydown EventListener :
       * If arrow key pressed, get the next focusing element and send it to focusing controller
       */
      window.addEventListener('keydown', (e) => {
        const currentKeyMode = (parent && parent.__spatialNavigation__.keyMode) || window.__spatialNavigation__.keyMode;
        const eventTarget = document.activeElement;
        const dir = ARROW_KEY_CODE[e.keyCode];

        if (e.keyCode === TAB_KEY_CODE) {
          startingPoint = null;
        }

        if (!currentKeyMode ||
            (currentKeyMode === 'NONE') ||
            ((currentKeyMode === 'SHIFTARROW') && !e.shiftKey) ||
            ((currentKeyMode === 'ARROW') && e.shiftKey))
          return;

        if (!e.defaultPrevented) {
          let focusNavigableArrowKey = {left: true, up: true, right: true, down: true};

          // Edge case (text input, area) : Don't move focus, just navigate cursor in text area
          if ((eventTarget.nodeName === 'INPUT') || eventTarget.nodeName === 'TEXTAREA') {
            focusNavigableArrowKey = handlingEditableElement(e);
          }

          if (focusNavigableArrowKey[dir]) {
            e.preventDefault();
            mapOfBoundRect = new Map();

            navigate(dir);

            mapOfBoundRect = null;
            startingPoint = null;
          }
        }
      });

      /*
       * mouseup EventListener :
       * If the mouse click a point in the page, the point will be the starting point.
       * NOTE: Let UA set the spatial navigation starting point based on click
       */
      document.addEventListener('mouseup', (e) => {
        startingPoint = {x: e.clientX, y: e.clientY};
      });

      /*
       * focusin EventListener :
       * When the element get the focus, save it and its DOMRect for resetting the search origin
       * if it disappears.
       */
      window.addEventListener('focusin', (e) => {
        if (e.target !== window) {
          savedSearchOrigin.element = e.target;
          savedSearchOrigin.rect = e.target.getBoundingClientRect();
        }
      });
    }

    /**
     * Enable the author to trigger spatial navigation programmatically, as if the user had done so manually.
     * @see {@link https://drafts.csswg.org/css-nav-1/#dom-window-navigate}
     * @function navigate
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     */
    function navigate(dir) {
      // spatial navigation steps

      // 1
      const searchOrigin = findSearchOrigin();
      let eventTarget = searchOrigin;

      let elementFromPosition = null;

      // 2 Optional step, UA defined starting point
      if (startingPoint) {
        // if there is a starting point, set eventTarget as the element from position for getting the spatnav container
        elementFromPosition = document.elementFromPoint(startingPoint.x, startingPoint.y);

        // Use starting point if the starting point isn't inside the focusable element (but not container)
        // * Starting point is meaningfull when:
        // 1) starting point is inside the spatnav container
        // 2) starting point is inside the non-focusable element
        if (elementFromPosition === null) {
          elementFromPosition = document.body;
        }
        if (isFocusable(elementFromPosition) && !isContainer(elementFromPosition)) {
          startingPoint = null;
        } else if (isContainer(elementFromPosition)) {
          eventTarget = elementFromPosition;
        } else {
          eventTarget = elementFromPosition.getSpatialNavigationContainer();
        }
      }

      // 4
      if (eventTarget === document || eventTarget === document.documentElement) {
        eventTarget = document.body || document.documentElement;
      }

      // 5
      // At this point, spatialNavigationSearch can be applied.
      // If startingPoint is either a scroll container or the document,
      // find the best candidate within startingPoint
      let container = null;
      if ((isContainer(eventTarget) || eventTarget.nodeName === 'BODY') && !(eventTarget.nodeName === 'INPUT')) {
        if (eventTarget.nodeName === 'IFRAME') {
          eventTarget = eventTarget.contentDocument.documentElement;
        }
        container = eventTarget;
        let bestInsideCandidate = null;

        // 5-2
        if ((document.activeElement === searchOrigin) ||
            (document.activeElement === document.body) && (searchOrigin === document.documentElement)) {
          if (getCSSSpatNavAction(eventTarget) === 'scroll') {
            if (scrollingController(eventTarget, dir)) return;
          } else if (getCSSSpatNavAction(eventTarget) === 'focus') {
            bestInsideCandidate = eventTarget.spatialNavigationSearch(dir, {container: eventTarget, candidates: getSpatialNavigationCandidates(eventTarget, {mode: 'all'})});
            if (focusingController(bestInsideCandidate, dir)) return;
          } else if (getCSSSpatNavAction(eventTarget) === 'auto') {
            bestInsideCandidate = eventTarget.spatialNavigationSearch(dir, {container: eventTarget});
            if (focusingController(bestInsideCandidate, dir) || scrollingController(eventTarget, dir)) return;
          }
        } else {
          // when the previous search origin became offscreen
          container = container.getSpatialNavigationContainer();
        }
      }

      // 6
      // Let container be the nearest ancestor of eventTarget
      container = eventTarget.getSpatialNavigationContainer();
      let parentContainer = (container.parentElement) ? container.getSpatialNavigationContainer() : null;

      // When the container is the viewport of a browsing context
      if (!parentContainer && ( window.location !== window.parent.location)) {
        parentContainer = window.parent.document.documentElement;
      }

      if (getCSSSpatNavAction(container) === 'scroll') {
        if (scrollingController(container, dir)) return;
      } else if (getCSSSpatNavAction(container) === 'focus') {
        navigateChain(eventTarget, container, parentContainer, dir, 'all');
      } else if (getCSSSpatNavAction(container) === 'auto') {
        navigateChain(eventTarget, container, parentContainer, dir, 'visible');
      }
    }

    /**
     * Move the focus to the best candidate or do nothing.
     * @function focusingController
     * @param bestCandidate {Node} - The best candidate of the spatial navigation
     * @param dir {SpatialNavigationDirection}- The directional information for the spatial navigation (e.g. LRUD)
     * @returns {boolean}
     */
    function focusingController(bestCandidate, dir) {
      // 10 & 11
      // When bestCandidate is found
      if (bestCandidate) {
        // When bestCandidate is a focusable element and not a container : move focus
        /*
         * [event] navbeforefocus : Fired before spatial or sequential navigation changes the focus.
         */
        if (!createSpatNavEvents('beforefocus', bestCandidate, null, dir))
          return true;

        const container = bestCandidate.getSpatialNavigationContainer();

        if ((container !== window) && (getCSSSpatNavAction(container) === 'focus')) {
          bestCandidate.focus();
        } else {
          bestCandidate.focus({preventScroll: true});
        }

        startingPoint = null;
        return true;
      }

      // When bestCandidate is not found within the scrollport of a container: Nothing
      return false;
    }

    /**
     * Directionally scroll the scrollable spatial navigation container if it can be manually scrolled more.
     * @function scrollingController
     * @param container {Node} - The spatial navigation container which can scroll
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @returns {boolean}
     */
    function scrollingController(container, dir) {

      // If there is any scrollable area among parent elements and it can be manually scrolled, scroll the document
      if (isScrollable(container, dir) && !isScrollBoundary(container, dir)) {
        moveScroll(container, dir);
        return true;
      }

      // If the spatnav container is document and it can be scrolled, scroll the document
      if (!container.parentElement && !isHTMLScrollBoundary(container, dir)) {
        moveScroll(container.ownerDocument.documentElement, dir);
        return true;
      }
      return false;
    }

    /**
     * Find the candidates within a spatial navigation container include delegable container.
     * This function does not search inside delegable container or focusable container.
     * In other words, this return candidates set is not included focusable elements inside delegable container or focusable container.
     *
     * @function getSpatialNavigationCandidates
     * @param container {Node} - The spatial navigation container
     * @param option {FocusableAreasOptions} - 'mode' attribute takes 'visible' or 'all' for searching the boundary of focusable elements.
     *                                          Default value is 'visible'.
     * @returns {sequence<Node>} candidate elements within the container
     */
    function getSpatialNavigationCandidates (container, option = {mode: 'visible'}) {
      let candidates = [];

      if (container.childElementCount > 0) {
        if (!container.parentElement) {
          container = container.getElementsByTagName('body')[0] || document.body;
        }
        const children = container.children;
        for (const elem of children) {
          if (isDelegableContainer(elem)) {
            candidates.push(elem);
          } else if (isFocusable(elem)) {
            candidates.push(elem);

            if (!isContainer(elem) && elem.childElementCount) {
              candidates = candidates.concat(getSpatialNavigationCandidates(elem, {mode: 'all'}));
            }
          } else if (elem.childElementCount) {
            candidates = candidates.concat(getSpatialNavigationCandidates(elem, {mode: 'all'}));
          }
        }
      }
      return (option.mode === 'all') ? candidates : candidates.filter(isVisible);
    }

    /**
     * Find the candidates among focusable elements within a spatial navigation container from the search origin (currently focused element)
     * depending on the directional information.
     * @function getFilteredSpatialNavigationCandidates
     * @param element {Node} - The currently focused element which is defined as 'search origin' in the spec
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @param candidates {sequence<Node>} - The candidates for spatial navigation without the directional information
     * @param container {Node} - The spatial navigation container
     * @returns {Node} The candidates for spatial navigation considering the directional information
     */
    function getFilteredSpatialNavigationCandidates (element, dir, candidates, container) {
      const targetElement = element;
      // Removed below line due to a bug. (iframe body rect is sometime weird.)
      // const targetElement = (element.nodeName === 'IFRAME') ? element.contentDocument.body : element;
      // If the container is unknown, get the closest container from the element
      container = container || targetElement.getSpatialNavigationContainer();

      // If the candidates is unknown, find candidates
      // 5-1
      candidates = (!candidates || candidates.length <= 0) ? getSpatialNavigationCandidates(container) : candidates;
      return filteredCandidates(targetElement, candidates, dir, container);
    }

    /**
     * Find the best candidate among the candidates within the container from the search origin (currently focused element)
     * @see {@link https://drafts.csswg.org/css-nav-1/#dom-element-spatialnavigationsearch}
     * @function spatialNavigationSearch
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @param candidates {sequence<Node>} - The candidates for spatial navigation
     * @param container {Node} - The spatial navigation container
     * @returns {Node} The best candidate which will gain the focus
     */
    function spatialNavigationSearch (dir, args) {
      const targetElement = this;
      let internalCandidates = [];
      let externalCandidates = [];
      let insideOverlappedCandidates = getOverlappedCandidates(targetElement);
      let bestTarget;

      // Set default parameter value
      if (!args)
        args = {};

      const defaultContainer = targetElement.getSpatialNavigationContainer();
      let defaultCandidates = getSpatialNavigationCandidates(defaultContainer);
      const container = args.container || defaultContainer;
      if (args.container && (defaultContainer.contains(args.container))) {
        defaultCandidates = defaultCandidates.concat(getSpatialNavigationCandidates(container));
      }
      const candidates = (args.candidates && args.candidates.length > 0) ?
                            args.candidates.filter((candidate) => container.contains(candidate)) :
                            defaultCandidates.filter((candidate) => container.contains(candidate) && (container !== candidate));

      // Find the best candidate
      // 5
      // If startingPoint is either a scroll container or the document,
      // find the best candidate within startingPoint
      if (candidates && candidates.length > 0) {

        // Divide internal or external candidates
        candidates.forEach(candidate => {
          if (candidate !== targetElement) {
            (targetElement.contains(candidate) && targetElement !== candidate ? internalCandidates : externalCandidates).push(candidate);
          }
        });

        // include overlapped element to the internalCandidates
        let fullyOverlapped = insideOverlappedCandidates.filter(candidate => !internalCandidates.includes(candidate));
        let overlappedContainer = candidates.filter(candidate => (isContainer(candidate) && isEntirelyVisible(targetElement, candidate)));
        let overlappedByParent = overlappedContainer.map((elm) => elm.focusableAreas()).flat().filter(candidate => candidate !== targetElement);

        internalCandidates = internalCandidates.concat(fullyOverlapped).filter((candidate) => container.contains(candidate));
        externalCandidates = externalCandidates.concat(overlappedByParent).filter((candidate) => container.contains(candidate));

        // Filter external Candidates
        if (externalCandidates.length > 0) {
          externalCandidates = getFilteredSpatialNavigationCandidates(targetElement, dir, externalCandidates, container);
        }

        // If there isn't search origin element but search orgin rect exist  (search origin isn't in the layout case)
        if (searchOriginRect) {
          bestTarget = selectBestCandidate(targetElement, getFilteredSpatialNavigationCandidates(targetElement, dir, internalCandidates, container), dir);
        }

        if ((internalCandidates && internalCandidates.length > 0) && !(targetElement.nodeName === 'INPUT')) {
          bestTarget = selectBestCandidateFromEdge(targetElement, internalCandidates, dir);
        }

        bestTarget = bestTarget || selectBestCandidate(targetElement, externalCandidates, dir);

        if (bestTarget && isDelegableContainer(bestTarget)) {
          // if best target is delegable container, then find descendants candidate inside delegable container.
          const innerTarget = getSpatialNavigationCandidates(bestTarget, {mode: 'all'});
          const descendantsBest = innerTarget.length > 0 ? targetElement.spatialNavigationSearch(dir, {candidates: innerTarget, container: bestTarget}) : null;
          if (descendantsBest) {
            bestTarget = descendantsBest;
          } else if (!isFocusable(bestTarget)) {
            // if there is no target inside bestTarget and delegable container is not focusable,
            // then try to find another best target without curren best target.
            candidates.splice(candidates.indexOf(bestTarget), 1);
            bestTarget = candidates.length ? targetElement.spatialNavigationSearch(dir, {candidates: candidates, container: container}) : null;
          }
        }
        return bestTarget;
      }

      return null;
    }

    /**
     * Get the filtered candidate among candidates.
     * @see {@link https://drafts.csswg.org/css-nav-1/#select-the-best-candidate}
     * @function filteredCandidates
     * @param currentElm {Node} - The currently focused element which is defined as 'search origin' in the spec
     * @param candidates {sequence<Node>} - The candidates for spatial navigation
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @param container {Node} - The spatial navigation container
     * @returns {sequence<Node>} The filtered candidates which are not the search origin and not in the given spatial navigation direction from the search origin
     */
    // TODO: Need to fix filtering the candidates with more clean code
    function filteredCandidates(currentElm, candidates, dir, container) {
      const originalContainer = currentElm.getSpatialNavigationContainer();
      let eventTargetRect;

      // If D(dir) is null, let candidates be the same as visibles
      if (dir === undefined)
        return candidates;

      // Offscreen handling when originalContainer is not <HTML>
      if (originalContainer.parentElement && container !== originalContainer && !isVisible(currentElm)) {
        eventTargetRect = getBoundingClientRect(originalContainer);
      } else {
        eventTargetRect = searchOriginRect || getBoundingClientRect(currentElm);
      }

      /*
       * Else, let candidates be the subset of the elements in visibles
       * whose principal box’s geometric center is within the closed half plane
       * whose boundary goes through the geometric center of starting point and is perpendicular to D.
       */
      if ((isContainer(currentElm) || currentElm.nodeName === 'BODY') && !(currentElm.nodeName === 'INPUT')) {
        return candidates.filter(candidate => {
          const candidateRect = getBoundingClientRect(candidate);
          return container.contains(candidate) &&
            ((currentElm.contains(candidate) && isInside(eventTargetRect, candidateRect) && candidate !== currentElm) ||
            isOutside(candidateRect, eventTargetRect, dir));
        });
      } else {
        return candidates.filter(candidate => {
          const candidateRect = getBoundingClientRect(candidate);
          const candidateBody = (candidate.nodeName === 'IFRAME') ? candidate.contentDocument.body : null;
          return container.contains(candidate) &&
            candidate !== currentElm && candidateBody !== currentElm &&
            isOutside(candidateRect, eventTargetRect, dir) &&
            !isInside(eventTargetRect, candidateRect);
        });
      }
    }

    /**
     * Select the best candidate among given candidates.
     * @see {@link https://drafts.csswg.org/css-nav-1/#select-the-best-candidate}
     * @function selectBestCandidate
     * @param currentElm {Node} - The currently focused element which is defined as 'search origin' in the spec
     * @param candidates {sequence<Node>} - The candidates for spatial navigation
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @returns {Node} The best candidate which will gain the focus
     */
    function selectBestCandidate(currentElm, candidates, dir) {
      const container = currentElm.getSpatialNavigationContainer();
      const spatialNavigationFunction = getComputedStyle(container).getPropertyValue('--spatial-navigation-function');
      const currentTargetRect = searchOriginRect || getBoundingClientRect(currentElm);
      let distanceFunction;
      let alignedCandidates;

      switch (spatialNavigationFunction) {
      case 'grid':
        alignedCandidates = candidates.filter(elm => isAligned(currentTargetRect, getBoundingClientRect(elm), dir));
        if (alignedCandidates.length > 0) {
          candidates = alignedCandidates;
        }
        distanceFunction = getAbsoluteDistance;
        break;
      default:
        distanceFunction = getDistance;
        break;
      }
      return getClosestElement(currentElm, candidates, dir, distanceFunction);
    }

    /**
     * Select the best candidate among candidates by finding the closet candidate from the edge of the currently focused element (search origin).
     * @see {@link https://drafts.csswg.org/css-nav-1/#select-the-best-candidate (Step 5)}
     * @function selectBestCandidateFromEdge
     * @param currentElm {Node} - The currently focused element which is defined as 'search origin' in the spec
     * @param candidates {sequence<Node>} - The candidates for spatial navigation
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @returns {Node} The best candidate which will gain the focus
     */
    function selectBestCandidateFromEdge(currentElm, candidates, dir) {
      if (startingPoint)
        return getClosestElement(currentElm, candidates, dir, getDistanceFromPoint);
      else
        return getClosestElement(currentElm, candidates, dir, getInnerDistance);
    }

    /**
     * Select the closest candidate from the currently focused element (search origin) among candidates by using the distance function.
     * @function getClosestElement
     * @param currentElm {Node} - The currently focused element which is defined as 'search origin' in the spec
     * @param candidates {sequence<Node>} - The candidates for spatial navigation
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @param distanceFunction {function} - The distance function which measures the distance from the search origin to each candidate
     * @returns {Node} The candidate which is the closest one from the search origin
     */
    function getClosestElement(currentElm, candidates, dir, distanceFunction) {
      let eventTargetRect = null;
      if (( window.location !== window.parent.location ) && (currentElm.nodeName === 'BODY' || currentElm.nodeName === 'HTML')) {
        // If the eventTarget is iframe, then get rect of it based on its containing document
        // Set the iframe's position as (0,0) because the rects of elements inside the iframe don't know the real iframe's position.
        eventTargetRect = window.frameElement.getBoundingClientRect();
        eventTargetRect.x = 0;
        eventTargetRect.y = 0;
      } else {
        eventTargetRect = searchOriginRect || currentElm.getBoundingClientRect();
      }

      let minDistance = Number.POSITIVE_INFINITY;
      let minDistanceElements = [];

      if (candidates) {
        for (let i = 0; i < candidates.length; i++) {
          const distance = distanceFunction(eventTargetRect, getBoundingClientRect(candidates[i]), dir);

          // If the same distance, the candidate will be selected in the DOM order
          if (distance < minDistance) {
            minDistance = distance;
            minDistanceElements = [candidates[i]];
          } else if (distance === minDistance) {
            minDistanceElements.push(candidates[i]);
          }
        }
      }
      if (minDistanceElements.length === 0)
        return null;

      return (minDistanceElements.length > 1 && distanceFunction === getAbsoluteDistance) ?
        getClosestElement(currentElm, minDistanceElements, dir, getEuclideanDistance) : minDistanceElements[0];
    }

    /**
     * Get container of an element.
     * @see {@link https://drafts.csswg.org/css-nav-1/#dom-element-getspatialnavigationcontainer}
     * @module Element
     * @function getSpatialNavigationContainer
     * @returns {Node} The spatial navigation container
     */
    function getSpatialNavigationContainer() {
      let container = this;

      do {
        if (!container.parentElement) {
          if (window.location !== window.parent.location) {
            container = window.parent.document.documentElement;
          } else {
            container = window.document.documentElement;
          }
          break;
        } else {
          container = container.parentElement;
        }
      } while (!isContainer(container));
      return container;
    }

    /**
     * Get nearest scroll container of an element.
     * @function getScrollContainer
     * @param Element
     * @returns {Node} The spatial navigation container
     */
    function getScrollContainer(element) {
      let scrollContainer = element;

      do {
        if (!scrollContainer.parentElement) {
          if (window.location !== window.parent.location) {
            scrollContainer = window.parent.document.documentElement;
          } else {
            scrollContainer = window.document.documentElement;
          }
          break;
        } else {
          scrollContainer = scrollContainer.parentElement;
        }
      } while (!isScrollContainer(scrollContainer) || !isVisible(scrollContainer));

      if (scrollContainer === document || scrollContainer === document.documentElement) {
        scrollContainer = window;
      }

      return scrollContainer;
    }

    /**
     * Find focusable elements within the spatial navigation container.
     * @see {@link https://drafts.csswg.org/css-nav-1/#dom-element-focusableareas}
     * @function focusableAreas
     * @param option {FocusableAreasOptions} - 'mode' attribute takes 'visible' or 'all' for searching the boundary of focusable elements.
     *                                          Default value is 'visible'.
     * @returns {sequence<Node>} All focusable elements or only visible focusable elements within the container
     */
    function focusableAreas(option = {mode: 'visible'}) {
      const container = this.parentElement ? this : document.body;
      const focusables = Array.prototype.filter.call(container.getElementsByTagName('*'), isFocusable);
      return (option.mode === 'all') ? focusables : focusables.filter(isVisible);
    }

    /**
     * Create the NavigationEvent: navbeforefocus, navnotarget
     * @see {@link https://drafts.csswg.org/css-nav-1/#events-navigationevent}
     * @function createSpatNavEvents
     * @param option {string} - Type of the navigation event (beforefocus, notarget)
     * @param element {Node} - The target element of the event
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     */
    function createSpatNavEvents(eventType, containerElement, currentElement, direction) {
      if (['beforefocus', 'notarget'].includes(eventType)) {
        const data = {
          causedTarget: currentElement,
          dir: direction
        };
        const triggeredEvent = new CustomEvent('nav' + eventType, {bubbles: true, cancelable: true, detail: data});
        return containerElement.dispatchEvent(triggeredEvent);
      }
    }

    /**
     * Get the value of the CSS custom property of the element
     * @function readCssVar
     * @param element {Node}
     * @param varName {string} - The name of the css custom property without '--'
     * @returns {string} The value of the css custom property
     */
    function readCssVar(element, varName) {
      // 20210606 fix getPropertyValue returning null ~inf
      return (element.style.getPropertyValue(`--${varName}`) || '').trim();
    }

    /**
     * Decide whether or not the 'contain' value is given to 'spatial-navigation-contain' css property of an element
     * @function isCSSSpatNavContain
     * @param element {Node}
     * @returns {boolean}
     */
    function isCSSSpatNavContain(element) {
      return readCssVar(element, 'spatial-navigation-contain') === 'contain';
    }

    /**
     * Return the value of 'spatial-navigation-action' css property of an element
     * @function getCSSSpatNavAction
     * @param element {Node} - would be the spatial navigation container
     * @returns {string} auto | focus | scroll
     */
    function getCSSSpatNavAction(element) {
      return readCssVar(element, 'spatial-navigation-action') || 'auto';
    }

    /**
     * Only move the focus with spatial navigation. Manually scrolling isn't available.
     * @function navigateChain
     * @param eventTarget {Node} - currently focused element
     * @param container {SpatialNavigationContainer} - container
     * @param parentContainer {SpatialNavigationContainer} - parent container
     * @param option - visible || all
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     */
    function navigateChain(eventTarget, container, parentContainer, dir, option) {
      let currentOption = {candidates: getSpatialNavigationCandidates(container, {mode: option}), container};

      while (parentContainer) {
        if (focusingController(eventTarget.spatialNavigationSearch(dir, currentOption), dir)) {
          return;
        } else {
          if ((option === 'visible') && scrollingController(container, dir)) return;
          else {
            if (!createSpatNavEvents('notarget', container, eventTarget, dir)) return;

            // find the container
            if (container === document || container === document.documentElement) {
              if ( window.location !== window.parent.location ) {
                // The page is in an iframe. eventTarget needs to be reset because the position of the element in the iframe
                eventTarget = window.frameElement;
                container = eventTarget.ownerDocument.documentElement;
              }
            } else {
              container = parentContainer;
            }
            currentOption = {candidates: getSpatialNavigationCandidates(container, {mode: option}), container};
            let nextContainer = container.getSpatialNavigationContainer();

            if (nextContainer !== container) {
              parentContainer = nextContainer;
            } else {
              parentContainer = null;
            }
          }
        }
      }

      currentOption = {candidates: getSpatialNavigationCandidates(container, {mode: option}), container};

      // Behavior after 'navnotarget' - Getting out from the current spatnav container
      if ((!parentContainer && container) && focusingController(eventTarget.spatialNavigationSearch(dir, currentOption), dir)) return;

      if (!createSpatNavEvents('notarget', currentOption.container, eventTarget, dir)) return;

      if ((getCSSSpatNavAction(container) === 'auto') && (option === 'visible')) {
        if (scrollingController(container, dir)) return;
      }
    }

    /**
     * Find search origin
     * @see {@link https://drafts.csswg.org/css-nav-1/#nav}
     * @function findSearchOrigin
     * @returns {Node} The search origin for the spatial navigation
     */
    function findSearchOrigin() {
      let searchOrigin = document.activeElement;

      if (!searchOrigin || (searchOrigin === document.body && !document.querySelector(':focus'))) {
        // When the previous search origin lost its focus by blur: (1) disable attribute (2) visibility: hidden
        if (savedSearchOrigin.element && (searchOrigin !== savedSearchOrigin.element)) {
          const elementStyle = window.getComputedStyle(savedSearchOrigin.element, null);
          const invisibleStyle = ['hidden', 'collapse'];

          if (savedSearchOrigin.element.disabled || invisibleStyle.includes(elementStyle.getPropertyValue('visibility'))) {
            searchOrigin = savedSearchOrigin.element;
            return searchOrigin;
          }
        }
        searchOrigin = document.documentElement;
      }
      // When the previous search origin lost its focus by blur: (1) display:none () element size turned into zero
      if (savedSearchOrigin.element &&
        ((getBoundingClientRect(savedSearchOrigin.element).height === 0) || (getBoundingClientRect(savedSearchOrigin.element).width === 0))) {
        searchOriginRect = savedSearchOrigin.rect;
      }

      if (!isVisibleInScroller(searchOrigin)) {
        const scroller = getScrollContainer(searchOrigin);
        if (scroller && ((scroller === window) || (getCSSSpatNavAction(scroller) === 'auto')))
          return scroller;
      }
      return searchOrigin;
    }

    /**
     * Move the scroll of an element depending on the given spatial navigation directrion
     * (Assume that User Agent defined distance is '40px')
     * @see {@link https://drafts.csswg.org/css-nav-1/#directionally-scroll-an-element}
     * @function moveScroll
     * @param element {Node} - The scrollable element
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @param offset {Number} - The explicit amount of offset for scrolling. Default value is 0.
     */
    function moveScroll(element, dir, offset = 0) {
      if (element) {
        switch (dir) {
        case 'left': element.scrollLeft -= (40 + offset); break;
        case 'right': element.scrollLeft += (40 + offset); break;
        case 'up': element.scrollTop -= (40 + offset); break;
        case 'down': element.scrollTop += (40 + offset); break;
        }
      }
    }

    /**
     * Decide whether an element is container or not.
     * @function isContainer
     * @param element {Node} element
     * @returns {boolean}
     */
    function isContainer(element) {
      return (!element.parentElement) ||
              (element.nodeName === 'IFRAME') ||
              (isScrollContainer(element)) ||
              (isCSSSpatNavContain(element));
    }

    /**
     * Decide whether an element is delegable container or not.
     * NOTE: THIS IS NON-NORMATIVE API.
     * @function isDelegableContainer
     * @param element {Node} element
     * @returns {boolean}
     */
    function isDelegableContainer(element) {
      return readCssVar(element, 'spatial-navigation-contain') === 'delegable';
    }

    /**
     * Decide whether an element is a scrollable container or not.
     * @see {@link https://drafts.csswg.org/css-overflow-3/#scroll-container}
     * @function isScrollContainer
     * @param element {Node}
     * @returns {boolean}
     */
    function isScrollContainer(element) {
      const elementStyle = window.getComputedStyle(element, null);
      const overflowX = elementStyle.getPropertyValue('overflow-x');
      const overflowY = elementStyle.getPropertyValue('overflow-y');

      return ((overflowX !== 'visible' && overflowX !== 'clip' && isOverflow(element, 'left')) ||
            (overflowY !== 'visible' && overflowY !== 'clip' && isOverflow(element, 'down'))) ?
             true : false;
    }

    /**
     * Decide whether this element is scrollable or not.
     * NOTE: If the value of 'overflow' is given to either 'visible', 'clip', or 'hidden', the element isn't scrollable.
     *       If the value is 'hidden', the element can be only programmically scrollable. (https://drafts.csswg.org/css-overflow-3/#valdef-overflow-hidden)
     * @function isScrollable
     * @param element {Node}
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @returns {boolean}
     */
    function isScrollable(element, dir) { // element, dir
      if (element && typeof element === 'object') {
        if (dir && typeof dir === 'string') { // parameter: dir, element
          if (isOverflow(element, dir)) {
            // style property
            const elementStyle = window.getComputedStyle(element, null);
            const overflowX = elementStyle.getPropertyValue('overflow-x');
            const overflowY = elementStyle.getPropertyValue('overflow-y');

            switch (dir) {
            case 'left':
              /* falls through */
            case 'right':
              return (overflowX !== 'visible' && overflowX !== 'clip' && overflowX !== 'hidden');
            case 'up':
              /* falls through */
            case 'down':
              return (overflowY !== 'visible' && overflowY !== 'clip' && overflowY !== 'hidden');
            }
          }
          return false;
        } else { // parameter: element
          return (element.nodeName === 'HTML' || element.nodeName === 'BODY') ||
                  (isScrollContainer(element) && isOverflow(element));
        }
      }
    }

    /**
     * Decide whether an element is overflow or not.
     * @function isOverflow
     * @param element {Node}
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @returns {boolean}
     */
    function isOverflow(element, dir) {
      if (element && typeof element === 'object') {
        if (dir && typeof dir === 'string') { // parameter: element, dir
          switch (dir) {
          case 'left':
            /* falls through */
          case 'right':
            return (element.scrollWidth > element.clientWidth);
          case 'up':
            /* falls through */
          case 'down':
            return (element.scrollHeight > element.clientHeight);
          }
        } else { // parameter: element
          return (element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight);
        }
        return false;
      }
    }

    /**
     * Decide whether the scrollbar of the browsing context reaches to the end or not.
     * @function isHTMLScrollBoundary
     * @param element {Node} - The top browsing context
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @returns {boolean}
     */
    function isHTMLScrollBoundary(element, dir) {
      let result = false;
      switch (dir) {
      case 'left':
        result = element.scrollLeft === 0;
        break;
      case 'right':
        result = (element.scrollWidth - element.scrollLeft - element.clientWidth) === 0;
        break;
      case 'up':
        result = element.scrollTop === 0;
        break;
      case 'down':
        result = (element.scrollHeight - element.scrollTop - element.clientHeight) === 0;
        break;
      }
      return result;
    }

    /**
     * Decide whether the scrollbar of an element reaches to the end or not.
     * @function isScrollBoundary
     * @param element {Node}
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @returns {boolean}
     */
    function isScrollBoundary(element, dir) {
      if (isScrollable(element, dir)) {
        const winScrollY = element.scrollTop;
        const winScrollX = element.scrollLeft;

        const height = element.scrollHeight - element.clientHeight;
        const width = element.scrollWidth - element.clientWidth;

        switch (dir) {
        case 'left': return (winScrollX === 0);
        case 'right': return (Math.abs(winScrollX - width) <= 1);
        case 'up': return (winScrollY === 0);
        case 'down': return (Math.abs(winScrollY - height) <= 1);
        }
      }
      return false;
    }

    /**
     * Decide whether an element is inside the scorller viewport or not
     *
     * @function isVisibleInScroller
     * @param element {Node}
     * @returns {boolean}
     */
    function isVisibleInScroller(element) {
      const elementRect = element.getBoundingClientRect();
      let nearestScroller = getScrollContainer(element);

      let scrollerRect = null;
      if (nearestScroller !== window) {
        scrollerRect = getBoundingClientRect(nearestScroller);
      } else {
        scrollerRect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
      }

      if (isInside(scrollerRect, elementRect) && isInside(scrollerRect, elementRect))
        return true;
      else
        return false;
    }

    /**
     * Decide whether an element is focusable for spatial navigation.
     * 1. If element is the browsing context (document, iframe), then it's focusable,
     * 2. If the element is scrollable container (regardless of scrollable axis), then it's focusable,
     * 3. The value of tabIndex >= 0, then it's focusable,
     * 4. If the element is disabled, it isn't focusable,
     * 5. If the element is expressly inert, it isn't focusable,
     * 6. Whether the element is being rendered or not.
     *
     * @function isFocusable
     * @param element {Node}
     * @returns {boolean}
     *
     * @see {@link https://html.spec.whatwg.org/multipage/interaction.html#focusable-area}
     */
    function isFocusable(element) {
      if ((element.tabIndex < 0) || isAtagWithoutHref(element) || isActuallyDisabled(element) || isExpresslyInert(element) || !isBeingRendered(element))
        return false;
      else if ((!element.parentElement) || (isScrollable(element) && isOverflow(element)) || (element.tabIndex >= 0))
        return true;
    }

    /**
     * Decide whether an element is a tag without href attribute or not.
     *
     * @function isAtagWithoutHref
     * @param element {Node}
     * @returns {boolean}
     */
    function isAtagWithoutHref(element) {
      return (element.tagName === 'A' && element.getAttribute('href') === null && element.getAttribute('tabIndex') === null);
    }

    /**
     * Decide whether an element is actually disabled or not.
     *
     * @function isActuallyDisabled
     * @param element {Node}
     * @returns {boolean}
     *
     * @see {@link https://html.spec.whatwg.org/multipage/semantics-other.html#concept-element-disabled}
     */
    function isActuallyDisabled(element) {
      if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'OPTGROUP', 'OPTION', 'FIELDSET'].includes(element.tagName))
        return (element.disabled);
      else
        return false;
    }

    /**
     * Decide whether the element is expressly inert or not.
     * @see {@link https://html.spec.whatwg.org/multipage/interaction.html#expressly-inert}
     * @function isExpresslyInert
     * @param element {Node}
     * @returns {boolean}
     */
    function isExpresslyInert(element) {
      return ((element.inert) && (!element.ownerDocument.documentElement.inert));
    }

    /**
     * Decide whether the element is being rendered or not.
     * 1. If an element has the style as "visibility: hidden | collapse" or "display: none", it is not being rendered.
     * 2. If an element has the style as "opacity: 0", it is not being rendered.(that is, invisible).
     * 3. If width and height of an element are explicitly set to 0, it is not being rendered.
     * 4. If a parent element is hidden, an element itself is not being rendered.
     * (CSS visibility property and display property are inherited.)
     * @see {@link https://html.spec.whatwg.org/multipage/rendering.html#being-rendered}
     * @function isBeingRendered
     * @param element {Node}
     * @returns {boolean}
     */
    function isBeingRendered(element) {
      if (!isVisibleStyleProperty(element.parentElement))
        return false;
      if (!isVisibleStyleProperty(element) || (element.style.opacity === '0') ||
          (window.getComputedStyle(element).height === '0px' || window.getComputedStyle(element).width === '0px'))
        return false;
      return true;
    }

    /**
     * Decide whether this element is partially or completely visible to user agent.
     * @function isVisible
     * @param element {Node}
     * @returns {boolean}
     */
    function isVisible(element) {
      return (!element.parentElement) || (isVisibleStyleProperty(element) && hitTest(element));
    }

    /**
     * Decide whether this element is completely visible in this viewport for the arrow direction.
     * @function isEntirelyVisible
     * @param element {Node}
     * @returns {boolean}
     */
    function isEntirelyVisible(element, container) {
      const rect = getBoundingClientRect(element);
      const containerElm = container || element.getSpatialNavigationContainer();
      const containerRect = getBoundingClientRect(containerElm);

      // FIXME: when element is bigger than container?
      const entirelyVisible = !((rect.left < containerRect.left) ||
        (rect.right > containerRect.right) ||
        (rect.top < containerRect.top) ||
        (rect.bottom > containerRect.bottom));

      return entirelyVisible;
    }

    /**
     * Decide the style property of this element is specified whether it's visible or not.
     * @function isVisibleStyleProperty
     * @param element {CSSStyleDeclaration}
     * @returns {boolean}
     */
    function isVisibleStyleProperty(element) {
      const elementStyle = window.getComputedStyle(element, null);
      const thisVisibility = elementStyle.getPropertyValue('visibility');
      const thisDisplay = elementStyle.getPropertyValue('display');
      const invisibleStyle = ['hidden', 'collapse'];

      return (thisDisplay !== 'none' && !invisibleStyle.includes(thisVisibility));
    }

    /**
     * Decide whether this element is entirely or partially visible within the viewport.
     * @function hitTest
     * @param element {Node}
     * @returns {boolean}
     */
    function hitTest(element) {
      const elementRect = getBoundingClientRect(element);
      if (element.nodeName !== 'IFRAME' && (elementRect.top < 0 || elementRect.left < 0 ||
        elementRect.top > element.ownerDocument.documentElement.clientHeight || elementRect.left >element.ownerDocument.documentElement.clientWidth))
        return false;

      let offsetX = parseInt(element.offsetWidth) / 10;
      let offsetY = parseInt(element.offsetHeight) / 10;

      offsetX = isNaN(offsetX) ? 1 : offsetX;
      offsetY = isNaN(offsetY) ? 1 : offsetY;

      const hitTestPoint = {
        // For performance, just using the three point(middle, leftTop, rightBottom) of the element for hit testing
        middle: [(elementRect.left + elementRect.right) / 2, (elementRect.top + elementRect.bottom) / 2],
        leftTop: [elementRect.left + offsetX, elementRect.top + offsetY],
        rightBottom: [elementRect.right - offsetX, elementRect.bottom - offsetY]
      };

      for(const point in hitTestPoint) {
        const elemFromPoint = element.ownerDocument.elementFromPoint(...hitTestPoint[point]);
        if (element === elemFromPoint || element.contains(elemFromPoint)) {
          return true;
        }
      }
      return false;
    }

    /**
     * Decide whether a child element is entirely or partially Included within container visually.
     * @function isInside
     * @param containerRect {DOMRect}
     * @param childRect {DOMRect}
     * @returns {boolean}
     */
    function isInside(containerRect, childRect) {
      const rightEdgeCheck = (containerRect.left <= childRect.right && containerRect.right >= childRect.right);
      const leftEdgeCheck = (containerRect.left <= childRect.left && containerRect.right >= childRect.left);
      const topEdgeCheck = (containerRect.top <= childRect.top && containerRect.bottom >= childRect.top);
      const bottomEdgeCheck = (containerRect.top <= childRect.bottom && containerRect.bottom >= childRect.bottom);
      return (rightEdgeCheck || leftEdgeCheck) && (topEdgeCheck || bottomEdgeCheck);
    }

    /**
     * Decide whether this element is entirely or partially visible within the viewport.
     * Note: rect1 is outside of rect2 for the dir
     * @function isOutside
     * @param rect1 {DOMRect}
     * @param rect2 {DOMRect}
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @returns {boolean}
     */
    function isOutside(rect1, rect2, dir) {
      switch (dir) {
      case 'left':
        return isRightSide(rect2, rect1);
      case 'right':
        return isRightSide(rect1, rect2);
      case 'up':
        return isBelow(rect2, rect1);
      case 'down':
        return isBelow(rect1, rect2);
      default:
        return false;
      }
    }

    /* rect1 is right of rect2 */
    function isRightSide(rect1, rect2) {
      return rect1.left >= rect2.right || (rect1.left >= rect2.left && rect1.right > rect2.right && rect1.bottom > rect2.top && rect1.top < rect2.bottom);
    }

    /* rect1 is below of rect2 */
    function isBelow(rect1, rect2) {
      return rect1.top >= rect2.bottom || (rect1.top >= rect2.top && rect1.bottom > rect2.bottom && rect1.left < rect2.right && rect1.right > rect2.left);
    }

    /* rect1 is completely aligned or partially aligned for the direction */
    function isAligned(rect1, rect2, dir) {
      switch (dir) {
      case 'left' :
        /* falls through */
      case 'right' :
        return rect1.bottom > rect2.top && rect1.top < rect2.bottom;
      case 'up' :
        /* falls through */
      case 'down' :
        return rect1.right > rect2.left && rect1.left < rect2.right;
      default:
        return false;
      }
    }

    /**
     * Get distance between the search origin and a candidate element along the direction when candidate element is inside the search origin.
     * @see {@link https://drafts.csswg.org/css-nav-1/#find-the-shortest-distance}
     * @function getDistanceFromPoint
     * @param point {Point} - The search origin
     * @param element {DOMRect} - A candidate element
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @returns {Number} The euclidian distance between the spatial navigation container and an element inside it
     */
    function getDistanceFromPoint(point, element, dir) {
      point = startingPoint;
      // Get exit point, entry point -> {x: '', y: ''};
      const points = getEntryAndExitPoints(dir, point, element);

      // Find the points P1 inside the border box of starting point and P2 inside the border box of candidate
      // that minimize the distance between these two points
      const P1 = Math.abs(points.entryPoint.x - points.exitPoint.x);
      const P2 = Math.abs(points.entryPoint.y - points.exitPoint.y);

      // The result is euclidian distance between P1 and P2.
      return Math.sqrt(Math.pow(P1, 2) + Math.pow(P2, 2));
    }

    /**
     * Get distance between the search origin and a candidate element along the direction when candidate element is inside the search origin.
     * @see {@link https://drafts.csswg.org/css-nav-1/#find-the-shortest-distance}
     * @function getInnerDistance
     * @param rect1 {DOMRect} - The search origin
     * @param rect2 {DOMRect} - A candidate element
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @returns {Number} The euclidean distance between the spatial navigation container and an element inside it
     */
    function getInnerDistance(rect1, rect2, dir) {
      const baseEdgeForEachDirection = {left: 'right', right: 'left', up: 'bottom', down: 'top'};
      const baseEdge = baseEdgeForEachDirection[dir];

      return Math.abs(rect1[baseEdge] - rect2[baseEdge]);
    }

    /**
     * Get the distance between the search origin and a candidate element considering the direction.
     * @see {@link https://drafts.csswg.org/css-nav-1/#calculating-the-distance}
     * @function getDistance
     * @param searchOrigin {DOMRect | Point} - The search origin
     * @param candidateRect {DOMRect} - A candidate element
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @returns {Number} The distance scoring between two elements
     */
    function getDistance(searchOrigin, candidateRect, dir) {
      const kOrthogonalWeightForLeftRight = 30;
      const kOrthogonalWeightForUpDown = 2;

      let orthogonalBias = 0;
      let alignBias = 0;
      const alignWeight = 5.0;

      // Get exit point, entry point -> {x: '', y: ''};
      const points = getEntryAndExitPoints(dir, searchOrigin, candidateRect);

      // Find the points P1 inside the border box of starting point and P2 inside the border box of candidate
      // that minimize the distance between these two points
      const P1 = Math.abs(points.entryPoint.x - points.exitPoint.x);
      const P2 = Math.abs(points.entryPoint.y - points.exitPoint.y);

      // A: The euclidean distance between P1 and P2.
      const A = Math.sqrt(Math.pow(P1, 2) + Math.pow(P2, 2));
      let B, C;

      // B: The absolute distance in the direction which is orthogonal to dir between P1 and P2, or 0 if dir is null.
      // C: The intersection edges between a candidate and the starting point.

      // D: The square root of the area of intersection between the border boxes of candidate and starting point
      const intersectionRect = getIntersectionRect(searchOrigin, candidateRect);
      const D = intersectionRect.area;

      switch (dir) {
      case 'left':
        /* falls through */
      case 'right' :
        // If two elements are aligned, add align bias
        // else, add orthogonal bias
        if (isAligned(searchOrigin, candidateRect, dir))
          alignBias = Math.min(intersectionRect.height / searchOrigin.height , 1);
        else
          orthogonalBias = (searchOrigin.height / 2);

        B = (P2 + orthogonalBias) * kOrthogonalWeightForLeftRight;
        C = alignWeight * alignBias;
        break;

      case 'up' :
        /* falls through */
      case 'down' :
        // If two elements are aligned, add align bias
        // else, add orthogonal bias
        if (isAligned(searchOrigin, candidateRect, dir))
          alignBias = Math.min(intersectionRect.width / searchOrigin.width , 1);
        else
          orthogonalBias = (searchOrigin.width / 2);

        B = (P1 + orthogonalBias) * kOrthogonalWeightForUpDown;
        C = alignWeight * alignBias;
        break;

      default:
        B = 0;
        C = 0;
        break;
      }

      return (A + B - C - D);
    }

    /**
     * Get the euclidean distance between the search origin and a candidate element considering the direction.
     * @function getEuclideanDistance
     * @param rect1 {DOMRect} - The search origin
     * @param rect2 {DOMRect} - A candidate element
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @returns {Number} The distance scoring between two elements
     */
    function getEuclideanDistance(rect1, rect2, dir) {
      // Get exit point, entry point
      const points = getEntryAndExitPoints(dir, rect1, rect2);

      // Find the points P1 inside the border box of starting point and P2 inside the border box of candidate
      // that minimize the distance between these two points
      const P1 = Math.abs(points.entryPoint.x - points.exitPoint.x);
      const P2 = Math.abs(points.entryPoint.y - points.exitPoint.y);

      // Return the euclidean distance between P1 and P2.
      return Math.sqrt(Math.pow(P1, 2) + Math.pow(P2, 2));
    }

    /**
     * Get the absolute distance between the search origin and a candidate element considering the direction.
     * @function getAbsoluteDistance
     * @param rect1 {DOMRect} - The search origin
     * @param rect2 {DOMRect} - A candidate element
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
     * @returns {Number} The distance scoring between two elements
     */
    function getAbsoluteDistance(rect1, rect2, dir) {
      // Get exit point, entry point
      const points = getEntryAndExitPoints(dir, rect1, rect2);

      // Return the absolute distance in the dir direction between P1 and P.
      return ((dir === 'left') || (dir === 'right')) ?
        Math.abs(points.entryPoint.x - points.exitPoint.x) : Math.abs(points.entryPoint.y - points.exitPoint.y);
    }

    /**
     * Get entry point and exit point of two elements considering the direction.
     * @function getEntryAndExitPoints
     * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD). Default value for dir is 'down'.
     * @param searchOrigin {DOMRect | Point} - The search origin which contains the exit point
     * @param candidateRect {DOMRect} - One of candidates which contains the entry point
     * @returns {Points} The exit point from the search origin and the entry point from a candidate
     */
    function getEntryAndExitPoints(dir = 'down', searchOrigin, candidateRect) {
      /**
       * User type definition for Point
       * @typeof {Object} Points
       * @property {Point} Points.entryPoint
       * @property {Point} Points.exitPoint
       */
      const points = {entryPoint: {x: 0, y: 0}, exitPoint:{x: 0, y: 0}};

      if (startingPoint) {
        points.exitPoint = searchOrigin;

        switch (dir) {
        case 'left':
          points.entryPoint.x = candidateRect.right;
          break;
        case 'up':
          points.entryPoint.y = candidateRect.bottom;
          break;
        case 'right':
          points.entryPoint.x = candidateRect.left;
          break;
        case 'down':
          points.entryPoint.y = candidateRect.top;
          break;
        }

        // Set orthogonal direction
        switch (dir) {
        case 'left':
        case 'right':
          if (startingPoint.y <= candidateRect.top) {
            points.entryPoint.y = candidateRect.top;
          } else if (startingPoint.y < candidateRect.bottom) {
            points.entryPoint.y = startingPoint.y;
          } else {
            points.entryPoint.y = candidateRect.bottom;
          }
          break;

        case 'up':
        case 'down':
          if (startingPoint.x <= candidateRect.left) {
            points.entryPoint.x = candidateRect.left;
          } else if (startingPoint.x < candidateRect.right) {
            points.entryPoint.x = startingPoint.x;
          } else {
            points.entryPoint.x = candidateRect.right;
          }
          break;
        }
      }
      else {
        // Set direction
        switch (dir) {
        case 'left':
          points.exitPoint.x = searchOrigin.left;
          points.entryPoint.x = (candidateRect.right < searchOrigin.left) ? candidateRect.right : searchOrigin.left;
          break;
        case 'up':
          points.exitPoint.y = searchOrigin.top;
          points.entryPoint.y = (candidateRect.bottom < searchOrigin.top) ? candidateRect.bottom : searchOrigin.top;
          break;
        case 'right':
          points.exitPoint.x = searchOrigin.right;
          points.entryPoint.x = (candidateRect.left > searchOrigin.right) ? candidateRect.left : searchOrigin.right;
          break;
        case 'down':
          points.exitPoint.y = searchOrigin.bottom;
          points.entryPoint.y = (candidateRect.top > searchOrigin.bottom) ? candidateRect.top : searchOrigin.bottom;
          break;
        }

        // Set orthogonal direction
        switch (dir) {
        case 'left':
        case 'right':
          if (isBelow(searchOrigin, candidateRect)) {
            points.exitPoint.y = searchOrigin.top;
            points.entryPoint.y = (candidateRect.bottom < searchOrigin.top) ? candidateRect.bottom : searchOrigin.top;
          } else if (isBelow(candidateRect, searchOrigin)) {
            points.exitPoint.y = searchOrigin.bottom;
            points.entryPoint.y = (candidateRect.top > searchOrigin.bottom) ? candidateRect.top : searchOrigin.bottom;
          } else {
            points.exitPoint.y = Math.max(searchOrigin.top, candidateRect.top);
            points.entryPoint.y = points.exitPoint.y;
          }
          break;

        case 'up':
        case 'down':
          if (isRightSide(searchOrigin, candidateRect)) {
            points.exitPoint.x = searchOrigin.left;
            points.entryPoint.x = (candidateRect.right < searchOrigin.left) ? candidateRect.right : searchOrigin.left;
          } else if (isRightSide(candidateRect, searchOrigin)) {
            points.exitPoint.x = searchOrigin.right;
            points.entryPoint.x = (candidateRect.left > searchOrigin.right) ? candidateRect.left : searchOrigin.right;
          } else {
            points.exitPoint.x = Math.max(searchOrigin.left, candidateRect.left);
            points.entryPoint.x = points.exitPoint.x;
          }
          break;
        }
      }

      return points;
    }

    /**
     * Find focusable elements within the container
     * @see {@link https://drafts.csswg.org/css-nav-1/#find-the-shortest-distance}
     * @function getIntersectionRect
     * @param rect1 {DOMRect} - The search origin which contains the exit point
     * @param rect2 {DOMRect} - One of candidates which contains the entry point
     * @returns {IntersectionArea} The intersection area between two elements.
     *
     * @typeof {Object} IntersectionArea
     * @property {Number} IntersectionArea.width
     * @property {Number} IntersectionArea.height
     */
    function getIntersectionRect(rect1, rect2) {
      const intersection_rect = {width: 0, height: 0, area: 0};

      const new_location = [Math.max(rect1.left, rect2.left), Math.max(rect1.top, rect2.top)];
      const new_max_point = [Math.min(rect1.right, rect2.right), Math.min(rect1.bottom, rect2.bottom)];

      intersection_rect.width = Math.abs(new_location[0] - new_max_point[0]);
      intersection_rect.height = Math.abs(new_location[1] - new_max_point[1]);

      if (!(new_location[0] >= new_max_point[0] || new_location[1] >= new_max_point[1])) {
        // intersecting-cases
        intersection_rect.area = Math.sqrt(intersection_rect.width * intersection_rect.height);
      }

      return intersection_rect;
    }

    /**
     * Handle the spatial navigation behavior for HTMLInputElement, HTMLTextAreaElement
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input|HTMLInputElement (MDN)}
     * @function handlingEditableElement
     * @param e {Event} - keydownEvent
     * @returns {boolean}
     */
    function handlingEditableElement(e) {
      const SPINNABLE_INPUT_TYPES = ['email', 'date', 'month', 'number', 'time', 'week'],
        TEXT_INPUT_TYPES = ['password', 'text', 'search', 'tel', 'url', null];
      const eventTarget = document.activeElement;
      const focusNavigableArrowKey = {left: false, up: false, right: false, down: false};

      const dir = ARROW_KEY_CODE[e.keyCode];
      if (dir === undefined) {
        return focusNavigableArrowKey;
      }

      if (SPINNABLE_INPUT_TYPES.includes(eventTarget.getAttribute('type')) &&
        (dir === 'up' || dir === 'down')) {
        focusNavigableArrowKey[dir] = true;
      } else if (TEXT_INPUT_TYPES.includes(eventTarget.getAttribute('type')) || eventTarget.nodeName === 'TEXTAREA') {
        // 20210606 fix selectionStart unavailable on checkboxes ~inf
        const startPosition = eventTarget.selectionStart;
        const endPosition = eventTarget.selectionEnd;
        if (startPosition === endPosition) { // if there isn't any selected text
          if (startPosition === 0) {
            focusNavigableArrowKey.left = true;
            focusNavigableArrowKey.up = true;
          }
          if (endPosition === eventTarget.value.length) {
            focusNavigableArrowKey.right = true;
            focusNavigableArrowKey.down = true;
          }
        }
      } else { // HTMLDataListElement, HTMLSelectElement, HTMLOptGroup
        focusNavigableArrowKey[dir] = true;
      }

      return focusNavigableArrowKey;
    }

    /**
     * Get the DOMRect of an element
     * @function getBoundingClientRect
     * @param {Node} element
     * @returns {DOMRect}
     */
    function getBoundingClientRect(element) {
      // memoization
      let rect = mapOfBoundRect && mapOfBoundRect.get(element);
      if (!rect) {
        const boundingClientRect = element.getBoundingClientRect();
        rect = {
          top: Number(boundingClientRect.top.toFixed(2)),
          right: Number(boundingClientRect.right.toFixed(2)),
          bottom: Number(boundingClientRect.bottom.toFixed(2)),
          left: Number(boundingClientRect.left.toFixed(2)),
          width: Number(boundingClientRect.width.toFixed(2)),
          height: Number(boundingClientRect.height.toFixed(2))
        };
        mapOfBoundRect && mapOfBoundRect.set(element, rect);
      }
      return rect;
    }

    /**
     * Get the candidates which is fully inside the target element in visual
     * @param {Node} targetElement
     * @returns {sequence<Node>}  overlappedCandidates
     */
    function getOverlappedCandidates(targetElement) {
      const container = targetElement.getSpatialNavigationContainer();
      const candidates = container.focusableAreas();
      const overlappedCandidates = [];

      candidates.forEach(element => {
        if ((targetElement !== element) && isEntirelyVisible(element, targetElement)) {
          overlappedCandidates.push(element);
        }
      });

      return overlappedCandidates;
    }

    /**
     * Get the list of the experimental APIs
     * @function getExperimentalAPI
     */
    function getExperimentalAPI() {
      function canScroll(container, dir) {
        return (isScrollable(container, dir) && !isScrollBoundary(container, dir)) ||
               (!container.parentElement && !isHTMLScrollBoundary(container, dir));
      }

      function findTarget(findCandidate, element, dir, option) {
        let eventTarget = element;
        let bestNextTarget = null;

        // 4
        if (eventTarget === document || eventTarget === document.documentElement) {
          eventTarget = document.body || document.documentElement;
        }

        // 5
        // At this point, spatialNavigationSearch can be applied.
        // If startingPoint is either a scroll container or the document,
        // find the best candidate within startingPoint
        if ((isContainer(eventTarget) || eventTarget.nodeName === 'BODY') && !(eventTarget.nodeName === 'INPUT')) {
          if (eventTarget.nodeName === 'IFRAME')
            eventTarget = eventTarget.contentDocument.body;

          const candidates = getSpatialNavigationCandidates(eventTarget, option);

          // 5-2
          if (Array.isArray(candidates) && candidates.length > 0) {
            return findCandidate ? getFilteredSpatialNavigationCandidates(eventTarget, dir, candidates) : eventTarget.spatialNavigationSearch(dir, {candidates});
          }
          if (canScroll(eventTarget, dir)) {
            return findCandidate ? [] : eventTarget;
          }
        }

        // 6
        // Let container be the nearest ancestor of eventTarget
        let container = eventTarget.getSpatialNavigationContainer();
        let parentContainer = (container.parentElement) ? container.getSpatialNavigationContainer() : null;

        // When the container is the viewport of a browsing context
        if (!parentContainer && ( window.location !== window.parent.location)) {
          parentContainer = window.parent.document.documentElement;
        }

        // 7
        while (parentContainer) {
          const candidates = filteredCandidates(eventTarget, getSpatialNavigationCandidates(container, option), dir, container);

          if (Array.isArray(candidates) && candidates.length > 0) {
            bestNextTarget = eventTarget.spatialNavigationSearch(dir, {candidates, container});
            if (bestNextTarget) {
              return findCandidate ? candidates : bestNextTarget;
            }
          }

          // If there isn't any candidate and the best candidate among candidate:
          // 1) Scroll or 2) Find candidates of the ancestor container
          // 8 - if
          else if (canScroll(container, dir)) {
            return findCandidate ? [] : eventTarget;
          } else if (container === document || container === document.documentElement) {
            container = window.document.documentElement;

            // The page is in an iframe
            if ( window.location !== window.parent.location ) {
              // eventTarget needs to be reset because the position of the element in the IFRAME
              // is unuseful when the focus moves out of the iframe
              eventTarget = window.frameElement;
              container = window.parent.document.documentElement;
              if (container.parentElement)
                parentContainer = container.getSpatialNavigationContainer();
              else {
                parentContainer = null;
                break;
              }
            }
          } else {
            // avoiding when spatnav container with tabindex=-1
            if (isFocusable(container)) {
              eventTarget = container;
            }

            container = parentContainer;
            if (container.parentElement)
              parentContainer = container.getSpatialNavigationContainer();
            else {
              parentContainer = null;
              break;
            }
          }
        }

        if (!parentContainer && container) {
          // Getting out from the current spatnav container
          const candidates = filteredCandidates(eventTarget, getSpatialNavigationCandidates(container, option), dir, container);

          // 9
          if (Array.isArray(candidates) && candidates.length > 0) {
            bestNextTarget = eventTarget.spatialNavigationSearch(dir, {candidates, container});
            if (bestNextTarget) {
              return findCandidate ? candidates : bestNextTarget;
            }
          }
        }

        if (canScroll(container, dir)) {
          bestNextTarget = eventTarget;
          return bestNextTarget;
        }
      }

      return {
        isContainer,
        isScrollContainer,
        isVisibleInScroller,
        findCandidates: findTarget.bind(null, true),
        findNextTarget: findTarget.bind(null, false),
        getDistanceFromTarget: (element, candidateElement, dir) => {
          if ((isContainer(element) || element.nodeName === 'BODY') && !(element.nodeName === 'INPUT')) {
            if (getSpatialNavigationCandidates(element).includes(candidateElement)) {
              return getInnerDistance(getBoundingClientRect(element), getBoundingClientRect(candidateElement), dir);
            }
          }
          return getDistance(getBoundingClientRect(element), getBoundingClientRect(candidateElement), dir);
        }
      };
    }

    /**
     * Makes to use the experimental APIs.
     * @function enableExperimentalAPIs
     * @param option {boolean} - If it is true, the experimental APIs can be used or it cannot.
     */
    function enableExperimentalAPIs (option) {
      const currentKeyMode = window.__spatialNavigation__ && window.__spatialNavigation__.keyMode;
      window.__spatialNavigation__ = (option === false) ? getInitialAPIs() : Object.assign(getInitialAPIs(), getExperimentalAPI());
      window.__spatialNavigation__.keyMode = currentKeyMode;
      Object.seal(window.__spatialNavigation__);
    }

    /**
     * Set the environment for using the spatial navigation polyfill.
     * @function getInitialAPIs
     */
    function getInitialAPIs() {
      return {
        enableExperimentalAPIs,
        get keyMode() { return this._keymode ? this._keymode : 'ARROW'; },
        set keyMode(mode) { this._keymode = (['SHIFTARROW', 'ARROW', 'NONE'].includes(mode)) ? mode : 'ARROW'; },
        setStartingPoint: function (x, y) {startingPoint = (x && y) ? {x, y} : null;}
      };
    }

    initiateSpatialNavigation();
    enableExperimentalAPIs(false);

    window.addEventListener('load', () => {
      spatialNavigationHandler();
    });
  })();

  function styleInject(css, ref) {
    if ( ref === void 0 ) ref = {};
    var insertAt = ref.insertAt;

    if (typeof document === 'undefined') { return; }

    var head = document.head || document.getElementsByTagName('head')[0];
    var style = document.createElement('style');
    style.type = 'text/css';

    if (insertAt === 'top') {
      if (head.firstChild) {
        head.insertBefore(style, head.firstChild);
      } else {
        head.appendChild(style);
      }
    } else {
      head.appendChild(style);
    }

    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
  }

  var css_248z = ".ytaf-ui-container {\n  position: absolute;\n  top: 10%;\n  left: 10%;\n  right: 10%;\n  bottom: 10%;\n\n  background: rgba(0, 0, 0, 0.8);\n  color: white;\n  border-radius: 20px;\n  padding: 20px;\n  font-size: 1.5rem;\n  z-index: 1000;\n}\n\n.ytaf-ui-container :focus {\n  outline: 4px red solid;\n}\n\n.ytaf-ui-container h1 {\n  margin: 0;\n  margin-bottom: 0.5em;\n  text-align: center;\n}\n\n.ytaf-ui-container input[type='checkbox'] {\n  width: 1.4rem;\n  height: 1.4rem;\n}\n\n.ytaf-ui-container input[type='radio'] {\n  width: 1.4rem;\n  height: 1.4rem;\n}\n\n.ytaf-ui-container label {\n  display: block;\n  font-size: 1.4rem;\n}\n\n.ytaf-notification-container {\n  position: absolute;\n  right: 10px;\n  bottom: 10px;\n  font-size: 16pt;\n  z-index: 1200;\n}\n\n.ytaf-notification-container .message {\n  background: rgba(0, 0, 0, 0.7);\n  color: white;\n  padding: 1em;\n  margin: 0.5em;\n  transition: all 0.3s ease-in-out;\n  opacity: 1;\n  line-height: 1;\n  border-right: 10px solid rgba(50, 255, 50, 0.3);\n  display: inline-block;\n  float: right;\n}\n\n.ytaf-notification-container .message-hidden {\n  opacity: 0;\n  margin: 0 0.5em;\n  padding: 0 1em;\n  line-height: 0;\n}\n\n/* Fixes transparency effect for the video player */\n\n.ytLrWatchDefaultShadow {\n  background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0.8) 90%) !important;\n  background-color: rgba(0, 0, 0, 0.3) !important;\n  display: block !important;\n  height: 100% !important;\n  pointer-events: none !important;\n  position: absolute !important;\n  width: 100% !important;\n}\n\n/* Fixes shorts having a black background */\n\n.ytLrTileHeaderRendererShorts {\n  background-image: none !important;\n}";
  styleInject(css_248z);

  const style = document.createElement('style');
  let css = '';

  function updateStyle() {
      css = `
    ytlr-guide-response yt-focus-container {
        background-color: ${configRead('focusContainerColor')};
    }

    #container {
        background-color: ${configRead('routeColor')} !important;
    }
`;
      const existingStyle = document.querySelector('style[nonce]');
      if (existingStyle) {
          existingStyle.textContent += css;
      } else {
          style.textContent = css;
      }
  }
  document.head.appendChild(style);
  updateStyle();

  /*global navigate*/

  // It just works, okay?
  const interval$1 = setInterval(() => {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      execute_once_dom_loaded();
      patchResolveCommand();
      clearInterval(interval$1);
    }
  }, 250);

  function execute_once_dom_loaded() {

    // Add CSS to head.

    const existingStyle = document.querySelector('style[nonce]');
    if (existingStyle) {
      existingStyle.textContent += css_248z;
    } else {
      const style = document.createElement('style');
      style.textContent = css_248z;
      document.head.appendChild(style);
    }

    // Fix UI issues.
    const ui = configRead('enableFixedUI');
    if (ui) {
      try {
        window.tectonicConfig.featureSwitches.isLimitedMemory = false;
        window.tectonicConfig.clientData.legacyApplicationQuality = 'full-animation';
        window.tectonicConfig.featureSwitches.enableAnimations = true;
        window.tectonicConfig.featureSwitches.enableOnScrollLinearAnimation = true;
        window.tectonicConfig.featureSwitches.enableListAnimations = true;
      } catch (e) { }
    }

    // We handle key events ourselves.
    window.__spatialNavigation__.keyMode = 'NONE';

    var ARROW_KEY_CODE = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };

    var uiContainer = document.createElement('div');
    uiContainer.classList.add('ytaf-ui-container');
    uiContainer.style['display'] = 'none';
    uiContainer.setAttribute('tabindex', 0);


    uiContainer.addEventListener(
      'keydown',
      (evt) => {
        if (evt.keyCode !== 404 && evt.keyCode !== 172) {
          if (evt.keyCode in ARROW_KEY_CODE) {
            navigate(ARROW_KEY_CODE[evt.keyCode]);
          } else if (evt.keyCode === 13 || evt.keyCode === 32) {
            const focusedElement = document.querySelector(':focus');
            if (focusedElement.type === 'checkbox') {
              focusedElement.checked = !focusedElement.checked;
              focusedElement.dispatchEvent(new Event('change'));
            }
            evt.preventDefault();
            evt.stopPropagation();
            return;
          } else if (evt.keyCode === 27 && document.querySelector(':focus').type !== 'text') {
            // Back button
            uiContainer.style.display = 'none';
            uiContainer.blur();
          } else if (document.querySelector(':focus').type === 'text' && evt.keyCode === 27) {
            const focusedElement = document.querySelector(':focus');
            focusedElement.value = focusedElement.value.slice(0, -1);
          }


          if (evt.key === 'Enter' || evt.Uc?.key === 'Enter') {
            // If the focused element is a text input, emit a change event.
            if (document.querySelector(':focus').type === 'text') {
              document.querySelector(':focus').dispatchEvent(new Event('change'));
            }
          }
        }
      },
      true
    );

    uiContainer.innerHTML = `
<h1>NotubeTv Theme Configuration</h1>
<label for="__barColor">Navigation Bar Color: <input type="text" id="__barColor"/></label>
<label for="__routeColor">Main Content Color: <input type="text" id="__routeColor"/></label>
<div><small>Sponsor segments skipping - https://sponsor.ajay.app</small></div>
`;
    document.querySelector('body').appendChild(uiContainer);

    uiContainer.querySelector('#__barColor').value = configRead('focusContainerColor');
    uiContainer.querySelector('#__barColor').addEventListener('change', (evt) => {
      configWrite('focusContainerColor', evt.target.value);
      updateStyle();
    });

    uiContainer.querySelector('#__routeColor').value = configRead('routeColor');
    uiContainer.querySelector('#__routeColor').addEventListener('change', (evt) => {
      configWrite('routeColor', evt.target.value);
      updateStyle();
    });
/*
    var eventHandler = (evt) => {
      // We handle key events ourselves.

      if (evt.keyCode == 403) {
        evt.preventDefault();
        evt.stopPropagation();
        if (evt.type === 'keydown') {
          if (uiContainer.style.display === 'none') {
            uiContainer.style.display = 'block';
            uiContainer.focus();
          } else {
            uiContainer.style.display = 'none';
            uiContainer.blur();
          }
        }
        return false;
      } else if (evt.keyCode == 404) {
        if (evt.type === 'keydown') {
          modernUI();
        }
      }    return true;
    };

    // Red, Green, Yellow, Blue
    // 403, 404, 405, 406
    // ---, 172, 170, 191
    document.addEventListener('keydown', eventHandler, true);
    document.addEventListener('keypress', eventHandler, true);
    document.addEventListener('keyup', eventHandler, true);

    setTimeout(() => {
     showToast('Welcome to NotubeTv', 'Press [GREEN] to open NotubeTv Settings, press [BLUE] to open Video Speed Settings and press [RED] to open NotubeTv Theme Settings.');
    }, 2000);

    // Fix UI issues, again. Love, Googol.
*/
    if (configRead('enableFixedUI')) {
      try {
        const observer = new MutationObserver((_, _2) => {
          const body = document.body;
          if (body.classList.contains('app-quality-root')) {
            body.classList.remove('app-quality-root');
          }
        });
        observer.observe(document.body, { attributes: true, childList: false, subtree: false });
      } catch (e) { }
    }
  }

  const interval = setInterval(() => {
      const videoElement = document.querySelector('video');
      if (videoElement) {
          execute_once_dom_loaded_speed();
          clearInterval(interval);
      }
  }, 1000);

  function execute_once_dom_loaded_speed() {
      document.querySelector('video').addEventListener('canplay', () => {
          document.getElementsByTagName('video')[0].playbackRate = configRead('videoSpeed');    });

      const eventHandler = (evt) => {
          const currentSpeed = configRead('videoSpeed');
          if (evt.keyCode == 406 || evt.keyCode == 191) {
              evt.preventDefault();
              evt.stopPropagation();
              if (evt.type === 'keydown') {
                  let selectedIndex = 0;
                  const maxSpeed = 4;
                  const increment = 0.25;
                  const buttons = [];
                  for (let speed = increment; speed <= maxSpeed; speed += increment) {
                      buttons.push(
                          buttonItem(
                              { title: `${speed}x` },
                              null,
                              [
                                  {
                                      signalAction: {
                                          signal: 'POPUP_BACK'
                                      }
                                  },
                                  {
                                      setClientSettingEndpoint: {
                                          settingDatas: [
                                              {
                                                  clientSettingEnum: {
                                                      item: 'videoSpeed'
                                                  },
                                                  intValue: speed.toString()
                                              }
                                          ]
                                      }
                                  }
                              ]
                          )
                      );
                      if (currentSpeed === speed) {
                          selectedIndex = buttons.length - 1;
                      }
                  }

                  buttons.push(
                      buttonItem(
                          { title: `Fix stuttering (1.0001x)` },
                          null,
                          [
                              {
                                  signalAction: {
                                      signal: 'POPUP_BACK'
                                  }
                              },
                              {
                                  setClientSettingEndpoint: {
                                      settingDatas: [
                                          {
                                              clientSettingEnum: {
                                                  item: 'videoSpeed'
                                              },
                                              intValue: '1.0001'
                                          }
                                      ]
                                  }
                              }
                          ]
                      )
                  );

                  showModal('Playback Speed', buttons, selectedIndex, 'tt-speed');

                  let observer = new MutationObserver((mutationsList, observer) => {
                      let modal = null;
                      const elements = document.getElementsByTagName('yt-formatted-string');
                      for (const element of elements) {
                          if (element.innerText === 'Playback Speed') {
                              modal = element;
                              break;
                          }
                      }
                      if (!modal) {
                          document.getElementsByTagName('video')[0].playbackRate = configRead('videoSpeed');
                          observer.disconnect();
                      }
                  }
                  );
                  observer.observe(document.body, { childList: true, subtree: true });
                  return false;
              }
              return true;
          }    };

      // Red, Green, Yellow, Blue
      // 403, 404, 405, 406
      // ---, 172, 170, 191
      document.addEventListener('keydown', eventHandler, true);
      document.addEventListener('keypress', eventHandler, true);
      document.addEventListener('keyup', eventHandler, true);
  }

})();