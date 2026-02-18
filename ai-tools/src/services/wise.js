// src/services/wise.js — Wise API 封装（转账 / 提现）
const axios = require('axios');
const crypto = require('crypto');
const { WISE_API_TOKEN, WISE_PROFILE_ID, WISE_API_BASE_URL } = require('../config');
const { logToFile } = require('../utils/logger');

const api = axios.create({
  baseURL: WISE_API_BASE_URL,
  headers: {
    Authorization: `Bearer ${WISE_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// ── Profile ─────────────────────────────────────────────

/**
 * 获取 Wise profiles
 * @returns {Promise<Array>}
 */
async function getProfiles() {
  const { data } = await api.get('/v1/profiles');
  return data;
}

/**
 * 获取指定 profile（默认使用环境变量中的 ID）
 */
async function getProfile(profileId) {
  const id = profileId || WISE_PROFILE_ID;
  const { data } = await api.get(`/v1/profiles/${id}`);
  return data;
}

// ── Balance ─────────────────────────────────────────────

/**
 * 获取 profile 下所有余额
 * @param {number|string} [profileId]
 * @returns {Promise<Array>}  每项含 { id, currency, amount: { value, currency }, ... }
 */
async function getBalances(profileId) {
  const id = profileId || WISE_PROFILE_ID;
  const { data } = await api.get(`/v4/profiles/${id}/balances?types=STANDARD`);
  return data;
}

// ── Quote ───────────────────────────────────────────────

/**
 * 创建报价
 * @param {object} opts
 * @param {number} opts.sourceAmount   发送金额
 * @param {string} opts.sourceCurrency 发送币种（如 USD）
 * @param {string} opts.targetCurrency 接收币种（如 CNY）
 * @param {number|string} [opts.profileId]
 * @returns {Promise<object>} quote 对象（含 id, rate, fee 等）
 */
async function createQuote({ sourceAmount, sourceCurrency, targetCurrency, profileId }) {
  const id = profileId || WISE_PROFILE_ID;
  const { data } = await api.post('/v3/profiles/' + id + '/quotes', {
    sourceCurrency,
    targetCurrency,
    sourceAmount,
    targetAmount: null,
    payOut: 'BANK_TRANSFER',
  });
  logToFile('Wise quote created', {
    quoteId: data.id,
    rate: data.rate,
    sourceCurrency,
    targetCurrency,
    sourceAmount,
  }, 'SUCCESS');
  return data;
}

// ── Recipient ───────────────────────────────────────────

/**
 * 创建收款人
 * @param {object} opts
 * @param {string} opts.currency         收款币种
 * @param {string} opts.type             收款类型 (e.g. "chinese_alipay", "chinese_card")
 * @param {string} opts.accountHolderName 收款人姓名
 * @param {object} opts.details          收款详情（各类型字段不同）
 * @param {number|string} [opts.profileId]
 */
async function createRecipient({ currency, type, accountHolderName, details, profileId }) {
  const id = profileId || WISE_PROFILE_ID;
  const { data } = await api.post('/v1/accounts', {
    profile: Number(id),
    currency,
    type,
    accountHolderName,
    details,
  });
  logToFile('Wise recipient created', { recipientId: data.id, currency, type }, 'SUCCESS');
  return data;
}

/**
 * 列出收款人
 */
async function listRecipients(profileId, currency) {
  const id = profileId || WISE_PROFILE_ID;
  let url = `/v1/accounts?profile=${id}`;
  if (currency) url += `&currency=${currency}`;
  const { data } = await api.get(url);
  return data;
}

// ── Transfer ────────────────────────────────────────────

/**
 * 创建转账
 * @param {object} opts
 * @param {string} opts.quoteUuid        报价 UUID
 * @param {number} opts.targetAccount    收款人 ID
 * @param {string} [opts.reference]      备注
 * @returns {Promise<object>}
 */
async function createTransfer({ quoteUuid, targetAccount, reference }) {
  const customerTransactionId = crypto.randomUUID();
  const { data } = await api.post('/v1/transfers', {
    targetAccount,
    quoteUuid,
    customerTransactionId,
    details: {
      reference: reference || 'ai-tools payout',
      transferPurpose: 'verification.transfers.purpose.pay.bills',
      sourceOfFunds: 'verification.source.of.funds.other',
    },
  });
  logToFile('Wise transfer created', {
    transferId: data.id,
    status: data.status,
    sourceValue: data.sourceValue,
    targetValue: data.targetValue,
  }, 'SUCCESS');
  return data;
}

/**
 * 用余额资金付款（fund transfer）
 * @param {number} transferId
 * @param {number|string} [profileId]
 */
async function fundTransfer(transferId, profileId) {
  const id = profileId || WISE_PROFILE_ID;
  const { data } = await api.post(
    `/v3/profiles/${id}/transfers/${transferId}/payments`,
    { type: 'BALANCE' }
  );
  logToFile('Wise transfer funded', { transferId, status: data.status }, 'SUCCESS');
  return data;
}

/**
 * 查询转账状态
 */
async function getTransfer(transferId) {
  const { data } = await api.get(`/v1/transfers/${transferId}`);
  return data;
}

module.exports = {
  getProfiles,
  getProfile,
  getBalances,
  createQuote,
  createRecipient,
  listRecipients,
  createTransfer,
  fundTransfer,
  getTransfer,
};
