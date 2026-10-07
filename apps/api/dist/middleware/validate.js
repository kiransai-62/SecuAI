"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
exports.validateParams = validateParams;
const zod_1 = require("zod");
function validateBody(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
                res.status(400).json({ error: 'Validation failed', details: err.errors });
                return;
            }
            res.status(400).json({ error: 'Invalid input payload' });
        }
    };
}
function validateParams(schema) {
    return (req, res, next) => {
        try {
            req.params = schema.parse(req.params);
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
                res.status(400).json({ error: 'Validation failed', details: err.errors });
                return;
            }
            res.status(400).json({ error: 'Invalid route parameters' });
        }
    };
}
