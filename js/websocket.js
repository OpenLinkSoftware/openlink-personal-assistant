/* ================================= WebSocket Event Handlers ================================= */
/**
 * Handles the WebSocket 'open' event.
 * Authenticates the chat session and resumes the current thread if applicable.
 * @param {Event} event - The WebSocket event.
 */
onOpen = function(event) {
    chatAuthenticate().then(() => {
        if (!apiKeyRequired || apiKey) {
            checkResumeThread().then(loadAssistants).then(() => loadConversation(currentThread));
        }
    });
};

/**
 * Handles the WebSocket 'message' event.
 * Reads and processes incoming messages from the server.
 * @param {Event} event - The WebSocket event.
 */
onMessage = function(event) {
    readMessage(event.data);
};

/**
 * Handles the WebSocket 'error' event.
 * Sends an error message to the user and closes the WebSocket connection.
 * @param {Event} event - The WebSocket event.
 */
onError = function(event) {
    showFailureNotice('Error connecting to the server.');
    $('.loader').hide(); // Hide the loader
    webSocket.close(); // Close the WebSocket connection
};

/**
 * Handles the WebSocket 'close' event.
 * Sends a message indicating the connection was closed and updates the UI.
 * @param {Event} event - The WebSocket event.
 */
onClose = function(event) {
    showFailureNotice('Connection to the server closed.');
    $('.loader').hide(); // Hide the loader
    $('#user-input-textbox').hide(); // Hide the user input textbox
    $('.continue-button-group').hide();
    $('.reconnect-button-group').show(); // Show the reconnect button group
};
