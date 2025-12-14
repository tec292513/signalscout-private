const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async (req, res) => {
  const { email } = req.body;

  try {
    const customers = await stripe.customers.list({
      email: email.toLowerCase(),
      limit: 1
    });

    if (!customers.data || customers.data.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerId = customers.data[0].id;

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