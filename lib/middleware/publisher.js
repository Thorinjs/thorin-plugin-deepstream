'use strict';
/**
 * The emitter middleware will essentially emit
 * the actionType and result (error/success)
 * to the deepstream server
 */
module.exports = (thorin, opt, pluginObj) => {
  const logger = thorin.logger(opt.logger),
    dispatcher = thorin.dispatcher;

  /*
   * Registers the middleware that will emit
   * the action name to the deepstream server, via publishing
   * */
  dispatcher
    .addMiddleware('deepstream#publish')
    .use((intentObj, next, opt) => {
      opt = Object.assign({}, {
        namespace: 'action#',
        success: true,
        error: false
      }, opt);
      intentObj.data('__deepstreamPublish', opt);
      next();
    })
    .end((intentObj) => {
      let opt = intentObj.data('__deepstreamPublish');
      if (intentObj.hasError() && !opt.error) return;
      if (!intentObj.hasError() && !opt.success) return;
      let data = (intentObj.hasError() ? intentObj.error() : intentObj.result()),
        eventName = opt.namespace + intentObj.action;
      pluginObj.trigger(eventName, data);
    });
};