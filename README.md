# plugin-proxy

Node http proxy with support to add JS/CSS code like browser plugin/userscript.

# Usage

1. Copy and rename .env-sample to .env and modify the settings or use default ones
2. Start the server with `sudo node src/server`
3. Navigate to a proxied website with URL of following form

`
http://www.example.com.dev-proxy.castbin.com/
`

Replace www.example.com with any URL.

As a general rule any URL can be proxied using following format

Original URL: http://www.anyurl.com/any/log/path?query=1

Proxied URL: http://www.anyurl.com.dev-proxy.castbin.com/any/log/path?query=1

You can use your own server with wildcard subdomain instead of dev-proxy.castbin.com by modifying PROXY_HOST in .env