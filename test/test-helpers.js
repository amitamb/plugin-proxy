require("should");
var helpers = require("../src/helpers");
var http = require("http");
var mocks = require('mocks');
var httpMocks = require('node-mocks-http');
var C = require('../src/consts'); // for global
var url = require("url");
var ce = require('cloneextend');

// helper function
// actually can copy it to helpers
function setSproxyInRequest (req) {
	var currentRequestUrl = helpers.getRequestUrl(req);
  var currentRequestUri = url.parse(currentRequestUrl);

  var currentTargetUrl = helpers.getTargetUrl(req);
  var currentTargetUri = url.parse(currentTargetUrl);

  req.sproxy = {
    currentRequestUrl: currentRequestUrl,
    currentRequestUri: currentRequestUri,
    currentTargetUrl: currentTargetUrl,
    currentTargetUri: currentTargetUri,
    originalHeaders: ce.clone(req.headers)
  };
}

describe("string", function(){
	it("should support endsWith", function(){
		var retVal = "test string".endsWith("string");
		retVal.should.be.true;

		retVal = "test string other".endsWith("string");
		retVal.should.be.false;
	});
});

describe("helpers", function(){
	describe("checkContentType", function(){
		it("should work for string \"text/html\"", function(){
			// nothing provided
			var retVal = helpers.checkContentType();
			retVal.should.be.false;

			contentTypeHeader = "text/html";
			contentTypes = "text/html";

			retVal = helpers.checkContentType(contentTypeHeader, contentTypes);
			retVal.should.be.true;

		});

		it("should fail for absent string \"text/html\"", function(){
			var contentTypeHeader = "text/javascript";
			var contentTypes = "text/html";

			retVal = helpers.checkContentType(contentTypeHeader, contentTypes);
			retVal.should.be.false;
		});

		it("should work for array", function(){
			var contentTypeHeader = "text/html";
			var contentTypes = ["text/html"];

			retVal = helpers.checkContentType(contentTypeHeader, contentTypes);
			retVal.should.be.true;

			contentTypeHeader = "text/html";
			contentTypes = ["text/javascript", "text/html"];

			retVal = helpers.checkContentType(contentTypeHeader, contentTypes);
			retVal.should.be.true;
		});

		it("should fail for no element matching from array", function(){
			var contentTypeHeader = "text/javascript";
			contentTypes = ["application/javascript", "text/html"];

			retVal = helpers.checkContentType(contentTypeHeader, contentTypes);
			retVal.should.be.false;
		});
	});

	describe("removeHeaders", function(){
		if("should remove added headers", function(){
			var res = httpMocks.createResponse();
			
			res.setHeader("h1","v1");
			res.setHeader("h2","v3");
			res.setHeader("h3","v3");

			helpers.removeHeaders(res, ["h1", "h3"]);

			(res.getHeader("h1") === undefined).should.be.true;
			(res.getHeader("h2") === undefined).should.be.false;
			(res.getHeader("h3") === undefined).should.be.true;
		});

		if("should ignore absent headers", function(){
			var res = httpMocks.createResponse();
			
			res.setHeader("h1","v1");
			res.setHeader("h2","v3");

			helpers.removeHeaders(res, ["h1", "h3"]);

			(res.getHeader("h1") === undefined).should.be.true;
			(res.getHeader("h2") === undefined).should.be.false;
			(res.getHeader("h3") === undefined).should.be.true;
		});

		if("should ignore case", function(){
			// TODO: Check case insensitivity checks
		});

	});

	describe("updateHead", function(){
		// TODO: Check if script, link tags get added
	});

	describe("stripPortFromUrl", function(){
		it("should remove port from url", function(){
			var urlWithPort = "http://www.castbin.com:9000/about";
			urlWithPort = helpers.stripPortFromUrl(urlWithPort);
			urlWithPort.should.eql("http://www.castbin.com/about");

			urlWithPort = "http://www.castbin.com/about";
			urlWithPort = helpers.stripPortFromUrl(urlWithPort);
			urlWithPort.should.eql("http://www.castbin.com/about");		

			urlWithPort = "/about";
			urlWithPort = helpers.stripPortFromUrl(urlWithPort);
			urlWithPort.should.eql("/about");	
		});
	});

	describe("getRequestUrl", function(){
		it("should construct full path from request", function(){
			var req = httpMocks.createRequest({
	        method: 'GET',
	        url: '/user/42',
	        headers: {
	        	host: "www.castbin.com"
	        }
	    });
	    req.connection = {
	    	encrypted: false
	    };
			var fullPath = helpers.getRequestUrl(req);
			fullPath.should.eql("http://www.castbin.com/user/42");

			// Test with https
			req.connection = {
	    	encrypted: true
	    };
			fullPath = helpers.getRequestUrl(req);
			fullPath.should.eql("https://www.castbin.com/user/42");

			// with port
			req = httpMocks.createRequest({
	        method: 'GET',
	        url: '/user/42',
	        headers: {
	        	host: "www.castbin.com:9000"
	        }
	    });
	    req.connection = {
	    	encrypted: false
	    };
			var fullPath = helpers.getRequestUrl(req);
			fullPath.should.eql("http://www.castbin.com:9000/user/42");

		});
	});

	describe("getRequestHostParts", function(){
		it("should respond with parts in host", function(){
			var requestHost = "www.google.com." + global.PROXY_URL;

			var hostParts = helpers.getRequestHostParts(requestHost);

			hostParts.port.should.eql(80);
			hostParts.host.should.eql("www.google.com");

			// with port
			requestHost = "1000.www.google.com." + global.PROXY_URL;
			hostParts = helpers.getRequestHostParts(requestHost);

			hostParts.port.should.eql(1000);
			hostParts.host.should.eql("www.google.com");

			// with protocol https
			requestHost = "https.www.google.com." + global.PROXY_URL;
			hostParts = helpers.getRequestHostParts(requestHost);

			hostParts.port.should.eql(80);
			hostParts.protocol.should.eql("https:");
			hostParts.host.should.eql("www.google.com");

			// with both port and protocol https
			requestHost = "https.1000.www.google.com." + global.PROXY_URL;
			hostParts = helpers.getRequestHostParts(requestHost);

			// hostParts.port.should.eql(1000);
			hostParts.protocol.should.eql("https:");
			hostParts.host.should.eql("www.google.com");

			// without proxy suffix or port
			requestHost = "www.google.com";
			hostParts = helpers.getRequestHostParts(requestHost);

			(hostParts.port === null).should.be.true;
			hostParts.host.should.eql("www.google.com");
		});
	});

	describe("getRequestProtocol", function(){
		it("should give correct protocol for request", function(){
			var req = httpMocks.createRequest({});
			req.connection={
				encrypted: true
			};
			var retVal = helpers.getRequestProtocol(req);
			retVal.should.eql("https:");

			req = httpMocks.createRequest({});
			req.connection={
				encrypted: false
			};
			var retVal = helpers.getRequestProtocol(req);
			retVal.should.eql("http:");

		});
	});

	describe("getTargetUrl", function(){
		it("should give target Url given a request i.e. proxy it", function(){
			var req = httpMocks.createRequest({
        method: 'GET',
        url: '/search?q=query',
        headers: {
        	host: "www.google.com." + global.PROXY_URL
        }
	    });
	    req.connection={
				encrypted: false
			};

			var targetUrl = helpers.getTargetUrl(req);

			targetUrl.should.eql("http://www.google.com/search?q=query");

			req = httpMocks.createRequest({
        method: 'GET',
        url: '/search?q=query',
        headers: {
        	host: "80.www.google.com." + global.PROXY_URL
        }
	    });
	    req.connection={
				encrypted: false
			};

			targetUrl = helpers.getTargetUrl(req);

			targetUrl.should.eql("http://www.google.com/search?q=query");

			req = httpMocks.createRequest({
        method: 'GET',
        url: '/search?q=query',
        headers: {
        	host: "1000.www.google.com." + global.PROXY_URL
        }
	    });
	    req.connection={
				encrypted: false
			};

			targetUrl = helpers.getTargetUrl(req);

			targetUrl.should.eql("http://www.google.com:1000/search?q=query");

			// with https
			req = httpMocks.createRequest({
        method: 'GET',
        url: '/search?q=query',
        headers: {
        	host: "https.www.google.com." + global.PROXY_URL
        }
	    });
	    req.connection={
				encrypted: false
			};

			targetUrl = helpers.getTargetUrl(req);

			targetUrl.should.eql("https://www.google.com/search?q=query");

		});
	});

	describe("translateRequestUrlToTargetUrl", function(){
		var requestUrl = "http://www.google.com." + global.PROXY_URL;
		var targetUrl = helpers.translateRequestUrlToTargetUrl(requestUrl);
		targetUrl.should.eql("http://www.google.com/");

		requestUrl = "http://1000.www.google.com." + global.PROXY_URL;
		targetUrl = helpers.translateRequestUrlToTargetUrl(requestUrl);
		targetUrl.should.eql("http://www.google.com:1000/");

		requestUrl = "http://https.www.google.com." + global.PROXY_URL;
		targetUrl = helpers.translateRequestUrlToTargetUrl(requestUrl);
		targetUrl.should.eql("https://www.google.com/");

		requestUrl = "http://https.1000.www.google.com." + global.PROXY_URL;
		targetUrl = helpers.translateRequestUrlToTargetUrl(requestUrl);
		targetUrl.should.eql("https://www.google.com:1000/");
	});

	describe("translateRequestUrlHeadersToTargetUrls", function(){
		it("should translate request headers with URLs", function(){
			var req = httpMocks.createRequest({
        method: 'GET',
        url: '/search?q=query',
        headers: {
        	host:    "www.google.com." + global.PROXY_URL,
        	origin:  "http://www.amitamb.com." + global.PROXY_URL + "/index?a=b",
        	referer: "http://www.amitamb.com." + global.PROXY_URL + "/index?a=b",
        	faulty:  "http://www.withoutsuffix.com/index?a=b"
        }
	    });
	    req.connection={
				encrypted: false
			};
			var keys = ["origin", "referer", "faulty"];

			helpers.translateRequestUrlHeadersToTargetUrls(req, keys);

			req.headers["origin"].should.eql("http://www.amitamb.com/index?a=b");
			req.headers["referer"].should.eql("http://www.amitamb.com/index?a=b");
			req.headers["faulty"].should.eql("http://www.withoutsuffix.com/index?a=b");
		});
	});

	describe("deleteHeaders", function(){
		it("should delete headers from request", function(){
			var req = httpMocks.createRequest({
        method: 'GET',
        url: '/search?q=query',
        headers: {
        	host:    "www.google.com." + global.PROXY_URL,
        	origin:  "http://www.amitamb.com." + global.PROXY_URL + "/index?a=b",
        	referer: "http://www.amitamb.com." + global.PROXY_URL + "/index?a=b"
        }
	    });

			helpers.deleteHeaders(req, ["origin", "referer"]);

			( req.headers["host"] === undefined ).should.be.false;
			( req.headers["origin"] === undefined ).should.be.true;
			( req.headers["referer"] === undefined ).should.be.true;

		});
	});

	describe("translateTargetHostToRequestHost", function(){
		var targetHost;
		targetHost = "www.google.com";
		requestHost = helpers.translateTargetHostToRequestHost(targetHost);
		requestHost.should.eql("www.google.com." + global.PROXY_URL + "");

		targetHost = "www.google.com:1000";
		requestHost = helpers.translateTargetHostToRequestHost(targetHost);
		requestHost.should.eql("1000.www.google.com." + global.PROXY_URL + "");

		targetHost = "www.google.com." + global.PROXY_URL;
		requestHost = helpers.translateTargetHostToRequestHost(targetHost);
		requestHost.should.eql("www.google.com." + global.PROXY_URL + "");

		targetHost = "1000.www.google.com." + global.PROXY_URL;
		requestHost = helpers.translateTargetHostToRequestHost(targetHost);
		requestHost.should.eql("1000.www.google.com." + global.PROXY_URL + "");

	});

	describe("translateTargetCookieToRequestCookie", function(){
		it("should not modify cookies with domain not specified", function(){
			var setCookieStr = "_dav_session=BAh7B0kiD3Nlc3Npb25faWQGOgZFRkkiJTVlN2FlZDM5NWY4ODk1OWQ5N2E0Mzg3YThmYjAzMDllBjsAVEkiEF9jc3JmX3Rva2VuBjsARkkiMW03L05nNWE5ZnZsTWxqWnVLY0hDSEJlc2N2c2JnRWo1S0tuN3VGYTM0ZVU9BjsARg%3D%3D--702e90bb3056d6f9aa25ed7a3a33c37551cab195; path=/; HttpOnly";
			var targetUri = url.parse("http://www.google.com/");
			newCookieStr = helpers.translateTargetCookieToRequestCookie(setCookieStr, targetUri);
			newCookieStr.should.eql(["_dav_session=BAh7B0kiD3Nlc3Npb25faWQGOgZFRkkiJTVlN2FlZDM5NWY4ODk1OWQ5N2E0Mzg3YThmYjAzMDllBjsAVEkiEF9jc3JmX3Rva2VuBjsARkkiMW03L05nNWE5ZnZsTWxqWnVLY0hDSEJlc2N2c2JnRWo1S0tuN3VGYTM0ZVU9BjsARg%3D%3D--702e90bb3056d6f9aa25ed7a3a33c37551cab195; Domain=www.google.com." + global.PROXY_URL + "; Path=/; HttpOnly"])
		});

		it("should not modify domain correctly", function(){
			var setCookieStr = "highContrastMode=deleted; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Domain=facebook.com; Path=/; HttpOnly";
			newCookieStr = helpers.translateTargetCookieToRequestCookie(setCookieStr);
			newCookieStr.should.eql(["highContrastMode=deleted; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Domain=facebook.com."+global.PROXY_URL+"; Path=/; HttpOnly"])
		});

		it("should remove secure flag", function(){
			var setCookieStr = "highContrastMode=deleted; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Domain=facebook.com; Path=/; HttpOnly; Secure";
			newCookieStr = helpers.translateTargetCookieToRequestCookie(setCookieStr);
			newCookieStr.should.eql(["highContrastMode=deleted; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Domain=facebook.com."+global.PROXY_URL+"; Path=/; HttpOnly"])
		});
	});

	describe("translateSetCookieHeaders", function(){
		it("should translate cookies", function(){
			var req = httpMocks.createRequest({
	      method: 'GET',
	      url: '/search?q=query',
	      headers: {
	      	host:    "www.google.com." + global.PROXY_URL
	      }
	    });
	    req.connection = { encrypted:false };

			setSproxyInRequest(req);

			var res = httpMocks.createResponse();

			res.setHeader("set-cookie", [
				"highContrastMode=deleted; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Domain=facebook.com; Path=/; HttpOnly",
				"highContrastMode=deleted; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Domain=facebook.com; Path=/; Secure"
			]);

			helpers.translateSetCookieHeaders(res, req);

			res.getHeader("set-cookie").should.eql([
				"highContrastMode=deleted; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Domain=facebook.com."+global.PROXY_URL+"; Path=/; HttpOnly",
				"highContrastMode=deleted; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Domain=facebook.com."+global.PROXY_URL+"; Path=/"
			]);

			// set-cookie not an array
			res.setHeader("set-cookie", "highContrastMode=deleted; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Domain=facebook.com; Path=/; HttpOnly");

			helpers.translateSetCookieHeaders(res, req);

			res.getHeader("set-cookie").should.eql(["highContrastMode=deleted; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Domain=facebook.com."+global.PROXY_URL+"; Path=/; HttpOnly"])
		});
	});

	describe("handleLocationHeader", function() {
		it("should translate location", function(){
			var req = httpMocks.createRequest({
	      method: 'GET',
	      url: '/search?q=query',
	      headers: {
	      	host:    "www.amitamb.com." + global.PROXY_URL
	      }
	    });
	    req.connection = { encrypted:false };

			setSproxyInRequest(req);

			var res = httpMocks.createResponse();

			res.sproxy = {};

			res.setHeader("location", "http://www.google.com/");

			helpers.handleLocationHeader(res, req);

			res.getHeader("location").should.eql("http://www.google.com."+ global.PROXY_URL +"/");

			// handle relative Urls
			res.setHeader("location", "/");

			helpers.handleLocationHeader(res, req);

			res.getHeader("location").should.eql("http://www.amitamb.com."+ global.PROXY_URL +"/");
		});
	});

	describe("handleCORS", function(){
		it("should translate CORS header", function(){
			var req = httpMocks.createRequest({
	      method: 'GET',
	      url: '/search?q=query',
	      headers: {
	      	host:    "www.google.com." + global.PROXY_URL,
	      	origin:  "http://www.google.com."+global.PROXY_URL+"/",
	      	referer: "http://www.google.com."+global.PROXY_URL+"/"
	      }
	    });
	    req.connection = { encrypted:false };

			setSproxyInRequest(req);

			var res = httpMocks.createResponse();

			res.sproxy = {};

			res.setHeader("access-control-allow-origin", "http://www.google.com/");

			helpers.handleCORS(res, req);

			res.getHeader("access-control-allow-origin").should.eql("http://www.google.com."+ global.PROXY_URL +"/");
		});
	});

	describe("translateRequestParamDomainsToTargetParamDomains", function() {
		it("should translate request params as well", function(){
			var req = httpMocks.createRequest({
	      method: 'GET',
	      url: "/search?q=http://www.google.com."+global.PROXY_URL+"/",
	      headers: {
	      	host:    "www.google.com." + global.PROXY_URL
	      }
	    });
			req.connection = { encrypted:false };

			helpers.translateRequestParamDomainsToTargetParamDomains(req);
			req.url.should.eql("/search?q=http://www.google.com/");

			// nothing to replace
			req.url = "/search?q=http://www.google.com/&q1=http://www.amitamb.com/something"
			helpers.translateRequestParamDomainsToTargetParamDomains(req);
			req.url.should.eql("/search?q=http://www.google.com/&q1=http://www.amitamb.com/something");

			// multiple replacements
			req.url = "/search?q=http://www.google.com."+global.PROXY_URL+"/&q1=http://www.amitamb.com."+global.PROXY_URL+"/something"
			helpers.translateRequestParamDomainsToTargetParamDomains(req);
			req.url.should.eql("/search?q=http://www.google.com/&q1=http://www.amitamb.com/something");

		});
	});

	describe("translateScriptSrc", function(){
		it("should translate normal url", function(){
			var req = httpMocks.createRequest({
	      method: 'GET',
	      url: "/search?q=http://www.google.com."+global.PROXY_URL+"/",
	      headers: {
	      	host:    "www.google.com." + global.PROXY_URL
	      }
	    });
	    req.connection = { encrypted:false };

	    setSproxyInRequest(req);

	    var translatedSrc = helpers.translateScriptSrc("http://www.example.com/test.js", req);

	    translatedSrc.should.eql("http://www.example.com."+global.PROXY_URL+"/test.js");
		});

		it("should translate url without protocol", function(){
			var req = httpMocks.createRequest({
	      method: 'GET',
	      url: "/search?q=http://www.google.com."+global.PROXY_URL+"/",
	      headers: {
	      	host:    "www.google.com." + global.PROXY_URL
	      }
	    });
	    req.connection = { encrypted:false };

	    setSproxyInRequest(req);

	    var translatedSrc = helpers.translateScriptSrc("//www.example.com/test.js", req);

	    translatedSrc.should.eql("http://www.example.com."+global.PROXY_URL+"/test.js");
		});

	});

});