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
      // Check if customer already used trial by looking at past subscriptions
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          limit: 1,
          status: 'all'  // Include cancelled subscriptions too
        });
        // If they have ANY past subscription, they already used the trial
        trialUsed = subscriptions.data.length > 0;
        console.log(`Customer ${stripeCustomerId}: Has ${subscriptions.data.length} past subscription(s), trialUsed = ${trialUsed}`);
      } catch (e) {
        console.log('Could not retrieve customer subscriptions:', e.message);
        trialUsed = false;  // Default to giving trial if we can't check
      }
    }

    // Save to Memberstack if not already there
if (!memberHasStripeId && stripeCustomerId) {
  try {
    const saveRes = await fetch(`https://api.memberstack.io/v1/members/${memberId}`, {
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
    const saveData = await saveRes.json();
    console.log('SAVE RESPONSE:', saveData);
    console.log(`✅ Stripe ID ${stripeCustomerId} saved to Memberstack for member ${memberId}`);
  } catch (e) {
    console.log('❌ Error saving to Memberstack:', e.message);
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
