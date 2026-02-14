import { verifyTreeAccess } from '../utils/treeAccess.js';

/**
 * Middleware factory that verifies tree membership and minimum role.
 * Extracts treeId from req.params[paramName], verifies access, attaches req.treeMembership.
 * @param {'viewer'|'editor'|'owner'} minRole - Minimum required role
 * @param {string} paramName - Name of the URL param containing tree ID (default: 'id')
 * @returns {Function} Express middleware
 */
export function requireTreeRole(minRole = 'viewer', paramName = 'id') {
  return async (req, _res, next) => {
    try {
      const treeId = req.params[paramName];
      const membership = await verifyTreeAccess(treeId, req.user.userId, minRole);
      req.treeMembership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}
