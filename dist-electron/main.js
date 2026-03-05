import _n, { app as ur, BrowserWindow as Ip, ipcMain as _t, dialog as Xb } from "electron";
import { createRequire as Yb } from "node:module";
import { fileURLToPath as Up } from "node:url";
import Ne from "node:path";
import Ae from "fs";
import Zb from "constants";
import lo from "stream";
import Wc from "util";
import Lp from "assert";
import Me from "path";
import cl from "child_process";
import Bp from "events";
import Bi from "crypto";
import Mp from "tty";
import fl from "os";
import yn from "url";
import jp from "zlib";
import Jb from "http";
import Qb from "better-sqlite3";
var xt = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function $b(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var _p = {}, Xn = {}, Ct = {};
Ct.fromCallback = function(e) {
  return Object.defineProperty(function(...t) {
    if (typeof t[t.length - 1] == "function") e.apply(this, t);
    else
      return new Promise((r, n) => {
        t.push((i, a) => i != null ? n(i) : r(a)), e.apply(this, t);
      });
  }, "name", { value: e.name });
};
Ct.fromPromise = function(e) {
  return Object.defineProperty(function(...t) {
    const r = t[t.length - 1];
    if (typeof r != "function") return e.apply(this, t);
    t.pop(), e.apply(this, t).then((n) => r(null, n), r);
  }, "name", { value: e.name });
};
var Vr = Zb, e1 = process.cwd, xs = null, t1 = process.env.GRACEFUL_FS_PLATFORM || process.platform;
process.cwd = function() {
  return xs || (xs = e1.call(process)), xs;
};
try {
  process.cwd();
} catch {
}
if (typeof process.chdir == "function") {
  var xh = process.chdir;
  process.chdir = function(e) {
    xs = null, xh.call(process, e);
  }, Object.setPrototypeOf && Object.setPrototypeOf(process.chdir, xh);
}
var r1 = n1;
function n1(e) {
  Vr.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./) && t(e), e.lutimes || r(e), e.chown = a(e.chown), e.fchown = a(e.fchown), e.lchown = a(e.lchown), e.chmod = n(e.chmod), e.fchmod = n(e.fchmod), e.lchmod = n(e.lchmod), e.chownSync = o(e.chownSync), e.fchownSync = o(e.fchownSync), e.lchownSync = o(e.lchownSync), e.chmodSync = i(e.chmodSync), e.fchmodSync = i(e.fchmodSync), e.lchmodSync = i(e.lchmodSync), e.stat = s(e.stat), e.fstat = s(e.fstat), e.lstat = s(e.lstat), e.statSync = l(e.statSync), e.fstatSync = l(e.fstatSync), e.lstatSync = l(e.lstatSync), e.chmod && !e.lchmod && (e.lchmod = function(c, f, h) {
    h && process.nextTick(h);
  }, e.lchmodSync = function() {
  }), e.chown && !e.lchown && (e.lchown = function(c, f, h, d) {
    d && process.nextTick(d);
  }, e.lchownSync = function() {
  }), t1 === "win32" && (e.rename = typeof e.rename != "function" ? e.rename : function(c) {
    function f(h, d, p) {
      var v = Date.now(), y = 0;
      c(h, d, function m(S) {
        if (S && (S.code === "EACCES" || S.code === "EPERM" || S.code === "EBUSY") && Date.now() - v < 6e4) {
          setTimeout(function() {
            e.stat(d, function(T, C) {
              T && T.code === "ENOENT" ? c(h, d, m) : p(S);
            });
          }, y), y < 100 && (y += 10);
          return;
        }
        p && p(S);
      });
    }
    return Object.setPrototypeOf && Object.setPrototypeOf(f, c), f;
  }(e.rename)), e.read = typeof e.read != "function" ? e.read : function(c) {
    function f(h, d, p, v, y, m) {
      var S;
      if (m && typeof m == "function") {
        var T = 0;
        S = function(C, A, O) {
          if (C && C.code === "EAGAIN" && T < 10)
            return T++, c.call(e, h, d, p, v, y, S);
          m.apply(this, arguments);
        };
      }
      return c.call(e, h, d, p, v, y, S);
    }
    return Object.setPrototypeOf && Object.setPrototypeOf(f, c), f;
  }(e.read), e.readSync = typeof e.readSync != "function" ? e.readSync : /* @__PURE__ */ function(c) {
    return function(f, h, d, p, v) {
      for (var y = 0; ; )
        try {
          return c.call(e, f, h, d, p, v);
        } catch (m) {
          if (m.code === "EAGAIN" && y < 10) {
            y++;
            continue;
          }
          throw m;
        }
    };
  }(e.readSync);
  function t(c) {
    c.lchmod = function(f, h, d) {
      c.open(
        f,
        Vr.O_WRONLY | Vr.O_SYMLINK,
        h,
        function(p, v) {
          if (p) {
            d && d(p);
            return;
          }
          c.fchmod(v, h, function(y) {
            c.close(v, function(m) {
              d && d(y || m);
            });
          });
        }
      );
    }, c.lchmodSync = function(f, h) {
      var d = c.openSync(f, Vr.O_WRONLY | Vr.O_SYMLINK, h), p = !0, v;
      try {
        v = c.fchmodSync(d, h), p = !1;
      } finally {
        if (p)
          try {
            c.closeSync(d);
          } catch {
          }
        else
          c.closeSync(d);
      }
      return v;
    };
  }
  function r(c) {
    Vr.hasOwnProperty("O_SYMLINK") && c.futimes ? (c.lutimes = function(f, h, d, p) {
      c.open(f, Vr.O_SYMLINK, function(v, y) {
        if (v) {
          p && p(v);
          return;
        }
        c.futimes(y, h, d, function(m) {
          c.close(y, function(S) {
            p && p(m || S);
          });
        });
      });
    }, c.lutimesSync = function(f, h, d) {
      var p = c.openSync(f, Vr.O_SYMLINK), v, y = !0;
      try {
        v = c.futimesSync(p, h, d), y = !1;
      } finally {
        if (y)
          try {
            c.closeSync(p);
          } catch {
          }
        else
          c.closeSync(p);
      }
      return v;
    }) : c.futimes && (c.lutimes = function(f, h, d, p) {
      p && process.nextTick(p);
    }, c.lutimesSync = function() {
    });
  }
  function n(c) {
    return c && function(f, h, d) {
      return c.call(e, f, h, function(p) {
        u(p) && (p = null), d && d.apply(this, arguments);
      });
    };
  }
  function i(c) {
    return c && function(f, h) {
      try {
        return c.call(e, f, h);
      } catch (d) {
        if (!u(d)) throw d;
      }
    };
  }
  function a(c) {
    return c && function(f, h, d, p) {
      return c.call(e, f, h, d, function(v) {
        u(v) && (v = null), p && p.apply(this, arguments);
      });
    };
  }
  function o(c) {
    return c && function(f, h, d) {
      try {
        return c.call(e, f, h, d);
      } catch (p) {
        if (!u(p)) throw p;
      }
    };
  }
  function s(c) {
    return c && function(f, h, d) {
      typeof h == "function" && (d = h, h = null);
      function p(v, y) {
        y && (y.uid < 0 && (y.uid += 4294967296), y.gid < 0 && (y.gid += 4294967296)), d && d.apply(this, arguments);
      }
      return h ? c.call(e, f, h, p) : c.call(e, f, p);
    };
  }
  function l(c) {
    return c && function(f, h) {
      var d = h ? c.call(e, f, h) : c.call(e, f);
      return d && (d.uid < 0 && (d.uid += 4294967296), d.gid < 0 && (d.gid += 4294967296)), d;
    };
  }
  function u(c) {
    if (!c || c.code === "ENOSYS")
      return !0;
    var f = !process.getuid || process.getuid() !== 0;
    return !!(f && (c.code === "EINVAL" || c.code === "EPERM"));
  }
}
var Eh = lo.Stream, i1 = a1;
function a1(e) {
  return {
    ReadStream: t,
    WriteStream: r
  };
  function t(n, i) {
    if (!(this instanceof t)) return new t(n, i);
    Eh.call(this);
    var a = this;
    this.path = n, this.fd = null, this.readable = !0, this.paused = !1, this.flags = "r", this.mode = 438, this.bufferSize = 64 * 1024, i = i || {};
    for (var o = Object.keys(i), s = 0, l = o.length; s < l; s++) {
      var u = o[s];
      this[u] = i[u];
    }
    if (this.encoding && this.setEncoding(this.encoding), this.start !== void 0) {
      if (typeof this.start != "number")
        throw TypeError("start must be a Number");
      if (this.end === void 0)
        this.end = 1 / 0;
      else if (typeof this.end != "number")
        throw TypeError("end must be a Number");
      if (this.start > this.end)
        throw new Error("start must be <= end");
      this.pos = this.start;
    }
    if (this.fd !== null) {
      process.nextTick(function() {
        a._read();
      });
      return;
    }
    e.open(this.path, this.flags, this.mode, function(c, f) {
      if (c) {
        a.emit("error", c), a.readable = !1;
        return;
      }
      a.fd = f, a.emit("open", f), a._read();
    });
  }
  function r(n, i) {
    if (!(this instanceof r)) return new r(n, i);
    Eh.call(this), this.path = n, this.fd = null, this.writable = !0, this.flags = "w", this.encoding = "binary", this.mode = 438, this.bytesWritten = 0, i = i || {};
    for (var a = Object.keys(i), o = 0, s = a.length; o < s; o++) {
      var l = a[o];
      this[l] = i[l];
    }
    if (this.start !== void 0) {
      if (typeof this.start != "number")
        throw TypeError("start must be a Number");
      if (this.start < 0)
        throw new Error("start must be >= zero");
      this.pos = this.start;
    }
    this.busy = !1, this._queue = [], this.fd === null && (this._open = e.open, this._queue.push([this._open, this.path, this.flags, this.mode, void 0]), this.flush());
  }
}
var o1 = l1, s1 = Object.getPrototypeOf || function(e) {
  return e.__proto__;
};
function l1(e) {
  if (e === null || typeof e != "object")
    return e;
  if (e instanceof Object)
    var t = { __proto__: s1(e) };
  else
    var t = /* @__PURE__ */ Object.create(null);
  return Object.getOwnPropertyNames(e).forEach(function(r) {
    Object.defineProperty(t, r, Object.getOwnPropertyDescriptor(e, r));
  }), t;
}
var ze = Ae, u1 = r1, c1 = i1, f1 = o1, qo = Wc, st, Ls;
typeof Symbol == "function" && typeof Symbol.for == "function" ? (st = Symbol.for("graceful-fs.queue"), Ls = Symbol.for("graceful-fs.previous")) : (st = "___graceful-fs.queue", Ls = "___graceful-fs.previous");
function h1() {
}
function zp(e, t) {
  Object.defineProperty(e, st, {
    get: function() {
      return t;
    }
  });
}
var Mn = h1;
qo.debuglog ? Mn = qo.debuglog("gfs4") : /\bgfs4\b/i.test(process.env.NODE_DEBUG || "") && (Mn = function() {
  var e = qo.format.apply(qo, arguments);
  e = "GFS4: " + e.split(/\n/).join(`
GFS4: `), console.error(e);
});
if (!ze[st]) {
  var d1 = xt[st] || [];
  zp(ze, d1), ze.close = function(e) {
    function t(r, n) {
      return e.call(ze, r, function(i) {
        i || Sh(), typeof n == "function" && n.apply(this, arguments);
      });
    }
    return Object.defineProperty(t, Ls, {
      value: e
    }), t;
  }(ze.close), ze.closeSync = function(e) {
    function t(r) {
      e.apply(ze, arguments), Sh();
    }
    return Object.defineProperty(t, Ls, {
      value: e
    }), t;
  }(ze.closeSync), /\bgfs4\b/i.test(process.env.NODE_DEBUG || "") && process.on("exit", function() {
    Mn(ze[st]), Lp.equal(ze[st].length, 0);
  });
}
xt[st] || zp(xt, ze[st]);
var At = Gc(f1(ze));
process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !ze.__patched && (At = Gc(ze), ze.__patched = !0);
function Gc(e) {
  u1(e), e.gracefulify = Gc, e.createReadStream = A, e.createWriteStream = O;
  var t = e.readFile;
  e.readFile = r;
  function r(b, j, I) {
    return typeof j == "function" && (I = j, j = null), q(b, j, I);
    function q(z, B, N, L) {
      return t(z, B, function(U) {
        U && (U.code === "EMFILE" || U.code === "ENFILE") ? ai([q, [z, B, N], U, L || Date.now(), Date.now()]) : typeof N == "function" && N.apply(this, arguments);
      });
    }
  }
  var n = e.writeFile;
  e.writeFile = i;
  function i(b, j, I, q) {
    return typeof I == "function" && (q = I, I = null), z(b, j, I, q);
    function z(B, N, L, U, X) {
      return n(B, N, L, function(W) {
        W && (W.code === "EMFILE" || W.code === "ENFILE") ? ai([z, [B, N, L, U], W, X || Date.now(), Date.now()]) : typeof U == "function" && U.apply(this, arguments);
      });
    }
  }
  var a = e.appendFile;
  a && (e.appendFile = o);
  function o(b, j, I, q) {
    return typeof I == "function" && (q = I, I = null), z(b, j, I, q);
    function z(B, N, L, U, X) {
      return a(B, N, L, function(W) {
        W && (W.code === "EMFILE" || W.code === "ENFILE") ? ai([z, [B, N, L, U], W, X || Date.now(), Date.now()]) : typeof U == "function" && U.apply(this, arguments);
      });
    }
  }
  var s = e.copyFile;
  s && (e.copyFile = l);
  function l(b, j, I, q) {
    return typeof I == "function" && (q = I, I = 0), z(b, j, I, q);
    function z(B, N, L, U, X) {
      return s(B, N, L, function(W) {
        W && (W.code === "EMFILE" || W.code === "ENFILE") ? ai([z, [B, N, L, U], W, X || Date.now(), Date.now()]) : typeof U == "function" && U.apply(this, arguments);
      });
    }
  }
  var u = e.readdir;
  e.readdir = f;
  var c = /^v[0-5]\./;
  function f(b, j, I) {
    typeof j == "function" && (I = j, j = null);
    var q = c.test(process.version) ? function(N, L, U, X) {
      return u(N, z(
        N,
        L,
        U,
        X
      ));
    } : function(N, L, U, X) {
      return u(N, L, z(
        N,
        L,
        U,
        X
      ));
    };
    return q(b, j, I);
    function z(B, N, L, U) {
      return function(X, W) {
        X && (X.code === "EMFILE" || X.code === "ENFILE") ? ai([
          q,
          [B, N, L],
          X,
          U || Date.now(),
          Date.now()
        ]) : (W && W.sort && W.sort(), typeof L == "function" && L.call(this, X, W));
      };
    }
  }
  if (process.version.substr(0, 4) === "v0.8") {
    var h = c1(e);
    m = h.ReadStream, T = h.WriteStream;
  }
  var d = e.ReadStream;
  d && (m.prototype = Object.create(d.prototype), m.prototype.open = S);
  var p = e.WriteStream;
  p && (T.prototype = Object.create(p.prototype), T.prototype.open = C), Object.defineProperty(e, "ReadStream", {
    get: function() {
      return m;
    },
    set: function(b) {
      m = b;
    },
    enumerable: !0,
    configurable: !0
  }), Object.defineProperty(e, "WriteStream", {
    get: function() {
      return T;
    },
    set: function(b) {
      T = b;
    },
    enumerable: !0,
    configurable: !0
  });
  var v = m;
  Object.defineProperty(e, "FileReadStream", {
    get: function() {
      return v;
    },
    set: function(b) {
      v = b;
    },
    enumerable: !0,
    configurable: !0
  });
  var y = T;
  Object.defineProperty(e, "FileWriteStream", {
    get: function() {
      return y;
    },
    set: function(b) {
      y = b;
    },
    enumerable: !0,
    configurable: !0
  });
  function m(b, j) {
    return this instanceof m ? (d.apply(this, arguments), this) : m.apply(Object.create(m.prototype), arguments);
  }
  function S() {
    var b = this;
    M(b.path, b.flags, b.mode, function(j, I) {
      j ? (b.autoClose && b.destroy(), b.emit("error", j)) : (b.fd = I, b.emit("open", I), b.read());
    });
  }
  function T(b, j) {
    return this instanceof T ? (p.apply(this, arguments), this) : T.apply(Object.create(T.prototype), arguments);
  }
  function C() {
    var b = this;
    M(b.path, b.flags, b.mode, function(j, I) {
      j ? (b.destroy(), b.emit("error", j)) : (b.fd = I, b.emit("open", I));
    });
  }
  function A(b, j) {
    return new e.ReadStream(b, j);
  }
  function O(b, j) {
    return new e.WriteStream(b, j);
  }
  var k = e.open;
  e.open = M;
  function M(b, j, I, q) {
    return typeof I == "function" && (q = I, I = null), z(b, j, I, q);
    function z(B, N, L, U, X) {
      return k(B, N, L, function(W, Q) {
        W && (W.code === "EMFILE" || W.code === "ENFILE") ? ai([z, [B, N, L, U], W, X || Date.now(), Date.now()]) : typeof U == "function" && U.apply(this, arguments);
      });
    }
  }
  return e;
}
function ai(e) {
  Mn("ENQUEUE", e[0].name, e[1]), ze[st].push(e), Kc();
}
var Vo;
function Sh() {
  for (var e = Date.now(), t = 0; t < ze[st].length; ++t)
    ze[st][t].length > 2 && (ze[st][t][3] = e, ze[st][t][4] = e);
  Kc();
}
function Kc() {
  if (clearTimeout(Vo), Vo = void 0, ze[st].length !== 0) {
    var e = ze[st].shift(), t = e[0], r = e[1], n = e[2], i = e[3], a = e[4];
    if (i === void 0)
      Mn("RETRY", t.name, r), t.apply(null, r);
    else if (Date.now() - i >= 6e4) {
      Mn("TIMEOUT", t.name, r);
      var o = r.pop();
      typeof o == "function" && o.call(null, n);
    } else {
      var s = Date.now() - a, l = Math.max(a - i, 1), u = Math.min(l * 1.2, 100);
      s >= u ? (Mn("RETRY", t.name, r), t.apply(null, r.concat([i]))) : ze[st].push(e);
    }
    Vo === void 0 && (Vo = setTimeout(Kc, 0));
  }
}
(function(e) {
  const t = Ct.fromCallback, r = At, n = [
    "access",
    "appendFile",
    "chmod",
    "chown",
    "close",
    "copyFile",
    "fchmod",
    "fchown",
    "fdatasync",
    "fstat",
    "fsync",
    "ftruncate",
    "futimes",
    "lchmod",
    "lchown",
    "link",
    "lstat",
    "mkdir",
    "mkdtemp",
    "open",
    "opendir",
    "readdir",
    "readFile",
    "readlink",
    "realpath",
    "rename",
    "rm",
    "rmdir",
    "stat",
    "symlink",
    "truncate",
    "unlink",
    "utimes",
    "writeFile"
  ].filter((i) => typeof r[i] == "function");
  Object.assign(e, r), n.forEach((i) => {
    e[i] = t(r[i]);
  }), e.exists = function(i, a) {
    return typeof a == "function" ? r.exists(i, a) : new Promise((o) => r.exists(i, o));
  }, e.read = function(i, a, o, s, l, u) {
    return typeof u == "function" ? r.read(i, a, o, s, l, u) : new Promise((c, f) => {
      r.read(i, a, o, s, l, (h, d, p) => {
        if (h) return f(h);
        c({ bytesRead: d, buffer: p });
      });
    });
  }, e.write = function(i, a, ...o) {
    return typeof o[o.length - 1] == "function" ? r.write(i, a, ...o) : new Promise((s, l) => {
      r.write(i, a, ...o, (u, c, f) => {
        if (u) return l(u);
        s({ bytesWritten: c, buffer: f });
      });
    });
  }, typeof r.writev == "function" && (e.writev = function(i, a, ...o) {
    return typeof o[o.length - 1] == "function" ? r.writev(i, a, ...o) : new Promise((s, l) => {
      r.writev(i, a, ...o, (u, c, f) => {
        if (u) return l(u);
        s({ bytesWritten: c, buffers: f });
      });
    });
  }), typeof r.realpath.native == "function" ? e.realpath.native = t(r.realpath.native) : process.emitWarning(
    "fs.realpath.native is not a function. Is fs being monkey-patched?",
    "Warning",
    "fs-extra-WARN0003"
  );
})(Xn);
var Xc = {}, qp = {};
const p1 = Me;
qp.checkPath = function(t) {
  if (process.platform === "win32" && /[<>:"|?*]/.test(t.replace(p1.parse(t).root, ""))) {
    const n = new Error(`Path contains invalid characters: ${t}`);
    throw n.code = "EINVAL", n;
  }
};
const Vp = Xn, { checkPath: Hp } = qp, Wp = (e) => {
  const t = { mode: 511 };
  return typeof e == "number" ? e : { ...t, ...e }.mode;
};
Xc.makeDir = async (e, t) => (Hp(e), Vp.mkdir(e, {
  mode: Wp(t),
  recursive: !0
}));
Xc.makeDirSync = (e, t) => (Hp(e), Vp.mkdirSync(e, {
  mode: Wp(t),
  recursive: !0
}));
const v1 = Ct.fromPromise, { makeDir: g1, makeDirSync: uu } = Xc, cu = v1(g1);
var Fr = {
  mkdirs: cu,
  mkdirsSync: uu,
  // alias
  mkdirp: cu,
  mkdirpSync: uu,
  ensureDir: cu,
  ensureDirSync: uu
};
const m1 = Ct.fromPromise, Gp = Xn;
function y1(e) {
  return Gp.access(e).then(() => !0).catch(() => !1);
}
var Yn = {
  pathExists: m1(y1),
  pathExistsSync: Gp.existsSync
};
const Ti = At;
function b1(e, t, r, n) {
  Ti.open(e, "r+", (i, a) => {
    if (i) return n(i);
    Ti.futimes(a, t, r, (o) => {
      Ti.close(a, (s) => {
        n && n(o || s);
      });
    });
  });
}
function w1(e, t, r) {
  const n = Ti.openSync(e, "r+");
  return Ti.futimesSync(n, t, r), Ti.closeSync(n);
}
var Kp = {
  utimesMillis: b1,
  utimesMillisSync: w1
};
const Di = Xn, it = Me, x1 = Wc;
function E1(e, t, r) {
  const n = r.dereference ? (i) => Di.stat(i, { bigint: !0 }) : (i) => Di.lstat(i, { bigint: !0 });
  return Promise.all([
    n(e),
    n(t).catch((i) => {
      if (i.code === "ENOENT") return null;
      throw i;
    })
  ]).then(([i, a]) => ({ srcStat: i, destStat: a }));
}
function S1(e, t, r) {
  let n;
  const i = r.dereference ? (o) => Di.statSync(o, { bigint: !0 }) : (o) => Di.lstatSync(o, { bigint: !0 }), a = i(e);
  try {
    n = i(t);
  } catch (o) {
    if (o.code === "ENOENT") return { srcStat: a, destStat: null };
    throw o;
  }
  return { srcStat: a, destStat: n };
}
function F1(e, t, r, n, i) {
  x1.callbackify(E1)(e, t, n, (a, o) => {
    if (a) return i(a);
    const { srcStat: s, destStat: l } = o;
    if (l) {
      if (uo(s, l)) {
        const u = it.basename(e), c = it.basename(t);
        return r === "move" && u !== c && u.toLowerCase() === c.toLowerCase() ? i(null, { srcStat: s, destStat: l, isChangingCase: !0 }) : i(new Error("Source and destination must not be the same."));
      }
      if (s.isDirectory() && !l.isDirectory())
        return i(new Error(`Cannot overwrite non-directory '${t}' with directory '${e}'.`));
      if (!s.isDirectory() && l.isDirectory())
        return i(new Error(`Cannot overwrite directory '${t}' with non-directory '${e}'.`));
    }
    return s.isDirectory() && Yc(e, t) ? i(new Error(hl(e, t, r))) : i(null, { srcStat: s, destStat: l });
  });
}
function T1(e, t, r, n) {
  const { srcStat: i, destStat: a } = S1(e, t, n);
  if (a) {
    if (uo(i, a)) {
      const o = it.basename(e), s = it.basename(t);
      if (r === "move" && o !== s && o.toLowerCase() === s.toLowerCase())
        return { srcStat: i, destStat: a, isChangingCase: !0 };
      throw new Error("Source and destination must not be the same.");
    }
    if (i.isDirectory() && !a.isDirectory())
      throw new Error(`Cannot overwrite non-directory '${t}' with directory '${e}'.`);
    if (!i.isDirectory() && a.isDirectory())
      throw new Error(`Cannot overwrite directory '${t}' with non-directory '${e}'.`);
  }
  if (i.isDirectory() && Yc(e, t))
    throw new Error(hl(e, t, r));
  return { srcStat: i, destStat: a };
}
function Xp(e, t, r, n, i) {
  const a = it.resolve(it.dirname(e)), o = it.resolve(it.dirname(r));
  if (o === a || o === it.parse(o).root) return i();
  Di.stat(o, { bigint: !0 }, (s, l) => s ? s.code === "ENOENT" ? i() : i(s) : uo(t, l) ? i(new Error(hl(e, r, n))) : Xp(e, t, o, n, i));
}
function Yp(e, t, r, n) {
  const i = it.resolve(it.dirname(e)), a = it.resolve(it.dirname(r));
  if (a === i || a === it.parse(a).root) return;
  let o;
  try {
    o = Di.statSync(a, { bigint: !0 });
  } catch (s) {
    if (s.code === "ENOENT") return;
    throw s;
  }
  if (uo(t, o))
    throw new Error(hl(e, r, n));
  return Yp(e, t, a, n);
}
function uo(e, t) {
  return t.ino && t.dev && t.ino === e.ino && t.dev === e.dev;
}
function Yc(e, t) {
  const r = it.resolve(e).split(it.sep).filter((i) => i), n = it.resolve(t).split(it.sep).filter((i) => i);
  return r.reduce((i, a, o) => i && n[o] === a, !0);
}
function hl(e, t, r) {
  return `Cannot ${r} '${e}' to a subdirectory of itself, '${t}'.`;
}
var Mi = {
  checkPaths: F1,
  checkPathsSync: T1,
  checkParentPaths: Xp,
  checkParentPathsSync: Yp,
  isSrcSubdir: Yc,
  areIdentical: uo
};
const Dt = At, La = Me, C1 = Fr.mkdirs, A1 = Yn.pathExists, P1 = Kp.utimesMillis, Ba = Mi;
function R1(e, t, r, n) {
  typeof r == "function" && !n ? (n = r, r = {}) : typeof r == "function" && (r = { filter: r }), n = n || function() {
  }, r = r || {}, r.clobber = "clobber" in r ? !!r.clobber : !0, r.overwrite = "overwrite" in r ? !!r.overwrite : r.clobber, r.preserveTimestamps && process.arch === "ia32" && process.emitWarning(
    `Using the preserveTimestamps option in 32-bit node is not recommended;

	see https://github.com/jprichardson/node-fs-extra/issues/269`,
    "Warning",
    "fs-extra-WARN0001"
  ), Ba.checkPaths(e, t, "copy", r, (i, a) => {
    if (i) return n(i);
    const { srcStat: o, destStat: s } = a;
    Ba.checkParentPaths(e, o, t, "copy", (l) => l ? n(l) : r.filter ? Zp(Fh, s, e, t, r, n) : Fh(s, e, t, r, n));
  });
}
function Fh(e, t, r, n, i) {
  const a = La.dirname(r);
  A1(a, (o, s) => {
    if (o) return i(o);
    if (s) return Bs(e, t, r, n, i);
    C1(a, (l) => l ? i(l) : Bs(e, t, r, n, i));
  });
}
function Zp(e, t, r, n, i, a) {
  Promise.resolve(i.filter(r, n)).then((o) => o ? e(t, r, n, i, a) : a(), (o) => a(o));
}
function O1(e, t, r, n, i) {
  return n.filter ? Zp(Bs, e, t, r, n, i) : Bs(e, t, r, n, i);
}
function Bs(e, t, r, n, i) {
  (n.dereference ? Dt.stat : Dt.lstat)(t, (o, s) => o ? i(o) : s.isDirectory() ? B1(s, e, t, r, n, i) : s.isFile() || s.isCharacterDevice() || s.isBlockDevice() ? D1(s, e, t, r, n, i) : s.isSymbolicLink() ? _1(e, t, r, n, i) : s.isSocket() ? i(new Error(`Cannot copy a socket file: ${t}`)) : s.isFIFO() ? i(new Error(`Cannot copy a FIFO pipe: ${t}`)) : i(new Error(`Unknown file: ${t}`)));
}
function D1(e, t, r, n, i, a) {
  return t ? k1(e, r, n, i, a) : Jp(e, r, n, i, a);
}
function k1(e, t, r, n, i) {
  if (n.overwrite)
    Dt.unlink(r, (a) => a ? i(a) : Jp(e, t, r, n, i));
  else return n.errorOnExist ? i(new Error(`'${r}' already exists`)) : i();
}
function Jp(e, t, r, n, i) {
  Dt.copyFile(t, r, (a) => a ? i(a) : n.preserveTimestamps ? N1(e.mode, t, r, i) : dl(r, e.mode, i));
}
function N1(e, t, r, n) {
  return I1(e) ? U1(r, e, (i) => i ? n(i) : Th(e, t, r, n)) : Th(e, t, r, n);
}
function I1(e) {
  return (e & 128) === 0;
}
function U1(e, t, r) {
  return dl(e, t | 128, r);
}
function Th(e, t, r, n) {
  L1(t, r, (i) => i ? n(i) : dl(r, e, n));
}
function dl(e, t, r) {
  return Dt.chmod(e, t, r);
}
function L1(e, t, r) {
  Dt.stat(e, (n, i) => n ? r(n) : P1(t, i.atime, i.mtime, r));
}
function B1(e, t, r, n, i, a) {
  return t ? Qp(r, n, i, a) : M1(e.mode, r, n, i, a);
}
function M1(e, t, r, n, i) {
  Dt.mkdir(r, (a) => {
    if (a) return i(a);
    Qp(t, r, n, (o) => o ? i(o) : dl(r, e, i));
  });
}
function Qp(e, t, r, n) {
  Dt.readdir(e, (i, a) => i ? n(i) : $p(a, e, t, r, n));
}
function $p(e, t, r, n, i) {
  const a = e.pop();
  return a ? j1(e, a, t, r, n, i) : i();
}
function j1(e, t, r, n, i, a) {
  const o = La.join(r, t), s = La.join(n, t);
  Ba.checkPaths(o, s, "copy", i, (l, u) => {
    if (l) return a(l);
    const { destStat: c } = u;
    O1(c, o, s, i, (f) => f ? a(f) : $p(e, r, n, i, a));
  });
}
function _1(e, t, r, n, i) {
  Dt.readlink(t, (a, o) => {
    if (a) return i(a);
    if (n.dereference && (o = La.resolve(process.cwd(), o)), e)
      Dt.readlink(r, (s, l) => s ? s.code === "EINVAL" || s.code === "UNKNOWN" ? Dt.symlink(o, r, i) : i(s) : (n.dereference && (l = La.resolve(process.cwd(), l)), Ba.isSrcSubdir(o, l) ? i(new Error(`Cannot copy '${o}' to a subdirectory of itself, '${l}'.`)) : e.isDirectory() && Ba.isSrcSubdir(l, o) ? i(new Error(`Cannot overwrite '${l}' with '${o}'.`)) : z1(o, r, i)));
    else
      return Dt.symlink(o, r, i);
  });
}
function z1(e, t, r) {
  Dt.unlink(t, (n) => n ? r(n) : Dt.symlink(e, t, r));
}
var q1 = R1;
const pt = At, Ma = Me, V1 = Fr.mkdirsSync, H1 = Kp.utimesMillisSync, ja = Mi;
function W1(e, t, r) {
  typeof r == "function" && (r = { filter: r }), r = r || {}, r.clobber = "clobber" in r ? !!r.clobber : !0, r.overwrite = "overwrite" in r ? !!r.overwrite : r.clobber, r.preserveTimestamps && process.arch === "ia32" && process.emitWarning(
    `Using the preserveTimestamps option in 32-bit node is not recommended;

	see https://github.com/jprichardson/node-fs-extra/issues/269`,
    "Warning",
    "fs-extra-WARN0002"
  );
  const { srcStat: n, destStat: i } = ja.checkPathsSync(e, t, "copy", r);
  return ja.checkParentPathsSync(e, n, t, "copy"), G1(i, e, t, r);
}
function G1(e, t, r, n) {
  if (n.filter && !n.filter(t, r)) return;
  const i = Ma.dirname(r);
  return pt.existsSync(i) || V1(i), ev(e, t, r, n);
}
function K1(e, t, r, n) {
  if (!(n.filter && !n.filter(t, r)))
    return ev(e, t, r, n);
}
function ev(e, t, r, n) {
  const a = (n.dereference ? pt.statSync : pt.lstatSync)(t);
  if (a.isDirectory()) return ew(a, e, t, r, n);
  if (a.isFile() || a.isCharacterDevice() || a.isBlockDevice()) return X1(a, e, t, r, n);
  if (a.isSymbolicLink()) return nw(e, t, r, n);
  throw a.isSocket() ? new Error(`Cannot copy a socket file: ${t}`) : a.isFIFO() ? new Error(`Cannot copy a FIFO pipe: ${t}`) : new Error(`Unknown file: ${t}`);
}
function X1(e, t, r, n, i) {
  return t ? Y1(e, r, n, i) : tv(e, r, n, i);
}
function Y1(e, t, r, n) {
  if (n.overwrite)
    return pt.unlinkSync(r), tv(e, t, r, n);
  if (n.errorOnExist)
    throw new Error(`'${r}' already exists`);
}
function tv(e, t, r, n) {
  return pt.copyFileSync(t, r), n.preserveTimestamps && Z1(e.mode, t, r), Zc(r, e.mode);
}
function Z1(e, t, r) {
  return J1(e) && Q1(r, e), $1(t, r);
}
function J1(e) {
  return (e & 128) === 0;
}
function Q1(e, t) {
  return Zc(e, t | 128);
}
function Zc(e, t) {
  return pt.chmodSync(e, t);
}
function $1(e, t) {
  const r = pt.statSync(e);
  return H1(t, r.atime, r.mtime);
}
function ew(e, t, r, n, i) {
  return t ? rv(r, n, i) : tw(e.mode, r, n, i);
}
function tw(e, t, r, n) {
  return pt.mkdirSync(r), rv(t, r, n), Zc(r, e);
}
function rv(e, t, r) {
  pt.readdirSync(e).forEach((n) => rw(n, e, t, r));
}
function rw(e, t, r, n) {
  const i = Ma.join(t, e), a = Ma.join(r, e), { destStat: o } = ja.checkPathsSync(i, a, "copy", n);
  return K1(o, i, a, n);
}
function nw(e, t, r, n) {
  let i = pt.readlinkSync(t);
  if (n.dereference && (i = Ma.resolve(process.cwd(), i)), e) {
    let a;
    try {
      a = pt.readlinkSync(r);
    } catch (o) {
      if (o.code === "EINVAL" || o.code === "UNKNOWN") return pt.symlinkSync(i, r);
      throw o;
    }
    if (n.dereference && (a = Ma.resolve(process.cwd(), a)), ja.isSrcSubdir(i, a))
      throw new Error(`Cannot copy '${i}' to a subdirectory of itself, '${a}'.`);
    if (pt.statSync(r).isDirectory() && ja.isSrcSubdir(a, i))
      throw new Error(`Cannot overwrite '${a}' with '${i}'.`);
    return iw(i, r);
  } else
    return pt.symlinkSync(i, r);
}
function iw(e, t) {
  return pt.unlinkSync(t), pt.symlinkSync(e, t);
}
var aw = W1;
const ow = Ct.fromCallback;
var Jc = {
  copy: ow(q1),
  copySync: aw
};
const Ch = At, nv = Me, Ie = Lp, _a = process.platform === "win32";
function iv(e) {
  [
    "unlink",
    "chmod",
    "stat",
    "lstat",
    "rmdir",
    "readdir"
  ].forEach((r) => {
    e[r] = e[r] || Ch[r], r = r + "Sync", e[r] = e[r] || Ch[r];
  }), e.maxBusyTries = e.maxBusyTries || 3;
}
function Qc(e, t, r) {
  let n = 0;
  typeof t == "function" && (r = t, t = {}), Ie(e, "rimraf: missing path"), Ie.strictEqual(typeof e, "string", "rimraf: path should be a string"), Ie.strictEqual(typeof r, "function", "rimraf: callback function required"), Ie(t, "rimraf: invalid options argument provided"), Ie.strictEqual(typeof t, "object", "rimraf: options should be object"), iv(t), Ah(e, t, function i(a) {
    if (a) {
      if ((a.code === "EBUSY" || a.code === "ENOTEMPTY" || a.code === "EPERM") && n < t.maxBusyTries) {
        n++;
        const o = n * 100;
        return setTimeout(() => Ah(e, t, i), o);
      }
      a.code === "ENOENT" && (a = null);
    }
    r(a);
  });
}
function Ah(e, t, r) {
  Ie(e), Ie(t), Ie(typeof r == "function"), t.lstat(e, (n, i) => {
    if (n && n.code === "ENOENT")
      return r(null);
    if (n && n.code === "EPERM" && _a)
      return Ph(e, t, n, r);
    if (i && i.isDirectory())
      return Es(e, t, n, r);
    t.unlink(e, (a) => {
      if (a) {
        if (a.code === "ENOENT")
          return r(null);
        if (a.code === "EPERM")
          return _a ? Ph(e, t, a, r) : Es(e, t, a, r);
        if (a.code === "EISDIR")
          return Es(e, t, a, r);
      }
      return r(a);
    });
  });
}
function Ph(e, t, r, n) {
  Ie(e), Ie(t), Ie(typeof n == "function"), t.chmod(e, 438, (i) => {
    i ? n(i.code === "ENOENT" ? null : r) : t.stat(e, (a, o) => {
      a ? n(a.code === "ENOENT" ? null : r) : o.isDirectory() ? Es(e, t, r, n) : t.unlink(e, n);
    });
  });
}
function Rh(e, t, r) {
  let n;
  Ie(e), Ie(t);
  try {
    t.chmodSync(e, 438);
  } catch (i) {
    if (i.code === "ENOENT")
      return;
    throw r;
  }
  try {
    n = t.statSync(e);
  } catch (i) {
    if (i.code === "ENOENT")
      return;
    throw r;
  }
  n.isDirectory() ? Ss(e, t, r) : t.unlinkSync(e);
}
function Es(e, t, r, n) {
  Ie(e), Ie(t), Ie(typeof n == "function"), t.rmdir(e, (i) => {
    i && (i.code === "ENOTEMPTY" || i.code === "EEXIST" || i.code === "EPERM") ? sw(e, t, n) : i && i.code === "ENOTDIR" ? n(r) : n(i);
  });
}
function sw(e, t, r) {
  Ie(e), Ie(t), Ie(typeof r == "function"), t.readdir(e, (n, i) => {
    if (n) return r(n);
    let a = i.length, o;
    if (a === 0) return t.rmdir(e, r);
    i.forEach((s) => {
      Qc(nv.join(e, s), t, (l) => {
        if (!o) {
          if (l) return r(o = l);
          --a === 0 && t.rmdir(e, r);
        }
      });
    });
  });
}
function av(e, t) {
  let r;
  t = t || {}, iv(t), Ie(e, "rimraf: missing path"), Ie.strictEqual(typeof e, "string", "rimraf: path should be a string"), Ie(t, "rimraf: missing options"), Ie.strictEqual(typeof t, "object", "rimraf: options should be object");
  try {
    r = t.lstatSync(e);
  } catch (n) {
    if (n.code === "ENOENT")
      return;
    n.code === "EPERM" && _a && Rh(e, t, n);
  }
  try {
    r && r.isDirectory() ? Ss(e, t, null) : t.unlinkSync(e);
  } catch (n) {
    if (n.code === "ENOENT")
      return;
    if (n.code === "EPERM")
      return _a ? Rh(e, t, n) : Ss(e, t, n);
    if (n.code !== "EISDIR")
      throw n;
    Ss(e, t, n);
  }
}
function Ss(e, t, r) {
  Ie(e), Ie(t);
  try {
    t.rmdirSync(e);
  } catch (n) {
    if (n.code === "ENOTDIR")
      throw r;
    if (n.code === "ENOTEMPTY" || n.code === "EEXIST" || n.code === "EPERM")
      lw(e, t);
    else if (n.code !== "ENOENT")
      throw n;
  }
}
function lw(e, t) {
  if (Ie(e), Ie(t), t.readdirSync(e).forEach((r) => av(nv.join(e, r), t)), _a) {
    const r = Date.now();
    do
      try {
        return t.rmdirSync(e, t);
      } catch {
      }
    while (Date.now() - r < 500);
  } else
    return t.rmdirSync(e, t);
}
var uw = Qc;
Qc.sync = av;
const Ms = At, cw = Ct.fromCallback, ov = uw;
function fw(e, t) {
  if (Ms.rm) return Ms.rm(e, { recursive: !0, force: !0 }, t);
  ov(e, t);
}
function hw(e) {
  if (Ms.rmSync) return Ms.rmSync(e, { recursive: !0, force: !0 });
  ov.sync(e);
}
var pl = {
  remove: cw(fw),
  removeSync: hw
};
const dw = Ct.fromPromise, sv = Xn, lv = Me, uv = Fr, cv = pl, Oh = dw(async function(t) {
  let r;
  try {
    r = await sv.readdir(t);
  } catch {
    return uv.mkdirs(t);
  }
  return Promise.all(r.map((n) => cv.remove(lv.join(t, n))));
});
function Dh(e) {
  let t;
  try {
    t = sv.readdirSync(e);
  } catch {
    return uv.mkdirsSync(e);
  }
  t.forEach((r) => {
    r = lv.join(e, r), cv.removeSync(r);
  });
}
var pw = {
  emptyDirSync: Dh,
  emptydirSync: Dh,
  emptyDir: Oh,
  emptydir: Oh
};
const vw = Ct.fromCallback, fv = Me, $r = At, hv = Fr;
function gw(e, t) {
  function r() {
    $r.writeFile(e, "", (n) => {
      if (n) return t(n);
      t();
    });
  }
  $r.stat(e, (n, i) => {
    if (!n && i.isFile()) return t();
    const a = fv.dirname(e);
    $r.stat(a, (o, s) => {
      if (o)
        return o.code === "ENOENT" ? hv.mkdirs(a, (l) => {
          if (l) return t(l);
          r();
        }) : t(o);
      s.isDirectory() ? r() : $r.readdir(a, (l) => {
        if (l) return t(l);
      });
    });
  });
}
function mw(e) {
  let t;
  try {
    t = $r.statSync(e);
  } catch {
  }
  if (t && t.isFile()) return;
  const r = fv.dirname(e);
  try {
    $r.statSync(r).isDirectory() || $r.readdirSync(r);
  } catch (n) {
    if (n && n.code === "ENOENT") hv.mkdirsSync(r);
    else throw n;
  }
  $r.writeFileSync(e, "");
}
var yw = {
  createFile: vw(gw),
  createFileSync: mw
};
const bw = Ct.fromCallback, dv = Me, Jr = At, pv = Fr, ww = Yn.pathExists, { areIdentical: vv } = Mi;
function xw(e, t, r) {
  function n(i, a) {
    Jr.link(i, a, (o) => {
      if (o) return r(o);
      r(null);
    });
  }
  Jr.lstat(t, (i, a) => {
    Jr.lstat(e, (o, s) => {
      if (o)
        return o.message = o.message.replace("lstat", "ensureLink"), r(o);
      if (a && vv(s, a)) return r(null);
      const l = dv.dirname(t);
      ww(l, (u, c) => {
        if (u) return r(u);
        if (c) return n(e, t);
        pv.mkdirs(l, (f) => {
          if (f) return r(f);
          n(e, t);
        });
      });
    });
  });
}
function Ew(e, t) {
  let r;
  try {
    r = Jr.lstatSync(t);
  } catch {
  }
  try {
    const a = Jr.lstatSync(e);
    if (r && vv(a, r)) return;
  } catch (a) {
    throw a.message = a.message.replace("lstat", "ensureLink"), a;
  }
  const n = dv.dirname(t);
  return Jr.existsSync(n) || pv.mkdirsSync(n), Jr.linkSync(e, t);
}
var Sw = {
  createLink: bw(xw),
  createLinkSync: Ew
};
const en = Me, Ea = At, Fw = Yn.pathExists;
function Tw(e, t, r) {
  if (en.isAbsolute(e))
    return Ea.lstat(e, (n) => n ? (n.message = n.message.replace("lstat", "ensureSymlink"), r(n)) : r(null, {
      toCwd: e,
      toDst: e
    }));
  {
    const n = en.dirname(t), i = en.join(n, e);
    return Fw(i, (a, o) => a ? r(a) : o ? r(null, {
      toCwd: i,
      toDst: e
    }) : Ea.lstat(e, (s) => s ? (s.message = s.message.replace("lstat", "ensureSymlink"), r(s)) : r(null, {
      toCwd: e,
      toDst: en.relative(n, e)
    })));
  }
}
function Cw(e, t) {
  let r;
  if (en.isAbsolute(e)) {
    if (r = Ea.existsSync(e), !r) throw new Error("absolute srcpath does not exist");
    return {
      toCwd: e,
      toDst: e
    };
  } else {
    const n = en.dirname(t), i = en.join(n, e);
    if (r = Ea.existsSync(i), r)
      return {
        toCwd: i,
        toDst: e
      };
    if (r = Ea.existsSync(e), !r) throw new Error("relative srcpath does not exist");
    return {
      toCwd: e,
      toDst: en.relative(n, e)
    };
  }
}
var Aw = {
  symlinkPaths: Tw,
  symlinkPathsSync: Cw
};
const gv = At;
function Pw(e, t, r) {
  if (r = typeof t == "function" ? t : r, t = typeof t == "function" ? !1 : t, t) return r(null, t);
  gv.lstat(e, (n, i) => {
    if (n) return r(null, "file");
    t = i && i.isDirectory() ? "dir" : "file", r(null, t);
  });
}
function Rw(e, t) {
  let r;
  if (t) return t;
  try {
    r = gv.lstatSync(e);
  } catch {
    return "file";
  }
  return r && r.isDirectory() ? "dir" : "file";
}
var Ow = {
  symlinkType: Pw,
  symlinkTypeSync: Rw
};
const Dw = Ct.fromCallback, mv = Me, or = Xn, yv = Fr, kw = yv.mkdirs, Nw = yv.mkdirsSync, bv = Aw, Iw = bv.symlinkPaths, Uw = bv.symlinkPathsSync, wv = Ow, Lw = wv.symlinkType, Bw = wv.symlinkTypeSync, Mw = Yn.pathExists, { areIdentical: xv } = Mi;
function jw(e, t, r, n) {
  n = typeof r == "function" ? r : n, r = typeof r == "function" ? !1 : r, or.lstat(t, (i, a) => {
    !i && a.isSymbolicLink() ? Promise.all([
      or.stat(e),
      or.stat(t)
    ]).then(([o, s]) => {
      if (xv(o, s)) return n(null);
      kh(e, t, r, n);
    }) : kh(e, t, r, n);
  });
}
function kh(e, t, r, n) {
  Iw(e, t, (i, a) => {
    if (i) return n(i);
    e = a.toDst, Lw(a.toCwd, r, (o, s) => {
      if (o) return n(o);
      const l = mv.dirname(t);
      Mw(l, (u, c) => {
        if (u) return n(u);
        if (c) return or.symlink(e, t, s, n);
        kw(l, (f) => {
          if (f) return n(f);
          or.symlink(e, t, s, n);
        });
      });
    });
  });
}
function _w(e, t, r) {
  let n;
  try {
    n = or.lstatSync(t);
  } catch {
  }
  if (n && n.isSymbolicLink()) {
    const s = or.statSync(e), l = or.statSync(t);
    if (xv(s, l)) return;
  }
  const i = Uw(e, t);
  e = i.toDst, r = Bw(i.toCwd, r);
  const a = mv.dirname(t);
  return or.existsSync(a) || Nw(a), or.symlinkSync(e, t, r);
}
var zw = {
  createSymlink: Dw(jw),
  createSymlinkSync: _w
};
const { createFile: Nh, createFileSync: Ih } = yw, { createLink: Uh, createLinkSync: Lh } = Sw, { createSymlink: Bh, createSymlinkSync: Mh } = zw;
var qw = {
  // file
  createFile: Nh,
  createFileSync: Ih,
  ensureFile: Nh,
  ensureFileSync: Ih,
  // link
  createLink: Uh,
  createLinkSync: Lh,
  ensureLink: Uh,
  ensureLinkSync: Lh,
  // symlink
  createSymlink: Bh,
  createSymlinkSync: Mh,
  ensureSymlink: Bh,
  ensureSymlinkSync: Mh
};
function Vw(e, { EOL: t = `
`, finalEOL: r = !0, replacer: n = null, spaces: i } = {}) {
  const a = r ? t : "";
  return JSON.stringify(e, n, i).replace(/\n/g, t) + a;
}
function Hw(e) {
  return Buffer.isBuffer(e) && (e = e.toString("utf8")), e.replace(/^\uFEFF/, "");
}
var $c = { stringify: Vw, stripBom: Hw };
let ki;
try {
  ki = At;
} catch {
  ki = Ae;
}
const vl = Ct, { stringify: Ev, stripBom: Sv } = $c;
async function Ww(e, t = {}) {
  typeof t == "string" && (t = { encoding: t });
  const r = t.fs || ki, n = "throws" in t ? t.throws : !0;
  let i = await vl.fromCallback(r.readFile)(e, t);
  i = Sv(i);
  let a;
  try {
    a = JSON.parse(i, t ? t.reviver : null);
  } catch (o) {
    if (n)
      throw o.message = `${e}: ${o.message}`, o;
    return null;
  }
  return a;
}
const Gw = vl.fromPromise(Ww);
function Kw(e, t = {}) {
  typeof t == "string" && (t = { encoding: t });
  const r = t.fs || ki, n = "throws" in t ? t.throws : !0;
  try {
    let i = r.readFileSync(e, t);
    return i = Sv(i), JSON.parse(i, t.reviver);
  } catch (i) {
    if (n)
      throw i.message = `${e}: ${i.message}`, i;
    return null;
  }
}
async function Xw(e, t, r = {}) {
  const n = r.fs || ki, i = Ev(t, r);
  await vl.fromCallback(n.writeFile)(e, i, r);
}
const Yw = vl.fromPromise(Xw);
function Zw(e, t, r = {}) {
  const n = r.fs || ki, i = Ev(t, r);
  return n.writeFileSync(e, i, r);
}
var Jw = {
  readFile: Gw,
  readFileSync: Kw,
  writeFile: Yw,
  writeFileSync: Zw
};
const Ho = Jw;
var Qw = {
  // jsonfile exports
  readJson: Ho.readFile,
  readJsonSync: Ho.readFileSync,
  writeJson: Ho.writeFile,
  writeJsonSync: Ho.writeFileSync
};
const $w = Ct.fromCallback, Sa = At, Fv = Me, Tv = Fr, ex = Yn.pathExists;
function tx(e, t, r, n) {
  typeof r == "function" && (n = r, r = "utf8");
  const i = Fv.dirname(e);
  ex(i, (a, o) => {
    if (a) return n(a);
    if (o) return Sa.writeFile(e, t, r, n);
    Tv.mkdirs(i, (s) => {
      if (s) return n(s);
      Sa.writeFile(e, t, r, n);
    });
  });
}
function rx(e, ...t) {
  const r = Fv.dirname(e);
  if (Sa.existsSync(r))
    return Sa.writeFileSync(e, ...t);
  Tv.mkdirsSync(r), Sa.writeFileSync(e, ...t);
}
var ef = {
  outputFile: $w(tx),
  outputFileSync: rx
};
const { stringify: nx } = $c, { outputFile: ix } = ef;
async function ax(e, t, r = {}) {
  const n = nx(t, r);
  await ix(e, n, r);
}
var ox = ax;
const { stringify: sx } = $c, { outputFileSync: lx } = ef;
function ux(e, t, r) {
  const n = sx(t, r);
  lx(e, n, r);
}
var cx = ux;
const fx = Ct.fromPromise, Tt = Qw;
Tt.outputJson = fx(ox);
Tt.outputJsonSync = cx;
Tt.outputJSON = Tt.outputJson;
Tt.outputJSONSync = Tt.outputJsonSync;
Tt.writeJSON = Tt.writeJson;
Tt.writeJSONSync = Tt.writeJsonSync;
Tt.readJSON = Tt.readJson;
Tt.readJSONSync = Tt.readJsonSync;
var hx = Tt;
const dx = At, sc = Me, px = Jc.copy, Cv = pl.remove, vx = Fr.mkdirp, gx = Yn.pathExists, jh = Mi;
function mx(e, t, r, n) {
  typeof r == "function" && (n = r, r = {}), r = r || {};
  const i = r.overwrite || r.clobber || !1;
  jh.checkPaths(e, t, "move", r, (a, o) => {
    if (a) return n(a);
    const { srcStat: s, isChangingCase: l = !1 } = o;
    jh.checkParentPaths(e, s, t, "move", (u) => {
      if (u) return n(u);
      if (yx(t)) return _h(e, t, i, l, n);
      vx(sc.dirname(t), (c) => c ? n(c) : _h(e, t, i, l, n));
    });
  });
}
function yx(e) {
  const t = sc.dirname(e);
  return sc.parse(t).root === t;
}
function _h(e, t, r, n, i) {
  if (n) return fu(e, t, r, i);
  if (r)
    return Cv(t, (a) => a ? i(a) : fu(e, t, r, i));
  gx(t, (a, o) => a ? i(a) : o ? i(new Error("dest already exists.")) : fu(e, t, r, i));
}
function fu(e, t, r, n) {
  dx.rename(e, t, (i) => i ? i.code !== "EXDEV" ? n(i) : bx(e, t, r, n) : n());
}
function bx(e, t, r, n) {
  px(e, t, {
    overwrite: r,
    errorOnExist: !0
  }, (a) => a ? n(a) : Cv(e, n));
}
var wx = mx;
const Av = At, lc = Me, xx = Jc.copySync, Pv = pl.removeSync, Ex = Fr.mkdirpSync, zh = Mi;
function Sx(e, t, r) {
  r = r || {};
  const n = r.overwrite || r.clobber || !1, { srcStat: i, isChangingCase: a = !1 } = zh.checkPathsSync(e, t, "move", r);
  return zh.checkParentPathsSync(e, i, t, "move"), Fx(t) || Ex(lc.dirname(t)), Tx(e, t, n, a);
}
function Fx(e) {
  const t = lc.dirname(e);
  return lc.parse(t).root === t;
}
function Tx(e, t, r, n) {
  if (n) return hu(e, t, r);
  if (r)
    return Pv(t), hu(e, t, r);
  if (Av.existsSync(t)) throw new Error("dest already exists.");
  return hu(e, t, r);
}
function hu(e, t, r) {
  try {
    Av.renameSync(e, t);
  } catch (n) {
    if (n.code !== "EXDEV") throw n;
    return Cx(e, t, r);
  }
}
function Cx(e, t, r) {
  return xx(e, t, {
    overwrite: r,
    errorOnExist: !0
  }), Pv(e);
}
var Ax = Sx;
const Px = Ct.fromCallback;
var Rx = {
  move: Px(wx),
  moveSync: Ax
}, bn = {
  // Export promiseified graceful-fs:
  ...Xn,
  // Export extra methods:
  ...Jc,
  ...pw,
  ...qw,
  ...hx,
  ...Fr,
  ...Rx,
  ...ef,
  ...Yn,
  ...pl
}, Zn = {}, un = {}, et = {}, cn = {};
Object.defineProperty(cn, "__esModule", { value: !0 });
cn.CancellationError = cn.CancellationToken = void 0;
const Ox = Bp;
class Dx extends Ox.EventEmitter {
  get cancelled() {
    return this._cancelled || this._parent != null && this._parent.cancelled;
  }
  set parent(t) {
    this.removeParentCancelHandler(), this._parent = t, this.parentCancelHandler = () => this.cancel(), this._parent.onCancel(this.parentCancelHandler);
  }
  // babel cannot compile ... correctly for super calls
  constructor(t) {
    super(), this.parentCancelHandler = null, this._parent = null, this._cancelled = !1, t != null && (this.parent = t);
  }
  cancel() {
    this._cancelled = !0, this.emit("cancel");
  }
  onCancel(t) {
    this.cancelled ? t() : this.once("cancel", t);
  }
  createPromise(t) {
    if (this.cancelled)
      return Promise.reject(new uc());
    const r = () => {
      if (n != null)
        try {
          this.removeListener("cancel", n), n = null;
        } catch {
        }
    };
    let n = null;
    return new Promise((i, a) => {
      let o = null;
      if (n = () => {
        try {
          o != null && (o(), o = null);
        } finally {
          a(new uc());
        }
      }, this.cancelled) {
        n();
        return;
      }
      this.onCancel(n), t(i, a, (s) => {
        o = s;
      });
    }).then((i) => (r(), i)).catch((i) => {
      throw r(), i;
    });
  }
  removeParentCancelHandler() {
    const t = this._parent;
    t != null && this.parentCancelHandler != null && (t.removeListener("cancel", this.parentCancelHandler), this.parentCancelHandler = null);
  }
  dispose() {
    try {
      this.removeParentCancelHandler();
    } finally {
      this.removeAllListeners(), this._parent = null;
    }
  }
}
cn.CancellationToken = Dx;
class uc extends Error {
  constructor() {
    super("cancelled");
  }
}
cn.CancellationError = uc;
var ji = {};
Object.defineProperty(ji, "__esModule", { value: !0 });
ji.newError = kx;
function kx(e, t) {
  const r = new Error(e);
  return r.code = t, r;
}
var Et = {}, cc = { exports: {} }, Wo = { exports: {} }, du, qh;
function Nx() {
  if (qh) return du;
  qh = 1;
  var e = 1e3, t = e * 60, r = t * 60, n = r * 24, i = n * 7, a = n * 365.25;
  du = function(c, f) {
    f = f || {};
    var h = typeof c;
    if (h === "string" && c.length > 0)
      return o(c);
    if (h === "number" && isFinite(c))
      return f.long ? l(c) : s(c);
    throw new Error(
      "val is not a non-empty string or a valid number. val=" + JSON.stringify(c)
    );
  };
  function o(c) {
    if (c = String(c), !(c.length > 100)) {
      var f = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        c
      );
      if (f) {
        var h = parseFloat(f[1]), d = (f[2] || "ms").toLowerCase();
        switch (d) {
          case "years":
          case "year":
          case "yrs":
          case "yr":
          case "y":
            return h * a;
          case "weeks":
          case "week":
          case "w":
            return h * i;
          case "days":
          case "day":
          case "d":
            return h * n;
          case "hours":
          case "hour":
          case "hrs":
          case "hr":
          case "h":
            return h * r;
          case "minutes":
          case "minute":
          case "mins":
          case "min":
          case "m":
            return h * t;
          case "seconds":
          case "second":
          case "secs":
          case "sec":
          case "s":
            return h * e;
          case "milliseconds":
          case "millisecond":
          case "msecs":
          case "msec":
          case "ms":
            return h;
          default:
            return;
        }
      }
    }
  }
  function s(c) {
    var f = Math.abs(c);
    return f >= n ? Math.round(c / n) + "d" : f >= r ? Math.round(c / r) + "h" : f >= t ? Math.round(c / t) + "m" : f >= e ? Math.round(c / e) + "s" : c + "ms";
  }
  function l(c) {
    var f = Math.abs(c);
    return f >= n ? u(c, f, n, "day") : f >= r ? u(c, f, r, "hour") : f >= t ? u(c, f, t, "minute") : f >= e ? u(c, f, e, "second") : c + " ms";
  }
  function u(c, f, h, d) {
    var p = f >= h * 1.5;
    return Math.round(c / h) + " " + d + (p ? "s" : "");
  }
  return du;
}
var pu, Vh;
function Rv() {
  if (Vh) return pu;
  Vh = 1;
  function e(t) {
    n.debug = n, n.default = n, n.coerce = u, n.disable = s, n.enable = a, n.enabled = l, n.humanize = Nx(), n.destroy = c, Object.keys(t).forEach((f) => {
      n[f] = t[f];
    }), n.names = [], n.skips = [], n.formatters = {};
    function r(f) {
      let h = 0;
      for (let d = 0; d < f.length; d++)
        h = (h << 5) - h + f.charCodeAt(d), h |= 0;
      return n.colors[Math.abs(h) % n.colors.length];
    }
    n.selectColor = r;
    function n(f) {
      let h, d = null, p, v;
      function y(...m) {
        if (!y.enabled)
          return;
        const S = y, T = Number(/* @__PURE__ */ new Date()), C = T - (h || T);
        S.diff = C, S.prev = h, S.curr = T, h = T, m[0] = n.coerce(m[0]), typeof m[0] != "string" && m.unshift("%O");
        let A = 0;
        m[0] = m[0].replace(/%([a-zA-Z%])/g, (k, M) => {
          if (k === "%%")
            return "%";
          A++;
          const b = n.formatters[M];
          if (typeof b == "function") {
            const j = m[A];
            k = b.call(S, j), m.splice(A, 1), A--;
          }
          return k;
        }), n.formatArgs.call(S, m), (S.log || n.log).apply(S, m);
      }
      return y.namespace = f, y.useColors = n.useColors(), y.color = n.selectColor(f), y.extend = i, y.destroy = n.destroy, Object.defineProperty(y, "enabled", {
        enumerable: !0,
        configurable: !1,
        get: () => d !== null ? d : (p !== n.namespaces && (p = n.namespaces, v = n.enabled(f)), v),
        set: (m) => {
          d = m;
        }
      }), typeof n.init == "function" && n.init(y), y;
    }
    function i(f, h) {
      const d = n(this.namespace + (typeof h > "u" ? ":" : h) + f);
      return d.log = this.log, d;
    }
    function a(f) {
      n.save(f), n.namespaces = f, n.names = [], n.skips = [];
      const h = (typeof f == "string" ? f : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
      for (const d of h)
        d[0] === "-" ? n.skips.push(d.slice(1)) : n.names.push(d);
    }
    function o(f, h) {
      let d = 0, p = 0, v = -1, y = 0;
      for (; d < f.length; )
        if (p < h.length && (h[p] === f[d] || h[p] === "*"))
          h[p] === "*" ? (v = p, y = d, p++) : (d++, p++);
        else if (v !== -1)
          p = v + 1, y++, d = y;
        else
          return !1;
      for (; p < h.length && h[p] === "*"; )
        p++;
      return p === h.length;
    }
    function s() {
      const f = [
        ...n.names,
        ...n.skips.map((h) => "-" + h)
      ].join(",");
      return n.enable(""), f;
    }
    function l(f) {
      for (const h of n.skips)
        if (o(f, h))
          return !1;
      for (const h of n.names)
        if (o(f, h))
          return !0;
      return !1;
    }
    function u(f) {
      return f instanceof Error ? f.stack || f.message : f;
    }
    function c() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    return n.enable(n.load()), n;
  }
  return pu = e, pu;
}
var Hh;
function Ix() {
  return Hh || (Hh = 1, function(e, t) {
    t.formatArgs = n, t.save = i, t.load = a, t.useColors = r, t.storage = o(), t.destroy = /* @__PURE__ */ (() => {
      let l = !1;
      return () => {
        l || (l = !0, console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."));
      };
    })(), t.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function r() {
      if (typeof window < "u" && window.process && (window.process.type === "renderer" || window.process.__nwjs))
        return !0;
      if (typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/))
        return !1;
      let l;
      return typeof document < "u" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window < "u" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator < "u" && navigator.userAgent && (l = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(l[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function n(l) {
      if (l[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + l[0] + (this.useColors ? "%c " : " ") + "+" + e.exports.humanize(this.diff), !this.useColors)
        return;
      const u = "color: " + this.color;
      l.splice(1, 0, u, "color: inherit");
      let c = 0, f = 0;
      l[0].replace(/%[a-zA-Z%]/g, (h) => {
        h !== "%%" && (c++, h === "%c" && (f = c));
      }), l.splice(f, 0, u);
    }
    t.log = console.debug || console.log || (() => {
    });
    function i(l) {
      try {
        l ? t.storage.setItem("debug", l) : t.storage.removeItem("debug");
      } catch {
      }
    }
    function a() {
      let l;
      try {
        l = t.storage.getItem("debug") || t.storage.getItem("DEBUG");
      } catch {
      }
      return !l && typeof process < "u" && "env" in process && (l = process.env.DEBUG), l;
    }
    function o() {
      try {
        return localStorage;
      } catch {
      }
    }
    e.exports = Rv()(t);
    const { formatters: s } = e.exports;
    s.j = function(l) {
      try {
        return JSON.stringify(l);
      } catch (u) {
        return "[UnexpectedJSONParseError]: " + u.message;
      }
    };
  }(Wo, Wo.exports)), Wo.exports;
}
var Go = { exports: {} }, vu, Wh;
function Ux() {
  return Wh || (Wh = 1, vu = (e, t = process.argv) => {
    const r = e.startsWith("-") ? "" : e.length === 1 ? "-" : "--", n = t.indexOf(r + e), i = t.indexOf("--");
    return n !== -1 && (i === -1 || n < i);
  }), vu;
}
var gu, Gh;
function Lx() {
  if (Gh) return gu;
  Gh = 1;
  const e = fl, t = Mp, r = Ux(), { env: n } = process;
  let i;
  r("no-color") || r("no-colors") || r("color=false") || r("color=never") ? i = 0 : (r("color") || r("colors") || r("color=true") || r("color=always")) && (i = 1), "FORCE_COLOR" in n && (n.FORCE_COLOR === "true" ? i = 1 : n.FORCE_COLOR === "false" ? i = 0 : i = n.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(n.FORCE_COLOR, 10), 3));
  function a(l) {
    return l === 0 ? !1 : {
      level: l,
      hasBasic: !0,
      has256: l >= 2,
      has16m: l >= 3
    };
  }
  function o(l, u) {
    if (i === 0)
      return 0;
    if (r("color=16m") || r("color=full") || r("color=truecolor"))
      return 3;
    if (r("color=256"))
      return 2;
    if (l && !u && i === void 0)
      return 0;
    const c = i || 0;
    if (n.TERM === "dumb")
      return c;
    if (process.platform === "win32") {
      const f = e.release().split(".");
      return Number(f[0]) >= 10 && Number(f[2]) >= 10586 ? Number(f[2]) >= 14931 ? 3 : 2 : 1;
    }
    if ("CI" in n)
      return ["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((f) => f in n) || n.CI_NAME === "codeship" ? 1 : c;
    if ("TEAMCITY_VERSION" in n)
      return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(n.TEAMCITY_VERSION) ? 1 : 0;
    if (n.COLORTERM === "truecolor")
      return 3;
    if ("TERM_PROGRAM" in n) {
      const f = parseInt((n.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
      switch (n.TERM_PROGRAM) {
        case "iTerm.app":
          return f >= 3 ? 3 : 2;
        case "Apple_Terminal":
          return 2;
      }
    }
    return /-256(color)?$/i.test(n.TERM) ? 2 : /^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(n.TERM) || "COLORTERM" in n ? 1 : c;
  }
  function s(l) {
    const u = o(l, l && l.isTTY);
    return a(u);
  }
  return gu = {
    supportsColor: s,
    stdout: a(o(!0, t.isatty(1))),
    stderr: a(o(!0, t.isatty(2)))
  }, gu;
}
var Kh;
function Bx() {
  return Kh || (Kh = 1, function(e, t) {
    const r = Mp, n = Wc;
    t.init = c, t.log = s, t.formatArgs = a, t.save = l, t.load = u, t.useColors = i, t.destroy = n.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    ), t.colors = [6, 2, 3, 4, 5, 1];
    try {
      const h = Lx();
      h && (h.stderr || h).level >= 2 && (t.colors = [
        20,
        21,
        26,
        27,
        32,
        33,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        56,
        57,
        62,
        63,
        68,
        69,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        92,
        93,
        98,
        99,
        112,
        113,
        128,
        129,
        134,
        135,
        148,
        149,
        160,
        161,
        162,
        163,
        164,
        165,
        166,
        167,
        168,
        169,
        170,
        171,
        172,
        173,
        178,
        179,
        184,
        185,
        196,
        197,
        198,
        199,
        200,
        201,
        202,
        203,
        204,
        205,
        206,
        207,
        208,
        209,
        214,
        215,
        220,
        221
      ]);
    } catch {
    }
    t.inspectOpts = Object.keys(process.env).filter((h) => /^debug_/i.test(h)).reduce((h, d) => {
      const p = d.substring(6).toLowerCase().replace(/_([a-z])/g, (y, m) => m.toUpperCase());
      let v = process.env[d];
      return /^(yes|on|true|enabled)$/i.test(v) ? v = !0 : /^(no|off|false|disabled)$/i.test(v) ? v = !1 : v === "null" ? v = null : v = Number(v), h[p] = v, h;
    }, {});
    function i() {
      return "colors" in t.inspectOpts ? !!t.inspectOpts.colors : r.isatty(process.stderr.fd);
    }
    function a(h) {
      const { namespace: d, useColors: p } = this;
      if (p) {
        const v = this.color, y = "\x1B[3" + (v < 8 ? v : "8;5;" + v), m = `  ${y};1m${d} \x1B[0m`;
        h[0] = m + h[0].split(`
`).join(`
` + m), h.push(y + "m+" + e.exports.humanize(this.diff) + "\x1B[0m");
      } else
        h[0] = o() + d + " " + h[0];
    }
    function o() {
      return t.inspectOpts.hideDate ? "" : (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function s(...h) {
      return process.stderr.write(n.formatWithOptions(t.inspectOpts, ...h) + `
`);
    }
    function l(h) {
      h ? process.env.DEBUG = h : delete process.env.DEBUG;
    }
    function u() {
      return process.env.DEBUG;
    }
    function c(h) {
      h.inspectOpts = {};
      const d = Object.keys(t.inspectOpts);
      for (let p = 0; p < d.length; p++)
        h.inspectOpts[d[p]] = t.inspectOpts[d[p]];
    }
    e.exports = Rv()(t);
    const { formatters: f } = e.exports;
    f.o = function(h) {
      return this.inspectOpts.colors = this.useColors, n.inspect(h, this.inspectOpts).split(`
`).map((d) => d.trim()).join(" ");
    }, f.O = function(h) {
      return this.inspectOpts.colors = this.useColors, n.inspect(h, this.inspectOpts);
    };
  }(Go, Go.exports)), Go.exports;
}
typeof process > "u" || process.type === "renderer" || process.browser === !0 || process.__nwjs ? cc.exports = Ix() : cc.exports = Bx();
var Mx = cc.exports, co = {};
Object.defineProperty(co, "__esModule", { value: !0 });
co.ProgressCallbackTransform = void 0;
const jx = lo;
class _x extends jx.Transform {
  constructor(t, r, n) {
    super(), this.total = t, this.cancellationToken = r, this.onProgress = n, this.start = Date.now(), this.transferred = 0, this.delta = 0, this.nextUpdate = this.start + 1e3;
  }
  _transform(t, r, n) {
    if (this.cancellationToken.cancelled) {
      n(new Error("cancelled"), null);
      return;
    }
    this.transferred += t.length, this.delta += t.length;
    const i = Date.now();
    i >= this.nextUpdate && this.transferred !== this.total && (this.nextUpdate = i + 1e3, this.onProgress({
      total: this.total,
      delta: this.delta,
      transferred: this.transferred,
      percent: this.transferred / this.total * 100,
      bytesPerSecond: Math.round(this.transferred / ((i - this.start) / 1e3))
    }), this.delta = 0), n(null, t);
  }
  _flush(t) {
    if (this.cancellationToken.cancelled) {
      t(new Error("cancelled"));
      return;
    }
    this.onProgress({
      total: this.total,
      delta: this.delta,
      transferred: this.total,
      percent: 100,
      bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
    }), this.delta = 0, t(null);
  }
}
co.ProgressCallbackTransform = _x;
Object.defineProperty(Et, "__esModule", { value: !0 });
Et.DigestTransform = Et.HttpExecutor = Et.HttpError = void 0;
Et.createHttpError = hc;
Et.parseJson = Xx;
Et.configureRequestOptionsFromUrl = Dv;
Et.configureRequestUrl = rf;
Et.safeGetHeader = Ci;
Et.configureRequestOptions = js;
Et.safeStringifyJson = _s;
const zx = Bi, qx = Mx, Vx = Ae, Hx = lo, fc = yn, Wx = cn, Xh = ji, Gx = co, Pn = (0, qx.default)("electron-builder");
function hc(e, t = null) {
  return new tf(e.statusCode || -1, `${e.statusCode} ${e.statusMessage}` + (t == null ? "" : `
` + JSON.stringify(t, null, "  ")) + `
Headers: ` + _s(e.headers), t);
}
const Kx = /* @__PURE__ */ new Map([
  [429, "Too many requests"],
  [400, "Bad request"],
  [403, "Forbidden"],
  [404, "Not found"],
  [405, "Method not allowed"],
  [406, "Not acceptable"],
  [408, "Request timeout"],
  [413, "Request entity too large"],
  [500, "Internal server error"],
  [502, "Bad gateway"],
  [503, "Service unavailable"],
  [504, "Gateway timeout"],
  [505, "HTTP version not supported"]
]);
class tf extends Error {
  constructor(t, r = `HTTP error: ${Kx.get(t) || t}`, n = null) {
    super(r), this.statusCode = t, this.description = n, this.name = "HttpError", this.code = `HTTP_ERROR_${t}`;
  }
  isServerError() {
    return this.statusCode >= 500 && this.statusCode <= 599;
  }
}
Et.HttpError = tf;
function Xx(e) {
  return e.then((t) => t == null || t.length === 0 ? null : JSON.parse(t));
}
class mi {
  constructor() {
    this.maxRedirects = 10;
  }
  request(t, r = new Wx.CancellationToken(), n) {
    js(t);
    const i = n == null ? void 0 : JSON.stringify(n), a = i ? Buffer.from(i) : void 0;
    if (a != null) {
      Pn(i);
      const { headers: o, ...s } = t;
      t = {
        method: "post",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": a.length,
          ...o
        },
        ...s
      };
    }
    return this.doApiRequest(t, r, (o) => o.end(a));
  }
  doApiRequest(t, r, n, i = 0) {
    return Pn.enabled && Pn(`Request: ${_s(t)}`), r.createPromise((a, o, s) => {
      const l = this.createRequest(t, (u) => {
        try {
          this.handleResponse(u, t, r, a, o, i, n);
        } catch (c) {
          o(c);
        }
      });
      this.addErrorAndTimeoutHandlers(l, o, t.timeout), this.addRedirectHandlers(l, t, o, i, (u) => {
        this.doApiRequest(u, r, n, i).then(a).catch(o);
      }), n(l, o), s(() => l.abort());
    });
  }
  // noinspection JSUnusedLocalSymbols
  // eslint-disable-next-line
  addRedirectHandlers(t, r, n, i, a) {
  }
  addErrorAndTimeoutHandlers(t, r, n = 60 * 1e3) {
    this.addTimeOutHandler(t, r, n), t.on("error", r), t.on("aborted", () => {
      r(new Error("Request has been aborted by the server"));
    });
  }
  handleResponse(t, r, n, i, a, o, s) {
    var l;
    if (Pn.enabled && Pn(`Response: ${t.statusCode} ${t.statusMessage}, request options: ${_s(r)}`), t.statusCode === 404) {
      a(hc(t, `method: ${r.method || "GET"} url: ${r.protocol || "https:"}//${r.hostname}${r.port ? `:${r.port}` : ""}${r.path}

Please double check that your authentication token is correct. Due to security reasons, actual status maybe not reported, but 404.
`));
      return;
    } else if (t.statusCode === 204) {
      i();
      return;
    }
    const u = (l = t.statusCode) !== null && l !== void 0 ? l : 0, c = u >= 300 && u < 400, f = Ci(t, "location");
    if (c && f != null) {
      if (o > this.maxRedirects) {
        a(this.createMaxRedirectError());
        return;
      }
      this.doApiRequest(mi.prepareRedirectUrlOptions(f, r), n, s, o).then(i).catch(a);
      return;
    }
    t.setEncoding("utf8");
    let h = "";
    t.on("error", a), t.on("data", (d) => h += d), t.on("end", () => {
      try {
        if (t.statusCode != null && t.statusCode >= 400) {
          const d = Ci(t, "content-type"), p = d != null && (Array.isArray(d) ? d.find((v) => v.includes("json")) != null : d.includes("json"));
          a(hc(t, `method: ${r.method || "GET"} url: ${r.protocol || "https:"}//${r.hostname}${r.port ? `:${r.port}` : ""}${r.path}

          Data:
          ${p ? JSON.stringify(JSON.parse(h)) : h}
          `));
        } else
          i(h.length === 0 ? null : h);
      } catch (d) {
        a(d);
      }
    });
  }
  async downloadToBuffer(t, r) {
    return await r.cancellationToken.createPromise((n, i, a) => {
      const o = [], s = {
        headers: r.headers || void 0,
        // because PrivateGitHubProvider requires HttpExecutor.prepareRedirectUrlOptions logic, so, we need to redirect manually
        redirect: "manual"
      };
      rf(t, s), js(s), this.doDownload(s, {
        destination: null,
        options: r,
        onCancel: a,
        callback: (l) => {
          l == null ? n(Buffer.concat(o)) : i(l);
        },
        responseHandler: (l, u) => {
          let c = 0;
          l.on("data", (f) => {
            if (c += f.length, c > 524288e3) {
              u(new Error("Maximum allowed size is 500 MB"));
              return;
            }
            o.push(f);
          }), l.on("end", () => {
            u(null);
          });
        }
      }, 0);
    });
  }
  doDownload(t, r, n) {
    const i = this.createRequest(t, (a) => {
      if (a.statusCode >= 400) {
        r.callback(new Error(`Cannot download "${t.protocol || "https:"}//${t.hostname}${t.path}", status ${a.statusCode}: ${a.statusMessage}`));
        return;
      }
      a.on("error", r.callback);
      const o = Ci(a, "location");
      if (o != null) {
        n < this.maxRedirects ? this.doDownload(mi.prepareRedirectUrlOptions(o, t), r, n++) : r.callback(this.createMaxRedirectError());
        return;
      }
      r.responseHandler == null ? Zx(r, a) : r.responseHandler(a, r.callback);
    });
    this.addErrorAndTimeoutHandlers(i, r.callback, t.timeout), this.addRedirectHandlers(i, t, r.callback, n, (a) => {
      this.doDownload(a, r, n++);
    }), i.end();
  }
  createMaxRedirectError() {
    return new Error(`Too many redirects (> ${this.maxRedirects})`);
  }
  addTimeOutHandler(t, r, n) {
    t.on("socket", (i) => {
      i.setTimeout(n, () => {
        t.abort(), r(new Error("Request timed out"));
      });
    });
  }
  static prepareRedirectUrlOptions(t, r) {
    const n = Dv(t, { ...r }), i = n.headers;
    if (i != null && i.authorization) {
      const a = mi.reconstructOriginalUrl(r), o = Ov(t, r);
      mi.isCrossOriginRedirect(a, o) && (Pn.enabled && Pn(`Given the cross-origin redirect (from ${a.host} to ${o.host}), the Authorization header will be stripped out.`), delete i.authorization);
    }
    return n;
  }
  static reconstructOriginalUrl(t) {
    const r = t.protocol || "https:";
    if (!t.hostname)
      throw new Error("Missing hostname in request options");
    const n = t.hostname, i = t.port ? `:${t.port}` : "", a = t.path || "/";
    return new fc.URL(`${r}//${n}${i}${a}`);
  }
  static isCrossOriginRedirect(t, r) {
    if (t.hostname.toLowerCase() !== r.hostname.toLowerCase())
      return !0;
    if (t.protocol === "http:" && // This can be replaced with `!originalUrl.port`, but for the sake of clarity.
    ["80", ""].includes(t.port) && r.protocol === "https:" && // This can be replaced with `!redirectUrl.port`, but for the sake of clarity.
    ["443", ""].includes(r.port))
      return !1;
    if (t.protocol !== r.protocol)
      return !0;
    const n = t.port, i = r.port;
    return n !== i;
  }
  static retryOnServerError(t, r = 3) {
    for (let n = 0; ; n++)
      try {
        return t();
      } catch (i) {
        if (n < r && (i instanceof tf && i.isServerError() || i.code === "EPIPE"))
          continue;
        throw i;
      }
  }
}
Et.HttpExecutor = mi;
function Ov(e, t) {
  try {
    return new fc.URL(e);
  } catch {
    const r = t.hostname, n = t.protocol || "https:", i = t.port ? `:${t.port}` : "", a = `${n}//${r}${i}`;
    return new fc.URL(e, a);
  }
}
function Dv(e, t) {
  const r = js(t), n = Ov(e, t);
  return rf(n, r), r;
}
function rf(e, t) {
  t.protocol = e.protocol, t.hostname = e.hostname, e.port ? t.port = e.port : t.port && delete t.port, t.path = e.pathname + e.search;
}
class dc extends Hx.Transform {
  // noinspection JSUnusedGlobalSymbols
  get actual() {
    return this._actual;
  }
  constructor(t, r = "sha512", n = "base64") {
    super(), this.expected = t, this.algorithm = r, this.encoding = n, this._actual = null, this.isValidateOnEnd = !0, this.digester = (0, zx.createHash)(r);
  }
  // noinspection JSUnusedGlobalSymbols
  _transform(t, r, n) {
    this.digester.update(t), n(null, t);
  }
  // noinspection JSUnusedGlobalSymbols
  _flush(t) {
    if (this._actual = this.digester.digest(this.encoding), this.isValidateOnEnd)
      try {
        this.validate();
      } catch (r) {
        t(r);
        return;
      }
    t(null);
  }
  validate() {
    if (this._actual == null)
      throw (0, Xh.newError)("Not finished yet", "ERR_STREAM_NOT_FINISHED");
    if (this._actual !== this.expected)
      throw (0, Xh.newError)(`${this.algorithm} checksum mismatch, expected ${this.expected}, got ${this._actual}`, "ERR_CHECKSUM_MISMATCH");
    return null;
  }
}
Et.DigestTransform = dc;
function Yx(e, t, r) {
  return e != null && t != null && e !== t ? (r(new Error(`checksum mismatch: expected ${t} but got ${e} (X-Checksum-Sha2 header)`)), !1) : !0;
}
function Ci(e, t) {
  const r = e.headers[t];
  return r == null ? null : Array.isArray(r) ? r.length === 0 ? null : r[r.length - 1] : r;
}
function Zx(e, t) {
  if (!Yx(Ci(t, "X-Checksum-Sha2"), e.options.sha2, e.callback))
    return;
  const r = [];
  if (e.options.onProgress != null) {
    const o = Ci(t, "content-length");
    o != null && r.push(new Gx.ProgressCallbackTransform(parseInt(o, 10), e.options.cancellationToken, e.options.onProgress));
  }
  const n = e.options.sha512;
  n != null ? r.push(new dc(n, "sha512", n.length === 128 && !n.includes("+") && !n.includes("Z") && !n.includes("=") ? "hex" : "base64")) : e.options.sha2 != null && r.push(new dc(e.options.sha2, "sha256", "hex"));
  const i = (0, Vx.createWriteStream)(e.destination);
  r.push(i);
  let a = t;
  for (const o of r)
    o.on("error", (s) => {
      i.close(), e.options.cancellationToken.cancelled || e.callback(s);
    }), a = a.pipe(o);
  i.on("finish", () => {
    i.close(e.callback);
  });
}
function js(e, t, r) {
  r != null && (e.method = r), e.headers = { ...e.headers };
  const n = e.headers;
  return t != null && (n.authorization = t.startsWith("Basic") || t.startsWith("Bearer") ? t : `token ${t}`), n["User-Agent"] == null && (n["User-Agent"] = "electron-builder"), (r == null || r === "GET" || n["Cache-Control"] == null) && (n["Cache-Control"] = "no-cache"), e.protocol == null && process.versions.electron != null && (e.protocol = "https:"), e;
}
function _s(e, t) {
  return JSON.stringify(e, (r, n) => r.endsWith("Authorization") || r.endsWith("authorization") || r.endsWith("Password") || r.endsWith("PASSWORD") || r.endsWith("Token") || r.includes("password") || r.includes("token") || t != null && t.has(r) ? "<stripped sensitive data>" : n, 2);
}
var gl = {};
Object.defineProperty(gl, "__esModule", { value: !0 });
gl.MemoLazy = void 0;
class Jx {
  constructor(t, r) {
    this.selector = t, this.creator = r, this.selected = void 0, this._value = void 0;
  }
  get hasValue() {
    return this._value !== void 0;
  }
  get value() {
    const t = this.selector();
    if (this._value !== void 0 && kv(this.selected, t))
      return this._value;
    this.selected = t;
    const r = this.creator(t);
    return this.value = r, r;
  }
  set value(t) {
    this._value = t;
  }
}
gl.MemoLazy = Jx;
function kv(e, t) {
  if (typeof e == "object" && e !== null && (typeof t == "object" && t !== null)) {
    const i = Object.keys(e), a = Object.keys(t);
    return i.length === a.length && i.every((o) => kv(e[o], t[o]));
  }
  return e === t;
}
var fo = {};
Object.defineProperty(fo, "__esModule", { value: !0 });
fo.githubUrl = Qx;
fo.githubTagPrefix = $x;
fo.getS3LikeProviderBaseUrl = eE;
function Qx(e, t = "github.com") {
  return `${e.protocol || "https"}://${e.host || t}`;
}
function $x(e) {
  var t;
  return e.tagNamePrefix ? e.tagNamePrefix : !((t = e.vPrefixedTagName) !== null && t !== void 0) || t ? "v" : "";
}
function eE(e) {
  const t = e.provider;
  if (t === "s3")
    return tE(e);
  if (t === "spaces")
    return rE(e);
  throw new Error(`Not supported provider: ${t}`);
}
function tE(e) {
  let t;
  if (e.accelerate == !0)
    t = `https://${e.bucket}.s3-accelerate.amazonaws.com`;
  else if (e.endpoint != null)
    t = `${e.endpoint}/${e.bucket}`;
  else if (e.bucket.includes(".")) {
    if (e.region == null)
      throw new Error(`Bucket name "${e.bucket}" includes a dot, but S3 region is missing`);
    e.region === "us-east-1" ? t = `https://s3.amazonaws.com/${e.bucket}` : t = `https://s3-${e.region}.amazonaws.com/${e.bucket}`;
  } else e.region === "cn-north-1" ? t = `https://${e.bucket}.s3.${e.region}.amazonaws.com.cn` : t = `https://${e.bucket}.s3.amazonaws.com`;
  return Nv(t, e.path);
}
function Nv(e, t) {
  return t != null && t.length > 0 && (t.startsWith("/") || (e += "/"), e += t), e;
}
function rE(e) {
  if (e.name == null)
    throw new Error("name is missing");
  if (e.region == null)
    throw new Error("region is missing");
  return Nv(`https://${e.name}.${e.region}.digitaloceanspaces.com`, e.path);
}
var nf = {};
Object.defineProperty(nf, "__esModule", { value: !0 });
nf.retry = Iv;
const nE = cn;
async function Iv(e, t) {
  var r;
  const { retries: n, interval: i, backoff: a = 0, attempt: o = 0, shouldRetry: s, cancellationToken: l = new nE.CancellationToken() } = t;
  try {
    return await e();
  } catch (u) {
    if (await Promise.resolve((r = s == null ? void 0 : s(u)) !== null && r !== void 0 ? r : !0) && n > 0 && !l.cancelled)
      return await new Promise((c) => setTimeout(c, i + a * o)), await Iv(e, { ...t, retries: n - 1, attempt: o + 1 });
    throw u;
  }
}
var af = {};
Object.defineProperty(af, "__esModule", { value: !0 });
af.parseDn = iE;
function iE(e) {
  let t = !1, r = null, n = "", i = 0;
  e = e.trim();
  const a = /* @__PURE__ */ new Map();
  for (let o = 0; o <= e.length; o++) {
    if (o === e.length) {
      r !== null && a.set(r, n);
      break;
    }
    const s = e[o];
    if (t) {
      if (s === '"') {
        t = !1;
        continue;
      }
    } else {
      if (s === '"') {
        t = !0;
        continue;
      }
      if (s === "\\") {
        o++;
        const l = parseInt(e.slice(o, o + 2), 16);
        Number.isNaN(l) ? n += e[o] : (o++, n += String.fromCharCode(l));
        continue;
      }
      if (r === null && s === "=") {
        r = n, n = "";
        continue;
      }
      if (s === "," || s === ";" || s === "+") {
        r !== null && a.set(r, n), r = null, n = "";
        continue;
      }
    }
    if (s === " " && !t) {
      if (n.length === 0)
        continue;
      if (o > i) {
        let l = o;
        for (; e[l] === " "; )
          l++;
        i = l;
      }
      if (i >= e.length || e[i] === "," || e[i] === ";" || r === null && e[i] === "=" || r !== null && e[i] === "+") {
        o = i - 1;
        continue;
      }
    }
    n += s;
  }
  return a;
}
var Ni = {};
Object.defineProperty(Ni, "__esModule", { value: !0 });
Ni.nil = Ni.UUID = void 0;
const Uv = Bi, Lv = ji, aE = "options.name must be either a string or a Buffer", Yh = (0, Uv.randomBytes)(16);
Yh[0] = Yh[0] | 1;
const Fs = {}, xe = [];
for (let e = 0; e < 256; e++) {
  const t = (e + 256).toString(16).substr(1);
  Fs[t] = e, xe[e] = t;
}
class zn {
  constructor(t) {
    this.ascii = null, this.binary = null;
    const r = zn.check(t);
    if (!r)
      throw new Error("not a UUID");
    this.version = r.version, r.format === "ascii" ? this.ascii = t : this.binary = t;
  }
  static v5(t, r) {
    return oE(t, "sha1", 80, r);
  }
  toString() {
    return this.ascii == null && (this.ascii = sE(this.binary)), this.ascii;
  }
  inspect() {
    return `UUID v${this.version} ${this.toString()}`;
  }
  static check(t, r = 0) {
    if (typeof t == "string")
      return t = t.toLowerCase(), /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-([a-f0-9]{12})$/.test(t) ? t === "00000000-0000-0000-0000-000000000000" ? { version: void 0, variant: "nil", format: "ascii" } : {
        version: (Fs[t[14] + t[15]] & 240) >> 4,
        variant: Zh((Fs[t[19] + t[20]] & 224) >> 5),
        format: "ascii"
      } : !1;
    if (Buffer.isBuffer(t)) {
      if (t.length < r + 16)
        return !1;
      let n = 0;
      for (; n < 16 && t[r + n] === 0; n++)
        ;
      return n === 16 ? { version: void 0, variant: "nil", format: "binary" } : {
        version: (t[r + 6] & 240) >> 4,
        variant: Zh((t[r + 8] & 224) >> 5),
        format: "binary"
      };
    }
    throw (0, Lv.newError)("Unknown type of uuid", "ERR_UNKNOWN_UUID_TYPE");
  }
  // read stringified uuid into a Buffer
  static parse(t) {
    const r = Buffer.allocUnsafe(16);
    let n = 0;
    for (let i = 0; i < 16; i++)
      r[i] = Fs[t[n++] + t[n++]], (i === 3 || i === 5 || i === 7 || i === 9) && (n += 1);
    return r;
  }
}
Ni.UUID = zn;
zn.OID = zn.parse("6ba7b812-9dad-11d1-80b4-00c04fd430c8");
function Zh(e) {
  switch (e) {
    case 0:
    case 1:
    case 3:
      return "ncs";
    case 4:
    case 5:
      return "rfc4122";
    case 6:
      return "microsoft";
    default:
      return "future";
  }
}
var Fa;
(function(e) {
  e[e.ASCII = 0] = "ASCII", e[e.BINARY = 1] = "BINARY", e[e.OBJECT = 2] = "OBJECT";
})(Fa || (Fa = {}));
function oE(e, t, r, n, i = Fa.ASCII) {
  const a = (0, Uv.createHash)(t);
  if (typeof e != "string" && !Buffer.isBuffer(e))
    throw (0, Lv.newError)(aE, "ERR_INVALID_UUID_NAME");
  a.update(n), a.update(e);
  const s = a.digest();
  let l;
  switch (i) {
    case Fa.BINARY:
      s[6] = s[6] & 15 | r, s[8] = s[8] & 63 | 128, l = s;
      break;
    case Fa.OBJECT:
      s[6] = s[6] & 15 | r, s[8] = s[8] & 63 | 128, l = new zn(s);
      break;
    default:
      l = xe[s[0]] + xe[s[1]] + xe[s[2]] + xe[s[3]] + "-" + xe[s[4]] + xe[s[5]] + "-" + xe[s[6] & 15 | r] + xe[s[7]] + "-" + xe[s[8] & 63 | 128] + xe[s[9]] + "-" + xe[s[10]] + xe[s[11]] + xe[s[12]] + xe[s[13]] + xe[s[14]] + xe[s[15]];
      break;
  }
  return l;
}
function sE(e) {
  return xe[e[0]] + xe[e[1]] + xe[e[2]] + xe[e[3]] + "-" + xe[e[4]] + xe[e[5]] + "-" + xe[e[6]] + xe[e[7]] + "-" + xe[e[8]] + xe[e[9]] + "-" + xe[e[10]] + xe[e[11]] + xe[e[12]] + xe[e[13]] + xe[e[14]] + xe[e[15]];
}
Ni.nil = new zn("00000000-0000-0000-0000-000000000000");
var ho = {}, Bv = {};
(function(e) {
  (function(t) {
    t.parser = function(w, g) {
      return new n(w, g);
    }, t.SAXParser = n, t.SAXStream = c, t.createStream = u, t.MAX_BUFFER_LENGTH = 64 * 1024;
    var r = [
      "comment",
      "sgmlDecl",
      "textNode",
      "tagName",
      "doctype",
      "procInstName",
      "procInstBody",
      "entity",
      "attribName",
      "attribValue",
      "cdata",
      "script"
    ];
    t.EVENTS = [
      "text",
      "processinginstruction",
      "sgmldeclaration",
      "doctype",
      "comment",
      "opentagstart",
      "attribute",
      "opentag",
      "closetag",
      "opencdata",
      "cdata",
      "closecdata",
      "error",
      "end",
      "ready",
      "script",
      "opennamespace",
      "closenamespace"
    ];
    function n(w, g) {
      if (!(this instanceof n))
        return new n(w, g);
      var _ = this;
      a(_), _.q = _.c = "", _.bufferCheckPosition = t.MAX_BUFFER_LENGTH, _.opt = g || {}, _.opt.lowercase = _.opt.lowercase || _.opt.lowercasetags, _.looseCase = _.opt.lowercase ? "toLowerCase" : "toUpperCase", _.tags = [], _.closed = _.closedRoot = _.sawRoot = !1, _.tag = _.error = null, _.strict = !!w, _.noscript = !!(w || _.opt.noscript), _.state = b.BEGIN, _.strictEntities = _.opt.strictEntities, _.ENTITIES = _.strictEntities ? Object.create(t.XML_ENTITIES) : Object.create(t.ENTITIES), _.attribList = [], _.opt.xmlns && (_.ns = Object.create(v)), _.opt.unquotedAttributeValues === void 0 && (_.opt.unquotedAttributeValues = !w), _.trackPosition = _.opt.position !== !1, _.trackPosition && (_.position = _.line = _.column = 0), I(_, "onready");
    }
    Object.create || (Object.create = function(w) {
      function g() {
      }
      g.prototype = w;
      var _ = new g();
      return _;
    }), Object.keys || (Object.keys = function(w) {
      var g = [];
      for (var _ in w) w.hasOwnProperty(_) && g.push(_);
      return g;
    });
    function i(w) {
      for (var g = Math.max(t.MAX_BUFFER_LENGTH, 10), _ = 0, P = 0, Se = r.length; P < Se; P++) {
        var Ue = w[r[P]].length;
        if (Ue > g)
          switch (r[P]) {
            case "textNode":
              z(w);
              break;
            case "cdata":
              q(w, "oncdata", w.cdata), w.cdata = "";
              break;
            case "script":
              q(w, "onscript", w.script), w.script = "";
              break;
            default:
              N(w, "Max buffer length exceeded: " + r[P]);
          }
        _ = Math.max(_, Ue);
      }
      var qe = t.MAX_BUFFER_LENGTH - _;
      w.bufferCheckPosition = qe + w.position;
    }
    function a(w) {
      for (var g = 0, _ = r.length; g < _; g++)
        w[r[g]] = "";
    }
    function o(w) {
      z(w), w.cdata !== "" && (q(w, "oncdata", w.cdata), w.cdata = ""), w.script !== "" && (q(w, "onscript", w.script), w.script = "");
    }
    n.prototype = {
      end: function() {
        L(this);
      },
      write: mt,
      resume: function() {
        return this.error = null, this;
      },
      close: function() {
        return this.write(null);
      },
      flush: function() {
        o(this);
      }
    };
    var s;
    try {
      s = require("stream").Stream;
    } catch {
      s = function() {
      };
    }
    s || (s = function() {
    });
    var l = t.EVENTS.filter(function(w) {
      return w !== "error" && w !== "end";
    });
    function u(w, g) {
      return new c(w, g);
    }
    function c(w, g) {
      if (!(this instanceof c))
        return new c(w, g);
      s.apply(this), this._parser = new n(w, g), this.writable = !0, this.readable = !0;
      var _ = this;
      this._parser.onend = function() {
        _.emit("end");
      }, this._parser.onerror = function(P) {
        _.emit("error", P), _._parser.error = null;
      }, this._decoder = null, l.forEach(function(P) {
        Object.defineProperty(_, "on" + P, {
          get: function() {
            return _._parser["on" + P];
          },
          set: function(Se) {
            if (!Se)
              return _.removeAllListeners(P), _._parser["on" + P] = Se, Se;
            _.on(P, Se);
          },
          enumerable: !0,
          configurable: !1
        });
      });
    }
    c.prototype = Object.create(s.prototype, {
      constructor: {
        value: c
      }
    }), c.prototype.write = function(w) {
      return typeof Buffer == "function" && typeof Buffer.isBuffer == "function" && Buffer.isBuffer(w) && (this._decoder || (this._decoder = new TextDecoder("utf8")), w = this._decoder.decode(w, { stream: !0 })), this._parser.write(w.toString()), this.emit("data", w), !0;
    }, c.prototype.end = function(w) {
      if (w && w.length && this.write(w), this._decoder) {
        var g = this._decoder.decode();
        g && (this._parser.write(g), this.emit("data", g));
      }
      return this._parser.end(), !0;
    }, c.prototype.on = function(w, g) {
      var _ = this;
      return !_._parser["on" + w] && l.indexOf(w) !== -1 && (_._parser["on" + w] = function() {
        var P = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
        P.splice(0, 0, w), _.emit.apply(_, P);
      }), s.prototype.on.call(_, w, g);
    };
    var f = "[CDATA[", h = "DOCTYPE", d = "http://www.w3.org/XML/1998/namespace", p = "http://www.w3.org/2000/xmlns/", v = { xml: d, xmlns: p }, y = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/, m = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/, S = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/, T = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
    function C(w) {
      return w === " " || w === `
` || w === "\r" || w === "	";
    }
    function A(w) {
      return w === '"' || w === "'";
    }
    function O(w) {
      return w === ">" || C(w);
    }
    function k(w, g) {
      return w.test(g);
    }
    function M(w, g) {
      return !k(w, g);
    }
    var b = 0;
    t.STATE = {
      BEGIN: b++,
      // leading byte order mark or whitespace
      BEGIN_WHITESPACE: b++,
      // leading whitespace
      TEXT: b++,
      // general stuff
      TEXT_ENTITY: b++,
      // &amp and such.
      OPEN_WAKA: b++,
      // <
      SGML_DECL: b++,
      // <!BLARG
      SGML_DECL_QUOTED: b++,
      // <!BLARG foo "bar
      DOCTYPE: b++,
      // <!DOCTYPE
      DOCTYPE_QUOTED: b++,
      // <!DOCTYPE "//blah
      DOCTYPE_DTD: b++,
      // <!DOCTYPE "//blah" [ ...
      DOCTYPE_DTD_QUOTED: b++,
      // <!DOCTYPE "//blah" [ "foo
      COMMENT_STARTING: b++,
      // <!-
      COMMENT: b++,
      // <!--
      COMMENT_ENDING: b++,
      // <!-- blah -
      COMMENT_ENDED: b++,
      // <!-- blah --
      CDATA: b++,
      // <![CDATA[ something
      CDATA_ENDING: b++,
      // ]
      CDATA_ENDING_2: b++,
      // ]]
      PROC_INST: b++,
      // <?hi
      PROC_INST_BODY: b++,
      // <?hi there
      PROC_INST_ENDING: b++,
      // <?hi "there" ?
      OPEN_TAG: b++,
      // <strong
      OPEN_TAG_SLASH: b++,
      // <strong /
      ATTRIB: b++,
      // <a
      ATTRIB_NAME: b++,
      // <a foo
      ATTRIB_NAME_SAW_WHITE: b++,
      // <a foo _
      ATTRIB_VALUE: b++,
      // <a foo=
      ATTRIB_VALUE_QUOTED: b++,
      // <a foo="bar
      ATTRIB_VALUE_CLOSED: b++,
      // <a foo="bar"
      ATTRIB_VALUE_UNQUOTED: b++,
      // <a foo=bar
      ATTRIB_VALUE_ENTITY_Q: b++,
      // <foo bar="&quot;"
      ATTRIB_VALUE_ENTITY_U: b++,
      // <foo bar=&quot
      CLOSE_TAG: b++,
      // </a
      CLOSE_TAG_SAW_WHITE: b++,
      // </a   >
      SCRIPT: b++,
      // <script> ...
      SCRIPT_ENDING: b++
      // <script> ... <
    }, t.XML_ENTITIES = {
      amp: "&",
      gt: ">",
      lt: "<",
      quot: '"',
      apos: "'"
    }, t.ENTITIES = {
      amp: "&",
      gt: ">",
      lt: "<",
      quot: '"',
      apos: "'",
      AElig: 198,
      Aacute: 193,
      Acirc: 194,
      Agrave: 192,
      Aring: 197,
      Atilde: 195,
      Auml: 196,
      Ccedil: 199,
      ETH: 208,
      Eacute: 201,
      Ecirc: 202,
      Egrave: 200,
      Euml: 203,
      Iacute: 205,
      Icirc: 206,
      Igrave: 204,
      Iuml: 207,
      Ntilde: 209,
      Oacute: 211,
      Ocirc: 212,
      Ograve: 210,
      Oslash: 216,
      Otilde: 213,
      Ouml: 214,
      THORN: 222,
      Uacute: 218,
      Ucirc: 219,
      Ugrave: 217,
      Uuml: 220,
      Yacute: 221,
      aacute: 225,
      acirc: 226,
      aelig: 230,
      agrave: 224,
      aring: 229,
      atilde: 227,
      auml: 228,
      ccedil: 231,
      eacute: 233,
      ecirc: 234,
      egrave: 232,
      eth: 240,
      euml: 235,
      iacute: 237,
      icirc: 238,
      igrave: 236,
      iuml: 239,
      ntilde: 241,
      oacute: 243,
      ocirc: 244,
      ograve: 242,
      oslash: 248,
      otilde: 245,
      ouml: 246,
      szlig: 223,
      thorn: 254,
      uacute: 250,
      ucirc: 251,
      ugrave: 249,
      uuml: 252,
      yacute: 253,
      yuml: 255,
      copy: 169,
      reg: 174,
      nbsp: 160,
      iexcl: 161,
      cent: 162,
      pound: 163,
      curren: 164,
      yen: 165,
      brvbar: 166,
      sect: 167,
      uml: 168,
      ordf: 170,
      laquo: 171,
      not: 172,
      shy: 173,
      macr: 175,
      deg: 176,
      plusmn: 177,
      sup1: 185,
      sup2: 178,
      sup3: 179,
      acute: 180,
      micro: 181,
      para: 182,
      middot: 183,
      cedil: 184,
      ordm: 186,
      raquo: 187,
      frac14: 188,
      frac12: 189,
      frac34: 190,
      iquest: 191,
      times: 215,
      divide: 247,
      OElig: 338,
      oelig: 339,
      Scaron: 352,
      scaron: 353,
      Yuml: 376,
      fnof: 402,
      circ: 710,
      tilde: 732,
      Alpha: 913,
      Beta: 914,
      Gamma: 915,
      Delta: 916,
      Epsilon: 917,
      Zeta: 918,
      Eta: 919,
      Theta: 920,
      Iota: 921,
      Kappa: 922,
      Lambda: 923,
      Mu: 924,
      Nu: 925,
      Xi: 926,
      Omicron: 927,
      Pi: 928,
      Rho: 929,
      Sigma: 931,
      Tau: 932,
      Upsilon: 933,
      Phi: 934,
      Chi: 935,
      Psi: 936,
      Omega: 937,
      alpha: 945,
      beta: 946,
      gamma: 947,
      delta: 948,
      epsilon: 949,
      zeta: 950,
      eta: 951,
      theta: 952,
      iota: 953,
      kappa: 954,
      lambda: 955,
      mu: 956,
      nu: 957,
      xi: 958,
      omicron: 959,
      pi: 960,
      rho: 961,
      sigmaf: 962,
      sigma: 963,
      tau: 964,
      upsilon: 965,
      phi: 966,
      chi: 967,
      psi: 968,
      omega: 969,
      thetasym: 977,
      upsih: 978,
      piv: 982,
      ensp: 8194,
      emsp: 8195,
      thinsp: 8201,
      zwnj: 8204,
      zwj: 8205,
      lrm: 8206,
      rlm: 8207,
      ndash: 8211,
      mdash: 8212,
      lsquo: 8216,
      rsquo: 8217,
      sbquo: 8218,
      ldquo: 8220,
      rdquo: 8221,
      bdquo: 8222,
      dagger: 8224,
      Dagger: 8225,
      bull: 8226,
      hellip: 8230,
      permil: 8240,
      prime: 8242,
      Prime: 8243,
      lsaquo: 8249,
      rsaquo: 8250,
      oline: 8254,
      frasl: 8260,
      euro: 8364,
      image: 8465,
      weierp: 8472,
      real: 8476,
      trade: 8482,
      alefsym: 8501,
      larr: 8592,
      uarr: 8593,
      rarr: 8594,
      darr: 8595,
      harr: 8596,
      crarr: 8629,
      lArr: 8656,
      uArr: 8657,
      rArr: 8658,
      dArr: 8659,
      hArr: 8660,
      forall: 8704,
      part: 8706,
      exist: 8707,
      empty: 8709,
      nabla: 8711,
      isin: 8712,
      notin: 8713,
      ni: 8715,
      prod: 8719,
      sum: 8721,
      minus: 8722,
      lowast: 8727,
      radic: 8730,
      prop: 8733,
      infin: 8734,
      ang: 8736,
      and: 8743,
      or: 8744,
      cap: 8745,
      cup: 8746,
      int: 8747,
      there4: 8756,
      sim: 8764,
      cong: 8773,
      asymp: 8776,
      ne: 8800,
      equiv: 8801,
      le: 8804,
      ge: 8805,
      sub: 8834,
      sup: 8835,
      nsub: 8836,
      sube: 8838,
      supe: 8839,
      oplus: 8853,
      otimes: 8855,
      perp: 8869,
      sdot: 8901,
      lceil: 8968,
      rceil: 8969,
      lfloor: 8970,
      rfloor: 8971,
      lang: 9001,
      rang: 9002,
      loz: 9674,
      spades: 9824,
      clubs: 9827,
      hearts: 9829,
      diams: 9830
    }, Object.keys(t.ENTITIES).forEach(function(w) {
      var g = t.ENTITIES[w], _ = typeof g == "number" ? String.fromCharCode(g) : g;
      t.ENTITIES[w] = _;
    });
    for (var j in t.STATE)
      t.STATE[t.STATE[j]] = j;
    b = t.STATE;
    function I(w, g, _) {
      w[g] && w[g](_);
    }
    function q(w, g, _) {
      w.textNode && z(w), I(w, g, _);
    }
    function z(w) {
      w.textNode = B(w.opt, w.textNode), w.textNode && I(w, "ontext", w.textNode), w.textNode = "";
    }
    function B(w, g) {
      return w.trim && (g = g.trim()), w.normalize && (g = g.replace(/\s+/g, " ")), g;
    }
    function N(w, g) {
      return z(w), w.trackPosition && (g += `
Line: ` + w.line + `
Column: ` + w.column + `
Char: ` + w.c), g = new Error(g), w.error = g, I(w, "onerror", g), w;
    }
    function L(w) {
      return w.sawRoot && !w.closedRoot && U(w, "Unclosed root tag"), w.state !== b.BEGIN && w.state !== b.BEGIN_WHITESPACE && w.state !== b.TEXT && N(w, "Unexpected end"), z(w), w.c = "", w.closed = !0, I(w, "onend"), n.call(w, w.strict, w.opt), w;
    }
    function U(w, g) {
      if (typeof w != "object" || !(w instanceof n))
        throw new Error("bad call to strictFail");
      w.strict && N(w, g);
    }
    function X(w) {
      w.strict || (w.tagName = w.tagName[w.looseCase]());
      var g = w.tags[w.tags.length - 1] || w, _ = w.tag = { name: w.tagName, attributes: {} };
      w.opt.xmlns && (_.ns = g.ns), w.attribList.length = 0, q(w, "onopentagstart", _);
    }
    function W(w, g) {
      var _ = w.indexOf(":"), P = _ < 0 ? ["", w] : w.split(":"), Se = P[0], Ue = P[1];
      return g && w === "xmlns" && (Se = "xmlns", Ue = ""), { prefix: Se, local: Ue };
    }
    function Q(w) {
      if (w.strict || (w.attribName = w.attribName[w.looseCase]()), w.attribList.indexOf(w.attribName) !== -1 || w.tag.attributes.hasOwnProperty(w.attribName)) {
        w.attribName = w.attribValue = "";
        return;
      }
      if (w.opt.xmlns) {
        var g = W(w.attribName, !0), _ = g.prefix, P = g.local;
        if (_ === "xmlns")
          if (P === "xml" && w.attribValue !== d)
            U(
              w,
              "xml: prefix must be bound to " + d + `
Actual: ` + w.attribValue
            );
          else if (P === "xmlns" && w.attribValue !== p)
            U(
              w,
              "xmlns: prefix must be bound to " + p + `
Actual: ` + w.attribValue
            );
          else {
            var Se = w.tag, Ue = w.tags[w.tags.length - 1] || w;
            Se.ns === Ue.ns && (Se.ns = Object.create(Ue.ns)), Se.ns[P] = w.attribValue;
          }
        w.attribList.push([w.attribName, w.attribValue]);
      } else
        w.tag.attributes[w.attribName] = w.attribValue, q(w, "onattribute", {
          name: w.attribName,
          value: w.attribValue
        });
      w.attribName = w.attribValue = "";
    }
    function re(w, g) {
      if (w.opt.xmlns) {
        var _ = w.tag, P = W(w.tagName);
        _.prefix = P.prefix, _.local = P.local, _.uri = _.ns[P.prefix] || "", _.prefix && !_.uri && (U(
          w,
          "Unbound namespace prefix: " + JSON.stringify(w.tagName)
        ), _.uri = P.prefix);
        var Se = w.tags[w.tags.length - 1] || w;
        _.ns && Se.ns !== _.ns && Object.keys(_.ns).forEach(function(No) {
          q(w, "onopennamespace", {
            prefix: No,
            uri: _.ns[No]
          });
        });
        for (var Ue = 0, qe = w.attribList.length; Ue < qe; Ue++) {
          var at = w.attribList[Ue], ht = at[0], jr = at[1], Xe = W(ht, !0), er = Xe.prefix, tu = Xe.local, ko = er === "" ? "" : _.ns[er] || "", Zi = {
            name: ht,
            value: jr,
            prefix: er,
            local: tu,
            uri: ko
          };
          er && er !== "xmlns" && !ko && (U(
            w,
            "Unbound namespace prefix: " + JSON.stringify(er)
          ), Zi.uri = er), w.tag.attributes[ht] = Zi, q(w, "onattribute", Zi);
        }
        w.attribList.length = 0;
      }
      w.tag.isSelfClosing = !!g, w.sawRoot = !0, w.tags.push(w.tag), q(w, "onopentag", w.tag), g || (!w.noscript && w.tagName.toLowerCase() === "script" ? w.state = b.SCRIPT : w.state = b.TEXT, w.tag = null, w.tagName = ""), w.attribName = w.attribValue = "", w.attribList.length = 0;
    }
    function ee(w) {
      if (!w.tagName) {
        U(w, "Weird empty close tag."), w.textNode += "</>", w.state = b.TEXT;
        return;
      }
      if (w.script) {
        if (w.tagName !== "script") {
          w.script += "</" + w.tagName + ">", w.tagName = "", w.state = b.SCRIPT;
          return;
        }
        q(w, "onscript", w.script), w.script = "";
      }
      var g = w.tags.length, _ = w.tagName;
      w.strict || (_ = _[w.looseCase]());
      for (var P = _; g--; ) {
        var Se = w.tags[g];
        if (Se.name !== P)
          U(w, "Unexpected close tag");
        else
          break;
      }
      if (g < 0) {
        U(w, "Unmatched closing tag: " + w.tagName), w.textNode += "</" + w.tagName + ">", w.state = b.TEXT;
        return;
      }
      w.tagName = _;
      for (var Ue = w.tags.length; Ue-- > g; ) {
        var qe = w.tag = w.tags.pop();
        w.tagName = w.tag.name, q(w, "onclosetag", w.tagName);
        var at = {};
        for (var ht in qe.ns)
          at[ht] = qe.ns[ht];
        var jr = w.tags[w.tags.length - 1] || w;
        w.opt.xmlns && qe.ns !== jr.ns && Object.keys(qe.ns).forEach(function(Xe) {
          var er = qe.ns[Xe];
          q(w, "onclosenamespace", { prefix: Xe, uri: er });
        });
      }
      g === 0 && (w.closedRoot = !0), w.tagName = w.attribValue = w.attribName = "", w.attribList.length = 0, w.state = b.TEXT;
    }
    function Te(w) {
      var g = w.entity, _ = g.toLowerCase(), P, Se = "";
      return w.ENTITIES[g] ? w.ENTITIES[g] : w.ENTITIES[_] ? w.ENTITIES[_] : (g = _, g.charAt(0) === "#" && (g.charAt(1) === "x" ? (g = g.slice(2), P = parseInt(g, 16), Se = P.toString(16)) : (g = g.slice(1), P = parseInt(g, 10), Se = P.toString(10))), g = g.replace(/^0+/, ""), isNaN(P) || Se.toLowerCase() !== g || P < 0 || P > 1114111 ? (U(w, "Invalid character entity"), "&" + w.entity + ";") : String.fromCodePoint(P));
    }
    function De(w, g) {
      g === "<" ? (w.state = b.OPEN_WAKA, w.startTagPosition = w.position) : C(g) || (U(w, "Non-whitespace before first tag."), w.textNode = g, w.state = b.TEXT);
    }
    function te(w, g) {
      var _ = "";
      return g < w.length && (_ = w.charAt(g)), _;
    }
    function mt(w) {
      var g = this;
      if (this.error)
        throw this.error;
      if (g.closed)
        return N(
          g,
          "Cannot write after close. Assign an onready handler."
        );
      if (w === null)
        return L(g);
      typeof w == "object" && (w = w.toString());
      for (var _ = 0, P = ""; P = te(w, _++), g.c = P, !!P; )
        switch (g.trackPosition && (g.position++, P === `
` ? (g.line++, g.column = 0) : g.column++), g.state) {
          case b.BEGIN:
            if (g.state = b.BEGIN_WHITESPACE, P === "\uFEFF")
              continue;
            De(g, P);
            continue;
          case b.BEGIN_WHITESPACE:
            De(g, P);
            continue;
          case b.TEXT:
            if (g.sawRoot && !g.closedRoot) {
              for (var Ue = _ - 1; P && P !== "<" && P !== "&"; )
                P = te(w, _++), P && g.trackPosition && (g.position++, P === `
` ? (g.line++, g.column = 0) : g.column++);
              g.textNode += w.substring(Ue, _ - 1);
            }
            P === "<" && !(g.sawRoot && g.closedRoot && !g.strict) ? (g.state = b.OPEN_WAKA, g.startTagPosition = g.position) : (!C(P) && (!g.sawRoot || g.closedRoot) && U(g, "Text data outside of root node."), P === "&" ? g.state = b.TEXT_ENTITY : g.textNode += P);
            continue;
          case b.SCRIPT:
            P === "<" ? g.state = b.SCRIPT_ENDING : g.script += P;
            continue;
          case b.SCRIPT_ENDING:
            P === "/" ? g.state = b.CLOSE_TAG : (g.script += "<" + P, g.state = b.SCRIPT);
            continue;
          case b.OPEN_WAKA:
            if (P === "!")
              g.state = b.SGML_DECL, g.sgmlDecl = "";
            else if (!C(P)) if (k(y, P))
              g.state = b.OPEN_TAG, g.tagName = P;
            else if (P === "/")
              g.state = b.CLOSE_TAG, g.tagName = "";
            else if (P === "?")
              g.state = b.PROC_INST, g.procInstName = g.procInstBody = "";
            else {
              if (U(g, "Unencoded <"), g.startTagPosition + 1 < g.position) {
                var Se = g.position - g.startTagPosition;
                P = new Array(Se).join(" ") + P;
              }
              g.textNode += "<" + P, g.state = b.TEXT;
            }
            continue;
          case b.SGML_DECL:
            if (g.sgmlDecl + P === "--") {
              g.state = b.COMMENT, g.comment = "", g.sgmlDecl = "";
              continue;
            }
            g.doctype && g.doctype !== !0 && g.sgmlDecl ? (g.state = b.DOCTYPE_DTD, g.doctype += "<!" + g.sgmlDecl + P, g.sgmlDecl = "") : (g.sgmlDecl + P).toUpperCase() === f ? (q(g, "onopencdata"), g.state = b.CDATA, g.sgmlDecl = "", g.cdata = "") : (g.sgmlDecl + P).toUpperCase() === h ? (g.state = b.DOCTYPE, (g.doctype || g.sawRoot) && U(
              g,
              "Inappropriately located doctype declaration"
            ), g.doctype = "", g.sgmlDecl = "") : P === ">" ? (q(g, "onsgmldeclaration", g.sgmlDecl), g.sgmlDecl = "", g.state = b.TEXT) : (A(P) && (g.state = b.SGML_DECL_QUOTED), g.sgmlDecl += P);
            continue;
          case b.SGML_DECL_QUOTED:
            P === g.q && (g.state = b.SGML_DECL, g.q = ""), g.sgmlDecl += P;
            continue;
          case b.DOCTYPE:
            P === ">" ? (g.state = b.TEXT, q(g, "ondoctype", g.doctype), g.doctype = !0) : (g.doctype += P, P === "[" ? g.state = b.DOCTYPE_DTD : A(P) && (g.state = b.DOCTYPE_QUOTED, g.q = P));
            continue;
          case b.DOCTYPE_QUOTED:
            g.doctype += P, P === g.q && (g.q = "", g.state = b.DOCTYPE);
            continue;
          case b.DOCTYPE_DTD:
            P === "]" ? (g.doctype += P, g.state = b.DOCTYPE) : P === "<" ? (g.state = b.OPEN_WAKA, g.startTagPosition = g.position) : A(P) ? (g.doctype += P, g.state = b.DOCTYPE_DTD_QUOTED, g.q = P) : g.doctype += P;
            continue;
          case b.DOCTYPE_DTD_QUOTED:
            g.doctype += P, P === g.q && (g.state = b.DOCTYPE_DTD, g.q = "");
            continue;
          case b.COMMENT:
            P === "-" ? g.state = b.COMMENT_ENDING : g.comment += P;
            continue;
          case b.COMMENT_ENDING:
            P === "-" ? (g.state = b.COMMENT_ENDED, g.comment = B(g.opt, g.comment), g.comment && q(g, "oncomment", g.comment), g.comment = "") : (g.comment += "-" + P, g.state = b.COMMENT);
            continue;
          case b.COMMENT_ENDED:
            P !== ">" ? (U(g, "Malformed comment"), g.comment += "--" + P, g.state = b.COMMENT) : g.doctype && g.doctype !== !0 ? g.state = b.DOCTYPE_DTD : g.state = b.TEXT;
            continue;
          case b.CDATA:
            for (var Ue = _ - 1; P && P !== "]"; )
              P = te(w, _++), P && g.trackPosition && (g.position++, P === `
` ? (g.line++, g.column = 0) : g.column++);
            g.cdata += w.substring(Ue, _ - 1), P === "]" && (g.state = b.CDATA_ENDING);
            continue;
          case b.CDATA_ENDING:
            P === "]" ? g.state = b.CDATA_ENDING_2 : (g.cdata += "]" + P, g.state = b.CDATA);
            continue;
          case b.CDATA_ENDING_2:
            P === ">" ? (g.cdata && q(g, "oncdata", g.cdata), q(g, "onclosecdata"), g.cdata = "", g.state = b.TEXT) : P === "]" ? g.cdata += "]" : (g.cdata += "]]" + P, g.state = b.CDATA);
            continue;
          case b.PROC_INST:
            P === "?" ? g.state = b.PROC_INST_ENDING : C(P) ? g.state = b.PROC_INST_BODY : g.procInstName += P;
            continue;
          case b.PROC_INST_BODY:
            if (!g.procInstBody && C(P))
              continue;
            P === "?" ? g.state = b.PROC_INST_ENDING : g.procInstBody += P;
            continue;
          case b.PROC_INST_ENDING:
            P === ">" ? (q(g, "onprocessinginstruction", {
              name: g.procInstName,
              body: g.procInstBody
            }), g.procInstName = g.procInstBody = "", g.state = b.TEXT) : (g.procInstBody += "?" + P, g.state = b.PROC_INST_BODY);
            continue;
          case b.OPEN_TAG:
            k(m, P) ? g.tagName += P : (X(g), P === ">" ? re(g) : P === "/" ? g.state = b.OPEN_TAG_SLASH : (C(P) || U(g, "Invalid character in tag name"), g.state = b.ATTRIB));
            continue;
          case b.OPEN_TAG_SLASH:
            P === ">" ? (re(g, !0), ee(g)) : (U(
              g,
              "Forward-slash in opening tag not followed by >"
            ), g.state = b.ATTRIB);
            continue;
          case b.ATTRIB:
            if (C(P))
              continue;
            P === ">" ? re(g) : P === "/" ? g.state = b.OPEN_TAG_SLASH : k(y, P) ? (g.attribName = P, g.attribValue = "", g.state = b.ATTRIB_NAME) : U(g, "Invalid attribute name");
            continue;
          case b.ATTRIB_NAME:
            P === "=" ? g.state = b.ATTRIB_VALUE : P === ">" ? (U(g, "Attribute without value"), g.attribValue = g.attribName, Q(g), re(g)) : C(P) ? g.state = b.ATTRIB_NAME_SAW_WHITE : k(m, P) ? g.attribName += P : U(g, "Invalid attribute name");
            continue;
          case b.ATTRIB_NAME_SAW_WHITE:
            if (P === "=")
              g.state = b.ATTRIB_VALUE;
            else {
              if (C(P))
                continue;
              U(g, "Attribute without value"), g.tag.attributes[g.attribName] = "", g.attribValue = "", q(g, "onattribute", {
                name: g.attribName,
                value: ""
              }), g.attribName = "", P === ">" ? re(g) : k(y, P) ? (g.attribName = P, g.state = b.ATTRIB_NAME) : (U(g, "Invalid attribute name"), g.state = b.ATTRIB);
            }
            continue;
          case b.ATTRIB_VALUE:
            if (C(P))
              continue;
            A(P) ? (g.q = P, g.state = b.ATTRIB_VALUE_QUOTED) : (g.opt.unquotedAttributeValues || N(g, "Unquoted attribute value"), g.state = b.ATTRIB_VALUE_UNQUOTED, g.attribValue = P);
            continue;
          case b.ATTRIB_VALUE_QUOTED:
            if (P !== g.q) {
              P === "&" ? g.state = b.ATTRIB_VALUE_ENTITY_Q : g.attribValue += P;
              continue;
            }
            Q(g), g.q = "", g.state = b.ATTRIB_VALUE_CLOSED;
            continue;
          case b.ATTRIB_VALUE_CLOSED:
            C(P) ? g.state = b.ATTRIB : P === ">" ? re(g) : P === "/" ? g.state = b.OPEN_TAG_SLASH : k(y, P) ? (U(g, "No whitespace between attributes"), g.attribName = P, g.attribValue = "", g.state = b.ATTRIB_NAME) : U(g, "Invalid attribute name");
            continue;
          case b.ATTRIB_VALUE_UNQUOTED:
            if (!O(P)) {
              P === "&" ? g.state = b.ATTRIB_VALUE_ENTITY_U : g.attribValue += P;
              continue;
            }
            Q(g), P === ">" ? re(g) : g.state = b.ATTRIB;
            continue;
          case b.CLOSE_TAG:
            if (g.tagName)
              P === ">" ? ee(g) : k(m, P) ? g.tagName += P : g.script ? (g.script += "</" + g.tagName + P, g.tagName = "", g.state = b.SCRIPT) : (C(P) || U(g, "Invalid tagname in closing tag"), g.state = b.CLOSE_TAG_SAW_WHITE);
            else {
              if (C(P))
                continue;
              M(y, P) ? g.script ? (g.script += "</" + P, g.state = b.SCRIPT) : U(g, "Invalid tagname in closing tag.") : g.tagName = P;
            }
            continue;
          case b.CLOSE_TAG_SAW_WHITE:
            if (C(P))
              continue;
            P === ">" ? ee(g) : U(g, "Invalid characters in closing tag");
            continue;
          case b.TEXT_ENTITY:
          case b.ATTRIB_VALUE_ENTITY_Q:
          case b.ATTRIB_VALUE_ENTITY_U:
            var qe, at;
            switch (g.state) {
              case b.TEXT_ENTITY:
                qe = b.TEXT, at = "textNode";
                break;
              case b.ATTRIB_VALUE_ENTITY_Q:
                qe = b.ATTRIB_VALUE_QUOTED, at = "attribValue";
                break;
              case b.ATTRIB_VALUE_ENTITY_U:
                qe = b.ATTRIB_VALUE_UNQUOTED, at = "attribValue";
                break;
            }
            if (P === ";") {
              var ht = Te(g);
              g.opt.unparsedEntities && !Object.values(t.XML_ENTITIES).includes(ht) ? (g.entity = "", g.state = qe, g.write(ht)) : (g[at] += ht, g.entity = "", g.state = qe);
            } else k(g.entity.length ? T : S, P) ? g.entity += P : (U(g, "Invalid character in entity name"), g[at] += "&" + g.entity + P, g.entity = "", g.state = qe);
            continue;
          default:
            throw new Error(g, "Unknown state: " + g.state);
        }
      return g.position >= g.bufferCheckPosition && i(g), g;
    }
    /*! http://mths.be/fromcodepoint v0.1.0 by @mathias */
    String.fromCodePoint || function() {
      var w = String.fromCharCode, g = Math.floor, _ = function() {
        var P = 16384, Se = [], Ue, qe, at = -1, ht = arguments.length;
        if (!ht)
          return "";
        for (var jr = ""; ++at < ht; ) {
          var Xe = Number(arguments[at]);
          if (!isFinite(Xe) || // `NaN`, `+Infinity`, or `-Infinity`
          Xe < 0 || // not a valid Unicode code point
          Xe > 1114111 || // not a valid Unicode code point
          g(Xe) !== Xe)
            throw RangeError("Invalid code point: " + Xe);
          Xe <= 65535 ? Se.push(Xe) : (Xe -= 65536, Ue = (Xe >> 10) + 55296, qe = Xe % 1024 + 56320, Se.push(Ue, qe)), (at + 1 === ht || Se.length > P) && (jr += w.apply(null, Se), Se.length = 0);
        }
        return jr;
      };
      Object.defineProperty ? Object.defineProperty(String, "fromCodePoint", {
        value: _,
        configurable: !0,
        writable: !0
      }) : String.fromCodePoint = _;
    }();
  })(e);
})(Bv);
Object.defineProperty(ho, "__esModule", { value: !0 });
ho.XElement = void 0;
ho.parseXml = fE;
const lE = Bv, Ko = ji;
class Mv {
  constructor(t) {
    if (this.name = t, this.value = "", this.attributes = null, this.isCData = !1, this.elements = null, !t)
      throw (0, Ko.newError)("Element name cannot be empty", "ERR_XML_ELEMENT_NAME_EMPTY");
    if (!cE(t))
      throw (0, Ko.newError)(`Invalid element name: ${t}`, "ERR_XML_ELEMENT_INVALID_NAME");
  }
  attribute(t) {
    const r = this.attributes === null ? null : this.attributes[t];
    if (r == null)
      throw (0, Ko.newError)(`No attribute "${t}"`, "ERR_XML_MISSED_ATTRIBUTE");
    return r;
  }
  removeAttribute(t) {
    this.attributes !== null && delete this.attributes[t];
  }
  element(t, r = !1, n = null) {
    const i = this.elementOrNull(t, r);
    if (i === null)
      throw (0, Ko.newError)(n || `No element "${t}"`, "ERR_XML_MISSED_ELEMENT");
    return i;
  }
  elementOrNull(t, r = !1) {
    if (this.elements === null)
      return null;
    for (const n of this.elements)
      if (Jh(n, t, r))
        return n;
    return null;
  }
  getElements(t, r = !1) {
    return this.elements === null ? [] : this.elements.filter((n) => Jh(n, t, r));
  }
  elementValueOrEmpty(t, r = !1) {
    const n = this.elementOrNull(t, r);
    return n === null ? "" : n.value;
  }
}
ho.XElement = Mv;
const uE = new RegExp(/^[A-Za-z_][:A-Za-z0-9_-]*$/i);
function cE(e) {
  return uE.test(e);
}
function Jh(e, t, r) {
  const n = e.name;
  return n === t || r === !0 && n.length === t.length && n.toLowerCase() === t.toLowerCase();
}
function fE(e) {
  let t = null;
  const r = lE.parser(!0, {}), n = [];
  return r.onopentag = (i) => {
    const a = new Mv(i.name);
    if (a.attributes = i.attributes, t === null)
      t = a;
    else {
      const o = n[n.length - 1];
      o.elements == null && (o.elements = []), o.elements.push(a);
    }
    n.push(a);
  }, r.onclosetag = () => {
    n.pop();
  }, r.ontext = (i) => {
    n.length > 0 && (n[n.length - 1].value = i);
  }, r.oncdata = (i) => {
    const a = n[n.length - 1];
    a.value = i, a.isCData = !0;
  }, r.onerror = (i) => {
    throw i;
  }, r.write(e), t;
}
(function(e) {
  Object.defineProperty(e, "__esModule", { value: !0 }), e.CURRENT_APP_PACKAGE_FILE_NAME = e.CURRENT_APP_INSTALLER_FILE_NAME = e.XElement = e.parseXml = e.UUID = e.parseDn = e.retry = e.githubTagPrefix = e.githubUrl = e.getS3LikeProviderBaseUrl = e.ProgressCallbackTransform = e.MemoLazy = e.safeStringifyJson = e.safeGetHeader = e.parseJson = e.HttpExecutor = e.HttpError = e.DigestTransform = e.createHttpError = e.configureRequestUrl = e.configureRequestOptionsFromUrl = e.configureRequestOptions = e.newError = e.CancellationToken = e.CancellationError = void 0, e.asArray = f;
  var t = cn;
  Object.defineProperty(e, "CancellationError", { enumerable: !0, get: function() {
    return t.CancellationError;
  } }), Object.defineProperty(e, "CancellationToken", { enumerable: !0, get: function() {
    return t.CancellationToken;
  } });
  var r = ji;
  Object.defineProperty(e, "newError", { enumerable: !0, get: function() {
    return r.newError;
  } });
  var n = Et;
  Object.defineProperty(e, "configureRequestOptions", { enumerable: !0, get: function() {
    return n.configureRequestOptions;
  } }), Object.defineProperty(e, "configureRequestOptionsFromUrl", { enumerable: !0, get: function() {
    return n.configureRequestOptionsFromUrl;
  } }), Object.defineProperty(e, "configureRequestUrl", { enumerable: !0, get: function() {
    return n.configureRequestUrl;
  } }), Object.defineProperty(e, "createHttpError", { enumerable: !0, get: function() {
    return n.createHttpError;
  } }), Object.defineProperty(e, "DigestTransform", { enumerable: !0, get: function() {
    return n.DigestTransform;
  } }), Object.defineProperty(e, "HttpError", { enumerable: !0, get: function() {
    return n.HttpError;
  } }), Object.defineProperty(e, "HttpExecutor", { enumerable: !0, get: function() {
    return n.HttpExecutor;
  } }), Object.defineProperty(e, "parseJson", { enumerable: !0, get: function() {
    return n.parseJson;
  } }), Object.defineProperty(e, "safeGetHeader", { enumerable: !0, get: function() {
    return n.safeGetHeader;
  } }), Object.defineProperty(e, "safeStringifyJson", { enumerable: !0, get: function() {
    return n.safeStringifyJson;
  } });
  var i = gl;
  Object.defineProperty(e, "MemoLazy", { enumerable: !0, get: function() {
    return i.MemoLazy;
  } });
  var a = co;
  Object.defineProperty(e, "ProgressCallbackTransform", { enumerable: !0, get: function() {
    return a.ProgressCallbackTransform;
  } });
  var o = fo;
  Object.defineProperty(e, "getS3LikeProviderBaseUrl", { enumerable: !0, get: function() {
    return o.getS3LikeProviderBaseUrl;
  } }), Object.defineProperty(e, "githubUrl", { enumerable: !0, get: function() {
    return o.githubUrl;
  } }), Object.defineProperty(e, "githubTagPrefix", { enumerable: !0, get: function() {
    return o.githubTagPrefix;
  } });
  var s = nf;
  Object.defineProperty(e, "retry", { enumerable: !0, get: function() {
    return s.retry;
  } });
  var l = af;
  Object.defineProperty(e, "parseDn", { enumerable: !0, get: function() {
    return l.parseDn;
  } });
  var u = Ni;
  Object.defineProperty(e, "UUID", { enumerable: !0, get: function() {
    return u.UUID;
  } });
  var c = ho;
  Object.defineProperty(e, "parseXml", { enumerable: !0, get: function() {
    return c.parseXml;
  } }), Object.defineProperty(e, "XElement", { enumerable: !0, get: function() {
    return c.XElement;
  } }), e.CURRENT_APP_INSTALLER_FILE_NAME = "installer.exe", e.CURRENT_APP_PACKAGE_FILE_NAME = "package.7z";
  function f(h) {
    return h == null ? [] : Array.isArray(h) ? h : [h];
  }
})(et);
var ft = {}, of = {}, cr = {};
function jv(e) {
  return typeof e > "u" || e === null;
}
function hE(e) {
  return typeof e == "object" && e !== null;
}
function dE(e) {
  return Array.isArray(e) ? e : jv(e) ? [] : [e];
}
function pE(e, t) {
  var r, n, i, a;
  if (t)
    for (a = Object.keys(t), r = 0, n = a.length; r < n; r += 1)
      i = a[r], e[i] = t[i];
  return e;
}
function vE(e, t) {
  var r = "", n;
  for (n = 0; n < t; n += 1)
    r += e;
  return r;
}
function gE(e) {
  return e === 0 && Number.NEGATIVE_INFINITY === 1 / e;
}
cr.isNothing = jv;
cr.isObject = hE;
cr.toArray = dE;
cr.repeat = vE;
cr.isNegativeZero = gE;
cr.extend = pE;
function _v(e, t) {
  var r = "", n = e.reason || "(unknown reason)";
  return e.mark ? (e.mark.name && (r += 'in "' + e.mark.name + '" '), r += "(" + (e.mark.line + 1) + ":" + (e.mark.column + 1) + ")", !t && e.mark.snippet && (r += `

` + e.mark.snippet), n + " " + r) : n;
}
function za(e, t) {
  Error.call(this), this.name = "YAMLException", this.reason = e, this.mark = t, this.message = _v(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
}
za.prototype = Object.create(Error.prototype);
za.prototype.constructor = za;
za.prototype.toString = function(t) {
  return this.name + ": " + _v(this, t);
};
var po = za, da = cr;
function mu(e, t, r, n, i) {
  var a = "", o = "", s = Math.floor(i / 2) - 1;
  return n - t > s && (a = " ... ", t = n - s + a.length), r - n > s && (o = " ...", r = n + s - o.length), {
    str: a + e.slice(t, r).replace(/\t/g, "→") + o,
    pos: n - t + a.length
    // relative position
  };
}
function yu(e, t) {
  return da.repeat(" ", t - e.length) + e;
}
function mE(e, t) {
  if (t = Object.create(t || null), !e.buffer) return null;
  t.maxLength || (t.maxLength = 79), typeof t.indent != "number" && (t.indent = 1), typeof t.linesBefore != "number" && (t.linesBefore = 3), typeof t.linesAfter != "number" && (t.linesAfter = 2);
  for (var r = /\r?\n|\r|\0/g, n = [0], i = [], a, o = -1; a = r.exec(e.buffer); )
    i.push(a.index), n.push(a.index + a[0].length), e.position <= a.index && o < 0 && (o = n.length - 2);
  o < 0 && (o = n.length - 1);
  var s = "", l, u, c = Math.min(e.line + t.linesAfter, i.length).toString().length, f = t.maxLength - (t.indent + c + 3);
  for (l = 1; l <= t.linesBefore && !(o - l < 0); l++)
    u = mu(
      e.buffer,
      n[o - l],
      i[o - l],
      e.position - (n[o] - n[o - l]),
      f
    ), s = da.repeat(" ", t.indent) + yu((e.line - l + 1).toString(), c) + " | " + u.str + `
` + s;
  for (u = mu(e.buffer, n[o], i[o], e.position, f), s += da.repeat(" ", t.indent) + yu((e.line + 1).toString(), c) + " | " + u.str + `
`, s += da.repeat("-", t.indent + c + 3 + u.pos) + `^
`, l = 1; l <= t.linesAfter && !(o + l >= i.length); l++)
    u = mu(
      e.buffer,
      n[o + l],
      i[o + l],
      e.position - (n[o] - n[o + l]),
      f
    ), s += da.repeat(" ", t.indent) + yu((e.line + l + 1).toString(), c) + " | " + u.str + `
`;
  return s.replace(/\n$/, "");
}
var yE = mE, Qh = po, bE = [
  "kind",
  "multi",
  "resolve",
  "construct",
  "instanceOf",
  "predicate",
  "represent",
  "representName",
  "defaultStyle",
  "styleAliases"
], wE = [
  "scalar",
  "sequence",
  "mapping"
];
function xE(e) {
  var t = {};
  return e !== null && Object.keys(e).forEach(function(r) {
    e[r].forEach(function(n) {
      t[String(n)] = r;
    });
  }), t;
}
function EE(e, t) {
  if (t = t || {}, Object.keys(t).forEach(function(r) {
    if (bE.indexOf(r) === -1)
      throw new Qh('Unknown option "' + r + '" is met in definition of "' + e + '" YAML type.');
  }), this.options = t, this.tag = e, this.kind = t.kind || null, this.resolve = t.resolve || function() {
    return !0;
  }, this.construct = t.construct || function(r) {
    return r;
  }, this.instanceOf = t.instanceOf || null, this.predicate = t.predicate || null, this.represent = t.represent || null, this.representName = t.representName || null, this.defaultStyle = t.defaultStyle || null, this.multi = t.multi || !1, this.styleAliases = xE(t.styleAliases || null), wE.indexOf(this.kind) === -1)
    throw new Qh('Unknown kind "' + this.kind + '" is specified for "' + e + '" YAML type.');
}
var Pt = EE, ta = po, bu = Pt;
function $h(e, t) {
  var r = [];
  return e[t].forEach(function(n) {
    var i = r.length;
    r.forEach(function(a, o) {
      a.tag === n.tag && a.kind === n.kind && a.multi === n.multi && (i = o);
    }), r[i] = n;
  }), r;
}
function SE() {
  var e = {
    scalar: {},
    sequence: {},
    mapping: {},
    fallback: {},
    multi: {
      scalar: [],
      sequence: [],
      mapping: [],
      fallback: []
    }
  }, t, r;
  function n(i) {
    i.multi ? (e.multi[i.kind].push(i), e.multi.fallback.push(i)) : e[i.kind][i.tag] = e.fallback[i.tag] = i;
  }
  for (t = 0, r = arguments.length; t < r; t += 1)
    arguments[t].forEach(n);
  return e;
}
function pc(e) {
  return this.extend(e);
}
pc.prototype.extend = function(t) {
  var r = [], n = [];
  if (t instanceof bu)
    n.push(t);
  else if (Array.isArray(t))
    n = n.concat(t);
  else if (t && (Array.isArray(t.implicit) || Array.isArray(t.explicit)))
    t.implicit && (r = r.concat(t.implicit)), t.explicit && (n = n.concat(t.explicit));
  else
    throw new ta("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  r.forEach(function(a) {
    if (!(a instanceof bu))
      throw new ta("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    if (a.loadKind && a.loadKind !== "scalar")
      throw new ta("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    if (a.multi)
      throw new ta("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
  }), n.forEach(function(a) {
    if (!(a instanceof bu))
      throw new ta("Specified list of YAML types (or a single Type object) contains a non-Type object.");
  });
  var i = Object.create(pc.prototype);
  return i.implicit = (this.implicit || []).concat(r), i.explicit = (this.explicit || []).concat(n), i.compiledImplicit = $h(i, "implicit"), i.compiledExplicit = $h(i, "explicit"), i.compiledTypeMap = SE(i.compiledImplicit, i.compiledExplicit), i;
};
var zv = pc, FE = Pt, qv = new FE("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(e) {
    return e !== null ? e : "";
  }
}), TE = Pt, Vv = new TE("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(e) {
    return e !== null ? e : [];
  }
}), CE = Pt, Hv = new CE("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(e) {
    return e !== null ? e : {};
  }
}), AE = zv, Wv = new AE({
  explicit: [
    qv,
    Vv,
    Hv
  ]
}), PE = Pt;
function RE(e) {
  if (e === null) return !0;
  var t = e.length;
  return t === 1 && e === "~" || t === 4 && (e === "null" || e === "Null" || e === "NULL");
}
function OE() {
  return null;
}
function DE(e) {
  return e === null;
}
var Gv = new PE("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: RE,
  construct: OE,
  predicate: DE,
  represent: {
    canonical: function() {
      return "~";
    },
    lowercase: function() {
      return "null";
    },
    uppercase: function() {
      return "NULL";
    },
    camelcase: function() {
      return "Null";
    },
    empty: function() {
      return "";
    }
  },
  defaultStyle: "lowercase"
}), kE = Pt;
function NE(e) {
  if (e === null) return !1;
  var t = e.length;
  return t === 4 && (e === "true" || e === "True" || e === "TRUE") || t === 5 && (e === "false" || e === "False" || e === "FALSE");
}
function IE(e) {
  return e === "true" || e === "True" || e === "TRUE";
}
function UE(e) {
  return Object.prototype.toString.call(e) === "[object Boolean]";
}
var Kv = new kE("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: NE,
  construct: IE,
  predicate: UE,
  represent: {
    lowercase: function(e) {
      return e ? "true" : "false";
    },
    uppercase: function(e) {
      return e ? "TRUE" : "FALSE";
    },
    camelcase: function(e) {
      return e ? "True" : "False";
    }
  },
  defaultStyle: "lowercase"
}), LE = cr, BE = Pt;
function ME(e) {
  return 48 <= e && e <= 57 || 65 <= e && e <= 70 || 97 <= e && e <= 102;
}
function jE(e) {
  return 48 <= e && e <= 55;
}
function _E(e) {
  return 48 <= e && e <= 57;
}
function zE(e) {
  if (e === null) return !1;
  var t = e.length, r = 0, n = !1, i;
  if (!t) return !1;
  if (i = e[r], (i === "-" || i === "+") && (i = e[++r]), i === "0") {
    if (r + 1 === t) return !0;
    if (i = e[++r], i === "b") {
      for (r++; r < t; r++)
        if (i = e[r], i !== "_") {
          if (i !== "0" && i !== "1") return !1;
          n = !0;
        }
      return n && i !== "_";
    }
    if (i === "x") {
      for (r++; r < t; r++)
        if (i = e[r], i !== "_") {
          if (!ME(e.charCodeAt(r))) return !1;
          n = !0;
        }
      return n && i !== "_";
    }
    if (i === "o") {
      for (r++; r < t; r++)
        if (i = e[r], i !== "_") {
          if (!jE(e.charCodeAt(r))) return !1;
          n = !0;
        }
      return n && i !== "_";
    }
  }
  if (i === "_") return !1;
  for (; r < t; r++)
    if (i = e[r], i !== "_") {
      if (!_E(e.charCodeAt(r)))
        return !1;
      n = !0;
    }
  return !(!n || i === "_");
}
function qE(e) {
  var t = e, r = 1, n;
  if (t.indexOf("_") !== -1 && (t = t.replace(/_/g, "")), n = t[0], (n === "-" || n === "+") && (n === "-" && (r = -1), t = t.slice(1), n = t[0]), t === "0") return 0;
  if (n === "0") {
    if (t[1] === "b") return r * parseInt(t.slice(2), 2);
    if (t[1] === "x") return r * parseInt(t.slice(2), 16);
    if (t[1] === "o") return r * parseInt(t.slice(2), 8);
  }
  return r * parseInt(t, 10);
}
function VE(e) {
  return Object.prototype.toString.call(e) === "[object Number]" && e % 1 === 0 && !LE.isNegativeZero(e);
}
var Xv = new BE("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: zE,
  construct: qE,
  predicate: VE,
  represent: {
    binary: function(e) {
      return e >= 0 ? "0b" + e.toString(2) : "-0b" + e.toString(2).slice(1);
    },
    octal: function(e) {
      return e >= 0 ? "0o" + e.toString(8) : "-0o" + e.toString(8).slice(1);
    },
    decimal: function(e) {
      return e.toString(10);
    },
    /* eslint-disable max-len */
    hexadecimal: function(e) {
      return e >= 0 ? "0x" + e.toString(16).toUpperCase() : "-0x" + e.toString(16).toUpperCase().slice(1);
    }
  },
  defaultStyle: "decimal",
  styleAliases: {
    binary: [2, "bin"],
    octal: [8, "oct"],
    decimal: [10, "dec"],
    hexadecimal: [16, "hex"]
  }
}), Yv = cr, HE = Pt, WE = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function GE(e) {
  return !(e === null || !WE.test(e) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  e[e.length - 1] === "_");
}
function KE(e) {
  var t, r;
  return t = e.replace(/_/g, "").toLowerCase(), r = t[0] === "-" ? -1 : 1, "+-".indexOf(t[0]) >= 0 && (t = t.slice(1)), t === ".inf" ? r === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : t === ".nan" ? NaN : r * parseFloat(t, 10);
}
var XE = /^[-+]?[0-9]+e/;
function YE(e, t) {
  var r;
  if (isNaN(e))
    switch (t) {
      case "lowercase":
        return ".nan";
      case "uppercase":
        return ".NAN";
      case "camelcase":
        return ".NaN";
    }
  else if (Number.POSITIVE_INFINITY === e)
    switch (t) {
      case "lowercase":
        return ".inf";
      case "uppercase":
        return ".INF";
      case "camelcase":
        return ".Inf";
    }
  else if (Number.NEGATIVE_INFINITY === e)
    switch (t) {
      case "lowercase":
        return "-.inf";
      case "uppercase":
        return "-.INF";
      case "camelcase":
        return "-.Inf";
    }
  else if (Yv.isNegativeZero(e))
    return "-0.0";
  return r = e.toString(10), XE.test(r) ? r.replace("e", ".e") : r;
}
function ZE(e) {
  return Object.prototype.toString.call(e) === "[object Number]" && (e % 1 !== 0 || Yv.isNegativeZero(e));
}
var Zv = new HE("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: GE,
  construct: KE,
  predicate: ZE,
  represent: YE,
  defaultStyle: "lowercase"
}), Jv = Wv.extend({
  implicit: [
    Gv,
    Kv,
    Xv,
    Zv
  ]
}), Qv = Jv, JE = Pt, $v = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
), eg = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function QE(e) {
  return e === null ? !1 : $v.exec(e) !== null || eg.exec(e) !== null;
}
function $E(e) {
  var t, r, n, i, a, o, s, l = 0, u = null, c, f, h;
  if (t = $v.exec(e), t === null && (t = eg.exec(e)), t === null) throw new Error("Date resolve error");
  if (r = +t[1], n = +t[2] - 1, i = +t[3], !t[4])
    return new Date(Date.UTC(r, n, i));
  if (a = +t[4], o = +t[5], s = +t[6], t[7]) {
    for (l = t[7].slice(0, 3); l.length < 3; )
      l += "0";
    l = +l;
  }
  return t[9] && (c = +t[10], f = +(t[11] || 0), u = (c * 60 + f) * 6e4, t[9] === "-" && (u = -u)), h = new Date(Date.UTC(r, n, i, a, o, s, l)), u && h.setTime(h.getTime() - u), h;
}
function eS(e) {
  return e.toISOString();
}
var tg = new JE("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: QE,
  construct: $E,
  instanceOf: Date,
  represent: eS
}), tS = Pt;
function rS(e) {
  return e === "<<" || e === null;
}
var rg = new tS("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: rS
}), nS = Pt, sf = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
function iS(e) {
  if (e === null) return !1;
  var t, r, n = 0, i = e.length, a = sf;
  for (r = 0; r < i; r++)
    if (t = a.indexOf(e.charAt(r)), !(t > 64)) {
      if (t < 0) return !1;
      n += 6;
    }
  return n % 8 === 0;
}
function aS(e) {
  var t, r, n = e.replace(/[\r\n=]/g, ""), i = n.length, a = sf, o = 0, s = [];
  for (t = 0; t < i; t++)
    t % 4 === 0 && t && (s.push(o >> 16 & 255), s.push(o >> 8 & 255), s.push(o & 255)), o = o << 6 | a.indexOf(n.charAt(t));
  return r = i % 4 * 6, r === 0 ? (s.push(o >> 16 & 255), s.push(o >> 8 & 255), s.push(o & 255)) : r === 18 ? (s.push(o >> 10 & 255), s.push(o >> 2 & 255)) : r === 12 && s.push(o >> 4 & 255), new Uint8Array(s);
}
function oS(e) {
  var t = "", r = 0, n, i, a = e.length, o = sf;
  for (n = 0; n < a; n++)
    n % 3 === 0 && n && (t += o[r >> 18 & 63], t += o[r >> 12 & 63], t += o[r >> 6 & 63], t += o[r & 63]), r = (r << 8) + e[n];
  return i = a % 3, i === 0 ? (t += o[r >> 18 & 63], t += o[r >> 12 & 63], t += o[r >> 6 & 63], t += o[r & 63]) : i === 2 ? (t += o[r >> 10 & 63], t += o[r >> 4 & 63], t += o[r << 2 & 63], t += o[64]) : i === 1 && (t += o[r >> 2 & 63], t += o[r << 4 & 63], t += o[64], t += o[64]), t;
}
function sS(e) {
  return Object.prototype.toString.call(e) === "[object Uint8Array]";
}
var ng = new nS("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: iS,
  construct: aS,
  predicate: sS,
  represent: oS
}), lS = Pt, uS = Object.prototype.hasOwnProperty, cS = Object.prototype.toString;
function fS(e) {
  if (e === null) return !0;
  var t = [], r, n, i, a, o, s = e;
  for (r = 0, n = s.length; r < n; r += 1) {
    if (i = s[r], o = !1, cS.call(i) !== "[object Object]") return !1;
    for (a in i)
      if (uS.call(i, a))
        if (!o) o = !0;
        else return !1;
    if (!o) return !1;
    if (t.indexOf(a) === -1) t.push(a);
    else return !1;
  }
  return !0;
}
function hS(e) {
  return e !== null ? e : [];
}
var ig = new lS("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: fS,
  construct: hS
}), dS = Pt, pS = Object.prototype.toString;
function vS(e) {
  if (e === null) return !0;
  var t, r, n, i, a, o = e;
  for (a = new Array(o.length), t = 0, r = o.length; t < r; t += 1) {
    if (n = o[t], pS.call(n) !== "[object Object]" || (i = Object.keys(n), i.length !== 1)) return !1;
    a[t] = [i[0], n[i[0]]];
  }
  return !0;
}
function gS(e) {
  if (e === null) return [];
  var t, r, n, i, a, o = e;
  for (a = new Array(o.length), t = 0, r = o.length; t < r; t += 1)
    n = o[t], i = Object.keys(n), a[t] = [i[0], n[i[0]]];
  return a;
}
var ag = new dS("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: vS,
  construct: gS
}), mS = Pt, yS = Object.prototype.hasOwnProperty;
function bS(e) {
  if (e === null) return !0;
  var t, r = e;
  for (t in r)
    if (yS.call(r, t) && r[t] !== null)
      return !1;
  return !0;
}
function wS(e) {
  return e !== null ? e : {};
}
var og = new mS("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: bS,
  construct: wS
}), lf = Qv.extend({
  implicit: [
    tg,
    rg
  ],
  explicit: [
    ng,
    ig,
    ag,
    og
  ]
}), kn = cr, sg = po, xS = yE, ES = lf, fn = Object.prototype.hasOwnProperty, zs = 1, lg = 2, ug = 3, qs = 4, wu = 1, SS = 2, ed = 3, FS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/, TS = /[\x85\u2028\u2029]/, CS = /[,\[\]\{\}]/, cg = /^(?:!|!!|![a-z\-]+!)$/i, fg = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
function td(e) {
  return Object.prototype.toString.call(e);
}
function Er(e) {
  return e === 10 || e === 13;
}
function jn(e) {
  return e === 9 || e === 32;
}
function kt(e) {
  return e === 9 || e === 32 || e === 10 || e === 13;
}
function yi(e) {
  return e === 44 || e === 91 || e === 93 || e === 123 || e === 125;
}
function AS(e) {
  var t;
  return 48 <= e && e <= 57 ? e - 48 : (t = e | 32, 97 <= t && t <= 102 ? t - 97 + 10 : -1);
}
function PS(e) {
  return e === 120 ? 2 : e === 117 ? 4 : e === 85 ? 8 : 0;
}
function RS(e) {
  return 48 <= e && e <= 57 ? e - 48 : -1;
}
function rd(e) {
  return e === 48 ? "\0" : e === 97 ? "\x07" : e === 98 ? "\b" : e === 116 || e === 9 ? "	" : e === 110 ? `
` : e === 118 ? "\v" : e === 102 ? "\f" : e === 114 ? "\r" : e === 101 ? "\x1B" : e === 32 ? " " : e === 34 ? '"' : e === 47 ? "/" : e === 92 ? "\\" : e === 78 ? "" : e === 95 ? " " : e === 76 ? "\u2028" : e === 80 ? "\u2029" : "";
}
function OS(e) {
  return e <= 65535 ? String.fromCharCode(e) : String.fromCharCode(
    (e - 65536 >> 10) + 55296,
    (e - 65536 & 1023) + 56320
  );
}
function hg(e, t, r) {
  t === "__proto__" ? Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !0,
    writable: !0,
    value: r
  }) : e[t] = r;
}
var dg = new Array(256), pg = new Array(256);
for (var oi = 0; oi < 256; oi++)
  dg[oi] = rd(oi) ? 1 : 0, pg[oi] = rd(oi);
function DS(e, t) {
  this.input = e, this.filename = t.filename || null, this.schema = t.schema || ES, this.onWarning = t.onWarning || null, this.legacy = t.legacy || !1, this.json = t.json || !1, this.listener = t.listener || null, this.implicitTypes = this.schema.compiledImplicit, this.typeMap = this.schema.compiledTypeMap, this.length = e.length, this.position = 0, this.line = 0, this.lineStart = 0, this.lineIndent = 0, this.firstTabInLine = -1, this.documents = [];
}
function vg(e, t) {
  var r = {
    name: e.filename,
    buffer: e.input.slice(0, -1),
    // omit trailing \0
    position: e.position,
    line: e.line,
    column: e.position - e.lineStart
  };
  return r.snippet = xS(r), new sg(t, r);
}
function $(e, t) {
  throw vg(e, t);
}
function Vs(e, t) {
  e.onWarning && e.onWarning.call(null, vg(e, t));
}
var nd = {
  YAML: function(t, r, n) {
    var i, a, o;
    t.version !== null && $(t, "duplication of %YAML directive"), n.length !== 1 && $(t, "YAML directive accepts exactly one argument"), i = /^([0-9]+)\.([0-9]+)$/.exec(n[0]), i === null && $(t, "ill-formed argument of the YAML directive"), a = parseInt(i[1], 10), o = parseInt(i[2], 10), a !== 1 && $(t, "unacceptable YAML version of the document"), t.version = n[0], t.checkLineBreaks = o < 2, o !== 1 && o !== 2 && Vs(t, "unsupported YAML version of the document");
  },
  TAG: function(t, r, n) {
    var i, a;
    n.length !== 2 && $(t, "TAG directive accepts exactly two arguments"), i = n[0], a = n[1], cg.test(i) || $(t, "ill-formed tag handle (first argument) of the TAG directive"), fn.call(t.tagMap, i) && $(t, 'there is a previously declared suffix for "' + i + '" tag handle'), fg.test(a) || $(t, "ill-formed tag prefix (second argument) of the TAG directive");
    try {
      a = decodeURIComponent(a);
    } catch {
      $(t, "tag prefix is malformed: " + a);
    }
    t.tagMap[i] = a;
  }
};
function an(e, t, r, n) {
  var i, a, o, s;
  if (t < r) {
    if (s = e.input.slice(t, r), n)
      for (i = 0, a = s.length; i < a; i += 1)
        o = s.charCodeAt(i), o === 9 || 32 <= o && o <= 1114111 || $(e, "expected valid JSON character");
    else FS.test(s) && $(e, "the stream contains non-printable characters");
    e.result += s;
  }
}
function id(e, t, r, n) {
  var i, a, o, s;
  for (kn.isObject(r) || $(e, "cannot merge mappings; the provided source object is unacceptable"), i = Object.keys(r), o = 0, s = i.length; o < s; o += 1)
    a = i[o], fn.call(t, a) || (hg(t, a, r[a]), n[a] = !0);
}
function bi(e, t, r, n, i, a, o, s, l) {
  var u, c;
  if (Array.isArray(i))
    for (i = Array.prototype.slice.call(i), u = 0, c = i.length; u < c; u += 1)
      Array.isArray(i[u]) && $(e, "nested arrays are not supported inside keys"), typeof i == "object" && td(i[u]) === "[object Object]" && (i[u] = "[object Object]");
  if (typeof i == "object" && td(i) === "[object Object]" && (i = "[object Object]"), i = String(i), t === null && (t = {}), n === "tag:yaml.org,2002:merge")
    if (Array.isArray(a))
      for (u = 0, c = a.length; u < c; u += 1)
        id(e, t, a[u], r);
    else
      id(e, t, a, r);
  else
    !e.json && !fn.call(r, i) && fn.call(t, i) && (e.line = o || e.line, e.lineStart = s || e.lineStart, e.position = l || e.position, $(e, "duplicated mapping key")), hg(t, i, a), delete r[i];
  return t;
}
function uf(e) {
  var t;
  t = e.input.charCodeAt(e.position), t === 10 ? e.position++ : t === 13 ? (e.position++, e.input.charCodeAt(e.position) === 10 && e.position++) : $(e, "a line break is expected"), e.line += 1, e.lineStart = e.position, e.firstTabInLine = -1;
}
function Ge(e, t, r) {
  for (var n = 0, i = e.input.charCodeAt(e.position); i !== 0; ) {
    for (; jn(i); )
      i === 9 && e.firstTabInLine === -1 && (e.firstTabInLine = e.position), i = e.input.charCodeAt(++e.position);
    if (t && i === 35)
      do
        i = e.input.charCodeAt(++e.position);
      while (i !== 10 && i !== 13 && i !== 0);
    if (Er(i))
      for (uf(e), i = e.input.charCodeAt(e.position), n++, e.lineIndent = 0; i === 32; )
        e.lineIndent++, i = e.input.charCodeAt(++e.position);
    else
      break;
  }
  return r !== -1 && n !== 0 && e.lineIndent < r && Vs(e, "deficient indentation"), n;
}
function ml(e) {
  var t = e.position, r;
  return r = e.input.charCodeAt(t), !!((r === 45 || r === 46) && r === e.input.charCodeAt(t + 1) && r === e.input.charCodeAt(t + 2) && (t += 3, r = e.input.charCodeAt(t), r === 0 || kt(r)));
}
function cf(e, t) {
  t === 1 ? e.result += " " : t > 1 && (e.result += kn.repeat(`
`, t - 1));
}
function kS(e, t, r) {
  var n, i, a, o, s, l, u, c, f = e.kind, h = e.result, d;
  if (d = e.input.charCodeAt(e.position), kt(d) || yi(d) || d === 35 || d === 38 || d === 42 || d === 33 || d === 124 || d === 62 || d === 39 || d === 34 || d === 37 || d === 64 || d === 96 || (d === 63 || d === 45) && (i = e.input.charCodeAt(e.position + 1), kt(i) || r && yi(i)))
    return !1;
  for (e.kind = "scalar", e.result = "", a = o = e.position, s = !1; d !== 0; ) {
    if (d === 58) {
      if (i = e.input.charCodeAt(e.position + 1), kt(i) || r && yi(i))
        break;
    } else if (d === 35) {
      if (n = e.input.charCodeAt(e.position - 1), kt(n))
        break;
    } else {
      if (e.position === e.lineStart && ml(e) || r && yi(d))
        break;
      if (Er(d))
        if (l = e.line, u = e.lineStart, c = e.lineIndent, Ge(e, !1, -1), e.lineIndent >= t) {
          s = !0, d = e.input.charCodeAt(e.position);
          continue;
        } else {
          e.position = o, e.line = l, e.lineStart = u, e.lineIndent = c;
          break;
        }
    }
    s && (an(e, a, o, !1), cf(e, e.line - l), a = o = e.position, s = !1), jn(d) || (o = e.position + 1), d = e.input.charCodeAt(++e.position);
  }
  return an(e, a, o, !1), e.result ? !0 : (e.kind = f, e.result = h, !1);
}
function NS(e, t) {
  var r, n, i;
  if (r = e.input.charCodeAt(e.position), r !== 39)
    return !1;
  for (e.kind = "scalar", e.result = "", e.position++, n = i = e.position; (r = e.input.charCodeAt(e.position)) !== 0; )
    if (r === 39)
      if (an(e, n, e.position, !0), r = e.input.charCodeAt(++e.position), r === 39)
        n = e.position, e.position++, i = e.position;
      else
        return !0;
    else Er(r) ? (an(e, n, i, !0), cf(e, Ge(e, !1, t)), n = i = e.position) : e.position === e.lineStart && ml(e) ? $(e, "unexpected end of the document within a single quoted scalar") : (e.position++, i = e.position);
  $(e, "unexpected end of the stream within a single quoted scalar");
}
function IS(e, t) {
  var r, n, i, a, o, s;
  if (s = e.input.charCodeAt(e.position), s !== 34)
    return !1;
  for (e.kind = "scalar", e.result = "", e.position++, r = n = e.position; (s = e.input.charCodeAt(e.position)) !== 0; ) {
    if (s === 34)
      return an(e, r, e.position, !0), e.position++, !0;
    if (s === 92) {
      if (an(e, r, e.position, !0), s = e.input.charCodeAt(++e.position), Er(s))
        Ge(e, !1, t);
      else if (s < 256 && dg[s])
        e.result += pg[s], e.position++;
      else if ((o = PS(s)) > 0) {
        for (i = o, a = 0; i > 0; i--)
          s = e.input.charCodeAt(++e.position), (o = AS(s)) >= 0 ? a = (a << 4) + o : $(e, "expected hexadecimal character");
        e.result += OS(a), e.position++;
      } else
        $(e, "unknown escape sequence");
      r = n = e.position;
    } else Er(s) ? (an(e, r, n, !0), cf(e, Ge(e, !1, t)), r = n = e.position) : e.position === e.lineStart && ml(e) ? $(e, "unexpected end of the document within a double quoted scalar") : (e.position++, n = e.position);
  }
  $(e, "unexpected end of the stream within a double quoted scalar");
}
function US(e, t) {
  var r = !0, n, i, a, o = e.tag, s, l = e.anchor, u, c, f, h, d, p = /* @__PURE__ */ Object.create(null), v, y, m, S;
  if (S = e.input.charCodeAt(e.position), S === 91)
    c = 93, d = !1, s = [];
  else if (S === 123)
    c = 125, d = !0, s = {};
  else
    return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = s), S = e.input.charCodeAt(++e.position); S !== 0; ) {
    if (Ge(e, !0, t), S = e.input.charCodeAt(e.position), S === c)
      return e.position++, e.tag = o, e.anchor = l, e.kind = d ? "mapping" : "sequence", e.result = s, !0;
    r ? S === 44 && $(e, "expected the node content, but found ','") : $(e, "missed comma between flow collection entries"), y = v = m = null, f = h = !1, S === 63 && (u = e.input.charCodeAt(e.position + 1), kt(u) && (f = h = !0, e.position++, Ge(e, !0, t))), n = e.line, i = e.lineStart, a = e.position, Ii(e, t, zs, !1, !0), y = e.tag, v = e.result, Ge(e, !0, t), S = e.input.charCodeAt(e.position), (h || e.line === n) && S === 58 && (f = !0, S = e.input.charCodeAt(++e.position), Ge(e, !0, t), Ii(e, t, zs, !1, !0), m = e.result), d ? bi(e, s, p, y, v, m, n, i, a) : f ? s.push(bi(e, null, p, y, v, m, n, i, a)) : s.push(v), Ge(e, !0, t), S = e.input.charCodeAt(e.position), S === 44 ? (r = !0, S = e.input.charCodeAt(++e.position)) : r = !1;
  }
  $(e, "unexpected end of the stream within a flow collection");
}
function LS(e, t) {
  var r, n, i = wu, a = !1, o = !1, s = t, l = 0, u = !1, c, f;
  if (f = e.input.charCodeAt(e.position), f === 124)
    n = !1;
  else if (f === 62)
    n = !0;
  else
    return !1;
  for (e.kind = "scalar", e.result = ""; f !== 0; )
    if (f = e.input.charCodeAt(++e.position), f === 43 || f === 45)
      wu === i ? i = f === 43 ? ed : SS : $(e, "repeat of a chomping mode identifier");
    else if ((c = RS(f)) >= 0)
      c === 0 ? $(e, "bad explicit indentation width of a block scalar; it cannot be less than one") : o ? $(e, "repeat of an indentation width identifier") : (s = t + c - 1, o = !0);
    else
      break;
  if (jn(f)) {
    do
      f = e.input.charCodeAt(++e.position);
    while (jn(f));
    if (f === 35)
      do
        f = e.input.charCodeAt(++e.position);
      while (!Er(f) && f !== 0);
  }
  for (; f !== 0; ) {
    for (uf(e), e.lineIndent = 0, f = e.input.charCodeAt(e.position); (!o || e.lineIndent < s) && f === 32; )
      e.lineIndent++, f = e.input.charCodeAt(++e.position);
    if (!o && e.lineIndent > s && (s = e.lineIndent), Er(f)) {
      l++;
      continue;
    }
    if (e.lineIndent < s) {
      i === ed ? e.result += kn.repeat(`
`, a ? 1 + l : l) : i === wu && a && (e.result += `
`);
      break;
    }
    for (n ? jn(f) ? (u = !0, e.result += kn.repeat(`
`, a ? 1 + l : l)) : u ? (u = !1, e.result += kn.repeat(`
`, l + 1)) : l === 0 ? a && (e.result += " ") : e.result += kn.repeat(`
`, l) : e.result += kn.repeat(`
`, a ? 1 + l : l), a = !0, o = !0, l = 0, r = e.position; !Er(f) && f !== 0; )
      f = e.input.charCodeAt(++e.position);
    an(e, r, e.position, !1);
  }
  return !0;
}
function ad(e, t) {
  var r, n = e.tag, i = e.anchor, a = [], o, s = !1, l;
  if (e.firstTabInLine !== -1) return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = a), l = e.input.charCodeAt(e.position); l !== 0 && (e.firstTabInLine !== -1 && (e.position = e.firstTabInLine, $(e, "tab characters must not be used in indentation")), !(l !== 45 || (o = e.input.charCodeAt(e.position + 1), !kt(o)))); ) {
    if (s = !0, e.position++, Ge(e, !0, -1) && e.lineIndent <= t) {
      a.push(null), l = e.input.charCodeAt(e.position);
      continue;
    }
    if (r = e.line, Ii(e, t, ug, !1, !0), a.push(e.result), Ge(e, !0, -1), l = e.input.charCodeAt(e.position), (e.line === r || e.lineIndent > t) && l !== 0)
      $(e, "bad indentation of a sequence entry");
    else if (e.lineIndent < t)
      break;
  }
  return s ? (e.tag = n, e.anchor = i, e.kind = "sequence", e.result = a, !0) : !1;
}
function BS(e, t, r) {
  var n, i, a, o, s, l, u = e.tag, c = e.anchor, f = {}, h = /* @__PURE__ */ Object.create(null), d = null, p = null, v = null, y = !1, m = !1, S;
  if (e.firstTabInLine !== -1) return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = f), S = e.input.charCodeAt(e.position); S !== 0; ) {
    if (!y && e.firstTabInLine !== -1 && (e.position = e.firstTabInLine, $(e, "tab characters must not be used in indentation")), n = e.input.charCodeAt(e.position + 1), a = e.line, (S === 63 || S === 58) && kt(n))
      S === 63 ? (y && (bi(e, f, h, d, p, null, o, s, l), d = p = v = null), m = !0, y = !0, i = !0) : y ? (y = !1, i = !0) : $(e, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line"), e.position += 1, S = n;
    else {
      if (o = e.line, s = e.lineStart, l = e.position, !Ii(e, r, lg, !1, !0))
        break;
      if (e.line === a) {
        for (S = e.input.charCodeAt(e.position); jn(S); )
          S = e.input.charCodeAt(++e.position);
        if (S === 58)
          S = e.input.charCodeAt(++e.position), kt(S) || $(e, "a whitespace character is expected after the key-value separator within a block mapping"), y && (bi(e, f, h, d, p, null, o, s, l), d = p = v = null), m = !0, y = !1, i = !1, d = e.tag, p = e.result;
        else if (m)
          $(e, "can not read an implicit mapping pair; a colon is missed");
        else
          return e.tag = u, e.anchor = c, !0;
      } else if (m)
        $(e, "can not read a block mapping entry; a multiline key may not be an implicit key");
      else
        return e.tag = u, e.anchor = c, !0;
    }
    if ((e.line === a || e.lineIndent > t) && (y && (o = e.line, s = e.lineStart, l = e.position), Ii(e, t, qs, !0, i) && (y ? p = e.result : v = e.result), y || (bi(e, f, h, d, p, v, o, s, l), d = p = v = null), Ge(e, !0, -1), S = e.input.charCodeAt(e.position)), (e.line === a || e.lineIndent > t) && S !== 0)
      $(e, "bad indentation of a mapping entry");
    else if (e.lineIndent < t)
      break;
  }
  return y && bi(e, f, h, d, p, null, o, s, l), m && (e.tag = u, e.anchor = c, e.kind = "mapping", e.result = f), m;
}
function MS(e) {
  var t, r = !1, n = !1, i, a, o;
  if (o = e.input.charCodeAt(e.position), o !== 33) return !1;
  if (e.tag !== null && $(e, "duplication of a tag property"), o = e.input.charCodeAt(++e.position), o === 60 ? (r = !0, o = e.input.charCodeAt(++e.position)) : o === 33 ? (n = !0, i = "!!", o = e.input.charCodeAt(++e.position)) : i = "!", t = e.position, r) {
    do
      o = e.input.charCodeAt(++e.position);
    while (o !== 0 && o !== 62);
    e.position < e.length ? (a = e.input.slice(t, e.position), o = e.input.charCodeAt(++e.position)) : $(e, "unexpected end of the stream within a verbatim tag");
  } else {
    for (; o !== 0 && !kt(o); )
      o === 33 && (n ? $(e, "tag suffix cannot contain exclamation marks") : (i = e.input.slice(t - 1, e.position + 1), cg.test(i) || $(e, "named tag handle cannot contain such characters"), n = !0, t = e.position + 1)), o = e.input.charCodeAt(++e.position);
    a = e.input.slice(t, e.position), CS.test(a) && $(e, "tag suffix cannot contain flow indicator characters");
  }
  a && !fg.test(a) && $(e, "tag name cannot contain such characters: " + a);
  try {
    a = decodeURIComponent(a);
  } catch {
    $(e, "tag name is malformed: " + a);
  }
  return r ? e.tag = a : fn.call(e.tagMap, i) ? e.tag = e.tagMap[i] + a : i === "!" ? e.tag = "!" + a : i === "!!" ? e.tag = "tag:yaml.org,2002:" + a : $(e, 'undeclared tag handle "' + i + '"'), !0;
}
function jS(e) {
  var t, r;
  if (r = e.input.charCodeAt(e.position), r !== 38) return !1;
  for (e.anchor !== null && $(e, "duplication of an anchor property"), r = e.input.charCodeAt(++e.position), t = e.position; r !== 0 && !kt(r) && !yi(r); )
    r = e.input.charCodeAt(++e.position);
  return e.position === t && $(e, "name of an anchor node must contain at least one character"), e.anchor = e.input.slice(t, e.position), !0;
}
function _S(e) {
  var t, r, n;
  if (n = e.input.charCodeAt(e.position), n !== 42) return !1;
  for (n = e.input.charCodeAt(++e.position), t = e.position; n !== 0 && !kt(n) && !yi(n); )
    n = e.input.charCodeAt(++e.position);
  return e.position === t && $(e, "name of an alias node must contain at least one character"), r = e.input.slice(t, e.position), fn.call(e.anchorMap, r) || $(e, 'unidentified alias "' + r + '"'), e.result = e.anchorMap[r], Ge(e, !0, -1), !0;
}
function Ii(e, t, r, n, i) {
  var a, o, s, l = 1, u = !1, c = !1, f, h, d, p, v, y;
  if (e.listener !== null && e.listener("open", e), e.tag = null, e.anchor = null, e.kind = null, e.result = null, a = o = s = qs === r || ug === r, n && Ge(e, !0, -1) && (u = !0, e.lineIndent > t ? l = 1 : e.lineIndent === t ? l = 0 : e.lineIndent < t && (l = -1)), l === 1)
    for (; MS(e) || jS(e); )
      Ge(e, !0, -1) ? (u = !0, s = a, e.lineIndent > t ? l = 1 : e.lineIndent === t ? l = 0 : e.lineIndent < t && (l = -1)) : s = !1;
  if (s && (s = u || i), (l === 1 || qs === r) && (zs === r || lg === r ? v = t : v = t + 1, y = e.position - e.lineStart, l === 1 ? s && (ad(e, y) || BS(e, y, v)) || US(e, v) ? c = !0 : (o && LS(e, v) || NS(e, v) || IS(e, v) ? c = !0 : _S(e) ? (c = !0, (e.tag !== null || e.anchor !== null) && $(e, "alias node should not have any properties")) : kS(e, v, zs === r) && (c = !0, e.tag === null && (e.tag = "?")), e.anchor !== null && (e.anchorMap[e.anchor] = e.result)) : l === 0 && (c = s && ad(e, y))), e.tag === null)
    e.anchor !== null && (e.anchorMap[e.anchor] = e.result);
  else if (e.tag === "?") {
    for (e.result !== null && e.kind !== "scalar" && $(e, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + e.kind + '"'), f = 0, h = e.implicitTypes.length; f < h; f += 1)
      if (p = e.implicitTypes[f], p.resolve(e.result)) {
        e.result = p.construct(e.result), e.tag = p.tag, e.anchor !== null && (e.anchorMap[e.anchor] = e.result);
        break;
      }
  } else if (e.tag !== "!") {
    if (fn.call(e.typeMap[e.kind || "fallback"], e.tag))
      p = e.typeMap[e.kind || "fallback"][e.tag];
    else
      for (p = null, d = e.typeMap.multi[e.kind || "fallback"], f = 0, h = d.length; f < h; f += 1)
        if (e.tag.slice(0, d[f].tag.length) === d[f].tag) {
          p = d[f];
          break;
        }
    p || $(e, "unknown tag !<" + e.tag + ">"), e.result !== null && p.kind !== e.kind && $(e, "unacceptable node kind for !<" + e.tag + '> tag; it should be "' + p.kind + '", not "' + e.kind + '"'), p.resolve(e.result, e.tag) ? (e.result = p.construct(e.result, e.tag), e.anchor !== null && (e.anchorMap[e.anchor] = e.result)) : $(e, "cannot resolve a node with !<" + e.tag + "> explicit tag");
  }
  return e.listener !== null && e.listener("close", e), e.tag !== null || e.anchor !== null || c;
}
function zS(e) {
  var t = e.position, r, n, i, a = !1, o;
  for (e.version = null, e.checkLineBreaks = e.legacy, e.tagMap = /* @__PURE__ */ Object.create(null), e.anchorMap = /* @__PURE__ */ Object.create(null); (o = e.input.charCodeAt(e.position)) !== 0 && (Ge(e, !0, -1), o = e.input.charCodeAt(e.position), !(e.lineIndent > 0 || o !== 37)); ) {
    for (a = !0, o = e.input.charCodeAt(++e.position), r = e.position; o !== 0 && !kt(o); )
      o = e.input.charCodeAt(++e.position);
    for (n = e.input.slice(r, e.position), i = [], n.length < 1 && $(e, "directive name must not be less than one character in length"); o !== 0; ) {
      for (; jn(o); )
        o = e.input.charCodeAt(++e.position);
      if (o === 35) {
        do
          o = e.input.charCodeAt(++e.position);
        while (o !== 0 && !Er(o));
        break;
      }
      if (Er(o)) break;
      for (r = e.position; o !== 0 && !kt(o); )
        o = e.input.charCodeAt(++e.position);
      i.push(e.input.slice(r, e.position));
    }
    o !== 0 && uf(e), fn.call(nd, n) ? nd[n](e, n, i) : Vs(e, 'unknown document directive "' + n + '"');
  }
  if (Ge(e, !0, -1), e.lineIndent === 0 && e.input.charCodeAt(e.position) === 45 && e.input.charCodeAt(e.position + 1) === 45 && e.input.charCodeAt(e.position + 2) === 45 ? (e.position += 3, Ge(e, !0, -1)) : a && $(e, "directives end mark is expected"), Ii(e, e.lineIndent - 1, qs, !1, !0), Ge(e, !0, -1), e.checkLineBreaks && TS.test(e.input.slice(t, e.position)) && Vs(e, "non-ASCII line breaks are interpreted as content"), e.documents.push(e.result), e.position === e.lineStart && ml(e)) {
    e.input.charCodeAt(e.position) === 46 && (e.position += 3, Ge(e, !0, -1));
    return;
  }
  if (e.position < e.length - 1)
    $(e, "end of the stream or a document separator is expected");
  else
    return;
}
function gg(e, t) {
  e = String(e), t = t || {}, e.length !== 0 && (e.charCodeAt(e.length - 1) !== 10 && e.charCodeAt(e.length - 1) !== 13 && (e += `
`), e.charCodeAt(0) === 65279 && (e = e.slice(1)));
  var r = new DS(e, t), n = e.indexOf("\0");
  for (n !== -1 && (r.position = n, $(r, "null byte is not allowed in input")), r.input += "\0"; r.input.charCodeAt(r.position) === 32; )
    r.lineIndent += 1, r.position += 1;
  for (; r.position < r.length - 1; )
    zS(r);
  return r.documents;
}
function qS(e, t, r) {
  t !== null && typeof t == "object" && typeof r > "u" && (r = t, t = null);
  var n = gg(e, r);
  if (typeof t != "function")
    return n;
  for (var i = 0, a = n.length; i < a; i += 1)
    t(n[i]);
}
function VS(e, t) {
  var r = gg(e, t);
  if (r.length !== 0) {
    if (r.length === 1)
      return r[0];
    throw new sg("expected a single document in the stream, but found more");
  }
}
of.loadAll = qS;
of.load = VS;
var mg = {}, yl = cr, vo = po, HS = lf, yg = Object.prototype.toString, bg = Object.prototype.hasOwnProperty, ff = 65279, WS = 9, qa = 10, GS = 13, KS = 32, XS = 33, YS = 34, vc = 35, ZS = 37, JS = 38, QS = 39, $S = 42, wg = 44, eF = 45, Hs = 58, tF = 61, rF = 62, nF = 63, iF = 64, xg = 91, Eg = 93, aF = 96, Sg = 123, oF = 124, Fg = 125, gt = {};
gt[0] = "\\0";
gt[7] = "\\a";
gt[8] = "\\b";
gt[9] = "\\t";
gt[10] = "\\n";
gt[11] = "\\v";
gt[12] = "\\f";
gt[13] = "\\r";
gt[27] = "\\e";
gt[34] = '\\"';
gt[92] = "\\\\";
gt[133] = "\\N";
gt[160] = "\\_";
gt[8232] = "\\L";
gt[8233] = "\\P";
var sF = [
  "y",
  "Y",
  "yes",
  "Yes",
  "YES",
  "on",
  "On",
  "ON",
  "n",
  "N",
  "no",
  "No",
  "NO",
  "off",
  "Off",
  "OFF"
], lF = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
function uF(e, t) {
  var r, n, i, a, o, s, l;
  if (t === null) return {};
  for (r = {}, n = Object.keys(t), i = 0, a = n.length; i < a; i += 1)
    o = n[i], s = String(t[o]), o.slice(0, 2) === "!!" && (o = "tag:yaml.org,2002:" + o.slice(2)), l = e.compiledTypeMap.fallback[o], l && bg.call(l.styleAliases, s) && (s = l.styleAliases[s]), r[o] = s;
  return r;
}
function cF(e) {
  var t, r, n;
  if (t = e.toString(16).toUpperCase(), e <= 255)
    r = "x", n = 2;
  else if (e <= 65535)
    r = "u", n = 4;
  else if (e <= 4294967295)
    r = "U", n = 8;
  else
    throw new vo("code point within a string may not be greater than 0xFFFFFFFF");
  return "\\" + r + yl.repeat("0", n - t.length) + t;
}
var fF = 1, Va = 2;
function hF(e) {
  this.schema = e.schema || HS, this.indent = Math.max(1, e.indent || 2), this.noArrayIndent = e.noArrayIndent || !1, this.skipInvalid = e.skipInvalid || !1, this.flowLevel = yl.isNothing(e.flowLevel) ? -1 : e.flowLevel, this.styleMap = uF(this.schema, e.styles || null), this.sortKeys = e.sortKeys || !1, this.lineWidth = e.lineWidth || 80, this.noRefs = e.noRefs || !1, this.noCompatMode = e.noCompatMode || !1, this.condenseFlow = e.condenseFlow || !1, this.quotingType = e.quotingType === '"' ? Va : fF, this.forceQuotes = e.forceQuotes || !1, this.replacer = typeof e.replacer == "function" ? e.replacer : null, this.implicitTypes = this.schema.compiledImplicit, this.explicitTypes = this.schema.compiledExplicit, this.tag = null, this.result = "", this.duplicates = [], this.usedDuplicates = null;
}
function od(e, t) {
  for (var r = yl.repeat(" ", t), n = 0, i = -1, a = "", o, s = e.length; n < s; )
    i = e.indexOf(`
`, n), i === -1 ? (o = e.slice(n), n = s) : (o = e.slice(n, i + 1), n = i + 1), o.length && o !== `
` && (a += r), a += o;
  return a;
}
function gc(e, t) {
  return `
` + yl.repeat(" ", e.indent * t);
}
function dF(e, t) {
  var r, n, i;
  for (r = 0, n = e.implicitTypes.length; r < n; r += 1)
    if (i = e.implicitTypes[r], i.resolve(t))
      return !0;
  return !1;
}
function Ws(e) {
  return e === KS || e === WS;
}
function Ha(e) {
  return 32 <= e && e <= 126 || 161 <= e && e <= 55295 && e !== 8232 && e !== 8233 || 57344 <= e && e <= 65533 && e !== ff || 65536 <= e && e <= 1114111;
}
function sd(e) {
  return Ha(e) && e !== ff && e !== GS && e !== qa;
}
function ld(e, t, r) {
  var n = sd(e), i = n && !Ws(e);
  return (
    // ns-plain-safe
    (r ? (
      // c = flow-in
      n
    ) : n && e !== wg && e !== xg && e !== Eg && e !== Sg && e !== Fg) && e !== vc && !(t === Hs && !i) || sd(t) && !Ws(t) && e === vc || t === Hs && i
  );
}
function pF(e) {
  return Ha(e) && e !== ff && !Ws(e) && e !== eF && e !== nF && e !== Hs && e !== wg && e !== xg && e !== Eg && e !== Sg && e !== Fg && e !== vc && e !== JS && e !== $S && e !== XS && e !== oF && e !== tF && e !== rF && e !== QS && e !== YS && e !== ZS && e !== iF && e !== aF;
}
function vF(e) {
  return !Ws(e) && e !== Hs;
}
function pa(e, t) {
  var r = e.charCodeAt(t), n;
  return r >= 55296 && r <= 56319 && t + 1 < e.length && (n = e.charCodeAt(t + 1), n >= 56320 && n <= 57343) ? (r - 55296) * 1024 + n - 56320 + 65536 : r;
}
function Tg(e) {
  var t = /^\n* /;
  return t.test(e);
}
var Cg = 1, mc = 2, Ag = 3, Pg = 4, gi = 5;
function gF(e, t, r, n, i, a, o, s) {
  var l, u = 0, c = null, f = !1, h = !1, d = n !== -1, p = -1, v = pF(pa(e, 0)) && vF(pa(e, e.length - 1));
  if (t || o)
    for (l = 0; l < e.length; u >= 65536 ? l += 2 : l++) {
      if (u = pa(e, l), !Ha(u))
        return gi;
      v = v && ld(u, c, s), c = u;
    }
  else {
    for (l = 0; l < e.length; u >= 65536 ? l += 2 : l++) {
      if (u = pa(e, l), u === qa)
        f = !0, d && (h = h || // Foldable line = too long, and not more-indented.
        l - p - 1 > n && e[p + 1] !== " ", p = l);
      else if (!Ha(u))
        return gi;
      v = v && ld(u, c, s), c = u;
    }
    h = h || d && l - p - 1 > n && e[p + 1] !== " ";
  }
  return !f && !h ? v && !o && !i(e) ? Cg : a === Va ? gi : mc : r > 9 && Tg(e) ? gi : o ? a === Va ? gi : mc : h ? Pg : Ag;
}
function mF(e, t, r, n, i) {
  e.dump = function() {
    if (t.length === 0)
      return e.quotingType === Va ? '""' : "''";
    if (!e.noCompatMode && (sF.indexOf(t) !== -1 || lF.test(t)))
      return e.quotingType === Va ? '"' + t + '"' : "'" + t + "'";
    var a = e.indent * Math.max(1, r), o = e.lineWidth === -1 ? -1 : Math.max(Math.min(e.lineWidth, 40), e.lineWidth - a), s = n || e.flowLevel > -1 && r >= e.flowLevel;
    function l(u) {
      return dF(e, u);
    }
    switch (gF(
      t,
      s,
      e.indent,
      o,
      l,
      e.quotingType,
      e.forceQuotes && !n,
      i
    )) {
      case Cg:
        return t;
      case mc:
        return "'" + t.replace(/'/g, "''") + "'";
      case Ag:
        return "|" + ud(t, e.indent) + cd(od(t, a));
      case Pg:
        return ">" + ud(t, e.indent) + cd(od(yF(t, o), a));
      case gi:
        return '"' + bF(t) + '"';
      default:
        throw new vo("impossible error: invalid scalar style");
    }
  }();
}
function ud(e, t) {
  var r = Tg(e) ? String(t) : "", n = e[e.length - 1] === `
`, i = n && (e[e.length - 2] === `
` || e === `
`), a = i ? "+" : n ? "" : "-";
  return r + a + `
`;
}
function cd(e) {
  return e[e.length - 1] === `
` ? e.slice(0, -1) : e;
}
function yF(e, t) {
  for (var r = /(\n+)([^\n]*)/g, n = function() {
    var u = e.indexOf(`
`);
    return u = u !== -1 ? u : e.length, r.lastIndex = u, fd(e.slice(0, u), t);
  }(), i = e[0] === `
` || e[0] === " ", a, o; o = r.exec(e); ) {
    var s = o[1], l = o[2];
    a = l[0] === " ", n += s + (!i && !a && l !== "" ? `
` : "") + fd(l, t), i = a;
  }
  return n;
}
function fd(e, t) {
  if (e === "" || e[0] === " ") return e;
  for (var r = / [^ ]/g, n, i = 0, a, o = 0, s = 0, l = ""; n = r.exec(e); )
    s = n.index, s - i > t && (a = o > i ? o : s, l += `
` + e.slice(i, a), i = a + 1), o = s;
  return l += `
`, e.length - i > t && o > i ? l += e.slice(i, o) + `
` + e.slice(o + 1) : l += e.slice(i), l.slice(1);
}
function bF(e) {
  for (var t = "", r = 0, n, i = 0; i < e.length; r >= 65536 ? i += 2 : i++)
    r = pa(e, i), n = gt[r], !n && Ha(r) ? (t += e[i], r >= 65536 && (t += e[i + 1])) : t += n || cF(r);
  return t;
}
function wF(e, t, r) {
  var n = "", i = e.tag, a, o, s;
  for (a = 0, o = r.length; a < o; a += 1)
    s = r[a], e.replacer && (s = e.replacer.call(r, String(a), s)), (Ur(e, t, s, !1, !1) || typeof s > "u" && Ur(e, t, null, !1, !1)) && (n !== "" && (n += "," + (e.condenseFlow ? "" : " ")), n += e.dump);
  e.tag = i, e.dump = "[" + n + "]";
}
function hd(e, t, r, n) {
  var i = "", a = e.tag, o, s, l;
  for (o = 0, s = r.length; o < s; o += 1)
    l = r[o], e.replacer && (l = e.replacer.call(r, String(o), l)), (Ur(e, t + 1, l, !0, !0, !1, !0) || typeof l > "u" && Ur(e, t + 1, null, !0, !0, !1, !0)) && ((!n || i !== "") && (i += gc(e, t)), e.dump && qa === e.dump.charCodeAt(0) ? i += "-" : i += "- ", i += e.dump);
  e.tag = a, e.dump = i || "[]";
}
function xF(e, t, r) {
  var n = "", i = e.tag, a = Object.keys(r), o, s, l, u, c;
  for (o = 0, s = a.length; o < s; o += 1)
    c = "", n !== "" && (c += ", "), e.condenseFlow && (c += '"'), l = a[o], u = r[l], e.replacer && (u = e.replacer.call(r, l, u)), Ur(e, t, l, !1, !1) && (e.dump.length > 1024 && (c += "? "), c += e.dump + (e.condenseFlow ? '"' : "") + ":" + (e.condenseFlow ? "" : " "), Ur(e, t, u, !1, !1) && (c += e.dump, n += c));
  e.tag = i, e.dump = "{" + n + "}";
}
function EF(e, t, r, n) {
  var i = "", a = e.tag, o = Object.keys(r), s, l, u, c, f, h;
  if (e.sortKeys === !0)
    o.sort();
  else if (typeof e.sortKeys == "function")
    o.sort(e.sortKeys);
  else if (e.sortKeys)
    throw new vo("sortKeys must be a boolean or a function");
  for (s = 0, l = o.length; s < l; s += 1)
    h = "", (!n || i !== "") && (h += gc(e, t)), u = o[s], c = r[u], e.replacer && (c = e.replacer.call(r, u, c)), Ur(e, t + 1, u, !0, !0, !0) && (f = e.tag !== null && e.tag !== "?" || e.dump && e.dump.length > 1024, f && (e.dump && qa === e.dump.charCodeAt(0) ? h += "?" : h += "? "), h += e.dump, f && (h += gc(e, t)), Ur(e, t + 1, c, !0, f) && (e.dump && qa === e.dump.charCodeAt(0) ? h += ":" : h += ": ", h += e.dump, i += h));
  e.tag = a, e.dump = i || "{}";
}
function dd(e, t, r) {
  var n, i, a, o, s, l;
  for (i = r ? e.explicitTypes : e.implicitTypes, a = 0, o = i.length; a < o; a += 1)
    if (s = i[a], (s.instanceOf || s.predicate) && (!s.instanceOf || typeof t == "object" && t instanceof s.instanceOf) && (!s.predicate || s.predicate(t))) {
      if (r ? s.multi && s.representName ? e.tag = s.representName(t) : e.tag = s.tag : e.tag = "?", s.represent) {
        if (l = e.styleMap[s.tag] || s.defaultStyle, yg.call(s.represent) === "[object Function]")
          n = s.represent(t, l);
        else if (bg.call(s.represent, l))
          n = s.represent[l](t, l);
        else
          throw new vo("!<" + s.tag + '> tag resolver accepts not "' + l + '" style');
        e.dump = n;
      }
      return !0;
    }
  return !1;
}
function Ur(e, t, r, n, i, a, o) {
  e.tag = null, e.dump = r, dd(e, r, !1) || dd(e, r, !0);
  var s = yg.call(e.dump), l = n, u;
  n && (n = e.flowLevel < 0 || e.flowLevel > t);
  var c = s === "[object Object]" || s === "[object Array]", f, h;
  if (c && (f = e.duplicates.indexOf(r), h = f !== -1), (e.tag !== null && e.tag !== "?" || h || e.indent !== 2 && t > 0) && (i = !1), h && e.usedDuplicates[f])
    e.dump = "*ref_" + f;
  else {
    if (c && h && !e.usedDuplicates[f] && (e.usedDuplicates[f] = !0), s === "[object Object]")
      n && Object.keys(e.dump).length !== 0 ? (EF(e, t, e.dump, i), h && (e.dump = "&ref_" + f + e.dump)) : (xF(e, t, e.dump), h && (e.dump = "&ref_" + f + " " + e.dump));
    else if (s === "[object Array]")
      n && e.dump.length !== 0 ? (e.noArrayIndent && !o && t > 0 ? hd(e, t - 1, e.dump, i) : hd(e, t, e.dump, i), h && (e.dump = "&ref_" + f + e.dump)) : (wF(e, t, e.dump), h && (e.dump = "&ref_" + f + " " + e.dump));
    else if (s === "[object String]")
      e.tag !== "?" && mF(e, e.dump, t, a, l);
    else {
      if (s === "[object Undefined]")
        return !1;
      if (e.skipInvalid) return !1;
      throw new vo("unacceptable kind of an object to dump " + s);
    }
    e.tag !== null && e.tag !== "?" && (u = encodeURI(
      e.tag[0] === "!" ? e.tag.slice(1) : e.tag
    ).replace(/!/g, "%21"), e.tag[0] === "!" ? u = "!" + u : u.slice(0, 18) === "tag:yaml.org,2002:" ? u = "!!" + u.slice(18) : u = "!<" + u + ">", e.dump = u + " " + e.dump);
  }
  return !0;
}
function SF(e, t) {
  var r = [], n = [], i, a;
  for (yc(e, r, n), i = 0, a = n.length; i < a; i += 1)
    t.duplicates.push(r[n[i]]);
  t.usedDuplicates = new Array(a);
}
function yc(e, t, r) {
  var n, i, a;
  if (e !== null && typeof e == "object")
    if (i = t.indexOf(e), i !== -1)
      r.indexOf(i) === -1 && r.push(i);
    else if (t.push(e), Array.isArray(e))
      for (i = 0, a = e.length; i < a; i += 1)
        yc(e[i], t, r);
    else
      for (n = Object.keys(e), i = 0, a = n.length; i < a; i += 1)
        yc(e[n[i]], t, r);
}
function FF(e, t) {
  t = t || {};
  var r = new hF(t);
  r.noRefs || SF(e, r);
  var n = e;
  return r.replacer && (n = r.replacer.call({ "": n }, "", n)), Ur(r, 0, n, !0, !0) ? r.dump + `
` : "";
}
mg.dump = FF;
var Rg = of, TF = mg;
function hf(e, t) {
  return function() {
    throw new Error("Function yaml." + e + " is removed in js-yaml 4. Use yaml." + t + " instead, which is now safe by default.");
  };
}
ft.Type = Pt;
ft.Schema = zv;
ft.FAILSAFE_SCHEMA = Wv;
ft.JSON_SCHEMA = Jv;
ft.CORE_SCHEMA = Qv;
ft.DEFAULT_SCHEMA = lf;
ft.load = Rg.load;
ft.loadAll = Rg.loadAll;
ft.dump = TF.dump;
ft.YAMLException = po;
ft.types = {
  binary: ng,
  float: Zv,
  map: Hv,
  null: Gv,
  pairs: ag,
  set: og,
  timestamp: tg,
  bool: Kv,
  int: Xv,
  merge: rg,
  omap: ig,
  seq: Vv,
  str: qv
};
ft.safeLoad = hf("safeLoad", "load");
ft.safeLoadAll = hf("safeLoadAll", "loadAll");
ft.safeDump = hf("safeDump", "dump");
var bl = {};
Object.defineProperty(bl, "__esModule", { value: !0 });
bl.Lazy = void 0;
class CF {
  constructor(t) {
    this._value = null, this.creator = t;
  }
  get hasValue() {
    return this.creator == null;
  }
  get value() {
    if (this.creator == null)
      return this._value;
    const t = this.creator();
    return this.value = t, t;
  }
  set value(t) {
    this._value = t, this.creator = null;
  }
}
bl.Lazy = CF;
var bc = { exports: {} };
const AF = "2.0.0", Og = 256, PF = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
9007199254740991, RF = 16, OF = Og - 6, DF = [
  "major",
  "premajor",
  "minor",
  "preminor",
  "patch",
  "prepatch",
  "prerelease"
];
var wl = {
  MAX_LENGTH: Og,
  MAX_SAFE_COMPONENT_LENGTH: RF,
  MAX_SAFE_BUILD_LENGTH: OF,
  MAX_SAFE_INTEGER: PF,
  RELEASE_TYPES: DF,
  SEMVER_SPEC_VERSION: AF,
  FLAG_INCLUDE_PRERELEASE: 1,
  FLAG_LOOSE: 2
};
const kF = typeof process == "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...e) => console.error("SEMVER", ...e) : () => {
};
var xl = kF;
(function(e, t) {
  const {
    MAX_SAFE_COMPONENT_LENGTH: r,
    MAX_SAFE_BUILD_LENGTH: n,
    MAX_LENGTH: i
  } = wl, a = xl;
  t = e.exports = {};
  const o = t.re = [], s = t.safeRe = [], l = t.src = [], u = t.safeSrc = [], c = t.t = {};
  let f = 0;
  const h = "[a-zA-Z0-9-]", d = [
    ["\\s", 1],
    ["\\d", i],
    [h, n]
  ], p = (y) => {
    for (const [m, S] of d)
      y = y.split(`${m}*`).join(`${m}{0,${S}}`).split(`${m}+`).join(`${m}{1,${S}}`);
    return y;
  }, v = (y, m, S) => {
    const T = p(m), C = f++;
    a(y, C, m), c[y] = C, l[C] = m, u[C] = T, o[C] = new RegExp(m, S ? "g" : void 0), s[C] = new RegExp(T, S ? "g" : void 0);
  };
  v("NUMERICIDENTIFIER", "0|[1-9]\\d*"), v("NUMERICIDENTIFIERLOOSE", "\\d+"), v("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${h}*`), v("MAINVERSION", `(${l[c.NUMERICIDENTIFIER]})\\.(${l[c.NUMERICIDENTIFIER]})\\.(${l[c.NUMERICIDENTIFIER]})`), v("MAINVERSIONLOOSE", `(${l[c.NUMERICIDENTIFIERLOOSE]})\\.(${l[c.NUMERICIDENTIFIERLOOSE]})\\.(${l[c.NUMERICIDENTIFIERLOOSE]})`), v("PRERELEASEIDENTIFIER", `(?:${l[c.NONNUMERICIDENTIFIER]}|${l[c.NUMERICIDENTIFIER]})`), v("PRERELEASEIDENTIFIERLOOSE", `(?:${l[c.NONNUMERICIDENTIFIER]}|${l[c.NUMERICIDENTIFIERLOOSE]})`), v("PRERELEASE", `(?:-(${l[c.PRERELEASEIDENTIFIER]}(?:\\.${l[c.PRERELEASEIDENTIFIER]})*))`), v("PRERELEASELOOSE", `(?:-?(${l[c.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${l[c.PRERELEASEIDENTIFIERLOOSE]})*))`), v("BUILDIDENTIFIER", `${h}+`), v("BUILD", `(?:\\+(${l[c.BUILDIDENTIFIER]}(?:\\.${l[c.BUILDIDENTIFIER]})*))`), v("FULLPLAIN", `v?${l[c.MAINVERSION]}${l[c.PRERELEASE]}?${l[c.BUILD]}?`), v("FULL", `^${l[c.FULLPLAIN]}$`), v("LOOSEPLAIN", `[v=\\s]*${l[c.MAINVERSIONLOOSE]}${l[c.PRERELEASELOOSE]}?${l[c.BUILD]}?`), v("LOOSE", `^${l[c.LOOSEPLAIN]}$`), v("GTLT", "((?:<|>)?=?)"), v("XRANGEIDENTIFIERLOOSE", `${l[c.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`), v("XRANGEIDENTIFIER", `${l[c.NUMERICIDENTIFIER]}|x|X|\\*`), v("XRANGEPLAIN", `[v=\\s]*(${l[c.XRANGEIDENTIFIER]})(?:\\.(${l[c.XRANGEIDENTIFIER]})(?:\\.(${l[c.XRANGEIDENTIFIER]})(?:${l[c.PRERELEASE]})?${l[c.BUILD]}?)?)?`), v("XRANGEPLAINLOOSE", `[v=\\s]*(${l[c.XRANGEIDENTIFIERLOOSE]})(?:\\.(${l[c.XRANGEIDENTIFIERLOOSE]})(?:\\.(${l[c.XRANGEIDENTIFIERLOOSE]})(?:${l[c.PRERELEASELOOSE]})?${l[c.BUILD]}?)?)?`), v("XRANGE", `^${l[c.GTLT]}\\s*${l[c.XRANGEPLAIN]}$`), v("XRANGELOOSE", `^${l[c.GTLT]}\\s*${l[c.XRANGEPLAINLOOSE]}$`), v("COERCEPLAIN", `(^|[^\\d])(\\d{1,${r}})(?:\\.(\\d{1,${r}}))?(?:\\.(\\d{1,${r}}))?`), v("COERCE", `${l[c.COERCEPLAIN]}(?:$|[^\\d])`), v("COERCEFULL", l[c.COERCEPLAIN] + `(?:${l[c.PRERELEASE]})?(?:${l[c.BUILD]})?(?:$|[^\\d])`), v("COERCERTL", l[c.COERCE], !0), v("COERCERTLFULL", l[c.COERCEFULL], !0), v("LONETILDE", "(?:~>?)"), v("TILDETRIM", `(\\s*)${l[c.LONETILDE]}\\s+`, !0), t.tildeTrimReplace = "$1~", v("TILDE", `^${l[c.LONETILDE]}${l[c.XRANGEPLAIN]}$`), v("TILDELOOSE", `^${l[c.LONETILDE]}${l[c.XRANGEPLAINLOOSE]}$`), v("LONECARET", "(?:\\^)"), v("CARETTRIM", `(\\s*)${l[c.LONECARET]}\\s+`, !0), t.caretTrimReplace = "$1^", v("CARET", `^${l[c.LONECARET]}${l[c.XRANGEPLAIN]}$`), v("CARETLOOSE", `^${l[c.LONECARET]}${l[c.XRANGEPLAINLOOSE]}$`), v("COMPARATORLOOSE", `^${l[c.GTLT]}\\s*(${l[c.LOOSEPLAIN]})$|^$`), v("COMPARATOR", `^${l[c.GTLT]}\\s*(${l[c.FULLPLAIN]})$|^$`), v("COMPARATORTRIM", `(\\s*)${l[c.GTLT]}\\s*(${l[c.LOOSEPLAIN]}|${l[c.XRANGEPLAIN]})`, !0), t.comparatorTrimReplace = "$1$2$3", v("HYPHENRANGE", `^\\s*(${l[c.XRANGEPLAIN]})\\s+-\\s+(${l[c.XRANGEPLAIN]})\\s*$`), v("HYPHENRANGELOOSE", `^\\s*(${l[c.XRANGEPLAINLOOSE]})\\s+-\\s+(${l[c.XRANGEPLAINLOOSE]})\\s*$`), v("STAR", "(<|>)?=?\\s*\\*"), v("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$"), v("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
})(bc, bc.exports);
var go = bc.exports;
const NF = Object.freeze({ loose: !0 }), IF = Object.freeze({}), UF = (e) => e ? typeof e != "object" ? NF : e : IF;
var df = UF;
const pd = /^[0-9]+$/, Dg = (e, t) => {
  if (typeof e == "number" && typeof t == "number")
    return e === t ? 0 : e < t ? -1 : 1;
  const r = pd.test(e), n = pd.test(t);
  return r && n && (e = +e, t = +t), e === t ? 0 : r && !n ? -1 : n && !r ? 1 : e < t ? -1 : 1;
}, LF = (e, t) => Dg(t, e);
var kg = {
  compareIdentifiers: Dg,
  rcompareIdentifiers: LF
};
const Xo = xl, { MAX_LENGTH: vd, MAX_SAFE_INTEGER: Yo } = wl, { safeRe: Zo, t: Jo } = go, BF = df, { compareIdentifiers: xu } = kg;
let MF = class br {
  constructor(t, r) {
    if (r = BF(r), t instanceof br) {
      if (t.loose === !!r.loose && t.includePrerelease === !!r.includePrerelease)
        return t;
      t = t.version;
    } else if (typeof t != "string")
      throw new TypeError(`Invalid version. Must be a string. Got type "${typeof t}".`);
    if (t.length > vd)
      throw new TypeError(
        `version is longer than ${vd} characters`
      );
    Xo("SemVer", t, r), this.options = r, this.loose = !!r.loose, this.includePrerelease = !!r.includePrerelease;
    const n = t.trim().match(r.loose ? Zo[Jo.LOOSE] : Zo[Jo.FULL]);
    if (!n)
      throw new TypeError(`Invalid Version: ${t}`);
    if (this.raw = t, this.major = +n[1], this.minor = +n[2], this.patch = +n[3], this.major > Yo || this.major < 0)
      throw new TypeError("Invalid major version");
    if (this.minor > Yo || this.minor < 0)
      throw new TypeError("Invalid minor version");
    if (this.patch > Yo || this.patch < 0)
      throw new TypeError("Invalid patch version");
    n[4] ? this.prerelease = n[4].split(".").map((i) => {
      if (/^[0-9]+$/.test(i)) {
        const a = +i;
        if (a >= 0 && a < Yo)
          return a;
      }
      return i;
    }) : this.prerelease = [], this.build = n[5] ? n[5].split(".") : [], this.format();
  }
  format() {
    return this.version = `${this.major}.${this.minor}.${this.patch}`, this.prerelease.length && (this.version += `-${this.prerelease.join(".")}`), this.version;
  }
  toString() {
    return this.version;
  }
  compare(t) {
    if (Xo("SemVer.compare", this.version, this.options, t), !(t instanceof br)) {
      if (typeof t == "string" && t === this.version)
        return 0;
      t = new br(t, this.options);
    }
    return t.version === this.version ? 0 : this.compareMain(t) || this.comparePre(t);
  }
  compareMain(t) {
    return t instanceof br || (t = new br(t, this.options)), this.major < t.major ? -1 : this.major > t.major ? 1 : this.minor < t.minor ? -1 : this.minor > t.minor ? 1 : this.patch < t.patch ? -1 : this.patch > t.patch ? 1 : 0;
  }
  comparePre(t) {
    if (t instanceof br || (t = new br(t, this.options)), this.prerelease.length && !t.prerelease.length)
      return -1;
    if (!this.prerelease.length && t.prerelease.length)
      return 1;
    if (!this.prerelease.length && !t.prerelease.length)
      return 0;
    let r = 0;
    do {
      const n = this.prerelease[r], i = t.prerelease[r];
      if (Xo("prerelease compare", r, n, i), n === void 0 && i === void 0)
        return 0;
      if (i === void 0)
        return 1;
      if (n === void 0)
        return -1;
      if (n === i)
        continue;
      return xu(n, i);
    } while (++r);
  }
  compareBuild(t) {
    t instanceof br || (t = new br(t, this.options));
    let r = 0;
    do {
      const n = this.build[r], i = t.build[r];
      if (Xo("build compare", r, n, i), n === void 0 && i === void 0)
        return 0;
      if (i === void 0)
        return 1;
      if (n === void 0)
        return -1;
      if (n === i)
        continue;
      return xu(n, i);
    } while (++r);
  }
  // preminor will bump the version up to the next minor release, and immediately
  // down to pre-release. premajor and prepatch work the same way.
  inc(t, r, n) {
    if (t.startsWith("pre")) {
      if (!r && n === !1)
        throw new Error("invalid increment argument: identifier is empty");
      if (r) {
        const i = `-${r}`.match(this.options.loose ? Zo[Jo.PRERELEASELOOSE] : Zo[Jo.PRERELEASE]);
        if (!i || i[1] !== r)
          throw new Error(`invalid identifier: ${r}`);
      }
    }
    switch (t) {
      case "premajor":
        this.prerelease.length = 0, this.patch = 0, this.minor = 0, this.major++, this.inc("pre", r, n);
        break;
      case "preminor":
        this.prerelease.length = 0, this.patch = 0, this.minor++, this.inc("pre", r, n);
        break;
      case "prepatch":
        this.prerelease.length = 0, this.inc("patch", r, n), this.inc("pre", r, n);
        break;
      case "prerelease":
        this.prerelease.length === 0 && this.inc("patch", r, n), this.inc("pre", r, n);
        break;
      case "release":
        if (this.prerelease.length === 0)
          throw new Error(`version ${this.raw} is not a prerelease`);
        this.prerelease.length = 0;
        break;
      case "major":
        (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) && this.major++, this.minor = 0, this.patch = 0, this.prerelease = [];
        break;
      case "minor":
        (this.patch !== 0 || this.prerelease.length === 0) && this.minor++, this.patch = 0, this.prerelease = [];
        break;
      case "patch":
        this.prerelease.length === 0 && this.patch++, this.prerelease = [];
        break;
      case "pre": {
        const i = Number(n) ? 1 : 0;
        if (this.prerelease.length === 0)
          this.prerelease = [i];
        else {
          let a = this.prerelease.length;
          for (; --a >= 0; )
            typeof this.prerelease[a] == "number" && (this.prerelease[a]++, a = -2);
          if (a === -1) {
            if (r === this.prerelease.join(".") && n === !1)
              throw new Error("invalid increment argument: identifier already exists");
            this.prerelease.push(i);
          }
        }
        if (r) {
          let a = [r, i];
          n === !1 && (a = [r]), xu(this.prerelease[0], r) === 0 ? isNaN(this.prerelease[1]) && (this.prerelease = a) : this.prerelease = a;
        }
        break;
      }
      default:
        throw new Error(`invalid increment argument: ${t}`);
    }
    return this.raw = this.format(), this.build.length && (this.raw += `+${this.build.join(".")}`), this;
  }
};
var Rt = MF;
const gd = Rt, jF = (e, t, r = !1) => {
  if (e instanceof gd)
    return e;
  try {
    return new gd(e, t);
  } catch (n) {
    if (!r)
      return null;
    throw n;
  }
};
var _i = jF;
const _F = _i, zF = (e, t) => {
  const r = _F(e, t);
  return r ? r.version : null;
};
var qF = zF;
const VF = _i, HF = (e, t) => {
  const r = VF(e.trim().replace(/^[=v]+/, ""), t);
  return r ? r.version : null;
};
var WF = HF;
const md = Rt, GF = (e, t, r, n, i) => {
  typeof r == "string" && (i = n, n = r, r = void 0);
  try {
    return new md(
      e instanceof md ? e.version : e,
      r
    ).inc(t, n, i).version;
  } catch {
    return null;
  }
};
var KF = GF;
const yd = _i, XF = (e, t) => {
  const r = yd(e, null, !0), n = yd(t, null, !0), i = r.compare(n);
  if (i === 0)
    return null;
  const a = i > 0, o = a ? r : n, s = a ? n : r, l = !!o.prerelease.length;
  if (!!s.prerelease.length && !l) {
    if (!s.patch && !s.minor)
      return "major";
    if (s.compareMain(o) === 0)
      return s.minor && !s.patch ? "minor" : "patch";
  }
  const c = l ? "pre" : "";
  return r.major !== n.major ? c + "major" : r.minor !== n.minor ? c + "minor" : r.patch !== n.patch ? c + "patch" : "prerelease";
};
var YF = XF;
const ZF = Rt, JF = (e, t) => new ZF(e, t).major;
var QF = JF;
const $F = Rt, eT = (e, t) => new $F(e, t).minor;
var tT = eT;
const rT = Rt, nT = (e, t) => new rT(e, t).patch;
var iT = nT;
const aT = _i, oT = (e, t) => {
  const r = aT(e, t);
  return r && r.prerelease.length ? r.prerelease : null;
};
var sT = oT;
const bd = Rt, lT = (e, t, r) => new bd(e, r).compare(new bd(t, r));
var fr = lT;
const uT = fr, cT = (e, t, r) => uT(t, e, r);
var fT = cT;
const hT = fr, dT = (e, t) => hT(e, t, !0);
var pT = dT;
const wd = Rt, vT = (e, t, r) => {
  const n = new wd(e, r), i = new wd(t, r);
  return n.compare(i) || n.compareBuild(i);
};
var pf = vT;
const gT = pf, mT = (e, t) => e.sort((r, n) => gT(r, n, t));
var yT = mT;
const bT = pf, wT = (e, t) => e.sort((r, n) => bT(n, r, t));
var xT = wT;
const ET = fr, ST = (e, t, r) => ET(e, t, r) > 0;
var El = ST;
const FT = fr, TT = (e, t, r) => FT(e, t, r) < 0;
var vf = TT;
const CT = fr, AT = (e, t, r) => CT(e, t, r) === 0;
var Ng = AT;
const PT = fr, RT = (e, t, r) => PT(e, t, r) !== 0;
var Ig = RT;
const OT = fr, DT = (e, t, r) => OT(e, t, r) >= 0;
var gf = DT;
const kT = fr, NT = (e, t, r) => kT(e, t, r) <= 0;
var mf = NT;
const IT = Ng, UT = Ig, LT = El, BT = gf, MT = vf, jT = mf, _T = (e, t, r, n) => {
  switch (t) {
    case "===":
      return typeof e == "object" && (e = e.version), typeof r == "object" && (r = r.version), e === r;
    case "!==":
      return typeof e == "object" && (e = e.version), typeof r == "object" && (r = r.version), e !== r;
    case "":
    case "=":
    case "==":
      return IT(e, r, n);
    case "!=":
      return UT(e, r, n);
    case ">":
      return LT(e, r, n);
    case ">=":
      return BT(e, r, n);
    case "<":
      return MT(e, r, n);
    case "<=":
      return jT(e, r, n);
    default:
      throw new TypeError(`Invalid operator: ${t}`);
  }
};
var Ug = _T;
const zT = Rt, qT = _i, { safeRe: Qo, t: $o } = go, VT = (e, t) => {
  if (e instanceof zT)
    return e;
  if (typeof e == "number" && (e = String(e)), typeof e != "string")
    return null;
  t = t || {};
  let r = null;
  if (!t.rtl)
    r = e.match(t.includePrerelease ? Qo[$o.COERCEFULL] : Qo[$o.COERCE]);
  else {
    const l = t.includePrerelease ? Qo[$o.COERCERTLFULL] : Qo[$o.COERCERTL];
    let u;
    for (; (u = l.exec(e)) && (!r || r.index + r[0].length !== e.length); )
      (!r || u.index + u[0].length !== r.index + r[0].length) && (r = u), l.lastIndex = u.index + u[1].length + u[2].length;
    l.lastIndex = -1;
  }
  if (r === null)
    return null;
  const n = r[2], i = r[3] || "0", a = r[4] || "0", o = t.includePrerelease && r[5] ? `-${r[5]}` : "", s = t.includePrerelease && r[6] ? `+${r[6]}` : "";
  return qT(`${n}.${i}.${a}${o}${s}`, t);
};
var HT = VT;
class WT {
  constructor() {
    this.max = 1e3, this.map = /* @__PURE__ */ new Map();
  }
  get(t) {
    const r = this.map.get(t);
    if (r !== void 0)
      return this.map.delete(t), this.map.set(t, r), r;
  }
  delete(t) {
    return this.map.delete(t);
  }
  set(t, r) {
    if (!this.delete(t) && r !== void 0) {
      if (this.map.size >= this.max) {
        const i = this.map.keys().next().value;
        this.delete(i);
      }
      this.map.set(t, r);
    }
    return this;
  }
}
var GT = WT, Eu, xd;
function hr() {
  if (xd) return Eu;
  xd = 1;
  const e = /\s+/g;
  class t {
    constructor(N, L) {
      if (L = i(L), N instanceof t)
        return N.loose === !!L.loose && N.includePrerelease === !!L.includePrerelease ? N : new t(N.raw, L);
      if (N instanceof a)
        return this.raw = N.value, this.set = [[N]], this.formatted = void 0, this;
      if (this.options = L, this.loose = !!L.loose, this.includePrerelease = !!L.includePrerelease, this.raw = N.trim().replace(e, " "), this.set = this.raw.split("||").map((U) => this.parseRange(U.trim())).filter((U) => U.length), !this.set.length)
        throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
      if (this.set.length > 1) {
        const U = this.set[0];
        if (this.set = this.set.filter((X) => !v(X[0])), this.set.length === 0)
          this.set = [U];
        else if (this.set.length > 1) {
          for (const X of this.set)
            if (X.length === 1 && y(X[0])) {
              this.set = [X];
              break;
            }
        }
      }
      this.formatted = void 0;
    }
    get range() {
      if (this.formatted === void 0) {
        this.formatted = "";
        for (let N = 0; N < this.set.length; N++) {
          N > 0 && (this.formatted += "||");
          const L = this.set[N];
          for (let U = 0; U < L.length; U++)
            U > 0 && (this.formatted += " "), this.formatted += L[U].toString().trim();
        }
      }
      return this.formatted;
    }
    format() {
      return this.range;
    }
    toString() {
      return this.range;
    }
    parseRange(N) {
      const U = ((this.options.includePrerelease && d) | (this.options.loose && p)) + ":" + N, X = n.get(U);
      if (X)
        return X;
      const W = this.options.loose, Q = W ? l[u.HYPHENRANGELOOSE] : l[u.HYPHENRANGE];
      N = N.replace(Q, q(this.options.includePrerelease)), o("hyphen replace", N), N = N.replace(l[u.COMPARATORTRIM], c), o("comparator trim", N), N = N.replace(l[u.TILDETRIM], f), o("tilde trim", N), N = N.replace(l[u.CARETTRIM], h), o("caret trim", N);
      let re = N.split(" ").map((te) => S(te, this.options)).join(" ").split(/\s+/).map((te) => I(te, this.options));
      W && (re = re.filter((te) => (o("loose invalid filter", te, this.options), !!te.match(l[u.COMPARATORLOOSE])))), o("range list", re);
      const ee = /* @__PURE__ */ new Map(), Te = re.map((te) => new a(te, this.options));
      for (const te of Te) {
        if (v(te))
          return [te];
        ee.set(te.value, te);
      }
      ee.size > 1 && ee.has("") && ee.delete("");
      const De = [...ee.values()];
      return n.set(U, De), De;
    }
    intersects(N, L) {
      if (!(N instanceof t))
        throw new TypeError("a Range is required");
      return this.set.some((U) => m(U, L) && N.set.some((X) => m(X, L) && U.every((W) => X.every((Q) => W.intersects(Q, L)))));
    }
    // if ANY of the sets match ALL of its comparators, then pass
    test(N) {
      if (!N)
        return !1;
      if (typeof N == "string")
        try {
          N = new s(N, this.options);
        } catch {
          return !1;
        }
      for (let L = 0; L < this.set.length; L++)
        if (z(this.set[L], N, this.options))
          return !0;
      return !1;
    }
  }
  Eu = t;
  const r = GT, n = new r(), i = df, a = Sl(), o = xl, s = Rt, {
    safeRe: l,
    t: u,
    comparatorTrimReplace: c,
    tildeTrimReplace: f,
    caretTrimReplace: h
  } = go, { FLAG_INCLUDE_PRERELEASE: d, FLAG_LOOSE: p } = wl, v = (B) => B.value === "<0.0.0-0", y = (B) => B.value === "", m = (B, N) => {
    let L = !0;
    const U = B.slice();
    let X = U.pop();
    for (; L && U.length; )
      L = U.every((W) => X.intersects(W, N)), X = U.pop();
    return L;
  }, S = (B, N) => (B = B.replace(l[u.BUILD], ""), o("comp", B, N), B = O(B, N), o("caret", B), B = C(B, N), o("tildes", B), B = M(B, N), o("xrange", B), B = j(B, N), o("stars", B), B), T = (B) => !B || B.toLowerCase() === "x" || B === "*", C = (B, N) => B.trim().split(/\s+/).map((L) => A(L, N)).join(" "), A = (B, N) => {
    const L = N.loose ? l[u.TILDELOOSE] : l[u.TILDE];
    return B.replace(L, (U, X, W, Q, re) => {
      o("tilde", B, U, X, W, Q, re);
      let ee;
      return T(X) ? ee = "" : T(W) ? ee = `>=${X}.0.0 <${+X + 1}.0.0-0` : T(Q) ? ee = `>=${X}.${W}.0 <${X}.${+W + 1}.0-0` : re ? (o("replaceTilde pr", re), ee = `>=${X}.${W}.${Q}-${re} <${X}.${+W + 1}.0-0`) : ee = `>=${X}.${W}.${Q} <${X}.${+W + 1}.0-0`, o("tilde return", ee), ee;
    });
  }, O = (B, N) => B.trim().split(/\s+/).map((L) => k(L, N)).join(" "), k = (B, N) => {
    o("caret", B, N);
    const L = N.loose ? l[u.CARETLOOSE] : l[u.CARET], U = N.includePrerelease ? "-0" : "";
    return B.replace(L, (X, W, Q, re, ee) => {
      o("caret", B, X, W, Q, re, ee);
      let Te;
      return T(W) ? Te = "" : T(Q) ? Te = `>=${W}.0.0${U} <${+W + 1}.0.0-0` : T(re) ? W === "0" ? Te = `>=${W}.${Q}.0${U} <${W}.${+Q + 1}.0-0` : Te = `>=${W}.${Q}.0${U} <${+W + 1}.0.0-0` : ee ? (o("replaceCaret pr", ee), W === "0" ? Q === "0" ? Te = `>=${W}.${Q}.${re}-${ee} <${W}.${Q}.${+re + 1}-0` : Te = `>=${W}.${Q}.${re}-${ee} <${W}.${+Q + 1}.0-0` : Te = `>=${W}.${Q}.${re}-${ee} <${+W + 1}.0.0-0`) : (o("no pr"), W === "0" ? Q === "0" ? Te = `>=${W}.${Q}.${re}${U} <${W}.${Q}.${+re + 1}-0` : Te = `>=${W}.${Q}.${re}${U} <${W}.${+Q + 1}.0-0` : Te = `>=${W}.${Q}.${re} <${+W + 1}.0.0-0`), o("caret return", Te), Te;
    });
  }, M = (B, N) => (o("replaceXRanges", B, N), B.split(/\s+/).map((L) => b(L, N)).join(" ")), b = (B, N) => {
    B = B.trim();
    const L = N.loose ? l[u.XRANGELOOSE] : l[u.XRANGE];
    return B.replace(L, (U, X, W, Q, re, ee) => {
      o("xRange", B, U, X, W, Q, re, ee);
      const Te = T(W), De = Te || T(Q), te = De || T(re), mt = te;
      return X === "=" && mt && (X = ""), ee = N.includePrerelease ? "-0" : "", Te ? X === ">" || X === "<" ? U = "<0.0.0-0" : U = "*" : X && mt ? (De && (Q = 0), re = 0, X === ">" ? (X = ">=", De ? (W = +W + 1, Q = 0, re = 0) : (Q = +Q + 1, re = 0)) : X === "<=" && (X = "<", De ? W = +W + 1 : Q = +Q + 1), X === "<" && (ee = "-0"), U = `${X + W}.${Q}.${re}${ee}`) : De ? U = `>=${W}.0.0${ee} <${+W + 1}.0.0-0` : te && (U = `>=${W}.${Q}.0${ee} <${W}.${+Q + 1}.0-0`), o("xRange return", U), U;
    });
  }, j = (B, N) => (o("replaceStars", B, N), B.trim().replace(l[u.STAR], "")), I = (B, N) => (o("replaceGTE0", B, N), B.trim().replace(l[N.includePrerelease ? u.GTE0PRE : u.GTE0], "")), q = (B) => (N, L, U, X, W, Q, re, ee, Te, De, te, mt) => (T(U) ? L = "" : T(X) ? L = `>=${U}.0.0${B ? "-0" : ""}` : T(W) ? L = `>=${U}.${X}.0${B ? "-0" : ""}` : Q ? L = `>=${L}` : L = `>=${L}${B ? "-0" : ""}`, T(Te) ? ee = "" : T(De) ? ee = `<${+Te + 1}.0.0-0` : T(te) ? ee = `<${Te}.${+De + 1}.0-0` : mt ? ee = `<=${Te}.${De}.${te}-${mt}` : B ? ee = `<${Te}.${De}.${+te + 1}-0` : ee = `<=${ee}`, `${L} ${ee}`.trim()), z = (B, N, L) => {
    for (let U = 0; U < B.length; U++)
      if (!B[U].test(N))
        return !1;
    if (N.prerelease.length && !L.includePrerelease) {
      for (let U = 0; U < B.length; U++)
        if (o(B[U].semver), B[U].semver !== a.ANY && B[U].semver.prerelease.length > 0) {
          const X = B[U].semver;
          if (X.major === N.major && X.minor === N.minor && X.patch === N.patch)
            return !0;
        }
      return !1;
    }
    return !0;
  };
  return Eu;
}
var Su, Ed;
function Sl() {
  if (Ed) return Su;
  Ed = 1;
  const e = Symbol("SemVer ANY");
  class t {
    static get ANY() {
      return e;
    }
    constructor(c, f) {
      if (f = r(f), c instanceof t) {
        if (c.loose === !!f.loose)
          return c;
        c = c.value;
      }
      c = c.trim().split(/\s+/).join(" "), o("comparator", c, f), this.options = f, this.loose = !!f.loose, this.parse(c), this.semver === e ? this.value = "" : this.value = this.operator + this.semver.version, o("comp", this);
    }
    parse(c) {
      const f = this.options.loose ? n[i.COMPARATORLOOSE] : n[i.COMPARATOR], h = c.match(f);
      if (!h)
        throw new TypeError(`Invalid comparator: ${c}`);
      this.operator = h[1] !== void 0 ? h[1] : "", this.operator === "=" && (this.operator = ""), h[2] ? this.semver = new s(h[2], this.options.loose) : this.semver = e;
    }
    toString() {
      return this.value;
    }
    test(c) {
      if (o("Comparator.test", c, this.options.loose), this.semver === e || c === e)
        return !0;
      if (typeof c == "string")
        try {
          c = new s(c, this.options);
        } catch {
          return !1;
        }
      return a(c, this.operator, this.semver, this.options);
    }
    intersects(c, f) {
      if (!(c instanceof t))
        throw new TypeError("a Comparator is required");
      return this.operator === "" ? this.value === "" ? !0 : new l(c.value, f).test(this.value) : c.operator === "" ? c.value === "" ? !0 : new l(this.value, f).test(c.semver) : (f = r(f), f.includePrerelease && (this.value === "<0.0.0-0" || c.value === "<0.0.0-0") || !f.includePrerelease && (this.value.startsWith("<0.0.0") || c.value.startsWith("<0.0.0")) ? !1 : !!(this.operator.startsWith(">") && c.operator.startsWith(">") || this.operator.startsWith("<") && c.operator.startsWith("<") || this.semver.version === c.semver.version && this.operator.includes("=") && c.operator.includes("=") || a(this.semver, "<", c.semver, f) && this.operator.startsWith(">") && c.operator.startsWith("<") || a(this.semver, ">", c.semver, f) && this.operator.startsWith("<") && c.operator.startsWith(">")));
    }
  }
  Su = t;
  const r = df, { safeRe: n, t: i } = go, a = Ug, o = xl, s = Rt, l = hr();
  return Su;
}
const KT = hr(), XT = (e, t, r) => {
  try {
    t = new KT(t, r);
  } catch {
    return !1;
  }
  return t.test(e);
};
var Fl = XT;
const YT = hr(), ZT = (e, t) => new YT(e, t).set.map((r) => r.map((n) => n.value).join(" ").trim().split(" "));
var JT = ZT;
const QT = Rt, $T = hr(), eC = (e, t, r) => {
  let n = null, i = null, a = null;
  try {
    a = new $T(t, r);
  } catch {
    return null;
  }
  return e.forEach((o) => {
    a.test(o) && (!n || i.compare(o) === -1) && (n = o, i = new QT(n, r));
  }), n;
};
var tC = eC;
const rC = Rt, nC = hr(), iC = (e, t, r) => {
  let n = null, i = null, a = null;
  try {
    a = new nC(t, r);
  } catch {
    return null;
  }
  return e.forEach((o) => {
    a.test(o) && (!n || i.compare(o) === 1) && (n = o, i = new rC(n, r));
  }), n;
};
var aC = iC;
const Fu = Rt, oC = hr(), Sd = El, sC = (e, t) => {
  e = new oC(e, t);
  let r = new Fu("0.0.0");
  if (e.test(r) || (r = new Fu("0.0.0-0"), e.test(r)))
    return r;
  r = null;
  for (let n = 0; n < e.set.length; ++n) {
    const i = e.set[n];
    let a = null;
    i.forEach((o) => {
      const s = new Fu(o.semver.version);
      switch (o.operator) {
        case ">":
          s.prerelease.length === 0 ? s.patch++ : s.prerelease.push(0), s.raw = s.format();
        case "":
        case ">=":
          (!a || Sd(s, a)) && (a = s);
          break;
        case "<":
        case "<=":
          break;
        default:
          throw new Error(`Unexpected operation: ${o.operator}`);
      }
    }), a && (!r || Sd(r, a)) && (r = a);
  }
  return r && e.test(r) ? r : null;
};
var lC = sC;
const uC = hr(), cC = (e, t) => {
  try {
    return new uC(e, t).range || "*";
  } catch {
    return null;
  }
};
var fC = cC;
const hC = Rt, Lg = Sl(), { ANY: dC } = Lg, pC = hr(), vC = Fl, Fd = El, Td = vf, gC = mf, mC = gf, yC = (e, t, r, n) => {
  e = new hC(e, n), t = new pC(t, n);
  let i, a, o, s, l;
  switch (r) {
    case ">":
      i = Fd, a = gC, o = Td, s = ">", l = ">=";
      break;
    case "<":
      i = Td, a = mC, o = Fd, s = "<", l = "<=";
      break;
    default:
      throw new TypeError('Must provide a hilo val of "<" or ">"');
  }
  if (vC(e, t, n))
    return !1;
  for (let u = 0; u < t.set.length; ++u) {
    const c = t.set[u];
    let f = null, h = null;
    if (c.forEach((d) => {
      d.semver === dC && (d = new Lg(">=0.0.0")), f = f || d, h = h || d, i(d.semver, f.semver, n) ? f = d : o(d.semver, h.semver, n) && (h = d);
    }), f.operator === s || f.operator === l || (!h.operator || h.operator === s) && a(e, h.semver))
      return !1;
    if (h.operator === l && o(e, h.semver))
      return !1;
  }
  return !0;
};
var yf = yC;
const bC = yf, wC = (e, t, r) => bC(e, t, ">", r);
var xC = wC;
const EC = yf, SC = (e, t, r) => EC(e, t, "<", r);
var FC = SC;
const Cd = hr(), TC = (e, t, r) => (e = new Cd(e, r), t = new Cd(t, r), e.intersects(t, r));
var CC = TC;
const AC = Fl, PC = fr;
var RC = (e, t, r) => {
  const n = [];
  let i = null, a = null;
  const o = e.sort((c, f) => PC(c, f, r));
  for (const c of o)
    AC(c, t, r) ? (a = c, i || (i = c)) : (a && n.push([i, a]), a = null, i = null);
  i && n.push([i, null]);
  const s = [];
  for (const [c, f] of n)
    c === f ? s.push(c) : !f && c === o[0] ? s.push("*") : f ? c === o[0] ? s.push(`<=${f}`) : s.push(`${c} - ${f}`) : s.push(`>=${c}`);
  const l = s.join(" || "), u = typeof t.raw == "string" ? t.raw : String(t);
  return l.length < u.length ? l : t;
};
const Ad = hr(), bf = Sl(), { ANY: Tu } = bf, ra = Fl, wf = fr, OC = (e, t, r = {}) => {
  if (e === t)
    return !0;
  e = new Ad(e, r), t = new Ad(t, r);
  let n = !1;
  e: for (const i of e.set) {
    for (const a of t.set) {
      const o = kC(i, a, r);
      if (n = n || o !== null, o)
        continue e;
    }
    if (n)
      return !1;
  }
  return !0;
}, DC = [new bf(">=0.0.0-0")], Pd = [new bf(">=0.0.0")], kC = (e, t, r) => {
  if (e === t)
    return !0;
  if (e.length === 1 && e[0].semver === Tu) {
    if (t.length === 1 && t[0].semver === Tu)
      return !0;
    r.includePrerelease ? e = DC : e = Pd;
  }
  if (t.length === 1 && t[0].semver === Tu) {
    if (r.includePrerelease)
      return !0;
    t = Pd;
  }
  const n = /* @__PURE__ */ new Set();
  let i, a;
  for (const d of e)
    d.operator === ">" || d.operator === ">=" ? i = Rd(i, d, r) : d.operator === "<" || d.operator === "<=" ? a = Od(a, d, r) : n.add(d.semver);
  if (n.size > 1)
    return null;
  let o;
  if (i && a) {
    if (o = wf(i.semver, a.semver, r), o > 0)
      return null;
    if (o === 0 && (i.operator !== ">=" || a.operator !== "<="))
      return null;
  }
  for (const d of n) {
    if (i && !ra(d, String(i), r) || a && !ra(d, String(a), r))
      return null;
    for (const p of t)
      if (!ra(d, String(p), r))
        return !1;
    return !0;
  }
  let s, l, u, c, f = a && !r.includePrerelease && a.semver.prerelease.length ? a.semver : !1, h = i && !r.includePrerelease && i.semver.prerelease.length ? i.semver : !1;
  f && f.prerelease.length === 1 && a.operator === "<" && f.prerelease[0] === 0 && (f = !1);
  for (const d of t) {
    if (c = c || d.operator === ">" || d.operator === ">=", u = u || d.operator === "<" || d.operator === "<=", i) {
      if (h && d.semver.prerelease && d.semver.prerelease.length && d.semver.major === h.major && d.semver.minor === h.minor && d.semver.patch === h.patch && (h = !1), d.operator === ">" || d.operator === ">=") {
        if (s = Rd(i, d, r), s === d && s !== i)
          return !1;
      } else if (i.operator === ">=" && !ra(i.semver, String(d), r))
        return !1;
    }
    if (a) {
      if (f && d.semver.prerelease && d.semver.prerelease.length && d.semver.major === f.major && d.semver.minor === f.minor && d.semver.patch === f.patch && (f = !1), d.operator === "<" || d.operator === "<=") {
        if (l = Od(a, d, r), l === d && l !== a)
          return !1;
      } else if (a.operator === "<=" && !ra(a.semver, String(d), r))
        return !1;
    }
    if (!d.operator && (a || i) && o !== 0)
      return !1;
  }
  return !(i && u && !a && o !== 0 || a && c && !i && o !== 0 || h || f);
}, Rd = (e, t, r) => {
  if (!e)
    return t;
  const n = wf(e.semver, t.semver, r);
  return n > 0 ? e : n < 0 || t.operator === ">" && e.operator === ">=" ? t : e;
}, Od = (e, t, r) => {
  if (!e)
    return t;
  const n = wf(e.semver, t.semver, r);
  return n < 0 ? e : n > 0 || t.operator === "<" && e.operator === "<=" ? t : e;
};
var NC = OC;
const Cu = go, Dd = wl, IC = Rt, kd = kg, UC = _i, LC = qF, BC = WF, MC = KF, jC = YF, _C = QF, zC = tT, qC = iT, VC = sT, HC = fr, WC = fT, GC = pT, KC = pf, XC = yT, YC = xT, ZC = El, JC = vf, QC = Ng, $C = Ig, eA = gf, tA = mf, rA = Ug, nA = HT, iA = Sl(), aA = hr(), oA = Fl, sA = JT, lA = tC, uA = aC, cA = lC, fA = fC, hA = yf, dA = xC, pA = FC, vA = CC, gA = RC, mA = NC;
var Bg = {
  parse: UC,
  valid: LC,
  clean: BC,
  inc: MC,
  diff: jC,
  major: _C,
  minor: zC,
  patch: qC,
  prerelease: VC,
  compare: HC,
  rcompare: WC,
  compareLoose: GC,
  compareBuild: KC,
  sort: XC,
  rsort: YC,
  gt: ZC,
  lt: JC,
  eq: QC,
  neq: $C,
  gte: eA,
  lte: tA,
  cmp: rA,
  coerce: nA,
  Comparator: iA,
  Range: aA,
  satisfies: oA,
  toComparators: sA,
  maxSatisfying: lA,
  minSatisfying: uA,
  minVersion: cA,
  validRange: fA,
  outside: hA,
  gtr: dA,
  ltr: pA,
  intersects: vA,
  simplifyRange: gA,
  subset: mA,
  SemVer: IC,
  re: Cu.re,
  src: Cu.src,
  tokens: Cu.t,
  SEMVER_SPEC_VERSION: Dd.SEMVER_SPEC_VERSION,
  RELEASE_TYPES: Dd.RELEASE_TYPES,
  compareIdentifiers: kd.compareIdentifiers,
  rcompareIdentifiers: kd.rcompareIdentifiers
}, mo = {}, Gs = { exports: {} };
Gs.exports;
(function(e, t) {
  var r = 200, n = "__lodash_hash_undefined__", i = 1, a = 2, o = 9007199254740991, s = "[object Arguments]", l = "[object Array]", u = "[object AsyncFunction]", c = "[object Boolean]", f = "[object Date]", h = "[object Error]", d = "[object Function]", p = "[object GeneratorFunction]", v = "[object Map]", y = "[object Number]", m = "[object Null]", S = "[object Object]", T = "[object Promise]", C = "[object Proxy]", A = "[object RegExp]", O = "[object Set]", k = "[object String]", M = "[object Symbol]", b = "[object Undefined]", j = "[object WeakMap]", I = "[object ArrayBuffer]", q = "[object DataView]", z = "[object Float32Array]", B = "[object Float64Array]", N = "[object Int8Array]", L = "[object Int16Array]", U = "[object Int32Array]", X = "[object Uint8Array]", W = "[object Uint8ClampedArray]", Q = "[object Uint16Array]", re = "[object Uint32Array]", ee = /[\\^$.*+?()[\]{}|]/g, Te = /^\[object .+?Constructor\]$/, De = /^(?:0|[1-9]\d*)$/, te = {};
  te[z] = te[B] = te[N] = te[L] = te[U] = te[X] = te[W] = te[Q] = te[re] = !0, te[s] = te[l] = te[I] = te[c] = te[q] = te[f] = te[h] = te[d] = te[v] = te[y] = te[S] = te[A] = te[O] = te[k] = te[j] = !1;
  var mt = typeof xt == "object" && xt && xt.Object === Object && xt, w = typeof self == "object" && self && self.Object === Object && self, g = mt || w || Function("return this")(), _ = t && !t.nodeType && t, P = _ && !0 && e && !e.nodeType && e, Se = P && P.exports === _, Ue = Se && mt.process, qe = function() {
    try {
      return Ue && Ue.binding && Ue.binding("util");
    } catch {
    }
  }(), at = qe && qe.isTypedArray;
  function ht(F, R) {
    for (var V = -1, Y = F == null ? 0 : F.length, Le = 0, pe = []; ++V < Y; ) {
      var Ve = F[V];
      R(Ve, V, F) && (pe[Le++] = Ve);
    }
    return pe;
  }
  function jr(F, R) {
    for (var V = -1, Y = R.length, Le = F.length; ++V < Y; )
      F[Le + V] = R[V];
    return F;
  }
  function Xe(F, R) {
    for (var V = -1, Y = F == null ? 0 : F.length; ++V < Y; )
      if (R(F[V], V, F))
        return !0;
    return !1;
  }
  function er(F, R) {
    for (var V = -1, Y = Array(F); ++V < F; )
      Y[V] = R(V);
    return Y;
  }
  function tu(F) {
    return function(R) {
      return F(R);
    };
  }
  function ko(F, R) {
    return F.has(R);
  }
  function Zi(F, R) {
    return F == null ? void 0 : F[R];
  }
  function No(F) {
    var R = -1, V = Array(F.size);
    return F.forEach(function(Y, Le) {
      V[++R] = [Le, Y];
    }), V;
  }
  function Gy(F, R) {
    return function(V) {
      return F(R(V));
    };
  }
  function Ky(F) {
    var R = -1, V = Array(F.size);
    return F.forEach(function(Y) {
      V[++R] = Y;
    }), V;
  }
  var Xy = Array.prototype, Yy = Function.prototype, Io = Object.prototype, ru = g["__core-js_shared__"], nh = Yy.toString, vr = Io.hasOwnProperty, ih = function() {
    var F = /[^.]+$/.exec(ru && ru.keys && ru.keys.IE_PROTO || "");
    return F ? "Symbol(src)_1." + F : "";
  }(), ah = Io.toString, Zy = RegExp(
    "^" + nh.call(vr).replace(ee, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
  ), oh = Se ? g.Buffer : void 0, Uo = g.Symbol, sh = g.Uint8Array, lh = Io.propertyIsEnumerable, Jy = Xy.splice, Sn = Uo ? Uo.toStringTag : void 0, uh = Object.getOwnPropertySymbols, Qy = oh ? oh.isBuffer : void 0, $y = Gy(Object.keys, Object), nu = ii(g, "DataView"), Ji = ii(g, "Map"), iu = ii(g, "Promise"), au = ii(g, "Set"), ou = ii(g, "WeakMap"), Qi = ii(Object, "create"), eb = Cn(nu), tb = Cn(Ji), rb = Cn(iu), nb = Cn(au), ib = Cn(ou), ch = Uo ? Uo.prototype : void 0, su = ch ? ch.valueOf : void 0;
  function Fn(F) {
    var R = -1, V = F == null ? 0 : F.length;
    for (this.clear(); ++R < V; ) {
      var Y = F[R];
      this.set(Y[0], Y[1]);
    }
  }
  function ab() {
    this.__data__ = Qi ? Qi(null) : {}, this.size = 0;
  }
  function ob(F) {
    var R = this.has(F) && delete this.__data__[F];
    return this.size -= R ? 1 : 0, R;
  }
  function sb(F) {
    var R = this.__data__;
    if (Qi) {
      var V = R[F];
      return V === n ? void 0 : V;
    }
    return vr.call(R, F) ? R[F] : void 0;
  }
  function lb(F) {
    var R = this.__data__;
    return Qi ? R[F] !== void 0 : vr.call(R, F);
  }
  function ub(F, R) {
    var V = this.__data__;
    return this.size += this.has(F) ? 0 : 1, V[F] = Qi && R === void 0 ? n : R, this;
  }
  Fn.prototype.clear = ab, Fn.prototype.delete = ob, Fn.prototype.get = sb, Fn.prototype.has = lb, Fn.prototype.set = ub;
  function Cr(F) {
    var R = -1, V = F == null ? 0 : F.length;
    for (this.clear(); ++R < V; ) {
      var Y = F[R];
      this.set(Y[0], Y[1]);
    }
  }
  function cb() {
    this.__data__ = [], this.size = 0;
  }
  function fb(F) {
    var R = this.__data__, V = Bo(R, F);
    if (V < 0)
      return !1;
    var Y = R.length - 1;
    return V == Y ? R.pop() : Jy.call(R, V, 1), --this.size, !0;
  }
  function hb(F) {
    var R = this.__data__, V = Bo(R, F);
    return V < 0 ? void 0 : R[V][1];
  }
  function db(F) {
    return Bo(this.__data__, F) > -1;
  }
  function pb(F, R) {
    var V = this.__data__, Y = Bo(V, F);
    return Y < 0 ? (++this.size, V.push([F, R])) : V[Y][1] = R, this;
  }
  Cr.prototype.clear = cb, Cr.prototype.delete = fb, Cr.prototype.get = hb, Cr.prototype.has = db, Cr.prototype.set = pb;
  function Tn(F) {
    var R = -1, V = F == null ? 0 : F.length;
    for (this.clear(); ++R < V; ) {
      var Y = F[R];
      this.set(Y[0], Y[1]);
    }
  }
  function vb() {
    this.size = 0, this.__data__ = {
      hash: new Fn(),
      map: new (Ji || Cr)(),
      string: new Fn()
    };
  }
  function gb(F) {
    var R = Mo(this, F).delete(F);
    return this.size -= R ? 1 : 0, R;
  }
  function mb(F) {
    return Mo(this, F).get(F);
  }
  function yb(F) {
    return Mo(this, F).has(F);
  }
  function bb(F, R) {
    var V = Mo(this, F), Y = V.size;
    return V.set(F, R), this.size += V.size == Y ? 0 : 1, this;
  }
  Tn.prototype.clear = vb, Tn.prototype.delete = gb, Tn.prototype.get = mb, Tn.prototype.has = yb, Tn.prototype.set = bb;
  function Lo(F) {
    var R = -1, V = F == null ? 0 : F.length;
    for (this.__data__ = new Tn(); ++R < V; )
      this.add(F[R]);
  }
  function wb(F) {
    return this.__data__.set(F, n), this;
  }
  function xb(F) {
    return this.__data__.has(F);
  }
  Lo.prototype.add = Lo.prototype.push = wb, Lo.prototype.has = xb;
  function _r(F) {
    var R = this.__data__ = new Cr(F);
    this.size = R.size;
  }
  function Eb() {
    this.__data__ = new Cr(), this.size = 0;
  }
  function Sb(F) {
    var R = this.__data__, V = R.delete(F);
    return this.size = R.size, V;
  }
  function Fb(F) {
    return this.__data__.get(F);
  }
  function Tb(F) {
    return this.__data__.has(F);
  }
  function Cb(F, R) {
    var V = this.__data__;
    if (V instanceof Cr) {
      var Y = V.__data__;
      if (!Ji || Y.length < r - 1)
        return Y.push([F, R]), this.size = ++V.size, this;
      V = this.__data__ = new Tn(Y);
    }
    return V.set(F, R), this.size = V.size, this;
  }
  _r.prototype.clear = Eb, _r.prototype.delete = Sb, _r.prototype.get = Fb, _r.prototype.has = Tb, _r.prototype.set = Cb;
  function Ab(F, R) {
    var V = jo(F), Y = !V && qb(F), Le = !V && !Y && lu(F), pe = !V && !Y && !Le && bh(F), Ve = V || Y || Le || pe, tt = Ve ? er(F.length, String) : [], ot = tt.length;
    for (var je in F)
      vr.call(F, je) && !(Ve && // Safari 9 has enumerable `arguments.length` in strict mode.
      (je == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
      Le && (je == "offset" || je == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
      pe && (je == "buffer" || je == "byteLength" || je == "byteOffset") || // Skip index properties.
      Bb(je, ot))) && tt.push(je);
    return tt;
  }
  function Bo(F, R) {
    for (var V = F.length; V--; )
      if (vh(F[V][0], R))
        return V;
    return -1;
  }
  function Pb(F, R, V) {
    var Y = R(F);
    return jo(F) ? Y : jr(Y, V(F));
  }
  function $i(F) {
    return F == null ? F === void 0 ? b : m : Sn && Sn in Object(F) ? Ub(F) : zb(F);
  }
  function fh(F) {
    return ea(F) && $i(F) == s;
  }
  function hh(F, R, V, Y, Le) {
    return F === R ? !0 : F == null || R == null || !ea(F) && !ea(R) ? F !== F && R !== R : Rb(F, R, V, Y, hh, Le);
  }
  function Rb(F, R, V, Y, Le, pe) {
    var Ve = jo(F), tt = jo(R), ot = Ve ? l : zr(F), je = tt ? l : zr(R);
    ot = ot == s ? S : ot, je = je == s ? S : je;
    var It = ot == S, tr = je == S, dt = ot == je;
    if (dt && lu(F)) {
      if (!lu(R))
        return !1;
      Ve = !0, It = !1;
    }
    if (dt && !It)
      return pe || (pe = new _r()), Ve || bh(F) ? dh(F, R, V, Y, Le, pe) : Nb(F, R, ot, V, Y, Le, pe);
    if (!(V & i)) {
      var zt = It && vr.call(F, "__wrapped__"), qt = tr && vr.call(R, "__wrapped__");
      if (zt || qt) {
        var qr = zt ? F.value() : F, Ar = qt ? R.value() : R;
        return pe || (pe = new _r()), Le(qr, Ar, V, Y, pe);
      }
    }
    return dt ? (pe || (pe = new _r()), Ib(F, R, V, Y, Le, pe)) : !1;
  }
  function Ob(F) {
    if (!yh(F) || jb(F))
      return !1;
    var R = gh(F) ? Zy : Te;
    return R.test(Cn(F));
  }
  function Db(F) {
    return ea(F) && mh(F.length) && !!te[$i(F)];
  }
  function kb(F) {
    if (!_b(F))
      return $y(F);
    var R = [];
    for (var V in Object(F))
      vr.call(F, V) && V != "constructor" && R.push(V);
    return R;
  }
  function dh(F, R, V, Y, Le, pe) {
    var Ve = V & i, tt = F.length, ot = R.length;
    if (tt != ot && !(Ve && ot > tt))
      return !1;
    var je = pe.get(F);
    if (je && pe.get(R))
      return je == R;
    var It = -1, tr = !0, dt = V & a ? new Lo() : void 0;
    for (pe.set(F, R), pe.set(R, F); ++It < tt; ) {
      var zt = F[It], qt = R[It];
      if (Y)
        var qr = Ve ? Y(qt, zt, It, R, F, pe) : Y(zt, qt, It, F, R, pe);
      if (qr !== void 0) {
        if (qr)
          continue;
        tr = !1;
        break;
      }
      if (dt) {
        if (!Xe(R, function(Ar, An) {
          if (!ko(dt, An) && (zt === Ar || Le(zt, Ar, V, Y, pe)))
            return dt.push(An);
        })) {
          tr = !1;
          break;
        }
      } else if (!(zt === qt || Le(zt, qt, V, Y, pe))) {
        tr = !1;
        break;
      }
    }
    return pe.delete(F), pe.delete(R), tr;
  }
  function Nb(F, R, V, Y, Le, pe, Ve) {
    switch (V) {
      case q:
        if (F.byteLength != R.byteLength || F.byteOffset != R.byteOffset)
          return !1;
        F = F.buffer, R = R.buffer;
      case I:
        return !(F.byteLength != R.byteLength || !pe(new sh(F), new sh(R)));
      case c:
      case f:
      case y:
        return vh(+F, +R);
      case h:
        return F.name == R.name && F.message == R.message;
      case A:
      case k:
        return F == R + "";
      case v:
        var tt = No;
      case O:
        var ot = Y & i;
        if (tt || (tt = Ky), F.size != R.size && !ot)
          return !1;
        var je = Ve.get(F);
        if (je)
          return je == R;
        Y |= a, Ve.set(F, R);
        var It = dh(tt(F), tt(R), Y, Le, pe, Ve);
        return Ve.delete(F), It;
      case M:
        if (su)
          return su.call(F) == su.call(R);
    }
    return !1;
  }
  function Ib(F, R, V, Y, Le, pe) {
    var Ve = V & i, tt = ph(F), ot = tt.length, je = ph(R), It = je.length;
    if (ot != It && !Ve)
      return !1;
    for (var tr = ot; tr--; ) {
      var dt = tt[tr];
      if (!(Ve ? dt in R : vr.call(R, dt)))
        return !1;
    }
    var zt = pe.get(F);
    if (zt && pe.get(R))
      return zt == R;
    var qt = !0;
    pe.set(F, R), pe.set(R, F);
    for (var qr = Ve; ++tr < ot; ) {
      dt = tt[tr];
      var Ar = F[dt], An = R[dt];
      if (Y)
        var wh = Ve ? Y(An, Ar, dt, R, F, pe) : Y(Ar, An, dt, F, R, pe);
      if (!(wh === void 0 ? Ar === An || Le(Ar, An, V, Y, pe) : wh)) {
        qt = !1;
        break;
      }
      qr || (qr = dt == "constructor");
    }
    if (qt && !qr) {
      var _o = F.constructor, zo = R.constructor;
      _o != zo && "constructor" in F && "constructor" in R && !(typeof _o == "function" && _o instanceof _o && typeof zo == "function" && zo instanceof zo) && (qt = !1);
    }
    return pe.delete(F), pe.delete(R), qt;
  }
  function ph(F) {
    return Pb(F, Wb, Lb);
  }
  function Mo(F, R) {
    var V = F.__data__;
    return Mb(R) ? V[typeof R == "string" ? "string" : "hash"] : V.map;
  }
  function ii(F, R) {
    var V = Zi(F, R);
    return Ob(V) ? V : void 0;
  }
  function Ub(F) {
    var R = vr.call(F, Sn), V = F[Sn];
    try {
      F[Sn] = void 0;
      var Y = !0;
    } catch {
    }
    var Le = ah.call(F);
    return Y && (R ? F[Sn] = V : delete F[Sn]), Le;
  }
  var Lb = uh ? function(F) {
    return F == null ? [] : (F = Object(F), ht(uh(F), function(R) {
      return lh.call(F, R);
    }));
  } : Gb, zr = $i;
  (nu && zr(new nu(new ArrayBuffer(1))) != q || Ji && zr(new Ji()) != v || iu && zr(iu.resolve()) != T || au && zr(new au()) != O || ou && zr(new ou()) != j) && (zr = function(F) {
    var R = $i(F), V = R == S ? F.constructor : void 0, Y = V ? Cn(V) : "";
    if (Y)
      switch (Y) {
        case eb:
          return q;
        case tb:
          return v;
        case rb:
          return T;
        case nb:
          return O;
        case ib:
          return j;
      }
    return R;
  });
  function Bb(F, R) {
    return R = R ?? o, !!R && (typeof F == "number" || De.test(F)) && F > -1 && F % 1 == 0 && F < R;
  }
  function Mb(F) {
    var R = typeof F;
    return R == "string" || R == "number" || R == "symbol" || R == "boolean" ? F !== "__proto__" : F === null;
  }
  function jb(F) {
    return !!ih && ih in F;
  }
  function _b(F) {
    var R = F && F.constructor, V = typeof R == "function" && R.prototype || Io;
    return F === V;
  }
  function zb(F) {
    return ah.call(F);
  }
  function Cn(F) {
    if (F != null) {
      try {
        return nh.call(F);
      } catch {
      }
      try {
        return F + "";
      } catch {
      }
    }
    return "";
  }
  function vh(F, R) {
    return F === R || F !== F && R !== R;
  }
  var qb = fh(/* @__PURE__ */ function() {
    return arguments;
  }()) ? fh : function(F) {
    return ea(F) && vr.call(F, "callee") && !lh.call(F, "callee");
  }, jo = Array.isArray;
  function Vb(F) {
    return F != null && mh(F.length) && !gh(F);
  }
  var lu = Qy || Kb;
  function Hb(F, R) {
    return hh(F, R);
  }
  function gh(F) {
    if (!yh(F))
      return !1;
    var R = $i(F);
    return R == d || R == p || R == u || R == C;
  }
  function mh(F) {
    return typeof F == "number" && F > -1 && F % 1 == 0 && F <= o;
  }
  function yh(F) {
    var R = typeof F;
    return F != null && (R == "object" || R == "function");
  }
  function ea(F) {
    return F != null && typeof F == "object";
  }
  var bh = at ? tu(at) : Db;
  function Wb(F) {
    return Vb(F) ? Ab(F) : kb(F);
  }
  function Gb() {
    return [];
  }
  function Kb() {
    return !1;
  }
  e.exports = Hb;
})(Gs, Gs.exports);
var yA = Gs.exports;
Object.defineProperty(mo, "__esModule", { value: !0 });
mo.DownloadedUpdateHelper = void 0;
mo.createTempUpdateFile = SA;
const bA = Bi, wA = Ae, Nd = yA, On = bn, Ta = Me;
class xA {
  constructor(t) {
    this.cacheDir = t, this._file = null, this._packageFile = null, this.versionInfo = null, this.fileInfo = null, this._downloadedFileInfo = null;
  }
  get downloadedFileInfo() {
    return this._downloadedFileInfo;
  }
  get file() {
    return this._file;
  }
  get packageFile() {
    return this._packageFile;
  }
  get cacheDirForPendingUpdate() {
    return Ta.join(this.cacheDir, "pending");
  }
  async validateDownloadedPath(t, r, n, i) {
    if (this.versionInfo != null && this.file === t && this.fileInfo != null)
      return Nd(this.versionInfo, r) && Nd(this.fileInfo.info, n.info) && await (0, On.pathExists)(t) ? t : null;
    const a = await this.getValidCachedUpdateFile(n, i);
    return a === null ? null : (i.info(`Update has already been downloaded to ${t}).`), this._file = a, a);
  }
  async setDownloadedFile(t, r, n, i, a, o) {
    this._file = t, this._packageFile = r, this.versionInfo = n, this.fileInfo = i, this._downloadedFileInfo = {
      fileName: a,
      sha512: i.info.sha512,
      isAdminRightsRequired: i.info.isAdminRightsRequired === !0
    }, o && await (0, On.outputJson)(this.getUpdateInfoFile(), this._downloadedFileInfo);
  }
  async clear() {
    this._file = null, this._packageFile = null, this.versionInfo = null, this.fileInfo = null, await this.cleanCacheDirForPendingUpdate();
  }
  async cleanCacheDirForPendingUpdate() {
    try {
      await (0, On.emptyDir)(this.cacheDirForPendingUpdate);
    } catch {
    }
  }
  /**
   * Returns "update-info.json" which is created in the update cache directory's "pending" subfolder after the first update is downloaded.  If the update file does not exist then the cache is cleared and recreated.  If the update file exists then its properties are validated.
   * @param fileInfo
   * @param logger
   */
  async getValidCachedUpdateFile(t, r) {
    const n = this.getUpdateInfoFile();
    if (!await (0, On.pathExists)(n))
      return null;
    let a;
    try {
      a = await (0, On.readJson)(n);
    } catch (u) {
      let c = "No cached update info available";
      return u.code !== "ENOENT" && (await this.cleanCacheDirForPendingUpdate(), c += ` (error on read: ${u.message})`), r.info(c), null;
    }
    if (!((a == null ? void 0 : a.fileName) !== null))
      return r.warn("Cached update info is corrupted: no fileName, directory for cached update will be cleaned"), await this.cleanCacheDirForPendingUpdate(), null;
    if (t.info.sha512 !== a.sha512)
      return r.info(`Cached update sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${a.sha512}, expected: ${t.info.sha512}. Directory for cached update will be cleaned`), await this.cleanCacheDirForPendingUpdate(), null;
    const s = Ta.join(this.cacheDirForPendingUpdate, a.fileName);
    if (!await (0, On.pathExists)(s))
      return r.info("Cached update file doesn't exist"), null;
    const l = await EA(s);
    return t.info.sha512 !== l ? (r.warn(`Sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${l}, expected: ${t.info.sha512}`), await this.cleanCacheDirForPendingUpdate(), null) : (this._downloadedFileInfo = a, s);
  }
  getUpdateInfoFile() {
    return Ta.join(this.cacheDirForPendingUpdate, "update-info.json");
  }
}
mo.DownloadedUpdateHelper = xA;
function EA(e, t = "sha512", r = "base64", n) {
  return new Promise((i, a) => {
    const o = (0, bA.createHash)(t);
    o.on("error", a).setEncoding(r), (0, wA.createReadStream)(e, {
      ...n,
      highWaterMark: 1024 * 1024
      /* better to use more memory but hash faster */
    }).on("error", a).on("end", () => {
      o.end(), i(o.read());
    }).pipe(o, { end: !1 });
  });
}
async function SA(e, t, r) {
  let n = 0, i = Ta.join(t, e);
  for (let a = 0; a < 3; a++)
    try {
      return await (0, On.unlink)(i), i;
    } catch (o) {
      if (o.code === "ENOENT")
        return i;
      r.warn(`Error on remove temp update file: ${o}`), i = Ta.join(t, `${n++}-${e}`);
    }
  return i;
}
var Tl = {}, xf = {};
Object.defineProperty(xf, "__esModule", { value: !0 });
xf.getAppCacheDir = TA;
const Au = Me, FA = fl;
function TA() {
  const e = (0, FA.homedir)();
  let t;
  return process.platform === "win32" ? t = process.env.LOCALAPPDATA || Au.join(e, "AppData", "Local") : process.platform === "darwin" ? t = Au.join(e, "Library", "Caches") : t = process.env.XDG_CACHE_HOME || Au.join(e, ".cache"), t;
}
Object.defineProperty(Tl, "__esModule", { value: !0 });
Tl.ElectronAppAdapter = void 0;
const Id = Me, CA = xf;
class AA {
  constructor(t = _n.app) {
    this.app = t;
  }
  whenReady() {
    return this.app.whenReady();
  }
  get version() {
    return this.app.getVersion();
  }
  get name() {
    return this.app.getName();
  }
  get isPackaged() {
    return this.app.isPackaged === !0;
  }
  get appUpdateConfigPath() {
    return this.isPackaged ? Id.join(process.resourcesPath, "app-update.yml") : Id.join(this.app.getAppPath(), "dev-app-update.yml");
  }
  get userDataPath() {
    return this.app.getPath("userData");
  }
  get baseCachePath() {
    return (0, CA.getAppCacheDir)();
  }
  quit() {
    this.app.quit();
  }
  relaunch() {
    this.app.relaunch();
  }
  onQuit(t) {
    this.app.once("quit", (r, n) => t(n));
  }
}
Tl.ElectronAppAdapter = AA;
var Mg = {};
(function(e) {
  Object.defineProperty(e, "__esModule", { value: !0 }), e.ElectronHttpExecutor = e.NET_SESSION_NAME = void 0, e.getNetSession = r;
  const t = et;
  e.NET_SESSION_NAME = "electron-updater";
  function r() {
    return _n.session.fromPartition(e.NET_SESSION_NAME, {
      cache: !1
    });
  }
  class n extends t.HttpExecutor {
    constructor(a) {
      super(), this.proxyLoginCallback = a, this.cachedSession = null;
    }
    async download(a, o, s) {
      return await s.cancellationToken.createPromise((l, u, c) => {
        const f = {
          headers: s.headers || void 0,
          redirect: "manual"
        };
        (0, t.configureRequestUrl)(a, f), (0, t.configureRequestOptions)(f), this.doDownload(f, {
          destination: o,
          options: s,
          onCancel: c,
          callback: (h) => {
            h == null ? l(o) : u(h);
          },
          responseHandler: null
        }, 0);
      });
    }
    createRequest(a, o) {
      a.headers && a.headers.Host && (a.host = a.headers.Host, delete a.headers.Host), this.cachedSession == null && (this.cachedSession = r());
      const s = _n.net.request({
        ...a,
        session: this.cachedSession
      });
      return s.on("response", o), this.proxyLoginCallback != null && s.on("login", this.proxyLoginCallback), s;
    }
    addRedirectHandlers(a, o, s, l, u) {
      a.on("redirect", (c, f, h) => {
        a.abort(), l > this.maxRedirects ? s(this.createMaxRedirectError()) : u(t.HttpExecutor.prepareRedirectUrlOptions(h, o));
      });
    }
  }
  e.ElectronHttpExecutor = n;
})(Mg);
var yo = {}, dr = {};
Object.defineProperty(dr, "__esModule", { value: !0 });
dr.newBaseUrl = PA;
dr.newUrlFromBase = RA;
dr.getChannelFilename = OA;
const jg = yn;
function PA(e) {
  const t = new jg.URL(e);
  return t.pathname.endsWith("/") || (t.pathname += "/"), t;
}
function RA(e, t, r = !1) {
  const n = new jg.URL(e, t), i = t.search;
  return i != null && i.length !== 0 ? n.search = i : r && (n.search = `noCache=${Date.now().toString(32)}`), n;
}
function OA(e) {
  return `${e}.yml`;
}
var Ke = {}, DA = "[object Symbol]", _g = /[\\^$.*+?()[\]{}|]/g, kA = RegExp(_g.source), NA = typeof xt == "object" && xt && xt.Object === Object && xt, IA = typeof self == "object" && self && self.Object === Object && self, UA = NA || IA || Function("return this")(), LA = Object.prototype, BA = LA.toString, Ud = UA.Symbol, Ld = Ud ? Ud.prototype : void 0, Bd = Ld ? Ld.toString : void 0;
function MA(e) {
  if (typeof e == "string")
    return e;
  if (_A(e))
    return Bd ? Bd.call(e) : "";
  var t = e + "";
  return t == "0" && 1 / e == -1 / 0 ? "-0" : t;
}
function jA(e) {
  return !!e && typeof e == "object";
}
function _A(e) {
  return typeof e == "symbol" || jA(e) && BA.call(e) == DA;
}
function zA(e) {
  return e == null ? "" : MA(e);
}
function qA(e) {
  return e = zA(e), e && kA.test(e) ? e.replace(_g, "\\$&") : e;
}
var zg = qA;
Object.defineProperty(Ke, "__esModule", { value: !0 });
Ke.Provider = void 0;
Ke.findFile = KA;
Ke.parseUpdateInfo = XA;
Ke.getFileList = qg;
Ke.resolveFiles = YA;
const hn = et, VA = ft, HA = yn, Ks = dr, WA = zg;
class GA {
  constructor(t) {
    this.runtimeOptions = t, this.requestHeaders = null, this.executor = t.executor;
  }
  // By default, the blockmap file is in the same directory as the main file
  // But some providers may have a different blockmap file, so we need to override this method
  getBlockMapFiles(t, r, n, i = null) {
    const a = (0, Ks.newUrlFromBase)(`${t.pathname}.blockmap`, t);
    return [(0, Ks.newUrlFromBase)(`${t.pathname.replace(new RegExp(WA(n), "g"), r)}.blockmap`, i ? new HA.URL(i) : t), a];
  }
  get isUseMultipleRangeRequest() {
    return this.runtimeOptions.isUseMultipleRangeRequest !== !1;
  }
  getChannelFilePrefix() {
    if (this.runtimeOptions.platform === "linux") {
      const t = process.env.TEST_UPDATER_ARCH || process.arch;
      return "-linux" + (t === "x64" ? "" : `-${t}`);
    } else
      return this.runtimeOptions.platform === "darwin" ? "-mac" : "";
  }
  // due to historical reasons for windows we use channel name without platform specifier
  getDefaultChannelName() {
    return this.getCustomChannelName("latest");
  }
  getCustomChannelName(t) {
    return `${t}${this.getChannelFilePrefix()}`;
  }
  get fileExtraDownloadHeaders() {
    return null;
  }
  setRequestHeaders(t) {
    this.requestHeaders = t;
  }
  /**
   * Method to perform API request only to resolve update info, but not to download update.
   */
  httpRequest(t, r, n) {
    return this.executor.request(this.createRequestOptions(t, r), n);
  }
  createRequestOptions(t, r) {
    const n = {};
    return this.requestHeaders == null ? r != null && (n.headers = r) : n.headers = r == null ? this.requestHeaders : { ...this.requestHeaders, ...r }, (0, hn.configureRequestUrl)(t, n), n;
  }
}
Ke.Provider = GA;
function KA(e, t, r) {
  var n;
  if (e.length === 0)
    throw (0, hn.newError)("No files provided", "ERR_UPDATER_NO_FILES_PROVIDED");
  const i = e.filter((o) => o.url.pathname.toLowerCase().endsWith(`.${t.toLowerCase()}`)), a = (n = i.find((o) => [o.url.pathname, o.info.url].some((s) => s.includes(process.arch)))) !== null && n !== void 0 ? n : i.shift();
  return a || (r == null ? e[0] : e.find((o) => !r.some((s) => o.url.pathname.toLowerCase().endsWith(`.${s.toLowerCase()}`))));
}
function XA(e, t, r) {
  if (e == null)
    throw (0, hn.newError)(`Cannot parse update info from ${t} in the latest release artifacts (${r}): rawData: null`, "ERR_UPDATER_INVALID_UPDATE_INFO");
  let n;
  try {
    n = (0, VA.load)(e);
  } catch (i) {
    throw (0, hn.newError)(`Cannot parse update info from ${t} in the latest release artifacts (${r}): ${i.stack || i.message}, rawData: ${e}`, "ERR_UPDATER_INVALID_UPDATE_INFO");
  }
  return n;
}
function qg(e) {
  const t = e.files;
  if (t != null && t.length > 0)
    return t;
  if (e.path != null)
    return [
      {
        url: e.path,
        sha2: e.sha2,
        sha512: e.sha512
      }
    ];
  throw (0, hn.newError)(`No files provided: ${(0, hn.safeStringifyJson)(e)}`, "ERR_UPDATER_NO_FILES_PROVIDED");
}
function YA(e, t, r = (n) => n) {
  const i = qg(e).map((s) => {
    if (s.sha2 == null && s.sha512 == null)
      throw (0, hn.newError)(`Update info doesn't contain nor sha256 neither sha512 checksum: ${(0, hn.safeStringifyJson)(s)}`, "ERR_UPDATER_NO_CHECKSUM");
    return {
      url: (0, Ks.newUrlFromBase)(r(s.url), t),
      info: s
    };
  }), a = e.packages, o = a == null ? null : a[process.arch] || a.ia32;
  return o != null && (i[0].packageInfo = {
    ...o,
    path: (0, Ks.newUrlFromBase)(r(o.path), t).href
  }), i;
}
Object.defineProperty(yo, "__esModule", { value: !0 });
yo.GenericProvider = void 0;
const Md = et, Pu = dr, Ru = Ke;
class ZA extends Ru.Provider {
  constructor(t, r, n) {
    super(n), this.configuration = t, this.updater = r, this.baseUrl = (0, Pu.newBaseUrl)(this.configuration.url);
  }
  get channel() {
    const t = this.updater.channel || this.configuration.channel;
    return t == null ? this.getDefaultChannelName() : this.getCustomChannelName(t);
  }
  async getLatestVersion() {
    const t = (0, Pu.getChannelFilename)(this.channel), r = (0, Pu.newUrlFromBase)(t, this.baseUrl, this.updater.isAddNoCacheQuery);
    for (let n = 0; ; n++)
      try {
        return (0, Ru.parseUpdateInfo)(await this.httpRequest(r), t, r);
      } catch (i) {
        if (i instanceof Md.HttpError && i.statusCode === 404)
          throw (0, Md.newError)(`Cannot find channel "${t}" update info: ${i.stack || i.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
        if (i.code === "ECONNREFUSED" && n < 3) {
          await new Promise((a, o) => {
            try {
              setTimeout(a, 1e3 * n);
            } catch (s) {
              o(s);
            }
          });
          continue;
        }
        throw i;
      }
  }
  resolveFiles(t) {
    return (0, Ru.resolveFiles)(t, this.baseUrl);
  }
}
yo.GenericProvider = ZA;
var Cl = {}, Al = {};
Object.defineProperty(Al, "__esModule", { value: !0 });
Al.BitbucketProvider = void 0;
const jd = et, Ou = dr, Du = Ke;
class JA extends Du.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      isUseMultipleRangeRequest: !1
    }), this.configuration = t, this.updater = r;
    const { owner: i, slug: a } = t;
    this.baseUrl = (0, Ou.newBaseUrl)(`https://api.bitbucket.org/2.0/repositories/${i}/${a}/downloads`);
  }
  get channel() {
    return this.updater.channel || this.configuration.channel || "latest";
  }
  async getLatestVersion() {
    const t = new jd.CancellationToken(), r = (0, Ou.getChannelFilename)(this.getCustomChannelName(this.channel)), n = (0, Ou.newUrlFromBase)(r, this.baseUrl, this.updater.isAddNoCacheQuery);
    try {
      const i = await this.httpRequest(n, void 0, t);
      return (0, Du.parseUpdateInfo)(i, r, n);
    } catch (i) {
      throw (0, jd.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${i.stack || i.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  resolveFiles(t) {
    return (0, Du.resolveFiles)(t, this.baseUrl);
  }
  toString() {
    const { owner: t, slug: r } = this.configuration;
    return `Bitbucket (owner: ${t}, slug: ${r}, channel: ${this.channel})`;
  }
}
Al.BitbucketProvider = JA;
var dn = {};
Object.defineProperty(dn, "__esModule", { value: !0 });
dn.GitHubProvider = dn.BaseGitHubProvider = void 0;
dn.computeReleaseNotes = Hg;
const Rr = et, In = Bg, QA = yn, wi = dr, wc = Ke, ku = /\/tag\/([^/]+)$/;
class Vg extends wc.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      /* because GitHib uses S3 */
      isUseMultipleRangeRequest: !1
    }), this.options = t, this.baseUrl = (0, wi.newBaseUrl)((0, Rr.githubUrl)(t, r));
    const i = r === "github.com" ? "api.github.com" : r;
    this.baseApiUrl = (0, wi.newBaseUrl)((0, Rr.githubUrl)(t, i));
  }
  computeGithubBasePath(t) {
    const r = this.options.host;
    return r && !["github.com", "api.github.com"].includes(r) ? `/api/v3${t}` : t;
  }
}
dn.BaseGitHubProvider = Vg;
class $A extends Vg {
  constructor(t, r, n) {
    super(t, "github.com", n), this.options = t, this.updater = r;
  }
  get channel() {
    const t = this.updater.channel || this.options.channel;
    return t == null ? this.getDefaultChannelName() : this.getCustomChannelName(t);
  }
  async getLatestVersion() {
    var t, r, n, i, a;
    const o = new Rr.CancellationToken(), s = await this.httpRequest((0, wi.newUrlFromBase)(`${this.basePath}.atom`, this.baseUrl), {
      accept: "application/xml, application/atom+xml, text/xml, */*"
    }, o), l = (0, Rr.parseXml)(s);
    let u = l.element("entry", !1, "No published versions on GitHub"), c = null;
    try {
      if (this.updater.allowPrerelease) {
        const y = ((t = this.updater) === null || t === void 0 ? void 0 : t.channel) || ((r = In.prerelease(this.updater.currentVersion)) === null || r === void 0 ? void 0 : r[0]) || null;
        if (y === null)
          c = ku.exec(u.element("link").attribute("href"))[1];
        else
          for (const m of l.getElements("entry")) {
            const S = ku.exec(m.element("link").attribute("href"));
            if (S === null)
              continue;
            const T = S[1], C = ((n = In.prerelease(T)) === null || n === void 0 ? void 0 : n[0]) || null, A = !y || ["alpha", "beta"].includes(y), O = C !== null && !["alpha", "beta"].includes(String(C));
            if (A && !O && !(y === "beta" && C === "alpha")) {
              c = T;
              break;
            }
            if (C && C === y) {
              c = T;
              break;
            }
          }
      } else {
        c = await this.getLatestTagName(o);
        for (const y of l.getElements("entry"))
          if (ku.exec(y.element("link").attribute("href"))[1] === c) {
            u = y;
            break;
          }
      }
    } catch (y) {
      throw (0, Rr.newError)(`Cannot parse releases feed: ${y.stack || y.message},
XML:
${s}`, "ERR_UPDATER_INVALID_RELEASE_FEED");
    }
    if (c == null)
      throw (0, Rr.newError)("No published versions on GitHub", "ERR_UPDATER_NO_PUBLISHED_VERSIONS");
    let f, h = "", d = "";
    const p = async (y) => {
      h = (0, wi.getChannelFilename)(y), d = (0, wi.newUrlFromBase)(this.getBaseDownloadPath(String(c), h), this.baseUrl);
      const m = this.createRequestOptions(d);
      try {
        return await this.executor.request(m, o);
      } catch (S) {
        throw S instanceof Rr.HttpError && S.statusCode === 404 ? (0, Rr.newError)(`Cannot find ${h} in the latest release artifacts (${d}): ${S.stack || S.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : S;
      }
    };
    try {
      let y = this.channel;
      this.updater.allowPrerelease && (!((i = In.prerelease(c)) === null || i === void 0) && i[0]) && (y = this.getCustomChannelName(String((a = In.prerelease(c)) === null || a === void 0 ? void 0 : a[0]))), f = await p(y);
    } catch (y) {
      if (this.updater.allowPrerelease)
        f = await p(this.getDefaultChannelName());
      else
        throw y;
    }
    const v = (0, wc.parseUpdateInfo)(f, h, d);
    return v.releaseName == null && (v.releaseName = u.elementValueOrEmpty("title")), v.releaseNotes == null && (v.releaseNotes = Hg(this.updater.currentVersion, this.updater.fullChangelog, l, u)), {
      tag: c,
      ...v
    };
  }
  async getLatestTagName(t) {
    const r = this.options, n = r.host == null || r.host === "github.com" ? (0, wi.newUrlFromBase)(`${this.basePath}/latest`, this.baseUrl) : new QA.URL(`${this.computeGithubBasePath(`/repos/${r.owner}/${r.repo}/releases`)}/latest`, this.baseApiUrl);
    try {
      const i = await this.httpRequest(n, { Accept: "application/json" }, t);
      return i == null ? null : JSON.parse(i).tag_name;
    } catch (i) {
      throw (0, Rr.newError)(`Unable to find latest version on GitHub (${n}), please ensure a production release exists: ${i.stack || i.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  get basePath() {
    return `/${this.options.owner}/${this.options.repo}/releases`;
  }
  resolveFiles(t) {
    return (0, wc.resolveFiles)(t, this.baseUrl, (r) => this.getBaseDownloadPath(t.tag, r.replace(/ /g, "-")));
  }
  getBaseDownloadPath(t, r) {
    return `${this.basePath}/download/${t}/${r}`;
  }
}
dn.GitHubProvider = $A;
function _d(e) {
  const t = e.elementValueOrEmpty("content");
  return t === "No content." ? "" : t;
}
function Hg(e, t, r, n) {
  if (!t)
    return _d(n);
  const i = [];
  for (const a of r.getElements("entry")) {
    const o = /\/tag\/v?([^/]+)$/.exec(a.element("link").attribute("href"))[1];
    In.valid(o) && In.lt(e, o) && i.push({
      version: o,
      note: _d(a)
    });
  }
  return i.sort((a, o) => In.rcompare(a.version, o.version));
}
var Pl = {};
Object.defineProperty(Pl, "__esModule", { value: !0 });
Pl.GitLabProvider = void 0;
const yt = et, Nu = yn, eP = zg, es = dr, Iu = Ke;
class tP extends Iu.Provider {
  /**
   * Normalizes filenames by replacing spaces and underscores with dashes.
   *
   * This is a workaround to handle filename formatting differences between tools:
   * - electron-builder formats filenames like "test file.txt" as "test-file.txt"
   * - GitLab may provide asset URLs using underscores, such as "test_file.txt"
   *
   * Because of this mismatch, we can't reliably extract the correct filename from
   * the asset path without normalization. This function ensures consistent matching
   * across different filename formats by converting all spaces and underscores to dashes.
   *
   * @param filename The filename to normalize
   * @returns The normalized filename with spaces and underscores replaced by dashes
   */
  normalizeFilename(t) {
    return t.replace(/ |_/g, "-");
  }
  constructor(t, r, n) {
    super({
      ...n,
      // GitLab might not support multiple range requests efficiently
      isUseMultipleRangeRequest: !1
    }), this.options = t, this.updater = r, this.cachedLatestVersion = null;
    const a = t.host || "gitlab.com";
    this.baseApiUrl = (0, es.newBaseUrl)(`https://${a}/api/v4`);
  }
  get channel() {
    const t = this.updater.channel || this.options.channel;
    return t == null ? this.getDefaultChannelName() : this.getCustomChannelName(t);
  }
  async getLatestVersion() {
    const t = new yt.CancellationToken(), r = (0, es.newUrlFromBase)(`projects/${this.options.projectId}/releases/permalink/latest`, this.baseApiUrl);
    let n;
    try {
      const h = { "Content-Type": "application/json", ...this.setAuthHeaderForToken(this.options.token || null) }, d = await this.httpRequest(r, h, t);
      if (!d)
        throw (0, yt.newError)("No latest release found", "ERR_UPDATER_NO_PUBLISHED_VERSIONS");
      n = JSON.parse(d);
    } catch (h) {
      throw (0, yt.newError)(`Unable to find latest release on GitLab (${r}): ${h.stack || h.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
    const i = n.tag_name;
    let a = null, o = "", s = null;
    const l = async (h) => {
      o = (0, es.getChannelFilename)(h);
      const d = n.assets.links.find((v) => v.name === o);
      if (!d)
        throw (0, yt.newError)(`Cannot find ${o} in the latest release assets`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
      s = new Nu.URL(d.direct_asset_url);
      const p = this.options.token ? { "PRIVATE-TOKEN": this.options.token } : void 0;
      try {
        const v = await this.httpRequest(s, p, t);
        if (!v)
          throw (0, yt.newError)(`Empty response from ${s}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
        return v;
      } catch (v) {
        throw v instanceof yt.HttpError && v.statusCode === 404 ? (0, yt.newError)(`Cannot find ${o} in the latest release artifacts (${s}): ${v.stack || v.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : v;
      }
    };
    try {
      a = await l(this.channel);
    } catch (h) {
      if (this.channel !== this.getDefaultChannelName())
        a = await l(this.getDefaultChannelName());
      else
        throw h;
    }
    if (!a)
      throw (0, yt.newError)(`Unable to parse channel data from ${o}`, "ERR_UPDATER_INVALID_UPDATE_INFO");
    const u = (0, Iu.parseUpdateInfo)(a, o, s);
    u.releaseName == null && (u.releaseName = n.name), u.releaseNotes == null && (u.releaseNotes = n.description || null);
    const c = /* @__PURE__ */ new Map();
    for (const h of n.assets.links)
      c.set(this.normalizeFilename(h.name), h.direct_asset_url);
    const f = {
      tag: i,
      assets: c,
      ...u
    };
    return this.cachedLatestVersion = f, f;
  }
  /**
   * Utility function to convert GitlabReleaseAsset to Map<string, string>
   * Maps asset names to their download URLs
   */
  convertAssetsToMap(t) {
    const r = /* @__PURE__ */ new Map();
    for (const n of t.links)
      r.set(this.normalizeFilename(n.name), n.direct_asset_url);
    return r;
  }
  /**
   * Find blockmap file URL in assets map for a specific filename
   */
  findBlockMapInAssets(t, r) {
    const n = [`${r}.blockmap`, `${this.normalizeFilename(r)}.blockmap`];
    for (const i of n) {
      const a = t.get(i);
      if (a)
        return new Nu.URL(a);
    }
    return null;
  }
  async fetchReleaseInfoByVersion(t) {
    const r = new yt.CancellationToken(), n = [`v${t}`, t];
    for (const i of n) {
      const a = (0, es.newUrlFromBase)(`projects/${this.options.projectId}/releases/${encodeURIComponent(i)}`, this.baseApiUrl);
      try {
        const o = { "Content-Type": "application/json", ...this.setAuthHeaderForToken(this.options.token || null) }, s = await this.httpRequest(a, o, r);
        if (s)
          return JSON.parse(s);
      } catch (o) {
        if (o instanceof yt.HttpError && o.statusCode === 404)
          continue;
        throw (0, yt.newError)(`Unable to find release ${i} on GitLab (${a}): ${o.stack || o.message}`, "ERR_UPDATER_RELEASE_NOT_FOUND");
      }
    }
    throw (0, yt.newError)(`Unable to find release with version ${t} (tried: ${n.join(", ")}) on GitLab`, "ERR_UPDATER_RELEASE_NOT_FOUND");
  }
  setAuthHeaderForToken(t) {
    const r = {};
    return t != null && (t.startsWith("Bearer") ? r.authorization = t : r["PRIVATE-TOKEN"] = t), r;
  }
  /**
   * Get version info for blockmap files, using cache when possible
   */
  async getVersionInfoForBlockMap(t) {
    if (this.cachedLatestVersion && this.cachedLatestVersion.version === t)
      return this.cachedLatestVersion.assets;
    const r = await this.fetchReleaseInfoByVersion(t);
    return r && r.assets ? this.convertAssetsToMap(r.assets) : null;
  }
  /**
   * Find blockmap URLs from version assets
   */
  async findBlockMapUrlsFromAssets(t, r, n) {
    let i = null, a = null;
    const o = await this.getVersionInfoForBlockMap(r);
    o && (i = this.findBlockMapInAssets(o, n));
    const s = await this.getVersionInfoForBlockMap(t);
    if (s) {
      const l = n.replace(new RegExp(eP(r), "g"), t);
      a = this.findBlockMapInAssets(s, l);
    }
    return [a, i];
  }
  async getBlockMapFiles(t, r, n, i = null) {
    if (this.options.uploadTarget === "project_upload") {
      const a = t.pathname.split("/").pop() || "", [o, s] = await this.findBlockMapUrlsFromAssets(r, n, a);
      if (!s)
        throw (0, yt.newError)(`Cannot find blockmap file for ${n} in GitLab assets`, "ERR_UPDATER_BLOCKMAP_FILE_NOT_FOUND");
      if (!o)
        throw (0, yt.newError)(`Cannot find blockmap file for ${r} in GitLab assets`, "ERR_UPDATER_BLOCKMAP_FILE_NOT_FOUND");
      return [o, s];
    } else
      return super.getBlockMapFiles(t, r, n, i);
  }
  resolveFiles(t) {
    return (0, Iu.getFileList)(t).map((r) => {
      const i = [
        r.url,
        // Original filename
        this.normalizeFilename(r.url)
        // Normalized filename (spaces/underscores → dashes)
      ].find((o) => t.assets.has(o)), a = i ? t.assets.get(i) : void 0;
      if (!a)
        throw (0, yt.newError)(`Cannot find asset "${r.url}" in GitLab release assets. Available assets: ${Array.from(t.assets.keys()).join(", ")}`, "ERR_UPDATER_ASSET_NOT_FOUND");
      return {
        url: new Nu.URL(a),
        info: r
      };
    });
  }
  toString() {
    return `GitLab (projectId: ${this.options.projectId}, channel: ${this.channel})`;
  }
}
Pl.GitLabProvider = tP;
var Rl = {};
Object.defineProperty(Rl, "__esModule", { value: !0 });
Rl.KeygenProvider = void 0;
const zd = et, Uu = dr, Lu = Ke;
class rP extends Lu.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      isUseMultipleRangeRequest: !1
    }), this.configuration = t, this.updater = r, this.defaultHostname = "api.keygen.sh";
    const i = this.configuration.host || this.defaultHostname;
    this.baseUrl = (0, Uu.newBaseUrl)(`https://${i}/v1/accounts/${this.configuration.account}/artifacts?product=${this.configuration.product}`);
  }
  get channel() {
    return this.updater.channel || this.configuration.channel || "stable";
  }
  async getLatestVersion() {
    const t = new zd.CancellationToken(), r = (0, Uu.getChannelFilename)(this.getCustomChannelName(this.channel)), n = (0, Uu.newUrlFromBase)(r, this.baseUrl, this.updater.isAddNoCacheQuery);
    try {
      const i = await this.httpRequest(n, {
        Accept: "application/vnd.api+json",
        "Keygen-Version": "1.1"
      }, t);
      return (0, Lu.parseUpdateInfo)(i, r, n);
    } catch (i) {
      throw (0, zd.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${i.stack || i.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  resolveFiles(t) {
    return (0, Lu.resolveFiles)(t, this.baseUrl);
  }
  toString() {
    const { account: t, product: r, platform: n } = this.configuration;
    return `Keygen (account: ${t}, product: ${r}, platform: ${n}, channel: ${this.channel})`;
  }
}
Rl.KeygenProvider = rP;
var Ol = {};
Object.defineProperty(Ol, "__esModule", { value: !0 });
Ol.PrivateGitHubProvider = void 0;
const si = et, nP = ft, iP = Me, qd = yn, Vd = dr, aP = dn, oP = Ke;
class sP extends aP.BaseGitHubProvider {
  constructor(t, r, n, i) {
    super(t, "api.github.com", i), this.updater = r, this.token = n;
  }
  createRequestOptions(t, r) {
    const n = super.createRequestOptions(t, r);
    return n.redirect = "manual", n;
  }
  async getLatestVersion() {
    const t = new si.CancellationToken(), r = (0, Vd.getChannelFilename)(this.getDefaultChannelName()), n = await this.getLatestVersionInfo(t), i = n.assets.find((s) => s.name === r);
    if (i == null)
      throw (0, si.newError)(`Cannot find ${r} in the release ${n.html_url || n.name}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
    const a = new qd.URL(i.url);
    let o;
    try {
      o = (0, nP.load)(await this.httpRequest(a, this.configureHeaders("application/octet-stream"), t));
    } catch (s) {
      throw s instanceof si.HttpError && s.statusCode === 404 ? (0, si.newError)(`Cannot find ${r} in the latest release artifacts (${a}): ${s.stack || s.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : s;
    }
    return o.assets = n.assets, o;
  }
  get fileExtraDownloadHeaders() {
    return this.configureHeaders("application/octet-stream");
  }
  configureHeaders(t) {
    return {
      accept: t,
      authorization: `token ${this.token}`
    };
  }
  async getLatestVersionInfo(t) {
    const r = this.updater.allowPrerelease;
    let n = this.basePath;
    r || (n = `${n}/latest`);
    const i = (0, Vd.newUrlFromBase)(n, this.baseUrl);
    try {
      const a = JSON.parse(await this.httpRequest(i, this.configureHeaders("application/vnd.github.v3+json"), t));
      return r ? a.find((o) => o.prerelease) || a[0] : a;
    } catch (a) {
      throw (0, si.newError)(`Unable to find latest version on GitHub (${i}), please ensure a production release exists: ${a.stack || a.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  get basePath() {
    return this.computeGithubBasePath(`/repos/${this.options.owner}/${this.options.repo}/releases`);
  }
  resolveFiles(t) {
    return (0, oP.getFileList)(t).map((r) => {
      const n = iP.posix.basename(r.url).replace(/ /g, "-"), i = t.assets.find((a) => a != null && a.name === n);
      if (i == null)
        throw (0, si.newError)(`Cannot find asset "${n}" in: ${JSON.stringify(t.assets, null, 2)}`, "ERR_UPDATER_ASSET_NOT_FOUND");
      return {
        url: new qd.URL(i.url),
        info: r
      };
    });
  }
}
Ol.PrivateGitHubProvider = sP;
Object.defineProperty(Cl, "__esModule", { value: !0 });
Cl.isUrlProbablySupportMultiRangeRequests = Wg;
Cl.createClient = dP;
const ts = et, lP = Al, Hd = yo, uP = dn, cP = Pl, fP = Rl, hP = Ol;
function Wg(e) {
  return !e.includes("s3.amazonaws.com");
}
function dP(e, t, r) {
  if (typeof e == "string")
    throw (0, ts.newError)("Please pass PublishConfiguration object", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
  const n = e.provider;
  switch (n) {
    case "github": {
      const i = e, a = (i.private ? process.env.GH_TOKEN || process.env.GITHUB_TOKEN : null) || i.token;
      return a == null ? new uP.GitHubProvider(i, t, r) : new hP.PrivateGitHubProvider(i, t, a, r);
    }
    case "bitbucket":
      return new lP.BitbucketProvider(e, t, r);
    case "gitlab":
      return new cP.GitLabProvider(e, t, r);
    case "keygen":
      return new fP.KeygenProvider(e, t, r);
    case "s3":
    case "spaces":
      return new Hd.GenericProvider({
        provider: "generic",
        url: (0, ts.getS3LikeProviderBaseUrl)(e),
        channel: e.channel || null
      }, t, {
        ...r,
        // https://github.com/minio/minio/issues/5285#issuecomment-350428955
        isUseMultipleRangeRequest: !1
      });
    case "generic": {
      const i = e;
      return new Hd.GenericProvider(i, t, {
        ...r,
        isUseMultipleRangeRequest: i.useMultipleRangeRequest !== !1 && Wg(i.url)
      });
    }
    case "custom": {
      const i = e, a = i.updateProvider;
      if (!a)
        throw (0, ts.newError)("Custom provider not specified", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
      return new a(i, t, r);
    }
    default:
      throw (0, ts.newError)(`Unsupported provider: ${n}`, "ERR_UPDATER_UNSUPPORTED_PROVIDER");
  }
}
var Dl = {}, bo = {}, zi = {}, Jn = {};
Object.defineProperty(Jn, "__esModule", { value: !0 });
Jn.OperationKind = void 0;
Jn.computeOperations = pP;
var Un;
(function(e) {
  e[e.COPY = 0] = "COPY", e[e.DOWNLOAD = 1] = "DOWNLOAD";
})(Un || (Jn.OperationKind = Un = {}));
function pP(e, t, r) {
  const n = Gd(e.files), i = Gd(t.files);
  let a = null;
  const o = t.files[0], s = [], l = o.name, u = n.get(l);
  if (u == null)
    throw new Error(`no file ${l} in old blockmap`);
  const c = i.get(l);
  let f = 0;
  const { checksumToOffset: h, checksumToOldSize: d } = gP(n.get(l), u.offset, r);
  let p = o.offset;
  for (let v = 0; v < c.checksums.length; p += c.sizes[v], v++) {
    const y = c.sizes[v], m = c.checksums[v];
    let S = h.get(m);
    S != null && d.get(m) !== y && (r.warn(`Checksum ("${m}") matches, but size differs (old: ${d.get(m)}, new: ${y})`), S = void 0), S === void 0 ? (f++, a != null && a.kind === Un.DOWNLOAD && a.end === p ? a.end += y : (a = {
      kind: Un.DOWNLOAD,
      start: p,
      end: p + y
      // oldBlocks: null,
    }, Wd(a, s, m, v))) : a != null && a.kind === Un.COPY && a.end === S ? a.end += y : (a = {
      kind: Un.COPY,
      start: S,
      end: S + y
      // oldBlocks: [checksum]
    }, Wd(a, s, m, v));
  }
  return f > 0 && r.info(`File${o.name === "file" ? "" : " " + o.name} has ${f} changed blocks`), s;
}
const vP = process.env.DIFFERENTIAL_DOWNLOAD_PLAN_BUILDER_VALIDATE_RANGES === "true";
function Wd(e, t, r, n) {
  if (vP && t.length !== 0) {
    const i = t[t.length - 1];
    if (i.kind === e.kind && e.start < i.end && e.start > i.start) {
      const a = [i.start, i.end, e.start, e.end].reduce((o, s) => o < s ? o : s);
      throw new Error(`operation (block index: ${n}, checksum: ${r}, kind: ${Un[e.kind]}) overlaps previous operation (checksum: ${r}):
abs: ${i.start} until ${i.end} and ${e.start} until ${e.end}
rel: ${i.start - a} until ${i.end - a} and ${e.start - a} until ${e.end - a}`);
    }
  }
  t.push(e);
}
function gP(e, t, r) {
  const n = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map();
  let a = t;
  for (let o = 0; o < e.checksums.length; o++) {
    const s = e.checksums[o], l = e.sizes[o], u = i.get(s);
    if (u === void 0)
      n.set(s, a), i.set(s, l);
    else if (r.debug != null) {
      const c = u === l ? "(same size)" : `(size: ${u}, this size: ${l})`;
      r.debug(`${s} duplicated in blockmap ${c}, it doesn't lead to broken differential downloader, just corresponding block will be skipped)`);
    }
    a += l;
  }
  return { checksumToOffset: n, checksumToOldSize: i };
}
function Gd(e) {
  const t = /* @__PURE__ */ new Map();
  for (const r of e)
    t.set(r.name, r);
  return t;
}
Object.defineProperty(zi, "__esModule", { value: !0 });
zi.DataSplitter = void 0;
zi.copyData = Gg;
const rs = et, mP = Ae, yP = lo, bP = Jn, Kd = Buffer.from(`\r
\r
`);
var Yr;
(function(e) {
  e[e.INIT = 0] = "INIT", e[e.HEADER = 1] = "HEADER", e[e.BODY = 2] = "BODY";
})(Yr || (Yr = {}));
function Gg(e, t, r, n, i) {
  const a = (0, mP.createReadStream)("", {
    fd: r,
    autoClose: !1,
    start: e.start,
    // end is inclusive
    end: e.end - 1
  });
  a.on("error", n), a.once("end", i), a.pipe(t, {
    end: !1
  });
}
class wP extends yP.Writable {
  constructor(t, r, n, i, a, o, s, l) {
    super(), this.out = t, this.options = r, this.partIndexToTaskIndex = n, this.partIndexToLength = a, this.finishHandler = o, this.grandTotalBytes = s, this.onProgress = l, this.start = Date.now(), this.nextUpdate = this.start + 1e3, this.transferred = 0, this.delta = 0, this.partIndex = -1, this.headerListBuffer = null, this.readState = Yr.INIT, this.ignoreByteCount = 0, this.remainingPartDataCount = 0, this.actualPartLength = 0, this.boundaryLength = i.length + 4, this.ignoreByteCount = this.boundaryLength - 2;
  }
  get isFinished() {
    return this.partIndex === this.partIndexToLength.length;
  }
  // noinspection JSUnusedGlobalSymbols
  _write(t, r, n) {
    if (this.isFinished) {
      console.error(`Trailing ignored data: ${t.length} bytes`);
      return;
    }
    this.handleData(t).then(() => {
      if (this.onProgress) {
        const i = Date.now();
        (i >= this.nextUpdate || this.transferred === this.grandTotalBytes) && this.grandTotalBytes && (i - this.start) / 1e3 && (this.nextUpdate = i + 1e3, this.onProgress({
          total: this.grandTotalBytes,
          delta: this.delta,
          transferred: this.transferred,
          percent: this.transferred / this.grandTotalBytes * 100,
          bytesPerSecond: Math.round(this.transferred / ((i - this.start) / 1e3))
        }), this.delta = 0);
      }
      n();
    }).catch(n);
  }
  async handleData(t) {
    let r = 0;
    if (this.ignoreByteCount !== 0 && this.remainingPartDataCount !== 0)
      throw (0, rs.newError)("Internal error", "ERR_DATA_SPLITTER_BYTE_COUNT_MISMATCH");
    if (this.ignoreByteCount > 0) {
      const n = Math.min(this.ignoreByteCount, t.length);
      this.ignoreByteCount -= n, r = n;
    } else if (this.remainingPartDataCount > 0) {
      const n = Math.min(this.remainingPartDataCount, t.length);
      this.remainingPartDataCount -= n, await this.processPartData(t, 0, n), r = n;
    }
    if (r !== t.length) {
      if (this.readState === Yr.HEADER) {
        const n = this.searchHeaderListEnd(t, r);
        if (n === -1)
          return;
        r = n, this.readState = Yr.BODY, this.headerListBuffer = null;
      }
      for (; ; ) {
        if (this.readState === Yr.BODY)
          this.readState = Yr.INIT;
        else {
          this.partIndex++;
          let o = this.partIndexToTaskIndex.get(this.partIndex);
          if (o == null)
            if (this.isFinished)
              o = this.options.end;
            else
              throw (0, rs.newError)("taskIndex is null", "ERR_DATA_SPLITTER_TASK_INDEX_IS_NULL");
          const s = this.partIndex === 0 ? this.options.start : this.partIndexToTaskIndex.get(this.partIndex - 1) + 1;
          if (s < o)
            await this.copyExistingData(s, o);
          else if (s > o)
            throw (0, rs.newError)("prevTaskIndex must be < taskIndex", "ERR_DATA_SPLITTER_TASK_INDEX_ASSERT_FAILED");
          if (this.isFinished) {
            this.onPartEnd(), this.finishHandler();
            return;
          }
          if (r = this.searchHeaderListEnd(t, r), r === -1) {
            this.readState = Yr.HEADER;
            return;
          }
        }
        const n = this.partIndexToLength[this.partIndex], i = r + n, a = Math.min(i, t.length);
        if (await this.processPartStarted(t, r, a), this.remainingPartDataCount = n - (a - r), this.remainingPartDataCount > 0)
          return;
        if (r = i + this.boundaryLength, r >= t.length) {
          this.ignoreByteCount = this.boundaryLength - (t.length - i);
          return;
        }
      }
    }
  }
  copyExistingData(t, r) {
    return new Promise((n, i) => {
      const a = () => {
        if (t === r) {
          n();
          return;
        }
        const o = this.options.tasks[t];
        if (o.kind !== bP.OperationKind.COPY) {
          i(new Error("Task kind must be COPY"));
          return;
        }
        Gg(o, this.out, this.options.oldFileFd, i, () => {
          t++, a();
        });
      };
      a();
    });
  }
  searchHeaderListEnd(t, r) {
    const n = t.indexOf(Kd, r);
    if (n !== -1)
      return n + Kd.length;
    const i = r === 0 ? t : t.slice(r);
    return this.headerListBuffer == null ? this.headerListBuffer = i : this.headerListBuffer = Buffer.concat([this.headerListBuffer, i]), -1;
  }
  onPartEnd() {
    const t = this.partIndexToLength[this.partIndex - 1];
    if (this.actualPartLength !== t)
      throw (0, rs.newError)(`Expected length: ${t} differs from actual: ${this.actualPartLength}`, "ERR_DATA_SPLITTER_LENGTH_MISMATCH");
    this.actualPartLength = 0;
  }
  processPartStarted(t, r, n) {
    return this.partIndex !== 0 && this.onPartEnd(), this.processPartData(t, r, n);
  }
  processPartData(t, r, n) {
    this.actualPartLength += n - r, this.transferred += n - r, this.delta += n - r;
    const i = this.out;
    return i.write(r === 0 && t.length === n ? t : t.slice(r, n)) ? Promise.resolve() : new Promise((a, o) => {
      i.on("error", o), i.once("drain", () => {
        i.removeListener("error", o), a();
      });
    });
  }
}
zi.DataSplitter = wP;
var kl = {};
Object.defineProperty(kl, "__esModule", { value: !0 });
kl.executeTasksUsingMultipleRangeRequests = xP;
kl.checkIsRangesSupported = Ec;
const xc = et, Xd = zi, Yd = Jn;
function xP(e, t, r, n, i) {
  const a = (o) => {
    if (o >= t.length) {
      e.fileMetadataBuffer != null && r.write(e.fileMetadataBuffer), r.end();
      return;
    }
    const s = o + 1e3;
    EP(e, {
      tasks: t,
      start: o,
      end: Math.min(t.length, s),
      oldFileFd: n
    }, r, () => a(s), i);
  };
  return a;
}
function EP(e, t, r, n, i) {
  let a = "bytes=", o = 0, s = 0;
  const l = /* @__PURE__ */ new Map(), u = [];
  for (let h = t.start; h < t.end; h++) {
    const d = t.tasks[h];
    d.kind === Yd.OperationKind.DOWNLOAD && (a += `${d.start}-${d.end - 1}, `, l.set(o, h), o++, u.push(d.end - d.start), s += d.end - d.start);
  }
  if (o <= 1) {
    const h = (d) => {
      if (d >= t.end) {
        n();
        return;
      }
      const p = t.tasks[d++];
      if (p.kind === Yd.OperationKind.COPY)
        (0, Xd.copyData)(p, r, t.oldFileFd, i, () => h(d));
      else {
        const v = e.createRequestOptions();
        v.headers.Range = `bytes=${p.start}-${p.end - 1}`;
        const y = e.httpExecutor.createRequest(v, (m) => {
          m.on("error", i), Ec(m, i) && (m.pipe(r, {
            end: !1
          }), m.once("end", () => h(d)));
        });
        e.httpExecutor.addErrorAndTimeoutHandlers(y, i), y.end();
      }
    };
    h(t.start);
    return;
  }
  const c = e.createRequestOptions();
  c.headers.Range = a.substring(0, a.length - 2);
  const f = e.httpExecutor.createRequest(c, (h) => {
    if (!Ec(h, i))
      return;
    const d = (0, xc.safeGetHeader)(h, "content-type"), p = /^multipart\/.+?\s*;\s*boundary=(?:"([^"]+)"|([^\s";]+))\s*$/i.exec(d);
    if (p == null) {
      i(new Error(`Content-Type "multipart/byteranges" is expected, but got "${d}"`));
      return;
    }
    const v = new Xd.DataSplitter(r, t, l, p[1] || p[2], u, n, s, e.options.onProgress);
    v.on("error", i), h.pipe(v), h.on("end", () => {
      setTimeout(() => {
        f.abort(), i(new Error("Response ends without calling any handlers"));
      }, 1e4);
    });
  });
  e.httpExecutor.addErrorAndTimeoutHandlers(f, i), f.end();
}
function Ec(e, t) {
  if (e.statusCode >= 400)
    return t((0, xc.createHttpError)(e)), !1;
  if (e.statusCode !== 206) {
    const r = (0, xc.safeGetHeader)(e, "accept-ranges");
    if (r == null || r === "none")
      return t(new Error(`Server doesn't support Accept-Ranges (response code ${e.statusCode})`)), !1;
  }
  return !0;
}
var Nl = {};
Object.defineProperty(Nl, "__esModule", { value: !0 });
Nl.ProgressDifferentialDownloadCallbackTransform = void 0;
const SP = lo;
var xi;
(function(e) {
  e[e.COPY = 0] = "COPY", e[e.DOWNLOAD = 1] = "DOWNLOAD";
})(xi || (xi = {}));
class FP extends SP.Transform {
  constructor(t, r, n) {
    super(), this.progressDifferentialDownloadInfo = t, this.cancellationToken = r, this.onProgress = n, this.start = Date.now(), this.transferred = 0, this.delta = 0, this.expectedBytes = 0, this.index = 0, this.operationType = xi.COPY, this.nextUpdate = this.start + 1e3;
  }
  _transform(t, r, n) {
    if (this.cancellationToken.cancelled) {
      n(new Error("cancelled"), null);
      return;
    }
    if (this.operationType == xi.COPY) {
      n(null, t);
      return;
    }
    this.transferred += t.length, this.delta += t.length;
    const i = Date.now();
    i >= this.nextUpdate && this.transferred !== this.expectedBytes && this.transferred !== this.progressDifferentialDownloadInfo.grandTotal && (this.nextUpdate = i + 1e3, this.onProgress({
      total: this.progressDifferentialDownloadInfo.grandTotal,
      delta: this.delta,
      transferred: this.transferred,
      percent: this.transferred / this.progressDifferentialDownloadInfo.grandTotal * 100,
      bytesPerSecond: Math.round(this.transferred / ((i - this.start) / 1e3))
    }), this.delta = 0), n(null, t);
  }
  beginFileCopy() {
    this.operationType = xi.COPY;
  }
  beginRangeDownload() {
    this.operationType = xi.DOWNLOAD, this.expectedBytes += this.progressDifferentialDownloadInfo.expectedByteCounts[this.index++];
  }
  endRangeDownload() {
    this.transferred !== this.progressDifferentialDownloadInfo.grandTotal && this.onProgress({
      total: this.progressDifferentialDownloadInfo.grandTotal,
      delta: this.delta,
      transferred: this.transferred,
      percent: this.transferred / this.progressDifferentialDownloadInfo.grandTotal * 100,
      bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
    });
  }
  // Called when we are 100% done with the connection/download
  _flush(t) {
    if (this.cancellationToken.cancelled) {
      t(new Error("cancelled"));
      return;
    }
    this.onProgress({
      total: this.progressDifferentialDownloadInfo.grandTotal,
      delta: this.delta,
      transferred: this.transferred,
      percent: 100,
      bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
    }), this.delta = 0, this.transferred = 0, t(null);
  }
}
Nl.ProgressDifferentialDownloadCallbackTransform = FP;
Object.defineProperty(bo, "__esModule", { value: !0 });
bo.DifferentialDownloader = void 0;
const na = et, Bu = bn, TP = Ae, CP = zi, AP = yn, ns = Jn, Zd = kl, PP = Nl;
class RP {
  // noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
  constructor(t, r, n) {
    this.blockAwareFileInfo = t, this.httpExecutor = r, this.options = n, this.fileMetadataBuffer = null, this.logger = n.logger;
  }
  createRequestOptions() {
    const t = {
      headers: {
        ...this.options.requestHeaders,
        accept: "*/*"
      }
    };
    return (0, na.configureRequestUrl)(this.options.newUrl, t), (0, na.configureRequestOptions)(t), t;
  }
  doDownload(t, r) {
    if (t.version !== r.version)
      throw new Error(`version is different (${t.version} - ${r.version}), full download is required`);
    const n = this.logger, i = (0, ns.computeOperations)(t, r, n);
    n.debug != null && n.debug(JSON.stringify(i, null, 2));
    let a = 0, o = 0;
    for (const l of i) {
      const u = l.end - l.start;
      l.kind === ns.OperationKind.DOWNLOAD ? a += u : o += u;
    }
    const s = this.blockAwareFileInfo.size;
    if (a + o + (this.fileMetadataBuffer == null ? 0 : this.fileMetadataBuffer.length) !== s)
      throw new Error(`Internal error, size mismatch: downloadSize: ${a}, copySize: ${o}, newSize: ${s}`);
    return n.info(`Full: ${Jd(s)}, To download: ${Jd(a)} (${Math.round(a / (s / 100))}%)`), this.downloadFile(i);
  }
  downloadFile(t) {
    const r = [], n = () => Promise.all(r.map((i) => (0, Bu.close)(i.descriptor).catch((a) => {
      this.logger.error(`cannot close file "${i.path}": ${a}`);
    })));
    return this.doDownloadFile(t, r).then(n).catch((i) => n().catch((a) => {
      try {
        this.logger.error(`cannot close files: ${a}`);
      } catch (o) {
        try {
          console.error(o);
        } catch {
        }
      }
      throw i;
    }).then(() => {
      throw i;
    }));
  }
  async doDownloadFile(t, r) {
    const n = await (0, Bu.open)(this.options.oldFile, "r");
    r.push({ descriptor: n, path: this.options.oldFile });
    const i = await (0, Bu.open)(this.options.newFile, "w");
    r.push({ descriptor: i, path: this.options.newFile });
    const a = (0, TP.createWriteStream)(this.options.newFile, { fd: i });
    await new Promise((o, s) => {
      const l = [];
      let u;
      if (!this.options.isUseMultipleRangeRequest && this.options.onProgress) {
        const m = [];
        let S = 0;
        for (const C of t)
          C.kind === ns.OperationKind.DOWNLOAD && (m.push(C.end - C.start), S += C.end - C.start);
        const T = {
          expectedByteCounts: m,
          grandTotal: S
        };
        u = new PP.ProgressDifferentialDownloadCallbackTransform(T, this.options.cancellationToken, this.options.onProgress), l.push(u);
      }
      const c = new na.DigestTransform(this.blockAwareFileInfo.sha512);
      c.isValidateOnEnd = !1, l.push(c), a.on("finish", () => {
        a.close(() => {
          r.splice(1, 1);
          try {
            c.validate();
          } catch (m) {
            s(m);
            return;
          }
          o(void 0);
        });
      }), l.push(a);
      let f = null;
      for (const m of l)
        m.on("error", s), f == null ? f = m : f = f.pipe(m);
      const h = l[0];
      let d;
      if (this.options.isUseMultipleRangeRequest) {
        d = (0, Zd.executeTasksUsingMultipleRangeRequests)(this, t, h, n, s), d(0);
        return;
      }
      let p = 0, v = null;
      this.logger.info(`Differential download: ${this.options.newUrl}`);
      const y = this.createRequestOptions();
      y.redirect = "manual", d = (m) => {
        var S, T;
        if (m >= t.length) {
          this.fileMetadataBuffer != null && h.write(this.fileMetadataBuffer), h.end();
          return;
        }
        const C = t[m++];
        if (C.kind === ns.OperationKind.COPY) {
          u && u.beginFileCopy(), (0, CP.copyData)(C, h, n, s, () => d(m));
          return;
        }
        const A = `bytes=${C.start}-${C.end - 1}`;
        y.headers.range = A, (T = (S = this.logger) === null || S === void 0 ? void 0 : S.debug) === null || T === void 0 || T.call(S, `download range: ${A}`), u && u.beginRangeDownload();
        const O = this.httpExecutor.createRequest(y, (k) => {
          k.on("error", s), k.on("aborted", () => {
            s(new Error("response has been aborted by the server"));
          }), k.statusCode >= 400 && s((0, na.createHttpError)(k)), k.pipe(h, {
            end: !1
          }), k.once("end", () => {
            u && u.endRangeDownload(), ++p === 100 ? (p = 0, setTimeout(() => d(m), 1e3)) : d(m);
          });
        });
        O.on("redirect", (k, M, b) => {
          this.logger.info(`Redirect to ${OP(b)}`), v = b, (0, na.configureRequestUrl)(new AP.URL(v), y), O.followRedirect();
        }), this.httpExecutor.addErrorAndTimeoutHandlers(O, s), O.end();
      }, d(0);
    });
  }
  async readRemoteBytes(t, r) {
    const n = Buffer.allocUnsafe(r + 1 - t), i = this.createRequestOptions();
    i.headers.range = `bytes=${t}-${r}`;
    let a = 0;
    if (await this.request(i, (o) => {
      o.copy(n, a), a += o.length;
    }), a !== n.length)
      throw new Error(`Received data length ${a} is not equal to expected ${n.length}`);
    return n;
  }
  request(t, r) {
    return new Promise((n, i) => {
      const a = this.httpExecutor.createRequest(t, (o) => {
        (0, Zd.checkIsRangesSupported)(o, i) && (o.on("error", i), o.on("aborted", () => {
          i(new Error("response has been aborted by the server"));
        }), o.on("data", r), o.on("end", () => n()));
      });
      this.httpExecutor.addErrorAndTimeoutHandlers(a, i), a.end();
    });
  }
}
bo.DifferentialDownloader = RP;
function Jd(e, t = " KB") {
  return new Intl.NumberFormat("en").format((e / 1024).toFixed(2)) + t;
}
function OP(e) {
  const t = e.indexOf("?");
  return t < 0 ? e : e.substring(0, t);
}
Object.defineProperty(Dl, "__esModule", { value: !0 });
Dl.GenericDifferentialDownloader = void 0;
const DP = bo;
class kP extends DP.DifferentialDownloader {
  download(t, r) {
    return this.doDownload(t, r);
  }
}
Dl.GenericDifferentialDownloader = kP;
var wn = {};
(function(e) {
  Object.defineProperty(e, "__esModule", { value: !0 }), e.UpdaterSignal = e.UPDATE_DOWNLOADED = e.DOWNLOAD_PROGRESS = e.CancellationToken = void 0, e.addHandler = n;
  const t = et;
  Object.defineProperty(e, "CancellationToken", { enumerable: !0, get: function() {
    return t.CancellationToken;
  } }), e.DOWNLOAD_PROGRESS = "download-progress", e.UPDATE_DOWNLOADED = "update-downloaded";
  class r {
    constructor(a) {
      this.emitter = a;
    }
    /**
     * Emitted when an authenticating proxy is [asking for user credentials](https://github.com/electron/electron/blob/master/docs/api/client-request.md#event-login).
     */
    login(a) {
      n(this.emitter, "login", a);
    }
    progress(a) {
      n(this.emitter, e.DOWNLOAD_PROGRESS, a);
    }
    updateDownloaded(a) {
      n(this.emitter, e.UPDATE_DOWNLOADED, a);
    }
    updateCancelled(a) {
      n(this.emitter, "update-cancelled", a);
    }
  }
  e.UpdaterSignal = r;
  function n(i, a, o) {
    i.on(a, o);
  }
})(wn);
Object.defineProperty(un, "__esModule", { value: !0 });
un.NoOpLogger = un.AppUpdater = void 0;
const bt = et, NP = Bi, IP = fl, UP = Bp, rr = bn, LP = ft, Mu = bl, nr = Me, Dn = Bg, Qd = mo, BP = Tl, $d = Mg, MP = yo, ju = Cl, _u = jp, jP = Dl, li = wn;
class Ef extends UP.EventEmitter {
  /**
   * Get the update channel. Doesn't return `channel` from the update configuration, only if was previously set.
   */
  get channel() {
    return this._channel;
  }
  /**
   * Set the update channel. Overrides `channel` in the update configuration.
   *
   * `allowDowngrade` will be automatically set to `true`. If this behavior is not suitable for you, simple set `allowDowngrade` explicitly after.
   */
  set channel(t) {
    if (this._channel != null) {
      if (typeof t != "string")
        throw (0, bt.newError)(`Channel must be a string, but got: ${t}`, "ERR_UPDATER_INVALID_CHANNEL");
      if (t.length === 0)
        throw (0, bt.newError)("Channel must be not an empty string", "ERR_UPDATER_INVALID_CHANNEL");
    }
    this._channel = t, this.allowDowngrade = !0;
  }
  /**
   *  Shortcut for explicitly adding auth tokens to request headers
   */
  addAuthHeader(t) {
    this.requestHeaders = Object.assign({}, this.requestHeaders, {
      authorization: t
    });
  }
  // noinspection JSMethodCanBeStatic,JSUnusedGlobalSymbols
  get netSession() {
    return (0, $d.getNetSession)();
  }
  /**
   * The logger. You can pass [electron-log](https://github.com/megahertz/electron-log), [winston](https://github.com/winstonjs/winston) or another logger with the following interface: `{ info(), warn(), error() }`.
   * Set it to `null` if you would like to disable a logging feature.
   */
  get logger() {
    return this._logger;
  }
  set logger(t) {
    this._logger = t ?? new Kg();
  }
  // noinspection JSUnusedGlobalSymbols
  /**
   * test only
   * @private
   */
  set updateConfigPath(t) {
    this.clientPromise = null, this._appUpdateConfigPath = t, this.configOnDisk = new Mu.Lazy(() => this.loadUpdateConfig());
  }
  /**
   * Allows developer to override default logic for determining if an update is supported.
   * The default logic compares the `UpdateInfo` minimum system version against the `os.release()` with `semver` package
   */
  get isUpdateSupported() {
    return this._isUpdateSupported;
  }
  set isUpdateSupported(t) {
    t && (this._isUpdateSupported = t);
  }
  /**
   * Allows developer to override default logic for determining if the user is below the rollout threshold.
   * The default logic compares the staging percentage with numerical representation of user ID.
   * An override can define custom logic, or bypass it if needed.
   */
  get isUserWithinRollout() {
    return this._isUserWithinRollout;
  }
  set isUserWithinRollout(t) {
    t && (this._isUserWithinRollout = t);
  }
  constructor(t, r) {
    super(), this.autoDownload = !0, this.autoInstallOnAppQuit = !0, this.autoRunAppAfterInstall = !0, this.allowPrerelease = !1, this.fullChangelog = !1, this.allowDowngrade = !1, this.disableWebInstaller = !1, this.disableDifferentialDownload = !1, this.forceDevUpdateConfig = !1, this.previousBlockmapBaseUrlOverride = null, this._channel = null, this.downloadedUpdateHelper = null, this.requestHeaders = null, this._logger = console, this.signals = new li.UpdaterSignal(this), this._appUpdateConfigPath = null, this._isUpdateSupported = (a) => this.checkIfUpdateSupported(a), this._isUserWithinRollout = (a) => this.isStagingMatch(a), this.clientPromise = null, this.stagingUserIdPromise = new Mu.Lazy(() => this.getOrCreateStagingUserId()), this.configOnDisk = new Mu.Lazy(() => this.loadUpdateConfig()), this.checkForUpdatesPromise = null, this.downloadPromise = null, this.updateInfoAndProvider = null, this._testOnlyOptions = null, this.on("error", (a) => {
      this._logger.error(`Error: ${a.stack || a.message}`);
    }), r == null ? (this.app = new BP.ElectronAppAdapter(), this.httpExecutor = new $d.ElectronHttpExecutor((a, o) => this.emit("login", a, o))) : (this.app = r, this.httpExecutor = null);
    const n = this.app.version, i = (0, Dn.parse)(n);
    if (i == null)
      throw (0, bt.newError)(`App version is not a valid semver version: "${n}"`, "ERR_UPDATER_INVALID_VERSION");
    this.currentVersion = i, this.allowPrerelease = _P(i), t != null && (this.setFeedURL(t), typeof t != "string" && t.requestHeaders && (this.requestHeaders = t.requestHeaders));
  }
  //noinspection JSMethodCanBeStatic,JSUnusedGlobalSymbols
  getFeedURL() {
    return "Deprecated. Do not use it.";
  }
  /**
   * Configure update provider. If value is `string`, [GenericServerOptions](./publish.md#genericserveroptions) will be set with value as `url`.
   * @param options If you want to override configuration in the `app-update.yml`.
   */
  setFeedURL(t) {
    const r = this.createProviderRuntimeOptions();
    let n;
    typeof t == "string" ? n = new MP.GenericProvider({ provider: "generic", url: t }, this, {
      ...r,
      isUseMultipleRangeRequest: (0, ju.isUrlProbablySupportMultiRangeRequests)(t)
    }) : n = (0, ju.createClient)(t, this, r), this.clientPromise = Promise.resolve(n);
  }
  /**
   * Asks the server whether there is an update.
   * @returns null if the updater is disabled, otherwise info about the latest version
   */
  checkForUpdates() {
    if (!this.isUpdaterActive())
      return Promise.resolve(null);
    let t = this.checkForUpdatesPromise;
    if (t != null)
      return this._logger.info("Checking for update (already in progress)"), t;
    const r = () => this.checkForUpdatesPromise = null;
    return this._logger.info("Checking for update"), t = this.doCheckForUpdates().then((n) => (r(), n)).catch((n) => {
      throw r(), this.emit("error", n, `Cannot check for updates: ${(n.stack || n).toString()}`), n;
    }), this.checkForUpdatesPromise = t, t;
  }
  isUpdaterActive() {
    return this.app.isPackaged || this.forceDevUpdateConfig ? !0 : (this._logger.info("Skip checkForUpdates because application is not packed and dev update config is not forced"), !1);
  }
  // noinspection JSUnusedGlobalSymbols
  checkForUpdatesAndNotify(t) {
    return this.checkForUpdates().then((r) => r != null && r.downloadPromise ? (r.downloadPromise.then(() => {
      const n = Ef.formatDownloadNotification(r.updateInfo.version, this.app.name, t);
      new _n.Notification(n).show();
    }), r) : (this._logger.debug != null && this._logger.debug("checkForUpdatesAndNotify called, downloadPromise is null"), r));
  }
  static formatDownloadNotification(t, r, n) {
    return n == null && (n = {
      title: "A new update is ready to install",
      body: "{appName} version {version} has been downloaded and will be automatically installed on exit"
    }), n = {
      title: n.title.replace("{appName}", r).replace("{version}", t),
      body: n.body.replace("{appName}", r).replace("{version}", t)
    }, n;
  }
  async isStagingMatch(t) {
    const r = t.stagingPercentage;
    let n = r;
    if (n == null)
      return !0;
    if (n = parseInt(n, 10), isNaN(n))
      return this._logger.warn(`Staging percentage is NaN: ${r}`), !0;
    n = n / 100;
    const i = await this.stagingUserIdPromise.value, o = bt.UUID.parse(i).readUInt32BE(12) / 4294967295;
    return this._logger.info(`Staging percentage: ${n}, percentage: ${o}, user id: ${i}`), o < n;
  }
  computeFinalHeaders(t) {
    return this.requestHeaders != null && Object.assign(t, this.requestHeaders), t;
  }
  async isUpdateAvailable(t) {
    const r = (0, Dn.parse)(t.version);
    if (r == null)
      throw (0, bt.newError)(`This file could not be downloaded, or the latest version (from update server) does not have a valid semver version: "${t.version}"`, "ERR_UPDATER_INVALID_VERSION");
    const n = this.currentVersion;
    if ((0, Dn.eq)(r, n) || !await Promise.resolve(this.isUpdateSupported(t)) || !await Promise.resolve(this.isUserWithinRollout(t)))
      return !1;
    const a = (0, Dn.gt)(r, n), o = (0, Dn.lt)(r, n);
    return a ? !0 : this.allowDowngrade && o;
  }
  checkIfUpdateSupported(t) {
    const r = t == null ? void 0 : t.minimumSystemVersion, n = (0, IP.release)();
    if (r)
      try {
        if ((0, Dn.lt)(n, r))
          return this._logger.info(`Current OS version ${n} is less than the minimum OS version required ${r} for version ${n}`), !1;
      } catch (i) {
        this._logger.warn(`Failed to compare current OS version(${n}) with minimum OS version(${r}): ${(i.message || i).toString()}`);
      }
    return !0;
  }
  async getUpdateInfoAndProvider() {
    await this.app.whenReady(), this.clientPromise == null && (this.clientPromise = this.configOnDisk.value.then((n) => (0, ju.createClient)(n, this, this.createProviderRuntimeOptions())));
    const t = await this.clientPromise, r = await this.stagingUserIdPromise.value;
    return t.setRequestHeaders(this.computeFinalHeaders({ "x-user-staging-id": r })), {
      info: await t.getLatestVersion(),
      provider: t
    };
  }
  createProviderRuntimeOptions() {
    return {
      isUseMultipleRangeRequest: !0,
      platform: this._testOnlyOptions == null ? process.platform : this._testOnlyOptions.platform,
      executor: this.httpExecutor
    };
  }
  async doCheckForUpdates() {
    this.emit("checking-for-update");
    const t = await this.getUpdateInfoAndProvider(), r = t.info;
    if (!await this.isUpdateAvailable(r))
      return this._logger.info(`Update for version ${this.currentVersion.format()} is not available (latest version: ${r.version}, downgrade is ${this.allowDowngrade ? "allowed" : "disallowed"}).`), this.emit("update-not-available", r), {
        isUpdateAvailable: !1,
        versionInfo: r,
        updateInfo: r
      };
    this.updateInfoAndProvider = t, this.onUpdateAvailable(r);
    const n = new bt.CancellationToken();
    return {
      isUpdateAvailable: !0,
      versionInfo: r,
      updateInfo: r,
      cancellationToken: n,
      downloadPromise: this.autoDownload ? this.downloadUpdate(n) : null
    };
  }
  onUpdateAvailable(t) {
    this._logger.info(`Found version ${t.version} (url: ${(0, bt.asArray)(t.files).map((r) => r.url).join(", ")})`), this.emit("update-available", t);
  }
  /**
   * Start downloading update manually. You can use this method if `autoDownload` option is set to `false`.
   * @returns {Promise<Array<string>>} Paths to downloaded files.
   */
  downloadUpdate(t = new bt.CancellationToken()) {
    const r = this.updateInfoAndProvider;
    if (r == null) {
      const i = new Error("Please check update first");
      return this.dispatchError(i), Promise.reject(i);
    }
    if (this.downloadPromise != null)
      return this._logger.info("Downloading update (already in progress)"), this.downloadPromise;
    this._logger.info(`Downloading update from ${(0, bt.asArray)(r.info.files).map((i) => i.url).join(", ")}`);
    const n = (i) => {
      if (!(i instanceof bt.CancellationError))
        try {
          this.dispatchError(i);
        } catch (a) {
          this._logger.warn(`Cannot dispatch error event: ${a.stack || a}`);
        }
      return i;
    };
    return this.downloadPromise = this.doDownloadUpdate({
      updateInfoAndProvider: r,
      requestHeaders: this.computeRequestHeaders(r.provider),
      cancellationToken: t,
      disableWebInstaller: this.disableWebInstaller,
      disableDifferentialDownload: this.disableDifferentialDownload
    }).catch((i) => {
      throw n(i);
    }).finally(() => {
      this.downloadPromise = null;
    }), this.downloadPromise;
  }
  dispatchError(t) {
    this.emit("error", t, (t.stack || t).toString());
  }
  dispatchUpdateDownloaded(t) {
    this.emit(li.UPDATE_DOWNLOADED, t);
  }
  async loadUpdateConfig() {
    return this._appUpdateConfigPath == null && (this._appUpdateConfigPath = this.app.appUpdateConfigPath), (0, LP.load)(await (0, rr.readFile)(this._appUpdateConfigPath, "utf-8"));
  }
  computeRequestHeaders(t) {
    const r = t.fileExtraDownloadHeaders;
    if (r != null) {
      const n = this.requestHeaders;
      return n == null ? r : {
        ...r,
        ...n
      };
    }
    return this.computeFinalHeaders({ accept: "*/*" });
  }
  async getOrCreateStagingUserId() {
    const t = nr.join(this.app.userDataPath, ".updaterId");
    try {
      const n = await (0, rr.readFile)(t, "utf-8");
      if (bt.UUID.check(n))
        return n;
      this._logger.warn(`Staging user id file exists, but content was invalid: ${n}`);
    } catch (n) {
      n.code !== "ENOENT" && this._logger.warn(`Couldn't read staging user ID, creating a blank one: ${n}`);
    }
    const r = bt.UUID.v5((0, NP.randomBytes)(4096), bt.UUID.OID);
    this._logger.info(`Generated new staging user ID: ${r}`);
    try {
      await (0, rr.outputFile)(t, r);
    } catch (n) {
      this._logger.warn(`Couldn't write out staging user ID: ${n}`);
    }
    return r;
  }
  /** @internal */
  get isAddNoCacheQuery() {
    const t = this.requestHeaders;
    if (t == null)
      return !0;
    for (const r of Object.keys(t)) {
      const n = r.toLowerCase();
      if (n === "authorization" || n === "private-token")
        return !1;
    }
    return !0;
  }
  async getOrCreateDownloadHelper() {
    let t = this.downloadedUpdateHelper;
    if (t == null) {
      const r = (await this.configOnDisk.value).updaterCacheDirName, n = this._logger;
      r == null && n.error("updaterCacheDirName is not specified in app-update.yml Was app build using at least electron-builder 20.34.0?");
      const i = nr.join(this.app.baseCachePath, r || this.app.name);
      n.debug != null && n.debug(`updater cache dir: ${i}`), t = new Qd.DownloadedUpdateHelper(i), this.downloadedUpdateHelper = t;
    }
    return t;
  }
  async executeDownload(t) {
    const r = t.fileInfo, n = {
      headers: t.downloadUpdateOptions.requestHeaders,
      cancellationToken: t.downloadUpdateOptions.cancellationToken,
      sha2: r.info.sha2,
      sha512: r.info.sha512
    };
    this.listenerCount(li.DOWNLOAD_PROGRESS) > 0 && (n.onProgress = (S) => this.emit(li.DOWNLOAD_PROGRESS, S));
    const i = t.downloadUpdateOptions.updateInfoAndProvider.info, a = i.version, o = r.packageInfo;
    function s() {
      const S = decodeURIComponent(t.fileInfo.url.pathname);
      return S.toLowerCase().endsWith(`.${t.fileExtension.toLowerCase()}`) ? nr.basename(S) : t.fileInfo.info.url;
    }
    const l = await this.getOrCreateDownloadHelper(), u = l.cacheDirForPendingUpdate;
    await (0, rr.mkdir)(u, { recursive: !0 });
    const c = s();
    let f = nr.join(u, c);
    const h = o == null ? null : nr.join(u, `package-${a}${nr.extname(o.path) || ".7z"}`), d = async (S) => {
      await l.setDownloadedFile(f, h, i, r, c, S), await t.done({
        ...i,
        downloadedFile: f
      });
      const T = nr.join(u, "current.blockmap");
      return await (0, rr.pathExists)(T) && await (0, rr.copyFile)(T, nr.join(l.cacheDir, "current.blockmap")), h == null ? [f] : [f, h];
    }, p = this._logger, v = await l.validateDownloadedPath(f, i, r, p);
    if (v != null)
      return f = v, await d(!1);
    const y = async () => (await l.clear().catch(() => {
    }), await (0, rr.unlink)(f).catch(() => {
    })), m = await (0, Qd.createTempUpdateFile)(`temp-${c}`, u, p);
    try {
      await t.task(m, n, h, y), await (0, bt.retry)(() => (0, rr.rename)(m, f), {
        retries: 60,
        interval: 500,
        shouldRetry: (S) => S instanceof Error && /^EBUSY:/.test(S.message) ? !0 : (p.warn(`Cannot rename temp file to final file: ${S.message || S.stack}`), !1)
      });
    } catch (S) {
      throw await y(), S instanceof bt.CancellationError && (p.info("cancelled"), this.emit("update-cancelled", i)), S;
    }
    return p.info(`New version ${a} has been downloaded to ${f}`), await d(!0);
  }
  async differentialDownloadInstaller(t, r, n, i, a) {
    try {
      if (this._testOnlyOptions != null && !this._testOnlyOptions.isUseDifferentialDownload)
        return !0;
      const o = r.updateInfoAndProvider.provider, s = await o.getBlockMapFiles(t.url, this.app.version, r.updateInfoAndProvider.info.version, this.previousBlockmapBaseUrlOverride);
      this._logger.info(`Download block maps (old: "${s[0]}", new: ${s[1]})`);
      const l = async (p) => {
        const v = await this.httpExecutor.downloadToBuffer(p, {
          headers: r.requestHeaders,
          cancellationToken: r.cancellationToken
        });
        if (v == null || v.length === 0)
          throw new Error(`Blockmap "${p.href}" is empty`);
        try {
          return JSON.parse((0, _u.gunzipSync)(v).toString());
        } catch (y) {
          throw new Error(`Cannot parse blockmap "${p.href}", error: ${y}`);
        }
      }, u = {
        newUrl: t.url,
        oldFile: nr.join(this.downloadedUpdateHelper.cacheDir, a),
        logger: this._logger,
        newFile: n,
        isUseMultipleRangeRequest: o.isUseMultipleRangeRequest,
        requestHeaders: r.requestHeaders,
        cancellationToken: r.cancellationToken
      };
      this.listenerCount(li.DOWNLOAD_PROGRESS) > 0 && (u.onProgress = (p) => this.emit(li.DOWNLOAD_PROGRESS, p));
      const c = async (p, v) => {
        const y = nr.join(v, "current.blockmap");
        await (0, rr.outputFile)(y, (0, _u.gzipSync)(JSON.stringify(p)));
      }, f = async (p) => {
        const v = nr.join(p, "current.blockmap");
        try {
          if (await (0, rr.pathExists)(v))
            return JSON.parse((0, _u.gunzipSync)(await (0, rr.readFile)(v)).toString());
        } catch (y) {
          this._logger.warn(`Cannot parse blockmap "${v}", error: ${y}`);
        }
        return null;
      }, h = await l(s[1]);
      await c(h, this.downloadedUpdateHelper.cacheDirForPendingUpdate);
      let d = await f(this.downloadedUpdateHelper.cacheDir);
      return d == null && (d = await l(s[0])), await new jP.GenericDifferentialDownloader(t.info, this.httpExecutor, u).download(d, h), !1;
    } catch (o) {
      if (this._logger.error(`Cannot download differentially, fallback to full download: ${o.stack || o}`), this._testOnlyOptions != null)
        throw o;
      return !0;
    }
  }
}
un.AppUpdater = Ef;
function _P(e) {
  const t = (0, Dn.prerelease)(e);
  return t != null && t.length > 0;
}
class Kg {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  info(t) {
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  warn(t) {
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error(t) {
  }
}
un.NoOpLogger = Kg;
Object.defineProperty(Zn, "__esModule", { value: !0 });
Zn.BaseUpdater = void 0;
const e0 = cl, zP = un;
class qP extends zP.AppUpdater {
  constructor(t, r) {
    super(t, r), this.quitAndInstallCalled = !1, this.quitHandlerAdded = !1;
  }
  quitAndInstall(t = !1, r = !1) {
    this._logger.info("Install on explicit quitAndInstall"), this.install(t, t ? r : this.autoRunAppAfterInstall) ? setImmediate(() => {
      _n.autoUpdater.emit("before-quit-for-update"), this.app.quit();
    }) : this.quitAndInstallCalled = !1;
  }
  executeDownload(t) {
    return super.executeDownload({
      ...t,
      done: (r) => (this.dispatchUpdateDownloaded(r), this.addQuitHandler(), Promise.resolve())
    });
  }
  get installerPath() {
    return this.downloadedUpdateHelper == null ? null : this.downloadedUpdateHelper.file;
  }
  // must be sync (because quit even handler is not async)
  install(t = !1, r = !1) {
    if (this.quitAndInstallCalled)
      return this._logger.warn("install call ignored: quitAndInstallCalled is set to true"), !1;
    const n = this.downloadedUpdateHelper, i = this.installerPath, a = n == null ? null : n.downloadedFileInfo;
    if (i == null || a == null)
      return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
    this.quitAndInstallCalled = !0;
    try {
      return this._logger.info(`Install: isSilent: ${t}, isForceRunAfter: ${r}`), this.doInstall({
        isSilent: t,
        isForceRunAfter: r,
        isAdminRightsRequired: a.isAdminRightsRequired
      });
    } catch (o) {
      return this.dispatchError(o), !1;
    }
  }
  addQuitHandler() {
    this.quitHandlerAdded || !this.autoInstallOnAppQuit || (this.quitHandlerAdded = !0, this.app.onQuit((t) => {
      if (this.quitAndInstallCalled) {
        this._logger.info("Update installer has already been triggered. Quitting application.");
        return;
      }
      if (!this.autoInstallOnAppQuit) {
        this._logger.info("Update will not be installed on quit because autoInstallOnAppQuit is set to false.");
        return;
      }
      if (t !== 0) {
        this._logger.info(`Update will be not installed on quit because application is quitting with exit code ${t}`);
        return;
      }
      this._logger.info("Auto install update on quit"), this.install(!0, !1);
    }));
  }
  spawnSyncLog(t, r = [], n = {}) {
    this._logger.info(`Executing: ${t} with args: ${r}`);
    const i = (0, e0.spawnSync)(t, r, {
      env: { ...process.env, ...n },
      encoding: "utf-8",
      shell: !0
    }), { error: a, status: o, stdout: s, stderr: l } = i;
    if (a != null)
      throw this._logger.error(l), a;
    if (o != null && o !== 0)
      throw this._logger.error(l), new Error(`Command ${t} exited with code ${o}`);
    return s.trim();
  }
  /**
   * This handles both node 8 and node 10 way of emitting error when spawning a process
   *   - node 8: Throws the error
   *   - node 10: Emit the error(Need to listen with on)
   */
  // https://github.com/electron-userland/electron-builder/issues/1129
  // Node 8 sends errors: https://nodejs.org/dist/latest-v8.x/docs/api/errors.html#errors_common_system_errors
  async spawnLog(t, r = [], n = void 0, i = "ignore") {
    return this._logger.info(`Executing: ${t} with args: ${r}`), new Promise((a, o) => {
      try {
        const s = { stdio: i, env: n, detached: !0 }, l = (0, e0.spawn)(t, r, s);
        l.on("error", (u) => {
          o(u);
        }), l.unref(), l.pid !== void 0 && a(!0);
      } catch (s) {
        o(s);
      }
    });
  }
}
Zn.BaseUpdater = qP;
var Wa = {}, wo = {};
Object.defineProperty(wo, "__esModule", { value: !0 });
wo.FileWithEmbeddedBlockMapDifferentialDownloader = void 0;
const ui = bn, VP = bo, HP = jp;
class WP extends VP.DifferentialDownloader {
  async download() {
    const t = this.blockAwareFileInfo, r = t.size, n = r - (t.blockMapSize + 4);
    this.fileMetadataBuffer = await this.readRemoteBytes(n, r - 1);
    const i = Xg(this.fileMetadataBuffer.slice(0, this.fileMetadataBuffer.length - 4));
    await this.doDownload(await GP(this.options.oldFile), i);
  }
}
wo.FileWithEmbeddedBlockMapDifferentialDownloader = WP;
function Xg(e) {
  return JSON.parse((0, HP.inflateRawSync)(e).toString());
}
async function GP(e) {
  const t = await (0, ui.open)(e, "r");
  try {
    const r = (await (0, ui.fstat)(t)).size, n = Buffer.allocUnsafe(4);
    await (0, ui.read)(t, n, 0, n.length, r - n.length);
    const i = Buffer.allocUnsafe(n.readUInt32BE(0));
    return await (0, ui.read)(t, i, 0, i.length, r - n.length - i.length), await (0, ui.close)(t), Xg(i);
  } catch (r) {
    throw await (0, ui.close)(t), r;
  }
}
Object.defineProperty(Wa, "__esModule", { value: !0 });
Wa.AppImageUpdater = void 0;
const t0 = et, r0 = cl, KP = bn, XP = Ae, ia = Me, YP = Zn, ZP = wo, JP = Ke, n0 = wn;
class QP extends YP.BaseUpdater {
  constructor(t, r) {
    super(t, r);
  }
  isUpdaterActive() {
    return process.env.APPIMAGE == null && !this.forceDevUpdateConfig ? (process.env.SNAP == null ? this._logger.warn("APPIMAGE env is not defined, current application is not an AppImage") : this._logger.info("SNAP env is defined, updater is disabled"), !1) : super.isUpdaterActive();
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, JP.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "AppImage", ["rpm", "deb", "pacman"]);
    return this.executeDownload({
      fileExtension: "AppImage",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, a) => {
        const o = process.env.APPIMAGE;
        if (o == null)
          throw (0, t0.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
        (t.disableDifferentialDownload || await this.downloadDifferential(n, o, i, r, t)) && await this.httpExecutor.download(n.url, i, a), await (0, KP.chmod)(i, 493);
      }
    });
  }
  async downloadDifferential(t, r, n, i, a) {
    try {
      const o = {
        newUrl: t.url,
        oldFile: r,
        logger: this._logger,
        newFile: n,
        isUseMultipleRangeRequest: i.isUseMultipleRangeRequest,
        requestHeaders: a.requestHeaders,
        cancellationToken: a.cancellationToken
      };
      return this.listenerCount(n0.DOWNLOAD_PROGRESS) > 0 && (o.onProgress = (s) => this.emit(n0.DOWNLOAD_PROGRESS, s)), await new ZP.FileWithEmbeddedBlockMapDifferentialDownloader(t.info, this.httpExecutor, o).download(), !1;
    } catch (o) {
      return this._logger.error(`Cannot download differentially, fallback to full download: ${o.stack || o}`), process.platform === "linux";
    }
  }
  doInstall(t) {
    const r = process.env.APPIMAGE;
    if (r == null)
      throw (0, t0.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
    (0, XP.unlinkSync)(r);
    let n;
    const i = ia.basename(r), a = this.installerPath;
    if (a == null)
      return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
    ia.basename(a) === i || !/\d+\.\d+\.\d+/.test(i) ? n = r : n = ia.join(ia.dirname(r), ia.basename(a)), (0, r0.execFileSync)("mv", ["-f", a, n]), n !== r && this.emit("appimage-filename-updated", n);
    const o = {
      ...process.env,
      APPIMAGE_SILENT_INSTALL: "true"
    };
    return t.isForceRunAfter ? this.spawnLog(n, [], o) : (o.APPIMAGE_EXIT_AFTER_INSTALL = "true", (0, r0.execFileSync)(n, [], { env: o })), !0;
  }
}
Wa.AppImageUpdater = QP;
var Ga = {}, qi = {};
Object.defineProperty(qi, "__esModule", { value: !0 });
qi.LinuxUpdater = void 0;
const $P = Zn;
class eR extends $P.BaseUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /**
   * Returns true if the current process is running as root.
   */
  isRunningAsRoot() {
    var t;
    return ((t = process.getuid) === null || t === void 0 ? void 0 : t.call(process)) === 0;
  }
  /**
   * Sanitizies the installer path for using with command line tools.
   */
  get installerPath() {
    var t, r;
    return (r = (t = super.installerPath) === null || t === void 0 ? void 0 : t.replace(/\\/g, "\\\\").replace(/ /g, "\\ ")) !== null && r !== void 0 ? r : null;
  }
  runCommandWithSudoIfNeeded(t) {
    if (this.isRunningAsRoot())
      return this._logger.info("Running as root, no need to use sudo"), this.spawnSyncLog(t[0], t.slice(1));
    const { name: r } = this.app, n = `"${r} would like to update"`, i = this.sudoWithArgs(n);
    this._logger.info(`Running as non-root user, using sudo to install: ${i}`);
    let a = '"';
    return (/pkexec/i.test(i[0]) || i[0] === "sudo") && (a = ""), this.spawnSyncLog(i[0], [...i.length > 1 ? i.slice(1) : [], `${a}/bin/bash`, "-c", `'${t.join(" ")}'${a}`]);
  }
  sudoWithArgs(t) {
    const r = this.determineSudoCommand(), n = [r];
    return /kdesudo/i.test(r) ? (n.push("--comment", t), n.push("-c")) : /gksudo/i.test(r) ? n.push("--message", t) : /pkexec/i.test(r) && n.push("--disable-internal-agent"), n;
  }
  hasCommand(t) {
    try {
      return this.spawnSyncLog("command", ["-v", t]), !0;
    } catch {
      return !1;
    }
  }
  determineSudoCommand() {
    const t = ["gksudo", "kdesudo", "pkexec", "beesu"];
    for (const r of t)
      if (this.hasCommand(r))
        return r;
    return "sudo";
  }
  /**
   * Detects the package manager to use based on the available commands.
   * Allows overriding the default behavior by setting the ELECTRON_BUILDER_LINUX_PACKAGE_MANAGER environment variable.
   * If the environment variable is set, it will be used directly. (This is useful for testing each package manager logic path.)
   * Otherwise, it checks for the presence of the specified package manager commands in the order provided.
   * @param pms - An array of package manager commands to check for, in priority order.
   * @returns The detected package manager command or "unknown" if none are found.
   */
  detectPackageManager(t) {
    var r;
    const n = (r = process.env.ELECTRON_BUILDER_LINUX_PACKAGE_MANAGER) === null || r === void 0 ? void 0 : r.trim();
    if (n)
      return n;
    for (const i of t)
      if (this.hasCommand(i))
        return i;
    return this._logger.warn(`No package manager found in the list: ${t.join(", ")}. Defaulting to the first one: ${t[0]}`), t[0];
  }
}
qi.LinuxUpdater = eR;
Object.defineProperty(Ga, "__esModule", { value: !0 });
Ga.DebUpdater = void 0;
const tR = Ke, i0 = wn, rR = qi;
class Sf extends rR.LinuxUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, tR.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "deb", ["AppImage", "rpm", "pacman"]);
    return this.executeDownload({
      fileExtension: "deb",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, a) => {
        this.listenerCount(i0.DOWNLOAD_PROGRESS) > 0 && (a.onProgress = (o) => this.emit(i0.DOWNLOAD_PROGRESS, o)), await this.httpExecutor.download(n.url, i, a);
      }
    });
  }
  doInstall(t) {
    const r = this.installerPath;
    if (r == null)
      return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
    if (!this.hasCommand("dpkg") && !this.hasCommand("apt"))
      return this.dispatchError(new Error("Neither dpkg nor apt command found. Cannot install .deb package.")), !1;
    const n = ["dpkg", "apt"], i = this.detectPackageManager(n);
    try {
      Sf.installWithCommandRunner(i, r, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
    } catch (a) {
      return this.dispatchError(a), !1;
    }
    return t.isForceRunAfter && this.app.relaunch(), !0;
  }
  static installWithCommandRunner(t, r, n, i) {
    var a;
    if (t === "dpkg")
      try {
        n(["dpkg", "-i", r]);
      } catch (o) {
        i.warn((a = o.message) !== null && a !== void 0 ? a : o), i.warn("dpkg installation failed, trying to fix broken dependencies with apt-get"), n(["apt-get", "install", "-f", "-y"]);
      }
    else if (t === "apt")
      i.warn("Using apt to install a local .deb. This may fail for unsigned packages unless properly configured."), n([
        "apt",
        "install",
        "-y",
        "--allow-unauthenticated",
        // needed for unsigned .debs
        "--allow-downgrades",
        // allow lower version installs
        "--allow-change-held-packages",
        r
      ]);
    else
      throw new Error(`Package manager ${t} not supported`);
  }
}
Ga.DebUpdater = Sf;
var Ka = {};
Object.defineProperty(Ka, "__esModule", { value: !0 });
Ka.PacmanUpdater = void 0;
const a0 = wn, nR = Ke, iR = qi;
class Ff extends iR.LinuxUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, nR.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "pacman", ["AppImage", "deb", "rpm"]);
    return this.executeDownload({
      fileExtension: "pacman",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, a) => {
        this.listenerCount(a0.DOWNLOAD_PROGRESS) > 0 && (a.onProgress = (o) => this.emit(a0.DOWNLOAD_PROGRESS, o)), await this.httpExecutor.download(n.url, i, a);
      }
    });
  }
  doInstall(t) {
    const r = this.installerPath;
    if (r == null)
      return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
    try {
      Ff.installWithCommandRunner(r, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
    } catch (n) {
      return this.dispatchError(n), !1;
    }
    return t.isForceRunAfter && this.app.relaunch(), !0;
  }
  static installWithCommandRunner(t, r, n) {
    var i;
    try {
      r(["pacman", "-U", "--noconfirm", t]);
    } catch (a) {
      n.warn((i = a.message) !== null && i !== void 0 ? i : a), n.warn("pacman installation failed, attempting to update package database and retry");
      try {
        r(["pacman", "-Sy", "--noconfirm"]), r(["pacman", "-U", "--noconfirm", t]);
      } catch (o) {
        throw n.error("Retry after pacman -Sy failed"), o;
      }
    }
  }
}
Ka.PacmanUpdater = Ff;
var Xa = {};
Object.defineProperty(Xa, "__esModule", { value: !0 });
Xa.RpmUpdater = void 0;
const o0 = wn, aR = Ke, oR = qi;
class Tf extends oR.LinuxUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, aR.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "rpm", ["AppImage", "deb", "pacman"]);
    return this.executeDownload({
      fileExtension: "rpm",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, a) => {
        this.listenerCount(o0.DOWNLOAD_PROGRESS) > 0 && (a.onProgress = (o) => this.emit(o0.DOWNLOAD_PROGRESS, o)), await this.httpExecutor.download(n.url, i, a);
      }
    });
  }
  doInstall(t) {
    const r = this.installerPath;
    if (r == null)
      return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
    const n = ["zypper", "dnf", "yum", "rpm"], i = this.detectPackageManager(n);
    try {
      Tf.installWithCommandRunner(i, r, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
    } catch (a) {
      return this.dispatchError(a), !1;
    }
    return t.isForceRunAfter && this.app.relaunch(), !0;
  }
  static installWithCommandRunner(t, r, n, i) {
    if (t === "zypper")
      return n(["zypper", "--non-interactive", "--no-refresh", "install", "--allow-unsigned-rpm", "-f", r]);
    if (t === "dnf")
      return n(["dnf", "install", "--nogpgcheck", "-y", r]);
    if (t === "yum")
      return n(["yum", "install", "--nogpgcheck", "-y", r]);
    if (t === "rpm")
      return i.warn("Installing with rpm only (no dependency resolution)."), n(["rpm", "-Uvh", "--replacepkgs", "--replacefiles", "--nodeps", r]);
    throw new Error(`Package manager ${t} not supported`);
  }
}
Xa.RpmUpdater = Tf;
var Ya = {};
Object.defineProperty(Ya, "__esModule", { value: !0 });
Ya.MacUpdater = void 0;
const s0 = et, zu = bn, sR = Ae, l0 = Me, lR = Jb, uR = un, cR = Ke, u0 = cl, c0 = Bi;
class fR extends uR.AppUpdater {
  constructor(t, r) {
    super(t, r), this.nativeUpdater = _n.autoUpdater, this.squirrelDownloadedUpdate = !1, this.nativeUpdater.on("error", (n) => {
      this._logger.warn(n), this.emit("error", n);
    }), this.nativeUpdater.on("update-downloaded", () => {
      this.squirrelDownloadedUpdate = !0, this.debug("nativeUpdater.update-downloaded");
    });
  }
  debug(t) {
    this._logger.debug != null && this._logger.debug(t);
  }
  closeServerIfExists() {
    this.server && (this.debug("Closing proxy server"), this.server.close((t) => {
      t && this.debug("proxy server wasn't already open, probably attempted closing again as a safety check before quit");
    }));
  }
  async doDownloadUpdate(t) {
    let r = t.updateInfoAndProvider.provider.resolveFiles(t.updateInfoAndProvider.info);
    const n = this._logger, i = "sysctl.proc_translated";
    let a = !1;
    try {
      this.debug("Checking for macOS Rosetta environment"), a = (0, u0.execFileSync)("sysctl", [i], { encoding: "utf8" }).includes(`${i}: 1`), n.info(`Checked for macOS Rosetta environment (isRosetta=${a})`);
    } catch (f) {
      n.warn(`sysctl shell command to check for macOS Rosetta environment failed: ${f}`);
    }
    let o = !1;
    try {
      this.debug("Checking for arm64 in uname");
      const h = (0, u0.execFileSync)("uname", ["-a"], { encoding: "utf8" }).includes("ARM");
      n.info(`Checked 'uname -a': arm64=${h}`), o = o || h;
    } catch (f) {
      n.warn(`uname shell command to check for arm64 failed: ${f}`);
    }
    o = o || process.arch === "arm64" || a;
    const s = (f) => {
      var h;
      return f.url.pathname.includes("arm64") || ((h = f.info.url) === null || h === void 0 ? void 0 : h.includes("arm64"));
    };
    o && r.some(s) ? r = r.filter((f) => o === s(f)) : r = r.filter((f) => !s(f));
    const l = (0, cR.findFile)(r, "zip", ["pkg", "dmg"]);
    if (l == null)
      throw (0, s0.newError)(`ZIP file not provided: ${(0, s0.safeStringifyJson)(r)}`, "ERR_UPDATER_ZIP_FILE_NOT_FOUND");
    const u = t.updateInfoAndProvider.provider, c = "update.zip";
    return this.executeDownload({
      fileExtension: "zip",
      fileInfo: l,
      downloadUpdateOptions: t,
      task: async (f, h) => {
        const d = l0.join(this.downloadedUpdateHelper.cacheDir, c), p = () => (0, zu.pathExistsSync)(d) ? !t.disableDifferentialDownload : (n.info("Unable to locate previous update.zip for differential download (is this first install?), falling back to full download"), !1);
        let v = !0;
        p() && (v = await this.differentialDownloadInstaller(l, t, f, u, c)), v && await this.httpExecutor.download(l.url, f, h);
      },
      done: async (f) => {
        if (!t.disableDifferentialDownload)
          try {
            const h = l0.join(this.downloadedUpdateHelper.cacheDir, c);
            await (0, zu.copyFile)(f.downloadedFile, h);
          } catch (h) {
            this._logger.warn(`Unable to copy file for caching for future differential downloads: ${h.message}`);
          }
        return this.updateDownloaded(l, f);
      }
    });
  }
  async updateDownloaded(t, r) {
    var n;
    const i = r.downloadedFile, a = (n = t.info.size) !== null && n !== void 0 ? n : (await (0, zu.stat)(i)).size, o = this._logger, s = `fileToProxy=${t.url.href}`;
    this.closeServerIfExists(), this.debug(`Creating proxy server for native Squirrel.Mac (${s})`), this.server = (0, lR.createServer)(), this.debug(`Proxy server for native Squirrel.Mac is created (${s})`), this.server.on("close", () => {
      o.info(`Proxy server for native Squirrel.Mac is closed (${s})`);
    });
    const l = (u) => {
      const c = u.address();
      return typeof c == "string" ? c : `http://127.0.0.1:${c == null ? void 0 : c.port}`;
    };
    return await new Promise((u, c) => {
      const f = (0, c0.randomBytes)(64).toString("base64").replace(/\//g, "_").replace(/\+/g, "-"), h = Buffer.from(`autoupdater:${f}`, "ascii"), d = `/${(0, c0.randomBytes)(64).toString("hex")}.zip`;
      this.server.on("request", (p, v) => {
        const y = p.url;
        if (o.info(`${y} requested`), y === "/") {
          if (!p.headers.authorization || p.headers.authorization.indexOf("Basic ") === -1) {
            v.statusCode = 401, v.statusMessage = "Invalid Authentication Credentials", v.end(), o.warn("No authenthication info");
            return;
          }
          const T = p.headers.authorization.split(" ")[1], C = Buffer.from(T, "base64").toString("ascii"), [A, O] = C.split(":");
          if (A !== "autoupdater" || O !== f) {
            v.statusCode = 401, v.statusMessage = "Invalid Authentication Credentials", v.end(), o.warn("Invalid authenthication credentials");
            return;
          }
          const k = Buffer.from(`{ "url": "${l(this.server)}${d}" }`);
          v.writeHead(200, { "Content-Type": "application/json", "Content-Length": k.length }), v.end(k);
          return;
        }
        if (!y.startsWith(d)) {
          o.warn(`${y} requested, but not supported`), v.writeHead(404), v.end();
          return;
        }
        o.info(`${d} requested by Squirrel.Mac, pipe ${i}`);
        let m = !1;
        v.on("finish", () => {
          m || (this.nativeUpdater.removeListener("error", c), u([]));
        });
        const S = (0, sR.createReadStream)(i);
        S.on("error", (T) => {
          try {
            v.end();
          } catch (C) {
            o.warn(`cannot end response: ${C}`);
          }
          m = !0, this.nativeUpdater.removeListener("error", c), c(new Error(`Cannot pipe "${i}": ${T}`));
        }), v.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Length": a
        }), S.pipe(v);
      }), this.debug(`Proxy server for native Squirrel.Mac is starting to listen (${s})`), this.server.listen(0, "127.0.0.1", () => {
        this.debug(`Proxy server for native Squirrel.Mac is listening (address=${l(this.server)}, ${s})`), this.nativeUpdater.setFeedURL({
          url: l(this.server),
          headers: {
            "Cache-Control": "no-cache",
            Authorization: `Basic ${h.toString("base64")}`
          }
        }), this.dispatchUpdateDownloaded(r), this.autoInstallOnAppQuit ? (this.nativeUpdater.once("error", c), this.nativeUpdater.checkForUpdates()) : u([]);
      });
    });
  }
  handleUpdateDownloaded() {
    this.autoRunAppAfterInstall ? this.nativeUpdater.quitAndInstall() : this.app.quit(), this.closeServerIfExists();
  }
  quitAndInstall() {
    this.squirrelDownloadedUpdate ? this.handleUpdateDownloaded() : (this.nativeUpdater.on("update-downloaded", () => this.handleUpdateDownloaded()), this.autoInstallOnAppQuit || this.nativeUpdater.checkForUpdates());
  }
}
Ya.MacUpdater = fR;
var Za = {}, Cf = {};
Object.defineProperty(Cf, "__esModule", { value: !0 });
Cf.verifySignature = dR;
const f0 = et, Yg = cl, hR = fl, h0 = Me;
function Zg(e, t) {
  return ['set "PSModulePath=" & chcp 65001 >NUL & powershell.exe', ["-NoProfile", "-NonInteractive", "-InputFormat", "None", "-Command", e], {
    shell: !0,
    timeout: t
  }];
}
function dR(e, t, r) {
  return new Promise((n, i) => {
    const a = t.replace(/'/g, "''");
    r.info(`Verifying signature ${a}`), (0, Yg.execFile)(...Zg(`"Get-AuthenticodeSignature -LiteralPath '${a}' | ConvertTo-Json -Compress"`, 20 * 1e3), (o, s, l) => {
      var u;
      try {
        if (o != null || l) {
          qu(r, o, l, i), n(null);
          return;
        }
        const c = pR(s);
        if (c.Status === 0) {
          try {
            const p = h0.normalize(c.Path), v = h0.normalize(t);
            if (r.info(`LiteralPath: ${p}. Update Path: ${v}`), p !== v) {
              qu(r, new Error(`LiteralPath of ${p} is different than ${v}`), l, i), n(null);
              return;
            }
          } catch (p) {
            r.warn(`Unable to verify LiteralPath of update asset due to missing data.Path. Skipping this step of validation. Message: ${(u = p.message) !== null && u !== void 0 ? u : p.stack}`);
          }
          const h = (0, f0.parseDn)(c.SignerCertificate.Subject);
          let d = !1;
          for (const p of e) {
            const v = (0, f0.parseDn)(p);
            if (v.size ? d = Array.from(v.keys()).every((m) => v.get(m) === h.get(m)) : p === h.get("CN") && (r.warn(`Signature validated using only CN ${p}. Please add your full Distinguished Name (DN) to publisherNames configuration`), d = !0), d) {
              n(null);
              return;
            }
          }
        }
        const f = `publisherNames: ${e.join(" | ")}, raw info: ` + JSON.stringify(c, (h, d) => h === "RawData" ? void 0 : d, 2);
        r.warn(`Sign verification failed, installer signed with incorrect certificate: ${f}`), n(f);
      } catch (c) {
        qu(r, c, null, i), n(null);
        return;
      }
    });
  });
}
function pR(e) {
  const t = JSON.parse(e);
  delete t.PrivateKey, delete t.IsOSBinary, delete t.SignatureType;
  const r = t.SignerCertificate;
  return r != null && (delete r.Archived, delete r.Extensions, delete r.Handle, delete r.HasPrivateKey, delete r.SubjectName), t;
}
function qu(e, t, r, n) {
  if (vR()) {
    e.warn(`Cannot execute Get-AuthenticodeSignature: ${t || r}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
    return;
  }
  try {
    (0, Yg.execFileSync)(...Zg("ConvertTo-Json test", 10 * 1e3));
  } catch (i) {
    e.warn(`Cannot execute ConvertTo-Json: ${i.message}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
    return;
  }
  t != null && n(t), r && n(new Error(`Cannot execute Get-AuthenticodeSignature, stderr: ${r}. Failing signature validation due to unknown stderr.`));
}
function vR() {
  const e = hR.release();
  return e.startsWith("6.") && !e.startsWith("6.3");
}
Object.defineProperty(Za, "__esModule", { value: !0 });
Za.NsisUpdater = void 0;
const is = et, d0 = Me, gR = Zn, mR = wo, p0 = wn, yR = Ke, bR = bn, wR = Cf, v0 = yn;
class xR extends gR.BaseUpdater {
  constructor(t, r) {
    super(t, r), this._verifyUpdateCodeSignature = (n, i) => (0, wR.verifySignature)(n, i, this._logger);
  }
  /**
   * The verifyUpdateCodeSignature. You can pass [win-verify-signature](https://github.com/beyondkmp/win-verify-trust) or another custom verify function: ` (publisherName: string[], path: string) => Promise<string | null>`.
   * The default verify function uses [windowsExecutableCodeSignatureVerifier](https://github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/windowsExecutableCodeSignatureVerifier.ts)
   */
  get verifyUpdateCodeSignature() {
    return this._verifyUpdateCodeSignature;
  }
  set verifyUpdateCodeSignature(t) {
    t && (this._verifyUpdateCodeSignature = t);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, yR.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "exe");
    return this.executeDownload({
      fileExtension: "exe",
      downloadUpdateOptions: t,
      fileInfo: n,
      task: async (i, a, o, s) => {
        const l = n.packageInfo, u = l != null && o != null;
        if (u && t.disableWebInstaller)
          throw (0, is.newError)(`Unable to download new version ${t.updateInfoAndProvider.info.version}. Web Installers are disabled`, "ERR_UPDATER_WEB_INSTALLER_DISABLED");
        !u && !t.disableWebInstaller && this._logger.warn("disableWebInstaller is set to false, you should set it to true if you do not plan on using a web installer. This will default to true in a future version."), (u || t.disableDifferentialDownload || await this.differentialDownloadInstaller(n, t, i, r, is.CURRENT_APP_INSTALLER_FILE_NAME)) && await this.httpExecutor.download(n.url, i, a);
        const c = await this.verifySignature(i);
        if (c != null)
          throw await s(), (0, is.newError)(`New version ${t.updateInfoAndProvider.info.version} is not signed by the application owner: ${c}`, "ERR_UPDATER_INVALID_SIGNATURE");
        if (u && await this.differentialDownloadWebPackage(t, l, o, r))
          try {
            await this.httpExecutor.download(new v0.URL(l.path), o, {
              headers: t.requestHeaders,
              cancellationToken: t.cancellationToken,
              sha512: l.sha512
            });
          } catch (f) {
            try {
              await (0, bR.unlink)(o);
            } catch {
            }
            throw f;
          }
      }
    });
  }
  // $certificateInfo = (Get-AuthenticodeSignature 'xxx\yyy.exe'
  // | where {$_.Status.Equals([System.Management.Automation.SignatureStatus]::Valid) -and $_.SignerCertificate.Subject.Contains("CN=siemens.com")})
  // | Out-String ; if ($certificateInfo) { exit 0 } else { exit 1 }
  async verifySignature(t) {
    let r;
    try {
      if (r = (await this.configOnDisk.value).publisherName, r == null)
        return null;
    } catch (n) {
      if (n.code === "ENOENT")
        return null;
      throw n;
    }
    return await this._verifyUpdateCodeSignature(Array.isArray(r) ? r : [r], t);
  }
  doInstall(t) {
    const r = this.installerPath;
    if (r == null)
      return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
    const n = ["--updated"];
    t.isSilent && n.push("/S"), t.isForceRunAfter && n.push("--force-run"), this.installDirectory && n.push(`/D=${this.installDirectory}`);
    const i = this.downloadedUpdateHelper == null ? null : this.downloadedUpdateHelper.packageFile;
    i != null && n.push(`--package-file=${i}`);
    const a = () => {
      this.spawnLog(d0.join(process.resourcesPath, "elevate.exe"), [r].concat(n)).catch((o) => this.dispatchError(o));
    };
    return t.isAdminRightsRequired ? (this._logger.info("isAdminRightsRequired is set to true, run installer using elevate.exe"), a(), !0) : (this.spawnLog(r, n).catch((o) => {
      const s = o.code;
      this._logger.info(`Cannot run installer: error code: ${s}, error message: "${o.message}", will be executed again using elevate if EACCES, and will try to use electron.shell.openItem if ENOENT`), s === "UNKNOWN" || s === "EACCES" ? a() : s === "ENOENT" ? _n.shell.openPath(r).catch((l) => this.dispatchError(l)) : this.dispatchError(o);
    }), !0);
  }
  async differentialDownloadWebPackage(t, r, n, i) {
    if (r.blockMapSize == null)
      return !0;
    try {
      const a = {
        newUrl: new v0.URL(r.path),
        oldFile: d0.join(this.downloadedUpdateHelper.cacheDir, is.CURRENT_APP_PACKAGE_FILE_NAME),
        logger: this._logger,
        newFile: n,
        requestHeaders: this.requestHeaders,
        isUseMultipleRangeRequest: i.isUseMultipleRangeRequest,
        cancellationToken: t.cancellationToken
      };
      this.listenerCount(p0.DOWNLOAD_PROGRESS) > 0 && (a.onProgress = (o) => this.emit(p0.DOWNLOAD_PROGRESS, o)), await new mR.FileWithEmbeddedBlockMapDifferentialDownloader(r, this.httpExecutor, a).download();
    } catch (a) {
      return this._logger.error(`Cannot download differentially, fallback to full download: ${a.stack || a}`), process.platform === "win32";
    }
    return !1;
  }
}
Za.NsisUpdater = xR;
(function(e) {
  var t = xt && xt.__createBinding || (Object.create ? function(y, m, S, T) {
    T === void 0 && (T = S);
    var C = Object.getOwnPropertyDescriptor(m, S);
    (!C || ("get" in C ? !m.__esModule : C.writable || C.configurable)) && (C = { enumerable: !0, get: function() {
      return m[S];
    } }), Object.defineProperty(y, T, C);
  } : function(y, m, S, T) {
    T === void 0 && (T = S), y[T] = m[S];
  }), r = xt && xt.__exportStar || function(y, m) {
    for (var S in y) S !== "default" && !Object.prototype.hasOwnProperty.call(m, S) && t(m, y, S);
  };
  Object.defineProperty(e, "__esModule", { value: !0 }), e.NsisUpdater = e.MacUpdater = e.RpmUpdater = e.PacmanUpdater = e.DebUpdater = e.AppImageUpdater = e.Provider = e.NoOpLogger = e.AppUpdater = e.BaseUpdater = void 0;
  const n = bn, i = Me;
  var a = Zn;
  Object.defineProperty(e, "BaseUpdater", { enumerable: !0, get: function() {
    return a.BaseUpdater;
  } });
  var o = un;
  Object.defineProperty(e, "AppUpdater", { enumerable: !0, get: function() {
    return o.AppUpdater;
  } }), Object.defineProperty(e, "NoOpLogger", { enumerable: !0, get: function() {
    return o.NoOpLogger;
  } });
  var s = Ke;
  Object.defineProperty(e, "Provider", { enumerable: !0, get: function() {
    return s.Provider;
  } });
  var l = Wa;
  Object.defineProperty(e, "AppImageUpdater", { enumerable: !0, get: function() {
    return l.AppImageUpdater;
  } });
  var u = Ga;
  Object.defineProperty(e, "DebUpdater", { enumerable: !0, get: function() {
    return u.DebUpdater;
  } });
  var c = Ka;
  Object.defineProperty(e, "PacmanUpdater", { enumerable: !0, get: function() {
    return c.PacmanUpdater;
  } });
  var f = Xa;
  Object.defineProperty(e, "RpmUpdater", { enumerable: !0, get: function() {
    return f.RpmUpdater;
  } });
  var h = Ya;
  Object.defineProperty(e, "MacUpdater", { enumerable: !0, get: function() {
    return h.MacUpdater;
  } });
  var d = Za;
  Object.defineProperty(e, "NsisUpdater", { enumerable: !0, get: function() {
    return d.NsisUpdater;
  } }), r(wn, e);
  let p;
  function v() {
    if (process.platform === "win32")
      p = new Za.NsisUpdater();
    else if (process.platform === "darwin")
      p = new Ya.MacUpdater();
    else {
      p = new Wa.AppImageUpdater();
      try {
        const y = i.join(process.resourcesPath, "package-type");
        if (!(0, n.existsSync)(y))
          return p;
        switch ((0, n.readFileSync)(y).toString().trim()) {
          case "deb":
            p = new Ga.DebUpdater();
            break;
          case "rpm":
            p = new Xa.RpmUpdater();
            break;
          case "pacman":
            p = new Ka.PacmanUpdater();
            break;
          default:
            break;
        }
      } catch (y) {
        console.warn("Unable to detect 'package-type' for autoUpdater (rpm/deb/pacman support). If you'd like to expand support, please consider contributing to electron-builder", y.message);
      }
    }
    return p;
  }
  Object.defineProperty(e, "autoUpdater", {
    enumerable: !0,
    get: () => p || v()
  });
})(_p);
let rt;
function ER() {
  const e = Me.join(ur.getPath("userData"), "app.db");
  rt = new Qb(e), rt.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )
  `), rt.exec(`
  CREATE TABLE IF NOT EXISTS document_categories (
    documentId INTEGER,
    categoryId INTEGER,
    PRIMARY KEY (documentId, categoryId),
    FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
  )
  `), rt.exec(`
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            numPages INTEGER DEFAULT 1,
            filePath TEXT,
            fileHash TEXT UNIQUE,
            currentPage INTEGER DEFAULT 1,
            currentZoom REAL,
            currentScroll REAL,
            annotations TEXT,
            thumbnailPath TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            lastOpenedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            isSynced INTEGER DEFAULT 0,
            category TEXT
            )
        `);
  try {
    rt.exec("ALTER TABLE documents ADD COLUMN isSynced INTEGER DEFAULT 0");
  } catch {
  }
  try {
    rt.exec("ALTER TABLE documents ADD COLUMN category TEXT");
  } catch {
  }
  rt.prepare(`
    UPDATE documents
    SET thumbnailPath = REPLACE(thumbnailPath, '.jpg', '-1.jpg')
    WHERE thumbnailPath IS NOT NULL AND thumbnailPath NOT LIKE '%-1.jpg'
  `).run();
}
function SR(e) {
  rt.prepare(
    `
    UPDATE documents SET lastOpenedAt = CURRENT_TIMESTAMP WHERE fileHash = ?
  `
  ).run(e);
}
function FR(e, t) {
  rt.prepare(`
    UPDATE documents
    SET currentPage = ?,
        currentZoom = ?,
        currentScroll = ?,
        annotations = ?
    WHERE fileHash = ?
    `).run(
    t.currentPage,
    t.currentZoom,
    t.currentScroll,
    t.annotations,
    e
  );
}
function Af(e, t, r, n, i = 1) {
  return rt.prepare(`
        INSERT INTO documents (title, filePath, fileHash, thumbnailPath, numPages)
        VALUES (?, ?, ?, ?, ?)
        `).run(
    e,
    t,
    r,
    n || null,
    i
  );
}
function TR() {
  return rt.prepare("select * from documents").all();
}
function qn(e) {
  return rt.prepare("select * from documents where fileHash = ?").get(e);
}
function CR() {
  return rt.prepare("SELECT * FROM documents ORDER BY lastOpenedAt DESC LIMIT 1").get();
}
function Sc(e, t) {
  rt.prepare(
    `
    UPDATE documents
    SET filePath = ?
    WHERE fileHash = ?
  `
  ).run(t, e);
}
function Ja(e, t, r) {
  rt.prepare(
    `
    UPDATE documents
    SET isSynced = ?, category = ?
    WHERE fileHash = ?
  `
  ).run(t ? 1 : 0, r || null, e);
}
function Jg(e, t) {
  rt.prepare(
    `
    UPDATE documents
    SET thumbnailPath = ?
    WHERE fileHash = ?
  `
  ).run(t, e);
}
function AR(e) {
  return rt.prepare(
    "SELECT * FROM documents WHERE isSynced = ?"
  ).all(e ? 1 : 0);
}
function PR() {
  return rt.prepare(
    "SELECT DISTINCT category FROM documents WHERE category IS NOT NULL"
  ).all().map((t) => t.category);
}
/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
var Fc = function(e, t) {
  return Fc = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(r, n) {
    r.__proto__ = n;
  } || function(r, n) {
    for (var i in n) n.hasOwnProperty(i) && (r[i] = n[i]);
  }, Fc(e, t);
};
function K(e, t) {
  Fc(e, t);
  function r() {
    this.constructor = e;
  }
  e.prototype = t === null ? Object.create(t) : (r.prototype = t.prototype, new r());
}
var le = function() {
  return le = Object.assign || function(t) {
    for (var r, n = 1, i = arguments.length; n < i; n++) {
      r = arguments[n];
      for (var a in r) Object.prototype.hasOwnProperty.call(r, a) && (t[a] = r[a]);
    }
    return t;
  }, le.apply(this, arguments);
};
function RR(e, t) {
  var r = {};
  for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && t.indexOf(n) < 0 && (r[n] = e[n]);
  if (e != null && typeof Object.getOwnPropertySymbols == "function")
    for (var i = 0, n = Object.getOwnPropertySymbols(e); i < n.length; i++)
      t.indexOf(n[i]) < 0 && Object.prototype.propertyIsEnumerable.call(e, n[i]) && (r[n[i]] = e[n[i]]);
  return r;
}
function fe(e, t, r, n) {
  function i(a) {
    return a instanceof r ? a : new r(function(o) {
      o(a);
    });
  }
  return new (r || (r = Promise))(function(a, o) {
    function s(c) {
      try {
        u(n.next(c));
      } catch (f) {
        o(f);
      }
    }
    function l(c) {
      try {
        u(n.throw(c));
      } catch (f) {
        o(f);
      }
    }
    function u(c) {
      c.done ? a(c.value) : i(c.value).then(s, l);
    }
    u((n = n.apply(e, [])).next());
  });
}
function he(e, t) {
  var r = { label: 0, sent: function() {
    if (a[0] & 1) throw a[1];
    return a[1];
  }, trys: [], ops: [] }, n, i, a, o;
  return o = { next: s(0), throw: s(1), return: s(2) }, typeof Symbol == "function" && (o[Symbol.iterator] = function() {
    return this;
  }), o;
  function s(u) {
    return function(c) {
      return l([u, c]);
    };
  }
  function l(u) {
    if (n) throw new TypeError("Generator is already executing.");
    for (; r; ) try {
      if (n = 1, i && (a = u[0] & 2 ? i.return : u[0] ? i.throw || ((a = i.return) && a.call(i), 0) : i.next) && !(a = a.call(i, u[1])).done) return a;
      switch (i = 0, a && (u = [u[0] & 2, a.value]), u[0]) {
        case 0:
        case 1:
          a = u;
          break;
        case 4:
          return r.label++, { value: u[1], done: !1 };
        case 5:
          r.label++, i = u[1], u = [0];
          continue;
        case 7:
          u = r.ops.pop(), r.trys.pop();
          continue;
        default:
          if (a = r.trys, !(a = a.length > 0 && a[a.length - 1]) && (u[0] === 6 || u[0] === 2)) {
            r = 0;
            continue;
          }
          if (u[0] === 3 && (!a || u[1] > a[0] && u[1] < a[3])) {
            r.label = u[1];
            break;
          }
          if (u[0] === 6 && r.label < a[1]) {
            r.label = a[1], a = u;
            break;
          }
          if (a && r.label < a[2]) {
            r.label = a[2], r.ops.push(u);
            break;
          }
          a[2] && r.ops.pop(), r.trys.pop();
          continue;
      }
      u = t.call(e, r);
    } catch (c) {
      u = [6, c], i = 0;
    } finally {
      n = a = 0;
    }
    if (u[0] & 5) throw u[1];
    return { value: u[0] ? u[1] : void 0, done: !0 };
  }
}
function be() {
  for (var e = 0, t = 0, r = arguments.length; t < r; t++) e += arguments[t].length;
  for (var n = Array(e), i = 0, t = 0; t < r; t++)
    for (var a = arguments[t], o = 0, s = a.length; o < s; o++, i++)
      n[i] = a[o];
  return n;
}
var Ei = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", va = new Uint8Array(256);
for (var as = 0; as < Ei.length; as++)
  va[Ei.charCodeAt(as)] = as;
var OR = function(e) {
  for (var t = "", r = e.length, n = 0; n < r; n += 3)
    t += Ei[e[n] >> 2], t += Ei[(e[n] & 3) << 4 | e[n + 1] >> 4], t += Ei[(e[n + 1] & 15) << 2 | e[n + 2] >> 6], t += Ei[e[n + 2] & 63];
  return r % 3 === 2 ? t = t.substring(0, t.length - 1) + "=" : r % 3 === 1 && (t = t.substring(0, t.length - 2) + "=="), t;
}, g0 = function(e) {
  var t = e.length * 0.75, r = e.length, n, i = 0, a, o, s, l;
  e[e.length - 1] === "=" && (t--, e[e.length - 2] === "=" && t--);
  var u = new Uint8Array(t);
  for (n = 0; n < r; n += 4)
    a = va[e.charCodeAt(n)], o = va[e.charCodeAt(n + 1)], s = va[e.charCodeAt(n + 2)], l = va[e.charCodeAt(n + 3)], u[i++] = a << 2 | o >> 4, u[i++] = (o & 15) << 4 | s >> 2, u[i++] = (s & 3) << 6 | l & 63;
  return u;
}, DR = /^(data)?:?([\w\/\+]+)?;?(charset=[\w-]+|base64)?.*,/i, kR = function(e) {
  var t = e.trim(), r = t.substring(0, 100), n = r.match(DR);
  if (!n)
    return g0(t);
  var i = n[0], a = t.substring(i.length);
  return g0(a);
}, se = function(e) {
  return e.charCodeAt(0);
}, NR = function(e) {
  return e.codePointAt(0);
}, xo = function(e, t) {
  return sr(e.toString(16), t, "0").toUpperCase();
}, Il = function(e) {
  return xo(e, 2);
}, kr = function(e) {
  return String.fromCharCode(e);
}, IR = function(e) {
  return kr(parseInt(e, 16));
}, sr = function(e, t, r) {
  for (var n = "", i = 0, a = t - e.length; i < a; i++)
    n += r;
  return n + e;
}, lt = function(e, t, r) {
  for (var n = e.length, i = 0; i < n; i++)
    t[r++] = e.charCodeAt(i);
  return n;
}, UR = function(e) {
  return e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}, Eo = function(e) {
  return e.replace(/\t|\u0085|\u2028|\u2029/g, "    ").replace(/[\b\v]/g, "");
}, LR = ["\\n", "\\f", "\\r", "\\u000B"], Qg = function(e) {
  return /^[\n\f\r\u000B]$/.test(e);
}, $g = function(e) {
  return e.split(/[\n\f\r\u000B]/);
}, em = function(e) {
  return e.replace(/[\n\f\r\u000B]/g, " ");
}, tm = function(e, t) {
  var r = e.charCodeAt(t), n, i = t + 1, a = 1;
  return (
    // Check if it's the start of a surrogate pair.
    r >= 55296 && r <= 56319 && // high surrogate
    e.length > i && (n = e.charCodeAt(i), n >= 56320 && n <= 57343 && (a = 2)), [e.slice(t, t + a), a]
  );
}, BR = function(e) {
  for (var t = [], r = 0, n = e.length; r < n; ) {
    var i = tm(e, r), a = i[0], o = i[1];
    t.push(a), r += o;
  }
  return t;
}, MR = function(e) {
  for (var t = LR.join("|"), r = ["$"], n = 0, i = e.length; n < i; n++) {
    var a = e[n];
    if (Qg(a))
      throw new TypeError("`wordBreak` must not include " + t);
    r.push(a === "" ? "." : UR(a));
  }
  var o = r.join("|");
  return new RegExp("(" + t + ")|((.*?)(" + o + "))", "gm");
}, jR = function(e, t, r, n) {
  for (var i = MR(t), a = Eo(e).match(i), o = "", s = 0, l = [], u = function() {
    o !== "" && l.push(o), o = "", s = 0;
  }, c = 0, f = a.length; c < f; c++) {
    var h = a[c];
    if (Qg(h))
      u();
    else {
      var d = n(h);
      s + d > r && u(), o += h, s += d;
    }
  }
  return u(), l;
}, _R = /^D:(\d\d\d\d)(\d\d)?(\d\d)?(\d\d)?(\d\d)?(\d\d)?([+\-Z])?(\d\d)?'?(\d\d)?'?$/, rm = function(e) {
  var t = e.match(_R);
  if (t) {
    var r = t[1], n = t[2], i = n === void 0 ? "01" : n, a = t[3], o = a === void 0 ? "01" : a, s = t[4], l = s === void 0 ? "00" : s, u = t[5], c = u === void 0 ? "00" : u, f = t[6], h = f === void 0 ? "00" : f, d = t[7], p = d === void 0 ? "Z" : d, v = t[8], y = v === void 0 ? "00" : v, m = t[9], S = m === void 0 ? "00" : m, T = p === "Z" ? "Z" : "" + p + y + ":" + S, C = /* @__PURE__ */ new Date(r + "-" + i + "-" + o + "T" + l + ":" + c + ":" + h + T);
    return C;
  }
}, Pf = function(e, t) {
  for (var r, n = 0, i; n < e.length; ) {
    var a = e.substring(n).match(t);
    if (!a)
      return { match: i, pos: n };
    i = a, n += ((r = a.index) !== null && r !== void 0 ? r : 0) + a[0].length;
  }
  return { match: i, pos: n };
}, Xs = function(e) {
  return e[e.length - 1];
}, Tc = function(e) {
  if (e instanceof Uint8Array)
    return e;
  for (var t = e.length, r = new Uint8Array(t), n = 0; n < t; n++)
    r[n] = e.charCodeAt(n);
  return r;
}, zR = function() {
  for (var e = [], t = 0; t < arguments.length; t++)
    e[t] = arguments[t];
  for (var r = e.length, n = [], i = 0; i < r; i++) {
    var a = e[i];
    n[i] = a instanceof Uint8Array ? a : Tc(a);
  }
  for (var o = 0, i = 0; i < r; i++)
    o += e[i].length;
  for (var s = new Uint8Array(o), l = 0, u = 0; u < r; u++)
    for (var c = n[u], f = 0, h = c.length; f < h; f++)
      s[l++] = c[f];
  return s;
}, qR = function(e) {
  for (var t = 0, r = 0, n = e.length; r < n; r++)
    t += e[r].length;
  for (var i = new Uint8Array(t), a = 0, r = 0, n = e.length; r < n; r++) {
    var o = e[r];
    i.set(o, a), a += o.length;
  }
  return i;
}, nm = function(e) {
  for (var t = "", r = 0, n = e.length; r < n; r++)
    t += kr(e[r]);
  return t;
}, VR = function(e, t) {
  return e.id - t.id;
}, HR = function(e, t) {
  for (var r = [], n = 0, i = e.length; n < i; n++) {
    var a = e[n], o = e[n - 1];
    (n === 0 || t(a) !== t(o)) && r.push(a);
  }
  return r;
}, ci = function(e) {
  for (var t = e.length, r = 0, n = Math.floor(t / 2); r < n; r++) {
    var i = r, a = t - r - 1, o = e[r];
    e[i] = e[a], e[a] = o;
  }
  return e;
}, WR = function(e) {
  for (var t = 0, r = 0, n = e.length; r < n; r++)
    t += e[r];
  return t;
}, GR = function(e, t) {
  for (var r = new Array(t - e), n = 0, i = r.length; n < i; n++)
    r[n] = e + n;
  return r;
}, KR = function(e, t) {
  for (var r = new Array(t.length), n = 0, i = t.length; n < i; n++)
    r[n] = e[t[n]];
  return r;
}, XR = function(e) {
  return e instanceof Uint8Array || e instanceof ArrayBuffer || typeof e == "string";
}, aa = function(e) {
  if (typeof e == "string")
    return kR(e);
  if (e instanceof ArrayBuffer)
    return new Uint8Array(e);
  if (e instanceof Uint8Array)
    return e;
  throw new TypeError("`input` must be one of `string | ArrayBuffer | Uint8Array`");
}, Ui = function() {
  return new Promise(function(e) {
    setTimeout(function() {
      return e();
    }, 0);
  });
}, YR = function(e, t) {
  t === void 0 && (t = !0);
  var r = [];
  t && r.push(65279);
  for (var n = 0, i = e.length; n < i; ) {
    var a = e.codePointAt(n);
    if (a < 65536)
      r.push(a), n += 1;
    else if (a < 1114112)
      r.push(im(a), am(a)), n += 2;
    else
      throw new Error("Invalid code point: 0x" + Il(a));
  }
  return new Uint16Array(r);
}, ZR = function(e) {
  return e >= 0 && e <= 65535;
}, JR = function(e) {
  return e >= 65536 && e <= 1114111;
}, im = function(e) {
  return Math.floor((e - 65536) / 1024) + 55296;
}, am = function(e) {
  return (e - 65536) % 1024 + 56320;
}, on;
(function(e) {
  e.BigEndian = "BigEndian", e.LittleEndian = "LittleEndian";
})(on || (on = {}));
var oa = "�".codePointAt(0), om = function(e, t) {
  if (t === void 0 && (t = !0), e.length <= 1)
    return String.fromCodePoint(oa);
  for (var r = t ? $R(e) : on.BigEndian, n = t ? 2 : 0, i = []; e.length - n >= 2; ) {
    var a = y0(e[n++], e[n++], r);
    if (QR(a))
      if (e.length - n < 2)
        i.push(oa);
      else {
        var o = y0(e[n++], e[n++], r);
        m0(o) ? i.push(a, o) : i.push(oa);
      }
    else m0(a) ? (n += 2, i.push(oa)) : i.push(a);
  }
  return n < e.length && i.push(oa), String.fromCodePoint.apply(String, i);
}, QR = function(e) {
  return e >= 55296 && e <= 56319;
}, m0 = function(e) {
  return e >= 56320 && e <= 57343;
}, y0 = function(e, t, r) {
  if (r === on.LittleEndian)
    return t << 8 | e;
  if (r === on.BigEndian)
    return e << 8 | t;
  throw new Error("Invalid byteOrder: " + r);
}, $R = function(e) {
  return sm(e) ? on.BigEndian : lm(e) ? on.LittleEndian : on.BigEndian;
}, sm = function(e) {
  return e[0] === 254 && e[1] === 255;
}, lm = function(e) {
  return e[0] === 255 && e[1] === 254;
}, um = function(e) {
  return sm(e) || lm(e);
}, e2 = function(e) {
  var t = String(e);
  if (Math.abs(e) < 1) {
    var r = parseInt(e.toString().split("e-")[1]);
    if (r) {
      var n = e < 0;
      n && (e *= -1), e *= Math.pow(10, r - 1), t = "0." + new Array(r).join("0") + e.toString().substring(2), n && (t = "-" + t);
    }
  } else {
    var r = parseInt(e.toString().split("+")[1]);
    r > 20 && (r -= 20, e /= Math.pow(10, r), t = e.toString() + new Array(r + 1).join("0"));
  }
  return t;
}, Ts = function(e) {
  return Math.ceil(e.toString(2).length / 8);
}, fi = function(e) {
  for (var t = new Uint8Array(Ts(e)), r = 1; r <= t.length; r++)
    t[r - 1] = e >> (t.length - r) * 8;
  return t;
}, So = function(e) {
  throw new Error(e);
}, Lr = {};
(function(e) {
  var t = typeof Uint8Array < "u" && typeof Uint16Array < "u" && typeof Int32Array < "u";
  function r(a, o) {
    return Object.prototype.hasOwnProperty.call(a, o);
  }
  e.assign = function(a) {
    for (var o = Array.prototype.slice.call(arguments, 1); o.length; ) {
      var s = o.shift();
      if (s) {
        if (typeof s != "object")
          throw new TypeError(s + "must be non-object");
        for (var l in s)
          r(s, l) && (a[l] = s[l]);
      }
    }
    return a;
  }, e.shrinkBuf = function(a, o) {
    return a.length === o ? a : a.subarray ? a.subarray(0, o) : (a.length = o, a);
  };
  var n = {
    arraySet: function(a, o, s, l, u) {
      if (o.subarray && a.subarray) {
        a.set(o.subarray(s, s + l), u);
        return;
      }
      for (var c = 0; c < l; c++)
        a[u + c] = o[s + c];
    },
    // Join array of chunks to single array.
    flattenChunks: function(a) {
      var o, s, l, u, c, f;
      for (l = 0, o = 0, s = a.length; o < s; o++)
        l += a[o].length;
      for (f = new Uint8Array(l), u = 0, o = 0, s = a.length; o < s; o++)
        c = a[o], f.set(c, u), u += c.length;
      return f;
    }
  }, i = {
    arraySet: function(a, o, s, l, u) {
      for (var c = 0; c < l; c++)
        a[u + c] = o[s + c];
    },
    // Join array of chunks to single array.
    flattenChunks: function(a) {
      return [].concat.apply([], a);
    }
  };
  e.setTyped = function(a) {
    a ? (e.Buf8 = Uint8Array, e.Buf16 = Uint16Array, e.Buf32 = Int32Array, e.assign(e, n)) : (e.Buf8 = Array, e.Buf16 = Array, e.Buf32 = Array, e.assign(e, i));
  }, e.setTyped(t);
})(Lr);
var Fo = {}, Tr = {}, Vi = {}, t2 = Lr, r2 = 4, b0 = 0, w0 = 1, n2 = 2;
function Hi(e) {
  for (var t = e.length; --t >= 0; )
    e[t] = 0;
}
var i2 = 0, cm = 1, a2 = 2, o2 = 3, s2 = 258, Rf = 29, To = 256, Qa = To + 1 + Rf, Ai = 30, Of = 19, fm = 2 * Qa + 1, Ln = 15, Vu = 16, l2 = 7, Df = 256, hm = 16, dm = 17, pm = 18, Cc = (
  /* extra bits for each length code */
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
), Cs = (
  /* extra bits for each distance code */
  [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
), u2 = (
  /* extra bits for each bit length code */
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]
), vm = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], c2 = 512, Dr = new Array((Qa + 2) * 2);
Hi(Dr);
var Ca = new Array(Ai * 2);
Hi(Ca);
var $a = new Array(c2);
Hi($a);
var eo = new Array(s2 - o2 + 1);
Hi(eo);
var kf = new Array(Rf);
Hi(kf);
var Ys = new Array(Ai);
Hi(Ys);
function Hu(e, t, r, n, i) {
  this.static_tree = e, this.extra_bits = t, this.extra_base = r, this.elems = n, this.max_length = i, this.has_stree = e && e.length;
}
var gm, mm, ym;
function Wu(e, t) {
  this.dyn_tree = e, this.max_code = 0, this.stat_desc = t;
}
function bm(e) {
  return e < 256 ? $a[e] : $a[256 + (e >>> 7)];
}
function to(e, t) {
  e.pending_buf[e.pending++] = t & 255, e.pending_buf[e.pending++] = t >>> 8 & 255;
}
function Nt(e, t, r) {
  e.bi_valid > Vu - r ? (e.bi_buf |= t << e.bi_valid & 65535, to(e, e.bi_buf), e.bi_buf = t >> Vu - e.bi_valid, e.bi_valid += r - Vu) : (e.bi_buf |= t << e.bi_valid & 65535, e.bi_valid += r);
}
function wr(e, t, r) {
  Nt(
    e,
    r[t * 2],
    r[t * 2 + 1]
    /*.Len*/
  );
}
function wm(e, t) {
  var r = 0;
  do
    r |= e & 1, e >>>= 1, r <<= 1;
  while (--t > 0);
  return r >>> 1;
}
function f2(e) {
  e.bi_valid === 16 ? (to(e, e.bi_buf), e.bi_buf = 0, e.bi_valid = 0) : e.bi_valid >= 8 && (e.pending_buf[e.pending++] = e.bi_buf & 255, e.bi_buf >>= 8, e.bi_valid -= 8);
}
function h2(e, t) {
  var r = t.dyn_tree, n = t.max_code, i = t.stat_desc.static_tree, a = t.stat_desc.has_stree, o = t.stat_desc.extra_bits, s = t.stat_desc.extra_base, l = t.stat_desc.max_length, u, c, f, h, d, p, v = 0;
  for (h = 0; h <= Ln; h++)
    e.bl_count[h] = 0;
  for (r[e.heap[e.heap_max] * 2 + 1] = 0, u = e.heap_max + 1; u < fm; u++)
    c = e.heap[u], h = r[r[c * 2 + 1] * 2 + 1] + 1, h > l && (h = l, v++), r[c * 2 + 1] = h, !(c > n) && (e.bl_count[h]++, d = 0, c >= s && (d = o[c - s]), p = r[c * 2], e.opt_len += p * (h + d), a && (e.static_len += p * (i[c * 2 + 1] + d)));
  if (v !== 0) {
    do {
      for (h = l - 1; e.bl_count[h] === 0; )
        h--;
      e.bl_count[h]--, e.bl_count[h + 1] += 2, e.bl_count[l]--, v -= 2;
    } while (v > 0);
    for (h = l; h !== 0; h--)
      for (c = e.bl_count[h]; c !== 0; )
        f = e.heap[--u], !(f > n) && (r[f * 2 + 1] !== h && (e.opt_len += (h - r[f * 2 + 1]) * r[f * 2], r[f * 2 + 1] = h), c--);
  }
}
function xm(e, t, r) {
  var n = new Array(Ln + 1), i = 0, a, o;
  for (a = 1; a <= Ln; a++)
    n[a] = i = i + r[a - 1] << 1;
  for (o = 0; o <= t; o++) {
    var s = e[o * 2 + 1];
    s !== 0 && (e[o * 2] = wm(n[s]++, s));
  }
}
function d2() {
  var e, t, r, n, i, a = new Array(Ln + 1);
  for (r = 0, n = 0; n < Rf - 1; n++)
    for (kf[n] = r, e = 0; e < 1 << Cc[n]; e++)
      eo[r++] = n;
  for (eo[r - 1] = n, i = 0, n = 0; n < 16; n++)
    for (Ys[n] = i, e = 0; e < 1 << Cs[n]; e++)
      $a[i++] = n;
  for (i >>= 7; n < Ai; n++)
    for (Ys[n] = i << 7, e = 0; e < 1 << Cs[n] - 7; e++)
      $a[256 + i++] = n;
  for (t = 0; t <= Ln; t++)
    a[t] = 0;
  for (e = 0; e <= 143; )
    Dr[e * 2 + 1] = 8, e++, a[8]++;
  for (; e <= 255; )
    Dr[e * 2 + 1] = 9, e++, a[9]++;
  for (; e <= 279; )
    Dr[e * 2 + 1] = 7, e++, a[7]++;
  for (; e <= 287; )
    Dr[e * 2 + 1] = 8, e++, a[8]++;
  for (xm(Dr, Qa + 1, a), e = 0; e < Ai; e++)
    Ca[e * 2 + 1] = 5, Ca[e * 2] = wm(e, 5);
  gm = new Hu(Dr, Cc, To + 1, Qa, Ln), mm = new Hu(Ca, Cs, 0, Ai, Ln), ym = new Hu(new Array(0), u2, 0, Of, l2);
}
function Em(e) {
  var t;
  for (t = 0; t < Qa; t++)
    e.dyn_ltree[t * 2] = 0;
  for (t = 0; t < Ai; t++)
    e.dyn_dtree[t * 2] = 0;
  for (t = 0; t < Of; t++)
    e.bl_tree[t * 2] = 0;
  e.dyn_ltree[Df * 2] = 1, e.opt_len = e.static_len = 0, e.last_lit = e.matches = 0;
}
function Sm(e) {
  e.bi_valid > 8 ? to(e, e.bi_buf) : e.bi_valid > 0 && (e.pending_buf[e.pending++] = e.bi_buf), e.bi_buf = 0, e.bi_valid = 0;
}
function p2(e, t, r, n) {
  Sm(e), to(e, r), to(e, ~r), t2.arraySet(e.pending_buf, e.window, t, r, e.pending), e.pending += r;
}
function x0(e, t, r, n) {
  var i = t * 2, a = r * 2;
  return e[i] < e[a] || e[i] === e[a] && n[t] <= n[r];
}
function Gu(e, t, r) {
  for (var n = e.heap[r], i = r << 1; i <= e.heap_len && (i < e.heap_len && x0(t, e.heap[i + 1], e.heap[i], e.depth) && i++, !x0(t, n, e.heap[i], e.depth)); )
    e.heap[r] = e.heap[i], r = i, i <<= 1;
  e.heap[r] = n;
}
function E0(e, t, r) {
  var n, i, a = 0, o, s;
  if (e.last_lit !== 0)
    do
      n = e.pending_buf[e.d_buf + a * 2] << 8 | e.pending_buf[e.d_buf + a * 2 + 1], i = e.pending_buf[e.l_buf + a], a++, n === 0 ? wr(e, i, t) : (o = eo[i], wr(e, o + To + 1, t), s = Cc[o], s !== 0 && (i -= kf[o], Nt(e, i, s)), n--, o = bm(n), wr(e, o, r), s = Cs[o], s !== 0 && (n -= Ys[o], Nt(e, n, s)));
    while (a < e.last_lit);
  wr(e, Df, t);
}
function Ac(e, t) {
  var r = t.dyn_tree, n = t.stat_desc.static_tree, i = t.stat_desc.has_stree, a = t.stat_desc.elems, o, s, l = -1, u;
  for (e.heap_len = 0, e.heap_max = fm, o = 0; o < a; o++)
    r[o * 2] !== 0 ? (e.heap[++e.heap_len] = l = o, e.depth[o] = 0) : r[o * 2 + 1] = 0;
  for (; e.heap_len < 2; )
    u = e.heap[++e.heap_len] = l < 2 ? ++l : 0, r[u * 2] = 1, e.depth[u] = 0, e.opt_len--, i && (e.static_len -= n[u * 2 + 1]);
  for (t.max_code = l, o = e.heap_len >> 1; o >= 1; o--)
    Gu(e, r, o);
  u = a;
  do
    o = e.heap[
      1
      /*SMALLEST*/
    ], e.heap[
      1
      /*SMALLEST*/
    ] = e.heap[e.heap_len--], Gu(
      e,
      r,
      1
      /*SMALLEST*/
    ), s = e.heap[
      1
      /*SMALLEST*/
    ], e.heap[--e.heap_max] = o, e.heap[--e.heap_max] = s, r[u * 2] = r[o * 2] + r[s * 2], e.depth[u] = (e.depth[o] >= e.depth[s] ? e.depth[o] : e.depth[s]) + 1, r[o * 2 + 1] = r[s * 2 + 1] = u, e.heap[
      1
      /*SMALLEST*/
    ] = u++, Gu(
      e,
      r,
      1
      /*SMALLEST*/
    );
  while (e.heap_len >= 2);
  e.heap[--e.heap_max] = e.heap[
    1
    /*SMALLEST*/
  ], h2(e, t), xm(r, l, e.bl_count);
}
function S0(e, t, r) {
  var n, i = -1, a, o = t[0 * 2 + 1], s = 0, l = 7, u = 4;
  for (o === 0 && (l = 138, u = 3), t[(r + 1) * 2 + 1] = 65535, n = 0; n <= r; n++)
    a = o, o = t[(n + 1) * 2 + 1], !(++s < l && a === o) && (s < u ? e.bl_tree[a * 2] += s : a !== 0 ? (a !== i && e.bl_tree[a * 2]++, e.bl_tree[hm * 2]++) : s <= 10 ? e.bl_tree[dm * 2]++ : e.bl_tree[pm * 2]++, s = 0, i = a, o === 0 ? (l = 138, u = 3) : a === o ? (l = 6, u = 3) : (l = 7, u = 4));
}
function F0(e, t, r) {
  var n, i = -1, a, o = t[0 * 2 + 1], s = 0, l = 7, u = 4;
  for (o === 0 && (l = 138, u = 3), n = 0; n <= r; n++)
    if (a = o, o = t[(n + 1) * 2 + 1], !(++s < l && a === o)) {
      if (s < u)
        do
          wr(e, a, e.bl_tree);
        while (--s !== 0);
      else a !== 0 ? (a !== i && (wr(e, a, e.bl_tree), s--), wr(e, hm, e.bl_tree), Nt(e, s - 3, 2)) : s <= 10 ? (wr(e, dm, e.bl_tree), Nt(e, s - 3, 3)) : (wr(e, pm, e.bl_tree), Nt(e, s - 11, 7));
      s = 0, i = a, o === 0 ? (l = 138, u = 3) : a === o ? (l = 6, u = 3) : (l = 7, u = 4);
    }
}
function v2(e) {
  var t;
  for (S0(e, e.dyn_ltree, e.l_desc.max_code), S0(e, e.dyn_dtree, e.d_desc.max_code), Ac(e, e.bl_desc), t = Of - 1; t >= 3 && e.bl_tree[vm[t] * 2 + 1] === 0; t--)
    ;
  return e.opt_len += 3 * (t + 1) + 5 + 5 + 4, t;
}
function g2(e, t, r, n) {
  var i;
  for (Nt(e, t - 257, 5), Nt(e, r - 1, 5), Nt(e, n - 4, 4), i = 0; i < n; i++)
    Nt(e, e.bl_tree[vm[i] * 2 + 1], 3);
  F0(e, e.dyn_ltree, t - 1), F0(e, e.dyn_dtree, r - 1);
}
function m2(e) {
  var t = 4093624447, r;
  for (r = 0; r <= 31; r++, t >>>= 1)
    if (t & 1 && e.dyn_ltree[r * 2] !== 0)
      return b0;
  if (e.dyn_ltree[9 * 2] !== 0 || e.dyn_ltree[10 * 2] !== 0 || e.dyn_ltree[13 * 2] !== 0)
    return w0;
  for (r = 32; r < To; r++)
    if (e.dyn_ltree[r * 2] !== 0)
      return w0;
  return b0;
}
var T0 = !1;
function y2(e) {
  T0 || (d2(), T0 = !0), e.l_desc = new Wu(e.dyn_ltree, gm), e.d_desc = new Wu(e.dyn_dtree, mm), e.bl_desc = new Wu(e.bl_tree, ym), e.bi_buf = 0, e.bi_valid = 0, Em(e);
}
function Fm(e, t, r, n) {
  Nt(e, (i2 << 1) + (n ? 1 : 0), 3), p2(e, t, r);
}
function b2(e) {
  Nt(e, cm << 1, 3), wr(e, Df, Dr), f2(e);
}
function w2(e, t, r, n) {
  var i, a, o = 0;
  e.level > 0 ? (e.strm.data_type === n2 && (e.strm.data_type = m2(e)), Ac(e, e.l_desc), Ac(e, e.d_desc), o = v2(e), i = e.opt_len + 3 + 7 >>> 3, a = e.static_len + 3 + 7 >>> 3, a <= i && (i = a)) : i = a = r + 5, r + 4 <= i && t !== -1 ? Fm(e, t, r, n) : e.strategy === r2 || a === i ? (Nt(e, (cm << 1) + (n ? 1 : 0), 3), E0(e, Dr, Ca)) : (Nt(e, (a2 << 1) + (n ? 1 : 0), 3), g2(e, e.l_desc.max_code + 1, e.d_desc.max_code + 1, o + 1), E0(e, e.dyn_ltree, e.dyn_dtree)), Em(e), n && Sm(e);
}
function x2(e, t, r) {
  return e.pending_buf[e.d_buf + e.last_lit * 2] = t >>> 8 & 255, e.pending_buf[e.d_buf + e.last_lit * 2 + 1] = t & 255, e.pending_buf[e.l_buf + e.last_lit] = r & 255, e.last_lit++, t === 0 ? e.dyn_ltree[r * 2]++ : (e.matches++, t--, e.dyn_ltree[(eo[r] + To + 1) * 2]++, e.dyn_dtree[bm(t) * 2]++), e.last_lit === e.lit_bufsize - 1;
}
Vi._tr_init = y2;
Vi._tr_stored_block = Fm;
Vi._tr_flush_block = w2;
Vi._tr_tally = x2;
Vi._tr_align = b2;
function E2(e, t, r, n) {
  for (var i = e & 65535 | 0, a = e >>> 16 & 65535 | 0, o = 0; r !== 0; ) {
    o = r > 2e3 ? 2e3 : r, r -= o;
    do
      i = i + t[n++] | 0, a = a + i | 0;
    while (--o);
    i %= 65521, a %= 65521;
  }
  return i | a << 16 | 0;
}
var Tm = E2;
function S2() {
  for (var e, t = [], r = 0; r < 256; r++) {
    e = r;
    for (var n = 0; n < 8; n++)
      e = e & 1 ? 3988292384 ^ e >>> 1 : e >>> 1;
    t[r] = e;
  }
  return t;
}
var F2 = S2();
function T2(e, t, r, n) {
  var i = F2, a = n + r;
  e ^= -1;
  for (var o = n; o < a; o++)
    e = e >>> 8 ^ i[(e ^ t[o]) & 255];
  return e ^ -1;
}
var Cm = T2, Nf = {
  2: "need dictionary",
  /* Z_NEED_DICT       2  */
  1: "stream end",
  /* Z_STREAM_END      1  */
  0: "",
  /* Z_OK              0  */
  "-1": "file error",
  /* Z_ERRNO         (-1) */
  "-2": "stream error",
  /* Z_STREAM_ERROR  (-2) */
  "-3": "data error",
  /* Z_DATA_ERROR    (-3) */
  "-4": "insufficient memory",
  /* Z_MEM_ERROR     (-4) */
  "-5": "buffer error",
  /* Z_BUF_ERROR     (-5) */
  "-6": "incompatible version"
  /* Z_VERSION_ERROR (-6) */
}, wt = Lr, Xt = Vi, Am = Tm, Gr = Cm, C2 = Nf, Qn = 0, A2 = 1, P2 = 3, sn = 4, C0 = 5, xr = 0, A0 = 1, Yt = -2, R2 = -3, Ku = -5, O2 = -1, D2 = 1, os = 2, k2 = 3, N2 = 4, I2 = 0, U2 = 2, Ul = 8, L2 = 9, B2 = 15, M2 = 8, j2 = 29, _2 = 256, Pc = _2 + 1 + j2, z2 = 30, q2 = 19, V2 = 2 * Pc + 1, H2 = 15, ye = 3, tn = 258, lr = tn + ye + 1, W2 = 32, Ll = 42, Rc = 69, As = 73, Ps = 91, Rs = 103, Bn = 113, ga = 666, Je = 1, Co = 2, Vn = 3, Wi = 4, G2 = 3;
function rn(e, t) {
  return e.msg = C2[t], t;
}
function P0(e) {
  return (e << 1) - (e > 4 ? 9 : 0);
}
function Qr(e) {
  for (var t = e.length; --t >= 0; )
    e[t] = 0;
}
function Kr(e) {
  var t = e.state, r = t.pending;
  r > e.avail_out && (r = e.avail_out), r !== 0 && (wt.arraySet(e.output, t.pending_buf, t.pending_out, r, e.next_out), e.next_out += r, t.pending_out += r, e.total_out += r, e.avail_out -= r, t.pending -= r, t.pending === 0 && (t.pending_out = 0));
}
function ut(e, t) {
  Xt._tr_flush_block(e, e.block_start >= 0 ? e.block_start : -1, e.strstart - e.block_start, t), e.block_start = e.strstart, Kr(e.strm);
}
function Fe(e, t) {
  e.pending_buf[e.pending++] = t;
}
function sa(e, t) {
  e.pending_buf[e.pending++] = t >>> 8 & 255, e.pending_buf[e.pending++] = t & 255;
}
function K2(e, t, r, n) {
  var i = e.avail_in;
  return i > n && (i = n), i === 0 ? 0 : (e.avail_in -= i, wt.arraySet(t, e.input, e.next_in, i, r), e.state.wrap === 1 ? e.adler = Am(e.adler, t, i, r) : e.state.wrap === 2 && (e.adler = Gr(e.adler, t, i, r)), e.next_in += i, e.total_in += i, i);
}
function Pm(e, t) {
  var r = e.max_chain_length, n = e.strstart, i, a, o = e.prev_length, s = e.nice_match, l = e.strstart > e.w_size - lr ? e.strstart - (e.w_size - lr) : 0, u = e.window, c = e.w_mask, f = e.prev, h = e.strstart + tn, d = u[n + o - 1], p = u[n + o];
  e.prev_length >= e.good_match && (r >>= 2), s > e.lookahead && (s = e.lookahead);
  do
    if (i = t, !(u[i + o] !== p || u[i + o - 1] !== d || u[i] !== u[n] || u[++i] !== u[n + 1])) {
      n += 2, i++;
      do
        ;
      while (u[++n] === u[++i] && u[++n] === u[++i] && u[++n] === u[++i] && u[++n] === u[++i] && u[++n] === u[++i] && u[++n] === u[++i] && u[++n] === u[++i] && u[++n] === u[++i] && n < h);
      if (a = tn - (h - n), n = h - tn, a > o) {
        if (e.match_start = t, o = a, a >= s)
          break;
        d = u[n + o - 1], p = u[n + o];
      }
    }
  while ((t = f[t & c]) > l && --r !== 0);
  return o <= e.lookahead ? o : e.lookahead;
}
function Hn(e) {
  var t = e.w_size, r, n, i, a, o;
  do {
    if (a = e.window_size - e.lookahead - e.strstart, e.strstart >= t + (t - lr)) {
      wt.arraySet(e.window, e.window, t, t, 0), e.match_start -= t, e.strstart -= t, e.block_start -= t, n = e.hash_size, r = n;
      do
        i = e.head[--r], e.head[r] = i >= t ? i - t : 0;
      while (--n);
      n = t, r = n;
      do
        i = e.prev[--r], e.prev[r] = i >= t ? i - t : 0;
      while (--n);
      a += t;
    }
    if (e.strm.avail_in === 0)
      break;
    if (n = K2(e.strm, e.window, e.strstart + e.lookahead, a), e.lookahead += n, e.lookahead + e.insert >= ye)
      for (o = e.strstart - e.insert, e.ins_h = e.window[o], e.ins_h = (e.ins_h << e.hash_shift ^ e.window[o + 1]) & e.hash_mask; e.insert && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[o + ye - 1]) & e.hash_mask, e.prev[o & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = o, o++, e.insert--, !(e.lookahead + e.insert < ye)); )
        ;
  } while (e.lookahead < lr && e.strm.avail_in !== 0);
}
function X2(e, t) {
  var r = 65535;
  for (r > e.pending_buf_size - 5 && (r = e.pending_buf_size - 5); ; ) {
    if (e.lookahead <= 1) {
      if (Hn(e), e.lookahead === 0 && t === Qn)
        return Je;
      if (e.lookahead === 0)
        break;
    }
    e.strstart += e.lookahead, e.lookahead = 0;
    var n = e.block_start + r;
    if ((e.strstart === 0 || e.strstart >= n) && (e.lookahead = e.strstart - n, e.strstart = n, ut(e, !1), e.strm.avail_out === 0) || e.strstart - e.block_start >= e.w_size - lr && (ut(e, !1), e.strm.avail_out === 0))
      return Je;
  }
  return e.insert = 0, t === sn ? (ut(e, !0), e.strm.avail_out === 0 ? Vn : Wi) : (e.strstart > e.block_start && (ut(e, !1), e.strm.avail_out === 0), Je);
}
function Xu(e, t) {
  for (var r, n; ; ) {
    if (e.lookahead < lr) {
      if (Hn(e), e.lookahead < lr && t === Qn)
        return Je;
      if (e.lookahead === 0)
        break;
    }
    if (r = 0, e.lookahead >= ye && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + ye - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart), r !== 0 && e.strstart - r <= e.w_size - lr && (e.match_length = Pm(e, r)), e.match_length >= ye)
      if (n = Xt._tr_tally(e, e.strstart - e.match_start, e.match_length - ye), e.lookahead -= e.match_length, e.match_length <= e.max_lazy_match && e.lookahead >= ye) {
        e.match_length--;
        do
          e.strstart++, e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + ye - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart;
        while (--e.match_length !== 0);
        e.strstart++;
      } else
        e.strstart += e.match_length, e.match_length = 0, e.ins_h = e.window[e.strstart], e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + 1]) & e.hash_mask;
    else
      n = Xt._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++;
    if (n && (ut(e, !1), e.strm.avail_out === 0))
      return Je;
  }
  return e.insert = e.strstart < ye - 1 ? e.strstart : ye - 1, t === sn ? (ut(e, !0), e.strm.avail_out === 0 ? Vn : Wi) : e.last_lit && (ut(e, !1), e.strm.avail_out === 0) ? Je : Co;
}
function hi(e, t) {
  for (var r, n, i; ; ) {
    if (e.lookahead < lr) {
      if (Hn(e), e.lookahead < lr && t === Qn)
        return Je;
      if (e.lookahead === 0)
        break;
    }
    if (r = 0, e.lookahead >= ye && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + ye - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart), e.prev_length = e.match_length, e.prev_match = e.match_start, e.match_length = ye - 1, r !== 0 && e.prev_length < e.max_lazy_match && e.strstart - r <= e.w_size - lr && (e.match_length = Pm(e, r), e.match_length <= 5 && (e.strategy === D2 || e.match_length === ye && e.strstart - e.match_start > 4096) && (e.match_length = ye - 1)), e.prev_length >= ye && e.match_length <= e.prev_length) {
      i = e.strstart + e.lookahead - ye, n = Xt._tr_tally(e, e.strstart - 1 - e.prev_match, e.prev_length - ye), e.lookahead -= e.prev_length - 1, e.prev_length -= 2;
      do
        ++e.strstart <= i && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + ye - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart);
      while (--e.prev_length !== 0);
      if (e.match_available = 0, e.match_length = ye - 1, e.strstart++, n && (ut(e, !1), e.strm.avail_out === 0))
        return Je;
    } else if (e.match_available) {
      if (n = Xt._tr_tally(e, 0, e.window[e.strstart - 1]), n && ut(e, !1), e.strstart++, e.lookahead--, e.strm.avail_out === 0)
        return Je;
    } else
      e.match_available = 1, e.strstart++, e.lookahead--;
  }
  return e.match_available && (n = Xt._tr_tally(e, 0, e.window[e.strstart - 1]), e.match_available = 0), e.insert = e.strstart < ye - 1 ? e.strstart : ye - 1, t === sn ? (ut(e, !0), e.strm.avail_out === 0 ? Vn : Wi) : e.last_lit && (ut(e, !1), e.strm.avail_out === 0) ? Je : Co;
}
function Y2(e, t) {
  for (var r, n, i, a, o = e.window; ; ) {
    if (e.lookahead <= tn) {
      if (Hn(e), e.lookahead <= tn && t === Qn)
        return Je;
      if (e.lookahead === 0)
        break;
    }
    if (e.match_length = 0, e.lookahead >= ye && e.strstart > 0 && (i = e.strstart - 1, n = o[i], n === o[++i] && n === o[++i] && n === o[++i])) {
      a = e.strstart + tn;
      do
        ;
      while (n === o[++i] && n === o[++i] && n === o[++i] && n === o[++i] && n === o[++i] && n === o[++i] && n === o[++i] && n === o[++i] && i < a);
      e.match_length = tn - (a - i), e.match_length > e.lookahead && (e.match_length = e.lookahead);
    }
    if (e.match_length >= ye ? (r = Xt._tr_tally(e, 1, e.match_length - ye), e.lookahead -= e.match_length, e.strstart += e.match_length, e.match_length = 0) : (r = Xt._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++), r && (ut(e, !1), e.strm.avail_out === 0))
      return Je;
  }
  return e.insert = 0, t === sn ? (ut(e, !0), e.strm.avail_out === 0 ? Vn : Wi) : e.last_lit && (ut(e, !1), e.strm.avail_out === 0) ? Je : Co;
}
function Z2(e, t) {
  for (var r; ; ) {
    if (e.lookahead === 0 && (Hn(e), e.lookahead === 0)) {
      if (t === Qn)
        return Je;
      break;
    }
    if (e.match_length = 0, r = Xt._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++, r && (ut(e, !1), e.strm.avail_out === 0))
      return Je;
  }
  return e.insert = 0, t === sn ? (ut(e, !0), e.strm.avail_out === 0 ? Vn : Wi) : e.last_lit && (ut(e, !1), e.strm.avail_out === 0) ? Je : Co;
}
function gr(e, t, r, n, i) {
  this.good_length = e, this.max_lazy = t, this.nice_length = r, this.max_chain = n, this.func = i;
}
var Si;
Si = [
  /*      good lazy nice chain */
  new gr(0, 0, 0, 0, X2),
  /* 0 store only */
  new gr(4, 4, 8, 4, Xu),
  /* 1 max speed, no lazy matches */
  new gr(4, 5, 16, 8, Xu),
  /* 2 */
  new gr(4, 6, 32, 32, Xu),
  /* 3 */
  new gr(4, 4, 16, 16, hi),
  /* 4 lazy matches */
  new gr(8, 16, 32, 32, hi),
  /* 5 */
  new gr(8, 16, 128, 128, hi),
  /* 6 */
  new gr(8, 32, 128, 256, hi),
  /* 7 */
  new gr(32, 128, 258, 1024, hi),
  /* 8 */
  new gr(32, 258, 258, 4096, hi)
  /* 9 max compression */
];
function J2(e) {
  e.window_size = 2 * e.w_size, Qr(e.head), e.max_lazy_match = Si[e.level].max_lazy, e.good_match = Si[e.level].good_length, e.nice_match = Si[e.level].nice_length, e.max_chain_length = Si[e.level].max_chain, e.strstart = 0, e.block_start = 0, e.lookahead = 0, e.insert = 0, e.match_length = e.prev_length = ye - 1, e.match_available = 0, e.ins_h = 0;
}
function Q2() {
  this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = Ul, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new wt.Buf16(V2 * 2), this.dyn_dtree = new wt.Buf16((2 * z2 + 1) * 2), this.bl_tree = new wt.Buf16((2 * q2 + 1) * 2), Qr(this.dyn_ltree), Qr(this.dyn_dtree), Qr(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new wt.Buf16(H2 + 1), this.heap = new wt.Buf16(2 * Pc + 1), Qr(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new wt.Buf16(2 * Pc + 1), Qr(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
}
function Rm(e) {
  var t;
  return !e || !e.state ? rn(e, Yt) : (e.total_in = e.total_out = 0, e.data_type = U2, t = e.state, t.pending = 0, t.pending_out = 0, t.wrap < 0 && (t.wrap = -t.wrap), t.status = t.wrap ? Ll : Bn, e.adler = t.wrap === 2 ? 0 : 1, t.last_flush = Qn, Xt._tr_init(t), xr);
}
function Om(e) {
  var t = Rm(e);
  return t === xr && J2(e.state), t;
}
function $2(e, t) {
  return !e || !e.state || e.state.wrap !== 2 ? Yt : (e.state.gzhead = t, xr);
}
function Dm(e, t, r, n, i, a) {
  if (!e)
    return Yt;
  var o = 1;
  if (t === O2 && (t = 6), n < 0 ? (o = 0, n = -n) : n > 15 && (o = 2, n -= 16), i < 1 || i > L2 || r !== Ul || n < 8 || n > 15 || t < 0 || t > 9 || a < 0 || a > N2)
    return rn(e, Yt);
  n === 8 && (n = 9);
  var s = new Q2();
  return e.state = s, s.strm = e, s.wrap = o, s.gzhead = null, s.w_bits = n, s.w_size = 1 << s.w_bits, s.w_mask = s.w_size - 1, s.hash_bits = i + 7, s.hash_size = 1 << s.hash_bits, s.hash_mask = s.hash_size - 1, s.hash_shift = ~~((s.hash_bits + ye - 1) / ye), s.window = new wt.Buf8(s.w_size * 2), s.head = new wt.Buf16(s.hash_size), s.prev = new wt.Buf16(s.w_size), s.lit_bufsize = 1 << i + 6, s.pending_buf_size = s.lit_bufsize * 4, s.pending_buf = new wt.Buf8(s.pending_buf_size), s.d_buf = 1 * s.lit_bufsize, s.l_buf = 3 * s.lit_bufsize, s.level = t, s.strategy = a, s.method = r, Om(e);
}
function eO(e, t) {
  return Dm(e, t, Ul, B2, M2, I2);
}
function tO(e, t) {
  var r, n, i, a;
  if (!e || !e.state || t > C0 || t < 0)
    return e ? rn(e, Yt) : Yt;
  if (n = e.state, !e.output || !e.input && e.avail_in !== 0 || n.status === ga && t !== sn)
    return rn(e, e.avail_out === 0 ? Ku : Yt);
  if (n.strm = e, r = n.last_flush, n.last_flush = t, n.status === Ll)
    if (n.wrap === 2)
      e.adler = 0, Fe(n, 31), Fe(n, 139), Fe(n, 8), n.gzhead ? (Fe(
        n,
        (n.gzhead.text ? 1 : 0) + (n.gzhead.hcrc ? 2 : 0) + (n.gzhead.extra ? 4 : 0) + (n.gzhead.name ? 8 : 0) + (n.gzhead.comment ? 16 : 0)
      ), Fe(n, n.gzhead.time & 255), Fe(n, n.gzhead.time >> 8 & 255), Fe(n, n.gzhead.time >> 16 & 255), Fe(n, n.gzhead.time >> 24 & 255), Fe(n, n.level === 9 ? 2 : n.strategy >= os || n.level < 2 ? 4 : 0), Fe(n, n.gzhead.os & 255), n.gzhead.extra && n.gzhead.extra.length && (Fe(n, n.gzhead.extra.length & 255), Fe(n, n.gzhead.extra.length >> 8 & 255)), n.gzhead.hcrc && (e.adler = Gr(e.adler, n.pending_buf, n.pending, 0)), n.gzindex = 0, n.status = Rc) : (Fe(n, 0), Fe(n, 0), Fe(n, 0), Fe(n, 0), Fe(n, 0), Fe(n, n.level === 9 ? 2 : n.strategy >= os || n.level < 2 ? 4 : 0), Fe(n, G2), n.status = Bn);
    else {
      var o = Ul + (n.w_bits - 8 << 4) << 8, s = -1;
      n.strategy >= os || n.level < 2 ? s = 0 : n.level < 6 ? s = 1 : n.level === 6 ? s = 2 : s = 3, o |= s << 6, n.strstart !== 0 && (o |= W2), o += 31 - o % 31, n.status = Bn, sa(n, o), n.strstart !== 0 && (sa(n, e.adler >>> 16), sa(n, e.adler & 65535)), e.adler = 1;
    }
  if (n.status === Rc)
    if (n.gzhead.extra) {
      for (i = n.pending; n.gzindex < (n.gzhead.extra.length & 65535) && !(n.pending === n.pending_buf_size && (n.gzhead.hcrc && n.pending > i && (e.adler = Gr(e.adler, n.pending_buf, n.pending - i, i)), Kr(e), i = n.pending, n.pending === n.pending_buf_size)); )
        Fe(n, n.gzhead.extra[n.gzindex] & 255), n.gzindex++;
      n.gzhead.hcrc && n.pending > i && (e.adler = Gr(e.adler, n.pending_buf, n.pending - i, i)), n.gzindex === n.gzhead.extra.length && (n.gzindex = 0, n.status = As);
    } else
      n.status = As;
  if (n.status === As)
    if (n.gzhead.name) {
      i = n.pending;
      do {
        if (n.pending === n.pending_buf_size && (n.gzhead.hcrc && n.pending > i && (e.adler = Gr(e.adler, n.pending_buf, n.pending - i, i)), Kr(e), i = n.pending, n.pending === n.pending_buf_size)) {
          a = 1;
          break;
        }
        n.gzindex < n.gzhead.name.length ? a = n.gzhead.name.charCodeAt(n.gzindex++) & 255 : a = 0, Fe(n, a);
      } while (a !== 0);
      n.gzhead.hcrc && n.pending > i && (e.adler = Gr(e.adler, n.pending_buf, n.pending - i, i)), a === 0 && (n.gzindex = 0, n.status = Ps);
    } else
      n.status = Ps;
  if (n.status === Ps)
    if (n.gzhead.comment) {
      i = n.pending;
      do {
        if (n.pending === n.pending_buf_size && (n.gzhead.hcrc && n.pending > i && (e.adler = Gr(e.adler, n.pending_buf, n.pending - i, i)), Kr(e), i = n.pending, n.pending === n.pending_buf_size)) {
          a = 1;
          break;
        }
        n.gzindex < n.gzhead.comment.length ? a = n.gzhead.comment.charCodeAt(n.gzindex++) & 255 : a = 0, Fe(n, a);
      } while (a !== 0);
      n.gzhead.hcrc && n.pending > i && (e.adler = Gr(e.adler, n.pending_buf, n.pending - i, i)), a === 0 && (n.status = Rs);
    } else
      n.status = Rs;
  if (n.status === Rs && (n.gzhead.hcrc ? (n.pending + 2 > n.pending_buf_size && Kr(e), n.pending + 2 <= n.pending_buf_size && (Fe(n, e.adler & 255), Fe(n, e.adler >> 8 & 255), e.adler = 0, n.status = Bn)) : n.status = Bn), n.pending !== 0) {
    if (Kr(e), e.avail_out === 0)
      return n.last_flush = -1, xr;
  } else if (e.avail_in === 0 && P0(t) <= P0(r) && t !== sn)
    return rn(e, Ku);
  if (n.status === ga && e.avail_in !== 0)
    return rn(e, Ku);
  if (e.avail_in !== 0 || n.lookahead !== 0 || t !== Qn && n.status !== ga) {
    var l = n.strategy === os ? Z2(n, t) : n.strategy === k2 ? Y2(n, t) : Si[n.level].func(n, t);
    if ((l === Vn || l === Wi) && (n.status = ga), l === Je || l === Vn)
      return e.avail_out === 0 && (n.last_flush = -1), xr;
    if (l === Co && (t === A2 ? Xt._tr_align(n) : t !== C0 && (Xt._tr_stored_block(n, 0, 0, !1), t === P2 && (Qr(n.head), n.lookahead === 0 && (n.strstart = 0, n.block_start = 0, n.insert = 0))), Kr(e), e.avail_out === 0))
      return n.last_flush = -1, xr;
  }
  return t !== sn ? xr : n.wrap <= 0 ? A0 : (n.wrap === 2 ? (Fe(n, e.adler & 255), Fe(n, e.adler >> 8 & 255), Fe(n, e.adler >> 16 & 255), Fe(n, e.adler >> 24 & 255), Fe(n, e.total_in & 255), Fe(n, e.total_in >> 8 & 255), Fe(n, e.total_in >> 16 & 255), Fe(n, e.total_in >> 24 & 255)) : (sa(n, e.adler >>> 16), sa(n, e.adler & 65535)), Kr(e), n.wrap > 0 && (n.wrap = -n.wrap), n.pending !== 0 ? xr : A0);
}
function rO(e) {
  var t;
  return !e || !e.state ? Yt : (t = e.state.status, t !== Ll && t !== Rc && t !== As && t !== Ps && t !== Rs && t !== Bn && t !== ga ? rn(e, Yt) : (e.state = null, t === Bn ? rn(e, R2) : xr));
}
function nO(e, t) {
  var r = t.length, n, i, a, o, s, l, u, c;
  if (!e || !e.state || (n = e.state, o = n.wrap, o === 2 || o === 1 && n.status !== Ll || n.lookahead))
    return Yt;
  for (o === 1 && (e.adler = Am(e.adler, t, r, 0)), n.wrap = 0, r >= n.w_size && (o === 0 && (Qr(n.head), n.strstart = 0, n.block_start = 0, n.insert = 0), c = new wt.Buf8(n.w_size), wt.arraySet(c, t, r - n.w_size, n.w_size, 0), t = c, r = n.w_size), s = e.avail_in, l = e.next_in, u = e.input, e.avail_in = r, e.next_in = 0, e.input = t, Hn(n); n.lookahead >= ye; ) {
    i = n.strstart, a = n.lookahead - (ye - 1);
    do
      n.ins_h = (n.ins_h << n.hash_shift ^ n.window[i + ye - 1]) & n.hash_mask, n.prev[i & n.w_mask] = n.head[n.ins_h], n.head[n.ins_h] = i, i++;
    while (--a);
    n.strstart = i, n.lookahead = ye - 1, Hn(n);
  }
  return n.strstart += n.lookahead, n.block_start = n.strstart, n.insert = n.lookahead, n.lookahead = 0, n.match_length = n.prev_length = ye - 1, n.match_available = 0, e.next_in = l, e.input = u, e.avail_in = s, n.wrap = o, xr;
}
Tr.deflateInit = eO;
Tr.deflateInit2 = Dm;
Tr.deflateReset = Om;
Tr.deflateResetKeep = Rm;
Tr.deflateSetHeader = $2;
Tr.deflate = tO;
Tr.deflateEnd = rO;
Tr.deflateSetDictionary = nO;
Tr.deflateInfo = "pako deflate (from Nodeca project)";
var $n = {}, Bl = Lr, km = !0, Nm = !0;
try {
  String.fromCharCode.apply(null, [0]);
} catch {
  km = !1;
}
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch {
  Nm = !1;
}
var ro = new Bl.Buf8(256);
for (var Hr = 0; Hr < 256; Hr++)
  ro[Hr] = Hr >= 252 ? 6 : Hr >= 248 ? 5 : Hr >= 240 ? 4 : Hr >= 224 ? 3 : Hr >= 192 ? 2 : 1;
ro[254] = ro[254] = 1;
$n.string2buf = function(e) {
  var t, r, n, i, a, o = e.length, s = 0;
  for (i = 0; i < o; i++)
    r = e.charCodeAt(i), (r & 64512) === 55296 && i + 1 < o && (n = e.charCodeAt(i + 1), (n & 64512) === 56320 && (r = 65536 + (r - 55296 << 10) + (n - 56320), i++)), s += r < 128 ? 1 : r < 2048 ? 2 : r < 65536 ? 3 : 4;
  for (t = new Bl.Buf8(s), a = 0, i = 0; a < s; i++)
    r = e.charCodeAt(i), (r & 64512) === 55296 && i + 1 < o && (n = e.charCodeAt(i + 1), (n & 64512) === 56320 && (r = 65536 + (r - 55296 << 10) + (n - 56320), i++)), r < 128 ? t[a++] = r : r < 2048 ? (t[a++] = 192 | r >>> 6, t[a++] = 128 | r & 63) : r < 65536 ? (t[a++] = 224 | r >>> 12, t[a++] = 128 | r >>> 6 & 63, t[a++] = 128 | r & 63) : (t[a++] = 240 | r >>> 18, t[a++] = 128 | r >>> 12 & 63, t[a++] = 128 | r >>> 6 & 63, t[a++] = 128 | r & 63);
  return t;
};
function Im(e, t) {
  if (t < 65534 && (e.subarray && Nm || !e.subarray && km))
    return String.fromCharCode.apply(null, Bl.shrinkBuf(e, t));
  for (var r = "", n = 0; n < t; n++)
    r += String.fromCharCode(e[n]);
  return r;
}
$n.buf2binstring = function(e) {
  return Im(e, e.length);
};
$n.binstring2buf = function(e) {
  for (var t = new Bl.Buf8(e.length), r = 0, n = t.length; r < n; r++)
    t[r] = e.charCodeAt(r);
  return t;
};
$n.buf2string = function(e, t) {
  var r, n, i, a, o = t || e.length, s = new Array(o * 2);
  for (n = 0, r = 0; r < o; ) {
    if (i = e[r++], i < 128) {
      s[n++] = i;
      continue;
    }
    if (a = ro[i], a > 4) {
      s[n++] = 65533, r += a - 1;
      continue;
    }
    for (i &= a === 2 ? 31 : a === 3 ? 15 : 7; a > 1 && r < o; )
      i = i << 6 | e[r++] & 63, a--;
    if (a > 1) {
      s[n++] = 65533;
      continue;
    }
    i < 65536 ? s[n++] = i : (i -= 65536, s[n++] = 55296 | i >> 10 & 1023, s[n++] = 56320 | i & 1023);
  }
  return Im(s, n);
};
$n.utf8border = function(e, t) {
  var r;
  for (t = t || e.length, t > e.length && (t = e.length), r = t - 1; r >= 0 && (e[r] & 192) === 128; )
    r--;
  return r < 0 || r === 0 ? t : r + ro[e[r]] > t ? r : t;
};
function iO() {
  this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
}
var Um = iO, Aa = Tr, Pa = Lr, Oc = $n, Dc = Nf, aO = Um, Lm = Object.prototype.toString, oO = 0, Yu = 4, Pi = 0, R0 = 1, O0 = 2, sO = -1, lO = 0, uO = 8;
function Wn(e) {
  if (!(this instanceof Wn)) return new Wn(e);
  this.options = Pa.assign({
    level: sO,
    method: uO,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: lO,
    to: ""
  }, e || {});
  var t = this.options;
  t.raw && t.windowBits > 0 ? t.windowBits = -t.windowBits : t.gzip && t.windowBits > 0 && t.windowBits < 16 && (t.windowBits += 16), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new aO(), this.strm.avail_out = 0;
  var r = Aa.deflateInit2(
    this.strm,
    t.level,
    t.method,
    t.windowBits,
    t.memLevel,
    t.strategy
  );
  if (r !== Pi)
    throw new Error(Dc[r]);
  if (t.header && Aa.deflateSetHeader(this.strm, t.header), t.dictionary) {
    var n;
    if (typeof t.dictionary == "string" ? n = Oc.string2buf(t.dictionary) : Lm.call(t.dictionary) === "[object ArrayBuffer]" ? n = new Uint8Array(t.dictionary) : n = t.dictionary, r = Aa.deflateSetDictionary(this.strm, n), r !== Pi)
      throw new Error(Dc[r]);
    this._dict_set = !0;
  }
}
Wn.prototype.push = function(e, t) {
  var r = this.strm, n = this.options.chunkSize, i, a;
  if (this.ended)
    return !1;
  a = t === ~~t ? t : t === !0 ? Yu : oO, typeof e == "string" ? r.input = Oc.string2buf(e) : Lm.call(e) === "[object ArrayBuffer]" ? r.input = new Uint8Array(e) : r.input = e, r.next_in = 0, r.avail_in = r.input.length;
  do {
    if (r.avail_out === 0 && (r.output = new Pa.Buf8(n), r.next_out = 0, r.avail_out = n), i = Aa.deflate(r, a), i !== R0 && i !== Pi)
      return this.onEnd(i), this.ended = !0, !1;
    (r.avail_out === 0 || r.avail_in === 0 && (a === Yu || a === O0)) && (this.options.to === "string" ? this.onData(Oc.buf2binstring(Pa.shrinkBuf(r.output, r.next_out))) : this.onData(Pa.shrinkBuf(r.output, r.next_out)));
  } while ((r.avail_in > 0 || r.avail_out === 0) && i !== R0);
  return a === Yu ? (i = Aa.deflateEnd(this.strm), this.onEnd(i), this.ended = !0, i === Pi) : (a === O0 && (this.onEnd(Pi), r.avail_out = 0), !0);
};
Wn.prototype.onData = function(e) {
  this.chunks.push(e);
};
Wn.prototype.onEnd = function(e) {
  e === Pi && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = Pa.flattenChunks(this.chunks)), this.chunks = [], this.err = e, this.msg = this.strm.msg;
};
function If(e, t) {
  var r = new Wn(t);
  if (r.push(e, !0), r.err)
    throw r.msg || Dc[r.err];
  return r.result;
}
function cO(e, t) {
  return t = t || {}, t.raw = !0, If(e, t);
}
function fO(e, t) {
  return t = t || {}, t.gzip = !0, If(e, t);
}
Fo.Deflate = Wn;
Fo.deflate = If;
Fo.deflateRaw = cO;
Fo.gzip = fO;
var Ao = {}, pr = {}, ss = 30, hO = 12, dO = function(t, r) {
  var n, i, a, o, s, l, u, c, f, h, d, p, v, y, m, S, T, C, A, O, k, M, b, j, I;
  n = t.state, i = t.next_in, j = t.input, a = i + (t.avail_in - 5), o = t.next_out, I = t.output, s = o - (r - t.avail_out), l = o + (t.avail_out - 257), u = n.dmax, c = n.wsize, f = n.whave, h = n.wnext, d = n.window, p = n.hold, v = n.bits, y = n.lencode, m = n.distcode, S = (1 << n.lenbits) - 1, T = (1 << n.distbits) - 1;
  e:
    do {
      v < 15 && (p += j[i++] << v, v += 8, p += j[i++] << v, v += 8), C = y[p & S];
      t:
        for (; ; ) {
          if (A = C >>> 24, p >>>= A, v -= A, A = C >>> 16 & 255, A === 0)
            I[o++] = C & 65535;
          else if (A & 16) {
            O = C & 65535, A &= 15, A && (v < A && (p += j[i++] << v, v += 8), O += p & (1 << A) - 1, p >>>= A, v -= A), v < 15 && (p += j[i++] << v, v += 8, p += j[i++] << v, v += 8), C = m[p & T];
            r:
              for (; ; ) {
                if (A = C >>> 24, p >>>= A, v -= A, A = C >>> 16 & 255, A & 16) {
                  if (k = C & 65535, A &= 15, v < A && (p += j[i++] << v, v += 8, v < A && (p += j[i++] << v, v += 8)), k += p & (1 << A) - 1, k > u) {
                    t.msg = "invalid distance too far back", n.mode = ss;
                    break e;
                  }
                  if (p >>>= A, v -= A, A = o - s, k > A) {
                    if (A = k - A, A > f && n.sane) {
                      t.msg = "invalid distance too far back", n.mode = ss;
                      break e;
                    }
                    if (M = 0, b = d, h === 0) {
                      if (M += c - A, A < O) {
                        O -= A;
                        do
                          I[o++] = d[M++];
                        while (--A);
                        M = o - k, b = I;
                      }
                    } else if (h < A) {
                      if (M += c + h - A, A -= h, A < O) {
                        O -= A;
                        do
                          I[o++] = d[M++];
                        while (--A);
                        if (M = 0, h < O) {
                          A = h, O -= A;
                          do
                            I[o++] = d[M++];
                          while (--A);
                          M = o - k, b = I;
                        }
                      }
                    } else if (M += h - A, A < O) {
                      O -= A;
                      do
                        I[o++] = d[M++];
                      while (--A);
                      M = o - k, b = I;
                    }
                    for (; O > 2; )
                      I[o++] = b[M++], I[o++] = b[M++], I[o++] = b[M++], O -= 3;
                    O && (I[o++] = b[M++], O > 1 && (I[o++] = b[M++]));
                  } else {
                    M = o - k;
                    do
                      I[o++] = I[M++], I[o++] = I[M++], I[o++] = I[M++], O -= 3;
                    while (O > 2);
                    O && (I[o++] = I[M++], O > 1 && (I[o++] = I[M++]));
                  }
                } else if (A & 64) {
                  t.msg = "invalid distance code", n.mode = ss;
                  break e;
                } else {
                  C = m[(C & 65535) + (p & (1 << A) - 1)];
                  continue r;
                }
                break;
              }
          } else if (A & 64)
            if (A & 32) {
              n.mode = hO;
              break e;
            } else {
              t.msg = "invalid literal/length code", n.mode = ss;
              break e;
            }
          else {
            C = y[(C & 65535) + (p & (1 << A) - 1)];
            continue t;
          }
          break;
        }
    } while (i < a && o < l);
  O = v >> 3, i -= O, v -= O << 3, p &= (1 << v) - 1, t.next_in = i, t.next_out = o, t.avail_in = i < a ? 5 + (a - i) : 5 - (i - a), t.avail_out = o < l ? 257 + (l - o) : 257 - (o - l), n.hold = p, n.bits = v;
}, D0 = Lr, di = 15, k0 = 852, N0 = 592, I0 = 0, Zu = 1, U0 = 2, pO = [
  /* Length codes 257..285 base */
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  13,
  15,
  17,
  19,
  23,
  27,
  31,
  35,
  43,
  51,
  59,
  67,
  83,
  99,
  115,
  131,
  163,
  195,
  227,
  258,
  0,
  0
], vO = [
  /* Length codes 257..285 extra */
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  17,
  17,
  17,
  17,
  18,
  18,
  18,
  18,
  19,
  19,
  19,
  19,
  20,
  20,
  20,
  20,
  21,
  21,
  21,
  21,
  16,
  72,
  78
], gO = [
  /* Distance codes 0..29 base */
  1,
  2,
  3,
  4,
  5,
  7,
  9,
  13,
  17,
  25,
  33,
  49,
  65,
  97,
  129,
  193,
  257,
  385,
  513,
  769,
  1025,
  1537,
  2049,
  3073,
  4097,
  6145,
  8193,
  12289,
  16385,
  24577,
  0,
  0
], mO = [
  /* Distance codes 0..29 extra */
  16,
  16,
  16,
  16,
  17,
  17,
  18,
  18,
  19,
  19,
  20,
  20,
  21,
  21,
  22,
  22,
  23,
  23,
  24,
  24,
  25,
  25,
  26,
  26,
  27,
  27,
  28,
  28,
  29,
  29,
  64,
  64
], yO = function(t, r, n, i, a, o, s, l) {
  var u = l.bits, c = 0, f = 0, h = 0, d = 0, p = 0, v = 0, y = 0, m = 0, S = 0, T = 0, C, A, O, k, M, b = null, j = 0, I, q = new D0.Buf16(di + 1), z = new D0.Buf16(di + 1), B = null, N = 0, L, U, X;
  for (c = 0; c <= di; c++)
    q[c] = 0;
  for (f = 0; f < i; f++)
    q[r[n + f]]++;
  for (p = u, d = di; d >= 1 && q[d] === 0; d--)
    ;
  if (p > d && (p = d), d === 0)
    return a[o++] = 1 << 24 | 64 << 16 | 0, a[o++] = 1 << 24 | 64 << 16 | 0, l.bits = 1, 0;
  for (h = 1; h < d && q[h] === 0; h++)
    ;
  for (p < h && (p = h), m = 1, c = 1; c <= di; c++)
    if (m <<= 1, m -= q[c], m < 0)
      return -1;
  if (m > 0 && (t === I0 || d !== 1))
    return -1;
  for (z[1] = 0, c = 1; c < di; c++)
    z[c + 1] = z[c] + q[c];
  for (f = 0; f < i; f++)
    r[n + f] !== 0 && (s[z[r[n + f]]++] = f);
  if (t === I0 ? (b = B = s, I = 19) : t === Zu ? (b = pO, j -= 257, B = vO, N -= 257, I = 256) : (b = gO, B = mO, I = -1), T = 0, f = 0, c = h, M = o, v = p, y = 0, O = -1, S = 1 << p, k = S - 1, t === Zu && S > k0 || t === U0 && S > N0)
    return 1;
  for (; ; ) {
    L = c - y, s[f] < I ? (U = 0, X = s[f]) : s[f] > I ? (U = B[N + s[f]], X = b[j + s[f]]) : (U = 96, X = 0), C = 1 << c - y, A = 1 << v, h = A;
    do
      A -= C, a[M + (T >> y) + A] = L << 24 | U << 16 | X | 0;
    while (A !== 0);
    for (C = 1 << c - 1; T & C; )
      C >>= 1;
    if (C !== 0 ? (T &= C - 1, T += C) : T = 0, f++, --q[c] === 0) {
      if (c === d)
        break;
      c = r[n + s[f]];
    }
    if (c > p && (T & k) !== O) {
      for (y === 0 && (y = p), M += h, v = c - y, m = 1 << v; v + y < d && (m -= q[v + y], !(m <= 0)); )
        v++, m <<= 1;
      if (S += 1 << v, t === Zu && S > k0 || t === U0 && S > N0)
        return 1;
      O = T & k, a[O] = p << 24 | v << 16 | M - o | 0;
    }
  }
  return T !== 0 && (a[M + T] = c - y << 24 | 64 << 16 | 0), l.bits = p, 0;
}, Ut = Lr, kc = Tm, mr = Cm, bO = dO, Ra = yO, wO = 0, Bm = 1, Mm = 2, L0 = 4, xO = 5, ls = 6, Gn = 0, EO = 1, SO = 2, Zt = -2, jm = -3, _m = -4, FO = -5, B0 = 8, zm = 1, M0 = 2, j0 = 3, _0 = 4, z0 = 5, q0 = 6, V0 = 7, H0 = 8, W0 = 9, G0 = 10, Zs = 11, Pr = 12, Ju = 13, K0 = 14, Qu = 15, X0 = 16, Y0 = 17, Z0 = 18, J0 = 19, us = 20, cs = 21, Q0 = 22, $0 = 23, ep = 24, tp = 25, rp = 26, $u = 27, np = 28, ip = 29, Be = 30, qm = 31, TO = 32, CO = 852, AO = 592, PO = 15, RO = PO;
function ap(e) {
  return (e >>> 24 & 255) + (e >>> 8 & 65280) + ((e & 65280) << 8) + ((e & 255) << 24);
}
function OO() {
  this.mode = 0, this.last = !1, this.wrap = 0, this.havedict = !1, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new Ut.Buf16(320), this.work = new Ut.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
}
function Vm(e) {
  var t;
  return !e || !e.state ? Zt : (t = e.state, e.total_in = e.total_out = t.total = 0, e.msg = "", t.wrap && (e.adler = t.wrap & 1), t.mode = zm, t.last = 0, t.havedict = 0, t.dmax = 32768, t.head = null, t.hold = 0, t.bits = 0, t.lencode = t.lendyn = new Ut.Buf32(CO), t.distcode = t.distdyn = new Ut.Buf32(AO), t.sane = 1, t.back = -1, Gn);
}
function Hm(e) {
  var t;
  return !e || !e.state ? Zt : (t = e.state, t.wsize = 0, t.whave = 0, t.wnext = 0, Vm(e));
}
function Wm(e, t) {
  var r, n;
  return !e || !e.state || (n = e.state, t < 0 ? (r = 0, t = -t) : (r = (t >> 4) + 1, t < 48 && (t &= 15)), t && (t < 8 || t > 15)) ? Zt : (n.window !== null && n.wbits !== t && (n.window = null), n.wrap = r, n.wbits = t, Hm(e));
}
function Gm(e, t) {
  var r, n;
  return e ? (n = new OO(), e.state = n, n.window = null, r = Wm(e, t), r !== Gn && (e.state = null), r) : Zt;
}
function DO(e) {
  return Gm(e, RO);
}
var op = !0, ec, tc;
function kO(e) {
  if (op) {
    var t;
    for (ec = new Ut.Buf32(512), tc = new Ut.Buf32(32), t = 0; t < 144; )
      e.lens[t++] = 8;
    for (; t < 256; )
      e.lens[t++] = 9;
    for (; t < 280; )
      e.lens[t++] = 7;
    for (; t < 288; )
      e.lens[t++] = 8;
    for (Ra(Bm, e.lens, 0, 288, ec, 0, e.work, { bits: 9 }), t = 0; t < 32; )
      e.lens[t++] = 5;
    Ra(Mm, e.lens, 0, 32, tc, 0, e.work, { bits: 5 }), op = !1;
  }
  e.lencode = ec, e.lenbits = 9, e.distcode = tc, e.distbits = 5;
}
function Km(e, t, r, n) {
  var i, a = e.state;
  return a.window === null && (a.wsize = 1 << a.wbits, a.wnext = 0, a.whave = 0, a.window = new Ut.Buf8(a.wsize)), n >= a.wsize ? (Ut.arraySet(a.window, t, r - a.wsize, a.wsize, 0), a.wnext = 0, a.whave = a.wsize) : (i = a.wsize - a.wnext, i > n && (i = n), Ut.arraySet(a.window, t, r - n, i, a.wnext), n -= i, n ? (Ut.arraySet(a.window, t, r - n, n, 0), a.wnext = n, a.whave = a.wsize) : (a.wnext += i, a.wnext === a.wsize && (a.wnext = 0), a.whave < a.wsize && (a.whave += i))), 0;
}
function NO(e, t) {
  var r, n, i, a, o, s, l, u, c, f, h, d, p, v, y = 0, m, S, T, C, A, O, k, M, b = new Ut.Buf8(4), j, I, q = (
    /* permutation of code lengths */
    [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
  );
  if (!e || !e.state || !e.output || !e.input && e.avail_in !== 0)
    return Zt;
  r = e.state, r.mode === Pr && (r.mode = Ju), o = e.next_out, i = e.output, l = e.avail_out, a = e.next_in, n = e.input, s = e.avail_in, u = r.hold, c = r.bits, f = s, h = l, M = Gn;
  e:
    for (; ; )
      switch (r.mode) {
        case zm:
          if (r.wrap === 0) {
            r.mode = Ju;
            break;
          }
          for (; c < 16; ) {
            if (s === 0)
              break e;
            s--, u += n[a++] << c, c += 8;
          }
          if (r.wrap & 2 && u === 35615) {
            r.check = 0, b[0] = u & 255, b[1] = u >>> 8 & 255, r.check = mr(r.check, b, 2, 0), u = 0, c = 0, r.mode = M0;
            break;
          }
          if (r.flags = 0, r.head && (r.head.done = !1), !(r.wrap & 1) || /* check if zlib header allowed */
          (((u & 255) << 8) + (u >> 8)) % 31) {
            e.msg = "incorrect header check", r.mode = Be;
            break;
          }
          if ((u & 15) !== B0) {
            e.msg = "unknown compression method", r.mode = Be;
            break;
          }
          if (u >>>= 4, c -= 4, k = (u & 15) + 8, r.wbits === 0)
            r.wbits = k;
          else if (k > r.wbits) {
            e.msg = "invalid window size", r.mode = Be;
            break;
          }
          r.dmax = 1 << k, e.adler = r.check = 1, r.mode = u & 512 ? G0 : Pr, u = 0, c = 0;
          break;
        case M0:
          for (; c < 16; ) {
            if (s === 0)
              break e;
            s--, u += n[a++] << c, c += 8;
          }
          if (r.flags = u, (r.flags & 255) !== B0) {
            e.msg = "unknown compression method", r.mode = Be;
            break;
          }
          if (r.flags & 57344) {
            e.msg = "unknown header flags set", r.mode = Be;
            break;
          }
          r.head && (r.head.text = u >> 8 & 1), r.flags & 512 && (b[0] = u & 255, b[1] = u >>> 8 & 255, r.check = mr(r.check, b, 2, 0)), u = 0, c = 0, r.mode = j0;
        case j0:
          for (; c < 32; ) {
            if (s === 0)
              break e;
            s--, u += n[a++] << c, c += 8;
          }
          r.head && (r.head.time = u), r.flags & 512 && (b[0] = u & 255, b[1] = u >>> 8 & 255, b[2] = u >>> 16 & 255, b[3] = u >>> 24 & 255, r.check = mr(r.check, b, 4, 0)), u = 0, c = 0, r.mode = _0;
        case _0:
          for (; c < 16; ) {
            if (s === 0)
              break e;
            s--, u += n[a++] << c, c += 8;
          }
          r.head && (r.head.xflags = u & 255, r.head.os = u >> 8), r.flags & 512 && (b[0] = u & 255, b[1] = u >>> 8 & 255, r.check = mr(r.check, b, 2, 0)), u = 0, c = 0, r.mode = z0;
        case z0:
          if (r.flags & 1024) {
            for (; c < 16; ) {
              if (s === 0)
                break e;
              s--, u += n[a++] << c, c += 8;
            }
            r.length = u, r.head && (r.head.extra_len = u), r.flags & 512 && (b[0] = u & 255, b[1] = u >>> 8 & 255, r.check = mr(r.check, b, 2, 0)), u = 0, c = 0;
          } else r.head && (r.head.extra = null);
          r.mode = q0;
        case q0:
          if (r.flags & 1024 && (d = r.length, d > s && (d = s), d && (r.head && (k = r.head.extra_len - r.length, r.head.extra || (r.head.extra = new Array(r.head.extra_len)), Ut.arraySet(
            r.head.extra,
            n,
            a,
            // extra field is limited to 65536 bytes
            // - no need for additional size check
            d,
            /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
            k
          )), r.flags & 512 && (r.check = mr(r.check, n, d, a)), s -= d, a += d, r.length -= d), r.length))
            break e;
          r.length = 0, r.mode = V0;
        case V0:
          if (r.flags & 2048) {
            if (s === 0)
              break e;
            d = 0;
            do
              k = n[a + d++], r.head && k && r.length < 65536 && (r.head.name += String.fromCharCode(k));
            while (k && d < s);
            if (r.flags & 512 && (r.check = mr(r.check, n, d, a)), s -= d, a += d, k)
              break e;
          } else r.head && (r.head.name = null);
          r.length = 0, r.mode = H0;
        case H0:
          if (r.flags & 4096) {
            if (s === 0)
              break e;
            d = 0;
            do
              k = n[a + d++], r.head && k && r.length < 65536 && (r.head.comment += String.fromCharCode(k));
            while (k && d < s);
            if (r.flags & 512 && (r.check = mr(r.check, n, d, a)), s -= d, a += d, k)
              break e;
          } else r.head && (r.head.comment = null);
          r.mode = W0;
        case W0:
          if (r.flags & 512) {
            for (; c < 16; ) {
              if (s === 0)
                break e;
              s--, u += n[a++] << c, c += 8;
            }
            if (u !== (r.check & 65535)) {
              e.msg = "header crc mismatch", r.mode = Be;
              break;
            }
            u = 0, c = 0;
          }
          r.head && (r.head.hcrc = r.flags >> 9 & 1, r.head.done = !0), e.adler = r.check = 0, r.mode = Pr;
          break;
        case G0:
          for (; c < 32; ) {
            if (s === 0)
              break e;
            s--, u += n[a++] << c, c += 8;
          }
          e.adler = r.check = ap(u), u = 0, c = 0, r.mode = Zs;
        case Zs:
          if (r.havedict === 0)
            return e.next_out = o, e.avail_out = l, e.next_in = a, e.avail_in = s, r.hold = u, r.bits = c, SO;
          e.adler = r.check = 1, r.mode = Pr;
        case Pr:
          if (t === xO || t === ls)
            break e;
        case Ju:
          if (r.last) {
            u >>>= c & 7, c -= c & 7, r.mode = $u;
            break;
          }
          for (; c < 3; ) {
            if (s === 0)
              break e;
            s--, u += n[a++] << c, c += 8;
          }
          switch (r.last = u & 1, u >>>= 1, c -= 1, u & 3) {
            case 0:
              r.mode = K0;
              break;
            case 1:
              if (kO(r), r.mode = us, t === ls) {
                u >>>= 2, c -= 2;
                break e;
              }
              break;
            case 2:
              r.mode = Y0;
              break;
            case 3:
              e.msg = "invalid block type", r.mode = Be;
          }
          u >>>= 2, c -= 2;
          break;
        case K0:
          for (u >>>= c & 7, c -= c & 7; c < 32; ) {
            if (s === 0)
              break e;
            s--, u += n[a++] << c, c += 8;
          }
          if ((u & 65535) !== (u >>> 16 ^ 65535)) {
            e.msg = "invalid stored block lengths", r.mode = Be;
            break;
          }
          if (r.length = u & 65535, u = 0, c = 0, r.mode = Qu, t === ls)
            break e;
        case Qu:
          r.mode = X0;
        case X0:
          if (d = r.length, d) {
            if (d > s && (d = s), d > l && (d = l), d === 0)
              break e;
            Ut.arraySet(i, n, a, d, o), s -= d, a += d, l -= d, o += d, r.length -= d;
            break;
          }
          r.mode = Pr;
          break;
        case Y0:
          for (; c < 14; ) {
            if (s === 0)
              break e;
            s--, u += n[a++] << c, c += 8;
          }
          if (r.nlen = (u & 31) + 257, u >>>= 5, c -= 5, r.ndist = (u & 31) + 1, u >>>= 5, c -= 5, r.ncode = (u & 15) + 4, u >>>= 4, c -= 4, r.nlen > 286 || r.ndist > 30) {
            e.msg = "too many length or distance symbols", r.mode = Be;
            break;
          }
          r.have = 0, r.mode = Z0;
        case Z0:
          for (; r.have < r.ncode; ) {
            for (; c < 3; ) {
              if (s === 0)
                break e;
              s--, u += n[a++] << c, c += 8;
            }
            r.lens[q[r.have++]] = u & 7, u >>>= 3, c -= 3;
          }
          for (; r.have < 19; )
            r.lens[q[r.have++]] = 0;
          if (r.lencode = r.lendyn, r.lenbits = 7, j = { bits: r.lenbits }, M = Ra(wO, r.lens, 0, 19, r.lencode, 0, r.work, j), r.lenbits = j.bits, M) {
            e.msg = "invalid code lengths set", r.mode = Be;
            break;
          }
          r.have = 0, r.mode = J0;
        case J0:
          for (; r.have < r.nlen + r.ndist; ) {
            for (; y = r.lencode[u & (1 << r.lenbits) - 1], m = y >>> 24, S = y >>> 16 & 255, T = y & 65535, !(m <= c); ) {
              if (s === 0)
                break e;
              s--, u += n[a++] << c, c += 8;
            }
            if (T < 16)
              u >>>= m, c -= m, r.lens[r.have++] = T;
            else {
              if (T === 16) {
                for (I = m + 2; c < I; ) {
                  if (s === 0)
                    break e;
                  s--, u += n[a++] << c, c += 8;
                }
                if (u >>>= m, c -= m, r.have === 0) {
                  e.msg = "invalid bit length repeat", r.mode = Be;
                  break;
                }
                k = r.lens[r.have - 1], d = 3 + (u & 3), u >>>= 2, c -= 2;
              } else if (T === 17) {
                for (I = m + 3; c < I; ) {
                  if (s === 0)
                    break e;
                  s--, u += n[a++] << c, c += 8;
                }
                u >>>= m, c -= m, k = 0, d = 3 + (u & 7), u >>>= 3, c -= 3;
              } else {
                for (I = m + 7; c < I; ) {
                  if (s === 0)
                    break e;
                  s--, u += n[a++] << c, c += 8;
                }
                u >>>= m, c -= m, k = 0, d = 11 + (u & 127), u >>>= 7, c -= 7;
              }
              if (r.have + d > r.nlen + r.ndist) {
                e.msg = "invalid bit length repeat", r.mode = Be;
                break;
              }
              for (; d--; )
                r.lens[r.have++] = k;
            }
          }
          if (r.mode === Be)
            break;
          if (r.lens[256] === 0) {
            e.msg = "invalid code -- missing end-of-block", r.mode = Be;
            break;
          }
          if (r.lenbits = 9, j = { bits: r.lenbits }, M = Ra(Bm, r.lens, 0, r.nlen, r.lencode, 0, r.work, j), r.lenbits = j.bits, M) {
            e.msg = "invalid literal/lengths set", r.mode = Be;
            break;
          }
          if (r.distbits = 6, r.distcode = r.distdyn, j = { bits: r.distbits }, M = Ra(Mm, r.lens, r.nlen, r.ndist, r.distcode, 0, r.work, j), r.distbits = j.bits, M) {
            e.msg = "invalid distances set", r.mode = Be;
            break;
          }
          if (r.mode = us, t === ls)
            break e;
        case us:
          r.mode = cs;
        case cs:
          if (s >= 6 && l >= 258) {
            e.next_out = o, e.avail_out = l, e.next_in = a, e.avail_in = s, r.hold = u, r.bits = c, bO(e, h), o = e.next_out, i = e.output, l = e.avail_out, a = e.next_in, n = e.input, s = e.avail_in, u = r.hold, c = r.bits, r.mode === Pr && (r.back = -1);
            break;
          }
          for (r.back = 0; y = r.lencode[u & (1 << r.lenbits) - 1], m = y >>> 24, S = y >>> 16 & 255, T = y & 65535, !(m <= c); ) {
            if (s === 0)
              break e;
            s--, u += n[a++] << c, c += 8;
          }
          if (S && !(S & 240)) {
            for (C = m, A = S, O = T; y = r.lencode[O + ((u & (1 << C + A) - 1) >> C)], m = y >>> 24, S = y >>> 16 & 255, T = y & 65535, !(C + m <= c); ) {
              if (s === 0)
                break e;
              s--, u += n[a++] << c, c += 8;
            }
            u >>>= C, c -= C, r.back += C;
          }
          if (u >>>= m, c -= m, r.back += m, r.length = T, S === 0) {
            r.mode = rp;
            break;
          }
          if (S & 32) {
            r.back = -1, r.mode = Pr;
            break;
          }
          if (S & 64) {
            e.msg = "invalid literal/length code", r.mode = Be;
            break;
          }
          r.extra = S & 15, r.mode = Q0;
        case Q0:
          if (r.extra) {
            for (I = r.extra; c < I; ) {
              if (s === 0)
                break e;
              s--, u += n[a++] << c, c += 8;
            }
            r.length += u & (1 << r.extra) - 1, u >>>= r.extra, c -= r.extra, r.back += r.extra;
          }
          r.was = r.length, r.mode = $0;
        case $0:
          for (; y = r.distcode[u & (1 << r.distbits) - 1], m = y >>> 24, S = y >>> 16 & 255, T = y & 65535, !(m <= c); ) {
            if (s === 0)
              break e;
            s--, u += n[a++] << c, c += 8;
          }
          if (!(S & 240)) {
            for (C = m, A = S, O = T; y = r.distcode[O + ((u & (1 << C + A) - 1) >> C)], m = y >>> 24, S = y >>> 16 & 255, T = y & 65535, !(C + m <= c); ) {
              if (s === 0)
                break e;
              s--, u += n[a++] << c, c += 8;
            }
            u >>>= C, c -= C, r.back += C;
          }
          if (u >>>= m, c -= m, r.back += m, S & 64) {
            e.msg = "invalid distance code", r.mode = Be;
            break;
          }
          r.offset = T, r.extra = S & 15, r.mode = ep;
        case ep:
          if (r.extra) {
            for (I = r.extra; c < I; ) {
              if (s === 0)
                break e;
              s--, u += n[a++] << c, c += 8;
            }
            r.offset += u & (1 << r.extra) - 1, u >>>= r.extra, c -= r.extra, r.back += r.extra;
          }
          if (r.offset > r.dmax) {
            e.msg = "invalid distance too far back", r.mode = Be;
            break;
          }
          r.mode = tp;
        case tp:
          if (l === 0)
            break e;
          if (d = h - l, r.offset > d) {
            if (d = r.offset - d, d > r.whave && r.sane) {
              e.msg = "invalid distance too far back", r.mode = Be;
              break;
            }
            d > r.wnext ? (d -= r.wnext, p = r.wsize - d) : p = r.wnext - d, d > r.length && (d = r.length), v = r.window;
          } else
            v = i, p = o - r.offset, d = r.length;
          d > l && (d = l), l -= d, r.length -= d;
          do
            i[o++] = v[p++];
          while (--d);
          r.length === 0 && (r.mode = cs);
          break;
        case rp:
          if (l === 0)
            break e;
          i[o++] = r.length, l--, r.mode = cs;
          break;
        case $u:
          if (r.wrap) {
            for (; c < 32; ) {
              if (s === 0)
                break e;
              s--, u |= n[a++] << c, c += 8;
            }
            if (h -= l, e.total_out += h, r.total += h, h && (e.adler = r.check = /*UPDATE(state.check, put - _out, _out);*/
            r.flags ? mr(r.check, i, h, o - h) : kc(r.check, i, h, o - h)), h = l, (r.flags ? u : ap(u)) !== r.check) {
              e.msg = "incorrect data check", r.mode = Be;
              break;
            }
            u = 0, c = 0;
          }
          r.mode = np;
        case np:
          if (r.wrap && r.flags) {
            for (; c < 32; ) {
              if (s === 0)
                break e;
              s--, u += n[a++] << c, c += 8;
            }
            if (u !== (r.total & 4294967295)) {
              e.msg = "incorrect length check", r.mode = Be;
              break;
            }
            u = 0, c = 0;
          }
          r.mode = ip;
        case ip:
          M = EO;
          break e;
        case Be:
          M = jm;
          break e;
        case qm:
          return _m;
        case TO:
        default:
          return Zt;
      }
  return e.next_out = o, e.avail_out = l, e.next_in = a, e.avail_in = s, r.hold = u, r.bits = c, (r.wsize || h !== e.avail_out && r.mode < Be && (r.mode < $u || t !== L0)) && Km(e, e.output, e.next_out, h - e.avail_out), f -= e.avail_in, h -= e.avail_out, e.total_in += f, e.total_out += h, r.total += h, r.wrap && h && (e.adler = r.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
  r.flags ? mr(r.check, i, h, e.next_out - h) : kc(r.check, i, h, e.next_out - h)), e.data_type = r.bits + (r.last ? 64 : 0) + (r.mode === Pr ? 128 : 0) + (r.mode === us || r.mode === Qu ? 256 : 0), (f === 0 && h === 0 || t === L0) && M === Gn && (M = FO), M;
}
function IO(e) {
  if (!e || !e.state)
    return Zt;
  var t = e.state;
  return t.window && (t.window = null), e.state = null, Gn;
}
function UO(e, t) {
  var r;
  return !e || !e.state || (r = e.state, !(r.wrap & 2)) ? Zt : (r.head = t, t.done = !1, Gn);
}
function LO(e, t) {
  var r = t.length, n, i, a;
  return !e || !e.state || (n = e.state, n.wrap !== 0 && n.mode !== Zs) ? Zt : n.mode === Zs && (i = 1, i = kc(i, t, r, 0), i !== n.check) ? jm : (a = Km(e, t, r, r), a ? (n.mode = qm, _m) : (n.havedict = 1, Gn));
}
pr.inflateReset = Hm;
pr.inflateReset2 = Wm;
pr.inflateResetKeep = Vm;
pr.inflateInit = DO;
pr.inflateInit2 = Gm;
pr.inflate = NO;
pr.inflateEnd = IO;
pr.inflateGetHeader = UO;
pr.inflateSetDictionary = LO;
pr.inflateInfo = "pako inflate (from Nodeca project)";
var Xm = {
  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_BLOCK: 5,
  Z_TREES: 6,
  /* Return codes for the compression/decompression functions. Negative values
  * are errors, positive values are used for special but normal events.
  */
  Z_OK: 0,
  Z_STREAM_END: 1,
  Z_NEED_DICT: 2,
  Z_ERRNO: -1,
  Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3,
  //Z_MEM_ERROR:     -4,
  Z_BUF_ERROR: -5,
  //Z_VERSION_ERROR: -6,
  /* compression levels */
  Z_NO_COMPRESSION: 0,
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_DEFAULT_COMPRESSION: -1,
  Z_FILTERED: 1,
  Z_HUFFMAN_ONLY: 2,
  Z_RLE: 3,
  Z_FIXED: 4,
  Z_DEFAULT_STRATEGY: 0,
  /* Possible values of the data_type field (though see inflate()) */
  Z_BINARY: 0,
  Z_TEXT: 1,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN: 2,
  /* The deflate compression method */
  Z_DEFLATED: 8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
};
function BO() {
  this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = !1;
}
var MO = BO, Ri = pr, Oa = Lr, Os = $n, He = Xm, Nc = Nf, jO = Um, _O = MO, Ym = Object.prototype.toString;
function Kn(e) {
  if (!(this instanceof Kn)) return new Kn(e);
  this.options = Oa.assign({
    chunkSize: 16384,
    windowBits: 0,
    to: ""
  }, e || {});
  var t = this.options;
  t.raw && t.windowBits >= 0 && t.windowBits < 16 && (t.windowBits = -t.windowBits, t.windowBits === 0 && (t.windowBits = -15)), t.windowBits >= 0 && t.windowBits < 16 && !(e && e.windowBits) && (t.windowBits += 32), t.windowBits > 15 && t.windowBits < 48 && (t.windowBits & 15 || (t.windowBits |= 15)), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new jO(), this.strm.avail_out = 0;
  var r = Ri.inflateInit2(
    this.strm,
    t.windowBits
  );
  if (r !== He.Z_OK)
    throw new Error(Nc[r]);
  if (this.header = new _O(), Ri.inflateGetHeader(this.strm, this.header), t.dictionary && (typeof t.dictionary == "string" ? t.dictionary = Os.string2buf(t.dictionary) : Ym.call(t.dictionary) === "[object ArrayBuffer]" && (t.dictionary = new Uint8Array(t.dictionary)), t.raw && (r = Ri.inflateSetDictionary(this.strm, t.dictionary), r !== He.Z_OK)))
    throw new Error(Nc[r]);
}
Kn.prototype.push = function(e, t) {
  var r = this.strm, n = this.options.chunkSize, i = this.options.dictionary, a, o, s, l, u, c = !1;
  if (this.ended)
    return !1;
  o = t === ~~t ? t : t === !0 ? He.Z_FINISH : He.Z_NO_FLUSH, typeof e == "string" ? r.input = Os.binstring2buf(e) : Ym.call(e) === "[object ArrayBuffer]" ? r.input = new Uint8Array(e) : r.input = e, r.next_in = 0, r.avail_in = r.input.length;
  do {
    if (r.avail_out === 0 && (r.output = new Oa.Buf8(n), r.next_out = 0, r.avail_out = n), a = Ri.inflate(r, He.Z_NO_FLUSH), a === He.Z_NEED_DICT && i && (a = Ri.inflateSetDictionary(this.strm, i)), a === He.Z_BUF_ERROR && c === !0 && (a = He.Z_OK, c = !1), a !== He.Z_STREAM_END && a !== He.Z_OK)
      return this.onEnd(a), this.ended = !0, !1;
    r.next_out && (r.avail_out === 0 || a === He.Z_STREAM_END || r.avail_in === 0 && (o === He.Z_FINISH || o === He.Z_SYNC_FLUSH)) && (this.options.to === "string" ? (s = Os.utf8border(r.output, r.next_out), l = r.next_out - s, u = Os.buf2string(r.output, s), r.next_out = l, r.avail_out = n - l, l && Oa.arraySet(r.output, r.output, s, l, 0), this.onData(u)) : this.onData(Oa.shrinkBuf(r.output, r.next_out))), r.avail_in === 0 && r.avail_out === 0 && (c = !0);
  } while ((r.avail_in > 0 || r.avail_out === 0) && a !== He.Z_STREAM_END);
  return a === He.Z_STREAM_END && (o = He.Z_FINISH), o === He.Z_FINISH ? (a = Ri.inflateEnd(this.strm), this.onEnd(a), this.ended = !0, a === He.Z_OK) : (o === He.Z_SYNC_FLUSH && (this.onEnd(He.Z_OK), r.avail_out = 0), !0);
};
Kn.prototype.onData = function(e) {
  this.chunks.push(e);
};
Kn.prototype.onEnd = function(e) {
  e === He.Z_OK && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = Oa.flattenChunks(this.chunks)), this.chunks = [], this.err = e, this.msg = this.strm.msg;
};
function Uf(e, t) {
  var r = new Kn(t);
  if (r.push(e, !0), r.err)
    throw r.msg || Nc[r.err];
  return r.result;
}
function zO(e, t) {
  return t = t || {}, t.raw = !0, Uf(e, t);
}
Ao.Inflate = Kn;
Ao.inflate = Uf;
Ao.inflateRaw = zO;
Ao.ungzip = Uf;
var qO = Lr.assign, VO = Fo, HO = Ao, WO = Xm, Zm = {};
qO(Zm, VO, HO, WO);
var GO = Zm;
const Ml = /* @__PURE__ */ $b(GO);
var sp = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", ma = new Uint8Array(256);
for (var fs = 0; fs < sp.length; fs++)
  ma[sp.charCodeAt(fs)] = fs;
var KO = function(e) {
  var t = e.length * 0.75, r = e.length, n, i = 0, a, o, s, l;
  e[e.length - 1] === "=" && (t--, e[e.length - 2] === "=" && t--);
  var u = new Uint8Array(t);
  for (n = 0; n < r; n += 4)
    a = ma[e.charCodeAt(n)], o = ma[e.charCodeAt(n + 1)], s = ma[e.charCodeAt(n + 2)], l = ma[e.charCodeAt(n + 3)], u[i++] = a << 2 | o >> 4, u[i++] = (o & 15) << 4 | s >> 2, u[i++] = (s & 3) << 6 | l & 63;
  return u;
}, XO = function(e) {
  for (var t = "", r = 0; r < e.length; r++)
    t += String.fromCharCode(e[r]);
  return t;
}, Jm = function(e) {
  return XO(Ml.inflate(KO(e)));
}, YO = function(e, t, r) {
  for (var n = "", i = 0, a = t - e.length; i < a; i++)
    n += r;
  return n + e;
};
const ZO = "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", JO = "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", QO = "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", $O = "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", eD = "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", tD = "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", rD = "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", nD = "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", iD = "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", aD = "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", oD = "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", sD = "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", lD = "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", uD = "eJxtmNtu20YQhl+F4FULyMGeD7pz3AY1ChtG7NpFA18w1NomIlECSRcxgrx7SVk7+wOdG8H5OJydf2Z2d5gf9cV+t0v9VK/r+6vXsXlOlbHe28paq229qj/t++m62aXZ4J/m8PRb1z9/baZxefK63Z6eXN5dVMvTCh83u277xr/6kLrnl2XNq7TpXnczuZyabdee98/b2VzM/x4/dd/T5qab2pd6PQ2vaVVfvDRD005puE3Lu7eH1HbN9hTjx4/77/X6y5lcnUmjVzHIVVDicVX/1W/SsO36dLMfu6nb9/X6TAoBD+5euvZbn8axXtuZ36dhPJrVQqgPQoh5hev91LWLkIv94W1Ygq9+aX+tZAx2tfz64284/sblN/rqfLP/mqrbt3FKu7G67Nv9cNgPzZQ2H6rz7bb6vLgZq89pTMO/M/xfEqturJpqSM/d7GJIm2oamk3aNcO3av80O5xh3yyKmm1193ZIT02bqovTKjP+MAf++7zsZvZ3276kYyWWXB0z99S18/PbafPHQ71W4fjn/fxnFO+ZvkrT0LVzTr78qB/+nk38bHM9exgP8zr1z9U7jt6840YW5uSJKcZOCaBBnKgm5mU8MVNYyMwWFvO7Ukagkmgg6sDWQ5yFFqjzUrLEaQ3BEmiwNsMSaZS0vgWfOkPHWQowNeTUc0kumnxZvsgPxlGai6VTGUqAVCTQ6QkWnc77DKEiLktSUBJKqHIQZ86d8gCpHYoiEzMsb1ubYy8vW50DChB5ZhGqrijD0EqUIeiaEHIfCg5Kpuu0ApiToaGPSY0uaQsyr65L2oKi1yFt1PLaQ3lzfXTgXodGoJYzglndSLDMPg1sTPJpQJHJigw0QrGERqD9YhyTOgONQDUyuF1zaxuokc/BW2ztXCMrGZ9WMW1oQZHIXWNBkSCfRZEL5BMUiZw6CzVSFCfUSGZFNjIldoKDkonTKQiJIGzWmFd3BizJJ9SINoLDriOfUCOZS+zg+KGD1qGiLNMLxtJD1/ns00ON6EzyUCM6vbxhoBKaqbG3DFQCNiL1iHccBPV0DHhQH/JW8EW90dkyFKGywCJU0WkVSvSGeiSUODWFFD0HYdPQVoiRgfPMA+/nnRgiAyNYSjpWNQcNSMrtFCUH4ZIRpSCWocFCSuhCEY6hoUClc0WC52BJlCYYLQdhN+hygRRRlo5BKRRLS6oihSqh+ZzzRGG1Mo4Iz1LoP0qsxDGFzk0JE42ji0jCPejomJKCuwil4m5CiRMEUMVSzVLDUstSx1Juc0oVWMpqY295qVltmtWmWW2a1aZZbZrVplltmtWmWW2G1WZYbYbVZlhthtVmWG2G1WZYbYbVZlhtltVmWW2W1WZZbZbVZlltltVmWW2W1QYjQCh7E2aAQHeGhCFgPoNoy8KNb2wxBhmGKBxoUZXlLGsLI6AsftEDHV0wIURVbANLcTKlGGBIKPOAxCmhePCKUwFzAmpDFRQvjA9R06Hq8TONvshgKDCuRAZTXigUxjxNFfKRo3CLhnIJBMFRvMZpqpNBMlQJzGT5WFQMVQI/AikPMIhEU1aDjqJvQwmjSHB05cC9jbYwc5UtAHNLhDw41ha+lEqF4JaH3gmB61SYcqInxTDmQK8v08vjqv4zDf1N0w3Lf4A8/vwPpfK11w==";
var cD = {
  Courier: $O,
  "Courier-Bold": ZO,
  "Courier-Oblique": QO,
  "Courier-BoldOblique": JO,
  Helvetica: nD,
  "Helvetica-Bold": eD,
  "Helvetica-Oblique": rD,
  "Helvetica-BoldOblique": tD,
  "Times-Roman": sD,
  "Times-Bold": iD,
  "Times-Italic": oD,
  "Times-BoldItalic": aD,
  Symbol: lD,
  ZapfDingbats: uD
}, no;
(function(e) {
  e.Courier = "Courier", e.CourierBold = "Courier-Bold", e.CourierOblique = "Courier-Oblique", e.CourierBoldOblique = "Courier-BoldOblique", e.Helvetica = "Helvetica", e.HelveticaBold = "Helvetica-Bold", e.HelveticaOblique = "Helvetica-Oblique", e.HelveticaBoldOblique = "Helvetica-BoldOblique", e.TimesRoman = "Times-Roman", e.TimesRomanBold = "Times-Bold", e.TimesRomanItalic = "Times-Italic", e.TimesRomanBoldItalic = "Times-BoldItalic", e.Symbol = "Symbol", e.ZapfDingbats = "ZapfDingbats";
})(no || (no = {}));
var lp = {}, fD = (
  /** @class */
  function() {
    function e() {
      var t = this;
      this.getWidthOfGlyph = function(r) {
        return t.CharWidths[r];
      }, this.getXAxisKerningForPair = function(r, n) {
        return (t.KernPairXAmounts[r] || {})[n];
      };
    }
    return e.load = function(t) {
      var r = lp[t];
      if (r)
        return r;
      var n = Jm(cD[t]), i = Object.assign(new e(), JSON.parse(n));
      return i.CharWidths = i.CharMetrics.reduce(function(a, o) {
        return a[o.N] = o.WX, a;
      }, {}), i.KernPairXAmounts = i.KernPairs.reduce(function(a, o) {
        var s = o[0], l = o[1], u = o[2];
        return a[s] || (a[s] = {}), a[s][l] = u, a;
      }, {}), lp[t] = i, i;
    }, e;
  }()
);
const hD = "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";
var dD = Jm(hD), rc = JSON.parse(dD), nc = (
  /** @class */
  /* @__PURE__ */ function() {
    function e(t, r) {
      var n = this;
      this.canEncodeUnicodeCodePoint = function(i) {
        return i in n.unicodeMappings;
      }, this.encodeUnicodeCodePoint = function(i) {
        var a = n.unicodeMappings[i];
        if (!a) {
          var o = String.fromCharCode(i), s = "0x" + YO(i.toString(16), 4, "0"), l = n.name + ' cannot encode "' + o + '" (' + s + ")";
          throw new Error(l);
        }
        return { code: a[0], name: a[1] };
      }, this.name = t, this.supportedCodePoints = Object.keys(r).map(Number).sort(function(i, a) {
        return i - a;
      }), this.unicodeMappings = r;
    }
    return e;
  }()
), hs = {
  Symbol: new nc("Symbol", rc.symbol),
  ZapfDingbats: new nc("ZapfDingbats", rc.zapfdingbats),
  WinAnsi: new nc("WinAnsi", rc.win1252)
}, jl = function(e) {
  return Object.keys(e).map(function(t) {
    return e[t];
  });
}, pD = jl(no), up = function(e) {
  return pD.includes(e);
}, ds = function(e, t) {
  return e.x === t.x && e.y === t.y && e.width === t.width && e.height === t.height;
}, Ye = function(e) {
  return "`" + e + "`";
}, vD = function(e) {
  return "'" + e + "'";
}, cp = function(e) {
  var t = typeof e;
  return t === "string" ? vD(e) : t === "undefined" ? Ye(e) : e;
}, gD = function(e, t, r) {
  for (var n = new Array(r.length), i = 0, a = r.length; i < a; i++) {
    var o = r[i];
    n[i] = cp(o);
  }
  var s = n.join(" or ");
  return Ye(t) + " must be one of " + s + ", but was actually " + cp(e);
}, nn = function(e, t, r) {
  Array.isArray(r) || (r = jl(r));
  for (var n = 0, i = r.length; n < i; n++)
    if (e === r[n])
      return;
  throw new TypeError(gD(e, t, r));
}, Vt = function(e, t, r) {
  Array.isArray(r) || (r = jl(r)), nn(e, t, r.concat(void 0));
}, mD = function(e, t, r) {
  Array.isArray(r) || (r = jl(r));
  for (var n = 0, i = e.length; n < i; n++)
    nn(e[n], t, r);
}, yD = function(e) {
  return e === null ? "null" : e === void 0 ? "undefined" : typeof e == "string" ? "string" : isNaN(e) ? "NaN" : typeof e == "number" ? "number" : typeof e == "boolean" ? "boolean" : typeof e == "symbol" ? "symbol" : typeof e == "bigint" ? "bigint" : e.constructor && e.constructor.name ? e.constructor.name : e.name ? e.name : e.constructor ? String(e.constructor) : String(e);
}, bD = function(e, t) {
  return t === "null" ? e === null : t === "undefined" ? e === void 0 : t === "string" ? typeof e == "string" : t === "number" ? typeof e == "number" && !isNaN(e) : t === "boolean" ? typeof e == "boolean" : t === "symbol" ? typeof e == "symbol" : t === "bigint" ? typeof e == "bigint" : t === Date ? e instanceof Date : t === Array ? e instanceof Array : t === Uint8Array ? e instanceof Uint8Array : t === ArrayBuffer ? e instanceof ArrayBuffer : t === Function ? e instanceof Function : e instanceof t[0];
}, wD = function(e, t, r) {
  for (var n = new Array(r.length), i = 0, a = r.length; i < a; i++) {
    var o = r[i];
    o === "null" && (n[i] = Ye("null")), o === "undefined" && (n[i] = Ye("undefined")), o === "string" ? n[i] = Ye("string") : o === "number" ? n[i] = Ye("number") : o === "boolean" ? n[i] = Ye("boolean") : o === "symbol" ? n[i] = Ye("symbol") : o === "bigint" ? n[i] = Ye("bigint") : o === Array ? n[i] = Ye("Array") : o === Uint8Array ? n[i] = Ye("Uint8Array") : o === ArrayBuffer ? n[i] = Ye("ArrayBuffer") : n[i] = Ye(o[1]);
  }
  var s = n.join(" or ");
  return Ye(t) + " must be of type " + s + ", but was actually of type " + Ye(yD(e));
}, D = function(e, t, r) {
  for (var n = 0, i = r.length; n < i; n++)
    if (bD(e, r[n]))
      return;
  throw new TypeError(wD(e, t, r));
}, G = function(e, t, r) {
  D(e, t, r.concat("undefined"));
}, Qm = function(e, t, r) {
  for (var n = 0, i = e.length; n < i; n++)
    D(e[n], t, r);
}, Lt = function(e, t, r, n) {
  if (D(e, t, ["number"]), D(r, "min", ["number"]), D(n, "max", ["number"]), n = Math.max(r, n), e < r || e > n)
    throw new Error(Ye(t) + " must be at least " + r + " and at most " + n + ", but was actually " + e);
}, ir = function(e, t, r, n) {
  D(e, t, ["number", "undefined"]), typeof e == "number" && Lt(e, t, r, n);
}, $m = function(e, t, r) {
  if (D(e, t, ["number"]), e % r !== 0)
    throw new Error(Ye(t) + " must be a multiple of " + r + ", but was actually " + e);
}, xD = function(e, t) {
  if (!Number.isInteger(e))
    throw new Error(Ye(t) + " must be an integer, but was actually " + e);
}, _l = function(e, t) {
  if (![1, 0].includes(Math.sign(e)))
    throw new Error(Ye(t) + " must be a positive number or 0, but was actually " + e);
}, ue = new Uint16Array(256);
for (var ps = 0; ps < 256; ps++)
  ue[ps] = ps;
ue[22] = se("");
ue[24] = se("˘");
ue[25] = se("ˇ");
ue[26] = se("ˆ");
ue[27] = se("˙");
ue[28] = se("˝");
ue[29] = se("˛");
ue[30] = se("˚");
ue[31] = se("˜");
ue[127] = se("�");
ue[128] = se("•");
ue[129] = se("†");
ue[130] = se("‡");
ue[131] = se("…");
ue[132] = se("—");
ue[133] = se("–");
ue[134] = se("ƒ");
ue[135] = se("⁄");
ue[136] = se("‹");
ue[137] = se("›");
ue[138] = se("−");
ue[139] = se("‰");
ue[140] = se("„");
ue[141] = se("“");
ue[142] = se("”");
ue[143] = se("‘");
ue[144] = se("’");
ue[145] = se("‚");
ue[146] = se("™");
ue[147] = se("ﬁ");
ue[148] = se("ﬂ");
ue[149] = se("Ł");
ue[150] = se("Œ");
ue[151] = se("Š");
ue[152] = se("Ÿ");
ue[153] = se("Ž");
ue[154] = se("ı");
ue[155] = se("ł");
ue[156] = se("œ");
ue[157] = se("š");
ue[158] = se("ž");
ue[159] = se("�");
ue[160] = se("€");
ue[173] = se("�");
var ey = function(e) {
  for (var t = new Array(e.length), r = 0, n = e.length; r < n; r++)
    t[r] = ue[e[r]];
  return String.fromCodePoint.apply(String, t);
}, Nr = (
  /** @class */
  function() {
    function e(t) {
      this.populate = t, this.value = void 0;
    }
    return e.prototype.getValue = function() {
      return this.value;
    }, e.prototype.access = function() {
      return this.value || (this.value = this.populate()), this.value;
    }, e.prototype.invalidate = function() {
      this.value = void 0;
    }, e.populatedBy = function(t) {
      return new e(t);
    }, e;
  }()
), Gt = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = this, a = "Method " + r + "." + n + "() not implemented";
      return i = e.call(this, a) || this, i;
    }
    return t;
  }(Error)
), Lf = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = "Cannot construct " + r + " - it has a private constructor";
      return n = e.call(this, i) || this, n;
    }
    return t;
  }(Error)
), Js = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = this, a = function(l) {
        var u, c;
        return (u = l == null ? void 0 : l.name) !== null && u !== void 0 ? u : (c = l == null ? void 0 : l.constructor) === null || c === void 0 ? void 0 : c.name;
      }, o = Array.isArray(r) ? r.map(a) : [a(r)], s = "Expected instance of " + o.join(" or ") + ", " + ("but got instance of " + (n && a(n)));
      return i = e.call(this, s) || this, i;
    }
    return t;
  }(Error)
), ED = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = r + " stream encoding not supported";
      return n = e.call(this, i) || this, n;
    }
    return t;
  }(Error)
), Bf = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = this, a = "Cannot call " + r + "." + n + "() more than once";
      return i = e.call(this, a) || this, i;
    }
    return t;
  }(Error)
);
(function(e) {
  K(t, e);
  function t(r) {
    var n = this, i = "Missing catalog (ref=" + r + ")";
    return n = e.call(this, i) || this, n;
  }
  return t;
})(Error);
var SD = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      var r = this, n = "Can't embed page with missing Contents";
      return r = e.call(this, n) || this, r;
    }
    return t;
  }(Error)
), FD = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n, i, a, o = this, s = (a = (i = (n = r == null ? void 0 : r.contructor) === null || n === void 0 ? void 0 : n.name) !== null && i !== void 0 ? i : r == null ? void 0 : r.name) !== null && a !== void 0 ? a : r, l = "Unrecognized stream type: " + s;
      return o = e.call(this, l) || this, o;
    }
    return t;
  }(Error)
), TD = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      var r = this, n = "Found mismatched contexts while embedding pages. All pages in the array passed to `PDFDocument.embedPages()` must be from the same document.";
      return r = e.call(this, n) || this, r;
    }
    return t;
  }(Error)
), CD = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = "Attempted to convert PDFArray with " + r + " elements to rectangle, but must have exactly 4 elements.";
      return n = e.call(this, i) || this, n;
    }
    return t;
  }(Error)
), ty = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = 'Attempted to convert "' + r + '" to a date, but it does not match the PDF date string format.';
      return n = e.call(this, i) || this, n;
    }
    return t;
  }(Error)
), fp = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = this, a = "Invalid targetIndex specified: targetIndex=" + r + " must be less than Count=" + n;
      return i = e.call(this, a) || this, i;
    }
    return t;
  }(Error)
), hp = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = this, a = "Failed to " + n + " at targetIndex=" + r + " due to corrupt page tree: It is likely that one or more 'Count' entries are invalid";
      return i = e.call(this, a) || this, i;
    }
    return t;
  }(Error)
), Qs = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      var a = this, o = "index should be at least " + n + " and at most " + i + ", but was actually " + r;
      return a = e.call(this, o) || this, a;
    }
    return t;
  }(Error)
), Mf = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      var r = this, n = "Attempted to set invalid field value";
      return r = e.call(this, n) || this, r;
    }
    return t;
  }(Error)
), AD = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      var r = this, n = "Attempted to select multiple values for single-select field";
      return r = e.call(this, n) || this, r;
    }
    return t;
  }(Error)
), PD = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = "No /DA (default appearance) entry found for field: " + r;
      return n = e.call(this, i) || this, n;
    }
    return t;
  }(Error)
), RD = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = "No Tf operator found for DA of field: " + r;
      return n = e.call(this, i) || this, n;
    }
    return t;
  }(Error)
), dp = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = this, a = "Failed to parse number " + ("(line:" + r.line + " col:" + r.column + " offset=" + r.offset + '): "' + n + '"');
      return i = e.call(this, a) || this, i;
    }
    return t;
  }(Error)
), xn = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = this, a = "Failed to parse PDF document " + ("(line:" + r.line + " col:" + r.column + " offset=" + r.offset + "): " + n);
      return i = e.call(this, a) || this, i;
    }
    return t;
  }(Error)
), OD = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      var a = this, o = "Expected next byte to be " + n + " but it was actually " + i;
      return a = e.call(this, r, o) || this, a;
    }
    return t;
  }(xn)
), DD = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = this, a = "Failed to parse PDF object starting with the following byte: " + n;
      return i = e.call(this, r, a) || this, i;
    }
    return t;
  }(xn)
), kD = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = "Failed to parse invalid PDF object";
      return n = e.call(this, r, i) || this, n;
    }
    return t;
  }(xn)
), ND = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = "Failed to parse PDF stream";
      return n = e.call(this, r, i) || this, n;
    }
    return t;
  }(xn)
), ID = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = "Failed to parse PDF literal string due to unbalanced parenthesis";
      return n = e.call(this, r, i) || this, n;
    }
    return t;
  }(xn)
), UD = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = "Parser stalled";
      return n = e.call(this, r, i) || this, n;
    }
    return t;
  }(xn)
), LD = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = "No PDF header found";
      return n = e.call(this, r, i) || this, n;
    }
    return t;
  }(xn)
), BD = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = this, a = "Did not find expected keyword '" + nm(n) + "'";
      return i = e.call(this, r, a) || this, i;
    }
    return t;
  }(xn)
), Ic;
(function(e) {
  e[e.Null = 0] = "Null", e[e.Backspace = 8] = "Backspace", e[e.Tab = 9] = "Tab", e[e.Newline = 10] = "Newline", e[e.FormFeed = 12] = "FormFeed", e[e.CarriageReturn = 13] = "CarriageReturn", e[e.Space = 32] = "Space", e[e.ExclamationPoint = 33] = "ExclamationPoint", e[e.Hash = 35] = "Hash", e[e.Percent = 37] = "Percent", e[e.LeftParen = 40] = "LeftParen", e[e.RightParen = 41] = "RightParen", e[e.Plus = 43] = "Plus", e[e.Minus = 45] = "Minus", e[e.Dash = 45] = "Dash", e[e.Period = 46] = "Period", e[e.ForwardSlash = 47] = "ForwardSlash", e[e.Zero = 48] = "Zero", e[e.One = 49] = "One", e[e.Two = 50] = "Two", e[e.Three = 51] = "Three", e[e.Four = 52] = "Four", e[e.Five = 53] = "Five", e[e.Six = 54] = "Six", e[e.Seven = 55] = "Seven", e[e.Eight = 56] = "Eight", e[e.Nine = 57] = "Nine", e[e.LessThan = 60] = "LessThan", e[e.GreaterThan = 62] = "GreaterThan", e[e.A = 65] = "A", e[e.D = 68] = "D", e[e.E = 69] = "E", e[e.F = 70] = "F", e[e.O = 79] = "O", e[e.P = 80] = "P", e[e.R = 82] = "R", e[e.LeftSquareBracket = 91] = "LeftSquareBracket", e[e.BackSlash = 92] = "BackSlash", e[e.RightSquareBracket = 93] = "RightSquareBracket", e[e.a = 97] = "a", e[e.b = 98] = "b", e[e.d = 100] = "d", e[e.e = 101] = "e", e[e.f = 102] = "f", e[e.i = 105] = "i", e[e.j = 106] = "j", e[e.l = 108] = "l", e[e.m = 109] = "m", e[e.n = 110] = "n", e[e.o = 111] = "o", e[e.r = 114] = "r", e[e.s = 115] = "s", e[e.t = 116] = "t", e[e.u = 117] = "u", e[e.x = 120] = "x", e[e.LeftCurly = 123] = "LeftCurly", e[e.RightCurly = 125] = "RightCurly", e[e.Tilde = 126] = "Tilde";
})(Ic || (Ic = {}));
const E = Ic;
var zl = (
  /** @class */
  function() {
    function e(t, r) {
      this.major = String(t), this.minor = String(r);
    }
    return e.prototype.toString = function() {
      var t = kr(129);
      return "%PDF-" + this.major + "." + this.minor + `
%` + t + t + t + t;
    }, e.prototype.sizeInBytes = function() {
      return 12 + this.major.length + this.minor.length;
    }, e.prototype.copyBytesInto = function(t, r) {
      var n = r;
      return t[r++] = E.Percent, t[r++] = E.P, t[r++] = E.D, t[r++] = E.F, t[r++] = E.Dash, r += lt(this.major, t, r), t[r++] = E.Period, r += lt(this.minor, t, r), t[r++] = E.Newline, t[r++] = E.Percent, t[r++] = 129, t[r++] = 129, t[r++] = 129, t[r++] = 129, r - n;
    }, e.forVersion = function(t, r) {
      return new e(t, r);
    }, e;
  }()
), St = (
  /** @class */
  function() {
    function e() {
    }
    return e.prototype.clone = function(t) {
      throw new Gt(this.constructor.name, "clone");
    }, e.prototype.toString = function() {
      throw new Gt(this.constructor.name, "toString");
    }, e.prototype.sizeInBytes = function() {
      throw new Gt(this.constructor.name, "sizeInBytes");
    }, e.prototype.copyBytesInto = function(t, r) {
      throw new Gt(this.constructor.name, "copyBytesInto");
    }, e;
  }()
), ae = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = e.call(this) || this;
      return n.numberValue = r, n.stringValue = e2(r), n;
    }
    return t.prototype.asNumber = function() {
      return this.numberValue;
    }, t.prototype.value = function() {
      return this.numberValue;
    }, t.prototype.clone = function() {
      return t.of(this.numberValue);
    }, t.prototype.toString = function() {
      return this.stringValue;
    }, t.prototype.sizeInBytes = function() {
      return this.stringValue.length;
    }, t.prototype.copyBytesInto = function(r, n) {
      return n += lt(this.stringValue, r, n), this.stringValue.length;
    }, t.of = function(r) {
      return new t(r);
    }, t;
  }(St)
), Ee = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = e.call(this) || this;
      return n.array = [], n.context = r, n;
    }
    return t.prototype.size = function() {
      return this.array.length;
    }, t.prototype.push = function(r) {
      this.array.push(r);
    }, t.prototype.insert = function(r, n) {
      this.array.splice(r, 0, n);
    }, t.prototype.indexOf = function(r) {
      var n = this.array.indexOf(r);
      return n === -1 ? void 0 : n;
    }, t.prototype.remove = function(r) {
      this.array.splice(r, 1);
    }, t.prototype.set = function(r, n) {
      this.array[r] = n;
    }, t.prototype.get = function(r) {
      return this.array[r];
    }, t.prototype.lookupMaybe = function(r) {
      for (var n, i = [], a = 1; a < arguments.length; a++)
        i[a - 1] = arguments[a];
      return (n = this.context).lookupMaybe.apply(n, be([this.get(r)], i));
    }, t.prototype.lookup = function(r) {
      for (var n, i = [], a = 1; a < arguments.length; a++)
        i[a - 1] = arguments[a];
      return (n = this.context).lookup.apply(n, be([this.get(r)], i));
    }, t.prototype.asRectangle = function() {
      if (this.size() !== 4)
        throw new CD(this.size());
      var r = this.lookup(0, ae).asNumber(), n = this.lookup(1, ae).asNumber(), i = this.lookup(2, ae).asNumber(), a = this.lookup(3, ae).asNumber(), o = r, s = n, l = i - r, u = a - n;
      return { x: o, y: s, width: l, height: u };
    }, t.prototype.asArray = function() {
      return this.array.slice();
    }, t.prototype.clone = function(r) {
      for (var n = t.withContext(r || this.context), i = 0, a = this.size(); i < a; i++)
        n.push(this.array[i]);
      return n;
    }, t.prototype.toString = function() {
      for (var r = "[ ", n = 0, i = this.size(); n < i; n++)
        r += this.get(n).toString(), r += " ";
      return r += "]", r;
    }, t.prototype.sizeInBytes = function() {
      for (var r = 3, n = 0, i = this.size(); n < i; n++)
        r += this.get(n).sizeInBytes() + 1;
      return r;
    }, t.prototype.copyBytesInto = function(r, n) {
      var i = n;
      r[n++] = E.LeftSquareBracket, r[n++] = E.Space;
      for (var a = 0, o = this.size(); a < o; a++)
        n += this.get(a).copyBytesInto(r, n), r[n++] = E.Space;
      return r[n++] = E.RightSquareBracket, n - i;
    }, t.prototype.scalePDFNumbers = function(r, n) {
      for (var i = 0, a = this.size(); i < a; i++) {
        var o = this.lookup(i);
        if (o instanceof ae) {
          var s = i % 2 === 0 ? r : n;
          this.set(i, ae.of(o.asNumber() * s));
        }
      }
    }, t.withContext = function(r) {
      return new t(r);
    }, t;
  }(St)
), ic = {}, io = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = this;
      if (r !== ic)
        throw new Lf("PDFBool");
      return i = e.call(this) || this, i.value = n, i;
    }
    return t.prototype.asBoolean = function() {
      return this.value;
    }, t.prototype.clone = function() {
      return this;
    }, t.prototype.toString = function() {
      return String(this.value);
    }, t.prototype.sizeInBytes = function() {
      return this.value ? 4 : 5;
    }, t.prototype.copyBytesInto = function(r, n) {
      return this.value ? (r[n++] = E.t, r[n++] = E.r, r[n++] = E.u, r[n++] = E.e, 4) : (r[n++] = E.f, r[n++] = E.a, r[n++] = E.l, r[n++] = E.s, r[n++] = E.e, 5);
    }, t.True = new t(ic, !0), t.False = new t(ic, !1), t;
  }(St)
), $t = new Uint8Array(256);
$t[E.LeftParen] = 1;
$t[E.RightParen] = 1;
$t[E.LessThan] = 1;
$t[E.GreaterThan] = 1;
$t[E.LeftSquareBracket] = 1;
$t[E.RightSquareBracket] = 1;
$t[E.LeftCurly] = 1;
$t[E.RightCurly] = 1;
$t[E.ForwardSlash] = 1;
$t[E.Percent] = 1;
var Br = new Uint8Array(256);
Br[E.Null] = 1;
Br[E.Tab] = 1;
Br[E.Newline] = 1;
Br[E.FormFeed] = 1;
Br[E.CarriageReturn] = 1;
Br[E.Space] = 1;
var jf = new Uint8Array(256);
for (var la = 0, MD = 256; la < MD; la++)
  jf[la] = Br[la] || $t[la] ? 1 : 0;
jf[E.Hash] = 1;
var jD = function(e) {
  return e.replace(/#([\dABCDEF]{2})/g, function(t, r) {
    return IR(r);
  });
}, _D = function(e) {
  return e >= E.ExclamationPoint && e <= E.Tilde && !jf[e];
}, pp = {}, vp = /* @__PURE__ */ new Map(), x = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = this;
      if (r !== pp)
        throw new Lf("PDFName");
      i = e.call(this) || this;
      for (var a = "/", o = 0, s = n.length; o < s; o++) {
        var l = n[o], u = se(l);
        a += _D(u) ? l : "#" + Il(u);
      }
      return i.encodedName = a, i;
    }
    return t.prototype.asBytes = function() {
      for (var r = [], n = "", i = !1, a = function(f) {
        f !== void 0 && r.push(f), i = !1;
      }, o = 1, s = this.encodedName.length; o < s; o++) {
        var l = this.encodedName[o], u = se(l), c = this.encodedName[o + 1];
        i ? u >= E.Zero && u <= E.Nine || u >= E.a && u <= E.f || u >= E.A && u <= E.F ? (n += l, (n.length === 2 || !(c >= "0" && c <= "9" || c >= "a" && c <= "f" || c >= "A" && c <= "F")) && (a(parseInt(n, 16)), n = "")) : a(u) : u === E.Hash ? i = !0 : a(u);
      }
      return new Uint8Array(r);
    }, t.prototype.decodeText = function() {
      var r = this.asBytes();
      return String.fromCharCode.apply(String, Array.from(r));
    }, t.prototype.asString = function() {
      return this.encodedName;
    }, t.prototype.value = function() {
      return this.encodedName;
    }, t.prototype.clone = function() {
      return this;
    }, t.prototype.toString = function() {
      return this.encodedName;
    }, t.prototype.sizeInBytes = function() {
      return this.encodedName.length;
    }, t.prototype.copyBytesInto = function(r, n) {
      return n += lt(this.encodedName, r, n), this.encodedName.length;
    }, t.of = function(r) {
      var n = jD(r), i = vp.get(n);
      return i || (i = new t(pp, n), vp.set(n, i)), i;
    }, t.Length = t.of("Length"), t.FlateDecode = t.of("FlateDecode"), t.Resources = t.of("Resources"), t.Font = t.of("Font"), t.XObject = t.of("XObject"), t.ExtGState = t.of("ExtGState"), t.Contents = t.of("Contents"), t.Type = t.of("Type"), t.Parent = t.of("Parent"), t.MediaBox = t.of("MediaBox"), t.Page = t.of("Page"), t.Annots = t.of("Annots"), t.TrimBox = t.of("TrimBox"), t.ArtBox = t.of("ArtBox"), t.BleedBox = t.of("BleedBox"), t.CropBox = t.of("CropBox"), t.Rotate = t.of("Rotate"), t.Title = t.of("Title"), t.Author = t.of("Author"), t.Subject = t.of("Subject"), t.Creator = t.of("Creator"), t.Keywords = t.of("Keywords"), t.Producer = t.of("Producer"), t.CreationDate = t.of("CreationDate"), t.ModDate = t.of("ModDate"), t;
  }(St)
), zD = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.prototype.asNull = function() {
      return null;
    }, t.prototype.clone = function() {
      return this;
    }, t.prototype.toString = function() {
      return "null";
    }, t.prototype.sizeInBytes = function() {
      return 4;
    }, t.prototype.copyBytesInto = function(r, n) {
      return r[n++] = E.n, r[n++] = E.u, r[n++] = E.l, r[n++] = E.l, 4;
    }, t;
  }(St)
);
const Ot = new zD();
var ce = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = e.call(this) || this;
      return i.dict = r, i.context = n, i;
    }
    return t.prototype.keys = function() {
      return Array.from(this.dict.keys());
    }, t.prototype.values = function() {
      return Array.from(this.dict.values());
    }, t.prototype.entries = function() {
      return Array.from(this.dict.entries());
    }, t.prototype.set = function(r, n) {
      this.dict.set(r, n);
    }, t.prototype.get = function(r, n) {
      n === void 0 && (n = !1);
      var i = this.dict.get(r);
      if (!(i === Ot && !n))
        return i;
    }, t.prototype.has = function(r) {
      var n = this.dict.get(r);
      return n !== void 0 && n !== Ot;
    }, t.prototype.lookupMaybe = function(r) {
      for (var n, i = [], a = 1; a < arguments.length; a++)
        i[a - 1] = arguments[a];
      var o = i.includes(Ot), s = (n = this.context).lookupMaybe.apply(n, be([this.get(r, o)], i));
      if (!(s === Ot && !o))
        return s;
    }, t.prototype.lookup = function(r) {
      for (var n, i = [], a = 1; a < arguments.length; a++)
        i[a - 1] = arguments[a];
      var o = i.includes(Ot), s = (n = this.context).lookup.apply(n, be([this.get(r, o)], i));
      if (!(s === Ot && !o))
        return s;
    }, t.prototype.delete = function(r) {
      return this.dict.delete(r);
    }, t.prototype.asMap = function() {
      return new Map(this.dict);
    }, t.prototype.uniqueKey = function(r) {
      r === void 0 && (r = "");
      for (var n = this.keys(), i = x.of(this.context.addRandomSuffix(r, 10)); n.includes(i); )
        i = x.of(this.context.addRandomSuffix(r, 10));
      return i;
    }, t.prototype.clone = function(r) {
      for (var n = t.withContext(r || this.context), i = this.entries(), a = 0, o = i.length; a < o; a++) {
        var s = i[a], l = s[0], u = s[1];
        n.set(l, u);
      }
      return n;
    }, t.prototype.toString = function() {
      for (var r = `<<
`, n = this.entries(), i = 0, a = n.length; i < a; i++) {
        var o = n[i], s = o[0], l = o[1];
        r += s.toString() + " " + l.toString() + `
`;
      }
      return r += ">>", r;
    }, t.prototype.sizeInBytes = function() {
      for (var r = 5, n = this.entries(), i = 0, a = n.length; i < a; i++) {
        var o = n[i], s = o[0], l = o[1];
        r += s.sizeInBytes() + l.sizeInBytes() + 2;
      }
      return r;
    }, t.prototype.copyBytesInto = function(r, n) {
      var i = n;
      r[n++] = E.LessThan, r[n++] = E.LessThan, r[n++] = E.Newline;
      for (var a = this.entries(), o = 0, s = a.length; o < s; o++) {
        var l = a[o], u = l[0], c = l[1];
        n += u.copyBytesInto(r, n), r[n++] = E.Space, n += c.copyBytesInto(r, n), r[n++] = E.Newline;
      }
      return r[n++] = E.GreaterThan, r[n++] = E.GreaterThan, n - i;
    }, t.withContext = function(r) {
      return new t(/* @__PURE__ */ new Map(), r);
    }, t.fromMapWithContext = function(r, n) {
      return new t(r, n);
    }, t;
  }(St)
), Mt = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = e.call(this) || this;
      return n.dict = r, n;
    }
    return t.prototype.clone = function(r) {
      throw new Gt(this.constructor.name, "clone");
    }, t.prototype.getContentsString = function() {
      throw new Gt(this.constructor.name, "getContentsString");
    }, t.prototype.getContents = function() {
      throw new Gt(this.constructor.name, "getContents");
    }, t.prototype.getContentsSize = function() {
      throw new Gt(this.constructor.name, "getContentsSize");
    }, t.prototype.updateDict = function() {
      var r = this.getContentsSize();
      this.dict.set(x.Length, ae.of(r));
    }, t.prototype.sizeInBytes = function() {
      return this.updateDict(), this.dict.sizeInBytes() + this.getContentsSize() + 18;
    }, t.prototype.toString = function() {
      this.updateDict();
      var r = this.dict.toString();
      return r += `
stream
`, r += this.getContentsString(), r += `
endstream`, r;
    }, t.prototype.copyBytesInto = function(r, n) {
      this.updateDict();
      var i = n;
      n += this.dict.copyBytesInto(r, n), r[n++] = E.Newline, r[n++] = E.s, r[n++] = E.t, r[n++] = E.r, r[n++] = E.e, r[n++] = E.a, r[n++] = E.m, r[n++] = E.Newline;
      for (var a = this.getContents(), o = 0, s = a.length; o < s; o++)
        r[n++] = a[o];
      return r[n++] = E.Newline, r[n++] = E.e, r[n++] = E.n, r[n++] = E.d, r[n++] = E.s, r[n++] = E.t, r[n++] = E.r, r[n++] = E.e, r[n++] = E.a, r[n++] = E.m, n - i;
    }, t;
  }(St)
), ao = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = e.call(this, r) || this;
      return i.contents = n, i;
    }
    return t.prototype.asUint8Array = function() {
      return this.contents.slice();
    }, t.prototype.clone = function(r) {
      return t.of(this.dict.clone(r), this.contents.slice());
    }, t.prototype.getContentsString = function() {
      return nm(this.contents);
    }, t.prototype.getContents = function() {
      return this.contents;
    }, t.prototype.getContentsSize = function() {
      return this.contents.length;
    }, t.of = function(r, n) {
      return new t(r, n);
    }, t;
  }(Mt)
), gp = {}, mp = /* @__PURE__ */ new Map(), Re = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      var a = this;
      if (r !== gp)
        throw new Lf("PDFRef");
      return a = e.call(this) || this, a.objectNumber = n, a.generationNumber = i, a.tag = n + " " + i + " R", a;
    }
    return t.prototype.clone = function() {
      return this;
    }, t.prototype.toString = function() {
      return this.tag;
    }, t.prototype.sizeInBytes = function() {
      return this.tag.length;
    }, t.prototype.copyBytesInto = function(r, n) {
      return n += lt(this.tag, r, n), this.tag.length;
    }, t.of = function(r, n) {
      n === void 0 && (n = 0);
      var i = r + " " + n + " R", a = mp.get(i);
      return a || (a = new t(gp, r, n), mp.set(i, a)), a;
    }, t;
  }(St)
), me = (
  /** @class */
  function() {
    function e(t, r) {
      this.name = t, this.args = r || [];
    }
    return e.prototype.clone = function(t) {
      for (var r = new Array(this.args.length), n = 0, i = r.length; n < i; n++) {
        var a = this.args[n];
        r[n] = a instanceof St ? a.clone(t) : a;
      }
      return e.of(this.name, r);
    }, e.prototype.toString = function() {
      for (var t = "", r = 0, n = this.args.length; r < n; r++)
        t += String(this.args[r]) + " ";
      return t += this.name, t;
    }, e.prototype.sizeInBytes = function() {
      for (var t = 0, r = 0, n = this.args.length; r < n; r++) {
        var i = this.args[r];
        t += (i instanceof St ? i.sizeInBytes() : i.length) + 1;
      }
      return t += this.name.length, t;
    }, e.prototype.copyBytesInto = function(t, r) {
      for (var n = r, i = 0, a = this.args.length; i < a; i++) {
        var o = this.args[i];
        o instanceof St ? r += o.copyBytesInto(t, r) : r += lt(o, t, r), t[r++] = E.Space;
      }
      return r += lt(this.name, t, r), r - n;
    }, e.of = function(t, r) {
      return new e(t, r);
    }, e;
  }()
), Uc;
(function(e) {
  e.NonStrokingColor = "sc", e.NonStrokingColorN = "scn", e.NonStrokingColorRgb = "rg", e.NonStrokingColorGray = "g", e.NonStrokingColorCmyk = "k", e.NonStrokingColorspace = "cs", e.StrokingColor = "SC", e.StrokingColorN = "SCN", e.StrokingColorRgb = "RG", e.StrokingColorGray = "G", e.StrokingColorCmyk = "K", e.StrokingColorspace = "CS", e.BeginMarkedContentSequence = "BDC", e.BeginMarkedContent = "BMC", e.EndMarkedContent = "EMC", e.MarkedContentPointWithProps = "DP", e.MarkedContentPoint = "MP", e.DrawObject = "Do", e.ConcatTransformationMatrix = "cm", e.PopGraphicsState = "Q", e.PushGraphicsState = "q", e.SetFlatness = "i", e.SetGraphicsStateParams = "gs", e.SetLineCapStyle = "J", e.SetLineDashPattern = "d", e.SetLineJoinStyle = "j", e.SetLineMiterLimit = "M", e.SetLineWidth = "w", e.SetTextMatrix = "Tm", e.SetRenderingIntent = "ri", e.AppendRectangle = "re", e.BeginInlineImage = "BI", e.BeginInlineImageData = "ID", e.EndInlineImage = "EI", e.ClipEvenOdd = "W*", e.ClipNonZero = "W", e.CloseAndStroke = "s", e.CloseFillEvenOddAndStroke = "b*", e.CloseFillNonZeroAndStroke = "b", e.ClosePath = "h", e.AppendBezierCurve = "c", e.CurveToReplicateFinalPoint = "y", e.CurveToReplicateInitialPoint = "v", e.EndPath = "n", e.FillEvenOddAndStroke = "B*", e.FillEvenOdd = "f*", e.FillNonZeroAndStroke = "B", e.FillNonZero = "f", e.LegacyFillNonZero = "F", e.LineTo = "l", e.MoveTo = "m", e.ShadingFill = "sh", e.StrokePath = "S", e.BeginText = "BT", e.EndText = "ET", e.MoveText = "Td", e.MoveTextSetLeading = "TD", e.NextLine = "T*", e.SetCharacterSpacing = "Tc", e.SetFontAndSize = "Tf", e.SetTextHorizontalScaling = "Tz", e.SetTextLineHeight = "TL", e.SetTextRenderingMode = "Tr", e.SetTextRise = "Ts", e.SetWordSpacing = "Tw", e.ShowText = "Tj", e.ShowTextAdjusted = "TJ", e.ShowTextLine = "'", e.ShowTextLineAndSpace = '"', e.Type3D0 = "d0", e.Type3D1 = "d1", e.BeginCompatibilitySection = "BX", e.EndCompatibilitySection = "EX";
})(Uc || (Uc = {}));
const we = Uc;
var _f = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = e.call(this, r) || this;
      return i.computeContents = function() {
        var a = i.getUnencodedContents();
        return i.encode ? Ml.deflate(a) : a;
      }, i.encode = n, n && r.set(x.of("Filter"), x.of("FlateDecode")), i.contentsCache = Nr.populatedBy(i.computeContents), i;
    }
    return t.prototype.getContents = function() {
      return this.contentsCache.access();
    }, t.prototype.getContentsSize = function() {
      return this.contentsCache.access().length;
    }, t.prototype.getUnencodedContents = function() {
      throw new Gt(this.constructor.name, "getUnencodedContents");
    }, t;
  }(Mt)
), Da = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      i === void 0 && (i = !0);
      var a = e.call(this, r, i) || this;
      return a.operators = n, a;
    }
    return t.prototype.push = function() {
      for (var r, n = [], i = 0; i < arguments.length; i++)
        n[i] = arguments[i];
      (r = this.operators).push.apply(r, n);
    }, t.prototype.clone = function(r) {
      for (var n = new Array(this.operators.length), i = 0, a = this.operators.length; i < a; i++)
        n[i] = this.operators[i].clone(r);
      var o = this, s = o.dict, l = o.encode;
      return t.of(s.clone(r), n, l);
    }, t.prototype.getContentsString = function() {
      for (var r = "", n = 0, i = this.operators.length; n < i; n++)
        r += this.operators[n] + `
`;
      return r;
    }, t.prototype.getUnencodedContents = function() {
      for (var r = new Uint8Array(this.getUnencodedContentsSize()), n = 0, i = 0, a = this.operators.length; i < a; i++)
        n += this.operators[i].copyBytesInto(r, n), r[n++] = E.Newline;
      return r;
    }, t.prototype.getUnencodedContentsSize = function() {
      for (var r = 0, n = 0, i = this.operators.length; n < i; n++)
        r += this.operators[n].sizeInBytes() + 1;
      return r;
    }, t.of = function(r, n, i) {
      return i === void 0 && (i = !0), new t(r, n, i);
    }, t;
  }(_f)
), qD = (
  /** @class */
  function() {
    function e(t) {
      this.seed = t;
    }
    return e.prototype.nextInt = function() {
      var t = Math.sin(this.seed++) * 1e4;
      return t - Math.floor(t);
    }, e.withSeed = function(t) {
      return new e(t);
    }, e;
  }()
), VD = function(e, t) {
  var r = e[0], n = t[0];
  return r.objectNumber - n.objectNumber;
}, Lc = (
  /** @class */
  function() {
    function e() {
      this.largestObjectNumber = 0, this.header = zl.forVersion(1, 7), this.trailerInfo = {}, this.indirectObjects = /* @__PURE__ */ new Map(), this.rng = qD.withSeed(1);
    }
    return e.prototype.assign = function(t, r) {
      this.indirectObjects.set(t, r), t.objectNumber > this.largestObjectNumber && (this.largestObjectNumber = t.objectNumber);
    }, e.prototype.nextRef = function() {
      return this.largestObjectNumber += 1, Re.of(this.largestObjectNumber);
    }, e.prototype.register = function(t) {
      var r = this.nextRef();
      return this.assign(r, t), r;
    }, e.prototype.delete = function(t) {
      return this.indirectObjects.delete(t);
    }, e.prototype.lookupMaybe = function(t) {
      for (var r = [], n = 1; n < arguments.length; n++)
        r[n - 1] = arguments[n];
      var i = r.includes(Ot), a = t instanceof Re ? this.indirectObjects.get(t) : t;
      if (!(!a || a === Ot && !i)) {
        for (var o = 0, s = r.length; o < s; o++) {
          var l = r[o];
          if (l === Ot) {
            if (a === Ot)
              return a;
          } else if (a instanceof l)
            return a;
        }
        throw new Js(r, a);
      }
    }, e.prototype.lookup = function(t) {
      for (var r = [], n = 1; n < arguments.length; n++)
        r[n - 1] = arguments[n];
      var i = t instanceof Re ? this.indirectObjects.get(t) : t;
      if (r.length === 0)
        return i;
      for (var a = 0, o = r.length; a < o; a++) {
        var s = r[a];
        if (s === Ot) {
          if (i === Ot)
            return i;
        } else if (i instanceof s)
          return i;
      }
      throw new Js(r, i);
    }, e.prototype.getObjectRef = function(t) {
      for (var r = Array.from(this.indirectObjects.entries()), n = 0, i = r.length; n < i; n++) {
        var a = r[n], o = a[0], s = a[1];
        if (s === t)
          return o;
      }
    }, e.prototype.enumerateIndirectObjects = function() {
      return Array.from(this.indirectObjects.entries()).sort(VD);
    }, e.prototype.obj = function(t) {
      if (t instanceof St)
        return t;
      if (t == null)
        return Ot;
      if (typeof t == "string")
        return x.of(t);
      if (typeof t == "number")
        return ae.of(t);
      if (typeof t == "boolean")
        return t ? io.True : io.False;
      if (Array.isArray(t)) {
        for (var r = Ee.withContext(this), n = 0, i = t.length; n < i; n++)
          r.push(this.obj(t[n]));
        return r;
      } else {
        for (var a = ce.withContext(this), o = Object.keys(t), n = 0, i = o.length; n < i; n++) {
          var s = o[n], l = t[s];
          l !== void 0 && a.set(x.of(s), this.obj(l));
        }
        return a;
      }
    }, e.prototype.stream = function(t, r) {
      return r === void 0 && (r = {}), ao.of(this.obj(r), Tc(t));
    }, e.prototype.flateStream = function(t, r) {
      return r === void 0 && (r = {}), this.stream(Ml.deflate(Tc(t)), le(le({}, r), { Filter: "FlateDecode" }));
    }, e.prototype.contentStream = function(t, r) {
      return r === void 0 && (r = {}), Da.of(this.obj(r), t);
    }, e.prototype.formXObject = function(t, r) {
      return r === void 0 && (r = {}), this.contentStream(t, le(le({ BBox: this.obj([0, 0, 0, 0]), Matrix: this.obj([1, 0, 0, 1, 0, 0]) }, r), { Type: "XObject", Subtype: "Form" }));
    }, e.prototype.getPushGraphicsStateContentStream = function() {
      if (this.pushGraphicsStateContentStreamRef)
        return this.pushGraphicsStateContentStreamRef;
      var t = this.obj({}), r = me.of(we.PushGraphicsState), n = Da.of(t, [r]);
      return this.pushGraphicsStateContentStreamRef = this.register(n), this.pushGraphicsStateContentStreamRef;
    }, e.prototype.getPopGraphicsStateContentStream = function() {
      if (this.popGraphicsStateContentStreamRef)
        return this.popGraphicsStateContentStreamRef;
      var t = this.obj({}), r = me.of(we.PopGraphicsState), n = Da.of(t, [r]);
      return this.popGraphicsStateContentStreamRef = this.register(n), this.popGraphicsStateContentStreamRef;
    }, e.prototype.addRandomSuffix = function(t, r) {
      return r === void 0 && (r = 4), t + "-" + Math.floor(this.rng.nextInt() * Math.pow(10, r));
    }, e.create = function() {
      return new e();
    }, e;
  }()
), Ir = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      i === void 0 && (i = !0);
      var a = e.call(this, r, n) || this;
      return a.normalized = !1, a.autoNormalizeCTM = i, a;
    }
    return t.prototype.clone = function(r) {
      for (var n = t.fromMapWithContext(/* @__PURE__ */ new Map(), r || this.context, this.autoNormalizeCTM), i = this.entries(), a = 0, o = i.length; a < o; a++) {
        var s = i[a], l = s[0], u = s[1];
        n.set(l, u);
      }
      return n;
    }, t.prototype.Parent = function() {
      return this.lookupMaybe(x.Parent, ce);
    }, t.prototype.Contents = function() {
      return this.lookup(x.of("Contents"));
    }, t.prototype.Annots = function() {
      return this.lookupMaybe(x.Annots, Ee);
    }, t.prototype.BleedBox = function() {
      return this.lookupMaybe(x.BleedBox, Ee);
    }, t.prototype.TrimBox = function() {
      return this.lookupMaybe(x.TrimBox, Ee);
    }, t.prototype.ArtBox = function() {
      return this.lookupMaybe(x.ArtBox, Ee);
    }, t.prototype.Resources = function() {
      var r = this.getInheritableAttribute(x.Resources);
      return this.context.lookupMaybe(r, ce);
    }, t.prototype.MediaBox = function() {
      var r = this.getInheritableAttribute(x.MediaBox);
      return this.context.lookup(r, Ee);
    }, t.prototype.CropBox = function() {
      var r = this.getInheritableAttribute(x.CropBox);
      return this.context.lookupMaybe(r, Ee);
    }, t.prototype.Rotate = function() {
      var r = this.getInheritableAttribute(x.Rotate);
      return this.context.lookupMaybe(r, ae);
    }, t.prototype.getInheritableAttribute = function(r) {
      var n;
      return this.ascend(function(i) {
        n || (n = i.get(r));
      }), n;
    }, t.prototype.setParent = function(r) {
      this.set(x.Parent, r);
    }, t.prototype.addContentStream = function(r) {
      var n = this.normalizedEntries().Contents || this.context.obj([]);
      this.set(x.Contents, n), n.push(r);
    }, t.prototype.wrapContentStreams = function(r, n) {
      var i = this.Contents();
      return i instanceof Ee ? (i.insert(0, r), i.push(n), !0) : !1;
    }, t.prototype.addAnnot = function(r) {
      var n = this.normalizedEntries().Annots;
      n.push(r);
    }, t.prototype.removeAnnot = function(r) {
      var n = this.normalizedEntries().Annots, i = n.indexOf(r);
      i !== void 0 && n.remove(i);
    }, t.prototype.setFontDictionary = function(r, n) {
      var i = this.normalizedEntries().Font;
      i.set(r, n);
    }, t.prototype.newFontDictionaryKey = function(r) {
      var n = this.normalizedEntries().Font;
      return n.uniqueKey(r);
    }, t.prototype.newFontDictionary = function(r, n) {
      var i = this.newFontDictionaryKey(r);
      return this.setFontDictionary(i, n), i;
    }, t.prototype.setXObject = function(r, n) {
      var i = this.normalizedEntries().XObject;
      i.set(r, n);
    }, t.prototype.newXObjectKey = function(r) {
      var n = this.normalizedEntries().XObject;
      return n.uniqueKey(r);
    }, t.prototype.newXObject = function(r, n) {
      var i = this.newXObjectKey(r);
      return this.setXObject(i, n), i;
    }, t.prototype.setExtGState = function(r, n) {
      var i = this.normalizedEntries().ExtGState;
      i.set(r, n);
    }, t.prototype.newExtGStateKey = function(r) {
      var n = this.normalizedEntries().ExtGState;
      return n.uniqueKey(r);
    }, t.prototype.newExtGState = function(r, n) {
      var i = this.newExtGStateKey(r);
      return this.setExtGState(i, n), i;
    }, t.prototype.ascend = function(r) {
      r(this);
      var n = this.Parent();
      n && n.ascend(r);
    }, t.prototype.normalize = function() {
      if (!this.normalized) {
        var r = this.context, n = this.get(x.Contents), i = this.context.lookup(n);
        i instanceof Mt && this.set(x.Contents, r.obj([n])), this.autoNormalizeCTM && this.wrapContentStreams(this.context.getPushGraphicsStateContentStream(), this.context.getPopGraphicsStateContentStream());
        var a = this.getInheritableAttribute(x.Resources), o = r.lookupMaybe(a, ce) || r.obj({});
        this.set(x.Resources, o);
        var s = o.lookupMaybe(x.Font, ce) || r.obj({});
        o.set(x.Font, s);
        var l = o.lookupMaybe(x.XObject, ce) || r.obj({});
        o.set(x.XObject, l);
        var u = o.lookupMaybe(x.ExtGState, ce) || r.obj({});
        o.set(x.ExtGState, u);
        var c = this.Annots() || r.obj([]);
        this.set(x.Annots, c), this.normalized = !0;
      }
    }, t.prototype.normalizedEntries = function() {
      this.normalize();
      var r = this.Annots(), n = this.Resources(), i = this.Contents();
      return {
        Annots: r,
        Resources: n,
        Contents: i,
        Font: n.lookup(x.Font, ce),
        XObject: n.lookup(x.XObject, ce),
        ExtGState: n.lookup(x.ExtGState, ce)
      };
    }, t.InheritableEntries = [
      "Resources",
      "MediaBox",
      "CropBox",
      "Rotate"
    ], t.withContextAndParent = function(r, n) {
      var i = /* @__PURE__ */ new Map();
      return i.set(x.Type, x.Page), i.set(x.Parent, n), i.set(x.Resources, r.obj({})), i.set(x.MediaBox, r.obj([0, 0, 612, 792])), new t(i, r, !1);
    }, t.fromMapWithContext = function(r, n, i) {
      return i === void 0 && (i = !0), new t(r, n, i);
    }, t;
  }(ce)
), yp = (
  /** @class */
  function() {
    function e(t, r) {
      var n = this;
      this.traversedObjects = /* @__PURE__ */ new Map(), this.copy = function(i) {
        return i instanceof Ir ? n.copyPDFPage(i) : i instanceof ce ? n.copyPDFDict(i) : i instanceof Ee ? n.copyPDFArray(i) : i instanceof Mt ? n.copyPDFStream(i) : i instanceof Re ? n.copyPDFIndirectObject(i) : i.clone();
      }, this.copyPDFPage = function(i) {
        for (var a = i.clone(), o = Ir.InheritableEntries, s = 0, l = o.length; s < l; s++) {
          var u = x.of(o[s]), c = a.getInheritableAttribute(u);
          !a.get(u) && c && a.set(u, c);
        }
        return a.delete(x.of("Parent")), n.copyPDFDict(a);
      }, this.copyPDFDict = function(i) {
        if (n.traversedObjects.has(i))
          return n.traversedObjects.get(i);
        var a = i.clone(n.dest);
        n.traversedObjects.set(i, a);
        for (var o = i.entries(), s = 0, l = o.length; s < l; s++) {
          var u = o[s], c = u[0], f = u[1];
          a.set(c, n.copy(f));
        }
        return a;
      }, this.copyPDFArray = function(i) {
        if (n.traversedObjects.has(i))
          return n.traversedObjects.get(i);
        var a = i.clone(n.dest);
        n.traversedObjects.set(i, a);
        for (var o = 0, s = i.size(); o < s; o++) {
          var l = i.get(o);
          a.set(o, n.copy(l));
        }
        return a;
      }, this.copyPDFStream = function(i) {
        if (n.traversedObjects.has(i))
          return n.traversedObjects.get(i);
        var a = i.clone(n.dest);
        n.traversedObjects.set(i, a);
        for (var o = i.dict.entries(), s = 0, l = o.length; s < l; s++) {
          var u = o[s], c = u[0], f = u[1];
          a.dict.set(c, n.copy(f));
        }
        return a;
      }, this.copyPDFIndirectObject = function(i) {
        var a = n.traversedObjects.has(i);
        if (!a) {
          var o = n.dest.nextRef();
          n.traversedObjects.set(i, o);
          var s = n.src.lookup(i);
          if (s) {
            var l = n.copy(s);
            n.dest.assign(o, l);
          }
        }
        return n.traversedObjects.get(i);
      }, this.src = t, this.dest = r;
    }
    return e.for = function(t, r) {
      return new e(t, r);
    }, e;
  }()
), ry = (
  /** @class */
  function() {
    function e(t) {
      this.subsections = t ? [[t]] : [], this.chunkIdx = 0, this.chunkLength = t ? 1 : 0;
    }
    return e.prototype.addEntry = function(t, r) {
      this.append({ ref: t, offset: r, deleted: !1 });
    }, e.prototype.addDeletedEntry = function(t, r) {
      this.append({ ref: t, offset: r, deleted: !0 });
    }, e.prototype.toString = function() {
      for (var t = `xref
`, r = 0, n = this.subsections.length; r < n; r++) {
        var i = this.subsections[r];
        t += i[0].ref.objectNumber + " " + i.length + `
`;
        for (var a = 0, o = i.length; a < o; a++) {
          var s = i[a];
          t += sr(String(s.offset), 10, "0"), t += " ", t += sr(String(s.ref.generationNumber), 5, "0"), t += " ", t += s.deleted ? "f" : "n", t += ` 
`;
        }
      }
      return t;
    }, e.prototype.sizeInBytes = function() {
      for (var t = 5, r = 0, n = this.subsections.length; r < n; r++) {
        var i = this.subsections[r], a = i.length, o = i[0];
        t += 2, t += String(o.ref.objectNumber).length, t += String(a).length, t += 20 * a;
      }
      return t;
    }, e.prototype.copyBytesInto = function(t, r) {
      var n = r;
      return t[r++] = E.x, t[r++] = E.r, t[r++] = E.e, t[r++] = E.f, t[r++] = E.Newline, r += this.copySubsectionsIntoBuffer(this.subsections, t, r), r - n;
    }, e.prototype.copySubsectionsIntoBuffer = function(t, r, n) {
      for (var i = n, a = t.length, o = 0; o < a; o++) {
        var s = this.subsections[o], l = String(s[0].ref.objectNumber);
        n += lt(l, r, n), r[n++] = E.Space;
        var u = String(s.length);
        n += lt(u, r, n), r[n++] = E.Newline, n += this.copyEntriesIntoBuffer(s, r, n);
      }
      return n - i;
    }, e.prototype.copyEntriesIntoBuffer = function(t, r, n) {
      for (var i = t.length, a = 0; a < i; a++) {
        var o = t[a], s = sr(String(o.offset), 10, "0");
        n += lt(s, r, n), r[n++] = E.Space;
        var l = sr(String(o.ref.generationNumber), 5, "0");
        n += lt(l, r, n), r[n++] = E.Space, r[n++] = o.deleted ? E.f : E.n, r[n++] = E.Space, r[n++] = E.Newline;
      }
      return 20 * i;
    }, e.prototype.append = function(t) {
      if (this.chunkLength === 0) {
        this.subsections.push([t]), this.chunkIdx = 0, this.chunkLength = 1;
        return;
      }
      var r = this.subsections[this.chunkIdx], n = r[this.chunkLength - 1];
      t.ref.objectNumber - n.ref.objectNumber > 1 ? (this.subsections.push([t]), this.chunkIdx += 1, this.chunkLength = 1) : (r.push(t), this.chunkLength += 1);
    }, e.create = function() {
      return new e({
        ref: Re.of(0, 65535),
        offset: 0,
        deleted: !0
      });
    }, e.createEmpty = function() {
      return new e();
    }, e;
  }()
), zf = (
  /** @class */
  function() {
    function e(t) {
      this.lastXRefOffset = String(t);
    }
    return e.prototype.toString = function() {
      return `startxref
` + this.lastXRefOffset + `
%%EOF`;
    }, e.prototype.sizeInBytes = function() {
      return 16 + this.lastXRefOffset.length;
    }, e.prototype.copyBytesInto = function(t, r) {
      var n = r;
      return t[r++] = E.s, t[r++] = E.t, t[r++] = E.a, t[r++] = E.r, t[r++] = E.t, t[r++] = E.x, t[r++] = E.r, t[r++] = E.e, t[r++] = E.f, t[r++] = E.Newline, r += lt(this.lastXRefOffset, t, r), t[r++] = E.Newline, t[r++] = E.Percent, t[r++] = E.Percent, t[r++] = E.E, t[r++] = E.O, t[r++] = E.F, r - n;
    }, e.forLastCrossRefSectionOffset = function(t) {
      return new e(t);
    }, e;
  }()
), HD = (
  /** @class */
  function() {
    function e(t) {
      this.dict = t;
    }
    return e.prototype.toString = function() {
      return `trailer
` + this.dict.toString();
    }, e.prototype.sizeInBytes = function() {
      return 8 + this.dict.sizeInBytes();
    }, e.prototype.copyBytesInto = function(t, r) {
      var n = r;
      return t[r++] = E.t, t[r++] = E.r, t[r++] = E.a, t[r++] = E.i, t[r++] = E.l, t[r++] = E.e, t[r++] = E.r, t[r++] = E.Newline, r += this.dict.copyBytesInto(t, r), r - n;
    }, e.of = function(t) {
      return new e(t);
    }, e;
  }()
), ny = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      i === void 0 && (i = !0);
      var a = e.call(this, r.obj({}), i) || this;
      return a.objects = n, a.offsets = a.computeObjectOffsets(), a.offsetsString = a.computeOffsetsString(), a.dict.set(x.of("Type"), x.of("ObjStm")), a.dict.set(x.of("N"), ae.of(a.objects.length)), a.dict.set(x.of("First"), ae.of(a.offsetsString.length)), a;
    }
    return t.prototype.getObjectsCount = function() {
      return this.objects.length;
    }, t.prototype.clone = function(r) {
      return t.withContextAndObjects(r || this.dict.context, this.objects.slice(), this.encode);
    }, t.prototype.getContentsString = function() {
      for (var r = this.offsetsString, n = 0, i = this.objects.length; n < i; n++) {
        var a = this.objects[n], o = a[1];
        r += o + `
`;
      }
      return r;
    }, t.prototype.getUnencodedContents = function() {
      for (var r = new Uint8Array(this.getUnencodedContentsSize()), n = lt(this.offsetsString, r, 0), i = 0, a = this.objects.length; i < a; i++) {
        var o = this.objects[i], s = o[1];
        n += s.copyBytesInto(r, n), r[n++] = E.Newline;
      }
      return r;
    }, t.prototype.getUnencodedContentsSize = function() {
      return this.offsetsString.length + Xs(this.offsets)[1] + Xs(this.objects)[1].sizeInBytes() + 1;
    }, t.prototype.computeOffsetsString = function() {
      for (var r = "", n = 0, i = this.offsets.length; n < i; n++) {
        var a = this.offsets[n], o = a[0], s = a[1];
        r += o + " " + s + " ";
      }
      return r;
    }, t.prototype.computeObjectOffsets = function() {
      for (var r = 0, n = new Array(this.objects.length), i = 0, a = this.objects.length; i < a; i++) {
        var o = this.objects[i], s = o[0], l = o[1];
        n[i] = [s.objectNumber, r], r += l.sizeInBytes() + 1;
      }
      return n;
    }, t.withContextAndObjects = function(r, n, i) {
      return i === void 0 && (i = !0), new t(r, n, i);
    }, t;
  }(_f)
), iy = (
  /** @class */
  function() {
    function e(t, r) {
      var n = this;
      this.parsedObjects = 0, this.shouldWaitForTick = function(i) {
        return n.parsedObjects += i, n.parsedObjects % n.objectsPerTick === 0;
      }, this.context = t, this.objectsPerTick = r;
    }
    return e.prototype.serializeToBuffer = function() {
      return fe(this, void 0, void 0, function() {
        var t, r, n, i, a, o, s, l, u, c, f, h, d, p, v, y, m;
        return he(this, function(S) {
          switch (S.label) {
            case 0:
              return [4, this.computeBufferSize()];
            case 1:
              t = S.sent(), r = t.size, n = t.header, i = t.indirectObjects, a = t.xref, o = t.trailerDict, s = t.trailer, l = 0, u = new Uint8Array(r), l += n.copyBytesInto(u, l), u[l++] = E.Newline, u[l++] = E.Newline, c = 0, f = i.length, S.label = 2;
            case 2:
              return c < f ? (h = i[c], d = h[0], p = h[1], v = String(d.objectNumber), l += lt(v, u, l), u[l++] = E.Space, y = String(d.generationNumber), l += lt(y, u, l), u[l++] = E.Space, u[l++] = E.o, u[l++] = E.b, u[l++] = E.j, u[l++] = E.Newline, l += p.copyBytesInto(u, l), u[l++] = E.Newline, u[l++] = E.e, u[l++] = E.n, u[l++] = E.d, u[l++] = E.o, u[l++] = E.b, u[l++] = E.j, u[l++] = E.Newline, u[l++] = E.Newline, m = p instanceof ny ? p.getObjectsCount() : 1, this.shouldWaitForTick(m) ? [4, Ui()] : [3, 4]) : [3, 5];
            case 3:
              S.sent(), S.label = 4;
            case 4:
              return c++, [3, 2];
            case 5:
              return a && (l += a.copyBytesInto(u, l), u[l++] = E.Newline), o && (l += o.copyBytesInto(u, l), u[l++] = E.Newline, u[l++] = E.Newline), l += s.copyBytesInto(u, l), [2, u];
          }
        });
      });
    }, e.prototype.computeIndirectObjectSize = function(t) {
      var r = t[0], n = t[1], i = r.sizeInBytes() + 3, a = n.sizeInBytes() + 9;
      return i + a;
    }, e.prototype.createTrailerDict = function() {
      return this.context.obj({
        Size: this.context.largestObjectNumber + 1,
        Root: this.context.trailerInfo.Root,
        Encrypt: this.context.trailerInfo.Encrypt,
        Info: this.context.trailerInfo.Info,
        ID: this.context.trailerInfo.ID
      });
    }, e.prototype.computeBufferSize = function() {
      return fe(this, void 0, void 0, function() {
        var t, r, n, i, a, o, s, l, u, c, f;
        return he(this, function(h) {
          switch (h.label) {
            case 0:
              t = zl.forVersion(1, 7), r = t.sizeInBytes() + 2, n = ry.create(), i = this.context.enumerateIndirectObjects(), a = 0, o = i.length, h.label = 1;
            case 1:
              return a < o ? (s = i[a], l = s[0], n.addEntry(l, r), r += this.computeIndirectObjectSize(s), this.shouldWaitForTick(1) ? [4, Ui()] : [3, 3]) : [3, 4];
            case 2:
              h.sent(), h.label = 3;
            case 3:
              return a++, [3, 1];
            case 4:
              return u = r, r += n.sizeInBytes() + 1, c = HD.of(this.createTrailerDict()), r += c.sizeInBytes() + 2, f = zf.forLastCrossRefSectionOffset(u), r += f.sizeInBytes(), [2, { size: r, header: t, indirectObjects: i, xref: n, trailerDict: c, trailer: f }];
          }
        });
      });
    }, e.forContext = function(t, r) {
      return new e(t, r);
    }, e;
  }()
), ay = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = e.call(this) || this;
      return n.data = r, n;
    }
    return t.prototype.clone = function() {
      return t.of(this.data.slice());
    }, t.prototype.toString = function() {
      return "PDFInvalidObject(" + this.data.length + " bytes)";
    }, t.prototype.sizeInBytes = function() {
      return this.data.length;
    }, t.prototype.copyBytesInto = function(r, n) {
      for (var i = this.data.length, a = 0; a < i; a++)
        r[n++] = this.data[a];
      return i;
    }, t.of = function(r) {
      return new t(r);
    }, t;
  }(St)
), Zr;
(function(e) {
  e[e.Deleted = 0] = "Deleted", e[e.Uncompressed = 1] = "Uncompressed", e[e.Compressed = 2] = "Compressed";
})(Zr || (Zr = {}));
var WD = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      i === void 0 && (i = !0);
      var a = e.call(this, r, i) || this;
      return a.computeIndex = function() {
        for (var o = [], s = 0, l = 0, u = a.entries.length; l < u; l++) {
          var c = a.entries[l], f = a.entries[l - 1];
          l === 0 ? o.push(c.ref.objectNumber) : c.ref.objectNumber - f.ref.objectNumber > 1 && (o.push(s), o.push(c.ref.objectNumber), s = 0), s += 1;
        }
        return o.push(s), o;
      }, a.computeEntryTuples = function() {
        for (var o = new Array(a.entries.length), s = 0, l = a.entries.length; s < l; s++) {
          var u = a.entries[s];
          if (u.type === Zr.Deleted) {
            var c = u.type, f = u.nextFreeObjectNumber, h = u.ref;
            o[s] = [c, f, h.generationNumber];
          }
          if (u.type === Zr.Uncompressed) {
            var c = u.type, d = u.offset, h = u.ref;
            o[s] = [c, d, h.generationNumber];
          }
          if (u.type === Zr.Compressed) {
            var c = u.type, p = u.objectStreamRef, v = u.index;
            o[s] = [c, p.objectNumber, v];
          }
        }
        return o;
      }, a.computeMaxEntryByteWidths = function() {
        for (var o = a.entryTuplesCache.access(), s = [0, 0, 0], l = 0, u = o.length; l < u; l++) {
          var c = o[l], f = c[0], h = c[1], d = c[2], p = Ts(f), v = Ts(h), y = Ts(d);
          p > s[0] && (s[0] = p), v > s[1] && (s[1] = v), y > s[2] && (s[2] = y);
        }
        return s;
      }, a.entries = n || [], a.entryTuplesCache = Nr.populatedBy(a.computeEntryTuples), a.maxByteWidthsCache = Nr.populatedBy(a.computeMaxEntryByteWidths), a.indexCache = Nr.populatedBy(a.computeIndex), r.set(x.of("Type"), x.of("XRef")), a;
    }
    return t.prototype.addDeletedEntry = function(r, n) {
      var i = Zr.Deleted;
      this.entries.push({ type: i, ref: r, nextFreeObjectNumber: n }), this.entryTuplesCache.invalidate(), this.maxByteWidthsCache.invalidate(), this.indexCache.invalidate(), this.contentsCache.invalidate();
    }, t.prototype.addUncompressedEntry = function(r, n) {
      var i = Zr.Uncompressed;
      this.entries.push({ type: i, ref: r, offset: n }), this.entryTuplesCache.invalidate(), this.maxByteWidthsCache.invalidate(), this.indexCache.invalidate(), this.contentsCache.invalidate();
    }, t.prototype.addCompressedEntry = function(r, n, i) {
      var a = Zr.Compressed;
      this.entries.push({ type: a, ref: r, objectStreamRef: n, index: i }), this.entryTuplesCache.invalidate(), this.maxByteWidthsCache.invalidate(), this.indexCache.invalidate(), this.contentsCache.invalidate();
    }, t.prototype.clone = function(r) {
      var n = this, i = n.dict, a = n.entries, o = n.encode;
      return t.of(i.clone(r), a.slice(), o);
    }, t.prototype.getContentsString = function() {
      for (var r = this.entryTuplesCache.access(), n = this.maxByteWidthsCache.access(), i = "", a = 0, o = r.length; a < o; a++) {
        for (var s = r[a], l = s[0], u = s[1], c = s[2], f = ci(fi(l)), h = ci(fi(u)), d = ci(fi(c)), p = n[0] - 1; p >= 0; p--)
          i += (f[p] || 0).toString(2);
        for (var p = n[1] - 1; p >= 0; p--)
          i += (h[p] || 0).toString(2);
        for (var p = n[2] - 1; p >= 0; p--)
          i += (d[p] || 0).toString(2);
      }
      return i;
    }, t.prototype.getUnencodedContents = function() {
      for (var r = this.entryTuplesCache.access(), n = this.maxByteWidthsCache.access(), i = new Uint8Array(this.getUnencodedContentsSize()), a = 0, o = 0, s = r.length; o < s; o++) {
        for (var l = r[o], u = l[0], c = l[1], f = l[2], h = ci(fi(u)), d = ci(fi(c)), p = ci(fi(f)), v = n[0] - 1; v >= 0; v--)
          i[a++] = h[v] || 0;
        for (var v = n[1] - 1; v >= 0; v--)
          i[a++] = d[v] || 0;
        for (var v = n[2] - 1; v >= 0; v--)
          i[a++] = p[v] || 0;
      }
      return i;
    }, t.prototype.getUnencodedContentsSize = function() {
      var r = this.maxByteWidthsCache.access(), n = WR(r);
      return n * this.entries.length;
    }, t.prototype.updateDict = function() {
      e.prototype.updateDict.call(this);
      var r = this.maxByteWidthsCache.access(), n = this.indexCache.access(), i = this.dict.context;
      this.dict.set(x.of("W"), i.obj(r)), this.dict.set(x.of("Index"), i.obj(n));
    }, t.create = function(r, n) {
      n === void 0 && (n = !0);
      var i = new t(r, [], n);
      return i.addDeletedEntry(Re.of(0, 65535), 0), i;
    }, t.of = function(r, n, i) {
      return i === void 0 && (i = !0), new t(r, n, i);
    }, t;
  }(_f)
), GD = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i, a) {
      var o = e.call(this, r, n) || this;
      return o.encodeStreams = i, o.objectsPerStream = a, o;
    }
    return t.prototype.computeBufferSize = function() {
      return fe(this, void 0, void 0, function() {
        var r, n, i, a, o, s, l, u, p, v, c, m, f, h, y, d, p, v, y, m, S, T, C, A;
        return he(this, function(O) {
          switch (O.label) {
            case 0:
              r = this.context.largestObjectNumber + 1, n = zl.forVersion(1, 7), i = n.sizeInBytes() + 2, a = WD.create(this.createTrailerDict(), this.encodeStreams), o = [], s = [], l = [], u = this.context.enumerateIndirectObjects(), p = 0, v = u.length, O.label = 1;
            case 1:
              return p < v ? (c = u[p], m = c[0], f = c[1], h = m === this.context.trailerInfo.Encrypt || f instanceof Mt || f instanceof ay || m.generationNumber !== 0, h ? (o.push(c), a.addUncompressedEntry(m, i), i += this.computeIndirectObjectSize(c), this.shouldWaitForTick(1) ? [4, Ui()] : [3, 3]) : [3, 4]) : [3, 6];
            case 2:
              O.sent(), O.label = 3;
            case 3:
              return [3, 5];
            case 4:
              y = Xs(s), d = Xs(l), (!y || y.length % this.objectsPerStream === 0) && (y = [], s.push(y), d = Re.of(r++), l.push(d)), a.addCompressedEntry(m, d, y.length), y.push(c), O.label = 5;
            case 5:
              return p++, [3, 1];
            case 6:
              p = 0, v = s.length, O.label = 7;
            case 7:
              return p < v ? (y = s[p], m = l[p], S = ny.withContextAndObjects(this.context, y, this.encodeStreams), a.addUncompressedEntry(m, i), i += this.computeIndirectObjectSize([m, S]), o.push([m, S]), this.shouldWaitForTick(y.length) ? [4, Ui()] : [3, 9]) : [3, 10];
            case 8:
              O.sent(), O.label = 9;
            case 9:
              return p++, [3, 7];
            case 10:
              return T = Re.of(r++), a.dict.set(x.of("Size"), ae.of(r)), a.addUncompressedEntry(T, i), C = i, i += this.computeIndirectObjectSize([T, a]), o.push([T, a]), A = zf.forLastCrossRefSectionOffset(C), i += A.sizeInBytes(), [2, { size: i, header: n, indirectObjects: o, trailer: A }];
          }
        });
      });
    }, t.forContext = function(r, n, i, a) {
      return i === void 0 && (i = !0), a === void 0 && (a = 50), new t(r, n, i, a);
    }, t;
  }(iy)
), ne = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = e.call(this) || this;
      return n.value = r, n;
    }
    return t.prototype.asBytes = function() {
      for (var r = this.value + (this.value.length % 2 === 1 ? "0" : ""), n = r.length, i = new Uint8Array(r.length / 2), a = 0, o = 0; a < n; ) {
        var s = parseInt(r.substring(a, a + 2), 16);
        i[o] = s, a += 2, o += 1;
      }
      return i;
    }, t.prototype.decodeText = function() {
      var r = this.asBytes();
      return um(r) ? om(r) : ey(r);
    }, t.prototype.decodeDate = function() {
      var r = this.decodeText(), n = rm(r);
      if (!n)
        throw new ty(r);
      return n;
    }, t.prototype.asString = function() {
      return this.value;
    }, t.prototype.clone = function() {
      return t.of(this.value);
    }, t.prototype.toString = function() {
      return "<" + this.value + ">";
    }, t.prototype.sizeInBytes = function() {
      return this.value.length + 2;
    }, t.prototype.copyBytesInto = function(r, n) {
      return r[n++] = E.LessThan, n += lt(this.value, r, n), r[n++] = E.GreaterThan, this.value.length + 2;
    }, t.of = function(r) {
      return new t(r);
    }, t.fromText = function(r) {
      for (var n = YR(r), i = "", a = 0, o = n.length; a < o; a++)
        i += xo(n[a], 4);
      return new t(i);
    }, t;
  }(St)
), $s = (
  /** @class */
  function() {
    function e(t, r) {
      this.encoding = t === no.ZapfDingbats ? hs.ZapfDingbats : t === no.Symbol ? hs.Symbol : hs.WinAnsi, this.font = fD.load(t), this.fontName = this.font.FontName, this.customName = r;
    }
    return e.prototype.encodeText = function(t) {
      for (var r = this.encodeTextAsGlyphs(t), n = new Array(r.length), i = 0, a = r.length; i < a; i++)
        n[i] = Il(r[i].code);
      return ne.of(n.join(""));
    }, e.prototype.widthOfTextAtSize = function(t, r) {
      for (var n = this.encodeTextAsGlyphs(t), i = 0, a = 0, o = n.length; a < o; a++) {
        var s = n[a].name, l = (n[a + 1] || {}).name, u = this.font.getXAxisKerningForPair(s, l) || 0;
        i += this.widthOfGlyph(s) + u;
      }
      var c = r / 1e3;
      return i * c;
    }, e.prototype.heightOfFontAtSize = function(t, r) {
      r === void 0 && (r = {});
      var n = r.descender, i = n === void 0 ? !0 : n, a = this.font, o = a.Ascender, s = a.Descender, l = a.FontBBox, u = o || l[3], c = s || l[1], f = u - c;
      return i || (f += s || 0), f / 1e3 * t;
    }, e.prototype.sizeOfFontAtHeight = function(t) {
      var r = this.font, n = r.Ascender, i = r.Descender, a = r.FontBBox, o = n || a[3], s = i || a[1];
      return 1e3 * t / (o - s);
    }, e.prototype.embedIntoContext = function(t, r) {
      var n = t.obj({
        Type: "Font",
        Subtype: "Type1",
        BaseFont: this.customName || this.fontName,
        Encoding: this.encoding === hs.WinAnsi ? "WinAnsiEncoding" : void 0
      });
      return r ? (t.assign(r, n), r) : t.register(n);
    }, e.prototype.widthOfGlyph = function(t) {
      return this.font.getWidthOfGlyph(t) || 250;
    }, e.prototype.encodeTextAsGlyphs = function(t) {
      for (var r = Array.from(t), n = new Array(r.length), i = 0, a = r.length; i < a; i++) {
        var o = NR(r[i]);
        n[i] = this.encoding.encodeUnicodeCodePoint(o);
      }
      return n;
    }, e.for = function(t, r) {
      return new e(t, r);
    }, e;
  }()
), KD = function(e, t) {
  for (var r = new Array(e.length), n = 0, i = e.length; n < i; n++) {
    var a = e[n], o = bp(Ds(t(a))), s = bp.apply(void 0, a.codePoints.map(YD));
    r[n] = [o, s];
  }
  return XD(r);
}, XD = function(e) {
  return `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo <<
  /Registry (Adobe)
  /Ordering (UCS)
  /Supplement 0
>> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000><ffff>
endcodespacerange
` + e.length + ` beginbfchar
` + e.map(function(t) {
    var r = t[0], n = t[1];
    return r + " " + n;
  }).join(`
`) + `
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;
}, bp = function() {
  for (var e = [], t = 0; t < arguments.length; t++)
    e[t] = arguments[t];
  return "<" + e.join("") + ">";
}, Ds = function(e) {
  return xo(e, 4);
}, YD = function(e) {
  if (ZR(e))
    return Ds(e);
  if (JR(e)) {
    var t = im(e), r = am(e);
    return "" + Ds(t) + Ds(r);
  }
  var n = Il(e), i = "0x" + n + " is not a valid UTF-8 or UTF-16 codepoint.";
  throw new Error(i);
}, ZD = function(e) {
  var t = 0, r = function(n) {
    t |= 1 << n - 1;
  };
  return e.fixedPitch && r(1), e.serif && r(2), r(3), e.script && r(4), e.nonsymbolic && r(6), e.italic && r(7), e.allCap && r(17), e.smallCap && r(18), e.forceBold && r(19), t;
}, JD = function(e) {
  var t = e["OS/2"] ? e["OS/2"].sFamilyClass : 0, r = ZD({
    fixedPitch: e.post.isFixedPitch,
    serif: 1 <= t && t <= 7,
    script: t === 10,
    italic: e.head.macStyle.italic
  });
  return r;
}, Pe = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = e.call(this) || this;
      return n.value = r, n;
    }
    return t.prototype.asBytes = function() {
      for (var r = [], n = "", i = !1, a = function(f) {
        f !== void 0 && r.push(f), i = !1;
      }, o = 0, s = this.value.length; o < s; o++) {
        var l = this.value[o], u = se(l), c = this.value[o + 1];
        i ? u === E.Newline || u === E.CarriageReturn ? a() : u === E.n ? a(E.Newline) : u === E.r ? a(E.CarriageReturn) : u === E.t ? a(E.Tab) : u === E.b ? a(E.Backspace) : u === E.f ? a(E.FormFeed) : u === E.LeftParen ? a(E.LeftParen) : u === E.RightParen ? a(E.RightParen) : u === E.Backspace ? a(E.BackSlash) : u >= E.Zero && u <= E.Seven ? (n += l, (n.length === 3 || !(c >= "0" && c <= "7")) && (a(parseInt(n, 8)), n = "")) : a(u) : u === E.BackSlash ? i = !0 : a(u);
      }
      return new Uint8Array(r);
    }, t.prototype.decodeText = function() {
      var r = this.asBytes();
      return um(r) ? om(r) : ey(r);
    }, t.prototype.decodeDate = function() {
      var r = this.decodeText(), n = rm(r);
      if (!n)
        throw new ty(r);
      return n;
    }, t.prototype.asString = function() {
      return this.value;
    }, t.prototype.clone = function() {
      return t.of(this.value);
    }, t.prototype.toString = function() {
      return "(" + this.value + ")";
    }, t.prototype.sizeInBytes = function() {
      return this.value.length + 2;
    }, t.prototype.copyBytesInto = function(r, n) {
      return r[n++] = E.LeftParen, n += lt(this.value, r, n), r[n++] = E.RightParen, this.value.length + 2;
    }, t.of = function(r) {
      return new t(r);
    }, t.fromDate = function(r) {
      var n = sr(String(r.getUTCFullYear()), 4, "0"), i = sr(String(r.getUTCMonth() + 1), 2, "0"), a = sr(String(r.getUTCDate()), 2, "0"), o = sr(String(r.getUTCHours()), 2, "0"), s = sr(String(r.getUTCMinutes()), 2, "0"), l = sr(String(r.getUTCSeconds()), 2, "0");
      return new t("D:" + n + i + a + o + s + l + "Z");
    }, t;
  }(St)
), qf = (
  /** @class */
  function() {
    function e(t, r, n, i) {
      var a = this;
      this.allGlyphsInFontSortedById = function() {
        for (var o = new Array(a.font.characterSet.length), s = 0, l = o.length; s < l; s++) {
          var u = a.font.characterSet[s];
          o[s] = a.font.glyphForCodePoint(u);
        }
        return HR(o.sort(VR), function(c) {
          return c.id;
        });
      }, this.font = t, this.scale = 1e3 / this.font.unitsPerEm, this.fontData = r, this.fontName = this.font.postscriptName || "Font", this.customName = n, this.fontFeatures = i, this.baseFontName = "", this.glyphCache = Nr.populatedBy(this.allGlyphsInFontSortedById);
    }
    return e.for = function(t, r, n, i) {
      return fe(this, void 0, void 0, function() {
        var a;
        return he(this, function(o) {
          switch (o.label) {
            case 0:
              return [4, t.create(r)];
            case 1:
              return a = o.sent(), [2, new e(a, r, n, i)];
          }
        });
      });
    }, e.prototype.encodeText = function(t) {
      for (var r = this.font.layout(t, this.fontFeatures).glyphs, n = new Array(r.length), i = 0, a = r.length; i < a; i++)
        n[i] = xo(r[i].id, 4);
      return ne.of(n.join(""));
    }, e.prototype.widthOfTextAtSize = function(t, r) {
      for (var n = this.font.layout(t, this.fontFeatures).glyphs, i = 0, a = 0, o = n.length; a < o; a++)
        i += n[a].advanceWidth * this.scale;
      var s = r / 1e3;
      return i * s;
    }, e.prototype.heightOfFontAtSize = function(t, r) {
      r === void 0 && (r = {});
      var n = r.descender, i = n === void 0 ? !0 : n, a = this.font, o = a.ascent, s = a.descent, l = a.bbox, u = (o || l.maxY) * this.scale, c = (s || l.minY) * this.scale, f = u - c;
      return i || (f -= Math.abs(s) || 0), f / 1e3 * t;
    }, e.prototype.sizeOfFontAtHeight = function(t) {
      var r = this.font, n = r.ascent, i = r.descent, a = r.bbox, o = (n || a.maxY) * this.scale, s = (i || a.minY) * this.scale;
      return 1e3 * t / (o - s);
    }, e.prototype.embedIntoContext = function(t, r) {
      return this.baseFontName = this.customName || t.addRandomSuffix(this.fontName), this.embedFontDict(t, r);
    }, e.prototype.embedFontDict = function(t, r) {
      return fe(this, void 0, void 0, function() {
        var n, i, a;
        return he(this, function(o) {
          switch (o.label) {
            case 0:
              return [4, this.embedCIDFontDict(t)];
            case 1:
              return n = o.sent(), i = this.embedUnicodeCmap(t), a = t.obj({
                Type: "Font",
                Subtype: "Type0",
                BaseFont: this.baseFontName,
                Encoding: "Identity-H",
                DescendantFonts: [n],
                ToUnicode: i
              }), r ? (t.assign(r, a), [2, r]) : [2, t.register(a)];
          }
        });
      });
    }, e.prototype.isCFF = function() {
      return this.font.cff;
    }, e.prototype.embedCIDFontDict = function(t) {
      return fe(this, void 0, void 0, function() {
        var r, n;
        return he(this, function(i) {
          switch (i.label) {
            case 0:
              return [4, this.embedFontDescriptor(t)];
            case 1:
              return r = i.sent(), n = t.obj({
                Type: "Font",
                Subtype: this.isCFF() ? "CIDFontType0" : "CIDFontType2",
                CIDToGIDMap: "Identity",
                BaseFont: this.baseFontName,
                CIDSystemInfo: {
                  Registry: Pe.of("Adobe"),
                  Ordering: Pe.of("Identity"),
                  Supplement: 0
                },
                FontDescriptor: r,
                W: this.computeWidths()
              }), [2, t.register(n)];
          }
        });
      });
    }, e.prototype.embedFontDescriptor = function(t) {
      return fe(this, void 0, void 0, function() {
        var r, n, i, a, o, s, l, u, c, f, h, d, p, v, y;
        return he(this, function(m) {
          switch (m.label) {
            case 0:
              return [4, this.embedFontStream(t)];
            case 1:
              return r = m.sent(), n = this.scale, i = this.font, a = i.italicAngle, o = i.ascent, s = i.descent, l = i.capHeight, u = i.xHeight, c = this.font.bbox, f = c.minX, h = c.minY, d = c.maxX, p = c.maxY, v = t.obj((y = {
                Type: "FontDescriptor",
                FontName: this.baseFontName,
                Flags: JD(this.font),
                FontBBox: [f * n, h * n, d * n, p * n],
                ItalicAngle: a,
                Ascent: o * n,
                Descent: s * n,
                CapHeight: (l || o) * n,
                XHeight: (u || 0) * n,
                // Not sure how to compute/find this, nor is anybody else really:
                // https://stackoverflow.com/questions/35485179/stemv-value-of-the-truetype-font
                StemV: 0
              }, y[this.isCFF() ? "FontFile3" : "FontFile2"] = r, y)), [2, t.register(v)];
          }
        });
      });
    }, e.prototype.serializeFont = function() {
      return fe(this, void 0, void 0, function() {
        return he(this, function(t) {
          return [2, this.fontData];
        });
      });
    }, e.prototype.embedFontStream = function(t) {
      return fe(this, void 0, void 0, function() {
        var r, n, i;
        return he(this, function(a) {
          switch (a.label) {
            case 0:
              return i = (n = t).flateStream, [4, this.serializeFont()];
            case 1:
              return r = i.apply(n, [a.sent(), {
                Subtype: this.isCFF() ? "CIDFontType0C" : void 0
              }]), [2, t.register(r)];
          }
        });
      });
    }, e.prototype.embedUnicodeCmap = function(t) {
      var r = KD(this.glyphCache.access(), this.glyphId.bind(this)), n = t.flateStream(r);
      return t.register(n);
    }, e.prototype.glyphId = function(t) {
      return t ? t.id : -1;
    }, e.prototype.computeWidths = function() {
      for (var t = this.glyphCache.access(), r = [], n = [], i = 0, a = t.length; i < a; i++) {
        var o = t[i], s = t[i - 1], l = this.glyphId(o), u = this.glyphId(s);
        i === 0 ? r.push(l) : l - u !== 1 && (r.push(n), r.push(l), n = []), n.push(o.advanceWidth * this.scale);
      }
      return r.push(n), r;
    }, e;
  }()
), QD = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i, a) {
      var o = e.call(this, r, n, i, a) || this;
      return o.subset = o.font.createSubset(), o.glyphs = [], o.glyphCache = Nr.populatedBy(function() {
        return o.glyphs;
      }), o.glyphIdMap = /* @__PURE__ */ new Map(), o;
    }
    return t.for = function(r, n, i, a) {
      return fe(this, void 0, void 0, function() {
        var o;
        return he(this, function(s) {
          switch (s.label) {
            case 0:
              return [4, r.create(n)];
            case 1:
              return o = s.sent(), [2, new t(o, n, i, a)];
          }
        });
      });
    }, t.prototype.encodeText = function(r) {
      for (var n = this.font.layout(r, this.fontFeatures).glyphs, i = new Array(n.length), a = 0, o = n.length; a < o; a++) {
        var s = n[a], l = this.subset.includeGlyph(s);
        this.glyphs[l - 1] = s, this.glyphIdMap.set(s.id, l), i[a] = xo(l, 4);
      }
      return this.glyphCache.invalidate(), ne.of(i.join(""));
    }, t.prototype.isCFF = function() {
      return this.subset.cff;
    }, t.prototype.glyphId = function(r) {
      return r ? this.glyphIdMap.get(r.id) : -1;
    }, t.prototype.serializeFont = function() {
      var r = this;
      return new Promise(function(n, i) {
        var a = [];
        r.subset.encodeStream().on("data", function(o) {
          return a.push(o);
        }).on("end", function() {
          return n(qR(a));
        }).on("error", function(o) {
          return i(o);
        });
      });
    }, t;
  }(qf)
), Bc;
(function(e) {
  e.Source = "Source", e.Data = "Data", e.Alternative = "Alternative", e.Supplement = "Supplement", e.EncryptedPayload = "EncryptedPayload", e.FormData = "EncryptedPayload", e.Schema = "Schema", e.Unspecified = "Unspecified";
})(Bc || (Bc = {}));
var $D = (
  /** @class */
  function() {
    function e(t, r, n) {
      n === void 0 && (n = {}), this.fileData = t, this.fileName = r, this.options = n;
    }
    return e.for = function(t, r, n) {
      return n === void 0 && (n = {}), new e(t, r, n);
    }, e.prototype.embedIntoContext = function(t, r) {
      return fe(this, void 0, void 0, function() {
        var n, i, a, o, s, l, u, c, f;
        return he(this, function(h) {
          return n = this.options, i = n.mimeType, a = n.description, o = n.creationDate, s = n.modificationDate, l = n.afRelationship, u = t.flateStream(this.fileData, {
            Type: "EmbeddedFile",
            Subtype: i ?? void 0,
            Params: {
              Size: this.fileData.length,
              CreationDate: o ? Pe.fromDate(o) : void 0,
              ModDate: s ? Pe.fromDate(s) : void 0
            }
          }), c = t.register(u), f = t.obj({
            Type: "Filespec",
            F: Pe.of(this.fileName),
            UF: ne.fromText(this.fileName),
            EF: { F: c },
            Desc: a ? ne.fromText(a) : void 0,
            AFRelationship: l ?? void 0
          }), r ? (t.assign(r, f), [2, r]) : [2, t.register(f)];
        });
      });
    }, e;
  }()
), wp = [
  65472,
  65473,
  65474,
  65475,
  65477,
  65478,
  65479,
  65480,
  65481,
  65482,
  65483,
  65484,
  65485,
  65486,
  65487
], Oi;
(function(e) {
  e.DeviceGray = "DeviceGray", e.DeviceRGB = "DeviceRGB", e.DeviceCMYK = "DeviceCMYK";
})(Oi || (Oi = {}));
var ek = {
  1: Oi.DeviceGray,
  3: Oi.DeviceRGB,
  4: Oi.DeviceCMYK
}, oy = (
  /** @class */
  function() {
    function e(t, r, n, i, a) {
      this.imageData = t, this.bitsPerComponent = r, this.width = n, this.height = i, this.colorSpace = a;
    }
    return e.for = function(t) {
      return fe(this, void 0, void 0, function() {
        var r, n, i, a, o, s, l, u, c, f;
        return he(this, function(h) {
          if (r = new DataView(t.buffer), n = r.getUint16(0), n !== 65496)
            throw new Error("SOI not found in JPEG");
          for (i = 2; i < r.byteLength && (a = r.getUint16(i), i += 2, !wp.includes(a)); )
            i += r.getUint16(i);
          if (!wp.includes(a))
            throw new Error("Invalid JPEG");
          if (i += 2, o = r.getUint8(i++), s = r.getUint16(i), i += 2, l = r.getUint16(i), i += 2, u = r.getUint8(i++), c = ek[u], !c)
            throw new Error("Unknown JPEG channel.");
          return f = c, [2, new e(t, o, l, s, f)];
        });
      });
    }, e.prototype.embedIntoContext = function(t, r) {
      return fe(this, void 0, void 0, function() {
        var n;
        return he(this, function(i) {
          return n = t.stream(this.imageData, {
            Type: "XObject",
            Subtype: "Image",
            BitsPerComponent: this.bitsPerComponent,
            Width: this.width,
            Height: this.height,
            ColorSpace: this.colorSpace,
            Filter: "DCTDecode",
            // CMYK JPEG streams in PDF are typically stored complemented,
            // with 1 as 'off' and 0 as 'on' (PDF 32000-1:2008, 8.6.4.4).
            //
            // Standalone CMYK JPEG (usually exported by Photoshop) are
            // stored inverse, with 0 as 'off' and 1 as 'on', like RGB.
            //
            // Applying a swap here as a hedge that most bytes passing
            // through this method will benefit from it.
            Decode: this.colorSpace === Oi.DeviceCMYK ? [1, 0, 1, 0, 1, 0, 1, 0] : void 0
          }), r ? (t.assign(r, n), [2, r]) : [2, t.register(n)];
        });
      });
    }, e;
  }()
), H = {};
H.toRGBA8 = function(e) {
  var t = e.width, r = e.height;
  if (e.tabs.acTL == null) return [H.toRGBA8.decodeImage(e.data, t, r, e).buffer];
  var n = [];
  e.frames[0].data == null && (e.frames[0].data = e.data);
  for (var i = t * r * 4, a = new Uint8Array(i), o = new Uint8Array(i), s = new Uint8Array(i), l = 0; l < e.frames.length; l++) {
    var u = e.frames[l], c = u.rect.x, f = u.rect.y, h = u.rect.width, d = u.rect.height, p = H.toRGBA8.decodeImage(u.data, h, d, e);
    if (l != 0) for (var v = 0; v < i; v++) s[v] = a[v];
    if (u.blend == 0 ? H._copyTile(p, h, d, a, t, r, c, f, 0) : u.blend == 1 && H._copyTile(p, h, d, a, t, r, c, f, 1), n.push(a.buffer.slice(0)), u.dispose != 0) {
      if (u.dispose == 1) H._copyTile(o, h, d, a, t, r, c, f, 0);
      else if (u.dispose == 2) for (var v = 0; v < i; v++) a[v] = s[v];
    }
  }
  return n;
};
H.toRGBA8.decodeImage = function(e, t, r, n) {
  var i = t * r, a = H.decode._getBPP(n), o = Math.ceil(t * a / 8), s = new Uint8Array(i * 4), l = new Uint32Array(s.buffer), u = n.ctype, c = n.depth, f = H._bin.readUshort;
  if (u == 6) {
    var h = i << 2;
    if (c == 8) for (var d = 0; d < h; d += 4)
      s[d] = e[d], s[d + 1] = e[d + 1], s[d + 2] = e[d + 2], s[d + 3] = e[d + 3];
    if (c == 16) for (var d = 0; d < h; d++)
      s[d] = e[d << 1];
  } else if (u == 2) {
    var p = n.tabs.tRNS;
    if (p == null) {
      if (c == 8) for (var d = 0; d < i; d++) {
        var v = d * 3;
        l[d] = 255 << 24 | e[v + 2] << 16 | e[v + 1] << 8 | e[v];
      }
      if (c == 16) for (var d = 0; d < i; d++) {
        var v = d * 6;
        l[d] = 255 << 24 | e[v + 4] << 16 | e[v + 2] << 8 | e[v];
      }
    } else {
      var y = p[0], m = p[1], S = p[2];
      if (c == 8) for (var d = 0; d < i; d++) {
        var T = d << 2, v = d * 3;
        l[d] = 255 << 24 | e[v + 2] << 16 | e[v + 1] << 8 | e[v], e[v] == y && e[v + 1] == m && e[v + 2] == S && (s[T + 3] = 0);
      }
      if (c == 16) for (var d = 0; d < i; d++) {
        var T = d << 2, v = d * 6;
        l[d] = 255 << 24 | e[v + 4] << 16 | e[v + 2] << 8 | e[v], f(e, v) == y && f(e, v + 2) == m && f(e, v + 4) == S && (s[T + 3] = 0);
      }
    }
  } else if (u == 3) {
    var C = n.tabs.PLTE, A = n.tabs.tRNS, O = A ? A.length : 0;
    if (c == 1) for (var k = 0; k < r; k++)
      for (var M = k * o, b = k * t, d = 0; d < t; d++) {
        var T = b + d << 2, j = e[M + (d >> 3)] >> 7 - ((d & 7) << 0) & 1, I = 3 * j;
        s[T] = C[I], s[T + 1] = C[I + 1], s[T + 2] = C[I + 2], s[T + 3] = j < O ? A[j] : 255;
      }
    if (c == 2) for (var k = 0; k < r; k++)
      for (var M = k * o, b = k * t, d = 0; d < t; d++) {
        var T = b + d << 2, j = e[M + (d >> 2)] >> 6 - ((d & 3) << 1) & 3, I = 3 * j;
        s[T] = C[I], s[T + 1] = C[I + 1], s[T + 2] = C[I + 2], s[T + 3] = j < O ? A[j] : 255;
      }
    if (c == 4) for (var k = 0; k < r; k++)
      for (var M = k * o, b = k * t, d = 0; d < t; d++) {
        var T = b + d << 2, j = e[M + (d >> 1)] >> 4 - ((d & 1) << 2) & 15, I = 3 * j;
        s[T] = C[I], s[T + 1] = C[I + 1], s[T + 2] = C[I + 2], s[T + 3] = j < O ? A[j] : 255;
      }
    if (c == 8) for (var d = 0; d < i; d++) {
      var T = d << 2, j = e[d], I = 3 * j;
      s[T] = C[I], s[T + 1] = C[I + 1], s[T + 2] = C[I + 2], s[T + 3] = j < O ? A[j] : 255;
    }
  } else if (u == 4) {
    if (c == 8) for (var d = 0; d < i; d++) {
      var T = d << 2, q = d << 1, z = e[q];
      s[T] = z, s[T + 1] = z, s[T + 2] = z, s[T + 3] = e[q + 1];
    }
    if (c == 16) for (var d = 0; d < i; d++) {
      var T = d << 2, q = d << 2, z = e[q];
      s[T] = z, s[T + 1] = z, s[T + 2] = z, s[T + 3] = e[q + 2];
    }
  } else if (u == 0)
    for (var y = n.tabs.tRNS ? n.tabs.tRNS : -1, k = 0; k < r; k++) {
      var B = k * o, N = k * t;
      if (c == 1) for (var L = 0; L < t; L++) {
        var z = 255 * (e[B + (L >>> 3)] >>> 7 - (L & 7) & 1), U = z == y * 255 ? 0 : 255;
        l[N + L] = U << 24 | z << 16 | z << 8 | z;
      }
      else if (c == 2) for (var L = 0; L < t; L++) {
        var z = 85 * (e[B + (L >>> 2)] >>> 6 - ((L & 3) << 1) & 3), U = z == y * 85 ? 0 : 255;
        l[N + L] = U << 24 | z << 16 | z << 8 | z;
      }
      else if (c == 4) for (var L = 0; L < t; L++) {
        var z = 17 * (e[B + (L >>> 1)] >>> 4 - ((L & 1) << 2) & 15), U = z == y * 17 ? 0 : 255;
        l[N + L] = U << 24 | z << 16 | z << 8 | z;
      }
      else if (c == 8) for (var L = 0; L < t; L++) {
        var z = e[B + L], U = z == y ? 0 : 255;
        l[N + L] = U << 24 | z << 16 | z << 8 | z;
      }
      else if (c == 16) for (var L = 0; L < t; L++) {
        var z = e[B + (L << 1)], U = f(e, B + (L << d)) == y ? 0 : 255;
        l[N + L] = U << 24 | z << 16 | z << 8 | z;
      }
    }
  return s;
};
H.decode = function(e) {
  for (var t = new Uint8Array(e), r = 8, n = H._bin, i = n.readUshort, a = n.readUint, o = { tabs: {}, frames: [] }, s = new Uint8Array(t.length), l = 0, u, c = 0, f = [137, 80, 78, 71, 13, 10, 26, 10], h = 0; h < 8; h++) if (t[h] != f[h]) throw "The input is not a PNG file!";
  for (; r < t.length; ) {
    var d = n.readUint(t, r);
    r += 4;
    var p = n.readASCII(t, r, 4);
    if (r += 4, p == "IHDR")
      H.decode._IHDR(t, r, o);
    else if (p == "IDAT") {
      for (var h = 0; h < d; h++) s[l + h] = t[r + h];
      l += d;
    } else if (p == "acTL")
      o.tabs[p] = { num_frames: a(t, r), num_plays: a(t, r + 4) }, u = new Uint8Array(t.length);
    else if (p == "fcTL") {
      if (c != 0) {
        var v = o.frames[o.frames.length - 1];
        v.data = H.decode._decompress(o, u.slice(0, c), v.rect.width, v.rect.height), c = 0;
      }
      var y = { x: a(t, r + 12), y: a(t, r + 16), width: a(t, r + 4), height: a(t, r + 8) }, m = i(t, r + 22);
      m = i(t, r + 20) / (m == 0 ? 100 : m);
      var S = { rect: y, delay: Math.round(m * 1e3), dispose: t[r + 24], blend: t[r + 25] };
      o.frames.push(S);
    } else if (p == "fdAT") {
      for (var h = 0; h < d - 4; h++) u[c + h] = t[r + h + 4];
      c += d - 4;
    } else if (p == "pHYs")
      o.tabs[p] = [n.readUint(t, r), n.readUint(t, r + 4), t[r + 8]];
    else if (p == "cHRM") {
      o.tabs[p] = [];
      for (var h = 0; h < 8; h++) o.tabs[p].push(n.readUint(t, r + h * 4));
    } else if (p == "tEXt") {
      o.tabs[p] == null && (o.tabs[p] = {});
      var T = n.nextZero(t, r), C = n.readASCII(t, r, T - r), A = n.readASCII(t, T + 1, r + d - T - 1);
      o.tabs[p][C] = A;
    } else if (p == "iTXt") {
      o.tabs[p] == null && (o.tabs[p] = {});
      var T = 0, O = r;
      T = n.nextZero(t, O);
      var C = n.readASCII(t, O, T - O);
      O = T + 1, t[O], t[O + 1], O += 2, T = n.nextZero(t, O), n.readASCII(t, O, T - O), O = T + 1, T = n.nextZero(t, O), n.readUTF8(t, O, T - O), O = T + 1;
      var A = n.readUTF8(t, O, d - (O - r));
      o.tabs[p][C] = A;
    } else if (p == "PLTE")
      o.tabs[p] = n.readBytes(t, r, d);
    else if (p == "hIST") {
      var k = o.tabs.PLTE.length / 3;
      o.tabs[p] = [];
      for (var h = 0; h < k; h++) o.tabs[p].push(i(t, r + h * 2));
    } else if (p == "tRNS")
      o.ctype == 3 ? o.tabs[p] = n.readBytes(t, r, d) : o.ctype == 0 ? o.tabs[p] = i(t, r) : o.ctype == 2 && (o.tabs[p] = [i(t, r), i(t, r + 2), i(t, r + 4)]);
    else if (p == "gAMA") o.tabs[p] = n.readUint(t, r) / 1e5;
    else if (p == "sRGB") o.tabs[p] = t[r];
    else if (p == "bKGD")
      o.ctype == 0 || o.ctype == 4 ? o.tabs[p] = [i(t, r)] : o.ctype == 2 || o.ctype == 6 ? o.tabs[p] = [i(t, r), i(t, r + 2), i(t, r + 4)] : o.ctype == 3 && (o.tabs[p] = t[r]);
    else if (p == "IEND")
      break;
    r += d, n.readUint(t, r), r += 4;
  }
  if (c != 0) {
    var v = o.frames[o.frames.length - 1];
    v.data = H.decode._decompress(o, u.slice(0, c), v.rect.width, v.rect.height), c = 0;
  }
  return o.data = H.decode._decompress(o, s, o.width, o.height), delete o.compress, delete o.interlace, delete o.filter, o;
};
H.decode._decompress = function(e, t, r, n) {
  var i = H.decode._getBPP(e), a = Math.ceil(r * i / 8), o = new Uint8Array((a + 1 + e.interlace) * n);
  return t = H.decode._inflate(t, o), e.interlace == 0 ? t = H.decode._filterZero(t, e, 0, r, n) : e.interlace == 1 && (t = H.decode._readInterlace(t, e)), t;
};
H.decode._inflate = function(e, t) {
  var r = H.inflateRaw(new Uint8Array(e.buffer, 2, e.length - 6), t);
  return r;
};
H.inflateRaw = function() {
  var e = {};
  return e.H = {}, e.H.N = function(t, r) {
    var n = Uint8Array, i = 0, a = 0, o = 0, s = 0, l = 0, u = 0, c = 0, f = 0, h = 0, d, p;
    if (t[0] == 3 && t[1] == 0) return r || new n(0);
    var v = e.H, y = v.b, m = v.e, S = v.R, T = v.n, C = v.A, A = v.Z, O = v.m, k = r == null;
    for (k && (r = new n(t.length >>> 2 << 3)); i == 0; ) {
      if (i = y(t, h, 1), a = y(t, h + 1, 2), h += 3, a == 0) {
        h & 7 && (h += 8 - (h & 7));
        var M = (h >>> 3) + 4, b = t[M - 4] | t[M - 3] << 8;
        k && (r = e.H.W(r, f + b)), r.set(new n(t.buffer, t.byteOffset + M, b), f), h = M + b << 3, f += b;
        continue;
      }
      if (k && (r = e.H.W(r, f + (1 << 17))), a == 1 && (d = O.J, p = O.h, u = 511, c = 31), a == 2) {
        o = m(t, h, 5) + 257, s = m(t, h + 5, 5) + 1, l = m(t, h + 10, 4) + 4, h += 14;
        for (var j = 1, I = 0; I < 38; I += 2)
          O.Q[I] = 0, O.Q[I + 1] = 0;
        for (var I = 0; I < l; I++) {
          var q = m(t, h + I * 3, 3);
          O.Q[(O.X[I] << 1) + 1] = q, q > j && (j = q);
        }
        h += 3 * l, T(O.Q, j), C(O.Q, j, O.u), d = O.w, p = O.d, h = S(O.u, (1 << j) - 1, o + s, t, h, O.v);
        var z = v.V(O.v, 0, o, O.C);
        u = (1 << z) - 1;
        var B = v.V(O.v, o, s, O.D);
        c = (1 << B) - 1, T(O.C, z), C(O.C, z, d), T(O.D, B), C(O.D, B, p);
      }
      for (; ; ) {
        var N = d[A(t, h) & u];
        h += N & 15;
        var L = N >>> 4;
        if (!(L >>> 8))
          r[f++] = L;
        else {
          if (L == 256)
            break;
          var U = f + L - 254;
          if (L > 264) {
            var X = O.q[L - 257];
            U = f + (X >>> 3) + m(t, h, X & 7), h += X & 7;
          }
          var W = p[A(t, h) & c];
          h += W & 15;
          var Q = W >>> 4, re = O.c[Q], ee = (re >>> 4) + y(t, h, re & 15);
          for (h += re & 15; f < U; )
            r[f] = r[f++ - ee], r[f] = r[f++ - ee], r[f] = r[f++ - ee], r[f] = r[f++ - ee];
          f = U;
        }
      }
    }
    return r.length == f ? r : r.slice(0, f);
  }, e.H.W = function(t, r) {
    var n = t.length;
    if (r <= n) return t;
    var i = new Uint8Array(n << 1);
    return i.set(t, 0), i;
  }, e.H.R = function(t, r, n, i, a, o) {
    for (var s = e.H.e, l = e.H.Z, u = 0; u < n; ) {
      var c = t[l(i, a) & r];
      a += c & 15;
      var f = c >>> 4;
      if (f <= 15)
        o[u] = f, u++;
      else {
        var h = 0, d = 0;
        f == 16 ? (d = 3 + s(i, a, 2), a += 2, h = o[u - 1]) : f == 17 ? (d = 3 + s(i, a, 3), a += 3) : f == 18 && (d = 11 + s(i, a, 7), a += 7);
        for (var p = u + d; u < p; )
          o[u] = h, u++;
      }
    }
    return a;
  }, e.H.V = function(t, r, n, i) {
    for (var a = 0, o = 0, s = i.length >>> 1; o < n; ) {
      var l = t[o + r];
      i[o << 1] = 0, i[(o << 1) + 1] = l, l > a && (a = l), o++;
    }
    for (; o < s; )
      i[o << 1] = 0, i[(o << 1) + 1] = 0, o++;
    return a;
  }, e.H.n = function(t, r) {
    for (var n = e.H.m, i = t.length, a, o, s, l, u, c = n.j, l = 0; l <= r; l++) c[l] = 0;
    for (l = 1; l < i; l += 2) c[t[l]]++;
    var f = n.K;
    for (a = 0, c[0] = 0, o = 1; o <= r; o++)
      a = a + c[o - 1] << 1, f[o] = a;
    for (s = 0; s < i; s += 2)
      u = t[s + 1], u != 0 && (t[s] = f[u], f[u]++);
  }, e.H.A = function(t, r, n) {
    for (var i = t.length, a = e.H.m, o = a.r, s = 0; s < i; s += 2) if (t[s + 1] != 0)
      for (var l = s >> 1, u = t[s + 1], c = l << 4 | u, f = r - u, h = t[s] << f, d = h + (1 << f); h != d; ) {
        var p = o[h] >>> 15 - r;
        n[p] = c, h++;
      }
  }, e.H.l = function(t, r) {
    for (var n = e.H.m.r, i = 15 - r, a = 0; a < t.length; a += 2) {
      var o = t[a] << r - t[a + 1];
      t[a] = n[o] >>> i;
    }
  }, e.H.M = function(t, r, n) {
    n = n << (r & 7);
    var i = r >>> 3;
    t[i] |= n, t[i + 1] |= n >>> 8;
  }, e.H.I = function(t, r, n) {
    n = n << (r & 7);
    var i = r >>> 3;
    t[i] |= n, t[i + 1] |= n >>> 8, t[i + 2] |= n >>> 16;
  }, e.H.e = function(t, r, n) {
    return (t[r >>> 3] | t[(r >>> 3) + 1] << 8) >>> (r & 7) & (1 << n) - 1;
  }, e.H.b = function(t, r, n) {
    return (t[r >>> 3] | t[(r >>> 3) + 1] << 8 | t[(r >>> 3) + 2] << 16) >>> (r & 7) & (1 << n) - 1;
  }, e.H.Z = function(t, r) {
    return (t[r >>> 3] | t[(r >>> 3) + 1] << 8 | t[(r >>> 3) + 2] << 16) >>> (r & 7);
  }, e.H.i = function(t, r) {
    return (t[r >>> 3] | t[(r >>> 3) + 1] << 8 | t[(r >>> 3) + 2] << 16 | t[(r >>> 3) + 3] << 24) >>> (r & 7);
  }, e.H.m = function() {
    var t = Uint16Array, r = Uint32Array;
    return { K: new t(16), j: new t(16), X: [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], S: [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 999, 999, 999], T: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0], q: new t(32), p: [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 65535, 65535], z: [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0], c: new r(32), J: new t(512), _: [], h: new t(32), $: [], w: new t(32768), C: [], v: [], d: new t(32768), D: [], u: new t(512), Q: [], r: new t(32768), s: new r(286), Y: new r(30), a: new r(19), t: new r(15e3), k: new t(65536), g: new t(32768) };
  }(), function() {
    for (var t = e.H.m, r = 32768, n = 0; n < r; n++) {
      var i = n;
      i = (i & 2863311530) >>> 1 | (i & 1431655765) << 1, i = (i & 3435973836) >>> 2 | (i & 858993459) << 2, i = (i & 4042322160) >>> 4 | (i & 252645135) << 4, i = (i & 4278255360) >>> 8 | (i & 16711935) << 8, t.r[n] = (i >>> 16 | i << 16) >>> 17;
    }
    function a(o, s, l) {
      for (; s-- != 0; ) o.push(0, l);
    }
    for (var n = 0; n < 32; n++)
      t.q[n] = t.S[n] << 3 | t.T[n], t.c[n] = t.p[n] << 4 | t.z[n];
    a(t._, 144, 8), a(t._, 112, 9), a(t._, 24, 7), a(t._, 8, 8), e.H.n(t._, 9), e.H.A(t._, 9, t.J), e.H.l(t._, 9), a(t.$, 32, 5), e.H.n(t.$, 5), e.H.A(t.$, 5, t.h), e.H.l(t.$, 5), a(t.Q, 19, 0), a(t.C, 286, 0), a(t.D, 30, 0), a(t.v, 320, 0);
  }(), e.H.N;
}();
H.decode._readInterlace = function(e, t) {
  for (var r = t.width, n = t.height, i = H.decode._getBPP(t), a = i >> 3, o = Math.ceil(r * i / 8), s = new Uint8Array(n * o), l = 0, u = [0, 0, 4, 0, 2, 0, 1], c = [0, 4, 0, 2, 0, 1, 0], f = [8, 8, 8, 4, 4, 2, 2], h = [8, 8, 4, 4, 2, 2, 1], d = 0; d < 7; ) {
    for (var p = f[d], v = h[d], y = 0, m = 0, S = u[d]; S < n; )
      S += p, m++;
    for (var T = c[d]; T < r; )
      T += v, y++;
    var C = Math.ceil(y * i / 8);
    H.decode._filterZero(e, t, l, y, m);
    for (var A = 0, O = u[d]; O < n; ) {
      for (var k = c[d], M = l + A * C << 3; k < r; ) {
        if (i == 1) {
          var b = e[M >> 3];
          b = b >> 7 - (M & 7) & 1, s[O * o + (k >> 3)] |= b << 7 - ((k & 7) << 0);
        }
        if (i == 2) {
          var b = e[M >> 3];
          b = b >> 6 - (M & 7) & 3, s[O * o + (k >> 2)] |= b << 6 - ((k & 3) << 1);
        }
        if (i == 4) {
          var b = e[M >> 3];
          b = b >> 4 - (M & 7) & 15, s[O * o + (k >> 1)] |= b << 4 - ((k & 1) << 2);
        }
        if (i >= 8)
          for (var j = O * o + k * a, I = 0; I < a; I++) s[j + I] = e[(M >> 3) + I];
        M += i, k += v;
      }
      A++, O += p;
    }
    y * m != 0 && (l += m * (1 + C)), d = d + 1;
  }
  return s;
};
H.decode._getBPP = function(e) {
  var t = [1, null, 3, 1, 2, null, 4][e.ctype];
  return t * e.depth;
};
H.decode._filterZero = function(e, t, r, n, i) {
  var a = H.decode._getBPP(t), o = Math.ceil(n * a / 8), s = H.decode._paeth;
  a = Math.ceil(a / 8);
  var l = 0, u = 1, c = e[r], f = 0;
  if (c > 1 && (e[r] = [0, 0, 1][c - 2]), c == 3) for (f = a; f < o; f++) e[f + 1] = e[f + 1] + (e[f + 1 - a] >>> 1) & 255;
  for (var h = 0; h < i; h++)
    if (l = r + h * o, u = l + h + 1, c = e[u - 1], f = 0, c == 0) for (; f < o; f++) e[l + f] = e[u + f];
    else if (c == 1) {
      for (; f < a; f++) e[l + f] = e[u + f];
      for (; f < o; f++) e[l + f] = e[u + f] + e[l + f - a];
    } else if (c == 2)
      for (; f < o; f++) e[l + f] = e[u + f] + e[l + f - o];
    else if (c == 3) {
      for (; f < a; f++) e[l + f] = e[u + f] + (e[l + f - o] >>> 1);
      for (; f < o; f++) e[l + f] = e[u + f] + (e[l + f - o] + e[l + f - a] >>> 1);
    } else {
      for (; f < a; f++) e[l + f] = e[u + f] + s(0, e[l + f - o], 0);
      for (; f < o; f++) e[l + f] = e[u + f] + s(e[l + f - a], e[l + f - o], e[l + f - a - o]);
    }
  return e;
};
H.decode._paeth = function(e, t, r) {
  var n = e + t - r, i = n - e, a = n - t, o = n - r;
  return i * i <= a * a && i * i <= o * o ? e : a * a <= o * o ? t : r;
};
H.decode._IHDR = function(e, t, r) {
  var n = H._bin;
  r.width = n.readUint(e, t), t += 4, r.height = n.readUint(e, t), t += 4, r.depth = e[t], t++, r.ctype = e[t], t++, r.compress = e[t], t++, r.filter = e[t], t++, r.interlace = e[t], t++;
};
H._bin = {
  nextZero: function(e, t) {
    for (; e[t] != 0; ) t++;
    return t;
  },
  readUshort: function(e, t) {
    return e[t] << 8 | e[t + 1];
  },
  writeUshort: function(e, t, r) {
    e[t] = r >> 8 & 255, e[t + 1] = r & 255;
  },
  readUint: function(e, t) {
    return e[t] * (256 * 256 * 256) + (e[t + 1] << 16 | e[t + 2] << 8 | e[t + 3]);
  },
  writeUint: function(e, t, r) {
    e[t] = r >> 24 & 255, e[t + 1] = r >> 16 & 255, e[t + 2] = r >> 8 & 255, e[t + 3] = r & 255;
  },
  readASCII: function(e, t, r) {
    for (var n = "", i = 0; i < r; i++) n += String.fromCharCode(e[t + i]);
    return n;
  },
  writeASCII: function(e, t, r) {
    for (var n = 0; n < r.length; n++) e[t + n] = r.charCodeAt(n);
  },
  readBytes: function(e, t, r) {
    for (var n = [], i = 0; i < r; i++) n.push(e[t + i]);
    return n;
  },
  pad: function(e) {
    return e.length < 2 ? "0" + e : e;
  },
  readUTF8: function(e, t, r) {
    for (var n = "", i, a = 0; a < r; a++) n += "%" + H._bin.pad(e[t + a].toString(16));
    try {
      i = decodeURIComponent(n);
    } catch {
      return H._bin.readASCII(e, t, r);
    }
    return i;
  }
};
H._copyTile = function(e, t, r, n, i, a, o, s, l) {
  for (var u = Math.min(t, i), c = Math.min(r, a), f = 0, h = 0, d = 0; d < c; d++)
    for (var p = 0; p < u; p++)
      if (o >= 0 && s >= 0 ? (f = d * t + p << 2, h = (s + d) * i + o + p << 2) : (f = (-s + d) * t - o + p << 2, h = d * i + p << 2), l == 0)
        n[h] = e[f], n[h + 1] = e[f + 1], n[h + 2] = e[f + 2], n[h + 3] = e[f + 3];
      else if (l == 1) {
        var v = e[f + 3] * 0.00392156862745098, y = e[f] * v, m = e[f + 1] * v, S = e[f + 2] * v, T = n[h + 3] * (1 / 255), C = n[h] * T, A = n[h + 1] * T, O = n[h + 2] * T, k = 1 - v, M = v + T * k, b = M == 0 ? 0 : 1 / M;
        n[h + 3] = 255 * M, n[h + 0] = (y + C * k) * b, n[h + 1] = (m + A * k) * b, n[h + 2] = (S + O * k) * b;
      } else if (l == 2) {
        var v = e[f + 3], y = e[f], m = e[f + 1], S = e[f + 2], T = n[h + 3], C = n[h], A = n[h + 1], O = n[h + 2];
        v == T && y == C && m == A && S == O ? (n[h] = 0, n[h + 1] = 0, n[h + 2] = 0, n[h + 3] = 0) : (n[h] = y, n[h + 1] = m, n[h + 2] = S, n[h + 3] = v);
      } else if (l == 3) {
        var v = e[f + 3], y = e[f], m = e[f + 1], S = e[f + 2], T = n[h + 3], C = n[h], A = n[h + 1], O = n[h + 2];
        if (v == T && y == C && m == A && S == O) continue;
        if (v < 220 && T > 20) return !1;
      }
  return !0;
};
H.encode = function(e, t, r, n, i, a, o) {
  n == null && (n = 0), o == null && (o = !1);
  var s = H.encode.compress(e, t, r, n, [!1, !1, !1, 0, o]);
  return H.encode.compressPNG(s, -1), H.encode._main(s, t, r, i, a);
};
H.encodeLL = function(e, t, r, n, i, a, o, s) {
  for (var l = { ctype: 0 + (n == 1 ? 0 : 2) + (i == 0 ? 0 : 4), depth: a, frames: [] }, u = (n + i) * a, c = u * t, f = 0; f < e.length; f++)
    l.frames.push({ rect: { x: 0, y: 0, width: t, height: r }, img: new Uint8Array(e[f]), blend: 0, dispose: 1, bpp: Math.ceil(u / 8), bpl: Math.ceil(c / 8) });
  H.encode.compressPNG(l, 0, !0);
  var h = H.encode._main(l, t, r, o, s);
  return h;
};
H.encode._main = function(e, t, r, n, i) {
  i == null && (i = {});
  var a = H.crc.crc, o = H._bin.writeUint, s = H._bin.writeUshort, l = H._bin.writeASCII, u = 8, c = e.frames.length > 1, f = !1, h = 33 + (c ? 20 : 0);
  if (i.sRGB != null && (h += 13), i.pHYs != null && (h += 21), e.ctype == 3) {
    for (var d = e.plte.length, p = 0; p < d; p++) e.plte[p] >>> 24 != 255 && (f = !0);
    h += 8 + d * 3 + 4 + (f ? 8 + d * 1 + 4 : 0);
  }
  for (var v = 0; v < e.frames.length; v++) {
    var y = e.frames[v];
    c && (h += 38), h += y.cimg.length + 12, v != 0 && (h += 4);
  }
  h += 12;
  for (var m = new Uint8Array(h), S = [137, 80, 78, 71, 13, 10, 26, 10], p = 0; p < 8; p++) m[p] = S[p];
  if (o(m, u, 13), u += 4, l(m, u, "IHDR"), u += 4, o(m, u, t), u += 4, o(m, u, r), u += 4, m[u] = e.depth, u++, m[u] = e.ctype, u++, m[u] = 0, u++, m[u] = 0, u++, m[u] = 0, u++, o(m, u, a(m, u - 17, 17)), u += 4, i.sRGB != null && (o(m, u, 1), u += 4, l(m, u, "sRGB"), u += 4, m[u] = i.sRGB, u++, o(m, u, a(m, u - 5, 5)), u += 4), i.pHYs != null && (o(m, u, 9), u += 4, l(m, u, "pHYs"), u += 4, o(m, u, i.pHYs[0]), u += 4, o(m, u, i.pHYs[1]), u += 4, m[u] = i.pHYs[2], u++, o(m, u, a(m, u - 13, 13)), u += 4), c && (o(m, u, 8), u += 4, l(m, u, "acTL"), u += 4, o(m, u, e.frames.length), u += 4, o(m, u, i.loop != null ? i.loop : 0), u += 4, o(m, u, a(m, u - 12, 12)), u += 4), e.ctype == 3) {
    var d = e.plte.length;
    o(m, u, d * 3), u += 4, l(m, u, "PLTE"), u += 4;
    for (var p = 0; p < d; p++) {
      var T = p * 3, C = e.plte[p], A = C & 255, O = C >>> 8 & 255, k = C >>> 16 & 255;
      m[u + T + 0] = A, m[u + T + 1] = O, m[u + T + 2] = k;
    }
    if (u += d * 3, o(m, u, a(m, u - d * 3 - 4, d * 3 + 4)), u += 4, f) {
      o(m, u, d), u += 4, l(m, u, "tRNS"), u += 4;
      for (var p = 0; p < d; p++) m[u + p] = e.plte[p] >>> 24 & 255;
      u += d, o(m, u, a(m, u - d - 4, d + 4)), u += 4;
    }
  }
  for (var M = 0, v = 0; v < e.frames.length; v++) {
    var y = e.frames[v];
    c && (o(m, u, 26), u += 4, l(m, u, "fcTL"), u += 4, o(m, u, M++), u += 4, o(m, u, y.rect.width), u += 4, o(m, u, y.rect.height), u += 4, o(m, u, y.rect.x), u += 4, o(m, u, y.rect.y), u += 4, s(m, u, n[v]), u += 2, s(m, u, 1e3), u += 2, m[u] = y.dispose, u++, m[u] = y.blend, u++, o(m, u, a(m, u - 30, 30)), u += 4);
    var b = y.cimg, d = b.length;
    o(m, u, d + (v == 0 ? 0 : 4)), u += 4;
    var j = u;
    l(m, u, v == 0 ? "IDAT" : "fdAT"), u += 4, v != 0 && (o(m, u, M++), u += 4), m.set(b, u), u += d, o(m, u, a(m, j, u - j)), u += 4;
  }
  return o(m, u, 0), u += 4, l(m, u, "IEND"), u += 4, o(m, u, a(m, u - 4, 4)), u += 4, m.buffer;
};
H.encode.compressPNG = function(e, t, r) {
  for (var n = 0; n < e.frames.length; n++) {
    var i = e.frames[n];
    i.rect.width;
    var a = i.rect.height, o = new Uint8Array(a * i.bpl + a);
    i.cimg = H.encode._filterZero(i.img, a, i.bpp, i.bpl, o, t, r);
  }
};
H.encode.compress = function(e, t, r, n, i) {
  for (var a = i[0], o = i[1], s = i[2], l = i[3], u = i[4], c = 6, f = 8, h = 255, d = 0; d < e.length; d++)
    for (var p = new Uint8Array(e[d]), v = p.length, y = 0; y < v; y += 4) h &= p[y + 3];
  var m = h != 255, S = H.encode.framize(e, t, r, a, o, s), T = {}, C = [], A = [];
  if (n != 0) {
    for (var O = [], y = 0; y < S.length; y++) O.push(S[y].img.buffer);
    for (var k = H.encode.concatRGBA(O), M = H.quantize(k, n), b = 0, j = new Uint8Array(M.abuf), y = 0; y < S.length; y++) {
      var I = S[y].img, q = I.length;
      A.push(new Uint8Array(M.inds.buffer, b >> 2, q >> 2));
      for (var d = 0; d < q; d += 4)
        I[d] = j[b + d], I[d + 1] = j[b + d + 1], I[d + 2] = j[b + d + 2], I[d + 3] = j[b + d + 3];
      b += q;
    }
    for (var y = 0; y < M.plte.length; y++) C.push(M.plte[y].est.rgba);
  } else
    for (var d = 0; d < S.length; d++) {
      var z = S[d], B = new Uint32Array(z.img.buffer), N = z.rect.width, v = B.length, L = new Uint8Array(v);
      A.push(L);
      for (var y = 0; y < v; y++) {
        var U = B[y];
        if (y != 0 && U == B[y - 1]) L[y] = L[y - 1];
        else if (y > N && U == B[y - N]) L[y] = L[y - N];
        else {
          var X = T[U];
          if (X == null && (T[U] = X = C.length, C.push(U), C.length >= 300))
            break;
          L[y] = X;
        }
      }
    }
  var W = C.length;
  W <= 256 && u == !1 && (W <= 2 ? f = 1 : W <= 4 ? f = 2 : W <= 16 ? f = 4 : f = 8, f = Math.max(f, l));
  for (var d = 0; d < S.length; d++) {
    var z = S[d];
    z.rect.x, z.rect.y;
    var N = z.rect.width, Q = z.rect.height, re = z.img;
    new Uint32Array(re.buffer);
    var ee = 4 * N, Te = 4;
    if (W <= 256 && u == !1) {
      ee = Math.ceil(f * N / 8);
      for (var De = new Uint8Array(ee * Q), te = A[d], mt = 0; mt < Q; mt++) {
        var y = mt * ee, w = mt * N;
        if (f == 8) for (var g = 0; g < N; g++) De[y + g] = te[w + g];
        else if (f == 4) for (var g = 0; g < N; g++) De[y + (g >> 1)] |= te[w + g] << 4 - (g & 1) * 4;
        else if (f == 2) for (var g = 0; g < N; g++) De[y + (g >> 2)] |= te[w + g] << 6 - (g & 3) * 2;
        else if (f == 1) for (var g = 0; g < N; g++) De[y + (g >> 3)] |= te[w + g] << 7 - (g & 7) * 1;
      }
      re = De, c = 3, Te = 1;
    } else if (m == !1 && S.length == 1) {
      for (var De = new Uint8Array(N * Q * 3), _ = N * Q, y = 0; y < _; y++) {
        var I = y * 3, P = y * 4;
        De[I] = re[P], De[I + 1] = re[P + 1], De[I + 2] = re[P + 2];
      }
      re = De, c = 2, Te = 3, ee = 3 * N;
    }
    z.img = re, z.bpl = ee, z.bpp = Te;
  }
  return { ctype: c, depth: f, plte: C, frames: S };
};
H.encode.framize = function(e, t, r, n, i, a) {
  for (var o = [], s = 0; s < e.length; s++) {
    var l = new Uint8Array(e[s]), u = new Uint32Array(l.buffer), c, f = 0, h = 0, d = t, p = r, v = n ? 1 : 0;
    if (s != 0) {
      for (var y = a || n || s == 1 || o[s - 2].dispose != 0 ? 1 : 2, m = 0, S = 1e9, T = 0; T < y; T++) {
        for (var z = new Uint8Array(e[s - 1 - T]), C = new Uint32Array(e[s - 1 - T]), A = t, O = r, k = -1, M = -1, b = 0; b < r; b++) for (var j = 0; j < t; j++) {
          var I = b * t + j;
          u[I] != C[I] && (j < A && (A = j), j > k && (k = j), b < O && (O = b), b > M && (M = b));
        }
        k == -1 && (A = O = k = M = 0), i && ((A & 1) == 1 && A--, (O & 1) == 1 && O--);
        var q = (k - A + 1) * (M - O + 1);
        q < S && (S = q, m = T, f = A, h = O, d = k - A + 1, p = M - O + 1);
      }
      var z = new Uint8Array(e[s - 1 - m]);
      m == 1 && (o[s - 1].dispose = 2), c = new Uint8Array(d * p * 4), H._copyTile(z, t, r, c, d, p, -f, -h, 0), v = H._copyTile(l, t, r, c, d, p, -f, -h, 3) ? 1 : 0, v == 1 ? H.encode._prepareDiff(l, t, r, c, { x: f, y: h, width: d, height: p }) : H._copyTile(l, t, r, c, d, p, -f, -h, 0);
    } else c = l.slice(0);
    o.push({ rect: { x: f, y: h, width: d, height: p }, img: c, blend: v, dispose: 0 });
  }
  if (n) for (var s = 0; s < o.length; s++) {
    var B = o[s];
    if (B.blend != 1) {
      var N = B.rect, L = o[s - 1].rect, U = Math.min(N.x, L.x), X = Math.min(N.y, L.y), W = Math.max(N.x + N.width, L.x + L.width), Q = Math.max(N.y + N.height, L.y + L.height), re = { x: U, y: X, width: W - U, height: Q - X };
      o[s - 1].dispose = 1, s - 1 != 0 && H.encode._updateFrame(e, t, r, o, s - 1, re, i), H.encode._updateFrame(e, t, r, o, s, re, i);
    }
  }
  var ee = 0;
  if (e.length != 1) for (var I = 0; I < o.length; I++) {
    var B = o[I];
    ee += B.rect.width * B.rect.height;
  }
  return o;
};
H.encode._updateFrame = function(e, t, r, n, i, a, o) {
  for (var s = Uint8Array, l = Uint32Array, u = new s(e[i - 1]), c = new l(e[i - 1]), f = i + 1 < e.length ? new s(e[i + 1]) : null, h = new s(e[i]), d = new l(h.buffer), p = t, v = r, y = -1, m = -1, S = 0; S < a.height; S++) for (var T = 0; T < a.width; T++) {
    var C = a.x + T, A = a.y + S, O = A * t + C, k = d[O];
    k == 0 || n[i - 1].dispose == 0 && c[O] == k && (f == null || f[O * 4 + 3] != 0) || (C < p && (p = C), C > y && (y = C), A < v && (v = A), A > m && (m = A));
  }
  y == -1 && (p = v = y = m = 0), o && ((p & 1) == 1 && p--, (v & 1) == 1 && v--), a = { x: p, y: v, width: y - p + 1, height: m - v + 1 };
  var M = n[i];
  M.rect = a, M.blend = 1, M.img = new Uint8Array(a.width * a.height * 4), n[i - 1].dispose == 0 ? (H._copyTile(u, t, r, M.img, a.width, a.height, -a.x, -a.y, 0), H.encode._prepareDiff(h, t, r, M.img, a)) : H._copyTile(h, t, r, M.img, a.width, a.height, -a.x, -a.y, 0);
};
H.encode._prepareDiff = function(e, t, r, n, i) {
  H._copyTile(e, t, r, n, i.width, i.height, -i.x, -i.y, 2);
};
H.encode._filterZero = function(e, t, r, n, i, a, o) {
  var s = [], l = [0, 1, 2, 3, 4];
  a != -1 ? l = [a] : (t * n > 5e5 || r == 1) && (l = [0]);
  var u;
  o && (u = { level: 0 });
  for (var c = o && UZIP != null ? UZIP : Ml, f = 0; f < l.length; f++) {
    for (var h = 0; h < t; h++) H.encode._filterLine(i, e, h, n, r, l[f]);
    s.push(c.deflate(i, u));
  }
  for (var d, p = 1e9, f = 0; f < s.length; f++) s[f].length < p && (d = f, p = s[f].length);
  return s[d];
};
H.encode._filterLine = function(e, t, r, n, i, a) {
  var o = r * n, s = o + r, l = H.decode._paeth;
  if (e[s] = a, s++, a == 0)
    if (n < 500) for (var u = 0; u < n; u++) e[s + u] = t[o + u];
    else e.set(new Uint8Array(t.buffer, o, n), s);
  else if (a == 1) {
    for (var u = 0; u < i; u++) e[s + u] = t[o + u];
    for (var u = i; u < n; u++) e[s + u] = t[o + u] - t[o + u - i] + 256 & 255;
  } else if (r == 0) {
    for (var u = 0; u < i; u++) e[s + u] = t[o + u];
    if (a == 2) for (var u = i; u < n; u++) e[s + u] = t[o + u];
    if (a == 3) for (var u = i; u < n; u++) e[s + u] = t[o + u] - (t[o + u - i] >> 1) + 256 & 255;
    if (a == 4) for (var u = i; u < n; u++) e[s + u] = t[o + u] - l(t[o + u - i], 0, 0) + 256 & 255;
  } else {
    if (a == 2)
      for (var u = 0; u < n; u++) e[s + u] = t[o + u] + 256 - t[o + u - n] & 255;
    if (a == 3) {
      for (var u = 0; u < i; u++) e[s + u] = t[o + u] + 256 - (t[o + u - n] >> 1) & 255;
      for (var u = i; u < n; u++) e[s + u] = t[o + u] + 256 - (t[o + u - n] + t[o + u - i] >> 1) & 255;
    }
    if (a == 4) {
      for (var u = 0; u < i; u++) e[s + u] = t[o + u] + 256 - l(0, t[o + u - n], 0) & 255;
      for (var u = i; u < n; u++) e[s + u] = t[o + u] + 256 - l(t[o + u - i], t[o + u - n], t[o + u - i - n]) & 255;
    }
  }
};
H.crc = {
  table: function() {
    for (var e = new Uint32Array(256), t = 0; t < 256; t++) {
      for (var r = t, n = 0; n < 8; n++)
        r & 1 ? r = 3988292384 ^ r >>> 1 : r = r >>> 1;
      e[t] = r;
    }
    return e;
  }(),
  update: function(e, t, r, n) {
    for (var i = 0; i < n; i++) e = H.crc.table[(e ^ t[r + i]) & 255] ^ e >>> 8;
    return e;
  },
  crc: function(e, t, r) {
    return H.crc.update(4294967295, e, t, r) ^ 4294967295;
  }
};
H.quantize = function(e, t) {
  var r = new Uint8Array(e), n = r.slice(0), i = new Uint32Array(n.buffer), a = H.quantize.getKDtree(n, t), o = a[0], s = a[1];
  H.quantize.planeDst;
  for (var l = r, u = i, c = l.length, f = new Uint8Array(r.length >> 2), h = 0; h < c; h += 4) {
    var d = l[h] * 0.00392156862745098, p = l[h + 1] * (1 / 255), v = l[h + 2] * (1 / 255), y = l[h + 3] * (1 / 255), m = H.quantize.getNearest(o, d, p, v, y);
    f[h >> 2] = m.ind, u[h >> 2] = m.est.rgba;
  }
  return { abuf: n.buffer, inds: f, plte: s };
};
H.quantize.getKDtree = function(e, t, r) {
  r == null && (r = 1e-4);
  var n = new Uint32Array(e.buffer), i = { i0: 0, i1: e.length, bst: null, est: null, tdst: 0, left: null, right: null };
  i.bst = H.quantize.stats(e, i.i0, i.i1), i.est = H.quantize.estats(i.bst);
  for (var a = [i]; a.length < t; ) {
    for (var o = 0, s = 0, l = 0; l < a.length; l++) a[l].est.L > o && (o = a[l].est.L, s = l);
    if (o < r) break;
    var u = a[s], c = H.quantize.splitPixels(e, n, u.i0, u.i1, u.est.e, u.est.eMq255), f = u.i0 >= c || u.i1 <= c;
    if (f) {
      u.est.L = 0;
      continue;
    }
    var h = { i0: u.i0, i1: c, bst: null, est: null, tdst: 0, left: null, right: null };
    h.bst = H.quantize.stats(e, h.i0, h.i1), h.est = H.quantize.estats(h.bst);
    var d = { i0: c, i1: u.i1, bst: null, est: null, tdst: 0, left: null, right: null };
    d.bst = { R: [], m: [], N: u.bst.N - h.bst.N };
    for (var l = 0; l < 16; l++) d.bst.R[l] = u.bst.R[l] - h.bst.R[l];
    for (var l = 0; l < 4; l++) d.bst.m[l] = u.bst.m[l] - h.bst.m[l];
    d.est = H.quantize.estats(d.bst), u.left = h, u.right = d, a[s] = h, a.push(d);
  }
  a.sort(function(p, v) {
    return v.bst.N - p.bst.N;
  });
  for (var l = 0; l < a.length; l++) a[l].ind = l;
  return [i, a];
};
H.quantize.getNearest = function(e, t, r, n, i) {
  if (e.left == null)
    return e.tdst = H.quantize.dist(e.est.q, t, r, n, i), e;
  var a = H.quantize.planeDst(e.est, t, r, n, i), o = e.left, s = e.right;
  a > 0 && (o = e.right, s = e.left);
  var l = H.quantize.getNearest(o, t, r, n, i);
  if (l.tdst <= a * a) return l;
  var u = H.quantize.getNearest(s, t, r, n, i);
  return u.tdst < l.tdst ? u : l;
};
H.quantize.planeDst = function(e, t, r, n, i) {
  var a = e.e;
  return a[0] * t + a[1] * r + a[2] * n + a[3] * i - e.eMq;
};
H.quantize.dist = function(e, t, r, n, i) {
  var a = t - e[0], o = r - e[1], s = n - e[2], l = i - e[3];
  return a * a + o * o + s * s + l * l;
};
H.quantize.splitPixels = function(e, t, r, n, i, a) {
  var o = H.quantize.vecDot;
  for (n -= 4; r < n; ) {
    for (; o(e, r, i) <= a; ) r += 4;
    for (; o(e, n, i) > a; ) n -= 4;
    if (r >= n) break;
    var s = t[r >> 2];
    t[r >> 2] = t[n >> 2], t[n >> 2] = s, r += 4, n -= 4;
  }
  for (; o(e, r, i) > a; ) r -= 4;
  return r + 4;
};
H.quantize.vecDot = function(e, t, r) {
  return e[t] * r[0] + e[t + 1] * r[1] + e[t + 2] * r[2] + e[t + 3] * r[3];
};
H.quantize.stats = function(e, t, r) {
  for (var n = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], i = [0, 0, 0, 0], a = r - t >> 2, o = t; o < r; o += 4) {
    var s = e[o] * 0.00392156862745098, l = e[o + 1] * (1 / 255), u = e[o + 2] * (1 / 255), c = e[o + 3] * (1 / 255);
    i[0] += s, i[1] += l, i[2] += u, i[3] += c, n[0] += s * s, n[1] += s * l, n[2] += s * u, n[3] += s * c, n[5] += l * l, n[6] += l * u, n[7] += l * c, n[10] += u * u, n[11] += u * c, n[15] += c * c;
  }
  return n[4] = n[1], n[8] = n[2], n[9] = n[6], n[12] = n[3], n[13] = n[7], n[14] = n[11], { R: n, m: i, N: a };
};
H.quantize.estats = function(e) {
  var t = e.R, r = e.m, n = e.N, i = r[0], a = r[1], o = r[2], s = r[3], l = n == 0 ? 0 : 1 / n, u = [
    t[0] - i * i * l,
    t[1] - i * a * l,
    t[2] - i * o * l,
    t[3] - i * s * l,
    t[4] - a * i * l,
    t[5] - a * a * l,
    t[6] - a * o * l,
    t[7] - a * s * l,
    t[8] - o * i * l,
    t[9] - o * a * l,
    t[10] - o * o * l,
    t[11] - o * s * l,
    t[12] - s * i * l,
    t[13] - s * a * l,
    t[14] - s * o * l,
    t[15] - s * s * l
  ], c = u, f = H.M4, h = [0.5, 0.5, 0.5, 0.5], d = 0, p = 0;
  if (n != 0)
    for (var v = 0; v < 10 && (h = f.multVec(c, h), p = Math.sqrt(f.dot(h, h)), h = f.sml(1 / p, h), !(Math.abs(p - d) < 1e-9)); v++)
      d = p;
  var y = [i * l, a * l, o * l, s * l], m = f.dot(f.sml(255, y), h);
  return {
    Cov: u,
    q: y,
    e: h,
    L: d,
    eMq255: m,
    eMq: f.dot(h, y),
    rgba: (Math.round(255 * y[3]) << 24 | Math.round(255 * y[2]) << 16 | Math.round(255 * y[1]) << 8 | Math.round(255 * y[0]) << 0) >>> 0
  };
};
H.M4 = {
  multVec: function(e, t) {
    return [
      e[0] * t[0] + e[1] * t[1] + e[2] * t[2] + e[3] * t[3],
      e[4] * t[0] + e[5] * t[1] + e[6] * t[2] + e[7] * t[3],
      e[8] * t[0] + e[9] * t[1] + e[10] * t[2] + e[11] * t[3],
      e[12] * t[0] + e[13] * t[1] + e[14] * t[2] + e[15] * t[3]
    ];
  },
  dot: function(e, t) {
    return e[0] * t[0] + e[1] * t[1] + e[2] * t[2] + e[3] * t[3];
  },
  sml: function(e, t) {
    return [e * t[0], e * t[1], e * t[2], e * t[3]];
  }
};
H.encode.concatRGBA = function(e) {
  for (var t = 0, r = 0; r < e.length; r++) t += e[r].byteLength;
  for (var n = new Uint8Array(t), i = 0, r = 0; r < e.length; r++) {
    for (var a = new Uint8Array(e[r]), o = a.length, s = 0; s < o; s += 4) {
      var l = a[s], u = a[s + 1], c = a[s + 2], f = a[s + 3];
      f == 0 && (l = u = c = 0), n[i + s] = l, n[i + s + 1] = u, n[i + s + 2] = c, n[i + s + 3] = f;
    }
    i += o;
  }
  return n.buffer;
};
var tk = function(e) {
  if (e === 0)
    return Nn.Greyscale;
  if (e === 2)
    return Nn.Truecolour;
  if (e === 3)
    return Nn.IndexedColour;
  if (e === 4)
    return Nn.GreyscaleWithAlpha;
  if (e === 6)
    return Nn.TruecolourWithAlpha;
  throw new Error("Unknown color type: " + e);
}, rk = function(e) {
  for (var t = Math.floor(e.length / 4), r = new Uint8Array(t * 3), n = new Uint8Array(t * 1), i = 0, a = 0, o = 0; i < e.length; )
    r[a++] = e[i++], r[a++] = e[i++], r[a++] = e[i++], n[o++] = e[i++];
  return { rgbChannel: r, alphaChannel: n };
}, Nn;
(function(e) {
  e.Greyscale = "Greyscale", e.Truecolour = "Truecolour", e.IndexedColour = "IndexedColour", e.GreyscaleWithAlpha = "GreyscaleWithAlpha", e.TruecolourWithAlpha = "TruecolourWithAlpha";
})(Nn || (Nn = {}));
var nk = (
  /** @class */
  function() {
    function e(t) {
      var r = H.decode(t), n = H.toRGBA8(r);
      if (n.length > 1)
        throw new Error("Animated PNGs are not supported");
      var i = new Uint8Array(n[0]), a = rk(i), o = a.rgbChannel, s = a.alphaChannel;
      this.rgbChannel = o;
      var l = s.some(function(u) {
        return u < 255;
      });
      l && (this.alphaChannel = s), this.type = tk(r.ctype), this.width = r.width, this.height = r.height, this.bitsPerComponent = 8;
    }
    return e.load = function(t) {
      return new e(t);
    }, e;
  }()
), sy = (
  /** @class */
  function() {
    function e(t) {
      this.image = t, this.bitsPerComponent = t.bitsPerComponent, this.width = t.width, this.height = t.height, this.colorSpace = "DeviceRGB";
    }
    return e.for = function(t) {
      return fe(this, void 0, void 0, function() {
        var r;
        return he(this, function(n) {
          return r = nk.load(t), [2, new e(r)];
        });
      });
    }, e.prototype.embedIntoContext = function(t, r) {
      return fe(this, void 0, void 0, function() {
        var n, i;
        return he(this, function(a) {
          return n = this.embedAlphaChannel(t), i = t.flateStream(this.image.rgbChannel, {
            Type: "XObject",
            Subtype: "Image",
            BitsPerComponent: this.image.bitsPerComponent,
            Width: this.image.width,
            Height: this.image.height,
            ColorSpace: this.colorSpace,
            SMask: n
          }), r ? (t.assign(r, i), [2, r]) : [2, t.register(i)];
        });
      });
    }, e.prototype.embedAlphaChannel = function(t) {
      if (this.image.alphaChannel) {
        var r = t.flateStream(this.image.alphaChannel, {
          Type: "XObject",
          Subtype: "Image",
          Height: this.image.height,
          Width: this.image.width,
          BitsPerComponent: this.image.bitsPerComponent,
          ColorSpace: "DeviceGray",
          Decode: [0, 1]
        });
        return t.register(r);
      }
    }, e;
  }()
), ly = (
  /** @class */
  function() {
    function e(t, r, n) {
      this.bytes = t, this.start = r || 0, this.pos = this.start, this.end = r && n ? r + n : this.bytes.length;
    }
    return Object.defineProperty(e.prototype, "length", {
      get: function() {
        return this.end - this.start;
      },
      enumerable: !1,
      configurable: !0
    }), Object.defineProperty(e.prototype, "isEmpty", {
      get: function() {
        return this.length === 0;
      },
      enumerable: !1,
      configurable: !0
    }), e.prototype.getByte = function() {
      return this.pos >= this.end ? -1 : this.bytes[this.pos++];
    }, e.prototype.getUint16 = function() {
      var t = this.getByte(), r = this.getByte();
      return t === -1 || r === -1 ? -1 : (t << 8) + r;
    }, e.prototype.getInt32 = function() {
      var t = this.getByte(), r = this.getByte(), n = this.getByte(), i = this.getByte();
      return (t << 24) + (r << 16) + (n << 8) + i;
    }, e.prototype.getBytes = function(t, r) {
      r === void 0 && (r = !1);
      var n = this.bytes, i = this.pos, a = this.end;
      if (t) {
        var s = i + t;
        s > a && (s = a), this.pos = s;
        var o = n.subarray(i, s);
        return r ? new Uint8ClampedArray(o) : o;
      } else {
        var o = n.subarray(i, a);
        return r ? new Uint8ClampedArray(o) : o;
      }
    }, e.prototype.peekByte = function() {
      var t = this.getByte();
      return this.pos--, t;
    }, e.prototype.peekBytes = function(t, r) {
      r === void 0 && (r = !1);
      var n = this.getBytes(t, r);
      return this.pos -= n.length, n;
    }, e.prototype.skip = function(t) {
      t || (t = 1), this.pos += t;
    }, e.prototype.reset = function() {
      this.pos = this.start;
    }, e.prototype.moveStart = function() {
      this.start = this.pos;
    }, e.prototype.makeSubStream = function(t, r) {
      return new e(this.bytes, t, r);
    }, e.prototype.decode = function() {
      return this.bytes;
    }, e;
  }()
), ik = new Uint8Array(0), Po = (
  /** @class */
  function() {
    function e(t) {
      if (this.pos = 0, this.bufferLength = 0, this.eof = !1, this.buffer = ik, this.minBufferLength = 512, t)
        for (; this.minBufferLength < t; )
          this.minBufferLength *= 2;
    }
    return Object.defineProperty(e.prototype, "isEmpty", {
      get: function() {
        for (; !this.eof && this.bufferLength === 0; )
          this.readBlock();
        return this.bufferLength === 0;
      },
      enumerable: !1,
      configurable: !0
    }), e.prototype.getByte = function() {
      for (var t = this.pos; this.bufferLength <= t; ) {
        if (this.eof)
          return -1;
        this.readBlock();
      }
      return this.buffer[this.pos++];
    }, e.prototype.getUint16 = function() {
      var t = this.getByte(), r = this.getByte();
      return t === -1 || r === -1 ? -1 : (t << 8) + r;
    }, e.prototype.getInt32 = function() {
      var t = this.getByte(), r = this.getByte(), n = this.getByte(), i = this.getByte();
      return (t << 24) + (r << 16) + (n << 8) + i;
    }, e.prototype.getBytes = function(t, r) {
      r === void 0 && (r = !1);
      var n, i = this.pos;
      if (t) {
        for (this.ensureBuffer(i + t), n = i + t; !this.eof && this.bufferLength < n; )
          this.readBlock();
        var a = this.bufferLength;
        n > a && (n = a);
      } else {
        for (; !this.eof; )
          this.readBlock();
        n = this.bufferLength;
      }
      this.pos = n;
      var o = this.buffer.subarray(i, n);
      return r && !(o instanceof Uint8ClampedArray) ? new Uint8ClampedArray(o) : o;
    }, e.prototype.peekByte = function() {
      var t = this.getByte();
      return this.pos--, t;
    }, e.prototype.peekBytes = function(t, r) {
      r === void 0 && (r = !1);
      var n = this.getBytes(t, r);
      return this.pos -= n.length, n;
    }, e.prototype.skip = function(t) {
      t || (t = 1), this.pos += t;
    }, e.prototype.reset = function() {
      this.pos = 0;
    }, e.prototype.makeSubStream = function(t, r) {
      for (var n = t + r; this.bufferLength <= n && !this.eof; )
        this.readBlock();
      return new ly(
        this.buffer,
        t,
        r
        /* dict */
      );
    }, e.prototype.decode = function() {
      for (; !this.eof; )
        this.readBlock();
      return this.buffer.subarray(0, this.bufferLength);
    }, e.prototype.readBlock = function() {
      throw new Gt(this.constructor.name, "readBlock");
    }, e.prototype.ensureBuffer = function(t) {
      var r = this.buffer;
      if (t <= r.byteLength)
        return r;
      for (var n = this.minBufferLength; n < t; )
        n *= 2;
      var i = new Uint8Array(n);
      return i.set(r), this.buffer = i;
    }, e;
  }()
), xp = function(e) {
  return e === 32 || e === 9 || e === 13 || e === 10;
}, ak = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = e.call(this, n) || this;
      return i.stream = r, i.input = new Uint8Array(5), n && (n = 0.8 * n), i;
    }
    return t.prototype.readBlock = function() {
      for (var r = 126, n = 122, i = -1, a = this.stream, o = a.getByte(); xp(o); )
        o = a.getByte();
      if (o === i || o === r) {
        this.eof = !0;
        return;
      }
      var s = this.bufferLength, l, u;
      if (o === n) {
        for (l = this.ensureBuffer(s + 4), u = 0; u < 4; ++u)
          l[s + u] = 0;
        this.bufferLength += 4;
      } else {
        var c = this.input;
        for (c[0] = o, u = 1; u < 5; ++u) {
          for (o = a.getByte(); xp(o); )
            o = a.getByte();
          if (c[u] = o, o === i || o === r)
            break;
        }
        if (l = this.ensureBuffer(s + u - 1), this.bufferLength += u - 1, u < 5) {
          for (; u < 5; ++u)
            c[u] = 117;
          this.eof = !0;
        }
        var f = 0;
        for (u = 0; u < 5; ++u)
          f = f * 85 + (c[u] - 33);
        for (u = 3; u >= 0; --u)
          l[s + u] = f & 255, f >>= 8;
      }
    }, t;
  }(Po)
), ok = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = e.call(this, n) || this;
      return i.stream = r, i.firstDigit = -1, n && (n = 0.5 * n), i;
    }
    return t.prototype.readBlock = function() {
      var r = 8e3, n = this.stream.getBytes(r);
      if (!n.length) {
        this.eof = !0;
        return;
      }
      for (var i = n.length + 1 >> 1, a = this.ensureBuffer(this.bufferLength + i), o = this.bufferLength, s = this.firstDigit, l = 0, u = n.length; l < u; l++) {
        var c = n[l], f = void 0;
        if (c >= 48 && c <= 57)
          f = c & 15;
        else if (c >= 65 && c <= 70 || c >= 97 && c <= 102)
          f = (c & 15) + 9;
        else if (c === 62) {
          this.eof = !0;
          break;
        } else
          continue;
        s < 0 ? s = f : (a[o++] = s << 4 | f, s = -1);
      }
      s >= 0 && this.eof && (a[o++] = s << 4, s = -1), this.firstDigit = s, this.bufferLength = o;
    }, t;
  }(Po)
), Ep = new Int32Array([
  16,
  17,
  18,
  0,
  8,
  7,
  9,
  6,
  10,
  5,
  11,
  4,
  12,
  3,
  13,
  2,
  14,
  1,
  15
]), sk = new Int32Array([
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  65547,
  65549,
  65551,
  65553,
  131091,
  131095,
  131099,
  131103,
  196643,
  196651,
  196659,
  196667,
  262211,
  262227,
  262243,
  262259,
  327811,
  327843,
  327875,
  327907,
  258,
  258,
  258
]), lk = new Int32Array([
  1,
  2,
  3,
  4,
  65541,
  65543,
  131081,
  131085,
  196625,
  196633,
  262177,
  262193,
  327745,
  327777,
  393345,
  393409,
  459009,
  459137,
  524801,
  525057,
  590849,
  591361,
  657409,
  658433,
  724993,
  727041,
  794625,
  798721,
  868353,
  876545
]), uk = [new Int32Array([
  459008,
  524368,
  524304,
  524568,
  459024,
  524400,
  524336,
  590016,
  459016,
  524384,
  524320,
  589984,
  524288,
  524416,
  524352,
  590048,
  459012,
  524376,
  524312,
  589968,
  459028,
  524408,
  524344,
  590032,
  459020,
  524392,
  524328,
  59e4,
  524296,
  524424,
  524360,
  590064,
  459010,
  524372,
  524308,
  524572,
  459026,
  524404,
  524340,
  590024,
  459018,
  524388,
  524324,
  589992,
  524292,
  524420,
  524356,
  590056,
  459014,
  524380,
  524316,
  589976,
  459030,
  524412,
  524348,
  590040,
  459022,
  524396,
  524332,
  590008,
  524300,
  524428,
  524364,
  590072,
  459009,
  524370,
  524306,
  524570,
  459025,
  524402,
  524338,
  590020,
  459017,
  524386,
  524322,
  589988,
  524290,
  524418,
  524354,
  590052,
  459013,
  524378,
  524314,
  589972,
  459029,
  524410,
  524346,
  590036,
  459021,
  524394,
  524330,
  590004,
  524298,
  524426,
  524362,
  590068,
  459011,
  524374,
  524310,
  524574,
  459027,
  524406,
  524342,
  590028,
  459019,
  524390,
  524326,
  589996,
  524294,
  524422,
  524358,
  590060,
  459015,
  524382,
  524318,
  589980,
  459031,
  524414,
  524350,
  590044,
  459023,
  524398,
  524334,
  590012,
  524302,
  524430,
  524366,
  590076,
  459008,
  524369,
  524305,
  524569,
  459024,
  524401,
  524337,
  590018,
  459016,
  524385,
  524321,
  589986,
  524289,
  524417,
  524353,
  590050,
  459012,
  524377,
  524313,
  589970,
  459028,
  524409,
  524345,
  590034,
  459020,
  524393,
  524329,
  590002,
  524297,
  524425,
  524361,
  590066,
  459010,
  524373,
  524309,
  524573,
  459026,
  524405,
  524341,
  590026,
  459018,
  524389,
  524325,
  589994,
  524293,
  524421,
  524357,
  590058,
  459014,
  524381,
  524317,
  589978,
  459030,
  524413,
  524349,
  590042,
  459022,
  524397,
  524333,
  590010,
  524301,
  524429,
  524365,
  590074,
  459009,
  524371,
  524307,
  524571,
  459025,
  524403,
  524339,
  590022,
  459017,
  524387,
  524323,
  589990,
  524291,
  524419,
  524355,
  590054,
  459013,
  524379,
  524315,
  589974,
  459029,
  524411,
  524347,
  590038,
  459021,
  524395,
  524331,
  590006,
  524299,
  524427,
  524363,
  590070,
  459011,
  524375,
  524311,
  524575,
  459027,
  524407,
  524343,
  590030,
  459019,
  524391,
  524327,
  589998,
  524295,
  524423,
  524359,
  590062,
  459015,
  524383,
  524319,
  589982,
  459031,
  524415,
  524351,
  590046,
  459023,
  524399,
  524335,
  590014,
  524303,
  524431,
  524367,
  590078,
  459008,
  524368,
  524304,
  524568,
  459024,
  524400,
  524336,
  590017,
  459016,
  524384,
  524320,
  589985,
  524288,
  524416,
  524352,
  590049,
  459012,
  524376,
  524312,
  589969,
  459028,
  524408,
  524344,
  590033,
  459020,
  524392,
  524328,
  590001,
  524296,
  524424,
  524360,
  590065,
  459010,
  524372,
  524308,
  524572,
  459026,
  524404,
  524340,
  590025,
  459018,
  524388,
  524324,
  589993,
  524292,
  524420,
  524356,
  590057,
  459014,
  524380,
  524316,
  589977,
  459030,
  524412,
  524348,
  590041,
  459022,
  524396,
  524332,
  590009,
  524300,
  524428,
  524364,
  590073,
  459009,
  524370,
  524306,
  524570,
  459025,
  524402,
  524338,
  590021,
  459017,
  524386,
  524322,
  589989,
  524290,
  524418,
  524354,
  590053,
  459013,
  524378,
  524314,
  589973,
  459029,
  524410,
  524346,
  590037,
  459021,
  524394,
  524330,
  590005,
  524298,
  524426,
  524362,
  590069,
  459011,
  524374,
  524310,
  524574,
  459027,
  524406,
  524342,
  590029,
  459019,
  524390,
  524326,
  589997,
  524294,
  524422,
  524358,
  590061,
  459015,
  524382,
  524318,
  589981,
  459031,
  524414,
  524350,
  590045,
  459023,
  524398,
  524334,
  590013,
  524302,
  524430,
  524366,
  590077,
  459008,
  524369,
  524305,
  524569,
  459024,
  524401,
  524337,
  590019,
  459016,
  524385,
  524321,
  589987,
  524289,
  524417,
  524353,
  590051,
  459012,
  524377,
  524313,
  589971,
  459028,
  524409,
  524345,
  590035,
  459020,
  524393,
  524329,
  590003,
  524297,
  524425,
  524361,
  590067,
  459010,
  524373,
  524309,
  524573,
  459026,
  524405,
  524341,
  590027,
  459018,
  524389,
  524325,
  589995,
  524293,
  524421,
  524357,
  590059,
  459014,
  524381,
  524317,
  589979,
  459030,
  524413,
  524349,
  590043,
  459022,
  524397,
  524333,
  590011,
  524301,
  524429,
  524365,
  590075,
  459009,
  524371,
  524307,
  524571,
  459025,
  524403,
  524339,
  590023,
  459017,
  524387,
  524323,
  589991,
  524291,
  524419,
  524355,
  590055,
  459013,
  524379,
  524315,
  589975,
  459029,
  524411,
  524347,
  590039,
  459021,
  524395,
  524331,
  590007,
  524299,
  524427,
  524363,
  590071,
  459011,
  524375,
  524311,
  524575,
  459027,
  524407,
  524343,
  590031,
  459019,
  524391,
  524327,
  589999,
  524295,
  524423,
  524359,
  590063,
  459015,
  524383,
  524319,
  589983,
  459031,
  524415,
  524351,
  590047,
  459023,
  524399,
  524335,
  590015,
  524303,
  524431,
  524367,
  590079
]), 9], ck = [new Int32Array([
  327680,
  327696,
  327688,
  327704,
  327684,
  327700,
  327692,
  327708,
  327682,
  327698,
  327690,
  327706,
  327686,
  327702,
  327694,
  0,
  327681,
  327697,
  327689,
  327705,
  327685,
  327701,
  327693,
  327709,
  327683,
  327699,
  327691,
  327707,
  327687,
  327703,
  327695,
  0
]), 5], fk = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = e.call(this, n) || this;
      i.stream = r;
      var a = r.getByte(), o = r.getByte();
      if (a === -1 || o === -1)
        throw new Error("Invalid header in flate stream: " + a + ", " + o);
      if ((a & 15) !== 8)
        throw new Error("Unknown compression method in flate stream: " + a + ", " + o);
      if (((a << 8) + o) % 31 !== 0)
        throw new Error("Bad FCHECK in flate stream: " + a + ", " + o);
      if (o & 32)
        throw new Error("FDICT bit set in flate stream: " + a + ", " + o);
      return i.codeSize = 0, i.codeBuf = 0, i;
    }
    return t.prototype.readBlock = function() {
      var r, n, i = this.stream, a = this.getBits(3);
      if (a & 1 && (this.eof = !0), a >>= 1, a === 0) {
        var o = void 0;
        if ((o = i.getByte()) === -1)
          throw new Error("Bad block header in flate stream");
        var s = o;
        if ((o = i.getByte()) === -1)
          throw new Error("Bad block header in flate stream");
        if (s |= o << 8, (o = i.getByte()) === -1)
          throw new Error("Bad block header in flate stream");
        var l = o;
        if ((o = i.getByte()) === -1)
          throw new Error("Bad block header in flate stream");
        if (l |= o << 8, l !== (~s & 65535) && (s !== 0 || l !== 0))
          throw new Error("Bad uncompressed block length in flate stream");
        this.codeBuf = 0, this.codeSize = 0;
        var u = this.bufferLength;
        r = this.ensureBuffer(u + s);
        var c = u + s;
        if (this.bufferLength = c, s === 0)
          i.peekByte() === -1 && (this.eof = !0);
        else
          for (var f = u; f < c; ++f) {
            if ((o = i.getByte()) === -1) {
              this.eof = !0;
              break;
            }
            r[f] = o;
          }
        return;
      }
      var h, d;
      if (a === 1)
        h = uk, d = ck;
      else if (a === 2) {
        var p = this.getBits(5) + 257, v = this.getBits(5) + 1, y = this.getBits(4) + 4, m = new Uint8Array(Ep.length), S = void 0;
        for (S = 0; S < y; ++S)
          m[Ep[S]] = this.getBits(3);
        var T = this.generateHuffmanTable(m);
        n = 0, S = 0;
        for (var C = p + v, A = new Uint8Array(C), O = void 0, k = void 0, M = void 0; S < C; ) {
          var b = this.getCode(T);
          if (b === 16)
            O = 2, k = 3, M = n;
          else if (b === 17)
            O = 3, k = 3, M = n = 0;
          else if (b === 18)
            O = 7, k = 11, M = n = 0;
          else {
            A[S++] = n = b;
            continue;
          }
          for (var j = this.getBits(O) + k; j-- > 0; )
            A[S++] = M;
        }
        h = this.generateHuffmanTable(A.subarray(0, p)), d = this.generateHuffmanTable(A.subarray(p, C));
      } else
        throw new Error("Unknown block type in flate stream");
      r = this.buffer;
      for (var I = r ? r.length : 0, q = this.bufferLength; ; ) {
        var z = this.getCode(h);
        if (z < 256) {
          q + 1 >= I && (r = this.ensureBuffer(q + 1), I = r.length), r[q++] = z;
          continue;
        }
        if (z === 256) {
          this.bufferLength = q;
          return;
        }
        z -= 257, z = sk[z];
        var B = z >> 16;
        B > 0 && (B = this.getBits(B)), n = (z & 65535) + B, z = this.getCode(d), z = lk[z], B = z >> 16, B > 0 && (B = this.getBits(B));
        var N = (z & 65535) + B;
        q + n >= I && (r = this.ensureBuffer(q + n), I = r.length);
        for (var L = 0; L < n; ++L, ++q)
          r[q] = r[q - N];
      }
    }, t.prototype.getBits = function(r) {
      for (var n = this.stream, i = this.codeSize, a = this.codeBuf, o; i < r; ) {
        if ((o = n.getByte()) === -1)
          throw new Error("Bad encoding in flate stream");
        a |= o << i, i += 8;
      }
      return o = a & (1 << r) - 1, this.codeBuf = a >> r, this.codeSize = i -= r, o;
    }, t.prototype.getCode = function(r) {
      for (var n = this.stream, i = r[0], a = r[1], o = this.codeSize, s = this.codeBuf, l; o < a && (l = n.getByte()) !== -1; )
        s |= l << o, o += 8;
      var u = i[s & (1 << a) - 1];
      typeof i == "number" && console.log("FLATE:", u);
      var c = u >> 16, f = u & 65535;
      if (c < 1 || o < c)
        throw new Error("Bad encoding in flate stream");
      return this.codeBuf = s >> c, this.codeSize = o - c, f;
    }, t.prototype.generateHuffmanTable = function(r) {
      var n = r.length, i = 0, a;
      for (a = 0; a < n; ++a)
        r[a] > i && (i = r[a]);
      for (var o = 1 << i, s = new Int32Array(o), l = 1, u = 0, c = 2; l <= i; ++l, u <<= 1, c <<= 1)
        for (var f = 0; f < n; ++f)
          if (r[f] === l) {
            var h = 0, d = u;
            for (a = 0; a < l; ++a)
              h = h << 1 | d & 1, d >>= 1;
            for (a = h; a < o; a += c)
              s[a] = l << 16 | f;
            ++u;
          }
      return [s, i];
    }, t;
  }(Po)
), hk = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      var a = e.call(this, n) || this;
      a.stream = r, a.cachedData = 0, a.bitsCached = 0;
      for (var o = 4096, s = {
        earlyChange: i,
        codeLength: 9,
        nextCode: 258,
        dictionaryValues: new Uint8Array(o),
        dictionaryLengths: new Uint16Array(o),
        dictionaryPrevCodes: new Uint16Array(o),
        currentSequence: new Uint8Array(o),
        currentSequenceLength: 0
      }, l = 0; l < 256; ++l)
        s.dictionaryValues[l] = l, s.dictionaryLengths[l] = 1;
      return a.lzwState = s, a;
    }
    return t.prototype.readBlock = function() {
      var r = 512, n = r * 2, i = r, a, o, s, l = this.lzwState;
      if (l) {
        var u = l.earlyChange, c = l.nextCode, f = l.dictionaryValues, h = l.dictionaryLengths, d = l.dictionaryPrevCodes, p = l.codeLength, v = l.prevCode, y = l.currentSequence, m = l.currentSequenceLength, S = 0, T = this.bufferLength, C = this.ensureBuffer(this.bufferLength + n);
        for (a = 0; a < r; a++) {
          var A = this.readBits(p), O = m > 0;
          if (!A || A < 256)
            y[0] = A, m = 1;
          else if (A >= 258)
            if (A < c)
              for (m = h[A], o = m - 1, s = A; o >= 0; o--)
                y[o] = f[s], s = d[s];
            else
              y[m++] = y[0];
          else if (A === 256) {
            p = 9, c = 258, m = 0;
            continue;
          } else {
            this.eof = !0, delete this.lzwState;
            break;
          }
          if (O && (d[c] = v, h[c] = h[v] + 1, f[c] = y[0], c++, p = c + u & c + u - 1 ? p : Math.min(Math.log(c + u) / 0.6931471805599453 + 1, 12) | 0), v = A, S += m, n < S) {
            do
              n += i;
            while (n < S);
            C = this.ensureBuffer(this.bufferLength + n);
          }
          for (o = 0; o < m; o++)
            C[T++] = y[o];
        }
        l.nextCode = c, l.codeLength = p, l.prevCode = v, l.currentSequenceLength = m, this.bufferLength = T;
      }
    }, t.prototype.readBits = function(r) {
      for (var n = this.bitsCached, i = this.cachedData; n < r; ) {
        var a = this.stream.getByte();
        if (a === -1)
          return this.eof = !0, null;
        i = i << 8 | a, n += 8;
      }
      return this.bitsCached = n -= r, this.cachedData = i, i >>> n & (1 << r) - 1;
    }, t;
  }(Po)
), dk = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = e.call(this, n) || this;
      return i.stream = r, i;
    }
    return t.prototype.readBlock = function() {
      var r = this.stream.getBytes(2);
      if (!r || r.length < 2 || r[0] === 128) {
        this.eof = !0;
        return;
      }
      var n, i = this.bufferLength, a = r[0];
      if (a < 128) {
        if (n = this.ensureBuffer(i + a + 1), n[i++] = r[1], a > 0) {
          var o = this.stream.getBytes(a);
          n.set(o, i), i += a;
        }
      } else {
        a = 257 - a;
        var s = r[1];
        n = this.ensureBuffer(i + a + 1);
        for (var l = 0; l < a; l++)
          n[i++] = s;
      }
      this.bufferLength = i;
    }, t;
  }(Po)
), Sp = function(e, t, r) {
  if (t === x.of("FlateDecode"))
    return new fk(e);
  if (t === x.of("LZWDecode")) {
    var n = 1;
    if (r instanceof ce) {
      var i = r.lookup(x.of("EarlyChange"));
      i instanceof ae && (n = i.asNumber());
    }
    return new hk(e, void 0, n);
  }
  if (t === x.of("ASCII85Decode"))
    return new ak(e);
  if (t === x.of("ASCIIHexDecode"))
    return new ok(e);
  if (t === x.of("RunLengthDecode"))
    return new dk(e);
  throw new ED(t.asString());
}, uy = function(e) {
  var t = e.dict, r = e.contents, n = new ly(r), i = t.lookup(x.of("Filter")), a = t.lookup(x.of("DecodeParms"));
  if (i instanceof x)
    n = Sp(n, i, a);
  else if (i instanceof Ee)
    for (var o = 0, s = i.size(); o < s; o++)
      n = Sp(n, i.lookup(o, x), a && a.lookupMaybe(o, ce));
  else if (i)
    throw new Js([x, Ee], i);
  return n;
}, pk = function(e) {
  var t = e.MediaBox(), r = t.lookup(2, ae).asNumber() - t.lookup(0, ae).asNumber(), n = t.lookup(3, ae).asNumber() - t.lookup(1, ae).asNumber();
  return { left: 0, bottom: 0, right: r, top: n };
}, vk = function(e) {
  return [1, 0, 0, 1, -e.left, -e.bottom];
}, cy = (
  /** @class */
  function() {
    function e(t, r, n) {
      this.page = t;
      var i = r ?? pk(t);
      this.width = i.right - i.left, this.height = i.top - i.bottom, this.boundingBox = i, this.transformationMatrix = n ?? vk(i);
    }
    return e.for = function(t, r, n) {
      return fe(this, void 0, void 0, function() {
        return he(this, function(i) {
          return [2, new e(t, r, n)];
        });
      });
    }, e.prototype.embedIntoContext = function(t, r) {
      return fe(this, void 0, void 0, function() {
        var n, i, a, o, s, l, u, c, f, h;
        return he(this, function(d) {
          if (n = this.page.normalizedEntries(), i = n.Contents, a = n.Resources, !i)
            throw new SD();
          return o = this.decodeContents(i), s = this.boundingBox, l = s.left, u = s.bottom, c = s.right, f = s.top, h = t.flateStream(o, {
            Type: "XObject",
            Subtype: "Form",
            FormType: 1,
            BBox: [l, u, c, f],
            Matrix: this.transformationMatrix,
            Resources: a
          }), r ? (t.assign(r, h), [2, r]) : [2, t.register(h)];
        });
      });
    }, e.prototype.decodeContents = function(t) {
      for (var r = Uint8Array.of(E.Newline), n = [], i = 0, a = t.size(); i < a; i++) {
        var o = t.lookup(i, Mt), s = void 0;
        if (o instanceof ao)
          s = uy(o).decode();
        else if (o instanceof Da)
          s = o.getUnencodedContents();
        else
          throw new FD(o);
        n.push(s, r);
      }
      return zR.apply(void 0, n);
    }, e;
  }()
), vs = function(e, t) {
  if (e !== void 0)
    return t[e];
}, ka;
(function(e) {
  e.UseNone = "UseNone", e.UseOutlines = "UseOutlines", e.UseThumbs = "UseThumbs", e.UseOC = "UseOC";
})(ka || (ka = {}));
var Na;
(function(e) {
  e.L2R = "L2R", e.R2L = "R2L";
})(Na || (Na = {}));
var Ia;
(function(e) {
  e.None = "None", e.AppDefault = "AppDefault";
})(Ia || (Ia = {}));
var el;
(function(e) {
  e.Simplex = "Simplex", e.DuplexFlipShortEdge = "DuplexFlipShortEdge", e.DuplexFlipLongEdge = "DuplexFlipLongEdge";
})(el || (el = {}));
var Fp = (
  /** @class */
  function() {
    function e(t) {
      this.dict = t;
    }
    return e.prototype.lookupBool = function(t) {
      var r = this.dict.lookup(x.of(t));
      if (r instanceof io)
        return r;
    }, e.prototype.lookupName = function(t) {
      var r = this.dict.lookup(x.of(t));
      if (r instanceof x)
        return r;
    }, e.prototype.HideToolbar = function() {
      return this.lookupBool("HideToolbar");
    }, e.prototype.HideMenubar = function() {
      return this.lookupBool("HideMenubar");
    }, e.prototype.HideWindowUI = function() {
      return this.lookupBool("HideWindowUI");
    }, e.prototype.FitWindow = function() {
      return this.lookupBool("FitWindow");
    }, e.prototype.CenterWindow = function() {
      return this.lookupBool("CenterWindow");
    }, e.prototype.DisplayDocTitle = function() {
      return this.lookupBool("DisplayDocTitle");
    }, e.prototype.NonFullScreenPageMode = function() {
      return this.lookupName("NonFullScreenPageMode");
    }, e.prototype.Direction = function() {
      return this.lookupName("Direction");
    }, e.prototype.PrintScaling = function() {
      return this.lookupName("PrintScaling");
    }, e.prototype.Duplex = function() {
      return this.lookupName("Duplex");
    }, e.prototype.PickTrayByPDFSize = function() {
      return this.lookupBool("PickTrayByPDFSize");
    }, e.prototype.PrintPageRange = function() {
      var t = this.dict.lookup(x.of("PrintPageRange"));
      if (t instanceof Ee)
        return t;
    }, e.prototype.NumCopies = function() {
      var t = this.dict.lookup(x.of("NumCopies"));
      if (t instanceof ae)
        return t;
    }, e.prototype.getHideToolbar = function() {
      var t, r;
      return (r = (t = this.HideToolbar()) === null || t === void 0 ? void 0 : t.asBoolean()) !== null && r !== void 0 ? r : !1;
    }, e.prototype.getHideMenubar = function() {
      var t, r;
      return (r = (t = this.HideMenubar()) === null || t === void 0 ? void 0 : t.asBoolean()) !== null && r !== void 0 ? r : !1;
    }, e.prototype.getHideWindowUI = function() {
      var t, r;
      return (r = (t = this.HideWindowUI()) === null || t === void 0 ? void 0 : t.asBoolean()) !== null && r !== void 0 ? r : !1;
    }, e.prototype.getFitWindow = function() {
      var t, r;
      return (r = (t = this.FitWindow()) === null || t === void 0 ? void 0 : t.asBoolean()) !== null && r !== void 0 ? r : !1;
    }, e.prototype.getCenterWindow = function() {
      var t, r;
      return (r = (t = this.CenterWindow()) === null || t === void 0 ? void 0 : t.asBoolean()) !== null && r !== void 0 ? r : !1;
    }, e.prototype.getDisplayDocTitle = function() {
      var t, r;
      return (r = (t = this.DisplayDocTitle()) === null || t === void 0 ? void 0 : t.asBoolean()) !== null && r !== void 0 ? r : !1;
    }, e.prototype.getNonFullScreenPageMode = function() {
      var t, r, n = (t = this.NonFullScreenPageMode()) === null || t === void 0 ? void 0 : t.decodeText();
      return (r = vs(n, ka)) !== null && r !== void 0 ? r : ka.UseNone;
    }, e.prototype.getReadingDirection = function() {
      var t, r, n = (t = this.Direction()) === null || t === void 0 ? void 0 : t.decodeText();
      return (r = vs(n, Na)) !== null && r !== void 0 ? r : Na.L2R;
    }, e.prototype.getPrintScaling = function() {
      var t, r, n = (t = this.PrintScaling()) === null || t === void 0 ? void 0 : t.decodeText();
      return (r = vs(n, Ia)) !== null && r !== void 0 ? r : Ia.AppDefault;
    }, e.prototype.getDuplex = function() {
      var t, r = (t = this.Duplex()) === null || t === void 0 ? void 0 : t.decodeText();
      return vs(r, el);
    }, e.prototype.getPickTrayByPDFSize = function() {
      var t;
      return (t = this.PickTrayByPDFSize()) === null || t === void 0 ? void 0 : t.asBoolean();
    }, e.prototype.getPrintPageRange = function() {
      var t = this.PrintPageRange();
      if (!t)
        return [];
      for (var r = [], n = 0; n < t.size(); n += 2) {
        var i = t.lookup(n, ae).asNumber(), a = t.lookup(n + 1, ae).asNumber();
        r.push({ start: i, end: a });
      }
      return r;
    }, e.prototype.getNumCopies = function() {
      var t, r;
      return (r = (t = this.NumCopies()) === null || t === void 0 ? void 0 : t.asNumber()) !== null && r !== void 0 ? r : 1;
    }, e.prototype.setHideToolbar = function(t) {
      var r = this.dict.context.obj(t);
      this.dict.set(x.of("HideToolbar"), r);
    }, e.prototype.setHideMenubar = function(t) {
      var r = this.dict.context.obj(t);
      this.dict.set(x.of("HideMenubar"), r);
    }, e.prototype.setHideWindowUI = function(t) {
      var r = this.dict.context.obj(t);
      this.dict.set(x.of("HideWindowUI"), r);
    }, e.prototype.setFitWindow = function(t) {
      var r = this.dict.context.obj(t);
      this.dict.set(x.of("FitWindow"), r);
    }, e.prototype.setCenterWindow = function(t) {
      var r = this.dict.context.obj(t);
      this.dict.set(x.of("CenterWindow"), r);
    }, e.prototype.setDisplayDocTitle = function(t) {
      var r = this.dict.context.obj(t);
      this.dict.set(x.of("DisplayDocTitle"), r);
    }, e.prototype.setNonFullScreenPageMode = function(t) {
      nn(t, "nonFullScreenPageMode", ka);
      var r = x.of(t);
      this.dict.set(x.of("NonFullScreenPageMode"), r);
    }, e.prototype.setReadingDirection = function(t) {
      nn(t, "readingDirection", Na);
      var r = x.of(t);
      this.dict.set(x.of("Direction"), r);
    }, e.prototype.setPrintScaling = function(t) {
      nn(t, "printScaling", Ia);
      var r = x.of(t);
      this.dict.set(x.of("PrintScaling"), r);
    }, e.prototype.setDuplex = function(t) {
      nn(t, "duplex", el);
      var r = x.of(t);
      this.dict.set(x.of("Duplex"), r);
    }, e.prototype.setPickTrayByPDFSize = function(t) {
      var r = this.dict.context.obj(t);
      this.dict.set(x.of("PickTrayByPDFSize"), r);
    }, e.prototype.setPrintPageRange = function(t) {
      Array.isArray(t) || (t = [t]);
      for (var r = [], n = 0, i = t.length; n < i; n++)
        r.push(t[n].start), r.push(t[n].end);
      Qm(r, "printPageRange", ["number"]);
      var a = this.dict.context.obj(r);
      this.dict.set(x.of("PrintPageRange"), a);
    }, e.prototype.setNumCopies = function(t) {
      Lt(t, "numCopies", 1, Number.MAX_VALUE), xD(t, "numCopies");
      var r = this.dict.context.obj(t);
      this.dict.set(x.of("NumCopies"), r);
    }, e.fromDict = function(t) {
      return new e(t);
    }, e.create = function(t) {
      var r = t.obj({});
      return new e(r);
    }, e;
  }()
), gk = /\/([^\0\t\n\f\r\ ]+)[\0\t\n\f\r\ ]*(\d*\.\d+|\d+)?[\0\t\n\f\r\ ]+Tf/, fy = (
  /** @class */
  function() {
    function e(t, r) {
      this.dict = t, this.ref = r;
    }
    return e.prototype.T = function() {
      return this.dict.lookupMaybe(x.of("T"), Pe, ne);
    }, e.prototype.Ff = function() {
      var t = this.getInheritableAttribute(x.of("Ff"));
      return this.dict.context.lookupMaybe(t, ae);
    }, e.prototype.V = function() {
      var t = this.getInheritableAttribute(x.of("V"));
      return this.dict.context.lookup(t);
    }, e.prototype.Kids = function() {
      return this.dict.lookupMaybe(x.of("Kids"), Ee);
    }, e.prototype.DA = function() {
      var t = this.dict.lookup(x.of("DA"));
      if (t instanceof Pe || t instanceof ne)
        return t;
    }, e.prototype.setKids = function(t) {
      this.dict.set(x.of("Kids"), this.dict.context.obj(t));
    }, e.prototype.getParent = function() {
      var t = this.dict.get(x.of("Parent"));
      if (t instanceof Re) {
        var r = this.dict.lookup(x.of("Parent"), ce);
        return new e(r, t);
      }
    }, e.prototype.setParent = function(t) {
      t ? this.dict.set(x.of("Parent"), t) : this.dict.delete(x.of("Parent"));
    }, e.prototype.getFullyQualifiedName = function() {
      var t = this.getParent();
      return t ? t.getFullyQualifiedName() + "." + this.getPartialName() : this.getPartialName();
    }, e.prototype.getPartialName = function() {
      var t;
      return (t = this.T()) === null || t === void 0 ? void 0 : t.decodeText();
    }, e.prototype.setPartialName = function(t) {
      t ? this.dict.set(x.of("T"), ne.fromText(t)) : this.dict.delete(x.of("T"));
    }, e.prototype.setDefaultAppearance = function(t) {
      this.dict.set(x.of("DA"), Pe.of(t));
    }, e.prototype.getDefaultAppearance = function() {
      var t = this.DA();
      return t instanceof ne ? t.decodeText() : t == null ? void 0 : t.asString();
    }, e.prototype.setFontSize = function(t) {
      var r, n = (r = this.getFullyQualifiedName()) !== null && r !== void 0 ? r : "", i = this.getDefaultAppearance();
      if (!i)
        throw new PD(n);
      var a = Pf(i, gk);
      if (!a.match)
        throw new RD(n);
      var o = i.slice(0, a.pos - a.match[0].length), s = a.pos <= i.length ? i.slice(a.pos) : "", l = a.match[1], u = o + " /" + l + " " + t + " Tf " + s;
      this.setDefaultAppearance(u);
    }, e.prototype.getFlags = function() {
      var t, r;
      return (r = (t = this.Ff()) === null || t === void 0 ? void 0 : t.asNumber()) !== null && r !== void 0 ? r : 0;
    }, e.prototype.setFlags = function(t) {
      this.dict.set(x.of("Ff"), ae.of(t));
    }, e.prototype.hasFlag = function(t) {
      var r = this.getFlags();
      return (r & t) !== 0;
    }, e.prototype.setFlag = function(t) {
      var r = this.getFlags();
      this.setFlags(r | t);
    }, e.prototype.clearFlag = function(t) {
      var r = this.getFlags();
      this.setFlags(r & ~t);
    }, e.prototype.setFlagTo = function(t, r) {
      r ? this.setFlag(t) : this.clearFlag(t);
    }, e.prototype.getInheritableAttribute = function(t) {
      var r;
      return this.ascend(function(n) {
        r || (r = n.dict.get(t));
      }), r;
    }, e.prototype.ascend = function(t) {
      t(this);
      var r = this.getParent();
      r && r.ascend(t);
    }, e;
  }()
), ac = (
  /** @class */
  function() {
    function e(t) {
      this.dict = t;
    }
    return e.prototype.W = function() {
      var t = this.dict.lookup(x.of("W"));
      if (t instanceof ae)
        return t;
    }, e.prototype.getWidth = function() {
      var t, r;
      return (r = (t = this.W()) === null || t === void 0 ? void 0 : t.asNumber()) !== null && r !== void 0 ? r : 1;
    }, e.prototype.setWidth = function(t) {
      var r = this.dict.context.obj(t);
      this.dict.set(x.of("W"), r);
    }, e.fromDict = function(t) {
      return new e(t);
    }, e;
  }()
), mk = (
  /** @class */
  function() {
    function e(t) {
      this.dict = t;
    }
    return e.prototype.Rect = function() {
      return this.dict.lookup(x.of("Rect"), Ee);
    }, e.prototype.AP = function() {
      return this.dict.lookupMaybe(x.of("AP"), ce);
    }, e.prototype.F = function() {
      var t = this.dict.lookup(x.of("F"));
      return this.dict.context.lookupMaybe(t, ae);
    }, e.prototype.getRectangle = function() {
      var t, r = this.Rect();
      return (t = r == null ? void 0 : r.asRectangle()) !== null && t !== void 0 ? t : { x: 0, y: 0, width: 0, height: 0 };
    }, e.prototype.setRectangle = function(t) {
      var r = t.x, n = t.y, i = t.width, a = t.height, o = this.dict.context.obj([r, n, r + i, n + a]);
      this.dict.set(x.of("Rect"), o);
    }, e.prototype.getAppearanceState = function() {
      var t = this.dict.lookup(x.of("AS"));
      if (t instanceof x)
        return t;
    }, e.prototype.setAppearanceState = function(t) {
      this.dict.set(x.of("AS"), t);
    }, e.prototype.setAppearances = function(t) {
      this.dict.set(x.of("AP"), t);
    }, e.prototype.ensureAP = function() {
      var t = this.AP();
      return t || (t = this.dict.context.obj({}), this.dict.set(x.of("AP"), t)), t;
    }, e.prototype.getNormalAppearance = function() {
      var t = this.ensureAP(), r = t.get(x.of("N"));
      if (r instanceof Re || r instanceof ce)
        return r;
      throw new Error("Unexpected N type: " + (r == null ? void 0 : r.constructor.name));
    }, e.prototype.setNormalAppearance = function(t) {
      var r = this.ensureAP();
      r.set(x.of("N"), t);
    }, e.prototype.setRolloverAppearance = function(t) {
      var r = this.ensureAP();
      r.set(x.of("R"), t);
    }, e.prototype.setDownAppearance = function(t) {
      var r = this.ensureAP();
      r.set(x.of("D"), t);
    }, e.prototype.removeRolloverAppearance = function() {
      var t = this.AP();
      t == null || t.delete(x.of("R"));
    }, e.prototype.removeDownAppearance = function() {
      var t = this.AP();
      t == null || t.delete(x.of("D"));
    }, e.prototype.getAppearances = function() {
      var t = this.AP();
      if (t) {
        var r = t.lookup(x.of("N"), ce, Mt), n = t.lookupMaybe(x.of("R"), ce, Mt), i = t.lookupMaybe(x.of("D"), ce, Mt);
        return { normal: r, rollover: n, down: i };
      }
    }, e.prototype.getFlags = function() {
      var t, r;
      return (r = (t = this.F()) === null || t === void 0 ? void 0 : t.asNumber()) !== null && r !== void 0 ? r : 0;
    }, e.prototype.setFlags = function(t) {
      this.dict.set(x.of("F"), ae.of(t));
    }, e.prototype.hasFlag = function(t) {
      var r = this.getFlags();
      return (r & t) !== 0;
    }, e.prototype.setFlag = function(t) {
      var r = this.getFlags();
      this.setFlags(r | t);
    }, e.prototype.clearFlag = function(t) {
      var r = this.getFlags();
      this.setFlags(r & ~t);
    }, e.prototype.setFlagTo = function(t, r) {
      r ? this.setFlag(t) : this.clearFlag(t);
    }, e.fromDict = function(t) {
      return new e(t);
    }, e;
  }()
), oc = (
  /** @class */
  function() {
    function e(t) {
      this.dict = t;
    }
    return e.prototype.R = function() {
      var t = this.dict.lookup(x.of("R"));
      if (t instanceof ae)
        return t;
    }, e.prototype.BC = function() {
      var t = this.dict.lookup(x.of("BC"));
      if (t instanceof Ee)
        return t;
    }, e.prototype.BG = function() {
      var t = this.dict.lookup(x.of("BG"));
      if (t instanceof Ee)
        return t;
    }, e.prototype.CA = function() {
      var t = this.dict.lookup(x.of("CA"));
      if (t instanceof ne || t instanceof Pe)
        return t;
    }, e.prototype.RC = function() {
      var t = this.dict.lookup(x.of("RC"));
      if (t instanceof ne || t instanceof Pe)
        return t;
    }, e.prototype.AC = function() {
      var t = this.dict.lookup(x.of("AC"));
      if (t instanceof ne || t instanceof Pe)
        return t;
    }, e.prototype.getRotation = function() {
      var t;
      return (t = this.R()) === null || t === void 0 ? void 0 : t.asNumber();
    }, e.prototype.getBorderColor = function() {
      var t = this.BC();
      if (t) {
        for (var r = [], n = 0, i = t == null ? void 0 : t.size(); n < i; n++) {
          var a = t.get(n);
          a instanceof ae && r.push(a.asNumber());
        }
        return r;
      }
    }, e.prototype.getBackgroundColor = function() {
      var t = this.BG();
      if (t) {
        for (var r = [], n = 0, i = t == null ? void 0 : t.size(); n < i; n++) {
          var a = t.get(n);
          a instanceof ae && r.push(a.asNumber());
        }
        return r;
      }
    }, e.prototype.getCaptions = function() {
      var t = this.CA(), r = this.RC(), n = this.AC();
      return {
        normal: t == null ? void 0 : t.decodeText(),
        rollover: r == null ? void 0 : r.decodeText(),
        down: n == null ? void 0 : n.decodeText()
      };
    }, e.prototype.setRotation = function(t) {
      var r = this.dict.context.obj(t);
      this.dict.set(x.of("R"), r);
    }, e.prototype.setBorderColor = function(t) {
      var r = this.dict.context.obj(t);
      this.dict.set(x.of("BC"), r);
    }, e.prototype.setBackgroundColor = function(t) {
      var r = this.dict.context.obj(t);
      this.dict.set(x.of("BG"), r);
    }, e.prototype.setCaptions = function(t) {
      var r = ne.fromText(t.normal);
      if (this.dict.set(x.of("CA"), r), t.rollover) {
        var n = ne.fromText(t.rollover);
        this.dict.set(x.of("RC"), n);
      } else
        this.dict.delete(x.of("RC"));
      if (t.down) {
        var i = ne.fromText(t.down);
        this.dict.set(x.of("AC"), i);
      } else
        this.dict.delete(x.of("AC"));
    }, e.fromDict = function(t) {
      return new e(t);
    }, e;
  }()
), Mc = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.prototype.MK = function() {
      var r = this.dict.lookup(x.of("MK"));
      if (r instanceof ce)
        return r;
    }, t.prototype.BS = function() {
      var r = this.dict.lookup(x.of("BS"));
      if (r instanceof ce)
        return r;
    }, t.prototype.DA = function() {
      var r = this.dict.lookup(x.of("DA"));
      if (r instanceof Pe || r instanceof ne)
        return r;
    }, t.prototype.P = function() {
      var r = this.dict.get(x.of("P"));
      if (r instanceof Re)
        return r;
    }, t.prototype.setP = function(r) {
      this.dict.set(x.of("P"), r);
    }, t.prototype.setDefaultAppearance = function(r) {
      this.dict.set(x.of("DA"), Pe.of(r));
    }, t.prototype.getDefaultAppearance = function() {
      var r = this.DA();
      return r instanceof ne ? r.decodeText() : r == null ? void 0 : r.asString();
    }, t.prototype.getAppearanceCharacteristics = function() {
      var r = this.MK();
      if (r)
        return oc.fromDict(r);
    }, t.prototype.getOrCreateAppearanceCharacteristics = function() {
      var r = this.MK();
      if (r)
        return oc.fromDict(r);
      var n = oc.fromDict(this.dict.context.obj({}));
      return this.dict.set(x.of("MK"), n.dict), n;
    }, t.prototype.getBorderStyle = function() {
      var r = this.BS();
      if (r)
        return ac.fromDict(r);
    }, t.prototype.getOrCreateBorderStyle = function() {
      var r = this.BS();
      if (r)
        return ac.fromDict(r);
      var n = ac.fromDict(this.dict.context.obj({}));
      return this.dict.set(x.of("BS"), n.dict), n;
    }, t.prototype.getOnValue = function() {
      var r, n = (r = this.getAppearances()) === null || r === void 0 ? void 0 : r.normal;
      if (n instanceof ce)
        for (var i = n.keys(), a = 0, o = i.length; a < o; a++) {
          var s = i[a];
          if (s !== x.of("Off"))
            return s;
        }
    }, t.fromDict = function(r) {
      return new t(r);
    }, t.create = function(r, n) {
      var i = r.obj({
        Type: "Annot",
        Subtype: "Widget",
        Rect: [0, 0, 0, 0],
        Parent: n
      });
      return new t(i);
    }, t;
  }(mk)
), Gi = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.prototype.FT = function() {
      var r = this.getInheritableAttribute(x.of("FT"));
      return this.dict.context.lookup(r, x);
    }, t.prototype.getWidgets = function() {
      var r = this.Kids();
      if (!r)
        return [Mc.fromDict(this.dict)];
      for (var n = new Array(r.size()), i = 0, a = r.size(); i < a; i++) {
        var o = r.lookup(i, ce);
        n[i] = Mc.fromDict(o);
      }
      return n;
    }, t.prototype.addWidget = function(r) {
      var n = this.normalizedEntries().Kids;
      n.push(r);
    }, t.prototype.removeWidget = function(r) {
      var n = this.Kids();
      if (n) {
        if (r < 0 || r > n.size())
          throw new Qs(r, 0, n.size());
        n.remove(r);
      } else {
        if (r !== 0)
          throw new Qs(r, 0, 0);
        this.setKids([]);
      }
    }, t.prototype.normalizedEntries = function() {
      var r = this.Kids();
      return r || (r = this.dict.context.obj([this.ref]), this.dict.set(x.of("Kids"), r)), { Kids: r };
    }, t.fromDict = function(r, n) {
      return new t(r, n);
    }, t;
  }(fy)
), Vf = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.prototype.Opt = function() {
      return this.dict.lookupMaybe(x.of("Opt"), Pe, ne, Ee);
    }, t.prototype.setOpt = function(r) {
      this.dict.set(x.of("Opt"), this.dict.context.obj(r));
    }, t.prototype.getExportValues = function() {
      var r = this.Opt();
      if (r) {
        if (r instanceof Pe || r instanceof ne)
          return [r];
        for (var n = [], i = 0, a = r.size(); i < a; i++) {
          var o = r.lookup(i);
          (o instanceof Pe || o instanceof ne) && n.push(o);
        }
        return n;
      }
    }, t.prototype.removeExportValue = function(r) {
      var n = this.Opt();
      if (n)
        if (n instanceof Pe || n instanceof ne) {
          if (r !== 0)
            throw new Qs(r, 0, 0);
          this.setOpt([]);
        } else {
          if (r < 0 || r > n.size())
            throw new Qs(r, 0, n.size());
          n.remove(r);
        }
    }, t.prototype.normalizeExportValues = function() {
      for (var r, n, i, a, o = (r = this.getExportValues()) !== null && r !== void 0 ? r : [], s = [], l = this.getWidgets(), u = 0, c = l.length; u < c; u++) {
        var f = l[u], h = (n = o[u]) !== null && n !== void 0 ? n : ne.fromText((a = (i = f.getOnValue()) === null || i === void 0 ? void 0 : i.decodeText()) !== null && a !== void 0 ? a : "");
        s.push(h);
      }
      this.setOpt(s);
    }, t.prototype.addOpt = function(r, n) {
      var i;
      this.normalizeExportValues();
      var a = r.decodeText(), o;
      if (n)
        for (var s = (i = this.getExportValues()) !== null && i !== void 0 ? i : [], l = 0, u = s.length; l < u; l++) {
          var c = s[l];
          c.decodeText() === a && (o = l);
        }
      var f = this.Opt();
      return f.push(r), o ?? f.size() - 1;
    }, t.prototype.addWidgetWithOpt = function(r, n, i) {
      var a = this.addOpt(n, i), o = x.of(String(a));
      return this.addWidget(r), o;
    }, t;
  }(Gi)
), ql = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.prototype.setValue = function(r) {
      var n, i = (n = this.getOnValue()) !== null && n !== void 0 ? n : x.of("Yes");
      if (r !== i && r !== x.of("Off"))
        throw new Mf();
      this.dict.set(x.of("V"), r);
      for (var a = this.getWidgets(), o = 0, s = a.length; o < s; o++) {
        var l = a[o], u = l.getOnValue() === r ? r : x.of("Off");
        l.setAppearanceState(u);
      }
    }, t.prototype.getValue = function() {
      var r = this.V();
      return r instanceof x ? r : x.of("Off");
    }, t.prototype.getOnValue = function() {
      var r = this.getWidgets()[0];
      return r == null ? void 0 : r.getOnValue();
    }, t.fromDict = function(r, n) {
      return new t(r, n);
    }, t.create = function(r) {
      var n = r.obj({
        FT: "Btn",
        Kids: []
      }), i = r.register(n);
      return new t(n, i);
    }, t;
  }(Vf)
), We = function(e) {
  return 1 << e;
}, ar;
(function(e) {
  e[e.ReadOnly = We(0)] = "ReadOnly", e[e.Required = We(1)] = "Required", e[e.NoExport = We(2)] = "NoExport";
})(ar || (ar = {}));
var Ht;
(function(e) {
  e[e.NoToggleToOff = We(14)] = "NoToggleToOff", e[e.Radio = We(15)] = "Radio", e[e.PushButton = We(16)] = "PushButton", e[e.RadiosInUnison = We(25)] = "RadiosInUnison";
})(Ht || (Ht = {}));
var _e;
(function(e) {
  e[e.Multiline = We(12)] = "Multiline", e[e.Password = We(13)] = "Password", e[e.FileSelect = We(20)] = "FileSelect", e[e.DoNotSpellCheck = We(22)] = "DoNotSpellCheck", e[e.DoNotScroll = We(23)] = "DoNotScroll", e[e.Comb = We(24)] = "Comb", e[e.RichText = We(25)] = "RichText";
})(_e || (_e = {}));
var Ce;
(function(e) {
  e[e.Combo = We(17)] = "Combo", e[e.Edit = We(18)] = "Edit", e[e.Sort = We(19)] = "Sort", e[e.MultiSelect = We(21)] = "MultiSelect", e[e.DoNotSpellCheck = We(22)] = "DoNotSpellCheck", e[e.CommitOnSelChange = We(26)] = "CommitOnSelChange";
})(Ce || (Ce = {}));
var hy = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.prototype.setValues = function(r) {
      if (this.hasFlag(Ce.Combo) && !this.hasFlag(Ce.Edit) && !this.valuesAreValid(r))
        throw new Mf();
      if (r.length === 0 && this.dict.delete(x.of("V")), r.length === 1 && this.dict.set(x.of("V"), r[0]), r.length > 1) {
        if (!this.hasFlag(Ce.MultiSelect))
          throw new AD();
        this.dict.set(x.of("V"), this.dict.context.obj(r));
      }
      this.updateSelectedIndices(r);
    }, t.prototype.valuesAreValid = function(r) {
      for (var n = this.getOptions(), i = function(l, u) {
        var c = r[l].decodeText();
        if (!n.find(function(f) {
          return c === (f.display || f.value).decodeText();
        }))
          return { value: !1 };
      }, a = 0, o = r.length; a < o; a++) {
        var s = i(a);
        if (typeof s == "object")
          return s.value;
      }
      return !0;
    }, t.prototype.updateSelectedIndices = function(r) {
      if (r.length > 1) {
        for (var n = new Array(r.length), i = this.getOptions(), a = function(l, u) {
          var c = r[l].decodeText();
          n[l] = i.findIndex(function(f) {
            return c === (f.display || f.value).decodeText();
          });
        }, o = 0, s = r.length; o < s; o++)
          a(o, s);
        this.dict.set(x.of("I"), this.dict.context.obj(n.sort()));
      } else
        this.dict.delete(x.of("I"));
    }, t.prototype.getValues = function() {
      var r = this.V();
      if (r instanceof Pe || r instanceof ne)
        return [r];
      if (r instanceof Ee) {
        for (var n = [], i = 0, a = r.size(); i < a; i++) {
          var o = r.lookup(i);
          (o instanceof Pe || o instanceof ne) && n.push(o);
        }
        return n;
      }
      return [];
    }, t.prototype.Opt = function() {
      return this.dict.lookupMaybe(x.of("Opt"), Pe, ne, Ee);
    }, t.prototype.setOptions = function(r) {
      for (var n = new Array(r.length), i = 0, a = r.length; i < a; i++) {
        var o = r[i], s = o.value, l = o.display;
        n[i] = this.dict.context.obj([s, l || s]);
      }
      this.dict.set(x.of("Opt"), this.dict.context.obj(n));
    }, t.prototype.getOptions = function() {
      var r = this.Opt();
      if (r instanceof Pe || r instanceof ne)
        return [{ value: r, display: r }];
      if (r instanceof Ee) {
        for (var n = [], i = 0, a = r.size(); i < a; i++) {
          var o = r.lookup(i);
          if ((o instanceof Pe || o instanceof ne) && n.push({ value: o, display: o }), o instanceof Ee && o.size() > 0) {
            var s = o.lookup(0, Pe, ne), l = o.lookupMaybe(1, Pe, ne);
            n.push({ value: s, display: l || s });
          }
        }
        return n;
      }
      return [];
    }, t;
  }(Gi)
), Vl = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.fromDict = function(r, n) {
      return new t(r, n);
    }, t.create = function(r) {
      var n = r.obj({
        FT: "Ch",
        Ff: Ce.Combo,
        Kids: []
      }), i = r.register(n);
      return new t(n, i);
    }, t;
  }(hy)
), tl = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.prototype.addField = function(r) {
      var n = this.normalizedEntries().Kids;
      n == null || n.push(r);
    }, t.prototype.normalizedEntries = function() {
      var r = this.Kids();
      return r || (r = this.dict.context.obj([]), this.dict.set(x.of("Kids"), r)), { Kids: r };
    }, t.fromDict = function(r, n) {
      return new t(r, n);
    }, t.create = function(r) {
      var n = r.obj({}), i = r.register(n);
      return new t(n, i);
    }, t;
  }(fy)
), Hf = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.fromDict = function(r, n) {
      return new t(r, n);
    }, t;
  }(Gi)
), Hl = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.prototype.MaxLen = function() {
      var r = this.dict.lookup(x.of("MaxLen"));
      if (r instanceof ae)
        return r;
    }, t.prototype.Q = function() {
      var r = this.dict.lookup(x.of("Q"));
      if (r instanceof ae)
        return r;
    }, t.prototype.setMaxLength = function(r) {
      this.dict.set(x.of("MaxLen"), ae.of(r));
    }, t.prototype.removeMaxLength = function() {
      this.dict.delete(x.of("MaxLen"));
    }, t.prototype.getMaxLength = function() {
      var r;
      return (r = this.MaxLen()) === null || r === void 0 ? void 0 : r.asNumber();
    }, t.prototype.setQuadding = function(r) {
      this.dict.set(x.of("Q"), ae.of(r));
    }, t.prototype.getQuadding = function() {
      var r;
      return (r = this.Q()) === null || r === void 0 ? void 0 : r.asNumber();
    }, t.prototype.setValue = function(r) {
      this.dict.set(x.of("V"), r);
    }, t.prototype.removeValue = function() {
      this.dict.delete(x.of("V"));
    }, t.prototype.getValue = function() {
      var r = this.V();
      if (r instanceof Pe || r instanceof ne)
        return r;
    }, t.fromDict = function(r, n) {
      return new t(r, n);
    }, t.create = function(r) {
      var n = r.obj({
        FT: "Tx",
        Kids: []
      }), i = r.register(n);
      return new t(n, i);
    }, t;
  }(Gi)
), Wl = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.fromDict = function(r, n) {
      return new t(r, n);
    }, t.create = function(r) {
      var n = r.obj({
        FT: "Btn",
        Ff: Ht.PushButton,
        Kids: []
      }), i = r.register(n);
      return new t(n, i);
    }, t;
  }(Vf)
), Gl = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.prototype.setValue = function(r) {
      var n = this.getOnValues();
      if (!n.includes(r) && r !== x.of("Off"))
        throw new Mf();
      this.dict.set(x.of("V"), r);
      for (var i = this.getWidgets(), a = 0, o = i.length; a < o; a++) {
        var s = i[a], l = s.getOnValue() === r ? r : x.of("Off");
        s.setAppearanceState(l);
      }
    }, t.prototype.getValue = function() {
      var r = this.V();
      return r instanceof x ? r : x.of("Off");
    }, t.prototype.getOnValues = function() {
      for (var r = this.getWidgets(), n = [], i = 0, a = r.length; i < a; i++) {
        var o = r[i].getOnValue();
        o && n.push(o);
      }
      return n;
    }, t.fromDict = function(r, n) {
      return new t(r, n);
    }, t.create = function(r) {
      var n = r.obj({
        FT: "Btn",
        Ff: Ht.Radio,
        Kids: []
      }), i = r.register(n);
      return new t(n, i);
    }, t;
  }(Vf)
), Kl = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.fromDict = function(r, n) {
      return new t(r, n);
    }, t.create = function(r) {
      var n = r.obj({
        FT: "Ch",
        Kids: []
      }), i = r.register(n);
      return new t(n, i);
    }, t;
  }(hy)
), Wf = function(e) {
  if (!e)
    return [];
  for (var t = [], r = 0, n = e.size(); r < n; r++) {
    var i = e.get(r), a = e.lookup(r);
    i instanceof Re && a instanceof ce && t.push([dy(a, i), i]);
  }
  return t;
}, dy = function(e, t) {
  var r = yk(e);
  return r ? tl.fromDict(e, t) : bk(e, t);
}, yk = function(e) {
  var t = e.lookup(x.of("Kids"));
  if (t instanceof Ee)
    for (var r = 0, n = t.size(); r < n; r++) {
      var i = t.lookup(r), a = i instanceof ce && i.has(x.of("T"));
      if (a)
        return !0;
    }
  return !1;
}, bk = function(e, t) {
  var r = Gf(e, x.of("FT")), n = e.context.lookup(r, x);
  return n === x.of("Btn") ? wk(e, t) : n === x.of("Ch") ? xk(e, t) : n === x.of("Tx") ? Hl.fromDict(e, t) : n === x.of("Sig") ? Hf.fromDict(e, t) : Gi.fromDict(e, t);
}, wk = function(e, t) {
  var r, n = Gf(e, x.of("Ff")), i = e.context.lookupMaybe(n, ae), a = (r = i == null ? void 0 : i.asNumber()) !== null && r !== void 0 ? r : 0;
  return jc(a, Ht.PushButton) ? Wl.fromDict(e, t) : jc(a, Ht.Radio) ? Gl.fromDict(e, t) : ql.fromDict(e, t);
}, xk = function(e, t) {
  var r, n = Gf(e, x.of("Ff")), i = e.context.lookupMaybe(n, ae), a = (r = i == null ? void 0 : i.asNumber()) !== null && r !== void 0 ? r : 0;
  return jc(a, Ce.Combo) ? Vl.fromDict(e, t) : Kl.fromDict(e, t);
}, jc = function(e, t) {
  return (e & t) !== 0;
}, Gf = function(e, t) {
  var r;
  return py(e, function(n) {
    r || (r = n.get(t));
  }), r;
}, py = function(e, t) {
  t(e);
  var r = e.lookupMaybe(x.of("Parent"), ce);
  r && py(r, t);
}, rl = (
  /** @class */
  function() {
    function e(t) {
      this.dict = t;
    }
    return e.prototype.Fields = function() {
      var t = this.dict.lookup(x.of("Fields"));
      if (t instanceof Ee)
        return t;
    }, e.prototype.getFields = function() {
      for (var t = this.normalizedEntries().Fields, r = new Array(t.size()), n = 0, i = t.size(); n < i; n++) {
        var a = t.get(n), o = t.lookup(n, ce);
        r[n] = [dy(o, a), a];
      }
      return r;
    }, e.prototype.getAllFields = function() {
      var t = [], r = function(n) {
        if (n)
          for (var i = 0, a = n.length; i < a; i++) {
            var o = n[i];
            t.push(o);
            var s = o[0];
            s instanceof tl && r(Wf(s.Kids()));
          }
      };
      return r(this.getFields()), t;
    }, e.prototype.addField = function(t) {
      var r = this.normalizedEntries().Fields;
      r == null || r.push(t);
    }, e.prototype.removeField = function(t) {
      var r = t.getParent(), n = r === void 0 ? this.normalizedEntries().Fields : r.Kids(), i = n == null ? void 0 : n.indexOf(t.ref);
      if (n === void 0 || i === void 0)
        throw new Error("Tried to remove inexistent field " + t.getFullyQualifiedName());
      n.remove(i), r !== void 0 && n.size() === 0 && this.removeField(r);
    }, e.prototype.normalizedEntries = function() {
      var t = this.Fields();
      return t || (t = this.dict.context.obj([]), this.dict.set(x.of("Fields"), t)), { Fields: t };
    }, e.fromDict = function(t) {
      return new e(t);
    }, e.create = function(t) {
      var r = t.obj({ Fields: [] });
      return new e(r);
    }, e;
  }()
), vy = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.prototype.Pages = function() {
      return this.lookup(x.of("Pages"), ce);
    }, t.prototype.AcroForm = function() {
      return this.lookupMaybe(x.of("AcroForm"), ce);
    }, t.prototype.getAcroForm = function() {
      var r = this.AcroForm();
      if (r)
        return rl.fromDict(r);
    }, t.prototype.getOrCreateAcroForm = function() {
      var r = this.getAcroForm();
      if (!r) {
        r = rl.create(this.context);
        var n = this.context.register(r.dict);
        this.set(x.of("AcroForm"), n);
      }
      return r;
    }, t.prototype.ViewerPreferences = function() {
      return this.lookupMaybe(x.of("ViewerPreferences"), ce);
    }, t.prototype.getViewerPreferences = function() {
      var r = this.ViewerPreferences();
      if (r)
        return Fp.fromDict(r);
    }, t.prototype.getOrCreateViewerPreferences = function() {
      var r = this.getViewerPreferences();
      if (!r) {
        r = Fp.create(this.context);
        var n = this.context.register(r.dict);
        this.set(x.of("ViewerPreferences"), n);
      }
      return r;
    }, t.prototype.insertLeafNode = function(r, n) {
      var i = this.get(x.of("Pages")), a = this.Pages().insertLeafNode(r, n);
      return a || i;
    }, t.prototype.removeLeafNode = function(r) {
      this.Pages().removeLeafNode(r);
    }, t.withContextAndPages = function(r, n) {
      var i = /* @__PURE__ */ new Map();
      return i.set(x.of("Type"), x.of("Catalog")), i.set(x.of("Pages"), n), new t(i, r);
    }, t.fromMapWithContext = function(r, n) {
      return new t(r, n);
    }, t;
  }(ce)
), gy = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      return e !== null && e.apply(this, arguments) || this;
    }
    return t.prototype.Parent = function() {
      return this.lookup(x.of("Parent"));
    }, t.prototype.Kids = function() {
      return this.lookup(x.of("Kids"), Ee);
    }, t.prototype.Count = function() {
      return this.lookup(x.of("Count"), ae);
    }, t.prototype.pushTreeNode = function(r) {
      var n = this.Kids();
      n.push(r);
    }, t.prototype.pushLeafNode = function(r) {
      var n = this.Kids();
      this.insertLeafKid(n.size(), r);
    }, t.prototype.insertLeafNode = function(r, n) {
      var i = this.Kids(), a = this.Count().asNumber();
      if (n > a)
        throw new fp(n, a);
      for (var o = n, s = 0, l = i.size(); s < l; s++) {
        if (o === 0) {
          this.insertLeafKid(s, r);
          return;
        }
        var u = i.get(s), c = this.context.lookup(u);
        if (c instanceof t) {
          if (c.Count().asNumber() > o)
            return c.insertLeafNode(r, o) || u;
          o -= c.Count().asNumber();
        }
        c instanceof Ir && (o -= 1);
      }
      if (o === 0) {
        this.insertLeafKid(i.size(), r);
        return;
      }
      throw new hp(n, "insertLeafNode");
    }, t.prototype.removeLeafNode = function(r, n) {
      n === void 0 && (n = !0);
      var i = this.Kids(), a = this.Count().asNumber();
      if (r >= a)
        throw new fp(r, a);
      for (var o = r, s = 0, l = i.size(); s < l; s++) {
        var u = i.get(s), c = this.context.lookup(u);
        if (c instanceof t)
          if (c.Count().asNumber() > o) {
            c.removeLeafNode(o, n), n && c.Kids().size() === 0 && i.remove(s);
            return;
          } else
            o -= c.Count().asNumber();
        if (c instanceof Ir)
          if (o === 0) {
            this.removeKid(s);
            return;
          } else
            o -= 1;
      }
      throw new hp(r, "removeLeafNode");
    }, t.prototype.ascend = function(r) {
      r(this);
      var n = this.Parent();
      n && n.ascend(r);
    }, t.prototype.traverse = function(r) {
      for (var n = this.Kids(), i = 0, a = n.size(); i < a; i++) {
        var o = n.get(i), s = this.context.lookup(o);
        s instanceof t && s.traverse(r), r(s, o);
      }
    }, t.prototype.insertLeafKid = function(r, n) {
      var i = this.Kids();
      this.ascend(function(a) {
        var o = a.Count().asNumber() + 1;
        a.set(x.of("Count"), ae.of(o));
      }), i.insert(r, n);
    }, t.prototype.removeKid = function(r) {
      var n = this.Kids(), i = n.lookup(r);
      i instanceof Ir && this.ascend(function(a) {
        var o = a.Count().asNumber() - 1;
        a.set(x.of("Count"), ae.of(o));
      }), n.remove(r);
    }, t.withContext = function(r, n) {
      var i = /* @__PURE__ */ new Map();
      return i.set(x.of("Type"), x.of("Pages")), i.set(x.of("Kids"), r.obj([])), i.set(x.of("Count"), r.obj(0)), n && i.set(x.of("Parent"), n), new t(i, r);
    }, t.fromMapWithContext = function(r, n) {
      return new t(r, n);
    }, t;
  }(ce)
), vt = new Uint8Array(256);
vt[E.Zero] = 1;
vt[E.One] = 1;
vt[E.Two] = 1;
vt[E.Three] = 1;
vt[E.Four] = 1;
vt[E.Five] = 1;
vt[E.Six] = 1;
vt[E.Seven] = 1;
vt[E.Eight] = 1;
vt[E.Nine] = 1;
var Xl = new Uint8Array(256);
Xl[E.Period] = 1;
Xl[E.Plus] = 1;
Xl[E.Minus] = 1;
var Kf = new Uint8Array(256);
for (var ua = 0, Ek = 256; ua < Ek; ua++)
  Kf[ua] = vt[ua] || Xl[ua] ? 1 : 0;
var Tp = E.Newline, Cp = E.CarriageReturn, Sk = (
  /** @class */
  function() {
    function e(t, r) {
      r === void 0 && (r = !1), this.bytes = t, this.capNumbers = r;
    }
    return e.prototype.parseRawInt = function() {
      for (var t = ""; !this.bytes.done(); ) {
        var r = this.bytes.peek();
        if (!vt[r])
          break;
        t += kr(this.bytes.next());
      }
      var n = Number(t);
      if (!t || !isFinite(n))
        throw new dp(this.bytes.position(), t);
      return n;
    }, e.prototype.parseRawNumber = function() {
      for (var t = ""; !this.bytes.done(); ) {
        var r = this.bytes.peek();
        if (!Kf[r] || (t += kr(this.bytes.next()), r === E.Period))
          break;
      }
      for (; !this.bytes.done(); ) {
        var r = this.bytes.peek();
        if (!vt[r])
          break;
        t += kr(this.bytes.next());
      }
      var n = Number(t);
      if (!t || !isFinite(n))
        throw new dp(this.bytes.position(), t);
      if (n > Number.MAX_SAFE_INTEGER)
        if (this.capNumbers) {
          var i = "Parsed number that is too large for some PDF readers: " + t + ", using Number.MAX_SAFE_INTEGER instead.";
          return console.warn(i), Number.MAX_SAFE_INTEGER;
        } else {
          var i = "Parsed number that is too large for some PDF readers: " + t + ", not capping.";
          console.warn(i);
        }
      return n;
    }, e.prototype.skipWhitespace = function() {
      for (; !this.bytes.done() && Br[this.bytes.peek()]; )
        this.bytes.next();
    }, e.prototype.skipLine = function() {
      for (; !this.bytes.done(); ) {
        var t = this.bytes.peek();
        if (t === Tp || t === Cp)
          return;
        this.bytes.next();
      }
    }, e.prototype.skipComment = function() {
      if (this.bytes.peek() !== E.Percent)
        return !1;
      for (; !this.bytes.done(); ) {
        var t = this.bytes.peek();
        if (t === Tp || t === Cp)
          return !0;
        this.bytes.next();
      }
      return !0;
    }, e.prototype.skipWhitespaceAndComments = function() {
      for (this.skipWhitespace(); this.skipComment(); )
        this.skipWhitespace();
    }, e.prototype.matchKeyword = function(t) {
      for (var r = this.bytes.offset(), n = 0, i = t.length; n < i; n++)
        if (this.bytes.done() || this.bytes.next() !== t[n])
          return this.bytes.moveTo(r), !1;
      return !0;
    }, e;
  }()
), Yl = (
  /** @class */
  function() {
    function e(t) {
      this.idx = 0, this.line = 0, this.column = 0, this.bytes = t, this.length = this.bytes.length;
    }
    return e.prototype.moveTo = function(t) {
      this.idx = t;
    }, e.prototype.next = function() {
      var t = this.bytes[this.idx++];
      return t === E.Newline ? (this.line += 1, this.column = 0) : this.column += 1, t;
    }, e.prototype.assertNext = function(t) {
      if (this.peek() !== t)
        throw new OD(this.position(), t, this.peek());
      return this.next();
    }, e.prototype.peek = function() {
      return this.bytes[this.idx];
    }, e.prototype.peekAhead = function(t) {
      return this.bytes[this.idx + t];
    }, e.prototype.peekAt = function(t) {
      return this.bytes[t];
    }, e.prototype.done = function() {
      return this.idx >= this.length;
    }, e.prototype.offset = function() {
      return this.idx;
    }, e.prototype.slice = function(t, r) {
      return this.bytes.slice(t, r);
    }, e.prototype.position = function() {
      return { line: this.line, column: this.column, offset: this.idx };
    }, e.of = function(t) {
      return new e(t);
    }, e.fromPDFRawStream = function(t) {
      return e.of(uy(t).decode());
    }, e;
  }()
), Fk = E.Space, ca = E.CarriageReturn, fa = E.Newline, ha = [
  E.s,
  E.t,
  E.r,
  E.e,
  E.a,
  E.m
], gs = [
  E.e,
  E.n,
  E.d,
  E.s,
  E.t,
  E.r,
  E.e,
  E.a,
  E.m
], ke = {
  header: [
    E.Percent,
    E.P,
    E.D,
    E.F,
    E.Dash
  ],
  eof: [
    E.Percent,
    E.Percent,
    E.E,
    E.O,
    E.F
  ],
  obj: [E.o, E.b, E.j],
  endobj: [
    E.e,
    E.n,
    E.d,
    E.o,
    E.b,
    E.j
  ],
  xref: [E.x, E.r, E.e, E.f],
  trailer: [
    E.t,
    E.r,
    E.a,
    E.i,
    E.l,
    E.e,
    E.r
  ],
  startxref: [
    E.s,
    E.t,
    E.a,
    E.r,
    E.t,
    E.x,
    E.r,
    E.e,
    E.f
  ],
  true: [E.t, E.r, E.u, E.e],
  false: [E.f, E.a, E.l, E.s, E.e],
  null: [E.n, E.u, E.l, E.l],
  stream: ha,
  streamEOF1: be(ha, [Fk, ca, fa]),
  streamEOF2: be(ha, [ca, fa]),
  streamEOF3: be(ha, [ca]),
  streamEOF4: be(ha, [fa]),
  endstream: gs,
  EOF1endstream: be([ca, fa], gs),
  EOF2endstream: be([ca], gs),
  EOF3endstream: be([fa], gs)
}, my = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      i === void 0 && (i = !1);
      var a = e.call(this, r, i) || this;
      return a.context = n, a;
    }
    return t.prototype.parseObject = function() {
      if (this.skipWhitespaceAndComments(), this.matchKeyword(ke.true))
        return io.True;
      if (this.matchKeyword(ke.false))
        return io.False;
      if (this.matchKeyword(ke.null))
        return Ot;
      var r = this.bytes.peek();
      if (r === E.LessThan && this.bytes.peekAhead(1) === E.LessThan)
        return this.parseDictOrStream();
      if (r === E.LessThan)
        return this.parseHexString();
      if (r === E.LeftParen)
        return this.parseString();
      if (r === E.ForwardSlash)
        return this.parseName();
      if (r === E.LeftSquareBracket)
        return this.parseArray();
      if (Kf[r])
        return this.parseNumberOrRef();
      throw new DD(this.bytes.position(), r);
    }, t.prototype.parseNumberOrRef = function() {
      var r = this.parseRawNumber();
      this.skipWhitespaceAndComments();
      var n = this.bytes.offset();
      if (vt[this.bytes.peek()]) {
        var i = this.parseRawNumber();
        if (this.skipWhitespaceAndComments(), this.bytes.peek() === E.R)
          return this.bytes.assertNext(E.R), Re.of(r, i);
      }
      return this.bytes.moveTo(n), ae.of(r);
    }, t.prototype.parseHexString = function() {
      var r = "";
      for (this.bytes.assertNext(E.LessThan); !this.bytes.done() && this.bytes.peek() !== E.GreaterThan; )
        r += kr(this.bytes.next());
      return this.bytes.assertNext(E.GreaterThan), ne.of(r);
    }, t.prototype.parseString = function() {
      for (var r = 0, n = !1, i = ""; !this.bytes.done(); ) {
        var a = this.bytes.next();
        if (i += kr(a), n || (a === E.LeftParen && (r += 1), a === E.RightParen && (r -= 1)), a === E.BackSlash ? n = !n : n && (n = !1), r === 0)
          return Pe.of(i.substring(1, i.length - 1));
      }
      throw new ID(this.bytes.position());
    }, t.prototype.parseName = function() {
      this.bytes.assertNext(E.ForwardSlash);
      for (var r = ""; !this.bytes.done(); ) {
        var n = this.bytes.peek();
        if (Br[n] || $t[n])
          break;
        r += kr(n), this.bytes.next();
      }
      return x.of(r);
    }, t.prototype.parseArray = function() {
      this.bytes.assertNext(E.LeftSquareBracket), this.skipWhitespaceAndComments();
      for (var r = Ee.withContext(this.context); this.bytes.peek() !== E.RightSquareBracket; ) {
        var n = this.parseObject();
        r.push(n), this.skipWhitespaceAndComments();
      }
      return this.bytes.assertNext(E.RightSquareBracket), r;
    }, t.prototype.parseDict = function() {
      this.bytes.assertNext(E.LessThan), this.bytes.assertNext(E.LessThan), this.skipWhitespaceAndComments();
      for (var r = /* @__PURE__ */ new Map(); !this.bytes.done() && this.bytes.peek() !== E.GreaterThan && this.bytes.peekAhead(1) !== E.GreaterThan; ) {
        var n = this.parseName(), i = this.parseObject();
        r.set(n, i), this.skipWhitespaceAndComments();
      }
      this.skipWhitespaceAndComments(), this.bytes.assertNext(E.GreaterThan), this.bytes.assertNext(E.GreaterThan);
      var a = r.get(x.of("Type"));
      return a === x.of("Catalog") ? vy.fromMapWithContext(r, this.context) : a === x.of("Pages") ? gy.fromMapWithContext(r, this.context) : a === x.of("Page") ? Ir.fromMapWithContext(r, this.context) : ce.fromMapWithContext(r, this.context);
    }, t.prototype.parseDictOrStream = function() {
      var r = this.bytes.position(), n = this.parseDict();
      if (this.skipWhitespaceAndComments(), !this.matchKeyword(ke.streamEOF1) && !this.matchKeyword(ke.streamEOF2) && !this.matchKeyword(ke.streamEOF3) && !this.matchKeyword(ke.streamEOF4) && !this.matchKeyword(ke.stream))
        return n;
      var i = this.bytes.offset(), a, o = n.get(x.of("Length"));
      o instanceof ae ? (a = i + o.asNumber(), this.bytes.moveTo(a), this.skipWhitespaceAndComments(), this.matchKeyword(ke.endstream) || (this.bytes.moveTo(i), a = this.findEndOfStreamFallback(r))) : a = this.findEndOfStreamFallback(r);
      var s = this.bytes.slice(i, a);
      return ao.of(n, s);
    }, t.prototype.findEndOfStreamFallback = function(r) {
      for (var n = 1, i = this.bytes.offset(); !this.bytes.done() && (i = this.bytes.offset(), this.matchKeyword(ke.stream) ? n += 1 : this.matchKeyword(ke.EOF1endstream) || this.matchKeyword(ke.EOF2endstream) || this.matchKeyword(ke.EOF3endstream) || this.matchKeyword(ke.endstream) ? n -= 1 : this.bytes.next(), n !== 0); )
        ;
      if (n !== 0)
        throw new ND(r);
      return i;
    }, t.forBytes = function(r, n, i) {
      return new t(Yl.of(r), n, i);
    }, t.forByteStream = function(r, n, i) {
      return i === void 0 && (i = !1), new t(r, n, i);
    }, t;
  }(Sk)
), Tk = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = e.call(this, Yl.fromPDFRawStream(r), r.dict.context) || this, a = r.dict;
      return i.alreadyParsed = !1, i.shouldWaitForTick = n || function() {
        return !1;
      }, i.firstOffset = a.lookup(x.of("First"), ae).asNumber(), i.objectCount = a.lookup(x.of("N"), ae).asNumber(), i;
    }
    return t.prototype.parseIntoContext = function() {
      return fe(this, void 0, void 0, function() {
        var r, n, i, a, o, s, l, u;
        return he(this, function(c) {
          switch (c.label) {
            case 0:
              if (this.alreadyParsed)
                throw new Bf("PDFObjectStreamParser", "parseIntoContext");
              this.alreadyParsed = !0, r = this.parseOffsetsAndObjectNumbers(), n = 0, i = r.length, c.label = 1;
            case 1:
              return n < i ? (a = r[n], o = a.objectNumber, s = a.offset, this.bytes.moveTo(this.firstOffset + s), l = this.parseObject(), u = Re.of(o, 0), this.context.assign(u, l), this.shouldWaitForTick() ? [4, Ui()] : [3, 3]) : [3, 4];
            case 2:
              c.sent(), c.label = 3;
            case 3:
              return n++, [3, 1];
            case 4:
              return [
                2
                /*return*/
              ];
          }
        });
      });
    }, t.prototype.parseOffsetsAndObjectNumbers = function() {
      for (var r = [], n = 0, i = this.objectCount; n < i; n++) {
        this.skipWhitespaceAndComments();
        var a = this.parseRawInt();
        this.skipWhitespaceAndComments();
        var o = this.parseRawInt();
        r.push({ objectNumber: a, offset: o });
      }
      return r;
    }, t.forStream = function(r, n) {
      return new t(r, n);
    }, t;
  }(my)
), Ck = (
  /** @class */
  function() {
    function e(t) {
      this.alreadyParsed = !1, this.dict = t.dict, this.bytes = Yl.fromPDFRawStream(t), this.context = this.dict.context;
      var r = this.dict.lookup(x.of("Size"), ae), n = this.dict.lookup(x.of("Index"));
      if (n instanceof Ee) {
        this.subsections = [];
        for (var i = 0, a = n.size(); i < a; i += 2) {
          var o = n.lookup(i + 0, ae).asNumber(), s = n.lookup(i + 1, ae).asNumber();
          this.subsections.push({ firstObjectNumber: o, length: s });
        }
      } else
        this.subsections = [{ firstObjectNumber: 0, length: r.asNumber() }];
      var l = this.dict.lookup(x.of("W"), Ee);
      this.byteWidths = [-1, -1, -1];
      for (var i = 0, a = l.size(); i < a; i++)
        this.byteWidths[i] = l.lookup(i, ae).asNumber();
    }
    return e.prototype.parseIntoContext = function() {
      if (this.alreadyParsed)
        throw new Bf("PDFXRefStreamParser", "parseIntoContext");
      this.alreadyParsed = !0, this.context.trailerInfo = {
        Root: this.dict.get(x.of("Root")),
        Encrypt: this.dict.get(x.of("Encrypt")),
        Info: this.dict.get(x.of("Info")),
        ID: this.dict.get(x.of("ID"))
      };
      var t = this.parseEntries();
      return t;
    }, e.prototype.parseEntries = function() {
      for (var t = [], r = this.byteWidths, n = r[0], i = r[1], a = r[2], o = 0, s = this.subsections.length; o < s; o++)
        for (var l = this.subsections[o], u = l.firstObjectNumber, c = l.length, f = 0; f < c; f++) {
          for (var h = 0, d = 0, p = n; d < p; d++)
            h = h << 8 | this.bytes.next();
          for (var v = 0, d = 0, p = i; d < p; d++)
            v = v << 8 | this.bytes.next();
          for (var y = 0, d = 0, p = a; d < p; d++)
            y = y << 8 | this.bytes.next();
          n === 0 && (h = 1);
          var m = u + f, S = {
            ref: Re.of(m, y),
            offset: v,
            deleted: h === 0,
            inObjectStream: h === 2
          };
          t.push(S);
        }
      return t;
    }, e.forStream = function(t) {
      return new e(t);
    }, e;
  }()
), Ak = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i, a) {
      n === void 0 && (n = 1 / 0), i === void 0 && (i = !1), a === void 0 && (a = !1);
      var o = e.call(this, Yl.of(r), Lc.create(), a) || this;
      return o.alreadyParsed = !1, o.parsedObjects = 0, o.shouldWaitForTick = function() {
        return o.parsedObjects += 1, o.parsedObjects % o.objectsPerTick === 0;
      }, o.objectsPerTick = n, o.throwOnInvalidObject = i, o;
    }
    return t.prototype.parseDocument = function() {
      return fe(this, void 0, void 0, function() {
        var r, n;
        return he(this, function(i) {
          switch (i.label) {
            case 0:
              if (this.alreadyParsed)
                throw new Bf("PDFParser", "parseDocument");
              this.alreadyParsed = !0, this.context.header = this.parseHeader(), i.label = 1;
            case 1:
              return this.bytes.done() ? [3, 3] : [4, this.parseDocumentSection()];
            case 2:
              if (i.sent(), n = this.bytes.offset(), n === r)
                throw new UD(this.bytes.position());
              return r = n, [3, 1];
            case 3:
              return this.maybeRecoverRoot(), this.context.lookup(Re.of(0)) && (console.warn("Removing parsed object: 0 0 R"), this.context.delete(Re.of(0))), [2, this.context];
          }
        });
      });
    }, t.prototype.maybeRecoverRoot = function() {
      var r = function(c) {
        return c instanceof ce && c.lookup(x.of("Type")) === x.of("Catalog");
      }, n = this.context.lookup(this.context.trailerInfo.Root);
      if (!r(n))
        for (var i = this.context.enumerateIndirectObjects(), a = 0, o = i.length; a < o; a++) {
          var s = i[a], l = s[0], u = s[1];
          r(u) && (this.context.trailerInfo.Root = l);
        }
    }, t.prototype.parseHeader = function() {
      for (; !this.bytes.done(); ) {
        if (this.matchKeyword(ke.header)) {
          var r = this.parseRawInt();
          this.bytes.assertNext(E.Period);
          var n = this.parseRawInt(), i = zl.forVersion(r, n);
          return this.skipBinaryHeaderComment(), i;
        }
        this.bytes.next();
      }
      throw new LD(this.bytes.position());
    }, t.prototype.parseIndirectObjectHeader = function() {
      this.skipWhitespaceAndComments();
      var r = this.parseRawInt();
      this.skipWhitespaceAndComments();
      var n = this.parseRawInt();
      if (this.skipWhitespaceAndComments(), !this.matchKeyword(ke.obj))
        throw new BD(this.bytes.position(), ke.obj);
      return Re.of(r, n);
    }, t.prototype.matchIndirectObjectHeader = function() {
      var r = this.bytes.offset();
      try {
        return this.parseIndirectObjectHeader(), !0;
      } catch {
        return this.bytes.moveTo(r), !1;
      }
    }, t.prototype.parseIndirectObject = function() {
      return fe(this, void 0, void 0, function() {
        var r, n;
        return he(this, function(i) {
          switch (i.label) {
            case 0:
              return r = this.parseIndirectObjectHeader(), this.skipWhitespaceAndComments(), n = this.parseObject(), this.skipWhitespaceAndComments(), this.matchKeyword(ke.endobj), n instanceof ao && n.dict.lookup(x.of("Type")) === x.of("ObjStm") ? [4, Tk.forStream(n, this.shouldWaitForTick).parseIntoContext()] : [3, 2];
            case 1:
              return i.sent(), [3, 3];
            case 2:
              n instanceof ao && n.dict.lookup(x.of("Type")) === x.of("XRef") ? Ck.forStream(n).parseIntoContext() : this.context.assign(r, n), i.label = 3;
            case 3:
              return [2, r];
          }
        });
      });
    }, t.prototype.tryToParseInvalidIndirectObject = function() {
      var r = this.bytes.position(), n = "Trying to parse invalid object: " + JSON.stringify(r) + ")";
      if (this.throwOnInvalidObject)
        throw new Error(n);
      console.warn(n);
      var i = this.parseIndirectObjectHeader();
      console.warn("Invalid object ref: " + i), this.skipWhitespaceAndComments();
      for (var a = this.bytes.offset(), o = !0; !this.bytes.done() && (this.matchKeyword(ke.endobj) && (o = !1), !!o); )
        this.bytes.next();
      if (o)
        throw new kD(r);
      var s = this.bytes.offset() - ke.endobj.length, l = ay.of(this.bytes.slice(a, s));
      return this.context.assign(i, l), i;
    }, t.prototype.parseIndirectObjects = function() {
      return fe(this, void 0, void 0, function() {
        var r;
        return he(this, function(n) {
          switch (n.label) {
            case 0:
              this.skipWhitespaceAndComments(), n.label = 1;
            case 1:
              if (!(!this.bytes.done() && vt[this.bytes.peek()])) return [3, 8];
              r = this.bytes.offset(), n.label = 2;
            case 2:
              return n.trys.push([2, 4, , 5]), [4, this.parseIndirectObject()];
            case 3:
              return n.sent(), [3, 5];
            case 4:
              return n.sent(), this.bytes.moveTo(r), this.tryToParseInvalidIndirectObject(), [3, 5];
            case 5:
              return this.skipWhitespaceAndComments(), this.skipJibberish(), this.shouldWaitForTick() ? [4, Ui()] : [3, 7];
            case 6:
              n.sent(), n.label = 7;
            case 7:
              return [3, 1];
            case 8:
              return [
                2
                /*return*/
              ];
          }
        });
      });
    }, t.prototype.maybeParseCrossRefSection = function() {
      if (this.skipWhitespaceAndComments(), !!this.matchKeyword(ke.xref)) {
        this.skipWhitespaceAndComments();
        for (var r = -1, n = ry.createEmpty(); !this.bytes.done() && vt[this.bytes.peek()]; ) {
          var i = this.parseRawInt();
          this.skipWhitespaceAndComments();
          var a = this.parseRawInt();
          this.skipWhitespaceAndComments();
          var o = this.bytes.peek();
          if (o === E.n || o === E.f) {
            var s = Re.of(r, a);
            this.bytes.next() === E.n ? n.addEntry(s, i) : n.addDeletedEntry(s, i), r += 1;
          } else
            r = i;
          this.skipWhitespaceAndComments();
        }
        return n;
      }
    }, t.prototype.maybeParseTrailerDict = function() {
      if (this.skipWhitespaceAndComments(), !!this.matchKeyword(ke.trailer)) {
        this.skipWhitespaceAndComments();
        var r = this.parseDict(), n = this.context;
        n.trailerInfo = {
          Root: r.get(x.of("Root")) || n.trailerInfo.Root,
          Encrypt: r.get(x.of("Encrypt")) || n.trailerInfo.Encrypt,
          Info: r.get(x.of("Info")) || n.trailerInfo.Info,
          ID: r.get(x.of("ID")) || n.trailerInfo.ID
        };
      }
    }, t.prototype.maybeParseTrailer = function() {
      if (this.skipWhitespaceAndComments(), !!this.matchKeyword(ke.startxref)) {
        this.skipWhitespaceAndComments();
        var r = this.parseRawInt();
        return this.skipWhitespace(), this.matchKeyword(ke.eof), this.skipWhitespaceAndComments(), this.matchKeyword(ke.eof), this.skipWhitespaceAndComments(), zf.forLastCrossRefSectionOffset(r);
      }
    }, t.prototype.parseDocumentSection = function() {
      return fe(this, void 0, void 0, function() {
        return he(this, function(r) {
          switch (r.label) {
            case 0:
              return [4, this.parseIndirectObjects()];
            case 1:
              return r.sent(), this.maybeParseCrossRefSection(), this.maybeParseTrailerDict(), this.maybeParseTrailer(), this.skipJibberish(), [
                2
                /*return*/
              ];
          }
        });
      });
    }, t.prototype.skipJibberish = function() {
      for (this.skipWhitespaceAndComments(); !this.bytes.done(); ) {
        var r = this.bytes.offset(), n = this.bytes.peek(), i = n >= E.Space && n <= E.Tilde;
        if (i && (this.matchKeyword(ke.xref) || this.matchKeyword(ke.trailer) || this.matchKeyword(ke.startxref) || this.matchIndirectObjectHeader())) {
          this.bytes.moveTo(r);
          break;
        }
        this.bytes.next();
      }
    }, t.prototype.skipBinaryHeaderComment = function() {
      this.skipWhitespaceAndComments();
      try {
        var r = this.bytes.offset();
        this.parseIndirectObjectHeader(), this.bytes.moveTo(r);
      } catch {
        this.bytes.next(), this.skipWhitespaceAndComments();
      }
    }, t.forBytesWithOptions = function(r, n, i, a) {
      return new t(r, n, i, a);
    }, t;
  }(my)
), yr = function(e) {
  return 1 << e;
}, Ua;
(function(e) {
  e[e.Invisible = yr(0)] = "Invisible", e[e.Hidden = yr(1)] = "Hidden", e[e.Print = yr(2)] = "Print", e[e.NoZoom = yr(3)] = "NoZoom", e[e.NoRotate = yr(4)] = "NoRotate", e[e.NoView = yr(5)] = "NoView", e[e.ReadOnly = yr(6)] = "ReadOnly", e[e.Locked = yr(7)] = "Locked", e[e.ToggleNoView = yr(8)] = "ToggleNoView", e[e.LockedContents = yr(9)] = "LockedContents";
})(Ua || (Ua = {}));
var Zl = function(e) {
  return e instanceof x ? e : x.of(e);
}, oe = function(e) {
  return e instanceof ae ? e : ae.of(e);
}, de = function(e) {
  return e instanceof ae ? e.asNumber() : e;
}, oo;
(function(e) {
  e.Degrees = "degrees", e.Radians = "radians";
})(oo || (oo = {}));
var ie = function(e) {
  return D(e, "degreeAngle", ["number"]), { type: oo.Degrees, angle: e };
}, yy = oo.Radians, by = oo.Degrees, wy = function(e) {
  return e * Math.PI / 180;
}, Pk = function(e) {
  return e * 180 / Math.PI;
}, ct = function(e) {
  return e.type === yy ? e.angle : e.type === by ? wy(e.angle) : So("Invalid rotation: " + JSON.stringify(e));
}, xy = function(e) {
  return e.type === yy ? Pk(e.angle) : e.type === by ? e.angle : So("Invalid rotation: " + JSON.stringify(e));
}, Mr = function(e) {
  e === void 0 && (e = 0);
  var t = e / 90 % 4;
  return t === 0 ? 0 : t === 1 ? 90 : t === 2 ? 180 : t === 3 ? 270 : 0;
}, ei = function(e, t) {
  t === void 0 && (t = 0);
  var r = Mr(t);
  return r === 90 || r === 270 ? { width: e.height, height: e.width } : { width: e.width, height: e.height };
}, Rk = function(e, t, r) {
  t === void 0 && (t = 0), r === void 0 && (r = 0);
  var n = e.x, i = e.y, a = e.width, o = e.height, s = Mr(r), l = t / 2;
  return s === 0 ? { x: n - l, y: i - l, width: a, height: o } : s === 90 ? { x: n - o + l, y: i - l, width: o, height: a } : s === 180 ? { x: n - a + l, y: i - o + l, width: a, height: o } : s === 270 ? { x: n - l, y: i - a + l, width: o, height: a } : { x: n - l, y: i - l, width: a, height: o };
}, Ey = function() {
  return me.of(we.ClipNonZero);
}, nl = Math.cos, il = Math.sin, al = Math.tan, Jl = function(e, t, r, n, i, a) {
  return me.of(we.ConcatTransformationMatrix, [
    oe(e),
    oe(t),
    oe(r),
    oe(n),
    oe(i),
    oe(a)
  ]);
}, Kt = function(e, t) {
  return Jl(1, 0, 0, 1, e, t);
}, so = function(e, t) {
  return Jl(e, 0, 0, t, 0, 0);
}, Ki = function(e) {
  return Jl(nl(de(e)), il(de(e)), -il(de(e)), nl(de(e)), 0, 0);
}, ms = function(e) {
  return Ki(wy(de(e)));
}, Xf = function(e, t) {
  return Jl(1, al(de(e)), al(de(t)), 1, 0, 0);
}, Ql = function(e, t) {
  return me.of(we.SetLineDashPattern, [
    "[" + e.map(oe).join(" ") + "]",
    oe(t)
  ]);
}, Fi;
(function(e) {
  e[e.Butt = 0] = "Butt", e[e.Round = 1] = "Round", e[e.Projecting = 2] = "Projecting";
})(Fi || (Fi = {}));
var $l = function(e) {
  return me.of(we.SetLineCapStyle, [oe(e)]);
}, Ap;
(function(e) {
  e[e.Miter = 0] = "Miter", e[e.Round = 1] = "Round", e[e.Bevel = 2] = "Bevel";
})(Ap || (Ap = {}));
var ti = function(e) {
  return me.of(we.SetGraphicsStateParams, [Zl(e)]);
}, Qe = function() {
  return me.of(we.PushGraphicsState);
}, $e = function() {
  return me.of(we.PopGraphicsState);
}, Ro = function(e) {
  return me.of(we.SetLineWidth, [oe(e)]);
}, Bt = function(e, t, r, n, i, a) {
  return me.of(we.AppendBezierCurve, [
    oe(e),
    oe(t),
    oe(r),
    oe(n),
    oe(i),
    oe(a)
  ]);
}, ys = function(e, t, r, n) {
  return me.of(we.CurveToReplicateInitialPoint, [
    oe(e),
    oe(t),
    oe(r),
    oe(n)
  ]);
}, pn = function() {
  return me.of(we.ClosePath);
}, Sr = function(e, t) {
  return me.of(we.MoveTo, [oe(e), oe(t)]);
}, nt = function(e, t) {
  return me.of(we.LineTo, [oe(e), oe(t)]);
}, Oo = function() {
  return me.of(we.StrokePath);
}, Yf = function() {
  return me.of(we.FillNonZero);
}, Zf = function() {
  return me.of(we.FillNonZeroAndStroke);
}, Sy = function() {
  return me.of(we.EndPath);
}, Ok = function() {
  return me.of(we.NextLine);
}, Fy = function(e) {
  return me.of(we.ShowText, [e]);
}, Ty = function() {
  return me.of(we.BeginText);
}, Cy = function() {
  return me.of(we.EndText);
}, Jf = function(e, t) {
  return me.of(we.SetFontAndSize, [Zl(e), oe(t)]);
}, Dk = function(e) {
  return me.of(we.SetTextLineHeight, [oe(e)]);
}, Pp;
(function(e) {
  e[e.Fill = 0] = "Fill", e[e.Outline = 1] = "Outline", e[e.FillAndOutline = 2] = "FillAndOutline", e[e.Invisible = 3] = "Invisible", e[e.FillAndClip = 4] = "FillAndClip", e[e.OutlineAndClip = 5] = "OutlineAndClip", e[e.FillAndOutlineAndClip = 6] = "FillAndOutlineAndClip", e[e.Clip = 7] = "Clip";
})(Pp || (Pp = {}));
var kk = function(e, t, r, n, i, a) {
  return me.of(we.SetTextMatrix, [
    oe(e),
    oe(t),
    oe(r),
    oe(n),
    oe(i),
    oe(a)
  ]);
}, Ay = function(e, t, r, n, i) {
  return kk(nl(de(e)), il(de(e)) + al(de(t)), -il(de(e)) + al(de(r)), nl(de(e)), n, i);
}, Qf = function(e) {
  return me.of(we.DrawObject, [Zl(e)]);
}, Nk = function(e) {
  return me.of(we.NonStrokingColorGray, [oe(e)]);
}, Ik = function(e) {
  return me.of(we.StrokingColorGray, [oe(e)]);
}, Uk = function(e, t, r) {
  return me.of(we.NonStrokingColorRgb, [
    oe(e),
    oe(t),
    oe(r)
  ]);
}, Lk = function(e, t, r) {
  return me.of(we.StrokingColorRgb, [
    oe(e),
    oe(t),
    oe(r)
  ]);
}, Bk = function(e, t, r, n) {
  return me.of(we.NonStrokingColorCmyk, [
    oe(e),
    oe(t),
    oe(r),
    oe(n)
  ]);
}, Mk = function(e, t, r, n) {
  return me.of(we.StrokingColorCmyk, [
    oe(e),
    oe(t),
    oe(r),
    oe(n)
  ]);
}, Py = function(e) {
  return me.of(we.BeginMarkedContent, [Zl(e)]);
}, Ry = function() {
  return me.of(we.EndMarkedContent);
}, vn;
(function(e) {
  e.Grayscale = "Grayscale", e.RGB = "RGB", e.CMYK = "CMYK";
})(vn || (vn = {}));
var Oy = function(e) {
  return Lt(e, "gray", 0, 1), { type: vn.Grayscale, gray: e };
}, Oe = function(e, t, r) {
  return Lt(e, "red", 0, 1), Lt(t, "green", 0, 1), Lt(r, "blue", 0, 1), { type: vn.RGB, red: e, green: t, blue: r };
}, Dy = function(e, t, r, n) {
  return Lt(e, "cyan", 0, 1), Lt(t, "magenta", 0, 1), Lt(r, "yellow", 0, 1), Lt(n, "key", 0, 1), { type: vn.CMYK, cyan: e, magenta: t, yellow: r, key: n };
}, $f = vn.Grayscale, eh = vn.RGB, th = vn.CMYK, ri = function(e) {
  return e.type === $f ? Nk(e.gray) : e.type === eh ? Uk(e.red, e.green, e.blue) : e.type === th ? Bk(e.cyan, e.magenta, e.yellow, e.key) : So("Invalid color: " + JSON.stringify(e));
}, Do = function(e) {
  return e.type === $f ? Ik(e.gray) : e.type === eh ? Lk(e.red, e.green, e.blue) : e.type === th ? Mk(e.cyan, e.magenta, e.yellow, e.key) : So("Invalid color: " + JSON.stringify(e));
}, Ft = function(e, t) {
  return t === void 0 && (t = 1), (e == null ? void 0 : e.length) === 1 ? Oy(e[0] * t) : (e == null ? void 0 : e.length) === 3 ? Oe(e[0] * t, e[1] * t, e[2] * t) : (e == null ? void 0 : e.length) === 4 ? Dy(e[0] * t, e[1] * t, e[2] * t, e[3] * t) : void 0;
}, Rp = function(e) {
  return e.type === $f ? [e.gray] : e.type === eh ? [e.red, e.green, e.blue] : e.type === th ? [e.cyan, e.magenta, e.yellow, e.key] : So("Invalid color: " + JSON.stringify(e));
}, Z = 0, J = 0, ve = 0, ge = 0, ya = 0, ba = 0, Op = /* @__PURE__ */ new Map([
  ["A", 7],
  ["a", 7],
  ["C", 6],
  ["c", 6],
  ["H", 1],
  ["h", 1],
  ["L", 2],
  ["l", 2],
  ["M", 2],
  ["m", 2],
  ["Q", 4],
  ["q", 4],
  ["S", 4],
  ["s", 4],
  ["T", 2],
  ["t", 2],
  ["V", 1],
  ["v", 1],
  ["Z", 0],
  ["z", 0]
]), jk = function(e) {
  for (var t, r = [], n = [], i = "", a = !1, o = 0, s = 0, l = e; s < l.length; s++) {
    var u = l[s];
    if (Op.has(u))
      o = Op.get(u), t && (i.length > 0 && (n[n.length] = +i), r[r.length] = { cmd: t, args: n }, n = [], i = "", a = !1), t = u;
    else if ([" ", ","].includes(u) || u === "-" && i.length > 0 && i[i.length - 1] !== "e" || u === "." && a) {
      if (i.length === 0)
        continue;
      n.length === o ? (r[r.length] = { cmd: t, args: n }, n = [+i], t === "M" && (t = "L"), t === "m" && (t = "l")) : n[n.length] = +i, a = u === ".", i = ["-", "."].includes(u) ? u : "";
    } else
      i += u, u === "." && (a = !0);
  }
  return i.length > 0 && (n.length === o ? (r[r.length] = { cmd: t, args: n }, n = [+i], t === "M" && (t = "L"), t === "m" && (t = "l")) : n[n.length] = +i), r[r.length] = { cmd: t, args: n }, r;
}, _k = function(e) {
  Z = J = ve = ge = ya = ba = 0;
  for (var t = [], r = 0; r < e.length; r++) {
    var n = e[r];
    if (n.cmd && typeof Dp[n.cmd] == "function") {
      var i = Dp[n.cmd](n.args);
      Array.isArray(i) ? t = t.concat(i) : t.push(i);
    }
  }
  return t;
}, Dp = {
  M: function(e) {
    return Z = e[0], J = e[1], ve = ge = null, ya = Z, ba = J, Sr(Z, J);
  },
  m: function(e) {
    return Z += e[0], J += e[1], ve = ge = null, ya = Z, ba = J, Sr(Z, J);
  },
  C: function(e) {
    return Z = e[4], J = e[5], ve = e[2], ge = e[3], Bt(e[0], e[1], e[2], e[3], e[4], e[5]);
  },
  c: function(e) {
    var t = Bt(e[0] + Z, e[1] + J, e[2] + Z, e[3] + J, e[4] + Z, e[5] + J);
    return ve = Z + e[2], ge = J + e[3], Z += e[4], J += e[5], t;
  },
  S: function(e) {
    (ve === null || ge === null) && (ve = Z, ge = J);
    var t = Bt(Z - (ve - Z), J - (ge - J), e[0], e[1], e[2], e[3]);
    return ve = e[0], ge = e[1], Z = e[2], J = e[3], t;
  },
  s: function(e) {
    (ve === null || ge === null) && (ve = Z, ge = J);
    var t = Bt(Z - (ve - Z), J - (ge - J), Z + e[0], J + e[1], Z + e[2], J + e[3]);
    return ve = Z + e[0], ge = J + e[1], Z += e[2], J += e[3], t;
  },
  Q: function(e) {
    return ve = e[0], ge = e[1], Z = e[2], J = e[3], ys(e[0], e[1], Z, J);
  },
  q: function(e) {
    var t = ys(e[0] + Z, e[1] + J, e[2] + Z, e[3] + J);
    return ve = Z + e[0], ge = J + e[1], Z += e[2], J += e[3], t;
  },
  T: function(e) {
    ve === null || ge === null ? (ve = Z, ge = J) : (ve = Z - (ve - Z), ge = J - (ge - J));
    var t = ys(ve, ge, e[0], e[1]);
    return ve = Z - (ve - Z), ge = J - (ge - J), Z = e[0], J = e[1], t;
  },
  t: function(e) {
    ve === null || ge === null ? (ve = Z, ge = J) : (ve = Z - (ve - Z), ge = J - (ge - J));
    var t = ys(ve, ge, Z + e[0], J + e[1]);
    return Z += e[0], J += e[1], t;
  },
  A: function(e) {
    var t = kp(Z, J, e);
    return Z = e[5], J = e[6], t;
  },
  a: function(e) {
    e[5] += Z, e[6] += J;
    var t = kp(Z, J, e);
    return Z = e[5], J = e[6], t;
  },
  L: function(e) {
    return Z = e[0], J = e[1], ve = ge = null, nt(Z, J);
  },
  l: function(e) {
    return Z += e[0], J += e[1], ve = ge = null, nt(Z, J);
  },
  H: function(e) {
    return Z = e[0], ve = ge = null, nt(Z, J);
  },
  h: function(e) {
    return Z += e[0], ve = ge = null, nt(Z, J);
  },
  V: function(e) {
    return J = e[0], ve = ge = null, nt(Z, J);
  },
  v: function(e) {
    return J += e[0], ve = ge = null, nt(Z, J);
  },
  Z: function() {
    var e = pn();
    return Z = ya, J = ba, e;
  },
  z: function() {
    var e = pn();
    return Z = ya, J = ba, e;
  }
}, kp = function(e, t, r) {
  for (var n = r[0], i = r[1], a = r[2], o = r[3], s = r[4], l = r[5], u = r[6], c = zk(l, u, n, i, o, s, a, e, t), f = [], h = 0, d = c; h < d.length; h++) {
    var p = d[h], v = qk.apply(void 0, p);
    f.push(Bt.apply(void 0, v));
  }
  return f;
}, zk = function(e, t, r, n, i, a, o, s, l) {
  var u = o * (Math.PI / 180), c = Math.sin(u), f = Math.cos(u);
  r = Math.abs(r), n = Math.abs(n), ve = f * (s - e) * 0.5 + c * (l - t) * 0.5, ge = f * (l - t) * 0.5 - c * (s - e) * 0.5;
  var h = ve * ve / (r * r) + ge * ge / (n * n);
  h > 1 && (h = Math.sqrt(h), r *= h, n *= h);
  var d = f / r, p = c / r, v = -c / n, y = f / n, m = d * s + p * l, S = v * s + y * l, T = d * e + p * t, C = v * e + y * t, A = (T - m) * (T - m) + (C - S) * (C - S), O = 1 / A - 0.25;
  O < 0 && (O = 0);
  var k = Math.sqrt(O);
  a === i && (k = -k);
  var M = 0.5 * (m + T) - k * (C - S), b = 0.5 * (S + C) + k * (T - m), j = Math.atan2(S - b, m - M), I = Math.atan2(C - b, T - M), q = I - j;
  q < 0 && a === 1 ? q += 2 * Math.PI : q > 0 && a === 0 && (q -= 2 * Math.PI);
  for (var z = Math.ceil(Math.abs(q / (Math.PI * 0.5 + 1e-3))), B = [], N = 0; N < z; N++) {
    var L = j + N * q / z, U = j + (N + 1) * q / z;
    B[N] = [M, b, L, U, r, n, c, f];
  }
  return B;
}, qk = function(e, t, r, n, i, a, o, s) {
  var l = s * i, u = -o * a, c = o * i, f = s * a, h = 0.5 * (n - r), d = 8 / 3 * Math.sin(h * 0.5) * Math.sin(h * 0.5) / Math.sin(h), p = e + Math.cos(r) - d * Math.sin(r), v = t + Math.sin(r) + d * Math.cos(r), y = e + Math.cos(n), m = t + Math.sin(n), S = y + d * Math.sin(n), T = m - d * Math.cos(n), C = [
    l * p + u * v,
    c * p + f * v,
    l * S + u * T,
    c * S + f * T,
    l * y + u * m,
    c * y + f * m
  ];
  return C;
}, Vk = function(e) {
  return _k(jk(e));
}, Hk = function(e, t) {
  for (var r = [
    Qe(),
    t.graphicsState && ti(t.graphicsState),
    Ty(),
    ri(t.color),
    Jf(t.font, t.size),
    Dk(t.lineHeight),
    Ay(ct(t.rotate), ct(t.xSkew), ct(t.ySkew), t.x, t.y)
  ].filter(Boolean), n = 0, i = e.length; n < i; n++)
    r.push(Fy(e[n]), Ok());
  return r.push(Cy(), $e()), r;
}, ky = function(e, t) {
  return [
    Qe(),
    t.graphicsState && ti(t.graphicsState),
    Kt(t.x, t.y),
    Ki(ct(t.rotate)),
    so(t.width, t.height),
    Xf(ct(t.xSkew), ct(t.ySkew)),
    Qf(e),
    $e()
  ].filter(Boolean);
}, Wk = function(e, t) {
  return [
    Qe(),
    t.graphicsState && ti(t.graphicsState),
    Kt(t.x, t.y),
    Ki(ct(t.rotate)),
    so(t.xScale, t.yScale),
    Xf(ct(t.xSkew), ct(t.ySkew)),
    Qf(e),
    $e()
  ].filter(Boolean);
}, Gk = function(e) {
  var t, r;
  return [
    Qe(),
    e.graphicsState && ti(e.graphicsState),
    e.color && Do(e.color),
    Ro(e.thickness),
    Ql((t = e.dashArray) !== null && t !== void 0 ? t : [], (r = e.dashPhase) !== null && r !== void 0 ? r : 0),
    Sr(e.start.x, e.start.y),
    e.lineCap && $l(e.lineCap),
    Sr(e.start.x, e.start.y),
    nt(e.end.x, e.end.y),
    Oo(),
    $e()
  ].filter(Boolean);
}, Li = function(e) {
  var t, r;
  return [
    Qe(),
    e.graphicsState && ti(e.graphicsState),
    e.color && ri(e.color),
    e.borderColor && Do(e.borderColor),
    Ro(e.borderWidth),
    e.borderLineCap && $l(e.borderLineCap),
    Ql((t = e.borderDashArray) !== null && t !== void 0 ? t : [], (r = e.borderDashPhase) !== null && r !== void 0 ? r : 0),
    Kt(e.x, e.y),
    Ki(ct(e.rotate)),
    Xf(ct(e.xSkew), ct(e.ySkew)),
    Sr(0, 0),
    nt(0, e.height),
    nt(e.width, e.height),
    nt(e.width, 0),
    pn(),
    // prettier-ignore
    e.color && e.borderWidth ? Zf() : e.color ? Yf() : e.borderColor ? Oo() : pn(),
    $e()
  ].filter(Boolean);
}, ol = 4 * ((Math.sqrt(2) - 1) / 3), Kk = function(e) {
  var t = de(e.x), r = de(e.y), n = de(e.xScale), i = de(e.yScale);
  t -= n, r -= i;
  var a = n * ol, o = i * ol, s = t + n * 2, l = r + i * 2, u = t + n, c = r + i;
  return [
    Qe(),
    Sr(t, c),
    Bt(t, c - o, u - a, r, u, r),
    Bt(u + a, r, s, c - o, s, c),
    Bt(s, c + o, u + a, l, u, l),
    Bt(u - a, l, t, c + o, t, c),
    $e()
  ];
}, Xk = function(e) {
  var t = de(e.x), r = de(e.y), n = de(e.xScale), i = de(e.yScale), a = -n, o = -i, s = n * ol, l = i * ol, u = a + n * 2, c = o + i * 2, f = a + n, h = o + i;
  return [
    Kt(t, r),
    Ki(ct(e.rotate)),
    Sr(a, h),
    Bt(a, h - l, f - s, o, f, o),
    Bt(f + s, o, u, h - l, u, h),
    Bt(u, h + l, f + s, c, f, c),
    Bt(f - s, c, a, h + l, a, h)
  ];
}, _c = function(e) {
  var t, r, n;
  return be([
    Qe(),
    e.graphicsState && ti(e.graphicsState),
    e.color && ri(e.color),
    e.borderColor && Do(e.borderColor),
    Ro(e.borderWidth),
    e.borderLineCap && $l(e.borderLineCap),
    Ql((t = e.borderDashArray) !== null && t !== void 0 ? t : [], (r = e.borderDashPhase) !== null && r !== void 0 ? r : 0)
  ], e.rotate === void 0 ? Kk({
    x: e.x,
    y: e.y,
    xScale: e.xScale,
    yScale: e.yScale
  }) : Xk({
    x: e.x,
    y: e.y,
    xScale: e.xScale,
    yScale: e.yScale,
    rotate: (n = e.rotate) !== null && n !== void 0 ? n : ie(0)
  }), [
    // prettier-ignore
    e.color && e.borderWidth ? Zf() : e.color ? Yf() : e.borderColor ? Oo() : pn(),
    $e()
  ]).filter(Boolean);
}, Yk = function(e, t) {
  var r, n, i;
  return be([
    Qe(),
    t.graphicsState && ti(t.graphicsState),
    Kt(t.x, t.y),
    Ki(ct((r = t.rotate) !== null && r !== void 0 ? r : ie(0))),
    // SVG path Y axis is opposite pdf-lib's
    t.scale ? so(t.scale, -t.scale) : so(1, -1),
    t.color && ri(t.color),
    t.borderColor && Do(t.borderColor),
    t.borderWidth && Ro(t.borderWidth),
    t.borderLineCap && $l(t.borderLineCap),
    Ql((n = t.borderDashArray) !== null && n !== void 0 ? n : [], (i = t.borderDashPhase) !== null && i !== void 0 ? i : 0)
  ], Vk(e), [
    // prettier-ignore
    t.color && t.borderWidth ? Zf() : t.color ? Yf() : t.borderColor ? Oo() : pn(),
    $e()
  ]).filter(Boolean);
}, Zk = function(e) {
  var t = de(e.size), r = -1 + 0.75, n = -1 + 0.51, i = 1 - 0.525, a = 1 - 0.31, o = -1 + 0.325, s = 0.3995 / (i - n) + n;
  return [
    Qe(),
    e.color && Do(e.color),
    Ro(e.thickness),
    Kt(e.x, e.y),
    Sr(o * t, s * t),
    nt(r * t, n * t),
    nt(a * t, i * t),
    Oo(),
    $e()
  ].filter(Boolean);
}, En = function(e) {
  return e.rotation === 0 ? [
    Kt(0, 0),
    ms(0)
  ] : e.rotation === 90 ? [
    Kt(e.width, 0),
    ms(90)
  ] : e.rotation === 180 ? [
    Kt(e.width, e.height),
    ms(180)
  ] : e.rotation === 270 ? [
    Kt(0, e.height),
    ms(270)
  ] : [];
}, bs = function(e) {
  var t = Li({
    x: e.x,
    y: e.y,
    width: e.width,
    height: e.height,
    borderWidth: e.borderWidth,
    color: e.color,
    borderColor: e.borderColor,
    rotate: ie(0),
    xSkew: ie(0),
    ySkew: ie(0)
  });
  if (!e.filled)
    return t;
  var r = de(e.width), n = de(e.height), i = Math.min(r, n) / 2, a = Zk({
    x: r / 2,
    y: n / 2,
    size: i,
    thickness: e.thickness,
    color: e.markColor
  });
  return be([Qe()], t, a, [$e()]);
}, ws = function(e) {
  var t = de(e.width), r = de(e.height), n = Math.min(t, r) / 2, i = _c({
    x: e.x,
    y: e.y,
    xScale: n,
    yScale: n,
    color: e.color,
    borderColor: e.borderColor,
    borderWidth: e.borderWidth
  });
  if (!e.filled)
    return i;
  var a = _c({
    x: e.x,
    y: e.y,
    xScale: n * 0.45,
    yScale: n * 0.45,
    color: e.dotColor,
    borderColor: void 0,
    borderWidth: 0
  });
  return be([Qe()], i, a, [$e()]);
}, Np = function(e) {
  var t = de(e.x), r = de(e.y), n = de(e.width), i = de(e.height), a = Li({
    x: t,
    y: r,
    width: n,
    height: i,
    borderWidth: e.borderWidth,
    color: e.color,
    borderColor: e.borderColor,
    rotate: ie(0),
    xSkew: ie(0),
    ySkew: ie(0)
  }), o = rh(e.textLines, {
    color: e.textColor,
    font: e.font,
    size: e.fontSize,
    rotate: ie(0),
    xSkew: ie(0),
    ySkew: ie(0)
  });
  return be([Qe()], a, o, [$e()]);
}, rh = function(e, t) {
  for (var r = [
    Ty(),
    ri(t.color),
    Jf(t.font, t.size)
  ], n = 0, i = e.length; n < i; n++) {
    var a = e[n], o = a.encoded, s = a.x, l = a.y;
    r.push(Ay(ct(t.rotate), ct(t.xSkew), ct(t.ySkew), s, l), Fy(o));
  }
  return r.push(Cy()), r;
}, Ny = function(e) {
  var t = de(e.x), r = de(e.y), n = de(e.width), i = de(e.height), a = de(e.borderWidth), o = de(e.padding), s = t + a / 2 + o, l = r + a / 2 + o, u = n - (a / 2 + o) * 2, c = i - (a / 2 + o) * 2, f = [
    Sr(s, l),
    nt(s, l + c),
    nt(s + u, l + c),
    nt(s + u, l),
    pn(),
    Ey(),
    Sy()
  ], h = Li({
    x: t,
    y: r,
    width: n,
    height: i,
    borderWidth: e.borderWidth,
    color: e.color,
    borderColor: e.borderColor,
    rotate: ie(0),
    xSkew: ie(0),
    ySkew: ie(0)
  }), d = rh(e.textLines, {
    color: e.textColor,
    font: e.font,
    size: e.fontSize,
    rotate: ie(0),
    xSkew: ie(0),
    ySkew: ie(0)
  }), p = be([
    Py("Tx"),
    Qe()
  ], d, [
    $e(),
    Ry()
  ]);
  return be([
    Qe()
  ], h, f, p, [
    $e()
  ]);
}, Jk = function(e) {
  for (var t = de(e.x), r = de(e.y), n = de(e.width), i = de(e.height), a = de(e.lineHeight), o = de(e.borderWidth), s = de(e.padding), l = t + o / 2 + s, u = r + o / 2 + s, c = n - (o / 2 + s) * 2, f = i - (o / 2 + s) * 2, h = [
    Sr(l, u),
    nt(l, u + f),
    nt(l + c, u + f),
    nt(l + c, u),
    pn(),
    Ey(),
    Sy()
  ], d = Li({
    x: t,
    y: r,
    width: n,
    height: i,
    borderWidth: e.borderWidth,
    color: e.color,
    borderColor: e.borderColor,
    rotate: ie(0),
    xSkew: ie(0),
    ySkew: ie(0)
  }), p = [], v = 0, y = e.selectedLines.length; v < y; v++) {
    var m = e.textLines[e.selectedLines[v]];
    p.push.apply(p, Li({
      x: m.x - s,
      y: m.y - (a - m.height) / 2,
      width: n - o,
      height: m.height + (a - m.height) / 2,
      borderWidth: 0,
      color: e.selectedColor,
      borderColor: void 0,
      rotate: ie(0),
      xSkew: ie(0),
      ySkew: ie(0)
    }));
  }
  var S = rh(e.textLines, {
    color: e.textColor,
    font: e.font,
    size: e.fontSize,
    rotate: ie(0),
    xSkew: ie(0),
    ySkew: ie(0)
  }), T = be([
    Py("Tx"),
    Qe()
  ], S, [
    $e(),
    Ry()
  ]);
  return be([
    Qe()
  ], d, p, h, T, [
    $e()
  ]);
}, Qk = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      var r = this, n = "Input document to `PDFDocument.load` is encrypted. You can use `PDFDocument.load(..., { ignoreEncryption: true })` if you wish to load the document anyways.";
      return r = e.call(this, n) || this, r;
    }
    return t;
  }(Error)
), $k = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      var r = this, n = "Input to `PDFDocument.embedFont` was a custom font, but no `fontkit` instance was found. You must register a `fontkit` instance with `PDFDocument.registerFontkit(...)` before embedding custom fonts.";
      return r = e.call(this, n) || this, r;
    }
    return t;
  }(Error)
), eN = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      var r = this, n = "A `page` passed to `PDFDocument.addPage` or `PDFDocument.insertPage` was from a different (foreign) PDF document. If you want to copy pages from one PDFDocument to another, you must use `PDFDocument.copyPages(...)` to copy the pages before adding or inserting them.";
      return r = e.call(this, n) || this, r;
    }
    return t;
  }(Error)
), tN = (
  /** @class */
  function(e) {
    K(t, e);
    function t() {
      var r = this, n = "PDFDocument has no pages so `PDFDocument.removePage` cannot be called";
      return r = e.call(this, n) || this, r;
    }
    return t;
  }(Error)
), rN = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = 'PDFDocument has no form field with the name "' + r + '"';
      return n = e.call(this, i) || this, n;
    }
    return t;
  }(Error)
), Rn = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      var a, o, s = this, l = n == null ? void 0 : n.name, u = (o = (a = i == null ? void 0 : i.constructor) === null || a === void 0 ? void 0 : a.name) !== null && o !== void 0 ? o : i, c = 'Expected field "' + r + '" to be of type ' + l + ", " + ("but it is actually of type " + u);
      return s = e.call(this, c) || this, s;
    }
    return t;
  }(Error)
);
(function(e) {
  K(t, e);
  function t(r) {
    var n = this, i = 'Failed to select check box due to missing onValue: "' + r + '"';
    return n = e.call(this, i) || this, n;
  }
  return t;
})(Error);
var Iy = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = 'A field already exists with the specified name: "' + r + '"';
      return n = e.call(this, i) || this, n;
    }
    return t;
  }(Error)
), nN = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = 'Field name contains invalid component: "' + r + '"';
      return n = e.call(this, i) || this, n;
    }
    return t;
  }(Error)
);
(function(e) {
  K(t, e);
  function t(r) {
    var n = this, i = 'A non-terminal field already exists with the specified name: "' + r + '"';
    return n = e.call(this, i) || this, n;
  }
  return t;
})(Error);
var iN = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r) {
      var n = this, i = "Reading rich text fields is not supported: Attempted to read rich text field: " + r;
      return n = e.call(this, i) || this, n;
    }
    return t;
  }(Error)
), aN = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n) {
      var i = this, a = "Failed to layout combed text as lineLength=" + r + " is greater than cellCount=" + n;
      return i = e.call(this, a) || this, i;
    }
    return t;
  }(Error)
), oN = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      var a = this, o = "Attempted to set text with length=" + r + " for TextField with maxLength=" + n + " and name=" + i;
      return a = e.call(this, o) || this, a;
    }
    return t;
  }(Error)
), sN = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      var a = this, o = "Attempted to set maxLength=" + n + ", which is less than " + r + ", the length of this field's current value (name=" + i + ")";
      return a = e.call(this, o) || this, a;
    }
    return t;
  }(Error)
), Ze;
(function(e) {
  e[e.Left = 0] = "Left", e[e.Center = 1] = "Center", e[e.Right = 2] = "Right";
})(Ze || (Ze = {}));
var Uy = 4, Ly = 500, By = function(e, t, r, n) {
  n === void 0 && (n = !1);
  for (var i = Uy; i < Ly; ) {
    for (var a = 0, o = 0, s = e.length; o < s; o++) {
      a += 1;
      for (var l = e[o], u = l.split(" "), c = r.width, f = 0, h = u.length; f < h; f++) {
        var d = f === h - 1, p = d ? u[f] : u[f] + " ", v = t.widthOfTextAtSize(p, i);
        c -= v, c <= 0 && (a += 1, c = r.width - v);
      }
    }
    if (!n && a > e.length)
      return i - 1;
    var y = t.heightAtSize(i), m = y + y * 0.2, S = m * a;
    if (S > Math.abs(r.height))
      return i - 1;
    i += 1;
  }
  return i;
}, lN = function(e, t, r, n) {
  for (var i = r.width / n, a = r.height, o = Uy, s = BR(e); o < Ly; ) {
    for (var l = 0, u = s.length; l < u; l++) {
      var c = s[l], f = t.widthOfTextAtSize(c, o) > i * 0.75;
      if (f)
        return o - 1;
    }
    var h = t.heightAtSize(o, { descender: !1 });
    if (h > a)
      return o - 1;
    o += 1;
  }
  return o;
}, uN = function(e) {
  for (var t = e.length; t > 0; t--)
    if (/\s/.test(e[t]))
      return t;
}, cN = function(e, t, r, n) {
  for (var i, a = e.length; a > 0; ) {
    var o = e.substring(0, a), s = r.encodeText(o), l = r.widthOfTextAtSize(o, n);
    if (l < t) {
      var u = e.substring(a) || void 0;
      return { line: o, encoded: s, width: l, remainder: u };
    }
    a = (i = uN(o)) !== null && i !== void 0 ? i : 0;
  }
  return {
    line: e,
    encoded: r.encodeText(e),
    width: r.widthOfTextAtSize(e, n),
    remainder: void 0
  };
}, My = function(e, t) {
  var r = t.alignment, n = t.fontSize, i = t.font, a = t.bounds, o = $g(Eo(e));
  (n === void 0 || n === 0) && (n = By(o, i, a, !0));
  for (var s = i.heightAtSize(n), l = s + s * 0.2, u = [], c = a.x, f = a.y, h = a.x + a.width, d = a.y + a.height, p = a.y + a.height, v = 0, y = o.length; v < y; v++)
    for (var m = o[v]; m !== void 0; ) {
      var S = cN(m, a.width, i, n), T = S.line, C = S.encoded, A = S.width, O = S.remainder, k = r === Ze.Left ? a.x : r === Ze.Center ? a.x + a.width / 2 - A / 2 : r === Ze.Right ? a.x + a.width - A : a.x;
      p -= l, k < c && (c = k), p < f && (f = p), k + A > h && (h = k + A), p + s > d && (d = p + s), u.push({ text: T, encoded: C, width: A, height: s, x: k, y: p }), m = O == null ? void 0 : O.trim();
    }
  return {
    fontSize: n,
    lineHeight: l,
    lines: u,
    bounds: {
      x: c,
      y: f,
      width: h - c,
      height: d - f
    }
  };
}, fN = function(e, t) {
  var r = t.fontSize, n = t.font, i = t.bounds, a = t.cellCount, o = em(Eo(e));
  if (o.length > a)
    throw new aN(o.length, a);
  (r === void 0 || r === 0) && (r = lN(o, n, i, a));
  for (var s = i.width / a, l = n.heightAtSize(r, { descender: !1 }), u = i.y + (i.height / 2 - l / 2), c = [], f = i.x, h = i.y, d = i.x + i.width, p = i.y + i.height, v = 0, y = 0; v < a; ) {
    var m = tm(o, y), S = m[0], T = m[1], C = n.encodeText(S), A = n.widthOfTextAtSize(S, r), O = i.x + (s * v + s / 2), k = O - A / 2;
    k < f && (f = k), u < h && (h = u), k + A > d && (d = k + A), u + l > p && (p = u + l), c.push({ text: o, encoded: C, width: A, height: l, x: k, y: u }), v += 1, y += T;
  }
  return {
    fontSize: r,
    cells: c,
    bounds: {
      x: f,
      y: h,
      width: d - f,
      height: p - h
    }
  };
}, sl = function(e, t) {
  var r = t.alignment, n = t.fontSize, i = t.font, a = t.bounds, o = em(Eo(e));
  (n === void 0 || n === 0) && (n = By([o], i, a));
  var s = i.encodeText(o), l = i.widthOfTextAtSize(o, n), u = i.heightAtSize(n, { descender: !1 }), c = r === Ze.Left ? a.x : r === Ze.Center ? a.x + a.width / 2 - l / 2 : r === Ze.Right ? a.x + a.width - l : a.x, f = a.y + (a.height / 2 - u / 2);
  return {
    fontSize: n,
    line: { text: o, encoded: s, width: l, height: u, x: c, y: f },
    bounds: { x: c, y: f, width: l, height: u }
  };
}, Xi = function(e) {
  return "normal" in e ? e : { normal: e };
}, hN = /\/([^\0\t\n\f\r\ ]+)[\0\t\n\f\r\ ]+(\d*\.\d+|\d+)[\0\t\n\f\r\ ]+Tf/, gn = function(e) {
  var t, r, n = (t = e.getDefaultAppearance()) !== null && t !== void 0 ? t : "", i = (r = Pf(n, hN).match) !== null && r !== void 0 ? r : [], a = Number(i[2]);
  return isFinite(a) ? a : void 0;
}, dN = /(\d*\.\d+|\d+)[\0\t\n\f\r\ ]*(\d*\.\d+|\d+)?[\0\t\n\f\r\ ]*(\d*\.\d+|\d+)?[\0\t\n\f\r\ ]*(\d*\.\d+|\d+)?[\0\t\n\f\r\ ]+(g|rg|k)/, Jt = function(e) {
  var t, r = (t = e.getDefaultAppearance()) !== null && t !== void 0 ? t : "", n = Pf(r, dN).match, i = n ?? [], a = i[1], o = i[2], s = i[3], l = i[4], u = i[5];
  if (u === "g" && a)
    return Oy(Number(a));
  if (u === "rg" && a && o && s)
    return Oe(Number(a), Number(o), Number(s));
  if (u === "k" && a && o && s && l)
    return Dy(Number(a), Number(o), Number(s), Number(l));
}, Qt = function(e, t, r, n) {
  var i;
  n === void 0 && (n = 0);
  var a = [
    ri(t).toString(),
    Jf((i = r == null ? void 0 : r.name) !== null && i !== void 0 ? i : "dummy__noop", n).toString()
  ].join(`
`);
  e.setDefaultAppearance(a);
}, pN = function(e, t) {
  var r, n, i, a = Jt(t), o = Jt(e.acroField), s = t.getRectangle(), l = t.getAppearanceCharacteristics(), u = t.getBorderStyle(), c = (r = u == null ? void 0 : u.getWidth()) !== null && r !== void 0 ? r : 0, f = Mr(l == null ? void 0 : l.getRotation()), h = ei(s, f), d = h.width, p = h.height, v = En(le(le({}, s), { rotation: f })), y = Oe(0, 0, 0), m = (n = Ft(l == null ? void 0 : l.getBorderColor())) !== null && n !== void 0 ? n : y, S = Ft(l == null ? void 0 : l.getBackgroundColor()), T = Ft(l == null ? void 0 : l.getBackgroundColor(), 0.8), C = (i = a ?? o) !== null && i !== void 0 ? i : y;
  Qt(a ? t : e.acroField, C);
  var A = {
    x: 0 + c / 2,
    y: 0 + c / 2,
    width: d - c,
    height: p - c,
    thickness: 1.5,
    borderWidth: c,
    borderColor: m,
    markColor: C
  };
  return {
    normal: {
      on: be(v, bs(le(le({}, A), { color: S, filled: !0 }))),
      off: be(v, bs(le(le({}, A), { color: S, filled: !1 })))
    },
    down: {
      on: be(v, bs(le(le({}, A), { color: T, filled: !0 }))),
      off: be(v, bs(le(le({}, A), { color: T, filled: !1 })))
    }
  };
}, vN = function(e, t) {
  var r, n, i, a = Jt(t), o = Jt(e.acroField), s = t.getRectangle(), l = t.getAppearanceCharacteristics(), u = t.getBorderStyle(), c = (r = u == null ? void 0 : u.getWidth()) !== null && r !== void 0 ? r : 0, f = Mr(l == null ? void 0 : l.getRotation()), h = ei(s, f), d = h.width, p = h.height, v = En(le(le({}, s), { rotation: f })), y = Oe(0, 0, 0), m = (n = Ft(l == null ? void 0 : l.getBorderColor())) !== null && n !== void 0 ? n : y, S = Ft(l == null ? void 0 : l.getBackgroundColor()), T = Ft(l == null ? void 0 : l.getBackgroundColor(), 0.8), C = (i = a ?? o) !== null && i !== void 0 ? i : y;
  Qt(a ? t : e.acroField, C);
  var A = {
    x: d / 2,
    y: p / 2,
    width: d - c,
    height: p - c,
    borderWidth: c,
    borderColor: m,
    dotColor: C
  };
  return {
    normal: {
      on: be(v, ws(le(le({}, A), { color: S, filled: !0 }))),
      off: be(v, ws(le(le({}, A), { color: S, filled: !1 })))
    },
    down: {
      on: be(v, ws(le(le({}, A), { color: T, filled: !0 }))),
      off: be(v, ws(le(le({}, A), { color: T, filled: !1 })))
    }
  };
}, gN = function(e, t, r) {
  var n, i, a, o, s, l = Jt(t), u = Jt(e.acroField), c = gn(t), f = gn(e.acroField), h = t.getRectangle(), d = t.getAppearanceCharacteristics(), p = t.getBorderStyle(), v = d == null ? void 0 : d.getCaptions(), y = (n = v == null ? void 0 : v.normal) !== null && n !== void 0 ? n : "", m = (a = (i = v == null ? void 0 : v.down) !== null && i !== void 0 ? i : y) !== null && a !== void 0 ? a : "", S = (o = p == null ? void 0 : p.getWidth()) !== null && o !== void 0 ? o : 0, T = Mr(d == null ? void 0 : d.getRotation()), C = ei(h, T), A = C.width, O = C.height, k = En(le(le({}, h), { rotation: T })), M = Oe(0, 0, 0), b = Ft(d == null ? void 0 : d.getBorderColor()), j = Ft(d == null ? void 0 : d.getBackgroundColor()), I = Ft(d == null ? void 0 : d.getBackgroundColor(), 0.8), q = {
    x: S,
    y: S,
    width: A - S * 2,
    height: O - S * 2
  }, z = sl(y, {
    alignment: Ze.Center,
    fontSize: c ?? f,
    font: r,
    bounds: q
  }), B = sl(m, {
    alignment: Ze.Center,
    fontSize: c ?? f,
    font: r,
    bounds: q
  }), N = Math.min(z.fontSize, B.fontSize), L = (s = l ?? u) !== null && s !== void 0 ? s : M;
  Qt(l || c !== void 0 ? t : e.acroField, L, r, N);
  var U = {
    x: 0 + S / 2,
    y: 0 + S / 2,
    width: A - S,
    height: O - S,
    borderWidth: S,
    borderColor: b,
    textColor: L,
    font: r.name,
    fontSize: N
  };
  return {
    normal: be(k, Np(le(le({}, U), { color: j, textLines: [z.line] }))),
    down: be(k, Np(le(le({}, U), { color: I, textLines: [B.line] })))
  };
}, mN = function(e, t, r) {
  var n, i, a, o, s = Jt(t), l = Jt(e.acroField), u = gn(t), c = gn(e.acroField), f = t.getRectangle(), h = t.getAppearanceCharacteristics(), d = t.getBorderStyle(), p = (n = e.getText()) !== null && n !== void 0 ? n : "", v = (i = d == null ? void 0 : d.getWidth()) !== null && i !== void 0 ? i : 0, y = Mr(h == null ? void 0 : h.getRotation()), m = ei(f, y), S = m.width, T = m.height, C = En(le(le({}, f), { rotation: y })), A = Oe(0, 0, 0), O = Ft(h == null ? void 0 : h.getBorderColor()), k = Ft(h == null ? void 0 : h.getBackgroundColor()), M, b, j = e.isCombed() ? 0 : 1, I = {
    x: v + j,
    y: v + j,
    width: S - (v + j) * 2,
    height: T - (v + j) * 2
  };
  if (e.isMultiline()) {
    var q = My(p, {
      alignment: e.getAlignment(),
      fontSize: u ?? c,
      font: r,
      bounds: I
    });
    M = q.lines, b = q.fontSize;
  } else if (e.isCombed()) {
    var q = fN(p, {
      fontSize: u ?? c,
      font: r,
      bounds: I,
      cellCount: (a = e.getMaxLength()) !== null && a !== void 0 ? a : 0
    });
    M = q.cells, b = q.fontSize;
  } else {
    var q = sl(p, {
      alignment: e.getAlignment(),
      fontSize: u ?? c,
      font: r,
      bounds: I
    });
    M = [q.line], b = q.fontSize;
  }
  var z = (o = s ?? l) !== null && o !== void 0 ? o : A;
  Qt(s || u !== void 0 ? t : e.acroField, z, r, b);
  var B = {
    x: 0 + v / 2,
    y: 0 + v / 2,
    width: S - v,
    height: T - v,
    borderWidth: v ?? 0,
    borderColor: O,
    textColor: z,
    font: r.name,
    fontSize: b,
    color: k,
    textLines: M,
    padding: j
  };
  return be(C, Ny(B));
}, yN = function(e, t, r) {
  var n, i, a, o = Jt(t), s = Jt(e.acroField), l = gn(t), u = gn(e.acroField), c = t.getRectangle(), f = t.getAppearanceCharacteristics(), h = t.getBorderStyle(), d = (n = e.getSelected()[0]) !== null && n !== void 0 ? n : "", p = (i = h == null ? void 0 : h.getWidth()) !== null && i !== void 0 ? i : 0, v = Mr(f == null ? void 0 : f.getRotation()), y = ei(c, v), m = y.width, S = y.height, T = En(le(le({}, c), { rotation: v })), C = Oe(0, 0, 0), A = Ft(f == null ? void 0 : f.getBorderColor()), O = Ft(f == null ? void 0 : f.getBackgroundColor()), k = 1, M = {
    x: p + k,
    y: p + k,
    width: m - (p + k) * 2,
    height: S - (p + k) * 2
  }, b = sl(d, {
    alignment: Ze.Left,
    fontSize: l ?? u,
    font: r,
    bounds: M
  }), j = b.line, I = b.fontSize, q = (a = o ?? s) !== null && a !== void 0 ? a : C;
  Qt(o || l !== void 0 ? t : e.acroField, q, r, I);
  var z = {
    x: 0 + p / 2,
    y: 0 + p / 2,
    width: m - p,
    height: S - p,
    borderWidth: p ?? 0,
    borderColor: A,
    textColor: q,
    font: r.name,
    fontSize: I,
    color: O,
    textLines: [j],
    padding: k
  };
  return be(T, Ny(z));
}, bN = function(e, t, r) {
  var n, i, a = Jt(t), o = Jt(e.acroField), s = gn(t), l = gn(e.acroField), u = t.getRectangle(), c = t.getAppearanceCharacteristics(), f = t.getBorderStyle(), h = (n = f == null ? void 0 : f.getWidth()) !== null && n !== void 0 ? n : 0, d = Mr(c == null ? void 0 : c.getRotation()), p = ei(u, d), v = p.width, y = p.height, m = En(le(le({}, u), { rotation: d })), S = Oe(0, 0, 0), T = Ft(c == null ? void 0 : c.getBorderColor()), C = Ft(c == null ? void 0 : c.getBackgroundColor()), A = e.getOptions(), O = e.getSelected();
  e.isSorted() && A.sort();
  for (var k = "", M = 0, b = A.length; M < b; M++)
    k += A[M], M < b - 1 && (k += `
`);
  for (var j = 1, I = {
    x: h + j,
    y: h + j,
    width: v - (h + j) * 2,
    height: y - (h + j) * 2
  }, q = My(k, {
    alignment: Ze.Left,
    fontSize: s ?? l,
    font: r,
    bounds: I
  }), z = q.lines, B = q.fontSize, N = q.lineHeight, L = [], M = 0, b = z.length; M < b; M++) {
    var U = z[M];
    O.includes(U.text) && L.push(M);
  }
  var X = Oe(153 / 255, 193 / 255, 218 / 255), W = (i = a ?? o) !== null && i !== void 0 ? i : S;
  return Qt(a || s !== void 0 ? t : e.acroField, W, r, B), be(m, Jk({
    x: 0 + h / 2,
    y: 0 + h / 2,
    width: v - h,
    height: y - h,
    borderWidth: h ?? 0,
    borderColor: T,
    textColor: W,
    font: r.name,
    fontSize: B,
    color: C,
    textLines: z,
    lineHeight: N,
    selectedColor: X,
    selectedLines: L,
    padding: j
  }));
}, jy = (
  /** @class */
  function() {
    function e(t, r, n) {
      this.alreadyEmbedded = !1, D(t, "ref", [[Re, "PDFRef"]]), D(r, "doc", [[mn, "PDFDocument"]]), D(n, "embedder", [[cy, "PDFPageEmbedder"]]), this.ref = t, this.doc = r, this.width = n.width, this.height = n.height, this.embedder = n;
    }
    return e.prototype.scale = function(t) {
      return D(t, "factor", ["number"]), { width: this.width * t, height: this.height * t };
    }, e.prototype.size = function() {
      return this.scale(1);
    }, e.prototype.embed = function() {
      return fe(this, void 0, void 0, function() {
        return he(this, function(t) {
          switch (t.label) {
            case 0:
              return this.alreadyEmbedded ? [3, 2] : [4, this.embedder.embedIntoContext(this.doc.context, this.ref)];
            case 1:
              t.sent(), this.alreadyEmbedded = !0, t.label = 2;
            case 2:
              return [
                2
                /*return*/
              ];
          }
        });
      });
    }, e.of = function(t, r, n) {
      return new e(t, r, n);
    }, e;
  }()
), jt = (
  /** @class */
  function() {
    function e(t, r, n) {
      this.modified = !0, D(t, "ref", [[Re, "PDFRef"]]), D(r, "doc", [[mn, "PDFDocument"]]), D(n, "embedder", [
        [qf, "CustomFontEmbedder"],
        [$s, "StandardFontEmbedder"]
      ]), this.ref = t, this.doc = r, this.name = n.fontName, this.embedder = n;
    }
    return e.prototype.encodeText = function(t) {
      return D(t, "text", ["string"]), this.modified = !0, this.embedder.encodeText(t);
    }, e.prototype.widthOfTextAtSize = function(t, r) {
      return D(t, "text", ["string"]), D(r, "size", ["number"]), this.embedder.widthOfTextAtSize(t, r);
    }, e.prototype.heightAtSize = function(t, r) {
      var n;
      return D(t, "size", ["number"]), G(r == null ? void 0 : r.descender, "options.descender", ["boolean"]), this.embedder.heightOfFontAtSize(t, {
        descender: (n = r == null ? void 0 : r.descender) !== null && n !== void 0 ? n : !0
      });
    }, e.prototype.sizeAtHeight = function(t) {
      return D(t, "height", ["number"]), this.embedder.sizeOfFontAtHeight(t);
    }, e.prototype.getCharacterSet = function() {
      return this.embedder instanceof $s ? this.embedder.encoding.supportedCodePoints : this.embedder.font.characterSet;
    }, e.prototype.embed = function() {
      return fe(this, void 0, void 0, function() {
        return he(this, function(t) {
          switch (t.label) {
            case 0:
              return this.modified ? [4, this.embedder.embedIntoContext(this.doc.context, this.ref)] : [3, 2];
            case 1:
              t.sent(), this.modified = !1, t.label = 2;
            case 2:
              return [
                2
                /*return*/
              ];
          }
        });
      });
    }, e.of = function(t, r, n) {
      return new e(t, r, n);
    }, e;
  }()
), zc = (
  /** @class */
  function() {
    function e(t, r, n) {
      D(t, "ref", [[Re, "PDFRef"]]), D(r, "doc", [[mn, "PDFDocument"]]), D(n, "embedder", [
        [oy, "JpegEmbedder"],
        [sy, "PngEmbedder"]
      ]), this.ref = t, this.doc = r, this.width = n.width, this.height = n.height, this.embedder = n;
    }
    return e.prototype.scale = function(t) {
      return D(t, "factor", ["number"]), { width: this.width * t, height: this.height * t };
    }, e.prototype.scaleToFit = function(t, r) {
      D(t, "width", ["number"]), D(r, "height", ["number"]);
      var n = t / this.width, i = r / this.height, a = Math.min(n, i);
      return this.scale(a);
    }, e.prototype.size = function() {
      return this.scale(1);
    }, e.prototype.embed = function() {
      return fe(this, void 0, void 0, function() {
        var t, r, n;
        return he(this, function(i) {
          switch (i.label) {
            case 0:
              return this.embedder ? (this.embedTask || (t = this, r = t.doc, n = t.ref, this.embedTask = this.embedder.embedIntoContext(r.context, n)), [4, this.embedTask]) : [
                2
                /*return*/
              ];
            case 1:
              return i.sent(), this.embedder = void 0, [
                2
                /*return*/
              ];
          }
        });
      });
    }, e.of = function(t, r, n) {
      return new e(t, r, n);
    }, e;
  }()
), ln;
(function(e) {
  e[e.Left = 0] = "Left", e[e.Center = 1] = "Center", e[e.Right = 2] = "Right";
})(ln || (ln = {}));
var Yi = function(e) {
  G(e == null ? void 0 : e.x, "options.x", ["number"]), G(e == null ? void 0 : e.y, "options.y", ["number"]), G(e == null ? void 0 : e.width, "options.width", ["number"]), G(e == null ? void 0 : e.height, "options.height", ["number"]), G(e == null ? void 0 : e.textColor, "options.textColor", [
    [Object, "Color"]
  ]), G(e == null ? void 0 : e.backgroundColor, "options.backgroundColor", [
    [Object, "Color"]
  ]), G(e == null ? void 0 : e.borderColor, "options.borderColor", [
    [Object, "Color"]
  ]), G(e == null ? void 0 : e.borderWidth, "options.borderWidth", ["number"]), G(e == null ? void 0 : e.rotate, "options.rotate", [[Object, "Rotation"]]);
}, ni = (
  /** @class */
  function() {
    function e(t, r, n) {
      D(t, "acroField", [[Gi, "PDFAcroTerminal"]]), D(r, "ref", [[Re, "PDFRef"]]), D(n, "doc", [[mn, "PDFDocument"]]), this.acroField = t, this.ref = r, this.doc = n;
    }
    return e.prototype.getName = function() {
      var t;
      return (t = this.acroField.getFullyQualifiedName()) !== null && t !== void 0 ? t : "";
    }, e.prototype.isReadOnly = function() {
      return this.acroField.hasFlag(ar.ReadOnly);
    }, e.prototype.enableReadOnly = function() {
      this.acroField.setFlagTo(ar.ReadOnly, !0);
    }, e.prototype.disableReadOnly = function() {
      this.acroField.setFlagTo(ar.ReadOnly, !1);
    }, e.prototype.isRequired = function() {
      return this.acroField.hasFlag(ar.Required);
    }, e.prototype.enableRequired = function() {
      this.acroField.setFlagTo(ar.Required, !0);
    }, e.prototype.disableRequired = function() {
      this.acroField.setFlagTo(ar.Required, !1);
    }, e.prototype.isExported = function() {
      return !this.acroField.hasFlag(ar.NoExport);
    }, e.prototype.enableExporting = function() {
      this.acroField.setFlagTo(ar.NoExport, !1);
    }, e.prototype.disableExporting = function() {
      this.acroField.setFlagTo(ar.NoExport, !0);
    }, e.prototype.needsAppearancesUpdate = function() {
      throw new Gt(this.constructor.name, "needsAppearancesUpdate");
    }, e.prototype.defaultUpdateAppearances = function(t) {
      throw new Gt(this.constructor.name, "defaultUpdateAppearances");
    }, e.prototype.markAsDirty = function() {
      this.doc.getForm().markFieldAsDirty(this.ref);
    }, e.prototype.markAsClean = function() {
      this.doc.getForm().markFieldAsClean(this.ref);
    }, e.prototype.isDirty = function() {
      return this.doc.getForm().fieldIsDirty(this.ref);
    }, e.prototype.createWidget = function(t) {
      var r, n = t.textColor, i = t.backgroundColor, a = t.borderColor, o = t.borderWidth, s = xy(t.rotate), l = t.caption, u = t.x, c = t.y, f = t.width + o, h = t.height + o, d = !!t.hidden, p = t.page;
      $m(s, "degreesAngle", 90);
      var v = Mc.create(this.doc.context, this.ref), y = Rk({ x: u, y: c, width: f, height: h }, o, s);
      v.setRectangle(y), p && v.setP(p);
      var m = v.getOrCreateAppearanceCharacteristics();
      i && m.setBackgroundColor(Rp(i)), m.setRotation(s), l && m.setCaptions({ normal: l }), a && m.setBorderColor(Rp(a));
      var S = v.getOrCreateBorderStyle();
      if (o !== void 0 && S.setWidth(o), v.setFlagTo(Ua.Print, !0), v.setFlagTo(Ua.Hidden, d), v.setFlagTo(Ua.Invisible, !1), n) {
        var T = (r = this.acroField.getDefaultAppearance()) !== null && r !== void 0 ? r : "", C = T + `
` + ri(n).toString();
        this.acroField.setDefaultAppearance(C);
      }
      return v;
    }, e.prototype.updateWidgetAppearanceWithFont = function(t, r, n) {
      var i = n.normal, a = n.rollover, o = n.down;
      this.updateWidgetAppearances(t, {
        normal: this.createAppearanceStream(t, i, r),
        rollover: a && this.createAppearanceStream(t, a, r),
        down: o && this.createAppearanceStream(t, o, r)
      });
    }, e.prototype.updateOnOffWidgetAppearance = function(t, r, n) {
      var i = n.normal, a = n.rollover, o = n.down;
      this.updateWidgetAppearances(t, {
        normal: this.createAppearanceDict(t, i, r),
        rollover: a && this.createAppearanceDict(t, a, r),
        down: o && this.createAppearanceDict(t, o, r)
      });
    }, e.prototype.updateWidgetAppearances = function(t, r) {
      var n = r.normal, i = r.rollover, a = r.down;
      t.setNormalAppearance(n), i ? t.setRolloverAppearance(i) : t.removeRolloverAppearance(), a ? t.setDownAppearance(a) : t.removeDownAppearance();
    }, e.prototype.createAppearanceStream = function(t, r, n) {
      var i, a = this.acroField.dict.context, o = t.getRectangle(), s = o.width, l = o.height, u = n && { Font: (i = {}, i[n.name] = n.ref, i) }, c = a.formXObject(r, {
        Resources: u,
        BBox: a.obj([0, 0, s, l]),
        Matrix: a.obj([1, 0, 0, 1, 0, 0])
      }), f = a.register(c);
      return f;
    }, e.prototype.createImageAppearanceStream = function(t, r, n) {
      var i, a, o = this.acroField.dict.context, s = t.getRectangle(), l = t.getAppearanceCharacteristics(), u = t.getBorderStyle(), c = (a = u == null ? void 0 : u.getWidth()) !== null && a !== void 0 ? a : 0, f = Mr(l == null ? void 0 : l.getRotation()), h = En(le(le({}, s), { rotation: f })), d = ei(s, f), p = r.scaleToFit(d.width - c * 2, d.height - c * 2), v = {
        x: c,
        y: c,
        width: p.width,
        height: p.height,
        //
        rotate: ie(0),
        xSkew: ie(0),
        ySkew: ie(0)
      };
      n === ln.Center ? (v.x += (d.width - c * 2) / 2 - p.width / 2, v.y += (d.height - c * 2) / 2 - p.height / 2) : n === ln.Right && (v.x = d.width - c - p.width, v.y = d.height - c - p.height);
      var y = this.doc.context.addRandomSuffix("Image", 10), m = be(h, ky(y, v)), S = { XObject: (i = {}, i[y] = r.ref, i) }, T = o.formXObject(m, {
        Resources: S,
        BBox: o.obj([0, 0, s.width, s.height]),
        Matrix: o.obj([1, 0, 0, 1, 0, 0])
      });
      return o.register(T);
    }, e.prototype.createAppearanceDict = function(t, r, n) {
      var i = this.acroField.dict.context, a = this.createAppearanceStream(t, r.on), o = this.createAppearanceStream(t, r.off), s = i.obj({});
      return s.set(n, a), s.set(x.of("Off"), o), s;
    }, e;
  }()
), wa = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      var a = e.call(this, r, n, i) || this;
      return D(r, "acroCheckBox", [
        [ql, "PDFAcroCheckBox"]
      ]), a.acroField = r, a;
    }
    return t.prototype.check = function() {
      var r, n = (r = this.acroField.getOnValue()) !== null && r !== void 0 ? r : x.of("Yes");
      this.markAsDirty(), this.acroField.setValue(n);
    }, t.prototype.uncheck = function() {
      this.markAsDirty(), this.acroField.setValue(x.of("Off"));
    }, t.prototype.isChecked = function() {
      var r = this.acroField.getOnValue();
      return !!r && r === this.acroField.getValue();
    }, t.prototype.addToPage = function(r, n) {
      var i, a, o, s, l, u;
      D(r, "page", [[Wt, "PDFPage"]]), Yi(n), n || (n = {}), "textColor" in n || (n.textColor = Oe(0, 0, 0)), "backgroundColor" in n || (n.backgroundColor = Oe(1, 1, 1)), "borderColor" in n || (n.borderColor = Oe(0, 0, 0)), "borderWidth" in n || (n.borderWidth = 1);
      var c = this.createWidget({
        x: (i = n.x) !== null && i !== void 0 ? i : 0,
        y: (a = n.y) !== null && a !== void 0 ? a : 0,
        width: (o = n.width) !== null && o !== void 0 ? o : 50,
        height: (s = n.height) !== null && s !== void 0 ? s : 50,
        textColor: n.textColor,
        backgroundColor: n.backgroundColor,
        borderColor: n.borderColor,
        borderWidth: (l = n.borderWidth) !== null && l !== void 0 ? l : 0,
        rotate: (u = n.rotate) !== null && u !== void 0 ? u : ie(0),
        hidden: n.hidden,
        page: r.ref
      }), f = this.doc.context.register(c.dict);
      this.acroField.addWidget(f), c.setAppearanceState(x.of("Off")), this.updateWidgetAppearance(c, x.of("Yes")), r.node.addAnnot(f);
    }, t.prototype.needsAppearancesUpdate = function() {
      for (var r, n = this.acroField.getWidgets(), i = 0, a = n.length; i < a; i++) {
        var o = n[i], s = o.getAppearanceState(), l = (r = o.getAppearances()) === null || r === void 0 ? void 0 : r.normal;
        if (!(l instanceof ce) || s && !l.has(s))
          return !0;
      }
      return !1;
    }, t.prototype.defaultUpdateAppearances = function() {
      this.updateAppearances();
    }, t.prototype.updateAppearances = function(r) {
      var n;
      G(r, "provider", [Function]);
      for (var i = this.acroField.getWidgets(), a = 0, o = i.length; a < o; a++) {
        var s = i[a], l = (n = s.getOnValue()) !== null && n !== void 0 ? n : x.of("Yes");
        l && this.updateWidgetAppearance(s, l, r);
      }
      this.markAsClean();
    }, t.prototype.updateWidgetAppearance = function(r, n, i) {
      var a = i ?? pN, o = Xi(a(this, r));
      this.updateOnOffWidgetAppearance(r, n, o);
    }, t.of = function(r, n, i) {
      return new t(r, n, i);
    }, t;
  }(ni)
), ks = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      var a = e.call(this, r, n, i) || this;
      return D(r, "acroComboBox", [
        [Vl, "PDFAcroComboBox"]
      ]), a.acroField = r, a;
    }
    return t.prototype.getOptions = function() {
      for (var r = this.acroField.getOptions(), n = new Array(r.length), i = 0, a = n.length; i < a; i++) {
        var o = r[i], s = o.display, l = o.value;
        n[i] = (s ?? l).decodeText();
      }
      return n;
    }, t.prototype.getSelected = function() {
      for (var r = this.acroField.getValues(), n = new Array(r.length), i = 0, a = r.length; i < a; i++)
        n[i] = r[i].decodeText();
      return n;
    }, t.prototype.setOptions = function(r) {
      D(r, "options", [Array]);
      for (var n = new Array(r.length), i = 0, a = r.length; i < a; i++)
        n[i] = { value: ne.fromText(r[i]) };
      this.acroField.setOptions(n);
    }, t.prototype.addOptions = function(r) {
      D(r, "options", ["string", Array]);
      for (var n = Array.isArray(r) ? r : [r], i = this.acroField.getOptions(), a = new Array(n.length), o = 0, s = n.length; o < s; o++)
        a[o] = { value: ne.fromText(n[o]) };
      this.acroField.setOptions(i.concat(a));
    }, t.prototype.select = function(r, n) {
      n === void 0 && (n = !1), D(r, "options", ["string", Array]), D(n, "merge", ["boolean"]);
      var i = Array.isArray(r) ? r : [r], a = this.getOptions(), o = i.find(function(f) {
        return !a.includes(f);
      });
      o && this.enableEditing(), this.markAsDirty(), (i.length > 1 || i.length === 1 && n) && this.enableMultiselect();
      for (var s = new Array(i.length), l = 0, u = i.length; l < u; l++)
        s[l] = ne.fromText(i[l]);
      if (n) {
        var c = this.acroField.getValues();
        this.acroField.setValues(c.concat(s));
      } else
        this.acroField.setValues(s);
    }, t.prototype.clear = function() {
      this.markAsDirty(), this.acroField.setValues([]);
    }, t.prototype.setFontSize = function(r) {
      _l(r, "fontSize"), this.acroField.setFontSize(r), this.markAsDirty();
    }, t.prototype.isEditable = function() {
      return this.acroField.hasFlag(Ce.Edit);
    }, t.prototype.enableEditing = function() {
      this.acroField.setFlagTo(Ce.Edit, !0);
    }, t.prototype.disableEditing = function() {
      this.acroField.setFlagTo(Ce.Edit, !1);
    }, t.prototype.isSorted = function() {
      return this.acroField.hasFlag(Ce.Sort);
    }, t.prototype.enableSorting = function() {
      this.acroField.setFlagTo(Ce.Sort, !0);
    }, t.prototype.disableSorting = function() {
      this.acroField.setFlagTo(Ce.Sort, !1);
    }, t.prototype.isMultiselect = function() {
      return this.acroField.hasFlag(Ce.MultiSelect);
    }, t.prototype.enableMultiselect = function() {
      this.acroField.setFlagTo(Ce.MultiSelect, !0);
    }, t.prototype.disableMultiselect = function() {
      this.acroField.setFlagTo(Ce.MultiSelect, !1);
    }, t.prototype.isSpellChecked = function() {
      return !this.acroField.hasFlag(Ce.DoNotSpellCheck);
    }, t.prototype.enableSpellChecking = function() {
      this.acroField.setFlagTo(Ce.DoNotSpellCheck, !1);
    }, t.prototype.disableSpellChecking = function() {
      this.acroField.setFlagTo(Ce.DoNotSpellCheck, !0);
    }, t.prototype.isSelectOnClick = function() {
      return this.acroField.hasFlag(Ce.CommitOnSelChange);
    }, t.prototype.enableSelectOnClick = function() {
      this.acroField.setFlagTo(Ce.CommitOnSelChange, !0);
    }, t.prototype.disableSelectOnClick = function() {
      this.acroField.setFlagTo(Ce.CommitOnSelChange, !1);
    }, t.prototype.addToPage = function(r, n) {
      var i, a, o, s, l, u, c;
      D(r, "page", [[Wt, "PDFPage"]]), Yi(n), n || (n = {}), "textColor" in n || (n.textColor = Oe(0, 0, 0)), "backgroundColor" in n || (n.backgroundColor = Oe(1, 1, 1)), "borderColor" in n || (n.borderColor = Oe(0, 0, 0)), "borderWidth" in n || (n.borderWidth = 1);
      var f = this.createWidget({
        x: (i = n.x) !== null && i !== void 0 ? i : 0,
        y: (a = n.y) !== null && a !== void 0 ? a : 0,
        width: (o = n.width) !== null && o !== void 0 ? o : 200,
        height: (s = n.height) !== null && s !== void 0 ? s : 50,
        textColor: n.textColor,
        backgroundColor: n.backgroundColor,
        borderColor: n.borderColor,
        borderWidth: (l = n.borderWidth) !== null && l !== void 0 ? l : 0,
        rotate: (u = n.rotate) !== null && u !== void 0 ? u : ie(0),
        hidden: n.hidden,
        page: r.ref
      }), h = this.doc.context.register(f.dict);
      this.acroField.addWidget(h);
      var d = (c = n.font) !== null && c !== void 0 ? c : this.doc.getForm().getDefaultFont();
      this.updateWidgetAppearance(f, d), r.node.addAnnot(h);
    }, t.prototype.needsAppearancesUpdate = function() {
      var r;
      if (this.isDirty())
        return !0;
      for (var n = this.acroField.getWidgets(), i = 0, a = n.length; i < a; i++) {
        var o = n[i], s = ((r = o.getAppearances()) === null || r === void 0 ? void 0 : r.normal) instanceof Mt;
        if (!s)
          return !0;
      }
      return !1;
    }, t.prototype.defaultUpdateAppearances = function(r) {
      D(r, "font", [[jt, "PDFFont"]]), this.updateAppearances(r);
    }, t.prototype.updateAppearances = function(r, n) {
      D(r, "font", [[jt, "PDFFont"]]), G(n, "provider", [Function]);
      for (var i = this.acroField.getWidgets(), a = 0, o = i.length; a < o; a++) {
        var s = i[a];
        this.updateWidgetAppearance(s, r, n);
      }
      this.markAsClean();
    }, t.prototype.updateWidgetAppearance = function(r, n, i) {
      var a = i ?? yN, o = Xi(a(this, r, n));
      this.updateWidgetAppearanceWithFont(r, n, o);
    }, t.of = function(r, n, i) {
      return new t(r, n, i);
    }, t;
  }(ni)
), Ns = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      var a = e.call(this, r, n, i) || this;
      return D(r, "acroListBox", [[Kl, "PDFAcroListBox"]]), a.acroField = r, a;
    }
    return t.prototype.getOptions = function() {
      for (var r = this.acroField.getOptions(), n = new Array(r.length), i = 0, a = n.length; i < a; i++) {
        var o = r[i], s = o.display, l = o.value;
        n[i] = (s ?? l).decodeText();
      }
      return n;
    }, t.prototype.getSelected = function() {
      for (var r = this.acroField.getValues(), n = new Array(r.length), i = 0, a = r.length; i < a; i++)
        n[i] = r[i].decodeText();
      return n;
    }, t.prototype.setOptions = function(r) {
      D(r, "options", [Array]), this.markAsDirty();
      for (var n = new Array(r.length), i = 0, a = r.length; i < a; i++)
        n[i] = { value: ne.fromText(r[i]) };
      this.acroField.setOptions(n);
    }, t.prototype.addOptions = function(r) {
      D(r, "options", ["string", Array]), this.markAsDirty();
      for (var n = Array.isArray(r) ? r : [r], i = this.acroField.getOptions(), a = new Array(n.length), o = 0, s = n.length; o < s; o++)
        a[o] = { value: ne.fromText(n[o]) };
      this.acroField.setOptions(i.concat(a));
    }, t.prototype.select = function(r, n) {
      n === void 0 && (n = !1), D(r, "options", ["string", Array]), D(n, "merge", ["boolean"]);
      var i = Array.isArray(r) ? r : [r], a = this.getOptions();
      mD(i, "option", a), this.markAsDirty(), (i.length > 1 || i.length === 1 && n) && this.enableMultiselect();
      for (var o = new Array(i.length), s = 0, l = i.length; s < l; s++)
        o[s] = ne.fromText(i[s]);
      if (n) {
        var u = this.acroField.getValues();
        this.acroField.setValues(u.concat(o));
      } else
        this.acroField.setValues(o);
    }, t.prototype.clear = function() {
      this.markAsDirty(), this.acroField.setValues([]);
    }, t.prototype.setFontSize = function(r) {
      _l(r, "fontSize"), this.acroField.setFontSize(r), this.markAsDirty();
    }, t.prototype.isSorted = function() {
      return this.acroField.hasFlag(Ce.Sort);
    }, t.prototype.enableSorting = function() {
      this.acroField.setFlagTo(Ce.Sort, !0);
    }, t.prototype.disableSorting = function() {
      this.acroField.setFlagTo(Ce.Sort, !1);
    }, t.prototype.isMultiselect = function() {
      return this.acroField.hasFlag(Ce.MultiSelect);
    }, t.prototype.enableMultiselect = function() {
      this.acroField.setFlagTo(Ce.MultiSelect, !0);
    }, t.prototype.disableMultiselect = function() {
      this.acroField.setFlagTo(Ce.MultiSelect, !1);
    }, t.prototype.isSelectOnClick = function() {
      return this.acroField.hasFlag(Ce.CommitOnSelChange);
    }, t.prototype.enableSelectOnClick = function() {
      this.acroField.setFlagTo(Ce.CommitOnSelChange, !0);
    }, t.prototype.disableSelectOnClick = function() {
      this.acroField.setFlagTo(Ce.CommitOnSelChange, !1);
    }, t.prototype.addToPage = function(r, n) {
      var i, a, o, s, l, u, c;
      D(r, "page", [[Wt, "PDFPage"]]), Yi(n), n || (n = {}), "textColor" in n || (n.textColor = Oe(0, 0, 0)), "backgroundColor" in n || (n.backgroundColor = Oe(1, 1, 1)), "borderColor" in n || (n.borderColor = Oe(0, 0, 0)), "borderWidth" in n || (n.borderWidth = 1);
      var f = this.createWidget({
        x: (i = n.x) !== null && i !== void 0 ? i : 0,
        y: (a = n.y) !== null && a !== void 0 ? a : 0,
        width: (o = n.width) !== null && o !== void 0 ? o : 200,
        height: (s = n.height) !== null && s !== void 0 ? s : 100,
        textColor: n.textColor,
        backgroundColor: n.backgroundColor,
        borderColor: n.borderColor,
        borderWidth: (l = n.borderWidth) !== null && l !== void 0 ? l : 0,
        rotate: (u = n.rotate) !== null && u !== void 0 ? u : ie(0),
        hidden: n.hidden,
        page: r.ref
      }), h = this.doc.context.register(f.dict);
      this.acroField.addWidget(h);
      var d = (c = n.font) !== null && c !== void 0 ? c : this.doc.getForm().getDefaultFont();
      this.updateWidgetAppearance(f, d), r.node.addAnnot(h);
    }, t.prototype.needsAppearancesUpdate = function() {
      var r;
      if (this.isDirty())
        return !0;
      for (var n = this.acroField.getWidgets(), i = 0, a = n.length; i < a; i++) {
        var o = n[i], s = ((r = o.getAppearances()) === null || r === void 0 ? void 0 : r.normal) instanceof Mt;
        if (!s)
          return !0;
      }
      return !1;
    }, t.prototype.defaultUpdateAppearances = function(r) {
      D(r, "font", [[jt, "PDFFont"]]), this.updateAppearances(r);
    }, t.prototype.updateAppearances = function(r, n) {
      D(r, "font", [[jt, "PDFFont"]]), G(n, "provider", [Function]);
      for (var i = this.acroField.getWidgets(), a = 0, o = i.length; a < o; a++) {
        var s = i[a];
        this.updateWidgetAppearance(s, r, n);
      }
      this.markAsClean();
    }, t.prototype.updateWidgetAppearance = function(r, n, i) {
      var a = i ?? bN, o = Xi(a(this, r, n));
      this.updateWidgetAppearanceWithFont(r, n, o);
    }, t.of = function(r, n, i) {
      return new t(r, n, i);
    }, t;
  }(ni)
), xa = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      var a = e.call(this, r, n, i) || this;
      return D(r, "acroRadioButton", [
        [Gl, "PDFAcroRadioButton"]
      ]), a.acroField = r, a;
    }
    return t.prototype.getOptions = function() {
      var r = this.acroField.getExportValues();
      if (r) {
        for (var n = new Array(r.length), i = 0, a = r.length; i < a; i++)
          n[i] = r[i].decodeText();
        return n;
      }
      for (var o = this.acroField.getOnValues(), s = new Array(o.length), i = 0, a = s.length; i < a; i++)
        s[i] = o[i].decodeText();
      return s;
    }, t.prototype.getSelected = function() {
      var r = this.acroField.getValue();
      if (r !== x.of("Off")) {
        var n = this.acroField.getExportValues();
        if (n) {
          for (var i = this.acroField.getOnValues(), a = 0, o = i.length; a < o; a++)
            if (i[a] === r)
              return n[a].decodeText();
        }
        return r.decodeText();
      }
    }, t.prototype.select = function(r) {
      D(r, "option", ["string"]);
      var n = this.getOptions();
      nn(r, "option", n), this.markAsDirty();
      var i = this.acroField.getOnValues(), a = this.acroField.getExportValues();
      if (a)
        for (var o = 0, s = a.length; o < s; o++)
          a[o].decodeText() === r && this.acroField.setValue(i[o]);
      else
        for (var o = 0, s = i.length; o < s; o++) {
          var l = i[o];
          l.decodeText() === r && this.acroField.setValue(l);
        }
    }, t.prototype.clear = function() {
      this.markAsDirty(), this.acroField.setValue(x.of("Off"));
    }, t.prototype.isOffToggleable = function() {
      return !this.acroField.hasFlag(Ht.NoToggleToOff);
    }, t.prototype.enableOffToggling = function() {
      this.acroField.setFlagTo(Ht.NoToggleToOff, !1);
    }, t.prototype.disableOffToggling = function() {
      this.acroField.setFlagTo(Ht.NoToggleToOff, !0);
    }, t.prototype.isMutuallyExclusive = function() {
      return !this.acroField.hasFlag(Ht.RadiosInUnison);
    }, t.prototype.enableMutualExclusion = function() {
      this.acroField.setFlagTo(Ht.RadiosInUnison, !1);
    }, t.prototype.disableMutualExclusion = function() {
      this.acroField.setFlagTo(Ht.RadiosInUnison, !0);
    }, t.prototype.addOptionToPage = function(r, n, i) {
      var a, o, s, l, u, c, f, h, d;
      D(r, "option", ["string"]), D(n, "page", [[Wt, "PDFPage"]]), Yi(i);
      var p = this.createWidget({
        x: (a = i == null ? void 0 : i.x) !== null && a !== void 0 ? a : 0,
        y: (o = i == null ? void 0 : i.y) !== null && o !== void 0 ? o : 0,
        width: (s = i == null ? void 0 : i.width) !== null && s !== void 0 ? s : 50,
        height: (l = i == null ? void 0 : i.height) !== null && l !== void 0 ? l : 50,
        textColor: (u = i == null ? void 0 : i.textColor) !== null && u !== void 0 ? u : Oe(0, 0, 0),
        backgroundColor: (c = i == null ? void 0 : i.backgroundColor) !== null && c !== void 0 ? c : Oe(1, 1, 1),
        borderColor: (f = i == null ? void 0 : i.borderColor) !== null && f !== void 0 ? f : Oe(0, 0, 0),
        borderWidth: (h = i == null ? void 0 : i.borderWidth) !== null && h !== void 0 ? h : 1,
        rotate: (d = i == null ? void 0 : i.rotate) !== null && d !== void 0 ? d : ie(0),
        hidden: i == null ? void 0 : i.hidden,
        page: n.ref
      }), v = this.doc.context.register(p.dict), y = this.acroField.addWidgetWithOpt(v, ne.fromText(r), !this.isMutuallyExclusive());
      p.setAppearanceState(x.of("Off")), this.updateWidgetAppearance(p, y), n.node.addAnnot(v);
    }, t.prototype.needsAppearancesUpdate = function() {
      for (var r, n = this.acroField.getWidgets(), i = 0, a = n.length; i < a; i++) {
        var o = n[i], s = o.getAppearanceState(), l = (r = o.getAppearances()) === null || r === void 0 ? void 0 : r.normal;
        if (!(l instanceof ce) || s && !l.has(s))
          return !0;
      }
      return !1;
    }, t.prototype.defaultUpdateAppearances = function() {
      this.updateAppearances();
    }, t.prototype.updateAppearances = function(r) {
      G(r, "provider", [Function]);
      for (var n = this.acroField.getWidgets(), i = 0, a = n.length; i < a; i++) {
        var o = n[i], s = o.getOnValue();
        s && this.updateWidgetAppearance(o, s, r);
      }
    }, t.prototype.updateWidgetAppearance = function(r, n, i) {
      var a = i ?? vN, o = Xi(a(this, r));
      this.updateOnOffWidgetAppearance(r, n, o);
    }, t.of = function(r, n, i) {
      return new t(r, n, i);
    }, t;
  }(ni)
), qc = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      var a = e.call(this, r, n, i) || this;
      return D(r, "acroSignature", [
        [Hf, "PDFAcroSignature"]
      ]), a.acroField = r, a;
    }
    return t.prototype.needsAppearancesUpdate = function() {
      return !1;
    }, t.of = function(r, n, i) {
      return new t(r, n, i);
    }, t;
  }(ni)
), Is = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      var a = e.call(this, r, n, i) || this;
      return D(r, "acroText", [[Hl, "PDFAcroText"]]), a.acroField = r, a;
    }
    return t.prototype.getText = function() {
      var r = this.acroField.getValue();
      if (!r && this.isRichFormatted())
        throw new iN(this.getName());
      return r == null ? void 0 : r.decodeText();
    }, t.prototype.setText = function(r) {
      G(r, "text", ["string"]);
      var n = this.getMaxLength();
      if (n !== void 0 && r && r.length > n)
        throw new oN(r.length, n, this.getName());
      this.markAsDirty(), this.disableRichFormatting(), r ? this.acroField.setValue(ne.fromText(r)) : this.acroField.removeValue();
    }, t.prototype.getAlignment = function() {
      var r = this.acroField.getQuadding();
      return r === 0 ? Ze.Left : r === 1 ? Ze.Center : r === 2 ? Ze.Right : Ze.Left;
    }, t.prototype.setAlignment = function(r) {
      nn(r, "alignment", Ze), this.markAsDirty(), this.acroField.setQuadding(r);
    }, t.prototype.getMaxLength = function() {
      return this.acroField.getMaxLength();
    }, t.prototype.setMaxLength = function(r) {
      if (ir(r, "maxLength", 0, Number.MAX_SAFE_INTEGER), this.markAsDirty(), r === void 0)
        this.acroField.removeMaxLength();
      else {
        var n = this.getText();
        if (n && n.length > r)
          throw new sN(n.length, r, this.getName());
        this.acroField.setMaxLength(r);
      }
    }, t.prototype.removeMaxLength = function() {
      this.markAsDirty(), this.acroField.removeMaxLength();
    }, t.prototype.setImage = function(r) {
      for (var n = this.getAlignment(), i = n === Ze.Center ? ln.Center : n === Ze.Right ? ln.Right : ln.Left, a = this.acroField.getWidgets(), o = 0, s = a.length; o < s; o++) {
        var l = a[o], u = this.createImageAppearanceStream(l, r, i);
        this.updateWidgetAppearances(l, { normal: u });
      }
      this.markAsClean();
    }, t.prototype.setFontSize = function(r) {
      _l(r, "fontSize"), this.acroField.setFontSize(r), this.markAsDirty();
    }, t.prototype.isMultiline = function() {
      return this.acroField.hasFlag(_e.Multiline);
    }, t.prototype.enableMultiline = function() {
      this.markAsDirty(), this.acroField.setFlagTo(_e.Multiline, !0);
    }, t.prototype.disableMultiline = function() {
      this.markAsDirty(), this.acroField.setFlagTo(_e.Multiline, !1);
    }, t.prototype.isPassword = function() {
      return this.acroField.hasFlag(_e.Password);
    }, t.prototype.enablePassword = function() {
      this.acroField.setFlagTo(_e.Password, !0);
    }, t.prototype.disablePassword = function() {
      this.acroField.setFlagTo(_e.Password, !1);
    }, t.prototype.isFileSelector = function() {
      return this.acroField.hasFlag(_e.FileSelect);
    }, t.prototype.enableFileSelection = function() {
      this.acroField.setFlagTo(_e.FileSelect, !0);
    }, t.prototype.disableFileSelection = function() {
      this.acroField.setFlagTo(_e.FileSelect, !1);
    }, t.prototype.isSpellChecked = function() {
      return !this.acroField.hasFlag(_e.DoNotSpellCheck);
    }, t.prototype.enableSpellChecking = function() {
      this.acroField.setFlagTo(_e.DoNotSpellCheck, !1);
    }, t.prototype.disableSpellChecking = function() {
      this.acroField.setFlagTo(_e.DoNotSpellCheck, !0);
    }, t.prototype.isScrollable = function() {
      return !this.acroField.hasFlag(_e.DoNotScroll);
    }, t.prototype.enableScrolling = function() {
      this.acroField.setFlagTo(_e.DoNotScroll, !1);
    }, t.prototype.disableScrolling = function() {
      this.acroField.setFlagTo(_e.DoNotScroll, !0);
    }, t.prototype.isCombed = function() {
      return this.acroField.hasFlag(_e.Comb) && !this.isMultiline() && !this.isPassword() && !this.isFileSelector() && this.getMaxLength() !== void 0;
    }, t.prototype.enableCombing = function() {
      if (this.getMaxLength() === void 0) {
        var r = "PDFTextFields must have a max length in order to be combed";
        console.warn(r);
      }
      this.markAsDirty(), this.disableMultiline(), this.disablePassword(), this.disableFileSelection(), this.acroField.setFlagTo(_e.Comb, !0);
    }, t.prototype.disableCombing = function() {
      this.markAsDirty(), this.acroField.setFlagTo(_e.Comb, !1);
    }, t.prototype.isRichFormatted = function() {
      return this.acroField.hasFlag(_e.RichText);
    }, t.prototype.enableRichFormatting = function() {
      this.acroField.setFlagTo(_e.RichText, !0);
    }, t.prototype.disableRichFormatting = function() {
      this.acroField.setFlagTo(_e.RichText, !1);
    }, t.prototype.addToPage = function(r, n) {
      var i, a, o, s, l, u, c;
      D(r, "page", [[Wt, "PDFPage"]]), Yi(n), n || (n = {}), "textColor" in n || (n.textColor = Oe(0, 0, 0)), "backgroundColor" in n || (n.backgroundColor = Oe(1, 1, 1)), "borderColor" in n || (n.borderColor = Oe(0, 0, 0)), "borderWidth" in n || (n.borderWidth = 1);
      var f = this.createWidget({
        x: (i = n.x) !== null && i !== void 0 ? i : 0,
        y: (a = n.y) !== null && a !== void 0 ? a : 0,
        width: (o = n.width) !== null && o !== void 0 ? o : 200,
        height: (s = n.height) !== null && s !== void 0 ? s : 50,
        textColor: n.textColor,
        backgroundColor: n.backgroundColor,
        borderColor: n.borderColor,
        borderWidth: (l = n.borderWidth) !== null && l !== void 0 ? l : 0,
        rotate: (u = n.rotate) !== null && u !== void 0 ? u : ie(0),
        hidden: n.hidden,
        page: r.ref
      }), h = this.doc.context.register(f.dict);
      this.acroField.addWidget(h);
      var d = (c = n.font) !== null && c !== void 0 ? c : this.doc.getForm().getDefaultFont();
      this.updateWidgetAppearance(f, d), r.node.addAnnot(h);
    }, t.prototype.needsAppearancesUpdate = function() {
      var r;
      if (this.isDirty())
        return !0;
      for (var n = this.acroField.getWidgets(), i = 0, a = n.length; i < a; i++) {
        var o = n[i], s = ((r = o.getAppearances()) === null || r === void 0 ? void 0 : r.normal) instanceof Mt;
        if (!s)
          return !0;
      }
      return !1;
    }, t.prototype.defaultUpdateAppearances = function(r) {
      D(r, "font", [[jt, "PDFFont"]]), this.updateAppearances(r);
    }, t.prototype.updateAppearances = function(r, n) {
      D(r, "font", [[jt, "PDFFont"]]), G(n, "provider", [Function]);
      for (var i = this.acroField.getWidgets(), a = 0, o = i.length; a < o; a++) {
        var s = i[a];
        this.updateWidgetAppearance(s, r, n);
      }
      this.markAsClean();
    }, t.prototype.updateWidgetAppearance = function(r, n, i) {
      var a = i ?? mN, o = Xi(a(this, r, n));
      this.updateWidgetAppearanceWithFont(r, n, o);
    }, t.of = function(r, n, i) {
      return new t(r, n, i);
    }, t;
  }(ni)
), ll;
(function(e) {
  e.Courier = "Courier", e.CourierBold = "Courier-Bold", e.CourierOblique = "Courier-Oblique", e.CourierBoldOblique = "Courier-BoldOblique", e.Helvetica = "Helvetica", e.HelveticaBold = "Helvetica-Bold", e.HelveticaOblique = "Helvetica-Oblique", e.HelveticaBoldOblique = "Helvetica-BoldOblique", e.TimesRoman = "Times-Roman", e.TimesRomanBold = "Times-Bold", e.TimesRomanItalic = "Times-Italic", e.TimesRomanBoldItalic = "Times-BoldItalic", e.Symbol = "Symbol", e.ZapfDingbats = "ZapfDingbats";
})(ll || (ll = {}));
var wN = (
  /** @class */
  function() {
    function e(t, r) {
      var n = this;
      this.embedDefaultFont = function() {
        return n.doc.embedStandardFont(ll.Helvetica);
      }, D(t, "acroForm", [[rl, "PDFAcroForm"]]), D(r, "doc", [[mn, "PDFDocument"]]), this.acroForm = t, this.doc = r, this.dirtyFields = /* @__PURE__ */ new Set(), this.defaultFontCache = Nr.populatedBy(this.embedDefaultFont);
    }
    return e.prototype.hasXFA = function() {
      return this.acroForm.dict.has(x.of("XFA"));
    }, e.prototype.deleteXFA = function() {
      this.acroForm.dict.delete(x.of("XFA"));
    }, e.prototype.getFields = function() {
      for (var t = this.acroForm.getAllFields(), r = [], n = 0, i = t.length; n < i; n++) {
        var a = t[n], o = a[0], s = a[1], l = xN(o, s, this.doc);
        l && r.push(l);
      }
      return r;
    }, e.prototype.getFieldMaybe = function(t) {
      D(t, "name", ["string"]);
      for (var r = this.getFields(), n = 0, i = r.length; n < i; n++) {
        var a = r[n];
        if (a.getName() === t)
          return a;
      }
    }, e.prototype.getField = function(t) {
      D(t, "name", ["string"]);
      var r = this.getFieldMaybe(t);
      if (r)
        return r;
      throw new rN(t);
    }, e.prototype.getButton = function(t) {
      D(t, "name", ["string"]);
      var r = this.getField(t);
      if (r instanceof Us)
        return r;
      throw new Rn(t, Us, r);
    }, e.prototype.getCheckBox = function(t) {
      D(t, "name", ["string"]);
      var r = this.getField(t);
      if (r instanceof wa)
        return r;
      throw new Rn(t, wa, r);
    }, e.prototype.getDropdown = function(t) {
      D(t, "name", ["string"]);
      var r = this.getField(t);
      if (r instanceof ks)
        return r;
      throw new Rn(t, ks, r);
    }, e.prototype.getOptionList = function(t) {
      D(t, "name", ["string"]);
      var r = this.getField(t);
      if (r instanceof Ns)
        return r;
      throw new Rn(t, Ns, r);
    }, e.prototype.getRadioGroup = function(t) {
      D(t, "name", ["string"]);
      var r = this.getField(t);
      if (r instanceof xa)
        return r;
      throw new Rn(t, xa, r);
    }, e.prototype.getSignature = function(t) {
      D(t, "name", ["string"]);
      var r = this.getField(t);
      if (r instanceof qc)
        return r;
      throw new Rn(t, qc, r);
    }, e.prototype.getTextField = function(t) {
      D(t, "name", ["string"]);
      var r = this.getField(t);
      if (r instanceof Is)
        return r;
      throw new Rn(t, Is, r);
    }, e.prototype.createButton = function(t) {
      D(t, "name", ["string"]);
      var r = pi(t), n = this.findOrCreateNonTerminals(r.nonTerminal), i = Wl.create(this.doc.context);
      return i.setPartialName(r.terminal), vi(n, [i, i.ref], r.terminal), Us.of(i, i.ref, this.doc);
    }, e.prototype.createCheckBox = function(t) {
      D(t, "name", ["string"]);
      var r = pi(t), n = this.findOrCreateNonTerminals(r.nonTerminal), i = ql.create(this.doc.context);
      return i.setPartialName(r.terminal), vi(n, [i, i.ref], r.terminal), wa.of(i, i.ref, this.doc);
    }, e.prototype.createDropdown = function(t) {
      D(t, "name", ["string"]);
      var r = pi(t), n = this.findOrCreateNonTerminals(r.nonTerminal), i = Vl.create(this.doc.context);
      return i.setPartialName(r.terminal), vi(n, [i, i.ref], r.terminal), ks.of(i, i.ref, this.doc);
    }, e.prototype.createOptionList = function(t) {
      D(t, "name", ["string"]);
      var r = pi(t), n = this.findOrCreateNonTerminals(r.nonTerminal), i = Kl.create(this.doc.context);
      return i.setPartialName(r.terminal), vi(n, [i, i.ref], r.terminal), Ns.of(i, i.ref, this.doc);
    }, e.prototype.createRadioGroup = function(t) {
      D(t, "name", ["string"]);
      var r = pi(t), n = this.findOrCreateNonTerminals(r.nonTerminal), i = Gl.create(this.doc.context);
      return i.setPartialName(r.terminal), vi(n, [i, i.ref], r.terminal), xa.of(i, i.ref, this.doc);
    }, e.prototype.createTextField = function(t) {
      D(t, "name", ["string"]);
      var r = pi(t), n = this.findOrCreateNonTerminals(r.nonTerminal), i = Hl.create(this.doc.context);
      return i.setPartialName(r.terminal), vi(n, [i, i.ref], r.terminal), Is.of(i, i.ref, this.doc);
    }, e.prototype.flatten = function(t) {
      t === void 0 && (t = { updateFieldAppearances: !0 }), t.updateFieldAppearances && this.updateFieldAppearances();
      for (var r = this.getFields(), n = 0, i = r.length; n < i; n++) {
        for (var a = r[n], o = a.acroField.getWidgets(), s = 0, l = o.length; s < l; s++) {
          var u = o[s], c = this.findWidgetPage(u), f = this.findWidgetAppearanceRef(a, u), h = c.node.newXObject("FlatWidget", f), d = u.getRectangle(), p = be([
            Qe(),
            Kt(d.x, d.y)
          ], En(le(le({}, d), { rotation: 0 })), [
            Qf(h),
            $e()
          ]).filter(Boolean);
          c.pushOperators.apply(c, p);
        }
        this.removeField(a);
      }
    }, e.prototype.removeField = function(t) {
      for (var r = t.acroField.getWidgets(), n = /* @__PURE__ */ new Set(), i = 0, a = r.length; i < a; i++) {
        var o = r[i], s = this.findWidgetAppearanceRef(t, o), l = this.findWidgetPage(o);
        n.add(l), l.node.removeAnnot(s);
      }
      n.forEach(function(d) {
        return d.node.removeAnnot(t.ref);
      }), this.acroForm.removeField(t.acroField);
      for (var u = t.acroField.normalizedEntries().Kids, c = u.size(), f = 0; f < c; f++) {
        var h = u.get(f);
        h instanceof Re && this.doc.context.delete(h);
      }
      this.doc.context.delete(t.ref);
    }, e.prototype.updateFieldAppearances = function(t) {
      G(t, "font", [[jt, "PDFFont"]]), t = t ?? this.getDefaultFont();
      for (var r = this.getFields(), n = 0, i = r.length; n < i; n++) {
        var a = r[n];
        a.needsAppearancesUpdate() && a.defaultUpdateAppearances(t);
      }
    }, e.prototype.markFieldAsDirty = function(t) {
      G(t, "fieldRef", [[Re, "PDFRef"]]), this.dirtyFields.add(t);
    }, e.prototype.markFieldAsClean = function(t) {
      G(t, "fieldRef", [[Re, "PDFRef"]]), this.dirtyFields.delete(t);
    }, e.prototype.fieldIsDirty = function(t) {
      return G(t, "fieldRef", [[Re, "PDFRef"]]), this.dirtyFields.has(t);
    }, e.prototype.getDefaultFont = function() {
      return this.defaultFontCache.access();
    }, e.prototype.findWidgetPage = function(t) {
      var r = t.P(), n = this.doc.getPages().find(function(a) {
        return a.ref === r;
      });
      if (n === void 0) {
        var i = this.doc.context.getObjectRef(t.dict);
        if (i === void 0)
          throw new Error("Could not find PDFRef for PDFObject");
        if (n = this.doc.findPageForAnnotationRef(i), n === void 0)
          throw new Error("Could not find page for PDFRef " + i);
      }
      return n;
    }, e.prototype.findWidgetAppearanceRef = function(t, r) {
      var n, i = r.getNormalAppearance();
      if (i instanceof ce && (t instanceof wa || t instanceof xa)) {
        var a = t.acroField.getValue(), o = (n = i.get(a)) !== null && n !== void 0 ? n : i.get(x.of("Off"));
        o instanceof Re && (i = o);
      }
      if (!(i instanceof Re)) {
        var s = t.getName();
        throw new Error("Failed to extract appearance ref for: " + s);
      }
      return i;
    }, e.prototype.findOrCreateNonTerminals = function(t) {
      for (var r = [
        this.acroForm
      ], n = 0, i = t.length; n < i; n++) {
        var a = t[n];
        if (!a)
          throw new nN(a);
        var o = r[0], s = r[1], l = this.findNonTerminal(a, o);
        if (l)
          r = l;
        else {
          var u = tl.create(this.doc.context);
          u.setPartialName(a), u.setParent(s);
          var c = this.doc.context.register(u.dict);
          o.addField(c), r = [u, c];
        }
      }
      return r;
    }, e.prototype.findNonTerminal = function(t, r) {
      for (var n = r instanceof rl ? this.acroForm.getFields() : Wf(r.Kids()), i = 0, a = n.length; i < a; i++) {
        var o = n[i], s = o[0], l = o[1];
        if (s.getPartialName() === t) {
          if (s instanceof tl)
            return [s, l];
          throw new Iy(t);
        }
      }
    }, e.of = function(t, r) {
      return new e(t, r);
    }, e;
  }()
), xN = function(e, t, r) {
  if (e instanceof Wl)
    return Us.of(e, t, r);
  if (e instanceof ql)
    return wa.of(e, t, r);
  if (e instanceof Vl)
    return ks.of(e, t, r);
  if (e instanceof Kl)
    return Ns.of(e, t, r);
  if (e instanceof Hl)
    return Is.of(e, t, r);
  if (e instanceof Gl)
    return xa.of(e, t, r);
  if (e instanceof Hf)
    return qc.of(e, t, r);
}, pi = function(e) {
  if (e.length === 0)
    throw new Error("PDF field names must not be empty strings");
  for (var t = e.split("."), r = 0, n = t.length; r < n; r++)
    if (t[r] === "")
      throw new Error('Periods in PDF field names must be separated by at least one character: "' + e + '"');
  return t.length === 1 ? { nonTerminal: [], terminal: t[0] } : {
    nonTerminal: t.slice(0, t.length - 1),
    terminal: t[t.length - 1]
  };
}, vi = function(e, t, r) {
  for (var n = e[0], i = e[1], a = t[0], o = t[1], s = n.normalizedEntries(), l = Wf("Kids" in s ? s.Kids : s.Fields), u = 0, c = l.length; u < c; u++)
    if (l[u][0].getPartialName() === r)
      throw new Iy(r);
  n.addField(o), a.setParent(i);
}, EN = {
  A4: [595.28, 841.89]
}, Vc;
(function(e) {
  e[e.Fastest = 1 / 0] = "Fastest", e[e.Fast = 1500] = "Fast", e[e.Medium = 500] = "Medium", e[e.Slow = 100] = "Slow";
})(Vc || (Vc = {}));
var SN = (
  /** @class */
  function() {
    function e(t, r, n) {
      this.alreadyEmbedded = !1, this.ref = t, this.doc = r, this.embedder = n;
    }
    return e.prototype.embed = function() {
      return fe(this, void 0, void 0, function() {
        var t, r, n, i, a;
        return he(this, function(o) {
          switch (o.label) {
            case 0:
              return this.alreadyEmbedded ? [3, 2] : [4, this.embedder.embedIntoContext(this.doc.context, this.ref)];
            case 1:
              t = o.sent(), this.doc.catalog.has(x.of("Names")) || this.doc.catalog.set(x.of("Names"), this.doc.context.obj({})), r = this.doc.catalog.lookup(x.of("Names"), ce), r.has(x.of("EmbeddedFiles")) || r.set(x.of("EmbeddedFiles"), this.doc.context.obj({})), n = r.lookup(x.of("EmbeddedFiles"), ce), n.has(x.of("Names")) || n.set(x.of("Names"), this.doc.context.obj([])), i = n.lookup(x.of("Names"), Ee), i.push(ne.fromText(this.embedder.fileName)), i.push(t), this.doc.catalog.has(x.of("AF")) || this.doc.catalog.set(x.of("AF"), this.doc.context.obj([])), a = this.doc.catalog.lookup(x.of("AF"), Ee), a.push(t), this.alreadyEmbedded = !0, o.label = 2;
            case 2:
              return [
                2
                /*return*/
              ];
          }
        });
      });
    }, e.of = function(t, r, n) {
      return new e(t, r, n);
    }, e;
  }()
), FN = (
  /** @class */
  function() {
    function e(t, r, n) {
      this.alreadyEmbedded = !1, this.ref = t, this.doc = r, this.embedder = n;
    }
    return e.prototype.embed = function() {
      return fe(this, void 0, void 0, function() {
        var t, r, n, i, a, o, s;
        return he(this, function(l) {
          switch (l.label) {
            case 0:
              return this.alreadyEmbedded ? [3, 2] : (t = this.doc, r = t.catalog, n = t.context, [4, this.embedder.embedIntoContext(this.doc.context, this.ref)]);
            case 1:
              i = l.sent(), r.has(x.of("Names")) || r.set(x.of("Names"), n.obj({})), a = r.lookup(x.of("Names"), ce), a.has(x.of("JavaScript")) || a.set(x.of("JavaScript"), n.obj({})), o = a.lookup(x.of("JavaScript"), ce), o.has(x.of("Names")) || o.set(x.of("Names"), n.obj([])), s = o.lookup(x.of("Names"), Ee), s.push(ne.fromText(this.embedder.scriptName)), s.push(i), this.alreadyEmbedded = !0, l.label = 2;
            case 2:
              return [
                2
                /*return*/
              ];
          }
        });
      });
    }, e.of = function(t, r, n) {
      return new e(t, r, n);
    }, e;
  }()
), TN = (
  /** @class */
  function() {
    function e(t, r) {
      this.script = t, this.scriptName = r;
    }
    return e.for = function(t, r) {
      return new e(t, r);
    }, e.prototype.embedIntoContext = function(t, r) {
      return fe(this, void 0, void 0, function() {
        var n;
        return he(this, function(i) {
          return n = t.obj({
            Type: "Action",
            S: "JavaScript",
            JS: ne.fromText(this.script)
          }), r ? (t.assign(r, n), [2, r]) : [2, t.register(n)];
        });
      });
    }, e;
  }()
), mn = (
  /** @class */
  function() {
    function e(t, r, n) {
      var i = this;
      if (this.defaultWordBreaks = [" "], this.computePages = function() {
        var a = [];
        return i.catalog.Pages().traverse(function(o, s) {
          if (o instanceof Ir) {
            var l = i.pageMap.get(o);
            l || (l = Wt.of(o, s, i), i.pageMap.set(o, l)), a.push(l);
          }
        }), a;
      }, this.getOrCreateForm = function() {
        var a = i.catalog.getOrCreateAcroForm();
        return wN.of(a, i);
      }, D(t, "context", [[Lc, "PDFContext"]]), D(r, "ignoreEncryption", ["boolean"]), this.context = t, this.catalog = t.lookup(t.trailerInfo.Root), this.isEncrypted = !!t.lookup(t.trailerInfo.Encrypt), this.pageCache = Nr.populatedBy(this.computePages), this.pageMap = /* @__PURE__ */ new Map(), this.formCache = Nr.populatedBy(this.getOrCreateForm), this.fonts = [], this.images = [], this.embeddedPages = [], this.embeddedFiles = [], this.javaScripts = [], !r && this.isEncrypted)
        throw new Qk();
      n && this.updateInfoDict();
    }
    return e.load = function(t, r) {
      return r === void 0 && (r = {}), fe(this, void 0, void 0, function() {
        var n, i, a, o, s, l, u, c, f, h, d, p;
        return he(this, function(v) {
          switch (v.label) {
            case 0:
              return n = r.ignoreEncryption, i = n === void 0 ? !1 : n, a = r.parseSpeed, o = a === void 0 ? Vc.Slow : a, s = r.throwOnInvalidObject, l = s === void 0 ? !1 : s, u = r.updateMetadata, c = u === void 0 ? !0 : u, f = r.capNumbers, h = f === void 0 ? !1 : f, D(t, "pdf", ["string", Uint8Array, ArrayBuffer]), D(i, "ignoreEncryption", ["boolean"]), D(o, "parseSpeed", ["number"]), D(l, "throwOnInvalidObject", ["boolean"]), d = aa(t), [4, Ak.forBytesWithOptions(d, o, l, h).parseDocument()];
            case 1:
              return p = v.sent(), [2, new e(p, i, c)];
          }
        });
      });
    }, e.create = function(t) {
      return t === void 0 && (t = {}), fe(this, void 0, void 0, function() {
        var r, n, i, a, o, s;
        return he(this, function(l) {
          return r = t.updateMetadata, n = r === void 0 ? !0 : r, i = Lc.create(), a = gy.withContext(i), o = i.register(a), s = vy.withContextAndPages(i, o), i.trailerInfo.Root = i.register(s), [2, new e(i, !1, n)];
        });
      });
    }, e.prototype.registerFontkit = function(t) {
      this.fontkit = t;
    }, e.prototype.getForm = function() {
      var t = this.formCache.access();
      return t.hasXFA() && (console.warn("Removing XFA form data as pdf-lib does not support reading or writing XFA"), t.deleteXFA()), t;
    }, e.prototype.getTitle = function() {
      var t = this.getInfoDict().lookup(x.Title);
      if (t)
        return Wr(t), t.decodeText();
    }, e.prototype.getAuthor = function() {
      var t = this.getInfoDict().lookup(x.Author);
      if (t)
        return Wr(t), t.decodeText();
    }, e.prototype.getSubject = function() {
      var t = this.getInfoDict().lookup(x.Subject);
      if (t)
        return Wr(t), t.decodeText();
    }, e.prototype.getKeywords = function() {
      var t = this.getInfoDict().lookup(x.Keywords);
      if (t)
        return Wr(t), t.decodeText();
    }, e.prototype.getCreator = function() {
      var t = this.getInfoDict().lookup(x.Creator);
      if (t)
        return Wr(t), t.decodeText();
    }, e.prototype.getProducer = function() {
      var t = this.getInfoDict().lookup(x.Producer);
      if (t)
        return Wr(t), t.decodeText();
    }, e.prototype.getCreationDate = function() {
      var t = this.getInfoDict().lookup(x.CreationDate);
      if (t)
        return Wr(t), t.decodeDate();
    }, e.prototype.getModificationDate = function() {
      var t = this.getInfoDict().lookup(x.ModDate);
      if (t)
        return Wr(t), t.decodeDate();
    }, e.prototype.setTitle = function(t, r) {
      D(t, "title", ["string"]);
      var n = x.of("Title");
      if (this.getInfoDict().set(n, ne.fromText(t)), r != null && r.showInWindowTitleBar) {
        var i = this.catalog.getOrCreateViewerPreferences();
        i.setDisplayDocTitle(!0);
      }
    }, e.prototype.setAuthor = function(t) {
      D(t, "author", ["string"]);
      var r = x.of("Author");
      this.getInfoDict().set(r, ne.fromText(t));
    }, e.prototype.setSubject = function(t) {
      D(t, "author", ["string"]);
      var r = x.of("Subject");
      this.getInfoDict().set(r, ne.fromText(t));
    }, e.prototype.setKeywords = function(t) {
      D(t, "keywords", [Array]);
      var r = x.of("Keywords");
      this.getInfoDict().set(r, ne.fromText(t.join(" ")));
    }, e.prototype.setCreator = function(t) {
      D(t, "creator", ["string"]);
      var r = x.of("Creator");
      this.getInfoDict().set(r, ne.fromText(t));
    }, e.prototype.setProducer = function(t) {
      D(t, "creator", ["string"]);
      var r = x.of("Producer");
      this.getInfoDict().set(r, ne.fromText(t));
    }, e.prototype.setLanguage = function(t) {
      D(t, "language", ["string"]);
      var r = x.of("Lang");
      this.catalog.set(r, Pe.of(t));
    }, e.prototype.setCreationDate = function(t) {
      D(t, "creationDate", [[Date, "Date"]]);
      var r = x.of("CreationDate");
      this.getInfoDict().set(r, Pe.fromDate(t));
    }, e.prototype.setModificationDate = function(t) {
      D(t, "modificationDate", [[Date, "Date"]]);
      var r = x.of("ModDate");
      this.getInfoDict().set(r, Pe.fromDate(t));
    }, e.prototype.getPageCount = function() {
      return this.pageCount === void 0 && (this.pageCount = this.getPages().length), this.pageCount;
    }, e.prototype.getPages = function() {
      return this.pageCache.access();
    }, e.prototype.getPage = function(t) {
      var r = this.getPages();
      return Lt(t, "index", 0, r.length - 1), r[t];
    }, e.prototype.getPageIndices = function() {
      return GR(0, this.getPageCount());
    }, e.prototype.removePage = function(t) {
      var r = this.getPageCount();
      if (this.pageCount === 0)
        throw new tN();
      Lt(t, "index", 0, r - 1), this.catalog.removeLeafNode(t), this.pageCount = r - 1;
    }, e.prototype.addPage = function(t) {
      return D(t, "page", ["undefined", [Wt, "PDFPage"], Array]), this.insertPage(this.getPageCount(), t);
    }, e.prototype.insertPage = function(t, r) {
      var n = this.getPageCount();
      if (Lt(t, "index", 0, n), D(r, "page", ["undefined", [Wt, "PDFPage"], Array]), !r || Array.isArray(r)) {
        var i = Array.isArray(r) ? r : EN.A4;
        r = Wt.create(this), r.setSize.apply(r, i);
      } else if (r.doc !== this)
        throw new eN();
      var a = this.catalog.insertLeafNode(r.ref, t);
      return r.node.setParent(a), this.pageMap.set(r.node, r), this.pageCache.invalidate(), this.pageCount = n + 1, r;
    }, e.prototype.copyPages = function(t, r) {
      return fe(this, void 0, void 0, function() {
        var n, i, a, o, s, l, u, c;
        return he(this, function(f) {
          switch (f.label) {
            case 0:
              return D(t, "srcDoc", [[e, "PDFDocument"]]), D(r, "indices", [Array]), [4, t.flush()];
            case 1:
              for (f.sent(), n = yp.for(t.context, this.context), i = t.getPages(), a = new Array(r.length), o = 0, s = r.length; o < s; o++)
                l = i[r[o]], u = n.copy(l.node), c = this.context.register(u), a[o] = Wt.of(u, c, this);
              return [2, a];
          }
        });
      });
    }, e.prototype.copy = function() {
      return fe(this, void 0, void 0, function() {
        var t, r, n, i;
        return he(this, function(a) {
          switch (a.label) {
            case 0:
              return [4, e.create()];
            case 1:
              return t = a.sent(), [4, t.copyPages(this, this.getPageIndices())];
            case 2:
              for (r = a.sent(), n = 0, i = r.length; n < i; n++)
                t.addPage(r[n]);
              return this.getAuthor() !== void 0 && t.setAuthor(this.getAuthor()), this.getCreationDate() !== void 0 && t.setCreationDate(this.getCreationDate()), this.getCreator() !== void 0 && t.setCreator(this.getCreator()), this.getModificationDate() !== void 0 && t.setModificationDate(this.getModificationDate()), this.getProducer() !== void 0 && t.setProducer(this.getProducer()), this.getSubject() !== void 0 && t.setSubject(this.getSubject()), this.getTitle() !== void 0 && t.setTitle(this.getTitle()), t.defaultWordBreaks = this.defaultWordBreaks, [2, t];
          }
        });
      });
    }, e.prototype.addJavaScript = function(t, r) {
      D(t, "name", ["string"]), D(r, "script", ["string"]);
      var n = TN.for(r, t), i = this.context.nextRef(), a = FN.of(i, this, n);
      this.javaScripts.push(a);
    }, e.prototype.attach = function(t, r, n) {
      return n === void 0 && (n = {}), fe(this, void 0, void 0, function() {
        var i, a, o, s;
        return he(this, function(l) {
          return D(t, "attachment", ["string", Uint8Array, ArrayBuffer]), D(r, "name", ["string"]), G(n.mimeType, "mimeType", ["string"]), G(n.description, "description", ["string"]), G(n.creationDate, "options.creationDate", [Date]), G(n.modificationDate, "options.modificationDate", [
            Date
          ]), Vt(n.afRelationship, "options.afRelationship", Bc), i = aa(t), a = $D.for(i, r, n), o = this.context.nextRef(), s = SN.of(o, this, a), this.embeddedFiles.push(s), [
            2
            /*return*/
          ];
        });
      });
    }, e.prototype.embedFont = function(t, r) {
      return r === void 0 && (r = {}), fe(this, void 0, void 0, function() {
        var n, i, a, o, s, l, u, c, f, h;
        return he(this, function(d) {
          switch (d.label) {
            case 0:
              return n = r.subset, i = n === void 0 ? !1 : n, a = r.customName, o = r.features, D(t, "font", ["string", Uint8Array, ArrayBuffer]), D(i, "subset", ["boolean"]), up(t) ? (s = $s.for(t, a), [3, 7]) : [3, 1];
            case 1:
              return XR(t) ? (l = aa(t), u = this.assertFontkit(), i ? [4, QD.for(u, l, a, o)] : [3, 3]) : [3, 6];
            case 2:
              return c = d.sent(), [3, 5];
            case 3:
              return [4, qf.for(u, l, a, o)];
            case 4:
              c = d.sent(), d.label = 5;
            case 5:
              return s = c, [3, 7];
            case 6:
              throw new TypeError("`font` must be one of `StandardFonts | string | Uint8Array | ArrayBuffer`");
            case 7:
              return f = this.context.nextRef(), h = jt.of(f, this, s), this.fonts.push(h), [2, h];
          }
        });
      });
    }, e.prototype.embedStandardFont = function(t, r) {
      if (D(t, "font", ["string"]), !up(t))
        throw new TypeError("`font` must be one of type `StandardFonts`");
      var n = $s.for(t, r), i = this.context.nextRef(), a = jt.of(i, this, n);
      return this.fonts.push(a), a;
    }, e.prototype.embedJpg = function(t) {
      return fe(this, void 0, void 0, function() {
        var r, n, i, a;
        return he(this, function(o) {
          switch (o.label) {
            case 0:
              return D(t, "jpg", ["string", Uint8Array, ArrayBuffer]), r = aa(t), [4, oy.for(r)];
            case 1:
              return n = o.sent(), i = this.context.nextRef(), a = zc.of(i, this, n), this.images.push(a), [2, a];
          }
        });
      });
    }, e.prototype.embedPng = function(t) {
      return fe(this, void 0, void 0, function() {
        var r, n, i, a;
        return he(this, function(o) {
          switch (o.label) {
            case 0:
              return D(t, "png", ["string", Uint8Array, ArrayBuffer]), r = aa(t), [4, sy.for(r)];
            case 1:
              return n = o.sent(), i = this.context.nextRef(), a = zc.of(i, this, n), this.images.push(a), [2, a];
          }
        });
      });
    }, e.prototype.embedPdf = function(t, r) {
      return r === void 0 && (r = [0]), fe(this, void 0, void 0, function() {
        var n, i, a;
        return he(this, function(o) {
          switch (o.label) {
            case 0:
              return D(t, "pdf", [
                "string",
                Uint8Array,
                ArrayBuffer,
                [e, "PDFDocument"]
              ]), D(r, "indices", [Array]), t instanceof e ? (i = t, [3, 3]) : [3, 1];
            case 1:
              return [4, e.load(t)];
            case 2:
              i = o.sent(), o.label = 3;
            case 3:
              return n = i, a = KR(n.getPages(), r), [2, this.embedPages(a)];
          }
        });
      });
    }, e.prototype.embedPage = function(t, r, n) {
      return fe(this, void 0, void 0, function() {
        var i;
        return he(this, function(a) {
          switch (a.label) {
            case 0:
              return D(t, "page", [[Wt, "PDFPage"]]), [4, this.embedPages([t], [r], [n])];
            case 1:
              return i = a.sent()[0], [2, i];
          }
        });
      });
    }, e.prototype.embedPages = function(t, r, n) {
      return r === void 0 && (r = []), n === void 0 && (n = []), fe(this, void 0, void 0, function() {
        var u, c, i, a, o, s, l, u, c, f, h, d, p, v, y;
        return he(this, function(m) {
          switch (m.label) {
            case 0:
              if (t.length === 0)
                return [2, []];
              for (u = 0, c = t.length - 1; u < c; u++)
                if (i = t[u], a = t[u + 1], i.node.context !== a.node.context)
                  throw new TD();
              o = t[0].node.context, s = o === this.context ? function(S) {
                return S;
              } : yp.for(o, this.context).copy, l = new Array(t.length), u = 0, c = t.length, m.label = 1;
            case 1:
              return u < c ? (f = s(t[u].node), h = r[u], d = n[u], [4, cy.for(f, h, d)]) : [3, 4];
            case 2:
              p = m.sent(), v = this.context.nextRef(), l[u] = jy.of(v, this, p), m.label = 3;
            case 3:
              return u++, [3, 1];
            case 4:
              return (y = this.embeddedPages).push.apply(y, l), [2, l];
          }
        });
      });
    }, e.prototype.flush = function() {
      return fe(this, void 0, void 0, function() {
        return he(this, function(t) {
          switch (t.label) {
            case 0:
              return [4, this.embedAll(this.fonts)];
            case 1:
              return t.sent(), [4, this.embedAll(this.images)];
            case 2:
              return t.sent(), [4, this.embedAll(this.embeddedPages)];
            case 3:
              return t.sent(), [4, this.embedAll(this.embeddedFiles)];
            case 4:
              return t.sent(), [4, this.embedAll(this.javaScripts)];
            case 5:
              return t.sent(), [
                2
                /*return*/
              ];
          }
        });
      });
    }, e.prototype.save = function(t) {
      return t === void 0 && (t = {}), fe(this, void 0, void 0, function() {
        var r, n, i, a, o, s, l, u, c, f;
        return he(this, function(h) {
          switch (h.label) {
            case 0:
              return r = t.useObjectStreams, n = r === void 0 ? !0 : r, i = t.addDefaultPage, a = i === void 0 ? !0 : i, o = t.objectsPerTick, s = o === void 0 ? 50 : o, l = t.updateFieldAppearances, u = l === void 0 ? !0 : l, D(n, "useObjectStreams", ["boolean"]), D(a, "addDefaultPage", ["boolean"]), D(s, "objectsPerTick", ["number"]), D(u, "updateFieldAppearances", ["boolean"]), a && this.getPageCount() === 0 && this.addPage(), u && (c = this.formCache.getValue(), c && c.updateFieldAppearances()), [4, this.flush()];
            case 1:
              return h.sent(), f = n ? GD : iy, [2, f.forContext(this.context, s).serializeToBuffer()];
          }
        });
      });
    }, e.prototype.saveAsBase64 = function(t) {
      return t === void 0 && (t = {}), fe(this, void 0, void 0, function() {
        var r, n, i, a, o;
        return he(this, function(s) {
          switch (s.label) {
            case 0:
              return r = t.dataUri, n = r === void 0 ? !1 : r, i = RR(t, ["dataUri"]), D(n, "dataUri", ["boolean"]), [4, this.save(i)];
            case 1:
              return a = s.sent(), o = OR(a), [2, n ? "data:application/pdf;base64," + o : o];
          }
        });
      });
    }, e.prototype.findPageForAnnotationRef = function(t) {
      for (var r = this.getPages(), n = 0, i = r.length; n < i; n++) {
        var a = r[n], o = a.node.Annots();
        if ((o == null ? void 0 : o.indexOf(t)) !== void 0)
          return a;
      }
    }, e.prototype.embedAll = function(t) {
      return fe(this, void 0, void 0, function() {
        var r, n;
        return he(this, function(i) {
          switch (i.label) {
            case 0:
              r = 0, n = t.length, i.label = 1;
            case 1:
              return r < n ? [4, t[r].embed()] : [3, 4];
            case 2:
              i.sent(), i.label = 3;
            case 3:
              return r++, [3, 1];
            case 4:
              return [
                2
                /*return*/
              ];
          }
        });
      });
    }, e.prototype.updateInfoDict = function() {
      var t = "pdf-lib (https://github.com/Hopding/pdf-lib)", r = /* @__PURE__ */ new Date(), n = this.getInfoDict();
      this.setProducer(t), this.setModificationDate(r), n.get(x.of("Creator")) || this.setCreator(t), n.get(x.of("CreationDate")) || this.setCreationDate(r);
    }, e.prototype.getInfoDict = function() {
      var t = this.context.lookup(this.context.trailerInfo.Info);
      if (t instanceof ce)
        return t;
      var r = this.context.obj({});
      return this.context.trailerInfo.Info = this.context.register(r), r;
    }, e.prototype.assertFontkit = function() {
      if (!this.fontkit)
        throw new $k();
      return this.fontkit;
    }, e;
  }()
);
function Wr(e) {
  if (!(e instanceof ne) && !(e instanceof Pe))
    throw new Js([ne, Pe], e);
}
var Or;
(function(e) {
  e.Normal = "Normal", e.Multiply = "Multiply", e.Screen = "Screen", e.Overlay = "Overlay", e.Darken = "Darken", e.Lighten = "Lighten", e.ColorDodge = "ColorDodge", e.ColorBurn = "ColorBurn", e.HardLight = "HardLight", e.SoftLight = "SoftLight", e.Difference = "Difference", e.Exclusion = "Exclusion";
})(Or || (Or = {}));
var Wt = (
  /** @class */
  function() {
    function e(t, r, n) {
      this.fontSize = 24, this.fontColor = Oe(0, 0, 0), this.lineHeight = 24, this.x = 0, this.y = 0, D(t, "leafNode", [[Ir, "PDFPageLeaf"]]), D(r, "ref", [[Re, "PDFRef"]]), D(n, "doc", [[mn, "PDFDocument"]]), this.node = t, this.ref = r, this.doc = n;
    }
    return e.prototype.setRotation = function(t) {
      var r = xy(t);
      $m(r, "degreesAngle", 90), this.node.set(x.of("Rotate"), this.doc.context.obj(r));
    }, e.prototype.getRotation = function() {
      var t = this.node.Rotate();
      return ie(t ? t.asNumber() : 0);
    }, e.prototype.setSize = function(t, r) {
      D(t, "width", ["number"]), D(r, "height", ["number"]);
      var n = this.getMediaBox();
      this.setMediaBox(n.x, n.y, t, r);
      var i = this.getCropBox(), a = this.getBleedBox(), o = this.getTrimBox(), s = this.getArtBox(), l = this.node.CropBox(), u = this.node.BleedBox(), c = this.node.TrimBox(), f = this.node.ArtBox();
      l && ds(i, n) && this.setCropBox(n.x, n.y, t, r), u && ds(a, n) && this.setBleedBox(n.x, n.y, t, r), c && ds(o, n) && this.setTrimBox(n.x, n.y, t, r), f && ds(s, n) && this.setArtBox(n.x, n.y, t, r);
    }, e.prototype.setWidth = function(t) {
      D(t, "width", ["number"]), this.setSize(t, this.getSize().height);
    }, e.prototype.setHeight = function(t) {
      D(t, "height", ["number"]), this.setSize(this.getSize().width, t);
    }, e.prototype.setMediaBox = function(t, r, n, i) {
      D(t, "x", ["number"]), D(r, "y", ["number"]), D(n, "width", ["number"]), D(i, "height", ["number"]);
      var a = this.doc.context.obj([t, r, t + n, r + i]);
      this.node.set(x.MediaBox, a);
    }, e.prototype.setCropBox = function(t, r, n, i) {
      D(t, "x", ["number"]), D(r, "y", ["number"]), D(n, "width", ["number"]), D(i, "height", ["number"]);
      var a = this.doc.context.obj([t, r, t + n, r + i]);
      this.node.set(x.CropBox, a);
    }, e.prototype.setBleedBox = function(t, r, n, i) {
      D(t, "x", ["number"]), D(r, "y", ["number"]), D(n, "width", ["number"]), D(i, "height", ["number"]);
      var a = this.doc.context.obj([t, r, t + n, r + i]);
      this.node.set(x.BleedBox, a);
    }, e.prototype.setTrimBox = function(t, r, n, i) {
      D(t, "x", ["number"]), D(r, "y", ["number"]), D(n, "width", ["number"]), D(i, "height", ["number"]);
      var a = this.doc.context.obj([t, r, t + n, r + i]);
      this.node.set(x.TrimBox, a);
    }, e.prototype.setArtBox = function(t, r, n, i) {
      D(t, "x", ["number"]), D(r, "y", ["number"]), D(n, "width", ["number"]), D(i, "height", ["number"]);
      var a = this.doc.context.obj([t, r, t + n, r + i]);
      this.node.set(x.ArtBox, a);
    }, e.prototype.getSize = function() {
      var t = this.getMediaBox(), r = t.width, n = t.height;
      return { width: r, height: n };
    }, e.prototype.getWidth = function() {
      return this.getSize().width;
    }, e.prototype.getHeight = function() {
      return this.getSize().height;
    }, e.prototype.getMediaBox = function() {
      var t = this.node.MediaBox();
      return t.asRectangle();
    }, e.prototype.getCropBox = function() {
      var t, r = this.node.CropBox();
      return (t = r == null ? void 0 : r.asRectangle()) !== null && t !== void 0 ? t : this.getMediaBox();
    }, e.prototype.getBleedBox = function() {
      var t, r = this.node.BleedBox();
      return (t = r == null ? void 0 : r.asRectangle()) !== null && t !== void 0 ? t : this.getCropBox();
    }, e.prototype.getTrimBox = function() {
      var t, r = this.node.TrimBox();
      return (t = r == null ? void 0 : r.asRectangle()) !== null && t !== void 0 ? t : this.getCropBox();
    }, e.prototype.getArtBox = function() {
      var t, r = this.node.ArtBox();
      return (t = r == null ? void 0 : r.asRectangle()) !== null && t !== void 0 ? t : this.getCropBox();
    }, e.prototype.translateContent = function(t, r) {
      D(t, "x", ["number"]), D(r, "y", ["number"]), this.node.normalize(), this.getContentStream();
      var n = this.createContentStream(Qe(), Kt(t, r)), i = this.doc.context.register(n), a = this.createContentStream($e()), o = this.doc.context.register(a);
      this.node.wrapContentStreams(i, o);
    }, e.prototype.scale = function(t, r) {
      D(t, "x", ["number"]), D(r, "y", ["number"]), this.setSize(this.getWidth() * t, this.getHeight() * r), this.scaleContent(t, r), this.scaleAnnotations(t, r);
    }, e.prototype.scaleContent = function(t, r) {
      D(t, "x", ["number"]), D(r, "y", ["number"]), this.node.normalize(), this.getContentStream();
      var n = this.createContentStream(Qe(), so(t, r)), i = this.doc.context.register(n), a = this.createContentStream($e()), o = this.doc.context.register(a);
      this.node.wrapContentStreams(i, o);
    }, e.prototype.scaleAnnotations = function(t, r) {
      D(t, "x", ["number"]), D(r, "y", ["number"]);
      var n = this.node.Annots();
      if (n)
        for (var i = 0; i < n.size(); i++) {
          var a = n.lookup(i);
          a instanceof ce && this.scaleAnnot(a, t, r);
        }
    }, e.prototype.resetPosition = function() {
      this.getContentStream(!1), this.x = 0, this.y = 0;
    }, e.prototype.setFont = function(t) {
      D(t, "font", [[jt, "PDFFont"]]), this.font = t, this.fontKey = this.node.newFontDictionary(this.font.name, this.font.ref);
    }, e.prototype.setFontSize = function(t) {
      D(t, "fontSize", ["number"]), this.fontSize = t;
    }, e.prototype.setFontColor = function(t) {
      D(t, "fontColor", [[Object, "Color"]]), this.fontColor = t;
    }, e.prototype.setLineHeight = function(t) {
      D(t, "lineHeight", ["number"]), this.lineHeight = t;
    }, e.prototype.getPosition = function() {
      return { x: this.x, y: this.y };
    }, e.prototype.getX = function() {
      return this.x;
    }, e.prototype.getY = function() {
      return this.y;
    }, e.prototype.moveTo = function(t, r) {
      D(t, "x", ["number"]), D(r, "y", ["number"]), this.x = t, this.y = r;
    }, e.prototype.moveDown = function(t) {
      D(t, "yDecrease", ["number"]), this.y -= t;
    }, e.prototype.moveUp = function(t) {
      D(t, "yIncrease", ["number"]), this.y += t;
    }, e.prototype.moveLeft = function(t) {
      D(t, "xDecrease", ["number"]), this.x -= t;
    }, e.prototype.moveRight = function(t) {
      D(t, "xIncrease", ["number"]), this.x += t;
    }, e.prototype.pushOperators = function() {
      for (var t = [], r = 0; r < arguments.length; r++)
        t[r] = arguments[r];
      Qm(t, "operator", [[me, "PDFOperator"]]);
      var n = this.getContentStream();
      n.push.apply(n, t);
    }, e.prototype.drawText = function(t, r) {
      var n, i, a, o, s, l, u;
      r === void 0 && (r = {}), D(t, "text", ["string"]), G(r.color, "options.color", [[Object, "Color"]]), ir(r.opacity, "opacity.opacity", 0, 1), G(r.font, "options.font", [[jt, "PDFFont"]]), G(r.size, "options.size", ["number"]), G(r.rotate, "options.rotate", [[Object, "Rotation"]]), G(r.xSkew, "options.xSkew", [[Object, "Rotation"]]), G(r.ySkew, "options.ySkew", [[Object, "Rotation"]]), G(r.x, "options.x", ["number"]), G(r.y, "options.y", ["number"]), G(r.lineHeight, "options.lineHeight", ["number"]), G(r.maxWidth, "options.maxWidth", ["number"]), G(r.wordBreaks, "options.wordBreaks", [Array]), Vt(r.blendMode, "options.blendMode", Or);
      for (var c = this.setOrEmbedFont(r.font), f = c.oldFont, h = c.newFont, d = c.newFontKey, p = r.size || this.fontSize, v = r.wordBreaks || this.doc.defaultWordBreaks, y = function(k) {
        return h.widthOfTextAtSize(k, p);
      }, m = r.maxWidth === void 0 ? $g(Eo(t)) : jR(t, v, r.maxWidth, y), S = new Array(m.length), T = 0, C = m.length; T < C; T++)
        S[T] = h.encodeText(m[T]);
      var A = this.maybeEmbedGraphicsState({
        opacity: r.opacity,
        blendMode: r.blendMode
      }), O = this.getContentStream();
      O.push.apply(O, Hk(S, {
        color: (n = r.color) !== null && n !== void 0 ? n : this.fontColor,
        font: d,
        size: p,
        rotate: (i = r.rotate) !== null && i !== void 0 ? i : ie(0),
        xSkew: (a = r.xSkew) !== null && a !== void 0 ? a : ie(0),
        ySkew: (o = r.ySkew) !== null && o !== void 0 ? o : ie(0),
        x: (s = r.x) !== null && s !== void 0 ? s : this.x,
        y: (l = r.y) !== null && l !== void 0 ? l : this.y,
        lineHeight: (u = r.lineHeight) !== null && u !== void 0 ? u : this.lineHeight,
        graphicsState: A
      })), r.font && (f ? this.setFont(f) : this.resetFont());
    }, e.prototype.drawImage = function(t, r) {
      var n, i, a, o, s, l, u;
      r === void 0 && (r = {}), D(t, "image", [[zc, "PDFImage"]]), G(r.x, "options.x", ["number"]), G(r.y, "options.y", ["number"]), G(r.width, "options.width", ["number"]), G(r.height, "options.height", ["number"]), G(r.rotate, "options.rotate", [[Object, "Rotation"]]), G(r.xSkew, "options.xSkew", [[Object, "Rotation"]]), G(r.ySkew, "options.ySkew", [[Object, "Rotation"]]), ir(r.opacity, "opacity.opacity", 0, 1), Vt(r.blendMode, "options.blendMode", Or);
      var c = this.node.newXObject("Image", t.ref), f = this.maybeEmbedGraphicsState({
        opacity: r.opacity,
        blendMode: r.blendMode
      }), h = this.getContentStream();
      h.push.apply(h, ky(c, {
        x: (n = r.x) !== null && n !== void 0 ? n : this.x,
        y: (i = r.y) !== null && i !== void 0 ? i : this.y,
        width: (a = r.width) !== null && a !== void 0 ? a : t.size().width,
        height: (o = r.height) !== null && o !== void 0 ? o : t.size().height,
        rotate: (s = r.rotate) !== null && s !== void 0 ? s : ie(0),
        xSkew: (l = r.xSkew) !== null && l !== void 0 ? l : ie(0),
        ySkew: (u = r.ySkew) !== null && u !== void 0 ? u : ie(0),
        graphicsState: f
      }));
    }, e.prototype.drawPage = function(t, r) {
      var n, i, a, o, s;
      r === void 0 && (r = {}), D(t, "embeddedPage", [
        [jy, "PDFEmbeddedPage"]
      ]), G(r.x, "options.x", ["number"]), G(r.y, "options.y", ["number"]), G(r.xScale, "options.xScale", ["number"]), G(r.yScale, "options.yScale", ["number"]), G(r.width, "options.width", ["number"]), G(r.height, "options.height", ["number"]), G(r.rotate, "options.rotate", [[Object, "Rotation"]]), G(r.xSkew, "options.xSkew", [[Object, "Rotation"]]), G(r.ySkew, "options.ySkew", [[Object, "Rotation"]]), ir(r.opacity, "opacity.opacity", 0, 1), Vt(r.blendMode, "options.blendMode", Or);
      var l = this.node.newXObject("EmbeddedPdfPage", t.ref), u = this.maybeEmbedGraphicsState({
        opacity: r.opacity,
        blendMode: r.blendMode
      }), c = r.width !== void 0 ? r.width / t.width : r.xScale !== void 0 ? r.xScale : 1, f = r.height !== void 0 ? r.height / t.height : r.yScale !== void 0 ? r.yScale : 1, h = this.getContentStream();
      h.push.apply(h, Wk(l, {
        x: (n = r.x) !== null && n !== void 0 ? n : this.x,
        y: (i = r.y) !== null && i !== void 0 ? i : this.y,
        xScale: c,
        yScale: f,
        rotate: (a = r.rotate) !== null && a !== void 0 ? a : ie(0),
        xSkew: (o = r.xSkew) !== null && o !== void 0 ? o : ie(0),
        ySkew: (s = r.ySkew) !== null && s !== void 0 ? s : ie(0),
        graphicsState: u
      }));
    }, e.prototype.drawSvgPath = function(t, r) {
      var n, i, a, o, s, l, u, c, f;
      r === void 0 && (r = {}), D(t, "path", ["string"]), G(r.x, "options.x", ["number"]), G(r.y, "options.y", ["number"]), G(r.scale, "options.scale", ["number"]), G(r.rotate, "options.rotate", [[Object, "Rotation"]]), G(r.borderWidth, "options.borderWidth", ["number"]), G(r.color, "options.color", [[Object, "Color"]]), ir(r.opacity, "opacity.opacity", 0, 1), G(r.borderColor, "options.borderColor", [
        [Object, "Color"]
      ]), G(r.borderDashArray, "options.borderDashArray", [
        Array
      ]), G(r.borderDashPhase, "options.borderDashPhase", [
        "number"
      ]), Vt(r.borderLineCap, "options.borderLineCap", Fi), ir(r.borderOpacity, "options.borderOpacity", 0, 1), Vt(r.blendMode, "options.blendMode", Or);
      var h = this.maybeEmbedGraphicsState({
        opacity: r.opacity,
        borderOpacity: r.borderOpacity,
        blendMode: r.blendMode
      });
      !("color" in r) && !("borderColor" in r) && (r.borderColor = Oe(0, 0, 0));
      var d = this.getContentStream();
      d.push.apply(d, Yk(t, {
        x: (n = r.x) !== null && n !== void 0 ? n : this.x,
        y: (i = r.y) !== null && i !== void 0 ? i : this.y,
        scale: r.scale,
        rotate: (a = r.rotate) !== null && a !== void 0 ? a : ie(0),
        color: (o = r.color) !== null && o !== void 0 ? o : void 0,
        borderColor: (s = r.borderColor) !== null && s !== void 0 ? s : void 0,
        borderWidth: (l = r.borderWidth) !== null && l !== void 0 ? l : 0,
        borderDashArray: (u = r.borderDashArray) !== null && u !== void 0 ? u : void 0,
        borderDashPhase: (c = r.borderDashPhase) !== null && c !== void 0 ? c : void 0,
        borderLineCap: (f = r.borderLineCap) !== null && f !== void 0 ? f : void 0,
        graphicsState: h
      }));
    }, e.prototype.drawLine = function(t) {
      var r, n, i, a, o;
      D(t.start, "options.start", [
        [Object, "{ x: number, y: number }"]
      ]), D(t.end, "options.end", [
        [Object, "{ x: number, y: number }"]
      ]), D(t.start.x, "options.start.x", ["number"]), D(t.start.y, "options.start.y", ["number"]), D(t.end.x, "options.end.x", ["number"]), D(t.end.y, "options.end.y", ["number"]), G(t.thickness, "options.thickness", ["number"]), G(t.color, "options.color", [[Object, "Color"]]), G(t.dashArray, "options.dashArray", [Array]), G(t.dashPhase, "options.dashPhase", ["number"]), Vt(t.lineCap, "options.lineCap", Fi), ir(t.opacity, "opacity.opacity", 0, 1), Vt(t.blendMode, "options.blendMode", Or);
      var s = this.maybeEmbedGraphicsState({
        borderOpacity: t.opacity,
        blendMode: t.blendMode
      });
      "color" in t || (t.color = Oe(0, 0, 0));
      var l = this.getContentStream();
      l.push.apply(l, Gk({
        start: t.start,
        end: t.end,
        thickness: (r = t.thickness) !== null && r !== void 0 ? r : 1,
        color: (n = t.color) !== null && n !== void 0 ? n : void 0,
        dashArray: (i = t.dashArray) !== null && i !== void 0 ? i : void 0,
        dashPhase: (a = t.dashPhase) !== null && a !== void 0 ? a : void 0,
        lineCap: (o = t.lineCap) !== null && o !== void 0 ? o : void 0,
        graphicsState: s
      }));
    }, e.prototype.drawRectangle = function(t) {
      var r, n, i, a, o, s, l, u, c, f, h, d, p;
      t === void 0 && (t = {}), G(t.x, "options.x", ["number"]), G(t.y, "options.y", ["number"]), G(t.width, "options.width", ["number"]), G(t.height, "options.height", ["number"]), G(t.rotate, "options.rotate", [[Object, "Rotation"]]), G(t.xSkew, "options.xSkew", [[Object, "Rotation"]]), G(t.ySkew, "options.ySkew", [[Object, "Rotation"]]), G(t.borderWidth, "options.borderWidth", ["number"]), G(t.color, "options.color", [[Object, "Color"]]), ir(t.opacity, "opacity.opacity", 0, 1), G(t.borderColor, "options.borderColor", [
        [Object, "Color"]
      ]), G(t.borderDashArray, "options.borderDashArray", [
        Array
      ]), G(t.borderDashPhase, "options.borderDashPhase", [
        "number"
      ]), Vt(t.borderLineCap, "options.borderLineCap", Fi), ir(t.borderOpacity, "options.borderOpacity", 0, 1), Vt(t.blendMode, "options.blendMode", Or);
      var v = this.maybeEmbedGraphicsState({
        opacity: t.opacity,
        borderOpacity: t.borderOpacity,
        blendMode: t.blendMode
      });
      !("color" in t) && !("borderColor" in t) && (t.color = Oe(0, 0, 0));
      var y = this.getContentStream();
      y.push.apply(y, Li({
        x: (r = t.x) !== null && r !== void 0 ? r : this.x,
        y: (n = t.y) !== null && n !== void 0 ? n : this.y,
        width: (i = t.width) !== null && i !== void 0 ? i : 150,
        height: (a = t.height) !== null && a !== void 0 ? a : 100,
        rotate: (o = t.rotate) !== null && o !== void 0 ? o : ie(0),
        xSkew: (s = t.xSkew) !== null && s !== void 0 ? s : ie(0),
        ySkew: (l = t.ySkew) !== null && l !== void 0 ? l : ie(0),
        borderWidth: (u = t.borderWidth) !== null && u !== void 0 ? u : 0,
        color: (c = t.color) !== null && c !== void 0 ? c : void 0,
        borderColor: (f = t.borderColor) !== null && f !== void 0 ? f : void 0,
        borderDashArray: (h = t.borderDashArray) !== null && h !== void 0 ? h : void 0,
        borderDashPhase: (d = t.borderDashPhase) !== null && d !== void 0 ? d : void 0,
        graphicsState: v,
        borderLineCap: (p = t.borderLineCap) !== null && p !== void 0 ? p : void 0
      }));
    }, e.prototype.drawSquare = function(t) {
      t === void 0 && (t = {});
      var r = t.size;
      G(r, "size", ["number"]), this.drawRectangle(le(le({}, t), { width: r, height: r }));
    }, e.prototype.drawEllipse = function(t) {
      var r, n, i, a, o, s, l, u, c, f, h;
      t === void 0 && (t = {}), G(t.x, "options.x", ["number"]), G(t.y, "options.y", ["number"]), G(t.xScale, "options.xScale", ["number"]), G(t.yScale, "options.yScale", ["number"]), G(t.rotate, "options.rotate", [[Object, "Rotation"]]), G(t.color, "options.color", [[Object, "Color"]]), ir(t.opacity, "opacity.opacity", 0, 1), G(t.borderColor, "options.borderColor", [
        [Object, "Color"]
      ]), ir(t.borderOpacity, "options.borderOpacity", 0, 1), G(t.borderWidth, "options.borderWidth", ["number"]), G(t.borderDashArray, "options.borderDashArray", [
        Array
      ]), G(t.borderDashPhase, "options.borderDashPhase", [
        "number"
      ]), Vt(t.borderLineCap, "options.borderLineCap", Fi), Vt(t.blendMode, "options.blendMode", Or);
      var d = this.maybeEmbedGraphicsState({
        opacity: t.opacity,
        borderOpacity: t.borderOpacity,
        blendMode: t.blendMode
      });
      !("color" in t) && !("borderColor" in t) && (t.color = Oe(0, 0, 0));
      var p = this.getContentStream();
      p.push.apply(p, _c({
        x: (r = t.x) !== null && r !== void 0 ? r : this.x,
        y: (n = t.y) !== null && n !== void 0 ? n : this.y,
        xScale: (i = t.xScale) !== null && i !== void 0 ? i : 100,
        yScale: (a = t.yScale) !== null && a !== void 0 ? a : 100,
        rotate: (o = t.rotate) !== null && o !== void 0 ? o : void 0,
        color: (s = t.color) !== null && s !== void 0 ? s : void 0,
        borderColor: (l = t.borderColor) !== null && l !== void 0 ? l : void 0,
        borderWidth: (u = t.borderWidth) !== null && u !== void 0 ? u : 0,
        borderDashArray: (c = t.borderDashArray) !== null && c !== void 0 ? c : void 0,
        borderDashPhase: (f = t.borderDashPhase) !== null && f !== void 0 ? f : void 0,
        borderLineCap: (h = t.borderLineCap) !== null && h !== void 0 ? h : void 0,
        graphicsState: d
      }));
    }, e.prototype.drawCircle = function(t) {
      t === void 0 && (t = {});
      var r = t.size, n = r === void 0 ? 100 : r;
      G(n, "size", ["number"]), this.drawEllipse(le(le({}, t), { xScale: n, yScale: n }));
    }, e.prototype.setOrEmbedFont = function(t) {
      var r = this.font, n = this.fontKey;
      t ? this.setFont(t) : this.getFont();
      var i = this.font, a = this.fontKey;
      return { oldFont: r, oldFontKey: n, newFont: i, newFontKey: a };
    }, e.prototype.getFont = function() {
      if (!this.font || !this.fontKey) {
        var t = this.doc.embedStandardFont(ll.Helvetica);
        this.setFont(t);
      }
      return [this.font, this.fontKey];
    }, e.prototype.resetFont = function() {
      this.font = void 0, this.fontKey = void 0;
    }, e.prototype.getContentStream = function(t) {
      return t === void 0 && (t = !0), t && this.contentStream ? this.contentStream : (this.contentStream = this.createContentStream(), this.contentStreamRef = this.doc.context.register(this.contentStream), this.node.addContentStream(this.contentStreamRef), this.contentStream);
    }, e.prototype.createContentStream = function() {
      for (var t = [], r = 0; r < arguments.length; r++)
        t[r] = arguments[r];
      var n = this.doc.context.obj({}), i = Da.of(n, t);
      return i;
    }, e.prototype.maybeEmbedGraphicsState = function(t) {
      var r = t.opacity, n = t.borderOpacity, i = t.blendMode;
      if (!(r === void 0 && n === void 0 && i === void 0)) {
        var a = this.doc.context.obj({
          Type: "ExtGState",
          ca: r,
          CA: n,
          BM: i
        }), o = this.node.newExtGState("GS", a);
        return o;
      }
    }, e.prototype.scaleAnnot = function(t, r, n) {
      for (var i = ["RD", "CL", "Vertices", "QuadPoints", "L", "Rect"], a = 0, o = i.length; a < o; a++) {
        var s = t.lookup(x.of(i[a]));
        s instanceof Ee && s.scalePDFNumbers(r, n);
      }
      var l = t.lookup(x.of("InkList"));
      if (l instanceof Ee)
        for (var a = 0, o = l.size(); a < o; a++) {
          var u = l.lookup(a);
          u instanceof Ee && u.scalePDFNumbers(r, n);
        }
    }, e.of = function(t, r, n) {
      return new e(t, r, n);
    }, e.create = function(t) {
      D(t, "doc", [[mn, "PDFDocument"]]);
      var r = Re.of(-1), n = Ir.withContextAndParent(t.context, r), i = t.context.register(n);
      return new e(n, i, t);
    }, e;
  }()
), Us = (
  /** @class */
  function(e) {
    K(t, e);
    function t(r, n, i) {
      var a = e.call(this, r, n, i) || this;
      return D(r, "acroButton", [
        [Wl, "PDFAcroPushButton"]
      ]), a.acroField = r, a;
    }
    return t.prototype.setImage = function(r, n) {
      n === void 0 && (n = ln.Center);
      for (var i = this.acroField.getWidgets(), a = 0, o = i.length; a < o; a++) {
        var s = i[a], l = this.createImageAppearanceStream(s, r, n);
        this.updateWidgetAppearances(s, { normal: l });
      }
      this.markAsClean();
    }, t.prototype.setFontSize = function(r) {
      _l(r, "fontSize"), this.acroField.setFontSize(r), this.markAsDirty();
    }, t.prototype.addToPage = function(r, n, i) {
      var a, o, s, l, u, c, f, h, d, p, v;
      G(r, "text", ["string"]), G(n, "page", [[Wt, "PDFPage"]]), Yi(i);
      var y = this.createWidget({
        x: ((a = i == null ? void 0 : i.x) !== null && a !== void 0 ? a : 0) - ((o = i == null ? void 0 : i.borderWidth) !== null && o !== void 0 ? o : 0) / 2,
        y: ((s = i == null ? void 0 : i.y) !== null && s !== void 0 ? s : 0) - ((l = i == null ? void 0 : i.borderWidth) !== null && l !== void 0 ? l : 0) / 2,
        width: (u = i == null ? void 0 : i.width) !== null && u !== void 0 ? u : 100,
        height: (c = i == null ? void 0 : i.height) !== null && c !== void 0 ? c : 50,
        textColor: (f = i == null ? void 0 : i.textColor) !== null && f !== void 0 ? f : Oe(0, 0, 0),
        backgroundColor: (h = i == null ? void 0 : i.backgroundColor) !== null && h !== void 0 ? h : Oe(0.75, 0.75, 0.75),
        borderColor: i == null ? void 0 : i.borderColor,
        borderWidth: (d = i == null ? void 0 : i.borderWidth) !== null && d !== void 0 ? d : 0,
        rotate: (p = i == null ? void 0 : i.rotate) !== null && p !== void 0 ? p : ie(0),
        caption: r,
        hidden: i == null ? void 0 : i.hidden,
        page: n.ref
      }), m = this.doc.context.register(y.dict);
      this.acroField.addWidget(m);
      var S = (v = i == null ? void 0 : i.font) !== null && v !== void 0 ? v : this.doc.getForm().getDefaultFont();
      this.updateWidgetAppearance(y, S), n.node.addAnnot(m);
    }, t.prototype.needsAppearancesUpdate = function() {
      var r;
      if (this.isDirty())
        return !0;
      for (var n = this.acroField.getWidgets(), i = 0, a = n.length; i < a; i++) {
        var o = n[i], s = ((r = o.getAppearances()) === null || r === void 0 ? void 0 : r.normal) instanceof Mt;
        if (!s)
          return !0;
      }
      return !1;
    }, t.prototype.defaultUpdateAppearances = function(r) {
      D(r, "font", [[jt, "PDFFont"]]), this.updateAppearances(r);
    }, t.prototype.updateAppearances = function(r, n) {
      D(r, "font", [[jt, "PDFFont"]]), G(n, "provider", [Function]);
      for (var i = this.acroField.getWidgets(), a = 0, o = i.length; a < o; a++) {
        var s = i[a];
        this.updateWidgetAppearance(s, r, n);
      }
    }, t.prototype.updateWidgetAppearance = function(r, n, i) {
      var a = i ?? gN, o = Xi(a(this, r, n));
      this.updateWidgetAppearanceWithFont(r, n, o);
    }, t.of = function(r, n, i) {
      return new t(r, n, i);
    }, t;
  }(ni)
);
const CN = Yb(import.meta.url), _y = Ne.dirname(Up(import.meta.url)), AN = Up(import.meta.url);
globalThis.__filename = AN;
process.env.APP_ROOT = Ne.join(_y, "..");
const Hc = process.env.VITE_DEV_SERVER_URL, XN = Ne.join(process.env.APP_ROOT, "dist-electron"), zy = Ne.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = Hc ? Ne.join(process.env.APP_ROOT, "public") : zy;
let Xr = null;
function qy(e) {
  let t = [];
  const r = Ae.readdirSync(e, { withFileTypes: !0 });
  for (const n of r) {
    const i = Ne.join(e, n.name);
    n.isDirectory() ? t = t.concat(qy(i)) : n.isFile() && n.name.toLowerCase().endsWith(".pdf") && t.push(i);
  }
  return t;
}
async function Vy() {
  const e = Ne.join(ur.getPath("userData"), "library");
  if (!Ae.existsSync(e)) return;
  const t = qy(e);
  for (const r of t)
    try {
      const n = eu(r), i = qn(n), o = Ne.relative(e, r).split(Ne.sep), s = o.length > 1 ? o[0] : null;
      if (i) {
        let l = i.filePath !== r || i.isSynced !== 1 && i.isSynced !== void 0 || i.category !== s;
        if (!i.thumbnailPath) {
          const u = await ul(r, n);
          u && Jg(n, u);
        }
        l && (Sc(n, r), Ja(n, !0, s || void 0), console.log("Updated path:", i.title));
      } else {
        const l = Ne.basename(r), u = await ul(r, n), c = await Hy(r);
        Af(
          l,
          r,
          n,
          u || void 0,
          c
        ), qn(n) && Ja(n, !0, s || void 0), console.log("Added new document:", l);
      }
    } catch (n) {
      console.error("Error scanning:", r, n);
    }
}
async function Hy(e) {
  try {
    const t = Ae.readFileSync(e);
    return (await mn.load(t)).getPageCount();
  } catch (t) {
    return console.error("Error getting PDF page count:", t), 1;
  }
}
function PN() {
  const e = Ne.join(ur.getPath("userData"), "library");
  return Ae.existsSync(e) || Ae.mkdirSync(e, { recursive: !0 }), e;
}
function eu(e) {
  const t = Ae.readFileSync(e), r = Bi.createHash("sha256");
  return r.update(t), r.digest("hex");
}
async function ul(e, t) {
  try {
    const r = CN("pdf-poppler"), n = Ne.join(ur.getPath("userData"), "thumbnails");
    Ae.existsSync(n) || Ae.mkdirSync(n, { recursive: !0 });
    const i = () => {
      const u = Ae.readdirSync(n).find(
        (c) => c.startsWith(`${t}-`) && c.endsWith(".jpg")
      );
      if (u) {
        const c = Ne.join(n, u);
        return console.log(`Found existing thumbnail: ${c}`), c;
      }
      return null;
    }, a = i();
    if (a)
      return a;
    const o = {
      format: "jpeg",
      out_dir: n,
      out_prefix: t,
      page: 1
    };
    await r.convert(e, o);
    const s = i();
    return s ? (console.log(`Thumbnail generated: ${s}`), s) : (console.error(
      `No thumbnail file found after generation for hash: ${t}`
    ), null);
  } catch (r) {
    return console.error("Error generating thumbnail:", r), null;
  }
}
function Wy() {
  Xr = new Ip({
    icon: Ne.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    title: "Lyceum",
    width: 1200,
    height: 800,
    webPreferences: {
      preload: Ne.join(_y, "preload.mjs")
    },
    autoHideMenuBar: !0
  }), Hc ? Xr.loadURL(Hc) : Xr.loadFile(Ne.join(zy, "index.html")), Xr.webContents.on("did-finish-load", () => {
    Xr == null || Xr.webContents.setZoomFactor(1);
  });
}
ur.on("window-all-closed", () => {
  process.platform !== "darwin" && (ur.quit(), Xr = null);
});
ur.on("activate", () => {
  Ip.getAllWindows().length === 0 && Wy();
});
_t.handle("add-document", (e, t) => {
  const r = eu(t.filePath), n = qn(r);
  return n || Af(t.title, t.filePath, r);
});
_t.handle("get-documents", () => TR());
_t.handle("reading:save", (e, t) => {
  const { fileHash: r, state: n } = t ?? {};
  if (!r || !n) return;
  const i = {
    currentPage: n.currentPage ?? 1,
    currentZoom: n.currentZoom ?? 1,
    currentScroll: n.currentScroll ?? 0,
    annotations: n.annotations ?? "[]"
  };
  FR(r, i);
});
_t.handle("reading:get", (e, t) => qn(t));
_t.handle("dialog:open-pdf", async () => {
  const e = await Xb.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (e.canceled || !e.filePaths[0]) return null;
  const t = e.filePaths[0], r = Ne.basename(t), n = eu(t), i = Ae.readFileSync(t).buffer, a = qn(n);
  if (a)
    return SR(n), { ...a, fileBuffer: i };
  const o = await ul(t, n), s = await Hy(t);
  Af(r, t, n, o || void 0, s);
  const l = qn(n);
  return l ? (Ja(n, !1), { ...l, fileBuffer: i, thumbnailPath: o }) : null;
});
_t.handle("app:get-last-document", () => CR());
_t.handle("thumbnail:get", async (e, t) => {
  try {
    if (!t)
      return null;
    if (Ae.existsSync(t))
      return `data:image/jpeg;base64,${Ae.readFileSync(t).toString("base64")}`;
    const r = Ne.dirname(t), i = Ne.basename(t, Ne.extname(t)).replace(/-\d+$/, "").replace(/-0+\d+$/, "");
    if (Ae.existsSync(r)) {
      const o = Ae.readdirSync(r).find((s) => s.startsWith(i) && s.endsWith(".jpg"));
      if (o)
        return `data:image/jpeg;base64,${Ae.readFileSync(Ne.join(r, o)).toString("base64")}`;
    }
    return null;
  } catch (r) {
    return console.error("[thumbnail:get] Error:", r), null;
  }
});
_t.handle("pdf:reopen", async (e, t) => {
  try {
    const r = Ae.readFileSync(t).buffer, n = eu(t);
    return { fileBuffer: r, fileHash: n };
  } catch {
    return null;
  }
});
_t.handle("library:get-path", () => Ne.join(ur.getPath("userData"), "library"));
_t.handle("library:scan", async () => {
  await Vy();
});
_t.handle("library:get-sync-status", (e, t) => AR(t));
_t.handle("library:get-categories", () => PR());
_t.handle("library:sync-document", async (e, t, r, n) => {
  const i = qn(t);
  if (!i) return { success: !1, error: "Document not found" };
  const a = Ne.join(ur.getPath("userData"), "library"), o = n ? Ne.join(a, n) : a;
  Ae.existsSync(o) || Ae.mkdirSync(o, { recursive: !0 });
  const s = Ne.basename(i.filePath), l = Ne.join(o, s);
  try {
    if (r === "move" ? Ae.renameSync(i.filePath, l) : Ae.copyFileSync(i.filePath, l), i.thumbnailPath && Ae.existsSync(i.thumbnailPath)) {
      const u = Ne.basename(i.thumbnailPath), c = Ne.join(ur.getPath("userData"), "thumbnails", u);
      r === "move" ? Ae.renameSync(i.thumbnailPath, c) : Ae.copyFileSync(i.thumbnailPath, c), Sc(t, l), Ja(t, !0, n);
    } else {
      Sc(t, l), Ja(t, !0, n);
      const u = await ul(l, t);
      u && Jg(t, u);
    }
    return { success: !0, newPath: l };
  } catch (u) {
    return { success: !1, error: String(u) };
  }
});
ur.whenReady().then(async () => {
  ER(), PN(), await Vy(), _p.autoUpdater.checkForUpdatesAndNotify(), Wy();
});
export {
  XN as MAIN_DIST,
  zy as RENDERER_DIST,
  Hc as VITE_DEV_SERVER_URL
};
