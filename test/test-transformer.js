require("should");
var transformer = require("../src/transformer");
var httpMocks = require('node-mocks-http');

describe("transformer", function(){
  describe("checkUnclosedTagAtEnd", function(){
    it("should divide html into two parts if unclosed tag at end", function(){
      var o = transformer.checkUnclosedTagAtEnd("something<div");
      o.should.not.be.empty;
      o.should.eql(["something", "<div"]);

      var o = transformer.checkUnclosedTagAtEnd("something<div attr=");
      o.should.not.be.empty;
      o.should.eql(["something", "<div attr="]);
    });

    it("should not touch HTML without any opening <", function(){
      var o = transformer.checkUnclosedTagAtEnd("anything");
      o.should.be.false;

      var o = transformer.checkUnclosedTagAtEnd("anything>");
      o.should.be.false;
    });

    it("should not touch HTML with valid open tag at end", function(){
      var o = transformer.checkUnclosedTagAtEnd("anything<div>");
      o.should.be.false;

      var o = transformer.checkUnclosedTagAtEnd("anything<div>something");
      o.should.be.false;
    });
  });

  it("should chunk streaming HTML across valid tag boundaries", function(){

    var res = httpMocks.createResponse();

    var chunks = [
      "<div></div>",
      "<script type='text/javascript'></script>"
    ];

    var currentChunk = 0;

    res.write = function(data, encoding){
      transformer.checkUnclosedTagAtEnd(data).should.be.false;
      data.should.eql(chunks[currentChunk]);
      currentChunk+=1;
    };

    transformer.apply(res);

    res.write("<div></div><script ");
    res.write("type='text/javascript'></script>");

    currentChunk.should.eql(2);
  });

  it("should chunk streaming HTML across valid tag boundaries and with res.end", function(){

    var res = httpMocks.createResponse();

    var chunks = [
      "<div></div>",
      "<script type='text/javascript'></script>"
    ];

    var currentChunk = 0;

    res.write = function(data, encoding){
      transformer.checkUnclosedTagAtEnd(data).should.be.false;
      data.should.eql(chunks[currentChunk]);
      currentChunk+=1;
    };

    transformer.apply(res);

    res.write("<div></div><script ");
    res.end("type='text/javascript'></script>");

    currentChunk.should.eql(2);
  });

  it("should not remove comments", function(){
    var res = httpMocks.createResponse();

    var output = "";
    res.write = function(data, encoding){
      data = data.toString(encoding||'utf8')
      output+=data;
    };

    transformer.apply(res);

    res.write("<!--[if lt IE 9]> <script src=\"//html5shiv.googlecode.com/svn/trunk/html5.js\" type=\"text/javascript\"></script><![endif]-->");
  });

  it("should neutralize iframe busting code in github", function(){
    var output = transformer.transform('function(){navigator.userAgent.match("Propane")||top!=window&&(alert("For security reasons, framing is not allowed."),top.location.replace(document.location))}');
    output.should.eql('function(){navigator.userAgent.match("Propane")||window!=window&&(alert("For security reasons, framing is not allowed."),top.proxy_location.replace(document.proxy_location))}');
  });
});