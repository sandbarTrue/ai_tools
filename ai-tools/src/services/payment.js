// src/services/payment.js — 支付业务逻辑
const { logToFile } = require('../utils/logger');

/**
 * 处理支付完成事件
 * 1. 写入 payment_records
 * 2. 更新用户 is_premium 状态
 * @param {import('mysql2/promise').Pool} db
 * @param {object} webhookObject - Creem webhook 的 object 字段
 */
async function handleCheckoutCompleted(db, webhookObject) {
  const checkoutId = webhookObject.id;
  const orderId = webhookObject.order?.id || null;
  const customerId = webhookObject.customer?.id || null;
  const customerEmail = webhookObject.customer?.email || null;
  const amount = webhookObject.order?.amount ? webhookObject.order.amount / 100 : null; // Creem 金额单位为分
  const currency = webhookObject.order?.currency || 'USD';
  const metadata = webhookObject.metadata || {};
  const userId = metadata.userId || null;

  if (!db) {
    logToFile('DB not connected, skipping payment record write', { checkoutId }, 'WARN');
    return { recorded: false, reason: 'no_db' };
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. 写入 payment_records（幂等：ON DUPLICATE KEY UPDATE）
    await conn.execute(
      `INSERT INTO payment_records
        (user_id, checkout_id, order_id, customer_id, amount, currency, status, creem_metadata)
       VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
       ON DUPLICATE KEY UPDATE status = 'completed', updated_at = NOW()`,
      [userId, checkoutId, orderId, customerId, amount, currency, JSON.stringify(webhookObject)]
    );

    // 2. 更新用户 is_premium（如果有 userId）
    if (userId) {
      await conn.execute(
        `UPDATE users SET is_premium = 1, updated_at = NOW() WHERE id = ?`,
        [userId]
      );
      logToFile('User upgraded to premium', { userId, checkoutId }, 'SUCCESS');
    }

    await conn.commit();
    logToFile('Payment record saved', { checkoutId, orderId, amount, currency }, 'SUCCESS');
    return { recorded: true };
  } catch (err) {
    await conn.rollback();
    logToFile('Failed to save payment record', { checkoutId, error: err.message }, 'ERROR');
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 处理退款事件
 */
async function handleRefund(db, webhookObject) {
  if (!db) return { recorded: false, reason: 'no_db' };

  const orderId = webhookObject.order_id || webhookObject.id;
  try {
    await db.execute(
      `UPDATE payment_records SET status = 'refunded', updated_at = NOW() WHERE order_id = ?`,
      [orderId]
    );
    logToFile('Payment refunded', { orderId }, 'SUCCESS');
    return { recorded: true };
  } catch (err) {
    logToFile('Failed to update refund', { orderId, error: err.message }, 'ERROR');
    throw err;
  }
}

/**
 * 记录提现到 payout_records
 */
async function recordPayout(db, { wiseTransferId, amount, sourceCurrency, targetCurrency, quoteId, recipientId, status, metadata }) {
  if (!db) {
    logToFile('DB not connected, skipping payout record', { wiseTransferId }, 'WARN');
    return null;
  }

  const [result] = await db.execute(
    `INSERT INTO payout_records
      (wise_transfer_id, amount, source_currency, target_currency, wise_quote_id, wise_recipient_id, status, wise_metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [wiseTransferId, amount, sourceCurrency || 'USD', targetCurrency || 'CNY', quoteId, recipientId, status || 'pending', JSON.stringify(metadata || {})]
  );
  logToFile('Payout recorded', { wiseTransferId, insertId: result.insertId }, 'SUCCESS');
  return result.insertId;
}

/**
 * 更新提现状态
 */
async function updatePayoutStatus(db, wiseTransferId, status) {
  if (!db) return;
  await db.execute(
    `UPDATE payout_records SET status = ?, updated_at = NOW() WHERE wise_transfer_id = ?`,
    [status, wiseTransferId]
  );
}

module.exports = {
  handleCheckoutCompleted,
  handleRefund,
  recordPayout,
  updatePayoutStatus,
};
