"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertTenantOwnership = assertTenantOwnership;
/**
 * STRICT SECURITY REQUIREMENT:
 * Return 404 (not 403) on other users' resources to prevent ID enumeration.
 */
function assertTenantOwnership(resource, currentUserId, res) {
    if (!resource || resource.user_id !== currentUserId) {
        res.status(404).json({ error: 'Resource not found' });
        return false;
    }
    return true;
}
