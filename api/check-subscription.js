const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(400).json({ error: 'POST only' });
  }

  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ isActive: true }); // Allow if no email
  }

  try {
    const customers = await stripe.customers.list({ 
      email: email.toLowerCase(),
      limit: 1 
    });
    
    if (!customers.data || customers.data.length === 0) {
      return res.json({ isActive: false }); // No customer = not paid
    }

    const customer = customers.data[0];
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active'
    });

    const isActive = subscriptions.data && subscriptions.data.length > 0;
    return res.json({ isActive });
    
  } catch (error) {
    console.error('Stripe error:', error.message);
    return res.json({ isActive: true }); // Allow on error
  }
};