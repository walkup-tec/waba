"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCustomerCareWindow = resolveCustomerCareWindow;
const WINDOW_MS = 24 * 60 * 60 * 1000;
function resolveCustomerCareWindow(input) {
    const lastInboundAt = input.lastInboundAt ? String(input.lastInboundAt) : null;
    if (!lastInboundAt) {
        return { known: false, withinWindow: null, lastInboundAt: null, windowHours: 24 };
    }
    const last = Date.parse(lastInboundAt);
    if (!Number.isFinite(last)) {
        return { known: false, withinWindow: null, lastInboundAt, windowHours: 24 };
    }
    const now = (input.now || new Date()).getTime();
    return {
        known: true,
        withinWindow: now - last <= WINDOW_MS,
        lastInboundAt,
        windowHours: 24,
    };
}
