var http = require('http'),
    https = require('https'),
    fs = require('fs'),
    httpProxy = require('http-proxy'),
    cookie = require('tough-cookie'),
    url = require('url'),
    C = require('./consts'),
    helpers = require('./helpers'),
    transformer = require('./transformer'),
    ce = require('cloneextend'),
    static = require('node-static'),
    http = require('http'),
    util = require('util'),
    trumpet = require('trumpet'),
    through = require('through'),
    duplexer = require('duplexer'),
    concat = require('concat-stream'),
    UglifyJS = require("uglify-js"),
    Iconv  = require('iconv').Iconv,
    zlib = require('zlib'),
    ejs = require('ejs');

var webroot = './public';

var file = new(static.Server)(webroot, {
  cache: 600,
  headers: { 'X-Powered-By': 'node-static' }
});

var latin1ToUtf8 = new Iconv('latin1', 'UTF-8'); //, 'ISO-8859-1');

// following function will return a handler for both http and https server
// Note: We will be creating 2 servers
// 1. http server to proxy http request
// 2. Other https to proxy https requests
function getProtocolHandler(protocol){
  return (function(protocol){

    var proxy = new httpProxy.RoutingProxy({});

    proxy.on('start', function (req, res, target) {

      delete req.headers["x-forwarded-for"];

      // causing problem with facebook oAuth
      delete req.headers["x-forwarded-port"];

      // Was needed for github.com redirect loop especially
      delete req.headers["x-forwarded-proto"];

      // Read more: http://stackoverflow.com/questions/31950470/what-is-the-upgrade-insecure-requests-http-header
      delete req.headers["Upgrade-Insecure-Requests"];

      console.log("Headers as sent by proxy:");
      console.log(JSON.stringify(req.headers, null, 2));
      
    });

    proxy.on('end', function (req, res, target) {
      console.log("==============================================================");
    });

    proxy.on('proxyError', function (err, req, res) {
      // FIXME: This error is printed two times!
      // TODO: Handle the error by displaying a message
      console.log(err);
    });

    return function(req, res){

      // serve screenjs-proxy.js
      // file for use in proxied html pages
      if ( req.headers.host == "static." + global.PROXY_URL ||
           req.headers.host == "localhost" ||
           req.headers.host == "fuf.me" ||
           req.headers.host == "42foo.com" ||
           req.headers.host == process.env.SELF_STATIC_HOST ) {

        if (req.url.indexOf("/screenjs-proxy.js") == "0") {
          res.setHeader("content-type", "text/javascript");
          res.setHeader("cache-control", "max-age=600");

          if ( process.env.IS_DEVELOPMENT ) {
            // Use following on dev env for debugging
            fs.readFile("./public/screenjs-proxy.js", function(err, str){
              var data = {
                PROXY_HOST: global.PROXY_URL,
                ASSET_HOST: global.ASSET_HOST
              };

              str = ejs.render(str.toString(), data);

              // res.end(UglifyJS.minify("./public/screenjs-proxy.js").code);
              res.end(str);
            });
          }
          else {
            res.end(UglifyJS.minify("./public/screenjs-proxy.js").code);
          }
        }
        else if ( req.url == "/debug" ) {
          var resText = "";

          resText += "Method:\n"
          resText += req.method;
          resText += "\n";

          resText += "Headers:\n"
          resText += JSON.stringify(req.headers, null, 2);
          resText += "\n";

          if(req.method == "POST") {
            var body = "";
            req.on("data", function(chunk){
              chunk = chunk || "";
              body+=chunk.toString();
            });
            req.on("end", function(chunk){
              chunk = chunk || "";
              body+=chunk.toString();

              resText += "BODY:\n"
              resText += body;
              resText += "\n";

              res.end(resText);
            });
          }
          else {
            res.end(resText);
          }
        }
        else {
          file.serve(req, res, function(err, result) {
            if (err) {
              console.error('Error serving %s - %s', req.url, err.message);
              res.writeHead(err.status, err.headers);
              res.write("There was error processing your request.");
              res.end();
            } else {
              console.log('%s - %s', req.url, res.message);
            }
          });
        }

        return;
      }

      var currentRequestUrl = helpers.getRequestUrl(req);
      var currentRequestUri = url.parse(currentRequestUrl);

      console.log("\nRequest received:", currentRequestUrl);

      var currentRequestUriWithParsedQuery = url.parse(currentRequestUrl, true);
      if ( currentRequestUriWithParsedQuery.query["cbpvtreferer"] ) {
        var cbpvtreferer = currentRequestUriWithParsedQuery.query["cbpvtreferer"];
        req.headers["referer"] = currentRequestUriWithParsedQuery.query["cbpvtreferer"];

        console.log("Querystring referer:", cbpvtreferer);

        var currentRequestUriWithoutParsedQuery = url.parse(currentRequestUrl);

        // currentRequestUriWithParsedQuery.query["cbpvtreferer"] = undefined;
        // delete currentRequestUriWithParsedQuery.query["cbpvtreferer"];
        // currentRequestUriWithParsedQuery.search = null; // as url.format considers onl;y search if present

        currentRequestUriWithoutParsedQuery.query = currentRequestUriWithoutParsedQuery.query.split("&cbpvtreferer=", 1)[0];
        currentRequestUriWithoutParsedQuery.query = currentRequestUriWithoutParsedQuery.query.split("cbpvtreferer=", 1)[0];
        currentRequestUriWithParsedQuery.search = null; // as url.format considers onl;y search if present

        // currentRequestUriWithoutParsedQuery.query = currentRequestUriWithoutParsedQuery.query

        currentRequestUrl = url.format(currentRequestUriWithoutParsedQuery);
        currentRequestUri = url.parse(currentRequestUrl);

        // helpers.getTargetUrl uses it
        req.url = currentRequestUri.path;
      }

      var currentTargetUrl = helpers.getTargetUrl(req);
      var currentTargetUri = url.parse(currentTargetUrl);

      req.sproxy = {
        currentRequestUrl: currentRequestUrl,
        currentRequestUri: currentRequestUri,
        currentTargetUrl: currentTargetUrl,
        currentTargetUri: currentTargetUri,
        originalHeaders: ce.clone(req.headers)
      };

      req.headers["host"] = currentTargetUri.host;
      req.headers["cbproxiedrequest"] = undefined;
      delete req.headers["cbproxiedrequest"];

      if (req.headers["access-control-request-headers"]) {

        var acrh = req.headers["access-control-request-headers"];
        var reqHeaders = acrh.split(",").map(function(h){return h.trim();});
        var delIndex = reqHeaders.indexOf("cbproxiedrequest");
        if (delIndex>-1) {
          reqHeaders.splice(delIndex, 1)
          req.sproxy.cbproxiedrequestRemovedFromAcrh = true;
        }
        var newAcrh = reqHeaders.join(", ");
        if (newAcrh) {
          req.headers["access-control-request-headers"] = newAcrh;
        }
        else {
          req.headers["access-control-request-headers"] = undefined;
          delete req.headers["access-control-request-headers"];
        }
      }

      helpers.translateRequestUrlHeadersToTargetUrls(req, ["origin", "referer"]);

      helpers.translateRequestParamDomainsToTargetParamDomains(req);

      var headersWritten = {};

      res._setHeader = res.setHeader;
      res.setHeader = function(key, val) {
        // var entry = {};
        // entry[key] = val;
        // headersWritten.push(entry);
        headersWritten[key] = val;
        return res._setHeader(key, val);
      };

      // TODO: Find out if closure is needed here?
      res._WriteHead = res.writeHead;
      res.writeHead = function(statusCode, headers) {


        console.log("Headers as received by proxy for", currentRequestUrl);
        console.log(JSON.stringify(headersWritten, null, 2));

        res.sproxy = {
          contentType: res.getHeader('content-type')//,
          // contentEncoding: res.getHeader('content-encoding')
        };

        helpers.translateSetCookieHeaders(res, req);

        helpers.handleLocationHeader(res, req);

        helpers.handleCORS(res, req);

        if ( req.sproxy.cbproxiedrequestRemovedFromAcrh ) {
          var acah = res.getHeader("access-control-allow-headers");
          if (acah.trim() != "*") {
            if (acah) {
              var resAcahHeaders = acah.split(",").map(function(h){return h.trim();});
              resAcahHeaders.push("cbproxiedrequest");
              res.setHeader("access-control-allow-headers", resAcahHeaders.join(", "));
            }
            else {
              res.setHeader("access-control-allow-headers", "cbproxiedrequest");
            }
          }
        }

        helpers.removeHeaders(res, [
            "x-forwarded-proto",
            "Content-Length",
            // TODO: facebook.com has possible issues because of this.
            // They seem to be not using CORS headers but using this header
            "x-webkit-csp",
            "x-frame-options",
            "X-XSS-Protection",
            "Content-Security-Policy",
            "X-Content-Security-Policy",
            "Content-Security-Policy-Report-Only"
          ]
        );

        if ( res.getHeader('content-encoding') == "gzip" ) {

          var gunzip = zlib.createGunzip();
          
          gunzip.on('data', function(data) {
            if (!data instanceof Buffer) {
              data = Buffer(data);
            }
            res._forDecodingWrite(data);
          });

          gunzip.on('end', function(data) {
            res._forDecodingEnd();
          });

          res._forDecodingWrite = res.write;
          res.write= function(data, encoding){
            gunzip.write(data);
          };

          res._forDecodingEnd = res.end;
          res.end = function(data, encoding){
            if (data && data.length > 0) {
              gunzip.write(data);
            }
            gunzip.end(data);
          };

          // res.removeHeader('content-encoding');
        }

        if ( helpers.checkContentType(res.sproxy.contentType, [
          "image/gif",
          "image/jpeg",
          "image/pjpeg",
          "image/png",
          // TODO: May be need different HTML response
          // "image/svg+xml",
          "image/tiff"
        ]) ) {
          // TODO: For image types consider ressponding with an HTML page
          // with that image and added scripts

          // check if request accepts text/html
          if ( helpers.checkContentType(req.sproxy.originalHeaders["accept"], "text/html") ) {
            // that means the request for image came from a page rather than from an img tag
            // so we should respond with HTML containing image tag referring to the image.
            res.sproxy.contentType = 'text/html; charset=utf-8';

            res.setHeader('content-type', res.sproxy.contentType);
            
            var retVal = res._WriteHead(statusCode, headers);
            // TODO: Improve this HTML
            var data = '<html><head></head><body style="margin: 0px;"><img style="-webkit-user-select: none;" src="'+ req.sproxy.currentTargetUrl +'"></body></html>';
            res.write.call(res, data);
            res.end();
            return retVal;
          }
          else {
            // res._write.call(res, data);
            return res._WriteHead(statusCode, headers);
          }
        }

        return res._WriteHead(statusCode, headers);
      };

      // following gzip compresser will be applied last
      // as it is overriden first here
      var gzip = zlib.createGzip();

      // res.setHeader('content-encoding', 'gzip');

      gzip.on('data', function(data) {
        res._beforeEncodingWrite(data);
      });

      gzip.on('end', function(data) {
        res._beforeEncodingEnd(data);
      });

      res._beforeEncodingWrite = res.write;
      res.write = function(data, encoding){
        if ( res.getHeader('content-encoding') == "gzip" ) {
          gzip.write(data);
        }
        else {
          res._beforeEncodingWrite(data, encoding);
        }
      };

      res._beforeEncodingEnd = res.end;
      res.end = function(data, encoding){
        if ( res.getHeader('content-encoding') == "gzip" ) {
          if (data) {
            gzip.write(data);
          }
          gzip.end();
        }
        else {
          res._beforeEncodingEnd(data, encoding);
        }
      };
      // gzip encoding block ends

      var firstBufferFound = false;
      var bufferTillFirstOpeningTag = null;

      var dataStr;
      var jsBuffer = Buffer("");
      var cssBuffer = Buffer("");
      var lastReamainingBuffer = Buffer("");

      // Using res._Write rather than simple _write is important
      res._write = res.write;
      res.write = function (data, encoding) {

        // console.log(data.toString() + "\n\n\n\n");
        // TODO: This gets called even after responded with HTML for
        // image content-type
        // avoid this. Check write head for the response imeplementation

        // TODO: Check if encoding is ever defined 
        if ( // This means it is an AJAX request, so no need to update HEAD
             !helpers.checkContentType(req.sproxy.originalHeaders["accept"], "application/json") &&
             !req.sproxy.originalHeaders["cbproxiedrequest"] &&
             // Checking method as chrome sends origin header for POST/PUT/DELETE requests
             !(req.method == "GET" && req.sproxy.originalHeaders["origin"]) && // Cross domain AJAX
             ( helpers.checkContentType(res.sproxy.contentType, "text/html") ||
               // If no content type specified assume text/html if supported by client
               ( res.sproxy.contentType === undefined &&
                 helpers.checkContentType(req.sproxy.originalHeaders["accept"], "text/html")
               )
             )
        ) {

          // Start of removal of partial UTF chars
          // TODO: Improve following code
          // - Stub it in helper possibly
          // - User Buffer.slice to avoid making copies
          // if ( lastReamainingBuffer.length > 0 ) {
          //   data = Buffer.concat([lastReamainingBuffer, data]);
          //   lastReamainingBuffer = Buffer("");
          // }

          // var dataStr = data.toString();
          // var dataStrLen = dataStr.length;

          // for ( var i = 0; dataStr.slice(-1) == "\uFFFD" ; i++ ) {
          //   dataStr = dataStr.slice(0, -1);
          // }

          // if ( i > 0 ) {
          //   lastReamainingBuffer = Buffer(data.length - Buffer.byteLength(dataStr, 'utf8'));
          //   data.copy(lastReamainingBuffer, 0, Buffer.byteLength(dataStr, 'utf8'));
          //   data = Buffer(dataStr);
          // }
          // End of removal of partial UTF chars

          // removing meta tags which are replacement of headers
          // Not worrying about partial tags as
          // transformer.apply
          // concatenates them
          // also there is UTF handler which caches everything
          // <meta http-equiv="X-Frame-Options" content="deny" />
          // "x-webkit-csp", "x-frame-options", "X-XSS-Protection", "Content-Security-Policy", "X-Content-Security-Policy"

          data = data || "";
          dataStr = data.toString();

          // dataStr = dataStr.replace(/<meta[^<>]+(x-webkit-csp|x-frame-options|x-xss-protection|content-security-policy|x-content-security-policy|content-security-policy-report-only)[^<>]+>/gi, function(metaTag){
          //   return "";
          // });

          dataStr = dataStr.replace(/<meta[^<>]+http-equiv\=[\"\']?\s*(x-webkit-csp|x-frame-options|x-xss-protection|content-security-policy|x-content-security-policy|content-security-policy-report-only)\s*[\"\']?[^<>]+>/gi, function(metaTag){
            // return "<meta issue=\"found123\" />";
            return "";
          });

          dataStr = dataStr.replace(/(<meta[^<>]+)(http-equiv\=[\"\']?refresh[\"\']?)([^<>]+>)/gi, function(m, p1, attr, p2){
            attr = 'http-equiv-orig="refresh"';
            return [p1, attr, p2].join("");
          });

          data = Buffer(dataStr);


          if ( !firstBufferFound ) {

            // firstBufferFound = true;

            // TODO: Detect charset from header and use it here
            // content-type has charset set most of the time
            // otherwise use
            // https://github.com/mooz/node-icu-charset-detector
            dataStr = data.toString();

            if ( bufferTillFirstOpeningTag ) {
              dataStr = bufferTillFirstOpeningTag + dataStr;
            }

            var assetVer = process.env.ASSET_VER || 1;

            var stylesheets = [
              // TODO: Make it configurable
              // "http://" + global.ASSET_HOST + "/assets/proxy/chosen.css?" + assetVer,
            ];

            try {
              dataStr = helpers.updateHead(dataStr, {
                baseUrl: currentTargetUrl,
                scripts: [
                  // This is a requirement for proxy to run correctly
                  "http://static." + global.PROXY_URL + "/screenjs-proxy.js?" + assetVer,
                  // TODO: Make it configurable
                  // "http://" + global.ASSET_HOST + "/assets/proxy/jquery.js?" + assetVer
                ],
                // TODO: Consider whether this is actually needed
                stylesheets: stylesheets
              });
              data = Buffer(dataStr);
              firstBufferFound = true;
              bufferTillFirstOpeningTag = null;
            }
            catch(e) {
              bufferTillFirstOpeningTag = dataStr;
              console.log(e);
            }
          }

          if (!bufferTillFirstOpeningTag) {
            res._write.call(res, data);
          }
        }
        else if ( helpers.checkContentType(res.sproxy.contentType, [
          "text/javascript",
          "application/javascript",
          "application/x-javascript"
        ]) ) {
          jsBuffer = Buffer.concat([jsBuffer, new Buffer(data)]);
        }
        else if ( helpers.checkContentType(res.sproxy.contentType, [
          "text/css"
        ]) ) {
          cssBuffer = Buffer.concat([cssBuffer, new Buffer(data)]);
        }
        else {
          res._write.call(res, data);
        }
      };

      res._end = res.end;
      res.end = function(data, encoding){

        // Start of of removal of partial UTF chars
        // if ( lastReamainingBuffer.length > 0 ) {
        //   data = data || Buffer(0);
        //   data = Buffer.concat([lastReamainingBuffer, data]);
        // }
        // End of of removal of partial UTF chars

        if ( helpers.checkContentType(res.sproxy.contentType, [
          "text/javascript",
          "application/javascript",
          "application/x-javascript"
        ]) ) {

          data = data || Buffer("");
          jsBuffer = Buffer.concat([jsBuffer, data]);

          var jsBufferStr = jsBuffer.toString();

          function transformedWriteOut() {

            // var isAjaxCall = false;
            // if ( req.sproxy.originalHeaders["origin"] ) {
            //   isAjaxCall = true;
            // }

            var checkForJSON = true;

            jsBufferStr = transformer.transformScript(jsBufferStr, null, checkForJSON);
            res._write.call(res, jsBufferStr, encoding);
          }

          if ( jsBufferStr.indexOf("\uFFFD") >= 0 ) {

            console.log("Using latin1 encoding");

            jsBufferStr = latin1ToUtf8.convert(jsBuffer).toString();

            if ( jsBufferStr.indexOf("\uFFFD") >= 0 ) {
              res._write.call(res, jsBuffer, encoding);
            }
            else {
              transformedWriteOut();
            }
          }
          else {
            transformedWriteOut()
          }

          res._end(null, encoding);
        }
        else if ( helpers.checkContentType(res.sproxy.contentType, [
          "text/css"
        ]) ) {
          data = data || Buffer("");
          cssBuffer = Buffer.concat([cssBuffer, data]);

          var cssBufferStr = cssBuffer.toString();

          if ( cssBufferStr.indexOf("\uFFFD") >= 0 ) {
            res._write.call(res, cssBuffer, encoding);
          }
          else {
            cssBufferStr = transformer.transformCSS(cssBufferStr, req);
            res._write.call(res, cssBufferStr, encoding);
          }

          res._end(null, encoding);
        }
        else {

          if (bufferTillFirstOpeningTag) {
            var dataToWrite = bufferTillFirstOpeningTag
            firstBufferFound = true;
            bufferTillFirstOpeningTag = null;
            res._write(dataToWrite, encoding);            
          }

          res._end(data, encoding);
        }
      };

      // FIXME: It is causing problem with images
      // Update: 22 Sep 13
      // No more causong ptoblem with images but might cause problem with other content types
      transformer.apply(res, req);

      res._withoutUTFHandlerWrite = res.write;
      res.write = function(data, encoding){
        if ( helpers.checkContentType(res.sproxy.contentType, "text/html") ||
             helpers.checkContentType(res.sproxy.contentType, [
               "text/javascript",
               "application/javascript",
               "application/x-javascript"
        ]) || helpers.checkContentType(res.sproxy.contentType, [
               "text/css"
        ])) {

          if (! data instanceof Buffer) {
            data = Buffer(data);
          }

          if ( lastReamainingBuffer.length > 0 ) {
            data = Buffer.concat([lastReamainingBuffer, data]);
            lastReamainingBuffer = Buffer("");
          }

          var dataStr = data.toString();
          var dataStrLen = dataStr.length;

          for ( var i = 0; dataStr.slice(-1) == "\uFFFD" ; i++ ) {
            dataStr = dataStr.slice(0, -1);
          }

          // var maxAllowedToRemoveFromEnd = Math.min(6, dataStr.length); // as it is the number of bytes UTF can have at max infor one character

          // for ( var i = 0; ; i++ ) {
          //   var lastChar = dataStr.slice(-1);
          //   if ( (lastChar != "\uFFFD" && lastChar.charCodeAt(0) < 128) || maxAllowedToRemoveFromEnd == i ) {
          //     break;
          //   }
          //   else {
          //   }
          //   dataStr = dataStr.slice(0, -1);
          // }

          if ( i > 0 ) {
            lastReamainingBuffer = Buffer(data.length - Buffer.byteLength(dataStr, 'utf8'));
            data.copy(lastReamainingBuffer, 0, Buffer.byteLength(dataStr, 'utf8'));
            data = Buffer(dataStr);
          }
        }

        return res._withoutUTFHandlerWrite(data, encoding);
      };

      res._withoutUTFHandlerEnd = res.end;
      res.end = function(data, encoding){
        if ( lastReamainingBuffer.length > 0 ) {
          data = data || Buffer(0);
          data = Buffer.concat([lastReamainingBuffer, data]);
        }
        return res._withoutUTFHandlerEnd(data, encoding);
      };

      if ( req.sproxy.currentTargetUri.protocol == "https:" ) {
        console.log("Sending https request:", req.sproxy.currentTargetUrl);
        proxy.proxyRequest(req, res, {
          target: {
            host: currentTargetUri.hostname,
            port: currentTargetUri.port || 443,
            https: true
          }
        });
      }
      else {
        console.log("Sending http request:", req.sproxy.currentTargetUrl);
        proxy.proxyRequest(req, res, {
          target: {
            host: currentTargetUri.hostname,
            port: currentTargetUri.port || 80
          }
        });
      }
    };
  })(protocol);
};

var options = {
  // https: {
  //   key: fs.readFileSync('./assets/key.pem', 'utf8'),
  //   cert: fs.readFileSync('./assets/cert.pem', 'utf8')
  // }
};

var port = process.env.PORT || 80;

console.log("Listening on port " + port);

// Source: http://stackoverflow.com/questions/18461979/node-js-error-with-ssl-unable-to-verify-leaf-signature
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// var handlerWithExceptionHandling = getProtocolHandler("http:");

var handlerWithExceptionHandling = function(){
  try {
    getProtocolHandler("http:").apply(this, arguments);
  }
  catch(err){
    console.error("Error happened while processing request. arguments >>");
    console.log(err);
    console.log(arguments);
  }
};

var httpServer = http.createServer(handlerWithExceptionHandling).listen(port);
// var httpsServer = https.createServer(options.https, getProtocolHandler("https:")).listen(443);
