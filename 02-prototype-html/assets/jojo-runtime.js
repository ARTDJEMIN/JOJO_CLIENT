/*
 * jojo-runtime.js — moteur de rendu autonome des maquettes Jojo Client.
 * Lit le gabarit <x-dc> d'une page, le composant `class Component extends DCLogic`
 * et rend l'écran dans le navigateur, sans dépendance.
 * Gère : {{trous}}, <sc-for>, <sc-if>, onClick / onChange, setState, liens entre écrans.
 * Les props par défaut (data-props) peuvent être surchargées dans l'URL : ?hasRequest=true
 */
(function () {
  'use strict';

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch) {
    var next = typeof patch === 'function' ? patch(this.state, this.props) : patch;
    this.state = Object.assign({}, this.state, next);
    if (this.__rerender) this.__rerender();
  };
  DCLogic.prototype.forceUpdate = function () { if (this.__rerender) this.__rerender(); };
  DCLogic.prototype.renderVals = function () { return {}; };

  var HOLE_WHOLE = /^\s*\{\{\s*([^{}]+?)\s*\}\}\s*$/;
  var HOLE_ANY = /\{\{\s*([^{}]+?)\s*\}\}/g;
  var EVENTS = { onclick: 'click', onchange: 'input', oninput: 'input', onsubmit: 'submit', onkeydown: 'keydown', onfocus: 'focus', onblur: 'blur' };
  var BOOL_ATTRS = { disabled: 1, checked: 1, selected: 1, hidden: 1, readonly: 1, required: 1 };

  function resolve(expr, scope) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    if (/^'.*'$|^".*"$/.test(expr)) return expr.slice(1, -1);
    var parts = expr.split('.');
    var cur = scope;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function toText(v) { return v == null ? '' : String(v); }

  function interpolate(str, scope) {
    return str.replace(HOLE_ANY, function (_, e) { return toText(resolve(e, scope)); });
  }

  function fixHref(v) {
    if (typeof v !== 'string') return v;
    return v.replace(/\.dc\.html(?=($|[?#]))/, '.html');
  }

  function renderNodes(nodes, scope, out) {
    for (var i = 0; i < nodes.length; i++) renderNode(nodes[i], scope, out);
    return out;
  }

  function renderNode(node, scope, out) {
    if (node.nodeType === 3) {
      out.push(document.createTextNode(interpolate(node.nodeValue, scope)));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'helmet') return;
    if (tag === 'sc-for') {
      var list = resolve((node.getAttribute('list') || '').replace(HOLE_WHOLE, '$1'), scope) || [];
      var as = node.getAttribute('as') || 'item';
      for (var k = 0; k < list.length; k++) {
        var child = Object.create(scope);
        child[as] = list[k];
        child.$index = k;
        renderNodes(node.childNodes, child, out);
      }
      return;
    }
    if (tag === 'sc-if') {
      var raw = node.getAttribute('value') || '';
      var m = raw.match(HOLE_WHOLE);
      var val = m ? resolve(m[1], scope) : raw;
      if (val) renderNodes(node.childNodes, scope, out);
      return;
    }
    var el = node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/1999/xhtml'
      ? document.createElementNS(node.namespaceURI, node.tagName)
      : document.createElement(node.tagName);
    var attrs = node.attributes;
    for (var a = 0; a < attrs.length; a++) {
      var name = attrs[a].name, value = attrs[a].value, lname = name.toLowerCase();
      if (lname.indexOf('hint-') === 0) continue;
      var whole = value.match(HOLE_WHOLE);
      if (EVENTS[lname]) {
        if (whole) {
          var fn = resolve(whole[1], scope);
          if (typeof fn === 'function') el.addEventListener(EVENTS[lname], fn);
        }
        continue;
      }
      var v = whole ? resolve(whole[1], scope) : (value.indexOf('{{') >= 0 ? interpolate(value, scope) : value);
      if (BOOL_ATTRS[lname]) {
        if (whole) { if (v === true || v === 'true') el.setAttribute(name, ''); }
        else el.setAttribute(name, value);
        continue;
      }
      if (v === undefined || v === null || v === false) continue;
      if (lname === 'href') v = fixHref(v);
      try { el.setAttribute(name, toText(v)); } catch (e) { /* attribut invalide ignoré */ }
      if (lname === 'value' && 'value' in el) el.value = toText(v);
    }
    var kids = renderNodes(node.childNodes, scope, []);
    var host = el.localName === 'template' ? el.content : el;
    for (var c = 0; c < kids.length; c++) host.appendChild(kids[c]);
    out.push(el);
  }

  function pathOf(el, root) {
    var path = [];
    while (el && el !== root) {
      var p = el.parentNode, i = 0;
      if (!p) return null;
      for (var n = p.firstElementChild; n && n !== el; n = n.nextElementSibling) i++;
      path.unshift(i);
      el = p;
    }
    return path;
  }
  function byPath(root, path) {
    var el = root;
    for (var i = 0; el && i < path.length; i++) {
      var n = el.firstElementChild;
      for (var j = 0; n && j < path[i]; j++) n = n.nextElementSibling;
      el = n;
    }
    return el;
  }

  function boot() {
    var xdc = document.querySelector('x-dc');
    var scriptEl = document.querySelector('script[data-dc-script]');
    if (!xdc || !scriptEl) return;

    var helmet = xdc.querySelector('helmet');
    if (helmet) {
      Array.prototype.slice.call(helmet.children).forEach(function (n) { document.head.appendChild(n.cloneNode(true)); });
    }
    var frame = document.createElement('style');
    frame.textContent = 'html{background:#E7E1DA}body{margin:0;min-height:100vh;display:flex;justify-content:center;align-items:flex-start}' +
      '#dc-root{margin:24px 0;border-radius:36px;overflow:hidden;box-shadow:0 20px 60px rgba(27,23,20,.18);background:#FCF4EE}' +
      '@media (max-width:480px){#dc-root{margin:0;border-radius:0;box-shadow:none}}';
    document.head.appendChild(frame);

    var template = Array.prototype.slice.call(xdc.childNodes);
    var root = document.createElement('div');
    root.id = 'dc-root';
    xdc.parentNode.replaceChild(root, xdc);

    var propsSpec = {};
    try { propsSpec = JSON.parse(scriptEl.getAttribute('data-props') || '{}'); } catch (e) { propsSpec = {}; }
    var props = {};
    Object.keys(propsSpec).forEach(function (k) {
      if (k.charAt(0) !== '$' && propsSpec[k] && 'default' in propsSpec[k]) props[k] = propsSpec[k]['default'];
    });
    new URLSearchParams(location.search).forEach(function (v, k) {
      props[k] = v === 'true' ? true : v === 'false' ? false : (isNaN(Number(v)) ? v : Number(v));
    });

    var Component = new Function('DCLogic', scriptEl.textContent + '\n;return Component;')(DCLogic);
    var inst = new Component(props);
    if (!inst.props) inst.props = props;
    if (!inst.state) inst.state = {};

    function draw() {
      var scrolls = [];
      root.querySelectorAll('*').forEach(function (n) { if (n.scrollTop || n.scrollLeft) scrolls.push([pathOf(n, root), n.scrollTop, n.scrollLeft]); });
      var active = document.activeElement && root.contains(document.activeElement) ? pathOf(document.activeElement, root) : null;
      var caret = active && document.activeElement.selectionStart != null ? document.activeElement.selectionStart : null;

      var vals = inst.renderVals() || {};
      var nodes = renderNodes(template, vals, []);
      root.textContent = '';
      nodes.forEach(function (n) { root.appendChild(n); });

      scrolls.forEach(function (s) { var n = s[0] && byPath(root, s[0]); if (n) { n.scrollTop = s[1]; n.scrollLeft = s[2]; } });
      if (active) {
        var f = byPath(root, active);
        if (f && f.focus) { f.focus(); if (caret != null && f.setSelectionRange) try { f.setSelectionRange(caret, caret); } catch (e) {} }
      }
    }
    inst.__rerender = draw;
    draw();
    if (typeof inst.componentDidMount === 'function') inst.componentDidMount();
  }

  window.DCLogic = DCLogic;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
