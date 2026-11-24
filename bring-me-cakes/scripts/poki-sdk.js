/**
 * Universal Offline Poki SDK & Sitelock Immunizer v2.2 Complete
 * - Bypasses all Poki Sitelocks (eval, atob, location redirects)
 * - Auto-rewrites root-relative URLs (/assets/...) to relative paths
 * - Emulates Unity Poki Bridge and ads events
 */
(function() {
    'use strict';

    // 1. SITELOCK IMMUNIZER (Hook atob & eval)
    var origAtob = window.atob;
    window.atob = function(str) {
        if (typeof str === 'string') {
            if (str.indexOf('aHR0cHM6Ly9wb2tpLmNvbS9zaXRlbG9jaw') !== -1 || str.indexOf('sitelock') !== -1) {
                console.log('[Offline PokiSDK] Sitelock payload neutralized in atob');
                return 'javascript:void(0)';
            }
        }
        return origAtob.apply(this, arguments);
    };

    var origEval = window.eval;
    window.eval = function(str) {
        if (typeof str === 'string' && (str.indexOf('aHR0cHM6Ly9wb2tpLmNvbS9zaXRlbG9jaw') !== -1 || str.indexOf('sitelock') !== -1)) {
            console.log('[Offline PokiSDK] Sitelock code neutralized in eval');
            return;
        }
        return origEval.apply(this, arguments);
    };

    // 2. ROOT-RELATIVE PATH REWRITER (/assets/... -> ./assets/...)
    var origXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
            url = '.' + url;
        }
        return origXhrOpen.apply(this, [method, url].concat(Array.prototype.slice.call(arguments, 2)));
    };

    if (window.fetch) {
        var origFetch = window.fetch;
        window.fetch = function(input, init) {
            if (typeof input === 'string' && input.startsWith('/') && !input.startsWith('//')) {
                input = '.' + input;
            }
            return origFetch.apply(this, arguments);
        };
    }

    // 3. UNITY POKI BRIDGE STUB
    var bridgeName = null;
    window.initPokiBridge = function(e) {
        bridgeName = e;
        console.log('[Offline PokiSDK] initPokiBridge:', e);
        function sendReady() {
            var g = window.unityInstance || window.unityGame;
            if (g) {
                try { g.SendMessage(e, "ready"); } catch(err) {}
            } else {
                setTimeout(sendReady, 50);
            }
        }
        sendReady();
    };

    function notifyBridge(event) {
        if (bridgeName) {
            var g = window.unityInstance || window.unityGame;
            if (g) {
                try { g.SendMessage(bridgeName, event); } catch(err) {}
            }
        }
    }

    // 4. FULL FEATURED POKISDK EMULATOR WITH PROXY CATCH-ALL
    var basePokiSDK = {
        init: function() {
            return Promise.resolve(true);
        },
        initWithVideoHB: function() {
            return Promise.resolve(true);
        },
        customEvent: function() {},
        commercialBreak: function(fn) {
            notifyBridge("commercialBreakCompleted");
            if (typeof fn === 'function') fn();
            return Promise.resolve(true);
        },
        rewardedBreak: function(fn) {
            notifyBridge("rewardedBreakCompleted");
            if (typeof fn === 'function') fn(true);
            return Promise.resolve(true);
        },
        displayAd: function(e, t, n, fn) {
            if (typeof fn === 'function') fn();
        },
        destroyAd: function() {},
        getLeaderboard: function() {
            return Promise.resolve({ scores: [] });
        },
        shareableURL: function(params) {
            return Promise.resolve(window.location.href);
        },
        getURLParam: function(name) {
            return null;
        },
        getUser: function() {
            return Promise.resolve({ id: 'guest', name: 'Guest' });
        },
        getToken: function() {
            return Promise.resolve('guest-token');
        },
        login: function() {
            return Promise.resolve({ id: 'guest', name: 'Guest' });
        },
        gameLoadingStart: function() {
            console.log('[Offline PokiSDK] gameLoadingStart');
        },
        gameLoadingFinished: function() {
            console.log('[Offline PokiSDK] gameLoadingFinished');
        },
        gameLoadingProgress: function(data) {
            console.log('[Offline PokiSDK] gameLoadingProgress:', data);
        },
        gameplayStart: function() {
            console.log('[Offline PokiSDK] gameplayStart');
        },
        gameplayStop: function() {
            console.log('[Offline PokiSDK] gameplayStop');
        },
        roundStart: function() {
            console.log('[Offline PokiSDK] roundStart');
        },
        roundEnd: function() {
            console.log('[Offline PokiSDK] roundEnd');
        },
        happyHour: function() {
            console.log('[Offline PokiSDK] happyHour');
        },
        muteAd: function() {},
        preInit: function(fn) {
            if (typeof fn === 'function') fn();
        },
        setDebug: function(val) {}
    };

    var pokiProxy = new Proxy(basePokiSDK, {
        get: function(target, prop) {
            if (prop in target) {
                return target[prop];
            }
            return function() {
                console.log('[Offline PokiSDK] Fallback method called:', prop);
                return Promise.resolve(true);
            };
        }
    });

    window.PokiSDK = pokiProxy;

    // 5. POPUP AND NAVIGATION SHIELD
    window.open = function() {
        console.log('[Offline PokiSDK] Intercepted window.open');
        return null;
    };

    console.log('[Offline PokiSDK v2.2] Initialized successfully');
})();
