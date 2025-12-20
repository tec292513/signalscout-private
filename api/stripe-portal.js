const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// In-memory storage (shared across requests in same instance)
let customersMap = {};

export default async (req, res) => {
  const { memberId } = req.body;

  try {
    const customerData = customersMap[memberId];
    
    if (!customerData || !customerData.stripeCustomerId) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerId = customerData.stripeCustomerId;
    console.log('Creating portal session for:', customerId);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: 'https://aisignalscout.com/dashboard.html'
    });

    return res.json({ url: session.url });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};