/**
 * Fetches profile data from the given URL.
 * @param {string} url - The URL to fetch the profile data from.
 * @returns {Object|null} - The profile data and content type, or null if an error occurs.
 */
async function fetchProfile(url) {
    const options = { 
        method: 'GET', 
        headers: { 'Accept': 'text/turtle, application/ld+json;q=0.9, application/rdf+xml;q=0.2, */*;q=0.1' }, 
        cache: 'reload',
        mode: 'cors', 
        crossDomain: true 
    };

    try {
        const resp = await fetch(url, options); // Fetch profile
        if (resp.ok) { // Check response status
            const body = await resp.text(); // Get response text
            return { profile: body, content_type: resp.headers.get('content-type') }; // Return profile data
        } else {
            console.log(`Error ${resp.status} - ${resp.statusText}`); // Log error
        }
    } catch (e) {
        console.log('Request failed', e); // Log exception
        return null; // Return null on error
    }
}

/**
 * Loads the profile data for the given WebID.
 * @param {string} webId - The WebID to load the profile for.
 * @returns {Object|null} - The profile information including storage URL, Solid ID status, WebDAV support, and name.
 */
async function loadProfile(webId) {
    const uriObj = new URL(webId);
    let hash = uriObj.hash;
    uriObj.hash = uriObj.search = ''; // Clear hash and search params from URL

    if (hash === '#this') webId = uriObj.toString(); // Update WebID if it contains '#this'
    if (!webId.startsWith('https://')) return; // Ensure WebID uses HTTPS

    try {
        const rc = await fetchProfile(webId); // Fetch profile data
        if (!rc) return null; // Return null if fetch fails

        const base = uriObj.toString(); // Base URL for RDF parsing
        const { content_type: mediaType, profile: bodyText } = rc; // Extract response data

        if (mediaType.startsWith('text/html')) { // Handle HTML content
            const doc = new DOMParser().parseFromString(bodyText, 'text/html'); // Parse HTML

            // Select elements containing storage and inbox URLs, and name metadata
            const storage_link = doc.querySelector(`*[itemid="${webId}"] > link[itemprop="http://www.w3.org/ns/pim/space#storage"]`);
            const inbox_link = doc.querySelector(`*[itemid="${webId}"] > link[itemprop="http://www.w3.org/ns/pim/space#inbox"]`);
            const name_meta = doc.querySelector(`*[itemid="${webId}"] > meta[itemprop="http://schema.org/name"]`);
            let posh_storage_link = doc.querySelector('head > link[rel="http://www.w3.org/ns/pim/space#storage"]');

            // Determine storage URL from selected links
            const storage_url = storage_link?.href || inbox_link?.href || posh_storage_link?.href;

            if (storage_url) { // If storage URL exists
                const isDav = await isDavSupported(storage_url); // Check if WebDAV is supported
                return { 
                    storage: storage_url, 
                    is_solid_id: false, // Not a Solid ID
                    isDav, 
                    name: name_meta ? name_meta.content : null // Extract name content
                };
            }
        }

        // RDF parsing and querying for non-HTML content
        const store = $rdf.graph(); // Create RDF graph
        $rdf.parse(bodyText, store, base, mediaType); // Parse RDF data
        // Define RDF namespaces
        const LDP = $rdf.Namespace("http://www.w3.org/ns/ldp#");
        const PIM = $rdf.Namespace("http://www.w3.org/ns/pim/space#");
        const SOLID = $rdf.Namespace("http://www.w3.org/ns/solid/terms#");
        const FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");

        // XXX: this optimization not work well const [LDP, PIM, SOLID, FOAF] = ["http://www.w3.org/ns/ldp#", "http://www.w3.org/ns/pim/space#", "http://www.w3.org/ns/solid/terms#", "http://xmlns.com/foaf/0.1/"].map($rdf.Namespace);
        const s_webId = $rdf.sym(webId); // RDF symbol for WebID

        // Query RDF store for specific properties
        const storage = store.any(s_webId, PIM('storage')); // Storage URL
        const inbox = store.any(s_webId, LDP('inbox')); // Inbox URL
        const name = store.any(s_webId, FOAF('name')); // User's name

        // Check if Solid ID by querying relevant properties
        const is_solid_id = [SOLID('oidcIssuer'), SOLID('account'), SOLID('publicTypeIndex')].some(prop => store.any(s_webId, prop));
        
        const storage_url = storage ? storage.value : inbox ? inbox.value : null; // Determine storage URL
        const isDav = await isDavSupported(storage_url); // Check WebDAV support

        return { 
            storage: storage_url, 
            is_solid_id, 
            isDav, 
            name: name ? name.value : null // Extract name value
        };
    } catch (e) {
        console.log('Error', e); // Log error to console
        return null; // Return null on error
    }
}

/**
 * Checks if WebDAV is supported at the given URL.
 * @param {string} url - The URL to check for WebDAV support.
 * @returns {boolean} - True if WebDAV is supported, false otherwise.
 */
async function isDavSupported(url) {
    if (!url) return false;
    rc = await authClient.fetch(url, { method: 'OPTIONS'}).
        then((resp) => {
            if (resp.status != 204) {
                return false;
            }
            let dav = resp.headers.get('DAV');
            if (dav?.split(',').includes('1')) {
                return true;
            }
            return false;
        })
        .catch((e) => {
            showFailureNotice('Can not get storage options: ' + e);
            return false;
        });
    return rc;
}
