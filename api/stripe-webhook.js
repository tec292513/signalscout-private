import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false
  }
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(data);
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let rawBody;

  try {
    rawBody = await getRawBody(req);
  } catch (e) {
    console.error('Error reading raw body:', e.message);
    return res.status(400).json({ error: 'Could not read request body' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    const { type, data } = event;
    const stripeCustomerId = data.object?.customer;
    const memberId = data.object?.metadata?.memberId;

    console.log(`📥 Webhook event: ${type}`);
    console.log(` Customer: ${stripeCustomerId}, Member: ${memberId}`);

    if (type === 'customer.subscription.created' ||
        type === 'customer.subscription.updated' ||
        type === 'customer.subscription.deleted') {
      if (memberId && stripeCustomerId) {
        try {
          const updateRes = await fetch(`https://api.memberstack.com/v1/members/${memberId}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              customFields: {
                stripeCustomerId: stripeCustomerId
              }
            })
          });

          if (updateRes.ok) {
            console.log(`✅ Synced stripeCustomerId ${stripeCustomerId} to member ${memberId}`);
          } else {
            const errorText = await updateRes.text();
            console.log(`❌ Failed to sync to MemberStack (${updateRes.status}):`, errorText);
          }
        } catch (e) {
          console.log('❌ Error syncing to MemberStack:', e.message);
        }
      }
    }

    return res.status(200).json({ success: true, eventType: type });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: error.message });
  }
}
