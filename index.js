require("dotenv").config();

var http = require("http"),
  httpProxy = require("http-proxy"),
  pino = require("pino");

var prettyPrint = false;

if (process.env.LOG_AS_TEXT !== "false") {
  prettyPrint = true;
}
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  prettyPrint: prettyPrint,
});
//
// Create a proxy server with custom application logic
//
var proxy = httpProxy.createProxyServer({
  secure: false,
});
var proxySessions = {};
var config = {
  target: process.env.TARGET_URL || "http://127.0.0.1:4004",
  proxyport: process.env.PORT || 5050,
  testserverport: 4004,
  timeout: process.env.TIMEOUT || 1500, // 25 Minutes
};
// To modify the proxy connection before data is sent, you can listen
// for the 'proxyReq' event. When the event is fired, you will receive
// the following arguments:
// (http.ClientRequest proxyReq, http.IncomingMessage req,
//  http.ServerResponse res, Object options). This mechanism is useful when
// you need to modify the proxy request before the proxy connection
// is made to the target.
//
proxy.on("proxyReq", function (proxyReq, req, res, options) {
  if (proxySessions[req.headers.authorization]) {
    // Check if timeout was reached
    if (
      new Date().getTime() - config.timeout * 1000 >
      proxySessions[req.headers.authorization].started
    ) {
      // delete the cookies and start a new timeout
      logger.info("Reset current session");
      logger.debug("Content of the sessions variable for this authorization:");
      logger.debug(proxySessions[req.headers.authorization]);
      proxySessions[req.headers.authorization] = {
        cookies: [],
        started: new Date().getTime(),
      };
    } else {
      // use the existing cookies
      if (proxySessions[req.headers.authorization].cookies) {
        logger.debug("Cookies sent in this request:");
        logger.debug(proxySessions[req.headers.authorization].cookies);
        // Prepare the cookies to be sent in the request
        var cookie = "";
        for (
          let index = 0;
          index < proxySessions[req.headers.authorization].cookies.length;
          index++
        ) {
          if (cookie !== "") {
            cookie += "; ";
          }
          cookie += proxySessions[req.headers.authorization].cookies[index];
        }
        proxyReq.setHeader("cookie", cookie);
        delete req.headers["cookie"];
      }
    }
  } else {
    // No session exists
    proxySessions[req.headers.authorization] = {
      cookies: [],
      started: new Date().getTime(),
    };
    logger.debug("Creating new session for this authorization");
    logger.debug(proxySessions[req.headers.authorization]);
  }
});

proxy.on("proxyRes", function (proxyRes, req, res) {
  if (proxyRes.headers["set-cookie"] && proxyRes.headers["set-cookie"][0]) {
    proxySessions[req.headers.authorization].cookies =
      proxyRes.headers["set-cookie"];
    logger.debug("Received Cookie:");
    logger.debug(proxySessions[req.headers.authorization].cookies);
  }
  logger.debug("RAW Response from the target:");
  logger.debug(JSON.stringify(proxyRes.headers, true, 2));
});

var server = http.createServer(function (req, res) {
  if (!req.headers.authorization) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.write("You must provide an authentication header");
    res.end();
  } else {
    if (process.env.LOG_LEVEL === "debug") {
      logger.debug("proxy - decoded authorization header:");
      decodeBasicAuth(req);
    }
    proxy.web(req, res, {
      target: config.target,
    });
  }
});
logger.info(`proxy listening on port     : ${config.proxyport}`);
server.listen(config.proxyport);
logger.info(`session timeout             : ${config.timeout}`);
logger.info(`target url                  : ${config.target}`);

//
// Create your target server
//
if (process.env.START_TESTSERVER) {
  var serverSessions = {};
  var credentials = {};
  var header = {
    "Content-Type": "text/plain",
  };
  http
    .createServer(function (req, res) {
      if (req.headers.authorization) {
        logger.debug("testserver - decoded authorization header:");
        credentials = decodeBasicAuth(req);
        if (req.headers.authorization) {
          if (
            !serverSessions[req.headers.authorization] ||
            new Date().getTime() - config.timeout * 1000 >
              serverSessions[req.headers.authorization].started
          ) {
            // start a new timeout
            serverSessions[req.headers.authorization] = {
              started: new Date().getTime(),
            };
          }
          header["Set-Cookie"] =
            "mycookie=" + serverSessions[req.headers.authorization].started;
        }
      }
      res.writeHead(200, header);
      res.write(
        "request successfully proxied to: " +
          req.url +
          "\n" +
          JSON.stringify(req.headers, true, 2)
      );
      res.end();
    })
    .listen(config.testserverport);
  logger.info(`testserver listening on port: ${config.testserverport}`);
}

function decodeBasicAuth(req) {
  if (process.env.LOG_LEVEL === "debug") {
    var tmp = req.headers.authorization.split(" "); // Split on a space, the original auth looks like  "Basic Y2hhcmxlczoxMjM0NQ==" and we need the 2nd part

    var buf = new Buffer.from(tmp[1], "base64"); // create a buffer and tell it the data coming in is base64
    var plain_auth = buf.toString(); // read it back out as a string
    var credentialsArray = plain_auth.split(":");
    var credentials = {
      username: credentialsArray[0],
      password: credentialsArray[1],
    };
    logger.debug(plain_auth);
    logger.debug(credentials);
    return credentials;
  }
}
