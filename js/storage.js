/**
 * Lists storage items and displays them in the modal under the search button.
 */
async function listStorage() {
    const storageFolder = localStorage.getItem('openlinksw.com:opal:personal-storage');
    if (!storageFolder) {
        return; // Exit if no storage folder is set
    }

    const propfind = '<?xml version="1.0" encoding="utf-8" ?>' +
        '<D:propfind xmlns:D="DAV:"><D:prop><D:displayname/><D:getcontenttype/></D:prop></D:propfind>';
    const options = { method: 'PROPFIND', headers: {'content-type': 'application/xml', 'depth': 1}, body: propfind };
    
    $('.loader').css('display', 'block'); // Show loader

    try {
        const response = await authClient.fetch(storageFolder, options); // Fetch storage folder contents
        if (!response.ok) {
            throw new Error(response.statusText);
        }

        const xmlText = await response.text(); // Get response text
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const propfindResponse = xmlDoc.getElementsByTagNameNS('DAV:', 'response');

        // Clear previous storage items and dynamic elements
        $('.personal-storage-threads').empty();

        // Add new dynamic elements
        $('.personal-storage-threads').append(`
            <div class="storage-header">
                <p>Threads from <a href="${storageFolder}" id="storage-location" target="_blank" referrerpolicy="origin">${storageFolder}</a>:</p>
            </div>
            <div id="storage-items-list" class="file-storage-threads-list"></div>
        `);

        // Add new storage items to the list
        Array.from(propfindResponse).forEach(elem => {
            const href = elem.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent;
            const title = elem.getElementsByTagNameNS('DAV:', 'displayname')[0]?.textContent;
            const mime = elem.getElementsByTagNameNS('DAV:', 'getcontenttype')[0]?.textContent;
            const url = new URL (href, storageFolder);
            if (mime === 'application/json') {
                addStorageItemToModal(url, title); // Add item to modal list if JSON
            }
        });
    } catch (err) {
        showFailureNotice(err.message); // Show error notice
    } finally {
        $('.loader').css('display', 'none'); // Hide loader
    }
}

/**
 * Adds a storage item to the modal's list.
 * @param {string} href - The href of the storage item.
 * @param {string} title - The title of the storage item.
 */
function addStorageItemToModal(href, title) {
    const $item = $('<div>', {
        class: 'file-storage-thread-item',
        'data-url': href,
        text: title || href // Set the text to title or href
    });

    $('#storage-items-list').append($item); // Append the item to the list
}

/**
 * Loads chat session from storage and updates the UI.
 * @param {string} link - The URL link to fetch the chat session from storage.
 */
async function loadFromStorage(link) {
    authClient.fetch(link, { method:'GET', headers: { 'Accept': 'application/json' } })
    .then((res) => {
        if (!res.ok) {
            throw new Error(res.statusText);
        }
        return res.json();
    })
    .then((res) => {
        let messages = res.messages;
        let importData = [];
        let info = res.info;
        if (!messages && res.data) {
            messages = new Array();
            for (item of res.data) {
                let role = item.role;
                let assistant_id = item.assistant_id;
                let prompt = undefined;
                let images = [];
                let files = [];
                for (cont of item.content) {
                    let content = undefined;
                    let dataUrl = undefined;
                    let file_id = undefined;
                    switch (cont.type) {
                        case 'text':
                            content = cont.text.value;
                            prompt = cont.text.value;
                            break;
                        case 'image_file':
                            role = 'image';
                            file_id = cont.image_file.file_id;
                            images.push(file_id);
                            break;
                        case 'image_url':
                            role = 'image';
                            dataUrl = cont.image_url.url;
                            break;
                        default:
                            content = '';
                    }
                    messages.push({ role: role, text: content, prompt_id: item.id, assistant_id: assistant_id,
                                  dataUrl: dataUrl, file_id: file_id });
                }
                for (const file of item.attachments) {
                    if(!file.file_id) continue;
                    files.push(file.file_id);
                    messages.push({ role: 'file', text: '', prompt_id: item.id, name: file.file_id, file_id: file.file_id });
                }
                importData.push({ role: item.role, text: prompt, prompt_id: item.id, images: images, files: files, });
            }
        }
        importedSession = { info: info ? info : null, messages: importData };
        showConversation(messages);
        $('.messages').scrollTop($('.messages').prop('scrollHeight'));
    })
    .catch((e) => { alert(e.message); });

    $('#user-input-textbox').hide();
    $('.continue-button-group').show();
    $('#continue-cancel-button').removeClass('d-none');
    $('.continue-button').off('click');
    $('.continue-button').click(function (e) {
        importSession();
    });
    $('#continue-cancel-button').off('click');
    $('#continue-cancel-button').click(function (e) {
        $('#user-input-textbox').show();
        $('.continue-button-group').hide();
        loadConversation(currentThread);
    });
    $('.loader').hide();
}

/**
 * Imports a chat session and updates the UI.
 */
async function importSession() {
    if (!importedSession || !loggedIn) return;
    let url = new URL('/chat/api/importThread', httpBase);
    let params = new URLSearchParams();
    params.append('apiKey', apiKey ? apiKey : '');
    url.search = params.toString();
    $('.loader').show();
    try {
        const res = await authClient.fetch(url.toString(), { 
            method:'POST',
            headers: {'Accept':'application/json' },
            body:JSON.stringify(importedSession) 
        });
        if (!res.ok) {
            try {
                const { error, message } = await res.json();
                showFailureNotice(`${error}:${message}`);
            } catch {
                showFailureNotice(res.statusText);
            }
        }
        const obj = await res.json(); // Parse response JSON
        await createNewThread(obj);
        $('#user-input-textbox').show();
        $('.continue-button-group').hide();
    } catch (e) {
        showFailureNotice(e.message); // Show error notice
    }
    $('.loader').hide();
    importedSession = undefined;
}

/**
 * Exports the chat session to a JSON file in the storage folder.
 * @param {string} thread_id - The ID of the chat session to export.
 */
async function exportSession(thread_id) {
    storageFolder = localStorage.getItem('openlinksw.com:opal:personal-storage');
    if (!thread_id) return showFailureNotice('No session is selected to export.'); // Notify if no session is selected

    $("#share-thread-modal").hide(); // Hide the share modal

    let url = new URL('/chat/api/messages', httpBase);
    let params = new URLSearchParams(url.search);
    params.append('thread_id', thread_id);
    params.append('apiKey', apiKey ? apiKey : '');
    params.append('details', 1);
    url.search = params.toString();

    $('.loader').css('display', 'block'); // Show loader

    try {
        const response = await authClient.fetch(url.toString()); // Fetch chat data
        if (!response.ok) {
            try {
                const { error, message } = await response.json();
                showFailureNotice(`${error}:${message}`);
            } catch {
                showFailureNotice(response.statusText);
            }
        }
        
        const body = await response.json(); // Parse response JSON
        const title = body?.info?.title ? body.info.title : thread_id;
        const file_name = title.replace(/[\s\/\\.&?#]/g, '_') + '.json';
        const uploadUrl = new URL(encodeURIComponent(file_name), storageFolder);
        const options = { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body, null, 2) };

        const uploadResponse = await authClient.fetch(uploadUrl.toString(), options); // Upload JSON file
        if (!uploadResponse.ok) {
            throw new Error(uploadResponse.statusText);
        }

        const location = uploadResponse.headers.get('location');
        const link = new URL(location, storageFolder);
        $('#upload-location').attr('href', link.toString());
        $('#upload-location').text(title);
        $('#upload-status').modal('show');
    } catch (err) {
        showFailureNotice(err.message); // Show error notice
    } finally {
        $('.loader').css('display', 'none'); // Hide loader
    }
}

/**
 * Handles file selection and reads the content of the selected file.
 * @param {Event} event - The file input change event.
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const jsonContent = JSON.parse(e.target.result);
                processJsonData(jsonContent);
            } catch (error) {
                showFailureNotice(`Error parsing JSON file: ${error.message}`);
            }
        };
        reader.readAsText(file);
    }
}

/**
 * Processes JSON data and updates the UI with the chat session.
 * @param {Object} jsonData - The JSON data to process.
 */
function processJsonData(jsonData) {
    let messages = [];
    let importData = [];
    let info = jsonData.info;

    messages = new Array();
    for (const item of jsonData.data) {
        let role = item.role;
        let prompt = undefined;
        let images = [];
        let files = [];
        for (const cont of item.content) {
            let content = undefined;
            let dataUrl = undefined;
            let file_id = undefined;
            switch (cont.type) {
                case 'text':
                    content = cont.text.value;
                    prompt = cont.text.value;
                    break;
                case 'image_file':
                    role = 'image';
                    file_id = cont.image_file.file_id;
                    images.push(file_id);
                    break;
                case 'image_url':
                    role = 'image';
                    dataUrl = cont.image_url.url;
                    break;
                default:
                    content = '';
            }
            messages.push({ role: role, text: content, prompt_id: item.id, dataUrl: dataUrl, file_id: file_id });
        }
        for (const file of item.attachments) {
            if(!file.file_id) continue;
            files.push(file.file_id);
            messages.push({ role: 'file', text: '', prompt_id: item.id, name: file.file_id, file_id: file.file_id });
        }
        importData.push({ role: item.role, text: prompt, prompt_id: item.id, images: images, files: files, });
    }
    const importedSession = { info: info ? info : null, messages: importData };
    showConversation(messages);
    importSession(importedSession);
    $('.messages').scrollTop($('.messages').prop('scrollHeight'));
    $('.loader').hide();
}

/**
 * Downloads content as a file.
 * @param {string} content - The content to download.
 * @param {string} fileName - The name of the file.
 * @param {string} contentType - The MIME type of the file.
 */
function downloadContent(content, fileName, contentType) {
    var a = document.createElement('a');
    var file = new Blob([content], {type: contentType});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
}
