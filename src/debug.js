HOST = "localhost";
PORT = 4000;

var http = require("http");

http.createServer(function(req, res){
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

}).listen(PORT);

console.log("Server at http://" + HOST + ':' + PORT.toString() + '/');