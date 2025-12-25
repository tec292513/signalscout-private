import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = 'whsec_NkWbcsbRx415gPKIaqCaCNv9aEadFPHN';

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.log('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const stripeCustomerId = session.customer;
    const memberId = session.client_reference_id; // We'll add this in create-checkout-session

    console.log('Payment successful for member:', memberId);

    // Update Memberstack with Stripe customer ID
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

export const config = {
  api: {
    bodyParser: false, // Stripe needs raw body
  },
};
