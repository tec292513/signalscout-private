const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// In-memory storage (for testing only)
let customersMap = {};

export default async (req, res) => {
  const { email, memberId, priceId } = req.body;

  console.log('API called with:', { email, memberId, priceId });

  try {
    // Check if customer already exists for this memberId
    let stripeCustomerId = null;
    if (customersMap[memberId]) {
      stripeCustomerId = customersMap[memberId].stripeCustomerId;
      console.log('Found existing Stripe customer:', stripeCustomerId);
    } else {
      // Create new Stripe customer
      console.log('Creating new Stripe customer for:', email);
      const customer = await stripe.customers.create({
        email: email.toLowerCase(),
        metadata: { memberId: memberId }
      });
      stripeCustomerId = customer.id;
      console.log('Stripe customer created:', stripeCustomerId);

      // Store in memory
      customersMap[memberId] = {
        email: email.toLowerCase(),
        stripeCustomerId: stripeCustomerId,
        createdAt: new Date().toISOString()
      };
      console.log('Stored in memory');
    }

    // Create checkout session
    console.log('Creating checkout session for:', stripeCustomerId);
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
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