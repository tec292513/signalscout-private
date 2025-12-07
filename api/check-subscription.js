const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(400).json({ error: 'POST only' });
  }

  const { email } = req.body;

  try {
    // Find customer by email in Stripe
    const customers = await stripe.customers.list({ email, limit: 1 });
    
    if (!customers.data.length) {
      return res.json({ isActive: false });
    }

    const customer = customers.data[0];

    // Check if customer has active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active'
    });

    const isActive = subscriptions.data.length > 0;
    
    return res.json({ isActive });
  } catch (error) {
    console.error('Subscription check error:', error);
    return res.status(500).json({ error: 'Check failed' });
  }
};
```

4. Save and commit to GitHub

Your folder structure should look like:
```
your-repo/
├── api/
│   └── check-subscription.js
├── index.html
├── dashboard.html
└── ...