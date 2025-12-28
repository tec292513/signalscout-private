import Stripe from 'stripe';
import fetch from 'node-fetch';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, trialDays = 2 } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Check trial eligibility
    const customers = await stripe.customers.list({ email, limit: 1 });
    const isFirstPurchase = customers.data.length === 0;
    const actualTrialDays = isFirstPurchase ? trialDays : 0;

    // Create or get customer
    let customer;
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({ email });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.DOMAIN}/dashboard.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.DOMAIN}/index.html`,
      subscription_data: {
        trial_period_days: actualTrialDays,
      },
    });

    // Save Stripe ID to MemberStack
    const msResponse = await fetch('https://admin.memberstack.com/members/', {
      method: 'PATCH',
      headers: {
        'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        customFields: [
          {
            fieldName: 'stripeCustomerId',
            value: customer.id,
          },
        ],
      }),
    });

    if (!msResponse.ok) {
      console.warn('Failed to save Stripe ID to MemberStack');
    }

    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
