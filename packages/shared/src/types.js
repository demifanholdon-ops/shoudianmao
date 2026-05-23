/**
 * @file types.js · 跨包共享的 JSDoc 类型定义
 */

/**
 * @typedef {Object} ShopSnapshot
 * @property {string} [storeName]
 * @property {string} [date]
 * @property {number} revenue
 * @property {number} [revenueYesterday]
 * @property {number} [visitors]
 * @property {number} [visitorsYesterday]
 * @property {number} [orders]
 * @property {number} [ordersYesterday]
 * @property {string} [conversionRate]
 * @property {string} [conversionRateYesterday]
 * @property {number} [avgPrice]
 * @property {number} [avgPriceYesterday]
 * @property {number} [buyers]
 * @property {number} [experienceScore]
 * @property {number} [qualityScore]
 * @property {number} [logisticsScore]
 * @property {number} [serviceScore]
 * @property {number} [pendingShip]
 * @property {number} [pendingAfterSale]
 * @property {number} [pendingBadReview]
 * @property {number} [pendingComplaint]
 * @property {number} [violations]
 * @property {string[]} [platformAlerts]
 */

/**
 * @typedef {Object} Alert
 * @property {string} text
 * @property {'high'|'medium'|'low'} [severity]
 * @property {string} [suggestion]
 * @property {string} [rule]
 */

/**
 * @typedef {Object} CatState
 * @property {'prosperity'|'heartbreak'|'urgent'|'overload'|'idle'} id
 * @property {string} label
 * @property {string} frame
 * @property {string} emoji
 */

export {};
