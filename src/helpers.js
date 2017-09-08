
var url = require('url'),
    cookie = require('tough-cookie'),
    trumpet = require('trumpet'),
    Entities = require('html-entities').XmlEntities;

var entities = new Entities();

String.prototype.endsWith = function(suffix) {
  return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

exports.checkContentType = function(contentTypeHeader, contentTypes) {
  // TODO: Consider improving this comparison
  if ( contentTypeHeader && contentTypeHeader.toString() ) {
    if ( contentTypes instanceof Array) {
      var match =false;
      for ( var i = 0 ; i < contentTypes.length ; i++) {
        var contentType = contentTypes[i];
        if ( contentTypeHeader.toString().indexOf(contentType) >= 0 ) {
          match = true;
          break;
        }
      }
      return match;
    }
    else {
      return contentTypeHeader.toString().indexOf(contentTypes) >= 0;
    }
  }
  else {
    return false;
  }
}

exports.removeHeaders = function(res, headerKeys){
  for ( var i=0, len = headerKeys.length; i < len ; i++ ) {
    res.removeHeader(headerKeys[i], null)
  }
};

exports.updateHead = function(dataStr, tags) {
  var tagsStr = "";
  if ( tags.baseUrl ) {
    tagsStr += '<base href="' + tags.baseUrl + '" for-screenjs-proxy="for-screenjs-proxy" />';
  }
  if ( tags.scripts ) {
    var scripts = tags.scripts;
    for ( var i = 0 , len = scripts.length ; i < len ; i++ ) {
      tagsStr += '<script type="text/javascript" src="' + scripts[i] + '" for-screenjs-proxy="for-screenjs-proxy"></script>';
    }
  }
  if ( tags.stylesheets ) {
    var stylesheets = tags.stylesheets;
    for ( var i = 0 , len = stylesheets.length ; i < len ; i++ ) {
      tagsStr += '<link href="' + stylesheets[i] + '" media="all" rel="stylesheet" type="text/css" for-screenjs-proxy="for-screenjs-proxy" />';
    }
  }
  if ( dataStr.search(/\<head[^\>]*\>/i) >= 0 ) {
    return dataStr.replace(/\<head[^\>]*\>/i, "<head>" + tagsStr);
  }
  else {
    // Not normal HTML page
    // does not have head tag
    // search for first opening HTML tag
    var re = /\<[^\>]*\>/;
    var match = re.exec(dataStr);
    if ( match ) {
      // found match which should almost always happen
      if ( match[0].indexOf("<script") == 0 ) {
        // script tag found at start
        // add tags before it
        return dataStr.replace("<script", tagsStr + "<script");
      }
      else {
        return dataStr.replace(">", ">" + tagsStr);
      }
    }
    else {
      // TODO: Consider hanndling this exceptional issue
      // Or throw exception

      throw "Could not find opening tag to add scripts";

      // return dataStr;
    }
  }
}

exports.stripPortFromUrl = function(urlWithPort){
  var parsedUrl = url.parse(urlWithPort);
  parsedUrl.port = undefined;
  parsedUrl.host = undefined;
  return url.format(parsedUrl);
};

// Following are request helpers
exports.getRequestUrl = function(req){
  // Here request headers["host"] includes port
  return getRequestProtocol(req) + "//" + req.headers['host'] + req.url;
};

var getRequestHostParts = function(requestHost){

  var subdomains = requestHost.split(":")[0].split("."), len;
  if ( ( len = subdomains.length ) > global.PROXY_URL_SUBDOMAIN_LENGTH ) {

    var port = 80;
    var protocol = "http:";

    var targetSubdomains = subdomains.slice(0, len - global.PROXY_URL_SUBDOMAIN_LENGTH);
    len = targetSubdomains.length;

    if ( subdomains[0] == "https" ) {
      protocol = "https:";
      targetSubdomains = targetSubdomains.slice(1, len);
      len = targetSubdomains.length;
    }

    // TODO: There is going to be a problem with cookies
    // when port number is at the end
    // move it to start like sport9090.www.test.com.dev-proxy.castbin.com
    // from www.test.com.9090.dev-proxy.castbin.com
    // DONE
    // but now there is problem when actuall URL starts with a number like following
    // valid URL
    // http://11682526.r.cdn77.net.dev-proxy.castbin.com/assets/browser-update-06fbdf2f9efcd9c1655cd5f9c6a78707.js
    // so checking if port number is less than 10000 an arbitary limit
    // TODO: Somehow 3000.localhost.dev-proxy.castbin.com
    // causes problem here
    if ( !isNaN(targetSubdomains[0]) && targetSubdomains[0] > 1000 && targetSubdomains[0] < 10000 && (len > 2 || targetSubdomains[1] == "localhost") ) {
      port = parseInt(targetSubdomains[0]);
      targetSubdomains = targetSubdomains.slice(1, len);
      len = targetSubdomains.length;
    }

    return {
      protocol: protocol,
      port: port,
      host: targetSubdomains.join(".")
    };
  }
  else {
    // TODO: cinsider throwing an exception
    // throw new Error('Invalid proxy URL. Can not get target hostname: ' + requestHost);

    // It can happen when loading a page in an iframe where referer becomes something like localhost:3000
    // console.trace('Invalid proxy URL. Can not get target hostname: ' + requestHost);

    var retVal = {
      protocol: "http:",
      port: requestHost.split(":")[1],
      host: requestHost.split(":")[0]
    };
    return retVal;
  }
};

exports.getRequestHostParts = getRequestHostParts; // Only used in tests

var getRequestProtocol = function(req){
  return req.connection.encrypted ? "https:" : "http:";
};

exports.getRequestProtocol = getRequestProtocol; // Only used in tests

exports.getTargetUrl = function(req){
  var requestHostParts = getRequestHostParts(req.headers.host);

  var uri = url.parse(req.url);

  var currentTargetUrl = url.format({
    protocol: requestHostParts.protocol,
    hostname: requestHostParts.host,
    port:     requestHostParts.port == 80 ? null : requestHostParts.port,
    pathname: uri.pathname,
    search:   uri.search
  });
  return currentTargetUrl;
};

// requestUri - It should always be absolute
// TODO: Consider refactoring with getTargetUrl
var translateRequestUrlToTargetUrl = function(requestUrl){
  var requestUri = url.parse(requestUrl);
  // TODO: Figure out whhy origin is "null" sometimes
  // Case: When logging in on https://castbin.slack.com/
  if (!requestUri.host) { return requestUrl; }
  var requestHostParts = getRequestHostParts(requestUri.host);

  return url.format({
    protocol: requestHostParts.protocol,
    hostname: requestHostParts.host,
    port:     requestHostParts.port == 80 ? null : requestHostParts.port,
    pathname: requestUri.pathname,
    search:   requestUri.search
  });
};

exports.translateRequestUrlToTargetUrl = translateRequestUrlToTargetUrl; // Only used in tests

exports.translateRequestUrlHeadersToTargetUrls = function(req, keys){
  for ( var i in keys ) {
    var key = keys[i];
    if ( req.headers[key] ) {

      translatedLocation = translateRequestUrlToTargetUrl(req.headers[key]);

      // console.log("%%%%%%%%%%%%%%%%%%%%%");
      // console.log(key, req.headers[key]);
      // console.log(key, translatedLocation);
      // console.log("%%%%%%%%%%%%%%%%%%%%%");

      if ( key.toLowerCase() == "origin" && translatedLocation[translatedLocation.length - 1] == "/" ) {
        req.headers[key] = translatedLocation.slice(0, -1);
      }
      else {
        req.headers[key] = translatedLocation;
      }
    }
  }
};

// used by req only for now
// TODO: Refactor with removeHeaders
exports.deleteHeaders = function(reqOrRes, keys){
  for ( var i in keys ) {
    var key = keys[i];
    if ( reqOrRes.headers[key] ) {
      delete reqOrRes.headers[key];
    }
  }
};

var translateTargetHostToRequestHost = function(targetHost, targetProtocol){
  var targetPort = targetHost.split(":")[1];
  targetHost = targetHost.split(":")[0];

  if ( targetHost.endsWith("." + global.PROXY_URL) ) {
    // For some reasons like javascript interations
    // there might be recursive proxy request generation 
    // preventing it here
    return targetHost;
  }

  targetHost = targetHost + "." + global.PROXY_URL;

  if ( targetPort ) {
    targetHost =  targetPort + "." + targetHost;
  }

  if ( targetProtocol ) {
    if ( targetProtocol == "https:" ) {
      targetHost =  "https" + "." + targetHost;
    }
    // else http
  }

  return targetHost;
};

exports.translateTargetHostToRequestHost = translateTargetHostToRequestHost;

// TODO: Everything done here assuming protocol gets coped
var translateTargetCookieToRequestCookie = function(setCookieStr, targetUri){
  setCookieStr = setCookieStr.toString();
  targetCookie = cookie.parse(setCookieStr);

  if (!setCookieStr || !targetCookie) {
    console.log("Blank cookie", setCookieStr)
    return [setCookieStr];
  }

  // ignore both of them
  // secure especially for https prefix
  // httpOnly for debugging
  // they are security measures for CSRF, MITM attacks but with limited use they are non-issue for now
  targetCookie.secure = false;
  // enable it for debugging
  // targetCookie.httpOnly = false;

  if( targetCookie.secure ){
    targetCookie.secure = false;
  }

  if ( targetCookie.domain == null ) {
    // always set domain
    // so as to let https prefixed domains to have access to cookies as well
    targetCookie.domain = targetUri.hostname;
    // return [targetCookie.toString()];
  }
  // else {
  targetCookie.domain = translateTargetHostToRequestHost(targetCookie.domain);
  return [targetCookie.toString()];
  // }
};

exports.translateTargetCookieToRequestCookie = translateTargetCookieToRequestCookie;

exports.translateSetCookieHeaders = function(res, req){
  if ( res.getHeader('set-cookie') ) {
    var setCookieList = res.getHeader('set-cookie');
    if ( !(setCookieList instanceof Array) ) { setCookieList = [ setCookieList ] }
    var translatedSetCookieList = [];
    for ( var i = 0, len = setCookieList.length ; i < len ; i++ ){
      var setCookieStr = setCookieList[i];
      translatedSetCookieList.push.apply(translatedSetCookieList,
        translateTargetCookieToRequestCookie(setCookieStr, req.sproxy.currentTargetUri)
      );
    }
    res.setHeader('set-cookie', translatedSetCookieList);
  }
};

// targetUrl - It should always be absolute
var translateTargetUrlToRequestUrl = function(targetUrl){
  var targetUri = url.parse(targetUrl);
  var requestUri = targetUri;

  // earlier returning for data: and chrome-extension:
  if ( targetUri && !(targetUri.protocol == "http:" || targetUri.protocol == "https:") ) {
    return targetUrl;
  }

  requestUri.host = translateTargetHostToRequestHost(targetUri.host, targetUri.protocol);
  requestUri.port = null;
  requestUri.protocol = "http:";

  return url.format(requestUri);
};

exports.handleLocationHeader = function(res, req){
  var location = res.getHeader('location');
  if ( typeof location !== 'undefined' ) {
    res.sproxy.originalLocation = location;
    var requestLocation = translateTargetUrlToRequestUrl(
      url.resolve(req.sproxy.currentTargetUrl, location)
    );
    res.setHeader('location', requestLocation);
  }
};

// TODO: There are many CORS errors
// http://www.youtube.com.dev-proxy.castbin.com/watch?v=kfVsfOSbJY0
// http://www.facebook.com/
// after logging in
exports.handleCORS = function(res, req){
  var accessControlAllowOrigin = res.getHeader("access-control-allow-origin");

  if ( typeof accessControlAllowOrigin !== 'undefined' && accessControlAllowOrigin != "*" ) {

    // TODO: Allowing any origin for now
    // Debug issue with proxifying provided URL
    var originalOrigin = req.sproxy.originalHeaders["origin"];

    if ( originalOrigin ) {
      res.setHeader("access-control-allow-origin", originalOrigin);
    }
    else {
      // accessControlAllowOrigin = translateTargetUrlToRequestUrl(
      //   // ideally it should be absolute
      //   url.resolve(req.sproxy.currentTargetUrl, accessControlAllowOrigin)
      // );

      res.setHeader("access-control-allow-origin", "*");
    }
      
  }
  else {

    if ( req.sproxy.originalHeaders["origin"] ) {
      res.setHeader("access-control-allow-origin", "*");
    }

    // var contentType = res.getHeader("content-type");
    // 
    // if (!contentType || // Some times fonts don't have any content-type
    //    (contentType.indexOf("font/") == 0 ||
    //     contentType.indexOf("text/plain") == 0 ||
    //     contentType.indexOf("application/vnd.ms-fontobject") == 0 ||
    //     contentType.indexOf("application/font-woff") == 0 ||
    //     contentType.indexOf("application/x-font-woff") == 0 ||
    //     contentType.indexOf("application/octet-stream") == 0 // ||
    //     // contentType.indexOf("application/x-gzip") == 0
    //   )) {
    //   res.setHeader("access-control-allow-origin", "*");
    // }
    // else {
    //   res.setHeader("access-control-allow-origin", "*");
    // }
  }
};

exports.translateRequestParamDomainsToTargetParamDomains = function(req){
  // TODO: Do it for post params as well
  // TODO: Handle ports as well
  req.url = req.url.replace(new RegExp("\\b(https\\.)?((?:[a-z0-9]+(-[a-z0-9]+)*\\.)+[a-z]{2,})" + ("." + global.PROXY_URL).replace(".", "\\."), "gi"), function(m, prefix, host){
    return host;
  });
};

var resselectors = resselectors || [];

exports.translateResponseScripts = function(res, data, encoding){
  var tr = trumpet();

  tr.on('data', function (buf) { 
    res._write(buf);
  });

  return tr;
};

exports.translateScriptSrc = function(scriptSrc, req){
  // TODO: Handle invalid Url
  var translatedRequestUrl = translateTargetUrlToRequestUrl(
    // NOTE: This call fixes issues with Zoho's odd URLs but can cause issue on other websites
    url.resolve(req.sproxy.currentTargetUrl, entities.decode(scriptSrc))
    // url.resolve(req.sproxy.currentTargetUrl, scriptSrc)
  );

  return translatedRequestUrl;
};

exports.translateFrameSrc = function(frameSrc, req){
  // TODO: Handle invalid Url
  var translatedRequestUrl = translateTargetUrlToRequestUrl(
    // NOTE: This call fixes issues with Zoho's odd URLs but can cause issue on other websites
    url.resolve(req.sproxy.currentTargetUrl, entities.decode(frameSrc))
    // url.resolve(req.sproxy.currentTargetUrl, frameSrc)
  );

  return translatedRequestUrl;
};

exports.translateLinkHref = function(linkHref, req){
  // TODO: Handle invalid Url
  var translatedRequestUrl = translateTargetUrlToRequestUrl(
    url.resolve(req.sproxy.currentTargetUrl, entities.decode(linkHref))
    // url.resolve(req.sproxy.currentTargetUrl, linkHref)
  );

  return translatedRequestUrl;
};

exports.translateFontSrc = function(fontSrc, req){
  if ( fontSrc.trim().indexOf("data:") == 0 ) { return fontSrc; }
  var translatedRequestUrl = translateTargetUrlToRequestUrl(
    url.resolve(req.sproxy.currentTargetUrl, entities.decode(fontSrc))
    // url.resolve(req.sproxy.currentTargetUrl, fontSrc)
  );

  return translatedRequestUrl;
};


// TODO: Handle document.domain as well

// TODO: Override confirm dialoag and use popup box for it
// TODO: Override alert dialoag and use popup box for it