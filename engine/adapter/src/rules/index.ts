import { SecurityRule } from './types.js';
import { sastRules } from './sastRules.js';
import { secretRules } from './secretRules.js';
import { configRules } from './configRules.js';
import { dependencyRules } from './dependencyRules.js';

export * from './types.js';
export * from './sastRules.js';
export * from './secretRules.js';
export * from './configRules.js';
export * from './dependencyRules.js';

export const ALL_SECURITY_RULES: SecurityRule[] = [
  ...sastRules,
  ...secretRules,
  ...configRules,
  ...dependencyRules,
];
