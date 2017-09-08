var env = require('node-env-file');

env('./.env');

global.PROXY_URL = process.env.PROXY_HOST || "proxy.castbin.com";
global.PROXY_URL_SUBDOMAIN_LENGTH = global.PROXY_URL.split(".").length;
global.ASSET_HOST = process.env.ASSET_HOST || "www.castbin.com";