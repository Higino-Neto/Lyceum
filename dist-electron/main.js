import kt, { app as Un, BrowserWindow as ql, ipcMain as Gl } from "electron";
import { createRequire as Ed } from "node:module";
import { fileURLToPath as Vl } from "node:url";
import pt from "node:path";
import qe from "fs";
import yd from "constants";
import Gr from "stream";
import Kn from "util";
import Wl from "assert";
import Q from "path";
import Jn from "child_process";
import Yl from "events";
import Vr from "crypto";
import zl from "tty";
import Qn from "os";
import _t from "url";
import Xl from "zlib";
import wd from "http";
var Ae = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, Kl = {}, Bt = {}, Oe = {};
Oe.fromCallback = function(e) {
  return Object.defineProperty(function(...t) {
    if (typeof t[t.length - 1] == "function") e.apply(this, t);
    else
      return new Promise((r, n) => {
        t.push((i, o) => i != null ? n(i) : r(o)), e.apply(this, t);
      });
  }, "name", { value: e.name });
};
Oe.fromPromise = function(e) {
  return Object.defineProperty(function(...t) {
    const r = t[t.length - 1];
    if (typeof r != "function") return e.apply(this, t);
    t.pop(), e.apply(this, t).then((n) => r(null, n), r);
  }, "name", { value: e.name });
};
var lt = yd, vd = process.cwd, Dn = null, _d = process.env.GRACEFUL_FS_PLATFORM || process.platform;
process.cwd = function() {
  return Dn || (Dn = vd.call(process)), Dn;
};
try {
  process.cwd();
} catch {
}
if (typeof process.chdir == "function") {
  var xa = process.chdir;
  process.chdir = function(e) {
    Dn = null, xa.call(process, e);
  }, Object.setPrototypeOf && Object.setPrototypeOf(process.chdir, xa);
}
var bd = Td;
function Td(e) {
  lt.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./) && t(e), e.lutimes || r(e), e.chown = o(e.chown), e.fchown = o(e.fchown), e.lchown = o(e.lchown), e.chmod = n(e.chmod), e.fchmod = n(e.fchmod), e.lchmod = n(e.lchmod), e.chownSync = a(e.chownSync), e.fchownSync = a(e.fchownSync), e.lchownSync = a(e.lchownSync), e.chmodSync = i(e.chmodSync), e.fchmodSync = i(e.fchmodSync), e.lchmodSync = i(e.lchmodSync), e.stat = s(e.stat), e.fstat = s(e.fstat), e.lstat = s(e.lstat), e.statSync = l(e.statSync), e.fstatSync = l(e.fstatSync), e.lstatSync = l(e.lstatSync), e.chmod && !e.lchmod && (e.lchmod = function(c, f, d) {
    d && process.nextTick(d);
  }, e.lchmodSync = function() {
  }), e.chown && !e.lchown && (e.lchown = function(c, f, d, h) {
    h && process.nextTick(h);
  }, e.lchownSync = function() {
  }), _d === "win32" && (e.rename = typeof e.rename != "function" ? e.rename : function(c) {
    function f(d, h, y) {
      var E = Date.now(), _ = 0;
      c(d, h, function T(A) {
        if (A && (A.code === "EACCES" || A.code === "EPERM" || A.code === "EBUSY") && Date.now() - E < 6e4) {
          setTimeout(function() {
            e.stat(h, function(N, x) {
              N && N.code === "ENOENT" ? c(d, h, T) : y(A);
            });
          }, _), _ < 100 && (_ += 10);
          return;
        }
        y && y(A);
      });
    }
    return Object.setPrototypeOf && Object.setPrototypeOf(f, c), f;
  }(e.rename)), e.read = typeof e.read != "function" ? e.read : function(c) {
    function f(d, h, y, E, _, T) {
      var A;
      if (T && typeof T == "function") {
        var N = 0;
        A = function(x, G, te) {
          if (x && x.code === "EAGAIN" && N < 10)
            return N++, c.call(e, d, h, y, E, _, A);
          T.apply(this, arguments);
        };
      }
      return c.call(e, d, h, y, E, _, A);
    }
    return Object.setPrototypeOf && Object.setPrototypeOf(f, c), f;
  }(e.read), e.readSync = typeof e.readSync != "function" ? e.readSync : /* @__PURE__ */ function(c) {
    return function(f, d, h, y, E) {
      for (var _ = 0; ; )
        try {
          return c.call(e, f, d, h, y, E);
        } catch (T) {
          if (T.code === "EAGAIN" && _ < 10) {
            _++;
            continue;
          }
          throw T;
        }
    };
  }(e.readSync);
  function t(c) {
    c.lchmod = function(f, d, h) {
      c.open(
        f,
        lt.O_WRONLY | lt.O_SYMLINK,
        d,
        function(y, E) {
          if (y) {
            h && h(y);
            return;
          }
          c.fchmod(E, d, function(_) {
            c.close(E, function(T) {
              h && h(_ || T);
            });
          });
        }
      );
    }, c.lchmodSync = function(f, d) {
      var h = c.openSync(f, lt.O_WRONLY | lt.O_SYMLINK, d), y = !0, E;
      try {
        E = c.fchmodSync(h, d), y = !1;
      } finally {
        if (y)
          try {
            c.closeSync(h);
          } catch {
          }
        else
          c.closeSync(h);
      }
      return E;
    };
  }
  function r(c) {
    lt.hasOwnProperty("O_SYMLINK") && c.futimes ? (c.lutimes = function(f, d, h, y) {
      c.open(f, lt.O_SYMLINK, function(E, _) {
        if (E) {
          y && y(E);
          return;
        }
        c.futimes(_, d, h, function(T) {
          c.close(_, function(A) {
            y && y(T || A);
          });
        });
      });
    }, c.lutimesSync = function(f, d, h) {
      var y = c.openSync(f, lt.O_SYMLINK), E, _ = !0;
      try {
        E = c.futimesSync(y, d, h), _ = !1;
      } finally {
        if (_)
          try {
            c.closeSync(y);
          } catch {
          }
        else
          c.closeSync(y);
      }
      return E;
    }) : c.futimes && (c.lutimes = function(f, d, h, y) {
      y && process.nextTick(y);
    }, c.lutimesSync = function() {
    });
  }
  function n(c) {
    return c && function(f, d, h) {
      return c.call(e, f, d, function(y) {
        p(y) && (y = null), h && h.apply(this, arguments);
      });
    };
  }
  function i(c) {
    return c && function(f, d) {
      try {
        return c.call(e, f, d);
      } catch (h) {
        if (!p(h)) throw h;
      }
    };
  }
  function o(c) {
    return c && function(f, d, h, y) {
      return c.call(e, f, d, h, function(E) {
        p(E) && (E = null), y && y.apply(this, arguments);
      });
    };
  }
  function a(c) {
    return c && function(f, d, h) {
      try {
        return c.call(e, f, d, h);
      } catch (y) {
        if (!p(y)) throw y;
      }
    };
  }
  function s(c) {
    return c && function(f, d, h) {
      typeof d == "function" && (h = d, d = null);
      function y(E, _) {
        _ && (_.uid < 0 && (_.uid += 4294967296), _.gid < 0 && (_.gid += 4294967296)), h && h.apply(this, arguments);
      }
      return d ? c.call(e, f, d, y) : c.call(e, f, y);
    };
  }
  function l(c) {
    return c && function(f, d) {
      var h = d ? c.call(e, f, d) : c.call(e, f);
      return h && (h.uid < 0 && (h.uid += 4294967296), h.gid < 0 && (h.gid += 4294967296)), h;
    };
  }
  function p(c) {
    if (!c || c.code === "ENOSYS")
      return !0;
    var f = !process.getuid || process.getuid() !== 0;
    return !!(f && (c.code === "EINVAL" || c.code === "EPERM"));
  }
}
var La = Gr.Stream, Ad = Sd;
function Sd(e) {
  return {
    ReadStream: t,
    WriteStream: r
  };
  function t(n, i) {
    if (!(this instanceof t)) return new t(n, i);
    La.call(this);
    var o = this;
    this.path = n, this.fd = null, this.readable = !0, this.paused = !1, this.flags = "r", this.mode = 438, this.bufferSize = 64 * 1024, i = i || {};
    for (var a = Object.keys(i), s = 0, l = a.length; s < l; s++) {
      var p = a[s];
      this[p] = i[p];
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
        o._read();
      });
      return;
    }
    e.open(this.path, this.flags, this.mode, function(c, f) {
      if (c) {
        o.emit("error", c), o.readable = !1;
        return;
      }
      o.fd = f, o.emit("open", f), o._read();
    });
  }
  function r(n, i) {
    if (!(this instanceof r)) return new r(n, i);
    La.call(this), this.path = n, this.fd = null, this.writable = !0, this.flags = "w", this.encoding = "binary", this.mode = 438, this.bytesWritten = 0, i = i || {};
    for (var o = Object.keys(i), a = 0, s = o.length; a < s; a++) {
      var l = o[a];
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
var Cd = Rd, Od = Object.getPrototypeOf || function(e) {
  return e.__proto__;
};
function Rd(e) {
  if (e === null || typeof e != "object")
    return e;
  if (e instanceof Object)
    var t = { __proto__: Od(e) };
  else
    var t = /* @__PURE__ */ Object.create(null);
  return Object.getOwnPropertyNames(e).forEach(function(r) {
    Object.defineProperty(t, r, Object.getOwnPropertyDescriptor(e, r));
  }), t;
}
var ne = qe, Id = bd, Pd = Ad, Nd = Cd, pn = Kn, me, kn;
typeof Symbol == "function" && typeof Symbol.for == "function" ? (me = Symbol.for("graceful-fs.queue"), kn = Symbol.for("graceful-fs.previous")) : (me = "___graceful-fs.queue", kn = "___graceful-fs.previous");
function Dd() {
}
function Jl(e, t) {
  Object.defineProperty(e, me, {
    get: function() {
      return t;
    }
  });
}
var xt = Dd;
pn.debuglog ? xt = pn.debuglog("gfs4") : /\bgfs4\b/i.test(process.env.NODE_DEBUG || "") && (xt = function() {
  var e = pn.format.apply(pn, arguments);
  e = "GFS4: " + e.split(/\n/).join(`
GFS4: `), console.error(e);
});
if (!ne[me]) {
  var $d = Ae[me] || [];
  Jl(ne, $d), ne.close = function(e) {
    function t(r, n) {
      return e.call(ne, r, function(i) {
        i || Ua(), typeof n == "function" && n.apply(this, arguments);
      });
    }
    return Object.defineProperty(t, kn, {
      value: e
    }), t;
  }(ne.close), ne.closeSync = function(e) {
    function t(r) {
      e.apply(ne, arguments), Ua();
    }
    return Object.defineProperty(t, kn, {
      value: e
    }), t;
  }(ne.closeSync), /\bgfs4\b/i.test(process.env.NODE_DEBUG || "") && process.on("exit", function() {
    xt(ne[me]), Wl.equal(ne[me].length, 0);
  });
}
Ae[me] || Jl(Ae, ne[me]);
var Re = Uo(Nd(ne));
process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !ne.__patched && (Re = Uo(ne), ne.__patched = !0);
function Uo(e) {
  Id(e), e.gracefulify = Uo, e.createReadStream = G, e.createWriteStream = te;
  var t = e.readFile;
  e.readFile = r;
  function r(w, q, B) {
    return typeof q == "function" && (B = q, q = null), M(w, q, B);
    function M(X, I, O, D) {
      return t(X, I, function(C) {
        C && (C.code === "EMFILE" || C.code === "ENFILE") ? Wt([M, [X, I, O], C, D || Date.now(), Date.now()]) : typeof O == "function" && O.apply(this, arguments);
      });
    }
  }
  var n = e.writeFile;
  e.writeFile = i;
  function i(w, q, B, M) {
    return typeof B == "function" && (M = B, B = null), X(w, q, B, M);
    function X(I, O, D, C, $) {
      return n(I, O, D, function(P) {
        P && (P.code === "EMFILE" || P.code === "ENFILE") ? Wt([X, [I, O, D, C], P, $ || Date.now(), Date.now()]) : typeof C == "function" && C.apply(this, arguments);
      });
    }
  }
  var o = e.appendFile;
  o && (e.appendFile = a);
  function a(w, q, B, M) {
    return typeof B == "function" && (M = B, B = null), X(w, q, B, M);
    function X(I, O, D, C, $) {
      return o(I, O, D, function(P) {
        P && (P.code === "EMFILE" || P.code === "ENFILE") ? Wt([X, [I, O, D, C], P, $ || Date.now(), Date.now()]) : typeof C == "function" && C.apply(this, arguments);
      });
    }
  }
  var s = e.copyFile;
  s && (e.copyFile = l);
  function l(w, q, B, M) {
    return typeof B == "function" && (M = B, B = 0), X(w, q, B, M);
    function X(I, O, D, C, $) {
      return s(I, O, D, function(P) {
        P && (P.code === "EMFILE" || P.code === "ENFILE") ? Wt([X, [I, O, D, C], P, $ || Date.now(), Date.now()]) : typeof C == "function" && C.apply(this, arguments);
      });
    }
  }
  var p = e.readdir;
  e.readdir = f;
  var c = /^v[0-5]\./;
  function f(w, q, B) {
    typeof q == "function" && (B = q, q = null);
    var M = c.test(process.version) ? function(O, D, C, $) {
      return p(O, X(
        O,
        D,
        C,
        $
      ));
    } : function(O, D, C, $) {
      return p(O, D, X(
        O,
        D,
        C,
        $
      ));
    };
    return M(w, q, B);
    function X(I, O, D, C) {
      return function($, P) {
        $ && ($.code === "EMFILE" || $.code === "ENFILE") ? Wt([
          M,
          [I, O, D],
          $,
          C || Date.now(),
          Date.now()
        ]) : (P && P.sort && P.sort(), typeof D == "function" && D.call(this, $, P));
      };
    }
  }
  if (process.version.substr(0, 4) === "v0.8") {
    var d = Pd(e);
    T = d.ReadStream, N = d.WriteStream;
  }
  var h = e.ReadStream;
  h && (T.prototype = Object.create(h.prototype), T.prototype.open = A);
  var y = e.WriteStream;
  y && (N.prototype = Object.create(y.prototype), N.prototype.open = x), Object.defineProperty(e, "ReadStream", {
    get: function() {
      return T;
    },
    set: function(w) {
      T = w;
    },
    enumerable: !0,
    configurable: !0
  }), Object.defineProperty(e, "WriteStream", {
    get: function() {
      return N;
    },
    set: function(w) {
      N = w;
    },
    enumerable: !0,
    configurable: !0
  });
  var E = T;
  Object.defineProperty(e, "FileReadStream", {
    get: function() {
      return E;
    },
    set: function(w) {
      E = w;
    },
    enumerable: !0,
    configurable: !0
  });
  var _ = N;
  Object.defineProperty(e, "FileWriteStream", {
    get: function() {
      return _;
    },
    set: function(w) {
      _ = w;
    },
    enumerable: !0,
    configurable: !0
  });
  function T(w, q) {
    return this instanceof T ? (h.apply(this, arguments), this) : T.apply(Object.create(T.prototype), arguments);
  }
  function A() {
    var w = this;
    $e(w.path, w.flags, w.mode, function(q, B) {
      q ? (w.autoClose && w.destroy(), w.emit("error", q)) : (w.fd = B, w.emit("open", B), w.read());
    });
  }
  function N(w, q) {
    return this instanceof N ? (y.apply(this, arguments), this) : N.apply(Object.create(N.prototype), arguments);
  }
  function x() {
    var w = this;
    $e(w.path, w.flags, w.mode, function(q, B) {
      q ? (w.destroy(), w.emit("error", q)) : (w.fd = B, w.emit("open", B));
    });
  }
  function G(w, q) {
    return new e.ReadStream(w, q);
  }
  function te(w, q) {
    return new e.WriteStream(w, q);
  }
  var Y = e.open;
  e.open = $e;
  function $e(w, q, B, M) {
    return typeof B == "function" && (M = B, B = null), X(w, q, B, M);
    function X(I, O, D, C, $) {
      return Y(I, O, D, function(P, k) {
        P && (P.code === "EMFILE" || P.code === "ENFILE") ? Wt([X, [I, O, D, C], P, $ || Date.now(), Date.now()]) : typeof C == "function" && C.apply(this, arguments);
      });
    }
  }
  return e;
}
function Wt(e) {
  xt("ENQUEUE", e[0].name, e[1]), ne[me].push(e), ko();
}
var mn;
function Ua() {
  for (var e = Date.now(), t = 0; t < ne[me].length; ++t)
    ne[me][t].length > 2 && (ne[me][t][3] = e, ne[me][t][4] = e);
  ko();
}
function ko() {
  if (clearTimeout(mn), mn = void 0, ne[me].length !== 0) {
    var e = ne[me].shift(), t = e[0], r = e[1], n = e[2], i = e[3], o = e[4];
    if (i === void 0)
      xt("RETRY", t.name, r), t.apply(null, r);
    else if (Date.now() - i >= 6e4) {
      xt("TIMEOUT", t.name, r);
      var a = r.pop();
      typeof a == "function" && a.call(null, n);
    } else {
      var s = Date.now() - o, l = Math.max(o - i, 1), p = Math.min(l * 1.2, 100);
      s >= p ? (xt("RETRY", t.name, r), t.apply(null, r.concat([i]))) : ne[me].push(e);
    }
    mn === void 0 && (mn = setTimeout(ko, 0));
  }
}
(function(e) {
  const t = Oe.fromCallback, r = Re, n = [
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
  }), e.exists = function(i, o) {
    return typeof o == "function" ? r.exists(i, o) : new Promise((a) => r.exists(i, a));
  }, e.read = function(i, o, a, s, l, p) {
    return typeof p == "function" ? r.read(i, o, a, s, l, p) : new Promise((c, f) => {
      r.read(i, o, a, s, l, (d, h, y) => {
        if (d) return f(d);
        c({ bytesRead: h, buffer: y });
      });
    });
  }, e.write = function(i, o, ...a) {
    return typeof a[a.length - 1] == "function" ? r.write(i, o, ...a) : new Promise((s, l) => {
      r.write(i, o, ...a, (p, c, f) => {
        if (p) return l(p);
        s({ bytesWritten: c, buffer: f });
      });
    });
  }, typeof r.writev == "function" && (e.writev = function(i, o, ...a) {
    return typeof a[a.length - 1] == "function" ? r.writev(i, o, ...a) : new Promise((s, l) => {
      r.writev(i, o, ...a, (p, c, f) => {
        if (p) return l(p);
        s({ bytesWritten: c, buffers: f });
      });
    });
  }), typeof r.realpath.native == "function" ? e.realpath.native = t(r.realpath.native) : process.emitWarning(
    "fs.realpath.native is not a function. Is fs being monkey-patched?",
    "Warning",
    "fs-extra-WARN0003"
  );
})(Bt);
var Mo = {}, Ql = {};
const Fd = Q;
Ql.checkPath = function(t) {
  if (process.platform === "win32" && /[<>:"|?*]/.test(t.replace(Fd.parse(t).root, ""))) {
    const n = new Error(`Path contains invalid characters: ${t}`);
    throw n.code = "EINVAL", n;
  }
};
const Zl = Bt, { checkPath: ec } = Ql, tc = (e) => {
  const t = { mode: 511 };
  return typeof e == "number" ? e : { ...t, ...e }.mode;
};
Mo.makeDir = async (e, t) => (ec(e), Zl.mkdir(e, {
  mode: tc(t),
  recursive: !0
}));
Mo.makeDirSync = (e, t) => (ec(e), Zl.mkdirSync(e, {
  mode: tc(t),
  recursive: !0
}));
const xd = Oe.fromPromise, { makeDir: Ld, makeDirSync: Ii } = Mo, Pi = xd(Ld);
var Qe = {
  mkdirs: Pi,
  mkdirsSync: Ii,
  // alias
  mkdirp: Pi,
  mkdirpSync: Ii,
  ensureDir: Pi,
  ensureDirSync: Ii
};
const Ud = Oe.fromPromise, rc = Bt;
function kd(e) {
  return rc.access(e).then(() => !0).catch(() => !1);
}
var jt = {
  pathExists: Ud(kd),
  pathExistsSync: rc.existsSync
};
const nr = Re;
function Md(e, t, r, n) {
  nr.open(e, "r+", (i, o) => {
    if (i) return n(i);
    nr.futimes(o, t, r, (a) => {
      nr.close(o, (s) => {
        n && n(a || s);
      });
    });
  });
}
function Bd(e, t, r) {
  const n = nr.openSync(e, "r+");
  return nr.futimesSync(n, t, r), nr.closeSync(n);
}
var nc = {
  utimesMillis: Md,
  utimesMillisSync: Bd
};
const or = Bt, de = Q, jd = Kn;
function Hd(e, t, r) {
  const n = r.dereference ? (i) => or.stat(i, { bigint: !0 }) : (i) => or.lstat(i, { bigint: !0 });
  return Promise.all([
    n(e),
    n(t).catch((i) => {
      if (i.code === "ENOENT") return null;
      throw i;
    })
  ]).then(([i, o]) => ({ srcStat: i, destStat: o }));
}
function qd(e, t, r) {
  let n;
  const i = r.dereference ? (a) => or.statSync(a, { bigint: !0 }) : (a) => or.lstatSync(a, { bigint: !0 }), o = i(e);
  try {
    n = i(t);
  } catch (a) {
    if (a.code === "ENOENT") return { srcStat: o, destStat: null };
    throw a;
  }
  return { srcStat: o, destStat: n };
}
function Gd(e, t, r, n, i) {
  jd.callbackify(Hd)(e, t, n, (o, a) => {
    if (o) return i(o);
    const { srcStat: s, destStat: l } = a;
    if (l) {
      if (Wr(s, l)) {
        const p = de.basename(e), c = de.basename(t);
        return r === "move" && p !== c && p.toLowerCase() === c.toLowerCase() ? i(null, { srcStat: s, destStat: l, isChangingCase: !0 }) : i(new Error("Source and destination must not be the same."));
      }
      if (s.isDirectory() && !l.isDirectory())
        return i(new Error(`Cannot overwrite non-directory '${t}' with directory '${e}'.`));
      if (!s.isDirectory() && l.isDirectory())
        return i(new Error(`Cannot overwrite directory '${t}' with non-directory '${e}'.`));
    }
    return s.isDirectory() && Bo(e, t) ? i(new Error(Zn(e, t, r))) : i(null, { srcStat: s, destStat: l });
  });
}
function Vd(e, t, r, n) {
  const { srcStat: i, destStat: o } = qd(e, t, n);
  if (o) {
    if (Wr(i, o)) {
      const a = de.basename(e), s = de.basename(t);
      if (r === "move" && a !== s && a.toLowerCase() === s.toLowerCase())
        return { srcStat: i, destStat: o, isChangingCase: !0 };
      throw new Error("Source and destination must not be the same.");
    }
    if (i.isDirectory() && !o.isDirectory())
      throw new Error(`Cannot overwrite non-directory '${t}' with directory '${e}'.`);
    if (!i.isDirectory() && o.isDirectory())
      throw new Error(`Cannot overwrite directory '${t}' with non-directory '${e}'.`);
  }
  if (i.isDirectory() && Bo(e, t))
    throw new Error(Zn(e, t, r));
  return { srcStat: i, destStat: o };
}
function ic(e, t, r, n, i) {
  const o = de.resolve(de.dirname(e)), a = de.resolve(de.dirname(r));
  if (a === o || a === de.parse(a).root) return i();
  or.stat(a, { bigint: !0 }, (s, l) => s ? s.code === "ENOENT" ? i() : i(s) : Wr(t, l) ? i(new Error(Zn(e, r, n))) : ic(e, t, a, n, i));
}
function oc(e, t, r, n) {
  const i = de.resolve(de.dirname(e)), o = de.resolve(de.dirname(r));
  if (o === i || o === de.parse(o).root) return;
  let a;
  try {
    a = or.statSync(o, { bigint: !0 });
  } catch (s) {
    if (s.code === "ENOENT") return;
    throw s;
  }
  if (Wr(t, a))
    throw new Error(Zn(e, r, n));
  return oc(e, t, o, n);
}
function Wr(e, t) {
  return t.ino && t.dev && t.ino === e.ino && t.dev === e.dev;
}
function Bo(e, t) {
  const r = de.resolve(e).split(de.sep).filter((i) => i), n = de.resolve(t).split(de.sep).filter((i) => i);
  return r.reduce((i, o, a) => i && n[a] === o, !0);
}
function Zn(e, t, r) {
  return `Cannot ${r} '${e}' to a subdirectory of itself, '${t}'.`;
}
var cr = {
  checkPaths: Gd,
  checkPathsSync: Vd,
  checkParentPaths: ic,
  checkParentPathsSync: oc,
  isSrcSubdir: Bo,
  areIdentical: Wr
};
const Ne = Re, Ir = Q, Wd = Qe.mkdirs, Yd = jt.pathExists, zd = nc.utimesMillis, Pr = cr;
function Xd(e, t, r, n) {
  typeof r == "function" && !n ? (n = r, r = {}) : typeof r == "function" && (r = { filter: r }), n = n || function() {
  }, r = r || {}, r.clobber = "clobber" in r ? !!r.clobber : !0, r.overwrite = "overwrite" in r ? !!r.overwrite : r.clobber, r.preserveTimestamps && process.arch === "ia32" && process.emitWarning(
    `Using the preserveTimestamps option in 32-bit node is not recommended;

	see https://github.com/jprichardson/node-fs-extra/issues/269`,
    "Warning",
    "fs-extra-WARN0001"
  ), Pr.checkPaths(e, t, "copy", r, (i, o) => {
    if (i) return n(i);
    const { srcStat: a, destStat: s } = o;
    Pr.checkParentPaths(e, a, t, "copy", (l) => l ? n(l) : r.filter ? ac(ka, s, e, t, r, n) : ka(s, e, t, r, n));
  });
}
function ka(e, t, r, n, i) {
  const o = Ir.dirname(r);
  Yd(o, (a, s) => {
    if (a) return i(a);
    if (s) return Mn(e, t, r, n, i);
    Wd(o, (l) => l ? i(l) : Mn(e, t, r, n, i));
  });
}
function ac(e, t, r, n, i, o) {
  Promise.resolve(i.filter(r, n)).then((a) => a ? e(t, r, n, i, o) : o(), (a) => o(a));
}
function Kd(e, t, r, n, i) {
  return n.filter ? ac(Mn, e, t, r, n, i) : Mn(e, t, r, n, i);
}
function Mn(e, t, r, n, i) {
  (n.dereference ? Ne.stat : Ne.lstat)(t, (a, s) => a ? i(a) : s.isDirectory() ? nh(s, e, t, r, n, i) : s.isFile() || s.isCharacterDevice() || s.isBlockDevice() ? Jd(s, e, t, r, n, i) : s.isSymbolicLink() ? ah(e, t, r, n, i) : s.isSocket() ? i(new Error(`Cannot copy a socket file: ${t}`)) : s.isFIFO() ? i(new Error(`Cannot copy a FIFO pipe: ${t}`)) : i(new Error(`Unknown file: ${t}`)));
}
function Jd(e, t, r, n, i, o) {
  return t ? Qd(e, r, n, i, o) : sc(e, r, n, i, o);
}
function Qd(e, t, r, n, i) {
  if (n.overwrite)
    Ne.unlink(r, (o) => o ? i(o) : sc(e, t, r, n, i));
  else return n.errorOnExist ? i(new Error(`'${r}' already exists`)) : i();
}
function sc(e, t, r, n, i) {
  Ne.copyFile(t, r, (o) => o ? i(o) : n.preserveTimestamps ? Zd(e.mode, t, r, i) : ei(r, e.mode, i));
}
function Zd(e, t, r, n) {
  return eh(e) ? th(r, e, (i) => i ? n(i) : Ma(e, t, r, n)) : Ma(e, t, r, n);
}
function eh(e) {
  return (e & 128) === 0;
}
function th(e, t, r) {
  return ei(e, t | 128, r);
}
function Ma(e, t, r, n) {
  rh(t, r, (i) => i ? n(i) : ei(r, e, n));
}
function ei(e, t, r) {
  return Ne.chmod(e, t, r);
}
function rh(e, t, r) {
  Ne.stat(e, (n, i) => n ? r(n) : zd(t, i.atime, i.mtime, r));
}
function nh(e, t, r, n, i, o) {
  return t ? lc(r, n, i, o) : ih(e.mode, r, n, i, o);
}
function ih(e, t, r, n, i) {
  Ne.mkdir(r, (o) => {
    if (o) return i(o);
    lc(t, r, n, (a) => a ? i(a) : ei(r, e, i));
  });
}
function lc(e, t, r, n) {
  Ne.readdir(e, (i, o) => i ? n(i) : cc(o, e, t, r, n));
}
function cc(e, t, r, n, i) {
  const o = e.pop();
  return o ? oh(e, o, t, r, n, i) : i();
}
function oh(e, t, r, n, i, o) {
  const a = Ir.join(r, t), s = Ir.join(n, t);
  Pr.checkPaths(a, s, "copy", i, (l, p) => {
    if (l) return o(l);
    const { destStat: c } = p;
    Kd(c, a, s, i, (f) => f ? o(f) : cc(e, r, n, i, o));
  });
}
function ah(e, t, r, n, i) {
  Ne.readlink(t, (o, a) => {
    if (o) return i(o);
    if (n.dereference && (a = Ir.resolve(process.cwd(), a)), e)
      Ne.readlink(r, (s, l) => s ? s.code === "EINVAL" || s.code === "UNKNOWN" ? Ne.symlink(a, r, i) : i(s) : (n.dereference && (l = Ir.resolve(process.cwd(), l)), Pr.isSrcSubdir(a, l) ? i(new Error(`Cannot copy '${a}' to a subdirectory of itself, '${l}'.`)) : e.isDirectory() && Pr.isSrcSubdir(l, a) ? i(new Error(`Cannot overwrite '${l}' with '${a}'.`)) : sh(a, r, i)));
    else
      return Ne.symlink(a, r, i);
  });
}
function sh(e, t, r) {
  Ne.unlink(t, (n) => n ? r(n) : Ne.symlink(e, t, r));
}
var lh = Xd;
const we = Re, Nr = Q, ch = Qe.mkdirsSync, uh = nc.utimesMillisSync, Dr = cr;
function fh(e, t, r) {
  typeof r == "function" && (r = { filter: r }), r = r || {}, r.clobber = "clobber" in r ? !!r.clobber : !0, r.overwrite = "overwrite" in r ? !!r.overwrite : r.clobber, r.preserveTimestamps && process.arch === "ia32" && process.emitWarning(
    `Using the preserveTimestamps option in 32-bit node is not recommended;

	see https://github.com/jprichardson/node-fs-extra/issues/269`,
    "Warning",
    "fs-extra-WARN0002"
  );
  const { srcStat: n, destStat: i } = Dr.checkPathsSync(e, t, "copy", r);
  return Dr.checkParentPathsSync(e, n, t, "copy"), dh(i, e, t, r);
}
function dh(e, t, r, n) {
  if (n.filter && !n.filter(t, r)) return;
  const i = Nr.dirname(r);
  return we.existsSync(i) || ch(i), uc(e, t, r, n);
}
function hh(e, t, r, n) {
  if (!(n.filter && !n.filter(t, r)))
    return uc(e, t, r, n);
}
function uc(e, t, r, n) {
  const o = (n.dereference ? we.statSync : we.lstatSync)(t);
  if (o.isDirectory()) return vh(o, e, t, r, n);
  if (o.isFile() || o.isCharacterDevice() || o.isBlockDevice()) return ph(o, e, t, r, n);
  if (o.isSymbolicLink()) return Th(e, t, r, n);
  throw o.isSocket() ? new Error(`Cannot copy a socket file: ${t}`) : o.isFIFO() ? new Error(`Cannot copy a FIFO pipe: ${t}`) : new Error(`Unknown file: ${t}`);
}
function ph(e, t, r, n, i) {
  return t ? mh(e, r, n, i) : fc(e, r, n, i);
}
function mh(e, t, r, n) {
  if (n.overwrite)
    return we.unlinkSync(r), fc(e, t, r, n);
  if (n.errorOnExist)
    throw new Error(`'${r}' already exists`);
}
function fc(e, t, r, n) {
  return we.copyFileSync(t, r), n.preserveTimestamps && gh(e.mode, t, r), jo(r, e.mode);
}
function gh(e, t, r) {
  return Eh(e) && yh(r, e), wh(t, r);
}
function Eh(e) {
  return (e & 128) === 0;
}
function yh(e, t) {
  return jo(e, t | 128);
}
function jo(e, t) {
  return we.chmodSync(e, t);
}
function wh(e, t) {
  const r = we.statSync(e);
  return uh(t, r.atime, r.mtime);
}
function vh(e, t, r, n, i) {
  return t ? dc(r, n, i) : _h(e.mode, r, n, i);
}
function _h(e, t, r, n) {
  return we.mkdirSync(r), dc(t, r, n), jo(r, e);
}
function dc(e, t, r) {
  we.readdirSync(e).forEach((n) => bh(n, e, t, r));
}
function bh(e, t, r, n) {
  const i = Nr.join(t, e), o = Nr.join(r, e), { destStat: a } = Dr.checkPathsSync(i, o, "copy", n);
  return hh(a, i, o, n);
}
function Th(e, t, r, n) {
  let i = we.readlinkSync(t);
  if (n.dereference && (i = Nr.resolve(process.cwd(), i)), e) {
    let o;
    try {
      o = we.readlinkSync(r);
    } catch (a) {
      if (a.code === "EINVAL" || a.code === "UNKNOWN") return we.symlinkSync(i, r);
      throw a;
    }
    if (n.dereference && (o = Nr.resolve(process.cwd(), o)), Dr.isSrcSubdir(i, o))
      throw new Error(`Cannot copy '${i}' to a subdirectory of itself, '${o}'.`);
    if (we.statSync(r).isDirectory() && Dr.isSrcSubdir(o, i))
      throw new Error(`Cannot overwrite '${o}' with '${i}'.`);
    return Ah(i, r);
  } else
    return we.symlinkSync(i, r);
}
function Ah(e, t) {
  return we.unlinkSync(t), we.symlinkSync(e, t);
}
var Sh = fh;
const Ch = Oe.fromCallback;
var Ho = {
  copy: Ch(lh),
  copySync: Sh
};
const Ba = Re, hc = Q, J = Wl, $r = process.platform === "win32";
function pc(e) {
  [
    "unlink",
    "chmod",
    "stat",
    "lstat",
    "rmdir",
    "readdir"
  ].forEach((r) => {
    e[r] = e[r] || Ba[r], r = r + "Sync", e[r] = e[r] || Ba[r];
  }), e.maxBusyTries = e.maxBusyTries || 3;
}
function qo(e, t, r) {
  let n = 0;
  typeof t == "function" && (r = t, t = {}), J(e, "rimraf: missing path"), J.strictEqual(typeof e, "string", "rimraf: path should be a string"), J.strictEqual(typeof r, "function", "rimraf: callback function required"), J(t, "rimraf: invalid options argument provided"), J.strictEqual(typeof t, "object", "rimraf: options should be object"), pc(t), ja(e, t, function i(o) {
    if (o) {
      if ((o.code === "EBUSY" || o.code === "ENOTEMPTY" || o.code === "EPERM") && n < t.maxBusyTries) {
        n++;
        const a = n * 100;
        return setTimeout(() => ja(e, t, i), a);
      }
      o.code === "ENOENT" && (o = null);
    }
    r(o);
  });
}
function ja(e, t, r) {
  J(e), J(t), J(typeof r == "function"), t.lstat(e, (n, i) => {
    if (n && n.code === "ENOENT")
      return r(null);
    if (n && n.code === "EPERM" && $r)
      return Ha(e, t, n, r);
    if (i && i.isDirectory())
      return $n(e, t, n, r);
    t.unlink(e, (o) => {
      if (o) {
        if (o.code === "ENOENT")
          return r(null);
        if (o.code === "EPERM")
          return $r ? Ha(e, t, o, r) : $n(e, t, o, r);
        if (o.code === "EISDIR")
          return $n(e, t, o, r);
      }
      return r(o);
    });
  });
}
function Ha(e, t, r, n) {
  J(e), J(t), J(typeof n == "function"), t.chmod(e, 438, (i) => {
    i ? n(i.code === "ENOENT" ? null : r) : t.stat(e, (o, a) => {
      o ? n(o.code === "ENOENT" ? null : r) : a.isDirectory() ? $n(e, t, r, n) : t.unlink(e, n);
    });
  });
}
function qa(e, t, r) {
  let n;
  J(e), J(t);
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
  n.isDirectory() ? Fn(e, t, r) : t.unlinkSync(e);
}
function $n(e, t, r, n) {
  J(e), J(t), J(typeof n == "function"), t.rmdir(e, (i) => {
    i && (i.code === "ENOTEMPTY" || i.code === "EEXIST" || i.code === "EPERM") ? Oh(e, t, n) : i && i.code === "ENOTDIR" ? n(r) : n(i);
  });
}
function Oh(e, t, r) {
  J(e), J(t), J(typeof r == "function"), t.readdir(e, (n, i) => {
    if (n) return r(n);
    let o = i.length, a;
    if (o === 0) return t.rmdir(e, r);
    i.forEach((s) => {
      qo(hc.join(e, s), t, (l) => {
        if (!a) {
          if (l) return r(a = l);
          --o === 0 && t.rmdir(e, r);
        }
      });
    });
  });
}
function mc(e, t) {
  let r;
  t = t || {}, pc(t), J(e, "rimraf: missing path"), J.strictEqual(typeof e, "string", "rimraf: path should be a string"), J(t, "rimraf: missing options"), J.strictEqual(typeof t, "object", "rimraf: options should be object");
  try {
    r = t.lstatSync(e);
  } catch (n) {
    if (n.code === "ENOENT")
      return;
    n.code === "EPERM" && $r && qa(e, t, n);
  }
  try {
    r && r.isDirectory() ? Fn(e, t, null) : t.unlinkSync(e);
  } catch (n) {
    if (n.code === "ENOENT")
      return;
    if (n.code === "EPERM")
      return $r ? qa(e, t, n) : Fn(e, t, n);
    if (n.code !== "EISDIR")
      throw n;
    Fn(e, t, n);
  }
}
function Fn(e, t, r) {
  J(e), J(t);
  try {
    t.rmdirSync(e);
  } catch (n) {
    if (n.code === "ENOTDIR")
      throw r;
    if (n.code === "ENOTEMPTY" || n.code === "EEXIST" || n.code === "EPERM")
      Rh(e, t);
    else if (n.code !== "ENOENT")
      throw n;
  }
}
function Rh(e, t) {
  if (J(e), J(t), t.readdirSync(e).forEach((r) => mc(hc.join(e, r), t)), $r) {
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
var Ih = qo;
qo.sync = mc;
const Bn = Re, Ph = Oe.fromCallback, gc = Ih;
function Nh(e, t) {
  if (Bn.rm) return Bn.rm(e, { recursive: !0, force: !0 }, t);
  gc(e, t);
}
function Dh(e) {
  if (Bn.rmSync) return Bn.rmSync(e, { recursive: !0, force: !0 });
  gc.sync(e);
}
var ti = {
  remove: Ph(Nh),
  removeSync: Dh
};
const $h = Oe.fromPromise, Ec = Bt, yc = Q, wc = Qe, vc = ti, Ga = $h(async function(t) {
  let r;
  try {
    r = await Ec.readdir(t);
  } catch {
    return wc.mkdirs(t);
  }
  return Promise.all(r.map((n) => vc.remove(yc.join(t, n))));
});
function Va(e) {
  let t;
  try {
    t = Ec.readdirSync(e);
  } catch {
    return wc.mkdirsSync(e);
  }
  t.forEach((r) => {
    r = yc.join(e, r), vc.removeSync(r);
  });
}
var Fh = {
  emptyDirSync: Va,
  emptydirSync: Va,
  emptyDir: Ga,
  emptydir: Ga
};
const xh = Oe.fromCallback, _c = Q, dt = Re, bc = Qe;
function Lh(e, t) {
  function r() {
    dt.writeFile(e, "", (n) => {
      if (n) return t(n);
      t();
    });
  }
  dt.stat(e, (n, i) => {
    if (!n && i.isFile()) return t();
    const o = _c.dirname(e);
    dt.stat(o, (a, s) => {
      if (a)
        return a.code === "ENOENT" ? bc.mkdirs(o, (l) => {
          if (l) return t(l);
          r();
        }) : t(a);
      s.isDirectory() ? r() : dt.readdir(o, (l) => {
        if (l) return t(l);
      });
    });
  });
}
function Uh(e) {
  let t;
  try {
    t = dt.statSync(e);
  } catch {
  }
  if (t && t.isFile()) return;
  const r = _c.dirname(e);
  try {
    dt.statSync(r).isDirectory() || dt.readdirSync(r);
  } catch (n) {
    if (n && n.code === "ENOENT") bc.mkdirsSync(r);
    else throw n;
  }
  dt.writeFileSync(e, "");
}
var kh = {
  createFile: xh(Lh),
  createFileSync: Uh
};
const Mh = Oe.fromCallback, Tc = Q, ft = Re, Ac = Qe, Bh = jt.pathExists, { areIdentical: Sc } = cr;
function jh(e, t, r) {
  function n(i, o) {
    ft.link(i, o, (a) => {
      if (a) return r(a);
      r(null);
    });
  }
  ft.lstat(t, (i, o) => {
    ft.lstat(e, (a, s) => {
      if (a)
        return a.message = a.message.replace("lstat", "ensureLink"), r(a);
      if (o && Sc(s, o)) return r(null);
      const l = Tc.dirname(t);
      Bh(l, (p, c) => {
        if (p) return r(p);
        if (c) return n(e, t);
        Ac.mkdirs(l, (f) => {
          if (f) return r(f);
          n(e, t);
        });
      });
    });
  });
}
function Hh(e, t) {
  let r;
  try {
    r = ft.lstatSync(t);
  } catch {
  }
  try {
    const o = ft.lstatSync(e);
    if (r && Sc(o, r)) return;
  } catch (o) {
    throw o.message = o.message.replace("lstat", "ensureLink"), o;
  }
  const n = Tc.dirname(t);
  return ft.existsSync(n) || Ac.mkdirsSync(n), ft.linkSync(e, t);
}
var qh = {
  createLink: Mh(jh),
  createLinkSync: Hh
};
const ht = Q, Sr = Re, Gh = jt.pathExists;
function Vh(e, t, r) {
  if (ht.isAbsolute(e))
    return Sr.lstat(e, (n) => n ? (n.message = n.message.replace("lstat", "ensureSymlink"), r(n)) : r(null, {
      toCwd: e,
      toDst: e
    }));
  {
    const n = ht.dirname(t), i = ht.join(n, e);
    return Gh(i, (o, a) => o ? r(o) : a ? r(null, {
      toCwd: i,
      toDst: e
    }) : Sr.lstat(e, (s) => s ? (s.message = s.message.replace("lstat", "ensureSymlink"), r(s)) : r(null, {
      toCwd: e,
      toDst: ht.relative(n, e)
    })));
  }
}
function Wh(e, t) {
  let r;
  if (ht.isAbsolute(e)) {
    if (r = Sr.existsSync(e), !r) throw new Error("absolute srcpath does not exist");
    return {
      toCwd: e,
      toDst: e
    };
  } else {
    const n = ht.dirname(t), i = ht.join(n, e);
    if (r = Sr.existsSync(i), r)
      return {
        toCwd: i,
        toDst: e
      };
    if (r = Sr.existsSync(e), !r) throw new Error("relative srcpath does not exist");
    return {
      toCwd: e,
      toDst: ht.relative(n, e)
    };
  }
}
var Yh = {
  symlinkPaths: Vh,
  symlinkPathsSync: Wh
};
const Cc = Re;
function zh(e, t, r) {
  if (r = typeof t == "function" ? t : r, t = typeof t == "function" ? !1 : t, t) return r(null, t);
  Cc.lstat(e, (n, i) => {
    if (n) return r(null, "file");
    t = i && i.isDirectory() ? "dir" : "file", r(null, t);
  });
}
function Xh(e, t) {
  let r;
  if (t) return t;
  try {
    r = Cc.lstatSync(e);
  } catch {
    return "file";
  }
  return r && r.isDirectory() ? "dir" : "file";
}
var Kh = {
  symlinkType: zh,
  symlinkTypeSync: Xh
};
const Jh = Oe.fromCallback, Oc = Q, He = Bt, Rc = Qe, Qh = Rc.mkdirs, Zh = Rc.mkdirsSync, Ic = Yh, ep = Ic.symlinkPaths, tp = Ic.symlinkPathsSync, Pc = Kh, rp = Pc.symlinkType, np = Pc.symlinkTypeSync, ip = jt.pathExists, { areIdentical: Nc } = cr;
function op(e, t, r, n) {
  n = typeof r == "function" ? r : n, r = typeof r == "function" ? !1 : r, He.lstat(t, (i, o) => {
    !i && o.isSymbolicLink() ? Promise.all([
      He.stat(e),
      He.stat(t)
    ]).then(([a, s]) => {
      if (Nc(a, s)) return n(null);
      Wa(e, t, r, n);
    }) : Wa(e, t, r, n);
  });
}
function Wa(e, t, r, n) {
  ep(e, t, (i, o) => {
    if (i) return n(i);
    e = o.toDst, rp(o.toCwd, r, (a, s) => {
      if (a) return n(a);
      const l = Oc.dirname(t);
      ip(l, (p, c) => {
        if (p) return n(p);
        if (c) return He.symlink(e, t, s, n);
        Qh(l, (f) => {
          if (f) return n(f);
          He.symlink(e, t, s, n);
        });
      });
    });
  });
}
function ap(e, t, r) {
  let n;
  try {
    n = He.lstatSync(t);
  } catch {
  }
  if (n && n.isSymbolicLink()) {
    const s = He.statSync(e), l = He.statSync(t);
    if (Nc(s, l)) return;
  }
  const i = tp(e, t);
  e = i.toDst, r = np(i.toCwd, r);
  const o = Oc.dirname(t);
  return He.existsSync(o) || Zh(o), He.symlinkSync(e, t, r);
}
var sp = {
  createSymlink: Jh(op),
  createSymlinkSync: ap
};
const { createFile: Ya, createFileSync: za } = kh, { createLink: Xa, createLinkSync: Ka } = qh, { createSymlink: Ja, createSymlinkSync: Qa } = sp;
var lp = {
  // file
  createFile: Ya,
  createFileSync: za,
  ensureFile: Ya,
  ensureFileSync: za,
  // link
  createLink: Xa,
  createLinkSync: Ka,
  ensureLink: Xa,
  ensureLinkSync: Ka,
  // symlink
  createSymlink: Ja,
  createSymlinkSync: Qa,
  ensureSymlink: Ja,
  ensureSymlinkSync: Qa
};
function cp(e, { EOL: t = `
`, finalEOL: r = !0, replacer: n = null, spaces: i } = {}) {
  const o = r ? t : "";
  return JSON.stringify(e, n, i).replace(/\n/g, t) + o;
}
function up(e) {
  return Buffer.isBuffer(e) && (e = e.toString("utf8")), e.replace(/^\uFEFF/, "");
}
var Go = { stringify: cp, stripBom: up };
let ar;
try {
  ar = Re;
} catch {
  ar = qe;
}
const ri = Oe, { stringify: Dc, stripBom: $c } = Go;
async function fp(e, t = {}) {
  typeof t == "string" && (t = { encoding: t });
  const r = t.fs || ar, n = "throws" in t ? t.throws : !0;
  let i = await ri.fromCallback(r.readFile)(e, t);
  i = $c(i);
  let o;
  try {
    o = JSON.parse(i, t ? t.reviver : null);
  } catch (a) {
    if (n)
      throw a.message = `${e}: ${a.message}`, a;
    return null;
  }
  return o;
}
const dp = ri.fromPromise(fp);
function hp(e, t = {}) {
  typeof t == "string" && (t = { encoding: t });
  const r = t.fs || ar, n = "throws" in t ? t.throws : !0;
  try {
    let i = r.readFileSync(e, t);
    return i = $c(i), JSON.parse(i, t.reviver);
  } catch (i) {
    if (n)
      throw i.message = `${e}: ${i.message}`, i;
    return null;
  }
}
async function pp(e, t, r = {}) {
  const n = r.fs || ar, i = Dc(t, r);
  await ri.fromCallback(n.writeFile)(e, i, r);
}
const mp = ri.fromPromise(pp);
function gp(e, t, r = {}) {
  const n = r.fs || ar, i = Dc(t, r);
  return n.writeFileSync(e, i, r);
}
var Ep = {
  readFile: dp,
  readFileSync: hp,
  writeFile: mp,
  writeFileSync: gp
};
const gn = Ep;
var yp = {
  // jsonfile exports
  readJson: gn.readFile,
  readJsonSync: gn.readFileSync,
  writeJson: gn.writeFile,
  writeJsonSync: gn.writeFileSync
};
const wp = Oe.fromCallback, Cr = Re, Fc = Q, xc = Qe, vp = jt.pathExists;
function _p(e, t, r, n) {
  typeof r == "function" && (n = r, r = "utf8");
  const i = Fc.dirname(e);
  vp(i, (o, a) => {
    if (o) return n(o);
    if (a) return Cr.writeFile(e, t, r, n);
    xc.mkdirs(i, (s) => {
      if (s) return n(s);
      Cr.writeFile(e, t, r, n);
    });
  });
}
function bp(e, ...t) {
  const r = Fc.dirname(e);
  if (Cr.existsSync(r))
    return Cr.writeFileSync(e, ...t);
  xc.mkdirsSync(r), Cr.writeFileSync(e, ...t);
}
var Vo = {
  outputFile: wp(_p),
  outputFileSync: bp
};
const { stringify: Tp } = Go, { outputFile: Ap } = Vo;
async function Sp(e, t, r = {}) {
  const n = Tp(t, r);
  await Ap(e, n, r);
}
var Cp = Sp;
const { stringify: Op } = Go, { outputFileSync: Rp } = Vo;
function Ip(e, t, r) {
  const n = Op(t, r);
  Rp(e, n, r);
}
var Pp = Ip;
const Np = Oe.fromPromise, Ce = yp;
Ce.outputJson = Np(Cp);
Ce.outputJsonSync = Pp;
Ce.outputJSON = Ce.outputJson;
Ce.outputJSONSync = Ce.outputJsonSync;
Ce.writeJSON = Ce.writeJson;
Ce.writeJSONSync = Ce.writeJsonSync;
Ce.readJSON = Ce.readJson;
Ce.readJSONSync = Ce.readJsonSync;
var Dp = Ce;
const $p = Re, wo = Q, Fp = Ho.copy, Lc = ti.remove, xp = Qe.mkdirp, Lp = jt.pathExists, Za = cr;
function Up(e, t, r, n) {
  typeof r == "function" && (n = r, r = {}), r = r || {};
  const i = r.overwrite || r.clobber || !1;
  Za.checkPaths(e, t, "move", r, (o, a) => {
    if (o) return n(o);
    const { srcStat: s, isChangingCase: l = !1 } = a;
    Za.checkParentPaths(e, s, t, "move", (p) => {
      if (p) return n(p);
      if (kp(t)) return es(e, t, i, l, n);
      xp(wo.dirname(t), (c) => c ? n(c) : es(e, t, i, l, n));
    });
  });
}
function kp(e) {
  const t = wo.dirname(e);
  return wo.parse(t).root === t;
}
function es(e, t, r, n, i) {
  if (n) return Ni(e, t, r, i);
  if (r)
    return Lc(t, (o) => o ? i(o) : Ni(e, t, r, i));
  Lp(t, (o, a) => o ? i(o) : a ? i(new Error("dest already exists.")) : Ni(e, t, r, i));
}
function Ni(e, t, r, n) {
  $p.rename(e, t, (i) => i ? i.code !== "EXDEV" ? n(i) : Mp(e, t, r, n) : n());
}
function Mp(e, t, r, n) {
  Fp(e, t, {
    overwrite: r,
    errorOnExist: !0
  }, (o) => o ? n(o) : Lc(e, n));
}
var Bp = Up;
const Uc = Re, vo = Q, jp = Ho.copySync, kc = ti.removeSync, Hp = Qe.mkdirpSync, ts = cr;
function qp(e, t, r) {
  r = r || {};
  const n = r.overwrite || r.clobber || !1, { srcStat: i, isChangingCase: o = !1 } = ts.checkPathsSync(e, t, "move", r);
  return ts.checkParentPathsSync(e, i, t, "move"), Gp(t) || Hp(vo.dirname(t)), Vp(e, t, n, o);
}
function Gp(e) {
  const t = vo.dirname(e);
  return vo.parse(t).root === t;
}
function Vp(e, t, r, n) {
  if (n) return Di(e, t, r);
  if (r)
    return kc(t), Di(e, t, r);
  if (Uc.existsSync(t)) throw new Error("dest already exists.");
  return Di(e, t, r);
}
function Di(e, t, r) {
  try {
    Uc.renameSync(e, t);
  } catch (n) {
    if (n.code !== "EXDEV") throw n;
    return Wp(e, t, r);
  }
}
function Wp(e, t, r) {
  return jp(e, t, {
    overwrite: r,
    errorOnExist: !0
  }), kc(e);
}
var Yp = qp;
const zp = Oe.fromCallback;
var Xp = {
  move: zp(Bp),
  moveSync: Yp
}, bt = {
  // Export promiseified graceful-fs:
  ...Bt,
  // Export extra methods:
  ...Ho,
  ...Fh,
  ...lp,
  ...Dp,
  ...Qe,
  ...Xp,
  ...Vo,
  ...jt,
  ...ti
}, Ht = {}, gt = {}, ce = {}, Et = {};
Object.defineProperty(Et, "__esModule", { value: !0 });
Et.CancellationError = Et.CancellationToken = void 0;
const Kp = Yl;
class Jp extends Kp.EventEmitter {
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
      return Promise.reject(new _o());
    const r = () => {
      if (n != null)
        try {
          this.removeListener("cancel", n), n = null;
        } catch {
        }
    };
    let n = null;
    return new Promise((i, o) => {
      let a = null;
      if (n = () => {
        try {
          a != null && (a(), a = null);
        } finally {
          o(new _o());
        }
      }, this.cancelled) {
        n();
        return;
      }
      this.onCancel(n), t(i, o, (s) => {
        a = s;
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
Et.CancellationToken = Jp;
class _o extends Error {
  constructor() {
    super("cancelled");
  }
}
Et.CancellationError = _o;
var ur = {};
Object.defineProperty(ur, "__esModule", { value: !0 });
ur.newError = Qp;
function Qp(e, t) {
  const r = new Error(e);
  return r.code = t, r;
}
var Se = {}, bo = { exports: {} }, En = { exports: {} }, $i, rs;
function Zp() {
  if (rs) return $i;
  rs = 1;
  var e = 1e3, t = e * 60, r = t * 60, n = r * 24, i = n * 7, o = n * 365.25;
  $i = function(c, f) {
    f = f || {};
    var d = typeof c;
    if (d === "string" && c.length > 0)
      return a(c);
    if (d === "number" && isFinite(c))
      return f.long ? l(c) : s(c);
    throw new Error(
      "val is not a non-empty string or a valid number. val=" + JSON.stringify(c)
    );
  };
  function a(c) {
    if (c = String(c), !(c.length > 100)) {
      var f = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        c
      );
      if (f) {
        var d = parseFloat(f[1]), h = (f[2] || "ms").toLowerCase();
        switch (h) {
          case "years":
          case "year":
          case "yrs":
          case "yr":
          case "y":
            return d * o;
          case "weeks":
          case "week":
          case "w":
            return d * i;
          case "days":
          case "day":
          case "d":
            return d * n;
          case "hours":
          case "hour":
          case "hrs":
          case "hr":
          case "h":
            return d * r;
          case "minutes":
          case "minute":
          case "mins":
          case "min":
          case "m":
            return d * t;
          case "seconds":
          case "second":
          case "secs":
          case "sec":
          case "s":
            return d * e;
          case "milliseconds":
          case "millisecond":
          case "msecs":
          case "msec":
          case "ms":
            return d;
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
    return f >= n ? p(c, f, n, "day") : f >= r ? p(c, f, r, "hour") : f >= t ? p(c, f, t, "minute") : f >= e ? p(c, f, e, "second") : c + " ms";
  }
  function p(c, f, d, h) {
    var y = f >= d * 1.5;
    return Math.round(c / d) + " " + h + (y ? "s" : "");
  }
  return $i;
}
var Fi, ns;
function Mc() {
  if (ns) return Fi;
  ns = 1;
  function e(t) {
    n.debug = n, n.default = n, n.coerce = p, n.disable = s, n.enable = o, n.enabled = l, n.humanize = Zp(), n.destroy = c, Object.keys(t).forEach((f) => {
      n[f] = t[f];
    }), n.names = [], n.skips = [], n.formatters = {};
    function r(f) {
      let d = 0;
      for (let h = 0; h < f.length; h++)
        d = (d << 5) - d + f.charCodeAt(h), d |= 0;
      return n.colors[Math.abs(d) % n.colors.length];
    }
    n.selectColor = r;
    function n(f) {
      let d, h = null, y, E;
      function _(...T) {
        if (!_.enabled)
          return;
        const A = _, N = Number(/* @__PURE__ */ new Date()), x = N - (d || N);
        A.diff = x, A.prev = d, A.curr = N, d = N, T[0] = n.coerce(T[0]), typeof T[0] != "string" && T.unshift("%O");
        let G = 0;
        T[0] = T[0].replace(/%([a-zA-Z%])/g, (Y, $e) => {
          if (Y === "%%")
            return "%";
          G++;
          const w = n.formatters[$e];
          if (typeof w == "function") {
            const q = T[G];
            Y = w.call(A, q), T.splice(G, 1), G--;
          }
          return Y;
        }), n.formatArgs.call(A, T), (A.log || n.log).apply(A, T);
      }
      return _.namespace = f, _.useColors = n.useColors(), _.color = n.selectColor(f), _.extend = i, _.destroy = n.destroy, Object.defineProperty(_, "enabled", {
        enumerable: !0,
        configurable: !1,
        get: () => h !== null ? h : (y !== n.namespaces && (y = n.namespaces, E = n.enabled(f)), E),
        set: (T) => {
          h = T;
        }
      }), typeof n.init == "function" && n.init(_), _;
    }
    function i(f, d) {
      const h = n(this.namespace + (typeof d > "u" ? ":" : d) + f);
      return h.log = this.log, h;
    }
    function o(f) {
      n.save(f), n.namespaces = f, n.names = [], n.skips = [];
      const d = (typeof f == "string" ? f : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
      for (const h of d)
        h[0] === "-" ? n.skips.push(h.slice(1)) : n.names.push(h);
    }
    function a(f, d) {
      let h = 0, y = 0, E = -1, _ = 0;
      for (; h < f.length; )
        if (y < d.length && (d[y] === f[h] || d[y] === "*"))
          d[y] === "*" ? (E = y, _ = h, y++) : (h++, y++);
        else if (E !== -1)
          y = E + 1, _++, h = _;
        else
          return !1;
      for (; y < d.length && d[y] === "*"; )
        y++;
      return y === d.length;
    }
    function s() {
      const f = [
        ...n.names,
        ...n.skips.map((d) => "-" + d)
      ].join(",");
      return n.enable(""), f;
    }
    function l(f) {
      for (const d of n.skips)
        if (a(f, d))
          return !1;
      for (const d of n.names)
        if (a(f, d))
          return !0;
      return !1;
    }
    function p(f) {
      return f instanceof Error ? f.stack || f.message : f;
    }
    function c() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    return n.enable(n.load()), n;
  }
  return Fi = e, Fi;
}
var is;
function em() {
  return is || (is = 1, function(e, t) {
    t.formatArgs = n, t.save = i, t.load = o, t.useColors = r, t.storage = a(), t.destroy = /* @__PURE__ */ (() => {
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
      const p = "color: " + this.color;
      l.splice(1, 0, p, "color: inherit");
      let c = 0, f = 0;
      l[0].replace(/%[a-zA-Z%]/g, (d) => {
        d !== "%%" && (c++, d === "%c" && (f = c));
      }), l.splice(f, 0, p);
    }
    t.log = console.debug || console.log || (() => {
    });
    function i(l) {
      try {
        l ? t.storage.setItem("debug", l) : t.storage.removeItem("debug");
      } catch {
      }
    }
    function o() {
      let l;
      try {
        l = t.storage.getItem("debug") || t.storage.getItem("DEBUG");
      } catch {
      }
      return !l && typeof process < "u" && "env" in process && (l = process.env.DEBUG), l;
    }
    function a() {
      try {
        return localStorage;
      } catch {
      }
    }
    e.exports = Mc()(t);
    const { formatters: s } = e.exports;
    s.j = function(l) {
      try {
        return JSON.stringify(l);
      } catch (p) {
        return "[UnexpectedJSONParseError]: " + p.message;
      }
    };
  }(En, En.exports)), En.exports;
}
var yn = { exports: {} }, xi, os;
function tm() {
  return os || (os = 1, xi = (e, t = process.argv) => {
    const r = e.startsWith("-") ? "" : e.length === 1 ? "-" : "--", n = t.indexOf(r + e), i = t.indexOf("--");
    return n !== -1 && (i === -1 || n < i);
  }), xi;
}
var Li, as;
function rm() {
  if (as) return Li;
  as = 1;
  const e = Qn, t = zl, r = tm(), { env: n } = process;
  let i;
  r("no-color") || r("no-colors") || r("color=false") || r("color=never") ? i = 0 : (r("color") || r("colors") || r("color=true") || r("color=always")) && (i = 1), "FORCE_COLOR" in n && (n.FORCE_COLOR === "true" ? i = 1 : n.FORCE_COLOR === "false" ? i = 0 : i = n.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(n.FORCE_COLOR, 10), 3));
  function o(l) {
    return l === 0 ? !1 : {
      level: l,
      hasBasic: !0,
      has256: l >= 2,
      has16m: l >= 3
    };
  }
  function a(l, p) {
    if (i === 0)
      return 0;
    if (r("color=16m") || r("color=full") || r("color=truecolor"))
      return 3;
    if (r("color=256"))
      return 2;
    if (l && !p && i === void 0)
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
    const p = a(l, l && l.isTTY);
    return o(p);
  }
  return Li = {
    supportsColor: s,
    stdout: o(a(!0, t.isatty(1))),
    stderr: o(a(!0, t.isatty(2)))
  }, Li;
}
var ss;
function nm() {
  return ss || (ss = 1, function(e, t) {
    const r = zl, n = Kn;
    t.init = c, t.log = s, t.formatArgs = o, t.save = l, t.load = p, t.useColors = i, t.destroy = n.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    ), t.colors = [6, 2, 3, 4, 5, 1];
    try {
      const d = rm();
      d && (d.stderr || d).level >= 2 && (t.colors = [
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
    t.inspectOpts = Object.keys(process.env).filter((d) => /^debug_/i.test(d)).reduce((d, h) => {
      const y = h.substring(6).toLowerCase().replace(/_([a-z])/g, (_, T) => T.toUpperCase());
      let E = process.env[h];
      return /^(yes|on|true|enabled)$/i.test(E) ? E = !0 : /^(no|off|false|disabled)$/i.test(E) ? E = !1 : E === "null" ? E = null : E = Number(E), d[y] = E, d;
    }, {});
    function i() {
      return "colors" in t.inspectOpts ? !!t.inspectOpts.colors : r.isatty(process.stderr.fd);
    }
    function o(d) {
      const { namespace: h, useColors: y } = this;
      if (y) {
        const E = this.color, _ = "\x1B[3" + (E < 8 ? E : "8;5;" + E), T = `  ${_};1m${h} \x1B[0m`;
        d[0] = T + d[0].split(`
`).join(`
` + T), d.push(_ + "m+" + e.exports.humanize(this.diff) + "\x1B[0m");
      } else
        d[0] = a() + h + " " + d[0];
    }
    function a() {
      return t.inspectOpts.hideDate ? "" : (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function s(...d) {
      return process.stderr.write(n.formatWithOptions(t.inspectOpts, ...d) + `
`);
    }
    function l(d) {
      d ? process.env.DEBUG = d : delete process.env.DEBUG;
    }
    function p() {
      return process.env.DEBUG;
    }
    function c(d) {
      d.inspectOpts = {};
      const h = Object.keys(t.inspectOpts);
      for (let y = 0; y < h.length; y++)
        d.inspectOpts[h[y]] = t.inspectOpts[h[y]];
    }
    e.exports = Mc()(t);
    const { formatters: f } = e.exports;
    f.o = function(d) {
      return this.inspectOpts.colors = this.useColors, n.inspect(d, this.inspectOpts).split(`
`).map((h) => h.trim()).join(" ");
    }, f.O = function(d) {
      return this.inspectOpts.colors = this.useColors, n.inspect(d, this.inspectOpts);
    };
  }(yn, yn.exports)), yn.exports;
}
typeof process > "u" || process.type === "renderer" || process.browser === !0 || process.__nwjs ? bo.exports = em() : bo.exports = nm();
var im = bo.exports, Yr = {};
Object.defineProperty(Yr, "__esModule", { value: !0 });
Yr.ProgressCallbackTransform = void 0;
const om = Gr;
class am extends om.Transform {
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
Yr.ProgressCallbackTransform = am;
Object.defineProperty(Se, "__esModule", { value: !0 });
Se.DigestTransform = Se.HttpExecutor = Se.HttpError = void 0;
Se.createHttpError = Ao;
Se.parseJson = pm;
Se.configureRequestOptionsFromUrl = jc;
Se.configureRequestUrl = Yo;
Se.safeGetHeader = ir;
Se.configureRequestOptions = jn;
Se.safeStringifyJson = Hn;
const sm = Vr, lm = im, cm = qe, um = Gr, To = _t, fm = Et, ls = ur, dm = Yr, It = (0, lm.default)("electron-builder");
function Ao(e, t = null) {
  return new Wo(e.statusCode || -1, `${e.statusCode} ${e.statusMessage}` + (t == null ? "" : `
` + JSON.stringify(t, null, "  ")) + `
Headers: ` + Hn(e.headers), t);
}
const hm = /* @__PURE__ */ new Map([
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
class Wo extends Error {
  constructor(t, r = `HTTP error: ${hm.get(t) || t}`, n = null) {
    super(r), this.statusCode = t, this.description = n, this.name = "HttpError", this.code = `HTTP_ERROR_${t}`;
  }
  isServerError() {
    return this.statusCode >= 500 && this.statusCode <= 599;
  }
}
Se.HttpError = Wo;
function pm(e) {
  return e.then((t) => t == null || t.length === 0 ? null : JSON.parse(t));
}
class Qt {
  constructor() {
    this.maxRedirects = 10;
  }
  request(t, r = new fm.CancellationToken(), n) {
    jn(t);
    const i = n == null ? void 0 : JSON.stringify(n), o = i ? Buffer.from(i) : void 0;
    if (o != null) {
      It(i);
      const { headers: a, ...s } = t;
      t = {
        method: "post",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": o.length,
          ...a
        },
        ...s
      };
    }
    return this.doApiRequest(t, r, (a) => a.end(o));
  }
  doApiRequest(t, r, n, i = 0) {
    return It.enabled && It(`Request: ${Hn(t)}`), r.createPromise((o, a, s) => {
      const l = this.createRequest(t, (p) => {
        try {
          this.handleResponse(p, t, r, o, a, i, n);
        } catch (c) {
          a(c);
        }
      });
      this.addErrorAndTimeoutHandlers(l, a, t.timeout), this.addRedirectHandlers(l, t, a, i, (p) => {
        this.doApiRequest(p, r, n, i).then(o).catch(a);
      }), n(l, a), s(() => l.abort());
    });
  }
  // noinspection JSUnusedLocalSymbols
  // eslint-disable-next-line
  addRedirectHandlers(t, r, n, i, o) {
  }
  addErrorAndTimeoutHandlers(t, r, n = 60 * 1e3) {
    this.addTimeOutHandler(t, r, n), t.on("error", r), t.on("aborted", () => {
      r(new Error("Request has been aborted by the server"));
    });
  }
  handleResponse(t, r, n, i, o, a, s) {
    var l;
    if (It.enabled && It(`Response: ${t.statusCode} ${t.statusMessage}, request options: ${Hn(r)}`), t.statusCode === 404) {
      o(Ao(t, `method: ${r.method || "GET"} url: ${r.protocol || "https:"}//${r.hostname}${r.port ? `:${r.port}` : ""}${r.path}

Please double check that your authentication token is correct. Due to security reasons, actual status maybe not reported, but 404.
`));
      return;
    } else if (t.statusCode === 204) {
      i();
      return;
    }
    const p = (l = t.statusCode) !== null && l !== void 0 ? l : 0, c = p >= 300 && p < 400, f = ir(t, "location");
    if (c && f != null) {
      if (a > this.maxRedirects) {
        o(this.createMaxRedirectError());
        return;
      }
      this.doApiRequest(Qt.prepareRedirectUrlOptions(f, r), n, s, a).then(i).catch(o);
      return;
    }
    t.setEncoding("utf8");
    let d = "";
    t.on("error", o), t.on("data", (h) => d += h), t.on("end", () => {
      try {
        if (t.statusCode != null && t.statusCode >= 400) {
          const h = ir(t, "content-type"), y = h != null && (Array.isArray(h) ? h.find((E) => E.includes("json")) != null : h.includes("json"));
          o(Ao(t, `method: ${r.method || "GET"} url: ${r.protocol || "https:"}//${r.hostname}${r.port ? `:${r.port}` : ""}${r.path}

          Data:
          ${y ? JSON.stringify(JSON.parse(d)) : d}
          `));
        } else
          i(d.length === 0 ? null : d);
      } catch (h) {
        o(h);
      }
    });
  }
  async downloadToBuffer(t, r) {
    return await r.cancellationToken.createPromise((n, i, o) => {
      const a = [], s = {
        headers: r.headers || void 0,
        // because PrivateGitHubProvider requires HttpExecutor.prepareRedirectUrlOptions logic, so, we need to redirect manually
        redirect: "manual"
      };
      Yo(t, s), jn(s), this.doDownload(s, {
        destination: null,
        options: r,
        onCancel: o,
        callback: (l) => {
          l == null ? n(Buffer.concat(a)) : i(l);
        },
        responseHandler: (l, p) => {
          let c = 0;
          l.on("data", (f) => {
            if (c += f.length, c > 524288e3) {
              p(new Error("Maximum allowed size is 500 MB"));
              return;
            }
            a.push(f);
          }), l.on("end", () => {
            p(null);
          });
        }
      }, 0);
    });
  }
  doDownload(t, r, n) {
    const i = this.createRequest(t, (o) => {
      if (o.statusCode >= 400) {
        r.callback(new Error(`Cannot download "${t.protocol || "https:"}//${t.hostname}${t.path}", status ${o.statusCode}: ${o.statusMessage}`));
        return;
      }
      o.on("error", r.callback);
      const a = ir(o, "location");
      if (a != null) {
        n < this.maxRedirects ? this.doDownload(Qt.prepareRedirectUrlOptions(a, t), r, n++) : r.callback(this.createMaxRedirectError());
        return;
      }
      r.responseHandler == null ? gm(r, o) : r.responseHandler(o, r.callback);
    });
    this.addErrorAndTimeoutHandlers(i, r.callback, t.timeout), this.addRedirectHandlers(i, t, r.callback, n, (o) => {
      this.doDownload(o, r, n++);
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
    const n = jc(t, { ...r }), i = n.headers;
    if (i != null && i.authorization) {
      const o = Qt.reconstructOriginalUrl(r), a = Bc(t, r);
      Qt.isCrossOriginRedirect(o, a) && (It.enabled && It(`Given the cross-origin redirect (from ${o.host} to ${a.host}), the Authorization header will be stripped out.`), delete i.authorization);
    }
    return n;
  }
  static reconstructOriginalUrl(t) {
    const r = t.protocol || "https:";
    if (!t.hostname)
      throw new Error("Missing hostname in request options");
    const n = t.hostname, i = t.port ? `:${t.port}` : "", o = t.path || "/";
    return new To.URL(`${r}//${n}${i}${o}`);
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
        if (n < r && (i instanceof Wo && i.isServerError() || i.code === "EPIPE"))
          continue;
        throw i;
      }
  }
}
Se.HttpExecutor = Qt;
function Bc(e, t) {
  try {
    return new To.URL(e);
  } catch {
    const r = t.hostname, n = t.protocol || "https:", i = t.port ? `:${t.port}` : "", o = `${n}//${r}${i}`;
    return new To.URL(e, o);
  }
}
function jc(e, t) {
  const r = jn(t), n = Bc(e, t);
  return Yo(n, r), r;
}
function Yo(e, t) {
  t.protocol = e.protocol, t.hostname = e.hostname, e.port ? t.port = e.port : t.port && delete t.port, t.path = e.pathname + e.search;
}
class So extends um.Transform {
  // noinspection JSUnusedGlobalSymbols
  get actual() {
    return this._actual;
  }
  constructor(t, r = "sha512", n = "base64") {
    super(), this.expected = t, this.algorithm = r, this.encoding = n, this._actual = null, this.isValidateOnEnd = !0, this.digester = (0, sm.createHash)(r);
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
      throw (0, ls.newError)("Not finished yet", "ERR_STREAM_NOT_FINISHED");
    if (this._actual !== this.expected)
      throw (0, ls.newError)(`${this.algorithm} checksum mismatch, expected ${this.expected}, got ${this._actual}`, "ERR_CHECKSUM_MISMATCH");
    return null;
  }
}
Se.DigestTransform = So;
function mm(e, t, r) {
  return e != null && t != null && e !== t ? (r(new Error(`checksum mismatch: expected ${t} but got ${e} (X-Checksum-Sha2 header)`)), !1) : !0;
}
function ir(e, t) {
  const r = e.headers[t];
  return r == null ? null : Array.isArray(r) ? r.length === 0 ? null : r[r.length - 1] : r;
}
function gm(e, t) {
  if (!mm(ir(t, "X-Checksum-Sha2"), e.options.sha2, e.callback))
    return;
  const r = [];
  if (e.options.onProgress != null) {
    const a = ir(t, "content-length");
    a != null && r.push(new dm.ProgressCallbackTransform(parseInt(a, 10), e.options.cancellationToken, e.options.onProgress));
  }
  const n = e.options.sha512;
  n != null ? r.push(new So(n, "sha512", n.length === 128 && !n.includes("+") && !n.includes("Z") && !n.includes("=") ? "hex" : "base64")) : e.options.sha2 != null && r.push(new So(e.options.sha2, "sha256", "hex"));
  const i = (0, cm.createWriteStream)(e.destination);
  r.push(i);
  let o = t;
  for (const a of r)
    a.on("error", (s) => {
      i.close(), e.options.cancellationToken.cancelled || e.callback(s);
    }), o = o.pipe(a);
  i.on("finish", () => {
    i.close(e.callback);
  });
}
function jn(e, t, r) {
  r != null && (e.method = r), e.headers = { ...e.headers };
  const n = e.headers;
  return t != null && (n.authorization = t.startsWith("Basic") || t.startsWith("Bearer") ? t : `token ${t}`), n["User-Agent"] == null && (n["User-Agent"] = "electron-builder"), (r == null || r === "GET" || n["Cache-Control"] == null) && (n["Cache-Control"] = "no-cache"), e.protocol == null && process.versions.electron != null && (e.protocol = "https:"), e;
}
function Hn(e, t) {
  return JSON.stringify(e, (r, n) => r.endsWith("Authorization") || r.endsWith("authorization") || r.endsWith("Password") || r.endsWith("PASSWORD") || r.endsWith("Token") || r.includes("password") || r.includes("token") || t != null && t.has(r) ? "<stripped sensitive data>" : n, 2);
}
var ni = {};
Object.defineProperty(ni, "__esModule", { value: !0 });
ni.MemoLazy = void 0;
class Em {
  constructor(t, r) {
    this.selector = t, this.creator = r, this.selected = void 0, this._value = void 0;
  }
  get hasValue() {
    return this._value !== void 0;
  }
  get value() {
    const t = this.selector();
    if (this._value !== void 0 && Hc(this.selected, t))
      return this._value;
    this.selected = t;
    const r = this.creator(t);
    return this.value = r, r;
  }
  set value(t) {
    this._value = t;
  }
}
ni.MemoLazy = Em;
function Hc(e, t) {
  if (typeof e == "object" && e !== null && (typeof t == "object" && t !== null)) {
    const i = Object.keys(e), o = Object.keys(t);
    return i.length === o.length && i.every((a) => Hc(e[a], t[a]));
  }
  return e === t;
}
var zr = {};
Object.defineProperty(zr, "__esModule", { value: !0 });
zr.githubUrl = ym;
zr.githubTagPrefix = wm;
zr.getS3LikeProviderBaseUrl = vm;
function ym(e, t = "github.com") {
  return `${e.protocol || "https"}://${e.host || t}`;
}
function wm(e) {
  var t;
  return e.tagNamePrefix ? e.tagNamePrefix : !((t = e.vPrefixedTagName) !== null && t !== void 0) || t ? "v" : "";
}
function vm(e) {
  const t = e.provider;
  if (t === "s3")
    return _m(e);
  if (t === "spaces")
    return bm(e);
  throw new Error(`Not supported provider: ${t}`);
}
function _m(e) {
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
  return qc(t, e.path);
}
function qc(e, t) {
  return t != null && t.length > 0 && (t.startsWith("/") || (e += "/"), e += t), e;
}
function bm(e) {
  if (e.name == null)
    throw new Error("name is missing");
  if (e.region == null)
    throw new Error("region is missing");
  return qc(`https://${e.name}.${e.region}.digitaloceanspaces.com`, e.path);
}
var zo = {};
Object.defineProperty(zo, "__esModule", { value: !0 });
zo.retry = Gc;
const Tm = Et;
async function Gc(e, t) {
  var r;
  const { retries: n, interval: i, backoff: o = 0, attempt: a = 0, shouldRetry: s, cancellationToken: l = new Tm.CancellationToken() } = t;
  try {
    return await e();
  } catch (p) {
    if (await Promise.resolve((r = s == null ? void 0 : s(p)) !== null && r !== void 0 ? r : !0) && n > 0 && !l.cancelled)
      return await new Promise((c) => setTimeout(c, i + o * a)), await Gc(e, { ...t, retries: n - 1, attempt: a + 1 });
    throw p;
  }
}
var Xo = {};
Object.defineProperty(Xo, "__esModule", { value: !0 });
Xo.parseDn = Am;
function Am(e) {
  let t = !1, r = null, n = "", i = 0;
  e = e.trim();
  const o = /* @__PURE__ */ new Map();
  for (let a = 0; a <= e.length; a++) {
    if (a === e.length) {
      r !== null && o.set(r, n);
      break;
    }
    const s = e[a];
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
        a++;
        const l = parseInt(e.slice(a, a + 2), 16);
        Number.isNaN(l) ? n += e[a] : (a++, n += String.fromCharCode(l));
        continue;
      }
      if (r === null && s === "=") {
        r = n, n = "";
        continue;
      }
      if (s === "," || s === ";" || s === "+") {
        r !== null && o.set(r, n), r = null, n = "";
        continue;
      }
    }
    if (s === " " && !t) {
      if (n.length === 0)
        continue;
      if (a > i) {
        let l = a;
        for (; e[l] === " "; )
          l++;
        i = l;
      }
      if (i >= e.length || e[i] === "," || e[i] === ";" || r === null && e[i] === "=" || r !== null && e[i] === "+") {
        a = i - 1;
        continue;
      }
    }
    n += s;
  }
  return o;
}
var sr = {};
Object.defineProperty(sr, "__esModule", { value: !0 });
sr.nil = sr.UUID = void 0;
const Vc = Vr, Wc = ur, Sm = "options.name must be either a string or a Buffer", cs = (0, Vc.randomBytes)(16);
cs[0] = cs[0] | 1;
const xn = {}, W = [];
for (let e = 0; e < 256; e++) {
  const t = (e + 256).toString(16).substr(1);
  xn[t] = e, W[e] = t;
}
class Mt {
  constructor(t) {
    this.ascii = null, this.binary = null;
    const r = Mt.check(t);
    if (!r)
      throw new Error("not a UUID");
    this.version = r.version, r.format === "ascii" ? this.ascii = t : this.binary = t;
  }
  static v5(t, r) {
    return Cm(t, "sha1", 80, r);
  }
  toString() {
    return this.ascii == null && (this.ascii = Om(this.binary)), this.ascii;
  }
  inspect() {
    return `UUID v${this.version} ${this.toString()}`;
  }
  static check(t, r = 0) {
    if (typeof t == "string")
      return t = t.toLowerCase(), /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-([a-f0-9]{12})$/.test(t) ? t === "00000000-0000-0000-0000-000000000000" ? { version: void 0, variant: "nil", format: "ascii" } : {
        version: (xn[t[14] + t[15]] & 240) >> 4,
        variant: us((xn[t[19] + t[20]] & 224) >> 5),
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
        variant: us((t[r + 8] & 224) >> 5),
        format: "binary"
      };
    }
    throw (0, Wc.newError)("Unknown type of uuid", "ERR_UNKNOWN_UUID_TYPE");
  }
  // read stringified uuid into a Buffer
  static parse(t) {
    const r = Buffer.allocUnsafe(16);
    let n = 0;
    for (let i = 0; i < 16; i++)
      r[i] = xn[t[n++] + t[n++]], (i === 3 || i === 5 || i === 7 || i === 9) && (n += 1);
    return r;
  }
}
sr.UUID = Mt;
Mt.OID = Mt.parse("6ba7b812-9dad-11d1-80b4-00c04fd430c8");
function us(e) {
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
var Or;
(function(e) {
  e[e.ASCII = 0] = "ASCII", e[e.BINARY = 1] = "BINARY", e[e.OBJECT = 2] = "OBJECT";
})(Or || (Or = {}));
function Cm(e, t, r, n, i = Or.ASCII) {
  const o = (0, Vc.createHash)(t);
  if (typeof e != "string" && !Buffer.isBuffer(e))
    throw (0, Wc.newError)(Sm, "ERR_INVALID_UUID_NAME");
  o.update(n), o.update(e);
  const s = o.digest();
  let l;
  switch (i) {
    case Or.BINARY:
      s[6] = s[6] & 15 | r, s[8] = s[8] & 63 | 128, l = s;
      break;
    case Or.OBJECT:
      s[6] = s[6] & 15 | r, s[8] = s[8] & 63 | 128, l = new Mt(s);
      break;
    default:
      l = W[s[0]] + W[s[1]] + W[s[2]] + W[s[3]] + "-" + W[s[4]] + W[s[5]] + "-" + W[s[6] & 15 | r] + W[s[7]] + "-" + W[s[8] & 63 | 128] + W[s[9]] + "-" + W[s[10]] + W[s[11]] + W[s[12]] + W[s[13]] + W[s[14]] + W[s[15]];
      break;
  }
  return l;
}
function Om(e) {
  return W[e[0]] + W[e[1]] + W[e[2]] + W[e[3]] + "-" + W[e[4]] + W[e[5]] + "-" + W[e[6]] + W[e[7]] + "-" + W[e[8]] + W[e[9]] + "-" + W[e[10]] + W[e[11]] + W[e[12]] + W[e[13]] + W[e[14]] + W[e[15]];
}
sr.nil = new Mt("00000000-0000-0000-0000-000000000000");
var Xr = {}, Yc = {};
(function(e) {
  (function(t) {
    t.parser = function(m, u) {
      return new n(m, u);
    }, t.SAXParser = n, t.SAXStream = c, t.createStream = p, t.MAX_BUFFER_LENGTH = 64 * 1024;
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
    function n(m, u) {
      if (!(this instanceof n))
        return new n(m, u);
      var S = this;
      o(S), S.q = S.c = "", S.bufferCheckPosition = t.MAX_BUFFER_LENGTH, S.opt = u || {}, S.opt.lowercase = S.opt.lowercase || S.opt.lowercasetags, S.looseCase = S.opt.lowercase ? "toLowerCase" : "toUpperCase", S.tags = [], S.closed = S.closedRoot = S.sawRoot = !1, S.tag = S.error = null, S.strict = !!m, S.noscript = !!(m || S.opt.noscript), S.state = w.BEGIN, S.strictEntities = S.opt.strictEntities, S.ENTITIES = S.strictEntities ? Object.create(t.XML_ENTITIES) : Object.create(t.ENTITIES), S.attribList = [], S.opt.xmlns && (S.ns = Object.create(E)), S.opt.unquotedAttributeValues === void 0 && (S.opt.unquotedAttributeValues = !m), S.trackPosition = S.opt.position !== !1, S.trackPosition && (S.position = S.line = S.column = 0), B(S, "onready");
    }
    Object.create || (Object.create = function(m) {
      function u() {
      }
      u.prototype = m;
      var S = new u();
      return S;
    }), Object.keys || (Object.keys = function(m) {
      var u = [];
      for (var S in m) m.hasOwnProperty(S) && u.push(S);
      return u;
    });
    function i(m) {
      for (var u = Math.max(t.MAX_BUFFER_LENGTH, 10), S = 0, b = 0, z = r.length; b < z; b++) {
        var Z = m[r[b]].length;
        if (Z > u)
          switch (r[b]) {
            case "textNode":
              X(m);
              break;
            case "cdata":
              M(m, "oncdata", m.cdata), m.cdata = "";
              break;
            case "script":
              M(m, "onscript", m.script), m.script = "";
              break;
            default:
              O(m, "Max buffer length exceeded: " + r[b]);
          }
        S = Math.max(S, Z);
      }
      var ie = t.MAX_BUFFER_LENGTH - S;
      m.bufferCheckPosition = ie + m.position;
    }
    function o(m) {
      for (var u = 0, S = r.length; u < S; u++)
        m[r[u]] = "";
    }
    function a(m) {
      X(m), m.cdata !== "" && (M(m, "oncdata", m.cdata), m.cdata = ""), m.script !== "" && (M(m, "onscript", m.script), m.script = "");
    }
    n.prototype = {
      end: function() {
        D(this);
      },
      write: ze,
      resume: function() {
        return this.error = null, this;
      },
      close: function() {
        return this.write(null);
      },
      flush: function() {
        a(this);
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
    var l = t.EVENTS.filter(function(m) {
      return m !== "error" && m !== "end";
    });
    function p(m, u) {
      return new c(m, u);
    }
    function c(m, u) {
      if (!(this instanceof c))
        return new c(m, u);
      s.apply(this), this._parser = new n(m, u), this.writable = !0, this.readable = !0;
      var S = this;
      this._parser.onend = function() {
        S.emit("end");
      }, this._parser.onerror = function(b) {
        S.emit("error", b), S._parser.error = null;
      }, this._decoder = null, l.forEach(function(b) {
        Object.defineProperty(S, "on" + b, {
          get: function() {
            return S._parser["on" + b];
          },
          set: function(z) {
            if (!z)
              return S.removeAllListeners(b), S._parser["on" + b] = z, z;
            S.on(b, z);
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
    }), c.prototype.write = function(m) {
      return typeof Buffer == "function" && typeof Buffer.isBuffer == "function" && Buffer.isBuffer(m) && (this._decoder || (this._decoder = new TextDecoder("utf8")), m = this._decoder.decode(m, { stream: !0 })), this._parser.write(m.toString()), this.emit("data", m), !0;
    }, c.prototype.end = function(m) {
      if (m && m.length && this.write(m), this._decoder) {
        var u = this._decoder.decode();
        u && (this._parser.write(u), this.emit("data", u));
      }
      return this._parser.end(), !0;
    }, c.prototype.on = function(m, u) {
      var S = this;
      return !S._parser["on" + m] && l.indexOf(m) !== -1 && (S._parser["on" + m] = function() {
        var b = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
        b.splice(0, 0, m), S.emit.apply(S, b);
      }), s.prototype.on.call(S, m, u);
    };
    var f = "[CDATA[", d = "DOCTYPE", h = "http://www.w3.org/XML/1998/namespace", y = "http://www.w3.org/2000/xmlns/", E = { xml: h, xmlns: y }, _ = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/, T = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/, A = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/, N = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
    function x(m) {
      return m === " " || m === `
` || m === "\r" || m === "	";
    }
    function G(m) {
      return m === '"' || m === "'";
    }
    function te(m) {
      return m === ">" || x(m);
    }
    function Y(m, u) {
      return m.test(u);
    }
    function $e(m, u) {
      return !Y(m, u);
    }
    var w = 0;
    t.STATE = {
      BEGIN: w++,
      // leading byte order mark or whitespace
      BEGIN_WHITESPACE: w++,
      // leading whitespace
      TEXT: w++,
      // general stuff
      TEXT_ENTITY: w++,
      // &amp and such.
      OPEN_WAKA: w++,
      // <
      SGML_DECL: w++,
      // <!BLARG
      SGML_DECL_QUOTED: w++,
      // <!BLARG foo "bar
      DOCTYPE: w++,
      // <!DOCTYPE
      DOCTYPE_QUOTED: w++,
      // <!DOCTYPE "//blah
      DOCTYPE_DTD: w++,
      // <!DOCTYPE "//blah" [ ...
      DOCTYPE_DTD_QUOTED: w++,
      // <!DOCTYPE "//blah" [ "foo
      COMMENT_STARTING: w++,
      // <!-
      COMMENT: w++,
      // <!--
      COMMENT_ENDING: w++,
      // <!-- blah -
      COMMENT_ENDED: w++,
      // <!-- blah --
      CDATA: w++,
      // <![CDATA[ something
      CDATA_ENDING: w++,
      // ]
      CDATA_ENDING_2: w++,
      // ]]
      PROC_INST: w++,
      // <?hi
      PROC_INST_BODY: w++,
      // <?hi there
      PROC_INST_ENDING: w++,
      // <?hi "there" ?
      OPEN_TAG: w++,
      // <strong
      OPEN_TAG_SLASH: w++,
      // <strong /
      ATTRIB: w++,
      // <a
      ATTRIB_NAME: w++,
      // <a foo
      ATTRIB_NAME_SAW_WHITE: w++,
      // <a foo _
      ATTRIB_VALUE: w++,
      // <a foo=
      ATTRIB_VALUE_QUOTED: w++,
      // <a foo="bar
      ATTRIB_VALUE_CLOSED: w++,
      // <a foo="bar"
      ATTRIB_VALUE_UNQUOTED: w++,
      // <a foo=bar
      ATTRIB_VALUE_ENTITY_Q: w++,
      // <foo bar="&quot;"
      ATTRIB_VALUE_ENTITY_U: w++,
      // <foo bar=&quot
      CLOSE_TAG: w++,
      // </a
      CLOSE_TAG_SAW_WHITE: w++,
      // </a   >
      SCRIPT: w++,
      // <script> ...
      SCRIPT_ENDING: w++
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
    }, Object.keys(t.ENTITIES).forEach(function(m) {
      var u = t.ENTITIES[m], S = typeof u == "number" ? String.fromCharCode(u) : u;
      t.ENTITIES[m] = S;
    });
    for (var q in t.STATE)
      t.STATE[t.STATE[q]] = q;
    w = t.STATE;
    function B(m, u, S) {
      m[u] && m[u](S);
    }
    function M(m, u, S) {
      m.textNode && X(m), B(m, u, S);
    }
    function X(m) {
      m.textNode = I(m.opt, m.textNode), m.textNode && B(m, "ontext", m.textNode), m.textNode = "";
    }
    function I(m, u) {
      return m.trim && (u = u.trim()), m.normalize && (u = u.replace(/\s+/g, " ")), u;
    }
    function O(m, u) {
      return X(m), m.trackPosition && (u += `
Line: ` + m.line + `
Column: ` + m.column + `
Char: ` + m.c), u = new Error(u), m.error = u, B(m, "onerror", u), m;
    }
    function D(m) {
      return m.sawRoot && !m.closedRoot && C(m, "Unclosed root tag"), m.state !== w.BEGIN && m.state !== w.BEGIN_WHITESPACE && m.state !== w.TEXT && O(m, "Unexpected end"), X(m), m.c = "", m.closed = !0, B(m, "onend"), n.call(m, m.strict, m.opt), m;
    }
    function C(m, u) {
      if (typeof m != "object" || !(m instanceof n))
        throw new Error("bad call to strictFail");
      m.strict && O(m, u);
    }
    function $(m) {
      m.strict || (m.tagName = m.tagName[m.looseCase]());
      var u = m.tags[m.tags.length - 1] || m, S = m.tag = { name: m.tagName, attributes: {} };
      m.opt.xmlns && (S.ns = u.ns), m.attribList.length = 0, M(m, "onopentagstart", S);
    }
    function P(m, u) {
      var S = m.indexOf(":"), b = S < 0 ? ["", m] : m.split(":"), z = b[0], Z = b[1];
      return u && m === "xmlns" && (z = "xmlns", Z = ""), { prefix: z, local: Z };
    }
    function k(m) {
      if (m.strict || (m.attribName = m.attribName[m.looseCase]()), m.attribList.indexOf(m.attribName) !== -1 || m.tag.attributes.hasOwnProperty(m.attribName)) {
        m.attribName = m.attribValue = "";
        return;
      }
      if (m.opt.xmlns) {
        var u = P(m.attribName, !0), S = u.prefix, b = u.local;
        if (S === "xmlns")
          if (b === "xml" && m.attribValue !== h)
            C(
              m,
              "xml: prefix must be bound to " + h + `
Actual: ` + m.attribValue
            );
          else if (b === "xmlns" && m.attribValue !== y)
            C(
              m,
              "xmlns: prefix must be bound to " + y + `
Actual: ` + m.attribValue
            );
          else {
            var z = m.tag, Z = m.tags[m.tags.length - 1] || m;
            z.ns === Z.ns && (z.ns = Object.create(Z.ns)), z.ns[b] = m.attribValue;
          }
        m.attribList.push([m.attribName, m.attribValue]);
      } else
        m.tag.attributes[m.attribName] = m.attribValue, M(m, "onattribute", {
          name: m.attribName,
          value: m.attribValue
        });
      m.attribName = m.attribValue = "";
    }
    function V(m, u) {
      if (m.opt.xmlns) {
        var S = m.tag, b = P(m.tagName);
        S.prefix = b.prefix, S.local = b.local, S.uri = S.ns[b.prefix] || "", S.prefix && !S.uri && (C(
          m,
          "Unbound namespace prefix: " + JSON.stringify(m.tagName)
        ), S.uri = b.prefix);
        var z = m.tags[m.tags.length - 1] || m;
        S.ns && z.ns !== S.ns && Object.keys(S.ns).forEach(function(on) {
          M(m, "onopennamespace", {
            prefix: on,
            uri: S.ns[on]
          });
        });
        for (var Z = 0, ie = m.attribList.length; Z < ie; Z++) {
          var he = m.attribList[Z], Ee = he[0], it = he[1], le = P(Ee, !0), ke = le.prefix, _i = le.local, nn = ke === "" ? "" : S.ns[ke] || "", pr = {
            name: Ee,
            value: it,
            prefix: ke,
            local: _i,
            uri: nn
          };
          ke && ke !== "xmlns" && !nn && (C(
            m,
            "Unbound namespace prefix: " + JSON.stringify(ke)
          ), pr.uri = ke), m.tag.attributes[Ee] = pr, M(m, "onattribute", pr);
        }
        m.attribList.length = 0;
      }
      m.tag.isSelfClosing = !!u, m.sawRoot = !0, m.tags.push(m.tag), M(m, "onopentag", m.tag), u || (!m.noscript && m.tagName.toLowerCase() === "script" ? m.state = w.SCRIPT : m.state = w.TEXT, m.tag = null, m.tagName = ""), m.attribName = m.attribValue = "", m.attribList.length = 0;
    }
    function j(m) {
      if (!m.tagName) {
        C(m, "Weird empty close tag."), m.textNode += "</>", m.state = w.TEXT;
        return;
      }
      if (m.script) {
        if (m.tagName !== "script") {
          m.script += "</" + m.tagName + ">", m.tagName = "", m.state = w.SCRIPT;
          return;
        }
        M(m, "onscript", m.script), m.script = "";
      }
      var u = m.tags.length, S = m.tagName;
      m.strict || (S = S[m.looseCase]());
      for (var b = S; u--; ) {
        var z = m.tags[u];
        if (z.name !== b)
          C(m, "Unexpected close tag");
        else
          break;
      }
      if (u < 0) {
        C(m, "Unmatched closing tag: " + m.tagName), m.textNode += "</" + m.tagName + ">", m.state = w.TEXT;
        return;
      }
      m.tagName = S;
      for (var Z = m.tags.length; Z-- > u; ) {
        var ie = m.tag = m.tags.pop();
        m.tagName = m.tag.name, M(m, "onclosetag", m.tagName);
        var he = {};
        for (var Ee in ie.ns)
          he[Ee] = ie.ns[Ee];
        var it = m.tags[m.tags.length - 1] || m;
        m.opt.xmlns && ie.ns !== it.ns && Object.keys(ie.ns).forEach(function(le) {
          var ke = ie.ns[le];
          M(m, "onclosenamespace", { prefix: le, uri: ke });
        });
      }
      u === 0 && (m.closedRoot = !0), m.tagName = m.attribValue = m.attribName = "", m.attribList.length = 0, m.state = w.TEXT;
    }
    function K(m) {
      var u = m.entity, S = u.toLowerCase(), b, z = "";
      return m.ENTITIES[u] ? m.ENTITIES[u] : m.ENTITIES[S] ? m.ENTITIES[S] : (u = S, u.charAt(0) === "#" && (u.charAt(1) === "x" ? (u = u.slice(2), b = parseInt(u, 16), z = b.toString(16)) : (u = u.slice(1), b = parseInt(u, 10), z = b.toString(10))), u = u.replace(/^0+/, ""), isNaN(b) || z.toLowerCase() !== u || b < 0 || b > 1114111 ? (C(m, "Invalid character entity"), "&" + m.entity + ";") : String.fromCodePoint(b));
    }
    function ue(m, u) {
      u === "<" ? (m.state = w.OPEN_WAKA, m.startTagPosition = m.position) : x(u) || (C(m, "Non-whitespace before first tag."), m.textNode = u, m.state = w.TEXT);
    }
    function U(m, u) {
      var S = "";
      return u < m.length && (S = m.charAt(u)), S;
    }
    function ze(m) {
      var u = this;
      if (this.error)
        throw this.error;
      if (u.closed)
        return O(
          u,
          "Cannot write after close. Assign an onready handler."
        );
      if (m === null)
        return D(u);
      typeof m == "object" && (m = m.toString());
      for (var S = 0, b = ""; b = U(m, S++), u.c = b, !!b; )
        switch (u.trackPosition && (u.position++, b === `
` ? (u.line++, u.column = 0) : u.column++), u.state) {
          case w.BEGIN:
            if (u.state = w.BEGIN_WHITESPACE, b === "\uFEFF")
              continue;
            ue(u, b);
            continue;
          case w.BEGIN_WHITESPACE:
            ue(u, b);
            continue;
          case w.TEXT:
            if (u.sawRoot && !u.closedRoot) {
              for (var Z = S - 1; b && b !== "<" && b !== "&"; )
                b = U(m, S++), b && u.trackPosition && (u.position++, b === `
` ? (u.line++, u.column = 0) : u.column++);
              u.textNode += m.substring(Z, S - 1);
            }
            b === "<" && !(u.sawRoot && u.closedRoot && !u.strict) ? (u.state = w.OPEN_WAKA, u.startTagPosition = u.position) : (!x(b) && (!u.sawRoot || u.closedRoot) && C(u, "Text data outside of root node."), b === "&" ? u.state = w.TEXT_ENTITY : u.textNode += b);
            continue;
          case w.SCRIPT:
            b === "<" ? u.state = w.SCRIPT_ENDING : u.script += b;
            continue;
          case w.SCRIPT_ENDING:
            b === "/" ? u.state = w.CLOSE_TAG : (u.script += "<" + b, u.state = w.SCRIPT);
            continue;
          case w.OPEN_WAKA:
            if (b === "!")
              u.state = w.SGML_DECL, u.sgmlDecl = "";
            else if (!x(b)) if (Y(_, b))
              u.state = w.OPEN_TAG, u.tagName = b;
            else if (b === "/")
              u.state = w.CLOSE_TAG, u.tagName = "";
            else if (b === "?")
              u.state = w.PROC_INST, u.procInstName = u.procInstBody = "";
            else {
              if (C(u, "Unencoded <"), u.startTagPosition + 1 < u.position) {
                var z = u.position - u.startTagPosition;
                b = new Array(z).join(" ") + b;
              }
              u.textNode += "<" + b, u.state = w.TEXT;
            }
            continue;
          case w.SGML_DECL:
            if (u.sgmlDecl + b === "--") {
              u.state = w.COMMENT, u.comment = "", u.sgmlDecl = "";
              continue;
            }
            u.doctype && u.doctype !== !0 && u.sgmlDecl ? (u.state = w.DOCTYPE_DTD, u.doctype += "<!" + u.sgmlDecl + b, u.sgmlDecl = "") : (u.sgmlDecl + b).toUpperCase() === f ? (M(u, "onopencdata"), u.state = w.CDATA, u.sgmlDecl = "", u.cdata = "") : (u.sgmlDecl + b).toUpperCase() === d ? (u.state = w.DOCTYPE, (u.doctype || u.sawRoot) && C(
              u,
              "Inappropriately located doctype declaration"
            ), u.doctype = "", u.sgmlDecl = "") : b === ">" ? (M(u, "onsgmldeclaration", u.sgmlDecl), u.sgmlDecl = "", u.state = w.TEXT) : (G(b) && (u.state = w.SGML_DECL_QUOTED), u.sgmlDecl += b);
            continue;
          case w.SGML_DECL_QUOTED:
            b === u.q && (u.state = w.SGML_DECL, u.q = ""), u.sgmlDecl += b;
            continue;
          case w.DOCTYPE:
            b === ">" ? (u.state = w.TEXT, M(u, "ondoctype", u.doctype), u.doctype = !0) : (u.doctype += b, b === "[" ? u.state = w.DOCTYPE_DTD : G(b) && (u.state = w.DOCTYPE_QUOTED, u.q = b));
            continue;
          case w.DOCTYPE_QUOTED:
            u.doctype += b, b === u.q && (u.q = "", u.state = w.DOCTYPE);
            continue;
          case w.DOCTYPE_DTD:
            b === "]" ? (u.doctype += b, u.state = w.DOCTYPE) : b === "<" ? (u.state = w.OPEN_WAKA, u.startTagPosition = u.position) : G(b) ? (u.doctype += b, u.state = w.DOCTYPE_DTD_QUOTED, u.q = b) : u.doctype += b;
            continue;
          case w.DOCTYPE_DTD_QUOTED:
            u.doctype += b, b === u.q && (u.state = w.DOCTYPE_DTD, u.q = "");
            continue;
          case w.COMMENT:
            b === "-" ? u.state = w.COMMENT_ENDING : u.comment += b;
            continue;
          case w.COMMENT_ENDING:
            b === "-" ? (u.state = w.COMMENT_ENDED, u.comment = I(u.opt, u.comment), u.comment && M(u, "oncomment", u.comment), u.comment = "") : (u.comment += "-" + b, u.state = w.COMMENT);
            continue;
          case w.COMMENT_ENDED:
            b !== ">" ? (C(u, "Malformed comment"), u.comment += "--" + b, u.state = w.COMMENT) : u.doctype && u.doctype !== !0 ? u.state = w.DOCTYPE_DTD : u.state = w.TEXT;
            continue;
          case w.CDATA:
            for (var Z = S - 1; b && b !== "]"; )
              b = U(m, S++), b && u.trackPosition && (u.position++, b === `
` ? (u.line++, u.column = 0) : u.column++);
            u.cdata += m.substring(Z, S - 1), b === "]" && (u.state = w.CDATA_ENDING);
            continue;
          case w.CDATA_ENDING:
            b === "]" ? u.state = w.CDATA_ENDING_2 : (u.cdata += "]" + b, u.state = w.CDATA);
            continue;
          case w.CDATA_ENDING_2:
            b === ">" ? (u.cdata && M(u, "oncdata", u.cdata), M(u, "onclosecdata"), u.cdata = "", u.state = w.TEXT) : b === "]" ? u.cdata += "]" : (u.cdata += "]]" + b, u.state = w.CDATA);
            continue;
          case w.PROC_INST:
            b === "?" ? u.state = w.PROC_INST_ENDING : x(b) ? u.state = w.PROC_INST_BODY : u.procInstName += b;
            continue;
          case w.PROC_INST_BODY:
            if (!u.procInstBody && x(b))
              continue;
            b === "?" ? u.state = w.PROC_INST_ENDING : u.procInstBody += b;
            continue;
          case w.PROC_INST_ENDING:
            b === ">" ? (M(u, "onprocessinginstruction", {
              name: u.procInstName,
              body: u.procInstBody
            }), u.procInstName = u.procInstBody = "", u.state = w.TEXT) : (u.procInstBody += "?" + b, u.state = w.PROC_INST_BODY);
            continue;
          case w.OPEN_TAG:
            Y(T, b) ? u.tagName += b : ($(u), b === ">" ? V(u) : b === "/" ? u.state = w.OPEN_TAG_SLASH : (x(b) || C(u, "Invalid character in tag name"), u.state = w.ATTRIB));
            continue;
          case w.OPEN_TAG_SLASH:
            b === ">" ? (V(u, !0), j(u)) : (C(
              u,
              "Forward-slash in opening tag not followed by >"
            ), u.state = w.ATTRIB);
            continue;
          case w.ATTRIB:
            if (x(b))
              continue;
            b === ">" ? V(u) : b === "/" ? u.state = w.OPEN_TAG_SLASH : Y(_, b) ? (u.attribName = b, u.attribValue = "", u.state = w.ATTRIB_NAME) : C(u, "Invalid attribute name");
            continue;
          case w.ATTRIB_NAME:
            b === "=" ? u.state = w.ATTRIB_VALUE : b === ">" ? (C(u, "Attribute without value"), u.attribValue = u.attribName, k(u), V(u)) : x(b) ? u.state = w.ATTRIB_NAME_SAW_WHITE : Y(T, b) ? u.attribName += b : C(u, "Invalid attribute name");
            continue;
          case w.ATTRIB_NAME_SAW_WHITE:
            if (b === "=")
              u.state = w.ATTRIB_VALUE;
            else {
              if (x(b))
                continue;
              C(u, "Attribute without value"), u.tag.attributes[u.attribName] = "", u.attribValue = "", M(u, "onattribute", {
                name: u.attribName,
                value: ""
              }), u.attribName = "", b === ">" ? V(u) : Y(_, b) ? (u.attribName = b, u.state = w.ATTRIB_NAME) : (C(u, "Invalid attribute name"), u.state = w.ATTRIB);
            }
            continue;
          case w.ATTRIB_VALUE:
            if (x(b))
              continue;
            G(b) ? (u.q = b, u.state = w.ATTRIB_VALUE_QUOTED) : (u.opt.unquotedAttributeValues || O(u, "Unquoted attribute value"), u.state = w.ATTRIB_VALUE_UNQUOTED, u.attribValue = b);
            continue;
          case w.ATTRIB_VALUE_QUOTED:
            if (b !== u.q) {
              b === "&" ? u.state = w.ATTRIB_VALUE_ENTITY_Q : u.attribValue += b;
              continue;
            }
            k(u), u.q = "", u.state = w.ATTRIB_VALUE_CLOSED;
            continue;
          case w.ATTRIB_VALUE_CLOSED:
            x(b) ? u.state = w.ATTRIB : b === ">" ? V(u) : b === "/" ? u.state = w.OPEN_TAG_SLASH : Y(_, b) ? (C(u, "No whitespace between attributes"), u.attribName = b, u.attribValue = "", u.state = w.ATTRIB_NAME) : C(u, "Invalid attribute name");
            continue;
          case w.ATTRIB_VALUE_UNQUOTED:
            if (!te(b)) {
              b === "&" ? u.state = w.ATTRIB_VALUE_ENTITY_U : u.attribValue += b;
              continue;
            }
            k(u), b === ">" ? V(u) : u.state = w.ATTRIB;
            continue;
          case w.CLOSE_TAG:
            if (u.tagName)
              b === ">" ? j(u) : Y(T, b) ? u.tagName += b : u.script ? (u.script += "</" + u.tagName + b, u.tagName = "", u.state = w.SCRIPT) : (x(b) || C(u, "Invalid tagname in closing tag"), u.state = w.CLOSE_TAG_SAW_WHITE);
            else {
              if (x(b))
                continue;
              $e(_, b) ? u.script ? (u.script += "</" + b, u.state = w.SCRIPT) : C(u, "Invalid tagname in closing tag.") : u.tagName = b;
            }
            continue;
          case w.CLOSE_TAG_SAW_WHITE:
            if (x(b))
              continue;
            b === ">" ? j(u) : C(u, "Invalid characters in closing tag");
            continue;
          case w.TEXT_ENTITY:
          case w.ATTRIB_VALUE_ENTITY_Q:
          case w.ATTRIB_VALUE_ENTITY_U:
            var ie, he;
            switch (u.state) {
              case w.TEXT_ENTITY:
                ie = w.TEXT, he = "textNode";
                break;
              case w.ATTRIB_VALUE_ENTITY_Q:
                ie = w.ATTRIB_VALUE_QUOTED, he = "attribValue";
                break;
              case w.ATTRIB_VALUE_ENTITY_U:
                ie = w.ATTRIB_VALUE_UNQUOTED, he = "attribValue";
                break;
            }
            if (b === ";") {
              var Ee = K(u);
              u.opt.unparsedEntities && !Object.values(t.XML_ENTITIES).includes(Ee) ? (u.entity = "", u.state = ie, u.write(Ee)) : (u[he] += Ee, u.entity = "", u.state = ie);
            } else Y(u.entity.length ? N : A, b) ? u.entity += b : (C(u, "Invalid character in entity name"), u[he] += "&" + u.entity + b, u.entity = "", u.state = ie);
            continue;
          default:
            throw new Error(u, "Unknown state: " + u.state);
        }
      return u.position >= u.bufferCheckPosition && i(u), u;
    }
    /*! http://mths.be/fromcodepoint v0.1.0 by @mathias */
    String.fromCodePoint || function() {
      var m = String.fromCharCode, u = Math.floor, S = function() {
        var b = 16384, z = [], Z, ie, he = -1, Ee = arguments.length;
        if (!Ee)
          return "";
        for (var it = ""; ++he < Ee; ) {
          var le = Number(arguments[he]);
          if (!isFinite(le) || // `NaN`, `+Infinity`, or `-Infinity`
          le < 0 || // not a valid Unicode code point
          le > 1114111 || // not a valid Unicode code point
          u(le) !== le)
            throw RangeError("Invalid code point: " + le);
          le <= 65535 ? z.push(le) : (le -= 65536, Z = (le >> 10) + 55296, ie = le % 1024 + 56320, z.push(Z, ie)), (he + 1 === Ee || z.length > b) && (it += m.apply(null, z), z.length = 0);
        }
        return it;
      };
      Object.defineProperty ? Object.defineProperty(String, "fromCodePoint", {
        value: S,
        configurable: !0,
        writable: !0
      }) : String.fromCodePoint = S;
    }();
  })(e);
})(Yc);
Object.defineProperty(Xr, "__esModule", { value: !0 });
Xr.XElement = void 0;
Xr.parseXml = Nm;
const Rm = Yc, wn = ur;
class zc {
  constructor(t) {
    if (this.name = t, this.value = "", this.attributes = null, this.isCData = !1, this.elements = null, !t)
      throw (0, wn.newError)("Element name cannot be empty", "ERR_XML_ELEMENT_NAME_EMPTY");
    if (!Pm(t))
      throw (0, wn.newError)(`Invalid element name: ${t}`, "ERR_XML_ELEMENT_INVALID_NAME");
  }
  attribute(t) {
    const r = this.attributes === null ? null : this.attributes[t];
    if (r == null)
      throw (0, wn.newError)(`No attribute "${t}"`, "ERR_XML_MISSED_ATTRIBUTE");
    return r;
  }
  removeAttribute(t) {
    this.attributes !== null && delete this.attributes[t];
  }
  element(t, r = !1, n = null) {
    const i = this.elementOrNull(t, r);
    if (i === null)
      throw (0, wn.newError)(n || `No element "${t}"`, "ERR_XML_MISSED_ELEMENT");
    return i;
  }
  elementOrNull(t, r = !1) {
    if (this.elements === null)
      return null;
    for (const n of this.elements)
      if (fs(n, t, r))
        return n;
    return null;
  }
  getElements(t, r = !1) {
    return this.elements === null ? [] : this.elements.filter((n) => fs(n, t, r));
  }
  elementValueOrEmpty(t, r = !1) {
    const n = this.elementOrNull(t, r);
    return n === null ? "" : n.value;
  }
}
Xr.XElement = zc;
const Im = new RegExp(/^[A-Za-z_][:A-Za-z0-9_-]*$/i);
function Pm(e) {
  return Im.test(e);
}
function fs(e, t, r) {
  const n = e.name;
  return n === t || r === !0 && n.length === t.length && n.toLowerCase() === t.toLowerCase();
}
function Nm(e) {
  let t = null;
  const r = Rm.parser(!0, {}), n = [];
  return r.onopentag = (i) => {
    const o = new zc(i.name);
    if (o.attributes = i.attributes, t === null)
      t = o;
    else {
      const a = n[n.length - 1];
      a.elements == null && (a.elements = []), a.elements.push(o);
    }
    n.push(o);
  }, r.onclosetag = () => {
    n.pop();
  }, r.ontext = (i) => {
    n.length > 0 && (n[n.length - 1].value = i);
  }, r.oncdata = (i) => {
    const o = n[n.length - 1];
    o.value = i, o.isCData = !0;
  }, r.onerror = (i) => {
    throw i;
  }, r.write(e), t;
}
(function(e) {
  Object.defineProperty(e, "__esModule", { value: !0 }), e.CURRENT_APP_PACKAGE_FILE_NAME = e.CURRENT_APP_INSTALLER_FILE_NAME = e.XElement = e.parseXml = e.UUID = e.parseDn = e.retry = e.githubTagPrefix = e.githubUrl = e.getS3LikeProviderBaseUrl = e.ProgressCallbackTransform = e.MemoLazy = e.safeStringifyJson = e.safeGetHeader = e.parseJson = e.HttpExecutor = e.HttpError = e.DigestTransform = e.createHttpError = e.configureRequestUrl = e.configureRequestOptionsFromUrl = e.configureRequestOptions = e.newError = e.CancellationToken = e.CancellationError = void 0, e.asArray = f;
  var t = Et;
  Object.defineProperty(e, "CancellationError", { enumerable: !0, get: function() {
    return t.CancellationError;
  } }), Object.defineProperty(e, "CancellationToken", { enumerable: !0, get: function() {
    return t.CancellationToken;
  } });
  var r = ur;
  Object.defineProperty(e, "newError", { enumerable: !0, get: function() {
    return r.newError;
  } });
  var n = Se;
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
  var i = ni;
  Object.defineProperty(e, "MemoLazy", { enumerable: !0, get: function() {
    return i.MemoLazy;
  } });
  var o = Yr;
  Object.defineProperty(e, "ProgressCallbackTransform", { enumerable: !0, get: function() {
    return o.ProgressCallbackTransform;
  } });
  var a = zr;
  Object.defineProperty(e, "getS3LikeProviderBaseUrl", { enumerable: !0, get: function() {
    return a.getS3LikeProviderBaseUrl;
  } }), Object.defineProperty(e, "githubUrl", { enumerable: !0, get: function() {
    return a.githubUrl;
  } }), Object.defineProperty(e, "githubTagPrefix", { enumerable: !0, get: function() {
    return a.githubTagPrefix;
  } });
  var s = zo;
  Object.defineProperty(e, "retry", { enumerable: !0, get: function() {
    return s.retry;
  } });
  var l = Xo;
  Object.defineProperty(e, "parseDn", { enumerable: !0, get: function() {
    return l.parseDn;
  } });
  var p = sr;
  Object.defineProperty(e, "UUID", { enumerable: !0, get: function() {
    return p.UUID;
  } });
  var c = Xr;
  Object.defineProperty(e, "parseXml", { enumerable: !0, get: function() {
    return c.parseXml;
  } }), Object.defineProperty(e, "XElement", { enumerable: !0, get: function() {
    return c.XElement;
  } }), e.CURRENT_APP_INSTALLER_FILE_NAME = "installer.exe", e.CURRENT_APP_PACKAGE_FILE_NAME = "package.7z";
  function f(d) {
    return d == null ? [] : Array.isArray(d) ? d : [d];
  }
})(ce);
var ge = {}, Ko = {}, Ge = {};
function Xc(e) {
  return typeof e > "u" || e === null;
}
function Dm(e) {
  return typeof e == "object" && e !== null;
}
function $m(e) {
  return Array.isArray(e) ? e : Xc(e) ? [] : [e];
}
function Fm(e, t) {
  var r, n, i, o;
  if (t)
    for (o = Object.keys(t), r = 0, n = o.length; r < n; r += 1)
      i = o[r], e[i] = t[i];
  return e;
}
function xm(e, t) {
  var r = "", n;
  for (n = 0; n < t; n += 1)
    r += e;
  return r;
}
function Lm(e) {
  return e === 0 && Number.NEGATIVE_INFINITY === 1 / e;
}
Ge.isNothing = Xc;
Ge.isObject = Dm;
Ge.toArray = $m;
Ge.repeat = xm;
Ge.isNegativeZero = Lm;
Ge.extend = Fm;
function Kc(e, t) {
  var r = "", n = e.reason || "(unknown reason)";
  return e.mark ? (e.mark.name && (r += 'in "' + e.mark.name + '" '), r += "(" + (e.mark.line + 1) + ":" + (e.mark.column + 1) + ")", !t && e.mark.snippet && (r += `

` + e.mark.snippet), n + " " + r) : n;
}
function Fr(e, t) {
  Error.call(this), this.name = "YAMLException", this.reason = e, this.mark = t, this.message = Kc(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
}
Fr.prototype = Object.create(Error.prototype);
Fr.prototype.constructor = Fr;
Fr.prototype.toString = function(t) {
  return this.name + ": " + Kc(this, t);
};
var Kr = Fr, Tr = Ge;
function Ui(e, t, r, n, i) {
  var o = "", a = "", s = Math.floor(i / 2) - 1;
  return n - t > s && (o = " ... ", t = n - s + o.length), r - n > s && (a = " ...", r = n + s - a.length), {
    str: o + e.slice(t, r).replace(/\t/g, "→") + a,
    pos: n - t + o.length
    // relative position
  };
}
function ki(e, t) {
  return Tr.repeat(" ", t - e.length) + e;
}
function Um(e, t) {
  if (t = Object.create(t || null), !e.buffer) return null;
  t.maxLength || (t.maxLength = 79), typeof t.indent != "number" && (t.indent = 1), typeof t.linesBefore != "number" && (t.linesBefore = 3), typeof t.linesAfter != "number" && (t.linesAfter = 2);
  for (var r = /\r?\n|\r|\0/g, n = [0], i = [], o, a = -1; o = r.exec(e.buffer); )
    i.push(o.index), n.push(o.index + o[0].length), e.position <= o.index && a < 0 && (a = n.length - 2);
  a < 0 && (a = n.length - 1);
  var s = "", l, p, c = Math.min(e.line + t.linesAfter, i.length).toString().length, f = t.maxLength - (t.indent + c + 3);
  for (l = 1; l <= t.linesBefore && !(a - l < 0); l++)
    p = Ui(
      e.buffer,
      n[a - l],
      i[a - l],
      e.position - (n[a] - n[a - l]),
      f
    ), s = Tr.repeat(" ", t.indent) + ki((e.line - l + 1).toString(), c) + " | " + p.str + `
` + s;
  for (p = Ui(e.buffer, n[a], i[a], e.position, f), s += Tr.repeat(" ", t.indent) + ki((e.line + 1).toString(), c) + " | " + p.str + `
`, s += Tr.repeat("-", t.indent + c + 3 + p.pos) + `^
`, l = 1; l <= t.linesAfter && !(a + l >= i.length); l++)
    p = Ui(
      e.buffer,
      n[a + l],
      i[a + l],
      e.position - (n[a] - n[a + l]),
      f
    ), s += Tr.repeat(" ", t.indent) + ki((e.line + l + 1).toString(), c) + " | " + p.str + `
`;
  return s.replace(/\n$/, "");
}
var km = Um, ds = Kr, Mm = [
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
], Bm = [
  "scalar",
  "sequence",
  "mapping"
];
function jm(e) {
  var t = {};
  return e !== null && Object.keys(e).forEach(function(r) {
    e[r].forEach(function(n) {
      t[String(n)] = r;
    });
  }), t;
}
function Hm(e, t) {
  if (t = t || {}, Object.keys(t).forEach(function(r) {
    if (Mm.indexOf(r) === -1)
      throw new ds('Unknown option "' + r + '" is met in definition of "' + e + '" YAML type.');
  }), this.options = t, this.tag = e, this.kind = t.kind || null, this.resolve = t.resolve || function() {
    return !0;
  }, this.construct = t.construct || function(r) {
    return r;
  }, this.instanceOf = t.instanceOf || null, this.predicate = t.predicate || null, this.represent = t.represent || null, this.representName = t.representName || null, this.defaultStyle = t.defaultStyle || null, this.multi = t.multi || !1, this.styleAliases = jm(t.styleAliases || null), Bm.indexOf(this.kind) === -1)
    throw new ds('Unknown kind "' + this.kind + '" is specified for "' + e + '" YAML type.');
}
var Ie = Hm, wr = Kr, Mi = Ie;
function hs(e, t) {
  var r = [];
  return e[t].forEach(function(n) {
    var i = r.length;
    r.forEach(function(o, a) {
      o.tag === n.tag && o.kind === n.kind && o.multi === n.multi && (i = a);
    }), r[i] = n;
  }), r;
}
function qm() {
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
function Co(e) {
  return this.extend(e);
}
Co.prototype.extend = function(t) {
  var r = [], n = [];
  if (t instanceof Mi)
    n.push(t);
  else if (Array.isArray(t))
    n = n.concat(t);
  else if (t && (Array.isArray(t.implicit) || Array.isArray(t.explicit)))
    t.implicit && (r = r.concat(t.implicit)), t.explicit && (n = n.concat(t.explicit));
  else
    throw new wr("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  r.forEach(function(o) {
    if (!(o instanceof Mi))
      throw new wr("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    if (o.loadKind && o.loadKind !== "scalar")
      throw new wr("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    if (o.multi)
      throw new wr("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
  }), n.forEach(function(o) {
    if (!(o instanceof Mi))
      throw new wr("Specified list of YAML types (or a single Type object) contains a non-Type object.");
  });
  var i = Object.create(Co.prototype);
  return i.implicit = (this.implicit || []).concat(r), i.explicit = (this.explicit || []).concat(n), i.compiledImplicit = hs(i, "implicit"), i.compiledExplicit = hs(i, "explicit"), i.compiledTypeMap = qm(i.compiledImplicit, i.compiledExplicit), i;
};
var Jc = Co, Gm = Ie, Qc = new Gm("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(e) {
    return e !== null ? e : "";
  }
}), Vm = Ie, Zc = new Vm("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(e) {
    return e !== null ? e : [];
  }
}), Wm = Ie, eu = new Wm("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(e) {
    return e !== null ? e : {};
  }
}), Ym = Jc, tu = new Ym({
  explicit: [
    Qc,
    Zc,
    eu
  ]
}), zm = Ie;
function Xm(e) {
  if (e === null) return !0;
  var t = e.length;
  return t === 1 && e === "~" || t === 4 && (e === "null" || e === "Null" || e === "NULL");
}
function Km() {
  return null;
}
function Jm(e) {
  return e === null;
}
var ru = new zm("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: Xm,
  construct: Km,
  predicate: Jm,
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
}), Qm = Ie;
function Zm(e) {
  if (e === null) return !1;
  var t = e.length;
  return t === 4 && (e === "true" || e === "True" || e === "TRUE") || t === 5 && (e === "false" || e === "False" || e === "FALSE");
}
function eg(e) {
  return e === "true" || e === "True" || e === "TRUE";
}
function tg(e) {
  return Object.prototype.toString.call(e) === "[object Boolean]";
}
var nu = new Qm("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: Zm,
  construct: eg,
  predicate: tg,
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
}), rg = Ge, ng = Ie;
function ig(e) {
  return 48 <= e && e <= 57 || 65 <= e && e <= 70 || 97 <= e && e <= 102;
}
function og(e) {
  return 48 <= e && e <= 55;
}
function ag(e) {
  return 48 <= e && e <= 57;
}
function sg(e) {
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
          if (!ig(e.charCodeAt(r))) return !1;
          n = !0;
        }
      return n && i !== "_";
    }
    if (i === "o") {
      for (r++; r < t; r++)
        if (i = e[r], i !== "_") {
          if (!og(e.charCodeAt(r))) return !1;
          n = !0;
        }
      return n && i !== "_";
    }
  }
  if (i === "_") return !1;
  for (; r < t; r++)
    if (i = e[r], i !== "_") {
      if (!ag(e.charCodeAt(r)))
        return !1;
      n = !0;
    }
  return !(!n || i === "_");
}
function lg(e) {
  var t = e, r = 1, n;
  if (t.indexOf("_") !== -1 && (t = t.replace(/_/g, "")), n = t[0], (n === "-" || n === "+") && (n === "-" && (r = -1), t = t.slice(1), n = t[0]), t === "0") return 0;
  if (n === "0") {
    if (t[1] === "b") return r * parseInt(t.slice(2), 2);
    if (t[1] === "x") return r * parseInt(t.slice(2), 16);
    if (t[1] === "o") return r * parseInt(t.slice(2), 8);
  }
  return r * parseInt(t, 10);
}
function cg(e) {
  return Object.prototype.toString.call(e) === "[object Number]" && e % 1 === 0 && !rg.isNegativeZero(e);
}
var iu = new ng("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: sg,
  construct: lg,
  predicate: cg,
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
}), ou = Ge, ug = Ie, fg = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function dg(e) {
  return !(e === null || !fg.test(e) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  e[e.length - 1] === "_");
}
function hg(e) {
  var t, r;
  return t = e.replace(/_/g, "").toLowerCase(), r = t[0] === "-" ? -1 : 1, "+-".indexOf(t[0]) >= 0 && (t = t.slice(1)), t === ".inf" ? r === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : t === ".nan" ? NaN : r * parseFloat(t, 10);
}
var pg = /^[-+]?[0-9]+e/;
function mg(e, t) {
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
  else if (ou.isNegativeZero(e))
    return "-0.0";
  return r = e.toString(10), pg.test(r) ? r.replace("e", ".e") : r;
}
function gg(e) {
  return Object.prototype.toString.call(e) === "[object Number]" && (e % 1 !== 0 || ou.isNegativeZero(e));
}
var au = new ug("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: dg,
  construct: hg,
  predicate: gg,
  represent: mg,
  defaultStyle: "lowercase"
}), su = tu.extend({
  implicit: [
    ru,
    nu,
    iu,
    au
  ]
}), lu = su, Eg = Ie, cu = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
), uu = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function yg(e) {
  return e === null ? !1 : cu.exec(e) !== null || uu.exec(e) !== null;
}
function wg(e) {
  var t, r, n, i, o, a, s, l = 0, p = null, c, f, d;
  if (t = cu.exec(e), t === null && (t = uu.exec(e)), t === null) throw new Error("Date resolve error");
  if (r = +t[1], n = +t[2] - 1, i = +t[3], !t[4])
    return new Date(Date.UTC(r, n, i));
  if (o = +t[4], a = +t[5], s = +t[6], t[7]) {
    for (l = t[7].slice(0, 3); l.length < 3; )
      l += "0";
    l = +l;
  }
  return t[9] && (c = +t[10], f = +(t[11] || 0), p = (c * 60 + f) * 6e4, t[9] === "-" && (p = -p)), d = new Date(Date.UTC(r, n, i, o, a, s, l)), p && d.setTime(d.getTime() - p), d;
}
function vg(e) {
  return e.toISOString();
}
var fu = new Eg("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: yg,
  construct: wg,
  instanceOf: Date,
  represent: vg
}), _g = Ie;
function bg(e) {
  return e === "<<" || e === null;
}
var du = new _g("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: bg
}), Tg = Ie, Jo = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
function Ag(e) {
  if (e === null) return !1;
  var t, r, n = 0, i = e.length, o = Jo;
  for (r = 0; r < i; r++)
    if (t = o.indexOf(e.charAt(r)), !(t > 64)) {
      if (t < 0) return !1;
      n += 6;
    }
  return n % 8 === 0;
}
function Sg(e) {
  var t, r, n = e.replace(/[\r\n=]/g, ""), i = n.length, o = Jo, a = 0, s = [];
  for (t = 0; t < i; t++)
    t % 4 === 0 && t && (s.push(a >> 16 & 255), s.push(a >> 8 & 255), s.push(a & 255)), a = a << 6 | o.indexOf(n.charAt(t));
  return r = i % 4 * 6, r === 0 ? (s.push(a >> 16 & 255), s.push(a >> 8 & 255), s.push(a & 255)) : r === 18 ? (s.push(a >> 10 & 255), s.push(a >> 2 & 255)) : r === 12 && s.push(a >> 4 & 255), new Uint8Array(s);
}
function Cg(e) {
  var t = "", r = 0, n, i, o = e.length, a = Jo;
  for (n = 0; n < o; n++)
    n % 3 === 0 && n && (t += a[r >> 18 & 63], t += a[r >> 12 & 63], t += a[r >> 6 & 63], t += a[r & 63]), r = (r << 8) + e[n];
  return i = o % 3, i === 0 ? (t += a[r >> 18 & 63], t += a[r >> 12 & 63], t += a[r >> 6 & 63], t += a[r & 63]) : i === 2 ? (t += a[r >> 10 & 63], t += a[r >> 4 & 63], t += a[r << 2 & 63], t += a[64]) : i === 1 && (t += a[r >> 2 & 63], t += a[r << 4 & 63], t += a[64], t += a[64]), t;
}
function Og(e) {
  return Object.prototype.toString.call(e) === "[object Uint8Array]";
}
var hu = new Tg("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: Ag,
  construct: Sg,
  predicate: Og,
  represent: Cg
}), Rg = Ie, Ig = Object.prototype.hasOwnProperty, Pg = Object.prototype.toString;
function Ng(e) {
  if (e === null) return !0;
  var t = [], r, n, i, o, a, s = e;
  for (r = 0, n = s.length; r < n; r += 1) {
    if (i = s[r], a = !1, Pg.call(i) !== "[object Object]") return !1;
    for (o in i)
      if (Ig.call(i, o))
        if (!a) a = !0;
        else return !1;
    if (!a) return !1;
    if (t.indexOf(o) === -1) t.push(o);
    else return !1;
  }
  return !0;
}
function Dg(e) {
  return e !== null ? e : [];
}
var pu = new Rg("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: Ng,
  construct: Dg
}), $g = Ie, Fg = Object.prototype.toString;
function xg(e) {
  if (e === null) return !0;
  var t, r, n, i, o, a = e;
  for (o = new Array(a.length), t = 0, r = a.length; t < r; t += 1) {
    if (n = a[t], Fg.call(n) !== "[object Object]" || (i = Object.keys(n), i.length !== 1)) return !1;
    o[t] = [i[0], n[i[0]]];
  }
  return !0;
}
function Lg(e) {
  if (e === null) return [];
  var t, r, n, i, o, a = e;
  for (o = new Array(a.length), t = 0, r = a.length; t < r; t += 1)
    n = a[t], i = Object.keys(n), o[t] = [i[0], n[i[0]]];
  return o;
}
var mu = new $g("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: xg,
  construct: Lg
}), Ug = Ie, kg = Object.prototype.hasOwnProperty;
function Mg(e) {
  if (e === null) return !0;
  var t, r = e;
  for (t in r)
    if (kg.call(r, t) && r[t] !== null)
      return !1;
  return !0;
}
function Bg(e) {
  return e !== null ? e : {};
}
var gu = new Ug("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: Mg,
  construct: Bg
}), Qo = lu.extend({
  implicit: [
    fu,
    du
  ],
  explicit: [
    hu,
    pu,
    mu,
    gu
  ]
}), Dt = Ge, Eu = Kr, jg = km, Hg = Qo, yt = Object.prototype.hasOwnProperty, qn = 1, yu = 2, wu = 3, Gn = 4, Bi = 1, qg = 2, ps = 3, Gg = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/, Vg = /[\x85\u2028\u2029]/, Wg = /[,\[\]\{\}]/, vu = /^(?:!|!!|![a-z\-]+!)$/i, _u = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
function ms(e) {
  return Object.prototype.toString.call(e);
}
function Je(e) {
  return e === 10 || e === 13;
}
function Lt(e) {
  return e === 9 || e === 32;
}
function De(e) {
  return e === 9 || e === 32 || e === 10 || e === 13;
}
function Zt(e) {
  return e === 44 || e === 91 || e === 93 || e === 123 || e === 125;
}
function Yg(e) {
  var t;
  return 48 <= e && e <= 57 ? e - 48 : (t = e | 32, 97 <= t && t <= 102 ? t - 97 + 10 : -1);
}
function zg(e) {
  return e === 120 ? 2 : e === 117 ? 4 : e === 85 ? 8 : 0;
}
function Xg(e) {
  return 48 <= e && e <= 57 ? e - 48 : -1;
}
function gs(e) {
  return e === 48 ? "\0" : e === 97 ? "\x07" : e === 98 ? "\b" : e === 116 || e === 9 ? "	" : e === 110 ? `
` : e === 118 ? "\v" : e === 102 ? "\f" : e === 114 ? "\r" : e === 101 ? "\x1B" : e === 32 ? " " : e === 34 ? '"' : e === 47 ? "/" : e === 92 ? "\\" : e === 78 ? "" : e === 95 ? " " : e === 76 ? "\u2028" : e === 80 ? "\u2029" : "";
}
function Kg(e) {
  return e <= 65535 ? String.fromCharCode(e) : String.fromCharCode(
    (e - 65536 >> 10) + 55296,
    (e - 65536 & 1023) + 56320
  );
}
function bu(e, t, r) {
  t === "__proto__" ? Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !0,
    writable: !0,
    value: r
  }) : e[t] = r;
}
var Tu = new Array(256), Au = new Array(256);
for (var Yt = 0; Yt < 256; Yt++)
  Tu[Yt] = gs(Yt) ? 1 : 0, Au[Yt] = gs(Yt);
function Jg(e, t) {
  this.input = e, this.filename = t.filename || null, this.schema = t.schema || Hg, this.onWarning = t.onWarning || null, this.legacy = t.legacy || !1, this.json = t.json || !1, this.listener = t.listener || null, this.implicitTypes = this.schema.compiledImplicit, this.typeMap = this.schema.compiledTypeMap, this.length = e.length, this.position = 0, this.line = 0, this.lineStart = 0, this.lineIndent = 0, this.firstTabInLine = -1, this.documents = [];
}
function Su(e, t) {
  var r = {
    name: e.filename,
    buffer: e.input.slice(0, -1),
    // omit trailing \0
    position: e.position,
    line: e.line,
    column: e.position - e.lineStart
  };
  return r.snippet = jg(r), new Eu(t, r);
}
function L(e, t) {
  throw Su(e, t);
}
function Vn(e, t) {
  e.onWarning && e.onWarning.call(null, Su(e, t));
}
var Es = {
  YAML: function(t, r, n) {
    var i, o, a;
    t.version !== null && L(t, "duplication of %YAML directive"), n.length !== 1 && L(t, "YAML directive accepts exactly one argument"), i = /^([0-9]+)\.([0-9]+)$/.exec(n[0]), i === null && L(t, "ill-formed argument of the YAML directive"), o = parseInt(i[1], 10), a = parseInt(i[2], 10), o !== 1 && L(t, "unacceptable YAML version of the document"), t.version = n[0], t.checkLineBreaks = a < 2, a !== 1 && a !== 2 && Vn(t, "unsupported YAML version of the document");
  },
  TAG: function(t, r, n) {
    var i, o;
    n.length !== 2 && L(t, "TAG directive accepts exactly two arguments"), i = n[0], o = n[1], vu.test(i) || L(t, "ill-formed tag handle (first argument) of the TAG directive"), yt.call(t.tagMap, i) && L(t, 'there is a previously declared suffix for "' + i + '" tag handle'), _u.test(o) || L(t, "ill-formed tag prefix (second argument) of the TAG directive");
    try {
      o = decodeURIComponent(o);
    } catch {
      L(t, "tag prefix is malformed: " + o);
    }
    t.tagMap[i] = o;
  }
};
function mt(e, t, r, n) {
  var i, o, a, s;
  if (t < r) {
    if (s = e.input.slice(t, r), n)
      for (i = 0, o = s.length; i < o; i += 1)
        a = s.charCodeAt(i), a === 9 || 32 <= a && a <= 1114111 || L(e, "expected valid JSON character");
    else Gg.test(s) && L(e, "the stream contains non-printable characters");
    e.result += s;
  }
}
function ys(e, t, r, n) {
  var i, o, a, s;
  for (Dt.isObject(r) || L(e, "cannot merge mappings; the provided source object is unacceptable"), i = Object.keys(r), a = 0, s = i.length; a < s; a += 1)
    o = i[a], yt.call(t, o) || (bu(t, o, r[o]), n[o] = !0);
}
function er(e, t, r, n, i, o, a, s, l) {
  var p, c;
  if (Array.isArray(i))
    for (i = Array.prototype.slice.call(i), p = 0, c = i.length; p < c; p += 1)
      Array.isArray(i[p]) && L(e, "nested arrays are not supported inside keys"), typeof i == "object" && ms(i[p]) === "[object Object]" && (i[p] = "[object Object]");
  if (typeof i == "object" && ms(i) === "[object Object]" && (i = "[object Object]"), i = String(i), t === null && (t = {}), n === "tag:yaml.org,2002:merge")
    if (Array.isArray(o))
      for (p = 0, c = o.length; p < c; p += 1)
        ys(e, t, o[p], r);
    else
      ys(e, t, o, r);
  else
    !e.json && !yt.call(r, i) && yt.call(t, i) && (e.line = a || e.line, e.lineStart = s || e.lineStart, e.position = l || e.position, L(e, "duplicated mapping key")), bu(t, i, o), delete r[i];
  return t;
}
function Zo(e) {
  var t;
  t = e.input.charCodeAt(e.position), t === 10 ? e.position++ : t === 13 ? (e.position++, e.input.charCodeAt(e.position) === 10 && e.position++) : L(e, "a line break is expected"), e.line += 1, e.lineStart = e.position, e.firstTabInLine = -1;
}
function ae(e, t, r) {
  for (var n = 0, i = e.input.charCodeAt(e.position); i !== 0; ) {
    for (; Lt(i); )
      i === 9 && e.firstTabInLine === -1 && (e.firstTabInLine = e.position), i = e.input.charCodeAt(++e.position);
    if (t && i === 35)
      do
        i = e.input.charCodeAt(++e.position);
      while (i !== 10 && i !== 13 && i !== 0);
    if (Je(i))
      for (Zo(e), i = e.input.charCodeAt(e.position), n++, e.lineIndent = 0; i === 32; )
        e.lineIndent++, i = e.input.charCodeAt(++e.position);
    else
      break;
  }
  return r !== -1 && n !== 0 && e.lineIndent < r && Vn(e, "deficient indentation"), n;
}
function ii(e) {
  var t = e.position, r;
  return r = e.input.charCodeAt(t), !!((r === 45 || r === 46) && r === e.input.charCodeAt(t + 1) && r === e.input.charCodeAt(t + 2) && (t += 3, r = e.input.charCodeAt(t), r === 0 || De(r)));
}
function ea(e, t) {
  t === 1 ? e.result += " " : t > 1 && (e.result += Dt.repeat(`
`, t - 1));
}
function Qg(e, t, r) {
  var n, i, o, a, s, l, p, c, f = e.kind, d = e.result, h;
  if (h = e.input.charCodeAt(e.position), De(h) || Zt(h) || h === 35 || h === 38 || h === 42 || h === 33 || h === 124 || h === 62 || h === 39 || h === 34 || h === 37 || h === 64 || h === 96 || (h === 63 || h === 45) && (i = e.input.charCodeAt(e.position + 1), De(i) || r && Zt(i)))
    return !1;
  for (e.kind = "scalar", e.result = "", o = a = e.position, s = !1; h !== 0; ) {
    if (h === 58) {
      if (i = e.input.charCodeAt(e.position + 1), De(i) || r && Zt(i))
        break;
    } else if (h === 35) {
      if (n = e.input.charCodeAt(e.position - 1), De(n))
        break;
    } else {
      if (e.position === e.lineStart && ii(e) || r && Zt(h))
        break;
      if (Je(h))
        if (l = e.line, p = e.lineStart, c = e.lineIndent, ae(e, !1, -1), e.lineIndent >= t) {
          s = !0, h = e.input.charCodeAt(e.position);
          continue;
        } else {
          e.position = a, e.line = l, e.lineStart = p, e.lineIndent = c;
          break;
        }
    }
    s && (mt(e, o, a, !1), ea(e, e.line - l), o = a = e.position, s = !1), Lt(h) || (a = e.position + 1), h = e.input.charCodeAt(++e.position);
  }
  return mt(e, o, a, !1), e.result ? !0 : (e.kind = f, e.result = d, !1);
}
function Zg(e, t) {
  var r, n, i;
  if (r = e.input.charCodeAt(e.position), r !== 39)
    return !1;
  for (e.kind = "scalar", e.result = "", e.position++, n = i = e.position; (r = e.input.charCodeAt(e.position)) !== 0; )
    if (r === 39)
      if (mt(e, n, e.position, !0), r = e.input.charCodeAt(++e.position), r === 39)
        n = e.position, e.position++, i = e.position;
      else
        return !0;
    else Je(r) ? (mt(e, n, i, !0), ea(e, ae(e, !1, t)), n = i = e.position) : e.position === e.lineStart && ii(e) ? L(e, "unexpected end of the document within a single quoted scalar") : (e.position++, i = e.position);
  L(e, "unexpected end of the stream within a single quoted scalar");
}
function e0(e, t) {
  var r, n, i, o, a, s;
  if (s = e.input.charCodeAt(e.position), s !== 34)
    return !1;
  for (e.kind = "scalar", e.result = "", e.position++, r = n = e.position; (s = e.input.charCodeAt(e.position)) !== 0; ) {
    if (s === 34)
      return mt(e, r, e.position, !0), e.position++, !0;
    if (s === 92) {
      if (mt(e, r, e.position, !0), s = e.input.charCodeAt(++e.position), Je(s))
        ae(e, !1, t);
      else if (s < 256 && Tu[s])
        e.result += Au[s], e.position++;
      else if ((a = zg(s)) > 0) {
        for (i = a, o = 0; i > 0; i--)
          s = e.input.charCodeAt(++e.position), (a = Yg(s)) >= 0 ? o = (o << 4) + a : L(e, "expected hexadecimal character");
        e.result += Kg(o), e.position++;
      } else
        L(e, "unknown escape sequence");
      r = n = e.position;
    } else Je(s) ? (mt(e, r, n, !0), ea(e, ae(e, !1, t)), r = n = e.position) : e.position === e.lineStart && ii(e) ? L(e, "unexpected end of the document within a double quoted scalar") : (e.position++, n = e.position);
  }
  L(e, "unexpected end of the stream within a double quoted scalar");
}
function t0(e, t) {
  var r = !0, n, i, o, a = e.tag, s, l = e.anchor, p, c, f, d, h, y = /* @__PURE__ */ Object.create(null), E, _, T, A;
  if (A = e.input.charCodeAt(e.position), A === 91)
    c = 93, h = !1, s = [];
  else if (A === 123)
    c = 125, h = !0, s = {};
  else
    return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = s), A = e.input.charCodeAt(++e.position); A !== 0; ) {
    if (ae(e, !0, t), A = e.input.charCodeAt(e.position), A === c)
      return e.position++, e.tag = a, e.anchor = l, e.kind = h ? "mapping" : "sequence", e.result = s, !0;
    r ? A === 44 && L(e, "expected the node content, but found ','") : L(e, "missed comma between flow collection entries"), _ = E = T = null, f = d = !1, A === 63 && (p = e.input.charCodeAt(e.position + 1), De(p) && (f = d = !0, e.position++, ae(e, !0, t))), n = e.line, i = e.lineStart, o = e.position, lr(e, t, qn, !1, !0), _ = e.tag, E = e.result, ae(e, !0, t), A = e.input.charCodeAt(e.position), (d || e.line === n) && A === 58 && (f = !0, A = e.input.charCodeAt(++e.position), ae(e, !0, t), lr(e, t, qn, !1, !0), T = e.result), h ? er(e, s, y, _, E, T, n, i, o) : f ? s.push(er(e, null, y, _, E, T, n, i, o)) : s.push(E), ae(e, !0, t), A = e.input.charCodeAt(e.position), A === 44 ? (r = !0, A = e.input.charCodeAt(++e.position)) : r = !1;
  }
  L(e, "unexpected end of the stream within a flow collection");
}
function r0(e, t) {
  var r, n, i = Bi, o = !1, a = !1, s = t, l = 0, p = !1, c, f;
  if (f = e.input.charCodeAt(e.position), f === 124)
    n = !1;
  else if (f === 62)
    n = !0;
  else
    return !1;
  for (e.kind = "scalar", e.result = ""; f !== 0; )
    if (f = e.input.charCodeAt(++e.position), f === 43 || f === 45)
      Bi === i ? i = f === 43 ? ps : qg : L(e, "repeat of a chomping mode identifier");
    else if ((c = Xg(f)) >= 0)
      c === 0 ? L(e, "bad explicit indentation width of a block scalar; it cannot be less than one") : a ? L(e, "repeat of an indentation width identifier") : (s = t + c - 1, a = !0);
    else
      break;
  if (Lt(f)) {
    do
      f = e.input.charCodeAt(++e.position);
    while (Lt(f));
    if (f === 35)
      do
        f = e.input.charCodeAt(++e.position);
      while (!Je(f) && f !== 0);
  }
  for (; f !== 0; ) {
    for (Zo(e), e.lineIndent = 0, f = e.input.charCodeAt(e.position); (!a || e.lineIndent < s) && f === 32; )
      e.lineIndent++, f = e.input.charCodeAt(++e.position);
    if (!a && e.lineIndent > s && (s = e.lineIndent), Je(f)) {
      l++;
      continue;
    }
    if (e.lineIndent < s) {
      i === ps ? e.result += Dt.repeat(`
`, o ? 1 + l : l) : i === Bi && o && (e.result += `
`);
      break;
    }
    for (n ? Lt(f) ? (p = !0, e.result += Dt.repeat(`
`, o ? 1 + l : l)) : p ? (p = !1, e.result += Dt.repeat(`
`, l + 1)) : l === 0 ? o && (e.result += " ") : e.result += Dt.repeat(`
`, l) : e.result += Dt.repeat(`
`, o ? 1 + l : l), o = !0, a = !0, l = 0, r = e.position; !Je(f) && f !== 0; )
      f = e.input.charCodeAt(++e.position);
    mt(e, r, e.position, !1);
  }
  return !0;
}
function ws(e, t) {
  var r, n = e.tag, i = e.anchor, o = [], a, s = !1, l;
  if (e.firstTabInLine !== -1) return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = o), l = e.input.charCodeAt(e.position); l !== 0 && (e.firstTabInLine !== -1 && (e.position = e.firstTabInLine, L(e, "tab characters must not be used in indentation")), !(l !== 45 || (a = e.input.charCodeAt(e.position + 1), !De(a)))); ) {
    if (s = !0, e.position++, ae(e, !0, -1) && e.lineIndent <= t) {
      o.push(null), l = e.input.charCodeAt(e.position);
      continue;
    }
    if (r = e.line, lr(e, t, wu, !1, !0), o.push(e.result), ae(e, !0, -1), l = e.input.charCodeAt(e.position), (e.line === r || e.lineIndent > t) && l !== 0)
      L(e, "bad indentation of a sequence entry");
    else if (e.lineIndent < t)
      break;
  }
  return s ? (e.tag = n, e.anchor = i, e.kind = "sequence", e.result = o, !0) : !1;
}
function n0(e, t, r) {
  var n, i, o, a, s, l, p = e.tag, c = e.anchor, f = {}, d = /* @__PURE__ */ Object.create(null), h = null, y = null, E = null, _ = !1, T = !1, A;
  if (e.firstTabInLine !== -1) return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = f), A = e.input.charCodeAt(e.position); A !== 0; ) {
    if (!_ && e.firstTabInLine !== -1 && (e.position = e.firstTabInLine, L(e, "tab characters must not be used in indentation")), n = e.input.charCodeAt(e.position + 1), o = e.line, (A === 63 || A === 58) && De(n))
      A === 63 ? (_ && (er(e, f, d, h, y, null, a, s, l), h = y = E = null), T = !0, _ = !0, i = !0) : _ ? (_ = !1, i = !0) : L(e, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line"), e.position += 1, A = n;
    else {
      if (a = e.line, s = e.lineStart, l = e.position, !lr(e, r, yu, !1, !0))
        break;
      if (e.line === o) {
        for (A = e.input.charCodeAt(e.position); Lt(A); )
          A = e.input.charCodeAt(++e.position);
        if (A === 58)
          A = e.input.charCodeAt(++e.position), De(A) || L(e, "a whitespace character is expected after the key-value separator within a block mapping"), _ && (er(e, f, d, h, y, null, a, s, l), h = y = E = null), T = !0, _ = !1, i = !1, h = e.tag, y = e.result;
        else if (T)
          L(e, "can not read an implicit mapping pair; a colon is missed");
        else
          return e.tag = p, e.anchor = c, !0;
      } else if (T)
        L(e, "can not read a block mapping entry; a multiline key may not be an implicit key");
      else
        return e.tag = p, e.anchor = c, !0;
    }
    if ((e.line === o || e.lineIndent > t) && (_ && (a = e.line, s = e.lineStart, l = e.position), lr(e, t, Gn, !0, i) && (_ ? y = e.result : E = e.result), _ || (er(e, f, d, h, y, E, a, s, l), h = y = E = null), ae(e, !0, -1), A = e.input.charCodeAt(e.position)), (e.line === o || e.lineIndent > t) && A !== 0)
      L(e, "bad indentation of a mapping entry");
    else if (e.lineIndent < t)
      break;
  }
  return _ && er(e, f, d, h, y, null, a, s, l), T && (e.tag = p, e.anchor = c, e.kind = "mapping", e.result = f), T;
}
function i0(e) {
  var t, r = !1, n = !1, i, o, a;
  if (a = e.input.charCodeAt(e.position), a !== 33) return !1;
  if (e.tag !== null && L(e, "duplication of a tag property"), a = e.input.charCodeAt(++e.position), a === 60 ? (r = !0, a = e.input.charCodeAt(++e.position)) : a === 33 ? (n = !0, i = "!!", a = e.input.charCodeAt(++e.position)) : i = "!", t = e.position, r) {
    do
      a = e.input.charCodeAt(++e.position);
    while (a !== 0 && a !== 62);
    e.position < e.length ? (o = e.input.slice(t, e.position), a = e.input.charCodeAt(++e.position)) : L(e, "unexpected end of the stream within a verbatim tag");
  } else {
    for (; a !== 0 && !De(a); )
      a === 33 && (n ? L(e, "tag suffix cannot contain exclamation marks") : (i = e.input.slice(t - 1, e.position + 1), vu.test(i) || L(e, "named tag handle cannot contain such characters"), n = !0, t = e.position + 1)), a = e.input.charCodeAt(++e.position);
    o = e.input.slice(t, e.position), Wg.test(o) && L(e, "tag suffix cannot contain flow indicator characters");
  }
  o && !_u.test(o) && L(e, "tag name cannot contain such characters: " + o);
  try {
    o = decodeURIComponent(o);
  } catch {
    L(e, "tag name is malformed: " + o);
  }
  return r ? e.tag = o : yt.call(e.tagMap, i) ? e.tag = e.tagMap[i] + o : i === "!" ? e.tag = "!" + o : i === "!!" ? e.tag = "tag:yaml.org,2002:" + o : L(e, 'undeclared tag handle "' + i + '"'), !0;
}
function o0(e) {
  var t, r;
  if (r = e.input.charCodeAt(e.position), r !== 38) return !1;
  for (e.anchor !== null && L(e, "duplication of an anchor property"), r = e.input.charCodeAt(++e.position), t = e.position; r !== 0 && !De(r) && !Zt(r); )
    r = e.input.charCodeAt(++e.position);
  return e.position === t && L(e, "name of an anchor node must contain at least one character"), e.anchor = e.input.slice(t, e.position), !0;
}
function a0(e) {
  var t, r, n;
  if (n = e.input.charCodeAt(e.position), n !== 42) return !1;
  for (n = e.input.charCodeAt(++e.position), t = e.position; n !== 0 && !De(n) && !Zt(n); )
    n = e.input.charCodeAt(++e.position);
  return e.position === t && L(e, "name of an alias node must contain at least one character"), r = e.input.slice(t, e.position), yt.call(e.anchorMap, r) || L(e, 'unidentified alias "' + r + '"'), e.result = e.anchorMap[r], ae(e, !0, -1), !0;
}
function lr(e, t, r, n, i) {
  var o, a, s, l = 1, p = !1, c = !1, f, d, h, y, E, _;
  if (e.listener !== null && e.listener("open", e), e.tag = null, e.anchor = null, e.kind = null, e.result = null, o = a = s = Gn === r || wu === r, n && ae(e, !0, -1) && (p = !0, e.lineIndent > t ? l = 1 : e.lineIndent === t ? l = 0 : e.lineIndent < t && (l = -1)), l === 1)
    for (; i0(e) || o0(e); )
      ae(e, !0, -1) ? (p = !0, s = o, e.lineIndent > t ? l = 1 : e.lineIndent === t ? l = 0 : e.lineIndent < t && (l = -1)) : s = !1;
  if (s && (s = p || i), (l === 1 || Gn === r) && (qn === r || yu === r ? E = t : E = t + 1, _ = e.position - e.lineStart, l === 1 ? s && (ws(e, _) || n0(e, _, E)) || t0(e, E) ? c = !0 : (a && r0(e, E) || Zg(e, E) || e0(e, E) ? c = !0 : a0(e) ? (c = !0, (e.tag !== null || e.anchor !== null) && L(e, "alias node should not have any properties")) : Qg(e, E, qn === r) && (c = !0, e.tag === null && (e.tag = "?")), e.anchor !== null && (e.anchorMap[e.anchor] = e.result)) : l === 0 && (c = s && ws(e, _))), e.tag === null)
    e.anchor !== null && (e.anchorMap[e.anchor] = e.result);
  else if (e.tag === "?") {
    for (e.result !== null && e.kind !== "scalar" && L(e, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + e.kind + '"'), f = 0, d = e.implicitTypes.length; f < d; f += 1)
      if (y = e.implicitTypes[f], y.resolve(e.result)) {
        e.result = y.construct(e.result), e.tag = y.tag, e.anchor !== null && (e.anchorMap[e.anchor] = e.result);
        break;
      }
  } else if (e.tag !== "!") {
    if (yt.call(e.typeMap[e.kind || "fallback"], e.tag))
      y = e.typeMap[e.kind || "fallback"][e.tag];
    else
      for (y = null, h = e.typeMap.multi[e.kind || "fallback"], f = 0, d = h.length; f < d; f += 1)
        if (e.tag.slice(0, h[f].tag.length) === h[f].tag) {
          y = h[f];
          break;
        }
    y || L(e, "unknown tag !<" + e.tag + ">"), e.result !== null && y.kind !== e.kind && L(e, "unacceptable node kind for !<" + e.tag + '> tag; it should be "' + y.kind + '", not "' + e.kind + '"'), y.resolve(e.result, e.tag) ? (e.result = y.construct(e.result, e.tag), e.anchor !== null && (e.anchorMap[e.anchor] = e.result)) : L(e, "cannot resolve a node with !<" + e.tag + "> explicit tag");
  }
  return e.listener !== null && e.listener("close", e), e.tag !== null || e.anchor !== null || c;
}
function s0(e) {
  var t = e.position, r, n, i, o = !1, a;
  for (e.version = null, e.checkLineBreaks = e.legacy, e.tagMap = /* @__PURE__ */ Object.create(null), e.anchorMap = /* @__PURE__ */ Object.create(null); (a = e.input.charCodeAt(e.position)) !== 0 && (ae(e, !0, -1), a = e.input.charCodeAt(e.position), !(e.lineIndent > 0 || a !== 37)); ) {
    for (o = !0, a = e.input.charCodeAt(++e.position), r = e.position; a !== 0 && !De(a); )
      a = e.input.charCodeAt(++e.position);
    for (n = e.input.slice(r, e.position), i = [], n.length < 1 && L(e, "directive name must not be less than one character in length"); a !== 0; ) {
      for (; Lt(a); )
        a = e.input.charCodeAt(++e.position);
      if (a === 35) {
        do
          a = e.input.charCodeAt(++e.position);
        while (a !== 0 && !Je(a));
        break;
      }
      if (Je(a)) break;
      for (r = e.position; a !== 0 && !De(a); )
        a = e.input.charCodeAt(++e.position);
      i.push(e.input.slice(r, e.position));
    }
    a !== 0 && Zo(e), yt.call(Es, n) ? Es[n](e, n, i) : Vn(e, 'unknown document directive "' + n + '"');
  }
  if (ae(e, !0, -1), e.lineIndent === 0 && e.input.charCodeAt(e.position) === 45 && e.input.charCodeAt(e.position + 1) === 45 && e.input.charCodeAt(e.position + 2) === 45 ? (e.position += 3, ae(e, !0, -1)) : o && L(e, "directives end mark is expected"), lr(e, e.lineIndent - 1, Gn, !1, !0), ae(e, !0, -1), e.checkLineBreaks && Vg.test(e.input.slice(t, e.position)) && Vn(e, "non-ASCII line breaks are interpreted as content"), e.documents.push(e.result), e.position === e.lineStart && ii(e)) {
    e.input.charCodeAt(e.position) === 46 && (e.position += 3, ae(e, !0, -1));
    return;
  }
  if (e.position < e.length - 1)
    L(e, "end of the stream or a document separator is expected");
  else
    return;
}
function Cu(e, t) {
  e = String(e), t = t || {}, e.length !== 0 && (e.charCodeAt(e.length - 1) !== 10 && e.charCodeAt(e.length - 1) !== 13 && (e += `
`), e.charCodeAt(0) === 65279 && (e = e.slice(1)));
  var r = new Jg(e, t), n = e.indexOf("\0");
  for (n !== -1 && (r.position = n, L(r, "null byte is not allowed in input")), r.input += "\0"; r.input.charCodeAt(r.position) === 32; )
    r.lineIndent += 1, r.position += 1;
  for (; r.position < r.length - 1; )
    s0(r);
  return r.documents;
}
function l0(e, t, r) {
  t !== null && typeof t == "object" && typeof r > "u" && (r = t, t = null);
  var n = Cu(e, r);
  if (typeof t != "function")
    return n;
  for (var i = 0, o = n.length; i < o; i += 1)
    t(n[i]);
}
function c0(e, t) {
  var r = Cu(e, t);
  if (r.length !== 0) {
    if (r.length === 1)
      return r[0];
    throw new Eu("expected a single document in the stream, but found more");
  }
}
Ko.loadAll = l0;
Ko.load = c0;
var Ou = {}, oi = Ge, Jr = Kr, u0 = Qo, Ru = Object.prototype.toString, Iu = Object.prototype.hasOwnProperty, ta = 65279, f0 = 9, xr = 10, d0 = 13, h0 = 32, p0 = 33, m0 = 34, Oo = 35, g0 = 37, E0 = 38, y0 = 39, w0 = 42, Pu = 44, v0 = 45, Wn = 58, _0 = 61, b0 = 62, T0 = 63, A0 = 64, Nu = 91, Du = 93, S0 = 96, $u = 123, C0 = 124, Fu = 125, ve = {};
ve[0] = "\\0";
ve[7] = "\\a";
ve[8] = "\\b";
ve[9] = "\\t";
ve[10] = "\\n";
ve[11] = "\\v";
ve[12] = "\\f";
ve[13] = "\\r";
ve[27] = "\\e";
ve[34] = '\\"';
ve[92] = "\\\\";
ve[133] = "\\N";
ve[160] = "\\_";
ve[8232] = "\\L";
ve[8233] = "\\P";
var O0 = [
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
], R0 = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
function I0(e, t) {
  var r, n, i, o, a, s, l;
  if (t === null) return {};
  for (r = {}, n = Object.keys(t), i = 0, o = n.length; i < o; i += 1)
    a = n[i], s = String(t[a]), a.slice(0, 2) === "!!" && (a = "tag:yaml.org,2002:" + a.slice(2)), l = e.compiledTypeMap.fallback[a], l && Iu.call(l.styleAliases, s) && (s = l.styleAliases[s]), r[a] = s;
  return r;
}
function P0(e) {
  var t, r, n;
  if (t = e.toString(16).toUpperCase(), e <= 255)
    r = "x", n = 2;
  else if (e <= 65535)
    r = "u", n = 4;
  else if (e <= 4294967295)
    r = "U", n = 8;
  else
    throw new Jr("code point within a string may not be greater than 0xFFFFFFFF");
  return "\\" + r + oi.repeat("0", n - t.length) + t;
}
var N0 = 1, Lr = 2;
function D0(e) {
  this.schema = e.schema || u0, this.indent = Math.max(1, e.indent || 2), this.noArrayIndent = e.noArrayIndent || !1, this.skipInvalid = e.skipInvalid || !1, this.flowLevel = oi.isNothing(e.flowLevel) ? -1 : e.flowLevel, this.styleMap = I0(this.schema, e.styles || null), this.sortKeys = e.sortKeys || !1, this.lineWidth = e.lineWidth || 80, this.noRefs = e.noRefs || !1, this.noCompatMode = e.noCompatMode || !1, this.condenseFlow = e.condenseFlow || !1, this.quotingType = e.quotingType === '"' ? Lr : N0, this.forceQuotes = e.forceQuotes || !1, this.replacer = typeof e.replacer == "function" ? e.replacer : null, this.implicitTypes = this.schema.compiledImplicit, this.explicitTypes = this.schema.compiledExplicit, this.tag = null, this.result = "", this.duplicates = [], this.usedDuplicates = null;
}
function vs(e, t) {
  for (var r = oi.repeat(" ", t), n = 0, i = -1, o = "", a, s = e.length; n < s; )
    i = e.indexOf(`
`, n), i === -1 ? (a = e.slice(n), n = s) : (a = e.slice(n, i + 1), n = i + 1), a.length && a !== `
` && (o += r), o += a;
  return o;
}
function Ro(e, t) {
  return `
` + oi.repeat(" ", e.indent * t);
}
function $0(e, t) {
  var r, n, i;
  for (r = 0, n = e.implicitTypes.length; r < n; r += 1)
    if (i = e.implicitTypes[r], i.resolve(t))
      return !0;
  return !1;
}
function Yn(e) {
  return e === h0 || e === f0;
}
function Ur(e) {
  return 32 <= e && e <= 126 || 161 <= e && e <= 55295 && e !== 8232 && e !== 8233 || 57344 <= e && e <= 65533 && e !== ta || 65536 <= e && e <= 1114111;
}
function _s(e) {
  return Ur(e) && e !== ta && e !== d0 && e !== xr;
}
function bs(e, t, r) {
  var n = _s(e), i = n && !Yn(e);
  return (
    // ns-plain-safe
    (r ? (
      // c = flow-in
      n
    ) : n && e !== Pu && e !== Nu && e !== Du && e !== $u && e !== Fu) && e !== Oo && !(t === Wn && !i) || _s(t) && !Yn(t) && e === Oo || t === Wn && i
  );
}
function F0(e) {
  return Ur(e) && e !== ta && !Yn(e) && e !== v0 && e !== T0 && e !== Wn && e !== Pu && e !== Nu && e !== Du && e !== $u && e !== Fu && e !== Oo && e !== E0 && e !== w0 && e !== p0 && e !== C0 && e !== _0 && e !== b0 && e !== y0 && e !== m0 && e !== g0 && e !== A0 && e !== S0;
}
function x0(e) {
  return !Yn(e) && e !== Wn;
}
function Ar(e, t) {
  var r = e.charCodeAt(t), n;
  return r >= 55296 && r <= 56319 && t + 1 < e.length && (n = e.charCodeAt(t + 1), n >= 56320 && n <= 57343) ? (r - 55296) * 1024 + n - 56320 + 65536 : r;
}
function xu(e) {
  var t = /^\n* /;
  return t.test(e);
}
var Lu = 1, Io = 2, Uu = 3, ku = 4, Jt = 5;
function L0(e, t, r, n, i, o, a, s) {
  var l, p = 0, c = null, f = !1, d = !1, h = n !== -1, y = -1, E = F0(Ar(e, 0)) && x0(Ar(e, e.length - 1));
  if (t || a)
    for (l = 0; l < e.length; p >= 65536 ? l += 2 : l++) {
      if (p = Ar(e, l), !Ur(p))
        return Jt;
      E = E && bs(p, c, s), c = p;
    }
  else {
    for (l = 0; l < e.length; p >= 65536 ? l += 2 : l++) {
      if (p = Ar(e, l), p === xr)
        f = !0, h && (d = d || // Foldable line = too long, and not more-indented.
        l - y - 1 > n && e[y + 1] !== " ", y = l);
      else if (!Ur(p))
        return Jt;
      E = E && bs(p, c, s), c = p;
    }
    d = d || h && l - y - 1 > n && e[y + 1] !== " ";
  }
  return !f && !d ? E && !a && !i(e) ? Lu : o === Lr ? Jt : Io : r > 9 && xu(e) ? Jt : a ? o === Lr ? Jt : Io : d ? ku : Uu;
}
function U0(e, t, r, n, i) {
  e.dump = function() {
    if (t.length === 0)
      return e.quotingType === Lr ? '""' : "''";
    if (!e.noCompatMode && (O0.indexOf(t) !== -1 || R0.test(t)))
      return e.quotingType === Lr ? '"' + t + '"' : "'" + t + "'";
    var o = e.indent * Math.max(1, r), a = e.lineWidth === -1 ? -1 : Math.max(Math.min(e.lineWidth, 40), e.lineWidth - o), s = n || e.flowLevel > -1 && r >= e.flowLevel;
    function l(p) {
      return $0(e, p);
    }
    switch (L0(
      t,
      s,
      e.indent,
      a,
      l,
      e.quotingType,
      e.forceQuotes && !n,
      i
    )) {
      case Lu:
        return t;
      case Io:
        return "'" + t.replace(/'/g, "''") + "'";
      case Uu:
        return "|" + Ts(t, e.indent) + As(vs(t, o));
      case ku:
        return ">" + Ts(t, e.indent) + As(vs(k0(t, a), o));
      case Jt:
        return '"' + M0(t) + '"';
      default:
        throw new Jr("impossible error: invalid scalar style");
    }
  }();
}
function Ts(e, t) {
  var r = xu(e) ? String(t) : "", n = e[e.length - 1] === `
`, i = n && (e[e.length - 2] === `
` || e === `
`), o = i ? "+" : n ? "" : "-";
  return r + o + `
`;
}
function As(e) {
  return e[e.length - 1] === `
` ? e.slice(0, -1) : e;
}
function k0(e, t) {
  for (var r = /(\n+)([^\n]*)/g, n = function() {
    var p = e.indexOf(`
`);
    return p = p !== -1 ? p : e.length, r.lastIndex = p, Ss(e.slice(0, p), t);
  }(), i = e[0] === `
` || e[0] === " ", o, a; a = r.exec(e); ) {
    var s = a[1], l = a[2];
    o = l[0] === " ", n += s + (!i && !o && l !== "" ? `
` : "") + Ss(l, t), i = o;
  }
  return n;
}
function Ss(e, t) {
  if (e === "" || e[0] === " ") return e;
  for (var r = / [^ ]/g, n, i = 0, o, a = 0, s = 0, l = ""; n = r.exec(e); )
    s = n.index, s - i > t && (o = a > i ? a : s, l += `
` + e.slice(i, o), i = o + 1), a = s;
  return l += `
`, e.length - i > t && a > i ? l += e.slice(i, a) + `
` + e.slice(a + 1) : l += e.slice(i), l.slice(1);
}
function M0(e) {
  for (var t = "", r = 0, n, i = 0; i < e.length; r >= 65536 ? i += 2 : i++)
    r = Ar(e, i), n = ve[r], !n && Ur(r) ? (t += e[i], r >= 65536 && (t += e[i + 1])) : t += n || P0(r);
  return t;
}
function B0(e, t, r) {
  var n = "", i = e.tag, o, a, s;
  for (o = 0, a = r.length; o < a; o += 1)
    s = r[o], e.replacer && (s = e.replacer.call(r, String(o), s)), (nt(e, t, s, !1, !1) || typeof s > "u" && nt(e, t, null, !1, !1)) && (n !== "" && (n += "," + (e.condenseFlow ? "" : " ")), n += e.dump);
  e.tag = i, e.dump = "[" + n + "]";
}
function Cs(e, t, r, n) {
  var i = "", o = e.tag, a, s, l;
  for (a = 0, s = r.length; a < s; a += 1)
    l = r[a], e.replacer && (l = e.replacer.call(r, String(a), l)), (nt(e, t + 1, l, !0, !0, !1, !0) || typeof l > "u" && nt(e, t + 1, null, !0, !0, !1, !0)) && ((!n || i !== "") && (i += Ro(e, t)), e.dump && xr === e.dump.charCodeAt(0) ? i += "-" : i += "- ", i += e.dump);
  e.tag = o, e.dump = i || "[]";
}
function j0(e, t, r) {
  var n = "", i = e.tag, o = Object.keys(r), a, s, l, p, c;
  for (a = 0, s = o.length; a < s; a += 1)
    c = "", n !== "" && (c += ", "), e.condenseFlow && (c += '"'), l = o[a], p = r[l], e.replacer && (p = e.replacer.call(r, l, p)), nt(e, t, l, !1, !1) && (e.dump.length > 1024 && (c += "? "), c += e.dump + (e.condenseFlow ? '"' : "") + ":" + (e.condenseFlow ? "" : " "), nt(e, t, p, !1, !1) && (c += e.dump, n += c));
  e.tag = i, e.dump = "{" + n + "}";
}
function H0(e, t, r, n) {
  var i = "", o = e.tag, a = Object.keys(r), s, l, p, c, f, d;
  if (e.sortKeys === !0)
    a.sort();
  else if (typeof e.sortKeys == "function")
    a.sort(e.sortKeys);
  else if (e.sortKeys)
    throw new Jr("sortKeys must be a boolean or a function");
  for (s = 0, l = a.length; s < l; s += 1)
    d = "", (!n || i !== "") && (d += Ro(e, t)), p = a[s], c = r[p], e.replacer && (c = e.replacer.call(r, p, c)), nt(e, t + 1, p, !0, !0, !0) && (f = e.tag !== null && e.tag !== "?" || e.dump && e.dump.length > 1024, f && (e.dump && xr === e.dump.charCodeAt(0) ? d += "?" : d += "? "), d += e.dump, f && (d += Ro(e, t)), nt(e, t + 1, c, !0, f) && (e.dump && xr === e.dump.charCodeAt(0) ? d += ":" : d += ": ", d += e.dump, i += d));
  e.tag = o, e.dump = i || "{}";
}
function Os(e, t, r) {
  var n, i, o, a, s, l;
  for (i = r ? e.explicitTypes : e.implicitTypes, o = 0, a = i.length; o < a; o += 1)
    if (s = i[o], (s.instanceOf || s.predicate) && (!s.instanceOf || typeof t == "object" && t instanceof s.instanceOf) && (!s.predicate || s.predicate(t))) {
      if (r ? s.multi && s.representName ? e.tag = s.representName(t) : e.tag = s.tag : e.tag = "?", s.represent) {
        if (l = e.styleMap[s.tag] || s.defaultStyle, Ru.call(s.represent) === "[object Function]")
          n = s.represent(t, l);
        else if (Iu.call(s.represent, l))
          n = s.represent[l](t, l);
        else
          throw new Jr("!<" + s.tag + '> tag resolver accepts not "' + l + '" style');
        e.dump = n;
      }
      return !0;
    }
  return !1;
}
function nt(e, t, r, n, i, o, a) {
  e.tag = null, e.dump = r, Os(e, r, !1) || Os(e, r, !0);
  var s = Ru.call(e.dump), l = n, p;
  n && (n = e.flowLevel < 0 || e.flowLevel > t);
  var c = s === "[object Object]" || s === "[object Array]", f, d;
  if (c && (f = e.duplicates.indexOf(r), d = f !== -1), (e.tag !== null && e.tag !== "?" || d || e.indent !== 2 && t > 0) && (i = !1), d && e.usedDuplicates[f])
    e.dump = "*ref_" + f;
  else {
    if (c && d && !e.usedDuplicates[f] && (e.usedDuplicates[f] = !0), s === "[object Object]")
      n && Object.keys(e.dump).length !== 0 ? (H0(e, t, e.dump, i), d && (e.dump = "&ref_" + f + e.dump)) : (j0(e, t, e.dump), d && (e.dump = "&ref_" + f + " " + e.dump));
    else if (s === "[object Array]")
      n && e.dump.length !== 0 ? (e.noArrayIndent && !a && t > 0 ? Cs(e, t - 1, e.dump, i) : Cs(e, t, e.dump, i), d && (e.dump = "&ref_" + f + e.dump)) : (B0(e, t, e.dump), d && (e.dump = "&ref_" + f + " " + e.dump));
    else if (s === "[object String]")
      e.tag !== "?" && U0(e, e.dump, t, o, l);
    else {
      if (s === "[object Undefined]")
        return !1;
      if (e.skipInvalid) return !1;
      throw new Jr("unacceptable kind of an object to dump " + s);
    }
    e.tag !== null && e.tag !== "?" && (p = encodeURI(
      e.tag[0] === "!" ? e.tag.slice(1) : e.tag
    ).replace(/!/g, "%21"), e.tag[0] === "!" ? p = "!" + p : p.slice(0, 18) === "tag:yaml.org,2002:" ? p = "!!" + p.slice(18) : p = "!<" + p + ">", e.dump = p + " " + e.dump);
  }
  return !0;
}
function q0(e, t) {
  var r = [], n = [], i, o;
  for (Po(e, r, n), i = 0, o = n.length; i < o; i += 1)
    t.duplicates.push(r[n[i]]);
  t.usedDuplicates = new Array(o);
}
function Po(e, t, r) {
  var n, i, o;
  if (e !== null && typeof e == "object")
    if (i = t.indexOf(e), i !== -1)
      r.indexOf(i) === -1 && r.push(i);
    else if (t.push(e), Array.isArray(e))
      for (i = 0, o = e.length; i < o; i += 1)
        Po(e[i], t, r);
    else
      for (n = Object.keys(e), i = 0, o = n.length; i < o; i += 1)
        Po(e[n[i]], t, r);
}
function G0(e, t) {
  t = t || {};
  var r = new D0(t);
  r.noRefs || q0(e, r);
  var n = e;
  return r.replacer && (n = r.replacer.call({ "": n }, "", n)), nt(r, 0, n, !0, !0) ? r.dump + `
` : "";
}
Ou.dump = G0;
var Mu = Ko, V0 = Ou;
function ra(e, t) {
  return function() {
    throw new Error("Function yaml." + e + " is removed in js-yaml 4. Use yaml." + t + " instead, which is now safe by default.");
  };
}
ge.Type = Ie;
ge.Schema = Jc;
ge.FAILSAFE_SCHEMA = tu;
ge.JSON_SCHEMA = su;
ge.CORE_SCHEMA = lu;
ge.DEFAULT_SCHEMA = Qo;
ge.load = Mu.load;
ge.loadAll = Mu.loadAll;
ge.dump = V0.dump;
ge.YAMLException = Kr;
ge.types = {
  binary: hu,
  float: au,
  map: eu,
  null: ru,
  pairs: mu,
  set: gu,
  timestamp: fu,
  bool: nu,
  int: iu,
  merge: du,
  omap: pu,
  seq: Zc,
  str: Qc
};
ge.safeLoad = ra("safeLoad", "load");
ge.safeLoadAll = ra("safeLoadAll", "loadAll");
ge.safeDump = ra("safeDump", "dump");
var ai = {};
Object.defineProperty(ai, "__esModule", { value: !0 });
ai.Lazy = void 0;
class W0 {
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
ai.Lazy = W0;
var No = { exports: {} };
const Y0 = "2.0.0", Bu = 256, z0 = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
9007199254740991, X0 = 16, K0 = Bu - 6, J0 = [
  "major",
  "premajor",
  "minor",
  "preminor",
  "patch",
  "prepatch",
  "prerelease"
];
var si = {
  MAX_LENGTH: Bu,
  MAX_SAFE_COMPONENT_LENGTH: X0,
  MAX_SAFE_BUILD_LENGTH: K0,
  MAX_SAFE_INTEGER: z0,
  RELEASE_TYPES: J0,
  SEMVER_SPEC_VERSION: Y0,
  FLAG_INCLUDE_PRERELEASE: 1,
  FLAG_LOOSE: 2
};
const Q0 = typeof process == "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...e) => console.error("SEMVER", ...e) : () => {
};
var li = Q0;
(function(e, t) {
  const {
    MAX_SAFE_COMPONENT_LENGTH: r,
    MAX_SAFE_BUILD_LENGTH: n,
    MAX_LENGTH: i
  } = si, o = li;
  t = e.exports = {};
  const a = t.re = [], s = t.safeRe = [], l = t.src = [], p = t.safeSrc = [], c = t.t = {};
  let f = 0;
  const d = "[a-zA-Z0-9-]", h = [
    ["\\s", 1],
    ["\\d", i],
    [d, n]
  ], y = (_) => {
    for (const [T, A] of h)
      _ = _.split(`${T}*`).join(`${T}{0,${A}}`).split(`${T}+`).join(`${T}{1,${A}}`);
    return _;
  }, E = (_, T, A) => {
    const N = y(T), x = f++;
    o(_, x, T), c[_] = x, l[x] = T, p[x] = N, a[x] = new RegExp(T, A ? "g" : void 0), s[x] = new RegExp(N, A ? "g" : void 0);
  };
  E("NUMERICIDENTIFIER", "0|[1-9]\\d*"), E("NUMERICIDENTIFIERLOOSE", "\\d+"), E("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${d}*`), E("MAINVERSION", `(${l[c.NUMERICIDENTIFIER]})\\.(${l[c.NUMERICIDENTIFIER]})\\.(${l[c.NUMERICIDENTIFIER]})`), E("MAINVERSIONLOOSE", `(${l[c.NUMERICIDENTIFIERLOOSE]})\\.(${l[c.NUMERICIDENTIFIERLOOSE]})\\.(${l[c.NUMERICIDENTIFIERLOOSE]})`), E("PRERELEASEIDENTIFIER", `(?:${l[c.NONNUMERICIDENTIFIER]}|${l[c.NUMERICIDENTIFIER]})`), E("PRERELEASEIDENTIFIERLOOSE", `(?:${l[c.NONNUMERICIDENTIFIER]}|${l[c.NUMERICIDENTIFIERLOOSE]})`), E("PRERELEASE", `(?:-(${l[c.PRERELEASEIDENTIFIER]}(?:\\.${l[c.PRERELEASEIDENTIFIER]})*))`), E("PRERELEASELOOSE", `(?:-?(${l[c.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${l[c.PRERELEASEIDENTIFIERLOOSE]})*))`), E("BUILDIDENTIFIER", `${d}+`), E("BUILD", `(?:\\+(${l[c.BUILDIDENTIFIER]}(?:\\.${l[c.BUILDIDENTIFIER]})*))`), E("FULLPLAIN", `v?${l[c.MAINVERSION]}${l[c.PRERELEASE]}?${l[c.BUILD]}?`), E("FULL", `^${l[c.FULLPLAIN]}$`), E("LOOSEPLAIN", `[v=\\s]*${l[c.MAINVERSIONLOOSE]}${l[c.PRERELEASELOOSE]}?${l[c.BUILD]}?`), E("LOOSE", `^${l[c.LOOSEPLAIN]}$`), E("GTLT", "((?:<|>)?=?)"), E("XRANGEIDENTIFIERLOOSE", `${l[c.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`), E("XRANGEIDENTIFIER", `${l[c.NUMERICIDENTIFIER]}|x|X|\\*`), E("XRANGEPLAIN", `[v=\\s]*(${l[c.XRANGEIDENTIFIER]})(?:\\.(${l[c.XRANGEIDENTIFIER]})(?:\\.(${l[c.XRANGEIDENTIFIER]})(?:${l[c.PRERELEASE]})?${l[c.BUILD]}?)?)?`), E("XRANGEPLAINLOOSE", `[v=\\s]*(${l[c.XRANGEIDENTIFIERLOOSE]})(?:\\.(${l[c.XRANGEIDENTIFIERLOOSE]})(?:\\.(${l[c.XRANGEIDENTIFIERLOOSE]})(?:${l[c.PRERELEASELOOSE]})?${l[c.BUILD]}?)?)?`), E("XRANGE", `^${l[c.GTLT]}\\s*${l[c.XRANGEPLAIN]}$`), E("XRANGELOOSE", `^${l[c.GTLT]}\\s*${l[c.XRANGEPLAINLOOSE]}$`), E("COERCEPLAIN", `(^|[^\\d])(\\d{1,${r}})(?:\\.(\\d{1,${r}}))?(?:\\.(\\d{1,${r}}))?`), E("COERCE", `${l[c.COERCEPLAIN]}(?:$|[^\\d])`), E("COERCEFULL", l[c.COERCEPLAIN] + `(?:${l[c.PRERELEASE]})?(?:${l[c.BUILD]})?(?:$|[^\\d])`), E("COERCERTL", l[c.COERCE], !0), E("COERCERTLFULL", l[c.COERCEFULL], !0), E("LONETILDE", "(?:~>?)"), E("TILDETRIM", `(\\s*)${l[c.LONETILDE]}\\s+`, !0), t.tildeTrimReplace = "$1~", E("TILDE", `^${l[c.LONETILDE]}${l[c.XRANGEPLAIN]}$`), E("TILDELOOSE", `^${l[c.LONETILDE]}${l[c.XRANGEPLAINLOOSE]}$`), E("LONECARET", "(?:\\^)"), E("CARETTRIM", `(\\s*)${l[c.LONECARET]}\\s+`, !0), t.caretTrimReplace = "$1^", E("CARET", `^${l[c.LONECARET]}${l[c.XRANGEPLAIN]}$`), E("CARETLOOSE", `^${l[c.LONECARET]}${l[c.XRANGEPLAINLOOSE]}$`), E("COMPARATORLOOSE", `^${l[c.GTLT]}\\s*(${l[c.LOOSEPLAIN]})$|^$`), E("COMPARATOR", `^${l[c.GTLT]}\\s*(${l[c.FULLPLAIN]})$|^$`), E("COMPARATORTRIM", `(\\s*)${l[c.GTLT]}\\s*(${l[c.LOOSEPLAIN]}|${l[c.XRANGEPLAIN]})`, !0), t.comparatorTrimReplace = "$1$2$3", E("HYPHENRANGE", `^\\s*(${l[c.XRANGEPLAIN]})\\s+-\\s+(${l[c.XRANGEPLAIN]})\\s*$`), E("HYPHENRANGELOOSE", `^\\s*(${l[c.XRANGEPLAINLOOSE]})\\s+-\\s+(${l[c.XRANGEPLAINLOOSE]})\\s*$`), E("STAR", "(<|>)?=?\\s*\\*"), E("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$"), E("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
})(No, No.exports);
var Qr = No.exports;
const Z0 = Object.freeze({ loose: !0 }), eE = Object.freeze({}), tE = (e) => e ? typeof e != "object" ? Z0 : e : eE;
var na = tE;
const Rs = /^[0-9]+$/, ju = (e, t) => {
  if (typeof e == "number" && typeof t == "number")
    return e === t ? 0 : e < t ? -1 : 1;
  const r = Rs.test(e), n = Rs.test(t);
  return r && n && (e = +e, t = +t), e === t ? 0 : r && !n ? -1 : n && !r ? 1 : e < t ? -1 : 1;
}, rE = (e, t) => ju(t, e);
var Hu = {
  compareIdentifiers: ju,
  rcompareIdentifiers: rE
};
const vn = li, { MAX_LENGTH: Is, MAX_SAFE_INTEGER: _n } = si, { safeRe: bn, t: Tn } = Qr, nE = na, { compareIdentifiers: ji } = Hu;
let iE = class Ke {
  constructor(t, r) {
    if (r = nE(r), t instanceof Ke) {
      if (t.loose === !!r.loose && t.includePrerelease === !!r.includePrerelease)
        return t;
      t = t.version;
    } else if (typeof t != "string")
      throw new TypeError(`Invalid version. Must be a string. Got type "${typeof t}".`);
    if (t.length > Is)
      throw new TypeError(
        `version is longer than ${Is} characters`
      );
    vn("SemVer", t, r), this.options = r, this.loose = !!r.loose, this.includePrerelease = !!r.includePrerelease;
    const n = t.trim().match(r.loose ? bn[Tn.LOOSE] : bn[Tn.FULL]);
    if (!n)
      throw new TypeError(`Invalid Version: ${t}`);
    if (this.raw = t, this.major = +n[1], this.minor = +n[2], this.patch = +n[3], this.major > _n || this.major < 0)
      throw new TypeError("Invalid major version");
    if (this.minor > _n || this.minor < 0)
      throw new TypeError("Invalid minor version");
    if (this.patch > _n || this.patch < 0)
      throw new TypeError("Invalid patch version");
    n[4] ? this.prerelease = n[4].split(".").map((i) => {
      if (/^[0-9]+$/.test(i)) {
        const o = +i;
        if (o >= 0 && o < _n)
          return o;
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
    if (vn("SemVer.compare", this.version, this.options, t), !(t instanceof Ke)) {
      if (typeof t == "string" && t === this.version)
        return 0;
      t = new Ke(t, this.options);
    }
    return t.version === this.version ? 0 : this.compareMain(t) || this.comparePre(t);
  }
  compareMain(t) {
    return t instanceof Ke || (t = new Ke(t, this.options)), this.major < t.major ? -1 : this.major > t.major ? 1 : this.minor < t.minor ? -1 : this.minor > t.minor ? 1 : this.patch < t.patch ? -1 : this.patch > t.patch ? 1 : 0;
  }
  comparePre(t) {
    if (t instanceof Ke || (t = new Ke(t, this.options)), this.prerelease.length && !t.prerelease.length)
      return -1;
    if (!this.prerelease.length && t.prerelease.length)
      return 1;
    if (!this.prerelease.length && !t.prerelease.length)
      return 0;
    let r = 0;
    do {
      const n = this.prerelease[r], i = t.prerelease[r];
      if (vn("prerelease compare", r, n, i), n === void 0 && i === void 0)
        return 0;
      if (i === void 0)
        return 1;
      if (n === void 0)
        return -1;
      if (n === i)
        continue;
      return ji(n, i);
    } while (++r);
  }
  compareBuild(t) {
    t instanceof Ke || (t = new Ke(t, this.options));
    let r = 0;
    do {
      const n = this.build[r], i = t.build[r];
      if (vn("build compare", r, n, i), n === void 0 && i === void 0)
        return 0;
      if (i === void 0)
        return 1;
      if (n === void 0)
        return -1;
      if (n === i)
        continue;
      return ji(n, i);
    } while (++r);
  }
  // preminor will bump the version up to the next minor release, and immediately
  // down to pre-release. premajor and prepatch work the same way.
  inc(t, r, n) {
    if (t.startsWith("pre")) {
      if (!r && n === !1)
        throw new Error("invalid increment argument: identifier is empty");
      if (r) {
        const i = `-${r}`.match(this.options.loose ? bn[Tn.PRERELEASELOOSE] : bn[Tn.PRERELEASE]);
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
          let o = this.prerelease.length;
          for (; --o >= 0; )
            typeof this.prerelease[o] == "number" && (this.prerelease[o]++, o = -2);
          if (o === -1) {
            if (r === this.prerelease.join(".") && n === !1)
              throw new Error("invalid increment argument: identifier already exists");
            this.prerelease.push(i);
          }
        }
        if (r) {
          let o = [r, i];
          n === !1 && (o = [r]), ji(this.prerelease[0], r) === 0 ? isNaN(this.prerelease[1]) && (this.prerelease = o) : this.prerelease = o;
        }
        break;
      }
      default:
        throw new Error(`invalid increment argument: ${t}`);
    }
    return this.raw = this.format(), this.build.length && (this.raw += `+${this.build.join(".")}`), this;
  }
};
var Pe = iE;
const Ps = Pe, oE = (e, t, r = !1) => {
  if (e instanceof Ps)
    return e;
  try {
    return new Ps(e, t);
  } catch (n) {
    if (!r)
      return null;
    throw n;
  }
};
var fr = oE;
const aE = fr, sE = (e, t) => {
  const r = aE(e, t);
  return r ? r.version : null;
};
var lE = sE;
const cE = fr, uE = (e, t) => {
  const r = cE(e.trim().replace(/^[=v]+/, ""), t);
  return r ? r.version : null;
};
var fE = uE;
const Ns = Pe, dE = (e, t, r, n, i) => {
  typeof r == "string" && (i = n, n = r, r = void 0);
  try {
    return new Ns(
      e instanceof Ns ? e.version : e,
      r
    ).inc(t, n, i).version;
  } catch {
    return null;
  }
};
var hE = dE;
const Ds = fr, pE = (e, t) => {
  const r = Ds(e, null, !0), n = Ds(t, null, !0), i = r.compare(n);
  if (i === 0)
    return null;
  const o = i > 0, a = o ? r : n, s = o ? n : r, l = !!a.prerelease.length;
  if (!!s.prerelease.length && !l) {
    if (!s.patch && !s.minor)
      return "major";
    if (s.compareMain(a) === 0)
      return s.minor && !s.patch ? "minor" : "patch";
  }
  const c = l ? "pre" : "";
  return r.major !== n.major ? c + "major" : r.minor !== n.minor ? c + "minor" : r.patch !== n.patch ? c + "patch" : "prerelease";
};
var mE = pE;
const gE = Pe, EE = (e, t) => new gE(e, t).major;
var yE = EE;
const wE = Pe, vE = (e, t) => new wE(e, t).minor;
var _E = vE;
const bE = Pe, TE = (e, t) => new bE(e, t).patch;
var AE = TE;
const SE = fr, CE = (e, t) => {
  const r = SE(e, t);
  return r && r.prerelease.length ? r.prerelease : null;
};
var OE = CE;
const $s = Pe, RE = (e, t, r) => new $s(e, r).compare(new $s(t, r));
var Ve = RE;
const IE = Ve, PE = (e, t, r) => IE(t, e, r);
var NE = PE;
const DE = Ve, $E = (e, t) => DE(e, t, !0);
var FE = $E;
const Fs = Pe, xE = (e, t, r) => {
  const n = new Fs(e, r), i = new Fs(t, r);
  return n.compare(i) || n.compareBuild(i);
};
var ia = xE;
const LE = ia, UE = (e, t) => e.sort((r, n) => LE(r, n, t));
var kE = UE;
const ME = ia, BE = (e, t) => e.sort((r, n) => ME(n, r, t));
var jE = BE;
const HE = Ve, qE = (e, t, r) => HE(e, t, r) > 0;
var ci = qE;
const GE = Ve, VE = (e, t, r) => GE(e, t, r) < 0;
var oa = VE;
const WE = Ve, YE = (e, t, r) => WE(e, t, r) === 0;
var qu = YE;
const zE = Ve, XE = (e, t, r) => zE(e, t, r) !== 0;
var Gu = XE;
const KE = Ve, JE = (e, t, r) => KE(e, t, r) >= 0;
var aa = JE;
const QE = Ve, ZE = (e, t, r) => QE(e, t, r) <= 0;
var sa = ZE;
const ey = qu, ty = Gu, ry = ci, ny = aa, iy = oa, oy = sa, ay = (e, t, r, n) => {
  switch (t) {
    case "===":
      return typeof e == "object" && (e = e.version), typeof r == "object" && (r = r.version), e === r;
    case "!==":
      return typeof e == "object" && (e = e.version), typeof r == "object" && (r = r.version), e !== r;
    case "":
    case "=":
    case "==":
      return ey(e, r, n);
    case "!=":
      return ty(e, r, n);
    case ">":
      return ry(e, r, n);
    case ">=":
      return ny(e, r, n);
    case "<":
      return iy(e, r, n);
    case "<=":
      return oy(e, r, n);
    default:
      throw new TypeError(`Invalid operator: ${t}`);
  }
};
var Vu = ay;
const sy = Pe, ly = fr, { safeRe: An, t: Sn } = Qr, cy = (e, t) => {
  if (e instanceof sy)
    return e;
  if (typeof e == "number" && (e = String(e)), typeof e != "string")
    return null;
  t = t || {};
  let r = null;
  if (!t.rtl)
    r = e.match(t.includePrerelease ? An[Sn.COERCEFULL] : An[Sn.COERCE]);
  else {
    const l = t.includePrerelease ? An[Sn.COERCERTLFULL] : An[Sn.COERCERTL];
    let p;
    for (; (p = l.exec(e)) && (!r || r.index + r[0].length !== e.length); )
      (!r || p.index + p[0].length !== r.index + r[0].length) && (r = p), l.lastIndex = p.index + p[1].length + p[2].length;
    l.lastIndex = -1;
  }
  if (r === null)
    return null;
  const n = r[2], i = r[3] || "0", o = r[4] || "0", a = t.includePrerelease && r[5] ? `-${r[5]}` : "", s = t.includePrerelease && r[6] ? `+${r[6]}` : "";
  return ly(`${n}.${i}.${o}${a}${s}`, t);
};
var uy = cy;
class fy {
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
var dy = fy, Hi, xs;
function We() {
  if (xs) return Hi;
  xs = 1;
  const e = /\s+/g;
  class t {
    constructor(O, D) {
      if (D = i(D), O instanceof t)
        return O.loose === !!D.loose && O.includePrerelease === !!D.includePrerelease ? O : new t(O.raw, D);
      if (O instanceof o)
        return this.raw = O.value, this.set = [[O]], this.formatted = void 0, this;
      if (this.options = D, this.loose = !!D.loose, this.includePrerelease = !!D.includePrerelease, this.raw = O.trim().replace(e, " "), this.set = this.raw.split("||").map((C) => this.parseRange(C.trim())).filter((C) => C.length), !this.set.length)
        throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
      if (this.set.length > 1) {
        const C = this.set[0];
        if (this.set = this.set.filter(($) => !E($[0])), this.set.length === 0)
          this.set = [C];
        else if (this.set.length > 1) {
          for (const $ of this.set)
            if ($.length === 1 && _($[0])) {
              this.set = [$];
              break;
            }
        }
      }
      this.formatted = void 0;
    }
    get range() {
      if (this.formatted === void 0) {
        this.formatted = "";
        for (let O = 0; O < this.set.length; O++) {
          O > 0 && (this.formatted += "||");
          const D = this.set[O];
          for (let C = 0; C < D.length; C++)
            C > 0 && (this.formatted += " "), this.formatted += D[C].toString().trim();
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
    parseRange(O) {
      const C = ((this.options.includePrerelease && h) | (this.options.loose && y)) + ":" + O, $ = n.get(C);
      if ($)
        return $;
      const P = this.options.loose, k = P ? l[p.HYPHENRANGELOOSE] : l[p.HYPHENRANGE];
      O = O.replace(k, M(this.options.includePrerelease)), a("hyphen replace", O), O = O.replace(l[p.COMPARATORTRIM], c), a("comparator trim", O), O = O.replace(l[p.TILDETRIM], f), a("tilde trim", O), O = O.replace(l[p.CARETTRIM], d), a("caret trim", O);
      let V = O.split(" ").map((U) => A(U, this.options)).join(" ").split(/\s+/).map((U) => B(U, this.options));
      P && (V = V.filter((U) => (a("loose invalid filter", U, this.options), !!U.match(l[p.COMPARATORLOOSE])))), a("range list", V);
      const j = /* @__PURE__ */ new Map(), K = V.map((U) => new o(U, this.options));
      for (const U of K) {
        if (E(U))
          return [U];
        j.set(U.value, U);
      }
      j.size > 1 && j.has("") && j.delete("");
      const ue = [...j.values()];
      return n.set(C, ue), ue;
    }
    intersects(O, D) {
      if (!(O instanceof t))
        throw new TypeError("a Range is required");
      return this.set.some((C) => T(C, D) && O.set.some(($) => T($, D) && C.every((P) => $.every((k) => P.intersects(k, D)))));
    }
    // if ANY of the sets match ALL of its comparators, then pass
    test(O) {
      if (!O)
        return !1;
      if (typeof O == "string")
        try {
          O = new s(O, this.options);
        } catch {
          return !1;
        }
      for (let D = 0; D < this.set.length; D++)
        if (X(this.set[D], O, this.options))
          return !0;
      return !1;
    }
  }
  Hi = t;
  const r = dy, n = new r(), i = na, o = ui(), a = li, s = Pe, {
    safeRe: l,
    t: p,
    comparatorTrimReplace: c,
    tildeTrimReplace: f,
    caretTrimReplace: d
  } = Qr, { FLAG_INCLUDE_PRERELEASE: h, FLAG_LOOSE: y } = si, E = (I) => I.value === "<0.0.0-0", _ = (I) => I.value === "", T = (I, O) => {
    let D = !0;
    const C = I.slice();
    let $ = C.pop();
    for (; D && C.length; )
      D = C.every((P) => $.intersects(P, O)), $ = C.pop();
    return D;
  }, A = (I, O) => (I = I.replace(l[p.BUILD], ""), a("comp", I, O), I = te(I, O), a("caret", I), I = x(I, O), a("tildes", I), I = $e(I, O), a("xrange", I), I = q(I, O), a("stars", I), I), N = (I) => !I || I.toLowerCase() === "x" || I === "*", x = (I, O) => I.trim().split(/\s+/).map((D) => G(D, O)).join(" "), G = (I, O) => {
    const D = O.loose ? l[p.TILDELOOSE] : l[p.TILDE];
    return I.replace(D, (C, $, P, k, V) => {
      a("tilde", I, C, $, P, k, V);
      let j;
      return N($) ? j = "" : N(P) ? j = `>=${$}.0.0 <${+$ + 1}.0.0-0` : N(k) ? j = `>=${$}.${P}.0 <${$}.${+P + 1}.0-0` : V ? (a("replaceTilde pr", V), j = `>=${$}.${P}.${k}-${V} <${$}.${+P + 1}.0-0`) : j = `>=${$}.${P}.${k} <${$}.${+P + 1}.0-0`, a("tilde return", j), j;
    });
  }, te = (I, O) => I.trim().split(/\s+/).map((D) => Y(D, O)).join(" "), Y = (I, O) => {
    a("caret", I, O);
    const D = O.loose ? l[p.CARETLOOSE] : l[p.CARET], C = O.includePrerelease ? "-0" : "";
    return I.replace(D, ($, P, k, V, j) => {
      a("caret", I, $, P, k, V, j);
      let K;
      return N(P) ? K = "" : N(k) ? K = `>=${P}.0.0${C} <${+P + 1}.0.0-0` : N(V) ? P === "0" ? K = `>=${P}.${k}.0${C} <${P}.${+k + 1}.0-0` : K = `>=${P}.${k}.0${C} <${+P + 1}.0.0-0` : j ? (a("replaceCaret pr", j), P === "0" ? k === "0" ? K = `>=${P}.${k}.${V}-${j} <${P}.${k}.${+V + 1}-0` : K = `>=${P}.${k}.${V}-${j} <${P}.${+k + 1}.0-0` : K = `>=${P}.${k}.${V}-${j} <${+P + 1}.0.0-0`) : (a("no pr"), P === "0" ? k === "0" ? K = `>=${P}.${k}.${V}${C} <${P}.${k}.${+V + 1}-0` : K = `>=${P}.${k}.${V}${C} <${P}.${+k + 1}.0-0` : K = `>=${P}.${k}.${V} <${+P + 1}.0.0-0`), a("caret return", K), K;
    });
  }, $e = (I, O) => (a("replaceXRanges", I, O), I.split(/\s+/).map((D) => w(D, O)).join(" ")), w = (I, O) => {
    I = I.trim();
    const D = O.loose ? l[p.XRANGELOOSE] : l[p.XRANGE];
    return I.replace(D, (C, $, P, k, V, j) => {
      a("xRange", I, C, $, P, k, V, j);
      const K = N(P), ue = K || N(k), U = ue || N(V), ze = U;
      return $ === "=" && ze && ($ = ""), j = O.includePrerelease ? "-0" : "", K ? $ === ">" || $ === "<" ? C = "<0.0.0-0" : C = "*" : $ && ze ? (ue && (k = 0), V = 0, $ === ">" ? ($ = ">=", ue ? (P = +P + 1, k = 0, V = 0) : (k = +k + 1, V = 0)) : $ === "<=" && ($ = "<", ue ? P = +P + 1 : k = +k + 1), $ === "<" && (j = "-0"), C = `${$ + P}.${k}.${V}${j}`) : ue ? C = `>=${P}.0.0${j} <${+P + 1}.0.0-0` : U && (C = `>=${P}.${k}.0${j} <${P}.${+k + 1}.0-0`), a("xRange return", C), C;
    });
  }, q = (I, O) => (a("replaceStars", I, O), I.trim().replace(l[p.STAR], "")), B = (I, O) => (a("replaceGTE0", I, O), I.trim().replace(l[O.includePrerelease ? p.GTE0PRE : p.GTE0], "")), M = (I) => (O, D, C, $, P, k, V, j, K, ue, U, ze) => (N(C) ? D = "" : N($) ? D = `>=${C}.0.0${I ? "-0" : ""}` : N(P) ? D = `>=${C}.${$}.0${I ? "-0" : ""}` : k ? D = `>=${D}` : D = `>=${D}${I ? "-0" : ""}`, N(K) ? j = "" : N(ue) ? j = `<${+K + 1}.0.0-0` : N(U) ? j = `<${K}.${+ue + 1}.0-0` : ze ? j = `<=${K}.${ue}.${U}-${ze}` : I ? j = `<${K}.${ue}.${+U + 1}-0` : j = `<=${j}`, `${D} ${j}`.trim()), X = (I, O, D) => {
    for (let C = 0; C < I.length; C++)
      if (!I[C].test(O))
        return !1;
    if (O.prerelease.length && !D.includePrerelease) {
      for (let C = 0; C < I.length; C++)
        if (a(I[C].semver), I[C].semver !== o.ANY && I[C].semver.prerelease.length > 0) {
          const $ = I[C].semver;
          if ($.major === O.major && $.minor === O.minor && $.patch === O.patch)
            return !0;
        }
      return !1;
    }
    return !0;
  };
  return Hi;
}
var qi, Ls;
function ui() {
  if (Ls) return qi;
  Ls = 1;
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
      c = c.trim().split(/\s+/).join(" "), a("comparator", c, f), this.options = f, this.loose = !!f.loose, this.parse(c), this.semver === e ? this.value = "" : this.value = this.operator + this.semver.version, a("comp", this);
    }
    parse(c) {
      const f = this.options.loose ? n[i.COMPARATORLOOSE] : n[i.COMPARATOR], d = c.match(f);
      if (!d)
        throw new TypeError(`Invalid comparator: ${c}`);
      this.operator = d[1] !== void 0 ? d[1] : "", this.operator === "=" && (this.operator = ""), d[2] ? this.semver = new s(d[2], this.options.loose) : this.semver = e;
    }
    toString() {
      return this.value;
    }
    test(c) {
      if (a("Comparator.test", c, this.options.loose), this.semver === e || c === e)
        return !0;
      if (typeof c == "string")
        try {
          c = new s(c, this.options);
        } catch {
          return !1;
        }
      return o(c, this.operator, this.semver, this.options);
    }
    intersects(c, f) {
      if (!(c instanceof t))
        throw new TypeError("a Comparator is required");
      return this.operator === "" ? this.value === "" ? !0 : new l(c.value, f).test(this.value) : c.operator === "" ? c.value === "" ? !0 : new l(this.value, f).test(c.semver) : (f = r(f), f.includePrerelease && (this.value === "<0.0.0-0" || c.value === "<0.0.0-0") || !f.includePrerelease && (this.value.startsWith("<0.0.0") || c.value.startsWith("<0.0.0")) ? !1 : !!(this.operator.startsWith(">") && c.operator.startsWith(">") || this.operator.startsWith("<") && c.operator.startsWith("<") || this.semver.version === c.semver.version && this.operator.includes("=") && c.operator.includes("=") || o(this.semver, "<", c.semver, f) && this.operator.startsWith(">") && c.operator.startsWith("<") || o(this.semver, ">", c.semver, f) && this.operator.startsWith("<") && c.operator.startsWith(">")));
    }
  }
  qi = t;
  const r = na, { safeRe: n, t: i } = Qr, o = Vu, a = li, s = Pe, l = We();
  return qi;
}
const hy = We(), py = (e, t, r) => {
  try {
    t = new hy(t, r);
  } catch {
    return !1;
  }
  return t.test(e);
};
var fi = py;
const my = We(), gy = (e, t) => new my(e, t).set.map((r) => r.map((n) => n.value).join(" ").trim().split(" "));
var Ey = gy;
const yy = Pe, wy = We(), vy = (e, t, r) => {
  let n = null, i = null, o = null;
  try {
    o = new wy(t, r);
  } catch {
    return null;
  }
  return e.forEach((a) => {
    o.test(a) && (!n || i.compare(a) === -1) && (n = a, i = new yy(n, r));
  }), n;
};
var _y = vy;
const by = Pe, Ty = We(), Ay = (e, t, r) => {
  let n = null, i = null, o = null;
  try {
    o = new Ty(t, r);
  } catch {
    return null;
  }
  return e.forEach((a) => {
    o.test(a) && (!n || i.compare(a) === 1) && (n = a, i = new by(n, r));
  }), n;
};
var Sy = Ay;
const Gi = Pe, Cy = We(), Us = ci, Oy = (e, t) => {
  e = new Cy(e, t);
  let r = new Gi("0.0.0");
  if (e.test(r) || (r = new Gi("0.0.0-0"), e.test(r)))
    return r;
  r = null;
  for (let n = 0; n < e.set.length; ++n) {
    const i = e.set[n];
    let o = null;
    i.forEach((a) => {
      const s = new Gi(a.semver.version);
      switch (a.operator) {
        case ">":
          s.prerelease.length === 0 ? s.patch++ : s.prerelease.push(0), s.raw = s.format();
        case "":
        case ">=":
          (!o || Us(s, o)) && (o = s);
          break;
        case "<":
        case "<=":
          break;
        default:
          throw new Error(`Unexpected operation: ${a.operator}`);
      }
    }), o && (!r || Us(r, o)) && (r = o);
  }
  return r && e.test(r) ? r : null;
};
var Ry = Oy;
const Iy = We(), Py = (e, t) => {
  try {
    return new Iy(e, t).range || "*";
  } catch {
    return null;
  }
};
var Ny = Py;
const Dy = Pe, Wu = ui(), { ANY: $y } = Wu, Fy = We(), xy = fi, ks = ci, Ms = oa, Ly = sa, Uy = aa, ky = (e, t, r, n) => {
  e = new Dy(e, n), t = new Fy(t, n);
  let i, o, a, s, l;
  switch (r) {
    case ">":
      i = ks, o = Ly, a = Ms, s = ">", l = ">=";
      break;
    case "<":
      i = Ms, o = Uy, a = ks, s = "<", l = "<=";
      break;
    default:
      throw new TypeError('Must provide a hilo val of "<" or ">"');
  }
  if (xy(e, t, n))
    return !1;
  for (let p = 0; p < t.set.length; ++p) {
    const c = t.set[p];
    let f = null, d = null;
    if (c.forEach((h) => {
      h.semver === $y && (h = new Wu(">=0.0.0")), f = f || h, d = d || h, i(h.semver, f.semver, n) ? f = h : a(h.semver, d.semver, n) && (d = h);
    }), f.operator === s || f.operator === l || (!d.operator || d.operator === s) && o(e, d.semver))
      return !1;
    if (d.operator === l && a(e, d.semver))
      return !1;
  }
  return !0;
};
var la = ky;
const My = la, By = (e, t, r) => My(e, t, ">", r);
var jy = By;
const Hy = la, qy = (e, t, r) => Hy(e, t, "<", r);
var Gy = qy;
const Bs = We(), Vy = (e, t, r) => (e = new Bs(e, r), t = new Bs(t, r), e.intersects(t, r));
var Wy = Vy;
const Yy = fi, zy = Ve;
var Xy = (e, t, r) => {
  const n = [];
  let i = null, o = null;
  const a = e.sort((c, f) => zy(c, f, r));
  for (const c of a)
    Yy(c, t, r) ? (o = c, i || (i = c)) : (o && n.push([i, o]), o = null, i = null);
  i && n.push([i, null]);
  const s = [];
  for (const [c, f] of n)
    c === f ? s.push(c) : !f && c === a[0] ? s.push("*") : f ? c === a[0] ? s.push(`<=${f}`) : s.push(`${c} - ${f}`) : s.push(`>=${c}`);
  const l = s.join(" || "), p = typeof t.raw == "string" ? t.raw : String(t);
  return l.length < p.length ? l : t;
};
const js = We(), ca = ui(), { ANY: Vi } = ca, vr = fi, ua = Ve, Ky = (e, t, r = {}) => {
  if (e === t)
    return !0;
  e = new js(e, r), t = new js(t, r);
  let n = !1;
  e: for (const i of e.set) {
    for (const o of t.set) {
      const a = Qy(i, o, r);
      if (n = n || a !== null, a)
        continue e;
    }
    if (n)
      return !1;
  }
  return !0;
}, Jy = [new ca(">=0.0.0-0")], Hs = [new ca(">=0.0.0")], Qy = (e, t, r) => {
  if (e === t)
    return !0;
  if (e.length === 1 && e[0].semver === Vi) {
    if (t.length === 1 && t[0].semver === Vi)
      return !0;
    r.includePrerelease ? e = Jy : e = Hs;
  }
  if (t.length === 1 && t[0].semver === Vi) {
    if (r.includePrerelease)
      return !0;
    t = Hs;
  }
  const n = /* @__PURE__ */ new Set();
  let i, o;
  for (const h of e)
    h.operator === ">" || h.operator === ">=" ? i = qs(i, h, r) : h.operator === "<" || h.operator === "<=" ? o = Gs(o, h, r) : n.add(h.semver);
  if (n.size > 1)
    return null;
  let a;
  if (i && o) {
    if (a = ua(i.semver, o.semver, r), a > 0)
      return null;
    if (a === 0 && (i.operator !== ">=" || o.operator !== "<="))
      return null;
  }
  for (const h of n) {
    if (i && !vr(h, String(i), r) || o && !vr(h, String(o), r))
      return null;
    for (const y of t)
      if (!vr(h, String(y), r))
        return !1;
    return !0;
  }
  let s, l, p, c, f = o && !r.includePrerelease && o.semver.prerelease.length ? o.semver : !1, d = i && !r.includePrerelease && i.semver.prerelease.length ? i.semver : !1;
  f && f.prerelease.length === 1 && o.operator === "<" && f.prerelease[0] === 0 && (f = !1);
  for (const h of t) {
    if (c = c || h.operator === ">" || h.operator === ">=", p = p || h.operator === "<" || h.operator === "<=", i) {
      if (d && h.semver.prerelease && h.semver.prerelease.length && h.semver.major === d.major && h.semver.minor === d.minor && h.semver.patch === d.patch && (d = !1), h.operator === ">" || h.operator === ">=") {
        if (s = qs(i, h, r), s === h && s !== i)
          return !1;
      } else if (i.operator === ">=" && !vr(i.semver, String(h), r))
        return !1;
    }
    if (o) {
      if (f && h.semver.prerelease && h.semver.prerelease.length && h.semver.major === f.major && h.semver.minor === f.minor && h.semver.patch === f.patch && (f = !1), h.operator === "<" || h.operator === "<=") {
        if (l = Gs(o, h, r), l === h && l !== o)
          return !1;
      } else if (o.operator === "<=" && !vr(o.semver, String(h), r))
        return !1;
    }
    if (!h.operator && (o || i) && a !== 0)
      return !1;
  }
  return !(i && p && !o && a !== 0 || o && c && !i && a !== 0 || d || f);
}, qs = (e, t, r) => {
  if (!e)
    return t;
  const n = ua(e.semver, t.semver, r);
  return n > 0 ? e : n < 0 || t.operator === ">" && e.operator === ">=" ? t : e;
}, Gs = (e, t, r) => {
  if (!e)
    return t;
  const n = ua(e.semver, t.semver, r);
  return n < 0 ? e : n > 0 || t.operator === "<" && e.operator === "<=" ? t : e;
};
var Zy = Ky;
const Wi = Qr, Vs = si, ew = Pe, Ws = Hu, tw = fr, rw = lE, nw = fE, iw = hE, ow = mE, aw = yE, sw = _E, lw = AE, cw = OE, uw = Ve, fw = NE, dw = FE, hw = ia, pw = kE, mw = jE, gw = ci, Ew = oa, yw = qu, ww = Gu, vw = aa, _w = sa, bw = Vu, Tw = uy, Aw = ui(), Sw = We(), Cw = fi, Ow = Ey, Rw = _y, Iw = Sy, Pw = Ry, Nw = Ny, Dw = la, $w = jy, Fw = Gy, xw = Wy, Lw = Xy, Uw = Zy;
var Yu = {
  parse: tw,
  valid: rw,
  clean: nw,
  inc: iw,
  diff: ow,
  major: aw,
  minor: sw,
  patch: lw,
  prerelease: cw,
  compare: uw,
  rcompare: fw,
  compareLoose: dw,
  compareBuild: hw,
  sort: pw,
  rsort: mw,
  gt: gw,
  lt: Ew,
  eq: yw,
  neq: ww,
  gte: vw,
  lte: _w,
  cmp: bw,
  coerce: Tw,
  Comparator: Aw,
  Range: Sw,
  satisfies: Cw,
  toComparators: Ow,
  maxSatisfying: Rw,
  minSatisfying: Iw,
  minVersion: Pw,
  validRange: Nw,
  outside: Dw,
  gtr: $w,
  ltr: Fw,
  intersects: xw,
  simplifyRange: Lw,
  subset: Uw,
  SemVer: ew,
  re: Wi.re,
  src: Wi.src,
  tokens: Wi.t,
  SEMVER_SPEC_VERSION: Vs.SEMVER_SPEC_VERSION,
  RELEASE_TYPES: Vs.RELEASE_TYPES,
  compareIdentifiers: Ws.compareIdentifiers,
  rcompareIdentifiers: Ws.rcompareIdentifiers
}, Zr = {}, zn = { exports: {} };
zn.exports;
(function(e, t) {
  var r = 200, n = "__lodash_hash_undefined__", i = 1, o = 2, a = 9007199254740991, s = "[object Arguments]", l = "[object Array]", p = "[object AsyncFunction]", c = "[object Boolean]", f = "[object Date]", d = "[object Error]", h = "[object Function]", y = "[object GeneratorFunction]", E = "[object Map]", _ = "[object Number]", T = "[object Null]", A = "[object Object]", N = "[object Promise]", x = "[object Proxy]", G = "[object RegExp]", te = "[object Set]", Y = "[object String]", $e = "[object Symbol]", w = "[object Undefined]", q = "[object WeakMap]", B = "[object ArrayBuffer]", M = "[object DataView]", X = "[object Float32Array]", I = "[object Float64Array]", O = "[object Int8Array]", D = "[object Int16Array]", C = "[object Int32Array]", $ = "[object Uint8Array]", P = "[object Uint8ClampedArray]", k = "[object Uint16Array]", V = "[object Uint32Array]", j = /[\\^$.*+?()[\]{}|]/g, K = /^\[object .+?Constructor\]$/, ue = /^(?:0|[1-9]\d*)$/, U = {};
  U[X] = U[I] = U[O] = U[D] = U[C] = U[$] = U[P] = U[k] = U[V] = !0, U[s] = U[l] = U[B] = U[c] = U[M] = U[f] = U[d] = U[h] = U[E] = U[_] = U[A] = U[G] = U[te] = U[Y] = U[q] = !1;
  var ze = typeof Ae == "object" && Ae && Ae.Object === Object && Ae, m = typeof self == "object" && self && self.Object === Object && self, u = ze || m || Function("return this")(), S = t && !t.nodeType && t, b = S && !0 && e && !e.nodeType && e, z = b && b.exports === S, Z = z && ze.process, ie = function() {
    try {
      return Z && Z.binding && Z.binding("util");
    } catch {
    }
  }(), he = ie && ie.isTypedArray;
  function Ee(g, v) {
    for (var R = -1, F = g == null ? 0 : g.length, ee = 0, H = []; ++R < F; ) {
      var oe = g[R];
      v(oe, R, g) && (H[ee++] = oe);
    }
    return H;
  }
  function it(g, v) {
    for (var R = -1, F = v.length, ee = g.length; ++R < F; )
      g[ee + R] = v[R];
    return g;
  }
  function le(g, v) {
    for (var R = -1, F = g == null ? 0 : g.length; ++R < F; )
      if (v(g[R], R, g))
        return !0;
    return !1;
  }
  function ke(g, v) {
    for (var R = -1, F = Array(g); ++R < g; )
      F[R] = v(R);
    return F;
  }
  function _i(g) {
    return function(v) {
      return g(v);
    };
  }
  function nn(g, v) {
    return g.has(v);
  }
  function pr(g, v) {
    return g == null ? void 0 : g[v];
  }
  function on(g) {
    var v = -1, R = Array(g.size);
    return g.forEach(function(F, ee) {
      R[++v] = [ee, F];
    }), R;
  }
  function mf(g, v) {
    return function(R) {
      return g(v(R));
    };
  }
  function gf(g) {
    var v = -1, R = Array(g.size);
    return g.forEach(function(F) {
      R[++v] = F;
    }), R;
  }
  var Ef = Array.prototype, yf = Function.prototype, an = Object.prototype, bi = u["__core-js_shared__"], Ea = yf.toString, Xe = an.hasOwnProperty, ya = function() {
    var g = /[^.]+$/.exec(bi && bi.keys && bi.keys.IE_PROTO || "");
    return g ? "Symbol(src)_1." + g : "";
  }(), wa = an.toString, wf = RegExp(
    "^" + Ea.call(Xe).replace(j, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
  ), va = z ? u.Buffer : void 0, sn = u.Symbol, _a = u.Uint8Array, ba = an.propertyIsEnumerable, vf = Ef.splice, At = sn ? sn.toStringTag : void 0, Ta = Object.getOwnPropertySymbols, _f = va ? va.isBuffer : void 0, bf = mf(Object.keys, Object), Ti = Vt(u, "DataView"), mr = Vt(u, "Map"), Ai = Vt(u, "Promise"), Si = Vt(u, "Set"), Ci = Vt(u, "WeakMap"), gr = Vt(Object, "create"), Tf = Ot(Ti), Af = Ot(mr), Sf = Ot(Ai), Cf = Ot(Si), Of = Ot(Ci), Aa = sn ? sn.prototype : void 0, Oi = Aa ? Aa.valueOf : void 0;
  function St(g) {
    var v = -1, R = g == null ? 0 : g.length;
    for (this.clear(); ++v < R; ) {
      var F = g[v];
      this.set(F[0], F[1]);
    }
  }
  function Rf() {
    this.__data__ = gr ? gr(null) : {}, this.size = 0;
  }
  function If(g) {
    var v = this.has(g) && delete this.__data__[g];
    return this.size -= v ? 1 : 0, v;
  }
  function Pf(g) {
    var v = this.__data__;
    if (gr) {
      var R = v[g];
      return R === n ? void 0 : R;
    }
    return Xe.call(v, g) ? v[g] : void 0;
  }
  function Nf(g) {
    var v = this.__data__;
    return gr ? v[g] !== void 0 : Xe.call(v, g);
  }
  function Df(g, v) {
    var R = this.__data__;
    return this.size += this.has(g) ? 0 : 1, R[g] = gr && v === void 0 ? n : v, this;
  }
  St.prototype.clear = Rf, St.prototype.delete = If, St.prototype.get = Pf, St.prototype.has = Nf, St.prototype.set = Df;
  function Ze(g) {
    var v = -1, R = g == null ? 0 : g.length;
    for (this.clear(); ++v < R; ) {
      var F = g[v];
      this.set(F[0], F[1]);
    }
  }
  function $f() {
    this.__data__ = [], this.size = 0;
  }
  function Ff(g) {
    var v = this.__data__, R = cn(v, g);
    if (R < 0)
      return !1;
    var F = v.length - 1;
    return R == F ? v.pop() : vf.call(v, R, 1), --this.size, !0;
  }
  function xf(g) {
    var v = this.__data__, R = cn(v, g);
    return R < 0 ? void 0 : v[R][1];
  }
  function Lf(g) {
    return cn(this.__data__, g) > -1;
  }
  function Uf(g, v) {
    var R = this.__data__, F = cn(R, g);
    return F < 0 ? (++this.size, R.push([g, v])) : R[F][1] = v, this;
  }
  Ze.prototype.clear = $f, Ze.prototype.delete = Ff, Ze.prototype.get = xf, Ze.prototype.has = Lf, Ze.prototype.set = Uf;
  function Ct(g) {
    var v = -1, R = g == null ? 0 : g.length;
    for (this.clear(); ++v < R; ) {
      var F = g[v];
      this.set(F[0], F[1]);
    }
  }
  function kf() {
    this.size = 0, this.__data__ = {
      hash: new St(),
      map: new (mr || Ze)(),
      string: new St()
    };
  }
  function Mf(g) {
    var v = un(this, g).delete(g);
    return this.size -= v ? 1 : 0, v;
  }
  function Bf(g) {
    return un(this, g).get(g);
  }
  function jf(g) {
    return un(this, g).has(g);
  }
  function Hf(g, v) {
    var R = un(this, g), F = R.size;
    return R.set(g, v), this.size += R.size == F ? 0 : 1, this;
  }
  Ct.prototype.clear = kf, Ct.prototype.delete = Mf, Ct.prototype.get = Bf, Ct.prototype.has = jf, Ct.prototype.set = Hf;
  function ln(g) {
    var v = -1, R = g == null ? 0 : g.length;
    for (this.__data__ = new Ct(); ++v < R; )
      this.add(g[v]);
  }
  function qf(g) {
    return this.__data__.set(g, n), this;
  }
  function Gf(g) {
    return this.__data__.has(g);
  }
  ln.prototype.add = ln.prototype.push = qf, ln.prototype.has = Gf;
  function ot(g) {
    var v = this.__data__ = new Ze(g);
    this.size = v.size;
  }
  function Vf() {
    this.__data__ = new Ze(), this.size = 0;
  }
  function Wf(g) {
    var v = this.__data__, R = v.delete(g);
    return this.size = v.size, R;
  }
  function Yf(g) {
    return this.__data__.get(g);
  }
  function zf(g) {
    return this.__data__.has(g);
  }
  function Xf(g, v) {
    var R = this.__data__;
    if (R instanceof Ze) {
      var F = R.__data__;
      if (!mr || F.length < r - 1)
        return F.push([g, v]), this.size = ++R.size, this;
      R = this.__data__ = new Ct(F);
    }
    return R.set(g, v), this.size = R.size, this;
  }
  ot.prototype.clear = Vf, ot.prototype.delete = Wf, ot.prototype.get = Yf, ot.prototype.has = zf, ot.prototype.set = Xf;
  function Kf(g, v) {
    var R = fn(g), F = !R && fd(g), ee = !R && !F && Ri(g), H = !R && !F && !ee && $a(g), oe = R || F || ee || H, fe = oe ? ke(g.length, String) : [], pe = fe.length;
    for (var re in g)
      Xe.call(g, re) && !(oe && // Safari 9 has enumerable `arguments.length` in strict mode.
      (re == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
      ee && (re == "offset" || re == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
      H && (re == "buffer" || re == "byteLength" || re == "byteOffset") || // Skip index properties.
      ad(re, pe))) && fe.push(re);
    return fe;
  }
  function cn(g, v) {
    for (var R = g.length; R--; )
      if (Ia(g[R][0], v))
        return R;
    return -1;
  }
  function Jf(g, v, R) {
    var F = v(g);
    return fn(g) ? F : it(F, R(g));
  }
  function Er(g) {
    return g == null ? g === void 0 ? w : T : At && At in Object(g) ? id(g) : ud(g);
  }
  function Sa(g) {
    return yr(g) && Er(g) == s;
  }
  function Ca(g, v, R, F, ee) {
    return g === v ? !0 : g == null || v == null || !yr(g) && !yr(v) ? g !== g && v !== v : Qf(g, v, R, F, Ca, ee);
  }
  function Qf(g, v, R, F, ee, H) {
    var oe = fn(g), fe = fn(v), pe = oe ? l : at(g), re = fe ? l : at(v);
    pe = pe == s ? A : pe, re = re == s ? A : re;
    var Fe = pe == A, Me = re == A, ye = pe == re;
    if (ye && Ri(g)) {
      if (!Ri(v))
        return !1;
      oe = !0, Fe = !1;
    }
    if (ye && !Fe)
      return H || (H = new ot()), oe || $a(g) ? Oa(g, v, R, F, ee, H) : rd(g, v, pe, R, F, ee, H);
    if (!(R & i)) {
      var xe = Fe && Xe.call(g, "__wrapped__"), Le = Me && Xe.call(v, "__wrapped__");
      if (xe || Le) {
        var st = xe ? g.value() : g, et = Le ? v.value() : v;
        return H || (H = new ot()), ee(st, et, R, F, H);
      }
    }
    return ye ? (H || (H = new ot()), nd(g, v, R, F, ee, H)) : !1;
  }
  function Zf(g) {
    if (!Da(g) || ld(g))
      return !1;
    var v = Pa(g) ? wf : K;
    return v.test(Ot(g));
  }
  function ed(g) {
    return yr(g) && Na(g.length) && !!U[Er(g)];
  }
  function td(g) {
    if (!cd(g))
      return bf(g);
    var v = [];
    for (var R in Object(g))
      Xe.call(g, R) && R != "constructor" && v.push(R);
    return v;
  }
  function Oa(g, v, R, F, ee, H) {
    var oe = R & i, fe = g.length, pe = v.length;
    if (fe != pe && !(oe && pe > fe))
      return !1;
    var re = H.get(g);
    if (re && H.get(v))
      return re == v;
    var Fe = -1, Me = !0, ye = R & o ? new ln() : void 0;
    for (H.set(g, v), H.set(v, g); ++Fe < fe; ) {
      var xe = g[Fe], Le = v[Fe];
      if (F)
        var st = oe ? F(Le, xe, Fe, v, g, H) : F(xe, Le, Fe, g, v, H);
      if (st !== void 0) {
        if (st)
          continue;
        Me = !1;
        break;
      }
      if (ye) {
        if (!le(v, function(et, Rt) {
          if (!nn(ye, Rt) && (xe === et || ee(xe, et, R, F, H)))
            return ye.push(Rt);
        })) {
          Me = !1;
          break;
        }
      } else if (!(xe === Le || ee(xe, Le, R, F, H))) {
        Me = !1;
        break;
      }
    }
    return H.delete(g), H.delete(v), Me;
  }
  function rd(g, v, R, F, ee, H, oe) {
    switch (R) {
      case M:
        if (g.byteLength != v.byteLength || g.byteOffset != v.byteOffset)
          return !1;
        g = g.buffer, v = v.buffer;
      case B:
        return !(g.byteLength != v.byteLength || !H(new _a(g), new _a(v)));
      case c:
      case f:
      case _:
        return Ia(+g, +v);
      case d:
        return g.name == v.name && g.message == v.message;
      case G:
      case Y:
        return g == v + "";
      case E:
        var fe = on;
      case te:
        var pe = F & i;
        if (fe || (fe = gf), g.size != v.size && !pe)
          return !1;
        var re = oe.get(g);
        if (re)
          return re == v;
        F |= o, oe.set(g, v);
        var Fe = Oa(fe(g), fe(v), F, ee, H, oe);
        return oe.delete(g), Fe;
      case $e:
        if (Oi)
          return Oi.call(g) == Oi.call(v);
    }
    return !1;
  }
  function nd(g, v, R, F, ee, H) {
    var oe = R & i, fe = Ra(g), pe = fe.length, re = Ra(v), Fe = re.length;
    if (pe != Fe && !oe)
      return !1;
    for (var Me = pe; Me--; ) {
      var ye = fe[Me];
      if (!(oe ? ye in v : Xe.call(v, ye)))
        return !1;
    }
    var xe = H.get(g);
    if (xe && H.get(v))
      return xe == v;
    var Le = !0;
    H.set(g, v), H.set(v, g);
    for (var st = oe; ++Me < pe; ) {
      ye = fe[Me];
      var et = g[ye], Rt = v[ye];
      if (F)
        var Fa = oe ? F(Rt, et, ye, v, g, H) : F(et, Rt, ye, g, v, H);
      if (!(Fa === void 0 ? et === Rt || ee(et, Rt, R, F, H) : Fa)) {
        Le = !1;
        break;
      }
      st || (st = ye == "constructor");
    }
    if (Le && !st) {
      var dn = g.constructor, hn = v.constructor;
      dn != hn && "constructor" in g && "constructor" in v && !(typeof dn == "function" && dn instanceof dn && typeof hn == "function" && hn instanceof hn) && (Le = !1);
    }
    return H.delete(g), H.delete(v), Le;
  }
  function Ra(g) {
    return Jf(g, pd, od);
  }
  function un(g, v) {
    var R = g.__data__;
    return sd(v) ? R[typeof v == "string" ? "string" : "hash"] : R.map;
  }
  function Vt(g, v) {
    var R = pr(g, v);
    return Zf(R) ? R : void 0;
  }
  function id(g) {
    var v = Xe.call(g, At), R = g[At];
    try {
      g[At] = void 0;
      var F = !0;
    } catch {
    }
    var ee = wa.call(g);
    return F && (v ? g[At] = R : delete g[At]), ee;
  }
  var od = Ta ? function(g) {
    return g == null ? [] : (g = Object(g), Ee(Ta(g), function(v) {
      return ba.call(g, v);
    }));
  } : md, at = Er;
  (Ti && at(new Ti(new ArrayBuffer(1))) != M || mr && at(new mr()) != E || Ai && at(Ai.resolve()) != N || Si && at(new Si()) != te || Ci && at(new Ci()) != q) && (at = function(g) {
    var v = Er(g), R = v == A ? g.constructor : void 0, F = R ? Ot(R) : "";
    if (F)
      switch (F) {
        case Tf:
          return M;
        case Af:
          return E;
        case Sf:
          return N;
        case Cf:
          return te;
        case Of:
          return q;
      }
    return v;
  });
  function ad(g, v) {
    return v = v ?? a, !!v && (typeof g == "number" || ue.test(g)) && g > -1 && g % 1 == 0 && g < v;
  }
  function sd(g) {
    var v = typeof g;
    return v == "string" || v == "number" || v == "symbol" || v == "boolean" ? g !== "__proto__" : g === null;
  }
  function ld(g) {
    return !!ya && ya in g;
  }
  function cd(g) {
    var v = g && g.constructor, R = typeof v == "function" && v.prototype || an;
    return g === R;
  }
  function ud(g) {
    return wa.call(g);
  }
  function Ot(g) {
    if (g != null) {
      try {
        return Ea.call(g);
      } catch {
      }
      try {
        return g + "";
      } catch {
      }
    }
    return "";
  }
  function Ia(g, v) {
    return g === v || g !== g && v !== v;
  }
  var fd = Sa(/* @__PURE__ */ function() {
    return arguments;
  }()) ? Sa : function(g) {
    return yr(g) && Xe.call(g, "callee") && !ba.call(g, "callee");
  }, fn = Array.isArray;
  function dd(g) {
    return g != null && Na(g.length) && !Pa(g);
  }
  var Ri = _f || gd;
  function hd(g, v) {
    return Ca(g, v);
  }
  function Pa(g) {
    if (!Da(g))
      return !1;
    var v = Er(g);
    return v == h || v == y || v == p || v == x;
  }
  function Na(g) {
    return typeof g == "number" && g > -1 && g % 1 == 0 && g <= a;
  }
  function Da(g) {
    var v = typeof g;
    return g != null && (v == "object" || v == "function");
  }
  function yr(g) {
    return g != null && typeof g == "object";
  }
  var $a = he ? _i(he) : ed;
  function pd(g) {
    return dd(g) ? Kf(g) : td(g);
  }
  function md() {
    return [];
  }
  function gd() {
    return !1;
  }
  e.exports = hd;
})(zn, zn.exports);
var kw = zn.exports;
Object.defineProperty(Zr, "__esModule", { value: !0 });
Zr.DownloadedUpdateHelper = void 0;
Zr.createTempUpdateFile = qw;
const Mw = Vr, Bw = qe, Ys = kw, Pt = bt, Rr = Q;
class jw {
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
    return Rr.join(this.cacheDir, "pending");
  }
  async validateDownloadedPath(t, r, n, i) {
    if (this.versionInfo != null && this.file === t && this.fileInfo != null)
      return Ys(this.versionInfo, r) && Ys(this.fileInfo.info, n.info) && await (0, Pt.pathExists)(t) ? t : null;
    const o = await this.getValidCachedUpdateFile(n, i);
    return o === null ? null : (i.info(`Update has already been downloaded to ${t}).`), this._file = o, o);
  }
  async setDownloadedFile(t, r, n, i, o, a) {
    this._file = t, this._packageFile = r, this.versionInfo = n, this.fileInfo = i, this._downloadedFileInfo = {
      fileName: o,
      sha512: i.info.sha512,
      isAdminRightsRequired: i.info.isAdminRightsRequired === !0
    }, a && await (0, Pt.outputJson)(this.getUpdateInfoFile(), this._downloadedFileInfo);
  }
  async clear() {
    this._file = null, this._packageFile = null, this.versionInfo = null, this.fileInfo = null, await this.cleanCacheDirForPendingUpdate();
  }
  async cleanCacheDirForPendingUpdate() {
    try {
      await (0, Pt.emptyDir)(this.cacheDirForPendingUpdate);
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
    if (!await (0, Pt.pathExists)(n))
      return null;
    let o;
    try {
      o = await (0, Pt.readJson)(n);
    } catch (p) {
      let c = "No cached update info available";
      return p.code !== "ENOENT" && (await this.cleanCacheDirForPendingUpdate(), c += ` (error on read: ${p.message})`), r.info(c), null;
    }
    if (!((o == null ? void 0 : o.fileName) !== null))
      return r.warn("Cached update info is corrupted: no fileName, directory for cached update will be cleaned"), await this.cleanCacheDirForPendingUpdate(), null;
    if (t.info.sha512 !== o.sha512)
      return r.info(`Cached update sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${o.sha512}, expected: ${t.info.sha512}. Directory for cached update will be cleaned`), await this.cleanCacheDirForPendingUpdate(), null;
    const s = Rr.join(this.cacheDirForPendingUpdate, o.fileName);
    if (!await (0, Pt.pathExists)(s))
      return r.info("Cached update file doesn't exist"), null;
    const l = await Hw(s);
    return t.info.sha512 !== l ? (r.warn(`Sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${l}, expected: ${t.info.sha512}`), await this.cleanCacheDirForPendingUpdate(), null) : (this._downloadedFileInfo = o, s);
  }
  getUpdateInfoFile() {
    return Rr.join(this.cacheDirForPendingUpdate, "update-info.json");
  }
}
Zr.DownloadedUpdateHelper = jw;
function Hw(e, t = "sha512", r = "base64", n) {
  return new Promise((i, o) => {
    const a = (0, Mw.createHash)(t);
    a.on("error", o).setEncoding(r), (0, Bw.createReadStream)(e, {
      ...n,
      highWaterMark: 1024 * 1024
      /* better to use more memory but hash faster */
    }).on("error", o).on("end", () => {
      a.end(), i(a.read());
    }).pipe(a, { end: !1 });
  });
}
async function qw(e, t, r) {
  let n = 0, i = Rr.join(t, e);
  for (let o = 0; o < 3; o++)
    try {
      return await (0, Pt.unlink)(i), i;
    } catch (a) {
      if (a.code === "ENOENT")
        return i;
      r.warn(`Error on remove temp update file: ${a}`), i = Rr.join(t, `${n++}-${e}`);
    }
  return i;
}
var di = {}, fa = {};
Object.defineProperty(fa, "__esModule", { value: !0 });
fa.getAppCacheDir = Vw;
const Yi = Q, Gw = Qn;
function Vw() {
  const e = (0, Gw.homedir)();
  let t;
  return process.platform === "win32" ? t = process.env.LOCALAPPDATA || Yi.join(e, "AppData", "Local") : process.platform === "darwin" ? t = Yi.join(e, "Library", "Caches") : t = process.env.XDG_CACHE_HOME || Yi.join(e, ".cache"), t;
}
Object.defineProperty(di, "__esModule", { value: !0 });
di.ElectronAppAdapter = void 0;
const zs = Q, Ww = fa;
class Yw {
  constructor(t = kt.app) {
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
    return this.isPackaged ? zs.join(process.resourcesPath, "app-update.yml") : zs.join(this.app.getAppPath(), "dev-app-update.yml");
  }
  get userDataPath() {
    return this.app.getPath("userData");
  }
  get baseCachePath() {
    return (0, Ww.getAppCacheDir)();
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
di.ElectronAppAdapter = Yw;
var zu = {};
(function(e) {
  Object.defineProperty(e, "__esModule", { value: !0 }), e.ElectronHttpExecutor = e.NET_SESSION_NAME = void 0, e.getNetSession = r;
  const t = ce;
  e.NET_SESSION_NAME = "electron-updater";
  function r() {
    return kt.session.fromPartition(e.NET_SESSION_NAME, {
      cache: !1
    });
  }
  class n extends t.HttpExecutor {
    constructor(o) {
      super(), this.proxyLoginCallback = o, this.cachedSession = null;
    }
    async download(o, a, s) {
      return await s.cancellationToken.createPromise((l, p, c) => {
        const f = {
          headers: s.headers || void 0,
          redirect: "manual"
        };
        (0, t.configureRequestUrl)(o, f), (0, t.configureRequestOptions)(f), this.doDownload(f, {
          destination: a,
          options: s,
          onCancel: c,
          callback: (d) => {
            d == null ? l(a) : p(d);
          },
          responseHandler: null
        }, 0);
      });
    }
    createRequest(o, a) {
      o.headers && o.headers.Host && (o.host = o.headers.Host, delete o.headers.Host), this.cachedSession == null && (this.cachedSession = r());
      const s = kt.net.request({
        ...o,
        session: this.cachedSession
      });
      return s.on("response", a), this.proxyLoginCallback != null && s.on("login", this.proxyLoginCallback), s;
    }
    addRedirectHandlers(o, a, s, l, p) {
      o.on("redirect", (c, f, d) => {
        o.abort(), l > this.maxRedirects ? s(this.createMaxRedirectError()) : p(t.HttpExecutor.prepareRedirectUrlOptions(d, a));
      });
    }
  }
  e.ElectronHttpExecutor = n;
})(zu);
var en = {}, Ye = {};
Object.defineProperty(Ye, "__esModule", { value: !0 });
Ye.newBaseUrl = zw;
Ye.newUrlFromBase = Xw;
Ye.getChannelFilename = Kw;
const Xu = _t;
function zw(e) {
  const t = new Xu.URL(e);
  return t.pathname.endsWith("/") || (t.pathname += "/"), t;
}
function Xw(e, t, r = !1) {
  const n = new Xu.URL(e, t), i = t.search;
  return i != null && i.length !== 0 ? n.search = i : r && (n.search = `noCache=${Date.now().toString(32)}`), n;
}
function Kw(e) {
  return `${e}.yml`;
}
var se = {}, Jw = "[object Symbol]", Ku = /[\\^$.*+?()[\]{}|]/g, Qw = RegExp(Ku.source), Zw = typeof Ae == "object" && Ae && Ae.Object === Object && Ae, ev = typeof self == "object" && self && self.Object === Object && self, tv = Zw || ev || Function("return this")(), rv = Object.prototype, nv = rv.toString, Xs = tv.Symbol, Ks = Xs ? Xs.prototype : void 0, Js = Ks ? Ks.toString : void 0;
function iv(e) {
  if (typeof e == "string")
    return e;
  if (av(e))
    return Js ? Js.call(e) : "";
  var t = e + "";
  return t == "0" && 1 / e == -1 / 0 ? "-0" : t;
}
function ov(e) {
  return !!e && typeof e == "object";
}
function av(e) {
  return typeof e == "symbol" || ov(e) && nv.call(e) == Jw;
}
function sv(e) {
  return e == null ? "" : iv(e);
}
function lv(e) {
  return e = sv(e), e && Qw.test(e) ? e.replace(Ku, "\\$&") : e;
}
var Ju = lv;
Object.defineProperty(se, "__esModule", { value: !0 });
se.Provider = void 0;
se.findFile = hv;
se.parseUpdateInfo = pv;
se.getFileList = Qu;
se.resolveFiles = mv;
const wt = ce, cv = ge, uv = _t, Xn = Ye, fv = Ju;
class dv {
  constructor(t) {
    this.runtimeOptions = t, this.requestHeaders = null, this.executor = t.executor;
  }
  // By default, the blockmap file is in the same directory as the main file
  // But some providers may have a different blockmap file, so we need to override this method
  getBlockMapFiles(t, r, n, i = null) {
    const o = (0, Xn.newUrlFromBase)(`${t.pathname}.blockmap`, t);
    return [(0, Xn.newUrlFromBase)(`${t.pathname.replace(new RegExp(fv(n), "g"), r)}.blockmap`, i ? new uv.URL(i) : t), o];
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
    return this.requestHeaders == null ? r != null && (n.headers = r) : n.headers = r == null ? this.requestHeaders : { ...this.requestHeaders, ...r }, (0, wt.configureRequestUrl)(t, n), n;
  }
}
se.Provider = dv;
function hv(e, t, r) {
  var n;
  if (e.length === 0)
    throw (0, wt.newError)("No files provided", "ERR_UPDATER_NO_FILES_PROVIDED");
  const i = e.filter((a) => a.url.pathname.toLowerCase().endsWith(`.${t.toLowerCase()}`)), o = (n = i.find((a) => [a.url.pathname, a.info.url].some((s) => s.includes(process.arch)))) !== null && n !== void 0 ? n : i.shift();
  return o || (r == null ? e[0] : e.find((a) => !r.some((s) => a.url.pathname.toLowerCase().endsWith(`.${s.toLowerCase()}`))));
}
function pv(e, t, r) {
  if (e == null)
    throw (0, wt.newError)(`Cannot parse update info from ${t} in the latest release artifacts (${r}): rawData: null`, "ERR_UPDATER_INVALID_UPDATE_INFO");
  let n;
  try {
    n = (0, cv.load)(e);
  } catch (i) {
    throw (0, wt.newError)(`Cannot parse update info from ${t} in the latest release artifacts (${r}): ${i.stack || i.message}, rawData: ${e}`, "ERR_UPDATER_INVALID_UPDATE_INFO");
  }
  return n;
}
function Qu(e) {
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
  throw (0, wt.newError)(`No files provided: ${(0, wt.safeStringifyJson)(e)}`, "ERR_UPDATER_NO_FILES_PROVIDED");
}
function mv(e, t, r = (n) => n) {
  const i = Qu(e).map((s) => {
    if (s.sha2 == null && s.sha512 == null)
      throw (0, wt.newError)(`Update info doesn't contain nor sha256 neither sha512 checksum: ${(0, wt.safeStringifyJson)(s)}`, "ERR_UPDATER_NO_CHECKSUM");
    return {
      url: (0, Xn.newUrlFromBase)(r(s.url), t),
      info: s
    };
  }), o = e.packages, a = o == null ? null : o[process.arch] || o.ia32;
  return a != null && (i[0].packageInfo = {
    ...a,
    path: (0, Xn.newUrlFromBase)(r(a.path), t).href
  }), i;
}
Object.defineProperty(en, "__esModule", { value: !0 });
en.GenericProvider = void 0;
const Qs = ce, zi = Ye, Xi = se;
class gv extends Xi.Provider {
  constructor(t, r, n) {
    super(n), this.configuration = t, this.updater = r, this.baseUrl = (0, zi.newBaseUrl)(this.configuration.url);
  }
  get channel() {
    const t = this.updater.channel || this.configuration.channel;
    return t == null ? this.getDefaultChannelName() : this.getCustomChannelName(t);
  }
  async getLatestVersion() {
    const t = (0, zi.getChannelFilename)(this.channel), r = (0, zi.newUrlFromBase)(t, this.baseUrl, this.updater.isAddNoCacheQuery);
    for (let n = 0; ; n++)
      try {
        return (0, Xi.parseUpdateInfo)(await this.httpRequest(r), t, r);
      } catch (i) {
        if (i instanceof Qs.HttpError && i.statusCode === 404)
          throw (0, Qs.newError)(`Cannot find channel "${t}" update info: ${i.stack || i.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
        if (i.code === "ECONNREFUSED" && n < 3) {
          await new Promise((o, a) => {
            try {
              setTimeout(o, 1e3 * n);
            } catch (s) {
              a(s);
            }
          });
          continue;
        }
        throw i;
      }
  }
  resolveFiles(t) {
    return (0, Xi.resolveFiles)(t, this.baseUrl);
  }
}
en.GenericProvider = gv;
var hi = {}, pi = {};
Object.defineProperty(pi, "__esModule", { value: !0 });
pi.BitbucketProvider = void 0;
const Zs = ce, Ki = Ye, Ji = se;
class Ev extends Ji.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      isUseMultipleRangeRequest: !1
    }), this.configuration = t, this.updater = r;
    const { owner: i, slug: o } = t;
    this.baseUrl = (0, Ki.newBaseUrl)(`https://api.bitbucket.org/2.0/repositories/${i}/${o}/downloads`);
  }
  get channel() {
    return this.updater.channel || this.configuration.channel || "latest";
  }
  async getLatestVersion() {
    const t = new Zs.CancellationToken(), r = (0, Ki.getChannelFilename)(this.getCustomChannelName(this.channel)), n = (0, Ki.newUrlFromBase)(r, this.baseUrl, this.updater.isAddNoCacheQuery);
    try {
      const i = await this.httpRequest(n, void 0, t);
      return (0, Ji.parseUpdateInfo)(i, r, n);
    } catch (i) {
      throw (0, Zs.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${i.stack || i.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  resolveFiles(t) {
    return (0, Ji.resolveFiles)(t, this.baseUrl);
  }
  toString() {
    const { owner: t, slug: r } = this.configuration;
    return `Bitbucket (owner: ${t}, slug: ${r}, channel: ${this.channel})`;
  }
}
pi.BitbucketProvider = Ev;
var vt = {};
Object.defineProperty(vt, "__esModule", { value: !0 });
vt.GitHubProvider = vt.BaseGitHubProvider = void 0;
vt.computeReleaseNotes = ef;
const rt = ce, $t = Yu, yv = _t, tr = Ye, Do = se, Qi = /\/tag\/([^/]+)$/;
class Zu extends Do.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      /* because GitHib uses S3 */
      isUseMultipleRangeRequest: !1
    }), this.options = t, this.baseUrl = (0, tr.newBaseUrl)((0, rt.githubUrl)(t, r));
    const i = r === "github.com" ? "api.github.com" : r;
    this.baseApiUrl = (0, tr.newBaseUrl)((0, rt.githubUrl)(t, i));
  }
  computeGithubBasePath(t) {
    const r = this.options.host;
    return r && !["github.com", "api.github.com"].includes(r) ? `/api/v3${t}` : t;
  }
}
vt.BaseGitHubProvider = Zu;
class wv extends Zu {
  constructor(t, r, n) {
    super(t, "github.com", n), this.options = t, this.updater = r;
  }
  get channel() {
    const t = this.updater.channel || this.options.channel;
    return t == null ? this.getDefaultChannelName() : this.getCustomChannelName(t);
  }
  async getLatestVersion() {
    var t, r, n, i, o;
    const a = new rt.CancellationToken(), s = await this.httpRequest((0, tr.newUrlFromBase)(`${this.basePath}.atom`, this.baseUrl), {
      accept: "application/xml, application/atom+xml, text/xml, */*"
    }, a), l = (0, rt.parseXml)(s);
    let p = l.element("entry", !1, "No published versions on GitHub"), c = null;
    try {
      if (this.updater.allowPrerelease) {
        const _ = ((t = this.updater) === null || t === void 0 ? void 0 : t.channel) || ((r = $t.prerelease(this.updater.currentVersion)) === null || r === void 0 ? void 0 : r[0]) || null;
        if (_ === null)
          c = Qi.exec(p.element("link").attribute("href"))[1];
        else
          for (const T of l.getElements("entry")) {
            const A = Qi.exec(T.element("link").attribute("href"));
            if (A === null)
              continue;
            const N = A[1], x = ((n = $t.prerelease(N)) === null || n === void 0 ? void 0 : n[0]) || null, G = !_ || ["alpha", "beta"].includes(_), te = x !== null && !["alpha", "beta"].includes(String(x));
            if (G && !te && !(_ === "beta" && x === "alpha")) {
              c = N;
              break;
            }
            if (x && x === _) {
              c = N;
              break;
            }
          }
      } else {
        c = await this.getLatestTagName(a);
        for (const _ of l.getElements("entry"))
          if (Qi.exec(_.element("link").attribute("href"))[1] === c) {
            p = _;
            break;
          }
      }
    } catch (_) {
      throw (0, rt.newError)(`Cannot parse releases feed: ${_.stack || _.message},
XML:
${s}`, "ERR_UPDATER_INVALID_RELEASE_FEED");
    }
    if (c == null)
      throw (0, rt.newError)("No published versions on GitHub", "ERR_UPDATER_NO_PUBLISHED_VERSIONS");
    let f, d = "", h = "";
    const y = async (_) => {
      d = (0, tr.getChannelFilename)(_), h = (0, tr.newUrlFromBase)(this.getBaseDownloadPath(String(c), d), this.baseUrl);
      const T = this.createRequestOptions(h);
      try {
        return await this.executor.request(T, a);
      } catch (A) {
        throw A instanceof rt.HttpError && A.statusCode === 404 ? (0, rt.newError)(`Cannot find ${d} in the latest release artifacts (${h}): ${A.stack || A.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : A;
      }
    };
    try {
      let _ = this.channel;
      this.updater.allowPrerelease && (!((i = $t.prerelease(c)) === null || i === void 0) && i[0]) && (_ = this.getCustomChannelName(String((o = $t.prerelease(c)) === null || o === void 0 ? void 0 : o[0]))), f = await y(_);
    } catch (_) {
      if (this.updater.allowPrerelease)
        f = await y(this.getDefaultChannelName());
      else
        throw _;
    }
    const E = (0, Do.parseUpdateInfo)(f, d, h);
    return E.releaseName == null && (E.releaseName = p.elementValueOrEmpty("title")), E.releaseNotes == null && (E.releaseNotes = ef(this.updater.currentVersion, this.updater.fullChangelog, l, p)), {
      tag: c,
      ...E
    };
  }
  async getLatestTagName(t) {
    const r = this.options, n = r.host == null || r.host === "github.com" ? (0, tr.newUrlFromBase)(`${this.basePath}/latest`, this.baseUrl) : new yv.URL(`${this.computeGithubBasePath(`/repos/${r.owner}/${r.repo}/releases`)}/latest`, this.baseApiUrl);
    try {
      const i = await this.httpRequest(n, { Accept: "application/json" }, t);
      return i == null ? null : JSON.parse(i).tag_name;
    } catch (i) {
      throw (0, rt.newError)(`Unable to find latest version on GitHub (${n}), please ensure a production release exists: ${i.stack || i.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  get basePath() {
    return `/${this.options.owner}/${this.options.repo}/releases`;
  }
  resolveFiles(t) {
    return (0, Do.resolveFiles)(t, this.baseUrl, (r) => this.getBaseDownloadPath(t.tag, r.replace(/ /g, "-")));
  }
  getBaseDownloadPath(t, r) {
    return `${this.basePath}/download/${t}/${r}`;
  }
}
vt.GitHubProvider = wv;
function el(e) {
  const t = e.elementValueOrEmpty("content");
  return t === "No content." ? "" : t;
}
function ef(e, t, r, n) {
  if (!t)
    return el(n);
  const i = [];
  for (const o of r.getElements("entry")) {
    const a = /\/tag\/v?([^/]+)$/.exec(o.element("link").attribute("href"))[1];
    $t.valid(a) && $t.lt(e, a) && i.push({
      version: a,
      note: el(o)
    });
  }
  return i.sort((o, a) => $t.rcompare(o.version, a.version));
}
var mi = {};
Object.defineProperty(mi, "__esModule", { value: !0 });
mi.GitLabProvider = void 0;
const be = ce, Zi = _t, vv = Ju, Cn = Ye, eo = se;
class _v extends eo.Provider {
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
    const o = t.host || "gitlab.com";
    this.baseApiUrl = (0, Cn.newBaseUrl)(`https://${o}/api/v4`);
  }
  get channel() {
    const t = this.updater.channel || this.options.channel;
    return t == null ? this.getDefaultChannelName() : this.getCustomChannelName(t);
  }
  async getLatestVersion() {
    const t = new be.CancellationToken(), r = (0, Cn.newUrlFromBase)(`projects/${this.options.projectId}/releases/permalink/latest`, this.baseApiUrl);
    let n;
    try {
      const d = { "Content-Type": "application/json", ...this.setAuthHeaderForToken(this.options.token || null) }, h = await this.httpRequest(r, d, t);
      if (!h)
        throw (0, be.newError)("No latest release found", "ERR_UPDATER_NO_PUBLISHED_VERSIONS");
      n = JSON.parse(h);
    } catch (d) {
      throw (0, be.newError)(`Unable to find latest release on GitLab (${r}): ${d.stack || d.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
    const i = n.tag_name;
    let o = null, a = "", s = null;
    const l = async (d) => {
      a = (0, Cn.getChannelFilename)(d);
      const h = n.assets.links.find((E) => E.name === a);
      if (!h)
        throw (0, be.newError)(`Cannot find ${a} in the latest release assets`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
      s = new Zi.URL(h.direct_asset_url);
      const y = this.options.token ? { "PRIVATE-TOKEN": this.options.token } : void 0;
      try {
        const E = await this.httpRequest(s, y, t);
        if (!E)
          throw (0, be.newError)(`Empty response from ${s}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
        return E;
      } catch (E) {
        throw E instanceof be.HttpError && E.statusCode === 404 ? (0, be.newError)(`Cannot find ${a} in the latest release artifacts (${s}): ${E.stack || E.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : E;
      }
    };
    try {
      o = await l(this.channel);
    } catch (d) {
      if (this.channel !== this.getDefaultChannelName())
        o = await l(this.getDefaultChannelName());
      else
        throw d;
    }
    if (!o)
      throw (0, be.newError)(`Unable to parse channel data from ${a}`, "ERR_UPDATER_INVALID_UPDATE_INFO");
    const p = (0, eo.parseUpdateInfo)(o, a, s);
    p.releaseName == null && (p.releaseName = n.name), p.releaseNotes == null && (p.releaseNotes = n.description || null);
    const c = /* @__PURE__ */ new Map();
    for (const d of n.assets.links)
      c.set(this.normalizeFilename(d.name), d.direct_asset_url);
    const f = {
      tag: i,
      assets: c,
      ...p
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
      const o = t.get(i);
      if (o)
        return new Zi.URL(o);
    }
    return null;
  }
  async fetchReleaseInfoByVersion(t) {
    const r = new be.CancellationToken(), n = [`v${t}`, t];
    for (const i of n) {
      const o = (0, Cn.newUrlFromBase)(`projects/${this.options.projectId}/releases/${encodeURIComponent(i)}`, this.baseApiUrl);
      try {
        const a = { "Content-Type": "application/json", ...this.setAuthHeaderForToken(this.options.token || null) }, s = await this.httpRequest(o, a, r);
        if (s)
          return JSON.parse(s);
      } catch (a) {
        if (a instanceof be.HttpError && a.statusCode === 404)
          continue;
        throw (0, be.newError)(`Unable to find release ${i} on GitLab (${o}): ${a.stack || a.message}`, "ERR_UPDATER_RELEASE_NOT_FOUND");
      }
    }
    throw (0, be.newError)(`Unable to find release with version ${t} (tried: ${n.join(", ")}) on GitLab`, "ERR_UPDATER_RELEASE_NOT_FOUND");
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
    let i = null, o = null;
    const a = await this.getVersionInfoForBlockMap(r);
    a && (i = this.findBlockMapInAssets(a, n));
    const s = await this.getVersionInfoForBlockMap(t);
    if (s) {
      const l = n.replace(new RegExp(vv(r), "g"), t);
      o = this.findBlockMapInAssets(s, l);
    }
    return [o, i];
  }
  async getBlockMapFiles(t, r, n, i = null) {
    if (this.options.uploadTarget === "project_upload") {
      const o = t.pathname.split("/").pop() || "", [a, s] = await this.findBlockMapUrlsFromAssets(r, n, o);
      if (!s)
        throw (0, be.newError)(`Cannot find blockmap file for ${n} in GitLab assets`, "ERR_UPDATER_BLOCKMAP_FILE_NOT_FOUND");
      if (!a)
        throw (0, be.newError)(`Cannot find blockmap file for ${r} in GitLab assets`, "ERR_UPDATER_BLOCKMAP_FILE_NOT_FOUND");
      return [a, s];
    } else
      return super.getBlockMapFiles(t, r, n, i);
  }
  resolveFiles(t) {
    return (0, eo.getFileList)(t).map((r) => {
      const i = [
        r.url,
        // Original filename
        this.normalizeFilename(r.url)
        // Normalized filename (spaces/underscores → dashes)
      ].find((a) => t.assets.has(a)), o = i ? t.assets.get(i) : void 0;
      if (!o)
        throw (0, be.newError)(`Cannot find asset "${r.url}" in GitLab release assets. Available assets: ${Array.from(t.assets.keys()).join(", ")}`, "ERR_UPDATER_ASSET_NOT_FOUND");
      return {
        url: new Zi.URL(o),
        info: r
      };
    });
  }
  toString() {
    return `GitLab (projectId: ${this.options.projectId}, channel: ${this.channel})`;
  }
}
mi.GitLabProvider = _v;
var gi = {};
Object.defineProperty(gi, "__esModule", { value: !0 });
gi.KeygenProvider = void 0;
const tl = ce, to = Ye, ro = se;
class bv extends ro.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      isUseMultipleRangeRequest: !1
    }), this.configuration = t, this.updater = r, this.defaultHostname = "api.keygen.sh";
    const i = this.configuration.host || this.defaultHostname;
    this.baseUrl = (0, to.newBaseUrl)(`https://${i}/v1/accounts/${this.configuration.account}/artifacts?product=${this.configuration.product}`);
  }
  get channel() {
    return this.updater.channel || this.configuration.channel || "stable";
  }
  async getLatestVersion() {
    const t = new tl.CancellationToken(), r = (0, to.getChannelFilename)(this.getCustomChannelName(this.channel)), n = (0, to.newUrlFromBase)(r, this.baseUrl, this.updater.isAddNoCacheQuery);
    try {
      const i = await this.httpRequest(n, {
        Accept: "application/vnd.api+json",
        "Keygen-Version": "1.1"
      }, t);
      return (0, ro.parseUpdateInfo)(i, r, n);
    } catch (i) {
      throw (0, tl.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${i.stack || i.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  resolveFiles(t) {
    return (0, ro.resolveFiles)(t, this.baseUrl);
  }
  toString() {
    const { account: t, product: r, platform: n } = this.configuration;
    return `Keygen (account: ${t}, product: ${r}, platform: ${n}, channel: ${this.channel})`;
  }
}
gi.KeygenProvider = bv;
var Ei = {};
Object.defineProperty(Ei, "__esModule", { value: !0 });
Ei.PrivateGitHubProvider = void 0;
const zt = ce, Tv = ge, Av = Q, rl = _t, nl = Ye, Sv = vt, Cv = se;
class Ov extends Sv.BaseGitHubProvider {
  constructor(t, r, n, i) {
    super(t, "api.github.com", i), this.updater = r, this.token = n;
  }
  createRequestOptions(t, r) {
    const n = super.createRequestOptions(t, r);
    return n.redirect = "manual", n;
  }
  async getLatestVersion() {
    const t = new zt.CancellationToken(), r = (0, nl.getChannelFilename)(this.getDefaultChannelName()), n = await this.getLatestVersionInfo(t), i = n.assets.find((s) => s.name === r);
    if (i == null)
      throw (0, zt.newError)(`Cannot find ${r} in the release ${n.html_url || n.name}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
    const o = new rl.URL(i.url);
    let a;
    try {
      a = (0, Tv.load)(await this.httpRequest(o, this.configureHeaders("application/octet-stream"), t));
    } catch (s) {
      throw s instanceof zt.HttpError && s.statusCode === 404 ? (0, zt.newError)(`Cannot find ${r} in the latest release artifacts (${o}): ${s.stack || s.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : s;
    }
    return a.assets = n.assets, a;
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
    const i = (0, nl.newUrlFromBase)(n, this.baseUrl);
    try {
      const o = JSON.parse(await this.httpRequest(i, this.configureHeaders("application/vnd.github.v3+json"), t));
      return r ? o.find((a) => a.prerelease) || o[0] : o;
    } catch (o) {
      throw (0, zt.newError)(`Unable to find latest version on GitHub (${i}), please ensure a production release exists: ${o.stack || o.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  get basePath() {
    return this.computeGithubBasePath(`/repos/${this.options.owner}/${this.options.repo}/releases`);
  }
  resolveFiles(t) {
    return (0, Cv.getFileList)(t).map((r) => {
      const n = Av.posix.basename(r.url).replace(/ /g, "-"), i = t.assets.find((o) => o != null && o.name === n);
      if (i == null)
        throw (0, zt.newError)(`Cannot find asset "${n}" in: ${JSON.stringify(t.assets, null, 2)}`, "ERR_UPDATER_ASSET_NOT_FOUND");
      return {
        url: new rl.URL(i.url),
        info: r
      };
    });
  }
}
Ei.PrivateGitHubProvider = Ov;
Object.defineProperty(hi, "__esModule", { value: !0 });
hi.isUrlProbablySupportMultiRangeRequests = tf;
hi.createClient = $v;
const On = ce, Rv = pi, il = en, Iv = vt, Pv = mi, Nv = gi, Dv = Ei;
function tf(e) {
  return !e.includes("s3.amazonaws.com");
}
function $v(e, t, r) {
  if (typeof e == "string")
    throw (0, On.newError)("Please pass PublishConfiguration object", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
  const n = e.provider;
  switch (n) {
    case "github": {
      const i = e, o = (i.private ? process.env.GH_TOKEN || process.env.GITHUB_TOKEN : null) || i.token;
      return o == null ? new Iv.GitHubProvider(i, t, r) : new Dv.PrivateGitHubProvider(i, t, o, r);
    }
    case "bitbucket":
      return new Rv.BitbucketProvider(e, t, r);
    case "gitlab":
      return new Pv.GitLabProvider(e, t, r);
    case "keygen":
      return new Nv.KeygenProvider(e, t, r);
    case "s3":
    case "spaces":
      return new il.GenericProvider({
        provider: "generic",
        url: (0, On.getS3LikeProviderBaseUrl)(e),
        channel: e.channel || null
      }, t, {
        ...r,
        // https://github.com/minio/minio/issues/5285#issuecomment-350428955
        isUseMultipleRangeRequest: !1
      });
    case "generic": {
      const i = e;
      return new il.GenericProvider(i, t, {
        ...r,
        isUseMultipleRangeRequest: i.useMultipleRangeRequest !== !1 && tf(i.url)
      });
    }
    case "custom": {
      const i = e, o = i.updateProvider;
      if (!o)
        throw (0, On.newError)("Custom provider not specified", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
      return new o(i, t, r);
    }
    default:
      throw (0, On.newError)(`Unsupported provider: ${n}`, "ERR_UPDATER_UNSUPPORTED_PROVIDER");
  }
}
var yi = {}, tn = {}, dr = {}, qt = {};
Object.defineProperty(qt, "__esModule", { value: !0 });
qt.OperationKind = void 0;
qt.computeOperations = Fv;
var Ft;
(function(e) {
  e[e.COPY = 0] = "COPY", e[e.DOWNLOAD = 1] = "DOWNLOAD";
})(Ft || (qt.OperationKind = Ft = {}));
function Fv(e, t, r) {
  const n = al(e.files), i = al(t.files);
  let o = null;
  const a = t.files[0], s = [], l = a.name, p = n.get(l);
  if (p == null)
    throw new Error(`no file ${l} in old blockmap`);
  const c = i.get(l);
  let f = 0;
  const { checksumToOffset: d, checksumToOldSize: h } = Lv(n.get(l), p.offset, r);
  let y = a.offset;
  for (let E = 0; E < c.checksums.length; y += c.sizes[E], E++) {
    const _ = c.sizes[E], T = c.checksums[E];
    let A = d.get(T);
    A != null && h.get(T) !== _ && (r.warn(`Checksum ("${T}") matches, but size differs (old: ${h.get(T)}, new: ${_})`), A = void 0), A === void 0 ? (f++, o != null && o.kind === Ft.DOWNLOAD && o.end === y ? o.end += _ : (o = {
      kind: Ft.DOWNLOAD,
      start: y,
      end: y + _
      // oldBlocks: null,
    }, ol(o, s, T, E))) : o != null && o.kind === Ft.COPY && o.end === A ? o.end += _ : (o = {
      kind: Ft.COPY,
      start: A,
      end: A + _
      // oldBlocks: [checksum]
    }, ol(o, s, T, E));
  }
  return f > 0 && r.info(`File${a.name === "file" ? "" : " " + a.name} has ${f} changed blocks`), s;
}
const xv = process.env.DIFFERENTIAL_DOWNLOAD_PLAN_BUILDER_VALIDATE_RANGES === "true";
function ol(e, t, r, n) {
  if (xv && t.length !== 0) {
    const i = t[t.length - 1];
    if (i.kind === e.kind && e.start < i.end && e.start > i.start) {
      const o = [i.start, i.end, e.start, e.end].reduce((a, s) => a < s ? a : s);
      throw new Error(`operation (block index: ${n}, checksum: ${r}, kind: ${Ft[e.kind]}) overlaps previous operation (checksum: ${r}):
abs: ${i.start} until ${i.end} and ${e.start} until ${e.end}
rel: ${i.start - o} until ${i.end - o} and ${e.start - o} until ${e.end - o}`);
    }
  }
  t.push(e);
}
function Lv(e, t, r) {
  const n = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map();
  let o = t;
  for (let a = 0; a < e.checksums.length; a++) {
    const s = e.checksums[a], l = e.sizes[a], p = i.get(s);
    if (p === void 0)
      n.set(s, o), i.set(s, l);
    else if (r.debug != null) {
      const c = p === l ? "(same size)" : `(size: ${p}, this size: ${l})`;
      r.debug(`${s} duplicated in blockmap ${c}, it doesn't lead to broken differential downloader, just corresponding block will be skipped)`);
    }
    o += l;
  }
  return { checksumToOffset: n, checksumToOldSize: i };
}
function al(e) {
  const t = /* @__PURE__ */ new Map();
  for (const r of e)
    t.set(r.name, r);
  return t;
}
Object.defineProperty(dr, "__esModule", { value: !0 });
dr.DataSplitter = void 0;
dr.copyData = rf;
const Rn = ce, Uv = qe, kv = Gr, Mv = qt, sl = Buffer.from(`\r
\r
`);
var ut;
(function(e) {
  e[e.INIT = 0] = "INIT", e[e.HEADER = 1] = "HEADER", e[e.BODY = 2] = "BODY";
})(ut || (ut = {}));
function rf(e, t, r, n, i) {
  const o = (0, Uv.createReadStream)("", {
    fd: r,
    autoClose: !1,
    start: e.start,
    // end is inclusive
    end: e.end - 1
  });
  o.on("error", n), o.once("end", i), o.pipe(t, {
    end: !1
  });
}
class Bv extends kv.Writable {
  constructor(t, r, n, i, o, a, s, l) {
    super(), this.out = t, this.options = r, this.partIndexToTaskIndex = n, this.partIndexToLength = o, this.finishHandler = a, this.grandTotalBytes = s, this.onProgress = l, this.start = Date.now(), this.nextUpdate = this.start + 1e3, this.transferred = 0, this.delta = 0, this.partIndex = -1, this.headerListBuffer = null, this.readState = ut.INIT, this.ignoreByteCount = 0, this.remainingPartDataCount = 0, this.actualPartLength = 0, this.boundaryLength = i.length + 4, this.ignoreByteCount = this.boundaryLength - 2;
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
      throw (0, Rn.newError)("Internal error", "ERR_DATA_SPLITTER_BYTE_COUNT_MISMATCH");
    if (this.ignoreByteCount > 0) {
      const n = Math.min(this.ignoreByteCount, t.length);
      this.ignoreByteCount -= n, r = n;
    } else if (this.remainingPartDataCount > 0) {
      const n = Math.min(this.remainingPartDataCount, t.length);
      this.remainingPartDataCount -= n, await this.processPartData(t, 0, n), r = n;
    }
    if (r !== t.length) {
      if (this.readState === ut.HEADER) {
        const n = this.searchHeaderListEnd(t, r);
        if (n === -1)
          return;
        r = n, this.readState = ut.BODY, this.headerListBuffer = null;
      }
      for (; ; ) {
        if (this.readState === ut.BODY)
          this.readState = ut.INIT;
        else {
          this.partIndex++;
          let a = this.partIndexToTaskIndex.get(this.partIndex);
          if (a == null)
            if (this.isFinished)
              a = this.options.end;
            else
              throw (0, Rn.newError)("taskIndex is null", "ERR_DATA_SPLITTER_TASK_INDEX_IS_NULL");
          const s = this.partIndex === 0 ? this.options.start : this.partIndexToTaskIndex.get(this.partIndex - 1) + 1;
          if (s < a)
            await this.copyExistingData(s, a);
          else if (s > a)
            throw (0, Rn.newError)("prevTaskIndex must be < taskIndex", "ERR_DATA_SPLITTER_TASK_INDEX_ASSERT_FAILED");
          if (this.isFinished) {
            this.onPartEnd(), this.finishHandler();
            return;
          }
          if (r = this.searchHeaderListEnd(t, r), r === -1) {
            this.readState = ut.HEADER;
            return;
          }
        }
        const n = this.partIndexToLength[this.partIndex], i = r + n, o = Math.min(i, t.length);
        if (await this.processPartStarted(t, r, o), this.remainingPartDataCount = n - (o - r), this.remainingPartDataCount > 0)
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
      const o = () => {
        if (t === r) {
          n();
          return;
        }
        const a = this.options.tasks[t];
        if (a.kind !== Mv.OperationKind.COPY) {
          i(new Error("Task kind must be COPY"));
          return;
        }
        rf(a, this.out, this.options.oldFileFd, i, () => {
          t++, o();
        });
      };
      o();
    });
  }
  searchHeaderListEnd(t, r) {
    const n = t.indexOf(sl, r);
    if (n !== -1)
      return n + sl.length;
    const i = r === 0 ? t : t.slice(r);
    return this.headerListBuffer == null ? this.headerListBuffer = i : this.headerListBuffer = Buffer.concat([this.headerListBuffer, i]), -1;
  }
  onPartEnd() {
    const t = this.partIndexToLength[this.partIndex - 1];
    if (this.actualPartLength !== t)
      throw (0, Rn.newError)(`Expected length: ${t} differs from actual: ${this.actualPartLength}`, "ERR_DATA_SPLITTER_LENGTH_MISMATCH");
    this.actualPartLength = 0;
  }
  processPartStarted(t, r, n) {
    return this.partIndex !== 0 && this.onPartEnd(), this.processPartData(t, r, n);
  }
  processPartData(t, r, n) {
    this.actualPartLength += n - r, this.transferred += n - r, this.delta += n - r;
    const i = this.out;
    return i.write(r === 0 && t.length === n ? t : t.slice(r, n)) ? Promise.resolve() : new Promise((o, a) => {
      i.on("error", a), i.once("drain", () => {
        i.removeListener("error", a), o();
      });
    });
  }
}
dr.DataSplitter = Bv;
var wi = {};
Object.defineProperty(wi, "__esModule", { value: !0 });
wi.executeTasksUsingMultipleRangeRequests = jv;
wi.checkIsRangesSupported = Fo;
const $o = ce, ll = dr, cl = qt;
function jv(e, t, r, n, i) {
  const o = (a) => {
    if (a >= t.length) {
      e.fileMetadataBuffer != null && r.write(e.fileMetadataBuffer), r.end();
      return;
    }
    const s = a + 1e3;
    Hv(e, {
      tasks: t,
      start: a,
      end: Math.min(t.length, s),
      oldFileFd: n
    }, r, () => o(s), i);
  };
  return o;
}
function Hv(e, t, r, n, i) {
  let o = "bytes=", a = 0, s = 0;
  const l = /* @__PURE__ */ new Map(), p = [];
  for (let d = t.start; d < t.end; d++) {
    const h = t.tasks[d];
    h.kind === cl.OperationKind.DOWNLOAD && (o += `${h.start}-${h.end - 1}, `, l.set(a, d), a++, p.push(h.end - h.start), s += h.end - h.start);
  }
  if (a <= 1) {
    const d = (h) => {
      if (h >= t.end) {
        n();
        return;
      }
      const y = t.tasks[h++];
      if (y.kind === cl.OperationKind.COPY)
        (0, ll.copyData)(y, r, t.oldFileFd, i, () => d(h));
      else {
        const E = e.createRequestOptions();
        E.headers.Range = `bytes=${y.start}-${y.end - 1}`;
        const _ = e.httpExecutor.createRequest(E, (T) => {
          T.on("error", i), Fo(T, i) && (T.pipe(r, {
            end: !1
          }), T.once("end", () => d(h)));
        });
        e.httpExecutor.addErrorAndTimeoutHandlers(_, i), _.end();
      }
    };
    d(t.start);
    return;
  }
  const c = e.createRequestOptions();
  c.headers.Range = o.substring(0, o.length - 2);
  const f = e.httpExecutor.createRequest(c, (d) => {
    if (!Fo(d, i))
      return;
    const h = (0, $o.safeGetHeader)(d, "content-type"), y = /^multipart\/.+?\s*;\s*boundary=(?:"([^"]+)"|([^\s";]+))\s*$/i.exec(h);
    if (y == null) {
      i(new Error(`Content-Type "multipart/byteranges" is expected, but got "${h}"`));
      return;
    }
    const E = new ll.DataSplitter(r, t, l, y[1] || y[2], p, n, s, e.options.onProgress);
    E.on("error", i), d.pipe(E), d.on("end", () => {
      setTimeout(() => {
        f.abort(), i(new Error("Response ends without calling any handlers"));
      }, 1e4);
    });
  });
  e.httpExecutor.addErrorAndTimeoutHandlers(f, i), f.end();
}
function Fo(e, t) {
  if (e.statusCode >= 400)
    return t((0, $o.createHttpError)(e)), !1;
  if (e.statusCode !== 206) {
    const r = (0, $o.safeGetHeader)(e, "accept-ranges");
    if (r == null || r === "none")
      return t(new Error(`Server doesn't support Accept-Ranges (response code ${e.statusCode})`)), !1;
  }
  return !0;
}
var vi = {};
Object.defineProperty(vi, "__esModule", { value: !0 });
vi.ProgressDifferentialDownloadCallbackTransform = void 0;
const qv = Gr;
var rr;
(function(e) {
  e[e.COPY = 0] = "COPY", e[e.DOWNLOAD = 1] = "DOWNLOAD";
})(rr || (rr = {}));
class Gv extends qv.Transform {
  constructor(t, r, n) {
    super(), this.progressDifferentialDownloadInfo = t, this.cancellationToken = r, this.onProgress = n, this.start = Date.now(), this.transferred = 0, this.delta = 0, this.expectedBytes = 0, this.index = 0, this.operationType = rr.COPY, this.nextUpdate = this.start + 1e3;
  }
  _transform(t, r, n) {
    if (this.cancellationToken.cancelled) {
      n(new Error("cancelled"), null);
      return;
    }
    if (this.operationType == rr.COPY) {
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
    this.operationType = rr.COPY;
  }
  beginRangeDownload() {
    this.operationType = rr.DOWNLOAD, this.expectedBytes += this.progressDifferentialDownloadInfo.expectedByteCounts[this.index++];
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
vi.ProgressDifferentialDownloadCallbackTransform = Gv;
Object.defineProperty(tn, "__esModule", { value: !0 });
tn.DifferentialDownloader = void 0;
const _r = ce, no = bt, Vv = qe, Wv = dr, Yv = _t, In = qt, ul = wi, zv = vi;
class Xv {
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
    return (0, _r.configureRequestUrl)(this.options.newUrl, t), (0, _r.configureRequestOptions)(t), t;
  }
  doDownload(t, r) {
    if (t.version !== r.version)
      throw new Error(`version is different (${t.version} - ${r.version}), full download is required`);
    const n = this.logger, i = (0, In.computeOperations)(t, r, n);
    n.debug != null && n.debug(JSON.stringify(i, null, 2));
    let o = 0, a = 0;
    for (const l of i) {
      const p = l.end - l.start;
      l.kind === In.OperationKind.DOWNLOAD ? o += p : a += p;
    }
    const s = this.blockAwareFileInfo.size;
    if (o + a + (this.fileMetadataBuffer == null ? 0 : this.fileMetadataBuffer.length) !== s)
      throw new Error(`Internal error, size mismatch: downloadSize: ${o}, copySize: ${a}, newSize: ${s}`);
    return n.info(`Full: ${fl(s)}, To download: ${fl(o)} (${Math.round(o / (s / 100))}%)`), this.downloadFile(i);
  }
  downloadFile(t) {
    const r = [], n = () => Promise.all(r.map((i) => (0, no.close)(i.descriptor).catch((o) => {
      this.logger.error(`cannot close file "${i.path}": ${o}`);
    })));
    return this.doDownloadFile(t, r).then(n).catch((i) => n().catch((o) => {
      try {
        this.logger.error(`cannot close files: ${o}`);
      } catch (a) {
        try {
          console.error(a);
        } catch {
        }
      }
      throw i;
    }).then(() => {
      throw i;
    }));
  }
  async doDownloadFile(t, r) {
    const n = await (0, no.open)(this.options.oldFile, "r");
    r.push({ descriptor: n, path: this.options.oldFile });
    const i = await (0, no.open)(this.options.newFile, "w");
    r.push({ descriptor: i, path: this.options.newFile });
    const o = (0, Vv.createWriteStream)(this.options.newFile, { fd: i });
    await new Promise((a, s) => {
      const l = [];
      let p;
      if (!this.options.isUseMultipleRangeRequest && this.options.onProgress) {
        const T = [];
        let A = 0;
        for (const x of t)
          x.kind === In.OperationKind.DOWNLOAD && (T.push(x.end - x.start), A += x.end - x.start);
        const N = {
          expectedByteCounts: T,
          grandTotal: A
        };
        p = new zv.ProgressDifferentialDownloadCallbackTransform(N, this.options.cancellationToken, this.options.onProgress), l.push(p);
      }
      const c = new _r.DigestTransform(this.blockAwareFileInfo.sha512);
      c.isValidateOnEnd = !1, l.push(c), o.on("finish", () => {
        o.close(() => {
          r.splice(1, 1);
          try {
            c.validate();
          } catch (T) {
            s(T);
            return;
          }
          a(void 0);
        });
      }), l.push(o);
      let f = null;
      for (const T of l)
        T.on("error", s), f == null ? f = T : f = f.pipe(T);
      const d = l[0];
      let h;
      if (this.options.isUseMultipleRangeRequest) {
        h = (0, ul.executeTasksUsingMultipleRangeRequests)(this, t, d, n, s), h(0);
        return;
      }
      let y = 0, E = null;
      this.logger.info(`Differential download: ${this.options.newUrl}`);
      const _ = this.createRequestOptions();
      _.redirect = "manual", h = (T) => {
        var A, N;
        if (T >= t.length) {
          this.fileMetadataBuffer != null && d.write(this.fileMetadataBuffer), d.end();
          return;
        }
        const x = t[T++];
        if (x.kind === In.OperationKind.COPY) {
          p && p.beginFileCopy(), (0, Wv.copyData)(x, d, n, s, () => h(T));
          return;
        }
        const G = `bytes=${x.start}-${x.end - 1}`;
        _.headers.range = G, (N = (A = this.logger) === null || A === void 0 ? void 0 : A.debug) === null || N === void 0 || N.call(A, `download range: ${G}`), p && p.beginRangeDownload();
        const te = this.httpExecutor.createRequest(_, (Y) => {
          Y.on("error", s), Y.on("aborted", () => {
            s(new Error("response has been aborted by the server"));
          }), Y.statusCode >= 400 && s((0, _r.createHttpError)(Y)), Y.pipe(d, {
            end: !1
          }), Y.once("end", () => {
            p && p.endRangeDownload(), ++y === 100 ? (y = 0, setTimeout(() => h(T), 1e3)) : h(T);
          });
        });
        te.on("redirect", (Y, $e, w) => {
          this.logger.info(`Redirect to ${Kv(w)}`), E = w, (0, _r.configureRequestUrl)(new Yv.URL(E), _), te.followRedirect();
        }), this.httpExecutor.addErrorAndTimeoutHandlers(te, s), te.end();
      }, h(0);
    });
  }
  async readRemoteBytes(t, r) {
    const n = Buffer.allocUnsafe(r + 1 - t), i = this.createRequestOptions();
    i.headers.range = `bytes=${t}-${r}`;
    let o = 0;
    if (await this.request(i, (a) => {
      a.copy(n, o), o += a.length;
    }), o !== n.length)
      throw new Error(`Received data length ${o} is not equal to expected ${n.length}`);
    return n;
  }
  request(t, r) {
    return new Promise((n, i) => {
      const o = this.httpExecutor.createRequest(t, (a) => {
        (0, ul.checkIsRangesSupported)(a, i) && (a.on("error", i), a.on("aborted", () => {
          i(new Error("response has been aborted by the server"));
        }), a.on("data", r), a.on("end", () => n()));
      });
      this.httpExecutor.addErrorAndTimeoutHandlers(o, i), o.end();
    });
  }
}
tn.DifferentialDownloader = Xv;
function fl(e, t = " KB") {
  return new Intl.NumberFormat("en").format((e / 1024).toFixed(2)) + t;
}
function Kv(e) {
  const t = e.indexOf("?");
  return t < 0 ? e : e.substring(0, t);
}
Object.defineProperty(yi, "__esModule", { value: !0 });
yi.GenericDifferentialDownloader = void 0;
const Jv = tn;
class Qv extends Jv.DifferentialDownloader {
  download(t, r) {
    return this.doDownload(t, r);
  }
}
yi.GenericDifferentialDownloader = Qv;
var Tt = {};
(function(e) {
  Object.defineProperty(e, "__esModule", { value: !0 }), e.UpdaterSignal = e.UPDATE_DOWNLOADED = e.DOWNLOAD_PROGRESS = e.CancellationToken = void 0, e.addHandler = n;
  const t = ce;
  Object.defineProperty(e, "CancellationToken", { enumerable: !0, get: function() {
    return t.CancellationToken;
  } }), e.DOWNLOAD_PROGRESS = "download-progress", e.UPDATE_DOWNLOADED = "update-downloaded";
  class r {
    constructor(o) {
      this.emitter = o;
    }
    /**
     * Emitted when an authenticating proxy is [asking for user credentials](https://github.com/electron/electron/blob/master/docs/api/client-request.md#event-login).
     */
    login(o) {
      n(this.emitter, "login", o);
    }
    progress(o) {
      n(this.emitter, e.DOWNLOAD_PROGRESS, o);
    }
    updateDownloaded(o) {
      n(this.emitter, e.UPDATE_DOWNLOADED, o);
    }
    updateCancelled(o) {
      n(this.emitter, "update-cancelled", o);
    }
  }
  e.UpdaterSignal = r;
  function n(i, o, a) {
    i.on(o, a);
  }
})(Tt);
Object.defineProperty(gt, "__esModule", { value: !0 });
gt.NoOpLogger = gt.AppUpdater = void 0;
const Te = ce, Zv = Vr, e_ = Qn, t_ = Yl, Be = bt, r_ = ge, io = ai, je = Q, Nt = Yu, dl = Zr, n_ = di, hl = zu, i_ = en, oo = hi, ao = Xl, o_ = yi, Xt = Tt;
class da extends t_.EventEmitter {
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
        throw (0, Te.newError)(`Channel must be a string, but got: ${t}`, "ERR_UPDATER_INVALID_CHANNEL");
      if (t.length === 0)
        throw (0, Te.newError)("Channel must be not an empty string", "ERR_UPDATER_INVALID_CHANNEL");
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
    return (0, hl.getNetSession)();
  }
  /**
   * The logger. You can pass [electron-log](https://github.com/megahertz/electron-log), [winston](https://github.com/winstonjs/winston) or another logger with the following interface: `{ info(), warn(), error() }`.
   * Set it to `null` if you would like to disable a logging feature.
   */
  get logger() {
    return this._logger;
  }
  set logger(t) {
    this._logger = t ?? new nf();
  }
  // noinspection JSUnusedGlobalSymbols
  /**
   * test only
   * @private
   */
  set updateConfigPath(t) {
    this.clientPromise = null, this._appUpdateConfigPath = t, this.configOnDisk = new io.Lazy(() => this.loadUpdateConfig());
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
    super(), this.autoDownload = !0, this.autoInstallOnAppQuit = !0, this.autoRunAppAfterInstall = !0, this.allowPrerelease = !1, this.fullChangelog = !1, this.allowDowngrade = !1, this.disableWebInstaller = !1, this.disableDifferentialDownload = !1, this.forceDevUpdateConfig = !1, this.previousBlockmapBaseUrlOverride = null, this._channel = null, this.downloadedUpdateHelper = null, this.requestHeaders = null, this._logger = console, this.signals = new Xt.UpdaterSignal(this), this._appUpdateConfigPath = null, this._isUpdateSupported = (o) => this.checkIfUpdateSupported(o), this._isUserWithinRollout = (o) => this.isStagingMatch(o), this.clientPromise = null, this.stagingUserIdPromise = new io.Lazy(() => this.getOrCreateStagingUserId()), this.configOnDisk = new io.Lazy(() => this.loadUpdateConfig()), this.checkForUpdatesPromise = null, this.downloadPromise = null, this.updateInfoAndProvider = null, this._testOnlyOptions = null, this.on("error", (o) => {
      this._logger.error(`Error: ${o.stack || o.message}`);
    }), r == null ? (this.app = new n_.ElectronAppAdapter(), this.httpExecutor = new hl.ElectronHttpExecutor((o, a) => this.emit("login", o, a))) : (this.app = r, this.httpExecutor = null);
    const n = this.app.version, i = (0, Nt.parse)(n);
    if (i == null)
      throw (0, Te.newError)(`App version is not a valid semver version: "${n}"`, "ERR_UPDATER_INVALID_VERSION");
    this.currentVersion = i, this.allowPrerelease = a_(i), t != null && (this.setFeedURL(t), typeof t != "string" && t.requestHeaders && (this.requestHeaders = t.requestHeaders));
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
    typeof t == "string" ? n = new i_.GenericProvider({ provider: "generic", url: t }, this, {
      ...r,
      isUseMultipleRangeRequest: (0, oo.isUrlProbablySupportMultiRangeRequests)(t)
    }) : n = (0, oo.createClient)(t, this, r), this.clientPromise = Promise.resolve(n);
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
      const n = da.formatDownloadNotification(r.updateInfo.version, this.app.name, t);
      new kt.Notification(n).show();
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
    const i = await this.stagingUserIdPromise.value, a = Te.UUID.parse(i).readUInt32BE(12) / 4294967295;
    return this._logger.info(`Staging percentage: ${n}, percentage: ${a}, user id: ${i}`), a < n;
  }
  computeFinalHeaders(t) {
    return this.requestHeaders != null && Object.assign(t, this.requestHeaders), t;
  }
  async isUpdateAvailable(t) {
    const r = (0, Nt.parse)(t.version);
    if (r == null)
      throw (0, Te.newError)(`This file could not be downloaded, or the latest version (from update server) does not have a valid semver version: "${t.version}"`, "ERR_UPDATER_INVALID_VERSION");
    const n = this.currentVersion;
    if ((0, Nt.eq)(r, n) || !await Promise.resolve(this.isUpdateSupported(t)) || !await Promise.resolve(this.isUserWithinRollout(t)))
      return !1;
    const o = (0, Nt.gt)(r, n), a = (0, Nt.lt)(r, n);
    return o ? !0 : this.allowDowngrade && a;
  }
  checkIfUpdateSupported(t) {
    const r = t == null ? void 0 : t.minimumSystemVersion, n = (0, e_.release)();
    if (r)
      try {
        if ((0, Nt.lt)(n, r))
          return this._logger.info(`Current OS version ${n} is less than the minimum OS version required ${r} for version ${n}`), !1;
      } catch (i) {
        this._logger.warn(`Failed to compare current OS version(${n}) with minimum OS version(${r}): ${(i.message || i).toString()}`);
      }
    return !0;
  }
  async getUpdateInfoAndProvider() {
    await this.app.whenReady(), this.clientPromise == null && (this.clientPromise = this.configOnDisk.value.then((n) => (0, oo.createClient)(n, this, this.createProviderRuntimeOptions())));
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
    const n = new Te.CancellationToken();
    return {
      isUpdateAvailable: !0,
      versionInfo: r,
      updateInfo: r,
      cancellationToken: n,
      downloadPromise: this.autoDownload ? this.downloadUpdate(n) : null
    };
  }
  onUpdateAvailable(t) {
    this._logger.info(`Found version ${t.version} (url: ${(0, Te.asArray)(t.files).map((r) => r.url).join(", ")})`), this.emit("update-available", t);
  }
  /**
   * Start downloading update manually. You can use this method if `autoDownload` option is set to `false`.
   * @returns {Promise<Array<string>>} Paths to downloaded files.
   */
  downloadUpdate(t = new Te.CancellationToken()) {
    const r = this.updateInfoAndProvider;
    if (r == null) {
      const i = new Error("Please check update first");
      return this.dispatchError(i), Promise.reject(i);
    }
    if (this.downloadPromise != null)
      return this._logger.info("Downloading update (already in progress)"), this.downloadPromise;
    this._logger.info(`Downloading update from ${(0, Te.asArray)(r.info.files).map((i) => i.url).join(", ")}`);
    const n = (i) => {
      if (!(i instanceof Te.CancellationError))
        try {
          this.dispatchError(i);
        } catch (o) {
          this._logger.warn(`Cannot dispatch error event: ${o.stack || o}`);
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
    this.emit(Xt.UPDATE_DOWNLOADED, t);
  }
  async loadUpdateConfig() {
    return this._appUpdateConfigPath == null && (this._appUpdateConfigPath = this.app.appUpdateConfigPath), (0, r_.load)(await (0, Be.readFile)(this._appUpdateConfigPath, "utf-8"));
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
    const t = je.join(this.app.userDataPath, ".updaterId");
    try {
      const n = await (0, Be.readFile)(t, "utf-8");
      if (Te.UUID.check(n))
        return n;
      this._logger.warn(`Staging user id file exists, but content was invalid: ${n}`);
    } catch (n) {
      n.code !== "ENOENT" && this._logger.warn(`Couldn't read staging user ID, creating a blank one: ${n}`);
    }
    const r = Te.UUID.v5((0, Zv.randomBytes)(4096), Te.UUID.OID);
    this._logger.info(`Generated new staging user ID: ${r}`);
    try {
      await (0, Be.outputFile)(t, r);
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
      const i = je.join(this.app.baseCachePath, r || this.app.name);
      n.debug != null && n.debug(`updater cache dir: ${i}`), t = new dl.DownloadedUpdateHelper(i), this.downloadedUpdateHelper = t;
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
    this.listenerCount(Xt.DOWNLOAD_PROGRESS) > 0 && (n.onProgress = (A) => this.emit(Xt.DOWNLOAD_PROGRESS, A));
    const i = t.downloadUpdateOptions.updateInfoAndProvider.info, o = i.version, a = r.packageInfo;
    function s() {
      const A = decodeURIComponent(t.fileInfo.url.pathname);
      return A.toLowerCase().endsWith(`.${t.fileExtension.toLowerCase()}`) ? je.basename(A) : t.fileInfo.info.url;
    }
    const l = await this.getOrCreateDownloadHelper(), p = l.cacheDirForPendingUpdate;
    await (0, Be.mkdir)(p, { recursive: !0 });
    const c = s();
    let f = je.join(p, c);
    const d = a == null ? null : je.join(p, `package-${o}${je.extname(a.path) || ".7z"}`), h = async (A) => {
      await l.setDownloadedFile(f, d, i, r, c, A), await t.done({
        ...i,
        downloadedFile: f
      });
      const N = je.join(p, "current.blockmap");
      return await (0, Be.pathExists)(N) && await (0, Be.copyFile)(N, je.join(l.cacheDir, "current.blockmap")), d == null ? [f] : [f, d];
    }, y = this._logger, E = await l.validateDownloadedPath(f, i, r, y);
    if (E != null)
      return f = E, await h(!1);
    const _ = async () => (await l.clear().catch(() => {
    }), await (0, Be.unlink)(f).catch(() => {
    })), T = await (0, dl.createTempUpdateFile)(`temp-${c}`, p, y);
    try {
      await t.task(T, n, d, _), await (0, Te.retry)(() => (0, Be.rename)(T, f), {
        retries: 60,
        interval: 500,
        shouldRetry: (A) => A instanceof Error && /^EBUSY:/.test(A.message) ? !0 : (y.warn(`Cannot rename temp file to final file: ${A.message || A.stack}`), !1)
      });
    } catch (A) {
      throw await _(), A instanceof Te.CancellationError && (y.info("cancelled"), this.emit("update-cancelled", i)), A;
    }
    return y.info(`New version ${o} has been downloaded to ${f}`), await h(!0);
  }
  async differentialDownloadInstaller(t, r, n, i, o) {
    try {
      if (this._testOnlyOptions != null && !this._testOnlyOptions.isUseDifferentialDownload)
        return !0;
      const a = r.updateInfoAndProvider.provider, s = await a.getBlockMapFiles(t.url, this.app.version, r.updateInfoAndProvider.info.version, this.previousBlockmapBaseUrlOverride);
      this._logger.info(`Download block maps (old: "${s[0]}", new: ${s[1]})`);
      const l = async (y) => {
        const E = await this.httpExecutor.downloadToBuffer(y, {
          headers: r.requestHeaders,
          cancellationToken: r.cancellationToken
        });
        if (E == null || E.length === 0)
          throw new Error(`Blockmap "${y.href}" is empty`);
        try {
          return JSON.parse((0, ao.gunzipSync)(E).toString());
        } catch (_) {
          throw new Error(`Cannot parse blockmap "${y.href}", error: ${_}`);
        }
      }, p = {
        newUrl: t.url,
        oldFile: je.join(this.downloadedUpdateHelper.cacheDir, o),
        logger: this._logger,
        newFile: n,
        isUseMultipleRangeRequest: a.isUseMultipleRangeRequest,
        requestHeaders: r.requestHeaders,
        cancellationToken: r.cancellationToken
      };
      this.listenerCount(Xt.DOWNLOAD_PROGRESS) > 0 && (p.onProgress = (y) => this.emit(Xt.DOWNLOAD_PROGRESS, y));
      const c = async (y, E) => {
        const _ = je.join(E, "current.blockmap");
        await (0, Be.outputFile)(_, (0, ao.gzipSync)(JSON.stringify(y)));
      }, f = async (y) => {
        const E = je.join(y, "current.blockmap");
        try {
          if (await (0, Be.pathExists)(E))
            return JSON.parse((0, ao.gunzipSync)(await (0, Be.readFile)(E)).toString());
        } catch (_) {
          this._logger.warn(`Cannot parse blockmap "${E}", error: ${_}`);
        }
        return null;
      }, d = await l(s[1]);
      await c(d, this.downloadedUpdateHelper.cacheDirForPendingUpdate);
      let h = await f(this.downloadedUpdateHelper.cacheDir);
      return h == null && (h = await l(s[0])), await new o_.GenericDifferentialDownloader(t.info, this.httpExecutor, p).download(h, d), !1;
    } catch (a) {
      if (this._logger.error(`Cannot download differentially, fallback to full download: ${a.stack || a}`), this._testOnlyOptions != null)
        throw a;
      return !0;
    }
  }
}
gt.AppUpdater = da;
function a_(e) {
  const t = (0, Nt.prerelease)(e);
  return t != null && t.length > 0;
}
class nf {
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
gt.NoOpLogger = nf;
Object.defineProperty(Ht, "__esModule", { value: !0 });
Ht.BaseUpdater = void 0;
const pl = Jn, s_ = gt;
class l_ extends s_.AppUpdater {
  constructor(t, r) {
    super(t, r), this.quitAndInstallCalled = !1, this.quitHandlerAdded = !1;
  }
  quitAndInstall(t = !1, r = !1) {
    this._logger.info("Install on explicit quitAndInstall"), this.install(t, t ? r : this.autoRunAppAfterInstall) ? setImmediate(() => {
      kt.autoUpdater.emit("before-quit-for-update"), this.app.quit();
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
    const n = this.downloadedUpdateHelper, i = this.installerPath, o = n == null ? null : n.downloadedFileInfo;
    if (i == null || o == null)
      return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
    this.quitAndInstallCalled = !0;
    try {
      return this._logger.info(`Install: isSilent: ${t}, isForceRunAfter: ${r}`), this.doInstall({
        isSilent: t,
        isForceRunAfter: r,
        isAdminRightsRequired: o.isAdminRightsRequired
      });
    } catch (a) {
      return this.dispatchError(a), !1;
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
    const i = (0, pl.spawnSync)(t, r, {
      env: { ...process.env, ...n },
      encoding: "utf-8",
      shell: !0
    }), { error: o, status: a, stdout: s, stderr: l } = i;
    if (o != null)
      throw this._logger.error(l), o;
    if (a != null && a !== 0)
      throw this._logger.error(l), new Error(`Command ${t} exited with code ${a}`);
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
    return this._logger.info(`Executing: ${t} with args: ${r}`), new Promise((o, a) => {
      try {
        const s = { stdio: i, env: n, detached: !0 }, l = (0, pl.spawn)(t, r, s);
        l.on("error", (p) => {
          a(p);
        }), l.unref(), l.pid !== void 0 && o(!0);
      } catch (s) {
        a(s);
      }
    });
  }
}
Ht.BaseUpdater = l_;
var kr = {}, rn = {};
Object.defineProperty(rn, "__esModule", { value: !0 });
rn.FileWithEmbeddedBlockMapDifferentialDownloader = void 0;
const Kt = bt, c_ = tn, u_ = Xl;
class f_ extends c_.DifferentialDownloader {
  async download() {
    const t = this.blockAwareFileInfo, r = t.size, n = r - (t.blockMapSize + 4);
    this.fileMetadataBuffer = await this.readRemoteBytes(n, r - 1);
    const i = of(this.fileMetadataBuffer.slice(0, this.fileMetadataBuffer.length - 4));
    await this.doDownload(await d_(this.options.oldFile), i);
  }
}
rn.FileWithEmbeddedBlockMapDifferentialDownloader = f_;
function of(e) {
  return JSON.parse((0, u_.inflateRawSync)(e).toString());
}
async function d_(e) {
  const t = await (0, Kt.open)(e, "r");
  try {
    const r = (await (0, Kt.fstat)(t)).size, n = Buffer.allocUnsafe(4);
    await (0, Kt.read)(t, n, 0, n.length, r - n.length);
    const i = Buffer.allocUnsafe(n.readUInt32BE(0));
    return await (0, Kt.read)(t, i, 0, i.length, r - n.length - i.length), await (0, Kt.close)(t), of(i);
  } catch (r) {
    throw await (0, Kt.close)(t), r;
  }
}
Object.defineProperty(kr, "__esModule", { value: !0 });
kr.AppImageUpdater = void 0;
const ml = ce, gl = Jn, h_ = bt, p_ = qe, br = Q, m_ = Ht, g_ = rn, E_ = se, El = Tt;
class y_ extends m_.BaseUpdater {
  constructor(t, r) {
    super(t, r);
  }
  isUpdaterActive() {
    return process.env.APPIMAGE == null && !this.forceDevUpdateConfig ? (process.env.SNAP == null ? this._logger.warn("APPIMAGE env is not defined, current application is not an AppImage") : this._logger.info("SNAP env is defined, updater is disabled"), !1) : super.isUpdaterActive();
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, E_.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "AppImage", ["rpm", "deb", "pacman"]);
    return this.executeDownload({
      fileExtension: "AppImage",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, o) => {
        const a = process.env.APPIMAGE;
        if (a == null)
          throw (0, ml.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
        (t.disableDifferentialDownload || await this.downloadDifferential(n, a, i, r, t)) && await this.httpExecutor.download(n.url, i, o), await (0, h_.chmod)(i, 493);
      }
    });
  }
  async downloadDifferential(t, r, n, i, o) {
    try {
      const a = {
        newUrl: t.url,
        oldFile: r,
        logger: this._logger,
        newFile: n,
        isUseMultipleRangeRequest: i.isUseMultipleRangeRequest,
        requestHeaders: o.requestHeaders,
        cancellationToken: o.cancellationToken
      };
      return this.listenerCount(El.DOWNLOAD_PROGRESS) > 0 && (a.onProgress = (s) => this.emit(El.DOWNLOAD_PROGRESS, s)), await new g_.FileWithEmbeddedBlockMapDifferentialDownloader(t.info, this.httpExecutor, a).download(), !1;
    } catch (a) {
      return this._logger.error(`Cannot download differentially, fallback to full download: ${a.stack || a}`), process.platform === "linux";
    }
  }
  doInstall(t) {
    const r = process.env.APPIMAGE;
    if (r == null)
      throw (0, ml.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
    (0, p_.unlinkSync)(r);
    let n;
    const i = br.basename(r), o = this.installerPath;
    if (o == null)
      return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
    br.basename(o) === i || !/\d+\.\d+\.\d+/.test(i) ? n = r : n = br.join(br.dirname(r), br.basename(o)), (0, gl.execFileSync)("mv", ["-f", o, n]), n !== r && this.emit("appimage-filename-updated", n);
    const a = {
      ...process.env,
      APPIMAGE_SILENT_INSTALL: "true"
    };
    return t.isForceRunAfter ? this.spawnLog(n, [], a) : (a.APPIMAGE_EXIT_AFTER_INSTALL = "true", (0, gl.execFileSync)(n, [], { env: a })), !0;
  }
}
kr.AppImageUpdater = y_;
var Mr = {}, hr = {};
Object.defineProperty(hr, "__esModule", { value: !0 });
hr.LinuxUpdater = void 0;
const w_ = Ht;
class v_ extends w_.BaseUpdater {
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
    let o = '"';
    return (/pkexec/i.test(i[0]) || i[0] === "sudo") && (o = ""), this.spawnSyncLog(i[0], [...i.length > 1 ? i.slice(1) : [], `${o}/bin/bash`, "-c", `'${t.join(" ")}'${o}`]);
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
hr.LinuxUpdater = v_;
Object.defineProperty(Mr, "__esModule", { value: !0 });
Mr.DebUpdater = void 0;
const __ = se, yl = Tt, b_ = hr;
class ha extends b_.LinuxUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, __.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "deb", ["AppImage", "rpm", "pacman"]);
    return this.executeDownload({
      fileExtension: "deb",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, o) => {
        this.listenerCount(yl.DOWNLOAD_PROGRESS) > 0 && (o.onProgress = (a) => this.emit(yl.DOWNLOAD_PROGRESS, a)), await this.httpExecutor.download(n.url, i, o);
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
      ha.installWithCommandRunner(i, r, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
    } catch (o) {
      return this.dispatchError(o), !1;
    }
    return t.isForceRunAfter && this.app.relaunch(), !0;
  }
  static installWithCommandRunner(t, r, n, i) {
    var o;
    if (t === "dpkg")
      try {
        n(["dpkg", "-i", r]);
      } catch (a) {
        i.warn((o = a.message) !== null && o !== void 0 ? o : a), i.warn("dpkg installation failed, trying to fix broken dependencies with apt-get"), n(["apt-get", "install", "-f", "-y"]);
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
Mr.DebUpdater = ha;
var Br = {};
Object.defineProperty(Br, "__esModule", { value: !0 });
Br.PacmanUpdater = void 0;
const wl = Tt, T_ = se, A_ = hr;
class pa extends A_.LinuxUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, T_.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "pacman", ["AppImage", "deb", "rpm"]);
    return this.executeDownload({
      fileExtension: "pacman",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, o) => {
        this.listenerCount(wl.DOWNLOAD_PROGRESS) > 0 && (o.onProgress = (a) => this.emit(wl.DOWNLOAD_PROGRESS, a)), await this.httpExecutor.download(n.url, i, o);
      }
    });
  }
  doInstall(t) {
    const r = this.installerPath;
    if (r == null)
      return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
    try {
      pa.installWithCommandRunner(r, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
    } catch (n) {
      return this.dispatchError(n), !1;
    }
    return t.isForceRunAfter && this.app.relaunch(), !0;
  }
  static installWithCommandRunner(t, r, n) {
    var i;
    try {
      r(["pacman", "-U", "--noconfirm", t]);
    } catch (o) {
      n.warn((i = o.message) !== null && i !== void 0 ? i : o), n.warn("pacman installation failed, attempting to update package database and retry");
      try {
        r(["pacman", "-Sy", "--noconfirm"]), r(["pacman", "-U", "--noconfirm", t]);
      } catch (a) {
        throw n.error("Retry after pacman -Sy failed"), a;
      }
    }
  }
}
Br.PacmanUpdater = pa;
var jr = {};
Object.defineProperty(jr, "__esModule", { value: !0 });
jr.RpmUpdater = void 0;
const vl = Tt, S_ = se, C_ = hr;
class ma extends C_.LinuxUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, S_.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "rpm", ["AppImage", "deb", "pacman"]);
    return this.executeDownload({
      fileExtension: "rpm",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, o) => {
        this.listenerCount(vl.DOWNLOAD_PROGRESS) > 0 && (o.onProgress = (a) => this.emit(vl.DOWNLOAD_PROGRESS, a)), await this.httpExecutor.download(n.url, i, o);
      }
    });
  }
  doInstall(t) {
    const r = this.installerPath;
    if (r == null)
      return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
    const n = ["zypper", "dnf", "yum", "rpm"], i = this.detectPackageManager(n);
    try {
      ma.installWithCommandRunner(i, r, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
    } catch (o) {
      return this.dispatchError(o), !1;
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
jr.RpmUpdater = ma;
var Hr = {};
Object.defineProperty(Hr, "__esModule", { value: !0 });
Hr.MacUpdater = void 0;
const _l = ce, so = bt, O_ = qe, bl = Q, R_ = wd, I_ = gt, P_ = se, Tl = Jn, Al = Vr;
class N_ extends I_.AppUpdater {
  constructor(t, r) {
    super(t, r), this.nativeUpdater = kt.autoUpdater, this.squirrelDownloadedUpdate = !1, this.nativeUpdater.on("error", (n) => {
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
    let o = !1;
    try {
      this.debug("Checking for macOS Rosetta environment"), o = (0, Tl.execFileSync)("sysctl", [i], { encoding: "utf8" }).includes(`${i}: 1`), n.info(`Checked for macOS Rosetta environment (isRosetta=${o})`);
    } catch (f) {
      n.warn(`sysctl shell command to check for macOS Rosetta environment failed: ${f}`);
    }
    let a = !1;
    try {
      this.debug("Checking for arm64 in uname");
      const d = (0, Tl.execFileSync)("uname", ["-a"], { encoding: "utf8" }).includes("ARM");
      n.info(`Checked 'uname -a': arm64=${d}`), a = a || d;
    } catch (f) {
      n.warn(`uname shell command to check for arm64 failed: ${f}`);
    }
    a = a || process.arch === "arm64" || o;
    const s = (f) => {
      var d;
      return f.url.pathname.includes("arm64") || ((d = f.info.url) === null || d === void 0 ? void 0 : d.includes("arm64"));
    };
    a && r.some(s) ? r = r.filter((f) => a === s(f)) : r = r.filter((f) => !s(f));
    const l = (0, P_.findFile)(r, "zip", ["pkg", "dmg"]);
    if (l == null)
      throw (0, _l.newError)(`ZIP file not provided: ${(0, _l.safeStringifyJson)(r)}`, "ERR_UPDATER_ZIP_FILE_NOT_FOUND");
    const p = t.updateInfoAndProvider.provider, c = "update.zip";
    return this.executeDownload({
      fileExtension: "zip",
      fileInfo: l,
      downloadUpdateOptions: t,
      task: async (f, d) => {
        const h = bl.join(this.downloadedUpdateHelper.cacheDir, c), y = () => (0, so.pathExistsSync)(h) ? !t.disableDifferentialDownload : (n.info("Unable to locate previous update.zip for differential download (is this first install?), falling back to full download"), !1);
        let E = !0;
        y() && (E = await this.differentialDownloadInstaller(l, t, f, p, c)), E && await this.httpExecutor.download(l.url, f, d);
      },
      done: async (f) => {
        if (!t.disableDifferentialDownload)
          try {
            const d = bl.join(this.downloadedUpdateHelper.cacheDir, c);
            await (0, so.copyFile)(f.downloadedFile, d);
          } catch (d) {
            this._logger.warn(`Unable to copy file for caching for future differential downloads: ${d.message}`);
          }
        return this.updateDownloaded(l, f);
      }
    });
  }
  async updateDownloaded(t, r) {
    var n;
    const i = r.downloadedFile, o = (n = t.info.size) !== null && n !== void 0 ? n : (await (0, so.stat)(i)).size, a = this._logger, s = `fileToProxy=${t.url.href}`;
    this.closeServerIfExists(), this.debug(`Creating proxy server for native Squirrel.Mac (${s})`), this.server = (0, R_.createServer)(), this.debug(`Proxy server for native Squirrel.Mac is created (${s})`), this.server.on("close", () => {
      a.info(`Proxy server for native Squirrel.Mac is closed (${s})`);
    });
    const l = (p) => {
      const c = p.address();
      return typeof c == "string" ? c : `http://127.0.0.1:${c == null ? void 0 : c.port}`;
    };
    return await new Promise((p, c) => {
      const f = (0, Al.randomBytes)(64).toString("base64").replace(/\//g, "_").replace(/\+/g, "-"), d = Buffer.from(`autoupdater:${f}`, "ascii"), h = `/${(0, Al.randomBytes)(64).toString("hex")}.zip`;
      this.server.on("request", (y, E) => {
        const _ = y.url;
        if (a.info(`${_} requested`), _ === "/") {
          if (!y.headers.authorization || y.headers.authorization.indexOf("Basic ") === -1) {
            E.statusCode = 401, E.statusMessage = "Invalid Authentication Credentials", E.end(), a.warn("No authenthication info");
            return;
          }
          const N = y.headers.authorization.split(" ")[1], x = Buffer.from(N, "base64").toString("ascii"), [G, te] = x.split(":");
          if (G !== "autoupdater" || te !== f) {
            E.statusCode = 401, E.statusMessage = "Invalid Authentication Credentials", E.end(), a.warn("Invalid authenthication credentials");
            return;
          }
          const Y = Buffer.from(`{ "url": "${l(this.server)}${h}" }`);
          E.writeHead(200, { "Content-Type": "application/json", "Content-Length": Y.length }), E.end(Y);
          return;
        }
        if (!_.startsWith(h)) {
          a.warn(`${_} requested, but not supported`), E.writeHead(404), E.end();
          return;
        }
        a.info(`${h} requested by Squirrel.Mac, pipe ${i}`);
        let T = !1;
        E.on("finish", () => {
          T || (this.nativeUpdater.removeListener("error", c), p([]));
        });
        const A = (0, O_.createReadStream)(i);
        A.on("error", (N) => {
          try {
            E.end();
          } catch (x) {
            a.warn(`cannot end response: ${x}`);
          }
          T = !0, this.nativeUpdater.removeListener("error", c), c(new Error(`Cannot pipe "${i}": ${N}`));
        }), E.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Length": o
        }), A.pipe(E);
      }), this.debug(`Proxy server for native Squirrel.Mac is starting to listen (${s})`), this.server.listen(0, "127.0.0.1", () => {
        this.debug(`Proxy server for native Squirrel.Mac is listening (address=${l(this.server)}, ${s})`), this.nativeUpdater.setFeedURL({
          url: l(this.server),
          headers: {
            "Cache-Control": "no-cache",
            Authorization: `Basic ${d.toString("base64")}`
          }
        }), this.dispatchUpdateDownloaded(r), this.autoInstallOnAppQuit ? (this.nativeUpdater.once("error", c), this.nativeUpdater.checkForUpdates()) : p([]);
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
Hr.MacUpdater = N_;
var qr = {}, ga = {};
Object.defineProperty(ga, "__esModule", { value: !0 });
ga.verifySignature = $_;
const Sl = ce, af = Jn, D_ = Qn, Cl = Q;
function sf(e, t) {
  return ['set "PSModulePath=" & chcp 65001 >NUL & powershell.exe', ["-NoProfile", "-NonInteractive", "-InputFormat", "None", "-Command", e], {
    shell: !0,
    timeout: t
  }];
}
function $_(e, t, r) {
  return new Promise((n, i) => {
    const o = t.replace(/'/g, "''");
    r.info(`Verifying signature ${o}`), (0, af.execFile)(...sf(`"Get-AuthenticodeSignature -LiteralPath '${o}' | ConvertTo-Json -Compress"`, 20 * 1e3), (a, s, l) => {
      var p;
      try {
        if (a != null || l) {
          lo(r, a, l, i), n(null);
          return;
        }
        const c = F_(s);
        if (c.Status === 0) {
          try {
            const y = Cl.normalize(c.Path), E = Cl.normalize(t);
            if (r.info(`LiteralPath: ${y}. Update Path: ${E}`), y !== E) {
              lo(r, new Error(`LiteralPath of ${y} is different than ${E}`), l, i), n(null);
              return;
            }
          } catch (y) {
            r.warn(`Unable to verify LiteralPath of update asset due to missing data.Path. Skipping this step of validation. Message: ${(p = y.message) !== null && p !== void 0 ? p : y.stack}`);
          }
          const d = (0, Sl.parseDn)(c.SignerCertificate.Subject);
          let h = !1;
          for (const y of e) {
            const E = (0, Sl.parseDn)(y);
            if (E.size ? h = Array.from(E.keys()).every((T) => E.get(T) === d.get(T)) : y === d.get("CN") && (r.warn(`Signature validated using only CN ${y}. Please add your full Distinguished Name (DN) to publisherNames configuration`), h = !0), h) {
              n(null);
              return;
            }
          }
        }
        const f = `publisherNames: ${e.join(" | ")}, raw info: ` + JSON.stringify(c, (d, h) => d === "RawData" ? void 0 : h, 2);
        r.warn(`Sign verification failed, installer signed with incorrect certificate: ${f}`), n(f);
      } catch (c) {
        lo(r, c, null, i), n(null);
        return;
      }
    });
  });
}
function F_(e) {
  const t = JSON.parse(e);
  delete t.PrivateKey, delete t.IsOSBinary, delete t.SignatureType;
  const r = t.SignerCertificate;
  return r != null && (delete r.Archived, delete r.Extensions, delete r.Handle, delete r.HasPrivateKey, delete r.SubjectName), t;
}
function lo(e, t, r, n) {
  if (x_()) {
    e.warn(`Cannot execute Get-AuthenticodeSignature: ${t || r}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
    return;
  }
  try {
    (0, af.execFileSync)(...sf("ConvertTo-Json test", 10 * 1e3));
  } catch (i) {
    e.warn(`Cannot execute ConvertTo-Json: ${i.message}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
    return;
  }
  t != null && n(t), r && n(new Error(`Cannot execute Get-AuthenticodeSignature, stderr: ${r}. Failing signature validation due to unknown stderr.`));
}
function x_() {
  const e = D_.release();
  return e.startsWith("6.") && !e.startsWith("6.3");
}
Object.defineProperty(qr, "__esModule", { value: !0 });
qr.NsisUpdater = void 0;
const Pn = ce, Ol = Q, L_ = Ht, U_ = rn, Rl = Tt, k_ = se, M_ = bt, B_ = ga, Il = _t;
class j_ extends L_.BaseUpdater {
  constructor(t, r) {
    super(t, r), this._verifyUpdateCodeSignature = (n, i) => (0, B_.verifySignature)(n, i, this._logger);
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
    const r = t.updateInfoAndProvider.provider, n = (0, k_.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "exe");
    return this.executeDownload({
      fileExtension: "exe",
      downloadUpdateOptions: t,
      fileInfo: n,
      task: async (i, o, a, s) => {
        const l = n.packageInfo, p = l != null && a != null;
        if (p && t.disableWebInstaller)
          throw (0, Pn.newError)(`Unable to download new version ${t.updateInfoAndProvider.info.version}. Web Installers are disabled`, "ERR_UPDATER_WEB_INSTALLER_DISABLED");
        !p && !t.disableWebInstaller && this._logger.warn("disableWebInstaller is set to false, you should set it to true if you do not plan on using a web installer. This will default to true in a future version."), (p || t.disableDifferentialDownload || await this.differentialDownloadInstaller(n, t, i, r, Pn.CURRENT_APP_INSTALLER_FILE_NAME)) && await this.httpExecutor.download(n.url, i, o);
        const c = await this.verifySignature(i);
        if (c != null)
          throw await s(), (0, Pn.newError)(`New version ${t.updateInfoAndProvider.info.version} is not signed by the application owner: ${c}`, "ERR_UPDATER_INVALID_SIGNATURE");
        if (p && await this.differentialDownloadWebPackage(t, l, a, r))
          try {
            await this.httpExecutor.download(new Il.URL(l.path), a, {
              headers: t.requestHeaders,
              cancellationToken: t.cancellationToken,
              sha512: l.sha512
            });
          } catch (f) {
            try {
              await (0, M_.unlink)(a);
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
    const o = () => {
      this.spawnLog(Ol.join(process.resourcesPath, "elevate.exe"), [r].concat(n)).catch((a) => this.dispatchError(a));
    };
    return t.isAdminRightsRequired ? (this._logger.info("isAdminRightsRequired is set to true, run installer using elevate.exe"), o(), !0) : (this.spawnLog(r, n).catch((a) => {
      const s = a.code;
      this._logger.info(`Cannot run installer: error code: ${s}, error message: "${a.message}", will be executed again using elevate if EACCES, and will try to use electron.shell.openItem if ENOENT`), s === "UNKNOWN" || s === "EACCES" ? o() : s === "ENOENT" ? kt.shell.openPath(r).catch((l) => this.dispatchError(l)) : this.dispatchError(a);
    }), !0);
  }
  async differentialDownloadWebPackage(t, r, n, i) {
    if (r.blockMapSize == null)
      return !0;
    try {
      const o = {
        newUrl: new Il.URL(r.path),
        oldFile: Ol.join(this.downloadedUpdateHelper.cacheDir, Pn.CURRENT_APP_PACKAGE_FILE_NAME),
        logger: this._logger,
        newFile: n,
        requestHeaders: this.requestHeaders,
        isUseMultipleRangeRequest: i.isUseMultipleRangeRequest,
        cancellationToken: t.cancellationToken
      };
      this.listenerCount(Rl.DOWNLOAD_PROGRESS) > 0 && (o.onProgress = (a) => this.emit(Rl.DOWNLOAD_PROGRESS, a)), await new U_.FileWithEmbeddedBlockMapDifferentialDownloader(r, this.httpExecutor, o).download();
    } catch (o) {
      return this._logger.error(`Cannot download differentially, fallback to full download: ${o.stack || o}`), process.platform === "win32";
    }
    return !1;
  }
}
qr.NsisUpdater = j_;
(function(e) {
  var t = Ae && Ae.__createBinding || (Object.create ? function(_, T, A, N) {
    N === void 0 && (N = A);
    var x = Object.getOwnPropertyDescriptor(T, A);
    (!x || ("get" in x ? !T.__esModule : x.writable || x.configurable)) && (x = { enumerable: !0, get: function() {
      return T[A];
    } }), Object.defineProperty(_, N, x);
  } : function(_, T, A, N) {
    N === void 0 && (N = A), _[N] = T[A];
  }), r = Ae && Ae.__exportStar || function(_, T) {
    for (var A in _) A !== "default" && !Object.prototype.hasOwnProperty.call(T, A) && t(T, _, A);
  };
  Object.defineProperty(e, "__esModule", { value: !0 }), e.NsisUpdater = e.MacUpdater = e.RpmUpdater = e.PacmanUpdater = e.DebUpdater = e.AppImageUpdater = e.Provider = e.NoOpLogger = e.AppUpdater = e.BaseUpdater = void 0;
  const n = bt, i = Q;
  var o = Ht;
  Object.defineProperty(e, "BaseUpdater", { enumerable: !0, get: function() {
    return o.BaseUpdater;
  } });
  var a = gt;
  Object.defineProperty(e, "AppUpdater", { enumerable: !0, get: function() {
    return a.AppUpdater;
  } }), Object.defineProperty(e, "NoOpLogger", { enumerable: !0, get: function() {
    return a.NoOpLogger;
  } });
  var s = se;
  Object.defineProperty(e, "Provider", { enumerable: !0, get: function() {
    return s.Provider;
  } });
  var l = kr;
  Object.defineProperty(e, "AppImageUpdater", { enumerable: !0, get: function() {
    return l.AppImageUpdater;
  } });
  var p = Mr;
  Object.defineProperty(e, "DebUpdater", { enumerable: !0, get: function() {
    return p.DebUpdater;
  } });
  var c = Br;
  Object.defineProperty(e, "PacmanUpdater", { enumerable: !0, get: function() {
    return c.PacmanUpdater;
  } });
  var f = jr;
  Object.defineProperty(e, "RpmUpdater", { enumerable: !0, get: function() {
    return f.RpmUpdater;
  } });
  var d = Hr;
  Object.defineProperty(e, "MacUpdater", { enumerable: !0, get: function() {
    return d.MacUpdater;
  } });
  var h = qr;
  Object.defineProperty(e, "NsisUpdater", { enumerable: !0, get: function() {
    return h.NsisUpdater;
  } }), r(Tt, e);
  let y;
  function E() {
    if (process.platform === "win32")
      y = new qr.NsisUpdater();
    else if (process.platform === "darwin")
      y = new Hr.MacUpdater();
    else {
      y = new kr.AppImageUpdater();
      try {
        const _ = i.join(process.resourcesPath, "package-type");
        if (!(0, n.existsSync)(_))
          return y;
        switch ((0, n.readFileSync)(_).toString().trim()) {
          case "deb":
            y = new Mr.DebUpdater();
            break;
          case "rpm":
            y = new jr.RpmUpdater();
            break;
          case "pacman":
            y = new Br.PacmanUpdater();
            break;
          default:
            break;
        }
      } catch (_) {
        console.warn("Unable to detect 'package-type' for autoUpdater (rpm/deb/pacman support). If you'd like to expand support, please consider contributing to electron-builder", _.message);
      }
    }
    return y;
  }
  Object.defineProperty(e, "autoUpdater", {
    enumerable: !0,
    get: () => y || E()
  });
})(Kl);
var lf = { exports: {} };
function cf(e) {
  throw new Error('Could not dynamically require "' + e + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}
var Ue = {};
Ue.getBooleanOption = (e, t) => {
  let r = !1;
  if (t in e && typeof (r = e[t]) != "boolean")
    throw new TypeError(`Expected the "${t}" option to be a boolean`);
  return r;
};
Ue.cppdb = Symbol();
Ue.inspect = Symbol.for("nodejs.util.inspect.custom");
const xo = { value: "SqliteError", writable: !0, enumerable: !1, configurable: !0 };
function Ut(e, t) {
  if (new.target !== Ut)
    return new Ut(e, t);
  if (typeof t != "string")
    throw new TypeError("Expected second argument to be a string");
  Error.call(this, e), xo.value = "" + e, Object.defineProperty(this, "message", xo), Error.captureStackTrace(this, Ut), this.code = t;
}
Object.setPrototypeOf(Ut, Error);
Object.setPrototypeOf(Ut.prototype, Error.prototype);
Object.defineProperty(Ut.prototype, "name", xo);
var uf = Ut, Nn = { exports: {} }, co, Pl;
function H_() {
  if (Pl) return co;
  Pl = 1;
  var e = Q.sep || "/";
  co = t;
  function t(r) {
    if (typeof r != "string" || r.length <= 7 || r.substring(0, 7) != "file://")
      throw new TypeError("must pass in a file:// URI to convert to a file path");
    var n = decodeURI(r.substring(7)), i = n.indexOf("/"), o = n.substring(0, i), a = n.substring(i + 1);
    return o == "localhost" && (o = ""), o && (o = e + e + o), a = a.replace(/^(.+)\|/, "$1:"), e == "\\" && (a = a.replace(/\//g, "\\")), /^.+\:/.test(a) || (a = e + a), o + a;
  }
  return co;
}
var Nl;
function q_() {
  return Nl || (Nl = 1, function(e, t) {
    var r = qe, n = Q, i = H_(), o = n.join, a = n.dirname, s = r.accessSync && function(c) {
      try {
        r.accessSync(c);
      } catch {
        return !1;
      }
      return !0;
    } || r.existsSync || n.existsSync, l = {
      arrow: process.env.NODE_BINDINGS_ARROW || " → ",
      compiled: process.env.NODE_BINDINGS_COMPILED_DIR || "compiled",
      platform: process.platform,
      arch: process.arch,
      nodePreGyp: "node-v" + process.versions.modules + "-" + process.platform + "-" + process.arch,
      version: process.versions.node,
      bindings: "bindings.node",
      try: [
        // node-gyp's linked version in the "build" dir
        ["module_root", "build", "bindings"],
        // node-waf and gyp_addon (a.k.a node-gyp)
        ["module_root", "build", "Debug", "bindings"],
        ["module_root", "build", "Release", "bindings"],
        // Debug files, for development (legacy behavior, remove for node v0.9)
        ["module_root", "out", "Debug", "bindings"],
        ["module_root", "Debug", "bindings"],
        // Release files, but manually compiled (legacy behavior, remove for node v0.9)
        ["module_root", "out", "Release", "bindings"],
        ["module_root", "Release", "bindings"],
        // Legacy from node-waf, node <= 0.4.x
        ["module_root", "build", "default", "bindings"],
        // Production "Release" buildtype binary (meh...)
        ["module_root", "compiled", "version", "platform", "arch", "bindings"],
        // node-qbs builds
        ["module_root", "addon-build", "release", "install-root", "bindings"],
        ["module_root", "addon-build", "debug", "install-root", "bindings"],
        ["module_root", "addon-build", "default", "install-root", "bindings"],
        // node-pre-gyp path ./lib/binding/{node_abi}-{platform}-{arch}
        ["module_root", "lib", "binding", "nodePreGyp", "bindings"]
      ]
    };
    function p(c) {
      typeof c == "string" ? c = { bindings: c } : c || (c = {}), Object.keys(l).map(function(A) {
        A in c || (c[A] = l[A]);
      }), c.module_root || (c.module_root = t.getRoot(t.getFileName())), n.extname(c.bindings) != ".node" && (c.bindings += ".node");
      for (var f = typeof __webpack_require__ == "function" ? __non_webpack_require__ : cf, d = [], h = 0, y = c.try.length, E, _, T; h < y; h++) {
        E = o.apply(
          null,
          c.try[h].map(function(A) {
            return c[A] || A;
          })
        ), d.push(E);
        try {
          return _ = c.path ? f.resolve(E) : f(E), c.path || (_.path = E), _;
        } catch (A) {
          if (A.code !== "MODULE_NOT_FOUND" && A.code !== "QUALIFIED_PATH_RESOLUTION_FAILED" && !/not find/i.test(A.message))
            throw A;
        }
      }
      throw T = new Error(
        `Could not locate the bindings file. Tried:
` + d.map(function(A) {
          return c.arrow + A;
        }).join(`
`)
      ), T.tries = d, T;
    }
    e.exports = t = p, t.getFileName = function(f) {
      var d = Error.prepareStackTrace, h = Error.stackTraceLimit, y = {}, E;
      Error.stackTraceLimit = 10, Error.prepareStackTrace = function(T, A) {
        for (var N = 0, x = A.length; N < x; N++)
          if (E = A[N].getFileName(), E !== __filename)
            if (f) {
              if (E !== f)
                return;
            } else
              return;
      }, Error.captureStackTrace(y), y.stack, Error.prepareStackTrace = d, Error.stackTraceLimit = h;
      var _ = "file://";
      return E.indexOf(_) === 0 && (E = i(E)), E;
    }, t.getRoot = function(f) {
      for (var d = a(f), h; ; ) {
        if (d === "." && (d = process.cwd()), s(o(d, "package.json")) || s(o(d, "node_modules")))
          return d;
        if (h === d)
          throw new Error(
            'Could not find module root given file: "' + f + '". Do you have a `package.json` file? '
          );
        h = d, d = o(d, "..");
      }
    };
  }(Nn, Nn.exports)), Nn.exports;
}
var tt = {}, Dl;
function G_() {
  if (Dl) return tt;
  Dl = 1;
  const { cppdb: e } = Ue;
  return tt.prepare = function(r) {
    return this[e].prepare(r, this, !1);
  }, tt.exec = function(r) {
    return this[e].exec(r), this;
  }, tt.close = function() {
    return this[e].close(), this;
  }, tt.loadExtension = function(...r) {
    return this[e].loadExtension(...r), this;
  }, tt.defaultSafeIntegers = function(...r) {
    return this[e].defaultSafeIntegers(...r), this;
  }, tt.unsafeMode = function(...r) {
    return this[e].unsafeMode(...r), this;
  }, tt.getters = {
    name: {
      get: function() {
        return this[e].name;
      },
      enumerable: !0
    },
    open: {
      get: function() {
        return this[e].open;
      },
      enumerable: !0
    },
    inTransaction: {
      get: function() {
        return this[e].inTransaction;
      },
      enumerable: !0
    },
    readonly: {
      get: function() {
        return this[e].readonly;
      },
      enumerable: !0
    },
    memory: {
      get: function() {
        return this[e].memory;
      },
      enumerable: !0
    }
  }, tt;
}
var uo, $l;
function V_() {
  if ($l) return uo;
  $l = 1;
  const { cppdb: e } = Ue, t = /* @__PURE__ */ new WeakMap();
  uo = function(o) {
    if (typeof o != "function") throw new TypeError("Expected first argument to be a function");
    const a = this[e], s = r(a, this), { apply: l } = Function.prototype, p = {
      default: { value: n(l, o, a, s.default) },
      deferred: { value: n(l, o, a, s.deferred) },
      immediate: { value: n(l, o, a, s.immediate) },
      exclusive: { value: n(l, o, a, s.exclusive) },
      database: { value: this, enumerable: !0 }
    };
    return Object.defineProperties(p.default.value, p), Object.defineProperties(p.deferred.value, p), Object.defineProperties(p.immediate.value, p), Object.defineProperties(p.exclusive.value, p), p.default.value;
  };
  const r = (i, o) => {
    let a = t.get(i);
    if (!a) {
      const s = {
        commit: i.prepare("COMMIT", o, !1),
        rollback: i.prepare("ROLLBACK", o, !1),
        savepoint: i.prepare("SAVEPOINT `	_bs3.	`", o, !1),
        release: i.prepare("RELEASE `	_bs3.	`", o, !1),
        rollbackTo: i.prepare("ROLLBACK TO `	_bs3.	`", o, !1)
      };
      t.set(i, a = {
        default: Object.assign({ begin: i.prepare("BEGIN", o, !1) }, s),
        deferred: Object.assign({ begin: i.prepare("BEGIN DEFERRED", o, !1) }, s),
        immediate: Object.assign({ begin: i.prepare("BEGIN IMMEDIATE", o, !1) }, s),
        exclusive: Object.assign({ begin: i.prepare("BEGIN EXCLUSIVE", o, !1) }, s)
      });
    }
    return a;
  }, n = (i, o, a, { begin: s, commit: l, rollback: p, savepoint: c, release: f, rollbackTo: d }) => function() {
    let y, E, _;
    a.inTransaction ? (y = c, E = f, _ = d) : (y = s, E = l, _ = p), y.run();
    try {
      const T = i.call(o, this, arguments);
      if (T && typeof T.then == "function")
        throw new TypeError("Transaction function cannot return a promise");
      return E.run(), T;
    } catch (T) {
      throw a.inTransaction && (_.run(), _ !== p && E.run()), T;
    }
  };
  return uo;
}
var fo, Fl;
function W_() {
  if (Fl) return fo;
  Fl = 1;
  const { getBooleanOption: e, cppdb: t } = Ue;
  return fo = function(n, i) {
    if (i == null && (i = {}), typeof n != "string") throw new TypeError("Expected first argument to be a string");
    if (typeof i != "object") throw new TypeError("Expected second argument to be an options object");
    const o = e(i, "simple"), a = this[t].prepare(`PRAGMA ${n}`, this, !0);
    return o ? a.pluck().get() : a.all();
  }, fo;
}
var ho, xl;
function Y_() {
  if (xl) return ho;
  xl = 1;
  const e = qe, t = Q, { promisify: r } = Kn, { cppdb: n } = Ue, i = r(e.access);
  ho = async function(s, l) {
    if (l == null && (l = {}), typeof s != "string") throw new TypeError("Expected first argument to be a string");
    if (typeof l != "object") throw new TypeError("Expected second argument to be an options object");
    s = s.trim();
    const p = "attached" in l ? l.attached : "main", c = "progress" in l ? l.progress : null;
    if (!s) throw new TypeError("Backup filename cannot be an empty string");
    if (s === ":memory:") throw new TypeError('Invalid backup filename ":memory:"');
    if (typeof p != "string") throw new TypeError('Expected the "attached" option to be a string');
    if (!p) throw new TypeError('The "attached" option cannot be an empty string');
    if (c != null && typeof c != "function") throw new TypeError('Expected the "progress" option to be a function');
    await i(t.dirname(s)).catch(() => {
      throw new TypeError("Cannot save backup because the directory does not exist");
    });
    const f = await i(s).then(() => !1, () => !0);
    return o(this[n].backup(this, p, s, f), c || null);
  };
  const o = (a, s) => {
    let l = 0, p = !0;
    return new Promise((c, f) => {
      setImmediate(function d() {
        try {
          const h = a.transfer(l);
          if (!h.remainingPages) {
            a.close(), c(h);
            return;
          }
          if (p && (p = !1, l = 100), s) {
            const y = s(h);
            if (y !== void 0)
              if (typeof y == "number" && y === y) l = Math.max(0, Math.min(2147483647, Math.round(y)));
              else throw new TypeError("Expected progress callback to return a number or undefined");
          }
          setImmediate(d);
        } catch (h) {
          a.close(), f(h);
        }
      });
    });
  };
  return ho;
}
var po, Ll;
function z_() {
  if (Ll) return po;
  Ll = 1;
  const { cppdb: e } = Ue;
  return po = function(r) {
    if (r == null && (r = {}), typeof r != "object") throw new TypeError("Expected first argument to be an options object");
    const n = "attached" in r ? r.attached : "main";
    if (typeof n != "string") throw new TypeError('Expected the "attached" option to be a string');
    if (!n) throw new TypeError('The "attached" option cannot be an empty string');
    return this[e].serialize(n);
  }, po;
}
var mo, Ul;
function X_() {
  if (Ul) return mo;
  Ul = 1;
  const { getBooleanOption: e, cppdb: t } = Ue;
  return mo = function(n, i, o) {
    if (i == null && (i = {}), typeof i == "function" && (o = i, i = {}), typeof n != "string") throw new TypeError("Expected first argument to be a string");
    if (typeof o != "function") throw new TypeError("Expected last argument to be a function");
    if (typeof i != "object") throw new TypeError("Expected second argument to be an options object");
    if (!n) throw new TypeError("User-defined function name cannot be an empty string");
    const a = "safeIntegers" in i ? +e(i, "safeIntegers") : 2, s = e(i, "deterministic"), l = e(i, "directOnly"), p = e(i, "varargs");
    let c = -1;
    if (!p) {
      if (c = o.length, !Number.isInteger(c) || c < 0) throw new TypeError("Expected function.length to be a positive integer");
      if (c > 100) throw new RangeError("User-defined functions cannot have more than 100 arguments");
    }
    return this[t].function(o, n, c, a, s, l), this;
  }, mo;
}
var go, kl;
function K_() {
  if (kl) return go;
  kl = 1;
  const { getBooleanOption: e, cppdb: t } = Ue;
  go = function(o, a) {
    if (typeof o != "string") throw new TypeError("Expected first argument to be a string");
    if (typeof a != "object" || a === null) throw new TypeError("Expected second argument to be an options object");
    if (!o) throw new TypeError("User-defined function name cannot be an empty string");
    const s = "start" in a ? a.start : null, l = r(a, "step", !0), p = r(a, "inverse", !1), c = r(a, "result", !1), f = "safeIntegers" in a ? +e(a, "safeIntegers") : 2, d = e(a, "deterministic"), h = e(a, "directOnly"), y = e(a, "varargs");
    let E = -1;
    if (!y && (E = Math.max(n(l), p ? n(p) : 0), E > 0 && (E -= 1), E > 100))
      throw new RangeError("User-defined functions cannot have more than 100 arguments");
    return this[t].aggregate(s, l, p, c, o, E, f, d, h), this;
  };
  const r = (i, o, a) => {
    const s = o in i ? i[o] : null;
    if (typeof s == "function") return s;
    if (s != null) throw new TypeError(`Expected the "${o}" option to be a function`);
    if (a) throw new TypeError(`Missing required option "${o}"`);
    return null;
  }, n = ({ length: i }) => {
    if (Number.isInteger(i) && i >= 0) return i;
    throw new TypeError("Expected function.length to be a positive integer");
  };
  return go;
}
var Eo, Ml;
function J_() {
  if (Ml) return Eo;
  Ml = 1;
  const { cppdb: e } = Ue;
  Eo = function(h, y) {
    if (typeof h != "string") throw new TypeError("Expected first argument to be a string");
    if (!h) throw new TypeError("Virtual table module name cannot be an empty string");
    let E = !1;
    if (typeof y == "object" && y !== null)
      E = !0, y = f(r(y, "used", h));
    else {
      if (typeof y != "function") throw new TypeError("Expected second argument to be a function or a table definition object");
      y = t(y);
    }
    return this[e].table(y, h, E), this;
  };
  function t(d) {
    return function(y, E, _, ...T) {
      const A = {
        module: y,
        database: E,
        table: _
      }, N = l.call(d, A, T);
      if (typeof N != "object" || N === null)
        throw new TypeError(`Virtual table module "${y}" did not return a table definition object`);
      return r(N, "returned", y);
    };
  }
  function r(d, h, y) {
    if (!s.call(d, "rows"))
      throw new TypeError(`Virtual table module "${y}" ${h} a table definition without a "rows" property`);
    if (!s.call(d, "columns"))
      throw new TypeError(`Virtual table module "${y}" ${h} a table definition without a "columns" property`);
    const E = d.rows;
    if (typeof E != "function" || Object.getPrototypeOf(E) !== p)
      throw new TypeError(`Virtual table module "${y}" ${h} a table definition with an invalid "rows" property (should be a generator function)`);
    let _ = d.columns;
    if (!Array.isArray(_) || !(_ = [..._]).every((G) => typeof G == "string"))
      throw new TypeError(`Virtual table module "${y}" ${h} a table definition with an invalid "columns" property (should be an array of strings)`);
    if (_.length !== new Set(_).size)
      throw new TypeError(`Virtual table module "${y}" ${h} a table definition with duplicate column names`);
    if (!_.length)
      throw new RangeError(`Virtual table module "${y}" ${h} a table definition with zero columns`);
    let T;
    if (s.call(d, "parameters")) {
      if (T = d.parameters, !Array.isArray(T) || !(T = [...T]).every((G) => typeof G == "string"))
        throw new TypeError(`Virtual table module "${y}" ${h} a table definition with an invalid "parameters" property (should be an array of strings)`);
    } else
      T = a(E);
    if (T.length !== new Set(T).size)
      throw new TypeError(`Virtual table module "${y}" ${h} a table definition with duplicate parameter names`);
    if (T.length > 32)
      throw new RangeError(`Virtual table module "${y}" ${h} a table definition with more than the maximum number of 32 parameters`);
    for (const G of T)
      if (_.includes(G))
        throw new TypeError(`Virtual table module "${y}" ${h} a table definition with column "${G}" which was ambiguously defined as both a column and parameter`);
    let A = 2;
    if (s.call(d, "safeIntegers")) {
      const G = d.safeIntegers;
      if (typeof G != "boolean")
        throw new TypeError(`Virtual table module "${y}" ${h} a table definition with an invalid "safeIntegers" property (should be a boolean)`);
      A = +G;
    }
    let N = !1;
    if (s.call(d, "directOnly") && (N = d.directOnly, typeof N != "boolean"))
      throw new TypeError(`Virtual table module "${y}" ${h} a table definition with an invalid "directOnly" property (should be a boolean)`);
    return [
      `CREATE TABLE x(${[
        ...T.map(c).map((G) => `${G} HIDDEN`),
        ..._.map(c)
      ].join(", ")});`,
      n(E, new Map(_.map((G, te) => [G, T.length + te])), y),
      T,
      A,
      N
    ];
  }
  function n(d, h, y) {
    return function* (..._) {
      const T = _.map((A) => Buffer.isBuffer(A) ? Buffer.from(A) : A);
      for (let A = 0; A < h.size; ++A)
        T.push(null);
      for (const A of d(..._))
        if (Array.isArray(A))
          i(A, T, h.size, y), yield T;
        else if (typeof A == "object" && A !== null)
          o(A, T, h, y), yield T;
        else
          throw new TypeError(`Virtual table module "${y}" yielded something that isn't a valid row object`);
    };
  }
  function i(d, h, y, E) {
    if (d.length !== y)
      throw new TypeError(`Virtual table module "${E}" yielded a row with an incorrect number of columns`);
    const _ = h.length - y;
    for (let T = 0; T < y; ++T)
      h[T + _] = d[T];
  }
  function o(d, h, y, E) {
    let _ = 0;
    for (const T of Object.keys(d)) {
      const A = y.get(T);
      if (A === void 0)
        throw new TypeError(`Virtual table module "${E}" yielded a row with an undeclared column "${T}"`);
      h[A] = d[T], _ += 1;
    }
    if (_ !== y.size)
      throw new TypeError(`Virtual table module "${E}" yielded a row with missing columns`);
  }
  function a({ length: d }) {
    if (!Number.isInteger(d) || d < 0)
      throw new TypeError("Expected function.length to be a positive integer");
    const h = [];
    for (let y = 0; y < d; ++y)
      h.push(`$${y + 1}`);
    return h;
  }
  const { hasOwnProperty: s } = Object.prototype, { apply: l } = Function.prototype, p = Object.getPrototypeOf(function* () {
  }), c = (d) => `"${d.replace(/"/g, '""')}"`, f = (d) => () => d;
  return Eo;
}
var yo, Bl;
function Q_() {
  if (Bl) return yo;
  Bl = 1;
  const e = function() {
  };
  return yo = function(r, n) {
    return Object.assign(new e(), this);
  }, yo;
}
const Z_ = qe, jl = Q, Ln = Ue, eb = uf;
let Hl;
function _e(e, t) {
  if (new.target == null)
    return new _e(e, t);
  let r;
  if (Buffer.isBuffer(e) && (r = e, e = ":memory:"), e == null && (e = ""), t == null && (t = {}), typeof e != "string") throw new TypeError("Expected first argument to be a string");
  if (typeof t != "object") throw new TypeError("Expected second argument to be an options object");
  if ("readOnly" in t) throw new TypeError('Misspelled option "readOnly" should be "readonly"');
  if ("memory" in t) throw new TypeError('Option "memory" was removed in v7.0.0 (use ":memory:" filename instead)');
  const n = e.trim(), i = n === "" || n === ":memory:", o = Ln.getBooleanOption(t, "readonly"), a = Ln.getBooleanOption(t, "fileMustExist"), s = "timeout" in t ? t.timeout : 5e3, l = "verbose" in t ? t.verbose : null, p = "nativeBinding" in t ? t.nativeBinding : null;
  if (o && i && !r) throw new TypeError("In-memory/temporary databases cannot be readonly");
  if (!Number.isInteger(s) || s < 0) throw new TypeError('Expected the "timeout" option to be a positive integer');
  if (s > 2147483647) throw new RangeError('Option "timeout" cannot be greater than 2147483647');
  if (l != null && typeof l != "function") throw new TypeError('Expected the "verbose" option to be a function');
  if (p != null && typeof p != "string" && typeof p != "object") throw new TypeError('Expected the "nativeBinding" option to be a string or addon object');
  let c;
  if (p == null ? c = Hl || (Hl = q_()("better_sqlite3.node")) : typeof p == "string" ? c = (typeof __non_webpack_require__ == "function" ? __non_webpack_require__ : cf)(jl.resolve(p).replace(/(\.node)?$/, ".node")) : c = p, c.isInitialized || (c.setErrorConstructor(eb), c.isInitialized = !0), !i && !n.startsWith("file:") && !Z_.existsSync(jl.dirname(n)))
    throw new TypeError("Cannot open database because the directory does not exist");
  Object.defineProperties(this, {
    [Ln.cppdb]: { value: new c.Database(n, e, i, o, a, s, l || null, r || null) },
    ...Gt.getters
  });
}
const Gt = G_();
_e.prototype.prepare = Gt.prepare;
_e.prototype.transaction = V_();
_e.prototype.pragma = W_();
_e.prototype.backup = Y_();
_e.prototype.serialize = z_();
_e.prototype.function = X_();
_e.prototype.aggregate = K_();
_e.prototype.table = J_();
_e.prototype.loadExtension = Gt.loadExtension;
_e.prototype.exec = Gt.exec;
_e.prototype.close = Gt.close;
_e.prototype.defaultSafeIntegers = Gt.defaultSafeIntegers;
_e.prototype.unsafeMode = Gt.unsafeMode;
_e.prototype[Ln.inspect] = Q_();
var tb = _e;
lf.exports = tb;
lf.exports.SqliteError = uf;
let ff;
function rb(e, t, r) {
  return ff.prepare(`
        INSERT INTO documents (title, filePath, fileHash)
        VALUES (?, ?, ?)
        `).run(e, t, r);
}
function nb() {
  return ff.prepare("select * from documents").all();
}
Ed(import.meta.url);
const df = pt.dirname(Vl(import.meta.url)), ib = Vl(import.meta.url);
globalThis.__filename = ib;
process.env.APP_ROOT = pt.join(df, "..");
const Lo = process.env.VITE_DEV_SERVER_URL, Tb = pt.join(process.env.APP_ROOT, "dist-electron"), hf = pt.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = Lo ? pt.join(process.env.APP_ROOT, "public") : hf;
let ct = null;
function pf() {
  ct = new ql({
    icon: pt.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    title: "Lyceum",
    width: 1200,
    height: 800,
    webPreferences: {
      preload: pt.join(df, "preload.mjs")
    },
    autoHideMenuBar: !0
  }), Lo ? ct.loadURL(Lo) : ct.loadFile(pt.join(hf, "index.html")), ct.webContents.on("did-finish-load", () => {
    ct == null || ct.webContents.setZoomFactor(1);
  });
}
Un.whenReady().then(() => {
  Kl.autoUpdater.checkForUpdatesAndNotify(), pf();
});
Un.on("window-all-closed", () => {
  process.platform !== "darwin" && (Un.quit(), ct = null);
});
Un.on("activate", () => {
  ql.getAllWindows().length === 0 && pf();
});
Gl.handle("add-document", (e, t) => rb(t.title, t.filePath, t.fileHash));
Gl.handle("get-documents", () => nb());
export {
  Tb as MAIN_DIST,
  hf as RENDERER_DIST,
  Lo as VITE_DEV_SERVER_URL
};
