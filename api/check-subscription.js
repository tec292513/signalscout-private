const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// In-memory storage (shared across requests in same instance)
let customersMap = {};

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(400).json({ error: 'POST only' });
  }

  const { memberId } = req.body;
  
  if (!memberId) {
    return res.status(400).json({ isActive: true });
  }

  try {
    const customerData = customersMap[memberId];
    
    if (!customerData || !customerData.stripeCustomerId) {
      console.log('No Stripe customer found for memberId:', memberId);
      return res.json({ isActive: false });
    }

    console.log('Checking subscription for Stripe customer:', customerData.stripeCustomerId);
    
    const subscriptions = await stripe.subscriptions.list({
      customer: customerData.stripeCustomerId,
      status: 'active'
    });

    const isActive = subscriptions.data && subscriptions.data.length > 0;
    console.log('Is active subscription:', isActive);
    return res.json({ isActive });
    
  } catch (error) {
    console.error('Stripe error:', error.message);
    return res.json({ isActive: true });
  }
};