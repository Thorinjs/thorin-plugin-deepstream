'use strict';
const crypto = require('crypto'),
  DEFAULT_ALG = 'sha1',
  DEFAULT_PREFIX = 'D',
  DEFAULT_TIMEOUT = 60000;  // token expires in 1min
/**
 * The security functionality will sign and verify
 * authorization tokens for a better communication
 * between service nodes.
 */
module.exports.TOKEN = null;  // this is set in index.js

/**
 * Currently, when we "sign" the signature, we only
 * sha2 the actionName + ts + {service.name?optional} + {service.type?optional}
 * */
module.exports.sign = function SignPayload(actionType) {
  if (typeof module.exports.TOKEN !== 'string') return false;
  let expireAt = Date.now() + DEFAULT_TIMEOUT,
    hashString = actionType + expireAt.toString();
  let hashValue = crypto.createHmac(DEFAULT_ALG, module.exports.TOKEN)
    .update(hashString)
    .digest('hex');
  let publicStr = new Buffer(expireAt.toString(), 'ascii').toString('hex');
  return DEFAULT_PREFIX + hashValue + '$' + publicStr;
};

module.exports.verify = function VerifyPayload(token, actionName) {
  if (typeof module.exports.TOKEN !== 'string') return true;
  if (typeof token !== 'string' || !token) return false;
  if (typeof actionName !== 'string' || !actionName) return false;
  if (token.substr(0, DEFAULT_PREFIX.length) !== DEFAULT_PREFIX) return false;
  let expireAt = token.split('$')[1],
    now = Date.now();
  if (typeof expireAt !== 'string' || !expireAt) return false;
  try {
    let tmp = new Buffer(expireAt, 'hex').toString('ascii');
    expireAt = parseInt(tmp);
    if (typeof expireAt !== 'number') throw 1;
    if (now >= expireAt) throw 1;  // expired.
  } catch (e) {
    return false;
  }
  // re-construct the hash and verify it.
  token = token.substr(DEFAULT_PREFIX.length).split('$')[0];
  let hashString = actionName + expireAt.toString();
  let hashValue = crypto.createHmac(DEFAULT_ALG, module.exports.TOKEN)
    .update(hashString)
    .digest('hex');
  if (hashValue !== token) return false;
  return true;
};
