'use strict';
/**
 * This creates an authorization middleware that will check that the incoming
 * request is made by a microservice within the cluster. We perform the check by checking
 * the authorization token
 */
module.exports = function (thorin, opt, pluginObj) {
  const logger = thorin.logger(opt.logger),
    security = require('../security'),
    dispatcher = thorin.dispatcher;
  

  /*
   * All you need to do in your actions is to add
   *   .authorization('deepstream#proxy')
   * and all the incoming requests will be filtered by this.
   * */
  const PROXY_ERROR = thorin.error('DEEPSTREAM.PROXY', 'Request not authorized.', 403);
  dispatcher
    .addAuthorization('deepstream#proxy')
    .use((intentObj, next) => {
      const tokenType = intentObj.authorizationSource,
        accessToken = intentObj.authorization;
      if(intentObj.transport !== 'deepstream') return next(PROXY_ERROR);

      if (tokenType !== 'DEEPSTREAM') return next(PROXY_ERROR);
      if(!opt.token) return next();
      if(!pluginObj.verifyToken(accessToken, intentObj.action)) {
        logger.warn(`Received invalid deepstream proxy request for ${intentObj.action}`);
        logger.warn(intentObj.rawInput, tokenType, accessToken);
        return next(PROXY_ERROR);
      }
      next();
    });
};