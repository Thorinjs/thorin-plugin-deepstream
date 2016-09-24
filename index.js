'use strict';
/**
 * Deepstream.io RPC communication chasee for microservices.
 */
const initAction = require('./lib/streamAction'),
  initMiddleware = require('./lib/middleware/index'),
  initApi = require('./lib/streamApi'),
  initBoot = require('./lib/boot');
module.exports = function (thorin, opt, pluginName) {
  opt = thorin.util.extend({
    logger: pluginName || 'deepstream',
    timeout: 3000,                          // the default timeout between service calls
    token: null,                // the shared security token to use as authorization.
    host: null,                 // the deepstream server host + port
    port: 6021,                 // by default we use the TCP connection
    auth: {
      username: thorin.id
    },                    // login information for the deepstream server Leave blank if no auth is required
    app: thorin.app,          // the prefix of our RPC calls The pattern will be {appName}:{actionName}
    checkAuthorization: true, // if set to false, we will add all actions, not only those with deepstream#proxy authorization
    debug: true,
    options: {
      rpcResponseTimeout: 40000
    }
  }, opt);
  const pluginObj = {};

  initBoot(thorin, opt, pluginObj);
  initApi(thorin, opt, pluginObj);
  initAction(thorin, opt, pluginObj);
  initMiddleware(thorin, opt, pluginObj);
  return pluginObj;
};
module.exports.publicName = 'deepstream';