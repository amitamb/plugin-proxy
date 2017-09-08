"use strict";
// Use following command to serve this file
// ruby -run -e httpd . -p 5000

// Following are the ways by which user can
// navigate to different page from current page

// 1. By clicking on the link
// Testing23

if ( !window.screenjsran ) {

console.log("SCREENJS_PROXY V0.1");

window.cbTempMouseEvents = [];
window.cbTempMouseHandler = function(domEvent){
  window.cbTempMouseEvents.push({
    // time: Date.now() - 1000000, // (isBrowserFirefox ? Date.now() : domEvent.timeStamp),
    // time: __getEventTimestamp(domEvent),
    time: Date.now(),
    type: "mousemove",
    data: {
      cX: domEvent.clientX,
      cY: domEvent.clientY,
      mX: domEvent.movementX,
      mY: domEvent.movementY,
      noRepositioning: true
    }
  });
};
var isBrowserFirefox = /Firefox/.test(navigator.userAgent);
var isBrowserChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
document.addEventListener("mousemove", window.cbTempMouseHandler, true);

if (isBrowserFirefox) {
  function __getEventTimestamp(event){
    return event.timeStamp;
  }
}
else if (isBrowserChrome && performance) {
  function __getEventTimestamp(event){
    return performance.timing.navigationStart + event.timeStamp ;
  }
}
else {
  function __getEventTimestamp(event){
    if (performance) {
      var retVal = performance.timing.navigationStart + performance.now();
    }
    else {
      var retVal = Date.now();
    }
    return retVal;
  }
}


window.addEventListener("unload", function(){
  console.log(Date.now(), "unload event called");
});

// TODO: Think of better way than this like inside event
var screenjsGlobal = {};

screenjsGlobal.PROXY_URL = "<%= PROXY_HOST %>";
screenjsGlobal.ASSET_HOST = "<%= ASSET_HOST %>" || "www.castbin.com";
screenjsGlobal.PROXY_PORT = 80;
screenjsGlobal.PROXY_URL_SUBDOMAIN_LENGTH = screenjsGlobal.PROXY_URL.split(".").length;

// Following 5 functions are copied from helpers.js
String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

var translateTargetHostToRequestHost = function(targetHost, targetProtocol){
  var targetPort = targetHost.split(":")[1];
  targetHost = targetHost.split(":")[0];

  if ( targetHost.endsWith("." + "castbin.com") ) {
    // For some reasons like javascript interations
    // there might be recursive proxy request generation 
    // preventing it here
    return targetHost;
  }

  targetHost = targetHost + "." + screenjsGlobal.PROXY_URL;

  if ( targetPort && targetPort != 80 && targetPort != 443 ) {
    targetHost =  targetPort + "." + targetHost;
  }

  if ( targetProtocol ) {
    if ( targetProtocol == "https:" && targetHost.indexOf("https.") !== 0 ) {
      targetHost =  "https" + "." + targetHost;
    }
    // else http
  }

  return targetHost;
};

// targetUrl - It need not be absolute
var translateTargetUrlToRequestUrl = function(targetUrl){
  var requestUri = document._createElement("a");
  requestUri._href = targetUrl;

  if ( requestUri._protocol != "https:" && requestUri._protocol != "http:" ) {
    return targetUrl;
  }

  requestUri._host = translateTargetHostToRequestHost(requestUri._host, requestUri._protocol);
  // TODO: Fix following
  // FIXME: Fix it
  // if ( window.location.protocol == "https:" ){
  //   requestUri.port = 443; // Ignored if 80
  // }
  // else {
  //   requestUri.port = 80; // Ignored if 80
  // }
  if (requestUri._port) {
    requestUri._port = 80;
  }
  requestUri._protocol = "http:";

  return requestUri._href;
};

var getRequestHostParts = function(requestHost){

  var subdomains = requestHost.split(":")[0].split("."), len;
  if ( ( len = subdomains.length ) > screenjsGlobal.PROXY_URL_SUBDOMAIN_LENGTH &&
        requestHost.split(":")[0].endsWith(screenjsGlobal.PROXY_URL)
   ) {

    var port = 80;
    var protocol = "http:";

    var targetSubdomains = subdomains.slice(0, len - screenjsGlobal.PROXY_URL_SUBDOMAIN_LENGTH);
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
    if ( !isNaN(targetSubdomains[0]) && targetSubdomains[0] > 1000 && targetSubdomains[0] < 10000  && (len > 2 || targetSubdomains[1] == "localhost") ) {
      port = parseInt(targetSubdomains[0]);
      targetSubdomains = targetSubdomains.slice(1, len);
      len = targetSubdomains.length;
    }

    return {
      protocol: protocol,
      port: port,
      host: targetSubdomains.join("."),
      hostname: targetSubdomains.join(".")
    };
  }
  else {
    // TODO: cinsider throwing an exception
    // throw new Error('Invalid proxy URL. Can not get target hostname: ' + requestHost);
    // console.trace('Invalid proxy URL. Can not get target hostname: ' + requestHost);
    return {
      protocol: "http:",
      port: 80,
      host: requestHost,
      hostname: requestHost
    }
  }
};

var translateRequestUrlToTargetUrl = function(requestUrl){
  var requestUri = document._createElement("a");
  requestUri._href = requestUrl;
  // url.parse(requestUrl);
  var requestHostParts = getRequestHostParts(requestUri._host);

  var targetUri = document._createElement("a");
  targetUri._href = "";

  targetUri._protocol = requestHostParts.protocol;
  targetUri._hostname = requestHostParts.host;
  if ( requestHostParts.port != 80 || targetUri._port != "" ) {
    targetUri._port = requestHostParts.port;
  }
  targetUri.pathname = requestUri.pathname;
  targetUri.search = requestUri.search;
  if ( requestUri.hash ){
    targetUri.hash = requestUri.hash;
  }

  return targetUri._href;
};
// Above 5 functions are copied from helpers.js

function replaceAll(find, replace, str) {
  return str.replace(new RegExp(find, 'g'), replace);
}

function proxifyHTML(htmlContent){

  htmlContent = htmlContent.replace(/(<script[^<>]+)(src\=[\"\']?)([^\ >\'\"]+)([\"\']?)([^<>]?>)/gi, function(m, p1, p2, attr, p3, p4){
    var newAttr = translateTargetUrlToRequestUrl(attr);
    var retVal;
    if ( attr == newAttr ) {
      retVal = [p1, p2, newAttr, p3, p4].join("");
    }
    else {
      retVal = [p1, p2, newAttr, p3, " screenjs-proxified=\"true\" ", p4].join("");
    }    
    return retVal;
  });

  htmlContent = htmlContent.replace(/(<iframe[^<>]+)(src\=[\"\']?)([^\ >\'\"]+)([\"\']?)([^<>]?>)/gi, function(m, p1, p2, attr, p3, p4){
    // attr = translateTargetUrlToRequestUrl(attr);
    // return [p1, p2, attr, p3, p4].join("");

    var newAttr = translateTargetUrlToRequestUrl(attr);
    var retVal;
    if ( attr == newAttr ) {
      retVal = [p1, p2, newAttr, p3, p4].join("");
    }
    else {
      retVal = [p1, p2, newAttr, p3, " screenjs-proxified=\"true\" ", p4].join("");
    }    
    return retVal;

  });

  return htmlContent;

}

function proxifyScript(scriptContent){
  scriptContent = replaceAll("location.href", "proxy_location.href", scriptContent);
  scriptContent = replaceAll("location.replace", "proxy_location.replace", scriptContent);
  scriptContent = replaceAll("location.assign", "proxy_location.assign", scriptContent);
  scriptContent = replaceAll("location.host", "proxy_location.host", scriptContent);
  scriptContent = replaceAll("top.location", "proxy_location", scriptContent);
  scriptContent = replaceAll("parent.location", "proxy_location", scriptContent);
  scriptContent = replaceAll("\\.location", ".proxy_location", scriptContent);

  var prefix = "if(window.__winObj==null){window.__winObj={};console.error('__winObj');};with(window.__winObj){\n";
  var suffix = "\n}";

  if ( !scriptContent.startsWith(prefix) ) {
    // scriptContent = prefix + scriptContent + suffix;
  }

  return scriptContent;
}

(function(){

  function appendNodeToHead(parentDocument, name, attribs){
    var node = parentDocument.createElement(name);
    attribs = attribs || [];
    for ( var k in attribs ) {
      node.setAttribute(k, attribs[k]);
    }
    node.setAttribute("for-screenjs-proxy", "for-screenjs-proxy");
    parentDocument.head.appendChild(node);
  };

  document.addEventListener("load", function(e){
    var eTarget = e.target;
    // Disabling it for now
    if ( eTarget.tagName === "IFRAME_FALSE" ) {

      try {
        var contentDocument = e.target.contentDocument;
        var contentWindow = e.target.contentWindow;
        if ( contentDocument ) {
          // can access frame
          // console.warn("Can access frame.", e.target);
          if ( contentWindow.screenjsran ) {
            // console.warn("screenjsran");
          }
          else {
            // console.warn("screenjsran not ran");
            // console.warn("almost always about:blank frame");

            // console.warn(contentDocument.head);

            var scriptSrc = document.querySelector("script[for-screenjs-proxy]").getAttribute("src")
            var assetVer = 0;
            if ( scriptSrc ) {
              assetVer = scriptSrc.split("?")[1];
            }

            [
              // This is a requirement for proxy to run correctly
              "http://static." + screenjsGlobal.PROXY_URL + "/screenjs-proxy.js?" + assetVer,
              // "http://code.jquery.com/jquery-1.9.1.min.js",
              "http://" + screenjsGlobal.ASSET_HOST + "/assets/proxy/jquery.js?" + assetVer,
              "http://" + screenjsGlobal.ASSET_HOST + "/assets/proxy/init.js?" + assetVer,
              // "http://" + global.ASSET_HOST + "/assets/proxy/canvas.js?" + assetVer,
              "http://" + screenjsGlobal.ASSET_HOST + "/assets/proxy/mutation_summary.js?" + assetVer,
              "http://" + screenjsGlobal.ASSET_HOST + "/assets/proxy/tree_mirror.js?" + assetVer,
              // TODO: Try loading it inside javascript
              "http://" + screenjsGlobal.ASSET_HOST + "/assets/proxy/chosen.js?" + assetVer,
              "http://" + screenjsGlobal.ASSET_HOST + "/assets/proxy/overrides.js?" + assetVer,
              "http://" + screenjsGlobal.ASSET_HOST + "/assets/proxy/screenjs-recorder.js?" + assetVer
            ].forEach(function(src){
              appendNodeToHead(contentDocument, "script", {
                type: "text/javascript",
                src: src
              });
            });

            [
              "http://" + screenjsGlobal.ASSET_HOST + "/assets/proxy/css-overrides.css?" + assetVer,
              "http://" + screenjsGlobal.ASSET_HOST + "/assets/proxy/chosen.css?" + assetVer,
            ].forEach(function(href){
              appendNodeToHead(contentDocument, "link", {
                href: href,
                media: "all",
                rel: "stylesheet",
                type: "text/css"
              });
            });

          }
        }
      }
      catch(e) {
        // console.error(e);
        // console.warn("Cross domain frame", eTarget);
      }

    }
  }, true);

})();

function proxifyIframe(iframe){
  var cValue = iframe._getAttribute("src");
  if (cValue) {
    var pValue = translateTargetUrlToRequestUrl(cValue);
    if (cValue!=pValue) {
      iframe._setAttribute("src", pValue);
    }
    else if ( !iframe.hasAttribute("screenjs-proxified") ) {
      console.log("Why?");
    }
    iframe._setAttribute("screenjs-proxified", "true");
  }
}

function proxifyIframes(){
  var iframes = document.querySelectorAll("iframe:not([screenjs-proxified])");

  for (var i=0; i <iframes.length; i++) {
    var iframe = iframes[i];
    proxifyIframe(iframe);
  }

  var frames = document.querySelectorAll("frame:not([screenjs-proxified])");

  for (var i=0; i <frames.length; i++) {
    var frame = frames[i];
    proxifyIframe(frame);
  }
}

function proxifyStyle(styleNode){
  var cssContent = styleNode.innerHTML;
  // TODO: Add proxification logic for font as well if need be
  cssContent = cssContent.replace(/\:hover/g, ".cb-pvt-hover");
  cssContent = cssContent.replace(/\:visited/g, ".cb-pvt-visited");
  if (cssContent != styleNode.innerHTML) {
    styleNode.innerHTML = cssContent;
  }
}

function proxifyStylesheetLink(stylesheetLink){
  var linkRel = stylesheetLink.getAttribute("rel");
  var linkHref = stylesheetLink.getAttribute("href");
  if ( linkRel && linkHref && linkRel.indexOf("stylesheet") >= 0  && !stylesheetLink.hasAttribute("screenjs-proxified") ) {
    var cValue = stylesheetLink.getAttribute("href");
    if (cValue) {
      var pValue = translateTargetUrlToRequestUrl(cValue);
      if (cValue!=pValue) {
        stylesheetLink.setAttribute("href", pValue);
        stylesheetLink.setAttribute("screenjs-proxified", "true");
      }
    }
  }
}

function proxifyStylesheetLinks(){
  var stylesheetLinks = document.querySelectorAll("link:not([for-screenjs-proxy])");

  for (var i=0; i <stylesheetLinks.length; i++) {
    var stylesheetLink = stylesheetLinks[i];
    proxifyStylesheetLink(stylesheetLink)
  }
}

//********************************
// Observe changes happening later in the DOM
//********************************
// PERF: Check for performance implications of following
// select the target node
function proxifyDynamicallyAddedIframes(){

  var target = document.documentElement;

  // create an observer instance
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {

      if ( window.__logMutations ) {
        console.log(mutation);
      }

      if ( mutation.type == "childList" ) {
        var added = mutation.addedNodes;
        var newNode;
        for(var i=0; i<added.length; i++){
          if ( (newNode = added[i]).nodeName == "IFRAME" ) {
            proxifyIframe(newNode);
          }
          else if ( newNode.childElementCount > 0 && newNode.querySelectorAll) {
            var childIframes = newNode.querySelectorAll("iframe");
            for (var j=0; j < childIframes.length; j++){
              var iframe = childIframes[j];
              proxifyIframe(iframe);
            }
          }
          else if ( (newNode = added[i]).nodeName == "STYLE" ) {
            proxifyStyle(newNode);
          }
          else if ( newNode.childElementCount > 0 && newNode.querySelectorAll) {
            var childStyles = newNode.querySelectorAll("style");
            for (var j=0; j < childStyles.length; j++){
              var styleNode = childStyles[j];
              proxifyStyle(styleNode);
            }
          }
          else if ( (newNode = added[i]).nodeName == "LINK" ) {
            proxifyStylesheetLink(newNode);
          }
          else if ( newNode.childElementCount > 0 && newNode.querySelectorAll) {
            var childStylesheetLinks = newNode.querySelectorAll("link");
            for (var j=0; j < childStylesheetLinks.length; j++){
              var stylesheetLink = childStylesheetLinks[j];
              proxifyStyle(stylesheetLink);
            }
          }

          proxifySVG(newNode);
        }
      }
      // if (target.nodeName == "IFRAME" && mutation.attributeName.toLowerCase() == "src") {
      if (mutation.attributeName && mutation.target.nodeName == "IFRAME" && mutation.attributeName.toLowerCase()=="src") {
        proxifyIframe(mutation.target);
      }

    });    
  });
   
  // configuration of the observer:
  var config = { attributes: true,
                 attributeFilter: ["SRC", "src"],
                 childList: true,
                 subtree: true };
   
  // pass in the target node, as well as the observer options
  observer.observe(target, config);
   
  // later, you can stop observing
  // observer.disconnect();
}
//********************************
// Observe changes happening later in the DOM ENDS HERE
//********************************

//*********************************
//proxifySVG
//*********************************
function makeUrlsAbsoluteInSvgAttr(attrName, elem){

  elem = elem || document;

  // var iterator = document.evaluate("//*[contains(@"+attrName+", 'url')]", document, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null );
  // var res;
  // var found = [];

  // while (res = iterator.iterateNext())
  //   found.push(res);

  // found.forEach(function(e){

  //   var attrVal = e.getAttribute(attrName);

  //   attrVal = attrVal.replace(/(url\([ \'\"]?)(.+?)([ \'\"]?\))/g, function(m, p1, attrUrl, p3){
  //     // fontUrl = helpers.translateFontSrc(fontUrl, req);
  //     if (attrUrl.indexOf("#") == 0) {
  //       attrUrl = window.location.href + attrUrl;
  //     }
  //     return [p1, attrUrl, p3].join("");
  //   });

  //   e.setAttribute(attrName, attrVal);

  // });

  // return;

  var svgElemsWithAttr = elem.querySelectorAll("svg ["+attrName+"]");
  [].forEach.call(svgElemsWithAttr, function(e){

    var attrVal = e.getAttribute(attrName);

    var addedURL = window.location.href;

    var newAttrVal = attrVal.replace(/(url\([ \'\"]?)(.+?)([ \'\"]?\))/g, function(m, p1, attrUrl, p3){
      // fontUrl = helpers.translateFontSrc(fontUrl, req);
      if (attrUrl.indexOf("#") == 0) {
        attrUrl = addedURL + attrUrl;
      }
      return [p1, attrUrl, p3].join("");
    });

    if ( attrVal != newAttrVal ) {
      e.setAttribute("cb-svg-" + attrName, addedURL);
      e.setAttribute(attrName, newAttrVal);
    }

  });
}

function proxifySVG(elem){
  // When measured it took about 1/2 millis at first
  // and then 0  millis on subsequent modification through DOMMutation
  // callbacks on simple document with 3 svg tags
  // and a button to add svg tag dynamically
  elem = elem || document;
  // It could be text element
  // OR might not have any svg element
  if ( !elem.querySelector || !elem.querySelector("svg") ) {
    return;
  }
  // http://www.w3.org/TR/SVG/linking.html#processingIRI
  makeUrlsAbsoluteInSvgAttr("fill", elem);
  makeUrlsAbsoluteInSvgAttr("clip-path", elem);
  makeUrlsAbsoluteInSvgAttr("color-profile", elem);
  makeUrlsAbsoluteInSvgAttr("cursor", elem);
  makeUrlsAbsoluteInSvgAttr("filter", elem);
  // ‘marker’, ‘marker-start’, ‘marker-mid’ and ‘marker-end’
  makeUrlsAbsoluteInSvgAttr("marker", elem);
  makeUrlsAbsoluteInSvgAttr("marker-start", elem);
  makeUrlsAbsoluteInSvgAttr("marker-mid", elem);
  makeUrlsAbsoluteInSvgAttr("marker-end", elem);

  makeUrlsAbsoluteInSvgAttr("mask", elem);
  makeUrlsAbsoluteInSvgAttr("stroke", elem);

  makeUrlsAbsoluteInSvgAttr("style", elem);

  var baseUrl = window.location.href
      .replace(window.location.hash, "");

  // For use with href attrib fix
  // https://gist.github.com/leonderijke/c5cf7c5b2e424c0061d2
  [].slice.call(document.querySelectorAll("use[*|href]"))
  .filter(function(element) {
    var attrib = element.getAttribute("xlink:href");
    return (attrib && attrib.indexOf("#") === 0);
  })
  .forEach(function(element) {
    element.setAttribute("xlink:href", baseUrl + element.getAttribute("xlink:href"));
  });
}
//*********************************
//proxifySVG End
//*********************************

//*********************************
// fixBaseTag
//*********************************

var fixBaseTag = function(){
  var baseTags = document._getElementsByTagName("base");
  if (baseTags.length > 1) {
    var ourBaseTag = baseTags[0];
    var theirBaseTag = baseTags[1];

    if ( theirBaseTag.getAttribute("href") ) {
      // TODO: Enable this code to have exact href attribute copied
      ourBaseTag.setAttribute("cb-orig-href", ourBaseTag.getAttribute("href"));
      ourBaseTag.setAttribute("href", theirBaseTag.getAttribute("href"));
      // ourBaseTag.setAttribute("href", theirBaseTag.href);
      ourBaseTag.setAttribute("using-site-base", "1");
    }
  }
};

// TODO: Refactor to avoid code duplication
// Override querySelector as well
// Consider adding similar logic for "script"
(function(localWindow, localDocuemnt){

  var origDesc = Object.getOwnPropertyDescriptor(Document.prototype, "getElementsByTagName");
  Object.defineProperty(Document.prototype, "_getElementsByTagName", origDesc);
  var origValue = origDesc.value;
  origDesc.value = function(tagName){

    var thisObj = this;
    if ( thisObj == __winObj.document ) {
      thisObj = localDocuemnt;
    }

    var retVal = origValue.apply(thisObj, arguments);

    if ( tagName && tagName.toLowerCase() === "base" ) {
      if ( retVal.length === 1 ) {
        retVal = origValue.call(thisObj, "cb_invalid_base");
      }
      else if ( retVal.length >= 2 ) {
        retVal = thisObj.querySelectorAll("base:not([for-screenjs-proxy])");
      }
    }

    return retVal;
  };
  Object.defineProperty(Document.prototype, "getElementsByTagName", origDesc);

})(window, document);

(function(localWindow, localDocuemnt){

  var origDesc = Object.getOwnPropertyDescriptor(Element.prototype, "getElementsByTagName");
  Object.defineProperty(Element.prototype, "_getElementsByTagName", origDesc);
  var origValue = origDesc.value;
  origDesc.value = function(tagName){

    var thisObj = this;
    if ( thisObj == __winObj.document ) {
      thisObj = localDocuemnt;
    }

    var retVal = origValue.apply(thisObj, arguments);

    if ( tagName && tagName.toLowerCase() === "base" ) {
      if ( retVal.length === 1 ) {
        retVal = origValue.call(thisObj, "cb_invalid_base");
      }
      else if ( retVal.length >= 2 ) {
        retVal = thisObj.querySelectorAll("base:not([for-screenjs-proxy])");
      }
    }

    return retVal;
  };
  Object.defineProperty(Element.prototype, "getElementsByTagName", origDesc);

})(window, document);

(function(localWindow, localDocuemnt){

  var origDesc = Object.getOwnPropertyDescriptor(Element.prototype, "querySelectorAll");
  Object.defineProperty(Element.prototype, "_querySelectorAll", origDesc);
  var origValue = origDesc.value;
  origDesc.value = function(query){

    var thisObj = this;
    if ( thisObj == __winObj.document ) {
      thisObj = localDocuemnt;
    }

    var retVal = origValue.apply(thisObj, arguments);

    if ( query && typeof query.toLowerCase === "function" && query.toLowerCase() === "base" ) {
      if ( retVal.length === 1 ) {
        retVal = origValue.call(thisObj, "cb_invalid_base");
      }
      else if ( retVal.length >= 2 ) {
        retVal = thisObj._querySelectorAll("base:not([for-screenjs-proxy])");
      }
    }

    return retVal;
  };
  Object.defineProperty(Element.prototype, "querySelectorAll", origDesc);

})(window, document);

(function(localWindow, localDocuemnt){

  var origDesc = Object.getOwnPropertyDescriptor(Document.prototype, "querySelectorAll");
  Object.defineProperty(Document.prototype, "_querySelectorAll", origDesc);
  var origValue = origDesc.value;
  origDesc.value = function(query){

    var thisObj = this;
    if ( thisObj == __winObj.document ) {
      thisObj = localDocuemnt;
    }

    var retVal = origValue.apply(thisObj, arguments);

    if ( query && query.toLowerCase() === "base" ) {
      if ( retVal.length === 1 ) {
        retVal = origValue.call(thisObj, "cb_invalid_base");
      }
      else if ( retVal.length >= 2 ) {
        retVal = thisObj._querySelectorAll("base:not([for-screenjs-proxy])");
      }
    }

    return retVal;
  };
  Object.defineProperty(Document.prototype, "querySelectorAll", origDesc);

})(window, document);

(function(localWindow, localDocuemnt){

  var origDesc = Object.getOwnPropertyDescriptor(Element.prototype, "querySelector");
  Object.defineProperty(Element.prototype, "_querySelector", origDesc);
  var origValue = origDesc.value;
  origDesc.value = function(query){

    var thisObj = this;
    if ( thisObj == __winObj.document ) {
      thisObj = localDocuemnt;
    }

    var retVal = origValue.apply(thisObj, arguments);

    if ( query && query.toLowerCase() === "base" ) {
      retVal = thisObj._querySelector("base:not([for-screenjs-proxy])");
      // if ( retVal.length === 1 ) {
      //   retVal = origValue.call(thisObj, "cb_invalid_base");
      // }
      // else if ( retVal.length >= 2 ) {
      //   retVal = thisObj._querySelector("base:not([for-screenjs-proxy])");
      // }
    }

    return retVal;
  };
  Object.defineProperty(Element.prototype, "querySelector", origDesc);

})(window, document);

(function(localWindow, localDocuemnt){

  var origDesc = Object.getOwnPropertyDescriptor(Document.prototype, "querySelector");
  Object.defineProperty(Document.prototype, "_querySelector", origDesc);
  var origValue = origDesc.value;
  origDesc.value = function(query){

    var thisObj = this;
    if ( thisObj == __winObj.document ) {
      thisObj = localDocuemnt;
    }

    var retVal = origValue.apply(thisObj, arguments);

    if ( query && query.toLowerCase() === "base" ) {
      retVal = thisObj._querySelector("base:not([for-screenjs-proxy])");
      // if ( retVal.length === 1 ) {
      //   retVal = origValue.call(thisObj, "cb_invalid_base");
      // }
      // else if ( retVal.length >= 2 ) {
      //   retVal = thisObj._querySelector("base:not([for-screenjs-proxy])");
      // }
    }

    return retVal;
  };
  Object.defineProperty(Document.prototype, "querySelector", origDesc);

})(window, document);


//*********************************
// End fixBaseTag
//*********************************

document.addEventListener("DOMContentLoaded", function(event) {
  proxifyIframes();
  proxifyStylesheetLinks();
  proxifyDynamicallyAddedIframes();
  proxifySVG();
  fixBaseTag();
}, true);

function needDeproxification(testUrl) {
  var testUri = document._createElement("a");
  testUri._href = testUrl;
  return testUri._hostname.endsWith(".castbin.com");
}

function needProxification(testUrl) {
  var testUri = document._createElement("a");
  testUri._href = testUrl;
  return !testUri._hostname.endsWith(".castbin.com");
}

document.addEventListener("error", function(event){
  var target = event.target;
  if (target && target.nodeName == "IMG" &&
      target.getAttribute("src") && needProxification(target.getAttribute("src"))) {
    // could not load image
    // try proxified URL
    var cValue = target.getAttribute("src");
    var pValue = translateTargetUrlToRequestUrl(cValue);
    if (cValue!=pValue) {
      target.setAttribute("src", pValue);
      target.setAttribute("screenjs-orig-src", cValue);
      target.setAttribute("screenjs-proxified", "true");
    }
  }
}, true);

// TODO: FAST: To make it fast attach to documentElement
// but that can cause issues on pages which replace html element itself
// Need mmore investigation
document.addEventListener("mouseenter", function(event) {
  event.target.classList && event.target.classList.add("cb-pvt-hover");
}, true);

document.addEventListener("mouseleave", function(event) {
  event.target.classList && event.target.classList.remove("cb-pvt-hover");
}, true);

document.addEventListener("click",function(event){

  // find out if target target or any of it's parent is a link
  var eventTarget = event.target;
  var linkNode = eventTarget;
  var isLinkClicked = false;
  // TODO: Check for linkNode.nodeName == "html" / "body" / document
  while ( linkNode ) {
    if ( linkNode.nodeName == "A" || linkNode.nodeName == "AREA" ) {
      isLinkClicked = true;
      break;
    }
    else {
      linkNode = linkNode.parentNode;
    }
  }

  if ( isLinkClicked && linkNode.hasAttribute("href") ) {
    // var origHrefAttrib = linkNode._getAttribute("href");

    // // linkNode._getAttribute("href")[0] != "#"
    // var originalHref = linkNode._href;
    // if ( !origHrefAttrib.startsWith("#") ) {
    //   var newHref = translateTargetUrlToRequestUrl(linkNode._href);
    //   linkNode._href = newHref;
    // }

    var origHrefAttrib = linkNode._origHrefAttrib;

    if ( origHrefAttrib == null ) {
      linkNode._origHrefAttrib = linkNode._getAttribute("href");
    }

    var originalHref = linkNode._href;
    var newHref = translateTargetUrlToRequestUrl(linkNode._href);
    linkNode._href = newHref;
    
    linkNode.target = "_self";

    // event.screenjs_link_node = linkNode;
    // event.screenjs_new_href = newHref;

    // window.__cbDisableGetLocationProxification = true;

    event.proxyTimeoutId = setTimeout(function(){
      // TODO: Find out why this is cusing problem on wikipedia and not on other sites
      // Plus looks like it is not needed
      // event.target._href = originalHref;

      window.__cbDisableGetLocationProxification = false;

    }, 1);
  }
  else {
    // alert("Link not clicked");
  }

  // TODO: Proxify onclick for parents as well
  if (eventTarget.hasAttribute("onclick") &&
      !eventTarget.hasAttribute("onclickProxified")) {
    var originalOnclick = eventTarget.getAttribute("onclick");
    eventTarget.setAttribute("onclick", proxifyScript(originalOnclick));
    eventTarget.setAttribute("onclickProxified", "true");
  }
}, true); // useCapture true as don't want to lose event to stopPropagation etc.

// TODO: Ideally this should be last event handler on document as it calls preventDefault
document.addEventListener("click",function(event){
  if ( event.screenjs_link_node && event.screenjs_link_node._href != event.screenjs_new_href ) {
    // Run proxification again
    // event.screenjs_link_node._href = translateTargetUrlToRequestUrl(event.screenjs_link_node._href);
  }
  // event.preventDefault();
  // return false;
}, false);

// 2. By submitting form

document.addEventListener("submit",function(event){
  var formNode = event.target;
  var urlParts = document._createElement("a");
  if ( !formNode.hasAttribute("action") ) {
    return;
  }
  urlParts._href = formNode.getAttribute("action");
  if ( urlParts._protocol == "http:" || urlParts._protocol == "https:" ) {
    // Checking if string ends with proxy URL
    var originalAction = formNode.getAttribute("action");
    formNode.setAttribute("action", translateTargetUrlToRequestUrl(formNode.getAttribute("action")));

    event.proxyTimeoutId = setTimeout(function(){
      // event.target.action = originalAction;
      formNode.setAttribute("action", originalAction);
    }, 0);

  }
}, true); // useCapture true as don't want to lose event to stopPropagation etc.

// TODO: How to handle user triggered submit events
// will the invoke above handler

HTMLFormElement.prototype._submit = HTMLFormElement.prototype.submit;
HTMLFormElement.prototype.submit = function() {
  var target = this;
  var formNode = target;
  if ( formNode.hasAttribute("action") ) {
    var originalAction = formNode.getAttribute("action");
    formNode.setAttribute("action", translateTargetUrlToRequestUrl(formNode.getAttribute("action")));
    var proxyTimeoutId = setTimeout(function(){
      formNode.setAttribute("action", originalAction);
    }, 0);
  }

  HTMLFormElement.prototype._submit.call(this, arguments);
};

// Following logic was created to handle this issue
// https://github.com/amitamb/screenjs-proxy/issues/27
// i.e. issue related to workflowy's handling of page URL change
// but it could also be used to handle issue on blekko.com where
// dynamically loaded script gets wrong address

document._createElement = document.createElement;

// document.createElement = function(name){
//   try {
//     var retElem = document._createElement.apply(document, arguments);
//   }
//   catch(e) {
//     console.log(e);
//     throw e;
//   }
  
//   if ( name.toLowerCase() == "a1" ) {

//     retElem._setAttribute = retElem.setAttribute;

//     retElem.setAttribute = function(key, val){
//       if ( key.toLowerCase() == "href" && window.__cbDisableGetLocationProxification ){
//         val = translateTargetUrlToRequestUrl(val)
//       }
//       retElem._setAttribute(key, val);
//     };

//     Object.defineProperty(retElem, "href", {
//       get: function(){
//         return retElem.getAttribute("href");
//       },
//       set: function(val){
//         retElem._setAttribute("href", translateTargetUrlToRequestUrl(val));
//       }
//     });
//   }

//   if ( name.toLowerCase() == "script" ) {
//     var src=retElem.src;

//     retElem._setAttribute = retElem.setAttribute;
      
//     retElem.setAttribute = function(key, val){
//       if ( key.toLowerCase() == "src" ){
//         val = translateTargetUrlToRequestUrl(val)
//       }
//       retElem._setAttribute(key, val);
//     };

//     Object.defineProperty(retElem, "src", {
//       get: function(){
//         //"script.js"
//         return retElem.getAttribute("src");
//       },
//       set:function(val){
//         retElem._setAttribute("src", translateTargetUrlToRequestUrl(val));
//       }
//     });
//   }

//   return retElem;
// };

(function(){

  // Deleting service worker because it does not work wihout HTTPS
  delete Navigator.prototype.serviceWorker;

  var documentWriteDesc = Object.getOwnPropertyDescriptor(HTMLDocument.prototype, "write");

  if ( !documentWriteDesc )
    documentWriteDesc = Object.getOwnPropertyDescriptor(Document.prototype, "write");

  Object.defineProperty(HTMLDocument.prototype, "_write", documentWriteDesc);
  var _origDocumentWriteDescValue = documentWriteDesc.value;
  documentWriteDesc.value = function(markup){
    markup = proxifyHTML(markup);
    return _origDocumentWriteDescValue.call(document, markup);
  };
  Object.defineProperty(HTMLDocument.prototype, "write", documentWriteDesc);


  var nodeBaseURIDesc = Object.getOwnPropertyDescriptor(Node.prototype, "baseURI");
  Object.defineProperty(Node.prototype, "_baseURI", nodeBaseURIDesc);
  var _origNodeBaseURIDescGet = nodeBaseURIDesc.get;
  nodeBaseURIDesc.get = function(){
    var retVal = _origNodeBaseURIDescGet.apply(this);
    retVal = translateRequestUrlToTargetUrl(retVal);
    return retVal;
  };
  Object.defineProperty(Node.prototype, "baseURI", nodeBaseURIDesc);

  var anchorHrefDesc = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "href");
  Object.defineProperty(HTMLAnchorElement.prototype, "_href", anchorHrefDesc);
  var _origAnchorHrefDescGet = anchorHrefDesc.get;
  var _origAnchorHrefDescSet = anchorHrefDesc.set;
  anchorHrefDesc.get = function(){
    var retVal = _origAnchorHrefDescGet.apply(this);
    retVal = translateRequestUrlToTargetUrl(retVal);
    return retVal;
  };
  anchorHrefDesc.set = function(val){
    val = translateTargetUrlToRequestUrl(val);
    var retVal = _origAnchorHrefDescSet.call(this, val);
    this._origHrefAttrib = null;
    return retVal;
  };
  Object.defineProperty(HTMLAnchorElement.prototype, "href", anchorHrefDesc);

  var anchorHostDesc = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "host");
  Object.defineProperty(HTMLAnchorElement.prototype, "_host", anchorHostDesc);
  var _origAnchorHostDescGet = anchorHostDesc.get;
  var _origAnchorHostDescSet = anchorHostDesc.set;
  anchorHostDesc.get = function(){
    var retVal = _origAnchorHostDescGet.apply(this);
    retVal = getRequestHostParts(retVal).host;
    return retVal;
  };
  anchorHostDesc.set = function(val){
    val = translateTargetHostToRequestHost(val, this.protocol);
    var retVal = _origAnchorHostDescSet.call(this, val);
    this._origHrefAttrib = null;
    return retVal;
  };
  Object.defineProperty(HTMLAnchorElement.prototype, "host", anchorHostDesc);

  var anchorHostnameDesc = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "hostname");
  Object.defineProperty(HTMLAnchorElement.prototype, "_hostname", anchorHostnameDesc);
  var _origAnchorHostnameDescGet = anchorHostnameDesc.get;
  var _origAnchorHostnameDescSet = anchorHostnameDesc.set;
  anchorHostnameDesc.get = function(){
    var retVal = _origAnchorHostnameDescGet.apply(this);
    retVal = getRequestHostParts(retVal).hostname;
    return retVal;
  };
  anchorHostnameDesc.set = function(val){
    val = translateTargetHostToRequestHost(val + ":" + this.port, this.protocol);
    var retVal = _origAnchorHostnameDescSet.call(this, val);
    this._origHrefAttrib = null;
    return retVal;
  };
  Object.defineProperty(HTMLAnchorElement.prototype, "hostname", anchorHostnameDesc);

  var anchorProtocolDesc = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "protocol");
  Object.defineProperty(HTMLAnchorElement.prototype, "_protocol", anchorProtocolDesc);
  var _origAnchorProtocolDescGet = anchorProtocolDesc.get;
  var _origAnchorProtocolDescSet = anchorProtocolDesc.set;
  anchorProtocolDesc.get = function(){
    // var retVal = _origAnchorProtocolDescGet.apply(this);
    var retVal = this._protocol;
    if ( retVal == "http" || retVal == "https" ) {
      retVal = getRequestHostParts(this._host).protocol;
    }
    return retVal;
  };
  anchorProtocolDesc.set = function(val){
    val = translateTargetHostToRequestHost(this.host, val);
    this._host = val;
    this._origHrefAttrib = null;
    return;
  };
  Object.defineProperty(HTMLAnchorElement.prototype, "protocol", anchorProtocolDesc);

  var anchorPortDesc = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "port");
  Object.defineProperty(HTMLAnchorElement.prototype, "_port", anchorPortDesc);
  var _origAnchorPortDescGet = anchorPortDesc.get;
  var _origAnchorPortDescSet = anchorPortDesc.set;
  anchorPortDesc.get = function(){
    // var retVal = _origAnchorPortDescGet.apply(this);
    var retVal = getRequestHostParts(this._host).port;
    return retVal;
  };
  anchorPortDesc.set = function(val){
    val = translateTargetHostToRequestHost(this.hostname + ":" + val, this.protocol);
    this._host = val;
    this._origHrefAttrib = null;
    return;
  };
  Object.defineProperty(HTMLAnchorElement.prototype, "port", anchorPortDesc);

  var elementGetAttributeDesc = Object.getOwnPropertyDescriptor(Element.prototype, "getAttribute");
  Object.defineProperty(Element.prototype, "_getAttribute", elementGetAttributeDesc);
  var _origElementGetAttributeDescValue = elementGetAttributeDesc.value;
  elementGetAttributeDesc.value = function(attrib){
    var retVal = _origElementGetAttributeDescValue.call(this, attrib);
    if ( attrib && attrib.toLowerCase() == "href" && this instanceof HTMLAnchorElement ) {
      if ( this._origHrefAttrib != null ) {
        retVal = this._origHrefAttrib;
      }
      else {
        if ( needDeproxification(retVal) )  {
          retVal = translateRequestUrlToTargetUrl(retVal);
        }
      }
    }
    else if ( attrib && attrib.toLowerCase() == "src" &&
         (this instanceof HTMLIFrameElement || this instanceof HTMLScriptElement ) ) {
      if ( this._origSrcAttrib != null ) {
        retVal = this._origSrcAttrib;
      }
      else {
        if ( needDeproxification(retVal) )  {
          retVal = translateRequestUrlToTargetUrl(retVal);
        }
      }
    }
    return retVal;
  };
  Object.defineProperty(Element.prototype, "getAttribute", elementGetAttributeDesc);

  var elementSetAttributeDesc = Object.getOwnPropertyDescriptor(Element.prototype, "setAttribute");
  Object.defineProperty(Element.prototype, "_setAttribute", elementSetAttributeDesc);
  var _origElementSetAttributeDescValue = elementSetAttributeDesc.value;
  elementSetAttributeDesc.value = function(attrib, val){
    if ( attrib && attrib.toLowerCase() == "href" && this instanceof HTMLAnchorElement ) {
      this._origHrefAttrib = val;
      val = translateTargetUrlToRequestUrl(val);
    }
    // TODO: Proxify setAttribute for HTMLIframeElement
    else if ( attrib && attrib.toLowerCase() == "src" &&
         (this instanceof HTMLIFrameElement || this instanceof HTMLScriptElement ) ) {
      // console.error("Found the issue??");
      // console.error(attrib, val);
      this._origSrcAttrib = val;
      val = translateTargetUrlToRequestUrl(val);
    }
    var retVal = _origElementSetAttributeDescValue.call(this, attrib, val);
    return retVal;
  };
  Object.defineProperty(Element.prototype, "setAttribute", elementSetAttributeDesc);

})();

// 3. window.location change from script and similar methods

// window.open = function (open) {
//   return function (url, name, features) {
//     // set name if missing here
//     name = name || "default_window_name";
//     proxiedUrl = translateTargetUrlToRequestUrl(url);

//     // TODO: Show it in current window only
//     // also replace display=popup for fb logib
//     return open.call(window, proxiedUrl, name, features);
//   };
// }(window.open);


// (function(window) {
//   var _open = window.open;
//   window.open = function (url, name, features) {
//     console.log("Called window.open", url, name, features);
//     // set name if missing here
//     name = name || "default_window_name";
//     proxiedUrl = translateTargetUrlToRequestUrl(url);

//     // TODO: Show it in current window only
//     // also replace display=popup for fb logib
//     return _open.call(window, proxiedUrl, name, features);
//   };
// })(window);

// Can test using following url
//http://maharashtratimes.indiatimes.com.dev-proxy.castbin.com/jokes/articlelist/2428942.cms

// TODO: Think of best way of doing this
// can use proxy for all script tags only
// consider using trumpet for this

// 4. Redirects through html tags

// TODO: Handle it from server

// 5. 1 to 3 methods from iframe with target top

// TODO: Handle iframes from proxy and with script included

// ************************************
// Also handle AJAX proxying
// ************************************

(function() {
  var proxied = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function() {
    // TODO : Refactor following part of code
    var url = arguments[1];
    arguments[1] = translateTargetUrlToRequestUrl(url);
    url = arguments[1];

    var retVal = proxied.apply(this, [].slice.call(arguments));

    var parsedUri = document._createElement("a");
    parsedUri._href = url;

    if ( this.setRequestHeader && parsedUri._host == window.location.host ) {
      this.setRequestHeader("cbproxiedrequest", "1");
    }

    return retVal;
  };
})();

(function(window){

  if ( !window.fetch ) return;

  window._fetch = window.fetch;

  window.fetch = function(){
    var request = arguments[0];
    request = new Request(arguments[0]);
    var options = {};
    if (request.method) options.method = request.method;
    if (request.headers) options.headers = request.headers;
    if (request.body) options.body = request.body;
    if (request.mode) options.mode = request.mode;
    if (request.credentials) options.credentials = request.credentials;
    if (request.cache) options.cache = request.cache;
    if (request.redirect) options.redirect = request.redirect;
    if (request.referrer) options.referrer = request.referrer;
    if (request.integrity) options.integrity = request.integrity;
    var proxiedUrl = translateTargetUrlToRequestUrl(request.url);
    request = new Request(proxiedUrl, options);
    return window._fetch.call(window, request, arguments[1]);
  };

})(window);

// window.WebSocket = undefined;

// TODO: Override websocket
// (function(window) {
//   if (!window.WebSocket) return;
//   var origSocket = window.WebSocket;
//   window.WebSocket = function(url, protocol){
//     url = translateTargetUrlToRequestUrl(url)
//     return new WebSocket(url, protocol)
//   };
// })(window);

(function(localWindow){

  var origDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "sendBeacon");
  Object.defineProperty(Navigator.prototype, "_sendBeacon", origDesc);
  var origValue = origDesc.value;
  origDesc.value = function(url, data){
    url = translateTargetUrlToRequestUrl(url);
    return origValue.call(this, url, data);
  };
  Object.defineProperty(Navigator.prototype, "sendBeacon", origDesc);

})(window);

(function(){

  function dispatchScreenjsHistorychangeEvent(){
    var evt = document.createEvent("CustomEvent");
    evt.initEvent("screenjshistorychange", true, true);
    window.dispatchEvent(evt);
  }

  // Handle pushState, replaceState navigation
  // TODO: In desperate need of re-factoring two functions below
  (function(history){
    var pushState = history.pushState;
    history.pushState = function(state) {

      if (typeof history.onpushstate == "function") {
        history.onpushstate({state: state});
      }

      var screenjsBaseTag = document.head._getElementsByTagName("base")[0];
      var needToReplaceBaseHref = !screenjsBaseTag.hasAttribute("using-site-base");
      if ( needToReplaceBaseHref ) {
        var originalBaseHref = screenjsBaseTag.href;
        screenjsBaseTag.href = window.location.href;
      }

      var url = arguments[2];
      arguments[2] = translateTargetUrlToRequestUrl(url);

      var retVal = pushState.apply(history, arguments);

      if ( needToReplaceBaseHref ) {
        screenjsBaseTag.href = originalBaseHref;
        var parsedUri = document._createElement("a");
        parsedUri._href = url;
        screenjsBaseTag.href = parsedUri._href;
        // screenjsBaseTag.href = url;
      }

      dispatchScreenjsHistorychangeEvent();

      return retVal;
    }
  })(window.history);

  (function(history){
    var replaceState = history.replaceState;
    history.replaceState = function(state) {

      // TODO: Find out if need to fire onpushstate
      // event here
      // if (typeof history.onpushstate == "function") {
      //   history.onpushstate({state: state});
      // }

      var screenjsBaseTag = document.head._getElementsByTagName("base")[0];
      var needToReplaceBaseHref = !screenjsBaseTag.hasAttribute("using-site-base");
      if ( needToReplaceBaseHref ) {
        var originalBaseHref = screenjsBaseTag.href;
        screenjsBaseTag.href = window.location.href;
      }

      var url = arguments[2];
      arguments[2] = translateTargetUrlToRequestUrl(url);

      var retVal = replaceState.apply(history, arguments);

      if ( needToReplaceBaseHref ) {
        screenjsBaseTag.href = originalBaseHref;
        var parsedUri = document._createElement("a");
        parsedUri._href = url;
        screenjsBaseTag.href = parsedUri._href;
      }

      dispatchScreenjsHistorychangeEvent();

      return retVal;
    }
  })(window.history);

})();


// ****************
// cookie proxying
// ****************

if (document.__lookupSetter__ && document.__defineSetter__) {

  var origCookieSetter = document.__lookupSetter__('cookie');
  var origCookieGetter = document.__lookupGetter__('cookie');

  document.__defineSetter__("cookie", function(cookieStr){
    // console.log("Setting cookie:", cookieStr);
    cookieStr = cookieStr.replace(/(;[ ]*?domain[ ]*?=[ ]*?)(.+?)([ ]*?(?:\;|$))/, function(m, p1, domain, p2){
      // domain = "www.example.com";
      domain = translateTargetHostToRequestHost(domain);
      return [p1, domain, p2].join("");
    });
    // console.log("Proxied cookie:", cookieStr);
    return origCookieSetter.call(document, cookieStr);
  });

  document.__defineGetter__("cookie", function(){
    return origCookieGetter.call(document);
  });

}

//*****************
// End
//*****************

(function(){

  // var documentDomain = window.document.domain;
  // Object.defineProperty(document, "domain", {
  //   get: function(){
  //     return getRequestHostParts(documentDomain).hostname;
  //   },
  //   set: function(val){
  //     // var documentDomain = translateTargetHostToRequestHost(val);
  //     documentDomain = translateTargetHostToRequestHost(val, window.location.protocol);
  //     //document.domain="www.rediff.com";
  //     document.domain = documentDomain;
  //   }
  // });

  var documentDomainDesc = Object.getOwnPropertyDescriptor(HTMLDocument.prototype, "domain");

  if ( !documentDomainDesc )
    documentDomainDesc = Object.getOwnPropertyDescriptor(Document.prototype, "domain");

  Object.defineProperty(HTMLDocument.prototype, "_domain", documentDomainDesc);
  var _origDocumentDomainDescGet = documentDomainDesc.get;
  var _origDocumentDomainDescSet = documentDomainDesc.set;
  documentDomainDesc.get = function(){
    var documentDomain = getRequestHostParts(this._domain).hostname;
    return documentDomain;
  };
  documentDomainDesc.set = function(val){
    // Not providing protocol as it should not cause issue in domain matching
    var documentDomain = translateTargetHostToRequestHost(val, null);
    if (documentDomain === "castbin.com") { return; }
    this._domain = documentDomain;
  };
  Object.defineProperty(HTMLDocument.prototype, "domain", documentDomainDesc);


})()


window.__cbDisableGetLocationProxification = false;

var proxyAroundLocation = function(oLocation){

  var pLocation = {
    assign: function(url){
      return oLocation.assign(translateTargetUrlToRequestUrl(url));
    },
    reload: function(){
      return oLocation.reload();
    },
    replace: function(url){
      return oLocation.replace(translateTargetUrlToRequestUrl(url));
    },
    toString: function(){
      // return oLocation.toString();
      return this.href;
    }
  };

  Object.defineProperties(pLocation, {
    "hash": {
      get: function(){
        return oLocation.hash;
      },
      set: function(val){
        oLocation.hash = val;
      }
    },
    "host": {
      get: function(){
        if (window.__cbDisableGetLocationProxification) {
          return oLocation.host;
        }
        else {
          var retVal = getRequestHostParts(oLocation.host);
          if ( !retVal.port || retVal.port == 80 ) {
            retVal = retVal.host;
          }
          else {
            retVal = retVal.host + ":" + retVal.port
          }
          // getRequestHostParts(oLocation.host).host;
          return retVal;
        }
      },
      set: function(val){
        oLocation.host = translateTargetHostToRequestHost(val, this.protocol);
      }
    },
    "hostname": {
      get: function(){
        if (window.__cbDisableGetLocationProxification) {
          return oLocation.hostname;
        }
        else {
          return getRequestHostParts(oLocation.hostname).hostname;
        }
      },
      set: function(val){
        oLocation.hostname = translateTargetHostToRequestHost(val + ":" + pLocation.port, this.protocol);
      }
    },
    "href": {
      get: function(){
        if (window.__cbDisableGetLocationProxification) {
          return oLocation.href;
        }
        else {
          return translateRequestUrlToTargetUrl(oLocation.href);
        }
      },
      set: function(val){
        // console.log("Setting oLocation.href", val);
        try {
          // target.location = val;
          val = translateTargetUrlToRequestUrl(val)
          oLocation.href = translateTargetUrlToRequestUrl(val);
        }
        catch(e) {
          if ( __cb_virtualTop && oLocation === __cb_virtualTop.location && e instanceof DOMException) {
            console.warn("Handle error in setting location.href on non-top window");
            window.top.postMessage({
              type: "screenjsMessage",
              action: "navigateTo",
              url: val
            },"*");
          }
          else {
            throw e;
          }
        }
      }
    },
    "pathname": {
      get: function(){
        return oLocation.pathname;
      },
      set: function(val){
        // console.log("Setting oLocation.pathname", val);
        oLocation.pathname = val;
      }
    },
    "port": {
      get: function(){
        return oLocation.port;
      },
      set: function(val){
        val = translateTargetHostToRequestHost(this.hostname + ":" + val, this.protocol);
        oLocation.host = val;
        // oLocation.port = val;
      }
    },
    "protocol": {
      get: function(){
        if (window.__cbDisableGetLocationProxification) {
          return oLocation.hostname;
        }
        else {
          return getRequestHostParts(oLocation.hostname).protocol;
        }
      },
      set: function(val){
        val = translateTargetHostToRequestHost(this.hostname + ":" + this.port, val);
        oLocation.host = val;
        // oLocation.protocol = val;
      }
    },
    "search": {
      get: function(){
        return oLocation.search;
      },
      set: function(val){
        // console.log("Setting oLocation.search", val);
        oLocation.search = val;
      }
    },
    "origin": {
      get: function(){
        if (window.__cbDisableGetLocationProxification) {
          return oLocation.origin;
        }
        else {
          var proxiedOrigin = oLocation.origin;
          var proxiedHost = oLocation.host;
          var actualHost = this.host;
          var actualOrigin = proxiedOrigin.replace(proxiedHost, actualHost);
          var proxiedProtocol = oLocation.protocol;
          var actualProtocol = this.protocol;
          actualOrigin = actualOrigin.replace(proxiedProtocol, actualProtocol);
          // return getRequestHostParts(oLocation.host).host;
          return actualOrigin;
        }
      }//,
      // set: function(val){
      //   oLocation.host = translateTargetHostToRequestHost(val, this.protocol);
      // }
    }
  });

  return pLocation;

};

(function(){

  var windowLocation = proxyAroundLocation(window.location);

  Object.defineProperty(window, "proxy_location", {
    get: function(){
      return windowLocation;
    },
    set: function(val){
      windowLocation = translateTargetUrlToRequestUrl(val);
      window.location = windowLocation
      //document.domain="www.rediff.com";
    }
  });

  Object.defineProperty(document, "proxy_location", {
    get: function(){
      return windowLocation;
    },
    set: function(val){
      windowLocation = translateTargetUrlToRequestUrl(val);
      window.location = windowLocation
      //document.domain="www.rediff.com";
    }
  });

  // This is to counter any unintended .location to .proxy_location conversions
  // apart from window and document
  // it caused problem on http://try.discourse.org/
  Object.defineProperty(Object.prototype, "proxy_location", {
    get: function(){
      return this.location;
    },
    set: function(val){
      this.location = val;
    }
  });

  Object.defineProperty(Object.prototype, "proxy_top", {
    get: function(){
      return this.top;
    },
    set: function(val){
      this.top = val;
    }
  });

  Object.defineProperty(Object.prototype, "proxy_parent", {
    get: function(){
      return this.parent;
    },
    set: function(val){
      this.parent = val;
    }
  });

  var windowTop = window.top;

  var virtualTop = window.self;
  while (virtualTop.parent !== virtualTop.parent.parent) {
    virtualTop = virtualTop.parent;
  }
  var virtualParent = window.parent;
  if ( virtualParent === window.top ) {
    virtualParent = window.self;
  }

  window.__cb_virtualTop = virtualTop;
  window.__cb_virtualParent = virtualParent;


  Object.defineProperty(window, "proxy_top", {
    get: function(){
      return virtualTop;
    },
    set: function(val){
      virtualTop = val;
    }
  });

  var windowParent = window.top;

  Object.defineProperty(window, "proxy_parent", {
    get: function(){
      // if ( window.top == window.parent && window != window.top ) {
      //   return window;
      // }
      // else {
      //   return window.parent;
      // }
      return virtualParent;
    },
    set: function(val){
      virtualParent  =val;
      // if ( window.top == window.parent ) {
      //   window = val;
      // }
      // else {
      //   window.parent = val;
      // }
    }
  });

  window.__proxy_window_get = function(origVal){
    if ( origVal === window.top ) {
      origVal = virtualTop;
    } else if ( origVal === window.parent ) {
      origVal = virtualParent;
    }
    return origVal;
  };

  // function proxyAroundLocation(oLocation){
  //   var pLocation = new Proxy(oLocation, {
  //     get: function(target, prop){

  //     },
  //     set: function(target, prop, val){},
  //   });
  // }

  window.__proxy_location_get = function(origVal){
    if ( origVal === window.location ) {
      origVal = window.proxy_location;
    }
    else if ( origVal === window.top.location ) {
      origVal = proxyAroundLocation(virtualTop.location);
    } else if ( origVal === window.parent.location ) {
      origVal = proxyAroundLocation(virtualParent.location);
    }
    else if ( origVal instanceof Location || // Won't work for other windows
              ( origVal != null && typeof origVal === "object" && typeof origVal.assign === "function" &&
                typeof origVal.replace === "function"
              )
            ) {
      origVal = proxyAroundLocation(origVal);
    }
    return origVal;
  };

  window.__proxy_location_set = function(target, prop, origVal){
    if ( prop === "location" ) {
      var val = origVal;
      try {
        if ( (target===window || target===parent || target === top || typeof target === "object") &&
              typeof val === "string" ) {
          val = translateTargetUrlToRequestUrl(origVal);
        }
      }
      catch(e){
        console.error(e);
        console.error("Failed to proxy location set", target, val);
      }
      try {
        target.location = val;
      }
      catch(e) {
        if ( target === virtualTop && e instanceof DOMException) {
          console.warn("Handle error in setting location.href on non-top window");
          window.top.postMessage({
            type: "screenjsMessage",
            action: "navigateTo",
            url: val
          },"*");
        }
        else {
          throw e;
        }
      }
    }
    else {
      console.error("Invalid location set call", target, prop, val);
    }
  };

  document.addEventListener("DOMContentLoaded", function(e){
    var metaTag = document.querySelector("meta[http-equiv-orig='refresh']");
    if (metaTag) {
      var contentParts = metaTag.content.split(";");
      var timeToLoad = parseInt(contentParts[0]);
      if (contentParts[1]) {
        // var urlToLoad = contentParts[1].split("url=")[1];
        var urlToLoad = contentParts[1].trim().replace(/^url\=/i, "")
        if ( urlToLoad ) {
          urlToLoad = urlToLoad.trim();
          setTimeout(function(){
            window.location.href = translateTargetUrlToRequestUrl(urlToLoad);
          }, timeToLoad * 1000);
        }
      }
      else {
        setTimeout(function(){
          window.location.reload();
        }, timeToLoad * 1000);
      }
    }
  }, true);

  Object.defineProperty(document, "URL", {
    get: function(){
      return window.proxy_location.href;
    }
  });

  var origReferrer = document.referrer;
  Object.defineProperty(document, "referrer", {
    get: function(){
      var referrer = origReferrer;
      if ( referrer ) {
        referrer = translateRequestUrlToTargetUrl(referrer)
      }
      return referrer;
    }
  });

  //   var referrer = origDocument.referrer;
        //   if ( referrer ) {
        //     referrer = translateRequestUrlToTargetUrl(referrer)
        //   }
        //   return referrer;
  

})();

(function(){

  var localWindow = window;
  var localDocument = document;

  // var _origFuncToString = Function.prototype.toString;

  // Function.prototype.toString = function(){
  //   try {
  //     var retVal = _origFuncToString.apply(this, arguments);
  //   } catch (e) {
  //     if (e instanceof TypeError && "__origFunc" in this) {
  //       retVal = _origFuncToString.apply(this.__origFunc, arguments);
  //     }
  //     else {
  //       throw e;
  //     }
  //   }
  //   return retVal;
  // };

  // var nodeOwnerDocumentDesc = Object.getOwnPropertyDescriptor(Node.prototype, "ownerDocument");
  // Object.defineProperty(Node.prototype, "_ownerDocument", nodeOwnerDocumentDesc);
  // var _origNodeOwnerDocumentGet = nodeOwnerDocumentDesc.get;
  // nodeOwnerDocumentDesc.get = function(){
  //   var retVal = _origNodeOwnerDocumentGet.apply(this);
  //   if ( retVal === localDocument ) {
  //     retVal = docProxy;
  //   }
  //   return retVal;
  // };
  // Object.defineProperty(Node.prototype, "ownerDocument", nodeOwnerDocumentDesc);

  // var nodeParentNodeDesc = Object.getOwnPropertyDescriptor(Node.prototype, "parentNode");
  // Object.defineProperty(Node.prototype, "_parentNode", nodeParentNodeDesc);
  // var _origNodeParentNodeGet = nodeParentNodeDesc.get;
  // nodeParentNodeDesc.get = function(){
  //   var retVal = _origNodeParentNodeGet.apply(this);
  //   if ( retVal === localDocument ) {
  //     retVal = docProxy;
  //   }
  //   return retVal;
  // };
  // Object.defineProperty(Node.prototype, "parentNode", nodeParentNodeDesc);


  // if ( MutationObserver && MutationObserver.prototype.observe ) {
  //   var _origMutationObserverObserveode = MutationObserver.prototype.observe;
  //   MutationObserver.prototype.observe = function(origTarget, options){
  //     var target = origTarget;
  //     if ( origTarget === docProxy ) {
  //       target = localDocument;
  //     }
  //     return _origMutationObserverObserveode.call(this, target, options);
  //   };
  // }

  // var eventTargetDesc = Object.getOwnPropertyDescriptor(Event.prototype, "target");
  // Object.defineProperty(Event.prototype, "_target", eventTargetDesc);
  // var _origEventTargetGet = eventTargetDesc.get;
  // eventTargetDesc.get = function(){
  //   var retVal = _origEventTargetGet.apply(this);
  //   if ( retVal === localDocument ) {
  //     retVal = docProxy;
  //   }
  //   else if ( retVal === localWindow ) {
  //     retVal = winProxy;
  //   }
  //   return retVal;
  // };
  // Object.defineProperty(Event.prototype, "target", eventTargetDesc);

  // var documentDefaultViewDesc = Object.getOwnPropertyDescriptor(Document.prototype, "defaultView");
  // Object.defineProperty(Document.prototype, "_defaultView", documentDefaultViewDesc);
  // var _origDocumentDefaultViewGet = documentDefaultViewDesc.get;
  // documentDefaultViewDesc.get = function(){
  //   var retVal = _origDocumentDefaultViewGet.apply(this);
  //   if ( retVal === localWindow ) {
  //     // console.log("Wait"); 
  //     retVal = winProxy;
  //   }
  //   return retVal;
  // };
  // Object.defineProperty(Document.prototype, "defaultView", documentDefaultViewDesc);

  function proxyAroundDocument(origDocument){
    var docDup = {};

    var cachedFunctions = {};
    
    var docProxy = new Proxy(docDup, {
      get: function(target, property){
        if (property === "location") {
          return localWindow.proxy_location;
        }
        // else if (property === "referrer") {
        //   var referrer = origDocument.referrer;
        //   if ( referrer ) {
        //     referrer = translateRequestUrlToTargetUrl(referrer)
        //   }
        //   return referrer;
        // }
        // else if (property === "defaultView" && localDocument.defaultView === localWindow ) { //  && target === localDocument
        //   return winProxy;
        // }
        else {

          var retVal = Reflect.get(origDocument, property);

          if (typeof retVal == "function" && retVal.prototype === undefined ) {

            var cachedFunc = cachedFunctions[property];

            if ( cachedFunc && cachedFunc.orig === retVal ) {
              retVal = cachedFunc.proxy;
            }
            else {
              var origRetVal = retVal;
              retVal = new Proxy(retVal, {
                apply: function(target, thisArg, argumentsList) {
                  if ( thisArg === docProxy ) {
                    thisArg = origDocument;
                  }

                  return origRetVal.apply(thisArg, argumentsList);
                }
              });

              retVal.__origFunc = origRetVal;

              cachedFunctions[property] = {
                orig: origRetVal,
                proxy: retVal
              };

            }

          }

          return retVal;

        }
      },
      set: function (oTarget, sKey, vValue) {
        if (sKey === "location") {
          return Reflect.set(localWindow, "proxy_location", vValue);
        }
        return Reflect.set(origDocument, sKey, vValue);
      },
      deleteProperty: function (oTarget, sKey) {
        return delete origDocument[sKey];
      },
      ownKeys: function (oTarget, sKey) {
        var docKeys = Object.keys(origDocument);
        Object.keys(docDup).
          filter(function(k1){ return docKeys.indexOf(k1) < 0; }).
          forEach(function(k2){
            delete docDup[k2];
          });
        
        docKeys.forEach(function(k){
          docDup[k] = "";
        });
        return Object.keys(origDocument);
      },
      has: function (oTarget, sKey) {
        return sKey in origDocument;
      },
      defineProperty: function (oTarget, sKey, oDesc) {
        return Reflect.defineProperty(origDocument, sKey, oDesc);
      },
      getOwnPropertyDescriptor: function (oTarget, sKey) {
        var retVal = Reflect.getOwnPropertyDescriptor(origDocument, sKey);
        if (retVal) {
          Reflect.defineProperty(docDup, sKey, retVal);
        }
        return retVal;
      },
      getPrototypeOf: function(target){
        return Reflect.getPrototypeOf(origDocument);
      },
    });
    
    return docProxy;
  }

  function proxyAroundWindow(origWindow){
    var winDup = {};

    var cachedFunctions = {};

    var virtualTop = origWindow;

    while (virtualTop.parent !== virtualTop.parent.parent) {
      virtualTop = virtualTop.parent;
    }

    var virtualParent = origWindow.parent;

    if (virtualParent == origWindow.top) {
      virtualParent = origWindow;
    }

    var proxyTop = null, proxyParent = null;
    
    var winProxy = new Proxy(winDup, {
      get: function(target, property){

        if (property === "location") {
          if ( origWindow === localWindow ) {
            return origWindow.proxy_location;
          }
          else {
            var origRetVal = origWindow.location;
            retVal = new Proxy(origRetVal, {
              set: function (oTarget, sKey, vValue) {
                vValue = translateTargetUrlToRequestUrl(vValue);
                try {
                  return Reflect.set(oTarget, sKey, vValue);
                }
                catch (e) {
                  if ( origWindow === virtualTop && e instanceof DOMException) {
                    console.log("Handle error in setting location.href on non-top window");
                    __origWindow.top.postMessage({
                      type: "screenjsMessage",
                      action: "navigateTo",
                      url: vValue
                    },"*");
                  }
                  else {
                    throw e;
                  }
                }
              }
            });
            return retVal;
          }
        }
        else if (property === "top") {
          if (!proxyTop) {
            proxyTop = proxyAroundWindow(virtualTop);
            if ( virtualParent === virtualTop ) {
              proxyParent = proxyTop;
            }
          }
          return proxyTop;
        }
        else if (property === "parent") {
          if (!proxyParent) {
            proxyParent = proxyAroundWindow(virtualParent);
            if ( virtualParent === virtualTop ) {
              proxyTop = proxyParent;
            }
          }
          return proxyParent;
        }
        else if (property === "frames") {
          return winProxy;
        }
        else if (property === "self") {
          return winProxy;
        }
        else if (property === "window") {
          return winProxy;
        }
        else if (property === "document" && origWindow === localWindow ) {
          return docProxy;
        }
        else if ( property === "CSS" && origWindow === localWindow ) {
          return Reflect.get(origWindow, property);
        }
        else if ( property === "MediaSource" && origWindow === localWindow ) {
          return Reflect.get(origWindow, property);
        }
        else {

          var retVal = Reflect.get(origWindow, property);

          if (typeof retVal == "function" && retVal.prototype === undefined ) {

            var cachedFunc = cachedFunctions[property];

            if ( cachedFunc && cachedFunc.orig === retVal ) {
              retVal = cachedFunc.proxy;
            }
            else {
              var origRetVal = retVal;
              retVal = new Proxy(retVal, {
                apply: function(target, thisArg, argumentsList) {
                  if ( thisArg === winProxy ) {
                    thisArg = origWindow;
                  }

                  if (property === "postMessage") {
                    argumentsList[1] = "*";
                  }

                  // if ( property == "getComputedStyle" ) {
                  //   // if ( argumentsList[0].nodeName == "HTML" ) {
                  //   //   console.log("Hello!!");
                  //   //   console.log(typeof argumentsList[0]);
                  //   //   console.log(localDocument.defaultView);
                  //   //   console.log(localDocument.readyState);
                  //   //   console.log(argumentsList[0] instanceof Element);
                  //   //   console.log(argumentsList[0]);
                  //   // }
                  //   if (argumentsList[0].constructor === HTMLDocument) {
                  //     console.log("What?");
                  //   }
                  // }

                  var testRetVal = {};

                  // try {
                    testRetVal = origRetVal.apply(thisArg, argumentsList);
                  // } catch(e) {
                  //   console.error("Really there is an issue");
                  //   testRetVal = origRetVal.apply(thisArg, [localDocument.documentElement]);
                  // }

                  return testRetVal;
                }
              });

              retVal.__origFunc = origRetVal;

              cachedFunctions[property] = {
                orig: origRetVal,
                proxy: retVal
              };

            }

          }
          return retVal;

        }
      },
      set: function (oTarget, sKey, vValue) {
        if (sKey === "location") {
          if ( origWindow === localWindow ) {
            // console.log("Setting window.location", vValue);
            return Reflect.set(origWindow, "proxy_location", vValue);
          }
          else if ( origWindow === virtualTop ) {
            vValue = translateTargetUrlToRequestUrl(vValue);
            try {
              return Reflect.set(origWindow, "location", vValue);
            }
            catch(e) {
              if (e instanceof DOMException) {
                console.log("Handle error in setting location on non-top window");

                __origWindow.top.postMessage({
                  type: "screenjsMessage",
                  action: "navigateTo",
                  url: vValue
                },"*");

              }
              else {
                throw e;
              }
            }
            return;
          }
          else {
            return Reflect.set(origWindow, sKey, translateTargetUrlToRequestUrl(vValue));
          }
        }
        return Reflect.set(origWindow, sKey, vValue);
      },
      deleteProperty: function (oTarget, sKey) {
        return delete origWindow[sKey];
      },
      ownKeys: function (oTarget, sKey) {
        var winKeys = Object.keys(origWindow);
        Object.keys(winDup).
          filter(function(k1){ return winKeys.indexOf(k1) < 0; }).
          forEach(function(k2){
            delete winDup[k2];
          });
        
        winKeys.forEach(function(k){
          winDup[k] = "";
        });
        return Object.keys(origWindow);
      },
      has: function (oTarget, sKey) {
        return sKey in origWindow;
      },
      defineProperty: function (oTarget, sKey, oDesc) {
        return Reflect.defineProperty(origWindow, sKey, oDesc);
      },
      getOwnPropertyDescriptor: function (oTarget, sKey) {
        var retVal = Reflect.getOwnPropertyDescriptor(origWindow, sKey);
        if (retVal) {
          retVal.configurable = true;
          retVal.writable = true;
          Reflect.defineProperty(winDup, sKey, retVal);
        }
        return retVal;
      },
      getPrototypeOf: function(target){
        return Reflect.getPrototypeOf(origWindow);
      },
    });

    if ( virtualParent === origWindow ) {
      proxyParent = winProxy;
    }

    if ( virtualTop === origWindow ) {
      proxyTop = winProxy;
    }
    
    return winProxy;
  }

  var winProxy = proxyAroundWindow(localWindow);
  var docProxy = proxyAroundDocument(localWindow.document);

  localWindow.__docProxy = docProxy;

  window.__winObj = {
    window: winProxy,
    // location: proxy_location,
    document: docProxy
  };

  Object.defineProperty(__winObj, "top", {
    get: function(){
      return winProxy.top;
    },
    set: function(val){
      localWindow.top = val;
    }
  });

  Object.defineProperty(__winObj, "parent", {
    get: function(){
      return winProxy.parent;
    },
    set: function(val){
      localWindow.parent = val;
    }
  });

  Object.defineProperty(__winObj, "self", {
    get: function(){
      return winProxy.self;
    },
    set: function(val){
      localWindow.self = val;
    }
  });

  Object.defineProperty(__winObj, "frames", {
    get: function(){
      return winProxy.frames;
    },
    set: function(val){
      localWindow.frames = val;
    }
  });

  Object.defineProperty(__winObj, "location", {
    get: function(){
      return winProxy.location;
    },
    set: function(val){
      winProxy.location = val;
    }
  });


  // (function(localWindow){

  //   var origDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow");
  //   Object.defineProperty(HTMLIFrameElement.prototype, "_contentWindow", origDesc);
  //   var origGet = origDesc.get;
  //   origDesc.get = function(val){
  //     var origContentWindow = origGet.apply(this);
  //     var proxyContentWindow = proxyAroundWindow(origContentWindow);
  //     return proxyContentWindow;
  //   };
  //   Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", origDesc);

  // })(window);

  // (function(localWindow){

  //   var origDesc = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "source");
  //   Object.defineProperty(MessageEvent.prototype, "_source", origDesc);
  //   var origGet = origDesc.get;
  //   origDesc.get = function(val){
  //     var origSource = origGet.apply(this);
  //     var proxySource = proxyAroundWindow(origSource);
  //     return proxySource;
  //   };
  //   Object.defineProperty(MessageEvent.prototype, "source", origDesc);

  // })(window);

  // var origDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow");
  // var origGet = origDesc.get;
  // origDesc.get = function(){
  //   console.log("Hi224");
  //   var origContentWindow = origGet.apply(this);
  //   var proxyContentWindow = proxyAroundWindow(origContentWindow);
  //   return proxyContentWindow;
  // };
  // Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", origDesc);

  window.__origWindow = window;

})();

// TODO: Do it for removeEventListener and dispatchEvent
// (function(localWindow){

//   var origDesc = Object.getOwnPropertyDescriptor(EventTarget.prototype, "addEventListener");
//   Object.defineProperty(EventTarget.prototype, "_addEventListener", origDesc);
//   var origValue = origDesc.value;
//   origDesc.value = function(){

//     var thisVal = this;
//     if ( thisVal === __winObj.window ) {
//       thisVal = localWindow.window;
//     }
//     else if ( thisVal === __winObj.document ) {
//       thisVal = localWindow.document;
//     }
//     return origValue.apply(thisVal, arguments);

//   };
//   Object.defineProperty(EventTarget.prototype, "addEventListener", origDesc);

// })(window);

// (function(localWindow){

//   var origDesc = Object.getOwnPropertyDescriptor(EventTarget.prototype, "removeEventListener");
//   Object.defineProperty(EventTarget.prototype, "_removeEventListener", origDesc);
//   var origValue = origDesc.value;
//   origDesc.value = function(){

//     var thisVal = this;
//     if ( thisVal === __winObj.window ) {
//       thisVal = localWindow.window;
//     }
//     else if ( thisVal === __winObj.document ) {
//       thisVal = localWindow.document;
//     }
//     return origValue.apply(thisVal, arguments);

//   };
//   Object.defineProperty(EventTarget.prototype, "removeEventListener", origDesc);

// })(window);


// Used by postMessage calls anywhere
window.__proxy_origin = function(targetOrigin){
  if ( typeof targetOrigin === "string" ) {
    if ( targetOrigin.match(/^https?\:\/\/.+/) ) {
      var origin = translateTargetUrlToRequestUrl(targetOrigin);
      if ( origin.lastIndexOf("/") === origin.length - 1 ) {
        origin = origin.slice(0, -1);
      }
      return origin;
    }
  }
  return targetOrigin;
};

// console.log(__proxy_origin("https://www.google.com:4000"));


(function(localWindow){

  var origDesc = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "origin");
  Object.defineProperty(MessageEvent.prototype, "_origin", origDesc);
  var origGet = origDesc.get;
  origDesc.get = function(){
    var origOrigin = origGet.apply(this);
    var origin = translateRequestUrlToTargetUrl(origOrigin);
    if ( origin.lastIndexOf("/") === origin.length - 1 ) {
      origin = origin.slice(0, -1);
    }
    return origin;
  };
  Object.defineProperty(MessageEvent.prototype, "origin", origDesc);

})(window);

(function(localWindow){

  var origDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src");
  Object.defineProperty(HTMLIFrameElement.prototype, "_src", origDesc);
  var origSet = origDesc.set;
  origDesc.set = function(val){
    var origSrc = val;
    var src = translateTargetUrlToRequestUrl(origSrc);
    this.setAttribute("screenjs-proxified", "true");
    return origSet.call(this, src);
  };
  var origGet = origDesc.get;
  origDesc.get = function(val){
    var retVal = origGet.call(this);
    retVal = translateRequestUrlToTargetUrl(retVal);
    return retVal;
  };
  Object.defineProperty(HTMLIFrameElement.prototype, "src", origDesc);

})(window);

(function(localWindow){

  var origDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "_src", origDesc);
  var origSet = origDesc.set;
  origDesc.set = function(val){
    var origSrc = val;
    var src = translateTargetUrlToRequestUrl(origSrc);
    this.setAttribute("screenjs-proxified", "true");
    return origSet.call(this, src);
  };
  var origGet = origDesc.get;
  origDesc.get = function(val){
    var retVal = origGet.call(this);
    retVal = translateRequestUrlToTargetUrl(retVal);
    return retVal;
  };
  Object.defineProperty(HTMLImageElement.prototype, "src", origDesc);

})(window);

(function(localWindow){

  var origDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src");
  Object.defineProperty(HTMLScriptElement.prototype, "_src", origDesc);
  var origSet = origDesc.set;
  origDesc.set = function(val){
    var origSrc = val;
    var src = translateTargetUrlToRequestUrl(origSrc);
    this.setAttribute("screenjs-proxified", "true");
    return origSet.call(this, src);
  };
  var origGet = origDesc.get;
  origDesc.get = function(val){
    var retVal = origGet.call(this);
    retVal = translateRequestUrlToTargetUrl(retVal);
    return retVal;
  };
  Object.defineProperty(HTMLScriptElement.prototype, "src", origDesc);

})(window);


(function(localWindow){

  var origDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  Object.defineProperty(HTMLInputElement.prototype, "_value", origDesc);
  var origSet = origDesc.set;
  origDesc.set = function(val){
    this.setAttribute("value", val);
    return origSet.call(this, val);
  };
  Object.defineProperty(HTMLInputElement.prototype, "value", origDesc);

})(window);

(function(localWindow){

  var origDesc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  Object.defineProperty(HTMLTextAreaElement.prototype, "_value", origDesc);
  var origSet = origDesc.set;
  origDesc.set = function(val){
    this.innerText = val;
    return origSet.call(this, val);
  };
  Object.defineProperty(HTMLTextAreaElement.prototype, "value", origDesc);

})(window);

(function(localWindow){

  var forEachFunc = [].forEach;
  var origDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  Object.defineProperty(HTMLSelectElement.prototype, "_value", origDesc);
  var origSet = origDesc.set;
  origDesc.set = function(val){

    var matchedOpt = null;
    forEachFunc.call(this._getElementsByTagName("option"), function(opt, index){
      if (opt.value == val){
        matchedOpt = opt;
      }
      else {
        opt.removeAttribute("selected");
        opt.selected = false;
      }
    });

    if ( matchedOpt !== null ) {
      matchedOpt.setAttribute("selected", "selected");
    }

    return origSet.call(this, val);
  };
  Object.defineProperty(HTMLSelectElement.prototype, "value", origDesc);

})(window);


(function(localWindow){

  var forEachFunc = [].forEach;
  var origDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");
  Object.defineProperty(HTMLSelectElement.prototype, "_selectedIndex", origDesc);
  var origSet = origDesc.set;
  origDesc.set = function(val){
    // this.innerText = val;

    console.warn("Tried to set selectedIndex");

    var matchedOpt = null;
    forEachFunc.call(this._getElementsByTagName("option"), function(opt, index){
      if (index == val){
      }
      else {
        opt.removeAttribute("selected");
        opt.selected = false;
      }
    });

    if ( matchedOpt !== null ) {
      matchedOpt.setAttribute("selected", "selected");
    }

    return origSet.call(this, val);
  };
  Object.defineProperty(HTMLSelectElement.prototype, "selectedIndex", origDesc);

})(window);


(function(localWindow){

  var origDesc = Object.getOwnPropertyDescriptor(HTMLOptionElement.prototype, "selected");
  Object.defineProperty(HTMLOptionElement.prototype, "_selected", origDesc);
  var origSet = origDesc.set;
  origDesc.set = function(val){
    if ( !!val ) {
      this.setAttribute("selected", "selected");
    }
    else {
      this.removeAttribute("selected");
    }
    return origSet.call(this, val);
  };
  Object.defineProperty(HTMLOptionElement.prototype, "selected", origDesc);

})(window);



(function(localWindow){

  var localDocument = localWindow.document;
  var origDesc = Object.getOwnPropertyDescriptor(CSSStyleRule.prototype, "style");
  Object.defineProperty(CSSStyleRule.prototype, "_style", origDesc);
  var origGet = origDesc.get;
  origDesc.get = function(){
    var origRetVal = origGet.call(this);
    var retVal = new Proxy(origRetVal, {
      set: function (oTarget, prop, val) {
        Reflect.set(oTarget, prop, val);

        var event = new CustomEvent('screenjscssrulechange', { 'detail': {
          styleObj: oTarget,
          property: prop,
          value: val
        } });

        localDocument.dispatchEvent(event);
      }
    });
    return retVal;
  };
  Object.defineProperty(CSSStyleRule.prototype, "style", origDesc);

})(window);


}

window.screenjsran = true;
