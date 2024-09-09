# OpenLink Personal Assistant Skin (Metal)

This is a user interface layer for the OpenLink AI Layer (OPAL), bound to its Assistants Endpoint—i.e., the binding layer for interacting with Assistant Services provided by OpenAI and other Large Language Model (LLM) providers.

## Implementation

The interface (or skin) is built to interact with OPAL's services as described by its OpenAPI-compliant YAML or JSON documents. The user interface is a Single Page Application comprising HTML, CSS, and JavaScript (which includes a solid-auth client library for loosely coupled authentication services).

### Client UI

The client UI is implemented using the following components:

- jQuery 3.7
- Bootstrap 3.4
- Solid OAuth (built from OpenLink fork)

## Manual Installation and Configuration

Simply place the SPA (HTML, CSS, and JavaScript) in the Virtuoso WebDAV (or Briefcase) folder of an instance where the OPAL server components have been installed, open it up in your browser, and start a conversation with the preconfigured Assistants or create a new one for your specific needs.

## Live Instances

1. [URIBurner Service](https://linkeddata.uriburner.com/assist-metal)

