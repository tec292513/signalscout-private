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
      // No customer found = no subscription
      return res.status(200).json({ hasSubscription: false });
    }

    const customerId = customers.data[0].id;

    // Check if customer has active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1
    });

    // Also check for trialing subscriptions
    const trialingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'trialing',
      limit: 1
    });

    const hasSubscription = subscriptions.data.length > 0 || trialingSubscriptions.data.length > 0;

    return res.status(200).json({ 
      hasSubscription,
      customerId: customerId
    });

  } catch (error) {
    console.error('Error checking subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
