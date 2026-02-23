import $t, { app as Pn, BrowserWindow as hl } from "electron";
import { createRequire as xf } from "node:module";
import { fileURLToPath as Lf } from "node:url";
import ct from "node:path";
import gt from "fs";
import Uf from "constants";
import kr from "stream";
import vo from "util";
import pl from "assert";
import re from "path";
import qn from "child_process";
import ml from "events";
import Mr from "crypto";
import gl from "tty";
import Gn from "os";
import Et from "url";
import El from "zlib";
import kf from "http";
var Te = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, yl = {}, xt = {}, be = {};
be.fromCallback = function(e) {
  return Object.defineProperty(function(...t) {
    if (typeof t[t.length - 1] == "function") e.apply(this, t);
    else
      return new Promise((r, n) => {
        t.push((i, o) => i != null ? n(i) : r(o)), e.apply(this, t);
      });
  }, "name", { value: e.name });
};
be.fromPromise = function(e) {
  return Object.defineProperty(function(...t) {
    const r = t[t.length - 1];
    if (typeof r != "function") return e.apply(this, t);
    t.pop(), e.apply(this, t).then((n) => r(null, n), r);
  }, "name", { value: e.name });
};
var it = Uf, Mf = process.cwd, Cn = null, Bf = process.env.GRACEFUL_FS_PLATFORM || process.platform;
process.cwd = function() {
  return Cn || (Cn = Mf.call(process)), Cn;
};
try {
  process.cwd();
} catch {
}
if (typeof process.chdir == "function") {
  var ya = process.chdir;
  process.chdir = function(e) {
    Cn = null, ya.call(process, e);
  }, Object.setPrototypeOf && Object.setPrototypeOf(process.chdir, ya);
}
var jf = Hf;
function Hf(e) {
  it.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./) && t(e), e.lutimes || r(e), e.chown = o(e.chown), e.fchown = o(e.fchown), e.lchown = o(e.lchown), e.chmod = n(e.chmod), e.fchmod = n(e.fchmod), e.lchmod = n(e.lchmod), e.chownSync = a(e.chownSync), e.fchownSync = a(e.fchownSync), e.lchownSync = a(e.lchownSync), e.chmodSync = i(e.chmodSync), e.fchmodSync = i(e.fchmodSync), e.lchmodSync = i(e.lchmodSync), e.stat = s(e.stat), e.fstat = s(e.fstat), e.lstat = s(e.lstat), e.statSync = l(e.statSync), e.fstatSync = l(e.fstatSync), e.lstatSync = l(e.lstatSync), e.chmod && !e.lchmod && (e.lchmod = function(c, f, d) {
    d && process.nextTick(d);
  }, e.lchmodSync = function() {
  }), e.chown && !e.lchown && (e.lchown = function(c, f, d, g) {
    g && process.nextTick(g);
  }, e.lchownSync = function() {
  }), Bf === "win32" && (e.rename = typeof e.rename != "function" ? e.rename : function(c) {
    function f(d, g, v) {
      var y = Date.now(), A = 0;
      c(d, g, function S(T) {
        if (T && (T.code === "EACCES" || T.code === "EPERM" || T.code === "EBUSY") && Date.now() - y < 6e4) {
          setTimeout(function() {
            e.stat(g, function(D, x) {
              D && D.code === "ENOENT" ? c(d, g, S) : v(T);
            });
          }, A), A < 100 && (A += 10);
          return;
        }
        v && v(T);
      });
    }
    return Object.setPrototypeOf && Object.setPrototypeOf(f, c), f;
  }(e.rename)), e.read = typeof e.read != "function" ? e.read : function(c) {
    function f(d, g, v, y, A, S) {
      var T;
      if (S && typeof S == "function") {
        var D = 0;
        T = function(x, Z, oe) {
          if (x && x.code === "EAGAIN" && D < 10)
            return D++, c.call(e, d, g, v, y, A, T);
          S.apply(this, arguments);
        };
      }
      return c.call(e, d, g, v, y, A, T);
    }
    return Object.setPrototypeOf && Object.setPrototypeOf(f, c), f;
  }(e.read), e.readSync = typeof e.readSync != "function" ? e.readSync : /* @__PURE__ */ function(c) {
    return function(f, d, g, v, y) {
      for (var A = 0; ; )
        try {
          return c.call(e, f, d, g, v, y);
        } catch (S) {
          if (S.code === "EAGAIN" && A < 10) {
            A++;
            continue;
          }
          throw S;
        }
    };
  }(e.readSync);
  function t(c) {
    c.lchmod = function(f, d, g) {
      c.open(
        f,
        it.O_WRONLY | it.O_SYMLINK,
        d,
        function(v, y) {
          if (v) {
            g && g(v);
            return;
          }
          c.fchmod(y, d, function(A) {
            c.close(y, function(S) {
              g && g(A || S);
            });
          });
        }
      );
    }, c.lchmodSync = function(f, d) {
      var g = c.openSync(f, it.O_WRONLY | it.O_SYMLINK, d), v = !0, y;
      try {
        y = c.fchmodSync(g, d), v = !1;
      } finally {
        if (v)
          try {
            c.closeSync(g);
          } catch {
          }
        else
          c.closeSync(g);
      }
      return y;
    };
  }
  function r(c) {
    it.hasOwnProperty("O_SYMLINK") && c.futimes ? (c.lutimes = function(f, d, g, v) {
      c.open(f, it.O_SYMLINK, function(y, A) {
        if (y) {
          v && v(y);
          return;
        }
        c.futimes(A, d, g, function(S) {
          c.close(A, function(T) {
            v && v(S || T);
          });
        });
      });
    }, c.lutimesSync = function(f, d, g) {
      var v = c.openSync(f, it.O_SYMLINK), y, A = !0;
      try {
        y = c.futimesSync(v, d, g), A = !1;
      } finally {
        if (A)
          try {
            c.closeSync(v);
          } catch {
          }
        else
          c.closeSync(v);
      }
      return y;
    }) : c.futimes && (c.lutimes = function(f, d, g, v) {
      v && process.nextTick(v);
    }, c.lutimesSync = function() {
    });
  }
  function n(c) {
    return c && function(f, d, g) {
      return c.call(e, f, d, function(v) {
        m(v) && (v = null), g && g.apply(this, arguments);
      });
    };
  }
  function i(c) {
    return c && function(f, d) {
      try {
        return c.call(e, f, d);
      } catch (g) {
        if (!m(g)) throw g;
      }
    };
  }
  function o(c) {
    return c && function(f, d, g, v) {
      return c.call(e, f, d, g, function(y) {
        m(y) && (y = null), v && v.apply(this, arguments);
      });
    };
  }
  function a(c) {
    return c && function(f, d, g) {
      try {
        return c.call(e, f, d, g);
      } catch (v) {
        if (!m(v)) throw v;
      }
    };
  }
  function s(c) {
    return c && function(f, d, g) {
      typeof d == "function" && (g = d, d = null);
      function v(y, A) {
        A && (A.uid < 0 && (A.uid += 4294967296), A.gid < 0 && (A.gid += 4294967296)), g && g.apply(this, arguments);
      }
      return d ? c.call(e, f, d, v) : c.call(e, f, v);
    };
  }
  function l(c) {
    return c && function(f, d) {
      var g = d ? c.call(e, f, d) : c.call(e, f);
      return g && (g.uid < 0 && (g.uid += 4294967296), g.gid < 0 && (g.gid += 4294967296)), g;
    };
  }
  function m(c) {
    if (!c || c.code === "ENOSYS")
      return !0;
    var f = !process.getuid || process.getuid() !== 0;
    return !!(f && (c.code === "EINVAL" || c.code === "EPERM"));
  }
}
var va = kr.Stream, qf = Gf;
function Gf(e) {
  return {
    ReadStream: t,
    WriteStream: r
  };
  function t(n, i) {
    if (!(this instanceof t)) return new t(n, i);
    va.call(this);
    var o = this;
    this.path = n, this.fd = null, this.readable = !0, this.paused = !1, this.flags = "r", this.mode = 438, this.bufferSize = 64 * 1024, i = i || {};
    for (var a = Object.keys(i), s = 0, l = a.length; s < l; s++) {
      var m = a[s];
      this[m] = i[m];
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
    va.call(this), this.path = n, this.fd = null, this.writable = !0, this.flags = "w", this.encoding = "binary", this.mode = 438, this.bytesWritten = 0, i = i || {};
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
var Wf = Yf, Vf = Object.getPrototypeOf || function(e) {
  return e.__proto__;
};
function Yf(e) {
  if (e === null || typeof e != "object")
    return e;
  if (e instanceof Object)
    var t = { __proto__: Vf(e) };
  else
    var t = /* @__PURE__ */ Object.create(null);
  return Object.getOwnPropertyNames(e).forEach(function(r) {
    Object.defineProperty(t, r, Object.getOwnPropertyDescriptor(e, r));
  }), t;
}
var te = gt, zf = jf, Xf = qf, Kf = Wf, ln = vo, me, Nn;
typeof Symbol == "function" && typeof Symbol.for == "function" ? (me = Symbol.for("graceful-fs.queue"), Nn = Symbol.for("graceful-fs.previous")) : (me = "___graceful-fs.queue", Nn = "___graceful-fs.previous");
function Jf() {
}
function vl(e, t) {
  Object.defineProperty(e, me, {
    get: function() {
      return t;
    }
  });
}
var Nt = Jf;
ln.debuglog ? Nt = ln.debuglog("gfs4") : /\bgfs4\b/i.test(process.env.NODE_DEBUG || "") && (Nt = function() {
  var e = ln.format.apply(ln, arguments);
  e = "GFS4: " + e.split(/\n/).join(`
GFS4: `), console.error(e);
});
if (!te[me]) {
  var Qf = Te[me] || [];
  vl(te, Qf), te.close = function(e) {
    function t(r, n) {
      return e.call(te, r, function(i) {
        i || wa(), typeof n == "function" && n.apply(this, arguments);
      });
    }
    return Object.defineProperty(t, Nn, {
      value: e
    }), t;
  }(te.close), te.closeSync = function(e) {
    function t(r) {
      e.apply(te, arguments), wa();
    }
    return Object.defineProperty(t, Nn, {
      value: e
    }), t;
  }(te.closeSync), /\bgfs4\b/i.test(process.env.NODE_DEBUG || "") && process.on("exit", function() {
    Nt(te[me]), pl.equal(te[me].length, 0);
  });
}
Te[me] || vl(Te, te[me]);
var Re = wo(Kf(te));
process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !te.__patched && (Re = wo(te), te.__patched = !0);
function wo(e) {
  zf(e), e.gracefulify = wo, e.createReadStream = Z, e.createWriteStream = oe;
  var t = e.readFile;
  e.readFile = r;
  function r(E, q, B) {
    return typeof q == "function" && (B = q, q = null), M(E, q, B);
    function M(z, I, R, N) {
      return t(z, I, function(b) {
        b && (b.code === "EMFILE" || b.code === "ENFILE") ? Bt([M, [z, I, R], b, N || Date.now(), Date.now()]) : typeof R == "function" && R.apply(this, arguments);
      });
    }
  }
  var n = e.writeFile;
  e.writeFile = i;
  function i(E, q, B, M) {
    return typeof B == "function" && (M = B, B = null), z(E, q, B, M);
    function z(I, R, N, b, $) {
      return n(I, R, N, function(P) {
        P && (P.code === "EMFILE" || P.code === "ENFILE") ? Bt([z, [I, R, N, b], P, $ || Date.now(), Date.now()]) : typeof b == "function" && b.apply(this, arguments);
      });
    }
  }
  var o = e.appendFile;
  o && (e.appendFile = a);
  function a(E, q, B, M) {
    return typeof B == "function" && (M = B, B = null), z(E, q, B, M);
    function z(I, R, N, b, $) {
      return o(I, R, N, function(P) {
        P && (P.code === "EMFILE" || P.code === "ENFILE") ? Bt([z, [I, R, N, b], P, $ || Date.now(), Date.now()]) : typeof b == "function" && b.apply(this, arguments);
      });
    }
  }
  var s = e.copyFile;
  s && (e.copyFile = l);
  function l(E, q, B, M) {
    return typeof B == "function" && (M = B, B = 0), z(E, q, B, M);
    function z(I, R, N, b, $) {
      return s(I, R, N, function(P) {
        P && (P.code === "EMFILE" || P.code === "ENFILE") ? Bt([z, [I, R, N, b], P, $ || Date.now(), Date.now()]) : typeof b == "function" && b.apply(this, arguments);
      });
    }
  }
  var m = e.readdir;
  e.readdir = f;
  var c = /^v[0-5]\./;
  function f(E, q, B) {
    typeof q == "function" && (B = q, q = null);
    var M = c.test(process.version) ? function(R, N, b, $) {
      return m(R, z(
        R,
        N,
        b,
        $
      ));
    } : function(R, N, b, $) {
      return m(R, N, z(
        R,
        N,
        b,
        $
      ));
    };
    return M(E, q, B);
    function z(I, R, N, b) {
      return function($, P) {
        $ && ($.code === "EMFILE" || $.code === "ENFILE") ? Bt([
          M,
          [I, R, N],
          $,
          b || Date.now(),
          Date.now()
        ]) : (P && P.sort && P.sort(), typeof N == "function" && N.call(this, $, P));
      };
    }
  }
  if (process.version.substr(0, 4) === "v0.8") {
    var d = Xf(e);
    S = d.ReadStream, D = d.WriteStream;
  }
  var g = e.ReadStream;
  g && (S.prototype = Object.create(g.prototype), S.prototype.open = T);
  var v = e.WriteStream;
  v && (D.prototype = Object.create(v.prototype), D.prototype.open = x), Object.defineProperty(e, "ReadStream", {
    get: function() {
      return S;
    },
    set: function(E) {
      S = E;
    },
    enumerable: !0,
    configurable: !0
  }), Object.defineProperty(e, "WriteStream", {
    get: function() {
      return D;
    },
    set: function(E) {
      D = E;
    },
    enumerable: !0,
    configurable: !0
  });
  var y = S;
  Object.defineProperty(e, "FileReadStream", {
    get: function() {
      return y;
    },
    set: function(E) {
      y = E;
    },
    enumerable: !0,
    configurable: !0
  });
  var A = D;
  Object.defineProperty(e, "FileWriteStream", {
    get: function() {
      return A;
    },
    set: function(E) {
      A = E;
    },
    enumerable: !0,
    configurable: !0
  });
  function S(E, q) {
    return this instanceof S ? (g.apply(this, arguments), this) : S.apply(Object.create(S.prototype), arguments);
  }
  function T() {
    var E = this;
    De(E.path, E.flags, E.mode, function(q, B) {
      q ? (E.autoClose && E.destroy(), E.emit("error", q)) : (E.fd = B, E.emit("open", B), E.read());
    });
  }
  function D(E, q) {
    return this instanceof D ? (v.apply(this, arguments), this) : D.apply(Object.create(D.prototype), arguments);
  }
  function x() {
    var E = this;
    De(E.path, E.flags, E.mode, function(q, B) {
      q ? (E.destroy(), E.emit("error", q)) : (E.fd = B, E.emit("open", B));
    });
  }
  function Z(E, q) {
    return new e.ReadStream(E, q);
  }
  function oe(E, q) {
    return new e.WriteStream(E, q);
  }
  var V = e.open;
  e.open = De;
  function De(E, q, B, M) {
    return typeof B == "function" && (M = B, B = null), z(E, q, B, M);
    function z(I, R, N, b, $) {
      return V(I, R, N, function(P, k) {
        P && (P.code === "EMFILE" || P.code === "ENFILE") ? Bt([z, [I, R, N, b], P, $ || Date.now(), Date.now()]) : typeof b == "function" && b.apply(this, arguments);
      });
    }
  }
  return e;
}
function Bt(e) {
  Nt("ENQUEUE", e[0].name, e[1]), te[me].push(e), _o();
}
var cn;
function wa() {
  for (var e = Date.now(), t = 0; t < te[me].length; ++t)
    te[me][t].length > 2 && (te[me][t][3] = e, te[me][t][4] = e);
  _o();
}
function _o() {
  if (clearTimeout(cn), cn = void 0, te[me].length !== 0) {
    var e = te[me].shift(), t = e[0], r = e[1], n = e[2], i = e[3], o = e[4];
    if (i === void 0)
      Nt("RETRY", t.name, r), t.apply(null, r);
    else if (Date.now() - i >= 6e4) {
      Nt("TIMEOUT", t.name, r);
      var a = r.pop();
      typeof a == "function" && a.call(null, n);
    } else {
      var s = Date.now() - o, l = Math.max(o - i, 1), m = Math.min(l * 1.2, 100);
      s >= m ? (Nt("RETRY", t.name, r), t.apply(null, r.concat([i]))) : te[me].push(e);
    }
    cn === void 0 && (cn = setTimeout(_o, 0));
  }
}
(function(e) {
  const t = be.fromCallback, r = Re, n = [
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
  }, e.read = function(i, o, a, s, l, m) {
    return typeof m == "function" ? r.read(i, o, a, s, l, m) : new Promise((c, f) => {
      r.read(i, o, a, s, l, (d, g, v) => {
        if (d) return f(d);
        c({ bytesRead: g, buffer: v });
      });
    });
  }, e.write = function(i, o, ...a) {
    return typeof a[a.length - 1] == "function" ? r.write(i, o, ...a) : new Promise((s, l) => {
      r.write(i, o, ...a, (m, c, f) => {
        if (m) return l(m);
        s({ bytesWritten: c, buffer: f });
      });
    });
  }, typeof r.writev == "function" && (e.writev = function(i, o, ...a) {
    return typeof a[a.length - 1] == "function" ? r.writev(i, o, ...a) : new Promise((s, l) => {
      r.writev(i, o, ...a, (m, c, f) => {
        if (m) return l(m);
        s({ bytesWritten: c, buffers: f });
      });
    });
  }), typeof r.realpath.native == "function" ? e.realpath.native = t(r.realpath.native) : process.emitWarning(
    "fs.realpath.native is not a function. Is fs being monkey-patched?",
    "Warning",
    "fs-extra-WARN0003"
  );
})(xt);
var Ao = {}, wl = {};
const Zf = re;
wl.checkPath = function(t) {
  if (process.platform === "win32" && /[<>:"|?*]/.test(t.replace(Zf.parse(t).root, ""))) {
    const n = new Error(`Path contains invalid characters: ${t}`);
    throw n.code = "EINVAL", n;
  }
};
const _l = xt, { checkPath: Al } = wl, Tl = (e) => {
  const t = { mode: 511 };
  return typeof e == "number" ? e : { ...t, ...e }.mode;
};
Ao.makeDir = async (e, t) => (Al(e), _l.mkdir(e, {
  mode: Tl(t),
  recursive: !0
}));
Ao.makeDirSync = (e, t) => (Al(e), _l.mkdirSync(e, {
  mode: Tl(t),
  recursive: !0
}));
const ed = be.fromPromise, { makeDir: td, makeDirSync: _i } = Ao, Ai = ed(td);
var Xe = {
  mkdirs: Ai,
  mkdirsSync: _i,
  // alias
  mkdirp: Ai,
  mkdirpSync: _i,
  ensureDir: Ai,
  ensureDirSync: _i
};
const rd = be.fromPromise, Sl = xt;
function nd(e) {
  return Sl.access(e).then(() => !0).catch(() => !1);
}
var Lt = {
  pathExists: rd(nd),
  pathExistsSync: Sl.existsSync
};
const Jt = Re;
function id(e, t, r, n) {
  Jt.open(e, "r+", (i, o) => {
    if (i) return n(i);
    Jt.futimes(o, t, r, (a) => {
      Jt.close(o, (s) => {
        n && n(a || s);
      });
    });
  });
}
function od(e, t, r) {
  const n = Jt.openSync(e, "r+");
  return Jt.futimesSync(n, t, r), Jt.closeSync(n);
}
var Cl = {
  utimesMillis: id,
  utimesMillisSync: od
};
const Zt = xt, de = re, ad = vo;
function sd(e, t, r) {
  const n = r.dereference ? (i) => Zt.stat(i, { bigint: !0 }) : (i) => Zt.lstat(i, { bigint: !0 });
  return Promise.all([
    n(e),
    n(t).catch((i) => {
      if (i.code === "ENOENT") return null;
      throw i;
    })
  ]).then(([i, o]) => ({ srcStat: i, destStat: o }));
}
function ld(e, t, r) {
  let n;
  const i = r.dereference ? (a) => Zt.statSync(a, { bigint: !0 }) : (a) => Zt.lstatSync(a, { bigint: !0 }), o = i(e);
  try {
    n = i(t);
  } catch (a) {
    if (a.code === "ENOENT") return { srcStat: o, destStat: null };
    throw a;
  }
  return { srcStat: o, destStat: n };
}
function cd(e, t, r, n, i) {
  ad.callbackify(sd)(e, t, n, (o, a) => {
    if (o) return i(o);
    const { srcStat: s, destStat: l } = a;
    if (l) {
      if (Br(s, l)) {
        const m = de.basename(e), c = de.basename(t);
        return r === "move" && m !== c && m.toLowerCase() === c.toLowerCase() ? i(null, { srcStat: s, destStat: l, isChangingCase: !0 }) : i(new Error("Source and destination must not be the same."));
      }
      if (s.isDirectory() && !l.isDirectory())
        return i(new Error(`Cannot overwrite non-directory '${t}' with directory '${e}'.`));
      if (!s.isDirectory() && l.isDirectory())
        return i(new Error(`Cannot overwrite directory '${t}' with non-directory '${e}'.`));
    }
    return s.isDirectory() && To(e, t) ? i(new Error(Wn(e, t, r))) : i(null, { srcStat: s, destStat: l });
  });
}
function ud(e, t, r, n) {
  const { srcStat: i, destStat: o } = ld(e, t, n);
  if (o) {
    if (Br(i, o)) {
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
  if (i.isDirectory() && To(e, t))
    throw new Error(Wn(e, t, r));
  return { srcStat: i, destStat: o };
}
function bl(e, t, r, n, i) {
  const o = de.resolve(de.dirname(e)), a = de.resolve(de.dirname(r));
  if (a === o || a === de.parse(a).root) return i();
  Zt.stat(a, { bigint: !0 }, (s, l) => s ? s.code === "ENOENT" ? i() : i(s) : Br(t, l) ? i(new Error(Wn(e, r, n))) : bl(e, t, a, n, i));
}
function Rl(e, t, r, n) {
  const i = de.resolve(de.dirname(e)), o = de.resolve(de.dirname(r));
  if (o === i || o === de.parse(o).root) return;
  let a;
  try {
    a = Zt.statSync(o, { bigint: !0 });
  } catch (s) {
    if (s.code === "ENOENT") return;
    throw s;
  }
  if (Br(t, a))
    throw new Error(Wn(e, r, n));
  return Rl(e, t, o, n);
}
function Br(e, t) {
  return t.ino && t.dev && t.ino === e.ino && t.dev === e.dev;
}
function To(e, t) {
  const r = de.resolve(e).split(de.sep).filter((i) => i), n = de.resolve(t).split(de.sep).filter((i) => i);
  return r.reduce((i, o, a) => i && n[a] === o, !0);
}
function Wn(e, t, r) {
  return `Cannot ${r} '${e}' to a subdirectory of itself, '${t}'.`;
}
var nr = {
  checkPaths: cd,
  checkPathsSync: ud,
  checkParentPaths: bl,
  checkParentPathsSync: Rl,
  isSrcSubdir: To,
  areIdentical: Br
};
const Pe = Re, Tr = re, fd = Xe.mkdirs, dd = Lt.pathExists, hd = Cl.utimesMillis, Sr = nr;
function pd(e, t, r, n) {
  typeof r == "function" && !n ? (n = r, r = {}) : typeof r == "function" && (r = { filter: r }), n = n || function() {
  }, r = r || {}, r.clobber = "clobber" in r ? !!r.clobber : !0, r.overwrite = "overwrite" in r ? !!r.overwrite : r.clobber, r.preserveTimestamps && process.arch === "ia32" && process.emitWarning(
    `Using the preserveTimestamps option in 32-bit node is not recommended;

	see https://github.com/jprichardson/node-fs-extra/issues/269`,
    "Warning",
    "fs-extra-WARN0001"
  ), Sr.checkPaths(e, t, "copy", r, (i, o) => {
    if (i) return n(i);
    const { srcStat: a, destStat: s } = o;
    Sr.checkParentPaths(e, a, t, "copy", (l) => l ? n(l) : r.filter ? Ol(_a, s, e, t, r, n) : _a(s, e, t, r, n));
  });
}
function _a(e, t, r, n, i) {
  const o = Tr.dirname(r);
  dd(o, (a, s) => {
    if (a) return i(a);
    if (s) return Dn(e, t, r, n, i);
    fd(o, (l) => l ? i(l) : Dn(e, t, r, n, i));
  });
}
function Ol(e, t, r, n, i, o) {
  Promise.resolve(i.filter(r, n)).then((a) => a ? e(t, r, n, i, o) : o(), (a) => o(a));
}
function md(e, t, r, n, i) {
  return n.filter ? Ol(Dn, e, t, r, n, i) : Dn(e, t, r, n, i);
}
function Dn(e, t, r, n, i) {
  (n.dereference ? Pe.stat : Pe.lstat)(t, (a, s) => a ? i(a) : s.isDirectory() ? Ad(s, e, t, r, n, i) : s.isFile() || s.isCharacterDevice() || s.isBlockDevice() ? gd(s, e, t, r, n, i) : s.isSymbolicLink() ? Cd(e, t, r, n, i) : s.isSocket() ? i(new Error(`Cannot copy a socket file: ${t}`)) : s.isFIFO() ? i(new Error(`Cannot copy a FIFO pipe: ${t}`)) : i(new Error(`Unknown file: ${t}`)));
}
function gd(e, t, r, n, i, o) {
  return t ? Ed(e, r, n, i, o) : Il(e, r, n, i, o);
}
function Ed(e, t, r, n, i) {
  if (n.overwrite)
    Pe.unlink(r, (o) => o ? i(o) : Il(e, t, r, n, i));
  else return n.errorOnExist ? i(new Error(`'${r}' already exists`)) : i();
}
function Il(e, t, r, n, i) {
  Pe.copyFile(t, r, (o) => o ? i(o) : n.preserveTimestamps ? yd(e.mode, t, r, i) : Vn(r, e.mode, i));
}
function yd(e, t, r, n) {
  return vd(e) ? wd(r, e, (i) => i ? n(i) : Aa(e, t, r, n)) : Aa(e, t, r, n);
}
function vd(e) {
  return (e & 128) === 0;
}
function wd(e, t, r) {
  return Vn(e, t | 128, r);
}
function Aa(e, t, r, n) {
  _d(t, r, (i) => i ? n(i) : Vn(r, e, n));
}
function Vn(e, t, r) {
  return Pe.chmod(e, t, r);
}
function _d(e, t, r) {
  Pe.stat(e, (n, i) => n ? r(n) : hd(t, i.atime, i.mtime, r));
}
function Ad(e, t, r, n, i, o) {
  return t ? Pl(r, n, i, o) : Td(e.mode, r, n, i, o);
}
function Td(e, t, r, n, i) {
  Pe.mkdir(r, (o) => {
    if (o) return i(o);
    Pl(t, r, n, (a) => a ? i(a) : Vn(r, e, i));
  });
}
function Pl(e, t, r, n) {
  Pe.readdir(e, (i, o) => i ? n(i) : Nl(o, e, t, r, n));
}
function Nl(e, t, r, n, i) {
  const o = e.pop();
  return o ? Sd(e, o, t, r, n, i) : i();
}
function Sd(e, t, r, n, i, o) {
  const a = Tr.join(r, t), s = Tr.join(n, t);
  Sr.checkPaths(a, s, "copy", i, (l, m) => {
    if (l) return o(l);
    const { destStat: c } = m;
    md(c, a, s, i, (f) => f ? o(f) : Nl(e, r, n, i, o));
  });
}
function Cd(e, t, r, n, i) {
  Pe.readlink(t, (o, a) => {
    if (o) return i(o);
    if (n.dereference && (a = Tr.resolve(process.cwd(), a)), e)
      Pe.readlink(r, (s, l) => s ? s.code === "EINVAL" || s.code === "UNKNOWN" ? Pe.symlink(a, r, i) : i(s) : (n.dereference && (l = Tr.resolve(process.cwd(), l)), Sr.isSrcSubdir(a, l) ? i(new Error(`Cannot copy '${a}' to a subdirectory of itself, '${l}'.`)) : e.isDirectory() && Sr.isSrcSubdir(l, a) ? i(new Error(`Cannot overwrite '${l}' with '${a}'.`)) : bd(a, r, i)));
    else
      return Pe.symlink(a, r, i);
  });
}
function bd(e, t, r) {
  Pe.unlink(t, (n) => n ? r(n) : Pe.symlink(e, t, r));
}
var Rd = pd;
const ve = Re, Cr = re, Od = Xe.mkdirsSync, Id = Cl.utimesMillisSync, br = nr;
function Pd(e, t, r) {
  typeof r == "function" && (r = { filter: r }), r = r || {}, r.clobber = "clobber" in r ? !!r.clobber : !0, r.overwrite = "overwrite" in r ? !!r.overwrite : r.clobber, r.preserveTimestamps && process.arch === "ia32" && process.emitWarning(
    `Using the preserveTimestamps option in 32-bit node is not recommended;

	see https://github.com/jprichardson/node-fs-extra/issues/269`,
    "Warning",
    "fs-extra-WARN0002"
  );
  const { srcStat: n, destStat: i } = br.checkPathsSync(e, t, "copy", r);
  return br.checkParentPathsSync(e, n, t, "copy"), Nd(i, e, t, r);
}
function Nd(e, t, r, n) {
  if (n.filter && !n.filter(t, r)) return;
  const i = Cr.dirname(r);
  return ve.existsSync(i) || Od(i), Dl(e, t, r, n);
}
function Dd(e, t, r, n) {
  if (!(n.filter && !n.filter(t, r)))
    return Dl(e, t, r, n);
}
function Dl(e, t, r, n) {
  const o = (n.dereference ? ve.statSync : ve.lstatSync)(t);
  if (o.isDirectory()) return Md(o, e, t, r, n);
  if (o.isFile() || o.isCharacterDevice() || o.isBlockDevice()) return $d(o, e, t, r, n);
  if (o.isSymbolicLink()) return Hd(e, t, r, n);
  throw o.isSocket() ? new Error(`Cannot copy a socket file: ${t}`) : o.isFIFO() ? new Error(`Cannot copy a FIFO pipe: ${t}`) : new Error(`Unknown file: ${t}`);
}
function $d(e, t, r, n, i) {
  return t ? Fd(e, r, n, i) : $l(e, r, n, i);
}
function Fd(e, t, r, n) {
  if (n.overwrite)
    return ve.unlinkSync(r), $l(e, t, r, n);
  if (n.errorOnExist)
    throw new Error(`'${r}' already exists`);
}
function $l(e, t, r, n) {
  return ve.copyFileSync(t, r), n.preserveTimestamps && xd(e.mode, t, r), So(r, e.mode);
}
function xd(e, t, r) {
  return Ld(e) && Ud(r, e), kd(t, r);
}
function Ld(e) {
  return (e & 128) === 0;
}
function Ud(e, t) {
  return So(e, t | 128);
}
function So(e, t) {
  return ve.chmodSync(e, t);
}
function kd(e, t) {
  const r = ve.statSync(e);
  return Id(t, r.atime, r.mtime);
}
function Md(e, t, r, n, i) {
  return t ? Fl(r, n, i) : Bd(e.mode, r, n, i);
}
function Bd(e, t, r, n) {
  return ve.mkdirSync(r), Fl(t, r, n), So(r, e);
}
function Fl(e, t, r) {
  ve.readdirSync(e).forEach((n) => jd(n, e, t, r));
}
function jd(e, t, r, n) {
  const i = Cr.join(t, e), o = Cr.join(r, e), { destStat: a } = br.checkPathsSync(i, o, "copy", n);
  return Dd(a, i, o, n);
}
function Hd(e, t, r, n) {
  let i = ve.readlinkSync(t);
  if (n.dereference && (i = Cr.resolve(process.cwd(), i)), e) {
    let o;
    try {
      o = ve.readlinkSync(r);
    } catch (a) {
      if (a.code === "EINVAL" || a.code === "UNKNOWN") return ve.symlinkSync(i, r);
      throw a;
    }
    if (n.dereference && (o = Cr.resolve(process.cwd(), o)), br.isSrcSubdir(i, o))
      throw new Error(`Cannot copy '${i}' to a subdirectory of itself, '${o}'.`);
    if (ve.statSync(r).isDirectory() && br.isSrcSubdir(o, i))
      throw new Error(`Cannot overwrite '${o}' with '${i}'.`);
    return qd(i, r);
  } else
    return ve.symlinkSync(i, r);
}
function qd(e, t) {
  return ve.unlinkSync(t), ve.symlinkSync(e, t);
}
var Gd = Pd;
const Wd = be.fromCallback;
var Co = {
  copy: Wd(Rd),
  copySync: Gd
};
const Ta = Re, xl = re, K = pl, Rr = process.platform === "win32";
function Ll(e) {
  [
    "unlink",
    "chmod",
    "stat",
    "lstat",
    "rmdir",
    "readdir"
  ].forEach((r) => {
    e[r] = e[r] || Ta[r], r = r + "Sync", e[r] = e[r] || Ta[r];
  }), e.maxBusyTries = e.maxBusyTries || 3;
}
function bo(e, t, r) {
  let n = 0;
  typeof t == "function" && (r = t, t = {}), K(e, "rimraf: missing path"), K.strictEqual(typeof e, "string", "rimraf: path should be a string"), K.strictEqual(typeof r, "function", "rimraf: callback function required"), K(t, "rimraf: invalid options argument provided"), K.strictEqual(typeof t, "object", "rimraf: options should be object"), Ll(t), Sa(e, t, function i(o) {
    if (o) {
      if ((o.code === "EBUSY" || o.code === "ENOTEMPTY" || o.code === "EPERM") && n < t.maxBusyTries) {
        n++;
        const a = n * 100;
        return setTimeout(() => Sa(e, t, i), a);
      }
      o.code === "ENOENT" && (o = null);
    }
    r(o);
  });
}
function Sa(e, t, r) {
  K(e), K(t), K(typeof r == "function"), t.lstat(e, (n, i) => {
    if (n && n.code === "ENOENT")
      return r(null);
    if (n && n.code === "EPERM" && Rr)
      return Ca(e, t, n, r);
    if (i && i.isDirectory())
      return bn(e, t, n, r);
    t.unlink(e, (o) => {
      if (o) {
        if (o.code === "ENOENT")
          return r(null);
        if (o.code === "EPERM")
          return Rr ? Ca(e, t, o, r) : bn(e, t, o, r);
        if (o.code === "EISDIR")
          return bn(e, t, o, r);
      }
      return r(o);
    });
  });
}
function Ca(e, t, r, n) {
  K(e), K(t), K(typeof n == "function"), t.chmod(e, 438, (i) => {
    i ? n(i.code === "ENOENT" ? null : r) : t.stat(e, (o, a) => {
      o ? n(o.code === "ENOENT" ? null : r) : a.isDirectory() ? bn(e, t, r, n) : t.unlink(e, n);
    });
  });
}
function ba(e, t, r) {
  let n;
  K(e), K(t);
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
  n.isDirectory() ? Rn(e, t, r) : t.unlinkSync(e);
}
function bn(e, t, r, n) {
  K(e), K(t), K(typeof n == "function"), t.rmdir(e, (i) => {
    i && (i.code === "ENOTEMPTY" || i.code === "EEXIST" || i.code === "EPERM") ? Vd(e, t, n) : i && i.code === "ENOTDIR" ? n(r) : n(i);
  });
}
function Vd(e, t, r) {
  K(e), K(t), K(typeof r == "function"), t.readdir(e, (n, i) => {
    if (n) return r(n);
    let o = i.length, a;
    if (o === 0) return t.rmdir(e, r);
    i.forEach((s) => {
      bo(xl.join(e, s), t, (l) => {
        if (!a) {
          if (l) return r(a = l);
          --o === 0 && t.rmdir(e, r);
        }
      });
    });
  });
}
function Ul(e, t) {
  let r;
  t = t || {}, Ll(t), K(e, "rimraf: missing path"), K.strictEqual(typeof e, "string", "rimraf: path should be a string"), K(t, "rimraf: missing options"), K.strictEqual(typeof t, "object", "rimraf: options should be object");
  try {
    r = t.lstatSync(e);
  } catch (n) {
    if (n.code === "ENOENT")
      return;
    n.code === "EPERM" && Rr && ba(e, t, n);
  }
  try {
    r && r.isDirectory() ? Rn(e, t, null) : t.unlinkSync(e);
  } catch (n) {
    if (n.code === "ENOENT")
      return;
    if (n.code === "EPERM")
      return Rr ? ba(e, t, n) : Rn(e, t, n);
    if (n.code !== "EISDIR")
      throw n;
    Rn(e, t, n);
  }
}
function Rn(e, t, r) {
  K(e), K(t);
  try {
    t.rmdirSync(e);
  } catch (n) {
    if (n.code === "ENOTDIR")
      throw r;
    if (n.code === "ENOTEMPTY" || n.code === "EEXIST" || n.code === "EPERM")
      Yd(e, t);
    else if (n.code !== "ENOENT")
      throw n;
  }
}
function Yd(e, t) {
  if (K(e), K(t), t.readdirSync(e).forEach((r) => Ul(xl.join(e, r), t)), Rr) {
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
var zd = bo;
bo.sync = Ul;
const $n = Re, Xd = be.fromCallback, kl = zd;
function Kd(e, t) {
  if ($n.rm) return $n.rm(e, { recursive: !0, force: !0 }, t);
  kl(e, t);
}
function Jd(e) {
  if ($n.rmSync) return $n.rmSync(e, { recursive: !0, force: !0 });
  kl.sync(e);
}
var Yn = {
  remove: Xd(Kd),
  removeSync: Jd
};
const Qd = be.fromPromise, Ml = xt, Bl = re, jl = Xe, Hl = Yn, Ra = Qd(async function(t) {
  let r;
  try {
    r = await Ml.readdir(t);
  } catch {
    return jl.mkdirs(t);
  }
  return Promise.all(r.map((n) => Hl.remove(Bl.join(t, n))));
});
function Oa(e) {
  let t;
  try {
    t = Ml.readdirSync(e);
  } catch {
    return jl.mkdirsSync(e);
  }
  t.forEach((r) => {
    r = Bl.join(e, r), Hl.removeSync(r);
  });
}
var Zd = {
  emptyDirSync: Oa,
  emptydirSync: Oa,
  emptyDir: Ra,
  emptydir: Ra
};
const eh = be.fromCallback, ql = re, st = Re, Gl = Xe;
function th(e, t) {
  function r() {
    st.writeFile(e, "", (n) => {
      if (n) return t(n);
      t();
    });
  }
  st.stat(e, (n, i) => {
    if (!n && i.isFile()) return t();
    const o = ql.dirname(e);
    st.stat(o, (a, s) => {
      if (a)
        return a.code === "ENOENT" ? Gl.mkdirs(o, (l) => {
          if (l) return t(l);
          r();
        }) : t(a);
      s.isDirectory() ? r() : st.readdir(o, (l) => {
        if (l) return t(l);
      });
    });
  });
}
function rh(e) {
  let t;
  try {
    t = st.statSync(e);
  } catch {
  }
  if (t && t.isFile()) return;
  const r = ql.dirname(e);
  try {
    st.statSync(r).isDirectory() || st.readdirSync(r);
  } catch (n) {
    if (n && n.code === "ENOENT") Gl.mkdirsSync(r);
    else throw n;
  }
  st.writeFileSync(e, "");
}
var nh = {
  createFile: eh(th),
  createFileSync: rh
};
const ih = be.fromCallback, Wl = re, at = Re, Vl = Xe, oh = Lt.pathExists, { areIdentical: Yl } = nr;
function ah(e, t, r) {
  function n(i, o) {
    at.link(i, o, (a) => {
      if (a) return r(a);
      r(null);
    });
  }
  at.lstat(t, (i, o) => {
    at.lstat(e, (a, s) => {
      if (a)
        return a.message = a.message.replace("lstat", "ensureLink"), r(a);
      if (o && Yl(s, o)) return r(null);
      const l = Wl.dirname(t);
      oh(l, (m, c) => {
        if (m) return r(m);
        if (c) return n(e, t);
        Vl.mkdirs(l, (f) => {
          if (f) return r(f);
          n(e, t);
        });
      });
    });
  });
}
function sh(e, t) {
  let r;
  try {
    r = at.lstatSync(t);
  } catch {
  }
  try {
    const o = at.lstatSync(e);
    if (r && Yl(o, r)) return;
  } catch (o) {
    throw o.message = o.message.replace("lstat", "ensureLink"), o;
  }
  const n = Wl.dirname(t);
  return at.existsSync(n) || Vl.mkdirsSync(n), at.linkSync(e, t);
}
var lh = {
  createLink: ih(ah),
  createLinkSync: sh
};
const lt = re, vr = Re, ch = Lt.pathExists;
function uh(e, t, r) {
  if (lt.isAbsolute(e))
    return vr.lstat(e, (n) => n ? (n.message = n.message.replace("lstat", "ensureSymlink"), r(n)) : r(null, {
      toCwd: e,
      toDst: e
    }));
  {
    const n = lt.dirname(t), i = lt.join(n, e);
    return ch(i, (o, a) => o ? r(o) : a ? r(null, {
      toCwd: i,
      toDst: e
    }) : vr.lstat(e, (s) => s ? (s.message = s.message.replace("lstat", "ensureSymlink"), r(s)) : r(null, {
      toCwd: e,
      toDst: lt.relative(n, e)
    })));
  }
}
function fh(e, t) {
  let r;
  if (lt.isAbsolute(e)) {
    if (r = vr.existsSync(e), !r) throw new Error("absolute srcpath does not exist");
    return {
      toCwd: e,
      toDst: e
    };
  } else {
    const n = lt.dirname(t), i = lt.join(n, e);
    if (r = vr.existsSync(i), r)
      return {
        toCwd: i,
        toDst: e
      };
    if (r = vr.existsSync(e), !r) throw new Error("relative srcpath does not exist");
    return {
      toCwd: e,
      toDst: lt.relative(n, e)
    };
  }
}
var dh = {
  symlinkPaths: uh,
  symlinkPathsSync: fh
};
const zl = Re;
function hh(e, t, r) {
  if (r = typeof t == "function" ? t : r, t = typeof t == "function" ? !1 : t, t) return r(null, t);
  zl.lstat(e, (n, i) => {
    if (n) return r(null, "file");
    t = i && i.isDirectory() ? "dir" : "file", r(null, t);
  });
}
function ph(e, t) {
  let r;
  if (t) return t;
  try {
    r = zl.lstatSync(e);
  } catch {
    return "file";
  }
  return r && r.isDirectory() ? "dir" : "file";
}
var mh = {
  symlinkType: hh,
  symlinkTypeSync: ph
};
const gh = be.fromCallback, Xl = re, Be = xt, Kl = Xe, Eh = Kl.mkdirs, yh = Kl.mkdirsSync, Jl = dh, vh = Jl.symlinkPaths, wh = Jl.symlinkPathsSync, Ql = mh, _h = Ql.symlinkType, Ah = Ql.symlinkTypeSync, Th = Lt.pathExists, { areIdentical: Zl } = nr;
function Sh(e, t, r, n) {
  n = typeof r == "function" ? r : n, r = typeof r == "function" ? !1 : r, Be.lstat(t, (i, o) => {
    !i && o.isSymbolicLink() ? Promise.all([
      Be.stat(e),
      Be.stat(t)
    ]).then(([a, s]) => {
      if (Zl(a, s)) return n(null);
      Ia(e, t, r, n);
    }) : Ia(e, t, r, n);
  });
}
function Ia(e, t, r, n) {
  vh(e, t, (i, o) => {
    if (i) return n(i);
    e = o.toDst, _h(o.toCwd, r, (a, s) => {
      if (a) return n(a);
      const l = Xl.dirname(t);
      Th(l, (m, c) => {
        if (m) return n(m);
        if (c) return Be.symlink(e, t, s, n);
        Eh(l, (f) => {
          if (f) return n(f);
          Be.symlink(e, t, s, n);
        });
      });
    });
  });
}
function Ch(e, t, r) {
  let n;
  try {
    n = Be.lstatSync(t);
  } catch {
  }
  if (n && n.isSymbolicLink()) {
    const s = Be.statSync(e), l = Be.statSync(t);
    if (Zl(s, l)) return;
  }
  const i = wh(e, t);
  e = i.toDst, r = Ah(i.toCwd, r);
  const o = Xl.dirname(t);
  return Be.existsSync(o) || yh(o), Be.symlinkSync(e, t, r);
}
var bh = {
  createSymlink: gh(Sh),
  createSymlinkSync: Ch
};
const { createFile: Pa, createFileSync: Na } = nh, { createLink: Da, createLinkSync: $a } = lh, { createSymlink: Fa, createSymlinkSync: xa } = bh;
var Rh = {
  // file
  createFile: Pa,
  createFileSync: Na,
  ensureFile: Pa,
  ensureFileSync: Na,
  // link
  createLink: Da,
  createLinkSync: $a,
  ensureLink: Da,
  ensureLinkSync: $a,
  // symlink
  createSymlink: Fa,
  createSymlinkSync: xa,
  ensureSymlink: Fa,
  ensureSymlinkSync: xa
};
function Oh(e, { EOL: t = `
`, finalEOL: r = !0, replacer: n = null, spaces: i } = {}) {
  const o = r ? t : "";
  return JSON.stringify(e, n, i).replace(/\n/g, t) + o;
}
function Ih(e) {
  return Buffer.isBuffer(e) && (e = e.toString("utf8")), e.replace(/^\uFEFF/, "");
}
var Ro = { stringify: Oh, stripBom: Ih };
let er;
try {
  er = Re;
} catch {
  er = gt;
}
const zn = be, { stringify: ec, stripBom: tc } = Ro;
async function Ph(e, t = {}) {
  typeof t == "string" && (t = { encoding: t });
  const r = t.fs || er, n = "throws" in t ? t.throws : !0;
  let i = await zn.fromCallback(r.readFile)(e, t);
  i = tc(i);
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
const Nh = zn.fromPromise(Ph);
function Dh(e, t = {}) {
  typeof t == "string" && (t = { encoding: t });
  const r = t.fs || er, n = "throws" in t ? t.throws : !0;
  try {
    let i = r.readFileSync(e, t);
    return i = tc(i), JSON.parse(i, t.reviver);
  } catch (i) {
    if (n)
      throw i.message = `${e}: ${i.message}`, i;
    return null;
  }
}
async function $h(e, t, r = {}) {
  const n = r.fs || er, i = ec(t, r);
  await zn.fromCallback(n.writeFile)(e, i, r);
}
const Fh = zn.fromPromise($h);
function xh(e, t, r = {}) {
  const n = r.fs || er, i = ec(t, r);
  return n.writeFileSync(e, i, r);
}
var Lh = {
  readFile: Nh,
  readFileSync: Dh,
  writeFile: Fh,
  writeFileSync: xh
};
const un = Lh;
var Uh = {
  // jsonfile exports
  readJson: un.readFile,
  readJsonSync: un.readFileSync,
  writeJson: un.writeFile,
  writeJsonSync: un.writeFileSync
};
const kh = be.fromCallback, wr = Re, rc = re, nc = Xe, Mh = Lt.pathExists;
function Bh(e, t, r, n) {
  typeof r == "function" && (n = r, r = "utf8");
  const i = rc.dirname(e);
  Mh(i, (o, a) => {
    if (o) return n(o);
    if (a) return wr.writeFile(e, t, r, n);
    nc.mkdirs(i, (s) => {
      if (s) return n(s);
      wr.writeFile(e, t, r, n);
    });
  });
}
function jh(e, ...t) {
  const r = rc.dirname(e);
  if (wr.existsSync(r))
    return wr.writeFileSync(e, ...t);
  nc.mkdirsSync(r), wr.writeFileSync(e, ...t);
}
var Oo = {
  outputFile: kh(Bh),
  outputFileSync: jh
};
const { stringify: Hh } = Ro, { outputFile: qh } = Oo;
async function Gh(e, t, r = {}) {
  const n = Hh(t, r);
  await qh(e, n, r);
}
var Wh = Gh;
const { stringify: Vh } = Ro, { outputFileSync: Yh } = Oo;
function zh(e, t, r) {
  const n = Vh(t, r);
  Yh(e, n, r);
}
var Xh = zh;
const Kh = be.fromPromise, Ce = Uh;
Ce.outputJson = Kh(Wh);
Ce.outputJsonSync = Xh;
Ce.outputJSON = Ce.outputJson;
Ce.outputJSONSync = Ce.outputJsonSync;
Ce.writeJSON = Ce.writeJson;
Ce.writeJSONSync = Ce.writeJsonSync;
Ce.readJSON = Ce.readJson;
Ce.readJSONSync = Ce.readJsonSync;
var Jh = Ce;
const Qh = Re, to = re, Zh = Co.copy, ic = Yn.remove, ep = Xe.mkdirp, tp = Lt.pathExists, La = nr;
function rp(e, t, r, n) {
  typeof r == "function" && (n = r, r = {}), r = r || {};
  const i = r.overwrite || r.clobber || !1;
  La.checkPaths(e, t, "move", r, (o, a) => {
    if (o) return n(o);
    const { srcStat: s, isChangingCase: l = !1 } = a;
    La.checkParentPaths(e, s, t, "move", (m) => {
      if (m) return n(m);
      if (np(t)) return Ua(e, t, i, l, n);
      ep(to.dirname(t), (c) => c ? n(c) : Ua(e, t, i, l, n));
    });
  });
}
function np(e) {
  const t = to.dirname(e);
  return to.parse(t).root === t;
}
function Ua(e, t, r, n, i) {
  if (n) return Ti(e, t, r, i);
  if (r)
    return ic(t, (o) => o ? i(o) : Ti(e, t, r, i));
  tp(t, (o, a) => o ? i(o) : a ? i(new Error("dest already exists.")) : Ti(e, t, r, i));
}
function Ti(e, t, r, n) {
  Qh.rename(e, t, (i) => i ? i.code !== "EXDEV" ? n(i) : ip(e, t, r, n) : n());
}
function ip(e, t, r, n) {
  Zh(e, t, {
    overwrite: r,
    errorOnExist: !0
  }, (o) => o ? n(o) : ic(e, n));
}
var op = rp;
const oc = Re, ro = re, ap = Co.copySync, ac = Yn.removeSync, sp = Xe.mkdirpSync, ka = nr;
function lp(e, t, r) {
  r = r || {};
  const n = r.overwrite || r.clobber || !1, { srcStat: i, isChangingCase: o = !1 } = ka.checkPathsSync(e, t, "move", r);
  return ka.checkParentPathsSync(e, i, t, "move"), cp(t) || sp(ro.dirname(t)), up(e, t, n, o);
}
function cp(e) {
  const t = ro.dirname(e);
  return ro.parse(t).root === t;
}
function up(e, t, r, n) {
  if (n) return Si(e, t, r);
  if (r)
    return ac(t), Si(e, t, r);
  if (oc.existsSync(t)) throw new Error("dest already exists.");
  return Si(e, t, r);
}
function Si(e, t, r) {
  try {
    oc.renameSync(e, t);
  } catch (n) {
    if (n.code !== "EXDEV") throw n;
    return fp(e, t, r);
  }
}
function fp(e, t, r) {
  return ap(e, t, {
    overwrite: r,
    errorOnExist: !0
  }), ac(e);
}
var dp = lp;
const hp = be.fromCallback;
var pp = {
  move: hp(op),
  moveSync: dp
}, yt = {
  // Export promiseified graceful-fs:
  ...xt,
  // Export extra methods:
  ...Co,
  ...Zd,
  ...Rh,
  ...Jh,
  ...Xe,
  ...pp,
  ...Oo,
  ...Lt,
  ...Yn
}, Ut = {}, ft = {}, ce = {}, dt = {};
Object.defineProperty(dt, "__esModule", { value: !0 });
dt.CancellationError = dt.CancellationToken = void 0;
const mp = ml;
class gp extends mp.EventEmitter {
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
      return Promise.reject(new no());
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
          o(new no());
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
dt.CancellationToken = gp;
class no extends Error {
  constructor() {
    super("cancelled");
  }
}
dt.CancellationError = no;
var ir = {};
Object.defineProperty(ir, "__esModule", { value: !0 });
ir.newError = Ep;
function Ep(e, t) {
  const r = new Error(e);
  return r.code = t, r;
}
var Se = {}, io = { exports: {} }, fn = { exports: {} }, Ci, Ma;
function yp() {
  if (Ma) return Ci;
  Ma = 1;
  var e = 1e3, t = e * 60, r = t * 60, n = r * 24, i = n * 7, o = n * 365.25;
  Ci = function(c, f) {
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
        var d = parseFloat(f[1]), g = (f[2] || "ms").toLowerCase();
        switch (g) {
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
    return f >= n ? m(c, f, n, "day") : f >= r ? m(c, f, r, "hour") : f >= t ? m(c, f, t, "minute") : f >= e ? m(c, f, e, "second") : c + " ms";
  }
  function m(c, f, d, g) {
    var v = f >= d * 1.5;
    return Math.round(c / d) + " " + g + (v ? "s" : "");
  }
  return Ci;
}
var bi, Ba;
function sc() {
  if (Ba) return bi;
  Ba = 1;
  function e(t) {
    n.debug = n, n.default = n, n.coerce = m, n.disable = s, n.enable = o, n.enabled = l, n.humanize = yp(), n.destroy = c, Object.keys(t).forEach((f) => {
      n[f] = t[f];
    }), n.names = [], n.skips = [], n.formatters = {};
    function r(f) {
      let d = 0;
      for (let g = 0; g < f.length; g++)
        d = (d << 5) - d + f.charCodeAt(g), d |= 0;
      return n.colors[Math.abs(d) % n.colors.length];
    }
    n.selectColor = r;
    function n(f) {
      let d, g = null, v, y;
      function A(...S) {
        if (!A.enabled)
          return;
        const T = A, D = Number(/* @__PURE__ */ new Date()), x = D - (d || D);
        T.diff = x, T.prev = d, T.curr = D, d = D, S[0] = n.coerce(S[0]), typeof S[0] != "string" && S.unshift("%O");
        let Z = 0;
        S[0] = S[0].replace(/%([a-zA-Z%])/g, (V, De) => {
          if (V === "%%")
            return "%";
          Z++;
          const E = n.formatters[De];
          if (typeof E == "function") {
            const q = S[Z];
            V = E.call(T, q), S.splice(Z, 1), Z--;
          }
          return V;
        }), n.formatArgs.call(T, S), (T.log || n.log).apply(T, S);
      }
      return A.namespace = f, A.useColors = n.useColors(), A.color = n.selectColor(f), A.extend = i, A.destroy = n.destroy, Object.defineProperty(A, "enabled", {
        enumerable: !0,
        configurable: !1,
        get: () => g !== null ? g : (v !== n.namespaces && (v = n.namespaces, y = n.enabled(f)), y),
        set: (S) => {
          g = S;
        }
      }), typeof n.init == "function" && n.init(A), A;
    }
    function i(f, d) {
      const g = n(this.namespace + (typeof d > "u" ? ":" : d) + f);
      return g.log = this.log, g;
    }
    function o(f) {
      n.save(f), n.namespaces = f, n.names = [], n.skips = [];
      const d = (typeof f == "string" ? f : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
      for (const g of d)
        g[0] === "-" ? n.skips.push(g.slice(1)) : n.names.push(g);
    }
    function a(f, d) {
      let g = 0, v = 0, y = -1, A = 0;
      for (; g < f.length; )
        if (v < d.length && (d[v] === f[g] || d[v] === "*"))
          d[v] === "*" ? (y = v, A = g, v++) : (g++, v++);
        else if (y !== -1)
          v = y + 1, A++, g = A;
        else
          return !1;
      for (; v < d.length && d[v] === "*"; )
        v++;
      return v === d.length;
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
    function m(f) {
      return f instanceof Error ? f.stack || f.message : f;
    }
    function c() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    return n.enable(n.load()), n;
  }
  return bi = e, bi;
}
var ja;
function vp() {
  return ja || (ja = 1, function(e, t) {
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
      const m = "color: " + this.color;
      l.splice(1, 0, m, "color: inherit");
      let c = 0, f = 0;
      l[0].replace(/%[a-zA-Z%]/g, (d) => {
        d !== "%%" && (c++, d === "%c" && (f = c));
      }), l.splice(f, 0, m);
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
    e.exports = sc()(t);
    const { formatters: s } = e.exports;
    s.j = function(l) {
      try {
        return JSON.stringify(l);
      } catch (m) {
        return "[UnexpectedJSONParseError]: " + m.message;
      }
    };
  }(fn, fn.exports)), fn.exports;
}
var dn = { exports: {} }, Ri, Ha;
function wp() {
  return Ha || (Ha = 1, Ri = (e, t = process.argv) => {
    const r = e.startsWith("-") ? "" : e.length === 1 ? "-" : "--", n = t.indexOf(r + e), i = t.indexOf("--");
    return n !== -1 && (i === -1 || n < i);
  }), Ri;
}
var Oi, qa;
function _p() {
  if (qa) return Oi;
  qa = 1;
  const e = Gn, t = gl, r = wp(), { env: n } = process;
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
  function a(l, m) {
    if (i === 0)
      return 0;
    if (r("color=16m") || r("color=full") || r("color=truecolor"))
      return 3;
    if (r("color=256"))
      return 2;
    if (l && !m && i === void 0)
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
    const m = a(l, l && l.isTTY);
    return o(m);
  }
  return Oi = {
    supportsColor: s,
    stdout: o(a(!0, t.isatty(1))),
    stderr: o(a(!0, t.isatty(2)))
  }, Oi;
}
var Ga;
function Ap() {
  return Ga || (Ga = 1, function(e, t) {
    const r = gl, n = vo;
    t.init = c, t.log = s, t.formatArgs = o, t.save = l, t.load = m, t.useColors = i, t.destroy = n.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    ), t.colors = [6, 2, 3, 4, 5, 1];
    try {
      const d = _p();
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
    t.inspectOpts = Object.keys(process.env).filter((d) => /^debug_/i.test(d)).reduce((d, g) => {
      const v = g.substring(6).toLowerCase().replace(/_([a-z])/g, (A, S) => S.toUpperCase());
      let y = process.env[g];
      return /^(yes|on|true|enabled)$/i.test(y) ? y = !0 : /^(no|off|false|disabled)$/i.test(y) ? y = !1 : y === "null" ? y = null : y = Number(y), d[v] = y, d;
    }, {});
    function i() {
      return "colors" in t.inspectOpts ? !!t.inspectOpts.colors : r.isatty(process.stderr.fd);
    }
    function o(d) {
      const { namespace: g, useColors: v } = this;
      if (v) {
        const y = this.color, A = "\x1B[3" + (y < 8 ? y : "8;5;" + y), S = `  ${A};1m${g} \x1B[0m`;
        d[0] = S + d[0].split(`
`).join(`
` + S), d.push(A + "m+" + e.exports.humanize(this.diff) + "\x1B[0m");
      } else
        d[0] = a() + g + " " + d[0];
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
    function m() {
      return process.env.DEBUG;
    }
    function c(d) {
      d.inspectOpts = {};
      const g = Object.keys(t.inspectOpts);
      for (let v = 0; v < g.length; v++)
        d.inspectOpts[g[v]] = t.inspectOpts[g[v]];
    }
    e.exports = sc()(t);
    const { formatters: f } = e.exports;
    f.o = function(d) {
      return this.inspectOpts.colors = this.useColors, n.inspect(d, this.inspectOpts).split(`
`).map((g) => g.trim()).join(" ");
    }, f.O = function(d) {
      return this.inspectOpts.colors = this.useColors, n.inspect(d, this.inspectOpts);
    };
  }(dn, dn.exports)), dn.exports;
}
typeof process > "u" || process.type === "renderer" || process.browser === !0 || process.__nwjs ? io.exports = vp() : io.exports = Ap();
var Tp = io.exports, jr = {};
Object.defineProperty(jr, "__esModule", { value: !0 });
jr.ProgressCallbackTransform = void 0;
const Sp = kr;
class Cp extends Sp.Transform {
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
jr.ProgressCallbackTransform = Cp;
Object.defineProperty(Se, "__esModule", { value: !0 });
Se.DigestTransform = Se.HttpExecutor = Se.HttpError = void 0;
Se.createHttpError = ao;
Se.parseJson = $p;
Se.configureRequestOptionsFromUrl = cc;
Se.configureRequestUrl = Po;
Se.safeGetHeader = Qt;
Se.configureRequestOptions = Fn;
Se.safeStringifyJson = xn;
const bp = Mr, Rp = Tp, Op = gt, Ip = kr, oo = Et, Pp = dt, Wa = ir, Np = jr, Ct = (0, Rp.default)("electron-builder");
function ao(e, t = null) {
  return new Io(e.statusCode || -1, `${e.statusCode} ${e.statusMessage}` + (t == null ? "" : `
` + JSON.stringify(t, null, "  ")) + `
Headers: ` + xn(e.headers), t);
}
const Dp = /* @__PURE__ */ new Map([
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
class Io extends Error {
  constructor(t, r = `HTTP error: ${Dp.get(t) || t}`, n = null) {
    super(r), this.statusCode = t, this.description = n, this.name = "HttpError", this.code = `HTTP_ERROR_${t}`;
  }
  isServerError() {
    return this.statusCode >= 500 && this.statusCode <= 599;
  }
}
Se.HttpError = Io;
function $p(e) {
  return e.then((t) => t == null || t.length === 0 ? null : JSON.parse(t));
}
class Vt {
  constructor() {
    this.maxRedirects = 10;
  }
  request(t, r = new Pp.CancellationToken(), n) {
    Fn(t);
    const i = n == null ? void 0 : JSON.stringify(n), o = i ? Buffer.from(i) : void 0;
    if (o != null) {
      Ct(i);
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
    return Ct.enabled && Ct(`Request: ${xn(t)}`), r.createPromise((o, a, s) => {
      const l = this.createRequest(t, (m) => {
        try {
          this.handleResponse(m, t, r, o, a, i, n);
        } catch (c) {
          a(c);
        }
      });
      this.addErrorAndTimeoutHandlers(l, a, t.timeout), this.addRedirectHandlers(l, t, a, i, (m) => {
        this.doApiRequest(m, r, n, i).then(o).catch(a);
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
    if (Ct.enabled && Ct(`Response: ${t.statusCode} ${t.statusMessage}, request options: ${xn(r)}`), t.statusCode === 404) {
      o(ao(t, `method: ${r.method || "GET"} url: ${r.protocol || "https:"}//${r.hostname}${r.port ? `:${r.port}` : ""}${r.path}

Please double check that your authentication token is correct. Due to security reasons, actual status maybe not reported, but 404.
`));
      return;
    } else if (t.statusCode === 204) {
      i();
      return;
    }
    const m = (l = t.statusCode) !== null && l !== void 0 ? l : 0, c = m >= 300 && m < 400, f = Qt(t, "location");
    if (c && f != null) {
      if (a > this.maxRedirects) {
        o(this.createMaxRedirectError());
        return;
      }
      this.doApiRequest(Vt.prepareRedirectUrlOptions(f, r), n, s, a).then(i).catch(o);
      return;
    }
    t.setEncoding("utf8");
    let d = "";
    t.on("error", o), t.on("data", (g) => d += g), t.on("end", () => {
      try {
        if (t.statusCode != null && t.statusCode >= 400) {
          const g = Qt(t, "content-type"), v = g != null && (Array.isArray(g) ? g.find((y) => y.includes("json")) != null : g.includes("json"));
          o(ao(t, `method: ${r.method || "GET"} url: ${r.protocol || "https:"}//${r.hostname}${r.port ? `:${r.port}` : ""}${r.path}

          Data:
          ${v ? JSON.stringify(JSON.parse(d)) : d}
          `));
        } else
          i(d.length === 0 ? null : d);
      } catch (g) {
        o(g);
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
      Po(t, s), Fn(s), this.doDownload(s, {
        destination: null,
        options: r,
        onCancel: o,
        callback: (l) => {
          l == null ? n(Buffer.concat(a)) : i(l);
        },
        responseHandler: (l, m) => {
          let c = 0;
          l.on("data", (f) => {
            if (c += f.length, c > 524288e3) {
              m(new Error("Maximum allowed size is 500 MB"));
              return;
            }
            a.push(f);
          }), l.on("end", () => {
            m(null);
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
      const a = Qt(o, "location");
      if (a != null) {
        n < this.maxRedirects ? this.doDownload(Vt.prepareRedirectUrlOptions(a, t), r, n++) : r.callback(this.createMaxRedirectError());
        return;
      }
      r.responseHandler == null ? xp(r, o) : r.responseHandler(o, r.callback);
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
    const n = cc(t, { ...r }), i = n.headers;
    if (i != null && i.authorization) {
      const o = Vt.reconstructOriginalUrl(r), a = lc(t, r);
      Vt.isCrossOriginRedirect(o, a) && (Ct.enabled && Ct(`Given the cross-origin redirect (from ${o.host} to ${a.host}), the Authorization header will be stripped out.`), delete i.authorization);
    }
    return n;
  }
  static reconstructOriginalUrl(t) {
    const r = t.protocol || "https:";
    if (!t.hostname)
      throw new Error("Missing hostname in request options");
    const n = t.hostname, i = t.port ? `:${t.port}` : "", o = t.path || "/";
    return new oo.URL(`${r}//${n}${i}${o}`);
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
        if (n < r && (i instanceof Io && i.isServerError() || i.code === "EPIPE"))
          continue;
        throw i;
      }
  }
}
Se.HttpExecutor = Vt;
function lc(e, t) {
  try {
    return new oo.URL(e);
  } catch {
    const r = t.hostname, n = t.protocol || "https:", i = t.port ? `:${t.port}` : "", o = `${n}//${r}${i}`;
    return new oo.URL(e, o);
  }
}
function cc(e, t) {
  const r = Fn(t), n = lc(e, t);
  return Po(n, r), r;
}
function Po(e, t) {
  t.protocol = e.protocol, t.hostname = e.hostname, e.port ? t.port = e.port : t.port && delete t.port, t.path = e.pathname + e.search;
}
class so extends Ip.Transform {
  // noinspection JSUnusedGlobalSymbols
  get actual() {
    return this._actual;
  }
  constructor(t, r = "sha512", n = "base64") {
    super(), this.expected = t, this.algorithm = r, this.encoding = n, this._actual = null, this.isValidateOnEnd = !0, this.digester = (0, bp.createHash)(r);
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
      throw (0, Wa.newError)("Not finished yet", "ERR_STREAM_NOT_FINISHED");
    if (this._actual !== this.expected)
      throw (0, Wa.newError)(`${this.algorithm} checksum mismatch, expected ${this.expected}, got ${this._actual}`, "ERR_CHECKSUM_MISMATCH");
    return null;
  }
}
Se.DigestTransform = so;
function Fp(e, t, r) {
  return e != null && t != null && e !== t ? (r(new Error(`checksum mismatch: expected ${t} but got ${e} (X-Checksum-Sha2 header)`)), !1) : !0;
}
function Qt(e, t) {
  const r = e.headers[t];
  return r == null ? null : Array.isArray(r) ? r.length === 0 ? null : r[r.length - 1] : r;
}
function xp(e, t) {
  if (!Fp(Qt(t, "X-Checksum-Sha2"), e.options.sha2, e.callback))
    return;
  const r = [];
  if (e.options.onProgress != null) {
    const a = Qt(t, "content-length");
    a != null && r.push(new Np.ProgressCallbackTransform(parseInt(a, 10), e.options.cancellationToken, e.options.onProgress));
  }
  const n = e.options.sha512;
  n != null ? r.push(new so(n, "sha512", n.length === 128 && !n.includes("+") && !n.includes("Z") && !n.includes("=") ? "hex" : "base64")) : e.options.sha2 != null && r.push(new so(e.options.sha2, "sha256", "hex"));
  const i = (0, Op.createWriteStream)(e.destination);
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
function Fn(e, t, r) {
  r != null && (e.method = r), e.headers = { ...e.headers };
  const n = e.headers;
  return t != null && (n.authorization = t.startsWith("Basic") || t.startsWith("Bearer") ? t : `token ${t}`), n["User-Agent"] == null && (n["User-Agent"] = "electron-builder"), (r == null || r === "GET" || n["Cache-Control"] == null) && (n["Cache-Control"] = "no-cache"), e.protocol == null && process.versions.electron != null && (e.protocol = "https:"), e;
}
function xn(e, t) {
  return JSON.stringify(e, (r, n) => r.endsWith("Authorization") || r.endsWith("authorization") || r.endsWith("Password") || r.endsWith("PASSWORD") || r.endsWith("Token") || r.includes("password") || r.includes("token") || t != null && t.has(r) ? "<stripped sensitive data>" : n, 2);
}
var Xn = {};
Object.defineProperty(Xn, "__esModule", { value: !0 });
Xn.MemoLazy = void 0;
class Lp {
  constructor(t, r) {
    this.selector = t, this.creator = r, this.selected = void 0, this._value = void 0;
  }
  get hasValue() {
    return this._value !== void 0;
  }
  get value() {
    const t = this.selector();
    if (this._value !== void 0 && uc(this.selected, t))
      return this._value;
    this.selected = t;
    const r = this.creator(t);
    return this.value = r, r;
  }
  set value(t) {
    this._value = t;
  }
}
Xn.MemoLazy = Lp;
function uc(e, t) {
  if (typeof e == "object" && e !== null && (typeof t == "object" && t !== null)) {
    const i = Object.keys(e), o = Object.keys(t);
    return i.length === o.length && i.every((a) => uc(e[a], t[a]));
  }
  return e === t;
}
var Hr = {};
Object.defineProperty(Hr, "__esModule", { value: !0 });
Hr.githubUrl = Up;
Hr.githubTagPrefix = kp;
Hr.getS3LikeProviderBaseUrl = Mp;
function Up(e, t = "github.com") {
  return `${e.protocol || "https"}://${e.host || t}`;
}
function kp(e) {
  var t;
  return e.tagNamePrefix ? e.tagNamePrefix : !((t = e.vPrefixedTagName) !== null && t !== void 0) || t ? "v" : "";
}
function Mp(e) {
  const t = e.provider;
  if (t === "s3")
    return Bp(e);
  if (t === "spaces")
    return jp(e);
  throw new Error(`Not supported provider: ${t}`);
}
function Bp(e) {
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
  return fc(t, e.path);
}
function fc(e, t) {
  return t != null && t.length > 0 && (t.startsWith("/") || (e += "/"), e += t), e;
}
function jp(e) {
  if (e.name == null)
    throw new Error("name is missing");
  if (e.region == null)
    throw new Error("region is missing");
  return fc(`https://${e.name}.${e.region}.digitaloceanspaces.com`, e.path);
}
var No = {};
Object.defineProperty(No, "__esModule", { value: !0 });
No.retry = dc;
const Hp = dt;
async function dc(e, t) {
  var r;
  const { retries: n, interval: i, backoff: o = 0, attempt: a = 0, shouldRetry: s, cancellationToken: l = new Hp.CancellationToken() } = t;
  try {
    return await e();
  } catch (m) {
    if (await Promise.resolve((r = s == null ? void 0 : s(m)) !== null && r !== void 0 ? r : !0) && n > 0 && !l.cancelled)
      return await new Promise((c) => setTimeout(c, i + o * a)), await dc(e, { ...t, retries: n - 1, attempt: a + 1 });
    throw m;
  }
}
var Do = {};
Object.defineProperty(Do, "__esModule", { value: !0 });
Do.parseDn = qp;
function qp(e) {
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
var tr = {};
Object.defineProperty(tr, "__esModule", { value: !0 });
tr.nil = tr.UUID = void 0;
const hc = Mr, pc = ir, Gp = "options.name must be either a string or a Buffer", Va = (0, hc.randomBytes)(16);
Va[0] = Va[0] | 1;
const On = {}, W = [];
for (let e = 0; e < 256; e++) {
  const t = (e + 256).toString(16).substr(1);
  On[t] = e, W[e] = t;
}
class Ft {
  constructor(t) {
    this.ascii = null, this.binary = null;
    const r = Ft.check(t);
    if (!r)
      throw new Error("not a UUID");
    this.version = r.version, r.format === "ascii" ? this.ascii = t : this.binary = t;
  }
  static v5(t, r) {
    return Wp(t, "sha1", 80, r);
  }
  toString() {
    return this.ascii == null && (this.ascii = Vp(this.binary)), this.ascii;
  }
  inspect() {
    return `UUID v${this.version} ${this.toString()}`;
  }
  static check(t, r = 0) {
    if (typeof t == "string")
      return t = t.toLowerCase(), /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-([a-f0-9]{12})$/.test(t) ? t === "00000000-0000-0000-0000-000000000000" ? { version: void 0, variant: "nil", format: "ascii" } : {
        version: (On[t[14] + t[15]] & 240) >> 4,
        variant: Ya((On[t[19] + t[20]] & 224) >> 5),
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
        variant: Ya((t[r + 8] & 224) >> 5),
        format: "binary"
      };
    }
    throw (0, pc.newError)("Unknown type of uuid", "ERR_UNKNOWN_UUID_TYPE");
  }
  // read stringified uuid into a Buffer
  static parse(t) {
    const r = Buffer.allocUnsafe(16);
    let n = 0;
    for (let i = 0; i < 16; i++)
      r[i] = On[t[n++] + t[n++]], (i === 3 || i === 5 || i === 7 || i === 9) && (n += 1);
    return r;
  }
}
tr.UUID = Ft;
Ft.OID = Ft.parse("6ba7b812-9dad-11d1-80b4-00c04fd430c8");
function Ya(e) {
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
var _r;
(function(e) {
  e[e.ASCII = 0] = "ASCII", e[e.BINARY = 1] = "BINARY", e[e.OBJECT = 2] = "OBJECT";
})(_r || (_r = {}));
function Wp(e, t, r, n, i = _r.ASCII) {
  const o = (0, hc.createHash)(t);
  if (typeof e != "string" && !Buffer.isBuffer(e))
    throw (0, pc.newError)(Gp, "ERR_INVALID_UUID_NAME");
  o.update(n), o.update(e);
  const s = o.digest();
  let l;
  switch (i) {
    case _r.BINARY:
      s[6] = s[6] & 15 | r, s[8] = s[8] & 63 | 128, l = s;
      break;
    case _r.OBJECT:
      s[6] = s[6] & 15 | r, s[8] = s[8] & 63 | 128, l = new Ft(s);
      break;
    default:
      l = W[s[0]] + W[s[1]] + W[s[2]] + W[s[3]] + "-" + W[s[4]] + W[s[5]] + "-" + W[s[6] & 15 | r] + W[s[7]] + "-" + W[s[8] & 63 | 128] + W[s[9]] + "-" + W[s[10]] + W[s[11]] + W[s[12]] + W[s[13]] + W[s[14]] + W[s[15]];
      break;
  }
  return l;
}
function Vp(e) {
  return W[e[0]] + W[e[1]] + W[e[2]] + W[e[3]] + "-" + W[e[4]] + W[e[5]] + "-" + W[e[6]] + W[e[7]] + "-" + W[e[8]] + W[e[9]] + "-" + W[e[10]] + W[e[11]] + W[e[12]] + W[e[13]] + W[e[14]] + W[e[15]];
}
tr.nil = new Ft("00000000-0000-0000-0000-000000000000");
var qr = {}, mc = {};
(function(e) {
  (function(t) {
    t.parser = function(h, u) {
      return new n(h, u);
    }, t.SAXParser = n, t.SAXStream = c, t.createStream = m, t.MAX_BUFFER_LENGTH = 64 * 1024;
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
    function n(h, u) {
      if (!(this instanceof n))
        return new n(h, u);
      var C = this;
      o(C), C.q = C.c = "", C.bufferCheckPosition = t.MAX_BUFFER_LENGTH, C.opt = u || {}, C.opt.lowercase = C.opt.lowercase || C.opt.lowercasetags, C.looseCase = C.opt.lowercase ? "toLowerCase" : "toUpperCase", C.tags = [], C.closed = C.closedRoot = C.sawRoot = !1, C.tag = C.error = null, C.strict = !!h, C.noscript = !!(h || C.opt.noscript), C.state = E.BEGIN, C.strictEntities = C.opt.strictEntities, C.ENTITIES = C.strictEntities ? Object.create(t.XML_ENTITIES) : Object.create(t.ENTITIES), C.attribList = [], C.opt.xmlns && (C.ns = Object.create(y)), C.opt.unquotedAttributeValues === void 0 && (C.opt.unquotedAttributeValues = !h), C.trackPosition = C.opt.position !== !1, C.trackPosition && (C.position = C.line = C.column = 0), B(C, "onready");
    }
    Object.create || (Object.create = function(h) {
      function u() {
      }
      u.prototype = h;
      var C = new u();
      return C;
    }), Object.keys || (Object.keys = function(h) {
      var u = [];
      for (var C in h) h.hasOwnProperty(C) && u.push(C);
      return u;
    });
    function i(h) {
      for (var u = Math.max(t.MAX_BUFFER_LENGTH, 10), C = 0, _ = 0, Y = r.length; _ < Y; _++) {
        var J = h[r[_]].length;
        if (J > u)
          switch (r[_]) {
            case "textNode":
              z(h);
              break;
            case "cdata":
              M(h, "oncdata", h.cdata), h.cdata = "";
              break;
            case "script":
              M(h, "onscript", h.script), h.script = "";
              break;
            default:
              R(h, "Max buffer length exceeded: " + r[_]);
          }
        C = Math.max(C, J);
      }
      var ne = t.MAX_BUFFER_LENGTH - C;
      h.bufferCheckPosition = ne + h.position;
    }
    function o(h) {
      for (var u = 0, C = r.length; u < C; u++)
        h[r[u]] = "";
    }
    function a(h) {
      z(h), h.cdata !== "" && (M(h, "oncdata", h.cdata), h.cdata = ""), h.script !== "" && (M(h, "onscript", h.script), h.script = "");
    }
    n.prototype = {
      end: function() {
        N(this);
      },
      write: We,
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
    var l = t.EVENTS.filter(function(h) {
      return h !== "error" && h !== "end";
    });
    function m(h, u) {
      return new c(h, u);
    }
    function c(h, u) {
      if (!(this instanceof c))
        return new c(h, u);
      s.apply(this), this._parser = new n(h, u), this.writable = !0, this.readable = !0;
      var C = this;
      this._parser.onend = function() {
        C.emit("end");
      }, this._parser.onerror = function(_) {
        C.emit("error", _), C._parser.error = null;
      }, this._decoder = null, l.forEach(function(_) {
        Object.defineProperty(C, "on" + _, {
          get: function() {
            return C._parser["on" + _];
          },
          set: function(Y) {
            if (!Y)
              return C.removeAllListeners(_), C._parser["on" + _] = Y, Y;
            C.on(_, Y);
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
    }), c.prototype.write = function(h) {
      return typeof Buffer == "function" && typeof Buffer.isBuffer == "function" && Buffer.isBuffer(h) && (this._decoder || (this._decoder = new TextDecoder("utf8")), h = this._decoder.decode(h, { stream: !0 })), this._parser.write(h.toString()), this.emit("data", h), !0;
    }, c.prototype.end = function(h) {
      if (h && h.length && this.write(h), this._decoder) {
        var u = this._decoder.decode();
        u && (this._parser.write(u), this.emit("data", u));
      }
      return this._parser.end(), !0;
    }, c.prototype.on = function(h, u) {
      var C = this;
      return !C._parser["on" + h] && l.indexOf(h) !== -1 && (C._parser["on" + h] = function() {
        var _ = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
        _.splice(0, 0, h), C.emit.apply(C, _);
      }), s.prototype.on.call(C, h, u);
    };
    var f = "[CDATA[", d = "DOCTYPE", g = "http://www.w3.org/XML/1998/namespace", v = "http://www.w3.org/2000/xmlns/", y = { xml: g, xmlns: v }, A = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/, S = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/, T = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/, D = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
    function x(h) {
      return h === " " || h === `
` || h === "\r" || h === "	";
    }
    function Z(h) {
      return h === '"' || h === "'";
    }
    function oe(h) {
      return h === ">" || x(h);
    }
    function V(h, u) {
      return h.test(u);
    }
    function De(h, u) {
      return !V(h, u);
    }
    var E = 0;
    t.STATE = {
      BEGIN: E++,
      // leading byte order mark or whitespace
      BEGIN_WHITESPACE: E++,
      // leading whitespace
      TEXT: E++,
      // general stuff
      TEXT_ENTITY: E++,
      // &amp and such.
      OPEN_WAKA: E++,
      // <
      SGML_DECL: E++,
      // <!BLARG
      SGML_DECL_QUOTED: E++,
      // <!BLARG foo "bar
      DOCTYPE: E++,
      // <!DOCTYPE
      DOCTYPE_QUOTED: E++,
      // <!DOCTYPE "//blah
      DOCTYPE_DTD: E++,
      // <!DOCTYPE "//blah" [ ...
      DOCTYPE_DTD_QUOTED: E++,
      // <!DOCTYPE "//blah" [ "foo
      COMMENT_STARTING: E++,
      // <!-
      COMMENT: E++,
      // <!--
      COMMENT_ENDING: E++,
      // <!-- blah -
      COMMENT_ENDED: E++,
      // <!-- blah --
      CDATA: E++,
      // <![CDATA[ something
      CDATA_ENDING: E++,
      // ]
      CDATA_ENDING_2: E++,
      // ]]
      PROC_INST: E++,
      // <?hi
      PROC_INST_BODY: E++,
      // <?hi there
      PROC_INST_ENDING: E++,
      // <?hi "there" ?
      OPEN_TAG: E++,
      // <strong
      OPEN_TAG_SLASH: E++,
      // <strong /
      ATTRIB: E++,
      // <a
      ATTRIB_NAME: E++,
      // <a foo
      ATTRIB_NAME_SAW_WHITE: E++,
      // <a foo _
      ATTRIB_VALUE: E++,
      // <a foo=
      ATTRIB_VALUE_QUOTED: E++,
      // <a foo="bar
      ATTRIB_VALUE_CLOSED: E++,
      // <a foo="bar"
      ATTRIB_VALUE_UNQUOTED: E++,
      // <a foo=bar
      ATTRIB_VALUE_ENTITY_Q: E++,
      // <foo bar="&quot;"
      ATTRIB_VALUE_ENTITY_U: E++,
      // <foo bar=&quot
      CLOSE_TAG: E++,
      // </a
      CLOSE_TAG_SAW_WHITE: E++,
      // </a   >
      SCRIPT: E++,
      // <script> ...
      SCRIPT_ENDING: E++
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
    }, Object.keys(t.ENTITIES).forEach(function(h) {
      var u = t.ENTITIES[h], C = typeof u == "number" ? String.fromCharCode(u) : u;
      t.ENTITIES[h] = C;
    });
    for (var q in t.STATE)
      t.STATE[t.STATE[q]] = q;
    E = t.STATE;
    function B(h, u, C) {
      h[u] && h[u](C);
    }
    function M(h, u, C) {
      h.textNode && z(h), B(h, u, C);
    }
    function z(h) {
      h.textNode = I(h.opt, h.textNode), h.textNode && B(h, "ontext", h.textNode), h.textNode = "";
    }
    function I(h, u) {
      return h.trim && (u = u.trim()), h.normalize && (u = u.replace(/\s+/g, " ")), u;
    }
    function R(h, u) {
      return z(h), h.trackPosition && (u += `
Line: ` + h.line + `
Column: ` + h.column + `
Char: ` + h.c), u = new Error(u), h.error = u, B(h, "onerror", u), h;
    }
    function N(h) {
      return h.sawRoot && !h.closedRoot && b(h, "Unclosed root tag"), h.state !== E.BEGIN && h.state !== E.BEGIN_WHITESPACE && h.state !== E.TEXT && R(h, "Unexpected end"), z(h), h.c = "", h.closed = !0, B(h, "onend"), n.call(h, h.strict, h.opt), h;
    }
    function b(h, u) {
      if (typeof h != "object" || !(h instanceof n))
        throw new Error("bad call to strictFail");
      h.strict && R(h, u);
    }
    function $(h) {
      h.strict || (h.tagName = h.tagName[h.looseCase]());
      var u = h.tags[h.tags.length - 1] || h, C = h.tag = { name: h.tagName, attributes: {} };
      h.opt.xmlns && (C.ns = u.ns), h.attribList.length = 0, M(h, "onopentagstart", C);
    }
    function P(h, u) {
      var C = h.indexOf(":"), _ = C < 0 ? ["", h] : h.split(":"), Y = _[0], J = _[1];
      return u && h === "xmlns" && (Y = "xmlns", J = ""), { prefix: Y, local: J };
    }
    function k(h) {
      if (h.strict || (h.attribName = h.attribName[h.looseCase]()), h.attribList.indexOf(h.attribName) !== -1 || h.tag.attributes.hasOwnProperty(h.attribName)) {
        h.attribName = h.attribValue = "";
        return;
      }
      if (h.opt.xmlns) {
        var u = P(h.attribName, !0), C = u.prefix, _ = u.local;
        if (C === "xmlns")
          if (_ === "xml" && h.attribValue !== g)
            b(
              h,
              "xml: prefix must be bound to " + g + `
Actual: ` + h.attribValue
            );
          else if (_ === "xmlns" && h.attribValue !== v)
            b(
              h,
              "xmlns: prefix must be bound to " + v + `
Actual: ` + h.attribValue
            );
          else {
            var Y = h.tag, J = h.tags[h.tags.length - 1] || h;
            Y.ns === J.ns && (Y.ns = Object.create(J.ns)), Y.ns[_] = h.attribValue;
          }
        h.attribList.push([h.attribName, h.attribValue]);
      } else
        h.tag.attributes[h.attribName] = h.attribValue, M(h, "onattribute", {
          name: h.attribName,
          value: h.attribValue
        });
      h.attribName = h.attribValue = "";
    }
    function G(h, u) {
      if (h.opt.xmlns) {
        var C = h.tag, _ = P(h.tagName);
        C.prefix = _.prefix, C.local = _.local, C.uri = C.ns[_.prefix] || "", C.prefix && !C.uri && (b(
          h,
          "Unbound namespace prefix: " + JSON.stringify(h.tagName)
        ), C.uri = _.prefix);
        var Y = h.tags[h.tags.length - 1] || h;
        C.ns && Y.ns !== C.ns && Object.keys(C.ns).forEach(function(Qr) {
          M(h, "onopennamespace", {
            prefix: Qr,
            uri: C.ns[Qr]
          });
        });
        for (var J = 0, ne = h.attribList.length; J < ne; J++) {
          var he = h.attribList[J], Ee = he[0], et = he[1], le = P(Ee, !0), Le = le.prefix, hi = le.local, Jr = Le === "" ? "" : C.ns[Le] || "", lr = {
            name: Ee,
            value: et,
            prefix: Le,
            local: hi,
            uri: Jr
          };
          Le && Le !== "xmlns" && !Jr && (b(
            h,
            "Unbound namespace prefix: " + JSON.stringify(Le)
          ), lr.uri = Le), h.tag.attributes[Ee] = lr, M(h, "onattribute", lr);
        }
        h.attribList.length = 0;
      }
      h.tag.isSelfClosing = !!u, h.sawRoot = !0, h.tags.push(h.tag), M(h, "onopentag", h.tag), u || (!h.noscript && h.tagName.toLowerCase() === "script" ? h.state = E.SCRIPT : h.state = E.TEXT, h.tag = null, h.tagName = ""), h.attribName = h.attribValue = "", h.attribList.length = 0;
    }
    function j(h) {
      if (!h.tagName) {
        b(h, "Weird empty close tag."), h.textNode += "</>", h.state = E.TEXT;
        return;
      }
      if (h.script) {
        if (h.tagName !== "script") {
          h.script += "</" + h.tagName + ">", h.tagName = "", h.state = E.SCRIPT;
          return;
        }
        M(h, "onscript", h.script), h.script = "";
      }
      var u = h.tags.length, C = h.tagName;
      h.strict || (C = C[h.looseCase]());
      for (var _ = C; u--; ) {
        var Y = h.tags[u];
        if (Y.name !== _)
          b(h, "Unexpected close tag");
        else
          break;
      }
      if (u < 0) {
        b(h, "Unmatched closing tag: " + h.tagName), h.textNode += "</" + h.tagName + ">", h.state = E.TEXT;
        return;
      }
      h.tagName = C;
      for (var J = h.tags.length; J-- > u; ) {
        var ne = h.tag = h.tags.pop();
        h.tagName = h.tag.name, M(h, "onclosetag", h.tagName);
        var he = {};
        for (var Ee in ne.ns)
          he[Ee] = ne.ns[Ee];
        var et = h.tags[h.tags.length - 1] || h;
        h.opt.xmlns && ne.ns !== et.ns && Object.keys(ne.ns).forEach(function(le) {
          var Le = ne.ns[le];
          M(h, "onclosenamespace", { prefix: le, uri: Le });
        });
      }
      u === 0 && (h.closedRoot = !0), h.tagName = h.attribValue = h.attribName = "", h.attribList.length = 0, h.state = E.TEXT;
    }
    function X(h) {
      var u = h.entity, C = u.toLowerCase(), _, Y = "";
      return h.ENTITIES[u] ? h.ENTITIES[u] : h.ENTITIES[C] ? h.ENTITIES[C] : (u = C, u.charAt(0) === "#" && (u.charAt(1) === "x" ? (u = u.slice(2), _ = parseInt(u, 16), Y = _.toString(16)) : (u = u.slice(1), _ = parseInt(u, 10), Y = _.toString(10))), u = u.replace(/^0+/, ""), isNaN(_) || Y.toLowerCase() !== u || _ < 0 || _ > 1114111 ? (b(h, "Invalid character entity"), "&" + h.entity + ";") : String.fromCodePoint(_));
    }
    function ue(h, u) {
      u === "<" ? (h.state = E.OPEN_WAKA, h.startTagPosition = h.position) : x(u) || (b(h, "Non-whitespace before first tag."), h.textNode = u, h.state = E.TEXT);
    }
    function U(h, u) {
      var C = "";
      return u < h.length && (C = h.charAt(u)), C;
    }
    function We(h) {
      var u = this;
      if (this.error)
        throw this.error;
      if (u.closed)
        return R(
          u,
          "Cannot write after close. Assign an onready handler."
        );
      if (h === null)
        return N(u);
      typeof h == "object" && (h = h.toString());
      for (var C = 0, _ = ""; _ = U(h, C++), u.c = _, !!_; )
        switch (u.trackPosition && (u.position++, _ === `
` ? (u.line++, u.column = 0) : u.column++), u.state) {
          case E.BEGIN:
            if (u.state = E.BEGIN_WHITESPACE, _ === "\uFEFF")
              continue;
            ue(u, _);
            continue;
          case E.BEGIN_WHITESPACE:
            ue(u, _);
            continue;
          case E.TEXT:
            if (u.sawRoot && !u.closedRoot) {
              for (var J = C - 1; _ && _ !== "<" && _ !== "&"; )
                _ = U(h, C++), _ && u.trackPosition && (u.position++, _ === `
` ? (u.line++, u.column = 0) : u.column++);
              u.textNode += h.substring(J, C - 1);
            }
            _ === "<" && !(u.sawRoot && u.closedRoot && !u.strict) ? (u.state = E.OPEN_WAKA, u.startTagPosition = u.position) : (!x(_) && (!u.sawRoot || u.closedRoot) && b(u, "Text data outside of root node."), _ === "&" ? u.state = E.TEXT_ENTITY : u.textNode += _);
            continue;
          case E.SCRIPT:
            _ === "<" ? u.state = E.SCRIPT_ENDING : u.script += _;
            continue;
          case E.SCRIPT_ENDING:
            _ === "/" ? u.state = E.CLOSE_TAG : (u.script += "<" + _, u.state = E.SCRIPT);
            continue;
          case E.OPEN_WAKA:
            if (_ === "!")
              u.state = E.SGML_DECL, u.sgmlDecl = "";
            else if (!x(_)) if (V(A, _))
              u.state = E.OPEN_TAG, u.tagName = _;
            else if (_ === "/")
              u.state = E.CLOSE_TAG, u.tagName = "";
            else if (_ === "?")
              u.state = E.PROC_INST, u.procInstName = u.procInstBody = "";
            else {
              if (b(u, "Unencoded <"), u.startTagPosition + 1 < u.position) {
                var Y = u.position - u.startTagPosition;
                _ = new Array(Y).join(" ") + _;
              }
              u.textNode += "<" + _, u.state = E.TEXT;
            }
            continue;
          case E.SGML_DECL:
            if (u.sgmlDecl + _ === "--") {
              u.state = E.COMMENT, u.comment = "", u.sgmlDecl = "";
              continue;
            }
            u.doctype && u.doctype !== !0 && u.sgmlDecl ? (u.state = E.DOCTYPE_DTD, u.doctype += "<!" + u.sgmlDecl + _, u.sgmlDecl = "") : (u.sgmlDecl + _).toUpperCase() === f ? (M(u, "onopencdata"), u.state = E.CDATA, u.sgmlDecl = "", u.cdata = "") : (u.sgmlDecl + _).toUpperCase() === d ? (u.state = E.DOCTYPE, (u.doctype || u.sawRoot) && b(
              u,
              "Inappropriately located doctype declaration"
            ), u.doctype = "", u.sgmlDecl = "") : _ === ">" ? (M(u, "onsgmldeclaration", u.sgmlDecl), u.sgmlDecl = "", u.state = E.TEXT) : (Z(_) && (u.state = E.SGML_DECL_QUOTED), u.sgmlDecl += _);
            continue;
          case E.SGML_DECL_QUOTED:
            _ === u.q && (u.state = E.SGML_DECL, u.q = ""), u.sgmlDecl += _;
            continue;
          case E.DOCTYPE:
            _ === ">" ? (u.state = E.TEXT, M(u, "ondoctype", u.doctype), u.doctype = !0) : (u.doctype += _, _ === "[" ? u.state = E.DOCTYPE_DTD : Z(_) && (u.state = E.DOCTYPE_QUOTED, u.q = _));
            continue;
          case E.DOCTYPE_QUOTED:
            u.doctype += _, _ === u.q && (u.q = "", u.state = E.DOCTYPE);
            continue;
          case E.DOCTYPE_DTD:
            _ === "]" ? (u.doctype += _, u.state = E.DOCTYPE) : _ === "<" ? (u.state = E.OPEN_WAKA, u.startTagPosition = u.position) : Z(_) ? (u.doctype += _, u.state = E.DOCTYPE_DTD_QUOTED, u.q = _) : u.doctype += _;
            continue;
          case E.DOCTYPE_DTD_QUOTED:
            u.doctype += _, _ === u.q && (u.state = E.DOCTYPE_DTD, u.q = "");
            continue;
          case E.COMMENT:
            _ === "-" ? u.state = E.COMMENT_ENDING : u.comment += _;
            continue;
          case E.COMMENT_ENDING:
            _ === "-" ? (u.state = E.COMMENT_ENDED, u.comment = I(u.opt, u.comment), u.comment && M(u, "oncomment", u.comment), u.comment = "") : (u.comment += "-" + _, u.state = E.COMMENT);
            continue;
          case E.COMMENT_ENDED:
            _ !== ">" ? (b(u, "Malformed comment"), u.comment += "--" + _, u.state = E.COMMENT) : u.doctype && u.doctype !== !0 ? u.state = E.DOCTYPE_DTD : u.state = E.TEXT;
            continue;
          case E.CDATA:
            for (var J = C - 1; _ && _ !== "]"; )
              _ = U(h, C++), _ && u.trackPosition && (u.position++, _ === `
` ? (u.line++, u.column = 0) : u.column++);
            u.cdata += h.substring(J, C - 1), _ === "]" && (u.state = E.CDATA_ENDING);
            continue;
          case E.CDATA_ENDING:
            _ === "]" ? u.state = E.CDATA_ENDING_2 : (u.cdata += "]" + _, u.state = E.CDATA);
            continue;
          case E.CDATA_ENDING_2:
            _ === ">" ? (u.cdata && M(u, "oncdata", u.cdata), M(u, "onclosecdata"), u.cdata = "", u.state = E.TEXT) : _ === "]" ? u.cdata += "]" : (u.cdata += "]]" + _, u.state = E.CDATA);
            continue;
          case E.PROC_INST:
            _ === "?" ? u.state = E.PROC_INST_ENDING : x(_) ? u.state = E.PROC_INST_BODY : u.procInstName += _;
            continue;
          case E.PROC_INST_BODY:
            if (!u.procInstBody && x(_))
              continue;
            _ === "?" ? u.state = E.PROC_INST_ENDING : u.procInstBody += _;
            continue;
          case E.PROC_INST_ENDING:
            _ === ">" ? (M(u, "onprocessinginstruction", {
              name: u.procInstName,
              body: u.procInstBody
            }), u.procInstName = u.procInstBody = "", u.state = E.TEXT) : (u.procInstBody += "?" + _, u.state = E.PROC_INST_BODY);
            continue;
          case E.OPEN_TAG:
            V(S, _) ? u.tagName += _ : ($(u), _ === ">" ? G(u) : _ === "/" ? u.state = E.OPEN_TAG_SLASH : (x(_) || b(u, "Invalid character in tag name"), u.state = E.ATTRIB));
            continue;
          case E.OPEN_TAG_SLASH:
            _ === ">" ? (G(u, !0), j(u)) : (b(
              u,
              "Forward-slash in opening tag not followed by >"
            ), u.state = E.ATTRIB);
            continue;
          case E.ATTRIB:
            if (x(_))
              continue;
            _ === ">" ? G(u) : _ === "/" ? u.state = E.OPEN_TAG_SLASH : V(A, _) ? (u.attribName = _, u.attribValue = "", u.state = E.ATTRIB_NAME) : b(u, "Invalid attribute name");
            continue;
          case E.ATTRIB_NAME:
            _ === "=" ? u.state = E.ATTRIB_VALUE : _ === ">" ? (b(u, "Attribute without value"), u.attribValue = u.attribName, k(u), G(u)) : x(_) ? u.state = E.ATTRIB_NAME_SAW_WHITE : V(S, _) ? u.attribName += _ : b(u, "Invalid attribute name");
            continue;
          case E.ATTRIB_NAME_SAW_WHITE:
            if (_ === "=")
              u.state = E.ATTRIB_VALUE;
            else {
              if (x(_))
                continue;
              b(u, "Attribute without value"), u.tag.attributes[u.attribName] = "", u.attribValue = "", M(u, "onattribute", {
                name: u.attribName,
                value: ""
              }), u.attribName = "", _ === ">" ? G(u) : V(A, _) ? (u.attribName = _, u.state = E.ATTRIB_NAME) : (b(u, "Invalid attribute name"), u.state = E.ATTRIB);
            }
            continue;
          case E.ATTRIB_VALUE:
            if (x(_))
              continue;
            Z(_) ? (u.q = _, u.state = E.ATTRIB_VALUE_QUOTED) : (u.opt.unquotedAttributeValues || R(u, "Unquoted attribute value"), u.state = E.ATTRIB_VALUE_UNQUOTED, u.attribValue = _);
            continue;
          case E.ATTRIB_VALUE_QUOTED:
            if (_ !== u.q) {
              _ === "&" ? u.state = E.ATTRIB_VALUE_ENTITY_Q : u.attribValue += _;
              continue;
            }
            k(u), u.q = "", u.state = E.ATTRIB_VALUE_CLOSED;
            continue;
          case E.ATTRIB_VALUE_CLOSED:
            x(_) ? u.state = E.ATTRIB : _ === ">" ? G(u) : _ === "/" ? u.state = E.OPEN_TAG_SLASH : V(A, _) ? (b(u, "No whitespace between attributes"), u.attribName = _, u.attribValue = "", u.state = E.ATTRIB_NAME) : b(u, "Invalid attribute name");
            continue;
          case E.ATTRIB_VALUE_UNQUOTED:
            if (!oe(_)) {
              _ === "&" ? u.state = E.ATTRIB_VALUE_ENTITY_U : u.attribValue += _;
              continue;
            }
            k(u), _ === ">" ? G(u) : u.state = E.ATTRIB;
            continue;
          case E.CLOSE_TAG:
            if (u.tagName)
              _ === ">" ? j(u) : V(S, _) ? u.tagName += _ : u.script ? (u.script += "</" + u.tagName + _, u.tagName = "", u.state = E.SCRIPT) : (x(_) || b(u, "Invalid tagname in closing tag"), u.state = E.CLOSE_TAG_SAW_WHITE);
            else {
              if (x(_))
                continue;
              De(A, _) ? u.script ? (u.script += "</" + _, u.state = E.SCRIPT) : b(u, "Invalid tagname in closing tag.") : u.tagName = _;
            }
            continue;
          case E.CLOSE_TAG_SAW_WHITE:
            if (x(_))
              continue;
            _ === ">" ? j(u) : b(u, "Invalid characters in closing tag");
            continue;
          case E.TEXT_ENTITY:
          case E.ATTRIB_VALUE_ENTITY_Q:
          case E.ATTRIB_VALUE_ENTITY_U:
            var ne, he;
            switch (u.state) {
              case E.TEXT_ENTITY:
                ne = E.TEXT, he = "textNode";
                break;
              case E.ATTRIB_VALUE_ENTITY_Q:
                ne = E.ATTRIB_VALUE_QUOTED, he = "attribValue";
                break;
              case E.ATTRIB_VALUE_ENTITY_U:
                ne = E.ATTRIB_VALUE_UNQUOTED, he = "attribValue";
                break;
            }
            if (_ === ";") {
              var Ee = X(u);
              u.opt.unparsedEntities && !Object.values(t.XML_ENTITIES).includes(Ee) ? (u.entity = "", u.state = ne, u.write(Ee)) : (u[he] += Ee, u.entity = "", u.state = ne);
            } else V(u.entity.length ? D : T, _) ? u.entity += _ : (b(u, "Invalid character in entity name"), u[he] += "&" + u.entity + _, u.entity = "", u.state = ne);
            continue;
          default:
            throw new Error(u, "Unknown state: " + u.state);
        }
      return u.position >= u.bufferCheckPosition && i(u), u;
    }
    /*! http://mths.be/fromcodepoint v0.1.0 by @mathias */
    String.fromCodePoint || function() {
      var h = String.fromCharCode, u = Math.floor, C = function() {
        var _ = 16384, Y = [], J, ne, he = -1, Ee = arguments.length;
        if (!Ee)
          return "";
        for (var et = ""; ++he < Ee; ) {
          var le = Number(arguments[he]);
          if (!isFinite(le) || // `NaN`, `+Infinity`, or `-Infinity`
          le < 0 || // not a valid Unicode code point
          le > 1114111 || // not a valid Unicode code point
          u(le) !== le)
            throw RangeError("Invalid code point: " + le);
          le <= 65535 ? Y.push(le) : (le -= 65536, J = (le >> 10) + 55296, ne = le % 1024 + 56320, Y.push(J, ne)), (he + 1 === Ee || Y.length > _) && (et += h.apply(null, Y), Y.length = 0);
        }
        return et;
      };
      Object.defineProperty ? Object.defineProperty(String, "fromCodePoint", {
        value: C,
        configurable: !0,
        writable: !0
      }) : String.fromCodePoint = C;
    }();
  })(e);
})(mc);
Object.defineProperty(qr, "__esModule", { value: !0 });
qr.XElement = void 0;
qr.parseXml = Kp;
const Yp = mc, hn = ir;
class gc {
  constructor(t) {
    if (this.name = t, this.value = "", this.attributes = null, this.isCData = !1, this.elements = null, !t)
      throw (0, hn.newError)("Element name cannot be empty", "ERR_XML_ELEMENT_NAME_EMPTY");
    if (!Xp(t))
      throw (0, hn.newError)(`Invalid element name: ${t}`, "ERR_XML_ELEMENT_INVALID_NAME");
  }
  attribute(t) {
    const r = this.attributes === null ? null : this.attributes[t];
    if (r == null)
      throw (0, hn.newError)(`No attribute "${t}"`, "ERR_XML_MISSED_ATTRIBUTE");
    return r;
  }
  removeAttribute(t) {
    this.attributes !== null && delete this.attributes[t];
  }
  element(t, r = !1, n = null) {
    const i = this.elementOrNull(t, r);
    if (i === null)
      throw (0, hn.newError)(n || `No element "${t}"`, "ERR_XML_MISSED_ELEMENT");
    return i;
  }
  elementOrNull(t, r = !1) {
    if (this.elements === null)
      return null;
    for (const n of this.elements)
      if (za(n, t, r))
        return n;
    return null;
  }
  getElements(t, r = !1) {
    return this.elements === null ? [] : this.elements.filter((n) => za(n, t, r));
  }
  elementValueOrEmpty(t, r = !1) {
    const n = this.elementOrNull(t, r);
    return n === null ? "" : n.value;
  }
}
qr.XElement = gc;
const zp = new RegExp(/^[A-Za-z_][:A-Za-z0-9_-]*$/i);
function Xp(e) {
  return zp.test(e);
}
function za(e, t, r) {
  const n = e.name;
  return n === t || r === !0 && n.length === t.length && n.toLowerCase() === t.toLowerCase();
}
function Kp(e) {
  let t = null;
  const r = Yp.parser(!0, {}), n = [];
  return r.onopentag = (i) => {
    const o = new gc(i.name);
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
  var t = dt;
  Object.defineProperty(e, "CancellationError", { enumerable: !0, get: function() {
    return t.CancellationError;
  } }), Object.defineProperty(e, "CancellationToken", { enumerable: !0, get: function() {
    return t.CancellationToken;
  } });
  var r = ir;
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
  var i = Xn;
  Object.defineProperty(e, "MemoLazy", { enumerable: !0, get: function() {
    return i.MemoLazy;
  } });
  var o = jr;
  Object.defineProperty(e, "ProgressCallbackTransform", { enumerable: !0, get: function() {
    return o.ProgressCallbackTransform;
  } });
  var a = Hr;
  Object.defineProperty(e, "getS3LikeProviderBaseUrl", { enumerable: !0, get: function() {
    return a.getS3LikeProviderBaseUrl;
  } }), Object.defineProperty(e, "githubUrl", { enumerable: !0, get: function() {
    return a.githubUrl;
  } }), Object.defineProperty(e, "githubTagPrefix", { enumerable: !0, get: function() {
    return a.githubTagPrefix;
  } });
  var s = No;
  Object.defineProperty(e, "retry", { enumerable: !0, get: function() {
    return s.retry;
  } });
  var l = Do;
  Object.defineProperty(e, "parseDn", { enumerable: !0, get: function() {
    return l.parseDn;
  } });
  var m = tr;
  Object.defineProperty(e, "UUID", { enumerable: !0, get: function() {
    return m.UUID;
  } });
  var c = qr;
  Object.defineProperty(e, "parseXml", { enumerable: !0, get: function() {
    return c.parseXml;
  } }), Object.defineProperty(e, "XElement", { enumerable: !0, get: function() {
    return c.XElement;
  } }), e.CURRENT_APP_INSTALLER_FILE_NAME = "installer.exe", e.CURRENT_APP_PACKAGE_FILE_NAME = "package.7z";
  function f(d) {
    return d == null ? [] : Array.isArray(d) ? d : [d];
  }
})(ce);
var ge = {}, $o = {}, je = {};
function Ec(e) {
  return typeof e > "u" || e === null;
}
function Jp(e) {
  return typeof e == "object" && e !== null;
}
function Qp(e) {
  return Array.isArray(e) ? e : Ec(e) ? [] : [e];
}
function Zp(e, t) {
  var r, n, i, o;
  if (t)
    for (o = Object.keys(t), r = 0, n = o.length; r < n; r += 1)
      i = o[r], e[i] = t[i];
  return e;
}
function em(e, t) {
  var r = "", n;
  for (n = 0; n < t; n += 1)
    r += e;
  return r;
}
function tm(e) {
  return e === 0 && Number.NEGATIVE_INFINITY === 1 / e;
}
je.isNothing = Ec;
je.isObject = Jp;
je.toArray = Qp;
je.repeat = em;
je.isNegativeZero = tm;
je.extend = Zp;
function yc(e, t) {
  var r = "", n = e.reason || "(unknown reason)";
  return e.mark ? (e.mark.name && (r += 'in "' + e.mark.name + '" '), r += "(" + (e.mark.line + 1) + ":" + (e.mark.column + 1) + ")", !t && e.mark.snippet && (r += `

` + e.mark.snippet), n + " " + r) : n;
}
function Or(e, t) {
  Error.call(this), this.name = "YAMLException", this.reason = e, this.mark = t, this.message = yc(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
}
Or.prototype = Object.create(Error.prototype);
Or.prototype.constructor = Or;
Or.prototype.toString = function(t) {
  return this.name + ": " + yc(this, t);
};
var Gr = Or, Er = je;
function Ii(e, t, r, n, i) {
  var o = "", a = "", s = Math.floor(i / 2) - 1;
  return n - t > s && (o = " ... ", t = n - s + o.length), r - n > s && (a = " ...", r = n + s - a.length), {
    str: o + e.slice(t, r).replace(/\t/g, "→") + a,
    pos: n - t + o.length
    // relative position
  };
}
function Pi(e, t) {
  return Er.repeat(" ", t - e.length) + e;
}
function rm(e, t) {
  if (t = Object.create(t || null), !e.buffer) return null;
  t.maxLength || (t.maxLength = 79), typeof t.indent != "number" && (t.indent = 1), typeof t.linesBefore != "number" && (t.linesBefore = 3), typeof t.linesAfter != "number" && (t.linesAfter = 2);
  for (var r = /\r?\n|\r|\0/g, n = [0], i = [], o, a = -1; o = r.exec(e.buffer); )
    i.push(o.index), n.push(o.index + o[0].length), e.position <= o.index && a < 0 && (a = n.length - 2);
  a < 0 && (a = n.length - 1);
  var s = "", l, m, c = Math.min(e.line + t.linesAfter, i.length).toString().length, f = t.maxLength - (t.indent + c + 3);
  for (l = 1; l <= t.linesBefore && !(a - l < 0); l++)
    m = Ii(
      e.buffer,
      n[a - l],
      i[a - l],
      e.position - (n[a] - n[a - l]),
      f
    ), s = Er.repeat(" ", t.indent) + Pi((e.line - l + 1).toString(), c) + " | " + m.str + `
` + s;
  for (m = Ii(e.buffer, n[a], i[a], e.position, f), s += Er.repeat(" ", t.indent) + Pi((e.line + 1).toString(), c) + " | " + m.str + `
`, s += Er.repeat("-", t.indent + c + 3 + m.pos) + `^
`, l = 1; l <= t.linesAfter && !(a + l >= i.length); l++)
    m = Ii(
      e.buffer,
      n[a + l],
      i[a + l],
      e.position - (n[a] - n[a + l]),
      f
    ), s += Er.repeat(" ", t.indent) + Pi((e.line + l + 1).toString(), c) + " | " + m.str + `
`;
  return s.replace(/\n$/, "");
}
var nm = rm, Xa = Gr, im = [
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
], om = [
  "scalar",
  "sequence",
  "mapping"
];
function am(e) {
  var t = {};
  return e !== null && Object.keys(e).forEach(function(r) {
    e[r].forEach(function(n) {
      t[String(n)] = r;
    });
  }), t;
}
function sm(e, t) {
  if (t = t || {}, Object.keys(t).forEach(function(r) {
    if (im.indexOf(r) === -1)
      throw new Xa('Unknown option "' + r + '" is met in definition of "' + e + '" YAML type.');
  }), this.options = t, this.tag = e, this.kind = t.kind || null, this.resolve = t.resolve || function() {
    return !0;
  }, this.construct = t.construct || function(r) {
    return r;
  }, this.instanceOf = t.instanceOf || null, this.predicate = t.predicate || null, this.represent = t.represent || null, this.representName = t.representName || null, this.defaultStyle = t.defaultStyle || null, this.multi = t.multi || !1, this.styleAliases = am(t.styleAliases || null), om.indexOf(this.kind) === -1)
    throw new Xa('Unknown kind "' + this.kind + '" is specified for "' + e + '" YAML type.');
}
var Oe = sm, hr = Gr, Ni = Oe;
function Ka(e, t) {
  var r = [];
  return e[t].forEach(function(n) {
    var i = r.length;
    r.forEach(function(o, a) {
      o.tag === n.tag && o.kind === n.kind && o.multi === n.multi && (i = a);
    }), r[i] = n;
  }), r;
}
function lm() {
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
function lo(e) {
  return this.extend(e);
}
lo.prototype.extend = function(t) {
  var r = [], n = [];
  if (t instanceof Ni)
    n.push(t);
  else if (Array.isArray(t))
    n = n.concat(t);
  else if (t && (Array.isArray(t.implicit) || Array.isArray(t.explicit)))
    t.implicit && (r = r.concat(t.implicit)), t.explicit && (n = n.concat(t.explicit));
  else
    throw new hr("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  r.forEach(function(o) {
    if (!(o instanceof Ni))
      throw new hr("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    if (o.loadKind && o.loadKind !== "scalar")
      throw new hr("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    if (o.multi)
      throw new hr("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
  }), n.forEach(function(o) {
    if (!(o instanceof Ni))
      throw new hr("Specified list of YAML types (or a single Type object) contains a non-Type object.");
  });
  var i = Object.create(lo.prototype);
  return i.implicit = (this.implicit || []).concat(r), i.explicit = (this.explicit || []).concat(n), i.compiledImplicit = Ka(i, "implicit"), i.compiledExplicit = Ka(i, "explicit"), i.compiledTypeMap = lm(i.compiledImplicit, i.compiledExplicit), i;
};
var vc = lo, cm = Oe, wc = new cm("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(e) {
    return e !== null ? e : "";
  }
}), um = Oe, _c = new um("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(e) {
    return e !== null ? e : [];
  }
}), fm = Oe, Ac = new fm("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(e) {
    return e !== null ? e : {};
  }
}), dm = vc, Tc = new dm({
  explicit: [
    wc,
    _c,
    Ac
  ]
}), hm = Oe;
function pm(e) {
  if (e === null) return !0;
  var t = e.length;
  return t === 1 && e === "~" || t === 4 && (e === "null" || e === "Null" || e === "NULL");
}
function mm() {
  return null;
}
function gm(e) {
  return e === null;
}
var Sc = new hm("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: pm,
  construct: mm,
  predicate: gm,
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
}), Em = Oe;
function ym(e) {
  if (e === null) return !1;
  var t = e.length;
  return t === 4 && (e === "true" || e === "True" || e === "TRUE") || t === 5 && (e === "false" || e === "False" || e === "FALSE");
}
function vm(e) {
  return e === "true" || e === "True" || e === "TRUE";
}
function wm(e) {
  return Object.prototype.toString.call(e) === "[object Boolean]";
}
var Cc = new Em("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: ym,
  construct: vm,
  predicate: wm,
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
}), _m = je, Am = Oe;
function Tm(e) {
  return 48 <= e && e <= 57 || 65 <= e && e <= 70 || 97 <= e && e <= 102;
}
function Sm(e) {
  return 48 <= e && e <= 55;
}
function Cm(e) {
  return 48 <= e && e <= 57;
}
function bm(e) {
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
          if (!Tm(e.charCodeAt(r))) return !1;
          n = !0;
        }
      return n && i !== "_";
    }
    if (i === "o") {
      for (r++; r < t; r++)
        if (i = e[r], i !== "_") {
          if (!Sm(e.charCodeAt(r))) return !1;
          n = !0;
        }
      return n && i !== "_";
    }
  }
  if (i === "_") return !1;
  for (; r < t; r++)
    if (i = e[r], i !== "_") {
      if (!Cm(e.charCodeAt(r)))
        return !1;
      n = !0;
    }
  return !(!n || i === "_");
}
function Rm(e) {
  var t = e, r = 1, n;
  if (t.indexOf("_") !== -1 && (t = t.replace(/_/g, "")), n = t[0], (n === "-" || n === "+") && (n === "-" && (r = -1), t = t.slice(1), n = t[0]), t === "0") return 0;
  if (n === "0") {
    if (t[1] === "b") return r * parseInt(t.slice(2), 2);
    if (t[1] === "x") return r * parseInt(t.slice(2), 16);
    if (t[1] === "o") return r * parseInt(t.slice(2), 8);
  }
  return r * parseInt(t, 10);
}
function Om(e) {
  return Object.prototype.toString.call(e) === "[object Number]" && e % 1 === 0 && !_m.isNegativeZero(e);
}
var bc = new Am("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: bm,
  construct: Rm,
  predicate: Om,
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
}), Rc = je, Im = Oe, Pm = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function Nm(e) {
  return !(e === null || !Pm.test(e) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  e[e.length - 1] === "_");
}
function Dm(e) {
  var t, r;
  return t = e.replace(/_/g, "").toLowerCase(), r = t[0] === "-" ? -1 : 1, "+-".indexOf(t[0]) >= 0 && (t = t.slice(1)), t === ".inf" ? r === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : t === ".nan" ? NaN : r * parseFloat(t, 10);
}
var $m = /^[-+]?[0-9]+e/;
function Fm(e, t) {
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
  else if (Rc.isNegativeZero(e))
    return "-0.0";
  return r = e.toString(10), $m.test(r) ? r.replace("e", ".e") : r;
}
function xm(e) {
  return Object.prototype.toString.call(e) === "[object Number]" && (e % 1 !== 0 || Rc.isNegativeZero(e));
}
var Oc = new Im("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: Nm,
  construct: Dm,
  predicate: xm,
  represent: Fm,
  defaultStyle: "lowercase"
}), Ic = Tc.extend({
  implicit: [
    Sc,
    Cc,
    bc,
    Oc
  ]
}), Pc = Ic, Lm = Oe, Nc = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
), Dc = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function Um(e) {
  return e === null ? !1 : Nc.exec(e) !== null || Dc.exec(e) !== null;
}
function km(e) {
  var t, r, n, i, o, a, s, l = 0, m = null, c, f, d;
  if (t = Nc.exec(e), t === null && (t = Dc.exec(e)), t === null) throw new Error("Date resolve error");
  if (r = +t[1], n = +t[2] - 1, i = +t[3], !t[4])
    return new Date(Date.UTC(r, n, i));
  if (o = +t[4], a = +t[5], s = +t[6], t[7]) {
    for (l = t[7].slice(0, 3); l.length < 3; )
      l += "0";
    l = +l;
  }
  return t[9] && (c = +t[10], f = +(t[11] || 0), m = (c * 60 + f) * 6e4, t[9] === "-" && (m = -m)), d = new Date(Date.UTC(r, n, i, o, a, s, l)), m && d.setTime(d.getTime() - m), d;
}
function Mm(e) {
  return e.toISOString();
}
var $c = new Lm("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: Um,
  construct: km,
  instanceOf: Date,
  represent: Mm
}), Bm = Oe;
function jm(e) {
  return e === "<<" || e === null;
}
var Fc = new Bm("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: jm
}), Hm = Oe, Fo = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
function qm(e) {
  if (e === null) return !1;
  var t, r, n = 0, i = e.length, o = Fo;
  for (r = 0; r < i; r++)
    if (t = o.indexOf(e.charAt(r)), !(t > 64)) {
      if (t < 0) return !1;
      n += 6;
    }
  return n % 8 === 0;
}
function Gm(e) {
  var t, r, n = e.replace(/[\r\n=]/g, ""), i = n.length, o = Fo, a = 0, s = [];
  for (t = 0; t < i; t++)
    t % 4 === 0 && t && (s.push(a >> 16 & 255), s.push(a >> 8 & 255), s.push(a & 255)), a = a << 6 | o.indexOf(n.charAt(t));
  return r = i % 4 * 6, r === 0 ? (s.push(a >> 16 & 255), s.push(a >> 8 & 255), s.push(a & 255)) : r === 18 ? (s.push(a >> 10 & 255), s.push(a >> 2 & 255)) : r === 12 && s.push(a >> 4 & 255), new Uint8Array(s);
}
function Wm(e) {
  var t = "", r = 0, n, i, o = e.length, a = Fo;
  for (n = 0; n < o; n++)
    n % 3 === 0 && n && (t += a[r >> 18 & 63], t += a[r >> 12 & 63], t += a[r >> 6 & 63], t += a[r & 63]), r = (r << 8) + e[n];
  return i = o % 3, i === 0 ? (t += a[r >> 18 & 63], t += a[r >> 12 & 63], t += a[r >> 6 & 63], t += a[r & 63]) : i === 2 ? (t += a[r >> 10 & 63], t += a[r >> 4 & 63], t += a[r << 2 & 63], t += a[64]) : i === 1 && (t += a[r >> 2 & 63], t += a[r << 4 & 63], t += a[64], t += a[64]), t;
}
function Vm(e) {
  return Object.prototype.toString.call(e) === "[object Uint8Array]";
}
var xc = new Hm("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: qm,
  construct: Gm,
  predicate: Vm,
  represent: Wm
}), Ym = Oe, zm = Object.prototype.hasOwnProperty, Xm = Object.prototype.toString;
function Km(e) {
  if (e === null) return !0;
  var t = [], r, n, i, o, a, s = e;
  for (r = 0, n = s.length; r < n; r += 1) {
    if (i = s[r], a = !1, Xm.call(i) !== "[object Object]") return !1;
    for (o in i)
      if (zm.call(i, o))
        if (!a) a = !0;
        else return !1;
    if (!a) return !1;
    if (t.indexOf(o) === -1) t.push(o);
    else return !1;
  }
  return !0;
}
function Jm(e) {
  return e !== null ? e : [];
}
var Lc = new Ym("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: Km,
  construct: Jm
}), Qm = Oe, Zm = Object.prototype.toString;
function eg(e) {
  if (e === null) return !0;
  var t, r, n, i, o, a = e;
  for (o = new Array(a.length), t = 0, r = a.length; t < r; t += 1) {
    if (n = a[t], Zm.call(n) !== "[object Object]" || (i = Object.keys(n), i.length !== 1)) return !1;
    o[t] = [i[0], n[i[0]]];
  }
  return !0;
}
function tg(e) {
  if (e === null) return [];
  var t, r, n, i, o, a = e;
  for (o = new Array(a.length), t = 0, r = a.length; t < r; t += 1)
    n = a[t], i = Object.keys(n), o[t] = [i[0], n[i[0]]];
  return o;
}
var Uc = new Qm("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: eg,
  construct: tg
}), rg = Oe, ng = Object.prototype.hasOwnProperty;
function ig(e) {
  if (e === null) return !0;
  var t, r = e;
  for (t in r)
    if (ng.call(r, t) && r[t] !== null)
      return !1;
  return !0;
}
function og(e) {
  return e !== null ? e : {};
}
var kc = new rg("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: ig,
  construct: og
}), xo = Pc.extend({
  implicit: [
    $c,
    Fc
  ],
  explicit: [
    xc,
    Lc,
    Uc,
    kc
  ]
}), Ot = je, Mc = Gr, ag = nm, sg = xo, ht = Object.prototype.hasOwnProperty, Ln = 1, Bc = 2, jc = 3, Un = 4, Di = 1, lg = 2, Ja = 3, cg = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/, ug = /[\x85\u2028\u2029]/, fg = /[,\[\]\{\}]/, Hc = /^(?:!|!!|![a-z\-]+!)$/i, qc = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
function Qa(e) {
  return Object.prototype.toString.call(e);
}
function ze(e) {
  return e === 10 || e === 13;
}
function Dt(e) {
  return e === 9 || e === 32;
}
function Ne(e) {
  return e === 9 || e === 32 || e === 10 || e === 13;
}
function Yt(e) {
  return e === 44 || e === 91 || e === 93 || e === 123 || e === 125;
}
function dg(e) {
  var t;
  return 48 <= e && e <= 57 ? e - 48 : (t = e | 32, 97 <= t && t <= 102 ? t - 97 + 10 : -1);
}
function hg(e) {
  return e === 120 ? 2 : e === 117 ? 4 : e === 85 ? 8 : 0;
}
function pg(e) {
  return 48 <= e && e <= 57 ? e - 48 : -1;
}
function Za(e) {
  return e === 48 ? "\0" : e === 97 ? "\x07" : e === 98 ? "\b" : e === 116 || e === 9 ? "	" : e === 110 ? `
` : e === 118 ? "\v" : e === 102 ? "\f" : e === 114 ? "\r" : e === 101 ? "\x1B" : e === 32 ? " " : e === 34 ? '"' : e === 47 ? "/" : e === 92 ? "\\" : e === 78 ? "" : e === 95 ? " " : e === 76 ? "\u2028" : e === 80 ? "\u2029" : "";
}
function mg(e) {
  return e <= 65535 ? String.fromCharCode(e) : String.fromCharCode(
    (e - 65536 >> 10) + 55296,
    (e - 65536 & 1023) + 56320
  );
}
function Gc(e, t, r) {
  t === "__proto__" ? Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !0,
    writable: !0,
    value: r
  }) : e[t] = r;
}
var Wc = new Array(256), Vc = new Array(256);
for (var jt = 0; jt < 256; jt++)
  Wc[jt] = Za(jt) ? 1 : 0, Vc[jt] = Za(jt);
function gg(e, t) {
  this.input = e, this.filename = t.filename || null, this.schema = t.schema || sg, this.onWarning = t.onWarning || null, this.legacy = t.legacy || !1, this.json = t.json || !1, this.listener = t.listener || null, this.implicitTypes = this.schema.compiledImplicit, this.typeMap = this.schema.compiledTypeMap, this.length = e.length, this.position = 0, this.line = 0, this.lineStart = 0, this.lineIndent = 0, this.firstTabInLine = -1, this.documents = [];
}
function Yc(e, t) {
  var r = {
    name: e.filename,
    buffer: e.input.slice(0, -1),
    // omit trailing \0
    position: e.position,
    line: e.line,
    column: e.position - e.lineStart
  };
  return r.snippet = ag(r), new Mc(t, r);
}
function L(e, t) {
  throw Yc(e, t);
}
function kn(e, t) {
  e.onWarning && e.onWarning.call(null, Yc(e, t));
}
var es = {
  YAML: function(t, r, n) {
    var i, o, a;
    t.version !== null && L(t, "duplication of %YAML directive"), n.length !== 1 && L(t, "YAML directive accepts exactly one argument"), i = /^([0-9]+)\.([0-9]+)$/.exec(n[0]), i === null && L(t, "ill-formed argument of the YAML directive"), o = parseInt(i[1], 10), a = parseInt(i[2], 10), o !== 1 && L(t, "unacceptable YAML version of the document"), t.version = n[0], t.checkLineBreaks = a < 2, a !== 1 && a !== 2 && kn(t, "unsupported YAML version of the document");
  },
  TAG: function(t, r, n) {
    var i, o;
    n.length !== 2 && L(t, "TAG directive accepts exactly two arguments"), i = n[0], o = n[1], Hc.test(i) || L(t, "ill-formed tag handle (first argument) of the TAG directive"), ht.call(t.tagMap, i) && L(t, 'there is a previously declared suffix for "' + i + '" tag handle'), qc.test(o) || L(t, "ill-formed tag prefix (second argument) of the TAG directive");
    try {
      o = decodeURIComponent(o);
    } catch {
      L(t, "tag prefix is malformed: " + o);
    }
    t.tagMap[i] = o;
  }
};
function ut(e, t, r, n) {
  var i, o, a, s;
  if (t < r) {
    if (s = e.input.slice(t, r), n)
      for (i = 0, o = s.length; i < o; i += 1)
        a = s.charCodeAt(i), a === 9 || 32 <= a && a <= 1114111 || L(e, "expected valid JSON character");
    else cg.test(s) && L(e, "the stream contains non-printable characters");
    e.result += s;
  }
}
function ts(e, t, r, n) {
  var i, o, a, s;
  for (Ot.isObject(r) || L(e, "cannot merge mappings; the provided source object is unacceptable"), i = Object.keys(r), a = 0, s = i.length; a < s; a += 1)
    o = i[a], ht.call(t, o) || (Gc(t, o, r[o]), n[o] = !0);
}
function zt(e, t, r, n, i, o, a, s, l) {
  var m, c;
  if (Array.isArray(i))
    for (i = Array.prototype.slice.call(i), m = 0, c = i.length; m < c; m += 1)
      Array.isArray(i[m]) && L(e, "nested arrays are not supported inside keys"), typeof i == "object" && Qa(i[m]) === "[object Object]" && (i[m] = "[object Object]");
  if (typeof i == "object" && Qa(i) === "[object Object]" && (i = "[object Object]"), i = String(i), t === null && (t = {}), n === "tag:yaml.org,2002:merge")
    if (Array.isArray(o))
      for (m = 0, c = o.length; m < c; m += 1)
        ts(e, t, o[m], r);
    else
      ts(e, t, o, r);
  else
    !e.json && !ht.call(r, i) && ht.call(t, i) && (e.line = a || e.line, e.lineStart = s || e.lineStart, e.position = l || e.position, L(e, "duplicated mapping key")), Gc(t, i, o), delete r[i];
  return t;
}
function Lo(e) {
  var t;
  t = e.input.charCodeAt(e.position), t === 10 ? e.position++ : t === 13 ? (e.position++, e.input.charCodeAt(e.position) === 10 && e.position++) : L(e, "a line break is expected"), e.line += 1, e.lineStart = e.position, e.firstTabInLine = -1;
}
function ae(e, t, r) {
  for (var n = 0, i = e.input.charCodeAt(e.position); i !== 0; ) {
    for (; Dt(i); )
      i === 9 && e.firstTabInLine === -1 && (e.firstTabInLine = e.position), i = e.input.charCodeAt(++e.position);
    if (t && i === 35)
      do
        i = e.input.charCodeAt(++e.position);
      while (i !== 10 && i !== 13 && i !== 0);
    if (ze(i))
      for (Lo(e), i = e.input.charCodeAt(e.position), n++, e.lineIndent = 0; i === 32; )
        e.lineIndent++, i = e.input.charCodeAt(++e.position);
    else
      break;
  }
  return r !== -1 && n !== 0 && e.lineIndent < r && kn(e, "deficient indentation"), n;
}
function Kn(e) {
  var t = e.position, r;
  return r = e.input.charCodeAt(t), !!((r === 45 || r === 46) && r === e.input.charCodeAt(t + 1) && r === e.input.charCodeAt(t + 2) && (t += 3, r = e.input.charCodeAt(t), r === 0 || Ne(r)));
}
function Uo(e, t) {
  t === 1 ? e.result += " " : t > 1 && (e.result += Ot.repeat(`
`, t - 1));
}
function Eg(e, t, r) {
  var n, i, o, a, s, l, m, c, f = e.kind, d = e.result, g;
  if (g = e.input.charCodeAt(e.position), Ne(g) || Yt(g) || g === 35 || g === 38 || g === 42 || g === 33 || g === 124 || g === 62 || g === 39 || g === 34 || g === 37 || g === 64 || g === 96 || (g === 63 || g === 45) && (i = e.input.charCodeAt(e.position + 1), Ne(i) || r && Yt(i)))
    return !1;
  for (e.kind = "scalar", e.result = "", o = a = e.position, s = !1; g !== 0; ) {
    if (g === 58) {
      if (i = e.input.charCodeAt(e.position + 1), Ne(i) || r && Yt(i))
        break;
    } else if (g === 35) {
      if (n = e.input.charCodeAt(e.position - 1), Ne(n))
        break;
    } else {
      if (e.position === e.lineStart && Kn(e) || r && Yt(g))
        break;
      if (ze(g))
        if (l = e.line, m = e.lineStart, c = e.lineIndent, ae(e, !1, -1), e.lineIndent >= t) {
          s = !0, g = e.input.charCodeAt(e.position);
          continue;
        } else {
          e.position = a, e.line = l, e.lineStart = m, e.lineIndent = c;
          break;
        }
    }
    s && (ut(e, o, a, !1), Uo(e, e.line - l), o = a = e.position, s = !1), Dt(g) || (a = e.position + 1), g = e.input.charCodeAt(++e.position);
  }
  return ut(e, o, a, !1), e.result ? !0 : (e.kind = f, e.result = d, !1);
}
function yg(e, t) {
  var r, n, i;
  if (r = e.input.charCodeAt(e.position), r !== 39)
    return !1;
  for (e.kind = "scalar", e.result = "", e.position++, n = i = e.position; (r = e.input.charCodeAt(e.position)) !== 0; )
    if (r === 39)
      if (ut(e, n, e.position, !0), r = e.input.charCodeAt(++e.position), r === 39)
        n = e.position, e.position++, i = e.position;
      else
        return !0;
    else ze(r) ? (ut(e, n, i, !0), Uo(e, ae(e, !1, t)), n = i = e.position) : e.position === e.lineStart && Kn(e) ? L(e, "unexpected end of the document within a single quoted scalar") : (e.position++, i = e.position);
  L(e, "unexpected end of the stream within a single quoted scalar");
}
function vg(e, t) {
  var r, n, i, o, a, s;
  if (s = e.input.charCodeAt(e.position), s !== 34)
    return !1;
  for (e.kind = "scalar", e.result = "", e.position++, r = n = e.position; (s = e.input.charCodeAt(e.position)) !== 0; ) {
    if (s === 34)
      return ut(e, r, e.position, !0), e.position++, !0;
    if (s === 92) {
      if (ut(e, r, e.position, !0), s = e.input.charCodeAt(++e.position), ze(s))
        ae(e, !1, t);
      else if (s < 256 && Wc[s])
        e.result += Vc[s], e.position++;
      else if ((a = hg(s)) > 0) {
        for (i = a, o = 0; i > 0; i--)
          s = e.input.charCodeAt(++e.position), (a = dg(s)) >= 0 ? o = (o << 4) + a : L(e, "expected hexadecimal character");
        e.result += mg(o), e.position++;
      } else
        L(e, "unknown escape sequence");
      r = n = e.position;
    } else ze(s) ? (ut(e, r, n, !0), Uo(e, ae(e, !1, t)), r = n = e.position) : e.position === e.lineStart && Kn(e) ? L(e, "unexpected end of the document within a double quoted scalar") : (e.position++, n = e.position);
  }
  L(e, "unexpected end of the stream within a double quoted scalar");
}
function wg(e, t) {
  var r = !0, n, i, o, a = e.tag, s, l = e.anchor, m, c, f, d, g, v = /* @__PURE__ */ Object.create(null), y, A, S, T;
  if (T = e.input.charCodeAt(e.position), T === 91)
    c = 93, g = !1, s = [];
  else if (T === 123)
    c = 125, g = !0, s = {};
  else
    return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = s), T = e.input.charCodeAt(++e.position); T !== 0; ) {
    if (ae(e, !0, t), T = e.input.charCodeAt(e.position), T === c)
      return e.position++, e.tag = a, e.anchor = l, e.kind = g ? "mapping" : "sequence", e.result = s, !0;
    r ? T === 44 && L(e, "expected the node content, but found ','") : L(e, "missed comma between flow collection entries"), A = y = S = null, f = d = !1, T === 63 && (m = e.input.charCodeAt(e.position + 1), Ne(m) && (f = d = !0, e.position++, ae(e, !0, t))), n = e.line, i = e.lineStart, o = e.position, rr(e, t, Ln, !1, !0), A = e.tag, y = e.result, ae(e, !0, t), T = e.input.charCodeAt(e.position), (d || e.line === n) && T === 58 && (f = !0, T = e.input.charCodeAt(++e.position), ae(e, !0, t), rr(e, t, Ln, !1, !0), S = e.result), g ? zt(e, s, v, A, y, S, n, i, o) : f ? s.push(zt(e, null, v, A, y, S, n, i, o)) : s.push(y), ae(e, !0, t), T = e.input.charCodeAt(e.position), T === 44 ? (r = !0, T = e.input.charCodeAt(++e.position)) : r = !1;
  }
  L(e, "unexpected end of the stream within a flow collection");
}
function _g(e, t) {
  var r, n, i = Di, o = !1, a = !1, s = t, l = 0, m = !1, c, f;
  if (f = e.input.charCodeAt(e.position), f === 124)
    n = !1;
  else if (f === 62)
    n = !0;
  else
    return !1;
  for (e.kind = "scalar", e.result = ""; f !== 0; )
    if (f = e.input.charCodeAt(++e.position), f === 43 || f === 45)
      Di === i ? i = f === 43 ? Ja : lg : L(e, "repeat of a chomping mode identifier");
    else if ((c = pg(f)) >= 0)
      c === 0 ? L(e, "bad explicit indentation width of a block scalar; it cannot be less than one") : a ? L(e, "repeat of an indentation width identifier") : (s = t + c - 1, a = !0);
    else
      break;
  if (Dt(f)) {
    do
      f = e.input.charCodeAt(++e.position);
    while (Dt(f));
    if (f === 35)
      do
        f = e.input.charCodeAt(++e.position);
      while (!ze(f) && f !== 0);
  }
  for (; f !== 0; ) {
    for (Lo(e), e.lineIndent = 0, f = e.input.charCodeAt(e.position); (!a || e.lineIndent < s) && f === 32; )
      e.lineIndent++, f = e.input.charCodeAt(++e.position);
    if (!a && e.lineIndent > s && (s = e.lineIndent), ze(f)) {
      l++;
      continue;
    }
    if (e.lineIndent < s) {
      i === Ja ? e.result += Ot.repeat(`
`, o ? 1 + l : l) : i === Di && o && (e.result += `
`);
      break;
    }
    for (n ? Dt(f) ? (m = !0, e.result += Ot.repeat(`
`, o ? 1 + l : l)) : m ? (m = !1, e.result += Ot.repeat(`
`, l + 1)) : l === 0 ? o && (e.result += " ") : e.result += Ot.repeat(`
`, l) : e.result += Ot.repeat(`
`, o ? 1 + l : l), o = !0, a = !0, l = 0, r = e.position; !ze(f) && f !== 0; )
      f = e.input.charCodeAt(++e.position);
    ut(e, r, e.position, !1);
  }
  return !0;
}
function rs(e, t) {
  var r, n = e.tag, i = e.anchor, o = [], a, s = !1, l;
  if (e.firstTabInLine !== -1) return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = o), l = e.input.charCodeAt(e.position); l !== 0 && (e.firstTabInLine !== -1 && (e.position = e.firstTabInLine, L(e, "tab characters must not be used in indentation")), !(l !== 45 || (a = e.input.charCodeAt(e.position + 1), !Ne(a)))); ) {
    if (s = !0, e.position++, ae(e, !0, -1) && e.lineIndent <= t) {
      o.push(null), l = e.input.charCodeAt(e.position);
      continue;
    }
    if (r = e.line, rr(e, t, jc, !1, !0), o.push(e.result), ae(e, !0, -1), l = e.input.charCodeAt(e.position), (e.line === r || e.lineIndent > t) && l !== 0)
      L(e, "bad indentation of a sequence entry");
    else if (e.lineIndent < t)
      break;
  }
  return s ? (e.tag = n, e.anchor = i, e.kind = "sequence", e.result = o, !0) : !1;
}
function Ag(e, t, r) {
  var n, i, o, a, s, l, m = e.tag, c = e.anchor, f = {}, d = /* @__PURE__ */ Object.create(null), g = null, v = null, y = null, A = !1, S = !1, T;
  if (e.firstTabInLine !== -1) return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = f), T = e.input.charCodeAt(e.position); T !== 0; ) {
    if (!A && e.firstTabInLine !== -1 && (e.position = e.firstTabInLine, L(e, "tab characters must not be used in indentation")), n = e.input.charCodeAt(e.position + 1), o = e.line, (T === 63 || T === 58) && Ne(n))
      T === 63 ? (A && (zt(e, f, d, g, v, null, a, s, l), g = v = y = null), S = !0, A = !0, i = !0) : A ? (A = !1, i = !0) : L(e, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line"), e.position += 1, T = n;
    else {
      if (a = e.line, s = e.lineStart, l = e.position, !rr(e, r, Bc, !1, !0))
        break;
      if (e.line === o) {
        for (T = e.input.charCodeAt(e.position); Dt(T); )
          T = e.input.charCodeAt(++e.position);
        if (T === 58)
          T = e.input.charCodeAt(++e.position), Ne(T) || L(e, "a whitespace character is expected after the key-value separator within a block mapping"), A && (zt(e, f, d, g, v, null, a, s, l), g = v = y = null), S = !0, A = !1, i = !1, g = e.tag, v = e.result;
        else if (S)
          L(e, "can not read an implicit mapping pair; a colon is missed");
        else
          return e.tag = m, e.anchor = c, !0;
      } else if (S)
        L(e, "can not read a block mapping entry; a multiline key may not be an implicit key");
      else
        return e.tag = m, e.anchor = c, !0;
    }
    if ((e.line === o || e.lineIndent > t) && (A && (a = e.line, s = e.lineStart, l = e.position), rr(e, t, Un, !0, i) && (A ? v = e.result : y = e.result), A || (zt(e, f, d, g, v, y, a, s, l), g = v = y = null), ae(e, !0, -1), T = e.input.charCodeAt(e.position)), (e.line === o || e.lineIndent > t) && T !== 0)
      L(e, "bad indentation of a mapping entry");
    else if (e.lineIndent < t)
      break;
  }
  return A && zt(e, f, d, g, v, null, a, s, l), S && (e.tag = m, e.anchor = c, e.kind = "mapping", e.result = f), S;
}
function Tg(e) {
  var t, r = !1, n = !1, i, o, a;
  if (a = e.input.charCodeAt(e.position), a !== 33) return !1;
  if (e.tag !== null && L(e, "duplication of a tag property"), a = e.input.charCodeAt(++e.position), a === 60 ? (r = !0, a = e.input.charCodeAt(++e.position)) : a === 33 ? (n = !0, i = "!!", a = e.input.charCodeAt(++e.position)) : i = "!", t = e.position, r) {
    do
      a = e.input.charCodeAt(++e.position);
    while (a !== 0 && a !== 62);
    e.position < e.length ? (o = e.input.slice(t, e.position), a = e.input.charCodeAt(++e.position)) : L(e, "unexpected end of the stream within a verbatim tag");
  } else {
    for (; a !== 0 && !Ne(a); )
      a === 33 && (n ? L(e, "tag suffix cannot contain exclamation marks") : (i = e.input.slice(t - 1, e.position + 1), Hc.test(i) || L(e, "named tag handle cannot contain such characters"), n = !0, t = e.position + 1)), a = e.input.charCodeAt(++e.position);
    o = e.input.slice(t, e.position), fg.test(o) && L(e, "tag suffix cannot contain flow indicator characters");
  }
  o && !qc.test(o) && L(e, "tag name cannot contain such characters: " + o);
  try {
    o = decodeURIComponent(o);
  } catch {
    L(e, "tag name is malformed: " + o);
  }
  return r ? e.tag = o : ht.call(e.tagMap, i) ? e.tag = e.tagMap[i] + o : i === "!" ? e.tag = "!" + o : i === "!!" ? e.tag = "tag:yaml.org,2002:" + o : L(e, 'undeclared tag handle "' + i + '"'), !0;
}
function Sg(e) {
  var t, r;
  if (r = e.input.charCodeAt(e.position), r !== 38) return !1;
  for (e.anchor !== null && L(e, "duplication of an anchor property"), r = e.input.charCodeAt(++e.position), t = e.position; r !== 0 && !Ne(r) && !Yt(r); )
    r = e.input.charCodeAt(++e.position);
  return e.position === t && L(e, "name of an anchor node must contain at least one character"), e.anchor = e.input.slice(t, e.position), !0;
}
function Cg(e) {
  var t, r, n;
  if (n = e.input.charCodeAt(e.position), n !== 42) return !1;
  for (n = e.input.charCodeAt(++e.position), t = e.position; n !== 0 && !Ne(n) && !Yt(n); )
    n = e.input.charCodeAt(++e.position);
  return e.position === t && L(e, "name of an alias node must contain at least one character"), r = e.input.slice(t, e.position), ht.call(e.anchorMap, r) || L(e, 'unidentified alias "' + r + '"'), e.result = e.anchorMap[r], ae(e, !0, -1), !0;
}
function rr(e, t, r, n, i) {
  var o, a, s, l = 1, m = !1, c = !1, f, d, g, v, y, A;
  if (e.listener !== null && e.listener("open", e), e.tag = null, e.anchor = null, e.kind = null, e.result = null, o = a = s = Un === r || jc === r, n && ae(e, !0, -1) && (m = !0, e.lineIndent > t ? l = 1 : e.lineIndent === t ? l = 0 : e.lineIndent < t && (l = -1)), l === 1)
    for (; Tg(e) || Sg(e); )
      ae(e, !0, -1) ? (m = !0, s = o, e.lineIndent > t ? l = 1 : e.lineIndent === t ? l = 0 : e.lineIndent < t && (l = -1)) : s = !1;
  if (s && (s = m || i), (l === 1 || Un === r) && (Ln === r || Bc === r ? y = t : y = t + 1, A = e.position - e.lineStart, l === 1 ? s && (rs(e, A) || Ag(e, A, y)) || wg(e, y) ? c = !0 : (a && _g(e, y) || yg(e, y) || vg(e, y) ? c = !0 : Cg(e) ? (c = !0, (e.tag !== null || e.anchor !== null) && L(e, "alias node should not have any properties")) : Eg(e, y, Ln === r) && (c = !0, e.tag === null && (e.tag = "?")), e.anchor !== null && (e.anchorMap[e.anchor] = e.result)) : l === 0 && (c = s && rs(e, A))), e.tag === null)
    e.anchor !== null && (e.anchorMap[e.anchor] = e.result);
  else if (e.tag === "?") {
    for (e.result !== null && e.kind !== "scalar" && L(e, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + e.kind + '"'), f = 0, d = e.implicitTypes.length; f < d; f += 1)
      if (v = e.implicitTypes[f], v.resolve(e.result)) {
        e.result = v.construct(e.result), e.tag = v.tag, e.anchor !== null && (e.anchorMap[e.anchor] = e.result);
        break;
      }
  } else if (e.tag !== "!") {
    if (ht.call(e.typeMap[e.kind || "fallback"], e.tag))
      v = e.typeMap[e.kind || "fallback"][e.tag];
    else
      for (v = null, g = e.typeMap.multi[e.kind || "fallback"], f = 0, d = g.length; f < d; f += 1)
        if (e.tag.slice(0, g[f].tag.length) === g[f].tag) {
          v = g[f];
          break;
        }
    v || L(e, "unknown tag !<" + e.tag + ">"), e.result !== null && v.kind !== e.kind && L(e, "unacceptable node kind for !<" + e.tag + '> tag; it should be "' + v.kind + '", not "' + e.kind + '"'), v.resolve(e.result, e.tag) ? (e.result = v.construct(e.result, e.tag), e.anchor !== null && (e.anchorMap[e.anchor] = e.result)) : L(e, "cannot resolve a node with !<" + e.tag + "> explicit tag");
  }
  return e.listener !== null && e.listener("close", e), e.tag !== null || e.anchor !== null || c;
}
function bg(e) {
  var t = e.position, r, n, i, o = !1, a;
  for (e.version = null, e.checkLineBreaks = e.legacy, e.tagMap = /* @__PURE__ */ Object.create(null), e.anchorMap = /* @__PURE__ */ Object.create(null); (a = e.input.charCodeAt(e.position)) !== 0 && (ae(e, !0, -1), a = e.input.charCodeAt(e.position), !(e.lineIndent > 0 || a !== 37)); ) {
    for (o = !0, a = e.input.charCodeAt(++e.position), r = e.position; a !== 0 && !Ne(a); )
      a = e.input.charCodeAt(++e.position);
    for (n = e.input.slice(r, e.position), i = [], n.length < 1 && L(e, "directive name must not be less than one character in length"); a !== 0; ) {
      for (; Dt(a); )
        a = e.input.charCodeAt(++e.position);
      if (a === 35) {
        do
          a = e.input.charCodeAt(++e.position);
        while (a !== 0 && !ze(a));
        break;
      }
      if (ze(a)) break;
      for (r = e.position; a !== 0 && !Ne(a); )
        a = e.input.charCodeAt(++e.position);
      i.push(e.input.slice(r, e.position));
    }
    a !== 0 && Lo(e), ht.call(es, n) ? es[n](e, n, i) : kn(e, 'unknown document directive "' + n + '"');
  }
  if (ae(e, !0, -1), e.lineIndent === 0 && e.input.charCodeAt(e.position) === 45 && e.input.charCodeAt(e.position + 1) === 45 && e.input.charCodeAt(e.position + 2) === 45 ? (e.position += 3, ae(e, !0, -1)) : o && L(e, "directives end mark is expected"), rr(e, e.lineIndent - 1, Un, !1, !0), ae(e, !0, -1), e.checkLineBreaks && ug.test(e.input.slice(t, e.position)) && kn(e, "non-ASCII line breaks are interpreted as content"), e.documents.push(e.result), e.position === e.lineStart && Kn(e)) {
    e.input.charCodeAt(e.position) === 46 && (e.position += 3, ae(e, !0, -1));
    return;
  }
  if (e.position < e.length - 1)
    L(e, "end of the stream or a document separator is expected");
  else
    return;
}
function zc(e, t) {
  e = String(e), t = t || {}, e.length !== 0 && (e.charCodeAt(e.length - 1) !== 10 && e.charCodeAt(e.length - 1) !== 13 && (e += `
`), e.charCodeAt(0) === 65279 && (e = e.slice(1)));
  var r = new gg(e, t), n = e.indexOf("\0");
  for (n !== -1 && (r.position = n, L(r, "null byte is not allowed in input")), r.input += "\0"; r.input.charCodeAt(r.position) === 32; )
    r.lineIndent += 1, r.position += 1;
  for (; r.position < r.length - 1; )
    bg(r);
  return r.documents;
}
function Rg(e, t, r) {
  t !== null && typeof t == "object" && typeof r > "u" && (r = t, t = null);
  var n = zc(e, r);
  if (typeof t != "function")
    return n;
  for (var i = 0, o = n.length; i < o; i += 1)
    t(n[i]);
}
function Og(e, t) {
  var r = zc(e, t);
  if (r.length !== 0) {
    if (r.length === 1)
      return r[0];
    throw new Mc("expected a single document in the stream, but found more");
  }
}
$o.loadAll = Rg;
$o.load = Og;
var Xc = {}, Jn = je, Wr = Gr, Ig = xo, Kc = Object.prototype.toString, Jc = Object.prototype.hasOwnProperty, ko = 65279, Pg = 9, Ir = 10, Ng = 13, Dg = 32, $g = 33, Fg = 34, co = 35, xg = 37, Lg = 38, Ug = 39, kg = 42, Qc = 44, Mg = 45, Mn = 58, Bg = 61, jg = 62, Hg = 63, qg = 64, Zc = 91, eu = 93, Gg = 96, tu = 123, Wg = 124, ru = 125, we = {};
we[0] = "\\0";
we[7] = "\\a";
we[8] = "\\b";
we[9] = "\\t";
we[10] = "\\n";
we[11] = "\\v";
we[12] = "\\f";
we[13] = "\\r";
we[27] = "\\e";
we[34] = '\\"';
we[92] = "\\\\";
we[133] = "\\N";
we[160] = "\\_";
we[8232] = "\\L";
we[8233] = "\\P";
var Vg = [
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
], Yg = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
function zg(e, t) {
  var r, n, i, o, a, s, l;
  if (t === null) return {};
  for (r = {}, n = Object.keys(t), i = 0, o = n.length; i < o; i += 1)
    a = n[i], s = String(t[a]), a.slice(0, 2) === "!!" && (a = "tag:yaml.org,2002:" + a.slice(2)), l = e.compiledTypeMap.fallback[a], l && Jc.call(l.styleAliases, s) && (s = l.styleAliases[s]), r[a] = s;
  return r;
}
function Xg(e) {
  var t, r, n;
  if (t = e.toString(16).toUpperCase(), e <= 255)
    r = "x", n = 2;
  else if (e <= 65535)
    r = "u", n = 4;
  else if (e <= 4294967295)
    r = "U", n = 8;
  else
    throw new Wr("code point within a string may not be greater than 0xFFFFFFFF");
  return "\\" + r + Jn.repeat("0", n - t.length) + t;
}
var Kg = 1, Pr = 2;
function Jg(e) {
  this.schema = e.schema || Ig, this.indent = Math.max(1, e.indent || 2), this.noArrayIndent = e.noArrayIndent || !1, this.skipInvalid = e.skipInvalid || !1, this.flowLevel = Jn.isNothing(e.flowLevel) ? -1 : e.flowLevel, this.styleMap = zg(this.schema, e.styles || null), this.sortKeys = e.sortKeys || !1, this.lineWidth = e.lineWidth || 80, this.noRefs = e.noRefs || !1, this.noCompatMode = e.noCompatMode || !1, this.condenseFlow = e.condenseFlow || !1, this.quotingType = e.quotingType === '"' ? Pr : Kg, this.forceQuotes = e.forceQuotes || !1, this.replacer = typeof e.replacer == "function" ? e.replacer : null, this.implicitTypes = this.schema.compiledImplicit, this.explicitTypes = this.schema.compiledExplicit, this.tag = null, this.result = "", this.duplicates = [], this.usedDuplicates = null;
}
function ns(e, t) {
  for (var r = Jn.repeat(" ", t), n = 0, i = -1, o = "", a, s = e.length; n < s; )
    i = e.indexOf(`
`, n), i === -1 ? (a = e.slice(n), n = s) : (a = e.slice(n, i + 1), n = i + 1), a.length && a !== `
` && (o += r), o += a;
  return o;
}
function uo(e, t) {
  return `
` + Jn.repeat(" ", e.indent * t);
}
function Qg(e, t) {
  var r, n, i;
  for (r = 0, n = e.implicitTypes.length; r < n; r += 1)
    if (i = e.implicitTypes[r], i.resolve(t))
      return !0;
  return !1;
}
function Bn(e) {
  return e === Dg || e === Pg;
}
function Nr(e) {
  return 32 <= e && e <= 126 || 161 <= e && e <= 55295 && e !== 8232 && e !== 8233 || 57344 <= e && e <= 65533 && e !== ko || 65536 <= e && e <= 1114111;
}
function is(e) {
  return Nr(e) && e !== ko && e !== Ng && e !== Ir;
}
function os(e, t, r) {
  var n = is(e), i = n && !Bn(e);
  return (
    // ns-plain-safe
    (r ? (
      // c = flow-in
      n
    ) : n && e !== Qc && e !== Zc && e !== eu && e !== tu && e !== ru) && e !== co && !(t === Mn && !i) || is(t) && !Bn(t) && e === co || t === Mn && i
  );
}
function Zg(e) {
  return Nr(e) && e !== ko && !Bn(e) && e !== Mg && e !== Hg && e !== Mn && e !== Qc && e !== Zc && e !== eu && e !== tu && e !== ru && e !== co && e !== Lg && e !== kg && e !== $g && e !== Wg && e !== Bg && e !== jg && e !== Ug && e !== Fg && e !== xg && e !== qg && e !== Gg;
}
function e0(e) {
  return !Bn(e) && e !== Mn;
}
function yr(e, t) {
  var r = e.charCodeAt(t), n;
  return r >= 55296 && r <= 56319 && t + 1 < e.length && (n = e.charCodeAt(t + 1), n >= 56320 && n <= 57343) ? (r - 55296) * 1024 + n - 56320 + 65536 : r;
}
function nu(e) {
  var t = /^\n* /;
  return t.test(e);
}
var iu = 1, fo = 2, ou = 3, au = 4, Wt = 5;
function t0(e, t, r, n, i, o, a, s) {
  var l, m = 0, c = null, f = !1, d = !1, g = n !== -1, v = -1, y = Zg(yr(e, 0)) && e0(yr(e, e.length - 1));
  if (t || a)
    for (l = 0; l < e.length; m >= 65536 ? l += 2 : l++) {
      if (m = yr(e, l), !Nr(m))
        return Wt;
      y = y && os(m, c, s), c = m;
    }
  else {
    for (l = 0; l < e.length; m >= 65536 ? l += 2 : l++) {
      if (m = yr(e, l), m === Ir)
        f = !0, g && (d = d || // Foldable line = too long, and not more-indented.
        l - v - 1 > n && e[v + 1] !== " ", v = l);
      else if (!Nr(m))
        return Wt;
      y = y && os(m, c, s), c = m;
    }
    d = d || g && l - v - 1 > n && e[v + 1] !== " ";
  }
  return !f && !d ? y && !a && !i(e) ? iu : o === Pr ? Wt : fo : r > 9 && nu(e) ? Wt : a ? o === Pr ? Wt : fo : d ? au : ou;
}
function r0(e, t, r, n, i) {
  e.dump = function() {
    if (t.length === 0)
      return e.quotingType === Pr ? '""' : "''";
    if (!e.noCompatMode && (Vg.indexOf(t) !== -1 || Yg.test(t)))
      return e.quotingType === Pr ? '"' + t + '"' : "'" + t + "'";
    var o = e.indent * Math.max(1, r), a = e.lineWidth === -1 ? -1 : Math.max(Math.min(e.lineWidth, 40), e.lineWidth - o), s = n || e.flowLevel > -1 && r >= e.flowLevel;
    function l(m) {
      return Qg(e, m);
    }
    switch (t0(
      t,
      s,
      e.indent,
      a,
      l,
      e.quotingType,
      e.forceQuotes && !n,
      i
    )) {
      case iu:
        return t;
      case fo:
        return "'" + t.replace(/'/g, "''") + "'";
      case ou:
        return "|" + as(t, e.indent) + ss(ns(t, o));
      case au:
        return ">" + as(t, e.indent) + ss(ns(n0(t, a), o));
      case Wt:
        return '"' + i0(t) + '"';
      default:
        throw new Wr("impossible error: invalid scalar style");
    }
  }();
}
function as(e, t) {
  var r = nu(e) ? String(t) : "", n = e[e.length - 1] === `
`, i = n && (e[e.length - 2] === `
` || e === `
`), o = i ? "+" : n ? "" : "-";
  return r + o + `
`;
}
function ss(e) {
  return e[e.length - 1] === `
` ? e.slice(0, -1) : e;
}
function n0(e, t) {
  for (var r = /(\n+)([^\n]*)/g, n = function() {
    var m = e.indexOf(`
`);
    return m = m !== -1 ? m : e.length, r.lastIndex = m, ls(e.slice(0, m), t);
  }(), i = e[0] === `
` || e[0] === " ", o, a; a = r.exec(e); ) {
    var s = a[1], l = a[2];
    o = l[0] === " ", n += s + (!i && !o && l !== "" ? `
` : "") + ls(l, t), i = o;
  }
  return n;
}
function ls(e, t) {
  if (e === "" || e[0] === " ") return e;
  for (var r = / [^ ]/g, n, i = 0, o, a = 0, s = 0, l = ""; n = r.exec(e); )
    s = n.index, s - i > t && (o = a > i ? a : s, l += `
` + e.slice(i, o), i = o + 1), a = s;
  return l += `
`, e.length - i > t && a > i ? l += e.slice(i, a) + `
` + e.slice(a + 1) : l += e.slice(i), l.slice(1);
}
function i0(e) {
  for (var t = "", r = 0, n, i = 0; i < e.length; r >= 65536 ? i += 2 : i++)
    r = yr(e, i), n = we[r], !n && Nr(r) ? (t += e[i], r >= 65536 && (t += e[i + 1])) : t += n || Xg(r);
  return t;
}
function o0(e, t, r) {
  var n = "", i = e.tag, o, a, s;
  for (o = 0, a = r.length; o < a; o += 1)
    s = r[o], e.replacer && (s = e.replacer.call(r, String(o), s)), (Ze(e, t, s, !1, !1) || typeof s > "u" && Ze(e, t, null, !1, !1)) && (n !== "" && (n += "," + (e.condenseFlow ? "" : " ")), n += e.dump);
  e.tag = i, e.dump = "[" + n + "]";
}
function cs(e, t, r, n) {
  var i = "", o = e.tag, a, s, l;
  for (a = 0, s = r.length; a < s; a += 1)
    l = r[a], e.replacer && (l = e.replacer.call(r, String(a), l)), (Ze(e, t + 1, l, !0, !0, !1, !0) || typeof l > "u" && Ze(e, t + 1, null, !0, !0, !1, !0)) && ((!n || i !== "") && (i += uo(e, t)), e.dump && Ir === e.dump.charCodeAt(0) ? i += "-" : i += "- ", i += e.dump);
  e.tag = o, e.dump = i || "[]";
}
function a0(e, t, r) {
  var n = "", i = e.tag, o = Object.keys(r), a, s, l, m, c;
  for (a = 0, s = o.length; a < s; a += 1)
    c = "", n !== "" && (c += ", "), e.condenseFlow && (c += '"'), l = o[a], m = r[l], e.replacer && (m = e.replacer.call(r, l, m)), Ze(e, t, l, !1, !1) && (e.dump.length > 1024 && (c += "? "), c += e.dump + (e.condenseFlow ? '"' : "") + ":" + (e.condenseFlow ? "" : " "), Ze(e, t, m, !1, !1) && (c += e.dump, n += c));
  e.tag = i, e.dump = "{" + n + "}";
}
function s0(e, t, r, n) {
  var i = "", o = e.tag, a = Object.keys(r), s, l, m, c, f, d;
  if (e.sortKeys === !0)
    a.sort();
  else if (typeof e.sortKeys == "function")
    a.sort(e.sortKeys);
  else if (e.sortKeys)
    throw new Wr("sortKeys must be a boolean or a function");
  for (s = 0, l = a.length; s < l; s += 1)
    d = "", (!n || i !== "") && (d += uo(e, t)), m = a[s], c = r[m], e.replacer && (c = e.replacer.call(r, m, c)), Ze(e, t + 1, m, !0, !0, !0) && (f = e.tag !== null && e.tag !== "?" || e.dump && e.dump.length > 1024, f && (e.dump && Ir === e.dump.charCodeAt(0) ? d += "?" : d += "? "), d += e.dump, f && (d += uo(e, t)), Ze(e, t + 1, c, !0, f) && (e.dump && Ir === e.dump.charCodeAt(0) ? d += ":" : d += ": ", d += e.dump, i += d));
  e.tag = o, e.dump = i || "{}";
}
function us(e, t, r) {
  var n, i, o, a, s, l;
  for (i = r ? e.explicitTypes : e.implicitTypes, o = 0, a = i.length; o < a; o += 1)
    if (s = i[o], (s.instanceOf || s.predicate) && (!s.instanceOf || typeof t == "object" && t instanceof s.instanceOf) && (!s.predicate || s.predicate(t))) {
      if (r ? s.multi && s.representName ? e.tag = s.representName(t) : e.tag = s.tag : e.tag = "?", s.represent) {
        if (l = e.styleMap[s.tag] || s.defaultStyle, Kc.call(s.represent) === "[object Function]")
          n = s.represent(t, l);
        else if (Jc.call(s.represent, l))
          n = s.represent[l](t, l);
        else
          throw new Wr("!<" + s.tag + '> tag resolver accepts not "' + l + '" style');
        e.dump = n;
      }
      return !0;
    }
  return !1;
}
function Ze(e, t, r, n, i, o, a) {
  e.tag = null, e.dump = r, us(e, r, !1) || us(e, r, !0);
  var s = Kc.call(e.dump), l = n, m;
  n && (n = e.flowLevel < 0 || e.flowLevel > t);
  var c = s === "[object Object]" || s === "[object Array]", f, d;
  if (c && (f = e.duplicates.indexOf(r), d = f !== -1), (e.tag !== null && e.tag !== "?" || d || e.indent !== 2 && t > 0) && (i = !1), d && e.usedDuplicates[f])
    e.dump = "*ref_" + f;
  else {
    if (c && d && !e.usedDuplicates[f] && (e.usedDuplicates[f] = !0), s === "[object Object]")
      n && Object.keys(e.dump).length !== 0 ? (s0(e, t, e.dump, i), d && (e.dump = "&ref_" + f + e.dump)) : (a0(e, t, e.dump), d && (e.dump = "&ref_" + f + " " + e.dump));
    else if (s === "[object Array]")
      n && e.dump.length !== 0 ? (e.noArrayIndent && !a && t > 0 ? cs(e, t - 1, e.dump, i) : cs(e, t, e.dump, i), d && (e.dump = "&ref_" + f + e.dump)) : (o0(e, t, e.dump), d && (e.dump = "&ref_" + f + " " + e.dump));
    else if (s === "[object String]")
      e.tag !== "?" && r0(e, e.dump, t, o, l);
    else {
      if (s === "[object Undefined]")
        return !1;
      if (e.skipInvalid) return !1;
      throw new Wr("unacceptable kind of an object to dump " + s);
    }
    e.tag !== null && e.tag !== "?" && (m = encodeURI(
      e.tag[0] === "!" ? e.tag.slice(1) : e.tag
    ).replace(/!/g, "%21"), e.tag[0] === "!" ? m = "!" + m : m.slice(0, 18) === "tag:yaml.org,2002:" ? m = "!!" + m.slice(18) : m = "!<" + m + ">", e.dump = m + " " + e.dump);
  }
  return !0;
}
function l0(e, t) {
  var r = [], n = [], i, o;
  for (ho(e, r, n), i = 0, o = n.length; i < o; i += 1)
    t.duplicates.push(r[n[i]]);
  t.usedDuplicates = new Array(o);
}
function ho(e, t, r) {
  var n, i, o;
  if (e !== null && typeof e == "object")
    if (i = t.indexOf(e), i !== -1)
      r.indexOf(i) === -1 && r.push(i);
    else if (t.push(e), Array.isArray(e))
      for (i = 0, o = e.length; i < o; i += 1)
        ho(e[i], t, r);
    else
      for (n = Object.keys(e), i = 0, o = n.length; i < o; i += 1)
        ho(e[n[i]], t, r);
}
function c0(e, t) {
  t = t || {};
  var r = new Jg(t);
  r.noRefs || l0(e, r);
  var n = e;
  return r.replacer && (n = r.replacer.call({ "": n }, "", n)), Ze(r, 0, n, !0, !0) ? r.dump + `
` : "";
}
Xc.dump = c0;
var su = $o, u0 = Xc;
function Mo(e, t) {
  return function() {
    throw new Error("Function yaml." + e + " is removed in js-yaml 4. Use yaml." + t + " instead, which is now safe by default.");
  };
}
ge.Type = Oe;
ge.Schema = vc;
ge.FAILSAFE_SCHEMA = Tc;
ge.JSON_SCHEMA = Ic;
ge.CORE_SCHEMA = Pc;
ge.DEFAULT_SCHEMA = xo;
ge.load = su.load;
ge.loadAll = su.loadAll;
ge.dump = u0.dump;
ge.YAMLException = Gr;
ge.types = {
  binary: xc,
  float: Oc,
  map: Ac,
  null: Sc,
  pairs: Uc,
  set: kc,
  timestamp: $c,
  bool: Cc,
  int: bc,
  merge: Fc,
  omap: Lc,
  seq: _c,
  str: wc
};
ge.safeLoad = Mo("safeLoad", "load");
ge.safeLoadAll = Mo("safeLoadAll", "loadAll");
ge.safeDump = Mo("safeDump", "dump");
var Qn = {};
Object.defineProperty(Qn, "__esModule", { value: !0 });
Qn.Lazy = void 0;
class f0 {
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
Qn.Lazy = f0;
var po = { exports: {} };
const d0 = "2.0.0", lu = 256, h0 = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
9007199254740991, p0 = 16, m0 = lu - 6, g0 = [
  "major",
  "premajor",
  "minor",
  "preminor",
  "patch",
  "prepatch",
  "prerelease"
];
var Zn = {
  MAX_LENGTH: lu,
  MAX_SAFE_COMPONENT_LENGTH: p0,
  MAX_SAFE_BUILD_LENGTH: m0,
  MAX_SAFE_INTEGER: h0,
  RELEASE_TYPES: g0,
  SEMVER_SPEC_VERSION: d0,
  FLAG_INCLUDE_PRERELEASE: 1,
  FLAG_LOOSE: 2
};
const E0 = typeof process == "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...e) => console.error("SEMVER", ...e) : () => {
};
var ei = E0;
(function(e, t) {
  const {
    MAX_SAFE_COMPONENT_LENGTH: r,
    MAX_SAFE_BUILD_LENGTH: n,
    MAX_LENGTH: i
  } = Zn, o = ei;
  t = e.exports = {};
  const a = t.re = [], s = t.safeRe = [], l = t.src = [], m = t.safeSrc = [], c = t.t = {};
  let f = 0;
  const d = "[a-zA-Z0-9-]", g = [
    ["\\s", 1],
    ["\\d", i],
    [d, n]
  ], v = (A) => {
    for (const [S, T] of g)
      A = A.split(`${S}*`).join(`${S}{0,${T}}`).split(`${S}+`).join(`${S}{1,${T}}`);
    return A;
  }, y = (A, S, T) => {
    const D = v(S), x = f++;
    o(A, x, S), c[A] = x, l[x] = S, m[x] = D, a[x] = new RegExp(S, T ? "g" : void 0), s[x] = new RegExp(D, T ? "g" : void 0);
  };
  y("NUMERICIDENTIFIER", "0|[1-9]\\d*"), y("NUMERICIDENTIFIERLOOSE", "\\d+"), y("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${d}*`), y("MAINVERSION", `(${l[c.NUMERICIDENTIFIER]})\\.(${l[c.NUMERICIDENTIFIER]})\\.(${l[c.NUMERICIDENTIFIER]})`), y("MAINVERSIONLOOSE", `(${l[c.NUMERICIDENTIFIERLOOSE]})\\.(${l[c.NUMERICIDENTIFIERLOOSE]})\\.(${l[c.NUMERICIDENTIFIERLOOSE]})`), y("PRERELEASEIDENTIFIER", `(?:${l[c.NONNUMERICIDENTIFIER]}|${l[c.NUMERICIDENTIFIER]})`), y("PRERELEASEIDENTIFIERLOOSE", `(?:${l[c.NONNUMERICIDENTIFIER]}|${l[c.NUMERICIDENTIFIERLOOSE]})`), y("PRERELEASE", `(?:-(${l[c.PRERELEASEIDENTIFIER]}(?:\\.${l[c.PRERELEASEIDENTIFIER]})*))`), y("PRERELEASELOOSE", `(?:-?(${l[c.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${l[c.PRERELEASEIDENTIFIERLOOSE]})*))`), y("BUILDIDENTIFIER", `${d}+`), y("BUILD", `(?:\\+(${l[c.BUILDIDENTIFIER]}(?:\\.${l[c.BUILDIDENTIFIER]})*))`), y("FULLPLAIN", `v?${l[c.MAINVERSION]}${l[c.PRERELEASE]}?${l[c.BUILD]}?`), y("FULL", `^${l[c.FULLPLAIN]}$`), y("LOOSEPLAIN", `[v=\\s]*${l[c.MAINVERSIONLOOSE]}${l[c.PRERELEASELOOSE]}?${l[c.BUILD]}?`), y("LOOSE", `^${l[c.LOOSEPLAIN]}$`), y("GTLT", "((?:<|>)?=?)"), y("XRANGEIDENTIFIERLOOSE", `${l[c.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`), y("XRANGEIDENTIFIER", `${l[c.NUMERICIDENTIFIER]}|x|X|\\*`), y("XRANGEPLAIN", `[v=\\s]*(${l[c.XRANGEIDENTIFIER]})(?:\\.(${l[c.XRANGEIDENTIFIER]})(?:\\.(${l[c.XRANGEIDENTIFIER]})(?:${l[c.PRERELEASE]})?${l[c.BUILD]}?)?)?`), y("XRANGEPLAINLOOSE", `[v=\\s]*(${l[c.XRANGEIDENTIFIERLOOSE]})(?:\\.(${l[c.XRANGEIDENTIFIERLOOSE]})(?:\\.(${l[c.XRANGEIDENTIFIERLOOSE]})(?:${l[c.PRERELEASELOOSE]})?${l[c.BUILD]}?)?)?`), y("XRANGE", `^${l[c.GTLT]}\\s*${l[c.XRANGEPLAIN]}$`), y("XRANGELOOSE", `^${l[c.GTLT]}\\s*${l[c.XRANGEPLAINLOOSE]}$`), y("COERCEPLAIN", `(^|[^\\d])(\\d{1,${r}})(?:\\.(\\d{1,${r}}))?(?:\\.(\\d{1,${r}}))?`), y("COERCE", `${l[c.COERCEPLAIN]}(?:$|[^\\d])`), y("COERCEFULL", l[c.COERCEPLAIN] + `(?:${l[c.PRERELEASE]})?(?:${l[c.BUILD]})?(?:$|[^\\d])`), y("COERCERTL", l[c.COERCE], !0), y("COERCERTLFULL", l[c.COERCEFULL], !0), y("LONETILDE", "(?:~>?)"), y("TILDETRIM", `(\\s*)${l[c.LONETILDE]}\\s+`, !0), t.tildeTrimReplace = "$1~", y("TILDE", `^${l[c.LONETILDE]}${l[c.XRANGEPLAIN]}$`), y("TILDELOOSE", `^${l[c.LONETILDE]}${l[c.XRANGEPLAINLOOSE]}$`), y("LONECARET", "(?:\\^)"), y("CARETTRIM", `(\\s*)${l[c.LONECARET]}\\s+`, !0), t.caretTrimReplace = "$1^", y("CARET", `^${l[c.LONECARET]}${l[c.XRANGEPLAIN]}$`), y("CARETLOOSE", `^${l[c.LONECARET]}${l[c.XRANGEPLAINLOOSE]}$`), y("COMPARATORLOOSE", `^${l[c.GTLT]}\\s*(${l[c.LOOSEPLAIN]})$|^$`), y("COMPARATOR", `^${l[c.GTLT]}\\s*(${l[c.FULLPLAIN]})$|^$`), y("COMPARATORTRIM", `(\\s*)${l[c.GTLT]}\\s*(${l[c.LOOSEPLAIN]}|${l[c.XRANGEPLAIN]})`, !0), t.comparatorTrimReplace = "$1$2$3", y("HYPHENRANGE", `^\\s*(${l[c.XRANGEPLAIN]})\\s+-\\s+(${l[c.XRANGEPLAIN]})\\s*$`), y("HYPHENRANGELOOSE", `^\\s*(${l[c.XRANGEPLAINLOOSE]})\\s+-\\s+(${l[c.XRANGEPLAINLOOSE]})\\s*$`), y("STAR", "(<|>)?=?\\s*\\*"), y("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$"), y("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
})(po, po.exports);
var Vr = po.exports;
const y0 = Object.freeze({ loose: !0 }), v0 = Object.freeze({}), w0 = (e) => e ? typeof e != "object" ? y0 : e : v0;
var Bo = w0;
const fs = /^[0-9]+$/, cu = (e, t) => {
  if (typeof e == "number" && typeof t == "number")
    return e === t ? 0 : e < t ? -1 : 1;
  const r = fs.test(e), n = fs.test(t);
  return r && n && (e = +e, t = +t), e === t ? 0 : r && !n ? -1 : n && !r ? 1 : e < t ? -1 : 1;
}, _0 = (e, t) => cu(t, e);
var uu = {
  compareIdentifiers: cu,
  rcompareIdentifiers: _0
};
const pn = ei, { MAX_LENGTH: ds, MAX_SAFE_INTEGER: mn } = Zn, { safeRe: gn, t: En } = Vr, A0 = Bo, { compareIdentifiers: $i } = uu;
let T0 = class Ye {
  constructor(t, r) {
    if (r = A0(r), t instanceof Ye) {
      if (t.loose === !!r.loose && t.includePrerelease === !!r.includePrerelease)
        return t;
      t = t.version;
    } else if (typeof t != "string")
      throw new TypeError(`Invalid version. Must be a string. Got type "${typeof t}".`);
    if (t.length > ds)
      throw new TypeError(
        `version is longer than ${ds} characters`
      );
    pn("SemVer", t, r), this.options = r, this.loose = !!r.loose, this.includePrerelease = !!r.includePrerelease;
    const n = t.trim().match(r.loose ? gn[En.LOOSE] : gn[En.FULL]);
    if (!n)
      throw new TypeError(`Invalid Version: ${t}`);
    if (this.raw = t, this.major = +n[1], this.minor = +n[2], this.patch = +n[3], this.major > mn || this.major < 0)
      throw new TypeError("Invalid major version");
    if (this.minor > mn || this.minor < 0)
      throw new TypeError("Invalid minor version");
    if (this.patch > mn || this.patch < 0)
      throw new TypeError("Invalid patch version");
    n[4] ? this.prerelease = n[4].split(".").map((i) => {
      if (/^[0-9]+$/.test(i)) {
        const o = +i;
        if (o >= 0 && o < mn)
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
    if (pn("SemVer.compare", this.version, this.options, t), !(t instanceof Ye)) {
      if (typeof t == "string" && t === this.version)
        return 0;
      t = new Ye(t, this.options);
    }
    return t.version === this.version ? 0 : this.compareMain(t) || this.comparePre(t);
  }
  compareMain(t) {
    return t instanceof Ye || (t = new Ye(t, this.options)), this.major < t.major ? -1 : this.major > t.major ? 1 : this.minor < t.minor ? -1 : this.minor > t.minor ? 1 : this.patch < t.patch ? -1 : this.patch > t.patch ? 1 : 0;
  }
  comparePre(t) {
    if (t instanceof Ye || (t = new Ye(t, this.options)), this.prerelease.length && !t.prerelease.length)
      return -1;
    if (!this.prerelease.length && t.prerelease.length)
      return 1;
    if (!this.prerelease.length && !t.prerelease.length)
      return 0;
    let r = 0;
    do {
      const n = this.prerelease[r], i = t.prerelease[r];
      if (pn("prerelease compare", r, n, i), n === void 0 && i === void 0)
        return 0;
      if (i === void 0)
        return 1;
      if (n === void 0)
        return -1;
      if (n === i)
        continue;
      return $i(n, i);
    } while (++r);
  }
  compareBuild(t) {
    t instanceof Ye || (t = new Ye(t, this.options));
    let r = 0;
    do {
      const n = this.build[r], i = t.build[r];
      if (pn("build compare", r, n, i), n === void 0 && i === void 0)
        return 0;
      if (i === void 0)
        return 1;
      if (n === void 0)
        return -1;
      if (n === i)
        continue;
      return $i(n, i);
    } while (++r);
  }
  // preminor will bump the version up to the next minor release, and immediately
  // down to pre-release. premajor and prepatch work the same way.
  inc(t, r, n) {
    if (t.startsWith("pre")) {
      if (!r && n === !1)
        throw new Error("invalid increment argument: identifier is empty");
      if (r) {
        const i = `-${r}`.match(this.options.loose ? gn[En.PRERELEASELOOSE] : gn[En.PRERELEASE]);
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
          n === !1 && (o = [r]), $i(this.prerelease[0], r) === 0 ? isNaN(this.prerelease[1]) && (this.prerelease = o) : this.prerelease = o;
        }
        break;
      }
      default:
        throw new Error(`invalid increment argument: ${t}`);
    }
    return this.raw = this.format(), this.build.length && (this.raw += `+${this.build.join(".")}`), this;
  }
};
var Ie = T0;
const hs = Ie, S0 = (e, t, r = !1) => {
  if (e instanceof hs)
    return e;
  try {
    return new hs(e, t);
  } catch (n) {
    if (!r)
      return null;
    throw n;
  }
};
var or = S0;
const C0 = or, b0 = (e, t) => {
  const r = C0(e, t);
  return r ? r.version : null;
};
var R0 = b0;
const O0 = or, I0 = (e, t) => {
  const r = O0(e.trim().replace(/^[=v]+/, ""), t);
  return r ? r.version : null;
};
var P0 = I0;
const ps = Ie, N0 = (e, t, r, n, i) => {
  typeof r == "string" && (i = n, n = r, r = void 0);
  try {
    return new ps(
      e instanceof ps ? e.version : e,
      r
    ).inc(t, n, i).version;
  } catch {
    return null;
  }
};
var D0 = N0;
const ms = or, $0 = (e, t) => {
  const r = ms(e, null, !0), n = ms(t, null, !0), i = r.compare(n);
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
var F0 = $0;
const x0 = Ie, L0 = (e, t) => new x0(e, t).major;
var U0 = L0;
const k0 = Ie, M0 = (e, t) => new k0(e, t).minor;
var B0 = M0;
const j0 = Ie, H0 = (e, t) => new j0(e, t).patch;
var q0 = H0;
const G0 = or, W0 = (e, t) => {
  const r = G0(e, t);
  return r && r.prerelease.length ? r.prerelease : null;
};
var V0 = W0;
const gs = Ie, Y0 = (e, t, r) => new gs(e, r).compare(new gs(t, r));
var He = Y0;
const z0 = He, X0 = (e, t, r) => z0(t, e, r);
var K0 = X0;
const J0 = He, Q0 = (e, t) => J0(e, t, !0);
var Z0 = Q0;
const Es = Ie, eE = (e, t, r) => {
  const n = new Es(e, r), i = new Es(t, r);
  return n.compare(i) || n.compareBuild(i);
};
var jo = eE;
const tE = jo, rE = (e, t) => e.sort((r, n) => tE(r, n, t));
var nE = rE;
const iE = jo, oE = (e, t) => e.sort((r, n) => iE(n, r, t));
var aE = oE;
const sE = He, lE = (e, t, r) => sE(e, t, r) > 0;
var ti = lE;
const cE = He, uE = (e, t, r) => cE(e, t, r) < 0;
var Ho = uE;
const fE = He, dE = (e, t, r) => fE(e, t, r) === 0;
var fu = dE;
const hE = He, pE = (e, t, r) => hE(e, t, r) !== 0;
var du = pE;
const mE = He, gE = (e, t, r) => mE(e, t, r) >= 0;
var qo = gE;
const EE = He, yE = (e, t, r) => EE(e, t, r) <= 0;
var Go = yE;
const vE = fu, wE = du, _E = ti, AE = qo, TE = Ho, SE = Go, CE = (e, t, r, n) => {
  switch (t) {
    case "===":
      return typeof e == "object" && (e = e.version), typeof r == "object" && (r = r.version), e === r;
    case "!==":
      return typeof e == "object" && (e = e.version), typeof r == "object" && (r = r.version), e !== r;
    case "":
    case "=":
    case "==":
      return vE(e, r, n);
    case "!=":
      return wE(e, r, n);
    case ">":
      return _E(e, r, n);
    case ">=":
      return AE(e, r, n);
    case "<":
      return TE(e, r, n);
    case "<=":
      return SE(e, r, n);
    default:
      throw new TypeError(`Invalid operator: ${t}`);
  }
};
var hu = CE;
const bE = Ie, RE = or, { safeRe: yn, t: vn } = Vr, OE = (e, t) => {
  if (e instanceof bE)
    return e;
  if (typeof e == "number" && (e = String(e)), typeof e != "string")
    return null;
  t = t || {};
  let r = null;
  if (!t.rtl)
    r = e.match(t.includePrerelease ? yn[vn.COERCEFULL] : yn[vn.COERCE]);
  else {
    const l = t.includePrerelease ? yn[vn.COERCERTLFULL] : yn[vn.COERCERTL];
    let m;
    for (; (m = l.exec(e)) && (!r || r.index + r[0].length !== e.length); )
      (!r || m.index + m[0].length !== r.index + r[0].length) && (r = m), l.lastIndex = m.index + m[1].length + m[2].length;
    l.lastIndex = -1;
  }
  if (r === null)
    return null;
  const n = r[2], i = r[3] || "0", o = r[4] || "0", a = t.includePrerelease && r[5] ? `-${r[5]}` : "", s = t.includePrerelease && r[6] ? `+${r[6]}` : "";
  return RE(`${n}.${i}.${o}${a}${s}`, t);
};
var IE = OE;
class PE {
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
var NE = PE, Fi, ys;
function qe() {
  if (ys) return Fi;
  ys = 1;
  const e = /\s+/g;
  class t {
    constructor(R, N) {
      if (N = i(N), R instanceof t)
        return R.loose === !!N.loose && R.includePrerelease === !!N.includePrerelease ? R : new t(R.raw, N);
      if (R instanceof o)
        return this.raw = R.value, this.set = [[R]], this.formatted = void 0, this;
      if (this.options = N, this.loose = !!N.loose, this.includePrerelease = !!N.includePrerelease, this.raw = R.trim().replace(e, " "), this.set = this.raw.split("||").map((b) => this.parseRange(b.trim())).filter((b) => b.length), !this.set.length)
        throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
      if (this.set.length > 1) {
        const b = this.set[0];
        if (this.set = this.set.filter(($) => !y($[0])), this.set.length === 0)
          this.set = [b];
        else if (this.set.length > 1) {
          for (const $ of this.set)
            if ($.length === 1 && A($[0])) {
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
        for (let R = 0; R < this.set.length; R++) {
          R > 0 && (this.formatted += "||");
          const N = this.set[R];
          for (let b = 0; b < N.length; b++)
            b > 0 && (this.formatted += " "), this.formatted += N[b].toString().trim();
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
    parseRange(R) {
      const b = ((this.options.includePrerelease && g) | (this.options.loose && v)) + ":" + R, $ = n.get(b);
      if ($)
        return $;
      const P = this.options.loose, k = P ? l[m.HYPHENRANGELOOSE] : l[m.HYPHENRANGE];
      R = R.replace(k, M(this.options.includePrerelease)), a("hyphen replace", R), R = R.replace(l[m.COMPARATORTRIM], c), a("comparator trim", R), R = R.replace(l[m.TILDETRIM], f), a("tilde trim", R), R = R.replace(l[m.CARETTRIM], d), a("caret trim", R);
      let G = R.split(" ").map((U) => T(U, this.options)).join(" ").split(/\s+/).map((U) => B(U, this.options));
      P && (G = G.filter((U) => (a("loose invalid filter", U, this.options), !!U.match(l[m.COMPARATORLOOSE])))), a("range list", G);
      const j = /* @__PURE__ */ new Map(), X = G.map((U) => new o(U, this.options));
      for (const U of X) {
        if (y(U))
          return [U];
        j.set(U.value, U);
      }
      j.size > 1 && j.has("") && j.delete("");
      const ue = [...j.values()];
      return n.set(b, ue), ue;
    }
    intersects(R, N) {
      if (!(R instanceof t))
        throw new TypeError("a Range is required");
      return this.set.some((b) => S(b, N) && R.set.some(($) => S($, N) && b.every((P) => $.every((k) => P.intersects(k, N)))));
    }
    // if ANY of the sets match ALL of its comparators, then pass
    test(R) {
      if (!R)
        return !1;
      if (typeof R == "string")
        try {
          R = new s(R, this.options);
        } catch {
          return !1;
        }
      for (let N = 0; N < this.set.length; N++)
        if (z(this.set[N], R, this.options))
          return !0;
      return !1;
    }
  }
  Fi = t;
  const r = NE, n = new r(), i = Bo, o = ri(), a = ei, s = Ie, {
    safeRe: l,
    t: m,
    comparatorTrimReplace: c,
    tildeTrimReplace: f,
    caretTrimReplace: d
  } = Vr, { FLAG_INCLUDE_PRERELEASE: g, FLAG_LOOSE: v } = Zn, y = (I) => I.value === "<0.0.0-0", A = (I) => I.value === "", S = (I, R) => {
    let N = !0;
    const b = I.slice();
    let $ = b.pop();
    for (; N && b.length; )
      N = b.every((P) => $.intersects(P, R)), $ = b.pop();
    return N;
  }, T = (I, R) => (I = I.replace(l[m.BUILD], ""), a("comp", I, R), I = oe(I, R), a("caret", I), I = x(I, R), a("tildes", I), I = De(I, R), a("xrange", I), I = q(I, R), a("stars", I), I), D = (I) => !I || I.toLowerCase() === "x" || I === "*", x = (I, R) => I.trim().split(/\s+/).map((N) => Z(N, R)).join(" "), Z = (I, R) => {
    const N = R.loose ? l[m.TILDELOOSE] : l[m.TILDE];
    return I.replace(N, (b, $, P, k, G) => {
      a("tilde", I, b, $, P, k, G);
      let j;
      return D($) ? j = "" : D(P) ? j = `>=${$}.0.0 <${+$ + 1}.0.0-0` : D(k) ? j = `>=${$}.${P}.0 <${$}.${+P + 1}.0-0` : G ? (a("replaceTilde pr", G), j = `>=${$}.${P}.${k}-${G} <${$}.${+P + 1}.0-0`) : j = `>=${$}.${P}.${k} <${$}.${+P + 1}.0-0`, a("tilde return", j), j;
    });
  }, oe = (I, R) => I.trim().split(/\s+/).map((N) => V(N, R)).join(" "), V = (I, R) => {
    a("caret", I, R);
    const N = R.loose ? l[m.CARETLOOSE] : l[m.CARET], b = R.includePrerelease ? "-0" : "";
    return I.replace(N, ($, P, k, G, j) => {
      a("caret", I, $, P, k, G, j);
      let X;
      return D(P) ? X = "" : D(k) ? X = `>=${P}.0.0${b} <${+P + 1}.0.0-0` : D(G) ? P === "0" ? X = `>=${P}.${k}.0${b} <${P}.${+k + 1}.0-0` : X = `>=${P}.${k}.0${b} <${+P + 1}.0.0-0` : j ? (a("replaceCaret pr", j), P === "0" ? k === "0" ? X = `>=${P}.${k}.${G}-${j} <${P}.${k}.${+G + 1}-0` : X = `>=${P}.${k}.${G}-${j} <${P}.${+k + 1}.0-0` : X = `>=${P}.${k}.${G}-${j} <${+P + 1}.0.0-0`) : (a("no pr"), P === "0" ? k === "0" ? X = `>=${P}.${k}.${G}${b} <${P}.${k}.${+G + 1}-0` : X = `>=${P}.${k}.${G}${b} <${P}.${+k + 1}.0-0` : X = `>=${P}.${k}.${G} <${+P + 1}.0.0-0`), a("caret return", X), X;
    });
  }, De = (I, R) => (a("replaceXRanges", I, R), I.split(/\s+/).map((N) => E(N, R)).join(" ")), E = (I, R) => {
    I = I.trim();
    const N = R.loose ? l[m.XRANGELOOSE] : l[m.XRANGE];
    return I.replace(N, (b, $, P, k, G, j) => {
      a("xRange", I, b, $, P, k, G, j);
      const X = D(P), ue = X || D(k), U = ue || D(G), We = U;
      return $ === "=" && We && ($ = ""), j = R.includePrerelease ? "-0" : "", X ? $ === ">" || $ === "<" ? b = "<0.0.0-0" : b = "*" : $ && We ? (ue && (k = 0), G = 0, $ === ">" ? ($ = ">=", ue ? (P = +P + 1, k = 0, G = 0) : (k = +k + 1, G = 0)) : $ === "<=" && ($ = "<", ue ? P = +P + 1 : k = +k + 1), $ === "<" && (j = "-0"), b = `${$ + P}.${k}.${G}${j}`) : ue ? b = `>=${P}.0.0${j} <${+P + 1}.0.0-0` : U && (b = `>=${P}.${k}.0${j} <${P}.${+k + 1}.0-0`), a("xRange return", b), b;
    });
  }, q = (I, R) => (a("replaceStars", I, R), I.trim().replace(l[m.STAR], "")), B = (I, R) => (a("replaceGTE0", I, R), I.trim().replace(l[R.includePrerelease ? m.GTE0PRE : m.GTE0], "")), M = (I) => (R, N, b, $, P, k, G, j, X, ue, U, We) => (D(b) ? N = "" : D($) ? N = `>=${b}.0.0${I ? "-0" : ""}` : D(P) ? N = `>=${b}.${$}.0${I ? "-0" : ""}` : k ? N = `>=${N}` : N = `>=${N}${I ? "-0" : ""}`, D(X) ? j = "" : D(ue) ? j = `<${+X + 1}.0.0-0` : D(U) ? j = `<${X}.${+ue + 1}.0-0` : We ? j = `<=${X}.${ue}.${U}-${We}` : I ? j = `<${X}.${ue}.${+U + 1}-0` : j = `<=${j}`, `${N} ${j}`.trim()), z = (I, R, N) => {
    for (let b = 0; b < I.length; b++)
      if (!I[b].test(R))
        return !1;
    if (R.prerelease.length && !N.includePrerelease) {
      for (let b = 0; b < I.length; b++)
        if (a(I[b].semver), I[b].semver !== o.ANY && I[b].semver.prerelease.length > 0) {
          const $ = I[b].semver;
          if ($.major === R.major && $.minor === R.minor && $.patch === R.patch)
            return !0;
        }
      return !1;
    }
    return !0;
  };
  return Fi;
}
var xi, vs;
function ri() {
  if (vs) return xi;
  vs = 1;
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
  xi = t;
  const r = Bo, { safeRe: n, t: i } = Vr, o = hu, a = ei, s = Ie, l = qe();
  return xi;
}
const DE = qe(), $E = (e, t, r) => {
  try {
    t = new DE(t, r);
  } catch {
    return !1;
  }
  return t.test(e);
};
var ni = $E;
const FE = qe(), xE = (e, t) => new FE(e, t).set.map((r) => r.map((n) => n.value).join(" ").trim().split(" "));
var LE = xE;
const UE = Ie, kE = qe(), ME = (e, t, r) => {
  let n = null, i = null, o = null;
  try {
    o = new kE(t, r);
  } catch {
    return null;
  }
  return e.forEach((a) => {
    o.test(a) && (!n || i.compare(a) === -1) && (n = a, i = new UE(n, r));
  }), n;
};
var BE = ME;
const jE = Ie, HE = qe(), qE = (e, t, r) => {
  let n = null, i = null, o = null;
  try {
    o = new HE(t, r);
  } catch {
    return null;
  }
  return e.forEach((a) => {
    o.test(a) && (!n || i.compare(a) === 1) && (n = a, i = new jE(n, r));
  }), n;
};
var GE = qE;
const Li = Ie, WE = qe(), ws = ti, VE = (e, t) => {
  e = new WE(e, t);
  let r = new Li("0.0.0");
  if (e.test(r) || (r = new Li("0.0.0-0"), e.test(r)))
    return r;
  r = null;
  for (let n = 0; n < e.set.length; ++n) {
    const i = e.set[n];
    let o = null;
    i.forEach((a) => {
      const s = new Li(a.semver.version);
      switch (a.operator) {
        case ">":
          s.prerelease.length === 0 ? s.patch++ : s.prerelease.push(0), s.raw = s.format();
        case "":
        case ">=":
          (!o || ws(s, o)) && (o = s);
          break;
        case "<":
        case "<=":
          break;
        default:
          throw new Error(`Unexpected operation: ${a.operator}`);
      }
    }), o && (!r || ws(r, o)) && (r = o);
  }
  return r && e.test(r) ? r : null;
};
var YE = VE;
const zE = qe(), XE = (e, t) => {
  try {
    return new zE(e, t).range || "*";
  } catch {
    return null;
  }
};
var KE = XE;
const JE = Ie, pu = ri(), { ANY: QE } = pu, ZE = qe(), ey = ni, _s = ti, As = Ho, ty = Go, ry = qo, ny = (e, t, r, n) => {
  e = new JE(e, n), t = new ZE(t, n);
  let i, o, a, s, l;
  switch (r) {
    case ">":
      i = _s, o = ty, a = As, s = ">", l = ">=";
      break;
    case "<":
      i = As, o = ry, a = _s, s = "<", l = "<=";
      break;
    default:
      throw new TypeError('Must provide a hilo val of "<" or ">"');
  }
  if (ey(e, t, n))
    return !1;
  for (let m = 0; m < t.set.length; ++m) {
    const c = t.set[m];
    let f = null, d = null;
    if (c.forEach((g) => {
      g.semver === QE && (g = new pu(">=0.0.0")), f = f || g, d = d || g, i(g.semver, f.semver, n) ? f = g : a(g.semver, d.semver, n) && (d = g);
    }), f.operator === s || f.operator === l || (!d.operator || d.operator === s) && o(e, d.semver))
      return !1;
    if (d.operator === l && a(e, d.semver))
      return !1;
  }
  return !0;
};
var Wo = ny;
const iy = Wo, oy = (e, t, r) => iy(e, t, ">", r);
var ay = oy;
const sy = Wo, ly = (e, t, r) => sy(e, t, "<", r);
var cy = ly;
const Ts = qe(), uy = (e, t, r) => (e = new Ts(e, r), t = new Ts(t, r), e.intersects(t, r));
var fy = uy;
const dy = ni, hy = He;
var py = (e, t, r) => {
  const n = [];
  let i = null, o = null;
  const a = e.sort((c, f) => hy(c, f, r));
  for (const c of a)
    dy(c, t, r) ? (o = c, i || (i = c)) : (o && n.push([i, o]), o = null, i = null);
  i && n.push([i, null]);
  const s = [];
  for (const [c, f] of n)
    c === f ? s.push(c) : !f && c === a[0] ? s.push("*") : f ? c === a[0] ? s.push(`<=${f}`) : s.push(`${c} - ${f}`) : s.push(`>=${c}`);
  const l = s.join(" || "), m = typeof t.raw == "string" ? t.raw : String(t);
  return l.length < m.length ? l : t;
};
const Ss = qe(), Vo = ri(), { ANY: Ui } = Vo, pr = ni, Yo = He, my = (e, t, r = {}) => {
  if (e === t)
    return !0;
  e = new Ss(e, r), t = new Ss(t, r);
  let n = !1;
  e: for (const i of e.set) {
    for (const o of t.set) {
      const a = Ey(i, o, r);
      if (n = n || a !== null, a)
        continue e;
    }
    if (n)
      return !1;
  }
  return !0;
}, gy = [new Vo(">=0.0.0-0")], Cs = [new Vo(">=0.0.0")], Ey = (e, t, r) => {
  if (e === t)
    return !0;
  if (e.length === 1 && e[0].semver === Ui) {
    if (t.length === 1 && t[0].semver === Ui)
      return !0;
    r.includePrerelease ? e = gy : e = Cs;
  }
  if (t.length === 1 && t[0].semver === Ui) {
    if (r.includePrerelease)
      return !0;
    t = Cs;
  }
  const n = /* @__PURE__ */ new Set();
  let i, o;
  for (const g of e)
    g.operator === ">" || g.operator === ">=" ? i = bs(i, g, r) : g.operator === "<" || g.operator === "<=" ? o = Rs(o, g, r) : n.add(g.semver);
  if (n.size > 1)
    return null;
  let a;
  if (i && o) {
    if (a = Yo(i.semver, o.semver, r), a > 0)
      return null;
    if (a === 0 && (i.operator !== ">=" || o.operator !== "<="))
      return null;
  }
  for (const g of n) {
    if (i && !pr(g, String(i), r) || o && !pr(g, String(o), r))
      return null;
    for (const v of t)
      if (!pr(g, String(v), r))
        return !1;
    return !0;
  }
  let s, l, m, c, f = o && !r.includePrerelease && o.semver.prerelease.length ? o.semver : !1, d = i && !r.includePrerelease && i.semver.prerelease.length ? i.semver : !1;
  f && f.prerelease.length === 1 && o.operator === "<" && f.prerelease[0] === 0 && (f = !1);
  for (const g of t) {
    if (c = c || g.operator === ">" || g.operator === ">=", m = m || g.operator === "<" || g.operator === "<=", i) {
      if (d && g.semver.prerelease && g.semver.prerelease.length && g.semver.major === d.major && g.semver.minor === d.minor && g.semver.patch === d.patch && (d = !1), g.operator === ">" || g.operator === ">=") {
        if (s = bs(i, g, r), s === g && s !== i)
          return !1;
      } else if (i.operator === ">=" && !pr(i.semver, String(g), r))
        return !1;
    }
    if (o) {
      if (f && g.semver.prerelease && g.semver.prerelease.length && g.semver.major === f.major && g.semver.minor === f.minor && g.semver.patch === f.patch && (f = !1), g.operator === "<" || g.operator === "<=") {
        if (l = Rs(o, g, r), l === g && l !== o)
          return !1;
      } else if (o.operator === "<=" && !pr(o.semver, String(g), r))
        return !1;
    }
    if (!g.operator && (o || i) && a !== 0)
      return !1;
  }
  return !(i && m && !o && a !== 0 || o && c && !i && a !== 0 || d || f);
}, bs = (e, t, r) => {
  if (!e)
    return t;
  const n = Yo(e.semver, t.semver, r);
  return n > 0 ? e : n < 0 || t.operator === ">" && e.operator === ">=" ? t : e;
}, Rs = (e, t, r) => {
  if (!e)
    return t;
  const n = Yo(e.semver, t.semver, r);
  return n < 0 ? e : n > 0 || t.operator === "<" && e.operator === "<=" ? t : e;
};
var yy = my;
const ki = Vr, Os = Zn, vy = Ie, Is = uu, wy = or, _y = R0, Ay = P0, Ty = D0, Sy = F0, Cy = U0, by = B0, Ry = q0, Oy = V0, Iy = He, Py = K0, Ny = Z0, Dy = jo, $y = nE, Fy = aE, xy = ti, Ly = Ho, Uy = fu, ky = du, My = qo, By = Go, jy = hu, Hy = IE, qy = ri(), Gy = qe(), Wy = ni, Vy = LE, Yy = BE, zy = GE, Xy = YE, Ky = KE, Jy = Wo, Qy = ay, Zy = cy, ev = fy, tv = py, rv = yy;
var mu = {
  parse: wy,
  valid: _y,
  clean: Ay,
  inc: Ty,
  diff: Sy,
  major: Cy,
  minor: by,
  patch: Ry,
  prerelease: Oy,
  compare: Iy,
  rcompare: Py,
  compareLoose: Ny,
  compareBuild: Dy,
  sort: $y,
  rsort: Fy,
  gt: xy,
  lt: Ly,
  eq: Uy,
  neq: ky,
  gte: My,
  lte: By,
  cmp: jy,
  coerce: Hy,
  Comparator: qy,
  Range: Gy,
  satisfies: Wy,
  toComparators: Vy,
  maxSatisfying: Yy,
  minSatisfying: zy,
  minVersion: Xy,
  validRange: Ky,
  outside: Jy,
  gtr: Qy,
  ltr: Zy,
  intersects: ev,
  simplifyRange: tv,
  subset: rv,
  SemVer: vy,
  re: ki.re,
  src: ki.src,
  tokens: ki.t,
  SEMVER_SPEC_VERSION: Os.SEMVER_SPEC_VERSION,
  RELEASE_TYPES: Os.RELEASE_TYPES,
  compareIdentifiers: Is.compareIdentifiers,
  rcompareIdentifiers: Is.rcompareIdentifiers
}, Yr = {}, jn = { exports: {} };
jn.exports;
(function(e, t) {
  var r = 200, n = "__lodash_hash_undefined__", i = 1, o = 2, a = 9007199254740991, s = "[object Arguments]", l = "[object Array]", m = "[object AsyncFunction]", c = "[object Boolean]", f = "[object Date]", d = "[object Error]", g = "[object Function]", v = "[object GeneratorFunction]", y = "[object Map]", A = "[object Number]", S = "[object Null]", T = "[object Object]", D = "[object Promise]", x = "[object Proxy]", Z = "[object RegExp]", oe = "[object Set]", V = "[object String]", De = "[object Symbol]", E = "[object Undefined]", q = "[object WeakMap]", B = "[object ArrayBuffer]", M = "[object DataView]", z = "[object Float32Array]", I = "[object Float64Array]", R = "[object Int8Array]", N = "[object Int16Array]", b = "[object Int32Array]", $ = "[object Uint8Array]", P = "[object Uint8ClampedArray]", k = "[object Uint16Array]", G = "[object Uint32Array]", j = /[\\^$.*+?()[\]{}|]/g, X = /^\[object .+?Constructor\]$/, ue = /^(?:0|[1-9]\d*)$/, U = {};
  U[z] = U[I] = U[R] = U[N] = U[b] = U[$] = U[P] = U[k] = U[G] = !0, U[s] = U[l] = U[B] = U[c] = U[M] = U[f] = U[d] = U[g] = U[y] = U[A] = U[T] = U[Z] = U[oe] = U[V] = U[q] = !1;
  var We = typeof Te == "object" && Te && Te.Object === Object && Te, h = typeof self == "object" && self && self.Object === Object && self, u = We || h || Function("return this")(), C = t && !t.nodeType && t, _ = C && !0 && e && !e.nodeType && e, Y = _ && _.exports === C, J = Y && We.process, ne = function() {
    try {
      return J && J.binding && J.binding("util");
    } catch {
    }
  }(), he = ne && ne.isTypedArray;
  function Ee(p, w) {
    for (var O = -1, F = p == null ? 0 : p.length, Q = 0, H = []; ++O < F; ) {
      var ie = p[O];
      w(ie, O, p) && (H[Q++] = ie);
    }
    return H;
  }
  function et(p, w) {
    for (var O = -1, F = w.length, Q = p.length; ++O < F; )
      p[Q + O] = w[O];
    return p;
  }
  function le(p, w) {
    for (var O = -1, F = p == null ? 0 : p.length; ++O < F; )
      if (w(p[O], O, p))
        return !0;
    return !1;
  }
  function Le(p, w) {
    for (var O = -1, F = Array(p); ++O < p; )
      F[O] = w(O);
    return F;
  }
  function hi(p) {
    return function(w) {
      return p(w);
    };
  }
  function Jr(p, w) {
    return p.has(w);
  }
  function lr(p, w) {
    return p == null ? void 0 : p[w];
  }
  function Qr(p) {
    var w = -1, O = Array(p.size);
    return p.forEach(function(F, Q) {
      O[++w] = [Q, F];
    }), O;
  }
  function Du(p, w) {
    return function(O) {
      return p(w(O));
    };
  }
  function $u(p) {
    var w = -1, O = Array(p.size);
    return p.forEach(function(F) {
      O[++w] = F;
    }), O;
  }
  var Fu = Array.prototype, xu = Function.prototype, Zr = Object.prototype, pi = u["__core-js_shared__"], ea = xu.toString, Ve = Zr.hasOwnProperty, ta = function() {
    var p = /[^.]+$/.exec(pi && pi.keys && pi.keys.IE_PROTO || "");
    return p ? "Symbol(src)_1." + p : "";
  }(), ra = Zr.toString, Lu = RegExp(
    "^" + ea.call(Ve).replace(j, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
  ), na = Y ? u.Buffer : void 0, en = u.Symbol, ia = u.Uint8Array, oa = Zr.propertyIsEnumerable, Uu = Fu.splice, wt = en ? en.toStringTag : void 0, aa = Object.getOwnPropertySymbols, ku = na ? na.isBuffer : void 0, Mu = Du(Object.keys, Object), mi = Mt(u, "DataView"), cr = Mt(u, "Map"), gi = Mt(u, "Promise"), Ei = Mt(u, "Set"), yi = Mt(u, "WeakMap"), ur = Mt(Object, "create"), Bu = Tt(mi), ju = Tt(cr), Hu = Tt(gi), qu = Tt(Ei), Gu = Tt(yi), sa = en ? en.prototype : void 0, vi = sa ? sa.valueOf : void 0;
  function _t(p) {
    var w = -1, O = p == null ? 0 : p.length;
    for (this.clear(); ++w < O; ) {
      var F = p[w];
      this.set(F[0], F[1]);
    }
  }
  function Wu() {
    this.__data__ = ur ? ur(null) : {}, this.size = 0;
  }
  function Vu(p) {
    var w = this.has(p) && delete this.__data__[p];
    return this.size -= w ? 1 : 0, w;
  }
  function Yu(p) {
    var w = this.__data__;
    if (ur) {
      var O = w[p];
      return O === n ? void 0 : O;
    }
    return Ve.call(w, p) ? w[p] : void 0;
  }
  function zu(p) {
    var w = this.__data__;
    return ur ? w[p] !== void 0 : Ve.call(w, p);
  }
  function Xu(p, w) {
    var O = this.__data__;
    return this.size += this.has(p) ? 0 : 1, O[p] = ur && w === void 0 ? n : w, this;
  }
  _t.prototype.clear = Wu, _t.prototype.delete = Vu, _t.prototype.get = Yu, _t.prototype.has = zu, _t.prototype.set = Xu;
  function Ke(p) {
    var w = -1, O = p == null ? 0 : p.length;
    for (this.clear(); ++w < O; ) {
      var F = p[w];
      this.set(F[0], F[1]);
    }
  }
  function Ku() {
    this.__data__ = [], this.size = 0;
  }
  function Ju(p) {
    var w = this.__data__, O = rn(w, p);
    if (O < 0)
      return !1;
    var F = w.length - 1;
    return O == F ? w.pop() : Uu.call(w, O, 1), --this.size, !0;
  }
  function Qu(p) {
    var w = this.__data__, O = rn(w, p);
    return O < 0 ? void 0 : w[O][1];
  }
  function Zu(p) {
    return rn(this.__data__, p) > -1;
  }
  function ef(p, w) {
    var O = this.__data__, F = rn(O, p);
    return F < 0 ? (++this.size, O.push([p, w])) : O[F][1] = w, this;
  }
  Ke.prototype.clear = Ku, Ke.prototype.delete = Ju, Ke.prototype.get = Qu, Ke.prototype.has = Zu, Ke.prototype.set = ef;
  function At(p) {
    var w = -1, O = p == null ? 0 : p.length;
    for (this.clear(); ++w < O; ) {
      var F = p[w];
      this.set(F[0], F[1]);
    }
  }
  function tf() {
    this.size = 0, this.__data__ = {
      hash: new _t(),
      map: new (cr || Ke)(),
      string: new _t()
    };
  }
  function rf(p) {
    var w = nn(this, p).delete(p);
    return this.size -= w ? 1 : 0, w;
  }
  function nf(p) {
    return nn(this, p).get(p);
  }
  function of(p) {
    return nn(this, p).has(p);
  }
  function af(p, w) {
    var O = nn(this, p), F = O.size;
    return O.set(p, w), this.size += O.size == F ? 0 : 1, this;
  }
  At.prototype.clear = tf, At.prototype.delete = rf, At.prototype.get = nf, At.prototype.has = of, At.prototype.set = af;
  function tn(p) {
    var w = -1, O = p == null ? 0 : p.length;
    for (this.__data__ = new At(); ++w < O; )
      this.add(p[w]);
  }
  function sf(p) {
    return this.__data__.set(p, n), this;
  }
  function lf(p) {
    return this.__data__.has(p);
  }
  tn.prototype.add = tn.prototype.push = sf, tn.prototype.has = lf;
  function tt(p) {
    var w = this.__data__ = new Ke(p);
    this.size = w.size;
  }
  function cf() {
    this.__data__ = new Ke(), this.size = 0;
  }
  function uf(p) {
    var w = this.__data__, O = w.delete(p);
    return this.size = w.size, O;
  }
  function ff(p) {
    return this.__data__.get(p);
  }
  function df(p) {
    return this.__data__.has(p);
  }
  function hf(p, w) {
    var O = this.__data__;
    if (O instanceof Ke) {
      var F = O.__data__;
      if (!cr || F.length < r - 1)
        return F.push([p, w]), this.size = ++O.size, this;
      O = this.__data__ = new At(F);
    }
    return O.set(p, w), this.size = O.size, this;
  }
  tt.prototype.clear = cf, tt.prototype.delete = uf, tt.prototype.get = ff, tt.prototype.has = df, tt.prototype.set = hf;
  function pf(p, w) {
    var O = on(p), F = !O && If(p), Q = !O && !F && wi(p), H = !O && !F && !Q && ga(p), ie = O || F || Q || H, fe = ie ? Le(p.length, String) : [], pe = fe.length;
    for (var ee in p)
      Ve.call(p, ee) && !(ie && // Safari 9 has enumerable `arguments.length` in strict mode.
      (ee == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
      Q && (ee == "offset" || ee == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
      H && (ee == "buffer" || ee == "byteLength" || ee == "byteOffset") || // Skip index properties.
      Sf(ee, pe))) && fe.push(ee);
    return fe;
  }
  function rn(p, w) {
    for (var O = p.length; O--; )
      if (da(p[O][0], w))
        return O;
    return -1;
  }
  function mf(p, w, O) {
    var F = w(p);
    return on(p) ? F : et(F, O(p));
  }
  function fr(p) {
    return p == null ? p === void 0 ? E : S : wt && wt in Object(p) ? Af(p) : Of(p);
  }
  function la(p) {
    return dr(p) && fr(p) == s;
  }
  function ca(p, w, O, F, Q) {
    return p === w ? !0 : p == null || w == null || !dr(p) && !dr(w) ? p !== p && w !== w : gf(p, w, O, F, ca, Q);
  }
  function gf(p, w, O, F, Q, H) {
    var ie = on(p), fe = on(w), pe = ie ? l : rt(p), ee = fe ? l : rt(w);
    pe = pe == s ? T : pe, ee = ee == s ? T : ee;
    var $e = pe == T, Ue = ee == T, ye = pe == ee;
    if (ye && wi(p)) {
      if (!wi(w))
        return !1;
      ie = !0, $e = !1;
    }
    if (ye && !$e)
      return H || (H = new tt()), ie || ga(p) ? ua(p, w, O, F, Q, H) : wf(p, w, pe, O, F, Q, H);
    if (!(O & i)) {
      var Fe = $e && Ve.call(p, "__wrapped__"), xe = Ue && Ve.call(w, "__wrapped__");
      if (Fe || xe) {
        var nt = Fe ? p.value() : p, Je = xe ? w.value() : w;
        return H || (H = new tt()), Q(nt, Je, O, F, H);
      }
    }
    return ye ? (H || (H = new tt()), _f(p, w, O, F, Q, H)) : !1;
  }
  function Ef(p) {
    if (!ma(p) || bf(p))
      return !1;
    var w = ha(p) ? Lu : X;
    return w.test(Tt(p));
  }
  function yf(p) {
    return dr(p) && pa(p.length) && !!U[fr(p)];
  }
  function vf(p) {
    if (!Rf(p))
      return Mu(p);
    var w = [];
    for (var O in Object(p))
      Ve.call(p, O) && O != "constructor" && w.push(O);
    return w;
  }
  function ua(p, w, O, F, Q, H) {
    var ie = O & i, fe = p.length, pe = w.length;
    if (fe != pe && !(ie && pe > fe))
      return !1;
    var ee = H.get(p);
    if (ee && H.get(w))
      return ee == w;
    var $e = -1, Ue = !0, ye = O & o ? new tn() : void 0;
    for (H.set(p, w), H.set(w, p); ++$e < fe; ) {
      var Fe = p[$e], xe = w[$e];
      if (F)
        var nt = ie ? F(xe, Fe, $e, w, p, H) : F(Fe, xe, $e, p, w, H);
      if (nt !== void 0) {
        if (nt)
          continue;
        Ue = !1;
        break;
      }
      if (ye) {
        if (!le(w, function(Je, St) {
          if (!Jr(ye, St) && (Fe === Je || Q(Fe, Je, O, F, H)))
            return ye.push(St);
        })) {
          Ue = !1;
          break;
        }
      } else if (!(Fe === xe || Q(Fe, xe, O, F, H))) {
        Ue = !1;
        break;
      }
    }
    return H.delete(p), H.delete(w), Ue;
  }
  function wf(p, w, O, F, Q, H, ie) {
    switch (O) {
      case M:
        if (p.byteLength != w.byteLength || p.byteOffset != w.byteOffset)
          return !1;
        p = p.buffer, w = w.buffer;
      case B:
        return !(p.byteLength != w.byteLength || !H(new ia(p), new ia(w)));
      case c:
      case f:
      case A:
        return da(+p, +w);
      case d:
        return p.name == w.name && p.message == w.message;
      case Z:
      case V:
        return p == w + "";
      case y:
        var fe = Qr;
      case oe:
        var pe = F & i;
        if (fe || (fe = $u), p.size != w.size && !pe)
          return !1;
        var ee = ie.get(p);
        if (ee)
          return ee == w;
        F |= o, ie.set(p, w);
        var $e = ua(fe(p), fe(w), F, Q, H, ie);
        return ie.delete(p), $e;
      case De:
        if (vi)
          return vi.call(p) == vi.call(w);
    }
    return !1;
  }
  function _f(p, w, O, F, Q, H) {
    var ie = O & i, fe = fa(p), pe = fe.length, ee = fa(w), $e = ee.length;
    if (pe != $e && !ie)
      return !1;
    for (var Ue = pe; Ue--; ) {
      var ye = fe[Ue];
      if (!(ie ? ye in w : Ve.call(w, ye)))
        return !1;
    }
    var Fe = H.get(p);
    if (Fe && H.get(w))
      return Fe == w;
    var xe = !0;
    H.set(p, w), H.set(w, p);
    for (var nt = ie; ++Ue < pe; ) {
      ye = fe[Ue];
      var Je = p[ye], St = w[ye];
      if (F)
        var Ea = ie ? F(St, Je, ye, w, p, H) : F(Je, St, ye, p, w, H);
      if (!(Ea === void 0 ? Je === St || Q(Je, St, O, F, H) : Ea)) {
        xe = !1;
        break;
      }
      nt || (nt = ye == "constructor");
    }
    if (xe && !nt) {
      var an = p.constructor, sn = w.constructor;
      an != sn && "constructor" in p && "constructor" in w && !(typeof an == "function" && an instanceof an && typeof sn == "function" && sn instanceof sn) && (xe = !1);
    }
    return H.delete(p), H.delete(w), xe;
  }
  function fa(p) {
    return mf(p, Df, Tf);
  }
  function nn(p, w) {
    var O = p.__data__;
    return Cf(w) ? O[typeof w == "string" ? "string" : "hash"] : O.map;
  }
  function Mt(p, w) {
    var O = lr(p, w);
    return Ef(O) ? O : void 0;
  }
  function Af(p) {
    var w = Ve.call(p, wt), O = p[wt];
    try {
      p[wt] = void 0;
      var F = !0;
    } catch {
    }
    var Q = ra.call(p);
    return F && (w ? p[wt] = O : delete p[wt]), Q;
  }
  var Tf = aa ? function(p) {
    return p == null ? [] : (p = Object(p), Ee(aa(p), function(w) {
      return oa.call(p, w);
    }));
  } : $f, rt = fr;
  (mi && rt(new mi(new ArrayBuffer(1))) != M || cr && rt(new cr()) != y || gi && rt(gi.resolve()) != D || Ei && rt(new Ei()) != oe || yi && rt(new yi()) != q) && (rt = function(p) {
    var w = fr(p), O = w == T ? p.constructor : void 0, F = O ? Tt(O) : "";
    if (F)
      switch (F) {
        case Bu:
          return M;
        case ju:
          return y;
        case Hu:
          return D;
        case qu:
          return oe;
        case Gu:
          return q;
      }
    return w;
  });
  function Sf(p, w) {
    return w = w ?? a, !!w && (typeof p == "number" || ue.test(p)) && p > -1 && p % 1 == 0 && p < w;
  }
  function Cf(p) {
    var w = typeof p;
    return w == "string" || w == "number" || w == "symbol" || w == "boolean" ? p !== "__proto__" : p === null;
  }
  function bf(p) {
    return !!ta && ta in p;
  }
  function Rf(p) {
    var w = p && p.constructor, O = typeof w == "function" && w.prototype || Zr;
    return p === O;
  }
  function Of(p) {
    return ra.call(p);
  }
  function Tt(p) {
    if (p != null) {
      try {
        return ea.call(p);
      } catch {
      }
      try {
        return p + "";
      } catch {
      }
    }
    return "";
  }
  function da(p, w) {
    return p === w || p !== p && w !== w;
  }
  var If = la(/* @__PURE__ */ function() {
    return arguments;
  }()) ? la : function(p) {
    return dr(p) && Ve.call(p, "callee") && !oa.call(p, "callee");
  }, on = Array.isArray;
  function Pf(p) {
    return p != null && pa(p.length) && !ha(p);
  }
  var wi = ku || Ff;
  function Nf(p, w) {
    return ca(p, w);
  }
  function ha(p) {
    if (!ma(p))
      return !1;
    var w = fr(p);
    return w == g || w == v || w == m || w == x;
  }
  function pa(p) {
    return typeof p == "number" && p > -1 && p % 1 == 0 && p <= a;
  }
  function ma(p) {
    var w = typeof p;
    return p != null && (w == "object" || w == "function");
  }
  function dr(p) {
    return p != null && typeof p == "object";
  }
  var ga = he ? hi(he) : yf;
  function Df(p) {
    return Pf(p) ? pf(p) : vf(p);
  }
  function $f() {
    return [];
  }
  function Ff() {
    return !1;
  }
  e.exports = Nf;
})(jn, jn.exports);
var nv = jn.exports;
Object.defineProperty(Yr, "__esModule", { value: !0 });
Yr.DownloadedUpdateHelper = void 0;
Yr.createTempUpdateFile = lv;
const iv = Mr, ov = gt, Ps = nv, bt = yt, Ar = re;
class av {
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
    return Ar.join(this.cacheDir, "pending");
  }
  async validateDownloadedPath(t, r, n, i) {
    if (this.versionInfo != null && this.file === t && this.fileInfo != null)
      return Ps(this.versionInfo, r) && Ps(this.fileInfo.info, n.info) && await (0, bt.pathExists)(t) ? t : null;
    const o = await this.getValidCachedUpdateFile(n, i);
    return o === null ? null : (i.info(`Update has already been downloaded to ${t}).`), this._file = o, o);
  }
  async setDownloadedFile(t, r, n, i, o, a) {
    this._file = t, this._packageFile = r, this.versionInfo = n, this.fileInfo = i, this._downloadedFileInfo = {
      fileName: o,
      sha512: i.info.sha512,
      isAdminRightsRequired: i.info.isAdminRightsRequired === !0
    }, a && await (0, bt.outputJson)(this.getUpdateInfoFile(), this._downloadedFileInfo);
  }
  async clear() {
    this._file = null, this._packageFile = null, this.versionInfo = null, this.fileInfo = null, await this.cleanCacheDirForPendingUpdate();
  }
  async cleanCacheDirForPendingUpdate() {
    try {
      await (0, bt.emptyDir)(this.cacheDirForPendingUpdate);
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
    if (!await (0, bt.pathExists)(n))
      return null;
    let o;
    try {
      o = await (0, bt.readJson)(n);
    } catch (m) {
      let c = "No cached update info available";
      return m.code !== "ENOENT" && (await this.cleanCacheDirForPendingUpdate(), c += ` (error on read: ${m.message})`), r.info(c), null;
    }
    if (!((o == null ? void 0 : o.fileName) !== null))
      return r.warn("Cached update info is corrupted: no fileName, directory for cached update will be cleaned"), await this.cleanCacheDirForPendingUpdate(), null;
    if (t.info.sha512 !== o.sha512)
      return r.info(`Cached update sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${o.sha512}, expected: ${t.info.sha512}. Directory for cached update will be cleaned`), await this.cleanCacheDirForPendingUpdate(), null;
    const s = Ar.join(this.cacheDirForPendingUpdate, o.fileName);
    if (!await (0, bt.pathExists)(s))
      return r.info("Cached update file doesn't exist"), null;
    const l = await sv(s);
    return t.info.sha512 !== l ? (r.warn(`Sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${l}, expected: ${t.info.sha512}`), await this.cleanCacheDirForPendingUpdate(), null) : (this._downloadedFileInfo = o, s);
  }
  getUpdateInfoFile() {
    return Ar.join(this.cacheDirForPendingUpdate, "update-info.json");
  }
}
Yr.DownloadedUpdateHelper = av;
function sv(e, t = "sha512", r = "base64", n) {
  return new Promise((i, o) => {
    const a = (0, iv.createHash)(t);
    a.on("error", o).setEncoding(r), (0, ov.createReadStream)(e, {
      ...n,
      highWaterMark: 1024 * 1024
      /* better to use more memory but hash faster */
    }).on("error", o).on("end", () => {
      a.end(), i(a.read());
    }).pipe(a, { end: !1 });
  });
}
async function lv(e, t, r) {
  let n = 0, i = Ar.join(t, e);
  for (let o = 0; o < 3; o++)
    try {
      return await (0, bt.unlink)(i), i;
    } catch (a) {
      if (a.code === "ENOENT")
        return i;
      r.warn(`Error on remove temp update file: ${a}`), i = Ar.join(t, `${n++}-${e}`);
    }
  return i;
}
var ii = {}, zo = {};
Object.defineProperty(zo, "__esModule", { value: !0 });
zo.getAppCacheDir = uv;
const Mi = re, cv = Gn;
function uv() {
  const e = (0, cv.homedir)();
  let t;
  return process.platform === "win32" ? t = process.env.LOCALAPPDATA || Mi.join(e, "AppData", "Local") : process.platform === "darwin" ? t = Mi.join(e, "Library", "Caches") : t = process.env.XDG_CACHE_HOME || Mi.join(e, ".cache"), t;
}
Object.defineProperty(ii, "__esModule", { value: !0 });
ii.ElectronAppAdapter = void 0;
const Ns = re, fv = zo;
class dv {
  constructor(t = $t.app) {
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
    return this.isPackaged ? Ns.join(process.resourcesPath, "app-update.yml") : Ns.join(this.app.getAppPath(), "dev-app-update.yml");
  }
  get userDataPath() {
    return this.app.getPath("userData");
  }
  get baseCachePath() {
    return (0, fv.getAppCacheDir)();
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
ii.ElectronAppAdapter = dv;
var gu = {};
(function(e) {
  Object.defineProperty(e, "__esModule", { value: !0 }), e.ElectronHttpExecutor = e.NET_SESSION_NAME = void 0, e.getNetSession = r;
  const t = ce;
  e.NET_SESSION_NAME = "electron-updater";
  function r() {
    return $t.session.fromPartition(e.NET_SESSION_NAME, {
      cache: !1
    });
  }
  class n extends t.HttpExecutor {
    constructor(o) {
      super(), this.proxyLoginCallback = o, this.cachedSession = null;
    }
    async download(o, a, s) {
      return await s.cancellationToken.createPromise((l, m, c) => {
        const f = {
          headers: s.headers || void 0,
          redirect: "manual"
        };
        (0, t.configureRequestUrl)(o, f), (0, t.configureRequestOptions)(f), this.doDownload(f, {
          destination: a,
          options: s,
          onCancel: c,
          callback: (d) => {
            d == null ? l(a) : m(d);
          },
          responseHandler: null
        }, 0);
      });
    }
    createRequest(o, a) {
      o.headers && o.headers.Host && (o.host = o.headers.Host, delete o.headers.Host), this.cachedSession == null && (this.cachedSession = r());
      const s = $t.net.request({
        ...o,
        session: this.cachedSession
      });
      return s.on("response", a), this.proxyLoginCallback != null && s.on("login", this.proxyLoginCallback), s;
    }
    addRedirectHandlers(o, a, s, l, m) {
      o.on("redirect", (c, f, d) => {
        o.abort(), l > this.maxRedirects ? s(this.createMaxRedirectError()) : m(t.HttpExecutor.prepareRedirectUrlOptions(d, a));
      });
    }
  }
  e.ElectronHttpExecutor = n;
})(gu);
var zr = {}, Ge = {};
Object.defineProperty(Ge, "__esModule", { value: !0 });
Ge.newBaseUrl = hv;
Ge.newUrlFromBase = pv;
Ge.getChannelFilename = mv;
const Eu = Et;
function hv(e) {
  const t = new Eu.URL(e);
  return t.pathname.endsWith("/") || (t.pathname += "/"), t;
}
function pv(e, t, r = !1) {
  const n = new Eu.URL(e, t), i = t.search;
  return i != null && i.length !== 0 ? n.search = i : r && (n.search = `noCache=${Date.now().toString(32)}`), n;
}
function mv(e) {
  return `${e}.yml`;
}
var se = {}, gv = "[object Symbol]", yu = /[\\^$.*+?()[\]{}|]/g, Ev = RegExp(yu.source), yv = typeof Te == "object" && Te && Te.Object === Object && Te, vv = typeof self == "object" && self && self.Object === Object && self, wv = yv || vv || Function("return this")(), _v = Object.prototype, Av = _v.toString, Ds = wv.Symbol, $s = Ds ? Ds.prototype : void 0, Fs = $s ? $s.toString : void 0;
function Tv(e) {
  if (typeof e == "string")
    return e;
  if (Cv(e))
    return Fs ? Fs.call(e) : "";
  var t = e + "";
  return t == "0" && 1 / e == -1 / 0 ? "-0" : t;
}
function Sv(e) {
  return !!e && typeof e == "object";
}
function Cv(e) {
  return typeof e == "symbol" || Sv(e) && Av.call(e) == gv;
}
function bv(e) {
  return e == null ? "" : Tv(e);
}
function Rv(e) {
  return e = bv(e), e && Ev.test(e) ? e.replace(yu, "\\$&") : e;
}
var vu = Rv;
Object.defineProperty(se, "__esModule", { value: !0 });
se.Provider = void 0;
se.findFile = Dv;
se.parseUpdateInfo = $v;
se.getFileList = wu;
se.resolveFiles = Fv;
const pt = ce, Ov = ge, Iv = Et, Hn = Ge, Pv = vu;
class Nv {
  constructor(t) {
    this.runtimeOptions = t, this.requestHeaders = null, this.executor = t.executor;
  }
  // By default, the blockmap file is in the same directory as the main file
  // But some providers may have a different blockmap file, so we need to override this method
  getBlockMapFiles(t, r, n, i = null) {
    const o = (0, Hn.newUrlFromBase)(`${t.pathname}.blockmap`, t);
    return [(0, Hn.newUrlFromBase)(`${t.pathname.replace(new RegExp(Pv(n), "g"), r)}.blockmap`, i ? new Iv.URL(i) : t), o];
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
    return this.requestHeaders == null ? r != null && (n.headers = r) : n.headers = r == null ? this.requestHeaders : { ...this.requestHeaders, ...r }, (0, pt.configureRequestUrl)(t, n), n;
  }
}
se.Provider = Nv;
function Dv(e, t, r) {
  var n;
  if (e.length === 0)
    throw (0, pt.newError)("No files provided", "ERR_UPDATER_NO_FILES_PROVIDED");
  const i = e.filter((a) => a.url.pathname.toLowerCase().endsWith(`.${t.toLowerCase()}`)), o = (n = i.find((a) => [a.url.pathname, a.info.url].some((s) => s.includes(process.arch)))) !== null && n !== void 0 ? n : i.shift();
  return o || (r == null ? e[0] : e.find((a) => !r.some((s) => a.url.pathname.toLowerCase().endsWith(`.${s.toLowerCase()}`))));
}
function $v(e, t, r) {
  if (e == null)
    throw (0, pt.newError)(`Cannot parse update info from ${t} in the latest release artifacts (${r}): rawData: null`, "ERR_UPDATER_INVALID_UPDATE_INFO");
  let n;
  try {
    n = (0, Ov.load)(e);
  } catch (i) {
    throw (0, pt.newError)(`Cannot parse update info from ${t} in the latest release artifacts (${r}): ${i.stack || i.message}, rawData: ${e}`, "ERR_UPDATER_INVALID_UPDATE_INFO");
  }
  return n;
}
function wu(e) {
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
  throw (0, pt.newError)(`No files provided: ${(0, pt.safeStringifyJson)(e)}`, "ERR_UPDATER_NO_FILES_PROVIDED");
}
function Fv(e, t, r = (n) => n) {
  const i = wu(e).map((s) => {
    if (s.sha2 == null && s.sha512 == null)
      throw (0, pt.newError)(`Update info doesn't contain nor sha256 neither sha512 checksum: ${(0, pt.safeStringifyJson)(s)}`, "ERR_UPDATER_NO_CHECKSUM");
    return {
      url: (0, Hn.newUrlFromBase)(r(s.url), t),
      info: s
    };
  }), o = e.packages, a = o == null ? null : o[process.arch] || o.ia32;
  return a != null && (i[0].packageInfo = {
    ...a,
    path: (0, Hn.newUrlFromBase)(r(a.path), t).href
  }), i;
}
Object.defineProperty(zr, "__esModule", { value: !0 });
zr.GenericProvider = void 0;
const xs = ce, Bi = Ge, ji = se;
class xv extends ji.Provider {
  constructor(t, r, n) {
    super(n), this.configuration = t, this.updater = r, this.baseUrl = (0, Bi.newBaseUrl)(this.configuration.url);
  }
  get channel() {
    const t = this.updater.channel || this.configuration.channel;
    return t == null ? this.getDefaultChannelName() : this.getCustomChannelName(t);
  }
  async getLatestVersion() {
    const t = (0, Bi.getChannelFilename)(this.channel), r = (0, Bi.newUrlFromBase)(t, this.baseUrl, this.updater.isAddNoCacheQuery);
    for (let n = 0; ; n++)
      try {
        return (0, ji.parseUpdateInfo)(await this.httpRequest(r), t, r);
      } catch (i) {
        if (i instanceof xs.HttpError && i.statusCode === 404)
          throw (0, xs.newError)(`Cannot find channel "${t}" update info: ${i.stack || i.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
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
    return (0, ji.resolveFiles)(t, this.baseUrl);
  }
}
zr.GenericProvider = xv;
var oi = {}, ai = {};
Object.defineProperty(ai, "__esModule", { value: !0 });
ai.BitbucketProvider = void 0;
const Ls = ce, Hi = Ge, qi = se;
class Lv extends qi.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      isUseMultipleRangeRequest: !1
    }), this.configuration = t, this.updater = r;
    const { owner: i, slug: o } = t;
    this.baseUrl = (0, Hi.newBaseUrl)(`https://api.bitbucket.org/2.0/repositories/${i}/${o}/downloads`);
  }
  get channel() {
    return this.updater.channel || this.configuration.channel || "latest";
  }
  async getLatestVersion() {
    const t = new Ls.CancellationToken(), r = (0, Hi.getChannelFilename)(this.getCustomChannelName(this.channel)), n = (0, Hi.newUrlFromBase)(r, this.baseUrl, this.updater.isAddNoCacheQuery);
    try {
      const i = await this.httpRequest(n, void 0, t);
      return (0, qi.parseUpdateInfo)(i, r, n);
    } catch (i) {
      throw (0, Ls.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${i.stack || i.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  resolveFiles(t) {
    return (0, qi.resolveFiles)(t, this.baseUrl);
  }
  toString() {
    const { owner: t, slug: r } = this.configuration;
    return `Bitbucket (owner: ${t}, slug: ${r}, channel: ${this.channel})`;
  }
}
ai.BitbucketProvider = Lv;
var mt = {};
Object.defineProperty(mt, "__esModule", { value: !0 });
mt.GitHubProvider = mt.BaseGitHubProvider = void 0;
mt.computeReleaseNotes = Au;
const Qe = ce, It = mu, Uv = Et, Xt = Ge, mo = se, Gi = /\/tag\/([^/]+)$/;
class _u extends mo.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      /* because GitHib uses S3 */
      isUseMultipleRangeRequest: !1
    }), this.options = t, this.baseUrl = (0, Xt.newBaseUrl)((0, Qe.githubUrl)(t, r));
    const i = r === "github.com" ? "api.github.com" : r;
    this.baseApiUrl = (0, Xt.newBaseUrl)((0, Qe.githubUrl)(t, i));
  }
  computeGithubBasePath(t) {
    const r = this.options.host;
    return r && !["github.com", "api.github.com"].includes(r) ? `/api/v3${t}` : t;
  }
}
mt.BaseGitHubProvider = _u;
class kv extends _u {
  constructor(t, r, n) {
    super(t, "github.com", n), this.options = t, this.updater = r;
  }
  get channel() {
    const t = this.updater.channel || this.options.channel;
    return t == null ? this.getDefaultChannelName() : this.getCustomChannelName(t);
  }
  async getLatestVersion() {
    var t, r, n, i, o;
    const a = new Qe.CancellationToken(), s = await this.httpRequest((0, Xt.newUrlFromBase)(`${this.basePath}.atom`, this.baseUrl), {
      accept: "application/xml, application/atom+xml, text/xml, */*"
    }, a), l = (0, Qe.parseXml)(s);
    let m = l.element("entry", !1, "No published versions on GitHub"), c = null;
    try {
      if (this.updater.allowPrerelease) {
        const A = ((t = this.updater) === null || t === void 0 ? void 0 : t.channel) || ((r = It.prerelease(this.updater.currentVersion)) === null || r === void 0 ? void 0 : r[0]) || null;
        if (A === null)
          c = Gi.exec(m.element("link").attribute("href"))[1];
        else
          for (const S of l.getElements("entry")) {
            const T = Gi.exec(S.element("link").attribute("href"));
            if (T === null)
              continue;
            const D = T[1], x = ((n = It.prerelease(D)) === null || n === void 0 ? void 0 : n[0]) || null, Z = !A || ["alpha", "beta"].includes(A), oe = x !== null && !["alpha", "beta"].includes(String(x));
            if (Z && !oe && !(A === "beta" && x === "alpha")) {
              c = D;
              break;
            }
            if (x && x === A) {
              c = D;
              break;
            }
          }
      } else {
        c = await this.getLatestTagName(a);
        for (const A of l.getElements("entry"))
          if (Gi.exec(A.element("link").attribute("href"))[1] === c) {
            m = A;
            break;
          }
      }
    } catch (A) {
      throw (0, Qe.newError)(`Cannot parse releases feed: ${A.stack || A.message},
XML:
${s}`, "ERR_UPDATER_INVALID_RELEASE_FEED");
    }
    if (c == null)
      throw (0, Qe.newError)("No published versions on GitHub", "ERR_UPDATER_NO_PUBLISHED_VERSIONS");
    let f, d = "", g = "";
    const v = async (A) => {
      d = (0, Xt.getChannelFilename)(A), g = (0, Xt.newUrlFromBase)(this.getBaseDownloadPath(String(c), d), this.baseUrl);
      const S = this.createRequestOptions(g);
      try {
        return await this.executor.request(S, a);
      } catch (T) {
        throw T instanceof Qe.HttpError && T.statusCode === 404 ? (0, Qe.newError)(`Cannot find ${d} in the latest release artifacts (${g}): ${T.stack || T.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : T;
      }
    };
    try {
      let A = this.channel;
      this.updater.allowPrerelease && (!((i = It.prerelease(c)) === null || i === void 0) && i[0]) && (A = this.getCustomChannelName(String((o = It.prerelease(c)) === null || o === void 0 ? void 0 : o[0]))), f = await v(A);
    } catch (A) {
      if (this.updater.allowPrerelease)
        f = await v(this.getDefaultChannelName());
      else
        throw A;
    }
    const y = (0, mo.parseUpdateInfo)(f, d, g);
    return y.releaseName == null && (y.releaseName = m.elementValueOrEmpty("title")), y.releaseNotes == null && (y.releaseNotes = Au(this.updater.currentVersion, this.updater.fullChangelog, l, m)), {
      tag: c,
      ...y
    };
  }
  async getLatestTagName(t) {
    const r = this.options, n = r.host == null || r.host === "github.com" ? (0, Xt.newUrlFromBase)(`${this.basePath}/latest`, this.baseUrl) : new Uv.URL(`${this.computeGithubBasePath(`/repos/${r.owner}/${r.repo}/releases`)}/latest`, this.baseApiUrl);
    try {
      const i = await this.httpRequest(n, { Accept: "application/json" }, t);
      return i == null ? null : JSON.parse(i).tag_name;
    } catch (i) {
      throw (0, Qe.newError)(`Unable to find latest version on GitHub (${n}), please ensure a production release exists: ${i.stack || i.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  get basePath() {
    return `/${this.options.owner}/${this.options.repo}/releases`;
  }
  resolveFiles(t) {
    return (0, mo.resolveFiles)(t, this.baseUrl, (r) => this.getBaseDownloadPath(t.tag, r.replace(/ /g, "-")));
  }
  getBaseDownloadPath(t, r) {
    return `${this.basePath}/download/${t}/${r}`;
  }
}
mt.GitHubProvider = kv;
function Us(e) {
  const t = e.elementValueOrEmpty("content");
  return t === "No content." ? "" : t;
}
function Au(e, t, r, n) {
  if (!t)
    return Us(n);
  const i = [];
  for (const o of r.getElements("entry")) {
    const a = /\/tag\/v?([^/]+)$/.exec(o.element("link").attribute("href"))[1];
    It.valid(a) && It.lt(e, a) && i.push({
      version: a,
      note: Us(o)
    });
  }
  return i.sort((o, a) => It.rcompare(o.version, a.version));
}
var si = {};
Object.defineProperty(si, "__esModule", { value: !0 });
si.GitLabProvider = void 0;
const _e = ce, Wi = Et, Mv = vu, wn = Ge, Vi = se;
class Bv extends Vi.Provider {
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
    this.baseApiUrl = (0, wn.newBaseUrl)(`https://${o}/api/v4`);
  }
  get channel() {
    const t = this.updater.channel || this.options.channel;
    return t == null ? this.getDefaultChannelName() : this.getCustomChannelName(t);
  }
  async getLatestVersion() {
    const t = new _e.CancellationToken(), r = (0, wn.newUrlFromBase)(`projects/${this.options.projectId}/releases/permalink/latest`, this.baseApiUrl);
    let n;
    try {
      const d = { "Content-Type": "application/json", ...this.setAuthHeaderForToken(this.options.token || null) }, g = await this.httpRequest(r, d, t);
      if (!g)
        throw (0, _e.newError)("No latest release found", "ERR_UPDATER_NO_PUBLISHED_VERSIONS");
      n = JSON.parse(g);
    } catch (d) {
      throw (0, _e.newError)(`Unable to find latest release on GitLab (${r}): ${d.stack || d.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
    const i = n.tag_name;
    let o = null, a = "", s = null;
    const l = async (d) => {
      a = (0, wn.getChannelFilename)(d);
      const g = n.assets.links.find((y) => y.name === a);
      if (!g)
        throw (0, _e.newError)(`Cannot find ${a} in the latest release assets`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
      s = new Wi.URL(g.direct_asset_url);
      const v = this.options.token ? { "PRIVATE-TOKEN": this.options.token } : void 0;
      try {
        const y = await this.httpRequest(s, v, t);
        if (!y)
          throw (0, _e.newError)(`Empty response from ${s}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
        return y;
      } catch (y) {
        throw y instanceof _e.HttpError && y.statusCode === 404 ? (0, _e.newError)(`Cannot find ${a} in the latest release artifacts (${s}): ${y.stack || y.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : y;
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
      throw (0, _e.newError)(`Unable to parse channel data from ${a}`, "ERR_UPDATER_INVALID_UPDATE_INFO");
    const m = (0, Vi.parseUpdateInfo)(o, a, s);
    m.releaseName == null && (m.releaseName = n.name), m.releaseNotes == null && (m.releaseNotes = n.description || null);
    const c = /* @__PURE__ */ new Map();
    for (const d of n.assets.links)
      c.set(this.normalizeFilename(d.name), d.direct_asset_url);
    const f = {
      tag: i,
      assets: c,
      ...m
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
        return new Wi.URL(o);
    }
    return null;
  }
  async fetchReleaseInfoByVersion(t) {
    const r = new _e.CancellationToken(), n = [`v${t}`, t];
    for (const i of n) {
      const o = (0, wn.newUrlFromBase)(`projects/${this.options.projectId}/releases/${encodeURIComponent(i)}`, this.baseApiUrl);
      try {
        const a = { "Content-Type": "application/json", ...this.setAuthHeaderForToken(this.options.token || null) }, s = await this.httpRequest(o, a, r);
        if (s)
          return JSON.parse(s);
      } catch (a) {
        if (a instanceof _e.HttpError && a.statusCode === 404)
          continue;
        throw (0, _e.newError)(`Unable to find release ${i} on GitLab (${o}): ${a.stack || a.message}`, "ERR_UPDATER_RELEASE_NOT_FOUND");
      }
    }
    throw (0, _e.newError)(`Unable to find release with version ${t} (tried: ${n.join(", ")}) on GitLab`, "ERR_UPDATER_RELEASE_NOT_FOUND");
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
      const l = n.replace(new RegExp(Mv(r), "g"), t);
      o = this.findBlockMapInAssets(s, l);
    }
    return [o, i];
  }
  async getBlockMapFiles(t, r, n, i = null) {
    if (this.options.uploadTarget === "project_upload") {
      const o = t.pathname.split("/").pop() || "", [a, s] = await this.findBlockMapUrlsFromAssets(r, n, o);
      if (!s)
        throw (0, _e.newError)(`Cannot find blockmap file for ${n} in GitLab assets`, "ERR_UPDATER_BLOCKMAP_FILE_NOT_FOUND");
      if (!a)
        throw (0, _e.newError)(`Cannot find blockmap file for ${r} in GitLab assets`, "ERR_UPDATER_BLOCKMAP_FILE_NOT_FOUND");
      return [a, s];
    } else
      return super.getBlockMapFiles(t, r, n, i);
  }
  resolveFiles(t) {
    return (0, Vi.getFileList)(t).map((r) => {
      const i = [
        r.url,
        // Original filename
        this.normalizeFilename(r.url)
        // Normalized filename (spaces/underscores → dashes)
      ].find((a) => t.assets.has(a)), o = i ? t.assets.get(i) : void 0;
      if (!o)
        throw (0, _e.newError)(`Cannot find asset "${r.url}" in GitLab release assets. Available assets: ${Array.from(t.assets.keys()).join(", ")}`, "ERR_UPDATER_ASSET_NOT_FOUND");
      return {
        url: new Wi.URL(o),
        info: r
      };
    });
  }
  toString() {
    return `GitLab (projectId: ${this.options.projectId}, channel: ${this.channel})`;
  }
}
si.GitLabProvider = Bv;
var li = {};
Object.defineProperty(li, "__esModule", { value: !0 });
li.KeygenProvider = void 0;
const ks = ce, Yi = Ge, zi = se;
class jv extends zi.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      isUseMultipleRangeRequest: !1
    }), this.configuration = t, this.updater = r, this.defaultHostname = "api.keygen.sh";
    const i = this.configuration.host || this.defaultHostname;
    this.baseUrl = (0, Yi.newBaseUrl)(`https://${i}/v1/accounts/${this.configuration.account}/artifacts?product=${this.configuration.product}`);
  }
  get channel() {
    return this.updater.channel || this.configuration.channel || "stable";
  }
  async getLatestVersion() {
    const t = new ks.CancellationToken(), r = (0, Yi.getChannelFilename)(this.getCustomChannelName(this.channel)), n = (0, Yi.newUrlFromBase)(r, this.baseUrl, this.updater.isAddNoCacheQuery);
    try {
      const i = await this.httpRequest(n, {
        Accept: "application/vnd.api+json",
        "Keygen-Version": "1.1"
      }, t);
      return (0, zi.parseUpdateInfo)(i, r, n);
    } catch (i) {
      throw (0, ks.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${i.stack || i.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  resolveFiles(t) {
    return (0, zi.resolveFiles)(t, this.baseUrl);
  }
  toString() {
    const { account: t, product: r, platform: n } = this.configuration;
    return `Keygen (account: ${t}, product: ${r}, platform: ${n}, channel: ${this.channel})`;
  }
}
li.KeygenProvider = jv;
var ci = {};
Object.defineProperty(ci, "__esModule", { value: !0 });
ci.PrivateGitHubProvider = void 0;
const Ht = ce, Hv = ge, qv = re, Ms = Et, Bs = Ge, Gv = mt, Wv = se;
class Vv extends Gv.BaseGitHubProvider {
  constructor(t, r, n, i) {
    super(t, "api.github.com", i), this.updater = r, this.token = n;
  }
  createRequestOptions(t, r) {
    const n = super.createRequestOptions(t, r);
    return n.redirect = "manual", n;
  }
  async getLatestVersion() {
    const t = new Ht.CancellationToken(), r = (0, Bs.getChannelFilename)(this.getDefaultChannelName()), n = await this.getLatestVersionInfo(t), i = n.assets.find((s) => s.name === r);
    if (i == null)
      throw (0, Ht.newError)(`Cannot find ${r} in the release ${n.html_url || n.name}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
    const o = new Ms.URL(i.url);
    let a;
    try {
      a = (0, Hv.load)(await this.httpRequest(o, this.configureHeaders("application/octet-stream"), t));
    } catch (s) {
      throw s instanceof Ht.HttpError && s.statusCode === 404 ? (0, Ht.newError)(`Cannot find ${r} in the latest release artifacts (${o}): ${s.stack || s.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : s;
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
    const i = (0, Bs.newUrlFromBase)(n, this.baseUrl);
    try {
      const o = JSON.parse(await this.httpRequest(i, this.configureHeaders("application/vnd.github.v3+json"), t));
      return r ? o.find((a) => a.prerelease) || o[0] : o;
    } catch (o) {
      throw (0, Ht.newError)(`Unable to find latest version on GitHub (${i}), please ensure a production release exists: ${o.stack || o.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  get basePath() {
    return this.computeGithubBasePath(`/repos/${this.options.owner}/${this.options.repo}/releases`);
  }
  resolveFiles(t) {
    return (0, Wv.getFileList)(t).map((r) => {
      const n = qv.posix.basename(r.url).replace(/ /g, "-"), i = t.assets.find((o) => o != null && o.name === n);
      if (i == null)
        throw (0, Ht.newError)(`Cannot find asset "${n}" in: ${JSON.stringify(t.assets, null, 2)}`, "ERR_UPDATER_ASSET_NOT_FOUND");
      return {
        url: new Ms.URL(i.url),
        info: r
      };
    });
  }
}
ci.PrivateGitHubProvider = Vv;
Object.defineProperty(oi, "__esModule", { value: !0 });
oi.isUrlProbablySupportMultiRangeRequests = Tu;
oi.createClient = Qv;
const _n = ce, Yv = ai, js = zr, zv = mt, Xv = si, Kv = li, Jv = ci;
function Tu(e) {
  return !e.includes("s3.amazonaws.com");
}
function Qv(e, t, r) {
  if (typeof e == "string")
    throw (0, _n.newError)("Please pass PublishConfiguration object", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
  const n = e.provider;
  switch (n) {
    case "github": {
      const i = e, o = (i.private ? process.env.GH_TOKEN || process.env.GITHUB_TOKEN : null) || i.token;
      return o == null ? new zv.GitHubProvider(i, t, r) : new Jv.PrivateGitHubProvider(i, t, o, r);
    }
    case "bitbucket":
      return new Yv.BitbucketProvider(e, t, r);
    case "gitlab":
      return new Xv.GitLabProvider(e, t, r);
    case "keygen":
      return new Kv.KeygenProvider(e, t, r);
    case "s3":
    case "spaces":
      return new js.GenericProvider({
        provider: "generic",
        url: (0, _n.getS3LikeProviderBaseUrl)(e),
        channel: e.channel || null
      }, t, {
        ...r,
        // https://github.com/minio/minio/issues/5285#issuecomment-350428955
        isUseMultipleRangeRequest: !1
      });
    case "generic": {
      const i = e;
      return new js.GenericProvider(i, t, {
        ...r,
        isUseMultipleRangeRequest: i.useMultipleRangeRequest !== !1 && Tu(i.url)
      });
    }
    case "custom": {
      const i = e, o = i.updateProvider;
      if (!o)
        throw (0, _n.newError)("Custom provider not specified", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
      return new o(i, t, r);
    }
    default:
      throw (0, _n.newError)(`Unsupported provider: ${n}`, "ERR_UPDATER_UNSUPPORTED_PROVIDER");
  }
}
var ui = {}, Xr = {}, ar = {}, kt = {};
Object.defineProperty(kt, "__esModule", { value: !0 });
kt.OperationKind = void 0;
kt.computeOperations = Zv;
var Pt;
(function(e) {
  e[e.COPY = 0] = "COPY", e[e.DOWNLOAD = 1] = "DOWNLOAD";
})(Pt || (kt.OperationKind = Pt = {}));
function Zv(e, t, r) {
  const n = qs(e.files), i = qs(t.files);
  let o = null;
  const a = t.files[0], s = [], l = a.name, m = n.get(l);
  if (m == null)
    throw new Error(`no file ${l} in old blockmap`);
  const c = i.get(l);
  let f = 0;
  const { checksumToOffset: d, checksumToOldSize: g } = tw(n.get(l), m.offset, r);
  let v = a.offset;
  for (let y = 0; y < c.checksums.length; v += c.sizes[y], y++) {
    const A = c.sizes[y], S = c.checksums[y];
    let T = d.get(S);
    T != null && g.get(S) !== A && (r.warn(`Checksum ("${S}") matches, but size differs (old: ${g.get(S)}, new: ${A})`), T = void 0), T === void 0 ? (f++, o != null && o.kind === Pt.DOWNLOAD && o.end === v ? o.end += A : (o = {
      kind: Pt.DOWNLOAD,
      start: v,
      end: v + A
      // oldBlocks: null,
    }, Hs(o, s, S, y))) : o != null && o.kind === Pt.COPY && o.end === T ? o.end += A : (o = {
      kind: Pt.COPY,
      start: T,
      end: T + A
      // oldBlocks: [checksum]
    }, Hs(o, s, S, y));
  }
  return f > 0 && r.info(`File${a.name === "file" ? "" : " " + a.name} has ${f} changed blocks`), s;
}
const ew = process.env.DIFFERENTIAL_DOWNLOAD_PLAN_BUILDER_VALIDATE_RANGES === "true";
function Hs(e, t, r, n) {
  if (ew && t.length !== 0) {
    const i = t[t.length - 1];
    if (i.kind === e.kind && e.start < i.end && e.start > i.start) {
      const o = [i.start, i.end, e.start, e.end].reduce((a, s) => a < s ? a : s);
      throw new Error(`operation (block index: ${n}, checksum: ${r}, kind: ${Pt[e.kind]}) overlaps previous operation (checksum: ${r}):
abs: ${i.start} until ${i.end} and ${e.start} until ${e.end}
rel: ${i.start - o} until ${i.end - o} and ${e.start - o} until ${e.end - o}`);
    }
  }
  t.push(e);
}
function tw(e, t, r) {
  const n = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map();
  let o = t;
  for (let a = 0; a < e.checksums.length; a++) {
    const s = e.checksums[a], l = e.sizes[a], m = i.get(s);
    if (m === void 0)
      n.set(s, o), i.set(s, l);
    else if (r.debug != null) {
      const c = m === l ? "(same size)" : `(size: ${m}, this size: ${l})`;
      r.debug(`${s} duplicated in blockmap ${c}, it doesn't lead to broken differential downloader, just corresponding block will be skipped)`);
    }
    o += l;
  }
  return { checksumToOffset: n, checksumToOldSize: i };
}
function qs(e) {
  const t = /* @__PURE__ */ new Map();
  for (const r of e)
    t.set(r.name, r);
  return t;
}
Object.defineProperty(ar, "__esModule", { value: !0 });
ar.DataSplitter = void 0;
ar.copyData = Su;
const An = ce, rw = gt, nw = kr, iw = kt, Gs = Buffer.from(`\r
\r
`);
var ot;
(function(e) {
  e[e.INIT = 0] = "INIT", e[e.HEADER = 1] = "HEADER", e[e.BODY = 2] = "BODY";
})(ot || (ot = {}));
function Su(e, t, r, n, i) {
  const o = (0, rw.createReadStream)("", {
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
class ow extends nw.Writable {
  constructor(t, r, n, i, o, a, s, l) {
    super(), this.out = t, this.options = r, this.partIndexToTaskIndex = n, this.partIndexToLength = o, this.finishHandler = a, this.grandTotalBytes = s, this.onProgress = l, this.start = Date.now(), this.nextUpdate = this.start + 1e3, this.transferred = 0, this.delta = 0, this.partIndex = -1, this.headerListBuffer = null, this.readState = ot.INIT, this.ignoreByteCount = 0, this.remainingPartDataCount = 0, this.actualPartLength = 0, this.boundaryLength = i.length + 4, this.ignoreByteCount = this.boundaryLength - 2;
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
      throw (0, An.newError)("Internal error", "ERR_DATA_SPLITTER_BYTE_COUNT_MISMATCH");
    if (this.ignoreByteCount > 0) {
      const n = Math.min(this.ignoreByteCount, t.length);
      this.ignoreByteCount -= n, r = n;
    } else if (this.remainingPartDataCount > 0) {
      const n = Math.min(this.remainingPartDataCount, t.length);
      this.remainingPartDataCount -= n, await this.processPartData(t, 0, n), r = n;
    }
    if (r !== t.length) {
      if (this.readState === ot.HEADER) {
        const n = this.searchHeaderListEnd(t, r);
        if (n === -1)
          return;
        r = n, this.readState = ot.BODY, this.headerListBuffer = null;
      }
      for (; ; ) {
        if (this.readState === ot.BODY)
          this.readState = ot.INIT;
        else {
          this.partIndex++;
          let a = this.partIndexToTaskIndex.get(this.partIndex);
          if (a == null)
            if (this.isFinished)
              a = this.options.end;
            else
              throw (0, An.newError)("taskIndex is null", "ERR_DATA_SPLITTER_TASK_INDEX_IS_NULL");
          const s = this.partIndex === 0 ? this.options.start : this.partIndexToTaskIndex.get(this.partIndex - 1) + 1;
          if (s < a)
            await this.copyExistingData(s, a);
          else if (s > a)
            throw (0, An.newError)("prevTaskIndex must be < taskIndex", "ERR_DATA_SPLITTER_TASK_INDEX_ASSERT_FAILED");
          if (this.isFinished) {
            this.onPartEnd(), this.finishHandler();
            return;
          }
          if (r = this.searchHeaderListEnd(t, r), r === -1) {
            this.readState = ot.HEADER;
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
        if (a.kind !== iw.OperationKind.COPY) {
          i(new Error("Task kind must be COPY"));
          return;
        }
        Su(a, this.out, this.options.oldFileFd, i, () => {
          t++, o();
        });
      };
      o();
    });
  }
  searchHeaderListEnd(t, r) {
    const n = t.indexOf(Gs, r);
    if (n !== -1)
      return n + Gs.length;
    const i = r === 0 ? t : t.slice(r);
    return this.headerListBuffer == null ? this.headerListBuffer = i : this.headerListBuffer = Buffer.concat([this.headerListBuffer, i]), -1;
  }
  onPartEnd() {
    const t = this.partIndexToLength[this.partIndex - 1];
    if (this.actualPartLength !== t)
      throw (0, An.newError)(`Expected length: ${t} differs from actual: ${this.actualPartLength}`, "ERR_DATA_SPLITTER_LENGTH_MISMATCH");
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
ar.DataSplitter = ow;
var fi = {};
Object.defineProperty(fi, "__esModule", { value: !0 });
fi.executeTasksUsingMultipleRangeRequests = aw;
fi.checkIsRangesSupported = Eo;
const go = ce, Ws = ar, Vs = kt;
function aw(e, t, r, n, i) {
  const o = (a) => {
    if (a >= t.length) {
      e.fileMetadataBuffer != null && r.write(e.fileMetadataBuffer), r.end();
      return;
    }
    const s = a + 1e3;
    sw(e, {
      tasks: t,
      start: a,
      end: Math.min(t.length, s),
      oldFileFd: n
    }, r, () => o(s), i);
  };
  return o;
}
function sw(e, t, r, n, i) {
  let o = "bytes=", a = 0, s = 0;
  const l = /* @__PURE__ */ new Map(), m = [];
  for (let d = t.start; d < t.end; d++) {
    const g = t.tasks[d];
    g.kind === Vs.OperationKind.DOWNLOAD && (o += `${g.start}-${g.end - 1}, `, l.set(a, d), a++, m.push(g.end - g.start), s += g.end - g.start);
  }
  if (a <= 1) {
    const d = (g) => {
      if (g >= t.end) {
        n();
        return;
      }
      const v = t.tasks[g++];
      if (v.kind === Vs.OperationKind.COPY)
        (0, Ws.copyData)(v, r, t.oldFileFd, i, () => d(g));
      else {
        const y = e.createRequestOptions();
        y.headers.Range = `bytes=${v.start}-${v.end - 1}`;
        const A = e.httpExecutor.createRequest(y, (S) => {
          S.on("error", i), Eo(S, i) && (S.pipe(r, {
            end: !1
          }), S.once("end", () => d(g)));
        });
        e.httpExecutor.addErrorAndTimeoutHandlers(A, i), A.end();
      }
    };
    d(t.start);
    return;
  }
  const c = e.createRequestOptions();
  c.headers.Range = o.substring(0, o.length - 2);
  const f = e.httpExecutor.createRequest(c, (d) => {
    if (!Eo(d, i))
      return;
    const g = (0, go.safeGetHeader)(d, "content-type"), v = /^multipart\/.+?\s*;\s*boundary=(?:"([^"]+)"|([^\s";]+))\s*$/i.exec(g);
    if (v == null) {
      i(new Error(`Content-Type "multipart/byteranges" is expected, but got "${g}"`));
      return;
    }
    const y = new Ws.DataSplitter(r, t, l, v[1] || v[2], m, n, s, e.options.onProgress);
    y.on("error", i), d.pipe(y), d.on("end", () => {
      setTimeout(() => {
        f.abort(), i(new Error("Response ends without calling any handlers"));
      }, 1e4);
    });
  });
  e.httpExecutor.addErrorAndTimeoutHandlers(f, i), f.end();
}
function Eo(e, t) {
  if (e.statusCode >= 400)
    return t((0, go.createHttpError)(e)), !1;
  if (e.statusCode !== 206) {
    const r = (0, go.safeGetHeader)(e, "accept-ranges");
    if (r == null || r === "none")
      return t(new Error(`Server doesn't support Accept-Ranges (response code ${e.statusCode})`)), !1;
  }
  return !0;
}
var di = {};
Object.defineProperty(di, "__esModule", { value: !0 });
di.ProgressDifferentialDownloadCallbackTransform = void 0;
const lw = kr;
var Kt;
(function(e) {
  e[e.COPY = 0] = "COPY", e[e.DOWNLOAD = 1] = "DOWNLOAD";
})(Kt || (Kt = {}));
class cw extends lw.Transform {
  constructor(t, r, n) {
    super(), this.progressDifferentialDownloadInfo = t, this.cancellationToken = r, this.onProgress = n, this.start = Date.now(), this.transferred = 0, this.delta = 0, this.expectedBytes = 0, this.index = 0, this.operationType = Kt.COPY, this.nextUpdate = this.start + 1e3;
  }
  _transform(t, r, n) {
    if (this.cancellationToken.cancelled) {
      n(new Error("cancelled"), null);
      return;
    }
    if (this.operationType == Kt.COPY) {
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
    this.operationType = Kt.COPY;
  }
  beginRangeDownload() {
    this.operationType = Kt.DOWNLOAD, this.expectedBytes += this.progressDifferentialDownloadInfo.expectedByteCounts[this.index++];
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
di.ProgressDifferentialDownloadCallbackTransform = cw;
Object.defineProperty(Xr, "__esModule", { value: !0 });
Xr.DifferentialDownloader = void 0;
const mr = ce, Xi = yt, uw = gt, fw = ar, dw = Et, Tn = kt, Ys = fi, hw = di;
class pw {
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
    return (0, mr.configureRequestUrl)(this.options.newUrl, t), (0, mr.configureRequestOptions)(t), t;
  }
  doDownload(t, r) {
    if (t.version !== r.version)
      throw new Error(`version is different (${t.version} - ${r.version}), full download is required`);
    const n = this.logger, i = (0, Tn.computeOperations)(t, r, n);
    n.debug != null && n.debug(JSON.stringify(i, null, 2));
    let o = 0, a = 0;
    for (const l of i) {
      const m = l.end - l.start;
      l.kind === Tn.OperationKind.DOWNLOAD ? o += m : a += m;
    }
    const s = this.blockAwareFileInfo.size;
    if (o + a + (this.fileMetadataBuffer == null ? 0 : this.fileMetadataBuffer.length) !== s)
      throw new Error(`Internal error, size mismatch: downloadSize: ${o}, copySize: ${a}, newSize: ${s}`);
    return n.info(`Full: ${zs(s)}, To download: ${zs(o)} (${Math.round(o / (s / 100))}%)`), this.downloadFile(i);
  }
  downloadFile(t) {
    const r = [], n = () => Promise.all(r.map((i) => (0, Xi.close)(i.descriptor).catch((o) => {
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
    const n = await (0, Xi.open)(this.options.oldFile, "r");
    r.push({ descriptor: n, path: this.options.oldFile });
    const i = await (0, Xi.open)(this.options.newFile, "w");
    r.push({ descriptor: i, path: this.options.newFile });
    const o = (0, uw.createWriteStream)(this.options.newFile, { fd: i });
    await new Promise((a, s) => {
      const l = [];
      let m;
      if (!this.options.isUseMultipleRangeRequest && this.options.onProgress) {
        const S = [];
        let T = 0;
        for (const x of t)
          x.kind === Tn.OperationKind.DOWNLOAD && (S.push(x.end - x.start), T += x.end - x.start);
        const D = {
          expectedByteCounts: S,
          grandTotal: T
        };
        m = new hw.ProgressDifferentialDownloadCallbackTransform(D, this.options.cancellationToken, this.options.onProgress), l.push(m);
      }
      const c = new mr.DigestTransform(this.blockAwareFileInfo.sha512);
      c.isValidateOnEnd = !1, l.push(c), o.on("finish", () => {
        o.close(() => {
          r.splice(1, 1);
          try {
            c.validate();
          } catch (S) {
            s(S);
            return;
          }
          a(void 0);
        });
      }), l.push(o);
      let f = null;
      for (const S of l)
        S.on("error", s), f == null ? f = S : f = f.pipe(S);
      const d = l[0];
      let g;
      if (this.options.isUseMultipleRangeRequest) {
        g = (0, Ys.executeTasksUsingMultipleRangeRequests)(this, t, d, n, s), g(0);
        return;
      }
      let v = 0, y = null;
      this.logger.info(`Differential download: ${this.options.newUrl}`);
      const A = this.createRequestOptions();
      A.redirect = "manual", g = (S) => {
        var T, D;
        if (S >= t.length) {
          this.fileMetadataBuffer != null && d.write(this.fileMetadataBuffer), d.end();
          return;
        }
        const x = t[S++];
        if (x.kind === Tn.OperationKind.COPY) {
          m && m.beginFileCopy(), (0, fw.copyData)(x, d, n, s, () => g(S));
          return;
        }
        const Z = `bytes=${x.start}-${x.end - 1}`;
        A.headers.range = Z, (D = (T = this.logger) === null || T === void 0 ? void 0 : T.debug) === null || D === void 0 || D.call(T, `download range: ${Z}`), m && m.beginRangeDownload();
        const oe = this.httpExecutor.createRequest(A, (V) => {
          V.on("error", s), V.on("aborted", () => {
            s(new Error("response has been aborted by the server"));
          }), V.statusCode >= 400 && s((0, mr.createHttpError)(V)), V.pipe(d, {
            end: !1
          }), V.once("end", () => {
            m && m.endRangeDownload(), ++v === 100 ? (v = 0, setTimeout(() => g(S), 1e3)) : g(S);
          });
        });
        oe.on("redirect", (V, De, E) => {
          this.logger.info(`Redirect to ${mw(E)}`), y = E, (0, mr.configureRequestUrl)(new dw.URL(y), A), oe.followRedirect();
        }), this.httpExecutor.addErrorAndTimeoutHandlers(oe, s), oe.end();
      }, g(0);
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
        (0, Ys.checkIsRangesSupported)(a, i) && (a.on("error", i), a.on("aborted", () => {
          i(new Error("response has been aborted by the server"));
        }), a.on("data", r), a.on("end", () => n()));
      });
      this.httpExecutor.addErrorAndTimeoutHandlers(o, i), o.end();
    });
  }
}
Xr.DifferentialDownloader = pw;
function zs(e, t = " KB") {
  return new Intl.NumberFormat("en").format((e / 1024).toFixed(2)) + t;
}
function mw(e) {
  const t = e.indexOf("?");
  return t < 0 ? e : e.substring(0, t);
}
Object.defineProperty(ui, "__esModule", { value: !0 });
ui.GenericDifferentialDownloader = void 0;
const gw = Xr;
class Ew extends gw.DifferentialDownloader {
  download(t, r) {
    return this.doDownload(t, r);
  }
}
ui.GenericDifferentialDownloader = Ew;
var vt = {};
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
})(vt);
Object.defineProperty(ft, "__esModule", { value: !0 });
ft.NoOpLogger = ft.AppUpdater = void 0;
const Ae = ce, yw = Mr, vw = Gn, ww = ml, ke = yt, _w = ge, Ki = Qn, Me = re, Rt = mu, Xs = Yr, Aw = ii, Ks = gu, Tw = zr, Ji = oi, Qi = El, Sw = ui, qt = vt;
class Xo extends ww.EventEmitter {
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
        throw (0, Ae.newError)(`Channel must be a string, but got: ${t}`, "ERR_UPDATER_INVALID_CHANNEL");
      if (t.length === 0)
        throw (0, Ae.newError)("Channel must be not an empty string", "ERR_UPDATER_INVALID_CHANNEL");
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
    return (0, Ks.getNetSession)();
  }
  /**
   * The logger. You can pass [electron-log](https://github.com/megahertz/electron-log), [winston](https://github.com/winstonjs/winston) or another logger with the following interface: `{ info(), warn(), error() }`.
   * Set it to `null` if you would like to disable a logging feature.
   */
  get logger() {
    return this._logger;
  }
  set logger(t) {
    this._logger = t ?? new Cu();
  }
  // noinspection JSUnusedGlobalSymbols
  /**
   * test only
   * @private
   */
  set updateConfigPath(t) {
    this.clientPromise = null, this._appUpdateConfigPath = t, this.configOnDisk = new Ki.Lazy(() => this.loadUpdateConfig());
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
    super(), this.autoDownload = !0, this.autoInstallOnAppQuit = !0, this.autoRunAppAfterInstall = !0, this.allowPrerelease = !1, this.fullChangelog = !1, this.allowDowngrade = !1, this.disableWebInstaller = !1, this.disableDifferentialDownload = !1, this.forceDevUpdateConfig = !1, this.previousBlockmapBaseUrlOverride = null, this._channel = null, this.downloadedUpdateHelper = null, this.requestHeaders = null, this._logger = console, this.signals = new qt.UpdaterSignal(this), this._appUpdateConfigPath = null, this._isUpdateSupported = (o) => this.checkIfUpdateSupported(o), this._isUserWithinRollout = (o) => this.isStagingMatch(o), this.clientPromise = null, this.stagingUserIdPromise = new Ki.Lazy(() => this.getOrCreateStagingUserId()), this.configOnDisk = new Ki.Lazy(() => this.loadUpdateConfig()), this.checkForUpdatesPromise = null, this.downloadPromise = null, this.updateInfoAndProvider = null, this._testOnlyOptions = null, this.on("error", (o) => {
      this._logger.error(`Error: ${o.stack || o.message}`);
    }), r == null ? (this.app = new Aw.ElectronAppAdapter(), this.httpExecutor = new Ks.ElectronHttpExecutor((o, a) => this.emit("login", o, a))) : (this.app = r, this.httpExecutor = null);
    const n = this.app.version, i = (0, Rt.parse)(n);
    if (i == null)
      throw (0, Ae.newError)(`App version is not a valid semver version: "${n}"`, "ERR_UPDATER_INVALID_VERSION");
    this.currentVersion = i, this.allowPrerelease = Cw(i), t != null && (this.setFeedURL(t), typeof t != "string" && t.requestHeaders && (this.requestHeaders = t.requestHeaders));
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
    typeof t == "string" ? n = new Tw.GenericProvider({ provider: "generic", url: t }, this, {
      ...r,
      isUseMultipleRangeRequest: (0, Ji.isUrlProbablySupportMultiRangeRequests)(t)
    }) : n = (0, Ji.createClient)(t, this, r), this.clientPromise = Promise.resolve(n);
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
      const n = Xo.formatDownloadNotification(r.updateInfo.version, this.app.name, t);
      new $t.Notification(n).show();
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
    const i = await this.stagingUserIdPromise.value, a = Ae.UUID.parse(i).readUInt32BE(12) / 4294967295;
    return this._logger.info(`Staging percentage: ${n}, percentage: ${a}, user id: ${i}`), a < n;
  }
  computeFinalHeaders(t) {
    return this.requestHeaders != null && Object.assign(t, this.requestHeaders), t;
  }
  async isUpdateAvailable(t) {
    const r = (0, Rt.parse)(t.version);
    if (r == null)
      throw (0, Ae.newError)(`This file could not be downloaded, or the latest version (from update server) does not have a valid semver version: "${t.version}"`, "ERR_UPDATER_INVALID_VERSION");
    const n = this.currentVersion;
    if ((0, Rt.eq)(r, n) || !await Promise.resolve(this.isUpdateSupported(t)) || !await Promise.resolve(this.isUserWithinRollout(t)))
      return !1;
    const o = (0, Rt.gt)(r, n), a = (0, Rt.lt)(r, n);
    return o ? !0 : this.allowDowngrade && a;
  }
  checkIfUpdateSupported(t) {
    const r = t == null ? void 0 : t.minimumSystemVersion, n = (0, vw.release)();
    if (r)
      try {
        if ((0, Rt.lt)(n, r))
          return this._logger.info(`Current OS version ${n} is less than the minimum OS version required ${r} for version ${n}`), !1;
      } catch (i) {
        this._logger.warn(`Failed to compare current OS version(${n}) with minimum OS version(${r}): ${(i.message || i).toString()}`);
      }
    return !0;
  }
  async getUpdateInfoAndProvider() {
    await this.app.whenReady(), this.clientPromise == null && (this.clientPromise = this.configOnDisk.value.then((n) => (0, Ji.createClient)(n, this, this.createProviderRuntimeOptions())));
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
    const n = new Ae.CancellationToken();
    return {
      isUpdateAvailable: !0,
      versionInfo: r,
      updateInfo: r,
      cancellationToken: n,
      downloadPromise: this.autoDownload ? this.downloadUpdate(n) : null
    };
  }
  onUpdateAvailable(t) {
    this._logger.info(`Found version ${t.version} (url: ${(0, Ae.asArray)(t.files).map((r) => r.url).join(", ")})`), this.emit("update-available", t);
  }
  /**
   * Start downloading update manually. You can use this method if `autoDownload` option is set to `false`.
   * @returns {Promise<Array<string>>} Paths to downloaded files.
   */
  downloadUpdate(t = new Ae.CancellationToken()) {
    const r = this.updateInfoAndProvider;
    if (r == null) {
      const i = new Error("Please check update first");
      return this.dispatchError(i), Promise.reject(i);
    }
    if (this.downloadPromise != null)
      return this._logger.info("Downloading update (already in progress)"), this.downloadPromise;
    this._logger.info(`Downloading update from ${(0, Ae.asArray)(r.info.files).map((i) => i.url).join(", ")}`);
    const n = (i) => {
      if (!(i instanceof Ae.CancellationError))
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
    this.emit(qt.UPDATE_DOWNLOADED, t);
  }
  async loadUpdateConfig() {
    return this._appUpdateConfigPath == null && (this._appUpdateConfigPath = this.app.appUpdateConfigPath), (0, _w.load)(await (0, ke.readFile)(this._appUpdateConfigPath, "utf-8"));
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
    const t = Me.join(this.app.userDataPath, ".updaterId");
    try {
      const n = await (0, ke.readFile)(t, "utf-8");
      if (Ae.UUID.check(n))
        return n;
      this._logger.warn(`Staging user id file exists, but content was invalid: ${n}`);
    } catch (n) {
      n.code !== "ENOENT" && this._logger.warn(`Couldn't read staging user ID, creating a blank one: ${n}`);
    }
    const r = Ae.UUID.v5((0, yw.randomBytes)(4096), Ae.UUID.OID);
    this._logger.info(`Generated new staging user ID: ${r}`);
    try {
      await (0, ke.outputFile)(t, r);
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
      const i = Me.join(this.app.baseCachePath, r || this.app.name);
      n.debug != null && n.debug(`updater cache dir: ${i}`), t = new Xs.DownloadedUpdateHelper(i), this.downloadedUpdateHelper = t;
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
    this.listenerCount(qt.DOWNLOAD_PROGRESS) > 0 && (n.onProgress = (T) => this.emit(qt.DOWNLOAD_PROGRESS, T));
    const i = t.downloadUpdateOptions.updateInfoAndProvider.info, o = i.version, a = r.packageInfo;
    function s() {
      const T = decodeURIComponent(t.fileInfo.url.pathname);
      return T.toLowerCase().endsWith(`.${t.fileExtension.toLowerCase()}`) ? Me.basename(T) : t.fileInfo.info.url;
    }
    const l = await this.getOrCreateDownloadHelper(), m = l.cacheDirForPendingUpdate;
    await (0, ke.mkdir)(m, { recursive: !0 });
    const c = s();
    let f = Me.join(m, c);
    const d = a == null ? null : Me.join(m, `package-${o}${Me.extname(a.path) || ".7z"}`), g = async (T) => {
      await l.setDownloadedFile(f, d, i, r, c, T), await t.done({
        ...i,
        downloadedFile: f
      });
      const D = Me.join(m, "current.blockmap");
      return await (0, ke.pathExists)(D) && await (0, ke.copyFile)(D, Me.join(l.cacheDir, "current.blockmap")), d == null ? [f] : [f, d];
    }, v = this._logger, y = await l.validateDownloadedPath(f, i, r, v);
    if (y != null)
      return f = y, await g(!1);
    const A = async () => (await l.clear().catch(() => {
    }), await (0, ke.unlink)(f).catch(() => {
    })), S = await (0, Xs.createTempUpdateFile)(`temp-${c}`, m, v);
    try {
      await t.task(S, n, d, A), await (0, Ae.retry)(() => (0, ke.rename)(S, f), {
        retries: 60,
        interval: 500,
        shouldRetry: (T) => T instanceof Error && /^EBUSY:/.test(T.message) ? !0 : (v.warn(`Cannot rename temp file to final file: ${T.message || T.stack}`), !1)
      });
    } catch (T) {
      throw await A(), T instanceof Ae.CancellationError && (v.info("cancelled"), this.emit("update-cancelled", i)), T;
    }
    return v.info(`New version ${o} has been downloaded to ${f}`), await g(!0);
  }
  async differentialDownloadInstaller(t, r, n, i, o) {
    try {
      if (this._testOnlyOptions != null && !this._testOnlyOptions.isUseDifferentialDownload)
        return !0;
      const a = r.updateInfoAndProvider.provider, s = await a.getBlockMapFiles(t.url, this.app.version, r.updateInfoAndProvider.info.version, this.previousBlockmapBaseUrlOverride);
      this._logger.info(`Download block maps (old: "${s[0]}", new: ${s[1]})`);
      const l = async (v) => {
        const y = await this.httpExecutor.downloadToBuffer(v, {
          headers: r.requestHeaders,
          cancellationToken: r.cancellationToken
        });
        if (y == null || y.length === 0)
          throw new Error(`Blockmap "${v.href}" is empty`);
        try {
          return JSON.parse((0, Qi.gunzipSync)(y).toString());
        } catch (A) {
          throw new Error(`Cannot parse blockmap "${v.href}", error: ${A}`);
        }
      }, m = {
        newUrl: t.url,
        oldFile: Me.join(this.downloadedUpdateHelper.cacheDir, o),
        logger: this._logger,
        newFile: n,
        isUseMultipleRangeRequest: a.isUseMultipleRangeRequest,
        requestHeaders: r.requestHeaders,
        cancellationToken: r.cancellationToken
      };
      this.listenerCount(qt.DOWNLOAD_PROGRESS) > 0 && (m.onProgress = (v) => this.emit(qt.DOWNLOAD_PROGRESS, v));
      const c = async (v, y) => {
        const A = Me.join(y, "current.blockmap");
        await (0, ke.outputFile)(A, (0, Qi.gzipSync)(JSON.stringify(v)));
      }, f = async (v) => {
        const y = Me.join(v, "current.blockmap");
        try {
          if (await (0, ke.pathExists)(y))
            return JSON.parse((0, Qi.gunzipSync)(await (0, ke.readFile)(y)).toString());
        } catch (A) {
          this._logger.warn(`Cannot parse blockmap "${y}", error: ${A}`);
        }
        return null;
      }, d = await l(s[1]);
      await c(d, this.downloadedUpdateHelper.cacheDirForPendingUpdate);
      let g = await f(this.downloadedUpdateHelper.cacheDir);
      return g == null && (g = await l(s[0])), await new Sw.GenericDifferentialDownloader(t.info, this.httpExecutor, m).download(g, d), !1;
    } catch (a) {
      if (this._logger.error(`Cannot download differentially, fallback to full download: ${a.stack || a}`), this._testOnlyOptions != null)
        throw a;
      return !0;
    }
  }
}
ft.AppUpdater = Xo;
function Cw(e) {
  const t = (0, Rt.prerelease)(e);
  return t != null && t.length > 0;
}
class Cu {
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
ft.NoOpLogger = Cu;
Object.defineProperty(Ut, "__esModule", { value: !0 });
Ut.BaseUpdater = void 0;
const Js = qn, bw = ft;
class Rw extends bw.AppUpdater {
  constructor(t, r) {
    super(t, r), this.quitAndInstallCalled = !1, this.quitHandlerAdded = !1;
  }
  quitAndInstall(t = !1, r = !1) {
    this._logger.info("Install on explicit quitAndInstall"), this.install(t, t ? r : this.autoRunAppAfterInstall) ? setImmediate(() => {
      $t.autoUpdater.emit("before-quit-for-update"), this.app.quit();
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
    const i = (0, Js.spawnSync)(t, r, {
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
        const s = { stdio: i, env: n, detached: !0 }, l = (0, Js.spawn)(t, r, s);
        l.on("error", (m) => {
          a(m);
        }), l.unref(), l.pid !== void 0 && o(!0);
      } catch (s) {
        a(s);
      }
    });
  }
}
Ut.BaseUpdater = Rw;
var Dr = {}, Kr = {};
Object.defineProperty(Kr, "__esModule", { value: !0 });
Kr.FileWithEmbeddedBlockMapDifferentialDownloader = void 0;
const Gt = yt, Ow = Xr, Iw = El;
class Pw extends Ow.DifferentialDownloader {
  async download() {
    const t = this.blockAwareFileInfo, r = t.size, n = r - (t.blockMapSize + 4);
    this.fileMetadataBuffer = await this.readRemoteBytes(n, r - 1);
    const i = bu(this.fileMetadataBuffer.slice(0, this.fileMetadataBuffer.length - 4));
    await this.doDownload(await Nw(this.options.oldFile), i);
  }
}
Kr.FileWithEmbeddedBlockMapDifferentialDownloader = Pw;
function bu(e) {
  return JSON.parse((0, Iw.inflateRawSync)(e).toString());
}
async function Nw(e) {
  const t = await (0, Gt.open)(e, "r");
  try {
    const r = (await (0, Gt.fstat)(t)).size, n = Buffer.allocUnsafe(4);
    await (0, Gt.read)(t, n, 0, n.length, r - n.length);
    const i = Buffer.allocUnsafe(n.readUInt32BE(0));
    return await (0, Gt.read)(t, i, 0, i.length, r - n.length - i.length), await (0, Gt.close)(t), bu(i);
  } catch (r) {
    throw await (0, Gt.close)(t), r;
  }
}
Object.defineProperty(Dr, "__esModule", { value: !0 });
Dr.AppImageUpdater = void 0;
const Qs = ce, Zs = qn, Dw = yt, $w = gt, gr = re, Fw = Ut, xw = Kr, Lw = se, el = vt;
class Uw extends Fw.BaseUpdater {
  constructor(t, r) {
    super(t, r);
  }
  isUpdaterActive() {
    return process.env.APPIMAGE == null && !this.forceDevUpdateConfig ? (process.env.SNAP == null ? this._logger.warn("APPIMAGE env is not defined, current application is not an AppImage") : this._logger.info("SNAP env is defined, updater is disabled"), !1) : super.isUpdaterActive();
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, Lw.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "AppImage", ["rpm", "deb", "pacman"]);
    return this.executeDownload({
      fileExtension: "AppImage",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, o) => {
        const a = process.env.APPIMAGE;
        if (a == null)
          throw (0, Qs.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
        (t.disableDifferentialDownload || await this.downloadDifferential(n, a, i, r, t)) && await this.httpExecutor.download(n.url, i, o), await (0, Dw.chmod)(i, 493);
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
      return this.listenerCount(el.DOWNLOAD_PROGRESS) > 0 && (a.onProgress = (s) => this.emit(el.DOWNLOAD_PROGRESS, s)), await new xw.FileWithEmbeddedBlockMapDifferentialDownloader(t.info, this.httpExecutor, a).download(), !1;
    } catch (a) {
      return this._logger.error(`Cannot download differentially, fallback to full download: ${a.stack || a}`), process.platform === "linux";
    }
  }
  doInstall(t) {
    const r = process.env.APPIMAGE;
    if (r == null)
      throw (0, Qs.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
    (0, $w.unlinkSync)(r);
    let n;
    const i = gr.basename(r), o = this.installerPath;
    if (o == null)
      return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
    gr.basename(o) === i || !/\d+\.\d+\.\d+/.test(i) ? n = r : n = gr.join(gr.dirname(r), gr.basename(o)), (0, Zs.execFileSync)("mv", ["-f", o, n]), n !== r && this.emit("appimage-filename-updated", n);
    const a = {
      ...process.env,
      APPIMAGE_SILENT_INSTALL: "true"
    };
    return t.isForceRunAfter ? this.spawnLog(n, [], a) : (a.APPIMAGE_EXIT_AFTER_INSTALL = "true", (0, Zs.execFileSync)(n, [], { env: a })), !0;
  }
}
Dr.AppImageUpdater = Uw;
var $r = {}, sr = {};
Object.defineProperty(sr, "__esModule", { value: !0 });
sr.LinuxUpdater = void 0;
const kw = Ut;
class Mw extends kw.BaseUpdater {
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
sr.LinuxUpdater = Mw;
Object.defineProperty($r, "__esModule", { value: !0 });
$r.DebUpdater = void 0;
const Bw = se, tl = vt, jw = sr;
class Ko extends jw.LinuxUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, Bw.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "deb", ["AppImage", "rpm", "pacman"]);
    return this.executeDownload({
      fileExtension: "deb",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, o) => {
        this.listenerCount(tl.DOWNLOAD_PROGRESS) > 0 && (o.onProgress = (a) => this.emit(tl.DOWNLOAD_PROGRESS, a)), await this.httpExecutor.download(n.url, i, o);
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
      Ko.installWithCommandRunner(i, r, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
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
$r.DebUpdater = Ko;
var Fr = {};
Object.defineProperty(Fr, "__esModule", { value: !0 });
Fr.PacmanUpdater = void 0;
const rl = vt, Hw = se, qw = sr;
class Jo extends qw.LinuxUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, Hw.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "pacman", ["AppImage", "deb", "rpm"]);
    return this.executeDownload({
      fileExtension: "pacman",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, o) => {
        this.listenerCount(rl.DOWNLOAD_PROGRESS) > 0 && (o.onProgress = (a) => this.emit(rl.DOWNLOAD_PROGRESS, a)), await this.httpExecutor.download(n.url, i, o);
      }
    });
  }
  doInstall(t) {
    const r = this.installerPath;
    if (r == null)
      return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
    try {
      Jo.installWithCommandRunner(r, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
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
Fr.PacmanUpdater = Jo;
var xr = {};
Object.defineProperty(xr, "__esModule", { value: !0 });
xr.RpmUpdater = void 0;
const nl = vt, Gw = se, Ww = sr;
class Qo extends Ww.LinuxUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, Gw.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "rpm", ["AppImage", "deb", "pacman"]);
    return this.executeDownload({
      fileExtension: "rpm",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, o) => {
        this.listenerCount(nl.DOWNLOAD_PROGRESS) > 0 && (o.onProgress = (a) => this.emit(nl.DOWNLOAD_PROGRESS, a)), await this.httpExecutor.download(n.url, i, o);
      }
    });
  }
  doInstall(t) {
    const r = this.installerPath;
    if (r == null)
      return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
    const n = ["zypper", "dnf", "yum", "rpm"], i = this.detectPackageManager(n);
    try {
      Qo.installWithCommandRunner(i, r, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
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
xr.RpmUpdater = Qo;
var Lr = {};
Object.defineProperty(Lr, "__esModule", { value: !0 });
Lr.MacUpdater = void 0;
const il = ce, Zi = yt, Vw = gt, ol = re, Yw = kf, zw = ft, Xw = se, al = qn, sl = Mr;
class Kw extends zw.AppUpdater {
  constructor(t, r) {
    super(t, r), this.nativeUpdater = $t.autoUpdater, this.squirrelDownloadedUpdate = !1, this.nativeUpdater.on("error", (n) => {
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
      this.debug("Checking for macOS Rosetta environment"), o = (0, al.execFileSync)("sysctl", [i], { encoding: "utf8" }).includes(`${i}: 1`), n.info(`Checked for macOS Rosetta environment (isRosetta=${o})`);
    } catch (f) {
      n.warn(`sysctl shell command to check for macOS Rosetta environment failed: ${f}`);
    }
    let a = !1;
    try {
      this.debug("Checking for arm64 in uname");
      const d = (0, al.execFileSync)("uname", ["-a"], { encoding: "utf8" }).includes("ARM");
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
    const l = (0, Xw.findFile)(r, "zip", ["pkg", "dmg"]);
    if (l == null)
      throw (0, il.newError)(`ZIP file not provided: ${(0, il.safeStringifyJson)(r)}`, "ERR_UPDATER_ZIP_FILE_NOT_FOUND");
    const m = t.updateInfoAndProvider.provider, c = "update.zip";
    return this.executeDownload({
      fileExtension: "zip",
      fileInfo: l,
      downloadUpdateOptions: t,
      task: async (f, d) => {
        const g = ol.join(this.downloadedUpdateHelper.cacheDir, c), v = () => (0, Zi.pathExistsSync)(g) ? !t.disableDifferentialDownload : (n.info("Unable to locate previous update.zip for differential download (is this first install?), falling back to full download"), !1);
        let y = !0;
        v() && (y = await this.differentialDownloadInstaller(l, t, f, m, c)), y && await this.httpExecutor.download(l.url, f, d);
      },
      done: async (f) => {
        if (!t.disableDifferentialDownload)
          try {
            const d = ol.join(this.downloadedUpdateHelper.cacheDir, c);
            await (0, Zi.copyFile)(f.downloadedFile, d);
          } catch (d) {
            this._logger.warn(`Unable to copy file for caching for future differential downloads: ${d.message}`);
          }
        return this.updateDownloaded(l, f);
      }
    });
  }
  async updateDownloaded(t, r) {
    var n;
    const i = r.downloadedFile, o = (n = t.info.size) !== null && n !== void 0 ? n : (await (0, Zi.stat)(i)).size, a = this._logger, s = `fileToProxy=${t.url.href}`;
    this.closeServerIfExists(), this.debug(`Creating proxy server for native Squirrel.Mac (${s})`), this.server = (0, Yw.createServer)(), this.debug(`Proxy server for native Squirrel.Mac is created (${s})`), this.server.on("close", () => {
      a.info(`Proxy server for native Squirrel.Mac is closed (${s})`);
    });
    const l = (m) => {
      const c = m.address();
      return typeof c == "string" ? c : `http://127.0.0.1:${c == null ? void 0 : c.port}`;
    };
    return await new Promise((m, c) => {
      const f = (0, sl.randomBytes)(64).toString("base64").replace(/\//g, "_").replace(/\+/g, "-"), d = Buffer.from(`autoupdater:${f}`, "ascii"), g = `/${(0, sl.randomBytes)(64).toString("hex")}.zip`;
      this.server.on("request", (v, y) => {
        const A = v.url;
        if (a.info(`${A} requested`), A === "/") {
          if (!v.headers.authorization || v.headers.authorization.indexOf("Basic ") === -1) {
            y.statusCode = 401, y.statusMessage = "Invalid Authentication Credentials", y.end(), a.warn("No authenthication info");
            return;
          }
          const D = v.headers.authorization.split(" ")[1], x = Buffer.from(D, "base64").toString("ascii"), [Z, oe] = x.split(":");
          if (Z !== "autoupdater" || oe !== f) {
            y.statusCode = 401, y.statusMessage = "Invalid Authentication Credentials", y.end(), a.warn("Invalid authenthication credentials");
            return;
          }
          const V = Buffer.from(`{ "url": "${l(this.server)}${g}" }`);
          y.writeHead(200, { "Content-Type": "application/json", "Content-Length": V.length }), y.end(V);
          return;
        }
        if (!A.startsWith(g)) {
          a.warn(`${A} requested, but not supported`), y.writeHead(404), y.end();
          return;
        }
        a.info(`${g} requested by Squirrel.Mac, pipe ${i}`);
        let S = !1;
        y.on("finish", () => {
          S || (this.nativeUpdater.removeListener("error", c), m([]));
        });
        const T = (0, Vw.createReadStream)(i);
        T.on("error", (D) => {
          try {
            y.end();
          } catch (x) {
            a.warn(`cannot end response: ${x}`);
          }
          S = !0, this.nativeUpdater.removeListener("error", c), c(new Error(`Cannot pipe "${i}": ${D}`));
        }), y.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Length": o
        }), T.pipe(y);
      }), this.debug(`Proxy server for native Squirrel.Mac is starting to listen (${s})`), this.server.listen(0, "127.0.0.1", () => {
        this.debug(`Proxy server for native Squirrel.Mac is listening (address=${l(this.server)}, ${s})`), this.nativeUpdater.setFeedURL({
          url: l(this.server),
          headers: {
            "Cache-Control": "no-cache",
            Authorization: `Basic ${d.toString("base64")}`
          }
        }), this.dispatchUpdateDownloaded(r), this.autoInstallOnAppQuit ? (this.nativeUpdater.once("error", c), this.nativeUpdater.checkForUpdates()) : m([]);
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
Lr.MacUpdater = Kw;
var Ur = {}, Zo = {};
Object.defineProperty(Zo, "__esModule", { value: !0 });
Zo.verifySignature = Qw;
const ll = ce, Ru = qn, Jw = Gn, cl = re;
function Ou(e, t) {
  return ['set "PSModulePath=" & chcp 65001 >NUL & powershell.exe', ["-NoProfile", "-NonInteractive", "-InputFormat", "None", "-Command", e], {
    shell: !0,
    timeout: t
  }];
}
function Qw(e, t, r) {
  return new Promise((n, i) => {
    const o = t.replace(/'/g, "''");
    r.info(`Verifying signature ${o}`), (0, Ru.execFile)(...Ou(`"Get-AuthenticodeSignature -LiteralPath '${o}' | ConvertTo-Json -Compress"`, 20 * 1e3), (a, s, l) => {
      var m;
      try {
        if (a != null || l) {
          eo(r, a, l, i), n(null);
          return;
        }
        const c = Zw(s);
        if (c.Status === 0) {
          try {
            const v = cl.normalize(c.Path), y = cl.normalize(t);
            if (r.info(`LiteralPath: ${v}. Update Path: ${y}`), v !== y) {
              eo(r, new Error(`LiteralPath of ${v} is different than ${y}`), l, i), n(null);
              return;
            }
          } catch (v) {
            r.warn(`Unable to verify LiteralPath of update asset due to missing data.Path. Skipping this step of validation. Message: ${(m = v.message) !== null && m !== void 0 ? m : v.stack}`);
          }
          const d = (0, ll.parseDn)(c.SignerCertificate.Subject);
          let g = !1;
          for (const v of e) {
            const y = (0, ll.parseDn)(v);
            if (y.size ? g = Array.from(y.keys()).every((S) => y.get(S) === d.get(S)) : v === d.get("CN") && (r.warn(`Signature validated using only CN ${v}. Please add your full Distinguished Name (DN) to publisherNames configuration`), g = !0), g) {
              n(null);
              return;
            }
          }
        }
        const f = `publisherNames: ${e.join(" | ")}, raw info: ` + JSON.stringify(c, (d, g) => d === "RawData" ? void 0 : g, 2);
        r.warn(`Sign verification failed, installer signed with incorrect certificate: ${f}`), n(f);
      } catch (c) {
        eo(r, c, null, i), n(null);
        return;
      }
    });
  });
}
function Zw(e) {
  const t = JSON.parse(e);
  delete t.PrivateKey, delete t.IsOSBinary, delete t.SignatureType;
  const r = t.SignerCertificate;
  return r != null && (delete r.Archived, delete r.Extensions, delete r.Handle, delete r.HasPrivateKey, delete r.SubjectName), t;
}
function eo(e, t, r, n) {
  if (e_()) {
    e.warn(`Cannot execute Get-AuthenticodeSignature: ${t || r}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
    return;
  }
  try {
    (0, Ru.execFileSync)(...Ou("ConvertTo-Json test", 10 * 1e3));
  } catch (i) {
    e.warn(`Cannot execute ConvertTo-Json: ${i.message}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
    return;
  }
  t != null && n(t), r && n(new Error(`Cannot execute Get-AuthenticodeSignature, stderr: ${r}. Failing signature validation due to unknown stderr.`));
}
function e_() {
  const e = Jw.release();
  return e.startsWith("6.") && !e.startsWith("6.3");
}
Object.defineProperty(Ur, "__esModule", { value: !0 });
Ur.NsisUpdater = void 0;
const Sn = ce, ul = re, t_ = Ut, r_ = Kr, fl = vt, n_ = se, i_ = yt, o_ = Zo, dl = Et;
class a_ extends t_.BaseUpdater {
  constructor(t, r) {
    super(t, r), this._verifyUpdateCodeSignature = (n, i) => (0, o_.verifySignature)(n, i, this._logger);
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
    const r = t.updateInfoAndProvider.provider, n = (0, n_.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "exe");
    return this.executeDownload({
      fileExtension: "exe",
      downloadUpdateOptions: t,
      fileInfo: n,
      task: async (i, o, a, s) => {
        const l = n.packageInfo, m = l != null && a != null;
        if (m && t.disableWebInstaller)
          throw (0, Sn.newError)(`Unable to download new version ${t.updateInfoAndProvider.info.version}. Web Installers are disabled`, "ERR_UPDATER_WEB_INSTALLER_DISABLED");
        !m && !t.disableWebInstaller && this._logger.warn("disableWebInstaller is set to false, you should set it to true if you do not plan on using a web installer. This will default to true in a future version."), (m || t.disableDifferentialDownload || await this.differentialDownloadInstaller(n, t, i, r, Sn.CURRENT_APP_INSTALLER_FILE_NAME)) && await this.httpExecutor.download(n.url, i, o);
        const c = await this.verifySignature(i);
        if (c != null)
          throw await s(), (0, Sn.newError)(`New version ${t.updateInfoAndProvider.info.version} is not signed by the application owner: ${c}`, "ERR_UPDATER_INVALID_SIGNATURE");
        if (m && await this.differentialDownloadWebPackage(t, l, a, r))
          try {
            await this.httpExecutor.download(new dl.URL(l.path), a, {
              headers: t.requestHeaders,
              cancellationToken: t.cancellationToken,
              sha512: l.sha512
            });
          } catch (f) {
            try {
              await (0, i_.unlink)(a);
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
      this.spawnLog(ul.join(process.resourcesPath, "elevate.exe"), [r].concat(n)).catch((a) => this.dispatchError(a));
    };
    return t.isAdminRightsRequired ? (this._logger.info("isAdminRightsRequired is set to true, run installer using elevate.exe"), o(), !0) : (this.spawnLog(r, n).catch((a) => {
      const s = a.code;
      this._logger.info(`Cannot run installer: error code: ${s}, error message: "${a.message}", will be executed again using elevate if EACCES, and will try to use electron.shell.openItem if ENOENT`), s === "UNKNOWN" || s === "EACCES" ? o() : s === "ENOENT" ? $t.shell.openPath(r).catch((l) => this.dispatchError(l)) : this.dispatchError(a);
    }), !0);
  }
  async differentialDownloadWebPackage(t, r, n, i) {
    if (r.blockMapSize == null)
      return !0;
    try {
      const o = {
        newUrl: new dl.URL(r.path),
        oldFile: ul.join(this.downloadedUpdateHelper.cacheDir, Sn.CURRENT_APP_PACKAGE_FILE_NAME),
        logger: this._logger,
        newFile: n,
        requestHeaders: this.requestHeaders,
        isUseMultipleRangeRequest: i.isUseMultipleRangeRequest,
        cancellationToken: t.cancellationToken
      };
      this.listenerCount(fl.DOWNLOAD_PROGRESS) > 0 && (o.onProgress = (a) => this.emit(fl.DOWNLOAD_PROGRESS, a)), await new r_.FileWithEmbeddedBlockMapDifferentialDownloader(r, this.httpExecutor, o).download();
    } catch (o) {
      return this._logger.error(`Cannot download differentially, fallback to full download: ${o.stack || o}`), process.platform === "win32";
    }
    return !1;
  }
}
Ur.NsisUpdater = a_;
(function(e) {
  var t = Te && Te.__createBinding || (Object.create ? function(A, S, T, D) {
    D === void 0 && (D = T);
    var x = Object.getOwnPropertyDescriptor(S, T);
    (!x || ("get" in x ? !S.__esModule : x.writable || x.configurable)) && (x = { enumerable: !0, get: function() {
      return S[T];
    } }), Object.defineProperty(A, D, x);
  } : function(A, S, T, D) {
    D === void 0 && (D = T), A[D] = S[T];
  }), r = Te && Te.__exportStar || function(A, S) {
    for (var T in A) T !== "default" && !Object.prototype.hasOwnProperty.call(S, T) && t(S, A, T);
  };
  Object.defineProperty(e, "__esModule", { value: !0 }), e.NsisUpdater = e.MacUpdater = e.RpmUpdater = e.PacmanUpdater = e.DebUpdater = e.AppImageUpdater = e.Provider = e.NoOpLogger = e.AppUpdater = e.BaseUpdater = void 0;
  const n = yt, i = re;
  var o = Ut;
  Object.defineProperty(e, "BaseUpdater", { enumerable: !0, get: function() {
    return o.BaseUpdater;
  } });
  var a = ft;
  Object.defineProperty(e, "AppUpdater", { enumerable: !0, get: function() {
    return a.AppUpdater;
  } }), Object.defineProperty(e, "NoOpLogger", { enumerable: !0, get: function() {
    return a.NoOpLogger;
  } });
  var s = se;
  Object.defineProperty(e, "Provider", { enumerable: !0, get: function() {
    return s.Provider;
  } });
  var l = Dr;
  Object.defineProperty(e, "AppImageUpdater", { enumerable: !0, get: function() {
    return l.AppImageUpdater;
  } });
  var m = $r;
  Object.defineProperty(e, "DebUpdater", { enumerable: !0, get: function() {
    return m.DebUpdater;
  } });
  var c = Fr;
  Object.defineProperty(e, "PacmanUpdater", { enumerable: !0, get: function() {
    return c.PacmanUpdater;
  } });
  var f = xr;
  Object.defineProperty(e, "RpmUpdater", { enumerable: !0, get: function() {
    return f.RpmUpdater;
  } });
  var d = Lr;
  Object.defineProperty(e, "MacUpdater", { enumerable: !0, get: function() {
    return d.MacUpdater;
  } });
  var g = Ur;
  Object.defineProperty(e, "NsisUpdater", { enumerable: !0, get: function() {
    return g.NsisUpdater;
  } }), r(vt, e);
  let v;
  function y() {
    if (process.platform === "win32")
      v = new Ur.NsisUpdater();
    else if (process.platform === "darwin")
      v = new Lr.MacUpdater();
    else {
      v = new Dr.AppImageUpdater();
      try {
        const A = i.join(process.resourcesPath, "package-type");
        if (!(0, n.existsSync)(A))
          return v;
        switch ((0, n.readFileSync)(A).toString().trim()) {
          case "deb":
            v = new $r.DebUpdater();
            break;
          case "rpm":
            v = new xr.RpmUpdater();
            break;
          case "pacman":
            v = new Fr.PacmanUpdater();
            break;
          default:
            break;
        }
      } catch (A) {
        console.warn("Unable to detect 'package-type' for autoUpdater (rpm/deb/pacman support). If you'd like to expand support, please consider contributing to electron-builder", A.message);
      }
    }
    return v;
  }
  Object.defineProperty(e, "autoUpdater", {
    enumerable: !0,
    get: () => v || y()
  });
})(yl);
xf(import.meta.url);
const Iu = ct.dirname(Lf(import.meta.url));
process.env.APP_ROOT = ct.join(Iu, "..");
const yo = process.env.VITE_DEV_SERVER_URL, C_ = ct.join(process.env.APP_ROOT, "dist-electron"), Pu = ct.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = yo ? ct.join(process.env.APP_ROOT, "public") : Pu;
let In = null;
function Nu() {
  In = new hl({
    icon: ct.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    title: "Lyceum",
    width: 1200,
    height: 800,
    webPreferences: {
      preload: ct.join(Iu, "preload.mjs")
    },
    autoHideMenuBar: !0
  }), yo ? In.loadURL(yo) : In.loadFile(ct.join(Pu, "index.html"));
}
Pn.whenReady().then(() => {
  yl.autoUpdater.checkForUpdatesAndNotify(), Nu();
});
Pn.on("window-all-closed", () => {
  process.platform !== "darwin" && (Pn.quit(), In = null);
});
Pn.on("activate", () => {
  hl.getAllWindows().length === 0 && Nu();
});
export {
  C_ as MAIN_DIST,
  Pu as RENDERER_DIST,
  yo as VITE_DEV_SERVER_URL
};
