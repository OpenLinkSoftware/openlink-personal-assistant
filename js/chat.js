/* ================================= Thread Loading and Display ================================= */

// Initialize markdown-it
var md = window.markdownit({
    html: false,
    breaks: true,
    linkify: true,
    langPrefix: 'language-',
    highlight: function (str, lang) {
        const dropdown = '<select class="code-type">' +
            '<option id="none" selected></option>' +
            '<option id="turtle">RDF-Turtle</option>' +
            '<option id="jsonld">JSON-LD</option>' +
            '<option id="json">JSON</option>' +
            '<option id="csv">CSV</option>' +
            '<option id="rdfxml">RDF/XML</option>' +
            '<option id="markdown">Markdown</option>' +
            '<option id="rss">RSS</option>' +
            '<option id="atom">Atom</option>' +
            '</select>';

        const dropdownLabel = '<span class="code-type">Data format:</span>';

        const download_btn = '<button class="code-button download"><img src="svg/download.svg"/></button>';
        const copy_btn = '<button class="code-button clipboard"><img src="svg/clipboard.svg"/></button>';

        if (lang && hljs.getLanguage(lang)) {
            try {
                return '<div class="code-container">' +
                    '<div class="code-header">' + dropdownLabel + dropdown +
                    '<div class="code-buttons">' + download_btn + copy_btn + '</div></div>' +
                    '<pre class="hljs"><code><div class="nano_start"></div>' +
                    hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                    '<div class="nano_end"></div></code></pre></div>';
            } catch (__) {}
        }
        return '<div class="code-container">' +
            '<div class="code-header">' + dropdownLabel + dropdown +
            '<div class="code-buttons">' + download_btn + copy_btn + '</div></div>' +
            '<pre class="hljs"><code><div class="nano_start"></div>' +
            md.utils.escapeHtml(str) +
            '<div class="nano_end"></div></code></pre></div>';
    }
});

// Custom table render rules
md.renderer.rules.table_open = function() {
    return '<table class="styled-table">';
};

md.renderer.rules.table_close = function() {
    return '</table>';
};

var accumulatedMessage = '';
var lastReadMessageId = null;
var currentModel = $('#modelsDropdown .models-dropdown-text').text().trim();

/**
 * Loads threads and displays them in the dropdown.
 * @param {string} type - The type of threads to load (default is 'user').
 */
async function loadThreads(type = 'user') {
    if (!loggedIn) return; // Exit if not logged in
    $('.loader').css('display', 'block'); // Show loader

    try {
        // Construct URL with query parameters
        const url = new URL('/chat/api/threads', httpBase);
        url.search = new URLSearchParams({ chat_type: type, n: 50 }).toString();

        const resp = await authClient.fetch(url.toString()); // Fetch chat list

        if (resp.status === 200) { // Check response status
            const threads = await resp.json(); // Parse JSON response
            displayThreadsInDropdown(threads); // Display chats
        } else {
            showFailureNotice(`Loading threads failed: ${resp.statusText}`); // Show error message
        }
    } catch (e) {
        showFailureNotice(`Loading threads failed: ${e}`); // Show error message
    } finally {
        $('.loader').css('display', 'none'); // Hide loader
    }
}

/**
 * Displays chat topics in the dropdown menu.
 * @param {Array} threads - List of threads to display.
 */
function displayThreadsInDropdown(threads) {
    const $dropdownMenu = $('.threads-dropdown-menu');
    $dropdownMenu.empty(); // Clear existing items

    // Reverse the chat topics array
    const reversedThreads = [...threads].reverse();

    if (threads.length && !currentThread) {
        currentThread = threads[0].id;
        $('.threads-dropdown-text').text(threads[0].title ? threads[0].title : threads[0].id);
    }

    // Append chat topics to the dropdown
    reversedThreads.forEach(thread => {
        addThreadsDropdownItem(thread.id, thread.title); // Add each thread to the dropdown
    });
}

async function checkResumeThread() {
    let resume = localStorage.getItem('openlinksw.com:opal:copy:share_id');
    let url = new URL('/chat/api/resumeThread', httpBase);
    let params = new URLSearchParams(url.search);
    params.append('share_id', resume);
    params.append('apiKey', apiKey ? apiKey : '');
    url.search = params.toString();
    if (!resume) {
        return;
    }
    $('.loader').css('display', 'block'); // Show loader
    try {
        const resp = await authClient.fetch (url.toString());
        if (resp.ok) {
            let thr = await resp.json();
            currentThread = thr.thread_id;
            $('.threads-dropdown-text').text(thr.title ? thr.title : thr.thread_id);
            addThreadsDropdownItem(thr.thread_id, thr.title);
        } else {
            throw new Error(resp.statusText);
        }
    } catch (e) {
        showFailureNotice('Resuming thread failed: ' + e);
    } finally {
        localStorage.removeItem('openlinksw.com:opal:copy:share_id');
        $('.loader').css('display', 'none'); // Hide loader
    }
}


/**
 * Loads a conversation based on the provided chat ID.
 * @param {string} thread_id - The ID of the chat to load.
 */
async function loadConversation(thread_id) {
    $('.loader').css('display', 'block'); // Show loader
    if (!checkApiKey()) return; // Check if API key is valid
    if (!thread_id) return; // No thread yet XXX: make new?

    let url = new URL('/chat/api/messages', httpBase);
    let params = new URLSearchParams(url.search);
    params.append('thread_id', thread_id);
    params.append('apiKey', apiKey ? apiKey : '');
    url.search = params.toString();

    try {
        const resp = await authClient.fetch(url.toString()); // Fetch conversation data
        if (resp.ok) {
            const list = await resp.json(); // Parse JSON response
            showConversation(list); // Display conversation
            currentThread = thread_id; // Update current chat ID
            setAssistant (currentAssistant, false);
            $('.chat-messages').animate({ scrollTop: $('.chat-messages').prop('scrollHeight') }, 300); // Auto-scroll
        } else {
            showFailureNotice(`Conversation failed to load: ${resp.statusText}`); // Show error message
        }
    } catch (e) {
        showFailureNotice(`Loading conversation failed: ${e}`); // Show error message
    } finally {
        $('.loader').css('display', 'none'); // Hide loader
    }
}

/**
 * Creates the HTML for a chat message.
 * 
 * @param {string} text - The message text.
 * @param {string} role - The role of the message ('user' or assistant name).
 * @param {string} message_id - The message id associated with the message.
 * @returns {jQuery} - The jQuery object containing the constructed message HTML.
 */
function createMessageHTML(text, role, message_id, assistant_id = null) {
    const assistant_name = getAssistantName(assistant_id);
    const formattedText = md.render(text); // Convert markdown to HTML
    const sender = assistant_name != null ? assistant_name : role;
    let cls = 'Function' === role ? 'funciton-debug' : '', hide = '';
    if ('Function' === role && !$('#enable_debug').is(':checked')) {
        hide = 'd-none';
    }

    // Create message container with associated message_id
    const $messageContainer = $('<div>', { class: `chat-message ${cls} ${hide}`, 'id': message_id, });

    // Create message header
    const $messageHeader = $('<div>', { class: 'message-header' })
        .append($('<p>', { class: `message-sender ${role}`, text: sender.replace(/^\w/, c => c.toUpperCase()) }))
        .append($('<div>', { class: 'message-icons' })
            .append($('<img>', { src: 'svg/link-2.svg', alt: 'Permalink', class: `message-permalink icon ${hide}` }))
            .append($('<img>', { src: 'svg/clipboard.svg', alt: 'Copy', class: 'message-copy icon' }))
            .append($('<img>', { src: 'svg/trash.svg', alt: 'Delete', class: `message-delete icon ${hide}` }))
        );

    // Create message body
    const $messageBody = $('<div>', { class: `message-body ${role}` }).html(formattedText); // Use html() to insert formatted text

    $messageBody.find('a').attr({
        target: '_blank',
        referrerpolicy: 'origin'
    });

    // Assemble message components
    $messageContainer.append($messageHeader).append($messageBody);

    return $messageContainer;
}

function createFileHTML(message_id, name, role, dataUrl = null) {
    // Create message container with associated message_id
    const $messageContainer = $('<div>', { class: 'chat-file-message', 'id': message_id });

    // Create message body
    const $messageBody = $('<div>', { class: `message-body ${role}` });

    // Check if dataUrl is null
    if (dataUrl) {
        // Create anchor element with name as text and dataUrl as href
        if ('image' === role) {
            const $img = $('<img>', { src: dataUrl, height: '128px', class: 'user-img-src' });
            const $zoom_in = $('<div class="user-img-zoom-in"><img src="svg/zoom-in.svg"/></div>');
            const $zoom_out = $('<div class="user-img-zoom-out"><img src="svg/zoom-out.svg"/></div>');
            $zoom_in.on('click', function (e) {
                  let $img = $(this).parent().find('.user-img-src');
                  let height = $img.height();
                  height += 50;
                  if (height >= 480) return;
                  $img.height(height);
              });
            $zoom_out.on('click', function (e) {
                  let $img = $(this).parent().find('.user-img-src');
                  let height = $img.height();
                  height -= 50;
                  if (height <= 120) return;
                  $img.height(height);
              });
            $messageBody.append($zoom_in);
            $messageBody.append($zoom_out);
            $messageBody.append($img);
        } else {
            const $link = $('<a>', {
                href: dataUrl,
                target: '_blank',
                text: name,
                referrerpolicy: 'origin'
            });
            // Append the link to the message body
            $messageBody.append($link);
        }
    } else {
        // Create a text node with name
        $messageBody.text(name);
    }

    // Assemble message components
    $messageContainer.append($messageBody);

    return $messageContainer;
}

/**
 * Displays a conversation from a list of message items.
 * 
 * @param {Array} items - List of message items to display.
 */
async function showConversation(items) {
    $('.loader').css('display', 'block'); // Show loader
    const $chatMessages = $('.chat-messages');
    $chatMessages.empty(); // Clear existing messages
    let _animate_session = 0;

    if (sharedSessionAnimation > 0 && !sharedItem.length) {
        _animate_session = sharedSessionAnimation;
    }

    for (const item of items) {

        if (sharedItem.length && '#'+item.id === sharedItem && sharedSessionAnimation > 0) {
            _animate_session = sharedSessionAnimation;
        }

        if (item.role === "info") {
            const run = item.run;
            if ('object' === typeof(run) && Array.isArray(run.tools)) {
                setFunctions(run.tools);
            }
            continue;
        }

        else if (item.role === "file") {
            let role = item.role;
            let message_id = item.id;
            let name = item.name;
            let dataUrl = item.dataUrl
            const $messageContainer = createFileHTML(message_id, name, role, dataUrl); // Create message HTML
            $chatMessages.append($messageContainer); // Append message to chat
        }

        else if (item.role === "image") {
            let role = item.role;
            let message_id = item.id;
            let name = item.name;
            let dataUrl = item.dataUrl
            const $messageContainer = createFileHTML(message_id, name, role, dataUrl); // Create message HTML
            $chatMessages.append($messageContainer); // Append message to chat
        }

        else {
            let role = item.role;
            let animate = (_animate_session > 0 && 'assistant' === role);
            let text = animate ? '' : item.text;
            text = text?.replace(/【[0-9:]+†[\w+\.-]+】/g, '');
            let message_id = item.id;
            let assistant_id = item.assistant_id;
            let $messageContainer = createMessageHTML(text, role, message_id, assistant_id); // Create message HTML
            $chatMessages.append($messageContainer); // Append message to chat
            if (animate) { // Animate like teletype the assistant streaming reply
                let $messageBody = $messageContainer.find('.message-body');
                let index = 0;
                let content = item.text.split(' ');
                for (index = 0; index < content.length; index++) {
                    $messageBody.html(md.render(content.slice(0, index + 1).join(' ')));
                    await new Promise(r => setTimeout(r, Math.random() * _animate_session));
                    if(-1 != content[index].indexOf('\n')) {
                        $('.chat-window').animate({ scrollTop: $('.chat-window').prop('scrollHeight') }, 300);
                    }
                }
                $messageBody.find('a').attr({ target: '_blank', referrerpolicy: 'origin' });
            }
            if (assistant_id) {
                currentAssistant = assistant_id;
            }
        }
    };

    // Scroll to the bottom of the chat
    if (sharedItem.length > 0 && $(sharedItem).length > 0 && !sharedSessionAnimation) {
        $('.chat-window').scrollTop($(sharedItem).offset().top - $('.top-content-wrapper').outerHeight());
        sharedItem = '';
    } else {
        $('.chat-window').animate({ scrollTop: $('.chat-window').prop('scrollHeight') }, 300);
    }
    $('.loader').css('display', 'none'); // Hide loader
}

/**
 * Adds a message to the chat window UI.
 * 
 * @param {string} message_id - The ID of the message.
 * @param {string} role - The role of the message ('user' or assistant name).
 * @param {string} text - The message text.
 * @param {string} [assistant_id=null] - The ID of the assistant (optional).
 */
function addMessageToUI(message_id, role, text, assistant_id = null) {
    const $messageContainer = createMessageHTML(text, role, message_id, assistant_id); // Create message HTML
    $('.chat-messages').append($messageContainer); // Append message to chat
    $('.chat-window').animate({ scrollTop: $('.chat-window').prop('scrollHeight') }, 300); // Scroll to the bottom
    return $messageContainer;
}

function addFileToUI(message_id, name, role, dataUrl = null) {
    let $messageContainer = undefined
    $messageContainer = createFileHTML(message_id, name, role, dataUrl); // Create message HTML
    $('.chat-messages').append($messageContainer); // Append message to chat
    $('.chat-window').animate({ scrollTop: $('.chat-window').prop('scrollHeight') }, 300); // Scroll to the bottom
}

/**
 * Handles user input, sends it to the server, and updates the UI.
 */
async function handleUserInput() {
    $('.loader').show();// Show loader
    if (!checkApiKey()) return; // Check if API key is valid

    const $textarea = $('#user-input');
    const text = $textarea.val().trim(); // Get and trim user input

    if (text === '') return; // Exit if input is empty

    if ($('.chat-messages').children().length === 0 && currentThread == null) {
        await createNewThread(); // Create a new thread if none exists
    }

    // Create a unique prompt ID
    const message_id = Math.random().toString(36).replace('0.', 'usr-');

    if (currentModel == undefined) {
        addMessageToUI(message_id, 'Assistant', "Cannot send message without model selected");
        $('.loader').hide();
        // Show error if no model is selected
        return;
    }

    if (currentAssistant == undefined) {
        addMessageToUI(message_id, 'Assistant', "Cannot send message without assistant selected");
        $('.loader').hide();
        // Show error if no assistant is selected
        return;
    }

    // Send the message to the server
    sendMessage(message_id, text); // Send the message

    // Display the user's message in the chat window
    addMessageToUI(message_id, 'User', text); // Add user's message to UI

    // Add file
    selectedFiles.forEach(fileObj => {
        const file = fileObj.data;
        const role = fileObj.type.startsWith('image/') ? "image" : "file";
        let dataUrl = null;
        if ('image' === role) {
            dataUrl = URL.createObjectURL(file);
        }
        addFileToUI(message_id, file.name, role, dataUrl)
    });

    // clear file list
    clearSelectedFiles();

    // Clear the input field
    $textarea.val(''); // Clear the input field
}

async function handleStop () {
    let url = new URL('/chat/api/threads', httpBase);
    let params = new URLSearchParams(url.search);
    params.append('thread_id', currentThread);
    params.append('run_id', currentRunId);
    params.append('apiKey', apiKey ? apiKey : '');
    params.append('ctl', 1);
    url.search = params.toString();
    try {
        const resp = authClient.fetch (url.toString());
        runStarted(false);
        currentRunId = undefined;
    } catch (e) {
        showFailureNotice('Stop failed: ' + e.message);
    }
}

/**
 * Sends a message to the server via WebSocket.
 * 
 * @param {string} prompt_id - The unique ID for the prompt.
 * @param {string} text - The message text.
 * @param {string} [thread_id=currentThread] - The ID of the current thread (optional).
 * @param {string} [assistant_id=currentAssistant] - The ID of the current assistant (optional).
 */
async function sendMessage(prompt_id, text, thread_id = currentThread, assistant_id = currentAssistant) {
    $('.loader').css('display', 'block'); // Show loader
    if (!checkApiKey()) return; // Check if API key is valid

    let images = selectedFiles.filter(f => f.type.startsWith('image/')).map(f => f.id);
    let image_resolution = 'low';
    let sqlFunctions = enabledFunctions.map(name => {
        const match = availableFunctions.find(item => item.name === name);
        return match ? match.function : null;
    }).filter(Boolean);

    if (webSocket.readyState === WebSocket.OPEN) {
        let request = {
            thread_id: thread_id,
            assistant_id: assistant_id,
            model: currentModel,
            prompt: text,
            prompt_id: prompt_id,
            apiKey: apiKey,
            temperature: temperature,
            top_p: top_p,
            images: images,
            image_resolution: image_resolution,
            max_tokens: max_tokens,
            functions: sqlFunctions,
            files: selectedFiles.filter(fileObj => !fileObj.type.startsWith('image/')).map(fileObj => fileObj.id),
        };
        webSocket.send(JSON.stringify(request)); // Send request via WebSocket
    } else {
        showFailureNotice('WebSocket is not open.'); // Log error if WebSocket is not open
    }
    $('.loader').css('display', 'none'); // Hide loader
}

/**
 * Reads and processes incoming messages from the WebSocket server.
 * @param {string} input - The incoming message data.
 */
function readMessage(input) {
    $('.loader').css('display', 'block'); // Show loader
    const obj = JSON.parse(input);
    let kind = obj.kind;
    let text = obj.data;
    let dataUrl = obj.data?.dataUrl;
    let name = obj.name;
    let assistant_id = currentAssistant;

    if (typeof(text) === 'object') {
        text = '';
    }

    if (dataUrl) {
        addFileToUI(messageId, name, "file", dataUrl);
    } else if ('function' === kind || 'tool' === kind) {
        let func_call = JSON.parse (text);
        let title = '**Function: ' + func_call.func_title + '** ('+ func_call.func + ')';
        let div = title + '\n*Arguments:*\n```json\n' + func_call.func_args + '\n```';
        addMessageToUI(obj.message_id, 'Function', div, assistant_id)
    } else if ('function_response' === kind) {
        addMessageToUI(obj.message_id, 'Function', '**Result:**\n```\n'+text+'\n```', assistant_id)
    } else if ('authentication' === kind) {
        toolsAuth = obj.data;
        $('#tool-auth-text').text(`Authorization required for "${toolsAuth.authOpts?.appName}" access`);
        if (-1 == toolsAuth.authOpts?.authType.indexOf('OAuth2') || !toolsAuth.authOpts?.auth_url) {
            $('#auth-api-type').prop('checked',true);
            $('#auth-api-key-inp').show();
        } else {
            $('#auth-api-type').prop('checked',false);
            $('#auth-api-key-inp').hide();
        }
        $('#auth-modal').modal('show');
    } else if ('info' === kind) {
        if (obj.data.run_id) {
            currentRunId = obj.data.run_id;
            runStarted(true);
        }
    } else if ('message_id' === kind) {
        $('#'+obj.prompt_id).attr('id', obj.message_id); // set user prompt id
    } else if (text === '[DONE]' || text === '[LENGTH]') {
        // End of the message
        runStarted(false);
        accumulatedMessage = ''; // Reset the accumulated message
        receivingMessage = null;
        currentRunId = undefined;
        $('.loader').css('display', 'none'); // Hide loader
        return;
    } else {
        lastReadMessageId = obj.message_id;
        accumulatedMessage += text;
        accumulatedMessage = accumulatedMessage.replace(/【[0-9:]+†[\w+\.-]+】/g, '');
        if (!receivingMessage) {
            let $container = addMessageToUI(obj.message_id, 'Assistant', accumulatedMessage, assistant_id);
            receivingMessage = $container.find('.message-body');
        } else {
            receivingMessage.html(md.render(accumulatedMessage));
            receivingMessage.find('a').attr({ target: '_blank', referrerpolicy: 'origin' });
        }
        if (-1 != text.indexOf('\n')) {
            $('.chat-window').animate({ scrollTop: $('.chat-window').prop('scrollHeight') }, 300);
        }
    }
}

/**
 * Deletes a message from the server and updates the UI.
 * @param {string} messageId - The ID of the message to delete.
 */
async function deleteMessage(messageId) {
    let url = new URL('/chat/api/messages', httpBase);
    let params = new URLSearchParams(url.search);
    apiKey = localStorage.getItem('openlinksw.com:opal:gpt-api-key');

    params.append('thread_id', currentThread);
    params.append('message_id', messageId);
    params.append('apiKey', apiKey ? apiKey : '');
    url.search = params.toString();
    $('.loader').show(); // Show loader

    try {
        let resp = await authClient.fetch(url.toString(), { method:'DELETE' });
        if (resp.status != 204) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err?.message || resp.statusText);
        }  else {
            removeChatMessageFromUI(messageId); // Remove message from UI
        }
    } catch (e) {
        showFailureNotice('Delete failed: ' + e); // Show error message
    }
    $('.loader').hide(); // Hide loader
}

/**
 * Removes a chat message from the UI.
 * @param {string} messageId - The ID of the message to remove.
 */
function removeChatMessageFromUI(messageId) {
    // Select the chat message container with the specified id
    const $message = $(`#${messageId}`);

    // Check if the message exists
    if ($message.length) {
        // Remove the specified chat message
        $message.remove();
    } else {
        showFailureNotice(`Message with ID ${messageId} not found`);
    }
}

/**
 * Copies the content of the message body to the clipboard.
 * @param {Element} messageBody - The message body element.
 */
function copyMessageToClipboard(messageBody) {
    $('.loader').css('display', 'block'); // Show loader
    const range = document.createRange();
    range.selectNodeContents(messageBody);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    try {
        document.execCommand('copy'); // Copy to clipboard
        selection.removeAllRanges();
        showSuccessNotice('Text copied');
    } catch (err) {
        showFailureNotice('Failed to copy text: ', err); // Log error if copy fails
    } finally {
        $('.loader').css('display', 'none'); // Hide loader
    }
}

/**
 * Copies all chat messages currently displayed on the screen to the clipboard.
 */
function copyAllMessagesToClipboard() {
    $('.loader').css('display', 'block'); // Show loader
    const messages = $('.chat-message');
    let allMessagesText = '';

    messages.each(function() {
        const $messageHeader = $(this).find('.message-header').text();
        const $messageBody = $(this).find('.message-body').text();
        allMessagesText += $messageHeader + ':\n' + $messageBody + '\n';
    });

    // Create a temporary textarea element to copy the text to the clipboard
    const $tempTextArea = $('<textarea>');
    $tempTextArea.text(allMessagesText);
    $('body').append($tempTextArea);

    $tempTextArea.select();
    try {
        document.execCommand('copy'); // Copy to clipboard
        showSuccessNotice('All messages copied')
    } catch (err) {
        showFailureNotice('Failed to copy text: ', err); // Log error if copy fails
    } finally {
        $('.loader').css('display', 'none'); // Hide loader
    }
    $tempTextArea.remove(); // Remove temporary textarea
}

/**
 * Starts a new chat session.
 * 
 * @async
 * @function createNewThread
 */
async function createNewThread(thread = null) {
    $('.loader').css('display', 'block'); // Show loader
    apiKey = localStorage.getItem('openlinksw.com:opal:gpt-api-key');

    if (!thread) {
        $('.chat-messages').empty(); // Clear chat elements

        try {
            let url = new URL('/chat/api/threads', httpBase); // Create URL for the API call
            let params = new URLSearchParams(url.search);
            params.append('apiKey', apiKey ? apiKey : '');
            url.search = params.toString();
    
            const resp = await authClient.fetch(url.toString(), { method: 'POST' }); // Make the API call with POST method
    
            if (resp.ok) {
                let thread_id = await resp.text(); // Get the thread ID from the response
                currentThread = thread_id; // Set the current thread ID
                $('.threads-dropdown-text').text(thread_id); // Update threads dropdown text
                addThreadsDropdownItem(thread_id); // Add the new thread to the threads dropdown
            } else {
                showFailureNotice('Cannot retrieve thread ID ' + resp.statusText); // Show an alert if the API call fails
            }
        } catch (e) {
            showFailureNotice('Cannot create new thread: ' + e); // Show an alert if there is an error
            return;
        } finally {
            $('.loader').css('display', 'none'); // Hide loader
        }
    } else {
        currentThread = thread.thread_id;
        $('.threads-dropdown-text').text(currentThread);
        addThreadsDropdownItem(thread.thread_id, thread.title);
        $('.loader').css('display', 'none'); // Hide loader
    }
}

/**
 * Adds a new item to the threads dropdown.
 * 
 * @async
 * @function addThreadsDropdownItem
 * @param {string} thread_id - The ID of the thread.
 * @param {string} [thread_title=null] - The title of the thread (optional).
 */
async function addThreadsDropdownItem(thread_id, thread_title = null) {
    const $item = $('<div>', {
        class: 'threads-dropdown-item',
        'data-chat-id': thread_id // Set the data-chat-id attribute to chat ID
    });

    const $text = $('<span>', {
        class: 'threads-dropdown-item-text',
        text: thread_title || thread_id, // Set the text to chat id or chat ID
    });

    const $moreButton = $('<img>', {
        class: 'threads-dropdown-item-more-button',
        src: 'svg/dots-horizontal.svg', // Set the source of the SVG icon
        alt: 'More' // Set alternative text for the icon
    });

    // Create the more options menu
    const $moreOptionsMenu = $('<div>', {
        class: 'threads-dropdown-item-actions'
    }).append(
        $('<div>', { text: 'Rename', class: 'action rename-chat' }),
        $('<div>', { text: 'Delete', class: 'action delete-chat' })
    );

    $moreButton.on('click', function(e) {
        e.stopPropagation(); // Prevent click event from bubbling up to the item
        $('.threads-dropdown-item-actions').hide(); // Hide any other open actions menus
        $moreOptionsMenu.css({
            top: $item.offset().top + 'px',
            left: $item.offset().left + $item.outerWidth() + 'px'
        }).toggle(); // Toggle visibility of the more options menu
        $item.addClass('hover');
    });

    // Append the text and more button to the item
    $item.append($text).append($moreButton);
    // Prepend or append based on position
    $item.prependTo('.threads-dropdown-menu');

    // Append the options menu to the body for proper positioning
    $('body').append($moreOptionsMenu);

    // Handle rename option click
    $moreOptionsMenu.on('click', '.rename-chat', function() {
        renameThreadsDropdownItem($item);
    });
  
    // Handle delete option click
    $moreOptionsMenu.on('click', '.delete-chat', function() {
        removeThreadsDropdownItem($item, $moreOptionsMenu);
    });
}

/**
 * Helper function to handle the deletion of a dropdown item.
 * 
 * @param {jQuery} $item - The jQuery object of the dropdown item.
 * @param {jQuery} $moreOptionsMenu - The jQuery object of the more options menu.
 */
function removeThreadsDropdownItem($item, $moreOptionsMenu) {
    const threadId = $item.data('chat-id');
    const itemText = $item.find('.threads-dropdown-item-text').text();
    if (confirm(`Are you sure you want to delete thread ${itemText}?`)) {
        // Perform delete operation (update the server and UI)
        deleteThread(threadId);
        $item.remove(); // Remove item from the DOM
        $moreOptionsMenu.remove(); // Remove the options menu from the DOM
        $('.threads-dropdown-text').text('Select a Thread');
        currentThread = undefined;
    }
    $moreOptionsMenu.hide(); // Hide the options menu after action
    $item.removeClass('hover');
}

/**
 * Helper function to delete a chat by its ID.
 * 
 * @param {string} thread_id - The ID of the chat to be deleted.
 */
async function deleteThread(thread_id) {
    apiKey = localStorage.getItem('openlinksw.com:opal:gpt-api-key');
    $('.loader').css('display', 'block'); // Show loader
    // Construct the URL for the DELETE request
    let url = new URL('/chat/api/threads', httpBase);
    let params = new URLSearchParams(url.search);
    params.append('thread_id', thread_id);
    params.append('apiKey', apiKey ? apiKey : '');
    url.search = params.toString();

    try {
        // Send the DELETE request to the server
        const resp = await authClient.fetch(url.toString(), { method:'DELETE' })
        $('.chat-messages').empty();

        // Check if the response status is not 204 (No Content)
        if (resp.status != 204) {
            showFailureNotice('Delete failed: ' + resp.statusText); // Alert if deletion failed
        }
    } catch (e) {
        showFailureNotice('Delete failed: ' + e); // Alert if there was an error during the request
    } finally {
        $('.loader').css('display', 'none'); // Hide loader
    }
}

/**
 * Helper function to handle renaming of a dropdown item.
 * 
 * @param {jQuery} $item - The jQuery object of the dropdown item.
 */
function renameThreadsDropdownItem($item) {
    const $text = $item.find('.threads-dropdown-item-text'); // Find the text span within the item
    const threadId = $item.data('chat-id');

    // Create an input element with the current text
    const $input = $('<input>', {
        type: 'text',
        class: 'threads-dropdown-item-edit',
        value: $text.text()
    });

    // Replace the text span with the input element
    $text.replaceWith($input);
    $input.focus(); // Automatically focus the input for user convenience

    // Function to save the new name and call renameChat
    const saveNewName = function() {
        const newName = $input.val(); // Get the new name from the input
        renameChat(threadId, newName); // Call renameChat with the new name
        $('.threads-dropdown-text').text(newName);

        // Replace the input element with the updated text span
        $input.replaceWith($text);
        $text.text(newName);
    };

    $input.on('click', function(e) {
        e.stopPropagation();
    });

    // Handle enter key to save the new name
    $input.on('keypress', function(e) {
        if (e.which === 13) { // Enter key pressed
            saveNewName();
            $('.threads-dropdown-item-actions').hide();
        }
    });
}

/**
 * Helper function to rename a chat by its ID.
 * 
 * @param {string} thread_id - The ID of the chat to be renamed.
 * @param {string} new_name - The new name for the chat.
 */
async function renameChat(thread_id, new_name) {
    // Construct the URL for the POST request
    let url = new URL('/chat/api/threads', httpBase);
    let params = new URLSearchParams(url.search);
    params.append('thread_id', thread_id);
    params.append('apiKey', apiKey ? apiKey : '');
    url.search = params.toString();

    currentModel = $('#modelsDropdown .models-dropdown-text').text().trim();

    try {
        // Send the POST request to the server with the new chat title and model
        const resp = await authClient.fetch(url.toString(), {
            method: 'POST',
            body: JSON.stringify({ title: new_name})
        });

        // Check if the response status is not OK (200)
        if (!resp.ok || resp.status != 200) {
            showFailureNotice('Rename failed: ' + resp.statusText); // Alert if renaming failed
        }
    } catch (e) {
        showFailureNotice('Rename failed: ' + e); // Alert if there was an error during the request
    }
}

/**
 * Copies the permalink of a thread or message to the clipboard.
 * 
 * @param {string} thread_id - The ID of the thread.
 * @param {string} [message_id=null] - The ID of the message (optional).
 */
async function copyLinkToClipboard(thread_id, message_id = null) {
    var tw = '';
    if (animate_session > 0) {
      tw = '&t='+animate_session;
    }

    $('.loader').css('display', 'block'); // Show loader
    if (typeof ClipboardItem != 'undefined') {
        const clipboardItem = new ClipboardItem({ 'text/plain': getPlink(thread_id, message_id).then((url) => {
            if (!url) {
                return new Promise(async (resolve) => {
                    resolve(new Blob([""], { type:'text/plain' }))
                })
            }
            return new Promise(async (resolve) => {
                resolve(new Blob([url + tw],{ type:'text/plain' }))
            })
        }),
        });
        navigator.clipboard.write([clipboardItem]).then(() => { showSuccessNotice('Permalink copied.'); },
                                                        () => { showFailureNotice('Permalink copy failed.'); },);

    }
    else if (navigator.clipboard.writeText != 'undefined') {
        getPlink(thread_id, message_id).then ((text) => {
            navigator.clipboard.writeText(text).then(() => { showSuccessNotice('Permalink copied.', 'success'); },
                                                     () => { showFailureNotice('Permalink copy failed.'); },);
        });
    } else {
        showFailureNotice('Browser does not support this function.');
    }
    $('.loader').css('display', 'none'); // Hide loader
}

/**
 * Generates a permalink for a thread or message.
 * 
 * @param {string} thread_id - The ID of the thread.
 * @param {string} [message_id=null] - The ID of the message (optional).
 * @returns {Promise<string>} - The permalink URL.
 */
async function getPlink(thread_id, message_id = null) {
    $('.loader').css('display', 'block'); // Show loader
    apiKey = localStorage.getItem('openlinksw.com:opal:gpt-api-key');
    let url = new URL('/chat/api/storeThread', httpBase);
    let params = new URLSearchParams(url.search);
    let hash = '';

    if (message_id) {
        hash = message_id;
    }

    params.append('thread_id', thread_id);
    if (message_id) {
        params.append('message_id', message_id);
    }
    params.append('apiKey', apiKey ? apiKey : '');
    url.search = params.toString();
    try {
        const resp = await authClient.fetch(url.toString());
        if (resp.ok) {
            let res_id = await resp.text();
            let linkUrl = new URL(pageUrl.toString());
            linkUrl.search = 'share_id=' + res_id;
            if (sharedSessionAnimation > 0) {
                linkUrl.search += '&t='+sharedSessionAnimation;
            }
            linkUrl.hash = hash;
            return linkUrl.toString();
        }
        showFailureNotice('Cannot get share link: ' + resp.statusText);
    } catch (e) {
        showFailureNotice('Cannot get Permalink: ' + e);
    } finally {
        $('.loader').css('display', 'none'); // Hide loader
    }
}

/**
 * Loads a shared conversation by its object ID.
 * 
 * @param {string} obj_id - The object ID of the shared conversation.
 */
async function loadShare(obj_id) {
    let url = new URL('/chat/api/loadThreadLink', httpBase);
    let params = new URLSearchParams(url.search);
    params.append('obj_id', obj_id);
    url.search = params.toString();
    if (!obj_id) {
        showFailureNotice('No object given');
        return;
    }
    $('.loader').show(); // Show loader
    await authClient.fetch (url.toString()).then((r) => {
        if (!r.ok) {
            return r.json().then(e => {
                throw new Error(`${e.error}: ${e.message}`);
            });
            throw new Error(r.statusText);
        }
        return r.json();
    }).then((data) => {
        showConversation(data);
    }).catch((e) => {
        showFailureNotice('Loading messages failed: ' + e);
    });
    $('.loader').hide(); // Hide loader
}

async function getVectorStoreFiles(id) {
    let url = new URL('/chat/api/vector_stores', httpBase);
    let params = new URLSearchParams(url.search);
    params.append('vector_store_id', id);
    params.append('filter', '*');
    params.append('limit', 50);
    params.append('apiKey', apiKey ? apiKey : '');
    url.search = params.toString();
    $('.loader').show();
    const fs = await authClient.fetch (url.toString()).then((r) => {
        if (!r.ok) {
            return r.json().then(e => {
                throw new Error(`${e.error}: ${e.message}`);
            });
            throw new Error(r.statusText);
        }
        return r.json();
    }).then((data) => {
        return data;
    }).catch((e) => {
        showFailureNotice('Loading vector stores failed: ' + e);
    });
    $('.loader').hide(); // Hide loader
    return fs;
}

/**
* Loads a vector store object by given id
*/
async function getVectorStore(id) {
    if (!id) {
        return undefined;
    }
    let vs = vectorStoresCache.find(store => store.id === id);
    if (typeof(vs) === 'object') {
        return vs;
    }
    let url = new URL('/chat/api/vector_stores', httpBase);
    let params = new URLSearchParams(url.search);
    params.append('vector_store_id', id);
    params.append('apiKey', apiKey ? apiKey : '');
    url.search = params.toString();
    $('.loader').show(); // Show loader
    vs = await authClient.fetch (url.toString()).then((r) => {
        if (!r.ok) {
            return r.json().then(e => {
                throw new Error(`${e.error}: ${e.message}`);
            });
            throw new Error(r.statusText);
        }
        return r.json();
    }).then((data) => {
        vectorStoresCache.push(data);
        return data;
    }).catch((e) => {
        showFailureNotice('Loading messages failed: ' + e);
        return undefined;
    });
    $('.loader').hide(); // Hide loader
    return vs;
}

/**
 * Loads the list of assistants and updates the UI.
 * 
 * @param {string} assistant_id - The ID of the assistant to set active.
 */
async function loadAssistants(assistant_id = null) {
    if (!loggedIn) return; // Exit if not logged in
    if (!checkApiKey()) return; // Check if API key is valid
    $('.loader').css('display', 'block'); // Show loader

    try {
        // Construct URL with query parameters
        const url = new URL('/chat/api/assistants', httpBase);
        url.search = new URLSearchParams({ detail: 1, apiKey: apiKey ? apiKey : '' }).toString();

        const resp = await authClient.fetch(url.toString()); // Fetch chat list

        if (resp.status === 200) { // Check response status
            assistants = await resp.json(); // Parse JSON response

            // Separate the default assistant from the rest
            const defaultAssistant = assistants.find(assistant => assistant.name === "Default");
            const newAssistant = assistants.find(assistant => assistant.id === assistant_id);
            const otherAssistants = assistants.filter(assistant => assistant.name !== "Default" && assistant.id !== assistant_id);            

            const $dropdownMenu = $('.assistants-dropdown-menu').empty()
                .append('<div class="assistants-dropdown-item create-assistant">Create new Assistant</div>')
                .append('<div class="assistants-dropdown-separator"></div>');

            const $dropdownText = $('.assistants-dropdown-text');

            if (assistants.length === 0) {
                $dropdownText.text('Create new Assistant');
            } else {
                // Add the default assistant first if it exists
                if (defaultAssistant) {
                    const $item = $('<div class="assistants-dropdown-item"></div>').text(defaultAssistant.name);
                    $item.on('click', function () {
                        $('.model-configuration-fields').show();
                        setAssistant(defaultAssistant.id);
                        $dropdownText.text("@Default");
                    });
                    $dropdownMenu.append($item);

                    $('.model-configuration-fields').show();
                    $('#close-assistant-configuration-btn').show();
                    setAssistant(defaultAssistant.id);
                    $dropdownText.text("@Default");
                }
                // Add newly created assistant
                if (newAssistant) {
                    const $item = $('<div class="assistants-dropdown-item"></div>').text(newAssistant.name);
                    setAssistant(newAssistant.id);
                    $item.on('click', function () {
                        $('.model-configuration-fields').show();
                        setAssistant(newAssistant.id);
                        $dropdownText.text("@" + newAssistant.name);
                    });
                    $dropdownMenu.append($item);
                }

                $('#file-search').on('click', function () {
                    fileSearch = $(this).is(':checked');
                });

                // Add the other assistants
                otherAssistants.forEach(assistant => {
                    const $item = $('<div class="assistants-dropdown-item"></div>').text(assistant.name);
                    $item.on('click', function () {
                        $('.model-configuration-fields').show();
                        setAssistant(assistant.id);
                        $dropdownText.text("@" + assistant.name);
                    });
                    $dropdownMenu.append($item);
                });
            }

            // Re-attach the click event handler for the create assistant item
            $dropdownMenu.find(".create-assistant").on("click", () => {
                clearAssistant();
            });
        } else {
            showFailureNotice(`Loading assistants failed: ${resp.statusText}`); // Show error message
        }
    } catch (e) {
        showFailureNotice(`Loading assistants failed: ${e}`); // Show error message
    } finally {
        $('.loader').css('display', 'none'); // Hide loader
    }
}

/**
 * Sets the current assistant based on the provided assistant ID.
 * 
 * @param {string} assistant_id - The ID of the assistant to set.
 */
async function setAssistant(assistant_id, initFunctionsList = true) {
    let item = assistants.find(obj => obj.id === assistant_id);
    if (!item) {
        return;
    }

    assistant_id = item.id;
    assistant_name = item.name;
    instructions = item.instructions;

    currentAssistant = assistant_id;
    currentAssistantName = assistant_name;

    $('.assistants-dropdown-text').text("@" + assistant_name);
    $('.assistants-dropdown-menu').hide();
    $('#assistant-name').val(assistant_name);
    $('.assistant-id').text(assistant_id);
    $('#instructions').text(instructions);
    $(".assistants-dropdown-menu").hide();

    setParameters(item);
    if (initFunctionsList) {
        setFunctions(item.tools);
    }
    setModel(item.model);
    const $fs = $('#file-search');
    const $vs = $('.vector-store');
    fileSearch = item.tools?.some(tool => tool.type === "file_search");
    $fs.prop('checked',fileSearch);
    if (fileSearch) {
        vectorStores = item.tool_resources?.file_search?.vector_store_ids;
        
    } else {
        vectorStores = null;
    }
    $vs.empty();
    $('#vs_id').val('');
    if (vectorStores && vectorStores.length > 0) {
        const vs = await getVectorStore(vectorStores[0]);
        $vs.append($(`<div class="vector-store-item"><div>${vs?.name}</div><div class="small">${vs?.id}</div></div>`));
        $('#vs_id').val(vs.id);
    } 
}

/**
 * Sets the parameters for the assistant.
 * 
 * @param {Object} item - The assistant configuration object.
 */
function setParameters(item) {
    if (item.max_tokens) max_tokens = item.max_tokens;
    if (item.max_threads) max_threads = item.max_threads;
    if (item.temperature) temperature = item.temperature;
    if (item.top_p) top_p = item.top_p;

    $('#temperature').val(temperature);
    $('#temperature_in').val(temperature);
    $('#top_p').val(top_p);
    $('#top_p_in').val(top_p);
    $('#max_tokens').val(max_tokens);
    $('#max_tokens_in').val(max_tokens);
    $('#max_threads').val(max_threads);
    $('#max_threads_in').val(max_threads);
}

/**
 * Sets the functions (tools) for the assistant.
 * 
 * @param {Array} tools - The list of tools to set.
 */
function setFunctions(tools) {
    const $functionsList = $('.functions-list');
    const $allFunctions = $('#function-input .function-item');
    $functionsList.empty();
    enabledFunctions = [];
    $allFunctions.find('.function-checkbox').prop('checked',false);

    if (Array.isArray(tools)) {
        tools.forEach(tool => {
            if (tool.type === 'function' && tool.function) {
                const funcName = tool.function.name;
                const $functionItem = $(`
                    <div class="function-item">
                        <img src="svg/function.svg" alt="Function Icon" class="function-icon">
                        <span>${funcName}</span>
                        <input type="checkbox" class="function-checkbox" id="${funcName}-checkbox" data-function-id="${funcName}" checked>
                    </div>
                `);
                $functionsList.append($functionItem);
                enabledFunctions.push(funcName);
                
                const $checkbox = $functionItem.find('.function-checkbox');
                const $allFunctionsCb = $allFunctions.find(`#fn-cb-${funcName}`);
                if ($allFunctionsCb) $allFunctionsCb.prop('checked', $checkbox.is(':checked'));

                // Add event handler for checkbox click
                $checkbox.on('click', function () {
                    const id = $(this).attr('data-function-id');
                    const $cb = $(`#fn-cb-${id}`);
                    $cb?.prop('checked', $checkbox.is(':checked'));
                    if ($(this).is(':checked')) {
                        if (enabledFunctions.indexOf(funcName) == -1) {
                            enabledFunctions.push(funcName);
                        }
                    } else {
                        const index = enabledFunctions.indexOf(funcName);
                        if (index > -1) {
                            enabledFunctions.splice(index, 1);
                        }
                    }
                });
            }
        });

        if (enabledFunctions.length === 0) {
            const $functionItem = $(`
                <div class="function-item">
                    <span>No Functions Available</span>
                </div>`);
            $functionsList.append($functionItem);
        }
    } else {
        const $functionItem = $(`
            <div class="function-item">
                <span>No Functions Available</span>
            </div>`);
        $functionsList.append($functionItem);
    }
}

/**
 * Clears the current assistant configuration.
 */
function clearAssistant() {
    

    $('.model-configuration-fields').show();
    assistant_id = null;
    assistant_name = null;
    instructions = null;
    currentAssistant = null;
    currentAssistantName = null;

    $('.assistants-dropdown-text').text("@New Assistant");
    $('.assistants-dropdown-menu').hide();
    $('#assistant-name').val('');
    $('.assistant-id').text('');
    $('#instructions').text('');
    $(".assistants-dropdown-menu").hide();

    temperature = 0.2;
    top_p = 0.5;
    max_tokens = 4096;
    max_threads = 500;

    $('#max_tokens').val(max_tokens);
    $('#max_tokens_in').val(max_tokens);
    
    $('#max_threads').val(max_threads);
    $('#max_threads_in').val(max_threads);

    $('#top_p').val(top_p);
    $('#top_p_in').val(top_p);

    $('#temperature').val(temperature);
    $('#temperature_in').val(temperature);

    enabledFunctions = new Array();
    $('.functions-list').empty();

    currentModel = null;
    $('.models-dropdown-text').text('Select a model');
}

/**
 * Saves the current assistant configuration.
 * 
 * @async
 */
async function saveAssistantConfiguration() {
    apiKey = localStorage.getItem('openlinksw.com:opal:gpt-api-key');

    // Gather values from the form fields
    const assistantName = document.getElementById('assistant-name').value;
    const assistantId = document.querySelector('.assistant-id').innerText;
    const instructions = document.getElementById('instructions').value;
    const model = document.querySelector('.models-dropdown-text').innerText;
    const temperature = parseFloat(document.getElementById('temperature').value);
    const topP = parseFloat(document.getElementById('top_p').value);
    const maxTokens = parseInt(document.getElementById('max_tokens').value);
    const maxThreads = parseInt(document.getElementById('max_threads').value);
    const sqlFunctions = enabledFunctions.map(name => {
        const match = availableFunctions.find(item => item.name === name);
        return match ? match.function : null;
    }).filter(Boolean);
    const vector_store_id = Array.isArray(vectorStores) && vectorStores.length ? vectorStores[0] : null; 
    const file_ids = !vector_store_id && fileSearch ? [] : null;

    if (!assistantName) {
        showFailureNotice("Assistant name cannot be empty");
        return;
    }


    if (!instructions) {
        showFailureNotice("Assistant instructions cannot be empty");
        return;
    }


    if (model == "Select a model" || model == "") {
        showFailureNotice("Please select a model");
        return;
    }

    // Create a configuration object
    const config = {
        name: assistantName,
        instructions: instructions,
        model: model,
        top_p: topP,
        temperature: temperature,
        functions: sqlFunctions,
        file_ids: file_ids,
        vector_store_id: vector_store_id,
    };

    if (assistantId) {
        config.assistant_id = assistantId;
    }

    // API endpoint and URL
    let url = new URL('/chat/api/assistants', httpBase); // Create URL for the API call
    let params = new URLSearchParams(url.search);
    params.append('apiKey', apiKey ? apiKey : '');
    if (assistantId) {
        params.append('assistant_id', assistantId);
    }
    url.search = params.toString();

    try {
        const response = await authClient.fetch(url.toString(), {
            method: 'POST',
            body: JSON.stringify(config)
        });

        if (response.status === 200) {
            const data = await response.json();
            await loadAssistants(data);
            showSuccessNotice("Assistant configuration saved.")
        } else {
            const err = await response.json().catch(() => ({}));
            throw new Error(err?.message || response.statusText);
        }
    } catch (error) {
        showFailureNotice('Error saving assistant configuration: ' + error.message);
    }
}

/**
 * Clones the current assistant configuration.
 * 
 * @async
 */
async function cloneAssistant() {
    $('.assistants-dropdown-text').text("New Assistant");
    $('#assistant-name').val('');
    $('.assistant-id').text('');
    $('#instructions').val('');
    $('.models-dropdown-text').text('');

    enabledFunctions = new Array();
    $('.functions-list').empty();
}

/**
 * Delete an assistant given its ID.
 * 
 * @param {string} assistant_id - The ID of the assistant to be deleted.
 */
async function deleteAssistant(assistant_id) {
    apiKey = localStorage.getItem('openlinksw.com:opal:gpt-api-key');
    // Construct the URL for the DELETE request
    let url = new URL('/chat/api/assistants', httpBase);
    let params = new URLSearchParams(url.search);
    params.append('assistant_id', assistant_id);
    params.append('apiKey', apiKey ? apiKey : '');
    url.search = params.toString();

    try {
        // Send the DELETE request to the server
        const resp = await authClient.fetch(url.toString(), { method:'DELETE' })

        // Check if the response status is not 204 (No Content)
        if (resp.status != 204) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err?.message || resp.statusText);
        } else {
            clearAssistant();
            $('.assistants-dropdown-text').text('Select an Assistant');
            $('.model-configuration-fields').hide();
            await loadAssistants();
        }
    } catch (e) {
        showFailureNotice('Delete failed: ' + e); // Alert if there was an error during the request
    }
}

function loadModels() {
    fetch(new URL('/chat/api/getModels', httpBase))
        .then(resp => resp.ok ? resp.json() : Promise.reject(resp.statusText))
        .then(items => {
            models = items.length > 0 ? items : models;

            const $dropdownMenu = $('.models-dropdown-menu').empty();
            const $dropdownText = $('.models-dropdown-text');

            models.forEach(model => {
                const $item = $('<div class="models-dropdown-item"></div>').text(model.id);
                $item.attr('data-model-id', model.id); // Add data-model-id attribute

                $item.on('click', function () {
                    $('.models-dropdown-menu').hide();
                    setModel(model.id); // Pass the entire model object
                });
                $dropdownMenu.append($item);
            });
        })
        .catch(error => {
            console.log('Cannot get models: ' + error + ' setting defaults');
        });
}

async function loadFunctions() {
    try {
        let url = new URL('/chat/api/listFunctions', httpBase);
        let params = new URLSearchParams(url.search);
        params.append('asst', 1);
        url.search = params.toString();
        const resp = await fetch (url.toString());
        if (resp.status === 200) {
            availableFunctions = await resp.json();
            let $funcs = $('#function-input');
            availableFunctions.forEach(fn => {
                const $functionItem = $(`
                    <div class="function-item">
                        <img src="svg/function.svg" alt="Function Icon" class="function-icon">
                        <label for="fn-cb-${fn.name}">${fn.title}</label>
                        <input type="checkbox" id="fn-cb-${fn.name}" class="function-checkbox" 
                        data-function-id="${fn.name}" data-function-name="${fn.function}">
                    </div>
                `);
                $funcs.append($functionItem);
            });
        } else
            showFailureNotice ('Loading helper functions failed: ' + resp.statusText);
    } catch (e) {
        showFailureNotice('Loading helper functions failed: ' + e);
    }
}

async function setModel(model_id) {
    if (!model_id)
        return;
    const target_model = models.find((model) => model.id === model_id);
    currentModel = model_id;
    $('.models-dropdown-text').text(model_id);


    // $('#max_tokens').val(max_tokens);
    // $('#max_tokens_in').attr('max', max_tokens).val(max_tokens);

    // if (modelSupportsImages(currentModel)) {
    //     $('.image-btn').show();
    // } else {
    //     $('.image-btn').hide();
    // }
}

function getAssistantName(assistant_id) {
    if (null == assistant_id) return null;

    let assistant = assistants.find(obj => obj.id === assistant_id);
    return assistant ? assistant.name : null;
}

/**
 * Displays a success notice message for a set duration.
 * @param {string} text - The message to be displayed.
 */
async function showSuccessNotice(text) {
    const tm = 3000; // Duration to display the notice (in milliseconds)
    $('#msg').html(text); // Set the message text in the HTML element with ID 'msg'
    $('.notice').removeClass('failure').addClass('success'); // Apply 'success' class and remove 'failure' class
    $('.notice').show(); // Show the notice element
    setTimeout(function () {
        $('.notice').hide(); // Hide the notice element after the specified duration
    }, tm);
}

/**
 * Displays a failure notice message for a set duration.
 * @param {string} text - The message to be displayed.
 */
async function showFailureNotice(text) {
    const tm = 3000; // Duration to display the notice (in milliseconds)
    $('#msg').html(text); // Set the message text in the HTML element with ID 'msg'
    $('.notice').removeClass('success').addClass('failure'); // Apply 'failure' class and remove 'success' class
    $('.notice').show(); // Show the notice element
    setTimeout(function () {
        $('.notice').hide(); // Hide the notice element after the specified duration
    }, tm);
}
