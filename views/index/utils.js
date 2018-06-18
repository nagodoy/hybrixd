var fetch_ = fetch;

var BALANCE_UPDATE_BUFFER_TIME_MS = 300000;
var KEY_MAPPING = {
  '0': 'O',
  '1': 'I',
  '8': 'B',
  '9': 'G'
};

utils = {
  documentReady: function (fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      document.attachEvent('onreadystatechange', function () {
        if (document.readyState !== 'loading') {
          fn();
        }
      });
    }
  },
  // activate (deterministic) code from a string
  activate: function (code) {
    if (typeof code === 'string') {
      eval('var deterministic = (function(){})(); ' + code); // interpret deterministic library into an object
      return deterministic;
    } else {
      console.log('Cannot activate deterministic code!');
      return function () {};
    }
  },
  normalizeUserInput: function (str) {
    return mapReplaceEntries(KEY_MAPPING)(str);
  },
  scrollToAnchor: function (args) {
    var element = R.prop('element', args);
    if (R.not(R.isNil(element))) {
      window.scrollTo({
        top: document.querySelector('#' + element).offsetTop - 250,
        behavior: 'smooth'
      });
    }
  },
  triggerEvent: function (el, type) {
    if ('createEvent' in document) {
      // modern browsers, IE9+
      var e = document.createEvent('HTMLEvents');
      e.initEvent(type, false, true);
      el.dispatchEvent(e);
    } else {
      // IE 8
      var newEvent = document.createEventObject();
      newEvent.eventType = type;
      el.fireEvent('on' + newEvent.eventType, newEvent);
    }
  },
  fetchDataFromUrl: function (url, errStr) {
    return fetch_(url)
      .then(r => r.json()
        .then(r => r)
        .catch(e => console.log(errStr, e)))
      .catch(e => console.log(errStr, e));
  },
  getCurrentTime: function () {
    var currentTime = new Date();
    return currentTime.getTime();
  },
  addIcon: function (asset) {
    return R.compose(
      R.assoc('icon', R.__, asset),
      mkIcon,
      function (id) { return id.slice(id.indexOf('.') + 1); },
      R.prop('id')
    )(asset);
  },
  getGlobalAssets: function () {
    return GL.assets;
  },
  // TODO: Ref to getGlobalAssets --> Move all functions outside of object and make new object that refs outside functions.
  findAsset: function (assetID) {
    return R.find(
      R.compose(
        R.equals(assetID),
        R.prop('id')
      ),
      (function () {
        return GL.assets;
      }())
    );
  },
  updateGlobalAssets: function (a) {
    GL.assets = a;
  },
  getTargetValue: function (e) {
    return e.target.value;
  },
  splitAtDot: function (s) {
    return s.split('.');
  },
  mkUpdatedAssets: function (details) {
    return function (assets, asset) {
      var assetOrUpdatedDetails = R.equals(R.prop('id', asset), R.prop('id', details))
        ? R.merge(asset, details)
        : asset;
      return R.append(assetOrUpdatedDetails, assets);
    };
  },
  retrieveBalance: function (fn, numberOfSignificantDigits, classStr) {
    return function (asset) {
      var assetID = R.prop('id', asset);
      var assetAddress = R.prop('address', asset);
      var currentBalance = R.path(['balance', 'amount'], asset);
      var hypenizedID = assetID.replace(/\./g, '-');
      var element = classStr + hypenizedID;
      var url = 'a/' + assetID + '/balance/' + assetAddress;

      var balanceStream = H.mkHybriddCallStream(url)
        .map(data => {
          if (R.isNil(R.prop('stopped', data)) && R.prop('progress', data) < 1) throw data;
          return data;
        })
        .retryWhen(function (errors) { return errors.delay(1000); })
        .map(function (balanceData) {
          var lastTxTime = R.path(['balance', 'lastTx'], asset);
          var currentTime = Date.now();

          return currentTime > lastTxTime + BALANCE_UPDATE_BUFFER_TIME_MS
            ? balanceData
            : { data: currentBalance };
        });

      balanceStream.subscribe(function (balanceData) {
        var currentBalance = R.path(['balance', 'amount'], asset);
        var sanitizedData = R.compose(
          R.defaultTo('n/a'),
          R.prop('data'),
          sanitizeServerObject
        )(balanceData);
        var newBalance = lastKnownOrNewBalance(sanitizedData, currentBalance);

        fn(element, numberOfSignificantDigits, newBalance, assetID);
      });
    };
  },
  setViewTab: function (target) {
    document.querySelectorAll('.pure-menu-link').forEach(function (elem) {
      elem.classList.remove('selected');
    });
    document.querySelector('#topmenu-' + target).classList.add('selected');
  },

  btnIsNotDisabled: function (e) { return !e.target.parentElement.classList.contains('disabled'); },

  formatFloatInHtmlStr: function (amount, maxLengthSignificantDigits) {
    var normalizedAmount = Number(amount);

    function regularOrZeroedBalance (maxLen, balanceStr) {
      var balance = balanceStr.replace(/([0-9]+(\.[0-9]+[1-9])?)(\.?0+$)/, '$1');
      return R.contains('.', balance)
        ? formatStringWithDecimal(balance, maxLen)
        : balance;
    }

    function formatStringWithDecimal (balance, maxLen) {
      var decimalNumberString = balance.split('.');
      return R.equals(R.take(2, balance), '0.') ? formatBalanceBelowOne(maxLen, balance) : formatBalanceEqualOrGreaterThenOne(maxLen, balance);

      function formatBalanceEqualOrGreaterThenOne (maxLen, balance) {
        var first = balance.split('.')[0];
        var decimals = balance.split('.')[1];
        var emptyOrBalanceEndHtmlStr = decimals.length <= maxLen ? '' : '<span class="balance-end mini-balance">&hellip;</span>';
        return first + '.' + R.take(maxLen, decimals) + emptyOrBalanceEndHtmlStr;
      }

      function formatBalanceBelowOne (maxLen, balance) {
        var zeros = '0.' + R.compose(
          R.reduce(R.concat, ''),
          R.takeWhile(function (n) { return n === '0'; }),
          R.split(''),
          R.nth(1)
        )(decimalNumberString);
        var numbers = balance.replace(zeros, '');
        var emptyOrBalanceEndHtmlStr = numbers.length <= maxLen ? '' : '<span class="balance-end mini-balance">&hellip;</span>';
        var numbersFormatted = R.take(maxLen, numbers);
        return '<span class="mini-balance">' + zeros + '</span>' + numbersFormatted + emptyOrBalanceEndHtmlStr;
      }
    }

    function mkBalance (amount) {
      return R.compose(
        R.ifElse(
          R.equals('0'),
          R.always('0'),
          R.curry(regularOrZeroedBalance)(maxLengthSignificantDigits)
        ),
        function (n) { return n.toFixed(21); },
        toInt
      )(amount);
    }

    return R.isNil(normalizedAmount) || isNaN(normalizedAmount)
      ? 'n/a'
      : mkBalance(amount);
  },
  renderDataInDom: function (element, maxLengthSignificantDigits, data) {
    var formattedBalanceStr = U.formatFloatInHtmlStr(data, maxLengthSignificantDigits);
    renderElementInDom(element, formattedBalanceStr);
  }
};

fromInt = function (input, factor) {
  var f = Number(factor);
  var x = new Decimal(String(input));
  return x.times((f > 1 ? '0.' + new Array(f).join('0') : '') + '1');
};

toInt = function (input, factor) {
  var f = Number(factor);
  var x = new Decimal(String(input));
  return x.times('1' + (f > 1 ? new Array(f + 1).join('0') : ''));
};

/* TO BE DEPRECATED */
formatFloat = function (n) {
  return String(Number(n));
};

isToken = function (symbol) {
  return (symbol.indexOf('.') !== -1 ? 1 : 0);
};

progressbar = function (size) { return '<div class="progress-radial" proc-data=""' + (size > 0 ? ' style="font-size: ' + size + 'em;" size="' + size + '"' : '') + '><div class="dot" style="' + (size > 0 ? 'width:' + size + 'px;height:' + size + 'px;"' : 'width:1em;height:1em;overflow:visible;"') + '"></div><svg style="margin-left:-' + (size > 0 ? size + 'px' : '1em') + ';" viewbox="0 0 80 80" height="120" width="120"><circle cx="40" cy="40" r="35" fill="rgba(255,255,255,0.0)" stroke="#BBB" stroke-width="10" stroke-dasharray="239" stroke-dashoffset="239" /></svg></div>'; };

// creates a unique user storage key for storing information and settings
userStorageKey = function (key) {
  return nacl.to_hex(sha256(GL.usercrypto.user_keys.boxPk)) + '-' + String(key);
};

userEncode = function (data) {
  var nonce_salt = nacl.from_hex('F4E5D5C0B3A4FC83F4E5D5C0B3A4AC83F4E5D000B9A4FC83');
  var crypt_utf8 = nacl.encode_utf8(JSON.stringify(data));
  var crypt_bin = nacl.crypto_box(crypt_utf8, nonce_salt, GL.usercrypto.user_keys.boxPk, GL.usercrypto.user_keys.boxSk);
  return UrlBase64.safeCompress(nacl.to_hex(crypt_bin));
};

userDecode = function (data) {
  var object = null;
  if (data != null) {
    var nonce_salt = nacl.from_hex('F4E5D5C0B3A4FC83F4E5D5C0B3A4AC83F4E5D000B9A4FC83');
    var crypt_hex = nacl.from_hex(UrlBase64.safeDecompress(data));
    // use nacl to create a crypto box containing the data
    var crypt_bin = nacl.crypto_box_open(crypt_hex, nonce_salt, GL.usercrypto.user_keys.boxPk, GL.usercrypto.user_keys.boxSk);
    try {
      object = JSON.parse(nacl.decode_utf8(crypt_bin));
    } catch (err) {
      object = null;
    }
  }
  return object;
};

function sanitizeServerObject (res) {
  var emptyOrIdentityObject = R.merge({}, res);
  return R.compose(
    R.assoc('data', R.__, emptyOrIdentityObject),
    R.ifElse(
      R.equals(0),
      R.toString,
      R.identity
    ),
    R.when(
      R.anyPass([
        R.equals('?'),
        R.isNil
      ]),
      R.always('n/a')
    ),
    R.prop('data')
  )(emptyOrIdentityObject);
}

function renderElementInDom (query, data) {
  var element = document.querySelector(query);
  // HACK to prevent innerHTML of undefined error when switching views.
  if (R.not(R.isNil(element))) {
    document.querySelector(query).innerHTML = data;
  }
}

function mkSvgIcon (symbolName) {
  var firstLetterCapitalized = symbolName.slice(0, 1).toUpperCase();

  return '<svg width="50px" height="50px" viewBox="0 0 50 50" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"> <g id="Asset-view" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="Symbols" transform="translate(-367.000000, -248.000000)" fill-rule="nonzero" fill="#000000"> <g id="error" transform="translate(367.000000, 248.000000)"> <path d="M25.016,0.016 C38.8656595,0.016 50.016,11.1663405 50.016,25.016 C50.016,38.8656595 38.8656595,50.016 25.016,50.016 C11.1663405,50.016 0.016,38.8656595 0.016,25.016 C0.016,11.1663405 11.1663405,0.016 25.016,0.016 Z" id="Shape"></path> <text x="50%" y="72%" text-anchor="middle" fill="white" style="font-size: 30px; font-weight: 200;">' + firstLetterCapitalized + '</text> </g> </g> </g> </svg>';
}

mkIcon = function (symbol) {
  var Icons = black; // TODO: Factor up;

  return R.has(symbol, R.prop('svgs', Icons))
    ? R.path(['svgs', symbol], Icons)
    : mkSvgIcon(symbol);
};

mapReplaceEntries = function (map) {
  var keys = R.keys(map);
  var newMap = R.map(function (key) {
    return key.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
  }, keys);

  return function (str) {
    return str.replace(new RegExp(newMap.join('|'), 'g'), R.flip(R.prop)(map));
  };
};

function lastKnownOrNewBalance (newData, currentBalance) {
  var currentBalanceHasDefaultValue = R.not(isNaN(Number(currentBalance)));
  return newData === 'n/a' &&
    currentBalanceHasDefaultValue
    ? currentBalance
    : newData;
}