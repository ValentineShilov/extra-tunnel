'use strict';
const url = require('url');
const net = require('net');

// global variables
const E = process.env;
const USERAGENT_SERVER = 'nodef/rhost/server';
const USERAGENT_CLIENT = 'nodef/rhost/client';

function reqParse(buf) {
  // 1. get method, url, version from top
  const str = buf.toString(), lin = str.split('\r\n');
  const top = lin[0].split(' '), method = top[0], url = top[1];
  const httpVersion = +top[2].substring(top[2].indexOf('/')+1);
  // 2. get headers as lowercase
  for(var h=1, H=lin.length, headers={}; h<H && lin[h]; h++) {
    var i = lin[h].indexOf(': ');
    var key = lin[h].substring(0, i).toLowerCase();
    headers[key] = lin[h].substring(i+2);
  }
  // 3. get byte length
  const buffer = buf, end = str.indexOf('\r\n\r\n')+4;
  const length = Buffer.byteLength(str.substring(0, end));
  return {method, url, httpVersion, headers, length, buffer};
};


function Proxy(px, opt) {
  // 1. setup defaults
  px = px||'Proxy';
  opt = opt||{};
  opt.port = opt.port||80;
  opt.channels = opt.channels||{};
  opt.channels['/'] = opt.channels['/']||'';
  // 2. setup server
  const proxy = net.createServer();
  const channels = new Map();
  const clients = new Map();
  const sockets = new Map();
  proxy.listen(opt.port);
  var idn = 0;

  function socketClose(id) {
    // 1. is socket closed?
    const soc = sockets.get(id);
    if(!soc) return false;
    // 2. remove and close
    console.log(`${px}:${id} closed`);
    sockets.delete(id);
    soc.destroy();
    return true;
  };

  // 3. bad things happen, so just quit
  proxy.on('error', (err) => {
    console.error(`${px} error:`, err);
    proxy.close();
  });
  // 4. everyone brings their death with birth
  proxy.on('close', () => {
    console.log(`${px} closed`);
    for(var id of sockets.keys())
      socketClose(id);
  });
  // 4. a new begining, a new noob
  proxy.on('connection', (soc) => {
    const id = idn++;
    sockets.set(id, soc);
    console.log(`${px}:${id} connected`);
    // a. unexpected?, complain as always
    soc.on('error', (err) => console.error(`${px}:${id} error:`, err));
    soc.on('close', () => socketClose(id));
    // b. got something, play throw catch
    soc.on('data', (buf) => {
      const req = reqParse(buf);
      console.log(req);
      const usr = req.headers['user-agent'];
      if(req.method==='CONNECT') onMethod(id, req);
      else if(req.url.includes('://')) onMethod(id, req);
      else if(usr===USERAGENT_SERVER) onServer(id, req);
      else if(usr===USERAGENT_CLIENT) onClient(id, req);
      else onSocket(id, req);
    });
  });
};


if(require.main===module) {
  new Proxy('Proxy', {'port': E.PORT});
}
