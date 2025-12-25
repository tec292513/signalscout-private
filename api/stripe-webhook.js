import Stripe from 'stripe';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false, // CRITICAL: Disable body parsing
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = 'whsec_NkWbcsbRx415gPKIaqCaCNv9aEadFPHN';

  let event;

  try {
    // Get raw body as buffer
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.log('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    const stripeCustomerId = session.customer;
    const memberId = session.client_reference_id;

    console.log('Payment successful for member:', memberId);

    // Update Memberstack
    try {
      await fetch(`https://api.memberstack.io/v1/members/${memberId}`, {
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
      console.log('Stripe ID saved to Memberstack');
    } catch (e) {
      console.error('Error updating Memberstack:', e.message);
    }
  }

  res.status(200).json({ received: true });
}
