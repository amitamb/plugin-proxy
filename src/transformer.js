var helpers = require('./helpers'),
    UglifyJS = require("uglify-js");


const PROXY_PREFIX = "proxy_";

// TODO: contentWindow.location will cause exception for frames
const WINDOW_PROPS = ["top", "parent"];
const LOCATION_PROP = "location";

const ORIGIN_PROXY_FUNC = "__proxy_origin";
const WINDOW_PROXY_FUNC = "__proxy_window_get";
const LOCATION_PROXY_FUNC_GET = "__proxy_location_get";
const LOCATION_PROXY_FUNC_SET = "__proxy_location_set";

const GET_FUNCS = [ WINDOW_PROXY_FUNC, LOCATION_PROXY_FUNC_GET ]

function convertGlobalThisTowindow(code, isInline) {

  try {

    var ast = UglifyJS.parse(code);
    ast.figure_out_scope();

    var topLevelFuncs = [];
    ast.body.forEach(function(node){
      if ( node.TYPE === "Defun" && node.name.TYPE === "SymbolDefun" ) {
        topLevelFuncs.push(node.name.name);
      }
    });

    var new_ast = ast.transform(new UglifyJS.TreeTransformer(function(node, descend){

      if ( node instanceof UglifyJS.AST_Call && !(node instanceof UglifyJS.AST_New) ) {
        if ( node.expression && node.expression instanceof UglifyJS.AST_Function && node.expression.parent_scope && node.expression.parent_scope.nesting === 0 ) {
          node.expression.iife = true;
        }
      }

    }, function(node){

      if ( node instanceof UglifyJS.AST_Dot || // window.top
          (node instanceof UglifyJS.AST_Sub && node.property instanceof UglifyJS.AST_String) // window["top"]
      ) {

        var property = node.property;
        if ( node instanceof UglifyJS.AST_Sub )
          property = node.property.value;
        var proxy_func = null;
        if ( WINDOW_PROPS.indexOf(property) >= 0 ) {
          proxy_func = WINDOW_PROXY_FUNC;
        }
        else if ( LOCATION_PROP === property ) {
          proxy_func = LOCATION_PROXY_FUNC_GET;
        }
        if ( proxy_func ) {
          node = new UglifyJS.AST_Call({
            expression: new UglifyJS.AST_SymbolRef({
              name: proxy_func
            }),
            args: [
              node
            ]
          });
        }
        return node;
      }
      else if ( node instanceof UglifyJS.AST_Assign &&
                node.left && node.left instanceof UglifyJS.AST_Call &&
                node.left.expression instanceof UglifyJS.AST_SymbolRef &&
                GET_FUNCS.indexOf(node.left.expression.name) >= 0
      ) {
        if ( node.left.expression.name === LOCATION_PROXY_FUNC_GET ) {
          node.left = node.left.args[0];
          node = new UglifyJS.AST_Call({
            expression: new UglifyJS.AST_SymbolRef({
              name: LOCATION_PROXY_FUNC_SET
            }),
            args: [
              node.left.expression,
              // node.left instanceof UglifyJS.AST_Dot ? node.left.property : node.left.property.value,
              new UglifyJS.AST_String({value: "location"}),
              node.right
            ]
          });
        }
        else {
          node.left = node.left.args[0];
        }
        return node;
      }
      else if ( node instanceof UglifyJS.AST_Call && node.expression &&
                node.expression instanceof UglifyJS.AST_Call &&
                node.expression.expression &&
                GET_FUNCS.indexOf(node.expression.expression.name) >= 0
      ) {
        node.expression = node.expression.args[0];
        return node;
      }
      else if (node instanceof UglifyJS.AST_SymbolRef && node.thedef && node.thedef.scope instanceof UglifyJS.AST_Toplevel ) {
        var property = node.name;
        if ( WINDOW_PROPS.indexOf(property) >= 0 || property === LOCATION_PROP ) {
          return new UglifyJS.AST_SymbolRef({
            start : node.start,
            end   : node.end,
            name  : PROXY_PREFIX + property
          });
        }
      }
      else if (node.TYPE === "Call" && node.expression && node.args.length >= 2 ) {
        var foundPostMessage = false;
        if ( node.expression instanceof UglifyJS.AST_Dot &&
             node.expression.property === "postMessage" ) {

          foundPostMessage = true;
        }
        else if ( node.expression instanceof UglifyJS.AST_Sub &&
                  node.expression.property && node.expression.property instanceof UglifyJS.AST_String &&
                  node.expression.property.value === "postMessage" ) {

          foundPostMessage = true;
        }
        if ( foundPostMessage ) {
          node.args[1] = new UglifyJS.AST_Call({
            expression: new UglifyJS.AST_SymbolRef({
              name: ORIGIN_PROXY_FUNC
            }),
            args: [
              node.args[1]
            ]
          });
        }
      }

      // if (node instanceof UglifyJS.AST_Symbol && node.name == "this" && (node.scope.nesting === 0 || node.scope.iife) ) {
      //   return new UglifyJS.AST_SymbolRef({
      //     start : node.start,
      //     end   : node.end,
      //     name  : "__window"
      //   });
      // }
      // else if (node instanceof UglifyJS.AST_Symbol && node.name == "this" && node.scope.nesting <= 8) {
      //   return new UglifyJS.AST_Conditional({
      //     condition: new UglifyJS.AST_Binary({
      //       left: new UglifyJS.AST_This({
      //         name: "this"
      //       }),
      //       operator: "===",
      //       right: new UglifyJS.AST_SymbolRef({
      //         name: "__origWindow"
      //       })
      //     }),
      //     consequent: new UglifyJS.AST_SymbolRef({
      //       name: "__window"
      //     }),
      //     alternative: new UglifyJS.AST_This({
      //       name: "this"
      //     })
      //   });

      //   // console.log(node.scope.nesting);
      //   // console.log("Found!");
      // }
      // else if (node instanceof UglifyJS.AST_Toplevel) {

      //   // we get here after the toplevel node was processed,
      //   var statements = topLevelFuncs.map(function(topLevelFunc) {
      //     return new UglifyJS.AST_SimpleStatement({
      //       body: new UglifyJS.AST_Assign({
      //         left: new UglifyJS.AST_Dot({
      //           expression: new UglifyJS.AST_SymbolRef({
      //             name: "window"
      //           }),
      //           property: topLevelFunc
      //         }),
      //         operator: "=",
      //         right: new UglifyJS.AST_SymbolRef({
      //           name: topLevelFunc
      //         })
      //       })
      //     });
      //   });

      //   node.body.unshift.apply(node.body, statements);
      //   return node;
      // }

    }));

    var options = {
      semicolons: true
    };

    if ( process.env.IS_DEVELOPMENT ) {
      options.beautify = true
    }

    if ( isInline ) {
      options["inline_script"] = true;
    }

    return ast.print_to_string(options);
  }
  catch (e) {
    if ( process.env.IS_DEVELOPMENT ) {
      console.log("Found issue in processing following code:");
      console.log(code.slice(100));
      console.log("\n");
    }
    console.log(e);
    return code;
  }
}

var transformScript = function(scriptContent, isInline, checkForJSON){

  if (!scriptContent.trim()) return scriptContent;

  if ( scriptContent.indexOf(")]}',") === 0 ) {
    return scriptContent;
  }

  if ( checkForJSON ) {
    try {
      JSON.parse(scriptContent);
      return scriptContent;
    }
    catch(e){
      console.log("can not parse JSON", e);
      // console.log(scriptContent.slice(100));
      // Ignore exception and continue. An invalid JS most probably.
    }
  }

  //TODO: Handle <script><!-- //valid js --></script>
  // above example is valid and should not be processed as it is

  // scriptContent = replaceAll("([^${]|^)\\blocation.href\\b", "$1proxy_location.href", scriptContent);
  // // $location.host was getting replaced by $proxy_location.host which was causing problem
  // scriptContent = replaceAll("([^$]|^)\\blocation.host\\b", "$1proxy_location.host", scriptContent);
  // scriptContent = replaceAll("\\btop.location\\b", "proxy_location", scriptContent);
  // scriptContent = replaceAll("\\bparent.location\\b", "proxy_location", scriptContent);
  // scriptContent = replaceAll("window\\.location\\b", "window.proxy_location", scriptContent);

  // return scriptContent;

  // // Replacing window.top with window so as to make following kind of code work
  // // var parent = window.parent; if(parent!=self){}
  // // But that caused issue with GoDaddy so now allowing following kind of code
  // // window.parent.someMethod
  // // i.e window.parent with dot at end
  // scriptContent = replaceAll("window.top([^\\.])", "window$1", scriptContent);
  // scriptContent = replaceAll("window.parent([^\\.])", "window$1", scriptContent);
  // scriptContent = replaceAll("window.parent([\\.])", "window.proxy_parent$1", scriptContent);

  // scriptContent = replaceAll("top[ ]*\!\=\[ ]*self", "self!=self", scriptContent);
  // // TODO: Obvious chance to merge above statement with this
  // scriptContent = replaceAll("top[ ]*\!\=\=[ ]*self", "self!=self", scriptContent);
  // //TODO: Consider using same approach as .location with Object.prototype override
  // scriptContent = replaceAll("top[ ]*\!\=\[ ]*window", "window!=window", scriptContent);
  // // TODO: Obvious chance to merge above statement with this
  // scriptContent = replaceAll("top[ ]*\!\=\=[ ]*window", "window!=window", scriptContent);

  // scriptContent = replaceAll("self[ ]*\!\=\[ ]*top", "self!=self", scriptContent);
  // // TODO: Obvious chance to merge above statement with this
  // scriptContent = replaceAll("self[ ]*\!\=\=[ ]*top", "self!=self", scriptContent);
  // //TODO: Consider using same approach as .location with Object.prototype override
  // scriptContent = replaceAll("window[ ]*\!\=\[ ]*top", "window!=window", scriptContent);
  // // TODO: Obvious chance to merge above statement with this
  // scriptContent = replaceAll("window[ ]*\!\=\=[ ]*top", "window!=window", scriptContent);

  // // scriptContent = replaceAll("window.parent", "window", scriptContent);

  // // scriptContent = replaceAll("\\.parent", ".proxy_parent", scriptContent);

  // // scriptContent = "(function(){var top=window;var parent=window;\n" + scriptContent;
  // scriptContent = scriptContent + "\n})();";

  // raise ;

  // Not on __window
  // __window used to replace keyword this
  // in above function convertGlobalThisTowindow
  // can not replace it with window
  // as local variable can have name which can make
  // code look like following
  // var window = this ->
  // var window = window
  // which is invalid and caused window to be undefined

  var prefix = "if(window.__winObj==null){window.__winObj={};console.error('__winObj');};with(window.__winObj){__window=window;\n";
  var suffix = "\n}";

  scriptContent = convertGlobalThisTowindow(scriptContent, isInline);

  // scriptContent = prefix + scriptContent + suffix;  

  return scriptContent;
};

exports.transformScript = transformScript;

var transformCSS = function(cssContent, req){
  cssContent = cssContent.replace(/(src\:[^;}\:]*?url\([ \'\"]?)(.+?)([ \'\"]?\))/g, function(m, p1, fontUrl, p3){
    fontUrl = helpers.translateFontSrc(fontUrl, req);
    return [p1, fontUrl, p3].join("");
  });

  cssContent = cssContent.replace(/(\@import [^;}\:\n]*?url\([ \'\"]?)(.+?)([ \'\"]?\))/g, function(m, p1, fontUrl, p3){
    fontUrl = helpers.translateLinkHref(fontUrl, req);
    return [p1, fontUrl, p3].join("");
  });

  cssContent = cssContent.replace(/(\@import [\'\"])(.+?)([ \'\"])/g, function(m, p1, fontUrl, p3){
    fontUrl = helpers.translateLinkHref(fontUrl, req);
    return [p1, fontUrl, p3].join("");
  });

  cssContent = cssContent.replace(/\:hover/g, ".cb-pvt-hover");

  // cssContent = cssContent.replace(/\:visited/g, ".cb-pvt-visited");

  return cssContent;
};

exports.transformCSS = transformCSS;

exports.apply = function(res, req) {

  // define variables to be used in multiple calls to write
  var scriptContent = "";
  var scriptOpenTag = "";

  var styleContent = "";
  var styleOpenTag = "";

  // create list of states as constants
  var states = {
    DEFAULT: 0,
    AFTER_COMMENT_OPEN_TAG : 1,
    AFTER_SCRIPT_OPEN_TAG: 2,
    AFTER_STYLE_OPEN_TAG: 3
  };

  // set state variable to default state
  var state = states.DEFAULT;

  // very high constant value(VHCV)
  var VHCV = 4000000;

  // redefine write
  res._beforeTransformedWrite = res.write;
  res._transformedWrite = res.write = function(data, encoding){
    // already converted to string so no need to do conversion
    // check _beforeTagDelimitedWrite


    // if ( !helpers.checkContentType(res.sproxy.contentType, "text/html") ) {

    //   console.log("Return because of text/html check");

    //   return res._beforeTransformedWrite(data, encoding);
    // }

    if ( // This means it is an AJAX request, so no need to update HEAD
      !(
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
      )
    ) {

      // console.log("Return because of text/html check");

      return res._beforeTransformedWrite(data, encoding);
    }
    
    data = data || "";
    data = data.toString();

    // apply switch statements based on current state
    switch(state)
    {
    case states.DEFAULT:
    // DEFAULT
      // search for opening script tag
      // if found <script with complete open tag i.e. <script anything="anything">
      var scriptOpenTagRegexp = /<script[^<>]*>/;
      var scriptTagIndex;
      var scriptTagEndIndex;
      if ( ( scriptTagIndex = data.search(scriptOpenTagRegexp) ) >= 0 ) {
        // record location of script tag
        // scriptTagIndex = scriptTagIndex;
        // also record end location
        var scriptTag = scriptOpenTagRegexp.exec(data)[0];
        scriptTagEndIndex = scriptTagIndex + scriptTag.length;
      }
      else {
        // set script location to very high constant value(VHCV)
        scriptTagIndex = VHCV;
      }

      var commentTagIndex;
      // if comment tag found
      if ( ( commentTagIndex = data.indexOf("<!--") ) >= 0 ) {
        // record location of comment tag
        // commentTagIndex = commentTagIndex;
      }
      else {
        // set script location to very high constant value(VHCV)
        commentTagIndex = VHCV;
      }

      var styleOpenTagRegexp = /<style[^<>]*>/;
      var styleTagIndex;
      var styleTagEndIndex;
      if ( ( styleTagIndex = data.search(styleOpenTagRegexp) ) >= 0 ) {
        // record location of script tag
        // also record end location
        var styleTag = styleOpenTagRegexp.exec(data)[0];
        styleTagEndIndex = styleTagIndex + styleTag.length;
      }
      else {
        // set script location to very high constant value(VHCV)
        styleTagIndex = VHCV;
      }

      // if script location != VHCV and location of script tag before of comment
      if ( scriptTagIndex != VHCV && scriptTagIndex < commentTagIndex && scriptTagIndex < styleTagIndex ) {
        // chunk the current block 
        // into 3 parts
        // before <script -> write it
        var beforeScriptTag = data.slice(0, scriptTagIndex);
        if ( beforeScriptTag.length > 0 ) {
          res._beforeTransformedWrite(beforeScriptTag, encoding);
        }
        // <script > part
        var scriptTag = data.slice(scriptTagIndex, scriptTagEndIndex);
        // rest
        var rest = data.slice(scriptTagEndIndex);
        // set following variables
        // scriptOpenTag = "<script src=''>" etc.
        scriptOpenTag = scriptTag;
        // scriptContent = ""
        scriptContent = "";
        // flag to AFTER_SCRIPT_OPEN_TAG
        state = states.AFTER_SCRIPT_OPEN_TAG;
        // call self with rest
        res._transformedWrite(rest, encoding);
      }
      // else if comment location != VHCV
      else if ( commentTagIndex != VHCV && commentTagIndex < styleTagIndex ) {
        // set state to AFTER_COMMENT_OPEN_TAG
        state = states.AFTER_COMMENT_OPEN_TAG;
        var parts = divideString(data, commentTagIndex + "<!--".length );
        // write everything till start of comment i.e. <!-- inclusive
        res._beforeTransformedWrite(parts[0], encoding);
        // call self with rest
        res._transformedWrite(parts[1], encoding);
      }
      else if ( styleTagIndex != VHCV ) {
        // chunk the current block
        // into 3 parts
        // before <style -> write it
        var beforeStyleTag = data.slice(0, styleTagIndex);
        if ( beforeStyleTag.length > 0 ) {
          res._beforeTransformedWrite(beforeStyleTag, encoding);
        }
        // <style > part
        var styleTag = data.slice(styleTagIndex, styleTagEndIndex);
        // rest
        var rest = data.slice(styleTagEndIndex);
        // set following variables
        // styleOpenTag = "<style src=''>" etc.
        styleOpenTag = styleTag;
        // styleContent = ""
        styleContent = "";
        // flag to AFTER_STYLE_OPEN_TAG
        state = states.AFTER_STYLE_OPEN_TAG;
        // call self with rest
        res._transformedWrite(rest, encoding);
      }
      else {
        // write it out
        res._beforeTransformedWrite(data, encoding);
      }
      break;

    // AFTER_COMMENT_OPEN_TAG
    case states.AFTER_COMMENT_OPEN_TAG:

      // if found -->
      var commentClosingTagIndex;
      if ( ( commentClosingTagIndex = data.indexOf("-->") ) >= 0 ) {
        // change flag to DEFAULT
        state = states.DEFAULT;
        var parts = divideString(data, commentClosingTagIndex + "-->".length);
        // write out everything till --> inclusive
        res._beforeTransformedWrite(parts[0], encoding);
        // call self with rest
        res._transformedWrite(parts[1], encoding);
      }
      else {
        // write out data to output
        res._beforeTransformedWrite(data, encoding);
      }
    break;

    // AFTER_SCRIPT_OPEN_TAG
    case states.AFTER_SCRIPT_OPEN_TAG:
      // now our task is to search for closing script tag
      // if found change flag to default otherwise add to scriptContent

      var scriptClosingTagIndex;
      // check if current data block contains </script>
      if ( ( scriptClosingTagIndex = data.indexOf("</script>") ) >= 0 ) {
        // if yes split the block in three parts
        // first till </script> -> append to scriptContent
        scriptContent += data.slice(0, scriptClosingTagIndex);
        // actual script tag = </script> 
        var scriptClosingTag = "</script>";
        // rest
        var rest = data.slice(scriptClosingTagIndex + scriptClosingTag.length);

        var typeMatches = scriptOpenTag.match(/type=[\'\"]([^\>\ \n]+)[\'\"]/);
        var validType = !typeMatches;
        if ( typeMatches && ["text/javascript", "text/ecmascript", "application/javascript", "application/ecmascript" ].indexOf(typeMatches[1]) >= 0 ) {
          validType = true;
        }

        // replace src in script open tag if present
        if ( scriptOpenTag.indexOf("for-screenjs-proxy") < 0 && validType ) {

          scriptOpenTag = scriptOpenTag.replace(/src=[\'\"]?([^\>\ \'\"\n]+)[\'\"]?/, function(full_match, src){
            return "src=\""+helpers.translateScriptSrc(src, req)+"\"";
          });

          scriptOpenTag = scriptOpenTag.replace(/integrity=[\'\"]?([^\>\ \'\"\n]+)[\'\"]?/i, function(full_match, hash){
            return "integrity_del=\""+hash+"\"";
          });
        }

        // do replacing operation on scriptContent and
        // scriptContent = "var replaced_script=3;";
        // scriptContent = replaceAll("\\.location", ".proxy_location", scriptContent);

        if ( validType ) {
          scriptContent = transformScript(scriptContent, true);
        }

        // scriptOpenTag replacement
        // scriptOpenTag = "<script>";
        // write it out
        res._beforeTransformedWrite(scriptOpenTag + scriptContent + scriptClosingTag);

        // reset scriptContent
        scriptOpenTag = "";
        scriptContent = "";

        // change flag to DEFAULT
        state = states.DEFAULT;

        // call self with rest of chunk
        if ( rest.length > 0 ) {
          res._transformedWrite(rest, encoding);
        }
      }
      // if no </script> found
      else {
        // append the data to scriptContent and continue
        scriptContent += data;
      }
    break;

    // AFTER_STYLE_OPEN_TAG
    case states.AFTER_STYLE_OPEN_TAG:

      // now our task is to search for closing style tag
      // if found change flag to default otherwise add to styleContent

      var styleClosingTagIndex;
      // check if current data block contains </style>
      if ( ( styleClosingTagIndex = data.indexOf("</style>") ) >= 0 ) {
        // if yes split the block in three parts
        // first till </style> -> append to styleContent
        styleContent += data.slice(0, styleClosingTagIndex);
        // actual style tag = </style> 
        var styleClosingTag = "</style>";
        // rest
        var rest = data.slice(styleClosingTagIndex + styleClosingTag.length);

        styleContent = transformCSS(styleContent, req);

        // styleOpenTag replacement
        // styleOpenTag = "<style>";
        // write it out
        res._beforeTransformedWrite(styleOpenTag + styleContent + styleClosingTag);

        // reset styleContent
        styleOpenTag = "";
        styleContent = "";

        // change flag to DEFAULT
        state = states.DEFAULT;

        // call self with rest of chunk
        if ( rest.length > 0 ) {
          res._transformedWrite(rest, encoding);
        }
      }
      // if no </style> found
      else {
        // append the data to styleContent and continue
        styleContent += data;
      }
    break;

    }
  };

  // redefine end
  res._beforeTransformedEnd = res.end;
  res._transformedEnd = res.end = function(data, encoding){

    if ( !helpers.checkContentType(res.sproxy.contentType, "text/html") ) {
      return res._beforeTransformedEnd(data, encoding);
    }

    // if state is AFTER_SCRIPT_OPEN_TAG
    if ( state == states.AFTER_SCRIPT_OPEN_TAG ) {
      // we are in progress with script
      // we haven't yet found end script tag
      // and have buffered content till now in scriptContent
      // write the script content to original write along with scroptOpenTag
      res._beforeTransformedWrite(scriptOpenTag + scriptContent);
      // and call end
      res._beforeTransformedEnd(data, encoding);
    }
    // in all other cases we don't buffer anything and just write everything out
    else {
      // so just call normal end
      res._beforeTransformedEnd(data, encoding);
    }
  };

  res._beforeLinkProxifierWrite = res.write;
  res._linkProxifierWrite = res.write = function(data, encoding) {
    if ( !helpers.checkContentType(res.sproxy.contentType, "text/html") ) {
      return res._beforeLinkProxifierWrite(data, encoding);
    }
    else {

      // console.log("**************************************");
      // console.log("**************************************");
      // console.log(data);
      // console.log("**************************************");
      // console.log("**************************************");

      // var urls = []


      // data = data.replace(/<iframe[^<>]*?>/g, function(iframeTag){
      //   console.log(iframeTag);
      //   // if (/\brel=[\"\']?\bstylesheet[\"\']?/.test(iframeTag)) {
      //     iframeTag = iframeTag.replace(/\b(src=[\"\']?)(.+?)([\"\']?(\/\>|[ >$]))/, function(m, p1, srcUrl, p3){

      //       // console.log(hrefUrl);

      //       // urls.push(hrefUrl);

      //       // hrefUrl = "test123";

      //       srcUrl = helpers.translateFrameSrc(srcUrl, req);

      //       return [p1, srcUrl, p3].join("");
      //     });
      //   // }
      //   // iframeTag = iframeTag.replace(/ integrity\=/gi, " integrity_del=");
      //   return iframeTag;
      // });

      data = data.replace(/<link[^<>]*?>/g, function(linkTag){
        console.log(linkTag);
        if (/\brel=[\"\']?\bstylesheet[\"\']?/.test(linkTag)) {
          linkTag = linkTag.replace(/\b(href=[\"\']?)(.+?)([\"\']?(\/\>|[ >$]))/, function(m, p1, hrefUrl, p3){

            // console.log(hrefUrl);

            // urls.push(hrefUrl);

            // hrefUrl = "test123";

            hrefUrl = helpers.translateLinkHref(hrefUrl, req);

            return [p1, hrefUrl, p3].join("");
          });
        }
        linkTag = linkTag.replace(/ integrity\=/gi, " integrity_del=");
        return linkTag;
      });

      // console.log(urls);

      // console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");
      // console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");
      // console.log(data);
      // console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");
      // console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");

      res._beforeLinkProxifierWrite(data, encoding);
    }
  };

  res._beforeLinkProxifierEnd = res.end;
  res._linkProxifierEnd = res.end = function(data, encoding) {
    res._beforeLinkProxifierEnd(data, encoding);
  };

  // this fn rewrites will only do work
  // of spliting chunks and calling writes later on such
  // that there are no incomplete
  // tag names

  var remaining = "";

  res._beforeTagDelimitedWrite = res.write;
  res._tagDelimitedWrite = res.write = function(data, encoding) {

    if ( !helpers.checkContentType(res.sproxy.contentType, "text/html") ) {
      return res._beforeTagDelimitedWrite(data, encoding);
    }

    // inside write
    if ( data == null ) {
      data = "";
    }
    data = data.toString(encoding || "utf8")

    // use remaining from earlier write if any and
    // prepend it to data
    if ( remaining ) {
      data = remaining + data;
      remaining = "";
    }

    // check if there is unclosed tag at the end
    var parts;
    if ( ( parts = checkUnclosedTagAtEnd(data) ) ) {
      // set remaining variable
      remaining = parts[1];
      // set data variable
      data = parts[0];
    }

    // write out data
    res._beforeTagDelimitedWrite(data);
  }

  // redefine end
  res._tagDelimitedEnd = res.end;
  res.end = function(data, encoding){
    // inside end
    // if data not provided
    // data set to blank
    data = data || "";
    data = data.toString(encoding || "utf8")

    // if anything was remaining
    if (remaining) {
      // prepend that to data
      data = remaining + data;
      remaining = "";
      // and call a write with it
      res._beforeTagDelimitedWrite(data);
      // and then actual end
      res._tagDelimitedEnd();
    }
    // otherwise
    else {
      // end with provided data
      res._tagDelimitedEnd(data, encoding);
    }
  };

};

// define function for check if buffer unclosed
var checkUnclosedTagAtEnd = function(chunk){
  // for example </div></div><scr chunk would
  // constitute as unclosed tag at the end
  // even consider <div></div><script sr
  // as unclosed tag at the end
  var ltIndex = chunk.lastIndexOf("<");
  var gtIndex = chunk.lastIndexOf(">");
  if ( ltIndex == -1 ) {
    // very rare but < not present
    return false;
  }
  else if ( gtIndex > ltIndex ) {
    // < before > at the end so everything valid
    return false;
  }
  else { // ltIndex > gtIndex
    // return two parts in array
    // first till < excluding
    // and remaining
    return divideString(chunk, ltIndex)
  }
}

exports.checkUnclosedTagAtEnd = checkUnclosedTagAtEnd;

// some more supporting functions for string processing
var divideString = function(str, index) {
  // when not given index or given negative one treat it as 0
  if ( !index || index < 0 ) { index = 0; }
  return [str.slice(0, index), str.slice(index)];
};

function replaceAll(find, replace, str) {
  return str.replace(new RegExp(find, 'g'), replace);
}