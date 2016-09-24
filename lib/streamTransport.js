'use strict';
/**
 * The Stream transport that extends thorin transport
 */
module.exports = (thorin, opt, pluginObj) => {

  const streamClient = pluginObj.client,
    logger = thorin.logger(opt.logger),
    providers = Symbol();
  let requestId = 1;
  const RPC_DATA = thorin.error('STREAM.DATA', 'Invalid or missing payload data'),
    RPC_AUTH = thorin.error('STREAM.AUTH', 'Invalid or missing authorization token');

  class DeepstreamTransport extends thorin.Interface.Transport {
    static publicName() {
      return "deepstream";
    }

    constructor() {
      super();
      this.name = "deepstream";
      this.type = 2;
      this[providers] = {};
    }

    onRpcHandler(routeId, actionObj, data, res) {
      try {
        res.ack();
      } catch (e) {
      }
      if (typeof data !== 'object' || !data || typeof data.type !== 'string' || !data.type) {
        return sendError(res, RPC_DATA);
      }
      if (opt.token && !pluginObj.verify(data.token, data.type)) {
        return sendError(res, RPC_AUTH);
      }
      let actionId = requestId++;
      if (actionObj.hasDebug !== false && opt.debug && thorin.env !== 'production') {
        logger.trace(`[START ${actionId}] - ${data.type}`);
      }
      const intentObj = new thorin.Intent(data.type, data.payload, (wasError, result, intentObj) => {
        let took = intentObj.took,
          err, isCustomErr = false;
        if (wasError) {
          err = (typeof result === 'object' && result.error ? result.error : result);
          if (err instanceof Error && err.name.indexOf('Thorin') === 0) {
            err = result.error;
          } else {
            err = thorin.error(result.error || result);
          }
          if(err && err.source) isCustomErr = true;
        }
        if (actionObj.hasDebug !== false && opt.debug) {
          if (wasError) {
            let msg = `[ENDED ${actionId} - ${result.type} [${err.code}]`;
            if(typeof err.statusCode !== 'undefined') {
              msg += ` - ${err.statusCode}`;
            }
            msg += ` (${took}ms)`;
            logger[err.statusCode < 500 ? 'trace' : 'warn'](msg);
            if(isCustomErr) {
              logger.trace(err.source.stack);
            }
          } else {
            logger.debug(`[ENDED ${actionId}] - ${result.type} (${took}ms)`)
          }
        }
        if (wasError) return sendError(res, err);
        sendResponse(res, result);
      });
      intentObj._setAuthorization('DEEPSTREAM', data.token || 'NOAUTH');
      intentObj.transport = 'deepstream';
      thorin.dispatcher.triggerIntent(intentObj);
    }

    routeAction(actionObj) {
      let shouldAdd = false;
      /* check authorization */
      if (opt.checkAuthorization) {
        for (let i = 0; i < actionObj.stack.length; i++) {
          let item = actionObj.stack[i];
          if (item.type !== 'authorize') continue;
          if (item.name === 'deepstream#proxy') {
            shouldAdd = true;
            break;
          }
        }
      } else {
        shouldAdd = true;
      }
      if (!shouldAdd) return;
      let rpcName = opt.app + ':' + actionObj.name;
      if (this[providers][rpcName]) return;
      try {
        let rpcFn = this.onRpcHandler.bind(this, rpcName, actionObj);
        streamClient.rpc.provide(rpcName, rpcFn);
        this[providers][rpcName] = rpcFn;
      } catch (e) {
        logger.warn(`Encountered an error while providing RPC for ${rpcName}`);
        logger.debug(e);
      }
    }

    disableAction(actionName) {
      let rpcName = opt.app + ':' + actionName;
      if (!this[providers][rpcName]) return;
      try {
        streamClient.rpc.unprovide(actionName);
      } catch (e) {
      }
    }

    enableAction(actionName) {
      let rpcName = opt.app + ':' + actionName;
      if (!this[providers][rpcName]) return;
      try {
        streamClient.rpc.provide(rpcName, this[providers][rpcName]);
      } catch (e) {
      }
    }
  }

  function sendError(res, err) {
    let data = {
      error: err
    };
    try {
      data = JSON.stringify(data);
    } catch (e) {
      logger.warn(`Could not send error:`, err);
      logger.debug(e);
      return;
    }
    try {
      res.send(data);
    } catch (e) {
    }
  }

  function sendResponse(res, payload) {
    let data = {
      data: payload
    };
    try {
      data = JSON.stringify(data);
    } catch (e) {
      logger.warn(`Could not send response:`, data);
      logger.debug(e);
      return;
    }
    try {
      res.send(data);
    } catch (e) {
    }
  }


  return new DeepstreamTransport();
};