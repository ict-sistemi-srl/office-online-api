/*
 Leaflet 0.8-dev (7b90179), a JS library for interactive maps. http://leafletjs.com
 (c) 2010-2015 Vladimir Agafonkin, (c) 2010-2011 CloudMade
*/
(function (window, document, undefined) {
var L = {
	version: '0.8-dev'
};

function expose() {
	var oldL = window.L;

	L.noConflict = function () {
		window.L = oldL;
		return this;
	};

	window.L = L;
}

// define Leaflet for Node module pattern loaders, including Browserify
if (typeof module === 'object' && typeof module.exports === 'object') {
	module.exports = L;

// define Leaflet as an AMD module
} else if (typeof define === 'function' && define.amd) {
	define(L);
}

// define Leaflet as a global L variable, saving the original L to restore later if needed
if (typeof window !== 'undefined') {
	expose();
}


/*
 * L.Log contains methods for logging the activity
 */

L.Log = {
	log: function (msg, direction, tileCoords, time) {
		if (!time) {
			time = Date.now();
		}
		if (!this._logs) {
			this._logs = [];
		}
		msg = msg.replace(/(\r\n|\n|\r)/gm, ' ');
		this._logs.push({msg : msg, direction : direction,
			coords : tileCoords, time : time});
		//console.log(time + '-' + direction + ': ' + msg);
	},

	_getEntries: function () {
		this._logs.sort(function (a, b) {
			if (a.time < b.time) { return -1; }
			if (a.time > b.time) { return 1; }
			return 0;
		});
		var data = '';
		for (var i = 0; i < this._logs.length; i++) {
			data += this._logs[i].time + '.' + this._logs[i].direction + '.' +
					this._logs[i].msg + '.' + this._logs[i].coords;
			data += '\n';
		}
		return data;
	},

	print: function () {
		// console.log(this._getEntries());
	},

	save: function () {
		var blob = new Blob([this._getEntries()], {type: 'text/csv'}),
		    e = document.createEvent('MouseEvents'),
		    a = document.createElement('a');

		a.download = Date.now() + '.csv';
		a.href = window.URL.createObjectURL(blob);
		a.dataset.downloadurl =  ['text/csv', a.download, a.href].join(':');
		e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
		a.dispatchEvent(e);
	},

	clear: function () {
		this._logs = [];
	}
};

L.INCOMING = 'INCOMING';
L.OUTGOING = 'OUTGOING';


/*
 * L.Util contains various utility functions used throughout Leaflet code.
 */

L.Util = {
	// extend an object with properties of one or more other objects
	extend: function (dest) {
		var i, j, len, src;

		for (j = 1, len = arguments.length; j < len; j++) {
			src = arguments[j];
			for (i in src) {
				dest[i] = src[i];
			}
		}
		return dest;
	},

	// create an object from a given prototype
	create: Object.create || (function () {
		function F() {}
		return function (proto) {
			F.prototype = proto;
			return new F();
		};
	})(),

	// bind a function to be called with a given context
	bind: function (fn, obj) {
		var slice = Array.prototype.slice;

		if (fn.bind) {
			return fn.bind.apply(fn, slice.call(arguments, 1));
		}

		var args = slice.call(arguments, 2);

		return function () {
			return fn.apply(obj, args.length ? args.concat(slice.call(arguments)) : arguments);
		};
	},

	// return unique ID of an object
	stamp: function (obj) {
		/*eslint-disable */
		obj._leaflet_id = obj._leaflet_id || ++L.Util.lastId;
		return obj._leaflet_id;
		/*eslint-enable */
	},

	lastId: 0,

	// return a function that won't be called more often than the given interval
	throttle: function (fn, time, context) {
		var lock, args, wrapperFn, later;

		later = function () {
			// reset lock and call if queued
			lock = false;
			if (args) {
				wrapperFn.apply(context, args);
				args = false;
			}
		};

		wrapperFn = function () {
			if (lock) {
				// called too soon, queue to call later
				args = arguments;

			} else {
				// call and lock until later
				fn.apply(context, arguments);
				setTimeout(later, time);
				lock = true;
			}
		};

		return wrapperFn;
	},

	// wrap the given number to lie within a certain range (used for wrapping longitude)
	wrapNum: function (x, range, includeMax) {
		var max = range[1],
		    min = range[0],
		    d = max - min;
		return x === max && includeMax ? x : ((x - min) % d + d) % d + min;
	},

	// do nothing (used as a noop throughout the code)
	falseFn: function () { return false; },

	// round a given number to a given precision
	formatNum: function (num, digits) {
		var pow = Math.pow(10, digits || 5);
		return Math.round(num * pow) / pow;
	},

	// trim whitespace from both sides of a string
	trim: function (str) {
		return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
	},

	// split a string into words
	splitWords: function (str) {
		return L.Util.trim(str).split(/\s+/);
	},

	// set options to an object, inheriting parent's options as well
	setOptions: function (obj, options) {
		if (!obj.hasOwnProperty('options')) {
			obj.options = obj.options ? L.Util.create(obj.options) : {};
		}
		for (var i in options) {
			obj.options[i] = options[i];
		}
		return obj.options;
	},

	// make a URL with GET parameters out of a set of properties/values
	getParamString: function (obj, existingUrl, uppercase) {
		var params = [];
		for (var i in obj) {
			params.push(encodeURIComponent(uppercase ? i.toUpperCase() : i) + '=' + encodeURIComponent(obj[i]));
		}
		return ((!existingUrl || existingUrl.indexOf('?') === -1) ? '?' : '&') + params.join('&');
	},

	round: function(x, e) {
		if (!e) {
			return Math.round(x);
		}
		var f = 1.0/e;
		return Math.round(x * f) * e;
	},

	// super-simple templating facility, used for TileLayer URLs
	template: function (str, data) {
		return str.replace(L.Util.templateRe, function (str, key) {
			var value = data[key];

			if (value === undefined) {
				throw new Error('No value provided for variable ' + str);

			} else if (typeof value === 'function') {
				value = value(data);
			}
			return value;
		});
	},

	templateRe: /\{ *([\w_]+) *\}/g,

	isArray: Array.isArray || function (obj) {
		return (Object.prototype.toString.call(obj) === '[object Array]');
	},

	// minimal image URI, set to an image when disposing to flush memory
	emptyImageUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
};

(function () {
	// inspired by http://paulirish.com/2011/requestanimationframe-for-smart-animating/

	function getPrefixed(name) {
		return window['webkit' + name] || window['moz' + name] || window['ms' + name];
	}

	var lastTime = 0;

	// fallback for IE 7-8
	function timeoutDefer(fn) {
		var time = +new Date(),
		    timeToCall = Math.max(0, 16 - (time - lastTime));

		lastTime = time + timeToCall;
		return window.setTimeout(fn, timeToCall);
	}

	var requestFn = window.requestAnimationFrame || getPrefixed('RequestAnimationFrame') || timeoutDefer,
	    cancelFn = window.cancelAnimationFrame || getPrefixed('CancelAnimationFrame') ||
	               getPrefixed('CancelRequestAnimationFrame') || function (id) { window.clearTimeout(id); };


	L.Util.requestAnimFrame = function (fn, context, immediate) {
		if (immediate && requestFn === timeoutDefer) {
			fn.call(context);
		} else {
			return requestFn.call(window, L.bind(fn, context));
		}
	};

	L.Util.cancelAnimFrame = function (id) {
		if (id) {
			cancelFn.call(window, id);
		}
	};
})();

// shortcuts for most used utility functions
L.extend = L.Util.extend;
L.bind = L.Util.bind;
L.stamp = L.Util.stamp;
L.setOptions = L.Util.setOptions;
L.round = L.Util.round;


/*
 * L.LOUtil contains various LO related utility functions used throughout the code
 */

L.LOUtil = {
	// Based on core.git's colordata.hxx: COL_AUTHOR1_DARK...COL_AUTHOR9_DARK
	// consisting of arrays of RGB values
	// Maybe move the color logic to separate file when it becomes complex
	darkColors: [
		[198, 146, 0],
		[6,  70, 162],
		[87, 157,  28],
		[105,  43, 157],
		[197,   0,  11],
		[0, 128, 128],
		[140, 132,  0],
		[53,  85, 107],
		[209, 118,   0]
	],

	startSpinner: function (spinnerCanvas, spinnerSpeed) {
		var spinnerInterval;
		spinnerCanvas.width = 50;
		spinnerCanvas.height = 50;

		var context = spinnerCanvas.getContext('2d');
		context.lineWidth = 8;
		context.strokeStyle = 'grey';
		var x = spinnerCanvas.width / 2;
		var y = spinnerCanvas.height / 2;
		var radius = y - context.lineWidth / 2;
		spinnerInterval = setInterval(function() {
			context.clearRect(0, 0, x * 2, y * 2);
			// Move to center
			context.translate(x, y);
			context.rotate(spinnerSpeed * Math.PI / 180);
			context.translate(-x, -y);
			context.beginPath();
			context.arc(x, y, radius, 0, Math.PI * 1.3);
			context.stroke();
		}, 1);

		return spinnerInterval;
	},

	getViewIdColor: function(viewId) {
		var color = this.darkColors[(viewId + 1) % this.darkColors.length];
		return (color[2] | (color[1] << 8) | (color[0] << 16));
	},

	rgbToHex: function(color) {
		return '#' + ('000000' + color.toString(16)).slice(-6);
	},

	stringToPoint: function(point) {
		var numbers = point.match(/\d+/g);
		return L.point(parseInt(numbers[0]), parseInt(numbers[1]));
	},

	stringToBounds: function(bounds) {
		var numbers = bounds.match(/\d+/g);
		var topLeft = L.point(parseInt(numbers[0]), parseInt(numbers[1]));
		var bottomRight = topLeft.add(L.point(parseInt(numbers[2]), parseInt(numbers[3])));
		return L.bounds(topLeft, bottomRight);
	},

	stringToRectangles: function(strRect) {
		var matches = strRect.match(/\d+/g);
		var rectangles = [];
		if (matches !== null) {
			for (var itMatch = 0; itMatch < matches.length; itMatch += 4) {
				var topLeft = L.point(parseInt(matches[itMatch]), parseInt(matches[itMatch + 1]));
				var size = L.point(parseInt(matches[itMatch + 2]), parseInt(matches[itMatch + 3]));
				var topRight = topLeft.add(L.point(size.x, 0));
				var bottomLeft = topLeft.add(L.point(0, size.y));
				var bottomRight = topLeft.add(size);
				rectangles.push([bottomLeft, bottomRight, topLeft, topRight]);
			}
		}
		return rectangles;
	}
};


/*
 * L.Class powers the OOP facilities of the library.
 * Thanks to John Resig and Dean Edwards for inspiration!
 */

L.Class = function () {};

L.Class.extend = function (props) {

	// extended class with the new prototype
	var NewClass = function () {

		// call the constructor
		if (this.initialize) {
			this.initialize.apply(this, arguments);
		}

		// call all constructor hooks
		this.callInitHooks();
	};

	var parentProto = NewClass.__super__ = this.prototype;

	var proto = L.Util.create(parentProto);
	proto.constructor = NewClass;

	NewClass.prototype = proto;

	// inherit parent's statics
	for (var i in this) {
		if (this.hasOwnProperty(i) && i !== 'prototype') {
			NewClass[i] = this[i];
		}
	}

	// mix static properties into the class
	if (props.statics) {
		L.extend(NewClass, props.statics);
		delete props.statics;
	}

	// mix includes into the prototype
	if (props.includes) {
		L.Util.extend.apply(null, [proto].concat(props.includes));
		delete props.includes;
	}

	// merge options
	if (proto.options) {
		props.options = L.Util.extend(L.Util.create(proto.options), props.options);
	}

	// mix given properties into the prototype
	L.extend(proto, props);

	proto._initHooks = [];

	// add method for calling all hooks
	proto.callInitHooks = function () {

		if (this._initHooksCalled) { return; }

		if (parentProto.callInitHooks) {
			parentProto.callInitHooks.call(this);
		}

		this._initHooksCalled = true;

		for (var i = 0, len = proto._initHooks.length; i < len; i++) {
			proto._initHooks[i].call(this);
		}
	};

	return NewClass;
};


// method for adding properties to prototype
L.Class.include = function (props) {
	L.extend(this.prototype, props);
};

// merge new default options to the Class
L.Class.mergeOptions = function (options) {
	L.extend(this.prototype.options, options);
};

// add a constructor hook
L.Class.addInitHook = function (fn) { // (Function) || (String, args...)
	var args = Array.prototype.slice.call(arguments, 1);

	var init = typeof fn === 'function' ? fn : function () {
		this[fn].apply(this, args);
	};

	this.prototype._initHooks = this.prototype._initHooks || [];
	this.prototype._initHooks.push(init);
};


/*
 * L.Evented is a base class that Leaflet classes inherit from to handle custom events.
 */

L.Evented = L.Class.extend({

	on: function (types, fn, context) {

		// types can be a map of types/handlers
		if (typeof types === 'object') {
			for (var type in types) {
				// we don't process space-separated events here for performance;
				// it's a hot path since Layer uses the on(obj) syntax
				this._on(type, types[type], fn);
			}

		} else {
			// types can be a string of space-separated words
			types = L.Util.splitWords(types);

			for (var i = 0, len = types.length; i < len; i++) {
				this._on(types[i], fn, context);
			}
		}

		return this;
	},

	off: function (types, fn, context) {

		if (!types) {
			// clear all listeners if called without arguments
			delete this._events;

		} else if (typeof types === 'object') {
			for (var type in types) {
				this._off(type, types[type], fn);
			}

		} else {
			types = L.Util.splitWords(types);

			for (var i = 0, len = types.length; i < len; i++) {
				this._off(types[i], fn, context);
			}
		}

		return this;
	},

	// attach listener (without syntactic sugar now)
	_on: function (type, fn, context) {

		var events = this._events = this._events || {},
		    contextId = context && context !== this && L.stamp(context);

		if (contextId) {
			// store listeners with custom context in a separate hash (if it has an id);
			// gives a major performance boost when firing and removing events (e.g. on map object)

			var indexKey = type + '_idx',
			    indexLenKey = type + '_len',
			    typeIndex = events[indexKey] = events[indexKey] || {},
			    id = L.stamp(fn) + '_' + contextId;

			if (!typeIndex[id]) {
				typeIndex[id] = {fn: fn, ctx: context};

				// keep track of the number of keys in the index to quickly check if it's empty
				events[indexLenKey] = (events[indexLenKey] || 0) + 1;
			}

		} else {
			// individual layers mostly use "this" for context and don't fire listeners too often
			// so simple array makes the memory footprint better while not degrading performance

			events[type] = events[type] || [];
			events[type].push({fn: fn});
		}
	},

	_off: function (type, fn, context) {
		var events = this._events,
		    indexKey = type + '_idx',
		    indexLenKey = type + '_len';

		if (!events) { return; }

		if (!fn) {
			// clear all listeners for a type if function isn't specified
			delete events[type];
			delete events[indexKey];
			delete events[indexLenKey];
			return;
		}

		var contextId = context && context !== this && L.stamp(context),
		    listeners, i, len, listener, id;

		if (contextId) {
			id = L.stamp(fn) + '_' + contextId;
			listeners = events[indexKey];

			if (listeners && listeners[id]) {
				listener = listeners[id];
				delete listeners[id];
				events[indexLenKey]--;
			}

		} else {
			listeners = events[type];

			if (listeners) {
				for (i = 0, len = listeners.length; i < len; i++) {
					if (listeners[i].fn === fn) {
						listener = listeners[i];
						listeners.splice(i, 1);
						break;
					}
				}
			}
		}

		// set the removed listener to noop so that's not called if remove happens in fire
		if (listener) {
			listener.fn = L.Util.falseFn;
		}
	},

	fire: function (type, data, propagate) {
		if (!this.listens(type, propagate)) { return this; }

		var event = L.Util.extend({}, data, {type: type, target: this}),
		    events = this._events;

		if (events) {
			var typeIndex = events[type + '_idx'],
			    i, len, listeners, id;

			if (events[type]) {
				// make sure adding/removing listeners inside other listeners won't cause infinite loop
				listeners = events[type].slice();

				for (i = 0, len = listeners.length; i < len; i++) {
					listeners[i].fn.call(this, event);
				}
			}

			// fire event for the context-indexed listeners as well
			for (id in typeIndex) {
				typeIndex[id].fn.call(typeIndex[id].ctx, event);
			}
		}

		if (propagate) {
			// propagate the event to parents (set with addEventParent)
			this._propagateEvent(event);
		}

		return this;
	},

	listens: function (type, propagate) {
		var events = this._events;

		if (events && (events[type] || events[type + '_len'])) { return true; }

		if (propagate) {
			// also check parents for listeners if event propagates
			for (var id in this._eventParents) {
				if (this._eventParents[id].listens(type, propagate)) { return true; }
			}
		}
		return false;
	},

	once: function (types, fn, context) {

		if (typeof types === 'object') {
			for (var type in types) {
				this.once(type, types[type], fn);
			}
			return this;
		}

		var handler = L.bind(function () {
			this
			    .off(types, fn, context)
			    .off(types, handler, context);
		}, this);

		// add a listener that's executed once and removed after that
		return this
		    .on(types, fn, context)
		    .on(types, handler, context);
	},

	// adds a parent to propagate events to (when you fire with true as a 3rd argument)
	addEventParent: function (obj) {
		this._eventParents = this._eventParents || {};
		this._eventParents[L.stamp(obj)] = obj;
		return this;
	},

	removeEventParent: function (obj) {
		if (this._eventParents) {
			delete this._eventParents[L.stamp(obj)];
		}
		return this;
	},

	_propagateEvent: function (e) {
		for (var id in this._eventParents) {
			this._eventParents[id].fire(e.type, L.extend({layer: e.target}, e), true);
		}
	}
});

var proto = L.Evented.prototype;

// aliases; we should ditch those eventually
proto.addEventListener = proto.on;
proto.removeEventListener = proto.clearAllEventListeners = proto.off;
proto.addOneTimeEventListener = proto.once;
proto.fireEvent = proto.fire;
proto.hasEventListeners = proto.listens;

L.Mixin = {Events: proto};


/* -*- js-indent-level: 8 -*- */
/*
 * L.Socket contains methods for the communication with the server
 */

/* global _ vex $ errorMessages */
L.Socket = L.Class.extend({
	ProtocolVersionNumber: '0.1',
	ReconnectCount: 0,

	getParameterValue: function (s) {
		var i = s.indexOf('=');
		if (i === -1)
			return undefined;
		return s.substring(i+1);
	},

	initialize: function (map) {
		console.debug('socket.initialize:');
		this._map = map;
		try {
			if (map.options.permission) {
				map.options.docParams['permission'] = map.options.permission;
			}
			this.socket = new WebSocket(map.options.server + '/lool/' + encodeURIComponent(map.options.doc + '?' + $.param(map.options.docParams)) + '/ws');
			this.socket.onerror = L.bind(this._onSocketError, this);
			this.socket.onclose = L.bind(this._onSocketClose, this);
			this.socket.onopen = L.bind(this._onSocketOpen, this);
			this.socket.onmessage = L.bind(this._onMessage, this);
			this.socket.binaryType = 'arraybuffer';
		} catch (e) {
			this._map.fire('error', {msg: _('Oops, there is a problem connecting to LibreOffice Online : ' + e), cmd: 'socket', kind: 'failed', id: 3});
			return null;
		}

		if (map.options.docParams.access_token && parseInt(map.options.docParams.access_token_ttl)) {
			var tokenExpiryWarning = 900 * 1000; // Warn when 15 minutes remain
			clearTimeout(this._accessTokenExpireTimeout);
			this._accessTokenExpireTimeout = setTimeout(L.bind(this._sessionExpiredWarning, this),
			                                            parseInt(map.options.docParams.access_token_ttl) - Date.now() - tokenExpiryWarning);
		}
		this._msgQueue = [];
	},

	_sessionExpiredWarning: function() {
		clearTimeout(this._accessTokenExpireTimeout);
		var expirymsg = errorMessages.sessionexpiry;
		if (parseInt(this._map.options.docParams.access_token_ttl) - Date.now() <= 0) {
			expirymsg = errorMessages.sessionexpired;
		}
		var timerepr = $.timeago(parseInt(this._map.options.docParams.access_token_ttl)).replace(' ago', '');
		this._map.fire('warn', {msg: expirymsg.replace('%time', timerepr)});

		// If user still doesn't refresh the session, warn again periodically
		this._accessTokenExpireTimeout = setTimeout(L.bind(this._sessionExpiredWarning, this),
		                                            120 * 1000);
	},

	close: function () {
		this.socket.onerror = function () {};
		this.socket.onclose = function () {};
		this.socket.onmessage = function () {};
		this.socket.close();

		clearTimeout(this._accessTokenExpireTimeout);
	},

	connected: function() {
		return this.socket && this.socket.readyState === 1;
	},

	sendMessage: function (msg, coords) {
		if ((!msg.startsWith('useractive') && !msg.startsWith('userinactive') && !this._map._active) ||
		    this._map._fatal) {
			// Avoid communicating when we're inactive.
			return;
		}

		var socketState = this.socket.readyState;
		if (socketState === 2 || socketState === 3) {
			this.initialize(this._map);
		}

		if (socketState === 1) {
			this.socket.send(msg);
			// Only attempt to log text frames, not binary ones.
			if (typeof msg === 'string') {
				L.Log.log(msg, L.OUTGOING, coords);
				if (this._map._docLayer && this._map._docLayer._debug) {
					console.log2(+new Date() + ' %cOUTGOING%c: ' + msg.concat(' ').replace(' ', '%c '), 'background:#fbb;color:black', 'color:red', 'color:black');
				}
			}
		}
		else {
			// push message while trying to connect socket again.
			this._msgQueue.push({msg: msg, coords: coords});
		}
	},

	_doSend: function(msg, coords) {
		// Only attempt to log text frames, not binary ones.
		if (typeof msg === 'string') {
			L.Log.log(msg, L.OUTGOING, coords);
			if (this._map._docLayer && this._map._docLayer._debug) {
				console.log2(+new Date() + ' %cOUTGOING%c: ' + msg.concat(' ').replace(' ', '%c '), 'background:#fbb;color:black', 'color:red', 'color:black');
			}
		}

		this.socket.send(msg);
	},

	_onSocketOpen: function () {
		console.debug('_onSocketOpen:');
		this._map._serverRecycling = false;
		this._map._documentIdle = false;

		// Always send the protocol version number.
		// TODO: Move the version number somewhere sensible.
		this._doSend('loolclient ' + this.ProtocolVersionNumber);

		var msg = 'load url=' + encodeURIComponent(this._map.options.doc);
		if (this._map._docLayer) {
			this._reconnecting = true;
			// we are reconnecting after a lost connection
			msg += ' part=' + this._map.getCurrentPartNumber();
		}
		if (this._map.options.timestamp) {
			msg += ' timestamp=' + this._map.options.timestamp;
		}
		if (this._map._docPassword) {
			msg += ' password=' + this._map._docPassword;
		}
		if (String.locale) {
			msg += ' lang=' + String.locale;
		}
		if (this._map.options.renderingOptions) {
			var options = {
				'rendering': this._map.options.renderingOptions
			};
			msg += ' options=' + JSON.stringify(options);
		}
		this._doSend(msg);
		for (var i = 0; i < this._msgQueue.length; i++) {
			this._doSend(this._msgQueue[i].msg, this._msgQueue[i].coords);
		}
		this._msgQueue = [];

		this._map._activate();
	},

	_utf8ToString: function (data) {
		var strBytes = '';
		for (var it = 0; it < data.length; it++) {
			strBytes += String.fromCharCode(data[it]);
		}
		return strBytes;
	},

	_onMessage: function (e) {
		var imgBytes, index, textMsg;

		if (typeof (e.data) === 'string') {
			textMsg = e.data;
		}
		else if (typeof (e.data) === 'object') {
			imgBytes = new Uint8Array(e.data);
			index = 0;
			// search for the first newline which marks the end of the message
			while (index < imgBytes.length && imgBytes[index] !== 10) {
				index++;
			}
			textMsg = String.fromCharCode.apply(null, imgBytes.subarray(0, index));
		}

		if (this._map._docLayer && this._map._docLayer._debug) {
			console.log2(+new Date() + ' %cINCOMING%c: ' + textMsg.concat(' ').replace(' ', '%c '), 'background:#ddf;color:black', 'color:blue', 'color:black');
		}

		var command = this.parseServerCmd(textMsg);
		if (textMsg.startsWith('loolserver ')) {
			// This must be the first message, unless we reconnect.
			var loolwsdVersionObj = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
			var h = loolwsdVersionObj.Hash;
			if (parseInt(h,16).toString(16) === h.toLowerCase().replace(/^0+/, '')) {
				h = '<a target="_blank" href="https://hub.libreoffice.org/git-online/' + h + '">' + h + '</a>';
				$('#loolwsd-version').html(loolwsdVersionObj.Version + ' (git hash: ' + h + ')');
			}
			else {
				$('#loolwsd-version').text(loolwsdVersionObj.Version);
			}

			// TODO: For now we expect perfect match in protocol versions
			if (loolwsdVersionObj.Protocol !== this.ProtocolVersionNumber) {
				this._map.fire('error', {msg: _('Unsupported server version.')});
			}
		}
		else if (textMsg.startsWith('lokitversion ')) {
			var lokitVersionObj = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
			var h = lokitVersionObj.BuildId.substring(0, 7);
			if (parseInt(h,16).toString(16) === h.toLowerCase().replace(/^0+/, '')) {
				h = '<a target="_blank" href="https://hub.libreoffice.org/git-core/' + h + '">' + h + '</a>';
			}
			$('#lokit-version').html(lokitVersionObj.ProductName + ' ' +
			                         lokitVersionObj.ProductVersion + lokitVersionObj.ProductExtension.replace('.10.','-') +
			                         ' (git hash: ' + h + ')');
		}
		else if (textMsg.startsWith('perm:')) {
			var perm = textMsg.substring('perm:'.length);

			// This message is often received very early before doclayer is initialized
			// Change options.permission so that when docLayer is initialized, it
			// picks up the new value of permission rather than something else
			this._map.options.permission = 'readonly';
			// Lets also try to set the permission ourself since this can well be received
			// after doclayer is initialized. There's no harm to call this in any case.
			this._map.setPermission(perm);

			return;
		}
		else if (textMsg.startsWith('wopi: ')) {
			// Handle WOPI related messages
			var wopiInfo = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
			this._map.fire('wopiprops', wopiInfo);
			return;
		}
		else if (textMsg.startsWith('commandresult: ')) {
			var commandresult = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
			if (commandresult['command'] === 'savetostorage' && commandresult['success']) {
				// Close any open confirmation dialogs
				if (vex.dialogID > 0) {
					var id = vex.dialogID;
					vex.dialogID = -1;
					vex.close(id);
				}
			}
			return;
		}
		else if (textMsg.startsWith('close: ')) {
			textMsg = textMsg.substring('close: '.length);
			msg = '';

			// This is due to document owner terminating the session
			if (textMsg === 'ownertermination') {
				msg = _('Session terminated by document owner');
			}
			else if (textMsg === 'idle') {
				msg = _('Session was terminated due to idleness - please click to reload');
				this._map._documentIdle = true;
			}
			else if (textMsg === 'shuttingdown') {
				msg = _('Server is shutting down for maintenance (auto-saving)');
			}
			else if (textMsg === 'recycling') {
				msg = _('Server is recycling and will be available shortly');

				this._map._active = false;
				this._map._serverRecycling = true;

				// Prevent reconnecting the world at the same time.
				var min = 5000;
				var max = 10000;
				var timeoutMs = Math.floor(Math.random() * (max - min) + min);

				socket = this;
				map = this._map;
				vex.timer = setInterval(function() {
					if (socket.connected()) {
						// We're connected: cancel timer and dialog.
						clearTimeout(vex.timer);
						if (vex.dialogID > 0) {
							var id = vex.dialogID;
							vex.dialogID = -1;
							vex.close(id);
						}
						return;
					}

					try {
						socket.initialize(map);
					} catch (error) {
					}
				}, timeoutMs);
			}
			else if (textMsg.startsWith('documentconflict')) {
				var username = textMsg.substring('documentconflict '.length);
				msg = _('%user asked to refresh the document. Document will now refresh automatically.').replace('%user', username);

				if (this._map._docLayer) {
					this._map._docLayer.removeAllViews();
				}
				// Detach all the handlers from current socket, otherwise _onSocketClose tries to reconnect again
				// However, we want to reconnect manually here.
				this.close();

				// Reload the document
				this._map._active = false;
				map = this._map;
				vex.timer = setInterval(function() {
					try {
						// Activate and cancel timer and dialogs.
						map._activate();
					} catch (error) {
					}
				}, 3000);
			}

			// Close any open dialogs first.
			if (vex.dialogID > 0) {
				var id = vex.dialogID;
				vex.dialogID = -1;
				vex.close(id);
			}

			var options = $.extend({}, vex.defaultOptions, {
				contentCSS: {'background':'rgba(0, 0, 0, 0)',
				             'font-size': 'xx-large',
				             'color': '#fff',
				             'text-align': 'center'},
				content: msg
			});
			options.id = vex.globalID;
			vex.dialogID = options.id;
			vex.globalID += 1;
			options.$vex = $('<div>').addClass(vex.baseClassNames.vex).addClass(options.className).css(options.css).data({
				vex: options
			});
			options.$vexOverlay = $('<div>').addClass(vex.baseClassNames.overlay).addClass(options.overlayClassName).css(options.overlayCSS).data({
				vex: options
			});

			options.$vex.append(options.$vexOverlay);

			options.$vexContent = $('<div>').addClass(vex.baseClassNames.content).addClass(options.contentClassName).css(options.contentCSS).text(options.content).data({
				vex: options
			});
			options.$vex.append(options.$vexContent);

			if (textMsg === 'idle') {
				var map = this._map;
				options.$vex.bind('click.vex', function(e) {
					console.debug('idleness: reactivating');
					map._documentIdle = false;
					return map._activate();
				});
			}

			$(options.appendLocation).append(options.$vex);
			vex.setupBodyClassName(options.$vex);

			if (textMsg !== 'shuttingdown') {
				// Tell WOPI host about it which should handle this situation
				this._map.fire('postMessage', {msgId: 'Session_Closed'});
			}

			if (textMsg === 'ownertermination') {
				this._map.remove();
			}

			return;
		}
		else if (textMsg.startsWith('error:') && command.errorCmd === 'storage') {
			var storageError;
			if (command.errorKind === 'savediskfull') {
				storageError = errorMessages.storage.savediskfull;
			}
			else if (command.errorKind === 'savefailed') {
				storageError = errorMessages.storage.savefailed;
			}
			else if (command.errorKind === 'saveunauthorized') {
				storageError = errorMessages.storage.saveunauthorized;
			}
			else if (command.errorKind === 'loadfailed') {
				storageError = errorMessages.storage.loadfailed;
				// Since this is a document load failure, wsd will disconnect the socket anyway,
				// better we do it first so that another error message doesn't override this one
				// upon socket close.
				this._map.hideBusy();
				this.close();
			}
			else if (command.errorKind === 'documentconflict')
			{
				storageError = errorMessages.storage.documentconflict;

				// TODO: We really really need to factor this out duplicate dialog code logic everywhere
				// Close any open dialogs first.
				if (vex.dialogID > 0) {
					var id = vex.dialogID;
					vex.dialogID = -1;
					vex.close(id);
				}

				vex.dialog.confirm({
					message: _('Document has been changed in storage. Do you want to refresh the page to load the new document ? Cancelling will continue editing and overwrite.'),
					callback: L.bind(function(value) {
						if (value) {
							// They want to refresh the page and load document again for all
							this.sendMessage('closedocument');
						} else {
							// They want to overwrite
							this.sendMessage('savetostorage force=1');
						}
					}, this)
				});
				vex.dialogID = vex.globalID - 1;

				return;
			}

			// Parse the storage url as link
			var tmpLink = document.createElement('a');
			tmpLink.href = this._map.options.doc;
			// Insert the storage server address to be more friendly
			storageError = storageError.replace('%storageserver', tmpLink.host);
			this._map.fire('warn', {msg: storageError});

			return;
		}
		else if (textMsg.startsWith('error:') && command.errorCmd === 'internal') {
			this._map._fatal = true;
			if (command.errorKind === 'diskfull') {
				this._map.fire('error', {msg: errorMessages.diskfull});
			}
			else if (command.errorKind === 'unauthorized') {
				this._map.hideBusy();
				this._map.fire('error', {msg: errorMessages.unauthorized});
			}

			if (this._map._docLayer) {
				this._map._docLayer.removeAllViews();
			}
			this.close();

			return;
		}
		else if (textMsg.startsWith('error:') && command.errorCmd === 'load') {
			this.close();

			var errorKind = command.errorKind;
			var passwordNeeded = false;
			if (errorKind.startsWith('passwordrequired')) {
				passwordNeeded = true;
				var msg = '';
				var passwordType = errorKind.split(':')[1];
				if (passwordType === 'to-view') {
					msg += _('Document requires password to view.');
				}
				else if (passwordType === 'to-modify') {
					msg += _('Document requires password to modify.');
					msg += ' ';
					msg += _('Hit Cancel to open in view-only mode.');
				}
			} else if (errorKind.startsWith('wrongpassword')) {
				passwordNeeded = true;
				msg = _('Wrong password provided. Please try again.');
			} else if (errorKind.startsWith('faileddocloading')) {
				this._map._fatal = true;
				this._map.fire('error', {msg: errorMessages.faileddocloading});
			} else if (errorKind.startsWith('docunloading')) {
				// The document is unloading. Have to wait a bit.
				this._map._active = false;

				if (this.ReconnectCount++ >= 10) {
					clearTimeout(vex.timer);
					return; // Give up.
				}

				map = this._map;
				vex.timer = setInterval(function() {
					try {
						// Activate and cancel timer and dialogs.
						map._activate();
					} catch (error) {
					}
				}, 1000);
			}

			if (passwordNeeded) {
				// Ask the user for password
				vex.dialog.open({
					message: msg,
					input: '<input name="password" type="password" required />',
					callback: L.bind(function(data) {
						if (data) {
							this._map._docPassword = data.password;
							this.initialize(this._map);
						} else if (passwordType === 'to-modify') {
							this._map._docPassword = '';
							this.initialize(this._map);
						} else {
							this._map.hideBusy();
						}
					}, this)
				});
				return;
			}
		}
		else if (textMsg.startsWith('error:') && !this._map._docLayer) {
			textMsg = textMsg.substring(6);
			if (command.errorKind === 'limitreached') {
				this._map._fatal = true;
				this._map._active = false; // Practically disconnected.

				// Servers configured for 50 documents are not demo/development.
				if (parseInt(command.params[0]) >= 50) {
					textMsg = errorMessages.limitreachedprod;
					textMsg = textMsg.replace(/%0/g, command.params[0]);
					textMsg = textMsg.replace(/%1/g, command.params[1]);
				}
				else {
					textMsg = errorMessages.limitreached;
					textMsg = textMsg.replace(/%0/g, command.params[0]);
					textMsg = textMsg.replace(/%1/g, command.params[1]);
					textMsg = textMsg.replace(/%2/g, (typeof brandProductName !== 'undefined' ? brandProductName : 'LibreOffice Online'));
					textMsg = textMsg.replace(/%3/g, (typeof brandProductFAQURL !== 'undefined' ? brandProductFAQURL : 'https://wiki.documentfoundation.org/Development/LibreOffice_Online'));
				}
			}
			else if (command.errorKind === 'serviceunavailable') {
				this._map._fatal = true;
				this._map._active = false; // Practically disconnected.
				textMsg = errorMessages.serviceunavailable;
			}
			this._map.fire('error', {msg: textMsg});
		}
		else if (textMsg.startsWith('pong ') && this._map._docLayer && this._map._docLayer._debug) {
			var times = this._map._docLayer._debugTimePING;
			var timeText = this._map._docLayer._debugSetTimes(times, +new Date() - this._map._docLayer._debugPINGQueue.shift());
			this._map._docLayer._debugData['ping'].setPrefix('Server ping time: ' + timeText +
					'. Rendered tiles: ' + command.rendercount +
					', last: ' + (command.rendercount - this._map._docLayer._debugRenderCount));
			this._map._docLayer._debugRenderCount = command.rendercount;
		}
		else if (textMsg.startsWith('statusindicator:')) {
			//FIXME: We should get statusindicator when saving too, no?
			this._map.showBusy(_('Connecting...'), false);
			if (textMsg.startsWith('statusindicator: ready')) {
				// We're connected: cancel timer and dialog.
				this.ReconnectCount = 0;
				clearTimeout(vex.timer);
				if (vex.dialogID > 0) {
					var id = vex.dialogID;
					vex.dialogID = -1;
					vex.close(id);
				}
			}
		}
		else if (!textMsg.startsWith('tile:') && !textMsg.startsWith('renderfont:')) {
			// log the tile msg separately as we need the tile coordinates
			L.Log.log(textMsg, L.INCOMING);
			if (imgBytes !== undefined) {
				try {
					// if it's not a tile, parse the whole message
					textMsg = String.fromCharCode.apply(null, imgBytes);
				} catch (error) {
					// big data string
					textMsg = this._utf8ToString(imgBytes);
				}
			}

			// Decode UTF-8 in case it is binary frame
			if (typeof e.data === 'object') {
				textMsg = decodeURIComponent(window.escape(textMsg));
			}
		}
		else {
			var data = imgBytes.subarray(index + 1);
			// read the tile data
			var strBytes = '';
			for (var i = 0; i < data.length; i++) {
				strBytes += String.fromCharCode(data[i]);
			}
			var img = 'data:image/png;base64,' + window.btoa(strBytes);
		}

		if (textMsg.startsWith('status:') && !this._map._docLayer) {
			// first status message, we need to create the document layer
			var tileWidthTwips = this._map.options.tileWidthTwips;
			var tileHeightTwips = this._map.options.tileHeightTwips;
			if (this._map.options.zoom !== this._map.options.defaultZoom) {
				var scale = this._map.options.crs.scale(this._map.options.defaultZoom - this._map.options.zoom);
				tileWidthTwips = Math.round(tileWidthTwips * scale);
				tileHeightTwips = Math.round(tileHeightTwips * scale);
			}

			var docLayer = null;
			if (command.type === 'text') {
				docLayer = new L.WriterTileLayer('', {
					permission: this._map.options.permission,
					tileWidthTwips: tileWidthTwips,
					tileHeightTwips: tileHeightTwips,
					docType: command.type
				});
			}
			else if (command.type === 'spreadsheet') {
				docLayer = new L.CalcTileLayer('', {
					permission: this._map.options.permission,
					tileWidthTwips: tileWidthTwips,
					tileHeightTwips: tileHeightTwips,
					docType: command.type
				});
			}
			else {
				if (command.type === 'presentation' &&
						this._map.options.defaultZoom === this._map.options.zoom) {
					// If we have a presentation document and the zoom level has not been set
					// in the options, resize the document so that it fits the viewing area
					var verticalTiles = this._map.getSize().y / 256;
					tileWidthTwips = Math.round(command.height / verticalTiles);
					tileHeightTwips = Math.round(command.height / verticalTiles);
				}
				docLayer = new L.ImpressTileLayer('', {
					permission: this._map.options.permission,
					tileWidthTwips: tileWidthTwips,
					tileHeightTwips: tileHeightTwips,
					docType: command.type
				});
			}

			this._map._docLayer = docLayer;
			this._map.addLayer(docLayer);
			this._map.fire('doclayerinit');
		} else if (textMsg.startsWith('status:') && this._reconnecting) {
			// we are reconnecting ...
			this._reconnecting = false;
			this._map._docLayer._onMessage('invalidatetiles: EMPTY', null);
			this._map.fire('statusindicator', {statusType: 'reconnected'});
			this._map.setPermission(this._map.options.permission);
		}

		// these can arrive very early during the startup
		if (textMsg.startsWith('statusindicatorstart:')) {
			this._map.fire('statusindicator', {statusType : 'start'});
			return;
		}
		else if (textMsg.startsWith('statusindicatorsetvalue:')) {
			var value = textMsg.match(/\d+/g)[0];
			this._map.fire('statusindicator', {statusType : 'setvalue', value : value});
			return;
		}
		else if (textMsg.startsWith('statusindicatorfinish:')) {
			this._map.fire('statusindicator', {statusType : 'finish'});
			this._map._fireInitComplete('statusindicatorfinish');
			return;
		}

		if (this._map._docLayer) {
			this._map._docLayer._onMessage(textMsg, img);
		}
	},

	_onSocketError: function () {
		console.debug('_onSocketError:');
		this._map.hideBusy();
		// Let onclose (_onSocketClose) report errors.
	},

	_onSocketClose: function (e) {
		console.debug('_onSocketClose:');
		var isActive = this._map._active;
		this._map.hideBusy();
		this._map._active = false;

		if (this._map._docLayer) {
			this._map._docLayer.removeAllViews();
		}

		if (isActive && this._reconnecting) {
			// Don't show this before first transparently trying to reconnect.
			this._map.fire('error', {msg: _('Well, this is embarrassing, we cannot connect to your document. Please try again.'), cmd: 'socket', kind: 'closed', id: 4});
		}

		// Reset wopi's app loaded so that reconnecting again informs outerframe about initialization again
		this._map['wopi'].resetAppLoaded();

		if (!this._reconnecting) {
			this._reconnecting = true;
			this._map._activate();
		}
	},

	parseServerCmd: function (msg) {
		var tokens = msg.split(/[ \n]+/);
		var command = {};
		for (var i = 0; i < tokens.length; i++) {
			if (tokens[i].substring(0, 9) === 'tileposx=') {
				command.x = parseInt(tokens[i].substring(9));
			}
			else if (tokens[i].substring(0, 9) === 'tileposy=') {
				command.y = parseInt(tokens[i].substring(9));
			}
			else if (tokens[i].substring(0, 2) === 'x=') {
				command.x = parseInt(tokens[i].substring(2));
			}
			else if (tokens[i].substring(0, 2) === 'y=') {
				command.y = parseInt(tokens[i].substring(2));
			}
			else if (tokens[i].substring(0, 10) === 'tilewidth=') {
				command.tileWidth = parseInt(tokens[i].substring(10));
			}
			else if (tokens[i].substring(0, 11) === 'tileheight=') {
				command.tileHeight = parseInt(tokens[i].substring(11));
			}
			else if (tokens[i].substring(0, 6) === 'width=') {
				command.width = parseInt(tokens[i].substring(6));
			}
			else if (tokens[i].substring(0, 7) === 'height=') {
				command.height = parseInt(tokens[i].substring(7));
			}
			else if (tokens[i].substring(0, 5) === 'part=') {
				command.part = parseInt(tokens[i].substring(5));
			}
			else if (tokens[i].substring(0, 6) === 'parts=') {
				command.parts = parseInt(tokens[i].substring(6));
			}
			else if (tokens[i].substring(0, 8) === 'current=') {
				command.selectedPart = parseInt(tokens[i].substring(8));
			}
			else if (tokens[i].substring(0, 3) === 'id=') {
				// remove newline characters
				command.id = tokens[i].substring(3).replace(/(\r\n|\n|\r)/gm, '');
			}
			else if (tokens[i].substring(0, 5) === 'type=') {
				// remove newline characters
				command.type = tokens[i].substring(5).replace(/(\r\n|\n|\r)/gm, '');
			}
			else if (tokens[i].substring(0, 4) === 'cmd=') {
				command.errorCmd = tokens[i].substring(4);
			}
			else if (tokens[i].substring(0, 5) === 'code=') {
				command.errorCode = tokens[i].substring(5);
			}
			else if (tokens[i].substring(0, 5) === 'kind=') {
				command.errorKind = tokens[i].substring(5);
			}
			else if (tokens[i].substring(0, 5) === 'jail=') {
				command.jail = tokens[i].substring(5);
			}
			else if (tokens[i].substring(0, 4) === 'dir=') {
				command.dir = tokens[i].substring(4);
			}
			else if (tokens[i].substring(0, 5) === 'name=') {
				command.name = tokens[i].substring(5);
			}
			else if (tokens[i].substring(0, 5) === 'port=') {
				command.port = tokens[i].substring(5);
			}
			else if (tokens[i].substring(0, 5) === 'font=') {
				command.font = tokens[i].substring(5);
			}
			else if (tokens[i].substring(0, 5) === 'char=') {
				command.char = tokens[i].substring(5);
			}
			else if (tokens[i].substring(0, 7) === 'viewid=') {
				command.viewid = tokens[i].substring(7);
			}
			else if (tokens[i].substring(0, 7) === 'params=') {
				command.params = tokens[i].substring(7).split(',');
			}
			else if (tokens[i].substring(0, 9) === 'renderid=') {
				command.renderid = tokens[i].substring(9);
			}
			else if (tokens[i].substring(0, 12) === 'rendercount=') {
				command.rendercount = parseInt(tokens[i].substring(12));
			}
			else if (tokens[i].startsWith('hash=')) {
				command.hash = this.getParameterValue(tokens[i]);
			}
		}
		if (command.tileWidth && command.tileHeight && this._map._docLayer) {
			var defaultZoom = this._map.options.zoom;
			var scale = command.tileWidth / this._map._docLayer.options.tileWidthTwips;
			// scale = 1.2 ^ (defaultZoom - zoom)
			// zoom = defaultZoom -log(scale) / log(1.2)
			command.zoom = Math.round(defaultZoom - Math.log(scale) / Math.log(1.2));
		}
		return command;
	}
});

L.socket = function (map) {
	return new L.Socket(map);
};


/*
 * @namespace Browser
 * @aka L.Browser
 *
 * A namespace with static properties for browser/feature detection used by Leaflet internally.
 *
 * @example
 *
 * ```js
 * if (L.Browser.ielt9) {
 *   alert('Upgrade your browser, dude!');
 * }
 * ```
 */

(function () {

	var ua = navigator.userAgent.toLowerCase(),
	    doc = document.documentElement,

	    ie = 'ActiveXObject' in window,

	    webkit    = ua.indexOf('webkit') !== -1,
	    phantomjs = ua.indexOf('phantom') !== -1,
	    android23 = ua.search('android [23]') !== -1,
	    chrome    = ua.indexOf('chrome') !== -1,
	    gecko     = ua.indexOf('gecko') !== -1  && !webkit && !window.opera && !ie,

	    win = navigator.platform.indexOf('Win') === 0,

	    mobile = typeof orientation !== 'undefined' || ua.indexOf('mobile') !== -1,
	    msPointer = !window.PointerEvent && window.MSPointerEvent,
	    pointer = (window.PointerEvent && navigator.pointerEnabled && navigator.maxTouchPoints) || msPointer,

	    ie3d = ie && ('transition' in doc.style),
	    webkit3d = ('WebKitCSSMatrix' in window) && ('m11' in new window.WebKitCSSMatrix()) && !android23,
	    gecko3d = 'MozPerspective' in doc.style,
	    opera12 = 'OTransition' in doc.style;


	var touch = !window.L_NO_TOUCH && (pointer || 'ontouchstart' in window ||
			(window.DocumentTouch && document instanceof window.DocumentTouch));

	L.Browser = {

		// @property ie: Boolean
		// `true` for all Internet Explorer versions (not Edge).
		ie: ie,

		// @property ielt9: Boolean
		// `true` for Internet Explorer versions less than 9.
		ielt9: ie && !document.addEventListener,

		// @property edge: Boolean
		// `true` for the Edge web browser.
		edge: 'msLaunchUri' in navigator && !('documentMode' in document),

		// @property webkit: Boolean
		// `true` for webkit-based browsers like Chrome and Safari (including mobile versions).
		webkit: webkit,

		// @property gecko: Boolean
		// `true` for gecko-based browsers like Firefox.
		gecko: gecko,

		// @property android: Boolean
		// `true` for any browser running on an Android platform.
		android: ua.indexOf('android') !== -1,

		// @property android23: Boolean
		// `true` for browsers running on Android 2 or Android 3.
		android23: android23,

		// @property chrome: Boolean
		// `true` for the Chrome browser.
		chrome: chrome,

		// @property safari: Boolean
		// `true` for the Safari browser.
		safari: !chrome && ua.indexOf('safari') !== -1,


		// @property win: Boolean
		// `true` when the browser is running in a Windows platform
		win: win,


		// @property ie3d: Boolean
		// `true` for all Internet Explorer versions supporting CSS transforms.
		ie3d: ie3d,

		// @property webkit3d: Boolean
		// `true` for webkit-based browsers supporting CSS transforms.
		webkit3d: webkit3d,

		// @property gecko3d: Boolean
		// `true` for gecko-based browsers supporting CSS transforms.
		gecko3d: gecko3d,

		// @property opera12: Boolean
		// `true` for the Opera browser supporting CSS transforms (version 12 or later).
		opera12: opera12,

		// @property any3d: Boolean
		// `true` for all browsers supporting CSS transforms.
		any3d: !window.L_DISABLE_3D && (ie3d || webkit3d || gecko3d) && !opera12 && !phantomjs,


		// @property mobile: Boolean
		// `true` for all browsers running in a mobile device.
		mobile: mobile,

		// @property mobileWebkit: Boolean
		// `true` for all webkit-based browsers in a mobile device.
		mobileWebkit: mobile && webkit,

		// @property mobileWebkit3d: Boolean
		// `true` for all webkit-based browsers in a mobile device supporting CSS transforms.
		mobileWebkit3d: mobile && webkit3d,

		// @property mobileOpera: Boolean
		// `true` for the Opera browser in a mobile device.
		mobileOpera: mobile && window.opera,

		// @property mobileGecko: Boolean
		// `true` for gecko-based browsers running in a mobile device.
		mobileGecko: mobile && gecko,


		// @property touch: Boolean
		// `true` for all browsers supporting [touch events](https://developer.mozilla.org/docs/Web/API/Touch_events).
		touch: !!touch,

		// @property msPointer: Boolean
		// `true` for browsers implementing the Microsoft touch events model (notably IE10).
		msPointer: !!msPointer,

		// @property pointer: Boolean
		// `true` for all browsers supporting [pointer events](https://msdn.microsoft.com/en-us/library/dn433244%28v=vs.85%29.aspx).
		pointer: !!pointer,


		// @property retina: Boolean
		// `true` for browsers on a high-resolution "retina" screen.
		retina: (window.devicePixelRatio || (window.screen.deviceXDPI / window.screen.logicalXDPI)) > 1
	};

}());


/*
 * L.Point represents a point with x and y coordinates.
 */

L.Point = function (x, y, round) {
	this.x = (round ? Math.round(x) : x);
	this.y = (round ? Math.round(y) : y);
};

L.Point.prototype = {

	clone: function () {
		return new L.Point(this.x, this.y);
	},

	// non-destructive, returns a new point
	add: function (point) {
		return this.clone()._add(L.point(point));
	},

	// destructive, used directly for performance in situations where it's safe to modify existing point
	_add: function (point) {
		this.x += point.x;
		this.y += point.y;
		return this;
	},

	subtract: function (point) {
		return this.clone()._subtract(L.point(point));
	},

	_subtract: function (point) {
		this.x -= point.x;
		this.y -= point.y;
		return this;
	},

	divideBy: function (num) {
		return this.clone()._divideBy(num);
	},

	_divideBy: function (num) {
		this.x /= num;
		this.y /= num;
		return this;
	},

	multiplyBy: function (num) {
		return this.clone()._multiplyBy(num);
	},

	_multiplyBy: function (num) {
		this.x *= num;
		this.y *= num;
		return this;
	},

	round: function () {
		return this.clone()._round();
	},

	_round: function () {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
	},

	floor: function () {
		return this.clone()._floor();
	},

	_floor: function () {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		return this;
	},

	ceil: function () {
		return this.clone()._ceil();
	},

	_ceil: function () {
		this.x = Math.ceil(this.x);
		this.y = Math.ceil(this.y);
		return this;
	},

	distanceTo: function (point) {
		point = L.point(point);

		var x = point.x - this.x,
		    y = point.y - this.y;

		return Math.sqrt(x * x + y * y);
	},

	equals: function (point) {
		point = L.point(point);

		return point.x === this.x &&
		       point.y === this.y;
	},

	contains: function (point) {
		point = L.point(point);

		return Math.abs(point.x) <= Math.abs(this.x) &&
		       Math.abs(point.y) <= Math.abs(this.y);
	},

	toString: function () {
		return 'Point(' +
		        L.Util.formatNum(this.x) + ', ' +
		        L.Util.formatNum(this.y) + ')';
	}
};

L.point = function (x, y, round) {
	if (x instanceof L.Point) {
		return x;
	}
	if (L.Util.isArray(x)) {
		return new L.Point(x[0], x[1]);
	}
	if (x === undefined || x === null) {
		return x;
	}
	return new L.Point(x, y, round);
};


/*
 * L.Bounds represents a rectangular area on the screen in pixel coordinates.
 */

L.Bounds = function (a, b) { //(Point, Point) or Point[]
	if (!a) { return; }

	var points = b ? [a, b] : a;

	for (var i = 0, len = points.length; i < len; i++) {
		this.extend(points[i]);
	}
};

L.Bounds.prototype = {
	// extend the bounds to contain the given point
	extend: function (point) { // (Point)
		point = L.point(point);

		if (!this.min && !this.max) {
			this.min = point.clone();
			this.max = point.clone();
		} else {
			this.min.x = Math.min(point.x, this.min.x);
			this.max.x = Math.max(point.x, this.max.x);
			this.min.y = Math.min(point.y, this.min.y);
			this.max.y = Math.max(point.y, this.max.y);
		}
		return this;
	},

	getCenter: function (round) { // (Boolean) -> Point
		return new L.Point(
		        (this.min.x + this.max.x) / 2,
		        (this.min.y + this.max.y) / 2, round);
	},

	getBottomLeft: function () { // -> Point
		return new L.Point(this.min.x, this.max.y);
	},

	getTopRight: function () { // -> Point
		return new L.Point(this.max.x, this.min.y);
	},

	getSize: function () {
		return this.max.subtract(this.min);
	},

	contains: function (obj) { // (Bounds) or (Point) -> Boolean
		var min, max;

		if (typeof obj[0] === 'number' || obj instanceof L.Point) {
			obj = L.point(obj);
		} else {
			obj = L.bounds(obj);
		}

		if (obj instanceof L.Bounds) {
			min = obj.min;
			max = obj.max;
		} else {
			min = max = obj;
		}

		return (min.x >= this.min.x) &&
		       (max.x <= this.max.x) &&
		       (min.y >= this.min.y) &&
		       (max.y <= this.max.y);
	},

	intersects: function (bounds) { // (Bounds) -> Boolean
		bounds = L.bounds(bounds);

		var min = this.min,
		    max = this.max,
		    min2 = bounds.min,
		    max2 = bounds.max,
		    xIntersects = (max2.x >= min.x) && (min2.x <= max.x),
		    yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

		return xIntersects && yIntersects;
	},

	isValid: function () {
		return !!(this.min && this.max);
	}
};

L.bounds = function (a, b) { // (Bounds) or (Point, Point) or (Point[])
	if (!a || a instanceof L.Bounds) {
		return a;
	}
	return new L.Bounds(a, b);
};


/*
 * L.Transformation is an utility class to perform simple point transformations through a 2d-matrix.
 */

L.Transformation = function (a, b, c, d) {
	this._a = a;
	this._b = b;
	this._c = c;
	this._d = d;
};

L.Transformation.prototype = {
	transform: function (point, scale) { // (Point, Number) -> Point
		return this._transform(point.clone(), scale);
	},

	// destructive transform (faster)
	_transform: function (point, scale) {
		scale = scale || 1;
		point.x = scale * (this._a * point.x + this._b);
		point.y = scale * (this._c * point.y + this._d);
		return point;
	},

	untransform: function (point, scale) {
		scale = scale || 1;
		return new L.Point(
		        (point.x / scale - this._b) / this._a,
		        (point.y / scale - this._d) / this._c);
	}
};


/*
 * L.DomUtil contains various utility functions for working with DOM.
 */

L.DomUtil = {
	get: function (id) {
		return typeof id === 'string' ? document.getElementById(id) : id;
	},

	getStyle: function (el, style) {

		var value = el.style[style] || (el.currentStyle && el.currentStyle[style]);

		if ((!value || value === 'auto') && document.defaultView) {
			var css = document.defaultView.getComputedStyle(el, null);
			value = css ? css[style] : null;
		}

		return value === 'auto' ? null : value;
	},

	setStyle: function (el, style, value) {
		el.style[style] = value;
	},

	create: function (tagName, className, container) {

		var el = document.createElement(tagName);
		el.className = className;

		if (container) {
			container.appendChild(el);
		}

		return el;
	},

	remove: function (el) {
		var parent = el.parentNode;
		if (parent) {
			parent.removeChild(el);
		}
	},

	empty: function (el) {
		while (el.firstChild) {
			el.removeChild(el.firstChild);
		}
	},

	toFront: function (el) {
		el.parentNode.appendChild(el);
	},

	toBack: function (el) {
		var parent = el.parentNode;
		parent.insertBefore(el, parent.firstChild);
	},

	hasClass: function (el, name) {
		if (el.classList !== undefined) {
			return el.classList.contains(name);
		}
		var className = L.DomUtil.getClass(el);
		return className.length > 0 && new RegExp('(^|\\s)' + name + '(\\s|$)').test(className);
	},

	addClass: function (el, name) {
		if (el.classList !== undefined) {
			var classes = L.Util.splitWords(name);
			for (var i = 0, len = classes.length; i < len; i++) {
				el.classList.add(classes[i]);
			}
		} else if (!L.DomUtil.hasClass(el, name)) {
			var className = L.DomUtil.getClass(el);
			L.DomUtil.setClass(el, (className ? className + ' ' : '') + name);
		}
	},

	removeClass: function (el, name) {
		if (el.classList !== undefined) {
			el.classList.remove(name);
		} else {
			L.DomUtil.setClass(el, L.Util.trim((' ' + L.DomUtil.getClass(el) + ' ').replace(' ' + name + ' ', ' ')));
		}
	},

	setClass: function (el, name) {
		if (el.className.baseVal === undefined) {
			el.className = name;
		} else {
			// in case of SVG element
			el.className.baseVal = name;
		}
	},

	getClass: function (el) {
		return el.className.baseVal === undefined ? el.className : el.className.baseVal;
	},

	setOpacity: function (el, value) {

		if ('opacity' in el.style) {
			el.style.opacity = value;

		} else if ('filter' in el.style) {
			L.DomUtil._setOpacityIE(el, value);
		}
	},

	_setOpacityIE: function (el, value) {
		var filter = false,
		    filterName = 'DXImageTransform.Microsoft.Alpha';

		// filters collection throws an error if we try to retrieve a filter that doesn't exist
		try {
			filter = el.filters.item(filterName);
		} catch (e) {
			// don't set opacity to 1 if we haven't already set an opacity,
			// it isn't needed and breaks transparent pngs.
			if (value === 1) { return; }
		}

		value = Math.round(value * 100);

		if (filter) {
			filter.Enabled = (value !== 100);
			filter.Opacity = value;
		} else {
			el.style.filter += ' progid:' + filterName + '(opacity=' + value + ')';
		}
	},

	testProp: function (props) {

		var style = document.documentElement.style;

		for (var i = 0; i < props.length; i++) {
			if (props[i] in style) {
				return props[i];
			}
		}
		return false;
	},

	setTransform: function (el, offset, scale) {
		var pos = offset || new L.Point(0, 0);

		el.style[L.DomUtil.TRANSFORM] =
			'translate3d(' + pos.x + 'px,' + pos.y + 'px' + ',0)' + (scale ? ' scale(' + scale + ')' : '');
	},

	setPosition: function (el, point, no3d) { // (HTMLElement, Point[, Boolean])

		/*eslint-disable */
		el._leaflet_pos = point;
		/*eslint-enable */

		if (L.Browser.any3d && !no3d) {
			L.DomUtil.setTransform(el, point);
		} else {
			el.style.left = point.x + 'px';
			el.style.top = point.y + 'px';
		}
	},

	getPosition: function (el) {
		// this method is only used for elements previously positioned using setPosition,
		// so it's safe to cache the position for performance

		return el._leaflet_pos;
	}
};


(function () {
	// prefix style property names

	L.DomUtil.TRANSFORM = L.DomUtil.testProp(
			['transform', 'WebkitTransform', 'OTransform', 'MozTransform', 'msTransform']);


	// webkitTransition comes first because some browser versions that drop vendor prefix don't do
	// the same for the transitionend event, in particular the Android 4.1 stock browser

	var transition = L.DomUtil.TRANSITION = L.DomUtil.testProp(
			['webkitTransition', 'transition', 'OTransition', 'MozTransition', 'msTransition']);

	L.DomUtil.TRANSITION_END =
			transition === 'webkitTransition' || transition === 'OTransition' ? transition + 'End' : 'transitionend';


	if ('onselectstart' in document) {
		L.DomUtil.disableTextSelection = function () {
			L.DomEvent.on(window, 'selectstart', L.DomEvent.preventDefault);
		};
		L.DomUtil.enableTextSelection = function () {
			L.DomEvent.off(window, 'selectstart', L.DomEvent.preventDefault);
		};

	} else {
		var userSelectProperty = L.DomUtil.testProp(
			['userSelect', 'WebkitUserSelect', 'OUserSelect', 'MozUserSelect', 'msUserSelect']);

		L.DomUtil.disableTextSelection = function () {
			if (userSelectProperty) {
				var style = document.documentElement.style;
				this._userSelect = style[userSelectProperty];
				style[userSelectProperty] = 'none';
			}
		};
		L.DomUtil.enableTextSelection = function () {
			if (userSelectProperty) {
				document.documentElement.style[userSelectProperty] = this._userSelect;
				delete this._userSelect;
			}
		};
	}

	L.DomUtil.disableImageDrag = function () {
		L.DomEvent.on(window, 'dragstart', L.DomEvent.preventDefault);
	};
	L.DomUtil.enableImageDrag = function () {
		L.DomEvent.off(window, 'dragstart', L.DomEvent.preventDefault);
	};

	L.DomUtil.preventOutline = function (element) {
		L.DomUtil.restoreOutline();
		this._outlineElement = element;
		this._outlineStyle = element.style.outline;
		element.style.outline = 'none';
		L.DomEvent.on(window, 'keydown', L.DomUtil.restoreOutline, this);
	};
	L.DomUtil.restoreOutline = function () {
		if (!this._outlineElement) { return; }
		this._outlineElement.style.outline = this._outlineStyle;
		delete this._outlineElement;
		delete this._outlineStyle;
		L.DomEvent.off(window, 'keydown', L.DomUtil.restoreOutline, this);
	};
})();


/*
 * L.LatLng represents a geographical point with latitude and longitude coordinates.
 */

L.LatLng = function (lat, lng, alt) {
	if (isNaN(lat) || isNaN(lng)) {
		throw new Error('Invalid LatLng object: (' + lat + ', ' + lng + ')');
	}

	this.lat = +lat;
	this.lng = +lng;

	if (alt !== undefined) {
		this.alt = +alt;
	}
};

L.LatLng.prototype = {
	equals: function (obj, maxMargin) {
		if (!obj) { return false; }

		obj = L.latLng(obj);

		var margin = Math.max(
		        Math.abs(this.lat - obj.lat),
		        Math.abs(this.lng - obj.lng));

		return margin <= (maxMargin === undefined ? 1.0E-9 : maxMargin);
	},

	toString: function (precision) {
		return 'LatLng(' +
		        L.Util.formatNum(this.lat, precision) + ', ' +
		        L.Util.formatNum(this.lng, precision) + ')';
	},

	distanceTo: function (other) {
		return L.CRS.Earth.distance(this, L.latLng(other));
	},

	wrap: function () {
		return L.CRS.Earth.wrapLatLng(this);
	},

	toBounds: function (sizeInMeters) {
		var latAccuracy = 180 * sizeInMeters / 40075017,
		    lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * this.lat);

		return L.latLngBounds(
		        [this.lat - latAccuracy, this.lng - lngAccuracy],
		        [this.lat + latAccuracy, this.lng + lngAccuracy]);
	}
};


// constructs LatLng with different signatures
// (LatLng) or ([Number, Number]) or (Number, Number) or (Object)

L.latLng = function (a, b, c) {
	if (a instanceof L.LatLng) {
		return a;
	}
	if (L.Util.isArray(a) && typeof a[0] !== 'object') {
		if (a.length === 3) {
			return new L.LatLng(a[0], a[1], a[2]);
		}
		if (a.length === 2) {
			return new L.LatLng(a[0], a[1]);
		}
		return null;
	}
	if (a === undefined || a === null) {
		return a;
	}
	if (typeof a === 'object' && 'lat' in a) {
		return new L.LatLng(a.lat, 'lng' in a ? a.lng : a.lon, a.alt);
	}
	if (b === undefined) {
		return null;
	}
	return new L.LatLng(a, b, c);
};


/*
 * L.LatLngBounds represents a rectangular area on the map in geographical coordinates.
 */

L.LatLngBounds = function (southWest, northEast) { // (LatLng, LatLng) or (LatLng[])
	if (!southWest) { return; }

	var latlngs = northEast ? [southWest, northEast] : southWest;

	for (var i = 0, len = latlngs.length; i < len; i++) {
		this.extend(latlngs[i]);
	}
};

L.LatLngBounds.prototype = {

	// extend the bounds to contain the given point or bounds
	extend: function (obj) { // (LatLng) or (LatLngBounds)
		var sw = this._southWest,
		    ne = this._northEast,
		    sw2, ne2;

		if (obj instanceof L.LatLng) {
			sw2 = obj;
			ne2 = obj;

		} else if (obj instanceof L.LatLngBounds) {
			sw2 = obj._southWest;
			ne2 = obj._northEast;

			if (!sw2 || !ne2) { return this; }

		} else {
			return obj ? this.extend(L.latLng(obj) || L.latLngBounds(obj)) : this;
		}

		if (!sw && !ne) {
			this._southWest = new L.LatLng(sw2.lat, sw2.lng);
			this._northEast = new L.LatLng(ne2.lat, ne2.lng);
		} else {
			sw.lat = Math.min(sw2.lat, sw.lat);
			sw.lng = Math.min(sw2.lng, sw.lng);
			ne.lat = Math.max(ne2.lat, ne.lat);
			ne.lng = Math.max(ne2.lng, ne.lng);
		}

		return this;
	},

	// extend the bounds by a percentage
	pad: function (bufferRatio) { // (Number) -> LatLngBounds
		var sw = this._southWest,
		    ne = this._northEast,
		    heightBuffer = Math.abs(sw.lat - ne.lat) * bufferRatio,
		    widthBuffer = Math.abs(sw.lng - ne.lng) * bufferRatio;

		return new L.LatLngBounds(
		        new L.LatLng(sw.lat - heightBuffer, sw.lng - widthBuffer),
		        new L.LatLng(ne.lat + heightBuffer, ne.lng + widthBuffer));
	},

	getCenter: function () { // -> LatLng
		return new L.LatLng(
		        (this._southWest.lat + this._northEast.lat) / 2,
		        (this._southWest.lng + this._northEast.lng) / 2);
	},

	getSouthWest: function () {
		return this._southWest;
	},

	getNorthEast: function () {
		return this._northEast;
	},

	getNorthWest: function () {
		return new L.LatLng(this.getNorth(), this.getWest());
	},

	getSouthEast: function () {
		return new L.LatLng(this.getSouth(), this.getEast());
	},

	getWest: function () {
		return this._southWest.lng;
	},

	getSouth: function () {
		return this._southWest.lat;
	},

	getEast: function () {
		return this._northEast.lng;
	},

	getNorth: function () {
		return this._northEast.lat;
	},

	contains: function (obj) { // (LatLngBounds) or (LatLng) -> Boolean
		if (typeof obj[0] === 'number' || obj instanceof L.LatLng) {
			obj = L.latLng(obj);
		} else {
			obj = L.latLngBounds(obj);
		}

		var sw = this._southWest,
		    ne = this._northEast,
		    sw2, ne2;

		if (obj instanceof L.LatLngBounds) {
			sw2 = obj.getSouthWest();
			ne2 = obj.getNorthEast();
		} else {
			sw2 = ne2 = obj;
		}

		return (sw2.lat >= sw.lat) && (ne2.lat <= ne.lat) &&
		       (sw2.lng >= sw.lng) && (ne2.lng <= ne.lng);
	},

	intersects: function (bounds) { // (LatLngBounds)
		bounds = L.latLngBounds(bounds);

		var sw = this._southWest,
		    ne = this._northEast,
		    sw2 = bounds.getSouthWest(),
		    ne2 = bounds.getNorthEast(),

		    latIntersects = (ne2.lat >= sw.lat) && (sw2.lat <= ne.lat),
		    lngIntersects = (ne2.lng >= sw.lng) && (sw2.lng <= ne.lng);

		return latIntersects && lngIntersects;
	},

	toBBoxString: function () {
		return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()].join(',');
	},

	equals: function (bounds) { // (LatLngBounds)
		if (!bounds) { return false; }

		bounds = L.latLngBounds(bounds);

		return this._southWest.equals(bounds.getSouthWest()) &&
		       this._northEast.equals(bounds.getNorthEast());
	},

	isValid: function () {
		return !!(this._southWest && this._northEast);
	}
};

L.LatLngBounds.createDefault = function() {
	return new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
};

//TODO International date line?

L.latLngBounds = function (a, b) { // (LatLngBounds) or (LatLng, LatLng)
	if (!a || a instanceof L.LatLngBounds) {
		return a;
	}
	return new L.LatLngBounds(a, b);
};


/*
 * Simple equirectangular (Plate Carree) projection, used by CRS like EPSG:4326 and Simple.
 */

L.Projection = {};

L.Projection.LonLat = {
	project: function (latlng) {
		return new L.Point(latlng.lng, latlng.lat);
	},

	unproject: function (point) {
		return new L.LatLng(point.y, point.x);
	},

	bounds: L.bounds([-180, -90], [180, 90])
};


/*
 * Spherical Mercator is the most popular map projection, used by EPSG:3857 CRS used by default.
 */

L.Projection.SphericalMercator = {

	R: 6378137,

	project: function (latlng) {
		var d = Math.PI / 180,
		    max = 1 - 1E-15,
		    sin = Math.max(Math.min(Math.sin(latlng.lat * d), max), -max);

		return new L.Point(
				this.R * latlng.lng * d,
				this.R * Math.log((1 + sin) / (1 - sin)) / 2);
	},

	unproject: function (point) {
		var d = 180 / Math.PI;

		return new L.LatLng(
			(2 * Math.atan(Math.exp(point.y / this.R)) - (Math.PI / 2)) * d,
			point.x * d / this.R);
	},

	bounds: (function () {
		var d = 6378137 * Math.PI;
		return L.bounds([-d, -d], [d, d]);
	})()
};


/*
 * L.CRS is the base object for all defined CRS (Coordinate Reference Systems) in Leaflet.
 */

L.CRS = {
	// converts geo coords to pixel ones
	latLngToPoint: function (latlng, zoom) {
		var projectedPoint = this.projection.project(latlng),
		    scale = this.scale(zoom);

		return this.transformation._transform(projectedPoint, scale);
	},

	// converts pixel coords to geo coords
	pointToLatLng: function (point, zoom) {
		var scale = this.scale(zoom),
		    untransformedPoint = this.transformation.untransform(point, scale);

		return this.projection.unproject(untransformedPoint);
	},

	// converts geo coords to projection-specific coords (e.g. in meters)
	project: function (latlng) {
		return this.projection.project(latlng);
	},

	// converts projected coords to geo coords
	unproject: function (point) {
		return this.projection.unproject(point);
	},

	// defines how the world scales with zoom
	scale: function (zoom) {
		return 256 * Math.pow(2, zoom);
	},

	// returns the bounds of the world in projected coords if applicable
	getProjectedBounds: function (zoom) {
		if (this.infinite) { return null; }

		var b = this.projection.bounds,
		    s = this.scale(zoom),
		    min = this.transformation.transform(b.min, s),
		    max = this.transformation.transform(b.max, s);

		return L.bounds(min, max);
	},

	// whether a coordinate axis wraps in a given range (e.g. longitude from -180 to 180); depends on CRS
	// wrapLng: [min, max],
	// wrapLat: [min, max],

	// if true, the coordinate space will be unbounded (infinite in all directions)
	// infinite: false,

	// wraps geo coords in certain ranges if applicable
	wrapLatLng: function (latlng) {
		var lng = this.wrapLng ? L.Util.wrapNum(latlng.lng, this.wrapLng, true) : latlng.lng,
		    lat = this.wrapLat ? L.Util.wrapNum(latlng.lat, this.wrapLat, true) : latlng.lat;

		return L.latLng(lat, lng);
	}
};


/*
 * A simple CRS that can be used for flat non-Earth maps like panoramas or game maps.
 */

L.CRS.Simple = L.extend({}, L.CRS, {
	projection: L.Projection.LonLat,
	transformation: new L.Transformation(1, 0, -1, 0),

	scale: function (zoom) {
		return Math.pow(1.2, zoom);
	},

	distance: function (latlng1, latlng2) {
		var dx = latlng2.lng - latlng1.lng,
		    dy = latlng2.lat - latlng1.lat;

		return Math.sqrt(dx * dx + dy * dy);
	},

	infinite: true
});


/*
 * L.CRS.Earth is the base class for all CRS representing Earth.
 */

L.CRS.Earth = L.extend({}, L.CRS, {
	wrapLng: [-180, 180],

	R: 6378137,

	// distance between two geographical points using spherical law of cosines approximation
	distance: function (latlng1, latlng2) {
		var rad = Math.PI / 180,
		    lat1 = latlng1.lat * rad,
		    lat2 = latlng2.lat * rad,
		    a = Math.sin(lat1) * Math.sin(lat2) +
		        Math.cos(lat1) * Math.cos(lat2) * Math.cos((latlng2.lng - latlng1.lng) * rad);

		return this.R * Math.acos(Math.min(a, 1));
	}
});


/*
 * L.CRS.EPSG3857 (Spherical Mercator) is the most common CRS for web mapping and is used by Leaflet by default.
 */

L.CRS.EPSG3857 = L.extend({}, L.CRS.Earth, {
	code: 'EPSG:3857',
	projection: L.Projection.SphericalMercator,

	transformation: (function () {
		var scale = 0.5 / (Math.PI * L.Projection.SphericalMercator.R);
		return new L.Transformation(scale, 0.5, -scale, 0.5);
	}())
});

L.CRS.EPSG900913 = L.extend({}, L.CRS.EPSG3857, {
	code: 'EPSG:900913'
});


/*
 * L.CRS.EPSG4326 is a CRS popular among advanced GIS specialists.
 */

L.CRS.EPSG4326 = L.extend({}, L.CRS.Earth, {
	code: 'EPSG:4326',
	projection: L.Projection.LonLat,
	transformation: new L.Transformation(1 / 180, 1, -1 / 180, 0.5)
});


/* -*- js-indent-level: 8 -*- */
/*
 * L.Map is the central class of the API - it is used to create a map.
 */

/* global vex $ */
L.Map = L.Evented.extend({

	options: {
		crs: L.CRS.Simple,
		center: [0, 0],
		zoom: 10,
		minZoom: 1,
		maxZoom: 20,
		fadeAnimation: false, // Not useful for typing.
		trackResize: true,
		markerZoomAnimation: true,
		defaultZoom: 10,
		tileWidthTwips: 3840,
		tileHeightTwips: 3840,
		urlPrefix: 'lool'
	},

	lastActiveTime: Date.now(),

	initialize: function (id, options) { // (HTMLElement or String, Object)
		options = L.setOptions(this, options);

		if (this.options.documentContainer) {
			// have it as DOM object
			this.options.documentContainer = L.DomUtil.get(this.options.documentContainer);
		}

		this._initContainer(id);
		this._initLayout();

		// hack for https://github.com/Leaflet/Leaflet/issues/1980
		this._onResize = L.bind(this._onResize, this);

		this._initEvents();

		if (options.maxBounds) {
			this.setMaxBounds(options.maxBounds);
		}

		if (options.zoom !== undefined) {
			this._zoom = this._limitZoom(options.zoom);
		}

		if (options.center && options.zoom !== undefined) {
			this.setView(L.latLng(options.center), options.zoom, {reset: true});
		}

		L.Cursor.imagePath = options.cursorURL || L.Cursor.getCursorURL('cursors');

		if (options.webserver === undefined) {
			var protocol = window.location.protocol === 'file:' ? 'https:' : window.location.protocol;
			options.webserver = options.server.replace(/^(ws|wss):/i, protocol);
		}

		// we are adding components like '/insertfile' at the end which would
		// lead to URL's of the form <webserver>//insertfile/...
		options.webserver = options.webserver.replace(/\/*$/, '');

		this._handlers = [];
		this._layers = {};
		this._zoomBoundLayers = {};
		this._sizeChanged = true;
		this._bDisableKeyboard = false;
		this._active = true;
		this._fatal = false;
		this._enabled = true;
		this._debugAlwaysActive = false; // disables the dimming / document inactivity when true
		this._serverRecycling = false;
		this._documentIdle = false;

		vex.dialogID = -1;

		this.callInitHooks();

		if (this.options.imagePath) {
			L.Icon.Default.imagePath = this.options.imagePath;
		}
		this._addLayers(this.options.layers);
		this._socket = L.socket(this);
		this._progressBar = L.progressOverlay(this.getCenter(), L.point(150, 25));

		// Inhibit the context menu - the browser thinks that the document
		// is just a bunch of images, hence the context menu is useless (tdf#94599)
		this.on('contextmenu', function() {});

		// When all these conditions are met, fire statusindicator:initializationcomplete
		this.initConditions = {
			'doclayerinit': false,
			'statusindicatorfinish': false,
			'StyleApply': false,
			'CharFontName': false,
			'updatepermission': false
		};
		this.initComplete = false;

		this.on('updatepermission', function(e) {
			if (!this.initComplete) {
				this._fireInitComplete('updatepermission');
			}

			if (e.perm === 'readonly') {
				L.DomUtil.addClass(this._container.parentElement, 'readonly');
				L.DomUtil.addClass(L.DomUtil.get('logo'), 'readonly');
				L.DomUtil.addClass(L.DomUtil.get('toolbar-wrapper'), 'readonly');
				L.DomUtil.addClass(L.DomUtil.get('main-menu'), 'readonly');
				L.DomUtil.addClass(L.DomUtil.get('presentation-controls-wrapper'), 'readonly');
				L.DomUtil.addClass(L.DomUtil.get('spreadsheet-row-column-frame'), 'readonly');
			}
		}, this);
		this.on('doclayerinit', function() {
			if (!this.initComplete) {
				this._fireInitComplete('doclayerinit');
			}
		});
		this.on('updatetoolbarcommandvalues', function(e) {
			if (this.initComplete) {
				return;
			}
			if (e.commandName === '.uno:StyleApply') {
				this._fireInitComplete('StyleApply');
			}
			else if (e.commandName === '.uno:CharFontName') {
				this._fireInitComplete('CharFontName');
			}
		});

		this.showBusy(_('Initializing...'), false);
		this.on('statusindicator', this._onUpdateProgress, this);

		// View info (user names and view ids)
		this._viewInfo = {};
		this._viewInfoByUser = {};

		// View color map
		this._viewColors = {};

		// This becomes true if document was ever modified by the user
		this._everModified = false;

		this.on('commandstatechanged', function(e) {
			if (e.commandName === '.uno:ModifiedStatus')
				this._everModified = this._everModified || (e.state === 'true');
		}, this);
	},

	// public methods that modify map state

	getViewId: function (username) {
		for (var idx in this._viewInfo) {
			if (this._viewInfo[idx].username === username) {
				return this._viewInfo[idx].id;
			}
		}
		return -1;
	},

	addView: function(viewInfo) {
		this._viewInfo[viewInfo.id] = viewInfo;
		if (viewInfo.userextrainfo !== undefined && viewInfo.userextrainfo.avatar !== undefined) {
			this._viewInfoByUser[viewInfo.userid] = viewInfo;
		}
		this.fire('postMessage', {msgId: 'View_Added', args: {ViewId: viewInfo.id, UserId: viewInfo.userid, UserName: viewInfo.username, UserExtraInfo: viewInfo.userextrainfo, Color: L.LOUtil.rgbToHex(viewInfo.color), ReadOnly: viewInfo.readonly}});

		// Fire last, otherwise not all events are handled correctly.
		this.fire('addview', {viewId: viewInfo.id, username: viewInfo.username, extraInfo: viewInfo.userextrainfo, readonly: this.isViewReadOnly(viewInfo.id)});

		this.updateAvatars();
	},

	removeView: function(viewid) {
		var username = this._viewInfo[viewid].username;
		delete this._viewInfoByUser[this._viewInfo[viewid].userid];
		delete this._viewInfo[viewid];
		this.fire('postMessage', {msgId: 'View_Removed', args: {ViewId: viewid}});

		// Fire last, otherwise not all events are handled correctly.
		this.fire('removeview', {viewId: viewid, username: username});
	},


	// replaced by animation-powered implementation in Map.PanAnimation.js
	setView: function (center, zoom) {
		zoom = zoom === undefined ? this.getZoom() : zoom;
		this._resetView(L.latLng(center), this._limitZoom(zoom));
		return this;
	},

	updateAvatars: function() {
		if (this._docLayer && this._docLayer._annotations && this._docLayer._annotations._items) {
			for (var idxAnno in this._docLayer._annotations._items) {
				var userid = this._docLayer._annotations._items[idxAnno]._data.author;
				if (this._viewInfoByUser[userid]) {
					$(this._docLayer._annotations._items[idxAnno]._authorAvatarImg).attr('src', this._viewInfoByUser[userid].userextrainfo.avatar);
				}
			}
		}
	},

	showBusy: function(label, bar) {
		// If document is already loaded, ask the toolbar widget to show busy
		// status on the bottom statusbar
		if (this._docLayer) {
			this.fire('showbusy', {label: label});
			return;
		}

		this._progressBar.setLabel(label);
		this._progressBar.setBar(bar);
		this._progressBar.setValue(0);

		if (!this.hasLayer(this._progressBar)) {
			this.addLayer(this._progressBar);
		}
	},

	hideBusy: function () {
		this.fire('hidebusy');

		if (this.hasLayer(this._progressBar)) {
			this.removeLayer(this._progressBar);
		}
	},

	setZoom: function (zoom, options) {
		if (!this._loaded) {
			this._zoom = this._limitZoom(zoom);
			return this;
		}
		if (this._docLayer && this._docLayer._docType === 'spreadsheet') {
			// for spreadsheets, when the document is smaller than the viewing area
			// we want it to be glued to the row/column headers instead of being centered
			this._docLayer._checkSpreadSheetBounds(zoom);
		}
		return this.setView(this.getCenter(), zoom, {zoom: options});
	},

	zoomIn: function (delta, options) {
		return this.setZoom(this._zoom + (delta || 1), options);
	},

	zoomOut: function (delta, options) {
		return this.setZoom(this._zoom - (delta || 1), options);
	},

	setZoomAround: function (latlng, zoom, options) {
		var scale = this.getZoomScale(zoom),
		    viewHalf = this.getSize().divideBy(2),
		    containerPoint = latlng instanceof L.Point ? latlng : this.latLngToContainerPoint(latlng),

		    centerOffset = containerPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale),
		    newCenter = this.containerPointToLatLng(viewHalf.add(centerOffset));

		return this.setView(newCenter, zoom, {zoom: options});
	},

	fitBounds: function (bounds, options) {

		options = options || {};
		bounds = bounds.getBounds ? bounds.getBounds() : L.latLngBounds(bounds);

		var paddingTL = L.point(options.paddingTopLeft || options.padding || [0, 0]),
		    paddingBR = L.point(options.paddingBottomRight || options.padding || [0, 0]),

		    zoom = this.getBoundsZoom(bounds, false, paddingTL.add(paddingBR));

		zoom = options.maxZoom ? Math.min(options.maxZoom, zoom) : zoom;

		var paddingOffset = paddingBR.subtract(paddingTL).divideBy(2),

		    swPoint = this.project(bounds.getSouthWest(), zoom),
		    nePoint = this.project(bounds.getNorthEast(), zoom),
		    center = this.unproject(swPoint.add(nePoint).divideBy(2).add(paddingOffset), zoom);

		return this.setView(center, zoom, options);
	},

	fitWorld: function (options) {
		return this.fitBounds([[-90, -180], [90, 180]], options);
	},

	panTo: function (center, options) { // (LatLng)
		return this.setView(center, this._zoom, {pan: options});
	},

	panBy: function (offset) { // (Point)
		// replaced with animated panBy in Map.PanAnimation.js
		this.fire('movestart');

		this._rawPanBy(L.point(offset));

		this.fire('move');
		return this.fire('moveend');
	},

	setMaxBounds: function (bounds, options) {
		bounds = L.latLngBounds(bounds);

		this.options.maxBounds = bounds;
		options = options || {};

		if (!bounds) {
			return this.off('moveend', this._panInsideMaxBounds);
		}

		if (this._loaded) {
			this._panInsideMaxBounds();
		}

		if (options.panInside === false) {
			return this.off('moveend', this._panInsideMaxBounds);
		}

		return this.on('moveend', this._panInsideMaxBounds);
	},

	panInsideBounds: function (bounds, options) {
		var center = this.getCenter(),
		    newCenter = this._limitCenter(center, this._zoom, bounds);

		if (center.equals(newCenter)) { return this; }

		return this.panTo(newCenter, options);
	},

	invalidateSize: function (options) {
		if (!this._loaded) { return this; }

		options = L.extend({
			animate: false,
			pan: true
		}, options === true ? {animate: true} : options);

		var oldSize = this.getSize();
		this._sizeChanged = true;

		var newSize = this.getSize(),
		    oldCenter = oldSize.divideBy(2).round(),
		    newCenter = newSize.divideBy(2).round(),
		    offset = oldCenter.subtract(newCenter);

		if (!offset.x && !offset.y) { return this; }

		if (options.animate && options.pan) {
			this.panBy(offset);

		} else {
			if (options.pan) {
				this._rawPanBy(offset);
			}

			this.fire('move');

			if (options.debounceMoveend) {
				clearTimeout(this._sizeTimer);
				this._sizeTimer = setTimeout(L.bind(this.fire, this, 'moveend'), 200);
			} else {
				this.fire('moveend');
			}
		}

		return this.fire('resize', {
			oldSize: oldSize,
			newSize: newSize
		});
	},

	stop: function () {
		L.Util.cancelAnimFrame(this._flyToFrame);
		if (this._panAnim) {
			this._panAnim.stop();
		}
		return this;
	},

	// TODO handler.addTo
	addHandler: function (name, HandlerClass) {
		if (!HandlerClass) { return this; }

		var handler = this[name] = new HandlerClass(this);

		this._handlers.push(handler);

		if (this.options[name]) {
			handler.enable();
		}

		return this;
	},

	remove: function () {

		this._initEvents(true);

		try {
			// throws error in IE6-8
			delete this._container._leaflet;
		} catch (e) {
			this._container._leaflet = undefined;
		}

		L.DomUtil.remove(this._mapPane);

		if (this._clearControlPos) {
			this._clearControlPos();
		}

		this._clearHandlers();

		if (this._loaded) {
			this.fire('unload');
		}

		if (this._docLayer) {
			this.removeLayer(this._docLayer);
		}
		this.removeControls();
		this._socket.close();
		return this;
	},

	createPane: function (name, container) {
		var className = 'leaflet-pane' + (name ? ' leaflet-' + name.replace('Pane', '') + '-pane' : ''),
		    pane = L.DomUtil.create('div', className, container || this._mapPane);

		if (name) {
			this._panes[name] = pane;
		}
		return pane;
	},


	// public methods for getting map state

	getViewName: function(viewid) {
		return this._viewInfo[viewid].username;
	},

	getViewColor: function(viewid) {
		return this._viewInfo[viewid].color;
	},

	isViewReadOnly: function(viewid) {
		return this._viewInfo[viewid].readonly !== '0';
	},

	getCenter: function () { // (Boolean) -> LatLng
		this._checkIfLoaded();
		return this.layerPointToLatLng(this._getCenterLayerPoint());
	},

	getZoom: function () {
		return this._zoom;
	},

	getBounds: function () {
		var bounds = this.getPixelBounds(),
		    sw = this.unproject(bounds.getBottomLeft()),
		    ne = this.unproject(bounds.getTopRight());

		return new L.LatLngBounds(sw, ne);
	},

	getMinZoom: function () {
		return this.options.minZoom === undefined ? this._layersMinZoom || 0 : this.options.minZoom;
	},

	getMaxZoom: function () {
		return this.options.maxZoom === undefined ?
			(this._layersMaxZoom === undefined ? Infinity : this._layersMaxZoom) :
			this.options.maxZoom;
	},

	getBoundsZoom: function (bounds, inside, padding) { // (LatLngBounds[, Boolean, Point]) -> Number
		bounds = L.latLngBounds(bounds);

		var zoom = this.getMinZoom() - (inside ? 1 : 0),
		    maxZoom = this.getMaxZoom(),
		    size = this.getSize(),

		    nw = bounds.getNorthWest(),
		    se = bounds.getSouthEast(),

		    zoomNotFound = true,
		    boundsSize;

		padding = L.point(padding || [0, 0]);

		do {
			zoom++;
			boundsSize = this.project(se, zoom).subtract(this.project(nw, zoom)).add(padding).floor();
			zoomNotFound = !inside ? size.contains(boundsSize) : boundsSize.x < size.x || boundsSize.y < size.y;

		} while (zoomNotFound && zoom <= maxZoom);

		if (zoomNotFound && inside) {
			return null;
		}

		return inside ? zoom : zoom - 1;
	},

	getSize: function () {
		if (!this._size || this._sizeChanged) {
			this._size = new L.Point(
				this._container.clientWidth,
				this._container.clientHeight);

			this._sizeChanged = false;
		}
		return this._size.clone();
	},

	getPixelBounds: function (center, zoom) {
		var topLeftPoint = this._getTopLeftPoint(center, zoom);
		return new L.Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
	},

	getPixelOrigin: function () {
		this._checkIfLoaded();
		return this._pixelOrigin;
	},

	getPixelWorldBounds: function (zoom) {
		return this.options.crs.getProjectedBounds(zoom === undefined ? this.getZoom() : zoom);
	},

	getPane: function (pane) {
		return typeof pane === 'string' ? this._panes[pane] : pane;
	},

	getPanes: function () {
		return this._panes;
	},

	getContainer: function () {
		return this._container;
	},


	// TODO replace with universal implementation after refactoring projections

	getZoomScale: function (toZoom, fromZoom) {
		var crs = this.options.crs;
		fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
		return crs.scale(toZoom) / crs.scale(fromZoom);
	},

	getScaleZoom: function (scale, fromZoom) {
		fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
		return fromZoom + (Math.log(scale) / Math.LN2);
	},


	// conversion methods

	project: function (latlng, zoom) { // (LatLng[, Number]) -> Point
		zoom = zoom === undefined ? this._zoom : zoom;
		var projectedPoint = this.options.crs.latLngToPoint(L.latLng(latlng), zoom);
		return new L.Point(L.round(projectedPoint.x, 1e-6), L.round(projectedPoint.y, 1e-6));
	},

	unproject: function (point, zoom) { // (Point[, Number]) -> LatLng
		zoom = zoom === undefined ? this._zoom : zoom;
		return this.options.crs.pointToLatLng(L.point(point), zoom);
	},

	layerPointToLatLng: function (point) { // (Point)
		var projectedPoint = L.point(point).add(this.getPixelOrigin());
		return this.unproject(projectedPoint);
	},

	latLngToLayerPoint: function (latlng) { // (LatLng)
		var projectedPoint = this.project(L.latLng(latlng))._round();
		return projectedPoint._subtract(this.getPixelOrigin());
	},

	wrapLatLng: function (latlng) {
		return this.options.crs.wrapLatLng(L.latLng(latlng));
	},

	distance: function (latlng1, latlng2) {
		return this.options.crs.distance(L.latLng(latlng1), L.latLng(latlng2));
	},

	containerPointToLayerPoint: function (point) { // (Point)
		return L.point(point).subtract(this._getMapPanePos());
	},

	layerPointToContainerPoint: function (point) { // (Point)
		return L.point(point).add(this._getMapPanePos());
	},

	containerPointToLatLng: function (point) {
		var layerPoint = this.containerPointToLayerPoint(L.point(point));
		return this.layerPointToLatLng(layerPoint);
	},

	latLngToContainerPoint: function (latlng) {
		return this.layerPointToContainerPoint(this.latLngToLayerPoint(L.latLng(latlng)));
	},

	mouseEventToContainerPoint: function (e) { // (MouseEvent)
		return L.DomEvent.getMousePosition(e, this._container);
	},

	mouseEventToLayerPoint: function (e) { // (MouseEvent)
		return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
	},

	mouseEventToLatLng: function (e) { // (MouseEvent)
		return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
	},

	focus: function () {
		console.debug('focus:');
		if (this._docLayer && document.activeElement !== this._docLayer._textArea) {
			console.debug('focus: focussing');
			this._docLayer._textArea.focus();
		}
	},

	_fireInitComplete: function (condition) {
		if (this.initComplete) {
			return;
		}

		this.initConditions[condition] = true;
		for (var key in this.initConditions) {
			if (!this.initConditions[key]) {
				return;
			}
		}
		this.fire('statusindicator', {statusType: 'initializationcomplete'});
		this.initComplete = true;
	},

	_initContainer: function (id) {
		var container = this._container = L.DomUtil.get(id);

		if (!container) {
			throw new Error('Map container not found.');
		} else if (container._leaflet) {
			throw new Error('Map container is already initialized.');
		}

		var textAreaContainer = L.DomUtil.create('div', 'clipboard-container', container.parentElement);
		this._textArea = L.DomUtil.create('input', 'clipboard', textAreaContainer);
		this._textArea.setAttribute('type', 'text');
		this._textArea.setAttribute('autocorrect', 'off');
		this._textArea.setAttribute('autocapitalize', 'off');
		this._textArea.setAttribute('autocomplete', 'off');
		this._textArea.setAttribute('spellcheck', 'false');
		this._resizeDetector = L.DomUtil.create('iframe', 'resize-detector', container);
		this._fileDownloader = L.DomUtil.create('iframe', '', container);
		L.DomUtil.setStyle(this._fileDownloader, 'display', 'none');

		container._leaflet = true;
	},

	_initLayout: function () {
		var container = this._container;

		this._fadeAnimated = this.options.fadeAnimation && L.Browser.any3d;

		L.DomUtil.addClass(container, 'leaflet-container' +
			(L.Browser.touch ? ' leaflet-touch' : '') +
			(L.Browser.retina ? ' leaflet-retina' : '') +
			(L.Browser.ielt9 ? ' leaflet-oldie' : '') +
			(L.Browser.safari ? ' leaflet-safari' : '') +
			(this._fadeAnimated ? ' leaflet-fade-anim' : ''));

		var position = L.DomUtil.getStyle(container, 'position');

		if (position !== 'absolute' && position !== 'relative' && position !== 'fixed') {
			container.style.position = 'absolute';
		}

		this._initPanes();

		if (this._initControlPos) {
			this._initControlPos();
		}
	},

	_initPanes: function () {
		var panes = this._panes = {};
		this._paneRenderers = {};

		this._mapPane = this.createPane('mapPane', this._container);

		this.createPane('tilePane');
		this.createPane('shadowPane');
		this.createPane('overlayPane');
		this.createPane('markerPane');
		this.createPane('popupPane');

		if (!this.options.markerZoomAnimation) {
			L.DomUtil.addClass(panes.markerPane, 'leaflet-zoom-hide');
			L.DomUtil.addClass(panes.shadowPane, 'leaflet-zoom-hide');
		}
	},


	// private methods that modify map state

	_resetView: function (center, zoom, preserveMapOffset, afterZoomAnim) {

		var zoomChanged = (this._zoom !== zoom);

		if (!afterZoomAnim) {
			this.fire('movestart');

			if (zoomChanged) {
				this.fire('zoomstart');
			}
		}

		this._zoom = zoom;

		if (!preserveMapOffset) {
			L.DomUtil.setPosition(this._mapPane, new L.Point(0, 0));
		}

		this._pixelOrigin = this._getNewPixelOrigin(center);

		var loading = !this._loaded;
		this._loaded = true;

		this.fire('viewreset', {hard: !preserveMapOffset});

		if (loading) {
			this.fire('load');
		}

		this.fire('move');

		if (zoomChanged || afterZoomAnim) {
			this.fire('zoomend');
			this.fire('zoomlevelschange');
		}

		this.fire('moveend', {hard: !preserveMapOffset});
	},

	_rawPanBy: function (offset) {
		L.DomUtil.setPosition(this._mapPane, this._getMapPanePos().subtract(offset));
	},

	_getZoomSpan: function () {
		return this.getMaxZoom() - this.getMinZoom();
	},

	_panInsideMaxBounds: function () {
		this.panInsideBounds(this.options.maxBounds);
	},

	_checkIfLoaded: function () {
		if (!this._loaded) {
			throw new Error('Set map center and zoom first.');
		}
	},

	// DOM event handling

	_initEvents: function (remove) {
		if (!L.DomEvent) { return; }

		this._targets = {};

		this._mouseOut = false;

		var onOff = remove ? 'off' : 'on';

		L.DomEvent[onOff](this._container, 'click dblclick mousedown mouseup ' +
			'mouseover mouseout mousemove contextmenu dragover drop ' +
			'keydown keypress keyup trplclick qdrplclick', this._handleDOMEvent, this);
		L.DomEvent[onOff](this._textArea, 'copy cut paste keydown keypress keyup compositionstart compositionupdate compositionend textInput', this._handleDOMEvent, this);

		if (this.options.trackResize && this._resizeDetector.contentWindow) {
			L.DomEvent[onOff](this._resizeDetector.contentWindow, 'resize', this._onResize, this);
		}

		L.DomEvent[onOff](window, 'blur', this._onLostFocus, this);
		L.DomEvent[onOff](window, 'focus', this._onGotFocus, this);
	},

	_onResize: function () {
		L.Util.cancelAnimFrame(this._resizeRequest);
		this._resizeRequest = L.Util.requestAnimFrame(
		        function () { this.invalidateSize({debounceMoveend: true}); }, this, false, this._container);
	},

	_activate: function () {
		if (this._serverRecycling || this._documentIdle) {
			return;
		}

		console.debug('_activate:');
		clearTimeout(vex.timer);

		if (!this._active) {
			// Only activate when we are connected.
			if (this._socket.connected()) {
				console.debug('sending useractive');
				this._socket.sendMessage('useractive');
				this._active = true;
				if (this._doclayer) {
					this._docLayer._onMessage('invalidatetiles: EMPTY', null);
				}
				if (vex.dialogID > 0) {
					var id = vex.dialogID;
					vex.dialogID = -1;
					this._startInactiveTimer();
					this.focus();
					return vex.close(id);
				}
			} else {
				this._socket.initialize(this);
			}
		}

		this._startInactiveTimer();
		this.focus();
		return false;
	},

	_dim: function() {
		if (this.options.alwaysActive || this._debugAlwaysActive === true) {
			return;
		}

		console.debug('_dim:');
		if (!this._socket.connected()) {
			return;
		}

		this._active = false;
		clearTimeout(vex.timer);

		var options = $.extend({}, vex.defaultOptions, {
			contentCSS: {'background':'rgba(0, 0, 0, 0)',
			             'font-size': 'xx-large',
				     'color': '#fff',
				     'text-align': 'center'},
			content: _('Inactive document - please click to resume editing')
		});
		options.id = vex.globalID;
		vex.dialogID = options.id;
		vex.globalID += 1;
		options.$vex = $('<div>').addClass(vex.baseClassNames.vex).addClass(options.className).css(options.css).data({
			vex: options
		});
		options.$vexOverlay = $('<div>').addClass(vex.baseClassNames.overlay).addClass(options.overlayClassName).css(options.overlayCSS).data({
			vex: options
		});

		var map = this;
		options.$vex.bind('click.vex', function(e) {
			console.debug('_dim: click.vex function');
			return map._activate();
		});
		options.$vex.append(options.$vexOverlay);

		options.$vexContent = $('<div>').addClass(vex.baseClassNames.content).addClass(options.contentClassName).css(options.contentCSS).text(options.content).data({
			vex: options
		});
		options.$vex.append(options.$vexContent);

		$(options.appendLocation).append(options.$vex);
		vex.setupBodyClassName(options.$vex);

		this._doclayer && this._docLayer._onMessage('textselection:', null);
		console.debug('_dim: sending userinactive');
		map.fire('postMessage', {msgId: 'User_Idle'});
		this._socket.sendMessage('userinactive');
	},

	_dimIfInactive: function () {
		console.debug('_dimIfInactive: diff=' + (Date.now() - this.lastActiveTime));
		if ((Date.now() - this.lastActiveTime) >= this.options.idleTimeoutSecs * 1000) {
			this._dim();
		} else {
			this._startInactiveTimer();
		}
	},

	_startInactiveTimer: function () {
		if (this._serverRecycling || this._documentIdle) {
			return;
		}

		console.debug('_startInactiveTimer:');
		clearTimeout(vex.timer);
		var map = this;
		vex.timer = setTimeout(function() {
			map._dimIfInactive();
		}, 1 * 60 * 1000); // Check once a minute
	},

	_deactivate: function () {
		if (this._serverRecycling || this._documentIdle) {
			return;
		}

		console.debug('_deactivate:');
		clearTimeout(vex.timer);

		if (!this._active || vex.dialogID > 0) {
			// A dialog is already dimming the screen and probably
			// shows an error message. Leave it alone.
			this._active = false;
			this._docLayer && this._docLayer._onMessage('textselection:', null);
			if (this._socket.connected()) {
				console.debug('_deactivate: sending userinactive');
				this._socket.sendMessage('userinactive');
			}

			return;
		}

		var map = this;
		vex.timer = setTimeout(function() {
			map._dim();
		}, map.options.outOfFocusTimeoutSecs * 1000);
	},

	_onLostFocus: function () {
		if (!this._loaded) { return; }

		console.debug('_onLostFocus: ');
		var doclayer = this._docLayer;
		if (!doclayer) { return; }

		// save state of cursor (blinking marker) and the cursor overlay
		doclayer._isCursorVisibleOnLostFocus = doclayer._isCursorVisible;
		doclayer._isCursorOverlayVisibleOnLostFocus = doclayer._isCursorOverlayVisible;

		// if the blinking cursor is visible, disable the overlay when we go out of focus
		if (doclayer._isCursorVisible && doclayer._isCursorOverlayVisible) {
			doclayer._isCursorOverlayVisible = false;
			doclayer._updateCursorAndOverlay();
		}

		this._deactivate();
	},

	_onGotFocus: function () {
		console.debug('_onGotFocus:');
		if (!this._loaded) { return; }

		var doclayer = this._docLayer;
		if (doclayer &&
		    typeof doclayer._isCursorOverlayVisibleOnLostFocus !== 'undefined' &&
		    typeof doclayer._isCursorVisibleOnLostFocus !== 'undefined') {
			// we restore the old cursor position by a small delay, so that if the user clicks
			// inside the document we skip to restore it, so that the user does not see the cursor
			// jumping from the old position to the new one
			setTimeout(function () {
				// restore the state that was before focus was lost
				doclayer._isCursorOverlayVisible = doclayer._isCursorOverlayVisibleOnLostFocus;
				doclayer._isCursorVisible = doclayer._isCursorVisibleOnLostFocus;
				doclayer._updateCursorAndOverlay();
			}, 300);
		}

		this._activate();
	},

	_onUpdateProgress: function (e) {
		if (e.statusType === 'start') {
			if (this._socket.socket.readyState === 1) {
				// auto-save
				this.showBusy(_('Saving...'), true);
			}
			else {
				this.showBusy(_('Loading...'), true);
			}
		}
		else if (e.statusType === 'setvalue') {
			this._progressBar.setValue(e.value);
		}
		else if (e.statusType === 'finish' || e.statusType === 'loleafletloaded' || e.statusType === 'reconnected') {
			this.hideBusy();
		}
	},

	_isMouseEnteringLeaving: function (e) {
		var target = e.target || e.srcElement,
		    related = e.relatedTarget;

		if (!target) { return false; }

		return (L.DomUtil.hasClass(target, 'leaflet-tile')
			&& !(related && (L.DomUtil.hasClass(related, 'leaflet-tile')
				|| L.DomUtil.hasClass(related, 'leaflet-cursor'))));
	},

	_handleDOMEvent: function (e) {
		if (!this._loaded || !this._enabled || L.DomEvent._skipped(e)) { return; }

		this.lastActiveTime = Date.now();

		// find the layer the event is propagating from
		var target = this._targets[L.stamp(e.target || e.srcElement)],
			//type = e.type === 'keypress' && e.keyCode === 13 ? 'click' : e.type;
		    type = e.type;

		// For touch devices, to pop-up the keyboard, it is required to call
		// .focus() method on hidden input within actual 'click' event here
		// Calling from some other place with no real 'click' event doesn't work
		if (type === 'click') {
			if (this._permission === 'edit') {
				this._textArea.blur();
				this._textArea.focus();
			}

			// unselect if anything is selected already
			if (this._docLayer && this._docLayer._annotations && this._docLayer._annotations.unselect) {
				this._docLayer._annotations.unselect();
			}
		}

		// we need to keep track if we have entered/left the map
		this._mouseEnteringLeaving = false;
		// mouse leaving the map ?
		if (!target && !this._mouseOut && type === 'mouseout') {
			this._mouseEnteringLeaving = this._isMouseEnteringLeaving(e);
			this._mouseOut = this._mouseEnteringLeaving; // event type == mouseout
		}
		// mouse entering the map ?
		if (!target && this._mouseOut && type === 'mouseover') {
			this._mouseEnteringLeaving = this._isMouseEnteringLeaving(e);
			this._mouseOut = !this._mouseEnteringLeaving; // event type == mouseover
		}

		// special case for map mouseover/mouseout events so that they're actually mouseenter/mouseleave
		if (!target && !this._mouseEnteringLeaving && (type === 'mouseover' || type === 'mouseout') &&
				!L.DomEvent._checkMouse(this._container, e)) { return; }

		// prevents outline when clicking on keyboard-focusable element
		if (type === 'mousedown') {
			L.DomUtil.preventOutline(e.target || e.srcElement);
			// Prevents image dragging on Mozilla when map's dragging
			// option is set to false
			e.preventDefault();
		}

		// workaround for drawing shapes, wihout this shapes cannot be shrunken
		if (target !== undefined && target._path !== undefined && type === 'mousemove') {
			target = undefined;
		}
		this._fireDOMEvent(target || this, e, type);
	},

	_fireDOMEvent: function (target, e, type) {
		if (!target.listens(type, true) && (type !== 'click' || !target.listens('preclick', true))) { return; }

		if (type === 'contextmenu') {
			L.DomEvent.preventDefault(e);
		}

		// prevents firing click after you just dragged an object
		if (e.type === 'click' && !e._simulated && this._draggableMoved(target)) { return; }

		var data = {
			originalEvent: e
		};
		if (e.type !== 'keypress' && e.type !== 'keyup' && e.type !== 'keydown' &&
			e.type !== 'copy' && e.type !== 'cut' && e.type !== 'paste' &&
		    e.type !== 'compositionstart' && e.type !== 'compositionupdate' && e.type !== 'compositionend' && e.type !== 'textInput') {
			data.containerPoint = target instanceof L.Marker ?
					this.latLngToContainerPoint(target.getLatLng()) : this.mouseEventToContainerPoint(e);
			data.layerPoint = this.containerPointToLayerPoint(data.containerPoint);
			data.latlng = this.layerPointToLatLng(data.layerPoint);
		}
		if (type === 'click') {
			target.fire('preclick', data, true);
		}
		target.fire(type, data, true);
	},

	_draggableMoved: function (obj) {
		obj = obj.options.draggable ? obj : this;
		return (obj.dragging && obj.dragging.moved()) || (this.boxZoom && this.boxZoom.moved());
	},

	_clearHandlers: function () {
		for (var i = 0, len = this._handlers.length; i < len; i++) {
			this._handlers[i].disable();
		}
	},

	whenReady: function (callback, context) {
		if (this._loaded) {
			callback.call(context || this, {target: this});
		} else {
			this.on('load', callback, context);
		}
		return this;
	},


	// private methods for getting map state

	_getMapPanePos: function () {
		return L.DomUtil.getPosition(this._mapPane) || new L.Point(0, 0);
	},

	_moved: function () {
		var pos = this._getMapPanePos();
		return pos && !pos.equals([0, 0]);
	},

	_getTopLeftPoint: function (center, zoom) {
		var pixelOrigin = center && zoom !== undefined ?
			this._getNewPixelOrigin(center, zoom) :
			this.getPixelOrigin();
		return pixelOrigin.subtract(this._getMapPanePos());
	},

	_getNewPixelOrigin: function (center, zoom) {
		var viewHalf = this.getSize()._divideBy(2);
		// TODO round on display, not calculation to increase precision?
		return this.project(center, zoom)._subtract(viewHalf)._add(this._getMapPanePos())._round();
	},

	_latLngToNewLayerPoint: function (latlng, zoom, center) {
		var topLeft = this._getNewPixelOrigin(center, zoom);
		return this.project(latlng, zoom)._subtract(topLeft);
	},

	// layer point of the current center
	_getCenterLayerPoint: function () {
		return this.containerPointToLayerPoint(this.getSize()._divideBy(2));
	},

	// offset of the specified place to the current center in pixels
	_getCenterOffset: function (latlng) {
		return this.latLngToLayerPoint(latlng).subtract(this._getCenterLayerPoint());
	},

	// adjust center for view to get inside bounds
	_limitCenter: function (center, zoom, bounds) {

		if (!bounds) { return center; }

		var centerPoint = this.project(center, zoom),
		    viewHalf = this.getSize().divideBy(2),
		    viewBounds = new L.Bounds(centerPoint.subtract(viewHalf), centerPoint.add(viewHalf)),
		    offset = this._getBoundsOffset(viewBounds, bounds, zoom);

		return this.unproject(centerPoint.add(offset), zoom);
	},

	// adjust offset for view to get inside bounds
	_limitOffset: function (offset, bounds) {
		if (!bounds) { return offset; }

		var viewBounds = this.getPixelBounds(),
		    newBounds = new L.Bounds(viewBounds.min.add(offset), viewBounds.max.add(offset));

		return offset.add(this._getBoundsOffset(newBounds, bounds));
	},

	// returns offset needed for pxBounds to get inside maxBounds at a specified zoom
	_getBoundsOffset: function (pxBounds, maxBounds, zoom) {
		var nwOffset = this.project(maxBounds.getNorthWest(), zoom).subtract(pxBounds.min),
		    seOffset = this.project(maxBounds.getSouthEast(), zoom).subtract(pxBounds.max),

		    dx = this._rebound(nwOffset.x, -seOffset.x),
		    dy = this._rebound(nwOffset.y, -seOffset.y);

		return new L.Point(dx, dy);
	},

	_rebound: function (left, right) {
		return left + right > 0 ?
			Math.round(left - right) / 2 :
			Math.max(0, Math.ceil(left)) - Math.max(0, Math.floor(right));
		// TODO: do we really need ceil and floor ?
		// for spreadsheets it can cause one pixel alignment offset btw grid and row/column header
		// and a one pixel horizontal auto-scrolling issue;
		// both issues have been fixed by rounding the projection: see Map.project above;
		// anyway in case of similar problems, this code needs to be checked
	},

	_limitZoom: function (zoom) {
		var min = this.getMinZoom(),
		    max = this.getMaxZoom();

		return Math.max(min, Math.min(max, zoom));
	},

	enable: function(enabled) {
		this._enabled = enabled;
		if (this._enabled) {
			$('.scroll-container').mCustomScrollbar('update');
		}
		else {
			$('.scroll-container').mCustomScrollbar('disable');
		}
	}
});

L.map = function (id, options) {
	return new L.Map(id, options);
};



L.Layer = L.Evented.extend({

	options: {
		pane: 'overlayPane'
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	remove: function () {
		return this.removeFrom(this._map || this._mapToAdd);
	},

	removeFrom: function (obj) {
		if (obj) {
			obj.removeLayer(this);
		}
		return this;
	},

	getPane: function (name) {
		return this._map.getPane(name ? (this.options[name] || name) : this.options.pane);
	},

	addInteractiveTarget: function (targetEl) {
		this._map._targets[L.stamp(targetEl)] = this;
		return this;
	},

	removeInteractiveTarget: function (targetEl) {
		delete this._map._targets[L.stamp(targetEl)];
		return this;
	},

	_layerAdd: function (e) {
		var map = e.target;

		// check in case layer gets added and then removed before the map is ready
		if (!map.hasLayer(this)) { return; }

		this._map = map;
		this._zoomAnimated = map._zoomAnimated;

		this.onAdd(map);

		if (this.getEvents) {
			map.on(this.getEvents(), this);
		}

		this.fire('add');
		map.fire('layeradd', {layer: this});
	}
});


L.Map.include({
	addLayer: function (layer) {
		var id = L.stamp(layer);
		if (this._layers[id]) { return layer; }
		this._layers[id] = layer;

		layer._mapToAdd = this;

		if (layer.beforeAdd) {
			layer.beforeAdd(this);
		}

		this.whenReady(layer._layerAdd, layer);

		return this;
	},

	removeLayer: function (layer) {
		var id = L.stamp(layer);

		if (!this._layers[id]) { return this; }

		if (this._loaded) {
			layer.onRemove(this);
		}

		if (layer.getEvents) {
			this.off(layer.getEvents(), layer);
		}

		delete this._layers[id];

		if (this._loaded) {
			this.fire('layerremove', {layer: layer});
			layer.fire('remove');
		}

		layer._map = layer._mapToAdd = null;

		return this;
	},

	hasLayer: function (layer) {
		return !!layer && (L.stamp(layer) in this._layers);
	},

	eachLayer: function (method, context) {
		for (var i in this._layers) {
			method.call(context, this._layers[i]);
		}
		return this;
	},

	_addLayers: function (layers) {
		layers = layers ? (L.Util.isArray(layers) ? layers : [layers]) : [];

		for (var i = 0, len = layers.length; i < len; i++) {
			this.addLayer(layers[i]);
		}
	},

	_addZoomLimit: function (layer) {
		if (isNaN(layer.options.maxZoom) || !isNaN(layer.options.minZoom)) {
			this._zoomBoundLayers[L.stamp(layer)] = layer;
			this._updateZoomLevels();
		}
	},

	_removeZoomLimit: function (layer) {
		var id = L.stamp(layer);

		if (this._zoomBoundLayers[id]) {
			delete this._zoomBoundLayers[id];
			this._updateZoomLevels();
		}
	},

	_updateZoomLevels: function () {
		var minZoom = Infinity,
		    maxZoom = -Infinity,
		    oldZoomSpan = this._getZoomSpan();

		for (var i in this._zoomBoundLayers) {
			var options = this._zoomBoundLayers[i].options;

			minZoom = options.minZoom === undefined ? minZoom : Math.min(minZoom, options.minZoom);
			maxZoom = options.maxZoom === undefined ? maxZoom : Math.max(maxZoom, options.maxZoom);
		}

		this._layersMaxZoom = maxZoom === -Infinity ? undefined : maxZoom;
		this._layersMinZoom = minZoom === Infinity ? undefined : minZoom;

		if (oldZoomSpan !== this._getZoomSpan()) {
			this.fire('zoomlevelschange');
		}
	}
});


/*
 * Mercator projection that takes into account that the Earth is not a perfect sphere.
 * Less popular than spherical mercator; used by projections like EPSG:3395.
 */

L.Projection.Mercator = {
	R: 6378137,
	R_MINOR: 6356752.314245179,

	bounds: L.bounds([-20037508.34279, -15496570.73972], [20037508.34279, 18764656.23138]),

	project: function (latlng) {
		var d = Math.PI / 180,
		    r = this.R,
		    y = latlng.lat * d,
		    tmp = this.R_MINOR / r,
		    e = Math.sqrt(1 - tmp * tmp),
		    con = e * Math.sin(y);

		var ts = Math.tan(Math.PI / 4 - y / 2) / Math.pow((1 - con) / (1 + con), e / 2);
		y = -r * Math.log(Math.max(ts, 1E-10));

		return new L.Point(latlng.lng * d * r, y);
	},

	unproject: function (point) {
		var d = 180 / Math.PI,
		    r = this.R,
		    tmp = this.R_MINOR / r,
		    e = Math.sqrt(1 - tmp * tmp),
		    ts = Math.exp(-point.y / r),
		    phi = Math.PI / 2 - 2 * Math.atan(ts);

		for (var i = 0, dphi = 0.1, con; i < 15 && Math.abs(dphi) > 1e-7; i++) {
			con = e * Math.sin(phi);
			con = Math.pow((1 - con) / (1 + con), e / 2);
			dphi = Math.PI / 2 - 2 * Math.atan(ts * con) - phi;
			phi += dphi;
		}

		return new L.LatLng(phi * d, point.x * d / r);
	}
};


/*
 * L.CRS.EPSG3857 (World Mercator) CRS implementation.
 */

L.CRS.EPSG3395 = L.extend({}, L.CRS.Earth, {
	code: 'EPSG:3395',
	projection: L.Projection.Mercator,

	transformation: (function () {
		var scale = 0.5 / (Math.PI * L.Projection.Mercator.R);
		return new L.Transformation(scale, 0.5, -scale, 0.5);
	}())
});


/* -*- js-indent-level: 8 -*- */
/*
 * L.GridLayer is used as base class for grid-like layers like TileLayer.
 */

L.GridLayer = L.Layer.extend({

	options: {
		pane: 'tilePane',

		tileSize: 256,
		opacity: 1,

		updateWhenIdle: L.Browser.mobile,
		updateInterval: 200,

		attribution: null,
		zIndex: null,
		bounds: null,

		minZoom: 0
		// maxZoom: <Number>
	},

	initialize: function (options) {
		options = L.setOptions(this, options);
	},

	onAdd: function () {
		this._initContainer();
		this._levels = {};
		this._tiles = {};
		this._viewReset();
	},

	beforeAdd: function (map) {
		map._addZoomLimit(this);
	},

	onRemove: function (map) {
		L.DomUtil.remove(this._container);
		map._removeZoomLimit(this);
		this._container = null;
		this._tileZoom = null;
		clearTimeout(this._preFetchIdle);
		clearTimeout(this._previewInvalidator);
		clearInterval(this._tilesPreFetcher);

		if (this._selections) {
			this._map.removeLayer(this._selections);
		}
		if (this._cursorMarker) {
			this._cursorMarker.remove();
		}
		if (this._graphicMarker) {
			this._graphicMarker.remove();
		}
		for (var key in this._selectionHandles) {
			this._selectionHandles[key].remove();
		}
	},

	bringToFront: function () {
		if (this._map) {
			L.DomUtil.toFront(this._container);
			this._setAutoZIndex(Math.max);
		}
		return this;
	},

	bringToBack: function () {
		if (this._map) {
			L.DomUtil.toBack(this._container);
			this._setAutoZIndex(Math.min);
		}
		return this;
	},

	getAttribution: function () {
		return this.options.attribution;
	},

	getContainer: function () {
		return this._container;
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;

		if (this._map) {
			this._updateOpacity();
		}
		return this;
	},

	setZIndex: function (zIndex) {
		this.options.zIndex = zIndex;
		this._updateZIndex();

		return this;
	},

	redraw: function () {
		if (this._map) {
			this._removeAllTiles();
			this._update();
		}
		return this;
	},

	getEvents: function () {
		var events = {
			viewreset: this._viewReset,
			movestart: this._moveStart,
			moveend: this._move
		};

		if (!this.options.updateWhenIdle) {
			// update tiles on move, but not more often than once per given interval
			events.move = L.Util.throttle(this._move, this.options.updateInterval, this);
		}

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	},

	createTile: function () {
		return document.createElement('div');
	},

	_updateZIndex: function () {
		if (this._container && this.options.zIndex !== undefined && this.options.zIndex !== null) {
			this._container.style.zIndex = this.options.zIndex;
		}
	},

	_setAutoZIndex: function (compare) {
		// go through all other layers of the same pane, set zIndex to max + 1 (front) or min - 1 (back)

		var layers = this.getPane().children,
		    edgeZIndex = -compare(-Infinity, Infinity); // -Infinity for max, Infinity for min

		for (var i = 0, len = layers.length, zIndex; i < len; i++) {

			zIndex = layers[i].style.zIndex;

			if (layers[i] !== this._container && zIndex) {
				edgeZIndex = compare(edgeZIndex, +zIndex);
			}
		}

		if (isFinite(edgeZIndex)) {
			this.options.zIndex = edgeZIndex + compare(-1, 1);
			this._updateZIndex();
		}
	},

	_updateOpacity: function () {
		var opacity = this.options.opacity;

		// IE doesn't inherit filter opacity properly, so we're forced to set it on tiles
		if (!L.Browser.ielt9 && !this._map._fadeAnimated) {
			L.DomUtil.setOpacity(this._container, opacity);
			return;
		}

		var now = +new Date(),
		    nextFrame = false;

		for (var key in this._tiles) {
			var tile = this._tiles[key];
			if (!tile.current || !tile.loaded || tile.active) { continue; }

			var fade = Math.min(1, (now - tile.loaded) / 200);
			if (fade < 1) {
				L.DomUtil.setOpacity(tile.el, opacity * fade);
				nextFrame = true;
			} else {
				L.DomUtil.setOpacity(tile.el, opacity);
				tile.active = true;
				this._pruneTiles();
			}
		}

		if (nextFrame) {
			L.Util.cancelAnimFrame(this._fadeFrame);
			this._fadeFrame = L.Util.requestAnimFrame(this._updateOpacity, this);
		}
	},

	_initContainer: function () {
		if (this._container) { return; }

		this._container = L.DomUtil.create('div', 'leaflet-layer');
		this._updateZIndex();

		if (this.options.opacity < 1) {
			this._updateOpacity();
		}

		this.getPane().appendChild(this._container);
	},

	_updateLevels: function () {
		var zoom = this._tileZoom,
		    maxZoom = this.options.maxZoom;

		for (var z in this._levels) {
			if (this._levels[z].el.children.length || z === zoom) {
				this._levels[z].el.style.zIndex = maxZoom - Math.abs(zoom - z);
			} else {
				L.DomUtil.remove(this._levels[z].el);
				delete this._levels[z];
			}
		}

		var level = this._levels[zoom],
		    map = this._map;

		if (!level) {
			level = this._levels[zoom] = {};

			level.el = L.DomUtil.create('div', 'leaflet-tile-container leaflet-zoom-animated', this._container);
			level.el.style.zIndex = maxZoom;

			level.origin = map.project(map.unproject(map.getPixelOrigin()), zoom).round();
			level.zoom = zoom;

			this._setZoomTransform(level, map.getCenter(), map.getZoom());

			// force the browser to consider the newly added element for transition
			L.Util.falseFn(level.el.offsetWidth);
		}

		this._level = level;

		return level;
	},

	_pruneTiles: function () {
		var key, tile;

		for (key in this._tiles) {
			tile = this._tiles[key];
			tile.retain = tile.current;
		}

		for (key in this._tiles) {
			tile = this._tiles[key];
			if (tile.current && !tile.active) {
				var coords = tile.coords;
				if (!this._retainParent(coords.x, coords.y, coords.z, coords.part, coords.z - 5)) {
					this._retainChildren(coords.x, coords.y, coords.z, coords.part, coords.z + 2);
				}
			}
		}

		for (key in this._tiles) {
			if (!this._tiles[key].retain) {
				this._removeTile(key);
			}
		}
	},

	_removeAllTiles: function () {
		for (var key in this._tiles) {
			this._removeTile(key);
		}
	},

	_retainParent: function (x, y, z, part, minZoom) {
		var x2 = Math.floor(x / 1.2),
		    y2 = Math.floor(y / 1.2),
		    z2 = z - 1;

		var key = x2 + ':' + y2 + ':' + z2 + ':' + part,
		    tile = this._tiles[key];

		if (tile && tile.active) {
			tile.retain = true;
			return true;

		} else if (tile && tile.loaded) {
			tile.retain = true;
		}

		if (z2 > minZoom) {
			return this._retainParent(x2, y2, z2, part, minZoom);
		}

		return false;
	},

	_retainChildren: function (x, y, z, part, maxZoom) {

		for (var i = 1.2 * x; i < 1.2 * x + 2; i++) {
			for (var j = 1.2 * y; j < 1.2 * y + 2; j++) {

				var key = Math.floor(i) + ':' + Math.floor(j) + ':' +
					(z + 1) + ':' + part,
				    tile = this._tiles[key];

				if (tile && tile.active) {
					tile.retain = true;
					continue;

				} else if (tile && tile.loaded) {
					tile.retain = true;
				}

				if (z + 1 < maxZoom) {
					this._retainChildren(i, j, z + 1, part, maxZoom);
				}
			}
		}
	},

	_viewReset: function (e) {
		this._reset(this._map.getCenter(), this._map.getZoom(), e && e.hard);
	},

	_animateZoom: function (e) {
		this._reset(e.center, e.zoom, false, true, e.noUpdate);
	},

	_reset: function (center, zoom, hard, noPrune, noUpdate) {
		var tileZoom = Math.round(zoom),
		    tileZoomChanged = this._tileZoom !== tileZoom;

		if (!noUpdate && (hard || tileZoomChanged)) {

			if (this._abortLoading) {
				this._abortLoading();
			}

			this._tileZoom = tileZoom;
			if (tileZoomChanged) {
				this._updateTileTwips();
				this._updateMaxBounds();
			}
			this._updateLevels();
			this._resetGrid();

			if (!L.Browser.mobileWebkit) {
				this._update(center, tileZoom);
			}

			if (!noPrune) {
				this._pruneTiles();
			}
		}

		this._setZoomTransforms(center, zoom);
	},

	_updateTileTwips: function () {
		// smaller zoom = zoom in
		var factor = Math.pow(1.2, (this._map.options.zoom - this._tileZoom));
		this._tileWidthTwips = Math.round(this.options.tileWidthTwips * factor);
		this._tileHeightTwips = Math.round(this.options.tileHeightTwips * factor);
	},

	_updateMaxBounds: function (sizeChanged, extraSize, options) {
		if (this._docWidthTwips === undefined || this._docHeightTwips === undefined) {
			return;
		}
		var docPixelLimits = new L.Point(this._docWidthTwips / this.options.tileWidthTwips,
			this._docHeightTwips / this.options.tileHeightTwips);
		docPixelLimits = extraSize ? docPixelLimits.multiplyBy(this._tileSize).add(extraSize) :
			docPixelLimits.multiplyBy(this._tileSize);

		var scale = this._map.getZoomScale(this._map.getZoom(), 10);
		var topLeft = new L.Point(0, 0);
		topLeft = this._map.unproject(topLeft.multiplyBy(scale));
		var bottomRight = new L.Point(docPixelLimits.x, docPixelLimits.y);
		bottomRight = this._map.unproject(bottomRight.multiplyBy(scale));

		if (this._documentInfo === '' || sizeChanged) {
			// we just got the first status so we need to center the document
			this._map.setMaxBounds(new L.LatLngBounds(topLeft, bottomRight), options);
		}

		var scrollPixelLimits = new L.Point(this._docWidthTwips / this._tileWidthTwips,
			this._docHeightTwips / this._tileHeightTwips);
		scrollPixelLimits = extraSize ? scrollPixelLimits.multiplyBy(this._tileSize).add(extraSize.multiplyBy(scale)) :
			scrollPixelLimits.multiplyBy(this._tileSize);
		this._docPixelSize = {x: scrollPixelLimits.x, y: scrollPixelLimits.y};
		this._map.fire('docsize', {x: scrollPixelLimits.x, y: scrollPixelLimits.y});
	},

	_checkSpreadSheetBounds: function (newZoom) {
		// for spreadsheets, when the document is smaller than the viewing area
		// we want it to be glued to the row/column headers instead of being centered
		// In the future we probably want to remove this and set the bonds only on the
		// left/upper side of the spreadsheet so that we can have an 'infinite' number of
		// cells downwards and to the right, like we have on desktop
		var viewSize = this._map.getSize();
		var scale = this._map.getZoomScale(newZoom);
		var width = this._docWidthTwips / this._tileWidthTwips * this._tileSize * scale;
		var height = this._docHeightTwips / this._tileHeightTwips * this._tileSize * scale;
		if (width < viewSize.x || height < viewSize.y) {
			// if after zoomimg the document becomes smaller than the viewing area
			width = Math.max(width, viewSize.x);
			height = Math.max(height, viewSize.y);
			if (!this._map.options._origMaxBounds) {
				this._map.options._origMaxBounds = this._map.options.maxBounds;
			}
			scale = this._map.options.crs.scale(1);
			this._map.setMaxBounds(new L.LatLngBounds(
					this._map.unproject(new L.Point(0, 0)),
					this._map.unproject(new L.Point(width * scale, height * scale))));
		}
		else if (this._map.options._origMaxBounds) {
			// if after zoomimg the document becomes larger than the viewing area
			// we need to restore the inital bounds
			this._map.setMaxBounds(this._map.options._origMaxBounds);
			this._map.options._origMaxBounds = null;
		}
	},

	_updateScrollOffset: function () {
		var centerPixel = this._map.project(this._map.getCenter());
		var newScrollPos = centerPixel.subtract(this._map.getSize().divideBy(2));
		var x = Math.round(newScrollPos.x < 0 ? 0 : newScrollPos.x);
		var y = Math.round(newScrollPos.y < 0 ? 0 : newScrollPos.y);
		this._map.fire('updatescrolloffset', {x: x, y: y});
	},

	_setZoomTransforms: function (center, zoom) {
		for (var i in this._levels) {
			this._setZoomTransform(this._levels[i], center, zoom);
		}
	},

	_setZoomTransform: function (level, center, zoom) {
		var scale = this._map.getZoomScale(zoom, level.zoom),
		    translate = level.origin.multiplyBy(scale)
		        .subtract(this._map._getNewPixelOrigin(center, zoom)).round();

		L.DomUtil.setTransform(level.el, translate, scale);
	},

	_resetGrid: function () {
		var map = this._map,
		    crs = map.options.crs,
		    tileSize = this._tileSize = this._getTileSize(),
		    tileZoom = this._tileZoom;
		if (this._tileWidthTwips === undefined) {
			this._tileWidthTwips = this.options.tileWidthTwips;
		}
		if (this._tileHeightTwips === undefined) {
			this._tileHeightTwips = this.options.tileHeightTwips;
		}

		var bounds = this._map.getPixelWorldBounds(this._tileZoom);
		if (bounds) {
			this._globalTileRange = this._pxBoundsToTileRange(bounds);
		}

		this._wrapX = crs.wrapLng && [
			Math.floor(map.project([0, crs.wrapLng[0]], tileZoom).x / tileSize),
			Math.ceil(map.project([0, crs.wrapLng[1]], tileZoom).x / tileSize)
		];
		this._wrapY = crs.wrapLat && [
			Math.floor(map.project([crs.wrapLat[0], 0], tileZoom).y / tileSize),
			Math.ceil(map.project([crs.wrapLat[1], 0], tileZoom).y / tileSize)
		];
	},

	_getTileSize: function () {
		return this.options.tileSize;
	},

	_moveStart: function () {
		this._resetPreFetching();
	},

	_move: function () {
		this._update();
		this._resetPreFetching(true);
		this._onCurrentPageUpdate();
	},

	_update: function (center, zoom) {
		var map = this._map;
		if (!map || this._documentInfo === '') {
			return;
		}

		// TODO move to reset
		// var zoom = this._map.getZoom();

		// if (zoom > this.options.maxZoom ||
		//     zoom < this.options.minZoom) { return; }

		if (center === undefined) { center = map.getCenter(); }
		if (zoom === undefined) { zoom = Math.round(map.getZoom()); }

		var pixelBounds = map.getPixelBounds(center, zoom),
		    tileRange = this._pxBoundsToTileRange(pixelBounds),
		    queue = [];

		for (var key in this._tiles) {
			if (this._keyToTileCoords(key).z !== zoom ||
					this._keyToTileCoords(key).part !== this._selectedPart) {
				this._tiles[key].current = false;
			}
		}

		// if there is no exiting tile in the current view
		var newView = true;
		// create a queue of coordinates to load tiles from
		for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
			for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
				var coords = new L.Point(i, j);
				coords.z = zoom;
				coords.part = this._selectedPart;

				if (!this._isValidTile(coords)) { continue; }

				key = this._tileCoordsToKey(coords);
				var tile = this._tiles[key];
				if (tile) {
					tile.current = true;
					newView = false;
				} else {
					queue.push(coords);
				}
			}
		}

		if (queue.length !== 0) {
			if (newView) {
				// we know that a new set of tiles that cover the whole view has been requested
				// so we're able to cancel the previous requests that are being processed
				this._map._socket.sendMessage('canceltiles');
				for (key in this._tiles) {
					if (!this._tiles[key].loaded) {
						L.DomUtil.remove(this._tiles[key].el);
						delete this._tiles[key];
						if (this._debug) {
							this._debugCancelledTiles++;
							this._debugShowTileData();
						}
					}
				}
				this._emptyTilesCount = 0;
			}

			// if its the first batch of tiles to load
			if (this._noTilesToLoad()) {
				this.fire('loading');
			}

			// create DOM fragment to append tiles in one batch
			var fragment = document.createDocumentFragment();
			this._addTiles(queue, fragment);
			this._level.el.appendChild(fragment);
		}
	},

	_updateOnChangePart: function () {
		var map = this._map;
		if (!map || this._documentInfo === '') {
			return;
		}
		var key, coords, tile;
		var center = map.getCenter();
		var zoom = Math.round(map.getZoom());

		var pixelBounds = map.getPixelBounds(center, zoom),
		    tileRange = this._pxBoundsToTileRange(pixelBounds),
		    queue = [];

		for (key in this._tiles) {
			if (this._keyToTileCoords(key).z !== zoom ||
					this._keyToTileCoords(key).part !== this._selectedPart) {
				this._tiles[key].current = false;
			}
		}

		// if there is no exiting tile in the current view
		var newView = true;
		// create a queue of coordinates to load tiles from
		for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
			for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
				coords = new L.Point(i, j);
				coords.z = zoom;
				coords.part = this._selectedPart;

				if (!this._isValidTile(coords)) { continue; }

				key = this._tileCoordsToKey(coords);
				tile = this._tiles[key];
				if (tile) {
					tile.current = true;
					newView = false;
				} else {
					queue.push(coords);
				}
			}
		}

		if (queue.length !== 0) {
			if (newView) {
				// we know that a new set of tiles that cover the whole view has been requested
				// so we're able to cancel the previous requests that are being processed
				this._map._socket.sendMessage('canceltiles');
				for (key in this._tiles) {
					tile = this._tiles[key];
					if (!tile.loaded) {
						L.DomUtil.remove(tile.el);
						delete this._tiles[key];
						if (this._debug && this._debugDataCancelledTiles) {
							this._debugCancelledTiles++;
							this._debugDataCancelledTiles.setPrefix('Cancelled tiles: ' + this._debugCancelledTiles);
						}
					}
				}
				this._emptyTilesCount = 0;
			}

			// if its the first batch of tiles to load
			if (this._noTilesToLoad()) {
				this.fire('loading');
			}

			// create DOM fragment to append tiles in one batch
			var fragment = document.createDocumentFragment();
			var tilePositionsX = '';
			var tilePositionsY = '';

			for (i = 0; i < queue.length; i++) {
				coords = queue[i];
				var tilePos = this._getTilePos(coords);
				key = this._tileCoordsToKey(coords);

				if (coords.part === this._selectedPart) {
					tile = this.createTile(this._wrapCoords(coords), L.bind(this._tileReady, this, coords));

					this._initTile(tile);

					// if createTile is defined with a second argument ("done" callback),
					// we know that tile is async and will be ready later; otherwise
					if (this.createTile.length < 2) {
						// mark tile as ready, but delay one frame for opacity animation to happen
						setTimeout(L.bind(this._tileReady, this, coords, null, tile), 0);
					}

					// we prefer top/left over translate3d so that we don't create a HW-accelerated layer from each tile
					// which is slow, and it also fixes gaps between tiles in Safari
					L.DomUtil.setPosition(tile, tilePos, true);

					// save tile in cache
					this._tiles[key] = {
						el: tile,
						coords: coords,
						current: true
					};

					fragment.appendChild(tile);

					this.fire('tileloadstart', {
						tile: tile,
						coords: coords
					});
				}
				if (!this._tileCache[key]) {
					var twips = this._coordsToTwips(coords);
					if (tilePositionsX !== '') {
						tilePositionsX += ',';
					}
					tilePositionsX += twips.x;
					if (tilePositionsY !== '') {
						tilePositionsY += ',';
					}
					tilePositionsY += twips.y;
				}
				else {
					tile.src = this._tileCache[key];
				}
			}

			if (tilePositionsX !== '' && tilePositionsY !== '') {
				var message = 'tilecombine ' +
					'part=' + this._selectedPart + ' ' +
					'width=' + this._tileWidthPx + ' ' +
					'height=' + this._tileHeightPx + ' ' +
					'tileposx=' + tilePositionsX + ' ' +
					'tileposy=' + tilePositionsY + ' ' +
					'tilewidth=' + this._tileWidthTwips + ' ' +
					'tileheight=' + this._tileHeightTwips;

				this._map._socket.sendMessage(message, '');
			}

			this._level.el.appendChild(fragment);
		}
	},

	_isValidTile: function (coords) {
		if (coords.x < 0 || coords.y < 0) {
			return false;
		}
		if (coords.x * this._tileWidthTwips >= this._docWidthTwips ||
				coords.y * this._tileHeightTwips >= this._docHeightTwips) {
			return false;
		}
		return true;
	},

	_keyToBounds: function (key) {
		return this._tileCoordsToBounds(this._keyToTileCoords(key));
	},

	// converts tile coordinates to its geographical bounds
	_tileCoordsToBounds: function (coords) {

		var map = this._map,
		    tileSize = this._getTileSize(),

		    nwPoint = coords.multiplyBy(tileSize),
		    sePoint = nwPoint.add([tileSize, tileSize]),

		    nw = map.wrapLatLng(map.unproject(nwPoint, coords.z)),
		    se = map.wrapLatLng(map.unproject(sePoint, coords.z));

		return new L.LatLngBounds(nw, se);
	},

	// converts tile coordinates to key for the tile cache
	_tileCoordsToKey: function (coords) {
		return coords.x + ':' + coords.y + ':' + coords.z + ':' + coords.part;
	},

	// converts tile cache key to coordinates
	_keyToTileCoords: function (key) {
		var k = key.split(':'),
		coords = new L.Point(+k[0], +k[1]);
		coords.z = +k[2];
		coords.part = +k[3];
		return coords;
	},

	_removeTile: function (key) {
		var tile = this._tiles[key];
		if (!tile) { return; }

		// FIXME: this _tileCache is used for prev/next slide; but it is
		// dangerous in connection with typing / invalidation
		if (!(this._tiles[key]._invalidCount > 0)) {
			this._tileCache[key] = tile.el.src;
		}

		if (!tile.loaded && this._emptyTilesCount > 0) {
			this._emptyTilesCount -= 1;
		}
		L.DomUtil.remove(tile.el);
		if (this._debug && this._debugInfo && this._tiles[key]._debugPopup) {
			this._debugInfo.removeLayer(this._tiles[key]._debugPopup);
		}
		delete this._tiles[key];

		this.fire('tileunload', {
			tile: tile.el,
			coords: this._keyToTileCoords(key)
		});
	},

	_initTile: function (tile) {
		L.DomUtil.addClass(tile, 'leaflet-tile');

		tile.style.width = this._tileSize + 'px';
		tile.style.height = this._tileSize + 'px';

		tile.onselectstart = L.Util.falseFn;
		tile.onmousemove = L.Util.falseFn;

		// update opacity on tiles in IE7-8 because of filter inheritance problems
		if (L.Browser.ielt9 && this.options.opacity < 1) {
			L.DomUtil.setOpacity(tile, this.options.opacity);
		}

		// without this hack, tiles disappear after zoom on Chrome for Android
		// https://github.com/Leaflet/Leaflet/issues/2078
		if (L.Browser.android && !L.Browser.android23) {
			tile.style.WebkitBackfaceVisibility = 'hidden';
		}
	},

	_addTiles: function (coordsQueue, fragment) {
		var coords, key;
		// first take care of the DOM
		for (var i = 0; i < coordsQueue.length; i++) {
			coords = coordsQueue[i];

			var tilePos = this._getTilePos(coords);
			key = this._tileCoordsToKey(coords);

			if (coords.part === this._selectedPart) {
				var tile = this.createTile(this._wrapCoords(coords), L.bind(this._tileReady, this, coords));

				this._initTile(tile);

				// if createTile is defined with a second argument ("done" callback),
				// we know that tile is async and will be ready later; otherwise
				if (this.createTile.length < 2) {
					// mark tile as ready, but delay one frame for opacity animation to happen
					setTimeout(L.bind(this._tileReady, this, coords, null, tile), 0);
				}

				// we prefer top/left over translate3d so that we don't create a HW-accelerated layer from each tile
				// which is slow, and it also fixes gaps between tiles in Safari
				L.DomUtil.setPosition(tile, tilePos, true);

				// save tile in cache
				this._tiles[key] = {
					el: tile,
					coords: coords,
					current: true
				};

				fragment.appendChild(tile);

				this.fire('tileloadstart', {
					tile: tile,
					coords: coords
				});
			}

			if (this._tileCache[key]) {
				tile.src = this._tileCache[key];
			}
		}

		// sort the tiles by the rows
		coordsQueue.sort(function(a, b) {
			if (a.y !== b.y) {
				return a.y - b.y;
			} else {
				return a.x - b.x;
			}
		});

		// try group the tiles into rectangular areas
		var rectangles = [];
		while (coordsQueue.length > 0) {
			coords = coordsQueue[0];

			// tiles that do not interest us
			key = this._tileCoordsToKey(coords);
			if (this._tileCache[key] || coords.part !== this._selectedPart) {
				coordsQueue.splice(0, 1);
				continue;
			}

			var rectQueue = [coords];
			var bound = new L.Point(coords.x, coords.y);

			// remove it
			coordsQueue.splice(0, 1);

			// find the close ones
			var rowLocked = false;
			var hasHole = false;
			i = 0;
			while (i < coordsQueue.length) {
				var current = coordsQueue[i];

				// extend the bound vertically if possible (so far it was
				// continous)
				if (!hasHole && (current.y === bound.y + 1)) {
					rowLocked = true;
					++bound.y;
				}

				if (current.y > bound.y) {
					break;
				}

				if (!rowLocked) {
					if (current.y === bound.y && current.x === bound.x + 1) {
						// extend the bound horizontally
						++bound.x;
						rectQueue.push(current);
						coordsQueue.splice(i, 1);
					} else {
						// ignore the rest of the row
						rowLocked = true;
						++i;
					}
				} else if (current.x <= bound.x && current.y <= bound.y) {
					// we are inside the bound
					rectQueue.push(current);
					coordsQueue.splice(i, 1);
				} else {
					// ignore this one, but there still may be other tiles
					hasHole = true;
					++i;
				}
			}

			rectangles.push(rectQueue);
		}

		var twips, msg;
		for (var r = 0; r < rectangles.length; ++r) {
			rectQueue = rectangles[r];

			if (rectQueue.length === 1) {
				// only one tile here
				coords = rectQueue[0];
				key = this._tileCoordsToKey(coords);

				twips = this._coordsToTwips(coords);
				msg = 'tile ' +
					'part=' + coords.part + ' ' +
					'width=' + this._tileWidthPx + ' ' +
					'height=' + this._tileHeightPx + ' ' +
					'tileposx=' + twips.x + ' '	+
					'tileposy=' + twips.y + ' ' +
					'tilewidth=' + this._tileWidthTwips + ' ' +
					'tileheight=' + this._tileHeightTwips;
				this._map._socket.sendMessage(msg, key);
			}
			else {
				// more tiles, use tilecombine
				var tilePositionsX = '';
				var tilePositionsY = '';
				for (i = 0; i < rectQueue.length; i++) {
					coords = rectQueue[i];
					twips = this._coordsToTwips(coords);

					if (tilePositionsX !== '') {
						tilePositionsX += ',';
					}
					tilePositionsX += twips.x;

					if (tilePositionsY !== '') {
						tilePositionsY += ',';
					}
					tilePositionsY += twips.y;
				}

				twips = this._coordsToTwips(coords);
				msg = 'tilecombine ' +
					'part=' + coords.part + ' ' +
					'width=' + this._tileWidthPx + ' ' +
					'height=' + this._tileHeightPx + ' ' +
					'tileposx=' + tilePositionsX + ' '	+
					'tileposy=' + tilePositionsY + ' ' +
					'tilewidth=' + this._tileWidthTwips + ' ' +
					'tileheight=' + this._tileHeightTwips;
				this._map._socket.sendMessage(msg, '');
			}
		}
	},

	_tileReady: function (coords, err, tile) {
		if (!this._map) { return; }

		if (err) {
			this.fire('tileerror', {
				error: err,
				tile: tile,
				coords: coords
			});
		}

		var key = this._tileCoordsToKey(coords);

		tile = this._tiles[key];
		if (!tile) { return; }

		tile.loaded = +new Date();
		if (this._map._fadeAnimated) {
			L.DomUtil.setOpacity(tile.el, 0);
			L.Util.cancelAnimFrame(this._fadeFrame);
			this._fadeFrame = L.Util.requestAnimFrame(this._updateOpacity, this);
		} else {
			tile.active = true;
		}

		L.DomUtil.addClass(tile.el, 'leaflet-tile-loaded');

		if (this._noTilesToLoad()) {
			this.fire('load');
			this._pruneTiles();
		}
	},

	_getTilePos: function (coords) {
		return coords.multiplyBy(this._tileSize).subtract(this._level.origin);
	},

	_wrapCoords: function (coords) {
		var newCoords = new L.Point(
			this._wrapX ? L.Util.wrapNum(coords.x, this._wrapX) : coords.x,
			this._wrapY ? L.Util.wrapNum(coords.y, this._wrapY) : coords.y);
		newCoords.z = coords.z;
		newCoords.part = coords.part;
		return newCoords;
	},

	_pxBoundsToTileRange: function (bounds) {
		return new L.Bounds(
			bounds.min.divideBy(this._tileSize).floor().subtract([1, 1]),
			bounds.max.divideBy(this._tileSize).ceil());
	},

	_twipsToCoords: function (twips) {
		return new L.Point(
				Math.round(twips.x / twips.tileWidth),
				Math.round(twips.y / twips.tileHeight));
	},

	_coordsToTwips: function (coords) {
		return new L.Point(
				coords.x * this._tileWidthTwips,
				coords.y * this._tileHeightTwips);
	},

	_twipsToLatLng: function (twips, zoom) {
		var pixels = new L.Point(
				twips.x / this._tileWidthTwips * this._tileSize,
				twips.y / this._tileHeightTwips * this._tileSize);
		return this._map.unproject(pixels, zoom);
	},

	_latLngToTwips: function (latLng, zoom) {
		var pixels = this._map.project(latLng, zoom);
		return new L.Point(
				Math.round(pixels.x / this._tileSize * this._tileWidthTwips),
				Math.round(pixels.y / this._tileSize * this._tileHeightTwips));
	},

	_twipsToPixels: function (twips) {
		return new L.Point(
				twips.x / this._tileWidthTwips * this._tileSize,
				twips.y / this._tileHeightTwips * this._tileSize);
	},

	_pixelsToTwips: function (pixels) {
		return new L.Point(
				pixels.x * this._tileWidthTwips / this._tileSize,
				pixels.y * this._tileHeightTwips / this._tileSize);
	},

	_twipsRectangleToPixelBounds: function (strRectangle) {
		// TODO use this more
		// strRectangle = x, y, width, height
		var strTwips = strRectangle.match(/\d+/g);
		if (!strTwips) {
			return null;
		}
		var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
		var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
		var bottomRightTwips = topLeftTwips.add(offset);
		return new L.Bounds(
				this._twipsToPixels(topLeftTwips),
				this._twipsToPixels(bottomRightTwips));
	},

	_twipsRectanglesToPixelBounds: function (strRectangles) {
		// used when we have more rectangles
		strRectangles = strRectangles.split(';');
		var boundsList = [];
		for (var i = 0; i < strRectangles.length; i++) {
			var bounds = this._twipsRectangleToPixelBounds(strRectangles[i]);
			if (bounds) {
				boundsList.push(bounds);
			}
		}
		return boundsList;
	},

	_noTilesToLoad: function () {
		for (var key in this._tiles) {
			if (!this._tiles[key].loaded) { return false; }
		}
		return true;
	},

	_preFetchTiles: function () {
		if (this._emptyTilesCount > 0) {
			return;
		}
		var center = this._map.getCenter();
		var zoom = this._map.getZoom();
		var tilesToFetch = 10;
		var maxBorderWidth = 5;

		if (this._map._permission === 'edit') {
			tilesToFetch = 5;
			maxBorderWidth = 3;
		}

		if (!this._preFetchBorder) {
			if (this._selectedPart !== this._preFetchPart) {
				// all tiles from the new part have to be pre-fetched
				var tileBorder = this._preFetchBorder = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
			}
			else {
				var pixelBounds = this._map.getPixelBounds(center, zoom);
				tileBorder = this._pxBoundsToTileRange(pixelBounds);
				this._preFetchBorder = tileBorder;
			}
		}
		else {
			tileBorder = this._preFetchBorder;
		}
		var queue = [],
		    finalQueue = [],
		    visitedTiles = {},
		    borderWidth = 0;
		// don't search on a border wider than 5 tiles because it will freeze the UI

		while ((tileBorder.min.x >= 0 || tileBorder.min.y >= 0 ||
				tileBorder.max.x * this._tileWidthTwips < this._docWidthTwips ||
				 tileBorder.max.y * this._tileHeightTwips < this._docHeightTwips) &&
				tilesToFetch > 0 && borderWidth < maxBorderWidth) {
			// while the bounds do not fully contain the document

			for (var i = tileBorder.min.x; i <= tileBorder.max.x; i++) {
				// tiles below the visible area
				var coords = new L.Point(i, tileBorder.max.y);
				queue.push(coords);
			}
			for (i = tileBorder.min.x; i <= tileBorder.max.x; i++) {
				// tiles above the visible area
				coords = new L.Point(i, tileBorder.min.y);
				queue.push(coords);
			}
			for (i = tileBorder.min.y; i <= tileBorder.max.y; i++) {
				// tiles to the right of the visible area
				coords = new L.Point(tileBorder.max.x, i);
				queue.push(coords);
			}
			for (i = tileBorder.min.y; i <= tileBorder.max.y; i++) {
				// tiles to the left of the visible area
				coords = new L.Point(tileBorder.min.x, i);
				queue.push(coords);
			}

			for (i = 0; i < queue.length && tilesToFetch > 0; i++) {
				coords = queue[i];
				coords.z = zoom;
				coords.part = this._preFetchPart;
				var key = this._tileCoordsToKey(coords);

				if (!this._isValidTile(coords) ||
						this._tiles[key] ||
						this._tileCache[key] ||
						visitedTiles[key]) {
					continue;
				}

				visitedTiles[key] = true;
				finalQueue.push(coords);
				tilesToFetch -= 1;
			}
			if (tilesToFetch === 0) {
				// don't update the border as there are still
				// some tiles to be fetched
				continue;
			}
			if (tileBorder.min.x >= 0) {
				tileBorder.min.x -= 1;
			}
			if (tileBorder.min.y >= 0) {
				tileBorder.min.y -= 1;
			}
			if (tileBorder.max.x * this._tileWidthTwips <= this._docWidthTwips) {
				tileBorder.max.x += 1;
			}
			if (tileBorder.max.y * this._tileHeightTwips <= this._docHeightTwips) {
				tileBorder.max.y += 1;
			}
			borderWidth += 1;
		}

		if (finalQueue.length > 0) {
			var fragment = document.createDocumentFragment();
			this._addTiles(finalQueue, fragment);
			this._level.el.appendChild(fragment);
		}
	},

	_resetPreFetching: function (resetBorder) {
		if (!this._map) {
			return;
		}
		clearInterval(this._tilesPreFetcher);
		clearTimeout(this._preFetchIdle);
		if (resetBorder) {
			this._preFetchBorder = null;
		}
		var interval = 750;
		var idleTime = 5000;
		this._preFetchPart = this._selectedPart;
		this._preFetchIdle = setTimeout(L.bind(function () {
			this._tilesPreFetcher = setInterval(L.bind(this._preFetchTiles, this), interval);
		}, this), idleTime);
	}
});

L.gridLayer = function (options) {
	return new L.GridLayer(options);
};


/* -*- js-indent-level: 8 -*- */
/*
 * L.TileLayer is used for standard xyz-numbered tile layers.
 */

// Implement String::startsWith which is non-portable (Firefox only, it seems)
// See http://stackoverflow.com/questions/646628/how-to-check-if-a-string-startswith-another-string#4579228

/*eslint no-extend-native:0*/
if (typeof String.prototype.startsWith !== 'function') {
	String.prototype.startsWith = function (str) {
		return this.slice(0, str.length) === str;
	};
}

L.Compatibility = {
	clipboardGet: function (event) {
		var text = null;
		if (event.clipboardData) { // Standard
			text = event.clipboardData.getData('text/plain');
		}
		else if (window.clipboardData) { // IE 11
			text = window.clipboardData.getData('Text');
		}
		return text;
	},
	clipboardSet: function (event, text) {
		if (event.clipboardData) { // Standard
			event.clipboardData.setData('text/plain', text);
		}
		else if (window.clipboardData) { // IE 11
			window.clipboardData.setData('Text', text);
		}
	}
};

L.TileLayer = L.GridLayer.extend({

	options: {
		maxZoom: 18,

		subdomains: 'abc',
		errorTileUrl: '',
		zoomOffset: 0,

		maxNativeZoom: null, // Number
		tms: false,
		zoomReverse: false,
		detectRetina: true,
		crossOrigin: false,
		previewInvalidationTimeout: 1000,
		marginX: 10,
		marginY: 10
	},

	initialize: function (url, options) {

		this._url = url;

		options = L.setOptions(this, options);

		this._tileWidthPx = options.tileSize;
		this._tileHeightPx = options.tileSize;

		// detecting retina displays, adjusting tileWidthPx, tileHeightPx and zoom levels
		if (options.docType !== 'spreadsheet' && options.detectRetina && L.Browser.retina && options.maxZoom > 0) {
			this._tileWidthPx *= 2;
			this._tileHeightPx *= 2;
			options.zoomOffset++;

			options.minZoom = Math.max(0, options.minZoom);
			options.maxZoom--;
		}

		if (typeof options.subdomains === 'string') {
			options.subdomains = options.subdomains.split('');
		}

		// for https://github.com/Leaflet/Leaflet/issues/137
		if (!L.Browser.android) {
			this.on('tileunload', this._onTileRemove);
		}
		// text, presentation, spreadsheet, etc
		this._docType = options.docType;
		this._documentInfo = '';
		// Position and size of the visible cursor.
		this._visibleCursor = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		// Cursor overlay is visible or hidden (for blinking).
		this._isCursorOverlayVisible = false;
		// Cursor is visible or hidden (e.g. for graphic selection).
		this._isCursorVisible = true;
		// Original rectangle graphic selection in twips
		this._graphicSelectionTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
		// Rectangle graphic selection
		this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		// Original rectangle of cell cursor in twips
		this._cellCursorTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
		// Rectangle for cell cursor
		this._cellCursor =  L.LatLngBounds.createDefault();
		this._prevCellCursor = L.LatLngBounds.createDefault();
		this._cellCursorOnPgUp = null;
		this._cellCursorOnPgDn = null;

		// Position and size of the selection start (as if there would be a cursor caret there).

		// View cursors with viewId to 'cursor info' mapping
		// Eg: 1: {rectangle: 'x, y, w, h', visible: false}
		this._viewCursors = {};

		// View cell cursors with viewId to 'cursor info' mapping.
		this._cellViewCursors = {};

		// View selection of other views
		this._viewSelections = {};

		// Graphic view selection rectangles
		this._graphicViewMarkers = {};

		this._lastValidPart = -1;
		// Cursor marker
		this._cursorMarker = null;
		// Graphic marker
		this._graphicMarker = null;
		// Selection handle marker
		this._selectionHandles = {};
		['start', 'end'].forEach(L.bind(function (handle) {
			this._selectionHandles[handle] = L.marker(new L.LatLng(0, 0), {
				icon: L.divIcon({
					className: 'leaflet-selection-marker-' + handle,
					iconSize: null
				}),
				draggable: true
			});
		}, this));

		this._emptyTilesCount = 0;
		this._msgQueue = [];
		this._toolbarCommandValues = {};
		this._previewInvalidations = [];
		this._clientZoom = 'tilepixelwidth=' + this._tileWidthPx + ' ' +
			'tilepixelheight=' + this._tileHeightPx + ' ' +
			'tiletwipwidth=' + this.options.tileWidthTwips + ' ' +
			'tiletwipheight=' + this.options.tileHeightTwips;

		// Mark visible area as dirty by default.
		this._invalidateClientVisibleArea();
	},

	onAdd: function (map) {
		this._initContainer();
		this._getToolbarCommandsValues();
		this._selections = new L.LayerGroup();
		if (this.options.permission !== 'readonly') {
			map.addLayer(this._selections);
		}

		// This layergroup contains all the layers corresponding to other's view
		this._viewLayerGroup = new L.LayerGroup();
		if (this.options.permission !== 'readonly') {
			map.addLayer(this._viewLayerGroup);
		}

		this._debug = map.options.debug;
		if (this._debug) {
			this._debugInit();
		}

		this._searchResultsLayer = new L.LayerGroup();
		map.addLayer(this._searchResultsLayer);

		this._levels = {};
		this._tiles = {};
		this._tileCache = {};
		this._map._socket.sendMessage('commandvalues command=.uno:ViewAnnotations');
		var that = this;
		$.contextMenu({
			selector: '.loleaflet-annotation-menu',
			trigger: 'none',
			className: 'loleaflet-font',
			items: {
				modify: {
					name: _('Modify'),
					callback: function (key, options) {
						that.onAnnotationModify.call(that, options.$trigger.get(0).annotation);
					}
				},
				reply: (this._docType !== 'text') ? undefined : {
					name: _('Reply'),
					callback: function (key, options) {
						that.onAnnotationReply.call(that, options.$trigger.get(0).annotation);
					}
				},
				remove: {
					name: _('Remove'),
					callback: function (key, options) {
						that.onAnnotationRemove.call(that, options.$trigger.get(0).annotation._data.id);
					}
				}
			},
			events: {
				show: function (options) {
					options.$trigger.get(0).annotation._contextMenu = true;
				},
				hide: function (options) {
					options.$trigger.get(0).annotation._contextMenu = false;
				}
			}
		});
		$.contextMenu({
			selector: '.loleaflet-annotation-menu-redline',
			trigger: 'none',
			className: 'loleaflet-font',
			items: {
				modify: {
					name: _('Comment'),
					callback: function (key, options) {
						that.onAnnotationModify.call(that, options.$trigger.get(0).annotation);
					}
				}
			},
			events: {
				show: function (options) {
					options.$trigger.get(0).annotation._contextMenu = true;
				},
				hide: function (options) {
					options.$trigger.get(0).annotation._contextMenu = false;
				}
			}
		});
		this._map._socket.sendMessage('commandvalues command=.uno:AcceptTrackedChanges');

		map._fadeAnimated = false;
		this._viewReset();
		map.on('drag resize zoomend', this._updateScrollOffset, this);

		map.on('copy', this._onCopy, this);
		map.on('cut', this._onCut, this);
		map.on('paste', this._onPaste, this);
		map.on('dragover', this._onDragOver, this);
		map.on('drop', this._onDrop, this);

		map.on('zoomend', this._onUpdateCursor, this);
		if (this._docType === 'spreadsheet') {
			map.on('zoomend', this._onCellCursorShift, this);
		}
		map.on('zoomend', this._updateClientZoom, this);
		map.on('zoomend', L.bind(this.eachView, this, this._viewCursors, this._onUpdateViewCursor, this, false));
		map.on('resize zoomend', this._invalidateClientVisibleArea, this);
		map.on('dragstart', this._onDragStart, this);
		map.on('requestloksession', this._onRequestLOKSession, this);
		map.on('error', this._mapOnError, this);
		if (map.options.autoFitWidth !== false) {
			map.on('resize', this._fitWidthZoom, this);
		}
		// Retrieve the initial cell cursor position (as LOK only sends us an
		// updated cell cursor when the selected cell is changed and not the initial
		// cell).
		map.on('statusindicator',
			function (e) {
				if (e.statusType === 'alltilesloaded' && this._docType === 'spreadsheet') {
					this._onCellCursorShift(true);
				}
			},
		this);

		map.on('updatepermission', function(e) {
			if (e.perm !== 'edit') {
				this._clearSelections();
			}
		}, this);

		for (var key in this._selectionHandles) {
			this._selectionHandles[key].on('drag dragend', this._onSelectionHandleDrag, this);
		}
		this._textArea = map._textArea;
		this._textArea.focus();

		map.setPermission(this.options.permission);

		map.fire('statusindicator', {statusType: 'loleafletloaded'});
	},

	getEvents: function () {
		var events = {
			viewreset: this._viewReset,
			movestart: this._moveStart,
			moveend: this._move
		};

		if (!this.options.updateWhenIdle) {
			// update tiles on move, but not more often than once per given interval
			events.move = L.Util.throttle(this._move, this.options.updateInterval, this);
		}

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	},

	registerExportFormat: function(label, format) {
		if (!this._exportFormats) {
			this._exportFormats = [];
		}

		this._exportFormats.push({label: label, format: format});
	},

	setUrl: function (url, noRedraw) {
		this._url = url;

		if (!noRedraw) {
			this.redraw();
		}
		return this;
	},

	createTile: function (coords, done) {
		var tile = document.createElement('img');

		tile.onload = L.bind(this._tileOnLoad, this, done, tile);
		tile.onerror = L.bind(this._tileOnError, this, done, tile);

		if (this.options.crossOrigin) {
			tile.crossOrigin = '';
		}

		/*
		 Alt tag is set to empty string to keep screen readers from reading URL and for compliance reasons
		 http://www.w3.org/TR/WCAG20-TECHS/H67
		*/
		tile.alt = '';
		this._emptyTilesCount += 1;
		return tile;
	},

	_getToolbarCommandsValues: function() {
		for (var i = 0; i < this._map.unoToolbarCommands.length; i++) {
			var command = this._map.unoToolbarCommands[i];
			this._map._socket.sendMessage('commandvalues command=' + command);
		}
	},

	_onMessage: function (textMsg, img) {
		if (textMsg.startsWith('commandvalues:')) {
			this._onCommandValuesMsg(textMsg);
		}
		else if (textMsg.startsWith('cursorvisible:')) {
			this._onCursorVisibleMsg(textMsg);
		}
		else if (textMsg.startsWith('downloadas:')) {
			this._onDownloadAsMsg(textMsg);
		}
		else if (textMsg.startsWith('error:')) {
			this._onErrorMsg(textMsg);
		}
		else if (textMsg.startsWith('getchildid:')) {
			this._onGetChildIdMsg(textMsg);
		}
		else if (textMsg.startsWith('graphicselection:')) {
			this._onGraphicSelectionMsg(textMsg);
		}
		else if (textMsg.startsWith('cellcursor:')) {
			this._onCellCursorMsg(textMsg);
		}
		else if (textMsg.startsWith('celladdress:')) {
			this._onCellAddressMsg(textMsg);
		}
		else if (textMsg.startsWith('cellformula:')) {
			this._onCellFormulaMsg(textMsg);
		}
		else if (textMsg.startsWith('hyperlinkclicked:')) {
			this._onHyperlinkClickedMsg(textMsg);
		}
		else if (textMsg.startsWith('invalidatecursor:')) {
			this._onInvalidateCursorMsg(textMsg);
		}
		else if (textMsg.startsWith('invalidatetiles:')) {
			var payload = textMsg.substring('invalidatetiles:'.length + 1);
			if (!payload.startsWith('EMPTY')) {
				this._onInvalidateTilesMsg(textMsg);
			}
			else {
				var msg = 'invalidatetiles: ';
				if (this._docType === 'text') {
					msg += 'part=0 ';
				} else {
					var partNumber = parseInt(payload.substring('EMPTY'.length + 1));
					msg += 'part=' + (isNaN(partNumber) ? this._selectedPart : partNumber) + ' ';
				}
				msg += 'x=0 y=0 ';
				msg += 'width=' + this._docWidthTwips + ' ';
				msg += 'height=' + this._docHeightTwips;
				this._onInvalidateTilesMsg(msg);
			}
		}
		else if (textMsg.startsWith('mousepointer:')) {
			this._onMousePointerMsg(textMsg);
		}
		else if (textMsg.startsWith('renderfont:')) {
			this._onRenderFontMsg(textMsg, img);
		}
		else if (textMsg.startsWith('searchnotfound:')) {
			this._onSearchNotFoundMsg(textMsg);
		}
		else if (textMsg.startsWith('searchresultselection:')) {
			this._onSearchResultSelection(textMsg);
		}
		else if (textMsg.startsWith('setpart:')) {
			this._onSetPartMsg(textMsg);
		}
		else if (textMsg.startsWith('statechanged:')) {
			this._onStateChangedMsg(textMsg);
		}
		else if (textMsg.startsWith('status:')) {
			this._onStatusMsg(textMsg);
		}
		else if (textMsg.startsWith('textselection:')) {
			this._onTextSelectionMsg(textMsg);
		}
		else if (textMsg.startsWith('textselectioncontent:')) {
			this._onTextSelectionContentMsg(textMsg);
		}
		else if (textMsg.startsWith('textselectionend:')) {
			this._onTextSelectionEndMsg(textMsg);
		}
		else if (textMsg.startsWith('textselectionstart:')) {
			this._onTextSelectionStartMsg(textMsg);
		}
		else if (textMsg.startsWith('tile:')) {
			this._onTileMsg(textMsg, img);
		}
		else if (textMsg.startsWith('unocommandresult:')) {
			this._onUnoCommandResultMsg(textMsg);
		}
		else if (textMsg.startsWith('contextmenu:')) {
			this._onContextMenuMsg(textMsg);
		}
		else if (textMsg.startsWith('invalidateviewcursor:')) {
			this._onInvalidateViewCursorMsg(textMsg);
		}
		else if (textMsg.startsWith('viewcursorvisible:')) {
			this._onViewCursorVisibleMsg(textMsg);
		}
		else if (textMsg.startsWith('cellviewcursor:')) {
			this._onCellViewCursorMsg(textMsg);
		}
		else if (textMsg.startsWith('viewinfo:')) {
			this._onViewInfoMsg(textMsg);
		}
		else if (textMsg.startsWith('textviewselection:')) {
			this._onTextViewSelectionMsg(textMsg);
		}
		else if (textMsg.startsWith('graphicviewselection:')) {
			this._onGraphicViewSelectionMsg(textMsg);
		}
	},

	toggleTileDebugMode: function() {
		this._invalidateClientVisibleArea();
		this._debug = !this._debug;
		if (!this._debug) {
			map.removeLayer(this._debugInfo);
			map.removeLayer(this._debugInfo2);
			$('.leaflet-control-layers-expanded').css('display', 'none');
		} else {
			if (this._debugInfo) {
				map.addLayer(this._debugInfo);
				map.addLayer(this._debugInfo2);
				$('.leaflet-control-layers-expanded').css('display', 'block');
			}
			this._debugInit();
		}
		this._onMessage('invalidatetiles: EMPTY', null);
	},

	_onCommandValuesMsg: function (textMsg) {
		var jsonIdx = textMsg.indexOf('{');
		if (jsonIdx === -1) {
			return;
		}
		var obj = JSON.parse(textMsg.substring(jsonIdx));
		if (obj.commandName === '.uno:DocumentRepair') {
			this._onDocumentRepair(obj);
		}
		else if (obj.commandName === '.uno:CellCursor') {
			this._onCellCursorMsg(obj.commandValues);
		}
		else if (this._map.unoToolbarCommands.indexOf(obj.commandName) !== -1) {
			this._toolbarCommandValues[obj.commandName] = obj.commandValues;
			this._map.fire('updatetoolbarcommandvalues', {
				commandName: obj.commandName,
				commandValues: obj.commandValues
			});
		}
		else {
			this._map.fire('commandvalues', {
				commandName: obj.commandName,
				commandValues: obj.commandValues
			});
		}
	},

	_onCellAddressMsg: function (textMsg) {
		var address = textMsg.substring(13);
		this._map.fire('celladdress', {address: address});
	},

	_onCellFormulaMsg: function (textMsg) {
		var formula = textMsg.substring(13);
		this._selectionTextContent = formula;
		this._map.fire('cellformula', {formula: formula});
	},

	_onCursorVisibleMsg: function(textMsg) {
		var command = textMsg.match('cursorvisible: true');
		this._isCursorVisible = command ? true : false;
		this._isCursorOverlayVisible = true;
		this._onUpdateCursor();
	},

	_onDownloadAsMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		var parser = document.createElement('a');
		parser.href = this._map.options.server;
		var url = this._map.options.webserver + '/' + this._map.options.urlPrefix + '/' +
		    encodeURIComponent(this._map.options.doc) + '/' + command.jail + '/' + command.dir + '/' + command.name;

		this._map.hideBusy();
		if (command.id === 'print') {
			if (L.Browser.gecko || L.Browser.edge || this._map.options.print === false) {
				// the print dialog doesn't work well on firefox
				this._map.fire('print', {url: url});
			}
			else {
				this._map.fire('filedownloadready', {url: url});
			}
		}
		else if (command.id === 'slideshow') {
			this._map.fire('slidedownloadready', {url: url});
		}
		else if (command.id === 'export') {
			this._map._fileDownloader.src = url;
		}
	},

	_onErrorMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);

		// let's provide some convenience error codes for the UI
		var errorId = 1; // internal error
		if (command.errorCmd === 'load') {
			errorId = 2; // document cannot be loaded
		}
		else if (command.errorCmd === 'save' || command.errorCmd === 'saveas') {
			errorId = 5; // document cannot be saved
		}

		var errorCode = -1;
		if (command.errorCode !== undefined) {
			errorCode = command.errorCode;
		}

		this._map.fire('error', {cmd: command.errorCmd, kind: command.errorKind, id: errorId, code: errorCode});
	},

	_onGetChildIdMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		this._map.fire('childid', {id: command.id});
	},

	_onGraphicSelectionMsg: function (textMsg) {
		if (textMsg.match('EMPTY')) {
			this._graphicSelectionTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
			this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		}
		else {
			var strTwips = textMsg.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._graphicSelectionTwips = new L.Bounds(topLeftTwips, bottomRightTwips);
			this._graphicSelection = new L.LatLngBounds(
							this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
							this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}

		this._onUpdateGraphicSelection();
	},

	_onGraphicViewSelectionMsg: function (textMsg) {
		textMsg = textMsg.substring('graphicviewselection:'.length + 1);
		var obj = JSON.parse(textMsg);
		var viewId = parseInt(obj.viewId);

		// Ignore if viewid is ours or not in our db
		if (viewId === this._viewId || !this._map._viewInfo[viewId]) {
			return;
		}

		var strTwips = obj.selection.match(/\d+/g);
		this._graphicViewMarkers[viewId] = this._graphicViewMarkers[viewId] || {};
		this._graphicViewMarkers[viewId].part = parseInt(obj.part);
		if (strTwips != null) {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._graphicViewMarkers[viewId].bounds = new L.LatLngBounds(
				this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
				this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}
		else {
			this._graphicViewMarkers[viewId].bounds = L.LatLngBounds.createDefault();
		}

		this._onUpdateGraphicViewSelection(viewId);
	},

	_onCellCursorMsg: function (textMsg) {
		if (!this._cellCursor) {
			this._cellCursor = L.LatLngBounds.createDefault();
		}
		if (!this._prevCellCursor) {
			this._prevCellCursor = L.LatLngBounds.createDefault();
		}
		if (textMsg.match('EMPTY')) {
			this._cellCursorTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
			this._cellCursor = L.LatLngBounds.createDefault();
		}
		else {
			var strTwips = textMsg.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._cellCursorTwips = new L.Bounds(topLeftTwips, bottomRightTwips);
			this._cellCursor = new L.LatLngBounds(
							this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
							this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}

		var horizontalDirection = 0;
		var verticalDirection = 0;
		var sign = function(x) {
			return x > 0 ? 1 : x < 0 ? -1 : x;
		};
		if (!this._isEmptyRectangle(this._prevCellCursor) && !this._isEmptyRectangle(this._cellCursor)) {
			horizontalDirection = sign(this._cellCursor.getWest() - this._prevCellCursor.getWest());
			verticalDirection = sign(this._cellCursor.getNorth() - this._prevCellCursor.getNorth());
		}

		var onPgUpDn = false;
		if (!this._isEmptyRectangle(this._cellCursor) && !this._prevCellCursor.equals(this._cellCursor)) {
			if ((this._cellCursorOnPgUp && this._cellCursorOnPgUp.equals(this._prevCellCursor)) ||
				(this._cellCursorOnPgDn && this._cellCursorOnPgDn.equals(this._prevCellCursor))) {
				onPgUpDn = true;
			}
			this._prevCellCursor = new L.LatLngBounds(this._cellCursor.getSouthWest(), this._cellCursor.getNorthEast());
		}

		this._onUpdateCellCursor(horizontalDirection, verticalDirection, onPgUpDn);
	},

	_onDocumentRepair: function (textMsg) {
		if (!this._docRepair) {
			this._docRepair = L.control.documentRepair();
		}

		if (!this._docRepair.isVisible()) {
			this._docRepair.addTo(this._map);
			this._docRepair.fillActions(textMsg);
			this._map.enable(false);
			this._docRepair.show();
		}
	},

	_onSpecialChar: function(fontList, selectedIndex) {
		if (!this._specialChar) {
			this._specialChar = L.control.characterMap();
		}
		if (!this._specialChar.isVisible()) {
			this._specialChar.addTo(this._map);
			this._specialChar.fillFontNames(fontList, selectedIndex);
			this._map.enable(false);
			this._specialChar.show();
		}
	},

	_onMousePointerMsg: function (textMsg) {
		textMsg = textMsg.substring(14); // "mousepointer: "
		textMsg = L.Cursor.getCustomCursor(textMsg) || textMsg;
		if (this._map._container.style.cursor !== textMsg) {
			this._map._container.style.cursor = textMsg;
		}
	},

	_onHyperlinkClickedMsg: function (textMsg) {
		var link = textMsg.substring(18);
		this._map.fire('hyperlinkclicked', {url: link});
	},

	_onInvalidateCursorMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
		var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
		var bottomRightTwips = topLeftTwips.add(offset);
		this._visibleCursor = new L.LatLngBounds(
						this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
						this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		this._visibleCursorOnLostFocus = this._visibleCursor;
		this._isCursorOverlayVisible = true;
		this._onUpdateCursor();
	},

	_onInvalidateViewCursorMsg: function (textMsg) {
		textMsg = textMsg.substring('invalidateviewcursor:'.length + 1);
		var obj = JSON.parse(textMsg);
		var viewId = parseInt(obj.viewId);

		// Ignore if viewid is same as ours or not in our db
		if (viewId === this._viewId || !this._map._viewInfo[viewId]) {
			return;
		}

		var strTwips = obj.rectangle.match(/\d+/g);
		var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
		var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
		var bottomRightTwips = topLeftTwips.add(offset);

		this._viewCursors[viewId] = this._viewCursors[viewId] || {};
		this._viewCursors[viewId].bounds = new L.LatLngBounds(
			this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
			this._twipsToLatLng(bottomRightTwips, this._map.getZoom())),
		this._viewCursors[viewId].part = parseInt(obj.part);

		// FIXME. Server not sending view visible cursor
		if (typeof this._viewCursors[viewId].visible === 'undefined') {
			this._viewCursors[viewId].visible = true;
		}

		this._onUpdateViewCursor(viewId);
	},

	_onCellViewCursorMsg: function (textMsg) {
		textMsg = textMsg.substring('cellviewcursor:'.length + 1);
		var obj = JSON.parse(textMsg);
		var viewId = parseInt(obj.viewId);

		// Ignore if viewid is same as ours
		if (viewId === this._viewId) {
			return;
		}

		this._cellViewCursors[viewId] = this._cellViewCursors[viewId] || {};
		if (!this._cellViewCursors[viewId].bounds) {
			this._cellViewCursors[viewId].bounds = L.LatLngBounds.createDefault();
		}
		if (obj.rectangle.match('EMPTY')) {
			this._cellViewCursors[viewId].bounds = L.LatLngBounds.createDefault();
		}
		else {
			var strTwips = obj.rectangle.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._cellViewCursors[viewId].bounds = new L.LatLngBounds(
				this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
				this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}

		this._cellViewCursors[viewId].part = parseInt(obj.part);
		this._onUpdateCellViewCursor(viewId);
	},

	_onUpdateCellViewCursor: function (viewId) {
		if (!this._cellViewCursors[viewId] || !this._cellViewCursors[viewId].bounds)
			return;

		var cellViewCursorMarker = this._cellViewCursors[viewId].marker;
		var viewPart = this._cellViewCursors[viewId].part;

		if (!this._isEmptyRectangle(this._cellViewCursors[viewId].bounds) && this._selectedPart === viewPart) {
			if (!cellViewCursorMarker) {
				var backgroundColor = L.LOUtil.rgbToHex(this._map.getViewColor(viewId));
				cellViewCursorMarker = L.rectangle(this._cellViewCursors[viewId].bounds, {fill: false, color: backgroundColor, weight: 2});
				this._cellViewCursors[viewId].marker = cellViewCursorMarker;
				cellViewCursorMarker.bindPopup(this._map.getViewName(viewId), {autoClose: false, autoPan: false, backgroundColor: backgroundColor, color: 'white', closeButton: false});
			}
			else {
				cellViewCursorMarker.setBounds(this._cellViewCursors[viewId].bounds);
			}
			this._viewLayerGroup.addLayer(cellViewCursorMarker);
		}
		else if (cellViewCursorMarker) {
			this._viewLayerGroup.removeLayer(cellViewCursorMarker);
		}
	},

	goToCellViewCursor: function(viewId) {
		if (this._cellViewCursors[viewId] && !this._isEmptyRectangle(this._cellViewCursors[viewId].bounds)) {
			if (!this._map.getBounds().contains(this._cellViewCursors[viewId].bounds)) {
				var mapBounds = this._map.getBounds();
				var scrollX = 0;
				var scrollY = 0;
				var spacingX = Math.abs(this._cellViewCursors[viewId].bounds.getEast() - this._cellViewCursors[viewId].bounds.getWest()) / 4.0;
				var spacingY = Math.abs(this._cellViewCursors[viewId].bounds.getSouth() - this._cellViewCursors[viewId].bounds.getNorth()) / 4.0;
				if (this._cellViewCursors[viewId].bounds.getWest() < mapBounds.getWest()) {
					scrollX = this._cellViewCursors[viewId].bounds.getWest() - mapBounds.getWest() - spacingX;
				} else if (this._cellViewCursors[viewId].bounds.getEast() > mapBounds.getEast()) {
					scrollX = this._cellViewCursors[viewId].bounds.getEast() - mapBounds.getEast() + spacingX;
				}

				if (this._cellViewCursors[viewId].bounds.getNorth() > mapBounds.getNorth()) {
					scrollY = this._cellViewCursors[viewId].bounds.getNorth() - mapBounds.getNorth() + spacingY;
				} else if (this._cellViewCursors[viewId].bounds.getSouth() < mapBounds.getSouth()) {
					scrollY = this._cellViewCursors[viewId].bounds.getSouth() - mapBounds.getSouth() - spacingY;
				}

				if (scrollX !== 0 || scrollY !== 0) {
					var newCenter = mapBounds.getCenter();
					newCenter.lat += scrollX;
					newCenter.lat += scrollY;
					var center = this._map.project(newCenter);
					center = center.subtract(this._map.getSize().divideBy(2));
					center.x = Math.round(center.x < 0 ? 0 : center.x);
					center.y = Math.round(center.y < 0 ? 0 : center.y);
					this._map.fire('scrollto', {x: center.x, y: center.y});
				}
			}

			var backgroundColor = L.LOUtil.rgbToHex(this._map.getViewColor(viewId));
			this._cellViewCursors[viewId].marker.bindPopup(this._map.getViewName(viewId), {autoClose: false, autoPan: false, backgroundColor: backgroundColor, color: 'white', closeButton: false});
		}
	},

	_onViewCursorVisibleMsg: function(textMsg) {
		textMsg = textMsg.substring('viewcursorvisible:'.length + 1);
		var obj = JSON.parse(textMsg);
		var viewId = parseInt(obj.viewId);

		// Ignore if viewid is same as ours or not in our db
		if (viewId === this._viewId || !this._map._viewInfo[viewId]) {
			return;
		}

		if (typeof this._viewCursors[viewId] !== 'undefined') {
			this._viewCursors[viewId].visible = (obj.visible === 'true');
		}

		this._onUpdateViewCursor(viewId);
	},

	_addView: function(viewInfo) {
		if (viewInfo.color === 0 && this._map.getDocType() !== 'text') {
			viewInfo.color = L.LOUtil.getViewIdColor(viewInfo.id);
		}

		this._map.addView(viewInfo);

		//TODO: We can initialize color and other properties here.
		if (typeof this._viewCursors[viewInfo.id] !== 'undefined') {
			this._viewCursors[viewInfo.id] = {};
		}

		this._onUpdateViewCursor(viewInfo.id);
	},

	_removeView: function(viewId) {
		// Remove selection, if any.
		if (this._viewSelections[viewId] && this._viewSelections[viewId].selection) {
			this._viewLayerGroup.removeLayer(this._viewSelections[viewId].selection);
		}

		// Remove the view and update (to refresh as needed).
		if (typeof this._viewCursors[viewId] !== 'undefined') {
			this._viewCursors[viewId].visible = false;
			this._onUpdateViewCursor(viewId);
			delete this._viewCursors[viewId];
		}

		this._map.removeView(viewId);
	},

	removeAllViews: function() {
		for (var viewInfoIdx in this._map._viewInfo) {
			this._removeView(parseInt(viewInfoIdx));
		}
	},

	_onViewInfoMsg: function(textMsg) {
		textMsg = textMsg.substring('viewinfo: '.length);
		var viewInfo = JSON.parse(textMsg);
		this._map.fire('viewinfo', viewInfo);

		// A new view
		var viewIds = [];
		for (var viewInfoIdx in viewInfo) {
			if (!(parseInt(viewInfo[viewInfoIdx].id) in this._map._viewInfo)) {
				this._addView(viewInfo[viewInfoIdx]);
			}
			viewIds.push(viewInfo[viewInfoIdx].id);
		}

		// Check if any view is deleted
		for (viewInfoIdx in this._map._viewInfo) {
			if (viewIds.indexOf(parseInt(viewInfoIdx)) === -1) {
				this._removeView(parseInt(viewInfoIdx));
			}
		}
	},

	_onRenderFontMsg: function (textMsg, img) {
		var command = this._map._socket.parseServerCmd(textMsg);
		this._map.fire('renderfont', {
			font: command.font,
			char: command.char,
			img: img
		});
	},

	_onSearchNotFoundMsg: function (textMsg) {
		this._clearSearchResults();
		this._searchRequested = false;
		var originalPhrase = textMsg.substring(16);
		this._map.fire('search', {originalPhrase: originalPhrase, count: 0});
	},

	_onSearchResultSelection: function (textMsg) {
		this._searchRequested = false;
		textMsg = textMsg.substring(23);
		var obj = JSON.parse(textMsg);
		var originalPhrase = obj.searchString;
		var count = obj.searchResultSelection.length;
		var highlightAll = obj.highlightAll;
		var results = [];
		for (var i = 0; i < obj.searchResultSelection.length; i++) {
			results.push({
				part: parseInt(obj.searchResultSelection[i].part),
				rectangles: this._twipsRectanglesToPixelBounds(obj.searchResultSelection[i].rectangles),
				twipsRectangles: obj.searchResultSelection[i].rectangles
			});
		}
		// do not cache search results if there is only one result.
		// this way regular searches works fine
		if (count > 1)
		{
			this._clearSearchResults();
			this._searchResults = results;
			this._map.setPart(results[0].part); // go to first result.
		} else if (count === 1) {
			this._lastSearchResult = results[0];
		}
		this._searchTerm = originalPhrase;
		this._map.fire('search', {originalPhrase: originalPhrase, count: count, highlightAll: highlightAll, results: results});
	},

	_clearSearchResults: function() {
		this._lastSearchResult = null;
		this._searchResults = null;
		this._searchTerm = null;
		this._searchResultsLayer.clearLayers();
	},

	_drawSearchResults: function() {
		if (!this._searchResults) {
			return;
		}
		this._searchResultsLayer.clearLayers();
		for (var k = 0; k < this._searchResults.length; k++)
		{
			var result = this._searchResults[k];
			if (result.part === this._selectedPart)
			{
				var _fillColor = '#CCCCCC';
				var strTwips = result.twipsRectangles.match(/\d+/g);
				var rectangles = [];
				for (var i = 0; i < strTwips.length; i += 4) {
					var topLeftTwips = new L.Point(parseInt(strTwips[i]), parseInt(strTwips[i + 1]));
					var offset = new L.Point(parseInt(strTwips[i + 2]), parseInt(strTwips[i + 3]));
					var topRightTwips = topLeftTwips.add(new L.Point(offset.x, 0));
					var bottomLeftTwips = topLeftTwips.add(new L.Point(0, offset.y));
					var bottomRightTwips = topLeftTwips.add(offset);
					rectangles.push([bottomLeftTwips, bottomRightTwips, topLeftTwips, topRightTwips]);
				}
				var polygons = L.PolyUtil.rectanglesToPolygons(rectangles, this);
				var selection = new L.Polygon(polygons, {
					pointerEvents: 'none',
					fillColor: _fillColor,
					fillOpacity: 0.25,
					weight: 2,
					opacity: 0.25});
				this._searchResultsLayer.addLayer(selection);
			}
		}
	},

	_onStateChangedMsg: function (textMsg) {
		textMsg = textMsg.substr(14);
		var index = textMsg.indexOf('=');
		var commandName = index !== -1 ? textMsg.substr(0, index) : '';
		var state = index !== -1 ? textMsg.substr(index + 1) : '';

		this._map.fire('commandstatechanged', {commandName : commandName, state : state});
	},

	_onUnoCommandResultMsg: function (textMsg) {
		textMsg = textMsg.substring(18);
		var obj = JSON.parse(textMsg);
		var commandName = obj.commandName;
		if (obj.success === 'true') {
			var success = true;
		}
		else if (obj.success === 'false') {
			success = false;
		}

		this._map.hideBusy();
		this._map.fire('commandresult', {commandName: commandName, success: success, result: obj.result});

	},

	_onContextMenuMsg: function (textMsg) {
		textMsg = textMsg.substring(13);
		var obj = JSON.parse(textMsg);

		this._map.fire('locontextmenu', obj);
	},

	_onTextSelectionMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		this._selections.clearLayers();
		if (strTwips != null) {
			var rectangles = [];
			for (var i = 0; i < strTwips.length; i += 4) {
				var topLeftTwips = new L.Point(parseInt(strTwips[i]), parseInt(strTwips[i + 1]));
				var offset = new L.Point(parseInt(strTwips[i + 2]), parseInt(strTwips[i + 3]));
				var topRightTwips = topLeftTwips.add(new L.Point(offset.x, 0));
				var bottomLeftTwips = topLeftTwips.add(new L.Point(0, offset.y));
				var bottomRightTwips = topLeftTwips.add(offset);
				rectangles.push([bottomLeftTwips, bottomRightTwips, topLeftTwips, topRightTwips]);
			}

			var polygons = L.PolyUtil.rectanglesToPolygons(rectangles, this);
			var selection = new L.Polygon(polygons, {
				pointerEvents: 'none',
				fillColor: '#43ACE8',
				fillOpacity: 0.25,
				weight: 2,
				opacity: 0.25});
			this._selections.addLayer(selection);
			if (this._selectionContentRequest) {
				clearTimeout(this._selectionContentRequest);
			}
			this._selectionContentRequest = setTimeout(L.bind(function () {
				this._map._socket.sendMessage('gettextselection mimetype=text/plain;charset=utf-8');}, this), 100);
		}
		this._onUpdateTextSelection();
	},

	_onTextViewSelectionMsg: function (textMsg) {
		textMsg = textMsg.substring('textviewselection:'.length + 1);
		var obj = JSON.parse(textMsg);
		var viewId = parseInt(obj.viewId);
		var viewPart = parseInt(obj.part);

		// Ignore if viewid is same as ours or not in our db
		if (viewId === this._viewId || !this._map._viewInfo[viewId]) {
			return;
		}

		var strTwips = obj.selection.match(/\d+/g);
		this._viewSelections[viewId] = this._viewSelections[viewId] || {};
		if (strTwips != null) {
			var rectangles = [];
			for (var i = 0; i < strTwips.length; i += 4) {
				var topLeftTwips = new L.Point(parseInt(strTwips[i]), parseInt(strTwips[i + 1]));
				var offset = new L.Point(parseInt(strTwips[i + 2]), parseInt(strTwips[i + 3]));
				var topRightTwips = topLeftTwips.add(new L.Point(offset.x, 0));
				var bottomLeftTwips = topLeftTwips.add(new L.Point(0, offset.y));
				var bottomRightTwips = topLeftTwips.add(offset);
				rectangles.push([bottomLeftTwips, bottomRightTwips, topLeftTwips, topRightTwips]);
			}

			this._viewSelections[viewId].part = viewPart;
			this._viewSelections[viewId].polygons = L.PolyUtil.rectanglesToPolygons(rectangles, this);
		} else {
			this._viewSelections[viewId].polygons = null;
		}

		this._onUpdateTextViewSelection(viewId);
	},

	_onTextSelectionContentMsg: function (textMsg) {
		this._selectionTextContent = textMsg.substr(22);
	},

	_onTextSelectionEndMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		if (strTwips != null && this._map._permission === 'edit') {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._textSelectionEnd = new L.LatLngBounds(
						this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
						this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}
		else {
			this._textSelectionEnd = null;
		}
	},

	_onTextSelectionStartMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		if (strTwips != null && this._map._permission === 'edit') {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._textSelectionStart = new L.LatLngBounds(
						this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
						this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
		}
		else {
			this._textSelectionStart = null;
		}

	},

	_onTileMsg: function (textMsg, img) {
		var command = this._map._socket.parseServerCmd(textMsg);
		var coords = this._twipsToCoords(command);
		coords.z = command.zoom;
		coords.part = command.part;
		var key = this._tileCoordsToKey(coords);
		var tile = this._tiles[key];
		if (this._debug && tile) {
			if (tile._debugLoadCount) {
				tile._debugLoadCount++;
				this._debugLoadCount++;
			} else {
				tile._debugLoadCount = 1;
				tile._debugInvalidateCount = 1;
			}
			if (!tile._debugPopup) {
				var tileBound = this._keyToBounds(key);
				tile._debugPopup = L.popup({className: 'debug', offset: new L.Point(0, 0), autoPan: false, closeButton: false, closeOnClick: false})
						.setLatLng(new L.LatLng(tileBound.getSouth(), tileBound.getWest() + (tileBound.getEast() - tileBound.getWest())/5));
				this._debugInfo.addLayer(tile._debugPopup);
				if (this._debugTiles[key]) {
					this._debugInfo.removeLayer(this._debugTiles[key]);
				}
				tile._debugTile = L.rectangle(tileBound, {color: 'blue', weight: 1, fillOpacity: 0, pointerEvents: 'none'});
				this._debugTiles[key] = tile._debugTile;
				tile._debugTime = this._debugGetTimeArray();
				this._debugInfo.addLayer(tile._debugTile);
			}
			if (tile._debugTime.date === 0)  {
				tile._debugPopup.setContent('requested: ' + this._tiles[key]._debugInvalidateCount + '<br>received: ' + this._tiles[key]._debugLoadCount);
			} else {
				tile._debugPopup.setContent('requested: ' + this._tiles[key]._debugInvalidateCount + '<br>received: ' + this._tiles[key]._debugLoadCount +
						'<br>' + this._debugSetTimes(tile._debugTime, +new Date() - tile._debugTime.date).replace(/, /g, '<br>'));
			}
			if (tile._debugTile) {
				tile._debugTile.setStyle({fillOpacity: (command.renderid === 'cached') ? 0.1 : 0, fillColor: 'yellow' });
			}
			this._debugShowTileData();
		}
		if (command.id !== undefined) {
			this._map.fire('tilepreview', {
				tile: img,
				id: command.id,
				width: command.width,
				height: command.height,
				part: command.part,
				docType: this._docType
			});
		}
		else if (tile) {
			if (command.hash != undefined) {
				tile.oldhash = command.hash;
			}
			if (this._tiles[key]._invalidCount > 0) {
				this._tiles[key]._invalidCount -= 1;
			}
			if (!tile.loaded) {
				this._emptyTilesCount -= 1;
				if (this._emptyTilesCount === 0) {
					this._map.fire('statusindicator', {statusType: 'alltilesloaded'});
				}
			}
			tile.el.src = img;
		}
		L.Log.log(textMsg, L.INCOMING, key);
	},

	_tileOnLoad: function (done, tile) {
		done(null, tile);
	},

	_tileOnError: function (done, tile, e) {
		var errorUrl = this.options.errorTileUrl;
		if (errorUrl) {
			tile.src = errorUrl;
		}
		done(e, tile);
	},

	_mapOnError: function (e) {
		if (e.msg && this._map._permission === 'edit') {
			this._map.setPermission('view');
		}
	},

	_onTileRemove: function (e) {
		e.tile.onload = null;
	},

	_clearSelections: function () {
		// hide the cursor
		this._isCursorOverlayVisible = false;
		this._onUpdateCursor();
		// hide the text selection
		this._selections.clearLayers();
		// hide the selection handles
		this._onUpdateTextSelection();
		// hide the graphic selection
		this._graphicSelection = null;
		this._onUpdateGraphicSelection();
		this._cellCursor = null;
		this._onUpdateCellCursor();
	},

	_postMouseEvent: function(type, x, y, count, buttons, modifier) {
		if (this._clientZoom) {
			// the zoom level has changed
			this._map._socket.sendMessage('clientzoom ' + this._clientZoom);
			this._clientZoom = null;
		}
		this._map._socket.sendMessage('mouse type=' + type +
				' x=' + x + ' y=' + y + ' count=' + count +
				' buttons=' + buttons + ' modifier=' + modifier);

		if (type === 'buttondown') {
			this._clearSearchResults();
		}
	},

	_postKeyboardEvents: function(type, charcodes, keycodes) {
		// Both are arrays
		if (typeof(charcodes.length) !== 'number' && typeof(keycodes.length) !== 'number')
			return;

		// both have same length
		if (charcodes.length !== keycodes.length)
			return;

		for (var i = 0; i < charcodes.length; i++) {
			this._postKeyboardEvent(type, charcodes[i], keycodes[i]);
		}
	},

	_postKeyboardEvent: function(type, charcode, keycode) {
		if (this._docType === 'spreadsheet' && this._prevCellCursor && type === 'input') {
			if (keycode === 1030) { // PgUp
				if (this._cellCursorOnPgUp) {
					return;
				}
				this._cellCursorOnPgUp = new L.LatLngBounds(this._prevCellCursor.getSouthWest(), this._prevCellCursor.getNorthEast());
			}
			else if (keycode === 1031) { // PgDn
				if (this._cellCursorOnPgDn) {
					return;
				}
				this._cellCursorOnPgDn = new L.LatLngBounds(this._prevCellCursor.getSouthWest(), this._prevCellCursor.getNorthEast());
			}
		}
		if (this._clientZoom) {
			// the zoom level has changed
			this._map._socket.sendMessage('clientzoom ' + this._clientZoom);
			this._clientZoom = null;
		}
		if (this._clientVisibleArea) {
			// Visible area is dirty, update it on the server.
			var visibleArea = this._map._container.getBoundingClientRect();
			var pos = this._pixelsToTwips(new L.Point(visibleArea.left, visibleArea.top));
			var size = this._pixelsToTwips(new L.Point(visibleArea.width, visibleArea.height));
			var payload = 'clientvisiblearea x=' + Math.round(pos.x) + ' y=' + Math.round(pos.y) +
				' width=' + Math.round(size.x) + ' height=' + Math.round(size.y);
			this._map._socket.sendMessage(payload);
			this._clientVisibleArea = false;
		}
		this._map._socket.sendMessage('key type=' + type +
				' char=' + charcode + ' key=' + keycode);
	},

	_postSelectGraphicEvent: function(type, x, y) {
		this._map._socket.sendMessage('selectgraphic type=' + type +
				' x=' + x + ' y=' + y);
	},

	_postSelectTextEvent: function(type, x, y) {
		this._map._socket.sendMessage('selecttext type=' + type +
				' x=' + x + ' y=' + y);
	},

	// Is rRectangle empty?
	_isEmptyRectangle: function (bounds) {
		if (!bounds) {
			return true;
		}
		return bounds.getSouthWest().equals(new L.LatLng(0, 0)) && bounds.getNorthEast().equals(new L.LatLng(0, 0));
	},

	// Update cursor layer (blinking cursor).
	_onUpdateCursor: function (e) {
		var cursorPos = this._visibleCursor.getNorthWest();

		if (!e && !this._map.getBounds().contains(this._visibleCursor) && this._isCursorVisible) {
			var center = this._map.project(cursorPos);
			center = center.subtract(this._map.getSize().divideBy(2));
			center.x = Math.round(center.x < 0 ? 0 : center.x);
			center.y = Math.round(center.y < 0 ? 0 : center.y);

			if (!(this._selectionHandles.start && this._selectionHandles.start.isDragged) &&
			    !(this._selectionHandles.end && this._selectionHandles.end.isDragged)) {
				this._map.fire('scrollto', {x: center.x, y: center.y});
			}
		}

		this._updateCursorAndOverlay();

		this.eachView(this._viewCursors, function (item) {
			var viewCursorMarker = item.marker;
			if (viewCursorMarker) {
				viewCursorMarker.setOpacity(this._map.hasLayer(this._cursorMarker) && this._cursorMarker.getLatLng().equals(viewCursorMarker.getLatLng()) ? 0 : 1);
			}
		}, this, true);
	},

	// enable or disable blinking cursor and  the cursor overlay depending on
	// the state of the document (if the falgs are set)
	_updateCursorAndOverlay: function (update) {
		if (this._map._permission === 'edit'
		&& this._isCursorVisible
		&& this._isCursorOverlayVisible
		&& !this._isEmptyRectangle(this._visibleCursor)) {

			var pixBounds = L.bounds(this._map.latLngToLayerPoint(this._visibleCursor.getSouthWest()),
									 this._map.latLngToLayerPoint(this._visibleCursor.getNorthEast()));

			var cursorPos = this._visibleCursor.getNorthWest();

			if (!this._cursorMarker) {
				this._cursorMarker = L.cursor(cursorPos, pixBounds.getSize().multiplyBy(this._map.getZoomScale(this._map.getZoom())), {blink: true});
			}
			else {
				this._cursorMarker.setLatLng(cursorPos, pixBounds.getSize().multiplyBy(this._map.getZoomScale(this._map.getZoom())));
			}
			this._map.addLayer(this._cursorMarker);
		}
		else if (this._cursorMarker) {
			this._map.removeLayer(this._cursorMarker);
			this._isCursorOverlayVisible = false;
		}
	},

	// Update colored non-blinking view cursor
	_onUpdateViewCursor: function (viewId) {
		if (typeof this._viewCursors[viewId] !== 'object' ||
		    typeof this._viewCursors[viewId].bounds !== 'object') {
			return;
		}

		var pixBounds = L.bounds(this._map.latLngToLayerPoint(this._viewCursors[viewId].bounds.getSouthWest()),
		                         this._map.latLngToLayerPoint(this._viewCursors[viewId].bounds.getNorthEast()));
		var viewCursorPos = this._viewCursors[viewId].bounds.getNorthWest();
		var viewCursorMarker = this._viewCursors[viewId].marker;
		var viewCursorVisible = this._viewCursors[viewId].visible;
		var viewPart = this._viewCursors[viewId].part;

		if (!this._map.isViewReadOnly(viewId) && viewCursorVisible && !this._isEmptyRectangle(this._viewCursors[viewId].bounds) &&
		   (this._docType === 'text' || this._selectedPart === viewPart)) {
			if (!viewCursorMarker) {
				var viewCursorOptions = {
					color: L.LOUtil.rgbToHex(this._map.getViewColor(viewId)),
					blink: false,
					header: true, // we want a 'hat' to our view cursors (which will contain view user names)
					headerTimeout: 3000, // hide after some interval
					zIndex: viewId,
					headerName: this._map.getViewName(viewId)
				};
				viewCursorMarker = L.cursor(viewCursorPos, pixBounds.getSize().multiplyBy(this._map.getZoomScale(this._map.getZoom())), viewCursorOptions);
				this._viewCursors[viewId].marker = viewCursorMarker;
			}
			else {
				viewCursorMarker.setLatLng(viewCursorPos, pixBounds.getSize().multiplyBy(this._map.getZoomScale(this._map.getZoom())));
			}
			viewCursorMarker.setOpacity(this._map.hasLayer(this._cursorMarker) && this._cursorMarker.getLatLng().equals(viewCursorMarker.getLatLng()) ? 0 : 1);
			this._viewLayerGroup.addLayer(viewCursorMarker);
		}
		else if (viewCursorMarker) {
			this._viewLayerGroup.removeLayer(viewCursorMarker);
		}
	},

	goToViewCursor: function(viewId) {
		if (viewId === this._viewId) {
			this._onUpdateCursor();
			return;
		}

		if (this._viewCursors[viewId] && this._viewCursors[viewId].visible && !this._isEmptyRectangle(this._viewCursors[viewId].bounds)) {
			if (!this._map.getBounds().contains(this._viewCursors[viewId].bounds)) {
				var viewCursorPos = this._viewCursors[viewId].bounds.getNorthWest();
				var center = this._map.project(viewCursorPos);
				center = center.subtract(this._map.getSize().divideBy(2));
				center.x = Math.round(center.x < 0 ? 0 : center.x);
				center.y = Math.round(center.y < 0 ? 0 : center.y);

				this._map.fire('scrollto', {x: center.x, y: center.y});
			}

			this._viewCursors[viewId].marker.showCursorHeader();
		}
	},

	_onUpdateTextViewSelection: function (viewId) {
		viewId = parseInt(viewId);
		var viewPolygons = this._viewSelections[viewId].polygons;
		var viewSelection = this._viewSelections[viewId].selection;
		var viewPart = this._viewSelections[viewId].part;

		if (viewPolygons &&
		    (this._docType === 'text' || this._selectedPart === viewPart)) {

			// Reset previous selections
			if (viewSelection) {
				this._viewLayerGroup.removeLayer(viewSelection);
			}

			viewSelection = new L.Polygon(viewPolygons, {
				pointerEvents: 'none',
				fillColor: L.LOUtil.rgbToHex(this._map.getViewColor(viewId)),
				fillOpacity: 0.25,
				weight: 2,
				opacity: 0.25
			});
			this._viewSelections[viewId].selection = viewSelection;
			this._viewLayerGroup.addLayer(viewSelection);
		}
		else if (viewSelection) {
			this._viewLayerGroup.removeLayer(viewSelection);
		}
	},

	_onUpdateGraphicViewSelection: function (viewId) {
		var viewBounds = this._graphicViewMarkers[viewId].bounds;
		var viewMarker = this._graphicViewMarkers[viewId].marker;
		var viewPart = this._graphicViewMarkers[viewId].part;

		if (!this._isEmptyRectangle(viewBounds) &&
		   (this._docType === 'text' || this._selectedPart === viewPart)) {
			if (!viewMarker) {
				var color = L.LOUtil.rgbToHex(this._map.getViewColor(viewId));
				viewMarker = L.rectangle(viewBounds, {
					pointerEvents: 'auto',
					fill: false,
					color: color
				});
				// Disable autoPan, so the graphic view selection doesn't make the view jump to the popup.
				viewMarker.bindPopup(this._map.getViewName(viewId), {autoClose: false, autoPan: false, backgroundColor: color, color: 'white', closeButton: false});
				this._graphicViewMarkers[viewId].marker = viewMarker;
			}
			else {
				viewMarker.setBounds(viewBounds);
			}
			this._viewLayerGroup.addLayer(viewMarker);
		}
		else if (viewMarker) {
			this._viewLayerGroup.removeLayer(viewMarker);
		}
	},

	eachView: function (views, method, context, item) {
		for (var key in views) {
			method.call(context, item ? views[key] : key);
		}
	},

	// Update dragged graphics selection resize.
	_onGraphicEdit: function (e) {
		if (!e.handle) { return; }

		var aPos = this._latLngToTwips(e.handle.getLatLng());
		if (e.type === 'editstart') {
			this._graphicMarker.isDragged = true;
			this._postSelectGraphicEvent('start',
						Math.min(aPos.x, this._graphicSelectionTwips.max.x - 1),
						Math.min(aPos.y, this._graphicSelectionTwips.max.y - 1));
		}
		else if (e.type === 'editend') {
			this._postSelectGraphicEvent('end', aPos.x, aPos.y);
			this._graphicMarker.isDragged = false;
		}
	},

	// Update dragged text selection.
	_onSelectionHandleDrag: function (e) {
		if (e.type === 'drag') {
			e.target.isDragged = true;

			// This is rather hacky, but it seems to be the only way to make the
			// marker follow the mouse cursor if the document is autoscrolled under
			// us. (This can happen when we're changing the selection if the cursor
			// moves somewhere that is considered off screen.)

			// Onscreen position of the cursor, i.e. relative to the browser window
			var boundingrect = e.target._icon.getBoundingClientRect();
			var cursorPos = L.point(boundingrect.left, boundingrect.top);

			var expectedPos = L.point(e.originalEvent.pageX, e.originalEvent.pageY).subtract(e.target.dragging._draggable.startOffset);

			// If the map has been scrolled, but the cursor hasn't been updated yet, then
			// the current mouse position differs.
			if (!expectedPos.equals(cursorPos)) {
				var correction = expectedPos.subtract(cursorPos);

				e.target.dragging._draggable._startPoint = e.target.dragging._draggable._startPoint.add(correction);
				e.target.dragging._draggable._startPos = e.target.dragging._draggable._startPos.add(correction);
				e.target.dragging._draggable._newPos = e.target.dragging._draggable._newPos.add(correction);

				e.target.dragging._draggable._updatePosition();
			}

			var containerPos = new L.Point(expectedPos.x - this._map._container.getBoundingClientRect().left,
				expectedPos.y - this._map._container.getBoundingClientRect().top);

			containerPos = containerPos.add(e.target.dragging._draggable.startOffset);
			this._map.fire('handleautoscroll', {pos: containerPos, map: this._map});
		}
		if (e.type === 'dragend') {
			e.target.isDragged = false;
			this._textArea.focus();
			this._map.fire('scrollvelocity', {vx: 0, vy: 0});
		}

		var aPos = this._latLngToTwips(e.target.getLatLng());

		if (this._selectionHandles.start === e.target) {
			this._postSelectTextEvent('start', aPos.x, aPos.y);
		}
		else if (this._selectionHandles.end === e.target) {
			this._postSelectTextEvent('end', aPos.x, aPos.y);
		}
	},

	// Update group layer selection handler.
	_onUpdateGraphicSelection: function () {
		if (this._graphicSelection && !this._isEmptyRectangle(this._graphicSelection)) {
			if (this._graphicMarker) {
				this._graphicMarker.off('editstart editend', this._onGraphicEdit, this);
				this._map.removeLayer(this._graphicMarker);
			}

			if (this._map._permission !== 'edit') {
				return;
			}

			this._graphicMarker = L.rectangle(this._graphicSelection, {
				pointerEvents: 'none',
				fill: false});
			this._visibleCursor = this._visibleCursorOnLostFocus = this._graphicMarker._bounds;
			if (!this._graphicMarker) {
				this._map.fire('error', {msg: 'Graphic marker initialization', cmd: 'marker', kind: 'failed', id: 1});
				return;
			}

			this._graphicMarker.editing.enable();
			this._graphicMarker.on('editstart editend', this._onGraphicEdit, this);
			this._map.addLayer(this._graphicMarker);
		}
		else if (this._graphicMarker) {
			this._graphicMarker.off('editstart editend', this._onGraphicEdit, this);
			this._map.removeLayer(this._graphicMarker);
			this._graphicMarker.isDragged = false;
		}
	},

	_onUpdateCellCursor: function (horizontalDirection, verticalDirection, onPgUpDn) {
		if (this._cellCursor && !this._isEmptyRectangle(this._cellCursor)) {
			var mapBounds = this._map.getBounds();
			if (!mapBounds.contains(this._cellCursor)) {
				var scrollX = 0, scrollY = 0;
				if (onPgUpDn) {
					var mapHalfHeight = (mapBounds.getNorth() - mapBounds.getSouth()) / 2;
					var cellCursorOnPgUpDn = (this._cellCursorOnPgUp) ? this._cellCursorOnPgUp : this._cellCursorOnPgDn;

					scrollY = this._cellCursor.getNorth() - cellCursorOnPgUpDn.getNorth();
					if (this._cellCursor.getNorth() > mapBounds.getNorth() + scrollY) {
						scrollY = (this._cellCursor.getNorth() - mapBounds.getNorth()) + mapHalfHeight;
					} else if (this._cellCursor.getSouth() < mapBounds.getSouth() + scrollY) {
						scrollY = (this._cellCursor.getNorth() - mapBounds.getNorth()) + mapHalfHeight;
					}
				}
				else if (horizontalDirection !== 0 || verticalDirection != 0) {
					var spacingX = Math.abs(this._cellCursor.getEast() - this._cellCursor.getWest()) / 4.0;
					var spacingY = Math.abs((this._cellCursor.getSouth() - this._cellCursor.getNorth())) / 4.0;

					if (this._cellCursor.getWest() < mapBounds.getWest()) {
						scrollX = this._cellCursor.getWest() - mapBounds.getWest() - spacingX;
					} else if (this._cellCursor.getEast() > mapBounds.getEast()) {
						scrollX = this._cellCursor.getEast() - mapBounds.getEast() + spacingX;
					}
					if (this._cellCursor.getNorth() > mapBounds.getNorth()) {
						scrollY = this._cellCursor.getNorth() - mapBounds.getNorth() + spacingY;
					} else if (this._cellCursor.getSouth() < mapBounds.getSouth()) {
						scrollY = this._cellCursor.getSouth() - mapBounds.getSouth() - spacingY;
					}
				}
				if (scrollX !== 0 || scrollY !== 0) {
					var newCenter = mapBounds.getCenter();
					newCenter.lng += scrollX;
					newCenter.lat += scrollY;
					var center = this._map.project(newCenter);
					center = center.subtract(this._map.getSize().divideBy(2));
					center.x = Math.round(center.x < 0 ? 0 : center.x);
					center.y = Math.round(center.y < 0 ? 0 : center.y);
					this._map.fire('scrollto', {x: center.x, y: center.y});
				}
			}

			if (onPgUpDn) {
				this._cellCursorOnPgUp = null;
				this._cellCursorOnPgDn = null;
			}

			if (this._cellCursorMarker) {
				this._map.removeLayer(this._cellCursorMarker);
			}
			this._cellCursorMarker = L.rectangle(this._cellCursor, {
				pointerEvents: 'none',
				fill: false,
				color: '#000000',
				weight: 2});
			if (!this._cellCursorMarker) {
				this._map.fire('error', {msg: 'Cell Cursor marker initialization', cmd: 'cellCursor', kind: 'failed', id: 1});
				return;
			}
			this._map.addLayer(this._cellCursorMarker);
		}
		else if (this._cellCursorMarker) {
			this._map.removeLayer(this._cellCursorMarker);
		}
	},

	// Update text selection handlers.
	_onUpdateTextSelection: function () {
		var startMarker, endMarker;
		for (var key in this._selectionHandles) {
			if (key === 'start') {
				startMarker = this._selectionHandles[key];
			}
			else if (key === 'end') {
				endMarker = this._selectionHandles[key];
			}
		}

		if (this._selections.getLayers().length !== 0 || startMarker.isDragged || endMarker.isDragged) {
			if (!startMarker || !endMarker ||
					this._isEmptyRectangle(this._textSelectionStart) ||
					this._isEmptyRectangle(this._textSelectionEnd)) {
				return;
			}

			var startPos = this._map.project(this._textSelectionStart.getSouthWest());
			var endPos = this._map.project(this._textSelectionEnd.getSouthWest());
			var startMarkerPos = this._map.project(startMarker.getLatLng());
			if (startMarkerPos.distanceTo(endPos) < startMarkerPos.distanceTo(startPos) && startMarker._icon && endMarker._icon) {
				// if the start marker is actually closer to the end of the selection
				// reverse icons and markers
				L.DomUtil.removeClass(startMarker._icon, 'leaflet-selection-marker-start');
				L.DomUtil.removeClass(endMarker._icon, 'leaflet-selection-marker-end');
				L.DomUtil.addClass(startMarker._icon, 'leaflet-selection-marker-end');
				L.DomUtil.addClass(endMarker._icon, 'leaflet-selection-marker-start');
				var tmp = startMarker;
				startMarker = endMarker;
				endMarker = tmp;
			}
			else if (startMarker._icon && endMarker._icon) {
				// normal markers and normal icons
				L.DomUtil.removeClass(startMarker._icon, 'leaflet-selection-marker-end');
				L.DomUtil.removeClass(endMarker._icon, 'leaflet-selection-marker-start');
				L.DomUtil.addClass(startMarker._icon, 'leaflet-selection-marker-start');
				L.DomUtil.addClass(endMarker._icon, 'leaflet-selection-marker-end');
			}

			if (!startMarker.isDragged) {
				var pos = this._map.project(this._textSelectionStart.getSouthWest());
				pos = pos.subtract(new L.Point(0, 2));
				pos = this._map.unproject(pos);
				startMarker.setLatLng(pos);
				this._map.addLayer(startMarker);
			}

			if (!endMarker.isDragged) {
				pos = this._map.project(this._textSelectionEnd.getSouthEast());
				pos = pos.subtract(new L.Point(0, 2));
				pos = this._map.unproject(pos);
				endMarker.setLatLng(pos);
				this._map.addLayer(endMarker);
			}
		}
		else {
			this._textSelectionStart = null;
			this._textSelectionEnd = null;
			for (key in this._selectionHandles) {
				this._map.removeLayer(this._selectionHandles[key]);
				this._selectionHandles[key].isDragged = false;
			}
		}
	},

	_onCopy: function (e) {
		e = e.originalEvent;
		e.preventDefault();
		if (this._selectionTextContent) {
			L.Compatibility.clipboardSet(e, this._selectionTextContent);

			// remember the copied text, for rich copy/paste inside a document
			this._selectionTextHash = this._selectionTextContent;
		}

		this._map._socket.sendMessage('uno .uno:Copy');
	},

	_onCut: function (e) {
		e = e.originalEvent;
		e.preventDefault();
		if (this._selectionTextContent) {
			L.Compatibility.clipboardSet(e, this._selectionTextContent);

			// remember the copied text, for rich copy/paste inside a document
			this._selectionTextHash = this._selectionTextContent;
		}

		this._map._socket.sendMessage('uno .uno:Cut');
	},

	_onPaste: function (e) {
		e = e.originalEvent;
		e.preventDefault();
		var pasteString = L.Compatibility.clipboardGet(e);
		if (pasteString === 'false' || !pasteString || pasteString === this._selectionTextHash) {
			// If there is nothing to paste in clipboard, no harm in
			// issuing a .uno:Paste in case there is something internally copied in the document
			// or if the content of the clipboard did not change, we surely must do a rich paste
			// instead of a normal paste
			this._map._socket.sendMessage('uno .uno:Paste');
		}
		else {
			this._map._socket.sendMessage('paste mimetype=text/plain;charset=utf-8\n' + pasteString);
		}
	},

	_onDragOver: function (e) {
		e = e.originalEvent;
		e.preventDefault();
	},

	_onDrop: function (e) {
		// Move the cursor, so that the insert position is as close to the drop coordinates as possible.
		var latlng = e.latlng;
		var docLayer = this._map._docLayer;
		var mousePos = docLayer._latLngToTwips(latlng);
		var count = 1;
		var buttons = 1;
		var modifier = this._map.keyboard.modifier;
		this._postMouseEvent('buttondown', mousePos.x, mousePos.y, count, buttons, modifier);
		this._postMouseEvent('buttonup', mousePos.x, mousePos.y, count, buttons, modifier);

		e = e.originalEvent;
		e.preventDefault();

		// handle content
		var types = e.dataTransfer.types;
		var hasHTML = false;
		for (var t = 0; !hasHTML && t < types.length; t++) {
			if (types[t] === 'text/html') {
				hasHTML = true;
			}
		}

		var handled = false;
		for (t = 0; !handled && t < types.length; t++) {
			var type = types[t];
			if (type === 'text/html') {
				this._map._socket.sendMessage('paste mimetype=text/html\n' + e.dataTransfer.getData(type));
				handled = true;
			}
			else if (type === 'text/plain' && !hasHTML) {
				this._map._socket.sendMessage('paste mimetype=text/plain;charset=utf-8\n' + e.dataTransfer.getData(type));
				handled = true;
			}
			else if (type === 'Files') {
				var files = e.dataTransfer.files;
				for (var i = 0; i < files.length; ++i) {
					var file = files[i];
					if (file.type.match(/image.*/)) {
						var reader = new FileReader();
						reader.onload = this._onFileLoadFunc(file);
						reader.readAsArrayBuffer(file);
						handled = true;
					}
				}
			}
		}
	},

	_onFileLoadFunc: function(file) {
		var socket = this._map._socket;
		return function(e) {
			var blob = new Blob(['paste mimetype=' + file.type + '\n', e.target.result]);
			socket.sendMessage(blob);
		};
	},

	_onDragStart: function () {
		this._map.on('moveend', this._updateScrollOffset, this);
	},

	_onRequestLOKSession: function () {
		this._map._socket.sendMessage('requestloksession');
	},

	_fitWidthZoom: function (e, maxZoom) {
		var size = e ? e.newSize : this._map.getSize();
		var widthTwips = size.x * this._map.options.tileWidthTwips / this._tileSize;
		maxZoom = maxZoom ? maxZoom : this._map.getZoom();

		// 'fit width zoom' has no use in spreadsheets, ignore it there
		if (this._docType !== 'spreadsheet') {
			var crsScale = this._map.options.crs.scale(1);
			if (this._docWidthTwips > 0)
			{
				var ratio = widthTwips / this._docWidthTwips;
				var zoom = this._map.getZoom() + Math.floor(Math.log(ratio) / Math.log(crsScale));

				zoom = Math.max(1, zoom);
				zoom = Math.min(maxZoom, zoom);
				this._map.setZoom(zoom, {animate: false});
			}
		}
	},

	_onCurrentPageUpdate: function () {
		var mapCenter = this._map.project(this._map.getCenter());
		if (!this._partPageRectanglesPixels || !(this._currentPage >= 0) || this._currentPage >= this._partPageRectanglesPixels.length ||
				this._partPageRectanglesPixels[this._currentPage].contains(mapCenter)) {
			// page number has not changed
			return;
		}
		for (var i = 0; i < this._partPageRectanglesPixels.length; i++) {
			if (this._partPageRectanglesPixels[i].contains(mapCenter)) {
				this._currentPage = i;
				this._map.fire('pagenumberchanged', {
					currentPage: this._currentPage,
					pages: this._pages,
					docType: this._docType
				});
				return;
			}
		}
	},

	// Cells can change position during changes of zoom level in calc
	// hence we need to request an updated cell cursor position for this level.
	_onCellCursorShift: function (force) {
		if (this._cellCursorMarker || force) {
			this._map._socket.sendMessage('commandvalues command=.uno:CellCursor'
			                     + '?outputHeight=' + this._tileWidthPx
			                     + '&outputWidth=' + this._tileHeightPx
			                     + '&tileHeight=' + this._tileWidthTwips
			                     + '&tileWidth=' + this._tileHeightTwips);
		}
	},

	_invalidatePreviews: function () {
		if (this._map._docPreviews && this._previewInvalidations.length > 0) {
			var toInvalidate = {};
			for (var i = 0; i < this._previewInvalidations.length; i++) {
				var invalidBounds = this._previewInvalidations[i];
				for (var key in this._map._docPreviews) {
					// find preview tiles that need to be updated and add them in a set
					var preview = this._map._docPreviews[key];
					if (preview.index >= 0 && this._docType === 'text') {
						// we have a preview for a page
						if (this._partPageRectanglesTwips.length > preview.index &&
								invalidBounds.intersects(this._partPageRectanglesTwips[preview.index])) {
							toInvalidate[key] = true;
						}
					}
					else if (preview.index >= 0) {
						// we have a preview for a part
						if (preview.index === this._selectedPart ||
								(preview.index === this._prevSelectedPart && this._prevSelectedPartNeedsUpdate)) {
							// if the current part needs its preview updated OR
							// the part has been changed and we need to update the previous part preview
							if (preview.index === this._prevSelectedPart) {
								this._prevSelectedPartNeedsUpdate = false;
							}
							toInvalidate[key] = true;
						}
					}
					else {
						// we have a custom preview
						var bounds = new L.Bounds(
								new L.Point(preview.tilePosX, preview.tilePosY),
								new L.Point(preview.tilePosX + preview.tileWidth, preview.tilePosY + preview.tileHeight));
						if ((preview.part === this._selectedPart ||
								(preview.part === this._prevSelectedPart && this._prevSelectedPartNeedsUpdate)) &&
								invalidBounds.intersects(bounds)) {
							// if the current part needs its preview updated OR
							// the part has been changed and we need to update the previous part preview
							if (preview.index === this._prevSelectedPart) {
								this._prevSelectedPartNeedsUpdate = false;
							}
							toInvalidate[key] = true;
						}

					}
				}

			}

			for (key in toInvalidate) {
				// update invalid preview tiles
				preview = this._map._docPreviews[key];
				if (preview.autoUpdate) {
					if (preview.index >= 0) {
						this._map.getPreview(preview.id, preview.index, preview.maxWidth, preview.maxHeight, {autoUpdate: true, broadcast: true});
					}
					else {
						this._map.getCustomPreview(preview.id, preview.part, preview.width, preview.height, preview.tilePosX,
								preview.tilePosY, preview.tileWidth, preview.tileHeight, {autoUpdate: true});
					}
				}
			}
		}
		this._previewInvalidations = [];
	},

	_updateClientZoom: function () {
		this._clientZoom = 'tilepixelwidth=' + this._tileWidthPx + ' ' +
			'tilepixelheight=' + this._tileHeightPx + ' ' +
			'tiletwipwidth=' + this._tileWidthTwips + ' ' +
			'tiletwipheight=' + this._tileHeightTwips;
	},

	_invalidateClientVisibleArea: function() {
		if (this._debug) {
			this._debugInfo.clearLayers();
			for (var key in this._tiles) {
				this._tiles[key]._debugPopup = null;
				this._tiles[key]._debugTile = null;
			}
		}
		this._clientVisibleArea = true;
	},

	_debugGetTimeArray: function() {
		return {count: 0, ms: 0, best: Number.MAX_SAFE_INTEGER, worst: 0, date: 0};
	},

	_debugShowTileData: function() {
		this._debugData['loadCount'].setPrefix('Total of requested tiles: ' +
				this._debugInvalidateCount + ', received: ' + this._debugLoadCount +
				', cancelled: ' + this._debugCancelledTiles);
	},

	_debugInit: function() {
		this._debugTiles = {};
		this._debugInvalidBounds = {};
		this._debugInvalidBoundsMessage = {};
		this._debugTimeout();
		this._debugId = 0;
		this._debugCancelledTiles = 0;
		this._debugLoadCount = 0;
		this._debugInvalidateCount = 0;
		this._debugRenderCount = 0;
		if (!this._debugData) {
			this._debugData = {};
			this._debugDataNames = ['tileCombine', 'fromKeyInputToInvalidate', 'ping', 'loadCount'];
			for (var i = 0; i < this._debugDataNames.length; i++) {
				this._debugData[this._debugDataNames[i]] = L.control.attribution({prefix: '', position: 'bottomleft'}).addTo(map);
			}
			this._debugInfo = new L.LayerGroup();
			this._debugInfo2 = new L.LayerGroup();
			this._debugAlwaysActive = new L.LayerGroup();
			this._debugTyper = new L.LayerGroup();
			map.addLayer(this._debugInfo);
			map.addLayer(this._debugInfo2);
			var overlayMaps = {
				'Tile overlays': this._debugInfo,
				'Screen overlays': this._debugInfo2,
				'Always active': this._debugAlwaysActive,
				'Typing': this._debugTyper
			};
			L.control.layers({}, overlayMaps, {collapsed: false}).addTo(map);

			this._map.on('layeradd', function(e) {
				if (e.layer === this._debugAlwaysActive) {
					map._debugAlwaysActive = true;
				} else if (e.layer === this._debugTyper) {
					this._debugTypeTimeout();
				} else if (e.layer === this._debugInfo2) {
					for (var i = 0; i < this._debugDataNames.length; i++) {
						this._debugData[this._debugDataNames[i]].addTo(map);
					}
				}
			}, this);
			map.on('layerremove', function(e) {
				if (e.layer === this._debugAlwaysActive) {
					map._debugAlwaysActive = false;
				} else if (e.layer === this._debugTyper) {
					clearTimeout(this._debugTypeTimeoutId);
				} else if (e.layer === this._debugInfo2) {
					for (var i in this._debugData) {
						this._debugData[i].remove();
					}
				}
			}, this);
		}
		this._debugTimePING = this._debugGetTimeArray();
		this._debugPINGQueue = [];
		this._debugTimeKeypress = this._debugGetTimeArray();
		this._debugKeypressQueue = [];
		this._debugLorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
		this._debugLorem += ' ' + this._debugLorem + '\n';
		this._debugLoremPos = 0;
	},

	_debugSetTimes: function(times, value) {
		if (value < times.best) {
			times.best = value;
		}
		if (value > times.worst) {
			times.worst = value;
		}
		times.ms += value;
		times.count++;
		return 'best: ' + times.best + ' ms, avg: ' + Math.round(times.ms/times.count) + ' ms, worst: ' + times.worst + ' ms, last: ' + value + ' ms';
	},

	_debugAddInvalidationRectangle: function(topLeftTwips, bottomRightTwips, command) {
		var now = +new Date();

		var invalidBoundCoords = new L.LatLngBounds(this._twipsToLatLng(topLeftTwips, this._tileZoom),
				this._twipsToLatLng(bottomRightTwips, this._tileZoom));
		var rect = L.rectangle(invalidBoundCoords, {color: 'red', weight: 1, opacity: 1, fillOpacity: 0.4, pointerEvents: 'none'});
		this._debugInvalidBounds[this._debugId] = rect;
		this._debugInvalidBoundsMessage[this._debugId] = command;
		this._debugId++;
		this._debugInfo.addLayer(rect);

		var oldestKeypress = this._debugKeypressQueue.shift();
		if (oldestKeypress) {
			var timeText = this._debugSetTimes(this._debugTimeKeypress, now - oldestKeypress);
			this._debugData['fromKeyInputToInvalidate'].setPrefix('Elapsed time between key input and next invalidate: ' + timeText);
		}

		// query server ping time after invalidation messages
		// pings will be paired with the pong messages
		this._debugPINGQueue.push(+new Date());
		this._map._socket.sendMessage('ping');
	},

	_debugAddInvalidationData: function(tile) {
		if (tile._debugTile) {
			tile._debugTile.setStyle({fillOpacity: 0.5, fillColor: 'blue'});
			tile._debugTime.date = +new Date();
			tile._debugTile.date = +new Date();
			tile._debugInvalidateCount++;
			this._debugInvalidateCount++;
		}
	},

	_debugAddInvalidationMessage: function(message) {
		this._debugInvalidBoundsMessage[this._debugId - 1] = message;
		var messages = '';
		for (var i = this._debugId - 1; i > this._debugId - 6; i--) {
			if (i >= 0 && this._debugInvalidBoundsMessage[i]) {
				messages += '' + i + ': ' + this._debugInvalidBoundsMessage[i] + ' <br>';
			}
		}
		this._debugData['tileCombine'].setPrefix(messages);
		this._debugShowTileData();
	},

	_debugTimeout: function() {
		if (this._debug) {
			for (var key in this._debugInvalidBounds) {
				var rect = this._debugInvalidBounds[key];
				var opac = rect.options.fillOpacity;
				if (opac <= 0.04) {
					if (key < this._debugId - 5) {
						this._debugInfo.removeLayer(rect);
						delete this._debugInvalidBounds[key];
						delete this._debugInvalidBoundsMessage[key];
					} else {
						rect.setStyle({fillOpacity: 0, opacity: 1 - (this._debugId - key) / 7});
					}
				} else {
					rect.setStyle({fillOpacity: opac - 0.04});
				}
			}
			for (var key in this._debugTiles) {
				var rect = this._debugTiles[key];
				var col = rect.options.fillColor;
				var opac = rect.options.fillOpacity;
				if (col === 'blue' && opac >= 0.04 && rect.date + 1000 < +new Date()) {
					rect.setStyle({fillOpacity: opac - 0.04});
				}
			}
			this._debugTimeoutId = setTimeout(function () { map._docLayer._debugTimeout(); }, 50);
		}
	},

	_debugTypeTimeout: function() {
		var letter = this._debugLorem.charCodeAt(this._debugLoremPos % this._debugLorem.length);
		this._debugKeypressQueue.push(+new Date());
		if (letter === '\n'.charCodeAt(0)) {
			this._postKeyboardEvent('input', 0, 1280);
		} else {
			this._postKeyboardEvent('input', this._debugLorem.charCodeAt(this._debugLoremPos % this._debugLorem.length), 0);
		}
		this._debugLoremPos++;
		this._debugTypeTimeoutId = setTimeout(function () { map._docLayer._debugTypeTimeout(); }, 50);
	}

});

L.tileLayer = function (url, options) {
	return new L.TileLayer(url, options);
};


/*
 * L.TileLayer.WMS is used for WMS tile layers.
 */

L.TileLayer.WMS = L.TileLayer.extend({

	defaultWmsParams: {
		service: 'WMS',
		request: 'GetMap',
		version: '1.1.1',
		layers: '',
		styles: '',
		format: 'image/jpeg',
		transparent: false
	},

	options: {
		crs: null,
		uppercase: false
	},

	initialize: function (url, options) {

		this._url = url;

		var wmsParams = L.extend({}, this.defaultWmsParams);

		// all keys that are not TileLayer options go to WMS params
		for (var i in options) {
			if (!(i in this.options)) {
				wmsParams[i] = options[i];
			}
		}

		options = L.setOptions(this, options);

		wmsParams.width = wmsParams.height = options.tileSize * (options.detectRetina && L.Browser.retina ? 2 : 1);

		this.wmsParams = wmsParams;
	},

	onAdd: function (map) {

		this._crs = this.options.crs || map.options.crs;
		this._wmsVersion = parseFloat(this.wmsParams.version);

		var projectionKey = this._wmsVersion >= 1.3 ? 'crs' : 'srs';
		this.wmsParams[projectionKey] = this._crs.code;

		L.TileLayer.prototype.onAdd.call(this, map);
	},

	getTileUrl: function (coords) {

		var tileBounds = this._tileCoordsToBounds(coords),
		    nw = this._crs.project(tileBounds.getNorthWest()),
		    se = this._crs.project(tileBounds.getSouthEast()),

		    bbox = (this._wmsVersion >= 1.3 && this._crs === L.CRS.EPSG4326 ?
			    [se.y, nw.x, nw.y, se.x] :
			    [nw.x, se.y, se.x, nw.y]).join(','),

		    url = L.TileLayer.prototype.getTileUrl.call(this, coords);

		return url +
			L.Util.getParamString(this.wmsParams, url, this.options.uppercase) +
			(this.options.uppercase ? '&BBOX=' : '&bbox=') + bbox;
	},

	setParams: function (params, noRedraw) {

		L.extend(this.wmsParams, params);

		if (!noRedraw) {
			this.redraw();
		}

		return this;
	}
});

L.tileLayer.wms = function (url, options) {
	return new L.TileLayer.WMS(url, options);
};


/* -*- js-indent-level: 8 -*- */
/*
 * Writer tile layer is used to display a text document
 */

L.WriterTileLayer = L.TileLayer.extend({

	newAnnotation: function (comment) {
		if (!comment.anchorPos && this._isCursorVisible) {
			comment.anchorPos = L.bounds(this._latLngToTwips(this._visibleCursor.getSouthWest()),
				this._latLngToTwips(this._visibleCursor.getNorthEast()));
			comment.anchorPix = this._twipsToPixels(comment.anchorPos.min);
		}
		if (comment.anchorPos) {
			this._annotations.updateDocBounds(0, this._annotations.options.extraSize);
			this._annotations.modify(this._annotations.add(comment));
		}
	},

	onAdd: function (map) {
		L.TileLayer.prototype.onAdd.call(this, map);
		this._annotations = L.annotationManager(map);
	},

	onAnnotationModify: function (annotation) {
		this._annotations.modify(annotation);
	},

	onAnnotationRemove: function (id) {
		this._annotations.remove(id);
	},

	onAnnotationReply: function (annotation) {
		this._annotations.reply(annotation);
	},

	onChangeAccept: function(id) {
		this._annotations.acceptChange(id);
	},

	onChangeReject: function(id) {
		this._annotations.rejectChange(id);
	},

	_onCommandValuesMsg: function (textMsg) {
		var values = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
		if (!values) {
			return;
		}

		if (values.comments) {
			this._annotations.fill(values.comments);
		}
		else if (values.redlines) {
			this._annotations.fillChanges(values.redlines);
		}
		else {
			L.TileLayer.prototype._onCommandValuesMsg.call(this, textMsg);
		}
	},

	_onMessage: function (textMsg, img) {
		if (textMsg.startsWith('comment:')) {
			var obj = JSON.parse(textMsg.substring('comment:'.length + 1));
			this._annotations.onACKComment(obj);
		}
		else if (textMsg.startsWith('redlinetablemodified:')) {
			obj = JSON.parse(textMsg.substring('redlinetablemodified:'.length + 1));
			this._annotations.onACKComment(obj);
		}
		else if (textMsg.startsWith('redlinetablechanged:')) {
			obj = JSON.parse(textMsg.substring('redlinetablechanged:'.length + 1));
			this._annotations.onACKComment(obj);
		}
		else {
			L.TileLayer.prototype._onMessage.call(this, textMsg, img);
		}
	},

	_onInvalidateTilesMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		if (command.x === undefined || command.y === undefined || command.part === undefined) {
			var strTwips = textMsg.match(/\d+/g);
			command.x = parseInt(strTwips[0]);
			command.y = parseInt(strTwips[1]);
			command.width = parseInt(strTwips[2]);
			command.height = parseInt(strTwips[3]);
			command.part = this._selectedPart;
		}
		command.part = 0;
		var topLeftTwips = new L.Point(command.x, command.y);
		var offset = new L.Point(command.width, command.height);
		var bottomRightTwips = topLeftTwips.add(offset);
		if (this._debug) {
			this._debugAddInvalidationRectangle(topLeftTwips, bottomRightTwips, textMsg);
		}
		var invalidBounds = new L.Bounds(topLeftTwips, bottomRightTwips);
		var visibleTopLeft = this._latLngToTwips(this._map.getBounds().getNorthWest());
		var visibleBottomRight = this._latLngToTwips(this._map.getBounds().getSouthEast());
		var visibleArea = new L.Bounds(visibleTopLeft, visibleBottomRight);
		var tilePositionsX = '';
		var tilePositionsY = '';
		var oldHashes = '';
		var needsNewTiles = false;
		for (var key in this._tiles) {
			var coords = this._tiles[key].coords;
			var tileTopLeft = this._coordsToTwips(coords);
			var tileBottomRight = new L.Point(this._tileWidthTwips, this._tileHeightTwips);
			var bounds = new L.Bounds(tileTopLeft, tileTopLeft.add(tileBottomRight));
			if (coords.part === command.part && invalidBounds.intersects(bounds)) {
				if (this._tiles[key]._invalidCount) {
					this._tiles[key]._invalidCount += 1;
				}
				else {
					this._tiles[key]._invalidCount = 1;
				}
				if (visibleArea.intersects(bounds)) {
					if (tilePositionsX !== '') {
						tilePositionsX += ',';
					}
					tilePositionsX += tileTopLeft.x;
					if (tilePositionsY !== '') {
						tilePositionsY += ',';
					}
					tilePositionsY += tileTopLeft.y;
					if (oldHashes !== '') {
						oldHashes += ',';
					}
					if (this._tiles[key].oldhash === undefined) {
						oldHashes += '0';
					}
					else {
						oldHashes += this._tiles[key].oldhash;
					}
					needsNewTiles = true;
					if (this._debug) {
						this._debugAddInvalidationData(this._tiles[key]);
					}
				}
				else {
					// tile outside of the visible area, just remove it
					this._preFetchBorder = null;
					this._removeTile(key);
				}
			}
		}

		if (needsNewTiles)
		{
			// CalcTileLayer.js and ImpressTileLayer.js avoid this when
			// command.part !== this._selectedPart; but in Writer, the part is
			// always 0 anyway
			var message = 'tilecombine ' +
				'part=' + command.part + ' ' +
				'width=' + this._tileWidthPx + ' ' +
				'height=' + this._tileHeightPx + ' ' +
				'tileposx=' + tilePositionsX + ' ' +
				'tileposy=' + tilePositionsY + ' ' +
				'tilewidth=' + this._tileWidthTwips + ' ' +
				'tileheight=' + this._tileHeightTwips + ' ' +
				'oldhash=' + oldHashes;

			this._map._socket.sendMessage(message, '');

			if (this._debug) {
				this._debugAddInvalidationMessage(message);
			}
		}

		for (key in this._tileCache) {
			// compute the rectangle that each tile covers in the document based
			// on the zoom level
			coords = this._keyToTileCoords(key);
			var scale = this._map.getZoomScale(coords.z);
			topLeftTwips = new L.Point(
					this.options.tileWidthTwips / scale * coords.x,
					this.options.tileHeightTwips / scale * coords.y);
			bottomRightTwips = topLeftTwips.add(new L.Point(
					this.options.tileWidthTwips / scale,
					this.options.tileHeightTwips / scale));
			bounds = new L.Bounds(topLeftTwips, bottomRightTwips);
			if (invalidBounds.intersects(bounds)) {
				delete this._tileCache[key];
			}
		}

		this._previewInvalidations.push(invalidBounds);
		// 1s after the last invalidation, update the preview
		clearTimeout(this._previewInvalidator);
		this._previewInvalidator = setTimeout(L.bind(this._invalidatePreviews, this), this.options.previewInvalidationTimeout);
	},

	_onSetPartMsg: function (textMsg) {
		var part = parseInt(textMsg.match(/\d+/g)[0]);
		if (part !== this._selectedPart) {
			this._currentPage = part;
			this._map.fire('pagenumberchanged', {
				currentPage: part,
				pages: this._pages,
				docType: this._docType
			});
		}
	},

	_onStatusMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		if (!command.width || !command.height || this._documentInfo === textMsg)
			return;

		var sizeChanged = command.width !== this._docWidthTwips || command.height !== this._docHeightTwips;
		if (sizeChanged) {
			this._docWidthTwips = command.width;
			this._docHeightTwips = command.height;
			this._docType = command.type;
			this._viewId = parseInt(command.viewid);
			this._updateMaxBounds(true);
		}

		this._documentInfo = textMsg;
		this._selectedPart = 0;
		this._parts = 1;
		this._currentPage = command.selectedPart;
		this._pages = command.parts;
		this._map.fire('pagenumberchanged', {
			currentPage: this._currentPage,
			pages: this._pages,
			docType: this._docType
		});
		this._resetPreFetching(true);
		this._update();
	},

	_updateMaxBounds: function (sizeChanged, extraSize) {
		if (!extraSize) {
			extraSize = this._annotations && this._annotations._items.length > 0 ?
				this._annotations.options.extraSize : null;
		}
		L.GridLayer.prototype._updateMaxBounds.call(this, sizeChanged, extraSize, {panInside: false});
	}
});


/* -*- js-indent-level: 8 -*- */
/*
 * Impress tile layer is used to display a presentation document
 */

L.ImpressTileLayer = L.TileLayer.extend({
	extraSize: L.point(290, 0),

	newAnnotation: function (comment) {
		if (this._draft) {
			return;
		}
		this.onAnnotationCancel();
		this._draft = L.annotation(L.latLng(0, 0), comment, {noMenu: true}).addTo(this._map);
		this._draft.edit();
		var mapCenter = this._map.latLngToLayerPoint(this._map.getCenter());
		var bounds = this._draft.getBounds();
		var topLeft = mapCenter.subtract(L.point(bounds.max.x - bounds.min.x, (bounds.max.y - bounds.min.y)/2));
		this._draft.setLatLng(this._map.layerPointToLatLng(topLeft));
		this.layoutAnnotations();
		this._draft.focus();
	},

	beforeAdd: function (map) {
		map.on('zoomend', this._onAnnotationZoom, this);
		map.on('updateparts', this.onUpdateParts, this);
		map.on('AnnotationCancel', this.onAnnotationCancel, this);
		map.on('AnnotationReply', this.onReplyClick, this);
		map.on('AnnotationSave', this.onAnnotationSave, this);
		map.on('AnnotationScrollUp', this.onAnnotationScrollUp, this);
		map.on('AnnotationScrollDown', this.onAnnotationScrollDown, this);
	},

	getAnnotation: function (id) {
		var annotations = this._annotations[this._partHashes[this._selectedPart]];
		for (var index in annotations) {
			if (annotations[index]._data.id === id) {
				return annotations[index];
			}
		}
		return null;
	},

	hideAnnotations: function (part) {
		this._selectedAnnotation = undefined;
		var annotations = this._annotations[this._partHashes[part]];
		for (var index in annotations) {
			annotations[index].hide();
		}
	},

	hasAnnotations: function (part) {
		var annotations = this._annotations[this._partHashes[part]];
		return annotations && annotations.length > 0;
	},

	updateDocBounds: function (count, extraSize) {
		var annotations = this._annotations[this._partHashes[this._selectedPart]];
		if (annotations && annotations.length === count) {
			this._map._docLayer._updateMaxBounds(true, extraSize);
		}
	},

	onAdd: function (map) {
		L.TileLayer.prototype.onAdd.call(this, map);
		this._annotations = {};
		this._topAnnotation = [];
		this._topAnnotation[this._selectedPart] = 0;
		this._selectedAnnotation = undefined;
		this._draft = null;
	},

	onAnnotationCancel: function (e) {
		if (this._draft) {
			this._map.removeLayer(this._draft);
			this._draft = null;
		}
		this._map.focus();
		this._selectedAnnotation = undefined;
		this.layoutAnnotations();
	},

	onAnnotationModify: function (annotation) {
		this.onAnnotationCancel();
		this._selectedAnnotation = annotation._data.id;
		annotation.edit();
		this.scrollUntilAnnotationIsVisible(annotation);
		annotation.focus();
	},

	onAnnotationReply: function (annotation) {
		this.onAnnotationCancel();
		this._selectedAnnotation = annotation._data.id;
		annotation.reply();
		this.scrollUntilAnnotationIsVisible(annotation);
		annotation.focus();
	},

	onAnnotationRemove: function (id) {
		this.onAnnotationCancel();
		var comment = {
			Id: {
				type: 'string',
				value: id
			}
		};
		this._map.sendUnoCommand('.uno:DeleteAnnotation', comment);
		this._map.focus();
	},

	onAnnotationSave: function (e) {
		var comment;
		if (this._draft) {
			comment = {
				Text: {
					type: 'string',
					value: this._draft._data.text
				}
			};
			this._map.sendUnoCommand('.uno:InsertAnnotation', comment);
			this._map.removeLayer(this._draft);
			this._draft = null;
		} else {
			comment = {
				Id: {
					type: 'string',
					value: e.annotation._data.id
				},
				Text: {
					type: 'string',
					value: e.annotation._data.text
				}
			};
			this._map.sendUnoCommand('.uno:EditAnnotation', comment);
			this._selectedAnnotation = undefined;
		}
		this._map.focus();
	},

	_onAnnotationZoom: function (e) {
		this.onAnnotationCancel();
	},

	onReplyClick: function (e) {
		var comment = {
			Id: {
				type: 'string',
				value: e.annotation._data.id
			},
			Text: {
				type: 'string',
				value: e.annotation._data.reply
			}
		};
		this._map.sendUnoCommand('.uno:ReplyToAnnotation', comment);
		this._selectedAnnotation = undefined;
		this._map.focus();
	},

	onAnnotationScrollDown: function (e) {
		this._topAnnotation[this._selectedPart] = Math.min(++this._topAnnotation[this._selectedPart], this._annotations[this._partHashes[this._selectedPart]].length - 1);
		this.onAnnotationCancel();
	},

	onAnnotationScrollUp: function (e) {
		if (this._topAnnotation[this._selectedPart] === 0) {
			this._map.fire('scrollby', {x: 0, y: -100});
		}
		this._topAnnotation[this._selectedPart] = Math.max(--this._topAnnotation[this._selectedPart], 0);
		this.onAnnotationCancel();
	},

	onUpdateParts: function (e) {
		if (typeof this._prevSelectedPart === 'number') {
			this.hideAnnotations(this._prevSelectedPart);
			if (this.hasAnnotations(this._selectedPart)) {
				this._map._docLayer._updateMaxBounds(true);
				if (this._topAnnotation[this._selectedPart] === undefined) {
					this._topAnnotation[this._selectedPart] = 0;
				}
				this.onAnnotationCancel();
			}
		}
	},

	removeAnnotation: function (id) {
		var annotations = this._annotations[this._partHashes[this._selectedPart]];
		for (var index in annotations) {
			if (annotations[index]._data.id == id) {
				this._map.removeLayer(annotations[index]);
				annotations.splice(index, 1);
				break;
			}
		}
	},

	scrollUntilAnnotationIsVisible: function(annotation) {
		var bounds = annotation.getBounds();
		var mapBounds = this._map.getBounds();
		if (this._map.layerPointToLatLng(bounds.getTopRight()).lat > mapBounds.getNorth()) {
			this._topAnnotation[this._selectedPart] = Math.max(this._topAnnotation[this._selectedPart] - 2, 0);
		}
		else if (this._map.layerPointToLatLng(bounds.getBottomLeft()).lat < mapBounds.getSouth()) {
			this._topAnnotation[this._selectedPart] = Math.min(this._topAnnotation[this._selectedPart] + 2, this._annotations[this._partHashes[this._selectedPart]].length - 1);
		}
		this.layoutAnnotations();
	},

	layoutAnnotations: function () {
		var annotations = this._annotations[this._partHashes[this._selectedPart]];
		var scale = this._map.getZoomScale(this._map.getZoom(), 10);
		var topRight = this._map.latLngToLayerPoint(this._map.options.maxBounds.getNorthEast())
			.subtract(this.extraSize.multiplyBy(scale))
			.add(L.point((this._selectedAnnotation ? 3 : 2) * this.options.marginX, this.options.marginY));
		var topAnnotation = this._topAnnotation[this._selectedPart];
		var bounds, annotation;
		for (var index in annotations) {
			annotation = annotations[index];
			if (topAnnotation > 0 && parseInt(index) === topAnnotation - 1) {
				// if the top annotation is not the first one, show a bit of the bottom of the previous annotation
				// so that the user gets aware that there are more annotations above.

				// get annotation bounds
				annotation.setLatLng(this._map.layerPointToLatLng(L.point(0, -100000))); // placed where it's not visible
				annotation.show(); // if it's hidden the bounds are wrong
				bounds = annotation.getBounds();
				annotation.hide();
				var topLeft = topRight.subtract(L.point(0, bounds.max.y-bounds.min.y));
				annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
				annotation.show();
				bounds = annotation.getBounds();
				bounds.extend(L.point(bounds.max.x, bounds.max.y + this.options.marginY));

			} else if (index >= topAnnotation) { // visible annotations
				if (annotation._data.id === this._selectedAnnotation) {
					if (bounds) {
						bounds.extend(L.point(bounds.max.x, bounds.max.y + 2 * this.options.marginY));
					}
					var offsetX = L.point(2 * this.options.marginX, 0);
					var topLeft = (bounds ? bounds.getBottomLeft() : topRight).subtract(offsetX);
					annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
					bounds = annotation.getBounds();
					bounds = L.bounds(bounds.getBottomLeft().add(offsetX), bounds.getTopRight().add(offsetX));
					bounds.extend(L.point(bounds.max.x, bounds.max.y + 3 * this.options.marginY));
				} else {
					var topLeft = bounds ? bounds.getBottomLeft() : topRight;
					annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
					annotation.show();
					bounds = annotation.getBounds();
					bounds.extend(L.point(bounds.max.x, bounds.max.y + this.options.marginY));
				}
			} else {
				annotation.hide();
			}
		}
		if (bounds) {
			if (!this._scrollAnnotation) {
				this._scrollAnnotation = L.control.scroll.annotation();
				this._scrollAnnotation.addTo(this._map);
			}
		} else if (this._scrollAnnotation) {
			this._map.removeControl(this._scrollAnnotation);
			this._scrollAnnotation = null;
		}
	},

	_onCommandValuesMsg: function (textMsg) {
		try {
			var values = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
		} catch (e) {
			// One such case is 'commandvalues: ' for draw documents in response to .uno:AcceptTrackedChanges
			values = null;
		}

		if (!values) {
			return;
		}

		if (values.comments) {
			this._annotations = {};
			for (var index in values.comments) {
				comment = values.comments[index];
				if (!this._annotations[comment.parthash]) {
					this._annotations[comment.parthash] = [];
				}
				this._annotations[comment.parthash].push(L.annotation(this._map.options.maxBounds.getSouthEast(), comment).addTo(this._map));
			}
			if (!this._topAnnotation) {
				this._topAnnotation = [];
			}
			this._topAnnotation[this._selectedPart] = 0;
			if (this.hasAnnotations(this._selectedPart)) {
				this._map._docLayer._updateMaxBounds(true);
			}
			this.layoutAnnotations();
		} else {
			L.TileLayer.prototype._onCommandValuesMsg.call(this, textMsg);
		}
	},

	_onMessage: function (textMsg, img) {
		if (textMsg.startsWith('comment:')) {
			var obj = JSON.parse(textMsg.substring('comment:'.length + 1));
			if (obj.comment.action === 'Add') {
				if (!this._annotations[obj.comment.parthash]) {
					this._annotations[obj.comment.parthash] = [];
				}
				this._annotations[obj.comment.parthash].push(L.annotation(this._map.options.maxBounds.getSouthEast(), obj.comment).addTo(this._map));
				this._topAnnotation[this._selectedPart] = Math.min(this._topAnnotation[this._selectedPart], this._annotations[this._partHashes[this._selectedPart]].length - 1);
				this.updateDocBounds(1, this.extraSize);
				this.layoutAnnotations();
			} else if (obj.comment.action === 'Remove') {
				this.removeAnnotation(obj.comment.id);
				this._topAnnotation[this._selectedPart] = Math.min(this._topAnnotation[this._selectedPart], this._annotations[this._partHashes[this._selectedPart]].length - 1);
				this.updateDocBounds(0);
				this.layoutAnnotations();
			} else if (obj.comment.action === 'Modify') {
				var modified = this.getAnnotation(obj.comment.id);
				if (modified) {
					modified._data = obj.comment;
					modified.update();
					this._selectedAnnotation = undefined;
					this.layoutAnnotations();
				}
			}
		} else {
			L.TileLayer.prototype._onMessage.call(this, textMsg, img);
		}
	},

	_onInvalidateTilesMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		if (command.x === undefined || command.y === undefined || command.part === undefined) {
			var strTwips = textMsg.match(/\d+/g);
			command.x = parseInt(strTwips[0]);
			command.y = parseInt(strTwips[1]);
			command.width = parseInt(strTwips[2]);
			command.height = parseInt(strTwips[3]);
			command.part = this._selectedPart;
		}
		var topLeftTwips = new L.Point(command.x, command.y);
		var offset = new L.Point(command.width, command.height);
		var bottomRightTwips = topLeftTwips.add(offset);
		if (this._debug) {
			this._debugAddInvalidationRectangle(topLeftTwips, bottomRightTwips, textMsg);
		}
		var invalidBounds = new L.Bounds(topLeftTwips, bottomRightTwips);
		var visibleTopLeft = this._latLngToTwips(this._map.getBounds().getNorthWest());
		var visibleBottomRight = this._latLngToTwips(this._map.getBounds().getSouthEast());
		var visibleArea = new L.Bounds(visibleTopLeft, visibleBottomRight);

		var tilePositionsX = '';
		var tilePositionsY = '';
		var oldHashes = '';
		var needsNewTiles = false;

		for (var key in this._tiles) {
			var coords = this._tiles[key].coords;
			var tileTopLeft = this._coordsToTwips(coords);
			var tileBottomRight = new L.Point(this._tileWidthTwips, this._tileHeightTwips);
			var bounds = new L.Bounds(tileTopLeft, tileTopLeft.add(tileBottomRight));
			if (coords.part === command.part && invalidBounds.intersects(bounds)) {
				if (this._tiles[key]._invalidCount) {
					this._tiles[key]._invalidCount += 1;
				}
				else {
					this._tiles[key]._invalidCount = 1;
				}
				if (visibleArea.intersects(bounds)) {
					if (tilePositionsX !== '') {
						tilePositionsX += ',';
					}
					tilePositionsX += tileTopLeft.x;
					if (tilePositionsY !== '') {
						tilePositionsY += ',';
					}
					tilePositionsY += tileTopLeft.y;
					if (oldHashes !== '') {
						oldHashes += ',';
					}
					if (this._tiles[key].oldhash === undefined) {
						oldHashes += '0';
					}
					else {
						oldHashes += this._tiles[key].oldhash;
					}
					needsNewTiles = true;
					if (this._debug) {
						this._debugAddInvalidationData(this._tiles[key]);
					}
				}
				else {
					// tile outside of the visible area, just remove it
					this._preFetchBorder = null;
					this._removeTile(key);
				}
			}
		}

		if (needsNewTiles && command.part === this._selectedPart)
		{
			var message = 'tilecombine ' +
				'part=' + command.part + ' ' +
				'width=' + this._tileWidthPx + ' ' +
				'height=' + this._tileHeightPx + ' ' +
				'tileposx=' + tilePositionsX + ' ' +
				'tileposy=' + tilePositionsY + ' ' +
				'tilewidth=' + this._tileWidthTwips + ' ' +
				'tileheight=' + this._tileHeightTwips + ' ' +
				'oldhash=' + oldHashes;

			this._map._socket.sendMessage(message, '');
			if (this._debug) {
				this._debugAddInvalidationMessage(message);
			}
		}

		for (key in this._tileCache) {
			// compute the rectangle that each tile covers in the document based
			// on the zoom level
			coords = this._keyToTileCoords(key);
			if (coords.part !== command.part) {
				continue;
			}
			var scale = this._map.getZoomScale(coords.z);
			topLeftTwips = new L.Point(
					this.options.tileWidthTwips / scale * coords.x,
					this.options.tileHeightTwips / scale * coords.y);
			bottomRightTwips = topLeftTwips.add(new L.Point(
					this.options.tileWidthTwips / scale,
					this.options.tileHeightTwips / scale));
			bounds = new L.Bounds(topLeftTwips, bottomRightTwips);
			if (invalidBounds.intersects(bounds)) {
				delete this._tileCache[key];
			}
		}
		if (command.part === this._selectedPart &&
			command.part !== this._lastValidPart) {
			this._map.fire('updatepart', {part: this._lastValidPart, docType: this._docType});
			this._lastValidPart = command.part;
			this._map.fire('updatepart', {part: command.part, docType: this._docType});
		}

		this._previewInvalidations.push(invalidBounds);
		// 1s after the last invalidation, update the preview
		clearTimeout(this._previewInvalidator);
		this._previewInvalidator = setTimeout(L.bind(this._invalidatePreviews, this), this.options.previewInvalidationTimeout);
	},

	_onSetPartMsg: function (textMsg) {
		var part = parseInt(textMsg.match(/\d+/g)[0]);
		if (part !== this._selectedPart) {
			this._map.setPart(part, true);
			this._map.fire('setpart', {selectedPart: this._selectedPart});
		}
	},

	_onStatusMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		if (command.width && command.height && this._documentInfo !== textMsg) {
			this._docWidthTwips = command.width;
			this._docHeightTwips = command.height;
			this._docType = command.type;
			if (this._docType === 'drawing') {
				L.DomUtil.addClass(L.DomUtil.get('presentation-controls-wrapper'), 'drawing');
			}
			this._updateMaxBounds(true);
			this._documentInfo = textMsg;
			this._parts = command.parts;
			this._viewId = parseInt(command.viewid);
			this._selectedPart = command.selectedPart;
			this._resetPreFetching(true);
			this._update();
			if (this._preFetchPart !== this._selectedPart) {
				this._preFetchPart = this._selectedPart;
				this._preFetchBorder = null;
			}
			var partMatch = textMsg.match(/[^\r\n]+/g);
			// only get the last matches
			this._partHashes = partMatch.slice(partMatch.length - this._parts);
			this._map.fire('updateparts', {
				selectedPart: this._selectedPart,
				parts: this._parts,
				docType: this._docType,
				partNames: this._partHashes
			});
		}
	},

	_updateMaxBounds: function (sizeChanged, extraSize) {
		if (!extraSize) {
			var annotations = this._annotations && this._partHashes && this._selectedPart !== undefined ?
				this._annotations[this._partHashes[this._selectedPart]] : [];
			extraSize = annotations && annotations.length > 0 ? this.extraSize : null;
		}
		L.GridLayer.prototype._updateMaxBounds.call(this, sizeChanged, extraSize, {panInside: false});
	}
});


/* -*- js-indent-level: 8 -*- */
/*
 * Calc tile layer is used to display a spreadsheet document
 */

L.CalcTileLayer = L.TileLayer.extend({
	STD_EXTRA_WIDTH: 113, /* 2mm extra for optimal width,
                              * 0.1986cm with TeX points,
                              * 0.1993cm with PS points. */

	twipsToHMM: function (twips) {
		return (twips * 127 + 36) / 72;
	},

	newAnnotation: function (comment) {
		var annotations = this._annotations[this._selectedPart];
		var annotation;
		for (var key in annotations) {
			if (this._cellCursor.contains(annotations[key]._annotation._data.cellPos)) {
				annotation = annotations[key];
				break;
			}
		}

		if (!annotation) {
			comment.cellPos = this._cellCursor;
			annotation = this.createAnnotation(comment);
			annotation._annotation._tag = annotation;
			this.showAnnotation(annotation);
		}
		annotation.editAnnotation();
	},

	createAnnotation: function (comment) {
		var annotation = L.divOverlay(comment.cellPos).bindAnnotation(L.annotation(L.latLng(0, 0),
			comment, comment.id === 'new' ? {noMenu: true} : {}));
		return annotation;
	},

	beforeAdd: function (map) {
		map._addZoomLimit(this);
		map.on('zoomend', this._onZoomRowColumns, this);
		map.on('updateparts', this._onUpdateParts, this);
		map.on('AnnotationCancel', this._onAnnotationCancel, this);
		map.on('AnnotationReply', this._onAnnotationReply, this);
		map.on('AnnotationSave', this._onAnnotationSave, this);
	},

	clearAnnotations: function () {
		for (var tab in this._annotations) {
			for (var key in this._annotations[tab]) {
				this.hideAnnotation(this._annotations[tab][key]);
			}
		}
		this._annotations = {};
	},

	onAdd: function (map) {
		L.TileLayer.prototype.onAdd.call(this, map);
		this._annotations = {};
	},

	onAnnotationModify: function (annotation) {
		annotation.edit();
		annotation.focus();
	},

	onAnnotationRemove: function (id) {
		var comment = {
			Id: {
				type: 'string',
				value: id
			}
		};
		var tab = this._selectedPart;
		this._map.sendUnoCommand('.uno:DeleteNote', comment);
		this._annotations[tab][id].closePopup();
		this._map.focus();
	},

	onAnnotationReply: function (annotation) {
		annotation.reply();
		annotation.focus();
	},

	showAnnotation: function (annotation) {
		this._map.addLayer(annotation);
	},

	hideAnnotation: function (annotation) {
		this._map.removeLayer(annotation);
	},

	showAnnotations: function () {
		var annotations = this._annotations[this._selectedPart];
		for (var key in annotations) {
			this.showAnnotation(annotations[key]);
		}
	},

	hideAnnotations: function (part) {

		var annotations = this._annotations[part];
		for (var key in annotations) {
			this.hideAnnotation(annotations[key]);
		}
	},

	_onAnnotationCancel: function (e) {
		if (e.annotation._data.id === 'new') {
			this.hideAnnotation(e.annotation._tag);
		} else {
			this._annotations[e.annotation._data.tab][e.annotation._data.id].closePopup();
		}
		this._map.focus();
	},

	_onAnnotationReply: function (e) {
		var comment = {
			Id: {
				type: 'string',
				value: e.annotation._data.id
			},
			Text: {
				type: 'string',
				value: e.annotation._data.reply
			}
		};
		this._map.sendUnoCommand('.uno:ReplyComment', comment);
		this._map.focus();
	},

	_onAnnotationSave: function (e) {
		var comment;
		if (e.annotation._data.id === 'new') {
			comment = {
				Text: {
					type: 'string',
					value: e.annotation._data.text
				},
				Author: {
					type: 'string',
					value: e.annotation._data.author
				}
			};
			this._map.sendUnoCommand('.uno:InsertAnnotation', comment);
			this.hideAnnotation(e.annotation._tag);
		} else {
			comment = {
				Id: {
					type: 'string',
					value: e.annotation._data.id
				},
				Text: {
					type: 'string',
					value: e.annotation._data.text
				},
				Author: {
					type: 'string',
					value: this._map.getViewName(this._viewId)
				}
			};
			this._map.sendUnoCommand('.uno:EditAnnotation', comment);
			this._annotations[e.annotation._data.tab][e.annotation._data.id].closePopup();
		}
		this._map.focus();
	},

	_onUpdateParts: function (e) {
		if (typeof this._prevSelectedPart === 'number' && !e.source) {
			this.hideAnnotations(this._prevSelectedPart);
			this.showAnnotations();
		}
	},

	_onMessage: function (textMsg, img) {
		if (textMsg.startsWith('comment:')) {
			var obj = JSON.parse(textMsg.substring('comment:'.length + 1));
			obj.comment.tab = parseInt(obj.comment.tab);
			if (obj.comment.action === 'Add') {
				obj.comment.cellPos = L.LOUtil.stringToBounds(obj.comment.cellPos);
				obj.comment.cellPos = L.latLngBounds(this._twipsToLatLng(obj.comment.cellPos.getBottomLeft()),
					this._twipsToLatLng(obj.comment.cellPos.getTopRight()));
				if (!this._annotations[obj.comment.tab]) {
					this._annotations[obj.comment.tab] = {};
				}
				this._annotations[obj.comment.tab][obj.comment.id] = this.createAnnotation(obj.comment);
				if (obj.comment.tab === this._selectedPart) {
					this.showAnnotation(this._annotations[obj.comment.tab][obj.comment.id]);
				}
			} else if (obj.comment.action === 'Remove') {
				var removed = this._annotations[obj.comment.tab][obj.comment.id];
				if (removed) {
					this.hideAnnotation(removed);
					delete this._annotations[obj.comment.tab][obj.comment.id];
				}
			} else if (obj.comment.action === 'Modify') {
				var modified = this._annotations[obj.comment.tab][obj.comment.id];
				obj.comment.cellPos = L.LOUtil.stringToBounds(obj.comment.cellPos);
				obj.comment.cellPos = L.latLngBounds(this._twipsToLatLng(obj.comment.cellPos.getBottomLeft()),
					this._twipsToLatLng(obj.comment.cellPos.getTopRight()));
				if (modified) {
					modified._annotation._data = obj.comment;
					modified.setLatLngBounds(obj.comment.cellPos);
				}
			}
		} else if (textMsg.startsWith('invalidateheader: column')) {
			this._map.fire('updaterowcolumnheaders', {x: this._map._getTopLeftPoint().x, y: 0, offset: {x: undefined, y: 0}});
			this._map._socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');
		} else if (textMsg.startsWith('invalidateheader: row')) {
			this._map.fire('updaterowcolumnheaders', {x: 0, y: this._map._getTopLeftPoint().y, offset: {x: 0, y: undefined}});
			this._map._socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');
		} else if (textMsg.startsWith('invalidateheader: all')) {
			this._map.fire('updaterowcolumnheaders', {x: this._map._getTopLeftPoint().x, y: this._map._getTopLeftPoint(), offset: {x: undefined, y: undefined}});
			this._map._socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');
		} else {
			L.TileLayer.prototype._onMessage.call(this, textMsg, img);
		}
	},

	_onInvalidateTilesMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		if (command.x === undefined || command.y === undefined || command.part === undefined) {
			var strTwips = textMsg.match(/\d+/g);
			command.x = parseInt(strTwips[0]);
			command.y = parseInt(strTwips[1]);
			command.width = parseInt(strTwips[2]);
			command.height = parseInt(strTwips[3]);
			command.part = this._selectedPart;
		}
		if (this._docType === 'text') {
			command.part = 0;
		}
		var topLeftTwips = new L.Point(command.x, command.y);
		var offset = new L.Point(command.width, command.height);
		var bottomRightTwips = topLeftTwips.add(offset);
		if (this._debug) {
			this._debugAddInvalidationRectangle(topLeftTwips, bottomRightTwips, textMsg);
		}
		var invalidBounds = new L.Bounds(topLeftTwips, bottomRightTwips);
		var visibleTopLeft = this._latLngToTwips(this._map.getBounds().getNorthWest());
		var visibleBottomRight = this._latLngToTwips(this._map.getBounds().getSouthEast());
		var visibleArea = new L.Bounds(visibleTopLeft, visibleBottomRight);

		var tilePositionsX = '';
		var tilePositionsY = '';
		var oldHashes = '';
		var needsNewTiles = false;

		for (var key in this._tiles) {
			var coords = this._tiles[key].coords;
			var tileTopLeft = this._coordsToTwips(coords);
			var tileBottomRight = new L.Point(this._tileWidthTwips, this._tileHeightTwips);
			var bounds = new L.Bounds(tileTopLeft, tileTopLeft.add(tileBottomRight));
			if (coords.part === command.part && invalidBounds.intersects(bounds)) {
				if (this._tiles[key]._invalidCount) {
					this._tiles[key]._invalidCount += 1;
				}
				else {
					this._tiles[key]._invalidCount = 1;
				}
				if (visibleArea.intersects(bounds)) {
					if (tilePositionsX !== '') {
						tilePositionsX += ',';
					}
					tilePositionsX += tileTopLeft.x;
					if (tilePositionsY !== '') {
						tilePositionsY += ',';
					}
					tilePositionsY += tileTopLeft.y;
					if (oldHashes !== '') {
						oldHashes += ',';
					}
					if (this._tiles[key].oldhash === undefined) {
						oldHashes += '0';
					}
					else {
						oldHashes += this._tiles[key].oldhash;
					}
					needsNewTiles = true;
					if (this._debug) {
						this._debugAddInvalidationData(this._tiles[key]);
					}
				}
				else {
					// tile outside of the visible area, just remove it
					this._preFetchBorder = null;
					this._removeTile(key);
				}
			}
		}

		if (needsNewTiles && command.part === this._selectedPart)
		{
			var message = 'tilecombine ' +
				'part=' + command.part + ' ' +
				'width=' + this._tileWidthPx + ' ' +
				'height=' + this._tileHeightPx + ' ' +
				'tileposx=' + tilePositionsX + ' ' +
				'tileposy=' + tilePositionsY + ' ' +
				'tilewidth=' + this._tileWidthTwips + ' ' +
				'tileheight=' + this._tileHeightTwips + ' ' +
				'oldhash=' + oldHashes;

			this._map._socket.sendMessage(message, '');
			if (this._debug) {
				this._debugAddInvalidationMessage(message);
			}
		}

		for (key in this._tileCache) {
			// compute the rectangle that each tile covers in the document based
			// on the zoom level
			coords = this._keyToTileCoords(key);
			if (coords.part !== command.part) {
				continue;
			}
			var scale = this._map.getZoomScale(coords.z);
			topLeftTwips = new L.Point(
					this.options.tileWidthTwips / scale * coords.x,
					this.options.tileHeightTwips / scale * coords.y);
			bottomRightTwips = topLeftTwips.add(new L.Point(
					this.options.tileWidthTwips / scale,
					this.options.tileHeightTwips / scale));
			bounds = new L.Bounds(topLeftTwips, bottomRightTwips);
			if (invalidBounds.intersects(bounds)) {
				delete this._tileCache[key];
			}
		}

		this._previewInvalidations.push(invalidBounds);
		// 1s after the last invalidation, update the preview
		clearTimeout(this._previewInvalidator);
		this._previewInvalidator = setTimeout(L.bind(this._invalidatePreviews, this), this.options.previewInvalidationTimeout);
	},

	_onSetPartMsg: function (textMsg) {
		var part = parseInt(textMsg.match(/\d+/g)[0]);
		if (part !== this._selectedPart) {
			this._map.setPart(part, true);
			this._map.fire('setpart', {selectedPart: this._selectedPart});
			// TODO: test it!
			this._map.fire('updaterowcolumnheaders');
		}
	},

	_onZoomRowColumns: function () {
		this._updateClientZoom();
		if (this._clientZoom) {
			this._map._socket.sendMessage('clientzoom ' + this._clientZoom);
			this._clientZoom = null;
		}
		// TODO: test it!
		this._map.fire('updaterowcolumnheaders');
	},

	_onUpdateCurrentHeader: function() {
		var pos = new L.Point(-1, -1);
		if (this._cellCursor && !this._isEmptyRectangle(this._cellCursor)) {
			pos = this._cellCursorTwips.min.add([1, 1]);
		}
		this._map.fire('updatecurrentheader', pos);
	},

	_onUpdateSelectionHeader: function () {
		var layers = this._selections.getLayers();
		var layer = layers.pop();
		if (layers.length === 0 && layer && layer.getLatLngs().length === 1) {
			var start = this._latLngToTwips(layer.getBounds().getNorthWest()).add([1, 1]);
			var end = this._latLngToTwips(layer.getBounds().getSouthEast()).subtract([1, 1]);
			this._map.fire('updateselectionheader', {start: start, end: end});
		}
		else {
			this._map.fire('clearselectionheader');
		}
	},

	_onStatusMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		if (command.width && command.height && this._documentInfo !== textMsg) {
			this._docWidthTwips = command.width;
			this._docHeightTwips = command.height;
			this._docType = command.type;
			this._parts = command.parts;
			this._selectedPart = command.selectedPart;
			this._viewId = parseInt(command.viewid);
			var mapSize = this._map.getSize();
			var width = this._docWidthTwips / this._tileWidthTwips * this._tileSize;
			var height = this._docHeightTwips / this._tileHeightTwips * this._tileSize;
			if (width < mapSize.x || height < mapSize.y) {
				width = Math.max(width, mapSize.x);
				height = Math.max(height, mapSize.y);
				var topLeft = this._map.unproject(new L.Point(0, 0));
				var bottomRight = this._map.unproject(new L.Point(width, height));
				this._map.setMaxBounds(new L.LatLngBounds(topLeft, bottomRight));
				this._docPixelSize = {x: width, y: height};
				this._map.fire('docsize', {x: width, y: height});
			}
			else {
				this._updateMaxBounds(true);
			}
			this._documentInfo = textMsg;
			var partNames = textMsg.match(/[^\r\n]+/g);
			// only get the last matches
			this._partNames = partNames.slice(partNames.length - this._parts);
			this._map.fire('updateparts', {
				selectedPart: this._selectedPart,
				parts: this._parts,
				docType: this._docType,
				partNames: this._partNames,
				source: 'status'
			});
			this._resetPreFetching(true);
			this._update();
			if (this._preFetchPart !== this._selectedPart) {
				this._preFetchPart = this._selectedPart;
				this._preFetchBorder = null;
			}
		}
	},

	_onCommandValuesMsg: function (textMsg) {
		var jsonIdx = textMsg.indexOf('{');
		if (jsonIdx === -1)
			return;

		var values = JSON.parse(textMsg.substring(jsonIdx));
		if (!values) {
			return;
		}

		if (values.commandName === '.uno:ViewRowColumnHeaders') {
			this._map.fire('viewrowcolumnheaders', {
				data: values,
				converter: this._twipsToPixels,
				context: this
			});
			this._onUpdateCurrentHeader();
			this._onUpdateSelectionHeader();
		} else if (values.comments) {
			var comment;
			this.clearAnnotations();
			for (var index in values.comments) {
				comment = values.comments[index];
				comment.tab = parseInt(comment.tab);
				comment.cellPos = L.LOUtil.stringToBounds(comment.cellPos);
				comment.cellPos = L.latLngBounds(this._twipsToLatLng(comment.cellPos.getBottomLeft()),
					this._twipsToLatLng(comment.cellPos.getTopRight()));
				if (!this._annotations[comment.tab]) {
					this._annotations[comment.tab] = {};
				}
				this._annotations[comment.tab][comment.id] = this.createAnnotation(comment);
			}
			this.showAnnotations();
		} else if (values.commentsPos) {
			var comment;
			this.hideAnnotations();
			for (var index in values.commentsPos) {
				comment = values.commentsPos[index];
				comment.tab = parseInt(comment.tab);
				comment.cellPos = L.LOUtil.stringToBounds(comment.cellPos);
				comment.cellPos = L.latLngBounds(this._twipsToLatLng(comment.cellPos.getBottomLeft()),
					this._twipsToLatLng(comment.cellPos.getTopRight()));
				var annotation = this._annotations[comment.tab][comment.id];
				if (annotation) {
					annotation.setLatLngBounds(comment.cellPos);
					annotation.mark.setLatLng(comment.cellPos.getNorthEast());
				}
			}
			this.showAnnotations();
		} else {
			L.TileLayer.prototype._onCommandValuesMsg.call(this, textMsg);
		}
	},

	_onTextSelectionMsg: function (textMsg) {
		L.TileLayer.prototype._onTextSelectionMsg.call(this, textMsg);
		this._onUpdateSelectionHeader();
	},

	_onCellCursorMsg: function (textMsg) {
		L.TileLayer.prototype._onCellCursorMsg.call(this, textMsg);
		this._onUpdateCurrentHeader();
	}
});


/*
 * L.ImageOverlay is used to overlay images over the map (to specific geographical bounds).
 */

L.ImageOverlay = L.Layer.extend({

	options: {
		opacity: 1,
		alt: '',
		interactive: false
	},

	initialize: function (url, bounds, options) { // (String, LatLngBounds, Object)
		this._url = url;
		this._bounds = L.latLngBounds(bounds);

		L.setOptions(this, options);
	},

	onAdd: function () {
		if (!this._image) {
			this._initImage();

			if (this.options.opacity < 1) {
				this._updateOpacity();
			}
		}

		if (this.options.interactive) {
			L.DomUtil.addClass(this._image, 'leaflet-interactive');
			this.addInteractiveTarget(this._image);
		}

		this.getPane().appendChild(this._image);
		this._reset();
	},

	onRemove: function () {
		L.DomUtil.remove(this._image);
		if (this.options.interactive) {
			this.removeInteractiveTarget(this._image);
		}
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;

		if (this._image) {
			this._updateOpacity();
		}
		return this;
	},

	setStyle: function (styleOpts) {
		if (styleOpts.opacity) {
			this.setOpacity(styleOpts.opacity);
		}
		return this;
	},

	bringToFront: function () {
		if (this._map) {
			L.DomUtil.toFront(this._image);
		}
		return this;
	},

	bringToBack: function () {
		if (this._map) {
			L.DomUtil.toBack(this._image);
		}
		return this;
	},

	setUrl: function (url) {
		this._url = url;

		if (this._image) {
			this._image.src = url;
		}
		return this;
	},

	getAttribution: function () {
		return this.options.attribution;
	},

	getEvents: function () {
		var events = {
			viewreset: this._reset
		};

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	},

	getBounds: function () {
		return this._bounds;
	},

	_initImage: function () {
		var img = this._image = L.DomUtil.create('img',
				'leaflet-image-layer ' + (this._zoomAnimated ? 'leaflet-zoom-animated' : ''));

		img.onselectstart = L.Util.falseFn;
		img.onmousemove = L.Util.falseFn;

		img.onload = L.bind(this.fire, this, 'load');
		img.src = this._url;
		img.alt = this.options.alt;
	},

	_animateZoom: function (e) {
		var bounds = new L.Bounds(
			this._map._latLngToNewLayerPoint(this._bounds.getNorthWest(), e.zoom, e.center),
		    this._map._latLngToNewLayerPoint(this._bounds.getSouthEast(), e.zoom, e.center));

		var offset = bounds.min.add(bounds.getSize()._multiplyBy((1 - 1 / e.scale) / 2));

		L.DomUtil.setTransform(this._image, offset, e.scale);
	},

	_reset: function () {
		var image = this._image,
		    bounds = new L.Bounds(
		        this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
		        this._map.latLngToLayerPoint(this._bounds.getSouthEast())),
		    size = bounds.getSize();

		L.DomUtil.setPosition(image, bounds.min);

		image.style.width  = size.x + 'px';
		image.style.height = size.y + 'px';
	},

	_updateOpacity: function () {
		L.DomUtil.setOpacity(this._image, this.options.opacity);
	}
});

L.imageOverlay = function (url, bounds, options) {
	return new L.ImageOverlay(url, bounds, options);
};


/*
 * L.ProgressOverlay is used to overlay progress images over the map.
 */

L.ProgressOverlay = L.Layer.extend({

	options: {
		spinnerSpeed: 1.5
	},

	initialize: function (latlng, size) {
		this._latlng = L.latLng(latlng);
		this._size = size;
		this._initLayout();
	},

	onAdd: function () {
		if (this._container) {
			this.getPane().appendChild(this._container);
			this.update();
		}

		this._spinnerInterval = L.LOUtil.startSpinner(this._spinnerCanvas, this.options.spinnerSpeed);
		this._map.on('moveend', this.update, this);
	},

	onRemove: function () {
		if (this._container) {
			this.getPane().removeChild(this._container);
		}

		if (this._spinnerInterval) {
			clearInterval(this._spinnerInterval);
		}
	},

	update: function () {
		if (this._container && this._map) {
			var origin = new L.Point(0, 0);
			var paneOffset = this._map.layerPointToContainerPoint(origin);
			var sizeOffset = this._size.divideBy(2, true);
			var position = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(position.subtract(paneOffset).subtract(sizeOffset));
		}
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-progress-layer');
		this._spinner = L.DomUtil.create('div', 'leaflet-progress-spinner', this._container);
		this._spinnerCanvas = L.DomUtil.create('canvas', 'leaflet-progress-spinner-canvas', this._spinner);
		this._label = L.DomUtil.create('div', 'leaflet-progress-label', this._container);
		this._progress = L.DomUtil.create('div', 'leaflet-progress', this._container);
		this._bar = L.DomUtil.create('span', '', this._progress);
		this._value = L.DomUtil.create('span', '', this._bar);

		L.DomUtil.setStyle(this._value, 'line-height', this._size.y + 'px');

		this._container.style.width  = this._size.x + 'px';

		L.DomEvent
			.disableClickPropagation(this._progress)
			.disableScrollPropagation(this._container);
	},

	_setPos: function (pos) {
		L.DomUtil.setPosition(this._container, pos);
	},

	setLabel: function (label) {
		if (this._label.innerHTML !== label) {
			this._label.innerHTML = label;
		}
	},

	setBar: function (bar) {
		if (bar) {
			this._progress.style.visibility = '';
		}
		else {
			this._progress.style.visibility = 'hidden';
		}
	},

	setValue: function (value) {
		this._bar.style.width = value + '%';
		this._value.innerHTML = value + '%';
	}
});

L.progressOverlay = function (latlng, size) {
	return new L.ProgressOverlay(latlng, size);
};


/*
 * L.Icon is an image-based icon class that you can use with L.Marker for custom markers.
 */

L.Icon = L.Class.extend({
	/*
	options: {
		iconUrl: (String) (required)
		iconRetinaUrl: (String) (optional, used for retina devices if detected)
		iconSize: (Point) (can be set through CSS)
		iconAnchor: (Point) (centered by default, can be set in CSS with negative margins)
		popupAnchor: (Point) (if not specified, popup opens in the anchor point)
		shadowUrl: (String) (no shadow by default)
		shadowRetinaUrl: (String) (optional, used for retina devices if detected)
		shadowSize: (Point)
		shadowAnchor: (Point)
		className: (String)
	},
	*/

	initialize: function (options) {
		L.setOptions(this, options);
	},

	createIcon: function (oldIcon) {
		return this._createIcon('icon', oldIcon);
	},

	createShadow: function (oldIcon) {
		return this._createIcon('shadow', oldIcon);
	},

	_createIcon: function (name, oldIcon) {
		var src = this._getIconUrl(name);

		if (!src) {
			if (name === 'icon') {
				throw new Error('iconUrl not set in Icon options (see the docs).');
			}
			return null;
		}

		var img = this._createImg(src, oldIcon && oldIcon.tagName === 'IMG' ? oldIcon : null);
		this._setIconStyles(img, name);

		return img;
	},

	_setIconStyles: function (img, name) {
		var options = this.options,
		    size = L.point(options[name + 'Size']),
		    anchor = L.point(name === 'shadow' && options.shadowAnchor || options.iconAnchor ||
		            size && size.divideBy(2, true));

		img.className = 'leaflet-marker-' + name + ' ' + (options.className || '');

		if (anchor) {
			img.style.marginLeft = (-anchor.x) + 'px';
			img.style.marginTop  = (-anchor.y) + 'px';
		}

		if (size) {
			img.style.width  = size.x + 'px';
			img.style.height = size.y + 'px';
		}
	},

	_createImg: function (src, el) {
		el = el || document.createElement('img');
		el.src = src;
		return el;
	},

	_getIconUrl: function (name) {
		return L.Browser.retina && this.options[name + 'RetinaUrl'] || this.options[name + 'Url'];
	}
});

L.icon = function (options) {
	return new L.Icon(options);
};


/*
 * L.Icon.Default is the blue marker icon used by default in Leaflet.
 */

L.Icon.Default = L.Icon.extend({

	options: {
		iconSize:    [25, 41],
		iconAnchor:  [12, 41],
		popupAnchor: [1, -34],
		shadowSize:  [41, 41]
	},

	_getIconUrl: function (name) {
		var key = name + 'Url';

		if (this.options[key]) {
			return this.options[key];
		}

		var path = L.Icon.Default.imagePath;

		if (!path) {
			throw new Error('Couldn\'t autodetect L.Icon.Default.imagePath, set it manually.');
		}

		return path + '/marker-' + name + (L.Browser.retina && name === 'icon' ? '-2x' : '') + '.png';
	}
});

L.Icon.Default.imagePath = (function () {
	var scripts = document.getElementsByTagName('script'),
	    leafletRe = /[\/^]loleaflet/;

	var i, len, src, path;
	for (i = 0, len = scripts.length; i < len; i++) {
		src = scripts[i].src;
		if (src.match(leafletRe)) {
			path = src.substring(0, src.lastIndexOf('/'));
			return (path ? path + '/' : '') + 'images';
		}
	}
}());


/*
 * L.Marker is used to display clickable/draggable icons on the map.
 */

L.Marker = L.Layer.extend({

	options: {
		pane: 'markerPane',

		icon: new L.Icon.Default(),
		// title: '',
		// alt: '',
		interactive: true,
		draggable: false,
		keyboard: true,
		zIndexOffset: 0,
		opacity: 1,
		// riseOnHover: false,
		riseOffset: 250
	},

	initialize: function (latlng, options) {
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
	},

	setDraggable: function(val) {
		if (!this.dragging) {
			this.options.draggable = val;
			return;
		}

		if (val) {
			this.dragging.enable();
		} else {
			this.dragging.disable();
		}
	},

	onAdd: function (map) {
		this._zoomAnimated = this._zoomAnimated && map.options.markerZoomAnimation;

		this._initIcon();
		this.update();
	},

	onRemove: function () {
		if (this.dragging && this.dragging.enabled()) {
			this.dragging.removeHooks();
		}

		this._removeIcon();
		this._removeShadow();
	},

	getEvents: function () {
		var events = {viewreset: this.update};

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	},

	getLatLng: function () {
		return this._latlng;
	},

	setLatLng: function (latlng) {
		var oldLatLng = this._latlng;
		this._latlng = L.latLng(latlng);
		this.update();
		return this.fire('move', {oldLatLng: oldLatLng, latlng: this._latlng});
	},

	setZIndexOffset: function (offset) {
		this.options.zIndexOffset = offset;
		return this.update();
	},

	setIcon: function (icon) {

		this.options.icon = icon;

		if (this._map) {
			this._initIcon();
			this.update();
		}

		if (this._popup) {
			this.bindPopup(this._popup, this._popup.options);
		}

		return this;
	},

	update: function () {

		if (this._icon) {
			var pos = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(pos);
		}

		return this;
	},

	_initIcon: function () {
		var options = this.options,
		    classToAdd = 'leaflet-zoom-' + (this._zoomAnimated ? 'animated' : 'hide');

		var icon = options.icon.createIcon(this._icon),
		    addIcon = false;

		// if we're not reusing the icon, remove the old one and init new one
		if (icon !== this._icon) {
			if (this._icon) {
				this._removeIcon();
			}
			addIcon = true;

			if (options.title) {
				icon.title = options.title;
			}
			if (options.alt) {
				icon.alt = options.alt;
			}
		}

		L.DomUtil.addClass(icon, classToAdd);

		if (options.keyboard) {
			icon.tabIndex = '0';
		}

		this._icon = icon;
		this._initInteraction();

		if (options.riseOnHover) {
			this.on({
				mouseover: this._bringToFront,
				mouseout: this._resetZIndex
			});
		}

		var newShadow = options.icon.createShadow(this._shadow),
		    addShadow = false;

		if (newShadow !== this._shadow) {
			this._removeShadow();
			addShadow = true;
		}

		if (newShadow) {
			L.DomUtil.addClass(newShadow, classToAdd);
		}
		this._shadow = newShadow;


		if (options.opacity < 1) {
			this._updateOpacity();
		}


		if (addIcon) {
			this.getPane().appendChild(this._icon);
		}
		if (newShadow && addShadow) {
			this.getPane('shadowPane').appendChild(this._shadow);
		}
	},

	_removeIcon: function () {
		if (this.options.riseOnHover) {
			this.off({
				mouseover: this._bringToFront,
				mouseout: this._resetZIndex
			});
		}

		L.DomUtil.remove(this._icon);
		this.removeInteractiveTarget(this._icon);

		this._icon = null;
	},

	_removeShadow: function () {
		if (this._shadow) {
			L.DomUtil.remove(this._shadow);
		}
		this._shadow = null;
	},

	_setPos: function (pos) {
		L.DomUtil.setPosition(this._icon, pos);

		if (this._shadow) {
			L.DomUtil.setPosition(this._shadow, pos);
		}

		this._zIndex = pos.y + this.options.zIndexOffset;

		this._resetZIndex();
	},

	_updateZIndex: function (offset) {
		this._icon.style.zIndex = this._zIndex + offset;
	},

	_animateZoom: function (opt) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center).round();

		this._setPos(pos);
	},

	_initInteraction: function () {

		if (!this.options.interactive) { return; }

		L.DomUtil.addClass(this._icon, 'leaflet-interactive');

		this.addInteractiveTarget(this._icon);

		if (L.Handler.MarkerDrag) {
			var draggable = this.options.draggable;
			if (this.dragging) {
				draggable = this.dragging.enabled();
				this.dragging.disable();
			}

			this.dragging = new L.Handler.MarkerDrag(this);

			if (draggable) {
				this.dragging.enable();
			}
		}
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		if (this._map) {
			this._updateOpacity();
		}

		return this;
	},

	_updateOpacity: function () {
		var opacity = this.options.opacity;

		L.DomUtil.setOpacity(this._icon, opacity);

		if (this._shadow) {
			L.DomUtil.setOpacity(this._shadow, opacity);
		}
	},

	_bringToFront: function () {
		this._updateZIndex(this.options.riseOffset);
	},

	_resetZIndex: function () {
		this._updateZIndex(0);
	}
});

L.marker = function (latlng, options) {
	return new L.Marker(latlng, options);
};


/*
 * L.Cursor blinking cursor.
 */

L.Cursor = L.Layer.extend({

	options: {
		opacity: 1,
		zIndex: 1000
	},

	initialize: function (latlng, size, options) {
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
		this._size = L.point(size);
		this._initLayout();
	},

	onAdd: function () {
		if (!this._container) {
			this._initLayout();
		}

		this.update();
		this.getPane().appendChild(this._container);
	},

	onRemove: function () {
		if (this._container) {
			this.getPane().removeChild(this._container);
		}
	},

	getEvents: function () {
		var events = {viewreset: this.update};

		return events;
	},

	getLatLng: function () {
		return this._latlng;
	},

	setLatLng: function (latlng, size) {
		var oldLatLng = this._latlng;
		this._latlng = L.latLng(latlng);
		this._size = L.point(size);
		this.update();
		return this.fire('move', {oldLatLng: oldLatLng, latlng: this._latlng});
	},

	update: function () {
		if (this._container && this._map) {
			var pos = this._map.latLngToLayerPoint(this._latlng).round();
			this._setSize();
			this._setPos(pos);
		}
		return this;
	},

	setOpacity: function (opacity) {
		if (this._container) {
			L.DomUtil.setOpacity(this._cursor, opacity);
		}
	},

	showCursorHeader: function() {
		if (this._cursorHeader) {
			L.DomUtil.setStyle(this._cursorHeader, 'visibility', 'visible');

			setTimeout(L.bind(function() {
				L.DomUtil.setStyle(this._cursorHeader, 'visibility', 'hidden');
			}, this), this.options.headerTimeout);
		}
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-cursor-container');
		if (this.options.header) {
			this._cursorHeader = L.DomUtil.create('div', 'leaflet-cursor-header', this._container);

			this._cursorHeader.innerHTML = this.options.headerName;

			setTimeout(L.bind(function() {
				L.DomUtil.setStyle(this._cursorHeader, 'visibility', 'hidden');
			}, this), this.options.headerTimeout);
		}
		this._cursor = L.DomUtil.create('div', 'leaflet-cursor', this._container);
		if (this.options.blink) {
			L.DomUtil.addClass(this._cursor, 'blinking-cursor');
		}

		if (this.options.color) {
			L.DomUtil.setStyle(this._cursorHeader, 'background', this.options.color);
			L.DomUtil.setStyle(this._cursor, 'background', this.options.color);
		}

		L.DomEvent
			.disableClickPropagation(this._cursor)
			.disableScrollPropagation(this._container);
	},

	_setPos: function (pos) {
		L.DomUtil.setPosition(this._container, pos);
		this._container.style.zIndex = this.options.zIndex;
	},

	_setSize: function () {
		this._cursor.style.height = this._size.y + 'px';
		this._container.style.top = '-' + (this._container.clientHeight - this._size.y - 2) / 2 + 'px';
	}
});

L.cursor = function (latlng, size, options) {
	return new L.Cursor(latlng, size, options);
};

L.Cursor.getCursorURL = function (localPath) {
	var scripts = document.getElementsByTagName('script'),
	    leafletRe = /[\/^]leaflet[\-\._]?([\w\-\._]*)\.js\??/;

	var i, len, src, path;

	for (i = 0, len = scripts.length; i < len; i++) {
		src = scripts[i].src;

		if (src.match(leafletRe)) {
			path = src.split(leafletRe)[0];
			return (path ? path + '/' : '') + localPath;
		}
	}
};

L.Cursor.hotSpot = {
	fill: {x: 7, y: 16}
};

L.Cursor.customCursors = [
	'fill'
];

L.Cursor.isCustomCursor = function (cursorName) {
	return (L.Cursor.customCursors.indexOf(cursorName) !== -1);
};

L.Cursor.getCustomCursor = function (cursorName) {
	var customCursor;

	if (L.Cursor.isCustomCursor(cursorName)) {
		var cursorHotSpot = L.Cursor.hotSpot[cursorName] || {x: 0, y: 0};
		customCursor = L.Browser.ie ? // IE10 does not like item with left/top position in the url list
			'url(' + L.Cursor.imagePath + '/' + cursorName + '.cur), default' :
			'url(' + L.Cursor.imagePath + '/' + cursorName + '.png) ' + cursorHotSpot.x + ' ' + cursorHotSpot.y + ', default';
	}
	return customCursor;
};


/*
 * L.DivIcon is a lightweight HTML-based icon class (as opposed to the image-based L.Icon)
 * to use with L.Marker.
 */

L.DivIcon = L.Icon.extend({
	options: {
		iconSize: [12, 12], // also can be set through CSS
		/*
		iconAnchor: (Point)
		popupAnchor: (Point)
		html: (String)
		bgPos: (Point)
		*/
		className: 'leaflet-div-icon',
		html: false
	},

	createIcon: function (oldIcon) {
		var div = (oldIcon && oldIcon.tagName === 'DIV') ? oldIcon : document.createElement('div'),
		    options = this.options;

		L.DomEvent.on(div, 'contextmenu', L.DomEvent.preventDefault);
		div.innerHTML = options.html !== false ? options.html : '';

		if (options.bgPos) {
			div.style.backgroundPosition = (-options.bgPos.x) + 'px ' + (-options.bgPos.y) + 'px';
		}
		this._setIconStyles(div, 'icon');

		return div;
	},

	createShadow: function () {
		return null;
	}
});

L.divIcon = function (options) {
	return new L.DivIcon(options);
};


/*
 * L.Popup is used for displaying popups on the map.
 */

L.Map.mergeOptions({
	closePopupOnClick: true
});

L.Popup = L.Layer.extend({

	options: {
		pane: 'popupPane',

		minWidth: 50,
		maxWidth: 300,
		// maxHeight: <Number>,
		offset: [0, 7],

		autoPan: true,
		autoPanPadding: [5, 5],
		// autoPanPaddingTopLeft: <Point>,
		// autoPanPaddingBottomRight: <Point>,

		closeButton: true,
		autoClose: true,
		// keepInView: false,
		// className: '',
		zoomAnimation: true
	},

	initialize: function (options, source) {
		L.setOptions(this, options);

		this._source = source;
	},

	onAdd: function (map) {
		this._zoomAnimated = this._zoomAnimated && this.options.zoomAnimation;

		if (!this._container) {
			this._initLayout();
		}

		if (map._fadeAnimated) {
			L.DomUtil.setOpacity(this._container, 0);
		}

		clearTimeout(this._removeTimeout);
		this.getPane().appendChild(this._container);
		this.update();

		if (map._fadeAnimated) {
			L.DomUtil.setOpacity(this._container, 1);
		}

		map.fire('popupopen', {popup: this});

		if (this._source) {
			this._source.fire('popupopen', {popup: this}, true);
		}
	},

	openOn: function (map) {
		map.openPopup(this);
		return this;
	},

	onRemove: function (map) {
		if (map._fadeAnimated) {
			L.DomUtil.setOpacity(this._container, 0);
			this._removeTimeout = setTimeout(L.bind(L.DomUtil.remove, L.DomUtil, this._container), 200);
		} else {
			L.DomUtil.remove(this._container);
		}

		map.fire('popupclose', {popup: this});

		if (this._source) {
			this._source.fire('popupclose', {popup: this}, true);
		}
	},

	getLatLng: function () {
		return this._latlng;
	},

	setLatLng: function (latlng) {
		this._latlng = L.latLng(latlng);
		if (this._map) {
			this._updatePosition();
			this._adjustPan();
		}
		return this;
	},

	getContent: function () {
		return this._content;
	},

	setContent: function (content) {
		this._content = content;
		this.update();
		return this;
	},

	update: function () {
		if (!this._map) { return; }

		this._container.style.visibility = 'hidden';

		this._updateContent();
		this._updateLayout();
		this._updatePosition();

		this._container.style.visibility = '';

		this._adjustPan();
	},

	getEvents: function () {
		var events = {viewreset: this._updatePosition},
		    options = this.options;

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}
		if ('closeOnClick' in options ? options.closeOnClick : this._map.options.closePopupOnClick) {
			events.preclick = this._close;
		}
		if (options.keepInView) {
			events.moveend = this._adjustPan;
		}
		return events;
	},

	isOpen: function () {
		return !!this._map && this._map.hasLayer(this);
	},

	_close: function () {
		if (this._map) {
			this._map.closePopup(this);
		}
	},

	_initLayout: function () {
		var prefix = 'leaflet-popup',
		    container = this._container = L.DomUtil.create('div',
			prefix + ' ' + (this.options.className || '') +
			' leaflet-zoom-' + (this._zoomAnimated ? 'animated' : 'hide'));

		if (this.options.closeButton) {
			var closeButton = this._closeButton = L.DomUtil.create('a', prefix + '-close-button', container);
			closeButton.href = '#close';
			closeButton.innerHTML = '&#215;';

			L.DomEvent.on(closeButton, 'click', this._onCloseButtonClick, this);
		}

		var wrapper = this._wrapper = L.DomUtil.create('div', prefix + '-content-wrapper', container);
		this._contentNode = L.DomUtil.create('div', prefix + '-content', wrapper);

		L.DomEvent
			.disableClickPropagation(wrapper)
			.disableScrollPropagation(this._contentNode)
			.on(wrapper, 'contextmenu', L.DomEvent.stopPropagation);

		this._tipContainer = L.DomUtil.create('div', prefix + '-tip-container', container);
		this._tip = L.DomUtil.create('div', prefix + '-tip', this._tipContainer);

		if (this.options.backgroundColor) {
			this._tip.style['background-color'] = this._wrapper.style['background-color'] = this.options.backgroundColor;
		}

		if (this.options.color) {
			this._wrapper.style['color'] = this.options.color;
		}

	},

	_updateContent: function () {
		if (!this._content) { return; }

		var node = this._contentNode;

		if (typeof this._content === 'string') {
			node.innerHTML = this._content;
		} else {
			while (node.hasChildNodes()) {
				node.removeChild(node.firstChild);
			}
			node.appendChild(this._content);
		}
		this.fire('contentupdate');
	},

	_updateLayout: function () {
		var container = this._contentNode,
		    style = container.style;

		style.width = '';
		style.whiteSpace = 'nowrap';

		var width = container.offsetWidth;
		width = Math.min(width, this.options.maxWidth);
		width = Math.max(width, this.options.minWidth);

		style.width = (width + 1) + 'px';
		style.whiteSpace = '';

		style.height = '';

		var height = container.offsetHeight,
		    maxHeight = this.options.maxHeight,
		    scrolledClass = 'leaflet-popup-scrolled';

		if (maxHeight && height > maxHeight) {
			style.height = maxHeight + 'px';
			L.DomUtil.addClass(container, scrolledClass);
		} else {
			L.DomUtil.removeClass(container, scrolledClass);
		}

		this._containerWidth = this._container.offsetWidth;
	},

	_updatePosition: function () {
		if (!this._map) { return; }

		var pos = this._map.latLngToLayerPoint(this._latlng),
		    offset = L.point(this.options.offset);

		if (this._zoomAnimated) {
			L.DomUtil.setPosition(this._container, pos);
		} else {
			offset = offset.add(pos);
		}

		var bottom = this._containerBottom = -offset.y,
		    left = this._containerLeft = -Math.round(this._containerWidth / 2) + offset.x;

		// bottom position the popup in case the height of the popup changes (images loading etc)
		this._container.style.bottom = bottom + 'px';
		this._container.style.left = left + 'px';
	},

	_animateZoom: function (e) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center);
		L.DomUtil.setPosition(this._container, pos);
	},

	_adjustPan: function () {
		if (!this.options.autoPan) { return; }

		var map = this._map,
		    containerHeight = this._container.offsetHeight,
		    containerWidth = this._containerWidth,
		    layerPos = new L.Point(this._containerLeft, -containerHeight - this._containerBottom);

		if (this._zoomAnimated) {
			layerPos._add(L.DomUtil.getPosition(this._container));
		}

		var containerPos = map.layerPointToContainerPoint(layerPos),
		    padding = L.point(this.options.autoPanPadding),
		    paddingTL = L.point(this.options.autoPanPaddingTopLeft || padding),
		    paddingBR = L.point(this.options.autoPanPaddingBottomRight || padding),
		    size = map.getSize(),
		    dx = 0,
		    dy = 0;

		if (containerPos.x + containerWidth + paddingBR.x > size.x) { // right
			dx = containerPos.x + containerWidth - size.x + paddingBR.x;
		}
		if (containerPos.x - dx - paddingTL.x < 0) { // left
			dx = containerPos.x - paddingTL.x;
		}
		if (containerPos.y + containerHeight + paddingBR.y > size.y) { // bottom
			dy = containerPos.y + containerHeight - size.y + paddingBR.y;
		}
		if (containerPos.y - dy - paddingTL.y < 0) { // top
			dy = containerPos.y - paddingTL.y;
		}

		if (dx || dy) {
			map
			    .fire('autopanstart')
			    .panBy([dx, dy]);
		}
	},

	_onCloseButtonClick: function (e) {
		this._close();
		L.DomEvent.stop(e);
	}
});

L.popup = function (options, source) {
	return new L.Popup(options, source);
};


L.Map.include({
	openPopup: function (popup, latlng, options) { // (Popup) or (String || HTMLElement, LatLng[, Object])
		if (!(popup instanceof L.Popup)) {
			var content = popup;

			popup = new L.Popup(options).setContent(content);
		}

		if (latlng) {
			popup.setLatLng(latlng);
		}

		if (this.hasLayer(popup)) {
			return this;
		}

		if (this._popup && this._popup.options.autoClose) {
			this.closePopup();
		}

		this._popup = popup;
		return this.addLayer(popup);
	},

	closePopup: function (popup) {
		if (!popup || popup === this._popup) {
			popup = this._popup;
			this._popup = null;
		}
		if (popup) {
			this.removeLayer(popup);
		}
		return this;
	}
});


/*
 * Adds popup-related methods to all layers.
 */

L.Layer.include({

	bindPopup: function (content, options) {

		if (content instanceof L.Popup) {
			L.setOptions(content, options);
			this._popup = content;
			content._source = this;
		} else {
			if (!this._popup || options) {
				this._popup = new L.Popup(options, this);
			}
			this._popup.setContent(content);
		}

		if (!this._popupHandlersAdded) {
			this.on({
				click: this._openPopup,
				remove: this.closePopup,
				move: this._movePopup
			});
			this._popupHandlersAdded = true;
		}

		return this;
	},

	unbindPopup: function () {
		if (this._popup) {
			this.off({
				click: this._openPopup,
				remove: this.closePopup,
				move: this._movePopup
			});
			this._popupHandlersAdded = false;
			this._popup = null;
		}
		return this;
	},

	openPopup: function (latlng) {
		if (this._popup && this._map) {
			this._map.openPopup(this._popup, latlng || this._latlng || this.getCenter());
		}
		return this;
	},

	closePopup: function () {
		if (this._popup) {
			this._popup._close();
		}
		return this;
	},

	togglePopup: function () {
		if (this._popup) {
			if (this._popup._map) {
				this.closePopup();
			} else {
				this.openPopup();
			}
		}
		return this;
	},

	setPopupContent: function (content) {
		if (this._popup) {
			this._popup.setContent(content);
		}
		return this;
	},

	getPopup: function () {
		return this._popup;
	},

	_openPopup: function (e) {
		this._map.openPopup(this._popup, e.latlng);
	},

	_movePopup: function (e) {
		this._popup.setLatLng(e.latlng);
	}
});


/*
 * Popup extension to L.Marker, adding popup-related methods.
 */

L.Marker.include({
	bindPopup: function (content, options) {
		var anchor = L.point(this.options.icon.options.popupAnchor || [0, 0])
			.add(L.Popup.prototype.options.offset);

		options = L.extend({offset: anchor}, options);

		return L.Layer.prototype.bindPopup.call(this, content, options);
	},

	_openPopup: L.Layer.prototype.togglePopup
});


/*
 * L.LayerGroup is a class to combine several layers into one so that
 * you can manipulate the group (e.g. add/remove it) as one layer.
 */

L.LayerGroup = L.Layer.extend({

	initialize: function (layers) {
		this._layers = {};

		var i, len;

		if (layers) {
			for (i = 0, len = layers.length; i < len; i++) {
				this.addLayer(layers[i]);
			}
		}
	},

	addLayer: function (layer) {
		var id = this.getLayerId(layer);

		this._layers[id] = layer;

		if (this._map) {
			this._map.addLayer(layer);
		}

		return this;
	},

	removeLayer: function (layer) {
		var id = layer in this._layers ? layer : this.getLayerId(layer);

		if (this._map && this._layers[id]) {
			this._map.removeLayer(this._layers[id]);
		}

		delete this._layers[id];

		return this;
	},

	hasLayer: function (layer) {
		return !!layer && (layer in this._layers || this.getLayerId(layer) in this._layers);
	},

	clearLayers: function () {
		for (var i in this._layers) {
			this.removeLayer(this._layers[i]);
		}
		return this;
	},

	invoke: function (methodName) {
		var args = Array.prototype.slice.call(arguments, 1),
		    i, layer;

		for (i in this._layers) {
			layer = this._layers[i];

			if (layer[methodName]) {
				layer[methodName].apply(layer, args);
			}
		}

		return this;
	},

	onAdd: function (map) {
		for (var i in this._layers) {
			map.addLayer(this._layers[i]);
		}
	},

	onRemove: function (map) {
		for (var i in this._layers) {
			map.removeLayer(this._layers[i]);
		}
	},

	eachLayer: function (method, context) {
		for (var i in this._layers) {
			method.call(context, this._layers[i]);
		}
		return this;
	},

	getLayer: function (id) {
		return this._layers[id];
	},

	getLayers: function () {
		var layers = [];

		for (var i in this._layers) {
			layers.push(this._layers[i]);
		}
		return layers;
	},

	setZIndex: function (zIndex) {
		return this.invoke('setZIndex', zIndex);
	},

	getLayerId: function (layer) {
		return L.stamp(layer);
	}
});

L.layerGroup = function (layers) {
	return new L.LayerGroup(layers);
};


/*
 * L.FeatureGroup extends L.LayerGroup by introducing mouse events and additional methods
 * shared between a group of interactive layers (like vectors or markers).
 */

L.FeatureGroup = L.LayerGroup.extend({

	addLayer: function (layer) {
		if (this.hasLayer(layer)) {
			return this;
		}

		layer.addEventParent(this);

		L.LayerGroup.prototype.addLayer.call(this, layer);

		if (this._popupContent && layer.bindPopup) {
			layer.bindPopup(this._popupContent, this._popupOptions);
		}

		return this.fire('layeradd', {layer: layer});
	},

	removeLayer: function (layer) {
		if (!this.hasLayer(layer)) {
			return this;
		}
		if (layer in this._layers) {
			layer = this._layers[layer];
		}

		layer.removeEventParent(this);

		L.LayerGroup.prototype.removeLayer.call(this, layer);

		if (this._popupContent) {
			this.invoke('unbindPopup');
		}

		return this.fire('layerremove', {layer: layer});
	},

	bindPopup: function (content, options) {
		this._popupContent = content;
		this._popupOptions = options;
		return this.invoke('bindPopup', content, options);
	},

	openPopup: function (latlng) {
		// open popup on the first layer
		for (var id in this._layers) {
			this._layers[id].openPopup(latlng);
			break;
		}
		return this;
	},

	setStyle: function (style) {
		return this.invoke('setStyle', style);
	},

	bringToFront: function () {
		return this.invoke('bringToFront');
	},

	bringToBack: function () {
		return this.invoke('bringToBack');
	},

	getBounds: function () {
		var bounds = new L.LatLngBounds();

		this.eachLayer(function (layer) {
			bounds.extend(layer.getBounds ? layer.getBounds() : layer.getLatLng());
		});

		return bounds;
	}
});

L.featureGroup = function (layers) {
	return new L.FeatureGroup(layers);
};


/*
 * L.Renderer is a base class for renderer implementations (SVG, Canvas);
 * handles renderer container, bounds and zoom animation.
 */

L.Renderer = L.Layer.extend({

	options: {
		// how much to extend the clip area around the map view (relative to its size)
		// e.g. 0.1 would be 10% of map view in each direction; defaults to clip with the map view
		padding: 0
	},

	initialize: function (options) {
		L.setOptions(this, options);
		L.stamp(this);
	},

	onAdd: function () {
		if (!this._container) {
			this._initContainer(); // defined by renderer implementations

			if (this._zoomAnimated) {
				L.DomUtil.addClass(this._container, 'leaflet-zoom-animated');
			}
		}

		this.getPane().appendChild(this._container);
		this._update();
	},

	onRemove: function () {
		L.DomUtil.remove(this._container);
	},

	getEvents: function () {
		var events = {
			moveend: this._update
		};
		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}
		return events;
	},

	_animateZoom: function (e) {
		var origin = e.origin.subtract(this._map._getCenterLayerPoint()),
		    offset = this._bounds.min.add(origin.multiplyBy(1 - e.scale)).add(e.offset).round();

		L.DomUtil.setTransform(this._container, offset, e.scale);
	},

	_update: function () {
		// update pixel bounds of renderer container (for positioning/sizing/clipping later)
		var p = this.options.padding,
		    size = this._map.getSize(),
		    min = this._map.containerPointToLayerPoint(size.multiplyBy(-p)).round();

		this._bounds = new L.Bounds(min, min.add(size.multiplyBy(1 + p * 2)).round());
	}
});


L.Map.include({
	// used by each vector layer to decide which renderer to use
	getRenderer: function (layer) {
		var renderer = layer.options.renderer || this._getPaneRenderer(layer.options.pane) || this.options.renderer || this._renderer;

		if (!renderer) {
			renderer = this._renderer = (L.SVG && L.svg()) || (L.Canvas && L.canvas());
		}

		if (!this.hasLayer(renderer)) {
			this.addLayer(renderer);
		}
		return renderer;
	},

	_getPaneRenderer: function (name) {
		if (name === 'overlayPane' || name === undefined) {
			return false;
		}

		var renderer = this._paneRenderers[name];
		if (renderer === undefined) {
			renderer = (L.SVG && L.svg({pane: name})) || (L.Canvas && L.canvas({pane: name}));
			this._paneRenderers[name] = renderer;
		}
		return renderer;
	}
});


/*
 * L.Path is the base class for all Leaflet vector layers like polygons and circles.
 */

L.Path = L.Layer.extend({

	options: {
		stroke: true,
		color: '#3388ff',
		weight: 3,
		opacity: 1,
		lineCap: 'round',
		lineJoin: 'round',
		// dashArray: null
		// dashOffset: null

		// fill: false
		// fillColor: same as color by default
		fillOpacity: 0.2,
		fillRule: 'evenodd',

		// className: ''
		interactive: true
	},

	onAdd: function () {
		this._renderer = this._map.getRenderer(this);
		this._renderer._initPath(this);

		// defined in children classes
		this._project();
		this._update();

		this._renderer._addPath(this);
	},

	onRemove: function () {
		this._renderer._removePath(this);
	},

	getEvents: function () {
		return {
			viewreset: this._project,
			moveend: this._update
		};
	},

	redraw: function () {
		if (this._map) {
			this._renderer._updatePath(this);
		}
		return this;
	},

	setStyle: function (style) {
		L.setOptions(this, style);
		if (this._renderer) {
			this._renderer._updateStyle(this);
		}
		return this;
	},

	bringToFront: function () {
		if (this._renderer) {
			this._renderer._bringToFront(this);
		}
		return this;
	},

	bringToBack: function () {
		if (this._renderer) {
			this._renderer._bringToBack(this);
		}
		return this;
	},

	_clickTolerance: function () {
		// used when doing hit detection for Canvas layers
		return (this.options.stroke ? this.options.weight / 2 : 0) + (L.Browser.touch ? 10 : 0);
	}
});


/*
 * Popup extension to L.Path (polylines, polygons, circles), adding popup-related methods.
 */

L.Path.include({

	bindPopup: function (content, options) {

		if (content instanceof L.Popup) {
			this._popup = content;
		} else {
			if (!this._popup || options) {
				this._popup = new L.Popup(options, this);
			}
			this._popup.setContent(content);
		}

		if (!this._popupHandlersAdded) {
			this.on({
				mouseover: this._openPopup,
				mouseout: this._delayClose,
				remove: this.closePopup,
				add: this.firstPopup
			});

			this._popupHandlersAdded = true;
		}

		return this;
	},

	unbindPopup: function () {
		if (this._popup) {
			this._popup = null;
			this.off({
				mouseover: this._openPopup,
				mouseout: this._delayClose,
				remove: this.closePopup,
				add: this.firstPopup
			});

			this._popupHandlersAdded = false;
		}
		return this;
	},

	firstPopup: function (e) {
		if (this._popup) {
			this._openPopup({latlng: this._bounds.getCenter()});
		}
	},

	closePopup: function () {
		if (this._popup) {
			this._popup._close();
		}
		return this;
	},

	_delayClose: function () {
		clearTimeout(this._timer);
		this._timer = setTimeout(L.bind(this.closePopup, this), 3000);
	},

	_openPopup: function (e) {
		if (!this._map.hasLayer(this._popup)) {
			this._popup.setLatLng(e.latlng);
			this._map.openPopup(this._popup);
			this._delayClose();
		}
	}
});


/*
 * L.LineUtil contains different utility functions for line segments
 * and polylines (clipping, simplification, distances, etc.)
 */

L.LineUtil = {

	// Simplify polyline with vertex reduction and Douglas-Peucker simplification.
	// Improves rendering performance dramatically by lessening the number of points to draw.

	simplify: function (points, tolerance) {
		if (!tolerance || !points.length) {
			return points.slice();
		}

		var sqTolerance = tolerance * tolerance;

		// stage 1: vertex reduction
		points = this._reducePoints(points, sqTolerance);

		// stage 2: Douglas-Peucker simplification
		points = this._simplifyDP(points, sqTolerance);

		return points;
	},

	// distance from a point to a segment between two points
	pointToSegmentDistance:  function (p, p1, p2) {
		return Math.sqrt(this._sqClosestPointOnSegment(p, p1, p2, true));
	},

	closestPointOnSegment: function (p, p1, p2) {
		return this._sqClosestPointOnSegment(p, p1, p2);
	},

	// Douglas-Peucker simplification, see http://en.wikipedia.org/wiki/Douglas-Peucker_algorithm
	_simplifyDP: function (points, sqTolerance) {

		var len = points.length,
		    ArrayConstructor = typeof Uint8Array !== undefined + '' ? Uint8Array : Array,
		    markers = new ArrayConstructor(len);

		markers[0] = markers[len - 1] = 1;

		this._simplifyDPStep(points, markers, sqTolerance, 0, len - 1);

		var i,
		    newPoints = [];

		for (i = 0; i < len; i++) {
			if (markers[i]) {
				newPoints.push(points[i]);
			}
		}

		return newPoints;
	},

	_simplifyDPStep: function (points, markers, sqTolerance, first, last) {

		var maxSqDist = 0,
		    index, i, sqDist;

		for (i = first + 1; i <= last - 1; i++) {
			sqDist = this._sqClosestPointOnSegment(points[i], points[first], points[last], true);

			if (sqDist > maxSqDist) {
				index = i;
				maxSqDist = sqDist;
			}
		}

		if (maxSqDist > sqTolerance) {
			markers[index] = 1;

			this._simplifyDPStep(points, markers, sqTolerance, first, index);
			this._simplifyDPStep(points, markers, sqTolerance, index, last);
		}
	},

	// reduce points that are too close to each other to a single point
	_reducePoints: function (points, sqTolerance) {
		var reducedPoints = [points[0]];

		for (var i = 1, prev = 0, len = points.length; i < len; i++) {
			if (this._sqDist(points[i], points[prev]) > sqTolerance) {
				reducedPoints.push(points[i]);
				prev = i;
			}
		}
		if (prev < len - 1) {
			reducedPoints.push(points[len - 1]);
		}
		return reducedPoints;
	},

	// Cohen-Sutherland line clipping algorithm.
	// Used to avoid rendering parts of a polyline that are not currently visible.

	clipSegment: function (a, b, bounds, useLastCode, round) {
		var codeA = useLastCode ? this._lastCode : this._getBitCode(a, bounds),
		    codeB = this._getBitCode(b, bounds),

		    codeOut, p, newCode;

		// save 2nd code to avoid calculating it on the next segment
		this._lastCode = codeB;

		while (true) {
			// if a,b is inside the clip window (trivial accept)
			if (!(codeA | codeB)) {
				return [a, b];
			// if a,b is outside the clip window (trivial reject)
			} else if (codeA & codeB) {
				return false;
			// other cases
			} else {
				codeOut = codeA || codeB;
				p = this._getEdgeIntersection(a, b, codeOut, bounds, round);
				newCode = this._getBitCode(p, bounds);

				if (codeOut === codeA) {
					a = p;
					codeA = newCode;
				} else {
					b = p;
					codeB = newCode;
				}
			}
		}
	},

	_getEdgeIntersection: function (a, b, code, bounds, round) {
		var dx = b.x - a.x,
		    dy = b.y - a.y,
		    min = bounds.min,
		    max = bounds.max,
		    x, y;

		if (code & 8) { // top
			x = a.x + dx * (max.y - a.y) / dy;
			y = max.y;

		} else if (code & 4) { // bottom
			x = a.x + dx * (min.y - a.y) / dy;
			y = min.y;

		} else if (code & 2) { // right
			x = max.x;
			y = a.y + dy * (max.x - a.x) / dx;

		} else if (code & 1) { // left
			x = min.x;
			y = a.y + dy * (min.x - a.x) / dx;
		}

		return new L.Point(x, y, round);
	},

	_getBitCode: function (/*Point*/ p, bounds) {
		var code = 0;

		if (p.x < bounds.min.x) { // left
			code |= 1;
		} else if (p.x > bounds.max.x) { // right
			code |= 2;
		}

		if (p.y < bounds.min.y) { // bottom
			code |= 4;
		} else if (p.y > bounds.max.y) { // top
			code |= 8;
		}

		return code;
	},

	// square distance (to avoid unnecessary Math.sqrt calls)
	_sqDist: function (p1, p2) {
		var dx = p2.x - p1.x,
		    dy = p2.y - p1.y;
		return dx * dx + dy * dy;
	},

	// return closest point on segment or distance to that point
	_sqClosestPointOnSegment: function (p, p1, p2, sqDist) {
		var x = p1.x,
		    y = p1.y,
		    dx = p2.x - x,
		    dy = p2.y - y,
		    dot = dx * dx + dy * dy,
		    t;

		if (dot > 0) {
			t = ((p.x - x) * dx + (p.y - y) * dy) / dot;

			if (t > 1) {
				x = p2.x;
				y = p2.y;
			} else if (t > 0) {
				x += dx * t;
				y += dy * t;
			}
		}

		dx = p.x - x;
		dy = p.y - y;

		return sqDist ? dx * dx + dy * dy : new L.Point(x, y);
	}
};


/*
 * L.Polyline implements polyline vector layer (a set of points connected with lines)
 */

L.Polyline = L.Path.extend({

	options: {
		// how much to simplify the polyline on each zoom level
		// more = better performance and smoother look, less = more accurate
		smoothFactor: 1.0
		// noClip: false
	},

	initialize: function (latlngs, options) {
		L.setOptions(this, options);
		this._setLatLngs(latlngs);
	},

	getLatLngs: function () {
		// TODO rings
		return this._latlngs;
	},

	setLatLngs: function (latlngs) {
		this._setLatLngs(latlngs);
		return this.redraw();
	},

	addLatLng: function (latlng) {
		// TODO rings
		latlng = L.latLng(latlng);
		this._latlngs.push(latlng);
		this._bounds.extend(latlng);
		return this.redraw();
	},

	spliceLatLngs: function () {
		// TODO rings
		var removed = [].splice.apply(this._latlngs, arguments);
		this._setLatLngs(this._latlngs);
		this.redraw();
		return removed;
	},

	closestLayerPoint: function (p) {
		var minDistance = Infinity,
		    minPoint = null,
		    closest = L.LineUtil._sqClosestPointOnSegment,
		    p1, p2;

		for (var j = 0, jLen = this._parts.length; j < jLen; j++) {
			var points = this._parts[j];

			for (var i = 1, len = points.length; i < len; i++) {
				p1 = points[i - 1];
				p2 = points[i];

				var sqDist = closest(p, p1, p2, true);

				if (sqDist < minDistance) {
					minDistance = sqDist;
					minPoint = closest(p, p1, p2);
				}
			}
		}
		if (minPoint) {
			minPoint.distance = Math.sqrt(minDistance);
		}
		return minPoint;
	},

	getCenter: function () {
		var i, halfDist, segDist, dist, p1, p2, ratio,
		    points = this._rings[0],
		    len = points.length;

		// polyline centroid algorithm; only uses the first ring if there are multiple

		for (i = 0, halfDist = 0; i < len - 1; i++) {
			halfDist += points[i].distanceTo(points[i + 1]) / 2;
		}

		for (i = 0, dist = 0; i < len - 1; i++) {
			p1 = points[i];
			p2 = points[i + 1];
			segDist = p1.distanceTo(p2);
			dist += segDist;

			if (dist > halfDist) {
				ratio = (dist - halfDist) / segDist;
				return this._map.layerPointToLatLng([
					p2.x - ratio * (p2.x - p1.x),
					p2.y - ratio * (p2.y - p1.y)
				]);
			}
		}
	},

	getBounds: function () {
		return this._bounds;
	},

	_setLatLngs: function (latlngs) {
		this._bounds = new L.LatLngBounds();
		this._latlngs = this._convertLatLngs(latlngs);
	},

	// recursively convert latlngs input into actual LatLng instances; calculate bounds along the way
	_convertLatLngs: function (latlngs) {
		var result = [],
		    flat = this._flat(latlngs);

		for (var i = 0, len = latlngs.length; i < len; i++) {
			if (flat) {
				result[i] = L.latLng(latlngs[i]);
				this._bounds.extend(result[i]);
			} else {
				result[i] = this._convertLatLngs(latlngs[i]);
			}
		}

		return result;
	},

	_flat: function (latlngs) {
		// true if it's a flat array of latlngs; false if nested
		return !L.Util.isArray(latlngs[0]) || typeof latlngs[0][0] !== 'object';
	},

	_project: function () {
		this._rings = [];
		this._projectLatlngs(this._latlngs, this._rings);

		// project bounds as well to use later for Canvas hit detection/etc.
		var w = this._clickTolerance(),
		    p = new L.Point(w, -w);

		if (this._latlngs.length) {
			this._pxBounds = new L.Bounds(
				this._map.latLngToLayerPoint(this._bounds.getSouthWest())._subtract(p),
				this._map.latLngToLayerPoint(this._bounds.getNorthEast())._add(p));
		}
	},

	// recursively turns latlngs into a set of rings with projected coordinates
	_projectLatlngs: function (latlngs, result) {

		var flat = latlngs[0] instanceof L.LatLng,
		    len = latlngs.length,
		    i, ring;

		if (flat) {
			ring = [];
			for (i = 0; i < len; i++) {
				ring[i] = this._map.latLngToLayerPoint(latlngs[i]);
			}
			result.push(ring);
		} else {
			for (i = 0; i < len; i++) {
				this._projectLatlngs(latlngs[i], result);
			}
		}
	},

	// clip polyline by renderer bounds so that we have less to render for performance
	_clipPoints: function () {
		if (this.options.noClip) {
			this._parts = this._rings;
			return;
		}

		this._parts = [];

		var parts = this._parts,
		    bounds = this._renderer._bounds,
		    i, j, k, len, len2, segment, points;

		for (i = 0, k = 0, len = this._rings.length; i < len; i++) {
			points = this._rings[i];

			for (j = 0, len2 = points.length; j < len2 - 1; j++) {
				segment = L.LineUtil.clipSegment(points[j], points[j + 1], bounds, j, true);

				if (!segment) { continue; }

				parts[k] = parts[k] || [];
				parts[k].push(segment[0]);

				// if segment goes out of screen, or it's the last one, it's the end of the line part
				if ((segment[1] !== points[j + 1]) || (j === len2 - 2)) {
					parts[k].push(segment[1]);
					k++;
				}
			}
		}
	},

	// simplify each clipped part of the polyline for performance
	_simplifyPoints: function () {
		var parts = this._parts,
		    tolerance = this.options.smoothFactor;

		for (var i = 0, len = parts.length; i < len; i++) {
			parts[i] = L.LineUtil.simplify(parts[i], tolerance);
		}
	},

	_update: function () {
		if (!this._map) { return; }

		this._clipPoints();
		this._simplifyPoints();
		this._updatePath();
	},

	_updatePath: function () {
		this._renderer._updatePoly(this);
	}
});

L.polyline = function (latlngs, options) {
	return new L.Polyline(latlngs, options);
};


/*
 * L.PolyUtil contains utility functions for polygons (clipping, etc.).
 */

L.PolyUtil = {};

/*
 * Sutherland-Hodgeman polygon clipping algorithm.
 * Used to avoid rendering parts of a polygon that are not currently visible.
 */
L.PolyUtil.clipPolygon = function (points, bounds, round) {
	var clippedPoints,
	    edges = [1, 4, 2, 8],
	    i, j, k,
	    a, b,
	    len, edge, p,
	    lu = L.LineUtil;

	for (i = 0, len = points.length; i < len; i++) {
		points[i]._code = lu._getBitCode(points[i], bounds);
	}

	// for each edge (left, bottom, right, top)
	for (k = 0; k < 4; k++) {
		edge = edges[k];
		clippedPoints = [];

		for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
			a = points[i];
			b = points[j];

			// if a is inside the clip window
			if (!(a._code & edge)) {
				// if b is outside the clip window (a->b goes out of screen)
				if (b._code & edge) {
					p = lu._getEdgeIntersection(b, a, edge, bounds, round);
					p._code = lu._getBitCode(p, bounds);
					clippedPoints.push(p);
				}
				clippedPoints.push(a);

			// else if b is inside the clip window (a->b enters the screen)
			} else if (!(b._code & edge)) {
				p = lu._getEdgeIntersection(b, a, edge, bounds, round);
				p._code = lu._getBitCode(p, bounds);
				clippedPoints.push(p);
			}
		}
		points = clippedPoints;
	}

	return points;
};

L.PolyUtil.rectanglesToPolygons = function (rectangles, docLayer) {
	// algorithm found here http://stackoverflow.com/questions/13746284/merging-multiple-adjacent-rectangles-into-one-polygon
	var eps = 20;
	// Glue rectangles if the space between them is less then eps
	for (var i = 0; i < rectangles.length - 1; i++) {
		for (var j = i + 1; j < rectangles.length; j++) {
			for (var k = 0; k < rectangles[i].length; k++) {
				for (var l = 0; l < rectangles[j].length; l++) {
					if (Math.abs(rectangles[i][k].x - rectangles[j][l].x) < eps) {
						rectangles[j][l].x = rectangles[i][k].x;
					}
					if (Math.abs(rectangles[i][k].y - rectangles[j][l].y) < eps) {
						rectangles[j][l].y = rectangles[i][k].y;
					}
				}
			}
		}
	}

	var points = {};
	for (i = 0; i < rectangles.length; i++) {
		for (j = 0; j < rectangles[i].length; j++) {
			if (points[rectangles[i][j]]) {
				delete points[rectangles[i][j]];
			}
			else {
				points[rectangles[i][j]] = rectangles[i][j];
			}
		}
	}

	function getKeys(points) {
		var keys = [];
		for (var key in points) {
			if (points.hasOwnProperty(key)) {
				keys.push(key);
			}
		}
		return keys;
	}

	function xThenY(aStr, bStr) {
		var a = aStr.match(/\d+/g);
		a[0] = parseInt(a[0]);
		a[1] = parseInt(a[1]);
		var b = bStr.match(/\d+/g);
		b[0] = parseInt(b[0]);
		b[1] = parseInt(b[1]);

		if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) {
			return -1;
		}
		else if (a[0] === b[0] && a[1] === b[1]) {
			return 0;
		}
		else {
			return 1;
		}
	}

	function yThenX(aStr, bStr) {
		var a = aStr.match(/\d+/g);
		a[0] = parseInt(a[0]);
		a[1] = parseInt(a[1]);
		var b = bStr.match(/\d+/g);
		b[0] = parseInt(b[0]);
		b[1] = parseInt(b[1]);

		if (a[1] < b[1] || (a[1] === b[1] && a[0] < b[0])) {
			return -1;
		}
		else if (a[0] === b[0] && a[1] === b[1]) {
			return 0;
		}
		else {
			return 1;
		}
	}

	var sortX = getKeys(points).sort(xThenY);
	var sortY = getKeys(points).sort(yThenX);

	var edgesH = {};
	var edgesV = {};

	var len = getKeys(points).length;
	i = 0;
	while (i < len) {
		var currY = points[sortY[i]].y;
		while (i < len && points[sortY[i]].y === currY) {
			edgesH[sortY[i]] = sortY[i + 1];
			edgesH[sortY[i + 1]] = sortY[i];
			i += 2;
		}
	}

	i = 0;
	while (i < len) {
		var currX = points[sortX[i]].x;
		while (i < len && points[sortX[i]].x === currX) {
			edgesV[sortX[i]] = sortX[i + 1];
			edgesV[sortX[i + 1]] = sortX[i];
			i += 2;
		}
	}

	var polygons = [];
	var edgesHKeys = getKeys(edgesH);
	while (edgesHKeys.length > 0) {
		var p = [[edgesHKeys[0], 0]];
		while (true) {
			var curr = p[p.length - 1][0];
			var e = p[p.length - 1][1];
			if (e === 0) {
				var nextVertex = edgesV[curr];
				delete edgesV[curr];
				p.push([nextVertex, 1]);
			}
			else {
				nextVertex = edgesH[curr];
				delete edgesH[curr];
				p.push([nextVertex, 0]);
			}
			if (p[p.length - 1][0] === p[0][0] && p[p.length - 1][1] === p[0][1]) {
				p.pop();
				break;
			}
		}
		var polygon = [];
		for (i = 0; i < p.length; i++) {
			polygon.push(docLayer._twipsToLatLng(points[p[i][0]]));
			delete edgesH[p[i][0]];
			delete edgesV[p[i][0]];
		}
		polygon.push(docLayer._twipsToLatLng(points[p[0][0]]));
		edgesHKeys = getKeys(edgesH);
		polygons.push(polygon);
	}
	return polygons;
};


/*
 * L.Polygon implements polygon vector layer (closed polyline with a fill inside).
 */

L.Polygon = L.Polyline.extend({

	options: {
		fill: true
	},

	getCenter: function () {
		var i, j, len, p1, p2, f, area, x, y,
		    points = this._rings[0];

		// polygon centroid algorithm; only uses the first ring if there are multiple

		area = x = y = 0;

		for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
			p1 = points[i];
			p2 = points[j];

			f = p1.y * p2.x - p2.y * p1.x;
			x += (p1.x + p2.x) * f;
			y += (p1.y + p2.y) * f;
			area += f * 3;
		}

		return this._map.layerPointToLatLng([x / area, y / area]);
	},

	_convertLatLngs: function (latlngs) {
		var result = L.Polyline.prototype._convertLatLngs.call(this, latlngs),
		    len = result.length;

		// remove last point if it equals first one
		if (len >= 2 && result[0] instanceof L.LatLng && result[0].equals(result[len - 1])) {
			result.pop();
		}
		return result;
	},

	_clipPoints: function () {
		if (this.options.noClip) {
			this._parts = this._rings;
			return;
		}

		// polygons need a different clipping algorithm so we redefine that

		var bounds = this._renderer._bounds,
		    w = this.options.weight,
		    p = new L.Point(w, w);

		// increase clip padding by stroke width to avoid stroke on clip edges
		bounds = new L.Bounds(bounds.min.subtract(p), bounds.max.add(p));

		this._parts = [];

		for (var i = 0, len = this._rings.length, clipped; i < len; i++) {
			clipped = L.PolyUtil.clipPolygon(this._rings[i], bounds, true);
			if (clipped.length) {
				this._parts.push(clipped);
			}
		}
	},

	_updatePath: function () {
		this._renderer._updatePoly(this, true);
	}
});

L.polygon = function (latlngs, options) {
	return new L.Polygon(latlngs, options);
};


/*
 * L.Rectangle extends Polygon and creates a rectangle when passed a LatLngBounds object.
 */

L.Rectangle = L.Polygon.extend({
	initialize: function (latLngBounds, options) {
		L.Polygon.prototype.initialize.call(this, this._boundsToLatLngs(latLngBounds), options);
	},

	setBounds: function (latLngBounds) {
		this.setLatLngs(this._boundsToLatLngs(latLngBounds));
	},

	_boundsToLatLngs: function (latLngBounds) {
		latLngBounds = L.latLngBounds(latLngBounds);
		return [
			latLngBounds.getSouthWest(),
			latLngBounds.getNorthWest(),
			latLngBounds.getNorthEast(),
			latLngBounds.getSouthEast()
		];
	}
});

L.rectangle = function (latLngBounds, options) {
	return new L.Rectangle(latLngBounds, options);
};


/*
 * L.CircleMarker is a circle overlay with a permanent pixel radius.
 */

L.CircleMarker = L.Path.extend({

	options: {
		fill: true,
		radius: 10
	},

	initialize: function (latlng, options) {
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
		this._radius = this.options.radius;
	},

	setLatLng: function (latlng) {
		this._latlng = L.latLng(latlng);
		this.redraw();
		return this.fire('move', {latlng: this._latlng});
	},

	getLatLng: function () {
		return this._latlng;
	},

	setRadius: function (radius) {
		this.options.radius = this._radius = radius;
		return this.redraw();
	},

	getRadius: function () {
		return this._radius;
	},

	setStyle : function (options) {
		var radius = options && options.radius || this._radius;
		L.Path.prototype.setStyle.call(this, options);
		this.setRadius(radius);
		return this;
	},

	_project: function () {
		this._point = this._map.latLngToLayerPoint(this._latlng);
		this._updateBounds();
	},

	_updateBounds: function () {
		var r = this._radius,
		    r2 = this._radiusY || r,
		    w = this._clickTolerance(),
		    p = [r + w, r2 + w];
		this._pxBounds = new L.Bounds(this._point.subtract(p), this._point.add(p));
	},

	_update: function () {
		if (this._map) {
			this._updatePath();
		}
	},

	_updatePath: function () {
		this._renderer._updateCircle(this);
	},

	_empty: function () {
		return this._radius && !this._renderer._bounds.intersects(this._pxBounds);
	}
});

L.circleMarker = function (latlng, options) {
	return new L.CircleMarker(latlng, options);
};


/*
 * L.Circle is a circle overlay (with a certain radius in meters).
 * It's an approximation and starts to diverge from a real circle closer to poles (due to projection distortion)
 */

L.Circle = L.CircleMarker.extend({

	initialize: function (latlng, radius, options) {
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
		this._mRadius = radius;
	},

	setRadius: function (radius) {
		this._mRadius = radius;
		return this.redraw();
	},

	getRadius: function () {
		return this._mRadius;
	},

	getBounds: function () {
		var half = [this._radius, this._radiusY];

		return new L.LatLngBounds(
			this._map.layerPointToLatLng(this._point.subtract(half)),
			this._map.layerPointToLatLng(this._point.add(half)));
	},

	setStyle: L.Path.prototype.setStyle,

	_project: function () {

		var lng = this._latlng.lng,
		    lat = this._latlng.lat,
		    map = this._map,
		    crs = map.options.crs;

		if (crs.distance === L.CRS.Earth.distance) {
			var d = Math.PI / 180,
			    latR = (this._mRadius / L.CRS.Earth.R) / d,
			    top = map.project([lat + latR, lng]),
			    bottom = map.project([lat - latR, lng]),
			    p = top.add(bottom).divideBy(2),
			    lat2 = map.unproject(p).lat,
			    lngR = Math.acos((Math.cos(latR * d) - Math.sin(lat * d) * Math.sin(lat2 * d)) /
			            (Math.cos(lat * d) * Math.cos(lat2 * d))) / d;

			this._point = p.subtract(map.getPixelOrigin());
			this._radius = isNaN(lngR) ? 0 : Math.max(Math.round(p.x - map.project([lat2, lng - lngR]).x), 1);
			this._radiusY = Math.max(Math.round(p.y - top.y), 1);

		} else {
			var latlng2 = crs.unproject(crs.project(this._latlng).subtract([this._mRadius, 0]));

			this._point = map.latLngToLayerPoint(this._latlng);
			this._radius = this._point.x - map.latLngToLayerPoint(latlng2).x;
		}

		this._updateBounds();
	}
});

L.circle = function (latlng, radius, options) {
	return new L.Circle(latlng, radius, options);
};


/*
 * L.SVG renders vector layers with SVG. All SVG-specific code goes here.
 */

L.SVG = L.Renderer.extend({

	_initContainer: function () {
		this._container = L.SVG.create('svg');

		// makes it possible to click through svg root; we'll reset it back in individual paths
		this._container.setAttribute('pointer-events', 'none');
	},

	_update: function () {
		if (this._map._animatingZoom && this._bounds) { return; }

		L.Renderer.prototype._update.call(this);

		var b = this._bounds,
		    size = b.getSize(),
		    container = this._container;

		L.DomUtil.setPosition(container, b.min);

		// set size of svg-container if changed
		if (!this._svgSize || !this._svgSize.equals(size)) {
			this._svgSize = size;
			container.setAttribute('width', size.x);
			container.setAttribute('height', size.y);
		}

		// movement: update container viewBox so that we don't have to change coordinates of individual layers
		L.DomUtil.setPosition(container, b.min);
		container.setAttribute('viewBox', [b.min.x, b.min.y, size.x, size.y].join(' '));
	},

	// methods below are called by vector layers implementations

	_initPath: function (layer) {
		var path = layer._path = L.SVG.create('path');

		if (layer.options.className) {
			L.DomUtil.addClass(path, layer.options.className);
		}

		if (layer.options.interactive) {
			L.DomUtil.addClass(path, 'leaflet-interactive');

			var events = ['mouseenter', 'mouseout'];
			for (var i = 0; i < events.length; i++) {
				L.DomEvent.on(path, events[i], this._fireMouseEvent, this);
			}
		}

		this._updateStyle(layer);
	},

	_fireMouseEvent: function (e) {
		if (!this._map || !this.hasEventListeners(e.type)) { return; }

		var map = this._map,
		    containerPoint = map.mouseEventToContainerPoint(e),
		    layerPoint = map.containerPointToLayerPoint(containerPoint),
		    latlng = map.layerPointToLatLng(layerPoint);

		this.fire(e.type, {
			latlng: latlng,
			layerPoint: layerPoint,
			containerPoint: containerPoint,
			originalEvent: e
		});
	},

	_addPath: function (layer) {
		this._container.appendChild(layer._path);
		layer.addInteractiveTarget(layer._path);
	},

	_removePath: function (layer) {
		L.DomUtil.remove(layer._path);
		layer.removeInteractiveTarget(layer._path);
	},

	_updatePath: function (layer) {
		layer._project();
		layer._update();
	},

	_updateStyle: function (layer) {
		var path = layer._path,
		    options = layer.options;

		if (!path) { return; }

		if (options.stroke) {
			path.setAttribute('stroke', options.color);
			path.setAttribute('stroke-opacity', options.opacity);
			path.setAttribute('stroke-width', options.weight);
			path.setAttribute('stroke-linecap', options.lineCap);
			path.setAttribute('stroke-linejoin', options.lineJoin);

			if (options.dashArray) {
				path.setAttribute('stroke-dasharray', options.dashArray);
			} else {
				path.removeAttribute('stroke-dasharray');
			}

			if (options.dashOffset) {
				path.setAttribute('stroke-dashoffset', options.dashOffset);
			} else {
				path.removeAttribute('stroke-dashoffset');
			}
		} else {
			path.setAttribute('stroke', 'none');
		}

		if (options.fill) {
			path.setAttribute('fill', options.fillColor || options.color);
			path.setAttribute('fill-opacity', options.fillOpacity);
			path.setAttribute('fill-rule', options.fillRule || 'evenodd');
		} else {
			path.setAttribute('fill', 'none');
		}

		path.setAttribute('pointer-events', options.pointerEvents || (options.interactive ? 'visiblePainted' : 'none'));
	},

	_updatePoly: function (layer, closed) {
		this._setPath(layer, L.SVG.pointsToPath(layer._parts, closed));
	},

	_updateCircle: function (layer) {
		var p = layer._point,
		    r = layer._radius,
		    r2 = layer._radiusY || r,
		    arc = 'a' + r + ',' + r2 + ' 0 1,0 ';

		// drawing a circle with two half-arcs
		var d = layer._empty() ? 'M0 0' :
				'M' + (p.x - r) + ',' + p.y +
				arc + (r * 2) + ',0 ' +
				arc + (-r * 2) + ',0 ';

		this._setPath(layer, d);
	},

	_setPath: function (layer, path) {
		layer._path.setAttribute('d', path);
	},

	// SVG does not have the concept of zIndex so we resort to changing the DOM order of elements
	_bringToFront: function (layer) {
		L.DomUtil.toFront(layer._path);
	},

	_bringToBack: function (layer) {
		L.DomUtil.toBack(layer._path);
	}
});


L.extend(L.SVG, {
	create: function (name) {
		return document.createElementNS('http://www.w3.org/2000/svg', name);
	},

	// generates SVG path string for multiple rings, with each ring turning into "M..L..L.." instructions
	pointsToPath: function (rings, closed) {
		var str = '',
		    i, j, len, len2, points, p;

		for (i = 0, len = rings.length; i < len; i++) {
			points = rings[i];

			for (j = 0, len2 = points.length; j < len2; j++) {
				p = points[j];
				str += (j ? 'L' : 'M') + p.x + ' ' + p.y;
			}

			// closes the ring for polygons; "x" is VML syntax
			str += closed ? (L.Browser.svg ? 'z' : 'x') : '';
		}

		// SVG complains about empty path strings
		return str || 'M0 0';
	}
});

L.Browser.svg = !!(document.createElementNS && L.SVG.create('svg').createSVGRect);

L.svg = function (options) {
	return L.Browser.svg || L.Browser.vml ? new L.SVG(options) : null;
};


/*
 * Vector rendering for IE7-8 through VML.
 * Thanks to Dmitry Baranovsky and his Raphael library for inspiration!
 */

L.Browser.vml = !L.Browser.svg && (function () {
	try {
		var div = document.createElement('div');
		div.innerHTML = '<v:shape adj="1"/>';

		var shape = div.firstChild;
		shape.style.behavior = 'url(#default#VML)';

		return shape && (typeof shape.adj === 'object');

	} catch (e) {
		return false;
	}
}());

// redefine some SVG methods to handle VML syntax which is similar but with some differences
L.SVG.include(!L.Browser.vml ? {} : {

	_initContainer: function () {
		this._container = L.DomUtil.create('div', 'leaflet-vml-container');

		this._paths = {};
		this._initEvents();
	},

	_update: function () {
		if (this._map._animatingZoom) { return; }
		L.Renderer.prototype._update.call(this);
	},

	_initPath: function (layer) {
		var container = layer._container = L.SVG.create('shape');

		L.DomUtil.addClass(container, 'leaflet-vml-shape ' + (this.options.className || ''));

		container.coordsize = '1 1';

		layer._path = L.SVG.create('path');
		container.appendChild(layer._path);

		this._updateStyle(layer);
	},

	_addPath: function (layer) {
		var container = layer._container;
		this._container.appendChild(container);
		this._paths[L.stamp(container)] = layer;
	},

	_removePath: function (layer) {
		var container = layer._container;
		L.DomUtil.remove(container);
		delete this._paths[L.stamp(container)];
	},

	_updateStyle: function (layer) {
		var stroke = layer._stroke,
		    fill = layer._fill,
		    options = layer.options,
		    container = layer._container;

		container.stroked = !!options.stroke;
		container.filled = !!options.fill;

		if (options.stroke) {
			if (!stroke) {
				stroke = layer._stroke = L.SVG.create('stroke');
				container.appendChild(stroke);
			}
			stroke.weight = options.weight + 'px';
			stroke.color = options.color;
			stroke.opacity = options.opacity;

			if (options.dashArray) {
				stroke.dashStyle = L.Util.isArray(options.dashArray) ?
				    options.dashArray.join(' ') :
				    options.dashArray.replace(/( *, *)/g, ' ');
			} else {
				stroke.dashStyle = '';
			}
			stroke.endcap = options.lineCap.replace('butt', 'flat');
			stroke.joinstyle = options.lineJoin;

		} else if (stroke) {
			container.removeChild(stroke);
			layer._stroke = null;
		}

		if (options.fill) {
			if (!fill) {
				fill = layer._fill = L.SVG.create('fill');
				container.appendChild(fill);
			}
			fill.color = options.fillColor || options.color;
			fill.opacity = options.fillOpacity;

		} else if (fill) {
			container.removeChild(fill);
			layer._fill = null;
		}
	},

	_updateCircle: function (layer) {
		var p = layer._point.round(),
		    r = Math.round(layer._radius),
		    r2 = Math.round(layer._radiusY || r);

		this._setPath(layer, layer._empty() ? 'M0 0' :
				'AL ' + p.x + ',' + p.y + ' ' + r + ',' + r2 + ' 0,' + (65535 * 360));
	},

	_setPath: function (layer, path) {
		layer._path.v = path;
	},

	_bringToFront: function (layer) {
		L.DomUtil.toFront(layer._container);
	},

	_bringToBack: function (layer) {
		L.DomUtil.toBack(layer._container);
	}
});

if (L.Browser.vml) {
	L.SVG.create = (function () {
		try {
			document.namespaces.add('lvml', 'urn:schemas-microsoft-com:vml');
			return function (name) {
				return document.createElement('<lvml:' + name + ' class="lvml">');
			};
		} catch (e) {
			return function (name) {
				return document.createElement('<' + name + ' xmlns="urn:schemas-microsoft.com:vml" class="lvml">');
			};
		}
	})();
}


/*
 * L.Canvas handles Canvas vector layers rendering and mouse events handling. All Canvas-specific code goes here.
 */

L.Canvas = L.Renderer.extend({

	onAdd: function () {
		L.Renderer.prototype.onAdd.call(this);

		this._layers = this._layers || {};

		// redraw vectors since canvas is cleared upon removal
		this._draw();
	},

	_initContainer: function () {
		var container = this._container = document.createElement('canvas');

		L.DomEvent
			.on(container, 'mousemove', this._onMouseMove, this)
			.on(container, 'click dblclick mousedown mouseup contextmenu', this._onClick, this);

		this._ctx = container.getContext('2d');
	},

	_update: function () {
		if (this._map._animatingZoom && this._bounds) { return; }

		L.Renderer.prototype._update.call(this);

		var b = this._bounds,
		    container = this._container,
		    size = b.getSize(),
		    m = L.Browser.retina ? 2 : 1;

		L.DomUtil.setPosition(container, b.min);

		// set canvas size (also clearing it); use double size on retina
		container.width = m * size.x;
		container.height = m * size.y;
		container.style.width = size.x + 'px';
		container.style.height = size.y + 'px';

		if (L.Browser.retina) {
			this._ctx.scale(2, 2);
		}

		// translate so we use the same path coordinates after canvas element moves
		this._ctx.translate(-b.min.x, -b.min.y);
	},

	_initPath: function (layer) {
		this._layers[L.stamp(layer)] = layer;
	},

	_addPath: L.Util.falseFn,

	_removePath: function (layer) {
		layer._removed = true;
		this._requestRedraw(layer);
	},

	_updatePath: function (layer) {
		this._redrawBounds = layer._pxBounds;
		this._draw(true);
		layer._project();
		layer._update();
		this._draw();
		this._redrawBounds = null;
	},

	_updateStyle: function (layer) {
		this._requestRedraw(layer);
	},

	_requestRedraw: function (layer) {
		if (!this._map) { return; }

		this._redrawBounds = this._redrawBounds || new L.Bounds();
		this._redrawBounds.extend(layer._pxBounds.min).extend(layer._pxBounds.max);

		this._redrawRequest = this._redrawRequest || L.Util.requestAnimFrame(this._redraw, this);
	},

	_redraw: function () {
		this._redrawRequest = null;

		this._draw(true); // clear layers in redraw bounds
		this._draw(); // draw layers

		this._redrawBounds = null;
	},

	_draw: function (clear) {
		this._clear = clear;
		var layer;

		for (var id in this._layers) {
			layer = this._layers[id];
			if (!this._redrawBounds || layer._pxBounds.intersects(this._redrawBounds)) {
				layer._updatePath();
			}
			if (clear && layer._removed) {
				delete layer._removed;
				delete this._layers[id];
			}
		}
	},

	_updatePoly: function (layer, closed) {

		var i, j, len2, p,
		    parts = layer._parts,
		    len = parts.length,
		    ctx = this._ctx;

		if (!len) { return; }

		ctx.beginPath();

		for (i = 0; i < len; i++) {
			for (j = 0, len2 = parts[i].length; j < len2; j++) {
				p = parts[i][j];
				ctx[j ? 'lineTo' : 'moveTo'](p.x, p.y);
			}
			if (closed) {
				ctx.closePath();
			}
		}

		this._fillStroke(ctx, layer);

		// TODO optimization: 1 fill/stroke for all features with equal style instead of 1 for each feature
	},

	_updateCircle: function (layer) {

		if (layer._empty()) { return; }

		var p = layer._point,
		    ctx = this._ctx,
		    r = layer._radius,
		    s = (layer._radiusY || r) / r;

		if (s !== 1) {
			ctx.save();
			ctx.scale(1, s);
		}

		ctx.beginPath();
		ctx.arc(p.x, p.y / s, r, 0, Math.PI * 2, false);

		if (s !== 1) {
			ctx.restore();
		}

		this._fillStroke(ctx, layer);
	},

	_fillStroke: function (ctx, layer) {
		var clear = this._clear,
		    options = layer.options;

		ctx.globalCompositeOperation = clear ? 'destination-out' : 'source-over';

		if (options.fill) {
			ctx.globalAlpha = clear ? 1 : options.fillOpacity;
			ctx.fillStyle = options.fillColor || options.color;
			ctx.fill(options.fillRule || 'evenodd');
		}

		if (options.stroke && options.weight !== 0) {
			ctx.globalAlpha = clear ? 1 : options.opacity;

			// if clearing shape, do it with the previously drawn line width
			layer._prevWeight = ctx.lineWidth = clear ? layer._prevWeight + 1 : options.weight;

			ctx.strokeStyle = options.color;
			ctx.lineCap = options.lineCap;
			ctx.lineJoin = options.lineJoin;
			ctx.stroke();
		}
	},

	// Canvas obviously doesn't have mouse events for individual drawn objects,
	// so we emulate that by calculating what's under the mouse on mousemove/click manually

	_onClick: function (e) {
		var point = this._map.mouseEventToLayerPoint(e);

		for (var id in this._layers) {
			if (this._layers[id]._containsPoint(point)) {
				L.DomEvent._fakeStop(e);
				this._fireEvent(this._layers[id], e);
			}
		}
	},

	_onMouseMove: function (e) {
		if (!this._map || this._map._animatingZoom) { return; }

		var point = this._map.mouseEventToLayerPoint(e);

		// TODO don't do on each move event, throttle since it's expensive
		for (var id in this._layers) {
			this._handleHover(this._layers[id], e, point);
		}
	},

	_handleHover: function (layer, e, point) {
		if (!layer.options.interactive) { return; }

		if (layer._containsPoint(point)) {
			// if we just got inside the layer, fire mouseover
			if (!layer._mouseInside) {
				L.DomUtil.addClass(this._container, 'leaflet-interactive'); // change cursor
				this._fireEvent(layer, e, 'mouseover');
				layer._mouseInside = true;
			}
			// fire mousemove
			this._fireEvent(layer, e);

		} else if (layer._mouseInside) {
			// if we're leaving the layer, fire mouseout
			L.DomUtil.removeClass(this._container, 'leaflet-interactive');
			this._fireEvent(layer, e, 'mouseout');
			layer._mouseInside = false;
		}
	},

	_fireEvent: function (layer, e, type) {
		this._map._fireDOMEvent(layer, e, type || e.type);
	},

	// TODO _bringToFront & _bringToBack, pretty tricky

	_bringToFront: L.Util.falseFn,
	_bringToBack: L.Util.falseFn
});

L.Browser.canvas = (function () {
	return !!document.createElement('canvas').getContext;
}());

L.canvas = function (options) {
	return L.Browser.canvas ? new L.Canvas(options) : null;
};

L.Polyline.prototype._containsPoint = function (p, closed) {
	var i, j, k, len, len2, part,
	    w = this._clickTolerance();

	if (!this._pxBounds.contains(p)) { return false; }

	// hit detection for polylines
	for (i = 0, len = this._parts.length; i < len; i++) {
		part = this._parts[i];

		for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
			if (!closed && (j === 0)) { continue; }

			if (L.LineUtil.pointToSegmentDistance(p, part[k], part[j]) <= w) {
				return true;
			}
		}
	}
	return false;
};

L.Polygon.prototype._containsPoint = function (p) {
	var inside = false,
	    part, p1, p2, i, j, k, len, len2;

	if (!this._pxBounds.contains(p)) { return false; }

	// ray casting algorithm for detecting if point is in polygon
	for (i = 0, len = this._parts.length; i < len; i++) {
		part = this._parts[i];

		for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
			p1 = part[j];
			p2 = part[k];

			if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
				inside = !inside;
			}
		}
	}

	// also check if it's on polygon stroke
	return inside || L.Polyline.prototype._containsPoint.call(this, p, true);
};

L.CircleMarker.prototype._containsPoint = function (p) {
	return p.distanceTo(this._point) <= this._radius + this._clickTolerance();
};


/*
 * L.GeoJSON turns any GeoJSON data into a Leaflet layer.
 */

L.GeoJSON = L.FeatureGroup.extend({

	initialize: function (geojson, options) {
		L.setOptions(this, options);

		this._layers = {};

		if (geojson) {
			this.addData(geojson);
		}
	},

	addData: function (geojson) {
		var features = L.Util.isArray(geojson) ? geojson : geojson.features,
		    i, len, feature;

		if (features) {
			for (i = 0, len = features.length; i < len; i++) {
				// only add this if geometry or geometries are set and not null
				feature = features[i];
				if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
					this.addData(feature);
				}
			}
			return this;
		}

		var options = this.options;

		if (options.filter && !options.filter(geojson)) { return this; }

		var layer = L.GeoJSON.geometryToLayer(geojson, options);
		layer.feature = L.GeoJSON.asFeature(geojson);

		layer.defaultOptions = layer.options;
		this.resetStyle(layer);

		if (options.onEachFeature) {
			options.onEachFeature(geojson, layer);
		}

		return this.addLayer(layer);
	},

	resetStyle: function (layer) {
		// reset any custom styles
		layer.options = layer.defaultOptions;
		this._setLayerStyle(layer, this.options.style);
		return this;
	},

	setStyle: function (style) {
		return this.eachLayer(function (layer) {
			this._setLayerStyle(layer, style);
		}, this);
	},

	_setLayerStyle: function (layer, style) {
		if (typeof style === 'function') {
			style = style(layer.feature);
		}
		if (layer.setStyle) {
			layer.setStyle(style);
		}
	}
});

L.extend(L.GeoJSON, {
	geometryToLayer: function (geojson, options) {

		var geometry = geojson.type === 'Feature' ? geojson.geometry : geojson,
		    coords = geometry.coordinates,
		    layers = [],
		    pointToLayer = options && options.pointToLayer,
		    coordsToLatLng = options && options.coordsToLatLng || this.coordsToLatLng,
		    latlng, latlngs, i, len;

		switch (geometry.type) {
		case 'Point':
			latlng = coordsToLatLng(coords);
			return pointToLayer ? pointToLayer(geojson, latlng) : new L.Marker(latlng);

		case 'MultiPoint':
			for (i = 0, len = coords.length; i < len; i++) {
				latlng = coordsToLatLng(coords[i]);
				layers.push(pointToLayer ? pointToLayer(geojson, latlng) : new L.Marker(latlng));
			}
			return new L.FeatureGroup(layers);

		case 'LineString':
		case 'MultiLineString':
			latlngs = this.coordsToLatLngs(coords, geometry.type === 'LineString' ? 0 : 1, coordsToLatLng);
			return new L.Polyline(latlngs, options);

		case 'Polygon':
		case 'MultiPolygon':
			latlngs = this.coordsToLatLngs(coords, geometry.type === 'Polygon' ? 1 : 2, coordsToLatLng);
			return new L.Polygon(latlngs, options);

		case 'GeometryCollection':
			for (i = 0, len = geometry.geometries.length; i < len; i++) {

				layers.push(this.geometryToLayer({
					geometry: geometry.geometries[i],
					type: 'Feature',
					properties: geojson.properties
				}, options));
			}
			return new L.FeatureGroup(layers);

		default:
			throw new Error('Invalid GeoJSON object.');
		}
	},

	coordsToLatLng: function (coords) {
		return new L.LatLng(coords[1], coords[0], coords[2]);
	},

	coordsToLatLngs: function (coords, levelsDeep, coordsToLatLng) {
		var latlngs = [];

		for (var i = 0, len = coords.length, latlng; i < len; i++) {
			latlng = levelsDeep ?
			        this.coordsToLatLngs(coords[i], levelsDeep - 1, coordsToLatLng) :
			        (coordsToLatLng || this.coordsToLatLng)(coords[i]);

			latlngs.push(latlng);
		}

		return latlngs;
	},

	latLngToCoords: function (latlng) {
		return latlng.alt !== undefined ?
				[latlng.lng, latlng.lat, latlng.alt] :
				[latlng.lng, latlng.lat];
	},

	latLngsToCoords: function (latlngs, levelsDeep, closed) {
		var coords = [];

		for (var i = 0, len = latlngs.length; i < len; i++) {
			coords.push(levelsDeep ?
				L.GeoJSON.latLngsToCoords(latlngs[i], levelsDeep - 1, closed) :
				L.GeoJSON.latLngToCoords(latlngs[i]));
		}

		if (!levelsDeep && closed) {
			coords.push(coords[0]);
		}

		return coords;
	},

	getFeature: function (layer, newGeometry) {
		return layer.feature ?
				L.extend({}, layer.feature, {geometry: newGeometry}) :
				L.GeoJSON.asFeature(newGeometry);
	},

	asFeature: function (geoJSON) {
		if (geoJSON.type === 'Feature') {
			return geoJSON;
		}

		return {
			type: 'Feature',
			properties: {},
			geometry: geoJSON
		};
	}
});

var PointToGeoJSON = {
	toGeoJSON: function () {
		return L.GeoJSON.getFeature(this, {
			type: 'Point',
			coordinates: L.GeoJSON.latLngToCoords(this.getLatLng())
		});
	}
};

L.Marker.include(PointToGeoJSON);
L.Circle.include(PointToGeoJSON);
L.CircleMarker.include(PointToGeoJSON);

L.Polyline.prototype.toGeoJSON = function () {
	var multi = !this._flat(this._latlngs);

	var coords = L.GeoJSON.latLngsToCoords(this._latlngs, multi ? 1 : 0);

	return L.GeoJSON.getFeature(this, {
		type: (multi ? 'Multi' : '') + 'LineString',
		coordinates: coords
	});
};

L.Polygon.prototype.toGeoJSON = function () {
	var holes = !this._flat(this._latlngs),
	    multi = holes && !this._flat(this._latlngs[0]);

	var coords = L.GeoJSON.latLngsToCoords(this._latlngs, multi ? 2 : holes ? 1 : 0, true);

	if (!holes) {
		coords = [coords];
	}

	return L.GeoJSON.getFeature(this, {
		type: (multi ? 'Multi' : '') + 'Polygon',
		coordinates: coords
	});
};


L.LayerGroup.include({
	toMultiPoint: function () {
		var coords = [];

		this.eachLayer(function (layer) {
			coords.push(layer.toGeoJSON().geometry.coordinates);
		});

		return L.GeoJSON.getFeature(this, {
			type: 'MultiPoint',
			coordinates: coords
		});
	},

	toGeoJSON: function () {

		var type = this.feature && this.feature.geometry && this.feature.geometry.type;

		if (type === 'MultiPoint') {
			return this.toMultiPoint();
		}

		var isGeometryCollection = type === 'GeometryCollection',
		    jsons = [];

		this.eachLayer(function (layer) {
			if (layer.toGeoJSON) {
				var json = layer.toGeoJSON();
				jsons.push(isGeometryCollection ? json.geometry : L.GeoJSON.asFeature(json));
			}
		});

		if (isGeometryCollection) {
			return L.GeoJSON.getFeature(this, {
				geometries: jsons,
				type: 'GeometryCollection'
			});
		}

		return {
			type: 'FeatureCollection',
			features: jsons
		};
	}
});

L.geoJson = function (geojson, options) {
	return new L.GeoJSON(geojson, options);
};


/*
 * L.DomEvent contains functions for working with DOM events.
 * Inspired by John Resig, Dean Edwards and YUI addEvent implementations.
 */

var eventsKey = '_leaflet_events';

L.DomEvent = {

	on: function (obj, types, fn, context) {

		if (typeof types === 'object') {
			for (var type in types) {
				this._on(obj, type, types[type], fn);
			}
		} else {
			types = L.Util.splitWords(types);

			for (var i = 0, len = types.length; i < len; i++) {
				this._on(obj, types[i], fn, context);
			}
		}

		return this;
	},

	off: function (obj, types, fn, context) {

		if (typeof types === 'object') {
			for (var type in types) {
				this._off(obj, type, types[type], fn);
			}
		} else {
			types = L.Util.splitWords(types);

			for (var i = 0, len = types.length; i < len; i++) {
				this._off(obj, types[i], fn, context);
			}
		}

		return this;
	},

	_on: function (obj, type, fn, context) {
		var id = type + L.stamp(fn) + (context ? '_' + L.stamp(context) : '');

		if (obj[eventsKey] && obj[eventsKey][id]) { return this; }

		var handler = function (e) {
			return fn.call(context || obj, e || window.event);
		};

		var originalHandler = handler;

		if (L.Browser.pointer && type.indexOf('touch') === 0) {
			this.addPointerListener(obj, type, handler, id);

		} else if (L.Browser.touch && (type === 'dblclick') && this.addDoubleTapListener) {
			this.addDoubleTapListener(obj, handler, id);

		} else if (type === 'trplclick' || type === 'qdrplclick') {
			this.addMultiClickListener(obj, handler, id, type);

		} else if ('addEventListener' in obj) {

			if (type === 'mousewheel') {
				obj.addEventListener('DOMMouseScroll', handler, false);
				obj.addEventListener(type, handler, false);

			} else if ((type === 'mouseenter') || (type === 'mouseleave')) {
				handler = function (e) {
					e = e || window.event;
					if (L.DomEvent._checkMouse(obj, e)) {
						originalHandler(e);
					}
				};
				obj.addEventListener(type === 'mouseenter' ? 'mouseover' : 'mouseout', handler, false);

			} else {
				if (type === 'click' && L.Browser.android) {
					handler = function (e) {
						return L.DomEvent._filterClick(e, originalHandler);
					};
				}
				obj.addEventListener(type, handler, false);
			}

		} else if ('attachEvent' in obj) {
			obj.attachEvent('on' + type, handler);
		}

		obj[eventsKey] = obj[eventsKey] || {};
		obj[eventsKey][id] = handler;

		return this;
	},

	_off: function (obj, type, fn, context) {

		var id = type + L.stamp(fn) + (context ? '_' + L.stamp(context) : ''),
		    handler = obj[eventsKey] && obj[eventsKey][id];

		if (!handler) { return this; }

		if (L.Browser.pointer && type.indexOf('touch') === 0) {
			this.removePointerListener(obj, type, id);

		} else if (L.Browser.touch && (type === 'dblclick') && this.removeDoubleTapListener) {
			this.removeDoubleTapListener(obj, id);

		} else if (type === 'trplclick' || type === 'qdrplclick') {
			this.removeMultiClickListener(obj, id, type);

		} else if ('removeEventListener' in obj) {

			if (type === 'mousewheel') {
				obj.removeEventListener('DOMMouseScroll', handler, false);
				obj.removeEventListener(type, handler, false);

			} else {
				obj.removeEventListener(
					type === 'mouseenter' ? 'mouseover' :
					type === 'mouseleave' ? 'mouseout' : type, handler, false);
			}

		} else if ('detachEvent' in obj) {
			obj.detachEvent('on' + type, handler);
		}

		obj[eventsKey][id] = null;

		return this;
	},

	stopPropagation: function (e) {

		if (e.stopPropagation) {
			e.stopPropagation();
		} else {
			e.cancelBubble = true;
		}
		L.DomEvent._skipped(e);

		return this;
	},

	disableScrollPropagation: function (el) {
		return L.DomEvent.on(el, 'mousewheel MozMousePixelScroll', L.DomEvent.stopPropagation);
	},

	disableClickPropagation: function (el) {
		var stop = L.DomEvent.stopPropagation;

		L.DomEvent.on(el, L.Draggable.START.join(' '), stop);

		return L.DomEvent.on(el, {
			click: L.DomEvent._fakeStop,
			dblclick: stop
		});
	},

	preventDefault: function (e) {

		if (e.preventDefault) {
			e.preventDefault();
		} else {
			e.returnValue = false;
		}
		return this;
	},

	stop: function (e) {
		return L.DomEvent
			.preventDefault(e)
			.stopPropagation(e);
	},

	getMousePosition: function (e, container) {
		if (!container) {
			return new L.Point(e.clientX, e.clientY);
		}

		var rect = container.getBoundingClientRect(), // constant object
		    left = rect.left,
		    top = rect.top;

		// iframe mouse coordinates are relative to the frame area
		// `target`: body element of the iframe; `currentTarget`: content window of the iframe
		if (e.currentTarget && e.currentTarget.frameElement
			&& L.DomUtil.hasClass(e.currentTarget.frameElement, 'resize-detector')) {
			left = top = 0;
		}

		return new L.Point(
			e.clientX - left - container.clientLeft,
			e.clientY - top - container.clientTop);
	},

	getWheelDelta: function (e) {

		var delta = 0;

		if (e.wheelDelta) {
			delta = e.wheelDelta / 120;
		}
		if (e.detail) {
			delta = -e.detail / 3;
		}
		return delta;
	},

	_skipEvents: {},

	_fakeStop: function (e) {
		// fakes stopPropagation by setting a special event flag, checked/reset with L.DomEvent._skipped(e)
		L.DomEvent._skipEvents[e.type] = true;
	},

	_skipped: function (e) {
		var skipped = this._skipEvents[e.type];
		// reset when checking, as it's only used in map container and propagates outside of the map
		this._skipEvents[e.type] = false;
		return skipped;
	},

	// check if element really left/entered the event target (for mouseenter/mouseleave)
	_checkMouse: function (el, e) {

		var related = e.relatedTarget;

		if (!related) { return true; }

		try {
			while (related && (related !== el)) {
				related = related.parentNode;
			}
		} catch (err) {
			return false;
		}
		return (related !== el);
	},

	// this is a horrible workaround for a bug in Android where a single touch triggers two click events
	_filterClick: function (e, handler) {
		var timeStamp = (e.timeStamp || e.originalEvent.timeStamp),
		    elapsed = L.DomEvent._lastClick && (timeStamp - L.DomEvent._lastClick);

		// are they closer together than 500ms yet more than 100ms?
		// Android typically triggers them ~300ms apart while multiple listeners
		// on the same event should be triggered far faster;
		// or check if click is simulated on the element, and if it is, reject any non-simulated events

		if ((elapsed && elapsed > 100 && elapsed < 500) || (e.target._simulatedClick && !e._simulated)) {
			L.DomEvent.stop(e);
			return;
		}
		L.DomEvent._lastClick = timeStamp;

		handler(e);
	}
};

L.DomEvent.addListener = L.DomEvent.on;
L.DomEvent.removeListener = L.DomEvent.off;


/*
 * L.Draggable allows you to add dragging capabilities to any element. Supports mobile devices too.
 */

L.Draggable = L.Evented.extend({

	statics: {
		START: L.Browser.touch ? ['touchstart', 'mousedown'] : ['mousedown'],
		END: {
			mousedown: 'mouseup',
			touchstart: 'touchend',
			pointerdown: 'touchend',
			MSPointerDown: 'touchend'
		},
		MOVE: {
			mousedown: 'mousemove',
			touchstart: 'touchmove',
			pointerdown: 'touchmove',
			MSPointerDown: 'touchmove'
		}
	},

	initialize: function (element, dragStartTarget, preventOutline) {
		this._element = element;
		this._dragStartTarget = dragStartTarget || element;
		this._preventOutline = preventOutline;
	},

	enable: function () {
		if (this._enabled) { return; }

		L.DomEvent.on(this._dragStartTarget, L.Draggable.START.join(' '), this._onDown, this);

		this._enabled = true;
	},

	disable: function () {
		if (!this._enabled) { return; }

		L.DomEvent.off(this._dragStartTarget, L.Draggable.START.join(' '), this._onDown, this);

		this._enabled = false;
		this._moved = false;
	},

	_onDown: function (e) {
		this._moved = false;

		if (e.shiftKey || ((e.which !== 1) && (e.button !== 0) && !e.touches)) { return; }

		// enable propagation of the mousedown event from map pane to parent elements in view mode
		// see bug bccu1446
		if (!L.DomUtil.hasClass(this._element, 'leaflet-map-pane')) {
			L.DomEvent.stopPropagation(e);
		}

		if (this._preventOutline) {
			L.DomUtil.preventOutline(this._element);
		}

		if (L.DomUtil.hasClass(this._element, 'leaflet-zoom-anim')) { return; }

		L.DomUtil.disableImageDrag();
		L.DomUtil.disableTextSelection();

		if (this._moving) { return; }

		this.fire('down');

		var first = e.touches ? e.touches[0] : e;

		this._startPoint = new L.Point(first.clientX, first.clientY);
		this._startPos = this._newPos = L.DomUtil.getPosition(this._element);
		var startBoundingRect = this._element.getBoundingClientRect();
		// Store offset between mouse selection position, and top left
		// We don't use this internally, but it is needed for external
		// manipulation of the cursor position, e.g. when adjusting
		// for scrolling during cursor dragging.
		this.startOffset = this._startPoint.subtract(new L.Point(startBoundingRect.left, startBoundingRect.top));

		L.DomEvent
		    .on(document, L.Draggable.MOVE[e.type], this._onMove, this)
		    .on(document, L.Draggable.END[e.type], this._onUp, this);
	},

	_onMove: function (e) {
		if (e.touches && e.touches.length > 1) {
			this._moved = true;
			return;
		}

		var first = (e.touches && e.touches.length === 1 ? e.touches[0] : e),
		    newPoint = new L.Point(first.clientX, first.clientY),
		    offset = newPoint.subtract(this._startPoint);

		if (this._map) {
			// needed in order to avoid a jump when the document is dragged and the mouse pointer move
			// from over the map into the html document element area which is not covered by tiles
			// (resize-detector iframe)
			if (e.currentTarget && e.currentTarget.frameElement
				&& L.DomUtil.hasClass(e.currentTarget.frameElement, 'resize-detector')) {
				var rect = this._map._container.getBoundingClientRect(),
				    correction = new L.Point(rect.left, rect.top);
				offset = offset.add(correction);
			}
			if (this._map.getDocSize().x < this._map.getSize().x) {
				// don't pan horizontally when the document fits in the viewing
				// area horizontally (docWidth < viewAreaWidth)
				offset.x = 0;
			}
			if (this._map.getDocSize().y < this._map.getSize().y) {
				// don't pan vertically when the document fits in the viewing
				// area horizontally (docHeight < viewAreaHeight)
				offset.y = 0;
			}
		}
		if (!offset.x && !offset.y) { return; }
		if (L.Browser.touch && Math.abs(offset.x) + Math.abs(offset.y) < 3) { return; }

		L.DomEvent.preventDefault(e);

		if (!this._moved) {
			this.fire('dragstart');

			this._moved = true;
			this._startPos = L.DomUtil.getPosition(this._element).subtract(offset);

			L.DomUtil.addClass(document.body, 'leaflet-dragging');

			this._lastTarget = e.target || e.srcElement;
			L.DomUtil.addClass(this._lastTarget, 'leaflet-drag-target');
		}

		this._newPos = this._startPos.add(offset);
		this._moving = true;

		L.Util.cancelAnimFrame(this._animRequest);
		this._lastEvent = e;
		this._animRequest = L.Util.requestAnimFrame(this._updatePosition, this, true, this._dragStartTarget);
	},

	_updatePosition: function () {
		var e = {originalEvent: this._lastEvent};
		this.fire('predrag', e);
		L.DomUtil.setPosition(this._element, this._newPos);
		this.fire('drag', e);
	},

	_onUp: function () {
		L.DomUtil.removeClass(document.body, 'leaflet-dragging');

		if (this._lastTarget) {
			L.DomUtil.removeClass(this._lastTarget, 'leaflet-drag-target');
			this._lastTarget = null;
		}

		for (var i in L.Draggable.MOVE) {
			L.DomEvent
			    .off(document, L.Draggable.MOVE[i], this._onMove, this)
			    .off(document, L.Draggable.END[i], this._onUp, this);
		}

		L.DomUtil.enableImageDrag();
		L.DomUtil.enableTextSelection();

		if (this._moved && this._moving) {
			// ensure drag is not fired after dragend
			L.Util.cancelAnimFrame(this._animRequest);

			this.fire('dragend', {
				distance: this._newPos.distanceTo(this._startPos)
			});
		}

		this._moving = false;
	}
});


/*
	L.Handler is a base class for handler classes that are used internally to inject
	interaction features like dragging to classes like Map and Marker.
*/

L.Handler = L.Class.extend({
	initialize: function (map) {
		this._map = map;
	},

	enable: function () {
		if (this._enabled) { return; }

		this._enabled = true;
		this.addHooks();
	},

	disable: function () {
		if (!this._enabled) { return; }

		this._enabled = false;
		this.removeHooks();
	},

	enabled: function () {
		return !!this._enabled;
	}
});


/*
 * L.Handler.MapDrag is used to make the map draggable (with panning inertia), enabled by default.
 */

L.Map.mergeOptions({
	dragging: true,

	inertia: !L.Browser.android23,
	inertiaDeceleration: 3400, // px/s^2
	inertiaMaxSpeed: Infinity, // px/s
	easeLinearity: 0.2,

	// TODO refactor, move to CRS
	worldCopyJump: false
});

L.Map.Drag = L.Handler.extend({
	addHooks: function () {
		if (!this._draggable) {
			var map = this._map;

			this._draggable = new L.Draggable(map._mapPane, map._container);
			this._draggable._map = map;

			this._draggable.on({
				down: this._onDown,
				dragstart: this._onDragStart,
				drag: this._onDrag,
				dragend: this._onDragEnd
			}, this);

			if (map.options.worldCopyJump) {
				this._draggable.on('predrag', this._onPreDrag, this);
				map.on('viewreset', this._onViewReset, this);

				map.whenReady(this._onViewReset, this);
			}
		}
		this._draggable.enable();
	},

	removeHooks: function () {
		this._draggable.disable();
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	_onDown: function () {
		this._map.stop();
	},

	_onDragStart: function () {
		var map = this._map;

		map
		    .fire('movestart')
		    .fire('dragstart');

		if (map.options.inertia) {
			this._positions = [];
			this._times = [];
		}
	},

	_onDrag: function (e) {
		if (this._map.options.inertia) {
			var time = this._lastTime = +new Date(),
			    pos = this._lastPos = this._draggable._absPos || this._draggable._newPos;

			this._positions.push(pos);
			this._times.push(time);

			if (time - this._times[0] > 50) {
				this._positions.shift();
				this._times.shift();
			}
		}

		this._map
		    .fire('move', e)
		    .fire('drag', e);
	},

	_onViewReset: function () {
		var pxCenter = this._map.getSize().divideBy(2),
		    pxWorldCenter = this._map.latLngToLayerPoint([0, 0]);

		this._initialWorldOffset = pxWorldCenter.subtract(pxCenter).x;
		this._worldWidth = this._map.getPixelWorldBounds().getSize().x;
	},

	_onPreDrag: function () {
		// TODO refactor to be able to adjust map pane position after zoom
		var worldWidth = this._worldWidth,
		    halfWidth = Math.round(worldWidth / 2),
		    dx = this._initialWorldOffset,
		    x = this._draggable._newPos.x,
		    newX1 = (x - halfWidth + dx) % worldWidth + halfWidth - dx,
		    newX2 = (x + halfWidth + dx) % worldWidth - halfWidth - dx,
		    newX = Math.abs(newX1 + dx) < Math.abs(newX2 + dx) ? newX1 : newX2;

		this._draggable._absPos = this._draggable._newPos.clone();
		this._draggable._newPos.x = newX;
	},

	_onDragEnd: function (e) {
		var map = this._map,
		    options = map.options,

		    noInertia = !options.inertia || this._times.length < 2;

		map.fire('dragend', e);

		if (noInertia) {
			map.fire('moveend');

		} else {

			var direction = this._lastPos.subtract(this._positions[0]),
			    duration = (this._lastTime - this._times[0]) / 1000,
			    ease = options.easeLinearity,

			    speedVector = direction.multiplyBy(ease / duration),
			    speed = speedVector.distanceTo([0, 0]),

			    limitedSpeed = Math.min(options.inertiaMaxSpeed, speed),
			    limitedSpeedVector = speedVector.multiplyBy(limitedSpeed / speed),

			    decelerationDuration = limitedSpeed / (options.inertiaDeceleration * ease),
			    offset = limitedSpeedVector.multiplyBy(-decelerationDuration / 2).round();

			if (!offset.x || !offset.y) {
				map.fire('moveend');

			} else {
				offset = map._limitOffset(offset, map.options.maxBounds);

				L.Util.requestAnimFrame(function () {
					map.panBy(offset, {
						duration: decelerationDuration,
						easeLinearity: ease,
						noMoveStart: true,
						animate: true
					});
				});
			}
		}
	}
});

L.Map.addInitHook('addHandler', 'dragging', L.Map.Drag);


/*
 * L.Handler.Scroll is used by L.Map to enable mouse scroll wheel zoom on the map.
 */

L.Map.mergeOptions({
	scrollHandler: true,
	wheelDebounceTime: 40
});

L.Map.Scroll = L.Handler.extend({
	addHooks: function () {
		L.DomEvent.on(this._map._container, {
			mousewheel: this._onWheelScroll,
			MozMousePixelScroll: L.DomEvent.preventDefault
		}, this);

		this._delta = 0;
	},

	removeHooks: function () {
		L.DomEvent.off(this._map._container, {
			mousewheel: this._onWheelScroll,
			MozMousePixelScroll: L.DomEvent.preventDefault
		}, this);
	},

	_onWheelScroll: function (e) {
		var delta = L.DomEvent.getWheelDelta(e);
		var debounce = this._map.options.wheelDebounceTime;

		this._delta += delta;
		this._lastMousePos = this._map.mouseEventToContainerPoint(e);

		if (!this._startTime) {
			this._startTime = +new Date();
		}

		var left = Math.max(debounce - (+new Date() - this._startTime), 0);

		clearTimeout(this._timer);
		if (e.ctrlKey) {
			this._timer = setTimeout(L.bind(this._performZoom, this), left);
		}
		else {
			this._timer = setTimeout(L.bind(this._performScroll, this), left);
		}

		L.DomEvent.stop(e);
	},

	_performScroll: function () {
		var map = this._map,
		    delta = -this._delta,
		    scrollAmount = Math.round(map.getSize().y / 4);

		this._delta = 0;
		this._startTime = null;

		if (!delta) { return; }
		map.fire('scrollby', {x: 0, y: delta * scrollAmount});
	},

	_performZoom: function () {
		var map = this._map,
		    delta = this._delta,
		    zoom = map.getZoom();

		map.stop(); // stop panning and fly animations if any

		delta = delta > 0 ? Math.ceil(delta) : Math.floor(delta);
		delta = Math.max(Math.min(delta, 4), -4);
		delta = map._limitZoom(zoom + delta) - zoom;

		this._delta = 0;
		this._startTime = null;

		if (!delta) { return; }

		if (map.options.scrollWheelZoom === 'center') {
			map.setZoom(zoom + delta);
		} else {
			map.setZoomAround(this._lastMousePos, zoom + delta);
		}
	}
});

L.Map.addInitHook('addHandler', 'scrollHandler', L.Map.Scroll);


/*
 * L.Handler.DoubleClickZoom is used to handle double-click zoom on the map, enabled by default.
 */

L.Map.mergeOptions({
	doubleClickZoom: false
});

L.Map.DoubleClickZoom = L.Handler.extend({
	addHooks: function () {
		this._map.on('dblclick', this._onDoubleClick, this);
	},

	removeHooks: function () {
		this._map.off('dblclick', this._onDoubleClick, this);
	},

	_onDoubleClick: function (e) {
		var map = this._map,
		    oldZoom = map.getZoom(),
		    zoom = e.originalEvent.shiftKey ? Math.ceil(oldZoom) - 1 : Math.floor(oldZoom) + 1;

		if (map.options.doubleClickZoom === 'center') {
			map.setZoom(zoom);
		} else {
			map.setZoomAround(e.containerPoint, zoom);
		}
	}
});

L.Map.addInitHook('addHandler', 'doubleClickZoom', L.Map.DoubleClickZoom);


/*
 * Extends the event handling code with double tap support for mobile browsers.
 */

L.extend(L.DomEvent, {

	_touchstart: L.Browser.msPointer ? 'MSPointerDown' : L.Browser.pointer ? 'pointerdown' : 'touchstart',
	_touchend: L.Browser.msPointer ? 'MSPointerUp' : L.Browser.pointer ? 'pointerup' : 'touchend',

	// inspired by Zepto touch code by Thomas Fuchs
	addDoubleTapListener: function (obj, handler, id) {
		var last, touch,
		    doubleTap = false,
		    delay = 250;

		function onTouchStart(e) {
			var count;

			if (L.Browser.pointer) {
				count = L.DomEvent._pointersCount;
			} else {
				count = e.touches.length;
			}

			if (count > 1) { return; }

			var now = Date.now(),
			    delta = now - (last || now);

			touch = e.touches ? e.touches[0] : e;
			doubleTap = (delta > 0 && delta <= delay);
			last = now;
		}

		function onTouchEnd() {
			if (doubleTap) {
				if (L.Browser.pointer) {
					// work around .type being readonly with MSPointer* events
					var newTouch = {},
					    prop, i;

					for (i in touch) {
						prop = touch[i];
						newTouch[i] = prop && prop.bind ? prop.bind(touch) : prop;
					}
					touch = newTouch;
				}
				touch.type = 'dblclick';
				touch.button = 0;
				handler(touch);
				last = null;
			}
		}

		var pre = '_leaflet_',
		    touchstart = this._touchstart,
		    touchend = this._touchend;

		obj[pre + touchstart + id] = onTouchStart;
		obj[pre + touchend + id] = onTouchEnd;

		obj.addEventListener(touchstart, onTouchStart, false);
		obj.addEventListener(touchend, onTouchEnd, false);
		return this;
	},

	removeDoubleTapListener: function (obj, id) {
		var pre = '_leaflet_',
		    touchend = obj[pre + this._touchend + id];

		obj.removeEventListener(this._touchstart, obj[pre + this._touchstart + id], false);
		obj.removeEventListener(this._touchend, touchend, false);

		return this;
	}
});


/*
 * Extends L.DomEvent to provide touch support for Internet Explorer and Windows-based devices.
 */

L.extend(L.DomEvent, {

	POINTER_DOWN:   L.Browser.msPointer ? 'MSPointerDown'   : 'pointerdown',
	POINTER_MOVE:   L.Browser.msPointer ? 'MSPointerMove'   : 'pointermove',
	POINTER_UP:     L.Browser.msPointer ? 'MSPointerUp'     : 'pointerup',
	POINTER_CANCEL: L.Browser.msPointer ? 'MSPointerCancel' : 'pointercancel',

	_pointers: {},
	_pointersCount: 0,

	// Provides a touch events wrapper for (ms)pointer events.
	// ref http://www.w3.org/TR/pointerevents/ https://www.w3.org/Bugs/Public/show_bug.cgi?id=22890

	addPointerListener: function (obj, type, handler, id) {

		if (type === 'touchstart') {
			this._addPointerStart(obj, handler, id);

		} else if (type === 'touchmove') {
			this._addPointerMove(obj, handler, id);

		} else if (type === 'touchend') {
			this._addPointerEnd(obj, handler, id);
		}

		return this;
	},

	removePointerListener: function (obj, type, id) {
		var handler = obj['_leaflet_' + type + id];

		if (type === 'touchstart') {
			obj.removeEventListener(this.POINTER_DOWN, handler, false);

		} else if (type === 'touchmove') {
			obj.removeEventListener(this.POINTER_MOVE, handler, false);

		} else if (type === 'touchend') {
			obj.removeEventListener(this.POINTER_UP, handler, false);
			obj.removeEventListener(this.POINTER_CANCEL, handler, false);
		}

		return this;
	},

	_addPointerStart: function (obj, handler, id) {
		var onDown = L.bind(function (e) {
			L.DomEvent.preventDefault(e);

			this._handlePointer(e, handler);
		}, this);

		obj['_leaflet_touchstart' + id] = onDown;
		obj.addEventListener(this.POINTER_DOWN, onDown, false);

		// need to keep track of what pointers and how many are active to provide e.touches emulation
		if (!this._pointerDocListener) {
			var pointerUp = L.bind(this._globalPointerUp, this);

			// we listen documentElement as any drags that end by moving the touch off the screen get fired there
			document.documentElement.addEventListener(this.POINTER_DOWN, L.bind(this._globalPointerDown, this), true);
			document.documentElement.addEventListener(this.POINTER_MOVE, L.bind(this._globalPointerMove, this), true);
			document.documentElement.addEventListener(this.POINTER_UP, pointerUp, true);
			document.documentElement.addEventListener(this.POINTER_CANCEL, pointerUp, true);

			this._pointerDocListener = true;
		}
	},

	_globalPointerDown: function (e) {
		this._pointers[e.pointerId] = e;
		this._pointersCount++;
	},

	_globalPointerMove: function (e) {
		if (this._pointers[e.pointerId]) {
			this._pointers[e.pointerId] = e;
		}
	},

	_globalPointerUp: function (e) {
		delete this._pointers[e.pointerId];
		this._pointersCount--;
	},

	_handlePointer: function (e, handler) {
		e.touches = [];
		for (var i in this._pointers) {
			e.touches.push(this._pointers[i]);
		}
		e.changedTouches = [e];

		handler(e);
	},

	_addPointerMove: function (obj, handler, id) {
		var onMove = L.bind(function (e) {
			// don't fire touch moves when mouse isn't down
			if ((e.pointerType === e.MSPOINTER_TYPE_MOUSE || e.pointerType === 'mouse') && e.buttons === 0) { return; }

			this._handlePointer(e, handler);
		}, this);

		obj['_leaflet_touchmove' + id] = onMove;
		obj.addEventListener(this.POINTER_MOVE, onMove, false);
	},

	_addPointerEnd: function (obj, handler, id) {
		var onUp = L.bind(function (e) {
			this._handlePointer(e, handler);
		}, this);

		obj['_leaflet_touchend' + id] = onUp;
		obj.addEventListener(this.POINTER_UP, onUp, false);
		obj.addEventListener(this.POINTER_CANCEL, onUp, false);
	}
});


/*
 * L.Handler.TouchZoom is used by L.Map to add pinch zoom on supported mobile browsers.
 */

L.Map.mergeOptions({
	touchZoom: L.Browser.touch && !L.Browser.android23,
	bounceAtZoomLimits: true
});

L.Map.TouchZoom = L.Handler.extend({
	addHooks: function () {
		L.DomEvent.on(this._map._container, 'touchstart', this._onTouchStart, this);
	},

	removeHooks: function () {
		L.DomEvent.off(this._map._container, 'touchstart', this._onTouchStart, this);
	},

	_onTouchStart: function (e) {
		var map = this._map;

		if (!e.touches || e.touches.length !== 2 || map._animatingZoom || this._zooming) { return; }

		var p1 = map.mouseEventToLayerPoint(e.touches[0]),
		    p2 = map.mouseEventToLayerPoint(e.touches[1]),
		    viewCenter = map._getCenterLayerPoint();

		this._startCenter = p1.add(p2)._divideBy(2);
		this._startDist = p1.distanceTo(p2);

		this._moved = false;
		if (map.getDocType() === 'spreadsheet') {
			this._zooming = false;
		}
		else {
			this._zooming = true;
		}

		this._centerOffset = viewCenter.subtract(this._startCenter);

		map.stop();

		L.DomEvent
		    .on(document, 'touchmove', this._onTouchMove, this)
		    .on(document, 'touchend', this._onTouchEnd, this);

		L.DomEvent.preventDefault(e);
	},

	_onTouchMove: function (e) {
		if (!e.touches || e.touches.length !== 2 || !this._zooming) { return; }

		var map = this._map,
		    p1 = map.mouseEventToLayerPoint(e.touches[0]),
		    p2 = map.mouseEventToLayerPoint(e.touches[1]);

		this._scale = p1.distanceTo(p2) / this._startDist;
		this._delta = p1._add(p2)._divideBy(2)._subtract(this._startCenter);

		if (!map.options.bounceAtZoomLimits) {
			var currentZoom = map.getScaleZoom(this._scale);
			if ((currentZoom <= map.getMinZoom() && this._scale < 1) ||
		     (currentZoom >= map.getMaxZoom() && this._scale > 1)) { return; }
		}

		if (!this._moved) {
			map
			    .fire('movestart')
			    .fire('zoomstart');

			this._moved = true;
		}

		L.Util.cancelAnimFrame(this._animRequest);
		this._animRequest = L.Util.requestAnimFrame(this._updateOnMove, this, true, this._map._container);

		L.DomEvent.preventDefault(e);
	},

	_updateOnMove: function () {
		var map = this._map;

		if (map.options.touchZoom === 'center') {
			this._center = map.getCenter();
		} else {
			this._center = map.layerPointToLatLng(this._getTargetCenter());
		}

		this._zoom = map.getScaleZoom(this._scale);

		if (this._scale !== 1 || this._delta.x !== 0 || this._delta.y !== 0) {
			map._animateZoom(this._center, this._zoom, false, true);
		}
	},

	_onTouchEnd: function () {
		if (!this._moved || !this._zooming) {
			this._zooming = false;
			return;
		}

		this._zooming = false;
		L.Util.cancelAnimFrame(this._animRequest);

		L.DomEvent
		    .off(document, 'touchmove', this._onTouchMove)
		    .off(document, 'touchend', this._onTouchEnd);

		var map = this._map,
		    oldZoom = map.getZoom(),
		    zoomDelta = this._zoom - oldZoom,
		    finalZoom = map._limitZoom(zoomDelta > 0 ? Math.ceil(this._zoom) : Math.floor(this._zoom));

		map._animateZoom(this._center, finalZoom, true, true);
	},

	_getTargetCenter: function () {
		var centerOffset = this._centerOffset.subtract(this._delta).divideBy(this._scale);
		return this._startCenter.add(centerOffset);
	}
});

L.Map.addInitHook('addHandler', 'touchZoom', L.Map.TouchZoom);


/*
 * L.Map.Tap is used to enable mobile hacks like quick taps and long hold.
 */

L.Map.mergeOptions({
	tap: true,
	tapTolerance: 15
});

L.Map.Tap = L.Handler.extend({
	addHooks: function () {
		L.DomEvent.on(this._map._container, 'touchstart', this._onDown, this);
	},

	removeHooks: function () {
		L.DomEvent.off(this._map._container, 'touchstart', this._onDown, this);
	},

	_onDown: function (e) {
		if (!e.touches) { return; }

		L.DomEvent.preventDefault(e);

		this._fireClick = true;

		// don't simulate click or track longpress if more than 1 touch
		if (e.touches.length > 1) {
			this._fireClick = false;
			clearTimeout(this._holdTimeout);
			return;
		}

		var first = e.touches[0],
		    el = first.target;

		this._startPos = this._newPos = new L.Point(first.clientX, first.clientY);

		// if touching a link, highlight it
		if (el.tagName && el.tagName.toLowerCase() === 'a') {
			L.DomUtil.addClass(el, 'leaflet-active');
		}

		// simulate long hold but setting a timeout
		this._holdTimeout = setTimeout(L.bind(function () {
			if (this._isTapValid()) {
				this._fireClick = false;
				this._onUp();
				this._simulateEvent('contextmenu', first);
			}
		}, this), 1000);

		this._simulateEvent('mousedown', first);

		L.DomEvent.on(document, {
			touchmove: this._onMove,
			touchend: this._onUp
		}, this);
	},

	_onUp: function (e) {
		clearTimeout(this._holdTimeout);

		L.DomEvent.off(document, {
			touchmove: this._onMove,
			touchend: this._onUp
		}, this);

		if (this._fireClick && e && e.changedTouches) {

			var first = e.changedTouches[0],
			    el = first.target;

			if (el && el.tagName && el.tagName.toLowerCase() === 'a') {
				L.DomUtil.removeClass(el, 'leaflet-active');
			}

			this._simulateEvent('mouseup', first);

			// simulate click if the touch didn't move too much
			if (this._isTapValid()) {
				this._simulateEvent('click', first);
			}
		}
	},

	_isTapValid: function () {
		return this._newPos.distanceTo(this._startPos) <= this._map.options.tapTolerance;
	},

	_onMove: function (e) {
		var first = e.touches[0];
		this._newPos = new L.Point(first.clientX, first.clientY);
	},

	_simulateEvent: function (type, e) {
		var simulatedEvent = document.createEvent('MouseEvents');

		simulatedEvent._simulated = true;
		e.target._simulatedClick = true;

		simulatedEvent.initMouseEvent(
		        type, true, true, window, 1,
		        e.screenX, e.screenY,
		        e.clientX, e.clientY,
		        false, false, false, false, 0, null);

		e.target.dispatchEvent(simulatedEvent);
	}
});

if (L.Browser.touch && !L.Browser.pointer) {
	L.Map.addInitHook('addHandler', 'tap', L.Map.Tap);
}


/*
 * L.Handler.ShiftDragZoom is used to add shift-drag zoom interaction to the map
  * (zoom to a selected bounding box), enabled by default.
 */

L.Map.mergeOptions({
	boxZoom: true
});

L.Map.BoxZoom = L.Handler.extend({
	initialize: function (map) {
		this._map = map;
		this._container = map._container;
		this._pane = map._panes.overlayPane;
	},

	addHooks: function () {
		L.DomEvent.on(this._container, 'mousedown', this._onMouseDown, this);
	},

	removeHooks: function () {
		L.DomEvent.off(this._container, 'mousedown', this._onMouseDown, this);
	},

	moved: function () {
		return this._moved;
	},

	_onMouseDown: function (e) {
		if (!e.shiftKey || ((e.which !== 1) && (e.button !== 0))) { return false; }

		this._moved = false;

		L.DomUtil.disableTextSelection();
		L.DomUtil.disableImageDrag();

		this._startPoint = this._map.mouseEventToContainerPoint(e);

		L.DomEvent.on(document, {
			contextmenu: L.DomEvent.stop,
			mousemove: this._onMouseMove,
			mouseup: this._onMouseUp,
			keydown: this._onKeyDown
		}, this);
	},

	_onMouseMove: function (e) {
		if (!this._moved) {
			this._moved = true;

			this._box = L.DomUtil.create('div', 'leaflet-zoom-box', this._container);
			L.DomUtil.addClass(this._container, 'leaflet-crosshair');

			this._map.fire('boxzoomstart');
		}

		this._point = this._map.mouseEventToContainerPoint(e);

		var bounds = new L.Bounds(this._point, this._startPoint),
		    size = bounds.getSize();

		L.DomUtil.setPosition(this._box, bounds.min);

		this._box.style.width  = size.x + 'px';
		this._box.style.height = size.y + 'px';
	},

	_finish: function () {
		if (this._moved) {
			L.DomUtil.remove(this._box);
			L.DomUtil.removeClass(this._container, 'leaflet-crosshair');
		}

		L.DomUtil.enableTextSelection();
		L.DomUtil.enableImageDrag();

		L.DomEvent.off(document, {
			contextmenu: L.DomEvent.stop,
			mousemove: this._onMouseMove,
			mouseup: this._onMouseUp,
			keydown: this._onKeyDown
		}, this);
	},

	_onMouseUp: function (e) {
		if ((e.which !== 1) && (e.button !== 0)) { return; }

		this._finish();

		if (!this._moved) { return; }
	},

	_onKeyDown: function (e) {
		if (e.keyCode === 27) {
			this._finish();
		}
	}
});

L.Map.addInitHook('addHandler', 'boxZoom', L.Map.BoxZoom);


/*
 * L.Map.Keyboard is handling keyboard interaction with the map, enabled by default.
 */

L.Map.mergeOptions({
	keyboard: true,
	keyboardPanOffset: 20,
	keyboardZoomOffset: 1
});

L.Map.Keyboard = L.Handler.extend({

	keyModifier: {
		shift: 4096,
		ctrl: 8192,
		alt: 16384,
		ctrlMac: 32768
	},

	keymap: {
		8   : 1283, // backspace	: BACKSPACE
		9   : 1282, // tab 		: TAB
		13  : 1280, // enter 		: RETURN
		16  : null, // shift		: UNKOWN
		17  : null, // ctrl		: UNKOWN
		18  : null, // alt		: UNKOWN
		19  : null, // pause/break	: UNKOWN
		20  : null, // caps lock	: UNKOWN
		27  : 1281, // escape		: ESCAPE
		32  : 1284, // space		: SPACE
		33  : 1030, // page up		: PAGEUP
		34  : 1031, // page down	: PAGEDOWN
		35  : 1029, // end		: END
		36  : 1028, // home		: HOME
		37  : 1026, // left arrow	: LEFT
		38  : 1025, // up arrow		: UP
		39  : 1027, // right arrow	: RIGHT
		40  : 1024, // down arrow	: DOWN
		45  : 1285, // insert		: INSERT
		46  : 1286, // delete		: DELETE
		48  : 256,  // 0		: NUM0
		49  : 257,  // 1		: NUM1
		50  : 258,  // 2		: NUM2
		51  : 259,  // 3		: NUM3
		52  : 260,  // 4		: NUM4
		53  : 261,  // 5		: NUM5
		54  : 262,  // 6		: NUM6
		55  : 263,  // 7		: NUM7
		56  : 264,  // 8		: NUM8
		57  : 265,  // 9		: NUM9
		65  : 512,  // A		: A
		66  : 513,  // B		: B
		67  : 514,  // C		: C
		68  : 515,  // D		: D
		69  : 516,  // E		: E
		70  : 517,  // F		: F
		71  : 518,  // G		: G
		72  : 519,  // H		: H
		73  : 520,  // I		: I
		74  : 521,  // J		: J
		75  : 522,  // K		: K
		76  : 523,  // L		: L
		77  : 524,  // M		: M
		78  : 525,  // N		: N
		79  : 526,  // O		: O
		80  : 527,  // P		: P
		81  : 528,  // Q		: Q
		82  : 529,  // R		: R
		83  : 530,  // S		: S
		84  : 531,  // T		: T
		85  : 532,  // U		: U
		86  : 533,  // V		: V
		87  : 534,  // W		: W
		88  : 535,  // X		: X
		89  : 536,  // Y		: Y
		90  : 537,  // Z		: Z
		91  : null, // left window key	: UNKOWN
		92  : null, // right window key	: UNKOWN
		93  : null, // select key	: UNKOWN
		96  : 256,  // numpad 0		: NUM0
		97  : 257,  // numpad 1		: NUM1
		98  : 258,  // numpad 2		: NUM2
		99  : 259,  // numpad 3		: NUM3
		100 : 260,  // numpad 4		: NUM4
		101 : 261,  // numpad 5		: NUM5
		102 : 262,  // numpad 6		: NUM6
		103 : 263,  // numpad 7		: NUM7
		104 : 264,  // numpad 8		: NUM8
		105 : 265,  // numpad 9		: NUM9
		106 : 1289, // multiply		: MULTIPLY
		107 : 1287, // add		: ADD
		109 : 1288, // subtract		: SUBTRACT
		110 : 1309, // decimal point	: DECIMAL
		111 : 1290, // divide		: DIVIDE
		112 : 768,  // f1		: F1
		113 : 769,  // f2		: F2
		114 : 770,  // f3		: F3
		115 : 771,  // f4		: F4
		116 : 772,  // f5		: F5
		117 : 773,  // f6		: F6
		118 : 774,  // f7		: F7
		119 : 775,  // f8		: F8
		120 : 776,  // f9		: F9
		121 : 777,  // f10		: F10
		122 : 778,  // f11		: F11
		144 : 1313, // num lock		: NUMLOCK
		145 : 1314, // scroll lock	: SCROLLLOCK
		173 : 1288, // dash		: DASH (on Firefox)
		186 : 1317, // semi-colon	: SEMICOLON
		187 : 1295, // equal sign	: EQUAL
		188 : 1292, // comma		: COMMA
		189 : 1288, // dash		: DASH
		190 : null, // period		: UNKOWN
		191 : null, // forward slash	: UNKOWN
		192 : null, // grave accent	: UNKOWN
		219 : null, // open bracket	: UNKOWN
		220 : null, // back slash	: UNKOWN
		221 : null, // close bracket	: UNKOWN
		222 : null  // single quote	: UNKOWN
	},

	handleOnKeyDownKeys: {
		// these keys need to be handled on keydown in order for them
		// to work on chrome
		8   : true, // backspace
		9   : true, // tab
		19  : true, // pause/break
		20  : true, // caps lock
		27  : true, // escape
		33  : true, // page up
		34  : true, // page down
		35  : true, // end
		36  : true, // home
		37  : true, // left arrow
		38  : true, // up arrow
		39  : true, // right arrow
		40  : true, // down arrow
		45  : true, // insert
		46  : true // delete
	},

	keyCodes: {
		pageUp:   33,
		pageDown: 34,
		enter:    13
	},

	navigationKeyCodes: {
		left:    [37],
		right:   [39],
		down:    [40],
		up:      [38],
		zoomIn:  [187, 107, 61, 171],
		zoomOut: [189, 109, 173]
	},

	initialize: function (map) {
		this._map = map;
		this._setPanOffset(map.options.keyboardPanOffset);
		this._setZoomOffset(map.options.keyboardZoomOffset);
		this.modifier = 0;
	},

	addHooks: function () {
		var container = this._map._container;

		// make the container focusable by tabbing
		if (container.tabIndex === -1) {
			container.tabIndex = '0';
		}

		this._map.on('mousedown', this._onMouseDown, this);
		this._map.on('keydown keyup keypress', this._onKeyDown, this);
		this._map.on('compositionstart compositionupdate compositionend textInput', this._onKeyDown, this);
	},

	removeHooks: function () {
		this._map.off('mousedown', this._onMouseDown, this);
		this._map.off('keydown keyup keypress', this._onKeyDown, this);
		this._map.off('compositionstart compositionupdate compositionend textInput', this._onKeyDown, this);
	},

	_handleOnKeyDown: function (keyCode, modifier) {
		if (modifier & this.keyModifier.shift) {
			// don't handle shift+insert, shift+delete
			// These are converted to 'cut', 'paste' events which are
			// automatically handled by us, so avoid double-handling
			if (keyCode === 45 || keyCode === 46) {
				return false;
			}
		}

		return this.handleOnKeyDownKeys[keyCode];
	},

	_setPanOffset: function (pan) {
		var keys = this._panKeys = {},
		    codes = this.navigationKeyCodes,
		    i, len;

		for (i = 0, len = codes.left.length; i < len; i++) {
			keys[codes.left[i]] = [-1 * pan, 0];
		}
		for (i = 0, len = codes.right.length; i < len; i++) {
			keys[codes.right[i]] = [pan, 0];
		}
		for (i = 0, len = codes.down.length; i < len; i++) {
			keys[codes.down[i]] = [0, pan];
		}
		for (i = 0, len = codes.up.length; i < len; i++) {
			keys[codes.up[i]] = [0, -1 * pan];
		}
	},

	_setZoomOffset: function (zoom) {
		var keys = this._zoomKeys = {},
		    codes = this.navigationKeyCodes,
		    i, len;

		for (i = 0, len = codes.zoomIn.length; i < len; i++) {
			keys[codes.zoomIn[i]] = zoom;
		}
		for (i = 0, len = codes.zoomOut.length; i < len; i++) {
			keys[codes.zoomOut[i]] = -zoom;
		}
	},

	_onMouseDown: function () {
		if (this._map._permission === 'edit') {
			return;
		}
		this._map._container.focus();
	},

	// Convert javascript key codes to UNO key codes.
	_toUNOKeyCode: function (keyCode) {
		return this.keymap[keyCode] || keyCode;
	},

	_onKeyDown: function (e) {
		if (this._map.slideShow && this._map.slideShow.fullscreen) {
			return;
		}
		var docLayer = this._map._docLayer;
		this.modifier = 0;
		var shift = e.originalEvent.shiftKey ? this.keyModifier.shift : 0;
		var ctrl = e.originalEvent.ctrlKey ? this.keyModifier.ctrl : 0;
		var alt = e.originalEvent.altKey ? this.keyModifier.alt : 0;
		var cmd = e.originalEvent.metaKey ? this.keyModifier.ctrl : 0;
		var location = e.originalEvent.location;
		this._keyHandled = this._keyHandled || false;
		this.modifier = shift | ctrl | alt | cmd;

		// On Windows, pressing AltGr = Alt + Ctrl
		// Presence of AltGr is detected if previous Ctrl + Alt 'location' === 2 (i.e right)
		// because Ctrl + Alt + <some char> won't give any 'location' information.
		if (ctrl && alt) {
			if (e.type === 'keydown' && location === 2) {
				this._prevCtrlAltLocation = location;
				return;
			}
			else if (location === 1) {
				this._prevCtrlAltLocation = undefined;
			}

			if (this._prevCtrlAltLocation === 2 && location === 0) {
				// and we got the final character
				if (e.type === 'keypress') {
					ctrl = alt = this.modifier = 0;
				}
				else {
					// Don't handle remnant 'keyup'
					return;
				}
			}
		}

		if (ctrl || cmd) {
			if (this._handleCtrlCommand(e)) {
				return;
			}
		}

		var charCode = e.originalEvent.charCode;
		var keyCode = e.originalEvent.keyCode;

		if (e.type === 'compositionstart' || e.type === 'compositionupdate') {
			this._isComposing = true; // we are starting composing with IME
		}

		if (e.type === 'compositionend') {
			this._isComposing = false; // stop of composing with IME
			// get the composited char codes
			var compCharCodes = [];
			for (var i = 0; i < e.originalEvent.data.length; i++) {
				compCharCodes.push(e.originalEvent.data[i].charCodeAt());
			}
			// clear the input now - best to do this ASAP so the input
			// is clear for the next word
			this._map._textArea.value = '';
		}

		if (!this._isComposing && e.type === 'keyup') {
			// not compositing and keyup, clear the input so it is ready
			// for next word (or char only)
			this._map._textArea.value = '';
		}

		var unoKeyCode = this._toUNOKeyCode(keyCode);

		if (this.modifier) {
			unoKeyCode |= this.modifier;
			if (e.type !== 'keyup' && (this.modifier !== shift || (keyCode === 32 && !docLayer._isCursorVisible))) {
				docLayer._postKeyboardEvent('input', charCode, unoKeyCode);
				e.originalEvent.preventDefault();
				return;
			}
		}

		if (this._map._permission === 'edit') {
			docLayer._resetPreFetching();

			if (e.type === 'keydown') {
				this._keyHandled = false;
				this._bufferedTextInputEvent = null;

				if (this._handleOnKeyDown(keyCode, this.modifier) && charCode === 0) {
					docLayer._postKeyboardEvent('input', charCode, unoKeyCode);
				}
			}
			else if ((e.type === 'keypress' || e.type === 'compositionend') &&
			         (!this._handleOnKeyDown(keyCode, this.modifier) || charCode !== 0)) {
				if (charCode === keyCode && charCode !== 13) {
					// Chrome sets keyCode = charCode for printable keys
					// while LO requires it to be 0
					keyCode = 0;
					unoKeyCode = this._toUNOKeyCode(keyCode);
				}
				if (docLayer._debug) {
					// key press times will be paired with the invalidation messages
					docLayer._debugKeypressQueue.push(+new Date());
				}
				if (e.type === 'compositionend') {
					// Set all keycodes to zero
					docLayer._postKeyboardEvents('input', compCharCodes, Array.apply(null, Array(compCharCodes.length)).map(Number.prototype.valueOf, 0));
				} else {
					docLayer._postKeyboardEvent('input', charCode, unoKeyCode);
				}

				this._keyHandled = true;
			}
			else if (e.type === 'textInput') {
				// Store the textInput event
				this._bufferedTextInputEvent = e;
			}
			else if (e.type === 'keyup') {
				// Hack for making space and spell-check text insert work
				// in Chrome (on Andorid) or Chrome with IME.
				//
				// Chrome (Android) IME triggers keyup/keydown input with
				// code 229 when hitting space (as with all composiiton events)
				// with addition to 'textinput' event, in which we only see that
				// space was entered. Similar situation is also when inserting
				// a soft-keyboard spell-check item - it is visible only with
				// 'textinput' event (no composition event is fired).
				// To make this work we need to insert textinput.data here..
				//
				// TODO: Maybe make sure this is only triggered when keydown has
				// 229 code. Also we need to detect that composition was overriden
				// (part or whole word deleted) with the spell-checked word. (for
				// example: enter 'tar' and with spell-check correct that to 'rat')

				if (!this._keyHandled && this._bufferedTextInputEvent) {
					var textInputData = this._bufferedTextInputEvent.originalEvent.data;
					charCode = e.originalEvent.keyCode;
					var compCharCodes = [];
					for (var i = 0; i < textInputData.length; i++) {
						compCharCodes.push(textInputData[i].charCodeAt());
					}
					docLayer._postKeyboardEvents('input', compCharCodes, Array.apply(null, Array(compCharCodes.length)).map(Number.prototype.valueOf, 0));
				}
				docLayer._postKeyboardEvent('up', charCode, unoKeyCode);

				this._keyHandled = true;
				this._bufferedTextInputEvent = null;
			}
			if (keyCode === 9) {
				// tab would change focus to other DOM elements
				e.originalEvent.preventDefault();
			}
		}
		else if (!this.modifier && (e.originalEvent.keyCode === 33 || e.originalEvent.keyCode === 34)) {
			// let the scrollbar handle page up / page down when viewing
			return;
		}
		else if (e.type === 'keydown') {
			var key = e.originalEvent.keyCode;
			var map = this._map;
			if (key in this._panKeys && !e.originalEvent.shiftKey) {
				if (map._panAnim && map._panAnim._inProgress) {
					return;
				}
				map.fire('scrollby', {x: this._panKeys[key][0], y: this._panKeys[key][1]});
			}
			else if (key in this._panKeys && e.originalEvent.shiftKey &&
					docLayer._selections.getLayers().length !== 0) {
				// if there is a selection and the user wants to modify it
				docLayer._postKeyboardEvent('input', charCode, unoKeyCode);
			}
			else if (key in this._zoomKeys) {
				map.setZoom(map.getZoom() + (e.shiftKey ? 3 : 1) * this._zoomKeys[key]);
			}
		}

		L.DomEvent.stopPropagation(e.originalEvent);
	},

	_handleCtrlCommand: function (e) {
		if (e.type !== 'keydown' && e.originalEvent.key !== 'c' && e.originalEvent.key !== 'v' && e.originalEvent.key !== 'x' &&
			/* Safari */ e.originalEvent.keyCode !== 99 && e.originalEvent.keyCode !== 118 && e.originalEvent.keyCode !== 120) {
			e.originalEvent.preventDefault();
			return true;
		}

		if (e.originalEvent.keyCode !== 67 && e.originalEvent.keyCode !== 86 && e.originalEvent.keyCode !== 88 &&
			/* Safari */ e.originalEvent.keyCode !== 99 && e.originalEvent.keyCode !== 118 && e.originalEvent.keyCode !== 120 &&
			e.originalEvent.key !== 'c' && e.originalEvent.key !== 'v' && e.originalEvent.key !== 'x') {
			// not copy or paste
			e.originalEvent.preventDefault();
		}

		if (e.originalEvent.ctrlKey && e.originalEvent.shiftKey && e.originalEvent.key === '?') {
			map.showLOKeyboardHelp();
			e.originalEvent.preventDefault();
			return true;
		}

		if (e.originalEvent.ctrlKey && (e.originalEvent.key === 'z' || e.originalEvent.key === 'Z')) {
			this._map._socket.sendMessage('uno .uno:Undo');
			e.originalEvent.preventDefault();
			return true;
		}

		if (e.originalEvent.ctrlKey && (e.originalEvent.key === 'y' || e.originalEvent.key === 'Y')) {
			this._map._socket.sendMessage('uno .uno:Redo');
			e.originalEvent.preventDefault();
			return true;
		}

		if (e.originalEvent.altKey || e.originalEvent.shiftKey) {

			// need to handle Ctrl + Alt + C separately for Firefox
			if (e.originalEvent.key === 'c' && e.originalEvent.altKey) {
				this._map.insertComment();
				return true;
			}

			// Ctrl + Alt
			if (!e.originalEvent.shiftKey) {
				switch (e.originalEvent.keyCode) {
				case 53: // 5
					this._map._socket.sendMessage('uno .uno:Strikeout');
					return true;
				case 70: // f
					this._map._socket.sendMessage('uno .uno:InsertFootnote');
					return true;
				case 67: // c
				case 77: // m
					this._map._socket.sendMessage('uno .uno:InsertAnnotation');
					return true;
				case 68: // d
					this._map._socket.sendMessage('uno .uno:InsertEndnote');
					return true;
				}
			} else if (e.originalEvent.altKey) {
				switch (e.originalEvent.keyCode) {
				case 68: // Ctrl + Shift + Alt + d for tile debugging mode
					this._map._docLayer.toggleTileDebugMode();
				}
			}

			return false;
		}

		switch (e.originalEvent.keyCode) {
		case 51: // 3
			if (this._map.getDocType() === 'spreadsheet') {
				this._map._socket.sendMessage('uno .uno:SetOptimalColumnWidthDirect');
				this._map._socket.sendMessage('commandvalues command=.uno:ViewRowColumnHeaders');
				return true;
			}
			return false;
		case 53: // 5
			if (this._map.getDocType() === 'spreadsheet') {
				this._map._socket.sendMessage('uno .uno:Strikeout');
				return true;
			}
			return false;
		case 67: // c
		case 88: // x
		case 99: // c (Safari)
		case 120: // x (Safari)
		case 91: // Left Cmd (Safari)
		case 93: // Right Cmd (Safari)
			// we prepare for a copy or cut event
			this._map._docLayer._textArea.value = 'dummy text';
			this._map._docLayer._textArea.focus();
			this._map._docLayer._textArea.select();
			return true;
		case 80: // p
			this._map.print();
			return true;
		case 83: // s
			this._map.save(false /* An explicit save should terminate cell edit */,
			               false /* An explicit save should save it again */);
			return true;
		case 86: // v
		case 118: // v (Safari)
			return true;
		case 112: // f1
			this._map._socket.sendMessage('uno .uno:NoteVisible');
			return true;
		case 188: // ,
			this._map._socket.sendMessage('uno .uno:SubScript');
			return true;
		case 190: // .
			this._map._socket.sendMessage('uno .uno:SuperScript');
			return true;
		}
		if (e.type === 'keypress' && (e.originalEvent.ctrlKey || e.originalEvent.metaKey) &&
			(e.originalEvent.key === 'c' || e.originalEvent.key === 'v' || e.originalEvent.key === 'x')) {
			// need to handle this separately for Firefox
			return true;
		}
		return false;
	}
});

L.Map.addInitHook('addHandler', 'keyboard', L.Map.Keyboard);


/*
 * Extends the event handling code with triple and quadruple click support
 * This is vaguely based on the DomEvent.DoubleTap implementation.
 */

L.extend(L.DomEvent, {

	addMultiClickListener: function (obj, handler, id) {
		var last = [],
		    delay = 250;

		function onClick(e) {
			var now = Date.now();
			var delta = 0;
			if (last) {
				delta = now - (last[last.length - 1] || now);
			}

			var doubleTap = (delta > 0 && delta <= delay);

			var tripleTap = false;
			if (last.length > 1 && doubleTap) {
				var delta2 = last[last.length - 1] - last[last.length - 2];
				tripleTap = (delta2 > 0 && delta2 <= delay);
			}

			if (tripleTap) {

				var quadTap = false;
				if (last.length > 2 && tripleTap) {
					var delta3 = last[last.length - 2] - last[last.length - 3];
					quadTap = (delta3 > 0 && delta3 <= delay);
				}

				// We can't modify e as it's a native DOM object, hence we copy
				// what we need instead. (I am however unable to actually find any
				// documentation regarding this anywhere.)
				var eOut = {
					type: quadTap ? 'qdrplclick' : 'trplclick',
					clientX: e.clientX,
					clientY: e.clientY,
					button: e.button,
					target: e.target
				};

				handler(eOut);
			}

			last.push(now);
			while (last.length > 3) {
				last.shift();
			}
		}

		obj['_leaflet_click' + id] = onClick;

		obj.addEventListener('click', onClick, false);
		return this;
	},

	removeMultiClickListener: function (obj, id) {
		obj.removeEventListener('click', obj['_leaflet_click' + id], false);

		return this;
	}
});


/*
 * L.Map.Mouse is handling mouse interaction with the document
 */

L.Map.mergeOptions({
	mouse: true
});

L.Map.Mouse = L.Handler.extend({

	initialize: function (map) {
		this._map = map;
		this._mouseEventsQueue = [];
		this._prevMousePos = null;
	},

	addHooks: function () {
		this._map.on('mousedown mouseup mouseover mouseout mousemove dblclick trplclick qdrplclick',
			this._onMouseEvent, this);
	},

	removeHooks: function () {
		this._map.off('mousedown mouseup mouseover mouseout mousemove dblclick trplclick qdrplclick',
			this._onMouseEvent, this);
	},

	LOButtons: {
		left: 1,
		middle: 2,
		right: 4
	},

	JSButtons: {
		left: 0,
		middle: 1,
		right: 2
	},

	_onMouseEvent: function (e) {
		var docLayer = this._map._docLayer;
		if (!docLayer || (this._map.slideShow && this._map.slideShow.fullscreen)) {
			return;
		}
		if (docLayer._graphicMarker) {
			if (docLayer._graphicMarker.isDragged) {
				return;
			}
			if (!docLayer._isEmptyRectangle(docLayer._graphicSelection) &&
					docLayer._graphicMarker.getBounds().contains(e.latlng)) {
				// if we have a graphic selection and the user clicks inside the rectangle
				if (e.type === 'mousedown') {
					this._prevMousePos = e.latlng;
				}
				else if (e.type === 'mousemove' && this._mouseDown && !this._prevMousePos) {
					// if the user started to drag the shape before the selection
					// has been drawn
					this._prevMousePos = e.latlng;
				}
				else if (e.type === 'mousemove' && this._prevMousePos) {
					// we have a graphic selection and the user started to drag it
					var delta = L.latLng(e.latlng.lat - this._prevMousePos.lat, e.latlng.lng - this._prevMousePos.lng);
					this._prevMousePos = e.latlng;
					var oldSelectionCenter = docLayer._graphicMarker.getBounds().getCenter();
					var newSelectionCenter = L.latLng(oldSelectionCenter.lat + delta.lat, oldSelectionCenter.lng + delta.lng);
					if (docLayer._graphicMarker.editing) {
						docLayer._graphicMarker.editing._move(newSelectionCenter);
					}
				}
				else if (e.type === 'mouseup') {
					this._prevMousePos = null;
				}
			}
		}

		for (var key in docLayer._selectionHandles) {
			if (docLayer._selectionHandles[key].isDragged) {
				return;
			}
		}

		var modifier = 0;
		var shift = e.originalEvent.shiftKey ? this._map.keyboard.keyModifier.shift : 0;
		var ctrl = e.originalEvent.ctrlKey ? this._map.keyboard.keyModifier.ctrl : 0;
		var alt = e.originalEvent.altKey ? this._map.keyboard.keyModifier.alt : 0;
		var cmd = e.originalEvent.metaKey ? this._map.keyboard.keyModifier.ctrlMac : 0;
		modifier = shift | ctrl | alt | cmd;

		var buttons = 0;
		buttons |= e.originalEvent.button === this.JSButtons.left ? this.LOButtons.left : 0;
		buttons |= e.originalEvent.button === this.JSButtons.middle ? this.LOButtons.middle : 0;
		buttons |= e.originalEvent.button === this.JSButtons.right ? this.LOButtons.right : 0;

		var mouseEnteringLeavingMap = this._map._mouseEnteringLeaving;

		if (mouseEnteringLeavingMap && e.type === 'mouseover' && this._mouseDown) {
			L.DomEvent.off(document, 'mousemove', this._onMouseMoveOutside, this);
			L.DomEvent.off(document, 'mouseup', this._onMouseUpOutside, this);
			L.DomEvent.off(this._map._resizeDetector.contentWindow, 'mousemove', this._onMouseMoveOutside, this);
			L.DomEvent.off(this._map._resizeDetector.contentWindow, 'mouseup', this._onMouseUpOutside, this);
		}
		else if (e.type === 'mousedown') {
			docLayer._resetPreFetching();
			this._mouseDown = true;
			if (this._holdMouseEvent) {
				clearTimeout(this._holdMouseEvent);
			}
			var mousePos = docLayer._latLngToTwips(e.latlng);
			this._mouseEventsQueue.push(L.bind(function() {
				this._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, buttons, modifier);
			}, docLayer));
			this._holdMouseEvent = setTimeout(L.bind(this._executeMouseEvents, this), 500);
		}
		else if (e.type === 'mouseup') {
			this._mouseDown = false;
			if (this._map.dragging.enabled()) {
				if (this._mouseEventsQueue.length === 0) {
					// mouse up after panning
					return;
				}
			}
			clearTimeout(this._holdMouseEvent);
			this._holdMouseEvent = null;
			if (this._clickTime && Date.now() - this._clickTime <= 250) {
				// double click, a click was sent already
				this._mouseEventsQueue = [];
				this._clickCount++;
				if (this._clickCount < 4) {
					// Reset the timer in order to keep resetting until
					// we could have sent through a quadruple click. After this revert
					// to normal behaviour so that a following single-click is treated
					// as a separate click, in order to match LO desktop behaviour.
					// (Clicking five times results in paragraph selection after 4 clicks,
					// followed by resetting to a single cursor and no selection on the
					// fifth click.)
					this._clickTime = Date.now();
				}
				return;
			}
			else {
				this._clickTime = Date.now();
				this._clickCount = 1;
				mousePos = docLayer._latLngToTwips(e.latlng);
				var timeOut = 250;
				if (this._map._permission === 'edit') {
					timeOut = 0;
				}
				this._mouseEventsQueue.push(L.bind(function() {
					var docLayer = this._map._docLayer;
					this._mouseEventsQueue = [];
					docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, buttons, modifier);
					docLayer._textArea.focus();
				}, this));
				this._holdMouseEvent = setTimeout(L.bind(this._executeMouseEvents, this), timeOut);

				for (key in docLayer._selectionHandles) {
					var handle = docLayer._selectionHandles[key];
					if (handle._icon) {
						L.DomUtil.removeClass(handle._icon, 'leaflet-not-clickable');
					}
				}
			}

			this._map.fire('scrollvelocity', {vx: 0, vy: 0});
		}
		else if (e.type === 'mousemove' && this._mouseDown) {
			if (this._holdMouseEvent) {
				clearTimeout(this._holdMouseEvent);
				this._holdMouseEvent = null;
				if (this._map.dragging.enabled()) {
					// The user just panned the document
					this._mouseEventsQueue = [];
					return;
				}
				for (var i = 0; i < this._mouseEventsQueue.length; i++) {
					// synchronously execute old mouse events so we know that
					// they arrive to the server before the move command
					this._mouseEventsQueue[i]();
				}
				this._mouseEventsQueue = [];
			}
			if (!this._map.dragging.enabled()) {
				mousePos = docLayer._latLngToTwips(e.latlng);
				docLayer._postMouseEvent('move', mousePos.x, mousePos.y, 1, buttons, modifier);

				for (key in docLayer._selectionHandles) {
					handle = docLayer._selectionHandles[key];
					if (handle._icon) {
						L.DomUtil.addClass(handle._icon, 'leaflet-not-clickable');
					}
				}

				this._map.fire('handleautoscroll', {pos: e.containerPoint, map: this._map});
			}
		}
		else if (e.type === 'mousemove' && !this._mouseDown) {
			clearTimeout(this._mouseOverTimeout);
			mousePos = docLayer._latLngToTwips(e.latlng);
			this._mouseOverTimeout = setTimeout(L.bind(function() {
				docLayer._postMouseEvent('move', mousePos.x, mousePos.y, 1, 0, modifier);
			  }, this),
			  100);
		}
		else if (e.type === 'dblclick' || e.type === 'trplclick' || e.type === 'qdrplclick') {
			mousePos = docLayer._latLngToTwips(e.latlng);
			var clicks = {
				dblclick: 2,
				trplclick: 3,
				qdrplclick: 4
			};
			var count = clicks[e.type];

			docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, count, buttons, modifier);
			docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, count, buttons, modifier);
		}
		else if (mouseEnteringLeavingMap && e.type === 'mouseout' && this._mouseDown) {
			L.DomEvent.on(this._map._resizeDetector.contentWindow, 'mousemove', this._onMouseMoveOutside, this);
			L.DomEvent.on(this._map._resizeDetector.contentWindow, 'mouseup', this._onMouseUpOutside, this);
			L.DomEvent.on(document, 'mousemove', this._onMouseMoveOutside, this);
			L.DomEvent.on(document, 'mouseup', this._onMouseUpOutside, this);
		}
	},

	_executeMouseEvents: function () {
		this._holdMouseEvent = null;
		for (var i = 0; i < this._mouseEventsQueue.length; i++) {
			this._mouseEventsQueue[i]();
		}
		this._mouseEventsQueue = [];
	},

	_onMouseMoveOutside: function (e) {
		this._map._handleDOMEvent(e);
		if (this._map.dragging.enabled()) {
			this._map.dragging._draggable._onMove(e);
		}
	},

	_onMouseUpOutside: function (e) {
		this._mouseDown = false;
		L.DomEvent.off(document, 'mousemove', this._onMouseMoveOutside, this);
		L.DomEvent.off(document, 'mouseup', this._onMouseUpOutside, this);
		L.DomEvent.off(this._map._resizeDetector.contentWindow, 'mousemove', this._onMouseMoveOutside, this);
		L.DomEvent.off(this._map._resizeDetector.contentWindow, 'mouseup', this._onMouseUpOutside, this);

		this._map._handleDOMEvent(e);
		if (this._map.dragging.enabled()) {
			this._map.dragging._draggable._onUp(e);
		}
	}
});

L.Map.addInitHook('addHandler', 'mouse', L.Map.Mouse);


/*
 * L.Map.Print is handling the print action
 */

L.Map.mergeOptions({
	printHandler: true
});

L.Map.Print = L.Handler.extend({

	initialize: function (map) {
		this._map = map;
	},

	addHooks: function () {
		this._map.on('filedownloadready', this._onFileReady, this);
	},

	removeHooks: function () {
		this._map.off('filedownloadready', this._onFileReady, this);
	},

	_onFileReady: function (e) {
		// we need to load the pdf document and pass it to the iframe as an
		// object URL, because else we might have cross origin security problems
		var xmlHttp = new XMLHttpRequest();
		xmlHttp.onreadystatechange = L.bind(function () {
			if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
				this._onInitPrint(xmlHttp);
			}
		}, this);
		xmlHttp.open('GET', e.url, true);
		xmlHttp.responseType = 'blob';
		xmlHttp.send();
	},

	_onInitPrint: function (e) {
		var blob = new Blob([e.response], {type: 'application/pdf'});
		var url = URL.createObjectURL(blob);
		this._printIframe = L.DomUtil.create('iframe', '', document.body);
		this._printIframe.onload = L.bind(this._onIframeLoaded, this);
		L.DomUtil.setStyle(this._printIframe, 'visibility', 'hidden');
		L.DomUtil.setStyle(this._printIframe, 'position', 'fixed');
		L.DomUtil.setStyle(this._printIframe, 'right', '0');
		L.DomUtil.setStyle(this._printIframe, 'bottom', '0');
		this._printIframe.src = url;
	},

	_onIframeLoaded: function () {
		this._printIframe.contentWindow.focus(); // Required for IE
		this._printIframe.contentWindow.print();
		// couldn't find another way to remove it
		setTimeout(L.bind(this._closePrintIframe, this, this._printIframe), 300 * 1000);
	},

	_closePrintIframe: function (printIframe) {
		L.DomUtil.remove(printIframe);
		this._map.focus();
	}
});

L.Map.addInitHook('addHandler', 'printHandler', L.Map.Print);


/*
 * L.Map.SlideShow is handling the slideShow action
 */

L.Map.mergeOptions({
	slideShow: true
});

L.Map.SlideShow = L.Handler.extend({

	initialize: function (map) {
		this._map = map;
	},

	addHooks: function () {
		this._map.on('fullscreen', this._onFullScreen, this);
		this._map.on('slidedownloadready', this._onSlideDownloadReady, this);
	},

	removeHooks: function () {
		this._map.off('fullscreen', this._onFullScreen, this);
		this._map.off('slidedownloadready', this._onSlideDownloadReady, this);
	},

	_onFullScreen: function () {
		this._slideShow = L.DomUtil.create('iframe', 'leaflet-slideshow', this._map._container);
		this._slideShow.src = this._map.options.webserver + '/loleaflet/dist/loading.html';
		if (this._slideShow.requestFullscreen) {
			this._slideShow.requestFullscreen();
		}
		else if (this._slideShow.msRequestFullscreen) {
			this._slideShow.msRequestFullscreen();
		}
		else if (this._slideShow.mozRequestFullScreen) {
			this._slideShow.mozRequestFullScreen();
		}
		else if (this._slideShow.webkitRequestFullscreen) {
			this._slideShow.webkitRequestFullscreen();
		}

		L.DomEvent.on(document, 'fullscreenchange webkitfullscreenchange mozfullscreenchange msfullscreenchange',
				this._onFullScreenChange, this);

		this.fullscreen = true;
		this._map.downloadAs('slideshow.svg', 'svg', null, 'slideshow');
	},

	_onFullScreenChange: function () {

		this.fullscreen = document.fullscreen ||
			document.webkitIsFullScreen ||
			document.mozFullScreen ||
			document.msFullscreenElement;
		if (!this.fullscreen) {
			L.DomUtil.remove(this._slideShow);
		}
	},

	_onSlideDownloadReady: function (e) {
		this._slideShow.src = e.url;
		this._slideShow.contentWindow.focus();
		clearInterval(this._slideShow.contentWindow.spinnerInterval);
	}
});

L.Map.addInitHook('addHandler', 'slideShow', L.Map.SlideShow);


/*
 * L.Map.FileInserter is handling the fileInserter action
 */

L.Map.mergeOptions({
	fileInserter: true
});

L.Map.FileInserter = L.Handler.extend({

	initialize: function (map) {
		this._map = map;
		this._childId = null;
		this._toInsert = {};
		var parser = document.createElement('a');
		parser.href = map.options.server;
		this._url = map.options.webserver + '/' + map.options.urlPrefix +
			'/' + encodeURIComponent(map.options.doc) + '/insertfile';
	},

	addHooks: function () {
		this._map.on('insertfile', this._onInsertFile, this);
		this._map.on('childid', this._onChildIdMsg, this);
	},

	removeHooks: function () {
		this._map.off('insertfile', this._onInsertFile, this);
		this._map.off('childid', this._onChildIdMsg, this);
	},

	_onInsertFile: function (e) {
		if (!this._childId) {
			this._map._socket.sendMessage('getchildid');
			this._toInsert[Date.now()] = e.file;
		}
		else {
			this._sendFile(Date.now(), e.file);
		}
	},

	_onChildIdMsg: function (e) {
		this._childId = e.id;
		for (var name in this._toInsert) {
			this._sendFile(name, this._toInsert[name]);
		}
		this._toInsert = {};
	},

	_sendFile: function (name, file) {
		var url = this._url;
		var xmlHttp = new XMLHttpRequest();
		var socket = this._map._socket;
		var map = this._map;
		this._map.showBusy(_('Uploading...'), false);
		xmlHttp.onreadystatechange = function () {
			if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
				map.hideBusy();
				socket.sendMessage('insertfile name=' + name + ' type=graphic');
			}
		};
		xmlHttp.open('POST', url, true);
		var formData = new FormData();
		formData.append('name', name);
		formData.append('childid', this._childId);
		formData.append('file', file);
		xmlHttp.send(formData);
	}
});

L.Map.addInitHook('addHandler', 'fileInserter', L.Map.FileInserter);


/*
 * L.Map.StateChanges stores the state changes commands coming from core
 * LOK_CALLBACK_STATE_CHANGED callback
 */

L.Map.mergeOptions({
	stateChangeHandler: true
});

L.Map.StateChangeHandler = L.Handler.extend({

	initialize: function (map) {
		this._map = map;
		// Contains the items for which state will be tracked
		// Stores the last received value from core ('true', 'false', 'enabled', 'disabled')
		this._items = {};
	},

	addHooks: function () {
		this._map.on('commandstatechanged', this._onStateChanged, this);
	},

	removeHooks: function () {
		this._map.off('commandstatechanged', this._onStateChanged, this);
	},

	_onStateChanged: function(e) {
		this._items[e.commandName] = e.state;
	},

	getItems: function() {
		return this._items;
	},

	getItemValue: function(unoCmd) {
		if (unoCmd && unoCmd.substring(0, 5) !== '.uno:') {
			unoCmd = '.uno:' + unoCmd;
		}

		return this._items[unoCmd];
	}
});

L.Map.addInitHook('addHandler', 'stateChangeHandler', L.Map.StateChangeHandler);


/*
 * L.WOPI contains WOPI related logic
 */

/* global title w2ui toolbarUpMobileItems resizeToolbar */
L.Map.WOPI = L.Handler.extend({
	// If the CheckFileInfo call fails on server side, we won't have any PostMessageOrigin.
	// So use '*' because we still needs to send 'close' message to the parent frame which
	// wouldn't be possible otherwise.
	PostMessageOrigin: '*',
	DocumentLoadedTime: false,
	HidePrintOption: false,
	HideSaveOption: false,
	HideExportOption: false,
	DisablePrint: false,
	DisableExport: false,
	DisableCopy: false,

	_appLoadedConditions: {
		doclayerinit: false,
		updatepermission: false,
		viewinfo: false /* Whether view information has already arrived */
	},

	_appLoaded: false,

	initialize: function(map) {
		this._map = map;
	},

	addHooks: function() {
		this._map.on('postMessage', this._postMessage, this);

		// init messages
		this._map.on('doclayerinit', this._postLoaded, this);
		this._map.on('updatepermission', this._postLoaded, this);
		// This indicates that 'viewinfo' message has already arrived
		this._map.on('viewinfo', this._postLoaded, this);

		this._map.on('wopiprops', this._setWopiProps, this);
		L.DomEvent.on(window, 'message', this._postMessageListener, this);
	},

	removeHooks: function() {
		this._map.off('postMessage', this._postMessage, this);

		// init messages
		this._map.off('doclayerinit', this._postLoaded, this);
		this._map.off('updatepermission', this._postLoaded, this);
		this._map.off('viewinfo', this._postLoaded, this);

		this._map.off('wopiprops', this._setWopiProps, this);
		L.DomEvent.off(window, 'message', this._postMessageListener, this);
	},

	_setWopiProps: function(wopiInfo) {
		// Store postmessageorigin property, if it exists
		if (!!wopiInfo['PostMessageOrigin']) {
			this.PostMessageOrigin = wopiInfo['PostMessageOrigin'];
		}

		this.HidePrintOption = !!wopiInfo['HidePrintOption'];
		this.HideSaveOption = !!wopiInfo['HideSaveOption'];
		this.HideExportOption = !!wopiInfo['HideExportOption'];
		this.DisablePrint = !!wopiInfo['DisablePrint'];
		this.DisableExport = !!wopiInfo['DisableExport'];
		this.DisableCopy = !!wopiInfo['DisableCopy'];

		this._map.fire('postMessage', {msgId: 'App_LoadingStatus', args: {Status: 'Frame_Ready'}});
	},

	resetAppLoaded: function() {
		this._appLoaded = false;
		for (var key in this._appLoadedConditions) {
			this._appLoadedConditions[key] = false;
		}
	},

	_postLoaded: function(e) {
		if (this._appLoaded) {
			return;
		}

		if (e.type === 'doclayerinit') {
			this.DocumentLoadedTime = Date.now();
		}
		this._appLoadedConditions[e.type] = true;
		for (var key in this._appLoadedConditions) {
			if (!this._appLoadedConditions[key])
				return;
		}

		this._appLoaded = true;
		this._map.fire('postMessage', {msgId: 'App_LoadingStatus', args: {Status: 'Document_Loaded', DocumentLoadedTime: this.DocumentLoadedTime}});
	},

	_postMessageListener: function(e) {
		if (!window.WOPIPostmessageReady) {
			return;
		}

		var msg = JSON.parse(e.data);
		if (msg.MessageId === 'Insert_Button') {
			if (msg.Values) {
				if (msg.Values.id && !w2ui['toolbar-up'].get(msg.Values.id)
				    && msg.Values.imgurl) {
					if (this._map._permission === 'edit') {
						// add the css rule for the image
						$('html > head > style').append('.w2ui-icon.' + msg.Values.id + '{background: url(' + msg.Values.imgurl + ')}');

						// add the item to the toolbar
						w2ui['toolbar-up'].insert('save', [
							{
								type: 'button',
								id: msg.Values.id,
								img: msg.Values.id,
								hint: _(msg.Values.hint), /* "Try" to localize ! */
								postmessage: true /* Notify the host back when button is clicked */
							}
						]);
						if (msg.Values.mobile)
						{
							// Add to our list of items to preserve when in mobile mode
							// FIXME: Wrap the toolbar in a class so that we don't make use
							// global variables and functions like this
							var idx = toolbarUpMobileItems.indexOf('save');
							toolbarUpMobileItems.splice(idx, 0, msg.Values.id);
						}
						resizeToolbar();
					}
					else if (this._map._permission === 'readonly') {
						// Just add a menu entry for it
						this._map.fire('addmenu', {id: msg.Values.id, label: msg.Values.hint});
					}
				}
			}
		}
		else if (msg.MessageId === 'Set_Settings') {
			if (msg.Values) {
				var alwaysActive = msg.Values.AlwaysActive;
				this._map.options.alwaysActive = !!alwaysActive;
			}
		}
		else if (msg.MessageId === 'Get_Views') {
			var getMembersRespVal = [];
			for (var viewInfoIdx in this._map._viewInfo) {
				getMembersRespVal.push({
					ViewId: viewInfoIdx,
					UserName: this._map._viewInfo[viewInfoIdx].username,
					UserId: this._map._viewInfo[viewInfoIdx].userid,
					UserExtraInfo: this._map._viewInfo[viewInfoIdx].userextrainfo,
					Color: this._map._viewInfo[viewInfoIdx].color
				});
			}

			this._postMessage({msgId: 'Get_Views_Resp', args: getMembersRespVal});
		}
		else if (msg.MessageId === 'Close_Session') {
			this._map._socket.sendMessage('closedocument');
		}
		else if (msg.MessageId === 'Action_Save') {
			var dontTerminateEdit = msg.Values && msg.Values['DontTerminateEdit'];
			var dontSaveIfUnmodified = msg.Values && msg.Values['DontSaveIfUnmodified'];
			this._notifySave = msg.Values && msg.Values['Notify'];

			this._map.save(dontTerminateEdit, dontSaveIfUnmodified);
		}
		else if (msg.MessageId === 'Action_Print') {
			this._map.print();
		}
		else if (msg.MessageId === 'Action_Export') {
			if (msg.Values) {
				var format = msg.Values.Format;
				var filename = title.substr(0, title.lastIndexOf('.')) || title;
				filename = filename === '' ? 'document' : filename;
				this._map.downloadAs(filename + '.' + format, format);
			}
		}
		else if (msg.MessageId === 'Action_ShowBusy') {
			if (msg.Values && msg.Values.Label) {
				this._map.fire('showbusy', {label: msg.Values.Label});
			}
		}
		else if (msg.MessageId === 'Action_HideBusy') {
			this._map.fire('hidebusy');
		}
		else if (msg.MessageId === 'Get_Export_Formats') {
			var exportFormatsResp = [];
			for (var idx in this._map._docLayer._exportFormats) {
				exportFormatsResp.push({
					Label: this._map._docLayer._exportFormats[idx].label,
					Format: this._map._docLayer._exportFormats[idx].format
				});
			}

			this._postMessage({msgId: 'Get_Export_Formats_Resp', args: exportFormatsResp});
		}
	},

	_postMessage: function(e) {
		if (!this.enabled) { return; }

		var msgId = e.msgId;
		var values = e.args || {};
		if (!!this.PostMessageOrigin && window.parent !== window.self) {
			// Filter out unwanted save request response
			if (msgId === 'Action_Save_Resp') {
				if (!this._notifySave)
					return;

				this._notifySave = false;
			}

			var msg = {
				'MessageId': msgId,
				'SendTime': Date.now(),
				'Values': values
			};

			window.parent.postMessage(JSON.stringify(msg), this.PostMessageOrigin);
		}
	}
});

// This handler would only get 'enabled' by map if map.options.wopi = true
L.Map.addInitHook('addHandler', 'wopi', L.Map.WOPI);


/*
 * L.Handler.MarkerDrag is used internally by L.Marker to make the markers draggable.
 */

L.Handler.MarkerDrag = L.Handler.extend({
	initialize: function (marker) {
		this._marker = marker;
	},

	addHooks: function () {
		var icon = this._marker._icon;

		if (!this._draggable) {
			this._draggable = new L.Draggable(icon, icon, true);
		}

		this._draggable.on({
			dragstart: this._onDragStart,
			drag: this._onDrag,
			dragend: this._onDragEnd
		}, this).enable();

		L.DomUtil.addClass(icon, 'leaflet-marker-draggable');
	},

	removeHooks: function () {
		this._draggable.off({
			dragstart: this._onDragStart,
			drag: this._onDrag,
			dragend: this._onDragEnd
		}, this).disable();

		if (this._marker._icon) {
			L.DomUtil.removeClass(this._marker._icon, 'leaflet-marker-draggable');
		}
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	_onDragStart: function () {
		this._marker
		    .closePopup()
		    .fire('movestart')
		    .fire('dragstart');
	},

	_onDrag: function (e) {
		var marker = this._marker,
		    shadow = marker._shadow,
		    iconPos = L.DomUtil.getPosition(marker._icon),
		    latlng = marker._map.layerPointToLatLng(iconPos);

		// update shadow position
		if (shadow) {
			L.DomUtil.setPosition(shadow, iconPos);
		}

		marker._latlng = latlng;
		e.latlng = latlng;

		marker
		    .fire('move', e)
		    .fire('drag', e);
	},

	_onDragEnd: function (e) {
		this._marker
		    .fire('moveend')
		    .fire('dragend', e);
	}
});


/*
 * L.Control is a base class for implementing map controls. Handles positioning.
 * All other controls extend from this class.
 */

L.Control = L.Class.extend({
	options: {
		position: 'topright'
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	getPosition: function () {
		return this.options.position;
	},

	setPosition: function (position) {
		var map = this._map;

		if (map) {
			map.removeControl(this);
		}

		this.options.position = position;

		if (map) {
			map.addControl(this);
		}

		return this;
	},

	getContainer: function () {
		return this._container;
	},

	addTo: function (map) {
		this.remove();
		this._map = map;

		var container = this._container = this.onAdd(map),
		    pos = this.getPosition(),
		    corner = map._controlCorners[pos];

		L.DomUtil.addClass(container, 'leaflet-control');

		if (pos.indexOf('bottom') !== -1) {
			corner.insertBefore(container, corner.firstChild);
		} else {
			corner.appendChild(container);
		}

		return this;
	},

	remove: function () {
		if (!this._map) {
			return this;
		}

		L.DomUtil.remove(this._container);

		if (this.onRemove) {
			this.onRemove(this._map);
		}

		this._map = null;

		return this;
	},

	isVisible: function () {
		if (!this._map) {
			return false;
		}
		var corner = this._map._controlCorners[this.options.position];
		return corner.hasChildNodes();
	},

	_refocusOnMap: function () {
		this._map.focus();
	}
});

L.control = function (options) {
	return new L.Control(options);
};


// adds control-related methods to L.Map

L.Map.include({
	addControl: function (control) {
		control._map = this;
		var controlDiv = control.onAdd(this);
		var controlContainer = L.DomUtil.get(this.options.toolbarContainer);
		if (!this._controls) {
			this._controls = [];
		}

		if (controlContainer && controlDiv) {
			controlContainer.appendChild(controlDiv);
			this._controls.push({div: controlDiv});
		}
		return this;
	},

	removeControl: function (control) {
		control.remove();
		return this;
	},

	removeControls: function () {
		if (this._controls) {
			this._controls.forEach(function (control) {
				L.DomUtil.remove(control.div);
			});
		}
	},

	_initControlPos: function () {
		var corners = this._controlCorners = {},
		    l = 'leaflet-',
		    container = this._controlContainer =
		            L.DomUtil.create('div', l + 'control-container', this._container);

		function createCorner(vSide, hSide) {
			var className = l + vSide + ' ' + l + hSide;

			corners[vSide + hSide] = L.DomUtil.create('div', className, container);
		}

		createCorner('top', 'left');
		createCorner('top', 'middle');
		createCorner('top', 'right');
		createCorner('bottom', 'left');
		createCorner('bottom', 'right');
	},

	_clearControlPos: function () {
		L.DomUtil.remove(this._controlContainer);
	}
});


/*
 * L.Control.PartsPreview
 */

/* global $ map */
L.Control.PartsPreview = L.Control.extend({
	options: {
		autoUpdate: true
	},

	onAdd: function (map) {
		this._previewInitialized = false;
		this._previewTiles = [];
		this._partsPreviewCont = L.DomUtil.get('slide-sorter');

		map.on('updateparts', this._updateDisabled, this);
		map.on('updatepart', this._updatePart, this);
		map.on('tilepreview', this._updatePreview, this);
		map.on('insertpage', this._insertPreview, this);
		map.on('deletepage', this._deletePreview, this);
	},

	_updateDisabled: function (e) {
		var parts = e.parts;
		var selectedPart = e.selectedPart;
		var docType = e.docType;
		if (docType === 'text') {
			return;
		}

		if (docType === 'presentation' || docType === 'drawing') {
			if (!this._previewInitialized)
			{
				// make room for the preview
				var docContainer = this._map.options.documentContainer;
				L.DomUtil.addClass(docContainer, 'parts-preview-document');
				setTimeout(L.bind(function () {
					this._map.invalidateSize();
					$('.scroll-container').mCustomScrollbar('update');
				}, this), 500);
				for (var i = 0; i < parts; i++) {
					this._previewTiles.push(this._createPreview(i, e.partNames[i]));
				}
				L.DomUtil.addClass(this._previewTiles[selectedPart], 'preview-img-selected');
				this._previewInitialized = true;
			}
			else
			{
				if (e.partNames !== undefined) {
					this._syncPreviews(e);
				}

				// change the border style of the selected preview.
				for (var j = 0; j < parts; j++) {
					L.DomUtil.removeClass(this._previewTiles[j], 'preview-img-selected');
				}
				L.DomUtil.addClass(this._previewTiles[selectedPart], 'preview-img-selected');
			}
		}
	},

	_createPreview: function (i, hashCode) {
		var frame = L.DomUtil.create('div', 'preview-frame', this._partsPreviewCont);
		L.DomUtil.create('span', 'preview-helper', frame);
		var imgClassName = 'preview-img';
		var img = L.DomUtil.create('img', imgClassName, frame);
		img.hash = hashCode;
		img.src = L.Icon.Default.imagePath + '/preview_placeholder.png';
		L.DomEvent
			.on(img, 'click', L.DomEvent.stopPropagation)
			.on(img, 'click', L.DomEvent.stop)
			.on(img, 'click', this._setPart, this)
			.on(img, 'click', this._refocusOnMap, this);
		this._map.getPreview(i, i, 180, 180, {autoUpdate: this.options.autoUpdate});

		return img;
	},

	_setPart: function (e) {
		var part = $('#slide-sorter .mCSB_container .preview-frame').index(e.target.parentNode);
		if (part !== null) {
			this._map.setPart(parseInt(part));
		}
	},

	_updatePart: function (e) {
		if (e.docType === 'presentation' && e.part >= 0) {
			this._map.getPreview(e.part, e.part, 180, 180, {autoUpdate: this.options.autoUpdate});
		}
	},

	_syncPreviews: function (e) {
		var it = 0;
		var parts = e.parts;
		if (parts !== this._previewTiles.length) {
			if (Math.abs(parts - this._previewTiles.length) === 1) {
				if (parts > this._previewTiles.length) {
					for (it = 0; it < parts; it++) {
						if (it === this._previewTiles.length) {
							this._insertPreview({selectedPart: it - 1, hashCode: e.partNames[it]});
							break;
						}
						if (this._previewTiles[it].hash !== e.partNames[it]) {
							this._insertPreview({selectedPart: it, hashCode: e.partNames[it]});
							break;
						}
					}
				}
				else {
					for (it = 0; it < this._previewTiles.length; it++) {
						if (it === e.partNames.length ||
						    this._previewTiles[it].hash !== e.partNames[it]) {
							this._deletePreview({selectedPart: it});
							break;
						}
					}
				}
			}
			else {
				// sync all, should never happen
				while (this._previewTiles.length < e.partNames.length) {
					this._insertPreview({selectedPart: this._previewTiles.length - 1,
							     hashCode: e.partNames[this._previewTiles.length]});
				}

				while (this._previewTiles.length > e.partNames.length) {
					this._deletePreview({selectedPart: this._previewTiles.length - 1});
				}

				for (it = 0; it < e.partNames.length; it++) {
					this._previewTiles[it].hash = e.partNames[it];
					this._previewTiles[it].src = L.Icon.Default.imagePath + '/preview_placeholder.png';
					this._map.getPreview(it, it, 180, 180, {autoUpdate: this.options.autoUpdate});
				}
			}
		}
		else {
			// update hash code when user click insert slide.
			for (it = 0; it < parts; it++) {
				if (this._previewTiles[it].hash !== e.partNames[it]) {
					this._previewTiles[it].hash = e.partNames[it];
				}
			}
		}
	},

	_updatePreview: function (e) {
		if (this._map.getDocType() === 'presentation' || this._map.getDocType() === 'drawing') {
			// the scrollbar has to be re-initialized here else it doesn't work
			// probably a bug from the scrollbar
			this._previewTiles[e.id].onload = function () {
				$('#slide-sorter').mCustomScrollbar({
					axis: 'y',
					theme: 'dark-thick',
					scrollInertia: 0,
					alwaysShowScrollbar: 1});
			};

			this._previewTiles[e.id].src = e.tile;
		}
	},

	_updatePreviewIds: function () {
		$('#slide-sorter').mCustomScrollbar('update');
	},

	_insertPreview: function (e) {
		if (this._map.getDocType() === 'presentation') {
			var newIndex = e.selectedPart + 1;
			var newPreview = this._createPreview(newIndex, (e.hashCode === undefined ? null : e.hashCode));

			// insert newPreview to newIndex position
			this._previewTiles.splice(newIndex, 0, newPreview);

			var selectedFrame = this._previewTiles[e.selectedPart].parentNode;
			var newFrame = newPreview.parentNode;

			// insert after selectedFrame
			selectedFrame.parentNode.insertBefore(newFrame, selectedFrame.nextSibling);
			this._updatePreviewIds();
		}
	},

	_deletePreview: function (e) {
		if (this._map.getDocType() === 'presentation') {
			var selectedFrame = this._previewTiles[e.selectedPart].parentNode;
			L.DomUtil.remove(selectedFrame);

			this._previewTiles.splice(e.selectedPart, 1);
			this._updatePreviewIds();
		}
	}
});

L.control.partsPreview = function (options) {
	return new L.Control.PartsPreview(options);
};


/*
* Control.Header
*/

L.Control.Header = L.Control.extend({
	options: {
		cursor: 'col-resize'
	},

	initialize: function () {
		this._clicks = 0;
		this._current = -1;
		this._selection = {start: -1, end: -1};
	},

	mouseInit: function (element) {
		L.DomEvent.on(element, 'mousedown', this._onMouseDown, this);
	},

	select: function (item) {
		if (item && !L.DomUtil.hasClass(item, 'spreadsheet-header-selected')) {
			L.DomUtil.addClass(item, 'spreadsheet-header-selected');
		}
	},

	unselect: function (item) {
		if (item && L.DomUtil.hasClass(item, 'spreadsheet-header-selected')) {
			L.DomUtil.removeClass(item, 'spreadsheet-header-selected');
		}
	},

	clearSelection: function (element) {
		if (this._selection.start === -1 && this._selection.end === -1)
			return;
		var childs = element.children;
		var start = (this._selection.start === -1) ? 0 : this._selection.start;
		var end = this._selection.end + 1;
		for (var iterator = start; iterator < end; iterator++) {
			this.unselect(childs[iterator]);
		}

		this._selection.start = this._selection.end = -1;
		// after clearing selection, we need to select the header entry for the current cursor position,
		// since we can't be sure that the selection clearing is due to click on a cell
		// different from the one where the cursor is already placed
		this.select(childs[this._current]);
	},

	updateSelection: function(element, start, end) {
		var childs = element.children;
		var x0 = 0, x1 = 0;
		var itStart = -1, itEnd = -1;
		var selected = false;
		var iterator = 0;
		for (var len = childs.length; iterator < len; iterator++) {
			x0 = (iterator > 0 ? childs[iterator - 1].size : 0);
			x1 = childs[iterator].size;
			// 'start < x1' not '<=' or we get highlighted also the `start-row - 1` and `start-column - 1` headers
			if (x0 <= start && start < x1) {
				selected = true;
				itStart = iterator;
			}
			if (selected) {
				this.select(childs[iterator]);
			}
			if (x0 <= end && end <= x1) {
				itEnd = iterator;
				break;
			}
		}

		// if end is greater than the last fetched header position set itEnd to the max possible value
		// without this hack selecting a whole row and then a whole column (or viceversa) leads to an incorrect selection
		if (itStart !== -1 && itEnd === -1) {
			itEnd = childs.length - 1;
		}

		// we need to unselect the row (column) header entry for the current cell cursor position
		// since the selection could be due to selecting a whole row (column), so the selection
		// does not start by clicking on a cell
		if (this._current !== -1 && itStart !== -1 && itEnd !== -1) {
			if (this._current < itStart || this._current > itEnd) {
				this.unselect(childs[this._current]);
			}
		}
		if (this._selection.start !== -1 && itStart !== -1 && itStart > this._selection.start) {
			for (iterator = this._selection.start; iterator < itStart; iterator++) {
				this.unselect(childs[iterator]);
			}
		}
		if (this._selection.end !== -1 && itEnd !== -1 && itEnd < this._selection.end) {
			for (iterator = itEnd + 1; iterator <= this._selection.end; iterator++) {
				this.unselect(childs[iterator]);
			}
		}
		this._selection.start = itStart;
		this._selection.end = itEnd;
	},

	updateCurrent: function (element, start) {
		var childs = element.children;
		if (start < 0) {
			this.unselect(childs[this._current]);
			this._current = -1;
			return;
		}

		var x0 = 0, x1 = 0;
		for (var iterator = 0, len = childs.length; iterator < len; iterator++) {
			x0 = (iterator > 0 ? childs[iterator - 1].size : 0);
			x1 = childs[iterator].size;
			if (x0 <= start && start <= x1) {
				// when a whole row (column) is selected the cell cursor is moved to the first column (row)
				// but this action should not cause to select/unselect anything, on the contrary we end up
				// with all column (row) header entries selected but the one where the cell cursor was
				// previously placed
				if (this._selection.start === -1 && this._selection.end === -1) {
					this.unselect(childs[this._current]);
					this.select(childs[iterator]);
				}
				this._current = iterator;
				break;
			}
		}
	},

	_onMouseDown: function (e) {
		var target = e.target || e.srcElement;

		if (!target || this._dragging) {
			return false;
		}

		L.DomUtil.disableImageDrag();
		L.DomUtil.disableTextSelection();

		L.DomEvent.stopPropagation(e);
		L.DomEvent.on(document, 'mousemove', this._onMouseMove, this);
		L.DomEvent.on(document, 'mouseup', this._onMouseUp, this);

		var rect = target.parentNode.getBoundingClientRect();
		this._start = new L.Point(rect.left, rect.top);
		this._offset = new L.Point(rect.right - e.clientX, rect.bottom - e.clientY);
		this._item = target;

		this.onDragStart(this.item, this._start, this._offset, e);
	},

	_onMouseMove: function (e) {
		this._dragging = true;
		L.DomEvent.preventDefault(e);

		var target = e.target || e.srcElement;
		if (target.style.cursor !== this.options.cursor &&
		   (L.DomUtil.hasClass(target, 'spreadsheet-header-column-text') ||
		    L.DomUtil.hasClass(target, 'spreadsheet-header-row-text'))) {
			target.style.cursor = this.options.cursor;
		}

		this.onDragMove(this._item, this._start, this._offset, e);
	},

	_onMouseUp: function (e) {
		L.DomEvent.off(document, 'mousemove', this._onMouseMove, this);
		L.DomEvent.off(document, 'mouseup', this._onMouseUp, this);

		L.DomUtil.enableImageDrag();
		L.DomUtil.enableTextSelection();

		if (this._dragging) {
			this.onDragEnd(this._item, this._start, this._offset, e);
			this._clicks = 0;
		} else {
			this.onDragClick(this._item, ++this._clicks, e);
			setTimeout(L.bind(this.initialize, this), 400);
		}

		this._item = this._start = this._offset = null;
		this._dragging = false;
	},

	onDragStart: function () {},
	onDragMove: function () {},
	onDragEnd: function () {},
	onDragClick: function () {}
});


/*
* Control.ColumnHeader
*/

/* global $ _ */
L.Control.ColumnHeader = L.Control.Header.extend({
	options: {
		cursor: 'col-resize'
	},

	onAdd: function (map) {
		map.on('updatepermission', this._onUpdatePermission, this);
		this._initialized = false;
	},

	_initialize: function () {
		this._initialized = true;
		this._map.on('scrolloffset', this.offsetScrollPosition, this);
		this._map.on('updatescrolloffset', this.setScrollPosition, this);
		this._map.on('viewrowcolumnheaders', this.viewRowColumnHeaders, this);
		this._map.on('updateselectionheader', this._onUpdateSelection, this);
		this._map.on('clearselectionheader', this._onClearSelection, this);
		this._map.on('updatecurrentheader', this._onUpdateCurrentColumn, this);
		var rowColumnFrame = L.DomUtil.get('spreadsheet-row-column-frame');
		var cornerHeader = L.DomUtil.create('div', 'spreadsheet-header-corner', rowColumnFrame);
		L.DomEvent.on(cornerHeader, 'contextmenu', L.DomEvent.preventDefault);
		L.DomEvent.addListener(cornerHeader, 'click', this._onCornerHeaderClick, this);
		var headersContainer = L.DomUtil.create('div', 'spreadsheet-header-columns-container', rowColumnFrame);
		this._columns = L.DomUtil.create('div', 'spreadsheet-header-columns', headersContainer);

		this._leftOffset = 0;
		this._position = 0;

		var colHeaderObj = this;
		$.contextMenu({
			selector: '.spreadsheet-header-column-text',
			className: 'loleaflet-font',
			items: {
				'insertcolbefore': {
					name: _('Insert column before'),
					callback: function(key, options) {
						var colAlpha = options.$trigger.attr('rel').split('spreadsheet-column-')[1];
						colHeaderObj.insertColumn.call(colHeaderObj, colAlpha);
					}
				},
				'deleteselectedcol': {
					name: _('Delete column'),
					callback: function(key, options) {
						var colAlpha = options.$trigger.attr('rel').split('spreadsheet-column-')[1];
						colHeaderObj.deleteColumn.call(colHeaderObj, colAlpha);
					}
				},
				'optimalwidth': {
					name: _('Optimal Width') + '...',
					callback: function(key, options) {
						var colAlpha = options.$trigger.attr('rel').split('spreadsheet-column-')[1];
						colHeaderObj.optimalWidth.call(colHeaderObj, colAlpha);
					}
				},
				'hideColumn': {
					name: _('Hide Columns'),
					callback: function(key, options) {
						var colAlpha = options.$trigger.attr('rel').split('spreadsheet-column-')[1];
						colHeaderObj.hideColumn.call(colHeaderObj, colAlpha);
					}
				},
				'showColumn': {
					name: _('Show Columns'),
					callback: function(key, options) {
						var colAlpha = options.$trigger.attr('rel').split('spreadsheet-column-')[1];
						colHeaderObj.showColumn.call(colHeaderObj, colAlpha);
					}
				}
			},
			zIndex: 10
		});
	},

	optimalWidth: function(colAlpha) {
		if (!this._dialog) {
			this._dialog = L.control.metricInput(this._onDialogResult, this,
							     this._map._docLayer.twipsToHMM(this._map._docLayer.STD_EXTRA_WIDTH),
							     {title: _('Optimal Column Width')});
		}
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(colAlpha, 0);
		}
		this._dialog.addTo(this._map);
		this._map.enable(false);
		this._dialog.show();
	},

	insertColumn: function(colAlpha) {
		// First select the corresponding column because
		// .uno:InsertColumn doesn't accept any column number
		// as argument and just inserts before the selected column
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(colAlpha, 0);
		}
		this._map.sendUnoCommand('.uno:InsertColumns');
		this._updateColumnHeader();
	},

	deleteColumn: function(colAlpha) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(colAlpha, 0);
		}
		this._map.sendUnoCommand('.uno:DeleteColumns');
		this._updateColumnHeader();
	},

	hideColumn: function(colAlpha) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(colAlpha, 0);
		}
		this._map.sendUnoCommand('.uno:HideColumn');
		this._updateColumnHeader();
	},

	showColumn: function(colAlpha) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(colAlpha, 0);
		}
		this._map.sendUnoCommand('.uno:ShowColumn');
		this._updateColumnHeader();
	},

	setScrollPosition: function (e) {
		var position = -e.x;
		this._position = Math.min(0, position);
	},

	offsetScrollPosition: function (e) {
		var offset = e.x;
		this._position = Math.min(0, this._position- offset);
	},

	_onClearSelection: function (e) {
		this.clearSelection(this._columns);
	},

	_onUpdateSelection: function (e) {
		this.updateSelection(this._columns, e.start.x, e.end.x);
	},

	_onUpdateCurrentColumn: function (e) {
		this.updateCurrent(this._columns, e.x);
	},

	_updateColumnHeader: function () {
		this._map.fire('updaterowcolumnheaders', {x: this._map._getTopLeftPoint().x, y: 0, offset: {x: undefined, y: 0}});
	},

	viewRowColumnHeaders: function (e) {
		if (e.data.columns && e.data.columns.length > 0) {
			this.fillColumns(e.data.columns, e.converter, e.context);
			L.DomUtil.setStyle(this._columns, 'left', (this._position + this._leftOffset) + 'px');
		}
	},

	fillColumns: function (columns, converter, context) {
		var iterator, twip, width, column, text, resize;

		L.DomUtil.empty(this._columns);
		var leftOffset = new L.Point(columns[0].size, columns[0].size);
		// column[0] is a dummy column header whose text attribute is set to the column index
		var leftmostCol = parseInt(columns[0].text);
		this._leftOffset = Math.round(converter.call(context, leftOffset).x);
		for (iterator = 1; iterator < columns.length; iterator++) {
			width = columns[iterator].size - columns[iterator - 1].size;
			twip = new L.Point(width, width);
			column = L.DomUtil.create('div', 'spreadsheet-header-column', this._columns);
			text = L.DomUtil.create('div', 'spreadsheet-header-column-text', column);
			resize = L.DomUtil.create('div', 'spreadsheet-header-column-resize', column);
			L.DomEvent.on(resize, 'contextmenu', L.DomEvent.preventDefault);
			column.size = columns[iterator].size;
			var content = columns[iterator].text;
			text.setAttribute('rel', 'spreadsheet-column-' + content); // for easy addressing
			text.innerHTML = content;
			width = Math.round(converter.call(context, twip).x) - 1;
			if (width <= 0) {
				L.DomUtil.setStyle(column, 'display', 'none');
			} else if (width < 10) {
				text.column = iterator + leftmostCol;
				text.width = width;
				L.DomUtil.setStyle(column, 'width', width + 'px');
				L.DomUtil.setStyle(column, 'cursor', 'col-resize');
				L.DomUtil.setStyle(text, 'cursor', 'col-resize');
				L.DomUtil.setStyle(resize, 'display', 'none');
				this.mouseInit(text);
			} else {
				resize.column = iterator + leftmostCol;
				resize.width = width;
				L.DomUtil.setStyle(column, 'width', width + 'px');
				L.DomUtil.setStyle(text, 'width', width - 3 + 'px');
				L.DomUtil.setStyle(resize, 'width', '3px');
				this.mouseInit(resize);
			}
			L.DomEvent.addListener(text, 'click', this._onColumnHeaderClick, this);
		}

		if ($('.spreadsheet-header-column-text').length > 0) {
			$('.spreadsheet-header-column-text').contextMenu(this._map._permission === 'edit');
		}
	},

	_colAlphaToNumber: function(alpha) {
		var res = 0;
		var offset = 'A'.charCodeAt();
		for (var i = 0; i < alpha.length; i++) {
			var chr = alpha[alpha.length - i - 1];
			res += (chr.charCodeAt() - offset + 1) * Math.pow(26, i);
		}

		return res;
	},

	_selectColumn: function(colAlpha, modifier) {
		var colNumber = this._colAlphaToNumber(colAlpha);

		var command = {
			Col: {
				type: 'unsigned short',
				value: parseInt(colNumber - 1)
			},
			Modifier: {
				type: 'unsigned short',
				value: modifier
			}
		};

		this._map.sendUnoCommand('.uno:SelectColumn ', command);
	},

	_onColumnHeaderClick: function (e) {
		var colAlpha = e.target.getAttribute('rel').split('spreadsheet-column-')[1];

		var modifier = 0;
		if (e.shiftKey) {
			modifier += this._map.keyboard.keyModifier.shift;
		}
		if (e.ctrlKey) {
			modifier += this._map.keyboard.keyModifier.ctrl;
		}

		this._selectColumn(colAlpha, modifier);
	},

	_onCornerHeaderClick: function() {
		this._map.sendUnoCommand('.uno:SelectAll');
	},

	_onDialogResult: function (e) {
		if (e.type === 'submit' && !isNaN(e.value)) {
			var extra = {
				aExtraWidth: {
					type: 'unsigned short',
					value: e.value
				}
			};

			this._map.sendUnoCommand('.uno:SetOptimalColumnWidth', extra);
		}

		this._map.enable(true);
	},

	_getVertLatLng: function (start, offset, e) {
		var limit = this._map.mouseEventToContainerPoint({clientX: start.x, clientY: start.y});
		var drag = this._map.mouseEventToContainerPoint(e);
		return [
			this._map.containerPointToLatLng(new L.Point(Math.max(limit.x, drag.x + offset.x), 0)),
			this._map.containerPointToLatLng(new L.Point(Math.max(limit.x, drag.x + offset.x), this._map.getSize().y))
		];
	},

	onDragStart: function (item, start, offset, e) {
		if (!this._vertLine) {
			this._vertLine = L.polyline(this._getVertLatLng(start, offset, e), {color: 'darkblue', weight: 1});
		}
		else {
			this._vertLine.setLatLngs(this._getVertLatLng(start, offset, e));
		}

		this._map.addLayer(this._vertLine);
	},

	onDragMove: function (item, start, offset, e) {
		if (this._vertLine) {
			this._vertLine.setLatLngs(this._getVertLatLng(start, offset, e));
		}
	},

	onDragEnd: function (item, start, offset, e) {
		var end = new L.Point(e.clientX + offset.x, e.clientY);
		var distance = this._map._docLayer._pixelsToTwips(end.subtract(start));

		if (item.width != distance.x) {
			var command = {
				Column: {
					type: 'unsigned short',
					value: item.parentNode && item.parentNode.nextSibling &&
					       L.DomUtil.getStyle(item.parentNode.nextSibling, 'display') === 'none' ? item.column + 1 : item.column
				},
				Width: {
					type: 'unsigned short',
					value: Math.max(distance.x, 0)
				}
			};

			this._map.sendUnoCommand('.uno:ColumnWidth', command);
			this._updateColumnHeader();
		}

		this._map.removeLayer(this._vertLine);
	},

	onDragClick: function (item, clicks, e) {
		this._map.removeLayer(this._vertLine);

		if (clicks === 2) {
			var command = {
				Col: {
					type: 'unsigned short',
					value: item.column - 1
				},
				Modifier: {
					type: 'unsigned short',
					value: 0
				}
			};

			this._map.sendUnoCommand('.uno:SelectColumn ', command);
			this._map.sendUnoCommand('.uno:SetOptimalColumnWidthDirect');
		}
	},

	_onUpdatePermission: function (e) {
		if (this._map.getDocType() !== 'spreadsheet') {
			return;
		}

		if (!this._initialized) {
			this._initialize();
		}
		if ($('.spreadsheet-header-column-text').length > 0) {
			$('.spreadsheet-header-column-text').contextMenu(e.perm === 'edit');
		}
	}
});

L.control.columnHeader = function (options) {
	return new L.Control.ColumnHeader(options);
};


/*
 * L.Control.RowHeader
*/

/* global $ _ */
L.Control.RowHeader = L.Control.Header.extend({
	options: {
		cursor: 'row-resize'
	},

	onAdd: function (map) {
		map.on('updatepermission', this._onUpdatePermission, this);
		this._initialized = false;
	},

	_initialize: function () {
		this._initialized = true;
		this._map.on('scrolloffset', this.offsetScrollPosition, this);
		this._map.on('updatescrolloffset', this.setScrollPosition, this);
		this._map.on('viewrowcolumnheaders', this.viewRowColumnHeaders, this);
		this._map.on('updateselectionheader', this._onUpdateSelection, this);
		this._map.on('clearselectionheader', this._onClearSelection, this);
		this._map.on('updatecurrentheader', this._onUpdateCurrentRow, this);
		var rowColumnFrame = L.DomUtil.get('spreadsheet-row-column-frame');
		var headersContainer = L.DomUtil.create('div', 'spreadsheet-header-rows-container', rowColumnFrame);
		this._rows = L.DomUtil.create('div', 'spreadsheet-header-rows', headersContainer);

		this._topOffset = 0;
		this._position = 0;

		var rowHeaderObj = this;
		$.contextMenu({
			selector: '.spreadsheet-header-row-text',
			className: 'loleaflet-font',
			items: {
				'insertrowabove': {
					name: _('Insert row above'),
					callback: function(key, options) {
						var row = parseInt(options.$trigger.attr('rel').split('spreadsheet-row-')[1]);
						rowHeaderObj.insertRow.call(rowHeaderObj, row);
					}
				},
				'deleteselectedrow': {
					name: _('Delete row'),
					callback: function(key, options) {
						var row = parseInt(options.$trigger.attr('rel').split('spreadsheet-row-')[1]);
						rowHeaderObj.deleteRow.call(rowHeaderObj, row);
					}
				},
				'optimalheight': {
					name: _('Optimal Height') + '...',
					callback: function(key, options) {
						var row = parseInt(options.$trigger.attr('rel').split('spreadsheet-row-')[1]);
						rowHeaderObj.optimalHeight.call(rowHeaderObj, row);
					}
				},
				'hideRow': {
					name: _('Hide Rows'),
					callback: function(key, options) {
						var row = parseInt(options.$trigger.attr('rel').split('spreadsheet-row-')[1]);
						rowHeaderObj.hideRow.call(rowHeaderObj, row);
					}
				},
				'showRow': {
					name: _('Show Rows'),
					callback: function(key, options) {
						var row = parseInt(options.$trigger.attr('rel').split('spreadsheet-row-')[1]);
						rowHeaderObj.showRow.call(rowHeaderObj, row);
					}
				}
			},
			zIndex: 10
		});
	},

	optimalHeight: function(row) {
		if (!this._dialog) {
			this._dialog = L.control.metricInput(this._onDialogResult, this, 0, {title: _('Optimal Row Height')});
		}
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(row, 0);
		}
		this._dialog.addTo(this._map);
		this._map.enable(false);
		this._dialog.show();
	},

	insertRow: function(row) {
		// First select the corresponding row because
		// .uno:InsertRows doesn't accept any row number
		// as argument and just inserts before the selected row
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(row, 0);
		}
		this._map.sendUnoCommand('.uno:InsertRows');
	},

	deleteRow: function(row) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(row, 0);
		}
		this._map.sendUnoCommand('.uno:DeleteRows');
	},

	hideRow: function(row) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(row, 0);
		}
		this._map.sendUnoCommand('.uno:HideRow');
	},

	showRow: function(row) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(row, 0);
		}
		this._map.sendUnoCommand('.uno:ShowRow');
	},

	setScrollPosition: function (e) {
		var position = -e.y;
		this._position = Math.min(0, position);
	},

	offsetScrollPosition: function (e) {
		var offset = e.y;
		this._position = Math.min(0, this._position - offset);
	},

	_onClearSelection: function (e) {
		this.clearSelection(this._rows);
	},

	_onUpdateSelection: function (e) {
		this.updateSelection(this._rows, e.start.y, e.end.y);
	},

	_onUpdateCurrentRow: function (e) {
		this.updateCurrent(this._rows, e.y);
	},

	_updateRowHeader: function () {
		this._map.fire('updaterowcolumnheaders', {x: 0, y: this._map._getTopLeftPoint().y, offset: {x: 0, y: undefined}});
	},

	viewRowColumnHeaders: function (e) {
		if (e.data.rows && e.data.rows.length) {
			this.fillRows(e.data.rows, e.converter, e.context);
			L.DomUtil.setStyle(this._rows, 'top', (this._position + this._topOffset) + 'px');
		}
	},

	fillRows: function (rows, converter, context) {
		var iterator, twip, height, row, text, resize;

		L.DomUtil.empty(this._rows);
		var topOffset = new L.Point(rows[0].size, rows[0].size);
		var topRow = parseInt(rows[0].text);
		this._topOffset = Math.round(converter.call(context, topOffset).y);
		for (iterator = 1; iterator < rows.length; iterator++) {
			height = rows[iterator].size - rows[iterator - 1].size;
			twip = new L.Point(height, height);
			row = L.DomUtil.create('div', 'spreadsheet-header-row', this._rows);
			text = L.DomUtil.create('div', 'spreadsheet-header-row-text', row);
			resize = L.DomUtil.create('div', 'spreadsheet-header-row-resize', row);
			L.DomEvent.on(resize, 'contextmenu', L.DomEvent.preventDefault);
			row.size = rows[iterator].size;
			var content = rows[iterator].text;
			text.setAttribute('rel', 'spreadsheet-row-' + content); // for easy addressing
			text.innerHTML = content;
			height = Math.round(converter.call(context, twip).y) - 1;
			if (height <= 0) {
				L.DomUtil.setStyle(row, 'display', 'none');
			} else if (height < 10) {
				text.row = iterator + topRow;
				text.height = height;
				L.DomUtil.setStyle(row, 'height', height + 'px');
				L.DomUtil.setStyle(row, 'cursor', 'row-resize');
				L.DomUtil.setStyle(text, 'line-height', height + 'px');
				L.DomUtil.setStyle(text, 'cursor', 'row-resize');
				L.DomUtil.setStyle(resize, 'display', 'none');
				this.mouseInit(text);
			} else {
				resize.row = iterator + topRow;
				resize.height = height;
				L.DomUtil.setStyle(row, 'height', height + 'px');
				L.DomUtil.setStyle(text, 'line-height', height - 3 + 'px');
				L.DomUtil.setStyle(text, 'height', height - 3 + 'px');
				L.DomUtil.setStyle(resize, 'height', '3px');
				this.mouseInit(resize);
			}
			L.DomEvent.addListener(text, 'click', this._onRowHeaderClick, this);
		}

		if ($('.spreadsheet-header-row-text').length > 0) {
			$('.spreadsheet-header-row-text').contextMenu(this._map._permission === 'edit');
		}
	},

	_selectRow: function(row, modifier) {
		var command = {
			Row: {
				type: 'long',
				value: parseInt(row - 1)
			},
			Modifier: {
				type: 'unsigned short',
				value: modifier
			}
		};

		this._map.sendUnoCommand('.uno:SelectRow ', command);
	},

	_onRowHeaderClick: function (e) {
		var row = e.target.getAttribute('rel').split('spreadsheet-row-')[1];
		var modifier = 0;
		if (e.shiftKey) {
			modifier += this._map.keyboard.keyModifier.shift;
		}
		if (e.ctrlKey) {
			modifier += this._map.keyboard.keyModifier.ctrl;
		}

		this._selectRow(row, modifier);
	},

	_onDialogResult: function (e) {
		if (e.type === 'submit' && !isNaN(e.value)) {
			var extra = {
				aExtraHeight: {
					type: 'unsigned short',
					value: e.value
				}
			};

			this._map.sendUnoCommand('.uno:SetOptimalRowHeight', extra);
		}

		this._map.enable(true);
	},

	_getHorzLatLng: function (start, offset, e) {
		var limit = this._map.mouseEventToContainerPoint({clientX: start.x, clientY: start.y});
		var drag = this._map.mouseEventToContainerPoint(e);
		return [
			this._map.containerPointToLatLng(new L.Point(0, Math.max(limit.y, drag.y + offset.y))),
			this._map.containerPointToLatLng(new L.Point(this._map.getSize().x, Math.max(limit.y, drag.y + offset.y)))
		];
	},

	onDragStart: function (item, start, offset, e) {
		if (!this._horzLine) {
			this._horzLine = L.polyline(this._getHorzLatLng(start, offset, e), {color: 'darkblue', weight: 1});
		}
		else {
			this._horzLine.setLatLngs(this._getHorzLatLng(start, offset, e));
		}

		this._map.addLayer(this._horzLine);
	},

	onDragMove: function (item, start, offset, e) {
		if (this._horzLine) {
			this._horzLine.setLatLngs(this._getHorzLatLng(start, offset, e));
		}
	},

	onDragEnd: function (item, start, offset, e) {
		var end = new L.Point(e.clientX, e.clientY + offset.y);
		var distance = this._map._docLayer._pixelsToTwips(end.subtract(start));

		if (item.height != distance.y) {
			var command = {
				Row: {
					type: 'long',
					value: item.parentNode && item.parentNode.nextSibling &&
					       L.DomUtil.getStyle(item.parentNode.nextSibling, 'display') === 'none' ? item.row + 1 : item.row
				},
				Height: {
					type: 'unsigned short',
					value: Math.max(distance.y, 0)
				}
			};

			this._map.sendUnoCommand('.uno:RowHeight', command);
		}

		this._map.removeLayer(this._horzLine);
	},

	onDragClick: function (item, clicks, e) {
		this._map.removeLayer(this._horzLine);

		if (clicks === 2) {
			var command = {
				Row: {
					type: 'long',
					value: item.row - 1
				},
				Modifier: {
					type: 'unsigned short',
					value: 0
				}
			};

			var extra = {
				aExtraHeight: {
					type: 'unsigned short',
					value: 0
				}
			};

			this._map.sendUnoCommand('.uno:SelectRow', command);
			this._map.sendUnoCommand('.uno:SetOptimalRowHeight', extra);
		}
	},

	_onUpdatePermission: function (e) {
		if (this._map.getDocType() !== 'spreadsheet') {
			return;
		}

		if (!this._initialized) {
			this._initialize();
		}
		// Enable context menu on row headers only if permission is 'edit'
		if ($('.spreadsheet-header-row-text').length > 0) {
			$('.spreadsheet-header-row-text').contextMenu(e.perm === 'edit');
		}
	}
});

L.control.rowHeader = function (options) {
	return new L.Control.RowHeader(options);
};


/*
 * L.Control.MetricInput.
 */

L.Control.MetricInput = L.Control.extend({
	options: {
		position: 'topmiddle',
		title: ''
	},

	initialize: function (callback, context, value, options) {
		L.setOptions(this, options);

		this._callback = callback;
		this._context = context;
		this._default = value;
	},

	onAdd: function (map) {
		this._initLayout();

		return this._container;
	},

	_initLayout: function () {
		var className = 'leaflet-control-layers',
		container = this._container = L.DomUtil.create('div', className);
		container.style.visibility = 'hidden';

		var closeButton = L.DomUtil.create('a', 'leaflet-popup-close-button', container);
		closeButton.href = '#close';
		closeButton.innerHTML = '&#215;';
		L.DomEvent.on(closeButton, 'click', this._onCloseButtonClick, this);

		var wrapper = L.DomUtil.create('div', 'leaflet-popup-content-wrapper', container);
		var content = L.DomUtil.create('div', 'leaflet-popup-content', wrapper);
		var labelTitle = document.createElement('span');
		labelTitle.innerHTML = '<b>' + this.options.title + ' ' + _('(100th/mm)') + '</b>';
		content.appendChild(labelTitle);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));

		var labelAdd = document.createElement('span');
		labelAdd.innerHTML = _('Add: ');
		content.appendChild(labelAdd);

		var inputMetric = this._input = document.createElement('input');
		inputMetric.type = 'text';
		inputMetric.value = this._default;
		content.appendChild(inputMetric);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));

		var inputValue = document.createElement('input');
		inputValue.type = 'checkbox';
		inputValue.checked = true;
		L.DomEvent.on(inputValue, 'click', this._onDefaultClick, this);
		content.appendChild(inputValue);

		var labelValue = document.createElement('span');
		labelValue.innerHTML = _('Default value');
		content.appendChild(labelValue);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));

		var inputButton = document.createElement('input');
		inputButton.type = 'button';
		inputButton.value = _('Submit');
		L.DomEvent.on(inputButton, 'click', this._onOKButtonClick, this);

		content.appendChild(inputButton);
	},

	onRemove: function (map) {
		this._input = null;
	},

	show: function () {
		this._container.style.marginLeft = (-this._container.offsetWidth / 2) + 'px';
		this._container.style.visibility = '';
		this._input.focus();
	},

	_onDefaultClick: function (e) {
		this._input.value = this._default;
	},

	_onOKButtonClick: function (e) {
		var data = parseFloat(this._input.value);
		this.remove();
		this._callback.call(this._context, {type: 'submit', value: data});
	},

	_onCloseButtonClick: function (e) {
		this.remove();
		this._callback.call(this._context, {type : 'close'});
	}
});

L.control.metricInput = function (callback, context, value, options) {
	return new L.Control.MetricInput(callback, context, value, options);
};


/*
 * L.Control.DocumentRepair.
 */

L.Control.DocumentRepair = L.Control.extend({
	options: {
		position: 'topright'
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this._initLayout();

		return this._container;
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-control-layers');
		this._container.style.visibility = 'hidden';

		var closeButton = L.DomUtil.create('a', 'leaflet-popup-close-button', this._container);
		closeButton.href = '#close';
		closeButton.innerHTML = '&#215;';
		L.DomEvent.on(closeButton, 'click', this._onCloseClick, this);

		var wrapper = L.DomUtil.create('div', 'leaflet-popup-content-wrapper', this._container);
		var content = L.DomUtil.create('div', 'leaflet-popup-content', wrapper);
		var labelTitle = document.createElement('span');
		labelTitle.innerHTML = '<b>' + _('Repair Document') + '</b>';
		content.appendChild(labelTitle);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		var table = L.DomUtil.create('table', '', content);
		var tbody = this._tbody = L.DomUtil.create('tbody', '', table);
		var tr = L.DomUtil.create('tr', '', tbody);
		var th = L.DomUtil.create('th', '', tr);
		th.appendChild(document.createTextNode(_('Type')));
		th = L.DomUtil.create('th', '', tr);
		th.appendChild(document.createTextNode(_('Index')));
		th = L.DomUtil.create('th', '', tr);
		th.appendChild(document.createTextNode(_('Comment')));
		th = L.DomUtil.create('th', '', tr);
		th.appendChild(document.createTextNode(_('User name')));
		th = L.DomUtil.create('th', '', tr);
		th.appendChild(document.createTextNode(_('Timestamp')));

		var inputButton = document.createElement('input');
		inputButton.type = 'button';
		inputButton.value = _('Jump to state');
		L.DomEvent.on(inputButton, 'click', this._onJumpClick, this);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		content.appendChild(inputButton);
	},

	createAction: function (type, index, comment, viewId, dateTime) {
		var row = L.DomUtil.create('tr', '', this._tbody);
		var td = L.DomUtil.create('td', '', row);
		td.appendChild(document.createTextNode(type));
		td = L.DomUtil.create('td', '', row);
		td.appendChild(document.createTextNode(index));
		td = L.DomUtil.create('td', '', row);
		td.appendChild(document.createTextNode(comment));
		td = L.DomUtil.create('td', '', row);
		td.appendChild(document.createTextNode(viewId));

		// Show relative date by default, absolute one as tooltip.
		td = L.DomUtil.create('td', '', row);
		var relativeDateTime = jQuery.timeago(dateTime.replace(/,.*/, 'Z'));
		var span = document.createElement('span');
		span.title = dateTime;
		span.appendChild(document.createTextNode(relativeDateTime));
		td.appendChild(span);

		L.DomEvent.on(row, 'click', this._onRowClick, this);
		L.DomEvent.on(row, 'dblclick', this._onJumpClick, this);
	},

	fillAction: function (actions, type) {
		for (var iterator = 0; iterator < actions.length; ++iterator) {
			// No user name if the user in question is already disconnected.
			var userName = actions[iterator].userName ? actions[iterator].userName : '';
			if (parseInt(actions[iterator].viewId) === this._map._docLayer._viewId) {
				userName = _('You');
			}
			this.createAction(type, actions[iterator].index, actions[iterator].comment, userName, actions[iterator].dateTime);
		}
	},

	fillActions: function (data) {
		this.fillAction(data.Redo.actions, 'Redo');
		this.fillAction(data.Undo.actions, 'Undo');
	},

	show: function () {
		this._tbody.setAttribute('style', 'max-height:' + this._map.getSize().y / 2 + 'px');
		this._container.style.visibility = '';
	},


	_selectRow: function (row) {
		if (this._selected) {
			L.DomUtil.removeClass(this._selected, 'leaflet-popup-selected');
		}

		this._selected = row;
		L.DomUtil.addClass(this._selected, 'leaflet-popup-selected');
	},

	_onCloseClick: function (e) {
		this._map.enable(true);
		this._refocusOnMap();
		this.remove();
	},

	_onRowClick: function (e) {
		if (e.currentTarget && this._selected !== e.currentTarget) {
			this._selectRow(e.currentTarget);
		}
	},

	_onJumpClick: function (e) {
		if (this._selected) {
			var action = this._selected.childNodes[0].innerHTML;
			var index = parseInt(this._selected.childNodes[1].innerHTML);
			var command = {
				Repair: {
					type: 'boolean',
					value: true
				}
			};
			command[action] = {
				type: 'unsigned short',
				value: index + 1
			};
			this._map.sendUnoCommand('.uno:' + action, command);
			this._onCloseClick();
		}
	}
});

L.control.documentRepair = function (options) {
	return new L.Control.DocumentRepair(options);
};


/*
 * L.Control.CharacterMap.
 */

L.Control.CharacterMap = L.Control.extend({
	options: {
		position: 'topright'
	},

	unicodeBlocks : [
		{ name: _('None'),					start: 0x0000, end: 0x0000 }, /*UBLOCK_NO_BLOCK=0*/
		{ name: _('Basic Latin'),				start: 0x0021, end: 0x007F }, /*UBLOCK_BASIC_LATIN=1*/
		{ name: _('Latin-1'),					start: 0x0080, end: 0x00FF }, /*UBLOCK_LATIN_1_SUPPLEMENT=2*/
		{ name: _('Latin Extended-A'),				start: 0x0100, end: 0x017F }, /*UBLOCK_LATIN_EXTENDED_A=3*/
		{ name: _('Latin Extended-B'),				start: 0x0180, end: 0x024F }, /*UBLOCK_LATIN_EXTENDED_B=4*/
		{ name: _('IPA Extensions'),				start: 0x0250, end: 0x02AF }, /*UBLOCK_IPA_EXTENSIONS=5*/
		{ name: _('Spacing Modifier Letters'),			start: 0x02B0, end: 0x02FF }, /*UBLOCK_SPACING_MODIFIER_LETTERS=6*/
		{ name: _('Combining Diacritical Marks'),		start: 0x0300, end: 0x036F }, /*UBLOCK_COMBINING_DIACRITICAL_MARKS=7*/
		{ name: _('Basic Greek'),				start: 0x0370, end: 0x03FF }, /*UBLOCK_GREEK=8*/
		{ name: _('Cyrillic'),					start: 0x0400, end: 0x04FF }, /*UBLOCK_CYRILLIC=9*/
		{ name: _('Armenian'),					start: 0x0530, end: 0x058F }, /*UBLOCK_ARMENIAN=10*/
		{ name: _('Basic Hebrew'),				start: 0x0590, end: 0x05FF }, /*UBLOCK_HEBREW=11*/
		{ name: _('Basic Arabic'),				start: 0x0600, end: 0x06FF }, /*UBLOCK_ARABIC=12*/
		{ name: _('Syriac'),					start: 0x0700, end: 0x074F }, /*UBLOCK_SYRIAC=13*/
		{ name: _('Thaana'),					start: 0x0780, end: 0x07BF }, /*UBLOCK_THAANA =14*/
		{ name: _('Devanagari'),				start: 0x0900, end: 0x097F }, /*UBLOCK_DEVANAGARI=15*/
		{ name: _('Bengali'),					start: 0x0980, end: 0x09FF }, /*UBLOCK_BENGALI=16*/
		{ name: _('Gurmukhi'),					start: 0x0A00, end: 0x0A7F }, /*UBLOCK_GURMUKHI=17*/
		{ name: _('Gujarati'),					start: 0x0A80, end: 0x0AFF }, /*UBLOCK_GUJARATI=18*/
		{ name: _('Odia'),					start: 0x0B00, end: 0x0B7F }, /*UBLOCK_ORIYA=19*/
		{ name: _('Tamil'),					start: 0x0B80, end: 0x0BFF }, /*UBLOCK_TAMIL=20*/
		{ name: _('Telugu'),					start: 0x0C00, end: 0x0C7F }, /*UBLOCK_TELUGU=21*/
		{ name: _('Kannada'),					start: 0x0C80, end: 0x0CFF }, /*UBLOCK_KANNADA=22*/
		{ name: _('Malayalam'),					start: 0x0D00, end: 0x0D7F }, /*UBLOCK_MALAYALAM=23*/
		{ name: _('Sinhala'),					start: 0x0D80, end: 0x0DFF }, /*UBLOCK_SINHALA=24*/
		{ name: _('Thai'),					start: 0x0E00, end: 0x0E7F }, /*UBLOCK_THAI=25*/
		{ name: _('Lao'),					start: 0x0E80, end: 0x0EFF }, /*UBLOCK_LAO=26*/
		{ name: _('Tibetan'),					start: 0x0F00, end: 0x0FFF }, /*UBLOCK_TIBETAN=27*/
		{ name: _('Myanmar'),					start: 0x1000, end: 0x109F }, /*UBLOCK_MYANMAR=28*/
		{ name: _('Basic Georgian'),				start: 0x10A0, end: 0x10FF }, /*UBLOCK_GEORGIAN=29*/
		{ name: _('Hangul Jamo'),				start: 0x1100, end: 0x11FF }, /*UBLOCK_HANGUL_JAMO=30*/
		//{ name: _('Ethiopic'),				start: 0x1200, end: 0x137F }, /*UBLOCK_ETHIOPIC=31*/
		{ name: _('Ethiopic'),					start: 0x1200, end: 0x12FF }, /*UBLOCK_ETHIOPIC=31*/
		{ name: _('Cherokee'),					start: 0x13A0, end: 0x13FF }, /*UBLOCK_CHEROKEE=32*/
		//{ name: _('Canadian Aboriginal Syllables'),		start: 0x1400, end: 0x167F }, /*UBLOCK_UNIFIED_CANADIAN_ABORIGINAL_SYLLABICS=33*/
		{ name: _('Canadian Aboriginal Syllables'),		start: 0x1400, end: 0x14FF }, /*UBLOCK_UNIFIED_CANADIAN_ABORIGINAL_SYLLABICS=33*/
		{ name: _('Ogham'),					start: 0x1680, end: 0x169F }, /*UBLOCK_OGHAM=34*/
		{ name: _('Runic'),					start: 0x16A0, end: 0x16FF }, /*UBLOCK_RUNIC=35*/
		{ name: _('Khmer'),					start: 0x1780, end: 0x17FF }, /*UBLOCK_KHMER=36*/
		{ name: _('Mongolian'),					start: 0x1800, end: 0x18AF }, /*UBLOCK_MONGOLIAN=37*/
		{ name: _('Latin Extended Additional'),			start: 0x1E00, end: 0x1EFF }, /*UBLOCK_LATIN_EXTENDED_ADDITIONAL=38*/
		{ name: _('Greek Extended'),				start: 0x1F00, end: 0x1FFF }, /*UBLOCK_GREEK_EXTENDED=39*/
		{ name: _('General Punctuation'),			start: 0x2000, end: 0x206F }, /*UBLOCK_GENERAL_PUNCTUATION=40*/
		{ name: _('Superscripts and Subscripts'),		start: 0x2070, end: 0x209F }, /*UBLOCK_SUPERSCRIPTS_AND_SUBSCRIPTS=41*/
		{ name: _('Currency Symbols'),				start: 0x20A0, end: 0x20CF }, /*UBLOCK_CURRENCY_SYMBOLS=42*/
		{ name: _('Combining Diacritical Symbols'),		start: 0x20D0, end: 0x20FF }, /*UBLOCK_COMBINING_MARKS_FOR_SYMBOLS=43*/
		{ name: _('Letterlike Symbols'),			start: 0x2100, end: 0x214F }, /*UBLOCK_LETTERLIKE_SYMBOLS=44*/
		{ name: _('Number Forms'),				start: 0x2150, end: 0x218F }, /*UBLOCK_NUMBER_FORMS=45*/
		{ name: _('Arrows'),					start: 0x2190, end: 0x21FF }, /*UBLOCK_ARROWS=46*/
		{ name: _('Mathematical Operators'),			start: 0x2200, end: 0x22FF }, /*UBLOCK_MATHEMATICAL_OPERATORS=47*/
		{ name: _('Miscellaneous Technical'),			start: 0x2300, end: 0x23FF }, /*UBLOCK_MISCELLANEOUS_TECHNICAL=48*/
		{ name: _('Control Pictures'),				start: 0x2400, end: 0x243F }, /*UBLOCK_CONTROL_PICTURES=49*/
		{ name: _('Optical Character Recognition'),		start: 0x2440, end: 0x245F }, /*UBLOCK_OPTICAL_CHARACTER_RECOGNITION=50*/
		{ name: _('Enclosed Alphanumerics'),			start: 0x2460, end: 0x24FF }, /*UBLOCK_ENCLOSED_ALPHANUMERICS=51*/
		{ name: _('Box Drawing'),				start: 0x2500, end: 0x257F }, /*UBLOCK_BOX_DRAWING=52*/
		{ name: _('Block Elements'),				start: 0x2580, end: 0x259F }, /*UBLOCK_BLOCK_ELEMENTS=53*/
		{ name: _('Geometric Shapes'),				start: 0x25A0, end: 0x25FF }, /*UBLOCK_GEOMETRIC_SHAPES=54*/
		{ name: _('Miscellaneous Symbols'),			start: 0x2600, end: 0x26FF }, /*UBLOCK_MISCELLANEOUS_SYMBOLS=55*/
		{ name: _('Dingbats'),					start: 0x2700, end: 0x27BF }, /*UBLOCK_DINGBATS=56*/
		{ name: _('Braille Patterns'),				start: 0x2800, end: 0x28FF }, /*UBLOCK_BRAILLE_PATTERNS=57*/
		{ name: _('CJK Radicals Supplement'),			start: 0x2E80, end: 0x2EFF }, /*UBLOCK_CJK_RADICALS_SUPPLEMENT=58*/
		{ name: _('Kangxi Radicals'),				start: 0x2F00, end: 0x2FDF }, /*UBLOCK_KANGXI_RADICALS=59*/
		{ name: _('Ideographic Description Characters'),	start: 0x2FF0, end: 0x2FFF }, /*UBLOCK_IDEOGRAPHIC_DESCRIPTION_CHARACTERS=60*/
		{ name: _('CJK Symbols and Punctuation'),		start: 0x3000, end: 0x303F }, /*UBLOCK_CJK_SYMBOLS_AND_PUNCTUATION=61*/
		{ name: _('Hiragana'),					start: 0x3040, end: 0x309F }, /*UBLOCK_HIRAGANA=62*/
		{ name: _('Katakana'),					start: 0x30A0, end: 0x30FF }, /*UBLOCK_KATAKANA=63*/
		{ name: _('Bopomofo'),					start: 0x3100, end: 0x312F }, /*UBLOCK_BOPOMOFO=64*/
		{ name: _('Hangul Compatibility Jamo'),			start: 0x3130, end: 0x318F }, /*UBLOCK_HANGUL_COMPATIBILITY_JAMO=65*/
		{ name: _('Kanbun'),					start: 0x3190, end: 0x319F }, /*UBLOCK_KANBUN=66*/
		{ name: _('Bopomofo Extended'),				start: 0x31A0, end: 0x31BF }, /*UBLOCK_BOPOMOFO_EXTENDED=67*/
		{ name: _('Enclosed CJK Letters and Months'),		start: 0x3200, end: 0x32FF }, /*UBLOCK_ENCLOSED_CJK_LETTERS_AND_MONTHS=68*/
		{ name: _('CJK Compatibility'),				start: 0x3300, end: 0x33FF }, /*UBLOCK_CJK_COMPATIBILITY=69*/
		//{ name: _('CJK Unified Ideographs Extension A'),	start: 0x3400, end: 0x4DB5 }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_A=70*/
		{ name: _('CJK Unified Ideographs Extension A'),	start: 0x3400, end: 0x34FF }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_A=70*/
		//{ name: _('CJK Unified Ideographs'),			start: 0x4E00, end: 0x9FFF }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS=71*/
		{ name: _('CJK Unified Ideographs'),			start: 0x4E00, end: 0x4EFF }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS=71*/

		{ name: _('Yi Syllables'),				start: 0xA000, end: 0xA0FF }, /*UBLOCK_YI_SYLLABLES=72*/
		//{ name: _('Yi Syllables'),				start: 0xA000, end: 0xA48F }, /*UBLOCK_YI_SYLLABLES=72*/
		{ name: _('Yi Radicals'),				start: 0xA490, end: 0xA4CF }, /*UBLOCK_YI_RADICALS=73*/
		//{ name: _('Hangul'),					start: 0xAC00, end: 0xD7AF }, /*UBLOCK_HANGUL_SYLLABLES=74*/
		{ name: _('Hangul'),					start: 0xAC00, end: 0xACFF }, /*UBLOCK_HANGUL_SYLLABLES=74*/
		//{ name: _('High Surrogates'),                      	start: 0xD800, end: 0xDB7F }, /*UBLOCK_HIGH_SURROGATES =75*/
		{ name: _('High Surrogates'),                      	start: 0xD800, end: 0xD8FF }, /*UBLOCK_HIGH_SURROGATES =75*/
		{ name: _('High Private Use Surrogates'),          	start: 0xDB80, end: 0xDBFF }, /*UBLOCK_HIGH_PRIVATE_USE_SURROGATES=76*/
		//{ name: _('Low Surrogates'),                       	start: 0xDC00, end: 0xDFFF }, /*UBLOCK_LOW_SURROGATES=77*/
		{ name: _('Low Surrogates'),                       	start: 0xDC00, end: 0xDCFF }, /*UBLOCK_LOW_SURROGATES=77*/
		//{ name: _('Private Use Area'),			start: 0xE000, end: 0xF8FF }, /*UBLOCK_PRIVATE_USE_AREA=78*/
		{ name: _('Private Use Area'),				start: 0xE000, end: 0xE0FF }, /*UBLOCK_PRIVATE_USE_AREA=78*/
		//{ name: _('CJK Compatibility Ideographs'),		start: 0xF900, end: 0xFAFF }, /*UBLOCK_CJK_COMPATIBILITY_IDEOGRAPHS=79*/
		{ name: _('CJK Compatibility Ideographs'),		start: 0xF900, end: 0xF9FF }, /*UBLOCK_CJK_COMPATIBILITY_IDEOGRAPHS=79*/
		{ name: _('Alphabetic Presentation Forms'),		start: 0xFB00, end: 0xFB4F }, /*UBLOCK_ALPHABETIC_PRESENTATION_FORMS=80*/
		//{ name: _('Arabic Presentation Forms-A'),		start: 0xFB50, end: 0xFDFF }, /*UBLOCK_ARABIC_PRESENTATION_FORMS_A=81*/
		{ name: _('Arabic Presentation Forms-A'),		start: 0xFB50, end: 0xFBFF }, /*UBLOCK_ARABIC_PRESENTATION_FORMS_A=81*/
		{ name: _('Combining Half Marks'),			start: 0xFE20, end: 0xFE2F }, /*UBLOCK_COMBINING_HALF_MARKS=82*/
		{ name: _('CJK Compatibility Forms'),			start: 0xFE30, end: 0xFE4F }, /*UBLOCK_CJK_COMPATIBILITY_FORMS=83*/
		{ name: _('Small Form Variants'),			start: 0xFE50, end: 0xFE6F }, /*UBLOCK_SMALL_FORM_VARIANTS=84*/
		{ name: _('Arabic Presentation Forms-B'),		start: 0xFE70, end: 0xFEEE }, /*UBLOCK_ARABIC_PRESENTATION_FORMS_B=85*/
		{ name: _('Specials'),					start: 0xFEFF, end: 0xFEFF }, /*UBLOCK_SPECIALS=86*/
		{ name: _('Halfwidth and Fullwidth Forms'),		start: 0xFF00, end: 0xFFEF }, /*UBLOCK_HALFWIDTH_AND_FULLWIDTH_FORMS=87*/
		{ name: _('Old Italic'),				start: 0x10300, end: 0x1032F }, /*UBLOCK_OLD_ITALIC= 88*/
		{ name: _('Gothic'),					start: 0x10330, end: 0x1034F }, /*UBLOCK_GOTHIC=89*/
		{ name: _('Deseret'),					start: 0x10400, end: 0x1044F }, /*UBLOCK_DESERET=90*/
		{ name: _('Byzantine Musical Symbols'),			start: 0x1D000, end: 0x1D0FF }, /*UBLOCK_BYZANTINE_MUSICAL_SYMBOLS=91*/
		{ name: _('Musical Symbols'),				start: 0x1D100, end: 0x1D1FF }, /*UBLOCK_MUSICAL_SYMBOLS=92*/
		{ name: _('Musical Symbols'),				start: 0x1D400, end: 0x1D7FF }, /*UBLOCK_MATHEMATICAL_ALPHANUMERIC_SYMBOLS=93*/
		//{ name: _('CJK Unified Ideographs Extension B'),	start: 0x20000, end: 0x2A6DF }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_B=94*/
		{ name: _('CJK Unified Ideographs Extension B'),	start: 0x20000, end: 0x200FF }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_B=94*/

		//{ name: _('CJK Compatibility Ideographs Supplement'),	start: 0x2F800, end: 0x2FA1F }, /*UBLOCK_CJK_COMPATIBILITY_IDEOGRAPHS_SUPPLEMENT=95*/
		{ name: _('CJK Compatibility Ideographs Supplement'), 	start: 0x2F800, end: 0x2F8FF }, /*UBLOCK_CJK_COMPATIBILITY_IDEOGRAPHS_SUPPLEMENT=95*/
		{ name: _('Tags'),					start: 0xE0000, end: 0xE007F }, /*UBLOCK_TAGS=96*/
		{ name: _('Cyrillic Supplement'),			start: 0x0500, end: 0x052F }, /*UBLOCK_CYRILLIC_SUPPLEMENTARY=97*/
		{ name: _('Tagalog'),					start: 0x1700, end: 0x171F }, /*UBLOCK_TAGALOG=98*/
		{ name: _('Hanunoo'),					start: 0x1720, end: 0x173F }, /*UBLOCK_HANUNOO=99*/
		{ name: _('Buhid'),					start: 0x1740, end: 0x175F }, /*UBLOCK_BUHID=100*/
		{ name: _('Tagbanwa'),					start: 0x1760, end: 0x177F }, /*UBLOCK_TAGBANWA=101*/
		{ name: _('Miscellaneous Mathematical Symbols-A'),	start: 0x27C0, end: 0x27EF }, /*UBLOCK_MISCELLANEOUS_MATHEMATICAL_SYMBOLS_A=102*/
		{ name: _('Supplemental Arrows-A'),			start: 0x27F0, end: 0x27FF }, /*UBLOCK_SUPPLEMENTAL_ARROWS_A=103*/
		{ name: _('Supplemental Arrows-B'),			start: 0x2900, end: 0x297F }, /*UBLOCK_SUPPLEMENTAL_ARROWS_B=104*/
		{ name: _('Miscellaneous Mathematical Symbols-B'),	start: 0x2980, end: 0x29FF }, /*UBLOCK_MISCELLANEOUS_MATHEMATICAL_SYMBOLS_B=105*/
		{ name: _('Supplemental Mathematical Operators'),	start: 0x2A00, end: 0x2AFF }, /*UBLOCK_SUPPLEMENTAL_MATHEMATICAL_OPERATORS=106*/
		{ name: _('Katakana Phonetics Extensions'),		start: 0x31F0, end: 0x31FF }, /*UBLOCK_KATAKANA_PHONETIC_EXTENSIONS=107*/
		{ name: _('Variation Selectors'),			start: 0xFE00, end: 0xFE0F }, /*UBLOCK_VARIATION_SELECTORS=108*/
		//{ name: _('Supplementary Private Use Area-A'),	start: 0xF0000, end: 0xFFFFF }, /*UBLOCK_SUPPLEMENTARY_PRIVATE_USE_AREA_A=109*/
		{ name: _('Supplementary Private Use Area-A'),		start: 0xF0000, end: 0xF00FF }, /*UBLOCK_SUPPLEMENTARY_PRIVATE_USE_AREA_A=109*/

		//{ name: _('Supplementary Private Use Area-B'),	start: 0x100000, end: 0x10FFFF }, /*UBLOCK_SUPPLEMENTARY_PRIVATE_USE_AREA_B=110*/
		{ name: _('Supplementary Private Use Area-B'),		start: 0x100000, end: 0x1000FF }, /*UBLOCK_SUPPLEMENTARY_PRIVATE_USE_AREA_B=110*/
		{ name: _('Limbu'),					start: 0x1900, end: 0x194F }, /*UBLOCK_LIMBU=111*/
		{ name: _('Tai Le'),					start: 0x1950, end: 0x197F }, /*UBLOCK_TAI_LE=112*/
		{ name: _('Khmer Symbols'),				start: 0x19E0, end: 0x19FF }, /*UBLOCK_KHMER_SYMBOLS=113*/
		{ name: _('Phonetic Extensions'),			start: 0x1D00, end: 0x1D7F }, /*UBLOCK_PHONETIC_EXTENSIONS=114*/
		{ name: _('Miscellaneous Symbols And Arrows'),		start: 0x2B00, end: 0x2BFF }, /*UBLOCK_MISCELLANEOUS_SYMBOLS_AND_ARROWS=115*/
		{ name: _('Yijing Hexagram Symbols'),			start: 0x4DC0, end: 0x4DFF }, /*UBLOCK_YIJING_HEXAGRAM_SYMBOLS=116*/
		{ name: _('Linear B Syllabary'),			start: 0x10000, end: 0x1007F }, /*UBLOCK_LINEAR_B_SYLLABARY=117*/
		{ name: _('Linear B Ideograms'),			start: 0x10080, end: 0x100FF }, /*UBLOCK_LINEAR_B_IDEOGRAMS=118*/
		{ name: _('Aegean Numbers'),				start: 0x10100, end: 0x1013F }, /*UBLOCK_AEGEAN_NUMBERS=119*/
		{ name: _('Ugaritic'),					start: 0x10380, end: 0x1039F }, /*UBLOCK_UGARITIC=120*/
		{ name: _('Shavian'),					start: 0x10450, end: 0x1047F }, /*UBLOCK_SHAVIAN=121*/
		{ name: _('Osmanya'),					start: 0x10480, end: 0x104AF }, /*UBLOCK_OSMANYA=122*/
		{ name: _('Cypriot Syllabary'),				start: 0x10800, end: 0x1083F }, /*UBLOCK_CYPRIOT_SYLLABARY=123*/
		{ name: _('Tai Xuan Jing Symbols'),			start: 0x1D300, end: 0x1D35F }, /*UBLOCK_TAI_XUAN_JING_SYMBOLS=124*/
		{ name: _('Variation Selectors Supplement'),		start: 0xE0100, end: 0xE01EF }, /*UBLOCK_VARIATION_SELECTORS_SUPPLEMENT=125*/
		{ name: _('Ancient Greek Musical Notation'),		start: 0x1D200, end: 0x1D24F }, /*UBLOCK_ANCIENT_GREEK_MUSICAL_NOTATION=126*/
		{ name: _('Ancient Greek Numbers'),			start: 0x10140, end: 0x1018F }, /*UBLOCK_ANCIENT_GREEK_NUMBERS=127*/
		{ name: _('Arabic Supplement'),				start: 0x0750, end: 0x077F }, /*UBLOCK_ARABIC_SUPPLEMENT=128*/
		{ name: _('Buginese'),					start: 0x1A00, end: 0x1A1F }, /*UBLOCK_BUGINESE=129*/
		{ name: _('CJK Strokes'),				start: 0x31C0, end: 0x31EF }, /*UBLOCK_CJK_STROKES=130*/
		{ name: _('Combining Diacritical Marks Supplement'), 	start: 0x1DC0, end: 0x1DFF }, /*UBLOCK_COMBINING_DIACRITICAL_MARKS_SUPPLEMENT=131*/
		{ name: _('Coptic'),					start: 0x2C80, end: 0x2CFF }, /*UBLOCK_COPTIC=132*/
		{ name: _('Ethiopic Extended'),				start: 0x2D80, end: 0x2DDF }, /*UBLOCK_ETHIOPIC_EXTENDED=133*/
		{ name: _('Ethiopic Supplement'),			start: 0x1380, end: 0x139F }, /*UBLOCK_ETHIOPIC_SUPPLEMENT=134*/
		{ name: _('Georgian Supplement'),			start: 0x2D00, end: 0x2D2F }, /*UBLOCK_GEORGIAN_SUPPLEMENT=135*/
		{ name: _('Glagolitic'),				start: 0x2C00, end: 0x2C5F }, /*UBLOCK_GLAGOLITIC=136*/
		{ name: _('Kharoshthi'),				start: 0x10A00, end: 0x10A5F }, /*UBLOCK_KHAROSHTHI=137*/
		{ name: _('Modifier Tone Letters'),			start: 0xA700, end: 0xA71F }, /*UBLOCK_MODIFIER_TONE_LETTERS=138*/
		{ name: _('New Tai Lue'),				start: 0x1980, end: 0x19DF }, /*UBLOCK_NEW_TAI_LUE=139*/
		{ name: _('Old Persian'),				start: 0x103A0, end: 0x103DF }, /*UBLOCK_OLD_PERSIAN=140*/
		{ name: _('Phonetic Extensions Supplement'),		start: 0x1D80, end: 0x1DBF }, /*UBLOCK_PHONETIC_EXTENSIONS_SUPPLEMENT=141*/
		{ name: _('Supplemental Punctuation'),			start: 0x2E00, end: 0x2E7F }, /*UBLOCK_SUPPLEMENTAL_PUNCTUATION=142*/
		{ name: _('Syloti Nagri'),				start: 0xA800, end: 0xA82F }, /*UBLOCK_SYLOTI_NAGRI=143*/
		{ name: _('Tifinagh'),					start: 0x2D30, end: 0x2D7F }, /*UBLOCK_TIFINAGH=144*/
		{ name: _('Vertical Forms'),				start: 0xFE10, end: 0xFE1F }, /*UBLOCK_VERTICAL_FORMS=145*/
		{ name: _('Nko'),					start: 0x07C0, end: 0x07FF }, /*UBLOCK_NKO=146*/
		{ name: _('Balinese'),					start: 0x1B00, end: 0x1B7F }, /*UBLOCK_BALINESE=147*/
		{ name: _('Latin Extended-C'),				start: 0x2C60, end: 0x2C7F }, /*UBLOCK_LATIN_EXTENDED_C=148*/
		{ name: _('Latin Extended-D'),				start: 0xA720, end: 0xA7FF }, /*UBLOCK_LATIN_EXTENDED_D=149*/
		{ name: _('Phags-Pa'),					start: 0xA840, end: 0xA87F }, /*UBLOCK_PHAGS_PA=150*/
		{ name: _('Phoenician'),				start: 0x10900, end: 0x1091F }, /*UBLOCK_PHOENICIAN=151*/
		//{ name: _('Cuneiform'),				start: 0x12000, end: 0x123FF }, /*UBLOCK_CUNEIFORM=152*/
		{ name: _('Cuneiform'),					start: 0x12000, end: 0x120FF }, /*UBLOCK_CUNEIFORM=152*/
		{ name: _('Cuneiform Numbers And Punctuation'),		start: 0x12400, end: 0x1247F }, /*UBLOCK_CUNEIFORM_NUMBERS_AND_PUNCTUATION=153*/
		{ name: _('Counting Rod Numerals'),			start: 0x1D360, end: 0x1D37F }, /*UBLOCK_COUNTING_ROD_NUMERALS=154*/
		{ name: _('Sundanese'),					start: 0x1B80, end: 0x1BBF }, /*UBLOCK_SUNDANESE=155*/
		{ name: _('Lepcha'),					start: 0x1C00, end: 0x1C4F }, /*UBLOCK_LEPCHA=156*/
		{ name: _('Ol Chiki'),					start: 0x1C50, end: 0x1C7F }, /*UBLOCK_OL_CHIKI=157*/
		{ name: _('Cyrillic Extended-A'),			start: 0x2DE0, end: 0x2DFF }, /*UBLOCK_CYRILLIC_EXTENDED_A=158*/
		//{ name: _('Vai'),					start: 0xA500, end: 0xA63F }, /*UBLOCK_VAI=159*/
		{ name: _('Vai'),					start: 0xA500, end: 0xA5FF }, /*UBLOCK_VAI=159*/
		{ name: _('Cyrillic Extended-B'),			start: 0xA640, end: 0xA69F }, /*UBLOCK_CYRILLIC_EXTENDED_B=160*/
		{ name: _('Saurashtra'),				start: 0xA880, end: 0xA8DF }, /*UBLOCK_SAURASHTRA=161*/
		{ name: _('Kayah Li'),					start: 0xA900, end: 0xA92F }, /*UBLOCK_KAYAH_LI=162*/
		{ name: _('Rejang'),					start: 0xA930, end: 0xA95F }, /*UBLOCK_REJANG=163*/
		{ name: _('Cham'),					start: 0xAA00, end: 0xAA5F }, /*UBLOCK_CHAM=164*/
		{ name: _('Ancient Symbols'),				start: 0x10190, end: 0x101CF }, /*UBLOCK_ANCIENT_SYMBOLS=165*/
		{ name: _('Phaistos Disc'),				start: 0x101D0, end: 0x101FF }, /*UBLOCK_PHAISTOS_DISC=166*/
		{ name: _('Lycian'),					start: 0x10280, end: 0x1029F }, /*UBLOCK_LYCIAN=167*/
		{ name: _('Carian'),					start: 0x102A0, end: 0x102DF }, /*UBLOCK_CARIAN=168*/
		{ name: _('Lydian'),					start: 0x10920, end: 0x1093F }, /*UBLOCK_LYDIAN=169*/
		{ name: _('Mahjong Tiles'),				start: 0x1F000, end: 0x1F02F }, /*UBLOCK_MAHJONG_TILES=170*/
		{ name: _('Domino Tiles'),				start: 0x1F030, end: 0x1F09F }, /*UBLOCK_DOMINO_TILES=171*/
		{ name: _('Samaritan'),					start: 0x0800, end: 0x083F }, /*UBLOCK_SAMARITAN=172*/
		{ name: _('Canadian Aboriginal Syllabics Extended'), 	start: 0x18B0, end: 0x18FF }, /*UBLOCK_UNIFIED_CANADIAN_ABORIGINAL_SYLLABICS_EXTENDED=173*/
		{ name: _('Tai Tham'),					start: 0x1A20, end: 0x1AAF }, /*UBLOCK_TAI_THAM=174*/
		{ name: _('Vedic Extensions'),				start: 0x1CD0, end: 0x1CFF }, /*UBLOCK_VEDIC_EXTENSIONS=175*/
		{ name: _('Lisu'),					start: 0xA4D0, end: 0xA4FF }, /*UBLOCK_LISU=176*/
		{ name: _('Bamum'),					start: 0xA6A0, end: 0xA6FF }, /*UBLOCK_BAMUM=177*/
		{ name: _('Common Indic Number Forms'),			start: 0xA830, end: 0xA83F }, /*UBLOCK_COMMON_INDIC_NUMBER_FORMS=178*/
		{ name: _('Devanagari Extended'),			start: 0xA8E0, end: 0xA8FF }, /*UBLOCK_DEVANAGARI_EXTENDED=179*/
		{ name: _('Hangul Jamo Extended-A'),			start: 0xA960, end: 0xA97F }, /*UBLOCK_HANGUL_JAMO_EXTENDED_A=180*/
		{ name: _('Javanese'),					start: 0xA980, end: 0xA9DF }, /*UBLOCK_JAVANESE=181*/
		{ name: _('Myanmar Extended-A'),			start: 0xAA60, end: 0xAA7F }, /*UBLOCK_MYANMAR_EXTENDED_A=182*/
		{ name: _('Tai Viet'),					start: 0xAA80, end: 0xAADF }, /*UBLOCK_TAI_VIET=183*/
		{ name: _('Meetei Mayek'),				start: 0xABC0, end: 0xABFF }, /*UBLOCK_MEETEI_MAYEK=184*/
		{ name: _('Hangul Jamo Extended-B'),			start: 0xD7B0, end: 0xD7FF }, /*UBLOCK_HANGUL_JAMO_EXTENDED_B=185*/
		{ name: _('Imperial Aramaic'),				start: 0x10840, end: 0x1085F }, /*UBLOCK_IMPERIAL_ARAMAIC=186*/
		{ name: _('Old South Arabian'),				start: 0x10A60, end: 0x10A7F }, /*UBLOCK_OLD_SOUTH_ARABIAN=187*/
		{ name: _('Avestan'),					start: 0x10B00, end: 0x10B3F }, /*UBLOCK_AVESTAN=188*/
		{ name: _('Inscriptional Parthian'),			start: 0x10B40, end: 0x10B5F }, /*UBLOCK_INSCRIPTIONAL_PARTHIAN=189*/
		{ name: _('Inscriptional Pahlavi'),			start: 0x10B60, end: 0x10B7F }, /*UBLOCK_INSCRIPTIONAL_PAHLAVI=190*/
		{ name: _('Old Turkic'),				start: 0x10C00, end: 0x10C4F }, /*UBLOCK_OLD_TURKIC=191*/
		{ name: _('Rumi Numeral Symbols'),			start: 0x10E60, end: 0x10E7F }, /*UBLOCK_RUMI_NUMERAL_SYMBOLS=192*/
		{ name: _('Kaithi'),					start: 0x11080, end: 0x110CF }, /*UBLOCK_KAITHI=193*/
		//{ name: _('Egyptian Hieroglyphs'),			start: 0x13000, end: 0x1342F }, /*UBLOCK_EGYPTIAN_HIEROGLYPHS=194*/
		{ name: _('Egyptian Hieroglyphs'),			start: 0x13000, end: 0x130FF }, /*UBLOCK_EGYPTIAN_HIEROGLYPHS=194*/
		{ name: _('Enclosed Alphanumeric Supplement'),		start: 0x1F100, end: 0x1F1FF }, /*UBLOCK_ENCLOSED_ALPHANUMERIC_SUPPLEMENT=195*/
		{ name: _('Enclosed Ideographic Supplement'),		start: 0x1F200, end: 0x1F2FF }, /*UBLOCK_ENCLOSED_IDEOGRAPHIC_SUPPLEMENT=196*/
		//{ name: _('CJK Unified Ideographs Extension C'),	start: 0x2A700, end: 0x2B73F }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_C=197*/
		{ name: _('CJK Unified Ideographs Extension C'),	start: 0x2A700, end: 0x2A7FF }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_C=197*/
		{ name: _('Mandaic'),					start: 0x0840, end: 0x085F }, /*UBLOCK_MANDAIC=198*/
		{ name: _('Batak'),					start: 0x1BC0, end: 0x1BFF }, /*UBLOCK_BATAK=199*/
		{ name: _('Ethiopic Extended-A'),			start: 0xAB00, end: 0xAB2F }, /*UBLOCK_ETHIOPIC_EXTENDED_A=200*/
		{ name: _('Brahmi'),					start: 0x11000, end: 0x1107F }, /*UBLOCK_BRAHMI=201*/
		//{ name: _('Bamum Supplement'),			start: 0x16800, end: 0x16A3F }, /*UBLOCK_BAMUM_SUPPLEMENT=202*/
		{ name: _('Bamum Supplement'),				start: 0x16800, end: 0x1683F }, /*UBLOCK_BAMUM_SUPPLEMENT=202*/
		{ name: _('Kana Supplement'),				start: 0x1B000, end: 0x1B0FF }, /*UBLOCK_KANA_SUPPLEMENT=203*/
		{ name: _('Playing Cards'),				start: 0x1F0A0, end: 0x1F0FF }, /*UBLOCK_PLAYING_CARDS=204*/
		//{ name: _('Miscellaneous Symbols And Pictographs'), 	start: 0x1F300, end: 0x1F5FF }, /*UBLOCK_MISCELLANEOUS_SYMBOLS_AND_PICTOGRAPHS=205*/
		{ name: _('Miscellaneous Symbols And Pictographs'), 	start: 0x1F300, end: 0x1F3FF }, /*UBLOCK_MISCELLANEOUS_SYMBOLS_AND_PICTOGRAPHS=205*/
		{ name: _('Emoticons'),					start: 0x1F600, end: 0x1F64F }, /*UBLOCK_EMOTICONS=206*/
		{ name: _('Transport And Map Symbols'),			start: 0x1F680, end: 0x1F6FF }, /*UBLOCK_TRANSPORT_AND_MAP_SYMBOLS=207*/
		{ name: _('Alchemical Symbols'),			start: 0x1F700, end: 0x1F77F }, /*UBLOCK_ALCHEMICAL_SYMBOLS=208*/
		//{ name: _('CJK Unified Ideographs Extension D'),	start: 0x2B740, end: 0x2B81F }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_D=209*/
		{ name: _('CJK Unified Ideographs Extension D'),	start: 0x2B740, end: 0x2B7FF }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_D=209*/

		{ name: _('Arabic Extended-A'),				start: 0x08A0, end: 0x08FF }, /*UBLOCK_ARABIC_EXTENDED_A=210*/
		{ name: _('Arabic Mathematical Alphabetic Symbols'), 	start: 0x1EE00, end: 0x1EEFF }, /*UBLOCK_ARABIC_MATHEMATICAL_ALPHABETIC_SYMBOLS=211*/
		{ name: _('Chakma'),					start: 0x11100, end: 0x1114F }, /*UBLOCK_CHAKMA=212*/
		{ name: _('Meetei Mayek Extensions'),			start: 0xAAE0, end: 0xAAFF }, /*UBLOCK_MEETEI_MAYEK_EXTENSIONS=213*/
		{ name: _('Meroitic Cursive'),				start: 0x109A0, end: 0x109FF }, /*UBLOCK_MEROITIC_CURSIVE=214*/
		{ name: _('Meroitic Hieroglyphs'),			start: 0x10980, end: 0x1099F }, /*UBLOCK_MEROITIC_HIEROGLYPHS=215*/
		{ name: _('Miao'),					start: 0x16F00, end: 0x16F9F }, /*UBLOCK_MIAO=216*/
		{ name: _('Sharada'),					start: 0x11180, end: 0x111DF }, /*UBLOCK_SHARADA=217*/
		{ name: _('Sora Sompeng'),				start: 0x110D0, end: 0x110FF }, /*UBLOCK_SORA_SOMPENG=218*/
		{ name: _('Sundanese Supplement'),			start: 0x1CC0, end: 0x1CCF }, /*UBLOCK_SUNDANESE_SUPPLEMENT=219*/
		{ name: _('Takri'),					start: 0x11680, end: 0x116CF }, /*UBLOCK_TAKRI=220*/
		{ name: _('Bassa Vah'),					start: 0x16AD0, end: 0x16AFF }, /*UBLOCK_BASSA_VAH=221*/
		{ name: _('Caucasian Albanian'),			start: 0x10530, end: 0x1056F }, /*UBLOCK_CAUCASIAN_ALBANIAN=222*/
		{ name: _('Coptic Epact Numbers'),			start: 0x102E0, end: 0x102FF }, /*UBLOCK_COPTIC_EPACT_NUMBERS=223*/
		{ name: _('Combining Diacritical Marks Extended'),	start: 0x1AB0, end: 0x1AFF }, /*UBLOCK_COMBINING_DIACRITICAL_MARKS_EXTENDED=224*/
		{ name: _('Duployan'),					start: 0x1BC00, end: 0x1BC9F }, /*UBLOCK_DUPLOYAN=225*/
		{ name: _('Elbasan'),					start: 0x10500, end: 0x1052F }, /*UBLOCK_ELBASAN=226*/
		{ name: _('Geometric Shapes Extended'),			start: 0x1F780, end: 0x1F7FF }, /*UBLOCK_GEOMETRIC_SHAPES_EXTENDED=227*/
		{ name: _('Grantha'),					start: 0x11300, end: 0x1137F }, /*UBLOCK_GRANTHA=228*/
		{ name: _('Khojki'),					start: 0x11200, end: 0x1124F }, /*UBLOCK_KHOJKI=229*/
		{ name: _('Khudawadi'),					start: 0x112B0, end: 0x112FF }, /*UBLOCK_KHUDAWADI=230*/
		{ name: _('Latin Extended-E'),				start: 0xAB30, end: 0xAB6F }, /*UBLOCK_LATIN_EXTENDED_E=231*/
		//{ name: _('Linear A'),				start: 0x10600, end: 0x1077F }, /*UBLOCK_LINEAR_A=232*/
		{ name: _('Linear A'),					start: 0x10600, end: 0x106FF }, /*UBLOCK_LINEAR_A=232*/
		{ name: _('Mahajani'),					start: 0x11150, end: 0x1117F }, /*UBLOCK_MAHAJANI=233*/
		{ name: _('Manichaean'),				start: 0x10AC0, end: 0x10AFF }, /*UBLOCK_MANICHAEAN=234*/
		{ name: _('Mende Kikakui'),				start: 0x1E800, end: 0x1E8DF }, /*UBLOCK_MENDE_KIKAKUI=235*/
		{ name: _('Modi'),					start: 0x11600, end: 0x1165F }, /*UBLOCK_MODI=236*/
		{ name: _('Mro'),					start: 0x16A40, end: 0x16A6F }, /*UBLOCK_MRO=237*/
		{ name: _('Myanmar Extended-B'),			start: 0xA9E0, end: 0xA9FF }, /*UBLOCK_MYANMAR_EXTENDED_B=238*/
		{ name: _('Nabataean'),					start: 0x10880, end: 0x108AF }, /*UBLOCK_NABATAEAN=239*/
		{ name: _('Old North Arabian'),				start: 0x10A80, end: 0x10A9F }, /*UBLOCK_OLD_NORTH_ARABIAN=240*/
		{ name: _('Old Permic'),				start: 0x10350, end: 0x1037F }, /*UBLOCK_OLD_PERMIC=241*/
		{ name: _('Ornamental Dingbats'),			start: 0x1F650, end: 0x1F67F }, /*UBLOCK_ORNAMENTAL_DINGBATS=242*/
		{ name: _('Pahawh Hmong'),				start: 0x16B00, end: 0x16B8F }, /*UBLOCK_PAHAWH_HMONG=243*/
		{ name: _('Palmyrene'),					start: 0x10860, end: 0x1087F }, /*UBLOCK_PALMYRENE=244*/
		{ name: _('Pau Cin Hau'),				start: 0x11AC0, end: 0x11AFF }, /*UBLOCK_PAU_CIN_HAU=245*/
		{ name: _('Psalter Pahlavi'),				start: 0x10B80, end: 0x10BAF }, /*UBLOCK_PSALTER_PAHLAVI=246*/
		{ name: _('Shorthand Format Controls'),			start: 0x1BCA0, end: 0x1BCAF }, /*UBLOCK_SHORTHAND_FORMAT_CONTROLS=247*/
		{ name: _('Siddham'),					start: 0x11580, end: 0x115FF }, /*UBLOCK_SIDDHAM=248*/
		{ name: _('Sinhala Archaic Numbers'),			start: 0x111E0, end: 0x111FF }, /*UBLOCK_SINHALA_ARCHAIC_NUMBERS=249*/
		{ name: _('Supplemental Arrows-C'),			start: 0x1F800, end: 0x1F8FF }, /*UBLOCK_SUPPLEMENTAL_ARROWS_C=250*/
		{ name: _('Tirhuta'),					start: 0x11480, end: 0x114DF }, /*UBLOCK_TIRHUTA=251*/
		{ name: _('Warang Citi'),				start: 0x118A0, end: 0x118FF }, /*UBLOCK_WARANG_CITI=252*/
		{ name: _('Ahom'),					start: 0x11700, end: 0x1173F }, /*UBLOCK_AHOM=253*/
		//{ name: _('Anatolian Hieroglyphs'),			start: 0x14400, end: 0x1467F }, /*UBLOCK_ANATOLIAN_HIEROGLYPHS=254*/
		{ name: _('Anatolian Hieroglyphs'),			start: 0x14400, end: 0x144FF }, /*UBLOCK_ANATOLIAN_HIEROGLYPHS=254*/
		{ name: _('Cherokee Supplement'),			start: 0xAB70, end: 0xABBF }, /*UBLOCK_CHEROKEE_SUPPLEMENT=255*/
		{ name: _('CJK Unified Ideographs Extension E'),	start: 0x2B820, end: 0x2CEAF }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_E=256*/
		{ name: _('CJK Unified Ideographs Extension E'),	start: 0x2B820, end: 0x2B8FF }, /*UBLOCK_CJK_UNIFIED_IDEOGRAPHS_EXTENSION_E=256*/
		//{ name: _('Early Dynastic Cuneiform'),		start: 0x12480, end: 0x1254F }, /*UBLOCK_EARLY_DYNASTIC_CUNEIFORM=257*/
		{ name: _('Early Dynastic Cuneiform'),			start: 0x12480, end: 0x124FF }, /*UBLOCK_EARLY_DYNASTIC_CUNEIFORM=257*/
		{ name: _('Hatran'),					start: 0x108E0, end: 0x108FF }, /*UBLOCK_HATRAN=258*/
		{ name: _('Multani'),					start: 0x11280, end: 0x112AF }, /*UBLOCK_MULTANI=259*/
		{ name: _('Old Hungarian'),				start: 0x10C80, end: 0x10CFF }, /*UBLOCK_OLD_HUNGARIAN=260*/
		{ name: _('Supplemental Symbols And Pictographs'),	start: 0x1F900, end: 0x1F9FF }, /*UBLOCK_SUPPLEMENTAL_SYMBOLS_AND_PICTOGRAPHS=261*/
		//{ name: _('Sutton Signwriting'),			start: 0x1D800, end: 0x1DAAF }, /*UBLOCK_SUTTON_SIGNWRITING=262*/
		{ name: _('Sutton Signwriting'),			start: 0x1D800, end: 0x1D8FF }, /*UBLOCK_SUTTON_SIGNWRITING=262*/
	],

	cacheSubset: {},
	cacheGlyph: {},

	fillCharacters: function (index) {
		var start = this.unicodeBlocks[index].start;
		var end = this.unicodeBlocks[index].end;
		var encodedFont = window.encodeURIComponent(this._fontNames.options[this._fontNames.selectedIndex].value);
		var it = 0;
		var tr, td, img, encodedChar;
		L.DomUtil.empty(this._tbody);
		while (start <= end) {
			if (it % 20 === 0) {
				tr = L.DomUtil.create('tr', '', this._tbody);
			}
			td = L.DomUtil.create('td', '', tr);
			encodedChar = window.encodeURIComponent(String.fromCharCode(start));
			if (this.cacheGlyph[encodedFont + encodedChar]) {
				img = this.cacheGlyph[encodedFont + encodedChar];
			} else {
				img = document.createElement('img');
				img.data = start;
				img.src = L.Icon.Default.imagePath + '/loading.gif';
				this.cacheGlyph[encodedFont + encodedChar] = img;
				this._map._socket.sendMessage('renderfont font=' + encodedFont + ' char=' + encodedChar);
			}
			L.DomEvent.on(td, 'click', this._onSymbolClick, this);
			L.DomEvent.on(td, 'dblclick', this._onSymbolDblClick, this);
			td.appendChild(img);
			start++;
			it++;
		}
	},

	fillDropDown: function (element, list, selectedIndex, method, context) {
		L.DomUtil.empty(element);
		for (var iterator = 0, len = list.length, option; iterator < len; iterator++) {
			option = document.createElement('option');
			method.call(context, option, list, iterator);
			element.appendChild(option);
		}
		element.selectedIndex = selectedIndex;
	},

	fillFontNames: function (fontNames, selectedIndex) {
		this.fillDropDown(this._fontNames, fontNames, selectedIndex, function (option, list, iterator) {
			option.innerHTML = list[iterator].innerHTML;
		}, this);
		this._onFontNamesChange();
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this._initLayout();

		map.on('commandvalues', this._onFontSubset, this);
		map.on('renderfont', this._onRenderFontPreview, this);
		return this._container;
	},

	onRemove: function (map) {
		map.off('commandvalues', this._onFontSubset, this);
		map.off('renderfont', this._onRenderFontPreview, this);
	},


	show: function () {
		this._content.setAttribute('style', 'max-height:' + (this._map.getSize().y - 50) + 'px');
		this._container.style.visibility = '';
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-control-layers');
		this._container.style.visibility = 'hidden';
		var closeButton = L.DomUtil.create('a', 'leaflet-popup-close-button', this._container);
		closeButton.href = '#close';
		closeButton.innerHTML = '&#215;';
		L.DomEvent.on(closeButton, 'click', this._onCloseClick, this);
		var wrapper = L.DomUtil.create('div', 'leaflet-popup-content-wrapper', this._container);
		var content = this._content = L.DomUtil.create('div', 'leaflet-popup-content loleaflet-scrolled', wrapper);
		var labelTitle = document.createElement('span');
		labelTitle.innerHTML = '<b>' + _('Special Characters') + '</b>';
		content.appendChild(labelTitle);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		var label = L.DomUtil.create('span', 'loleaflet-controls', content);
		label.innerHTML = '<b>' + _('Font Name:') + '</b>';
		content.appendChild(document.createElement('br'));
		this._fontNames = L.DomUtil.create('select', 'loleaflet-controls', content);
		L.DomEvent.on(this._fontNames, 'change', this._onFontNamesChange, this);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		label = L.DomUtil.create('span', 'loleaflet-controls', content);
		label.innerHTML = '<b>' + _('Subset:') + '</b>';
		content.appendChild(document.createElement('br'));
		this._unicodeSubset = L.DomUtil.create('select', 'loleaflet-controls', content);
		L.DomEvent.on(this._unicodeSubset, 'change', this._onUnicodeSubsetChange, this);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		var table = L.DomUtil.create('table', 'loleaflet-character', content);
		this._tbody = L.DomUtil.create('tbody', '', table);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		label = L.DomUtil.create('span', 'loleaflet-controls', content);
		label.innerHTML = '<b>' + _('Selected Character:') + '</b>';
		this._preview = L.DomUtil.create('img', '', content);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		label = L.DomUtil.create('span', 'loleaflet-controls', content);
		label.innerHTML = '<b>' + _('Hexadecimal:') + '</b>';
		this._hexa = L.DomUtil.create('span', 'loleaflet-controls', content);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		var button = L.DomUtil.create('input', 'loleaflet-controls', content);
		button.type = 'button';
		button.value = _('Insert');
		L.DomEvent.on(button, 'click', this._onInsertClick, this);
		button = L.DomUtil.create('input', 'loleaflet-controls', content);
		button.type = 'button';
		button.value = _('Cancel');
		L.DomEvent.on(button, 'click', this._onCancelClick, this);
	},

	_onCancelClick: function (e) {
		this._onCloseClick(e);
	},

	_onCloseClick: function (e) {
		this._map.enable(true);
		this._refocusOnMap();
		this.remove();
	},

	_onFontNamesChange: function (e) {
		var fontName = this._fontNames.options[this._fontNames.selectedIndex].value;
		if (this.cacheSubset[fontName]) {
			this.fillDropDown(this._unicodeSubset, this.cacheSubset[fontName], 0, function (option, list, iterator) {
				option.tag = list[iterator];
				option.innerHTML = this.unicodeBlocks[list[iterator]].name;
			}, this);
			this._onUnicodeSubsetChange();
		} else {
			this._map._socket.sendMessage('commandvalues command=.uno:FontSubset&name=' +
				window.encodeURIComponent(fontName));
		}
	},

	_onFontSubset : function (e) {
		if (e.commandName === '.uno:FontSubset' && e.commandValues) {
			this.cacheSubset[this._fontNames.options[this._fontNames.selectedIndex].value] = e.commandValues;
			this.fillDropDown(this._unicodeSubset, e.commandValues, 0, function (option, list, iterator) {
				option.tag = list[iterator];
				option.innerHTML = this.unicodeBlocks[list[iterator]].name;
			}, this);
			this._onUnicodeSubsetChange();
		} else {
			L.DomUtil.remove(this._fontNames.options[this._fontNames.selectedIndex]);
			this._onFontNamesChange();
		}
	},

	_onInsertClick: function (e) {
		this._sendSymbol();
		this._onCloseClick(e);
	},

	_onRenderFontPreview: function (e) {
		if (this.cacheGlyph[e.font + e.char]) {
			this.cacheGlyph[e.font + e.char].src = e.img;
		}
	},

	_onSymbolClick: function (e) {
		var target = e.target || e.srcElement;
		var encodedFont = window.encodeURIComponent(this._fontNames.options[this._fontNames.selectedIndex].value);
		var encodedChar = window.encodeURIComponent(String.fromCharCode(target.data));
		this._hexa.data = target.data;
		if (this.cacheGlyph[encodedFont + encodedChar]) {
			this._preview.src = this.cacheGlyph[encodedFont + encodedChar].src;
		} else {
			this._preview.src = L.Icon.Default.imagePath + '/loading.gif';
		}
		this._hexa.innerHTML = 'U+' + this._hexa.data.toString(16).toUpperCase();
	},

	_onSymbolDblClick: function (e) {
		var target = e.target || e.srcElement;
		this._hexa.data = target.data;
		this._sendSymbol();
		setTimeout(L.bind(function () {
			this._onCloseClick();
		}, this), 0);
	},

	_sendSymbol: function () {
		if (this._hexa.data) {
			var command = {
				Symbols: {
					type: 'string',
					value: String.fromCharCode(this._hexa.data)
				},
				FontName: {
					type: 'string',
					value: this._fontNames.options[this._fontNames.selectedIndex].value
				}
			};
			this._map.sendUnoCommand('.uno:InsertSymbol', command);
		}
	},

	_onUnicodeSubsetChange: function (e) {
		this.fillCharacters(this._unicodeSubset.options[this._unicodeSubset.selectedIndex].tag);
	}
});

L.control.characterMap = function (options) {
	return new L.Control.CharacterMap(options);
};


/*
* Control.ContextMenu
*/

/* global $ map _ */
L.Control.ContextMenu = L.Control.extend({
	options: {
		SEPARATOR: '---------',
		/*
		 * Enter UNO commands that should appear in the context menu.
		 * Entering a UNO command under `general' would enable it for all types
		 * of documents. If you do not want that, whitelist it in document specific filter.
		 */
		whitelist: {
			/*
			 * UNO commands for menus are not available sometimes. Presence of Menu commands
			 * in following list is just for reference and ease of locating uno command
			 * from context menu structure.
			 */
			general: ['Cut', 'Copy', 'Paste', 'PasteSpecialMenu', 'PasteUnformatted',
					  'NumberingStart', 'ContinueNumbering', 'IncrementLevel', 'DecrementLevel',
					  'OpenHyperlinkOnCursor', 'CopyHyperlinkLocation', 'RemoveHyperlink',
					  'AnchorMenu', 'SetAnchorToPage', 'SetAnchorToPara', 'SetAnchorAtChar',
					  'SetAnchorToChar', 'SetAnchorToFrame',
					  'WrapMenu', 'WrapOff', 'WrapOn', 'WrapIdeal', 'WrapLeft', 'WrapRight', 'WrapThrough',
					  'WrapThroughTransparent', 'WrapContour', 'WrapAnchorOnly',
					  'ArrangeFrameMenu', 'ArrangeMenu', 'BringToFront', 'ObjectForwardOne', 'ObjectBackOne', 'SendToBack',
					  'RotateMenu', 'RotateLeft', 'RotateRight'],

			text: ['TableInsertMenu',
				   'InsertRowsBefore', 'InsertRowsAfter', 'InsertColumnsBefore', 'InsertColumnsAfter',
				   'TableDeleteMenu',
				   'DeleteRows', 'DeleteColumns', 'DeleteTable',
				   'MergeCells', 'SetOptimalColumnWidth', 'SetOptimalRowWidth',
				   'UpdateCurIndex','RemoveTableOf',
				   'ReplyComment', 'DeleteComment', 'DeleteAuthor', 'DeleteAllNotes'],

			spreadsheet: ['MergeCells', 'SplitCells', 'RecalcPivotTable'],

			presentation: [],
			drawing: []
		}
	},



	onAdd: function (map) {
		this._prevMousePos = null;

		map.on('locontextmenu', this._onContextMenu, this);
		map.on('mousedown', this._onMouseDown, this);
		map.on('keydown', this._onKeyDown, this);
	},

	_onMouseDown: function(e) {
		this._prevMousePos = {x: e.originalEvent.pageX, y: e.originalEvent.pageY};

		$.contextMenu('destroy', '.leaflet-layer');
	},

	_onKeyDown: function(e) {
		if (e.originalEvent.keyCode === 27 /* ESC */) {
			$.contextMenu('destroy', '.leaflet-layer');
		}
	},

	_onContextMenu: function(obj) {
		if (map._permission !== 'edit') {
			return;
		}

		var contextMenu = this._createContextMenuStructure(obj);
		$.contextMenu({
			selector: '.leaflet-layer',
			className: 'loleaflet-font',
			trigger: 'none',
			build: function() {
				return {
					callback: function(key) {
						map.sendUnoCommand(key);
						// Give the stolen focus back to map
						map.focus();
					},
					items: contextMenu
				};
			}
		});

		$('.leaflet-layer').contextMenu(this._prevMousePos);
	},

	_createContextMenuStructure: function(obj) {
		var docType = map.getDocType();
		var contextMenu = {};
		var sepIdx = 1, itemName;
		var isLastItemText = false;
		for (var idx in obj.menu) {
			var item = obj.menu[idx];
			if (item.enabled === 'false') {
				continue;
			}

			if (item.type === 'separator') {
				if (isLastItemText) {
					contextMenu['sep' + sepIdx++] = this.options.SEPARATOR;
				}
				isLastItemText = false;
			}
			else if (item.type === 'command') {
				// Only show whitelisted items
				// Command name (excluding '.uno:') starts from index = 5
				var commandName = item.command.substring(5);
				if (this.options.whitelist.general.indexOf(commandName) === -1 &&
					!(docType === 'text' && this.options.whitelist.text.indexOf(commandName) !== -1) &&
					!(docType === 'spreadsheet' && this.options.whitelist.spreadsheet.indexOf(commandName) !== -1) &&
					!(docType === 'presentation' && this.options.whitelist.presentation.indexOf(commandName) !== -1) &&
					!(docType === 'drawing' && this.options.whitelist.drawing.indexOf(commandName) !== -1)) {
					continue;
				}

				itemName = item.text.replace('~', '');
				itemName = itemName.replace('Â°', '°'); // bccu#1813 double encoding in cp-5.0 branch only
				if (commandName === 'DeleteAuthor') {
					// In some versions of libreoffice, context menu callback returns 'Delete All Comments by $1'
					// while in some it returns the actual username replacing $1.
					// Also, the translations in LO core are for 'Delete All Comments by This Author'
					// Lets use the later for simplicity and to leverage the core translations in online
					itemName = itemName.replace(itemName.substring('Delete All Comments by '.length), 'This Author');
				}

				switch (commandName) {
				case 'Cut':
					itemName = _('Internal Cut');
					break;
				case 'Copy':
					itemName = _('Internal Copy');
					break;
				case 'Paste':
					itemName = _('Internal Paste');
					break;
				}

				contextMenu[item.command] = {
					name: _(itemName)
				};

				if (item.checktype === 'checkmark') {
					if (item.checked === 'true') {
						contextMenu[item.command]['icon'] = 'lo-checkmark';
					}
				} else if (item.checktype === 'radio') {
					if (item.checked === 'true') {
						contextMenu[item.command]['icon'] = 'radio';
					}
				}

				isLastItemText = true;
			} else if (item.type === 'menu') {
				itemName = item.text.replace('~', '');
				if (itemName === 'Paste Special') {
					itemName = _('Internal Paste Special');
				}
				var submenu = this._createContextMenuStructure(item);
				// ignore submenus with all items disabled
				if (Object.keys(submenu).length === 0) {
					continue;
				}

				contextMenu[item.command] = {
					name: _(itemName),
					items: submenu
				};
				isLastItemText = true;
			}
		}

		// Remove separator, if present, at the end
		var lastItem = Object.keys(contextMenu)[Object.keys(contextMenu).length - 1];
		if (lastItem !== undefined && lastItem.startsWith('sep')) {
			delete contextMenu[lastItem];
		}

		return contextMenu;
	}
});

L.control.contextMenu = function (options) {
	return new L.Control.ContextMenu(options);
};


/*
* Control.Menubar
*/

/* global $ _ map title vex revHistoryEnabled closebutton L */
L.Control.Menubar = L.Control.extend({
	// TODO: Some mechanism to stop the need to copy duplicate menus (eg. Help)
	options: {
		text:  [
			{name: _('File'), id: 'file', type: 'menu', menu: [
				{name: _('Save'), id: 'save', type: 'action'},
				{name: _('Print'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: _('Download as'), id: 'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
					{name: _('ODF text document (.odt)'), id: 'downloadas-odt', type: 'action'},
					{name: _('Microsoft Word 2003 (.doc)'), id: 'downloadas-doc', type: 'action'},
					{name: _('Microsoft Word (.docx)'), id: 'downloadas-docx', type: 'action'}]}]
			},
			{name: _('Edit'), type: 'menu', menu: [
				{name: _('Repair'), id: 'repair',  type: 'action'},
				{name: _('Undo'), type: 'unocommand', uno: '.uno:Undo'},
				{name: _('Redo'), type: 'unocommand', uno: '.uno:Redo'},
				{type: 'separator'},
				{name: _('Cut'), type: 'unocommand', uno: '.uno:Cut'},
				{name: _('Copy'), type: 'unocommand', uno: '.uno:Copy'},
				{name: _('Paste'), type: 'unocommand', uno: '.uno:Paste'},
				{name: _('Select all'), type: 'unocommand', uno: '.uno:SelectAll'},
				{type: 'separator'},
				{name: _('Find & Replace'), id: 'findandreplace', type: 'action'},
				{type: 'separator'},
				{name: _('Track Changes'), type: 'menu', menu: [
					{name: _('Record'), type: 'unocommand', uno: '.uno:TrackChanges'},
					{name: _('Show'), type: 'unocommand', uno: '.uno:ShowTrackedChanges'},
					{type: 'separator'},
					{name: _('Previous'), type: 'unocommand', uno: '.uno:PreviousTrackedChange'},
					{name: _('Next'), type: 'unocommand', uno: '.uno:NextTrackedChange'}
				]}
			]},
			{name: _('View'), id: 'view', type: 'menu', menu: [
				{name: _('Full screen'), id: 'fullscreen', type: 'action'},
				{type: 'separator'},
				{name: _('Zoom in'), id: 'zoomin', type: 'action'},
				{name: _('Zoom out'), id: 'zoomout', type: 'action'},
				{name: _('Reset zoom'), id: 'zoomreset', type: 'action'},
				{type: 'separator'},
				{name: _('Formatting Marks'), type: 'unocommand', uno: '.uno:ControlCodes'},
			]
			},
			{name: _('Insert'), type: 'menu', menu: [
				{name: _('Image'), id: 'insertgraphic', type: 'action'},
				{name: _('Comment...'), id: 'insertcomment', type: 'action'},
				{type: 'separator'},
				{name: _('Footnote'), type: 'unocommand', uno: '.uno:InsertFootnote'},
				{name: _('Endnote'), type: 'unocommand', uno: '.uno:InsertEndnote'},
				{type: 'separator'},
				{name: _('Page break'), type: 'unocommand', uno: '.uno:InsertPageBreak'},
				{name: _('Column break'), type: 'unocommand', uno: '.uno:InsertColumnBreak'},
				{type: 'separator'},
				{name: _('Special character...'), id: 'specialcharacter', type: 'action'},
				{name: _('Formatting mark'), type: 'menu', menu: [
					{name: _('Non-breaking space'), type: 'unocommand', uno: '.uno:InsertNonBreakingSpace'},
					{name: _('Non-breaking hyphen'), type: 'unocommand', uno: '.uno:InsertHardHyphen'},
					{name: _('Soft hyphen'), type: 'unocommand', uno: '.uno:InsertSoftHyphen'},
					{name: _('No-width optional break'), type: 'unocommand', uno: '.uno:InsertZWSP'},
					{name: _('No-width no break'), type: 'unocommand', uno: '.uno:InsertZWNBSP'},
					{name: _('Left-to-right mark'), type: 'unocommand', uno: '.uno:InsertLRM'},
					{name: _('Right-to-left mark'), type: 'unocommand', uno: '.uno:InsertRLM'}]}]
			},
			{name: _('Format'), type: 'menu', menu: [
				{name: _('Text'), type: 'menu', menu: [
					{name: _('Bold'), type: 'unocommand', uno: '.uno:Bold'},
					{name: _('Italic'), type: 'unocommand', uno: '.uno:Italic'},
					{name: _('Underline'), type: 'unocommand', uno: '.uno:Underline'},
					{name: _('Double underline'), type: 'unocommand', uno: '.uno:UnderlineDouble'},
					{name: _('Strikethrough'), type: 'unocommand', uno: '.uno:Strikeout'},
					{name: _('Overline'), type: 'unocommand', uno: '.uno:Overline'},
					{type: 'separator'},
					{name: _('Superscript'), type: 'unocommand', uno: '.uno:SuperScript'},
					{name: _('Subscript'), type: 'unocommand', uno: '.uno:SubScript'},
					{name: _('ꜱᴍᴀʟʟ ᴄᴀᴘꜱ'), type: 'unocommand', uno: '.uno:SmallCaps'},
					{type: 'separator'},
					{name: _('Shadow'), type: 'unocommand', uno: '.uno:Shadowed'},
					{name: _('Outline'), type: 'unocommand', uno: '.uno:OutlineFont'},
					{type: 'separator'},
					{name: _('Increase size'), type: 'unocommand', uno: '.uno:Grow'},
					{name: _('Decrease size'), type: 'unocommand', uno: '.uno:Shrink'},
					{type: 'separator'},
					{name: _('UPPERCASE'), type: 'unocommand', uno: '.uno:ChangeCaseToUpper'},
					{name: _('lowercase'), type: 'unocommand', uno: '.uno:ChangeCaseToLower'},
					{name: _('Cycle case'), type: 'unocommand', uno: '.uno:ChangeCaseRotateCase'},
					{type: 'separator'},
					{name: _('Sentence case'), type: 'unocommand', uno: '.uno:ChangeCaseToSentenceCase'},
					{name: _('Capitalize Every Word'), type: 'unocommand', uno: '.uno:ChangeCaseToTitleCase'},
					{name: _('tOGGLE cASE'), type: 'unocommand', uno: '.uno:ChangeCaseToToggleCase'}]},
				{name: _('Text orientation'), type: 'menu', menu: [
					{name: _('Set paragraph left-to-right'), type: 'unocommand', uno: '.uno:ParaLeftToRight'},
					{name: _('Set paragraph right-to-left'), type: 'unocommand', uno: '.uno:ParaRightToLeft'}]},
				{name: _('Spacing'), type: 'menu', menu: [
					{name: _('Line spacing: 1'), type: 'unocommand', uno: '.uno:SpacePara1'},
					{name: _('Line spacing: 1.5'), type: 'unocommand', uno: '.uno:SpacePara15'},
					{name: _('Line spacing: 2'), type: 'unocommand', uno: '.uno:SpacePara2'},
					{type: 'separator'},
					{name: _('Increase paragraph spacing'), type: 'unocommand', uno: '.uno:ParaspaceIncrease'},
					{name: _('Decrease paragraph spacing'), type: 'unocommand', uno: '.uno:ParaspaceDecrease'},
					{type: 'separator'},
					{name: _('Increase indent'), type: 'unocommand', uno: '.uno:IncrementIndent'},
					{name: _('Decrease indent'), type: 'unocommand', uno: '.uno:DecrementIndent'}]},
				{name: _('Align'), type: 'menu', menu: [
					{name: _('Left'), type: 'unocommand', uno: '.uno:CommonAlignLeft'},
					{name: _('Centered'), type: 'unocommand', uno: '.uno:CommonAlignHorizontalCenter'},
					{name: _('Right'), type: 'unocommand', uno: '.uno:CommonAlignRight'},
					{name: _('Justified'), type: 'unocommand', uno: '.uno:CommonAlignJustified'},
					{type: 'separator'},
					{name: _('Top'), type: 'unocommand', uno: '.uno:CommonAlignTop'},
					{name: _('Center'), type: 'unocommand', uno: '.uno:CommonAlignVerticalcenter'},
					{name: _('Bottom'), type: 'unocommand', uno: '.uno:CommonAlignBottom'}]},
				{name: _('Lists'), type: 'menu', menu: [
					{name: _('Bullets on/off'), type: 'unocommand', uno: '.uno:DefaultBullet'},
					{name: _('Numbering on/off'), type: 'unocommand', uno: '.uno:DefaultNumbering'},
					{type: 'separator'},
					{name: _('Demote one level'), type: 'unocommand', uno: '.uno:DecrementLevel'},
					{name: _('Promote one level'), type: 'unocommand', uno: '.uno:IncrementLevel'},
					{name: _('Demote one level with subpoints'), type: 'unocommand', uno: '.uno:DecrementSublevels'},
					{name: _('Promote one level with subpoints'), type: 'unocommand', uno: '.uno:IncrementSubLevels'},
					{type: 'separator'},
					{name: _('Move down'), type: 'unocommand', uno: '.uno:MoveDown'},
					{name: _('Move up'), type: 'unocommand', uno: '.uno:MoveUp'},
					{name: _('Move down with subpoints'), type: 'unocommand', uno: '.uno:MoveDownSubItems'},
					{name: _('Move up with subpoints'), type: 'unocommand', uno: '.uno:MoveUpSubItems'},
					{type: 'separator'},
					{name: _('Insert unnumbered entry'), type: 'unocommand', uno: '.uno:InsertNeutralParagraph'},
					{name: _('Restart numbering'), type: 'unocommand', uno: '.uno:NumberingStart'},
					{type: 'separator'},
					{name: _('To next paragraph in level'), type: 'unocommand', uno: '.uno:JumpDownThisLevel'},
					{name: _('To previous paragraph in level'), type: 'unocommand', uno: '.uno:JumpUpThisLevel'},
					{name: _('Continue previous numbering'), type: 'unocommand', uno: '.uno:ContinueNumbering'}]},
				{name: _('Clear direct formatting'), type: 'unocommand', uno: '.uno:ResetAttributes'},
				{name: _('Page'), type: 'menu', menu: [
					{name: 'A4, ' + _('Portrait'), type: 'action', id: 'a4portrait'},
					{name: 'A4, ' + _('Landscape'), type: 'action', id: 'a4landscape'},
					{name: 'A5, ' + _('Portrait'), type: 'action', id: 'a5portrait'},
					{name: 'A5, ' + _('Landscape'), type: 'action', id: 'a5landscape'},
					{name: 'Letter, ' + _('Portrait'), type: 'action', id: 'letterportrait'},
					{name: 'Letter, ' + _('Landscape'), type: 'action', id: 'letterlandscape'},
					{name: 'Legal, ' + _('Portrait'), type: 'action', id: 'legalportrait'},
					{name: 'Legal, ' + _('Landscape'), type: 'action', id: 'legallandscape'}]}]
			},
			{name: _('Tables'), type: 'menu', menu: [
				{name: _('Insert'), type: 'menu', menu: [
					{name: _('Rows before'), type: 'unocommand', uno: '.uno:InsertRowsBefore'},
					{name: _('Rows after'), type: 'unocommand', uno: '.uno:InsertRowsAfter'},
					{type: 'separator'},
					{name: _('Columns left'), type: 'unocommand', uno: '.uno:InsertColumnsBefore'},
					{name: _('Columns right'), type: 'unocommand', uno: '.uno:InsertColumnsAfter'}]},
				{name: _('Delete'), type: 'menu', menu: [
					{name: _('Rows'), type: 'unocommand', uno: '.uno:DeleteRows'},
					{name: _('Columns'), type: 'unocommand', uno: '.uno:DeleteColumns'},
					{name: _('Table'), type: 'unocommand', uno: '.uno:DeleteTable'}]},
				{name: _('Select'), type: 'menu', menu: [
					{name: _('Table'), type: 'unocommand', uno: '.uno:SelectTable'},
					{name: _('Row'), type: 'unocommand', uno: '.uno:EntireRow'},
					{name: _('Column'), type: 'unocommand', uno: '.uno:EntireColumn'},
					{name: _('Cell'), type: 'unocommand', uno: '.uno:EntireCell'}]},
					{name: _('Merge cells'), type: 'unocommand', uno: '.uno:MergeCells'}]
			},
			{name: _('Help'), id: 'help', type: 'menu', menu: [
				{name: _('Keyboard shortcuts'), id: 'keyboard-shortcuts', type: 'action'},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Close document'), id: 'closedocument', type: 'action'}
		],

		presentation: [
			{name: _('File'), id: 'file', type: 'menu', menu: [
				{name: _('Save'), id: 'save', type: 'action'},
				{name: _('Print'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: _('Download as'), id: 'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
					{name: _('ODF presentation (.odp)'), id: 'downloadas-odp', type: 'action'},
					{name: _('Microsoft Powerpoint 2003 (.ppt)'), id: 'downloadas-ppt', type: 'action'},
					{name: _('Microsoft Powerpoint (.pptx)'), id: 'downloadas-pptx', type: 'action'}]}]
			},
			{name: _('Edit'), type: 'menu', menu: [
				{name: _('Undo'), type: 'unocommand', uno: '.uno:Undo'},
				{name: _('Redo'), type: 'unocommand', uno: '.uno:Redo'},
				{type: 'separator'},
				{name: _('Cut'), type: 'unocommand', uno: '.uno:Cut'},
				{name: _('Copy'), type: 'unocommand', uno: '.uno:Copy'},
				{name: _('Paste'), type: 'unocommand', uno: '.uno:Paste'},
				{name: _('Select all'), type: 'unocommand', uno: '.uno:SelectAll'},
				{type: 'separator'},
				{name: _('Find & Replace'), id: 'findandreplace', type: 'action'}]
			},
			{name: _('View'), id: 'view', type: 'menu', menu: [
				{name: _('Full screen'), id: 'fullscreen', type: 'action'},
				{type: 'separator'},
				{name: _('Zoom in'), id: 'zoomin', type: 'action'},
				{name: _('Zoom out'), id: 'zoomout', type: 'action'},
				{name: _('Reset zoom'), id: 'zoomreset', type: 'action'}]
			},
			{name: _('Insert'), type: 'menu', menu: [
				{name: _('Image'), id: 'insertgraphic', type: 'action'},
				{name: _('Comment...'), id: 'insertcomment', type: 'action'},
				{type: 'separator'},
				{name: _('Special character...'), id: 'specialcharacter', type: 'action'}]
			},
			{name: _('Tables'), type: 'menu', menu: [
				{name: _('Insert'), type: 'menu', menu: [
					{name: _('Rows before'), type: 'unocommand', uno: '.uno:InsertRowsBefore'},
					{name: _('Rows after'), type: 'unocommand', uno: '.uno:InsertRowsAfter'},
					{type: 'separator'},
					{name: _('Columns left'), type: 'unocommand', uno: '.uno:InsertColumnsBefore'},
					{name: _('Columns right'), type: 'unocommand', uno: '.uno:InsertColumnsAfter'}]},
				{name: _('Delete'), type: 'menu', menu: [
					{name: _('Rows'), type: 'unocommand', uno: '.uno:DeleteRows'},
					{name: _('Columns'), type: 'unocommand', uno: '.uno:DeleteColumns'}]},
				{name: _('Merge cells'), type: 'unocommand', uno: '.uno:MergeCells'}]
			},
			{name: _('Slide'), type: 'menu', menu: [
				{name: _('New slide'), id: 'insertpage', type: 'action'},
				{name: _('Duplicate slide'), id: 'duplicatepage', type: 'action'},
				{name: _('Delete slide'), id: 'deletepage', type: 'action'},
				{type: 'separator'},
				{name: _('Fullscreen presentation'), id: 'fullscreen-presentation', type: 'action'}]
			},
			{name: _('Help'), id: 'help', type: 'menu', menu: [
				{name: _('Keyboard shortcuts'), id: 'keyboard-shortcuts', type: 'action'},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Close document'), id: 'closedocument', type: 'action'}
		],

		spreadsheet: [
			{name: _('File'), id: 'file', type: 'menu', menu: [
				{name: _('Save'), id: 'save', type: 'action'},
				{name: _('Print'), id: 'print', type: 'action'},
				{name: _('See revision history'), id: 'rev-history', type: 'action'},
				{name: _('Download as'), id:'downloadas', type: 'menu', menu: [
					{name: _('PDF Document (.pdf)'), id: 'downloadas-pdf', type: 'action'},
					{name: _('ODF spreadsheet (.ods)'), id: 'downloadas-ods', type: 'action'},
					{name: _('Microsoft Excel 2003 (.xls)'), id: 'downloadas-xls', type: 'action'},
					{name: _('Microsoft Excel (.xlsx)'), id: 'downloadas-xlsx', type: 'action'}]}]
			},
			{name: _('Edit'), type: 'menu', menu: [
				{name: _('Undo'), type: 'unocommand', uno: '.uno:Undo'},
				{name: _('Redo'), type: 'unocommand', uno: '.uno:Redo'},
				{type: 'separator'},
				{name: _('Cut'), type: 'unocommand', uno: '.uno:Cut'},
				{name: _('Copy'), type: 'unocommand', uno: '.uno:Copy'},
				{name: _('Paste'), type: 'unocommand', uno: '.uno:Paste'},
				{name: _('Select all'), type: 'unocommand', uno: '.uno:SelectAll'},
				{type: 'separator'},
				{name: _('Find & Replace'), id: 'findandreplace', type: 'action'}]
			},
			{name: _('View'), id: 'view', type: 'menu', menu: [
				{name: _('Full screen'), id: 'fullscreen', type: 'action'}]
			},
			{name: _('Insert'), type: 'menu', menu: [
				{name: _('Image'), id: 'insertgraphic', type: 'action'},
				{name: _('Comment...'), id: 'insertcomment', type: 'action'},
				{type: 'separator'},
				{name: _('Row'), type: 'unocommand', uno: '.uno:InsertRows'},
				{name: _('Column'), type: 'unocommand', uno: '.uno:InsertColumns'},
				{type: 'separator'},
				{name: _('Special character...'), id: 'specialcharacter', type: 'action'}]
			},
			{name: _('Cells'), type: 'menu', menu: [
				{name: _('Insert row'), type: 'unocommand', uno: '.uno:InsertRows'},
				{name: _('Insert column'), type: 'unocommand', uno: '.uno:InsertColumns'},
				{type: 'separator'},
				{name: _('Delete row'), type: 'unocommand', uno: '.uno:DeleteRows'},
				{name: _('Delete column'), type: 'unocommand', uno: '.uno:DeleteColumns'}]
			},
			{name: _('Help'), id: 'help', type: 'menu', menu: [
				{name: _('Keyboard shortcuts'), id: 'keyboard-shortcuts', type: 'action'},
				{name: _('About'), id: 'about', type: 'action'}]
			},
			{name: _('Close document'), id: 'closedocument', type: 'action'}
		],

		commandStates: {},

		// Only these menu options will be visible in readonly mode
		allowedReadonlyMenus: ['file', 'downloadas', 'view', 'help'],

		allowedViewModeActions: [
			'downloadas-pdf', 'downloadas-odt', 'downloadas-doc', 'downloadas-docx', // file menu
			'downloadas-odp', 'downloadas-ppt', 'downloadas-pptx', // file menu
			'downloadas-ods', 'downloadas-xls', 'downloadas-xlsx', // file menu
			'fullscreen', 'zoomin', 'zoomout', 'zoomreset', // view menu
			'about', 'keyboard-shortcuts' // help menu
		]
	},

	onAdd: function (map) {
		this._initialized = false;
		this._menubarCont = L.DomUtil.get('main-menu');

		map.on('doclayerinit', this._onDocLayerInit, this);
		map.on('addmenu', this._addMenu, this);
	},

	_addMenu: function(e) {
		var alreadyExists = L.DomUtil.get('menu-' + e.id);
		if (alreadyExists)
			return;

		var liItem = L.DomUtil.create('li', '');
		liItem.id = 'menu-' + e.id;
		if (map._permission === 'readonly') {
			L.DomUtil.addClass(liItem, 'readonly');
		}
		var aItem = L.DomUtil.create('a', '', liItem);
		$(aItem).text(e.label);
		$(aItem).data('id', e.id);
		$(aItem).data('type', 'action');
		$(aItem).data('postmessage', 'true');
		this._menubarCont.insertBefore(liItem, this._menubarCont.firstChild);
	},

	_onDocLayerInit: function() {
		// Add document specific menu
		var docType = this._map.getDocType();
		if (docType === 'text') {
			this._initializeMenu(this.options.text);
		} else if (docType === 'spreadsheet') {
			this._initializeMenu(this.options.spreadsheet);
		} else if (docType === 'presentation' || docType === 'drawing') {
			this._initializeMenu(this.options.presentation);
		}

		// initialize menubar plugin
		$('#main-menu').smartmenus({
			hideOnClick: true,
			showOnClick: true,
			hideTimeout: 0,
			hideDuration: 0,
			showDuration: 0,
			showTimeout: 0,
			collapsibleHideDuration: 0,
			subIndicatorsPos: 'append',
			subIndicatorsText: '&#8250;'
		});
		$('#main-menu').attr('tabindex', 0);

		$('#main-menu').bind('select.smapi', {self: this}, this._onItemSelected);
		$('#main-menu').bind('beforeshow.smapi', {self: this}, this._beforeShow);
		$('#main-menu').bind('click.smapi', {self: this}, this._onClicked);

		// SmartMenus mobile menu toggle button
		$(function() {
			var $mainMenuState = $('#main-menu-state');
			if ($mainMenuState.length) {
				// animate mobile menu
				$mainMenuState.change(function(e) {
					var $menu = $('#main-menu');
					if (this.checked) {
						$menu.hide().slideDown(250, function() { $menu.css('display', ''); });
					} else {
						$menu.show().slideUp(250, function() { $menu.css('display', ''); });
					}
				});
				// hide mobile menu beforeunload
				$(window).bind('beforeunload unload', function() {
					if ($mainMenuState[0].checked) {
						$mainMenuState[0].click();
					}
				});
			}
		});

		this._initialized = true;
	},

	_onClicked: function(e, menu) {
		if ($(menu).hasClass('highlighted')) {
			$('#main-menu').smartmenus('menuHideAll');
		}

		var $mainMenuState = $('#main-menu-state');
		if (!$(menu).hasClass('has-submenu') && $mainMenuState[0].checked) {
			$mainMenuState[0].click();
		}
	},

	_beforeShow: function(e, menu) {
		var self = e.data.self;
		var items = $(menu).children().children('a').not('.has-submenu');
		$(items).each(function() {
			var aItem = this;
			var type = $(aItem).data('type');
			var id = $(aItem).data('id');
			if (map._permission === 'edit') {
				if (type === 'unocommand') { // enable all depending on stored commandStates
					var unoCommand = $(aItem).data('uno');
					if (map['stateChangeHandler'].getItemValue(unoCommand) === 'disabled') {
						$(aItem).addClass('disabled');
					} else {
						$(aItem).removeClass('disabled');
					}

					if (map['stateChangeHandler'].getItemValue(unoCommand) === 'true') {
						$(aItem).addClass('lo-menu-item-checked');
					} else {
						$(aItem).removeClass('lo-menu-item-checked');
					}
				} else if (type === 'action') { // enable all except fullscreen on windows
					if (id === 'fullscreen' && (L.Browser.ie || L.Browser.edge)) { // Full screen works weirdly on IE 11 and on Edge
						$(aItem).addClass('disabled');
						var index = self.options.allowedViewModeActions.indexOf('fullscreen');
						if (index > 0) {
							self.options.allowedViewModeActions.splice(index, 1);
						}
					} else {
						$(aItem).removeClass('disabled');
					}
				}
			} else { // eslint-disable-next-line no-lonely-if
				if (type === 'unocommand') { // disable all uno commands
					$(aItem).addClass('disabled');
				} else if (type === 'action') { // disable all except allowedViewModeActions
					var found = false;
					for (var i in self.options.allowedViewModeActions) {
						if (self.options.allowedViewModeActions[i] === id) {
							found = true;
							break;
						}
					}
					if (!found) {
						$(aItem).addClass('disabled');
					} else {
						$(aItem).removeClass('disabled');
					}
				}
			}
		});
	},

	_onClickFindAndReplace: function() {
		var findReplaceContent =
		    '\
			<table class="findreplacetable">\
				<tr>\
					<td>\
						<label for="findthis">Find</label>\
					</td>\
					<td>\
						<input id="findthis" name="findthis">\
					</td>\
				</tr>\
				<tr>\
					<td>\
						<label for="replacewith">Replace with</label>\
					</td>\
					<td>\
						<input name="replacewith">\
					</td>\
				</tr>\
			</table>\
			';
		var mouseMoveFunc;
		vex.dialog.open({
			showCloseButton: true,
			escapeButtonCloses: true,
			className: 'vex-theme-plain findReplaceVex',
			message: _('Find & Replace'),
			input: findReplaceContent,
			buttons: [
				$.extend({}, vex.dialog.buttons.replace, {
					text: _('Replace'),
					click: function($vexContent, e) {
						$vexContent.data().vex.option = 'replace';
					}}),
				$.extend({}, vex.dialog.buttons.replaceAll, {
					text: _('Replace All'),
					click: function($vexContent, e) {
						$vexContent.data().vex.option = 'replaceAll';
					}}),
				$.extend({}, vex.dialog.buttons.findPrev, {
					text: _('Previous'),
					className: 'btnArrow',
					click: function($vexContent, e) {
						$vexContent.data().vex.option = 'previous';
					}}),
				$.extend({}, vex.dialog.buttons.findNext, {
					text: _('Next'),
					className: 'btnArrow',
					click: function($vexContent, e) {
						$vexContent.data().vex.option = 'next';
					}})
			],
			afterOpen: function(e) {
				$('.vex-overlay').remove();
				$('.vex').css('position', 'static');
				var selected = null;
				var xPos = 0, yPos = 0;
				var xElem = 0, yElem = 0;
				var maxH = window.innerHeight, maxW = window.innerWidth;

				$('#findthis').on('input', function() {
					if (this.value.length != 0) {
						map.search(this.value, false, '', 0, true);
					}
				});
				$('.vex-content').on('mousedown', function(e) {
					selected = this;
					selected.style.cursor = 'move';
					xElem = xPos - selected.offsetLeft;
					yElem = yPos - selected.offsetTop;
				});
				$('.vex-content').on('mouseup', function(e) {
					selected.style.cursor = 'default';
					selected = null;
				});
				var mouseMoveFunc = function(e) {
					xPos = e.pageX;
					yPos = e.pageY;
					if (selected !== null) {
						var isOutVert = (yPos - yElem >= 0 && (yPos - yElem + selected.offsetHeight) <= maxH);
						var isOutHor = (xPos - xElem >= 0 && (xPos - xElem + selected.offsetWidth) <= maxW);
						if (isOutHor) {
							selected.style.left = (xPos - xElem) + 'px';
						}
						if (isOutVert) {
							selected.style.top = (yPos - yElem) + 'px';
						}
					}
				};
				$(document).on('mousemove', mouseMoveFunc);
			},
			afterClose: function(e) {
				$(document).off('mousemove', mouseMoveFunc);
			},
			onSubmit: function(event) {
				var $vexContent = $(this).parent();
				event.preventDefault();
				event.stopPropagation();

				var opt = $vexContent.data().vex.option;
				var findText = this.findthis.value;
				var replaceText = this.replacewith.value;

				if (findText.length != 0) {
					if (opt === 'next') {
						map.search(findText);
					}
					else if (opt === 'previous') {
						map.search(findText, true);
					}
					else if (opt === 'replace') {
						map.search(findText, false, replaceText, 2);
					}
					else if (opt === 'replaceAll') {
						map.search(findText, false, replaceText, 3);
					}
				}
			}
		}, this);
	},

	_executeAction: function(item) {
		var id = $(item).data('id');
		if (id === 'save') {
			map.save(true, true);
		} else if (id === 'print') {
			map.print();
		} else if (id.startsWith('downloadas-')) {
			var format = id.substring('downloadas-'.length);
			// remove the extension if any
			var fileName = title.substr(0, title.lastIndexOf('.')) || title;
			// check if it is empty
			fileName = fileName === '' ? 'document' : fileName;
			map.downloadAs(fileName + '.' + format, format);
		} else if (id === 'findandreplace') {
			this._onClickFindAndReplace();
		} else if (id === 'insertcomment') {
			map.insertComment();
		} else if (id === 'insertgraphic') {
			L.DomUtil.get('insertgraphic').click();
		} else if (id === 'specialcharacter') {
			var fontList = $('.fonts-select option');
			var selectedIndex = $('.fonts-select').prop('selectedIndex');
			map._docLayer._onSpecialChar(fontList, selectedIndex);
		} else if (id === 'zoomin' && map.getZoom() < map.getMaxZoom()) {
			map.zoomIn(1);
		} else if (id === 'zoomout' && map.getZoom() > map.getMinZoom()) {
			map.zoomOut(1);
		} else if (id === 'zoomreset') {
			map.setZoom(map.options.zoom);
		} else if (id === 'fullscreen') {
			if (!document.fullscreenElement &&
				!document.mozFullscreenElement &&
				!document.msFullscreenElement &&
				!document.webkitFullscreenElement) {
				if (document.documentElement.requestFullscreen) {
					document.documentElement.requestFullscreen();
				} else if (document.documentElement.msRequestFullscreen) {
					document.documentElement.msRequestFullscreen();
				} else if (document.documentElement.mozRequestFullScreen) {
					document.documentElement.mozRequestFullScreen();
				} else if (document.documentElement.webkitRequestFullscreen) {
					document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
				}
			} else if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.msExitFullscreen) {
				document.msExitFullscreen();
			} else if (document.mozCancelFullScreen) {
				document.mozCancelFullScreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			}
		} else if (id === 'fullscreen-presentation' && map.getDocType() === 'presentation') {
			map.fire('fullscreen');
		} else if (id === 'insertpage') {
			map.insertPage();
		} else if (id === 'duplicatepage') {
			map.duplicatePage();
		} else if (id === 'deletepage') {
			vex.dialog.confirm({
				message: _('Are you sure you want to delete this slide?'),
				callback: this._onDeleteSlide
			}, this);
		} else if (id === 'about') {
			map.showLOAboutDialog();
		} else if (id === 'keyboard-shortcuts') {
			map.showLOKeyboardHelp();
		} else if (id === 'rev-history') {
			// if we are being loaded inside an iframe, ask
			// our host to show revision history mode
			map.fire('postMessage', {msgId: 'rev-history'});
		} else if (id === 'closedocument') {
			map.fire('postMessage', {msgId: 'UI_Close', args: {EverModified: map._everModified}});
			map.remove();
		}
		else if (id === 'repair') {
			map._socket.sendMessage('commandvalues command=.uno:DocumentRepair');
		} else if (id === 'a4portrait') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Width":{"type":"long", "value": "21000"},"AttributePageSize.Height":{"type":"long", "value": "29700"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "false"}}');
		} else if (id === 'a4landscape') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Height":{"type":"long", "value": "21000"},"AttributePageSize.Width":{"type":"long", "value": "29700"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "true"}}');
		} else if (id === 'a5portrait') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Width":{"type":"long", "value": "14800"},"AttributePageSize.Height":{"type":"long", "value": "21000"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "false"}}');
		} else if (id === 'a5landscape') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Height":{"type":"long", "value": "14800"},"AttributePageSize.Width":{"type":"long", "value": "21000"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "true"}}');
		} else if (id === 'letterportrait') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Width":{"type":"long", "value": "21950"},"AttributePageSize.Height":{"type":"long", "value": "27940"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "false"}}');
		} else if (id === 'letterlandscape') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Height":{"type":"long", "value": "21950"},"AttributePageSize.Width":{"type":"long", "value": "27940"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "true"}}');
		} else if (id === 'legalportrait') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Width":{"type":"long", "value": "21590"},"AttributePageSize.Height":{"type":"long", "value": "35560"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "false"}}');
		} else if (id === 'legallandscape') {
			map.sendUnoCommand('.uno:AttributePageSize {"AttributePageSize.Height":{"type":"long", "value": "21590"},"AttributePageSize.Width":{"type":"long", "value": "35560"}}');
			map.sendUnoCommand('.uno:AttributePage {"AttributePage.Landscape":{"type":"boolean", "value": "true"}}');
		}

		// Inform the host if asked
		if ($(item).data('postmessage') === 'true') {
			map.fire('postMessage', {msgId: 'Clicked_Button', args: {Id: id} });
		}
	},

	_onDeleteSlide: function(e) {
		if (e) {
			map.deletePage();
		}
	},

	_onItemSelected: function(e, item) {
		var self = e.data.self;
		var type = $(item).data('type');
		if (type === 'unocommand') {
			var unoCommand = $(item).data('uno');
			map.sendUnoCommand(unoCommand);
		} else if (type === 'action') {
			self._executeAction(item);
		}

		if ($(item).data('id') !== 'insertcomment')
			map.focus();
	},

	_createMenu: function(menu) {
		var itemList = [];
		for (var i in menu) {
			if (menu[i].id === 'about' && (L.DomUtil.get('about-dialog') === null)) {
				continue;
			}

			if (map._permission === 'readonly' && menu[i].type === 'menu') {
				var found = false;
				for (var j in this.options.allowedReadonlyMenus) {
					if (this.options.allowedReadonlyMenus[j] === menu[i].id) {
						found = true;
						break;
					}
				}
				if (!found)
					continue;
			}

			if (menu[i].type === 'action') {
				if ((menu[i].id === 'rev-history' && !revHistoryEnabled) ||
					(menu[i].id === 'closedocument' && !closebutton)) {
					continue;
				}
			}

			if (menu[i].id === 'print' && this._map['wopi'].HidePrintOption)
				continue;

			if (menu[i].id === 'save' && this._map['wopi'].HideSaveOption)
				continue;

			// Keep track of all 'downloadas-' options and register them as
			// export formats with docLayer which can then be publicly accessed unlike
			// this Menubar control for which there doesn't seem to be any easy way
			// to get access to.
			if (menu[i].id && menu[i].id.startsWith('downloadas-')) {
				var format = menu[i].id.substring('downloadas-'.length);
				this._map._docLayer.registerExportFormat(menu[i].name, format);

				if (this._map['wopi'].HideExportOption)
					continue;
			}

			var liItem = L.DomUtil.create('li', '');
			if (menu[i].id) {
				liItem.id = 'menu-' + menu[i].id;
				if (menu[i].id === 'closedocument' && map._permission === 'readonly') {
					// see corresponding css rule for readonly class usage
					L.DomUtil.addClass(liItem, 'readonly');
				}
			}
			var aItem = L.DomUtil.create('a', '', liItem);
			aItem.innerHTML = menu[i].name;

			if (menu[i].type === 'menu') {
				var ulItem = L.DomUtil.create('ul', '', liItem);
				var subitemList = this._createMenu(menu[i].menu);
				if (!subitemList.length) {
					continue;
				}
				for (var j in subitemList) {
					ulItem.appendChild(subitemList[j]);
				}
			} else if (menu[i].type === 'unocommand') {
				$(aItem).data('type', 'unocommand');
				$(aItem).data('uno', menu[i].uno);
			} else if (menu[i].type === 'separator') {
				$(aItem).addClass('separator');
			} else if (menu[i].type === 'action') {
				$(aItem).data('type', 'action');
				$(aItem).data('id', menu[i].id);
			}

			itemList.push(liItem);
		}

		return itemList;
	},

	_initializeMenu: function(menu) {
		var menuHtml = this._createMenu(menu);
		for (var i in menuHtml) {
			this._menubarCont.appendChild(menuHtml[i]);
		}
	}
});

L.control.menubar = function (options) {
	return new L.Control.Menubar(options);
};


/*
 * L.Control.Tabs is used to switch sheets in Calc
 */

/* global $ vex _ map */
L.Control.Tabs = L.Control.extend({
	onAdd: function(map) {
		map.on('updatepermission', this._onUpdatePermission, this);
		this._initialized = false;
	},

	_onUpdatePermission: function(e) {
		if (this._map.getDocType() !== 'spreadsheet') {
			return;
		}

		if (!this._initialized) {
			this._initialize();
		}
		setTimeout(function() {
			$('.spreadsheet-tab').contextMenu(e.perm === 'edit');
		}, 1000);
	},

	_initialize: function () {
		this._initialized = true;
		this._tabsInitialized = false;
		this._spreadsheetTabs = {};
		var docContainer = map.options.documentContainer;
		this._tabsCont = L.DomUtil.create('div', 'spreadsheet-tabs-container', docContainer.parentElement);

		$.contextMenu({
			selector: '.spreadsheet-tab',
			className: 'loleaflet-font',
			callback: function(key, options) {
				var nPos = parseInt(options.$trigger.attr('id').split('spreadsheet-tab')[1]);

				if (key === 'insertsheetbefore') {
					map.insertPage(nPos);
				}
				if (key === 'insertsheetafter') {
					map.insertPage(nPos + 1);
				}
			},
			items: {
				'insertsheetbefore': {name: _('Insert sheet before this')},
				'insertsheetafter': {name: _('Insert sheet after this')},
				'deletesheet': {name: _('Delete sheet'),
						callback: function(key, options) {
							var nPos = parseInt(options.$trigger.attr('id').split('spreadsheet-tab')[1]);
							vex.dialog.confirm({
								message: _('Are you sure you want to delete sheet, %sheet% ?').replace('%sheet%', options.$trigger.text()),
								callback: function(data) {
									if (data) {
										map.deletePage(nPos);
									}
								}
							});
						}
				 },
				'renamesheet': {name: _('Rename sheet'),
							callback: function(key, options) {
								var nPos = parseInt(options.$trigger.attr('id').split('spreadsheet-tab')[1]);
								vex.dialog.open({
									message: _('Enter new sheet name'),
									input: '<input name="sheetname" type="text" required />',
									callback: function(data) {
										map.renamePage(data.sheetname, nPos);
									}
								});
							}}
			},
			zIndex: 1000
		});

		map.on('updateparts', this._updateDisabled, this);
	},

	_updateDisabled: function (e) {
		var parts = e.parts;
		var selectedPart = e.selectedPart;
		var docType = e.docType;
		if (docType === 'text') {
			return;
		}
		if (docType === 'spreadsheet') {
			if (!this._tabsInitialized) {
				// make room for the preview
				var docContainer = this._map.options.documentContainer;
				L.DomUtil.addClass(docContainer, 'spreadsheet-document');
				setTimeout(L.bind(function () {
					this._map.invalidateSize();
					$('.scroll-container').mCustomScrollbar('update');
					$('.scroll-container').mCustomScrollbar('scrollTo', [0, 0]);
				}, this), 100);
				this._tabsInitialized = true;
			}
			if ('partNames' in e) {
				while (this._tabsCont.firstChild) {
					this._tabsCont.removeChild(this._tabsCont.firstChild);
				}
				var ssTabScroll = L.DomUtil.create('div', 'spreadsheet-tab-scroll', this._tabsCont);
				ssTabScroll.id = 'spreadsheet-tab-scroll';

				for (var i = 0; i < parts; i++) {
					var id = 'spreadsheet-tab' + i;
					var tab = L.DomUtil.create('div', 'spreadsheet-tab', ssTabScroll);
					tab.innerHTML = e.partNames[i];
					tab.id = id;

					L.DomEvent
						.on(tab, 'click', L.DomEvent.stopPropagation)
						.on(tab, 'click', L.DomEvent.stop)
						.on(tab, 'click', this._setPart, this)
						.on(tab, 'click', this._refocusOnMap, this);
					this._spreadsheetTabs[id] = tab;
				}
			}
			for (var key in this._spreadsheetTabs) {
				var part =  parseInt(key.match(/\d+/g)[0]);
				L.DomUtil.removeClass(this._spreadsheetTabs[key], 'spreadsheet-tab-selected');
				if (part === selectedPart) {
					L.DomUtil.addClass(this._spreadsheetTabs[key], 'spreadsheet-tab-selected');
				}
			}
		}
	},

	_setPart: function (e) {
		var part =  e.target.id.match(/\d+/g)[0];
		if (part !== null) {
			this._map.setPart(parseInt(part));
		}
	}
});

L.control.tabs = function (options) {
	return new L.Control.Tabs(options);
};


/*
 * L.Control.EditView is used for switching between viewing and editing mode
 */

L.Control.PermissionSwitch = L.Control.extend({
	options: {
		position: 'topleft'
	},

	onAdd: function (map) {
		var partName = 'leaflet-control-editviewswitch',
		    container = L.DomUtil.create('label', partName + ' leaflet-bar');

		this._checkBox = L.DomUtil.create('input', 'editview-cb', container);
		this._checkBox.type = 'checkbox';
		L.DomEvent.on(this._checkBox, 'change', this._onChange, this);
		map.on('updatepermission', this._onUpdatePermission, this);
		container.appendChild(document.createTextNode('Enable editing'));
		return container;
	},

	_onChange: function () {
		if (this._checkBox.checked) {
			this._map.setPermission('edit');
		}
		else {
			this._map.setPermission('view');
		}
		this._refocusOnMap();
	},

	_onUpdatePermission: function (e) {
		if (e.perm === 'edit') {
			this._checkBox.checked = true;
			this._checkBox.disabled = false;
		}
		else if (e.perm === 'view') {
			this._checkBox.checked = false;
			this._checkBox.disabled = false;
		}
		else if (e.perm === 'readonly') {
			this._checkBox.checked = false;
			this._checkBox.disabled = true;
		}
	}
});

L.control.permissionSwitch = function (options) {
	return new L.Control.PermissionSwitch(options);
};


/*
 * L.Control.Selection enables by mouse drag selection in viewing mode
 */

L.Control.Selection = L.Control.extend({
	options: {
		position: 'topleft'
	},

	onAdd: function (map) {
		var partName = 'leaflet-control-editviewswitch',
		    container = L.DomUtil.create('label', partName + ' leaflet-bar');

		this._checkBox = L.DomUtil.create('input', 'editview-cb', container);
		this._checkBox.type = 'checkbox';
		L.DomEvent.on(this._checkBox, 'change', this._onChange, this);
		map.on('updatepermission', this._onUpdatePermission, this);
		container.appendChild(document.createTextNode('Enable Selection'));
		return container;
	},

	_onChange: function () {
		if (this._checkBox.checked) {
			this._map.enableSelection();
		}
		else {
			this._map.disableSelection();
		}
		this._refocusOnMap();
	},

	_onUpdatePermission: function (e) {
		if (e.perm === 'edit') {
			this._checkBox.checked = false;
			this._checkBox.disabled = true;
		}
		else if (e.perm === 'view') {
			this._checkBox.checked = false;
			this._checkBox.disabled = false;
		}
		else if (e.perm === 'readonly') {
			this._checkBox.checked = false;
			this._checkBox.disabled = false;
		}
	}
});

L.control.selection = function (options) {
	return new L.Control.Selection(options);
};


/*
 * L.Control.Scroll handles scrollbars
 */

/* global $ clearTimeout setTimeout */
L.Control.Scroll = L.Control.extend({

	onAdd: function (map) {
		this._scrollContainer = L.DomUtil.create('div', 'scroll-container', map._container.parentElement);
		this._mockDoc = L.DomUtil.create('div', '', this._scrollContainer);
		this._mockDoc.id = 'mock-doc';

		this._prevScrollX = 0;
		this._prevScrollY = 0;

		this._prevDocWidth = 0;
		this._prevDocHeight = 0;

		map.on('scrollto', this._onScrollTo, this);
		map.on('scrollby', this._onScrollBy, this);
		map.on('scrollvelocity', this._onScrollVelocity, this);
		map.on('handleautoscroll', this._onHandleAutoScroll, this);
		map.on('docsize', this._onUpdateSize, this);
		map.on('updatescrolloffset', this._onUpdateScrollOffset, this);
		map.on('updaterowcolumnheaders', this._onUpdateRowColumnHeaders, this);

		var control = this;
		var autoHideTimeout = null;
		$('.scroll-container').mCustomScrollbar({
			axis: 'yx',
			theme: 'minimal-dark',
			scrollInertia: 0,
			advanced:{autoExpandHorizontalScroll: true}, /* weird bug, it should be false */
			callbacks:{
				onScroll: function() {
					control._onScrollEnd(this);
					if (autoHideTimeout)
						clearTimeout(autoHideTimeout);
					autoHideTimeout = setTimeout(function() {
						//	$('.mCS-autoHide > .mCustomScrollBox ~ .mCSB_scrollTools').css({opacity: 0, 'filter': 'alpha(opacity=0)', '-ms-filter': 'alpha(opacity=0)'});
						$('.mCS-autoHide > .mCustomScrollBox ~ .mCSB_scrollTools').removeClass('loleaflet-scrollbar-show');
					}, 2000);
				},
				whileScrolling: function() {
					control._onScroll(this);

					// autoHide feature doesn't work because plugin relies on hovering on scroll container
					// and we have a mock scroll container whereas the actual user hovering happens only on
					// real document. Change the CSS rules manually to simulate autoHide feature.
					$('.mCS-autoHide > .mCustomScrollBox ~ .mCSB_scrollTools').addClass('loleaflet-scrollbar-show');
				},
				onUpdate: function() {
					console.debug('mCustomScrollbar: onUpdate:');
				},
				alwaysTriggerOffsets: false
			}
		});
	},

	_onCalcScroll: function (e) {
		if (!this._map._enabled) {
			return;
		}

		var newLeft = -e.mcs.left;
		if (newLeft > this._prevScrollX) {
			var viewportWidth = this._map.getSize().x;
			var docWidth = this._map._docLayer._docPixelSize.x;
			newLeft = Math.min(newLeft, docWidth - viewportWidth);
		}
		else {
			newLeft = Math.max(newLeft, 0);
		}

		var newTop = -e.mcs.top;
		if (newTop > this._prevScrollY) {
			var viewportHeight = this._map.getSize().y;
			var docHeight = Math.round(this._map._docLayer._docPixelSize.y);
			newTop = Math.min(newTop, docHeight - viewportHeight);
		}
		else {
			newTop = Math.max(newTop, 0);
		}

		var offset = new L.Point(
				newLeft - this._prevScrollX,
				newTop - this._prevScrollY);

		if (offset.equals(new L.Point(0, 0))) {
			return;
		}

		this._onUpdateRowColumnHeaders({ x: newLeft, y: newTop, offset: offset});

		this._prevScrollY = newTop;
		this._prevScrollX = newLeft;
		this._map.fire('scrolloffset', offset);
		this._map.scroll(offset.x, offset.y);
	},

	_onScroll: function (e) {
		if (this._map._docLayer._docType === 'spreadsheet') {
			this._onCalcScroll(e);
			return;
		}

		console.debug('_onScroll: ');
		if (!this._map._enabled) {
			return;
		}

		if (this._ignoreScroll) {
			console.debug('_onScroll: ignoring scroll');
			return;
		}

		var offset = new L.Point(
			-e.mcs.left - this._prevScrollX,
			-e.mcs.top - this._prevScrollY);

		if (!offset.equals(new L.Point(0, 0))) {
			this._prevScrollY = -e.mcs.top;
			this._prevScrollX = -e.mcs.left;
			console.debug('_onScroll: scrolling: ' + offset);
             
                        scrollManager.lastTimeScroll = new Date().getTime();
                        scrollManager.amountToBeScrolledX += offset.x;
                        scrollManager.amountToBeScrolledY += offset.y;

                        setTimeout(function(){
                            var now = new Date().getTime();
                            if(now - scrollManager.lastTimeScroll >= 100){
                                var offsetPoint = new L.Point(scrollManager.amountToBeScrolledX,scrollManager.amountToBeScrolledY);
                                this._map.scroll(offsetPoint.x, offsetPoint.y);
			        this._map.fire('scrolloffset', offsetPoint);
                                
                                scrollManager.amountToBeScrolledX = 0;
                                scrollManager.amountToBeScrolledY = 0;
                            }
                        },110);
		}
	},

	_onScrollEnd: function (e) {
		// needed in order to keep the row/column header correctly aligned
		if (this._map._docLayer._docType === 'spreadsheet') {
			return;
		}

		console.debug('_onScrollEnd:');
		if (this._ignoreScroll) {
			this._ignoreScroll = null;
			console.debug('_onScrollEnd: scrollTop: ' + -e.mcs.top);
			this._map.scrollTop(-e.mcs.top);
		}
		this._prevScrollY = -e.mcs.top;
		this._prevScrollX = -e.mcs.left;
		// Scrolling quickly via mousewheel messes up the annotations for some reason
		// Triggering the layouting algorithm here, though unnecessary, fixes the problem.
		// This is just a workaround till we find the root cause of why it messes up the annotations
		if (this._map._docLayer._annotations.layout) {
			this._map._docLayer._annotations.layout();
		}
	},

	_onScrollTo: function (e) {
		// triggered by the document (e.g. search result out of the viewing area)
		$('.scroll-container').mCustomScrollbar('scrollTo', [e.y, e.x]);
	},

	_onScrollBy: function (e) {
		e.y *= (-1);
		var y = '+=' + e.y;
		if (e.y < 0) {
			y = '-=' + Math.abs(e.y);
		}
		e.x *= (-1);
		var x = '+=' + e.x;
		if (e.x < 0) {
			x = '-=' + Math.abs(e.x);
		}
		$('.scroll-container').mCustomScrollbar('scrollTo', [y, x]);
	},

	_onScrollVelocity: function (e) {
		if (e.vx === 0 && e.vy === 0) {
			clearInterval(this._autoScrollTimer);
			this._autoScrollTimer = null;
			this._map.isAutoScrolling = false;
		} else {
			clearInterval(this._autoScrollTimer);
			this._map.isAutoScrolling = true;
			this._autoScrollTimer = setInterval(L.bind(function() {
				this._onScrollBy({x: e.vx, y: e.vy});
			}, this), 100);
		}
	},

	_onHandleAutoScroll: function (e) {
		var vx = 0;
		var vy = 0;

		if (e.pos.y > e.map._size.y - 50) {
			vy = 50;
		} else if (e.pos.y < 50) {
			vy = -50;
		}
		if (e.pos.x > e.map._size.x - 50) {
			vx = 50;
		} else if (e.pos.x < 50) {
			vx = -50;
		}

		this._onScrollVelocity({vx: vx, vy: vy});
	},

	_onUpdateSize: function (e) {
		if (!this._mockDoc) {
			return;
		}

		// we need to avoid precision issues in comparison (in the end values are pixels)
		var newDocWidth = Math.ceil(e.x);
		var newDocHeight = Math.ceil(e.y);

		// for writer documents, ignore scroll while document size is being reduced
		if (this._map.getDocType() === 'text' && newDocHeight < this._prevDocHeight) {
			console.debug('_onUpdateSize: Ignore the scroll !');
			this._ignoreScroll = true;
		}
		L.DomUtil.setStyle(this._mockDoc, 'width', e.x + 'px');
		L.DomUtil.setStyle(this._mockDoc, 'height', e.y + 'px');

		// custom scrollbar plugin checks automatically for content height changes but not for content width changes
		// so we need to update scrollbars explicitly; moreover we want to avoid to have 'update' invoked twice
		// in case prevDocHeight !== newDocHeight
		if (this._prevDocWidth !== newDocWidth && this._prevDocHeight === newDocHeight) {
			$('.scroll-container').mCustomScrollbar('update');
		}

		// Don't get them through L.DomUtil.getStyle because precision is no more than 6 digits
		this._prevDocWidth = newDocWidth;
		this._prevDocHeight = newDocHeight;
	},

	_onUpdateScrollOffset: function (e) {
		// used on window resize
		if (this._map._docLayer._docType === 'spreadsheet') {
			var offset = new L.Point(e.x - this._prevScrollX, e.y - this._prevScrollY);
			if (!offset.equals(new L.Point(0, 0))) {
				this._onUpdateRowColumnHeaders({x: e.x, y: e.y, offset: offset});
			}
		}
		this._ignoreScroll = null;
		$('.scroll-container').mCustomScrollbar('stop');
		this._prevScrollY = e.y;
		this._prevScrollX = e.x;
		$('.scroll-container').mCustomScrollbar('scrollTo', [e.y, e.x], {callbacks: false, timeout:0});
	},

	_onUpdateRowColumnHeaders: function(e) {
		var offset = e.offset || {};

		var topLeftPoint = new L.Point(e.x, e.y);
		var sizePx = this._map.getSize();

		if (topLeftPoint.x === undefined) {
			topLeftPoint.x = this._map._getTopLeftPoint().x;
		}
		if (topLeftPoint.y === undefined) {
			topLeftPoint.y = this._map._getTopLeftPoint().y;
		}

		if (offset.x === 0) {
			topLeftPoint.x = -1;
			sizePx.x = 0;
		}
		if (offset.y === 0) {
			topLeftPoint.y = -1;
			sizePx.y = 0;
		}

		var pos = this._map._docLayer._pixelsToTwips(topLeftPoint);
		var size = this._map._docLayer._pixelsToTwips(sizePx);
		var payload = 'commandvalues command=.uno:ViewRowColumnHeaders?x=' + Math.round(pos.x) + '&y=' + Math.round(pos.y) +
			'&width=' + Math.round(size.x) + '&height=' + Math.round(size.y);

		this._map._socket.sendMessage(payload);
	}
});

L.control.scroll = function (options) {
	return new L.Control.Scroll(options);
};


/*
 * L.Control.Dialog used for displaying alerts
 */

/* global vex */
L.Control.Dialog = L.Control.extend({
	onAdd: function (map) {
		// TODO: Better distinction between warnings and errors
		map.on('error', this._onError, this);
		map.on('warn', this._onError, this);
		map.on('print', this._onPrint, this);
	},

	_onError: function(e) {
		if (vex.dialogID > 0 && !this._map._fatal) {
			// TODO. queue message errors and pop-up dialogs
			// Close other dialogs before presenting a new one.
			vex.close(vex.dialogID);
		}

		if (e.msg) {
			vex.dialog.alert(e.msg);
		}
		else if (e.cmd == 'load' && e.kind == 'docunloading') {
			// Handled by transparently retrying.
			return;
		} else if (e.cmd && e.kind) {
			var msg = 'The server encountered a \'' + e.kind + '\' error while' +
						' parsing the \'' + e.cmd + '\' command.';
			vex.dialog.alert(msg);
		}

		// Remember the current dialog ID to close it later.
		vex.dialogID = vex.globalID - 1;
	},

	_onPrint: function (e) {
		var url = e.url;
		vex.dialog.confirm({
			message: 'Download PDF export?',
			callback: L.bind(function (value) {
				if (value) {
					this._map._fileDownloader.src = url;
				}
			}, this)
		});
	}
});

L.control.dialog = function (options) {
	return new L.Control.Dialog(options);
};


/*
 * L.Control.Attribution is used for displaying attribution on the map (added by default).
 */

L.Control.Attribution = L.Control.extend({
	options: {
		position: 'bottomright',
		prefix: '<a href="http://leafletjs.com" title="A JS library for interactive maps">Leaflet</a>'
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		if (!this._container) {
			this._container = L.DomUtil.create('div', 'leaflet-control-attribution');
			L.DomEvent.disableClickPropagation(this._container);
		}

		this._update();

		return this._container;
	},

	setPrefix: function (prefix) {
		this.options.prefix = prefix;
		this._update();
		return this;
	},

	_update: function () {
		if (!this._map) { return; }

		this._container.innerHTML = this.options.prefix;
	}
});

L.control.attribution = function (options) {
	return new L.Control.Attribution(options);
};


/*
 * L.Control.Scale is used for displaying metric/imperial scale on the map.
 */

L.Control.Scale = L.Control.extend({
	options: {
		position: 'bottomleft',
		maxWidth: 100,
		metric: true,
		imperial: true
		// updateWhenIdle: false
	},

	onAdd: function (map) {
		var className = 'leaflet-control-scale',
		    container = L.DomUtil.create('div', className),
		    options = this.options;

		this._addScales(options, className + '-line', container);

		map.on(options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
		map.whenReady(this._update, this);

		return container;
	},

	onRemove: function (map) {
		map.off(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
	},

	_addScales: function (options, className, container) {
		if (options.metric) {
			this._mScale = L.DomUtil.create('div', className, container);
		}
		if (options.imperial) {
			this._iScale = L.DomUtil.create('div', className, container);
		}
	},

	_update: function () {
		var map = this._map,
		    y = map.getSize().y / 2;

		var maxMeters = L.CRS.Earth.distance(
				map.containerPointToLatLng([0, y]),
				map.containerPointToLatLng([this.options.maxWidth, y]));

		this._updateScales(maxMeters);
	},

	_updateScales: function (maxMeters) {
		if (this.options.metric && maxMeters) {
			this._updateMetric(maxMeters);
		}
		if (this.options.imperial && maxMeters) {
			this._updateImperial(maxMeters);
		}
	},

	_updateMetric: function (maxMeters) {
		var meters = this._getRoundNum(maxMeters),
		    label = meters < 1000 ? meters + ' m' : (meters / 1000) + ' km';

		this._updateScale(this._mScale, label, meters / maxMeters);
	},

	_updateImperial: function (maxMeters) {
		var maxFeet = maxMeters * 3.2808399,
		    maxMiles, miles, feet;

		if (maxFeet > 5280) {
			maxMiles = maxFeet / 5280;
			miles = this._getRoundNum(maxMiles);
			this._updateScale(this._iScale, miles + ' mi', miles / maxMiles);

		} else {
			feet = this._getRoundNum(maxFeet);
			this._updateScale(this._iScale, feet + ' ft', feet / maxFeet);
		}
	},

	_updateScale: function (scale, text, ratio) {
		scale.style.width = Math.round(this.options.maxWidth * ratio) + 'px';
		scale.innerHTML = text;
	},

	_getRoundNum: function (num) {
		var pow10 = Math.pow(10, (Math.floor(num) + '').length - 1),
		    d = num / pow10;

		d = d >= 10 ? 10 :
		    d >= 5 ? 5 :
		    d >= 3 ? 3 :
		    d >= 2 ? 2 : 1;

		return pow10 * d;
	}
});

L.control.scale = function (options) {
	return new L.Control.Scale(options);
};


/*
 * L.Control.Layers is a control to allow users to switch between different layers on the map.
 */

L.Control.Layers = L.Control.extend({
	options: {
		collapsed: true,
		position: 'topright',
		autoZIndex: true,
		hideSingleBase: false
	},

	initialize: function (baseLayers, overlays, options) {
		L.setOptions(this, options);

		this._layers = {};
		this._lastZIndex = 0;
		this._handlingClick = false;

		for (var i in baseLayers) {
			this._addLayer(baseLayers[i], i);
		}

		for (i in overlays) {
			this._addLayer(overlays[i], i, true);
		}
	},

	onAdd: function () {
		this._initLayout();
		this._update();

		return this._container;
	},

	addBaseLayer: function (layer, name) {
		this._addLayer(layer, name);
		return this._update();
	},

	addOverlay: function (layer, name) {
		this._addLayer(layer, name, true);
		return this._update();
	},

	removeLayer: function (layer) {
		layer.off('add remove', this._onLayerChange, this);

		delete this._layers[L.stamp(layer)];
		return this._update();
	},

	_initLayout: function () {
		var className = 'leaflet-control-layers',
		    container = this._container = L.DomUtil.create('div', className);

		// makes this work on IE touch devices by stopping it from firing a mouseout event when the touch is released
		container.setAttribute('aria-haspopup', true);

		if (!L.Browser.touch) {
			L.DomEvent
				.disableClickPropagation(container)
				.disableScrollPropagation(container);
		} else {
			L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
		}

		var form = this._form = L.DomUtil.create('form', className + '-list');

		if (this.options.collapsed) {
			if (!L.Browser.android) {
				L.DomEvent.on(container, {
					mouseenter: this._expand,
					mouseleave: this._collapse
				}, this);
			}

			var link = this._layersLink = L.DomUtil.create('a', className + '-toggle', container);
			link.href = '#';
			link.title = 'Layers';

			if (L.Browser.touch) {
				L.DomEvent
				    .on(link, 'click', L.DomEvent.stop)
				    .on(link, 'click', this._expand, this);
			} else {
				L.DomEvent.on(link, 'focus', this._expand, this);
			}

			// work around for Firefox Android issue https://github.com/Leaflet/Leaflet/issues/2033
			L.DomEvent.on(form, 'click', function () {
				setTimeout(L.bind(this._onInputClick, this), 0);
			}, this);

			this._map.on('click', this._collapse, this);
			// TODO keyboard accessibility
		} else {
			this._expand();
		}

		this._baseLayersList = L.DomUtil.create('div', className + '-base', form);
		this._separator = L.DomUtil.create('div', className + '-separator', form);
		this._overlaysList = L.DomUtil.create('div', className + '-overlays', form);

		container.appendChild(form);
	},

	_addLayer: function (layer, name, overlay) {
		layer.on('add remove', this._onLayerChange, this);

		var id = L.stamp(layer);

		this._layers[id] = {
			layer: layer,
			name: name,
			overlay: overlay
		};

		if (this.options.autoZIndex && layer.setZIndex) {
			this._lastZIndex++;
			layer.setZIndex(this._lastZIndex);
		}
	},

	_update: function () {
		if (!this._container) { return this; }

		L.DomUtil.empty(this._baseLayersList);
		L.DomUtil.empty(this._overlaysList);

		var baseLayersPresent, overlaysPresent, i, obj, baseLayersCount = 0;

		for (i in this._layers) {
			obj = this._layers[i];
			this._addItem(obj);
			overlaysPresent = overlaysPresent || obj.overlay;
			baseLayersPresent = baseLayersPresent || !obj.overlay;
			baseLayersCount += !obj.overlay ? 1 : 0;
		}

		// Hide base layers section if there's only one layer.
		if (this.options.hideSingleBase) {
			baseLayersPresent = baseLayersPresent && baseLayersCount > 1;
			this._baseLayersList.style.display = baseLayersPresent ? '' : 'none';
		}

		this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';

		return this;
	},

	_onLayerChange: function (e) {
		if (!this._handlingClick) {
			this._update();
		}

		var overlay = this._layers[L.stamp(e.target)].overlay;

		var type = overlay ?
			(e.type === 'add' ? 'overlayadd' : 'overlayremove') :
			(e.type === 'add' ? 'baselayerchange' : null);

		if (type) {
			this._map.fire(type, e.target);
		}
	},

	// IE7 bugs out if you create a radio dynamically, so you have to do it this hacky way (see http://bit.ly/PqYLBe)
	_createRadioElement: function (name, checked) {

		var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' +
				name + '"' + (checked ? ' checked="checked"' : '') + '/>';

		var radioFragment = document.createElement('div');
		radioFragment.innerHTML = radioHtml;

		return radioFragment.firstChild;
	},

	_addItem: function (obj) {
		var label = document.createElement('label'),
		    checked = this._map.hasLayer(obj.layer),
		    input;

		if (obj.overlay) {
			input = document.createElement('input');
			input.type = 'checkbox';
			input.className = 'leaflet-control-layers-selector';
			input.defaultChecked = checked;
		} else {
			input = this._createRadioElement('leaflet-base-layers', checked);
		}

		input.layerId = L.stamp(obj.layer);

		L.DomEvent.on(input, 'click', this._onInputClick, this);

		var name = document.createElement('span');
		name.innerHTML = ' ' + obj.name;

		label.appendChild(input);
		label.appendChild(name);

		var container = obj.overlay ? this._overlaysList : this._baseLayersList;
		container.appendChild(label);

		return label;
	},

	_onInputClick: function () {
		var inputs = this._form.getElementsByTagName('input'),
		    input, layer, hasLayer;
		var addedLayers = [],
		    removedLayers = [];

		this._handlingClick = true;

		for (var i = 0, len = inputs.length; i < len; i++) {
			input = inputs[i];
			layer = this._layers[input.layerId].layer;
			hasLayer = this._map.hasLayer(layer);

			if (input.checked && !hasLayer) {
				addedLayers.push(layer);

			} else if (!input.checked && hasLayer) {
				removedLayers.push(layer);
			}
		}

		// Bugfix issue 2318: Should remove all old layers before readding new ones
		for (i = 0; i < removedLayers.length; i++) {
			this._map.removeLayer(removedLayers[i]);
		}
		for (i = 0; i < addedLayers.length; i++) {
			this._map.addLayer(addedLayers[i]);
		}

		this._handlingClick = false;

		this._refocusOnMap();
	},

	_expand: function () {
		L.DomUtil.addClass(this._container, 'leaflet-control-layers-expanded');
	},

	_collapse: function () {
		L.DomUtil.removeClass(this._container, 'leaflet-control-layers-expanded');
	}
});

L.control.layers = function (baseLayers, overlays, options) {
	return new L.Control.Layers(baseLayers, overlays, options);
};


L.Map.include({
	search: function (text, backward, replaceString,  command, expand) {
		if (backward === undefined) {
			backward = false;
		}
		if (command === undefined) {
			command = 0;
		}
		if (replaceString === undefined) {
			replaceString = '';
		}
		if (this._docLayer._searchResults && text !== this._docLayer._searchTerm)
		{
			this._docLayer._clearSearchResults();
		}

		var searchCmd = {
			'SearchItem.SearchString': {
				'type': 'string'
			},
			'SearchItem.ReplaceString': {
				'type': 'string'
			},
			'SearchItem.Backward': {
				'type': 'boolean'
			},
			'SearchItem.SearchStartPointX': {
				'type': 'long'
			},
			'SearchItem.SearchStartPointY': {
				'type': 'long'
			},
			'SearchItem.Command': {
				'type': 'long'
			}
		};

		this.fire('clearselection');
		var viewTopLeftpx = this.project(this.getBounds().getNorthWest());
		var docBoundsTopLeft = this.project(this.options.maxBounds.getNorthWest());
		var topLeft = this.unproject(new L.Point(
				Math.max(viewTopLeftpx.x, docBoundsTopLeft.x),
				Math.max(viewTopLeftpx.y, docBoundsTopLeft.y)));
		var topLeftTwips = this._docLayer._latLngToTwips(topLeft);

		var searchStartPointX = topLeftTwips.x;
		var searchStartPointY = topLeftTwips.y;
		if (this._docLayer && this._docLayer._lastSearchResult && expand) {
			var strTwips = this._docLayer._lastSearchResult.twipsRectangles.match(/\d+/g);
			if (strTwips != null) {
				searchStartPointX = strTwips[0];
				searchStartPointY = strTwips[1];
			}
			this.resetSelection();
		}

		searchCmd['SearchItem.SearchString'].value = text;
		searchCmd['SearchItem.Backward'].value = backward;
		searchCmd['SearchItem.ReplaceString'].value = replaceString;
		searchCmd['SearchItem.SearchStartPointX'].value = searchStartPointX;
		searchCmd['SearchItem.SearchStartPointY'].value = searchStartPointY;
		searchCmd['SearchItem.Command'].value = command;
		this._searchRequested = true;
		this._socket.sendMessage('uno .uno:ExecuteSearch ' + JSON.stringify(searchCmd));
	},

	highlightAll: function (text) {
		if (this._docLayer._searchResults && text === this._docLayer._searchTerm) {
			return;
		}
		this.search(text, false, 1);
	},

	resetSelection: function () {
		this._docLayer._clearSearchResults();
		this._socket.sendMessage('resetselection');
	}
});


/*
 * Document permission handler
 */
L.Map.include({
	setPermission: function (perm) {
		this._permission = perm;
		if (perm === 'edit') {
			this._socket.sendMessage('requestloksession');
			if (!L.Browser.touch) {
				this.dragging.disable();
			}
		}
		else if (perm === 'view' || perm === 'readonly') {
			this.dragging.enable();
			// disable all user interaction, will need to add keyboard too
			this._docLayer._onUpdateCursor();
			this._docLayer._clearSelections();
			this._docLayer._onUpdateTextSelection();
		}
		this.fire('updatepermission', {perm : perm});
	},

	enableSelection: function () {
		if (this._permission === 'edit') {
			return;
		}
		this._socket.sendMessage('requestloksession');
		this.dragging.disable();
	},

	disableSelection: function () {
		if (this._permission === 'edit') {
			return;
		}
		this.dragging.enable();
	},

	isSelectionEnabled: function () {
		return !this.dragging.enabled();
	},

	getPermission: function () {
		return this._permission;
	}
});


/*
 * Toolbar handler
 */

/* global $ window vex brandProductName */
L.Map.include({

	// a mapping of uno commands to more readable toolbar items
	unoToolbarCommands: [
		'.uno:StyleApply',
		'.uno:CharFontName'
	],

	_modalDialogOptions: {
		overlayClose:true,
		opacity: 80,
		overlayCss: {
			backgroundColor : '#000'
		},
		containerCss: {
			overflow : 'hidden',
			backgroundColor : '#fff',
			padding : '20px',
			border : '2px solid #000'
		}
	},

	applyFont: function (fontName) {
		if (this.getPermission() === 'edit') {
			var msg = 'uno .uno:CharFontName {' +
				'"CharFontName.FamilyName": ' +
					'{"type": "string", "value": "' + fontName + '"}}';
			this._socket.sendMessage(msg);
		}
	},

	applyFontSize: function (fontSize) {
		if (this.getPermission() === 'edit') {
			var msg = 'uno .uno:FontHeight {' +
				'"FontHeight.Height": ' +
				'{"type": "float", "value": "' + fontSize + '"}}';
			this._socket.sendMessage(msg);
		}
	},

	getToolbarCommandValues: function (command) {
		if (this._docLayer) {
			return this._docLayer._toolbarCommandValues[command];
		}

		return undefined;
	},

	downloadAs: function (name, format, options, id) {
		if (this._fatal) {
			return;
		}

		id = id || 'export'; // not any special download, simple export

		if ((id === 'print' && this['wopi'].DisablePrint) ||
		    (id === 'export' && this['wopi'].DisableExport)) {
			this.hideBusy();
			return;
		}

		if (format === undefined || format === null) {
			format = '';
		}
		if (options === undefined || options === null) {
			options = '';
		}

		this.showBusy(_('Downloading...'), false);
		this._socket.sendMessage('downloadas ' +
			'name=' + name + ' ' +
			'id=' + id + ' ' +
			'format=' + format + ' ' +
			'options=' + options);
	},

	print: function () {
		this.showBusy(_('Downloading...'), false);
		this.downloadAs('print.pdf', 'pdf', null, 'print');
	},

	saveAs: function (url, format, options) {
		if (format === undefined || format === null) {
			format = '';
		}
		if (options === undefined || options === null) {
			options = '';
		}

		this.showBusy(_('Saving...'), false);
		// TakeOwnership: we are performing a 'real' save-as, the document
		// is just getting a new place, ie. it will get the
		// '.uno:ModifiedStatus' upon completion.
		this._socket.sendMessage('saveas ' +
			'url=' + url + ' ' +
			'format=' + format + ' ' +
			'options=TakeOwnership,' + options);
	},

	applyStyle: function (style, familyName) {
		if (!style || !familyName) {
			this.fire('error', {cmd: 'setStyle', kind: 'incorrectparam'});
			return;
		}
		if (this._permission === 'edit') {
			var msg = 'uno .uno:StyleApply {' +
					'"Style":{"type":"string", "value": "' + style + '"},' +
					'"FamilyName":{"type":"string", "value":"' + familyName + '"}' +
					'}';
			this._socket.sendMessage(msg);
		}
	},

	applyLayout: function (layout) {
		if (!layout) {
			this.fire('error', {cmd: 'setLayout', kind: 'incorrectparam'});
			return;
		}
		if (this._permission === 'edit') {
			var msg = 'uno .uno:AssignLayout {' +
					'"WhatPage":{"type":"unsigned short", "value": "' + this.getCurrentPartNumber() + '"},' +
					'"WhatLayout":{"type":"unsigned short", "value": "' + layout + '"}' +
					'}';
			this._socket.sendMessage(msg);
		}
	},

	save: function(dontTerminateEdit, dontSaveIfUnmodified) {
		this._socket.sendMessage('save' +
		                         ' dontTerminateEdit=' + (dontTerminateEdit ? 1 : 0) +
		                         ' dontSaveIfUnmodified=' + (dontSaveIfUnmodified ? 1 : 0));
	},

	sendUnoCommand: function (command, json) {
		if (this._permission === 'edit') {
			this._socket.sendMessage('uno ' + command + (json ? ' ' + JSON.stringify(json) : ''));
		}
	},

	toggleCommandState: function (unoState) {
		if (this._permission === 'edit') {
			if (!unoState.startsWith('.uno:')) {
				unoState = '.uno:' + unoState;
			}
			this.sendUnoCommand(unoState);
		}
	},

	insertFile: function (file) {
		this.fire('insertfile', {file: file});
	},

	cellEnterString: function (string) {
		var command = {
			'StringName': {
				type: 'string',
				value: string
			},
			'DontCommit': {
				type: 'boolean',
				value: true
			}
		};

		this.sendUnoCommand('.uno:EnterString ', command);
	},

	renderFont: function (fontName) {
		this._socket.sendMessage('renderfont font=' + window.encodeURIComponent(fontName));
	},

	showLOKeyboardHelp: function() {
		var w = window.innerWidth / 2;
		$.get('loleaflet-help.html', function(data) {
			vex.open({
				content: data,
				showCloseButton: true,
				escapeButtonCloses: true,
				overlayClosesOnClick: true,
				contentCSS: {width: w + 'px'},
				buttons: {},
				afterOpen: function($vexContent) {
					// Display help according to document opened
					if (map.getDocType() === 'text') {
						document.getElementById('text-shortcuts').style.display='block';
					}
					else if (map.getDocType() === 'spreadsheet') {
						document.getElementById('spreadsheet-shortcuts').style.display='block';
					}
					else if (map.getDocType() === 'presentation' || map.getDocType() === 'drawing') {
						document.getElementById('presentation-shortcuts').style.display='block';
					}

					// Lets transalte
					var i, max;
					var translatableContent = $vexContent.find('h1');
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].firstChild.nodeValue = translatableContent[i].firstChild.nodeValue.toLocaleString();
					}
					translatableContent = $vexContent.find('h2');
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].firstChild.nodeValue = translatableContent[i].firstChild.nodeValue.toLocaleString();
					}
					translatableContent = $vexContent.find('td');
					for (i = 0, max = translatableContent.length; i < max; i++) {
						translatableContent[i].firstChild.nodeValue = translatableContent[i].firstChild.nodeValue.toLocaleString();
					}

					$('.vex-content').attr('tabindex', -1);
					$('.vex-content').focus();
					// workaround for https://github.com/HubSpot/vex/issues/43
					$('.vex-overlay').css({ 'pointer-events': 'none'});
					$('.vex').click(function() {
						vex.close($vexContent.data().vex.id);
					});
					$('.vex-content').click(function(e) {
						e.stopPropagation();
					});
				},
				beforeClose: function () {
					map.focus();
				}
			});
		});
	},

	showLOAboutDialog: function() {
		// Move the div sitting in 'body' as vex-content and make it visible
		var content = $('#about-dialog').clone().css({display: 'block'});
		// fill product-name and product-string
		var productName = (typeof brandProductName !== 'undefined') ? brandProductName : 'LibreOffice Online';
		content.find('#product-name').text(productName);
		var productString = _('This version of %productName is powered by');
		content.find('#product-string').text(productString.replace('%productName', productName));
		var w = window.innerWidth / 2;
		vex.open({
			content: content,
			showCloseButton: true,
			escapeButtonCloses: true,
			overlayClosesOnClick: true,
			contentCSS: { width: w + 'px'},
			buttons: {},
			afterOpen: function($vexContent) {
				map.enable(false);
				// workaround for https://github.com/HubSpot/vex/issues/43
				$('.vex-overlay').css({ 'pointer-events': 'none'});
				$('.vex').click(function() {
					vex.close($vexContent.data().vex.id);
				});
				$('.vex-content').click(function(e) {
					e.stopPropagation();
				});
			},
			beforeClose: function () {
				map.enable(true);
			}
		});
	}
});


/*
 * Document parts switching handler
 */
L.Map.include({
	setPart: function (part, external) {
		var docLayer = this._docLayer;
		docLayer._prevSelectedPart = docLayer._selectedPart;
		if (part === 'prev') {
			if (docLayer._selectedPart > 0) {
				docLayer._selectedPart -= 1;
			}
		}
		else if (part === 'next') {
			if (docLayer._selectedPart < docLayer._parts - 1) {
				docLayer._selectedPart += 1;
			}
		}
		else if (typeof (part) === 'number' && part >= 0 && part < docLayer._parts) {
			docLayer._selectedPart = part;
		}
		else {
			return;
		}
		if (docLayer._isCursorOverlayVisible) {
			// a click outside the slide to clear any selection
			this._socket.sendMessage('resetselection');
		}
		this.fire('updateparts', {
			selectedPart: docLayer._selectedPart,
			parts: docLayer._parts,
			docType: docLayer._docType
		});

		// If this wasn't triggered from the server,
		// then notify the server of the change.
		if (!external) {
			this._socket.sendMessage('setclientpart part=' + docLayer._selectedPart);
		}
		docLayer.eachView(docLayer._viewCursors, docLayer._onUpdateViewCursor, docLayer);
		docLayer.eachView(docLayer._cellViewCursors, docLayer._onUpdateCellViewCursor, docLayer);
		docLayer.eachView(docLayer._graphicViewMarkers, docLayer._onUpdateGraphicViewSelection, docLayer);
		docLayer.eachView(docLayer._viewSelections, docLayer._onUpdateTextViewSelection, docLayer);
		docLayer._clearSelections();
		docLayer._updateOnChangePart();
		docLayer._pruneTiles();
		docLayer._prevSelectedPartNeedsUpdate = true;
		if (docLayer._invalidatePreview) {
			docLayer._invalidatePreview();
		}
		docLayer._drawSearchResults();
		if (!this._searchRequested) {
			this.focus();
		}
	},

	getPreview: function (id, index, maxWidth, maxHeight, options) {
		if (!this._docPreviews) {
			this._docPreviews = {};
		}
		var autoUpdate = options ? !!options.autoUpdate : false;
		var forAllClients = options ? !!options.broadcast : false;
		this._docPreviews[id] = {id: id, index: index, maxWidth: maxWidth, maxHeight: maxHeight, autoUpdate: autoUpdate};

		var docLayer = this._docLayer;
		if (docLayer._docType === 'text') {
			return;
		}
		else {
			part = index;
			tilePosX = 0;
			tilePosY = 0;
			tileWidth = docLayer._docWidthTwips;
			tileHeight = docLayer._docHeightTwips;
		}
		var docRatio = tileWidth / tileHeight;
		var imgRatio = maxWidth / maxHeight;
		// fit into the given rectangle while maintaining the ratio
		if (imgRatio > docRatio) {
			maxWidth = Math.round(tileWidth * maxHeight / tileHeight);
		}
		else {
			maxHeight = Math.round(tileHeight * maxWidth / tileWidth);
		}
		this._socket.sendMessage('tile ' +
							'part=' + part + ' ' +
							'width=' + maxWidth + ' ' +
							'height=' + maxHeight + ' ' +
							'tileposx=' + tilePosX + ' ' +
							'tileposy=' + tilePosY + ' ' +
							'tilewidth=' + tileWidth + ' ' +
							'tileheight=' + tileHeight + ' ' +
							'id=' + id + ' ' +
							'broadcast=' + (forAllClients ? 'yes' : 'no'));
	},

	getCustomPreview: function (id, part, width, height, tilePosX, tilePosY, tileWidth, tileHeight, options) {
		if (!this._docPreviews) {
			this._docPreviews = {};
		}
		var autoUpdate = options ? options.autoUpdate : false;
		this._docPreviews[id] = {id: id, part: part, width: width, height: height, tilePosX: tilePosX,
			tilePosY: tilePosY, tileWidth: tileWidth, tileHeight: tileHeight, autoUpdate: autoUpdate};
		this._socket.sendMessage('tile ' +
							'part=' + part + ' ' +
							'width=' + width + ' ' +
							'height=' + height + ' ' +
							'tileposx=' + tilePosX + ' ' +
							'tileposy=' + tilePosY + ' ' +
							'tilewidth=' + tileWidth + ' ' +
							'tileheight=' + tileHeight + ' ' +
							'id=' + id + ' ' +
							'broadcast=no');
	},

	removePreviewUpdate: function (id) {
		if (this._docPreviews && this._docPreviews[id]) {
			this._docPreviews[id].autoUpdate = false;
		}
	},

	goToPage: function (page) {
		var docLayer = this._docLayer;
		if (page === 'prev') {
			if (docLayer._currentPage > 0) {
				docLayer._currentPage -= 1;
			}
		}
		else if (page === 'next') {
			if (docLayer._currentPage < docLayer._pages - 1) {
				docLayer._currentPage += 1;
			}
		}
		else if (typeof (page) === 'number' && page >= 0 && page < docLayer._pages) {
			docLayer._currentPage = page;
		}
		if (this._permission !== 'edit' && docLayer._partPageRectanglesPixels.length > docLayer._currentPage) {
			// we can scroll to the desired page without having a LOK instance
			var pageBounds = docLayer._partPageRectanglesPixels[docLayer._currentPage];
			var pos = new L.Point(
					pageBounds.min.x + (pageBounds.max.x - pageBounds.min.x) / 2,
					pageBounds.min.y);
			pos.y -= this.getSize().y / 4; // offset by a quater of the viewing area so that the previous page is visible
			this.scrollTop(pos.y, {update: true});
			this.scrollLeft(pos.x, {update: true});
		}
		else {
			this._socket.sendMessage('setpage page=' + docLayer._currentPage);
		}
		this.fire('pagenumberchanged', {
			currentPage: docLayer._currentPage,
			pages: docLayer._pages,
			docType: docLayer._docType
		});
	},

	insertPage: function(nPos) {
		if (this.getDocType() === 'presentation') {
			this._socket.sendMessage('uno .uno:InsertPage');
		}
		else if (this.getDocType() === 'spreadsheet') {
			var command = {
				'Name': {
					'type': 'string',
					'value': ''
				},
				'Index': {
					'type': 'long',
					'value': nPos + 1
				}
			};

			this._socket.sendMessage('uno .uno:Insert ' + JSON.stringify(command));
		}
		else {
			return;
		}

		var docLayer = this._docLayer;

		this.fire('insertpage', {
			selectedPart: docLayer._selectedPart,
			parts:        docLayer._parts
		});

		docLayer._parts++;

		// Since we know which part we want to set, use the index (instead of 'next', 'prev')
		if (typeof nPos === 'number') {
			this.setPart(nPos);
		}
		else {
			this.setPart('next');
		}
	},

	duplicatePage: function() {
		if (this.getDocType() !== 'presentation') {
			return;
		}
		this._socket.sendMessage('uno .uno:DuplicatePage');
		var docLayer = this._docLayer;

		this.fire('insertpage', {
			selectedPart: docLayer._selectedPart,
			parts:        docLayer._parts
		});

		docLayer._parts++;
		this.setPart('next');
	},

	deletePage: function (nPos) {
		if (this.getDocType() === 'presentation') {
			this._socket.sendMessage('uno .uno:DeletePage');
		}
		else if (this.getDocType() === 'spreadsheet') {
			var command = {
				'Index': {
					'type': 'long',
					'value': nPos + 1
				}
			};

			this._socket.sendMessage('uno .uno:Remove ' + JSON.stringify(command));
		}
		else {
			return;
		}

		var docLayer = this._docLayer;
		// TO DO: Deleting all the pages causes problem.
		if (docLayer._parts === 1) {
			return;
		}

		this.fire('deletepage', {
			selectedPart: docLayer._selectedPart,
			parts:        docLayer._parts
		});

		docLayer._parts--;
		if (docLayer._selectedPart >= docLayer._parts) {
			docLayer._selectedPart--;
		}

		if (typeof nPos === 'number') {
			this.setPart(nPos);
		}
		else {
			this.setPart(docLayer._selectedPart);
		}
	},

	renamePage: function (name, nPos) {
		if (this.getDocType() === 'spreadsheet') {
			var command = {
				'Name': {
					'type': 'string',
					'value': name
				},
				'Index': {
					'type': 'long',
					'value': nPos + 1
				}
			};

			this._socket.sendMessage('uno .uno:Name ' + JSON.stringify(command));
			this.setPart(this._docLayer);
		}
	},

	getNumberOfPages: function () {
		return this._docLayer._pages;
	},

	getNumberOfParts: function () {
		return this._docLayer._parts;
	},

	getCurrentPageNumber: function () {
		return this._docLayer._currentPage;
	},

	getCurrentPartNumber: function () {
		return this._docLayer._selectedPart;
	},

	getDocSize: function () {
		return this._docLayer._docPixelSize;
	},

	getDocType: function () {
		if (!this._docLayer)
			return null;

		return this._docLayer._docType;
	}
});


/*
 * Scroll methods
 */
L.Map.include({
	scroll: function (x, y, options) {
		if (typeof (x) !== 'number' || typeof (y) !== 'number') {
			return;
		}
		this._setUpdateOffsetEvt(options);
		this.panBy(new L.Point(x, y), {animate: false});
	},

	scrollDown: function (y, options) {
		this.scroll(0, y, options);
	},

	scrollRight: function (x, options) {
		this.scroll(x, 0, options);
	},

	scrollOffset: function () {
		var center = this.project(this.getCenter());
		var centerOffset = center.subtract(this.getSize().divideBy(2));
		var offset = {};
		offset.x = centerOffset.x < 0 ? 0 : Math.round(centerOffset.x);
		offset.y = centerOffset.y < 0 ? 0 : Math.round(centerOffset.y);
		return offset;
	},

	scrollTop: function (y, options) {
		this._setUpdateOffsetEvt(options);
		var offset = this.scrollOffset();
		console.debug('scrollTop: ' + y + ' ' + offset.y + ' ' + (y - offset.y));
		this.panBy(new L.Point(0, y - offset.y), {animate: false});
	},

	scrollLeft: function (x, options) {
		this._setUpdateOffsetEvt(options);
		var offset = this.scrollOffset();
		this.panBy(new L.Point(x - offset.x, 0), {animate: false});
	},

	_setUpdateOffsetEvt: function (e) {
		if (e && e.update === true) {
			this.on('moveend', this._docLayer._updateScrollOffset, this._docLayer);
		}
		else {
			this.off('moveend', this._docLayer._updateScrollOffset, this._docLayer);
		}
	},

	fitWidthZoom: function (maxZoom) {
		if (this._docLayer) {
			this._docLayer._fitWidthZoom(null, maxZoom);
		}
	}
});


/*
 * Objects containing LO style mappings
 */

L.Styles = {
	/* eslint no-dupe-keys:0 */
	// Programming names -> UI names mapping
	styleMappings: {
		'Default':'Default',
		'Result':'Result',
		'Result2':'Result2',
		'Heading':'Heading',
		'Heading1':'Heading1',
		'Default':'Default',
		'Report':'Report',
		'standard':'Default',
		'objectwitharrow':'Object with arrow',
		'objectwithshadow':'Object with shadow',
		'objectwithoutfill':'Object without fill',
		'Object with no fill and no line':'Object with no fill and no line',
		'text':'Text',
		'textbody':'Text body',
		'textbodyjustfied':'Text body justified',
		'textbodyindent':'First line indent',
		'title':'Title',
		'title1':'Title1',
		'title2':'Title2',
		'headline':'Heading',
		'headline1':'Heading1',
		'headline2':'Heading2',
		'measure':'Dimension Line',
		'Normal':'Normal',
		'Heading 1':'Heading 1',
		'Heading 2':'Heading 2',
		'Heading 3':'Heading 3',
		'Numbering Symbols':'Numbering Symbols',
		'Bullets':'Bullets',
		'Table Contents':'Table Contents',
		'Quotations':'Quotations',
		'Index':'Index',
		'Caption':'Caption',
		'List':'List',
		'Text Body':'Text Body',
		'default':'default',
		'gray1':'gray1',
		'gray2':'gray2',
		'gray3':'gray3',
		'bw1':'bw1',
		'bw2':'bw2',
		'bw3':'bw3',
		'orange1':'orange1',
		'orange2':'orange2',
		'orange3':'orange3',
		'turquoise1':'turquoise1',
		'turquoise2':'turquoise2',
		'turquoise3':'turquoise3',
		'blue1':'blue1',
		'blue2':'blue2',
		'blue3':'blue3',
		'sun1':'sun1',
		'sun2':'sun2',
		'sun3':'sun3',
		'earth1':'earth1',
		'earth2':'earth2',
		'earth3':'earth3',
		'green1':'green1',
		'green2':'green2',
		'green3':'green3',
		'seetang1':'seetang1',
		'seetang2':'seetang2',
		'seetang3':'seetang3',
		'lightblue1':'lightblue1',
		'lightblue2':'lightblue2',
		'lightblue3':'lightblue3',
		'yellow1':'yellow1',
		'yellow2':'yellow2',
		'yellow3':'yellow3',
		'default':'default',
		'bw':'bw',
		'orange':'orange',
		'turquoise':'turquoise',
		'blue':'blue',
		'sun':'sun',
		'earth':'earth',
		'green':'green',
		'seetang':'seetang',
		'lightblue':'lightblue',
		'yellow':'yellow',
		'background':'Background',
		'backgroundobjects':'Background objects',
		'notes':'Notes',
		'outline1':'Outline 1',
		'outline2':'Outline 2',
		'outline3':'Outline 3',
		'outline4':'Outline 4',
		'outline5':'Outline 5',
		'outline6':'Outline 6',
		'outline7':'Outline 7',
		'outline8':'Outline 8',
		'outline9':'Outline 9',
		'subtitle':'Subtitle',
		'title':'Title',
		'Clear formatting':'Clear formatting',
		'Default Style':'Default Style',
		'Bullet Symbols':'Bullets',
		'Numbering Symbols':'Numbering Symbols',
		'Footnote Symbol':'Footnote Characters',
		'Page Number':'Page Number',
		'Caption characters':'Caption Characters',
		'Drop Caps':'Drop Caps',
		'Internet link':'Internet Link',
		'Visited Internet Link':'Visited Internet Link',
		'Placeholder':'Placeholder',
		'Index Link':'Index Link',
		'Endnote Symbol':'Endnote Characters',
		'Line numbering':'Line Numbering',
		'Main index entry':'Main Index Entry',
		'Footnote anchor':'Footnote Anchor',
		'Endnote anchor':'Endnote Anchor',
		'Rubies':'Rubies',
		'Vertical Numbering Symbols':'Vertical Numbering Symbols',
		'Emphasis':'Emphasis',
		'Citation':'Quotation',
		'Strong Emphasis':'Strong Emphasis',
		'Source Text':'Source Text',
		'Example':'Example',
		'User Entry':'User Entry',
		'Variable':'Variable',
		'Definition':'Definition',
		'Teletype':'Teletype',
		'Text body':'Text Body',
		'Quotations':'Quotations',
		'Title':'Title',
		'Subtitle':'Subtitle',
		'Heading 1':'Heading 1',
		'Heading 2':'Heading 2',
		'Heading 3':'Heading 3',
		'Standard':'Default Style',
		'Heading':'Heading',
		'List':'List',
		'Caption':'Caption',
		'Index':'Index',
		'Table Contents':'Table Contents',
		'First line indent':'First Line Indent',
		'Hanging indent':'Hanging Indent',
		'Text body indent':'Text Body Indent',
		'Salutation':'Complimentary Close',
		'Signature':'Signature',
		'List Indent':'List Indent',
		'Marginalia':'Marginalia',
		'Heading 4':'Heading 4',
		'Heading 5':'Heading 5',
		'Heading 6':'Heading 6',
		'Heading 7':'Heading 7',
		'Heading 8':'Heading 8',
		'Heading 9':'Heading 9',
		'Heading 10':'Heading 10',
		'Numbering 1 Start':'Numbering 1 Start',
		'Numbering 1':'Numbering 1',
		'Numbering 1 End':'Numbering 1 End',
		'Numbering 1 Cont.':'Numbering 1 Cont.',
		'Numbering 2 Start':'Numbering 2 Start',
		'Numbering 2':'Numbering 2',
		'Numbering 2 End':'Numbering 2 End',
		'Numbering 2 Cont.':'Numbering 2 Cont.',
		'Numbering 3 Start':'Numbering 3 Start',
		'Numbering 3':'Numbering 3',
		'Numbering 3 End':'Numbering 3 End',
		'Numbering 3 Cont.':'Numbering 3 Cont.',
		'Numbering 4 Start':'Numbering 4 Start',
		'Numbering 4':'Numbering 4',
		'Numbering 4 End':'Numbering 4 End',
		'Numbering 4 Cont.':'Numbering 4 Cont.',
		'Numbering 5 Start':'Numbering 5 Start',
		'Numbering 5':'Numbering 5',
		'Numbering 5 End':'Numbering 5 End',
		'Numbering 5 Cont.':'Numbering 5 Cont.',
		'List 1 Start':'List 1 Start',
		'List 1':'List 1',
		'List 1 End':'List 1 End',
		'List 1 Cont.':'List 1 Cont.',
		'List 2 Start':'List 2 Start',
		'List 2':'List 2',
		'List 2 End':'List 2 End',
		'List 2 Cont.':'List 2 Cont.',
		'List 3 Start':'List 3 Start',
		'List 3':'List 3',
		'List 3 End':'List 3 End',
		'List 3 Cont.':'List 3 Cont.',
		'List 4 Start':'List 4 Start',
		'List 4':'List 4',
		'List 4 End':'List 4 End',
		'List 4 Cont.':'List 4 Cont.',
		'List 5 Start':'List 5 Start',
		'List 5':'List 5',
		'List 5 End':'List 5 End',
		'List 5 Cont.':'List 5 Cont.',
		'Index Heading':'Index Heading',
		'Index 1':'Index 1',
		'Index 2':'Index 2',
		'Index 3':'Index 3',
		'Index Separator':'Index Separator',
		'Contents Heading':'Contents Heading',
		'Contents 1':'Contents 1',
		'Contents 2':'Contents 2',
		'Contents 3':'Contents 3',
		'Contents 4':'Contents 4',
		'Contents 5':'Contents 5',
		'User Index Heading':'User Index Heading',
		'User Index 1':'User Index 1',
		'User Index 2':'User Index 2',
		'User Index 3':'User Index 3',
		'User Index 4':'User Index 4',
		'User Index 5':'User Index 5',
		'Contents 6':'Contents 6',
		'Contents 7':'Contents 7',
		'Contents 8':'Contents 8',
		'Contents 9':'Contents 9',
		'Contents 10':'Contents 10',
		'Illustration Index Heading':'Illustration Index Heading',
		'Illustration Index 1':'Illustration Index 1',
		'Object index heading':'Object Index Heading',
		'Object index 1':'Object Index 1',
		'Table index heading':'Table Index Heading',
		'Table index 1':'Table Index 1',
		'Bibliography Heading':'Bibliography Heading',
		'Bibliography 1':'Bibliography 1',
		'User Index 6':'User Index 6',
		'User Index 7':'User Index 7',
		'User Index 8':'User Index 8',
		'User Index 9':'User Index 9',
		'User Index 10':'User Index 10',
		'Header':'Header',
		'Header left':'Header Left',
		'Header right':'Header Right',
		'Footer':'Footer',
		'Footer left':'Footer Left',
		'Footer right':'Footer Right',
		'Table Heading':'Table Heading',
		'Illustration':'Illustration',
		'Table':'Table',
		'Text':'Text',
		'Frame contents':'Frame Contents',
		'Footnote':'Footnote',
		'Addressee':'Addressee',
		'Sender':'Sender',
		'Endnote':'Endnote',
		'Drawing':'Drawing',
		'Preformatted Text':'Preformatted Text',
		'Horizontal Line':'Horizontal Line',
		'List Contents':'List Contents',
		'List Heading':'List Heading',
		'Standard':'Default Style',
		'First Page':'First Page',
		'Left Page':'Left Page',
		'Right Page':'Right Page',
		'Envelope':'Envelope',
		'Index':'Index',
		'HTML':'HTML',
		'Footnote':'Footnote',
		'Endnote':'Endnote',
		'Landscape':'Landscape',
		'Graphics':'Graphics',
		'Frame':'Frame',
		'OLE':'OLE',
		'Formula':'Formula',
		'Marginalia':'Marginalia',
		'Watermark':'Watermark',
		'Labels':'Labels',
		'Numbering 1':'Numbering 1',
		'Numbering 2':'Numbering 2',
		'Numbering 3':'Numbering 3',
		'Numbering 4':'Numbering 4',
		'Numbering 5':'Numbering 5',
		'List 1':'List 1',
		'List 2':'List 2',
		'List 3':'List 3',
		'List 4':'List 4',
		'List 5':'List 5'
	},

	// For impress documents, LOK STATE_CHANGED callback return these internal names
	// which are different from what is returned by initial .uno:StyleApply.
	// Convert these names to our stored internal names before processing
	impressMapping : {
		'Titel':'title',
		'Untertitel':'subtitle',
		'Gliederung 1':'outline1',
		'Gliederung 2':'outline2',
		'Gliederung 3':'outline3',
		'Gliederung 4':'outline4',
		'Gliederung 5':'outline5',
		'Gliederung 6':'outline6',
		'Gliederung 7':'outline7',
		'Gliederung 8':'outline8',
		'Gliederung 9':'outline9',
		'Hintergrund':'background',
		'Hintergrundobjekte':'backgroundobjects',
		'Notizen':'notes'
	},

	impressLayout : [
		{id: 0, text: 'Title Slide'},
		{id: 1, text: 'Title, Content'},
		{id: 3, text: 'Title and 2 Content'},
		{id: 19, text: 'Title Only'},
		{id: 20, text: 'Blank Slide'},
		{id: 32, text: 'Centered Text'},
		{id: 12, text: 'Title, Content and 2 Content'},
		{id: 15, text: 'Title, 2 Content and Content'},
		{id: 16, text: 'Title, 2 Content over Content'},
		{id: 14, text: 'Title, Content over Content'},
		{id: 18, text: 'Title, 4 Content'},
		{id: 34, text: 'Title, 6 Content'},
		{id: 27, text: 'Vertical Title, Text, Chart'},
		{id: 28, text: 'Vertical Title, Vertical Text'},
		{id: 29, text: 'Title, Vertical Text'},
		{id: 30, text: 'Title, Vertical Text, Clipart'}
	],

	insertMode : {
		'true'  : 'Insert',
		'false' : 'Overwrite'
	},

	selectionMode : [
		'Standard selection',
		'Extending selection',
		'Adding selection',
		'Block selection'
	],
};


/*
 * L.PosAnimation is used by Leaflet internally for pan animations.
 */

L.PosAnimation = L.Class.extend({
	includes: L.Mixin.Events,

	run: function (el, newPos, duration, easeLinearity) { // (HTMLElement, Point[, Number, Number])
		this.stop();

		this._el = el;
		this._inProgress = true;
		this._newPos = newPos;

		this.fire('start');

		el.style[L.DomUtil.TRANSITION] = 'all ' + (duration || 0.25) +
		        's cubic-bezier(0,0,' + (easeLinearity || 0.5) + ',1)';

		L.DomEvent.on(el, L.DomUtil.TRANSITION_END, this._onTransitionEnd, this);
		L.DomUtil.setPosition(el, newPos);

		// toggle reflow, Chrome flickers for some reason if you don't do this
		L.Util.falseFn(el.offsetWidth);

		// there's no native way to track value updates of transitioned properties, so we imitate this
		this._stepTimer = setInterval(L.bind(this._onStep, this), 50);
	},

	stop: function () {
		if (!this._inProgress) { return; }

		// if we just removed the transition property, the element would jump to its final position,
		// so we need to make it stay at the current position

		L.DomUtil.setPosition(this._el, this._getPos());
		this._onTransitionEnd();
		L.Util.falseFn(this._el.offsetWidth); // force reflow in case we are about to start a new animation
	},

	_onStep: function () {
		var stepPos = this._getPos();
		if (!stepPos) {
			this._onTransitionEnd();
			return;
		}
		/*eslint-disable camelcase*/
		// make L.DomUtil.getPosition return intermediate position value during animation
		this._el._leaflet_pos = stepPos;
		/*eslint-enable camelcase*/

		this.fire('step');
	},

	// you can't easily get intermediate values of properties animated with CSS3 Transitions,
	// we need to parse computed style (in case of transform it returns matrix string)

	_transformRe: /([-+]?(?:\d*\.)?\d+)\D*, ([-+]?(?:\d*\.)?\d+)\D*\)/,

	_getPos: function () {
		var left, top, matches,
		    el = this._el,
		    style = window.getComputedStyle(el);

		if (L.Browser.any3d) {
			matches = style[L.DomUtil.TRANSFORM].match(this._transformRe);
			if (!matches) { return; }
			left = parseFloat(matches[1]);
			top  = parseFloat(matches[2]);
		} else {
			left = parseFloat(style.left);
			top  = parseFloat(style.top);
		}

		return new L.Point(left, top, true);
	},

	_onTransitionEnd: function () {
		L.DomEvent.off(this._el, L.DomUtil.TRANSITION_END, this._onTransitionEnd, this);

		if (!this._inProgress) { return; }
		this._inProgress = false;

		this._el.style[L.DomUtil.TRANSITION] = '';

		/*eslint-disable camelcase*/
		// make sure L.DomUtil.getPosition returns the final position value after animation
		this._el._leaflet_pos = this._newPos;
		/*eslint-enable camelcase*/

		clearInterval(this._stepTimer);

		this.fire('step').fire('end');
	}

});


/*
 * Extends L.Map to handle panning animations.
 */

L.Map.include({

	setView: function (center, zoom, options) {

		zoom = zoom === undefined ? this._zoom : this._limitZoom(zoom);
		center = this._limitCenter(L.latLng(center), zoom, this.options.maxBounds);
		options = options || {};

		this.stop();

		if (this._loaded && !options.reset && options !== true) {

			if (options.animate !== undefined) {
				options.zoom = L.extend({animate: options.animate}, options.zoom);
				options.pan = L.extend({animate: options.animate}, options.pan);
			}

			// try animating pan or zoom
			var animated = (this._zoom !== zoom) ?
				this._tryAnimatedZoom && this._tryAnimatedZoom(center, zoom, options.zoom) :
				this._tryAnimatedPan(center, options.pan);

			if (animated) {
				// prevent resize handler call, the view will refresh after animation anyway
				clearTimeout(this._sizeTimer);
				return this;
			}
		}

		// animation didn't start, just reset the map view
		this._resetView(center, zoom);

		return this;
	},

	panBy: function (offset, options) {
		offset = L.point(offset).round();
		options = options || {};

		if (!offset.x && !offset.y) {
			return this;
		}
		//If we pan too far then chrome gets issues with tiles
		// and makes them disappear or appear in the wrong place (slightly offset) #2602
		if (options.animate !== true && !this.getSize().contains(offset)) {
			this._resetView(this.unproject(this.project(this.getCenter()).add(offset)), this.getZoom());
			return this;
		}

		if (!this._panAnim) {
			this._panAnim = new L.PosAnimation();

			this._panAnim.on({
				'step': this._onPanTransitionStep,
				'end': this._onPanTransitionEnd
			}, this);
		}

		// don't fire movestart if animating inertia
		if (!options.noMoveStart) {
			this.fire('movestart');
		}

		// animate pan if animate: true specified
		if (options.animate === true) {
			L.DomUtil.addClass(this._mapPane, 'leaflet-pan-anim');

			var newPos = this._getMapPanePos().subtract(offset);
			this._panAnim.run(this._mapPane, newPos, options.duration || 0.25, options.easeLinearity);
		} else {
			this._rawPanBy(offset);
			this.fire('move').fire('moveend');
		}

		return this;
	},

	_onPanTransitionStep: function () {
		this.fire('move');
	},

	_onPanTransitionEnd: function () {
		L.DomUtil.removeClass(this._mapPane, 'leaflet-pan-anim');
		this.fire('moveend');
	},

	_tryAnimatedPan: function (center, options) {
		// difference between the new and current centers in pixels
		var offset = this._getCenterOffset(center)._floor();

		// don't animate too far unless animate: true specified in options
		if ((options && options.animate) !== true && !this.getSize().contains(offset)) { return false; }

		this.panBy(offset, options);

		return (options && options.animate) !== false;
	}
});


/*
 * L.PosAnimation fallback implementation that powers Leaflet pan animations
 * in browsers that don't support CSS3 Transitions.
 */

L.PosAnimation = L.DomUtil.TRANSITION ? L.PosAnimation : L.PosAnimation.extend({

	run: function (el, newPos, duration, easeLinearity) { // (HTMLElement, Point[, Number, Number])
		this.stop();

		this._el = el;
		this._inProgress = true;
		this._duration = duration || 0.25;
		this._easeOutPower = 1 / Math.max(easeLinearity || 0.5, 0.2);

		this._startPos = L.DomUtil.getPosition(el);
		this._offset = newPos.subtract(this._startPos);
		this._startTime = +new Date();

		this.fire('start');

		this._animate();
	},

	stop: function () {
		if (!this._inProgress) { return; }

		this._step();
		this._complete();
	},

	_animate: function () {
		// animation loop
		this._animId = L.Util.requestAnimFrame(this._animate, this);
		this._step();
	},

	_step: function () {
		var elapsed = (+new Date()) - this._startTime,
		    duration = this._duration * 1000;

		if (elapsed < duration) {
			this._runFrame(this._easeOut(elapsed / duration));
		} else {
			this._runFrame(1);
			this._complete();
		}
	},

	_runFrame: function (progress) {
		var pos = this._startPos.add(this._offset.multiplyBy(progress));
		L.DomUtil.setPosition(this._el, pos);

		this.fire('step');
	},

	_complete: function () {
		L.Util.cancelAnimFrame(this._animId);

		this._inProgress = false;
		this.fire('end');
	},

	_easeOut: function (t) {
		return 1 - Math.pow(1 - t, this._easeOutPower);
	}
});


/*
 * Extends L.Map to handle zoom animations.
 */

L.Map.mergeOptions({
	zoomAnimation: true,
	zoomAnimationThreshold: 4
});

var zoomAnimated = L.DomUtil.TRANSITION && L.Browser.any3d && !L.Browser.mobileOpera;

if (zoomAnimated) {

	L.Map.addInitHook(function () {
		// don't animate on browsers without hardware-accelerated transitions or old Android/Opera
		this._zoomAnimated = this.options.zoomAnimation;

		// zoom transitions run with the same duration for all layers, so if one of transitionend events
		// happens after starting zoom animation (propagating to the map pane), we know that it ended globally
		if (this._zoomAnimated) {

			this._createAnimProxy();

			L.DomEvent.on(this._proxy, L.DomUtil.TRANSITION_END, this._catchTransitionEnd, this);
		}
	});
}

L.Map.include(!zoomAnimated ? {} : {

	_createAnimProxy: function () {

		var proxy = this._proxy = L.DomUtil.create('div', 'leaflet-proxy leaflet-zoom-animated');
		this._panes.mapPane.appendChild(proxy);

		this.on('zoomanim', function (e) {
			var prop = L.DomUtil.TRANSFORM,
			    transform = proxy.style[prop];

			L.DomUtil.setTransform(proxy, this.project(e.center, e.zoom), this.getZoomScale(e.zoom, 1));

			// workaround for case when transform is the same and so transitionend event is not fired
			if (transform === proxy.style[prop] && this._animatingZoom) {
				this._onZoomTransitionEnd();
			}
		}, this);

		this.on('load moveend', function () {
			var c = this.getCenter(),
			    z = this.getZoom();
			L.DomUtil.setTransform(proxy, this.project(c, z), this.getZoomScale(z, 1));
		}, this);
	},

	_catchTransitionEnd: function (e) {
		if (this._animatingZoom && e.propertyName.indexOf('transform') >= 0) {
			this._onZoomTransitionEnd();
		}
	},

	_nothingToAnimate: function () {
		return !this._container.getElementsByClassName('leaflet-zoom-animated').length;
	},

	_tryAnimatedZoom: function (center, zoom, options) {

		if (this._animatingZoom) { return true; }

		options = options || {};

		// don't animate if disabled, not supported or zoom difference is too large
		if (!this._zoomAnimated || options.animate === false || this._nothingToAnimate() ||
		        Math.abs(zoom - this._zoom) > this.options.zoomAnimationThreshold) { return false; }

		// offset is the pixel coords of the zoom origin relative to the current center
		var scale = this.getZoomScale(zoom),
		    offset = this._getCenterOffset(center)._divideBy(1 - 1 / scale);

		// don't animate if the zoom origin isn't within one screen from the current center, unless forced
		if (options.animate !== true && !this.getSize().contains(offset)) { return false; }

		L.Util.requestAnimFrame(function () {
			this
			    .fire('movestart')
			    .fire('zoomstart')
			    ._animateZoom(center, zoom, true);
		}, this);

		return true;
	},

	_animateZoom: function (center, zoom, startAnim, noUpdate) {
		if (startAnim) {
			this._animatingZoom = true;

			// remember what center/zoom to set after animation
			this._animateToCenter = center;
			this._animateToZoom = zoom;

			L.DomUtil.addClass(this._mapPane, 'leaflet-zoom-anim');
		}

		this.fire('zoomanim', {
			center: center,
			zoom: zoom,
			scale: this.getZoomScale(zoom),
			origin: this.latLngToLayerPoint(center),
			offset: this._getCenterOffset(center).multiplyBy(-1),
			noUpdate: noUpdate
		});
	},

	_onZoomTransitionEnd: function () {

		this._animatingZoom = false;

		L.DomUtil.removeClass(this._mapPane, 'leaflet-zoom-anim');

		this._resetView(this._animateToCenter, this._animateToZoom, true, true);
	}
});



L.Map.include({
	flyTo: function (targetCenter, targetZoom) {

		this.stop();

		var from = this.project(this.getCenter()),
		    to = this.project(targetCenter),
		    size = this.getSize(),
		    startZoom = this._zoom;

		targetCenter = L.latLng(targetCenter);
		targetZoom = targetZoom === undefined ? startZoom : targetZoom;

		var w0 = Math.max(size.x, size.y),
		    w1 = w0 * this.getZoomScale(startZoom, targetZoom),
		    u1 = to.distanceTo(from),
		    rho = 1.42,
		    rho2 = rho * rho;

		function r(i) {
			var b = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
			return Math.log(Math.sqrt(b * b + 1) - b);
		}

		function sinh(n) { return (Math.exp(n) - Math.exp(-n)) / 2; }
		function cosh(n) { return (Math.exp(n) + Math.exp(-n)) / 2; }
		function tanh(n) { return sinh(n) / cosh(n); }

		var r0 = r(0);

		function w(s) { return w0 * (cosh(r0) / cosh(r0 + rho * s)); }
		function u(s) { return w0 * (cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2; }

		function easeOut(t) { return 1 - Math.pow(1 - t, 1.5); }

		var start = Date.now(),
		    S = (r(1) - r0) / rho,
		    duration = 1000 * S * 0.8;

		function frame() {
			var t = (Date.now() - start) / duration,
			    s = easeOut(t) * S;

			if (t <= 1) {
				this._flyToFrame = L.Util.requestAnimFrame(frame, this);

				this._resetView(
					this.unproject(from.add(to.subtract(from).multiplyBy(u(s) / u1)), startZoom),
					this.getScaleZoom(w0 / w(s), startZoom), true, true);

			} else {
				this._resetView(targetCenter, targetZoom, true, true);
			}
		}

		this.fire('zoomstart');
		frame.call(this);
	}
});


/*
 * Provides L.Map with convenient shortcuts for using browser geolocation features.
 */

L.Map.include({
	_defaultLocateOptions: {
		timeout: 10000,
		watch: false
		// setView: false
		// maxZoom: <Number>
		// maximumAge: 0
		// enableHighAccuracy: false
	},

	locate: function (/*Object*/ options) {

		options = this._locateOptions = L.extend({}, this._defaultLocateOptions, options);

		if (!navigator.geolocation) {
			this._handleGeolocationError({
				code: 0,
				message: 'Geolocation not supported.'
			});
			return this;
		}

		var onResponse = L.bind(this._handleGeolocationResponse, this),
		    onError = L.bind(this._handleGeolocationError, this);

		if (options.watch) {
			this._locationWatchId =
			        navigator.geolocation.watchPosition(onResponse, onError, options);
		} else {
			navigator.geolocation.getCurrentPosition(onResponse, onError, options);
		}
		return this;
	},

	stopLocate: function () {
		if (navigator.geolocation) {
			navigator.geolocation.clearWatch(this._locationWatchId);
		}
		if (this._locateOptions) {
			this._locateOptions.setView = false;
		}
		return this;
	},

	_handleGeolocationError: function (error) {
		var c = error.code,
		    message = error.message ||
		            (c === 1 ? 'permission denied' :
		            (c === 2 ? 'position unavailable' : 'timeout'));

		if (this._locateOptions.setView && !this._loaded) {
			this.fitWorld();
		}

		this.fire('locationerror', {
			code: c,
			message: 'Geolocation error: ' + message + '.'
		});
	},

	_handleGeolocationResponse: function (pos) {
		var lat = pos.coords.latitude,
		    lng = pos.coords.longitude,
		    latlng = new L.LatLng(lat, lng),
		    bounds = latlng.toBounds(pos.coords.accuracy),
		    options = this._locateOptions;

		if (options.setView) {
			var zoom = this.getBoundsZoom(bounds);
			this.setView(latlng, options.maxZoom ? Math.min(zoom, options.maxZoom) : zoom);
		}

		var data = {
			latlng: latlng,
			bounds: bounds,
			timestamp: pos.timestamp
		};

		for (var i in pos.coords) {
			if (typeof pos.coords[i] === 'number') {
				data[i] = pos.coords[i];
			}
		}

		this.fire('locationfound', data);
	}
});


/*
 *  L.AnnotationManager
 */

L.AnnotationManager = L.Class.extend({
	options: {
		marginX: 40,
		marginY: 10,
		offset: 5,
		extraSize: L.point(290, 0)
	},

	initialize: function (map, options) {
		this._map = map;
		this._items = [];
		this._selected = null;
		L.setOptions(this, options);
		this._arrow = L.polyline([], {color: 'darkblue', weight: 1});
		this._map.on('zoomend', this._onAnnotationZoom, this);
		this._map.on('AnnotationCancel', this._onAnnotationCancel, this);
		this._map.on('AnnotationClick', this._onAnnotationClick, this);
		this._map.on('AnnotationReply', this._onAnnotationReply, this);
		this._map.on('AnnotationSave', this._onAnnotationSave, this);
		this._map.on('RedlineAccept', this._onRedlineAccept, this);
		this._map.on('RedlineReject', this._onRedlineReject, this);
	},

	// Remove only text comments from the document (excluding change tracking comments)
	clear: function () {
		for (var key in this._items) {
			if (!this._items[key].trackchange) {
				this._map.removeLayer(this._items[key]);
			}
		}
		this._items = [];
		this._selected = null;
		this._map.removeLayer(this._arrow);
	},

	// Remove only change tracking comments from the document
	clearChanges: function() {
		for (var key in this._items) {
			if (this._items[key].trackchange) {
				this._map.removeLayer(this._items[key]);
			}
		}
	},

	adjustComment: function(comment) {
		var rectangles, color, viewId;
		comment.trackchange = false;
		rectangles = L.PolyUtil.rectanglesToPolygons(L.LOUtil.stringToRectangles(comment.textRange || comment.anchorPos), this._map._docLayer);
		comment.anchorPos = L.LOUtil.stringToBounds(comment.anchorPos);
		comment.anchorPix = this._map._docLayer._twipsToPixels(comment.anchorPos.min);
		viewId = this._map.getViewId(comment.author);
		color = viewId >= 0 ? L.LOUtil.rgbToHex(this._map.getViewColor(viewId)) : '#43ACE8';
		if (rectangles.length > 0) {
			comment.textSelected = L.polygon(rectangles, {
				pointerEvents: 'all',
				interactive: false,
				fillColor: color,
				fillOpacity: 0.25,
				weight: 2,
				opacity: 0.25
			});
			comment.textSelected.on('click', function(e) {
				// Simulate a click at this position in the document
				var latlng = this._map.mouseEventToLatLng(e.originalEvent);
				var pos = this._map._docLayer._latLngToTwips(latlng);
				this._map._docLayer._postMouseEvent('buttondown', pos.x, pos.y, 1, 1, 0);
				this._map._docLayer._postMouseEvent('buttonup', pos.x, pos.y, 1, 1, 0);

				// Also select this comment
				this.selectById(comment.id);
			}, this);
		}
	},

	adjustRedLine: function(redline) {
		// All sane values ?
		if (!redline.textRange) {
			console.warn('Redline received has invalid textRange');
			return false;
		}

		var rectangles, color, viewId;
		// transform change tracking index into an id
		redline.id = 'change-' + redline.index;
		redline.anchorPos = L.LOUtil.stringToBounds(redline.textRange);
		redline.anchorPix = this._map._docLayer._twipsToPixels(redline.anchorPos.min);
		redline.trackchange = true;
		redline.text = redline.comment;
		rectangles = L.PolyUtil.rectanglesToPolygons(L.LOUtil.stringToRectangles(redline.textRange), this._map._docLayer);
		viewId = this._map.getViewId(redline.author);
		color = viewId >= 0 ? L.LOUtil.rgbToHex(this._map.getViewColor(viewId)) : '#43ACE8';
		if (rectangles.length > 0) {
			redline.textSelected = L.polygon(rectangles, {
				pointerEvents: 'all',
				interactive: false,
				fillOpacity: 0,
				opacity: 0
			});
			redline.textSelected.on('click', function(e) {
				// Simulate a click at this position in the document
				var latlng = this._map.mouseEventToLatLng(e.originalEvent);
				var pos = this._map._docLayer._latLngToTwips(latlng);
				this._map._docLayer._postMouseEvent('buttondown', pos.x, pos.y, 1, 1, 0);
				this._map._docLayer._postMouseEvent('buttonup', pos.x, pos.y, 1, 1, 0);

				this.selectById(redline.id);
			}, this);
		}

		return true;
	},

	// Fill normal comments in the documents
	fill: function (comments) {
		var comment;
		this.clear();
		// items contains redlines
		var ordered = !this._items.length > 0;
		for (var index in comments) {
			comment = comments[index];
			this.adjustComment(comment);
			if (comment.author in this._map._viewInfoByUser) {
				comment.avatar = this._map._viewInfoByUser[comment.author].userextrainfo.avatar;
			}
			this._items.push(L.annotation(this._map.options.maxBounds.getSouthEast(), comment).addTo(this._map));
		}
		if (this._items.length > 0) {
			if (!ordered) {
				this._items.sort(function(a, b) {
					return Math.abs(a._data.anchorPos.min.y) - Math.abs(b._data.anchorPos.min.y) ||
						Math.abs(a._data.anchorPos.min.x) - Math.abs(b._data.anchorPos.min.x);
				});
			}
			this._map._docLayer._updateMaxBounds(true);
			this.layout();
		}
	},

	fillChanges: function(redlines) {
		var changecomment;
		this.clearChanges();
		// items contains comments
		var ordered = !this._items.length > 0;
		for (var idx in redlines) {
			changecomment = redlines[idx];
			if (!this.adjustRedLine(changecomment)) {
				// something wrong in this redline, skip this one
				continue;
			}
			if (changecomment.author in this._map._viewInfoByUser) {
				changecomment.avatar = this._map._viewInfoByUser[changecomment.author].userextrainfo.avatar;
			}
			this._items.push(L.annotation(this._map.options.maxBounds.getSouthEast(), changecomment).addTo(this._map));
		}
		if (this._items.length > 0) {
			if (!ordered) {
				this._items.sort(function(a, b) {
					return Math.abs(a._data.anchorPos.min.y) - Math.abs(b._data.anchorPos.min.y) ||
						Math.abs(a._data.anchorPos.min.x) - Math.abs(b._data.anchorPos.min.x);
				});
			}
			this._map._docLayer._updateMaxBounds(true);
			this.layout();
		}
	},

	getItem: function (id) {
		for (var iterator in this._items) {
			if (this._items[iterator]._data.id === id) {
				return this._items[iterator];
			}
		}
		return null;
	},

	getIndexOf: function (id) {
		for (var index = 0; index < this._items.length; index++) {
			if (this._items[index]._data.id === id) {
				return index;
			}
		}
		return -1;
	},

	// Returns the root comment id of given id
	getRootIndexOf: function(id) {
		var index = this.getIndexOf(id);
		for (var idx = index - 1;
			     idx >=0 && this._items[idx]._data.id === this._items[idx + 1]._data.parent;
			     idx--)
		{
			index = idx;
		}

		return index;
	},

	// Returns the last comment id of comment thread containing the given id
	getLastChildIndexOf: function(id) {
		var index = this.getIndexOf(id);
		for (var idx = index + 1;
		     idx < this._items.length && this._items[idx]._data.parent === this._items[idx - 1]._data.id;
		     idx++)
		{
			index = idx;
		}

		return index;
	},

	removeItem: function (id) {
		var annotation;
		for (var iterator in this._items) {
			annotation = this._items[iterator];
			if (annotation._data.id === id) {
				this._items.splice(iterator, 1);
				return annotation;
			}
		}
	},

	unselect: function () {
		if (this._selected) {
			this._selected = null;
			this.update();
		}
	},

	select: function (annotation) {
		if (annotation) {
			// Select the root comment
			var idx = this.getRootIndexOf(annotation._data.id);
			this._selected = this._items[idx];
			this.update();
		}
	},

	selectById: function(commentId) {
		var idx = this.getRootIndexOf(commentId);
		this._selected = this._items[idx];
		this.update();
	},

	update: function () {
		if (this._selected) {
			var point;
			var scale = this._map.getZoomScale(this._map.getZoom(), 10);
			var docRight = this._map.project(this._map.options.maxBounds.getNorthEast()).subtract(this.options.extraSize.multiplyBy(scale));
			point = this._map._docLayer._twipsToPixels(this._selected._data.anchorPos.min);
			this._arrow.setLatLngs([this._map.unproject(point), map.unproject(L.point(docRight.x, point.y))]);
			this._map.addLayer(this._arrow);
		} else {
			this._map.removeLayer(this._arrow);
		}
		this.layout();
	},

	updateDocBounds: function (count, extraSize) {
		if (this._items.length === count) {
			this._map._docLayer._updateMaxBounds(true, extraSize);
		}
	},

	layoutUp: function (commentThread, latLng, layoutBounds) {
		if (commentThread.length <= 0)
			return;

		(new L.PosAnimation()).run(commentThread[0]._container, this._map.latLngToLayerPoint(latLng));
		commentThread[0].setLatLng(latLng);
		var bounds = commentThread[0].getBounds();
		var idx = 1;
		while (idx < commentThread.length) {
			bounds.extend(bounds.max.add([0, commentThread[idx].getBounds().getSize().y]));
			idx++;
		}

		var pt;
		if (layoutBounds.intersects(bounds)) {
			layoutBounds.extend(layoutBounds.min.subtract([0, bounds.getSize().y]));
			pt = layoutBounds.min;
		} else {
			pt = bounds.min;
			layoutBounds.extend(bounds.min);
		}
		layoutBounds.extend(layoutBounds.min.subtract([0, this.options.marginY]));

		idx = 0;
		for (idx = 0; idx < commentThread.length; ++idx) {
			latLng = this._map.layerPointToLatLng(pt);
			(new L.PosAnimation()).run(commentThread[idx]._container, this._map.latLngToLayerPoint(latLng));
			commentThread[idx].setLatLng(latLng);
			commentThread[idx].show();

			var commentBounds = commentThread[idx].getBounds();
			pt = pt.add([0, commentBounds.getSize().y]);
		}
	},

	layoutDown: function (commentThread, latLng, layoutBounds) {
		if (commentThread.length <= 0)
			return;

		(new L.PosAnimation()).run(commentThread[0]._container, this._map.latLngToLayerPoint(latLng));
		commentThread[0].setLatLng(latLng);
		var bounds = commentThread[0].getBounds();
		var idx = 1;
		while (idx < commentThread.length) {
			bounds.extend(bounds.max.add([0, commentThread[idx].getBounds().getSize().y]));
			idx++;
		}

		var pt;
		if (layoutBounds.intersects(bounds)) {
			pt = layoutBounds.getBottomLeft();
			layoutBounds.extend(layoutBounds.max.add([0, bounds.getSize().y]));
		} else {
			pt = bounds.min;
			layoutBounds.extend(bounds.max);
		}
		layoutBounds.extend(layoutBounds.max.add([0, this.options.marginY]));

		idx = 0;
		for (idx = 0; idx < commentThread.length; ++idx) {
			latLng = this._map.layerPointToLatLng(pt);
			(new L.PosAnimation()).run(commentThread[idx]._container, this._map.latLngToLayerPoint(latLng));
			commentThread[idx].setLatLng(latLng);
			commentThread[idx].show();

			var commentBounds = commentThread[idx].getBounds();
			pt = pt.add([0, commentBounds.getSize().y]);
		}
	},

	layout: function (zoom) {
		var scale = this._map.getZoomScale(this._map.getZoom(), 10);
		var docRight = this._map.project(this._map.options.maxBounds.getNorthEast()).subtract(this.options.extraSize.multiplyBy(scale));
		var topRight = docRight.add(L.point(this.options.marginX, this.options.marginY));
		var latlng, layoutBounds, point, idx;
		if (this._selected) {
			var selectIndexFirst = this.getRootIndexOf(this._selected._data.id);
			var selectIndexLast = this.getLastChildIndexOf(this._selected._data.id);
			if (zoom) {
				this._items[selectIndexFirst]._data.anchorPix = this._map._docLayer._twipsToPixels(this._items[selectIndexFirst]._data.anchorPos.min);
			}
			latlng = this._map.unproject(L.point(docRight.x, this._items[selectIndexFirst]._data.anchorPix.y));
			(new L.PosAnimation()).run(this._items[selectIndexFirst]._container, this._map.latLngToLayerPoint(latlng));
			this._items[selectIndexFirst].setLatLng(latlng);
			layoutBounds = this._items[selectIndexFirst].getBounds();

			// Adjust child comments too, if any
			for (idx = selectIndexFirst + 1; idx <= selectIndexLast; idx++) {
				if (zoom) {
					this._items[idx]._data.anchorPix = this._map._docLayer._twipsToPixels(this._items[idx]._data.anchorPos.min);
				}

				latlng = this._map.layerPointToLatLng(layoutBounds.getBottomLeft());
				(new L.PosAnimation()).run(this._items[idx]._container, layoutBounds.getBottomLeft());
				this._items[idx].setLatLng(latlng);

				var commentBounds = this._items[idx].getBounds();
				layoutBounds.extend(layoutBounds.max.add([0, commentBounds.getSize().y]));
			}

			layoutBounds.min = layoutBounds.min.add([this.options.marginX, 0]);
			layoutBounds.max = layoutBounds.max.add([this.options.marginX, 0]);
			layoutBounds.extend(layoutBounds.min.subtract([0, this.options.marginY]));
			layoutBounds.extend(layoutBounds.max.add([0, this.options.marginY]));
			for (idx = selectIndexFirst - 1; idx >= 0;) {
				var commentThread = [];
				var tmpIdx = idx;
				do {
					if (zoom) {
						this._items[idx]._data.anchorPix = this._map._docLayer._twipsToPixels(this._items[idx]._data.anchorPos.min);
					}
					commentThread.push(this._items[tmpIdx]);
					tmpIdx = tmpIdx - 1;
				} while (tmpIdx >= 0 && this._items[tmpIdx]._data.id === this._items[tmpIdx + 1]._data.parent);

				commentThread.reverse();
				// All will have some anchor position
				this.layoutUp(commentThread, this._map.unproject(L.point(topRight.x, commentThread[0]._data.anchorPix.y)), layoutBounds);
				idx = idx - commentThread.length;
			}
			for (idx = selectIndexLast + 1; idx < this._items.length;) {
				commentThread = [];
				tmpIdx = idx;
				do {
					if (zoom) {
						this._items[idx]._data.anchorPix = this._map._docLayer._twipsToPixels(this._items[idx]._data.anchorPos.min);
					}
					commentThread.push(this._items[tmpIdx]);
					tmpIdx = tmpIdx + 1;
				} while (tmpIdx < this._items.length && this._items[tmpIdx]._data.parent === this._items[tmpIdx - 1]._data.id);

				// All will have some anchor position
				this.layoutDown(commentThread, this._map.unproject(L.point(topRight.x, commentThread[0]._data.anchorPix.y)), layoutBounds);
				idx = idx + commentThread.length;
			}
			if (!this._selected.isEdit()) {
				this._selected.show();
			}
		} else {
			point = this._map.latLngToLayerPoint(this._map.unproject(topRight));
			layoutBounds = L.bounds(point, point);
			for (idx = 0; idx < this._items.length;) {
				commentThread = [];
				tmpIdx = idx;
				do {
					if (zoom) {
						this._items[tmpIdx]._data.anchorPix = this._map._docLayer._twipsToPixels(this._items[tmpIdx]._data.anchorPos.min);
					}
					commentThread.push(this._items[tmpIdx]);
					tmpIdx = tmpIdx + 1;
				} while (tmpIdx < this._items.length && this._items[tmpIdx]._data.parent === this._items[tmpIdx - 1]._data.id);

				this.layoutDown(commentThread, this._map.unproject(L.point(topRight.x, commentThread[0]._data.anchorPix.y)), layoutBounds);
				idx = idx + commentThread.length;
			}
		}
	},

	add: function (comment) {
		var annotation = L.annotation(this._map._docLayer._twipsToLatLng(comment.anchorPos.getTopRight()), comment,
			comment.id === 'new' ? {noMenu: true} : {}).addTo(this._map);
		if (comment.parent && comment.parent > '0') {
			var parentIdx = this.getIndexOf(comment.parent);
			this._items.splice(parentIdx + 1, 0, annotation);
		} else {
			this._items.push(annotation);
		}
		this._items.sort(function(a, b) {
			return Math.abs(a._data.anchorPos.min.y) - Math.abs(b._data.anchorPos.min.y) ||
				Math.abs(a._data.anchorPos.min.x) - Math.abs(b._data.anchorPos.min.x);
		});
		return annotation;
	},

	edit: function (comment) {
		var annotation = L.annotation(this._map._docLayer._twipsToLatLng(comment.anchorPos.getTopRight()), comment).addTo(this._map);
		annotation.edit();
		annotation.focus();
	},

	modify: function (annotation) {
		annotation.edit();
		this.select(annotation);
		annotation.focus();
	},

	reply: function (annotation) {
		annotation.reply();
		this.select(annotation);
		annotation.focus();
	},

	remove: function (id) {
		var comment = {
			Id: {
				type: 'string',
				value: id
			}
		};
		this._map.sendUnoCommand('.uno:DeleteComment', comment);
		this.unselect();
		this._map.focus();
	},

	_onRedlineAccept: function(e) {
		var command = {
			AcceptTrackedChange: {
				type: 'unsigned short',
				value: e.id.substring('change-'.length)
			}
		};
		this._map.sendUnoCommand('.uno:AcceptTrackedChange', command);
		this.unselect();
		this._map.focus();
	},

	_onRedlineReject: function(e) {
		var command = {
			RejectTrackedChange: {
				type: 'unsigned short',
				value: e.id.substring('change-'.length)
			}
		};
		this._map.sendUnoCommand('.uno:RejectTrackedChange', command);
		this.unselect();
		this._map.focus();
	},

	// Adjust parent-child relationship, if required, after `comment` is added
	adjustParentAdd: function(comment) {
		if (comment.parent && comment.parent > '0') {
			var parentIdx = this.getIndexOf(comment.parent);
			if (parentIdx === -1) {
				console.warn('adjustParentAdd: No parent comment to attach received comment to. ' +
				             'Parent comment ID sought is :' + comment.parent + ' for current comment with ID : ' + comment.id);
				return;
			}
			if (this._items[parentIdx + 1] && this._items[parentIdx + 1]._data.parent === this._items[parentIdx]._data.id) {
				this._items[parentIdx + 1]._data.parent = comment.id;
			}
		}
	},

	// Adjust parent-child relationship, if required, after `comment` is removed
	adjustParentRemove: function(comment) {
		var newId = '0';
		var parentIdx = this.getIndexOf(comment._data.parent);
		if (parentIdx >= 0) {
			newId = this._items[parentIdx]._data.id;
		}
		var currentIdx = this.getIndexOf(comment._data.id);
		if (this._items[currentIdx + 1] && this._items[currentIdx].parentOf(this._items[currentIdx + 1])) {
			this._items[currentIdx + 1]._data.parent = newId;
		}
	},

	onACKComment: function (obj) {
		var id;
		var changetrack = obj.redline ? true : false;
		var action = changetrack ? obj.redline.action : obj.comment.action;

		if (changetrack && obj.redline.author in this._map._viewInfoByUser) {
			obj.redline.avatar = this._map._viewInfoByUser[obj.redline.author].userextrainfo.avatar;
		}
		else if (!changetrack && obj.comment.author in this._map._viewInfoByUser) {
			obj.comment.avatar = this._map._viewInfoByUser[obj.comment.author].userextrainfo.avatar;
		}

		if (action === 'Add') {
			if (changetrack) {
				if (!this.adjustRedLine(obj.redline)) {
					// something wrong in this redline
					return;
				}
				this.add(obj.redline);
			} else {
				this.adjustComment(obj.comment);
				this.adjustParentAdd(obj.comment);
				this.add(obj.comment);
			}
			if (this._selected && !this._selected.isEdit()) {
				this._map.focus();
			}
			this.updateDocBounds(1);
			this.layout();
		} else if (action === 'Remove') {
			id = changetrack ? 'change-' + obj.redline.index : obj.comment.id;
			var removed = this.getItem(id);
			if (removed) {
				this.adjustParentRemove(removed);
				this._map.removeLayer(this.removeItem(id));
				this.updateDocBounds(0);
				if (this._selected === removed) {
					this.unselect();
				} else {
					this.layout();
				}
			}
		} else if (action === 'Modify') {
			id = changetrack ? 'change-' + obj.redline.index : obj.comment.id;
			var modified = this.getItem(id);
			if (modified) {
				var modifiedObj;
				if (changetrack) {
					if (!this.adjustRedLine(obj.redline)) {
						// something wrong in this redline
						return;
					}
					modifiedObj = obj.redline;
				} else {
					this.adjustComment(obj.comment);
					modifiedObj = obj.comment;
				}
				modified.setData(modifiedObj);
				modified.update();
				this.update();
			}
		}
	},

	_onAnnotationCancel: function (e) {
		if (e.annotation._data.id === 'new') {
			this._map.removeLayer(this.removeItem(e.annotation._data.id));
			this.updateDocBounds(0);
		}
		if (this._selected === e.annotation) {
			this.unselect();
		} else {
			this.layout();
		}
		this._map.focus();
	},

	_onAnnotationClick: function (e) {
		this.select(e.annotation);
	},

	_onAnnotationReply: function (e) {
		var comment = {
			Id: {
				type: 'string',
				value: e.annotation._data.id
			},
			Text: {
				type: 'string',
				value: e.annotation._data.reply
			}
		};
		this._map.sendUnoCommand('.uno:ReplyComment', comment);
		this.unselect();
		this._map.focus();
	},

	_onAnnotationSave: function (e) {
		var comment;
		if (e.annotation._data.id === 'new') {
			comment = {
				Text: {
					type: 'string',
					value: e.annotation._data.text
				},
				Author: {
					type: 'string',
					value: e.annotation._data.author
				}
			};
			this._map.sendUnoCommand('.uno:InsertAnnotation', comment);
			this._map.removeLayer(this.removeItem(e.annotation._data.id));
		} else if (e.annotation._data.trackchange) {
			comment = {
				ChangeTrackingId: {
					type: 'long',
					value: e.annotation._data.index
				},
				Text: {
					type: 'string',
					value: e.annotation._data.text
				}
			};
			this._map.sendUnoCommand('.uno:CommentChangeTracking', comment);
		} else {
			comment = {
				Id: {
					type: 'string',
					value: e.annotation._data.id
				},
				Text: {
					type: 'string',
					value: e.annotation._data.text
				}
			};
			this._map.sendUnoCommand('.uno:EditAnnotation', comment);
		}
		this.unselect();
		this._map.focus();
	},

	_onAnnotationZoom: function (e) {
		this.layout(true);
	}
});


L.Map.include({
	insertComment: function() {
		this._docLayer.newAnnotation({
			text: '',
			textrange: '',
			author: this.getViewName(this._docLayer._viewId),
			dateTime: new Date().toDateString(),
			id: 'new' // 'new' only when added by us
		});
	}
});


L.annotationManager = function (map, options) {
	return new L.AnnotationManager(map, options);
};


/*
 * L.Control.Scroll.Annotation
 */

L.Control.Scroll.Annotation = L.Control.extend({
	options: {
		position: 'topright',
		arrowUp: '0x25b2',
		arrowUpTitle: _('Scroll up annotations'),
		arrowDown: '0x25bc',
		arrowDownTitle: _('Scroll down annotations')
	},

	onAdd: function (map) {
		var scrollName = 'leaflet-control-scroll',
		    container = L.DomUtil.create('div', 'loleaflet-bar');

		this._map = map;

		this._buttonUp  = this._createButton(
		        this.options.arrowUp, this.options.arrowUpTitle,
		        scrollName + '-up',  container, this._onScrollUp,  this);
		this._buttonDown = this._createButton(
		        this.options.arrowDown, this.options.arrowDownTitle,
		        scrollName + '-down', container, this._onScrollDown, this);

		return container;
	},

	onRemove: function (map) {
	},

	_onScrollUp: function (e) {
		this._map.fire('AnnotationScrollUp');
	},

	_onScrollDown: function (e) {
		this._map.fire('AnnotationScrollDown');
	},

	_createButton: function (html, title, className, container, fn, context) {
		var link = L.DomUtil.create('a', className, container);
		link.innerHTML = String.fromCharCode(html);
		link.href = '#';
		link.title = title;

		var stop = L.DomEvent.stopPropagation;

		L.DomEvent
		    .on(link, 'click', stop)
		    .on(link, 'mousedown', stop)
		    .on(link, 'dblclick', stop)
		    .on(link, 'click', L.DomEvent.preventDefault)
		    .on(link, 'click', fn, context);

		return link;
	}
});

L.control.scroll.annotation = function (options) {
	return new L.Control.Scroll.Annotation(options);
};


/*
 * L.Annotation
 */

/* global $ Autolinker L */

L.Annotation = L.Layer.extend({
	options: {
		minWidth: 160,
		maxHeight: 50,
		imgSize: L.point([32, 32]),
		noMenu: false
	},

	initialize: function (latlng, data, options) {
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
		this._data = data;
	},

	onAdd: function (map) {
		this._map = map;
		if (!this._container) {
			this._initLayout();
		}

		map._panes.popupPane.appendChild(this._container);
		this.update();
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	onRemove: function (map) {
		map._panes.popupPane.removeChild(this._container);
		if (this._data.textSelected) {
			this._map.removeLayer(this._data.textSelected);
		}
		this._map = null;
	},

	update: function () {
		if (!this._map) { return; }

		this._updateContent();
		this._updateLayout();
		this._updatePosition();
	},

	setData: function (data) {
		if (this._data.textSelected) {
			this._map.removeLayer(this._data.textSelected);
		}
		this._data = data;
	},

	setLatLng: function (latlng) {
		this._latlng = L.latLng(latlng);
		if (this._map) {
			this._updatePosition();
		}
		return this;
	},

	getBounds: function () {
		var point = this._map.latLngToLayerPoint(this._latlng);
		return L.bounds(point, point.add(L.point(this._container.offsetWidth, this._container.offsetHeight)));
	},

	show: function () {
		this._container.style.visibility = '';
		this._contentNode.style.display = '';
		this._nodeModify.style.display = 'none';
		this._nodeReply.style.display = 'none';
		if (this._data.textSelected && !this._map.hasLayer(this._data.textSelected)) {
			this._map.addLayer(this._data.textSelected);
		}
	},

	hide: function () {
		this._container.style.visibility = 'hidden';
		this._contentNode.style.display = 'none';
		this._nodeModify.style.display = 'none';
		this._nodeReply.style.display = 'none';
		if (this._data.textSelected && this._map.hasLayer(this._data.textSelected)) {
			this._map.removeLayer(this._data.textSelected);
		}
	},

	edit: function () {
		this._container.style.visibility = '';
		this._contentNode.style.display = 'none';
		this._nodeModify.style.display = '';
		this._nodeReply.style.display = 'none';
		return this;
	},

	reply: function () {
		this._container.style.visibility = '';
		this._contentNode.style.display = '';
		this._nodeModify.style.display = 'none';
		this._nodeReply.style.display = '';
		return this;
	},

	isEdit: function () {
		return (this._nodeModify && this._nodeModify.style.display !== 'none') ||
		       (this._nodeReply && this._nodeReply.style.display !== 'none');
	},

	focus: function () {
		this._nodeModifyText.focus();
		this._nodeReplyText.focus();
	},

	parentOf: function(comment) {
		return this._data.id === comment._data.parent;
	},

	_createButton: function(container, value, handler) {
		var button = L.DomUtil.create('input', 'loleaflet-controls', container);
		button.type = 'button';
		button.value = value;
		L.DomEvent.on(button, 'mousedown', L.DomEvent.preventDefault);
		L.DomEvent.on(button, 'click', handler, this);
	},

	_initLayout: function () {
		var buttons,
		    tagTd = 'td',
		    tagDiv = 'div',
		    empty = '',
		    click = 'click',
		    tagTextArea = 'textarea',
		    cancel = _('Cancel'),
		    classTextArea = 'loleaflet-annotation-textarea',
		    classEdit = 'loleaflet-annotation-edit';
		var container = this._container =
		    L.DomUtil.create(tagDiv, 'loleaflet-annotation');
		if (this._data.trackchange) {
			var wrapper = this._wrapper = L.DomUtil.create(tagDiv, 'loleaflet-annotation-redline-content-wrapper', container);
		} else {
			wrapper = this._wrapper = L.DomUtil.create(tagDiv, 'loleaflet-annotation-content-wrapper', container);
		}
		this._author = L.DomUtil.create('table', 'loleaflet-annotation-table', wrapper);
		var tbody = L.DomUtil.create('tbody', empty, this._author);
		var tr = L.DomUtil.create('tr', empty, tbody);
		var tdImg = L.DomUtil.create(tagTd, 'loleaflet-annotation-img', tr);
		var tdAuthor = L.DomUtil.create(tagTd, 'loleaflet-annotation-author', tr);
		var imgAuthor = L.DomUtil.create('img', empty, tdImg);
		imgAuthor.setAttribute('src', L.Icon.Default.imagePath + '/user.png');
		imgAuthor.setAttribute('width', this.options.imgSize.x);
		imgAuthor.setAttribute('height', this.options.imgSize.y);
		this._authorAvatarImg = imgAuthor;
		L.DomUtil.create(tagDiv, 'loleaflet-annotation-userline', tdImg);
		this._contentAuthor = L.DomUtil.create(tagDiv, 'loleaflet-annotation-content-author', tdAuthor);
		this._contentDate = L.DomUtil.create(tagDiv, 'loleaflet-annotation-date', tdAuthor);

		if (this._data.trackchange && this._map._permission !== 'readonly') {
			var tdAccept = L.DomUtil.create(tagTd, 'loleaflet-annotation-menubar', tr);
			var acceptButton = L.DomUtil.create('button', 'loleaflet-redline-accept-button', tdAccept);
			var tdReject = L.DomUtil.create(tagTd, 'loleaflet-annotation-menubar', tr);
			var rejectButton = L.DomUtil.create('button', 'loleaflet-redline-reject-button', tdReject);

			acceptButton.title = _('Accept change');
			L.DomEvent.on(acceptButton, click, function() {
				this._map.fire('RedlineAccept', {id: this._data.id});
			}, this);

			rejectButton.title = _('Reject change');
			L.DomEvent.on(rejectButton, click, function() {
				this._map.fire('RedlineReject', {id: this._data.id});
			}, this);
		}

		if (this.options.noMenu !== true && this._map._permission !== 'readonly') {
			var tdMenu = L.DomUtil.create(tagTd, 'loleaflet-annotation-menubar', tr);
			var divMenu = L.DomUtil.create(tagDiv, this._data.trackchange ? 'loleaflet-annotation-menu-redline' : 'loleaflet-annotation-menu', tdMenu);
			divMenu.title = _('Open menu');
			divMenu.annotation = this;
		}
		if (this._data.trackchange) {
			this._captionNode = L.DomUtil.create(tagDiv, 'loleaflet-annotation-caption', wrapper);
			this._captionText = L.DomUtil.create(tagDiv, empty, this._captionNode);
		}
		this._contentNode = L.DomUtil.create(tagDiv, 'loleaflet-annotation-content loleaflet-dont-break', wrapper);
		this._nodeModify = L.DomUtil.create(tagDiv, classEdit, wrapper);
		this._nodeModifyText = L.DomUtil.create(tagTextArea, classTextArea, this._nodeModify);
		this._contentText = L.DomUtil.create(tagDiv, empty, this._contentNode);
		this._nodeReply = L.DomUtil.create(tagDiv, classEdit, wrapper);
		this._nodeReplyText = L.DomUtil.create(tagTextArea, classTextArea, this._nodeReply);

		buttons = L.DomUtil.create(tagDiv, empty, this._nodeModify);
		L.DomEvent.on(this._nodeModifyText, 'blur', this._onLostFocus, this);
		L.DomEvent.on(this._nodeReplyText, 'blur', this._onLostFocusReply, this);
		this._createButton(buttons, _('Save'), this._onSaveComment);
		this._createButton(buttons, cancel, this._onCancelClick);
		buttons = L.DomUtil.create(tagDiv, empty, this._nodeReply);
		this._createButton(buttons, _('Reply'), this._onReplyClick);
		this._createButton(buttons, cancel, this._onCancelClick);
		L.DomEvent.disableScrollPropagation(this._container);

		this._container.style.visibility = 'hidden';
		this._nodeModify.style.display = 'none';
		this._nodeReply.style.display = 'none';

		var events = [click, 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'keydown', 'keypress', 'keyup'];
		L.DomEvent.on(container, click, this._onMouseClick, this);
		L.DomEvent.on(container, 'mouseleave', this._onMouseLeave, this);
		for (var it = 0; it < events.length; it++) {
			L.DomEvent.on(container, events[it], L.DomEvent.stopPropagation, this);
		}
	},

	_onCancelClick: function (e) {
		L.DomEvent.stopPropagation(e);
		this._nodeModifyText.value = this._contentText.origText;
		this.show();
		this._map.fire('AnnotationCancel', {annotation: this});
	},

	_onSaveComment: function (e) {
		L.DomEvent.stopPropagation(e);
		this._data.text = this._nodeModifyText.value;
		this._updateContent();
		this.show();
		this._map.fire('AnnotationSave', {annotation: this});
	},

	_onLostFocus: function (e) {
		if (this._contentText.origText !== this._nodeModifyText.value) {
			this._onSaveComment(e);
		}
	},

	_onLostFocusReply: function(e) {
		if (this._nodeReplyText.value !== '') {
			this._onReplyClick(e);
		}
	},

	_onMouseClick: function (e) {
		var target = e.target || e.srcElement;
		L.DomEvent.stopPropagation(e);
		if (L.DomUtil.hasClass(target, 'loleaflet-annotation-menu') || L.DomUtil.hasClass(target, 'loleaflet-annotation-menu-redline')) {
			$(target).contextMenu();
			return;
		}
		L.DomEvent.stopPropagation(e);
		this._map.fire('AnnotationClick', {annotation: this});
	},

	_onMouseLeave: function (e) {
		var layerPoint = this._map.mouseEventToLayerPoint(e),
		    latlng = this._map.layerPointToLatLng(layerPoint);
		L.DomEvent.stopPropagation(e);
		if (this._contextMenu || this.isEdit()) {
			return;
		}
		this.fire('AnnotationMouseLeave', {
			originalEvent: e,
			latlng: latlng,
			layerPoint: layerPoint
		});
	},

	_onReplyClick: function (e) {
		L.DomEvent.stopPropagation(e);
		this._data.reply = this._nodeReplyText.value;
		// Assigning an empty string to .innerHTML property in some browsers will convert it to 'null'
		// While in browsers like Chrome and Firefox, a null value is automatically converted to ''
		// Better to assign '' here instead of null to keep the behavior same for all
		this._nodeReplyText.value = '';
		this.show();
		this._map.fire('AnnotationReply', {annotation: this});
	},

	_updateLayout: function () {
		var style = this._wrapper.style;
		style.width = '';
		style.whiteSpace = 'nowrap';

		style.whiteSpace = '';
	},

	_updateContent: function () {
		// .text() method will escape the string, does not interpret the string as HTML
		$(this._contentText).text(this._data.text);
		// Get the escaped HTML out and find for possible, useful links
		var linkedText = Autolinker.link($(this._contentText).html());
		// Set the property of text field directly. This is insecure otherwise because it doesn't escape the input
		// But we have already escaped the input before and only thing we are adding on top of that is Autolinker
		// generated text.
		this._contentText.innerHTML = linkedText;
		// Original unlinked text
		this._contentText.origText = this._data.text;
		$(this._nodeModifyText).text(this._data.text);
		$(this._contentAuthor).text(this._data.author);
		$(this._authorAvatarImg).attr('src', this._data.avatar);

		var d = new Date(this._data.dateTime.replace(/,.*/, 'Z'));
		$(this._contentDate).text((isNaN(d.getTime()) || this._map.getDocType() === 'spreadsheet')? this._data.dateTime: d.toDateString());

		if (this._data.trackchange) {
			$(this._captionText).text(this._data.description);
		}
	},

	_updatePosition: function () {
		var pos = this._map.latLngToLayerPoint(this._latlng);
		L.DomUtil.setPosition(this._container, pos);
	}
});

L.annotation = function (latlng, data, options) {
	return new L.Annotation(latlng, data, options);
};


/*
 * L.DivOverlay
 */

L.DivOverlay = L.Layer.extend({

	initialize: function (latLngBounds, options) {
		this._latLngBounds = L.latLngBounds(latLngBounds);
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this._map = map;
		if (!this._container) {
			this._initLayout();
		}
		map._panes.overlayPane.appendChild(this._container);
	},

	onRemove: function (map) {
		map.removeLayer(this._annotation);
		map._panes.overlayPane.removeChild(this._container);
	},

	setLatLngBounds: function (latLngBounds) {
		this._latLngBounds = L.latLngBounds(latLngBounds);
		this.update();
	},

	update: function () {
		if (this._container && this._map) {
			var topLeft = this._map.latLngToLayerPoint(this._latLngBounds.getNorthWest());
			var size = this._map.latLngToLayerPoint(this._latLngBounds.getSouthEast()).subtract(topLeft);
			L.DomUtil.setPosition(this._container, topLeft);
			this._container.style.width = size.x + 'px';
			this._container.style.height = size.y + 'px';
		}
		if (this._annotation) {
			this._annotation.setLatLng(this._latLngBounds.getNorthEast());
		}
	},

	openAnnotation: function () {
		if (this._map && this._annotation && !this._map.hasLayer(this._annotation) &&
		    !this._annotation.isEdit()) {
			this._annotation.setLatLng(this._latLngBounds.getNorthEast());
			this._map.addLayer(this._annotation);
			this._annotation.show();
		}
	},

	editAnnotation: function () {
		if (this._map && this._annotation) {
			this._annotation.setLatLng(this._latLngBounds.getNorthEast());
			this._map.addLayer(this._annotation);
			this._annotation.edit();
			this._annotation.focus();
		}
	},

	closePopup: function () {
		if (this._map && this._annotation) {
			this._annotation.show();
			this._map.removeLayer(this._annotation);
		}
	},

	closeAnnotation: function (e) {
		if (this._map && this._annotation && this._map.hasLayer(this._annotation) &&
		    !this._annotation.isEdit() &&
		    !this._annotation.getBounds().contains(e.layerPoint)) {
			this._map.removeLayer(this._annotation);
		}
	},

	_onMouseLeave: function (e) {
		if (this._map && this._annotation && this._map.hasLayer(this._annotation) &&
		    !this._annotation.isEdit() &&
		    !this._latLngBounds.contains(e.latlng)) {
			this._map.removeLayer(this._annotation);
		}
	},

	bindAnnotation: function (annotation) {
		this._annotation = annotation;
		if (!this._handlersAdded) {
			this.on('mouseover', this.openAnnotation, this);
			this.on('mouseout', this.closeAnnotation, this);
			this._annotation.on('AnnotationMouseLeave', this._onMouseLeave, this);
			this._handlersAdded = true;
		}
		return this;
	},

	unbindAnnotation: function () {
		if (this._annotation) {
			this.off('mouseover', this.openAnnotation, this);
			this.off('mouseout', this.closeAnnotation, this);
			this._annotation.off('AnnoationMouseLeave', this._onMouseLeave, this);
			this._handlerAdded = false;
			this._annotation = null;
		}
		return this;
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'loleaflet-div-layer');
		L.DomEvent.on(this._container, 'mouseover', this._fireMouseEvents, this);
		L.DomEvent.on(this._container, 'mouseout', this._fireMouseEvents, this);
		L.DomUtil.setOpacity(this._container, this.options.opacity);
		this.update();
	},

	_fireMouseEvents: function (e) {
		var containerPoint = this._map.mouseEventToContainerPoint(e),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint);

		this.fire(e.type, {
			latlng: latlng,
			layerPoint: layerPoint,
			containerPoint: containerPoint,
			originalEvent: e
		});
	}
});

L.divOverlay = function (latLngBounds, options) {
	return new L.DivOverlay(latLngBounds, options);
};



}(window, document));