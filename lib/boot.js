'use strict';
const os = require('os'),
  deepstream = require('deepstream.io-client-js'),
  initTransport = require('./streamTransport');
/**
 * This will connect to the given deepstream server and add
 * register application actions as RPC-actions.
 * Thorin apps will then be able to trigger actions between them,
 * using the same shared key.
 *
 * NOTE:
 *  by default, we will register only actions
 *  that have the "deepstream#proxy" authorization endpoint.
 *  Since alot of actions rely on http headers and other things,
 *  we will only route those that explicitly say that they work only with action/payload
 */

const security = require('./security');
module.exports = function boot(thorin, opt, pluginObj) {
  const logger = thorin.logger(opt.logger);
  const uri = opt.host + ':' + opt.port;
  
  pluginObj.client = deepstream(uri, opt.options);
  /*
   * Register the run() function to connect to the server
   * */
  pluginObj.run = function (onDone) {
    if (!opt.host) return next(thorin.error('DEEPSTREAM.HOST', 'Missing deepstream server host'));
    if (!opt.port) return next(thorin.error('DEEPSTREAM.HOST', 'Missing deepstream port'));
    let wasCalled = false;
    if (opt.token) {
      security.TOKEN = opt.token;
    }
    function next(err) {
      if (err) return onDone(err);
      const streamTransportObj = initTransport(thorin, opt, pluginObj);
      thorin.dispatcher.registerTransport(streamTransportObj);
      onDone();
    }

    pluginObj.client.login(opt.auth || {}, (wasOk) => {
      if (!wasOk) {
        if (wasCalled) {
          logger.warn(`Deepstream connection could not be established`);
          return;
        }
        wasCalled = true;
        return next(thorin.error('DEEPSTREAM.CONNECTION', 'Deepstream connection could not be established'));
      }
      if (wasCalled) {
        logger.trace(`Reconnected to Deepstream`);
        return;
      }
      wasCalled = true;
      logger.trace(`Connected to Deepstream`);
      return next();
    });
    pluginObj.client.on('error', (e) => {
      if (!wasCalled) {
        wasCalled = true;
        logger.warn(`Deepstream encountered an error`);
        return next(e);
      }
      logger.warn(`Deepstream encountered an error`);
      logger.debug(e);
    });
  };


};