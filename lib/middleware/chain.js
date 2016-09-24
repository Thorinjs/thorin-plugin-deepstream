'use strict';
/**
 * The emitter middleware will essentially
 * try and execute a RPC once the
 * current intent is completed (success/error)
 */
module.exports = (thorin, opt, pluginObj) => {
  const logger = thorin.logger(opt.logger),
    dispatcher = thorin.dispatcher;
  let chainId = 0;
  /*
   * Registers the middleware that will emit
   * the action name to the deepstream server, via publishing
   * */
  dispatcher
    .addMiddleware('deepstream#chain')
    .use((intentObj, next, opt) => {
      opt = Object.assign({}, {
        service: null,
        action: null,
        result: false,
        input: true
      }, opt);
      intentObj.__chainId = chainId;
      chainId++;
      intentObj.data(`__deepstreamChain${intentObj.__chainId}`, opt);
      next();
    })
    .end((intentObj) => {
      if (intentObj.hasError()) return;
      let opt = intentObj.data(`__deepstreamChain${intentObj.__chainId}`),
        data;
      if(!opt) return;
      if (!opt.service || !opt.action) {
        logger.warn(`Chain: for action ${intentObj.action} does not have a valid target service/action`);
        return;
      }
      if (opt.input === true && opt.result === false) {
        data = intentObj.input();
      } else if (opt.input === false && opt.result === true) {
        data = intentObj.result();
      } else {
        data = {};
        if (opt.input) {
          data.input = intentObj.input();
        }
        if (opt.result) data.result = intentObj.result();
      }
      pluginObj
        .dispatch(opt.service, opt.action, data)
        .catch((e) => {
          logger.warn(`Chain: failed to trigger ${opt.action} to service ${opt.service}`);
          logger.debug(e);
        });
    });
};