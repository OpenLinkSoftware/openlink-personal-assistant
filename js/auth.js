/**
 * Initializes the authentication process.
 */
function initAuthentication() {
    // Authentication Handler
    let url = new URL(window.location.href);
    let params = new URLSearchParams(url.search);
    let restore = !params.has('share_id');
    if (restore) {
        url.hash = '';
    }

    if (null != sharedSession) {
        loadShare(sharedSession);
        $('#user-input-textbox').hide();
        $('.continue-button-group').show();
    } else {
        $('.continue-button-group').hide();
    }

    authClient.handleIncomingRedirect({url: url.toString(), restorePreviousSession: restore}).then ((info) => {
        loggedIn = info?.isLoggedIn ? info.isLoggedIn : false;
        $('.login-button').toggleClass('hidden', loggedIn);
        $('.logout-button').toggleClass('hidden', !loggedIn);
        updateLoginState();
    }).catch ((e) => { showFailureNotice ('Failed to restore session: '+e); });

    $('.continue-button').click(function (e) {
        let url = new URL(window.location.href);
        let params = new URLSearchParams(url.search);
        let share_id = params.get('share_id');
        localStorage.setItem ('openlinksw.com:opal:copy:share_id', share_id);
        url.search = '';
        url.hash = '';
        authClient.login({
                oidcIssuer: httpBase,
                redirectUrl: url.toString(),
                tokenType: authType,
                clientName: 'OpenLink Personal Assistant'
        });
    });

    $('.reconnect-button').click(function (e) {
        webSocket = new WebSocket(wsUrl.toString());
        sendMessage(undefined, 'Connected', undefined, undefined);
        webSocket.onopen = onOpen;
        webSocket.onmessage = onMessage;
        webSocket.onerror = onError;
        webSocket.onclose = onClose;
        $('#user-input-textbox').show();
        $('.reconenct-button-group').hide();
    });
}

/**
 * Handles the login process using the authentication client.
 */
async function authLogin() {
    let url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    authClient.login({
         oidcIssuer: httpBase,
         redirectUrl: url.toString(),
         tokenType: authType,
         clientName: 'OpenLink Personal Assistant'
    });
}

/**
 * Handles the logout process using the authentication client.
 */
async function authLogout() {
    let url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    await authClient.logout();
    ['openlinksw.com:opal:gpt-api-key', 'openlinksw.com:opal:copy:share_id'].forEach(key => localStorage.removeItem(key));
    location.replace(url.toString());
}

/**
 * Authenticates a chat session by making an API call.
 * If an API key is required, it retrieves the key from local storage and displays a modal if the key is missing.
 * Handles errors by setting a logout flag and displaying an alert.
 */
async function chatAuthenticate() {
    try {
        let url = new URL('/chat/api/chatAuthenticate', httpBase);
        url.search = new URLSearchParams({ session_id: session.info.sessionId }).toString();
        const resp = await authClient.fetch(url.toString());
        if (!resp.ok) throw new Error('Can not authenticate chat session ' + resp.statusText);
        $("#login-modal").hide();
        let obj = await resp.json();
        apiKeyRequired = obj.apiKeyRequired;

        if (apiKeyRequired) {
            apiKey = localStorage.getItem('openlinksw.com:opal:gpt-api-key');
            $('#api-key').val(apiKey);
            if (!apiKey || apiKey.length < 1) {
                $('#api-key-modal').show();
            }
        }
    } catch (e) {
        logoutOnError = true;
        showFailureNotice("Could not authenticate chat: " + e);
    }
}

/**
 * Updates the login state of the application.
 */
async function updateLoginState() {
    if (loggedIn) {
        let params = new URLSearchParams(wsUrl.search);
        params.append('sessionId',session.info.sessionId);
        wsUrl.search = params.toString();

        // Update user interface for logged-in state
        $('.uid').toggleClass('hidden')
            .attr('href', session.info.webId)
            .attr('title', session.info.webId)
            .tooltip({ container: 'body' });

        if (session.info.webId != null) {
            loadProfile(session.info.webId)
                .then(response => {
                    if (response && response.storage && response.storage.startsWith('https://') && response.isDav) {
                        storageFolder = response.storage;
                        $('#personal-storage-import-input').val(storageFolder);
                        $('#personal-storage-export-input').val(storageFolder);
                        storageFolder !== null && localStorage.setItem('openlinksw.com:opal:personal-storage', storageFolder);
                    }
                })
                .catch((err) => { console.log(err.toString()); });
        }

        $('#api-key-modal-btn').show(); // Show API key modal button

        await loadThreads();
        await loadModels();
        await loadFunctions();
  
        /* this connect only, the authentication is onOpen hook/chatAuthenticate */
        webSocket = new WebSocket(wsUrl.toString());
        webSocket.onopen = onOpen;
        webSocket.onmessage = onMessage;
        webSocket.onerror = onError;
        webSocket.onclose = onClose;
        if (chatSessionTimeoutMsec >= 10000) {
            setTimeout(function() {
                logoutOnError = true;
                showFailureNotice("Session has expired. You will need to re-authenticate in order to continue.")
            }, chatSessionTimeoutMsec);
        }
    }
}

/**
 * Checks if the API key is present and valid.
 * If not logged in, shows the login modal.
 * If the API key is required but missing, shows the API key modal.
 * @returns {boolean} - True if the API key is valid, false otherwise.
 */
function checkApiKey() {
    if (!loggedIn) {
        $("#login-modal").show();
        $('.loader').css('display', 'none');
        return;
    }

    apiKey = localStorage.getItem('openlinksw.com:opal:gpt-api-key');
    if (!apiKey && apiKeyRequired) {
        $('#api-key-modal').show();
        $('.loader').css('display', 'none');
        return false;
    }
    return true;
}
