require('dotenv').config();

var http = require('http'),
    httpProxy = require('http-proxy');
 
//
// Create a proxy server with custom application logic
//
var proxy = httpProxy.createProxyServer({
  secure: false
});
var sessions = {};
var config = {
  target: process.env.TARGET_URL || 'http://127.0.0.1:4004',
  proxyport: process.env.PORT || 5050,
  testserverport: 4004,
  timeout: process.env.TIMEOUT || 1500 // 25 Minutes
}
// To modify the proxy connection before data is sent, you can listen
// for the 'proxyReq' event. When the event is fired, you will receive
// the following arguments:
// (http.ClientRequest proxyReq, http.IncomingMessage req,
//  http.ServerResponse res, Object options). This mechanism is useful when
// you need to modify the proxy request before the proxy connection
// is made to the target.
//
proxy.on('proxyReq', function(proxyReq, req, res, options) {
  if(sessions[req.headers.authorization]) {
    // Check if timeout was reached
    if(new Date().getTime() - config.timeout * 1000 > sessions[req.headers.authorization].started) {
      // delete the cookie and start a new timeout
      console.log("Reset current session");
      // console.log(sessions[req.headers.authorization]);
      sessions[req.headers.authorization] = {
        cookie: "",
        started: new Date().getTime()
      }
    } else {
      // use the existing cookie
      if(sessions[req.headers.authorization].cookie) {
        proxyReq.setHeader('cookie', sessions[req.headers.authorization].cookie);
        delete req.headers['cookie'];
      }
    }
  } else {
    // No session exists
    sessions[req.headers.authorization] = {
      cookie: "",
      started: new Date().getTime()
    };
    // console.log(sessions[req.headers.authorization]);
  }
  // console.log(req.headers.authorization);
});

proxy.on('proxyRes', function(proxyRes, req, res) {
  if(proxyRes.headers['set-cookie'] && proxyRes.headers['set-cookie'][0]) {
    sessions[req.headers.authorization].cookie = proxyRes.headers['set-cookie'][0];
  }
  // console.log('RAW Response from the target', JSON.stringify(proxyRes.headers, true, 2));
});
 
var server = http.createServer(function(req, res) {
  if(!req.headers.authorization) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.write('You must provide an authentication header');
    res.end();
  } else {
    proxy.web(req, res, {
      target: config.target
    });  
  }
});
console.log(`proxy listening on port     : ${config.proxyport}`)
server.listen(config.proxyport);
console.log(`session timeout             : ${config.timeout}`)
console.log(`target url                  : ${config.target}`)

//
// Create your target server
//
if(process.env.START_TESTSERVER) {
  
  http.createServer(function (req, res) {
    res.writeHead(200, 
      { 
        'Content-Type': 'text/plain',
        'Set-Cookie': 'mycookie=' + new Date()
      }
    );
    res.write('request successfully proxied to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
    res.end();
  }).listen(config.testserverport);
  console.log(`testserver listening on port: ${config.testserverport}`)
}
