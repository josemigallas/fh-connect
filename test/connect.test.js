
/**
 * Module dependencies.
 */

var connect = require('../')
  , exec = require('child_process').exec
  , should = require('should')
  , assert = require('assert')
  , https = require('https')
  , http = require('http')
  , fs = require('fs');

module.exports = {
  'test version': function(){
    connect.version.should.match(/^\d+\.\d+\.\d+$/);
  },
  
  'test connect()': function(){
    var app = connect(
      function(req, res){
        res.end('wahoo');
      }
    );

    assert.response(app,
      { url: '/' },
      { body: 'wahoo' });
  },

  'test use()': function(){
    var app = connect.createServer();

    app.use('/blog', function(req, res){
      res.end('blog');
    });

    var ret = app.use(
      function(req, res){
        res.end('default');
      }
    );

    ret.should.equal(app);

    assert.response(app,
      { url: '/' },
      { body: 'default', status: 200 });

    assert.response(app,
      { url: '/blog' },
      { body: 'blog', status: 200 });
  },

  'test "header" event': function(){
    var app = connect.createServer();

    app.use(function(req, res, next){
      res.on('header', function(){
        if (req.headers['x-foo']) {
          res.setHeader('X-Bar', 'baz');
        }
      });

      next();
    });

    app.use(function(req, res){
      // FIXME: this fails if you do not have any res._headers
      res.setHeader('Content-Length', 5);
      res.end('hello');
    });

    assert.response(app,
      { url: '/' },
      function(res){
        res.headers.should.not.have.property('x-foo');
        res.headers.should.not.have.property('x-bar');
      });

    assert.response(app,
      { url: '/', headers: { 'X-Foo': 'bar' }},
      { body: 'hello', headers: { 'X-Bar': 'baz' }});
  },

  'test path matching': function(){
    var n = 0
      , app = connect.createServer();

    app.use('/hello/world', function(req, res, next){
      if (~req.url.indexOf('/images')) {
        req.url.should.equal('/images/foo.png?with=query&string');
      } else if (~req.url.indexOf('/and')) {
        req.originalUrl.should.equal('/hello/world/and/more/segments');
        req.url.should.equal('/and/more/segments');
      }

      res.end('hello world');
    });

    app.use('/hello', function(req, res, next){
      res.end('hello');
    });

    var foo = connect(function(req, res, next){
      res.end(foo.route);
    });

    app.use('/foo', foo);

    assert.response(app,
      { url: '/foo' },
      { body: '/foo' });

    assert.response(app,
      { url: '/hello' },
      { body: 'hello' });
    
    assert.response(app,
      { url: '/hello/' },
      { body: 'hello' });

    assert.response(app,
      { url: '/hello/world' },
      { body: 'hello world' });

    assert.response(app,
      { url: '/hello/world/' },
      { body: 'hello world' });

    assert.response(app,
      { url: '/hello/world/and/more/segments' },
      { body: 'hello world' });

    assert.response(app,
      { url: '/hello/world/images/foo.png?with=query&string' },
      { body: 'hello world' });
  },
  
  'test unmatched path': function(){
    var app = connect.createServer();

    assert.response(app,
      { url: '/' },
      { body: 'Cannot GET /', status: 404 });

    assert.response(app,
      { url: '/foo', method: 'POST' },
      { body: 'Cannot POST /foo', status: 404 });
  },
  
  'test error handling': function(){
    var calls = 0;
    var app = connect.createServer(
      function(req, res, next){
        // Pass error
        next(new Error('lame'));
      },
      function(err, req, res, next){
        ++calls;
        err.should.be.an.instanceof(Error);
        req.should.be.a('object');
        res.should.be.a('object');
        next.should.be.a('function');
        req.body = err.message;
        next(err);
      },
      function(err, req, res, next){
        ++calls;
        err.should.be.an.instanceof(Error);
        req.should.be.a('object');
        res.should.be.a('object');
        next.should.be.a('function');
        // Recover exceptional state
        next();
      },
      function(req, res, next){
        res.end(req.body);
      },
      connect.errorHandler()
    );

    assert.response(app,
      { url: '/' },
      { body: 'lame', status: 200 },
      function(){
        calls.should.equal(2);
      });
  },
  
  'test catch error': function(){
    var app = connect.createServer(
      function(req, res, next){
        doesNotExist();
      }
    );

    assert.response(app,
      { url: '/' },
      { status: 500 });
  },
  
  'test mounting': function(){
    var app = connect.createServer();

    app.use('/', function(req, res){
      // TODO: should inherit parent's /hello
      // to become /hello/world/view
      app.route.should.equal('/world/view');
      res.end('viewing hello world');
    });

    var app1 = connect.createServer();
    app1.use('/world/view', app);
    app1.use('/world', function(req, res){
      app1.route.should.equal('/hello');
      res.end('hello world');
    });

    var app2 = connect.createServer();
    app2.use('/hello', app1);
    app2.use('/hello', function(req, res){
      app2.route.should.equal('/');
      res.end('hello');
    });

    assert.response(app2,
      { url: '/hello/world/view' },
      { body: 'viewing hello world' });

    assert.response(app2,
      { url: '/hello/world' },
      { body: 'hello world' });

    assert.response(app2,
      { url: '/hello' },
      { body: 'hello' });
  },
  
  'test mounting http.Server': function(){
    var app = connect.createServer()
      , world = http.createServer(function(req, res){
        res.end('world');
      });

    app.use('/hello/', world);

    assert.response(app,
      { url: '/hello' },
      { body: 'world' });
  },
  
  'test .charset': function(){
    var app = connect(function(req, res){
      res.charset = 'utf8';
      res.setHeader('Content-Type', 'text/html');
      res.end('test');
    });

    assert.response(app,
      { url: '/' },
      { headers: { 'Content-Type': 'text/html; charset=utf8' }});
  }
};