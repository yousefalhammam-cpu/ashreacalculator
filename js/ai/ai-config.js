(function (root) {
  'use strict';

  var location = root.location || {};
  var host = String(location.hostname || '').toLowerCase();
  var isLocalHttp = (location.protocol === 'http:' || location.protocol === 'https:') &&
    (host === '127.0.0.1' || host === 'localhost' || host === '::1');

  root.AirCalcAIConfig = Object.assign({}, root.AirCalcAIConfig || {}, {
    explanationEndpoint: isLocalHttp ? '/api/ai/explain' : '',
    mode: isLocalHttp ? 'local_backend' : 'disabled',
    timeoutMs: isLocalHttp ? 150000 : 6000
  });
})(typeof window !== 'undefined' ? window : globalThis);
