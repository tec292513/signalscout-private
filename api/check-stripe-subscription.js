import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(400).json({ error: 'POST only' });
  }

  const { email } = req.body;

  try {
    // Search for customer by email
    const customers = await stripe.customers.list({
      email: email.toLowerCase(),
      limit: 1
    });

    if (customers.data.length === 0) {
      return res.status(200).json({ hasSubscription: false });
    }

    const customerId = customers.data[0].id;

    // Check for ANY active-like subscription (active, trialing, past_due)
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10
    });

    // Filter for valid statuses
    const validSubscriptions = subscriptions.data.filter(sub =>
      ['active', 'trialing', 'past_due'].includes(sub.status)
    );

    const hasSubscription = validSubscriptions.length > 0;

    console.log(`Subscription check for ${email}:`, {
      customerId,
      hasSubscription,
      statuses: subscriptions.data.map(s => s.status)
    });

    return res.status(200).json({ 
      hasSubscription,
      customerId: customerId
    });

  } catch (error) {
    console.error('Error checking subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
