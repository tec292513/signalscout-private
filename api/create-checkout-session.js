const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async (req, res) => {
  const { email, memberId, priceId } = req.body;

  try {
    const customer = await stripe.customers.create({
      email: email.toLowerCase(),
      metadata: { memberId: memberId }
    });

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      payment_method_collection: 'always',
      billing_address_collection: 'required',
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      subscription_data: {
        trial_period_days: 2
      },
      success_url: 'https://aisignalscout.com/dashboard?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://aisignalscout.com/?canceled=true'
    });

    return res.json({ url: session.url });

  } catch (error) {
    console.error('Stripe error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};