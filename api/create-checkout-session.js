const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async (req, res) => {
  const { email, memberId, priceId } = req.body;

  console.log('API called with:', { email, memberId, priceId });

  try {
    console.log('Creating customer for:', email);
    const customer = await stripe.customers.create({
      email: email.toLowerCase(),
      metadata: { memberId: memberId }
    });
    console.log('Customer created:', customer.id);

    console.log('Creating checkout session');
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
      success_url: 'https://aisignalscout.com/dashboard.html?email=' + encodeURIComponent(email),
      cancel_url: 'https://aisignalscout.com/?canceled=true'
    });
    
    console.log('Session created:', session.id);
    return res.json({ url: session.url });

  } catch (error) {
    console.error('Error details:', error);
    return res.status(500).json({ error: error.message });
  }
};