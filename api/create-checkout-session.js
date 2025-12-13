const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async (req, res) => {
  const { email, memberId, priceId } = req.body;

  try {
    // Find or create Stripe customer
    const customers = await stripe.customers.list({
      email: email.toLowerCase(),
      limit: 1
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({ 
        email: email.toLowerCase(),
        metadata: { memberId: memberId }
      });
      customerId = customer.id;
    }

    // Create checkout session - REQUIRE PAYMENT METHOD
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'], // FORCE CARD COLLECTION
      payment_method_collection: 'always', // ALWAYS collect payment method
      billing_address_collection: 'required', // REQUIRE address
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 2,
        default_payment_method: '{CHECKOUT_SESSION_ID}' // Use session payment method
      },
      success_url: `${process.env.BASE_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/?canceled=true`
    });

    console.log('Checkout session created:', {
      sessionId: session.id,
      customerId: customerId,
      paymentMethodCollection: session.payment_method_collection
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};