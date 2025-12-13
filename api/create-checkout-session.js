const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async (req, res) => {
  const { email, memberId, priceId } = req.body;

  try {
    // ALWAYS CREATE A NEW CUSTOMER (don't reuse)
    const customer = await stripe.customers.create({
      email: email.toLowerCase(),
      metadata: { 
        memberId: memberId,
        createdAt: new Date().toISOString()
      }
    });

    const customerId = customer.id;
    console.log('Created new customer:', customerId);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      payment_method_collection: 'always',
      billing_address_collection: 'required',
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 2
      },
      success_url: `${process.env.BASE_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/?canceled=true`
    });

    console.log('Checkout session created:', session.id);

    return res.json({ url: session.url });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};