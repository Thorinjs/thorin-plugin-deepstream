'use strict';
/**
 * This is the exposed API for the deepstream plugin
 */

const security = require('./security');
module.exports = (thorin, opt, pluginObj) => {
  const logger = thorin.logger(opt.logger);


  pluginObj.sign = security.sign;
  pluginObj.verifyToken = security.verify;

  pluginObj.isConnected = () => {
    if (!pluginObj.client) return false;
    let state = pluginObj.client.getConnectionState();
    return state === 'OPEN';
  };

  const STREAM_DATA = thorin.error('STREAM.DATA', 'Encountered unexpected result data');
  /**
   * Performs a request to the given service, using the action/payload specified.
   * Arguments:
   * serviceName - the service that we want to proxy the request.
   * actionName - the action we want to send to the server.
   * payload={} - the payload we want to send. This must be a key-value object.
   * */
  pluginObj.dispatch = function DispatchAction(serviceName, actionName, payload, _options) {
    if (typeof serviceName !== 'string' || !serviceName) {
      return Promise.reject(thorin.error('STREAM.DISPATCH', 'A valid service name is required.'));
    }
    if (typeof actionName !== 'string' || !actionName) {
      return Promise.reject(thorin.error('STREAM.DISPATCH', 'A valid action name is required.'));
    }
    if (typeof payload !== 'object' || !payload) payload = {};
    if (!pluginObj.isConnected()) {
      return Promise.reject(thorin.error('STREAM.DISPATCH', 'A connection could not be established'));
    }
    return new Promise((resolve, reject) => {
      try {
        let rpcName = serviceName + ':' + actionName;
        let data = {
          type: actionName,
          payload: payload
        };
        if (opt.token) {
          data.token = security.sign(actionName);
        }
        let d = Date.now();
        pluginObj.client.rpc.make(rpcName, data, (errCode, result) => {
          if (errCode) {
            let errMsg, errStatus;
            switch (errCode) {
              case 'NO_RPC_PROVIDER':
              case 'ACK_TIMEOUT':
              case 'RESPONSE_TIMEOUT':
                errCode = 'STREAM.UNAVAILABLE';
                errMsg = 'No service is currently available';
                errStatus = 502;
                break;
              default:
                errCode = 'STREAM.DISPATCH';
            }
            logger.warn(`Could not dispatch action ${actionName} to ${serviceName}: ${errCode}`);
            return reject(thorin.error(errCode, errMsg, errStatus));
          }
          if (typeof result !== 'string' || !result) {
            return reject(STREAM_DATA);
          }
          try {
            result = JSON.parse(result);
            if (typeof result !== 'object' || !result) throw 1;
          } catch (e) {
            return reject(STREAM_DATA);
          }
          if (typeof result.error !== 'undefined') { // got an error.
            let err = result.error;
            let tErr = thorin.error(err.code, err.message, err.status);
            if (err.ns) tErr.ns = err.ns;
            return reject(tErr);
          }
          if (typeof result.data !== 'object' || !result.data) {
            result.data = {};
          }
          return resolve(result.data);
        });
      } catch (e) {
        return reject(thorin.error('STREAM.DISPATCH', 'A connection could not be established', e));
      }
    });
  }

  /**
   * Triggers an event (publishes it ) to the deepstream cluster
   * NOTE: this is asynchronous.
   * */
  pluginObj.trigger = function triggerEvent(eventType, payload) {
    if(typeof eventType !== 'string' || !eventType) {
      logger.warn(`Event: ${eventType} is not a string.`);
      return false;
    }
    try {
      pluginObj.client.event.emit(eventType, payload || {});
      return true;
    } catch(e) {
      logger.warn(`Event: ${eventType} was not triggered, error encountered`);
      logger.debug(e);
      return false;
    }
  };

  /**
   * Wrapper over the subscribe/unsubscribe functionality
   * */
  pluginObj.subscribe = function subscribe(event) {
    try {
      pluginObj.client.event.subscribe.apply(pluginObj.client.event, arguments);
      return true;
    } catch(e) {
      logger.warn(`Subscribe: ${event} encountered an error`);
      logger.debug(e);
      return false;
    }
  };
  /**
  * Wrapper for unsubscribe
  * */
  pluginObj.unsubscribe = function unsubscribe(event) {
    try {
      pluginObj.client.event.unsubscribe.apply(pluginObj.client.event, arguments);
      return true;
    } catch(e) {
      logger.warn(`Unsubscribe: ${event} encountered an error`);
      logger.debug(e);
      return false;
    }
  }

};

