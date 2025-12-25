import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(400).json({ error: 'POST only' });
  }

  const { email, memberId, priceId } = req.body;

  try {
    let stripeCustomerId = null;
    let memberHasStripeId = false;
    let trialUsed = false;

    // Check if user already has a Stripe customer ID in Memberstack
    try {
      const memberRes = await fetch(`https://api.memberstack.io/v1/members/${memberId}`, {
        headers: { 'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}` }
      });

      if (memberRes.ok) {
        const memberData = await memberRes.json();
        stripeCustomerId = memberData?.customFields?.stripeCustomerId || null;
        memberHasStripeId = !!stripeCustomerId;
      }
    } catch (e) {
      console.log('Could not fetch from Memberstack:', e.message);
    }

    // Create new Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: email.toLowerCase(),
        metadata: { memberId }
      });

      stripeCustomerId = customer.id;
      memberHasStripeId = false; // Need to save it
    } else {
      // Check if customer already used trial (existing customer)
      try {
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        trialUsed = customer.metadata?.trial_used === 'true';
        
        console.log(`Customer ${stripeCustomerId}: trialUsed = ${trialUsed}`);
      } catch (e) {
        console.log('Could not retrieve customer metadata:', e.message);
      }
    }

    // Save to Memberstack if not already there
    if (!memberHasStripeId && stripeCustomerId) {
      try {
        await fetch(`https://api.memberstack.io/v1/members/${memberId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customFields: {
              stripeCustomerId: stripeCustomerId
            }
          })
        });
        console.log('Stripe ID saved to Memberstack');
      } catch (e) {
        console.log('Error saving to Memberstack:', e.message);
      }
    }

    // Determine trial eligibility
    const trialPeriodDays = trialUsed ? 0 : 2;
    console.log(`Creating subscription with trial_period_days: ${trialPeriodDays}`);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      client_reference_id: memberId,
      mode: 'subscription',
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      subscription_data: {
        trial_period_days: trialPeriodDays
      },
      success_url: `https://aisignalscout.com/dashboard.html?success=true`,
      cancel_url: `https://aisignalscout.com?canceled=true`
    });

    return res.status(200).json({ url: session.url });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
