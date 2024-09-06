// Required
// TODO: Image upload + Enable high image resolution + Scale images setting
// TODO: Add session replay (session replay speed parameter as well) - set animation when getting permalink - set animation speed in sidebarv
// TODO: Comment/clean code and upload to github

// Bonus
// TODO: Add token statistic logging
// TODO: add default modules/functions
// TODO: assistant creation file upload
// TODO: Fix file upload overflow + File upload images depending on file type
// TODO: Highlight text as blue when copied

var pageUrl = new URL(window.location);
var targetHost = typeof(httpServer) != 'undefined' ? new URL(httpServer).host : pageUrl.host;
var getMessageText, sendMessage, onOpen, onMessage, onError, onClose, webSocket, readMessage;
var httpBase = 'https://' + targetHost;
var wsApiUrl = typeof(wsServer) != 'undefined' ? wsServer : 'wss://' + targetHost + '/ws/assistant';
var vadVersion = typeof(vad_version) != 'undefined' ? vad_version : '1.0';
var authType = typeof(authenticationType) != 'undefined' ? authenticationType : 'DPoP';
var authClient = solidClientAuthentication.default;
var wsUrl = new URL(wsApiUrl); /* WebSockets endpoint */
var currentThread = null;
var currentRunId = undefined;
var currentAssistant = undefined;
var currentAssistantName = undefined;
var currentModel = undefined;
var temperature = 0.2;
var top_p = 0.5;
var max_tokens = 4096;
var max_threads = 500;
var receivingMessage = null; /* this is not null when receiving response, keeps object which present current answer */
var enabledFunctions = [];
var markdown_content = '';
var loggedIn = false;
var apiKeyRequired = true;
var apiKey = null;
var session = authClient.getDefaultSession();
var pageParams = new URLSearchParams(pageUrl.search);
var importedSession = undefined;
var sharedSession = pageParams.get('share_id');
var sharedSessionAnimation = parseInt(pageParams.get('t')) || 0;
var sharedItem = pageUrl.hash;
let mediaRecorder = undefined;
let recodingTimeout = null;
var storageFolder = null;
var logoutOnError = false;
var chatSessionTimeoutMsec = typeof (chatSessionTimeout) != 'undefined' ? chatSessionTimeout * 1000 : -1;
var animate_session = parseInt(pageParams.get('t')) || 0;
var assistants = [];
var models = [];
var availableFunctions = [];
var vectorStores = null;
var fileSearch = false;
var toolsAuth = undefined;
var vectorStoresCache = [];

// DOMContentLoaded Event Listener
document.addEventListener("DOMContentLoaded", function() {
    // UI Initialization and Event Handlers
    initUI();
    
    // Init logic to handle files uploads
    initFiles();

    // Initialization of Authentication Event Handlers
    initAuthentication();
    initAuthDialog();
    $('#vad_version').html(vadVersion);
    
    $(document).on('keydown', function(e) {
        if (e.keyCode === 27) {
            $('.modal').hide();
        }
    });
    $('[data-toggle="tooltip"]').tooltip({container: 'body'});
});
