const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async (req, res) => {
  const { email, memberId, priceId, memberStackToken } = req.body;

  console.log('API called with:', { email, memberId, priceId });

  try {
    // Fetch member data from MemberStack to check if Stripe ID exists
    let stripeCustomerId = null;
    
    try {
      const memberRes = await fetch(`https://api.memberstack.io/v1/members/${memberId}`, {
        headers: { 'Authorization': `Bearer ${memberStackToken}` }
      });
      
      if (memberRes.ok) {
        const memberData = await memberRes.json();
        stripeCustomerId = memberData.customFields?.stripeCustomerId;
        console.log('Found existing Stripe customer in MemberStack:', stripeCustomerId);
      }
    } catch (e) {
      console.log('Could not fetch from MemberStack:', e.message);
    }

    // If no Stripe ID found, create new customer
    if (!stripeCustomerId) {
      console.log('Creating new Stripe customer for:', email);
      const customer = await stripe.customers.create({
        email: email.toLowerCase(),
        metadata: { memberId: memberId }
      });
      stripeCustomerId = customer.id;
      console.log('Stripe customer created:', stripeCustomerId);

      // Store in MemberStack metadata
      try {
        await fetch(`https://api.memberstack.io/v1/members/${memberId}`, {
          method: 'PATCH',
          headers: { 
            'Authorization': `Bearer ${memberStackToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customFields: {
              stripeCustomerId: stripeCustomerId
            }
          })
        });
        console.log('Stored Stripe ID in MemberStack');
      } catch (e) {
        console.error('Error storing in MemberStack:', e.message);
      }
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