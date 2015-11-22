// The primary namespace for our app
var frontend = {};

var BindingView = Backbone.Epoxy.View.extend({
  el: '#translation-form',
  bindings: {
    "select[name=sl]": "value:sourceLanguage,options:languages",
    "select[name=il]": "value:intermediateLanguage,options:intermediateLanguages",
    "select[name=tl]": "value:targetLanguage,options:languages",
    "#source-text": "value:sourceText,events:['keyup']",
    "#target-text": "text:targetText"
  }
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
    intermediateLanguage: '',
    targetLanguage: null,
    sourceText: '',
    targetText: '',
    raw: null
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


var state = {
    source: null, // source language
    intermediate: null, // intermediate language
    target: null, // target language
    text: null,
    result: null,

    id: null,
    requestId: null,
    serial: null,
    exampleIndex: 0,

    pending: false,

    setSource: function(v) {
        this.source = v;
        $("select[name=sl]").val(v);
    },

    setIntermediate: function(v) {
        this.intermediate = v;
        $("select[name=il]").val(v);
    },

    setTarget: function(v) {
        this.target = v;
        $("select[name=tl]").val(v);
    },

    setText: function(v) {
        this.text = v;
        $("#text").val(v);
    },

    setResult: function(v) {
        //this.result = v;
        $("#result").html(v);
    },

    selectSource: function(v) {
        this.source = v;
        this.setResult("");

        $.cookie("source", v);
    },

    selectIntermediate: function(v) {
        this.intermediate = v;
        this.setResult("");

        $.cookie("intermediate", v);
    },

    selectTarget: function(v) {
        this.target = v;
        this.setResult("");

        $.cookie("target", v);
    },

    init: function() {
        this.setSource(typeof $.cookie("source") != "undefined" ?
            $.cookie("source") : "auto");
        this.setIntermediate(typeof $.cookie("intermediate") != "undefined" ?
            $.cookie("intermediate") : "ja");
        this.setTarget(typeof $.cookie("target") != "undefined" ?
            $.cookie("target") : "en");
    },

    initWithState: function(state) {
        this.setSource(state.source);
        this.setIntermediate(state.intermediate);
        this.setTarget(state.target);
        this.setText(state.text);
        //this.setResult(state.result);
    },

    initWithParameters: function() {
        this.setSource(getParameterByName("sl"));
        this.setIntermediate(getParameterByName("il"));
        this.setTarget(getParameterByName("tl"));
        this.setText(getParameterByName("t"));
    },

    initWithTranslation: function(t) {
        this.id = t.id;
        this.requestId = t.request_id;
        this.serial = t.serial;
        this.source = t.source;
        this.intermediate = t.intermediate; // FIXME: This is not implemented on the server side
        this.target = t.target;
        this.text = t.original_text;
        //this.result = t.translated_text;
    },

    updateWithTranslation: function(t) {
        // this.id = t.id;
        // this.requestId = t.request_id;
        // this.result = t.translated_text;

        this.result = t;
    },

    swapLanguages: function() {
        var source = this.source;
        var target = this.target;

        this.setSource(target);
        this.setTarget(source);

        $.cookie("source", target);
        $.cookie("target", source);
    },

    // Sometimes we want to update the textarea, sometimes now.
    // The 'updateText' parameter indicates whether we want to do that. However,
    // this meant to be a temporary solution.
    invalidateUI: function(updateText) {
        updateText = typeof updateText !== 'undefined' ? updateText : true;

        $("select[name=sl]").val(this.source);
        $("select[name=il]").val(this.intermediate);
        $("select[name=tl]").val(this.target);

        if (updateText) {
            $("#text").val(this.text);
        }

        if (this.result) {

            $("#result").html(extractSentences(this.result));

        }
    },


    serialize: function() {
        this.update();

        return {
            source: this.source,
            intermediate: this.intermediate,
            target: this.target,
            text: this.text,
            result: this.result
        };
    }
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
    return "".concat(
            $.map(raw[0], (function(v) { return v[0]; }))
        );
}

function _performTranslation() {

    // Function currying
    // Rationale: It would be almost impossible to get the value of 'target' unless it
    // is declared as a global variable, which I do not believe it is a good practice in general
    var onSuccess = function(target) {
        return function(response) {
            if (!response) {
                displayError("sendTranslationRequest(): response body is null.",
                    null);
            }
            else if (String(response).substring(0, 1) == "<") {
                showCaptcha(response);
            }
            else {
                // FIXME: Potential security vulnerability
                // state.result = eval(response);
                state.result = (new Function('return ' + response))();

                // detected source language
                var source = state.result[2];

                uploadRawCorpora(source, target, JSON.stringify(state.result));
            }
        };
    };

    var onAlways = function() {
        $("#progress-message").hide();
        enableControls(true);

        // This must be called after enableControls()
        state.invalidateUI(false);

        state.pending = false;
    };

    if (state.pending) {
        // If there is any pending translation request,
        // silently abort the request.
        return false;
    }

    state.update();

    if (state.source == state.target) {
        // simply displays the original text when the source language and
        // the target language are identical
        state.setResult(state.text);
    }
    else if (state.source == "" || state.target == "") {
         // TODO: Give some warning
    }
    else if (state.text == null || state.text == "") {
         // TODO: Give some warning
    }
    else {
        // translates if the source language and the target language are not
        // identical

        hideError();
        $("#result").empty();
        $("#progress-message").show();

        enableControls(false);
        hideAuxInfo();

        state.pending = true;

        if (state.intermediate) {

            sendTranslationRequest(state.source, state.intermediate, state.text, function(response) {

                onSuccess(state.intermediate)(response);

                // Delay for a random interval (0.5-1.5 sec)
                var delay = 500 + Math.random() * 1000;

                setTimeout(function() {
                    state.pending = true;
                    sendTranslationRequest(state.intermediate, state.target,
                        extractSentences(state.result),
                        onSuccess(state.target),
                        onAlways
                    );
                }, delay);

            }, function() {
                state.invalidateUI();
                $("#progress-message").show();
            });
        }
        else {
            sendTranslationRequest(state.source, state.target, state.text,
                onSuccess(state.target), onAlways);
        }

    }

    return false;
}

function uploadRawCorpora(source, target, raw) {
    $.post("/corpus/raw", {sl:source, tl:target, raw:raw});
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

        // If a translation record is not newly loaded
        if (serial != state.serial) {
            fetchTranslation(serial);
        }

        state.serial = serial;
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

window.onload = function() {
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
    if (state.id) {
        //askForRating(state.requestId);
    }
    else {
        if (getParameterByName("t")) {
            state.initWithParameters();
            //performTranslation();
        }
        else {
            state.init();
            hashChanged(window.location.hash ? window.location.hash : "");
        }
    }

    $("#source-text, #target-text").autoResize({
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
        state.text = $("#text").val();
        if (event.keyCode == 13) {
            performTranslation();
        }
    })
    .trigger("change");

    frontend.model = new Model();
    frontend.bindingView = new BindingView({model: frontend.model});

    // Dynamically set the available languages
    $.get('http://localhost:8001/api/v1.0/languages?locale=ko', function(response) {
      var languages = $.map(response, function(value, key) {
        return {label: value, value: key};
      });
      frontend.model.set('languages', languages);
      frontend.model.set('sourceLanguage', 'en');
      frontend.model.set('targetLanguage', 'ko');
    });


};
window.onpopstate = function(event) {
    if (event.state != null) {
        state.initWithState(event.state);
    }
};

function performTranslation() {
  getRequestParameters();

  return false;
}

/**
 * Sends a request to the BT server in order to get all request parameters to
 * be sent to the Google Translate server
 */
function getRequestParameters() {
  $.get('http://localhost:8001/api/v1.3/params',
    {'text':frontend.model.get('sourceText'), 'source':'en', 'target':'ko'},
    function(response) {
      sendTranslationRequest(
        frontend.model.get('sourceLanguage'),
        frontend.model.get('targetLanguage'),
        frontend.model.get('sourceText'),
        response, // request parameters
        null,
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
 * @param {function} onAlways - A callback function that will be called regardless of the result
 */
function sendTranslationRequest(source, target, text, requestParams, onSuccess, onAlways) {

    // Use GET for short requests and POST for long requests
    var encodedText = encodeURIComponent(text)
    var textLength = encodedText.length;

    var uri = parseURI(requestParams.url + '?' + requestParams.query);

    var http = require('http');
    var options = {
      host: uri.host,
      // host: 'localhost',
      // port: 8080,
      path: uri.relative, // path + query
      // port: uri.port,
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
        // FIXME: Potential security issues
        frontend.model.set('raw', eval(buf));
        frontend.model.set('targetText', extractSentences(frontend.model.get('raw')));
      });
    }

    if (requestParams.method == 'post') {
      options.headers['Content-Length'] = textLength;
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
    }

    var request = http.request(options, callback);
    request.on('error', function(err) {
      console.log(err);
    });
    if (requestParams.method == 'post')
      request.write('q=' + encodedText);
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
