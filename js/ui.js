/**
 * Initializes the user interface.
 */
function initUI() {
    if (!loggedIn && !sharedSession) {
        $("#login-modal").show();
    }

    $('.model-configuration-fields').hide();

    document.getElementById('delete-assistant').addEventListener('click', function() {
        if(confirm('The assistant will be deleted, and operation cannot be undone, please confirm')) {
            deleteAssistant(document.querySelector('.assistant-id.field-id').textContent);
        }
    });

    // Event listener for the Save button
    // TODO: clean this section
    document.getElementById('save-assistant-button').addEventListener('click', saveAssistantConfiguration);
    // document.getElementById('new-assistant').addEventListener('click', clearAssistant);
    //document.getElementById('clone-assistant-button').addEventListener('click', cloneAssistant);

    initThreadsDropdown();
    initSearch();
    initAssistantsDropdown();
    initModelsDropdown();
    initFileSearchDropdown();
    initUserInputField();
    initApiKeyModal();
    initLoginModal();
    initShareThreadModal();
    initPersonalStorageModal();
    initFunctionsModal();

    initTemperature();
    initTopP();
    initMaxTokens();
    initMaxThreads();
    initShareSessionReplaySpeed();

    $('#assistant-publish').on('click', async function(e) {
        const thisAssistant = assistants.find(item => item.id === currentAssistant);
        const published = thisAssistant?.metadata?.published === 'true';
        if(published && !$(this).is(':checked')) {
            let rc = false;
            if (rc = confirm("The assistant will be un-published, please confirm.")) {
                rc = await assistantUnpublish(currentAssistant);
            } 
            $(this).prop('checked', !rc);
        }
    });

    $('#enable_debug').on('click', function(e) {
        enableDebug = $(this).is(':checked');
        $('.funciton-debug').toggleClass('d-none', !e.target.checked);
    });

    initAssistantSuggestions();
    initAssistantOpenClose();

    initAudio();

    // initFileUpload();
    initCodeBlock();

    // initFileDragAndDrop();

    $('.new-thread').on('click', function() {
        createNewThread();
    });

    // Authentication
    $('.login-button').on('click', authLogin);
    $('.logout-button').on('click', authLogout);

    $('#run-submit').on('click', handleUserInput);
    $('#stop-submit').on('click', handleStop);

    // Copy message to clipboard
    $(document).on('click', '.message-copy', function() {
        copyMessageToClipboard($(this).closest('.chat-message').find('.message-body')[0]);
    });

    // Event handler for copying message permalink to clipboard
    $(document).on('click', '.message-permalink', function() {
        const messageId = $(this).closest('.chat-message').attr('id');
        copyLinkToClipboard(currentThread, messageId);
    });

    // Delete message
    $(document).on('click', '.message-delete', function() {
        if (!checkApiKey()) return;

        if (!loggedIn) {
            $("#login-modal").show();
            $('.loader').css('display', 'none');
        } else {
            const messageId = $(this).closest('.chat-message').attr('id');
            if (confirm('Are you sure you want to delete this message?')) {
                deleteMessage(messageId);
            }
        }
    });
}

/**
 * Expandable textbox functionality for user input field.
 */
function initUserInputField() {
    var $textarea = $('#user-input');
    $textarea.on('input', function() {
        this.style.height = 'auto'; // Reset the height
        this.style.height = Math.min(this.scrollHeight, 400) + 'px'; // Set height
    }).trigger('input'); // Initialize height

    // Add event listener for keypress to handle Enter and Shift+Enter
    $textarea.on('keypress', function(e) {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Insert a line break
                const cursorPosition = this.selectionStart;
                const value = $textarea.val();
                $textarea.val(value.substring(0, cursorPosition) + '\n' + value.substring(cursorPosition));
                this.selectionStart = cursorPosition + 1;
                this.selectionEnd = cursorPosition + 1;
                e.preventDefault(); // Prevent the default action
            } else {
                // Trigger the run button click
                $('#run-submit').click();
                e.preventDefault(); // Prevent the default action
                this.style.height = 'auto';
            }
        }
    });
}

function runStarted(flag) {
    if (flag) {
        $('#run-submit').hide();
        $('#stop-submit').show();
    } else {
        $('#run-submit').show();
        $('#stop-submit').hide();
    }
}

/**
 * Threads dropdown functionality.
 */
function initThreadsDropdown() {
    const dropdown = $(".threads-dropdown");
    dropdown.find(".threads-dropdown-btn").on("click", () => dropdown.find(".threads-dropdown-menu").toggle());

    $(document).on("click", event => {
        if (!$(event.target).closest('.threads-dropdown, .threads-dropdown-item-actions').length) {
            dropdown.find(".threads-dropdown-menu").hide();
            $('.threads-dropdown-item-actions').hide(); // Hide all more options menus when clicking outside
            $('.threads-dropdown-item').removeClass('hover');
        }
    });

    dropdown.find(".threads-dropdown-menu").on("click", ".threads-dropdown-item", function(event) {
        // Logic associated with clicking a threads-dropdown-item
        if (!checkApiKey()) return;
        $('.threads-dropdown-text').text($(this).text());
        currentThread = $(this).text();
        loadConversation($(this).data('chat-id'));
        dropdown.find(".threads-dropdown-menu").hide();
        $('.threads-dropdown-item-actions').hide();
        $('.threads-dropdown-item').removeClass('hover');
    });
}

function initSearch() {
    $('.search-input').on('keyup', function(e) {
        const word = e.target.value.toUpperCase();
        $('.threads-dropdown-item').removeClass('d-none');
        if (!word.length) {
            $(".threads-dropdown").find(".threads-dropdown-menu").hide();
            return;
        }
        $('.threads-dropdown-item').each(function(index){
            $span = $(this).find('.threads-dropdown-item-text');
            if (-1 == $span.text().toUpperCase().indexOf(word)) {
                $(this).addClass('d-none');
            }
        });
        $(".threads-dropdown").find(".threads-dropdown-menu").show();
    });
}

/**
 * Assistants dropdown functionality.
 */
function initAssistantsDropdown() {
    const dropdown = $(".assistants-dropdown");

    dropdown.find(".assistants-dropdown-btn").on("click", () => {
        dropdown.find(".assistants-dropdown-menu").toggle();
    });

    $(document).on("click", event => {
        if (!$(event.target).closest('.assistants-dropdown').length) {
            dropdown.find(".assistants-dropdown-menu").hide();
            $('.assistants-dropdown-item').removeClass('hover');
        }
    });
}

/**
 * Models dropdown functionality.
 */
function initModelsDropdown() {
    const dropdown = $(".models-dropdown");
    dropdown.find(".models-dropdown-btn").on("click", () => {
        dropdown.find(".models-dropdown-menu").toggle();
    });

    $(document).on("click", event => {
        if (!$(event.target).closest('.models-dropdown').length) {
            dropdown.find(".models-dropdown-menu").hide();
            $('.models-dropdown-item').removeClass('hover');
        }
    });
}

/**
 * File search dropdown functionality.
 */
function initFileSearchDropdown() {
    $('#import-thread-button').on('click', function() {
        $('#import-thread-modal').toggle();
    });

    $(document).on('click', function(event) {
        if (!$(event.target).closest('#import-thread-button').length) {
            $('#import-thread-modal').hide();
        }
    });
}

/**
 * Initializes the API key modal functionality.
 */
function initApiKeyModal() {
    const $apiKeyModal = $("#api-key-modal");
    const $inputField = $("#api-key-input");
    apiKey = localStorage.getItem('openlinksw.com:opal:gpt-api-key');

    // apiKey ? $inputField.val(apiKey) : $apiKeyModal.show();

    $(".icon-button[title='Api Key']").on("click", () => {
        $apiKeyModal.show();
        $inputField.val(apiKey || "");
        $inputField.focus();
    });

    $(".close").on("click", () => $apiKeyModal.hide());

    $("#save-api-key").on("click", () => {
        const key = $inputField.val();
        if (key) {
            apiKey = key;
            localStorage.setItem('openlinksw.com:opal:gpt-api-key', key);
            checkResumeThread().then(loadAssistants).then(() => loadConversation(currentThread));
            $apiKeyModal.hide();
        } else showFailureNotice("Please enter a valid API key.");
    });

    $inputField.keypress(function (e) {
        if (e.which === 13 && this.value.length > 1) {
            $("#save-api-key").trigger('click');
        }
    });

    $("#remove-api-key").on("click", () => {
        localStorage.removeItem('openlinksw.com:opal:gpt-api-key');
        apiKey = null;
        $apiKeyModal.hide();
    });
}

/**
 * Initializes the login modal functionality.
 */
function initLoginModal() {
    const $loginModal = $("#login-modal");
    $(".close").on("click", () => $loginModal.hide());
}

/**
 * Initializes the share modal functionality.
 */
function initShareThreadModal() {
    const $shareThreadModal = $("#share-thread-modal");

    $(".icon-button[title='Share']").on("click", () => {
        $shareThreadModal.show();
        $('#personal-storage-export-input').val(localStorage.getItem('openlinksw.com:opal:personal-storage'));
        // $inputField.val(apiKey || "");
    });

    $(".close").on("click", () => $shareThreadModal.hide());

    $("#share-link").on("click", () => {
        copyLinkToClipboard(currentThread);
        $shareThreadModal.hide();
    });

    $("#copy-messages").on("click", () => {
        copyAllMessagesToClipboard();
        $shareThreadModal.hide();
    });

    $('#personal-storage-export-input').on('keyup', (e) => { 
        storageFolder = e.currentTarget.value; 
        storageFolder !== null && localStorage.setItem('openlinksw.com:opal:personal-storage', storageFolder);

    });

    $("#export-chat").on("click", () => {
        exportSession(currentThread);
        $shareThreadModal.hide();
    });
}

/**
 * Initializes the personal storage modal functionality.
 */
function initPersonalStorageModal() {
    // Event handler for showing the modal
    $('#import-thread-modal').on('click', '#personal-storage', function() {
        $('#personal-storage-modal').show();
        // Set the value of the modal's input field to the current personal storage input field value
        $('#personal-storage-import-input').val(localStorage.getItem('openlinksw.com:opal:personal-storage'));
    });

    $('#import-thread-modal').on('click', '#local-storage', function() {
        $('#local-storage-thread-input').click();
    });
    
    $('#local-storage-thread-input').on('change', handleFileSelect);

    // Event handler for closing the modal
    $('.close').on('click', function() {
        $('#personal-storage-modal').hide();
    });

    // Event handler for the search button
    $('#search-storage').on('click', function() {
        listStorage(); // Call the listStorage function
    });

    $('#personal-storage-import-input').on('keyup', (e) => { 
        storageFolder = e.currentTarget.value;
        storageFolder !== null && localStorage.setItem('openlinksw.com:opal:personal-storage', storageFolder); 
    });

    // Event handler for clicking on a storage item
    $(document).on('click', '.file-storage-thread-item', function() {
        loadFromStorage($(this).data('url'));
        $('#personal-storage-modal').hide();
    });
}

/**
 * Initializes the functions modal functionality.
 */
function initFunctionsModal() {
    $('.functions-btn').on('click', function() {
        $('#function-modal').show();
    });
    $(".close").on("click", () => $('#function-modal').hide());
    /* perhaps should do listFunctions here & init the content */
    $('.functions-save-button').on('click', function() {
        let tools = new Array();
        enabledFunctions = new Array();
        $('#function-input .function-item input[type="checkbox"]').each(function() {
            if($(this).prop('checked')) {
                const id = $(this).attr('data-function-id');
                const sql_name = $(this).attr('data-function-name');
                tools.push({type:'function', function: {name: id, func: sql_name}});
                enabledFunctions.push(id);
            }
        });
        setFunctions(tools);
        $('#function-modal').hide();
    });
}

/**
 * Initializes the temperature slider and input field.
 */
function initTemperature() {
    const minTemperature = parseFloat($('#temperature_in').attr('min'));
    const maxTemperature = parseFloat($('#temperature_in').attr('max'));
    // Function to track the temperature value
    const trackTemperature = (value) => {
        temperature = parseFloat(value);
    };

    // Update input field when slider changes
    $('#temperature_in').on('input', function() {
        const value = $(this).val();
        $('#temperature').val(value);
        trackTemperature(value);
    });

    // Update slider when input field changes
    $('#temperature').on('input', function() {
        const value = $(this).val();
        if (value >= minTemperature && value <= maxTemperature) {
            $('#temperature_in').val(value);
            trackTemperature(value);
        }
    });
}

/**
 * Initializes the top_p slider and input field.
 */
function initTopP() {
    const minTopP = parseFloat($('#top_p_in').attr('min'));
    const maxTopP = parseFloat($('#top_p_in').attr('max'));
    // Function to track the top_p value
    const trackTopP = (value) => {
        top_p = parseFloat(value);
    };

    // Update input field when slider changes
    $('#top_p_in').on('input', function() {
        const value = $(this).val();
        $('#top_p').val(value);
        trackTopP(value);
    });

    // Update slider when input field changes
    $('#top_p').on('input', function() {
        const value = $(this).val();
        if (value >= minTopP && value <= maxTopP) {
            $('#top_p_in').val(value);
            trackTopP(value);
        }
    });
}

/**
 * Initializes the max_tokens slider and input field.
 */
function initMaxTokens() {
    const minMaxTokens = parseFloat($('#max_tokens_in').attr('min'));
    const maxMaxTokens = parseFloat($('#max_tokens_in').attr('max'));
    // Function to track the max_tokens value
    const trackMaxTokens = (value) => {
        max_tokens = parseInt(value, 10);
    };

    // Update input field when slider changes
    $('#max_tokens_in').on('input', function() {
        const value = $(this).val();
        $('#max_tokens').val(value);
        trackMaxTokens(value);
    });

    // Update slider when input field changes
    $('#max_tokens').on('input', function() {
        const value = $(this).val();
        if (value >= minMaxTokens && value <= maxMaxTokens) {
            $('#max_tokens_in').val(value);
            trackMaxTokens(value);
        }
    });
}

/**
 * Initializes the max_threads slider and input field.
 */
function initMaxThreads() {
    const minMaxthreads = parseFloat($('#max_threads_in').attr('min'));
    const maxMaxthreads = parseFloat($('#max_threads_in').attr('max'));
    // Function to track the max_threads value
    const trackMaxthreads = (value) => {
        max_threads = parseInt(value, 10);
    };

    // Update input field when slider changes
    $('#max_threads_in').on('input', function() {
        const value = $(this).val();
        $('#max_threads').val(value);
        trackMaxthreads(value);
    });

    // Update slider when input field changes
    $('#max_threads').on('input', function() {
        const value = $(this).val();
        if (value >= minMaxthreads && value <= maxMaxthreads) {
            $('#max_threads_in').val(value);
            trackMaxthreads(value);
        }
    });
}

/**
 * Initializes the share session replay speed input field.
 */
function initShareSessionReplaySpeed() {
    const maxAnimationSpeed = parseFloat($('#share_animation_speed_in').attr('max'));
    animate_session = Math.min(animate_session, maxAnimationSpeed);
    $('#share_animation_speed_in').val(animate_session)

    $('#share_animation_speed_in').on('input', function() {
        const value = $(this).val();
        animate_session = parseInt(value, 10);
    });
}

function selectSuggestion(direction) {
    var $suggestions = $('.assistants-suggestions-dropdown');
    let $options = $suggestions.find('.assistants-suggestions-item');
    let $selected = $options.filter('.selected');
    let index = $options.index($selected);


    if (40 == direction) {
        index = (index + 1) % $options.length;
    } else if (38 == direction) {
        index = (index - 1 + $options.length) % $options.length;
    }
    $options.removeClass('selected');
    $options.eq(index).addClass('selected');

    let selectedOption = $options.eq(index)[0];
    let popupHeight = $suggestions.height();
    let popupScrollTop = $suggestions.scrollTop();
    let optionTop = selectedOption.offsetTop;
    let optionHeight = selectedOption.offsetHeight;

    if (optionTop < popupScrollTop) {
        $suggestions.scrollTop(optionTop);
    } else if (optionTop + optionHeight > popupScrollTop + popupHeight) {
        $suggestions.scrollTop(optionTop + optionHeight - popupHeight);
    }
}

/**
 * Initializes the assistant suggestions dropdown.
 */
function initAssistantSuggestions() {
    var $suggestions = $('.assistants-suggestions-dropdown');
    $('#user-input').on('keyup', function(e) {
        if ($suggestions.is(':visible') && (38 == e.keyCode || 40 == e.keyCode || 13 == e.keyCode || 27 == e.keyCode)) {
            e.preventDefault();
            return;
        }
        let $mentionInput = $('#user-input');
        let text = this.value.trim();
        if (text.split(/\s+/).length === 1 && text.match(/^@\w*$/)) {
            let query = text.substring(1).toLowerCase();
            let matches = assistants.filter(function(item) {
                return item.name.toLowerCase().startsWith(query);
            });
            e.preventDefault();
            if (matches.length > 0) {
                var suggestionsHtml = matches.map(function(item) {
                    return `<div class="assistants-suggestions-item" data-assist-id="${item.id}">${item.name}</div>`;
                }).join('');
                $suggestions.html(suggestionsHtml).show();
                $suggestions.children('.assistants-suggestions-item').first().addClass('selected');
                $suggestions.css({
                                 bottom: $mentionInput.position().top + $mentionInput.outerHeight() + 30,
                                 left: $mentionInput.position().left + 10
                });
            } else {
                $suggestions.hide();
            }
        } else {
            $suggestions.hide();
        }
        if (0 === text.length && 8 === e.keyCode) {
            $('#assistant-id').text('').hide();
            $mentionInput.css('text-indent', 0);
        }
    });

    $suggestions.on('click', '.assistants-suggestions-item', function() {
        let $mentionInput = $('#user-input');
        let selectedAssistant = $(this).text();
        let text = $mentionInput.val();
        let caretPos = $mentionInput[0].selectionStart;
        let beforeCaret = text.substring(0, caretPos).replace(/@\w*$/, '@' + selectedAssistant + ' ');
        let afterCaret = text.substring(caretPos);
        setAssistant($(this).attr('data-assist-id'));
        $mentionInput.val(afterCaret);
        $('#assistant-id').text(beforeCaret).show();
        $mentionInput.css('text-indent', Math.round($('#assistant-id').width()) + 10);
        $mentionInput.focus();
        $suggestions.hide();
    });

    $('#user-input').keypress(async function (e) {
        if ($suggestions.is(':visible') && (38 == e.keyCode || 40 == e.keyCode || 13 == e.keyCode || 27 == e.keyCode)) {
            e.preventDefault();
            return;
        }
    });

    $('#user-input').on('keydown', function(e) {
        if ($suggestions.is(':visible')) {
            if (38 == e.keyCode || 40 == e.keyCode) {
                selectSuggestion(e.keyCode);
                e.preventDefault();
            } else if (13 == e.keyCode) {
                $('.assistants-suggestions-dropdown .assistants-suggestions-item.selected').trigger('click');
                e.preventDefault();
            } else if (27 == e.keyCode) {
                $suggestions.hide();
            }
        }
    });

}

/**
 * Initializes the assistant open/close functionality.
 */
function initAssistantOpenClose() {
    $('#open-assistant-configuration-btn').on('click',function() {
        $('.assistant-configuration').show();
        $('#open-assistant-configuration-btn').hide();
        $('#close-assistant-configuration-btn').show();
    });
    $('#close-assistant-configuration-btn').on('click',function() {
        $('.assistant-configuration').hide();
        $('#close-assistant-configuration-btn').hide();
        $('#open-assistant-configuration-btn').show();
    });
}

/**
 * Initializes the code block functionality.
 */
function initCodeBlock() {
    $(document).on('change', '.chat-message select.code-type', (ev) => {
        if (ev.target && ev.target.matches('select.code-type')) {
            const parent = ev.target.closest('.code-container');
            if (parent) {
                const start = parent.querySelector('div.nano_start');
                const end = parent.querySelector('div.nano_end');
                const selectedOption = ev.target.options[ev.target.selectedIndex];
                const sel = selectedOption.id;
                let name = null;

                switch (sel) {
                    case 'turtle': name = 'RDF-Turtle'; break;
                    case 'jsonld': name = 'JSON-LD'; break;
                    case 'json': name = 'JSON'; break;
                    case 'csv': name = 'CSV'; break;
                    case 'rdfxml': name = 'RDF/XML'; break;
                    case 'markdown': name = 'Markdown'; break;
                    case 'rss': name = 'RSS'; break;
                    case 'atom': name = 'Atom'; break;
                }

                if (name) {
                    start.textContent = '## ' + name + ' Start ##';
                    end.textContent = '## ' + name + ' Stop ##';
                } else {
                    start.textContent = '';
                    end.textContent = '';
                }
            }
        }
    }); 

    $(document).on('click', '.chat-message .clipboard', function() {
        const codeContainer = $(this).closest('.code-container');
        const codeBlock = codeContainer.find('pre code')[0]; // Get the actual DOM element
        copyMessageToClipboard(codeBlock);
    });
    
    $(document).on('click', '.chat-message .download', function() {
        const codeContainer = this.closest('.code-container');
        const codeBlock = codeContainer.querySelector('pre code');
        const selectedOption = codeContainer.querySelector('select.code-type');
        const selectedId = selectedOption && selectedOption.selectedIndex >= 0 ? selectedOption.options[selectedOption.selectedIndex].id : null;
    
        const prompt_id = this.closest('.chat-message').dataset.promptId;
        const content = codeBlock.textContent;
        const mime = selectedId ? 
            (selectedId.match(/json/) ? 'application/json' : selectedId.match(/xml|rss|atom/) ? 'application/xml' : 'text/plain') : 'text/plain';
        const ext = selectedId ? 
            (selectedId.match(/json/) ? 'json' : selectedId.match(/xml|rss|atom/) ? 'xml' : 'txt') : 'txt';
        const file = `${prompt_id}.${ext}`;
    
        downloadContent(content, file, mime);
    });
}

function initAudio() {
    $('#enable_audio').on('click', function(e) {
        if (e.target.checked) {
            audioEnable();
        } else {
            audioDisable();
        }
    });

    $('#record-button').on('click', function() {
        startRecording();
    });

    $('#stop-recording-button').on('click', function() {
        stopRecording();
    });
}
