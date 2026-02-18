// src/routes/webhook.js — Creem webhook 处理
const express = require('express');
const { CREEM_WEBHOOK_SECRET } = require('../config');
const { verifyWebhookSignature } = require('../services/creem');
const { handleCheckoutCompleted, handleRefund } = require('../services/payment');
const { logToFile } = require('../utils/logger');

const router = express.Router();

/**
 * POST /creem/webhook
 * Creem 异步事件回调
 */
router.post('/creem/webhook', async (req, res) => {
  try {
    const webhookData = req.body;
    const eventType = webhookData.eventType || webhookData.type;
    const creemSignature = req.headers['creem-signature'];

    // 签名验证
    if (creemSignature && CREEM_WEBHOOK_SECRET) {
      const payload = JSON.stringify(req.body);
      if (!verifyWebhookSignature(payload, creemSignature, CREEM_WEBHOOK_SECRET)) {
        logToFile('Invalid webhook signature', { event_type: eventType }, 'ERROR');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    logToFile('Webhook received', { event_type: eventType, webhook_id: webhookData.id });

    // 获取数据库连接（挂在 app 上）
    const db = req.app.get('db');

    switch (eventType) {
      case 'checkout.completed': {
        logToFile('✅ Checkout completed', {
          checkout_id: webhookData.object?.id,
          email: webhookData.object?.customer?.email,
          amount: webhookData.object?.order?.amount,
        }, 'SUCCESS');

        // 写入 payment_records + 激活 premium
        try {
          await handleCheckoutCompleted(db, webhookData.object || {});
        } catch (err) {
          logToFile('handleCheckoutCompleted error', { error: err.message }, 'ERROR');
        }
        break;
      }

      case 'subscription.paid':
        logToFile('💰 Subscription paid', {
          subscription_id: webhookData.object?.id,
          amount: webhookData.object?.product?.price,
        });
        break;

      case 'subscription.canceled':
        logToFile('❌ Subscription cancelled', {
          subscription_id: webhookData.object?.id,
        });
        break;

      case 'refund.created':
        logToFile('💸 Refund created', {
          refund_id: webhookData.object?.id,
          amount: webhookData.object?.refund_amount,
        });
        try {
          await handleRefund(db, webhookData.object || {});
        } catch (err) {
          logToFile('handleRefund error', { error: err.message }, 'ERROR');
        }
        break;

      case 'dispute.created':
        logToFile('⚠️ Dispute created', { dispute_id: webhookData.object?.id }, 'WARN');
        break;

      default:
        logToFile('📝 Unhandled webhook event', { event_type: eventType });
    }

    res.status(200).json({ success: true, event_type: eventType });
  } catch (err) {
    logToFile('Webhook processing error', { error: err.message }, 'ERROR');
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
