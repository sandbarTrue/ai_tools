// src/routes/payout.js — Wise 提现相关
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const wise = require('../services/wise');
const { recordPayout, updatePayoutStatus } = require('../services/payment');
const { logToFile } = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/payout/create
 * 发起提现（完整流程：Quote → Transfer → Fund）
 *
 * Body:
 *   amount          — 提现金额（源币种）
 *   sourceCurrency  — 源币种，默认 USD
 *   targetCurrency  — 目标币种，默认 CNY
 *   recipientId     — 收款人 ID（已有）
 *   reference       — 转账备注
 *
 * 如果不传 recipientId，需要先调用 POST /api/payout/recipient 创建收款人
 */
router.post('/api/payout/create', requireAuth, async (req, res) => {
  try {
    const {
      amount,
      sourceCurrency = 'USD',
      targetCurrency = 'CNY',
      recipientId,
      reference,
    } = req.body;

    if (!amount || !recipientId) {
      return res.status(400).json({ error: 'amount and recipientId are required' });
    }

    // 1. 创建报价
    const quote = await wise.createQuote({
      sourceAmount: Number(amount),
      sourceCurrency,
      targetCurrency,
    });

    // 2. 创建转账
    const transfer = await wise.createTransfer({
      quoteUuid: quote.id,
      targetAccount: Number(recipientId),
      reference,
    });

    // 3. 用余额付款
    const funding = await wise.fundTransfer(transfer.id);

    // 4. 写入数据库
    const db = req.app.get('db');
    const recordId = await recordPayout(db, {
      wiseTransferId: String(transfer.id),
      amount: Number(amount),
      sourceCurrency,
      targetCurrency,
      quoteId: quote.id,
      recipientId: String(recipientId),
      status: 'processing',
      metadata: { quote, transfer, funding },
    });

    res.json({
      success: true,
      transfer_id: transfer.id,
      record_id: recordId,
      status: transfer.status,
      rate: quote.rate,
      source: { amount: transfer.sourceValue, currency: transfer.sourceCurrency },
      target: { amount: transfer.targetValue, currency: transfer.targetCurrency },
    });
  } catch (err) {
    logToFile('Payout create failed', { error: err.message, response: err.response?.data }, 'ERROR');
    res.status(500).json({ error: 'Payout failed', details: err.message });
  }
});

/**
 * GET /api/payout/status/:id
 * 查询提现状态
 */
router.get('/api/payout/status/:id', requireAuth, async (req, res) => {
  try {
    const transfer = await wise.getTransfer(req.params.id);

    // 同步更新数据库状态
    const db = req.app.get('db');
    const statusMap = {
      incoming_payment_waiting: 'pending',
      incoming_payment_initiated: 'processing',
      processing: 'processing',
      funds_converted: 'processing',
      outgoing_payment_sent: 'processing',
      completed: 'completed', // 到这一步才算完成
      bounced_back: 'failed',
      cancelled: 'cancelled',
      funds_refunded: 'cancelled',
    };
    const dbStatus = statusMap[transfer.status] || 'processing';
    await updatePayoutStatus(db, String(transfer.id), dbStatus);

    res.json({
      success: true,
      transfer_id: transfer.id,
      status: transfer.status,
      db_status: dbStatus,
      source: { value: transfer.sourceValue, currency: transfer.sourceCurrency },
      target: { value: transfer.targetValue, currency: transfer.targetCurrency },
      rate: transfer.rate,
      created: transfer.created,
    });
  } catch (err) {
    logToFile('Payout status query failed', { error: err.message }, 'ERROR');
    res.status(500).json({ error: 'Failed to get payout status', details: err.message });
  }
});

/**
 * GET /api/payout/balance
 * 查询 Wise 余额
 */
router.get('/api/payout/balance', requireAuth, async (req, res) => {
  try {
    const balances = await wise.getBalances();
    const formatted = balances.map((b) => ({
      id: b.id,
      currency: b.currency,
      available: b.amount?.value,
      reserved: b.reservedAmount?.value,
      total: b.totalWorth?.value,
    }));
    res.json({ success: true, balances: formatted });
  } catch (err) {
    logToFile('Balance query failed', { error: err.message }, 'ERROR');
    res.status(500).json({ error: 'Failed to get balance', details: err.message });
  }
});

/**
 * POST /api/payout/recipient
 * 创建收款人
 *
 * Body:
 *   currency         — 收款币种 (e.g. CNY)
 *   type             — 收款类型 (e.g. chinese_alipay, chinese_card)
 *   accountHolderName — 收款人姓名
 *   details          — 各类型所需的具体字段
 */
router.post('/api/payout/recipient', requireAuth, async (req, res) => {
  try {
    const { currency, type, accountHolderName, details } = req.body;
    if (!currency || !type || !accountHolderName || !details) {
      return res.status(400).json({ error: 'currency, type, accountHolderName, details are required' });
    }
    const recipient = await wise.createRecipient({ currency, type, accountHolderName, details });
    res.json({ success: true, recipient_id: recipient.id, recipient });
  } catch (err) {
    logToFile('Create recipient failed', { error: err.message, response: err.response?.data }, 'ERROR');
    res.status(500).json({ error: 'Failed to create recipient', details: err.message });
  }
});

/**
 * GET /api/payout/recipients
 * 列出收款人
 */
router.get('/api/payout/recipients', requireAuth, async (req, res) => {
  try {
    const recipients = await wise.listRecipients(null, req.query.currency);
    res.json({ success: true, recipients });
  } catch (err) {
    logToFile('List recipients failed', { error: err.message }, 'ERROR');
    res.status(500).json({ error: 'Failed to list recipients', details: err.message });
  }
});

module.exports = router;
