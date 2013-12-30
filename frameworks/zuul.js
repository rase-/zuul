var load = require('load-script');
var stacktrace = require('stacktrace-js');
var ajax = require('superagent');

global.JSON = global.JSON || require('JSON2');

try {
    var stack_mapper = require('stack-mapper');
} catch (err) {};

var ZuulReporter = function(run_fn) {
    if (!(this instanceof ZuulReporter)) {
        return new ZuulReporter(run_fn);
    }

    var self = this;
    self.run_fn = run_fn;
    self._fail_count = 0;

    var main_div = document.querySelector('#zuul');

    var header = document.createElement('div');
    header.className = 'heading';
    header.innerHTML = zuul.title;
    main_div.appendChild(header);

    var sub = document.createElement('div');
    sub.className = 'sub-heading';
    sub.innerHTML = navigator.userAgent;
    main_div.appendChild(sub);

    // status info
    var status = document.createElement('div');

    self._current_container = document.body.appendChild(main_div);

    self._mapper = undefined;

    // load test bundle and trigger tests to start
    // this is a problem for auto starting tests like tape
    // we need map file first
    // load map file first then test bundle
    load('/__zuul/test-bundle.js', load_map);

    function load_map(err) {
        if (err) {
            self.done(err);
        }

        if (!stack_mapper) {
            return self.start();
        }

        var map_path = '/__zuul/test-bundle.map.json';
        ajax.get(map_path).end(function(err, res) {
            if (err) {
                // ignore map load error
                return self.start();
            }

            try {
                mapper = stack_mapper(res.body);
            } catch (err) {}

            self.start();
        });
    }
};

// tests are starting
ZuulReporter.prototype.start = function() {
    var self = this;
    self.run_fn();
};

// all tests done
ZuulReporter.prototype.done = function(err) {
    var self = this;
    window.zuul_results = {
        passed: self._fail_count === 0,
        failures: self._fail_count
    };
};

// new test starting
ZuulReporter.prototype.test = function(test) {
    var self = this;

    var container = document.createElement('div');
    container.className = 'test pending';

    var header = container.appendChild(document.createElement('h1'));
    header.innerHTML = test.name;

    self._current_container = self._current_container.appendChild(container);
};

// test ended
ZuulReporter.prototype.test_end = function(test) {
    var self = this;
    var name = test.name;

    var cls = test.passed ? 'passed' : 'failed';

    // current test element
    self._current_container.className += ' ' + cls;
    self._current_container = self._current_container.parentElement;
};

// new suite starting
ZuulReporter.prototype.suite = function(suite) {
    var self = this;
};

// suite ended
ZuulReporter.prototype.suite_end = function(suite) {
    var self = this;
};

// assertion within test
ZuulReporter.prototype.assertion = function(details) {
    var self = this;
    // result (true | false)
    // actual
    // expected
    // message
    // error
    // source (stack) if available

    var passed = details.result;

    if (passed) {
        return;
    }

    self._fail_count++;

    var message = details.message;
    var error = details.error;
    var stack = details.source;

    if (!stack && error) {
        // rethrow to try and get the stack
        // IE needs this (of course)
        try {
            throw error;
        } catch (ex) {
            error = ex;
            stack = error.stack;
        }
    }

    try {
        var frames = stacktrace(error);
    } catch (err) {
        var pre = document.createElement('pre');
        pre.innerHTML = stack || message || error.toString();
        self._current_container.appendChild(pre);
        return;
    }

    if (mapper && frames.length) {
        var include_source = false;
        var mapped = mapper.map(frames, include_source);

        // create a v8 style stacktrace with new mappings
        var str = error.toString();
        for (var i = 0; i <mapped.length; ++i) {
            var frame = mapped[i];
            str += '\n\tat ';
            str += frame.func + ' (' + frame.filename + ':' + frame.line + ':';
            str += (frame.column || 0) + ')';
        }
    }

    var pre = document.createElement('pre');
    pre.innerHTML = str;
    self._current_container.appendChild(pre);
};

module.exports = ZuulReporter;
