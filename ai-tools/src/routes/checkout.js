// src/routes/checkout.js — Creem checkout 流程 & 支付页面
const express = require('express');
const crypto = require('crypto');
const { CREEM_PRODUCT_ID, CREEM_API_KEY, APP_URL } = require('../config');
const { createCheckout, getCheckout, verifyRedirectSignature } = require('../services/creem');
const { requireAuth } = require('../middleware/auth');
const { logToFile } = require('../utils/logger');

const router = express.Router();

// ── POST /api/create-checkout ——————————————————————————
// 创建 Creem 结账会话（需要登录）
router.post('/api/create-checkout', requireAuth, async (req, res) => {
  try {
    const { product_id, metadata } = req.body;

    const data = await createCheckout({
      productId: product_id || CREEM_PRODUCT_ID,
      successUrl: `${APP_URL}/payment/success`,
      cancelUrl: `${APP_URL}/payment/cancel`,
      metadata: metadata || { userId: req.userId, source: 'ai-tools' },
    });

    res.json({ success: true, checkout_url: data.checkout_url, checkout_id: data.id });
  } catch (err) {
    logToFile('Create checkout failed', { error: err.message }, 'ERROR');
    res.status(500).json({ error: 'Failed to create checkout session', details: err.message });
  }
});

// ── GET /payment/status/:checkoutId ————————————————————
router.get('/payment/status/:checkoutId', requireAuth, async (req, res) => {
  try {
    const data = await getCheckout(req.params.checkoutId);
    res.json({
      success: true,
      checkout_id: req.params.checkoutId,
      status: data.status,
      request_id: data.request_id,
      metadata: data.metadata,
      created_at: data.created_at,
      mode: data.mode,
    });
  } catch (err) {
    logToFile('Get checkout status failed', { error: err.message }, 'ERROR');
    res.status(500).json({ error: 'Failed to check payment status', details: err.message });
  }
});

// ── GET /testPay — 支付入口页 ——————————————————————————
router.get('/testPay', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment — AI Tools</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center">
  <div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
    <div class="text-center mb-6">
      <h1 class="text-2xl font-bold text-gray-800 mb-2">💳 Citation Generator Pro</h1>
      <p class="text-gray-600">Unlock unlimited citations with premium features</p>
    </div>
    <div class="bg-blue-50 p-4 rounded-lg mb-6">
      <div class="flex justify-between items-center">
        <div>
          <h3 class="font-semibold text-blue-800">Premium Plan</h3>
          <p class="text-sm text-blue-600">Unlimited citations • All formats • Priority support</p>
        </div>
        <div class="text-right">
          <div class="text-2xl font-bold text-blue-800">$4.49</div>
          <div class="text-sm text-blue-600">one-time</div>
        </div>
      </div>
    </div>
    <ul class="space-y-3 mb-6 text-sm text-gray-600">
      <li><span class="text-green-500 mr-2">✓</span>MLA, APA, Chicago, Harvard, IEEE formats</li>
      <li><span class="text-green-500 mr-2">✓</span>Unlimited citation generation</li>
      <li><span class="text-green-500 mr-2">✓</span>Export to multiple formats</li>
      <li><span class="text-green-500 mr-2">✓</span>Priority customer support</li>
    </ul>
    <button id="payBtn" class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold">
      🚀 Pay $4.49 Now
    </button>
    <div id="loading" class="hidden text-center mt-4">
      <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <p class="text-sm text-gray-600 mt-2">Creating payment session…</p>
    </div>
  </div>
  <script>
    document.getElementById('payBtn').addEventListener('click', async function () {
      const btn = this;
      btn.disabled = true; btn.classList.add('opacity-50');
      document.getElementById('loading').classList.remove('hidden');
      try {
        const r = await fetch('/api/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: '${CREEM_PRODUCT_ID}', metadata: { userId: 'user_' + Date.now(), source: 'citation_generator' } })
        });
        if (!r.ok) throw new Error('checkout failed');
        const d = await r.json();
        location.href = d.checkout_url;
      } catch (e) {
        alert('Payment setup failed. Please try again.');
        btn.disabled = false; btn.classList.remove('opacity-50');
        document.getElementById('loading').classList.add('hidden');
      }
    });
  </script>
</body>
</html>`);
});

// ── GET /payment/success ———————————————————————————————
router.get('/payment/success', async (req, res) => {
  const { checkout_id, order_id, customer_id, subscription_id, product_id, request_id, signature } = req.query;

  let paymentStatus = 'unknown';
  let paymentDetails = {};
  let signatureValid = false;

  if (signature && checkout_id) {
    const params = { checkout_id, order_id, customer_id, subscription_id, product_id, request_id };
    signatureValid = verifyRedirectSignature(params, signature, CREEM_API_KEY);

    if (signatureValid) {
      try {
        const checkout = await getCheckout(checkout_id);
        paymentStatus = checkout.status;
        paymentDetails = { amount: checkout.amount, currency: checkout.currency };
      } catch (_) {}
    }
  }

  const ok = paymentStatus === 'completed' || paymentStatus === 'paid';

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Payment ${ok ? 'Successful' : 'Status'}</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center">
<div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
  <div class="text-6xl mb-4">${ok ? '✅' : '⏳'}</div>
  <h1 class="text-2xl font-bold mb-4">${ok ? 'Payment Successful!' : 'Payment Processing…'}</h1>
  <p class="text-gray-600 mb-6">${ok ? 'Thank you! Your subscription is now active.' : 'We are processing your payment.'}</p>
  <div class="bg-gray-50 p-4 rounded-lg text-left text-sm mb-4">
    <p><strong>Checkout:</strong> ${checkout_id || 'N/A'}</p>
    <p><strong>Order:</strong> ${order_id || 'N/A'}</p>
    <p><strong>Status:</strong> ${paymentStatus}</p>
    <p><strong>Signature:</strong> ${signatureValid ? 'Valid ✓' : 'Invalid ✗'}</p>
    ${paymentDetails.amount ? `<p><strong>Amount:</strong> ${paymentDetails.amount} ${paymentDetails.currency}</p>` : ''}
  </div>
  ${ok ? '<div class="bg-green-50 p-4 rounded-lg mb-4"><h3 class="font-semibold text-green-800 mb-1">🎉 Pro Features Unlocked!</h3><p class="text-sm text-green-700">All formats • Unlimited citations • Priority support</p></div>' : ''}
  <a href="/" class="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Continue</a>
</div></body></html>`);
});

// ── GET /payment/cancel ————————————————————————————————
router.get('/payment/cancel', (req, res) => {
  logToFile('Payment cancelled', { checkout_id: req.query.checkout_id }, 'WARN');
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Payment Cancelled</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center">
<div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
  <div class="text-6xl mb-4">⚠️</div>
  <h1 class="text-2xl font-bold mb-4">Payment Cancelled</h1>
  <p class="text-gray-600 mb-6">No charges were made.</p>
  <div class="space-y-3">
    <a href="/testPay" class="block w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">Try Again</a>
    <a href="/" class="block w-full bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700">Go Home</a>
  </div>
  <p class="mt-4 text-sm text-gray-500">Questions? <a href="mailto:support@junaitools.com" class="text-blue-600">support@junaitools.com</a></p>
</div></body></html>`);
});

// ── GET /payment/failed ————————————————————————————————
router.get('/payment/failed', (req, res) => {
  logToFile('Payment failed page', { checkout_id: req.query.checkout_id, error: req.query.error }, 'ERROR');
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Payment Failed</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center">
<div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
  <div class="text-6xl mb-4">❌</div>
  <h1 class="text-2xl font-bold mb-4">Payment Failed</h1>
  <p class="text-gray-600 mb-6">Unable to process your payment. Please try again or use a different payment method.</p>
  <div class="space-y-3">
    <a href="/testPay" class="block w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">Try Again</a>
    <a href="/" class="block w-full bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700">Go Home</a>
  </div>
  <p class="mt-4 text-sm text-gray-500">Need help? <a href="mailto:support@junaitools.com" class="text-blue-600">support@junaitools.com</a></p>
</div></body></html>`);
});

module.exports = router;
