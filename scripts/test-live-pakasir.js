const fs = require('fs');


const slug = process.env.PAKASIR_PROJECT_SLUG || 'scota';
const apiKey = process.env.PAKASIR_API_KEY || '';
const baseUrl = process.env.PAKASIR_BASE_URL || 'https://app.pakasir.com';

console.log('Testing Pakasir API Connection:');
console.log('Base URL:', baseUrl);
console.log('Slug:', slug);
console.log('API Key:', apiKey ? (apiKey.slice(0, 6) + '...' + apiKey.slice(-4)) : 'MISSING');

async function testPakasir() {
  const orderId = 'TEST-' + Date.now();
  const endpoint = `${baseUrl}/api/transactioncreate/qris`;
  
  console.log('\nSending test QRIS transaction creation request to:', endpoint);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: slug,
        order_id: orderId,
        amount: 10000,
        api_key: apiKey
      })
    });

    const data = await res.json().catch(() => ({}));
    console.log('HTTP Status:', res.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));

    if (res.ok && data.payment) {
      console.log('\n✅ PAKASIR API CONNECTION SUCCESSFUL!');
      console.log('Payment Method:', data.payment.payment_method);
      console.log('Total Payment:', data.payment.total_payment);
      console.log('Expired At:', data.payment.expired_at);
      console.log('Payment String / Number received:', Boolean(data.payment.payment_number));
    } else {
      console.log('\n⚠️ API response returned non-success or error:', data);
    }
  } catch (err) {
    console.error('Connection error:', err);
  }
}

testPakasir();
