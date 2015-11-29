const URL_PREFIX = 'http://better-translator.com'
//const URL_PREFIX = 'http://localhost:8001';
const GA_URL = 'http://www.google-analytics.com/collect';
const GA_TRAKING_ID = 'UA-346833-18';
const GA_CLIENT_ID = 'd90e0340-e056-4171-8ad9-b0d6fdcdf7e8';

const remote = require('electron').remote;
const config = require('./config.json');

const rollbar = require('rollbar');
rollbar.init(config.rollbar_access_token, {
  environment: config.rollbar_environment,
  endpoint: 'https://api.rollbar.com/api/1/'
});
rollbar.handleUncaughtExceptions(
  config.rollbar_access_token,
  {exitOnUncaughtException: false});

const LocalStorage = require('node-localstorage').LocalStorage;
var localStorage = new LocalStorage('./preferences');

var BindingView = Backbone.Epoxy.View.extend({
  el: '#translation-form',
  bindings: {
    "select[name=sl]": "value:sourceLanguage,options:languages",
    "select[name=il]": "value:intermediateLanguage,options:intermediateLanguages",
    "select[name=tl]": "value:targetLanguage,options:languages",
    "#source-text": "value:sourceText,events:['keyup']",
    "#target-text": "text:targetText"
  },
  events: {
    'change select[name=sl]': 'onChangeSourceLanguage',
    'change select[name=il]': 'onChangeIntermediateLanguage',
    'change select[name=tl]': 'onChangeTargetLanguage'
  },

  // FIXME: The following event handlers could be further simplified
  onChangeSourceLanguage: function(e) {
    localStorage.setItem('sourceLanguage', model.get('sourceLanguage'));
  },
  onChangeIntermediateLanguage: function(e) {
    localStorage.setItem('intermediateLanguage',
                         model.get('intermediateLanguage'));
  },
  onChangeTargetLanguage: function(e) {
    localStorage.setItem('targetLanguage', model.get('targetLanguage'));
  },
});

var Model = Backbone.Model.extend({
  defaults: {
    languages: [],
    intermediateLanguages: [
      {label:'없음', value:''},
      {label:'일본어', value:'ja'},
      {label:'러시아어', value:'ru'}
    ],
    sourceLanguage: null,
    intermediateLanguage: localStorage.getItem('intermediateLanguage') ?
      localStorage.getItem('intermediateLanguage') : 'ja',
    targetLanguage: null,
    sourceText: '',
    targetText: '',
    raw: null
  },
  hasIntermediateLanguage: function() {
    return this.get('intermediateLanguage') != null &&
           this.get('intermediateLanguage') != '';
  }
});

var examples = {
    en: [
        "The Google translator that you did not know about",
        "Google is dreaming of the world conquest.",
        "When in Rome do as the Romans do.",
        "An eigenvector of a square matrix A is a non-zero vector v that, when multiplied by A, yields the original vector multiplied by a single number L; that is, Av = Lv. The number L is called the eigenvalue of A corresponding to v.",
        "What the hell is going on"
    ],
    ko: [
        "여러분이 몰랐던 구글 번역기",
        "샌디에고에 살고 있는 김근모씨는 오늘도 힘찬 출근",
        "구글은 세계 정복을 꿈꾸고 있다.",
        "호준이는 비싼 학비 때문에 허리가 휘어집니다.",
        "청년들을 타락시킨 죄로 독콜라를 마시는 홍민희",
        "강선구 이사님은 오늘도 새로운 기술을 찾아나선다."
    ],
    // TODO: Fill in some example sentences.
    fr: [""],
    es: [""],
    ja: [""],
    ru: [""],
    id: [""]
};

// URL encoded length, exclusively less than
var SHORT_TRANSLATION_THRESHOLD = 256;

var TAGS_TO_REPLACE = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
};

/**
 * Copied from http://homework.nwsnet.de/releases/9132/
 */
function _ajax_request(url, data, callback, type, method) {
    if (jQuery.isFunction(data)) {
        callback = data;
        data = {};
    }
    return jQuery.ajax({
        type: method,
        url: url,
        data: data,
        success: callback,
        dataType: type
        });
}

jQuery.extend({
    put: function(url, data, callback, type) {
        return _ajax_request(url, data, callback, type, 'PUT');
    },
    delete_: function(url, data, callback, type) {
        return _ajax_request(url, data, callback, type, 'DELETE');
    }
});


/**
 * Copied from http://stackoverflow.com/questions/9614622/equivalent-of-jquery-hide-to-set-visibility-hidden
 */
$.fn.visible = function() {
    return this.css('visibility', 'visible');
};
$.fn.invisible = function() {
    return this.css('visibility', 'hidden');
};

$.fn.disable = function() {
    return this.attr("disabled", "disabled");
};
$.fn.enable = function() {
    return this.removeAttr("disabled");
};


/**
 * Parsing a URL query string
 * http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values
 */
function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.search);
    if(results == null) {
        return "";
    }
    else {
        return decodeURIComponent(results[1].replace(/\+/g, " "));
    }
}

/**
 * Copied from http://codereview.stackexchange.com/questions/9574/ \
 *     faster-and-cleaner-way-to-parse-parameters-from-url-in-javascript-jquery
 */
function parseHash(hash) {
    var query = (window.location.search || '#').substr(1),
        map   = {};
    hash.replace(/([^&=]+)=?([^&]*)(?:&+|$)/g, function(match, key, value) {
        (map[key] = map[key] || []).push(value);
    });
    return map;
}

function resizeTextarea(t) {
    var a = t.value.split('\n');
    var b = 1;
    for (var x=0;x < a.length; x++) {
        if (a[x].length >= t.cols) b+= Math.floor(a[x].length/t.cols);
    }
    b+= a.length;
    if (b > t.rows) t.rows = b;
}

/**
 * Extracts sentences from the Google Translate result
 */
function extractSentences(raw) {
    return $.map(raw[0], (function(v) { return v[0]; })).join('');
}

function showCaptcha(body) {

    body = body.replace("/sorry/image",
        "http://translate.google.com/sorry/image");

    body = body.replace("action=\"CaptchaRedirect\"",
        "action=\"http://sorry.google.com/sorry/CaptchaRedirect\"");

    $("#captcha-dialog .modal-body").html(body);
    $("#captcha-dialog").modal("show");
}

// TODO: Refactor this function
function refreshExample() {
    var language = state.source;

    // Randomly chooses an example sentence
    //state.ei = Math.floor(Math.random() * examples.ko.length);

    var example = examples[language][state.exampleIndex++ % examples[language].length];

    $("#text").val(example);

    performTranslation();
}


function displayError(message, postfix) {
    if (postfix == null) {
        postfix = 'If problem persists, please report it <a href="/discuss?rel=bug_report">here</a>.';
    }
    $("#error-message").html(sprintf("%s %s", message, postfix)).show();
    $("#result").empty();
}
function hideError() {
	$("#error-message").hide();
}

function hashChanged(hash) {
    var phash = parseHash(hash.substr(1));

    var serial = phash.sr ? phash.sr[0] : "";

    if (serial) {
        $("#request-permalink").hide();

    }
    else if(getParameterByName("t")) {
        // Perform no action
    }
    else {
        var source = phash.sl;
        var target = phash.tl;
        var intermediate = phash.il;
        var text = phash.t;

        $("select[name=sl]").val(source ? source : state.source);
        $("select[name=il]").val(intermediate ? intermediate : state.intermediate);
        $("select[name=tl]").val(target ? target : state.target);

        if (text) {
            $("#text").val(decodeURIComponent(text));
            performTranslation();
        }
    }
}

function toggleScreenshot() {
    $("#google-translate").toggle("medium");
}

/**
 * @param state True or false
 */
function enableControls(state) {
    if (state) {
        $("form input").enable();
        $("form select").enable();
        $("form button").enable();
    }
    else {
        $("form input").disable();
        $("form select").disable();
        $("form button").disable();
    }
}

function renderStatus(statusText) {
  document.getElementById('status').textContent = statusText;
}


const menu = require('./menu.js');

window.onload = function() {

    if (localStorage.getItem('debug')) {
      menu.template[2].submenu.push({
        label: 'Toggle Developer Tools',
        accelerator: (function() {
          if (process.platform == 'darwin')
            return 'Alt+Command+I';
          else
            return 'Ctrl+Shift+I';
        })(),
        click: function(item, focusedWindow) {
          if (focusedWindow)
            focusedWindow.toggleDevTools();
        }
      });
    }

    var _menu = remote.Menu.buildFromTemplate(menu.template);
    remote.Menu.setApplicationMenu(_menu);

    window.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      _menu.popup(remote.getCurrentWindow());
    }, false);

    // The following code was copied from
    // http://stackoverflow.com/questions/2161906/handle-url-anchor-change-event-in-js
    if ("onhashchange" in window) { // event supported?
        window.onhashchange = function () {
            hashChanged(window.location.hash);
        };
    }
    else { // event not supported:
        var storedHash = window.location.hash;
        window.setInterval(function () {
            if (window.location.hash != storedHash) {
                storedHash = window.location.hash;
                hashChanged(storedHash);
            }
        }, 250);
    }

    $('#translation-form').bind('submit', performTranslation);

    $("textarea.source-text, div.target-text").autoResize({
        // On resize:
        onResize: function() {
            $(this).css({opacity:0.8});
        },
        // After resize:
        animateCallback: function() {
            $(this).css({opacity:1});
        },
        // Quite slow animation:
        animateDuration: 300,
        // More extra space:
        extraSpace: 40
    })
    .keypress(function (event) {
        if (event.keyCode == 13) {
            performTranslation();
        }
    })
    .trigger("change");

    model = new Model();
    bindingView = new BindingView({model: model});

    // Dynamically set the available languages
    $.get(URL_PREFIX + '/api/v1.0/languages?locale=ko', function(response) {
      var languages = $.map(response, function(value, key) {
        return {label: value, value: key};
      });
      var sl = localStorage.getItem('sourceLanguage');
      var tl = localStorage.getItem('targetLanguage');
      model.set('languages', languages);
      model.set('sourceLanguage', sl ? sl : 'en');
      model.set('targetLanguage', tl ? tl : 'ko');
    });

    $.post(GA_URL, {v: 1, tid: GA_TRAKING_ID, cid: GA_CLIENT_ID, t: 'event',
                    ec: 'client', ea: 'onload', el: process.platform});
};

function performTranslation(event) {
  if (event != null)
    event.preventDefault();

  var source = model.get('sourceLanguage');
  var intermediate = model.get('intermediateLanguage');
  var target = model.get('targetLanguage');
  var text = model.get('sourceText');

  $('#progress-message').show();
  if (model.hasIntermediateLanguage()) {
    performBetterTranslation(source, intermediate, target, text);
  }
  else {
    performNormalTranslation(source, target, text);
  }

  var label = sprintf('sl=%s&il=%s&tl=%s', source, intermediate, target);
  console.log(label);
  $.post(GA_URL, {v: 1, tid: GA_TRAKING_ID, cid: GA_CLIENT_ID, t: 'event',
                  ec: 'client', ea: 'translate', el: label});

  return false;
}

/**
 * Sends a request to the BT server in order to get all request parameters to
 * be sent to the Google Translate server
 * @param {string} source - Source language code
 * @param {string} target - Target language code
 * @param {string} test - Source text
 */
function performNormalTranslation(source, target, text) {
  var onSuccess = function(result) {
    // FIXME: Potential security issues
    model.set('raw', eval(result));
    model.set('targetText', extractSentences(model.get('raw')));
  };

  var onFinish = function() {
    $('#progress-message').hide();
  }

  $.post(URL_PREFIX + '/api/v1.3/params',
    {'text':text, 'source':source, 'target':target},
    function(response) {
      sendTranslationRequest(
        source, target, text,
        response, // request parameters
        onSuccess,
        onFinish
      );
  });
}
/**
 * @param {string} source - Source language code
 * @param {string} intermediate - Intermediate language code
 * @param {string} target - Target language code
 * @param {string} test - Source text
 */
function performBetterTranslation(source, intermediate, target, text) {
  var onSuccess1 = function(result) {
    // FIXME: Potential security issues
    model.set('raw', eval(result));
    model.set('targetText', extractSentences(model.get('raw')));

    text = model.get('targetText');

    var delay = 500 + Math.random() * 1000;
    setTimeout(sendSubsequentRequest, delay);
  };

  var sendSubsequentRequest = function() {
    $.post(URL_PREFIX + '/api/v1.3/params',
      {'text':text, 'source':intermediate, 'target':target},
      function(response) {
        sendTranslationRequest(
          intermediate, target, text,
          response, // request parameters
          onSuccess2,
          onFinish
        );
      });
  }

  var onSuccess2 = function(result) {
    // FIXME: Potential security issues
    model.set('raw', eval(result));
    model.set('targetText', extractSentences(model.get('raw')));
  };

  var onFinish = function() {
    $('#progress-message').hide();
  }

  $.post(URL_PREFIX + '/api/v1.3/params',
    {'text':text, 'source':source, 'target':intermediate},
    function(response) {
      sendTranslationRequest(
        source, intermediate, text,
        response, // request parameters
        onSuccess1,
        null
      );
  });
}

/**
 * Sends a translation request to the Google Translate server
 * @param {string} source - Source language code
 * @param {string} target - Target language code
 * @param {string} test - Source text
 * @param {object} requestParams
 * @param {function} onSuccess - A callback function that will be called on success
 * @param {function} onFinish - A callback function that will be called regardless of the result
 */
function sendTranslationRequest(source, target, text, requestParams, onSuccess, onFinish) {

    // Use GET for short requests and POST for long requests
    var encodedText = encodeURIComponent(text)
    var textLength = encodedText.length;

    var uri = parseURI(requestParams.url + '?' + requestParams.query);

    var http = require('http');
    var options = {
      host: uri.host,
      path: uri.relative, // path + query
      method: requestParams.method,
      headers: {
        'Origin': 'http://translate.google.com',
        'Referer': 'http://translate.google.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.86 Safari/537.36'
      }
    };

    var callback = function(response) {
      var buf = ''
      response.on('data', function (chunk) {
        buf += chunk;
      });

      response.on('end', function () {
        console.log(buf);
        if (onSuccess != null) onSuccess(buf);
        if (onFinish != null) onFinish();
      });
    }

    if (requestParams.method == 'post') {
      options.headers['Content-Length'] = textLength;
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
    }

    var request = http.request(options, callback);
    request.on('error', function(err) {
      console.log(err);
      if (onFinish != null) onFinish();
    });
    if (requestParams.method == 'post') {
      request.write('q=' + encodedText);
    }
    request.end();
}


/**
 * Copied from http://blog.stevenlevithan.com/archives/parseuri
 */
function parseURI (str) {
	var	o   = parseURI.options,
		m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
		uri = {},
		i   = 14;

	while (i--) uri[o.key[i]] = m[i] || "";

	uri[o.q.name] = {};
	uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
		if ($1) uri[o.q.name][$1] = $2;
	});

	return uri;
};
parseURI.options = {
	strictMode: false,
	key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
	q:   {
		name:   "queryKey",
		parser: /(?:^|&)([^&=]*)=?([^&]*)/g
	},
	parser: {
		strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
		loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
	}
};
