"use strict";
exports.__esModule = true;
exports.removeHeaders = exports.headersToRemove = void 0;
exports.headersToRemove = ['x-authenticated-scope', 'x-consumer-custom-id',
    'x-authenticated-userid', 'x-anonymous-consumer',
    'x-consumer-id', 'x-consumer-username'];
function removeHeaders(clientRequest, clientResponse) {
    var headers = clientRequest.headers;
    exports.headersToRemove.forEach(function (h) { return delete headers[h]; });
}
exports.removeHeaders = removeHeaders;
