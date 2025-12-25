import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(400).json({ error: 'POST only' });
  }

  const { email, customerId } = req.body;

  try {
    let cust_id = customerId;

    // If no customerId provided, search by email
    if (!cust_id) {
      const customers = await stripe.customers.list({
        email: email.toLowerCase(),
        limit: 100  // Check up to 100
      });

      if (customers.data.length === 0) {
        return res.status(200).json({ hasSubscription: false });
      }

      // Find the customer with subscriptions
      for (let customer of customers.data) {
        const subs = await stripe.subscriptions.list({
          customer: customer.id,
          limit: 1
        });
        if (subs.data.length > 0) {
          cust_id = customer.id;
          break;
        }
      }

      if (!cust_id) {
        return res.status(200).json({ hasSubscription: false });
      }
    }

    // Check subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: cust_id,
      limit: 10
    });

    const validSubscriptions = subscriptions.data.filter(sub =>
      ['active', 'trialing', 'past_due'].includes(sub.status)
    );

    const hasSubscription = validSubscriptions.length > 0;

    console.log(`Subscription check for ${email}:`, {
      customerId: cust_id,
      hasSubscription,
      statuses: subscriptions.data.map(s => s.status)
    });

    return res.status(200).json({ 
      hasSubscription,
      customerId: cust_id
    });

  } catch (error) {
    console.error('Error checking subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
