// src/services/creem.js — Creem API 封装
const crypto = require('crypto');
const axios = require('axios');
const { CREEM_API_KEY, CREEM_API_BASE_URL } = require('../config');
const { logToFile } = require('../utils/logger');

const api = axios.create({
  baseURL: CREEM_API_BASE_URL,
  headers: {
    'x-api-key': CREEM_API_KEY,
    'Content-Type': 'application/json',
  },
});

// ── Checkout ────────────────────────────────────────────

/**
 * 创建 Checkout 会话
 * @param {object} opts
 * @param {string} opts.productId
 * @param {string} opts.successUrl
 * @param {string} opts.cancelUrl
 * @param {object} [opts.metadata]
 * @returns {Promise<{checkout_url: string, id: string}>}
 */
async function createCheckout({ productId, successUrl, cancelUrl, metadata }) {
  const requestId = `checkout_${Date.now()}`;
  const { data } = await api.post('/v1/checkouts', {
    product_id: productId,
    request_id: requestId,
    metadata: metadata || {},
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  logToFile('Creem checkout created', { checkout_id: data.id, request_id: requestId }, 'SUCCESS');
  return data;
}

/**
 * 查询 Checkout 状态
 */
async function getCheckout(checkoutId) {
  const { data } = await api.get(`/v1/checkouts/${checkoutId}`);
  return data;
}

// ── 签名验证 ────────────────────────────────────────────

/**
 * 验证 Webhook 签名 (HMAC-SHA256)
 */
function verifyWebhookSignature(payload, signature, secret) {
  const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return computed === signature;
}

/**
 * 验证重定向签名 (SHA256)
 */
function verifyRedirectSignature(params, signature, apiKey) {
  const { checkout_id, order_id, customer_id, subscription_id, product_id, request_id } = params;
  const data = [
    `checkout_id=${checkout_id || ''}`,
    `order_id=${order_id || ''}`,
    `customer_id=${customer_id || ''}`,
    `subscription_id=${subscription_id || ''}`,
    `product_id=${product_id || ''}`,
    `request_id=${request_id || ''}`,
    `salt=${apiKey}`,
  ].join('|');
  const computed = crypto.createHash('sha256').update(data).digest('hex');
  return computed === signature;
}

module.exports = {
  createCheckout,
  getCheckout,
  verifyWebhookSignature,
  verifyRedirectSignature,
};
