"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindingSource = exports.FindingSeverity = void 0;
exports.FindingSeverity = {
    CRITICAL: 'CRITICAL',
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
    INFO: 'INFO',
};
exports.FindingSource = {
    SAST: 'SAST',
    DAST: 'DAST',
    SECRETS: 'SECRETS',
    DEPS: 'DEPS',
};
